"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// 每日帳款收款（取銷貨單）總開關 —— 2026-08-30 起預設停用。
//
// 為什麼有這個開關：現場已不再使用「取銷貨單／收款作業」，但這條線每天固定把凌越當日
// 銷貨單（客戶、金額、未收）整份推上雲端保存，資料完整度高、留著只是暴露面。停用後
// **雲端不再收新資料、後台頁面全部關閉**，既有資料原封不動留在 DB（要看要用再開回來）。
//
// 設計要點：
//  - **單一開關**：app_settings.cash_sales_enabled（"1"＝啟用；其餘／未設定＝停用）。
//    別再加第二個開關——兩個重疊開關日後一定會出現「關了還在跑／開了沒反應」。
//  - **未設定＝停用**（fail-closed）：所以不需要一次性遷移把舊 DB 關掉，也沒有「部署又被蓋回去」
//    的問題；使用者在後台按「啟用」寫進 "1" 之後就一直是開的。
//  - **查詢失敗也回停用**：開關的用途是省事＋降低暴露，DB 出問題時寧可關著。

exports.CASH_FEATURE_KEY = "cash_sales_enabled";
exports.cashFeatureEnabled = cashFeatureEnabled;
exports.setCashFeatureEnabled = setCashFeatureEnabled;
exports.CASH_DISABLED_REASON = "每日帳款收款（取銷貨單）功能目前停用中";
exports.CASH_DISABLED_HOWTO = "要恢復請到後台「系統設定 → 每日帳款收款」按「啟用」（立即生效、免部署）。";

const KEY = exports.CASH_FEATURE_KEY;

function parseBool(v) {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * 每日帳款收款（取銷貨單）是否啟用。
 * 未設定或查詢失敗一律回 false（停用）。
 * @returns {Promise<boolean>}
 */
async function cashFeatureEnabled(db) {
    if (!db) return false;
    try {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(KEY);
        return parseBool(row && row.value);
    }
    catch (e) {
        console.warn("[cash-feature] 讀取開關失敗，視為停用：", e?.message || e);
        return false;
    }
}

/**
 * 寫入開關（後台「系統設定 → 每日帳款收款」用）。稽核軌跡由呼叫端寫。
 * @returns {Promise<boolean>} 寫入後的狀態
 */
async function setCashFeatureEnabled(db, enabled) {
    const v = enabled ? "1" : "0";
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(KEY, v);
    return !!enabled;
}
