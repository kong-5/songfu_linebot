"use strict";
/**
 * Smoke test：系統告警群組設定入口（地雷式盤查 §五 C1 / §六 1.1）。
 * ops_alert_group_id 未設定＝notifyOps 全靜默 no-op，回寫三振／庫存推送失敗／LINE 漏單等
 * 告警都發不出去。本測試鎖住新加的設定入口：未設定顯示紅字、可存、寫稽核、測試告警回正確狀態。
 *
 * 跑法：npm test（node --test test/*.test.js）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-opsalert-"));
const SECRET = "test-secret-opsalert";
process.env.DB_PATH = path.join(TMP, "ops.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;
delete process.env.LINE_CHANNEL_ACCESS_TOKEN; // 測試環境沒 token → 設了群組也只會回 no_token

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
const COOKIE = () => "sf_admin_session=" + signSession("mgr1");

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify([
        { username: "mgr1", name: "經理甲", passwordHash: "x:y", title: "經理", status: "active" },
    ]));
    await db.prepare("INSERT INTO stocktake_group (group_id, group_name) VALUES (?, ?)").run("Cgroup_ops", "內部告警群");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

function get(p) {
    return fetch(baseUrl + p, { redirect: "manual", headers: { cookie: COOKIE() } });
}
function postForm(p, obj) {
    const body = new URLSearchParams(obj).toString();
    return fetch(baseUrl + p, {
        method: "POST", redirect: "manual",
        headers: { cookie: COOKIE(), "content-type": "application/x-www-form-urlencoded" },
        body,
    });
}

test("未設定時：LINE 機器人頁顯示告警群組卡與紅字提示", async () => {
    const r = await get("/admin/line-bot");
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /系統告警群組/, "應有告警群組設定卡");
    assert.match(html, /尚未設定/, "未設定時應有紅字提示");
    assert.match(html, /內部告警群/, "群組下拉應帶出 stocktake_group 的群");
});

test("儲存告警群組：寫入 app_settings 並留稽核", async () => {
    const r = await postForm("/admin/line-bot", { line_bot_mode: "always_on", ops_alert_group_id: "Cgroup_ops" });
    assert.equal(r.status, 302, "存檔應 302 導回");
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = 'ops_alert_group_id'").get();
    assert.equal(row && row.value, "Cgroup_ops");
    const audit = await db.prepare("SELECT COUNT(*) AS n FROM data_change_log WHERE entity_type='app_settings' AND entity_id='ops_alert_group_id'").get();
    assert.ok(audit && audit.n >= 1, "應留設定變更稽核");
});

test("已設定後：不再顯示紅字，且下拉選中該群", async () => {
    const html = await (await get("/admin/line-bot")).text();
    assert.doesNotMatch(html, /尚未設定/, "已設定不應再有紅字");
    assert.match(html, /value="Cgroup_ops" selected/, "下拉應選中已設定群組");
});

test("測試告警：已設群組但無 token → notoken；清空群組 → nogroup", async () => {
    const r1 = await get("/admin/line-bot/ops-alert-test");
    assert.equal(r1.status, 302);
    assert.match(r1.headers.get("location") || "", /opstest=notoken/, "有群組無 token 應回 notoken");
    // 清空群組
    await postForm("/admin/line-bot", { line_bot_mode: "always_on", ops_alert_group_id: "" });
    const r2 = await get("/admin/line-bot/ops-alert-test");
    assert.match(r2.headers.get("location") || "", /opstest=nogroup/, "無群組應回 nogroup");
});

test("測試告警端點限經理", async () => {
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .run("admin_users", JSON.stringify([
            { username: "mgr1", name: "經理甲", passwordHash: "x:y", title: "經理", status: "active" },
            { username: "clerk1", name: "行政乙", passwordHash: "x:y", title: "行政", status: "active" },
        ]));
    const r = await fetch(baseUrl + "/admin/line-bot/ops-alert-test", {
        redirect: "manual", headers: { cookie: "sf_admin_session=" + signSession("clerk1") },
    });
    assert.equal(r.status, 403, "非經理應 403");
});
