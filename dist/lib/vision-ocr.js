"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTextFromImageBuffer = getTextFromImageBuffer;
/**
 * 使用 Google Cloud Vision API（DOCUMENT_TEXT_DETECTION）從圖片辨識文字。
 * 需設定環境變數 GOOGLE_CLOUD_VISION_API_KEY。
 * @param buffer 圖片二進位（Buffer 或 Uint8Array）
 * @returns 辨識出的整段文字，失敗或無金鑰時回傳 null
 */
async function getTextFromImageBuffer(buffer) {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey || !buffer || buffer.length === 0)
        return null;
    const base64 = Buffer.isBuffer(buffer) ? buffer.toString("base64") : Buffer.from(buffer).toString("base64");
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
    const body = {
        requests: [
            {
                image: { content: base64 },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
        ],
    };
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            console.warn("[vision-ocr] API 回應非 200:", res.status, errBody.slice(0, 300));
            if (res.status === 403 && /API_KEY_INVALID|not enabled/i.test(errBody))
                console.warn("[vision-ocr] 請確認：1. 金鑰為「Cloud Vision API」用 2. 已在 GCP 專案啟用 Cloud Vision API");
            return null;
        }
        const data = await res.json();
        const text = data?.responses?.[0]?.fullTextAnnotation?.text?.trim();
        return text || null;
    }
    catch (e) {
        console.warn("[vision-ocr] 辨識失敗:", e?.message || e);
        return null;
    }
}
