"use strict";
/**
 * Smoke test：re-recognize 守衛 ＋ order-detail 稽核（盤查 §二 B1/B2）。
 * - B2：已回寫凌越的單，重新辨識（整單品項 DELETE+INSERT）會讓後台與 ERP 分歧 → 未帶 force 一律擋。
 * - B1：order-detail 域過去整域無稽核（ctx 沒解構 logDataChange）；轉入凌越（在 ERP 產生單據）補軌跡。
 *
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-odaudit-"));
const SECRET = "test-secret-odaudit";
process.env.DB_PATH = path.join(TMP, "od.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;
delete process.env.LINGYUE_WRITE_CMD; // 無橋接 → 轉入凌越走「排隊」路徑（不需真的打凌越）
delete process.env.GOOGLE_GEMINI_API_KEY;

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
const COOKIE = () => "sf_admin_session=" + signSession("mgr1");

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify([
        { username: "mgr1", name: "經理甲", passwordHash: "x:y", title: "經理", status: "active" },
    ]));
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("cust1", "測試客戶");
    await db.prepare("INSERT INTO products (id, name, erp_code) VALUES (?, ?, ?)").run("P1", "高麗菜", "SK001");
    // 已回寫凌越的單（for B2 守衛）
    await db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status, raw_message, lingyue_doc_no, lingyue_written_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run("o_written", "20260728001", "cust1", "2026-07-28", "approved", "高麗菜 5 公斤", "D123", "2026-07-28 03:00:00");
    await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export) VALUES (?, ?, ?, ?, ?, ?, 0, 1)")
        .run("o_written-i", "o_written", "P1", "高麗菜", 5, "公斤");
    // 未回寫的單（for 轉入凌越排隊稽核）
    await db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status) VALUES (?, ?, ?, ?, ?)")
        .run("o_transfer", "20260728002", "cust1", "2026-07-28", "pending");
    await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export) VALUES (?, ?, ?, ?, ?, ?, 0, 1)")
        .run("o_transfer-i", "o_transfer", "P1", "高麗菜", 3, "公斤");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("B2：已回寫凌越的單重新辨識（未 force）被擋、品項不變", async () => {
    const r = await fetch(baseUrl + "/admin/orders/o_written/re-recognize", {
        method: "POST", redirect: "manual", headers: { cookie: COOKIE() },
    });
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location") || "", /rerecog_written/, "應導回 rerecog_written 錯誤");
    const cnt = await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = 'o_written'").get();
    assert.equal(Number(cnt.n), 1, "品項不應被刪除重建");
});

test("B2：force=1 會略過守衛（不再回 rerecog_written）", async () => {
    const r = await fetch(baseUrl + "/admin/orders/o_written/re-recognize?force=1", {
        method: "POST", redirect: "manual", headers: { cookie: COOKIE() },
    });
    assert.equal(r.status, 302);
    // 無 Gemini 金鑰 → 會落到某個 rerecog 解析錯誤，但關鍵是「不是被 written 守衛擋下」
    assert.doesNotMatch(r.headers.get("location") || "", /rerecog_written/, "force 應略過凌越守衛");
});

test("B1：轉入凌越（排隊路徑）寫入稽核 lingyue_queue", async () => {
    const r = await fetch(baseUrl + "/admin/orders/o_transfer/lingyue-transfer", {
        method: "POST", redirect: "manual", headers: { cookie: COOKIE() },
    });
    assert.equal(r.status, 200);
    const j = JSON.parse(await r.text());
    assert.equal(j.ok, true, "轉入應成功（排隊）");
    assert.equal(j.queued, true);
    const row = await db.prepare("SELECT COUNT(*) AS n FROM data_change_log WHERE entity_type='order' AND entity_id='o_transfer' AND action='lingyue_queue'").get();
    assert.ok(row && row.n >= 1, "排入凌越佇列應留稽核，實得 " + (row && row.n));
    // 佇列欄位確實被設定
    const o = await db.prepare("SELECT lingyue_queued_at FROM orders WHERE id='o_transfer'").get();
    assert.ok(o.lingyue_queued_at, "應已標記排隊時間");
});
