"use strict";
/**
 * Smoke test：報價管理「管理品項」的品項順序調整（2026-07-27）。
 * 鎖住的行為：
 *   1. planItemOrder＝純函式：只認該報價的 id、去重，表單沒送到的品項維持原相對順序接在最後。
 *   2. /admin/quotes/:id/save 帶 item_order → 寫回 sort_order，重讀順序＝送出的順序（同分類內）。
 *   3. 冪等：同一份 item_order 重送結果相同；沒帶 item_order（價格模式）完全不動順序。
 *   4. 跨分類拖曳＝連同 cat__ 一起送 → 分類與順序同時生效。
 *   5. 管理品項頁面有排序 UI（拖曳握把、↑↓、item_order 隱藏欄位）。
 *
 * 跑法：npm test（node --test test/）。實際 listen 隨機埠、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-quote-order-"));
const SECRET = "test-secret-quote-order";
process.env.DB_PATH = path.join(TMP, "smoke.db");
process.env.ADMIN_SESSION_SECRET = SECRET;
delete process.env.DATABASE_URL;

const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");
const quote = require("../dist/lib/quote-report.js");

function signSession(username) {
    const exp = Date.now() + 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}

let server;
let baseUrl;
let db;
let reportId;

const COOKIE = () => "sf_admin_session=" + signSession("tester");

/** 送出「管理品項」表單（只帶必要欄位；items 順序＝畫面順序）。 */
async function postSave(body) {
    const res = await fetch(baseUrl + "/admin/quotes/" + encodeURIComponent(reportId) + "/save?manage=1", {
        method: "POST",
        headers: { cookie: COOKIE(), "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
        redirect: "manual",
    });
    assert.equal(res.status, 302, "存檔後應轉回編輯頁");
    return res;
}

const namesOf = (items) => items.map((it) => it.name);

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    // 不帶入範本／上月，自己塞 5 項（菇菌類 3、生鮮蔬菜 2），順序好驗
    reportId = await quote.createReport(db, { ym: "2030-01", seedWhenEmpty: false });
    const seed = [
        ["菇菌類", "金針菇", 8],
        ["菇菌類", "秀珍菇", 120],
        ["菇菌類", "生香菇", 140],
        ["生鮮蔬菜", "芹菜", 180],
        ["生鮮蔬菜", "香菜", 500],
    ];
    let i = 0;
    for (const [category, name, price] of seed) {
        await quote.addItem(db, reportId, { category, name, spec: "KG", price, sort_order: i++ });
    }
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("1. planItemOrder：只認自家 id、去重，沒送到的排最後", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    // 正常重排
    assert.deepEqual(quote.planItemOrder(items, ["c", "a", "b"]), ["c", "a", "b"]);
    // 外來 id 與重複 id 一律忽略；漏送的 b 維持原相對順序接在最後
    assert.deepEqual(quote.planItemOrder(items, ["c", "zzz", "c", "a"]), ["c", "a", "b"]);
    // 空表單＝完全不動
    assert.deepEqual(quote.planItemOrder(items, []), ["a", "b", "c"]);
    // 空白／null 元素不會炸也不會佔位
    assert.deepEqual(quote.planItemOrder(items, ["", null, "b"]), ["b", "a", "c"]);
});

test("2. 管理品項頁有排序 UI（握把／↑↓／item_order）", async () => {
    const res = await fetch(baseUrl + "/admin/quotes/" + encodeURIComponent(reportId) + "?manage=1", { headers: { cookie: COOKIE() } });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /name="item_order"/, "要有帶回順序的隱藏欄位");
    assert.match(html, /class="qe-drag"/, "要有拖曳握把");
    assert.match(html, /data-mv="-1"/, "要有上移按鈕");
    assert.match(html, /data-mv="1"/, "要有下移按鈕");
    assert.match(html, /class="qe-grp" data-cat=/, "分類要包成拖放容器");
    // 價格模式不該出現排序 UI（每月主要操作只改價，避免誤拖）
    const priceRes = await fetch(baseUrl + "/admin/quotes/" + encodeURIComponent(reportId), { headers: { cookie: COOKIE() } });
    const priceHtml = await priceRes.text();
    assert.ok(!/name="item_order"/.test(priceHtml), "價格模式不送順序");
});

