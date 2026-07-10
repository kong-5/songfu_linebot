"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLineWebhook = createLineWebhook;
exports.processLineWebhookEvents = async (_events) => {
    throw new Error("LINE webhook 尚未初始化：請先呼叫 createLineWebhook()");
};
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
const employee_line_binding_js_1 = require("../lib/employee-line-binding.js");
const basket_log_js_1 = require("../lib/basket-log.js");
const group_features_js_1 = require("../lib/group-features.js");
const empty_baskets_js_1 = require("../lib/empty-baskets.js");
const line_conversation_js_1 = require("../lib/line-conversation.js");
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
const lineConfig = { channelAccessToken, channelSecret };
const hasLineConfig = Boolean(channelAccessToken && channelSecret);
/** 收單模式：群組 ID -> { orderId, customerId, lastActivity }；可設 LINE_COLLECT_TIMEOUT_SEC 覆蓋，預設 30 秒 */
const COLLECT_TIMEOUT_MS = (parseInt(process.env.LINE_COLLECT_TIMEOUT_SEC || "30", 10) || 30) * 1000;
const collectingByGroup = new Map();
const autoFinalizeTimers = new Map();
// 補空籃邏輯抽到 ../lib/empty-baskets.js（後台拆併單也要用同一份，避免兩處版本漂移）
const insertEmptyBaskets = empty_baskets_js_1.insertEmptyBaskets;
// G15：session 持久化 helpers（讓 Cloud Run 重啟後可恢復未結單）
async function persistCollectSession(db, groupId, session) {
    if (!db || !groupId || !session?.orderId) return;
    try {
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        const allIds = JSON.stringify(Array.isArray(session.allOrderIds) ? session.allOrderIds : [session.orderId]);
        // 用「先刪後插」做 upsert，避方言相容問題
        await db.prepare("DELETE FROM line_collect_sessions WHERE group_id = ?").run(groupId);
        await db.prepare(`INSERT INTO line_collect_sessions
            (group_id, order_id, customer_id, all_order_ids_json, last_activity_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ` + nowSql + `)`).run(
            groupId, session.orderId, session.customerId, allIds, Number(session.lastActivity || Date.now())
        );
    } catch (e) {
        console.warn("[session-persist] upsert 失敗 group=%s: %s", groupId, e?.message || e);
    }
}
async function deleteCollectSession(db, groupId) {
    if (!db || !groupId) return;
    try {
        await db.prepare("DELETE FROM line_collect_sessions WHERE group_id = ?").run(groupId);
    } catch (e) {
        console.warn("[session-persist] delete 失敗 group=%s: %s", groupId, e?.message || e);
    }
}
async function restoreCollectSessions(db, scheduleAutoFinalize) {
    if (!db) return;
    try {
        const rows = await db.prepare("SELECT group_id, order_id, customer_id, all_order_ids_json, last_activity_at FROM line_collect_sessions").all();
        const now = Date.now();
        let restored = 0;
        let stale = 0;
        for (const r of rows || []) {
            let allIds = [r.order_id];
            try {
                const parsed = JSON.parse(r.all_order_ids_json || "[]");
                if (Array.isArray(parsed) && parsed.length) allIds = parsed;
            } catch (_) { /* 容錯 */ }
            const lastAct = Number(r.last_activity_at) || 0;
            const session = { orderId: r.order_id, customerId: r.customer_id, allOrderIds: allIds, lastActivity: lastAct };
            // 若已超過 COLLECT_TIMEOUT_MS 很久（>10 分鐘），代表機器人 down 太久，直接清；其餘正常重排計時器
            if (lastAct && now - lastAct > 10 * 60 * 1000) {
                stale += 1;
                await deleteCollectSession(db, r.group_id);
                continue;
            }
            collectingByGroup.set(r.group_id, session);
            scheduleAutoFinalize(r.group_id, session);
            restored += 1;
        }
        console.log("[session-persist] 啟動恢復 sessions: 恢復=%d 過期清除=%d", restored, stale);
    } catch (e) {
        console.warn("[session-persist] 啟動恢復失敗:", e?.message || e);
    }
}
/** 10 分鐘訂單確認回覆計時器：groupId -> Timeout（與 30 秒結單獨立） */
const orderConfirmReplyTimers = new Map();
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
/** [fix 2026-07-10] 訊息處理「失敗」時釋放記憶體去重，讓 LINE redelivery（同 message.id）可在本實例重跑。
 * 與持久化去重的「完成才 INSERT」反轉語意配套（見事件迴圈 finally），失敗的訊息不留任何去重標記。 */
function releaseLineWebhookMessageOnce(messageId) {
    const id = messageId != null ? String(messageId).trim() : "";
    if (!id)
        return;
    recentLineMessageIdSet.delete(id);
    const idx = recentLineMessageIdQueue.indexOf(id);
    if (idx >= 0)
        recentLineMessageIdQueue.splice(idx, 1);
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
    // [fix 2026-07-10] 只要出現任一「非空」子客戶就分流。舊條件 keys.size > 1 會漏掉
    // 「整則訊息都是同一家子客戶」的情況（共用群組單獨幫某分店叫貨，如養鍋），
    // 品項全掉進主客戶單。subCustomer 只有客戶主檔設定 known_sub_customers 時才會有值
    // （解析入口已把未設定客戶的 subCustomer 清空），不會影響未設定的客戶。
    if (keys.size > 1)
        return true;
    return keys.size === 1 && !keys.has("");
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
/** 員工關鍵字：觸發回覆功能選單（reply 免費） */
function isEmployeeMenuKeyword(text) {
    if (!text) return false;
    const t = String(text).trim().toLowerCase();
    return ["選單", "功能", "功能表", "選項", "menu", "liff", "/menu", "/功能"].includes(t);
}
/** 組「員工功能選單」Flex Message（依環境變數有設哪些 LIFF 動態列出） */
function buildEmployeeMenuFlex(employee) {
    const liffs = [
        { id: process.env.LIFF_ID_ORDER_REVIEW, label: "📋 訂單審核", subtitle: "查看 / 確認今日訂單" },
        { id: process.env.LIFF_ID_FREEZER_TEMP, label: "🌡️ 冷凍冷藏溫度", subtitle: "HACCP 日常溫度記錄" },
        { id: process.env.LIFF_ID_CUSTOMER_LOOKUP, label: "👤 客戶速查", subtitle: "搜尋客戶 360 摘要" },
        { id: process.env.LIFF_ID_EMPLOYEE_BIND, label: "📱 員工綁定", subtitle: "新員工綁定 LINE 用" },
    ].filter(x => x.id && String(x.id).trim());
    const buttons = liffs.map(l => ({
        type: "box", layout: "vertical", margin: "sm", paddingAll: "10px",
        backgroundColor: "#f3f6fb", cornerRadius: "8px",
        action: { type: "uri", uri: `https://liff.line.me/${l.id}` },
        contents: [
            { type: "text", text: l.label, weight: "bold", size: "md", color: "#1a7c6e" },
            { type: "text", text: l.subtitle, size: "xs", color: "#666666", margin: "xs" },
        ],
    }));
    const empName = (employee && (employee.name || employee.username)) || "員工";
    return {
        type: "flex",
        altText: "員工功能選單",
        contents: {
            type: "bubble",
            size: "kilo",
            header: {
                type: "box", layout: "vertical", backgroundColor: "#1a7c6e", paddingAll: "16px",
                contents: [
                    { type: "text", text: "📋 員工功能選單", color: "#ffffff", size: "lg", weight: "bold" },
                    { type: "text", text: empName, color: "#b2dfdb", size: "xs", margin: "xs" },
                ],
            },
            body: {
                type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px",
                contents: buttons.length ? buttons : [{ type: "text", text: "尚無可用 LIFF（請至後台設定）", size: "sm", color: "#999999" }],
            },
            footer: {
                type: "box", layout: "vertical", paddingAll: "10px",
                contents: [{ type: "text", text: "點任一按鈕開啟功能", size: "xxs", color: "#aaaaaa", align: "center" }],
            },
        },
    };
}
/**
 * 客戶意圖偵測：依關鍵詞判斷訊息類型。
 * 回傳 { intent, keywords }，intent 為：
 *   - 'complaint'      : 客訴（最高優先級，product issues / 投訴 / refund）
 *   - 'cancel_order'   : 取消訂單
 *   - 'modify_order'   : 改訂單（改數量、改品項、改時間）
 *   - 'return_request' : 退貨／退換貨（與 complaint 重疊度高，retain to keep semantics）
 *   - 'delivery_inquiry': 詢問送貨時間／到貨進度
 *   - 'add_to_order'   : 補叫貨（既有訂單上加品項）
 *   - null             : 無特殊意圖（一般叫貨／問候）
 *
 * 多匹配時優先順序：complaint > return_request > cancel_order > modify_order > delivery_inquiry > add_to_order
 */
function detectCustomerIntent(text) {
    if (!text) return { intent: null, keywords: [] };
    const t = String(text);
    // 各意圖的關鍵詞 patterns
    const intents = [
        {
            key: "complaint",
            patterns: [
                /壞掉|壞了|爛掉|爛了|腐爛|發霉|發臭|有蟲|生蟲|長蟲|變質|不新鮮/,
                /客訴|投訴|抱怨|賠償|要賠|理賠/,
                /送錯|配錯|漏送|少送|多送|送少|送多|寄錯/,
                /上次.{0,8}(壞|爛|不好|有問題|不新鮮|不對|怪)/,
                /品質.{0,5}(差|不好|有問題)/,
                /菜.{0,5}有問題|貨.{0,5}有問題/,
            ],
        },
        {
            key: "return_request",
            patterns: [
                /退錢|退費|退貨|退掉|要退/,
                /換貨|換新的|重送/,
            ],
        },
        {
            key: "cancel_order",
            patterns: [
                /取消(訂單|這筆|今天|明天)?|不要了|不用送|別送|不出貨/,
                /(取消|刪|拿掉).{0,5}(這|那|剛剛)?(筆|張|單)/,
                /先別送|不用了/,
            ],
        },
        {
            key: "modify_order",
            patterns: [
                /改成|改為|更改|修改|想改/,
                /改.{0,5}(數量|多少|幾)/,
                /(多|少|加).{0,3}(一|二|三|四|五|六|七|八|九|十|\d)+.{0,5}(把|斤|公斤|包|罐|盒|件)/,
                /改.{0,5}(明天|後天|今天|送貨日|出貨日|時間)/,
            ],
        },
        {
            key: "delivery_inquiry",
            patterns: [
                /什麼時候(送|到)|何時(送|到)|幾點(送|到)|多久(送|到)|送到了嗎/,
                /(到|送).{0,4}(了沒|了嗎)/,
                /進度|還沒到|還沒收|還沒送/,
                /可以.{0,3}(快點|提前|提早|先送)/,
            ],
        },
        {
            key: "add_to_order",
            patterns: [
                /再加|再多|再來|順便|還要|加買/,
                /補.{0,3}(訂|單|一|二|三|四|五|六|七|八|九|十|\d)/,
                /補一(下|份|張)|再補/,
                /剛剛.{0,5}(漏|忘|沒)/,
            ],
        },
        {
            key: "basket_return",
            patterns: [
                /退籃|收籃|還籃/,
                /(\d+|一|二|三|四|五|六|七|八|九|十).{0,3}(個|顆)?籃(子|$|，|。|\s)/,
                /(空|髒)?籃.{0,5}(要還|要退|退回|回收|拿走)/,
                /籃子.{0,5}(明天|後天|下次).{0,5}(還|退)/,
            ],
        },
    ];
    // [fix 2026-07-08] extractBasketCount 已搬至模組頂層（外層 basket_return 標註處也要用），此處不再定義。
    const matched = [];
    let primaryIntent = null;
    for (const { key, patterns } of intents) {
        for (const p of patterns) {
            const m = t.match(p);
            if (m) {
                matched.push({ intent: key, keyword: m[0] });
                if (primaryIntent == null) primaryIntent = key;
                break;
            }
        }
    }
    return {
        intent: primaryIntent,
        keywords: matched.map(x => x.keyword),
        allMatches: matched,
    };
}
/** 從訊息中抽取籃數（簡單啟發式）
 * [fix 2026-07-08] 原本定義在 detectCustomerIntent 內部（區域函式），但約 L1614 的外層 basket_return
 * 意圖標註處也呼叫它 → 拋 ReferenceError 被 try/catch 靜默吞掉，籃數 remark/稽核永遠寫不進去。
 * 搬到模組頂層，內外兩處共用同一實作。
 */
function extractBasketCount(text) {
    if (!text) return null;
    const numMatch = String(text).match(/(\d+).{0,3}(個|顆)?籃/);
    if (numMatch) return parseInt(numMatch[1], 10);
    const cnMap = { "一":1,"二":2,"兩":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10 };
    const cnMatch = String(text).match(/([一二兩三四五六七八九十]).{0,3}(個|顆)?籃/);
    if (cnMatch) return cnMap[cnMatch[1]] ?? null;
    return null;
}
/** 向後相容：原本只有「客訴」用途的舊函式名 */
function detectComplaintKeywords(text) {
    const r = detectCustomerIntent(text);
    return { matched: r.intent === "complaint", keywords: r.intent === "complaint" ? r.keywords : [] };
}
async function insertOrderRowWithSplitMeta(db, getNextOrderNo, nowSql, { orderDate, customerId, groupId, rawMessage, remark, orderSubSplitKey, lineMessageId, }) {
    const orderId = (0, id_js_1.newId)("ord");
    const splitVal = orderSubSplitKey === undefined ? null : orderSubSplitKey;
    const lineMid = lineMessageId != null && String(lineMessageId).trim() !== "" ? String(lineMessageId).trim() : null;
    // G13：UNIQUE 約束建立後，多實例同時 INSERT 可能撞 order_no。重試最多 3 次重新取號。
    const maxAttempts = 3;
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const orderNo = await getNextOrderNo(db, orderDate);
        try {
            await db.prepare(`INSERT INTO orders (id, order_no, customer_id, order_date, line_group_id, raw_message, status, remark, order_sub_split_key, line_message_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ` + nowSql + `)`).run(orderId, orderNo, customerId, orderDate, groupId ?? null, rawMessage ?? "", remark ?? null, splitVal, lineMid);
            return orderId;
        } catch (e) {
            lastErr = e;
            const msg = String(e?.message || e || "");
            const isUniqueViolation = /UNIQUE constraint failed: orders\.order_no|duplicate key value.*ux_orders_order_no|orders_order_no_key/i.test(msg);
            if (isUniqueViolation && attempt < maxAttempts) {
                console.warn("[insertOrder] order_no=%s 撞號（第 %d 次），重新取號重試", orderNo, attempt);
                continue;
            }
            throw e;
        }
    }
    throw lastErr || new Error("insertOrderRowWithSplitMeta: 重試 3 次仍失敗");
}
/** [fix 2026-07-10] 拆單時把同客戶同日的「未拆單」主訂單（order_sub_split_key IS NULL）標成主客戶桶（''）。
 * rebuild 的過濾語意是 NULL＝全部品項、''＝只留 subCustomer 空的品項；一旦當日出現子客戶拆單，
 * 若主訂單仍為 NULL，結單整單重辨識會把子客戶品項也重建進主訂單 → 與子單重複出貨。 */
