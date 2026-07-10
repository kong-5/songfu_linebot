"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preprocessOcrTextByTemplate = preprocessOcrTextByTemplate;
exports.detectOrderFormTemplate = detectOrderFormTemplate;
exports.buildKnownItemsHintForVision = buildKnownItemsHintForVision;
/**
 * 多客戶可擴充的表單模板層：
 * - 偵測 OCR 文字是否符合特定版型
 * - 先做版型專屬清洗，再交給 parseOrderMessage / Gemini
 * - 若是已知預印勾選表，把預印品項清單當 hint 傳給 vision Gemini
 *
 * 新客戶模板只需在 TEMPLATE_DEFS 增加一筆，不改核心流程。
 */
const TEMPLATE_DEFS = [
    {
        id: "produce_order_sheet_v1",
        name: "蔬果固定表單 v1（通用 fallback）",
        markers: ["訂購日期", "送達日期", "品項", "數量"],
        stripLine: (line) => {
            const t = String(line || "").trim();
            if (!t) return true;
            if (/電話|傳真|FAX|TEL|有限公司|統編|地址|住址/.test(t)) return true;
            if (/^客戶\s*[:：]?$/.test(t)) return true;
            if (/^(訂購日期|送達日期)\s*[:：]?$/.test(t)) return true;
            return false;
        },
    },
    {
        id: "songfu_haccp_order_form_v1",
        name: "松富 HACCP 勾選訂購單",
        // 表頭：「松富關係企業」+「食品安全管制系統 HACCP」+「089-359188」
        // 089-359188 是這款表唯一的電話 → required
        requiredMarkers: ["089-359188"],
        markers: ["松富", "HACCP", "089-359188", "品項", "數量"],
        stripLine: (line) => {
            const t = String(line || "").trim();
            if (!t) return true;
            if (/松富|HACCP|089-?(359188|225178|229178|318577)|食品安全管制系統|ISO9001|關係企業|品質認證|龍港/.test(t)) return true;
            if (/^(訂購日期|送達日期|取貨日期|客戶|品項|數量|其他品項|籃子|備註)\s*[:：]?$/.test(t)) return true;
            return false;
        },
        // 已知預印品項（用於 vision prompt hint；客戶手寫只是「在哪些品項旁邊寫數量」）
        knownItems: [
            "白蘿蔔", "紅蘿蔔", "馬鈴薯", "洋蔥", "大黃瓜", "小黃瓜", "冬瓜", "芋頭",
            "地瓜", "南瓜", "絲瓜", "扁蒲", "蕃茄", "茄子", "苦瓜",
            "紅椒", "黃椒", "青椒", "白花菜", "青花菜",
            "高麗菜", "大白菜", "鵝白菜", "小白菜", "青江菜", "油菜",
            "芥藍菜", "A菜", "大陸A", "小芥菜", "空心菜", "莧菜", "菠菜",
            "玉米(帶殼)", "玉米(去殼)",
            "辣椒", "朝天椒", "香菜", "九層塔", "青蔥", "芹菜", "韭菜",
            "蒜仁", "蒜末", "老薑", "薑絲", "紫高麗", "紫洋蔥", "牛蒡", "山藥",
            "金針菇", "生香菇", "秀珍菇", "雪白菇", "鴻喜菇", "杏鮑菇", "鮑魚菇",
            "白靈菇", "洋菇", "木耳", "玉米筍", "豆苗", "苜蓿芽",
            "西芹", "蘿蔓", "美生菜", "生菜葉", "甜豆", "蘆筍",
        ],
    },
    {
        id: "lungang_order_form_v1",
        name: "龍港勾選訂購單",
        // 表頭：「龍港」+「叫貨日期」
        // 叫貨日期 是這款表特有用語（其他用「訂購日期」） → required
        requiredMarkers: ["叫貨日期"],
        markers: ["龍港", "叫貨日期", "品項", "數量"],
        stripLine: (line) => {
            const t = String(line || "").trim();
            if (!t) return true;
            if (/^龍港|叫貨日期|電話|傳真|統編|地址/.test(t)) return true;
            if (/^(品項|數量|其他品項|備註)\s*[:：]?$/.test(t)) return true;
            return false;
        },
        knownItems: [
            "洋蔥", "牛蕃茄", "紅甜椒", "青椒", "紅辣椒", "綠辣椒", "糯米椒",
            "金針菇", "秀珍菇", "洋菇", "香菇", "白靈菇", "杏包菇",
            "蒜苗", "芹菜", "香菜",
            "薑絲", "老薑", "九層塔", "小白菜", "蘆筍", "綠櫛瓜",
            "帶殼玉米筍", "秋葵", "長豆", "綠花椰", "馬鈴薯", "黃地瓜",
            "紫包心", "美生菜", "蘿蔓", "金桔", "檸檬", "小黃瓜",
            "C級杏鮑", "芋頭", "細綠櫛瓜",
        ],
    },
    {
        id: "tangzheng_huoguo_order_form_v1",
        name: "湯蒸火鍋專屬訂購單",
        // 表頭：「客戶：湯蒸火鍋」+「食品安全管制系」
        // 「湯蒸火鍋」是這款表唯一的識別 → required
        requiredMarkers: ["湯蒸火鍋"],
        markers: ["湯蒸火鍋", "送達日期", "食品安全管制系"],
        stripLine: (line) => {
            const t = String(line || "").trim();
            if (!t) return true;
            if (/湯蒸火鍋|食品安全管制系|電話|傳真|送達日期|其他品項/.test(t)) return true;
            if (/^(品項|數量|客戶)\s*[:：]?$/.test(t)) return true;
            return false;
        },
        knownItems: [
            "南瓜", "絲瓜", "大黃瓜", "小黃瓜", "扁蒲", "冬瓜",
            "黃地瓜(黃)", "紫地瓜(紫)", "白蘿蔔", "紅蘿蔔", "洋蔥",
            "玉米筍", "去殼玉米",
            "豆苗", "四季豆", "老薑", "水蓮", "芹菜", "香菜",
            "青蔥", "金桔", "蒜苗", "紅椒",
            "高麗菜", "大白菜(本產)", "鵝白菜", "油菜", "大陸妹",
            "A菜", "茼蒿", "山茼蒿", "奶油白", "菠菜", "青花菜",
            "茄子", "蕃茄", "秋葵",
            "金針菇", "秀珍菇", "生香菇(中)", "杏鮑菇", "美白菇",
            "鴻喜菇", "川耳", "海帶結", "蛤蜊", "鴨血", "鳥蛋",
        ],
    },
];
function detectOrderFormTemplate(ocrText) {
    const text = String(ocrText || "");
    if (!text) return null;
    // 高特異度 template 優先（後加的 = 更具體）→ 反向 iterate
    for (let i = TEMPLATE_DEFS.length - 1; i >= 0; i--) {
        const def = TEMPLATE_DEFS[i];
        // required markers 必須全部命中（高特異度 short-circuit）
        if (Array.isArray(def.requiredMarkers) && def.requiredMarkers.length > 0) {
            const reqHit = def.requiredMarkers.every((m) => text.includes(m));
            if (!reqHit) continue;
        }
        const hit = def.markers.filter((m) => text.includes(m)).length;
        const need = Math.max(2, Math.ceil(def.markers.length * 0.6));
        if (hit >= need) return def;
    }
    return null;
}
function preprocessOcrTextByTemplate(ocrText, template) {
    const raw = String(ocrText || "");
    if (!raw || !template) return raw;
    const lines = raw.split(/\r?\n/).map((x) => x.trim());
    // 嘗試從第一個「品項」表頭開始，只留表格主體
    let startIdx = lines.findIndex((l) => /品項/.test(l) && /數量/.test(l));
    if (startIdx < 0) startIdx = lines.findIndex((l) => /品項/.test(l));
    const scoped = startIdx >= 0 ? lines.slice(startIdx) : lines;
    const kept = scoped.filter((line) => !template.stripLine(line));
    return kept.join("\n").trim();
}
/**
 * 給 vision Gemini 的 hint：這張圖是 X 表，預印品項只可能是 [...]，
 * 客戶手寫的只有「數量＋單位」貼在某品項旁邊（或寫在「其他品項」欄）。
 * 讓 vision 不要瞎猜品名（普羅蔔/養生菜 等誤辨來源）。
 */
