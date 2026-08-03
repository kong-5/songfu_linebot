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
        return {
            code, name: String(r.name || ""), spec: String(r.spec || ""), unit: String(r.unit || ""),
            sys, fut, futEst: futOn && !futFrozen && fut !== 0, should, counted, mid, diff,
            hot: isHotDiff(hotRule, diff, futOn ? should : sys), expiry,
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
