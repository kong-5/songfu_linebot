"use strict";
/**
 * Smoke test：手動結單與自動結單走同一支（盤查 §一 A1/A2）。
 *
 * 修正前的兩個問題：
 *  A1 手動結單（「完成」／「以上X收單」）**完全不發訂單明細摘要**，而且會 clearTimeout 掉
 *     30 秒自動結單 timer——所以「以上X收單」數量對不上時回的「請對照 30 秒後的訂單明細」
 *     永遠等不到。客戶主動關單反而收不到核對憑據。
 *  A2 手動路徑「先刪 session 再 rebuild」：rebuild 期間當機＝session 已消失、重啟不補跑結單
 *     （自動路徑 2026-07-14 已修成 rebuild 完成才刪，手動漏改）。
 *
 * 兩路現在共用 finalizeCollectedOrders。這裡以原始碼結構鎖住不變式，避免日後又各寫一份漂移
 * （比照 line-intake-closed-loop / batch8 NUL byte 的結構測試做法——line.js 的收單狀態機
 * 需要完整 LINE client 與 webhook 事件流才能行為測試，成本遠高於它能擋下的回歸）。
 *
 * 跑法：npm test。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "dist", "webhook", "line.js"), "utf8");
/** 只留程式碼的版本：註解裡會引用舊文案來說明「當初錯在哪」，不該被當成還在用的字串。 */
const CODE_ONLY = SRC.split("\n")
    .filter((l) => {
        const t = l.trim();
        return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");

test("結單流程只有一份實作（摘要組裝不再被複製兩份）", () => {
    assert.match(SRC, /const finalizeCollectedOrders = async \(groupId, session, opts/, "應有共用的 finalizeCollectedOrders");
    // 摘要文案是整段結單流程的指紋：出現兩次＝又被複製成兩份實作了
    const summaryMarkers = (SRC.match(/訂購項目如下/g) || []).length;
    assert.equal(summaryMarkers, 1, "摘要組裝應只有一份，實得 " + summaryMarkers + " 份");
    const rebuildLoops = (SRC.match(/rebuildOrderItemsFromOrderSources\)\(db, oid, session\.customerId/g) || []).length;
    assert.equal(rebuildLoops, 1, "結單重辨識迴圈應只有一份，實得 " + rebuildLoops + " 份");
});

test("自動結單與手動結單都呼叫 finalizeCollectedOrders", () => {
    assert.match(SRC, /await finalizeCollectedOrders\(groupId, session, \{ logTag: "30 秒自動結單" \}\)/, "自動結單應呼叫共用結單");
    assert.match(SRC, /await finalizeCollectedOrders\(groupId, session, \{ logTag: "手動結單" \}\)/, "手動結單應呼叫共用結單");
});

test("A2：持久化 session 在 rebuild 完成後才刪（當機可由 restoreCollectSessions 補跑）", () => {
    const start = SRC.indexOf("const finalizeCollectedOrders");
    assert.ok(start > 0, "找不到 finalizeCollectedOrders");
    const end = SRC.indexOf("const scheduleAutoFinalize", start);
    assert.ok(end > start, "找不到 finalizeCollectedOrders 的結尾");
    const body = SRC.slice(start, end);
    const rebuildAt = body.indexOf("rebuildOrderItemsFromOrderSources");
    const deleteAt = body.indexOf("deleteCollectSession(db, groupId)");
    assert.ok(rebuildAt > 0, "結單流程應含整單重辨識");
    assert.ok(deleteAt > 0, "結單流程應含 deleteCollectSession");
    assert.ok(rebuildAt < deleteAt, "deleteCollectSession 必須在 rebuild 之後（否則當機就永久漏單）");
});

test("A2：手動結單區塊不再自己先刪持久化 session", () => {
    const doneAt = SRC.indexOf("if (isDone) {");
    assert.ok(doneAt > 0, "找不到手動結單區塊");
    const finAt = SRC.indexOf("finalizeCollectedOrders(groupId, session, { logTag: \"手動結單\" })", doneAt);
    assert.ok(finAt > doneAt, "手動結單區塊應呼叫共用結單");
    const between = SRC.slice(doneAt, finAt);
    assert.ok(!/deleteCollectSession\(db, groupId\)/.test(between), "手動結單不應在 finalize 之前自己刪持久化 session");
    // 記憶體 map 仍要先移除＝防重複結單，這個順序是對的
    assert.match(between, /collectingByGroup\.delete\(groupId\)/, "仍應先從 collectingByGroup 移除以防重複結單");
});

test("全域「對客戶靜音」開關對結單摘要仍然有效（手動／自動都走這道閘門）", () => {
    const start = SRC.indexOf("const finalizeCollectedOrders");
    const end = SRC.indexOf("const scheduleAutoFinalize", start);
    const body = SRC.slice(start, end);
    const gateAt = body.indexOf("isLineSuppressCustomerReply");
    const pushAt = body.indexOf("pushMessage");
    assert.ok(gateAt > 0, "結單流程必須讀 isLineSuppressCustomerReply（全域靜音開關）");
    assert.ok(pushAt > gateAt, "靜音判斷必須在任何 pushMessage 之前");
    // 「以上X收單」提醒也不能繞過靜音
    const doneAt = SRC.indexOf("if (isDone) {");
    const remindAt = SRC.indexOf("以上 ${claimed} 收單", doneAt);
    assert.ok(remindAt > 0, "找不到以上X收單提醒");
    const remindBlock = SRC.slice(doneAt, remindAt);
    assert.match(remindBlock, /isLineSuppressCustomerReply/, "以上X收單提醒同樣要先過靜音開關");
});

test("A1：不再叫客戶等「30 秒後的訂單明細」（該摘要在手動結單時根本不會來）", () => {
    assert.ok(!/請對照 30 秒後的訂單明細/.test(CODE_ONLY), "舊文案應已從實際推播訊息移除");
    assert.match(CODE_ONLY, /請對照上方的訂單明細確認/, "應改為指向剛推播的明細");
});
