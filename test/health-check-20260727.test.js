"use strict";
/**
 * Smoke test：2026-07-27 體質健檢修復。
 * 鎖住五路掃描（漏await／SQLite-PG雙寫／冪等交易／稽核軌跡／XSS）找到並修掉的問題：
 *   1. sqlForPg fail-fast 黑名單補洞（datetime 兩參數形式／IFNULL／字串常值內 ?）
 *   2. POST /alias 冪等（重按不長重複俗名）＋客戶專用別名補稽核
 *   3. /complaints/new 原子取號（連建兩張不撞號、不重號）
 *   4. /import-customers 不可把已綁定的 LINE 群組蓋給別的客戶
 *   5. 反射型 XSS：/admin/import?ok=、/admin/cash/collect?route= 不再原樣輸出
 *   6. quote-report createReport 冪等（同月重按回同一份、品項不重複）
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-health-"));
const SECRET = "test-secret-health";
process.env.DB_PATH = path.join(TMP, "health.db");
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
        .run("admin_users", JSON.stringify([{ username: "doc", name: "體檢員", passwordHash: "x:y", title: "經理", status: "active" }]));
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?, ?, ?, 1)").run("cust-h1", "體檢客戶甲", "GROUP-H1");
    await db.prepare("INSERT INTO products (id, name, unit, active) VALUES (?, ?, ?, 1)").run("prod-h1", "體檢品項", "KG");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

const cookie = () => "sf_admin_session=" + signSession("doc");
async function post(p, formStr) {
    const res = await fetch(baseUrl + p, {
        method: "POST", redirect: "manual",
        headers: { cookie: cookie(), "content-type": "application/x-www-form-urlencoded" },
        body: formStr,
    });
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
}
async function get(p) {
    const res = await fetch(baseUrl + p, { redirect: "manual", headers: { cookie: cookie() } });
    return { status: res.status, text: await res.text() };
}

test("sqlForPg fail-fast：SQLite 專屬語法與字串常值內 ? 一律擋下、合法 SQL 放行", () => {
    const { sqlForPg } = require("../dist/db/index.js");
    const mustThrow = [
        "SELECT datetime(updated_at, '+8 hours') FROM orders", // datetime 兩參數形式（舊護欄漏抓）
        "SELECT date(?, '-3 day')",
        "SELECT IFNULL(a, 0) FROM t",
        "SELECT julianday(a) FROM t",
        "SELECT * FROM t WHERE note = 'why?'", // 字串常值內 ? 會讓 placeholder 編號整批錯位
    ];
    for (const sql of mustThrow) {
        assert.throws(() => sqlForPg(sql), /sqlForPg/, "應擋下：" + sql);
    }
    // 合法 SQL 放行：datetime('now') 正常轉換、兩個字串常值中間夾 placeholder 不可誤殺（'' 跳脫也要認得）
    assert.equal(sqlForPg("INSERT INTO t (a, ts) VALUES (?, datetime('now'))"), "INSERT INTO t (a, ts) VALUES ($1, CURRENT_TIMESTAMP)");
    assert.equal(sqlForPg("SELECT * FROM t WHERE a = 'x' AND b = ? AND c = 'it''s'"), "SELECT * FROM t WHERE a = 'x' AND b = $1 AND c = 'it''s'");
});

test("POST /alias 冪等：連按兩次只留一筆俗名；客戶專用別名有稽核軌跡", async () => {
    const form = "alias=" + encodeURIComponent("體檢俗名") + "&product_id=prod-h1&scope=global&redirect=/admin/review";
    await post("/admin/alias", form);
    await post("/admin/alias", form);
    const rows = await db.prepare("SELECT id FROM product_aliases WHERE product_id = ? AND alias = ?").all("prod-h1", "體檢俗名");
    assert.equal(rows.length, 1, "全域俗名重送不可長出第二列");
    const formC = "alias=" + encodeURIComponent("客戶專用名") + "&product_id=prod-h1&scope=customer&customer_id=cust-h1&redirect=/admin/review";
    await post("/admin/alias", formC);
    await post("/admin/alias", formC);
    const rowsC = await db.prepare("SELECT id FROM customer_product_aliases WHERE customer_id = ? AND product_id = ? AND alias = ?").all("cust-h1", "prod-h1", "客戶專用名");
    assert.equal(rowsC.length, 1, "客戶專用俗名重送不可長出第二列");
    const audit = await db.prepare("SELECT id FROM data_change_log WHERE entity_type = 'customer_product_alias' AND entity_id = ?").all(rowsC[0].id);
    assert.ok(audit.length >= 1, "客戶專用別名建立要寫稽核軌跡");
});

test("/complaints/new 原子取號：連建兩張客訴單號不重複", async () => {
    const mk = () => post("/admin/complaints/new", "customer_id=cust-h1&order_date=2026-07-27&raw_message=" + encodeURIComponent("測試客訴"));
    const r1 = await mk();
    const r2 = await mk();
    assert.equal(r1.status, 302);
    assert.equal(r2.status, 302);
    const rows = await db.prepare("SELECT order_no FROM orders WHERE status = 'complaint' ORDER BY order_no").all();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].order_no, rows[1].order_no, "兩張客訴不可同號");
});

test("/import-customers：已綁其他客戶的 LINE 群組不可被 CSV 蓋走", async () => {
    const csv = "客戶名稱,line_group_id\n體檢客戶乙,GROUP-H1\n";
    // 路由掛 multer（multipart），csv 以表單欄位送
    const fd = new FormData();
    fd.append("csv", csv);
    const resR = await fetch(baseUrl + "/admin/import-customers", { method: "POST", redirect: "manual", headers: { cookie: cookie() }, body: fd });
    const r = { status: resR.status, location: resR.headers.get("location") };
    assert.equal(r.status, 302);
    const a = await db.prepare("SELECT line_group_id FROM customers WHERE id = ?").get("cust-h1");
    assert.equal(a.line_group_id, "GROUP-H1", "原客戶的群組綁定不可被動");
    const b = await db.prepare("SELECT line_group_id FROM customers WHERE name = ?").get("體檢客戶乙");
    assert.ok(b, "新客戶仍要建立");
    assert.ok(!b.line_group_id, "衝突群組不可綁到新客戶");
    assert.ok(decodeURIComponent(r.location || "").includes("跳過"), "結果訊息要標明跳過的綁定");
});

test("反射型 XSS：/admin/import?ok= 與 /cash/collect?route= 不再原樣輸出", async () => {
    const payload = '<img src=x onerror=alert(1)>';
    const r1 = await get("/admin/import?ok=" + encodeURIComponent(payload));
    assert.equal(r1.status, 200);
    assert.ok(!r1.text.includes(payload), "/admin/import 不可原樣輸出 ok 參數");
    const r2 = await get("/admin/cash/collect?icpno=00&route=" + encodeURIComponent("</script><svg onload=alert(1)>"));
    assert.equal(r2.status, 200);
    assert.ok(!r2.text.includes("</script><svg"), "/cash/collect 的 ROUTE 內插不可讓 </script> 逃出 script 區塊");
});

test("quote-report createReport 冪等：同月重按回同一份、品項不重複", async () => {
    const qr = require("../dist/lib/quote-report.js");
    const id1 = await qr.createReport(db, { ym: "2026-07" });
    const id2 = await qr.createReport(db, { ym: "2026-07" });
    assert.equal(id1, id2, "同月重建要回同一份月報");
    const n = await db.prepare("SELECT COUNT(*) AS c FROM quote_report WHERE ym = ?").get("2026-07");
    assert.equal(Number(n.c), 1);
});
