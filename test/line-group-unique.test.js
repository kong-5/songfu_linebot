"use strict";
/**
 * Smoke test：一個 LINE 群組只能綁一個客戶（2026-07-27，健檢 backlog 高優先項）。
 *
 * 背景：/customers/new、/customers/:id/edit、/customers/pending-bind、/import-customers
 * 四個入口都有「已綁其他客戶就擋」的應用層守衛，但那是先查後寫——表單雙擊或併發請求會
 * 兩邊都通過檢查，同一群組綁到兩個客戶＝該群組叫貨歸屬錯亂。本測試鎖住 DB 層的最後一道：
 *   1. 唯一索引 ux_customers_line_group 有建起來，直接 INSERT 重複群組會被擋
 *   2. NULL／空字串是「未綁定」，允許多筆（部分索引不可誤傷）
 *   3. 撞到索引時前台回可行動訊息（守則 #4），不是原始 500
 *   4. 既有資料有重複時，遷移只警告不建索引、絕不自動改資料
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-grp-"));
const SECRET = "test-secret-grp";
process.env.DB_PATH = path.join(TMP, "grp.db");
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
        .run("admin_users", JSON.stringify([{ username: "grp", name: "群組測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?, ?, ?, 1)").run("c-hold", "已綁群組的客戶", "C-DUP-1");
    await db.prepare("INSERT INTO customers (id, name, active) VALUES (?, ?, 1)").run("c-free", "未綁群組的客戶");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function post(p, formStr) {
    const res = await fetch(baseUrl + p, {
        method: "POST", redirect: "manual",
        headers: { cookie: "sf_admin_session=" + signSession("grp"), "content-type": "application/x-www-form-urlencoded" },
        body: formStr,
    });
    return { status: res.status, location: res.headers.get("location") };
}

test("唯一索引已建立：直接 INSERT 重複的 line_group_id 會被 DB 擋下", async () => {
    // better-sqlite3 是同步丟錯（PG 則是 rejected promise），用 try/catch 兩種都涵蓋
    let err = null;
    try {
        await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?, ?, ?, 1)")
            .run("c-clash", "想搶同群組的客戶", "C-DUP-1");
    } catch (e) { err = e; }
    assert.ok(err, "同一群組綁第二個客戶必須被 DB 擋下");
    assert.match(String(err.message || err), /UNIQUE|constraint|duplicate key/i);
    const leaked = await db.prepare("SELECT id FROM customers WHERE id = ?").get("c-clash");
    assert.ok(!leaked, "被擋下就不該留下資料");
});

test("部分索引不誤傷：NULL 與空字串（未綁定）允許多筆", async () => {
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?, ?, NULL, 1)").run("c-n1", "未綁一");
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?, ?, NULL, 1)").run("c-n2", "未綁二");
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?, ?, '', 1)").run("c-e1", "空字串一");
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?, ?, '', 1)").run("c-e2", "空字串二");
    const n = await db.prepare("SELECT COUNT(*) AS c FROM customers WHERE line_group_id IS NULL OR line_group_id = ''").get();
    assert.ok(Number(n.c) >= 4, "未綁定的客戶不可被唯一索引限制");
});

test("前台：新增客戶綁已被佔用的群組 → 導回並帶可行動訊息（非 500）", async () => {
    const r = await post("/admin/customers/new", "name=" + encodeURIComponent("新客戶甲") + "&line_group_id=C-DUP-1");
    assert.equal(r.status, 302, "應為導回而非 500");
    const loc = decodeURIComponent(r.location || "");
    assert.ok(loc.includes("/customers/new"), "應導回新增頁");
    assert.ok(/已綁定|已被|其他客戶/.test(loc), "訊息要說明群組已被佔用，實得：" + loc);
    const created = await db.prepare("SELECT id FROM customers WHERE name = ?").get("新客戶甲");
    assert.ok(!created, "衝突時不可建立客戶");
});

test("前台：編輯客戶改綁已被佔用的群組 → 導回並帶可行動訊息，原綁定不受影響", async () => {
    const r = await post("/admin/customers/c-free/edit", "name=" + encodeURIComponent("未綁群組的客戶") + "&line_group_id=C-DUP-1&active=1");
    assert.equal(r.status, 302);
    assert.ok(/已綁定|已被|其他客戶/.test(decodeURIComponent(r.location || "")), "應帶可行動訊息");
    const holder = await db.prepare("SELECT line_group_id FROM customers WHERE id = ?").get("c-hold");
    assert.equal(holder.line_group_id, "C-DUP-1", "原客戶的綁定不可被動");
    const free = await db.prepare("SELECT line_group_id FROM customers WHERE id = ?").get("c-free");
    assert.ok(!free.line_group_id, "衝突時不可寫入群組");
});

test("既有資料已重複時：遷移只警告不建索引，絕不自動改資料", async () => {
    // 另開一個「上線前就已有重複」的舊庫，跑 initDb 後索引不該存在、資料不該被動
    const dirty = path.join(TMP, "dirty.db");
    const Database = require("better-sqlite3");
    const raw = new Database(dirty);
    raw.exec("CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, line_group_id TEXT)");
    raw.prepare("INSERT INTO customers (id, name, line_group_id) VALUES (?, ?, ?)").run("d1", "舊客戶一", "C-OLD");
    raw.prepare("INSERT INTO customers (id, name, line_group_id) VALUES (?, ?, ?)").run("d2", "舊客戶二", "C-OLD");
    raw.close();
    await initDb(dirty);
    const d = getDb(dirty);
    const idx = await d.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='ux_customers_line_group'").get();
    assert.ok(!idx, "有重複資料時不可建立索引（否則 initDb 會整個炸掉）");
    const still = await d.prepare("SELECT COUNT(*) AS c FROM customers WHERE line_group_id = ?").get("C-OLD");
    assert.equal(Number(still.c), 2, "遷移絕不可自動改／刪既有資料");
});
