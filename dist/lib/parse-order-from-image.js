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
/** 把品名標準化以便比對（去除空白、半形化、小寫化） */
function normNameForCompare(s) {
    return String(s || "").replace(/\s+/g, "").toLowerCase();
}
/**
 * 視覺結果是否值得採用（A4 合理性檢查）：
 * - 視覺 0 筆 → 拒絕
 * - 視覺筆數 < OCR 筆數 → 拒絕（沿用 OCR，視覺可能漏看）
 * - 視覺筆數 == OCR 筆數 → 採用（手寫辨識較可靠）
 * - 視覺筆數 > OCR 筆數 →
 *    - 若 OCR>0 且兩者品名重疊率 < 50% → 拒絕（疑似視覺幻想新品項）
 *    - 若任一筆 quantity 超過合理門檻（>5000）→ 拒絕（OCR/視覺數字錯位）
 *    - 否則採用
 */
function shouldAdoptVisionResult(ocrParsed, visionParsed) {
    if (!Array.isArray(visionParsed) || visionParsed.length === 0)
        return { ok: false, reason: "vision_empty" };
    // 任一筆數量極端 → 拒絕（手寫 20kg 被讀成 20000 那類）
    for (const v of visionParsed) {
        const q = Number(v?.quantity);
        if (Number.isFinite(q) && q > 5000)
            return { ok: false, reason: `vision_qty_extreme(${q})` };
    }
    const ocrLen = Array.isArray(ocrParsed) ? ocrParsed.length : 0;
    if (visionParsed.length < ocrLen)
        return { ok: false, reason: "vision_fewer_than_ocr" };
    if (visionParsed.length === ocrLen)
        return { ok: true, reason: "same_count_vision_priority" };
    // 視覺筆數較多：檢查品名重疊率（OCR 結果應該大致是視覺結果的子集）
    if (ocrLen >= 3) {
        const ocrNames = new Set(ocrParsed.map((p) => normNameForCompare(p?.rawName)));
        let overlap = 0;
        for (const v of visionParsed) {
            const n = normNameForCompare(v?.rawName);
            if (n && ocrNames.has(n))
                overlap += 1;
        }
        const overlapRate = ocrLen ? overlap / ocrLen : 1;
        if (overlapRate < 0.5)
            return { ok: false, reason: `low_overlap(${(overlapRate * 100).toFixed(0)}%)` };
    }
    return { ok: true, reason: "more_items_passes_check" };
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
/**
 * 幾何對行校驗：用 OCR 字框座標驗證視覺模型「數量掛在哪一列」——
 * 掛錯列（手寫字大溢出到上一列）→ 改名；刻意跨兩列的大數字 → 壓信心＋remark 加註。
 * 只在命中預印模板（有 knownItems）且有字框時執行；任何例外都吞掉，絕不阻斷主流程。
 */
function applyRowAnchorGeometryCheck(parsed, boxes, template, stageLabel) {
    try {
        if (!Array.isArray(parsed) || parsed.length === 0)
            return parsed;
        if (!template || !Array.isArray(template.knownItems) || template.knownItems.length === 0)
            return parsed;
        if (!boxes || !Array.isArray(boxes.words) || boxes.words.length === 0)
            return parsed;
        const { validateParsedAgainstRowAnchors } = require("./form-row-anchor.js");
        const res = validateParsedAgainstRowAnchors({ parsed, words: boxes.words, knownItems: template.knownItems });
        if (!res || !Array.isArray(res.parsed))
            return parsed;
        if (!res.ok) {
            console.log("[parse-order-from-image] 幾何對行校驗（%s）略過（%s）", stageLabel, res.reason || "unknown");
            return parsed;
        }
        const corrections = Array.isArray(res.corrections) ? res.corrections : [];
        if (corrections.length) {
            const renames = corrections.filter((c) => c.type === "rename").length;
            const flags = corrections.filter((c) => c.type === "flag").length;
            console.log("[parse-order-from-image] 幾何對行校驗（%s）：改名 %d 筆、跨列標記 %d 筆", stageLabel, renames, flags);
            for (const c of corrections)
                console.log("[parse-order-from-image]   - %s", c.detail);
        }
        return res.parsed;
    }
    catch (e) {
        console.warn("[parse-order-from-image] 幾何對行校驗失敗（%s，不阻斷）:", stageLabel, e?.message || e);
        return parsed;
    }
}
/**
 * 目前結果是否「信心偏低」，值得再請 Claude vision 出第二意見（雙模型保險）。
 *  - 0 筆 → 低（Gemini／文字都沒讀到東西）
 *  - 任一筆自評信心 < minConf → 低
 *  - 平均信心 < minConf + 5 → 低
 * minConf 預設 70，可用 LINE_CLAUDE_FALLBACK_MIN_CONF 覆寫。
 * 若每一筆都沒有信心分數可判（cnt=0）→ 回 false，避免在無依據下多花一次 Claude 費用。
 */
function shouldTryClaudeFallback(parsed) {
    if (!Array.isArray(parsed) || parsed.length === 0)
        return true;
    const minConf = Math.max(0, Math.min(100, Number(process.env.LINE_CLAUDE_FALLBACK_MIN_CONF ?? 70) || 70));
    let sum = 0, cnt = 0, anyLow = false;
    for (const p of parsed) {
        const c = p?.confidenceScore;
        if (c == null || !Number.isFinite(Number(c)))
            continue;
        const n = Number(c);
        sum += n;
        cnt += 1;
        if (n < minConf)
            anyLow = true;
    }
    if (cnt === 0)
        return false;
    if (anyLow)
        return true;
    return (sum / cnt) < (minConf + 5);
}
/** 圖片：OCR → 版型清洗 → Gemini 文字（整段）→ Gemini 視覺（手寫／雙欄）
 * @param options.geminiExtraSuffix 可選，客戶筆跡對照等，併入 Gemini 文字／視覺提示
 * @param options.db 可選，搭配 options.customerId 載入該客戶 Few-Shot 範例
 * @param options.customerId 可選
 * @param options.historyItems 可選，若已預先撈好歷史品項小抄則直接使用；否則有 db+customerId 時自動查 order_items
 * @param options.subClientId / options.sub_client_id 可選，篩選子客戶歷史品項
 */
async function parseOrderItemsFromImageBuffer(buffer, fallbackUnit, options) {
    // 人工指定角度 / 跳過自動轉正時不走快取（同一張原圖在不同角度下結果不同）
    const forceRotateDeg = Number(options?.forceRotateDeg);
    const hasForceRotate = Number.isFinite(forceRotateDeg) && (((forceRotateDeg % 360) + 360) % 360) !== 0;
    const skipAutoOrient = Boolean(options?.skipAutoOrient) || hasForceRotate;
    const bypassCache = hasForceRotate || Boolean(options?.skipAutoOrient);
    const cacheKey = bypassCache ? null : buildCacheKey(buffer, fallbackUnit, options);
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
    // G26：自動轉正。餐飲客戶常把直式訂購單橫拍，影像無 EXIF 方向，送辨識會嚴重對錯行／幻想數量。
    // 送 OCR/Gemini 前先把圖轉正（偵測失敗回原圖，不阻擋流程）。
    // 人工指定 forceRotateDeg → 直接轉該角度、不跑自動偵測；skipAutoOrient → 完全不轉。
    if (buffer?.length) {
        try {
            if (hasForceRotate) {
                const deg = ((forceRotateDeg % 360) + 360) % 360;
                buffer = await require("sharp")(buffer).rotate(deg).jpeg({ quality: 85 }).toBuffer();
                console.log("[parse-order-from-image] 人工指定旋轉 %d°", deg);
            }
            else if (!skipAutoOrient) {
                buffer = await require("./auto-orient-image.js").autoOrientImageBuffer(buffer);
            }
        }
        catch (_) { /* 轉正失敗沿用原圖 */ }
    }
    let ocrText = null;
    let ocrBoxes = null; // OCR 字框（幾何對行校驗用），同一次 Vision 呼叫一起拿
    if (buffer?.length && process.env.GOOGLE_CLOUD_VISION_API_KEY) {
        try {
            const ocrRes = await (0, vision_ocr_js_1.getTextAndWordBoxesFromImageBuffer)(buffer);
            ocrText = ocrRes?.text || null;
            ocrBoxes = ocrRes?.boxes || null;
        }
        catch (_) {
            ocrText = null;
            ocrBoxes = null;
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
    // 此客戶歷史品名小抄：Gemini 視覺與 Claude 第二意見共用，故提升到外層宣告。
    let historyItems = [];
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
            // A4 合理性檢查：避免視覺幻想品項或暴增數量直接覆蓋乾淨的 OCR 結果
            const adopt = shouldAdoptVisionResult(parsed, visionParsed);
            if (adopt.ok) {
                console.log("[parse-order-from-image] 採用 Gemini 視覺（OCR=%s 視覺=%s，原因=%s）", parsed.length, visionParsed.length, adopt.reason);
                parsed = visionParsed;
                // 幾何對行校驗：預印表＋有字框才會動作，錯列改名、跨列標記（例外不阻斷）
                parsed = applyRowAnchorGeometryCheck(parsed, ocrBoxes, template, "Gemini視覺");
            } else if (visionParsed.length > 0) {
                console.warn("[parse-order-from-image] 視覺結果未通過合理性檢查，沿用 OCR/文字結果（OCR=%s 視覺=%s，理由=%s）", parsed.length, visionParsed.length, adopt.reason);
            }
        }
    }
    // === 雙模型保險（opt-in）===
    // Gemini／文字結果信心偏低時，再請 Claude vision 出第二意見。最難的潦草手寫常是 Gemini 信心最低的那批。
    // 預設關閉；需 LINE_CLAUDE_FALLBACK=1 且設定 ANTHROPIC_API_KEY 才會啟用。只在低信心時呼叫，避免每張都加錢。
    if (buffer?.length && process.env.LINE_CLAUDE_FALLBACK === "1") {
        try {
            const claudeMod = require("./claude-vision-parse.js");
            const claudeKey = claudeMod.getClaudeApiKey();
            if (claudeKey && shouldTryClaudeFallback(parsed)) {
                // 若稍早未載入歷史小抄（例如文字結果夠強而略過 Gemini 視覺），這裡補載一次給 Claude。
                if ((!historyItems || historyItems.length === 0) && options?.db && options?.customerId) {
                    try {
                        historyItems = await order_history_items_js_1.loadDistinctOrderItemNamesForCustomer(options.db, options.customerId, options.subClientId ?? options.sub_client_id);
                    }
                    catch (_) { /* ignore */ }
                }
                const cOpts = { callKind: "vision_claude_fallback", historyItems: historyItems || [] };
                if (options?.db && options?.customerId) {
                    cOpts.db = options.db;
                    cOpts.customerId = options.customerId;
                }
                if (knownSub)
                    cOpts.knownSubCustomers = knownSub;
                const cModel = process.env.CLAUDE_VISION_MODEL && String(process.env.CLAUDE_VISION_MODEL).trim();
                if (cModel)
                    cOpts.modelName = cModel;
                console.log("[parse-order-from-image] 信心偏低（%d 筆）→ 呼叫 Claude vision 第二意見", parsed.length);
                const claudeRows = await claudeMod.parseOrderVisionWithClaude(buffer, cOpts);
                if (claudeRows && claudeRows.length) {
                    let claudeParsed = claudeRows.map((p) => ({
                        rawName: p.rawName,
                        quantity: (0, gemini_order_helpers_js_1.coerceQuantityFromGemini)(p.quantity),
                        unit: (0, gemini_order_helpers_js_1.coerceUnitFromGemini)(p.unit) || "公斤",
                        remark: p.remark ?? null,
                        subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                        confidenceScore: p.confidenceScore != null ? p.confidenceScore : null,
                    }));
                    claudeParsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(claudeParsed);
                    // 沿用與 Gemini 視覺相同的 A4 合理性檢查：Claude 漏看（筆數變少）或疑似幻想品項時不採用，維持原結果。
                    const adopt = shouldAdoptVisionResult(parsed, claudeParsed);
                    if (adopt.ok) {
                        console.log("[parse-order-from-image] 採用 Claude 第二意見（原=%d Claude=%d，原因=%s）", parsed.length, claudeParsed.length, adopt.reason);
                        parsed = claudeParsed;
                        // Claude 結果同樣過一次幾何對行校驗
                        parsed = applyRowAnchorGeometryCheck(parsed, ocrBoxes, template, "Claude第二意見");
                    }
                    else {
                        console.warn("[parse-order-from-image] Claude 第二意見未通過合理性檢查，維持原結果（原=%d Claude=%d，理由=%s）", parsed.length, claudeParsed.length, adopt.reason);
                    }
                }
            }
        }
        catch (e) {
            console.warn("[parse-order-from-image] Claude fallback 失敗（不阻斷）:", e?.message || e);
        }
    }
    parsed = (0, order_parsed_heuristics_js_1.dedupeParsedOrderRows)(parsed);
    // 訂單 raw_message 保留完整 OCR，解析仍用 parseText（版型清洗後）
    const result = { parsed, ocrText: ocrText || parseText || null };
    // 只有真的解析到品項才快取；空結果（API 失敗、DB 失敗、429、配額用盡等）不快取，
    // 避免下次按「重新辨識」一直命中壞快取拿不到東西。
    if (cacheKey && Array.isArray(parsed) && parsed.length > 0)
        cacheSet(cacheKey, result);
    return result;
}
