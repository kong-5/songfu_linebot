"use strict";
/**
 * Smoke test：每日盤點「最新系統／對最新盤差」歷史日期凍結（2026-07-26）。
 * 修的問題：舊版不分日期一律讀即時庫存快照 → 昨天以前的盤差每天都跟著今天的庫存跑，歷史盤差永遠不定案。
 *
 * 鎖住的行為：
 *   1. 今天：右側「系統」欄＝即時快照（erp_stock_wh_qty 分倉優先，無分倉→erp_stock_items 總量）。
 *   2. 過去日期：右側「系統」欄＝**該日收盤快照**（erp_stock_wh_daily 分倉優先，無分倉→erp_stock_daily），
 *      即時庫存怎麼變都不影響；畫面標「已凍結 <日期> 收盤」。
 *   3. 該日沒有推送紀錄 → 退回「該日之前最近一次」快照，標「（該日無推送）」。
 *   4. 完全沒有歷史快照（保留期外／功能上線前）→ 退回即時量並標「無當日快照・顯示即時量」。
 *   5. CSV 的「最新系統基準」欄同步標示凍結/即時。
 *   6. 「套用實盤」的 delta 基準＝畫面顯示的那個基準（過去日期＝該日收盤，不是即時量）。
 *
 * 跑法：npm test（node --test test/）。實際 listen 隨機埠、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-frozen-"));
const SECRET = "test-secret-frozen";
process.env.DB_PATH = path.join(TMP, "smoke.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

const taipei = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - n * 86400000));
const TODAY = taipei(0);
const D1 = taipei(1);  // 昨天：有當日收盤快照
const D3 = taipei(3);  // 三天前：當日無推送 → 退回 D4 收盤
const D4 = taipei(4);
const D9 = taipei(9);  // 九天前：完全沒有快照（比最早的快照還早）→ 退回即時量

const ICP = "00";
const WH = "FN005";   // 有分倉資料的倉
const WH2 = "Y99";    // 無分倉資料的倉（走公司總量基準）

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}

let server, baseUrl, db;
const cookie = () => ({ cookie: "sf_admin_session=" + signSession("tester") });

async function seedSession(id, date, wh, items) {
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO stocktake_session (id, icpno, wh_code, wh_name, count_date, status, item_count, counted_count, created_by_name, created_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, ICP, wh, wh + "倉", date, "submitted", items.length, items.length, "盤點員", now, now);
    let i = 0;
    for (const it of items) {
        await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run(id + "-" + (i++), id, it.code, it.name || "測試豬肉", "", "KG", it.sys, it.counted, now);
    }
}

async function getPage(qs) {
    const res = await fetch(baseUrl + "/admin/inventory?" + qs, { headers: cookie() });
    assert.equal(res.status, 200);
    return await res.text();
}

/** 取某料號那一列的所有數字欄（料號｜品名｜系統(當下)｜實盤｜盤差｜系統(右)｜盤差(右)） */
function rowCells(html, code) {
    const re = new RegExp('<tr[^>]*>\\s*<td class="stk-code">' + code + "</td>[\\s\\S]*?</tr>");
    const m = html.match(re);
    assert.ok(m, "找不到料號 " + code + " 的列");
    return m[0];
}

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const now = new Date().toISOString();
    // 倉別（納入盤點）
    for (const [code, name] of [[WH, "測試倉"], [WH2, "無分倉倉"]])
        await db.prepare("INSERT INTO erp_warehouse (icpno, code, name, include_stocktake, sort_order) VALUES (?, ?, ?, 1, 0)").run(ICP, code, name);
    // 即時庫存快照：A001 公司總量 999（分倉 500）、B001 公司總量 700
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(ICP, "A001", "測試豬肉", "", "KG", 999, WH, now);
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(ICP, "B001", "測試雞蛋", "", "KG", 700, WH2, now);
    await db.prepare("INSERT INTO erp_stock_wh_qty (icpno, wh_code, erp_code, qty, updated_at) VALUES (?, ?, ?, ?, ?)").run(ICP, WH, "A001", 500, now);
    // 每日快照：分倉（WH）D1=100、D4=140（D3 當天沒推送）；公司總量 D1=300
    for (const [d, q] of [[D1, 100], [D4, 140]])
        await db.prepare("INSERT INTO erp_stock_wh_daily (icpno, wh_code, erp_code, snap_date, qty, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(ICP, WH, "A001", d, q, now);
    await db.prepare("INSERT INTO erp_stock_daily (icpno, erp_code, snap_date, qty, updated_at) VALUES (?, ?, ?, ?, ?)").run(ICP, "B001", D1, 300, now);
    // 盤點：今天/昨天/三天前（WH，A001）＋昨天（WH2，B001 走總量基準）＋九天前（無快照）
    await seedSession("s-today", TODAY, WH, [{ code: "A001", sys: 480, counted: 500 }]);
    await seedSession("s-d1", D1, WH, [{ code: "A001", sys: 95, counted: 110 }]);
    await seedSession("s-d3", D3, WH, [{ code: "A001", sys: 130, counted: 150 }]);
    await seedSession("s-d1b", D1, WH2, [{ code: "B001", name: "測試雞蛋", sys: 290, counted: 310 }]);
    await seedSession("s-d9", D9, WH, [{ code: "A001", sys: 88, counted: 90 }]);
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("1. 今天：右側系統欄＝即時分倉量（500），對最新盤差 0", async () => {
    const html = await getPage("date=" + TODAY + "&wh=" + ICP + ":" + WH);
    const row = rowCells(html, "A001");
    assert.ok(row.includes(">500<"), "應顯示即時分倉量 500：" + row);
    assert.ok(html.includes("最新基準：分倉"), "今天應標「最新基準」");
    assert.ok(!html.includes("已凍結 "), "今天不該標「已凍結 <日期>」");
    assert.ok(!html.includes("當日系統（凍結）"), "今天表頭應維持「最新庫存」");
});

test("2. 過去日期：右側系統欄＝該日收盤快照（100），不是即時的 500", async () => {
    const html = await getPage("date=" + D1 + "&wh=" + ICP + ":" + WH);
    const row = rowCells(html, "A001");
    assert.ok(row.includes(">100<"), "應顯示 " + D1 + " 收盤量 100：" + row);
    assert.ok(!row.includes(">500<"), "不該再顯示今天的即時量 500：" + row);
    assert.ok(row.includes("+10"), "對當日盤差＝110−100＝+10：" + row);
    assert.ok(html.includes("已凍結 " + D1 + " 收盤"), "應標出凍結日期");
    assert.ok(html.includes("當日系統（凍結）"), "表頭應改成「當日系統（凍結）」");
});

test("3. 該日無推送 → 退回之前最近一次快照（D4 的 140）並標示", async () => {
    const html = await getPage("date=" + D3 + "&wh=" + ICP + ":" + WH);
    const row = rowCells(html, "A001");
    assert.ok(row.includes(">140<"), "應退回 " + D4 + " 收盤量 140：" + row);
    assert.ok(html.includes("已凍結 " + D4 + " 收盤（該日無推送）"), "應標出實際快照日期與「該日無推送」");
});

test("4. 無分倉快照的倉 → 用公司總量的當日收盤（300），不是即時的 700", async () => {
    const html = await getPage("date=" + D1 + "&wh=" + ICP + ":" + WH2);
    const row = rowCells(html, "B001");
    assert.ok(row.includes(">300<"), "應顯示公司總量收盤 300：" + row);
    assert.ok(!row.includes(">700<"), "不該顯示即時總量 700：" + row);
    assert.ok(html.includes("當日基準：總量"), "基準標記應為總量");
});

test("5. 完全沒有歷史快照 → 退回即時量並標「無當日快照」", async () => {
    const html = await getPage("date=" + D9 + "&wh=" + ICP + ":" + WH);
    const row = rowCells(html, "A001");
    assert.ok(row.includes(">500<"), "沒有歷史快照只能退回即時分倉量 500：" + row);
    assert.ok(html.includes("無當日快照"), "應標出退回即時量");
});

test("6. CSV 的「最新系統基準」欄標示凍結／即時", async () => {
    const past = await (await fetch(baseUrl + "/admin/inventory/stocktake.csv?date=" + D1, { headers: cookie() })).text();
    assert.ok(past.includes("分倉(" + D1 + "收盤・凍結)"), "過去日期 CSV 應標凍結：" + past.split("\r\n")[1]);
    assert.ok(past.includes(',"100",'), "CSV 的最新系統量應是當日收盤 100");
    const today = await (await fetch(baseUrl + "/admin/inventory/stocktake.csv?date=" + TODAY, { headers: cookie() })).text();
    assert.ok(today.includes("分倉(即時)"), "今天 CSV 應標即時");
});

test("7. 套用實盤：delta 基準＝畫面上的基準（過去日期用當日收盤）", async () => {
    const body = new URLSearchParams({ action: "set_from_count", icpno: ICP, erp_code: "A001", wh_code: WH, count_date: D1, counted: "110", back: "date=" + D1 });
    const res = await fetch(baseUrl + "/admin/inventory/adjustments", {
        method: "POST", redirect: "manual",
        headers: Object.assign({ "Content-Type": "application/x-www-form-urlencoded" }, cookie()),
        body: body.toString(),
    });
    assert.ok(res.status >= 300 && res.status < 400, "應 redirect 回盤點頁");
    const row = await db.prepare("SELECT delta, base_qty FROM stock_adjustment WHERE icpno = ? AND erp_code = ?").get(ICP, "A001");
    assert.ok(row, "應寫入調整");
    assert.equal(Number(row.delta), 10, "delta＝實盤110 − 當日收盤100 ＝ +10（不是 110−500＝−390）");
    assert.equal(Number(row.base_qty), 100);
    // 套用後該日「對當日盤差」歸零
    const html = await getPage("date=" + D1 + "&wh=" + ICP + ":" + WH);
    const r2 = rowCells(html, "A001");
    assert.ok(r2.includes("調+10") || r2.includes("調 +10"), "應顯示調整值：" + r2);
    await db.prepare("DELETE FROM stock_adjustment WHERE icpno = ? AND erp_code = ?").run(ICP, "A001");
});
