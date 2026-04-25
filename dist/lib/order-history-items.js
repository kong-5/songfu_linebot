"use strict";
/**
 * 依客戶／子客戶歷史訂單明細，組出「品項小抄」供 Gemini 圖像辨識 Dynamic Option Prompting。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDistinctOrderItemNamesForCustomer = loadDistinctOrderItemNamesForCustomer;
/**
 * 從 order_items 撈取曾出現過的獨特品名（優先 products.name，否則 raw_name）。
 * @param subClientId 若有值，只統計 sub_customer 與其一致之明細；否則含該客戶下所有子客戶。
 */
async function loadDistinctOrderItemNamesForCustomer(db, customerId, subClientId) {
    if (!db || !customerId)
        return [];
    const cid = String(customerId).trim();
    if (!cid)
        return [];
    const sub = subClientId != null && String(subClientId).trim() !== ""
        ? String(subClientId).trim()
        : null;
    const nameExpr = `TRIM(CASE WHEN p.name IS NOT NULL AND TRIM(p.name) != '' THEN p.name ELSE COALESCE(oi.raw_name, '') END)`;
    let sql;
    let params;
    if (sub) {
        sql = `SELECT DISTINCT ${nameExpr} AS item_name
      FROM order_items oi
      INNER JOIN orders ord ON ord.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE ord.customer_id = ?
        AND TRIM(COALESCE(oi.sub_customer, '')) = ?
        AND LENGTH(${nameExpr}) > 0
      ORDER BY item_name
      LIMIT 500`;
        params = [cid, sub];
    }
    else {
        sql = `SELECT DISTINCT ${nameExpr} AS item_name
      FROM order_items oi
      INNER JOIN orders ord ON ord.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE ord.customer_id = ?
        AND LENGTH(${nameExpr}) > 0
      ORDER BY item_name
      LIMIT 500`;
        params = [cid];
    }
    const rows = await db.prepare(sql).all(...params);
    const out = [];
    const seen = new Set();
    for (const r of rows || []) {
        const n = r?.item_name != null ? String(r.item_name).trim() : "";
        if (!n || seen.has(n))
            continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}
