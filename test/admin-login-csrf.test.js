"use strict";
/**
 * Smoke test：登入節流與跨站寫入防護（2026-09-01 體檢）。
 *
 * 舊版兩個洞：
 *   1. 節流 key 取 X-Forwarded-For 的第一段＝完全由用戶端自填，每次換一個值就換一把 key，
 *      線上密碼爆破等於沒有節流；而且 loginFails.size > 1000 就整個 clear()，
 *      攻擊者塞 1000 把假 key 還能主動清空所有計數。
 *   2. 全站沒有 CSRF token，唯一防線是 SameSite=Lax。Lax 擋不住 GET 型破壞性操作
 *      （系統確實存在 GET + /delete 的模式），舊瀏覽器也可能把 Lax 當 None。
 *
 * 鎖住：
 *   - 換 IP（偽造 XFF）不能繞過節流：帳號層級的計數不看 IP
 *   - 跨站來源的非 GET 請求一律 403
 *   - 同源、以及沒有 Origin/Referer 的非瀏覽器客戶端（內網代理）不受影響
 *
 * 跑法：npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-csrf-"));
const SECRET = "test-secret-csrf";
process.env.DB_PATH = path.join(TMP, "csrf.db");
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
let server, baseUrl, db, host;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "u1", name: "管理員", passwordHash: "x:y", title: "經理", status: "active" }]));
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
    host = "127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((r) => (server ? server.close(r) : r())));

/** 用偽造的 X-Forwarded-For 打一次錯誤登入 */
async function badLogin(xff) {
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    if (xff) headers["X-Forwarded-For"] = xff;
    const res = await fetch(baseUrl + "/admin/login", {
        method: "POST", redirect: "manual", headers,
        body: "username=u1&password=wrong",
    });
    return String(res.headers.get("location") || "");
}

test("1. 每次換一個偽造的 X-Forwarded-For 也躲不過節流（帳號層級計數不看 IP）", async () => {
    let throttledAt = -1;
    // 每次都換一個全新的 XFF —— 舊版做法下這等於永遠不會被擋
    for (let i = 0; i < 25; i++) {
        const loc = await badLogin(`1.2.3.${i}, 10.0.0.${i}`);
        if (loc.includes("err=throttled")) { throttledAt = i; break; }
    }
    assert.ok(throttledAt > 0, "連續換 IP 失敗 25 次都沒被擋 → 節流可被 XFF 繞過（回到舊洞）");
    assert.ok(throttledAt <= 21, `第 ${throttledAt + 1} 次才擋，門檻應在 20 次上下`);
});

test("2. 節流訊息不洩漏帳號是否存在（不存在的帳號也走同一條路）", async () => {
    const res = await fetch(baseUrl + "/admin/login", {
        method: "POST", redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "username=nobody_at_all&password=wrong",
    });
    const loc = String(res.headers.get("location") || "");
    assert.match(loc, /err=1|err=throttled/, "不存在的帳號要跟密碼錯誤回一樣的結果");
});

test("3. 跨站來源的 POST → 403（Origin 不同源）", async () => {
    const res = await fetch(baseUrl + "/admin/customers/new", {
        method: "POST", redirect: "manual",
        headers: {
            cookie: "sf_admin_session=" + signSession("u1"),
            "Content-Type": "application/x-www-form-urlencoded",
            origin: "https://evil.example.com",
        },
        body: "name=壞人建的客戶",
    });
    assert.equal(res.status, 403, "跨站寫入必須被擋");
    const body = await res.text();
    assert.match(body, /跨站/, "錯誤訊息要說明發生什麼事（守則 #4）");
});

test("4. 只帶 Referer 的跨站 POST 也要擋（有些瀏覽器不送 Origin）", async () => {
    const res = await fetch(baseUrl + "/admin/customers/new", {
        method: "POST", redirect: "manual",
        headers: {
            cookie: "sf_admin_session=" + signSession("u1"),
            "Content-Type": "application/x-www-form-urlencoded",
            referer: "https://evil.example.com/attack.html",
        },
        body: "name=壞人建的客戶",
    });
    assert.equal(res.status, 403);
});

test("5. 同源的 POST 不受影響（後台自己的表單照常運作）", async () => {
    const res = await fetch(baseUrl + "/admin/customers/new", {
        method: "POST", redirect: "manual",
        headers: {
            cookie: "sf_admin_session=" + signSession("u1"),
            "Content-Type": "application/x-www-form-urlencoded",
            origin: "http://" + host,
        },
        body: "name=正常客戶",
    });
    assert.notEqual(res.status, 403, "同源請求不該被 CSRF 檢查擋掉");
});

test("6. 沒有 Origin/Referer 的非瀏覽器客戶端不受影響（內網代理、curl）", async () => {
    const res = await fetch(baseUrl + "/admin/customers/new", {
        method: "POST", redirect: "manual",
        headers: {
            cookie: "sf_admin_session=" + signSession("u1"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "name=代理建的客戶",
    });
    assert.notEqual(res.status, 403, "CSRF 需要瀏覽器才成立；擋掉無 Origin 會打斷機器客戶端");
});

test("7. GET 不受同源檢查影響（否則從外部連結點進後台就壞了）", async () => {
    const res = await fetch(baseUrl + "/admin/customers", {
        redirect: "manual",
        headers: { cookie: "sf_admin_session=" + signSession("u1"), referer: "https://mail.google.com/" },
    });
    assert.notEqual(res.status, 403);
});

test("8. 不變式：節流不得回到「XFF 第一段」與「clear() 全清」的舊寫法", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "dist", "admin", "index.js"), "utf8");
    assert.ok(!/x-forwarded-for"\]\s*\|\|\s*req\.ip\s*\|\|\s*""\)\.split\(","\)\[0\]/.test(src),
        "XFF 取第一段＝用戶端自填，等於沒有節流");
    assert.ok(!/loginFails\.clear\(\)/.test(src),
        "loginFails.clear() 讓攻擊者塞爆就能解鎖，要用淘汰最舊的一批取代");
    assert.match(src, /user\|" \+ username/, "必須保留一條不看 IP 的帳號層級計數");
});
