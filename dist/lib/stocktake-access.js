"use strict";
/**
 * 盤點 LIFF 授權（2026-09-01 體檢定案）
 * ------------------------------------------------------------------
 * 舊行為：只驗「ID Token 有效」＝任何有 LINE 帳號的人，只要知道 LIFF ID
 * （寫死在原始碼、也印在每張 #盤點 卡片上）就能讀全倉庫存量、匯出整份條碼對照表、
 * 送出假盤點數字、改寫條碼→料號對應。盤點現在是主力業務，污染了不易察覺。
 *
 * 新行為（三條路，任一通過即可，順序即成本由低到高）：
 *   1. 已綁定員工          → 放行（後台/掃碼/內部人員，行為完全不變）
 *   2. 授權記憶表有這個人  → 放行（曾經從已開盤點的群組進來過）
 *   3. 帶得出 groupId      → 該群組要開著盤點功能 ＋ 用 LINE API 驗證此人「真的是該群成員」
 *                            → 放行並記進授權記憶表
 * 都不成立 → 403，訊息告訴使用者怎麼修正（回群組點 #盤點 的連結）。
 *
 * ⚠ 為什麼要「授權記憶表」：LIFF 從聊天室開啟時 liff.getContext() 才有 groupId；
 *   使用者若從 LINE 的「最近使用」清單或外部瀏覽器開，就拿不到 → 沒有記憶表會把
 *   現場人員鎖在門外。第一次進來必須走群組（無法偽造），之後才認得。
 *
 * ⚠ groupId 由前端送上來，但**不信任**：一定要打 LINE API 驗成員身分才算數，
 *   所以隨便貼一個看來的 groupId 沒有用。
 *
 * ⚠ LINE API 呼叫失敗（網路/額度）＝fail-open 放行並記 log：盤點是現場作業，
 *   LINE 端抖一下不該讓整倉盤不了。攻擊者無法主動製造這個狀態。
 *   但「LINE 明確回答不是成員」＝fail-closed 擋掉。
 *
 * 逃生門：app_settings.stocktake_liff_open_access = '1' → 完全回舊行為（只驗 token）。
 *   現場真的被擋住又來不及查時用，記得事後關掉（每次放行都會 console.warn）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveStocktakeAccess = resolveStocktakeAccess;
exports.rememberStocktakeUser = rememberStocktakeUser;

const liff_verify_js_1 = require("./liff-verify.js");
const liff_auth_js_1 = require("./liff-auth.js");
const employee_line_binding_js_1 = require("./employee-line-binding.js");
const group_features_js_1 = require("./group-features.js");

const OPEN_ACCESS_KEY = "stocktake_liff_open_access";

/** 前端送上來的 groupId：優先 header（所有 API 都能帶），其次 query（相容舊頁面） */
function readGroupId(req) {
    const h = String(req?.headers?.["x-stk-group"] || "").trim();
    if (h) return h;
    const q = String(req?.query?.gid || "").trim();
    return q || "";
}

async function isOpenAccess(db) {
    try {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(OPEN_ACCESS_KEY);
        return String(row?.value || "").trim() === "1";
    } catch (_) { return false; }
}

/**
 * 用 LINE Messaging API 驗證「這個 userId 真的在這個 group 裡」。
 * 200＝是成員；404＝不是成員（或機器人不在該群）；其他/例外＝不確定。
 * @returns {Promise<"member"|"not-member"|"unknown">}
 */
async function verifyGroupMembership(groupId, userId) {
    const token = String(process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
    if (!token) return "unknown";
    try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 5000);
        let r;
        try {
            r = await fetch(
                `https://api.line.me/v2/bot/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(userId)}`,
                { headers: { Authorization: `Bearer ${token}` }, signal: ctl.signal }
            );
        } finally { clearTimeout(timer); }
        if (r.status === 200) return "member";
        if (r.status === 404) return "not-member";
        console.warn("[stocktake-access] LINE 成員查詢非預期狀態 %s group=%s", r.status, groupId);
        return "unknown";
    } catch (e) {
        console.warn("[stocktake-access] LINE 成員查詢失敗（放行）:", e?.message || e);
        return "unknown";
    }
}

