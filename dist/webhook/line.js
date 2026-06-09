"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLineWebhook = createLineWebhook;
exports.processLineWebhookEvents = async (_events) => {
    throw new Error("LINE webhook 尚未初始化：請先呼叫 createLineWebhook()");
};
exports.runFinalizeSweep = async () => ({ due: 0, finalized: 0, error: "LINE webhook 尚未初始化" });
exports.distributeParsedToOrdersAtFinalize = (...a) => distributeParsedToOrdersAtFinalize(...a);
exports.rebuildAndSplitOrderAtFinalize = (...a) => rebuildAndSplitOrderAtFinalize(...a);
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
const order_parsed_heuristics_js_1 = require("../lib/order-parsed-heuristics.js");
const cloud_tasks_line_js_1 = require("../lib/cloud-tasks-line.js");
const order_collecting_session_js_1 = require("../lib/order-collecting-session.js");
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
const lineConfig = { channelAccessToken, channelSecret };
const hasLineConfig = Boolean(channelAccessToken && channelSecret);
/** 收單模式：群組 ID -> { orderId, customerId, lastActivity }；可設 LINE_COLLECT_TIMEOUT_SEC 覆蓋，預設 30 秒 */
const COLLECT_TIMEOUT_MS = (parseInt(process.env.LINE_COLLECT_TIMEOUT_SEC || "30", 10) || 30) * 1000;
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
/** Gemini 品項依 sub_customer 分組；空字串／null／undefined 視為預設主客戶 */
function subCustomerGroupKeyFromParsedItem(item) {
    const sc = item.subCustomer;
    if (sc == null || String(sc).trim() === "")
        return "";
    return String(sc).trim();
}
function mustSplitOrdersBySubCustomer(parsed) {
    if (!parsed?.length)
        return false;
    const keys = new Set(parsed.map(subCustomerGroupKeyFromParsedItem));
    return keys.size > 1;
}
function groupParsedItemsBySubCustomer(parsed) {
    const map = new Map();
    for (const item of parsed) {
        const k = subCustomerGroupKeyFromParsedItem(item);
        if (!map.has(k))
            map.set(k, []);
        map.get(k).push(item);
    }
    return map;
}
function mergeSessionOrderIds(session, newIds) {
    const set = new Set();
    if (Array.isArray(session.allOrderIds))
        for (const x of session.allOrderIds)
            if (x)
                set.add(x);
    if (session.orderId)
        set.add(session.orderId);
    for (const id of newIds || [])
        if (id)
            set.add(id);
    session.allOrderIds = Array.from(set);
    if (session.allOrderIds.length && !session.orderId)
        session.orderId = session.allOrderIds[0];
}
function formatSplitSubNamesForReply(keySet) {
    const arr = [...keySet].sort((a, b) => {
        if (a === "")
            return -1;
        if (b === "")
            return 1;
        return a.localeCompare(b, "zh-Hant");
    });
    return arr.map((k) => (k === "" ? "主客戶" : k)).join("、");
}
async function insertOrderRowWithSplitMeta(db, getNextOrderNo, nowSql, { orderDate, customerId, groupId, rawMessage, remark, orderSubSplitKey, lineMessageId, }) {
    const orderId = (0, id_js_1.newId)("ord");
    const orderNo = await getNextOrderNo(db, orderDate);
    const splitVal = orderSubSplitKey === undefined ? null : orderSubSplitKey;
    const lineMid = lineMessageId != null && String(lineMessageId).trim() !== "" ? String(lineMessageId).trim() : null;
    await db.prepare(`INSERT INTO orders (id, order_no, customer_id, order_date, line_group_id, raw_message, status, remark, order_sub_split_key, line_message_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ` + nowSql + `)`).run(orderId, orderNo, customerId, orderDate, groupId ?? null, rawMessage ?? "", remark ?? null, splitVal, lineMid);
    return orderId;
}
async function insertParsedItemsForOrder(db, orderId, customerId, parsedRows, fallbackUnit) {
    const rows = (0, order_parsed_heuristics_js_1.dedupeParsedOrderRows)(Array.isArray(parsedRows) ? parsedRows : []);
    const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
    for (const item of rows) {
        const resolved = await (0, resolve_product_js_1.resolveProductName)(db, item.rawName, customerId);
        const itemId = (0, id_js_1.newId)("item");
        const productId = resolved?.productId ?? null;
        const inputUnit = normalizeOrderUnit(item.unit, fallbackUnit);
        let unit = inputUnit;
        let qty = Number(item.quantity);
        if (!Number.isFinite(qty))
            qty = 0;
        let itemRemark = item.remark != null && String(item.remark).trim() !== "" ? String(item.remark).trim() : null;
        if (resolved) {
            const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
            qty = Number(c.quantity);
            unit = normalizeOrderUnit(c.unit, fallbackUnit);
            if (c.remark) {
                itemRemark = itemRemark ? (itemRemark + "；" + c.remark) : c.remark;
            }
        }
        itemRemark = (0, unit_conversion_js_1.withOriginCallRemark)(itemRemark, item.quantity, inputUnit, unit);
        const needReviewFlag = resolved ? 0 : 1;
        const subC = item.subCustomer != null && String(item.subCustomer).trim() !== "" ? String(item.subCustomer).trim() : null;
        const confidence = item.confidenceScore != null && Number.isFinite(Number(item.confidenceScore))
            ? Math.max(0, Math.min(100, Math.round(Number(item.confidenceScore))))
            : null;
        await db.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark, sub_customer, confidence_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(itemId, orderId, productId, item.rawName, qty, unit, needReviewFlag, itemRemark, subC, confidence);
    }
}
async function appendRawLineToOrders(db, orderIds, lineText, nowSql) {
    const line = String(lineText ?? "").trim();
    if (!line || !orderIds?.length)
        return;
    for (const oid of orderIds) {
        const row = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(oid);
        const newRaw = (row?.raw_message ? row.raw_message + "\n" : "") + line;
        await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRaw, oid);
    }
}
async function duplicateAttachmentToOrders(db, lineMessageId, orderIds, nowSql) {
    if (!lineMessageId || !orderIds?.length)
        return;
    for (const oid of orderIds) {
        const attId = (0, id_js_1.newId)("att");
        await db.prepare("INSERT INTO order_attachments (id, order_id, line_message_id, created_at) VALUES (?, ?, ?, " + nowSql + ")").run(attId, oid, lineMessageId);
    }
}
async function getNextOrderNo(db, orderDate) {
    const nextKey = "order_seq_next_" + orderDate;
    const startKey = "order_seq_start_" + orderDate;
    // 起始序號（後台可為每日設定；未設預設 1）。僅在 nextKey 尚未建立時作為種子。
    const startRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(startKey);
    let startSeq = startRow && startRow.value ? parseInt(startRow.value, 10) : 1;
    if (!Number.isFinite(startSeq) || startSeq < 1)
        startSeq = 1;
    // 原子取號：以 INSERT … ON CONFLICT DO UPDATE … RETURNING 一句完成「取號＋遞增」，
    // 避免並發兩則訊息讀到同一序號而重號。nextKey 沿用舊語意「下一個要用的號」，
    // 故新碼對既有資料相容、不跳號：插入時種入 startSeq+1，回傳值＝指標−1＝本次使用序號。
    const row = await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) " +
        "RETURNING CAST(CAST(value AS INTEGER) - 1 AS TEXT) AS used").get(nextKey, String(startSeq + 1));
    const used = row && row.used != null ? parseInt(row.used, 10) : startSeq;
    const seq = Number.isFinite(used) ? Math.max(1, used) : startSeq;
    return orderDate.replace(/-/g, "") + String(seq).padStart(3, "0");
}
/** order_sub_split_key 篩選（與 rebuild-order 內同義）：null＝全部；空字串＝主客戶桶；非空＝該子客戶 */
function filterParsedBySplitKey(parsed, splitKey) {
    if (splitKey === undefined || splitKey === null)
        return parsed;
    if (splitKey === "")
        return parsed.filter((p) => { const sc = p.subCustomer; return sc == null || String(sc).trim() === ""; });
    const k = String(splitKey);
    return parsed.filter((p) => String(p.subCustomer || "").trim() === k);
}
/**
 * C4：結單時把整單解析結果寫入；若偵測到多個子客戶且本單尚未拆分，則「就地拆單」——
 * 主桶留在現有 order，其餘子客戶各開新 order。回傳所有結果 order id。
 * （供 LINE_PARSE_ONLY_AT_FINALIZE=1 模式取代逐則拆單。）
 */
