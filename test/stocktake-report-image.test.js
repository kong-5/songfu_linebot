"use strict";
/**
 * 盤點結果報表圖 smoke test：驗「圖上寫了什麼、什麼被收起來」與分頁規則，不驗像素。
 * 產圖本身要 sharp（Docker 有裝 fonts-noto-cjk），這裡驗 SVG 字串即可——
 * 版面壞掉通常是分段錯／漏字，不是 sharp 出錯。
 *
 * 版面是條列不是表格（2026-08-03）：盤差逐項展開、相符/未盤/帳 0 壓成幾行字、
 * 長期無貨整段不列。圖太長沒人捲得完，這個取捨才是重點，所以測試鎖的是分段。
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
    hotRuleText: "≥5%",
};
const mk = (o) => Object.assign({ code: "X", name: "品項", spec: "", unit: "KG", sys: 0, fut: 0, should: 0, counted: 0, diff: 0, hot: false, idle: false, mid: 0, expiry: [] }, o);

test("抬頭資訊與 KPI 都在圖上", () => {
    const items = [mk({ code: "A", name: "甲", sys: 10, should: 10, counted: 10 })];
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: false, items });
    for (const t of ["盤點結果", "松富物流", "FN005", "冷凍庫房", "阮氏梅", "2026/08/03（一）", "品項", "已盤", "有盤差", "紅標"]) {
        assert.ok(svg.includes(t), "圖上應有：" + t);
    }
});

test("有盤差的逐項展開（含 %、紅標標「要查」），相符的只壓成一行字", () => {
    const items = [
        mk({ code: "A", name: "雞胸肉", spec: "10KG/箱", sys: 342.6, should: 342.6, counted: 320, diff: -22.6, hot: true, mid: 20 }),
        mk({ code: "B", name: "豬前腿肉", sys: 214, should: 214, counted: 214, diff: 0 }),
        mk({ code: "C", name: "高麗菜", sys: 226, should: 226, counted: 226, diff: 0 }),
    ];
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: false, items });
    assert.ok(svg.includes("盤差"), "要有盤差段");
    assert.ok(svg.includes("系統 342.6 → 實盤 320（含中 20）"), "盤差項要寫出前後數字與中貨");
    assert.ok(svg.includes("-22.6（-6.6%）"), "要有盤差量與 %");
    assert.ok(svg.includes("要查"), "紅標要標示");
    assert.ok(svg.includes("相符"), "要有相符段");
    assert.ok(/豬前腿肉 214、高麗菜 226/.test(svg), "相符的品項壓成『品名 數量』一行，不逐列展開");
});

test("未來銷貨開啟：盤差項寫成「應有（帳 X ＋未來）」，頁尾標明口徑", () => {
    const items = [mk({ code: "B", name: "豆薯", spec: "18KG/箱", sys: 64.4, fut: 26.8, should: 91.2, counted: 92, diff: 0.8 })];
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: true, items });
    assert.ok(svg.includes("應有 91.2（帳 64.4 +26.8 未來）"), "要拆給人看懂未來量從哪來");
    assert.ok(svg.includes("+0.8"), "盤差帶正負號");
    assert.ok(svg.includes("盤差＝實盤−應有（系統＋未來銷貨）"), "頁尾要說明口徑");
});

test("未盤只列品名（漏盤要看得見）", () => {
    const items = [
        mk({ code: "A", name: "冬粉", sys: 15, should: 15, counted: null, diff: null }),
        mk({ code: "B", name: "米粉", sys: 24, should: 24, counted: 24 }),
    ];
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: false, items });
    assert.ok(svg.includes("未盤"), "要有未盤段");
    assert.ok(svg.includes("冬粉"), "未盤品名要列");
});

test("長期無貨（idle）不列，但頁尾要記數量——不可默默吃掉", () => {
    const items = [mk({ code: "A", name: "甲", sys: 10, should: 10, counted: 10 })]
        .concat(Array.from({ length: 12 }, (_, i) => mk({ code: "Z" + i, name: "停用品" + i, idle: true })));
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: false, items });
    assert.ok(!svg.includes("停用品0"), "長期無貨的品名不該出現");
    assert.ok(svg.includes("另有 12 項長期無貨未列"), "頁尾要記數量");
    assert.ok(svg.includes(">13<"), "KPI 品項數仍算全部（13）");
});

test("內容長會分頁，每頁高度都在 LINE 圖片上限 4096px 內", () => {
    const items = Array.from({ length: 120 }, (_, i) => mk({
        code: "D" + i, name: "盤差品項" + i, spec: "18KG/箱", sys: 100, should: 100, counted: 80, diff: -20, hot: true,
    }));
    const svgs = buildStocktakeReportSvgs({ ...BASE, futOn: false, items });
    assert.ok(svgs.length > 1, "120 項盤差應該分頁，實際 " + svgs.length);
    assert.ok(svgs[0].includes("第 1/" + svgs.length + " 頁"));
    assert.ok(svgs[1].includes("盤點結果（續）"), "第 2 頁起用續頁抬頭");
    for (const svg of svgs) {
        const h = Number(/height="(\d+)"/.exec(svg)[1]);
        assert.ok(h <= 4096, "單頁高度不可超過 LINE 上限 4096px，實際 " + h);
    }
});

test("品名含 XML 特殊字元不會壞掉 SVG", () => {
    const items = [mk({ code: "X", name: "牛肉<A&B>「特選」", spec: '3"/包', sys: 1, should: 1, counted: 1 })];
    const [svg] = buildStocktakeReportSvgs({ ...BASE, futOn: false, items });
    assert.ok(svg.includes("&lt;A&amp;B&gt;"), "特殊字元要 escape");
    assert.ok(!/<text[^>]*>[^<]*<A/.test(svg), "不可產生未 escape 的標籤");
});
