"use strict";
/**
 * Smoke test：客訴/作廢單不進凌越回寫（盤查 §二 B5）。
 * 過去回寫佇列只排除 deleted，客訴單仍會被代理 /pending、/wait 撿走寫進 ERP＝錯帳；
 * 且 to-complaint/void 不清 lingyue_queued_at → 排隊中的單轉客訴/作廢後仍會被寫入。
 * 這裡鎖住：/pending 過濾 complaint+deleted；to-complaint 與 void 都清佇列欄位。
 *
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-lyfilter-"));
const SECRET = "test-secret-lyfilter";
const WBKEY = "test-wb-key-lyfilter";
process.env.DB_PATH = path.join(TMP, "ly.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
process.env.LINGYUE_WRITEBACK_KEY = WBKEY;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

const D = "2026-07-28";
function signSession(u) {
    const exp = Date.now() + 3600000;
    const payload = Buffer.from(JSON.stringify({ u, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
let server, baseUrl, db;
const COOKIE = () => "sf_admin_session=" + signSession("mgr1");

async function mkOrder(id, status) {
    await db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status, lingyue_queued_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, id.toUpperCase(), "cust1", D, status, D + " 01:00:00");
    await db.prepare("INSERT INTO order_items (id, order_id, raw_name, quantity, unit, include_export) VALUES (?, ?, ?, ?, ?, 1)")
        .run(id + "-i1", id, "高麗菜", 5, "公斤");
}

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify([
        { username: "mgr1", name: "經理甲", passwordHash: "x:y", title: "經理", status: "active" },
    ]));
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("cust1", "測試客戶");
    await mkOrder("o_pending", "pending");
    await mkOrder("o_complaint", "complaint");
    await mkOrder("o_deleted", "deleted");
    await mkOrder("o_tocomp", "pending");
    await mkOrder("o_void", "pending");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("/pending 只回 pending 單，排除 complaint 與 deleted（即使兩者都在排隊）", async () => {
    const r = await fetch(baseUrl + "/admin/lingyue-writeback/pending?date=" + D, {
        redirect: "manual", headers: { "X-Writeback-Key": WBKEY },
    });
    assert.equal(r.status, 200);
    const j = JSON.parse(await r.text());
    const ids = (j.orders || []).map((o) => o.order_id);
    assert.ok(ids.includes("o_pending"), "pending 單應回傳");
    assert.ok(!ids.includes("o_complaint"), "客訴單不可進回寫佇列");
    assert.ok(!ids.includes("o_deleted"), "作廢單不可進回寫佇列");
});

test("轉客訴清掉 lingyue_queued_at/claimed_at", async () => {
    const r = await fetch(baseUrl + "/admin/orders/o_tocomp/to-complaint", {
        method: "POST", redirect: "manual", headers: { cookie: COOKIE() },
    });
    assert.ok(r.status === 302 || r.status === 200, "轉客訴應成功，實得 " + r.status);
    const row = await db.prepare("SELECT status, lingyue_queued_at, lingyue_claimed_at FROM orders WHERE id = 'o_tocomp'").get();
    assert.equal(String(row.status).toLowerCase(), "complaint");
    assert.equal(row.lingyue_queued_at, null, "轉客訴後 lingyue_queued_at 應清空");
    assert.equal(row.lingyue_claimed_at, null, "轉客訴後 lingyue_claimed_at 應清空");
});

test("作廢清掉 lingyue_queued_at/claimed_at", async () => {
    const body = new URLSearchParams({ void_reason: "customer_cancelled", void_note: "測試" }).toString();
    const r = await fetch(baseUrl + "/admin/orders/o_void/void", {
        method: "POST", redirect: "manual",
        headers: { cookie: COOKIE(), "content-type": "application/x-www-form-urlencoded" }, body,
    });
    assert.ok(r.status === 302 || r.status === 200, "作廢應成功，實得 " + r.status);
    const row = await db.prepare("SELECT status, lingyue_queued_at, lingyue_claimed_at FROM orders WHERE id = 'o_void'").get();
    assert.equal(String(row.status).toLowerCase(), "deleted");
    assert.equal(row.lingyue_queued_at, null, "作廢後 lingyue_queued_at 應清空");
    assert.equal(row.lingyue_claimed_at, null, "作廢後 lingyue_claimed_at 應清空");
});