async function distributeParsedToOrdersAtFinalize(db, orderId, customerId, parsed, nowSql) {
    const meta = await db.prepare("SELECT order_sub_split_key, order_date, line_group_id FROM orders WHERE id = ?").get(orderId);
    const splitKey = meta && meta.order_sub_split_key !== undefined ? meta.order_sub_split_key : null;
    // 已是子單：只覆寫屬於自己的品項
    if (splitKey !== null && splitKey !== undefined) {
        await rebuild_order_from_sources_js_1.replaceOrderItemsFromParsedRows(db, orderId, customerId, filterParsedBySplitKey(parsed, splitKey));
        return [orderId];
    }
    // 未拆且不需拆：整單覆寫
    if (!mustSplitOrdersBySubCustomer(parsed)) {
        await rebuild_order_from_sources_js_1.replaceOrderItemsFromParsedRows(db, orderId, customerId, parsed);
        return [orderId];
    }
    // 需拆：主桶留現有單、其餘開新單（整批交易）
    const map = groupParsedItemsBySubCustomer(parsed);
    const ids = [];
    const orderDate = (meta && meta.order_date) || getTaipeiOrderDate();
    const groupId = (meta && meta.line_group_id) || null;
    await db.transaction(async (tx) => {
        let first = true;
        for (const [subKey, items] of map) {
            if (first) {
                const remark = subKey === "" ? null : `[子單拆分: ${subKey}]`;
                await tx.prepare("UPDATE orders SET order_sub_split_key = ?, remark = COALESCE(?, remark), updated_at = " + nowSql + " WHERE id = ?").run(subKey, remark, orderId);
                await rebuild_order_from_sources_js_1.replaceOrderItemsFromParsedRows(tx, orderId, customerId, items);
                ids.push(orderId);
                first = false;
            }
            else {
                const remark = subKey === "" ? null : `[子單拆分: ${subKey}]`;
                const oid = await insertOrderRowWithSplitMeta(tx, getNextOrderNo, nowSql, {
                    orderDate, customerId, groupId,
                    rawMessage: "", remark, orderSubSplitKey: subKey, lineMessageId: null,
                });
                await rebuild_order_from_sources_js_1.replaceOrderItemsFromParsedRows(tx, oid, customerId, items);
                ids.push(oid);
            }
        }
    });
    return ids;
}
/** C4：對單一 order 收集來源（文字＋附件圖）整單解析一次，再分配/拆單。回傳結果 order id 陣列。 */
async function rebuildAndSplitOrderAtFinalize(db, orderId, customerId, nowSql) {
    const meta = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(orderId);
    const atts = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(orderId);
    const { parsed } = await rebuild_order_from_sources_js_1.collectParsedFromOrderSources(db, customerId, meta?.raw_message, atts);
    if (!parsed || !parsed.length)
        return [orderId]; // 沒解析到 → 保留現狀，不清空
    return await distributeParsedToOrdersAtFinalize(db, orderId, customerId, parsed, nowSql);
}
function createLineWebhook() {
    const router = express_1.default.Router();
    const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
    const db = (0, index_js_1.getDb)(dbPath);
    const lineClient = hasLineConfig ? new bot_sdk_1.Client(lineConfig) : null;
    /**
     * 執行單一群組的「結單」：整單重辨識 + 推播摘要。
     * 先以 DB 原子「認領」當閘門，確保 in-process timer 與 DB sweep（甚至多實例）之間只結一次。
     * @returns {Promise<boolean>} 是否由本次實際結單（認領成功）。
     */
    async function runFinalizeForSession(groupId, sessionLike) {
        if (!groupId)
            return false;
        // 認領：刪除 DB session 列；失敗（changes=0）代表別處已結，跳過避免重複摘要
        let claimed = true;
        try {
            claimed = await (0, order_collecting_session_js_1.claimCollectingSession)(db, groupId);
        }
        catch (e) {
            // DB 認領失敗時採最佳努力（沿用舊行為：timer 一律結單），僅記錄
            console.warn("[LINE] 結單認領失敗（best-effort 繼續）group=%s:", groupId, e?.message || e);
            claimed = true;
        }
        if (!claimed) {
            console.log("[LINE] 結單已由其他流程處理，略過 group=%s", groupId);
            return false;
        }
        const orderIdsForSession = [...new Set((sessionLike?.orderIds || []).filter(Boolean))];
        if (!orderIdsForSession.length)
            return false;
        const customerId = sessionLike?.customerId;
        const parseOnly = process.env.LINE_PARSE_ONLY_AT_FINALIZE === "1";
        const nowSqlF = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        let finalOrderIds = orderIdsForSession;
        if (parseOnly) {
            // C4：逐則未解析，結單時對每張單整單解析一次並就地拆單（拆出的新單併入摘要）
            const expanded = [];
            for (const oid of orderIdsForSession) {
                try {
                    const ids = await rebuildAndSplitOrderAtFinalize(db, oid, customerId, nowSqlF);
                    expanded.push(...ids);
                }
                catch (e) {
                    console.error("[LINE] 結單整單解析/拆單例外 orderId=%s:", oid, e?.message || e);
                    expanded.push(oid);
                }
            }
            const uniq = [...new Set(expanded.filter(Boolean))];
            if (uniq.length)
                finalOrderIds = uniq;
        }
        else if (process.env.LINE_SKIP_FINALIZE_FULL_REBUILD !== "1") {
            for (const oid of orderIdsForSession) {
                try {
                    const rawRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(oid);
                    const atts = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(oid);
                    const fr = await (0, rebuild_order_from_sources_js_1.rebuildOrderItemsFromOrderSources)(db, oid, customerId, rawRow?.raw_message, atts);
                    if (fr.ok)
                        console.log("[LINE] 結單整單重辨識完成 orderId=%s", oid);
                    else
                        console.warn("[LINE] 結單整單重辨識未覆寫（沿用逐則明細）orderId=%s err=%s", oid, fr.error);
                }
                catch (e) {
                    console.error("[LINE] 結單整單重辨識例外 orderId=%s:", oid, e?.message || e);
                }
            }
        }
        const order = await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(finalOrderIds[0]);
        const dateStr = order?.order_date || getTaipeiOrderDate();
        const orderBlocks = [];
        for (const oid of finalOrderIds) {
            const ord = await db.prepare("SELECT order_no, remark FROM orders WHERE id = ?").get(oid);
            const items = await db.prepare(`
          SELECT oi.raw_name, oi.quantity, oi.unit, p.name AS product_name, p.erp_code
          FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ? ORDER BY oi.id
        `).all(oid);
            const lines = [];
            let idx = 1;
            for (const it of items) {
                const unit = normalizeOrderUnit(it.unit, "公斤");
                const name = it.product_name || it.raw_name || "待確認";
                lines.push(`${idx}. ${name} ${formatOrderQty(it.quantity)}${unit || ""}`);
                idx += 1;
            }
            const hdr = ord?.remark ? `${ord.remark}\n` : "";
            orderBlocks.push(`【${ord?.order_no ?? oid}】\n${hdr}${lines.length ? lines.join("\n") : "（目前尚無可辨識品項）"}`);
        }
        const multi = finalOrderIds.length > 1;
        const summary = [
            multi ? `收到，已收單喔（共 ${finalOrderIds.length} 張訂單）。` : "收到，已收單喔。",
            `送貨日期為：${dateStr}`,
            multi ? "各張訂單明細如下：" : "訂購項目如下：",
            ...orderBlocks,
            "",
            "※ 若內容有誤：可傳「線上改單」查看項次，並傳「改第1項 3 公斤」或「刪第1項」修改（數字請自換）；品名錯誤請洽業務或後台改品項。",
            "（目前未連動批發行情，僅顯示叫貨數量與單位。）",
        ].join("\n");
        if (lineClient) {
            if (!(await (0, line_bot_control_js_1.isLineSuppressCustomerReply)(db))) {
                await lineClient.pushMessage(groupId, { type: "text", text: summary });
            }
            else {
                console.log("[LINE] 已略過結單推播（對客戶靜音） orders=%s", finalOrderIds.join(","));
            }
        }
        return true;
    }
    /**
     * 掃描 DB 中逾時（last_activity ≤ now − 收單窗）的 session 並結單。
     * 由 Cloud Scheduler 打 /api/jobs/finalize-due，及程序內 60 秒 interval 後備呼叫。
     */
    async function runFinalizeSweep() {
        try {
            const cutoff = Date.now() - COLLECT_TIMEOUT_MS;
            const due = await (0, order_collecting_session_js_1.listDueCollectingSessions)(db, cutoff);
            let finalized = 0;
            for (const s of due) {
                try {
                    const ok = await runFinalizeForSession(s.groupId, { customerId: s.customerId, orderIds: s.orderIds });
                    if (ok) {
                        finalized += 1;
                        // 清掉此實例可能殘留的記憶體 session／timer
                        collectingByGroup.delete(s.groupId);
                        const t = autoFinalizeTimers.get(s.groupId);
                        if (t)
                            clearTimeout(t);
                        autoFinalizeTimers.delete(s.groupId);
                    }
                }
                catch (e) {
                    console.error("[LINE] sweep 結單失敗 group=%s:", s.groupId, e?.message || e);
                }
            }
            return { due: due.length, finalized };
        }
        catch (e) {
            console.error("[LINE] runFinalizeSweep 失敗:", e?.message || e);
            return { due: 0, finalized: 0, error: String(e?.message || e) };
        }
    }
    const scheduleAutoFinalize = (groupId, session) => {
        if (!groupId)
            return;
        const orderIds = (session.allOrderIds && session.allOrderIds.length) ? session.allOrderIds : [session.orderId];
        // 鏡射 session 到 DB（best-effort；失敗不可中斷收單）。供結單 sweep 跨實例/重啟可靠觸發。
        (0, order_collecting_session_js_1.upsertCollectingSession)(db, { groupId, customerId: session.customerId, orderIds, nowMs: Date.now() })
            .catch((e) => console.warn("[LINE] session DB 鏡射失敗（不影響收單）:", e?.message || e));
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
                const orderIdsForSession = (session.allOrderIds && session.allOrderIds.length)
                    ? [...new Set(session.allOrderIds)]
                    : [session.orderId];
                await runFinalizeForSession(groupId, { customerId: session.customerId, orderIds: orderIdsForSession });
            }
            catch (e) {
                console.error("[LINE] 30 秒自動結單失敗:", e?.message || e);
            }
        }, COLLECT_TIMEOUT_MS);
        autoFinalizeTimers.set(groupId, t);
    };
    async function processLineWebhookEvents(events) {
        for (const event of events) {
            try {
                if (event.type === "unsend") {
                    const unsentMessageId = event.unsend?.messageId;
                    if (unsentMessageId) {
                        const mid = String(unsentMessageId);
                        const matched = await db.prepare("SELECT id, line_group_id FROM orders WHERE line_message_id = ?").all(mid);
                        if (matched.length) {
                            const deletedIds = new Set(matched.map((m) => m.id));
                            for (const oid of deletedIds) {
                                await db.prepare("DELETE FROM order_items WHERE order_id = ?").run(oid);
                                await db.prepare("DELETE FROM order_attachments WHERE order_id = ?").run(oid);
                                try {
                                    await db.prepare("DELETE FROM customer_order_image_examples WHERE order_id = ?").run(oid);
                                }
                                catch (_) { /* 表或 FK 可能不存在 */ }
                                await db.prepare("DELETE FROM orders WHERE id = ?").run(oid);
                            }
                            for (const [gid, sess] of [...collectingByGroup.entries()]) {
                                const ids = [sess.orderId, ...(sess.allOrderIds || [])].filter(Boolean);
                                if (ids.some((id) => deletedIds.has(id))) {
                                    collectingByGroup.delete(gid);
                                    const oldT = autoFinalizeTimers.get(gid);
                                    if (oldT)
                                        clearTimeout(oldT);
                                    autoFinalizeTimers.delete(gid);
                                    (0, order_collecting_session_js_1.deleteCollectingSession)(db, gid).catch((e) => console.warn("[LINE] 收回訊息清除 DB session 失敗:", e?.message || e));
                                }
                            }
                            console.log(`[LINE] 使用者收回訊息，已自動刪除關聯訂單，MessageId: ${mid}`);
                        }
                    }
                    continue;
                }
                if (event.type !== "message") {
                    console.log("[LINE] 略過非訊息, type:", event.type);
                    continue;
                }
                const curLineMessageId = event.message?.id != null ? String(event.message.id).trim() : null;
                /** LINE Webhook 逾時重試會帶相同 message.id；與程序內記憶體去重並用，跨程序／重啟後仍可靠。拆單時多筆訂單可共用同一 line_message_id，故不做 UNIQUE 約束。 */
                if (curLineMessageId) {
                    const dupByOrder = await db.prepare("SELECT id FROM orders WHERE line_message_id = ? LIMIT 1").get(curLineMessageId);
                    if (dupByOrder) {
                        console.log("[LINE] 偵測到重複的 messageId，略過處理");
                        continue;
                    }
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
                const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
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
                    const custRowImg = await db.prepare("SELECT default_unit, known_sub_customers FROM customers WHERE id = ?").get(customer.id);
                    const fallbackUnitImg = custRowImg?.default_unit?.trim() || "公斤";
                    const knownSubImg = custRowImg?.known_sub_customers != null ? String(custRowImg.known_sub_customers).trim() : "";
                    let handwritingSuffix = "";
                    try {
                        handwritingSuffix = await customer_handwriting_hints_js_1.buildPromptSuffixForCustomerHandwritingHints(db, customer.id);
                    }
                    catch (_) { /* ignore */ }
                    const imgParseOpts = {
                        ...(handwritingSuffix ? { geminiExtraSuffix: handwritingSuffix } : {}),
                        ...(knownSubImg ? { knownSubCustomers: knownSubImg } : {}),
                        db,
                        customerId: customer.id,
                    };
                    let parsedFromImg = [];
                    let ocrText = null;
                    if (process.env.LINE_PARSE_ONLY_AT_FINALIZE !== "1") {
                        const imgRes = await (0, parse_order_from_image_js_1.parseOrderItemsFromImageBuffer)(imageBuf, fallbackUnitImg, imgParseOpts);
                        parsedFromImg = imgRes.parsed;
                        ocrText = imgRes.ocrText;
                    }
                    else {
                        console.log("[LINE] 圖片逐則僅存附件（LINE_PARSE_ONLY_AT_FINALIZE=1），結單時整單辨識");
                    }
                    if (inCollecting) {
                        const session = collectingByGroup.get(groupId);
                        const ocrLine = ocrText || "[圖片]";
                        const orderDateVal = (await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(session.orderId))?.order_date || getTaipeiOrderDate();
                        const baseRawRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(session.orderId);
                        const newRawAppend = (baseRawRow?.raw_message ? baseRawRow.raw_message + "\n" : "") + ocrLine;
                        if (parsedFromImg.length > 0 && mustSplitOrdersBySubCustomer(parsedFromImg)) {
                            const map = groupParsedItemsBySubCustomer(parsedFromImg);
                            const newOrderIds = [];
                            await db.transaction(async (tx) => {
                            for (const [subKey, items] of map) {
                                const remark = subKey === "" ? null : `[子單拆分: ${subKey}]`;
                                const splitKey = subKey === "" ? "" : subKey;
                                const oid = await insertOrderRowWithSplitMeta(tx, getNextOrderNo, nowSql, {
                                    orderDate: orderDateVal,
                                    customerId: session.customerId,
                                    groupId,
                                    rawMessage: "",
                                    remark,
                                    orderSubSplitKey: splitKey,
                                    lineMessageId: curLineMessageId,
                                });
                                newOrderIds.push(oid);
                                await tx.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRawAppend, oid);
                                await duplicateAttachmentToOrders(tx, messageId, [oid], nowSql);
                                await insertParsedItemsForOrder(tx, oid, session.customerId, items, fallbackUnitImg);
                            }
                            });
                            mergeSessionOrderIds(session, newOrderIds);
                            scheduleAutoFinalize(groupId, session);
                            if (lineClient && newOrderIds.length > 1) {
                                await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${newOrderIds.length} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db);
                            }
                        }
                        else if (parsedFromImg.length > 0) {
                            const attId = (0, id_js_1.newId)("att");
                            await db.prepare("INSERT INTO order_attachments (id, order_id, line_message_id, created_at) VALUES (?, ?, ?, " + nowSql + ")").run(attId, session.orderId, messageId);
                            await insertParsedItemsForOrder(db, session.orderId, session.customerId, parsedFromImg, fallbackUnitImg);
                            await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRawAppend, session.orderId);
                        }
                        else {
                            const attId = (0, id_js_1.newId)("att");
                            await db.prepare("INSERT INTO order_attachments (id, order_id, line_message_id, created_at) VALUES (?, ?, ?, " + nowSql + ")").run(attId, session.orderId, messageId);
                            await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRawAppend, session.orderId);
                        }
                    }
                    else {
                        const orderDate = getTaipeiOrderDate();
                        let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ?").get(customer.id, orderDate);
                        const ocrLine = ocrText || "[圖片]";
                        if (parsedFromImg.length > 0 && mustSplitOrdersBySubCustomer(parsedFromImg)) {
                            const map = groupParsedItemsBySubCustomer(parsedFromImg);
                            const newOrderIds = [];
                            await db.transaction(async (tx) => {
                            for (const [subKey, items] of map) {
                                const remark = subKey === "" ? null : `[子單拆分: ${subKey}]`;
                                const splitKey = subKey === "" ? "" : subKey;
                                const oid = await insertOrderRowWithSplitMeta(tx, getNextOrderNo, nowSql, {
                                    orderDate,
                                    customerId: customer.id,
                                    groupId,
                                    rawMessage: "",
                                    remark,
                                    orderSubSplitKey: splitKey,
                                    lineMessageId: curLineMessageId,
                                });
                                newOrderIds.push(oid);
                                const rawFull = (orderRow?.raw_message ? orderRow.raw_message + "\n" : "") + ocrLine;
                                await tx.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(rawFull, oid);
                                await duplicateAttachmentToOrders(tx, messageId, [oid], nowSql);
                                await insertParsedItemsForOrder(tx, oid, customer.id, items, fallbackUnitImg);
                            }
                            });
                            if (groupId) {
                                const session = { orderId: newOrderIds[0], allOrderIds: newOrderIds.slice(), customerId: customer.id, lastActivity: Date.now() };
                                collectingByGroup.set(groupId, session);
                                scheduleAutoFinalize(groupId, session);
                            }
                            if (lineClient && newOrderIds.length > 1) {
                                await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${newOrderIds.length} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db);
                            }
                        }
                        else {
                            let orderId;
                            if (orderRow) {
                                orderId = orderRow.id;
                            }
                            else {
                                orderId = await insertOrderRowWithSplitMeta(db, getNextOrderNo, nowSql, {
                                    orderDate,
                                    customerId: customer.id,
                                    groupId,
                                    rawMessage: "",
                                    remark: null,
                                    orderSubSplitKey: null,
                                    lineMessageId: curLineMessageId,
                                });
                            }
                            if (groupId) {
                                const session = { orderId, allOrderIds: [orderId], customerId: customer.id, lastActivity: Date.now() };
                                collectingByGroup.set(groupId, session);
                                scheduleAutoFinalize(groupId, session);
                            }
                            await duplicateAttachmentToOrders(db, messageId, [orderId], nowSql);
                            const newRawImg = (orderRow?.raw_message ? orderRow.raw_message + "\n" : "") + ocrLine;
                            if (parsedFromImg.length > 0) {
                                await insertParsedItemsForOrder(db, orderId, customer.id, parsedFromImg, fallbackUnitImg);
                            }
                            await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRawImg, orderId);
                        }
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
                    const lineForRaw = String(text || "").trim();
                    // C4：只在結單整單解析一次（LINE_PARSE_ONLY_AT_FINALIZE=1）時，起單僅存原文、不逐則打 AI
                    if (!rest || process.env.LINE_PARSE_ONLY_AT_FINALIZE === "1") {
                        let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ?").get(customerId, orderDate);
                        let orderId;
                        if (orderRow) {
                            orderId = orderRow.id;
                        }
                        else {
                            orderId = await insertOrderRowWithSplitMeta(db, getNextOrderNo, nowSql, {
                                orderDate,
                                customerId,
                                groupId,
                                rawMessage: "",
                                remark: null,
                                orderSubSplitKey: null,
                                lineMessageId: curLineMessageId,
                            });
                        }
                        if (groupId) {
                            const session = { orderId, allOrderIds: [orderId], customerId, lastActivity: Date.now() };
                            collectingByGroup.set(groupId, session);
                            scheduleAutoFinalize(groupId, session);
                        }
                        if (lineForRaw) {
                            const orderRowRaw = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(orderId);
                            const newRaw = (orderRowRaw?.raw_message ? orderRowRaw.raw_message + "\n" : "") + lineForRaw;
                            await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRaw, orderId);
                        }
                        continue;
                    }
                    const custRow = await db.prepare("SELECT default_unit, known_sub_customers FROM customers WHERE id = ?").get(customerId);
                    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                    const knownSub = custRow?.known_sub_customers != null ? String(custRow.known_sub_customers).trim() : "";
                    const parseOpts = {
                        ...(knownSub ? { knownSubCustomers: knownSub } : {}),
                        db,
                        customerId,
                    };
                    const parsed = await (0, parse_order_message_js_1.parseOrderMessage)(rest, fallbackUnit, parseOpts);
                    if (mustSplitOrdersBySubCustomer(parsed)) {
                        const map = groupParsedItemsBySubCustomer(parsed);
                        const newOrderIds = [];
                        await db.transaction(async (tx) => {
                        for (const [subKey, items] of map) {
                            const remark = subKey === "" ? null : `[子單拆分: ${subKey}]`;
                            const splitKey = subKey === "" ? "" : subKey;
                            const oid = await insertOrderRowWithSplitMeta(tx, getNextOrderNo, nowSql, {
                                orderDate,
                                customerId,
                                groupId,
                                rawMessage: lineForRaw,
                                remark,
                                orderSubSplitKey: splitKey,
                                lineMessageId: curLineMessageId,
                            });
                            newOrderIds.push(oid);
                            await insertParsedItemsForOrder(tx, oid, customerId, items, fallbackUnit);
                        }
                        });
                        if (groupId) {
                            const session = { orderId: newOrderIds[0], allOrderIds: newOrderIds.slice(), customerId, lastActivity: Date.now() };
                            collectingByGroup.set(groupId, session);
                            scheduleAutoFinalize(groupId, session);
                        }
                        if (lineClient && newOrderIds.length > 1) {
                            await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${newOrderIds.length} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db);
                        }
                        continue;
                    }
                    let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ?").get(customerId, orderDate);
                    let orderId;
                    if (orderRow) {
                        orderId = orderRow.id;
                    }
                    else {
                        orderId = await insertOrderRowWithSplitMeta(db, getNextOrderNo, nowSql, {
                            orderDate,
                            customerId,
                            groupId,
                            rawMessage: "",
                            remark: null,
                            orderSubSplitKey: null,
                            lineMessageId: curLineMessageId,
                        });
                    }
                    if (groupId) {
                        const session = { orderId, allOrderIds: [orderId], customerId, lastActivity: Date.now() };
                        collectingByGroup.set(groupId, session);
                        scheduleAutoFinalize(groupId, session);
                    }
                    await insertParsedItemsForOrder(db, orderId, customerId, parsed, fallbackUnit);
                    const orderRowRaw = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(orderId);
                    if (lineForRaw) {
                        const newRaw = (orderRowRaw?.raw_message ? orderRowRaw.raw_message + "\n" : "") + lineForRaw;
                        await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRaw, orderId);
                    }
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
                        // 手動完成自行重辨識並收單，移除 DB session 以免 sweep 重複結單
                        (0, order_collecting_session_js_1.deleteCollectingSession)(db, groupId).catch((e) => console.warn("[LINE] 手動完成清除 DB session 失敗:", e?.message || e));
                        const doneOrderIds = (session.allOrderIds && session.allOrderIds.length) ? [...new Set(session.allOrderIds)] : [session.orderId];
                        if (process.env.LINE_SKIP_FINALIZE_FULL_REBUILD !== "1") {
                            for (const oid of doneOrderIds) {
                                try {
                                    const rawRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(oid);
                                    const atts = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(oid);
                                    const fr = await (0, rebuild_order_from_sources_js_1.rebuildOrderItemsFromOrderSources)(db, oid, session.customerId, rawRow?.raw_message, atts);
                                    if (fr.ok)
                                        console.log("[LINE] 手動完成：整單重辨識完成 orderId=%s", oid);
                                    else
                                        console.warn("[LINE] 手動完成：整單重辨識未覆寫 orderId=%s err=%s", oid, fr.error);
                                }
                                catch (e) {
                                    console.error("[LINE] 手動完成：整單重辨識例外 orderId=%s:", oid, e?.message || e);
                                }
                            }
                        }
                        const cust = await db.prepare("SELECT route_line FROM customers WHERE id = ?").get(session.customerId);
                        const routeLine = cust?.route_line >= 1 && cust?.route_line <= 9 ? cust.route_line : null;
                        const emptyBasketErp = routeLine != null ? "C01000" + (56 + routeLine) : null;
                        if (emptyBasketErp) {
                            const emptyBasket = await db.prepare("SELECT id, name, unit FROM products WHERE erp_code = ?").get(emptyBasketErp);
                            if (emptyBasket) {
                                for (const oid of doneOrderIds) {
                                    const itemId1 = (0, id_js_1.newId)("item");
                                    await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export, sub_customer) VALUES (?, ?, ?, ?, 0, ?, 0, 1, NULL)").run(itemId1, oid, emptyBasket.id, emptyBasket.name, emptyBasket.unit || "個");
                                }
                            }
                        }
                        const squareBasket = await db.prepare("SELECT id, name, unit FROM products WHERE erp_code = ?").get("C0100065");
                        if (squareBasket) {
                            for (const oid of doneOrderIds) {
                                const itemId2 = (0, id_js_1.newId)("item");
                                await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export, sub_customer) VALUES (?, ?, ?, ?, 0, ?, 0, 1, NULL)").run(itemId2, oid, squareBasket.id, squareBasket.name, squareBasket.unit || "個");
                            }
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
                        autoOrderId = await insertOrderRowWithSplitMeta(db, getNextOrderNo, nowSql, {
                            orderDate: autoOrderDate,
                            customerId,
                            groupId,
                            rawMessage: "",
                            remark: null,
                            orderSubSplitKey: null,
                            lineMessageId: curLineMessageId,
                        });
                    }
                    const autoSession = { orderId: autoOrderId, allOrderIds: [autoOrderId], customerId, lastActivity: Date.now() };
                    collectingByGroup.set(groupId, autoSession);
                    scheduleAutoFinalize(groupId, autoSession);
                }
                if (!groupId || !collectingByGroup.has(groupId)) {
                    continue;
                }
                // 收單模式：將本則當成叫貨累加
                const session = collectingByGroup.get(groupId);
                const { orderId, customerId: cid } = session;
                const idsForRaw = (session.allOrderIds && session.allOrderIds.length) ? [...new Set(session.allOrderIds)] : [orderId];
                await appendRawLineToOrders(db, idsForRaw, text, nowSql);
                const custRow = await db.prepare("SELECT default_unit, known_sub_customers FROM customers WHERE id = ?").get(cid);
                const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                const knownSub2 = custRow?.known_sub_customers != null ? String(custRow.known_sub_customers).trim() : "";
                const parseOpts2 = {
                    ...(knownSub2 ? { knownSubCustomers: knownSub2 } : {}),
                    db,
                    customerId: cid,
                };
                // 過短或不含數字的訊息（純 emoji、問候語等）略過 Gemini 解析
                const looksLikeOrder = text.length >= 4 && /[\d０-９]/.test(text);
                if (!looksLikeOrder) {
                    console.log("[LINE] 訊息不含數字或過短，略過 Gemini 解析");
                    continue;
                }
                // C4：只在結單整單解析一次時，逐則僅累加原文（前面 appendRawLineToOrders 已存），不打 AI
                if (process.env.LINE_PARSE_ONLY_AT_FINALIZE === "1") {
                    console.log("[LINE] 逐則僅存原文（LINE_PARSE_ONLY_AT_FINALIZE=1），結單時整單解析");
                    continue;
                }
                const parsed = await (0, parse_order_message_js_1.parseOrderMessage)(text, fallbackUnit, parseOpts2);
                console.log("[LINE] 解析結果 筆數:", parsed.length, parsed.length ? "品項:" + parsed.map((p) => p.rawName + " " + p.quantity).join(", ") : "");
                const rawSnap = (await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(orderId))?.raw_message ?? "";
                if (parsed.length > 0 && mustSplitOrdersBySubCustomer(parsed)) {
                    const map = groupParsedItemsBySubCustomer(parsed);
                    const orderDateVal = (await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(orderId))?.order_date || getTaipeiOrderDate();
                    const newOrderIds = [];
                    await db.transaction(async (tx) => {
                    for (const [subKey, items] of map) {
                        const remark = subKey === "" ? null : `[子單拆分: ${subKey}]`;
                        const splitKey = subKey === "" ? "" : subKey;
                        const oid = await insertOrderRowWithSplitMeta(tx, getNextOrderNo, nowSql, {
                            orderDate: orderDateVal,
                            customerId: cid,
                            groupId,
                            rawMessage: rawSnap,
                            remark,
                            orderSubSplitKey: splitKey,
                            lineMessageId: curLineMessageId,
                        });
                        newOrderIds.push(oid);
                        await insertParsedItemsForOrder(tx, oid, cid, items, fallbackUnit);
                    }
                    });
                    mergeSessionOrderIds(session, newOrderIds);
                    scheduleAutoFinalize(groupId, session);
                    if (lineClient && newOrderIds.length > 1) {
                        await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${newOrderIds.length} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db);
                    }
                }
                else if (parsed.length > 0) {
                    await insertParsedItemsForOrder(db, orderId, cid, parsed, fallbackUnit);
                }
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

    }

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
        const useCloudTasks = (0, cloud_tasks_line_js_1.isLineCloudTasksEnabled)();
        if (useCloudTasks) {
            // 先回 200 給 LINE，避免 LINE 逾時後重送並觸發更多重複處理
            res.status(200).send("OK");
            (async () => {
                try {
                    for (const ev of events) {
                        await (0, cloud_tasks_line_js_1.enqueueLineEventTask)(ev);
                    }
                }
                catch (e) {
                    console.error("[LINE] Cloud Tasks enqueue 失敗，改直接處理（fallback）:", e?.message || e);
                    // 回退直接處理：dedup 機制（記憶體 Set + DB line_message_id）防止重複下單
                    processLineWebhookEvents(events).catch((e2) => console.error("[LINE] Cloud Tasks fallback 直接處理失敗:", e2?.message || e2));
                }
            })();
            return;
        }
        res.status(200).send("OK");
        processLineWebhookEvents(events).catch((e) => console.error("[LINE] 背景處理失敗", e));
    });
    exports.processLineWebhookEvents = processLineWebhookEvents;
    exports.runFinalizeSweep = runFinalizeSweep;
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
