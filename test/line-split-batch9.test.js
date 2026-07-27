"use strict";
/**
 * Smoke test：拆檔批次 9（webhook/line.js 抽出四支 lib）。
 * line.js 是 LINE 收單主流程（冪等、advisory lock、租約去重都在裡面），所以除了「檔案能載入」，
 * 這裡直接對抽出的函式做行為驗證，確保搬移沒改語意：
 *   1. 四支 lib 都匯出預期的函式；line.js 的 _testables 仍指到同一批實作
 *   2. 意圖偵測：客訴/取消/改單的判定與優先序不變
 *   3. 子客戶拆單：單一子客戶也要拆（2026-07-10 定案）、全空則不拆
 *   4. 空籃數量擷取
 *   5. Flex 收單確認卡：正常組出、超過泡數上限回 null（呼叫端 fallback 純文字）
 *   6. 訂單寫入 helper 仍可實際寫入 DB（insertOrderRowWithSplitMeta ＋ 原子取號不撞號）
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-line9-"));
process.env.DB_PATH = path.join(TMP, "line9.db");
delete process.env.DATABASE_URL;

const { initDb, getDb } = require("../dist/db/index.js");
const flex = require("../dist/lib/line-flex-messages.js");
const intent = require("../dist/lib/line-intent.js");
const subSplit = require("../dist/lib/line-sub-split.js");
const orderWrite = require("../dist/lib/line-order-write.js");

let db;
test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO customers (id, name, active) VALUES (?, ?, 1)").run("cust-l9", "批次九客戶");
});

test("四支 lib 匯出預期函式，且 line.js 的 _testables 指到同一批實作", () => {
    assert.equal(typeof flex.buildOrderConfirmFlex, "function");
    assert.equal(typeof flex.buildEmployeeMenuFlex, "function");
    assert.equal(typeof intent.detectCustomerIntent, "function");
    assert.equal(typeof subSplit.mustSplitOrdersBySubCustomer, "function");
    assert.equal(typeof orderWrite.getNextOrderNo, "function");
    const t = require("../dist/webhook/line.js")._testables;
    // 同一個函式物件 ＝ 沒有留下第二份複本可各自壞掉
    assert.equal(t.getNextOrderNo, orderWrite.getNextOrderNo);
    assert.equal(t.insertParsedItemsForOrder, orderWrite.insertParsedItemsForOrder);
    assert.equal(t.mustSplitOrdersBySubCustomer, subSplit.mustSplitOrdersBySubCustomer);
});

test("意圖偵測：客訴／取消／改單判定與優先序不變", () => {
    assert.equal(intent.detectCustomerIntent("這批菜壞掉了要客訴").intent, "complaint");
    assert.equal(intent.detectCustomerIntent("今天的單取消").intent, "cancel_order");
    assert.equal(intent.detectCustomerIntent("").intent, null);
    // 多匹配時 complaint 優先（同時含客訴與取消字樣）
    assert.equal(intent.detectCustomerIntent("東西壞掉我要客訴，順便取消訂單").intent, "complaint");
});

test("空籃數量擷取：數字與國字都認、無籃字回 null", () => {
    assert.equal(intent.extractBasketCount("回收5籃"), 5);
    assert.equal(intent.extractBasketCount("拿回三個籃"), 3);
    assert.equal(intent.extractBasketCount("空籃"), null, "沒帶數量應回 null");
});

test("子客戶拆單：任一非空子客戶即拆（2026-07-10 定案）、全空則不拆", () => {
    const oneSub = [{ name: "高麗菜", subCustomer: "養鍋" }, { name: "豆腐", subCustomer: "養鍋" }];
    assert.equal(subSplit.mustSplitOrdersBySubCustomer(oneSub), true, "整則同一子客戶也要拆");
    const noSub = [{ name: "高麗菜", subCustomer: "" }, { name: "豆腐", subCustomer: null }];
    assert.equal(subSplit.mustSplitOrdersBySubCustomer(noSub), false, "全空不可拆");
    // 回傳 Map：鍵為子客戶名（空字串＝主客戶桶）
    const groups = subSplit.groupParsedItemsBySubCustomer([
        { name: "A", subCustomer: "店一" }, { name: "B", subCustomer: "店二" }, { name: "C", subCustomer: "" },
    ]);
    assert.ok(groups instanceof Map, "應回傳 Map");
    assert.equal(groups.size, 3, "三個分組（含主客戶空鍵）");
    assert.equal(groups.get("").length, 1, "空鍵桶＝主客戶品項");
});

test("Flex 收單確認卡：正常組得出、超過泡數上限回 null（呼叫端 fallback 純文字）", () => {
    const block = { orderNo: "20260727001", customerName: "批次九客戶", items: [{ name: "高麗菜", qty: 3, unit: "公斤" }] };
    const ok = flex.buildOrderConfirmFlex([block], "2026-07-27");
    assert.ok(ok && ok.contents && typeof ok.altText === "string", "單張應組得出 Flex");
    const many = Array.from({ length: 50 }, (_, i) => ({ ...block, orderNo: "2026072700" + i }));
    assert.equal(flex.buildOrderConfirmFlex(many, "2026-07-27"), null, "超過泡數上限應回 null");
});

test("訂單寫入 helper 仍能實際寫入，且原子取號連續兩次不撞號", async () => {
    const nowSql = "datetime('now')";
    const a = await orderWrite.insertOrderRowWithSplitMeta(db, orderWrite.getNextOrderNo, nowSql, {
        orderDate: "2026-07-27", customerId: "cust-l9", groupId: "G9", rawMessage: "高麗菜3", remark: null,
        orderSubSplitKey: null, lineMessageId: "msg-a",
    });
    const b = await orderWrite.insertOrderRowWithSplitMeta(db, orderWrite.getNextOrderNo, nowSql, {
        orderDate: "2026-07-27", customerId: "cust-l9", groupId: "G9", rawMessage: "豆腐2", remark: null,
        orderSubSplitKey: "分店一", lineMessageId: "msg-b",
    });
    const rows = await db.prepare("SELECT id, order_no, order_sub_split_key FROM orders ORDER BY order_no").all();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].order_no, rows[1].order_no, "兩張單不可同號");
    assert.ok(a && b, "兩次寫入都要回傳 orderId");
    // 依 line_message_id 找回前一張單（收單重試的冪等基礎）
    const prior = await orderWrite.findPriorOrderForLineMessage(db, "msg-a");
    assert.ok(prior, "應能依 line_message_id 找回既有訂單");
});
