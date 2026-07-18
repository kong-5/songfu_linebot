"use strict";
/**
 * Smoke test：拆分批次 1——無狀態表現層 helper 抽到 dist/admin/_shared.js（2026-07-18）。
 * 鎖住：
 *   1. _shared 匯出的純函式行為正確（escapeHtml/escapeAttr/escJsStr/sfInlineIcon/SF_ICONS）
 *   2. index.js 改用 import 後，真實後台頁面仍能渲染出 SF_ICONS 的 SVG（端到端接通、非只語法過）
 *
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const shared = require("../dist/admin/_shared.js");

test("1. _shared 純函式行為正確", () => {
    assert.equal(shared.escapeHtml('<a>&"x"'), "&lt;a&gt;&amp;&quot;x&quot;");
    assert.equal(shared.escapeHtml(null), "");
    assert.equal(shared.escapeAttr("o'k"), "o&#39;k");
    assert.equal(shared.escJsStr("a'b\nc"), "a\\'b c");
    assert.ok(shared.sfInlineIcon("check").includes("<span class=\"sfi\">"));
    assert.ok(shared.sfInlineIcon("check").includes("<svg"));
    assert.equal(shared.sfInlineIcon("no_such_icon"), '<span class="sfi"></span>');
    assert.ok(Object.keys(shared.SF_ICONS).length >= 40, "圖示數量應完整搬移");
    assert.ok(shared.SF_ICONS.truck.startsWith("<svg"));
});

test("2. index.js 改用 import 後仍與同一份 _shared 一致（無重複定義）", () => {
    // index.js 內不得再有這些定義（避免重複維護漂移）
    const src = fs.readFileSync(path.join(__dirname, "..", "dist", "admin", "index.js"), "utf8");
    assert.ok(!/^const SF_ICONS = \{/m.test(src), "index.js 不應再自帶 SF_ICONS 定義");
    assert.ok(!/^function escapeHtml\(/m.test(src), "index.js 不應再自帶 escapeHtml 定義");
    assert.ok(/require\("\.\/_shared\.js"\)/.test(src), "index.js 應 require ./_shared.js");
});

test("3. 真實後台頁面渲染出 SF_ICONS 的 SVG（端到端接通）", async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-shared-"));
    const SECRET = "test-secret-shared";
    process.env.DB_PATH = path.join(TMP, "s.db");
    process.env.ADMIN_SESSION_SECRET = SECRET;
    delete process.env.DATABASE_URL;
    const express = require("express");
    const { initDb, getDb } = require("../dist/db/index.js");
    const { createAdminRouter } = require("../dist/admin/index.js");
    await initDb(process.env.DB_PATH);
    const db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "v", name: "檢視員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const app = express();
    app.use("/admin", createAdminRouter());
    const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    try {
        const exp = Date.now() + 3600e3;
        const payload = Buffer.from(JSON.stringify({ u: "v", exp })).toString("base64url");
        const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
        const res = await fetch("http://127.0.0.1:" + server.address().port + "/admin/customers/new", {
            headers: { cookie: "sf_admin_session=" + payload + "." + sig },
        });
        const html = await res.text();
        assert.equal(res.status, 200);
        assert.ok(html.includes("<svg"), "頁面殼層應渲染出 SF_ICONS 的 SVG（import 端到端接通）");
        assert.ok(html.includes("新增客戶"), "頁面內容應正常渲染");
    } finally {
        await new Promise((r) => server.close(r));
    }
});
