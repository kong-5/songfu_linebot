"use strict";
/**
 * 未來銷貨加回（「應有實體量」）的單一權威。
 *
 * 問題：使用者今天就把「明天以後」的銷貨單打進凌越，凌越**立刻**扣 SK_NOWQTY，但貨還在架上
 *       → 系統量 < 實體量 → 盤點一定「盤盈」。這不是盤差，是口徑不同：
 *       凌越欄位＝**帳面可售量**，盤點量的是**架上實體量**。
 * 口徑：應有實體量 = 凌越量(sys) + 未來銷貨淨量(future) [+ 人工調整 adj]
 *       盤差 = 實盤 − 應有實體量
 *
 * 兩個必守的規則（不守就會製造新問題）：
 * 1. **凍結**：未來單會隨日期滾動消失，`erp_future_sales` 只有「現在」一份（按公司覆蓋）。
 *    盤點列一律用送出當下凍結的 `stocktake_count.future_qty`；過去日期的「最新/當日系統」側
 *    改讀每日快照 `erp_future_daily`。查不到歷史快照＝不加回（stale），寧可不修正也不誤導。
 * 2. **分倉分攤**：未來銷貨是公司層級彙總（凌越明細沒帶出庫倉），盤點卻是分倉的。
 *    直接把全公司未來量加到每個倉會**重複加回**。規則：
 *      - 該倉的系統基準是「公司總量」（此倉無分倉資料）→ 未來量也用公司總量（口徑一致）。
 *      - 該倉的系統基準是「分倉量」→ 只加到該料號的**主倉**（分倉量最大的那一倉），其餘倉 0。
 *    這樣逐倉相加剛好等於公司未來量一次，統計端跨倉加總也不會雙倍。
 */
const { normIcpno } = require("./erp-companies.js");

const FUT_ICP = "COALESCE(NULLIF(TRIM(icpno),''),'00')";

/** 台北時區日期（YYYY-MM-DD） */
function futTaipeiDate(at) {
    const d = at instanceof Date ? at : new Date();
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d); }
    catch (_) { return d.toISOString().slice(0, 10); }
}

/** 「未來銷貨加回」總開關（目前庫存頁／每日盤點頁共用 app_settings.stock_future_reversal_enabled） */
async function futureReversalEnabled(db) {
    try {
        const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("stock_future_reversal_enabled");
        return !!(r && String(r.value) === "1");
    }
    catch (_) { return false; }
}

/**
 * 未來銷貨基準 resolver（用法比照 admin/inventory.js 的 makeStockBasisResolver）：
 *   const futureFor = makeFutureResolver(db, date);
 *   const fut = await futureFor(icpno, whCode);
 *   fut.get(erpCode) → 該倉該料號要加回的未來銷貨淨量（已分攤，正＝已扣帳但貨還在）
 *   fut.company(erpCode) → 未分攤的公司層級淨量（顯示提示用）
 *   fut.asOf/frozen/stale → 資料時點與是否為凍結快照（過去日期查無快照＝stale，一律回 0）
 * date 空或等於今天＝即時（erp_future_sales）；過去日期＝該日（或之前最近一次）收盤快照。
 */
