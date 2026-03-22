"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLineBotSettings = getLineBotSettings;
exports.isBotAcceptingOrders = isBotAcceptingOrders;
exports.classifyTextAsOrderIntent = classifyTextAsOrderIntent;
exports.appendLineBotLog = appendLineBotLog;

const DEFAULT_MODE = "always_on";
const DEFAULT_START = "18:00";
const DEFAULT_END = "03:00";

async function getLineBotSettings(db) {
    const keys = ["line_bot_mode", "line_bot_window_start", "line_bot_window_end", "line_bot_ai_gate"];
    const out = { mode: DEFAULT_MODE, windowStart: DEFAULT_START, windowEnd: DEFAULT_END, aiGate: false };
    for (const k of keys) {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k);
        const v = row?.value;
        if (k === "line_bot_mode" && v)
            out.mode = v;
        if (k === "line_bot_window_start" && v)
            out.windowStart = v;
        if (k === "line_bot_window_end" && v)
            out.windowEnd = v;
        if (k === "line_bot_ai_gate" && v)
            out.aiGate = v === "1" || v === "true";
    }
    return out;
}

/**
 * 是否在「可收單」時段（依模式與排程）。
 * mode: always_on → true；always_off → false；scheduled → 依台北時間視窗。
 */
function isWithinWindow(startStr, endStr, now) {
    const pad = (n) => String(n).padStart(2, "0");
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(now);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const cur = h * 60 + m;
    const parseT = (s) => {
        const [hh, mm] = (s || "00:00").split(":").map((x) => parseInt(x, 10) || 0);
        return hh * 60 + mm;
    };
    const a = parseT(startStr);
    const b = parseT(endStr);
    if (a <= b)
        return cur >= a && cur <= b;
    return cur >= a || cur <= b;
}

async function isBotAcceptingOrders(db) {
    const s = await getLineBotSettings(db);
    if (s.mode === "always_off")
        return false;
    if (s.mode === "always_on")
        return true;
    return isWithinWindow(s.windowStart, s.windowEnd, new Date());
}

/**
 * 用 Gemini 判斷是否為叫貨／訂單相關訊息（非閒聊）。
 * 未設金鑰或失敗時回傳 null（呼叫端應放行，避免誤擋）。
 */
async function classifyTextAsOrderIntent(text) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || !text || !String(text).trim())
        return null;
    const prompt = `你是蔬果批發叫貨助理。判斷下列訊息是否與「叫貨、訂單、品項數量、收單、送貨」有關（含口語如幫我送、明天要菜）。閒聊、問候、與叫貨無關則為否。只回一個 JSON：{"is_order_related":true} 或 {"is_order_related":false}，不要其他文字。\n\n訊息：\n${String(text).slice(0, 800)}`;
    try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 128, temperature: 0.1 },
            }),
        });
        if (!resp.ok)
            return null;
        const data = await resp.json();
        const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textPart || typeof textPart !== "string")
            return null;
        const m = textPart.match(/\{[\s\S]*\}/);
        if (!m)
            return null;
        const j = JSON.parse(m[0]);
        if (typeof j.is_order_related === "boolean")
            return j.is_order_related;
        return null;
    }
    catch (_) {
        return null;
    }
}

async function appendLineBotLog(db, eventType, detail) {
    const id_js_1 = require("./id.js");
    const id = id_js_1.newId("lbl");
    const detailStr = typeof detail === "string" ? detail : JSON.stringify(detail || {});
    const at = new Date().toISOString();
    try {
        await db.prepare("INSERT INTO line_bot_state_log (id, event_type, detail, created_at) VALUES (?, ?, ?, ?)").run(id, eventType, detailStr.slice(0, 2000), at);
    }
    catch (e) {
        console.warn("[line-bot-control] appendLineBotLog failed:", e?.message || e);
    }
}
