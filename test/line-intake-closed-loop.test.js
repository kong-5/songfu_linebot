"use strict";
/**
 * Smoke test：LINE 收單非-worker 路徑的失敗告警閉環（盤查 §一 A5/A6）。
 * Cloud Tasks worker 早有閉環（回 500 重試），但另兩條路徑（enqueue 失敗的 fallback、
 * 非 Cloud Tasks 模式的背景處理）過去是 .catch(console.error)＝斷單無告警。
 * 這裡以原始碼結構鎖住閉環，避免日後回退成裸 console.error（比照 batch8 的 NUL byte 結構測試）。
 *
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "dist", "webhook", "line.js"), "utf8");

test("line.js 有引入 ops-notify（供收單失敗告警用）", () => {
    assert.match(SRC, /require\("\.\.\/lib\/ops-notify\.js"\)/, "應 require ../lib/ops-notify.js");
});

test("收單失敗告警 helper 存在（notifyOpsSafe／notifyLineIntakeFailure）", () => {
    assert.match(SRC, /function notifyOpsSafe\(/, "應有 notifyOpsSafe helper");
    assert.match(SRC, /function notifyLineIntakeFailure\(/, "應有 notifyLineIntakeFailure helper");
    // 閉環判斷須真的看 failed 數
    assert.match(SRC, /result\.failed/, "notifyLineIntakeFailure 應讀 result.failed");
});

test("兩條非-worker 路徑都接上閉環（不再是裸 catch(console.error)）", () => {
    // 非 Cloud Tasks 背景處理：processLineWebhookEvents(events) 後應接 .then(...notifyLineIntakeFailure)
    assert.match(
        SRC,
        /processLineWebhookEvents\(events\)\s*\.then\(\s*\(r\)\s*=>\s*notifyLineIntakeFailure/,
        "非 CT 背景處理路徑應接 notifyLineIntakeFailure"
    );
    // Cloud Tasks fallback：processLineWebhookEvents(failedEvents) 後應接 .then(...notifyLineIntakeFailure)
    assert.match(
        SRC,
        /processLineWebhookEvents\(failedEvents\)\s*\.then\(\s*\(r\)\s*=>\s*notifyLineIntakeFailure/,
        "CT fallback 路徑應接 notifyLineIntakeFailure"
    );
    // 兩條的 catch 分支也要 notifyOpsSafe（整批拋錯同樣要告警）
    const notifyOpsSafeCalls = (SRC.match(/notifyOpsSafe\(/g) || []).length;
    assert.ok(notifyOpsSafeCalls >= 3, "notifyOpsSafe 至少被呼叫 3 次（helper 定義＋兩條 catch），實得 " + notifyOpsSafeCalls);
});
