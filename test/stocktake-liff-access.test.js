"use strict";
/**
 * Smoke test：盤點 LIFF 授權（2026-09-01 體檢）。
 *
 * 鎖住的洞：舊版 stkAuth 只驗「ID Token 有效」＝任何有 LINE 帳號的人，只要知道 LIFF ID
 * （寫死在原始碼、也印在每張 #盤點 卡片上）就能讀全倉庫存量、匯出整份條碼對照表、
 * 送出假盤點數字、改寫條碼→料號對應。
 *
 * 新規則（任一通過即可）：
 *   1. 已綁定員工
 *   2. 授權記憶表有這個人（曾從已開盤點的群組進來過）
 *   3. 帶 groupId ＋ 該群開著盤點 ＋ LINE API 證實是該群成員
 *
 * 不變式（這幾條退化就是把洞打回去）：
 *   - 陌生人（無綁定、無記憶、無群組）一律 403
 *   - 群組沒開盤點 → 403（不能繞過 group_features）
 *   - LINE 說「不是成員」→ 403（不信任前端送的 groupId）
 *   - 第一次走群組通過後會被記住 → 之後不帶 groupId 也能進（現場從 LIFF 歷史清單開啟的情境）
 *   - LINE API 掛掉（unknown）→ fail-open 放行（盤點是現場作業，LINE 抖一下不該鎖住整倉）
 *
 * 跑法：npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-stkacc-"));
let seq = 0;

const { resolveStocktakeAccess } = require("../dist/lib/stocktake-access.js");
const { setGroupFeatures } = require("../dist/lib/group-features.js");

async function freshDb() {
    const { initDb, getDb } = require("../dist/db/index.js");
    const p = path.join(TMP, "t" + (++seq) + ".db");
    await initDb(p);
    return getDb(p);
}

const USER = "U_test_user_0001";
const GROUP = "C_test_group_0001";

/**
 * 攔截 global.fetch：
 *   - oauth2/v2.1/verify → 回傳指定的 sub（模擬 LINE 登入驗證通過）
 *   - /group/{gid}/member/{uid} → 依 memberStatus 回 200 / 404 / 500
 */
function stubLine({ sub = USER, name = "測試員", memberStatus = 200 } = {}) {
    const orig = global.fetch;
    global.fetch = async (url, _opt) => {
        const u = String(url);
        if (u.includes("oauth2/v2.1/verify")) {
            return { ok: true, status: 200, json: async () => ({ sub, name, aud: "TESTCHANNEL" }) };
        }
        if (u.includes("/v2/bot/group/")) {
            return { ok: memberStatus === 200, status: memberStatus, json: async () => ({}) };
        }
        throw new Error("測試未預期的 fetch: " + u);
    };
    return () => { global.fetch = orig; };
}

function reqWith(groupId) {
    return {
        headers: Object.assign(
            { authorization: "Bearer dummy-id-token" },
            groupId ? { "x-stk-group": groupId } : {}
        ),
        query: {},
    };
}

test.before(() => { process.env.LINE_LOGIN_CHANNEL_ID = "TESTCHANNEL"; process.env.LINE_CHANNEL_ACCESS_TOKEN = "dummy-token"; });

test("1. 陌生人（無綁定/無記憶/無群組）→ 403，且訊息告訴他怎麼修正", async () => {
    const db = await freshDb();
    const restore = stubLine();
    try {
        const a = await resolveStocktakeAccess(db, reqWith(null));
        assert.equal(a.ok, false, "陌生人不該通過");
        assert.equal(a.status, 403);
        assert.match(a.error, /#盤點/, "錯誤訊息要告訴使用者回群組打 #盤點（守則 #4）");
    } finally { restore(); }
});

test("2. 沒帶 Authorization → 401", async () => {
    const db = await freshDb();
    const restore = stubLine();
    try {
        const a = await resolveStocktakeAccess(db, { headers: {}, query: {} });
        assert.equal(a.ok, false);
        assert.equal(a.status, 401);
    } finally { restore(); }
});

test("3. 已綁定員工 → 放行（via=employee），不需群組", async () => {
    const db = await freshDb();
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "wh01", name: "倉管小陳", title: "主任", lineUserId: USER }]));
    const restore = stubLine();
    try {
        const a = await resolveStocktakeAccess(db, reqWith(null));
        assert.equal(a.ok, true);
        assert.equal(a.via, "employee");
        assert.equal(a.lineUserId, USER);
    } finally { restore(); }
});

