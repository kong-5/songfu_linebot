"use strict";
/**
 * 將 Gemini API 呼叫寫入 gemini_usage_log（供後台辨識成效儀表）。
 * 失敗時僅 warn，不阻擋主流程。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordGeminiUsage = recordGeminiUsage;
const id_js_1 = require("./id.js");
async function recordGeminiUsage(db, opts) {
    if (!db || !opts)
        return;
    try {
        const id = (0, id_js_1.newId)("gul");
        const isPg = Boolean(process.env.DATABASE_URL);
        const tsSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db
            .prepare(`INSERT INTO gemini_usage_log (id, customer_id, call_kind, model_name, latency_ms, prompt_tokens, candidates_tokens, total_tokens, prompt_version_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${tsSql})`)
            .run(id, opts.customer_id ?? null, String(opts.call_kind || "unknown"), opts.model_name != null ? String(opts.model_name) : null, opts.latency_ms != null ? Math.round(Number(opts.latency_ms)) : null, opts.prompt_tokens != null ? Math.round(Number(opts.prompt_tokens)) : null, opts.candidates_tokens != null ? Math.round(Number(opts.candidates_tokens)) : null, opts.total_tokens != null ? Math.round(Number(opts.total_tokens)) : null, opts.prompt_version_id != null ? String(opts.prompt_version_id) : null);
    }
    catch (e) {
        console.warn("[gemini-usage-log] insert failed:", e?.message || e);
    }
}
