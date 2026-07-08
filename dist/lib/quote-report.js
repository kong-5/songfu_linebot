"use strict";
/**
 * 客戶報價（月報）核心模組。
 *
 * 需求脈絡（給維護者）：
 *  - 每月月底前需要「下個月」的報價單（產品表）。價格會浮動，所以每月重做。
 *  - 新增月報時，會把「上個月」的品項＋單價整份帶入當底稿，使用者只需改動有變動的價格。
 *  - 品項可能新增／刪除，也可能某些品項「不報價」（單價留白，但品項仍列出）。
 *  - 顯示順序要照「品項分類」分群，不可冷凍／青菜／雜貨交錯，才顯得專業。
 *  - 最後要能輸出 PDF（走列印頁）或 JPG 圖（伺服器 SVG→sharp）。
 *
 * 資料表：quote_report（月報表頭）、quote_item（品項明細）。
 * DB 介面沿用專案慣例：函式第一個參數傳入 db（getDb 回傳物件，prepare().get/all/run 皆為 Promise）。
 */
Object.defineProperty(exports, "__esModule", { value: true });

const { newId } = require("./id.js");

/** 分類顯示順序（未列出的分類排在最後，依首次出現順序）。 */
const CATEGORY_ORDER = [
    "菇菌類",
    "生鮮蔬菜",
    "冷凍蔬菜",
    "醃漬加工",
    "豆製品",
    "麵條濕貨",
    "海帶海鮮",
    "南北乾貨",
    "醬料調味",
    "清潔日用",
];
exports.CATEGORY_ORDER = CATEGORY_ORDER;

/** 分類排序權重：已知分類用其索引；未知分類排在已知之後（維持相對穩定）。 */
function categoryRank(category) {
    const idx = CATEGORY_ORDER.indexOf(String(category || "").trim());
    return idx >= 0 ? idx : CATEGORY_ORDER.length + 1;
}
exports.categoryRank = categoryRank;

function nowIso() {
    return new Date().toISOString();
}

/** YYYY-MM → 民國「115年07月份」樣式標籤。 */
function rocLabelFromYm(ym) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(ym || "").trim());
    if (!m) return "";
    const roc = parseInt(m[1], 10) - 1911;
    return `${roc}年${m[2]}月份`;
}
exports.rocLabelFromYm = rocLabelFromYm;

/** 下一個月份的 YYYY-MM（給「本月底提醒做下月報價」用）。 */
function nextYm(ym) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(ym || "").trim());
    if (!m) return "";
    let y = parseInt(m[1], 10);
    let mo = parseInt(m[2], 10) + 1;
    if (mo > 12) { mo = 1; y += 1; }
    return `${y}-${String(mo).padStart(2, "0")}`;
}
exports.nextYm = nextYm;

/** 由 Date（台北時區）取 YYYY-MM。 */
function ymFromDate(d) {
    const t = new Date(d.getTime() + 8 * 3600 * 1000); // 轉台北
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}
exports.ymFromDate = ymFromDate;

const DEFAULT_HEADER = {
    title: "報 價 單",
    subtitle: "產 品 表",
    company: "台東龍港、松富(股)公司",
    address: "台東市正氣北路1171號",
    tel: "089-225178",
    fax: "089-229178",
};
exports.DEFAULT_HEADER = DEFAULT_HEADER;

/** 列出所有月報（新到舊）。 */
async function listReports(db) {
    return await db.prepare(
        "SELECT * FROM quote_report ORDER BY ym DESC, created_at DESC"
    ).all();
}
exports.listReports = listReports;

async function getReport(db, id) {
    return await db.prepare("SELECT * FROM quote_report WHERE id = ?").get(id);
}
exports.getReport = getReport;

async function getReportByYm(db, ym) {
    return await db.prepare("SELECT * FROM quote_report WHERE ym = ?").get(ym);
}
exports.getReportByYm = getReportByYm;

/** 取某月報所有品項，已依「分類順序→分類內排序→序號」排好。 */
async function getItems(db, reportId) {
    const rows = await db.prepare(
        "SELECT * FROM quote_item WHERE report_id = ? ORDER BY sort_order ASC, created_at ASC"
    ).all(reportId);
    return rows.slice().sort((a, b) => {
        const ra = categoryRank(a.category), rb = categoryRank(b.category);
        if (ra !== rb) return ra - rb;
        if (a.category !== b.category) return String(a.category).localeCompare(String(b.category), "zh-Hant");
        return (a.sort_order || 0) - (b.sort_order || 0);
    });
}
exports.getItems = getItems;

