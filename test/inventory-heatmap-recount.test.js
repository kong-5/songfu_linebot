"use strict";
/**
 * Smoke test：複盤修正 → 熱力圖即時反映 ＋ 每日盤點「各倉盤點結果」凍結表頭（2026-07-20）。
 * 鎖住的行為：
 *   1. 熱力圖 /inventory/stats/heatmap 直接讀 stocktake_count，複盤修正（count-edit）後
 *      重新查詢就要拿到新實盤與新盤差%（不用等結算、不用重新盤點）。
 *   2. 複盤修正要寫 stocktake_count_audit 修改軌跡（舊值/新值/修改人）。
 *   3. 熱力圖盤差%含庫存調整（statsAdjMap）：掛 delta 後 cell 要帶 adj/sys_adj。
 *   4. 每日盤點頁表格外層必須是 .stk-tblwrap 垂直捲動容器（sticky 表頭只在最近的捲動容器內
 *      生效；舊版只有 overflow-x:auto，表頭凍不住），且 border-collapse 用 separate、
 *      並附 stkStickyFix 校正第二列表頭 top。
 *
 * 跑法：npm test（node --test test/）。實際 listen 隨機埠、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-heatmap-"));
const SECRET = "test-secret-heatmap";
process.env.DB_PATH = path.join(TMP, "smoke.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}

let server;
let baseUrl;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    const db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO stocktake_session (id, icpno, wh_code, wh_name, count_date, status, item_count, counted_count, created_by_name, created_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run("s1", "00", "FN005", "測試倉", TODAY, "submitted", 1, 1, "盤點員", now, now);
    await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run("sc1", "s1", "A001", "測試豬肉", "18KG/箱", "KG", 100, 90, now);
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function request(p, opts = {}) {
    const res = await fetch(baseUrl + p, {
        redirect: "manual",
        ...opts,
        headers: { cookie: "sf_admin_session=" + signSession("tester"), ...(opts.headers || {}) },
    });
    const text = await res.text();
    return { status: res.status, location: res.headers.get("location"), text };
}

async function fetchHeatmapItem(code) {
    const r = await request("/admin/inventory/stats/heatmap?icpno=00&days=7");
    assert.equal(r.status, 200);
    const j = JSON.parse(r.text);
    return (j.items || []).find((it) => it.code === code) || null;
}

test("1. 熱力圖：修正前後即時反映（同一料號同一天的實盤與盤差%）", async () => {
    let it = await fetchHeatmapItem("A001");
    assert.ok(it, "熱力圖應列出已盤品項 A001");
    assert.equal(it.cells[TODAY].counted, 90, "修正前實盤 90");
    assert.equal(it.cells[TODAY].v, -10, "修正前盤差% = (90-100)/100 = -10%");

    // 複盤修正：實盤 90 → 100（走真端點，與每日盤點頁點數字原地改同一條路）
    const r = await request("/admin/inventory/count-edit", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "session_id=s1&erp_code=A001&counted=100",
    });
    assert.equal(r.status, 302, "複盤修正應重導回每日盤點頁");
    assert.ok(r.location && r.location.includes("cok=1"), "重導應帶成功旗標");

    it = await fetchHeatmapItem("A001");
    assert.ok(it, "修正後品項仍在熱力圖（端點不濾零盤差）");
    assert.equal(it.cells[TODAY].counted, 100, "修正後實盤要立即變 100");
    assert.equal(it.cells[TODAY].v, 0, "修正後盤差% 歸零");
    assert.equal(it.cells[TODAY].sys, 100, "系統量是盤點凍結快照，不因複盤改動");
});

test("2. 複盤修正要留修改軌跡（舊值/新值/修改人）", async () => {
    const db = getDb(process.env.DB_PATH);
    const rows = await db.prepare("SELECT * FROM stocktake_count_audit WHERE session_id = 's1' AND erp_code = 'A001'").all();
    assert.equal(rows.length, 1, "應有一筆修改軌跡");
    assert.equal(Number(rows[0].old_counted), 90);
    assert.equal(Number(rows[0].new_counted), 100);
    assert.equal(rows[0].actor_name, "測試員");
});

test("3. 熱力圖盤差%含庫存調整（掛 delta 後 cell 帶 adj/sys_adj）", async () => {
    const db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO stock_adjustment (icpno, erp_code, delta, name, created_at, updated_at) VALUES ('00', 'A001', 5, '測試豬肉', ?, ?)")
        .run(new Date().toISOString(), new Date().toISOString());
    const it = await fetchHeatmapItem("A001");
    assert.equal(it.cells[TODAY].adj, 5, "cell 應帶調整值");
    assert.equal(it.cells[TODAY].sys_adj, 105, "校正後系統 = 凍結快照 100 + 調整 5");
    assert.equal(it.cells[TODAY].v, -4.8, "盤差% 改以校正後系統為分母：(100-105)/105 ≈ -4.8%");
});

test("4. 每日盤點頁：各倉盤點結果表格有凍結表頭結構", async () => {
    const r = await request("/admin/inventory?date=" + TODAY + "&wh=00:FN005");
    assert.equal(r.status, 200);
    assert.ok(r.text.includes('class="stk-tblwrap"'), "表格外層應是 .stk-tblwrap 垂直捲動容器");
    assert.match(r.text, /\.stk-tblwrap\{[^}]*overflow:auto/, "容器要能垂直捲動（overflow:auto）");
    assert.match(r.text, /\.stk-tblwrap\{[^}]*max-height/, "容器要有高度上限，sticky 才會生效");
    assert.match(r.text, /\.stk-tbl\{[^}]*border-collapse:separate/, "collapse 模式下 sticky 表頭框線會脫落，必須 separate");
    assert.match(r.text, /\.stk-tbl\{[^}]*overflow:visible/, "必須蓋掉全域 table{overflow:hidden}（它會讓 table 自己變成 sticky 容器、表頭凍不住）");
    assert.match(r.text, /\.stk-tbl th\{[^}]*position:sticky/, "表頭要 sticky");
    assert.ok(r.text.includes("stkStickyFix"), "要有第二列表頭 top 校正的 JS");
    assert.ok(r.text.includes("測試豬肉"), "頁面應列出已盤品項");
});
