"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markSameDayMainOrdersAsSplitBase = markSameDayMainOrdersAsSplitBase;
/**
 * [fix 2026-07-10 / 抽共用 2026-07-14] 拆單時把同客戶同日的「未拆單」主訂單
 * （order_sub_split_key IS NULL）標成主客戶桶（''）。
 * rebuild 的過濾語意是 NULL＝全部品項、''＝只留 subCustomer 空的品項；一旦當日出現子客戶拆單，
 * 若主訂單仍為 NULL，結單整單重辨識會把子客戶品項也重建進主訂單 → 與子單重複出貨。
 * LINE 收單（webhook/line.js）與後台拆單（admin 的 move-items / split-by-sub-customer）都必須呼叫。
 * @param db 資料庫（可傳交易 handle）
 * @param nowSql 選填；未傳依 DATABASE_URL 自動選 CURRENT_TIMESTAMP / datetime('now')
 */
async function markSameDayMainOrdersAsSplitBase(db, customerId, orderDate, nowSql) {
    const now = nowSql || (process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')");
    await db.prepare(
        "UPDATE orders SET order_sub_split_key = '', updated_at = " + now +
        " WHERE customer_id = ? AND order_date = ? AND order_sub_split_key IS NULL" +
        " AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint')"
    ).run(customerId, orderDate);
}
