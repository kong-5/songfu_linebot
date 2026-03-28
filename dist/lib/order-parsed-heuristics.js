"use strict";
/**
 * OCR 常把畫面邊緣的條碼、公司抬頭、地址當成文字；規則解析會誤產生品項並阻斷後續 Gemini 視覺。
 * 此模組用簡單啟發式過濾這類「不可能是蔬果品名」的列，讓流程可落到讀圖。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLikelyOcrJunkProduceName = isLikelyOcrJunkProduceName;
exports.filterLikelyOcrJunkParsedItems = filterLikelyOcrJunkParsedItems;
function isLikelyOcrJunkProduceName(rawName) {
    const s = String(rawName || "").trim();
    if (!s)
        return true;
    if (/^\s*(電話|TEL|Tel|tel|傳真|FAX|Fax|fax)\s*[:：]?\s*/.test(s))
        return true;
    if (/有限公司|股份有限公司|股份有限|有限責任/.test(s))
        return true;
    if (/地\s*[:：]\s*.{2,}/.test(s) && /[市縣區鄉鎮村里路街巷弄號樓]/u.test(s))
        return true;
    const digitsOnly = s.replace(/\s/g, "");
    if (/^\d{5,}$/.test(digitsOnly))
        return true;
    if (/^[0-9\s]+$/.test(s) && digitsOnly.length >= 5)
        return true;
    const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
    const letters = (s.match(/[A-Za-z]/g) || []).length;
    const digits = (s.match(/\d/g) || []).length;
    if (cjk === 0 && digits >= 5 && letters <= 2)
        return true;
    // 無中文且僅英數／連字號／點：多為條碼、資料夾標籤、SKU（例：SPNA、SPNA-26001、4 713752）
    const compactAscii = s.replace(/\s/g, "");
    if (cjk === 0 &&
        compactAscii.length > 0 &&
        compactAscii.length <= 32 &&
        /^[A-Za-z0-9.\-‧·／/]+$/.test(compactAscii))
        return true;
    // 表格 OCR 常把欄位號碼誤當品名（如「1」「3」）
    if (/^\d{1,3}$/.test(s))
        return true;
    return false;
}
function filterLikelyOcrJunkParsedItems(items) {
    if (!Array.isArray(items))
        return [];
    return items.filter((p) => {
        if (!p)
            return false;
        if (isLikelyOcrJunkProduceName(p.rawName))
            return false;
        const qty = Number(p.quantity);
        const name = String(p.rawName || "").trim();
        // 單筆數量極大且品名無中文：常為條碼／SKU 被誤拆（例：SPNA + 26001）
        if (Number.isFinite(qty) && qty >= 800 && name.length <= 20 && !/[\u4e00-\u9fff]/.test(name))
            return false;
        // 「電話: 089」+「359188」這種模式：數量像電話尾碼，視為雜訊
        if (/電話|傳真|TEL|FAX/i.test(name) && Number.isFinite(qty) && qty >= 10000)
            return false;
        // OCR 把 kg 或欄線與數字黏成萬位級（如 20142）；單筆叫貨極少超過數千公斤
        if (Number.isFinite(qty) && qty > 10000)
            return false;
        const uNorm = String(p.unit || "").trim().toLowerCase();
        const isKgish = uNorm === "公斤" || uNorm === "kg" || uNorm === "k";
        if (Number.isFinite(qty) && isKgish && qty > 5000)
            return false;
        return true;
    });
}
