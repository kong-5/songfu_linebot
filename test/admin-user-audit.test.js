"use strict";
/**
 * Smoke test：帳號（admin_users / app_settings 敏感項）異動稽核（2026-07-18）。
 * 鎖住 CLAUDE.md 守則 #3，且**絕不外洩密碼**：
 *   1. add / set-status / set-title / delete / reset-password 皆寫 data_change_log
 *   2. 任何稽核紀錄都不得含 passwordHash 或密碼明文
 *
 * 跑法：npm test。以「負責人」身分（經理＋可核准）打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-uaudit-"));
const SECRET = "test-secret-uaudit";
const OWNER = "s946185@gmail.com"; // ADMIN_OWNER_EMAIL 預設值 → 天生經理＋可核准
process.env.DB_PATH = path.join(TMP, "u.db");
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
        .run("admin_users", JSON.stringify([{ username: OWNER, name: "負責人", passwordHash: "x:y", title: "經理", status: "active" }]));
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((r) => (server ? server.close(r) : r())));

async function post(p, formStr) {
    const res = await fetch(baseUrl + p, {
        method: "POST", redirect: "manual",
        headers: { cookie: "sf_admin_session=" + signSession(OWNER), "content-type": "application/x-www-form-urlencoded" },
        body: formStr,
    });
    return { status: res.status, location: res.headers.get("location") };
}
async function auditActions(entityId) {
    return db.prepare("SELECT action FROM data_change_log WHERE entity_type='admin_user' AND entity_id=? ORDER BY created_at, id").all(entityId).then((r) => r.map((x) => x.action));
}

const PWD = "secret1234", NEWPWD = "newpass9999";

test("1. 帳號 add/set-status/set-title/reset-password/delete 全留痕", async () => {
    await post("/admin/users/add", `name=員工A&username=empA&password=${PWD}&title=行政`);
    await post("/admin/users/set-status", "username=empA&status=disabled");
    await post("/admin/users/set-title", "username=empA&title=課長&name=員工A");
    await post("/admin/users/reset-password", `username=empA&new_password=${NEWPWD}`);
    await post("/admin/users/delete", "username=empA");
    const acts = await auditActions("empA");
    for (const a of ["create", "set_status", "set_title", "reset_password", "delete"]) {
        assert.ok(acts.includes(a), `應有 ${a} 稽核（實際：${acts.join(",")}）`);
    }
});

test("2. 任何稽核紀錄都不得外洩密碼明文或 passwordHash", async () => {
    const all = await db.prepare("SELECT meta_json, summary FROM data_change_log").all();
    const blob = JSON.stringify(all);
    assert.ok(!blob.includes(PWD), "稽核不得含新增時的密碼明文");
    assert.ok(!blob.includes(NEWPWD), "稽核不得含重設的密碼明文");
    assert.ok(!blob.includes("passwordHash"), "稽核不得含 passwordHash 欄位");
});
