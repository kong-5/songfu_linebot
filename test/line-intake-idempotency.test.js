"use strict";
/**
 * Smoke test：LINE 收單冪等（H2 防重複訂單／作廢單復活，2026-07-18）。
 * 鎖住的行為：
 *   1. findPriorOrderForLineMessage：查無→null；pending→{voided:false}；作廢/客訴→{voided:true}
 *   2. 安全網：insertParsedItemsForOrder 一律不把品項寫進作廢/客訴訂單（任何路徑）
 *   3. 品項 per-order 冪等：同 (order, src 訊息) 重放整批略過、不雙倍
 *   4. 拆單安全回歸：同一 src 訊息寫進兩張不同 pending 單，兩邊都寫入
 *      （證明安全網不是「跨單去重」，不會誤刪第二個子客戶品項）
 *   5. 端到端建單守衛：建單→作廢→findPrior 回 voided，重投遞不再灌品項
 *
 * 跑法：npm test（node --test test/）。零外部依賴、暫存 SQLite。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-intake-"));
let seq = 0;
async function freshDb() {
    const { initDb, getDb } = require("../dist/db/index.js");
    const p = path.join(TMP, "t" + (++seq) + ".db");
    await initDb(p);
    return getDb(p);
}
const NOW = "datetime('now')";
const {
    insertOrderRowWithSplitMeta,
    findPriorOrderForLineMessage,
    insertParsedItemsForOrder,
    getNextOrderNo,
} = require("../dist/webhook/line.js")._testables;

async function seedCustomer(db, id = "c1") {
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run(id, "測試客戶" + id);
}
async function mkOrder(db, { customerId = "c1", date = "2026-07-18", msgId }) {
    return insertOrderRowWithSplitMeta(db, getNextOrderNo, NOW, {
        orderDate: date, customerId, groupId: null, rawMessage: "",
        remark: null, orderSubSplitKey: null, lineMessageId: msgId,
    });
}
const ITEMS = [{ rawName: "高麗菜", quantity: 5, unit: "公斤" }, { rawName: "白蘿蔔", quantity: 3, unit: "公斤" }];
async function countItems(db, orderId) {
    const r = await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?").get(orderId);
    return Number(r?.n || 0);
}

test("1. findPriorOrderForLineMessage：查無/ pending / 作廢 / 客訴", async () => {
    const db = await freshDb();
    await seedCustomer(db);
    assert.equal(await findPriorOrderForLineMessage(db, "NOPE"), null, "查無訊息應回 null");
    assert.equal(await findPriorOrderForLineMessage(db, ""), null, "空 id 應回 null");
    const oid = await mkOrder(db, { msgId: "MSG1" });
    let p = await findPriorOrderForLineMessage(db, "MSG1");
    assert.deepEqual(p, { orderId: oid, voided: false }, "pending 單應回 voided:false");
    await db.prepare("UPDATE orders SET status='deleted' WHERE id=?").run(oid);
    p = await findPriorOrderForLineMessage(db, "MSG1");
    assert.equal(p.voided, true, "作廢單應回 voided:true");
    await db.prepare("UPDATE orders SET status='complaint' WHERE id=?").run(oid);
    p = await findPriorOrderForLineMessage(db, "MSG1");
    assert.equal(p.voided, true, "客訴單應回 voided:true");
});

test("2. 安全網：品項不得寫進作廢/客訴訂單", async () => {
    const db = await freshDb();
    await seedCustomer(db);
    const oid = await mkOrder(db, { msgId: "MSG1" });
    await db.prepare("UPDATE orders SET status='deleted' WHERE id=?").run(oid);
    const r = await insertParsedItemsForOrder(db, oid, "c1", ITEMS, "公斤", "MSG1");
    assert.equal(r.skipped, true, "作廢單應被安全網略過");
    assert.equal(await countItems(db, oid), 0, "作廢單不得有品項寫入");
    await db.prepare("UPDATE orders SET status='complaint' WHERE id=?").run(oid);
    await insertParsedItemsForOrder(db, oid, "c1", ITEMS, "公斤", "MSG2");
    assert.equal(await countItems(db, oid), 0, "客訴單不得有品項寫入");
});

test("3. 品項 per-order 冪等：重放不雙倍", async () => {
    const db = await freshDb();
    await seedCustomer(db);
    const oid = await mkOrder(db, { msgId: "MSG1" });
    const r1 = await insertParsedItemsForOrder(db, oid, "c1", ITEMS, "公斤", "MSG1");
    assert.equal(r1.inserted, 2, "首次應寫入 2 筆");
    const r2 = await insertParsedItemsForOrder(db, oid, "c1", ITEMS, "公斤", "MSG1");
    assert.equal(r2.skipped, true, "同 (order, 訊息) 重放應略過");
    assert.equal(await countItems(db, oid), 2, "重放後仍是 2 筆、不雙倍");
});

test("4. 拆單安全回歸：同一 src 訊息寫進兩張不同 pending 單皆成功", async () => {
    const db = await freshDb();
    await seedCustomer(db);
    // 模擬拆單：一則訊息 MSGX 拆成兩個子客戶各一張單
    const oA = await mkOrder(db, { msgId: "MSGX" });
    const oB = await mkOrder(db, { msgId: null });
    const rA = await insertParsedItemsForOrder(db, oA, "c1", [{ rawName: "A店-高麗菜", quantity: 5, unit: "公斤" }], "公斤", "MSGX");
    const rB = await insertParsedItemsForOrder(db, oB, "c1", [{ rawName: "B店-白蘿蔔", quantity: 3, unit: "公斤" }], "公斤", "MSGX");
    assert.equal(rA.inserted, 1, "第一張子單應寫入");
    assert.equal(rB.inserted, 1, "第二張子單應寫入（安全網不得跨單誤刪）");
    assert.equal(await countItems(db, oA), 1);
    assert.equal(await countItems(db, oB), 1);
});

test("5. 端到端守衛：建單→作廢→重投遞不復活、不灌品項", async () => {
    const db = await freshDb();
    await seedCustomer(db);
    const oid = await mkOrder(db, { msgId: "MSG9" });
    await insertParsedItemsForOrder(db, oid, "c1", ITEMS, "公斤", "MSG9");
    assert.equal(await countItems(db, oid), 2);
    // 人工作廢
    await db.prepare("UPDATE orders SET status='deleted' WHERE id=?").run(oid);
    // redelivery：守衛判定 voided → 呼叫端 continue（此處直接驗 helper 與安全網）
    const prior = await findPriorOrderForLineMessage(db, "MSG9");
    assert.equal(prior.voided, true, "守衛應判定為作廢單");
    // 安全網再兜一層：就算誤走建品項也不會寫進作廢單
    await insertParsedItemsForOrder(db, oid, "c1", ITEMS, "公斤", "MSG9");
    assert.equal(await countItems(db, oid), 2, "作廢單品項數不得增加");
    // 全庫只有一張此訊息的單，沒有復活成第二張
    const cnt = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE line_message_id = ?").get("MSG9");
    assert.equal(Number(cnt.n), 1, "不得因重投遞復活成第二張單");
});
