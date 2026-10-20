"use strict";
/**
 * Smoke test：盤點搬到松揚新網站後，舊版送出要被擋（2026-10-20 業主選 B）。
 * 鎖住：
 *   1. 旗標沒設＝完全舊行為（送出成功、寫入 session/count）
 *   2. 旗標 '1' → submitStocktake 丟 StkApiError(410, code=moved)，且一列都不寫
 *   3. 旗標翻回 '0' → 立刻恢復（退回不用重新部署）
 *   4. 訊息要告訴人怎麼辦（含新連結）
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-stkmoved-"));
let seq = 0;
async function freshDb() {
    const { initDb, getDb } = require("../dist/db/index.js");
    const p = path.join(TMP, "t" + (++seq) + ".db");
    await initDb(p);
    return getDb(p);
}
const { submitStocktake } = require("../dist/lib/stocktake-api.js");
const { stocktakeMoved, MOVED_KEY, MOVED_MESSAGE, NEW_STOCKTAKE_LIFF, movedPayload } = require("../dist/lib/stocktake-moved.js");

const base = { icpno: "02", whCode: "W1", createdBy: "admin:t", createdByName: "測試員", counts: [{ code: "A1", counted: 3 }] };
async function rowsFor(db) {
    const s = await db.prepare("SELECT COUNT(*) AS n FROM stocktake_session").get();
    const c = await db.prepare("SELECT COUNT(*) AS n FROM stocktake_count").get();
    return { sessions: Number(s.n), counts: Number(c.n) };
}
async function setFlag(db, v) {
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(MOVED_KEY, v);
}

test("旗標沒設：送出照舊成功", async () => {
    const db = await freshDb();
    assert.equal(await stocktakeMoved(db), false);
    const out = await submitStocktake(db, base);
    assert.equal(out.ok, true);
    assert.deepEqual(await rowsFor(db), { sessions: 1, counts: 1 });
});

test("旗標 '1'：送出 410 moved、一列都不寫；翻回 '0' 立刻恢復", async () => {
    const db = await freshDb();
    await setFlag(db, "1");
    assert.equal(await stocktakeMoved(db), true);
    let err = null;
    try { await submitStocktake(db, base); } catch (e) { err = e; }
    assert.ok(err, "應丟出錯誤");
    assert.equal(err.name, "StkApiError");
    assert.equal(err.httpStatus, 410);
    assert.equal(err.code, "moved");
    assert.deepEqual(await rowsFor(db), { sessions: 0, counts: 0 });

    await setFlag(db, "0");
    assert.equal(await stocktakeMoved(db), false);
    const out = await submitStocktake(db, base);
    assert.equal(out.ok, true);
    assert.deepEqual(await rowsFor(db), { sessions: 1, counts: 1 });
});

test("訊息告訴人怎麼辦：含 #盤點 與新連結；payload 三個鍵", () => {
    assert.match(MOVED_MESSAGE, /#盤點/);
    assert.ok(MOVED_MESSAGE.includes(NEW_STOCKTAKE_LIFF));
    assert.deepEqual(Object.keys(movedPayload()).sort(), ["moved", "movedMessage", "movedUrl"]);
    assert.equal(movedPayload().movedUrl, NEW_STOCKTAKE_LIFF);
});

test("#盤點 卡片（旗標開）：松富逐倉按鈕指向新網站 ?wh=倉號、附掃碼鈕；其他公司一顆開啟鈕", () => {
    const { movedStocktakeCard, NEW_SCAN_LIFF } = require("../dist/lib/stocktake-moved.js");
    const whRows = [{ code: "FN005", name: "松富冷藏備貨庫" }, { code: "FN006", name: "松富冷凍肉類" }];
    const card = movedStocktakeCard({ whRows, icpno: "00", companyName: "松富", date: "2026-10-20" });
    assert.equal(card.type, "flex");
    const uris = card.contents.body.contents.filter((c) => c.type === "button").map((b) => b.action.uri);
    assert.equal(uris[0], NEW_STOCKTAKE_LIFF + "?wh=FN005");
    assert.equal(uris[1], NEW_STOCKTAKE_LIFF + "?wh=FN006");
    assert.equal(uris[2], NEW_STOCKTAKE_LIFF);
    assert.equal(uris[3], NEW_SCAN_LIFF);
    assert.ok(uris.every((u) => u.startsWith(NEW_STOCKTAKE_LIFF)), "沒有任何按鈕指向舊 LIFF");

    const other = movedStocktakeCard({ whRows, icpno: "02", companyName: "松揚", date: "2026-10-20" });
    const uris2 = other.contents.body.contents.filter((c) => c.type === "button").map((b) => b.action.uri);
    assert.deepEqual(uris2, [NEW_STOCKTAKE_LIFF, NEW_SCAN_LIFF]);
});
