"use strict";
/**
 * 核心不變式測試（node:test，零外部依賴、不打網路）。
 * 鎖住 CLAUDE.md 記載「踩過的雷」對應的規則——這些一旦回歸就是重複出貨/錯帳等實際事故：
 *   1. 拆單唯一索引：同客戶同日同（非空）split key 至多一張有效單；''/NULL 主桶不受限
 *   2. 標主客戶桶：只把同客戶同日、非作廢/客訴的 NULL 主單標成 ''
 *   3. 找目標單：'' 桶連同 NULL 舊主單視為同桶；排除作廢/客訴；ORDER BY order_no
 *   4. 品項冪等鍵：同 (訂單, LINE 訊息) 重跑整批略過，品項不雙倍
 *   5. 盤點三保險：樂觀鎖 409 / 帶正確基準可覆蓋 / 日期僅限今昨 / 續盤帶回中貨與效期
 *   6. 每日排程原子 claim：同日第二次 claim 必為 false
 *   7. 公司代碼解析：normIcpno / companyArgToIcpno 邊界
 *   8. group_features 預設：無列＝訂單/空籃開、盤點關
 *
 * 跑法：npm test（node --test test/）。使用暫存 SQLite 檔，每個 test 各自獨立 DB。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-test-"));
let seq = 0;
async function freshDb() {
    const { initDb, getDb } = require("../dist/db/index.js");
    const p = path.join(TMP, "t" + (++seq) + ".db");
    await initDb(p);
    return getDb(p);
}
async function seedCustomer(db, id = "c1") {
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run(id, "測試客戶" + id);
}

test("1. 拆單唯一索引：同 key 擋、主桶多張不受限、作廢後可重建", async () => {
    const db = await freshDb();
    await seedCustomer(db);
    const ins = (id, no, key, status = "pending") =>
        db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status, order_sub_split_key) VALUES (?,?,?,?,?,?)")
            .run(id, no, "c1", "2026-07-14", status, key);
    await ins("o1", "A1", "養鍋站前店");
    const { isSplitKeyUniqueConflict } = require("../dist/lib/order-split.js");
    let threw = null;
    try { await ins("o2", "A2", "養鍋站前店"); } catch (e) { threw = e; } // sqlite wrapper 同步丟錯，assert.rejects 接不到
    assert.ok(threw && isSplitKeyUniqueConflict(threw), "同 key 第二張應撞拆單唯一索引");
    await ins("m1", "A3", "");    // 主桶 '' 多張合法
    await ins("m2", "A4", "");
    await ins("n1", "A5", null);  // NULL 也不受限
    await db.prepare("UPDATE orders SET status='deleted' WHERE id='o1'").run();
    await ins("o3", "A6", "養鍋站前店"); // 原單作廢後可重建
});

test("2+3. 標主客戶桶＋找目標單語意", async () => {
    const db = await freshDb();
    await seedCustomer(db);
    const { markSameDayMainOrdersAsSplitBase, findSplitTargetOrderId } = require("../dist/lib/order-split.js");
    const ins = (id, no, key, status = "pending", cid = "c1", date = "2026-07-14") =>
        db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status, order_sub_split_key) VALUES (?,?,?,?,?,?)")
            .run(id, no, cid, date, status, key);
    await seedCustomer(db, "c2");
    await ins("main1", "B2", null);              // 目標：被標 ''
    await ins("main0", "B1", null);              // order_no 較小 → find '' 應優先挑它
    await ins("dead", "B3", null, "deleted");    // 作廢：不標
    await ins("other", "B4", null, "pending", "c2"); // 別的客戶：不標
    await markSameDayMainOrdersAsSplitBase(db, "c1", "2026-07-14");
    const keys = {};
    for (const r of await db.prepare("SELECT id, order_sub_split_key AS k FROM orders").all()) keys[r.id] = r.k;
    assert.equal(keys.main1, "");
    assert.equal(keys.main0, "");
    assert.equal(keys.dead, null);
    assert.equal(keys.other, null);
    // find ''：連同 NULL 舊主單視為同桶、ORDER BY order_no 取最小、排除作廢
    assert.equal(await findSplitTargetOrderId(db, "c1", "2026-07-14", ""), "main0");
    await ins("sub1", "B5", "養鍋站前店");
    assert.equal(await findSplitTargetOrderId(db, "c1", "2026-07-14", "養鍋站前店"), "sub1");
    assert.equal(await findSplitTargetOrderId(db, "c1", "2026-07-14", "不存在的子客戶"), null);
});

test("4. 品項冪等鍵：同訊息重跑不雙倍、不同訊息累加", async () => {
    const db = await freshDb();
    await seedCustomer(db);
    await db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status) VALUES ('o1','A1','c1','2026-07-14','pending')").run();
    const { insertParsedItemsForOrder } = require("../dist/webhook/line.js")._testables;
    const parsed = [{ rawName: "高麗菜", quantity: 5, unit: "公斤" }, { rawName: "雞蛋", quantity: 2, unit: "箱" }];
    const r1 = await insertParsedItemsForOrder(db, "o1", "c1", parsed, "公斤", "msg-001");
    assert.equal(r1.inserted, 2);
    const r2 = await insertParsedItemsForOrder(db, "o1", "c1", parsed, "公斤", "msg-001"); // redelivery
    assert.equal(r2.skipped, true);
    const n = (await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id='o1'").get()).n;
    assert.equal(Number(n), 2);
    const r3 = await insertParsedItemsForOrder(db, "o1", "c1", [{ rawName: "豬肉", quantity: 3, unit: "公斤" }], "公斤", "msg-002");
    assert.equal(r3.inserted, 1);
});

test("5. 盤點三保險：樂觀鎖/日期限制/續盤帶回中貨效期", async () => {
    const db = await freshDb();
    const api = require("../dist/lib/stocktake-api.js");
    const today = api.stkTaipeiDate();
    await db.prepare("INSERT INTO erp_warehouse (icpno, code, name, include_stocktake, sort_order) VALUES ('02','FN005','松揚雜貨',1,1)").run();
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code) VALUES ('02','P1','白米','30KG/包','包',12,'FN005')").run();
    const s1 = await api.submitStocktake(db, {
        icpno: "02", whCode: "FN005", date: today,
        counts: [{ code: "P1", name: "白米", spec: "", unit: "包", sys: 12, counted: 10, mid: 2, expiry: [{ date: "2026-12", qty: 5 }] }],
        createdBy: "U1", createdByName: "阿明", baseSubmittedAt: null,
    });
    assert.equal(s1.ok, true);
    // 續盤：saved 還原上貨（合計−中貨）＋中貨＋效期
    const items = await api.getStocktakeItems(db, { icpno: "02", whCode: "FN005", minimal: true });
    assert.deepEqual({ c: items.saved.P1.counted, m: items.saved.P1.mid }, { c: 10, m: 2 });
    assert.equal(items.saved.P1.expiry.length, 1);
    // 樂觀鎖：舊基準（null）再送 → 409 conflict_stale
    await assert.rejects(
        () => api.submitStocktake(db, { icpno: "02", whCode: "FN005", date: today, counts: [{ code: "P1", counted: 9 }], createdBy: "x", createdByName: "y", baseSubmittedAt: null }),
        (e) => e.httpStatus === 409 && e.code === "conflict_stale");
    // 帶正確基準可覆蓋
    const s2 = await api.submitStocktake(db, { icpno: "02", whCode: "FN005", date: today, counts: [{ code: "P1", counted: 11, mid: null, expiry: [] }], createdBy: "U1", createdByName: "阿明", baseSubmittedAt: items.submittedAt });
    assert.equal(s2.ok, true);
    // 日期限制：任意歷史日 → 400
    await assert.rejects(
        () => api.submitStocktake(db, { icpno: "02", whCode: "FN005", date: "2026-01-01", counts: [], createdBy: "x", createdByName: "y", baseSubmittedAt: null }),
        (e) => e.httpStatus === 400);
});

test("6. 每日排程原子 claim：同日只成功一次", async () => {
    const db = await freshDb();
    const claim = async (mark) => {
        const r = await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE app_settings.value <> excluded.value").run("daily_summary_last_push_date", mark);
        return Number(r?.changes || 0) === 1;
    };
    assert.equal(await claim("2026-07-14"), true);
    assert.equal(await claim("2026-07-14"), false);
    assert.equal(await claim("2026-07-15"), true);
});

test("7. 公司代碼解析邊界", () => {
    const { normIcpno, companyArgToIcpno } = require("../dist/lib/erp-companies.js");
    assert.equal(normIcpno("all"), "00");
    assert.equal(normIcpno("00,02"), "00");
    assert.equal(normIcpno(""), "00");
    assert.equal(normIcpno(undefined), "00");
    assert.equal(normIcpno("02"), "02");
    assert.equal(companyArgToIcpno("松揚"), "02");
    assert.equal(companyArgToIcpno("02"), "02");
});

test("8. group_features 預設：無列＝訂單/空籃開、盤點關；寫入後照存值", async () => {
    const db = await freshDb();
    const gf = require("../dist/lib/group-features.js");
    assert.deepEqual(await gf.getGroupFeatures(db, "C_unknown"), { order: true, stocktake: false, basket: true });
    await gf.setGroupFeatures(db, "Cgid1", { order: false, stocktake: true, basket: true });
    assert.deepEqual(await gf.getGroupFeatures(db, "Cgid1"), { order: false, stocktake: true, basket: true });
});

test("9. 品名清洗 regex（salsa 不再被 [\\\\s] 洗壞）", () => {
    // resolve-product 內部函式未匯出，這裡直接鎖住等價 regex 行為（回歸 canary）
    const clean = (s) => String(s || "").replace(/[\(（][^）)]*[\)）]/g, " ").replace(/[\s,，.。、]+/g, " ").trim();
    assert.equal(clean("salsa 醬 5kg"), "salsa 醬 5kg");
    assert.equal(clean("高麗菜， 兩箱。"), "高麗菜 兩箱");
});
