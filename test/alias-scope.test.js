"use strict";
/**
 * Smoke test：全域俗名（/alias）只套用未結單/未回寫凌越的待對應品項（盤查 §二 B3）。
 * 舊版無條件改「所有」符合 raw_name 且 need_review=1 的品項，含已作廢/客訴、已回寫凌越的單
 * → 後台 product_id 被改但凌越那張單不會變＝脫節。這裡鎖住收斂範圍與影響筆數回報。
 *
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-aliasscope-"));
const SECRET = "test-secret-aliasscope";
process.env.DB_PATH = path.join(TMP, "alias.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

function signSession(u) {
    const exp = Date.now() + 3600000;
    const payload = Buffer.from(JSON.stringify({ u, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
let server, baseUrl, db;
const RAW = "神秘葉菜X";

async function mkOrderWithItem(oid, status, writtenAt) {
    await db.prepare("INSERT INTO orders (id, customer_id, order_date, status, lingyue_written_at) VALUES (?, ?, ?, ?, ?)")
        .run(oid, "cust1", "2026-07-28", status, writtenAt || null);
    await db.prepare("INSERT INTO order_items (id, order_id, raw_name, quantity, unit, need_review, product_id) VALUES (?, ?, ?, ?, ?, 1, NULL)")
        .run(oid + "-i", oid, RAW, 3, "公斤");
}

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify([
        { username: "mgr1", name: "經理甲", passwordHash: "x:y", title: "經理", status: "active" },
    ]));
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("cust1", "測試客戶");
    await db.prepare("INSERT INTO products (id, name) VALUES (?, ?)").run("P1", "正確品項");
    await mkOrderWithItem("oa_pending", "pending", null);
    await mkOrderWithItem("ob_deleted", "deleted", null);
    await mkOrderWithItem("oc_complaint", "complaint", null);
    await mkOrderWithItem("od_written", "pending", "2026-07-28 02:00:00");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function item(oid) {
    return db.prepare("SELECT product_id, need_review FROM order_items WHERE id = ?").get(oid + "-i");
}

test("建全域俗名：只改 pending 未回寫單的待對應品項", async () => {
    const body = new URLSearchParams({ alias: RAW, product_id: "P1", scope: "global" }).toString();
    const r = await fetch(baseUrl + "/admin/alias", {
        method: "POST", redirect: "manual",
        headers: { cookie: "sf_admin_session=" + signSession("mgr1"), "content-type": "application/x-www-form-urlencoded" },
        body,
    });
    assert.ok(r.status === 302 || r.status === 200, "建俗名應成功，實得 " + r.status);

    const a = await item("oa_pending");
    assert.equal(a.product_id, "P1", "pending 未回寫單應被對應");
    assert.equal(Number(a.need_review), 0, "pending 未回寫單應標為已對應");

    for (const oid of ["ob_deleted", "oc_complaint", "od_written"]) {
        const it = await item(oid);
        assert.equal(it.product_id, null, oid + " 不應被改 product_id");
        assert.equal(Number(it.need_review), 1, oid + " 應維持待對應");
    }
});

test("大量套用有稽核，且回報影響筆數 = 1", async () => {
    const row = await db.prepare("SELECT meta_json FROM data_change_log WHERE action = 'alias_bulk_apply' ORDER BY created_at DESC LIMIT 1").get();
    assert.ok(row, "應有 alias_bulk_apply 稽核");
    const meta = JSON.parse(row.meta_json);
    assert.equal(meta.affected, 1, "只應動到 1 筆（pending 未回寫），實得 " + meta.affected);
});
