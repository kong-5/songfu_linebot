"use strict";
/**
 * Smoke test：盤差改善檢視 /inventory/stats/improvement（2026-07-21）。
 * 鎖住的行為：
 *   1. 每日整體指標（準確率／平均・加權絕對盤差%／盤差品項數）＝口徑同熱力圖
 *      （盤差 = 實盤 − 系統，分母 max(|系統|,1)；同日同料號跨倉先加總）。
 *   2. 計分卡＝以「有資料的最後一天」為錨，本週(近7天) vs 上週(前7天) 各自 pool 後算指標。
 *   3. 進步榜／待改善榜＝每品項前半段 vs 後半段平均 |盤差%|（進步＝降最多；待改善＝近期仍偏高）。
 *
 * 跑法：npm test（node --test test/）。實際 listen 隨機埠、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-improve-"));
const SECRET = "test-secret-improve";
process.env.DB_PATH = path.join(TMP, "smoke.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

// 與路由 statsTaipeiDateAgo 完全一致（台北時區、以 Date.now 為基準）
const ago = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - n * 86400000));
const D20 = ago(20); // 前半段（< mid=ago(14)）
const D10 = ago(10); // 後半段、落在上週視窗 [ago(13)..ago(7)]
const D1 = ago(1);   // 後半段、落在本週視窗 [ago(6)..ago(0)]

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}

let server;
let baseUrl;

async function seedSession(db, id, date, items) {
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO stocktake_session (id, icpno, wh_code, wh_name, count_date, status, item_count, counted_count, created_by_name, created_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, "00", "FN005", "測試倉", date, "submitted", items.length, items.length, "盤點員", now, now);
    let i = 0;
    for (const it of items) {
        await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run(id + "-" + (i++), id, it.code, it.name, "", "KG", it.sys, it.counted, now);
    }
}

test.before(async () => {
    await initDb(process.env.DB_PATH);
    const db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    // A001 逐步改善：+40% → −20% → 0%；A002 一直準
    await seedSession(db, "sd20", D20, [{ code: "A001", name: "測試豬肉", sys: 100, counted: 140 }]);
    await seedSession(db, "sd10", D10, [{ code: "A001", name: "測試豬肉", sys: 100, counted: 80 }, { code: "A002", name: "測試雞蛋", sys: 50, counted: 50 }]);
    await seedSession(db, "sd1", D1, [{ code: "A001", name: "測試豬肉", sys: 100, counted: 100 }, { code: "A002", name: "測試雞蛋", sys: 50, counted: 50 }]);
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function getImprovement() {
    const res = await fetch(baseUrl + "/admin/inventory/stats/improvement?icpno=00&days=28", {
        headers: { cookie: "sf_admin_session=" + signSession("tester") },
    });
    assert.equal(res.status, 200);
    return JSON.parse(await res.text());
}

test("1. 每日整體指標算對（口徑同熱力圖）", async () => {
    const j = await getImprovement();
    const byDate = Object.fromEntries(j.daily.map((d) => [d.date, d]));
    assert.equal(j.daily.length, 3, "應有 3 個盤點日");
    // D1：A001 0%、A002 0% → 全準
    assert.equal(byDate[D1].items, 2);
    assert.equal(byDate[D1].itemsDiff, 0);
    assert.equal(byDate[D1].accuracy, 100);
    assert.equal(byDate[D1].meanAbsPct, 0);
    assert.equal(byDate[D1].itemsSevere, 0);
    // D10：A001 −20%（嚴重）、A002 0% → 準確率 50%、平均 |盤差| 10%、加權 20/150≈13.3%
    assert.equal(byDate[D10].items, 2);
    assert.equal(byDate[D10].itemsDiff, 1);
    assert.equal(byDate[D10].accuracy, 50);
    assert.equal(byDate[D10].meanAbsPct, 10);
    assert.equal(byDate[D10].itemsSevere, 1);
    assert.equal(byDate[D10].weightedAbsPct, 13.3);
});

test("2. 計分卡：本週(近7天) vs 上週(前7天)", async () => {
    const j = await getImprovement();
    assert.equal(j.scorecard.thisWeek.accuracy, 100, "本週只含 D1（全準）");
    assert.equal(j.scorecard.thisWeek.meanAbsPct, 0);
    assert.equal(j.scorecard.thisWeek.itemsSevere, 0);
    assert.equal(j.scorecard.prevWeek.accuracy, 50, "上週只含 D10（準確率 50%）");
    assert.equal(j.scorecard.prevWeek.meanAbsPct, 10);
    assert.equal(j.scorecard.prevWeek.itemsSevere, 1);
});

test("3. 進步榜／待改善榜", async () => {
    const j = await getImprovement();
    // A001 前半段(D20)=40%、後半段(D10,D1)平均=(20+0)/2=10% → 進步榜 from 40 to 10
    assert.equal(j.improved.length, 1);
    assert.equal(j.improved[0].code, "A001");
    assert.equal(j.improved[0].from, 40);
    assert.equal(j.improved[0].to, 10);
    // A001 後半段平均 10% > 5% → 待改善榜（雖已大幅進步，但近期仍未歸零）
    assert.equal(j.watch.length, 1);
    assert.equal(j.watch[0].code, "A001");
    assert.equal(j.watch[0].recent, 10);
    // A002 一直準 → 兩榜都不列
    assert.ok(!j.improved.some((r) => r.code === "A002"));
    assert.ok(!j.watch.some((r) => r.code === "A002"));
});
