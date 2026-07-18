"use strict";
/**
 * Smoke test：後台「?err= 錯誤訊息顯示層」（2026-07-18 修正）。
 * 鎖住的行為：POST 端守衛把完整中文訊息放在 ?err= 重導回 GET 頁，GET 頁必須顯示出來——
 * 舊版三個頁面只認固定 err 代碼，其他訊息被靜默吞掉（伺服器有擋、使用者無感）：
 *   1. 訂單明細頁：approve 守衛（作廢/客訴單）與 set-date 的訊息要顯示；既有代碼（err=product）不退化
 *   2. 客戶新增頁：完全沒渲染 err → 群組重複綁定訊息要顯示
 *   3. 客戶編輯頁：editMsg 只認 alias/dup → 群組重複/name 也要顯示
 *   4. 未知 err 一律原文顯示，但必須 HTML 轉義（防 ?err= 夾帶 script 的反射 XSS）
 *   5. 端到端：對作廢單 POST approve → 302 帶 err → GET 後訊息可見
 *
 * 跑法：npm test（node --test test/）。實際 listen 隨機埠、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-errdisp-"));
const SECRET = "test-secret-errdisp";
// 必須在 require dist/admin 之前設好：dbPath 與 session 祕密都是模組載入/首次使用時讀取
process.env.DB_PATH = path.join(TMP, "smoke.db");
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

let server;
let baseUrl;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    const db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("c1", "測試客戶");
    await db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status) VALUES (?, ?, ?, ?, ?)")
        .run("o1", "T0001", "c1", "2026-07-18", "deleted");
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
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
}

test("1. 訂單明細頁：未知 err 原文顯示、既有代碼不退化", async () => {
    const guardMsg = "此訂單已作廢，請先『取消作廢』再確認";
    let r = await request("/admin/orders/o1?err=" + encodeURIComponent(guardMsg));
    assert.equal(r.status, 200);
    assert.ok(r.text.includes(guardMsg), "approve 守衛訊息應顯示在頁面上");
    r = await request("/admin/orders/o1?err=product");
    assert.ok(r.text.includes("請選擇有效品項"), "既有代碼 err=product 應照舊顯示");
    assert.ok(!r.text.includes(">product<"), "已知代碼不應被當一般訊息原文輸出");
    r = await request("/admin/orders/o1?ok=date_saved");
    assert.ok(r.text.includes("已更新出貨日期"), "ok=date_saved 應顯示成功訊息");
});

test("2. 客戶新增頁：err 訊息應顯示", async () => {
    const msg = "此 LINE 群組已綁定客戶「測試客戶」，不能重複綁定";
    let r = await request("/admin/customers/new?err=" + encodeURIComponent(msg));
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("此 LINE 群組已綁定客戶"), "群組重複綁定訊息應顯示");
    r = await request("/admin/customers/new?err=name");
    assert.ok(r.text.includes("請填寫客戶名稱後再送出"), "err=name 應轉成可行動訊息");
});

test("3. 客戶編輯頁：未知 err 原文顯示、alias/dup 不退化", async () => {
    const msg = "此 LINE 群組已綁定客戶「別家」，不能重複綁定（會造成叫貨歸屬錯亂）。請先解除該客戶的群組綁定。";
    let r = await request("/admin/customers/c1/edit?err=" + encodeURIComponent(msg));
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("請先解除該客戶的群組綁定"), "群組重複綁定訊息應顯示");
    r = await request("/admin/customers/c1/edit?err=dup");
    assert.ok(r.text.includes("此客戶已存在相同別名"), "既有代碼 err=dup 應照舊顯示");
    r = await request("/admin/customers/c1/edit?err=name");
    assert.ok(r.text.includes("請填寫客戶名稱後再送出"), "err=name 應轉成可行動訊息");
});

test("4. XSS：?err= 夾帶 script 必須被轉義", async () => {
    const evil = "<script>alert(1)</script>";
    for (const p of ["/admin/orders/o1", "/admin/customers/new", "/admin/customers/c1/edit"]) {
        const r = await request(p + "?err=" + encodeURIComponent(evil));
        assert.ok(!r.text.includes(evil), p + " 不得原樣輸出 script 標籤");
        assert.ok(r.text.includes("&lt;script&gt;"), p + " 應輸出轉義後文字");
    }
});

test("5. 端到端：作廢單按確認 → 302 帶訊息 → 頁面看得到", async () => {
    const r1 = await request("/admin/orders/o1/approve", { method: "POST" });
    assert.equal(r1.status, 302, "作廢單 approve 應被守衛擋下重導");
    assert.ok(r1.location && r1.location.includes("err="), "重導應帶 err 訊息");
    const r2 = await request(r1.location.replace(/^https?:\/\/[^/]+/, ""));
    assert.equal(r2.status, 200);
    assert.ok(r2.text.includes("取消作廢"), "守衛訊息應在明細頁顯示");
    // 確認守衛真的沒把單復活
    const db = getDb(process.env.DB_PATH);
    const row = await db.prepare("SELECT status FROM orders WHERE id = 'o1'").get();
    assert.equal(row.status, "deleted", "作廢單不得被 approve 復活");
});
