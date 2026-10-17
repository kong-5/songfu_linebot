"use strict";
/**
 * 北農行情「走勢看板」資料（2026-10-17）：給採購判斷「現在貴不貴、正在漲還是跌」。
 *
 * 口徑（與歷史查詢頁 loadWholesaleCropHistory 一致）：
 *   - 一個品名一天一個價＝台北一／台北二「中價」以交易量加權合併（量全缺才退回簡單平均）。
 *   - 視窗以「交易日」計（休市日不算），錨點＝看板的資料日期。
 *   - 30 日位置＝(今日−30日最低)/(30日最高−30日最低)，0%＝近 30 日最便宜、100%＝最貴。
 *   - 價位訊號（交易日 ≥ 10 才給）：位置 ≤20% 且低於 30 日均 10% 以上＝low（相對低檔）；
 *     位置 ≥80% 且高於 30 日均 10% 以上＝high（相對高檔）。兩段式避免價格平穩的品項亂跳標籤。
 *   - 趨勢：7 日均 vs 30 日均，偏離 ±8% 以上才算走升／走跌。
 *
 * 只做 SQL 端 GROUP BY（record_date, crop_name）＋少量 JS 統計；一天約 3~4 千列，
 * 30 交易日聚合後約 5 萬列，不逐列拉原始資料。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadWholesaleTrendBoard = loadWholesaleTrendBoard;
exports.summarizeCropSeries = summarizeCropSeries;
exports.loadSeasonalOutlook = loadSeasonalOutlook;
exports.parseKgPerUnit = parseKgPerUnit;
exports.suggestCrops = suggestCrops;
exports.backfillWholesaleDeep = backfillWholesaleDeep;

const wholesale_snapshot_js_1 = require("./wholesale-snapshot.js");

const SIGNAL_MIN_DAYS = 10;
const MIN_ROWS_PER_DAY = 20;

const round1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const pct = (cur, base) => (cur == null || base == null || !(base > 0) ? null : round1((cur - base) / base * 100));
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);

/**
 * 純函式：一個品項的每日合併中價序列（由舊到新，最後一筆＝錨點日）→ 看板統計。
 * @param {{date:string, mid:number|null, volume:number|null}[]} series
 * @param {string} anchorDate
 */
function summarizeCropSeries(series, anchorDate) {
    const pts = (series || []).filter((p) => p.mid != null && Number.isFinite(p.mid));
    const last = pts.length ? pts[pts.length - 1] : null;
    if (!last || last.date !== anchorDate) return null; // 錨點日沒交易就不上看板
    const prev = pts.length > 1 ? pts[pts.length - 2] : null;
    const w7 = pts.slice(-7).map((p) => p.mid);
    const w30 = pts.slice(-30).map((p) => p.mid);
    const vol7 = pts.slice(-8, -1).map((p) => p.volume).filter((v) => v != null && v > 0);
    const ma7 = mean(w7), avg30 = mean(w30);
    const min30 = Math.min(...w30), max30 = Math.max(...w30);
    const pos30 = max30 > min30 ? Math.round((last.mid - min30) / (max30 - min30) * 100) : null;
    const vsAvg30 = pct(last.mid, avg30);
    let signal = null;
    if (w30.length >= SIGNAL_MIN_DAYS && pos30 != null && vsAvg30 != null) {
        if (pos30 <= 20 && vsAvg30 <= -10) signal = "low";
        else if (pos30 >= 80 && vsAvg30 >= 10) signal = "high";
    }
    const trendPct = w30.length >= SIGNAL_MIN_DAYS ? pct(ma7, avg30) : null;
    const trend = trendPct == null ? null : (trendPct >= 8 ? "up" : (trendPct <= -8 ? "down" : "flat"));
    return {
        mid: round1(last.mid),
        prevMid: prev ? round1(prev.mid) : null,
        prevDate: prev ? prev.date : null,
        dayPct: prev ? pct(last.mid, prev.mid) : null,
        ma7: round1(ma7),
        avg30: round1(avg30),
        min30: round1(min30),
        max30: round1(max30),
        pos30,
        vsAvg30,
        days: w30.length,
        volume: last.volume != null ? Math.round(last.volume) : null,
        volPct: vol7.length >= 3 && last.volume != null ? pct(last.volume, mean(vol7)) : null,
        signal,
        trend,
        trendPct,
        spark: w30.map(round1),
    };
}

