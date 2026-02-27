"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOrderMessage = parseOrderMessage;
/**
 * 從叫貨訊息解析出品項與數量。
 * 規則範例：「大陸妹 5 斤」「高麗菜 2」「青江 3斤」「大白菜1」
 * 支援：品名 + 數字（半形或全形）+ 可選單位（斤、包、把、箱等）
 */
const UNIT_PATTERN = /(斤|公斤|包|把|箱|顆|粒|盒|袋|台)\s*$/i;
const NUMBER_PATTERN = /[\d.\uFF10-\uFF19]+/; // 半形 0-9. 與全形 ０-９
/** 全形數字轉半形，供 parseFloat 正確解析 */
function normalizeNumStr(s) {
    return s.replace(/[\uFF10-\uFF19]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));
}
function parseOrderMessage(text) {
    const lines = text
        .split(/\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const items = [];
    for (const line of lines) {
        const match = line.match(NUMBER_PATTERN);
        if (!match)
            continue;
        const numStr = match[0];
        const numIdx = line.indexOf(numStr);
        const quantity = parseFloat(normalizeNumStr(numStr));
        if (Number.isNaN(quantity) || quantity <= 0)
            continue;
        let before = line.slice(0, numIdx).trim();
        let after = line.slice(numIdx + numStr.length).trim();
        const unitMatch = after.match(UNIT_PATTERN);
        const unit = unitMatch ? unitMatch[1] ?? null : (after || null);
        if (unitMatch) {
            after = after.slice(0, -((unitMatch[0]?.length) ?? 0)).trim();
        }
        const rawName = (before + " " + after).trim() || before;
        if (!rawName)
            continue;
        items.push({
            rawName,
            quantity,
            unit: unit || null,
        });
    }
    return items;
}
