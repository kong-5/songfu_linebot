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
 *   9. future_qty IS NULL（功能上線前送出）≠ 0：改用目前的未來銷貨推估並標「推估」，
 *      否則左半邊「應有＝系統」右半邊卻標「未來+68」，畫面自相矛盾。
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

test("5b. 功能上線前送出的舊列（future_qty IS NULL）：不當 0，改用目前的未來銷貨推估並標示", async () => {
    const now = new Date().toISOString();
    const sid = "stk-legacy-1";
    await db.prepare("INSERT INTO stocktake_session (id, icpno, wh_code, wh_name, count_date, status, item_count, counted_count, created_by_name, created_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(sid, ICP, WH2, "冷凍庫", TODAY, "submitted", 1, 1, "丁文順", now, now);
    // future_qty 不給值＝NULL，模擬新版上線前送出的盤點
    await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(sid + "-1", sid, "G001", "老薑", "30KG/箱", "KG", 30, 34, now);
    const html = await getPage("date=" + TODAY + "&wh=" + ICP + ":" + WH2);
    const row = rowOf(html, "G001");
    assert.ok(row.includes(">35<"), "應有＝30＋目前未來 5＝35（NULL 不可當 0）：" + row);
    assert.ok(row.includes("未來+5・推估"), "推估值要標示出來，不能看起來像凍結值：" + row);
    assert.ok(html.includes("已計入盤差（部分推估）"), "卡片 badge 要標出此單有推估列");
    // 對照：有凍結值 0 的列（新版送出、當下確實沒有未來單）不會被推估蓋掉
    const fn013 = await getPage("date=" + TODAY + "&wh=" + ICP + ":" + WH);
    const g = rowOf(fn013, "G001");
    assert.ok(!g.includes("未來+"), "FN013 的 G001 凍結值是 0（非主倉），不該被推估補上：" + g);
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
    assert.equal(cell.fut, 26.8, "格子要帶未來量供 tooltip 拆算式");
    assert.ok(!cell.fut_est, "有凍結值就不是推估");
    assert.ok(Math.abs(cell.v - 0.9) < 0.2, "盤差% 應接近 +0.9%，實得 " + cell.v);
});

test("8. 統計 ?fut=0：本頁開關關掉＝回到原始凌越量口徑（不動全域設定）", async () => {
    const res = await fetch(baseUrl + "/admin/inventory/stats/heatmap?icpno=" + ICP + "&days=7&fut=0", { headers: cookie() });
    const j = await res.json();
    const cell = (j.items || []).find((x) => x.code === "B001").cells[TODAY];
    assert.equal(cell.sys, 64.4, "關掉時 sys＝原始凌越量 64.4");
    assert.ok(!cell.fut, "關掉時不帶未來量");
    assert.ok(cell.v > 40, "關掉時盤差% 回到未修正的 +42.9% 量級，實得 " + cell.v);
    // 全域設定沒被改動：不帶 fut 參數時仍是加回後的口徑
    const back = await (await fetch(baseUrl + "/admin/inventory/stats/heatmap?icpno=" + ICP + "&days=7", { headers: cookie() })).json();
    assert.equal((back.items || []).find((x) => x.code === "B001").cells[TODAY].sys, 91.2);
});

test("9. 統計對「上線前送出（future_qty NULL）」的列也會推估，熱力圖才不會跟盤點頁對不起來", async () => {
    // 5b 建的 FN005 舊列（G001，sys 30、實盤 34、future_qty NULL）；未來量 5 → 應有 35、盤差 −1
    const res = await fetch(baseUrl + "/admin/inventory/stats/heatmap?icpno=" + ICP + "&days=7", { headers: cookie() });
    const j = await res.json();
    const cell = (j.items || []).find((x) => x.code === "G001").cells[TODAY];
    // 同日 FN013 也盤過 G001（凍結 0、sys 10、實盤 10）→ 跨倉加總 sys 40、實盤 44、
    // 該組有凍結值（FN013 那列）故不推估，未來量以凍結的 0 計
    assert.equal(cell.sys, 40, "同組有凍結值時以凍結值為準（不重複加回）");
    // 只看 FN005 這一倉時，整組都是 NULL → 推估補 5
    const wres = await fetch(baseUrl + "/admin/inventory/stats/heatmap?icpno=" + ICP + "&wh=" + WH2 + "&days=7", { headers: cookie() });
    const wj = await wres.json();
    const wcell = (wj.items || []).find((x) => x.code === "G001").cells[TODAY];
    assert.equal(wcell.sys, 35, "整組沒有凍結值 → 用目前的未來銷貨推估：30＋5＝35");
    assert.equal(wcell.fut_est, 1, "要標成推估，讓 tooltip 說得出來");
});

// ── 紅標規則（2026-07-30）：|盤差%| ≥ pct 且 |盤差量| ≥ qty，兩者都成立才標紅 ──
// 修的問題：整頁 81 項全紅沒辦法 focus。門檻改成可調，並帶「只看紅標」篩選＋異常排查表只推紅標。
const setHotRule = async (pct, qty) => {
    const res = await fetch(baseUrl + "/admin/inventory/hot-rule", {
        method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, cookie()),
        body: JSON.stringify({ pct, qty }),
    });
    assert.equal(res.status, 200);
    return await res.json();
};

