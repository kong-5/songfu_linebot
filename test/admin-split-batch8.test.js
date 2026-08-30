"use strict";
/**
 * Smoke test：拆檔批次 8（待確認品項／匯出備份／凌越機器端點／AI 設定／匯入五域拆出）。
 * 這批含**唯一的機器介面**（/lingyue-writeback/*，內網代理以 X-Writeback-Key 認證），
 * 所以除了頁面能開，另外鎖住：
 *   1. 機器端點的金鑰閘門沒被拆壞（無金鑰要擋、正確金鑰要放行）
 *   2. cash.js 的註冊呼叫留在 index.js（它夾在凌越區間中間，批次 2 已定案位置不可移動）
 *   3. inventory-push 內那顆刻意的 NUL byte（Map key 分隔字元）隨程式碼搬到新檔且保留
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-split8-"));
const SECRET = "test-secret-split8";
process.env.DB_PATH = path.join(TMP, "split8.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
process.env.LINGYUE_WRITEBACK_KEY = "test-writeback-key";
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
        .run("admin_users", JSON.stringify([{ username: "ops8", name: "批次八經理", passwordHash: "x:y", title: "經理", status: "active" }]));
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function get(p, extraHeaders) {
    const res = await fetch(baseUrl + p, {
        redirect: "manual",
        headers: Object.assign({ cookie: "sf_admin_session=" + signSession("ops8") }, extraHeaders || {}),
    });
    return { status: res.status, text: await res.text() };
}

test("五個拆出模組都有匯出 registerXxxRoutes", () => {
    assert.equal(typeof require("../dist/admin/review.js").registerReviewRoutes, "function");
    assert.equal(typeof require("../dist/admin/export-backup.js").registerExportBackupRoutes, "function");
    assert.equal(typeof require("../dist/admin/lingyue-writeback.js").registerLingyueWritebackRoutes, "function");
    assert.equal(typeof require("../dist/admin/ai-settings.js").registerAiSettingsRoutes, "function");
    assert.equal(typeof require("../dist/admin/imports.js").registerImportsRoutes, "function");
});

test("凌越機器端點：金鑰閘門沒被拆壞（無金鑰擋下、正確金鑰放行）", async () => {
    const noKey = await fetch(baseUrl + "/admin/lingyue-writeback/pending", { redirect: "manual" });
    assert.ok(noKey.status === 401 || noKey.status === 403, "無金鑰應被擋（401/403），實得 " + noKey.status);
    const withKey = await fetch(baseUrl + "/admin/lingyue-writeback/pending", {
        redirect: "manual", headers: { "X-Writeback-Key": "test-writeback-key" },
    });
    assert.equal(withKey.status, 200, "帶正確金鑰應放行");
    JSON.parse(await withKey.text()); // 應回合法 JSON
});

test("凌越機器端點：錯誤金鑰仍被擋", async () => {
    const bad = await fetch(baseUrl + "/admin/lingyue-writeback/pending", {
        redirect: "manual", headers: { "X-Writeback-Key": "wrong-key" },
    });
    assert.ok(bad.status === 401 || bad.status === 403, "錯誤金鑰應被擋，實得 " + bad.status);
});

test("待確認品項域：/review 可開", async () => {
    assert.equal((await get("/admin/review")).status, 200);
});

test("匯出備份域：/export 與 /backup 可開", async () => {
    assert.equal((await get("/admin/export")).status, 200);
    assert.equal((await get("/admin/backup")).status, 200);
});

test("AI 設定域：/gemini-prompts 與 /ai-examples 可開", async () => {
    assert.equal((await get("/admin/gemini-prompts")).status, 200);
    assert.equal((await get("/admin/ai-examples")).status, 200);
});

test("匯入域：/import、/import-customers、/import-teraoka 三頁可開", async () => {
    for (const p of ["/admin/import", "/admin/import-customers", "/admin/import-teraoka"]) {
        assert.equal((await get(p)).status, 200, p + " 應回 200");
    }
});

test("收款域註冊呼叫留在 index.js：/cash 路由仍在（夾在凌越區間中間、位置不可移動）", async () => {
    // 每日帳款收款 2026-08-30 起預設停用（requireCash 會擋）；這支測的是路由註冊位置，先把總開關打開。
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_sales_enabled", "1");
    const r = await get("/admin/cash/collect?icpno=00");
    assert.equal(r.status, 200, "/cash/collect 應仍可用");
});

test("inventory-push 的 NUL byte 隨程式碼搬到 lingyue-writeback.js 且保留", () => {
    const lw = fs.readFileSync(path.join(__dirname, "..", "dist", "admin", "lingyue-writeback.js"));
    assert.equal(lw.filter((b) => b === 0).length, 1, "分倉 Map key 的 NUL 分隔字元必須原樣保留");
});
