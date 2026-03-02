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
/** 收單模式：群組 ID -> { orderId, customerId, lastActivity }；逾時 30 分鐘自動結單 */
const COLLECT_TIMEOUT_MS = 30 * 60 * 1000;
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
    router.get("/", (_req, res) => {
        res.type("text/html").send(`
    <!DOCTYPE html>
    <html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LINE Webhook</title></head>
    <body style="font-family:sans-serif;padding:2rem;max-width:560px;margin:0 auto;">
      <h1>LINE Webhook</h1>
      <p>此網址僅接受 <strong>POST</strong> 請求，供 LINE 平台推送訊息使用。</p>
      <p>請勿在瀏覽器直接開啟此頁面來「測試」；請到 <strong>LINE Developers Console</strong> → 您的 Channel → <strong>Messaging API</strong> → 將 <strong>Webhook URL</strong> 設為本頁網址，並將 <strong>Use webhook</strong> 設為 Enabled。</p>
      <p><a href="/">← 回首頁</a>　<a href="/admin">後台</a></p>
    </body></html>`);
    });
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
                    if (event.source)
                        console.log("[LINE] event.source", JSON.stringify(event.source));
                    const sourceType = event.source?.type || "";
                    const rawGroupId = sourceType === "group" ? (event.source.groupId || "") : sourceType === "room" ? (event.source.roomId || "") : "";
                    const groupId = rawGroupId.replace(/\s/g, "").trim() || null;
                    if (sourceType !== "group" && sourceType !== "room")
                        console.log("[LINE] 非群組/聊天室 source.type=", sourceType, "（收單需在群組或多人聊天）");
                    if (groupId)
                        console.log("[LINE] source.type=%s 識別碼長度=%s", sourceType, groupId.length);
                    if (groupId)
                        console.log("[LINE] 群組/聊天室 ID：", groupId, "（長度", groupId.length, "）");
                    let customer = null;
                    if (groupId) {
                        const allActive = await db.prepare("SELECT id, name, line_group_id FROM customers WHERE (active IS NULL OR active = 1)").all();
                        const fullwidthToHalf = (s) => s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
                        const norm = (s) => fullwidthToHalf((s || "").replace(/\s/g, "")).toLowerCase();
                        const needle = norm(groupId);
                        customer = allActive.find((r) => norm(r.line_group_id) === needle) ?? null;
                        if (!customer) {
                            const withGid = allActive.filter((r) => (r.line_group_id || "").trim() !== "");
                            console.log("[LINE] 綁定查詢失敗 收單服務使用資料庫=%s groupId 長度=%s 前6=%s 後6=%s DB內有line_group_id的客戶數=%s", process.env.DATABASE_URL ? "Cloud SQL" : "SQLite", groupId.length, groupId.slice(0, 6), groupId.slice(-6), withGid.length);
                            if (withGid.length > 0) {
                                const dbFirst = (withGid[0].line_group_id || "").trim();
                                const normDb = (s) => (s || "").replace(/\s/g, "").toLowerCase();
                                console.log("[LINE] DB 第一筆 line_group_id 長度=%s 前6=%s 後6=%s 比對needle前8=%s DB前8=%s", dbFirst.length, dbFirst.slice(0, 6), dbFirst.slice(-6), needle.slice(0, 8), normDb(dbFirst).slice(0, 8));
                            }
                        }
                        else
                            console.log("[LINE] 綁定查詢 OK customer=%s", customer.id);
                    }
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
                        await reply(lineClient, event.replyToken, `此群組/聊天室 ID：\n${groupId}\n請將此 ID 提供給管理員，在後台「客戶管理」編輯該客戶的「LINE 群組 ID」並儲存。`);
                        continue;
                    }
                    if (groupId && !customer) {
                        console.log("[LINE] 未綁定群組，群組 ID:", groupId);
                        await reply(lineClient, event.replyToken, "此群組尚未綁定客戶，無法收單。請確認：① 機器人已加入此群組 ② 在後台「客戶管理」編輯該客戶，將「LINE 群組 ID」設為與本群組一致（在群組傳「取得群組ID」可取得，請複製貼上）。");
                        continue;
                    }
                    if (!customer) {
                        await reply(lineClient, event.replyToken, "請在已綁定客戶的群組內叫貨。");
                        continue;
                    }
                    const customerId = customer.id;
                    const orderDate = new Date().toISOString().slice(0, 10);
                    const startTriggers = ["收單", "開始收單", "訂單", "我要下訂", "明日訂單"];
                    const triggerMatch = startTriggers.find((t) => text === t || text.startsWith(t + " ") || text.startsWith(t + "\n"));
                    if (triggerMatch) {
                        const rest = (text.slice(triggerMatch.length).trim() || "");
                        console.log("[LINE] 進入收單流程 customerId=%s orderDate=%s rest=%s", customerId, orderDate, rest.slice(0, 50));
                        let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ?").get(customerId, orderDate);
                        let orderId;
                        if (orderRow) {
                            orderId = orderRow.id;
                        }
                        else {
                            orderId = (0, id_js_1.newId)("ord");
                            await db.prepare(`INSERT INTO orders (id, customer_id, order_date, line_group_id, raw_message, status)
               VALUES (?, ?, ?, ?, ?, 'pending')`).run(orderId, customerId, orderDate, groupId, "");
                        }
                        if (groupId)
                            collectingByGroup.set(groupId, { orderId, customerId, lastActivity: Date.now() });
                        let replyDone = "開始收單。請客戶傳叫貨內容（可多則）；我方傳「以上X收單」即結束並告知已收幾項。";
                        if (rest) {
                            const parsed = (0, parse_order_message_js_1.parseOrderMessage)(rest);
                            const custRow = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(customerId);
                            const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                            const needReview = [];
                            for (const item of parsed) {
                                const resolved = await (0, resolve_product_js_1.resolveProductName)(db, item.rawName, customerId);
                                const itemId = (0, id_js_1.newId)("item");
                                const productId = resolved?.productId ?? null;
                                if (!resolved)
                                    needReview.push(item.rawName);
                                const unit = item.unit && item.unit.trim() ? item.unit.trim() : fallbackUnit;
                                await db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review)
             VALUES (?, ?, ?, ?, ?, ?, ?)`).run(itemId, orderId, productId, item.rawName, item.quantity, unit, resolved ? 0 : 1);
                            }
                            const orderRow2 = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(orderId);
                            const newRaw = (orderRow2?.raw_message ? orderRow2.raw_message + "\n" : "") + rest;
                            await db.prepare("UPDATE orders SET raw_message = ?, updated_at = datetime('now') WHERE id = ?").run(newRaw, orderId);
                            replyDone = parsed.length > 0
                                ? `已收單並記入本則 ${parsed.length} 項${needReview.length > 0 ? "（以下待對照：" + needReview.join("、") + "）" : ""}。可繼續傳品項，傳完說「以上X收單」結束。`
                                : "已開始收單。本則未辨識到品名與數量，請另傳「品名 數量 單位」。傳完說「以上X收單」結束。";
                        }
                        await reply(lineClient, event.replyToken, replyDone);
                        continue;
                    }
                    if (text === "今天叫了什麼" || text === "今日訂單" || text === "今日叫貨") {
                        const orderRow = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ?").get(customerId, orderDate);
                        if (!orderRow) {
                            await reply(lineClient, event.replyToken, "今日尚無訂單。");
                            continue;
                        }
                        const items = await db.prepare(`
          SELECT oi.raw_name, oi.quantity, oi.unit, p.name AS product_name
          FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
        `).all(orderRow.id);
                        const lines = items.map((i) => {
                            const name = i.product_name || i.raw_name || "待確認";
                            return `${name} ${i.quantity} ${i.unit || ""}`.trim();
                        });
                        await reply(lineClient, event.replyToken, "今日叫貨：\n" + (lines.length ? lines.join("\n") : "（尚無品項）"));
                        continue;
                    }
                    // 「完成」「結束收單」或「以上X收單」（由我方觸發結束，X 可半形或全形數字）
                    const aboveMatch = text.match(/^以上\s*([\d\uFF10-\uFF19]+)\s*收單$/);
                    const isDone = text === "完成" || text === "結束收單" || aboveMatch;
                    if (isDone) {
                        if (groupId && collectingByGroup.has(groupId)) {
                            const session = collectingByGroup.get(groupId);
                            collectingByGroup.delete(groupId);
                            const cust = await db.prepare("SELECT route_line FROM customers WHERE id = ?").get(session.customerId);
                            const routeLine = cust?.route_line >= 1 && cust?.route_line <= 9 ? cust.route_line : null;
                            const emptyBasketErp = routeLine != null ? "C01000" + (56 + routeLine) : null;
                            if (emptyBasketErp) {
                                const emptyBasket = await db.prepare("SELECT id, name, unit FROM products WHERE erp_code = ?").get(emptyBasketErp);
                                if (emptyBasket) {
                                    const itemId1 = (0, id_js_1.newId)("item");
                                    await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export) VALUES (?, ?, ?, ?, 0, ?, 0, 1)").run(itemId1, session.orderId, emptyBasket.id, emptyBasket.name, emptyBasket.unit || "個");
                                }
                            }
                            const squareBasket = await db.prepare("SELECT id, name, unit FROM products WHERE erp_code = ?").get("C0100065");
                            if (squareBasket) {
                                const itemId2 = (0, id_js_1.newId)("item");
                                await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export) VALUES (?, ?, ?, ?, 0, ?, 0, 1)").run(itemId2, session.orderId, squareBasket.id, squareBasket.name, squareBasket.unit || "個");
                            }
                            const count = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ?").get(session.orderId);
                            const n = count?.c ?? 0;
                            await reply(lineClient, event.replyToken, `完成，已收 ${n} 項。`);
                        }
                        else {
                            await reply(lineClient, event.replyToken, "目前沒有在收單。請先由我方傳「收單」開始，客戶傳完叫貨後再傳「以上X收單」結束。");
                        }
                        continue;
                    }
                    if (groupId && collectingByGroup.has(groupId)) {
                        const session = collectingByGroup.get(groupId);
                        if (Date.now() - (session.lastActivity || 0) > COLLECT_TIMEOUT_MS) {
                            collectingByGroup.delete(groupId);
                            const cust = await db.prepare("SELECT route_line FROM customers WHERE id = ?").get(session.customerId);
                            const routeLine = cust?.route_line >= 1 && cust?.route_line <= 9 ? cust.route_line : null;
                            const emptyBasketErp = routeLine != null ? "C01000" + (56 + routeLine) : null;
                            if (emptyBasketErp) {
                                const emptyBasket = await db.prepare("SELECT id, name, unit FROM products WHERE erp_code = ?").get(emptyBasketErp);
                                if (emptyBasket) {
                                    const itemId1 = (0, id_js_1.newId)("item");
                                    await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export) VALUES (?, ?, ?, ?, 0, ?, 0, 1)").run(itemId1, session.orderId, emptyBasket.id, emptyBasket.name, emptyBasket.unit || "個");
                                }
                            }
                            const squareBasket = await db.prepare("SELECT id, name, unit FROM products WHERE erp_code = ?").get("C0100065");
                            if (squareBasket) {
                                const itemId2 = (0, id_js_1.newId)("item");
                                await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export) VALUES (?, ?, ?, ?, 0, ?, 0, 1)").run(itemId2, session.orderId, squareBasket.id, squareBasket.name, squareBasket.unit || "個");
                            }
                            const count = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ?").get(session.orderId);
                            await reply(lineClient, event.replyToken, `已自動結單（逾時 ${COLLECT_TIMEOUT_MS / 60000} 分鐘），共收 ${count?.c ?? 0} 項。`);
                            continue;
                        }
                        session.lastActivity = Date.now();
                    }
                    // 未在收單模式：不當成叫貨，也不回覆（省則數）
                    if (!groupId || !collectingByGroup.has(groupId)) {
                        continue;
                    }
                    // 收單模式：將本則當成叫貨累加
                    const session = collectingByGroup.get(groupId);
                    const { orderId, customerId: cid } = session;
                    let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE id = ?").get(orderId);
                    if (orderRow) {
                        const newRaw = (orderRow.raw_message ? orderRow.raw_message + "\n" : "") + text;
                        await db.prepare("UPDATE orders SET raw_message = ?, updated_at = datetime('now') WHERE id = ?").run(newRaw, orderId);
                    }
                    const parsed = (0, parse_order_message_js_1.parseOrderMessage)(text);
                    console.log("[LINE] 解析結果 筆數:", parsed.length, parsed.length ? "品項:" + parsed.map((p) => p.rawName + " " + p.quantity).join(", ") : "");
                    const custRow = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(cid);
                    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                    const needReview = [];
                    for (const item of parsed) {
                        const resolved = await (0, resolve_product_js_1.resolveProductName)(db, item.rawName, cid);
                        const itemId = (0, id_js_1.newId)("item");
                        const productId = resolved?.productId ?? null;
                        const needReviewFlag = resolved ? 0 : 1;
                        if (!resolved)
                            needReview.push(item.rawName);
                        const unit = item.unit && item.unit.trim() ? item.unit.trim() : fallbackUnit;
                        await db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review)
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
                    try {
                        await reply(lineClient, event.replyToken, "抱歉，處理時發生錯誤，請稍後再試。");
                    }
                    catch (replyErr) {
                        console.error("[LINE] 回覆失敗（可能 replyToken 逾時）:", replyErr?.message || replyErr);
                    }
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
