"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVisionConfigured = isVisionConfigured;
exports.getTextFromImageBuffer = getTextFromImageBuffer;

/**
 * 是否已設定 Google Cloud Vision API 金鑰（用於照片辨識）
 */
function isVisionConfigured() {
    const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    return typeof key === "string" && key.trim().length > 0;
}

/**
 * 使用 Google Cloud Vision API 從圖片 buffer 辨識文字。
 * @param {Buffer} imageBuffer - 圖片二進位
 * @returns {Promise<string>} 辨識出的文字，失敗或無文字回傳空字串
 */
async function getTextFromImageBuffer(imageBuffer) {
    const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!key || !imageBuffer || imageBuffer.length === 0) {
        return "";
    }
    const base64 = imageBuffer.toString("base64");
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key.trim())}`;
    const body = JSON.stringify({
        requests: [
            {
                image: { content: base64 },
                features: [{ type: "TEXT_DETECTION" }],
            },
        ],
    });
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        });
        if (!res.ok) {
            console.warn("[vision-ocr] API 錯誤:", res.status, await res.text());
            return "";
        }
        const data = await res.json();
        const text = data?.responses?.[0]?.fullTextAnnotation?.text;
        return typeof text === "string" ? text.trim() : "";
    } catch (err) {
        console.error("[vision-ocr] 請求失敗:", err);
        return "";
    }
}
