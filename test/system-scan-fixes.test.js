"use strict";
/**
 * Smoke test：2026-07-21 系統體檢修復批次。
 * 鎖住：
 *   1. 盤點 submit 的 sys（凍結系統量）伺服器端驗證——非數字整批拒絕（bad_qty），
 *      負數 sys 合法（凌越負庫存正常）。
 *   2. 樂觀鎖 409：已送出場次、baseSubmittedAt 不符 → conflict_stale（含交易內覆檢路徑）。
 *   3. rebuild 安全網：作廢/客訴單不重建品項（rebuildOrderItemsFromOrderSources 早退＋
 *      replaceOrderItemsFromParsedRows 交易內覆檢），既有品項不被洗掉。
 *
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-scanfix-"));
let seq = 0;
async function freshDb() {
    const { initDb, getDb } = require("../dist/db/index.js");
    const p = path.join(TMP, "t" + (++seq) + ".db");
    await initDb(p);
    return getDb(p);
}
const { submitStocktake } = require("../dist/lib/stocktake-api.js");
const { rebuildOrderItemsFromOrderSources, replaceOrderItemsFromParsedRows } = require("../dist/lib/rebuild-order-from-sources.js");

const base = { icpno: "02", whCode: "W1", createdBy: "admin:t", createdByName: "測試員" };

test("1. sys 非數字整批拒絕（bad_qty）、負數 sys 合法", async () => {
    const db = await freshDb();
    let err = null;
    try {
        await submitStocktake(db, { ...base, counts: [{ code: "P1", name: "高麗菜", counted: 5, sys: "abc" }] });
    } catch (e) { err = e; }
    assert.ok(err, "sys 非數字應丟錯");
    assert.equal(err.httpStatus, 400);
    assert.equal(err.code, "bad_qty");
    const n = await db.prepare("SELECT COUNT(*) AS n FROM stocktake_count").get();
    assert.equal(Number(n.n), 0, "整批拒絕，不得半套寫入");

    const ok = await submitStocktake(db, { ...base, counts: [{ code: "P1", name: "高麗菜", counted: 5, sys: -3 }] });
    assert.equal(ok.ok, true, "負數 sys（凌越負庫存）應合法");
    const row = await db.prepare("SELECT sys_qty FROM stocktake_count WHERE erp_code='P1'").get();
    assert.equal(Number(row.sys_qty), -3);
});

test("2. 樂觀鎖：已送出場次 + baseSubmittedAt 不符 → 409 conflict_stale", async () => {
    const db = await freshDb();
    await submitStocktake(db, { ...base, counts: [{ code: "P1", name: "高麗菜", counted: 5 }] });
    let err = null;
    try {
        await submitStocktake(db, { ...base, counts: [{ code: "P1", name: "高麗菜", counted: 7 }], baseSubmittedAt: null });
    } catch (e) { err = e; }
    assert.ok(err, "應丟 409");
    assert.equal(err.httpStatus, 409);
    assert.equal(err.code, "conflict_stale");
    const row = await db.prepare("SELECT counted_qty FROM stocktake_count WHERE erp_code='P1'").get();
    assert.equal(Number(row.counted_qty), 5, "先送出的盤點不得被洗掉");
    // 帶正確的 baseSubmittedAt 則允許覆蓋（續盤重送）
    const sess = await db.prepare("SELECT submitted_at FROM stocktake_session").get();
    const ok = await submitStocktake(db, { ...base, counts: [{ code: "P1", name: "高麗菜", counted: 7 }], baseSubmittedAt: String(sess.submitted_at) });
    assert.equal(ok.ok, true);
});

async function makeOrder(db, status) {
    const custId = "cust_t1", orderId = "ord_t_" + status;
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING").run(custId, "測試客戶");
    await db.prepare("INSERT INTO orders (id, customer_id, order_date, status, raw_message) VALUES (?, ?, ?, ?, ?)")
        .run(orderId, custId, "2026-07-21", status, "高麗菜 5公斤");
    await db.prepare("INSERT INTO order_items (id, order_id, raw_name, quantity, unit, need_review) VALUES (?, ?, ?, ?, ?, 1)")
        .run("item_t_" + status, orderId, "既有品項", 1, "公斤");
    return { custId, orderId };
}

test("3. rebuild 安全網：客訴/作廢單不重建品項、既有品項保留", async () => {
    const db = await freshDb();
    for (const status of ["complaint", "deleted"]) {
        const { custId, orderId } = await makeOrder(db, status);
        const r = await rebuildOrderItemsFromOrderSources(db, orderId, custId, "高麗菜 5公斤", []);
        assert.equal(r.ok, false, status + " 單 rebuild 應回 ok:false");
        assert.equal(r.error, "status_" + status);
        const n = await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?").get(orderId);
        assert.equal(Number(n.n), 1, status + " 單的既有品項不得被動到");
    }
});

test("4. replaceOrderItemsFromParsedRows 交易內覆檢：客訴單不覆寫", async () => {
    const db = await freshDb();
    const { custId, orderId } = await makeOrder(db, "complaint");
    const r = await replaceOrderItemsFromParsedRows(db, orderId, custId, [
        { rawName: "幽靈品項", quantity: 3, unit: "公斤" },
    ]);
    assert.equal(r.ok, false);
    assert.equal(r.blockedStatus, "complaint");
    const rows = await db.prepare("SELECT raw_name FROM order_items WHERE order_id = ?").all(orderId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].raw_name, "既有品項", "客訴單品項不得被 DELETE+INSERT 覆寫");
});

test("5. 正常單 replaceOrderItemsFromParsedRows 照常覆寫（回歸）", async () => {
    const db = await freshDb();
    const { custId, orderId } = await makeOrder(db, "pending");
    const r = await replaceOrderItemsFromParsedRows(db, orderId, custId, [
        { rawName: "高麗菜", quantity: 5, unit: "公斤" },
        { rawName: "白蘿蔔", quantity: 2, unit: "公斤" },
    ]);
    assert.equal(r.ok, true);
    const rows = await db.prepare("SELECT raw_name FROM order_items WHERE order_id = ? ORDER BY raw_name").all(orderId);
    assert.equal(rows.length, 2, "正常單應被重建為新品項");
});
