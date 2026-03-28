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
const line_bot_control_js_1 = require("../lib/line-bot-control.js");
const unit_conversion_js_1 = require("../lib/unit-conversion.js");
const parse_order_from_image_js_1 = require("../lib/parse-order-from-image.js");
const line_image_compress_js_1 = require("../lib/line-image-compress.js");
const customer_handwriting_hints_js_1 = require("../lib/customer-handwriting-hints.js");
const rebuild_order_from_sources_js_1 = require("../lib/rebuild-order-from-sources.js");
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
const lineConfig = { channelAccessToken, channelSecret };
const hasLineConfig = Boolean(channelAccessToken && channelSecret);
/** 收單模式：群組 ID -> { orderId, customerId, lastActivity }；逾時 30 秒自動結單 */
const COLLECT_TIMEOUT_MS = 30 * 1000;
const collectingByGroup = new Map();
const autoFinalizeTimers = new Map();
/** LINE webhook 偶發重送同一 message.id，避免重複寫入品項／raw_message */
const recentLineMessageIdQueue = [];
const recentLineMessageIdSet = new Set();
const LINE_MSG_ID_CAP = 8000;
function consumeLineWebhookMessageOnce(messageId) {
    const id = messageId != null ? String(messageId).trim() : "";
    if (!id)
        return true;
    if (recentLineMessageIdSet.has(id))
        return false;
    recentLineMessageIdSet.add(id);
    recentLineMessageIdQueue.push(id);
    if (recentLineMessageIdQueue.length > LINE_MSG_ID_CAP) {
        const old = recentLineMessageIdQueue.shift();
        if (old)
            recentLineMessageIdSet.delete(old);
    }
    return true;
}
function getTaipeiOrderDate() {
    // 00:00~05:59 算當天；06:00 之後算隔天
    const now = new Date();
    const tw = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    if (tw.getHours() >= 6) {
        tw.setDate(tw.getDate() + 1);
    }
    return tw.toISOString().slice(0, 10);
}
function normalizeOrderUnit(raw, fallbackUnit) {
    return (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(raw, fallbackUnit);
}
function formatOrderQty(q) {
    const n = Number(q);
    if (!Number.isFinite(n))
        return String(q ?? "");
    return String(parseFloat(n.toFixed(4)));
}
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
    const scheduleAutoFinalize = (groupId, session) => {
        if (!groupId)
            return;
        const old = autoFinalizeTimers.get(groupId);
        if (old)
            clearTimeout(old);
        const t = setTimeout(async () => {
            try {
                const active = collectingByGroup.get(groupId);
                if (!active || active.orderId !== session.orderId)
                    return;
                collectingByGroup.delete(groupId);
                autoFinalizeTimers.delete(groupId);
                if (process.env.LINE_SKIP_FINALIZE_FULL_REBUILD !== "1") {
                    try {
                        const rawRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(session.orderId);
                        const atts = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(session.orderId);
                        const fr = await (0, rebuild_order_from_sources_js_1.rebuildOrderItemsFromOrderSources)(db, session.orderId, session.customerId, rawRow?.raw_message, atts);
                        if (fr.ok)
                            console.log("[LINE] 結單整單重辨識完成 orderId=%s", session.orderId);
                        else
                            console.warn("[LINE] 結單整單重辨識未覆寫（沿用逐則明細）orderId=%s err=%s", session.orderId, fr.error);
                    }
                    catch (e) {
                        console.error("[LINE] 結單整單重辨識例外:", e?.message || e);
                    }
                }
                const order = await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(session.orderId);
                const items = await db.prepare(`
          SELECT oi.raw_name, oi.quantity, oi.unit, p.name AS product_name, p.erp_code
          FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ? ORDER BY oi.id
        `).all(session.orderId);
                const dateStr = order?.order_date || getTaipeiOrderDate();
                const lines = [];
                let idx = 1;
                for (const it of items) {
                    const qty = Number(it.quantity || 0);
                    const unit = normalizeOrderUnit(it.unit, "公斤");
                    const name = it.product_name || it.raw_name || "待確認";
                    lines.push(`${idx}. ${name} ${formatOrderQty(it.quantity)}${unit || ""}`);
                    idx += 1;
                }
                const summary = [
                    "收到，已收單喔。",
                    `送貨日期為：${dateStr}`,
                    "訂購項目如下：",
                    ...(lines.length ? lines : ["（目前尚無可辨識品項）"]),
                    "",
                    "※ 若內容有誤：可傳「線上改單」查看項次，並傳「改第1項 3 公斤」或「刪第1項」修改（數字請自換）；品名錯誤請洽業務或後台改品項。",
                    "（目前未連動批發行情，僅顯示叫貨數量與單位。）",
                ].join("\n");
                if (lineClient) {
                    if (!(await (0, line_bot_control_js_1.isLineSuppressCustomerReply)(db))) {
                        await lineClient.pushMessage(groupId, { type: "text", text: summary });
                    }
                    else {
                        console.log("[LINE] 已略過 30 秒結單推播（對客戶靜音） orderId=%s", session.orderId);
                    }
                }
            }
            catch (e) {
                console.error("[LINE] 30 秒自動結單失敗:", e?.message || e);
            }
        }, COLLECT_TIMEOUT_MS);
        autoFinalizeTimers.set(groupId, t);
    };
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
      <p><a href="/admin">← 回後台</a></p>
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
                    if (!consumeLineWebhookMessageOnce(event.message?.id)) {
                        console.log("[LINE] 略過重複訊息（同 message.id），避免重複建品項");
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
                    /** 休眠：非收單時段不跑 OCR／Gemini／訂單；僅允許「取得群組ID」（無 AI） */
                    let textEarly = null;
                    if (msgType === "text" && event.message.text) {
                        textEarly = String(event.message.text).trim();
                    }
                    if (groupId && textEarly && (textEarly === "取得群組ID" || textEarly === "群組ID")) {
                        await reply(lineClient, event.replyToken, `此群組/聊天室 ID：\n${groupId}\n請將此 ID 提供給管理員，在後台「客戶管理」編輯該客戶的「LINE 群組 ID」並儲存。`, db, { force: true });
                        continue;
                    }
                    const accepting = await (0, line_bot_control_js_1.isBotAcceptingOrders)(db);
                    if (!accepting) {
                        console.log("[LINE] 非收單時段（休眠），略過（不呼叫 Gemini／OCR／訂單）");
                        continue;
                    }
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
                        let imageBuf = null;
                        if (channelAccessToken) {
                            try {
                                const imgResp = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
                                    headers: { Authorization: `Bearer ${channelAccessToken}` },
                                });
                                if (imgResp.ok) {
                                    const rawBuf = Buffer.from(await imgResp.arrayBuffer());
                                    imageBuf = await (0, line_image_compress_js_1.compressLineImageBuffer)(rawBuf);
                                }
                            }
                            catch (e) {
                                console.warn("[LINE] 取得圖片失敗:", e?.message || e);
                            }
                        }
                        const custRowImg = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(customer.id);
                        const fallbackUnitImg = custRowImg?.default_unit?.trim() || "公斤";
                        let handwritingSuffix = "";
                        try {
                            handwritingSuffix = await customer_handwriting_hints_js_1.buildPromptSuffixForCustomerHandwritingHints(db, customer.id);
                        }
                        catch (_) { /* ignore */ }
                        const imgParseOpts = {
                            ...(handwritingSuffix ? { geminiExtraSuffix: handwritingSuffix } : {}),
                            db,
                            customerId: customer.id,
                        };
                        const { parsed: parsedFromImg, ocrText } = await (0, parse_order_from_image_js_1.parseOrderItemsFromImageBuffer)(imageBuf, fallbackUnitImg, imgParseOpts);
                        if (inCollecting) {
                            const session = collectingByGroup.get(groupId);
                            const attId = (0, id_js_1.newId)("att");
                            await db.prepare("INSERT INTO order_attachments (id, order_id, line_message_id, created_at) VALUES (?, ?, ?, " + nowSql + ")").run(attId, session.orderId, messageId);
                            let orderRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(session.orderId);
                            let newRaw = (orderRow?.raw_message ? orderRow.raw_message + "\n" : "") + (ocrText || "[圖片]");
                            let parsedCount = 0;
                            if (parsedFromImg.length > 0) {
                                const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
                                for (const item of parsedFromImg) {
                                    const resolved = await (0, resolve_product_js_1.resolveProductName)(db, item.rawName, session.customerId);
                                    const itemId = (0, id_js_1.newId)("item");
                                    const productId = resolved?.productId ?? null;
                                    const inputUnit = normalizeOrderUnit(item.unit, fallbackUnitImg);
                                    let unit = inputUnit;
                                    let qty = item.quantity;
                                    let itemRemark = null;
                                    if (resolved) {
                                        const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
                                        qty = c.quantity;
                                        unit = normalizeOrderUnit(c.unit, fallbackUnitImg);
                                        itemRemark = c.remark ?? null;
                                    }
                                    itemRemark = (0, unit_conversion_js_1.withOriginCallRemark)(itemRemark, item.quantity, inputUnit, unit);
                                    await db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(itemId, session.orderId, productId, item.rawName, qty, unit, resolved ? 0 : 1, itemRemark);
                                }
                                parsedCount = parsedFromImg.length;
                            }
                            await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRaw, session.orderId);
                            // 不回中途提示，僅在 30 秒自動結單時推送摘要
                        }
                        else {
                            const orderDate = getTaipeiOrderDate();
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
                            if (groupId) {
                                const session = { orderId, customerId: customer.id, lastActivity: Date.now() };
                                collectingByGroup.set(groupId, session);
                                scheduleAutoFinalize(groupId, session);
                            }
                            const attId = (0, id_js_1.newId)("att");
                            await db.prepare("INSERT INTO order_attachments (id, order_id, line_message_id, created_at) VALUES (?, ?, ?, " + nowSql + ")").run(attId, orderId, messageId);
                            const newRawImg = (orderRow?.raw_message ? orderRow.raw_message + "\n" : "") + (ocrText || "[圖片]");
                            if (parsedFromImg.length > 0) {
                                const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
                                for (const item of parsedFromImg) {
                                    const resolved = await (0, resolve_product_js_1.resolveProductName)(db, item.rawName, customer.id);
                                    const itemId = (0, id_js_1.newId)("item");
                                    const productId = resolved?.productId ?? null;
                                    const inputUnit = normalizeOrderUnit(item.unit, fallbackUnitImg);
                                    let unit = inputUnit;
                                    let qty = item.quantity;
                                    let itemRemark = null;
                                    if (resolved) {
                                        const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
                                        qty = c.quantity;
                                        unit = normalizeOrderUnit(c.unit, fallbackUnitImg);
                                        itemRemark = c.remark ?? null;
                                    }
                                    itemRemark = (0, unit_conversion_js_1.withOriginCallRemark)(itemRemark, item.quantity, inputUnit, unit);
                                    await db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(itemId, orderId, productId, item.rawName, qty, unit, resolved ? 0 : 1, itemRemark);
                                }
                            }
                            await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRawImg, orderId);
                            // 不回中途提示，僅在 30 秒自動結單時推送摘要
                        }
                        continue;
                    }
                    if (msgType !== "text") {
                        console.log("[LINE] 略過非文字訊息, type:", msgType);
                        continue;
                    }
                    const text = textEarly !== null && textEarly !== undefined ? textEarly : String(event.message.text || "").trim();
                    console.log("[LINE] 收到文字:", JSON.stringify(text));
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
                    const orderDate = getTaipeiOrderDate();
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
                        if (groupId) {
                            const session = { orderId, customerId, lastActivity: Date.now() };
                            collectingByGroup.set(groupId, session);
                            scheduleAutoFinalize(groupId, session);
                        }
                        if (rest) {
                            const custRow = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(customerId);
                            const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                            const parsed = (0, parse_order_message_js_1.parseOrderMessage)(rest, fallbackUnit);
                            const needReview = [];
                            const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
                            for (const item of parsed) {
                                const resolved = await (0, resolve_product_js_1.resolveProductName)(db, item.rawName, customerId);
                                const itemId = (0, id_js_1.newId)("item");
                                const productId = resolved?.productId ?? null;
                                if (!resolved)
                                    needReview.push(item.rawName);
                                const inputUnit = normalizeOrderUnit(item.unit, fallbackUnit);
                                let unit = inputUnit;
                                let qty = item.quantity;
                                let itemRemark = null;
                                if (resolved) {
                                    const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
                                    qty = c.quantity;
                                    unit = normalizeOrderUnit(c.unit, fallbackUnit);
                                    itemRemark = c.remark ?? null;
                                }
                                itemRemark = (0, unit_conversion_js_1.withOriginCallRemark)(itemRemark, item.quantity, inputUnit, unit);
                                await db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(itemId, orderId, productId, item.rawName, qty, unit, resolved ? 0 : 1, itemRemark);
                            }
                        }
                        // 原始訂單：一律存客戶傳來的**整句**（含「收單／叫貨」等觸發詞）；舊版只存 rest 會漏字
                        const orderRowRaw = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(orderId);
                        const lineForRaw = String(text || "").trim();
                        if (lineForRaw) {
                            const newRaw = (orderRowRaw?.raw_message ? orderRowRaw.raw_message + "\n" : "") + lineForRaw;
                            await db.prepare("UPDATE orders SET raw_message = ?, updated_at = datetime('now') WHERE id = ?").run(newRaw, orderId);
                        }
                        // 不回中途提示，僅在 30 秒自動結單時推送摘要
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
                    const normLineText = text.replace(/[\uFF10-\uFF19]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));
                    const orderRowForEdit = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ?").get(customerId, orderDate);
                    if (orderRowForEdit) {
                        const custRowEdit = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(customerId);
                        const fallbackUnitEdit = custRowEdit?.default_unit?.trim() || "公斤";
                        const itemsOrdered = await db.prepare(`
          SELECT oi.id, oi.raw_name, oi.quantity, oi.unit, p.name AS product_name
          FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
          ORDER BY oi.id`).all(orderRowForEdit.id);
                        const delMatch = normLineText.match(/^刪第?(\d+)項?$/) || normLineText.match(/^刪除\s*(\d+)\s*$/);
                        if (delMatch) {
                            const num = parseInt(delMatch[1], 10);
                            if (num >= 1 && num <= itemsOrdered.length) {
                                const t = itemsOrdered[num - 1];
                                await db.prepare("DELETE FROM order_items WHERE id = ? AND order_id = ?").run(t.id, orderRowForEdit.id);
                                const nm = t.product_name || t.raw_name || "品項";
                                await reply(lineClient, event.replyToken, `已刪除第${num}項：${nm}`, db);
                            }
                            else {
                                await reply(lineClient, event.replyToken, `找不到第${num}項。今日共 ${itemsOrdered.length} 項，請先傳「今天叫了什麼」或「線上改單」確認編號。`, db);
                            }
                            continue;
                        }
                        const editMatch = normLineText.match(/^改第?(\d+)項?\s*([\d.]+)\s*(.*?)\s*$/) || normLineText.match(/^更正\s*(\d+)\s+([\d.]+)\s*(.*?)\s*$/);
                        if (editMatch) {
                            const num = parseInt(editMatch[1], 10);
                            const qtyNew = parseFloat(editMatch[2]);
                            const unitTail = (editMatch[3] || "").trim();
                            if (num >= 1 && num <= itemsOrdered.length && Number.isFinite(qtyNew) && qtyNew >= 0) {
                                const t = itemsOrdered[num - 1];
                                const unitNew = normalizeOrderUnit(unitTail || null, fallbackUnitEdit);
                                await db.prepare("UPDATE order_items SET quantity = ?, unit = ? WHERE id = ? AND order_id = ?").run(qtyNew, unitNew, t.id, orderRowForEdit.id);
                                const nm = t.product_name || t.raw_name || "品項";
                                await reply(lineClient, event.replyToken, `已更新第${num}項 ${nm}：${formatOrderQty(qtyNew)}${unitNew}`, db);
                            }
                            else {
                                await reply(lineClient, event.replyToken, `無法更新（項次或數量有誤）。今日共 ${itemsOrdered.length} 項。\n格式：改第1項 3 公斤`, db);
                            }
                            continue;
                        }
                        if (normLineText === "線上改單" || normLineText === "訂單更正說明") {
                            const numbered = itemsOrdered.map((it, i) => {
                                const nm = it.product_name || it.raw_name || "待確認";
                                return `${i + 1}. ${nm} ${formatOrderQty(it.quantity)}${it.unit || ""}`;
                            }).join("\n");
                            const hint = `【線上改今日叫貨】\n${numbered || "（尚無品項）"}\n\n改數量：改第1項 3 公斤\n刪除：刪第1項\n（請把 1 改成您的項次；品名辨識錯誤請洽業務或由後台改品項）`;
                            await reply(lineClient, event.replyToken, hint, db);
                            continue;
                        }
                        if (/^改第?\d+項?$/.test(normLineText) || /^更正\s*\d+\s*$/.test(normLineText)) {
                            await reply(lineClient, event.replyToken, "請寫完整，例如：改第1項 3 公斤", db);
                            continue;
                        }
                    }
                    else {
                        const looksLikeLineEdit = /^改第?\d+項?/.test(normLineText) || /^刪第?\d+項?$/.test(normLineText) || /^刪除\s*\d+\s*$/.test(normLineText) || normLineText === "線上改單" || normLineText === "訂單更正說明";
                        if (looksLikeLineEdit) {
                            await reply(lineClient, event.replyToken, "今日尚無訂單，無法使用線上修改。", db);
                            continue;
                        }
                    }
                    if (text === "改單" || text === "如何改單" || text === "改單說明" || text === "訂單錯誤" || text === "叫貨錯誤") {
                        await reply(lineClient, event.replyToken, "【訂單有誤時】\n1. 傳「今天叫了什麼」或「線上改單」查看項次編號。\n2. 在 LINE 可直接修改數量：\n　改第1項 3 公斤\n　刪第1項\n（數字請改成實際項次）\n3. 若品名整筆辨識錯誤，請聯絡業務，或由管理員至後台「訂單明細」改品項／刪除重下。", db);
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
                            const oldTimer = autoFinalizeTimers.get(groupId);
                            if (oldTimer)
                                clearTimeout(oldTimer);
                            autoFinalizeTimers.delete(groupId);
                            if (process.env.LINE_SKIP_FINALIZE_FULL_REBUILD !== "1") {
                                try {
                                    const rawRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(session.orderId);
                                    const atts = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(session.orderId);
                                    const fr = await (0, rebuild_order_from_sources_js_1.rebuildOrderItemsFromOrderSources)(db, session.orderId, session.customerId, rawRow?.raw_message, atts);
                                    if (fr.ok)
                                        console.log("[LINE] 手動完成：整單重辨識完成 orderId=%s", session.orderId);
                                    else
                                        console.warn("[LINE] 手動完成：整單重辨識未覆寫 orderId=%s err=%s", session.orderId, fr.error);
                                }
                                catch (e) {
                                    console.error("[LINE] 手動完成：整單重辨識例外:", e?.message || e);
                                }
                            }
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
                            const dateStr = orderInfo?.order_date || getTaipeiOrderDate();
                            const weekdays = "日一二三四五六";
                            const dayIdx = new Date(dateStr + "T12:00:00").getDay();
                            const weekday = "星期" + weekdays[dayIdx];
                            console.log("[LINE] 手動關單完成 date=%s count=%s %s", dateStr, n, weekday);
                        }
                        else {
                            console.log("[LINE] 手動關單但目前無 session");
                        }
                        continue;
                    }
                    // 每則文字都跑 AI 判斷（僅作記錄，不再阻擋收單流程）
                    try {
                        const cls = await (0, line_bot_control_js_1.classifyTextAsOrderIntent)(text);
                        console.log("[LINE] AI 判斷 is_order_related =", cls);
                    }
                    catch (e) {
                        console.log("[LINE] AI 判斷失敗，改走規則流程");
                    }
                    if (groupId && collectingByGroup.has(groupId)) {
                        const session = collectingByGroup.get(groupId);
                        session.lastActivity = Date.now();
                        scheduleAutoFinalize(groupId, session);
                    }
                    // 不再要求先輸入「收單」；若尚未有 session，收到文字即自動開單
                    if (groupId && !collectingByGroup.has(groupId)) {
                        const autoOrderDate = getTaipeiOrderDate();
                        let autoOrder = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ?").get(customerId, autoOrderDate);
                        let autoOrderId;
                        if (autoOrder) {
                            autoOrderId = autoOrder.id;
                        }
                        else {
                            autoOrderId = (0, id_js_1.newId)("ord");
                            const autoOrderNo = await getNextOrderNo(db, autoOrderDate);
                            await db.prepare(`INSERT INTO orders (id, order_no, customer_id, order_date, line_group_id, raw_message, status)
               VALUES (?, ?, ?, ?, ?, ?, 'pending')`).run(autoOrderId, autoOrderNo, customerId, autoOrderDate, groupId, "");
                        }
                        const autoSession = { orderId: autoOrderId, customerId, lastActivity: Date.now() };
                        collectingByGroup.set(groupId, autoSession);
                        scheduleAutoFinalize(groupId, autoSession);
                    }
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
                    const custRow = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(cid);
                    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                    const parsed = (0, parse_order_message_js_1.parseOrderMessage)(text, fallbackUnit);
                    console.log("[LINE] 解析結果 筆數:", parsed.length, parsed.length ? "品項:" + parsed.map((p) => p.rawName + " " + p.quantity).join(", ") : "");
                    const needReview = [];
                    const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
                    for (const item of parsed) {
                        const resolved = await (0, resolve_product_js_1.resolveProductName)(db, item.rawName, cid);
                        const itemId = (0, id_js_1.newId)("item");
                        const productId = resolved?.productId ?? null;
                        const needReviewFlag = resolved ? 0 : 1;
                        if (!resolved)
                            needReview.push(item.rawName);
                        const inputUnit = normalizeOrderUnit(item.unit, fallbackUnit);
                        let unit = inputUnit;
                        let qty = item.quantity;
                        let itemRemark = null;
                        if (resolved) {
                            const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
                            qty = c.quantity;
                            unit = normalizeOrderUnit(c.unit, fallbackUnit);
                            itemRemark = c.remark ?? null;
                        }
                        itemRemark = (0, unit_conversion_js_1.withOriginCallRemark)(itemRemark, item.quantity, inputUnit, unit);
                        await db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(itemId, orderId, productId, item.rawName, qty, unit, needReviewFlag, itemRemark);
                    }
                    // 不回中途提示，僅在 30 秒自動結單時推送摘要
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
/** options.force：略過靜音，仍發送（僅用於取得群組 ID 等管理用途）。靜音狀態見後台「LINE 機器人」或環境變數 LINE_SUPPRESS_LINE_REPLIES（未存 DB 時） */
async function reply(client, token, text, dbOptional, options) {
    if (!options?.force && await (0, line_bot_control_js_1.isLineSuppressCustomerReply)(dbOptional)) {
        console.log("[LINE] 已略過回覆（對客戶靜音；收單仍照常寫入）:", String(text).slice(0, 120));
        return;
    }
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
