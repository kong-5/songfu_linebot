"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveWholesaleMarketSnapshot = saveWholesaleMarketSnapshot;
exports.loadWholesaleMarketSnapshot = loadWholesaleMarketSnapshot;
exports.loadOrFetchWholesaleMarketPrices = loadOrFetchWholesaleMarketPrices;
exports.getLatestWholesaleSnapshotDate = getLatestWholesaleSnapshotDate;
exports.backfillWholesaleHistory = backfillWholesaleHistory;
exports.loadWholesaleCropHistory = loadWholesaleCropHistory;
exports.listWholesaleCrops = listWholesaleCrops;
const id_js_1 = require("./id.js");
const wholesale_price_js_1 = require("./wholesale-price.js");
async function saveWholesaleMarketSnapshot(db, recordDate, prices) {
    if (!recordDate || !prices || prices.length === 0)
        return;
    const now = new Date().toISOString();
    await db.prepare("DELETE FROM wholesale_market_snapshots WHERE record_date = ?").run(recordDate);
    for (const p of prices) {
        const id = (0, id_js_1.newId)("wms");
        await db.prepare(`INSERT INTO wholesale_market_snapshots (id, record_date, market_name, crop_name, category, crop_code, category_code, high_price, mid_price, low_price, avg_price, volume, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, recordDate, (p.marketName || "").trim(), (p.cropName || "").trim(), (p.category || "").trim() || null, (p.cropCode || "").trim() || null, (p.categoryCode || "").trim() || null, p.highPrice != null ? Number(p.highPrice) : null, p.midPrice != null ? Number(p.midPrice) : null, p.lowPrice != null ? Number(p.lowPrice) : null, p.avgPrice != null ? Number(p.avgPrice) : null, p.volume != null ? Number(p.volume) : null, now);
    }
}
async function loadWholesaleMarketSnapshot(db, recordDate) {
    const rows = await db.prepare(`SELECT market_name, crop_name, category, crop_code, category_code, high_price, mid_price, low_price, avg_price, volume
    FROM wholesale_market_snapshots WHERE record_date = ? ORDER BY crop_code, crop_name, market_name`).all(recordDate);
    if (!rows || rows.length === 0)
        return [];
    return rows.map((r) => ({
        marketName: r.market_name ?? "",
        cropName: r.crop_name ?? "",
        category: r.category ?? "",
        cropCode: r.crop_code ?? "",
        categoryCode: r.category_code ?? "",
        highPrice: r.high_price != null ? Number(r.high_price) : null,
        midPrice: r.mid_price != null ? Number(r.mid_price) : null,
        lowPrice: r.low_price != null ? Number(r.low_price) : null,
        avgPrice: r.avg_price != null ? Number(r.avg_price) : null,
        volume: r.volume != null ? Number(r.volume) : null,
    }));
}
/**
 * 優先向農業部 API 取當日全部行情（台北一/二，不篩品項，與官網一致）；
 * API 無資料時改讀本地快照。API 有資料就寫入本地每日快照供隔日查閱。
 *
 * status：
 *   'ok'            - 從 API 拿到資料
 *   'snapshot'      - API 失敗/空，改用本地快照
 *   'network_error' - API 連不上、本地也沒快照
 *   'empty'         - API 通了但 0 筆（休市／當日尚未更新）
 */
async function loadOrFetchWholesaleMarketPrices(db, dateStr) {
    const apiResult = await (0, wholesale_price_js_1.fetchTaipeiWholesalePricesDetailed)(dateStr);
    let raw = apiResult.prices;
    let source = "api";
    let detailedStatus = apiResult.status;
    let apiErrors = apiResult.errors;
    if (!raw || raw.length === 0) {
        raw = await loadWholesaleMarketSnapshot(db, dateStr);
        if (raw.length) {
            source = "snapshot";
            detailedStatus = "snapshot";
        }
        else {
            source = "empty";
        }
    }
    if (source === "api" && raw.length > 0) {
        await saveWholesaleMarketSnapshot(db, dateStr, raw);
    }
    return {
        prices: raw,
        hint: "",
        usedFallback: false,
        source,
        status: detailedStatus,
        apiErrors,
        rawCount: raw.length,
    };
}
/** 取快照中最新（最近）的一天日期；無資料回 null。 */
async function getLatestWholesaleSnapshotDate(db) {
    const r = await db.prepare("SELECT record_date FROM wholesale_market_snapshots ORDER BY record_date DESC LIMIT 1").get();
    return r?.record_date || null;
}
/**
 * 回補近 N 天的台北一/二批發行情。
 * 注意：農業部 API 的「日期區間」過濾不可靠（大區間回空、小區間只回最後 1~2 天），
 * 故改「逐日」以單日查詢抓取（單日查詢穩定），冪等覆蓋。已有快照的日子略過（避免重抓）。
 * @param {number} days   往回幾天
 * @param {string|null} endIso  結束日（含），預設今天
 * @param {boolean} skipExisting 已有快照的日子是否略過（預設 true）
 * @returns { days, total, empties, endIso, startIso }
 */
async function backfillWholesaleHistory(db, days = 30, endIso = null, skipExisting = true) {
    const end = endIso && /^\d{4}-\d{2}-\d{2}$/.test(endIso) ? endIso : new Date().toISOString().slice(0, 10);
    const endMs = new Date(end + "T00:00:00Z").getTime();
    const n = Math.max(1, Math.min(days, 400));
    let total = 0, daysWithData = 0, empties = 0;
    for (let k = 0; k < n; k++) {
        const iso = new Date(endMs - k * 86400000).toISOString().slice(0, 10);
        if (skipExisting) {
            const has = await db.prepare("SELECT 1 AS x FROM wholesale_market_snapshots WHERE record_date = ? LIMIT 1").get(iso);
            if (has) { continue; }
        }
        const r = await (0, wholesale_price_js_1.fetchTaipeiWholesalePricesDetailed)(iso);
        if (r.prices && r.prices.length) {
            await saveWholesaleMarketSnapshot(db, iso, r.prices);
            total += r.prices.length;
            daysWithData++;
        } else {
            empties++; // 休市／該日無資料
        }
    }
    const startIso = new Date(endMs - (n - 1) * 86400000).toISOString().slice(0, 10);
    return { days: daysWithData, total, empties, startIso, endIso: end };
}
/**
 * 查單一作物（依 crop_name 完全比對）每日行情，供歷史報表/折線圖。
 * 同日台北一/二以「交易量加權平均」合併（無量則簡單平均）。
 * @returns [{ date, high, mid, low, avg, volume }] 由舊到新
 */
async function loadWholesaleCropHistory(db, cropName, days = 90) {
    if (!cropName)
        return [];
    const rows = await db.prepare(`SELECT record_date, high_price, mid_price, low_price, avg_price, volume
    FROM wholesale_market_snapshots WHERE crop_name = ? ORDER BY record_date ASC`).all(cropName.trim());
    if (!rows || rows.length === 0)
        return [];
    const byDate = new Map();
    for (const r of rows) {
        const d = r.record_date;
        if (!byDate.has(d))
            byDate.set(d, []);
        byDate.get(d).push(r);
    }
    const out = [];
    for (const [date, list] of byDate.entries()) {
        const wsum = list.reduce((s, r) => s + (r.volume != null ? Number(r.volume) : 0), 0);
        const wavg = (field) => {
            const vals = list.filter((r) => r[field] != null);
            if (!vals.length)
                return null;
            if (wsum > 0)
                return vals.reduce((s, r) => s + Number(r[field]) * (r.volume != null ? Number(r.volume) : 0), 0) / wsum;
            return vals.reduce((s, r) => s + Number(r[field]), 0) / vals.length;
        };
        out.push({ date, high: wavg("high_price"), mid: wavg("mid_price"), low: wavg("low_price"), avg: wavg("avg_price"), volume: wsum || null });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : 1));
    return days > 0 ? out.slice(-days) : out;
}
/** 列出快照裡出現過的作物（品名 + 料號），供歷史報表下拉。依料號排序、去重。 */
async function listWholesaleCrops(db) {
    const rows = await db.prepare(`SELECT crop_name, MAX(crop_code) AS crop_code, MAX(record_date) AS last_date, COUNT(DISTINCT record_date) AS day_count
    FROM wholesale_market_snapshots GROUP BY crop_name ORDER BY MAX(crop_code), crop_name`).all();
    if (!rows || rows.length === 0)
        return [];
    return rows.map((r) => ({ cropName: r.crop_name ?? "", cropCode: r.crop_code ?? "", lastDate: r.last_date ?? "", dayCount: Number(r.day_count) || 0 }));
}
