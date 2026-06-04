"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectNonOrderImage = detectNonOrderImage;
/**
 * 偵測「不是訂單」的圖（從 OCR 文字判斷），讓 parse-order-from-image 早退、不打 Gemini。
 *
 * 目前涵蓋三種高頻誤判：
 *   - broadcast_promotion：松富自己發的「限時優惠」廣播圖被客戶轉回 → 至少 9 個客戶受害
 *   - own_invoice:         松富銷貨單被客戶照相回傳（驗收用）→ 馬偕/桂田/桃源國小
 *   - crate_label_photo:   容器/菜籃標籤照（瑪沙魯/熊蓋讚/新北斗/大壯板/籃子）
 *
 * 設計原則：
 *   - 保守。寧可漏判也不錯判（漏 → 多花一次 Gemini；錯 → 真訂單被吞掉）
 *   - 每種類型必須**至少兩個獨立 signal** 都命中才回傳
 *   - 純文字判斷，不需要額外 API call
 *
 * @param {string|null} ocrText
 * @returns {{ skip: true, reason: string, signals: string[] } | null}
 */
function detectNonOrderImage(ocrText) {
    const t = String(ocrText || "");
    if (!t || t.length < 2) return null;

    // === broadcast_promotion ===
    // 你自己發的「限時優惠」廣播圖；客戶轉回後 bot 會誤抓「小黃瓜」等品名為訂單
    const promoSignals = [];
    if (/限時優惠/.test(t)) promoSignals.push("限時優惠");
    if (/訂購請備註要優惠食材/.test(t)) promoSignals.push("訂購請備註要優惠食材");
    if (/售完為止/.test(t)) promoSignals.push("售完為止");
    if (/食材皆為上貨/.test(t)) promoSignals.push("食材皆為上貨");
    // 廣播圖開頭通常是「限時優惠」+「時間: YYYY年MM月DD日」
    if (/限時優惠[\s\S]{0,40}時間\s*[:：]/.test(t)) promoSignals.push("限時優惠+時間 anchor");

    if (promoSignals.length >= 2) {
        return { skip: true, reason: "broadcast_promotion", signals: promoSignals };
    }

    // === own_invoice ===
    // 松富/龍港自己印的銷貨單；客戶拿來照相回傳驗收
    const invoiceSignals = [];
    if (/松富銷貨單/.test(t)) invoiceSignals.push("松富銷貨單");
    if (/龍港銷貨單/.test(t)) invoiceSignals.push("龍港銷貨單");
    if (/統編\s*[:：]?\s*53177907/.test(t)) invoiceSignals.push("統編:53177907");
    if (/松富物流股份有限公司/.test(t) && /(地址.*台東市大道路1號|台東市大道路1號)/.test(t))
        invoiceSignals.push("松富物流+地址");
    if (/客戶代碼\s*[:：]?\s*[A-Z]{2}\d{4,}/.test(t)) invoiceSignals.push("客戶代碼:XX####");
    if (/第\s*\d+\s*頁\s*,\s*共\s*\d+\s*頁/.test(t)) invoiceSignals.push("第N頁,共N頁");

    // 必須 (a) 有「銷貨單」明確字樣 或 (b) 松富抬頭+客戶代碼這種雙重 signal
    const hasInvoiceMarker = invoiceSignals.some(s => /銷貨單/.test(s));
    const hasOwnIdentity = invoiceSignals.includes("統編:53177907") || invoiceSignals.includes("松富物流+地址");
    const hasCustCode = invoiceSignals.includes("客戶代碼:XX####");
    if ((hasInvoiceMarker && hasOwnIdentity) || (hasOwnIdentity && hasCustCode)) {
        return { skip: true, reason: "own_invoice", signals: invoiceSignals };
    }

    // === crate_label_photo ===
    // 容器/菜籃標籤照（瑪沙魯/熊蓋讚/新北斗/大壯板/籃子 那種）：
    //   OCR 通常 < 25 chars (壓縮後)、有 1-2 位數字、有中文（客戶名）、但**沒有數量單位**
    // 判別邏輯（必須全 4 個 signal 命中）：
    const compact = t.replace(/\s/g, "");
    const lenSig = compact.length >= 2 && compact.length <= 25;
    const hasDigit = /\d/.test(t);
    const hasChinese = /[一-鿿]/.test(t);
    // 任何訂單一定會出現的單位關鍵字 — 出現任何一個就**不是**運輸照
    const unitRe = /(公斤|公克|台斤|公兩|kg|KG|Kg|斤|包|盒|個|條|顆|把|份|束|罐|瓶|盤|碗|株|盆|箱|籃|袋)/;
    const hasUnit = unitRe.test(t);
    // 真訂單通常多行；運輸照通常 1-3 行短文
    const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
    const fewLines = lines.length <= 4;
    if (lenSig && hasDigit && hasChinese && !hasUnit && fewLines) {
        return {
            skip: true,
            reason: "crate_label_photo",
            signals: [
                `text_len=${compact.length}`,
                `digits=${(t.match(/\d+/g) || []).join(',')}`,
                `lines=${lines.length}`,
                "no_unit_keyword",
            ],
        };
    }

    // === app_screenshot ===
    // 偵測「app 錯誤對話框／網頁截圖」這類非訂單圖（如 ghp-forms 的「顯示...錯誤」對話框）
    // 必須同時命中：(a) 有 app/web 識別字串 + (b) 有錯誤／提示性技術用詞，且 (c) 不含任何叫貨單位
    const screenshotSignals = [];
    if (/\.vercel\.app\s*顯示|\.com\s*顯示|\.tw\s*顯示/.test(t)) screenshotSignals.push("domain+顯示(alert對話框)");
    if (/Could not find|schema cache|migration|Supabase|SQL Editor/i.test(t)) screenshotSignals.push("tech_jargon");
    if (/儲存(至)?(雲端)?失敗|請至.{0,10}執行.{0,20}\.sql/.test(t)) screenshotSignals.push("save_failed_dialog");
    if (/^確定$|按\s*確定|請按.{0,5}確定/m.test(t)) screenshotSignals.push("ok_button");
    if (screenshotSignals.length >= 2 && !hasUnit) {
        return { skip: true, reason: "app_screenshot", signals: screenshotSignals };
    }

    return null;
}