async function markSameDayMainOrdersAsSplitBase(db, customerId, orderDate, nowSql) {
    await db.prepare(
        "UPDATE orders SET order_sub_split_key = '', updated_at = " + nowSql +
        " WHERE customer_id = ? AND order_date = ? AND order_sub_split_key IS NULL" +
        " AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint')"
    ).run(customerId, orderDate);
}
/** [fix 2026-07-10] 依子客戶分流時「找到或建立」目標訂單（比照後台 resolveSplitTargetOrder）。
 * 舊行為是每次拆單都無條件新建訂單：同一群組上午、下午各傳一次同一子客戶的叫貨，
 * 或多則訊息各自拆單，會冒出多張同子客戶的當日訂單。改為同客戶＋同日＋同 split key 重用。
 * subKey ''＝主客戶桶（連同 NULL 舊主訂單一併視為同桶）。回傳 { orderId, created }。 */
async function findOrCreateSplitTargetOrder(db, getNextOrderNo, nowSql, { customerId, orderDate, groupId, subKey, rawMessage, lineMessageId }) {
    let row;
    if (subKey === "") {
        row = await db.prepare(
            "SELECT id FROM orders WHERE customer_id = ? AND order_date = ?" +
            " AND (order_sub_split_key IS NULL OR TRIM(COALESCE(order_sub_split_key,'')) = '')" +
            " AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no LIMIT 1"
        ).get(customerId, orderDate);
    }
    else {
        row = await db.prepare(
            "SELECT id FROM orders WHERE customer_id = ? AND order_date = ?" +
            " AND TRIM(COALESCE(order_sub_split_key,'')) = ?" +
            " AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no LIMIT 1"
        ).get(customerId, orderDate, subKey);
    }
    if (row?.id)
        return { orderId: row.id, created: false };
    const orderId = await insertOrderRowWithSplitMeta(db, getNextOrderNo, nowSql, {
        orderDate,
        customerId,
        groupId,
        rawMessage: rawMessage ?? "",
        remark: subKey === "" ? null : `[子單拆分: ${subKey}]`,
        orderSubSplitKey: subKey,
        lineMessageId,
    });
    return { orderId, created: true };
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
        {
            // 內建物理換算（台斤/斤/台兩/克→公斤）一律套用；品項規則在函式內部才需已對應
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
/** raw_message 上限（字元數）：超過時前段截斷，避免整單重辨識送 Gemini 時 token 暴增 */
const RAW_MESSAGE_MAX_CHARS = Math.max(2000, Number(process.env.LINE_RAW_MESSAGE_MAX_CHARS ?? 20000) | 0);
/** 已知純聊天／控制詞，不該寫進 raw_message（避免整單重辨識被混淆） */
const RAW_MESSAGE_SKIP_EXACT = new Set([
    "謝謝", "謝謝你", "謝謝您", "感謝", "好", "好的", "好喔", "嗯", "ok", "OK", "Ok", "收到", "👌", "🙏", "❤️", "❤", "✅",
    "改單", "如何改單", "改單說明", "訂單錯誤", "叫貨錯誤",
    "線上改單", "訂單更正說明",
    "今天叫了什麼", "今日訂單", "今日叫貨",
    "取得群組ID", "群組ID",
]);
function isRawMessageNoise(line) {
    const s = String(line ?? "").trim();
    if (!s) return true;
    if (RAW_MESSAGE_SKIP_EXACT.has(s)) return true;
    // 純 emoji／符號（不含中英數）：略過
    if (!/[\p{L}\p{N}]/u.test(s)) return true;
    // 線上改單編輯指令（如「改第1項 3 公斤」「刪第2項」）：略過
    if (/^改第?\d+項?(\s|$)/.test(s) || /^刪第?\d+項?$/.test(s) || /^刪除\s*\d+\s*$/.test(s) || /^更正\s*\d+/.test(s))
        return true;
    return false;
}
async function appendRawLineToOrders(db, orderIds, lineText, nowSql) {
    const line = String(lineText ?? "").trim();
    if (!line || !orderIds?.length)
        return;
    if (isRawMessageNoise(line)) return;
    for (const oid of orderIds) {
        // [fix 2026-07-10] 原「SELECT raw → 串接/截斷 → UPDATE」讀改寫在併發下（多實例／Cloud Tasks
        // 重疊投遞／同群組連續訊息）互相蓋寫：後寫者以較舊的 raw 為基底 → 先寫者附加的行遺失，
        // 結單 rebuild 依 raw_message 重建即漏品項（斷單）。改為單句原子 UPDATE：
        // 串接在 DB 端完成（字串串接 || 為 SQLite/PG 皆支援；換行以參數 '\n'+line 傳入避免方言差異）。
        await db.prepare(
            "UPDATE orders SET raw_message = CASE WHEN COALESCE(raw_message, '') = '' THEN ? ELSE raw_message || ? END, updated_at = " + nowSql + " WHERE id = ?"
        ).run(line, "\n" + line, oid);
        // B5：raw_message 累加上限。截斷改為「附加之後」的獨立步驟：先原子附加（絕不遺失），
        // 超限才讀出、於 JS 端算截斷（保尾端，避免 substr 負索引的方言差異），寫回時以
        // 「WHERE raw_message = 讀到的舊值」樂觀鎖防競態——若期間有併發附加則放棄本輪截斷
        // （下次附加會再檢查），確保截斷絕不蓋掉併發新增的行。截斷失敗不影響已附加內容。
        try {
            const row = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(oid);
            const cur = row?.raw_message != null ? String(row.raw_message) : "";
            if (cur.length > RAW_MESSAGE_MAX_CHARS) {
                const tailKeep = Math.floor(RAW_MESSAGE_MAX_CHARS * 0.9);
                const truncated = "[...前段已截斷以避免 token 暴增...]\n" + cur.slice(-tailKeep);
                await db.prepare("UPDATE orders SET raw_message = ?, updated_at = " + nowSql + " WHERE id = ? AND raw_message = ?").run(truncated, oid, cur);
            }
        } catch (e) {
            console.warn("[LINE] raw_message 截斷檢查失敗（不影響已附加內容）orderId=%s: %s", oid, e?.message || e);
        }
    }
}
/** [fix 2026-07-10] LINE 改單/刪項成功時同步寫 order_item_edits 軌跡。
 * 背景：結單整單重辨識（rebuild）會 DELETE 全部品項依 raw_message 重建，而改單指令被
 * isRawMessageNoise 排除在 raw_message 外 → 無軌跡時人工修正會被 rebuild 默默還原
 * （同日客戶再傳訊息重開 session 掛回同單，下次結單再覆寫一次）。
 * rebuild 端（lib/rebuild-order-from-sources.js）於重建後同交易內依 created_at 升冪重放本表。
 * match_key＝「當下該位置品項的 raw_name 快照」正規化（去空白＋小寫，與重放端共用同一實作）；
 * 「改第N項」是位置指令，但位置會因 rebuild 漂移，品名才穩，故存品名快照而非項次。
 * 寫入失敗僅告警不阻斷回覆：此時修改本身已生效，只是結單 rebuild 可能還原（降級而非斷單）。 */
async function recordOrderItemEdit(db, { orderId, action, rawName, quantity, unit, editedBy }) {
    try {
        const editId = (0, id_js_1.newId)("oie");
        const matchKey = (0, rebuild_order_from_sources_js_1.normalizeOrderItemMatchKey)(rawName);
        await db.prepare(
            "INSERT INTO order_item_edits (id, order_id, action, match_key, raw_name, quantity, unit, remark, edited_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)"
        ).run(editId, orderId, action, matchKey, rawName != null ? String(rawName) : null,
              quantity != null && Number.isFinite(Number(quantity)) ? Number(quantity) : null,
              unit != null && String(unit).trim() !== "" ? String(unit).trim() : null,
              editedBy != null && String(editedBy).trim() !== "" ? String(editedBy).trim() : null,
              new Date().toISOString());
    } catch (e) {
        console.warn("[LINE] 改單軌跡寫入失敗（結單 rebuild 可能還原此人工修正）orderId=%s action=%s: %s", orderId, action, e?.message || e);
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
/** B6：客訴／退貨偵測到時推播給管理員 LINE。設定 LINE_MANAGER_USER_ID 才生效。 */
async function notifyManagerOfComplaint(lineClient, payload) {
    const managerId = (process.env.LINE_MANAGER_USER_ID || "").trim();
    if (!managerId || !lineClient) return;
    try {
        const lines = [
            `🚨 偵測到「${payload.intentLabel}」`,
            payload.customerName ? `客戶：${payload.customerName}` : null,
            payload.orderNo ? `對應訂單：${payload.orderNo}` : "無對應訂單（已記錄稽核）",
            `關鍵詞：${(payload.keywords || []).join("、")}`,
            "",
            "原訊息：",
            String(payload.rawText || "").slice(0, 300),
            "",
            "請至後台 /admin/audit 處理。",
        ].filter(Boolean).join("\n");
        await lineClient.pushMessage(managerId, { type: "text", text: lines });
    } catch (e) {
        console.warn("[LINE] 客訴推播管理員失敗:", e?.message || e);
    }
}
/** 機器人加入新群組或在未綁定群組收到訊息時，登錄到待綁定清單供後台一鍵串聯 */
async function upsertPendingLineGroup(db, groupId, sourceType, groupName) {
    if (!groupId)
        return;
    const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
    try {
        // 若該 groupId 已被某客戶綁定，則不再列入待綁定（避免重複出現）
        const bound = await db.prepare("SELECT id FROM customers WHERE line_group_id = ? LIMIT 1").get(groupId);
        if (bound) {
            await db.prepare("DELETE FROM pending_line_groups WHERE group_id = ?").run(groupId);
            return;
        }
        const existing = await db.prepare("SELECT group_id, group_name FROM pending_line_groups WHERE group_id = ?").get(groupId);
        if (existing) {
            // 更新最後出現時間；若取得到群組名稱且原本為空則補上
            const keepName = existing.group_name && String(existing.group_name).trim() !== "" ? existing.group_name : (groupName || null);
            await db.prepare("UPDATE pending_line_groups SET source_type = ?, group_name = ?, last_seen_at = " + nowSql + " WHERE group_id = ?").run(sourceType || null, keepName, groupId);
        }
        else {
            await db.prepare("INSERT INTO pending_line_groups (group_id, source_type, group_name, first_seen_at, last_seen_at) VALUES (?, ?, ?, " + nowSql + ", " + nowSql + ")").run(groupId, sourceType || null, groupName || null);
        }
    }
    catch (e) {
        console.error("[LINE] 寫入待綁定群組失敗:", e?.message || e);
    }
}
/**
 * 訂單號互斥鎖（依 orderDate）：避免單實例內 SELECT+UPDATE 兩段被交錯導致同號。
 * Cloud Run 多實例下仍需 DB 層 UNIQUE 約束才能保證；目前依 LINE 流量規模為單實例運行為主。
 */
const orderNoLockChain = new Map();
async function getNextOrderNo(db, orderDate) {
    const prev = orderNoLockChain.get(orderDate) || Promise.resolve();
    let resolveOuter;
    const cur = new Promise((r) => { resolveOuter = r; });
    orderNoLockChain.set(orderDate, prev.then(() => cur));
    await prev;
    try {
        const nextKey = "order_seq_next_" + orderDate;
        const startKey = "order_seq_start_" + orderDate;
        // [fix 2026-07-08] 原子取號（同 admin getNextOrderNoAdmin）：行程內鎖鏈只擋得住單一實例，
        // 多實例 Cloud Run／與後台同時建單仍會先讀後寫撞號。改用 upsert + RETURNING 讓 DB 端序列化；
        // 失敗（value 非數字等）退回舊邏輯。
        try {
            const startRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(startKey);
            const startSeq0 = startRow && startRow.value ? parseInt(startRow.value, 10) : 1;
            const startSeq = Number.isNaN(startSeq0) ? 1 : Math.max(1, startSeq0);
            const ret = await db.prepare(
                "INSERT INTO app_settings (key, value) VALUES (?, ?) " +
                "ON CONFLICT (key) DO UPDATE SET value = CAST(CAST(app_settings.value AS INTEGER) + 1 AS TEXT) " +
                "RETURNING value"
            ).get(nextKey, String(startSeq + 1));
            const newVal = ret && ret.value != null ? parseInt(String(ret.value), 10) : NaN;
            if (Number.isFinite(newVal) && newVal >= 2) {
                return orderDate.replace(/-/g, "") + String(newVal - 1).padStart(3, "0");
            }
        }
        catch (e) {
            console.warn("[LINE] 原子取號失敗，退回舊邏輯:", e?.message || e);
        }
        let row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(nextKey);
        if (!row || !row.value) {
            row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(startKey);
        }
        const seq = row && row.value ? parseInt(row.value, 10) : 1;
        const nextSeq = Number.isNaN(seq) ? 1 : Math.max(1, seq);
        const orderNo = orderDate.replace(/-/g, "") + String(nextSeq).padStart(3, "0");
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(nextKey, String(nextSeq + 1));
        return orderNo;
    } finally {
        resolveOuter();
        // 清理鏈：當前 promise 結束後若 chain 末端還是自己則移除（避免 leak）
        queueMicrotask(() => {
            if (orderNoLockChain.get(orderDate) === cur || orderNoLockChain.size > 64) {
                // 簡單上限：keep 最近 64 個日期的 chain
                if (orderNoLockChain.size > 64) {
                    const firstKey = orderNoLockChain.keys().next().value;
                    if (firstKey !== undefined && firstKey !== orderDate) orderNoLockChain.delete(firstKey);
                }
            }
        });
    }
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
                deleteCollectSession(db, groupId).catch(()=>{});
                const orderIdsForSession = (session.allOrderIds && session.allOrderIds.length)
                    ? [...new Set(session.allOrderIds)]
                    : [session.orderId];
                if (process.env.LINE_SKIP_FINALIZE_FULL_REBUILD !== "1") {
                    for (const oid of orderIdsForSession) {
                        try {
                            const rawRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(oid);
                            const atts = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(oid);
                            const fr = await (0, rebuild_order_from_sources_js_1.rebuildOrderItemsFromOrderSources)(db, oid, session.customerId, rawRow?.raw_message, atts);
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
                // B1：30 秒結單前先清掉「完全空白」的訂單（0 品項、無 attachments、raw_message 空）
                // 避免後台累積一堆空白訂單。若全部訂單都空則直接結束，不發推播。
                const survivingOrderIds = [];
                for (const oid of orderIdsForSession) {
                    try {
                        const cnt = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ?").get(oid);
                        const attCnt = await db.prepare("SELECT COUNT(*) AS c FROM order_attachments WHERE order_id = ?").get(oid);
                        const ordRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(oid);
                        const hasItems = Number(cnt?.c || 0) > 0;
                        const hasAttachments = Number(attCnt?.c || 0) > 0;
                        const hasRaw = ordRow?.raw_message && String(ordRow.raw_message).trim().length > 0;
                        if (!hasItems && !hasAttachments && !hasRaw) {
                            await db.prepare("DELETE FROM orders WHERE id = ?").run(oid);
                            console.log("[LINE] 結單時清除完全空白訂單 orderId=%s", oid);
                            continue;
                        }
                        survivingOrderIds.push(oid);
                    } catch (e) {
                        console.warn("[LINE] 空訂單清理檢查失敗 orderId=%s err=%s（保留訂單）", oid, e?.message || e);
                        survivingOrderIds.push(oid);
                    }
                }
                if (!survivingOrderIds.length) {
                    console.log("[LINE] 結單時所有訂單皆為空白，已全部刪除，不發推播。");
                    return;
                }
                // 自動收單也要補空籃（與手動收單一致）；放在建摘要之前，讓推播明細就含空籃。
                await insertEmptyBaskets(db, session.customerId, survivingOrderIds);
                const order = await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(survivingOrderIds[0]);
                const dateStr = order?.order_date || getTaipeiOrderDate();
                const orderBlocks = [];
                for (const oid of survivingOrderIds) {
                    const ord = await db.prepare("SELECT order_no, remark FROM orders WHERE id = ?").get(oid);
                    const items = await db.prepare(`
          SELECT oi.raw_name, oi.quantity, oi.unit, oi.remark, p.name AS product_name, p.erp_code
          FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ? ORDER BY oi.id
        `).all(oid);
                    const lines = [];
                    let idx = 1;
                    for (const it of items) {
                        const unit = normalizeOrderUnit(it.unit, "公斤");
                        const name = it.product_name || it.raw_name || "待確認";
                        // remark 以「⚠」開頭＝AI 標記的警示（如照片辨識幾何校驗的「⚠ 字跡跨列（A/B），請確認」），
                        // 收單摘要要讓人看得到：品項行下方縮排帶出警示段（只取 ⚠ 那一段，後續換算備註不重複顯示）。
                        const remarkStr = it.remark != null ? String(it.remark).trim() : "";
                        const warnSuffix = remarkStr.startsWith("⚠") ? `\n　${remarkStr.split(/[；;\n]/)[0].trim()}` : "";
                        lines.push(`${idx}. ${name} ${formatOrderQty(it.quantity)}${unit || ""}${warnSuffix}`);
                        idx += 1;
                    }
                    const hdr = ord?.remark ? `${ord.remark}\n` : "";
                    orderBlocks.push(`【${ord?.order_no ?? oid}】\n${hdr}${lines.length ? lines.join("\n") : "（目前尚無可辨識品項）"}`);
                }
                const multi = survivingOrderIds.length > 1;
                const summary = [
                    multi ? `收到，已收單喔（共 ${survivingOrderIds.length} 張訂單）。` : "收到，已收單喔。",
                    `送貨日期為：${dateStr}`,
                    multi ? "各張訂單明細如下：" : "訂購項目如下：",
                    ...orderBlocks,
                    "",
                    "※ 若內容有誤：可傳「線上改單」查看項次，並傳「改第1項 3 公斤」或「刪第1項」修改（數字請自換）；品名錯誤請洽業務或後台改品項。",
                ].join("\n");
                if (lineClient) {
                    if (!(await (0, line_bot_control_js_1.isLineSuppressCustomerReply)(db))) {
                        await lineClient.pushMessage(groupId, { type: "text", text: summary });
                    }
                    else {
                        console.log("[LINE] 已略過 30 秒結單推播（對客戶靜音） orders=%s", survivingOrderIds.join(","));
                    }
                }
            }
            catch (e) {
                console.error("[LINE] 30 秒自動結單失敗:", e?.message || e);
            }
        }, COLLECT_TIMEOUT_MS);
        autoFinalizeTimers.set(groupId, t);
    };
    /**
     * 10 分鐘訂單確認回覆：群組內最後一則訊息後 N 秒（預設 600）沒有再有新訊息，
     * 對該群組回覆「感謝您的下訂，訂單已成立，訂單編號：XXX」。
     * 預設關閉，由後台 line_order_confirm_reply_enabled 切換。
     */
    const scheduleOrderConfirmReply = async (groupId, session) => {
        if (!groupId || !lineClient) return;
        const old = orderConfirmReplyTimers.get(groupId);
        if (old) clearTimeout(old);
        let enabled = false;
        let delayMs = 600 * 1000;
        try {
            enabled = await (0, line_bot_control_js_1.isOrderConfirmReplyEnabled)(db);
            if (!enabled) return;
            const sec = await (0, line_bot_control_js_1.getOrderConfirmReplyDelaySec)(db);
            delayMs = Math.max(30, Math.min(3600, sec)) * 1000;
        } catch (_) { /* ignore */ }
        const t = setTimeout(async () => {
            try {
                orderConfirmReplyTimers.delete(groupId);
                // 二次確認啟用狀態（避免被關掉後仍送）
                if (!(await (0, line_bot_control_js_1.isOrderConfirmReplyEnabled)(db))) return;
                if (await (0, line_bot_control_js_1.isLineSuppressCustomerReply)(db)) return;
                const orderIds = (session.allOrderIds && session.allOrderIds.length)
                    ? [...new Set(session.allOrderIds)]
                    : [session.orderId];
                const orderNos = [];
                for (const oid of orderIds) {
                    const r = await db.prepare("SELECT order_no FROM orders WHERE id = ?").get(oid);
                    if (r?.order_no) orderNos.push(String(r.order_no));
                }
                if (!orderNos.length) return;
                const text = orderNos.length > 1
                    ? `感謝您的下訂，訂單已成立，訂單編號：\n${orderNos.join("、")}`
                    : `感謝您的下訂，訂單已成立，訂單編號：${orderNos[0]}`;
                await lineClient.pushMessage(groupId, { type: "text", text });
                console.log("[LINE] 已送出 10 分鐘訂單確認回覆 group=%s orders=%s", groupId, orderNos.join(","));
            } catch (e) {
                console.error("[LINE] 10 分鐘訂單確認回覆失敗:", e?.message || e);
            }
        }, delayMs);
        orderConfirmReplyTimers.set(groupId, t);
    };
    async function processLineWebhookEvents(events) {
        for (const event of events) {
            // [fix 2026-07-10] 本則訊息的去重狀態（供 finally 收尾）：
            // curLineMessageId＝訊息 id；ownsLineMessage＝本次執行通過所有去重、實際「佔有」處理權；
            // eventFailed＝外層 catch 捕捉到錯誤。宣告在 try 外，try 內的 continue／throw 都會走到 finally。
            let curLineMessageId = null;
            let ownsLineMessage = false;
            let eventFailed = false;
            try {
                if (event.type === "join" || event.type === "memberJoined") {
                    try {
                        const st = event.source?.type || "";
                        const rawGid = st === "group" ? (event.source.groupId || "") : st === "room" ? (event.source.roomId || "") : "";
                        const gid = rawGid.replace(/\s/g, "").trim();
                        if (gid) {
                            let groupName = null;
                            if (lineClient && st === "group") {
                                try {
                                    const summary = await lineClient.getGroupSummary(gid);
                                    groupName = summary?.groupName || null;
                                }
                                catch (e) {
                                    console.warn("[LINE] 取得群組名稱失敗（將維持空白）:", e?.message || e);
                                }
                            }
                            await upsertPendingLineGroup(db, gid, st, groupName);
                            console.log("[LINE] 機器人加入 %s ID=%s 名稱=%s", st, gid, groupName || "(未取得)");
                        }
                    }
                    catch (e) {
                        console.error("[LINE] join 事件處理失敗:", e?.message || e);
                    }
                    continue;
                }
                if (event.type === "leave" || event.type === "memberLeft") {
                    try {
                        const st = event.source?.type || "";
                        const rawGid = st === "group" ? (event.source.groupId || "") : st === "room" ? (event.source.roomId || "") : "";
                        const gid = rawGid.replace(/\s/g, "").trim();
                        if (gid && event.type === "leave") {
                            // 機器人被踢出時才清除；memberLeft 只是其他成員離開，不處理
                            await db.prepare("DELETE FROM pending_line_groups WHERE group_id = ?").run(gid);
                            console.log("[LINE] 機器人離開 %s ID=%s 已從待綁定清單移除", st, gid);
                        }
                    }
                    catch (e) {
                        console.error("[LINE] leave 事件處理失敗:", e?.message || e);
                    }
                    continue;
                }
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
                                    deleteCollectSession(db, gid).catch(()=>{});
                                    const oldT = autoFinalizeTimers.get(gid);
                                    if (oldT)
                                        clearTimeout(oldT);
                                    autoFinalizeTimers.delete(gid);
                                    const oldC = orderConfirmReplyTimers.get(gid);
                                    if (oldC)
                                        clearTimeout(oldC);
                                    orderConfirmReplyTimers.delete(gid);
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
                curLineMessageId = event.message?.id != null ? String(event.message.id).trim() : null;
                /** LINE Webhook 逾時重試會帶相同 message.id；與程序內記憶體去重並用，跨程序／重啟後仍可靠。拆單時多筆訂單可共用同一 line_message_id，故不做 UNIQUE 約束。 */
                if (curLineMessageId) {
                    const dupByOrder = await db.prepare("SELECT id FROM orders WHERE line_message_id = ? LIMIT 1").get(curLineMessageId);
                    if (dupByOrder) {
                        console.log("[LINE] 偵測到重複的 messageId，略過處理");
                        continue;
                    }
                }
                // [fix 2026-07-10] 持久化去重改為「完成才 INSERT」反轉語意（原為入口先 INSERT）：
                // 舊作法在入口就把 message_id 寫進 processed_line_messages，之後任何一步拋錯被外層
                // catch 吞掉後，LINE redelivery 帶同 message.id 再進來會命中去重被略過 → 該訊息永久斷單。
                // processed_line_messages 只有 message_id + processed_at 兩欄（不動 schema 的前提下無法存
                // processing 狀態／租約時間戳做「先標記＋逾時接手」），故採反轉語意：
                //   1) 入口 SELECT 命中＝先前已「成功」處理完 → 略過；
                //   2) 處理成功（含 try 內各 continue 正常結束路徑）→ finally 才 INSERT 完成標記；
                //   3) 處理失敗 → 不落完成標記＋釋放記憶體去重 → redelivery 可完整重跑。
                // 取捨：跨實例「同時」處理同一訊息的極短併發窗口不再被 DB 擋（INSERT-first 擋得住、
                // SELECT-first 擋不住），由既有記憶體 Set（同實例併發）＋ orders.line_message_id
                // （建單訊息）補位；LINE redelivery 間隔以分鐘計，實務重疊機率遠低於「拋錯即永久斷單」。
                if (curLineMessageId) {
                    try {
                        const doneRow = await db.prepare("SELECT message_id FROM processed_line_messages WHERE message_id = ?").get(curLineMessageId);
                        if (doneRow) {
                            console.log("[LINE] 持久化去重命中（processed_line_messages，已成功處理過），略過重複訊息 messageId=%s", curLineMessageId);
                            continue;
                        }
                    } catch (e) {
                        // 去重表查詢失敗不可阻斷正常收單（放行；仍有記憶體 Set + dupByOrder 兩層防護）
                        console.warn("[LINE] 持久化去重查詢失敗（放行）messageId=%s: %s", curLineMessageId, e?.message || e);
                    }
                }
                if (!consumeLineWebhookMessageOnce(event.message?.id)) {
                    console.log("[LINE] 略過重複訊息（同 message.id），避免重複建品項");
                    continue;
                }
                // 通過全部去重＝本次執行佔有此訊息處理權；finally 依成敗標記完成／釋放
                ownsLineMessage = Boolean(curLineMessageId);
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
                // 群組功能白名單（辨識訂單／盤點／空籃），單次查詢後記憶，供本則訊息各閘門共用。無設定＝三項全開。
                let _groupFeat = null;
                const getGroupFeat = async () => {
                    if (_groupFeat) return _groupFeat;
                    _groupFeat = groupId ? await (0, group_features_js_1.getGroupFeatures)(db, groupId) : { order: true, stocktake: true, basket: true };
                    return _groupFeat;
                };
                /** 休眠：非收單時段不跑 OCR／Gemini／訂單；僅允許「取得群組ID」（無 AI） */
                let textEarly = null;
                if (msgType === "text" && event.message.text) {
                    textEarly = String(event.message.text).trim();
                }
                if (groupId && textEarly && (textEarly === "取得群組ID" || textEarly === "群組ID")) {
                    await reply(lineClient, event.replyToken, `此群組/聊天室 ID：\n${groupId}\n請將此 ID 提供給管理員，在後台「客戶管理」編輯該客戶的「LINE 群組 ID」並儲存。`, db, { force: true });
                    continue;
                }
                // G14：取得自己的 LINE userId（用來填 Cloud Run 的 LINE_MANAGER_USER_ID）
                if (textEarly && (textEarly === "我的userId" || textEarly === "我的UserId" || textEarly === "我的USERID" || textEarly === "my userId" || textEarly === "myUserId")) {
                    const uid = event.source?.userId;
                    if (uid) {
                        await reply(lineClient, event.replyToken,
                            `您的 LINE userId：\n${uid}\n\n請複製此 ID 給管理員，在 Cloud Run 設定 LINE_MANAGER_USER_ID 環境變數，未來客訴/退貨偵測會推播給此 userId。`,
                            db, { force: true });
                    } else {
                        await reply(lineClient, event.replyToken, "無法取得您的 userId（請在私訊本機器人時傳此指令）。", db, { force: true });
                    }
                    continue;
                }
                // ── 員工 LINE 綁定指令處理（私訊／群組皆可）──────────────────
                const senderUserId = event.source?.userId || null;
                if (msgType === "text" && textEarly && senderUserId) {
                    const code = (0, employee_line_binding_js_1.parseBindCommand)(textEarly);
                    if (code) {
                        const p = await (0, employee_line_binding_js_1.consumeBindCode)(db, code);
                        if (!p) {
                            await reply(lineClient, event.replyToken, "綁定碼無效或已過期。請回到後台 /admin/users 重新產生。", db, { force: true });
                        } else {
                            try {
                                await (0, employee_line_binding_js_1.bindLineUserIdToEmployee)(db, p.username, senderUserId, null);
                                await (0, line_bot_control_js_1.appendLineBotLog)(db, "employee_bound", { username: p.username, lineUserId: senderUserId.slice(0, 8) + "…" });
                                await reply(lineClient, event.replyToken, `✅ 已綁定員工帳號 ${p.username}\n您在群組內傳訊息將不再觸發 AI 解析，僅記錄在稽核軌跡中。\n如需解綁請聯絡管理員。`, db, { force: true });
                            } catch (e) {
                                await reply(lineClient, event.replyToken, "綁定失敗：" + (e?.message || e), db, { force: true });
                            }
                        }
                        continue;
                    }
                }
                // ── 空籃觸發詞 → 回 LIFF 連結（早期攔截：先於員工身份偵測） ─────────
                // 空籃功能為白名單制：群組關閉「空籃」時，「空籃」視為一般文字（不攔截、往下走）。
                if (groupId && msgType === "text" && textEarly && (0, basket_log_js_1.isBasketTrigger)(textEarly) && (await getGroupFeat()).basket) {
                    try {
                        // 查群組綁定客戶
                        const allActiveBsk = await db.prepare("SELECT id, name, line_group_id FROM customers WHERE (active IS NULL OR active = 1)").all();
                        const fullwidthToHalfBsk = (s) => s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
                        const normBsk = (s) => fullwidthToHalfBsk((s || "").replace(/\s/g, "")).toLowerCase();
                        const needleBsk = normBsk(groupId);
                        const bskCustomer = allActiveBsk.find((r) => normBsk(r.line_group_id) === needleBsk) || null;
                        if (!bskCustomer) {
                            if (lineClient && event.replyToken) {
                                try { await lineClient.replyMessage(event.replyToken, { type: "text", text: "此群組尚未綁定客戶，無法記錄空籃。請先在後台「客戶管理」將本群組 ID 綁定客戶。" }); } catch (_) {}
                            }
                            continue;
                        }
                        const nowTwBsk = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
                        const bskLogDate = nowTwBsk.toISOString().slice(0, 10);
                        const liffId = (process.env.LIFF_ID_BASKET_LOG || "").trim();
                        if (!liffId) {
                            if (lineClient && event.replyToken) {
                                try { await lineClient.replyMessage(event.replyToken, { type: "text", text: "空籃記帳 LIFF 尚未設定（LIFF_ID_BASKET_LOG）。請聯絡管理員。" }); } catch (_) {}
                            }
                            continue;
                        }
                        const liffUrl = (0, basket_log_js_1.buildLiffEntryUrl)(liffId, { customerId: bskCustomer.id, date: bskLogDate });
                        if (lineClient && event.replyToken) {
                            try {
                                // Flex Message：精簡卡片（micro size）— 客戶名 + 日期 + 按鈕
                                const flexBubble = {
                                    type: "flex",
                                    altText: `${bskCustomer.name} 空籃記帳 ${bskLogDate}`,
                                    contents: {
                                        type: "bubble",
                                        size: "micro",
                                        body: {
                                            type: "box",
                                            layout: "vertical",
                                            spacing: "xs",
                                            paddingAll: "12px",
                                            contents: [
                                                { type: "text", text: `📦 ${bskCustomer.name}`, size: "sm", weight: "bold", color: "#1d4ed8", wrap: true },
                                                { type: "text", text: bskLogDate, size: "xxs", color: "#9b9a97" },
                                                {
                                                    type: "button",
                                                    style: "primary",
                                                    color: "#1d4ed8",
                                                    height: "sm",
                                                    margin: "sm",
                                                    action: { type: "uri", label: "點此記帳", uri: liffUrl },
                                                },
                                            ],
                                        },
                                    },
                                };
                                await lineClient.replyMessage(event.replyToken, flexBubble);
                            } catch (e) { console.warn("[LINE] 空籃 LIFF 卡片回覆失敗:", e?.message || e); }
                        }
                        console.log("[LINE] 空籃 LIFF 連結已回 customer=%s date=%s", bskCustomer.id, bskLogDate);
                        continue;
                    } catch (e) {
                        console.error("[LINE] 空籃觸發處理失敗:", e?.message || e);
                        try {
                            if (lineClient && event.replyToken) await lineClient.replyMessage(event.replyToken, { type: "text", text: "空籃指令處理失敗，請稍後再試或聯絡管理員。" });
                        } catch (_) { /* replyToken 可能已逾時 */ }
                        continue;
                    }
                }
                // ── #盤點 指令：僅限開啟「盤點」功能的群組 ──
                if (groupId && msgType === "text" && textEarly && textEarly.replace(/\s/g, "") === "#盤點") {
                    try {
                        if (!(await getGroupFeat()).stocktake) {
                            // 未開啟盤點功能：靜默略過（不回覆、不進 AI 解析）
                            console.log("[LINE] #盤點 於未開啟盤點功能的群組略過 group=%s", groupId);
                            continue;
                        }
                        const stkLiffId = (process.env.LIFF_ID_STOCKTAKE || "2010106501-VocNwkbA").trim();
                        const whRows = await db.prepare("SELECT code, name, sort_order FROM erp_warehouse WHERE include_stocktake = 1 ORDER BY sort_order, code").all();
                        if (!whRows || whRows.length === 0) {
                            if (lineClient && event.replyToken) {
                                try { await lineClient.replyMessage(event.replyToken, { type: "text", text: "目前沒有納入盤點的倉庫。請先到後台『庫存管理 → 倉庫設定』勾選要盤點的倉庫。" }); } catch (_) {}
                            }
                            continue;
                        }
                        const nowTwStk = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
                        const stkDate = nowTwStk.toISOString().slice(0, 10);
                        const whLabel = (w) => { const s = String(w.name || w.code || "").trim(); return s.length > 18 ? s.slice(0, 18) : s; };
                        const shown = whRows.slice(0, 11);
                        const btns = shown.map((w) => ({
                            type: "button", style: "secondary", height: "sm", margin: "sm",
                            action: { type: "uri", label: whLabel(w), uri: `https://liff.line.me/${stkLiffId}?warehouse=${encodeURIComponent(String(w.code))}` },
                        }));
                        // 一律附「全部倉庫」按鈕（開啟選單頁），若倉庫數超過顯示上限也可從此進入
                        btns.push({
                            type: "button", style: "primary", color: "#1d4ed8", height: "sm", margin: "md",
                            action: { type: "uri", label: whRows.length > shown.length ? `其他倉庫（共 ${whRows.length}）` : "開啟盤點選單", uri: `https://liff.line.me/${stkLiffId}` },
                        });
                        if (lineClient && event.replyToken) {
                            try {
                                await lineClient.replyMessage(event.replyToken, {
                                    type: "flex",
                                    altText: `松富盤點 ${stkDate}`,
                                    contents: {
                                        type: "bubble", size: "kilo",
                                        body: {
                                            type: "box", layout: "vertical", spacing: "xs", paddingAll: "14px",
                                            contents: [
                                                { type: "text", text: "📋 松富盤點", size: "md", weight: "bold", color: "#1d4ed8" },
                                                { type: "text", text: `盤點日 ${stkDate} · 選擇倉庫`, size: "xxs", color: "#9b9a97", margin: "xs" },
                                                { type: "separator", margin: "md" },
                                                ...btns,
                                            ],
                                        },
                                    },
                                });
                            } catch (e) { console.warn("[LINE] #盤點 卡片回覆失敗:", e?.message || e); }
                        }
                        console.log("[LINE] #盤點 已回倉庫按鈕 group=%s 倉數=%s", groupId, whRows.length);
                        continue;
                    } catch (e) {
                        console.error("[LINE] #盤點 處理失敗:", e?.message || e);
                        try { if (lineClient && event.replyToken) await lineClient.replyMessage(event.replyToken, { type: "text", text: "盤點指令處理失敗，請稍後再試。" }); } catch (_) {}
                        continue;
                    }
                }
                // ── 訂單辨識白名單：關閉「辨識訂單」的群組不把文字送進 AI 解析、也不回「無法收單」──
                // 前面的明確指令（#盤點／取得群組ID／員工綁定／空籃等）與 LIFF 已各自處理完並 continue，
                // 故關閉訂單辨識＝機器人仍收訊息、仍回應指令，只是不把一般文字當訂單。此開關對已綁客戶的群組同樣生效。
                if (groupId && !(await getGroupFeat()).order) {
                    console.log("[LINE] 群組關閉訂單辨識，略過訂單解析 group=%s msgType=%s", groupId, msgType);
                    continue;
                }
                // ── 員工身份偵測：若 senderUserId 是員工，跳過 AI 解析，只記錄 ──
                if (senderUserId) {
                    try {
                        const emp = await (0, employee_line_binding_js_1.findEmployeeByLineUserId)(db, senderUserId);
                        if (emp) {
                            const textRaw = msgType === "text" ? String(event.message.text || "") : "";
                            const preview = msgType === "text" ? textRaw.slice(0, 200) : `[${msgType}]`;
                            await (0, line_bot_control_js_1.appendLineBotLog)(db, "internal_employee_message", {
                                username: emp.username,
                                title: emp.title,
                                groupId: groupId || null,
                                msgType,
                                preview,
                            });
                            console.log("[LINE] 偵測到員工訊息（%s），跳過 AI 解析。msgType=%s", emp.username, msgType);
                            // 同事回覆寫進對話紀錄（訂單審核頁會以「同事」樣式＋姓名顯示）。
                            // 掛單順序：收單中 session 的訂單 → 該群綁定客戶今天的訂單 → 群組層級（order_id NULL）。
                            if (groupId) {
                                try {
                                    await (0, line_conversation_js_1.upsertGroupSpeaker)(db, lineClient, groupId, senderUserId, emp.name || emp.username);
                                    if (msgType === "text" && textRaw.trim()) {
                                        const convoSession = collectingByGroup.get(groupId);
                                        let convoOrderIds = (convoSession?.allOrderIds && convoSession.allOrderIds.length) ? [...new Set(convoSession.allOrderIds)] : (convoSession?.orderId ? [convoSession.orderId] : []);
                                        let convoCustomerId = convoSession?.customerId || null;
                                        if (!convoOrderIds.length) {
                                            const custRow = await db.prepare("SELECT id FROM customers WHERE TRIM(COALESCE(line_group_id, '')) = ? AND (active IS NULL OR active = 1)").get(groupId);
                                            if (custRow) {
                                                convoCustomerId = custRow.id;
                                                const todays = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ?").all(custRow.id, getTaipeiOrderDate());
                                                convoOrderIds = (todays || []).map((r) => r.id);
                                            }
                                        }
                                        await (0, line_conversation_js_1.logConversation)(db, {
                                            groupId,
                                            customerId: convoCustomerId,
                                            orderIds: convoOrderIds,
                                            senderKind: "employee",
                                            senderLineUserId: senderUserId,
                                            senderName: emp.name || emp.username,
                                            msgType: "text",
                                            text: textRaw,
                                        });
                                    }
                                } catch (e) {
                                    console.warn("[LINE] 同事對話記錄失敗:", e?.message || e);
                                }
                            }
                            // 員工關鍵字：選單／功能／menu／liff → 回覆功能選單（reply 免費，不計費）
                            if (msgType === "text" && isEmployeeMenuKeyword(textRaw)) {
                                try {
                                    if (lineClient && event.replyToken) {
                                        await lineClient.replyMessage(event.replyToken, buildEmployeeMenuFlex(emp));
                                        console.log("[LINE] 員工功能選單已回覆給 %s", emp.username);
                                    }
                                } catch (e) {
                                    console.warn("[LINE] 員工功能選單回覆失敗:", e?.message || e);
                                }
                            }
                            continue;
                        }
                    } catch (e) {
                        console.warn("[LINE] 員工身份檢查失敗:", e?.message || e);
                    }
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
                /** 未綁定客戶的群組／聊天室：登錄到待綁定清單，後台「客戶管理」會列出供一鍵串聯 */
                if (groupId && !customer) {
                    let pendingName = null;
                    if (lineClient && sourceType === "group") {
                        try {
                            const summary = await lineClient.getGroupSummary(groupId);
                            pendingName = summary?.groupName || null;
                        }
                        catch (_) { /* 取不到名稱不影響登錄 */ }
                    }
                    await upsertPendingLineGroup(db, groupId, sourceType, pendingName);
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
                    // [fix 2026-07-08] 原本在此算 inCollecting 布林，但長 await 後 session 可能已被結單，改在解析後重新取 session（見下方 liveSession），此處不再預判。
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
                            else {
                                // [fix 2026-07-08] 原本非 2xx 完全靜默，圖片下載 404/410/5xx 無跡可查；補 log 方便追。
                                console.warn("[LINE] 圖片下載非 2xx status=%s messageId=%s（imageBuf 為空，將僅存附件/繼續）", imgResp.status, messageId);
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
                    const { parsed: parsedFromImg, ocrText } = await (0, parse_order_from_image_js_1.parseOrderItemsFromImageBuffer)(imageBuf, fallbackUnitImg, imgParseOpts);
                    // [fix 2026-07-08] OCR+Gemini 解析可能耗時 10-40 秒，期間 30 秒自動結單可能已把本群組 session 刪掉。
                    // 不能再用解析前算的 inCollecting 布林 + 直接讀 session.orderId（session 可能已是 undefined → TypeError，整張照片全遺失，且 message.id 已被 consume 導致 LINE 重送也略過）。
                    // 改為解析後「重新」取 session；仍在則走收單累加分支，並更新 lastActivity + 重排 finalize 計時器避免解析中被結單；不在則往下走「未收單新建」分支。
                    const liveSession = groupId ? collectingByGroup.get(groupId) : null;
                    if (liveSession) {
                        const session = liveSession;
                        session.lastActivity = Date.now();
                        persistCollectSession(db, groupId, session).catch(()=>{});
                        scheduleAutoFinalize(groupId, session);
                        scheduleOrderConfirmReply(groupId, session).catch(()=>{});
                        const ocrLine = ocrText || "[圖片]";
                        const orderDateVal = (await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(session.orderId))?.order_date || getTaipeiOrderDate();
                        const baseRawRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(session.orderId);
                        const newRawAppend = (baseRawRow?.raw_message ? baseRawRow.raw_message + "\n" : "") + ocrLine;
                        if (parsedFromImg.length > 0 && mustSplitOrdersBySubCustomer(parsedFromImg)) {
                            const map = groupParsedItemsBySubCustomer(parsedFromImg);
                            // [fix 2026-07-10] 拆單前先把當日 NULL 主訂單標成 '' 桶（rebuild 過濾語意見 helper 註解），
                            // 並改為「找到或建立」同日同子客戶訂單：同子客戶多則訊息不再各開一張新單。
                            await markSameDayMainOrdersAsSplitBase(db, session.customerId, orderDateVal, nowSql);
                            const touchedOrderIds = [];
                            for (const [subKey, items] of map) {
                                // [fix 2026-07-08] 新建子單 raw_message 只放本次 OCR，不繼承主訂單既有 raw，
                                // 否則結單 rebuild 時主訂單既有品項會落入拆單主客戶桶造成跨單重複。
                                const { orderId: oid, created } = await findOrCreateSplitTargetOrder(db, getNextOrderNo, nowSql, {
                                    customerId: session.customerId,
                                    orderDate: orderDateVal,
                                    groupId,
                                    subKey,
                                    rawMessage: ocrLine,
                                    lineMessageId: curLineMessageId,
                                });
                                if (!created)
                                    await appendRawLineToOrders(db, [oid], ocrLine, nowSql);
                                touchedOrderIds.push(oid);
                                await duplicateAttachmentToOrders(db, messageId, [oid], nowSql);
                                await insertParsedItemsForOrder(db, oid, session.customerId, items, fallbackUnitImg);
                            }
                            mergeSessionOrderIds(session, touchedOrderIds);
                            if (lineClient && map.size > 1) {
                                await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${map.size} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db);
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
                        // [fix 2026-07-08] 累加品項的同日訂單查詢須排除作廢(deleted)/客訴(complaint)軟刪除單，否則員工作廢後客戶再叫貨會附加進作廢單→漏出貨；並加 ORDER BY order_no 讓拆單後多張同日單附加到穩定的第一張。
                        let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").get(customer.id, orderDate);
                        const ocrLine = ocrText || "[圖片]";
                        if (parsedFromImg.length > 0 && mustSplitOrdersBySubCustomer(parsedFromImg)) {
                            const map = groupParsedItemsBySubCustomer(parsedFromImg);
                            // [fix 2026-07-10] 拆單前先把當日 NULL 主訂單標成 '' 桶，並改為「找到或建立」
                            // 同日同子客戶訂單：同子客戶多則訊息不再各開一張新單。
                            await markSameDayMainOrdersAsSplitBase(db, customer.id, orderDate, nowSql);
                            const touchedOrderIds = [];
                            let mainBucketOrderId = null;
                            for (const [subKey, items] of map) {
                                // [fix 2026-07-08] 新建子單 raw_message 只放本次 OCR 內容，不要繼承既有同日訂單的 raw。
                                // 原本併入 orderRow.raw_message → 結單 rebuild 時舊訂單品項（subCustomer 空）會落入新拆單的主客戶桶，造成跨單重複出貨。
                                const { orderId: oid, created } = await findOrCreateSplitTargetOrder(db, getNextOrderNo, nowSql, {
                                    customerId: customer.id,
                                    orderDate,
                                    groupId,
                                    subKey,
                                    rawMessage: ocrLine,
                                    lineMessageId: curLineMessageId,
                                });
                                if (!created)
                                    await appendRawLineToOrders(db, [oid], ocrLine, nowSql);
                                if (subKey === "")
                                    mainBucketOrderId = oid;
                                touchedOrderIds.push(oid);
                                await duplicateAttachmentToOrders(db, messageId, [oid], nowSql);
                                await insertParsedItemsForOrder(db, oid, customer.id, items, fallbackUnitImg);
                            }
                            if (groupId) {
                                // session.orderId 優先掛主客戶桶：後續無子客戶標記的訊息會累加到這張
                                const session = { orderId: mainBucketOrderId || touchedOrderIds[0], allOrderIds: touchedOrderIds.slice(), customerId: customer.id, lastActivity: Date.now() };
                                collectingByGroup.set(groupId, session);
                                persistCollectSession(db, groupId, session).catch(()=>{});
                                scheduleAutoFinalize(groupId, session);
                                scheduleOrderConfirmReply(groupId, session).catch(()=>{});
                            }
                            if (lineClient && map.size > 1) {
                                await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${map.size} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db);
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
                                persistCollectSession(db, groupId, session).catch(()=>{});
                                scheduleAutoFinalize(groupId, session);
                                scheduleOrderConfirmReply(groupId, session).catch(()=>{});
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
                // ── 空籃指令舊位置已移至員工偵測前的早期攔截（L644 附近），改為 LIFF；此處不再處理 ──
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
                    if (!rest) {
                        // [fix 2026-07-08] 排除作廢/客訴軟刪除單並加 ORDER BY，避免累加進作廢單、附加到不穩定的任意單。
                        let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").get(customerId, orderDate);
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
                            persistCollectSession(db, groupId, session).catch(()=>{}); // [fix 2026-07-08] 補持久化，Cloud Run 重啟後可恢復 session
                            scheduleAutoFinalize(groupId, session);
                                scheduleOrderConfirmReply(groupId, session).catch(()=>{});
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
                        // [fix 2026-07-10] 拆單前先把當日 NULL 主訂單標成 '' 桶，並改為「找到或建立」
                        // 同日同子客戶訂單：同子客戶多則訊息不再各開一張新單。
                        await markSameDayMainOrdersAsSplitBase(db, customerId, orderDate, nowSql);
                        const touchedOrderIds = [];
                        let mainBucketOrderId = null;
                        for (const [subKey, items] of map) {
                            const { orderId: oid, created } = await findOrCreateSplitTargetOrder(db, getNextOrderNo, nowSql, {
                                customerId,
                                orderDate,
                                groupId,
                                subKey,
                                rawMessage: lineForRaw,
                                lineMessageId: curLineMessageId,
                            });
                            if (!created && lineForRaw)
                                await appendRawLineToOrders(db, [oid], lineForRaw, nowSql);
                            if (subKey === "")
                                mainBucketOrderId = oid;
                            touchedOrderIds.push(oid);
                            await insertParsedItemsForOrder(db, oid, customerId, items, fallbackUnit);
                        }
                        if (groupId) {
                            // session.orderId 優先掛主客戶桶：後續無子客戶標記的訊息會累加到這張
                            const session = { orderId: mainBucketOrderId || touchedOrderIds[0], allOrderIds: touchedOrderIds.slice(), customerId, lastActivity: Date.now() };
                            collectingByGroup.set(groupId, session);
                            persistCollectSession(db, groupId, session).catch(()=>{}); // [fix 2026-07-08] 補持久化，Cloud Run 重啟後可恢復 session
                            scheduleAutoFinalize(groupId, session);
                                scheduleOrderConfirmReply(groupId, session).catch(()=>{});
                        }
                        if (lineClient && map.size > 1) {
                            await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${map.size} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db);
                        }
                        continue;
                    }
                    // [fix 2026-07-08] 排除作廢/客訴軟刪除單並加 ORDER BY，避免累加進作廢單、附加到不穩定的任意單。
                    let orderRow = await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").get(customerId, orderDate);
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
                        persistCollectSession(db, groupId, session).catch(()=>{}); // [fix 2026-07-08] 補持久化，Cloud Run 重啟後可恢復 session
                        scheduleAutoFinalize(groupId, session);
                                scheduleOrderConfirmReply(groupId, session).catch(()=>{});
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
                    // [fix 2026-07-08] 查詢供顯示的今日訂單須排除作廢/客訴軟刪除單，並加 ORDER BY 取穩定的第一張。
                    const orderRow = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").get(customerId, orderDate);
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
                // [fix 2026-07-08] 線上改單目標訂單須排除作廢/客訴軟刪除單（不該讓客戶改到已作廢的單），並加 ORDER BY 取穩定的第一張。
                const orderRowForEdit = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").get(customerId, orderDate);
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
                            // [fix 2026-07-10] 記錄刪項軌跡供結單 rebuild 重放；match_key 存被刪品項的 raw_name 快照（品名穩、位置會漂移）
                            await recordOrderItemEdit(db, {
                                orderId: orderRowForEdit.id,
                                action: "delete",
                                rawName: t.raw_name || t.product_name || "",
                                quantity: null,
                                unit: null,
                                editedBy: senderUserId,
                            });
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
                            // [fix 2026-07-10] 記錄改量軌跡供結單 rebuild 重放；match_key 存該位置品項的 raw_name 快照（品名穩、位置會漂移）
                            await recordOrderItemEdit(db, {
                                orderId: orderRowForEdit.id,
                                action: "set",
                                rawName: t.raw_name || t.product_name || "",
                                quantity: qtyNew,
                                unit: unitNew,
                                editedBy: senderUserId,
                            });
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
                        deleteCollectSession(db, groupId).catch(()=>{});
                        const oldTimer = autoFinalizeTimers.get(groupId);
                        if (oldTimer)
                            clearTimeout(oldTimer);
                        autoFinalizeTimers.delete(groupId);
                        // 「以上 X 收單」屬於主動結單，10 分鐘訂單編號回覆仍要照常排程，
                        // 因為使用者結束輸入後 10 分鐘確認回覆才有意義；不在此清除 orderConfirmReplyTimers。
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
                        await insertEmptyBaskets(db, session.customerId, doneOrderIds);
                        const orderInfo = await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(session.orderId);
                        // 計算所有 doneOrderIds 的品項總數（含空籃；空籃 quantity=0 也計入筆數）
                        let totalItems = 0;
                        for (const oid of doneOrderIds) {
                            const c = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ? AND quantity > 0").get(oid);
                            totalItems += Number(c?.c || 0);
                        }
                        const dateStr = orderInfo?.order_date || getTaipeiOrderDate();
                        const weekdays = "日一二三四五六";
                        const dayIdx = new Date(dateStr + "T12:00:00").getDay();
                        const weekday = "星期" + weekdays[dayIdx];
                        console.log("[LINE] 手動關單完成 date=%s count=%s %s", dateStr, totalItems, weekday);
                        // B3：「以上 X 收單」校驗 X vs 實際品項數，差異大則回覆提醒員工
                        if (aboveMatch && lineClient) {
                            const claimedRaw = String(aboveMatch[1]).replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));
                            const claimed = parseInt(claimedRaw, 10);
                            if (Number.isFinite(claimed) && Math.abs(claimed - totalItems) >= 2) {
                                try {
                                    if (!(await (0, line_bot_control_js_1.isLineSuppressCustomerReply)(db))) {
                                        await lineClient.pushMessage(groupId, {
                                            type: "text",
                                            text: `提醒：您寫「以上 ${claimed} 收單」，但我們目前辨識到 ${totalItems} 項。請對照 30 秒後的訂單明細確認，有缺漏可傳「線上改單」修改。`,
                                        });
                                    }
                                } catch (e) {
                                    console.warn("[LINE] 以上X收單 提醒推播失敗:", e?.message || e);
                                }
                            }
                        }
                    }
                    else {
                        console.log("[LINE] 手動關單但目前無 session");
                    }
                    continue;
                }
                if (groupId && collectingByGroup.has(groupId)) {
                    const session = collectingByGroup.get(groupId);
                    session.lastActivity = Date.now();
                    persistCollectSession(db, groupId, session).catch(()=>{});
                    scheduleAutoFinalize(groupId, session);
                                scheduleOrderConfirmReply(groupId, session).catch(()=>{});
                }
                // 客訴／退貨：在「自動開單」之前先攔截，避免憑空生出今日 0 品項訂單
                if (!collectingByGroup.has(groupId)) {
                    const earlyIntent = detectCustomerIntent(text);
                    if (earlyIntent.intent === "complaint" || earlyIntent.intent === "return_request") {
                        try {
                            const todayDate = getTaipeiOrderDate();
                            // [fix 2026-07-08] 語義不同於「累加品項」：此處要找「有效訂單」來標記客訴，
                            // 故只排除 'deleted'（不可對作廢單標客訴），但**不排除** 'complaint'——
                            // 否則同一客戶第二則客訴訊息會找不到已標客訴的單而誤跑 fallback。
                            let target = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') <> 'deleted' ORDER BY order_no").get(customerId, todayDate);
                            if (!target) {
                                // 沒今天訂單就找該客戶最後一張訂單作為投訴對象（不限日期，避免方言差異）；同樣只排除作廢單。
                                target = await db.prepare(
                                    "SELECT id FROM orders WHERE customer_id = ? AND COALESCE(LOWER(TRIM(status)),'') <> 'deleted' ORDER BY order_date DESC, updated_at DESC LIMIT 1"
                                ).get(customerId);
                            }
                            const dclId = "dcl_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
                            if (target?.id) {
                                await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + " WHERE id = ?").run("complaint", target.id);
                                await db.prepare(
                                    "INSERT INTO data_change_log (id, entity_type, entity_id, action, summary, meta_json, actor_username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, " + nowSql + ")"
                                ).run(dclId, "order", target.id, "auto_create_complaint",
                                      `自動偵測「${earlyIntent.intent === "return_request" ? "退貨" : "客訴"}」關鍵詞 [${earlyIntent.keywords.join(",")}]（附加到既有訂單，非新建）`,
                                      JSON.stringify({ intent: earlyIntent.intent, matched_keywords: earlyIntent.keywords, raw_text: text.slice(0, 500), source: "auto_intent_early" }),
                                      "system:intent_detector");
                                console.log("[LINE] 早期客訴偵測：附加到既有訂單 " + target.id);
                                const ordInfo = await db.prepare("SELECT order_no FROM orders WHERE id = ?").get(target.id);
                                notifyManagerOfComplaint(lineClient, {
                                    intentLabel: earlyIntent.intent === "return_request" ? "退貨" : "客訴",
                                    customerName: customer?.name || null,
                                    orderNo: ordInfo?.order_no || null,
                                    keywords: earlyIntent.keywords,
                                    rawText: text,
                                }).catch(()=>{});
                            } else {
                                // 完全找不到歷史訂單：只寫 audit，不建空白訂單
                                await db.prepare(
                                    "INSERT INTO data_change_log (id, entity_type, entity_id, action, summary, meta_json, actor_username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, " + nowSql + ")"
                                ).run(dclId, "customer", customerId, "complaint_no_target_order",
                                      `偵測到「${earlyIntent.intent === "return_request" ? "退貨" : "客訴"}」但客戶無近期訂單，僅記錄稽核`,
                                      JSON.stringify({ intent: earlyIntent.intent, matched_keywords: earlyIntent.keywords, raw_text: text.slice(0, 500), source: "auto_intent_early_no_order" }),
                                      "system:intent_detector");
                                console.log("[LINE] 早期客訴偵測：客戶無近期訂單，僅寫稽核");
                                notifyManagerOfComplaint(lineClient, {
                                    intentLabel: earlyIntent.intent === "return_request" ? "退貨" : "客訴",
                                    customerName: customer?.name || null,
                                    orderNo: null,
                                    keywords: earlyIntent.keywords,
                                    rawText: text,
                                }).catch(()=>{});
                            }
                        } catch (e) {
                            console.warn("[LINE] 早期客訴標記失敗:", e?.message || e);
                        }
                        continue;
                    }
                }
                // === Feature B：訂單意圖關卡（opt-in，預設關閉）===
                // 在「自動開單」之前，先用便宜的分類器判斷這則文字是不是真的在叫貨。
                // 只在「尚未開單」且「關鍵字意圖未命中」時跑；高信心判定為詢問/閒聊才攔下，
                // 避免憑空開一張 0 品項訂單並在 10 分鐘後回「訂單已成立」。
                // 安全預設：分類器不確定／失敗一律放行，絕不漏接真訂單。需 LINE_INTENT_GATE=1 啟用。
                if (process.env.LINE_INTENT_GATE === "1" && groupId && !collectingByGroup.has(groupId)) {
                    const kwPre = detectCustomerIntent(text);
                    if (!kwPre.intent) {
                        let verdict = null;
                        try {
                            verdict = await require("../lib/order-intent-gate.js").classifyOrderIntent(text, { db, customerId });
                        } catch (e) {
                            console.warn("[LINE] 意圖關卡失敗（放行當訂單）:", e?.message || e);
                        }
                        if (verdict && verdict.isOrder === false) {
                            const kindLabel = verdict.kind === "chat" ? "閒聊" : "詢問";
                            console.log("[LINE] 意圖關卡：判定為「%s」(信心%s,%s) → 不開單，僅通知/記錄", kindLabel, verdict.confidence, verdict.via);
                            try {
                                const dclId = "dcl_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
                                await db.prepare(
                                    "INSERT INTO data_change_log (id, entity_type, entity_id, action, summary, meta_json, actor_username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, " + nowSql + ")"
                                ).run(dclId, "customer", customerId, "intent_gate_non_order",
                                      `意圖關卡判定「${kindLabel}」(信心${verdict.confidence})，未開單`,
                                      JSON.stringify({ kind: verdict.kind, confidence: verdict.confidence, via: verdict.via, raw_text: text.slice(0, 500), source: "intent_gate" }),
                                      "system:intent_gate");
                            } catch (_) {}
                            // 通知管理員有一則未處理詢問（沿用客訴推播管道，標籤改為詢問/閒聊；未設 LINE_MANAGER_USER_ID 則自動略過）
                            notifyManagerOfComplaint(lineClient, {
                                intentLabel: kindLabel,
                                customerName: customer?.name || null,
                                orderNo: null,
                                keywords: [],
                                rawText: text,
                            }).catch(()=>{});
                            // 雖不開單，仍寫進對話紀錄（掛到今天既有訂單，讓審核看得到前後文）
                            try {
                                const spkName = senderUserId ? await (0, line_conversation_js_1.upsertGroupSpeaker)(db, lineClient, groupId, senderUserId, null) : null;
                                const todays = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ?").all(customerId, getTaipeiOrderDate());
                                await (0, line_conversation_js_1.logConversation)(db, {
                                    groupId,
                                    customerId,
                                    orderIds: (todays || []).map((r) => r.id),
                                    senderKind: "customer",
                                    senderLineUserId: senderUserId || null,
                                    senderName: spkName,
                                    msgType: "text",
                                    text,
                                });
                            } catch (e) {
                                console.warn("[LINE] 詢問對話記錄失敗:", e?.message || e);
                            }
                            continue;
                        }
                    }
                }
                // 不再要求先輸入「收單」；若尚未有 session，收到文字即自動開單
                if (groupId && !collectingByGroup.has(groupId)) {
                    const autoOrderDate = getTaipeiOrderDate();
                    // [fix 2026-07-08] 自動開單累加的同日訂單查詢須排除作廢/客訴軟刪除單，否則作廢後客戶再叫貨會附加進作廢單→漏出貨；並加 ORDER BY 取穩定的第一張。
                    let autoOrder = await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").get(customerId, autoOrderDate);
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
                    persistCollectSession(db, groupId, autoSession).catch(()=>{});
                    scheduleAutoFinalize(groupId, autoSession);
                    scheduleOrderConfirmReply(groupId, autoSession).catch(()=>{});
                }
                if (!groupId || !collectingByGroup.has(groupId)) {
                    continue;
                }
                // 收單模式：將本則當成叫貨累加
                const session = collectingByGroup.get(groupId);
                const { orderId, customerId: cid } = session;
                const idsForRaw = (session.allOrderIds && session.allOrderIds.length) ? [...new Set(session.allOrderIds)] : [orderId];
                await appendRawLineToOrders(db, idsForRaw, text, nowSql);
                // 對話紀錄：客戶訊息（含 LINE 顯示名稱，供審核頁顯示發話者）
                try {
                    const spkName = senderUserId ? await (0, line_conversation_js_1.upsertGroupSpeaker)(db, lineClient, groupId, senderUserId, null) : null;
                    await (0, line_conversation_js_1.logConversation)(db, {
                        groupId,
                        customerId: cid,
                        orderIds: idsForRaw,
                        senderKind: "customer",
                        senderLineUserId: senderUserId || null,
                        senderName: spkName,
                        msgType: "text",
                        text,
                    });
                } catch (e) {
                    console.warn("[LINE] 客戶對話記錄失敗:", e?.message || e);
                }
                const custRow = await db.prepare("SELECT default_unit, known_sub_customers FROM customers WHERE id = ?").get(cid);
                const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                const knownSub2 = custRow?.known_sub_customers != null ? String(custRow.known_sub_customers).trim() : "";
                const parseOpts2 = {
                    ...(knownSub2 ? { knownSubCustomers: knownSub2 } : {}),
                    db,
                    customerId: cid,
                };
                // 客戶意圖偵測（含客訴、退貨、取消、改訂單、詢送貨、補叫貨）
                const intentHit = detectCustomerIntent(text);
                if (intentHit.intent === "complaint" || intentHit.intent === "return_request") {
                    // 客訴 / 退貨：標為 complaint，跳過 AI 解析
                    try {
                        await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + " WHERE id = ?").run("complaint", orderId);
                        console.log("[LINE] 偵測到「" + intentHit.intent + "」意圖 [" + intentHit.keywords.join(",") + "] → 訂單 " + orderId + " 標為 complaint");
                        try {
                            const dclId = "dcl_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
                            await db.prepare(
                                "INSERT INTO data_change_log (id, entity_type, entity_id, action, summary, meta_json, actor_username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, " + nowSql + ")"
                            ).run(dclId, "order", orderId, "auto_create_complaint",
                                  `自動偵測「${intentHit.intent === "return_request" ? "退貨" : "客訴"}」關鍵詞 [${intentHit.keywords.join(",")}]`,
                                  JSON.stringify({ intent: intentHit.intent, matched_keywords: intentHit.keywords, raw_text: text.slice(0, 500), source: "auto_intent" }),
                                  "system:intent_detector");
                        } catch (_) {}
                        const ordInfo = await db.prepare("SELECT order_no FROM orders WHERE id = ?").get(orderId);
                        notifyManagerOfComplaint(lineClient, {
                            intentLabel: intentHit.intent === "return_request" ? "退貨" : "客訴",
                            customerName: customer?.name || null,
                            orderNo: ordInfo?.order_no || null,
                            keywords: intentHit.keywords,
                            rawText: text,
                        }).catch(()=>{});
                    } catch (e) {
                        console.warn("[LINE] 標記意圖失敗:", e?.message || e);
                    }
                    continue;
                }
                // 取消 / 改訂單 / 詢送貨 / 補叫貨 / 空籃回收：寫入稽核
                if (intentHit.intent && ["cancel_order", "modify_order", "delivery_inquiry", "add_to_order", "basket_return"].includes(intentHit.intent)) {
                    try {
                        const intentLabel = { cancel_order: "取消訂單", modify_order: "改訂單", delivery_inquiry: "詢送貨時間", add_to_order: "補叫貨", basket_return: "空籃回收" }[intentHit.intent] || intentHit.intent;
                        // 若為空籃回收，嘗試抽取數字
                        let basketSuffix = "";
                        if (intentHit.intent === "basket_return") {
                            const n = extractBasketCount(text);
                            if (n != null && Number.isFinite(n)) basketSuffix = `（${n} 個）`;
                        }
                        // 訂單 remark 補上「客戶意圖：…」前綴（保留既有 remark）
                        const r = await db.prepare("SELECT remark FROM orders WHERE id = ?").get(orderId);
                        const newPrefix = `[客戶意圖：${intentLabel}${basketSuffix}]`;
                        const existing = String(r?.remark || "").trim();
                        const newRemark = existing.includes(newPrefix) ? existing : (existing ? newPrefix + " " + existing : newPrefix);
                        await db.prepare("UPDATE orders SET remark = ?, updated_at = " + nowSql + " WHERE id = ?").run(newRemark, orderId);
                        const dclId = "dcl_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
                        await db.prepare(
                            "INSERT INTO data_change_log (id, entity_type, entity_id, action, summary, meta_json, actor_username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, " + nowSql + ")"
                        ).run(dclId, "order", orderId, "auto_detect_intent",
                              `自動偵測「${intentLabel}」意圖 [${intentHit.keywords.join(",")}]`,
                              JSON.stringify({ intent: intentHit.intent, intent_label: intentLabel, matched_keywords: intentHit.keywords, raw_text: text.slice(0, 500), source: "auto_intent" }),
                              "system:intent_detector");
                        console.log("[LINE] 偵測到「" + intentLabel + "」意圖 [" + intentHit.keywords.join(",") + "] → 已標註於訂單 " + orderId);
                    } catch (e) {
                        console.warn("[LINE] 標記意圖失敗:", e?.message || e);
                    }
                    // A5 修：cancel_order / modify_order 不再強行跑 AI 解析（避免「取消+改成 5 斤白菜」這類訊息把新品項加進原訂單）。
                    // 員工後台會在 audit 看到該訊息並人工處理；其他意圖（詢送貨／補叫貨／空籃）也是保守不解析，避免誤判。
                    if (intentHit.intent === "cancel_order" || intentHit.intent === "modify_order"
                        || intentHit.intent === "delivery_inquiry" || intentHit.intent === "basket_return") {
                        continue;
                    }
                    // add_to_order 仍嘗試解析（補叫貨情境下文中常確實有品項要加）
                }
                // 過短或不含數字的訊息（純 emoji、問候語等）略過 Gemini 解析
                const looksLikeOrder = text.length >= 4 && /[\d０-９]/.test(text);
                if (!looksLikeOrder) {
                    console.log("[LINE] 訊息不含數字或過短，略過 Gemini 解析");
                    continue;
                }
                const parsed = await (0, parse_order_message_js_1.parseOrderMessage)(text, fallbackUnit, parseOpts2);
                console.log("[LINE] 解析結果 筆數:", parsed.length, parsed.length ? "品項:" + parsed.map((p) => p.rawName + " " + p.quantity).join(", ") : "");
                // [fix 2026-07-08] parseOrderMessage 可能 >30 秒，期間 30 秒自動結單可能已 finalize 本 session（並跑過整單 rebuild）。
                // 若 session 已不在（或已換成別張），這批品項的 raw 已在 appendRawLineToOrders 寫入，rebuild 已涵蓋；
                // 此處再 insert 會與 rebuild 競態導致同批品項寫兩次。故偵測到已被結單就略過 insert。
                const stillActive = groupId ? collectingByGroup.get(groupId) : null;
                if (!stillActive || stillActive.orderId !== session.orderId) {
                    console.log("[LINE] 解析完成時 session 已結單（rebuild 已涵蓋此批），略過重複 insert orderId=%s", orderId);
                    continue;
                }
                const sessionOrderMeta = await db.prepare("SELECT order_date, order_sub_split_key FROM orders WHERE id = ?").get(orderId);
                const orderDateVal = sessionOrderMeta?.order_date || getTaipeiOrderDate();
                if (parsed.length > 0 && mustSplitOrdersBySubCustomer(parsed)) {
                    const map = groupParsedItemsBySubCustomer(parsed);
                    // [fix 2026-07-10] 拆單前先把當日 NULL 主訂單標成 '' 桶，並改為「找到或建立」
                    // 同日同子客戶訂單；主客戶桶會重用 session 既有主訂單，不再另開新單。
                    // 新建子單 raw_message 只放本則文字（不繼承主訂單累積的 rawSnap），
                    // 否則結單 rebuild 時舊訊息品項會落入子單重複重建（同圖片拆單修法）。
                    await markSameDayMainOrdersAsSplitBase(db, cid, orderDateVal, nowSql);
                    const touchedOrderIds = [];
                    for (const [subKey, items] of map) {
                        const { orderId: oid, created } = await findOrCreateSplitTargetOrder(db, getNextOrderNo, nowSql, {
                            customerId: cid,
                            orderDate: orderDateVal,
                            groupId,
                            subKey,
                            rawMessage: text,
                            lineMessageId: curLineMessageId,
                        });
                        // 本則文字稍早已 append 進 session 既有訂單（idsForRaw）；重用「session 外」的既有單才需補寫
                        if (!created && !idsForRaw.includes(oid))
                            await appendRawLineToOrders(db, [oid], text, nowSql);
                        touchedOrderIds.push(oid);
                        await insertParsedItemsForOrder(db, oid, cid, items, fallbackUnit);
                    }
                    mergeSessionOrderIds(session, touchedOrderIds);
                    if (lineClient && map.size > 1) {
                        await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${map.size} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db);
                    }
                }
                else if (parsed.length > 0) {
                    // [fix 2026-07-10] session.orderId 可能是子客戶拆單訂單（本 session 由拆單建立時）。
                    // 無子客戶標記的品項必須進主客戶桶，否則結單 rebuild 依 split key 過濾會把這批品項整批丟掉。
                    let targetOrderId = orderId;
                    const curKey = sessionOrderMeta?.order_sub_split_key != null ? String(sessionOrderMeta.order_sub_split_key).trim() : "";
                    if (curKey !== "") {
                        const t = await findOrCreateSplitTargetOrder(db, getNextOrderNo, nowSql, {
                            customerId: cid,
                            orderDate: orderDateVal,
                            groupId,
                            subKey: "",
                            rawMessage: text,
                            lineMessageId: curLineMessageId,
                        });
                        targetOrderId = t.orderId;
                        if (!t.created && !idsForRaw.includes(targetOrderId))
                            await appendRawLineToOrders(db, [targetOrderId], text, nowSql);
                        mergeSessionOrderIds(session, [targetOrderId]);
                    }
                    await insertParsedItemsForOrder(db, targetOrderId, cid, parsed, fallbackUnit);
                }
                console.log("[LINE] 訂單已寫入", orderId);
            }
            catch (err) {
                eventFailed = true;
                console.error("[LINE] 處理訊息時錯誤:", err);
                try {
                    await reply(lineClient, event.replyToken, "抱歉，處理時發生錯誤，請稍後再試。", db);
                }
                catch (replyErr) {
                    console.error("[LINE] 回覆失敗（可能 replyToken 逾時）:", replyErr?.message || replyErr);
                }
            }
            finally {
                // [fix 2026-07-10] 訊息處理收尾（try 內大量 continue 也會先經過這裡＝所有成功路徑都被標記）：
                // 成功 → INSERT processed_line_messages 完成標記（此後同 message.id 的 redelivery 永久略過）；
                // 失敗 → 釋放記憶體去重＋best-effort DELETE 完成標記（反轉語意下失敗路徑本來就沒 INSERT，
                //         DELETE 僅防禦性清理），讓 LINE redelivery 可整則重跑，不再永久斷單。
                if (ownsLineMessage && curLineMessageId) {
                    if (!eventFailed) {
                        try {
                            const nowSqlDone = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                            await db.prepare(
                                "INSERT INTO processed_line_messages (message_id, processed_at) VALUES (?, " + nowSqlDone + ") ON CONFLICT (message_id) DO NOTHING"
                            ).run(curLineMessageId);
                        } catch (e) {
                            // 完成標記寫失敗：跨實例重投遞可能重跑本則（有 dupByOrder/記憶體 Set 補位），不阻斷
                            console.warn("[LINE] 完成標記寫入失敗（跨實例重送恐重跑本則）messageId=%s: %s", curLineMessageId, e?.message || e);
                        }
                    } else {
                        releaseLineWebhookMessageOnce(curLineMessageId);
                        try {
                            await db.prepare("DELETE FROM processed_line_messages WHERE message_id = ?").run(curLineMessageId);
                        } catch (_) { /* best-effort：失敗不影響（本來就未 INSERT） */ }
                        console.warn("[LINE] 訊息處理失敗，已釋放去重標記供 LINE redelivery 重試 messageId=%s", curLineMessageId);
                    }
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
                // [fix 2026-07-08] 原本任一 event enqueue 失敗就 fallback 重跑「全部」events，
                // 已成功入列的會被 Cloud Tasks 執行一次 + fallback 再處理一次 → 重複處理。
                // 改為逐則捕捉，只把「入列失敗」的 events 收集起來 fallback 直接處理；
                // 加上新的持久化去重（processed_line_messages）作為最後一道保險，即使仍有重疊也不會重複寫入品項。
                const failedEvents = [];
                for (const ev of events) {
                    try {
                        await (0, cloud_tasks_line_js_1.enqueueLineEventTask)(ev);
                    }
                    catch (e) {
                        console.error("[LINE] Cloud Tasks enqueue 單則失敗，改 fallback 直接處理該則:", e?.message || e);
                        failedEvents.push(ev);
                    }
                }
                if (failedEvents.length) {
                    // 回退直接處理：dedup 三層（記憶體 Set + DB line_message_id + processed_line_messages）防止重複下單
                    processLineWebhookEvents(failedEvents).catch((e2) => console.error("[LINE] Cloud Tasks fallback 直接處理失敗:", e2?.message || e2));
                }
            })();
            return;
        }
        res.status(200).send("OK");
        processLineWebhookEvents(events).catch((e) => console.error("[LINE] 背景處理失敗", e));
    });
    exports.processLineWebhookEvents = processLineWebhookEvents;
    // G15：啟動時恢復未結單 session（讓 Cloud Run 重啟後客戶不用重發）
    restoreCollectSessions(db, scheduleAutoFinalize).catch((e) => console.warn("[session-persist] restore 例外:", e?.message || e));
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
// 測試掛鉤：拆單純函式與 DB helper（勿在正式流程 require 這個物件）
exports._testables = {
    mustSplitOrdersBySubCustomer,
    groupParsedItemsBySubCustomer,
    markSameDayMainOrdersAsSplitBase,
    findOrCreateSplitTargetOrder,
    getNextOrderNo,
};
