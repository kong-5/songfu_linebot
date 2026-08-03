"use strict";
/**
 * 盤差紅標規則（單一權威）：整列紅底／「只看紅標」篩選／異常排查表／結果圖都吃這一份。
 *
 * 兩段式門檻是刻意的：只看 % → 小量品項（帳 0.5 差 0.5＝100%）整片紅；
 * 只看量 → 大品項差 1 也紅。回報案例：81 項全紅沒辦法 focus。
 *
 * 原本定義在 dist/admin/inventory.js 的 registerInventoryRoutes 閉包內，
 * 結果圖（stocktake-report.js）也要用同一份判定，故抽到 lib（純搬移、行為不變）。
 */
Object.defineProperty(exports, "__esModule", { value: true });

const HOT_PCT_DEFAULT = 5, HOT_QTY_DEFAULT = 0;

async function loadHotRule(db) {
    const num = async (key, dft) => {
        try {
            const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
            const v = r && r.value != null && String(r.value).trim() !== "" ? Number(r.value) : NaN;
            return (Number.isFinite(v) && v >= 0) ? v : dft;
        }
        catch (_) { return dft; }
    };
    return { pct: await num("stocktake_hot_pct", HOT_PCT_DEFAULT), qty: await num("stocktake_hot_qty", HOT_QTY_DEFAULT) };
}

/** diff＝盤差量、base＝盤差的基準（應有量或凌越量）。base=0 時 % 無意義 → 只看量。 */
function isHotDiff(rule, diff, base) {
    if (diff == null) return false;
    const d = Math.abs(Number(diff) || 0);
    if (d < Number(rule.qty || 0)) return false;
    const b = Math.abs(Number(base) || 0);
    if (!b) return d > 0 && Number(rule.qty || 0) > 0; // 基準 0：只有設了量門檻才判定得了
    return (d / b) * 100 >= Number(rule.pct || 0);
}

const hotRuleText = (rule) => `≥${rule.pct}%` + (rule.qty ? ` 且 ≥${rule.qty}` : "");

module.exports = { loadHotRule, isHotDiff, hotRuleText, HOT_PCT_DEFAULT, HOT_QTY_DEFAULT };
