"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchTaipeiWholesalePrices = fetchTaipeiWholesalePrices;
exports.matchCropPrice = matchCropPrice;
exports.filterWholesaleGreenVegetables = filterWholesaleGreenVegetables;
exports.getReferenceUnitPrice = getReferenceUnitPrice;

const MOA_API = "https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx";
/** 臺北農產運銷「單日交易行情查詢」官網（與本系統取用之開放資料為同一批發市場來源說明用） */
exports.TAPMC_PRICE_URL = "https://www.tapmc.com.tw/Pages/Trans/Price1";
/** 從農業部 API 列取出「作物種類／種類」等欄位（各版本欄位名可能略有差異） */
function extractCropCategory(row) {
    if (!row || typeof row !== "object")
        return "";
    return (row["作物種類"] ?? row["種類"] ?? row["作物類別"] ?? "").toString().trim();
}
/**
 * 僅保留「青菜」相關葉菜（作物種類含：青菜、葉菜、包葉等關鍵字）。
 * 若 API 未提供種類欄位，回傳全部資料並附帶 fallback 說明。
 */
function filterWholesaleGreenVegetables(prices) {
    if (!prices || prices.length === 0) {
        return { prices: [], hint: "", usedFallback: false };
    }
    const withCat = prices.filter((p) => (p.category || "").trim().length > 0);
    if (withCat.length === 0) {
        return { prices, hint: "（API 未提供作物種類欄位，已顯示全部作物。）", usedFallback: true };
    }
    const filtered = prices.filter((p) => {
        const c = (p.category || "").trim();
        if (c.includes("青菜"))
            return true;
        if (c.includes("葉菜")) return true;
        if (c.includes("包葉")) return true;
        return false;
    });
    if (filtered.length === 0) {
        return { prices, hint: "（本日無「青菜／葉菜／包葉」類別資料，已顯示全部作物供參考。）", usedFallback: true };
    }
    return { prices: filtered, hint: "", usedFallback: false };
}
/** 單價參考：優先中價，無則上價／下價／均價 */
function getReferenceUnitPrice(p) {
    if (!p)
        return null;
    const n = (x) => (x != null && Number.isFinite(Number(x)) ? Number(x) : null);
    return n(p.midPrice) ?? n(p.highPrice) ?? n(p.lowPrice) ?? n(p.avgPrice);
}

/**
 * 西元 YYYY-MM-DD 轉民國 YYY.MM.DD（農業部 API 格式）
 */
function toRepublicDate(isoDate) {
    if (!isoDate || typeof isoDate !== "string")
        return null;
    const m = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m)
        return null;
    const y = parseInt(m[1], 10);
    const republicYear = y - 1911;
    return `${republicYear}.${m[2]}.${m[3]}`;
}
exports.fromRepublicDate = fromRepublicDate;
/**
 * 民國 YYY.MM.DD（農業部 API 回傳格式）轉西元 YYYY-MM-DD。無法解析回 null。
 */
