"use strict";
/**
 * Smoke test：北農行情走勢看板（2026-10-17）。
 * 鎖住的行為：
 *   1. 一品名一列：台北一／台北二中價以交易量加權合併（同歷史查詢頁口徑）。
 *   2. 30 日位置／相對低檔・高檔／走升・走跌 的判定（summarizeCropSeries 純函式）。
 *   3. 錨點日沒交易的品項不上看板；蔬菜／水果分類（N05＝水果）。
 *   4. 頁面 200、帶看板資料、不再輸出舊的「一市場一列」大表；注入的前端程式語法正確。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-market-"));
const SECRET = "test-secret-market";
process.env.DB_PATH = path.join(TMP, "smoke.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");
const { loadWholesaleTrendBoard, summarizeCropSeries } = require("../dist/lib/wholesale-trend.js");

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
const day = (i) => new Date(Date.UTC(2026, 8, 1) + i * 86400000).toISOString().slice(0, 10); // 2026-09-01 起
const N = 35;
const ANCHOR = day(N - 1);

let server, baseUrl, db;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const ins = db.prepare(`INSERT INTO wholesale_market_snapshots (id, record_date, market_name, crop_name, category, crop_code, category_code, high_price, mid_price, low_price, avg_price, volume, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    let n = 0;
    const put = (d, mkt, name, code, catCode, mid, vol) => ins.run("t" + (n++), d, mkt, name, "", code, catCode, mid + 5, mid, mid - 5, mid, vol, "x");
    for (let i = 0; i < N; i++) {
        const d = day(i);
        // 高麗菜：一路漲到最高（相對高檔＋走升）；台北二價錢不同、量小 → 驗證加權合併
        put(d, "台北一", "甘藍-初秋", "LA1", "N04", 20 + i, 9000);
        put(d, "台北二", "甘藍-初秋", "LA1", "N04", 40 + i, 1000);
        // 小白菜：一路跌到最低（相對低檔＋走跌）
        put(d, "台北一", "小白菜-土白菜", "LB1", "N04", 60 - i, 3000);
        // 香蕉：水果、持平
        put(d, "台北一", "香蕉", "A1", "N05", 30, 5000);
        // 停賣品項：錨點日沒交易，不該上看板
        if (i < N - 1) put(d, "台北一", "龍鬚菜", "SX", "N04", 50, 800);
        // 填充列：讓每天兩市場都有正常筆數（少於 20 筆的日子視為休市零星資料）
        for (let k = 0; k < 22; k++) { put(d, "台北一", "填充" + k, "Z" + k, "N04", 10, 1); put(d, "台北二", "填充" + k, "Z" + k, "N04", 10, 1); }
    }
    // 休市日：只有 2 筆零星資料，不算交易日
    put(day(N), "台北一", "甘藍-初秋", "LA1", "N04", 999, 1);
    put(day(N), "台北二", "甘藍-初秋", "LA1", "N04", 999, 1);
    // 部分公布日：只有台北二
    put(day(N + 1), "台北二", "甘藍-初秋", "LA1", "N04", 40 + N + 4, 1200);
    for (let k = 0; k < 22; k++) put(day(N + 1), "台北二", "填充" + k, "Z" + k, "N04", 10, 1);
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("summarizeCropSeries：位置、訊號、趨勢", () => {
    const up = Array.from({ length: 30 }, (_, i) => ({ date: day(i), mid: 20 + i, volume: 100 }));
    const s = summarizeCropSeries(up, day(29));
    assert.equal(s.pos30, 100);
    assert.equal(s.signal, "high");
    assert.equal(s.trend, "up");
    assert.equal(s.dayPct, Math.round((49 - 48) / 48 * 1000) / 10);
    const flat = Array.from({ length: 30 }, (_, i) => ({ date: day(i), mid: 30, volume: 100 }));
    const f = summarizeCropSeries(flat, day(29));
    assert.equal(f.pos30, null);
    assert.equal(f.signal, null);
    assert.equal(f.trend, "flat");
    // 資料太少不下訊號
    const few = summarizeCropSeries(up.slice(-5), day(29));
    assert.equal(few.signal, null);
    assert.equal(few.trend, null);
    // 錨點日沒交易 → null
    assert.equal(summarizeCropSeries(up, day(30)), null);
});

test("loadWholesaleTrendBoard：量加權合併＋分類＋近 30 交易日", async () => {
    const veg = await loadWholesaleTrendBoard(db, ANCHOR, "veg");
    assert.equal(veg.dates.length, 30);
    assert.equal(veg.partial, false);
    const names = veg.items.map((x) => x.name).filter((n) => !n.startsWith("填充"));
    assert.deepEqual(names, ["甘藍-初秋", "小白菜-土白菜"], "依量排序、水果與錨點日無交易的不在");
    const cab = veg.items[0];
    const i = N - 1;
    assert.equal(cab.mid, Math.round(((20 + i) * 9000 + (40 + i) * 1000) / 10000 * 10) / 10);
    assert.equal(cab.volume, 10000);
    assert.equal(cab.signal, "high");
    assert.equal(cab.trend, "up");
    assert.equal(cab.spark.length, 30);
    const bok = veg.items[1];
    assert.equal(bok.signal, "low");
    assert.equal(bok.trend, "down");
    assert.equal(bok.pos30, 0);
    const fruit = await loadWholesaleTrendBoard(db, ANCHOR, "fruit");
    assert.deepEqual(fruit.items.map((x) => x.name), ["香蕉"]);
    // 錨點不是有快照的日期 → 空看板（由路由先退回最近營業日）
    const none = await loadWholesaleTrendBoard(db, day(N + 3), "veg");
    assert.equal(none.items.length, 0);
});

test("loadWholesaleTrendBoard：休市零星資料不算交易日、部分市場日只用同市場比較", async () => {
    const b = await loadWholesaleTrendBoard(db, day(N + 1), "veg");
    assert.equal(b.partial, true);
    assert.deepEqual(b.markets, ["台北二"]);
    assert.ok(!b.dates.includes(day(N)), "只有 2 筆的休市日不在視窗內");
    const cab = b.items.find((x) => x.name === "甘藍-初秋");
    assert.equal(cab.mid, 40 + N + 4);
    assert.equal(cab.prevMid, 40 + N - 1, "前一日也只取台北二，不是兩市場合併價");
    assert.equal(cab.prevDate, day(N - 1));
    assert.equal(cab.volume, 1200);
    assert.equal(cab.volPct, 20, "量比也是台北二對台北二（1200 vs 1000）");
    assert.ok(!b.items.some((x) => x.name === "小白菜-土白菜"), "當日台北二沒交易的品項不上看板");
});

test("頁面：走勢看板取代舊大表，前端程式可解析", async () => {
    const res = await fetch(baseUrl + "/admin/logistics/market?date=" + ANCHOR + "&cat=veg", {
        headers: { cookie: "sf_admin_session=" + signSession("tester") },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('id="mkList"'), "有走勢清單");
    assert.ok(!html.includes('id="mktTable"'), "舊的一市場一列大表已移除");
    assert.ok(html.includes("甘藍-初秋"));
    assert.ok(html.includes("LINE 報價加價規則"), "加價規則仍保留");
    const m = html.match(/<script>(\(function marketBoardClient[\s\S]*?)<\/script>/);
    assert.ok(m, "有注入前端程式");
    assert.doesNotThrow(() => new Function(m[1]), "前端程式語法正確");
});