/**
 * @param db
 * @param {string} anchorDate YYYY-MM-DD（必須是有快照的日期）
 * @param {"veg"|"fruit"|"all"} cat  種類代碼 N05＝水果，其餘＝蔬菜（同行情表）
 * @returns {Promise<{dates:string[], items:object[], markets:string[], partial:boolean}>}
 *   items 依當日交易量大→小；partial＝當日只公布部分市場，整個視窗已改只用 markets
 */
async function loadWholesaleTrendBoard(db, anchorDate, cat = "veg") {
    // 休市日 API 常只回 1~2 筆零星資料，不算交易日（否則吃掉 30 日視窗、還會變成某品項的「前一日」）
    const dRows = await db.prepare(`SELECT record_date, COUNT(*) AS n FROM wholesale_market_snapshots
      WHERE record_date <= ? GROUP BY record_date ORDER BY record_date DESC LIMIT 60`).all(anchorDate);
    const dates = (dRows || []).filter((r) => r.record_date === anchorDate || Number(r.n) >= MIN_ROWS_PER_DAY)
        .slice(0, 30).map((r) => r.record_date).sort();
    if (!dates.length || dates[dates.length - 1] !== anchorDate) return { dates, items: [], markets: [], partial: false };
    // 當日只公布部分市場（常見：台北二先出、台北一晚到）→ 整個視窗只用當日有的市場，
    // 漲跌／量比才是同一基準（否則拿「只有台北二」比「台北一+二合併」，量會假性 −70%）。
    const mRows = await db.prepare(`SELECT market_name, COUNT(*) AS n FROM wholesale_market_snapshots
      WHERE record_date >= ? AND record_date <= ? GROUP BY market_name`).all(dates[0], anchorDate);
    const aRows = await db.prepare("SELECT market_name, COUNT(*) AS n FROM wholesale_market_snapshots WHERE record_date = ? GROUP BY market_name").all(anchorDate);
    const allMarkets = (mRows || []).filter((r) => Number(r.n) >= MIN_ROWS_PER_DAY).map((r) => r.market_name);
    const anchorMarkets = (aRows || []).filter((r) => Number(r.n) >= MIN_ROWS_PER_DAY).map((r) => r.market_name);
    const partial = anchorMarkets.length > 0 && allMarkets.some((m) => !anchorMarkets.includes(m));
    const mktSql = partial ? ` AND market_name IN (${anchorMarkets.map(() => "?").join(",")})` : "";
    const catSql = cat === "fruit" ? " AND COALESCE(category_code,'') = 'N05'" : (cat === "veg" ? " AND COALESCE(category_code,'') <> 'N05'" : "");
    const rows = await db.prepare(`SELECT record_date, crop_name, MAX(crop_code) AS crop_code,
        SUM(CASE WHEN mid_price IS NOT NULL AND volume IS NOT NULL THEN mid_price * volume ELSE 0 END) AS wsum,
        SUM(CASE WHEN mid_price IS NOT NULL AND volume IS NOT NULL THEN volume ELSE 0 END) AS wvol,
        AVG(mid_price) AS amid, SUM(volume) AS vol
      FROM wholesale_market_snapshots
      WHERE record_date >= ? AND record_date <= ?${catSql}${mktSql}
      GROUP BY record_date, crop_name`).all(dates[0], anchorDate, ...(partial ? anchorMarkets : []));
    const dateSet = new Set(dates);
    const byCrop = new Map();
    for (const r of rows || []) {
        const name = String(r.crop_name || "").trim();
        if (!name || !dateSet.has(r.record_date)) continue;
        const wvol = Number(r.wvol) || 0;
        const mid = wvol > 0 ? Number(r.wsum) / wvol : (r.amid != null ? Number(r.amid) : null);
        if (!byCrop.has(name)) byCrop.set(name, { code: "", pts: [] });
        const o = byCrop.get(name);
        if (r.crop_code && !o.code) o.code = String(r.crop_code);
        o.pts.push({ date: r.record_date, mid: Number.isFinite(mid) ? mid : null, volume: r.vol != null ? Number(r.vol) : null });
    }
    const items = [];
    for (const [name, o] of byCrop) {
        o.pts.sort((a, b) => (a.date < b.date ? -1 : 1));
        const s = summarizeCropSeries(o.pts, anchorDate);
        if (s) items.push({ name, code: o.code, ...s });
    }
    items.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    return { dates, items, markets: partial ? anchorMarkets : allMarkets, partial };
}

