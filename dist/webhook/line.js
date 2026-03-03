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
const vision_ocr_js_1 = require("../lib/vision-ocr.js");
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
const lineConfig = { channelAccessToken, channelSecret };
const hasLineConfig = Boolean(channelAccessToken && channelSecret);
/** 收單模式：群組 ID -> { orderId, customerId, lastActivity }；逾時 1 分鐘自動結單 */
const COLLECT_TIMEOUT_MS = 1 * 60 * 1000;
const collectingByGroup = new Map();
async function getNextOrderNo(db, orderDate) {
    const nextKey = "order_seq_next_" + orderDate;
    const startKey = "order_seq_start_" + orderDate;
    let row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(nextKey);
    if (!row || !row.value) {
        row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(startKey);
    }
    const seq = row && row.value ? parseInt(row.value, 10) : 1;
    const nextSeq = Number.isNaN(seq) ? 1 : Math.max(1, seq);
    const orderNo = orderDate.replace(/-/g, "") + String(nextSeq).padStart(3, "0");
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(nextKey, String(nextSeq + 1));
    return orderNo;
}
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
                    // 照片：收單中儲存附件；可選 OCR 辨識文字並寫入品項；未收單則傳圖即開始收單
                    if (msgType === "image") {
                        if (groupId && !customer) {
                            await reply(lineClient, event.replyToken, "此群組尚未綁定客戶，無法收單。若需取得本群組 ID 請傳：取得群組ID", db);
                            continue;
                        }
                        if (!customer) {
                            await reply(lineClient, event.replyToken, "請在已綁定客戶的群組內叫貨。", db);
                            continue;
                        }
                        const inCollecting = groupId ? collectingByGroup.has(groupId) : false;
                        const messageId = event.message.id;
                        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                        let ocrText = null;
                        if (process.env.GOOGLE_CLOUD_VISION_API_KEY && channelAccessToken) {
                            try {
                                const imgResp = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
                                    headers: { Authorization: `Bearer ${channelAccessToken}` },
                                });
                                if (imgResp.ok) {
                                    const buf = Buffer.from(await imgResp.arrayBuffer());
                                    ocrText = await (0, vision_ocr_js_1.getTextFromImageBuffer)(buf);
                                }
                            }
                            catch (e) {
                                console.warn("[LINE] 取得圖片或 OCR 失敗:", e?.message || e);
                            }
                        }
                        if (inCollecting) {
                            const session = collectingByGroup.get(groupId);
                            const attId = (0, id_js_1.newId)("att");
                            await db.prepare("INSERT INTO order_attachments (id, order_id, line_message_id, created_at) VALUES (?, ?, ?, " + nowSql + ")").run(attId, session.orderId, messageId);
                            let orderRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(session.orderId);
                            let newRaw = (orderRow?.raw_message ? orderRow.raw_message + "\n" : "") + (ocrText || "[圖片]");
                            let parsedCount = 0;
                            if (ocrText) {
                                const parsed = (0, parse_order_message_js_1.parseOrderMessage)(ocrText);
                                if (parsed.length > 0) {
                                    const custRow = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(session.customerId);
                                    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                                    for (const item of parsed) {
                                        const resolved = await (0, resolve_product_js_1.resolveProductName)(db, item.rawName, session.customerId);
                                        const itemId = (0, id_js_1.newId)("item");
                                        const productId = resolved?.productId ?? null;
                                        const unit = item.unit && item.unit.trim() ? item.unit.trim() : fallbackUnit;
                                        await db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review)
             VALUES (?, ?, ?, ?, ?, ?, ?)`).run(itemId, session.orderId, productId, item.rawName, item.quantity, unit, resolved ? 0 : 1);
                                    }
                                    parsedCount = parsed.length;
                                }
                            }
                            await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRaw, session.orderId);
                            const replyMsg = parsedCount > 0
                                ? `已收到圖片並辨識出 ${parsedCount} 項。可繼續傳品項或說「以上X收單」結束。`
                                : "已收到圖片，會一併處理。請繼續傳品項或說「以上X收單」結束。";
                            await reply(lineClient, event.replyToken, replyMsg, db);
                        }
                        else {
                            const orderDate = new Date().toISOString().slice(0, 10);
                            let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ?").get(customer.id, orderDate);
                            let orderId;
                            if (orderRow) {
                                orderId = orderRow.id;
                            }
                            else {
                                orderId = (0, id_js_1.newId)("ord");
                                const orderNo = await getNextOrderNo(db, orderDate);
                                await db.prepare(`INSERT INTO orders (id, order_no, customer_id, order_date, line_group_id, raw_message, status)
               VALUES (?, ?, ?, ?, ?, ?, 'pending')`).run(orderId, orderNo, customer.id, orderDate, groupId, "");
                            }
                            if (groupId)
                                collectingByGroup.set(groupId, { orderId, customerId: customer.id, lastActivity: Date.now() });
                            const attId = (0, id_js_1.newId)("att");
                            await db.prepare("INSERT INTO order_attachments (id, order_id, line_message_id, created_at) VALUES (?, ?, ?, " + nowSql + ")").run(attId, orderId, messageId);
                            let replyMsg = "已開始收單並收到您傳的圖片，可繼續傳品項或再傳圖。傳完說「以上X收單」結束。";
                            if (ocrText) {
                                const parsed = (0, parse_order_message_js_1.parseOrderMessage)(ocrText);
                                if (parsed.length > 0) {
                                    const custRow = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(customer.id);
                                    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                                    for (const item of parsed) {
                                        const resolved = await (0, resolve_product_js_1.resolveProductName)(db, item.rawName, customer.id);
                                        const itemId = (0, id_js_1.newId)("item");
                                        const productId = resolved?.productId ?? null;
                                        const unit = item.unit && item.unit.trim() ? item.unit.trim() : fallbackUnit;
                                        await db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review)
             VALUES (?, ?, ?, ?, ?, ?, ?)`).run(itemId, orderId, productId, item.rawName, item.quantity, unit, resolved ? 0 : 1);
                                    }
                                    const newRaw = (orderRow?.raw_message ? orderRow.raw_message + "\n" : "") + ocrText;
                                    await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRaw, orderId);
                                    replyMsg = `已開始收單並辨識出 ${parsed.length} 項。可繼續傳品項或再傳圖，傳完說「以上X收單」結束。`;
                                }
                            }
                            await reply(lineClient, event.replyToken, replyMsg, db);
                        }
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
                        await reply(lineClient, event.replyToken, `此群組/聊天室 ID：\n${groupId}\n請將此 ID 提供給管理員，在後台「客戶管理」編輯該客戶的「LINE 群組 ID」並儲存。`, db);
                        continue;
                    }
                    if (groupId && !customer) {
                        console.log("[LINE] 未綁定群組，群組 ID:", groupId);
                        await reply(lineClient, event.replyToken, "此群組尚未綁定客戶，無法收單。請確認：① 機器人已加入此群組 ② 在後台「客戶管理」編輯該客戶，將「LINE 群組 ID」設為與本群組一致（在群組傳「取得群組ID」可取得，請複製貼上）。", db);
                        continue;
                    }
                    if (!customer) {
                        await reply(lineClient, event.replyToken, "請在已綁定客戶的群組內叫貨。", db);
                        continue;
                    }
                    const customerId = customer.id;
                    const orderDate = new Date().toISOString().slice(0, 10);
                    const startRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_trigger_start");
                    const startTriggers = (startRow?.value ?? "收單\n開始收單\n訂單\n我要下訂\n明日訂單").split(/\n/).map((s) => s.trim()).filter(Boolean);
                    const intentRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_trigger_intent");
                    const intentKeywords = (intentRow?.value ?? "幫我送\n明天\n今天早上要\n要送\n訂\n叫貨\n送過來\n請送").split(/\n/).map((s) => s.trim()).filter(Boolean);
                    const triggerMatch = startTriggers.find((t) => text === t || text.startsWith(t + " ") || text.startsWith(t + "\n"));
                    const intentMatch = !triggerMatch && text.length >= 2 && intentKeywords.some((k) => text.includes(k));
                    const effectiveRest = triggerMatch ? (text.slice(triggerMatch.length).trim() || "") : (intentMatch ? text : "");
                    const isStartOrder = triggerMatch || intentMatch;
                    if (isStartOrder) {
                        const rest = effectiveRest;
                        if (intentMatch)
                            console.log("[LINE] 意圖關鍵字進入收單 customerId=%s orderDate=%s text=%s", customerId, orderDate, rest.slice(0, 80));
                        else
                            console.log("[LINE] 進入收單流程 customerId=%s orderDate=%s rest=%s", customerId, orderDate, rest.slice(0, 50));
                        let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ?").get(customerId, orderDate);
                        let orderId;
                        if (orderRow) {
                            orderId = orderRow.id;
                        }
                        else {
                            orderId = (0, id_js_1.newId)("ord");
                            const orderNo = await getNextOrderNo(db, orderDate);
                            await db.prepare(`INSERT INTO orders (id, order_no, customer_id, order_date, line_group_id, raw_message, status)
               VALUES (?, ?, ?, ?, ?, ?, 'pending')`).run(orderId, orderNo, customerId, orderDate, groupId, "");
                        }
                        if (groupId)
                            collectingByGroup.set(groupId, { orderId, customerId, lastActivity: Date.now() });
                        let replyDone = "開始收單。請傳品項，傳完說「以上X收單」結束；一分鐘內無訊息將自動結單。";
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
                                ? `已記入本則 ${parsed.length} 項。可繼續傳品項，傳完說「以上X收單」結束。`
                                : "已開始收單。本則未辨識到品名與數量，請另傳「品名 數量 單位」。傳完說「以上X收單」結束。";
                        }
                        await reply(lineClient, event.replyToken, replyDone, db);
                        continue;
                    }
                    if (text === "今天叫了什麼" || text === "今日訂單" || text === "今日叫貨") {
                        const orderRow = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ?").get(customerId, orderDate);
                        if (!orderRow) {
                            await reply(lineClient, event.replyToken, "今日尚無訂單。", db);
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
                        await reply(lineClient, event.replyToken, "今日叫貨：\n" + (lines.length ? lines.join("\n") : "（尚無品項）"), db);
                        continue;
                    }
                    const endRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_trigger_end");
                    const endTriggers = (endRow?.value ?? "完成\n結束收單").split(/\n/).map((s) => s.trim()).filter(Boolean);
                    const aboveMatch = text.match(/^以上\s*([\d\uFF10-\uFF19]+)\s*收單$/);
                    const isDone = aboveMatch || endTriggers.some((t) => text === t);
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
                            const orderInfo = await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(session.orderId);
                            const count = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ?").get(session.orderId);
                            const n = count?.c ?? 0;
                            const dateStr = orderInfo?.order_date || new Date().toISOString().slice(0, 10);
                            const weekdays = "日一二三四五六";
                            const dayIdx = new Date(dateStr + "T12:00:00").getDay();
                            const weekday = "星期" + weekdays[dayIdx];
                            await reply(lineClient, event.replyToken, `收單結束。訂單日期：${dateStr} ${weekday}，共收 ${n} 項。`, db);
                        }
                        else {
                            await reply(lineClient, event.replyToken, "目前沒有在收單。請先傳「收單」或「訂單」開始，傳完說「以上X收單」結束。", db);
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
                            const orderInfo = await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(session.orderId);
                            const count = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ?").get(session.orderId);
                            const n = count?.c ?? 0;
                            const dateStr = orderInfo?.order_date || new Date().toISOString().slice(0, 10);
                            const weekdays = "日一二三四五六";
                            const dayIdx = new Date(dateStr + "T12:00:00").getDay();
                            const weekday = "星期" + weekdays[dayIdx];
                            await reply(lineClient, event.replyToken, `已自動結單（1 分鐘內無新訊息）。訂單日期：${dateStr} ${weekday}，共收 ${n} 項。`, db);
                            continue;
                        }
                        session.lastActivity = Date.now();
                    }
                    // 未在收單模式：若內容像叫貨（含數字），回覆一句提示，否則不回覆
                    if (!groupId || !collectingByGroup.has(groupId)) {
                        const looksLikeOrder = /[\d\uFF10-\uFF19]/.test(text) && text.length >= 2;
                        if (looksLikeOrder) {
                            await reply(lineClient, event.replyToken, "請先傳「收單」或「訂單」開始收單，再傳品項。", db);
                        }
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
                        ? `已記入本則 ${parsed.length} 項。傳完說「以上X收單」結束。`
                        : "本則沒有辨識到品名與數量，請用「品名 數量 單位」格式。傳完由我方輸入「以上X收單」結束。";
                    console.log("[LINE] 準備回覆:", replyText);
                    await reply(lineClient, event.replyToken, replyText, db);
                    console.log("[LINE] 訂單已寫入", orderId);
                }
                catch (err) {
                    console.error("[LINE] 處理訊息時錯誤:", err);
                    try {
                        await reply(lineClient, event.replyToken, "抱歉，處理時發生錯誤，請稍後再試。", db);
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
async function recordLineReply(db) {
    try {
        const key = "line_replies_" + new Date().toISOString().slice(0, 7);
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
        const next = ((row && parseInt(row.value, 10)) || 0) + 1;
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(key, String(next));
    }
    catch (e) {
        console.error("[LINE] 紀錄回覆則數失敗:", e?.message || e);
    }
}
async function reply(client, token, text, dbOptional) {
    if (!client) {
        console.warn("[LINE] 未設定 LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET，無法發送回覆。本應回覆:", text.slice(0, 80));
        return;
    }
    try {
        await client.replyMessage(token, { type: "text", text });
        if (dbOptional)
            recordLineReply(dbOptional).catch((e) => console.error("[LINE] record reply count", e?.message || e));
    }
    catch (e) {
        console.error("[LINE] 回覆失敗（可能 replyToken 逾時或網路問題）:", e);
    }
}
