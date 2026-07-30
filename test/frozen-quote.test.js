"use strict";
/**
 * Smoke test：報價管理「冷凍報價」分頁（2026-07-30 新增）。
 * 鎖住的行為：
 *   1. 建立第一份冷凍報價＝帶入照片上的 35 項冷凍品項（分類、規格、售價照抄），且與青菜月報互不干擾。
 *   2. 冪等：同月份重複建立回同一份、不會產生重複品項。
 *   3. 新月份自動帶入「上一份冷凍報價」的品項與價格當底稿（不是帶到青菜月報去）。
 *   4. 列表頁三個分頁（月報／冷凍報價／飯店客戶報價）都在；冷凍分頁列得出冷凍報價。
 *   5. 編輯頁：分類下拉只給冷凍那組（不出現「生鮮蔬菜」）；價格模式的前月比較讀的是上月冷凍價。
 *   6. 存檔／刪除走 fz_ 分流：改價有效、刪除只刪冷凍那份，青菜月報不受影響。
 *
 * 跑法：npm test（node --test test/）。實際 listen 隨機埠、偽造合法 session cookie 打真路由。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-frozen-quote-"));
const SECRET = "test-secret-frozen-quote";
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
let frozenId;      // 2030-01 冷凍報價
let vegId;         // 2030-01 青菜月報（驗證兩者互不干擾）

const COOKIE = () => "sf_admin_session=" + signSession("tester");

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tester", name: "測試員", passwordHash: "x:y", title: "經理", status: "active" }]));
    vegId = await quote.createReport(db, { ym: "2030-01", seedWhenEmpty: false });
    await quote.addItem(db, vegId, { category: "生鮮蔬菜", name: "芹菜", spec: "KG", price: "180" });
    frozenId = await quote.createFrozenQuote(db, { ym: "2030-01" });
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});

test.after(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

test("1. 第一份冷凍報價帶入照片上的品項（分類／規格／售價照抄）", async () => {
    assert.match(frozenId, /^fz_/, "冷凍報價 id 前綴要是 fz_（路由靠它分流）");
    const items = await quote.getItems(db, frozenId);
    assert.equal(items.length, quote.SEED_FROZEN_ITEMS.length);
    assert.equal(items.length, 35, "照片上共 35 項");

    const byName = new Map(items.map((it) => [it.name, it]));
    const spot = [
        ["喜兔包", "30粒/包", "200", "包子饅頭"],
        ["蘿蔔糕", "60片/包", "220", "冷凍點心"],
        ["蛋黃芋丸", "100顆/盒", "345", "冷凍點心"],
        ["龍港豆沙包CAS", "10粒/包", "120", "龍港包子"],
        ["雞腿CAS", "3KG/包/約23隻", "600", "冷凍雞肉"],
        ["帶骨內排CAS", "70片/箱", "1680", "冷凍豬肉"],
    ];
    for (const [name, spec, price, category] of spot) {
        const it = byName.get(name);
        assert.ok(it, `應有品項 ${name}`);
        assert.equal(it.spec, spec, `${name} 規格`);
        assert.equal(String(it.price), price, `${name} 售價`);
        assert.equal(it.category, category, `${name} 分類`);
        assert.equal(it.is_quoted, 1, `${name} 應為有報價`);
    }

    // 分類分群順序＝FROZEN_CATEGORY_ORDER，不與青菜分類交錯
    const groups = await quote.getItemsGrouped(db, frozenId);
    assert.deepEqual(groups.map((g) => g.category), quote.FROZEN_CATEGORY_ORDER);

    // 青菜月報完全不受影響（品項各存各的）
    const veg = await quote.getItems(db, vegId);
    assert.deepEqual(veg.map((it) => it.name), ["芹菜"]);
});

test("2. 冪等：同月份重複建立＝同一份，不會多出品項", async () => {
    const again = await quote.createFrozenQuote(db, { ym: "2030-01" });
    assert.equal(again, frozenId);
    const items = await quote.getItems(db, frozenId);
    assert.equal(items.length, 35, "重複建立不可產生重複品項");
});

test("3. 新月份帶入「上一份冷凍報價」的品項與價格", async () => {
    // 先改一項價格，確認底稿帶的是改後的價
    const items = await quote.getItems(db, frozenId);
    const kuaibao = items.find((it) => it.name === "刈包");
    await quote.updateItem(db, kuaibao.id, { price: "108" });

    const nextId = await quote.createFrozenQuote(db, { ym: "2030-02" });
    assert.notEqual(nextId, frozenId);
    const nextItems = await quote.getItems(db, nextId);
    assert.equal(nextItems.length, 35);
    assert.equal(String(nextItems.find((it) => it.name === "刈包").price), "108", "應帶入上一份的最新價格");
    // 底稿來源是冷凍那份，不會混進青菜品項
    assert.ok(!nextItems.some((it) => it.name === "芹菜"), "不可帶入青菜月報的品項");
});

test("4. 列表頁：三個分頁都在，冷凍分頁列得出冷凍報價", async () => {
    const res = await fetch(baseUrl + "/admin/quotes?tab=frozen", { headers: { cookie: COOKIE() } });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /href="\/admin\/quotes"[^>]*>月報</, "要有月報分頁");
    assert.match(html, /href="\/admin\/quotes\?tab=frozen"[^>]*>冷凍報價</, "要有冷凍報價分頁");
    assert.match(html, /href="\/admin\/quotes\?tab=hotel"[^>]*>飯店客戶報價</, "要有飯店分頁");
    assert.match(html, /sf-qtab on[^>]*href="\/admin\/quotes\?tab=frozen"|href="\/admin\/quotes\?tab=frozen"/, "冷凍分頁要在畫面上");
    assert.ok(html.includes(frozenId), "冷凍分頁要列出該份冷凍報價");
    assert.match(html, /action="\/admin\/quotes\/frozen\/create"/, "要有新增冷凍報價的表單");
});

test("5. 編輯頁：分類下拉只給冷凍那組；前月比較讀上月冷凍價", async () => {
    const manageRes = await fetch(baseUrl + "/admin/quotes/" + encodeURIComponent(frozenId) + "?manage=1", { headers: { cookie: COOKIE() } });
    assert.equal(manageRes.status, 200);
    const manageHtml = await manageRes.text();
    for (const cat of quote.FROZEN_CATEGORY_ORDER) {
        assert.ok(manageHtml.includes(`<option value="${cat}"`), `分類下拉要有 ${cat}`);
    }
    assert.ok(!manageHtml.includes('<option value="生鮮蔬菜"'), "冷凍報價的分類下拉不該出現青菜分類");

    // 2030-02 的價格模式：前月（2030-01 冷凍）刈包＝108，應顯示為前月價
    const nextRow = await quote.getFrozenQuoteByYm(db, "2030-02");
    const priceRes = await fetch(baseUrl + "/admin/quotes/" + encodeURIComponent(nextRow.id), { headers: { cookie: COOKIE() } });
    const priceHtml = await priceRes.text();
    assert.match(priceHtml, /data-prev="108"/, "價格模式要帶上月冷凍價當比較基準");
    assert.match(priceHtml, /冷凍報價/, "麵包屑要標示冷凍報價");
});

test("6. 存檔／刪除走 fz_ 分流，青菜月報不受影響", async () => {
    const items = await quote.getItems(db, frozenId);
    const target = items.find((it) => it.name === "燒賣");
    const body = new URLSearchParams();
    body.set("row__" + target.id, "1");
    body.set("price__" + target.id, "138");
    const saveRes = await fetch(baseUrl + "/admin/quotes/" + encodeURIComponent(frozenId) + "/save", {
        method: "POST",
        headers: { cookie: COOKIE(), "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        redirect: "manual",
    });
    assert.equal(saveRes.status, 302);
    const after = await quote.getItems(db, frozenId);
    assert.equal(String(after.find((it) => it.name === "燒賣").price), "138");

    // 刪除 2030-02 那份：只刪冷凍，2030-01 冷凍與青菜月報都還在
    const nextRow = await quote.getFrozenQuoteByYm(db, "2030-02");
    const delRes = await fetch(baseUrl + "/admin/quotes/" + encodeURIComponent(nextRow.id) + "/delete", {
        method: "POST", headers: { cookie: COOKIE() }, redirect: "manual",
    });
    assert.equal(delRes.status, 302);
    assert.equal(delRes.headers.get("location"), "/admin/quotes?tab=frozen", "刪除後要回冷凍分頁");
    assert.ok(!(await quote.getFrozenQuoteByYm(db, "2030-02")), "該份冷凍報價要被刪掉");
    assert.equal((await quote.getItems(db, nextRow.id)).length, 0, "品項要一起刪掉，不留孤兒");
    assert.ok(await quote.getFrozenQuoteByYm(db, "2030-01"), "另一份冷凍報價要還在");
    assert.equal((await quote.getItems(db, vegId)).length, 1, "青菜月報不受影響");
});

test("7. 開機 seed：只跑一次、不覆蓋既有資料", async () => {
    const first = await quote.ensureInitialFrozenQuoteSeed(db, "2031-05");
    assert.equal(first.seeded, true);
    const created = await quote.getFrozenQuoteByYm(db, "2031-05");
    assert.ok(created);
    // 旗標已寫入 → 再呼叫不動作
    const second = await quote.ensureInitialFrozenQuoteSeed(db, "2031-06");
    assert.equal(second.seeded, false);
    assert.ok(!(await quote.getFrozenQuoteByYm(db, "2031-06")), "旗標存在就不該再建立");
});
