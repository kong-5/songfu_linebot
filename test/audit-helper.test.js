"use strict";
/**
 * Smoke test：稽核軌跡單一權威 helper（dist/lib/audit.js，2026-09-01 體檢）。
 *
 * 背景：體檢發現全庫有三套各自為政的 data_change_log 寫法（admin logDataChange、
 * liff logFromLiff、webhook/line.js 六處內嵌 INSERT，後者的 id 還用 Math.random()
 * 而非 newId），導致「稽核進交易」這件事要各補一遍、實務上永遠補不齊。
 *
 * 鎖住的語意（選錯函式會出事，所以用測試把差別釘死）：
 *   writeAudit(h, …)      失敗會 throw → 在交易內用，軌跡寫不進去就整批 ROLLBACK，
 *                         不會出現「資料改了、軌跡沒留」
 *   writeAuditSafe(db, …) 失敗只 console.error → 給「主寫入已 commit、軌跡補後面」
 *                         的既有呼叫處用，不改舊語意
 *
 * 跑法：npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-audit-"));
let seq = 0;

const { writeAudit, writeAuditSafe } = require("../dist/lib/audit.js");

async function freshDb() {
    const { initDb, getDb } = require("../dist/db/index.js");
    const p = path.join(TMP, "t" + (++seq) + ".db");
    await initDb(p);
    return getDb(p);
}

async function rows(db) {
    return db.prepare("SELECT id, entity_type, entity_id, product_id, action, summary, meta_json, actor_username, created_at FROM data_change_log ORDER BY id").all();
}

test("1. writeAudit 寫進完整一列，欄位不漏、id 用 newId 前綴 dcl_", async () => {
    const db = await freshDb();
    await writeAudit(db, {
        entityType: "order", entityId: "ord_1", productId: "P001",
        action: "update", summary: "改數量", meta: { before: 3, after: 5 },
        actor: "alice",
    });
    const r = await rows(db);
    assert.equal(r.length, 1);
    assert.match(r[0].id, /^dcl_/, "id 要用 newId('dcl')，不是 Math.random 手搓");
    assert.equal(r[0].entity_type, "order");
    assert.equal(r[0].entity_id, "ord_1");
    assert.equal(r[0].product_id, "P001");
    assert.equal(r[0].action, "update");
    assert.equal(r[0].summary, "改數量");
    assert.deepEqual(JSON.parse(r[0].meta_json), { before: 3, after: 5 }, "舊值/新值要進 meta_json");
    assert.equal(r[0].actor_username, "alice");
    assert.ok(r[0].created_at, "created_at 不得為空");
});

test("2. 選填欄位省略時寫 NULL，不會炸", async () => {
    const db = await freshDb();
    await writeAudit(db, { entityType: "customer", entityId: "c1", action: "create", actor: "bob" });
    const r = await rows(db);
    assert.equal(r[0].product_id, null);
    assert.equal(r[0].summary, null);
    assert.equal(r[0].meta_json, null);
});

test("3. 缺 entityType / action → 丟錯（不允許寫出查不到來源的軌跡）", async () => {
    const db = await freshDb();
    await assert.rejects(() => writeAudit(db, { entityId: "x", action: "update", actor: "a" }), /entityType/);
    await assert.rejects(() => writeAudit(db, { entityType: "order", entityId: "x", actor: "a" }), /action/);
    assert.equal((await rows(db)).length, 0, "驗證失敗就不該留下半筆");
});

test("4. writeAudit 在交易內失敗 → 整筆 ROLLBACK（資料改了軌跡沒留＝不可能發生）", async () => {
    const db = await freshDb();
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("c_tx", "測試客戶");

    let threw = false;
    try {
        await db.transaction(async (h) => {
            await h.prepare("UPDATE customers SET name = ? WHERE id = ?").run("改過的名字", "c_tx");
            // 故意讓稽核寫入失敗（entityType 空字串）
            await writeAudit(h, { entityType: "", entityId: "c_tx", action: "update", actor: "a" });
        });
    } catch (_) { threw = true; }

    assert.ok(threw, "稽核失敗要讓交易整個丟出來");
    const c = await db.prepare("SELECT name FROM customers WHERE id = ?").get("c_tx");
    assert.equal(c.name, "測試客戶", "主資料必須跟著 ROLLBACK，不能留下沒有軌跡的異動");
    assert.equal((await rows(db)).length, 0);
});

test("5. writeAudit 在交易內成功 → 主資料與軌跡同生共死（一起 commit）", async () => {
    const db = await freshDb();
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("c_ok", "原名");
    await db.transaction(async (h) => {
        await h.prepare("UPDATE customers SET name = ? WHERE id = ?").run("新名", "c_ok");
        await writeAudit(h, {
            entityType: "customer", entityId: "c_ok", action: "update",
            summary: "改名", meta: { before: "原名", after: "新名" }, actor: "alice",
        });
    });
    const c = await db.prepare("SELECT name FROM customers WHERE id = ?").get("c_ok");
    assert.equal(c.name, "新名");
    const r = await rows(db);
    assert.equal(r.length, 1);
    assert.equal(r[0].action, "update");
});

test("6. writeAuditSafe 失敗只回 null 不 throw（相容既有「主寫入已 commit」的呼叫處）", async () => {
    const db = await freshDb();
    const origErr = console.error;
    let logged = false;
    console.error = () => { logged = true; };
    try {
        const id = await writeAuditSafe(db, { entityType: "", entityId: "x", action: "update", actor: "a" });
        assert.equal(id, null, "失敗要回 null");
    } finally { console.error = origErr; }
    assert.ok(logged, "軌跡掉了要留 error log，不能靜默");
    assert.equal((await rows(db)).length, 0);
});

test("7. writeAuditSafe 成功時行為與 writeAudit 一致", async () => {
    const db = await freshDb();
    const id = await writeAuditSafe(db, { entityType: "product", entityId: "p1", action: "delete", actor: "bob" });
    assert.match(String(id), /^dcl_/);
    const r = await rows(db);
    assert.equal(r.length, 1);
    assert.equal(r[0].entity_type, "product");
});

test("8. 每次呼叫產生不同 id（同一毫秒連寫也不得撞）", async () => {
    const db = await freshDb();
    for (let i = 0; i < 30; i++) {
        await writeAudit(db, { entityType: "order", entityId: "o" + i, action: "create", actor: "a" });
    }
    const r = await rows(db);
    assert.equal(r.length, 30, "30 筆都要寫進去（id 撞了會被 PK 擋掉）");
    assert.equal(new Set(r.map((x) => x.id)).size, 30);
});
