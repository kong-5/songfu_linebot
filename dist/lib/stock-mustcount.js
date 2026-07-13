"use strict";
/**
 * 盤點「必盤」判定：找出自從昨天（或上次盤點）以來凌越庫存有變動的品項。
 * 混合基準（C）：優先跟「昨天的每日快照 erp_stock_daily」比；若還沒有昨天快照，
 * 退回跟「上次盤這倉時凍結的系統值 stocktake_count.sys_qty」比。|變動量| ≥ 門檻才算必盤。
 * 門檻預設 1（濾掉像 0.2 的雜訊），可用 app_settings key `stocktake_mustcount_min_delta` 覆寫。
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
    try {
        // 目前（最新推送）該倉各料號總量
        const cur = {};
        (await db.prepare("SELECT erp_code, qty FROM erp_stock_items WHERE wh_code = ? AND " + norm + " = ?").all(whCode, icpno) || [])
            .forEach((r) => { cur[String(r.erp_code)] = Number(r.qty || 0); });
        // 昨天（或最近一個「今天以前」）的每日快照
        let ymap = null;
        const prev = await db.prepare("SELECT MAX(snap_date) AS d FROM erp_stock_daily WHERE " + norm + " = ? AND snap_date < ?").get(icpno, today);
        if (prev && prev.d) {
            ymap = {};
            (await db.prepare("SELECT erp_code, qty FROM erp_stock_daily WHERE " + norm + " = ? AND snap_date = ?").all(icpno, String(prev.d)) || [])
                .forEach((r) => { ymap[String(r.erp_code)] = Number(r.qty || 0); });
        }
        // 退回基準：上次盤這倉時凍結的系統值
        let lmap = null;
        const lastSess = await db.prepare("SELECT id FROM stocktake_session WHERE wh_code = ? AND " + norm + " = ? AND count_date < ? ORDER BY count_date DESC, submitted_at DESC LIMIT 1").get(whCode, icpno, today);
        if (lastSess && lastSess.id) {
            lmap = {};
            (await db.prepare("SELECT erp_code, sys_qty FROM stocktake_count WHERE session_id = ?").all(lastSess.id) || [])
                .forEach((r) => { if (r.sys_qty != null) lmap[String(r.erp_code)] = Number(r.sys_qty || 0); });
        }
        Object.keys(cur).forEach((code) => {
            let base = null, src = null;
            if (ymap && Object.prototype.hasOwnProperty.call(ymap, code)) { base = ymap[code]; src = "yesterday"; }
            else if (lmap && Object.prototype.hasOwnProperty.call(lmap, code)) { base = lmap[code]; src = "lastcount"; }
            if (base == null) return;
            if (Math.abs(cur[code] - base) >= threshold) { out.set.add(code); out.base[code] = base; out.src[code] = src; }
        });
    } catch (_) { /* 必盤判定失敗不擋盤點 */ }
    return out;
}
