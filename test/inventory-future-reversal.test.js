"use strict";
/**
 * Smoke test：未來銷貨加回 →「應有實體量」與盤差（2026-07-30）。
 *
 * 修的問題（同事回報）：未來日期的銷貨單一打進凌越就**立刻扣** SK_NOWQTY，但貨還在架上，
 * 盤點一定「盤盈」。例：豆薯 系統 64.4／實盤 92／盤差 +27.6，其實 26.8 全是未來單。
 *
 * 鎖住的行為：
 *   1. 送出盤點時**凍結**未來銷貨淨量到 stocktake_count.future_qty（未來單會隨日期滾動消失）。
 *   2. 分倉分攤：未來量只掛該料號的**主倉**（分倉量最大者，0/負庫存也算），其餘倉 0 → 跨倉加總不會雙倍。
 *   3. 每日盤點頁開關開：多「應有＝系統＋未來」欄，**盤差對應有算**（92 − 91.2 ＝ +0.8）。
 *   4. 開關關：完全回到舊行為（無應有欄、盤差＝92 − 64.4 ＝ +27.6）。
 *   5. 過去日期的「最新/當日應有」讀 erp_future_daily 當日收盤，不是今天的 erp_future_sales。
 *   6. 「套用實盤」的 delta 基準＝應有量（不把未來量寫成永久調整 → 免雙重補償）。
 *   7. 統計熱力圖盤差同口徑（含凍結的未來量）。
 *   8. 盤點端 API（LIFF/掃碼/網頁版）逐品項帶 f，讓盤點人看得到「應有」。
 *
 * 跑法：npm test（node --test test/）。實際 listen 隨機埠、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-future-"));
const SECRET = "test-secret-future";
process.env.DB_PATH = path.join(TMP, "smoke.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");
const { getStocktakeItems, submitStocktake } = require("../dist/lib/stocktake-api.js");
const { makeFutureResolver } = require("../dist/lib/stock-future.js");

const taipei = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - n * 86400000));
const TODAY = taipei(0);
const D2 = taipei(2); // 過去日期：用該日的未來銷貨收盤快照

const ICP = "00";
const WH = "FN013";  // 豆薯/老薑的主倉
const WH2 = "FN005"; // 老薑的主倉（測分攤：同料號跨倉只加主倉）

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}

let server, baseUrl, db;
const cookie = () => ({ cookie: "sf_admin_session=" + signSession("tester") });
const setFutureSwitch = async (on) => {
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("stock_future_reversal_enabled", on ? "1" : "0");
};
async function getPage(qs) {
    const res = await fetch(baseUrl + "/admin/inventory?" + qs, { headers: cookie() });
    assert.equal(res.status, 200);
    return await res.text();
}
function rowOf(html, code) {
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
    for (const [code, name] of [[WH, "廣場區"], [WH2, "冷凍庫"]])
        await db.prepare("INSERT INTO erp_warehouse (icpno, code, name, include_stocktake, sort_order) VALUES (?, ?, ?, 1, 0)").run(ICP, code, name);
    // 庫存主檔（公司總量）：B001 豆薯 64.4（只在 WH）、G001 老薑 40（WH 10 + WH2 30 → 主倉 WH2）
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(ICP, "B001", "豆薯", "30KG/件", "KG", 64.4, WH, now);
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(ICP, "G001", "老薑", "30KG/箱", "KG", 40, WH, now);
    // 分倉量
    for (const [wh, code, q] of [[WH, "B001", 64.4], [WH, "G001", 10], [WH2, "G001", 30]])
        await db.prepare("INSERT INTO erp_stock_wh_qty (icpno, wh_code, erp_code, qty, updated_at) VALUES (?, ?, ?, ?, ?)").run(ICP, wh, code, q, now);
    // 未來銷貨（現況）：豆薯 26.8、老薑 5
    for (const [code, q] of [["B001", 26.8], ["G001", 5]])
        await db.prepare("INSERT INTO erp_future_sales (icpno, erp_code, qty, updated_at) VALUES (?, ?, ?, ?)").run(ICP, code, q, now);
    // 過去日期（D2）：庫存收盤 50、未來銷貨收盤 9（跟今天的 26.8 不同，才驗得出有沒有凍結）
    await db.prepare("INSERT INTO erp_stock_wh_daily (icpno, wh_code, erp_code, snap_date, qty, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(ICP, WH, "B001", D2, 50, now);
    await db.prepare("INSERT INTO erp_future_daily (icpno, erp_code, snap_date, qty, updated_at) VALUES (?, ?, ?, ?, ?)").run(ICP, "B001", D2, 9, now);
    await setFutureSwitch(true);
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("1. 盤點端 API 帶 f（本倉分攤後的未來量）：主倉才有，非主倉為 0", async () => {
    const a = await getStocktakeItems(db, { icpno: ICP, whCode: WH, minimal: false });
    assert.equal(a.futureOn, true);
    const b = a.items.find((x) => x.c === "B001");
    const g = a.items.find((x) => x.c === "G001");
    assert.equal(b.f, 26.8, "豆薯只在 FN013 → 未來量全掛這倉");
    assert.equal(g.f, undefined, "老薑主倉是 FN005，FN013 不該加回（否則跨倉加總會雙倍）");
    // 主倉那一側（老薑的分倉量 FN005 30 > FN013 10）：整包 5 掛在 FN005，逐倉相加剛好一次
    const futFor = makeFutureResolver(db, "");
    assert.equal((await futFor(ICP, WH2)).get("G001"), 5, "老薑主倉 FN005 才加回");
    assert.equal((await futFor(ICP, WH)).get("G001"), 0, "非主倉不加回");
});

test("1b. 唯一那一倉是 0／負庫存也要認得出主倉（賣很兇又先開未來單的品項最需要加回）", async () => {
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(ICP, "Z001", "洋蔥", "", "KG", -3, WH, now);
    await db.prepare("INSERT INTO erp_stock_wh_qty (icpno, wh_code, erp_code, qty, updated_at) VALUES (?, ?, ?, ?, ?)").run(ICP, WH, "Z001", -3, now);
    await db.prepare("INSERT INTO erp_future_sales (icpno, erp_code, qty, updated_at) VALUES (?, ?, ?, ?)").run(ICP, "Z001", 12, now);
    const futFor = makeFutureResolver(db, "");
    assert.equal((await futFor(ICP, WH)).get("Z001"), 12, "分倉量 −3（唯一一倉）仍要加回 12，不能整包丟掉");
});

test("2. 送出盤點：future_qty 被凍結進 stocktake_count（伺服器端算，不吃前端值）", async () => {
    await submitStocktake(db, {
        icpno: ICP, whCode: WH, date: TODAY, createdBy: "u1", createdByName: "佳蓉", baseSubmittedAt: null,
        counts: [
            { code: "B001", name: "豆薯", spec: "30KG/件", unit: "KG", sys: 64.4, counted: 92, f: 999 },
            { code: "G001", name: "老薑", spec: "30KG/箱", unit: "KG", sys: 10, counted: 10 },
        ],
    });
    const rows = await db.prepare("SELECT c.erp_code, c.sys_qty, c.future_qty FROM stocktake_count c JOIN stocktake_session s ON s.id = c.session_id WHERE s.count_date = ? AND s.wh_code = ?").all(TODAY, WH);
    const m = {}; rows.forEach((r) => { m[r.erp_code] = Number(r.future_qty || 0); });
    assert.equal(m.B001, 26.8, "豆薯凍結 26.8（前端亂傳的 999 不採用）");
    assert.equal(m.G001, 0, "老薑在非主倉 → 凍結 0");
});

test("3. 每日盤點頁（開關開）：多「應有」欄，盤差＝實盤−應有（+0.8，不是 +27.6）", async () => {
    const html = await getPage("date=" + TODAY + "&wh=" + ICP + ":" + WH);
    assert.ok(html.includes("應有"), "表頭應出現「應有」欄");
    assert.ok(html.includes("未來加回：已計入盤差"), "卡片應標未來加回已計入");
    const row = rowOf(html, "B001");
    assert.ok(row.includes(">91.2<"), "應有＝64.4＋26.8＝91.2：" + row);
    assert.ok(row.includes("未來+26.8"), "應標出未來量：" + row);
    assert.ok(row.includes("+0.8"), "盤差應為 +0.8：" + row);
    assert.ok(!row.includes("+27.6"), "不該再出現未來單造成的假盤差 +27.6：" + row);
});

test("4. 開關關：完全回到舊行為（無應有欄、盤差 +27.6）", async () => {
    await setFutureSwitch(false);
    const html = await getPage("date=" + TODAY + "&wh=" + ICP + ":" + WH);
    const row = rowOf(html, "B001");
    assert.ok(row.includes("+27.6"), "關閉時盤差＝92−64.4＝+27.6（原行為）：" + row);
    assert.ok(!row.includes("未來+"), "關閉時不顯示未來量：" + row);
    assert.ok(!html.includes("未來加回：已計入盤差"), "關閉時不標未來加回");
    await setFutureSwitch(true);
});

test("5. 過去日期：最新應有用該日的未來銷貨收盤快照（9），不是今天的 26.8", async () => {
    const now = new Date().toISOString();
    const sid = "stk-past-1";
    await db.prepare("INSERT INTO stocktake_session (id, icpno, wh_code, wh_name, count_date, status, item_count, counted_count, created_by_name, created_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(sid, ICP, WH, "廣場區", D2, "submitted", 1, 1, "盤點員", now, now);
    await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, future_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(sid + "-1", sid, "B001", "豆薯", "30KG/件", "KG", 48, 55, 3, now);
    const html = await getPage("date=" + D2 + "&wh=" + ICP + ":" + WH);
    const row = rowOf(html, "B001");
    assert.ok(row.includes(">51<"), "當下應有＝凍結 48＋3＝51：" + row);
    assert.ok(row.includes(">59<"), "當日應有＝收盤 50＋未來收盤 9＝59：" + row);
    assert.ok(!row.includes("未來+26.8"), "不可把今天的未來單 26.8 貼到歷史列：" + row);
});

test("6. 套用實盤：delta 基準＝應有量（不把未來量寫成永久調整）", async () => {
    const body = new URLSearchParams({ action: "set_from_count", icpno: ICP, erp_code: "B001", wh_code: WH, count_date: TODAY, counted: "92", back: "date=" + TODAY });
    const res = await fetch(baseUrl + "/admin/inventory/adjustments", {
        method: "POST", redirect: "manual",
        headers: Object.assign({ "Content-Type": "application/x-www-form-urlencoded" }, cookie()),
        body: body.toString(),
    });
    assert.ok(res.status >= 300 && res.status < 400, "應 redirect 回盤點頁");
    const row = await db.prepare("SELECT delta, base_qty FROM stock_adjustment WHERE icpno = ? AND erp_code = ?").get(ICP, "B001");
    assert.ok(row, "應寫入調整");
    assert.equal(Number(row.delta), 0.8, "delta＝92 − 應有 91.2 ＝ +0.8（不是 92−64.4＝+27.6）");
    assert.equal(Number(row.base_qty), 91.2);
    await db.prepare("DELETE FROM stock_adjustment WHERE icpno = ? AND erp_code = ?").run(ICP, "B001");
});

test("7. 統計熱力圖：盤差同口徑（sys 含凍結的未來量）", async () => {
    const res = await fetch(baseUrl + "/admin/inventory/stats/heatmap?icpno=" + ICP + "&days=7", { headers: cookie() });
    const j = await res.json();
    const it = (j.items || []).find((x) => x.code === "B001");
    assert.ok(it, "熱力圖應有豆薯");
    const cell = it.cells[TODAY];
    assert.ok(cell, "應有今天的格子");
    assert.equal(cell.sys, 91.2, "sys 應為應有量 91.2（含凍結未來 26.8）");
    assert.ok(Math.abs(cell.v - 0.9) < 0.2, "盤差% 應接近 +0.9%，實得 " + cell.v);
});
