"use strict";
/**
 * Smoke test：報價單分頁／分欄（2026-08）。
 * 起因：115年08月冷凍產品表加了幾項水產後，PDF 第一頁左欄只排到第 20 項就整片空白、
 * 右欄卻排到第 27 列被頁尾切掉一半，剩兩項掉到第二頁。
 * 舊做法＝「先切 50 列一頁、再對半分兩欄」，對半時只要切點落在分類邊界（30%~70% 都收）
 * 就會變成 23／27 的不對稱分欄：短的那欄留白、長的那欄溢出頁面。
 *
 * 鎖住的行為：
 *   1. 單欄容量 QUOTE_COLUMN_ROWS＝26（A4 圖版能放的極限），沒有任何一欄可以超過。
 *   2. 最後一頁以前的每一頁，兩欄都要塞滿（不塞滿＝頁面中間留白）。
 *   3. 分類標題不會留在欄尾當孤兒（標題在這欄、品項全在下一欄）。
 *   4. 上述那份 52 列的冷凍報價，修好後剛好一頁排滿、不再分兩頁。
 *   5. 分頁不吃掉也不重複任何一列（順序＝buildDisplayRows 的順序）。
 *
 * 跑法：npm test（node --test test/）。純函式，不需 DB。
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const quote = require("../dist/lib/quote-report.js");
const { buildDisplayRows, paginateColumns, QUOTE_COLUMN_ROWS, QUOTE_PAGE_ROWS } = quote;

/** 依 [[分類, 品項數], ...] 產生 getItemsGrouped 形狀的 groups。 */
function makeGroups(spec) {
    return spec.map(([category, n]) => ({
        category,
        items: Array.from({ length: n }, (_, i) => ({ name: `${category}${i + 1}`, spec: "3KG/包", price: 100, is_quoted: 1 })),
    }));
}

/** 展平回單一列陣列，用來確認分頁沒吃掉／重複任何一列。 */
function flatten(pages) {
    return pages.flatMap(([l, r]) => [...l, ...r]);
}

test("單欄容量與每頁列數：兩欄合計＝每頁", () => {
    assert.equal(QUOTE_PAGE_ROWS, QUOTE_COLUMN_ROWS * 2);
    assert.equal(QUOTE_COLUMN_ROWS, 26); // 改這個值要一起重算 renderQuotePageSvg 的 bodyTop/rowH
});

test("115年08月冷凍報價（52 列）剛好一頁排滿，不再溢出到第二頁", () => {
    const groups = makeGroups([["包子饅頭", 9], ["冷凍點心", 7], ["龍港包子", 4], ["冷凍雞肉", 8], ["冷凍豬肉", 7], ["冷凍水產", 11]]);
    const rows = buildDisplayRows(groups);
    assert.equal(rows.length, 52); // 46 品項＋6 分類標題

    const pages = paginateColumns(rows, QUOTE_COLUMN_ROWS);
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0].map(c => c.length), [26, 26]); // 左右一樣滿，沒有留白也沒有被切掉
});

test("任何一欄都不會超過容量（超過就會被頁尾切掉）", () => {
    for (const spec of [
        [["A", 25], ["B", 25]],
        [["A", 25], ["B", 26]],
        [["菇菌類", 12], ["生鮮蔬菜", 40], ["冷凍蔬菜", 10], ["醃漬加工", 8], ["豆製品", 9], ["麵條濕貨", 7], ["海帶海鮮", 6], ["南北乾貨", 8]],
        [["A", 3], ["B", 3]],
    ]) {
        const pages = paginateColumns(buildDisplayRows(makeGroups(spec)), QUOTE_COLUMN_ROWS);
        for (const [l, r] of pages) {
            assert.ok(l.length <= QUOTE_COLUMN_ROWS, `左欄 ${l.length} 列超過容量`);
            assert.ok(r.length <= QUOTE_COLUMN_ROWS, `右欄 ${r.length} 列超過容量`);
        }
    }
});

