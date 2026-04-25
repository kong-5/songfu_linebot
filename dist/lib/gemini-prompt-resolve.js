"use strict";
/**
 * Gemini system prompt：從 prompt_versions 解析線上版本與 A/B 分流（對照 app_settings）。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePromptBody = resolvePromptBody;
exports.invalidatePromptCache = invalidatePromptCache;
exports.ensureSeedPromptVersions = ensureSeedPromptVersions;
const id_js_1 = require("./id.js");
const gemini_prompt_defaults_js_1 = require("./gemini-prompt-defaults.js");
const KEY_TEXT_LIVE = "gemini_prompt_text_live_id";
const KEY_VISION_LIVE = "gemini_prompt_vision_live_id";
const KEY_TEXT_AB = "gemini_prompt_text_ab_variant_id";
const KEY_TEXT_AB_PCT = "gemini_prompt_text_ab_percent";
const KEY_VISION_AB = "gemini_prompt_vision_ab_variant_id";
const KEY_VISION_AB_PCT = "gemini_prompt_vision_ab_percent";
exports.SETTINGS_KEYS = {
    KEY_TEXT_LIVE,
    KEY_VISION_LIVE,
    KEY_TEXT_AB,
    KEY_TEXT_AB_PCT,
    KEY_VISION_AB,
    KEY_VISION_AB_PCT,
};
const CACHE_MS = 45000;
const cache = { text: null, vision: null };
function invalidatePromptCache() {
    cache.text = null;
    cache.vision = null;
}
async function getSetting(db, key) {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
    return row?.value != null ? String(row.value).trim() : "";
}
function pickAbVariant(liveId, abId, pctStr) {
    const pct = Math.min(100, Math.max(0, parseInt(String(pctStr || "0"), 10) || 0));
    if (!abId || pct <= 0)
        return liveId;
    if (Math.random() * 100 < pct)
        return abId;
    return liveId;
}
async function ensureSeedPromptVersions(db) {
    if (!db)
        return;
    const isPg = Boolean(process.env.DATABASE_URL);
    const tsSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
    const textRow = await db.prepare("SELECT COUNT(*) AS c FROM prompt_versions WHERE slot = 'text'").get();
    const visionRow = await db.prepare("SELECT COUNT(*) AS c FROM prompt_versions WHERE slot = 'vision'").get();
    const textCount = Number(textRow?.c ?? 0);
    const visionCount = Number(visionRow?.c ?? 0);
    if (textCount === 0) {
        const id = (0, id_js_1.newId)("pvp");
        await db
            .prepare(`INSERT INTO prompt_versions (id, slot, label, body, notes, created_at, updated_at) VALUES (?, 'text', ?, ?, ?, ${tsSql}, ${tsSql})`)
            .run(id, "內建預設（種子）", gemini_prompt_defaults_js_1.BUILTIN_TEXT_PROMPT, "首次部署自動建立");
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(KEY_TEXT_LIVE, id);
    }
    if (visionCount === 0) {
        const id = (0, id_js_1.newId)("pvp");
        await db
            .prepare(`INSERT INTO prompt_versions (id, slot, label, body, notes, created_at, updated_at) VALUES (?, 'vision', ?, ?, ?, ${tsSql}, ${tsSql})`)
            .run(id, "內建預設（種子）", gemini_prompt_defaults_js_1.BUILTIN_VISION_PROMPT, "首次部署自動建立");
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(KEY_VISION_LIVE, id);
    }
}
/**
 * @param {"text"|"vision"} slot
 * @returns {{ body: string, versionId: string | null }}
 */
async function resolvePromptBody(db, slot) {
    if (slot !== "text" && slot !== "vision")
        slot = "text";
    if (!db) {
        return {
            body: slot === "vision" ? gemini_prompt_defaults_js_1.BUILTIN_VISION_PROMPT : gemini_prompt_defaults_js_1.BUILTIN_TEXT_PROMPT,
            versionId: null,
        };
    }
    const now = Date.now();
    const slotKey = slot;
    const entry = cache[slotKey];
    if (entry && entry.until > now && entry.payload)
        return entry.payload;
    await ensureSeedPromptVersions(db);
    const liveKey = slot === "vision" ? KEY_VISION_LIVE : KEY_TEXT_LIVE;
    const abKey = slot === "vision" ? KEY_VISION_AB : KEY_TEXT_AB;
    const abPctKey = slot === "vision" ? KEY_VISION_AB_PCT : KEY_TEXT_AB_PCT;
    const liveId = await getSetting(db, liveKey);
    const abId = await getSetting(db, abKey);
    const abPct = await getSetting(db, abPctKey);
    let chosenId = pickAbVariant(liveId, abId, abPct);
    let row = chosenId
        ? await db.prepare("SELECT body FROM prompt_versions WHERE id = ? AND slot = ?").get(chosenId, slot)
        : null;
    if (!row?.body && liveId) {
        chosenId = liveId;
        row = await db.prepare("SELECT body FROM prompt_versions WHERE id = ? AND slot = ?").get(chosenId, slot);
    }
    const fallback = slot === "vision" ? gemini_prompt_defaults_js_1.BUILTIN_VISION_PROMPT : gemini_prompt_defaults_js_1.BUILTIN_TEXT_PROMPT;
    const body = row?.body ? String(row.body) : fallback;
    const payload = { body, versionId: chosenId || null };
    cache[slotKey] = { until: now + CACHE_MS, payload };
    return payload;
}