/** 取品項並依分類分群，回傳 [{ category, items }]（分群後才做兩欄版面用）。 */
async function getItemsGrouped(db, reportId) {
    const items = await getItems(db, reportId);
    const groups = [];
    const map = new Map();
    for (const it of items) {
        const cat = String(it.category || "未分類").trim() || "未分類";
        if (!map.has(cat)) {
            const g = { category: cat, items: [] };
            map.set(cat, g);
            groups.push(g);
        }
        map.get(cat).items.push(it);
    }
    return groups;
}
exports.getItemsGrouped = getItemsGrouped;

/**
 * 建立新月報。若 copyFromReportId 有值（或找得到上一份月報），把該份品項整份帶入當底稿。
 * 回傳新月報的 id。
 */
async function createReport(db, opts) {
    const ym = String(opts.ym || "").trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error("月份格式需為 YYYY-MM");
    const existing = await getReportByYm(db, ym);
    if (existing) return existing.id;

    const id = newId("qr");
    const header = { ...DEFAULT_HEADER, ...(opts.header || {}) };
    await db.prepare(
        `INSERT INTO quote_report (id, ym, roc_label, title, subtitle, company, address, tel, fax, status, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    ).run(
        id, ym, rocLabelFromYm(ym), header.title, header.subtitle, header.company,
        header.address, header.tel, header.fax, opts.note || null, nowIso(), nowIso()
    );

    // 找底稿來源：優先指定的，否則抓 ym 小於本月的最新一份
    let sourceId = opts.copyFromReportId || null;
    if (!sourceId) {
        const prev = await db.prepare(
            "SELECT id FROM quote_report WHERE ym < ? ORDER BY ym DESC LIMIT 1"
        ).get(ym);
        if (prev) sourceId = prev.id;
    }
    if (sourceId) {
        const src = await getItems(db, sourceId);
        let i = 0;
        for (const it of src) {
            await addItem(db, id, {
                category: it.category,
                name: it.name,
                spec: it.spec,
                price: it.is_quoted ? it.price : null,
                is_quoted: it.is_quoted,
                sort_order: i,
            });
            i++;
        }
    }
    return id;
}
exports.createReport = createReport;

async function updateReportHeader(db, id, header) {
    await db.prepare(
        `UPDATE quote_report SET title = ?, subtitle = ?, company = ?, address = ?, tel = ?, fax = ?, note = ?, updated_at = ? WHERE id = ?`
    ).run(
        header.title ?? DEFAULT_HEADER.title, header.subtitle ?? DEFAULT_HEADER.subtitle,
        header.company ?? DEFAULT_HEADER.company, header.address ?? DEFAULT_HEADER.address,
        header.tel ?? DEFAULT_HEADER.tel, header.fax ?? DEFAULT_HEADER.fax,
        header.note ?? null, nowIso(), id
    );
}
exports.updateReportHeader = updateReportHeader;

async function setReportStatus(db, id, status) {
    await db.prepare("UPDATE quote_report SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), id);
}
exports.setReportStatus = setReportStatus;

async function deleteReport(db, id) {
    await db.prepare("DELETE FROM quote_item WHERE report_id = ?").run(id);
    await db.prepare("DELETE FROM quote_report WHERE id = ?").run(id);
}
exports.deleteReport = deleteReport;

/** 正規化單價：允許空字串（→不報價）；否則保留數字或原字串。 */
function normalizePrice(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return { price: null, is_quoted: 0 };
    // 明確標記不報價
    if (/^(x|X|－|-|不報價|不報)$/.test(s)) return { price: null, is_quoted: 0 };
    return { price: s, is_quoted: 1 };
}
exports.normalizePrice = normalizePrice;

async function addItem(db, reportId, item) {
    const id = newId("qi");
    let is_quoted = item.is_quoted;
    let price = item.price;
    if (is_quoted === undefined || is_quoted === null) {
        const n = normalizePrice(price);
        price = n.price; is_quoted = n.is_quoted;
    } else {
        is_quoted = is_quoted ? 1 : 0;
        if (!is_quoted) price = null;
        else price = (price === null || price === undefined || String(price).trim() === "") ? null : String(price).trim();
    }
    let sort = item.sort_order;
    if (sort === undefined || sort === null) {
        const row = await db.prepare("SELECT MAX(sort_order) AS m FROM quote_item WHERE report_id = ?").get(reportId);
        sort = ((row && row.m) || 0) + 1;
    }
    await db.prepare(
        `INSERT INTO quote_item (id, report_id, category, name, spec, price, is_quoted, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        id, reportId, String(item.category || "未分類").trim() || "未分類",
        String(item.name || "").trim(), item.spec == null ? null : String(item.spec).trim(),
        price, is_quoted, sort, nowIso()
    );
    return id;
}
exports.addItem = addItem;

async function updateItem(db, itemId, patch) {
    const cur = await db.prepare("SELECT * FROM quote_item WHERE id = ?").get(itemId);
    if (!cur) return;
    let price = cur.price, is_quoted = cur.is_quoted;
    if ("price" in patch || "is_quoted" in patch) {
        if ("is_quoted" in patch && (patch.is_quoted === 0 || patch.is_quoted === false)) {
            is_quoted = 0; price = null;
        } else {
            const n = normalizePrice("price" in patch ? patch.price : cur.price);
            price = n.price; is_quoted = n.is_quoted;
        }
    }
    await db.prepare(
        "UPDATE quote_item SET category = ?, name = ?, spec = ?, price = ?, is_quoted = ?, sort_order = ? WHERE id = ?"
    ).run(
        patch.category != null ? String(patch.category).trim() || "未分類" : cur.category,
        patch.name != null ? String(patch.name).trim() : cur.name,
        patch.spec !== undefined ? (patch.spec == null ? null : String(patch.spec).trim()) : cur.spec,
        price, is_quoted,
        patch.sort_order != null ? patch.sort_order : cur.sort_order,
        itemId
    );
}
exports.updateItem = updateItem;

async function deleteItem(db, itemId) {
    await db.prepare("DELETE FROM quote_item WHERE id = ?").run(itemId);
}
exports.deleteItem = deleteItem;

/** 供設定 LOGO：存在 app_settings，key = quote_logo_data_uri（data: URI 字串）。 */
async function getLogoDataUri(db) {
    try {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("quote_logo_data_uri");
        return row && row.value ? String(row.value) : "";
    } catch (_) { return ""; }
}
exports.getLogoDataUri = getLogoDataUri;

async function setLogoDataUri(db, dataUri) {
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("quote_logo_data_uri", dataUri || "");
}
exports.setLogoDataUri = setLogoDataUri;

// 預設 LOGO：讀 dist/admin/assets/logo.svg 光柵化為 PNG data URI（快取）。
// 用 PNG 而非 SVG，因為 sharp 產報價單 JPG 時以 <image> 內嵌，PNG 相容性最穩。
let _defaultLogoDataUri = null;
async function getDefaultLogoDataUri() {
    if (_defaultLogoDataUri !== null) return _defaultLogoDataUri;
    try {
        const sharp = require("sharp");
        const path = require("path");
        const fs = require("fs");
        const svgPath = path.join(__dirname, "..", "admin", "assets", "logo.svg");
        const svgBuf = fs.readFileSync(svgPath);
        const png = await sharp(svgBuf, { density: 300 })
            .resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png().toBuffer();
        _defaultLogoDataUri = "data:image/png;base64," + png.toString("base64");
    } catch (e) {
        _defaultLogoDataUri = "";
    }
    return _defaultLogoDataUri;
}
exports.getDefaultLogoDataUri = getDefaultLogoDataUri;

/** 報價單實際使用的 LOGO：有自訂就用自訂，否則用內建公司標誌。 */
async function resolveLogoDataUri(db) {
    const custom = await getLogoDataUri(db);
    if (custom) return custom;
    return await getDefaultLogoDataUri();
}
exports.resolveLogoDataUri = resolveLogoDataUri;

// ─────────────────────────────────────────────────────────────────────────────
// 7 月報價單範本 seed（來自使用者提供的 PDF；價格與規格照抄，空白／X 為不報價）
// 供「匯入 7 月範本」一鍵建立可立即操作的月報。
// [品名, 規格, 單價(空字串或 'X' = 不報價), 分類]
// ─────────────────────────────────────────────────────────────────────────────
const SEED_JULY_ITEMS = [
    // 菇菌類
    ["金針菇/真空包", "1小包/200公克", "8", "菇菌類"],
    ["金針菇", "5KG", "X", "菇菌類"],
    ["秀珍菇", "KG", "120", "菇菌類"],
    ["生香菇", "KG", "140", "菇菌類"],
    ["鮑魚菇", "KG", "145", "菇菌類"],
    ["杏鮑菇", "KG", "105", "菇菌類"],
    ["珊瑚菇", "KG", "240", "菇菌類"],
    ["雪白菇", "小包/約100克", "30", "菇菌類"],
    ["鴻喜菇", "小包/約100克", "30", "菇菌類"],
    ["洋菇", "盒/約200克", "80", "菇菌類"],
    ["白靈菇", "KG", "140", "菇菌類"],
    ["木耳-中", "KG", "75", "菇菌類"],
    ["木耳-大", "KG", "", "菇菌類"],
    ["柳松菇", "小包/約200克", "50", "菇菌類"],
    // 生鮮蔬菜
    ["苜宿芽", "盒/100公克", "15", "生鮮蔬菜"],
    ["玉米筍/小盒", "100G/盒", "30", "生鮮蔬菜"],
    ["玉米筍(帶殼)", "KG", "55", "生鮮蔬菜"],
    ["巴西里", "KG", "160", "生鮮蔬菜"],
    ["蘆筍(進口)", "KG", "450", "生鮮蔬菜"],
    ["蘆筍/小把(進口)", "把/150G/細", "60", "生鮮蔬菜"],
    ["蘆筍/大把(進口)", "把/300G/粗", "120", "生鮮蔬菜"],
    ["青花(進口)", "KG", "120", "生鮮蔬菜"],
    ["廣東A", "KG", "150", "生鮮蔬菜"],
    ["蘿美生菜(進口)", "KG", "230", "生鮮蔬菜"],
    ["西芹(進口)", "KG", "70", "生鮮蔬菜"],
    ["美生菜(進口)", "KG", "190", "生鮮蔬菜"],
    ["紫高麗菜", "KG", "55", "生鮮蔬菜"],
    ["紫洋蔥", "KG", "65", "生鮮蔬菜"],
    ["蒜苗", "KG", "240", "生鮮蔬菜"],
    ["櫻桃蘿蔔", "KG", "520", "生鮮蔬菜"],
    ["黃櫛瓜(進口)", "KG", "", "生鮮蔬菜"],
    ["綠櫛瓜(進口)", "KG", "130", "生鮮蔬菜"],
    ["芹菜", "KG", "180", "生鮮蔬菜"],
    ["香菜", "KG", "500", "生鮮蔬菜"],
    ["紅捲鬚", "KG", "550", "生鮮蔬菜"],
    ["綠捲鬚", "KG", "550", "生鮮蔬菜"],
    ["紫包心菜", "KG", "300", "生鮮蔬菜"],
    ["皇宮菜", "KG", "95", "生鮮蔬菜"],
    ["青龍", "KG", "145", "生鮮蔬菜"],
    ["紅鳳菜", "KG", "130", "生鮮蔬菜"],
    ["山茼蒿", "KG", "", "生鮮蔬菜"],
    ["紫山藥", "KG", "", "生鮮蔬菜"],
    ["山藥", "KG", "140", "生鮮蔬菜"],
    ["桂竹筍", "KG", "160", "生鮮蔬菜"],
    ["白蘿蔔進口", "KG", "35", "生鮮蔬菜"],
    ["甜豆(台灣)", "KG", "230", "生鮮蔬菜"],
    ["荷蘭豆(台灣)", "KG", "230", "生鮮蔬菜"],
    ["牛蒡", "KG", "48", "生鮮蔬菜"],
    ["水蓮", "包", "28", "生鮮蔬菜"],
    ["九層塔", "KG", "140", "生鮮蔬菜"],
    ["石蓮花", "盒", "45", "生鮮蔬菜"],
    ["娃娃菜", "包", "34", "生鮮蔬菜"],
    ["豆苗", "盒/100公克", "22", "生鮮蔬菜"],
    ["豆苗", "KG", "125", "生鮮蔬菜"],
    ["荸薺", "KG", "180", "生鮮蔬菜"],
    ["冷筍", "包", "75", "生鮮蔬菜"],
    ["日本山藥", "KG", "230", "生鮮蔬菜"],
    ["豆薯(新)", "KG", "50", "生鮮蔬菜"],
    ["甜菜根", "KG", "140", "生鮮蔬菜"],
    ["蒜仁", "KG", "120", "生鮮蔬菜"],
    ["薑絲", "KG", "140", "生鮮蔬菜"],
    ["蒜末", "KG", "140", "生鮮蔬菜"],
    ["黃地瓜(山上)", "KG", "40", "生鮮蔬菜"],
    ["紅地瓜(山上)", "KG", "40", "生鮮蔬菜"],
    ["蘭花", "束/10支", "220", "生鮮蔬菜"],
    ["進口大白", "kg", "40", "生鮮蔬菜"],
    ["黃豆芽", "KG", "36", "生鮮蔬菜"],
    ["茭白筍帶殼", "KG", "180", "生鮮蔬菜"],
    ["茭白筍去殼", "KG", "220", "生鮮蔬菜"],
    ["長豆", "KG", "", "生鮮蔬菜"],
    ["青木瓜", "KG", "59", "生鮮蔬菜"],
    ["辣椒", "KG", "130", "生鮮蔬菜"],
    ["朝天椒", "KG", "115", "生鮮蔬菜"],
    ["芥菜心", "KG", "", "生鮮蔬菜"],
    // 冷凍蔬菜
    ["冷凍玉米粒", "KG", "75", "冷凍蔬菜"],
    ["冷凍三色豆", "KG", "65", "冷凍蔬菜"],
    ["冷凍毛豆仁", "KG", "135", "冷凍蔬菜"],
    ["冷凍青豆仁", "KG", "80", "冷凍蔬菜"],
    ["冷凍白花", "KG", "65", "冷凍蔬菜"],
    ["冷凍青花", "KG", "65", "冷凍蔬菜"],
    // 醃漬加工
    ["酸菜", "KG", "55", "醃漬加工"],
    ["酸菜心", "KG", "70", "醃漬加工"],
    ["酸菜黑絲", "KG", "55", "醃漬加工"],
    ["榨菜絲", "KG", "50", "醃漬加工"],
    ["雪裡紅", "KG", "52", "醃漬加工"],
    ["筍絲Ｔ６", "KG", "85", "醃漬加工"],
    // 豆製品
    ["豆干", "KG", "68", "豆製品"],
    ["油豆腐", "KG", "81", "豆製品"],
    ["豆包", "KG", "110", "豆製品"],
    ["中華豆腐", "盒/300公克", "18", "豆製品"],
    ["盒裝豆腐(非基改)", "盒/300公克", "18", "豆製品"],
    ["雞蛋豆腐", "盒/300公克", "38", "豆製品"],
    ["鴨血", "粒", "15", "豆製品"],
    ["豬血", "KG", "40", "豆製品"],
    // 麵條濕貨
    ["油麵", "KG", "48", "麵條濕貨"],
    ["板條", "KG", "75", "麵條濕貨"],
    ["陽春麵", "KG", "80", "麵條濕貨"],
    ["烏龍", "KG", "80", "麵條濕貨"],
    ["米苔目", "KG", "80", "麵條濕貨"],
    ["冬粉", "KG", "95", "麵條濕貨"],
    // 海帶海鮮
    ["海帶絲", "KG", "110", "海帶海鮮"],
    ["海帶片", "KG", "110", "海帶海鮮"],
    ["海帶結", "KG", "110", "海帶海鮮"],
    ["海帶根", "KG", "130", "海帶海鮮"],
    ["海帶芽", "KG", "350", "海帶海鮮"],
    ["海茸", "KG", "110", "海帶海鮮"],
    ["蛤蠣(中)", "KG", "110", "海帶海鮮"],
    // 南北乾貨
    ["冬瓜糖磚", "塊", "40", "南北乾貨"],
    ["紅豆", "KG", "180", "南北乾貨"],
    ["綠豆", "KG", "120", "南北乾貨"],
    ["小薏仁", "KG", "80", "南北乾貨"],
    ["滷包", "包", "140", "南北乾貨"],
    // 醬料調味
    ["味精", "包", "95", "醬料調味"],
    ["沙拉油", "桶/18KG", "890", "醬料調味"],
    ["二砂", "包/1KG", "35", "醬料調味"],
    ["鹽", "包/1KG", "17", "醬料調味"],
    ["粗鹽", "袋/25KG", "175", "醬料調味"],
    ["四季醬油", "罐/6KG", "245", "醬料調味"],
    ["四季醬油膏", "罐/6KG", "225", "醬料調味"],
    ["可果美番茄醬(小)", "罐/700g", "98", "醬料調味"],
    ["可果美番茄醬(大)", "罐/3.3KG", "240", "醬料調味"],
    ["辣豆瓣醬(大)", "罐/2.7KG", "145", "醬料調味"],
    ["明德甜麵醬(中)", "罐/460g", "95", "醬料調味"],
    ["甜麵醬(大)", "罐/3.1KG", "365", "醬料調味"],
    ["明德不辣豆瓣醬", "罐/460g", "95", "醬料調味"],
    ["不辣豆瓣醬", "罐/3KG", "395", "醬料調味"],
    ["工研烏醋(中)", "罐/600cc", "55", "醬料調味"],
    ["工研烏醋(大)", "罐/5L", "220", "醬料調味"],
    ["牛頭牌沙茶醬(大)", "罐/3KG", "545", "醬料調味"],
    ["牛頭牌沙茶醬(中)", "罐/737g", "225", "醬料調味"],
    ["牛頭牌沙茶醬(小)", "罐/250g", "140", "醬料調味"],
    // 清潔日用
    ["洗碗精", "罐", "60", "清潔日用"],
    ["漂白水", "罐", "60", "清潔日用"],
    ["洗衣粉", "袋", "220", "清潔日用"],
    ["保鮮膜", "個", "120", "清潔日用"],
];
exports.SEED_JULY_ITEMS = SEED_JULY_ITEMS;

/** 建立一份帶入 7 月範本品項的月報（若該月已存在則只回傳其 id、不重覆匯入）。 */
async function seedTemplateReport(db, ym) {
    const targetYm = /^\d{4}-\d{2}$/.test(String(ym || "")) ? ym : "2026-07";
    const existing = await getReportByYm(db, targetYm);
    if (existing) {
        const cnt = await db.prepare("SELECT COUNT(*) AS n FROM quote_item WHERE report_id = ?").get(existing.id);
        if (cnt && cnt.n > 0) return existing.id;
        // 有表頭但沒品項 → 補匯入
        let i0 = 0;
        for (const [name, spec, price, category] of SEED_JULY_ITEMS) {
            await addItem(db, existing.id, { category, name, spec, price, sort_order: i0++ });
        }
        return existing.id;
    }
    const id = newId("qr");
    await db.prepare(
        `INSERT INTO quote_report (id, ym, roc_label, title, subtitle, company, address, tel, fax, status, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    ).run(
        id, targetYm, rocLabelFromYm(targetYm), DEFAULT_HEADER.title, DEFAULT_HEADER.subtitle,
        DEFAULT_HEADER.company, DEFAULT_HEADER.address, DEFAULT_HEADER.tel, DEFAULT_HEADER.fax,
        null, nowIso(), nowIso()
    );
    let i = 0;
    for (const [name, spec, price, category] of SEED_JULY_ITEMS) {
        await addItem(db, id, { category, name, spec, price, sort_order: i++ });
    }
    return id;
}
exports.seedTemplateReport = seedTemplateReport;

// ─────────────────────────────────────────────────────────────────────────────
// 版面：把已排序品項攤平成「顯示列」（分類標題列 + 品項列），再平均分成兩欄。
// HTML 列印頁與 JPG 圖共用同一套分欄邏輯，確保兩者版面一致。
// ─────────────────────────────────────────────────────────────────────────────

/** 產生顯示列陣列：{ type:'cat'|'item', ... }，品項附上流水序號。 */
function buildDisplayRows(groups) {
    const rows = [];
    let seq = 0;
    for (const g of groups) {
        rows.push({ type: "cat", category: g.category, count: g.items.length });
        for (const it of g.items) {
            seq++;
            rows.push({
                type: "item",
                seq,
                name: it.name,
                spec: it.spec || "",
                priceText: it.is_quoted ? (it.price == null ? "" : String(it.price)) : "",
                quoted: !!it.is_quoted,
            });
        }
    }
    return rows;
}
exports.buildDisplayRows = buildDisplayRows;

/**
 * 把顯示列平均分成兩欄；為避免「分類標題落在欄尾、內容跑到下一欄開頭」，
 * 分割點盡量落在分類邊界附近。回傳 [leftRows, rightRows]。
 */
function splitTwoColumns(rows) {
    const total = rows.length;
    if (total === 0) return [[], []];
    const target = Math.ceil(total / 2);
    // 從 target 附近找最接近的「分類標題」當切點，避免標題孤兒
    let cut = target;
    let best = -1, bestDist = Infinity;
    for (let i = 1; i < total; i++) {
        if (rows[i].type === "cat") {
            const d = Math.abs(i - target);
            if (d < bestDist) { bestDist = d; best = i; }
        }
    }
    // 只有在切點合理（不讓某欄過短，落在 30%~70% 間）時才用分類邊界
    if (best > total * 0.3 && best < total * 0.7) cut = best;
    return [rows.slice(0, cut), rows.slice(cut)];
}
exports.splitTwoColumns = splitTwoColumns;

function escapeXml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** 產生報價單 SVG（A4 直式，兩欄）。logoDataUri 可為空。 */
function renderQuoteSvg(report, groups, opts) {
    opts = opts || {};
    const logo = opts.logoDataUri || "";
    const rows = buildDisplayRows(groups);
    const [colL, colR] = splitTwoColumns(rows);

    const W = 1240;
    const MARGIN = 40;
    const headerH = 190;
    const rowH = 30;
    const colGap = 24;
    const colW = (W - MARGIN * 2 - colGap) / 2; // 每欄寬
    const maxRows = Math.max(colL.length, colR.length);
    const bodyTop = headerH + 44; // 表頭下方 + 欄位標題列
    const footerH = 60;
    const H = Math.max(1754, bodyTop + maxRows * rowH + footerH);

    const FONT = "'Noto Sans CJK TC','Noto Sans TC','Microsoft JhengHei','PingFang TC',sans-serif";

    // 欄位寬度（欄內）：序號 / 品名 / 規格 / 單價
    const cSeq = 40, cName = colW * 0.44, cSpec = colW * 0.34, cPrice = colW - cSeq - (colW * 0.44) - (colW * 0.34);

    function renderColumn(colRows, x0) {
        let out = "";
        // 欄位標題列
        const hy = bodyTop - 8;
        out += `<rect x="${x0}" y="${bodyTop - rowH}" width="${colW}" height="${rowH}" fill="#eef2f7" stroke="#c8d0da"/>`;
        let cx = x0;
        const heads = [["序號", cSeq, "middle"], ["品　名", cName, "start"], ["規　格", cSpec, "start"], ["單　價", cPrice, "end"]];
        let hx = x0;
        for (const [label, w, anchor] of heads) {
            const tx = anchor === "middle" ? hx + w / 2 : anchor === "end" ? hx + w - 8 : hx + 8;
            out += `<text x="${tx}" y="${hy}" font-size="15" font-weight="700" fill="#334" text-anchor="${anchor}" font-family="${FONT}">${escapeXml(label)}</text>`;
            hx += w;
        }
        let y = bodyTop;
        for (const r of colRows) {
            if (r.type === "cat") {
                out += `<rect x="${x0}" y="${y}" width="${colW}" height="${rowH}" fill="#1e7a5e"/>`;
                out += `<text x="${x0 + 10}" y="${y + rowH - 9}" font-size="15" font-weight="700" fill="#ffffff" font-family="${FONT}">${escapeXml(r.category)}</text>`;
                out += `<text x="${x0 + colW - 8}" y="${y + rowH - 9}" font-size="12" fill="#cdebd9" text-anchor="end" font-family="${FONT}">${r.count} 項</text>`;
            } else {
                out += `<rect x="${x0}" y="${y}" width="${colW}" height="${rowH}" fill="${r.seq % 2 ? "#ffffff" : "#f7f9fb"}" stroke="#e3e8ee"/>`;
                let ix = x0;
                // 序號
                out += `<text x="${ix + cSeq / 2}" y="${y + rowH - 9}" font-size="13" fill="#556" text-anchor="middle" font-family="${FONT}">${r.seq}</text>`;
                ix += cSeq;
                // 品名
                out += `<text x="${ix + 8}" y="${y + rowH - 9}" font-size="14" fill="#222" font-family="${FONT}">${escapeXml(clip(r.name, 12))}</text>`;
                ix += cName;
                // 規格
                out += `<text x="${ix + 8}" y="${y + rowH - 9}" font-size="12" fill="#667" font-family="${FONT}">${escapeXml(clip(r.spec, 12))}</text>`;
                ix += cSpec;
                // 單價
                const priceDisplay = r.quoted ? r.priceText : "—";
                const priceColor = r.quoted ? "#111" : "#b0b6bf";
                out += `<text x="${ix + cPrice - 8}" y="${y + rowH - 9}" font-size="14" font-weight="${r.quoted ? 700 : 400}" fill="${priceColor}" text-anchor="end" font-family="${FONT}">${escapeXml(priceDisplay)}</text>`;
            }
            y += rowH;
        }
        return out;
    }

    const logoBox = logo
        ? `<image href="${escapeXml(logo)}" x="${MARGIN}" y="30" width="120" height="120" preserveAspectRatio="xMidYMid meet"/>`
        : `<rect x="${MARGIN}" y="40" width="110" height="110" fill="none" stroke="#ccd3db" stroke-dasharray="4 4"/><text x="${MARGIN + 55}" y="100" font-size="14" fill="#aab" text-anchor="middle" font-family="${FONT}">LOGO</text>`;

    const centerX = W / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
