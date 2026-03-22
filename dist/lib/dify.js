"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithDify = chatWithDify;
/**
 * 呼叫 Dify Chat API，供 LINE Webhook 在符合條件時使用。
 * 環境變數：DIFY_API_KEY、DIFY_CHAT_URL（選填，預設 https://api.dify.ai/v1/chat-messages）
 * 回傳 Dify 回覆文字，失敗或未設定時回傳 null。
 */
async function chatWithDify(userId, groupId, text, conversationId) {
  const apiKey = process.env.DIFY_API_KEY;
  const apiUrl = process.env.DIFY_CHAT_URL || "https://api.dify.ai/v1/chat-messages";
  if (!apiKey || !text || typeof text !== "string") return null;
  const user = (userId || groupId || "line-user").toString();
  const body = {
    inputs: {},
    query: text.trim().slice(0, 2000),
    user,
    response_mode: "blocking",
  };
  if (conversationId) body.conversation_id = conversationId;
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const answer = data.answer ?? data.message?.content ?? data.message?.text;
    return typeof answer === "string" ? answer : null;
  } catch (e) {
    console.warn("[Dify] chatWithDify error:", e?.message || e);
    return null;
  }
}
