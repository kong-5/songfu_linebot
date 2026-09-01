"use strict";
/**
 * Smoke test：訂單明細寫入路徑的三鐵律（2026-09-01 體檢）。
 *
 * 體檢發現 POST /orders/:id/items（後台改單最常用的路徑）是「逐項 UPDATE、無交易、
 * 零稽核」——中途失敗＝半套改好半套沒改，而且出貨數量對不上時完全查不到誰改的。
 * POST /orders/:id/items/add 則是表單重送就多一列品項。
 *
 * 鎖住：
 *   1. 改明細會寫 data_change_log，且 meta 帶得出「哪一項、舊值→新值」
 *   2. 只記真的有變的欄位（每次按儲存都塞整包 before/after 會讓事後查帳找不到重點）
 *   3. 沒有任何變動時不留空紀錄
 *   4. 稽核與主寫入同交易（稽核寫不進去 → 明細不得被改掉）
 *   5. items/add 一次性 token：重送不會多一列（但「刻意再加一次」＝另一張表單，仍可加）
 *   6. items/add 也要留稽核
 *
 * 跑法：npm test。實際起 server、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-oiaudit-"));
const SECRET = "test-secret-oiaudit";
process.env.DB_PATH = path.join(TMP, "oi.db");
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
const COOKIE = () => "sf_admin_session=" + signSession("u1");
let server, baseUrl, db;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "u1", name: "編輯員", passwordHash: "x:y", title: "經理", status: "active" }]));
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("c1", "客戶");
    await db.prepare("INSERT INTO products (id, name, erp_code) VALUES (?,?,?)").run("p1", "高麗菜", "A001");
    await db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status) VALUES (?,?,?,?,?)")
        .run("o1", "N1", "c1", "2026-09-01", "pending");
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
    return fetch(baseUrl + "/admin/orders/o1/items", {
        method: "POST", redirect: "manual",
        headers: { cookie: COOKIE(), "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
        body: formStr,
    });
}
async function auditRows(action) {
    return db.prepare("SELECT id, entity_id, action, summary, meta_json, actor_username FROM data_change_log WHERE action = ? ORDER BY id").all(action);
}
async function clearAudit() { await db.prepare("DELETE FROM data_change_log").run(); }

test("1. 改明細會寫稽核，meta 帶得出「哪一項、舊值→新值」、actor 是操作者", async () => {
    await clearAudit();
    const res = await saveItems("qty_it1=8&unit_it1=公斤&remark_it1=&sub_customer_it1=");
    assert.equal(res.status, 200);

    const rows = await auditRows("update_items");
    assert.equal(rows.length, 1, "改了明細就要留一筆軌跡");
    assert.equal(rows[0].entity_id, "o1");
    assert.equal(rows[0].actor_username, "u1", "要記得是誰改的");

    const meta = JSON.parse(rows[0].meta_json);
    const ch = meta.changes.find((c) => c.item_id === "it1");
    assert.ok(ch, "要指名是哪一個品項");
    assert.deepEqual(ch.quantity, { before: 5, after: 8 }, "數量要留舊值→新值");
    assert.equal(ch.name, "高麗菜");

    const it = await db.prepare("SELECT quantity FROM order_items WHERE id = ?").get("it1");
    assert.equal(Number(it.quantity), 8, "主資料要真的改掉");
});

test("2. 只記真的有變的欄位（沒動的欄位不進 meta）", async () => {
    await clearAudit();
    await saveItems("qty_it1=9&unit_it1=公斤&remark_it1=&sub_customer_it1=");
    const meta = JSON.parse((await auditRows("update_items"))[0].meta_json);
    const ch = meta.changes.find((c) => c.item_id === "it1");
    assert.ok(ch.quantity, "數量有改，要在");
    assert.equal(ch.unit, undefined, "單位沒改就不該出現在 meta（否則每次都一大包沒資訊量的 diff）");
    assert.equal(ch.remark, undefined);
});

test("3. 完全沒有變動 → 不留空白軌跡", async () => {
    await clearAudit();
    // 送出與現況完全相同的值（承上題，it1 已是 9 公斤）
    const res = await saveItems("qty_it1=9&unit_it1=公斤&remark_it1=&sub_customer_it1=");
    assert.equal(res.status, 200);
    assert.equal((await auditRows("update_items")).length, 0, "沒改到東西就不該產生軌跡");
});

test("4. 多品項一次改：全部進同一筆軌跡，且主資料都改到（原子）", async () => {
    await clearAudit();
    await saveItems("qty_it1=11&unit_it1=公斤&remark_it1=&sub_customer_it1=&qty_it2=7&unit_it2=公斤&remark_it2=&sub_customer_it2=");
    const rows = await auditRows("update_items");
    assert.equal(rows.length, 1, "一次儲存＝一筆軌跡，不是逐項各一筆");
    const meta = JSON.parse(rows[0].meta_json);
    assert.equal(meta.changes.length, 2);

    const a = await db.prepare("SELECT quantity FROM order_items WHERE id = ?").get("it1");
    const b = await db.prepare("SELECT quantity FROM order_items WHERE id = ?").get("it2");
    assert.equal(Number(a.quantity), 11);
    assert.equal(Number(b.quantity), 7);
});

test("5. items/add 一次性 token：同一張表單重送不會多一列品項", async () => {
    await clearAudit();
    // 先取表單，拿到 form_token
    const page = await (await fetch(baseUrl + "/admin/orders/o1/items/add", { headers: { cookie: COOKIE() } })).text();
    const m = page.match(/name="form_token" value="([^"]+)"/);
    assert.ok(m, "表單要帶一次性 token");
    const token = m[1];

    const body = "form_token=" + encodeURIComponent(token) + "&product_id=p1&quantity=4&unit=公斤";
    const before = Number((await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = 'o1'").get()).n);

    const r1 = await fetch(baseUrl + "/admin/orders/o1/items/add", {
        method: "POST", redirect: "manual",
        headers: { cookie: COOKIE(), "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    assert.equal(r1.status, 302);
    // 重送同一張表單（重新整理／上一頁再送／網路重試）
    const r2 = await fetch(baseUrl + "/admin/orders/o1/items/add", {
        method: "POST", redirect: "manual",
        headers: { cookie: COOKIE(), "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    assert.equal(r2.status, 302, "重送要安靜導回，不該報錯嚇使用者");

    const after = Number((await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = 'o1'").get()).n);
    assert.equal(after, before + 1, "重送只能加一列，不是兩列");
});

test("6. items/add 會留稽核（含品名/數量/單位）", async () => {
    const rows = await auditRows("add_item");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].entity_id, "o1");
    assert.equal(rows[0].actor_username, "u1");
    const meta = JSON.parse(rows[0].meta_json);
    assert.equal(meta.product_id, "p1");
    assert.equal(meta.quantity, 4);
    assert.equal(meta.unit, "公斤");
});

test("7. 刻意再加一次（重新開表單＝新 token）仍然加得進去，沒有被誤當重複", async () => {
    const before = Number((await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = 'o1'").get()).n);
    const page = await (await fetch(baseUrl + "/admin/orders/o1/items/add", { headers: { cookie: COOKIE() } })).text();
    const token = page.match(/name="form_token" value="([^"]+)"/)[1];
    await fetch(baseUrl + "/admin/orders/o1/items/add", {
        method: "POST", redirect: "manual",
        headers: { cookie: COOKIE(), "Content-Type": "application/x-www-form-urlencoded" },
        body: "form_token=" + encodeURIComponent(token) + "&product_id=p1&quantity=4&unit=公斤",
    });
    const after = Number((await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = 'o1'").get()).n);
    assert.equal(after, before + 1, "同名同量分次加叫是合法的，不得被去重吃掉");
});

test("8. 不變式：改明細的稽核與主寫入必須同交易（原始碼層級）", () => {
    // 行為測不到「DB 在半途掛掉」，所以改用結構斷言：writeAudit（會 throw 的那個）
    // 必須出現在 applyItems/doAdd 的交易函式裡，不能退回 writeAuditSafe 或搬到交易外。
    const src = fs.readFileSync(path.join(__dirname, "..", "dist", "admin", "orders.js"), "utf8");
    assert.match(src, /const applyItems = async \(h\) => \{[\s\S]*?writeAudit\)\(h,[\s\S]*?\};/,
        "明細儲存的稽核要用 writeAudit(h,…) 寫在交易內——改成 writeAuditSafe 或搬到交易外，" +
        "就會回到「明細改了、軌跡沒留」的舊狀態");
    assert.match(src, /const doAdd = async \(h\) => \{[\s\S]*?writeAudit\)\(h,[\s\S]*?\};/,
        "新增品項的稽核同上");
});
