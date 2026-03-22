"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithGemini = chatWithGemini;
/**
 * 用 Google Gemini 做單輪或簡易多輪問答，供 LINE Webhook 在符合條件時使用。
 * 環境變數：GOOGLE_GEMINI_API_KEY 或 GEMINI_API_KEY
 * 與後台「AI 分析」同一支 API，只是 prompt 改為請假／表單／SOP 助理。
 */
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const DEFAULT_SYSTEM = "你是公司內部助理，負責回答請假流程、表單填寫、SOP 與常見問題。請用簡短、友善的繁體中文回覆，可附上處理步驟或表單連結（若你知道）。若無法從已知資訊回答，請建議聯絡負責人員。";
async function chatWithGemini(userMessage, systemPrompt) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  const system = (systemPrompt && systemPrompt.trim()) || DEFAULT_SYSTEM;
  const fullPrompt = system + "\n\n---\n\n使用者：" + (userMessage || "").trim().slice(0, 2000);
  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey.trim())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" ? text.trim() : null;
  } catch (e) {
    console.warn("[Gemini] chatWithGemini error:", e?.message || e);
    return null;
  }
}
