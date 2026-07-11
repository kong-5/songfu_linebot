"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// 凌越公司代碼（icpno）→ 顯示名。多公司庫存/盤點/條碼對照共用。
// 00 松富、01 龍港、02 松揚、03 松成。新公司加這裡一處即可。

exports.ERP_COMPANY_NAMES = { "00": "松富", "01": "龍港", "02": "松揚", "03": "松成" };
exports.erpCompanyName = erpCompanyName;
exports.normIcpno = normIcpno;
exports.companyArgToIcpno = companyArgToIcpno;

// 名稱／代碼別名 → icpno（給 LINE「#盤點 松揚」這種指令用）。含常見全名／簡稱。
const _NAME_TO_ICPNO = {
    "松富": "00", "松富物流": "00", "松富物流股份有限公司": "00",
    "龍港": "01",
    "松揚": "02", "松揚物流": "02", "松揚物流股份有限公司": "02",
    "松成": "03", "松成物流": "03", "松成物流股份有限公司": "03",
};

// 解析使用者輸入的「公司」字串（名稱或代碼）→ icpno；空字串回 '00'（松富，預設）；無法辨識回 null。
function companyArgToIcpno(s) {
    const raw = String(s == null ? "" : s).trim();
    if (raw === "") return "00";
    if (/^\d{2}$/.test(raw)) return raw; // 直接打代碼 00/01/02/03
    const key = raw.replace(/\s/g, "");
    return _NAME_TO_ICPNO[key] || null;
}

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
