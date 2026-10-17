"use strict";
/**
 * Smoke test：北農行情看板「我們自己」那一半（2026-10-17）。
 * 鎖住的行為：
 *   1. 北農品名↔松富料號對照：驗證錯誤會說怎麼改、upsert 冪等（重送不多寫稽核）、刪除冪等、每筆異動都有稽核。
 *   2. 全公司共用關注：開/關冪等＋稽核。
 *   3. 批次對照頁：勾選的列一次存（同交易，任一列錯就整批不存）。
 *   4. 季節展望：拿往年同一天 vs 同一天＋28 天的均價比；去年同期價。
 *   5. 每單位公斤推算、品名建議（含常用別名）、兩年回補游標到底就停（不打網路）。
 *   6. 看板頁把對照、關注、季節資料帶進前端。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-mktmap-"));
const SECRET = "test-secret-mktmap";
process.env.DB_PATH = path.join(TMP, "smoke.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");
const trend = require("../dist/lib/wholesale-trend.js");

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
const COOKIE = () => "sf_admin_session=" + signSession("tester");
const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const add = (s, n) => new Date(new Date(s + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
const ANCHOR = iso(2026, 10, 16);

let server, baseUrl, db;

async function postJson(p, body) {
    const res = await fetch(baseUrl + p, { method: "POST", headers: { cookie: COOKIE(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
}
const auditCount = async (type) => Number((await db.prepare("SELECT COUNT(*) AS n FROM data_change_log WHERE entity_type = ?").get(type)).n);

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const ins = db.prepare(`INSERT INTO wholesale_market_snapshots (id, record_date, market_name, crop_name, category, crop_code, category_code, high_price, mid_price, low_price, avg_price, volume, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    let n = 0;
    const put = (d, name, mid) => ins.run("s" + (n++), d, "台北一", name, "", "LA1", "N04", mid + 2, mid, mid - 2, mid, 1000, new Date().toISOString());
    // 今年近 30 天：甘藍 20 元
    for (let i = 0; i < 30; i++) {
        const d = add(ANCHOR, -i);
        await put(d, "甘藍-初秋", 20);
        for (let k = 0; k < 21; k++) await put(d, "填充" + k, 10);
    }
    // 去年同期 10 元、去年 +28 天 15 元（＋50%）；前年同期 10 元、+28 天 12 元（＋20%）→ 平均 +35%
    const ly = iso(2025, 10, 16), ly2 = iso(2024, 10, 16);
    await put(ly, "甘藍-初秋", 10); await put(add(ly, 28), "甘藍-初秋", 15);
    await put(ly2, "甘藍-初秋", 10); await put(add(ly2, 28), "甘藍-初秋", 12);
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty) VALUES (?, ?, ?, ?, ?, ?)").run("00", "V001", "高麗菜", "18KG/箱", "箱", 12);
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty) VALUES (?, ?, ?, ?, ?, ?)").run("00", "V002", "高麗菜(小)", "", "顆", 3);
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty) VALUES (?, ?, ?, ?, ?, ?)").run("02", "V001", "別家公司的料號", "", "箱", 99);
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("parseKgPerUnit／suggestCrops", () => {
    assert.equal(trend.parseKgPerUnit("18KG/箱", "箱"), 18);
    assert.equal(trend.parseKgPerUnit("600g", "包"), 0.6);
    assert.equal(trend.parseKgPerUnit("10台斤", "箱"), 6);
    assert.equal(trend.parseKgPerUnit("", "KG"), 1);
    assert.equal(trend.parseKgPerUnit("1把", "把"), null);
    const crops = [{ name: "甘藍-初秋", volume: 1 }, { name: "甘藍-改良種", volume: 9 }, { name: "青江白菜-小梗", volume: 1 }];
    assert.deepEqual(trend.suggestCrops("高麗菜", crops), ["甘藍-改良種", "甘藍-初秋"], "別名＋同分看交易量");
    assert.deepEqual(trend.suggestCrops("青江菜", crops), ["青江白菜-小梗"]);
    assert.deepEqual(trend.suggestCrops("豬肉", crops), []);
    const onions = [{ name: "青蔥-粉蔥", volume: 9 }, { name: "洋蔥-本產", volume: 1 }, { name: "洋蔥-進口", volume: 1 }];
    assert.deepEqual(trend.suggestCrops("洋蔥(進口)", onions), ["洋蔥-進口", "洋蔥-本產"], "括號內當品種；洋蔥裡的「蔥」不能被別名表當成青蔥");
});

test("loadSeasonalOutlook：去年同期價＋往年接下來 4 週平均漲跌", async () => {
    const m = await trend.loadSeasonalOutlook(db, ANCHOR, "veg");
    const s = m.get("甘藍-初秋");
    assert.equal(s.lastYear, 10);
    assert.equal(s.twoYearsAgo, 10);
    assert.equal(s.years, 2);
    assert.equal(s.nextPct, 35);
});

test("backfillWholesaleDeep：游標已到兩年前就停、不打網路", async () => {
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value").run("wholesale_deep_backfill_cursor", iso(2024, 10, 1));
    const r = await trend.backfillWholesaleDeep(db, { targetDays: 730, todayIso: ANCHOR });
    assert.equal(r.done, true);
});

test("對照：錯誤訊息說怎麼改、upsert 冪等、稽核、刪除冪等", async () => {
    let r = await postJson("/admin/logistics/market/map", { crop: "甘藍-初秋", code: "NOPE" });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /找不到松富料號 NOPE.*搜尋/);
    r = await postJson("/admin/logistics/market/map", { crop: "高麗菜", code: "V001" });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /北農沒有「高麗菜」.*下拉/);
    r = await postJson("/admin/logistics/market/map", { crop: "甘藍-初秋", code: "V001", kg: "-3" });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /一箱 18 公斤就填 18/);

    r = await postJson("/admin/logistics/market/map", { crop: "甘藍-初秋", code: "V001", kg: "18" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.mappings.map((m) => [m.code, m.kg, m.qty]), [["V001", 18, 12]], "庫存取松富那一筆，不是別家公司同料號");
    assert.equal(await auditCount("market_crop_map"), 1);
    r = await postJson("/admin/logistics/market/map", { crop: "甘藍-初秋", code: "V001", kg: "18" });
    assert.equal(r.status, 200);
    assert.equal(await auditCount("market_crop_map"), 1, "重送同內容不再寫一筆");
    r = await postJson("/admin/logistics/market/map", { crop: "甘藍-初秋", code: "V002", kg: "" });
    assert.equal(r.json.mappings.length, 2);
    assert.equal(r.json.mappings.find((m) => m.code === "V002").kg, null, "公斤留白＝不換算");

    r = await postJson("/admin/logistics/market/map/delete", { code: "V002" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.mappings.map((m) => m.code), ["V001"]);
    const before = await auditCount("market_crop_map");
    r = await postJson("/admin/logistics/market/map/delete", { code: "V002" });
    assert.equal(r.status, 200);
    assert.equal(await auditCount("market_crop_map"), before, "刪不存在的對照＝無事");
    const log = await db.prepare("SELECT meta_json, actor_username FROM data_change_log WHERE entity_type = 'market_crop_map' AND action = 'delete'").get();
    assert.equal(JSON.parse(log.meta_json).old.crop, "甘藍-初秋");
    assert.equal(log.actor_username, "tester");
});

test("共用關注：開關冪等＋稽核", async () => {
    let r = await postJson("/admin/logistics/market/watch", { crop: "甘藍-初秋", on: true });
    assert.equal(r.status, 200);
    await postJson("/admin/logistics/market/watch", { crop: "甘藍-初秋", on: true });
    assert.equal(await auditCount("market_watch"), 1);
    const rows = await db.prepare("SELECT crop_name FROM market_watch").all();
    assert.deepEqual(rows.map((x) => x.crop_name), ["甘藍-初秋"]);
    r = await postJson("/admin/logistics/market/watch", { crop: "", on: true });
    assert.equal(r.status, 400);
});

test("批次對照：任一列錯就整批不存", async () => {
    const form = (o) => new URLSearchParams(o).toString();
    const send = (o) => fetch(baseUrl + "/admin/logistics/market/mapping", {
        method: "POST", redirect: "manual",
        headers: { cookie: COOKIE(), "Content-Type": "application/x-www-form-urlencoded" }, body: form(o),
    });
    let res = await send({ pick: "0", code_0: "V002", crop_0: "甘藍-初秋", kg_0: "abc" });
    assert.match(decodeURIComponent(res.headers.get("location")), /V002.*每單位公斤數/);
    const body = new URLSearchParams();
    body.append("pick", "0"); body.append("pick", "1");
    body.append("code_0", "V002"); body.append("crop_0", "甘藍-初秋"); body.append("kg_0", "");
    body.append("code_1", "V001"); body.append("crop_1", "打錯的品名"); body.append("kg_1", "18");
    res = await fetch(baseUrl + "/admin/logistics/market/mapping", { method: "POST", redirect: "manual", headers: { cookie: COOKIE(), "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    assert.match(decodeURIComponent(res.headers.get("location")), /全部沒有存入.*打錯的品名/);
    const v2 = await db.prepare("SELECT 1 AS x FROM market_crop_map WHERE erp_code = 'V002'").get();
    assert.ok(!v2, "同交易：第一列也沒存進去");
    res = await send({ pick: "0", code_0: "V002", crop_0: "甘藍-初秋", kg_0: "" });
    assert.match(decodeURIComponent(res.headers.get("location")), /已儲存 1 筆/);
    const page = await fetch(baseUrl + "/admin/logistics/market/mapping", { headers: { cookie: COOKIE() } });
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes("高麗菜"));
});

test("看板頁帶入對照／關注／季節", async () => {
    const res = await fetch(baseUrl + "/admin/logistics/market?date=" + ANCHOR, { headers: { cookie: COOKIE() } });
    assert.equal(res.status, 200);
    const html = await res.text();
    const m = html.match(/<script>\(function marketBoardClient[\s\S]*?\}\)\((\{[\s\S]*?\})\);<\/script>/);
    assert.ok(m, "有注入資料");
    const data = JSON.parse(m[1]);
    assert.deepEqual(data.watch, ["甘藍-初秋"]);
    assert.ok(data.maps["甘藍-初秋"].some((x) => x.code === "V001" && x.kg === 18));
    const cab = data.items.find((x) => x.name === "甘藍-初秋");
    assert.equal(cab.lastYear, 10);
    assert.equal(cab.seasonPct, 35);
    assert.ok(html.includes("對照我們的貨品（已對 2 項）"));
});
