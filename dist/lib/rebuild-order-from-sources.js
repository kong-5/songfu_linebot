"use strict";
/**
 * 依 orders.raw_message + order_attachments 重新解析並**覆寫**明細（與後台「重新辨識」同邏輯）。
 * 供 LINE 結單時整單重算，避免逐則解析與整單解析結果不一致。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceOrderItemsFromParsedRows = replaceOrderItemsFromParsedRows;
exports.collectParsedFromOrderSources = collectParsedFromOrderSources;
exports.rebuildOrderItemsFromOrderSources = rebuildOrderItemsFromOrderSources;
exports.normalizeOrderItemMatchKey = normalizeOrderItemMatchKey;
const id_js_1 = require("./id.js");
const parse_order_message_js_1 = require("./parse-order-message.js");
const resolve_product_js_1 = require("./resolve-product.js");
const unit_conversion_js_1 = require("./unit-conversion.js");
const gemini_order_helpers_js_1 = require("./gemini-order-helpers.js");
const line_image_compress_js_1 = require("./line-image-compress.js");
const parse_order_from_image_js_1 = require("./parse-order-from-image.js");
const customer_handwriting_hints_js_1 = require("./customer-handwriting-hints.js");
const order_parsed_heuristics_js_1 = require("./order-parsed-heuristics.js");
/** [fix 2026-07-10] order_item_edits.match_key 正規化：去空白＋小寫。
 * LINE 改單記錄端（webhook/line.js）與此處 rebuild 重放端共用同一實作，勿各自另寫。 */
function normalizeOrderItemMatchKey(s) {
    return String(s ?? "").replace(/\s+/g, "").toLowerCase();
}
/**
 * [fix 2026-07-10] rebuild 後重放「人工改單軌跡」（order_item_edits）。
 * 背景：結單整單重辨識會 DELETE 全部 order_items 依 raw_message 重建，但 LINE 改單指令
 * （「改第N項」「刪第N項」）被 isRawMessageNoise 排除在 raw_message 外 → 人工修正會被默默還原。
 * 修法：改單當下 webhook 端同步寫 order_item_edits（match_key＝當下品項 raw_name 快照正規化），
 * 這裡在重建 INSERT 完成後、同一交易內依 created_at 升冪重放：
 *   - set    → 以 match_key 對正規化 raw_name 找重建後品項（多筆取第一筆）更新 quantity/unit；
 *              對不到品項 → 視為 add（人工確認過的內容不可默默消失）。
 *   - delete → 刪除第一筆匹配品項；對不到＝重建本來就沒有該品項，視為已生效。
 *   - add    → 以軌跡的 raw_name/quantity/unit 補插一筆，display_order 排最後、need_review=1。
 * 注意：h 為交易 handle（或無交易時的 db 本體），全程沿用呼叫端交易，失敗會整批 ROLLBACK。
 */
