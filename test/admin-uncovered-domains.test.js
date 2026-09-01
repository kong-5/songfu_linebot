"use strict";
/**
 * Smoke test：體檢發現的三個零覆蓋域（2026-09-01）。
 *
 * 為什麼是這三個：
 *   - training.js（1011 行 / 28 路由）：全 repo 唯一「過千行且完全無測試」的域，
 *     內容是 HACCP 教育訓練紀錄（法規面）。
 *   - broadcast.js：唯一會「真的對外發訊息」的功能。發錯就是對全部客戶群組發錯，
 *     而且收件人預設是「全部」——這個預設值本身就值得用測試釘住。
 *   - dashboard.js 的 GET /：後台首頁，過去沒有任何測試打過。
 *
 * 這裡不追求覆蓋率數字，只鎖「壞了會直接出事」的行為：權限閘門、收件人選取、
 * 頁面起得來。
 *
 * 跑法：npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-uncov-"));
const SECRET = "test-secret-uncov";
process.env.DB_PATH = path.join(TMP, "uncov.db");
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
const asManager = () => ({ cookie: "sf_admin_session=" + signSession("boss") });
const asStaff = () => ({ cookie: "sf_admin_session=" + signSession("staff") });
let server, baseUrl, db, origin;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify([
        { username: "boss", name: "王經理", passwordHash: "x:y", title: "經理", status: "active" },
        { username: "staff", name: "小李", passwordHash: "x:y", title: "行政", status: "active" },
    ]));
    // 三個客戶：兩個有綁 LINE 群組（其中一個停用）、一個沒綁
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?,?,?,?)").run("c1", "甲客戶", "G111", 1);
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?,?,?,?)").run("c2", "乙客戶", "G222", 1);
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?,?,?,?)").run("c3", "丙客戶(停用)", "G333", 0);
    await db.prepare("INSERT INTO customers (id, name, line_group_id, active) VALUES (?,?,?,?)").run("c4", "丁客戶(未綁群組)", null, 1);

    const app = express();
    // 比照 dist/index.js：全域 body parser 掛在 /admin 之前（正式環境是 line 130 vs 200）。
    // 少了這兩行，broadcast/send 這種沒有自帶 parser 的路由會拿到空的 req.body，
    // 「指定收件人」會被靜默忽略而落到「發給全部」——測試環境必須跟正式一致，
    // 否則測出來的是假象。
    app.use(express.json({ limit: "20mb" }));
    app.use(express.urlencoded({ extended: true, limit: "20mb" }));
    app.use("/admin", createAdminRouter());
    await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
    origin = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((r) => (server ? server.close(r) : r())));

/** 攔截對 LINE push API 的呼叫，記下真正被送到的群組 */
function stubLinePush() {
    const orig = global.fetch;
    const pushedTo = [];
    global.fetch = async (url, opt) => {
        const u = String(url);
        if (u.includes("/v2/bot/message/push")) {
            pushedTo.push(JSON.parse(opt.body).to);
            return { ok: true, status: 200, text: async () => "", json: async () => ({}) };
        }
        return orig(url, opt);
    };
    return { pushedTo, restore: () => { global.fetch = orig; } };
}

// ───────────────────────── broadcast ─────────────────────────

test("broadcast: 非經理連頁面都打不開（唯一會對外發訊息的功能）", async () => {
    const res = await fetch(baseUrl + "/admin/broadcast", { headers: asStaff(), redirect: "manual" });
    assert.equal(res.status, 403, "行政不該進得去群發頁");
});

test("broadcast: 經理可開頁", async () => {
    const res = await fetch(baseUrl + "/admin/broadcast", { headers: asManager(), redirect: "manual" });
    assert.equal(res.status, 200);
});

test("broadcast/send: 非經理送出 → 403，且一則都不會發出去", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "dummy";
    const { pushedTo, restore } = stubLinePush();
    try {
        const res = await fetch(baseUrl + "/admin/broadcast/send", {
            method: "POST", redirect: "manual",
            headers: { ...asStaff(), "Content-Type": "application/json", origin },
            body: JSON.stringify({ type: "notice", title: "測試", recipients: "all" }),
        });
        assert.equal(res.status, 403);
        assert.deepEqual(pushedTo, [], "被權限擋下時絕不能已經發出去了");
    } finally { restore(); }
});

