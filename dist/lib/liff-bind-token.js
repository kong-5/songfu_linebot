"use strict";
/**
 * 員工 LIFF 綁定的一次性連結 token（與舊有 6 位數綁定碼並存）。
 * 存於 app_settings：key = liff_bind_token_<token>，value = JSON({ username, expiresAt })
 * TTL：30 分鐘
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueLiffBindToken = issueLiffBindToken;
exports.lookupLiffBindToken = lookupLiffBindToken;
exports.consumeLiffBindToken = consumeLiffBindToken;

const TOKEN_TTL_MS = 30 * 60 * 1000;
const KEY_PREFIX = "liff_bind_token_";

function randToken() {
    // 32 hex 字元（128bit）
    let s = "";
    const arr = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
    } else {
        for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
    return s;
}

async function issueLiffBindToken(db, username) {
    const u = String(username || "").trim();
    if (!u) throw new Error("username required");
    // 清掉同 username 既有未過期的（避免堆積；新連結會覆寫舊連結）
    try {
        const rows = await db.prepare("SELECT key, value FROM app_settings WHERE key LIKE ?").all(KEY_PREFIX + "%");
        for (const r of rows || []) {
            try {
                const p = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
                if (p && p.username === u) {
                    await db.prepare("DELETE FROM app_settings WHERE key = ?").run(r.key);
                }
            } catch (_) { /* ignore */ }
        }
    } catch (_) { /* ignore */ }
    for (let i = 0; i < 5; i++) {
        const token = randToken();
        const k = KEY_PREFIX + token;
        const exists = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k);
        if (exists) continue;
        const expiresAt = Date.now() + TOKEN_TTL_MS;
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(k, JSON.stringify({ username: u, expiresAt }));
        return { token, expiresAt };
    }
    throw new Error("無法產生綁定 token");
}

async function lookupLiffBindToken(db, token) {
    const t = String(token || "").trim();
    if (!t) return null;
    const k = KEY_PREFIX + t;
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k);
    if (!row?.value) return null;
    try {
        const p = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        if (!p || !p.username || !p.expiresAt) return null;
        if (Number(p.expiresAt) < Date.now()) return null;
        return p;
    } catch (_) {
        return null;
    }
}

async function consumeLiffBindToken(db, token) {
    const p = await lookupLiffBindToken(db, token);
    if (!p) return null;
    try { await db.prepare("DELETE FROM app_settings WHERE key = ?").run(KEY_PREFIX + String(token).trim()); } catch (_) {}
    return p;
}
