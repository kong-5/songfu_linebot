"use strict";
/**
 * 客戶筆跡／辨識對照：人工核定 raw_name → product_id 後累積，供 Gemini 提示與 resolve 優先對應。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeHandwritingRawKey = normalizeHandwritingRawKey;
exports.recordHandwritingHint = recordHandwritingHint;
exports.recordHandwritingHintsForOrder = recordHandwritingHintsForOrder;
exports.buildPromptSuffixForCustomerHandwritingHints = buildPromptSuffixForCustomerHandwritingHints;
const id_js_1 = require("./id.js");
/** 與品名別名類似：去空白與常見標點，英文小寫，利於同一手寫不同空白對到同一列 */
function normalizeHandwritingRawKey(s) {
    return String(s || "")
        .trim()
        .replace(/[\s,，.。、]/g, "")
        .toLowerCase();
}
async function recordHandwritingHint(db, customerId, rawName, productId) {
    const raw_key = normalizeHandwritingRawKey(rawName);
    if (!customerId || !productId || !raw_key || raw_key.length < 2)
        return;
    const raw_name_last = String(rawName || "").trim();
    const id = (0, id_js_1.newId)("hwh");
    const updated_at = new Date().toISOString();
    await db.prepare(`INSERT INTO customer_handwriting_hints (id, customer_id, raw_key, raw_name_last, product_id, hit_count, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(customer_id, raw_key) DO UPDATE SET
      product_id = excluded.product_id,
      raw_name_last = excluded.raw_name_last,
      hit_count = customer_handwriting_hints.hit_count + 1,
      updated_at = excluded.updated_at`).run(id, customerId, raw_key, raw_name_last, productId, updated_at);
}
async function recordHandwritingHintsForOrder(db, orderId) {
    const row = await db.prepare("SELECT customer_id FROM orders WHERE id = ?").get(orderId);
    const customerId = row?.customer_id;
    if (!customerId)
        return;
    const items = await db.prepare("SELECT raw_name, product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL").all(orderId);
    for (const it of items || []) {
        if (it?.raw_name && String(it.raw_name).trim())
            await recordHandwritingHint(db, customerId, it.raw_name, it.product_id);
    }
}
async function buildPromptSuffixForCustomerHandwritingHints(db, customerId) {
    if (!customerId)
        return "";
    const rows = await db.prepare(`SELECT h.raw_name_last, h.raw_key, p.name AS product_name, h.hit_count
    FROM customer_handwriting_hints h
    JOIN products p ON p.id = h.product_id AND (p.active IS NULL OR p.active = 1)
    WHERE h.customer_id = ?
    ORDER BY h.hit_count DESC, h.updated_at DESC
    LIMIT 60`).all(customerId);
    if (!rows?.length)
        return "";
    const lines = rows.map((r) => {
        const left = (r.raw_name_last || r.raw_key || "").trim() || r.raw_key;
        return `- 「${left}」→ 標準品名「${r.product_name || ""}」（已核對 ${r.hit_count || 1} 次）`;
    });
    return (`以下為本客戶「人工核對過」的辨識原文與標準品名對照（筆跡學習資料庫）。若圖像／OCR 出現與左側相近字樣，**品項**欄請優先使用右側標準名；數量與單位仍依圖面為準：\n` +
        lines.join("\n"));
}