async function findRememberedUser(db, lineUserId) {
    try {
        return await db.prepare("SELECT line_user_id FROM stocktake_authorized_user WHERE line_user_id = ?").get(lineUserId);
    } catch (_) { return null; }
}

/** 記住這個人（冪等：已存在就只更新 last_seen） */
async function rememberStocktakeUser(db, lineUserId, groupId, displayName) {
    const now = new Date().toISOString();
    try {
        const hit = await db.prepare("SELECT line_user_id FROM stocktake_authorized_user WHERE line_user_id = ?").get(lineUserId);
        if (hit) {
            await db.prepare("UPDATE stocktake_authorized_user SET last_seen = ?, group_id = COALESCE(NULLIF(?,''), group_id) WHERE line_user_id = ?")
                .run(now, String(groupId || ""), lineUserId);
        } else {
            await db.prepare("INSERT INTO stocktake_authorized_user (line_user_id, group_id, display_name, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)")
                .run(lineUserId, String(groupId || ""), String(displayName || ""), now, now);
        }
    } catch (e) {
        // 記憶失敗不該擋住盤點：下次再從群組進來重驗一次即可
        console.warn("[stocktake-access] 授權記憶寫入失敗:", e?.message || e);
    }
}

/**
 * @returns {Promise<{ok:boolean, status?:number, error?:string, lineUserId?:string, via?:string, employee?:object}>}
 *   via: "employee" | "remembered" | "group" | "open-access"
 *   lineName: LINE 顯示名（呼叫處記錄操作人用）
 */
async function resolveStocktakeAccess(db, req) {
    const idToken = (0, liff_auth_js_1.readBearerIdToken)(req);
    if (!idToken) return { ok: false, status: 401, error: "需 LINE 登入" };
    const v = await (0, liff_verify_js_1.verifyLineIdToken)(idToken);
    if (!v.ok) return { ok: false, status: 401, error: v.error || "登入驗證失敗" };
    const lineUserId = v.sub;
    const lineName = v.name || null;   // LINE 顯示名：呼叫處（條碼綁定紀錄）沿用，別退化成空字串

    // 逃生門
    if (await isOpenAccess(db)) {
        console.warn("[stocktake-access] ⚠ 開放模式（app_settings.%s=1）放行 user=%s——記得關掉", OPEN_ACCESS_KEY, lineUserId);
        return { ok: true, lineUserId, lineName, via: "open-access" };
    }

    // 1. 已綁定員工
    try {
        const emp = await (0, employee_line_binding_js_1.findEmployeeByLineUserId)(db, lineUserId);
        if (emp) return { ok: true, lineUserId, lineName, via: "employee", employee: emp };
    } catch (e) { console.warn("[stocktake-access] 員工綁定查詢失敗:", e?.message || e); }

    // 2. 授權記憶
    if (await findRememberedUser(db, lineUserId)) {
        await rememberStocktakeUser(db, lineUserId, "", "");
        return { ok: true, lineUserId, lineName, via: "remembered" };
    }

    // 3. 群組成員驗證
    const groupId = readGroupId(req);
    if (groupId) {
        let feat = null;
        try { feat = await (0, group_features_js_1.getGroupFeatures)(db, groupId); }
        catch (e) { console.warn("[stocktake-access] 群組功能查詢失敗:", e?.message || e); }
        if (feat && feat.stocktake) {
            const m = await verifyGroupMembership(groupId, lineUserId);
            if (m === "member" || m === "unknown") {
                if (m === "unknown") console.warn("[stocktake-access] 成員身分不確定，先放行 user=%s group=%s", lineUserId, groupId);
                await rememberStocktakeUser(db, lineUserId, groupId, lineName || "");
                return { ok: true, lineUserId, lineName, via: "group" };
            }
        }
    }

    return {
        ok: false,
        status: 403,
        error: "此 LINE 帳號沒有盤點權限。請回到公司的盤點群組，輸入 #盤點 後點卡片上的連結進入（第一次要從群組進來，之後就記得了）；若你是員工，也可請管理員在後台「人員管理」產生 LIFF 綁定連結。",
    };
}
