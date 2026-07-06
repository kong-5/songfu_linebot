"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertGroupSpeaker = upsertGroupSpeaker;
exports.logConversation = logConversation;
exports.getConversationForOrder = getConversationForOrder;
exports.listGroupSpeakers = listGroupSpeakers;
const id_js_1 = require("./id.js");

/** LINE 顯示名稱行程內快取：groupId|userId -> displayName，避免每則訊息都打 profile API */
const profileNameCache = new Map();

/**
 * 記錄／累加群組發言者，回傳顯示名稱（拿得到的話）。
 * 名稱來源優先序：呼叫端已知（員工姓名）→ 行程快取 → DB 既有 → LINE getGroupMemberProfile。
 * 後台「群組發言成員」名單靠這張表，讓管理者從有講過話的人裡挑同事。
 */
async function upsertGroupSpeaker(db, lineClient, groupId, lineUserId, knownName) {
    if (!db || !groupId || !lineUserId) return knownName || null;
    let name = (knownName && String(knownName).trim()) || null;
    const ck = groupId + "|" + lineUserId;
    if (!name) name = profileNameCache.get(ck) || null;
    if (!name) {
        try {
            const r = await db.prepare("SELECT display_name FROM line_group_speakers WHERE group_id = ? AND line_user_id = ?").get(groupId, lineUserId);
            if (r?.display_name) name = r.display_name;
        } catch (_) { /* 讀不到不阻擋 */ }
    }
    if (!name && lineClient) {
        try {
            const p = await lineClient.getGroupMemberProfile(groupId, lineUserId);
            if (p?.displayName) name = p.displayName;
        } catch (_) { /* 1:1 聊天或已退群取不到，之後有機會再補 */ }
    }
    if (name) profileNameCache.set(ck, name);
    try {
        await db.prepare(`
      INSERT INTO line_group_speakers (group_id, line_user_id, display_name, message_count, first_spoke_at, last_spoke_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
      ON CONFLICT (group_id, line_user_id) DO UPDATE SET
        message_count = line_group_speakers.message_count + 1,
        last_spoke_at = datetime('now'),
        display_name = COALESCE(excluded.display_name, line_group_speakers.display_name)
    `).run(groupId, lineUserId, name);
    } catch (e) {
        console.warn("[convo] 發言者 upsert 失敗:", e?.message || e);
    }
    return name;
}

/**
 * 寫一筆對話紀錄；orderIds 有多筆（拆單收單 session）就每張訂單各記一筆，
 * 讓每張訂單審核頁都看得到完整對話。orderIds 為空時記成群組層級（order_id NULL）。
 */
async function logConversation(db, opts) {
    if (!db || !opts) return;
    const { groupId, customerId, orderIds, senderKind, senderLineUserId, senderName, msgType, text } = opts;
    const body = String(text || "").slice(0, 2000);
    if (!body.trim()) return;
    const ids = (orderIds && orderIds.length) ? [...new Set(orderIds)] : [null];
    for (const oid of ids) {
        try {
            const id = (0, id_js_1.newId)("convo");
            await db.prepare(`
        INSERT INTO line_conversation_log (id, group_id, customer_id, order_id, sender_kind, sender_line_user_id, sender_name, msg_type, text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, groupId || null, customerId || null, oid, String(senderKind || "customer"), senderLineUserId || null, senderName || null, msgType || "text", body);
        } catch (e) {
            console.warn("[convo] 對話寫入失敗:", e?.message || e);
        }
    }
}

/** 訂單審核頁用：取該訂單的對話（時間序） */
async function getConversationForOrder(db, orderId) {
    if (!db || !orderId) return [];
    try {
        return await db.prepare(`
      SELECT sender_kind, sender_name, msg_type, text, created_at
      FROM line_conversation_log WHERE order_id = ? ORDER BY created_at, id
    `).all(orderId);
    } catch (_) {
        return [];
    }
}

/** 後台「群組發言成員」名單：帶出所屬客戶群名稱，最近發言在前（含 dismissed_at，由呼叫端分區顯示） */
async function listGroupSpeakers(db, limit = 200) {
    if (!db) return [];
    try {
        return await db.prepare(`
      SELECT s.group_id, s.line_user_id, s.display_name, s.message_count, s.first_spoke_at, s.last_spoke_at, s.dismissed_at,
             c.name AS customer_name
      FROM line_group_speakers s
      LEFT JOIN customers c ON TRIM(COALESCE(c.line_group_id, '')) = s.group_id
      ORDER BY s.last_spoke_at DESC
      LIMIT ${Math.max(1, Math.min(500, Number(limit) || 200))}
    `).all();
    } catch (_) {
        return [];
    }
}

/**
 * 把某 LINE 帳號標記為「非公司人員」（或恢復）。以 line_user_id 為單位、
 * 跨群組一次處理——判定過一次就不再佔用名單空間。可隨時從「已處理」區恢復。
 */
async function setSpeakerDismissed(db, lineUserId, dismissed) {
    if (!db || !lineUserId) return false;
    try {
        const r = dismissed
            ? await db.prepare("UPDATE line_group_speakers SET dismissed_at = datetime('now') WHERE line_user_id = ?").run(lineUserId)
            : await db.prepare("UPDATE line_group_speakers SET dismissed_at = NULL WHERE line_user_id = ?").run(lineUserId);
        return (r?.changes ?? 0) > 0;
    } catch (e) {
        console.warn("[convo] 發言者排除標記失敗:", e?.message || e);
        return false;
    }
}
exports.setSpeakerDismissed = setSpeakerDismissed;
