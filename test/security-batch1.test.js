"use strict";
/**
 * Smoke test：資安修復批次 1（地毯式盤查 2026-07-28 的 Top 資安項）。
 * 鎖住兩件事，避免日後回歸：
 *   1. LINE webhook fail-closed：未設 LINE_CHANNEL_SECRET/ACCESS_TOKEN 時 POST /webhook 一律 503
 *      （舊版是 next() 放行＝任何人可偽造建單）。因 hasLineConfig 於模組載入時定值、會被其他測試檔
 *      的環境變數污染，這條放在乾淨環境的子行程跑。
 *   2. 整庫 JSON 備份只限經理，且不帶出憑證類 app_settings（admin_users 密碼雜湊／綁定碼）。
 *
 * 跑法：npm test（node --test test/*.test.js）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-secbatch1-"));
const SECRET = "test-secret-secbatch1";
process.env.DB_PATH = path.join(TMP, "sec1.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");

const SECRET_HASH = "pbkdf2$deadbeefsaltXYZ$hashvalue-should-never-leak-in-backup";
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
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify([
        { username: "mgr1", name: "經理甲", passwordHash: SECRET_HASH, title: "經理", status: "active" },
        { username: "clerk1", name: "行政乙", passwordHash: SECRET_HASH, title: "行政", status: "active" },
    ]));
    // 一筆一次性綁定 token、一筆員工綁定碼（皆屬憑證，備份必須遮蔽），加一筆正常營運設定當對照
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run("liff_bind_token_abc123", JSON.stringify({ username: "clerk1", expiresAt: Date.now() + 1000 }));
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run("line_bind_code_555", JSON.stringify({ employeeId: "e1" }));
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run("ops_alert_group_id", "Cgroup123");
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

function reqAs(username, p) {
    return fetch(baseUrl + p, { redirect: "manual", headers: { cookie: "sf_admin_session=" + signSession(username) } });
}

test("備份／匯出四支端點：非經理一律 403", async () => {
    for (const p of ["/admin/backup", "/admin/backup/download-json", "/admin/export", "/admin/export/download?date=2026-07-28"]) {
        const r = await reqAs("clerk1", p);
        assert.equal(r.status, 403, p + " 非經理應 403，實得 " + r.status);
    }
});

test("備份／匯出：經理可用", async () => {
    assert.equal((await reqAs("mgr1", "/admin/backup")).status, 200);
    assert.equal((await reqAs("mgr1", "/admin/backup/download-json")).status, 200);
});

test("整庫備份不帶出憑證類 app_settings，且正常設定仍保留", async () => {
    const r = await reqAs("mgr1", "/admin/backup/download-json");
    assert.equal(r.status, 200);
    const raw = await r.text();
    // 密碼雜湊絕不可出現在備份檔任何位置
    assert.ok(!raw.includes(SECRET_HASH), "備份不得含密碼雜湊");
    const payload = JSON.parse(raw);
    const keys = (payload.tables.app_settings || []).map((r) => r.key);
    assert.ok(!keys.includes("admin_users"), "admin_users 應被遮蔽");
    assert.ok(!keys.some((k) => k.startsWith("liff_bind_token_")), "liff_bind_token_* 應被遮蔽");
    assert.ok(!keys.some((k) => k.startsWith("line_bind_code_")), "line_bind_code_* 應被遮蔽");
    assert.ok(keys.includes("ops_alert_group_id"), "正常營運設定仍應保留");
    assert.equal(payload.redactedSensitiveSettings, 3, "應回報遮蔽 3 筆敏感設定");
});

test("備份下載寫入稽核軌跡", async () => {
    await reqAs("mgr1", "/admin/backup/download-json");
    const row = await db.prepare("SELECT COUNT(*) AS n FROM data_change_log WHERE entity_type = 'backup' AND action = 'download_json'").get();
    assert.ok(row && row.n >= 1, "備份下載應留稽核，實得 " + (row && row.n));
});

test("LINE webhook fail-closed：未設 secret 時 POST /webhook 回 503（子行程乾淨環境）", () => {
    const script = `
        delete process.env.LINE_CHANNEL_SECRET;
        delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
        delete process.env.DATABASE_URL;
        process.env.DB_PATH = ${JSON.stringify(path.join(TMP, "wh.db"))};
        const express = require(${JSON.stringify(path.join(__dirname, "..", "node_modules", "express"))});
        const { initDb } = require(${JSON.stringify(path.join(__dirname, "..", "dist", "db", "index.js"))});
        const { createLineWebhook } = require(${JSON.stringify(path.join(__dirname, "..", "dist", "webhook", "line.js"))});
        (async () => {
            await initDb(process.env.DB_PATH);
            const app = express();
            app.use("/webhook", express.json(), createLineWebhook());
            const server = app.listen(0, "127.0.0.1", async () => {
                const port = server.address().port;
                const r = await fetch("http://127.0.0.1:" + port + "/webhook", {
                    method: "POST", headers: { "content-type": "application/json" }, body: '{"events":[]}',
                });
                console.log("WEBHOOK_STATUS " + r.status);
                server.close();
                process.exit(r.status === 503 ? 0 : 1);
            });
        })().catch((e) => { console.error(e); process.exit(2); });
    `;
    const scriptPath = path.join(TMP, "webhook-failclosed.js");
    fs.writeFileSync(scriptPath, script);
    const out = execFileSync(process.execPath, [scriptPath], { encoding: "utf8" });
    assert.match(out, /WEBHOOK_STATUS 503/, "未設 secret 時 POST /webhook 應回 503，輸出：" + out);
});
