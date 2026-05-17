"use strict";
/**
 * LIFF 共用後端驗證：
 *   1. 從 Authorization: Bearer <idToken> 取 ID Token
 *   2. 呼叫 LINE OAuth2 verify endpoint 驗 token
 *   3. 用 sub（LINE userId）查綁定的員工 username
 *   4. 視需求檢查職稱白名單（例如「經理」「主任」「課長」才能審核訂單）
 *
 * 用法：
 *   const auth = await authenticateLiffEmployee(db, req, { roles: ["經理","主任","課長"] });
 *   if (!auth.ok) { res.status(auth.status).json({ ok:false, error: auth.error }); return; }
 *   const employee = auth.employee;  // { username, name, title, lineUserId }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateLiffEmployee = authenticateLiffEmployee;
exports.readBearerIdToken = readBearerIdToken;

const liff_verify_js_1 = require("./liff-verify.js");
const employee_line_binding_js_1 = require("./employee-line-binding.js");

function readBearerIdToken(req) {
    const h = String(req?.headers?.authorization || "").trim();
    if (!h) return null;
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m) return null;
    const t = m[1].trim();
    return t || null;
}

/**
 * @param {*} db
 * @param {*} req           express req
 * @param {Object} [opts]
 * @param {string[]} [opts.roles]  允許的職稱白名單；不傳則只需「有綁定」即通過
 * @returns {Promise<{ok:boolean, status?:number, error?:string, employee?:object, lineUserId?:string}>}
 */
async function authenticateLiffEmployee(db, req, opts) {
    const idToken = readBearerIdToken(req);
    if (!idToken) {
        return { ok: false, status: 401, error: "missing Authorization Bearer id_token" };
    }
    const verified = await (0, liff_verify_js_1.verifyLineIdToken)(idToken);
    if (!verified.ok) {
        return { ok: false, status: 401, error: verified.error || "ID Token 驗證失敗" };
    }
    const lineUserId = verified.sub;
    const emp = await (0, employee_line_binding_js_1.findEmployeeByLineUserId)(db, lineUserId);
    if (!emp) {
        return { ok: false, status: 403, error: "此 LINE 帳號尚未綁定員工，請先到後台「人員管理」產生 LIFF 綁定連結。" };
    }
    const allowed = Array.isArray(opts?.roles) && opts.roles.length > 0
        ? opts.roles.map(s => String(s).trim()).filter(Boolean)
        : null;
    if (allowed && !allowed.includes(emp.title)) {
        return { ok: false, status: 403, error: `${emp.title || "—"} 沒有此功能權限（需：${allowed.join("/")}）` };
    }
    return { ok: true, employee: emp, lineUserId };
}