test("10. 紅標規則：% 與量兩個門檻都要成立才標紅（小量品項不再整片紅）", async () => {
    const now = new Date().toISOString();
    const sid = "stk-hot-1";
    await db.prepare("INSERT INTO stocktake_session (id, icpno, wh_code, wh_name, count_date, status, item_count, counted_count, created_by_name, created_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(sid, ICP, "FN099", "紅標測試倉", TODAY, "submitted", 2, 2, "測試員", now, now);
    // TINY：帳 0.5 差 0.5 → 100%，但只差 0.5 個單位（雜訊）
    // BIG ：帳 600 差 30 → 5%，量也大（要查）
    await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, future_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(sid + "-1", sid, "TINY", "小量品", "", "KG", 0.5, 1, 0, now);
    await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, future_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(sid + "-2", sid, "BIG", "大量品", "", "KG", 600, 630, 0, now);
    // 異常排查表看的是「對最新盤差」→ 兩項也要在庫存主檔裡才有最新量可比
    for (const [c, n, q] of [["TINY", "小量品", 0.5], ["BIG", "大量品", 600]])
        await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(ICP, c, n, "", "KG", q, "FN099", now);

    await setHotRule(5, 0); // 只有 % 門檻＝舊行為：兩項都紅
    let html = await getPage("date=" + TODAY + "&wh=" + ICP + ":FN099");
    assert.ok(rowOf(html, "TINY").includes("stk-hot"), "只設 % 時小量品也會標紅（就是原本太亂的原因）");
    assert.ok(rowOf(html, "BIG").includes("stk-hot"), "大量品應標紅");

    await setHotRule(5, 1); // 加上量門檻 → 小量品被濾掉
    html = await getPage("date=" + TODAY + "&wh=" + ICP + ":FN099");
    assert.ok(!rowOf(html, "TINY").includes("stk-hot"), "差 0.5 未達量門檻 1 → 不標紅");
    assert.ok(rowOf(html, "BIG").includes("stk-hot"), "差 30 且 5% → 仍標紅");
    assert.ok(html.includes("紅標規則 ≥5% 且 ≥1"), "工具列要顯示目前規則");
    assert.ok(html.includes("紅標 1 項"), "卡片要顯示紅標數，實得：" + (html.match(/紅標 \d+ 項/g) || []).join("/"));
    assert.ok(html.includes('data-hot="1"') && html.includes('data-hot="0"'), "列要帶 data-hot 供「只看紅標」篩選");
});

test("11. 異常排查表只列紅標品項，未達門檻的會說明略過幾項", async () => {
    await setHotRule(5, 1);
    const html = await (await fetch(baseUrl + "/admin/inventory/anomalies?date=" + TODAY, { headers: cookie() })).text();
    assert.ok(html.includes(">BIG<"), "達門檻的要列出");
    assert.ok(!html.includes(">TINY<"), "未達門檻的不推給大家複查");
    assert.ok(/另有 <b>\d+<\/b> 項有盤差但未達門檻/.test(html), "要說明略過幾項，不能默默吃掉");
});

test("12. 紅標規則存進 app_settings 並留稽核軌跡", async () => {
    await setHotRule(8, 2);
    const pct = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("stocktake_hot_pct");
    const qty = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("stocktake_hot_qty");
    assert.equal(String(pct.value), "8");
    assert.equal(String(qty.value), "2");
    const bad = await fetch(baseUrl + "/admin/inventory/hot-rule", {
        method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, cookie()),
        body: JSON.stringify({ pct: -1, qty: 0 }),
    });
    assert.equal(bad.status, 400, "負數要擋下並說明怎麼修正");
    assert.match((await bad.json()).error, /0 或正數/);
    await setHotRule(5, 0); // 還原預設，不影響其他測試
});
