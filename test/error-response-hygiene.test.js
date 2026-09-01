"use strict";
/**
 * Smoke test：錯誤回應衛生與 async router 安全網（2026-09-01 體檢）。
 *
 * 兩件事：
 *  1. lingyue-writeback / cash 共 17 處直接把 `String(e.message)` 回給前端。
 *     問題不在「說太多」而在說錯東西——sqlForPg 丟的錯誤含 SQL 前 120 字、
 *     PG 唯一鍵衝突含索引與欄位名，對使用者零幫助卻把資料表結構送出去。
 *     守則 #4 要的是「告訴使用者怎麼修正」，所以不是消音，是換掉該換的那種。
 *  2. dist/liff 與 dist/webhook 的 router 過去沒有 async 錯誤網（只有 admin 有），
 *     加一個忘了 try/catch 的 handler 就會讓請求永遠 hang、或打掛整個程序。
 *
 * 跑法：npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

const { safeErrDetail } = require("../dist/admin/_shared.js");
const { wrapRouterAsync } = require("../dist/lib/async-router.js");

test("1. sqlForPg 那類含 SQL 的錯誤訊息不得原樣外流", () => {
    const out = safeErrDetail(new Error("sqlForPg 不支援 SQLite 專屬語法：INSERT INTO stocktake_count (id, session_id, erp_code) VALUES (?,?,?)"));
    assert.doesNotMatch(out, /INSERT INTO/i, "SQL 內容不該回給前端");
    assert.doesNotMatch(out, /stocktake_count/, "資料表名不該回給前端");
    assert.match(out, /伺服器日誌/, "要告訴使用者完整內容在哪裡");
});

test("2. PG 唯一鍵衝突（含索引/欄位名）也要換掉", () => {
    const out = safeErrDetail(new Error('duplicate key value violates unique constraint "ux_orders_order_no"'));
    assert.doesNotMatch(out, /ux_orders_order_no/, "索引名等於洩漏資料表結構");
});

test("3. 可讀的商業邏輯錯誤要保留（不能一併消音，那才違反守則 #4）", () => {
    const msg = "此倉今日盤點已被其他人送出，請重新載入";
    assert.equal(safeErrDetail(new Error(msg)), msg, "這種訊息告訴使用者怎麼修正，必須留著");
    const msg2 = "數量格式錯誤：「高麗菜」數量「abc」不是有效數字。請輸入 0 或正數後再儲存。";
    assert.equal(safeErrDetail(new Error(msg2)), msg2);
});

test("4. 過長訊息會截斷，空錯誤不會爆", () => {
    assert.ok(safeErrDetail(new Error("あ".repeat(500))).length <= 200);
    assert.equal(safeErrDetail(null), "");
    assert.equal(safeErrDetail(undefined), "");
});

test("5. 原始碼不得再出現「原始錯誤直接回前端」的舊寫法", () => {
    for (const f of ["lingyue-writeback.js", "cash.js"]) {
        const src = fs.readFileSync(path.join(__dirname, "..", "dist", "admin", f), "utf8");
        assert.ok(!src.includes("detail: String(e?.message || e)"),
            `${f} 又出現 detail: String(e?.message || e) —— 請改用 safeErrDetail(e)`);
    }
});

test("6. async router 安全網：handler 丟出的 rejection 會轉給錯誤中介層，不 hang", async () => {
    const app = express();
    const router = express.Router();
    wrapRouterAsync(router);
    // 故意寫一個沒有 try/catch 的 async handler（就是體檢擔心的那種）
    router.get("/boom", async () => { throw new Error("內部爆炸：SELECT * FROM secret_table"); });
    app.use("/t", router);
    // 全域錯誤中介層：比照 dist/index.js，只回制式訊息
    app.use((err, _req, res, _next) => { res.status(500).type("text/plain").send("伺服器錯誤，請稍後再試"); });

    const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    try {
        const res = await fetch("http://127.0.0.1:" + server.address().port + "/t/boom");
        assert.equal(res.status, 500, "要回 500，而不是永遠 hang");
        const body = await res.text();
        assert.doesNotMatch(body, /secret_table/, "內部錯誤細節不該出現在回應裡");
    } finally { await new Promise((r) => server.close(r)); }
});

test("7. 錯誤中介層 (err,req,res,next) 不得被包（包了錯誤處理就失效）", async () => {
    const app = express();
    const router = express.Router();
    wrapRouterAsync(router);
    let handledByErrorMw = false;
    router.get("/boom", async () => { throw new Error("x"); });
    router.use((err, _req, res, _next) => { handledByErrorMw = true; res.status(500).send("ok-handled"); });
    app.use("/t", router);

    const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    try {
        await fetch("http://127.0.0.1:" + server.address().port + "/t/boom");
        assert.ok(handledByErrorMw, "四參數的錯誤中介層必須仍然收得到錯誤");
    } finally { await new Promise((r) => server.close(r)); }
});

test("8. 三個 router 都套上了 async 安全網（原始碼層級）", () => {
    const files = {
        "dist/admin/index.js": "admin",
        "dist/liff/index.js": "liff",
        "dist/webhook/line.js": "webhook",
    };
    for (const [rel, name] of Object.entries(files)) {
        const src = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
        assert.match(src, /wrapRouterAsync\)\(router\)/,
            `${name} 的 router 沒有套 async 安全網——忘了 try/catch 的 handler 會讓請求 hang`);
    }
});
