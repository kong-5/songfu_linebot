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
