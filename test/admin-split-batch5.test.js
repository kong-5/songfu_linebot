"use strict";
/**
 * Smoke test：拆檔批次 5（訂單／訂單明細／客訴三域自 admin/index.js 拆出）。
 * 這批與前幾批不同：訂單路由在原檔是**不連續的**（中間夾凌越機器端點/匯出備份/AI 設定），
 * 一次註冊會改變 router 註冊順序 → 本測試除了「路由都在、頁面能開」，還鎖住
 * **順序敏感的比對結果**：批次路徑（/orders/batch-*）不可被 /orders/:orderId 吃掉。
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-split5-"));
const SECRET = "test-secret-split5";
process.env.DB_PATH = path.join(TMP, "split5.db");
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
let server, baseUrl, db, todayOrderNo;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "ops", name: "測試經理", passwordHash: "x:y", title: "經理", status: "active" }]));
    await db.prepare("INSERT INTO customers (id, name, active) VALUES (?, ?, 1)").run("cust-s5", "批次五客戶");
    // ⚠ 用「台北今天」而非寫死日期：/orders 列表預設只顯示當日，寫死日期會在換日後突然變紅
    // （本測試在 2026-07-28 就這樣紅過一次，且 lint/test 是部署硬閘門 → 會擋住所有部署）。
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
    todayOrderNo = today.replace(/-/g, "") + "001";
    await db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status, raw_message) VALUES (?, ?, ?, ?, ?, ?)")
        .run("ord-s5", today.replace(/-/g, "") + "001", "cust-s5", today, "pending", "測試訂單原文");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function get(p) {
    const res = await fetch(baseUrl + p, { redirect: "manual", headers: { cookie: "sf_admin_session=" + signSession("ops") } });
    return { status: res.status, text: await res.text() };
}

test("三個拆出模組都有匯出 registerXxxRoutes", () => {
    assert.equal(typeof require("../dist/admin/orders.js").registerOrdersRoutes, "function");
    assert.equal(typeof require("../dist/admin/order-detail.js").registerOrderDetailRoutes, "function");
    assert.equal(typeof require("../dist/admin/complaints.js").registerComplaintsRoutes, "function");
});

test("訂單域：/orders 列表帶出訂單、/orders/:orderId 明細可開", async () => {
    const list = await get("/admin/orders");
    assert.equal(list.status, 200);
    assert.ok(list.text.includes("批次五客戶"), "訂單列表應帶出測試訂單的客戶");
    const detail = await get("/admin/orders/ord-s5");
    assert.equal(detail.status, 200);
    assert.ok(detail.text.includes(todayOrderNo), "明細頁應帶出訂單編號");
});

test("順序敏感：/orders/batch-* 不可被 /orders/:orderId 吃掉（hoist 後仍成立）", async () => {
    // 兩條批次路由不帶 ids 時，各自的 handler 本來就回 400「請先勾選訂單」（非拆檔造成）；
    // 若註冊順序壞掉會落進 /orders/:orderId 而回「找不到訂單」的明細頁 —— 用回應內容分辨命中的是誰。
    for (const p of ["/admin/orders/batch-order-sheet", "/admin/orders/batch-lingyue-xlsx"]) {
        const r = await get(p);
        assert.ok(!r.text.includes("找不到訂單"), p + " 不可被 :orderId 路由攔截");
        assert.ok(r.status === 200 || r.status === 400, p + " 應由批次 handler 回應（200 或參數不足的 400），實得 " + r.status);
    }
});

test("訂單子路徑：items/add 與 order-sheet 仍各自命中（非落到明細頁）", async () => {
    const add = await get("/admin/orders/ord-s5/items/add");
    assert.equal(add.status, 200);
    const sheet = await get("/admin/orders/ord-s5/order-sheet");
    assert.equal(sheet.status, 200);
    assert.ok(sheet.text.includes("訂貨單") || sheet.text.includes("揀貨"), "order-sheet 應回訂貨單頁");
});

test("客訴域：/complaints 列表、/complaints/new 表單可開", async () => {
    const list = await get("/admin/complaints");
    assert.equal(list.status, 200);
    const form = await get("/admin/complaints/new");
    assert.equal(form.status, 200);
});

test("留在 index.js 的鄰接路由不受影響（/export、/backup、/gemini-prompts、/ai-examples、/barcode）", async () => {
    for (const p of ["/admin/export", "/admin/backup", "/admin/gemini-prompts", "/admin/ai-examples"]) {
        const r = await get(p);
        assert.equal(r.status, 200, p + " 應回 200");
    }
    // /barcode 不帶 code 本來就回 400（參數驗證），帶了才產條碼圖
    const noCode = await get("/admin/barcode");
    assert.equal(noCode.status, 400);
    const withCode = await get("/admin/barcode?code=" + todayOrderNo);
    assert.equal(withCode.status, 200, "/admin/barcode?code= 應產出條碼");
});
