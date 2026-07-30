"use strict";
/**
 * 盤點「必盤」判定：找出自從昨天（或上次盤點）以來凌越庫存有變動的品項。
 * 混合基準（C）：優先跟「昨天的每日快照 erp_stock_daily」比；若還沒有昨天快照，
 * 退回跟「上次盤這倉時凍結的系統值 stocktake_count.sys_qty」比。|變動量| ≥ 門檻才算必盤。
 * 門檻預設 1（濾掉像 0.2 的雜訊），可用 app_settings key `stocktake_mustcount_min_delta` 覆寫。
 *
 * [未來銷貨加回 2026-07-30] 開關開時，兩邊都改比「應有實體量＝庫存＋未來銷貨淨量」：
 * 只是「今天多打了一張明天的銷貨單」不代表架上東西動過，拿原始凌越量比會把整批品項誤標必盤。
 */
Object.defineProperty(exports, "__esModule", { value: true });
const stock_future_js_1 = require("./stock-future.js");
exports.tpeDate = tpeDate;
exports.computeMustCount = computeMustCount;
exports.DEFAULT_MUSTCOUNT_DELTA = 1;

function tpeDate(offsetDays) {
    const ms = Date.now() + (Number(offsetDays) || 0) * 86400000;
    try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
    } catch (_) { return new Date(ms).toISOString().slice(0, 10); }
}

/**
 * @returns {Promise<{set:Set<string>, base:Object, src:Object}>}
 *   set = 必盤料號集合；base/src = 每個料號的比較基準值與來源('yesterday'|'lastcount')供 tooltip。
 */
async function computeMustCount(db, opts) {
    const o = opts || {};
    const icpno = String(o.icpno || "00");
    const whCode = String(o.whCode || "");
    const today = o.today || tpeDate(0);
    const norm = "COALESCE(NULLIF(TRIM(icpno),''),'00')";
    const out = { set: new Set(), base: {}, src: {} };
    if (!whCode) return out;
    let threshold = Number(o.threshold);
    try {
        if (!Number.isFinite(threshold) || threshold < 0) {
            const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("stocktake_mustcount_min_delta");
            const t = r && r.value != null ? Number(r.value) : NaN;
            threshold = (Number.isFinite(t) && t >= 0) ? t : exports.DEFAULT_MUSTCOUNT_DELTA;
        }
    } catch (_) { threshold = exports.DEFAULT_MUSTCOUNT_DELTA; }
    // 未來銷貨加回（開關開才算）：cur 是公司總量口徑（erp_stock_items.qty＝SK_NOWQTY），
    // 所以這裡一律用公司層級淨量，不做分倉分攤。
    let futOn = false, futNow = null;
    try {
        futOn = await (0, stock_future_js_1.futureReversalEnabled)(db);
        if (futOn) {
            futNow = {};
            (await db.prepare("SELECT erp_code, qty FROM erp_future_sales WHERE " + norm + " = ?").all(icpno) || [])
                .forEach((r) => { futNow[String(r.erp_code)] = Number(r.qty || 0); });
        }
    } catch (_) { futOn = false; futNow = null; /* 未來銷貨查詢失敗＝維持原本口徑 */ }
    const futOf = (m, code) => (m ? Number(m[String(code)] || 0) : 0);
    try {
        // 目前（最新推送）該倉各料號總量
        const cur = {};
        (await db.prepare("SELECT erp_code, qty FROM erp_stock_items WHERE wh_code = ? AND " + norm + " = ?").all(whCode, icpno) || [])
            .forEach((r) => { cur[String(r.erp_code)] = Number(r.qty || 0); });
        // 昨天（或最近一個「今天以前」）的每日快照（含當日的未來銷貨快照，兩邊同口徑才比得準）
        let ymap = null;
        const prev = await db.prepare("SELECT MAX(snap_date) AS d FROM erp_stock_daily WHERE " + norm + " = ? AND snap_date < ?").get(icpno, today);
        if (prev && prev.d) {
            ymap = {};
            (await db.prepare("SELECT erp_code, qty FROM erp_stock_daily WHERE " + norm + " = ? AND snap_date = ?").all(icpno, String(prev.d)) || [])
                .forEach((r) => { ymap[String(r.erp_code)] = Number(r.qty || 0); });
            if (futOn) {
                try {
                    const fh = await db.prepare("SELECT MAX(snap_date) AS d FROM erp_future_daily WHERE " + norm + " = ? AND snap_date <= ?").get(icpno, String(prev.d));
                    if (fh && fh.d) {
                        (await db.prepare("SELECT erp_code, qty FROM erp_future_daily WHERE " + norm + " = ? AND snap_date = ?").all(icpno, String(fh.d)) || [])
                            .forEach((r) => { const c = String(r.erp_code); if (Object.prototype.hasOwnProperty.call(ymap, c)) ymap[c] += Number(r.qty || 0); });
                    }
                } catch (_) { /* 無未來快照＝當天視為 0，維持原值 */ }
            }
        }
        // 退回基準：上次盤這倉時凍結的系統值（＋當時凍結的未來量）
        let lmap = null;
        const lastSess = await db.prepare("SELECT id FROM stocktake_session WHERE wh_code = ? AND " + norm + " = ? AND count_date < ? ORDER BY count_date DESC, submitted_at DESC LIMIT 1").get(whCode, icpno, today);
        if (lastSess && lastSess.id) {
            lmap = {};
            (await db.prepare("SELECT erp_code, sys_qty, future_qty FROM stocktake_count WHERE session_id = ?").all(lastSess.id) || [])
                .forEach((r) => { if (r.sys_qty != null) lmap[String(r.erp_code)] = Number(r.sys_qty || 0) + (futOn ? Number(r.future_qty || 0) : 0); });
        }
        Object.keys(cur).forEach((code) => {
            let base = null, src = null;
            if (ymap && Object.prototype.hasOwnProperty.call(ymap, code)) { base = ymap[code]; src = "yesterday"; }
            else if (lmap && Object.prototype.hasOwnProperty.call(lmap, code)) { base = lmap[code]; src = "lastcount"; }
            if (base == null) return;
            const now = cur[code] + futOf(futNow, code); // 應有實體量口徑（開關關＝原始凌越量）
            if (Math.abs(now - base) >= threshold) { out.set.add(code); out.base[code] = base; out.src[code] = src; }
        });
    } catch (_) { /* 必盤判定失敗不擋盤點 */ }
    return out;
}
