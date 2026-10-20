"use strict";
/**
 * 盤點搬到松揚新網站之後，舊版（本系統）的盤點入口全部改成「只看不寫」（2026-10-20 業主選 B）。
 *
 * 為什麼用 app_settings 旗標而不是直接改碼：推 main 就自動部署到正在用的 Cloud Run，
 * 切換當晚才能擋、退回時要能 5 分鐘內恢復——用旗標＝**平常就先部署好、當晚只翻一個值**，
 * 退回＝翻回去，不必重新部署。旗標 `stocktake_moved_to_new_site`＝'1' 才生效，沒設＝完全舊行為。
 *
 * 擋在哪：`submitStocktake`（LIFF／掃碼／後台網頁版三個入口都走它）、LIFF 條碼綁定；
 * LIFF 盤點頁與掃碼頁開頁即顯示新網站連結；`#盤點` 指令回新連結。報表、複盤等**只讀**功能不動。
 */
exports.MOVED_KEY = "stocktake_moved_to_new_site";
exports.NEW_STOCKTAKE_LIFF = "https://liff.line.me/2010106501-Gbx4D6WT";
exports.NEW_STOCKTAKE_SITE = "https://songyang178go.vercel.app/songfu/stocktake";
exports.NEW_SCAN_LIFF = exports.NEW_STOCKTAKE_LIFF + "/scan";
exports.MOVED_MESSAGE =
    "盤點已搬到新網站，這裡不再接受送出。請在 LINE 群組輸入 #盤點 開新的盤點頁，或直接開 " + exports.NEW_STOCKTAKE_LIFF + "。" +
    "\nKiểm kê đã chuyển sang trang mới. Gõ #盤點 trong nhóm LINE để mở trang mới.";

/** 旗標開了沒（查不到表／出錯一律當沒開，舊行為不受影響） */
async function stocktakeMoved(db) {
    try {
        const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(exports.MOVED_KEY);
        return !!(r && String(r.value) === "1");
    } catch (_) { return false; }
}
exports.stocktakeMoved = stocktakeMoved;

/** 給 LIFF 頁的附加欄位（warehouses 回應上多這三個鍵，頁面看到 moved 就換成搬家畫面） */
function movedPayload() {
    return { moved: true, movedMessage: exports.MOVED_MESSAGE, movedUrl: exports.NEW_STOCKTAKE_LIFF };
}
exports.movedPayload = movedPayload;

/**
 * `#盤點` 卡片（旗標開著時）：長相跟舊卡片一樣——逐倉按鈕＋掃碼鈕，只是按鈕全指向新網站。
 * 業主 2026-10-20：「我想用舊的機器人，因為資料都已經在了」→ LINE 機器人留在舊系統，只有盤點頁換新。
 * 新頁吃 `?wh=倉號` 直接開那一倉（只有松富 00 的倉號能對上；其他公司給一顆「開啟盤點頁」，進去再切公司）。
 * 純函式，方便測試；回傳 LINE Flex message 物件。
 */
function movedStocktakeCard({ whRows, icpno, companyName, date }) {
    const base = exports.NEW_STOCKTAKE_LIFF;
    const label = (w) => { const s = String(w.name || w.code || "").trim(); return s.length > 18 ? s.slice(0, 18) : s; };
    const btn = (text, uri, primary) => ({
        type: "button", style: primary ? "primary" : "secondary", height: "sm", margin: primary ? "md" : "sm",
        ...(primary ? { color: "#1d4ed8" } : {}),
        action: { type: "uri", label: text, uri },
    });
    const btns = [];
    if (icpno === "00") {
        for (const w of (whRows || []).slice(0, 11)) btns.push(btn(label(w), base + "?wh=" + encodeURIComponent(String(w.code)), false));
        btns.push(btn((whRows || []).length > 11 ? "其他倉庫（共 " + whRows.length + "）" : "開啟盤點選單", base, true));
    } else {
        btns.push(btn("開啟盤點頁（進去切到" + companyName + "）", base, true));
    }
    btns.push(btn("📷 掃碼盤點", exports.NEW_SCAN_LIFF, false));
    return {
        type: "flex",
        altText: companyName + "盤點 " + date + "（新網站）",
        contents: {
            type: "bubble", size: "kilo",
            body: {
                type: "box", layout: "vertical", spacing: "xs", paddingAll: "14px",
                contents: [
                    { type: "text", text: "📋 " + companyName + "盤點", size: "md", weight: "bold", color: "#1d4ed8" },
                    { type: "text", text: "盤點日 " + date + " · 已搬到新網站", size: "xxs", color: "#9b9a97", margin: "xs" },
                    { type: "separator", margin: "md" },
                    ...btns,
                ],
            },
        },
    };
}
exports.movedStocktakeCard = movedStocktakeCard;
