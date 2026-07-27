"use strict";
// LINE 收單的訂單寫入 helper（自 webhook/line.js 拆出，拆檔批次 9）。
// 每支都以 db 為第一參數、不持有狀態，唯一例外是 orderNoLockChain（同日取號的序列化鏈，
// 與 getNextOrderNo 綁在一起搬移）。webhook/line.js 與 test/_testables 皆自本檔取用。
Object.defineProperty(exports, "__esModule", { value: true });

const id_js_1 = require("./id.js");
const resolve_product_js_1 = require("./resolve-product.js");
const unit_conversion_js_1 = require("./unit-conversion.js");
const rebuild_order_from_sources_js_1 = require("./rebuild-order-from-sources.js");
const order_parsed_heuristics_js_1 = require("./order-parsed-heuristics.js");
// 標桶＋找目標單邏輯的共用 lib（webhook/line.js 亦自行 require，同模組快取、無循環）
const { findSplitTargetOrderId, isSplitKeyUniqueConflict } = require("./order-split.js");

function normalizeOrderUnit(raw, fallbackUnit) {
    return (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(raw, fallbackUnit);
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
/** [fix 2026-07-18] 訊息層級建單冪等（防 H2 重複訂單／作廢單復活）。
 * LINE webhook 與 Cloud Tasks 皆 at-least-once：同一則訊息可能重投遞。既有防線：
 *   - processed_line_messages 租約：成功標 'done' 後同訊息永久略過；失敗才釋放讓重跑。
 *   - 四個建單點的「同日重用查詢」：重投遞會撈回上次建的 pending 單、品項再被 src 去重擋掉。
 * 殘餘洞：上次建了單、之後被人工作廢/客訴，且租約已因前次失敗釋放時，重投遞的同日重用
 * 查詢刻意排除作廢單→撈不到→又開一張新 pending 單、品項重灌＝把人工作廢的單硬生生復活。
 * 本 helper 用 orders.line_message_id（已建索引 idx_orders_line_message_id）精準對到
 * 「這則訊息開的那張單」：
 *   - 非作廢 → 回 { orderId, voided:false }：重用（redelivery 落回同一張，品項 per-order 去重生效）。
 *   - 已作廢/客訴 → 回 { orderId, voided:true }：呼叫端尊重作廢，重投遞不再建單也不灌品項。
 *   - 查無 → 回 null：走既有同日重用／新建。
 * 只認 line_message_id、不碰拆單唯一索引，故不影響子客戶拆單（一則訊息本就會寫進多張子單，
 * 且拆單走 findOrCreateSplitTargetOrder，不經此 helper）。 */
async function findPriorOrderForLineMessage(db, lineMessageId) {
    const mid = lineMessageId != null && String(lineMessageId).trim() !== "" ? String(lineMessageId).trim() : null;
    if (!mid)
        return null;
    try {
        const row = await db.prepare("SELECT id, status FROM orders WHERE line_message_id = ? ORDER BY order_no LIMIT 1").get(mid);
        if (!row)
            return null;
        const st = String(row.status || "").toLowerCase().trim();
        return { orderId: row.id, voided: st === "deleted" || st === "complaint" };
    }
    catch (_) {
        // 舊庫無 line_message_id 欄位等：降級回 null，行為同未加 guard（不阻斷收單）。
        return null;
    }
}
/** [fix 2026-07-10] 依子客戶分流時「找到或建立」目標訂單（比照後台 resolveSplitTargetOrder）。
 * 舊行為是每次拆單都無條件新建訂單：同一群組上午、下午各傳一次同一子客戶的叫貨，
 * 或多則訊息各自拆單，會冒出多張同子客戶的當日訂單。改為同客戶＋同日＋同 split key 重用。
 * subKey ''＝主客戶桶（連同 NULL 舊主訂單一併視為同桶）。回傳 { orderId, created }。 */
async function findOrCreateSplitTargetOrder(db, getNextOrderNo, nowSql, { customerId, orderDate, groupId, subKey, rawMessage, lineMessageId }) {
    const found = await findSplitTargetOrderId(db, customerId, orderDate, subKey);
    if (found)
        return { orderId: found, created: false };
    try {
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
    catch (e) {
        // [fix 2026-07-14] 撞拆單唯一索引（ux_orders_split_key_day）＝並發下別的 worker 剛建了
        // 同 key 單 → 改重查重用，訊息品項會累加到那張單，不再各開一張造成重複出貨。
        if (isSplitKeyUniqueConflict(e)) {
            const again = await findSplitTargetOrderId(db, customerId, orderDate, subKey);
            if (again) {
                console.warn("[split] 併發撞拆單唯一索引，改併入既有單 %s（customer=%s date=%s key=%s）", again, customerId, orderDate, subKey);
                return { orderId: again, created: false };
            }
        }
        throw e;
    }
}
/** [fix 2026-07-14] 品項寫入重構為「交易外解析、交易內原子寫入＋冪等鍵」：
 * 1. 冪等：srcLineMessageId（來源 LINE 訊息 id）寫進每筆品項。redelivery／租約重跑時，
 *    同 (order, 訊息) 已有品項＝上次已完整寫入（寫入是原子的）→ 整批略過，不再雙倍。
 * 2. 原子：解析/單位換算（含 AI fallback、DB 查詢）全部先算完，INSERT 才進 db.transaction——
 *    過去逐筆 auto-commit，中途炸掉會留「寫一半的品項」，redelivery 重跑再全插一次＝部分雙倍。
 * 改單軌跡抵銷（delete→add）也一併進交易；srcLineMessageId 未傳（理論上不會）時行為同舊版但仍原子。 */
async function insertParsedItemsForOrder(db, orderId, customerId, parsedRows, fallbackUnit, srcLineMessageId) {
    const rows = (0, order_parsed_heuristics_js_1.dedupeParsedOrderRows)(Array.isArray(parsedRows) ? parsedRows : []);
    if (!rows.length)
        return { inserted: 0, skipped: false };
    const srcMid = srcLineMessageId != null && String(srcLineMessageId).trim() !== "" ? String(srcLineMessageId).trim() : null;
    // [fix 2026-07-18 安全網] 一律不把品項寫進已作廢/客訴的訂單（任何路徑）——與訊息層級建單守衛互補：
    // 就算某條路徑漏了守衛、或並發下目標單剛被作廢，也不會把品項灌進作廢單造成幽靈出貨。
    // 拆單安全：拆單建立的是 pending 子單，不受此影響（不像「跨單去重」會誤刪第二個子客戶品項）。
    // 交易外快篩；交易內（doInsert）會以同一條件再檢一次防並發。
    try {
        const st0 = await db.prepare("SELECT status FROM orders WHERE id = ?").get(orderId);
        const st0s = String(st0?.status || "").toLowerCase().trim();
        if (st0s === "deleted" || st0s === "complaint") {
            console.log("[LINE] 品項略過：目標訂單已作廢/客訴 orderId=%s status=%s", orderId, st0s);
            return { inserted: 0, skipped: true };
        }
    }
    catch (_) { /* 查詢失敗不阻斷收單，交由交易內覆檢 */ }
    // 冪等預檢（交易外快篩；交易內會再檢一次防並發）
    if (srcMid) {
        try {
            const dup = await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = ? AND src_line_message_id = ?").get(orderId, srcMid);
            if (dup && Number(dup.n || 0) > 0) {
                console.log("[LINE] 品項冪等略過（同訊息已寫入 %s 筆）orderId=%s msg=%s", dup.n, orderId, srcMid);
                return { inserted: 0, skipped: true };
            }
        } catch (_) { /* 舊庫尚無欄位等：照舊寫入 */ }
    }
    const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
    // ── 交易外：解析、換算、軌跡查詢全部算完（AI fallback／DB 讀都在這，不佔交易） ──
    const prepared = [];
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
        let needReviewFlag = resolved ? 0 : 1;
        // 極端值防線（文字路徑過去完全沒有；圖片路徑另有 OCR 雜訊過濾）：
        // 負數或異常大量（>10000，公斤類 >5000）不丟棄也不擋單——強制 need_review＋備註標明，
        // 出貨前一定有人看過。Gemini 幻覺或電話號碼被誤讀成數量時，不再靜默入庫。
        {
            const uNorm = String(unit || "").trim().toLowerCase();
            const isKgish = uNorm === "公斤" || uNorm === "kg" || uNorm === "k";
            let extremeNote = null;
            if (qty < 0) extremeNote = "⚠ 數量為負數，請人工確認原文";
            else if (qty > 10000 || (isKgish && qty > 5000)) extremeNote = "⚠ 數量異常大（" + qty + (unit || "") + "），請人工確認原文";
            if (extremeNote) {
                needReviewFlag = 1;
                itemRemark = itemRemark ? (itemRemark + "；" + extremeNote) : extremeNote;
            }
        }
        const subC = item.subCustomer != null && String(item.subCustomer).trim() !== "" ? String(item.subCustomer).trim() : null;
        const confidence = item.confidenceScore != null && Number.isFinite(Number(item.confidenceScore))
            ? Math.max(0, Math.min(100, Math.round(Number(item.confidenceScore))))
            : null;
        // [fix 2026-07-10] 刪項軌跡的時間邊界：客戶「刪第N項」後同日又叫同品項時，結單 rebuild
        // 依 created_at 重放 delete 會把「重叫」的品項也刪掉（漏出貨）。故品項寫入時若該單
        // order_item_edits 已有同 match_key 的「delete」軌跡 → 追加 action='add' 抵銷。
        // [fix 2026-07-10 #63回歸] 「只有 set → 追加新 set」規則已移除（加購語意會蓋掉人工修正）。
        // 查詢失敗吞錯不阻斷收單（降級＝結單 rebuild 可能還原）。
        let needAddEdit = false;
        try {
            const mk = (0, rebuild_order_from_sources_js_1.normalizeOrderItemMatchKey)(item.rawName);
            if (mk) {
                const priorEdits = await db.prepare("SELECT action FROM order_item_edits WHERE order_id = ? AND match_key = ?").all(orderId, mk);
                if (priorEdits && priorEdits.length) {
                    const priorActs = priorEdits.map((r) => String(r.action || "").trim().toLowerCase());
                    if (priorActs.includes("delete"))
                        needAddEdit = true;
                }
            }
        } catch (e) {
            console.warn("[LINE] 改單軌跡抵銷檢查失敗（結單 rebuild 可能還原此品項）orderId=%s item=%s: %s", orderId, item.rawName, e?.message || e);
        }
        prepared.push({ itemId, productId, rawName: item.rawName, qty, unit, needReviewFlag, itemRemark, subC, confidence, needAddEdit });
    }
    // ── 交易內：純寫入（sqlite transaction 限制：fn 內不得 await 外部 I/O） ──
    const doInsert = async (h) => {
        // [fix 2026-07-18 安全網] 交易內權威覆檢：目標單若已作廢/客訴則不寫入（防並發下剛被作廢）。
        const stx = await h.prepare("SELECT status FROM orders WHERE id = ?").get(orderId);
        const stxs = String(stx?.status || "").toLowerCase().trim();
        if (stxs === "deleted" || stxs === "complaint")
            return { inserted: 0, skipped: true };
        if (srcMid) {
            const dup = await h.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id = ? AND src_line_message_id = ?").get(orderId, srcMid);
            if (dup && Number(dup.n || 0) > 0)
                return { inserted: 0, skipped: true };
        }
        for (const p of prepared) {
            await h.prepare(`INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark, sub_customer, confidence_score, src_line_message_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.itemId, orderId, p.productId, p.rawName, p.qty, p.unit, p.needReviewFlag, p.itemRemark, p.subC, p.confidence, srcMid);
            if (p.needAddEdit) {
                // rethrow：交易內吞錯會毒化 PG 交易（見 recordOrderItemEdit 註解），失敗就整批 ROLLBACK 上拋
                await recordOrderItemEdit(h, { orderId, action: "add", rawName: p.rawName, quantity: p.qty, unit: p.unit, editedBy: "system:reorder_after_delete" }, { rethrow: true });
            }
        }
        return { inserted: prepared.length, skipped: false };
    };
    if (typeof db.transaction === "function")
        return await db.transaction(doInsert);
    return await doInsert(db);
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
async function appendRawLineToOrders(db, orderIds, lineText, nowSql, opts) {
    const line = String(lineText ?? "").trim();
    if (!line || !orderIds?.length)
        return;
    if (isRawMessageNoise(line)) return;
    // [fix 2026-07-10] skipIfPresent：僅「接手逾時租約的重跑」（isRetry）路徑啟用——前次執行可能已把
    // 同一行附加進 raw_message，重跑再附加會使結單 rebuild 品項雙倍。
    // 正常路徑不啟用：客戶連傳兩則相同文字仍應是兩行（行為不變）。
    // [fix 2026-07-10 #63回歸] 附加內容可能是「多行」（圖片 OCR 文字整段附加）：比對改為
    // 「整段＋行邊界」——把既有 raw 與待附加內容都用換行包起來做子字串比對，
    // 單行時等價於舊的逐行完全比對（split('\n').includes），多行時要求整段連續出現才算已附加
    // （逐行比對會把「部分行已存在」誤判為已附加而漏掉整段，故採整段比對）。
    const skipIfPresent = Boolean(opts && opts.skipIfPresent);
    for (const oid of orderIds) {
        if (skipIfPresent) {
            try {
                const prevRow = await db.prepare("SELECT raw_message FROM orders WHERE id = ?").get(oid);
                const prevRaw = String(prevRow?.raw_message ?? "");
                if (("\n" + prevRaw + "\n").includes("\n" + line + "\n")) {
                    console.log("[LINE] raw_message 已含完全相同內容段（重跑冪等略過）orderId=%s", oid);
                    continue;
                }
            } catch (_) { /* 查詢失敗照舊附加（寧可重複不可斷單） */ }
        }
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
 * 寫入失敗僅告警不阻斷回覆：此時修改本身已生效，只是結單 rebuild 可能還原（降級而非斷單）。
 * ⚠ 交易內呼叫必須帶 opts.rethrow：PG 交易內任一句失敗即毒化（25P02），吞掉例外會讓
 * 後續語句靜默失敗、COMMIT 實為 ROLLBACK 卻回報成功（整批品項沒寫入但回 inserted:n）。 */
async function recordOrderItemEdit(db, { orderId, action, rawName, quantity, unit, editedBy }, opts) {
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
        if (opts && opts.rethrow) throw e;
        console.warn("[LINE] 改單軌跡寫入失敗（結單 rebuild 可能還原此人工修正）orderId=%s action=%s: %s", orderId, action, e?.message || e);
    }
}
async function duplicateAttachmentToOrders(db, lineMessageId, orderIds, nowSql) {
    if (!lineMessageId || !orderIds?.length)
        return;
    for (const oid of orderIds) {
        // [fix 2026-07-10] 冪等：同 (order_id, line_message_id) 已存在就略過（接手逾時租約重跑、
        // 跨程序重疊等重試路徑不重複掛同一張圖，否則結單 rebuild 逐附件解析會品項雙倍）。
        // 查重失敗照插（寧可重複附件不可漏圖）。
        try {
            const dup = await db.prepare("SELECT id FROM order_attachments WHERE order_id = ? AND line_message_id = ? LIMIT 1").get(oid, lineMessageId);
            if (dup) {
                console.log("[LINE] 附件已存在（冪等略過）orderId=%s lineMessageId=%s", oid, lineMessageId);
                continue;
            }
        } catch (_) { /* 查重失敗照插 */ }
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
exports.normalizeOrderUnit = normalizeOrderUnit;
exports.insertOrderRowWithSplitMeta = insertOrderRowWithSplitMeta;
exports.findPriorOrderForLineMessage = findPriorOrderForLineMessage;
exports.findOrCreateSplitTargetOrder = findOrCreateSplitTargetOrder;
exports.insertParsedItemsForOrder = insertParsedItemsForOrder;
exports.isRawMessageNoise = isRawMessageNoise;
exports.appendRawLineToOrders = appendRawLineToOrders;
exports.recordOrderItemEdit = recordOrderItemEdit;
exports.duplicateAttachmentToOrders = duplicateAttachmentToOrders;
exports.notifyManagerOfComplaint = notifyManagerOfComplaint;
exports.upsertPendingLineGroup = upsertPendingLineGroup;
exports.getNextOrderNo = getNextOrderNo;
