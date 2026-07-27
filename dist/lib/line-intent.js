"use strict";
// 客戶意圖偵測（自 webhook/line.js 拆出，拆檔批次 9；純函式、無外部相依）：
//   detectCustomerIntent   客訴/退貨/取消/改單/到貨查詢/加叫（多匹配時有優先序）
//   extractBasketCount     從文字取空籃數量
//   detectComplaintKeywords 向後相容的舊函式名（目前 codebase 無呼叫點，保留供外部/未來使用）
Object.defineProperty(exports, "__esModule", { value: true });

/**
 * 客戶意圖偵測：依關鍵詞判斷訊息類型。
 * 回傳 { intent, keywords }，intent 為：
 *   - 'complaint'      : 客訴（最高優先級，product issues / 投訴 / refund）
 *   - 'cancel_order'   : 取消訂單
 *   - 'modify_order'   : 改訂單（改數量、改品項、改時間）
 *   - 'return_request' : 退貨／退換貨（與 complaint 重疊度高，retain to keep semantics）
 *   - 'delivery_inquiry': 詢問送貨時間／到貨進度
 *   - 'add_to_order'   : 補叫貨（既有訂單上加品項）
 *   - null             : 無特殊意圖（一般叫貨／問候）
 *
 * 多匹配時優先順序：complaint > return_request > cancel_order > modify_order > delivery_inquiry > add_to_order
 */
function detectCustomerIntent(text) {
    if (!text) return { intent: null, keywords: [] };
    const t = String(text);
    // 各意圖的關鍵詞 patterns
    const intents = [
        {
            key: "complaint",
            patterns: [
                /壞掉|壞了|爛掉|爛了|腐爛|發霉|發臭|有蟲|生蟲|長蟲|變質|不新鮮/,
                /客訴|投訴|抱怨|賠償|要賠|理賠/,
                /送錯|配錯|漏送|少送|多送|送少|送多|寄錯/,
                /上次.{0,8}(壞|爛|不好|有問題|不新鮮|不對|怪)/,
                /品質.{0,5}(差|不好|有問題)/,
                /菜.{0,5}有問題|貨.{0,5}有問題/,
            ],
        },
        {
            key: "return_request",
            patterns: [
                /退錢|退費|退貨|退掉|要退/,
                /換貨|換新的|重送/,
            ],
        },
        {
            key: "cancel_order",
            patterns: [
                /取消(訂單|這筆|今天|明天)?|不要了|不用送|別送|不出貨/,
                /(取消|刪|拿掉).{0,5}(這|那|剛剛)?(筆|張|單)/,
                /先別送|不用了/,
            ],
        },
        {
            key: "modify_order",
            patterns: [
                /改成|改為|更改|修改|想改/,
                /改.{0,5}(數量|多少|幾)/,
                /(多|少|加).{0,3}(一|二|三|四|五|六|七|八|九|十|\d)+.{0,5}(把|斤|公斤|包|罐|盒|件)/,
                /改.{0,5}(明天|後天|今天|送貨日|出貨日|時間)/,
            ],
        },
        {
            key: "delivery_inquiry",
            patterns: [
                /什麼時候(送|到)|何時(送|到)|幾點(送|到)|多久(送|到)|送到了嗎/,
                /(到|送).{0,4}(了沒|了嗎)/,
                /進度|還沒到|還沒收|還沒送/,
                /可以.{0,3}(快點|提前|提早|先送)/,
            ],
        },
        {
            key: "add_to_order",
            patterns: [
                /再加|再多|再來|順便|還要|加買/,
                /補.{0,3}(訂|單|一|二|三|四|五|六|七|八|九|十|\d)/,
                /補一(下|份|張)|再補/,
                /剛剛.{0,5}(漏|忘|沒)/,
            ],
        },
        {
            key: "basket_return",
            patterns: [
                /退籃|收籃|還籃/,
                /(\d+|一|二|三|四|五|六|七|八|九|十).{0,3}(個|顆)?籃(子|$|，|。|\s)/,
                /(空|髒)?籃.{0,5}(要還|要退|退回|回收|拿走)/,
                /籃子.{0,5}(明天|後天|下次).{0,5}(還|退)/,
            ],
        },
    ];
    // [fix 2026-07-08] extractBasketCount 已搬至模組頂層（外層 basket_return 標註處也要用），此處不再定義。
    const matched = [];
    let primaryIntent = null;
    for (const { key, patterns } of intents) {
        for (const p of patterns) {
            const m = t.match(p);
            if (m) {
                matched.push({ intent: key, keyword: m[0] });
                if (primaryIntent == null) primaryIntent = key;
                break;
            }
        }
    }
    return {
        intent: primaryIntent,
        keywords: matched.map(x => x.keyword),
        allMatches: matched,
    };
}
/** 從訊息中抽取籃數（簡單啟發式）
 * [fix 2026-07-08] 原本定義在 detectCustomerIntent 內部（區域函式），但約 L1614 的外層 basket_return
 * 意圖標註處也呼叫它 → 拋 ReferenceError 被 try/catch 靜默吞掉，籃數 remark/稽核永遠寫不進去。
 * 搬到模組頂層，內外兩處共用同一實作。
 */
function extractBasketCount(text) {
    if (!text) return null;
    const numMatch = String(text).match(/(\d+).{0,3}(個|顆)?籃/);
    if (numMatch) return parseInt(numMatch[1], 10);
    const cnMap = { "一":1,"二":2,"兩":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10 };
    const cnMatch = String(text).match(/([一二兩三四五六七八九十]).{0,3}(個|顆)?籃/);
    if (cnMatch) return cnMap[cnMatch[1]] ?? null;
    return null;
}
/** 向後相容：原本只有「客訴」用途的舊函式名 */
function detectComplaintKeywords(text) {
    const r = detectCustomerIntent(text);
    return { matched: r.intent === "complaint", keywords: r.intent === "complaint" ? r.keywords : [] };
}
exports.detectCustomerIntent = detectCustomerIntent;
exports.extractBasketCount = extractBasketCount;
exports.detectComplaintKeywords = detectComplaintKeywords;
