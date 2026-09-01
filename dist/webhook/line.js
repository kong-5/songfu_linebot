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
const audit_js_1 = require("../lib/audit.js");
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
const erp_companies_js_1 = require("../lib/erp-companies.js");
const ops_notify_js_1 = require("../lib/ops-notify.js");
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
const lineConfig = { channelAccessToken, channelSecret };
const hasLineConfig = Boolean(channelAccessToken && channelSecret);
/** 收單模式：群組 ID -> { orderId, customerId, lastActivity }；可設 LINE_COLLECT_TIMEOUT_SEC 覆蓋，預設 30 秒 */
const COLLECT_TIMEOUT_MS = (parseInt(process.env.LINE_COLLECT_TIMEOUT_SEC || "30", 10) || 30) * 1000;
// ── 收單確認 Flex 卡（第四波：closed-loop 確認）門檻與上限 ──
// 低信心門檻：order_items.confidence_score 低於此值即在 Flex 卡標醒目「⚠ 請確認」（0-100 分制）。
// 沿用既有 confidence_score 語意；本檔無其他信心門檻常數，故取 70。
const ORDER_CONFIRM_CONFIDENCE_THRESHOLD = 70;
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
/** [fix 2026-07-10] 持久化去重「processing 佔位」租約時長：逾時視為前一實例當機／卡死，可被接手重跑 */
const PROCESSED_LINE_MSG_LEASE_MS = 10 * 60 * 1000;
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
 * 與持久化去重的「租約式原子佔位」配套（見事件迴圈入口／finally）：失敗時 finally 同步刪除
 * 自己的 processing 佔位列，失敗的訊息不留任何去重標記。 */
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
function formatOrderQty(q) {
    const n = Number(q);
    if (!Number.isFinite(n))
        return String(q ?? "");
    return String(parseFloat(n.toFixed(4)));
}
/**
 * 把品項警示 remark 轉成「客戶看得懂」的文案（**只用於 LINE 客戶端呈現**，後台明細仍顯示原文技術細節）。
 * - 內勤技術措辭「⚠ 字跡跨列（秀珍菇/洋菇），請確認」（來自 form-row-anchor.js）客戶看不懂「跨列」、
 *   又同時看到兩個品名會困惑 → 轉成客戶語言「⚠ 此項辨識不確定，請確認品項與數量」。
 * - 其他 ⚠ remark（一般備註警示）維持原樣。
 * - 無 ⚠ remark 但屬低信心（confidence_score < 門檻）→ 通用「⚠ 辨識信心較低，請確認」。
 * @param {string} remarkWarnText 取自 order_items.remark 的 ⚠ 警示段（可能為空）。
 * @param {boolean} lowConf 是否低信心品項。
 * @returns {string} 要顯示給客戶的警示文字（含 ⚠）；無警示回空字串。
 */
