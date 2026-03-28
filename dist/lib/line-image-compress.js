"use strict";
/**
 * LINE 下載之圖片：縮放＋ JPEG 壓縮，降低儲存與送進 Gemini 的記憶體。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressLineImageBuffer = compressLineImageBuffer;
const sharp = require("sharp");
async function compressLineImageBuffer(buffer) {
    if (!buffer || buffer.length === 0)
        return buffer;
    try {
        return await sharp(buffer)
            .resize({
            width: 1280,
            fit: "inside",
            withoutEnlargement: true,
        })
            .jpeg({ quality: 80 })
            .toBuffer();
    }
    catch (e) {
        console.warn("[line-image] sharp 壓縮失敗，改用原始圖:", e?.message || e);
        return buffer;
    }
}
