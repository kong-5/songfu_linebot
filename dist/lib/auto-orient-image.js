"use strict";
/**
 * 訂單照片自動轉正：餐飲客戶常把直式訂購單「橫拍」，影像沒有 EXIF 方向標籤，
 * 送進視覺模型會嚴重對錯行、幻想數量。送辨識前先把圖轉正可大幅改善（Gemini/Claude 皆然）。
 *
 * 偵測方式：把圖造出 0/90/180/270 四個旋轉縮圖，一次丟 Gemini Flash 問「哪個是正放」，
 * 取其旋轉角度，再用 sharp 旋轉「原圖」後回傳。
 *
 * 設計原則：
 *  - 失敗一律回原圖（不阻擋主流程）
 *  - 用最便宜的 flash + 小縮圖，成本極低（每張約 < $0.001）
 *  - 可用 LINE_AUTO_ORIENT=0 關閉
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoOrientImageBuffer = autoOrientImageBuffer;
exports.detectUprightRotationDegrees = detectUprightRotationDegrees;

const sharp = require("sharp");

function getGeminiApiKey() {
    return (process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim() || null;
}

/** 偵測「需要順時針旋轉幾度才正放」：回 0 / 90 / 180 / 270；無法判斷回 null */
async function detectUprightRotationDegrees(buffer) {
    const apiKey = getGeminiApiKey();
    if (!apiKey || !buffer || !buffer.length)
        return null;
    let GoogleGenerativeAI;
    try {
        ({ GoogleGenerativeAI } = require("@google/generative-ai"));
    }
    catch (e) {
        console.warn("[auto-orient] 缺 @google/generative-ai，略過");
        return null;
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // 用 2.5-flash（便宜）。注意：2.5-flash 有 thinking，會先用掉約 90~150 個 thinking tokens，
        // 故 maxOutputTokens 必須夠大（給 500），否則 thinking 吃光、回空字串導致偵測失敗。
        const modelName = (process.env.GEMINI_MODEL_ORIENT || "gemini-2.5-flash").trim();
        const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0, maxOutputTokens: 500 } });
        const degs = [0, 90, 180, 270];
        const parts = [{ text: "下面是同一張手寫訂購單的 4 個旋轉版本，依序標示為 1、2、3、4。哪一個是「正放」(文字可正常由上到下、由左到右閱讀)？只回答 1/2/3/4 其中一個數字。" }];
        for (let i = 0; i < degs.length; i++) {
            const img = await sharp(buffer).rotate(degs[i]).resize({ width: 520, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
            parts.push({ text: "版本 " + (i + 1) + "：" });
            parts.push({ inlineData: { mimeType: "image/jpeg", data: img.toString("base64") } });
        }
        const r = await model.generateContent({ contents: [{ role: "user", parts }] });
        const ans = String(r.response.text() || "").trim();
        const m = ans.match(/[1-4]/);
        if (!m)
            return null;
        return degs[parseInt(m[0], 10) - 1];
    }
    catch (e) {
        console.warn("[auto-orient] 方向偵測失敗:", e?.message || e);
        return null;
    }
}

/** 自動轉正：偵測方向 → 旋轉原圖。任何失敗回原 buffer。 */
async function autoOrientImageBuffer(buffer) {
    if (!buffer || !buffer.length)
        return buffer;
    if (process.env.LINE_AUTO_ORIENT === "0")
        return buffer;
    const deg = await detectUprightRotationDegrees(buffer);
    if (deg == null || deg === 0)
        return buffer;
    try {
        const rotated = await sharp(buffer).rotate(deg).jpeg({ quality: 85 }).toBuffer();
        console.log("[auto-orient] 偵測到照片需轉正 %d°，已旋轉後再送辨識", deg);
        return rotated;
    }
    catch (e) {
        console.warn("[auto-orient] 旋轉失敗，沿用原圖:", e?.message || e);
        return buffer;
    }
}
