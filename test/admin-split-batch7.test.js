"use strict";
/**
 * Smoke test：拆檔批次 7（儀表板／營運分析／空籃記帳／分析報表／環境衛生五域拆出）。
 * 五個域在原檔都連續，註冊順序不變。本測試另外鎖住這批的兩個結構性改動：
 *   1. **QI 提到 module 層**：報價 icon 原本宣告在 createAdminRouter 中段，
 *      儀表板（更前面）與報價域都要用 → 任何早於它的 ctx 求值都會 TDZ（批次 6 踩過）。
 *      提到 module 層後「createAdminRouter 能被建出來」＋「首頁與報價頁都能渲染」即為證明。
 *   2. parseFridgeEntriesJson 隨環境衛生域搬走（每日溫度記錄讀得出既有資料）。
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-split7-"));
const SECRET = "test-secret-split7";
process.env.DB_PATH = path.join(TMP, "split7.db");
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
        .run("admin_users", JSON.stringify([{ username: "view", name: "批次七經理", passwordHash: "x:y", title: "經理", status: "active" }]));
    await db.prepare("INSERT INTO customers (id, name, active) VALUES (?, ?, 1)").run("cust-s7", "批次七客戶");
    // 空籃：月表只列「該月有記帳」的客戶，先塞一筆
    const nowIso = new Date().toISOString();
    await db.prepare("INSERT INTO basket_logs (id, customer_id, log_date, taken_to, picked_up, reporter_display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run("bl-s7", "cust-s7", "2026-07-15", 3, 2, "司機甲", nowIso, nowIso);
    // 環境衛生：每日填報頁要有庫房才會渲染表單；entries_json 由 parseFridgeEntriesJson 解出後對應到庫房
    await db.prepare("INSERT INTO freezer_fridge_warehouses (id, name, sort_order, compliant_temp) VALUES (?, ?, ?, ?)")
        .run("wh-s7", "冷凍A庫", 1, "-18");
    await db.prepare("INSERT INTO freezer_fridge_daily (date, entries_json, filler_name) VALUES (?, ?, ?)")
        .run("2026-07-27", JSON.stringify([{ warehouseId: "wh-s7", temp: "-21", powerOk: true, lightOff: true, heatOk: true }]), "測試員");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function get(p) {
    const res = await fetch(baseUrl + p, { redirect: "manual", headers: { cookie: "sf_admin_session=" + signSession("view") } });
    return { status: res.status, text: await res.text() };
}

test("五個拆出模組都有匯出 registerXxxRoutes", () => {
    assert.equal(typeof require("../dist/admin/dashboard.js").registerDashboardRoutes, "function");
    assert.equal(typeof require("../dist/admin/analytics.js").registerAnalyticsRoutes, "function");
    assert.equal(typeof require("../dist/admin/baskets.js").registerBasketsRoutes, "function");
    assert.equal(typeof require("../dist/admin/analysis.js").registerAnalysisRoutes, "function");
    assert.equal(typeof require("../dist/admin/freezer-fridge.js").registerFreezerFridgeRoutes, "function");
});

test("QI 提到 module 層：儀表板與報價頁都渲染得出 icon（任一邊斷掉就是 TDZ/漏傳）", async () => {
    const home = await get("/admin/");
    assert.equal(home.status, 200);
    assert.ok(home.text.includes("<svg"), "儀表板應渲染出 QI 的 SVG");
    const quotes = await get("/admin/quotes");
    assert.equal(quotes.status, 200);
    assert.ok(quotes.text.includes("<svg"), "報價頁應渲染出 QI 的 SVG");
});

test("儀表板域：自訂事件 API 可讀", async () => {
    const r = await get("/admin/api/dashboard-events");
    assert.equal(r.status, 200);
    JSON.parse(r.text); // 應為合法 JSON
});

test("營運分析域：/analytics 與 /reminders 可開", async () => {
    assert.equal((await get("/admin/analytics")).status, 200);
    assert.equal((await get("/admin/reminders")).status, 200);
});

test("空籃記帳域：/baskets 月表列出有記帳的客戶", async () => {
    const page = await get("/admin/baskets?ym=2026-07");
    assert.equal(page.status, 200);
    assert.ok(page.text.includes("批次七客戶"), "空籃月表應列出當月有記帳的客戶");
});

test("分析報表域：/audit、/recognition-stats、/order-eval、/rhythm 都可開", async () => {
    for (const p of ["/admin/audit", "/admin/recognition-stats", "/admin/order-eval", "/admin/rhythm"]) {
        assert.equal((await get(p)).status, 200, p + " 應回 200");
    }
});

test("環境衛生域：每日記錄讀得出既有資料（parseFridgeEntriesJson 有跟著搬走）", async () => {
    assert.equal((await get("/admin/freezer-fridge")).status, 200);
    const daily = await get("/admin/freezer-fridge/daily?date=2026-07-27");
    assert.equal(daily.status, 200);
    assert.ok(daily.text.includes("測試員"), "應帶出既有記錄的填表人");
    // 這一條才真正證明 parseFridgeEntriesJson 有跟著搬走：溫度值是從 entries_json 解出來對應到庫房的
    assert.ok(daily.text.includes("-21"), "應帶出 entries_json 內該庫房的溫度值");
});
