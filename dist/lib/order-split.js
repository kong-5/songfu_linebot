"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markSameDayMainOrdersAsSplitBase = markSameDayMainOrdersAsSplitBase;
exports.findSplitTargetOrderId = findSplitTargetOrderId;
exports.isSplitKeyUniqueConflict = isSplitKeyUniqueConflict;
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
/**
 * [refactor 2026-07-14] 拆單「找目標單」的唯一實作——line.js 與後台共用，
 * 消除兩份實作的漂移（後台舊版 ORDER BY id、line ORDER BY order_no，同日多張時挑到不同單）。
 * subKey ''＝主客戶桶（連同 NULL 舊主單一併視為同桶）；其餘精確比對（寫入端已 trim）。
 * 回傳 orderId 或 null。
 */
async function findSplitTargetOrderId(db, customerId, orderDate, subKey) {
    if (subKey === "") {
        const row = await db.prepare(
            "SELECT id FROM orders WHERE customer_id = ? AND order_date = ?" +
            " AND (order_sub_split_key IS NULL OR TRIM(COALESCE(order_sub_split_key,'')) = '')" +
            " AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no LIMIT 1"
        ).get(customerId, orderDate);
        return row?.id ?? null;
    }
    const row = await db.prepare(
        "SELECT id FROM orders WHERE customer_id = ? AND order_date = ?" +
        " AND TRIM(COALESCE(order_sub_split_key,'')) = ?" +
        " AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no LIMIT 1"
    ).get(customerId, orderDate, subKey);
    return row?.id ?? null;
}
/**
 * 拆單唯一索引（ux_orders_split_key_day）衝突判斷：
 * pg 錯誤訊息帶索引名；better-sqlite3 只帶欄位清單（含 order_sub_split_key）。
 * 撞到＝並發下別的 worker 剛建了同 key 單，呼叫端應改重查重用。
 */
function isSplitKeyUniqueConflict(e) {
    const msg = String(e?.message || e || "");
    return /ux_orders_split_key_day/i.test(msg)
        || /UNIQUE constraint failed:.*order_sub_split_key/i.test(msg);
}
