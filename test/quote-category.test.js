"use strict";
/**
 * Smoke test：報價「大類（分類）」維護（2026-07-30 新增）。
 * 背景：大類原本寫死在 quote-report.js 的陣列，後台加不了新大類（如「冷凍包子類」）。
 * 鎖住的行為：
 *   1. 首次讀取把內建清單帶入 quote_category（冪等，重跑不會變多／不會重排）。
 *   2. 新增大類：可指定插在某大類之後，也可接在最後；同名重複＝不新增也不改順序。
 *   3. 上下移一格會改變顯示順序，且真的影響 getItems／getItemsGrouped 的分群順序。
 *   4. 刪除：底下還有品項一律擋下並回可修正的訊息；清空後才能刪。
 *   5. 冷凍與青菜兩組大類各自獨立（改冷凍不會動到青菜）。
 *   6. 後台路由：category-add／category-move／category-delete 走得通，管理品項頁列得出大類、
 *      新增的空大類會出現虛線落點框（.qe-grp）可以直接拖品項進去。
 *
 * 跑法：npm test（node --test test/）。實際 listen 隨機埠、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-quote-cat-"));
const SECRET = "test-secret-quote-cat";
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
let frozenId;
let vegId;

const COOKIE = () => "sf_admin_session=" + signSession("tester");

/** POST 大類維護端點（表單編碼、手動接 302）。回傳 { status, location }。 */
async function postCat(action, body) {
    const res = await fetch(baseUrl + "/admin/quotes/" + action, {
        method: "POST",
        headers: { cookie: COOKIE(), "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
        redirect: "manual",
    });
    return { status: res.status, location: res.headers.get("location") || "" };
}

const getHtml = async (url) => {
    const res = await fetch(baseUrl + url, { headers: { cookie: COOKIE() } });
    assert.equal(res.status, 200, url + " 應回 200");
    return await res.text();
};

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    vegId = await quote.createReport(db, { ym: "2031-01", seedWhenEmpty: false });
    await quote.addItem(db, vegId, { category: "生鮮蔬菜", name: "芹菜", spec: "KG", price: "180" });
    frozenId = await quote.createFrozenQuote(db, { ym: "2031-01" });
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("1. 內建清單一次性帶入 quote_category，且重跑冪等", async () => {
    const first = await quote.listCategories(db, "frozen");
    assert.deepEqual(first, quote.FROZEN_CATEGORY_ORDER, "首次讀取＝內建冷凍大類清單");

    const again = await quote.listCategories(db, "frozen");
    assert.deepEqual(again, first, "重讀順序不變");
    const cnt = await db.prepare("SELECT COUNT(*) AS n FROM quote_category WHERE kind = ?").get("frozen");
    assert.equal(Number(cnt.n), quote.FROZEN_CATEGORY_ORDER.length, "不會因為重讀而變多");

    const veg = await quote.listCategories(db, "monthly");
    assert.deepEqual(veg, quote.CATEGORY_ORDER, "青菜那組帶的是青菜內建清單");
});

test("2. 新增大類：可插在指定大類之後，同名重複不再新增", async () => {
    const r = await quote.addCategory(db, "frozen", "冷凍包子類", "包子饅頭");
    assert.equal(r.added, true);
    const order = await quote.listCategories(db, "frozen");
    assert.equal(order[0], "包子饅頭");
    assert.equal(order[1], "冷凍包子類", "應插在「包子饅頭」正後方");
    assert.equal(order.length, quote.FROZEN_CATEGORY_ORDER.length + 1);

    const dup = await quote.addCategory(db, "frozen", " 冷凍包子類 ", "");
    assert.equal(dup.added, false, "同名（去空白後）不重複新增");
    assert.deepEqual(await quote.listCategories(db, "frozen"), order, "重複新增不會改動順序");

    const tail = await quote.addCategory(db, "frozen", "冷凍湯品", "");
    assert.equal(tail.added, true);
    const order2 = await quote.listCategories(db, "frozen");
    assert.equal(order2[order2.length - 1], "冷凍湯品", "沒指定位置＝接在最後面");

    await assert.rejects(() => quote.addCategory(db, "frozen", "   ", ""), /請輸入大類名稱/);
    await assert.rejects(() => quote.addCategory(db, "frozen", "一".repeat(21), ""), /20 字/);
});

test("3. 上下移一格會改變分群順序（品項真的跟著跑）", async () => {
    // 把新大類放到最前面，再確認 getItemsGrouped 的分群順序跟著改。
    await quote.addItem(db, frozenId, { category: "冷凍包子類", name: "測試手工包", spec: "10粒/包", price: "150" });
    const before = await quote.listCategories(db, "frozen");
    assert.equal(before.indexOf("冷凍包子類"), 1);

    const moved = await quote.moveCategory(db, "frozen", "冷凍包子類", -1);
    assert.equal(moved.moved, true);
    const after = await quote.listCategories(db, "frozen");
    assert.equal(after.indexOf("冷凍包子類"), 0, "上移一格＝排到最前面");

    const groups = await quote.getItemsGrouped(db, frozenId, after);
    assert.equal(groups[0].category, "冷凍包子類", "分群順序要跟著大類順序");
    assert.equal(groups[0].items[0].name, "測試手工包");

    // 移回原位，並確認頭／尾再往外移不會動
    await quote.moveCategory(db, "frozen", "冷凍包子類", 1);
    assert.equal((await quote.listCategories(db, "frozen")).indexOf("冷凍包子類"), 1);
    const noop = await quote.moveCategory(db, "frozen", (await quote.listCategories(db, "frozen"))[0], -1);
    assert.equal(noop.moved, false, "已經在最前面就不動");
});

test("4. 刪除：底下還有品項要擋下並說明怎麼修；清空後才能刪", async () => {
    await assert.rejects(
        () => quote.deleteCategory(db, "frozen", "冷凍包子類"),
        (e) => /還有 1 個品項在用/.test(e.message) && /改成其他大類/.test(e.message),
        "錯誤訊息要告訴使用者怎麼修正"
    );
    assert.ok((await quote.listCategories(db, "frozen")).includes("冷凍包子類"), "擋下來時大類不能被刪掉");

    const it = (await quote.getItems(db, frozenId)).find((x) => x.name === "測試手工包");
    await quote.updateItem(db, it.id, { category: "包子饅頭" });
    const del = await quote.deleteCategory(db, "frozen", "冷凍包子類");
    assert.equal(del.deleted, true);
    const order = await quote.listCategories(db, "frozen");
    assert.ok(!order.includes("冷凍包子類"));
    // 刪除後序號要重新編號，不留空號（否則之後的插入位置會算錯）
    const rows = await db.prepare("SELECT sort_order FROM quote_category WHERE kind = ? ORDER BY sort_order").all("frozen");
    assert.deepEqual(rows.map((r) => Number(r.sort_order)), rows.map((_, i) => i), "sort_order 應為連續 0..n");
});

test("5. 冷凍與青菜兩組大類互不干擾", async () => {
    const vegBefore = await quote.listCategories(db, "monthly");
    await quote.addCategory(db, "frozen", "冷凍測試類", "");
    assert.deepEqual(await quote.listCategories(db, "monthly"), vegBefore, "改冷凍不影響青菜");
    assert.ok(!vegBefore.includes("冷凍測試類"));
    await quote.deleteCategory(db, "frozen", "冷凍測試類");
});

test("6. 後台路由：新增／上下移／刪除走得通，管理品項頁看得到大類與空落點框", async () => {
    const add = await postCat("category-add", { back: frozenId, name: "冷凍麵點類", after: "包子饅頭" });
    assert.equal(add.status, 302);
    assert.ok(add.location.includes("manage=1"), "做完要回管理品項頁：" + add.location);
    assert.ok(!add.location.includes("caterr="), "成功時不該帶錯誤訊息：" + add.location);
    assert.equal((await quote.listCategories(db, "frozen"))[1], "冷凍麵點類");

    const html = await getHtml("/admin/quotes/" + encodeURIComponent(frozenId) + "?manage=1");
    assert.ok(html.includes("大類（分類）管理"), "管理品項頁要有大類管理卡片");
    assert.ok(html.includes("冷凍麵點類"), "新增的大類要出現在頁面上");
    assert.ok(html.includes('data-cat="冷凍麵點類"'), "空大類也要渲染 .qe-grp 落點框才能拖品項進去");
    assert.ok(html.includes('action="/admin/quotes/category-add"'), "要有新增大類表單");
    assert.ok(!html.includes("生鮮蔬菜"), "冷凍報價不該出現青菜那組大類");

    const move = await postCat("category-move", { back: frozenId, name: "冷凍麵點類", dir: "1" });
    assert.equal(move.status, 302);
    assert.equal((await quote.listCategories(db, "frozen"))[2], "冷凍麵點類", "下移一格");

    // 有品項在用時，刪除端點要導回並帶可讀的錯誤訊息（不是 500）
    await quote.addItem(db, frozenId, { category: "冷凍麵點類", name: "測試麵點", spec: "包", price: "99" });
    const bad = await postCat("category-delete", { back: frozenId, name: "冷凍麵點類" });
    assert.equal(bad.status, 302);
    assert.ok(bad.location.includes("caterr="), "擋下來要帶錯誤訊息回頁面：" + bad.location);
    assert.ok(decodeURIComponent(bad.location).includes("還有 1 個品項在用"));
    assert.ok((await quote.listCategories(db, "frozen")).includes("冷凍麵點類"));

    const it = (await quote.getItems(db, frozenId)).find((x) => x.name === "測試麵點");
    await quote.deleteItem(db, it.id);
    const ok = await postCat("category-delete", { back: frozenId, name: "冷凍麵點類" });
    assert.equal(ok.status, 302);
    assert.ok(!ok.location.includes("caterr="), "清空後應可刪：" + ok.location);
    assert.ok(!(await quote.listCategories(db, "frozen")).includes("冷凍麵點類"));
});

test("7. 青菜月報的管理品項頁用的是青菜那組大類，且大類異動有寫稽核軌跡", async () => {
    const html = await getHtml("/admin/quotes/" + encodeURIComponent(vegId) + "?manage=1");
    assert.ok(html.includes("生鮮蔬菜"), "青菜月報要有青菜大類");
    assert.ok(!html.includes("包子饅頭"), "青菜月報不該出現冷凍那組大類");

    const logs = await db.prepare(
        "SELECT * FROM data_change_log WHERE entity_type = ? ORDER BY created_at DESC"
    ).all("quote_category");
    assert.ok(logs.length >= 3, "新增／排序／刪除都要留稽核軌跡，實際 " + logs.length + " 筆");
    assert.ok(logs.some((l) => l.action === "create"));
    assert.ok(logs.some((l) => l.action === "reorder"));
    assert.ok(logs.some((l) => l.action === "delete"));
});
