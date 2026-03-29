"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOrderItemsFromImageBuffer = parseOrderItemsFromImageBuffer;
const parse_order_message_js_1 = require("./parse-order-message.js");
const vision_ocr_js_1 = require("./vision-ocr.js");
const gemini_order_helpers_js_1 = require("./gemini-order-helpers.js");
const order_parsed_heuristics_js_1 = require("./order-parsed-heuristics.js");
const order_form_templates_js_1 = require("./order-form-templates.js");
/** 圖片：OCR → 版型清洗 → Gemini 文字（整段）→ Gemini 視覺（手寫／雙欄）
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
    let parsed = parseText ? await (0, parse_order_message_js_1.parseOrderMessage)(parseText, fallbackUnit, geminiTextOpts) : [];
    parsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(parsed);
    const geminiKey = (0, gemini_order_helpers_js_1.getGeminiApiKey)();
    /**
     * 只要有圖 + Gemini 金鑰就**一律**再跑視覺模型比對筆數。
     * 雙欄手寫時 OCR+文字模型常已得到「看起來夠多」的筆數，但仍可能遠少於紙上實際條目；視覺模型可補齊。
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
