"use strict";
/**
 * Smoke test：盤點結果圖（2026-08-03）。
 *
 * 需求脈絡：盤點完要把結果貼到 LINE 群組，但**推播到群組是按群組人數計則數**
 * （8 人群組推一次＝8 則），每天每倉推一次很快吃掉方案額度。
 * 改成「產一張 JPG → 盤點的人自己傳」＝零則數。
 *
 * 鎖住的行為：
 *   1. 資料層用「盤點送出當下」的凍結值（sys_qty/future_qty/counted_qty），不是「最新系統」欄——
 *      圖是當下的憑證，隔天重下載數字不該變。
 *   2. 紅標判定與每日盤點頁共用 lib/stocktake-hot-rule.js（同一份門檻設定）。
 *   3. 端點回真的 JPEG，且帶 X-Report-Pages（品項多會分頁，前端要靠它抓第幾張）。
 *   4. 該倉該日沒盤點 → 404（不是回一張空圖讓人誤傳到群組）。
 *   5. 複盤改過實盤數 → 重新產圖會反映新值（即時重算、不存檔）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-report-"));
const SECRET = "test-secret-report";
process.env.DB_PATH = path.join(TMP, "smoke.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");
const { submitStocktake } = require("../dist/lib/stocktake-api.js");
const { loadStocktakeReport } = require("../dist/lib/stocktake-report.js");

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const ICP = "00";
const WH = "FN005";

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
let server, baseUrl, db;
const cookie = () => ({ cookie: "sf_admin_session=" + signSession("tester") });

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO erp_warehouse (icpno, code, name, include_stocktake, sort_order) VALUES (?, ?, ?, 1, 0)").run(ICP, WH, "冷凍庫房");
    // A001 帳 100 → 實盤 100（無盤差）；A002 帳 50 → 實盤 40（-10＝-20%，紅標）
    for (const [code, name, qty] of [["A001", "豬五花肉", 100], ["A002", "雞胸肉", 50]]) {
        await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(ICP, code, name, "18KG/箱", "KG", qty, WH, now);
        await db.prepare("INSERT INTO erp_stock_wh_qty (icpno, wh_code, erp_code, qty, updated_at) VALUES (?, ?, ?, ?, ?)").run(ICP, WH, code, qty, now);
    }
    await submitStocktake(db, {
        icpno: ICP, whCode: WH, date: TODAY,
        // sys＝送出當下的凍結系統量（前端從 items 帶回來），counted＝實盤
        counts: [
            { code: "A001", name: "豬五花肉", spec: "18KG/箱", unit: "KG", sys: 100, counted: 100 },
            { code: "A002", name: "雞胸肉", spec: "18KG/箱", unit: "KG", sys: 50, counted: 40 },
        ],
        createdBy: "U1", createdByName: "阮氏梅",
    });
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("1. 資料層：用盤點當下的凍結值算盤差，紅標吃共用規則", async () => {
    const r = await loadStocktakeReport(db, { icpno: ICP, whCode: WH, date: TODAY });
    assert.ok(r, "當日該倉有盤點就要回資料");
    assert.equal(r.companyName, "松富");
    assert.equal(r.whName, "冷凍庫房");
    assert.equal(r.countedBy, "阮氏梅");
    const a1 = r.items.find((x) => x.code === "A001");
    const a2 = r.items.find((x) => x.code === "A002");
    assert.equal(a1.sys, 100);
    assert.equal(a1.counted, 100);
    assert.equal(a1.diff, 0);
    assert.equal(a1.hot, false, "沒盤差不該紅標");
    assert.equal(a2.diff, -10, "盤差＝實盤−應有");
    assert.equal(a2.hot, true, "-10/50＝-20%，超過預設 5% 門檻");
});

test("2. 紅標門檻改大 → 同一筆就不再是紅標（與每日盤點頁共用設定）", async () => {
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("stocktake_hot_qty", "999");
    const r = await loadStocktakeReport(db, { icpno: ICP, whCode: WH, date: TODAY });
    assert.equal(r.items.find((x) => x.code === "A002").hot, false, "量門檻 999 → 差 10 不算紅標");
    await db.prepare("DELETE FROM app_settings WHERE key = ?").run("stocktake_hot_qty");
});

test("3. 端點回真的 JPEG，並帶 X-Report-Pages", async () => {
    const res = await fetch(`${baseUrl}/admin/inventory/report.jpg?icpno=${ICP}&wh=${WH}&date=${TODAY}`, { headers: cookie() });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");
    assert.equal(res.headers.get("x-report-pages"), "1");
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 5000, "圖不該是空的，實際 " + buf.length + " bytes");
    assert.equal(buf[0], 0xff, "JPEG magic");
    assert.equal(buf[1], 0xd8, "JPEG magic");
});

test("4. 沒盤點的倉／日期回 404，不給空圖誤傳到群組", async () => {
    const res = await fetch(`${baseUrl}/admin/inventory/report.jpg?icpno=${ICP}&wh=${WH}&date=2020-01-01`, { headers: cookie() });
    assert.equal(res.status, 404);
    assert.equal(await loadStocktakeReport(db, { icpno: ICP, whCode: "NOPE", date: TODAY }), null);
});

test("5. 每日盤點頁的倉庫卡片有「結果圖」入口（忘了傳可以回來重下載）", async () => {
    const res = await fetch(`${baseUrl}/admin/inventory?date=${TODAY}`, { headers: cookie() });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, new RegExp(`/admin/inventory/report\\.jpg\\?icpno=${ICP}&wh=${WH}&date=${TODAY}`), "卡片要有結果圖連結");
});

test("6. 掃碼盤點頁（松揚）也取得到結果圖：/admin/scan/report.jpg", async () => {
    const res = await fetch(`${baseUrl}/admin/scan/report.jpg?icpno=${ICP}&warehouse=${WH}&date=${TODAY}`, { headers: cookie() });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");
});

test("7. 長期無貨（帳 0、現場也 0、近 60 天快照都沒量）標 idle，結果圖才不會被塞爆", async () => {
    const s = await db.prepare("SELECT id FROM stocktake_session WHERE count_date = ? AND wh_code = ?").get(TODAY, WH);
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run("stkc-idle", s.id, "A003", "停用品", "", "KG", 0, 0, now);
    // 沒有任何每日快照時：無從判定 → 一律不標 idle（寧可圖長也不默默吃掉品項）
    let r = await loadStocktakeReport(db, { icpno: ICP, whCode: WH, date: TODAY });
    assert.equal(r.items.find((x) => x.code === "A003").idle, false, "沒快照就不該判定 idle");
    // 有快照後：A001 有量→不 idle；A003 快照都是 0 且帳 0 現場 0 → idle
    for (const [code, qty] of [["A001", 100], ["A002", 50], ["A003", 0]])
        await db.prepare("INSERT INTO erp_stock_daily (icpno, erp_code, snap_date, qty, updated_at) VALUES (?, ?, ?, ?, ?)").run(ICP, code, TODAY, qty, now);
    r = await loadStocktakeReport(db, { icpno: ICP, whCode: WH, date: TODAY });
    assert.equal(r.items.find((x) => x.code === "A003").idle, true, "帳 0、現場 0、快照也 0 → 長期無貨");
    assert.equal(r.items.find((x) => x.code === "A001").idle, false, "有庫存的品項不可被藏起來");
    // 關閉開關（設 0 天）→ 回到全部照列
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("stocktake_report_idle_days", "0");
    r = await loadStocktakeReport(db, { icpno: ICP, whCode: WH, date: TODAY });
    assert.equal(r.items.find((x) => x.code === "A003").idle, false, "設 0 天＝關閉過濾");
    await db.prepare("DELETE FROM app_settings WHERE key = ?").run("stocktake_report_idle_days");
    await db.prepare("DELETE FROM stocktake_count WHERE id = ?").run("stkc-idle");
});

test("8. 複盤改過實盤數 → 重新產圖是最新值（即時重算不存檔）", async () => {
    const s = await db.prepare("SELECT id FROM stocktake_session WHERE count_date = ? AND wh_code = ?").get(TODAY, WH);
    await db.prepare("UPDATE stocktake_count SET counted_qty = ? WHERE session_id = ? AND erp_code = ?").run(48, s.id, "A002");
    const r = await loadStocktakeReport(db, { icpno: ICP, whCode: WH, date: TODAY });
    const a2 = r.items.find((x) => x.code === "A002");
    assert.equal(a2.counted, 48);
    assert.equal(a2.diff, -2, "盤差跟著複盤後的實盤數走");
});
