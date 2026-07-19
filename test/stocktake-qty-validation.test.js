"use strict";
/**
 * Smoke test：盤點送出的伺服器端數量驗證（2026-07-19）。
 * 鎖住：舊版伺服器只 Number()，非數字→NaN→「NaN||0」靜默把實盤記成 0（憑空盤差/誤判短少），
 * 負數也照收；前端雖擋但入口多（LIFF/網頁/掃碼），伺服器不得信任前端。改為：
 *   1. 合法（含 null/空白＝未盤）→ 正常寫入
 *   2. 非數字 counted / 負數 / 非數字 mid → 丟 StkApiError(400, bad_qty)，且完全不寫入（原子）
 *   3. 回歸：非數字不再靜默變 0（送出被擋、session/count 皆無）
 *
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-stkval-"));
let seq = 0;
async function freshDb() {
    const { initDb, getDb } = require("../dist/db/index.js");
    const p = path.join(TMP, "t" + (++seq) + ".db");
    await initDb(p);
    return getDb(p);
}
const { submitStocktake } = require("../dist/lib/stocktake-api.js");

const base = { icpno: "02", whCode: "W1", createdBy: "admin:t", createdByName: "測試員" };
async function submit(db, counts) {
    return submitStocktake(db, { ...base, counts });
}
async function rowsFor(db) {
    const s = await db.prepare("SELECT COUNT(*) AS n FROM stocktake_session").get();
    const c = await db.prepare("SELECT COUNT(*) AS n FROM stocktake_count").get();
    return { sessions: Number(s.n), counts: Number(c.n) };
}
async function assertRejects(fn, codeWanted) {
    let err = null;
    try { await fn(); } catch (e) { err = e; }
    assert.ok(err, "應丟出錯誤");
    assert.equal(err.httpStatus, 400, "應為 400");
    assert.equal(err.code, codeWanted, "錯誤代碼應為 " + codeWanted);
    return err;
}

test("1. 合法數量（含未盤 null/空白）正常寫入", async () => {
    const db = await freshDb();
    const r = await submit(db, [
        { code: "P1", name: "高麗菜", counted: 5, mid: 1 },
        { code: "P2", name: "白蘿蔔", counted: 0 },
        { code: "P3", name: "未盤品", counted: null },
        { code: "P4", name: "空白品", counted: "" },
    ]);
    assert.equal(r.ok, true);
    const p1 = await db.prepare("SELECT counted_qty, mid_qty FROM stocktake_count WHERE erp_code='P1'").get();
    assert.equal(Number(p1.counted_qty), 6, "counted_qty 應為上+中合計 5+1");
    assert.equal(Number(p1.mid_qty), 1);
    const p3 = await db.prepare("SELECT counted_qty FROM stocktake_count WHERE erp_code='P3'").get();
    assert.equal(p3.counted_qty, null, "未盤品 counted_qty 應維持 null（非 0）");
});

test("2. 非數字 counted → 400 bad_qty，且完全不寫入", async () => {
    const db = await freshDb();
    const err = await assertRejects(() => submit(db, [
        { code: "P1", name: "高麗菜", counted: 5 },
        { code: "P2", name: "白蘿蔔", counted: "1O" }, // 手誤：字母 O
    ]), "bad_qty");
    assert.match(err.message, /白蘿蔔/, "訊息應指名品項");
    assert.match(err.message, /0 或正數/, "訊息應告訴使用者怎麼改");
    assert.deepEqual(await rowsFor(db), { sessions: 0, counts: 0 }, "整筆拒絕：不得半套寫入");
});

test("3. 負數與非數字中貨也擋", async () => {
    const db = await freshDb();
    await assertRejects(() => submit(db, [{ code: "P1", name: "A", counted: -3 }]), "bad_qty");
    await assertRejects(() => submit(db, [{ code: "P1", name: "A", counted: 2, mid: "x" }]), "bad_qty");
    assert.deepEqual(await rowsFor(db), { sessions: 0, counts: 0 });
});

test("4. 回歸：非數字不再靜默變 0", async () => {
    const db = await freshDb();
    // 舊版行為：Number('abc')→NaN→NaN||0→counted_qty=0（幽靈盤差）。新版：直接擋、不寫。
    await assertRejects(() => submit(db, [{ code: "P1", name: "高麗菜", counted: "abc" }]), "bad_qty");
    const any = await db.prepare("SELECT COUNT(*) AS n FROM stocktake_count WHERE erp_code='P1'").get();
    assert.equal(Number(any.n), 0, "非數字不得被記成 0 混進盤點");
});
