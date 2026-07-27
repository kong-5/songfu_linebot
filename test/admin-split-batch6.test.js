"use strict";
/**
 * Smoke test：拆檔批次 6（人員管理／公告／行事曆／客戶報價四域自 admin/index.js 拆出）。
 * 四個域在原檔都是連續的，註冊順序完全不變；本測試鎖住：
 *   1. 四個模組都掛得上（registerXxxRoutes 存在）
 *   2. 各域代表頁面能開、帶出應有內容
 *   3. **跨檔共用的 helper 沒斷**：QI（報價 icon）留在 index.js 供儀表板用、
 *      nowSqlExpr 留在 index.js 供公告與行事曆共用 —— 若 ctx 漏傳會在這幾頁當場 500
 *   4. QI 是 const，報價註冊點必須在其宣告之後（否則 createAdminRouter 直接 TDZ 爆掉，
 *      這裡以「router 能被建出來」隱含涵蓋）
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-split6-"));
const SECRET = "test-secret-split6";
process.env.DB_PATH = path.join(TMP, "split6.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
let server, baseUrl, db;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "chief", name: "批次六經理", passwordHash: "x:y", title: "經理", status: "active" }]));
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function get(p) {
    const res = await fetch(baseUrl + p, { redirect: "manual", headers: { cookie: "sf_admin_session=" + signSession("chief") } });
    return { status: res.status, text: await res.text() };
}
async function post(p, formStr) {
    const res = await fetch(baseUrl + p, {
        method: "POST", redirect: "manual",
        headers: { cookie: "sf_admin_session=" + signSession("chief"), "content-type": "application/x-www-form-urlencoded" },
        body: formStr,
    });
    return { status: res.status, location: res.headers.get("location") };
}

test("四個拆出模組都有匯出 registerXxxRoutes", () => {
    assert.equal(typeof require("../dist/admin/users.js").registerUsersRoutes, "function");
    assert.equal(typeof require("../dist/admin/announcements.js").registerAnnouncementsRoutes, "function");
    assert.equal(typeof require("../dist/admin/calendar.js").registerCalendarRoutes, "function");
    assert.equal(typeof require("../dist/admin/quotes.js").registerQuotesRoutes, "function");
});

test("人員管理域：/users 列表帶出帳號", async () => {
    const r = await get("/admin/users");
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("批次六經理"), "人員列表應帶出測試帳號");
});

test("公告域：/announcements 列表與 /announcements/new 模板頁可開", async () => {
    assert.equal((await get("/admin/announcements")).status, 200);
    assert.equal((await get("/admin/announcements/new")).status, 200);
});

test("行事曆域：/calendar 月曆頁可開，且 nowSqlExpr 沒斷（新增事件寫得進去）", async () => {
    const page = await get("/admin/calendar");
    assert.equal(page.status, 200);
    // nowSqlExpr 留在 index.js 經 ctx 傳入；漏傳的話這條 INSERT 會炸
    const r = await post("/admin/calendar", "date=2026-08-15&kind=company_holiday&label=" + encodeURIComponent("批次六測試公休"));
    assert.equal(r.status, 302);
    const row = await db.prepare("SELECT label FROM company_calendar WHERE date = ?").get("2026-08-15");
    assert.ok(row && row.label === "批次六測試公休", "行事曆事件應寫入（nowSqlExpr 有正確傳入）");
});

test("報價域：/quotes 列表可開（QI icon 經 ctx 傳入沒斷）", async () => {
    const r = await get("/admin/quotes");
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("<svg"), "報價頁應渲染出 QI 的 SVG icon");
});

test("QI 留在 index.js：儀表板的報價提醒卡片仍能渲染", async () => {
    const r = await get("/admin/");
    assert.equal(r.status, 200, "儀表板用到 QI.calendar/QI.checkc，漏了會 500");
});

test("留在 index.js 的鄰接路由不受影響（/pending、/api/working-date、/line-bot、/import-teraoka）", async () => {
    assert.equal((await get("/admin/pending")).status, 200);
    assert.equal((await get("/admin/line-bot")).status, 200);
    assert.equal((await get("/admin/import-teraoka")).status, 200);
});
