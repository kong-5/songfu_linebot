"use strict";
// 子客戶拆單的判定與分組 helper（自 webhook/line.js 拆出，拆檔批次 9；純函式）。
// 拆單資格只認客戶主檔 known_sub_customers —— 呼叫端負責在解析階段清空未設定客戶的 subCustomer，
// 本檔只做「已解析結果 → 要不要拆、怎麼分組」的判斷。
Object.defineProperty(exports, "__esModule", { value: true });

/** Gemini 品項依 sub_customer 分組；空字串／null／undefined 視為預設主客戶 */
function subCustomerGroupKeyFromParsedItem(item) {
    const sc = item.subCustomer;
    if (sc == null || String(sc).trim() === "")
        return "";
    return String(sc).trim();
}
function mustSplitOrdersBySubCustomer(parsed) {
    if (!parsed?.length)
        return false;
    const keys = new Set(parsed.map(subCustomerGroupKeyFromParsedItem));
    // [fix 2026-07-10] 只要出現任一「非空」子客戶就分流。舊條件 keys.size > 1 會漏掉
    // 「整則訊息都是同一家子客戶」的情況（共用群組單獨幫某分店叫貨，如養鍋），
    // 品項全掉進主客戶單。subCustomer 只有客戶主檔設定 known_sub_customers 時才會有值
    // （解析入口已把未設定客戶的 subCustomer 清空），不會影響未設定的客戶。
    if (keys.size > 1)
        return true;
    return keys.size === 1 && !keys.has("");
}
function groupParsedItemsBySubCustomer(parsed) {
    const map = new Map();
    for (const item of parsed) {
        const k = subCustomerGroupKeyFromParsedItem(item);
        if (!map.has(k))
            map.set(k, []);
        map.get(k).push(item);
    }
    return map;
}
function mergeSessionOrderIds(session, newIds) {
    const set = new Set();
    if (Array.isArray(session.allOrderIds))
        for (const x of session.allOrderIds)
            if (x)
                set.add(x);
    if (session.orderId)
        set.add(session.orderId);
    for (const id of newIds || [])
        if (id)
            set.add(id);
    session.allOrderIds = Array.from(set);
    if (session.allOrderIds.length && !session.orderId)
        session.orderId = session.allOrderIds[0];
}
function formatSplitSubNamesForReply(keySet) {
    const arr = [...keySet].sort((a, b) => {
        if (a === "")
            return -1;
        if (b === "")
            return 1;
        return a.localeCompare(b, "zh-Hant");
    });
    return arr.map((k) => (k === "" ? "主客戶" : k)).join("、");
}
exports.subCustomerGroupKeyFromParsedItem = subCustomerGroupKeyFromParsedItem;
exports.mustSplitOrdersBySubCustomer = mustSplitOrdersBySubCustomer;
exports.groupParsedItemsBySubCustomer = groupParsedItemsBySubCustomer;
exports.mergeSessionOrderIds = mergeSessionOrderIds;
exports.formatSplitSubNamesForReply = formatSplitSubNamesForReply;
