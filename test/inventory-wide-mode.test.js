"use strict";
/**
 * Smoke test：每日盤點「整面模式」（2026-08-13）。
 * 修的問題：盤點表欄位多（未來加回開著有 11 欄），在筆電寬度下右半邊「最新庫存」整組被切掉，
 * 只能拉表格底部的水平捲軸——回報「看不到右邊，要拉下面拖曳，可以整面嗎」。
 *
 * 鎖住的行為：
 *   1. 本頁滿版：頁內覆寫 .notion-main 的 max-width／大留白（別被 1600px＋clamp 3.5vw 卡住）。
 *   2. 選定倉庫時卡片工具列有「整面」按鈕（#stkWideBtn）：收合左邊「近期盤點日／倉庫」兩欄，
 *      表格吃滿；狀態記在 localStorage stk_wide。
 *   3. 收合後左側留窄條（#stkRestore）可點回復——換日期／換倉的唯一入口不能消失。
 *   4. 未選倉（無 #stkCard）不渲染「整面」按鈕，且前端只在有 stkCard 時才自動套用記住的整面
 *      （沒選倉時左邊兩欄是唯一入口）。
 *
 * 跑法：npm test（node --test test/）。實際 listen 隨機埠、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-wide-"));
const SECRET = "test-secret-wide";
process.env.DB_PATH = path.join(TMP, "smoke.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const ICP = "00";
const WH = "FN001";

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}

let server, baseUrl, db;
const cookie = () => ({ cookie: "sf_admin_session=" + signSession("tester") });

async function getPage(qs) {
    const res = await fetch(baseUrl + "/admin/inventory" + (qs ? "?" + qs : ""), { headers: cookie() });
    assert.equal(res.status, 200);
    return await res.text();
}

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO erp_warehouse (icpno, code, name, include_stocktake, sort_order) VALUES (?, ?, ?, 1, 0)").run(ICP, WH, "測試倉");
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(ICP, "A001", "測試豬肉", "", "KG", 100, WH, now);
    await db.prepare("INSERT INTO stocktake_session (id, icpno, wh_code, wh_name, count_date, status, item_count, counted_count, created_by_name, created_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run("s1", ICP, WH, "測試倉", TODAY, "submitted", 1, 1, "盤點員", now, now);
    await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run("s1-0", "s1", "A001", "測試豬肉", "", "KG", 100, 98, now);
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("1. 本頁滿版：覆寫 .notion-main 的 max-width 與大留白", async () => {
    const html = await getPage("date=" + TODAY);
    assert.ok(html.includes(".notion-main{max-width:none"), "頁內應覆寫 .notion-main max-width");
});

test("2. 選定倉庫：有「整面」按鈕＋整面模式 CSS＋localStorage 記憶", async () => {
    const html = await getPage("date=" + TODAY + "&wh=" + ICP + ":" + WH);
    assert.ok(html.includes('id="stkWideBtn"'), "應渲染整面按鈕");
    assert.ok(html.includes(".stk-grid.stk-wide{grid-template-columns:34px minmax(0,1fr);}"), "整面模式應收成 窄條＋表格 兩欄");
    assert.ok(html.includes(".stk-grid.stk-wide>.wh-panel{display:none;}"), "整面模式應藏起日期／倉庫兩欄");
    assert.ok(html.includes("localStorage.setItem('stk_wide'"), "整面選擇應記住");
});

test("3. 收合後左側留窄條可點回復（換日期／換倉入口不能消失）", async () => {
    const html = await getPage("date=" + TODAY + "&wh=" + ICP + ":" + WH);
    assert.ok(html.includes('id="stkRestore"'), "應渲染回復窄條");
    assert.ok(html.includes(".stk-grid.stk-wide>.stk-restore{display:flex;}"), "整面時窄條要顯示");
    assert.ok(html.includes("restoreBar.addEventListener('click',function(){ stkSetWide(false); })"), "點窄條應回復三欄");
});

test("4. 未選倉（該日無盤點）：不渲染整面按鈕，自動套用有 stkCard 防呆", async () => {
    // 沒帶 wh 時會自動選第一個已盤倉，所以「未選倉」要用沒有盤點紀錄的日期
    const EMPTY_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - 86400000));
    const html = await getPage("date=" + EMPTY_DAY);
    assert.ok(!html.includes('id="stkWideBtn"'), "未選倉不該有整面按鈕");
    assert.ok(html.includes("localStorage.getItem('stk_wide')==='1'&&document.getElementById('stkCard')"), "自動整面要先確認有選倉（stkCard）");
});
