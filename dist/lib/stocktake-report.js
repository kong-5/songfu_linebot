"use strict";
/**
 * 盤點結果報表（單一倉別／單日）的資料層：給結果圖用。
 *
 * 口徑刻意用「盤點送出當下」的凍結值，與每日盤點頁**左半邊**（盤點當下欄）、統計圖表同一套：
 *   系統 sys ＝ stocktake_count.sys_qty（送出當下寫入，不回溯）
 *   未來 fut ＝ stocktake_count.future_qty（送出當下凍結；NULL＝功能上線前送出 → 用 resolver 推估並標 futEst）
 *   應有 should ＝ sys + fut　　盤差 diff ＝ counted − should
 * **不用**「最新系統／對最新盤差」——那一欄會隨凌越庫存變動，圖是當下的憑證，隔天重下載數字不該變。
 *
 * 唯一會變的是複盤：有人到後台改了實盤數，重新產圖會反映新的 counted（這是要的，圖要跟帳一致）。
 */
Object.defineProperty(exports, "__esModule", { value: true });

const { normIcpno, erpCompanyName } = require("./erp-companies.js");
const { futureReversalEnabled, makeFutureResolver } = require("./stock-future.js");
const { loadHotRule, isHotDiff, hotRuleText } = require("./stocktake-hot-rule.js");

const ICP_SQL = "COALESCE(NULLIF(TRIM(icpno),''),'00')";
const IDLE_DAYS_DEFAULT = 60;

/**
 * 「長期無貨」判定：帳 0、現場也 0（或沒盤），而且近 N 天的每日庫存快照裡從沒出現過量。
 * 這種品項每個倉都有幾十個（凌越主檔留著但早就不進了），列進結果圖只會把圖拉長、
 * 把真正要看的盤差埋掉 → 結果圖整段不列，只在頁尾記「另有 N 項長期無貨未列」。
 *
 * 保守原則：查不到任何快照（功能上線前／保留期外／查詢失敗）一律**不判定 idle**，
 * 寧可圖長一點也不要默默吃掉品項。
 * 天數可用 app_settings.stocktake_report_idle_days 覆寫，設 0＝關閉此過濾。
 */
async function loadIdleCodes(db, icp, date, codes) {
    let days = IDLE_DAYS_DEFAULT;
    try {
        const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("stocktake_report_idle_days");
        const v = r && r.value != null && String(r.value).trim() !== "" ? Number(r.value) : NaN;
        if (Number.isFinite(v) && v >= 0) days = v;
    }
    catch (_) { /* 沒設定就用預設 */ }
    if (!days) return new Set();
    const from = new Date(new Date(date + "T12:00:00+08:00").getTime() - days * 86400000).toISOString().slice(0, 10);
    let rows = [];
    try {
        rows = (await db.prepare(
            `SELECT erp_code, MAX(ABS(qty)) AS mx FROM erp_stock_daily WHERE ${ICP_SQL} = ? AND snap_date >= ? AND snap_date <= ? GROUP BY erp_code`
        ).all(icp, from, date)) || [];
    }
    catch (_) { return new Set(); }
    if (!rows.length) return new Set();   // 沒有任何快照＝無從判定，全部照列
    const idle = new Set();
    const seen = new Set();
    for (const r of rows) {
        seen.add(String(r.erp_code || ""));
        if (Number(r.mx || 0) === 0) idle.add(String(r.erp_code || ""));
    }
    // 快照期間內完全沒出現過的料號：也算長期無貨（凌越推送本來就只推有效品項）
    for (const c of codes) if (!seen.has(c)) idle.add(c);
    return idle;
}

function twTime(iso) {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleString("zh-TW", {
            timeZone: "Asia/Taipei", hour12: false,
            year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
        });
    }
    catch (_) { return String(iso); }
}

/**
 * @returns null（當日該倉沒有盤點紀錄）或報表資料物件（可直接餵給 stocktake-report-image.js）
 */
async function loadStocktakeReport(db, { icpno, whCode, date }) {
    const icp = normIcpno(icpno);
    const wh = String(whCode || "").trim();
    const d = String(date || "").trim();
    if (!wh || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;

    // icpno 欄位是後來加的（多公司），舊資料為 NULL＝'00'
    const s = await db.prepare(
        "SELECT * FROM stocktake_session WHERE count_date = ? AND wh_code = ? AND COALESCE(NULLIF(icpno, ''), '00') = ?"
    ).get(d, wh, icp);
    if (!s) return null;

    const futOn = await futureReversalEnabled(db);
    const hotRule = await loadHotRule(db);
    // 未來銷貨推估（只有沒凍結值的舊列才會用到）：分倉優先、過去日期讀當日快照，同每日盤點頁
    const futBasis = await makeFutureResolver(db, d)(icp, wh);

    const rows = (await db.prepare(
        "SELECT erp_code, name, spec, unit, sys_qty, counted_qty, mid_qty, future_qty, expiry_json FROM stocktake_count WHERE session_id = ? ORDER BY erp_code"
    ).all(s.id)) || [];

    const idleSet = await loadIdleCodes(db, icp, d, rows.map((r) => String(r.erp_code || "")));

    const items = rows.map((r) => {
        const code = String(r.erp_code || "");
        const sys = Number(r.sys_qty || 0);
        const counted = (r.counted_qty == null || r.counted_qty === "") ? null : Number(r.counted_qty);
        const mid = (r.mid_qty == null || r.mid_qty === "") ? null : Number(r.mid_qty);
        // NULL ≠ 0：NULL＝功能上線前送出、當時沒記錄 → 退回推估並標 futEst（同每日盤點頁）
        const futFrozen = r.future_qty != null && r.future_qty !== "";
        const fut = !futOn ? 0 : Math.round((futFrozen ? Number(r.future_qty || 0) : futBasis.get(code)) * 100) / 100;
        const should = Math.round((sys + fut) * 100) / 100;
        const diff = counted == null ? null : Math.round((counted - should) * 100) / 100;
        let expiry = [];
        try { expiry = JSON.parse(r.expiry_json || "[]") || []; } catch (_) { expiry = []; }
        // idle＝長期無貨（見 loadIdleCodes）：帳 0、現場也 0/沒盤，才可以不列進結果圖。
        // 只要今天有量或有人盤到數字，一律照列——不能因為「快照都是 0」就把真的盤盈藏起來。
        const idle = idleSet.has(code) && sys === 0 && (counted == null || counted === 0);
        return {
            code, name: String(r.name || ""), spec: String(r.spec || ""), unit: String(r.unit || ""),
            sys, fut, futEst: futOn && !futFrozen && fut !== 0, should, counted, mid, diff,
            hot: isHotDiff(hotRule, diff, futOn ? should : sys), expiry, idle,
        };
    });

    return {
        date: d,
        icpno: icp,
        companyName: erpCompanyName(icp),
        whCode: wh,
        whName: String(s.wh_name || ""),
        countedBy: String(s.created_by_name || ""),
        submittedAt: twTime(s.submitted_at || s.created_at),
        futOn,
        hotRule,
        hotRuleText: hotRuleText(hotRule),
        items,
    };
}

module.exports = { loadStocktakeReport, twTime };
