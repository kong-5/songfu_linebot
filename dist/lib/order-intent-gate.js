"use strict";
/**
 * Feature B：訂單意圖關卡。
 * 判斷一段「關鍵字意圖未命中」的客戶文字，到底是「叫貨訂單」還是「詢問／閒聊」。
 *
 * 安全原則（最重要）：**寧可漏判也不錯殺真訂單**。
 *   任何不確定（無 Gemini 金鑰、API 失敗、回傳無法解析、信心不足）一律回 isOrder:true，
 *   讓既有流程照常開單／解析。只有「高信心」判定為 inquiry/chat 才回 isOrder:false。
 *
 * 成本控制：對「明顯是訂單」(含數量+單位) 與「完全沒有問句訊號」的文字直接用規則放行，
 *   不花 LLM；只有模稜兩可（帶問句但無明確品項數量）才呼叫一次便宜的 Gemini Flash。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyOrderIntent = classifyOrderIntent;

const gemini_chat_js_1 = require("./gemini-chat.js");

/** 問句／閒聊訊號：完全沒有這些的文字（多半是純品名數量）不必花 LLM。 */
const QUESTION_MARKERS = /[?？]|嗎|呢|請問|麻煩問|想問|多少錢|價格|價錢|報價|幾點|什麼時候|何時|有沒有|有無|是不是|要不要|可不可以|謝謝|感謝|你好|您好|早安|午安|晚安|辛苦了|不好意思/;
/** 明確訂單訊號：有「數字＋單位」幾乎篤定是叫貨，直接放行省一次呼叫。 */
const ORDER_MARKERS = /[\d０-９]+\s*(公斤|公克|台斤|公兩|斤|包|盒|個|條|顆|把|份|束|罐|瓶|盤|碗|株|盆|箱|籃|袋|kg|KG|Kg)/;

const SYSTEM = `你是餐飲叫貨 LINE 機器人的訊息分類器。判斷客戶這則訊息屬於哪一類：
- "order"：在叫貨／下訂／報數量（例如「高麗菜5斤、雞蛋2箱」「明天要三盒豆腐」）。
- "inquiry"：在詢問（到貨時間、價格、有沒有某商品、帳務等），並沒有要下訂。
- "chat"：問候、道謝、閒聊、與叫貨無關。
判斷規則：只要訊息「含有要訂購的品項與數量」就一律算 order，即使同時夾帶問句也是 order。只有完全沒有任何下訂內容時，才可判 inquiry 或 chat。
只輸出 JSON，不要任何其他文字：{"kind":"order|inquiry|chat","confidence":0-100}`;

function parseVerdict(text) {
    if (!text) return null;
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
        const j = JSON.parse(m[0]);
        const kind = String(j.kind || "").toLowerCase();
        if (!["order", "inquiry", "chat"].includes(kind)) return null;
        const conf = Number(j.confidence);
        return { kind, confidence: Number.isFinite(conf) ? conf : 0 };
    } catch (_) {
        return null;
    }
}

/**
 * @param {string} text 客戶訊息
 * @param {object} [options] 預留（db, customerId 等，目前未用）
 * @returns {Promise<{isOrder:boolean, kind:string, confidence:number, via:string}>}
 *   安全預設 isOrder:true。only 高信心 inquiry/chat 才 isOrder:false。
 */
async function classifyOrderIntent(text, options = {}) {
    const t = String(text || "").trim();
    if (!t) return { isOrder: true, kind: "order", confidence: 0, via: "empty" };
    // 有明確「數量＋單位」→ 直接當訂單，不花 LLM
    if (ORDER_MARKERS.test(t)) return { isOrder: true, kind: "order", confidence: 100, via: "rule_order_marker" };
    // 沒有任何問句／閒聊訊號 → 交給既有解析（維持現狀），不花 LLM
    if (!QUESTION_MARKERS.test(t)) return { isOrder: true, kind: "order", confidence: 0, via: "rule_no_question" };
    // 模稜兩可（有問句但無明確品項數量）：問一次 Flash
    const minConf = Math.max(50, Math.min(100, Number(process.env.LINE_INTENT_GATE_MIN_CONF ?? 75) || 75));
    let raw = null;
    try {
        raw = await gemini_chat_js_1.chatWithGemini(t.slice(0, 500), SYSTEM);
    } catch (_) {
        raw = null;
    }
    const v = parseVerdict(raw);
    if (!v) return { isOrder: true, kind: "order", confidence: 0, via: "llm_unparsable_safe_default" };
    if ((v.kind === "inquiry" || v.kind === "chat") && v.confidence >= minConf) {
        return { isOrder: false, kind: v.kind, confidence: v.confidence, via: "llm" };
    }
    return { isOrder: true, kind: v.kind, confidence: v.confidence, via: "llm" };
}
