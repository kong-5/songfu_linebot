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
async function replaceOrderItemsFromParsedRows(db, orderId, customerId, parsed) {
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
        await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, remark, include_export) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)").run(itemId, orderId, resolved?.productId ?? null, p.rawName || "", qty, unit, needReview, itemRemark);
    }
}
/**
 * 文字（略過「[圖片]」行）+ 附件圖逐張解析，合併為一個 parsed 陣列（不寫庫）。
 */
async function collectParsedFromOrderSources(db, customerId, rawMessage, attachmentRows) {
    const custRow = await db.prepare("SELECT default_unit FROM customers WHERE id = ?").get(customerId);
    const fallbackUnit = custRow?.default_unit?.trim() || "公斤";
    let handwritingSuffix = "";
    try {
        handwritingSuffix = await customer_handwriting_hints_js_1.buildPromptSuffixForCustomerHandwritingHints(db, customerId);
    }
    catch (e) {
        console.warn("[rebuild-order] handwriting hints:", e?.message || e);
    }
    const geminiHintOpts = handwritingSuffix ? { extraPromptSuffix: handwritingSuffix } : undefined;
    const imageHintOpts = {
        ...(handwritingSuffix ? { geminiExtraSuffix: handwritingSuffix } : {}),
        db,
        customerId,
    };
    const textForParse = String(rawMessage || "")
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l && l !== "[圖片]")
        .join("\n")
        .trim();
    const parsed = [];
    if (textForParse) {
        const fromText = await (0, parse_order_message_js_1.parseOrderMessage)(textForParse, fallbackUnit, geminiHintOpts);
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
    const hasAtt = Boolean(attachmentRows?.length);
    const hasVisionKey = Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim());
    const hasGeminiKey = Boolean((0, gemini_order_helpers_js_1.getGeminiApiKey)());
    let error = "parse";
    if (!parsed.length) {
        if (!token && hasAtt)
            error = "line_token";
        else if (hasAtt && !hasVisionKey && !hasGeminiKey)
            error = "no_vision";
    }
    return { parsed, error };
}
/** 有解析到至少一筆才覆寫明細；否則保留既有品項 */
async function rebuildOrderItemsFromOrderSources(db, orderId, customerId, rawMessage, attachmentRows) {
    const { parsed, error } = await collectParsedFromOrderSources(db, customerId, rawMessage, attachmentRows);
    if (!parsed.length)
        return { ok: false, error };
    await replaceOrderItemsFromParsedRows(db, orderId, customerId, parsed);
    return { ok: true };
}
