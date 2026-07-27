"use strict";
// LINE 收單的 Flex 訊息組裝（自 webhook/line.js 拆出，拆檔批次 9；純函式、不碰 db）：
//   buildOrderConfirmFlex  收單確認卡（closed-loop 確認，多單走 carousel）
//   isEmployeeMenuKeyword / buildEmployeeMenuFlex  員工功能選單
Object.defineProperty(exports, "__esModule", { value: true });

// 單一 bubble 品項上限：超過就截斷並在末列標「…等 N 項，可傳『線上改單』查看完整品項」（避免 Flex bubble 過大爆掉）。
const ORDER_CONFIRM_MAX_ITEMS_PER_BUBBLE = 20;
// carousel 最多泡數：超過（多單）就整則 fallback 純文字。
const ORDER_CONFIRM_MAX_BUBBLES = 10;
/**
 * 收單確認 Flex 卡組裝（純函式，好測）。借鏡 closed-loop 確認：把糾錯往上游（客戶端）推。
 * @param {Array<{orderNo:(string|number), remark?:string, items:Array<{name:string, qtyStr:string, unit?:string, warn?:boolean, warnText?:string}>}>} orderBlocksData
 *        每張訂單一個區塊；items 已排序；warn=低信心或 ⚠ 警示品項；warnText=要顯示的警示文字（僅 ⚠ 那段）。
 * @param {string} dateStr 送貨日期。
 * @param {object} [opts] { maxItemsPerBubble, maxBubbles }。
 * @returns {{contents:object, altText:string}|null} 組裝失敗、無資料、或泡數超上限回 null（呼叫端 fallback 純文字）。
 */
