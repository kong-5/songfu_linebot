"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOrderItemsFromImageBuffer = parseOrderItemsFromImageBuffer;
const parse_order_message_js_1 = require("./parse-order-message.js");
const vision_ocr_js_1 = require("./vision-ocr.js");
const gemini_order_helpers_js_1 = require("./gemini-order-helpers.js");
const order_parsed_heuristics_js_1 = require("./order-parsed-heuristics.js");
const order_form_templates_js_1 = require("./order-form-templates.js");
/** OCR 段落行數（非空行），用於判斷「正文很多行卻只拆出極少品項」→ 應改走 Gemini 文字 */
function countOcrNonEmptyLines(text) {
    return String(text || "")
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .length;
}
/** 圖片：OCR → 規則解析 → Gemini 文字 → Gemini 視覺（手寫／雙欄）
 * @param options.geminiExtraSuffix 可選，客戶筆跡對照等，併入 Gemini 文字／視覺提示
 * @param options.db 可選，搭配 options.customerId 載入該客戶 Few-Shot 範例
 * @param options.customerId 可選
 */
async function parseOrderItemsFromImageBuffer(buffer, fallbackUnit, options) {
    const geminiExtraSuffix = (options && typeof options.geminiExtraSuffix === "string" && options.geminiExtraSuffix.trim())
        ? options.geminiExtraSuffix.trim()
        : "";
    const geminiTextOpts = geminiExtraSuffix ? { extraPromptSuffix: geminiExtraSuffix } : undefined;
    let ocrText = null;
    if (buffer?.length && process.env.GOOGLE_CLOUD_VISION_API_KEY) {
        try {
            ocrText = await (0, vision_ocr_js_1.getTextFromImageBuffer)(buffer);
        }
        catch (_) {
            ocrText = null;
        }
    }
    const template = (0, order_form_templates_js_1.detectOrderFormTemplate)(ocrText);
    const parseText = template
        ? (0, order_form_templates_js_1.preprocessOcrTextByTemplate)(ocrText, template)
        : (ocrText || "");
    if (template) {
        console.log("[parse-order-from-image] matched template=%s", template.id);
    }
    let parsed = parseText ? (0, parse_order_message_js_1.parseOrderMessage)(parseText, fallbackUnit) : [];
    parsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(parsed);
    const ocrLineCount = countOcrNonEmptyLines(parseText);
    const geminiKey = (0, gemini_order_helpers_js_1.getGeminiApiKey)();
    /** OCR 看起來像長清單，規則卻只得到 0～2 筆：多為手寫被誤切或條碼雜訊 */
    let ocrSparseVersusLines = Boolean(parseText && ocrLineCount >= 8 && parsed.length <= 2);
    if (!parsed.length && parseText && geminiKey) {
        const rows = await (0, gemini_order_helpers_js_1.parseOrderWithGeminiText)(parseText, geminiTextOpts);
        if (rows && rows.length) {
            parsed = rows.map((p) => ({
                rawName: p.rawName,
                quantity: (0, gemini_order_helpers_js_1.coerceQuantityFromGemini)(p.quantity),
                unit: (0, gemini_order_helpers_js_1.coerceUnitFromGemini)(p.unit) || "公斤",
                remark: p.remark ?? null,
            }));
            parsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(parsed);
        }
    }
    // 規則已產出極少筆但 OCR 行數多：用整段 OCR 請 Gemini 文字重解
    if (ocrSparseVersusLines && parsed.length > 0 && parsed.length <= 2 && parseText && geminiKey) {
        const rows = await (0, gemini_order_helpers_js_1.parseOrderWithGeminiText)(parseText, geminiTextOpts);
        if (rows && rows.length) {
            let gParsed = rows.map((p) => ({
                rawName: p.rawName,
                quantity: (0, gemini_order_helpers_js_1.coerceQuantityFromGemini)(p.quantity),
                unit: (0, gemini_order_helpers_js_1.coerceUnitFromGemini)(p.unit) || "公斤",
                remark: p.remark ?? null,
            }));
            gParsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(gParsed);
            if (gParsed.length > parsed.length) {
                console.log("[parse-order-from-image] 採用 Gemini 文字（OCR 非空行=%s 規則筆數=%s → %s）", ocrLineCount, parsed.length, gParsed.length);
                parsed = gParsed;
            }
        }
    }
    /**
     * 只要有圖 + Gemini 金鑰就**一律**再跑視覺模型比對筆數。
     * 雙欄手寫時 OCR+規則常已得到「看起來夠多」的筆數，但仍遠少於紙上實際條目；舊邏輯只在筆數≤2 才讀圖，會永遠不補齊。
     */
    if (buffer?.length && geminiKey) {
        const oc = ocrText || parseText || "";
        const lungangLike = /龍港/.test(oc) && /品名/.test(oc) && /數量/.test(oc);
        const lungangSuffix = "（本圖 OCR 含「龍港／品名／數量」）此頁極可能為**多欄印刷品名＋手寫數量**；請再確認依**左欄→中欄→右欄**直向逐列讀取，且手寫「kg」類必拆成數量與單位，勿產生萬位以上離譜數字。";
        const visionParts = [];
        if (lungangLike)
            visionParts.push(lungangSuffix);
        if (geminiExtraSuffix)
            visionParts.push(geminiExtraSuffix);
        const visionOpts = {};
        if (visionParts.length)
            visionOpts.extraPromptSuffix = visionParts.join("\n\n");
        if (options?.db && options?.customerId) {
            visionOpts.db = options.db;
            visionOpts.customerId = options.customerId;
        }
        const rows = await (0, gemini_order_helpers_js_1.parseOrderWithGeminiImage)(buffer, Object.keys(visionOpts).length ? visionOpts : undefined);
        if (rows && rows.length) {
            let visionParsed = rows.map((p) => ({
                rawName: p.rawName,
                quantity: (0, gemini_order_helpers_js_1.coerceQuantityFromGemini)(p.quantity),
                unit: (0, gemini_order_helpers_js_1.coerceUnitFromGemini)(p.unit) || "公斤",
                remark: p.remark ?? null,
            }));
            visionParsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(visionParsed);
            if (visionParsed.length > parsed.length) {
                console.log("[parse-order-from-image] 採用 Gemini 視覺（規則/OCR 筆數=%s 視覺筆數=%s）", parsed.length, visionParsed.length);
                parsed = visionParsed;
            }
            else if (!parsed.length && visionParsed.length) {
                console.log("[parse-order-from-image] Gemini 視覺解析 筆數=%s", visionParsed.length);
                parsed = visionParsed;
            }
        }
    }
    // 訂單 raw_message 保留完整 OCR，解析仍用 parseText（版型清洗後）
    return { parsed, ocrText: ocrText || parseText || null };
}
