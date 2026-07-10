"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// 凌越公司代碼（icpno）→ 顯示名。多公司庫存/盤點/條碼對照共用。
// 00 松富、01 龍港、02 松揚、03 松成。新公司加這裡一處即可。

exports.ERP_COMPANY_NAMES = { "00": "松富", "01": "龍港", "02": "松揚", "03": "松成" };
exports.erpCompanyName = erpCompanyName;
exports.normIcpno = normIcpno;

function erpCompanyName(icpno) {
    const c = normIcpno(icpno);
    return exports.ERP_COMPANY_NAMES[c] || ("公司" + c);
}

// 正規化公司代碼：兩碼數字才收，其他回 fallback（預設 '00'）。DB 舊列 icpno 可能為 NULL/空字串。
function normIcpno(v, fallback) {
    const fb = fallback == null ? "00" : fallback;
    const s = String(v == null ? "" : v).trim();
    return /^\d{2}$/.test(s) ? s : fb;
}