function buildOrderConfirmFlex(orderBlocksData, dateStr, opts) {
    try {
        if (!Array.isArray(orderBlocksData) || orderBlocksData.length === 0)
            return null;
        const maxItems = (opts && opts.maxItemsPerBubble) || ORDER_CONFIRM_MAX_ITEMS_PER_BUBBLE;
        const maxBubbles = (opts && opts.maxBubbles) || ORDER_CONFIRM_MAX_BUBBLES;
        // 泡數超上限（多單過多）＝整則 fallback 純文字（altText 也無法塞下）。
        if (orderBlocksData.length > maxBubbles)
            return null;
        const multi = orderBlocksData.length > 1;
        const WARN_COLOR = "#d9480f"; // 醒目橘紅：低信心／警示品項
        const MUTED = "#9b9a97";
        const ACCENT = "#1d4ed8";
        // [fix 2026-07-10] 單一 Flex text 值有 LINE 2000 字上限；垃圾 OCR 品名/備註可能超長 → 整則 400 推不出去。
        // 逐值截斷到 200 字，杜絕踩上限（正常品名遠短於此）。
        const clip = (s, n) => { const t = String(s == null ? "" : s); return t.length > (n || 200) ? t.slice(0, n || 200) + "…" : t; };
        // startIdx：跨 bubble 連續品項編號的起始號（多單時第二泡接續第一泡）。讓客戶在 Flex 卡上看到的
        // 號碼 == 「改第N項／刪第N項」作用的號碼（改單流程對當日全部待確認單建同一套連續編號）。
        const buildBubble = (blk, seq, startIdx) => {
            const items = Array.isArray(blk.items) ? blk.items : [];
            const shown = items.slice(0, maxItems);
            const truncated = items.length - shown.length;
            const itemRows = [];
            let idx = startIdx || 1;
            for (const it of shown) {
                const warn = !!it.warn;
                const label = clip(`${idx}. ${clip(it.name || "待確認", 120)} ${it.qtyStr || ""}${it.unit || ""}`.trim());
                itemRows.push({
                    type: "text",
                    text: warn ? `⚠ ${label}` : label,
                    size: "sm",
                    color: warn ? WARN_COLOR : "#37352f",
                    weight: warn ? "bold" : "regular",
                    wrap: true,
                });
                // 警示品項的說明文字（如「字跡跨列，請確認」）以縮排小字帶在下方。
                if (warn && it.warnText) {
                    itemRows.push({
                        type: "text",
                        text: `　${clip(it.warnText)}`,
                        size: "xxs",
                        color: WARN_COLOR,
                        wrap: true,
                    });
                }
                idx += 1;
            }
            if (truncated > 0) {
                itemRows.push({
                    type: "text",
                    text: `…等 ${truncated} 項，可傳「線上改單」查看完整品項`,
                    size: "xxs",
                    color: MUTED,
                    wrap: true,
                });
            }
            if (!itemRows.length) {
                itemRows.push({ type: "text", text: "（目前尚無可辨識品項）", size: "sm", color: MUTED, wrap: true });
            }
            const bodyContents = [];
            // Header 區（body 內，維持單一 bubble 版面一致）：已收單 + 訂單編號（多單另標序）
            bodyContents.push({
                type: "text",
                text: multi ? `✅ 已收單 (${seq}/${orderBlocksData.length})` : "✅ 已收單",
                size: "md",
                weight: "bold",
                color: ACCENT,
            });
            bodyContents.push({ type: "text", text: `送貨日期 ${dateStr}`, size: "xxs", color: MUTED, margin: "xs" });
            bodyContents.push({ type: "text", text: `訂單編號 ${blk.orderNo}`, size: "xxs", color: MUTED });
            if (blk.remark)
                bodyContents.push({ type: "text", text: clip(blk.remark), size: "xxs", color: MUTED, wrap: true });
            bodyContents.push({ type: "separator", margin: "md" });
            bodyContents.push({ type: "box", layout: "vertical", spacing: "xs", margin: "md", contents: itemRows });
            return {
                type: "bubble",
                size: "mega",
                body: { type: "box", layout: "vertical", spacing: "xs", paddingAll: "14px", contents: bodyContents },
                footer: {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    paddingAll: "12px",
                    contents: [
                        {
                            type: "button",
                            style: "primary",
                            color: ACCENT,
                            height: "sm",
                            action: { type: "message", label: "內容有誤？線上改單", text: "線上改單" },
                        },
                        {
                            type: "text",
                            text: "改單：傳「改第1項 3 公斤」或「刪第1項」（數字自換）",
                            size: "xxs",
                            color: MUTED,
                            wrap: true,
                        },
                        {
                            type: "text",
                            text: "品名有誤請刪除該項後重傳，或聯絡業務",
                            size: "xxs",
                            color: MUTED,
                            wrap: true,
                        },
                    ],
                },
            };
        };
        let contents;
        if (multi) {
            // 跨 bubble 連續編號：每泡起始號 = 前面各泡「全部品項數」累加（含被截斷的品項，
            // 以與改單流程「當日全部待確認單連續編號」對齊；截斷只影響顯示，不影響編號分配）。
            let runningIdx = 1;
            const bubbles = orderBlocksData.map((blk, i) => {
                const b = buildBubble(blk, i + 1, runningIdx);
                runningIdx += Array.isArray(blk.items) ? blk.items.length : 0;
                return b;
            });
            contents = { type: "carousel", contents: bubbles };
        }
        else {
            contents = buildBubble(orderBlocksData[0], 1, 1);
        }
        // altText：精簡摘要（品項數）；LINE altText 上限 400 字，取精簡版即可。
        const totalItems = orderBlocksData.reduce((s, b) => s + (Array.isArray(b.items) ? b.items.length : 0), 0);
        const altText = multi
            ? `已收單（共 ${orderBlocksData.length} 張、${totalItems} 項）送貨日期 ${dateStr}`
            : `已收單：品項數 ${totalItems}，送貨日期 ${dateStr}`;
        return { contents, altText };
    }
    catch (e) {
        console.warn("[LINE] buildOrderConfirmFlex 組裝失敗，fallback 純文字:", e?.message || e);
        return null;
    }
}
/** 員工關鍵字：觸發回覆功能選單（reply 免費） */
function isEmployeeMenuKeyword(text) {
    if (!text) return false;
    const t = String(text).trim().toLowerCase();
    return ["選單", "功能", "功能表", "選項", "menu", "liff", "/menu", "/功能"].includes(t);
}
/** 組「員工功能選單」Flex Message（依環境變數有設哪些 LIFF 動態列出） */
function buildEmployeeMenuFlex(employee) {
    const liffs = [
        { id: process.env.LIFF_ID_ORDER_REVIEW, label: "📋 訂單審核", subtitle: "查看 / 確認今日訂單" },
        { id: process.env.LIFF_ID_FREEZER_TEMP, label: "🌡️ 冷凍冷藏溫度", subtitle: "HACCP 日常溫度記錄" },
        { id: process.env.LIFF_ID_CUSTOMER_LOOKUP, label: "👤 客戶速查", subtitle: "搜尋客戶 360 摘要" },
        { id: process.env.LIFF_ID_EMPLOYEE_BIND, label: "📱 員工綁定", subtitle: "新員工綁定 LINE 用" },
    ].filter(x => x.id && String(x.id).trim());
    const buttons = liffs.map(l => ({
        type: "box", layout: "vertical", margin: "sm", paddingAll: "10px",
        backgroundColor: "#f3f6fb", cornerRadius: "8px",
        action: { type: "uri", uri: `https://liff.line.me/${l.id}` },
        contents: [
            { type: "text", text: l.label, weight: "bold", size: "md", color: "#1a7c6e" },
            { type: "text", text: l.subtitle, size: "xs", color: "#666666", margin: "xs" },
        ],
    }));
    const empName = (employee && (employee.name || employee.username)) || "員工";
    return {
        type: "flex",
        altText: "員工功能選單",
        contents: {
            type: "bubble",
            size: "kilo",
            header: {
                type: "box", layout: "vertical", backgroundColor: "#1a7c6e", paddingAll: "16px",
                contents: [
                    { type: "text", text: "📋 員工功能選單", color: "#ffffff", size: "lg", weight: "bold" },
                    { type: "text", text: empName, color: "#b2dfdb", size: "xs", margin: "xs" },
                ],
            },
            body: {
                type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px",
                contents: buttons.length ? buttons : [{ type: "text", text: "尚無可用 LIFF（請至後台設定）", size: "sm", color: "#999999" }],
            },
            footer: {
                type: "box", layout: "vertical", paddingAll: "10px",
                contents: [{ type: "text", text: "點任一按鈕開啟功能", size: "xxs", color: "#aaaaaa", align: "center" }],
            },
        },
    };
}
exports.buildOrderConfirmFlex = buildOrderConfirmFlex;
exports.isEmployeeMenuKeyword = isEmployeeMenuKeyword;
exports.buildEmployeeMenuFlex = buildEmployeeMenuFlex;