const DAY_MS = 86400000;
const isoAdd = (iso, days) => new Date(new Date(iso + "T00:00:00Z").getTime() + days * DAY_MS).toISOString().slice(0, 10);
/** 同月同日的 N 年前（2/29 → 3/1，交給 Date 處理） */
const isoYearsAgo = (iso, y) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCFullYear(d.getUTCFullYear() - y); return d.toISOString().slice(0, 10); };
const catWhere = (cat) => (cat === "fruit" ? " AND COALESCE(category_code,'') = 'N05'" : (cat === "veg" ? " AND COALESCE(category_code,'') <> 'N05'" : ""));

/** 某段期間每個品名的量加權中價（跨市場、跨日合併成一個數） */
async function windowMidByCrop(db, from, to, cat) {
    const rows = await db.prepare(`SELECT crop_name,
        SUM(CASE WHEN mid_price IS NOT NULL AND volume IS NOT NULL THEN mid_price * volume ELSE 0 END) AS wsum,
        SUM(CASE WHEN mid_price IS NOT NULL AND volume IS NOT NULL THEN volume ELSE 0 END) AS wvol,
        AVG(mid_price) AS amid
      FROM wholesale_market_snapshots WHERE record_date >= ? AND record_date <= ?${catWhere(cat)}
      GROUP BY crop_name`).all(from, to);
    const m = new Map();
    for (const r of rows || []) {
        const wvol = Number(r.wvol) || 0;
        const mid = wvol > 0 ? Number(r.wsum) / wvol : (r.amid != null ? Number(r.amid) : null);
        if (mid != null && Number.isFinite(mid) && mid > 0) m.set(String(r.crop_name || "").trim(), mid);
    }
    return m;
}

/**
 * 季節性展望：拿過去幾年「同一天」與「同一天＋aheadDays」各前後 3 天的均價比，
 * 回答「往年這時候，接下來幾週通常漲還是跌」。各年取平均；沒有歷史的年份不算。
 * @returns {Promise<Map<string, {lastYear:number|null, twoYearsAgo:number|null, nextPct:number|null, years:number, perYear:{y:number,pct:number}[]}>>}
 *   lastYear／twoYearsAgo＝去年／前年同一天前後 3 天的量加權中價（看板提示與面板數字卡共用這個值，不各算各的）
 */
async function loadSeasonalOutlook(db, anchorDate, cat = "veg", { years = [1, 2], aheadDays = 28 } = {}) {
    const out = new Map();
    for (const y of years) {
        const base = isoYearsAgo(anchorDate, y);
        const now = await windowMidByCrop(db, isoAdd(base, -3), isoAdd(base, 3), cat);
        if (!now.size) continue;
        const later = await windowMidByCrop(db, isoAdd(base, aheadDays - 3), isoAdd(base, aheadDays + 3), cat);
        for (const [name, v] of now) {
            if (!out.has(name)) out.set(name, { lastYear: null, twoYearsAgo: null, nextPct: null, years: 0, perYear: [] });
            const o = out.get(name);
            if (y === 1) o.lastYear = round1(v);
            if (y === 2) o.twoYearsAgo = round1(v);
            const l = later.get(name);
            if (l != null) o.perYear.push({ y, pct: round1((l - v) / v * 100) });
        }
    }
    for (const o of out.values()) {
        o.years = o.perYear.length;
        o.nextPct = o.years ? round1(mean(o.perYear.map((p) => p.pct))) : null;
    }
    return out;
}

/**
 * 從凌越規格／單位推「每單位幾公斤」：單位本身是公斤＝1；規格寫「18KG/箱」「600g」「10台斤」就換算。
 * 推不出來回 null（交給人填）。
 */
function parseKgPerUnit(spec, unit) {
    const u = String(unit || "").trim().toUpperCase();
    if (u === "KG" || u === "公斤") return 1;
    if (u === "台斤" || u === "斤") return 0.6;
    const sp = String(spec || "");
    let m = sp.match(/(\d+(?:\.\d+)?)\s*(?:KG|公斤)/i);
    if (m) return Number(m[1]);
    m = sp.match(/(\d+(?:\.\d+)?)\s*(?:台斤|斤)/);
    if (m) return Math.round(Number(m[1]) * 0.6 * 1000) / 1000;
    m = sp.match(/(\d+(?:\.\d+)?)\s*(?:G|克)(?![A-Z])/i);
    if (m) return Number(m[1]) / 1000;
    return null;
}

