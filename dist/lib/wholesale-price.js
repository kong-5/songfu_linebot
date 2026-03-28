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

/**
 * 取得台北果菜市場（台北一、台北二）當日批發行情。
 * 資料來自農業部農產品交易行情開放資料（與臺北農產官網
 * https://www.tapmc.com.tw/Pages/Trans/Price1 所呈現之「場內拍賣／全場交易」為同一批發市場之統計基礎；官網另有下載 Excel／PDF 與註記說明）。
 * @param dateStr - 西元日期 YYYY-MM-DD
 * @returns { cropName, avgPrice, highPrice, midPrice, lowPrice, marketName }[] 或 null
 */
async function fetchTaipeiWholesalePrices(dateStr) {
    const repDate = toRepublicDate(dateStr);
    if (!repDate) {
        console.warn("[wholesale-price] 無效日期:", dateStr);
        return null;
    }
    const markets = ["台北一", "台北二"];
    const all = [];
    for (const market of markets) {
        try {
            const url = `${MOA_API}?StartDate=${encodeURIComponent(repDate)}&EndDate=${encodeURIComponent(repDate)}&Market=${encodeURIComponent(market)}&$top=9999`;
            const resp = await fetch(url);
            if (!resp.ok)
                continue;
            const data = await resp.json();
            if (!Array.isArray(data))
                continue;
            for (const row of data) {
                all.push({
                    cropName: (row["作物名稱"] ?? "").toString().trim(),
                    category: extractCropCategory(row),
                    avgPrice: row["平均價"] != null ? Number(row["平均價"]) : null,
                    highPrice: row["上價"] != null ? Number(row["上價"]) : null,
                    midPrice: row["中價"] != null ? Number(row["中價"]) : null,
                    lowPrice: row["下價"] != null ? Number(row["下價"]) : null,
                    marketName: (row["市場名稱"] ?? "").toString().trim(),
                });
            }
        }
        catch (e) {
            console.warn("[wholesale-price] 取得市場", market, "失敗:", e?.message || e);
        }
    }
    return all.length > 0 ? all : null;
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
