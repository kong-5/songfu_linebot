"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preprocessOcrTextByTemplate = preprocessOcrTextByTemplate;
exports.detectOrderFormTemplate = detectOrderFormTemplate;
/**
 * 多客戶可擴充的表單模板層：
 * - 偵測 OCR 文字是否符合特定版型
 * - 先做版型專屬清洗，再交給 parseOrderMessage / Gemini
 * 新客戶模板只需在 TEMPLATE_DEFS 增加一筆，不改核心流程。
 */
const TEMPLATE_DEFS = [
    {
        id: "produce_order_sheet_v1",
        name: "蔬果固定表單 v1",
        // 關鍵字取「表頭結構」而非客戶名稱，避免同版型不同客戶時失效
        markers: ["訂購日期", "送達日期", "品項", "數量"],
        stripLine: (line) => {
            const t = String(line || "").trim();
            if (!t)
                return true;
            if (/電話|傳真|FAX|TEL|有限公司|統編|地址|住址/.test(t))
                return true;
            if (/^客戶\s*[:：]?$/.test(t))
                return true;
            // 單獨抬頭欄位
            if (/^(訂購日期|送達日期)\s*[:：]?$/.test(t))
                return true;
            return false;
        },
    },
];
function detectOrderFormTemplate(ocrText) {
    const text = String(ocrText || "");
    if (!text)
        return null;
    for (const def of TEMPLATE_DEFS) {
        const hit = def.markers.filter((m) => text.includes(m)).length;
        if (hit >= Math.max(2, Math.ceil(def.markers.length * 0.6))) {
            return def;
        }
    }
    return null;
}
function preprocessOcrTextByTemplate(ocrText, template) {
    const raw = String(ocrText || "");
    if (!raw || !template)
        return raw;
    const lines = raw.split(/\r?\n/).map((x) => x.trim());
    // 嘗試從第一個「品項」表頭開始，只留表格主體
    let startIdx = lines.findIndex((l) => /品項/.test(l) && /數量/.test(l));
    if (startIdx < 0)
        startIdx = lines.findIndex((l) => /品項/.test(l));
    const scoped = startIdx >= 0 ? lines.slice(startIdx) : lines;
    const kept = scoped.filter((line) => !template.stripLine(line));
    return kept.join("\n").trim();
}