async function replayOrderItemEditsInTx(h, orderId) {
    let edits = [];
    try {
        edits = await h.prepare("SELECT id, action, match_key, raw_name, quantity, unit, remark, created_at FROM order_item_edits WHERE order_id = ? ORDER BY created_at ASC, id ASC").all(orderId);
    }
    catch (e) {
        // 表不存在（舊庫尚未 init）等情況：略過重放，不阻斷 rebuild 本體
        console.warn("[rebuild-order] 讀取人工改單軌跡失敗（略過重放）orderId=%s: %s", orderId, e?.message || e);
        return;
    }
    if (!edits || !edits.length)
        return;
    // 重建後的品項快照（newId 帶時間前綴，ORDER BY id ≒ 插入順序＝顯示順序）；「取第一筆」以此序為準
    const itemRows = await h.prepare("SELECT id, raw_name FROM order_items WHERE order_id = ? ORDER BY id").all(orderId);
    const live = (itemRows || []).map((it) => ({ id: it.id, key: normalizeOrderItemMatchKey(it.raw_name), deleted: false }));
    // add／set 補插的 display_order 排最後：既有全 NULL 時維持 NULL（讀取端以 id 序為準，時間前綴已保證排最後）
    const maxRow = await h.prepare("SELECT MAX(display_order) AS m FROM order_items WHERE order_id = ?").get(orderId);
    let nextDisplayOrder = maxRow && maxRow.m != null ? Number(maxRow.m) + 1 : null;
    let setCnt = 0;
    let delCnt = 0;
    let addCnt = 0;
    for (const ed of edits) {
        const action = String(ed.action || "").trim().toLowerCase();
        // match_key 為權威；舊資料若缺 match_key 則退回以 raw_name 現算（同一正規化）
        const key = normalizeOrderItemMatchKey(ed.match_key != null && String(ed.match_key).trim() !== "" ? ed.match_key : ed.raw_name);
        const hit = key ? live.find((x) => !x.deleted && x.key === key) : null;
        if (action === "delete") {
            if (hit) {
                await h.prepare("DELETE FROM order_items WHERE id = ? AND order_id = ?").run(hit.id, orderId);
                hit.deleted = true;
                delCnt += 1;
                console.log("[rebuild-order] 重放改單軌跡 delete：%s（itemId=%s editId=%s）", ed.raw_name || key, hit.id, ed.id);
            }
            continue;
        }
        if (action === "set" || action === "add") {
            const qty = Number.isFinite(Number(ed.quantity)) ? Number(ed.quantity) : 0;
            const unitVal = ed.unit != null && String(ed.unit).trim() !== "" ? String(ed.unit).trim() : null;
            if (action === "set" && hit) {
                if (unitVal != null)
                    await h.prepare("UPDATE order_items SET quantity = ?, unit = ? WHERE id = ? AND order_id = ?").run(qty, unitVal, hit.id, orderId);
                else
                    await h.prepare("UPDATE order_items SET quantity = ? WHERE id = ? AND order_id = ?").run(qty, hit.id, orderId);
                setCnt += 1;
                console.log("[rebuild-order] 重放改單軌跡 set：%s → %s%s（itemId=%s editId=%s）", ed.raw_name || key, qty, unitVal || "", hit.id, ed.id);
                continue;
            }
            // set 對不到品項（rebuild 解析結果沒有該品名）→ 視為 add 補插；need_review=1 供後台複核
            const itemId = (0, id_js_1.newId)("item");
            await h.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark, include_export, display_order) VALUES (?, ?, NULL, ?, ?, ?, 1, ?, 1, ?)")
                .run(itemId, orderId, ed.raw_name || key || "", qty, unitVal, ed.remark != null && String(ed.remark).trim() !== "" ? String(ed.remark).trim() : null, nextDisplayOrder);
            if (nextDisplayOrder != null)
                nextDisplayOrder += 1;
            live.push({ id: itemId, key, deleted: false });
            addCnt += 1;
            console.log("[rebuild-order] 重放改單軌跡 %s（補插）：%s %s%s（itemId=%s editId=%s）", action === "set" ? "set→add" : "add", ed.raw_name || key, qty, unitVal || "", itemId, ed.id);
            continue;
        }
        console.warn("[rebuild-order] 未知改單軌跡 action=%s（略過）editId=%s orderId=%s", ed.action, ed.id, orderId);
    }
    console.log("[rebuild-order] 人工改單軌跡重放完成 orderId=%s 軌跡=%d 筆（set更新=%d、delete刪除=%d、補插=%d）", orderId, edits.length, setCnt, delCnt, addCnt);
}
async function replaceOrderItemsFromParsedRows(db, orderId, customerId, parsed) {
    parsed = (0, order_parsed_heuristics_js_1.dedupeParsedOrderRows)(Array.isArray(parsed) ? parsed : []);
    const custRow = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(customerId);
    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
    const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
    // [fix 2026-07-08] 先把每一列（含料號對應、單位換算等純讀取）算好，收成待插入陣列；
    // 再把 DELETE + 逐筆 INSERT 包進單一交易。過去是「先 DELETE 再逐筆 INSERT，無交易」，
    // 中途任一步失敗（DB 瞬斷、料號對應時連線壞）明細會直接消失或只剩一半。
    // 讀取放交易外＝交易只含純寫入、時間短，不長時間佔住連線。
    const rows = [];
    for (const p of parsed) {
        const itemId = (0, id_js_1.newId)("item");
        let qty = Number.isFinite(Number(p.quantity)) ? Number(p.quantity) : 0;
        let resolved = null;
        try {
            resolved = await (0, resolve_product_js_1.resolveProductName)(db, p.rawName, customerId);
        }
        catch (_e) {
            resolved = null;
        }
        const needReview = resolved ? 0 : 1;
        const inputUnit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(p.unit, fallbackUnit);
        let unit = inputUnit;
        let itemRemark = p.remark != null && String(p.remark).trim() !== "" ? String(p.remark).trim() : null;
        {
            // 內建物理換算（台斤/斤/台兩/克→公斤）一律套用；品項規則在函式內部才需已對應
            const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
            qty = Number(c.quantity);
            unit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(c.unit || fallbackUnit, fallbackUnit);
            if (c.remark) {
                itemRemark = itemRemark ? (itemRemark + "；" + c.remark) : c.remark;
            }
        }
        itemRemark = (0, unit_conversion_js_1.withOriginCallRemark)(itemRemark, p.quantity, inputUnit, unit);
        const subCust = p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null;
        const confidence = p.confidenceScore != null && Number.isFinite(Number(p.confidenceScore))
            ? Math.max(0, Math.min(100, Math.round(Number(p.confidenceScore))))
            : null;
        rows.push([itemId, orderId, resolved?.productId ?? null, p.rawName || "", qty, unit, needReview, itemRemark, subCust, confidence]);
    }
    const doWrite = async (h) => {
        await h.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
        for (const r of rows) {
            await h.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark, include_export, sub_customer, confidence_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").run(...r);
        }
        // [fix 2026-07-10] 重建完成後、同一交易內重放人工改單軌跡（order_item_edits），
        // 避免 LINE「改第N項／刪第N項」等人工修正被 rebuild 默默還原（同日重開 session 再結單也會再覆寫一次）。
        await replayOrderItemEditsInTx(h, orderId);
    };
    if (typeof db.transaction === "function") {
        await db.transaction(doWrite);
    }
    else {
        await doWrite(db);
    }
}
/**
 * 文字（略過「[圖片]」行）+ 附件圖逐張解析，合併為一個 parsed 陣列（不寫庫）。
 */
