"use strict";
/**
 * Smoke test：xlsx 解析的原型污染防護（2026-09-01 體檢）。
 *
 * 背景：xlsx@0.18.5 是 SheetJS 在 npm 上的最後一版（作者搬去 cdn.sheetjs.com，
 * npm 這個套件名停更），中 CVE-2023-30533（prototype pollution，修在 0.19.3）與
 * CVE-2024-22363（ReDoS，修在 0.20.2）。全專案唯一的解析入口是後台匯入
 * （dist/admin/index.js parseRequestToSheet，5MB 上限、admin 認證之後），
 * 所以不是未認證 RCE；但 prototype pollution 是 process-wide，而同一個 process
 * 還在跑 LINE webhook。
 *
 * 鎖住：
 *   - 正常檔案照常解析（防護不能擋到日常匯入）
 *   - 解析過程若污染了 Object.prototype → 清掉並丟出可行動的錯誤
 *   - 唯一入口確實走這層防護（原始碼層級）
 *
 * 跑法：npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const { readWorkbookSafe } = require("../dist/lib/xlsx-safe.js");

test("1. 正常的 xlsx 照常解析（防護不得擋到日常匯入）", () => {
    const ws = XLSX.utils.aoa_to_sheet([["料號", "品名", "數量"], ["A001", "高麗菜", 5]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const parsed = readWorkbookSafe(buf);
    const arr = XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]], { header: 1, defval: "" });
    assert.equal(arr[0][0], "料號");
    assert.equal(arr[1][1], "高麗菜");
});

test("2. 解析過程污染了 Object.prototype → 清除並丟出可行動的錯誤", () => {
    // 直接模擬「解析當下原型被加了東西」——不需要真的做出一個惡意 xlsx，
    // 這條測的是防護機制本身有沒有偵測到並收拾乾淨。
    const origRead = XLSX.read;
    XLSX.read = function () {
        Object.prototype.__polluted_by_test__ = "boom";
        return { SheetNames: ["S"], Sheets: { S: {} } };
    };
    try {
        assert.throws(
            () => readWorkbookSafe(Buffer.from("x")),
            (e) => /異常內容|拒絕匯入/.test(String(e.message)),
            "偵測到污染要丟出「這個檔案有問題」而不是靜默通過"
        );
    } finally { XLSX.read = origRead; }

    assert.equal({}.__polluted_by_test__, undefined, "污染必須被清掉，否則整個 process 都中鏢");
    assert.ok(!Object.getOwnPropertyNames(Object.prototype).includes("__polluted_by_test__"));
});

test("3. 錯誤訊息告訴使用者怎麼修正（守則 #4）", () => {
    const origRead = XLSX.read;
    XLSX.read = function () { Object.prototype.__p2__ = 1; return {}; };
    let msg = "";
    try {
        try { readWorkbookSafe(Buffer.from("x")); } catch (e) { msg = String(e.message); }
    } finally { XLSX.read = origRead; delete Object.prototype.__p2__; }
    assert.match(msg, /另存新檔|再試一次/, "要給下一步動作，不能只說『檔案錯誤』");
});

test("4. 唯一的上傳解析入口確實走防護（原始碼層級）", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "dist", "admin", "index.js"), "utf8");
    assert.match(src, /readWorkbookSafe\)\(req\.file\.buffer\)/,
        "後台匯入要用 readWorkbookSafe");
    assert.ok(!/XLSX\.read\(req\.file\.buffer/.test(src),
        "不得繞過防護直接 XLSX.read 使用者上傳的 buffer");
});

test("5. 只有「讀取」需要防護；寫出（匯出報表）不受影響", () => {
    // 這條是說明性的：CVE 需要解析攻擊者控制的檔案才會觸發，
    // orders/cash/baskets/export-backup 的 XLSX.write 是我們自己產檔，沒有這個問題。
    const dir = path.join(__dirname, "..", "dist", "admin");
    const readers = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".js"))) {
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        if (/XLSX\.read\(/.test(src)) readers.push(f);
    }
    assert.deepEqual(readers, [], "admin 域檔不該再有裸的 XLSX.read——新增讀取入口請改用 readWorkbookSafe");
});
