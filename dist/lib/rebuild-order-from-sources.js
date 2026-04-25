"use strict";
/**
 * 依 orders.raw_message + order_attachments 重新解析並**覆寫**明細（與後台「重新辨識」同邏輯）。
 * 供 LINE 結單時整單重算，避免逐則解析與整單解析結果不一致。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceOrderItemsFromParsedRows = replaceOrderItemsFromParsedRows;
exports.collectParsedFromOrderSources = collectParsedFromOrderSources;
exports.rebuildOrderItemsFromOrderSources = rebuildOrderItemsFromOrderSources;
const id_js_1 = require("./id.js");
const parse_order_message_js_1 = require("./parse-order-message.js");
const resolve_product_js_1 = require("./resolve-product.js");
const unit_conversion_js_1 = require("./unit-conversion.js");
const gemini_order_helpers_js_1 = require("./gemini-order-helpers.js");
const line_image_compress_js_1 = require("./line-image-compress.js");
const parse_order_from_image_js_1 = require("./parse-order-from-image.js");
const customer_handwriting_hints_js_1 = require("./customer-handwriting-hints.js");
const order_parsed_heuristics_js_1 = require("./order-parsed-heuristics.js");
async function replaceOrderItemsFromParsedRows(db, orderId, customerId, parsed) {
    parsed = (0, order_parsed_heuristics_js_1.dedupeParsedOrderRows)(Array.isArray(parsed) ? parsed : []);
    const custRow = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(customerId);
    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
    const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
    await db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
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
        if (resolved) {
            const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
            qty = Number(c.quantity);
            unit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(c.unit || fallbackUnit, fallbackUnit);
            if (c.remark) {
                itemRemark = itemRemark ? (itemRemark + "；" + c.remark) : c.remark;
            }
        }
        itemRemark = (0, unit_conversion_js_1.withOriginCallRemark)(itemRemark, p.quantity, inputUnit, unit);
        const subCust = p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null;
        await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark, include_export, sub_customer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)").run(itemId, orderId, resolved?.productId ?? null, p.rawName || "", qty, unit, needReview, itemRemark, subCust);
    }
}
/**
 * 文字（略過「[圖片]」行）+ 附件圖逐張解析，合併為一個 parsed 陣列（不寫庫）。
 */
async function collectParsedFromOrderSources(db, customerId, rawMessage, attachmentRows) {
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
async function rebuildOrderItemsFromOrderSources(db, orderId, customerId, rawMessage, attachmentRows) {
    const { parsed, error } = await collectParsedFromOrderSources(db, customerId, rawMessage, attachmentRows);
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
