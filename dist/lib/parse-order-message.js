"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOrderMessage = parseOrderMessage;
exports.splitItemNameRemarks = splitItemNameRemarks;
exports.mergeRemarks = mergeRemarks;
/**
 * 純文字叫貨改由 Gemini 結構化解析（見 gemini-order-helpers.js）。
 * 本檔保留品名括號／品質詞拆至備註等輔助函式，供 mapRowsToOrderItems 與後台使用。
 */
/** 品名內規格／品質用語（小朵、漂亮…）、尾端「挑直的」等挪到備註 */
const INLINE_REMARK_TOKENS = [
    "盡量漂亮",
    "要漂亮",
    "特小朵",
    "中小顆",
    "中大朵",
    "中小朵",
    "大朵",
    "小朵",
    "中朵",
    "大顆",
    "小顆",
    "中顆",
    "漂亮",
    "注意",
];
/**
 * 品名中（）、()、【】、〔〕等註記內文移入備註；與 splitInlineQualityRemark 合併使用。
 */
function splitBracketRemarksFromName(rawName) {
    let name = String(rawName || "").trim();
    const parts = [];
    const extract = (re) => {
        name = name.replace(re, (m) => {
            const inner = m.slice(1, -1).trim();
            if (inner)
                parts.push(inner);
            return " ";
        });
    };
    extract(/（[^）]*）/g);
    extract(/\([^)]*\)/g);
    extract(/【[^】]*】/g);
    extract(/〔[^〕]*〕/g);
    extract(/《[^》]*》/g);
    name = name.replace(/\s+/g, " ").replace(/[,，]+$/g, "").trim();
    const remark = parts.length ? parts.join("；") : null;
    return { rawName: name || String(rawName || "").trim(), remark };
}
/** 括號註記 + 品質用語（漂亮、挑直的…）一併處理 */
function splitItemNameRemarks(rawName) {
    const br = splitBracketRemarksFromName(rawName);
    const ql = splitInlineQualityRemark(br.rawName);
    return {
        rawName: ql.rawName,
        remark: mergeRemarks(br.remark, ql.remark),
    };
}
function splitInlineQualityRemark(rawName) {
    const original = String(rawName || "").trim();
    let name = original;
    const parts = [];
    const pickStraight = name.match(/^(.*?)(挑直的)\s*$/);
    if (pickStraight) {
        name = pickStraight[1].trim();
        parts.push("挑直的");
    }
    let guard = 0;
    while (guard++ < 20) {
        let hit = false;
        for (const tok of INLINE_REMARK_TOKENS) {
            if (name.includes(tok)) {
                name = name.split(tok).join("").replace(/\s+/g, " ").replace(/[,，]+$/g, "").trim();
                if (!parts.includes(tok))
                    parts.push(tok);
                hit = true;
            }
        }
        if (!hit)
            break;
    }
    const remark = parts.length ? parts.join("；") : null;
    return { rawName: (name || original).trim() || original, remark };
}
function mergeRemarks(a, b) {
    const x = (a && String(a).trim()) || "";
    const y = (b && String(b).trim()) || "";
    if (!x)
        return y || null;
    if (!y)
        return x;
    if (x.includes(y) || y.includes(x))
        return x.length >= y.length ? x : y;
    return `${x}；${y}`;
}
/**
 * 以 Gemini 解析整段叫貨文字（須設定 GOOGLE_GEMINI_API_KEY 或 GEMINI_API_KEY）。
 * 無金鑰或解析失敗時回傳空陣列。
 */
async function parseOrderMessage(text, fallbackUnit, options) {
    const t = String(text || "").trim();
    if (!t)
        return [];
    const { getGeminiApiKey, parseOrderWithGeminiText, coerceQuantityFromGemini, coerceUnitFromGemini, } = require("./gemini-order-helpers.js");
    if (!getGeminiApiKey()) {
        console.warn("[parse-order-message] 未設定 GOOGLE_GEMINI_API_KEY／GEMINI_API_KEY，無法解析純文字叫貨");
        return [];
    }
    let geminiOpts = options ? { ...options } : undefined;
    if (geminiOpts?.db && geminiOpts?.customerId) {
        try {
            const cp = await require("./customer-profile.js").buildCustomerCheatSheetText(geminiOpts.db, geminiOpts.customerId);
            if (cp) {
                const base = geminiOpts.extraPromptSuffix ? String(geminiOpts.extraPromptSuffix).trim() : "";
                geminiOpts.extraPromptSuffix = [cp, base].filter(Boolean).join("\n\n");
            }
        }
        catch (_) { /* ignore */ }
    }
    const rows = await parseOrderWithGeminiText(t, geminiOpts);
    if (!rows || !rows.length)
        return [];
    const fb = (fallbackUnit && String(fallbackUnit).trim()) || "公斤";
    const { dedupeParsedOrderRows } = require("./order-parsed-heuristics.js");
    const mapped = rows.map((p) => {
        const q = coerceQuantityFromGemini(p.quantity);
        const u = coerceUnitFromGemini(p.unit) || fb;
        const remarkRaw = p.remark != null ? String(p.remark).trim() : "";
        const subRaw = p.subCustomer != null ? String(p.subCustomer).trim() : (p.sub_customer != null ? String(p.sub_customer).trim() : "");
        return {
            rawName: p.rawName,
            quantity: Number.isFinite(q) ? q : 0,
            unit: u,
            remark: remarkRaw !== "" ? remarkRaw : null,
            subCustomer: subRaw !== "" ? subRaw : null,
        };
    });
    return dedupeParsedOrderRows(mapped);
}
