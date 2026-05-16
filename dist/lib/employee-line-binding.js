"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBindCode = generateBindCode;
exports.lookupBindCode = lookupBindCode;
exports.consumeBindCode = consumeBindCode;
exports.bindLineUserIdToEmployee = bindLineUserIdToEmployee;
exports.unbindLineUserIdFromEmployee = unbindLineUserIdFromEmployee;
exports.findEmployeeByLineUserId = findEmployeeByLineUserId;
exports.parseBindCommand = parseBindCommand;
exports.listEmployeeBindings = listEmployeeBindings;

const CODE_TTL_MS = 10 * 60 * 1000; // 10 分鐘
const CODE_KEY_PREFIX = "line_bind_code_";

function randCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

/** 產生並儲存 6 位數綁定碼（10 分鐘過期）；同一 username 若已有未過期碼，沿用之。 */
async function generateBindCode(db, username) {
    const u = String(username || "").trim();
    if (!u) throw new Error("username required");
    const now = Date.now();
    // 看看是否已有現存可用碼
    try {
        const all = await db.prepare("SELECT key, value FROM app_settings WHERE key LIKE ?").all(CODE_KEY_PREFIX + "%");
        for (const r of (all || [])) {
            try {
                const payload = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
                if (payload && payload.username === u && Number(payload.expiresAt) > now) {
                    return { code: r.key.slice(CODE_KEY_PREFIX.length), expiresAt: payload.expiresAt };
                }
            } catch (_) { /* ignore */ }
        }
    } catch (_) { /* ignore */ }
    // 產生新碼，重試避免衝突
    for (let i = 0; i < 5; i++) {
        const code = randCode();
        const k = CODE_KEY_PREFIX + code;
        const existing = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k);
        if (existing) continue;
        const expiresAt = now + CODE_TTL_MS;
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(k, JSON.stringify({ username: u, expiresAt }));
        return { code, expiresAt };
    }
    throw new Error("無法產生綁定碼，請稍後再試");
}

async function lookupBindCode(db, code) {
    const k = CODE_KEY_PREFIX + String(code || "").trim();
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

async function consumeBindCode(db, code) {
    const k = CODE_KEY_PREFIX + String(code || "").trim();
    const p = await lookupBindCode(db, code);
    if (!p) return null;
    try { await db.prepare("DELETE FROM app_settings WHERE key = ?").run(k); } catch (_) { /* ignore */ }
    return p;
}

async function loadAdminUsersRaw(db) {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("admin_users");
    if (!row?.value) return [];
    try {
        const j = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
        return Array.isArray(j) ? j : [];
    } catch (_) {
        return [];
    }
}

async function saveAdminUsersRaw(db, users) {
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify(users));
}

/** 將指定 LINE userId 寫到指定 admin 帳號，並清掉其他帳號相同 userId（一個 userId 只能綁一人） */
async function bindLineUserIdToEmployee(db, username, lineUserId, lineUserName) {
    const u = String(username || "").trim();
    const lu = String(lineUserId || "").trim();
    if (!u || !lu) throw new Error("username and lineUserId required");
    const users = await loadAdminUsersRaw(db);
    let found = false;
    for (const x of users) {
        if (!x || typeof x !== "object") continue;
        if (String(x.username || "").trim() === u) {
            x.lineUserId = lu;
            if (lineUserName) x.lineUserName = String(lineUserName);
            x.lineBoundAt = new Date().toISOString();
            found = true;
        } else if (String(x.lineUserId || "").trim() === lu) {
            // 別的帳號曾綁過此 userId，移除
            x.lineUserId = null;
            x.lineUserName = null;
            x.lineBoundAt = null;
        }
    }
    if (!found) throw new Error("找不到指定帳號");
    await saveAdminUsersRaw(db, users);
    return true;
}

async function unbindLineUserIdFromEmployee(db, username) {
    const u = String(username || "").trim();
    const users = await loadAdminUsersRaw(db);
    let changed = false;
    for (const x of users) {
        if (!x || typeof x !== "object") continue;
        if (String(x.username || "").trim() === u) {
            if (x.lineUserId) changed = true;
            x.lineUserId = null;
            x.lineUserName = null;
            x.lineBoundAt = null;
        }
    }
    if (changed) await saveAdminUsersRaw(db, users);
    return changed;
}

/** 若該 LINE userId 已綁某員工，回傳該員工資料；否則 null */
async function findEmployeeByLineUserId(db, lineUserId) {
    const lu = String(lineUserId || "").trim();
    if (!lu) return null;
    const users = await loadAdminUsersRaw(db);
    for (const x of users) {
        if (!x || typeof x !== "object") continue;
        if (String(x.lineUserId || "").trim() === lu) {
            return {
                username: String(x.username || ""),
                name: String(x.name || x.username || ""),
                title: String(x.title || ""),
                lineUserId: lu,
                lineUserName: x.lineUserName || null,
                lineBoundAt: x.lineBoundAt || null,
            };
        }
    }
    return null;
}

/** 將字串解析為 6 位數綁定指令；命中回 code，否則 null */
function parseBindCommand(text) {
    if (!text || typeof text !== "string") return null;
    const t = text.trim();
    // 接受：「綁定 123456」「綁定123456」「員工綁定 123456」「bind 123456」
    const m = t.match(/^(?:綁定|員工綁定|bind)\s*([0-9]{6})$/i);
    return m ? m[1] : null;
}

async function listEmployeeBindings(db) {
    const users = await loadAdminUsersRaw(db);
    return users.filter(x => x && x.lineUserId);
}
