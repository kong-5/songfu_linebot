"use strict";
/**
 * Smoke test：稽核軌跡缺口補強（2026-07-18，體檢優先項 3）。
 * 鎖住 CLAUDE.md 守則 #3「所有資料異動要寫入稽核軌跡（誰/何時/舊值/新值）」：
 *   1. 庫存調整 create/update/delete 皆寫 data_change_log，before/after 正確、帶操作者
 *   2. 群組功能開關異動寫 data_change_log，before→after 正確
 *   3. 無實質變動不留痕（避免雜訊）
 *
 * 跑法：npm test（node --test test/）。實際起 server、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-audit-"));
const SECRET = "test-secret-audit";
process.env.DB_PATH = path.join(TMP, "audit.db");
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
        .run("admin_users", JSON.stringify([{ username: "auditor", name: "稽核員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function post(p, formStr) {
    const res = await fetch(baseUrl + p, {
        method: "POST", redirect: "manual",
        headers: {
            cookie: "sf_admin_session=" + signSession("auditor"),
            "content-type": "application/x-www-form-urlencoded",
        },
        body: formStr,
    });
    return { status: res.status, location: res.headers.get("location") };
}
async function auditRows(entityType, entityId) {
    return db.prepare("SELECT * FROM data_change_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at, id").all(entityType, entityId);
}

test("1. 庫存調整 create→update→delete 皆留痕，before/after 正確、帶操作者", async () => {
    const eid = "02:P001";
    await post("/admin/inventory/adjustments", "icpno=02&erp_code=P001&action=update&delta=5");
    await post("/admin/inventory/adjustments", "icpno=02&erp_code=P001&action=update&delta=8");
    await post("/admin/inventory/adjustments", "icpno=02&erp_code=P001&action=delete");
    const rows = await auditRows("stock_adjustment", eid);
    assert.equal(rows.length, 3, "create/update/delete 各應留一筆");
    const [c, u, d] = rows;
    assert.equal(c.action, "create");
    assert.equal(c.actor_username, "auditor", "應記錄操作者");
    const cMeta = JSON.parse(c.meta_json);
    assert.equal(cMeta.before, null, "create 的 before 應為 null");
    assert.equal(cMeta.after.delta, 5, "create 的 after.delta 應為 5");
    assert.equal(u.action, "update");
    const uMeta = JSON.parse(u.meta_json);
    assert.equal(uMeta.before.delta, 5, "update 的 before.delta 應為 5");
    assert.equal(uMeta.after.delta, 8, "update 的 after.delta 應為 8");
    assert.equal(d.action, "delete");
    const dMeta = JSON.parse(d.meta_json);
    assert.equal(dMeta.before.delta, 8, "delete 的 before.delta 應為 8");
    assert.equal(dMeta.after, null, "delete 的 after 應為 null");
    // 資料面：調整已真的刪除
    const left = await db.prepare("SELECT COUNT(*) AS n FROM stock_adjustment WHERE erp_code='P001'").get();
    assert.equal(Number(left.n), 0, "delete 後 stock_adjustment 應無此列");
});

test("2. 群組功能異動留痕，before→after 正確", async () => {
    const gid = "Cabc123";
    // 從預設（訂單開/盤點關/空籃開）改成盤點開 → 有變動
    await post("/admin/customers/groups", `known_ids=${gid}&order%5B${gid}%5D=1&stk%5B${gid}%5D=1&bsk%5B${gid}%5D=1&orig%5B${gid}%5D=000`);
    const rows = await auditRows("group_features", gid);
    assert.equal(rows.length, 1, "群組功能異動應留一筆");
    assert.equal(rows[0].actor_username, "auditor");
    const meta = JSON.parse(rows[0].meta_json);
    assert.equal(meta.before.stocktake, false, "改前盤點應為關");
    assert.equal(meta.after.stocktake, true, "改後盤點應為開");
    // 資料面：真的寫進 group_features
    const gf = await db.prepare("SELECT feat_stocktake FROM group_features WHERE group_id = ?").get(gid);
    assert.equal(Number(gf.feat_stocktake), 1, "group_features 應實際為盤點開");
});

test("3. 無實質變動不留痕", async () => {
    const gid = "Cabc123"; // 承上，現況已是盤點開
    // 再次送出相同狀態（orig 給不同值以強制進入寫入迴圈），before==after → 不應新增稽核
    await post("/admin/customers/groups", `known_ids=${gid}&order%5B${gid}%5D=1&stk%5B${gid}%5D=1&bsk%5B${gid}%5D=1&orig%5B${gid}%5D=000`);
    const rows = await auditRows("group_features", gid);
    assert.equal(rows.length, 1, "狀態未變不應再留痕（仍是 1 筆）");
});
