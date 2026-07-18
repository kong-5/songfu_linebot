"use strict";
/**
 * Smoke test：條碼對照包交易＋稽核＋正名操作者（2026-07-18，體檢 M1＋稽核缺口）。
 * 鎖住：
 *   1. add（先刪後插）為 upsert：重綁同條碼只留一列、不殘留；created_by＝真實操作者（非寫死 "admin"）
 *   2. add/update/delete 皆寫 data_change_log，before/after 正確
 *   3. /scan/bind（掃碼邊掃邊綁）同樣 upsert＋留痕
 *
 * 跑法：npm test。實際起 server、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-bc-"));
const SECRET = "test-secret-bc";
process.env.DB_PATH = path.join(TMP, "bc.db");
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
        .run("admin_users", JSON.stringify([{ username: "u1", name: "倉管員", passwordHash: "x:y", title: "經理", status: "active" }]));
    // 料號驗證用：該公司庫存快照要有這兩個料號
    for (const code of ["P100", "P200"]) {
        await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, qty) VALUES (?,?,?,?)").run("02", code, "品項" + code, 10);
    }
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((r) => (server ? server.close(r) : r())));

async function postForm(p, formStr) {
    const res = await fetch(baseUrl + p, {
        method: "POST", redirect: "manual",
        headers: { cookie: "sf_admin_session=" + signSession("u1"), "content-type": "application/x-www-form-urlencoded" },
        body: formStr,
    });
    return { status: res.status, location: res.headers.get("location") };
}
async function postJson(p, obj) {
    const res = await fetch(baseUrl + p, {
        method: "POST", redirect: "manual",
        headers: { cookie: "sf_admin_session=" + signSession("u1"), "content-type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(obj),
    });
    let d = null; const t = await res.text();
    try { d = t ? JSON.parse(t) : null; } catch (_) {}
    return { status: res.status, data: d };
}
async function bcRows(barcode) {
    return db.prepare("SELECT * FROM product_barcode WHERE barcode = ?").all(barcode);
}
async function audit(entityId) {
    return db.prepare("SELECT * FROM data_change_log WHERE entity_type='product_barcode' AND entity_id=? ORDER BY created_at, id").all(entityId);
}

test("1. /inventory/barcodes add＝upsert：重綁只留一列、created_by 為真實操作者", async () => {
    await postForm("/admin/inventory/barcodes", "icpno=02&action=add&barcode=BAR1&erp_code=P100&qty_per_scan=6");
    let rows = await bcRows("BAR1");
    assert.equal(rows.length, 1, "首次綁定應有一列");
    assert.equal(rows[0].erp_code, "P100");
    assert.equal(rows[0].created_by, "admin:u1", "created_by 應為真實操作者、非寫死 admin");
    // 重綁到另一料號
    await postForm("/admin/inventory/barcodes", "icpno=02&action=add&barcode=BAR1&erp_code=P200&qty_per_scan=6");
    rows = await bcRows("BAR1");
    assert.equal(rows.length, 1, "先刪後插後仍只有一列（無殘留、無重複）");
    assert.equal(rows[0].erp_code, "P200", "應更新為新料號");
});

test("2. add/update/delete 稽核 before/after 正確", async () => {
    const eid = "02:BAR1"; // 承上：目前綁 P200
    await postForm("/admin/inventory/barcodes", "icpno=02&action=update&barcode=BAR1&qty_per_scan=12");
    await postForm("/admin/inventory/barcodes", "icpno=02&action=delete&barcode=BAR1");
    const rows = await audit(eid);
    // create(P100) → update(P100→P200 via add) → update(qps) → delete
    assert.ok(rows.length >= 3, "應累積多筆稽核");
    const last = rows[rows.length - 1];
    assert.equal(last.action, "delete");
    const lastMeta = JSON.parse(last.meta_json);
    assert.equal(lastMeta.after, null, "delete 後 after 應為 null");
    assert.equal(lastMeta.before.erp_code, "P200", "delete 前綁的是 P200");
    assert.equal((await bcRows("BAR1")).length, 0, "delete 後應無此條碼");
});

test("3. /scan/bind upsert＋留痕", async () => {
    const r = await postJson("/admin/scan/bind", { icpno: "02", barcode: "BAR2", erp_code: "P100", qty_per_scan: 3 });
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    let rows = await bcRows("BAR2");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].created_by, "admin:u1");
    // 重綁
    await postJson("/admin/scan/bind", { icpno: "02", barcode: "BAR2", erp_code: "P200", qty_per_scan: 3 });
    rows = await bcRows("BAR2");
    assert.equal(rows.length, 1, "掃碼重綁也只留一列");
    assert.equal(rows[0].erp_code, "P200");
    const a = await audit("02:BAR2");
    assert.ok(a.length >= 2, "掃碼綁定應留痕");
    assert.equal(a[0].action, "create");
    assert.equal(a[a.length - 1].action, "update");
});
