"use strict";
/**
 * Claude 視覺解析：對手寫訂單圖出 items JSON。
 * 對齊 Gemini parseOrderVisionForEval 的回傳結構，方便 order-eval 雙模型比對。
 *
 * 啟用方式：設環境變數 ANTHROPIC_API_KEY。
 *
 * 模型建議：
 *  - claude-sonnet-4-5（預設，性價比高）
 *  - claude-opus-4-5（更強，較貴；對極潦草手寫有幫助）
 */
Object.defineProperty(exports, "__esModule", { value: true });

const gemini_prompt_resolve_js_1 = require("./gemini-prompt-resolve.js");
const gemini_usage_log_js_1 = require("./gemini-usage-log.js");
const gemini_order_helpers_js_1 = require("./gemini-order-helpers.js");

const DEFAULT_CLAUDE_VISION_MODEL = "claude-sonnet-4-5";
exports.DEFAULT_CLAUDE_VISION_MODEL = DEFAULT_CLAUDE_VISION_MODEL;
exports.parseOrderVisionWithClaude = parseOrderVisionWithClaude;
exports.isClaudeModelName = isClaudeModelName;
exports.getClaudeApiKey = getClaudeApiKey;

function getClaudeApiKey() {
    return (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "").trim() || null;
}

/** 是否為 Claude 模型名（用來在 eval harness 分流） */
function isClaudeModelName(name) {
    const s = String(name || "").trim().toLowerCase();
    return s.startsWith("claude-");
}

function detectMimeFromBuffer(buffer) {
    if (!buffer || buffer.length < 4) return "image/jpeg";
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "image/gif";
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "image/webp";
    return "image/jpeg";
}

/** 與 gemini-order-helpers 同步的 sub_customer 指引（避免兩模型 system 不一致影響比對） */
function buildSubCustomerInstructionBlock(knownSubCustomers) {
    const s = String(knownSubCustomers || "").trim();
    if (!s) return "";
    return `\n\n【sub_customer 子客戶指引】\n以下為此客戶常見的子分店／子單位名稱（用 "／" 或換行分隔）：\n${s}\n若手寫含子單位字樣（即使是縮寫或暱稱），請在 sub_customer 欄填寫對應的全名（與本清單一致）；否則填空字串 ""。`;
}

function buildHistoryItemsOptionBlock(historyItems) {
    if (!Array.isArray(historyItems) || historyItems.length === 0) return "";
    const top = historyItems.slice(0, 80);
    return `\n\n【此客戶歷史品名小抄（僅供 raw_name 標準化參考；不可硬塞未出現於圖中的品項）】\n${top.join("、")}`;
}

/** Claude 回傳的 text 內可能含 ```json ... ``` 圍欄；剝離取 JSON 物件 */
function extractJsonFromText(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    const fence = t.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
    const candidate = fence ? fence[1] : t;
    try {
        return JSON.parse(candidate);
    } catch (_) {
        const m = candidate.match(/\{[\s\S]*\}/);
        if (m) {
            try { return JSON.parse(m[0]); } catch (_e) { return null; }
        }
        return null;
    }
}

/** 把 Claude items 物件規整成與 Gemini 相同的 mapStructuredOrderLinesToItems 行為 */
function mapClaudeItemsToOrderItems(json) {
    return gemini_order_helpers_js_1.mapStructuredOrderLinesToItems(json);
}

/**
 * 主要呼叫：對單張訂單圖跑 Claude vision，回傳 items 陣列（與 parseOrderVisionForEval 同型別）。
 *
 * options:
 *   - db, customerId            : 同 Gemini，紀錄 usage_log
 *   - promptBody                : 可選；若未傳，從 gemini-prompt-resolve 取目前 vision 版本
 *   - promptVersionId           : 可選；usage log 用
 *   - modelName                 : Claude 模型名；預設 claude-sonnet-4-5
 *   - knownSubCustomers         : 客戶子單位字串
 *   - historyItems              : 此客戶歷史品名小抄
 *   - recordUsage               : 預設 true
 *   - maxTokens                 : 預設 8192
 */