test("4. 群組開著盤點＋LINE 證實是成員 → 放行並被記住；之後不帶 groupId 也能進", async () => {
    const db = await freshDb();
    await setGroupFeatures(db, GROUP, { order: false, stocktake: true, basket: false });
    const restore = stubLine({ memberStatus: 200 });
    try {
        const a = await resolveStocktakeAccess(db, reqWith(GROUP));
        assert.equal(a.ok, true, "群組成員應通過");
        assert.equal(a.via, "group");

        const row = await db.prepare("SELECT line_user_id, group_id FROM stocktake_authorized_user WHERE line_user_id = ?").get(USER);
        assert.ok(row, "通過後要寫進授權記憶表");
        assert.equal(row.group_id, GROUP);

        // 現場常見：之後從 LIFF 歷史清單/外部瀏覽器開，liff.getContext() 拿不到 groupId
        const b = await resolveStocktakeAccess(db, reqWith(null));
        assert.equal(b.ok, true, "記住之後不帶 groupId 也要能進，否則會把現場人員鎖在門外");
        assert.equal(b.via, "remembered");
    } finally { restore(); }
});

test("5. 群組沒開盤點 → 403（不得繞過 group_features）", async () => {
    const db = await freshDb();
    await setGroupFeatures(db, GROUP, { order: true, stocktake: false, basket: true });
    const restore = stubLine({ memberStatus: 200 });
    try {
        const a = await resolveStocktakeAccess(db, reqWith(GROUP));
        assert.equal(a.ok, false, "群組沒開盤點就不該放行");
        assert.equal(a.status, 403);
    } finally { restore(); }
});

test("6. LINE 說「不是該群成員」→ 403（前端送的 groupId 不可信任）", async () => {
    const db = await freshDb();
    await setGroupFeatures(db, GROUP, { order: false, stocktake: true, basket: false });
    const restore = stubLine({ memberStatus: 404 });
    try {
        const a = await resolveStocktakeAccess(db, reqWith(GROUP));
        assert.equal(a.ok, false, "隨便貼一個看到的 groupId 不該有用");
        assert.equal(a.status, 403);
        const row = await db.prepare("SELECT line_user_id FROM stocktake_authorized_user WHERE line_user_id = ?").get(USER);
        assert.equal(row, undefined, "沒通過就不該被記住");
    } finally { restore(); }
});

test("7. LINE API 掛掉（500＝unknown）→ fail-open 放行（現場作業不能被 LINE 抖動鎖住）", async () => {
    const db = await freshDb();
    await setGroupFeatures(db, GROUP, { order: false, stocktake: true, basket: false });
    const restore = stubLine({ memberStatus: 500 });
    try {
        const a = await resolveStocktakeAccess(db, reqWith(GROUP));
        assert.equal(a.ok, true, "LINE 端不確定時放行（攻擊者無法主動製造這個狀態）");
        assert.equal(a.via, "group");
    } finally { restore(); }
});

test("8. 逃生門 stocktake_liff_open_access=1 → 完全回舊行為", async () => {
    const db = await freshDb();
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
        .run("stocktake_liff_open_access", "1");
    const restore = stubLine();
    try {
        const a = await resolveStocktakeAccess(db, reqWith(null));
        assert.equal(a.ok, true, "逃生門打開時陌生人也放行（現場被擋住的救急用）");
        assert.equal(a.via, "open-access");
    } finally { restore(); }
});

test("9. ID Token 驗證失敗 → 401（不因新邏輯而被繞過）", async () => {
    const db = await freshDb();
    const orig = global.fetch;
    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: "invalid_token" }) });
    try {
        const a = await resolveStocktakeAccess(db, reqWith(GROUP));
        assert.equal(a.ok, false);
        assert.equal(a.status, 401);
    } finally { global.fetch = orig; }
});

test("10. stocktake_authorized_user 表在 initDb 後存在（雙分支 schema 都要有）", async () => {
    const db = await freshDb();
    const r = await db.prepare("SELECT COUNT(*) AS n FROM stocktake_authorized_user").get();
    assert.equal(Number(r.n), 0);
});
