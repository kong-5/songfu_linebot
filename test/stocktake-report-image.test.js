"use strict";
/**
 * 盤點結果報表圖 smoke test：只驗「圖上的字與口徑」與分頁規則，不驗像素。
 * 產圖本身要 sharp（Docker 才有 CJK 字型），這裡驗 SVG 字串即可——
 * 版面壞掉通常是欄位算錯/漏欄，不是 sharp 出錯。
 */
const test = require("node:test");
const assert = require("node:assert");

const { buildStocktakeReportSvgs } = require("../dist/lib/stocktake-report-image.js");

const BASE = {
    companyName: "松富物流",
    whCode: "FN005",
    whName: "冷凍庫房",
    date: "2026-08-03",
    countedBy: "阮氏梅",
    submittedAt: "2026/08/03 17:42",
    hotRuleText: "盤差 ≥5%",
};

function mkItems(n) {
    return Array.from({ length: n }, (_, i) => ({
        code: "10101" + String(i).padStart(2, "0"),
        name: "測試品項" + i,
        spec: "18KG/箱",
        unit: "KG",
        sys: 100, fut: 0, should: 100, counted: 100, diff: 0, hot: false, mid: 0, expiry: [],
    }));
}

test("單頁：表頭欄位與抬頭資訊都在圖上", () => {
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: false, items: mkItems(3) });
    for (const t of ["盤點結果表", "松富物流", "FN005", "冷凍庫房", "阮氏梅", "2026/08/03（一）", "系統", "應有", "實盤", "盤差"]) {
        assert.ok(svg.includes(t), "圖上應有：" + t);
    }
    // 未來銷貨關閉時不出現「未來」欄
    assert.ok(!svg.includes(">未來<"), "futOn=false 不應有未來欄");
});

test("未來銷貨開啟：多一欄未來，且頁尾標明應有＝系統＋未來銷貨", () => {
    const items = [{ code: "2010212", name: "豆薯", spec: "18KG/箱", unit: "KG", sys: 64.4, fut: 26.8, should: 91.2, counted: 92, diff: 0.8, hot: false, mid: 0, expiry: [] }];
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: true, items });
    assert.ok(svg.includes(">未來<"), "應有未來欄");
    assert.ok(svg.includes("+26.8"), "未來量要帶正負號");
    assert.ok(svg.includes("應有＝系統＋未來銷貨"), "頁尾要說明口徑");
    assert.ok(svg.includes("+0.8"), "盤差要帶正負號");
});

test("KPI：已盤／有盤差／紅標數量正確，未盤標「未盤」", () => {
    const items = [
        { code: "A", name: "甲", sys: 10, fut: 0, should: 10, counted: 10, diff: 0, hot: false, expiry: [] },
        { code: "B", name: "乙", sys: 10, fut: 0, should: 10, counted: 8, diff: -2, hot: true, expiry: [] },
        { code: "C", name: "丙", sys: 10, fut: 0, should: 10, counted: null, diff: null, hot: false, expiry: [] },
    ];
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: false, items });
    assert.ok(svg.includes(">2/3<"), "已盤應為 2/3");
    assert.ok(svg.includes("未盤"), "沒盤的品項要標未盤");
    assert.ok(svg.includes("-2"), "盤差要顯示");
});

test("品項多時分頁，且每頁都標頁碼", () => {
    const svgs = buildStocktakeReportSvgs({ ...BASE, futOn: false, items: mkItems(65) });
    assert.strictEqual(svgs.length, 3, "65 項應分 3 頁（每頁 30 列）");
    assert.ok(svgs[0].includes("第 1/3 頁"));
    assert.ok(svgs[1].includes("盤點結果表（續）"), "第 2 頁起用續頁抬頭");
    // 每頁高度都要在 LINE 圖片上限 4096px 內
    for (const svg of svgs) {
        const h = Number(/height="(\d+)"/.exec(svg)[1]);
        assert.ok(h <= 4096, "單頁高度不可超過 LINE 上限 4096px，實際 " + h);
    }
});

test("品名含 XML 特殊字元不會壞掉 SVG", () => {
    const items = [{ code: "X", name: "牛肉<A&B>「特選」", spec: '3"/包', sys: 1, fut: 0, should: 1, counted: 1, diff: 0, hot: false, expiry: [] }];
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: false, items });
    assert.ok(svg.includes("&lt;A&amp;B&gt;"), "特殊字元要 escape");
    assert.ok(!/<text[^>]*>[^<]*<A/.test(svg), "不可產生未 escape 的標籤");
});