async function parseOrderVisionWithClaude(buffer, options = {}) {
    const apiKey = getClaudeApiKey();
    if (!apiKey) {
        console.warn("[claude-vision] ANTHROPIC_API_KEY 未設定，無法呼叫");
        return null;
    }
    if (!buffer || buffer.length === 0) return null;

    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const mediaType = detectMimeFromBuffer(buf);
    const b64 = buf.toString("base64");

    const db = options.db;
    const customerId = options.customerId;

    // 取 vision prompt body：與 Gemini 共用（公平比較）
    let promptBody;
    let resolvedPromptVersionId = options.promptVersionId || null;
    if (options.promptBody && String(options.promptBody).trim()) {
        promptBody = String(options.promptBody);
    } else {
        const rp = await gemini_prompt_resolve_js_1.resolvePromptBody(db, "vision");
        promptBody = rp.body;
        resolvedPromptVersionId = rp.versionId;
    }
    const system = promptBody
        + buildSubCustomerInstructionBlock(options.knownSubCustomers)
        + buildHistoryItemsOptionBlock(options.historyItems);

    const modelName = String(options.modelName || DEFAULT_CLAUDE_VISION_MODEL).trim();
    const maxTokens = Math.max(512, Math.min(16384, Number(options.maxTokens ?? 8192)));

    // Lazy require 避免在沒裝 SDK 的環境啟動時崩潰
    let AnthropicCls;
    try {
        const mod = require("@anthropic-ai/sdk");
        AnthropicCls = mod.default || mod.Anthropic;
    } catch (e) {
        console.error("[claude-vision] @anthropic-ai/sdk 未安裝：", e?.message || e);
        return null;
    }
    const client = new AnthropicCls({ apiKey });

    const userText = "請辨識下圖的手寫叫貨單，依 system 規則輸出 JSON。"
        + "格式： { \"items\": [ { \"raw_name\":..., \"quantity\":..., \"unit\":..., \"remark\":..., \"sub_customer\":..., \"confidence_score\":... }, ... ] }。"
        + "**只輸出 JSON 物件本身，不要任何 markdown 圍欄或前後說明文字。**";

    const t0 = Date.now();
    let resp;
    try {
        resp = await client.messages.create({
            model: modelName,
            max_tokens: maxTokens,
            temperature: 0.25,
            system,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
                        { type: "text", text: userText },
                    ],
                },
            ],
        });
    } catch (e) {
        console.warn("[claude-vision] API 失敗:", e?.message || e);
        return null;
    }
    const latencyMs = Date.now() - t0;

    // 取文字內容
    let outText = "";
    const blocks = Array.isArray(resp?.content) ? resp.content : [];
    for (const b of blocks) {
        if (b?.type === "text" && typeof b.text === "string") outText += b.text;
    }
    console.log("=== Claude Raw Output ===\n", outText.slice(0, 2000));

    // 記錄 usage（沿用 gemini_usage_log 表，便於後台統一比較）
    if (db && options.recordUsage !== false) {
        try {
            await gemini_usage_log_js_1.recordGeminiUsage(db, {
                customer_id: customerId ?? null,
                call_kind: options.callKind || "claude_vision_eval",
                model_name: modelName,
                latency_ms: latencyMs,
                prompt_tokens: resp?.usage?.input_tokens,
                candidates_tokens: resp?.usage?.output_tokens,
                total_tokens: (resp?.usage?.input_tokens || 0) + (resp?.usage?.output_tokens || 0),
                prompt_version_id: resolvedPromptVersionId ?? null,
            });
        } catch (e) {
            console.warn("[claude-vision] usage log 失敗（不阻斷）:", e?.message || e);
        }
    }

    const json = extractJsonFromText(outText);
    if (!json) {
        console.warn("[claude-vision] 無法解析 JSON 回應");
        return null;
    }
    return mapClaudeItemsToOrderItems(json);
}
