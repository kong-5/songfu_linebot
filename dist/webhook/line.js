"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLineWebhook = createLineWebhook;
const express_1 = __importDefault(require("express"));
const bot_sdk_1 = require("@line/bot-sdk");
const index_js_1 = require("../db/index.js");
const parse_order_message_js_1 = require("../lib/parse-order-message.js");
const resolve_product_js_1 = require("../lib/resolve-product.js");
const id_js_1 = require("../lib/id.js");
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
const lineConfig = { channelAccessToken, channelSecret };
const hasLineConfig = Boolean(channelAccessToken && channelSecret);
/** 收單模式：群組 ID -> 正在累加的那筆訂單 */
const collectingByGroup = new Map();
function createLineWebhook() {
    const router = express_1.default.Router();
    const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
    const db = (0, index_js_1.getDb)(dbPath);
    const lineClient = hasLineConfig ? new bot_sdk_1.Client(lineConfig) : null;
    if (hasLineConfig) {
        router.use((0, bot_sdk_1.middleware)(lineConfig));
    }
    else {
        router.use((_req, _res, next) => next());
    }
    router.post("/", (req, res) => {
        if (typeof req.body === "string") {
            req.body = JSON.parse(req.body);
        }
        const events = req.body?.events ?? [];
        console.log("[LINE] 處理 events 數量:", events.length, "hasLineConfig:", hasLineConfig);
        // 先回 200 給 LINE，避免逾時重送；實際處理在背景執行
        res.status(200).send("OK");
        (async () => {
            for (const event of events) {
                try {
                    if (event.type !== "message") {
                        console.log("[LINE] 略過非訊息, type:", event.type);
                        continue;
                    }
                    const msgType = event.message.type;
                    const groupId = event.source.type === "group" ? event.source.groupId : null;
                    if (groupId)
                        console.log("[LINE] 群組 ID：", groupId);
                    const customer = groupId
                        ? db.prepare("SELECT id, name FROM customers WHERE line_group_id = ? AND (active IS NULL OR active = 1)").get(groupId)
                        : null;
                    // 照片：收單中請補文字；未收單請先傳「收單」
                    if (msgType === "image") {
                        if (groupId && !customer) {
                            await reply(lineClient, event.replyToken, "此群組尚未綁定客戶，無法收單。若需取得本群組 ID 請傳：取得群組ID");
                            continue;
                        }
                        if (!customer) {
                            await reply(lineClient, event.replyToken, "請在已綁定客戶的群組內叫貨。");
                            continue;
                        }
                        const inCollecting = groupId ? collectingByGroup.has(groupId) : false;
                        if (inCollecting) {
                            await reply(lineClient, event.replyToken, "請用文字說明品項與數量（例如：高麗菜 5 斤），照片無法自動辨識。");
                        }
                        // 未在收單中傳照片：不回覆，省則數
                        continue;
                    }
                    if (msgType !== "text") {
                        console.log("[LINE] 略過非文字訊息, type:", msgType);
                        continue;
                    }
                    const text = event.message.text.trim();
                    console.log("[LINE] 收到文字:", JSON.stringify(text));
                    // 取得群組 ID（未綁定也可用）
                    if (groupId && (text === "取得群組ID" || text === "群組ID")) {
                        await reply(lineClient, event.replyToken, `此群組 ID：\n${groupId}\n請將此 ID 提供給管理員，在後台「匯入客戶」或「客戶管理」綁定對應客戶。`);
                        continue;
                    }
                    if (groupId && !customer) {
                        console.log("[LINE] 未綁定群組，群組 ID:", groupId);
                        await reply(lineClient, event.replyToken, "此群組尚未綁定客戶，無法收單。請聯絡管理員在後台「客戶管理」設定此群組的 LINE 群組 ID。若需取得本群組 ID 請傳：取得群組ID");
                        continue;
                    }
                    if (!customer) {
                        await reply(lineClient, event.replyToken, "請在已綁定客戶的群組內叫貨。");
                        continue;
                    }
                    const customerId = customer.id;
                    const orderDate = new Date().toISOString().slice(0, 10);
                    // 「收單」或「開始收單」→ 進入收單模式，可多則累加，傳完說「完成」
                    if (text === "收單" || text === "開始收單") {
                        let orderRow = db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ?").get(customerId, orderDate);
                        let orderId;
                        if (orderRow) {
                            orderId = orderRow.id;
                        }
                        else {
                            orderId = (0, id_js_1.newId)("ord");
                            db.prepare(`INSERT INTO orders (id, customer_id, order_date, line_group_id, raw_message, status)
               VALUES (?, ?, ?, ?, ?, 'pending')`).run(orderId, customerId, orderDate, groupId, "");
                        }
                        if (groupId)
                            collectingByGroup.set(groupId, { orderId, customerId });
                        await reply(lineClient, event.replyToken, "開始收單。請客戶傳叫貨內容（可多則）；我方傳「以上X收單」即結束並告知已收幾項。");
                        continue;
                    }
                    // 「完成」「結束收單」或「以上X收單」（由我方觸發結束，X 可半形或全形數字）
                    const aboveMatch = text.match(/^以上\s*([\d\uFF10-\uFF19]+)\s*收單$/);
                    const isDone = text === "完成" || text === "結束收單" || aboveMatch;
                    if (isDone) {
                        if (groupId && collectingByGroup.has(groupId)) {
                            const session = collectingByGroup.get(groupId);
                            collectingByGroup.delete(groupId);
                            const count = db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ?").get(session.orderId);
                            const n = count?.c ?? 0;
                            await reply(lineClient, event.replyToken, `完成，已收 ${n} 項。`);
                        }
                        else {
                            await reply(lineClient, event.replyToken, "目前沒有在收單。請先由我方傳「收單」開始，客戶傳完叫貨後再傳「以上X收單」結束。");
                        }
                        continue;
                    }
                    // 未在收單模式：不當成叫貨，也不回覆（省則數）
                    if (!groupId || !collectingByGroup.has(groupId)) {
                        continue;
                    }
                    // 收單模式：將本則當成叫貨累加
                    const session = collectingByGroup.get(groupId);
                    const { orderId, customerId: cid } = session;
                    let orderRow = db.prepare("SELECT id, raw_message FROM orders WHERE id = ?").get(orderId);
                    if (orderRow) {
                        const newRaw = (orderRow.raw_message ? orderRow.raw_message + "\n" : "") + text;
                        db.prepare("UPDATE orders SET raw_message = ?, updated_at = datetime('now') WHERE id = ?").run(newRaw, orderId);
                    }
                    const parsed = (0, parse_order_message_js_1.parseOrderMessage)(text);
                    console.log("[LINE] 解析結果 筆數:", parsed.length, parsed.length ? "品項:" + parsed.map((p) => p.rawName + " " + p.quantity).join(", ") : "");
                    const custRow = db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(cid);
                    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                    const needReview = [];
                    for (const item of parsed) {
                        const resolved = (0, resolve_product_js_1.resolveProductName)(db, item.rawName, cid);
                        const itemId = (0, id_js_1.newId)("item");
                        const productId = resolved?.productId ?? null;
                        const needReviewFlag = resolved ? 0 : 1;
                        if (!resolved)
                            needReview.push(item.rawName);
                        const unit = item.unit && item.unit.trim() ? item.unit.trim() : fallbackUnit;
                        db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review)
             VALUES (?, ?, ?, ?, ?, ?, ?)`).run(itemId, orderId, productId, item.rawName, item.quantity, unit, needReviewFlag);
                    }
                    let replyText = parsed.length > 0
                        ? `已記入（本則 ${parsed.length} 項）${needReview.length > 0 ? "。以下尚未對應：" + needReview.join("、") : ""}`
                        : "本則沒有辨識到品名與數量，請用「品名 數量 單位」格式。傳完由我方輸入「以上X收單」結束。";
                    console.log("[LINE] 準備回覆:", replyText);
                    await reply(lineClient, event.replyToken, replyText);
                    console.log("[LINE] 訂單已寫入", orderId);
                }
                catch (err) {
                    console.error("[LINE] 處理訊息時錯誤:", err);
                    await reply(lineClient, event.replyToken, "抱歉，處理時發生錯誤，請稍後再試。");
                }
            }
        })().catch((e) => console.error("[LINE] 背景處理失敗", e));
    });
    return router;
}
async function reply(client, token, text) {
    if (!client) {
        console.warn("[LINE] 未設定 LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET，無法發送回覆。本應回覆:", text.slice(0, 80));
        return;
    }
    try {
        await client.replyMessage(token, { type: "text", text });
    }
    catch (e) {
        console.error("[LINE] 回覆失敗（可能 replyToken 逾時或網路問題）:", e);
    }
}
