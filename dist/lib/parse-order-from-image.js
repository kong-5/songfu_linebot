"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOrderItemsFromImageBuffer = parseOrderItemsFromImageBuffer;
const crypto = require("crypto");
const parse_order_message_js_1 = require("./parse-order-message.js");
const vision_ocr_js_1 = require("./vision-ocr.js");
const gemini_order_helpers_js_1 = require("./gemini-order-helpers.js");
const order_parsed_heuristics_js_1 = require("./order-parsed-heuristics.js");
const order_form_templates_js_1 = require("./order-form-templates.js");
const order_history_items_js_1 = require("./order-history-items.js");
const customer_profile_js_1 = require("./customer-profile.js");

/**
 * 同一張圖在短時間內常被重複解析（LINE webhook 重送、30 秒結單整單重辨識、後台「重新辨識」按鈕）。
 * 用最近結果的 LRU 快取（key = sha256(buffer) + customerId + subClientId）避免再呼叫 OCR/Gemini。
 * 預設容量 50；可用 PARSE_IMAGE_CACHE_SIZE 覆寫；設為 0 則停用。
 */
const PARSE_CACHE_MAX = Math.max(0, Number(process.env.PARSE_IMAGE_CACHE_SIZE ?? 50) | 0);
const parseCache = new Map();
function buildCacheKey(buffer, fallbackUnit, options) {
    if (!buffer?.length)
        return null;
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const cust = options?.customerId ? String(options.customerId) : "";
    const sub = options?.subClientId ?? options?.sub_client_id ?? "";
    return `${hash}|${cust}|${sub}|${fallbackUnit ?? ""}`;
}
function cacheGet(key) {
    if (!PARSE_CACHE_MAX || !key)
        return null;
    if (!parseCache.has(key))
        return null;
    const v = parseCache.get(key);
    parseCache.delete(key);
    parseCache.set(key, v); // LRU: bump to most-recent
    return v;
}
function cacheSet(key, value) {
    if (!PARSE_CACHE_MAX || !key)
        return;
    if (parseCache.has(key))
        parseCache.delete(key);
    parseCache.set(key, value);
    while (parseCache.size > PARSE_CACHE_MAX) {
        const oldest = parseCache.keys().next().value;
        if (oldest === undefined)
            break;
        parseCache.delete(oldest);
    }
}
/** 文字結果是否「強到」可以略過視覺模型？需明確 opt-in（LINE_SKIP_VISION_WHEN_TEXT_STRONG=1）。 */
function isTextResultStrongEnough(parsed) {
    if (!Array.isArray(parsed) || parsed.length < 3)
        return false;
    let allCjk = true;
    let allReasonableQty = true;
    let confidenceSum = 0;
    let confidenceCount = 0;
    for (const p of parsed) {
        const name = String(p?.rawName || "").trim();
        if (!/[一-鿿]/.test(name))
            allCjk = false;
        const q = Number(p?.quantity);
        if (!Number.isFinite(q) || q < 0 || q > 5000)
            allReasonableQty = false;
        if (p?.confidenceScore != null && Number.isFinite(Number(p.confidenceScore))) {
            confidenceSum += Number(p.confidenceScore);
            confidenceCount += 1;
        }
    }
    if (!allCjk || !allReasonableQty)
        return false;
    if (confidenceCount > 0) {
        const avg = confidenceSum / confidenceCount;
        if (avg < 80)
            return false; // 文字模型自評分數不夠高 → 仍跑視覺
    }
    return true;
}
/** 圖片：OCR → 版型清洗 → Gemini 文字（整段）→ Gemini 視覺（手寫／雙欄）
 * @param options.geminiExtraSuffix 可選，客戶筆跡對照等，併入 Gemini 文字／視覺提示
 * @param options.db 可選，搭配 options.customerId 載入該客戶 Few-Shot 範例
 * @param options.customerId 可選
 * @param options.historyItems 可選，若已預先撈好歷史品項小抄則直接使用；否則有 db+customerId 時自動查 order_items
 * @param options.subClientId / options.sub_client_id 可選，篩選子客戶歷史品項
 */
