"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchTaipeiWholesalePrices = fetchTaipeiWholesalePrices;
exports.matchCropPrice = matchCropPrice;

const MOA_API = "https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx";

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
    if (found)
        return { ...found };
    // 作物名稱包含品名（例如 作物「甘藍-初秋」 品名「甘藍」）
    found = prices.find((p) => {
        const crop = (p.cropName || "").replace(/\s+/g, "");
        return crop.includes(name) || name.includes(crop);
    });
    if (found)
        return { ...found };
    // 品名開頭與作物開頭相同（例如 大陸妹 vs 大陸妹-其他）
    const nameStart = name.slice(0, 2);
    found = prices.find((p) => (p.cropName || "").replace(/\s+/g, "").slice(0, 2) === nameStart);
    return found ? { ...found } : null;
}