function fromRepublicDate(repDate) {
    if (repDate == null)
        return null;
    const m = String(repDate).trim().match(/^(\d{2,3})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
    if (!m)
        return null;
    const y = parseInt(m[1], 10) + 1911;
    const mo = String(parseInt(m[2], 10)).padStart(2, "0");
    const d = String(parseInt(m[3], 10)).padStart(2, "0");
    return `${y}-${mo}-${d}`;
}

exports.fetchTaipeiWholesalePricesDetailed = fetchTaipeiWholesalePricesDetailed;
/**
 * 取得台北果菜市場（台北一、台北二）當日批發行情。
 * 資料來自農業部農產品交易行情開放資料。
 * @returns { prices: [...], status, errors }
 *   status: 'ok'（兩市場至少一個有資料）/ 'network_error'（兩個都拿不到）/ 'empty'（API 回應正常但 0 筆）
 */
async function fetchTaipeiWholesalePricesDetailed(dateStr) {
    const repDate = toRepublicDate(dateStr);
    if (!repDate) {
        return { prices: [], status: "invalid_date", errors: [`無效日期：${dateStr}`] };
    }
    const markets = ["台北一", "台北二"];
    const all = [];
    const errors = [];
    let networkOk = false;
    // [fix 2026-07-08] 兩市場改「並行」抓＋逾時縮短 8 秒（原本序列 2×15s，API 慢時整頁卡到 30 秒像當機）。
    const TIMEOUT_MS = 8000;
    const fetchMarket = async (market) => {
        try {
            const url = `${MOA_API}?StartDate=${encodeURIComponent(repDate)}&EndDate=${encodeURIComponent(repDate)}&Market=${encodeURIComponent(market)}&$top=9999`;
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
            let resp;
            try {
                resp = await fetch(url, { signal: ctrl.signal });
            } finally {
                clearTimeout(timer);
            }
            if (!resp.ok) {
                errors.push(`${market}: HTTP ${resp.status}`);
                return;
            }
            networkOk = true;
            const data = await resp.json();
            if (!Array.isArray(data)) {
                errors.push(`${market}: 回應格式異常（非陣列）`);
                return;
            }
            for (const row of data) {
                all.push({
                    tradeDate: fromRepublicDate(row["交易日期"]) || dateStr,
                    cropCode: (row["作物代號"] ?? "").toString().trim(),
                    categoryCode: (row["種類代碼"] ?? "").toString().trim(),
                    cropName: (row["作物名稱"] ?? "").toString().trim(),
                    category: extractCropCategory(row),
                    avgPrice: row["平均價"] != null ? Number(row["平均價"]) : null,
                    highPrice: row["上價"] != null ? Number(row["上價"]) : null,
                    midPrice: row["中價"] != null ? Number(row["中價"]) : null,
                    lowPrice: row["下價"] != null ? Number(row["下價"]) : null,
                    volume: row["交易量"] != null ? Number(row["交易量"]) : null,
                    marketName: (row["市場名稱"] ?? "").toString().trim(),
                });
            }
        }
        catch (e) {
            const isTimeout = e?.name === "AbortError";
            errors.push(`${market}: ${isTimeout ? `連線逾時 ${TIMEOUT_MS / 1000}s` : (e?.message || String(e))}`);
        }
    };
    await Promise.all(markets.map(fetchMarket));
    let status;
    if (all.length > 0) status = "ok";
    else if (!networkOk) status = "network_error";
    else status = "empty";
    return { prices: all, status, errors };
}

/**
 * 舊版 API（保留向下相容）— 內部呼叫 detailed 版本。
 */
async function fetchTaipeiWholesalePrices(dateStr) {
    const r = await fetchTaipeiWholesalePricesDetailed(dateStr);
    return r.prices.length > 0 ? r.prices : null;
}

exports.fetchTaipeiWholesaleRange = fetchTaipeiWholesaleRange;
/**
 * 取一段日期區間（含頭尾）的台北一、台北二批發行情。農業部 API 一次就能回整個區間，
 * 用於歷史回補。回傳依 tradeDate 分組的 Map<isoDate, prices[]>。
 * @param {string} startIso YYYY-MM-DD
 * @param {string} endIso   YYYY-MM-DD
 */
async function fetchTaipeiWholesaleRange(startIso, endIso) {
    const repStart = toRepublicDate(startIso);
    const repEnd = toRepublicDate(endIso);
    const byDate = new Map();
    if (!repStart || !repEnd)
        return { byDate, status: "invalid_date", errors: [`無效日期：${startIso}~${endIso}`] };
    const markets = ["台北一", "台北二"];
    const errors = [];
    let networkOk = false;
    const TIMEOUT_MS = 30000; // 區間查詢資料量大，逾時放寬
    for (const market of markets) {
        try {
            const url = `${MOA_API}?StartDate=${encodeURIComponent(repStart)}&EndDate=${encodeURIComponent(repEnd)}&Market=${encodeURIComponent(market)}&$top=99999`;
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
            let resp;
            try {
                resp = await fetch(url, { signal: ctrl.signal });
            }
            finally {
                clearTimeout(timer);
            }
            if (!resp.ok) {
                errors.push(`${market}: HTTP ${resp.status}`);
                continue;
            }
            networkOk = true;
            const data = await resp.json();
            if (!Array.isArray(data)) {
                errors.push(`${market}: 回應格式異常`);
                continue;
            }
            for (const row of data) {
                const iso = fromRepublicDate(row["交易日期"]);
                if (!iso)
                    continue;
                if (!byDate.has(iso))
                    byDate.set(iso, []);
                byDate.get(iso).push({
                    tradeDate: iso,
                    cropCode: (row["作物代號"] ?? "").toString().trim(),
                    categoryCode: (row["種類代碼"] ?? "").toString().trim(),
                    cropName: (row["作物名稱"] ?? "").toString().trim(),
                    category: extractCropCategory(row),
                    avgPrice: row["平均價"] != null ? Number(row["平均價"]) : null,
                    highPrice: row["上價"] != null ? Number(row["上價"]) : null,
                    midPrice: row["中價"] != null ? Number(row["中價"]) : null,
                    lowPrice: row["下價"] != null ? Number(row["下價"]) : null,
                    volume: row["交易量"] != null ? Number(row["交易量"]) : null,
                    marketName: (row["市場名稱"] ?? "").toString().trim(),
                });
            }
        }
        catch (e) {
            const isTimeout = e?.name === "AbortError";
            errors.push(`${market}: ${isTimeout ? `逾時 ${TIMEOUT_MS / 1000}s` : (e?.message || String(e))}`);
        }
    }
    const status = byDate.size > 0 ? "ok" : (networkOk ? "empty" : "network_error");
    return { byDate, status, errors };
}

/**
 * 依品名從行情陣列中找出最相符的價格（作物名稱包含品名或品名包含作物名稱）。
 * 回傳 { avgPrice, highPrice, midPrice, lowPrice, cropName } 或 null
 */
function matchCropPrice(prices, itemName) {
    if (!prices || !Array.isArray(prices) || prices.length === 0 || !itemName || typeof itemName !== "string")
        return null;
    const name = itemName.trim().replace(/\s+/g, "");
    if (!name)
        return null;
    // 先完全一致
    let found = prices.find((p) => (p.cropName || "").replace(/\s+/g, "") === name);
    if (found) {
        const ref = getReferenceUnitPrice(found);
        return { ...found, referencePrice: ref };
    }
    // 作物名稱包含品名（例如 作物「甘藍-初秋」 品名「甘藍」）
    found = prices.find((p) => {
        const crop = (p.cropName || "").replace(/\s+/g, "");
        return crop.includes(name) || name.includes(crop);
    });
    if (found) {
        const ref = getReferenceUnitPrice(found);
        return { ...found, referencePrice: ref };
    }
    // 品名開頭與作物開頭相同（例如 大陸妹 vs 大陸妹-其他）
    const nameStart = name.slice(0, 2);
    found = prices.find((p) => (p.cropName || "").replace(/\s+/g, "").slice(0, 2) === nameStart);
    if (!found)
        return null;
    const ref = getReferenceUnitPrice(found);
    return { ...found, referencePrice: ref };
}