function toCustomerWarnText(remarkWarnText, lowConf) {
    const w = (remarkWarnText || "").trim();
    if (w.startsWith("⚠ 字跡跨列") || w.startsWith("⚠字跡跨列")) {
        return "⚠ 此項辨識不確定，請確認品項與數量";
    }
    if (w)
        return w;
    if (lowConf)
        return "⚠ 辨識信心較低，請確認";
    return "";
}
// 拆檔批次 9：以下 helper 拆出至 ../lib/（純搬移、行為不變）。
// 以原名解構回 module 層，createLineWebhook 內的呼叫處與 _testables 匯出皆不用改。
const { buildOrderConfirmFlex, isEmployeeMenuKeyword, buildEmployeeMenuFlex } = require("../lib/line-flex-messages.js");
const { subCustomerGroupKeyFromParsedItem, mustSplitOrdersBySubCustomer, groupParsedItemsBySubCustomer, mergeSessionOrderIds, formatSplitSubNamesForReply } = require("../lib/line-sub-split.js");
const { detectCustomerIntent, extractBasketCount } = require("../lib/line-intent.js");
const { normalizeOrderUnit, insertOrderRowWithSplitMeta, findPriorOrderForLineMessage, findOrCreateSplitTargetOrder, insertParsedItemsForOrder, isRawMessageNoise, appendRawLineToOrders, recordOrderItemEdit, duplicateAttachmentToOrders, notifyManagerOfComplaint, upsertPendingLineGroup, getNextOrderNo } = require("../lib/line-order-write.js");
// [refactor 2026-07-14] 標桶＋找目標單邏輯抽到共用 lib，後台拆單（move-items / split-by-sub-customer）也用同一份。
const { markSameDayMainOrdersAsSplitBase, findSplitTargetOrderId, isSplitKeyUniqueConflict } = require("../lib/order-split.js");
function createLineWebhook() {
    const router = express_1.default.Router();
    const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
    const db = (0, index_js_1.getDb)(dbPath);
    // [fix 2026-07-28 §一A5/A6] 收單失敗告警閉環（notifyOps 內含 10 分鐘去重，發不出去不影響主流程）
    function notifyOpsSafe(msg) {
        try {
            const p = (0, ops_notify_js_1.notifyOps)(db, msg);
            if (p && typeof p.catch === "function") p.catch((e) => console.warn("[LINE] ops 告警發送失敗:", e?.message || e));
        }
        catch (e) { console.warn("[LINE] ops 告警發送例外:", e?.message || e); }
    }
    function notifyLineIntakeFailure(result, where) {
        const failed = result && typeof result.failed === "number" ? result.failed : 0;
        const total = result && typeof result.total === "number" ? result.total : 0;
        if (failed > 0) {
            notifyOpsSafe(`⚠ LINE 收單${where}有 ${failed}/${total} 則失敗（已回 200，LINE 不會重送）。請到訂單審核確認是否漏單，必要時請客戶重發。`);
        }
    }
    const lineClient = hasLineConfig ? new bot_sdk_1.Client(lineConfig) : null;
    /**
     * [fix 2026-07-29 §一A1/A2] 結單流程單一實作（30 秒自動結單／手動「完成」「以上X收單」共用）。
     *
     * 過去兩條路徑各寫一份，手動那份缺了兩件事：
     *  1) **不發訂單明細摘要**——客戶主動關單反而收不到核對憑據；更糟的是手動路徑會 clearTimeout 掉
     *     自動結單 timer，所以「以上X收單」數量對不上時回覆的「請對照 30 秒後的訂單明細」永遠不會到。
     *  2) **先刪 session 再 rebuild**——rebuild 期間程序當機＝session 已消失、重啟不會補跑結單
     *     （自動路徑 2026-07-14 已修成「rebuild 完成才刪」，手動路徑漏改）。
     * 兩路改為呼叫同一支，行為由建構上保證一致。
     *
     * 呼叫端負責：從 collectingByGroup 移除、清 autoFinalizeTimers（避免重複結單）。
     * 本函式負責：整單重辨識 → 刪持久化 session → 清空白單 → 補空籃 → 組摘要 → 推播。
     * @returns {Promise<{survivingOrderIds:string[], totalItems:number, summarySent:boolean}>}
     */
    const finalizeCollectedOrders = async (groupId, session, opts = {}) => {
        const logTag = opts.logTag || "結單";
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
                        console.log("[LINE] %s整單重辨識完成 orderId=%s", logTag, oid);
                    else
                        console.warn("[LINE] %s整單重辨識未覆寫（沿用逐則明細）orderId=%s err=%s", logTag, oid, fr.error);
                }
                catch (e) {
                    console.error("[LINE] %s整單重辨識例外 orderId=%s:", logTag, oid, e?.message || e);
                }
            }
        }
        // [fix 2026-07-14] 持久化 session 移到 rebuild 完成後才刪：舊版一進 timer 就刪，
        // rebuild 期間程序當機＝session 沒了、重啟不會補跑結單（空籃沒補、摘要沒發）。
        // 現在當機在 rebuild 段會於重啟時 restoreCollectSessions 恢復並重新 finalize
        // （rebuild 冪等、此時尚未推播）；過了這行才輪到推播類動作，重複風險窗已收斂到最小。
        deleteCollectSession(db, groupId).catch(() => { });
        // B1：結單前先清掉「完全空白」的訂單（0 品項、無 attachments、raw_message 空）
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
                    console.log("[LINE] %s時清除完全空白訂單 orderId=%s", logTag, oid);
                    continue;
                }
                survivingOrderIds.push(oid);
            } catch (e) {
                console.warn("[LINE] 空訂單清理檢查失敗 orderId=%s err=%s（保留訂單）", oid, e?.message || e);
                survivingOrderIds.push(oid);
            }
        }
        if (!survivingOrderIds.length) {
            console.log("[LINE] %s時所有訂單皆為空白，已全部刪除，不發推播。", logTag);
            return { survivingOrderIds: [], totalItems: 0, summarySent: false };
        }
        // [fix 2026-07-10] Flex 卡的多單連續編號必須與「線上改單」流程（ORDER BY order_no）對齊，
        // 否則客戶在 Flex 卡看到的號碼 ≠ 改單指令作用的號碼＝又把「改到錯單」換個形式帶回來。
        // survivingOrderIds 原為收集序（allOrderIds 插入序），這裡用同一句 SQL ORDER BY order_no 重排，
        // 保證兩處排序完全相同（連 TEXT 排序的邊界行為都一致）。排序失敗維持原序、不阻斷推播。
        try {
            if (survivingOrderIds.length > 1) {
                const ph = survivingOrderIds.map(() => "?").join(",");
                const orderedRows = await db.prepare("SELECT id FROM orders WHERE id IN (" + ph + ") ORDER BY order_no").all(...survivingOrderIds);
                const orderedIds = orderedRows.map((r) => r.id).filter((id) => survivingOrderIds.includes(id));
                if (orderedIds.length === survivingOrderIds.length) {
                    survivingOrderIds.length = 0;
                    survivingOrderIds.push(...orderedIds);
                }
            }
        } catch (e) {
            console.warn("[LINE] 結單摘要依 order_no 排序失敗，維持收集序:", e?.message || e);
        }
        // 補空籃（自動／手動一致）；放在建摘要之前，讓推播明細就含空籃。
        await insertEmptyBaskets(db, session.customerId, survivingOrderIds);
        const order = await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(survivingOrderIds[0]);
        const dateStr = order?.order_date || getTaipeiOrderDate();
        const orderBlocks = [];
        // Flex 卡的結構化資料（與文字 orderBlocks 同時建）；文字版作 fallback（Flex 組裝失敗／泡數超限時用）。
        const orderBlocksData = [];
        let totalItems = 0;
        for (const oid of survivingOrderIds) {
            const ord = await db.prepare("SELECT order_no, remark FROM orders WHERE id = ?").get(oid);
            const items = await db.prepare(`
          SELECT oi.raw_name, oi.quantity, oi.unit, oi.remark, oi.confidence_score, p.name AS product_name, p.erp_code
          FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ? ORDER BY oi.id
        `).all(oid);
            const lines = [];
            const flexItems = [];
            let idx = 1;
            for (const it of items) {
                const unit = normalizeOrderUnit(it.unit, "公斤");
                const name = it.product_name || it.raw_name || "待確認";
                // remark 以「⚠」開頭＝AI 標記的警示（如照片辨識幾何校驗的「⚠ 字跡跨列（A/B），請確認」），
                // 收單摘要要讓人看得到：品項行下方縮排帶出警示段（只取 ⚠ 那一段，後續換算備註不重複顯示）。
                const remarkStr = it.remark != null ? String(it.remark).trim() : "";
                const warnFromRemark = remarkStr.startsWith("⚠");
                const remarkWarnText = warnFromRemark ? remarkStr.split(/[；;\n]/)[0].trim() : "";
                // 低信心：confidence_score 有值且低於門檻（0-100 分制）→ Flex 卡與純文字皆標醒目「請確認」。
                const conf = it.confidence_score;
                const lowConf = conf != null && Number.isFinite(Number(conf)) && Number(conf) < ORDER_CONFIRM_CONFIDENCE_THRESHOLD;
                // 客戶端警示文案：把內勤技術措辭（如「字跡跨列」）轉成客戶語言；低信心（且無 ⚠ remark）也補通用提示。
                // [fix 2026-07-10] 純文字 fallback 過去只在 warnFromRemark 才補警示，低信心品項在純文字版完全無標記
                // （Flex 被拒 fallback 時客戶反而看到更少警示）→ 現與 Flex 的 warn 判定（warnFromRemark || lowConf）對齊。
                const custWarnText = toCustomerWarnText(remarkWarnText, lowConf);
                const warnSuffix = custWarnText ? `\n　${custWarnText}` : "";
                lines.push(`${idx}. ${name} ${formatOrderQty(it.quantity)}${unit || ""}${warnSuffix}`);
                flexItems.push({
                    name,
                    qtyStr: formatOrderQty(it.quantity),
                    unit: unit || "",
                    warn: warnFromRemark || lowConf,
                    // 警示文字：走同一套客戶端轉譯（技術措辭轉客戶語言；低信心給通用提示）。
                    warnText: custWarnText,
                });
                if (Number(it.quantity) > 0)
                    totalItems += 1;
                idx += 1;
            }
            const hdr = ord?.remark ? `${ord.remark}\n` : "";
            orderBlocks.push(`【${ord?.order_no ?? oid}】\n${hdr}${lines.length ? lines.join("\n") : "（目前尚無可辨識品項）"}`);
            orderBlocksData.push({ orderNo: ord?.order_no ?? oid, remark: ord?.remark || "", items: flexItems });
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
        let summarySent = false;
        if (lineClient) {
            if (!(await (0, line_bot_control_js_1.isLineSuppressCustomerReply)(db))) {
                // 優先推 Flex 卡（closed-loop 確認）；組裝失敗／泡數超限回 null → fallback 純文字 summary。
                // [fix 2026-07-10] Flex 即使結構合法，LINE 仍可能語意拒絕（如某 text 超過 2000 字上限、整則過大）
                // 而回 400——此時 pushMessage 會拋錯。務必 try/catch 後 fallback 純文字，否則客戶「完全收不到」比舊版更糟。
                const flex = buildOrderConfirmFlex(orderBlocksData, dateStr);
                let flexSent = false;
                if (flex) {
                    try {
                        await lineClient.pushMessage(groupId, { type: "flex", altText: flex.altText, contents: flex.contents });
                        flexSent = true;
                    }
                    catch (fe) {
                        console.warn("[LINE] Flex 收單卡被拒，fallback 純文字:", fe?.message || fe);
                    }
                }
                if (!flexSent) {
                    // [fix 2026-07-14] 摘要是客戶核對訂單的唯一憑據：純文字推播失敗再重試一次
                    //（LINE push 瞬斷很常見；重試仍失敗才放棄並記 log）。
                    try {
                        await lineClient.pushMessage(groupId, { type: "text", text: summary });
                    } catch (pe) {
                        console.warn("[LINE] 結單摘要推播失敗，3 秒後重試一次:", pe?.message || pe);
                        await new Promise((r) => setTimeout(r, 3000));
                        await lineClient.pushMessage(groupId, { type: "text", text: summary });
                    }
                }
                summarySent = true;
            }
            else {
                console.log("[LINE] 已略過%s推播（對客戶靜音） orders=%s", logTag, survivingOrderIds.join(","));
            }
        }
        return { survivingOrderIds, totalItems, summarySent };
    };
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
                // [fix 2026-07-29 §一A1/A2] 結單流程已抽成 finalizeCollectedOrders（與手動結單共用同一支）
                await finalizeCollectedOrders(groupId, session, { logTag: "30 秒自動結單" });
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
        // 回傳 { failed, total }：Cloud Tasks worker 依 failed>0 回 500 讓佇列重試。
        // 過去 worker 無從得知事件失敗（例外被本函式逐則吞掉）永遠回 200 →
        // Gemini 429/DB 瞬斷等於該則訊息永久丟失（斷單）。
        let failedCount = 0;
        for (const event of events) {
            // [fix 2026-07-10] 本則訊息的去重狀態（供 finally 收尾）：
            // curLineMessageId＝訊息 id；ownsLineMessage＝本次執行通過所有去重、實際「佔有」處理權；
            // eventFailed＝外層 catch 捕捉到錯誤；lineMessageIsRetry＝接手「逾時 processing 租約」的重跑
            // （前次執行可能已寫入部分資料，下游 raw_message／附件附加改走冪等判斷）。
            // 宣告在 try 外，try 內的 continue／throw 都會走到 finally。
            let curLineMessageId = null;
            let ownsLineMessage = false;
            let eventFailed = false;
            let lineMessageIsRetry = false;
            // [fix 2026-07-10 #63回歸] claimNowIso＝本次執行寫入佔位列的 claimed_at 值（INSERT 佔位或
            // 接手逾時租約時設定；佔位流程因例外「放行」時維持 null）。finally 收尾與提前釋放都帶此值
            // 當條件，只動「自己的」佔位列，絕不覆蓋／誤刪已被他實例接手的列。
            // claimedByInsert＝本次佔位列是「自己 INSERT 成功」（changes=1）建立的（非接手他人逾時列）。
            let claimNowIso = null;
            let claimedByInsert = false;
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
                            // [fix 2026-07-14] 刪單包交易：舊版逐句刪，中途失敗留「空殼訂單」，
                            // 且同日後續訊息會重用這張殼繼續累加＝客戶已收回的單復活。
                            const nowSqlUnsend = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                            const doUnsendDel = async (h) => {
                                for (const oid of deletedIds) {
                                    // 稽核軌跡：硬刪前留訂單＋品項快照（出貨爭議時可查「客戶曾叫過又收回」）。
                                    // 同交易寫入：快照失敗＝整批 ROLLBACK，不會有「單刪了、稽核沒留」的狀態。
                                    const ordSnap = await h.prepare("SELECT order_no, customer_id, order_date, status, raw_message FROM orders WHERE id = ?").get(oid);
                                    const itemSnap = await h.prepare("SELECT raw_name, quantity, unit, sub_customer FROM order_items WHERE order_id = ?").all(oid);
                                    await (0, audit_js_1.writeAudit)(h, {
                                        entityType: "order", entityId: oid, action: "unsend_delete",
                                        summary: "客戶收回 LINE 訊息 → 自動刪除訂單" + (ordSnap?.order_no ? "（單號 " + ordSnap.order_no + "）" : ""),
                                        meta: { line_message_id: mid, before: ordSnap || null, items: (itemSnap || []).slice(0, 100) },
                                        actor: "system:line_unsend",
                                    });
                                    await h.prepare("DELETE FROM order_items WHERE order_id = ?").run(oid);
                                    await h.prepare("DELETE FROM order_attachments WHERE order_id = ?").run(oid);
                                    try {
                                        await h.prepare("DELETE FROM customer_order_image_examples WHERE order_id = ?").run(oid);
                                    }
                                    catch (_) { /* 表或 FK 可能不存在 */ }
                                    await h.prepare("DELETE FROM orders WHERE id = ?").run(oid);
                                }
                            };
                            if (typeof db.transaction === "function")
                                await db.transaction(doUnsendDel);
                            else
                                await doUnsendDel(db);
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
                // [fix 2026-07-21] dupByOrder 不再無條件擋：前次執行「跑到一半失敗」（例如拆單迴圈
                // 跑到第 2 家才炸）時已建了帶此 message id 的訂單，但 processed_line_messages 沒有
                // done 標記（失敗路徑會刪自己的 processing 佔位）。舊行為＝重投遞一進來就被整則略過，
                // 「失敗釋放租約供重跑」形同虛設、剩下的子客戶品項永久漏掉。
                // 新行為：有訂單但完成標記非 done → 視為前次半途失敗的重跑，標 lineMessageIsRetry
                // 走下游全冪等路徑（append raw skipIfPresent、品項 src_line_message_id 預檢、附件查重）。
                let hadPartialWrites = false;
                if (curLineMessageId) {
                    const dupByOrder = await db.prepare("SELECT id FROM orders WHERE line_message_id = ? LIMIT 1").get(curLineMessageId);
                    if (dupByOrder) {
                        let doneSt = "done"; // 查詢失敗保守視為已完成（寧可略過不可雙寫）
                        try {
                            const pr = await db.prepare("SELECT status FROM processed_line_messages WHERE message_id = ?").get(curLineMessageId);
                            // 列存在且 status NULL＝舊語意完成標記；沒有列＝前次失敗已釋放
                            doneSt = pr ? (pr.status == null ? "done" : String(pr.status).trim().toLowerCase()) : "released";
                        } catch (_) { doneSt = "done"; }
                        if (doneSt === "done") {
                            console.log("[LINE] 偵測到重複的 messageId（已完成處理），略過");
                            continue;
                        }
                        // processing（交由下方租約邏輯判斷逾時/接手）或 released（前次失敗）→ 放行重跑
                        hadPartialWrites = true;
                        console.warn("[LINE] messageId=%s 已有訂單但無完成標記（前次半途失敗），放行冪等重跑", curLineMessageId);
                    }
                }
                // [fix 2026-07-10] 持久化去重＝「租約式原子佔位」（processed_line_messages 新增 status/claimed_at）：
                // 前一版「完成才 INSERT」的 SELECT-first 語意在跨程序秒級重疊（Cloud Tasks worker 與
                // enqueue 失敗 fallback 幾乎同時處理同一則）時，兩邊都查不到完成標記 → 品項雙寫。
                // 現改為入口原子佔位，同時保留「失敗可重跑」：
                //   1) INSERT status='processing' ON CONFLICT DO NOTHING：changes=1＝佔位成功，獨佔處理權；
                //   2) changes=0＝已有列：status='done' 或 NULL（舊語意完成列）→ 已成功處理過，略過；
                //      status='processing' 且租約（claimed_at）未逾時 → 他實例處理中，略過；
                //      租約逾時（前一實例當機／卡死）→ 條件式 UPDATE claimed_at（樂觀鎖，WHERE 帶舊值，
                //      同時搶只有一個 changes=1）搶到才接手重跑（lineMessageIsRetry=true → 下游冪等路徑）；
                //   3) 處理成功 → finally 改標 status='done'；失敗 → finally 只刪自己的 processing 佔位列，
                //      LINE redelivery 可整則重跑，不會永久斷單。
                // 佔位查詢／INSERT 失敗一律放行（寧可重複不可斷單；仍有記憶體 Set + dupByOrder 兩層防護）。
                if (curLineMessageId) {
                    try {
                        const nowSqlClaim = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                        const nowIso = new Date().toISOString();
                        const ins = await db.prepare(
                            "INSERT INTO processed_line_messages (message_id, processed_at, status, claimed_at) VALUES (?, " + nowSqlClaim + ", 'processing', ?) ON CONFLICT (message_id) DO NOTHING"
                        ).run(curLineMessageId, nowIso);
                        if ((ins?.changes ?? 0) === 1) {
                            // 自己 INSERT 佔位成功：記下 claimed_at 供 finally／提前釋放辨識「自己的列」
                            claimNowIso = nowIso;
                            claimedByInsert = true;
                        }
                        if ((ins?.changes ?? 0) === 0) {
                            const claimRow = await db.prepare("SELECT status, claimed_at FROM processed_line_messages WHERE message_id = ?").get(curLineMessageId);
                            // 舊列 status=NULL＝舊語意的完成標記；列消失（極端競態：他實例失敗剛刪除）也保守略過，等 redelivery
                            const claimSt = claimRow && claimRow.status != null ? String(claimRow.status).trim().toLowerCase() : "done";
                            if (claimSt !== "processing") {
                                console.log("[LINE] 持久化去重命中（processed_line_messages，已成功處理過），略過重複訊息 messageId=%s", curLineMessageId);
                                continue;
                            }
                            const claimedMs = claimRow.claimed_at != null ? Date.parse(String(claimRow.claimed_at)) : NaN;
                            const leaseExpired = !Number.isFinite(claimedMs) || (Date.now() - claimedMs) > PROCESSED_LINE_MSG_LEASE_MS;
                            if (!leaseExpired) {
                                console.log("[LINE] 他實例處理中（processing 租約未逾時），略過 messageId=%s claimed_at=%s", curLineMessageId, claimRow.claimed_at);
                                continue;
                            }
                            const takeover = claimRow.claimed_at != null
                                ? await db.prepare("UPDATE processed_line_messages SET claimed_at = ? WHERE message_id = ? AND status = 'processing' AND claimed_at = ?").run(nowIso, curLineMessageId, claimRow.claimed_at)
                                : await db.prepare("UPDATE processed_line_messages SET claimed_at = ? WHERE message_id = ? AND status = 'processing' AND claimed_at IS NULL").run(nowIso, curLineMessageId);
                            if ((takeover?.changes ?? 0) !== 1) {
                                console.log("[LINE] 逾時租約已被他實例接手（或已完成），略過 messageId=%s", curLineMessageId);
                                continue;
                            }
                            claimNowIso = nowIso; // 接手成功：佔位列 claimed_at 已改為本次的 nowIso
                            lineMessageIsRetry = true;
                            console.warn("[LINE] 接手逾時 processing 租約重跑 messageId=%s（原 claimed_at=%s，前次可能已寫入部分資料，下游改走冪等路徑）", curLineMessageId, claimRow.claimed_at);
                        }
                    } catch (e) {
                        // 佔位失敗不可阻斷正常收單（放行；仍有記憶體 Set + dupByOrder 兩層防護）
                        console.warn("[LINE] 持久化去重佔位失敗（放行）messageId=%s: %s", curLineMessageId, e?.message || e);
                    }
                }
                // 前次半途失敗留下的訂單存在 → 本次一律走冪等重跑路徑（含自己 INSERT 佔位成功的情況）
                if (hadPartialWrites)
                    lineMessageIsRetry = true;
                if (!consumeLineWebhookMessageOnce(event.message?.id)) {
                    // [fix 2026-07-10 #63回歸] 罕見時序：DB 佔位 INSERT 成功（前次失敗列已被刪、記憶體 Set 仍記得）
                    // 但記憶體去重擋下 → 剛插入的 processing 列會殘留到租約逾時（10 分鐘）才可被接手。
                    // 這裡本次不會處理訊息，先刪掉「自己剛插入的」佔位列（帶 claimed_at 條件只刪自己的），
                    // 讓他實例／redelivery 不被無謂卡住。接手（takeover）情境不刪：同程序 Set 命中＝先前執行仍在途。
                    if (claimedByInsert && curLineMessageId && claimNowIso != null) {
                        try {
                            await db.prepare("DELETE FROM processed_line_messages WHERE message_id = ? AND status = 'processing' AND claimed_at = ?").run(curLineMessageId, claimNowIso);
                        } catch (_) { /* best-effort：刪不掉頂多等租約逾時被接手 */ }
                    }
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
                // ── #盤點 指令：僅限開啟「盤點」功能的群組。支援「#盤點 松揚」指定公司（不帶＝松富00）──
                if (groupId && msgType === "text" && textEarly && /^#盤點/.test(textEarly.replace(/\s/g, ""))) {
                    try {
                        if (!(await getGroupFeat()).stocktake) {
                            // 未開啟盤點功能：靜默略過（不回覆、不進 AI 解析）
                            console.log("[LINE] #盤點 於未開啟盤點功能的群組略過 group=%s", groupId);
                            continue;
                        }
                        // 解析公司：#盤點 後面的字（名稱或代碼）。空＝松富00；打錯＝提示可用公司。
                        const coArg = textEarly.replace(/\s/g, "").replace(/^#盤點/, "");
                        const stkIcpno = (0, erp_companies_js_1.companyArgToIcpno)(coArg);
                        if (stkIcpno === null) {
                            if (lineClient && event.replyToken) {
                                try { await lineClient.replyMessage(event.replyToken, { type: "text", text: "看不懂公司「" + coArg + "」。可用：#盤點（松富）、#盤點 龍港、#盤點 松揚、#盤點 松成。" }); } catch (_) {}
                            }
                            continue;
                        }
                        const stkCoName = (0, erp_companies_js_1.erpCompanyName)(stkIcpno);
                        const stkLiffId = (process.env.LIFF_ID_STOCKTAKE || "2010106501-VocNwkbA").trim();
                        // [UX 2026-07-19] 掃碼盤點頁（手機當 PDA）過去只能從後台進、現場找不到入口；卡片補一顆按鈕。
                        // 僅在 LIFF_ID_SCAN 有設定時顯示（未設定＝掃碼頁不會動，就不放避免連錯 LIFF）。
                        const scanLiffId = (process.env.LIFF_ID_SCAN || "").trim();
                        const whRows = await db.prepare("SELECT code, name, sort_order FROM erp_warehouse WHERE include_stocktake = 1 AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ? ORDER BY sort_order, code").all(stkIcpno);
                        if (!whRows || whRows.length === 0) {
                            if (lineClient && event.replyToken) {
                                try { await lineClient.replyMessage(event.replyToken, { type: "text", text: stkCoName + "目前沒有納入盤點的倉庫。請先到後台『庫存管理 → 倉庫設定』（切到" + stkCoName + "）勾選要盤點的倉庫。" }); } catch (_) {}
                            }
                            continue;
                        }
                        const nowTwStk = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
                        const stkDate = nowTwStk.toISOString().slice(0, 10);
                        const whLabel = (w) => { const s = String(w.name || w.code || "").trim(); return s.length > 18 ? s.slice(0, 18) : s; };
                        const shown = whRows.slice(0, 11);
                        const stkIcQ = `&icpno=${encodeURIComponent(stkIcpno)}`;
                        const btns = shown.map((w) => ({
                            type: "button", style: "secondary", height: "sm", margin: "sm",
                            action: { type: "uri", label: whLabel(w), uri: `https://liff.line.me/${stkLiffId}?warehouse=${encodeURIComponent(String(w.code))}${stkIcQ}` },
                        }));
                        // 一律附「全部倉庫」按鈕（開啟選單頁），若倉庫數超過顯示上限也可從此進入
                        btns.push({
                            type: "button", style: "primary", color: "#1d4ed8", height: "sm", margin: "md",
                            action: { type: "uri", label: whRows.length > shown.length ? `其他倉庫（共 ${whRows.length}）` : "開啟盤點選單", uri: `https://liff.line.me/${stkLiffId}?icpno=${encodeURIComponent(stkIcpno)}` },
                        });
                        if (scanLiffId) {
                            btns.push({
                                type: "button", style: "secondary", height: "sm", margin: "sm",
                                action: { type: "uri", label: "📷 掃碼盤點", uri: `https://liff.line.me/${scanLiffId}?icpno=${encodeURIComponent(stkIcpno)}` },
                            });
                        }
                        if (lineClient && event.replyToken) {
                            try {
                                await lineClient.replyMessage(event.replyToken, {
                                    type: "flex",
                                    altText: `${stkCoName}盤點 ${stkDate}`,
                                    contents: {
                                        type: "bubble", size: "kilo",
                                        body: {
                                            type: "box", layout: "vertical", spacing: "xs", paddingAll: "14px",
                                            contents: [
                                                { type: "text", text: `📋 ${stkCoName}盤點`, size: "md", weight: "bold", color: "#1d4ed8" },
                                                { type: "text", text: `盤點日 ${stkDate} · 選擇倉庫`, size: "xxs", color: "#9b9a97", margin: "xs" },
                                                { type: "separator", margin: "md" },
                                                ...btns,
                                            ],
                                        },
                                    },
                                });
                            } catch (e) { console.warn("[LINE] #盤點 卡片回覆失敗:", e?.message || e); }
                        }
                        console.log("[LINE] #盤點 已回倉庫按鈕 group=%s 公司=%s 倉數=%s", groupId, stkIcpno, whRows.length);
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
                                    await appendRawLineToOrders(db, [oid], ocrLine, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
                                touchedOrderIds.push(oid);
                                // 逐家成功即併入 session（不等整個迴圈跑完）：後面某家失敗時，
                                // 已建好的子單仍掛在 session 上、結單 rebuild 涵蓋得到，不再變孤兒單
                                mergeSessionOrderIds(session, [oid]);
                                await duplicateAttachmentToOrders(db, messageId, [oid], nowSql);
                                await insertParsedItemsForOrder(db, oid, session.customerId, items, fallbackUnitImg, curLineMessageId);
                            }
                            mergeSessionOrderIds(session, touchedOrderIds);
                            if (lineClient && map.size > 1) {
                                await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${map.size} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db, { pushTo: groupId });
                            }
                        }
                        else if (parsedFromImg.length > 0) {
                            // [fix 2026-07-10] 改走 duplicateAttachmentToOrders（含 (order_id, line_message_id) 冪等查重），重試路徑不重複掛圖
                            await duplicateAttachmentToOrders(db, messageId, [session.orderId], nowSql);
                            await insertParsedItemsForOrder(db, session.orderId, session.customerId, parsedFromImg, fallbackUnitImg, curLineMessageId);
                            // [fix 2026-07-10 #63回歸] OCR 文字附加改走 appendRawLineToOrders 原子 UPDATE
                            //（原「SELECT raw → 串接 → UPDATE」讀改寫在併發下互相蓋寫），
                            // 接手逾時租約重跑時啟用 skipIfPresent（整段比對）避免同段 OCR 重複附加。
                            await appendRawLineToOrders(db, [session.orderId], ocrLine, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
                        }
                        else {
                            // [fix 2026-07-10] 同上：冪等掛附件；OCR 附加同上改原子 UPDATE＋重跑冪等
                            await duplicateAttachmentToOrders(db, messageId, [session.orderId], nowSql);
                            await appendRawLineToOrders(db, [session.orderId], ocrLine, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
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
                                    await appendRawLineToOrders(db, [oid], ocrLine, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
                                if (subKey === "")
                                    mainBucketOrderId = oid;
                                touchedOrderIds.push(oid);
                                await duplicateAttachmentToOrders(db, messageId, [oid], nowSql);
                                await insertParsedItemsForOrder(db, oid, customer.id, items, fallbackUnitImg, curLineMessageId);
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
                                await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${map.size} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db, { pushTo: groupId });
                            }
                        }
                        else {
                            // [fix 2026-07-18] 訊息層級建單冪等：圖片訊息 redelivery 重用原單、作廢單不復活。
                            const priorForMsg = await findPriorOrderForLineMessage(db, curLineMessageId);
                            if (priorForMsg && priorForMsg.voided) {
                                console.log("[LINE] 作廢單重投遞略過（不復活，圖片）messageId=%s order=%s", curLineMessageId, priorForMsg.orderId);
                                continue;
                            }
                            let orderId;
                            if (priorForMsg) {
                                orderId = priorForMsg.orderId;
                            }
                            else if (orderRow) {
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
                            if (parsedFromImg.length > 0) {
                                await insertParsedItemsForOrder(db, orderId, customer.id, parsedFromImg, fallbackUnitImg, curLineMessageId);
                            }
                            // [fix 2026-07-10 #63回歸] 原以稍早 SELECT 的 orderRow.raw_message 串接後整欄 UPDATE
                            //（讀改寫，併發下蓋掉期間他人附加的行），改走 appendRawLineToOrders 原子 UPDATE；
                            // 接手逾時租約重跑時啟用 skipIfPresent（整段比對）避免同段 OCR 重複附加。
                            await appendRawLineToOrders(db, [orderId], ocrLine, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
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
                        // [fix 2026-07-18] 訊息層級建單冪等（見 findPriorOrderForLineMessage）：redelivery 重用原單、
                        // 作廢單不復活。無命中才走同日重用/新建。
                        const priorForMsg = await findPriorOrderForLineMessage(db, curLineMessageId);
                        if (priorForMsg && priorForMsg.voided) {
                            console.log("[LINE] 作廢單重投遞略過（不復活）messageId=%s order=%s", curLineMessageId, priorForMsg.orderId);
                            continue;
                        }
                        // [fix 2026-07-08] 排除作廢/客訴軟刪除單並加 ORDER BY，避免累加進作廢單、附加到不穩定的任意單。
                        let orderRow = priorForMsg ? null : await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").get(customerId, orderDate);
                        let orderId;
                        if (priorForMsg) {
                            orderId = priorForMsg.orderId;
                        }
                        else if (orderRow) {
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
                            // [fix 2026-07-10 #63回歸] 讀改寫（SELECT raw → 串接 → UPDATE）改走 appendRawLineToOrders
                            // 原子 UPDATE；接手逾時租約重跑時啟用 skipIfPresent 避免重複附加同一行。
                            await appendRawLineToOrders(db, [orderId], lineForRaw, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
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
                                await appendRawLineToOrders(db, [oid], lineForRaw, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
                            if (subKey === "")
                                mainBucketOrderId = oid;
                            touchedOrderIds.push(oid);
                            await insertParsedItemsForOrder(db, oid, customerId, items, fallbackUnit, curLineMessageId);
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
                            await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${map.size} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db, { pushTo: groupId });
                        }
                        continue;
                    }
                    // [fix 2026-07-18] 訊息層級建單冪等：redelivery 重用原單、作廢單不復活。
                    const priorForMsg = await findPriorOrderForLineMessage(db, curLineMessageId);
                    if (priorForMsg && priorForMsg.voided) {
                        console.log("[LINE] 作廢單重投遞略過（不復活）messageId=%s order=%s", curLineMessageId, priorForMsg.orderId);
                        continue;
                    }
                    // [fix 2026-07-08] 排除作廢/客訴軟刪除單並加 ORDER BY，避免累加進作廢單、附加到不穩定的任意單。
                    let orderRow = priorForMsg ? null : await db.prepare("SELECT id, raw_message FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").get(customerId, orderDate);
                    let orderId;
                    if (priorForMsg) {
                        orderId = priorForMsg.orderId;
                    }
                    else if (orderRow) {
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
                    await insertParsedItemsForOrder(db, orderId, customerId, parsed, fallbackUnit, curLineMessageId);
                    if (lineForRaw) {
                        // [fix 2026-07-10 #63回歸] 讀改寫（SELECT raw → 串接 → UPDATE）改走 appendRawLineToOrders
                        // 原子 UPDATE；接手逾時租約重跑時啟用 skipIfPresent 避免重複附加同一行。
                        await appendRawLineToOrders(db, [orderId], lineForRaw, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
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
                // [fix 2026-07-10] 線上改單目標由「單一第一張單」改為「該客戶當日全部待確認單」（排除作廢/客訴軟刪，
                // 維持既有 ORDER BY order_no 穩定序），對全部品項建**一套連續編號**（第1單品項 1..k、第2單接續 k+1..）。
                // 拆單時 Flex carousel 各泡不再各自從 1 重編，號碼與此連續編號一致 → 「改第N項」不再沉默改錯單。
                // [fix 2026-07-08] 排除作廢/客訴軟刪除單（不該讓客戶改到已作廢的單）。
                const editOrderRows = await db.prepare("SELECT id, order_no FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").all(customerId, orderDate);
                if (editOrderRows.length) {
                    const custRowEdit = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(customerId);
                    const fallbackUnitEdit = custRowEdit?.default_unit?.trim() || "公斤";
                    // 跨單攤平的連續品項清單；每筆帶自己的 orderId/orderNo，改/刪依連續編號定位到正確的訂單與品項。
                    const flatItems = [];
                    for (const oRow of editOrderRows) {
                        const its = await db.prepare(`
      SELECT oi.id, oi.raw_name, oi.quantity, oi.unit, p.name AS product_name
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
      ORDER BY oi.id`).all(oRow.id);
                        for (const it of its)
                            flatItems.push({ ...it, orderId: oRow.id, orderNo: oRow.order_no });
                    }
                    const multiEdit = editOrderRows.length > 1;
                    const delMatch = normLineText.match(/^刪第?(\d+)項?$/) || normLineText.match(/^刪除\s*(\d+)\s*$/);
                    if (delMatch) {
                        const num = parseInt(delMatch[1], 10);
                        if (num >= 1 && num <= flatItems.length) {
                            const t = flatItems[num - 1];
                            // [fix 2026-07-10] 記錄刪項軌跡供結單 rebuild 重放；match_key 存被刪品項的 raw_name 快照（品名穩、位置會漂移）
                            // [fix 2026-07-27 體檢] DELETE＋軌跡包同一交易（軌跡 rethrow）：舊版兩句分開且軌跡吞錯，
                            // DELETE 成功、軌跡失敗＝結單 rebuild 查不到刪項軌跡而把品項重建回來→客戶取消的品項照樣出貨。
                            // 整體失敗會丟給 Cloud Tasks 重試閉環全冪等重跑，不會斷單。
                            const doDelItem = async (h) => {
                                await h.prepare("DELETE FROM order_items WHERE id = ? AND order_id = ?").run(t.id, t.orderId);
                                await recordOrderItemEdit(h, {
                                    orderId: t.orderId,
                                    action: "delete",
                                    rawName: t.raw_name || t.product_name || "",
                                    quantity: null,
                                    unit: null,
                                    editedBy: senderUserId,
                                }, { rethrow: true });
                            };
                            if (typeof db.transaction === "function") await db.transaction(doDelItem);
                            else await doDelItem(db);
                            const nm = t.product_name || t.raw_name || "品項";
                            await reply(lineClient, event.replyToken, `已刪除第${num}項：${nm}`, db);
                        }
                        else {
                            await reply(lineClient, event.replyToken, `找不到第${num}項。今日共 ${flatItems.length} 項，請先傳「今天叫了什麼」或「線上改單」確認編號。`, db);
                        }
                        continue;
                    }
                    const editMatch = normLineText.match(/^改第?(\d+)項?\s*([\d.]+)\s*(.*?)\s*$/) || normLineText.match(/^更正\s*(\d+)\s+([\d.]+)\s*(.*?)\s*$/);
                    if (editMatch) {
                        const num = parseInt(editMatch[1], 10);
                        const qtyNew = parseFloat(editMatch[2]);
                        const unitTail = (editMatch[3] || "").trim();
                        if (num >= 1 && num <= flatItems.length && Number.isFinite(qtyNew) && qtyNew >= 0) {
                            const t = flatItems[num - 1];
                            const unitNew = normalizeOrderUnit(unitTail || null, fallbackUnitEdit);
                            // [fix 2026-07-10] 記錄改量軌跡供結單 rebuild 重放；match_key 存該位置品項的 raw_name 快照（品名穩、位置會漂移）
                            // [fix 2026-07-27 體檢] UPDATE＋軌跡包同一交易（同刪項，防「改了量卻無軌跡→rebuild 還原成舊量」）。
                            const doSetItem = async (h) => {
                                await h.prepare("UPDATE order_items SET quantity = ?, unit = ? WHERE id = ? AND order_id = ?").run(qtyNew, unitNew, t.id, t.orderId);
                                await recordOrderItemEdit(h, {
                                    orderId: t.orderId,
                                    action: "set",
                                    rawName: t.raw_name || t.product_name || "",
                                    quantity: qtyNew,
                                    unit: unitNew,
                                    editedBy: senderUserId,
                                }, { rethrow: true });
                            };
                            if (typeof db.transaction === "function") await db.transaction(doSetItem);
                            else await doSetItem(db);
                            const nm = t.product_name || t.raw_name || "品項";
                            await reply(lineClient, event.replyToken, `已更新第${num}項 ${nm}：${formatOrderQty(qtyNew)}${unitNew}`, db);
                        }
                        else {
                            await reply(lineClient, event.replyToken, `無法更新（項次或數量有誤）。今日共 ${flatItems.length} 項。\n格式：改第1項 3 公斤`, db);
                        }
                        continue;
                    }
                    if (normLineText === "線上改單" || normLineText === "訂單更正說明") {
                        // 多單時用同一套連續編號並以「【訂單編號 X】」分隔各單（與 Flex carousel 看到的號碼一致）；
                        // 單單時不加分隔，輸出即 1..k，與現況完全相同。
                        const numberedLines = [];
                        let n = 1;
                        let lastOrderId = null;
                        for (const it of flatItems) {
                            if (multiEdit && it.orderId !== lastOrderId) {
                                numberedLines.push(`【訂單編號 ${it.orderNo ?? it.orderId}】`);
                                lastOrderId = it.orderId;
                            }
                            const nm = it.product_name || it.raw_name || "待確認";
                            numberedLines.push(`${n}. ${nm} ${formatOrderQty(it.quantity)}${it.unit || ""}`);
                            n += 1;
                        }
                        const numbered = numberedLines.join("\n");
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
                        // 先從記憶體移除＋清自動結單 timer＝防止同一批訂單被結兩次；
                        // [fix 2026-07-29 §一A2] 但**持久化 session 不在這裡刪**（改由 finalizeCollectedOrders
                        // 在 rebuild 完成後才刪）：舊版先刪，rebuild 期間當機＝session 沒了、重啟不補跑結單，
                        // 空籃沒補、摘要沒發、客戶與後台都不知道漏了一單。自動結單 2026-07-14 已修，手動漏改。
                        collectingByGroup.delete(groupId);
                        const oldTimer = autoFinalizeTimers.get(groupId);
                        if (oldTimer)
                            clearTimeout(oldTimer);
                        autoFinalizeTimers.delete(groupId);
                        // 「以上 X 收單」屬於主動結單，10 分鐘訂單編號回覆仍要照常排程，
                        // 因為使用者結束輸入後 10 分鐘確認回覆才有意義；不在此清除 orderConfirmReplyTimers。
                        // [fix 2026-07-29 §一A1] 走與自動結單同一支：客戶主動關單同樣會收到訂單明細摘要。
                        // （舊版手動結單完全不發摘要，又把 30 秒 timer 清掉，等於摘要永遠不會到。）
                        const fin = await finalizeCollectedOrders(groupId, session, { logTag: "手動結單" });
                        const totalItems = fin.totalItems;
                        const orderInfo = await db.prepare("SELECT order_date FROM orders WHERE id = ?").get(fin.survivingOrderIds[0] || session.orderId);
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
                                            // [fix 2026-07-29 §一A1] 明細現在是「上方剛推的那則」，不再是不會來的「30 秒後」
                                            type: "text",
                                            text: `提醒：您寫「以上 ${claimed} 收單」，但我們目前辨識到 ${totalItems} 項。請對照上方的訂單明細確認，有缺漏可傳「線上改單」修改。`,
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
                            let target = await db.prepare("SELECT id, status FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') <> 'deleted' ORDER BY order_no").get(customerId, todayDate);
                            if (!target) {
                                // 沒今天訂單就找該客戶最後一張訂單作為投訴對象（不限日期，避免方言差異）；同樣只排除作廢單。
                                target = await db.prepare(
                                    "SELECT id, status FROM orders WHERE customer_id = ? AND COALESCE(LOWER(TRIM(status)),'') <> 'deleted' ORDER BY order_date DESC, updated_at DESC LIMIT 1"
                                ).get(customerId);
                            }
                            if (target?.id) {
                                await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + " WHERE id = ?").run("complaint", target.id);
                                // 稽核記舊值（守則：誰/何時/改了什麼/舊值新值）：客訴覆寫任意狀態，沒 old_status 事後無法還原。
                                await (0, audit_js_1.writeAuditSafe)(db, {
                                    entityType: "order", entityId: target.id, action: "auto_create_complaint",
                                    summary: `自動偵測「${earlyIntent.intent === "return_request" ? "退貨" : "客訴"}」關鍵詞 [${earlyIntent.keywords.join(",")}]（附加到既有訂單，非新建）`,
                                    meta: { intent: earlyIntent.intent, matched_keywords: earlyIntent.keywords, raw_text: text.slice(0, 500), source: "auto_intent_early", old_status: String(target.status || ""), new_status: "complaint" },
                                    actor: "system:intent_detector",
                                });
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
                                await (0, audit_js_1.writeAuditSafe)(db, {
                                    entityType: "customer", entityId: customerId, action: "complaint_no_target_order",
                                    summary: `偵測到「${earlyIntent.intent === "return_request" ? "退貨" : "客訴"}」但客戶無近期訂單，僅記錄稽核`,
                                    meta: { intent: earlyIntent.intent, matched_keywords: earlyIntent.keywords, raw_text: text.slice(0, 500), source: "auto_intent_early_no_order" },
                                    actor: "system:intent_detector",
                                });
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
                                await (0, audit_js_1.writeAuditSafe)(db, {
                                    entityType: "customer", entityId: customerId, action: "intent_gate_non_order",
                                    summary: `意圖關卡判定「${kindLabel}」(信心${verdict.confidence})，未開單`,
                                    meta: { kind: verdict.kind, confidence: verdict.confidence, via: verdict.via, raw_text: text.slice(0, 500), source: "intent_gate" },
                                    actor: "system:intent_gate",
                                });
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
                    // [fix 2026-07-18] 訊息層級建單冪等：redelivery 重用原單、作廢單不復活。
                    const priorForMsg = await findPriorOrderForLineMessage(db, curLineMessageId);
                    if (priorForMsg && priorForMsg.voided) {
                        console.log("[LINE] 作廢單重投遞略過（不復活，自動開單）messageId=%s order=%s", curLineMessageId, priorForMsg.orderId);
                        continue;
                    }
                    // [fix 2026-07-08] 自動開單累加的同日訂單查詢須排除作廢/客訴軟刪除單，否則作廢後客戶再叫貨會附加進作廢單→漏出貨；並加 ORDER BY 取穩定的第一張。
                    let autoOrder = priorForMsg ? null : await db.prepare("SELECT id FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_no").get(customerId, autoOrderDate);
                    let autoOrderId;
                    if (priorForMsg) {
                        autoOrderId = priorForMsg.orderId;
                    }
                    else if (autoOrder) {
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
                // [fix 2026-07-14] 意圖偵測移到 append raw「之前」：客訴/改單/取消/詢送貨/空籃這類
                // 文字不寫進 raw_message——逐則層面本就不解析（A5 修），但一旦進了 raw，結單整單
                // rebuild 仍會把「高麗菜5公斤壞掉了」重建成幽靈品項，繞回 A5 想防的洞。
                // intent 是純 regex 零成本；add_to_order（補叫貨）例外照常寫入（rebuild 需要它）。
                const intentHit = detectCustomerIntent(text);
                const NON_ORDER_INTENTS = ["complaint", "return_request", "cancel_order", "modify_order", "delivery_inquiry", "basket_return"];
                const skipRawForIntent = Boolean(intentHit.intent && NON_ORDER_INTENTS.includes(intentHit.intent));
                if (!skipRawForIntent) {
                    // [fix 2026-07-10] 接手逾時租約重跑（lineMessageIsRetry）時啟用冪等：前次可能已附加同一行
                    await appendRawLineToOrders(db, idsForRaw, text, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
                }
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
                // 客戶意圖偵測（含客訴、退貨、取消、改訂單、詢送貨、補叫貨）——已在 append raw 前算好（intentHit）
                if (intentHit.intent === "complaint" || intentHit.intent === "return_request") {
                    // 客訴 / 退貨：標為 complaint，跳過 AI 解析
                    try {
                        const oldStRow = await db.prepare("SELECT status FROM orders WHERE id = ?").get(orderId);
                        await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + " WHERE id = ?").run("complaint", orderId);
                        console.log("[LINE] 偵測到「" + intentHit.intent + "」意圖 [" + intentHit.keywords.join(",") + "] → 訂單 " + orderId + " 標為 complaint");
                        try {
                            await (0, audit_js_1.writeAuditSafe)(db, {
                                entityType: "order", entityId: orderId, action: "auto_create_complaint",
                                summary: `自動偵測「${intentHit.intent === "return_request" ? "退貨" : "客訴"}」關鍵詞 [${intentHit.keywords.join(",")}]`,
                                meta: { intent: intentHit.intent, matched_keywords: intentHit.keywords, raw_text: text.slice(0, 500), source: "auto_intent", old_status: String(oldStRow?.status || ""), new_status: "complaint" },
                                actor: "system:intent_detector",
                            });
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
                        await (0, audit_js_1.writeAuditSafe)(db, {
                            entityType: "order", entityId: orderId, action: "auto_detect_intent",
                            summary: `自動偵測「${intentLabel}」意圖 [${intentHit.keywords.join(",")}]`,
                            meta: { intent: intentHit.intent, intent_label: intentLabel, matched_keywords: intentHit.keywords, raw_text: text.slice(0, 500), source: "auto_intent" },
                            actor: "system:intent_detector",
                        });
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
                            await appendRawLineToOrders(db, [oid], text, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
                        touchedOrderIds.push(oid);
                        // 逐家成功即併入 session（同圖片路徑）：後面某家失敗時已建子單不變孤兒
                        mergeSessionOrderIds(session, [oid]);
                        await insertParsedItemsForOrder(db, oid, cid, items, fallbackUnit, curLineMessageId);
                    }
                    mergeSessionOrderIds(session, touchedOrderIds);
                    if (lineClient && map.size > 1) {
                        await reply(lineClient, event.replyToken, `收到您的訂單！已為您自動拆分為 ${map.size} 張獨立訂單（${formatSplitSubNamesForReply(new Set(map.keys()))}），我們將盡快處理。`, db, { pushTo: groupId });
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
                            await appendRawLineToOrders(db, [targetOrderId], text, nowSql, lineMessageIsRetry ? { skipIfPresent: true } : undefined);
                        mergeSessionOrderIds(session, [targetOrderId]);
                    }
                    await insertParsedItemsForOrder(db, targetOrderId, cid, parsed, fallbackUnit, curLineMessageId);
                }
                console.log("[LINE] 訂單已寫入", orderId);
            }
            catch (err) {
                eventFailed = true;
                failedCount += 1;
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
                // 成功 → 把入口的 processing 佔位列改標 status='done'（此後同 message.id 的 redelivery 永久略過）；
                //         若佔位列不存在（入口佔位曾因查詢例外「放行」）→ 補 INSERT 一筆 done 完成標記。
                // 失敗 → 釋放記憶體去重＋只 DELETE「自己的 processing 佔位列」（帶 status='processing' 條件，
                //         不會誤刪他實例已寫入的 done 完成標記），讓 LINE redelivery 可整則重跑，不再永久斷單。
                if (ownsLineMessage && curLineMessageId) {
                    const nowSqlDone = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                    if (!eventFailed) {
                        try {
                            // [fix 2026-07-10 #63回歸] done UPDATE 加 claimed_at 條件：本次處理若超過租約時長，
                            // 佔位列可能已被他實例接手（claimed_at 被改掉）——舊寫法無條件改 done 會把「接手者
                            // 處理中」的狀態蓋掉。帶 claimed_at 只標「自己的」列；claimNowIso 為 null（入口佔位
                            // 曾因例外放行、本次沒有自己的列）則跳過 UPDATE 直接走補 INSERT。
                            let doneChanges = 0;
                            if (claimNowIso != null) {
                                const done = await db.prepare(
                                    "UPDATE processed_line_messages SET status = 'done', processed_at = " + nowSqlDone + " WHERE message_id = ? AND claimed_at = ?"
                                ).run(curLineMessageId, claimNowIso);
                                doneChanges = done?.changes ?? 0;
                            }
                            if (doneChanges === 0) {
                                // changes=0 的兩種情況：①列不存在（放行路徑）→ 補 INSERT 完成標記；
                                // ②列存在但 claimed_at 不同＝已被他實例接手 → 不可覆蓋接手者狀態，
                                // ON CONFLICT DO NOTHING 天然安全（列存在時整句無作用），毋須另判斷。
                                await db.prepare(
                                    "INSERT INTO processed_line_messages (message_id, processed_at, status, claimed_at) VALUES (?, " + nowSqlDone + ", 'done', NULL) ON CONFLICT (message_id) DO NOTHING"
                                ).run(curLineMessageId);
                            }
                        } catch (e) {
                            // 完成標記寫失敗：租約逾時後可能被接手重跑本則（有 dupByOrder/記憶體 Set 補位），不阻斷
                            console.warn("[LINE] 完成標記寫入失敗（跨實例重送恐重跑本則）messageId=%s: %s", curLineMessageId, e?.message || e);
                        }
                    } else {
                        releaseLineWebhookMessageOnce(curLineMessageId);
                        // [fix 2026-07-10 #63回歸] 失敗釋放同樣帶 claimed_at 條件只刪「自己的」processing 列：
                        // 被他實例接手後不可誤刪接手者的佔位；claimNowIso 為 null（放行路徑、沒有自己的列）
                        // 則完全不刪——舊寫法會把「他實例正在處理」的 processing 列刪掉造成雙跑。
                        if (claimNowIso != null) {
                            try {
                                await db.prepare("DELETE FROM processed_line_messages WHERE message_id = ? AND status = 'processing' AND claimed_at = ?").run(curLineMessageId, claimNowIso);
                            } catch (_) { /* best-effort：刪不掉時租約 10 分鐘後逾時仍可被接手，不阻斷 */ }
                        }
                        console.warn("[LINE] 訊息處理失敗，已釋放去重佔位供 LINE redelivery 重試 messageId=%s", curLineMessageId);
                    }
                }
            }
        }
        return { failed: failedCount, total: events.length };
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
        // [security 2026-07-28] 未設定 channel secret/token 一律拒收（比照 worker 端點的 503 做法）：
        // 缺 secret 時上方 bot_sdk 簽章中介層不會掛載，若這裡照收＝任何人可 POST 偽造 LINE event
        // 繞過簽章直接建單/改單/觸發盤點。正式環境 hasLineConfig 必為 true，此判斷僅擋「未設定就對外開放」。
        if (!hasLineConfig) {
            console.error("[LINE] webhook 收到 POST 但 LINE_CHANNEL_SECRET/ACCESS_TOKEN 未設定，拒收（避免未驗簽偽造建單）");
            res.status(503).type("text/plain").send("LINE webhook not configured");
            return;
        }
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
                // 改為逐則捕捉，只把「入列失敗」的 events 收集起來 fallback 直接處理。
                // [fix 2026-07-10] 若 fallback 與 worker 仍秒級重疊處理同一則，由 processed_line_messages
                // 的「租約式原子佔位」（入口 INSERT processing ON CONFLICT DO NOTHING）保證只有一方佔位成功，
                // 另一方在入口即略過，不會雙寫品項。
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
                    // 回退直接處理：dedup 三層防止重複下單——記憶體 Set（同實例）＋ orders.line_message_id
                    // （建單訊息）＋ processed_line_messages 租約式原子佔位（跨程序，與 worker 重疊也只有一方成功佔位）
                    // [fix 2026-07-28 §一A5] 閉環：因 res 已回 200，LINE 不會重送。fallback 處理仍失敗＝斷單，
                    // 過去只 console.error → 無人知。改讀 {failed} 並 notifyOps 請人工到訂單審核補單。
                    processLineWebhookEvents(failedEvents)
                        .then((r) => notifyLineIntakeFailure(r, "Cloud Tasks 入列失敗後的 fallback 直接處理"))
                        .catch((e2) => {
                            console.error("[LINE] Cloud Tasks fallback 直接處理失敗:", e2?.message || e2);
                            notifyOpsSafe(`⚠ LINE 收單 fallback 整批拋錯（${failedEvents.length} 則），可能漏單。請到訂單審核確認，必要時請客戶重發。錯誤：${String(e2?.message || e2).slice(0, 120)}`);
                        });
                }
            })();
            return;
        }
        res.status(200).send("OK");
        // [fix 2026-07-28 §一A6] 非 Cloud Tasks 模式同樣閉環：processLineWebhookEvents 回 {failed,total}，
        // 過去 .catch(console.error) 完全沒讀 failed（Gemini 429／DB 瞬斷＝斷單且無告警）。
        processLineWebhookEvents(events)
            .then((r) => notifyLineIntakeFailure(r, "背景直接處理"))
            .catch((e) => {
                console.error("[LINE] 背景處理失敗", e);
                notifyOpsSafe(`⚠ LINE 收單背景處理整批拋錯（${events.length} 則），可能漏單。請到訂單審核確認，必要時請客戶重發。錯誤：${String(e?.message || e).slice(0, 120)}`);
            });
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
        // [fix 2026-07-14] AI 解析（OCR/Gemini 10-40 秒）常超過 replyToken 時效：
        // 呼叫端帶 options.pushTo（群組/用戶 ID）時降級改 push，「客戶必須知道」的訊息
        //（如拆單通知）不再靜默消失。未帶 pushTo 的回覆維持 best-effort 舊行為。
        const pushTo = options?.pushTo;
        if (pushTo && client) {
            try {
                await client.pushMessage(pushTo, { type: "text", text });
                if (dbOptional)
                    recordLineReply(dbOptional).catch(() => {});
                console.log("[LINE] replyToken 失效，已降級用 push 送出");
            }
            catch (pe) {
                console.error("[LINE] push fallback 也失敗:", pe?.message || pe);
            }
        }
    }
}
// 測試掛鉤：拆單純函式與 DB helper（勿在正式流程 require 這個物件）
exports._testables = {
    mustSplitOrdersBySubCustomer,
    groupParsedItemsBySubCustomer,
    markSameDayMainOrdersAsSplitBase,
    findOrCreateSplitTargetOrder,
    getNextOrderNo,
    insertParsedItemsForOrder,
    insertOrderRowWithSplitMeta,
    findPriorOrderForLineMessage,
};
