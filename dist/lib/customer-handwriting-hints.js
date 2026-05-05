"use strict";
/**
 * 客戶筆跡／辨識對照：人工核定 raw_name → product_id 後累積，供 Gemini 提示與 resolve 優先對應。
 *
 * 學習迴圈衰減策略（避免「越用越歪」）：
 *  - hit_count：人工核可加 1
 *  - wrong_count：人工從舊 product 改成新 product 時，給「舊 hint」加 1（負面訊號）
 *  - last_hit_at：每次正面命中更新；用於以天數做指數衰減
 *  - 有效分數 score = max(0, hit_count - wrong_count*3) * exp(-days_since_last_hit / HALF_LIFE_DAYS)
 *    score < 0.5 的 hint 不會餵進 prompt，避免老資料蓋過新筆跡
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeHandwritingRawKey = normalizeHandwritingRawKey;
exports.recordHandwritingHint = recordHandwritingHint;
exports.recordHandwritingHintWrong = recordHandwritingHintWrong;
exports.recordHandwritingHintsForOrder = recordHandwritingHintsForOrder;
exports.buildPromptSuffixForCustomerHandwritingHints = buildPromptSuffixForCustomerHandwritingHints;
exports.computeHandwritingHintScore = computeHandwritingHintScore;
const id_js_1 = require("./id.js");
const HALF_LIFE_DAYS = Number(process.env.HANDWRITING_HINT_HALF_LIFE_DAYS || 60);
const WRONG_PENALTY = Number(process.env.HANDWRITING_HINT_WRONG_PENALTY || 3);
const MIN_USEFUL_SCORE = Number(process.env.HANDWRITING_HINT_MIN_SCORE || 0.5);
/** 與品名別名類似：去空白與常見標點，英文小寫，利於同一手寫不同空白對到同一列 */
function normalizeHandwritingRawKey(s) {
    return String(s || "")
        .trim()
        .replace(/[\s,，.。、]/g, "")
        .toLowerCase();
}
/** score = max(0, hit_count - wrong_count*PENALTY) * exp(-days/half_life)；hit_count 0 視為新建（給較小但非零基礎分） */
function computeHandwritingHintScore(hitCount, wrongCount, lastHitAt, now) {
    const hits = Math.max(0, Number(hitCount) || 0);
    const wrongs = Math.max(0, Number(wrongCount) || 0);
    const base = Math.max(0, hits - wrongs * WRONG_PENALTY);
    if (base <= 0)
        return 0;
    const ts = lastHitAt ? Date.parse(String(lastHitAt)) : NaN;
    if (!Number.isFinite(ts))
        return base;
    const nowMs = now ? Date.parse(String(now)) : Date.now();
    const days = Math.max(0, (nowMs - ts) / (1000 * 60 * 60 * 24));
    const decay = Math.exp(-days / HALF_LIFE_DAYS);
    return base * decay;
}
async function recordHandwritingHint(db, customerId, rawName, productId) {
    const raw_key = normalizeHandwritingRawKey(rawName);
    if (!customerId || !productId || !raw_key || raw_key.length < 2)
        return;
    const raw_name_last = String(rawName || "").trim();
    const id = (0, id_js_1.newId)("hwh");
    const updated_at = new Date().toISOString();
    // 同 product → hit_count++；改對應到不同 product → hit_count 重置 1，wrong_count 累加 1（這個 raw_key 又被改過一次）
    await db.prepare(`INSERT INTO customer_handwriting_hints (id, customer_id, raw_key, raw_name_last, product_id, hit_count, wrong_count, last_hit_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
    ON CONFLICT(customer_id, raw_key) DO UPDATE SET
      product_id = excluded.product_id,
      raw_name_last = excluded.raw_name_last,
      hit_count = CASE WHEN customer_handwriting_hints.product_id = excluded.product_id
                       THEN customer_handwriting_hints.hit_count + 1
                       ELSE 1 END,
      wrong_count = CASE WHEN customer_handwriting_hints.product_id = excluded.product_id
                         THEN customer_handwriting_hints.wrong_count
                         ELSE customer_handwriting_hints.wrong_count + 1 END,
      last_hit_at = excluded.last_hit_at,
      updated_at = excluded.updated_at`).run(id, customerId, raw_key, raw_name_last, productId, updated_at, updated_at);
}
/** 反向訊號：人工把 raw_name 從 oldProductId 改掉時呼叫；給 (customer, raw_key, oldProductId) 累加 wrong_count，
 *  分數降到門檻以下時下一次 prompt 自然不再用它。新 product 的正面 hint 由 recordHandwritingHint 另行寫入。 */
async function recordHandwritingHintWrong(db, customerId, rawName, oldProductId) {
    const raw_key = normalizeHandwritingRawKey(rawName);
    if (!customerId || !oldProductId || !raw_key || raw_key.length < 2)
        return;
    const updated_at = new Date().toISOString();
    await db.prepare(`UPDATE customer_handwriting_hints
       SET wrong_count = wrong_count + 1,
           updated_at = ?
       WHERE customer_id = ? AND raw_key = ? AND product_id = ?`).run(updated_at, customerId, raw_key, oldProductId);
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
    // 多撈一些（200 筆），由 JS 端依衰減分數排序與過濾，最後保留前 60。
    const rows = await db.prepare(`SELECT h.raw_name_last, h.raw_key, p.name AS product_name,
            h.hit_count, h.wrong_count, h.last_hit_at, h.updated_at
    FROM customer_handwriting_hints h
    JOIN products p ON p.id = h.product_id AND (p.active IS NULL OR p.active = 1)
    WHERE h.customer_id = ?
    ORDER BY h.updated_at DESC
    LIMIT 200`).all(customerId);
    if (!rows?.length)
        return "";
    const nowIso = new Date().toISOString();
    const scored = rows
        .map((r) => {
        const score = computeHandwritingHintScore(r.hit_count, r.wrong_count, r.last_hit_at || r.updated_at, nowIso);
        return { ...r, score };
    })
        .filter((r) => r.score >= MIN_USEFUL_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, 60);
    if (!scored.length)
        return "";
    const lines = scored.map((r) => {
        const left = (r.raw_name_last || r.raw_key || "").trim() || r.raw_key;
        const hits = Number(r.hit_count) || 0;
        return `- 「${left}」→ 標準品名「${r.product_name || ""}」（已核對 ${hits} 次）`;
    });
    return (`以下為本客戶「人工核對過」的辨識原文與標準品名對照（筆跡學習資料庫，已依時間衰減排序）。若圖像／OCR 出現與左側相近字樣，**品項**欄請優先使用右側標準名；數量與單位仍依圖面為準：\n` +
        lines.join("\n"));
}
