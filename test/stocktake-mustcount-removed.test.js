"use strict";
/**
 * Smoke test：「必盤」功能整組移除（2026-08-13）。
 * 背景：舊功能把「自昨天以來凌越有變動」的品項標紅置頂（stock-mustcount.js）。現場回饋不需要
 * 且會誤導——打單/出貨造成的帳面變動不代表架上東西動過，紅標反而讓人以為要優先查、打亂盤點順序。
 *
 * 鎖住的行為：
 *   1. 權威 helper dist/lib/stock-mustcount.js 已刪除，dist/ 內無任何殘留 require。
 *   2. 盤點 items API（getStocktakeItems）即使昨天快照與現量不同，items 也不再帶 mc 標記。
 *   3. LIFF 盤點頁不再有必盤紅標/置頂/分隔列（mc-badge/mcsep/mustCount 文案 zh+vi 全移除）。
 *   4. erp_stock_daily 每日快照表**保留**（K 線／歷史盤差凍結基準仍靠它）——移除的只有必盤標記。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-mcrm-"));
process.env.DB_PATH = path.join(TMP, "smoke.db");
delete process.env.DATABASE_URL;

const ROOT = path.join(__dirname, "..");
const { initDb, getDb } = require("../dist/db/index.js");
const { getStocktakeItems, stkTaipeiDate } = require("../dist/lib/stocktake-api.js");

const ICP = "00", WH = "FN001";
let db;

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    const now = new Date().toISOString();
    const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - 86400000));
    await db.prepare("INSERT INTO erp_warehouse (icpno, code, name, include_stocktake, sort_order) VALUES (?, ?, ?, 1, 0)").run(ICP, WH, "測試倉");
    // 現量 80、昨天快照 50 → 舊必盤邏輯必標 mc；現在不得再標
    await db.prepare("INSERT INTO erp_stock_items (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(ICP, "A001", "測試豬肉", "", "KG", 80, WH, now);
    await db.prepare("INSERT INTO erp_stock_daily (icpno, erp_code, snap_date, qty, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run(ICP, "A001", yesterday, 50, now);
});

test("1. dist/lib/stock-mustcount.js 已刪除、dist/ 無殘留引用", () => {
    assert.ok(!fs.existsSync(path.join(ROOT, "dist/lib/stock-mustcount.js")), "helper 檔應已刪除");
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : (/\.(js|html)$/.test(e.name) ? [p] : []);
    });
    for (const f of walk(path.join(ROOT, "dist"))) {
        const src = fs.readFileSync(f, "utf8");
        assert.ok(!src.includes("stock-mustcount"), f + " 不應再引用 stock-mustcount");
        assert.ok(!src.includes("computeMustCount"), f + " 不應再呼叫 computeMustCount");
    }
});

test("2. items API：昨天快照有變動也不再標 mc", async () => {
    const out = await getStocktakeItems(db, { icpno: ICP, whCode: WH, minimal: false });
    assert.equal(out.date, stkTaipeiDate());
    const it = out.items.find((x) => x.c === "A001");
    assert.ok(it, "應回傳 A001");
    assert.ok(!("mc" in it) || !it.mc, "items 不得再帶 mc 必盤標記：" + JSON.stringify(it));
});

test("3. LIFF 盤點頁無必盤紅標/置頂/文案（zh+vi）", () => {
    const html = fs.readFileSync(path.join(ROOT, "dist/liff/stocktake.html"), "utf8");
    for (const kw of ["mc-badge", "mcsep", "mcSep", "mustCount", "Phải kiểm"])
        assert.ok(!html.includes(kw), "stocktake.html 不應再有「" + kw + "」");
});

test("4. erp_stock_daily 快照表保留（K 線／凍結基準仍靠它）", async () => {
    const r = await db.prepare("SELECT qty FROM erp_stock_daily WHERE icpno = ? AND erp_code = ?").get(ICP, "A001");
    assert.ok(r && Number(r.qty) === 50, "每日快照表應仍可讀寫");
});
