"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// 系統告警中樞（ops-notify）：後端偵測到「需要人看一眼」的異常時，推播到指定 LINE 群組。
// - 告警群組 ID 存 app_settings key `ops_alert_group_id`（LINE 群組 ID）；未設定時 console.warn 一次後靜默 no-op。
// - 推播方式沿用 repo 既有做法（見 dist/lib/daily-summary-push.js）：直接打 LINE Messaging API push，
//   用 LINE_CHANNEL_ACCESS_TOKEN，不經 @line/bot-sdk（admin 端本來就沒載 sdk client）。
// - 內建同訊息 10 分鐘去重（in-memory Map），避免重啟風暴／迴圈錯誤瘋狂轟炸群組。
// 觸發點（都在 dist/admin/index.js）：訂單回寫三振出局、callback 單號衝突、inventory-push/report 錯誤。

exports.notifyOps = notifyOps;

const DEDUPE_MS = 10 * 60 * 1000; // 同一訊息 10 分鐘內只發一次
const recentSent = new Map();     // message -> 上次發送時間（ms）
let warnedNoGroup = false;        // 未設定群組時只 warn 一次，避免洗版 log

/** 去重 Map 清理：超過去重視窗的舊項目移除，避免長期執行無限成長。 */
function pruneRecent(now) {
    for (const [msg, t] of recentSent) {
        if (now - t > DEDUPE_MS) recentSent.delete(msg);
    }
}

/**
 * 推播系統告警到 ops 群組。永不 throw（告警失敗不可影響主流程），呼叫端可 fire-and-forget。
 * @param {*} db  資料庫 handle（dist/db/index.js 的 prepare/get 介面）
 * @param {string} message  告警內容（會自動加上「⚠ 系統告警：」前綴）
 * @returns {Promise<{ok:boolean, skipped?:string}>}
 */
async function notifyOps(db, message) {
    try {
        const msg = String(message || "").trim();
        if (!msg) return { ok: false, skipped: "empty" };
        const now = Date.now();
        // 同訊息 10 分鐘去重
        const last = recentSent.get(msg);
        if (last != null && now - last < DEDUPE_MS) return { ok: true, skipped: "dedupe" };
        pruneRecent(now);

        // 讀告警群組 ID（app_settings.ops_alert_group_id）
        let groupId = "";
        try {
            const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("ops_alert_group_id");
            groupId = row && row.value ? String(row.value).trim() : "";
        } catch (_) { /* 查詢失敗視同未設定 */ }
        if (!groupId) {
            if (!warnedNoGroup) {
                console.warn("[ops-notify] app_settings.ops_alert_group_id 未設定，系統告警只記 log 不推播：", msg.slice(0, 200));
                warnedNoGroup = true;
            }
            recentSent.set(msg, now); // 未設定也記去重，避免同錯誤反覆走到這裡
            return { ok: false, skipped: "no_group" };
        }

        const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
        if (!token) {
            console.warn("[ops-notify] LINE_CHANNEL_ACCESS_TOKEN 未設定，無法推播告警：", msg.slice(0, 200));
            recentSent.set(msg, now);
            return { ok: false, skipped: "no_token" };
        }

        // 先記去重再發送：就算 LINE API 失敗也不會在 10 分鐘內狂重試
        recentSent.set(msg, now);
        const resp = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                to: groupId,
                messages: [{ type: "text", text: `⚠ 系統告警：${msg}`.slice(0, 4900) }],
            }),
        });
        if (!resp.ok) {
            const t = await resp.text().catch(() => "");
            console.error("[ops-notify] LINE push 失敗", resp.status, t.slice(0, 200));
            return { ok: false, skipped: "push_failed" };
        }
        return { ok: true };
    } catch (e) {
        console.error("[ops-notify] notifyOps 例外：", e?.message || e);
        return { ok: false, skipped: "exception" };
    }
}