test("3. 送出 item_order → 分類內順序照畫面存回", async () => {
    const before = await quote.getItems(db, reportId);
    assert.deepEqual(namesOf(before), ["金針菇", "秀珍菇", "生香菇", "芹菜", "香菜"]);
    const ids = Object.fromEntries(before.map((it) => [it.name, it.id]));
    // 菇菌類倒過來：生香菇 → 金針菇 → 秀珍菇；生鮮蔬菜也對調
    const order = ["生香菇", "金針菇", "秀珍菇", "香菜", "芹菜"].map((n) => ids[n]);
    const body = { item_order: order.join(",") };
    for (const it of before) body["row__" + it.id] = "1";
    await postSave(body);
    const after = await quote.getItems(db, reportId);
    assert.deepEqual(namesOf(after), ["生香菇", "金針菇", "秀珍菇", "香菜", "芹菜"]);
    // sort_order 應為連續 0..N-1（不留重複／跳號）
    assert.deepEqual(after.map((it) => it.sort_order), [0, 1, 2, 3, 4]);
});

test("4. 冪等：同一份順序重送結果相同；不帶 item_order 不動順序", async () => {
    const cur = await quote.getItems(db, reportId);
    const body = { item_order: cur.map((it) => it.id).join(",") };
    for (const it of cur) body["row__" + it.id] = "1";
    await postSave(body);
    await postSave(body);
    const again = await quote.getItems(db, reportId);
    assert.deepEqual(namesOf(again), namesOf(cur));
    assert.deepEqual(again.map((it) => it.sort_order), [0, 1, 2, 3, 4]);

    // 價格模式：只送價格、沒有 item_order → 順序原封不動
    const priceBody = {};
    for (const it of cur) { priceBody["row__" + it.id] = "1"; priceBody["price__" + it.id] = "99"; }
    await postSave(priceBody);
    const afterPrice = await quote.getItems(db, reportId);
    assert.deepEqual(namesOf(afterPrice), namesOf(cur), "沒帶順序就不該動順序");
    assert.equal(String(afterPrice[0].price), "99", "價格仍有存到");
});

test("5. 跨分類拖曳：分類與順序同時生效", async () => {
    const cur = await quote.getItems(db, reportId);
    const ids = Object.fromEntries(cur.map((it) => [it.name, it.id]));
    // 把「香菜」拖進菇菌類的最前面（前端會同步該列的分類下拉，所以連 cat__ 一起送）
    const order = ["香菜", "生香菇", "金針菇", "秀珍菇", "芹菜"].map((n) => ids[n]);
    const body = { item_order: order.join(",") };
    for (const it of cur) {
        body["row__" + it.id] = "1";
        body["cat__" + it.id] = it.name === "香菜" ? "菇菌類" : it.category;
    }
    await postSave(body);
    const after = await quote.getItems(db, reportId);
    assert.deepEqual(namesOf(after), ["香菜", "生香菇", "金針菇", "秀珍菇", "芹菜"]);
    assert.equal(after[0].category, "菇菌類", "香菜應改到菇菌類");
});

test("6. 順序異動有寫稽核軌跡", async () => {
    const rows = await db.prepare(
        "SELECT * FROM data_change_log WHERE entity_type = ? AND entity_id = ? ORDER BY id"
    ).all("quote_item_order", reportId);
    assert.ok(rows.length >= 2, "至少 2 次真的有動到順序（test 3 與 test 5）");
    const meta = JSON.parse(rows[rows.length - 1].meta_json);
    assert.deepEqual(meta.after, ["香菜", "生香菇", "金針菇", "秀珍菇", "芹菜"]);
    assert.equal(rows[rows.length - 1].actor_username, "tester");
});