${logoBox}
<text x="${centerX}" y="70" text-anchor="middle" font-size="38" font-weight="800" fill="#1e7a5e" font-family="${FONT}" letter-spacing="6">${escapeXml(report.title || DEFAULT_HEADER.title)}</text>
<text x="${centerX}" y="112" text-anchor="middle" font-size="22" font-weight="600" fill="#334" font-family="${FONT}" letter-spacing="8">${escapeXml(report.subtitle || DEFAULT_HEADER.subtitle)}</text>
<text x="${centerX}" y="146" text-anchor="middle" font-size="18" fill="#333" font-family="${FONT}">${escapeXml((report.company || "") + "　" + (report.roc_label || ""))}</text>
<text x="${W - MARGIN}" y="70" text-anchor="end" font-size="12" fill="#667" font-family="${FONT}">${escapeXml(report.address || "")}</text>
<text x="${W - MARGIN}" y="90" text-anchor="end" font-size="12" fill="#667" font-family="${FONT}">Tel：${escapeXml(report.tel || "")}</text>
<text x="${W - MARGIN}" y="110" text-anchor="end" font-size="12" fill="#667" font-family="${FONT}">Fax：${escapeXml(report.fax || "")}</text>
<line x1="${MARGIN}" y1="${headerH - 8}" x2="${W - MARGIN}" y2="${headerH - 8}" stroke="#1e7a5e" stroke-width="2"/>
${renderColumn(colL, MARGIN)}
${renderColumn(colR, MARGIN + colW + colGap)}
<text x="${centerX}" y="${H - 24}" text-anchor="middle" font-size="12" fill="#99a" font-family="${FONT}">松富物流 · 本報價單為 ${escapeXml(report.roc_label || report.ym || "")}　單位：新台幣元　「—」表該項本月不報價</text>
</svg>`;
    return svg;
}
exports.renderQuoteSvg = renderQuoteSvg;

function clip(s, n) {
    const t = String(s ?? "");
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/**
 * 月底提醒：判斷「是否該做下個月的報價單」。
 * 規則：本月剩餘天數 <= remindWithinDays（預設 7）時，若「下個月」的月報尚未存在或仍是草稿，就提醒。
 * todayYmd：YYYY-MM-DD（台北）。回傳 { show, targetYm, rocLabel, report(or null), daysLeft }。
 */
async function monthEndReminder(db, todayYmd, remindWithinDays) {
    const within = remindWithinDays || 7;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(todayYmd || "").trim());
    if (!m) return { show: false };
    const year = parseInt(m[1], 10), month = parseInt(m[2], 10), day = parseInt(m[3], 10);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const daysLeft = daysInMonth - day;
    const curYm = `${m[1]}-${m[2]}`;
    const targetYm = nextYm(curYm);
    const rocLabel = rocLabelFromYm(targetYm);
    const report = await getReportByYm(db, targetYm);
    const done = report && report.status === "finalized";
    const show = daysLeft <= within && !done;
    return { show, targetYm, rocLabel, report: report || null, daysLeft };
}
exports.monthEndReminder = monthEndReminder;

/** 回傳 JPG Buffer（伺服器端 SVG→sharp）。 */
async function renderQuoteImage(report, groups, opts) {
    const sharp = require("sharp");
    const svg = renderQuoteSvg(report, groups, opts || {});
    return await sharp(Buffer.from(svg, "utf-8")).jpeg({ quality: 92 }).toBuffer();
}
exports.renderQuoteImage = renderQuoteImage;