test("最後一頁以前的每一頁兩欄都塞滿（分類標題被往下推時可少一列）", () => {
    const groups = makeGroups([["菇菌類", 12], ["生鮮蔬菜", 40], ["冷凍蔬菜", 10], ["醃漬加工", 8], ["豆製品", 9], ["麵條濕貨", 7], ["海帶海鮮", 6], ["南北乾貨", 8]]);
    const pages = paginateColumns(buildDisplayRows(groups), QUOTE_COLUMN_ROWS);
    assert.ok(pages.length > 1);
    for (const [l, r] of pages.slice(0, -1)) {
        assert.ok(l.length >= QUOTE_COLUMN_ROWS - 1, `左欄只有 ${l.length} 列，頁面會留白`);
        assert.ok(r.length >= QUOTE_COLUMN_ROWS - 1, `右欄只有 ${r.length} 列，頁面會留白`);
    }
});

test("分類標題不會留在欄尾當孤兒", () => {
    // A 24 品項＋標題＝25 列，第 26 列剛好是 B 的標題 → 要整個推到下一欄
    const pages = paginateColumns(buildDisplayRows(makeGroups([["A", 24], ["B", 5], ["C", 30]])), QUOTE_COLUMN_ROWS);
    const cols = pages.flatMap(p => p);
    for (const col of cols) {
        if (!col.length) continue;
        assert.notEqual(col[col.length - 1].type, "cat", "分類標題落在欄尾，品項全跑到下一欄");
    }
    assert.equal(cols[0].length, 25); // 為了讓 B 的標題跟著品項走，左欄少排一列
    assert.equal(cols[1][0].type, "cat");
});

test("分頁不吃掉也不重複任何一列，順序不變", () => {
    const groups = makeGroups([["A", 9], ["B", 7], ["C", 4], ["D", 8], ["E", 7], ["F", 11], ["G", 30]]);
    const rows = buildDisplayRows(groups);
    const flat = flatten(paginateColumns(rows, QUOTE_COLUMN_ROWS));
    assert.equal(flat.length, rows.length);
    assert.deepEqual(flat, rows);
});

test("沒有品項時仍回一頁空白（兩欄）", () => {
    const pages = paginateColumns([], QUOTE_COLUMN_ROWS);
    assert.deepEqual(pages, [[[], []]]);
});

test("最後一頁分兩欄：容量內優先切在分類邊界，右欄仍不超過容量", () => {
    // 49 列（45 品項＋4 標題）：對半是 25，但第 24 列起是 D 的標題 → 切在 23 讓 D 整組留在右欄
    const rows = buildDisplayRows(makeGroups([["A", 9], ["B", 7], ["C", 4], ["D", 25]]));
    const [l, r] = quote.splitTwoColumns(rows, QUOTE_COLUMN_ROWS);
    assert.equal(l.length + r.length, rows.length);
    assert.ok(l.length <= QUOTE_COLUMN_ROWS && r.length <= QUOTE_COLUMN_ROWS);
    assert.equal(r[0].type, "cat");
    assert.equal(r[0].category, "D");
});

test("列印頁（HTML）與 PDF／JPG 走同一套分頁，頁數一致", async () => {
    const groups = makeGroups([["包子饅頭", 9], ["冷凍點心", 7], ["龍港包子", 4], ["冷凍雞肉", 8], ["冷凍豬肉", 7], ["冷凍水產", 11]]);
    const report = { id: "r1", title: "報 價 單", subtitle: "冷 凍 產 品 表", company: "台東龍港、松富(股)公司", roc_label: "115年08月份", ym: "2026-08" };
    const svgs = quote.renderQuotePageSvgs(report, groups, {});
    assert.equal(svgs.length, 1);
    assert.match(svgs[0], /第 1 頁，共 1 頁/);
    // 圖版最後一列的底部（bodyTop 278＋26×54）要在頁尾字（y=1730）之上
    assert.ok(278 + QUOTE_COLUMN_ROWS * 54 < 1730 - 24);
});