function buildKnownItemsHintForVision(template) {
    if (!template || !Array.isArray(template.knownItems) || template.knownItems.length === 0) return "";
    return [
        "",
        "【這張圖是預印勾選表「" + template.name + "」】",
        "表上**預印**的品項只可能是下列其中一個（精確比對，不要自己改字、不要簡寫、不要組合）：",
        template.knownItems.map((s) => "  - " + s).join("\n"),
        "其他可能出現在「其他品項」手寫欄。",
        "客戶**只在數量欄手寫**（例：3K, 0.5K, 20公斤, 1包, 1袋）。",
        "**重要**：請逐行掃描表格，找出「在數量欄有寫東西」的行，回那一行的『預印品項名稱』+ 手寫數量。",
        "【手寫數量對行規則】",
        "- 手寫字常比格子大、筆畫往上溢出：歸屬以手寫字的**垂直中心／底部基線**落在哪一列為準，**不要**因筆畫碰到上一列就判給上一列。",
        "- 特別注意「上一列數量欄空白、下一列有字」的相鄰組合：手寫底部貼齊哪一列的品項，就屬於那一列。",
        "- 若一個數字**明顯刻意橫跨兩列**（垂直大致均分覆蓋兩列、且兩列數量欄都無其他字），可能是客戶表達「兩列都是這個數量」：**不要自行猜一列**，兩列各回一筆，confidenceScore 都壓到 40 以下，remark 填「⚠ 字跡跨列（品項A/品項B），請確認」。",
        "- 回覆前逐筆自我檢查：你回的每個品項，那一列的數量欄**必須真的有墨跡**；沒有墨跡的品項不要出現在結果。",
        "若某行數量欄空白，請**不要**把該品項列入結果。",
        "",
    ].join("\n");
}