/**
 * 我們的品名 → 最像的北農品名（最多 3 個）。北農品名是「作物-品種」，比對作物部分：
 * 我們的品名含作物名（高麗菜 vs 甘藍 這種別名對不到，留給人工），長的作物名優先、同分看交易量。
 * @param {string} name 我們的品名
 * @param {{name:string, volume?:number}[]} crops
 */
// 我們常用叫法 → 北農作物名（只收兩邊叫法不同的；建議僅供參考，最後由人確認）
const CROP_ALIASES = {
    高麗菜: "甘藍", 青江菜: "青江白菜", 地瓜葉: "甘薯葉", 地瓜: "甘薯", 大陸妹: "萵苣菜", A菜: "萵苣菜", 油麥菜: "萵苣菜-油麥菜",
    紅蘿蔔: "胡蘿蔔", 小黃瓜: "胡瓜", 大黃瓜: "胡瓜", 空心菜: "蕹菜", 香菜: "芫荽", 青花菜: "青花苔", 綠花椰: "青花苔",
    白花椰: "花椰菜", 白蘿蔔: "蘿蔔", 蒜頭: "大蒜", 芥藍: "芥藍菜", 蔥: "青蔥", 豆芽: "豆芽菜", 皇宮菜: "落葵", 山蘇: "山蘇花",
    牛番茄: "番茄", 番茄: "番茄", 洋蔥: "洋蔥",
};
function suggestCrops(name, crops) {
    const raw = String(name || "").replace(/\s+/g, "");
    const n0 = raw.replace(/[（(][^）)]*[）)]/g, "");
    if (n0.length < 2 && !CROP_ALIASES[n0]) return [];
    // 括號內常是品種／產地（洋蔥(進口)），去括號後的全文也拿來比品種
    const variants = [{ n: n0, pen: 0 }, { n: raw.replace(/[（()）]/g, ""), pen: 0 }];
    // 別名只認「開頭」（避免 洋蔥 裡的「蔥」被當成 青蔥），且分數略低於字面相符
    for (const [k, v] of Object.entries(CROP_ALIASES)) if (n0.startsWith(k)) variants.push({ n: v + n0.slice(k.length), pen: 5 }, { n: v, pen: 5 });
    const best = new Map();
    for (const c of crops || []) {
        const full = String(c.name || "").replace(/\s+/g, "");
        const [base, variety] = full.split("-");
        if (!base || base.length < 2) continue;
        let score = 0;
        for (const { n, pen } of variants) {
            let sc = 0;
            if (n === full) sc = 100;
            else if (variety && n.includes(base) && n.includes(variety)) sc = 80 + base.length;
            else if (n === base) sc = 60;
            else if (n.includes(base)) sc = 40 + base.length;
            else if (base.includes(n) && n.length >= 2) sc = 30 + n.length;
            if (sc && sc - pen > score) score = sc - pen;
        }
        if (score) best.set(c.name, { name: c.name, score, volume: c.volume || 0 });
    }
    return [...best.values()].sort((a, b) => (b.score - a.score) || (b.volume - a.volume)).slice(0, 3).map((x) => x.name);
}

/**
 * 自動往回補歷史到 targetDays（預設兩年），每次只補 chunk 天、游標記在 app_settings，
 * 由每日排程順手呼叫，幾天內補齊、不會一次打爆農業部 API。
 * 整段都抓不到資料（API 掛了）就不推進游標，下次重試，避免留下一整段空洞。
 */
async function backfillWholesaleDeep(db, { targetDays = 730, chunk = 60, todayIso = null } = {}) {
    const KEY = "wholesale_deep_backfill_cursor";
    const today = todayIso || new Date().toISOString().slice(0, 10);
    const floor = isoAdd(today, -targetDays);
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(KEY);
    const cursor = row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.value || "")) ? String(row.value) : isoAdd(today, -29);
    if (cursor <= floor) return { done: true, cursor };
    const end = isoAdd(cursor, -1);
    const span = Math.round((new Date(end + "T00:00:00Z") - new Date(floor + "T00:00:00Z")) / DAY_MS) + 1;
    const days = Math.max(1, Math.min(chunk, span));
    const r = await (0, wholesale_snapshot_js_1.backfillWholesaleHistory)(db, days, end, true);
    const from = isoAdd(end, -(days - 1));
    const fetched = r.days + r.empties;
    if (fetched >= 20 && r.days === 0) return { done: false, cursor, error: "整段抓不到資料（農業部 API 可能異常），下次再試" };
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value").run(KEY, from);
    return { done: from <= floor, cursor: from, from, to: end, daysWithData: r.days, rows: r.total };
}
