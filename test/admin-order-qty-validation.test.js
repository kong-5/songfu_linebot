"use strict";
/**
 * Smoke test：訂單品項數量驗證前移（2026-07-18，體檢優先項 4）。
 * 鎖住的行為：非法數量（空白／非數字／負數）舊版被靜默還原成舊值卻仍回 ok:true
 *（使用者看到「✓ 已儲存明細」以為改成功）。改為：
 *   1. 合法數量正常寫入、回 ok
 *   2. 非數字／負數／空白 → 400＋可自救訊息（指名品項），且 DB 完全不動
 *   3. 原子性：多品項中任一非法 → 整筆拒絕，合法的那筆也不得被寫入
 *
 * 跑法：npm test（node --test test/）。實際起 server、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-qtyval-"));
const SECRET = "test-secret-qtyval";
process.env.DB_PATH = path.join(TMP, "qty.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

function signSession(u) {
    const exp = Date.now() + 3600e3;
    const payload = Buffer.from(JSON.stringify({ u, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
let server, baseUrl, db;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "u1", name: "編輯員", passwordHash: "x:y", title: "經理", status: "active" }]));
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("c1", "客戶");
    await db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status) VALUES (?,?,?,?,?)")
        .run("o1", "N1", "c1", "2026-07-18", "pending");
    await db.prepare("INSERT INTO order_items (id, order_id, raw_name, quantity, unit) VALUES (?,?,?,?,?)")
        .run("it1", "o1", "高麗菜", 5, "公斤");
    await db.prepare("INSERT INTO order_items (id, order_id, raw_name, quantity, unit) VALUES (?,?,?,?,?)")
        .run("it2", "o1", "白蘿蔔", 3, "公斤");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((r) => (server ? server.close(r) : r())));

async function saveItems(formStr) {
    const res = await fetch(baseUrl + "/admin/orders/o1/items", {
        method: "POST", redirect: "manual",
        headers: {
            cookie: "sf_admin_session=" + signSession("u1"),
            "content-type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json",
        },
        body: formStr,
    });
    let data = null;
    const t = await res.text();
    try { data = t ? JSON.parse(t) : null; } catch (_) { /* non-json */ }
    return { status: res.status, data };
}
async function qtyOf(id) {
    const r = await db.prepare("SELECT quantity FROM order_items WHERE id = ?").get(id);
    return Number(r.quantity);
}

test("1. 合法數量正常寫入", async () => {
    const r = await saveItems("qty_it1=7&unit_it1=公斤");
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    assert.equal(await qtyOf("it1"), 7, "合法數量應寫入");
});

test("2. 非數字 → 400＋指名品項，DB 不動", async () => {
    const before = await qtyOf("it1");
    const r = await saveItems("qty_it1=abc&unit_it1=公斤");
    assert.equal(r.status, 400);
    assert.equal(r.data.ok, false);
    assert.match(r.data.error, /高麗菜/, "訊息應指名品項");
    assert.match(r.data.error, /0 或正數/, "訊息應告訴使用者怎麼改");
    assert.equal(await qtyOf("it1"), before, "非法輸入不得改動 DB（不再靜默還原成假成功）");
});

test("3. 負數 / 空白 → 400", async () => {
    const before = await qtyOf("it1");
    let r = await saveItems("qty_it1=-2&unit_it1=公斤");
    assert.equal(r.status, 400);
    assert.match(r.data.error, /負數/);
    r = await saveItems("qty_it1=&unit_it1=公斤");
    assert.equal(r.status, 400);
    assert.match(r.data.error, /未填數量/);
    assert.equal(await qtyOf("it1"), before, "DB 維持不變");
});

test("4. 原子性：一筆合法一筆非法 → 整筆拒絕，合法的也不寫入", async () => {
    const b1 = await qtyOf("it1"), b2 = await qtyOf("it2");
    const r = await saveItems("qty_it1=99&unit_it1=公斤&qty_it2=oops&unit_it2=公斤");
    assert.equal(r.status, 400);
    assert.match(r.data.error, /白蘿蔔/, "應指出非法的那筆");
    assert.equal(await qtyOf("it1"), b1, "合法的 it1 不得被半套寫入");
    assert.equal(await qtyOf("it2"), b2, "非法的 it2 維持原值");
});
