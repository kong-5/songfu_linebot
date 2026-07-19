"use strict";
/**
 * Smoke test：記住上次選的公司、跨庫存頁沿用（2026-07-19，UX C）。
 * 鎖住：
 *   1. 帶 ?icpno＝明確選公司 → 回應寫 sf_icpno cookie 記住
 *   2. 沒帶 ?icpno 但有 cookie → 沿用 cookie 的公司（顯示該公司資料，非該頁預設）
 *   3. 沒帶也沒 cookie → 用該頁預設（不寫 cookie）
 *
 * 跑法：npm test。實際起 server 打真路由（庫存調整頁列出該公司的調整）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-sticky-"));
const SECRET = "test-secret-sticky";
process.env.DB_PATH = path.join(TMP, "s.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

function sess(u) {
    const exp = Date.now() + 3600e3;
    const p = Buffer.from(JSON.stringify({ u, exp })).toString("base64url");
    const s = crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
    return p + "." + s;
}
let server, baseUrl;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    const db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "u", name: "管理員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const now = new Date().toISOString();
    // 只有公司 03（松成）有一筆調整、料號 Z999COMP03；用來分辨頁面到底顯示了哪家公司
    await db.prepare("INSERT INTO stock_adjustment (icpno, erp_code, delta, name, spec, unit, base_qty, counted_qty, note, created_by, created_by_name, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run("03", "Z999COMP03", 5, "松成專屬品", "", "箱", 0, 5, null, "admin:u", "管理員", now, now);
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((r) => (server ? server.close(r) : r())));

async function get(qs, cookieExtra) {
    const res = await fetch(baseUrl + "/admin/inventory/adjustments" + qs, {
        redirect: "manual",
        headers: { cookie: "sf_admin_session=" + sess("u") + (cookieExtra ? "; " + cookieExtra : "") },
    });
    return { status: res.status, setCookie: res.headers.get("set-cookie") || "", html: await res.text() };
}

test("1. 帶 ?icpno=03 → 寫 sf_icpno cookie，且顯示 03 的調整", async () => {
    const r = await get("?icpno=03");
    assert.equal(r.status, 200);
    assert.match(r.setCookie, /sf_icpno=03/, "應把選的公司寫進 cookie 記住");
    assert.ok(r.html.includes("Z999COMP03"), "應顯示公司 03 的調整");
});

test("2. 沒帶 ?icpno 但 cookie=03 → 沿用 03（非預設 02）", async () => {
    const r = await get("", "sf_icpno=03");
    assert.equal(r.status, 200);
    assert.ok(r.html.includes("Z999COMP03"), "沒帶 icpno 時應沿用上次選的公司 03");
});

test("3. 沒帶 ?icpno 也沒 cookie → 用該頁預設 02（看不到 03 的資料）", async () => {
    const r = await get("");
    assert.equal(r.status, 200);
    assert.ok(!r.html.includes("Z999COMP03"), "預設 02 不應顯示 03 的調整");
    assert.ok(!/set-cookie/i.test(r.setCookie) || !/sf_icpno=/.test(r.setCookie), "無明確選公司時不主動改寫記憶");
});
