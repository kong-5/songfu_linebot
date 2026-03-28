"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveWholesaleMarketSnapshot = saveWholesaleMarketSnapshot;
exports.loadWholesaleMarketSnapshot = loadWholesaleMarketSnapshot;
exports.loadOrFetchWholesaleMarketPrices = loadOrFetchWholesaleMarketPrices;
const id_js_1 = require("./id.js");
const wholesale_price_js_1 = require("./wholesale-price.js");
async function saveWholesaleMarketSnapshot(db, recordDate, prices) {
    if (!recordDate || !prices || prices.length === 0)
        return;
    const now = new Date().toISOString();
    await db.prepare("DELETE FROM wholesale_market_snapshots WHERE record_date = ?").run(recordDate);
    for (const p of prices) {
        const id = (0, id_js_1.newId)("wms");
        await db.prepare(`INSERT INTO wholesale_market_snapshots (id, record_date, market_name, crop_name, category, high_price, mid_price, low_price, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, recordDate, (p.marketName || "").trim(), (p.cropName || "").trim(), (p.category || "").trim() || null, p.highPrice != null ? Number(p.highPrice) : null, p.midPrice != null ? Number(p.midPrice) : null, p.lowPrice != null ? Number(p.lowPrice) : null, now);
    }
}
async function loadWholesaleMarketSnapshot(db, recordDate) {
    const rows = await db.prepare(`SELECT market_name, crop_name, category, high_price, mid_price, low_price
    FROM wholesale_market_snapshots WHERE record_date = ? ORDER BY market_name, crop_name`).all(recordDate);
    if (!rows || rows.length === 0)
        return [];
    return rows.map((r) => ({
        marketName: r.market_name ?? "",
        cropName: r.crop_name ?? "",
        category: r.category ?? "",
        highPrice: r.high_price != null ? Number(r.high_price) : null,
        midPrice: r.mid_price != null ? Number(r.mid_price) : null,
        lowPrice: r.low_price != null ? Number(r.low_price) : null,
        avgPrice: null,
    }));
}
/**
 * 優先向農業部 API 取價；無資料時改讀本地快照。僅顯示「青菜／葉菜」篩選後結果，並寫入快照供隔日查閱。
 */
async function loadOrFetchWholesaleMarketPrices(db, dateStr) {
    let raw = await (0, wholesale_price_js_1.fetchTaipeiWholesalePrices)(dateStr);
    let source = "api";
    if (!raw || raw.length === 0) {
        raw = await loadWholesaleMarketSnapshot(db, dateStr);
        source = raw.length ? "snapshot" : "empty";
    }
    const filt = (0, wholesale_price_js_1.filterWholesaleGreenVegetables)(raw);
    if (source === "api" && filt.prices.length > 0) {
        await saveWholesaleMarketSnapshot(db, dateStr, filt.prices);
    }
    return {
        prices: filt.prices,
        hint: filt.hint,
        usedFallback: filt.usedFallback,
        source,
    };
}