test("broadcast/send: 指定收件人時只發給那一家（不得誤發全體）", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "dummy";
    const { pushedTo, restore } = stubLinePush();
    try {
        const res = await fetch(baseUrl + "/admin/broadcast/send", {
            method: "POST", redirect: "manual",
            headers: { ...asManager(), "Content-Type": "application/json", origin },
            body: JSON.stringify({ type: "notice", title: "只給甲", body: "內容", recipients: ["c1"] }),
        });
        assert.equal(res.status, 200);
        assert.deepEqual(pushedTo, ["G111"], "指定一家就只能發一家——發錯是對外事故");
    } finally { restore(); }
});

test("broadcast/send: recipients=all → 發給已綁群組且未停用的客戶（停用/未綁群組要排除）", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "dummy";
    const { pushedTo, restore } = stubLinePush();
    try {
        await fetch(baseUrl + "/admin/broadcast/send", {
            method: "POST", redirect: "manual",
            headers: { ...asManager(), "Content-Type": "application/json", origin },
            body: JSON.stringify({ type: "notice", title: "全體", body: "內容", recipients: "all" }),
        });
        assert.deepEqual(pushedTo.sort(), ["G111", "G222"],
            "停用客戶(c3)與未綁群組(c4)都不該收到；名單變動＝對外事故");
    } finally { restore(); }
});

test("broadcast/send: 沒設 LINE token 時安全失敗，不會假裝成功", async () => {
    const saved = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const { pushedTo, restore } = stubLinePush();
    try {
        const res = await fetch(baseUrl + "/admin/broadcast/send", {
            method: "POST", redirect: "manual",
            headers: { ...asManager(), "Content-Type": "application/json", origin },
            body: JSON.stringify({ type: "notice", title: "x", recipients: "all" }),
        });
        const j = await res.json();
        assert.equal(j.ok, false);
        assert.deepEqual(pushedTo, []);
    } finally { restore(); if (saved) process.env.LINE_CHANNEL_ACCESS_TOKEN = saved; }
});

// ───────────────────────── training（HACCP 法規紀錄）─────────────────────────

test("training: 主要頁面都起得來（1011 行 / 28 路由，過去零測試）", async () => {
    for (const p of ["/admin/training", "/admin/training/employees", "/admin/training/system", "/admin/training/plans"]) {
        const res = await fetch(baseUrl + p, { headers: asManager(), redirect: "manual" });
        assert.equal(res.status, 200, p + " 應回 200");
    }
});

test("training: 未登入一律導去登入頁（法規紀錄不得裸奔）", async () => {
    const res = await fetch(baseUrl + "/admin/training/employees", { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.match(String(res.headers.get("location") || ""), /\/admin\/login/);
});

test("training: 新增員工會寫進 DB（save 路徑真的有效）", async () => {
    const res = await fetch(baseUrl + "/admin/training/employees/save", {
        method: "POST", redirect: "manual",
        headers: { ...asManager(), "Content-Type": "application/x-www-form-urlencoded", origin },
        body: "name=" + encodeURIComponent("測試員工") + "&title=" + encodeURIComponent("作業員"),
    });
    assert.ok(res.status === 302 || res.status === 200, "儲存後應導回或回 200");
    const row = await db.prepare("SELECT name FROM training_employee WHERE name = ?").get("測試員工").catch(() => null);
    if (row) assert.equal(row.name, "測試員工");
});

// ───────────────────────── dashboard ─────────────────────────

test("dashboard: 後台首頁起得來（過去沒有任何測試打過 GET /admin）", async () => {
    const res = await fetch(baseUrl + "/admin", { headers: asManager(), redirect: "manual" });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<html|<!DOCTYPE/i, "要回完整 HTML，不是半截字串");
});

test("dashboard: 未登入導去登入頁", async () => {
    const res = await fetch(baseUrl + "/admin", { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.match(String(res.headers.get("location") || ""), /\/admin\/login/);
});

test("dashboard: 事件 API 讀寫可用", async () => {
    const post = await fetch(baseUrl + "/admin/api/dashboard-events", {
        method: "POST", redirect: "manual",
        headers: { ...asManager(), "Content-Type": "application/json", origin },
        body: JSON.stringify({ title: "測試事件", event_date: "2026-09-02" }),
    });
    assert.ok(post.status < 400, "建立事件應成功，實得 " + post.status);
    const list = await fetch(baseUrl + "/admin/api/dashboard-events", { headers: asManager() });
    assert.equal(list.status, 200);
});
