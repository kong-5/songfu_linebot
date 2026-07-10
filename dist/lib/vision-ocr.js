"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTextFromImageBuffer = getTextFromImageBuffer;
/**
 * 使用 Google Cloud Vision API（DOCUMENT_TEXT_DETECTION）從圖片辨識文字。
 *
 * 兩種認證模式：
 *  1. API 金鑰（GOOGLE_CLOUD_VISION_API_KEY）— 舊行為。
 *     注意：若金鑰被設「HTTP referrer」應用程式限制，server 端呼叫會 403（Requests from referer <empty> are blocked）。
 *  2. 服務帳號 ADC（VISION_USE_ADC=1）— 在 Cloud Run 用實例服務帳號的 access token 以 Bearer 呼叫，
 *     不受 referrer 限制、不需在程式放金鑰。預設 Cloud Run compute SA 具 editor 角色即可使用。
 *
 * @param buffer 圖片二進位（Buffer 或 Uint8Array）
 * @returns 辨識出的整段文字，失敗或無認證時回傳 null
 */
let _tokenCache = { token: null, exp: 0 };
async function getMetadataAccessToken() {
    const now = Date.now();
    if (_tokenCache.token && now < _tokenCache.exp)
        return _tokenCache.token;
    const res = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-account/default/token", {
        headers: { "Metadata-Flavor": "Google" },
    });
    if (!res.ok)
        throw new Error("metadata token HTTP " + res.status);
    const j = await res.json();
    const ttlMs = (Number(j.expires_in) || 3600) * 1000;
    _tokenCache = { token: j.access_token, exp: now + ttlMs - 60000 };
    return j.access_token;
}
/** 呼叫 Vision DOCUMENT_TEXT_DETECTION，回傳 responses[0]（含 fullTextAnnotation），失敗回 null。 */
async function annotateDocumentText(buffer) {
    if (!buffer || buffer.length === 0)
        return null;
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    const useAdc = process.env.VISION_USE_ADC === "1";
    if (!useAdc && !apiKey)
        return null;
    const base64 = Buffer.isBuffer(buffer) ? buffer.toString("base64") : Buffer.from(buffer).toString("base64");
    const body = JSON.stringify({
        requests: [
            {
                image: { content: base64 },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
        ],
    });
    let url;
    let headers = { "Content-Type": "application/json" };
    let mode = "key";
    if (useAdc) {
        let token = null;
        try {
            token = await getMetadataAccessToken();
        }
        catch (e) {
            console.warn("[vision-ocr] 取服務帳號權杖失敗:", e?.message || e);
        }
        if (token) {
            url = "https://vision.googleapis.com/v1/images:annotate";
            headers["Authorization"] = "Bearer " + token;
            const proj = (process.env.PROJECT_ID || "").trim();
            if (proj)
                headers["x-goog-user-project"] = proj;
            mode = "adc";
        }
        else if (apiKey) {
            url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
        }
        else {
            return null;
        }
    }
    else {
        url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
    }
    try {
        const res = await fetch(url, { method: "POST", headers, body });
        if (!res.ok) {
            const errBody = await res.text().catch(() => "");
            console.warn("[vision-ocr] API 回應非 200 (mode=%s):", mode, res.status, errBody.slice(0, 300));
            if (res.status === 403 && /API_KEY_HTTP_REFERRER_BLOCKED/i.test(errBody))
                console.warn("[vision-ocr] 金鑰被 HTTP referrer 限制，server 端無法用。請改設 VISION_USE_ADC=1 用服務帳號權杖。");
            return null;
        }
        const data = await res.json();
        return data?.responses?.[0] || null;
    }
    catch (e) {
        console.warn("[vision-ocr] 辨識失敗:", e?.message || e);
        return null;
    }
}
async function getTextFromImageBuffer(buffer) {
    const r = await annotateDocumentText(buffer);
    const text = r?.fullTextAnnotation?.text?.trim();
    return text || null;
}
/** 從 annotateDocumentText 的回應取出字框（共用邏輯），無頁面資料時回 null。 */
function extractWordBoxesFromResponse(r) {
    const fta = r?.fullTextAnnotation;
    const page = fta?.pages?.[0];
    if (!page)
        return null;
    let W = page.width || 0;
    let H = page.height || 0;
    const words = [];
    let maxX = 0, maxY = 0;
    for (const block of (page.blocks || [])) {
        for (const para of (block.paragraphs || [])) {
            for (const w of (para.words || [])) {
                const text = (w.symbols || []).map((s) => s.text || "").join("");
                const vs = (w.boundingBox && (w.boundingBox.vertices || w.boundingBox.normalizedVertices)) || [];
                if (!text || vs.length < 2)
                    continue;
                const xs = vs.map((v) => v.x || 0);
                const ys = vs.map((v) => v.y || 0);
                const x = Math.min(...xs), y = Math.min(...ys);
                const x2 = Math.max(...xs), y2 = Math.max(...ys);
                if (x2 > maxX) maxX = x2;
                if (y2 > maxY) maxY = y2;
                words.push({ text, x, y, w: x2 - x, h: y2 - y });
            }
        }
    }
    if (!W) W = maxX;
    if (!H) H = maxY;
    return { width: W, height: H, words };
}
/**
 * 回傳每個「字詞」的方框（像素座標）＋圖片尺寸，供後台在照片上疊辨識框。
 * @returns {Promise<{width:number,height:number,words:Array<{text:string,x:number,y:number,w:number,h:number}>}|null>}
 */
async function getWordBoxesFromImageBuffer(buffer) {
    const r = await annotateDocumentText(buffer);
    return extractWordBoxesFromResponse(r);
}
exports.getWordBoxesFromImageBuffer = getWordBoxesFromImageBuffer;
/**
 * 一次 Vision API 呼叫同時取得整段文字＋字框（getTextFromImageBuffer ＋ getWordBoxesFromImageBuffer 合併版），
 * 供圖片訂單解析流程重用同一次 OCR 結果（省一次 API 費用與延遲）。
 * @returns {Promise<{text:string|null, boxes:{width:number,height:number,words:Array<{text:string,x:number,y:number,w:number,h:number}>}|null}>}
 */
async function getTextAndWordBoxesFromImageBuffer(buffer) {
    const r = await annotateDocumentText(buffer);
    const text = r?.fullTextAnnotation?.text?.trim() || null;
    return { text, boxes: extractWordBoxesFromResponse(r) };
}
exports.getTextAndWordBoxesFromImageBuffer = getTextAndWordBoxesFromImageBuffer;
