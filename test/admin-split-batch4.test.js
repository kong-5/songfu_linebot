"use strict";
/**
 * Smoke test：拆檔批次 4（logistics / customers / products / broadcast 自 admin/index.js 拆出）。
 * 鎖住「move-only、行為零變更」：
 *   1. 四個域的代表路由在拆檔後仍存在且可回應（實際起 server、帶合法 session 打真路由）
 *   2. 頁面回 200 且帶出各域的關鍵內容（不是空殼或 500）
 *   3. registerXxxRoutes 匯出存在（防止 index.js 忘了掛）
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-split4-"));
const SECRET = "test-secret-split4";
process.env.DB_PATH = path.join(TMP, "split4.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
let server, baseUrl, db;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "boss", name: "測試經理", passwordHash: "x:y", title: "經理", status: "active" }]));
    await db.prepare("INSERT INTO customers (id, name, active) VALUES (?, ?, 1)").run("cust-s4", "拆檔測試客戶");
    await db.prepare("INSERT INTO products (id, name, unit, active) VALUES (?, ?, ?, 1)").run("prod-s4", "拆檔測試品項", "KG");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function get(p) {
    const res = await fetch(baseUrl + p, {
        redirect: "manual",
        headers: { cookie: "sf_admin_session=" + signSession("boss") },
    });
    return { status: res.status, headers: { location: res.headers.get("location") }, text: await res.text() };
}

test("四個拆出模組都有匯出 registerXxxRoutes", () => {
    assert.equal(typeof require("../dist/admin/logistics.js").registerLogisticsRoutes, "function");
    assert.equal(typeof require("../dist/admin/customers.js").registerCustomersRoutes, "function");
    assert.equal(typeof require("../dist/admin/products.js").registerProductsRoutes, "function");
    assert.equal(typeof require("../dist/admin/broadcast.js").registerBroadcastRoutes, "function");
});

test("物流域：/logistics/orders（設計上 302 轉跳 /admin/orders）與 /logistics/market 拆檔後仍可用", async () => {
    const orders = await get("/admin/logistics/orders");
    assert.equal(orders.status, 302);
    assert.ok(String(orders.headers.location || "").startsWith("/admin/orders"), "應轉跳 /admin/orders");
    const market = await get("/admin/logistics/market");
    assert.equal(market.status, 200);
});

test("客戶域：/customers 列表帶出客戶、/customers/new 表單存在", async () => {
    const list = await get("/admin/customers");
    assert.equal(list.status, 200);
    assert.ok(list.text.includes("拆檔測試客戶"), "客戶列表應包含測試客戶");
    const form = await get("/admin/customers/new");
    assert.equal(form.status, 200);
});

test("貨品域：/products 列表帶出品項、/products/reconcile 比對頁可開", async () => {
    const list = await get("/admin/products");
    assert.equal(list.status, 200);
    assert.ok(list.text.includes("拆檔測試品項"), "貨品列表應包含測試品項");
    const recon = await get("/admin/products/reconcile");
    assert.equal(recon.status, 200);
});

test("群發域：/broadcast 列表（經理限定）拆檔後仍可用", async () => {
    const bc = await get("/admin/broadcast");
    assert.equal(bc.status, 200);
});

test("留在 index.js 的鄰接路由不受拆檔影響（/freezer-fridge、/announcements、/import）", async () => {
    for (const p of ["/admin/freezer-fridge", "/admin/announcements", "/admin/import"]) {
        const r = await get(p);
        assert.equal(r.status, 200, p + " 應回 200");
    }
});
