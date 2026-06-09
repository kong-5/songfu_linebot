"use strict";
/**
 * 收單 session 的耐久化存取（DB 版，取代純記憶體 Map）。
 * 目的：Cloud Run 閒置/回收/多實例時，結單仍可由 DB sweep 可靠觸發，避免掉單。
 * 全部以 group_id 為主鍵；order_ids 以 JSON 陣列存放。
 *
 * 設計原則：呼叫端對寫入採「最佳努力（best-effort）」並 try/catch 包覆，
 * 任何此處的失敗都不得讓收單主流程中斷。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertCollectingSession = upsertCollectingSession;
exports.touchCollectingSession = touchCollectingSession;
exports.getCollectingSession = getCollectingSession;
exports.listDueCollectingSessions = listDueCollectingSessions;
exports.claimCollectingSession = claimCollectingSession;
exports.deleteCollectingSession = deleteCollectingSession;

function normalizeOrderIds(orderIds) {
    const set = new Set();
    for (const x of Array.isArray(orderIds) ? orderIds : []) {
        if (x != null && String(x).trim() !== "")
            set.add(String(x));
    }
    return Array.from(set);
}

function rowToSession(row) {
    if (!row)
        return null;
    let orderIds = [];
    try {
        const arr = JSON.parse(row.order_ids_json || "[]");
        if (Array.isArray(arr))
            orderIds = arr.filter((x) => x != null && String(x).trim() !== "").map(String);
    }
    catch (_) { /* 壞 JSON 視為空 */ }
    return {
        groupId: row.group_id,
        customerId: row.customer_id,
        orderIds,
        lastActivityMs: Number(row.last_activity_ms) || 0,
        createdMs: Number(row.created_ms) || 0,
    };
}

/** 建立或更新 session（last_activity 一律更新；created_ms 僅首次寫入） */
async function upsertCollectingSession(db, { groupId, customerId, orderIds, nowMs }) {
    if (!groupId)
        return;
    const ids = normalizeOrderIds(orderIds);
    const ts = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    await db.prepare("INSERT INTO order_collecting_sessions (group_id, customer_id, order_ids_json, last_activity_ms, created_ms) " +
        "VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT(group_id) DO UPDATE SET " +
        "customer_id = excluded.customer_id, order_ids_json = excluded.order_ids_json, last_activity_ms = excluded.last_activity_ms")
        .run(groupId, customerId ?? "", JSON.stringify(ids), ts, ts);
}

/** 僅更新活動時間（收到新訊息時延長收單窗） */
async function touchCollectingSession(db, groupId, nowMs) {
    if (!groupId)
        return;
    const ts = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    await db.prepare("UPDATE order_collecting_sessions SET last_activity_ms = ? WHERE group_id = ?").run(ts, groupId);
}

async function getCollectingSession(db, groupId) {
    if (!groupId)
        return null;
    const row = await db.prepare("SELECT group_id, customer_id, order_ids_json, last_activity_ms, created_ms FROM order_collecting_sessions WHERE group_id = ?").get(groupId);
    return rowToSession(row);
}

/** 列出「最後活動時間 <= cutoffMs」的逾時 session（待結單） */
async function listDueCollectingSessions(db, cutoffMs) {
    const cut = Number.isFinite(Number(cutoffMs)) ? Number(cutoffMs) : Date.now();
    const rows = await db.prepare("SELECT group_id, customer_id, order_ids_json, last_activity_ms, created_ms FROM order_collecting_sessions WHERE last_activity_ms <= ? ORDER BY last_activity_ms ASC").all(cut);
    return (rows || []).map(rowToSession).filter(Boolean);
}

/**
 * 原子「認領」：刪除該 session 列，回傳是否由本次刪除成功（changes>0）。
 * 用於 in-process timer 與 DB sweep（甚至多實例）之間避免重複結單——只有認領成功者執行結單。
 */
async function claimCollectingSession(db, groupId) {
    if (!groupId)
        return false;
    const res = await db.prepare("DELETE FROM order_collecting_sessions WHERE group_id = ?").run(groupId);
    return Boolean(res && Number(res.changes) > 0);
}

async function deleteCollectingSession(db, groupId) {
    if (!groupId)
        return;
    await db.prepare("DELETE FROM order_collecting_sessions WHERE group_id = ?").run(groupId);
}
