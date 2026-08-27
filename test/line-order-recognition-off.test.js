"use strict";
/**
 * Smoke test：停用 LINE「辨識訂單」（2026-08-27）。
 * 背景：現場已改以盤點為主，訂單辨識沒人在用，卻每則群組訊息都要送 Gemini／OCR＝AI 費用大宗。
 * 作法刻意「不新增第二個開關」——沿用既有的 line_bot_mode（後台 系統設定 → LINE 機器人），
 * 一次性遷移把它切成 always_off；日後在後台改回「一律開啟」即恢復，不需重新部署。
 *
 * 鎖住的行為：
 *   1. 全新 DB 初始化後 line_bot_mode = always_off，isBotAcceptingOrders 為 false。
 *   2. 遷移冪等且只做一次：改回 always_on 後再跑 initDb 不會被蓋回關閉（否則使用者永遠開不回來）。
 *   3. 閘門位置不變式：line.js 的休眠檢查在「所有 AI 解析呼叫之前」、且在「#盤點／空籃處理之後」
 *      ——關掉訂單辨識時 AI 一定不會被呼叫，而盤點／空籃／群組指令一定不受影響。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-orderoff-"));
const DB_PATH = path.join(TMP, "smoke.db");
process.env.DB_PATH = DB_PATH;
delete process.env.DATABASE_URL;

const ROOT = path.join(__dirname, "..");
const { initDb, getDb } = require("../dist/db/index.js");
const { isBotAcceptingOrders } = require("../dist/lib/line-bot-control.js");

let db;

test.before(async () => {
    await initDb(DB_PATH);
    db = getDb(DB_PATH);
});

test("1. 全新 DB：line_bot_mode = always_off，機器人不辨識訂單", async () => {
    const mode = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_bot_mode");
    assert.equal(mode?.value, "always_off", "一次性遷移應把 LINE 機器人切成一律關閉");
    const marker = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("order_recognition_off_migrated_20260827");
    assert.equal(marker?.value, "1", "遷移應留下 marker 鍵，避免下次部署重複覆蓋");
    assert.equal(await isBotAcceptingOrders(db), false);
});

test("2. 遷移只做一次：後台改回「一律開啟」後再部署不會被蓋回", async () => {
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_bot_mode", "always_on");
    await initDb(DB_PATH); // 模擬下一次部署重跑 init
    const mode = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_bot_mode");
    assert.equal(mode?.value, "always_on", "使用者手動開回來的設定不得被遷移覆蓋");
    assert.equal(await isBotAcceptingOrders(db), true);
});

test("3. line.js 閘門順序：AI 解析都在休眠檢查之後，盤點／空籃都在之前", () => {
    const src = fs.readFileSync(path.join(ROOT, "dist/webhook/line.js"), "utf8");
    const at = (needle, label) => {
        const i = src.indexOf(needle);
        assert.ok(i > 0, `line.js 找不到 ${label}（${needle}）——閘門被改名或移除了，請重新確認順序`);
        return i;
    };
    const idxAccepting = at("line_bot_control_js_1.isBotAcceptingOrders)(db)", "休眠（訂單辨識總開關）檢查");
    const idxBasket = at("basket_log_js_1.isBasketTrigger)(textEarly)", "空籃觸發詞攔截");
    const idxStocktake = at("await getGroupFeat()).stocktake", "#盤點 白名單閘門");
    const idxParseText = at("parse_order_message_js_1.parseOrderMessage)(", "文字訂單 AI 解析");
    const idxParseImage = at("parse_order_from_image_js_1.parseOrderItemsFromImageBuffer)(", "圖片 OCR＋AI 解析");

    assert.ok(idxBasket < idxAccepting, "空籃必須在休眠檢查之前處理（關閉訂單辨識不得影響空籃）");
    assert.ok(idxStocktake < idxAccepting, "#盤點 必須在休眠檢查之前處理（關閉訂單辨識不得影響盤點）");
    assert.ok(idxAccepting < idxParseImage, "圖片 OCR/AI 必須在休眠檢查之後（否則關閉仍會產生 AI 費用）");
    assert.ok(idxAccepting < idxParseText, "文字 AI 解析必須在休眠檢查之後（否則關閉仍會產生 AI 費用）");

    // 休眠時必須 continue（不是只記 log 就繼續往下跑）
    const tail = src.slice(idxAccepting, idxAccepting + 400);
    assert.match(tail, /if \(!accepting\)[\s\S]{0,300}continue;/, "休眠檢查後必須 continue 略過整則訊息");
});