function makeFutureResolver(db, date) {
    const d = String(date || "");
    const wantFrozen = /^\d{4}-\d{2}-\d{2}$/.test(d) && d < futTaipeiDate();
    const futCache = {};  // icpno → {map, asOf, frozen, stale}
    const whCache = {};   // icpno → {whSet, main}
    const resCache = {};  // icpno|倉號 → basis

    const loadFuture = async (icp) => {
        if (Object.prototype.hasOwnProperty.call(futCache, icp)) return futCache[icp];
        let out = { map: {}, asOf: null, frozen: false, stale: false };
        if (wantFrozen) {
            try {
                const hit = await db.prepare(`SELECT MAX(snap_date) AS d FROM erp_future_daily WHERE ${FUT_ICP} = ? AND snap_date <= ?`).get(icp, d);
                const snap = hit && hit.d ? String(hit.d) : "";
                if (snap) {
                    const rows = (await db.prepare(`SELECT erp_code, qty FROM erp_future_daily WHERE ${FUT_ICP} = ? AND snap_date = ?`).all(icp, snap)) || [];
                    const m = {};
                    for (const r of rows) m[String(r.erp_code || "")] = Number(r.qty || 0);
                    out = { map: m, asOf: snap, frozen: true, stale: false };
                }
                else {
                    // 該日（含之前）沒有未來銷貨快照＝功能上線前／保留期外 → 不加回（不拿今天的未來單貼歷史）
                    out = { map: {}, asOf: null, frozen: true, stale: true };
                }
            }
            catch (_) { out = { map: {}, asOf: null, frozen: true, stale: true }; }
        }
        else {
            try {
                const rows = (await db.prepare(`SELECT erp_code, qty FROM erp_future_sales WHERE ${FUT_ICP} = ?`).all(icp)) || [];
                const m = {};
                for (const r of rows) m[String(r.erp_code || "")] = Number(r.qty || 0);
                out = { map: m, asOf: null, frozen: false, stale: false };
            }
            catch (_) { out = { map: {}, asOf: null, frozen: false, stale: false }; }
        }
        futCache[icp] = out;
        return out;
    };

    // 主倉判定：同一料號分倉量最大（且 > 0）的那一倉；whSet＝有分倉資料的倉（決定該倉用哪種基準）
    const loadWh = async (icp) => {
        if (Object.prototype.hasOwnProperty.call(whCache, icp)) return whCache[icp];
        let rows = [];
        try {
            if (wantFrozen) {
                const hit = await db.prepare(`SELECT MAX(snap_date) AS d FROM erp_stock_wh_daily WHERE ${FUT_ICP} = ? AND snap_date <= ?`).get(icp, d);
                const snap = hit && hit.d ? String(hit.d) : "";
                rows = snap ? ((await db.prepare(`SELECT erp_code, wh_code, qty FROM erp_stock_wh_daily WHERE ${FUT_ICP} = ? AND snap_date = ?`).all(icp, snap)) || []) : [];
            }
            else {
                rows = (await db.prepare(`SELECT erp_code, wh_code, qty FROM erp_stock_wh_qty WHERE ${FUT_ICP} = ?`).all(icp)) || [];
            }
        }
        catch (_) { rows = []; /* 無分倉資料 → 全部走公司總量口徑 */ }
        const whSet = new Set();
        const best = {}; // code → {wh, qty}
        for (const r of rows) {
            const wc = String(r.wh_code || "");
            const code = String(r.erp_code || "");
            const q = Number(r.qty || 0);
            if (wc) whSet.add(wc);
            if (!code || !wc) continue;
            const cur = best[code];
            // [fix] 比大小**不排除 0/負庫存**：實務上一個料號通常只放一倉，那一倉當下是 0 或負的
            // （賣很兇、又先開了未來單——最需要加回的那種）也必須認得出主倉，否則整包未來量被丟掉。
            // 同量時取倉號較小者，讓結果穩定（不隨查詢順序跳動）。
            if (!cur || q > cur.qty || (q === cur.qty && wc < cur.wh)) best[code] = { wh: wc, qty: q };
        }
        const main = {};
        for (const [code, v] of Object.entries(best)) main[code] = v.wh;
        const out = { whSet, main };
        whCache[icp] = out;
        return out;
    };

    return async function futureFor(icpRaw, whRaw) {
        const icp = normIcpno(icpRaw);
        const wh = String(whRaw || "");
        const ck = icp + "|" + wh;
        if (resCache[ck]) return resCache[ck];
        const f = await loadFuture(icp);
        const w = await loadWh(icp);
        const whMode = !!(wh && w.whSet.has(wh)); // 該倉有分倉資料＝系統基準走分倉 → 未來量也要分攤
        const basis = {
            asOf: f.asOf, frozen: f.frozen, stale: f.stale, mode: whMode ? "warehouse" : "total",
            company: (code) => Number(f.map[String(code)] || 0),
            get: (code) => {
                const q = Number(f.map[String(code)] || 0);
                if (!q) return 0;
                if (!whMode) return q;                       // 公司總量基準 → 未來量也用公司層級
                return w.main[String(code)] === wh ? q : 0;  // 分倉基準 → 只算主倉，其餘 0（不重複加回）
            },
        };
        resCache[ck] = basis;
        return basis;
    };
}

module.exports = { futureReversalEnabled, makeFutureResolver, futTaipeiDate };
