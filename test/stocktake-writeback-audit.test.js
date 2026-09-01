"use strict";
/**
 * Smoke test：盤點送出與凌越回寫 callback 的稽核軌跡（2026-09-01 體檢）。
 *
 * 兩個都是「核心業務、寫入很關鍵、卻一直零軌跡」的路徑：
 *   - 盤點送出：現在的主力業務。送出＝整場覆蓋（DELETE 再 INSERT），覆盤之後
 *     「今天這倉本來誰盤的、盤了幾項」查不到。
 *   - 凌越 callback 回填 lingyue_doc_no：等同「這張單已在凌越開出來」的憑證；
 *     單號衝突（可能重複開單）過去只推播、看過就沒了。
 *
 * 跑法：npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-stkwb-"));
let seq = 0;
delete process.env.DATABASE_URL;

const { submitStocktake } = require("../dist/lib/stocktake-api.js");

async function freshDb() {
    const { initDb, getDb } = require("../dist/db/index.js");
    const p = path.join(TMP, "t" + (++seq) + ".db");
    await initDb(p);
    return getDb(p);
}
async function auditRows(db, action) {
    return db.prepare("SELECT entity_type, entity_id, action, summary, meta_json, actor_username FROM data_change_log WHERE action = ? ORDER BY id").all(action);
}

const base = { icpno: "02", whCode: "W1", createdBy: "liff:U123", createdByName: "阿明" };

test("1. 盤點送出會寫稽核（誰、哪一倉、哪一天、盤了幾項）", async () => {
    const db = await freshDb();
    await submitStocktake(db, { ...base, counts: [{ code: "A1", name: "豆薯", sys: 10, counted: 8 }] });

    const rows = await auditRows(db, "submit");
    assert.equal(rows.length, 1, "盤點送出要留軌跡");
    assert.equal(rows[0].entity_type, "stocktake_session");
    assert.equal(rows[0].actor_username, "liff:U123", "要記得是誰送的");

    const meta = JSON.parse(rows[0].meta_json);
    assert.equal(meta.icpno, "02");
    assert.equal(meta.wh_code, "W1");
    assert.equal(meta.counted_count, 1);
    assert.equal(meta.created_by_name, "阿明");
    assert.equal(meta.overwrote, null, "第一次送出沒有覆蓋任何人");
});

test("2. 覆蓋他人盤點 → action=submit_overwrite，且留下被覆蓋者的摘要", async () => {
    const db = await freshDb();
    await submitStocktake(db, { ...base, counts: [{ code: "A1", name: "豆薯", sys: 10, counted: 8 }] });
    const first = await db.prepare("SELECT submitted_at FROM stocktake_session").get();

    await submitStocktake(db, {
        ...base, createdBy: "liff:U999", createdByName: "小華",
        baseSubmittedAt: String(first.submitted_at),
        counts: [{ code: "A1", name: "豆薯", sys: 10, counted: 9 }, { code: "A2", name: "洋蔥", sys: 5, counted: 5 }],
    });

    const rows = await auditRows(db, "submit_overwrite");
    assert.equal(rows.length, 1, "覆蓋要留軌跡，否則覆盤後查不到本來誰盤的");
    assert.equal(rows[0].actor_username, "liff:U999");
    assert.match(rows[0].summary, /覆蓋/);

    const meta = JSON.parse(rows[0].meta_json);
    assert.ok(meta.overwrote, "要帶被覆蓋的前一場次");
    assert.equal(meta.overwrote.created_by, "liff:U123");
    assert.equal(meta.overwrote.created_by_name, "阿明");
    assert.equal(meta.counted_count, 2, "新的一場是 2 項");
});

test("3. 盤點被擋下（樂觀鎖 409）時不得留下軌跡", async () => {
    const db = await freshDb();
    await submitStocktake(db, { ...base, counts: [{ code: "A1", name: "豆薯", sys: 10, counted: 8 }] });
    const before = (await db.prepare("SELECT COUNT(*) AS n FROM data_change_log").get()).n;

    await assert.rejects(
        () => submitStocktake(db, { ...base, baseSubmittedAt: "2020-01-01T00:00:00.000Z", counts: [{ code: "A1", name: "豆薯", sys: 10, counted: 1 }] }),
        (e) => e.httpStatus === 409
    );
    const after = (await db.prepare("SELECT COUNT(*) AS n FROM data_change_log").get()).n;
    assert.equal(Number(after), Number(before), "沒送出成功就不該有軌跡（稽核在交易內，一起 ROLLBACK）");
});

test("4. 不變式：盤點稽核必須寫在交易內（原始碼層級）", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "dist", "lib", "stocktake-api.js"), "utf8");
    assert.match(src, /const doWrite = async \(tx\) => \{[\s\S]*?writeAudit\)\(tx,[\s\S]*?\};/,
        "submitStocktake 的稽核要用 writeAudit(tx,…) 寫在交易內——搬到交易外或改成 " +
        "writeAuditSafe，就會回到「盤點覆蓋了、軌跡沒留」的狀態");
});

test("5. 凌越 callback 回填單號會寫稽核", async () => {
    const db = await freshDb();
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run("c1", "客戶");
    await db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status) VALUES (?,?,?,?,?)")
        .run("o1", "N1", "c1", "2026-09-01", "pending");

    // 直接驗 helper 語意：callback 成功分支＝UPDATE ＋ 同交易 writeAudit
    const { writeAudit } = require("../dist/lib/audit.js");
    await db.transaction(async (h) => {
        await h.prepare("UPDATE orders SET lingyue_doc_no = ?, lingyue_written_at = ? WHERE id = ?").run("LY001", "2026-09-01T10:00:00Z", "o1");
        await writeAudit(h, {
            entityType: "order", entityId: "o1", action: "lingyue_writeback_done",
            summary: "凌越回寫完成，單號 LY001",
            meta: { source: "lingyue-writeback/callback", doc_no: "LY001", order_no: "N1" },
            actor: "system:lingyue_agent",
        });
    });
    const rows = await auditRows(db, "lingyue_writeback_done");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].actor_username, "system:lingyue_agent");
    assert.equal(JSON.parse(rows[0].meta_json).doc_no, "LY001");
});

test("6. 不變式：callback 的成功與衝突分支都要在交易內寫稽核（原始碼層級）", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "dist", "admin", "lingyue-writeback.js"), "utf8");
    assert.match(src, /const doFill = async \(h\) => \{[\s\S]*?writeAudit\)\(h,[\s\S]*?\};/,
        "回填 lingyue_doc_no（＝凌越已開單的憑證）要與 UPDATE 同交易留軌跡");
    assert.match(src, /const doConflict = async \(h\) => \{[\s\S]*?writeAudit\)\(h,[\s\S]*?\};/,
        "單號衝突（可能重複開單）不能只推播——推播看過就沒了，必須入表");
});
