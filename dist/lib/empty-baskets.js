"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertEmptyBaskets = insertEmptyBaskets;
const id_js_1 = require("./id.js");
/**
 * 依客戶路線把空籃（號碼籃 + 四角籃）補進指定訂單。
 * 呼叫端：LINE 收單（手動/30 秒自動）、後台手動拆併單、依子客戶拆單——
 * 拆出去的子訂單是獨立一趟配送，空籃要各自重新記錄。
 * 已存在同 product_id 的品項就跳過，重複呼叫不會長出重複列（冪等）。
 * @param {*} db
 * @param {string} customerId
 * @param {string[]} orderIds
 */
async function insertEmptyBaskets(db, customerId, orderIds) {
    if (!db || !customerId || !orderIds || !orderIds.length) return;
    try {
        const cust = await db.prepare("SELECT route_line FROM customers WHERE id = ?").get(customerId);
        const routeLine = cust?.route_line >= 1 && cust?.route_line <= 9 ? cust.route_line : null;
        // 沒設路線＝自取，不補任何空籃（含固定四角籃 C0100065）
        if (routeLine == null) return;
        // [fix 2026-07-08] 恢復 3b44ca8 的查表修正（本 lib 出自平行開發、把舊 56+路線 連號公式帶了回來）：
        // 號碼籃料號跳過 4 號（無 4 號籃）：C0100057=1號…C0100059=3號、C0100060=5號…C0100064=9號；
        // 不可用 56+路線號 連號計算，會從 5 號線起全部對錯、9 號線算到四角籃 C0100065。
        // 此 lib 是 webhook 收單與後台拆單/重新辨識共用的唯一空籃來源，改這裡即全站生效。
        const EMPTY_BASKET_ERP_BY_ROUTE = { 1: "C0100057", 2: "C0100058", 3: "C0100059", 5: "C0100060", 6: "C0100061", 7: "C0100062", 8: "C0100063", 9: "C0100064" };
        const emptyBasketErp = EMPTY_BASKET_ERP_BY_ROUTE[routeLine] || null; // 路線 4 無號碼籃，只補四角籃
        // 要補的空籃料號：路線號碼籃（查表）＋ 固定四角籃 C0100065。
        const erps = [];
        if (emptyBasketErp) erps.push(emptyBasketErp);
        if (!erps.includes("C0100065")) erps.push("C0100065");
        for (const erp of erps) {
            const prod = await db.prepare("SELECT id, name, unit FROM products WHERE erp_code = ?").get(erp);
            if (!prod) continue;
            for (const oid of orderIds) {
                const exists = await db.prepare("SELECT 1 FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1").get(oid, prod.id);
                if (exists) continue;
                const itemId = (0, id_js_1.newId)("item");
                await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export, sub_customer) VALUES (?, ?, ?, ?, 0, ?, 0, 1, NULL)").run(itemId, oid, prod.id, prod.name, prod.unit || "個");
            }
        }
    }
    catch (e) {
        console.error("[baskets] 補空籃失敗 customerId=%s:", customerId, e?.message || e);
    }
}