async function parseOrderItemsFromImageBuffer(buffer, fallbackUnit, options) {
    const cacheKey = buildCacheKey(buffer, fallbackUnit, options);
    if (cacheKey) {
        const hit = cacheGet(cacheKey);
        if (hit) {
            console.log("[parse-order-from-image] cache hit (sha256=%s, items=%d)", cacheKey.split("|")[0].slice(0, 8), hit.parsed?.length || 0);
            return hit;
        }
    }
    const geminiExtraSuffix = (options && typeof options.geminiExtraSuffix === "string" && options.geminiExtraSuffix.trim())
        ? options.geminiExtraSuffix.trim()
        : "";
    let profileSheet = "";
    if (options?.db && options?.customerId) {
        try {
            profileSheet = await customer_profile_js_1.buildCustomerCheatSheetText(options.db, options.customerId);
        }
        catch (_) { /* ignore */ }
    }
    const mergedGeminiSuffix = [profileSheet, geminiExtraSuffix].filter(Boolean).join("\n\n");
    const knownSub = options && typeof options.knownSubCustomers === "string" && options.knownSubCustomers.trim()
        ? options.knownSubCustomers.trim()
        : "";
    const geminiTextOpts = {
        ...(mergedGeminiSuffix ? { extraPromptSuffix: mergedGeminiSuffix } : {}),
        ...(knownSub ? { knownSubCustomers: knownSub } : {}),
    };
    if (options?.db && options?.customerId) {
        geminiTextOpts.db = options.db;
        geminiTextOpts.customerId = options.customerId;
    }
    const hasGeminiTextOpts = Object.keys(geminiTextOpts).length > 0;
    let ocrText = null;
    if (buffer?.length && process.env.GOOGLE_CLOUD_VISION_API_KEY) {
        try {
            ocrText = await (0, vision_ocr_js_1.getTextFromImageBuffer)(buffer);
        }
        catch (_) {
            ocrText = null;
        }
    }
    // 早退：偵測「不是訂單」的圖（自家廣播圖、自家銷貨單回傳等），不打 Gemini、回空 items
    const nonOrder = require("./non-order-image-detector.js").detectNonOrderImage(ocrText);
    if (nonOrder) {
        console.log("[parse-order-from-image] non-order detected reason=%s signals=%s — early return", nonOrder.reason, nonOrder.signals.join(","));
        const skipResult = { parsed: [], ocrText: ocrText || null, _nonOrderReason: nonOrder.reason, _nonOrderSignals: nonOrder.signals };
        if (cacheKey) cacheSet(cacheKey, skipResult);
        return skipResult;
    }
    const template = (0, order_form_templates_js_1.detectOrderFormTemplate)(ocrText);
    const parseText = template
        ? (0, order_form_templates_js_1.preprocessOcrTextByTemplate)(ocrText, template)
        : (ocrText || "");
    if (template) {
        console.log("[parse-order-from-image] matched template=%s", template.id);
    }
    let parsed = parseText ? await (0, parse_order_message_js_1.parseOrderMessage)(parseText, fallbackUnit, hasGeminiTextOpts ? geminiTextOpts : undefined) : [];
    parsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(parsed);
    const geminiKey = (0, gemini_order_helpers_js_1.getGeminiApiKey)();
    /**
     * 預設：只要有圖 + Gemini 金鑰就**一律**再跑視覺模型比對筆數。
     * 雙欄手寫時 OCR+文字模型常已得到「看起來夠多」的筆數，但仍可能遠少於紙上實際條目；視覺模型可補齊。
     *
     * 省錢開關（opt-in）：若文字結果已「足夠強」（≥3 筆、皆含中文、數量合理、平均信心 ≥80），
     * 設定 LINE_SKIP_VISION_WHEN_TEXT_STRONG=1 即可略過視覺模型呼叫，省下一次 Gemini 視覺費用與延遲。
     */
    const skipVisionWhenStrong = process.env.LINE_SKIP_VISION_WHEN_TEXT_STRONG === "1";
    const textStrong = skipVisionWhenStrong && isTextResultStrongEnough(parsed);
    if (textStrong) {
        console.log("[parse-order-from-image] 文字結果已足夠強（%d 筆），略過視覺模型（LINE_SKIP_VISION_WHEN_TEXT_STRONG=1）", parsed.length);
    }
    if (buffer?.length && geminiKey && !textStrong) {
        const oc = ocrText || parseText || "";
        const lungangLike = /龍港/.test(oc) && /品名/.test(oc) && /數量/.test(oc);
        const lungangSuffix = "（本圖 OCR 含「龍港／品名／數量」）此頁極可能為**多欄印刷品名＋手寫數量**；請再確認依**左欄→中欄→右欄**直向逐列讀取，且手寫「kg」類必拆成數量與單位，勿產生萬位以上離譜數字。";
        const visionParts = [];
        // 若命中已知預印勾選表，把預印品項清單當 hint 給 vision
        // (松富 HACCP / 龍港 / 湯蒸 三款 — 治本「普羅蔔=苜蓿芽」這類誤辨)
        const knownItemsHint = (0, order_form_templates_js_1.buildKnownItemsHintForVision)(template);
        if (knownItemsHint)
            visionParts.push(knownItemsHint);
        if (lungangLike)
            visionParts.push(lungangSuffix);
        if (mergedGeminiSuffix)
            visionParts.push(mergedGeminiSuffix);
        const visionOpts = {};
        if (visionParts.length)
            visionOpts.extraPromptSuffix = visionParts.join("\n\n");
        if (options?.db && options?.customerId) {
            visionOpts.db = options.db;
            visionOpts.customerId = options.customerId;
        }
        if (knownSub)
            visionOpts.knownSubCustomers = knownSub;
        let historyItems = [];
        if (options && Object.prototype.hasOwnProperty.call(options, "historyItems") && Array.isArray(options.historyItems)) {
            historyItems = options.historyItems;
        }
        else if (options?.db && options?.customerId) {
            try {
                historyItems = await order_history_items_js_1.loadDistinctOrderItemNamesForCustomer(options.db, options.customerId, options.subClientId ?? options.sub_client_id);
            }
            catch (he) {
                console.warn("[parse-order-from-image] history items:", he?.message || he);
            }
        }
        visionOpts.historyItems = historyItems;
        const rows = await (0, gemini_order_helpers_js_1.parseOrderWithGeminiImage)(buffer, Object.keys(visionOpts).length ? visionOpts : undefined);
        if (rows && rows.length) {
            let visionParsed = rows.map((p) => ({
                rawName: p.rawName,
                quantity: (0, gemini_order_helpers_js_1.coerceQuantityFromGemini)(p.quantity),
                unit: (0, gemini_order_helpers_js_1.coerceUnitFromGemini)(p.unit) || "公斤",
                remark: p.remark ?? null,
                subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                confidenceScore: p.confidenceScore != null ? p.confidenceScore : null,
            }));
            visionParsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(visionParsed);
            if (visionParsed.length > 0 && visionParsed.length >= parsed.length) {
                if (visionParsed.length > parsed.length) {
                    console.log("[parse-order-from-image] 採用 Gemini 視覺（規則/OCR 筆數=%s 視覺筆數=%s）", parsed.length, visionParsed.length);
                }
                else {
                    console.log("[parse-order-from-image] Gemini 視覺與 OCR 同筆數（%s 筆），視覺結果優先（手寫辨識較可靠）", visionParsed.length);
                }
                parsed = visionParsed;
            }
        }
    }
    parsed = (0, order_parsed_heuristics_js_1.dedupeParsedOrderRows)(parsed);
    // 訂單 raw_message 保留完整 OCR，解析仍用 parseText（版型清洗後）
    const result = { parsed, ocrText: ocrText || parseText || null };
    if (cacheKey)
        cacheSet(cacheKey, result);
    return result;
}
