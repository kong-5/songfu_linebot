"use strict";
/**
 * 全站 Gemini 模型名稱集中處。
 * - 純文字叫貨解析：getGeminiTextModelName() ← GEMINI_MODEL_TEXT → GEMINI_MODEL → 預設較省
 * - 圖片／視覺解析：getGeminiVisionModelName() ← GEMINI_MODEL_VISION → GEMINI_MODEL → 預設較強
 * - getGeminiFlashModelName()：與文字路徑一致（供 REST／舊程式相容）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeminiFlashModelName = getGeminiFlashModelName;
exports.getGeminiTextModelName = getGeminiTextModelName;
exports.getGeminiVisionModelName = getGeminiVisionModelName;
exports.getGeminiRestGenerateContentUrl = getGeminiRestGenerateContentUrl;
/** 僅設 GEMINI_MODEL 時的預設（兩路徑後備） */
const DEFAULT_FLASH_MODEL = "gemini-2.5-flash";
/** 未指定時：文字與圖片預設皆為 gemini-2.5-flash（若要省文字成本可設 GEMINI_MODEL_TEXT=gemini-2.0-flash） */
const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";
const DEFAULT_VISION_MODEL = "gemini-2.5-flash";
/** 舊專案常設 gemini-1.5-flash，v1beta 已回 404；改導向目前可用的 Flash。 */
const LEGACY_MODEL_ALIASES = {
    "gemini-1.5-flash": DEFAULT_FLASH_MODEL,
    "gemini-1.5-flash-latest": DEFAULT_FLASH_MODEL,
    "gemini-1.5-flash-001": DEFAULT_FLASH_MODEL,
    "gemini-pro": DEFAULT_FLASH_MODEL,
};
function applyLegacyAlias(name) {
    let m = name && String(name).trim();
    if (m && Object.prototype.hasOwnProperty.call(LEGACY_MODEL_ALIASES, m)) {
        const replaced = LEGACY_MODEL_ALIASES[m];
        console.warn("[gemini-model] 模型 %s 已不可用，改用 %s", m, replaced);
        m = replaced;
    }
    return m || "";
}
/**
 * 純文字叫貨（parseOrderWithGeminiText）。
 * 優先 GEMINI_MODEL_TEXT，其次 GEMINI_MODEL，最後 DEFAULT_TEXT_MODEL。
 */
function getGeminiTextModelName() {
    const fromSpecific = process.env.GEMINI_MODEL_TEXT && String(process.env.GEMINI_MODEL_TEXT).trim();
    const fromLegacy = process.env.GEMINI_MODEL && String(process.env.GEMINI_MODEL).trim();
    const raw = fromSpecific || fromLegacy || DEFAULT_TEXT_MODEL;
    return applyLegacyAlias(raw) || DEFAULT_TEXT_MODEL;
}
/**
 * 圖片／視覺叫貨（parseOrderWithGeminiImage、Few-Shot 視覺）。
 * 優先 GEMINI_MODEL_VISION，其次 GEMINI_MODEL，最後 DEFAULT_VISION_MODEL。
 */
function getGeminiVisionModelName() {
    const fromSpecific = process.env.GEMINI_MODEL_VISION && String(process.env.GEMINI_MODEL_VISION).trim();
    const fromLegacy = process.env.GEMINI_MODEL && String(process.env.GEMINI_MODEL).trim();
    const raw = fromSpecific || fromLegacy || DEFAULT_VISION_MODEL;
    return applyLegacyAlias(raw) || DEFAULT_VISION_MODEL;
}
/** 與文字路徑一致，供 getGeminiRestGenerateContentUrl、相容舊程式 */
function getGeminiFlashModelName() {
    return getGeminiTextModelName();
}
/** REST：`v1beta/models/{model}:generateContent`（不含 query key） */
function getGeminiRestGenerateContentUrl() {
    const model = getGeminiTextModelName();
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}