async function collectParsedFromOrderSources(db, customerId, rawMessage, attachmentRows, imageExtraOpts) {
    const custRow = await db.prepare("SELECT default_unit, known_sub_customers FROM customers WHERE id = ?").get(customerId);
    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
    const knownSub = custRow?.known_sub_customers != null ? String(custRow.known_sub_customers).trim() : "";
    let handwritingSuffix = "";
    try {
        handwritingSuffix = await customer_handwriting_hints_js_1.buildPromptSuffixForCustomerHandwritingHints(db, customerId);
    }
    catch (e) {
        console.warn("[rebuild-order] handwriting hints:", e?.message || e);
    }
    const geminiHintOpts = {
        ...(handwritingSuffix ? { extraPromptSuffix: handwritingSuffix } : {}),
        ...(knownSub ? { knownSubCustomers: knownSub } : {}),
        db,
        customerId,
    };
    const imageHintOpts = {
        ...(handwritingSuffix ? { geminiExtraSuffix: handwritingSuffix } : {}),
        ...(knownSub ? { knownSubCustomers: knownSub } : {}),
        db,
        customerId,
        // 人工旋轉重新辨識：forceRotateDeg / skipAutoOrient 由呼叫端透傳到圖片解析
        ...(imageExtraOpts && Number.isFinite(Number(imageExtraOpts.forceRotateDeg)) ? { forceRotateDeg: Number(imageExtraOpts.forceRotateDeg) } : {}),
        ...(imageExtraOpts && imageExtraOpts.skipAutoOrient ? { skipAutoOrient: true } : {}),
    };
    const textForParse = String(rawMessage || "")
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l && l !== "[圖片]")
        .join("\n")
        .trim();
    let parsed = [];
    if (textForParse) {
        const fromText = await (0, parse_order_message_js_1.parseOrderMessage)(textForParse, fallbackUnit, Object.keys(geminiHintOpts).length ? geminiHintOpts : undefined);
        parsed.push(...fromText);
    }
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
    if (attachmentRows?.length && token) {
        for (const row of attachmentRows) {
            const mid = row.line_message_id;
            if (!mid)
                continue;
            try {
                const resp = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(mid)}/content`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!resp.ok) {
                    console.warn("[rebuild-order] LINE 圖片 HTTP %s messageId=%s", resp.status, mid);
                    continue;
                }
                const rawBuf = Buffer.from(await resp.arrayBuffer());
                const buf = await (0, line_image_compress_js_1.compressLineImageBuffer)(rawBuf);
                const { parsed: fromImg } = await (0, parse_order_from_image_js_1.parseOrderItemsFromImageBuffer)(buf, fallbackUnit, imageHintOpts);
                parsed.push(...fromImg);
            }
            catch (e) {
                console.warn("[rebuild-order] 取圖／解析失敗:", e?.message || e);
            }
        }
    }
    if (parsed.length)
        parsed = (0, order_parsed_heuristics_js_1.dedupeParsedOrderRows)(parsed);
    const hasText = Boolean(textForParse);
    const hasAtt = Boolean(attachmentRows?.length);
    const hasVisionKey = Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim());
    const hasGeminiKey = Boolean((0, gemini_order_helpers_js_1.getGeminiApiKey)());
    let error = "parse";
    if (!parsed.length) {
        if (!hasText && !hasAtt)
            error = "empty_source";
        else if (hasText && !hasGeminiKey)
            error = "no_gemini_key";
        else if (hasAtt && !token)
            error = "line_token";
        else if (hasAtt && !hasVisionKey && !hasGeminiKey)
            error = "no_vision";
        else if (hasText && hasGeminiKey)
            error = "gemini_empty";
    }
    return { parsed, error };
}
/** order_sub_split_key：NULL＝未拆單（整張單重算全部品項）；空字串＝拆單後「主客戶／預設」桶；非空＝該子客戶名稱 */
function filterParsedRowsForOrderSplit(parsed, orderSubSplitKey) {
    if (orderSubSplitKey === undefined || orderSubSplitKey === null)
        return parsed;
    if (orderSubSplitKey === "")
        return parsed.filter((p) => {
            const sc = p.subCustomer;
            return sc == null || String(sc).trim() === "";
        });
    const k = String(orderSubSplitKey);
    return parsed.filter((p) => String(p.subCustomer || "").trim() === k);
}
/** 有解析到至少一筆才覆寫明細；否則保留既有品項 */
async function rebuildOrderItemsFromOrderSources(db, orderId, customerId, rawMessage, attachmentRows, imageExtraOpts) {
    const { parsed, error } = await collectParsedFromOrderSources(db, customerId, rawMessage, attachmentRows, imageExtraOpts);
    if (!parsed.length)
        return { ok: false, error };
    const meta = await db.prepare("SELECT order_sub_split_key FROM orders WHERE id = ?").get(orderId);
    const splitKey = meta?.order_sub_split_key !== undefined ? meta.order_sub_split_key : null;
    const filtered = filterParsedRowsForOrderSplit(parsed, splitKey);
    if (!filtered.length)
        return { ok: false, error: splitKey != null ? "split_no_match" : error };
    await replaceOrderItemsFromParsedRows(db, orderId, customerId, filtered);
    return { ok: true };
}
