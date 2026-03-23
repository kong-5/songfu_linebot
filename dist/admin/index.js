"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminRouter = createAdminRouter;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const XLSX = __importStar(require("xlsx"));
const bwip_js_1 = __importDefault(require("bwip-js"));
const index_js_1 = require("../db/index.js");
const id_js_1 = require("../lib/id.js");
const parse_order_message_js_1 = require("../lib/parse-order-message.js");
const resolve_product_js_1 = require("../lib/resolve-product.js");
const vision_ocr_js_1 = require("../lib/vision-ocr.js");
const wholesale_price_js_1 = require("../lib/wholesale-price.js");
const line_bot_control_js_1 = require("../lib/line-bot-control.js");
const crypto_1 = require("crypto");
const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
let ADMIN_UI_VERSION = process.env.ADMIN_UI_VERSION || "";
if (!ADMIN_UI_VERSION) {
    try {
        const pkg = require("../../package.json");
        if (pkg && pkg.version)
            ADMIN_UI_VERSION = pkg.version;
    }
    catch (_) { }
    if (!ADMIN_UI_VERSION)
        ADMIN_UI_VERSION = "1.0.0";
}
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single("file");
const uploadImage = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single("image");
const NOTION_STYLE = `
  :root { --notion-bg:#fff; --notion-sidebar:#f7f6f3; --notion-border:#e3e2e0; --notion-text:#37352f; --notion-text-muted:#787774; --notion-accent:#2383e2; --notion-hover:#f1f1ef; --notion-radius:6px; }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 100%; max-width: 100vw; min-height: 100vh; }
  body { font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif; background: var(--notion-bg); color: var(--notion-text); line-height: 1.5; display: flex; }
  .notion-layout { display: flex; width: 100%; max-width: 100%; min-height: 100vh; flex: 1; min-width: 0; }
  .notion-sidebar { width: 180px; min-width: 180px; background: var(--notion-sidebar); border-right: 1px solid var(--notion-border); padding: 12px 0; flex-shrink: 0; }
  .notion-sidebar a { display: block; padding: 6px 14px; color: var(--notion-text); text-decoration: none; font-size: 14px; border-radius: var(--notion-radius); }
  .notion-sidebar a:hover { background: var(--notion-hover); }
  .notion-sidebar .active { background: var(--notion-hover); color: var(--notion-accent); }
  .notion-sidebar .group { font-size: 11px; font-weight: 600; color: var(--notion-text-muted); padding: 8px 14px 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .notion-sidebar .sidebar-group { margin: 0; border: none; }
  .notion-sidebar .sidebar-group-title { font-size: 15px; font-weight: 700; color: #1a1a1a; padding: 10px 14px; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; }
  .notion-sidebar .sidebar-group-title::-webkit-details-marker { display: none; }
  .notion-sidebar .sidebar-group-title::after { content: "▼"; font-size: 10px; color: var(--notion-text-muted); }
  .notion-sidebar .sidebar-group[open] .sidebar-group-title::after { content: "▲"; }
  .notion-sidebar .sidebar-group .sidebar-links { padding: 0 0 8px 0; }
  .notion-sidebar .sidebar-group .sidebar-links a { padding: 6px 14px 6px 20px; }
  .notion-main-wrap { flex: 1; min-width: 0; width: 100%; display: flex; flex-direction: column; max-width: 100%; }
  .notion-main { flex: 1; min-width: 0; width: 100%; max-width: 100%; padding: 32px 40px 48px; }
  .notion-page-title { font-size: 28px; font-weight: 700; margin: 0 0 8px; color: var(--notion-text); }
  .notion-breadcrumb { font-size: 13px; color: var(--notion-text-muted); margin-bottom: 20px; }
  .notion-breadcrumb a { color: var(--notion-accent); text-decoration: none; }
  .notion-card { background: var(--notion-bg); border: 1px solid var(--notion-border); border-radius: var(--notion-radius); padding: 16px 20px; margin-bottom: 16px; }
  .notion-card h2 { font-size: 14px; font-weight: 600; margin: 0 0 12px; color: var(--notion-text); }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border: 1px solid var(--notion-border); padding: 10px 12px; text-align: left; }
  th { background: var(--notion-sidebar); font-weight: 600; font-size: 13px; color: var(--notion-text-muted); }
  tr:hover td { background: var(--notion-hover); }
  a { color: var(--notion-accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .btn, button[type=submit] { display: inline-block; padding: 8px 14px; font-size: 14px; border-radius: var(--notion-radius); border: 1px solid var(--notion-border); background: var(--notion-bg); color: var(--notion-text); cursor: pointer; font-family: inherit; }
  .btn:hover, button[type=submit]:hover { background: var(--notion-hover); }
  .btn-primary { background: var(--notion-accent); color: #fff; border-color: var(--notion-accent); }
  .btn-primary:hover { opacity: 0.9; }
  input[type=text], input[type=search], select { padding: 8px 10px; border: 1px solid var(--notion-border); border-radius: var(--notion-radius); font-size: 14px; font-family: inherit; }
  label { display: block; margin-top: 12px; font-size: 14px; }
  label:first-of-type { margin-top: 0; }
  .form-inline label { display: inline; margin-right: 12px; }
  .notion-msg { padding: 10px 14px; border-radius: var(--notion-radius); margin-bottom: 16px; font-size: 14px; }
  .notion-msg.ok { background: #e7f5e9; color: #2e7d32; }
  .notion-msg.err { background: #ffebee; color: #c62828; }
  .notion-sidebar .notion-brand { display: block; padding: 10px 14px 14px; font-size: 17px; font-weight: 700; color: #1a1a1a; text-decoration: none; border-bottom: 1px solid var(--notion-border); margin-bottom: 6px; }
  .notion-sidebar .notion-brand:hover { background: var(--notion-hover); }
  .notion-sidebar .notion-brand.active { color: var(--notion-accent); background: var(--notion-hover); }
  .notion-actionbar { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; padding: 12px 40px 0; flex-shrink: 0; width: 100%; box-sizing: border-box; }
  .notion-topbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 12px 20px; background: var(--notion-sidebar); border-bottom: 1px solid var(--notion-border); }
  .notion-topbar .topbar-date { font-size: 14px; display: flex; align-items: center; gap: 8px; }
  .notion-topbar .topbar-date input[type=date] { padding: 6px 10px; }
  .notion-rollover-btn { background: #2e7d32; color: #fff; border: none; padding: 8px 16px; border-radius: var(--notion-radius); font-weight: 600; cursor: pointer; }
  .notion-rollover-btn:hover { background: #1b5e20; }
  .notion-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .notion-modal { background: var(--notion-bg); border-radius: var(--notion-radius); padding: 20px; max-width: 420px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
  .notion-modal h3 { margin: 0 0 12px; font-size: 16px; }
  .notion-modal-actions { margin-top: 16px; display: flex; gap: 8px; }
  .notion-modal-search { width: 100%; padding: 8px 10px; margin-bottom: 12px; }
  .notion-modal-list { max-height: 280px; overflow-y: auto; border: 1px solid var(--notion-border); border-radius: var(--notion-radius); }
  .notion-modal-list div { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--notion-border); }
  .notion-modal-list div:hover { background: var(--notion-hover); }
  .teraoka-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
  .teraoka-cell .code { font-weight: 600; }
  .teraoka-cell .name { font-size: 12px; color: var(--notion-text-muted); }
  .order-table-col-system { border-left: 2px solid var(--notion-accent); }
  tr.order-row-excluded { background: var(--notion-sidebar); color: var(--notion-text-muted); }
  tr.order-row-excluded input, tr.order-row-excluded select { opacity: 0.85; }
  a.product-pick.need-review { color: #c00; font-weight: 600; }
  a.product-pick.product-change { color: var(--notion-accent); }
  @media print { .notion-sidebar, .no-print, .notion-topbar { display: none !important; } .notion-main { max-width: none; } }
`;
const NOTION_SIDEBAR = (active) => `
  <nav class="notion-sidebar">
    <a href="/admin" class="notion-brand ${active === "dashboard" ? "active" : ""}">松富物流</a>
    <details class="sidebar-group" ${active === "line-bot" ? "open" : ""}>
      <summary class="sidebar-group-title">LINE 機器人</summary>
      <div class="sidebar-links">
        <a href="/admin/line-bot" class="${active === "line-bot" ? "active" : ""}">啟動與排程</a>
      </div>
    </details>
    <details class="sidebar-group">
      <summary class="sidebar-group-title">客戶管理</summary>
      <div class="sidebar-links">
        <a href="/admin/customers/new">新增客戶</a>
        <a href="/admin/customers">客戶管理</a>
        <a href="/admin/import-customers">批次匯入客戶</a>
      </div>
    </details>
    <details class="sidebar-group">
      <summary class="sidebar-group-title">貨品管理</summary>
      <div class="sidebar-links">
        <a href="/admin/products">品項與俗名</a>
        <a href="/admin/import">批次匯入品項</a>
      </div>
    </details>
    <details class="sidebar-group">
      <summary class="sidebar-group-title">訂單管理</summary>
      <div class="sidebar-links">
        <a href="/admin/orders">訂單查詢</a>
        <a href="/admin/review">待確認品項</a>
        <a href="/admin/export">資料匯出</a>
        <a href="/admin/triggers">提示詞管理</a>
      </div>
    </details>
    <details class="sidebar-group" ${active === "inventory" ? "open" : ""}>
      <summary class="sidebar-group-title">盤點作業</summary>
      <div class="sidebar-links">
        <a href="/admin/inventory" class="${active === "inventory" ? "active" : ""}">盤點作業</a>
        <a href="/admin/inventory/warehouses" class="${active === "inv-wh" ? "active" : ""}">庫房管理</a>
        <a href="/admin/inventory/assign" class="${active === "inv-assign" ? "active" : ""}">品項歸倉</a>
        <a href="/admin/inventory/daily" class="${active === "inv-daily" ? "active" : ""}">每日盤點</a>
        <a href="/admin/inventory/import-erp" class="${active === "inv-erp" ? "active" : ""}">匯入 ERP 資料</a>
        <a href="/admin/inventory/variance-report" class="${active === "inv-report" ? "active" : ""}">盤差報表</a>
        <a href="/admin/inventory/manager" class="${active === "inv-manager" ? "active" : ""}">管理人設定</a>
      </div>
    </details>
    <details class="sidebar-group" ${active === "logistics" || active === "logistics-procurement" || active === "logistics-market" ? "open" : ""}>
      <summary class="sidebar-group-title">物流工具</summary>
      <div class="sidebar-links">
        <a href="/admin/logistics/orders" class="${active === "logistics" ? "active" : ""}">訂單整理</a>
        <a href="/admin/logistics/procurement" class="${active === "logistics-procurement" ? "active" : ""}">採購分析</a>
        <a href="/admin/logistics/market" class="${active === "logistics-market" ? "active" : ""}">北農行情</a>
      </div>
    </details>
    <details class="sidebar-group" ${active === "env" ? "open" : ""}>
      <summary class="sidebar-group-title">環境衛生管理</summary>
      <div class="sidebar-links">
        <a href="/admin/freezer-fridge" class="${active === "env" ? "active" : ""}">冷凍庫冷藏庫檢查表</a>
      </div>
    </details>
    <div class="sidebar-version" style="padding:10px 14px;font-size:11px;color:var(--notion-text-muted);border-top:1px solid var(--notion-border);margin-top:8px;">後台 v${ADMIN_UI_VERSION}</div>
  </nav>
`;
function parseAdminCookies(header) {
    const out = {};
    if (!header)
        return out;
    for (const part of header.split(";")) {
        const idx = part.indexOf("=");
        if (idx < 0)
            continue;
        const k = part.slice(0, idx).trim();
        const v = decodeURIComponent(part.slice(idx + 1).trim());
        out[k] = v;
    }
    return out;
}
function getAdminSessionSecret() {
    return process.env.ADMIN_SESSION_SECRET || "songfu-admin-dev-secret-change-in-production";
}
function hashAdminPassword(password) {
    const salt = crypto_1.randomBytes(16).toString("hex");
    const hash = crypto_1.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return salt + ":" + hash;
}
function verifyAdminPassword(password, stored) {
    const parts = String(stored).split(":");
    if (parts.length !== 2)
        return false;
    const salt = parts[0];
    const hash = parts[1];
    const h = crypto_1.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    try {
        return crypto_1.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(h, "hex"));
    }
    catch {
        return false;
    }
}
function signAdminSession(username) {
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto_1.createHmac("sha256", getAdminSessionSecret()).update(payload).digest("base64url");
    return payload + "." + sig;
}
function verifyAdminSessionToken(token) {
    if (!token || typeof token !== "string")
        return null;
    const parts = token.split(".");
    if (parts.length !== 2)
        return null;
    const payload = parts[0];
    const sig = parts[1];
    const expected = crypto_1.createHmac("sha256", getAdminSessionSecret()).update(payload).digest("base64url");
    try {
        if (!crypto_1.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
            return null;
    }
    catch {
        return null;
    }
    try {
        const data = JSON.parse(Buffer.from(payload, "base64url").toString());
        if (!data.u || !data.exp || Date.now() > data.exp)
            return null;
        return String(data.u);
    }
    catch {
        return null;
    }
}
function renderAdminActionBar(username) {
    const u = escapeHtml(username || "");
    return `
    <div class="notion-actionbar no-print">
      <div style="flex:1;"></div>
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;justify-content:flex-end;">
        <button type="button" class="btn" onclick="history.back()">上一頁</button>
        <a href="/admin/users" class="btn">人員管理</a>
        <span style="font-size:13px;color:var(--notion-text-muted);">${u}</span>
        <form method="post" action="/admin/logout" style="display:inline;margin:0;"><button type="submit" class="btn">登出</button></form>
      </div>
    </div>`;
}
async function getWorkingDate(database) {
    const row = await database.prepare("SELECT value FROM app_settings WHERE key = ?").get("working_date");
    if (row && row.value)
        return row.value;
    return new Date().toISOString().slice(0, 10);
}
function renderTopBar(workingDate, canUndo) {
    const d = new Date(workingDate + "T12:00:00");
    const dateLabel = d.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" });
    return `
    <div class="notion-topbar no-print">
      <div class="topbar-date">
        <span>結轉日期（收訂單用）：<strong>${escapeHtml(dateLabel)}</strong></span>
        <form method="post" action="/admin/api/working-date" style="display:inline-flex;align-items:center;gap:8px;margin-left:12px;">
          <input type="date" name="date" value="${escapeAttr(workingDate)}" required>
          <button type="submit" class="btn">套用</button>
        </form>
      </div>
      <div>
        ${canUndo ? `<form method="post" action="/admin/api/rollover-undo" style="display:inline;"><button type="submit" class="btn">反悔結轉</button></form> ` : ""}
        <button type="button" class="notion-rollover-btn" onclick="if(confirm('確定要結轉？結轉後工作日期將改為下一日。')) document.getElementById('rolloverForm').submit();">結轉</button>
        <form id="rolloverForm" method="post" action="/admin/api/rollover" style="display:none;"></form>
      </div>
    </div>`;
}
function notionPage(title, body, active = "", topBar = "", actionBar = "") {
    const ab = actionBar || "";
    const tb = topBar || "";
    const main = ab || tb
        ? `<div class="notion-main-wrap">${ab}${tb}<main class="notion-main">${body}</main></div>`
        : `<main class="notion-main">${body}</main>`;
    return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} － 松富物流後台</title><style>${NOTION_STYLE}</style></head><body><div class="notion-layout">${NOTION_SIDEBAR(active)}${main}</div></body></html>`;
}
function createAdminRouter() {
    const router = express_1.default.Router();
    const db = (0, index_js_1.getDb)(dbPath);
    async function loadAdminUsers() {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("admin_users");
        if (!row?.value)
            return [];
        try {
            const j = JSON.parse(row.value);
            return Array.isArray(j) ? j : [];
        }
        catch {
            return [];
        }
    }
    async function saveAdminUsers(users) {
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify(users));
    }
    router.use((_req, res, next) => {
        res.locals.topBarHtml = "";
        res.locals.actionBarHtml = "";
        next();
    });
    router.get("/login", async (_req, res) => {
        const users = await loadAdminUsers();
        if (users.length === 0) {
            res.redirect(302, "/admin/setup");
            return;
        }
        const err = _req.query.err === "1";
        const ok = _req.query.ok === "1";
        const nextParam = typeof _req.query.next === "string" && _req.query.next.startsWith("/admin") ? _req.query.next : "/admin";
        res.type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登入 － 松富物流後台</title><style>body{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;background:#f7f6f3;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}.box{max-width:400px;width:100%;background:#fff;border:1px solid #e3e2e0;border-radius:8px;padding:28px;}.box h1{font-size:22px;margin:0 0 16px;color:#37352f;}label{display:block;margin-top:12px;font-size:14px;}input{width:100%;padding:10px 12px;margin-top:6px;border:1px solid #e3e2e0;border-radius:6px;font-size:14px;box-sizing:border-box;}button{margin-top:20px;width:100%;padding:10px;background:#2383e2;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer;font-weight:600;}.err{background:#ffebee;color:#c62828;padding:10px 12px;border-radius:6px;font-size:14px;margin-bottom:12px;}.ok{background:#e7f5e9;color:#2e7d32;padding:10px 12px;border-radius:6px;font-size:14px;margin-bottom:12px;}</style></head><body><div class="box"><h1>松富物流 後台登入</h1>${err ? "<div class=\"err\">帳號或密碼錯誤。</div>" : ""}${ok ? "<div class=\"ok\">已建立管理員，請登入。</div>" : ""}<form method="post" action="/admin/login"><input type="hidden" name="next" value="${escapeAttr(nextParam)}"><label>帳號 <input type="text" name="username" required autocomplete="username"></label><label>密碼 <input type="password" name="password" required autocomplete="current-password"></label><button type="submit">登入</button></form></div></body></html>`);
    });
    router.get("/setup", async (_req, res) => {
        const users = await loadAdminUsers();
        if (users.length > 0) {
            res.redirect(302, "/admin/login");
            return;
        }
        const err = _req.query.err;
        const errHtml = err === "weak" ? "<div class=\"err\">帳號至少 2 字元、密碼至少 4 字元。</div>" : "";
        res.type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>首次設定管理員 － 松富物流</title><style>body{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;background:#f7f6f3;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}.box{max-width:400px;width:100%;background:#fff;border:1px solid #e3e2e0;border-radius:8px;padding:28px;}.box h1{font-size:22px;margin:0 0 8px;color:#37352f;}p{color:#787774;font-size:14px;margin:0 0 16px;}label{display:block;margin-top:12px;font-size:14px;}input{width:100%;padding:10px 12px;margin-top:6px;border:1px solid #e3e2e0;border-radius:6px;font-size:14px;box-sizing:border-box;}button{margin-top:20px;width:100%;padding:10px;background:#2383e2;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer;font-weight:600;}.err{background:#ffebee;color:#c62828;padding:10px 12px;border-radius:6px;font-size:14px;margin-bottom:12px;}</style></head><body><div class="box"><h1>首次設定管理員</h1><p>尚無後台帳號，請建立第一組帳號密碼。</p>${errHtml}<form method="post" action="/admin/setup"><label>帳號 <input type="text" name="username" required minlength="2" autocomplete="username"></label><label>密碼 <input type="password" name="password" required minlength="4" autocomplete="new-password"></label><button type="submit">建立並前往登入</button></form></div></body></html>`);
    });
    router.post("/setup", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const users = await loadAdminUsers();
        if (users.length > 0) {
            res.redirect("/admin/login");
            return;
        }
        const username = (req.body.username || "").trim();
        const password = (req.body.password || "").toString();
        if (username.length < 2 || password.length < 4) {
            res.redirect("/admin/setup?err=weak");
            return;
        }
        await saveAdminUsers([{ username, passwordHash: hashAdminPassword(password) }]);
        res.redirect("/admin/login?ok=1");
    });
    router.post("/login", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const users = await loadAdminUsers();
        const username = (req.body.username || "").trim();
        const password = (req.body.password || "").toString();
        const u = users.find((x) => x.username === username);
        if (!u || !verifyAdminPassword(password, u.passwordHash)) {
            res.redirect("/admin/login?err=1");
            return;
        }
        const token = signAdminSession(username);
        res.setHeader("Set-Cookie", `sf_admin_session=${encodeURIComponent(token)}; Path=/admin; HttpOnly; Max-Age=${7 * 24 * 3600}; SameSite=Lax`);
        let nextUrl = (req.body.next || "/admin").toString();
        if (!nextUrl.startsWith("/admin"))
            nextUrl = "/admin";
        res.redirect(302, nextUrl);
    });
    router.post("/logout", (_req, res) => {
        res.setHeader("Set-Cookie", "sf_admin_session=; Path=/admin; HttpOnly; Max-Age=0; SameSite=Lax");
        res.redirect(302, "/admin/login");
    });
    router.use(async (req, res, next) => {
        const pathname = req.path || "/";
        if (pathname === "/login" && req.method === "GET")
            return next();
        if (pathname === "/setup" && req.method === "GET")
            return next();
        if (pathname === "/login" && req.method === "POST")
            return next();
        if (pathname === "/setup" && req.method === "POST")
            return next();
        if (pathname === "/logout" && req.method === "POST")
            return next();
        const cookies = parseAdminCookies(req.headers.cookie || "");
        const token = cookies.sf_admin_session;
        const uname = verifyAdminSessionToken(token);
        if (!uname) {
            const nu = encodeURIComponent(req.originalUrl || "/admin");
            res.redirect(302, "/admin/login?next=" + nu);
            return;
        }
        req.adminUsername = uname;
        res.locals.actionBarHtml = renderAdminActionBar(uname);
        next();
    });
    router.get("/users", async (req, res) => {
        const users = await loadAdminUsers();
        const msg = req.query.ok === "add" ? "<p class=\"notion-msg ok\">已新增帳號。</p>" : req.query.ok === "del" ? "<p class=\"notion-msg ok\">已刪除帳號。</p>" : req.query.err === "dup" ? "<p class=\"notion-msg err\">帳號已存在。</p>" : req.query.err === "last" ? "<p class=\"notion-msg err\">至少需保留一個帳號。</p>" : req.query.err === "weak" ? "<p class=\"notion-msg err\">帳號至少 2 字元、密碼至少 4 字元。</p>" : "";
        const rows = users.map((u) => `<tr><td>${escapeHtml(u.username)}</td><td>${users.length <= 1 ? "—" : `<form method="post" action="/admin/users/delete" style="display:inline;margin:0;" onsubmit="return confirm('確定刪除 ${escapeAttr(u.username)}？');"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="btn">刪除</button></form>`}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 人員管理</div>
        <h1 class="notion-page-title">人員管理</h1>
        ${msg}
        <div class="notion-card">
          <h2 style="margin-top:0;">帳號列表</h2>
          <table><thead><tr><th>帳號</th><th>操作</th></tr></thead><tbody>${rows || "<tr><td colspan=\"2\">尚無資料</td></tr>"}</tbody></table>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">新增帳號</h2>
          <form method="post" action="/admin/users/add">
            <label>帳號 <input type="text" name="username" required minlength="2" autocomplete="off"></label>
            <label>密碼 <input type="password" name="password" required minlength="4" autocomplete="new-password"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("人員管理", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/users/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const username = (req.body.username || "").trim();
        const password = (req.body.password || "").toString();
        if (username.length < 2 || password.length < 4) {
            res.redirect("/admin/users?err=weak");
            return;
        }
        const users = await loadAdminUsers();
        if (users.some((x) => x.username === username)) {
            res.redirect("/admin/users?err=dup");
            return;
        }
        users.push({ username, passwordHash: hashAdminPassword(password) });
        await saveAdminUsers(users);
        res.redirect("/admin/users?ok=add");
    });
    router.post("/users/delete", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const delName = (req.body.username || "").trim();
        const users = await loadAdminUsers();
        if (users.length <= 1) {
            res.redirect("/admin/users?err=last");
            return;
        }
        const next = users.filter((x) => x.username !== delName);
        if (next.length === users.length) {
            res.redirect("/admin/users");
            return;
        }
        await saveAdminUsers(next);
        res.redirect("/admin/users?ok=del");
    });
    router.post("/api/working-date", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const date = req.body.date?.trim();
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.redirect("/admin?err=date");
            return;
        }
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("working_date", date);
        res.redirect(req.get("Referrer") || "/admin");
    });
    router.post("/api/rollover", async (req, res) => {
        const current = await getWorkingDate(db);
        const next = new Date(current + "T12:00:00");
        next.setDate(next.getDate() + 1);
        const nextStr = next.toISOString().slice(0, 10);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("previous_working_date", current);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("working_date", nextStr);
        res.redirect(req.get("Referrer") || "/admin");
    });
    router.post("/api/rollover-undo", async (req, res) => {
        const prev = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("previous_working_date");
        if (prev && prev.value) {
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("working_date", prev.value);
            await db.prepare("DELETE FROM app_settings WHERE key = ?").run("previous_working_date");
        }
        res.redirect(req.get("Referrer") || "/admin");
    });
    router.get("/line-bot", async (_req, res) => {
        const s = await (0, line_bot_control_js_1.getLineBotSettings)(db);
        const accepting = await (0, line_bot_control_js_1.isBotAcceptingOrders)(db);
        let logs = [];
        try {
            logs = await db.prepare("SELECT event_type, detail, created_at FROM line_bot_state_log ORDER BY created_at DESC LIMIT 80").all();
        }
        catch (_) { }
        const statusBadge = accepting
            ? `<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:#e6f7e6;color:#0a5;font-weight:600;">目前狀態：可收單</span>`
            : `<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:#ffeaea;color:#a00;font-weight:600;">目前狀態：不收單（關閉或不在排程時段）</span>`;
        const modeOpts = [
            { v: "always_on", l: "一律開啟（測試／全天候）" },
            { v: "always_off", l: "一律關閉（不回覆叫貨）" },
            { v: "scheduled", l: "依下方時段（台北時間）" },
        ].map((o) => `<label style="display:block;margin:6px 0;"><input type="radio" name="line_bot_mode" value="${escapeAttr(o.v)}" ${s.mode === o.v ? "checked" : ""}> ${escapeHtml(o.l)}</label>`).join("");
        const logRows = logs.length
            ? logs.map((r) => `<tr><td style="white-space:nowrap;font-size:12px;">${escapeHtml(r.created_at || "")}</td><td>${escapeHtml(r.event_type || "")}</td><td style="font-size:12px;word-break:break-all;">${escapeHtml((r.detail || "").slice(0, 200))}</td></tr>`).join("")
            : "<tr><td colspan='3'>尚無紀錄</td></tr>";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / LINE 機器人</div>
        <h1 class="notion-page-title">LINE 機器人：啟動與排程</h1>
        ${_req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存設定。</p>" : ""}
        <p>${statusBadge}</p>
        <div class="notion-card">
          <h2 style="margin-top:0;">運作模式</h2>
          <form method="post" action="/admin/line-bot">
            ${modeOpts}
            <p style="margin-top:12px;"><strong>排程時段（台北時間）</strong>　僅在選「依下方時段」時生效。預設範例：18:00～隔日 03:00。</p>
            <label>開始 <input type="time" name="line_bot_window_start" value="${escapeAttr(s.windowStart)}"></label>
            　<label>結束 <input type="time" name="line_bot_window_end" value="${escapeAttr(s.windowEnd)}"></label>
            <p style="margin-top:16px;"><label><input type="checkbox" name="line_bot_ai_gate" value="1" ${s.aiGate ? "checked" : ""}> 啟用 AI 過濾（僅對「非收單關鍵字」的閒聊不回覆；需設定 GOOGLE_GEMINI_API_KEY）</label></p>
            <p style="color:var(--notion-text-muted);font-size:13px;">測試階段建議選「一律開啟」，確認無誤後再改「依時段」。AI 過濾建議先關閉，避免誤擋。</p>
            <p><button type="submit" class="btn btn-primary">儲存設定</button></p>
          </form>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">Google Gemini 與 Claude</h2>
          <p style="font-size:14px;">本系統已整合 <strong>Google Gemini</strong>（與既有 Vision／後台 AI 一致，設定簡單、中文佳、成本易控）。Claude 需另接 Anthropic API 與程式改寫；若您希望改用 Claude，可再提出需求。</p>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">設定與狀態紀錄</h2>
          <table><thead><tr><th>時間</th><th>類型</th><th>內容</th></tr></thead><tbody>${logRows}</tbody></table>
        </div>
      `;
        res.type("text/html").send(notionPage("LINE 機器人", body, "line-bot", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/line-bot", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const mode = (req.body.line_bot_mode || "always_on").toString().trim();
        const wStart = (req.body.line_bot_window_start || "18:00").toString().trim();
        const wEnd = (req.body.line_bot_window_end || "03:00").toString().trim();
        const aiGate = req.body.line_bot_ai_gate === "1" ? "1" : "0";
        const allowed = new Set(["always_on", "always_off", "scheduled"]);
        const m = allowed.has(mode) ? mode : "always_on";
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_bot_mode", m);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_bot_window_start", wStart);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_bot_window_end", wEnd);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_bot_ai_gate", aiGate);
        await (0, line_bot_control_js_1.appendLineBotLog)(db, "settings_saved", { mode: m, windowStart: wStart, windowEnd: wEnd, aiGate: aiGate === "1" });
        res.redirect("/admin/line-bot?ok=1");
    });
    router.get("/", async (_req, res) => {
        const dateStr = new Date().toISOString().slice(0, 10);
        let prices = [];
        let marketMsg = "";
        try {
            prices = (await (0, wholesale_price_js_1.fetchTaipeiWholesalePrices)(dateStr)) || [];
            if (!prices.length)
                marketMsg = "今日尚無台北果菜市場行情或 API 暫無資料。";
        }
        catch (e) {
            marketMsg = "讀取行情失敗，請稍後再試。";
        }
        const previewRows = prices.slice(0, 18).map((p) => `<tr><td>${escapeHtml(p.marketName || "")}</td><td>${escapeHtml(p.cropName || "")}</td><td>${p.avgPrice ?? "—"}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb">儀表板</div>
        <h1 class="notion-page-title">儀表板</h1>
        <div class="notion-card" style="border-left:4px solid var(--notion-accent);">
          <h2 style="margin-top:0;">北農行情（${escapeHtml(dateStr)}）</h2>
          <p style="font-size:14px;color:var(--notion-text-muted);margin-top:0;">台北一、台北二批發均價等（資料來源：農業部開放資料）</p>
          ${marketMsg ? `<p class="notion-msg err">${escapeHtml(marketMsg)}</p>` : ""}
          <table><thead><tr><th>市場</th><th>作物</th><th>平均價（元／公斤）</th></tr></thead><tbody>${previewRows || "<tr><td colspan=\"3\">無資料</td></tr>"}</tbody></table>
          <p style="margin-top:12px;"><a href="/admin/logistics/market" class="btn btn-primary">查看完整北農行情</a></p>
        </div>
        <p style="color:var(--notion-text-muted);font-size:13px;">更多儀表板項目將陸續新增。</p>
      `;
        res.type("text/html").send(notionPage("儀表板", body, "dashboard", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/inventory", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const managerRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("inventory_manager");
        const managerName = managerRow?.value ?? "";
        const whFilter = (req.query.warehouse_id || "").trim();
        const qFilter = (req.query.q || "").trim().toLowerCase();
        const assignRows = await db.prepare(`
          SELECT iw.name AS warehouse_name, iwp.warehouse_id, iwp.product_id, p.name AS product_name, p.unit,
                 COALESCE(iwp.safety_stock, 0) AS safety_stock
          FROM inventory_warehouse_products iwp
          JOIN inventory_warehouses iw ON iw.id = iwp.warehouse_id
          JOIN products p ON p.id = iwp.product_id
          ORDER BY iw.sort_order, iw.name, iwp.sort_order, p.name
        `).all();
        const latestByWh = {};
        for (const w of warehouses) {
            const rec = await db.prepare("SELECT record_date, items FROM daily_inventory WHERE warehouse_id = ? ORDER BY record_date DESC LIMIT 1").get(w.id);
            if (rec) {
                const items = typeof rec.items === "string" ? JSON.parse(rec.items || "{}") : rec.items || {};
                latestByWh[w.id] = items;
            }
            else {
                latestByWh[w.id] = {};
            }
        }
        let rows = assignRows.map((r) => {
            const items = latestByWh[r.warehouse_id] || {};
            const current = items[r.product_id];
            const currentNum = current != null ? (typeof current === "number" ? current : parseFloat(current)) : null;
            return {
                warehouse_id: r.warehouse_id,
                warehouse_name: r.warehouse_name,
                product_id: r.product_id,
                product_name: r.product_name,
                unit: r.unit,
                safety_stock: Number(r.safety_stock) || 0,
                current_stock: currentNum,
            };
        });
        if (whFilter)
            rows = rows.filter((r) => r.warehouse_id === whFilter);
        if (qFilter)
            rows = rows.filter((r) => (r.product_name || "").toLowerCase().indexOf(qFilter) >= 0);
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whFilter ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 盤點作業</div>
        <h1 class="notion-page-title">盤點作業</h1>
        <div class="notion-card">
          <h2>各品項目前存量與安全庫存</h2>
          <form method="get" action="/admin/inventory" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <label>倉庫 <select name="warehouse_id" onchange="this.form.submit()"><option value="">全部</option>${optWh}</select></label>
            <label>搜尋品項 <input type="text" name="q" value="${escapeAttr(req.query.q || "")}" placeholder="品名"></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          <table>
            <thead><tr><th>倉庫</th><th>品項</th><th>單位</th><th>目前存量</th><th>安全庫存</th><th>狀態</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => {
          const low = r.safety_stock > 0 && (r.current_stock == null || Number(r.current_stock) < r.safety_stock);
          return `<tr><td>${escapeHtml(r.warehouse_name)}</td><td>${escapeHtml(r.product_name)}</td><td>${escapeHtml(r.unit || "")}</td><td>${r.current_stock != null ? r.current_stock : "—"}</td><td>${r.safety_stock}</td><td>${low ? "<span style=\"color:#c00;\">低於安全庫存</span>" : "正常"}</td></tr>`;
        }).join("") : "<tr><td colspan=\"6\">尚無品項歸倉資料，請先至「品項歸倉」設定。</td></tr>"}
            </tbody>
          </table>
        </div>
        <div class="notion-card">
          <h2>快速連結</h2>
          <ul style="margin:0;padding-left:20px;">
            <li><a href="/admin/inventory/warehouses">庫房管理</a> － 新增／編輯／刪除庫房（共 ${warehouses.length} 個）</li>
            <li><a href="/admin/inventory/assign">品項歸倉</a> － 將貨品管理中的品項填入指定庫房，並設定排序與安全庫存</li>
            <li><a href="/admin/inventory/daily">每日盤點</a> － 依日期與庫房填寫盤點數量</li>
            <li><a href="/admin/inventory/import-erp">匯入 ERP 資料</a> － 匯入銷貨數量以便計算盤差</li>
            <li><a href="/admin/inventory/variance-report">盤差報表</a> － 依倉庫與日期區間產出盤差、匯出與易盤差品項統計</li>
            <li><a href="/admin/inventory/manager">管理人設定</a> － ${managerName ? "目前管理人：" + escapeHtml(managerName) : "尚未設定管理人"}</li>
          </ul>
        </div>
      `;
        res.type("text/html").send(notionPage("盤點作業", body, "inventory", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/inventory/warehouses", async (req, res) => {
        const rows = await db.prepare("SELECT id, name, sort_order FROM inventory_warehouses ORDER BY sort_order, name").all();
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已新增庫房。</p>" : req.query.ok === "edit" ? "<p class=\"notion-msg ok\">已儲存。</p>" : req.query.ok === "del" ? "<p class=\"notion-msg ok\">已刪除。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 庫房管理</div>
        <h1 class="notion-page-title">庫房管理</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/inventory/warehouses/new" class="btn btn-primary">＋ 新增庫房</a></p>
        <div class="notion-card">
          <table>
            <thead><tr><th>順序</th><th>庫房名稱</th><th>操作</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => `<tr><td>${r.sort_order}</td><td>${escapeHtml(r.name)}</td><td><a href="/admin/inventory/warehouses/${encodeURIComponent(r.id)}/edit">編輯</a> | <a href="/admin/inventory/warehouses/${encodeURIComponent(r.id)}/delete">刪除</a></td></tr>`).join("") : "<tr><td colspan=\"3\">尚無庫房，請先新增。</td></tr>"}
            </tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("庫房管理", body, "inv-wh", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/inventory/warehouses/new", async (_req, res) => {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / <a href="/admin/inventory/warehouses">庫房管理</a> / 新增庫房</div>
        <h1 class="notion-page-title">新增庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/inventory/warehouses/new">
            <label>庫房名稱 <input type="text" name="name" required placeholder="例：1號庫蔬菜"></label>
            <label>順序（數字，愈小愈前面） <input type="number" name="sort_order" value="0"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button> <a href="/admin/inventory/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增庫房", body, "inv-wh", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/inventory/warehouses/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = (req.body.name || "").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        if (!name) {
            res.redirect("/admin/inventory/warehouses/new?err=name");
            return;
        }
        const id = (0, id_js_1.newId)("invwh");
        const now = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare(`INSERT INTO inventory_warehouses (id, name, sort_order, created_at) VALUES (?, ?, ?, ${now})`).run(id, name, sortOrder);
        res.redirect("/admin/inventory/warehouses?ok=1");
    });
    router.get("/inventory/warehouses/:id/edit", async (req, res) => {
        const row = await db.prepare("SELECT id, name, sort_order FROM inventory_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/inventory/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / <a href="/admin/inventory/warehouses">庫房管理</a> / 編輯庫房</div>
        <h1 class="notion-page-title">編輯庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/inventory/warehouses/${encodeURIComponent(row.id)}/edit">
            <label>庫房名稱 <input type="text" name="name" value="${escapeAttr(row.name)}" required></label>
            <label>順序 <input type="number" name="sort_order" value="${row.sort_order}"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/inventory/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("編輯庫房", body, "inv-wh", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/inventory/warehouses/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const name = (req.body.name || "").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        const row = await db.prepare("SELECT id FROM inventory_warehouses WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/inventory/warehouses?err=notfound");
            return;
        }
        if (!name) {
            res.redirect("/admin/inventory/warehouses/" + encodeURIComponent(id) + "/edit?err=name");
            return;
        }
        await db.prepare("UPDATE inventory_warehouses SET name = ?, sort_order = ? WHERE id = ?").run(name, sortOrder, id);
        res.redirect("/admin/inventory/warehouses?ok=edit");
    });
    router.get("/inventory/warehouses/:id/delete", async (req, res) => {
        const row = await db.prepare("SELECT id, name FROM inventory_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/inventory/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / <a href="/admin/inventory/warehouses">庫房管理</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除庫房</h1>
        <div class="notion-card">
          <p>確定要刪除「${escapeHtml(row.name)}」？此庫房內已歸倉的品項與每日盤點紀錄將一併移除關聯。</p>
          <p style="margin-top:16px;">
            <form method="post" action="/admin/inventory/warehouses/${encodeURIComponent(row.id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form>
            <a href="/admin/inventory/warehouses" class="btn">取消</a>
          </p>
        </div>
      `;
        res.type("text/html").send(notionPage("確認刪除庫房", body, "inv-wh", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/inventory/warehouses/:id/delete", async (req, res) => {
        const id = req.params.id;
        await db.prepare("DELETE FROM inventory_warehouse_products WHERE warehouse_id = ?").run(id);
        await db.prepare("DELETE FROM daily_inventory WHERE warehouse_id = ?").run(id);
        await db.prepare("DELETE FROM inventory_warehouses WHERE id = ?").run(id);
        res.redirect("/admin/inventory/warehouses?ok=del");
    });
    router.get("/inventory/assign", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const whId = req.query.warehouse_id?.trim() || (warehouses[0] && warehouses[0].id) || "";
        const searchQ = (req.query.q || "").trim().replace(/%/g, "");
        let inWarehouse = [];
        let allProducts = [];
        if (whId) {
            inWarehouse = await db.prepare("SELECT pwp.product_id, pwp.sort_order, COALESCE(pwp.safety_stock, 0) as safety_stock, p.name, p.unit FROM inventory_warehouse_products pwp JOIN products p ON p.id = pwp.product_id WHERE pwp.warehouse_id = ? ORDER BY pwp.sort_order, p.name").all(whId);
            if (searchQ) {
                const like = "%" + searchQ + "%";
                allProducts = await db.prepare("SELECT id, name, unit, erp_code FROM products WHERE (active = 1 OR active IS NULL) AND (name LIKE ? OR (erp_code IS NOT NULL AND erp_code LIKE ?)) ORDER BY name").all(like, like);
            }
            else {
                allProducts = await db.prepare("SELECT id, name, unit, erp_code FROM products WHERE active = 1 OR active IS NULL ORDER BY name").all();
            }
        }
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const availableProducts = whId ? allProducts.filter((p) => !inWarehouse.some((x) => x.product_id === p.id)) : [];
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 品項歸倉</div>
        <h1 class="notion-page-title">品項歸倉</h1>
        ${req.query.ok === "1" ? "<p class=\"notion-msg ok\">已加入品項。</p>" : req.query.ok === "settings" ? "<p class=\"notion-msg ok\">已儲存排序與安全庫存。</p>" : req.query.ok === "remove" ? "<p class=\"notion-msg ok\">已移出。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : ""}
        <p>選擇庫房後，將「貨品管理」中的品項加入此庫房；加入後才會在「每日盤點」中出現。</p>
        <form method="get" action="/admin/inventory/assign" style="margin:16px 0;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <label>選擇庫房 <select name="warehouse_id" onchange="this.form.submit()">${optWh || "<option value=\"\">— 請先至庫房管理新增庫房 —</option>"}</select></label>
          ${whId ? `<label>搜尋品項（模糊） <input type="text" name="q" value="${escapeAttr(searchQ)}" placeholder="品名或 ERP 代碼"></label><button type="submit" class="btn">搜尋</button>` : ""}
        </form>
        ${whId ? `
        <div class="notion-card">
          <h2>已歸入此庫房的品項（${inWarehouse.length} 項）— 可編輯排序與安全庫存</h2>
          <form method="post" action="/admin/inventory/assign/update-settings">
            <input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}">
            <table>
              <thead><tr><th>排序</th><th>品項</th><th>單位</th><th>安全庫存量</th><th>操作</th></tr></thead>
              <tbody>
                ${inWarehouse.length ? inWarehouse.map((p) => `<tr><td><input type="number" name="sort_${escapeAttr(p.product_id)}" value="${p.sort_order}" style="width:60px;"></td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.unit || "")}</td><td><input type="number" step="any" name="safety_${escapeAttr(p.product_id)}" value="${p.safety_stock}" style="width:80px;" placeholder="0"></td><td><a href="#" onclick="document.getElementById('remove_${escapeAttr(p.product_id)}').submit();return false;">移出</a></td></tr>`).join("") : "<tr><td colspan=\"5\">尚無品項，請從下方加入。</td></tr>"}
              </tbody>
            </table>
            ${inWarehouse.length ? "<p style=\"margin-top:12px;\"><button type=\"submit\" class=\"btn btn-primary\">儲存排序與安全庫存</button></p>" : ""}
          </form>
          ${inWarehouse.map((p) => `<form id="remove_${escapeAttr(p.product_id)}" method="post" action="/admin/inventory/assign/remove" style="display:none;"><input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}"><input type="hidden" name="product_id" value="${escapeAttr(p.product_id)}"></form>`).join("")}
        </div>
        <div class="notion-card">
          <h2>加入品項（可打字搜尋，支援品名／ERP 模糊搜尋）</h2>
          <input type="text" id="addProductSearch" placeholder="輸入品名或 ERP 代碼篩選…" style="margin-bottom:12px;width:100%;max-width:320px;">
          <div id="addProductList" style="max-height:280px;overflow:auto;border:1px solid #e0e0e0;border-radius:6px;padding:8px;">
            ${availableProducts.length ? availableProducts.map((p) => `<div class="add-product-row" data-name="${escapeAttr((p.name || "") + " " + (p.erp_code || ""))}"><form method="post" action="/admin/inventory/assign/add" style="display:inline;"><input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}"><input type="hidden" name="product_id" value="${escapeAttr(p.id)}"><button type="submit" class="btn btn-primary" style="margin:2px;">加入</button></form> ${escapeHtml(p.name)}${p.erp_code ? " <span style=\"color:#666;\">(" + escapeHtml(p.erp_code) + ")</span>" : ""} ${p.unit ? "<span style=\"color:#888;\">" + escapeHtml(p.unit) + "</span>" : ""}</div>`).join("") : "<p>— 已全加入或貨品管理尚無品項 —</p>"}
          </div>
          <script>
            (function(){
              var search=document.getElementById('addProductSearch'), list=document.getElementById('addProductList');
              if(!search || !list) return;
              search.oninput=search.onkeyup=function(){
                var q=(this.value||'').toLowerCase();
                [].forEach.call(list.querySelectorAll('.add-product-row'), function(row){
                  var text=(row.getAttribute('data-name')||'').toLowerCase();
                  row.style.display=!q || text.indexOf(q)>=0 ? '' : 'none';
                });
              };
            })();
          </script>
        </div>
        ` : ""}
      `;
        res.type("text/html").send(notionPage("品項歸倉", body, "inv-assign", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/inventory/assign/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const whId = (req.body.warehouse_id || "").trim();
        const productId = (req.body.product_id || "").trim();
        if (!whId || !productId) {
            res.redirect("/admin/inventory/assign?err=missing");
            return;
        }
        const maxSort = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort FROM inventory_warehouse_products WHERE warehouse_id = ?").get(whId);
        const nextSort = (maxSort && maxSort.next_sort != null) ? maxSort.next_sort : 0;
        try {
            await db.prepare("INSERT INTO inventory_warehouse_products (warehouse_id, product_id, sort_order, safety_stock) VALUES (?, ?, ?, 0)").run(whId, productId, nextSort);
        }
        catch (_) { /* already in warehouse */ }
        res.redirect("/admin/inventory/assign?warehouse_id=" + encodeURIComponent(whId) + "&ok=1");
    });
    router.post("/inventory/assign/update-settings", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const whId = (req.body.warehouse_id || "").trim();
        if (!whId) {
            res.redirect("/admin/inventory/assign?err=missing");
            return;
        }
        const inWarehouse = await db.prepare("SELECT product_id FROM inventory_warehouse_products WHERE warehouse_id = ?").all(whId);
        for (const row of inWarehouse) {
            const pid = row.product_id;
            const sortVal = req.body["sort_" + pid];
            const safetyVal = req.body["safety_" + pid];
            const sortOrder = sortVal !== undefined && sortVal !== "" ? parseInt(String(sortVal), 10) : null;
            const safetyStock = safetyVal !== undefined && safetyVal !== "" ? parseFloat(String(safetyVal)) : null;
            if (sortOrder !== null && !Number.isNaN(sortOrder))
                await db.prepare("UPDATE inventory_warehouse_products SET sort_order = ? WHERE warehouse_id = ? AND product_id = ?").run(sortOrder, whId, pid);
            if (safetyStock !== null && !Number.isNaN(safetyStock))
                await db.prepare("UPDATE inventory_warehouse_products SET safety_stock = ? WHERE warehouse_id = ? AND product_id = ?").run(safetyStock, whId, pid);
        }
        res.redirect("/admin/inventory/assign?warehouse_id=" + encodeURIComponent(whId) + "&ok=settings");
    });
    router.post("/inventory/assign/remove", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const whId = (req.body.warehouse_id || "").trim();
        const productId = (req.body.product_id || "").trim();
        if (whId && productId)
            await db.prepare("DELETE FROM inventory_warehouse_products WHERE warehouse_id = ? AND product_id = ?").run(whId, productId);
        res.redirect("/admin/inventory/assign?warehouse_id=" + encodeURIComponent(whId || "") + "&ok=remove");
    });
    router.get("/inventory/daily", async (req, res) => {
        const date = req.query.date?.trim() || new Date().toISOString().slice(0, 10);
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const whId = req.query.warehouse_id?.trim() || (warehouses[0] && warehouses[0].id) || "";
        let products = [];
        let existing = null;
        if (whId) {
            products = await db.prepare("SELECT pwp.product_id, pwp.sort_order, p.name, p.unit FROM inventory_warehouse_products pwp JOIN products p ON p.id = pwp.product_id WHERE pwp.warehouse_id = ? ORDER BY pwp.sort_order, p.name").all(whId);
            const rec = await db.prepare("SELECT id, filler_name, items, confirmed_at FROM daily_inventory WHERE record_date = ? AND warehouse_id = ?").get(date, whId);
            existing = rec;
        }
        const itemsJson = existing && existing.items ? (typeof existing.items === "string" ? JSON.parse(existing.items || "{}") : existing.items) : {};
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存盤點。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 每日盤點</div>
        <h1 class="notion-page-title">每日盤點</h1>
        ${msg}
        <form method="get" action="/admin/inventory/daily" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <label>日期 <input type="date" name="date" value="${escapeAttr(date)}"></label>
          <label>庫房 <select name="warehouse_id" onchange="this.form.submit()">${optWh || "<option value=\"\">— 請先新增庫房並品項歸倉 —</option>"}</select></label>
          <button type="submit" class="btn">查詢</button>
        </form>
        ${whId && products.length ? `
        <div class="notion-card">
          <form method="post" action="/admin/inventory/daily/save">
            <input type="hidden" name="record_date" value="${escapeAttr(date)}">
            <input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}">
            <label>填表人 <input type="text" name="filler_name" value="${escapeAttr(existing?.filler_name || "")}" placeholder="填表人姓名"></label>
            <table>
              <thead><tr><th>品項</th><th>單位</th><th>數量</th></tr></thead>
              <tbody>
                ${products.map((p) => {
            const qty = itemsJson[p.product_id] != null ? itemsJson[p.product_id] : "";
            return `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.unit || "")}</td><td><input type="text" inputmode="decimal" name="qty_${escapeAttr(p.product_id)}" value="${escapeAttr(String(qty))}" placeholder="0"></td></tr>`;
        }).join("")}
              </tbody>
            </table>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存盤點</button></p>
          </form>
          ${existing?.confirmed_at ? "<p class=\"notion-msg ok\">此筆已確認。</p>" : ""}
        </div>
        ` : whId ? "<p class=\"notion-msg err\">此庫房尚無品項，請先至「品項歸倉」將品項加入此庫房。</p>" : ""}
      `;
        res.type("text/html").send(notionPage("每日盤點", body, "inv-daily", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/inventory/daily/save", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const recordDate = (req.body.record_date || "").trim();
        const warehouseId = (req.body.warehouse_id || "").trim();
        const fillerName = (req.body.filler_name || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || !warehouseId) {
            res.redirect("/admin/inventory/daily?err=date");
            return;
        }
        const items = {};
        for (const [k, v] of Object.entries(req.body)) {
            if (k.startsWith("qty_") && v !== "" && v !== undefined) {
                const productId = k.slice(4);
                const num = parseFloat(String(v).trim());
                if (!Number.isNaN(num))
                    items[productId] = num;
                else
                    items[productId] = String(v).trim();
            }
        }
        const id = recordDate + "_" + warehouseId;
        const now = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        const itemsStr = JSON.stringify(items);
        const existing = await db.prepare("SELECT id FROM daily_inventory WHERE record_date = ? AND warehouse_id = ?").get(recordDate, warehouseId);
        if (existing) {
            await db.prepare("UPDATE daily_inventory SET filler_name = ?, recorded_at = " + now + ", items = ? WHERE id = ?").run(fillerName || "—", itemsStr, existing.id);
        }
        else {
            await db.prepare("INSERT INTO daily_inventory (id, record_date, warehouse_id, filler_name, recorded_at, items) VALUES (?, ?, ?, ?, " + now + ", ?)").run(id, recordDate, warehouseId, fillerName || "—", itemsStr);
        }
        res.redirect("/admin/inventory/daily?date=" + encodeURIComponent(recordDate) + "&warehouse_id=" + encodeURIComponent(warehouseId) + "&ok=1");
    });
    router.get("/inventory/import-erp", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}">${escapeHtml(w.name)}</option>`).join("");
        const count = req.query.count ? Number(req.query.count) : 0;
        const msg = req.query.ok ? "<p class=\"notion-msg ok\">已匯入 ERP 資料" + (count ? "，共 " + count + " 筆。" : "。") + "</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 匯入 ERP 資料</div>
        <h1 class="notion-page-title">匯入 ERP 銷貨資料</h1>
        ${msg}
        <p>上傳 CSV 或貼上內容，格式：<strong>日期,品項,銷貨數量,倉庫</strong>。日期為 YYYY-MM-DD；品項為品項 ID 或品名；倉庫為倉庫 ID 或名稱（可省略則需於下方選擇預設倉庫）。</p>
        <div class="notion-card">
          <form method="post" action="/admin/inventory/import-erp" enctype="multipart/form-data">
            <label>預設倉庫（當 CSV 未含倉庫欄時使用） <select name="default_warehouse_id">${optWh || "<option value=\"\">— 請先新增庫房 —</option>"}</select></label>
            <label>CSV 檔案 <input type="file" name="csv_file" accept=".csv,.txt"></label>
            <p>或貼上 CSV 內容：</p>
            <textarea name="csv_text" rows="10" style="width:100%;" placeholder="日期,品項,銷貨數量,倉庫"></textarea>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">匯入</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("匯入 ERP 資料", body, "inv-erp", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    const multer = require("multer");
    const uploadMemory = multer({ storage: multer.memoryStorage() });
    router.post("/inventory/import-erp", uploadMemory.single("csv_file"), async (req, res) => {
        const body = req.body || {};
        const defaultWhId = body.default_warehouse_id ? String(body.default_warehouse_id).trim() : "";
        let raw = "";
        if (body.csv_text)
            raw = String(body.csv_text).trim();
        else if (req.file && req.file.buffer)
            raw = req.file.buffer.toString("utf-8");
        if (!raw) {
            res.redirect("/admin/inventory/import-erp?err=no_data");
            return;
        }
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses").all();
        const whById = Object.fromEntries(warehouses.map((w) => [w.id, w]));
        const whByName = Object.fromEntries(warehouses.map((w) => [w.name, w]));
        const products = await db.prepare("SELECT id, name FROM products").all();
        const productById = Object.fromEntries(products.map((p) => [p.id, p]));
        const productByName = Object.fromEntries(products.map((p) => [p.name, p]));
        const now = process.env.DATABASE_URL ? new Date().toISOString() : new Date().toISOString();
        const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        let imported = 0;
        for (let i = 0; i < lines.length; i++) {
            const cells = lines[i].split(",").map((c) => c.trim());
            if (cells.length < 3)
                continue;
            const dateStr = cells[0];
            const productKey = cells[1];
            const qty = parseFloat(cells[2]);
            const whKey = cells[3];
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || Number.isNaN(qty))
                continue;
            const product = productById[productKey] || productByName[productKey];
            const wh = (whKey && (whById[whKey] || whByName[whKey])) || (defaultWhId && whById[defaultWhId]);
            if (!product || !wh)
                continue;
            const wid = wh.id;
            const pid = product.id;
            const id = (0, id_js_1.newId)("erp");
            try {
                await db.prepare("INSERT INTO erp_sales (id, record_date, warehouse_id, product_id, qty_sold, imported_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, dateStr, wid, pid, qty, now);
                imported++;
            }
            catch (_) { /* duplicate or constraint */ }
        }
        res.redirect("/admin/inventory/import-erp?ok=1&count=" + imported);
    });
    router.get("/inventory/variance-report", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const dateFrom = (req.query.date_from || "").trim();
        const dateTo = (req.query.date_to || "").trim();
        const whId = (req.query.warehouse_id || "").trim();
        const exportCsv = req.query.export === "csv";
        let rows = [];
        let freqList = [];
        if (dateFrom && dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
            const from = new Date(dateFrom);
            const to = new Date(dateTo);
            if (from <= to) {
                const warehouseIds = whId ? [whId] : warehouses.map((w) => w.id);
                const productNames = {};
                const whNames = {};
                warehouses.forEach((w) => { whNames[w.id] = w.name; });
                const prods = await db.prepare("SELECT id, name FROM products").all();
                prods.forEach((p) => { productNames[p.id] = p.name; });
                const varianceCount = {};
                for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().slice(0, 10);
                    for (const wid of warehouseIds) {
                        const prevRec = await db.prepare("SELECT items FROM daily_inventory WHERE warehouse_id = ? AND record_date < ? ORDER BY record_date DESC LIMIT 1").get(wid, dateStr);
                        const currRec = await db.prepare("SELECT items FROM daily_inventory WHERE warehouse_id = ? AND record_date = ?").get(wid, dateStr);
                        const erpRows = await db.prepare("SELECT product_id, SUM(qty_sold) as total FROM erp_sales WHERE warehouse_id = ? AND record_date = ? GROUP BY product_id").all(wid, dateStr);
                        const erpByProduct = Object.fromEntries((erpRows || []).map((r) => [r.product_id, Number(r.total) || 0]));
                        const prevItems = prevRec && prevRec.items ? (typeof prevRec.items === "string" ? JSON.parse(prevRec.items || "{}") : prevRec.items) : {};
                        const currItems = currRec && currRec.items ? (typeof currRec.items === "string" ? JSON.parse(currRec.items || "{}") : currRec.items) : {};
                        const allProductIds = new Set([...Object.keys(prevItems), ...Object.keys(currItems), ...Object.keys(erpByProduct)]);
                        for (const pid of allProductIds) {
                            const prevQty = Number(prevItems[pid]) || 0;
                            const currQty = currItems[pid] != null ? Number(currItems[pid]) : null;
                            const erpQty = erpByProduct[pid] || 0;
                            const book = prevQty - erpQty;
                            if (currQty === null)
                                continue;
                            const variance = currQty - book;
                            if (Math.abs(variance) > 1e-6) {
                                rows.push({ date: dateStr, warehouse_id: wid, warehouse_name: whNames[wid] || wid, product_id: pid, product_name: productNames[pid] || pid, book, curr: currQty, variance });
                                varianceCount[pid] = (varianceCount[pid] || 0) + 1;
                            }
                        }
                    }
                }
                freqList = Object.entries(varianceCount).sort((a, b) => b[1] - a[1]).map(([pid, count]) => ({ product_id: pid, product_name: productNames[pid] || pid, count }));
            }
        }
        if (exportCsv && rows.length) {
            const BOM = "\uFEFF";
            const csv = BOM + "日期,倉庫,品項,帳面數量,盤點數量,盤差\n" + rows.map((r) => [r.date, r.warehouse_name, r.product_name, r.book, r.curr, r.variance].join(",")).join("\n");
            res.type("text/csv").set("Content-Disposition", "attachment; filename=variance-report.csv").send(csv);
            return;
        }
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 盤差報表</div>
        <h1 class="notion-page-title">盤差報表</h1>
        <p>依日期區間與倉庫計算盤差（盤點數量 − 帳面數量，帳面 = 前日盤點 − 當日 ERP 銷貨）。可匯出 CSV，並檢視易盤差品項統計。</p>
        <div class="notion-card">
          <form method="get" action="/admin/inventory/variance-report" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <label>日期起 <input type="date" name="date_from" value="${escapeAttr(dateFrom)}"></label>
            <label>日期訖 <input type="date" name="date_to" value="${escapeAttr(dateTo)}"></label>
            <label>倉庫 <select name="warehouse_id"><option value="">全部</option>${optWh}</select></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          ${rows.length ? `<p><a href="/admin/inventory/variance-report?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&warehouse_id=${encodeURIComponent(whId)}&export=csv" class="btn btn-primary">匯出 CSV（${rows.length} 筆）</a></p>` : ""}
          <h3>易盤差品項（區間內出現盤差次數）</h3>
          ${freqList.length ? `<table><thead><tr><th>品項</th><th>盤差次數</th></tr></thead><tbody>${freqList.map((f) => `<tr><td>${escapeHtml(f.product_name)}</td><td>${f.count}</td></tr>`).join("")}</tbody></table>` : "<p>請選擇日期區間並查詢。</p>"}
          <h3>盤差明細</h3>
          ${rows.length ? `<table><thead><tr><th>日期</th><th>倉庫</th><th>品項</th><th>帳面</th><th>盤點</th><th>盤差</th></tr></thead><tbody>${rows.slice(0, 500).map((r) => `<tr><td>${r.date}</td><td>${escapeHtml(r.warehouse_name)}</td><td>${escapeHtml(r.product_name)}</td><td>${r.book}</td><td>${r.curr}</td><td style="color:${r.variance !== 0 ? "#c00" : ""}">${r.variance}</td></tr>`).join("")}</tbody></table>${rows.length > 500 ? "<p>僅顯示前 500 筆，請用匯出 CSV 取得完整資料。</p>" : ""}` : "<p>請選擇日期區間並查詢。</p>"}
        </div>
      `;
        res.type("text/html").send(notionPage("盤差報表", body, "inv-report", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/inventory/manager", async (req, res) => {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("inventory_manager");
        const current = (row && row.value) || "";
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存管理人。</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 管理人設定</div>
        <h1 class="notion-page-title">盤點作業管理人</h1>
        ${msg}
        <div class="notion-card">
          <form method="post" action="/admin/inventory/manager">
            <label>管理人姓名 <input type="text" name="manager_name" value="${escapeAttr(current)}" placeholder="例：王小明"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("管理人設定", body, "inv-manager", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/inventory/manager", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = (req.body.manager_name || "").trim();
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("inventory_manager", name);
        res.redirect("/admin/inventory/manager?ok=1");
    });
    function parseFridgeEntriesJson(entriesJson) {
        if (!entriesJson)
            return [];
        try {
            return typeof entriesJson === "string" ? JSON.parse(entriesJson) : entriesJson;
        }
        catch (_) {
            return [];
        }
    }
    // ---------- 物流工具：訂單整理 ----------
    router.get("/logistics/orders", async (req, res) => {
        const dateFrom = req.query.from?.trim() || new Date().toISOString().slice(0, 10);
        const dateTo = req.query.to?.trim() || dateFrom;
        const orders = await db.prepare(`
      SELECT id, order_date, raw_message, memo, created_at FROM logistics_orders
      WHERE order_date >= ? AND order_date <= ?
      ORDER BY order_date DESC, id DESC LIMIT 500
    `).all(dateFrom, dateTo);
        const rows = orders.length === 0
            ? "<tr><td colspan='4'>此區間無紙本訂單</td></tr>"
            : orders.map((o) => `<tr><td>${escapeHtml(o.order_date)}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml((o.raw_message || "").slice(0, 60))}${(o.raw_message || "").length > 60 ? "…" : ""}</td><td>${escapeHtml(o.memo || "—")}</td><td><a href="/admin/logistics/orders/${encodeURIComponent(o.id)}">檢視／編輯</a></td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 物流工具 / 訂單整理</div>
        <h1 class="notion-page-title">訂單整理（紙本訂單）</h1>
        ${req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存訂單。</p>" : ""}
        <p>整理紙本訂單：上傳圖片或貼上文字後由 Google AI 辨識，預覽調整後儲存。可依日期查詢。</p>
        <p><a href="/admin/logistics/orders/new" class="btn btn-primary">＋ 新增一筆訂單</a>　<a href="/admin/logistics/procurement" class="btn">採購分析</a></p>
        <div class="notion-card">
          <form method="get" action="/admin/logistics/orders" style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:12px;">
            <label>日期區間 <input type="date" name="from" value="${escapeAttr(dateFrom)}"> ～ <input type="date" name="to" value="${escapeAttr(dateTo)}"></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          <table>
            <thead><tr><th>訂單日期</th><th>原始內容摘要</th><th>備註</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("訂單整理", body, "logistics", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/logistics/orders/new", async (_req, res) => {
        const today = new Date().toISOString().slice(0, 10);
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/logistics/orders">訂單整理</a> / 新增</div>
        <h1 class="notion-page-title">新增紙本訂單</h1>
        <p>貼上訂單文字，或上傳訂單照片，由 Google AI 辨識後預覽品項、可調整再儲存。</p>
        <div class="notion-card">
          <form id="newOrderForm" method="post" action="/admin/logistics/orders">
            <label>訂單日期 <input type="date" name="order_date" value="${escapeAttr(today)}" required></label>
            <p style="margin-top:12px;"><label>原始文字（貼上紙本內容或辨識結果）</label><br>
            <textarea name="raw_message" id="rawMessage" rows="6" style="width:100%;box-sizing:border-box;" placeholder="例如：高麗菜 5 斤&#10;大陸妹 2 把&#10;芹菜 3 包"></textarea></p>
            <p>或上傳圖片：<input type="file" name="image" id="imageFile" accept="image/*"></p>
            <button type="button" id="recognizeBtn" class="btn btn-primary">以 Google AI 辨識（圖片或上方文字）</button>
            <div id="recognizeErr" style="color:#c00;margin-top:8px;display:none;"></div>
          </form>
        </div>
        <div class="notion-card" id="previewBlock" style="display:none;">
          <h2>預覽品項（可調整後再儲存）</h2>
          <p>確認下方列表無誤後，按「儲存訂單」寫入；若有待確認品名可至「待確認品名」補對照。<br>金額可手動填寫，或依「訂單日期」帶入<strong>台北果菜市場（台北一、台北二）</strong>批發行情（農業部農產品交易行情，平均價 元/公斤）作為參考。</p>
          <p style="margin-bottom:8px;"><button type="button" id="fillWholesaleBtn" class="btn">帶入台北批發價</button> <span id="wholesaleMsg" style="font-size:13px;color:var(--notion-text-muted);"></span></p>
          <table id="previewTable"><thead><tr><th>品名</th><th>數量</th><th>單位</th><th>金額（元/公斤）</th><th>對應品項</th></tr></thead><tbody></tbody></table>
          <input type="hidden" name="items_json" id="itemsJson" form="newOrderForm">
          <p style="margin-top:12px;"><button type="button" id="saveOrderBtn" class="btn btn-primary">儲存訂單</button> <a href="/admin/logistics/orders" class="btn">取消</a></p>
        </div>
        <script>
        (function(){
          var form = document.getElementById('newOrderForm');
          var rawMessage = document.getElementById('rawMessage');
          var imageFile = document.getElementById('imageFile');
          var recognizeBtn = document.getElementById('recognizeBtn');
          var recognizeErr = document.getElementById('recognizeErr');
          var previewBlock = document.getElementById('previewBlock');
          var previewTable = document.getElementById('previewTable').querySelector('tbody');
          var itemsJson = document.getElementById('itemsJson');
          var saveOrderBtn = document.getElementById('saveOrderBtn');
          var currentItems = [];
          function showErr(msg){ recognizeErr.textContent = msg || ''; recognizeErr.style.display = msg ? 'block' : 'none'; }
          function renderPreview(){
            previewTable.innerHTML = currentItems.map(function(it, i){
              return '<tr><td><input type="text" value="' + (it.rawName || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="rawName" style="width:100%;max-width:180px;"></td><td><input type="number" value="' + (it.quantity ?? '') + '" data-i="' + i + '" data-f="quantity" step="any" min="0" style="width:80px;"></td><td><input type="text" value="' + (it.unit || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="unit" style="width:60px;"></td><td><input type="text" value="' + (it.amount || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="amount" placeholder="可空白" style="width:80px;"></td><td>' + (it.productName || '待確認') + '</td></tr>';
            }).join('');
            previewTable.querySelectorAll('input').forEach(function(inp){
              inp.addEventListener('change', function(){ var i = parseInt(this.getAttribute('data-i'),10); var f = this.getAttribute('data-f'); if(currentItems[i]) currentItems[i][f] = this.value; if(f==='quantity') currentItems[i].quantity = parseFloat(this.value)||0; });
            });
            itemsJson.value = JSON.stringify(currentItems);
          }
          recognizeBtn.addEventListener('click', function(){
            showErr('');
            var text = rawMessage.value.trim();
            var file = imageFile.files[0];
            if (!text && !file) { showErr('請貼上文字或選擇一張圖片'); return; }
            recognizeBtn.disabled = true;
            recognizeBtn.textContent = '辨識中…';
            var formData = new FormData();
            formData.append('raw_message', text);
            if (file) formData.append('image', file);
            fetch('/admin/api/logistics/recognize', { method: 'POST', body: formData })
              .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }).catch(function(){ return { ok: false, data: { error: '伺服器回傳格式錯誤' } }; }); })
              .then(function(result){
                recognizeBtn.disabled = false;
                recognizeBtn.textContent = '以 Google AI 辨識（圖片或上方文字）';
                if (!result.ok || result.data.error) { showErr(result.data.error || '辨識失敗'); return; }
                if (result.data.raw_message) rawMessage.value = result.data.raw_message;
                currentItems = result.data.items || [];
                renderPreview();
                previewBlock.style.display = 'block';
              })
              .catch(function(){ recognizeBtn.disabled = false; recognizeBtn.textContent = '以 Google AI 辨識（圖片或上方文字）'; showErr('辨識請求失敗（請檢查網路或稍後再試）'); });
          });
          saveOrderBtn.addEventListener('click', function(){
            itemsJson.value = JSON.stringify(currentItems);
            form.submit();
          });
          var fillWholesaleBtn = document.getElementById('fillWholesaleBtn');
          var wholesaleMsg = document.getElementById('wholesaleMsg');
          if (fillWholesaleBtn) fillWholesaleBtn.addEventListener('click', function(){
            var orderDate = document.querySelector('#newOrderForm input[name="order_date"]');
            var date = orderDate ? orderDate.value : new Date().toISOString().slice(0, 10);
            if (!date) { wholesaleMsg.textContent = '請先選擇訂單日期'; return; }
            wholesaleMsg.textContent = '取得批發行情中…';
            fillWholesaleBtn.disabled = true;
            fetch('/admin/api/logistics/wholesale-prices?date=' + encodeURIComponent(date))
              .then(function(r){ return r.json(); })
              .then(function(data){
                fillWholesaleBtn.disabled = false;
                if (data.error) { wholesaleMsg.textContent = data.error; return; }
                var prices = data.prices || [];
                if (prices.length === 0) { wholesaleMsg.textContent = data.message || '該日尚無台北批發行情'; return; }
                var normalized = function(s){ return (s || '').toString().trim().replace(/\s+/g, ''); };
                var matched = 0;
                currentItems.forEach(function(it){
                  var name = normalized(it.rawName || it.productName || '');
                  if (!name) return;
                  var found = null;
                  for (var i = 0; i < prices.length; i++) {
                    var crop = normalized(prices[i].cropName || '');
                    if (crop === name || crop.indexOf(name) !== -1 || name.indexOf(crop) !== -1) { found = prices[i]; break; }
                  }
                  if (!found && name.length >= 2) {
                    for (var j = 0; j < prices.length; j++) {
                      if (normalized(prices[j].cropName || '').slice(0, 2) === name.slice(0, 2)) { found = prices[j]; break; }
                    }
                  }
                  if (found && found.avgPrice != null) {
                    it.amount = String(found.avgPrice);
                    matched++;
                  }
                });
                renderPreview();
                wholesaleMsg.textContent = '已帶入 ' + matched + ' 筆台北批發均價（元/公斤），共 ' + prices.length + ' 筆行情。';
              })
              .catch(function(){
                fillWholesaleBtn.disabled = false;
                wholesaleMsg.textContent = '取得批發行情失敗，請稍後再試。';
              });
          });
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("新增紙本訂單", body, "logistics", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/logistics/market", async (req, res) => {
        const dateStr = (req.query.date || "").toString().trim() || new Date().toISOString().slice(0, 10);
        let prices = [];
        let msg = "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            try {
                prices = (await (0, wholesale_price_js_1.fetchTaipeiWholesalePrices)(dateStr)) || [];
                if (!prices.length)
                    msg = "該日尚無台北果菜市場（台北一、台北二）行情。";
            }
            catch (e) {
                msg = "讀取行情失敗，請稍後再試。";
            }
        }
        else {
            msg = "日期格式錯誤，請使用 YYYY-MM-DD。";
        }
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_price_prefix_rules");
        const rulesText = row?.value || JSON.stringify({ "*": 2, LM: 10 }, null, 2);
        const rows = prices.slice(0, 300).map((p) => `<tr><td>${escapeHtml(p.marketName || "")}</td><td>${escapeHtml(p.cropName || "")}</td><td>${p.highPrice ?? "—"}</td><td>${p.midPrice ?? "—"}</td><td>${p.lowPrice ?? "—"}</td><td>${p.avgPrice ?? "—"}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 物流工具 / 北農行情</div>
        <h1 class="notion-page-title">北農行情（台北一、台北二）</h1>
        ${req.query.ok === "1" ? '<p class="notion-msg ok">已儲存加價規則。</p>' : ""}
        ${req.query.err === "rules" ? '<p class="notion-msg err">規則格式錯誤，請輸入 JSON 物件。</p>' : ""}
        <form method="get" action="/admin/logistics/market" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <label>日期 <input type="date" name="date" value="${escapeAttr(dateStr)}"></label>
          <button type="submit" class="btn">查詢</button>
        </form>
        ${msg ? `<p class="notion-msg warn">${escapeHtml(msg)}</p>` : ""}
        <div class="notion-card">
          <table><thead><tr><th>市場</th><th>作物</th><th>上價</th><th>中價</th><th>下價</th><th>平均價</th></tr></thead><tbody>${rows || "<tr><td colspan='6'>無資料</td></tr>"}</tbody></table>
        </div>
        <div class="notion-card" style="margin-top:16px;">
          <h2 style="margin-top:0;">LINE 報價加價規則</h2>
          <p style="font-size:13px;color:var(--notion-text-muted);">格式為 JSON，key 為 ERP 料號前綴、value 為加價。<code>*</code> 代表預設。例：<code>{"*":2,"LM":10}</code>。</p>
          <form method="post" action="/admin/logistics/market/rules">
            <textarea name="rules_json" rows="8" style="width:100%;box-sizing:border-box;">${escapeHtml(rulesText)}</textarea>
            <p style="margin-top:8px;"><button type="submit" class="btn btn-primary">儲存規則</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("北農行情", body, "logistics-market", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/logistics/market/rules", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const txt = String(req.body?.rules_json || "").trim();
        try {
            const j = JSON.parse(txt || "{}");
            if (!j || typeof j !== "object")
                throw new Error("規則必須是 JSON 物件");
            const normalized = {};
            for (const [k, v] of Object.entries(j)) {
                const n = Number(v);
                if (!Number.isFinite(n))
                    continue;
                normalized[String(k).toUpperCase()] = n;
            }
            if (normalized["*"] == null)
                normalized["*"] = 2;
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_price_prefix_rules", JSON.stringify(normalized));
            res.redirect("/admin/logistics/market?ok=1");
        }
        catch (_e) {
            res.redirect("/admin/logistics/market?err=rules");
        }
    });
    async function parseOrderWithGemini(rawText) {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey || !apiKey.trim())
            return null;
        const prompt = `你是一位生鮮／蔬果訂單解析助理。請從以下訂單文字解析出每一筆品項，以 JSON 陣列回傳，每筆格式：{ "品項": "品名", "數量": 數字, "單位": "單位或空字串", "金額": "金額數字或空字串（沒有就空白）" }。只回傳一個 JSON 陣列，不要 markdown、不要其他說明。\n\n訂單文字：\n${rawText}`;
        try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 2048 },
                }),
            });
            if (!resp.ok)
                return null;
            const data = await resp.json();
            const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textPart || typeof textPart !== "string")
                return null;
            const cleaned = textPart.replace(/^[\s\S]*?\[/, "[").replace(/\][\s\S]*$/, "]").trim();
            const arr = JSON.parse(cleaned);
            if (!Array.isArray(arr) || arr.length === 0)
                return null;
            return arr.map((row) => ({
                rawName: (row.品項 ?? row.rawName ?? "").toString().trim() || "",
                quantity: typeof row.數量 === "number" ? row.數量 : parseFloat(row.數量) || 0,
                unit: (row.單位 ?? row.unit ?? "").toString().trim() || null,
                amount: row.金額 != null && String(row.金額).trim() !== "" ? String(row.金額).trim() : null,
            })).filter((x) => x.rawName);
        }
        catch (_) {
            return null;
        }
    }
    router.post("/api/logistics/recognize", uploadImage, async (req, res) => {
        let rawText = (req.body && req.body.raw_message) ? String(req.body.raw_message).trim() : "";
        const file = req.file;
        if (file && file.buffer) {
            const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
            if (!apiKey || !apiKey.trim()) {
                res.status(503).json({ error: "請設定 GOOGLE_CLOUD_VISION_API_KEY 才能辨識圖片。本機開發：在專案目錄建立或編輯 .env 檔案，加入一行 GOOGLE_CLOUD_VISION_API_KEY=你的金鑰，重啟後即可。Cloud Run：在「變數與密碼」設定該變數。金鑰請至 GCP 專案啟用「Cloud Vision API」後取得。" });
                return;
            }
            const ocrText = await (0, vision_ocr_js_1.getTextFromImageBuffer)(file.buffer);
            if (ocrText)
                rawText = (rawText ? rawText + "\n" : "") + ocrText;
            else if (file.buffer.length > 0)
                rawText = (rawText ? rawText + "\n" : "") + "(圖片辨識無結果：請確認 GCP 已啟用 Cloud Vision API、金鑰正確，且圖片內有清晰文字)";
        }
        if (!rawText || !rawText.trim()) {
            res.status(400).json({ error: "無法取得文字（請貼上內容或上傳可辨識的圖片；若已上傳圖片仍無結果，請檢查 GOOGLE_CLOUD_VISION_API_KEY 與 Cloud Vision API 是否已啟用）。" });
            return;
        }
        let parsed = await parseOrderWithGemini(rawText);
        if (!parsed || parsed.length === 0) {
            const ruleBased = (0, parse_order_message_js_1.parseOrderMessage)(rawText);
            parsed = ruleBased.map((p) => ({ rawName: p.rawName, quantity: p.quantity, unit: p.unit || null, amount: null }));
        }
        const items = [];
        for (const p of parsed) {
            const resolved = await (0, resolve_product_js_1.resolveProductName)(db, p.rawName, null);
            items.push({
                rawName: p.rawName,
                quantity: p.quantity,
                unit: p.unit || null,
                amount: p.amount ?? null,
                productId: resolved?.productId ?? null,
                productName: resolved?.productId ? (resolved.name || null) : null,
                needReview: resolved ? 0 : 1,
            });
        }
        res.json({ raw_message: rawText, items });
    });
    router.get("/api/logistics/wholesale-prices", async (req, res) => {
        const dateStr = (req.query.date || "").toString().trim() || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            res.status(400).json({ error: "請提供有效日期參數 date（YYYY-MM-DD）。" });
            return;
        }
        try {
            const prices = await (0, wholesale_price_js_1.fetchTaipeiWholesalePrices)(dateStr);
            if (!prices || prices.length === 0) {
                res.json({ prices: [], message: "該日尚無台北果菜市場（台北一、台北二）批發行情，可能為休市或資料尚未更新。" });
                return;
            }
            res.json({ prices });
        }
        catch (e) {
            console.error("[admin] 批發行情取得失敗:", e?.message || e);
            res.status(500).json({ error: "無法取得批發行情，請稍後再試。" });
        }
    });
    router.post("/logistics/orders", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const orderDate = (req.body.order_date || "").trim();
        const rawMessage = (req.body.raw_message || "").trim();
        let items = [];
        try {
            const j = req.body.items_json;
            if (j)
                items = JSON.parse(j);
        }
        catch (_) { }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
            res.redirect("/admin/logistics/orders/new?err=date");
            return;
        }
        const orderId = (0, id_js_1.newId)("log");
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare("INSERT INTO logistics_orders (id, order_date, raw_message, created_at) VALUES (?, ?, ?, " + nowSql + ")").run(orderId, orderDate, rawMessage);
        for (const it of items) {
            const itemId = (0, id_js_1.newId)("logitem");
            const qty = parseFloat(it.quantity);
            const needReview = it.needReview === 1 || it.needReview === true ? 1 : 0;
            const amountVal = it.amount != null && String(it.amount).trim() !== "" ? String(it.amount).trim() : null;
            await db.prepare("INSERT INTO logistics_order_items (id, order_id, product_id, raw_name, quantity, unit, amount, need_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(itemId, orderId, it.productId || null, it.rawName || "", Number.isFinite(qty) ? qty : 0, it.unit || null, amountVal, needReview);
        }
        res.redirect("/admin/logistics/orders?from=" + encodeURIComponent(orderDate) + "&to=" + encodeURIComponent(orderDate) + "&ok=1");
    });
    router.get("/logistics/orders/:id", async (req, res) => {
        const order = await db.prepare("SELECT id, order_date, raw_message, memo FROM logistics_orders WHERE id = ?").get(req.params.id);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.id, oi.raw_name, oi.quantity, oi.unit, oi.amount, oi.need_review, p.name AS product_name
      FROM logistics_order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
    `).all(order.id);
        const rows = items.map((i) => `<tr><td>${escapeHtml(i.raw_name ?? "")}</td><td>${i.quantity}</td><td>${escapeHtml((i.unit || "") + (i.need_review === 1 ? " [待確認]" : ""))}</td><td>${escapeHtml(i.amount ?? "—")}</td><td>${escapeHtml(i.product_name || "—")}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/logistics/orders">訂單整理</a> / 明細</div>
        <h1 class="notion-page-title">紙本訂單明細</h1>
        <p>日期：${escapeHtml(order.order_date)}　<a href="/admin/logistics/orders">← 回列表</a></p>
        <div class="notion-card raw-message-scroll"><h3 style="margin-top:0;">原始訂單</h3><pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);margin:0;font-size:13px;max-height:240px;overflow:auto;">${escapeHtml(order.raw_message || "")}</pre></div>
        <div class="notion-card">
          <table><thead><tr><th>品名</th><th>數量</th><th>單位</th><th>金額（元/公斤）</th><th>對應品項</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
      `;
        res.type("text/html").send(notionPage("訂單明細", body, "logistics", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/logistics/procurement", async (req, res) => {
        const dateFrom = req.query.from?.trim() || new Date().toISOString().slice(0, 10);
        const dateTo = req.query.to?.trim() || dateFrom;
        const rows = await db.prepare(`
      SELECT oi.raw_name, oi.unit, oi.product_id, p.name AS product_name, SUM(oi.quantity) AS total_qty
      FROM logistics_order_items oi
      LEFT JOIN logistics_orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.order_date >= ? AND o.order_date <= ?
      GROUP BY oi.product_id, oi.raw_name, oi.unit, p.name
      ORDER BY p.name, oi.raw_name, oi.unit
    `).all(dateFrom, dateTo);
        const tableRows = rows.length === 0
            ? "<tr><td colspan='4'>此區間無資料</td></tr>"
            : rows.map((r) => `<tr><td>${escapeHtml(r.product_name || r.raw_name || "待確認")}</td><td>${Number(r.total_qty)}</td><td>${escapeHtml(r.unit || "—")}</td><td>${escapeHtml(r.raw_name && !r.product_name ? "待對照" : "—")}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 物流工具 / 採購分析</div>
        <h1 class="notion-page-title">採購分析</h1>
        <p>依日期區間彙總「訂單整理」內紙本訂單，某日某品項需採購數量（供採購人員使用）。</p>
        <div class="notion-card">
          <form method="get" action="/admin/logistics/procurement" style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:12px;">
            <label>日期區間 <input type="date" name="from" value="${escapeAttr(dateFrom)}"> ～ <input type="date" name="to" value="${escapeAttr(dateTo)}"></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          <table>
            <thead><tr><th>品項</th><th>合計數量</th><th>單位</th><th>備註</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("採購分析", body, "logistics-procurement", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    // ---------- 環境衛生管理 ----------
    router.get("/freezer-fridge", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name").all();
        const month = req.query.month?.trim() || new Date().toISOString().slice(0, 7);
        const [y, m] = month.split("-").map(Number);
        const nextMonthFirst = m === 12 ? (y + 1) + "-01-01" : y + "-" + String(m + 1).padStart(2, "0") + "-01";
        const records = await db.prepare("SELECT date, filler_name, confirmed_at, anomaly FROM freezer_fridge_daily WHERE date >= ? AND date < ? ORDER BY date").all(month + "-01", nextMonthFirst);
        const recordByDate = {};
        records.forEach((r) => { recordByDate[r.date] = r; });
        const firstDay = new Date(y, m - 1, 1);
        const daysInMonth = new Date(y, m, 0).getDate();
        const calRows = [];
        let week = [];
        const startPad = firstDay.getDay();
        for (let i = 0; i < startPad; i++)
            week.push("");
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = month + "-" + String(d).padStart(2, "0");
            const rec = recordByDate[dateStr];
            week.push(rec ? `<a href="/admin/freezer-fridge/daily?date=${dateStr}" class="cal-day filled">${d}</a>` : `<a href="/admin/freezer-fridge/daily?date=${dateStr}" class="cal-day">${d}</a>`);
            if (week.length === 7) {
                calRows.push(week);
                week = [];
            }
        }
        if (week.length)
            calRows.push(week);
        const calHtml = "<table class=\"freezer-cal\"><thead><tr><th>日</th><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th></tr></thead><tbody>" + calRows.map((row) => "<tr>" + row.map((cell) => "<td>" + (cell || "") + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 環境衛生管理 / 冷凍庫冷藏庫檢查表</div>
        <h1 class="notion-page-title">冷凍庫冷藏庫檢查表</h1>
        <p style="color:var(--notion-text-muted);margin-bottom:16px;">每日填寫各庫房溫度、電源、電燈、電熱；請先至「庫房管理」新增庫房。</p>
        <p style="margin-bottom:16px;"><a href="/admin/freezer-fridge/warehouses" class="btn">庫房管理</a>（共 ${warehouses.length} 個庫房）</p>
        <div class="notion-card">
          <h2>${month} 月曆</h2>
          <form method="get" action="/admin/freezer-fridge" style="margin-bottom:12px;">
            <input type="month" name="month" value="${escapeAttr(month)}"> <button type="submit" class="btn">切換月份</button>
          </form>
          ${calHtml}
          <p style="margin-top:12px;font-size:13px;color:var(--notion-text-muted);">點選日期填寫當日檢查表。</p>
        </div>
        <div class="notion-card">
          <h2>當月填表紀錄</h2>
          ${records.length ? "<table><thead><tr><th>日期</th><th>填表人</th><th>狀態</th><th>操作</th></tr></thead><tbody>" + records.map((r) => `<tr><td>${r.date}</td><td>${escapeHtml(r.filler_name || "")}</td><td>${r.confirmed_at ? "已確認" : "已填"}${r.anomaly ? "、異常" : ""}</td><td><a href="/admin/freezer-fridge/daily?date=${r.date}">編輯</a></td></tr>`).join("") + "</tbody></table>" : "<p>本月尚無填表紀錄</p>"}
        </div>
      `;
        res.type("text/html").send(notionPage("冷凍庫冷藏庫檢查表", body + "\n<style>.freezer-cal td,.freezer-cal th{border:1px solid var(--notion-border);padding:8px;min-width:40px;}.freezer-cal .cal-day{display:block;text-align:center;text-decoration:none;color:var(--notion-accent);}.freezer-cal .cal-day.filled{font-weight:600;}</style>", "env", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/freezer-fridge/warehouses", async (req, res) => {
        const rows = await db.prepare("SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name").all();
        const msg = req.query.ok ? "<p class=\"notion-msg ok\">已儲存。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / 庫房管理</div>
        <h1 class="notion-page-title">冷凍／冷藏庫房設定</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/freezer-fridge/warehouses/new" class="btn btn-primary">＋ 新增庫房</a></p>
        <div class="notion-card">
          <table>
            <thead><tr><th>順序</th><th>庫房名稱</th><th>合規溫度</th><th>電源</th><th>電燈</th><th>電熱</th><th>操作</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => `<tr><td>${r.sort_order}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.compliant_temp || "")}</td><td>${r.power_compliant}</td><td>${r.light_compliant}</td><td>${r.heat_compliant}</td><td><a href="/admin/freezer-fridge/warehouses/${encodeURIComponent(r.id)}/edit">編輯</a> | <a href="/admin/freezer-fridge/warehouses/${encodeURIComponent(r.id)}/delete">刪除</a></td></tr>`).join("") : "<tr><td colspan=\"7\">尚無庫房</td></tr>"}
            </tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("冷凍冷藏庫房管理", body, "env", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/freezer-fridge/warehouses/new", async (_req, res) => {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / <a href="/admin/freezer-fridge/warehouses">庫房管理</a> / 新增</div>
        <h1 class="notion-page-title">新增庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/freezer-fridge/warehouses/new">
            <label>庫房名稱 <input type="text" name="name" required placeholder="例：9號冷凍庫"></label>
            <label>合規溫度 <input type="text" name="compliant_temp" placeholder="例：−18°C 以下 或 2~7"></label>
            <label>電源合規 <select name="power_compliant"><option value="on">正常為開</option><option value="off">正常為關</option></select></label>
            <label>電燈合規 <select name="light_compliant"><option value="off">應關閉</option><option value="on">應開啟</option></select></label>
            <label>電熱合規 <select name="heat_compliant"><option value="off">符合為關</option><option value="on">符合為開</option></select></label>
            <label>順序 <input type="number" name="sort_order" value="0"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button> <a href="/admin/freezer-fridge/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增庫房", body, "env", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/freezer-fridge/warehouses/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = (req.body.name || "").trim();
        const compliantTemp = (req.body.compliant_temp || "").trim();
        const powerCompliant = (req.body.power_compliant || "on").trim();
        const lightCompliant = (req.body.light_compliant || "off").trim();
        const heatCompliant = (req.body.heat_compliant || "off").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        if (!name) {
            res.redirect("/admin/freezer-fridge/warehouses/new?err=name");
            return;
        }
        const id = (0, id_js_1.newId)("ffwh");
        await db.prepare("INSERT INTO freezer_fridge_warehouses (id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, name, sortOrder, compliantTemp, powerCompliant, lightCompliant, heatCompliant);
        res.redirect("/admin/freezer-fridge/warehouses?ok=1");
    });
    router.get("/freezer-fridge/warehouses/:id/edit", async (req, res) => {
        const row = await db.prepare("SELECT * FROM freezer_fridge_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/freezer-fridge/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / <a href="/admin/freezer-fridge/warehouses">庫房管理</a> / 編輯</div>
        <h1 class="notion-page-title">編輯庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/freezer-fridge/warehouses/${encodeURIComponent(row.id)}/edit">
            <label>庫房名稱 <input type="text" name="name" value="${escapeAttr(row.name)}" required></label>
            <label>合規溫度 <input type="text" name="compliant_temp" value="${escapeAttr(row.compliant_temp || "")}"></label>
            <label>電源合規 <select name="power_compliant"><option value="on" ${row.power_compliant === "on" ? "selected" : ""}>正常為開</option><option value="off" ${row.power_compliant === "off" ? "selected" : ""}>正常為關</option></select></label>
            <label>電燈合規 <select name="light_compliant"><option value="off" ${row.light_compliant === "off" ? "selected" : ""}>應關閉</option><option value="on" ${row.light_compliant === "on" ? "selected" : ""}>應開啟</option></select></label>
            <label>電熱合規 <select name="heat_compliant"><option value="off" ${row.heat_compliant === "off" ? "selected" : ""}>符合為關</option><option value="on" ${row.heat_compliant === "on" ? "selected" : ""}>符合為開</option></select></label>
            <label>順序 <input type="number" name="sort_order" value="${row.sort_order}"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/freezer-fridge/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("編輯庫房", body, "env", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/freezer-fridge/warehouses/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const name = (req.body.name || "").trim();
        const compliantTemp = (req.body.compliant_temp || "").trim();
        const powerCompliant = (req.body.power_compliant || "on").trim();
        const lightCompliant = (req.body.light_compliant || "off").trim();
        const heatCompliant = (req.body.heat_compliant || "off").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        const row = await db.prepare("SELECT id FROM freezer_fridge_warehouses WHERE id = ?").get(id);
        if (!row || !name) {
            res.redirect("/admin/freezer-fridge/warehouses?err=name");
            return;
        }
        await db.prepare("UPDATE freezer_fridge_warehouses SET name = ?, sort_order = ?, compliant_temp = ?, power_compliant = ?, light_compliant = ?, heat_compliant = ? WHERE id = ?").run(name, sortOrder, compliantTemp, powerCompliant, lightCompliant, heatCompliant, id);
        res.redirect("/admin/freezer-fridge/warehouses?ok=1");
    });
    router.get("/freezer-fridge/warehouses/:id/delete", async (req, res) => {
        const row = await db.prepare("SELECT id, name FROM freezer_fridge_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/freezer-fridge/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / <a href="/admin/freezer-fridge/warehouses">庫房管理</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除</h1>
        <div class="notion-card"><p>確定要刪除「${escapeHtml(row.name)}」？<br><form method="post" action="/admin/freezer-fridge/warehouses/${encodeURIComponent(row.id)}/delete" style="display:inline;margin-top:12px;"><button type="submit" class="btn">確定刪除</button></form> <a href="/admin/freezer-fridge/warehouses" class="btn">取消</a></p></div>
      `;
        res.type("text/html").send(notionPage("確認刪除", body, "env", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/freezer-fridge/warehouses/:id/delete", async (req, res) => {
        await db.prepare("DELETE FROM freezer_fridge_warehouses WHERE id = ?").run(req.params.id);
        res.redirect("/admin/freezer-fridge/warehouses?ok=del");
    });
    router.get("/freezer-fridge/daily", async (req, res) => {
        const date = req.query.date?.trim() || new Date().toISOString().slice(0, 10);
        const warehouses = await db.prepare("SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name").all();
        const row = await db.prepare("SELECT * FROM freezer_fridge_daily WHERE date = ?").get(date);
        const entries = row ? parseFridgeEntriesJson(row.entries_json) : [];
        const entryByWh = {};
        entries.forEach((e) => { entryByWh[e.warehouseId] = e; });
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / 每日填報</div>
        <h1 class="notion-page-title">${date} 冷凍冷藏庫房檢查</h1>
        ${warehouses.length === 0 ? "<p class=\"notion-msg err\">請先至庫房管理新增庫房。</p>" : `
        <div class="notion-card">
          <form method="post" action="/admin/freezer-fridge/daily/save">
            <input type="hidden" name="date" value="${escapeAttr(date)}">
            <label>填表人 <input type="text" name="filler_name" value="${escapeAttr(row?.filler_name || "")}"></label>
            <table>
              <thead><tr><th>庫房</th><th>合規溫度</th><th>溫度</th><th>電源</th><th>電燈</th><th>電熱</th></tr></thead>
              <tbody>
                ${warehouses.map((w) => {
            const e = entryByWh[w.id] || { warehouseId: w.id, temp: "", powerOk: true, lightOff: true, heatOk: true };
            return `<tr>
              <td>${escapeHtml(w.name)}</td>
              <td>${escapeHtml(w.compliant_temp || "")}</td>
              <td><input type="text" name="temp_${escapeAttr(w.id)}" value="${escapeAttr(e.temp || "")}" placeholder="例：-18"></td>
              <td><select name="power_${escapeAttr(w.id)}"><option value="ok" ${e.powerOk ? "selected" : ""}>正常</option><option value="ng" ${!e.powerOk ? "selected" : ""}>異常</option></select></td>
              <td><select name="light_${escapeAttr(w.id)}"><option value="off" ${e.lightOff ? "selected" : ""}>關閉</option><option value="on" ${!e.lightOff ? "selected" : ""}>開啟</option></select></td>
              <td><select name="heat_${escapeAttr(w.id)}"><option value="ok" ${e.heatOk ? "selected" : ""}>符合</option><option value="ng" ${!e.heatOk ? "selected" : ""}>不符合</option></select></td>
            </tr>`;
        }).join("")}
              </tbody>
            </table>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/freezer-fridge?month=${encodeURIComponent(date.slice(0, 7))}" class="btn">返回月曆</a></p>
          </form>
        </div>
        `}
      `;
        res.type("text/html").send(notionPage(date + " 檢查表", body, "env", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/freezer-fridge/daily/save", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const date = (req.body.date || "").trim();
        const fillerName = (req.body.filler_name || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.redirect("/admin/freezer-fridge/daily?date=" + encodeURIComponent(date || new Date().toISOString().slice(0, 10)) + "&err=date");
            return;
        }
        const warehouses = await db.prepare("SELECT id FROM freezer_fridge_warehouses").all();
        const entries = warehouses.map((w) => {
            const temp = (req.body["temp_" + w.id] || "").trim();
            const power = req.body["power_" + w.id];
            const light = req.body["light_" + w.id];
            const heat = req.body["heat_" + w.id];
            return {
                warehouseId: w.id,
                temp,
                powerOk: power === "ok",
                lightOff: light === "off",
                heatOk: heat === "ok",
            };
        });
        const entriesJson = JSON.stringify(entries);
        const existing = await db.prepare("SELECT date FROM freezer_fridge_daily WHERE date = ?").get(date);
        if (existing) {
            await db.prepare("UPDATE freezer_fridge_daily SET entries_json = ?, filler_name = ? WHERE date = ?").run(entriesJson, fillerName || "—", date);
        }
        else {
            await db.prepare("INSERT INTO freezer_fridge_daily (date, entries_json, filler_name) VALUES (?, ?, ?)").run(date, entriesJson, fillerName || "—");
        }
        res.redirect("/admin/freezer-fridge/daily?date=" + encodeURIComponent(date) + "&ok=1");
    });
    router.get("/api/binding-status", async (_req, res) => {
        try {
            const all = await db.prepare("SELECT id, line_group_id, active FROM customers").all();
            const withLineId = all.filter((c) => (c.line_group_id || "").trim() !== "");
            const active = all.filter((c) => c.active === 1 || c.active === null || c.active === undefined);
            res.json({
                ok: true,
                database: process.env.DATABASE_URL ? "PostgreSQL" : "SQLite",
                totalCustomers: all.length,
                customersWithLineGroupId: withLineId.length,
                activeCustomers: active.length,
            });
        }
        catch (e) {
            res.status(500).json({ ok: false, err: (e.message || String(e)).slice(0, 100) });
        }
    });
    router.get("/line-binding", async (req, res) => {
        const dbType = process.env.DATABASE_URL ? "PostgreSQL (Cloud SQL)" : "SQLite";
        const currentHost = req.get("host") || "";
        const customers = await db.prepare("SELECT id, name, line_group_id, active FROM customers ORDER BY name").all();
        const rows = customers.map((c) => {
            const bound = c.line_group_id && String(c.line_group_id).trim() ? "是" : "否";
            const gid = (c.line_group_id && String(c.line_group_id).trim()) ? escapeHtml(String(c.line_group_id).trim()) : "—";
            const status = c.active === 1 ? "啟用" : "停用";
            return `<tr><td>${escapeHtml(c.name)}</td><td><code style="font-size:12px;word-break:break-all;">${gid}</code></td><td>${bound}</td><td>${status}</td><td><a href="/admin/customers/${encodeURIComponent(c.id)}/edit">編輯</a></td></tr>`;
        });
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / LINE 綁定檢查</div>
        <h1 class="notion-page-title">LINE 綁定檢查</h1>
        <div class="notion-card" style="border-left:4px solid #e03;background:var(--notion-sidebar);">
          <h2 style="margin-top:0;">⚠️ 仍顯示「尚未綁定」請先確認</h2>
          <p><strong>收單機器人只會讀取「與本頁相同網址」的後台資料。</strong>若您是在<strong>本機 (localhost)</strong>或其它網址開後台、編輯客戶並填了 LINE 群組 ID，那份資料<strong>不會</strong>被 Cloud Run 上的收單用到。</p>
          <p>請務必：用瀏覽器打開<strong>與本頁相同的網址</strong>（例如 <code>https://您的服務.run.app/admin</code>），到「客戶管理」→ 點該客戶「編輯」→ 在「LINE 群組 ID」貼上群組內傳「取得群組ID」後機器人回傳的那串 → 儲存。下方表格即為<strong>本服務目前</strong>的綁定狀態。</p>
        </div>
        <div class="notion-card" style="border-left:4px solid #0a0;">
          <h2>可觸發收單的關鍵字</h2>
          <p><strong>開始收單</strong>（任一句即可，可同則帶品項，例：收單 高麗菜 5 斤）：</p>
          <ul style="margin:4px 0 12px;padding-left:20px;">
            <li>收單</li>
            <li>開始收單</li>
            <li>訂單</li>
            <li>我要下訂</li>
            <li>明日訂單</li>
          </ul>
          <p><strong>結束收單</strong>：</p>
          <ul style="margin:4px 0 0;padding-left:20px;">
            <li>完成</li>
            <li>結束收單</li>
            <li>以上X收單（X 為數字，例：以上5收單）</li>
          </ul>
          <p style="margin-top:12px;font-size:13px;color:var(--notion-text-muted);">收單結束時機器人會回覆：訂單日期、星期、共收幾項（不列出品項明細）。</p>
        </div>
        <div class="notion-card">
          <h2>如何綁定</h2>
          <ol style="margin:0 0 12px;padding-left:20px;">
            <li>在 LINE <strong>群組</strong>或<strong>多人聊天</strong>裡傳送：<strong>取得群組ID</strong>（或「群組ID」）</li>
            <li>機器人會回傳該群組/聊天室的 ID（一串英數字），請<strong>完整複製</strong></li>
            <li>到下方對應客戶那一列點「編輯」，把複製的 ID 貼到「LINE 群組 ID」欄位，儲存</li>
          </ol>
          <p style="color:var(--notion-text-muted);font-size:13px;">ID 必須與機器人回傳的<strong>完全一致</strong>。下方表格即為目前資料庫內的綁定狀態（與收單機器人讀取的是同一份）。</p>
        </div>
        <div class="notion-card" style="border-left:4px solid #08c;">
          <h2>「連接通道」檢查清單（仍無法綁定時請逐項確認）</h2>
          <ol style="margin:0 0 12px;padding-left:20px;">
            <li><strong>LINE Developers Console</strong>（<a href="https://developers.line.biz/console/" target="_blank" rel="noopener">developers.line.biz/console</a>）→ 您的 Channel → <strong>Messaging API</strong> 分頁：<br>「Webhook URL」必須為 <code>https://您的服務.run.app/webhook</code>（與本後台同網址、結尾 /webhook），且「Use webhook」為 <strong>Enabled</strong>。</li>
            <li><strong>機器人已加入該群組</strong>：收單只認「群組」或「多人聊天」。請在 LINE 群組成員名單確認有您的官方帳號（機器人）；若沒有，請在群組內加入該帳號為成員。</li>
            <li><strong>在「群組內」傳訊息</strong>：若您是在「與機器人 1 對 1」聊天視窗傳，不會觸發群組綁定。請改在<strong>群組或多人聊天</strong>裡傳「取得群組ID」或「收單」。</li>
            <li><strong>後台與收單同一網址</strong>：綁定必須在「本頁相同網址」的後台編輯並儲存。開啟 <a href="/admin/api/binding-status" target="_blank">/admin/api/binding-status</a> 可確認此服務目前看到的客戶數與有填 LINE 群組 ID 的數量（應 ≥ 1）。</li>
          </ol>
        </div>
        <div class="notion-card">
          <h2>收不到／仍顯示未綁定時請查日誌</h2>
          <p>到 <strong>Google Cloud Console → Cloud Run → 你的服務 → 日誌</strong>，在群組/聊天室傳一則訊息後搜尋 <code>[LINE]</code>。</p>
          <ul style="margin:8px 0 0;padding-left:20px;">
            <li>有 <code>[LINE] 綁定查詢 OK customer=xxx</code> → 綁定成功，可傳「收單」開始收單。</li>
            <li>有 <code>[LINE] 非群組/聊天室 source.type= user</code> → 您是在「與機器人 1 對 1」聊天，請改在<strong>群組或多人聊天</strong>裡傳。</li>
            <li>有 <code>[LINE] 綁定查詢失敗</code> → 日誌會印出 LINE 傳來的 ID 與 DB 第一筆的前 8 字元比對；若「DB內有line_group_id的客戶數=0」代表此實例讀到的資料庫沒有綁定資料。</li>
            <li>完全沒有 <code>[LINE]</code> 日誌 → Webhook 未收到（請確認上述「連接通道」：Webhook URL、Use webhook、機器人已在群組內）。</li>
          </ul>
        </div>
        <div class="notion-card">
          <h2>資料庫連線與目前後台網址</h2>
          <p>目前使用：<strong>${escapeHtml(dbType)}</strong></p>
          <p>您目前連線的後台：<code>${escapeHtml(currentHost ? "https://" + currentHost + "/admin" : "(無法取得)")}</code></p>
          <p style="color:var(--notion-text-muted);font-size:13px;">若此網址是 <code>localhost</code>，代表您開的是本機後台，收單機器人（Cloud Run）讀不到這裡的資料。請改開「已部署的 Cloud Run 後台網址」再編輯客戶綁定。</p>
        </div>
        <div class="notion-card">
          <h2>客戶與 LINE 群組 ID</h2>
          <table>
            <thead><tr><th>客戶名稱</th><th>LINE 群組 ID</th><th>已綁定</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>${rows.length ? rows.join("") : "<tr><td colspan='5'>尚無客戶</td></tr>"}</tbody>
          </table>
        </div>
        <p><a href="/admin">← 回儀表板</a></p>
      `;
        res.type("text/html").send(notionPage("LINE 綁定檢查", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/triggers", async (req, res) => {
        const startRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_trigger_start");
        const endRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_trigger_end");
        const intentRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_trigger_intent");
        const startVal = (startRow?.value ?? "收單\n開始收單\n訂單\n我要下訂\n明日訂單").trim();
        const endVal = (endRow?.value ?? "完成\n結束收單").trim();
        const intentVal = (intentRow?.value ?? "幫我送\n明天\n今天早上要\n要送\n訂\n叫貨\n送過來\n請送").trim();
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 提示詞管理</div>
        <h1 class="notion-page-title">提示詞管理</h1>
        <p style="color:var(--notion-text-muted);">設定 LINE 收單時，哪些關鍵字可觸發「開始收單」與「結束收單」。一列一個；可同則帶品項（例：收單 高麗菜 5 斤）。</p>
        ${req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存。</p>" : ""}
        <div class="notion-card">
          <form method="post" action="/admin/triggers">
            <h2>開始收單（精確／前綴）</h2>
            <p>以下任一句即開始收單（可同則帶品項）：</p>
            <textarea name="start" rows="5" style="width:100%;box-sizing:border-box;" placeholder="收單&#10;開始收單&#10;訂單&#10;我要下訂&#10;明日訂單">${escapeHtml(startVal)}</textarea>
            <h2 style="margin-top:1.5rem;">意圖關鍵字（彈性收單）</h2>
            <p>訊息<strong>內含</strong>任一個即視為開始收單（例：明天幫我送 高麗菜 5 斤）。一列一個。</p>
            <textarea name="intent" rows="4" style="width:100%;box-sizing:border-box;" placeholder="幫我送&#10;明天&#10;今天早上要&#10;要送&#10;訂&#10;叫貨&#10;送過來&#10;請送">${escapeHtml(intentVal)}</textarea>
            <h2 style="margin-top:1.5rem;">結束收單</h2>
            <p>以下任一句即結束收單：</p>
            <textarea name="end" rows="3" style="width:100%;box-sizing:border-box;" placeholder="完成&#10;結束收單">${escapeHtml(endVal)}</textarea>
            <p style="margin-top:8px;font-size:13px;color:var(--notion-text-muted);">「以上X收單」（X 為數字）永遠有效，無需填入。</p>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
        <div class="notion-card">
          <h2>目前觸發對照</h2>
          <p><strong>開始收單（精確）</strong>：${escapeHtml(startVal.split(/\n/).filter(Boolean).join("、") || "（未設定，使用預設）")}</p>
          <p><strong>意圖關鍵字</strong>：${escapeHtml(intentVal.split(/\n/).filter(Boolean).join("、") || "（未設定，使用預設）")}</p>
          <p><strong>結束收單</strong>：以上X收單（X=數字）、${escapeHtml(endVal.split(/\n/).filter(Boolean).join("、") || "（未設定，使用預設）")}</p>
        </div>
      `;
        res.type("text/html").send(notionPage("提示詞管理", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/triggers", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const start = (req.body?.start ?? "").trim().split(/\n/).map((s) => s.trim()).filter(Boolean).join("\n");
        const intent = (req.body?.intent ?? "").trim().split(/\n/).map((s) => s.trim()).filter(Boolean).join("\n");
        const end = (req.body?.end ?? "").trim().split(/\n/).map((s) => s.trim()).filter(Boolean).join("\n");
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_trigger_start", start || "收單\n開始收單\n訂單\n我要下訂\n明日訂單");
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_trigger_intent", intent || "幫我送\n明天\n今天早上要\n要送\n訂\n叫貨\n送過來\n請送");
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_trigger_end", end || "完成\n結束收單");
        res.redirect("/admin/triggers?ok=1");
    });
    // 待確認品名：列出 need_review=1 的明細，可選擇對應品項並加入俗名
    router.get("/review", async (req, res) => {
        const msg = req.query.ok === "1" ? "<p style='color:green'>已加入對照。</p>" : req.query.err === "dup" ? "<p style='color:red'>此俗名已存在，請勿重複新增。</p>" : "";
        const rows = await db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.order_id, o.customer_id, c.name AS customer_name
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN customers c ON c.id = o.customer_id
      WHERE oi.need_review = 1
      ORDER BY oi.id
    `).all();
        const rowsHtml = rows.length === 0
            ? "<tr><td colspan='6'>目前沒有待確認品名</td></tr>"
            : rows
                .map((r) => `
        <tr>
          <td>${escapeHtml(r.raw_name)}</td>
          <td>${r.quantity}</td>
          <td>${escapeHtml(r.unit ?? "")}</td>
          <td>${escapeHtml(r.customer_name)}</td>
          <td>
            <form action="/admin/alias" method="post" class="review-alias-form" style="display:inline;">
              <input type="hidden" name="alias" value="${escapeAttr(r.raw_name)}">
              <input type="hidden" name="customer_id" value="${escapeAttr(r.customer_id)}">
              <div class="review-product-picker" style="position:relative;display:inline-block;vertical-align:middle;">
                <input type="text" class="review-product-search" placeholder="輸入品名或料號搜尋" style="width:240px;" autocomplete="off">
                <input type="hidden" name="product_id" required class="review-product-id">
                <span class="review-product-label" style="margin-left:6px;font-size:13px;color:var(--notion-text-muted);"></span>
                <div class="review-product-dropdown" style="display:none;position:absolute;left:0;top:100%;margin-top:2px;max-height:200px;overflow:auto;border:1px solid var(--notion-border);background:var(--notion-bg);border-radius:var(--notion-radius);box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:20;min-width:260px;"></div>
              </div>
              <label style="margin-left:8px;"><input type="radio" name="scope" value="global" checked> 全公司俗名</label>
              <label><input type="radio" name="scope" value="customer"> 此客戶專用</label>
              <button type="submit" style="margin-left:8px;">加入對照</button>
            </form>
          </td>
        </tr>
      `)
                .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 待確認品名</div>
        <h1 class="notion-page-title">待確認品名</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("已加入") >= 0 ? "ok" : "err"}">${msg.replace(/<p style='[^']*'>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <p style="margin:0 0 12px;">以下為叫貨時無法對應到標準品項的名稱，請在「對應品項」欄輸入品名或料號搜尋、點選品項後加入俗名或客戶專用別名。</p>
          <table>
            <thead><tr><th>客戶輸入的名稱</th><th>數量</th><th>單位</th><th>客戶</th><th>對應品項並加入對照</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <script>
          (function(){
            var searchTimeout;
            document.querySelectorAll('.review-product-search').forEach(function(inp){
              var wrap = inp.closest('.review-product-picker');
              var hidden = wrap && wrap.querySelector('.review-product-id');
              var label = wrap && wrap.querySelector('.review-product-label');
              var dropdown = wrap && wrap.querySelector('.review-product-dropdown');
              if (!wrap || !hidden || !dropdown) return;
              function showList(arr){
                dropdown.innerHTML = (arr && arr.length) ? arr.map(function(p){
                  var text = (p.name || '') + (p.erp_code ? ' (' + p.erp_code + ')' : '') + (p.teraoka_barcode ? ' ' + p.teraoka_barcode : '');
                  return '<div class="review-product-opt" data-id="' + (p.id || '') + '" data-name="' + (p.name || '').replace(/"/g, '&quot;') + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--notion-border);font-size:13px;">' + (p.name || '') + (p.erp_code ? ' \uFF08' + p.erp_code + '\uFF09' : '') + '</div>';
                }).join('') : '<div style="padding:8px 12px;color:var(--notion-text-muted);">無符合品項</div>';
                dropdown.style.display = 'block';
              }
              function hideList(){ dropdown.style.display = 'none'; }
              function selectProduct(id, name){
                hidden.value = id || '';
                label.textContent = name || '';
                inp.value = name || '';
                hideList();
              }
              inp.addEventListener('input', function(){
                var q = (this.value || '').trim();
                clearTimeout(searchTimeout);
                if (!q){ hideList(); label.textContent = ''; hidden.value = ''; return; }
                searchTimeout = setTimeout(function(){
                  fetch('/admin/api/products-search?q=' + encodeURIComponent(q) + '&active=1').then(function(r){ return r.json(); }).then(function(arr){ showList(arr); }).catch(function(){ hideList(); });
                }, 200);
              });
              dropdown.addEventListener('click', function(e){
                var opt = e.target.closest('.review-product-opt');
                if (opt && opt.dataset.id) selectProduct(opt.dataset.id, opt.dataset.name);
              });
              document.addEventListener('click', function(e){ if (!wrap.contains(e.target)) hideList(); });
            });
          })();
        </script>
      `;
        res.type("text/html").send(notionPage("待確認品名", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/alias", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { alias, product_id, customer_id, scope, redirect } = req.body;
        if (!alias?.trim() || !product_id) {
            res.redirect(redirect && redirect.startsWith("/admin") ? redirect + "?err=missing" : "/admin/review?err=missing");
            return;
        }
        const aliasTrim = alias.trim();
        const isGlobal = scope !== "customer";
        try {
            if (isGlobal) {
                const id = (0, id_js_1.newId)("pa");
                await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run(id, product_id, aliasTrim);
            }
            else if (customer_id) {
                const id = (0, id_js_1.newId)("cpa");
                await db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(id, customer_id, product_id, aliasTrim);
            }
            // 將同名稱的待確認明細改為已對應（若為客戶專用則只更新該客戶的訂單明細）
            if (isGlobal) {
                await db.prepare("UPDATE order_items SET need_review = 0, product_id = ? WHERE raw_name = ? AND need_review = 1").run(product_id, aliasTrim);
            }
            else if (customer_id) {
                await db.prepare(`UPDATE order_items SET need_review = 0, product_id = ?
           WHERE raw_name = ? AND need_review = 1 AND order_id IN (SELECT id FROM orders WHERE customer_id = ?)`).run(product_id, aliasTrim, customer_id);
            }
        }
        catch (e) {
            console.error("[admin] alias insert error", e);
            res.redirect(redirect && redirect.startsWith("/admin") ? redirect + "?err=dup" : "/admin/review?err=dup");
            return;
        }
        const doneUrl = redirect && redirect.startsWith("/admin") ? redirect + "?ok=1" : "/admin/review?ok=1";
        res.redirect(doneUrl);
    });
    router.get("/orders", async (req, res) => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const onlyNeedReview = req.query.need_review === "1";
            const filterDate = req.query.date?.trim();
            const filterCustomerId = req.query.customer_id?.trim();
            const filterOrderNo = req.query.order_no?.trim();
            const dateCondition = "1=1";
            const dateParam = [];
            let orders = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.raw_message, o.customer_id, c.name AS customer_name,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1) AS need_review_count
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE ${dateCondition}
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 300
    `).all(...dateParam);
        if (filterDate && /^\d{4}-\d{2}-\d{2}$/.test(filterDate))
            orders = orders.filter((o) => o.order_date === filterDate);
        if (filterCustomerId)
            orders = orders.filter((o) => o.customer_id === filterCustomerId);
        if (filterOrderNo)
            orders = orders.filter((o) => (o.order_no ?? "").includes(filterOrderNo));
        if (onlyNeedReview) {
            orders = orders.filter((o) => (o.need_review_count ?? 0) > 0);
        }
        const orderSeqStartRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("order_seq_start_" + today);
        const orderSeqStartVal = orderSeqStartRow?.value ?? "";
        const customers = await db.prepare("SELECT id, name FROM customers ORDER BY name").all();
        const customerOptions = customers.map((c) => `<option value="${escapeAttr(c.id)}" ${c.id === filterCustomerId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
        const rawMsgLen = 60;
        const rows = orders
            .map((o) => {
            const n = o.need_review_count ?? 0;
            const needReviewCell = n > 0 ? `<span style="color:red">${n} 項待確認</span>` : "—";
            const raw = (o.raw_message ?? "").replace(/\s+/g, " ").trim();
            const rawShort = raw.length <= rawMsgLen ? raw : raw.slice(0, rawMsgLen) + "…";
            return `<tr>
            <td>${escapeHtml(o.order_no ?? "—")}</td>
            <td>${escapeHtml(o.order_date)}</td>
            <td><a href="/admin/customers/${encodeURIComponent(o.customer_id)}/quick-view?from=orders">${escapeHtml(o.customer_name)}</a></td>
            <td>${escapeHtml(o.status)}</td>
            <td>${needReviewCell}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeAttr(raw)}">${escapeHtml(rawShort)}</td>
            <td><a href="/admin/orders/${encodeURIComponent(o.id)}">明細</a></td>
          </tr>`;
        })
            .join("");
        const filterLink = onlyNeedReview
            ? `<a href="/admin/orders">顯示全部訂單</a>`
            : `<a href="/admin/orders?need_review=1">只看有待確認的訂單</a>`;
        const usingCloudSqlOrders = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
        const orderListDbWarning = usingCloudSqlOrders ? "" : `<p class="notion-msg err" style="margin-bottom:12px;">目前未連線 Cloud SQL，資料不會長期保留，收單後可能看不到或重開就消失。請在 Cloud Run 設定 <strong>DATABASE_URL</strong>。</p>`;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 訂單查詢</div>
        <h1 class="notion-page-title">訂單查詢</h1>
        ${orderListDbWarning}
        <p class="notion-msg" style="background:#f0f7ff;border-left:4px solid var(--notion-accent);margin-bottom:12px;">若 LINE 有回覆「已記入」「收單結束」但這裡看不到訂單：請確認您開的是<strong>與 LINE 機器人同一台主機</strong>的後台（例如 Cloud Run 網址 <code>https://xxx.run.app/admin</code>），不是本機 <code>localhost</code>；本機與雲端資料庫不同，訂單只會寫入收到訊息的那台。</p>
        ${req.query.ok === "seq" ? "<p class=\"notion-msg ok\">已儲存本日起始編號。</p>" : ""}
        <p style="margin-bottom:8px;">已顯示全部訂單（不使用結轉日期）。</p>
        <p style="margin-bottom:12px;"><a href="/admin/review">待確認品名</a>（補對照）　${filterLink}</p>
        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">篩選</h2>
          <form method="get" action="/admin/orders" style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;">
            ${onlyNeedReview ? '<input type="hidden" name="need_review" value="1">' : ""}
            <label style="margin:0;">日期 <input type="date" name="date" value="${escapeAttr(filterDate)}" style="width:140px;"></label>
            <label style="margin:0;">客戶 <select name="customer_id" style="width:180px;"><option value="">全部</option>${customerOptions}</select></label>
            <label style="margin:0;">貨單編號 <input type="text" name="order_no" value="${escapeAttr(filterOrderNo)}" placeholder="部分符合" style="width:140px;"></label>
            <button type="submit" class="btn">查詢</button>
            <a href="/admin/orders" class="btn">清除</a>
          </form>
        </div>
        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">本日起始編號（與 ERP 對齊）</h2>
          <p style="color:var(--notion-text-muted);font-size:13px;">訂單編號規則：西元年月日＋流水號（例 20250226001）。設定本日（${escapeHtml(today)}）的起始流水號，之後新訂單依序遞增。</p>
          <form method="post" action="/admin/api/order-seq-start" style="display:flex;align-items:center;gap:8px;">
            <input type="hidden" name="date" value="${escapeAttr(today)}">
            <label>起始流水號 <input type="number" name="start" value="${escapeAttr(orderSeqStartVal)}" min="1" placeholder="1" style="width:80px;"></label>
            <button type="submit" class="btn">儲存</button>
          </form>
        </div>
        <div class="notion-card">
          <table>
            <thead><tr><th>訂單編號</th><th>日期</th><th>客戶</th><th>狀態</th><th>待確認</th><th>原始訊息</th><th></th></tr></thead>
            <tbody>${rows.length ? rows : "<tr><td colspan='7'>無訂單</td></tr>"}</tbody>
          </table>
        </div>
      `;
            res.type("text/html").send(notionPage("訂單查詢", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
        }
        catch (e) {
            const errMsg = (e?.message || String(e)).slice(0, 500);
            console.error("[admin] GET /orders 錯誤:", errMsg, e?.stack);
            res.status(500).type("text/html").send(`
        <!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>訂單查詢錯誤</title></head>
        <body style="font-family:sans-serif;padding:2rem;max-width:640px;">
          <h1>訂單查詢暫時無法使用</h1>
          <p>請稍後再試，或聯絡管理員檢查後台與資料庫連線。</p>
          <p style="margin-top:1rem;padding:10px;background:#f5f5f5;border-radius:6px;font-size:13px;word-break:break-all;"><strong>錯誤訊息：</strong><br>${escapeHtml(errMsg)}</p>
          <p style="margin-top:1rem;font-size:13px;color:#666;">若為「column … does not exist」，請確認 Cloud SQL 已執行過最新 schema（含 order_no、order_attachments 等）。</p>
          <p style="margin-top:1rem;"><a href="/admin">回儀表板</a></p>
        </body></html>`);
        }
    });
    router.post("/api/order-seq-start", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const date = req.body?.date?.trim();
        const start = req.body?.start?.trim();
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.redirect("/admin/orders?err=date");
            return;
        }
        const num = start ? parseInt(start, 10) : 1;
        const val = (Number.isNaN(num) || num < 1) ? "1" : String(num);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("order_seq_start_" + date, val);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("order_seq_next_" + date, val);
        res.redirect("/admin/orders?ok=seq");
    });
    router.get("/export", async (req, res) => {
        const workingDate = await getWorkingDate(db);
        const date = (req.query.date || workingDate).toString().trim();
        const customerId = req.query.customer_id?.trim() || "";
        const customers = await db.prepare("SELECT id, name FROM customers WHERE active = 1 ORDER BY name").all();
        let orders = [];
        if (date) {
            orders = await db.prepare(`
              SELECT o.id, o.order_date, o.customer_id, c.name AS customer_name
              FROM orders o JOIN customers c ON c.id = o.customer_id
              WHERE o.order_date = ?
              ORDER BY c.name
            `).all(date);
            if (customerId)
                orders = orders.filter((o) => o.customer_id === customerId);
        }
        const customerOptions = customers.map((c) => `<option value="${escapeAttr(c.id)}" ${c.id === customerId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
        const rows = orders.map((o) => `<tr><td>${escapeHtml(o.order_date)}</td><td>${escapeHtml(o.customer_name)}</td><td><a href="/admin/orders/${encodeURIComponent(o.id)}">明細</a></td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 資料匯出</div>
        <h1 class="notion-page-title">資料匯出</h1>
        <div class="notion-card">
          <form method="get" action="/admin/export">
            <label class="form-inline">日期 <input type="date" name="date" value="${escapeAttr(date)}" required></label>
            <label class="form-inline">客戶 <select name="customer_id"><option value="">全部</option>${customerOptions}</select></label>
            <button type="submit" class="btn">查詢</button>
          </form>
        </div>
        <div class="notion-card">
          <h2>指定日期訂單${customerId ? "（已篩選客戶）" : ""}</h2>
          <table>
            <thead><tr><th>日期</th><th>客戶</th><th></th></tr></thead>
            <tbody>${rows.length ? rows : "<tr><td colspan='3'>無訂單</td></tr>"}</tbody>
          </table>
          ${orders.length ? `<p style="margin-top:12px;"><a href="/admin/export/download?date=${encodeURIComponent(date)}${customerId ? "&customer_id=" + encodeURIComponent(customerId) : ""}" class="btn">匯出 CSV</a></p>` : ""}
        </div>
      `;
        res.type("text/html").send(notionPage("資料匯出", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/export/download", async (req, res) => {
        const date = req.query.date?.trim();
        const customerId = req.query.customer_id?.trim() || "";
        if (!date) {
            res.redirect("/admin/export?err=date");
            return;
        }
        let orders = await db.prepare(`
          SELECT o.id, o.order_date, o.customer_id, c.name AS customer_name
          FROM orders o JOIN customers c ON c.id = o.customer_id
          WHERE o.order_date = ?
          ORDER BY c.name
        `).all(date);
        if (customerId)
            orders = orders.filter((o) => o.customer_id === customerId);
        const lines = ["日期,客戶,訂單ID"];
        for (const o of orders)
            lines.push([o.order_date, '"' + (o.customer_name || "").replace(/"/g, '""') + '"', o.id].join(","));
        res.setHeader("Content-Disposition", "attachment; filename=\"orders-" + date + ".csv\"");
        res.type("text/csv").send(lines.join("\n"));
    });
    router.get("/api/products-search", async (req, res) => {
        const q = (req.query.q || "").trim().toLowerCase();
        const activeOnly = req.query.active === "1";
        let list = await db.prepare(activeOnly
            ? "SELECT id, name, erp_code, teraoka_barcode FROM products WHERE (active IS NULL OR active = 1) ORDER BY name"
            : "SELECT id, name, erp_code, teraoka_barcode FROM products ORDER BY name").all();
        if (q) {
            const parts = q.split(/\s+/).filter(Boolean);
            let filtered = list.filter((p) => {
                const name = (p.name || "").toLowerCase();
                const erp = (p.erp_code || "").toLowerCase();
                const teraoka = (p.teraoka_barcode || "").toLowerCase();
                return parts.every((part) => name.includes(part) || erp.includes(part) || teraoka.includes(part));
            });
            if (filtered.length === 0 && parts.length > 0)
                filtered = list.filter((p) => {
                    const name = (p.name || "").toLowerCase();
                    const erp = (p.erp_code || "").toLowerCase();
                    const teraoka = (p.teraoka_barcode || "").toLowerCase();
                    const all = name + " " + erp + " " + teraoka;
                    return parts.some((part) => all.includes(part));
                });
            list = filtered;
        }
        res.json(list.slice(0, 80));
    });
    router.post("/orders/:orderId/items/:itemId/product", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId, itemId } = req.params;
        const productId = req.body.product_id?.trim();
        const order = await db.prepare("SELECT id, customer_id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        if (!productId) {
            if (req.get("X-Requested-With") === "XMLHttpRequest") {
                res.status(400).json({ error: "請選擇有效品項。" });
                return;
            }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=product#items");
            return;
        }
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest";
            if (wantsJson) {
                res.status(400).json({ error: "請選擇有效品項。" });
                return;
            }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=product#items");
            return;
        }
        const item = await db.prepare("SELECT raw_name FROM order_items WHERE id = ? AND order_id = ?").get(itemId, orderId);
        await db.prepare("UPDATE order_items SET product_id = ?, need_review = 0 WHERE id = ? AND order_id = ?").run(productId, itemId, orderId);
        const rawNameTrim = item?.raw_name?.trim();
        if (rawNameTrim) {
            const existing = await db.prepare("SELECT id FROM product_aliases WHERE alias = ?").get(rawNameTrim);
            if (!existing) {
                try {
                    const paId = (0, id_js_1.newId)("pa");
                    await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run(paId, productId, rawNameTrim);
                }
                catch (_) { /* 可能重複 */ }
            }
            const existingCpa = await db.prepare("SELECT id FROM customer_product_aliases WHERE customer_id = ? AND alias = ?").get(order.customer_id, rawNameTrim);
            if (!existingCpa) {
                try {
                    const cpaId = (0, id_js_1.newId)("cpa");
                    await db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(cpaId, order.customer_id, productId, rawNameTrim);
                }
                catch (_) { /* 可能重複 */ }
            }
        }
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest";
        if (wantsJson) {
            res.json({ ok: true, productName: product.name || "" });
            return;
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=product#items");
    });
    router.get("/orders/:orderId", async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.raw_message, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.remark, oi.need_review, oi.include_export,
        p.id AS product_id, p.erp_code, p.name AS product_name, p.teraoka_barcode
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
    `).all(orderId);
        const attachments = await db.prepare("SELECT id, line_message_id FROM order_attachments WHERE order_id = ?").all(orderId);
        const needReviewCount = items.filter((i) => i.need_review === 1).length;
        const needReviewNote = needReviewCount > 0
            ? `<p class="notion-msg err">本單有 <strong>${needReviewCount} 項待確認</strong>，可點「待確認」直接改品項，或至 <a href="/admin/review">待確認品名</a> 補對照。</p>`
            : "";
        const units = ["公斤", "斤", "把", "包", "件", "箱", "顆", "粒", "盒", "袋"];
        const unitOptions = units.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("");
        const itemsRows = items
            .map((i) => {
            const q = Number(i.quantity);
            const u = (i.unit && i.unit.trim()) || "";
            const unitSelect = `<select name="unit_${i.item_id}" form="itemsForm">${unitOptions}</select>`;
            const unitSelectWithVal = units.includes(u)
                ? `<select name="unit_${i.item_id}" form="itemsForm"><option value="">—</option>${units.map((x) => `<option value="${escapeAttr(x)}" ${x === u ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}</select>`
                : `<select name="unit_${i.item_id}" form="itemsForm"><option value="">—</option>${unitOptions}</select>`;
            const erp = i.erp_code ?? "—";
            const pname = i.product_name ? escapeHtml(i.product_name) : "";
            const teraokaCode = (i.teraoka_barcode && i.teraoka_barcode.trim()) ? escapeHtml(i.teraoka_barcode) : "—";
            const teraokaName = escapeHtml(i.product_name || i.raw_name || "");
            const teraokaCell = i.teraoka_barcode && i.teraoka_barcode.trim()
                ? `<div class="teraoka-cell"><span class="code">${teraokaCode}</span><span class="name">${teraokaName || "—"}</span><br><img src="/admin/barcode?code=${encodeURIComponent(i.teraoka_barcode.trim())}" alt="" style="height:32px;"></div>`
                : `<div class="teraoka-cell"><span class="code">—</span><span class="name">${teraokaName || "—"}</span></div>`;
            const productCell = i.need_review === 1
                ? `<a href="#" class="product-pick need-review" data-item-id="${escapeAttr(i.item_id)}" data-raw="${escapeAttr(i.raw_name || "")}">待確認</a>`
                : `${pname} <a href="#" class="product-pick product-change" data-item-id="${escapeAttr(i.item_id)}">改品項</a>`;
            const remarkVal = (i.remark && i.remark.trim()) ? escapeAttr(i.remark.trim()) : "";
            const includeChecked = i.include_export === undefined || i.include_export === null || i.include_export === 1;
            const rowClass = includeChecked ? "" : " order-row-excluded";
            return `<tr data-item-id="${escapeAttr(i.item_id)}" class="${rowClass.trim()}">
            <td><input type="checkbox" name="include_${i.item_id}" value="1" form="itemsForm" ${includeChecked ? "checked" : ""} title="勾選則納入訂貨單"></td>
            <td>${escapeHtml(i.raw_name ?? "")}</td>
            <td>${escapeHtml(String(q))}</td>
            <td>${escapeHtml((i.unit && i.unit.trim()) || "—")}</td>
            <td class="order-table-col-system">${escapeHtml(erp)}</td>
            <td>${productCell}</td>
            <td><input type="number" name="qty_${i.item_id}" form="itemsForm" value="${escapeAttr(String(q))}" step="any" min="0" style="width:5rem;"></td>
            <td>${unitSelectWithVal}</td>
            <td><input type="text" name="remark_${i.item_id}" form="itemsForm" value="${remarkVal}" placeholder="備註" style="width:100%;max-width:120px;"></td>
            <td>${teraokaCell}</td>
            <td><button type="button" class="btn btn-delete-item" data-item-id="${escapeAttr(i.item_id)}" data-order-id="${escapeAttr(orderId)}">刪除</button></td>
          </tr>`;
        })
            .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單查詢</a> / 訂單明細</div>
        <h1 class="notion-page-title">訂單明細</h1>
        <p>訂單編號：${escapeHtml(order.order_no ?? "—")}　日期：${escapeHtml(order.order_date)}　客戶：<a href="/admin/customers/${encodeURIComponent(order.customer_id)}/quick-view?from=orders">${escapeHtml(order.customer_name)}</a>　狀態：${escapeHtml(order.status)}</p>
        ${needReviewNote}
        ${req.query.ok === "product" ? "<p class=\"notion-msg ok\">已更新品項。</p>" : ""}
        ${req.query.err === "product" ? "<p class=\"notion-msg err\">請選擇有效品項。</p>" : ""}
        <p><a href="/admin/orders/${encodeURIComponent(orderId)}/order-sheet" class="btn btn-primary">匯出訂貨單格式（含條碼）</a>　<a href="/admin/orders/${encodeURIComponent(orderId)}/order-sheet?preview=1" class="btn">預覽訂單圖</a></p>
        ${attachments.length > 0 ? `<p style="color:var(--notion-text-muted);">客戶傳了 <strong>${attachments.length}</strong> 張圖片：${attachments.map((a, idx) => `<a href="/admin/orders/${encodeURIComponent(orderId)}/attachment/${encodeURIComponent(a.line_message_id)}" target="_blank" rel="noopener">圖${idx + 1}</a>`).join("、")}</p>` : ""}
        <div class="notion-card">
          <h2 style="margin-top:0;">AI 分析</h2>
          <p style="color:var(--notion-text-muted);font-size:13px;">整理客戶原始訊息、補正錯漏並標註建議確認；若客戶問成本或金額會一併說明（本系統需維護品項單價後才能自動估算）。<br>使用 Google Gemini，僅在您點擊時呼叫，免費額度內成本極低。</p>
          <button type="button" id="aiAnalyzeBtn" class="btn btn-primary">分析此筆訂單</button>
          <div id="aiAnalyzeResult" style="display:none;margin-top:12px;padding:12px;background:var(--notion-sidebar);border-radius:var(--notion-radius);font-size:14px;white-space:pre-wrap;line-height:1.5;"></div>
          <div id="aiAnalyzeErr" style="display:none;margin-top:8px;color:#c00;font-size:13px;"></div>
        </div>
        <div class="notion-card raw-message-scroll" id="rawOrderBlock"><h3 style="margin-top:0;">原始訂單</h3><div style="max-height:200px;overflow-y:auto;overflow-x:auto;border:1px solid var(--notion-border);border-radius:var(--notion-radius);"><pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);margin:0;font-size:13px;white-space:pre-wrap;word-break:break-all;">${escapeHtml(order.raw_message ?? "")}</pre></div></div>
        <form id="itemsForm" method="post" action="/admin/orders/${encodeURIComponent(orderId)}/items">
          <div class="notion-card" id="items">
            <table>
              <thead><tr><th>選取</th><th>原始品名</th><th>原始數量</th><th>原始單位</th><th class="order-table-col-system">凌越料號</th><th>凌越品名</th><th>叫貨數量</th><th>叫貨單位</th><th>備註</th><th>寺岡（料號／條碼）</th><th>刪除</th></tr></thead>
              <tbody>${itemsRows}</tbody>
              <tr><td colspan="11" style="background:var(--notion-sidebar);padding:10px;"><a href="/admin/orders/${encodeURIComponent(orderId)}/items/add" class="btn">＋ 增加品項</a></td></tr>
            </table>
            <p style="margin:12px 0 0;"><button type="submit" class="btn btn-primary">儲存數量、單位、備註與選取</button></p>
          </div>
        </form>
        <div id="productModal" class="notion-modal-overlay" style="display:none;">
          <div class="notion-modal">
            <h3>選擇品項（模糊搜尋）</h3>
            <input type="search" class="notion-modal-search" id="productSearch" placeholder="輸入品名、料號、條碼...">
            <div class="notion-modal-list" id="productList"></div>
            <div class="notion-modal-actions"><button type="button" class="btn" onclick="document.getElementById('productModal').style.display='none'">取消</button></div>
          </div>
        </div>
        <script>
        (function(){
          var orderId = ${JSON.stringify(orderId)};
          var modal = document.getElementById('productModal');
          var listEl = document.getElementById('productList');
          var searchEl = document.getElementById('productSearch');
          var currentItemId = null;
          function searchProducts(q){
            fetch('/admin/api/products-search?q=' + encodeURIComponent(q)).then(function(r){ return r.json(); }).then(function(arr){
              listEl.innerHTML = arr.map(function(p){
                return '<div data-product-id="' + (p.id || '') + '" class="product-option">' + (p.name || '') + ' ' + (p.erp_code || '') + ' ' + (p.teraoka_barcode || '') + '</div>';
              }).join('') || '<div>無符合品項</div>';
            });
          }
          searchProducts('');
          searchEl.oninput = function(){ searchProducts(searchEl.value); };
          document.addEventListener('click', function(e){
            var pick = e.target.closest('.product-pick');
            if (pick) { e.preventDefault(); currentItemId = pick.getAttribute('data-item-id'); modal.style.display = 'flex'; searchEl.value = pick.getAttribute('data-raw') || ''; searchProducts(searchEl.value); }
          });
          listEl.addEventListener('click', function(e){
            var div = e.target.closest('.product-option');
            if (!div || !currentItemId) return;
            var productId = div.getAttribute('data-product-id');
            if (!productId) return;
            modal.style.display = 'none';
            var url = '/admin/orders/' + encodeURIComponent(orderId) + '/items/' + encodeURIComponent(currentItemId) + '/product';
            var body = 'product_id=' + encodeURIComponent(productId);
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: body })
              .then(function(r){ return r.json(); })
              .then(function(data){
                if (data && data.ok && data.productName !== undefined) {
                  var tr = document.querySelector('tr[data-item-id="' + currentItemId.replace(/"/g, '\\"') + '"]');
                  if (tr && tr.cells[5]) tr.cells[5].innerHTML = (data.productName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + ' <a href="#" class="product-pick product-change" data-item-id="' + currentItemId.replace(/"/g, '&quot;') + '">改品項</a>';
                } else { alert(data && data.error ? data.error : '更新失敗'); }
              })
              .catch(function(){ alert('請求失敗'); });
          });
          document.addEventListener('click', function(e){
            var btn = e.target.closest('.btn-delete-item');
            if (!btn) return;
            var itemId = btn.getAttribute('data-item-id');
            var ordId = btn.getAttribute('data-order-id');
            if (!itemId || !ordId || !confirm('確定要刪除此筆明細？')) return;
            var url = '/admin/orders/' + encodeURIComponent(ordId) + '/items/' + encodeURIComponent(itemId) + '/delete';
            fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
              .then(function(r){ return r.json(); })
              .then(function(data){ if (data && data.ok) { var tr = btn.closest('tr'); if (tr) tr.remove(); } else { alert(data && data.error ? data.error : '刪除失敗'); } })
              .catch(function(){ alert('請求失敗'); });
          });
          var itemsForm = document.getElementById('itemsForm');
          if (itemsForm) {
            itemsForm.addEventListener('change', function(e){
              if (e.target.name && e.target.name.indexOf('include_') === 0 && e.target.type === 'checkbox') {
                var tr = e.target.closest('tr');
                if (tr) tr.classList.toggle('order-row-excluded', !e.target.checked);
              }
            });
            itemsForm.addEventListener('submit', function(e){
              e.preventDefault();
              var btn = itemsForm.querySelector('button[type="submit"]');
              var origText = btn ? btn.textContent : '';
              if (btn) { btn.disabled = true; btn.textContent = '儲存中…'; }
              var formData = new FormData(itemsForm);
              fetch(itemsForm.action, { method: 'POST', body: new URLSearchParams(formData), headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
                .then(function(result){
                  if (btn) { btn.disabled = false; btn.textContent = origText; }
                  if (result.ok && result.data && result.data.ok) {
                    var msg = document.getElementById('itemsFormSavedMsg');
                    if (!msg) { msg = document.createElement('p'); msg.id = 'itemsFormSavedMsg'; msg.className = 'notion-msg ok'; itemsForm.querySelector('.notion-card').appendChild(msg); }
                    msg.textContent = '已儲存數量、單位、備註與選取。';
                    msg.style.display = 'block';
                    setTimeout(function(){ msg.style.display = 'none'; }, 3000);
                  } else {
                    alert(result.data && result.data.error ? result.data.error : '儲存失敗，請稍後再試。');
                  }
                })
                .catch(function(){
                  if (btn) { btn.disabled = false; btn.textContent = origText; }
                  alert('儲存請求失敗，請稍後再試。');
                });
            });
          }
          var aiBtn = document.getElementById('aiAnalyzeBtn');
          if (aiBtn) aiBtn.addEventListener('click', function(){
            var btn = this;
            var resultEl = document.getElementById('aiAnalyzeResult');
            var errEl = document.getElementById('aiAnalyzeErr');
            resultEl.style.display = 'none';
            errEl.style.display = 'none';
            errEl.textContent = '';
            btn.disabled = true;
            btn.textContent = '分析中…';
            fetch('/admin/api/orders/' + encodeURIComponent(orderId) + '/ai-analyze')
              .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
              .then(function(result){
                btn.disabled = false;
                btn.textContent = '分析此筆訂單';
                if (!result.ok || result.data.error) {
                  errEl.textContent = (result.data && result.data.error) ? result.data.error : (result.ok ? '' : 'AI 服務無法連線，請檢查網路或稍後再試。');
                  errEl.style.display = 'block';
                  return;
                }
                resultEl.textContent = result.data.analysis || '';
                resultEl.style.display = 'block';
                errEl.style.display = 'none';
              })
              .catch(function(e){
                btn.disabled = false;
                btn.textContent = '分析此筆訂單';
                errEl.textContent = (e && e.message) ? e.message : '請求失敗，請稍後再試。';
                errEl.style.display = 'block';
              });
          });
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("訂單明細", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/api/orders/:orderId/ai-analyze", async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.raw_message, o.customer_id, c.name AS customer_name
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).json({ error: "訂單不存在" });
            return;
        }
        const items = await db.prepare(`
      SELECT oi.raw_name, oi.quantity, oi.unit, oi.need_review, p.name AS product_name
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
    `).all(orderId);
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey || !apiKey.trim()) {
            res.status(503).json({ error: "請在 Cloud Run「變數與密碼」設定 GOOGLE_GEMINI_API_KEY（或 GEMINI_API_KEY）以使用 AI 分析。可至 Google AI Studio 取得金鑰。" });
            return;
        }
        const rawText = (order.raw_message ?? "").trim() || "（無原始訊息）";
        const itemsText = items.length === 0
            ? "（尚無已解析品項）"
            : items.map((i) => {
                const name = i.product_name || i.raw_name || "待確認";
                const q = i.quantity ?? "";
                const u = (i.unit && i.unit.trim()) || "";
                const review = i.need_review === 1 ? " [待確認]" : "";
                return `- ${name} ${q} ${u}${review}`.trim();
            }).join("\n");
        const orderBlock = `訂單編號：${order.order_no ?? "—"}\n日期：${order.order_date}\n客戶：${order.customer_name}\n\n【客戶原始訊息】\n${rawText}\n\n【已解析品項】\n${itemsText}`;
        const fullPrompt = `你是一位生鮮／蔬果訂單助理。以下是一筆客戶叫貨的原始訊息與已解析的品項明細。請：
1. 整理成簡潔易讀的摘要，錯字或語意不清處請補正或標註。
2. 數量或單位不明確的請標註「建議確認」。
3. 若可推論客戶意圖（例如「幫我算一下」可能是在問金額或成本），請簡短說明。
4. 本系統目前無品項單價資料，無法自動計算成本；若客戶有問到價格或成本，請說明需在後台維護各品項單價後才能自動估算。

---\n\n${orderBlock}`;
        try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: { maxOutputTokens: 1024 },
                }),
            });
            if (!resp.ok) {
                const errBody = await resp.text();
                console.warn("[admin] Gemini API 非 200:", resp.status, errBody.slice(0, 200));
                let errMsg = "AI 服務暫時無法使用，請稍後再試。";
                try {
                    const errJson = JSON.parse(errBody);
                    const detail = errJson?.error?.message || errJson?.error?.status || errJson?.message;
                    if (detail)
                        errMsg = typeof detail === "string" ? detail : String(detail);
                }
                catch (_) {
                    if (errBody && errBody.length < 500)
                        errMsg = errBody;
                    else if (errBody)
                        errMsg = errBody.slice(0, 400) + (errBody.length > 400 ? "…" : "");
                }
                res.status(resp.status >= 400 ? resp.status : 502).json({ error: errMsg });
                return;
            }
            const data = await resp.json();
            const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            const content = textPart != null ? String(textPart).trim() : null;
            if (!content) {
                res.status(502).json({ error: "AI 未回傳內容。" });
                return;
            }
            res.json({ analysis: content });
        }
        catch (e) {
            const msg = e?.message || String(e);
            console.error("[admin] AI 分析失敗:", msg);
            res.status(500).json({ error: msg.slice(0, 500) || "分析時發生錯誤，請稍後再試。" });
        }
    });
    router.get("/orders/:orderId/attachment/:messageId", async (req, res) => {
        const { orderId, messageId } = req.params;
        const att = await db.prepare("SELECT id FROM order_attachments WHERE order_id = ? AND line_message_id = ?").get(orderId, messageId);
        if (!att) {
            res.status(404).send("找不到該附件");
            return;
        }
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!token) {
            res.status(503).send("未設定 LINE Channel Access Token，無法取得圖片");
            return;
        }
        try {
            const resp = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!resp.ok) {
                res.status(resp.status).send("無法取得 LINE 圖片");
                return;
            }
            const contentType = resp.headers.get("content-type") || "image/jpeg";
            res.setHeader("Content-Type", contentType);
            const buf = await resp.arrayBuffer();
            res.send(Buffer.from(buf));
        }
        catch (e) {
            console.error("[admin] 取得 LINE 圖片失敗:", e?.message || e);
            res.status(500).send("取得圖片時發生錯誤");
        }
    });
    router.post("/orders/:orderId/items", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || (req.get("Accept") || "").includes("application/json");
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            if (wantsJson) {
                res.status(404).json({ error: "訂單不存在" });
                return;
            }
            res.status(404).send("訂單不存在");
            return;
        }
        const body = req.body;
        const existingItems = await db.prepare("SELECT id FROM order_items WHERE order_id = ?").all(orderId);
        for (const key of Object.keys(body)) {
            if (key.startsWith("qty_")) {
                const itemId = key.slice(4);
                const qty = parseFloat(body[key]);
                if (!Number.isFinite(qty) || qty < 0)
                    continue;
                await db.prepare("UPDATE order_items SET quantity = ? WHERE id = ? AND order_id = ?").run(qty, itemId, orderId);
            }
            else if (key.startsWith("unit_")) {
                const itemId = key.slice(5);
                const unit = (body[key] ?? "").trim() || null;
                await db.prepare("UPDATE order_items SET unit = ? WHERE id = ? AND order_id = ?").run(unit, itemId, orderId);
            }
            else if (key.startsWith("remark_")) {
                const itemId = key.slice(7);
                const remark = (body[key] ?? "").trim() || null;
                await db.prepare("UPDATE order_items SET remark = ? WHERE id = ? AND order_id = ?").run(remark, itemId, orderId);
            }
        }
        for (const row of existingItems) {
            const includeExport = body["include_" + row.id] === "1" ? 1 : 0;
            await db.prepare("UPDATE order_items SET include_export = ? WHERE id = ? AND order_id = ?").run(includeExport, row.id, orderId);
        }
        if (wantsJson) {
            res.json({ ok: true });
            return;
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=items");
    });
    router.post("/orders/:orderId/items/:itemId/delete", async (req, res) => {
        const { orderId, itemId } = req.params;
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        await db.prepare("DELETE FROM order_items WHERE id = ? AND order_id = ?").run(itemId, orderId);
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest";
        if (wantsJson) {
            res.json({ ok: true });
            return;
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=del_item#items");
    });
    router.get("/orders/:orderId/items/add", async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare("SELECT id, order_date, customer_id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const products = await db.prepare("SELECT id, name, erp_code, unit FROM products WHERE (active IS NULL OR active = 1) ORDER BY name").all();
        const productOptions = products.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)} ${escapeHtml(p.erp_code ?? "")}</option>`).join("");
        const units = ["公斤", "斤", "把", "包", "件", "箱", "顆", "粒", "盒", "袋", "個"];
        const unitOpts = units.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單查詢</a> / <a href="/admin/orders/${encodeURIComponent(orderId)}">訂單明細</a> / 增加品項</div>
        <h1 class="notion-page-title">增加品項</h1>
        <div class="notion-card">
          <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/items/add">
            <label>品項 <select name="product_id" required style="width:100%;">${productOptions}</select></label>
            <label>數量 <input type="number" name="quantity" step="any" min="0" value="0" required style="width:8rem;"></label>
            <label>單位 <select name="unit" style="width:8rem;">${unitOpts}</select></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button> <a href="/admin/orders/${encodeURIComponent(orderId)}#items" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("增加品項", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/orders/:orderId/items/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const productId = req.body.product_id?.trim();
        const qty = parseFloat(req.body.quantity);
        const unit = (req.body.unit || "").trim() || null;
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        if (!productId || !Number.isFinite(qty) || qty < 0) {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "/items/add?err=1");
            return;
        }
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "/items/add?err=product");
            return;
        }
        const itemId = (0, id_js_1.newId)("item");
        await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export) VALUES (?, ?, ?, ?, ?, ?, 0, 1)").run(itemId, orderId, productId, product.name, qty, unit);
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=add_item#items");
    });
    router.get("/barcode", async (req, res) => {
        const code = req.query.code?.trim();
        if (!code || code.length > 80) {
            res.status(400).send("缺少或無效的 code 參數");
            return;
        }
        try {
            const png = await bwip_js_1.default.toBuffer({
                bcid: "code128",
                text: code,
                scale: 2,
                height: 10,
                includetext: false,
            });
            res.type("image/png").send(png);
        }
        catch (e) {
            console.error("[admin] barcode error", e);
            res.status(500).send("條碼產生失敗");
        }
    });
    router.get("/orders/:orderId/order-sheet", async (req, res) => {
        const { orderId } = req.params;
        const preview = req.query.preview === "1";
        const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.quantity, oi.unit, oi.remark, p.erp_code, p.name AS product_name, p.teraoka_barcode
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1)
    `).all(orderId);
        const rows = items.map((i) => {
            const erp = i.erp_code ?? "—";
            const pname = i.product_name ?? "待確認";
            const qty = i.quantity;
            const u = i.unit && i.unit.trim() ? i.unit : "";
            const remark = (i.remark && i.remark.trim()) ? escapeHtml(i.remark.trim()) : "—";
            const teraokaCode = i.teraoka_barcode && i.teraoka_barcode.trim() ? escapeHtml(i.teraoka_barcode) : "—";
            const teraokaName = escapeHtml(i.product_name || "");
            const teraokaCell = i.teraoka_barcode && i.teraoka_barcode.trim()
                ? `<div class="teraoka-cell"><span class="code">${teraokaCode}</span><span class="name">${teraokaName || "—"}</span><br><img src="/admin/barcode?code=${encodeURIComponent(i.teraoka_barcode.trim())}" alt="" style="height:40px;"></div>`
                : `<div class="teraoka-cell"><span class="code">—</span><span class="name">${teraokaName || "—"}</span></div>`;
            return `<tr><td>${escapeHtml(erp)}</td><td>${escapeHtml(pname)}</td><td>${qty}</td><td>${escapeHtml(u)}</td><td>${remark}</td><td>${teraokaCell}</td></tr>`;
        }).join("");
        const customerBarcode = order.customer_teraoka_code && order.customer_teraoka_code.trim()
            ? `<p><strong>客戶條碼</strong>（${escapeHtml(order.customer_name)}）<br><img src="/admin/barcode?code=${encodeURIComponent(order.customer_teraoka_code.trim())}" alt="客戶條碼" style="height:56px;"></p>`
            : "";
        const sheetBody = `
        <div class="no-print notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單查詢</a> / <a href="/admin/orders/${encodeURIComponent(orderId)}">訂單明細</a> / 訂貨單</div>
        ${preview ? "<p class=\"no-print\"><button type=\"button\" class=\"btn btn-primary\" id=\"exportJpgBtn\">匯出 JPG</button> 預覽下方訂單圖後可點此匯出</p>" : ""}
        <div id="order-sheet-content" style="margin-top:12px; width:210mm; min-height:297mm; box-sizing:border-box; background:white; padding:1rem;" class="order-sheet-a4">
        <div class="notion-card">
        <h1 class="notion-page-title">訂貨單</h1>
        <p>訂單編號：${escapeHtml(order.order_no ?? "—")}　日期：${escapeHtml(order.order_date)}　客戶：${escapeHtml(order.customer_name)}</p>
          <table>
            <thead><tr><th>凌越料號</th><th>凌越品名</th><th>叫貨數量</th><th>叫貨單位</th><th>備註</th><th>寺岡（料號／條碼）</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${customerBarcode ? `<div class="notion-card" style="margin-top:1.5rem;">${customerBarcode}</div>` : ""}
        </div>
        <p class="no-print" style="margin-top:1rem;"><a href="/admin/orders/${encodeURIComponent(orderId)}">← 回訂單明細</a></p>
        ${preview ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script><script>document.getElementById("exportJpgBtn").onclick=function(){ var el = document.getElementById("order-sheet-content"); if (typeof html2canvas !== "undefined") { html2canvas(el, { useCORS: true, allowTaint: true, scale: 2 }).then(function(canvas){ var a = document.createElement("a"); a.download = "order-sheet-' + orderId + '.jpg"; a.href = canvas.toDataURL("image/jpeg", 0.92); a.click(); }); } };</script>' : ""}
      `;
        res.type("text/html").send(notionPage("訂貨單", sheetBody, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/customers/new", async (req, res) => {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / 新增客戶</div>
        <h1 class="notion-page-title">新增客戶</h1>
        <div class="notion-card">
          <form method="post" action="/admin/customers/new">
            <label>客戶名稱 <input type="text" name="name" required placeholder="例：XX餐廳" style="width:100%;"></label>
            <label>寺岡編號（CustCode／QR） <input type="text" name="teraoka_code" placeholder="可留空" style="width:100%;"></label>
            <label>凌越編號（HQCustCode） <input type="text" name="hq_cust_code" placeholder="可留空" style="width:100%;"></label>
            <label>LINE 群組名稱 <input type="text" name="line_group_name" placeholder="可留空，之後可改" style="width:100%;"></label>
            <label>LINE 群組 ID <input type="text" name="line_group_id" placeholder="C開頭群組 ID，可留空後補" style="width:100%;"></label>
            <label>聯絡方式 <input type="text" name="contact" placeholder="電話或備註，可留空" style="width:100%;"></label>
            <label>第幾號線（檢貨路線）<select name="route_line"><option value="">— 不指定</option>${[1,2,3,4,5,6,7,8,9].map((n) => `<option value="${n}">${n} 號線</option>`).join("")}</select></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">建立</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增客戶", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/customers/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = req.body.name?.trim();
        const teraokaCode = req.body.teraoka_code?.trim() || null;
        const hqCustCode = req.body.hq_cust_code?.trim() || null;
        const lineGroupName = req.body.line_group_name?.trim() || null;
        const lineGroupId = (req.body.line_group_id || "").replace(/\s/g, "").trim() || null;
        const contact = req.body.contact?.trim() || null;
        const routeLineRaw = req.body.route_line?.trim();
        const routeLine = routeLineRaw && /^[1-9]$/.test(routeLineRaw) ? parseInt(routeLineRaw, 10) : null;
        if (!name) {
            res.redirect("/admin/customers/new?err=name");
            return;
        }
        const id = (0, id_js_1.newId)("cust");
        await db.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, route_line) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact, routeLine);
        res.redirect("/admin/customers?ok=1");
    });
    router.get("/customers/:id/quick-view", async (req, res) => {
        const customer = await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active FROM customers WHERE id = ?").get(req.params.id);
        if (!customer) {
            res.status(404).send("客戶不存在");
            return;
        }
        const aliases = await db.prepare(`
      SELECT cpa.alias, p.name AS product_name
      FROM customer_product_aliases cpa
      JOIN products p ON p.id = cpa.product_id
      WHERE cpa.customer_id = ?
      ORDER BY cpa.alias
    `).all(customer.id);
        const fromOrders = req.query.from === "orders";
        const backLink = fromOrders ? "<a href=\"/admin/orders\">← 回訂單查詢</a>" : "<a href=\"/admin/customers\">← 回客戶列表</a>";
        const editLink = fromOrders
            ? `<a href="/admin/customers/${encodeURIComponent(customer.id)}/edit?from=orders">編輯</a>`
            : `<a href="/admin/customers/${encodeURIComponent(customer.id)}/edit">編輯</a>`;
        const aliasRows = aliases.map((a) => `<tr><td>${escapeHtml(a.alias)}</td><td>${escapeHtml(a.product_name)}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / ${escapeHtml(customer.name)}</div>
        <h1 class="notion-page-title">${escapeHtml(customer.name)}</h1>
        <div class="notion-card">
          <p><strong>聯絡</strong>：${escapeHtml(customer.contact ?? "—")}</p>
          <p><strong>預設單位</strong>（未填時）：${escapeHtml(customer.default_unit || "公斤")}</p>
          <p><strong>寺岡／凌越編號</strong>：${escapeHtml(customer.teraoka_code ?? "—")}／${escapeHtml(customer.hq_cust_code ?? "—")}</p>
          <p><strong>LINE 群組</strong>：${escapeHtml(customer.line_group_name ?? "—")} ${customer.line_group_id ? "（已綁定）" : "（未綁定）"}</p>
        </div>
        <div class="notion-card">
          <h2>叫貨備註／特殊情況</h2>
          <p style="white-space:pre-wrap;margin:0;background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);">${escapeHtml(customer.order_notes || "（無）")}</p>
        </div>
        <div class="notion-card">
          <h2>此客戶專用別名</h2>
          <table><thead><tr><th>客戶常叫的名稱</th><th>對應品項</th></tr></thead><tbody>${aliasRows || "<tr><td colspan='2'>尚無</td></tr>"}</tbody></table>
        </div>
        <p>${editLink}　${backLink}</p>
      `;
        res.type("text/html").send(notionPage("客戶資料", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/customers/:id/edit", async (req, res) => {
        try {
            const customer = await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, route_line FROM customers WHERE id = ?").get(req.params.id);
            if (!customer) {
                res.status(404).send("客戶不存在");
                return;
            }
            const v = (s) => escapeAttr(s ?? "");
            const activeChecked = customer.active === undefined || customer.active === null || customer.active === 1;
            const editMsg = req.query.ok === "alias" ? "<p style='color:green'>已新增專用別名。</p>" : req.query.ok === "alias_del" ? "<p style='color:green'>已刪除專用別名。</p>" : req.query.err === "alias" ? "<p style='color:red'>請填寫別名與品項。</p>" : req.query.err === "dup" ? "<p style='color:red'>此客戶已存在相同別名。</p>" : "";
            const custAliases = await db.prepare(`
      SELECT cpa.id, cpa.alias, p.name AS product_name
      FROM customer_product_aliases cpa
      JOIN products p ON p.id = cpa.product_id
      WHERE cpa.customer_id = ?
      ORDER BY cpa.alias
    `).all(customer.id);
            const productList = await db.prepare("SELECT id, name FROM products WHERE (active IS NULL OR active = 1) ORDER BY name").all();
            const productOptions = productList.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join("");
            const aliasRows = custAliases
            .map((a) => `<tr><td>${escapeHtml(a.alias)}</td><td>${escapeHtml(a.product_name)}</td><td><form method="post" action="/admin/customers/${encodeURIComponent(customer.id)}/alias/${encodeURIComponent(a.id)}/delete" style="display:inline;"><button type="submit">刪除</button></form></td></tr>`)
            .join("");
        const editBody = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / 編輯客戶</div>
        <h1 class="notion-page-title">編輯客戶</h1>
        ${editMsg ? `<div class="notion-msg ${editMsg.indexOf("已") >= 0 ? "ok" : "err"}">${editMsg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <form method="post" action="/admin/customers/${v(customer.id)}/edit">
            ${req.query.from === "orders" ? '<input type="hidden" name="from" value="orders">' : ""}
            <label>客戶名稱 <input type="text" name="name" value="${v(customer.name)}" required style="width:100%;"></label>
            <label>寺岡編號（CustCode／QR） <input type="text" name="teraoka_code" value="${v(customer.teraoka_code)}" style="width:100%;"></label>
            <label>凌越編號（HQCustCode） <input type="text" name="hq_cust_code" value="${v(customer.hq_cust_code)}" style="width:100%;"></label>
            <label>LINE 群組名稱 <input type="text" name="line_group_name" value="${v(customer.line_group_name)}" placeholder="可之後填" style="width:100%;"></label>
            <label>LINE 群組 ID <input type="text" name="line_group_id" value="${v(customer.line_group_id)}" placeholder="C開頭，綁定後機器人會認此群組" style="width:100%;"></label>
            <label>聯絡方式 <input type="text" name="contact" value="${v(customer.contact)}" style="width:100%;"></label>
            <label>第幾號線（檢貨路線）<select name="route_line"><option value="">— 不指定</option>${[1,2,3,4,5,6,7,8,9].map((n) => `<option value="${n}" ${customer.route_line === n ? "selected" : ""}>${n} 號線</option>`).join("")}</select></label>
            <label>預設單位（客戶只打數字未填單位時使用）<select name="default_unit">
              <option value="" ${!customer.default_unit ? "selected" : ""}>公斤</option>
              <option value="公斤" ${customer.default_unit === "公斤" ? "selected" : ""}>公斤</option>
              <option value="斤" ${customer.default_unit === "斤" ? "selected" : ""}>斤</option>
              <option value="把" ${customer.default_unit === "把" ? "selected" : ""}>把</option>
              <option value="包" ${customer.default_unit === "包" ? "selected" : ""}>包</option>
              <option value="件" ${customer.default_unit === "件" ? "selected" : ""}>件</option>
              <option value="箱" ${customer.default_unit === "箱" ? "selected" : ""}>箱</option>
              <option value="顆" ${customer.default_unit === "顆" ? "selected" : ""}>顆</option>
              <option value="粒" ${customer.default_unit === "粒" ? "selected" : ""}>粒</option>
              <option value="盒" ${customer.default_unit === "盒" ? "selected" : ""}>盒</option>
              <option value="袋" ${customer.default_unit === "袋" ? "selected" : ""}>袋</option>
            </select></label>
            <label>叫貨備註／習慣說明 <textarea name="order_notes" placeholder="此客戶叫貨的習慣、特定說法或規則，僅供內部參考" style="width:100%;min-height:60px;">${v(customer.order_notes)}</textarea></label>
            <label><input type="checkbox" name="active" value="1" ${activeChecked ? "checked" : ""}> 啟用（未勾選＝停用）</label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
        <div class="notion-card">
          <h2>此客戶專用別名（叫貨習慣）</h2>
          <p>此客戶在 LINE 叫貨時若輸入下列名稱，會對應到指定品項（僅此客戶適用）。</p>
          <table>
            <thead><tr><th>客戶常叫的名稱</th><th>對應品項</th><th>操作</th></tr></thead>
            <tbody>${aliasRows || "<tr><td colspan='3'>尚無專用別名</td></tr>"}</tbody>
          </table>
          <form method="post" action="/admin/customers/${v(customer.id)}/alias" style="margin-top:12px;">
            <label style="margin:0;">新增：客戶叫「<input type="text" name="alias" required placeholder="例：大陸妹">」→ 對應 <select name="product_id" required>${productOptions}</select></label>
            <button type="submit" class="btn">新增</button>
          </form>
        </div>
        <p>${req.query.from === "orders" ? `<a href="/admin/orders">← 回訂單查詢</a>` : `<a href="/admin/customers">← 回客戶列表</a>`}</p>
      `;
            res.type("text/html").send(notionPage("編輯客戶", editBody, "", res.locals.topBarHtml, res.locals.actionBarHtml));
        }
        catch (e) {
            console.error("[admin] 客戶編輯頁錯誤:", e);
            res.redirect("/admin/customers?err=" + encodeURIComponent("載入失敗：" + (e.message || String(e)).slice(0, 80)));
        }
    });
    router.post("/customers/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const name = req.body.name?.trim();
        const teraokaCode = req.body.teraoka_code?.trim() || null;
        const hqCustCode = req.body.hq_cust_code?.trim() || null;
        const lineGroupName = req.body.line_group_name?.trim() || null;
        const lineGroupId = (req.body.line_group_id || "").replace(/\s/g, "").trim() || null;
        const contact = req.body.contact?.trim() || null;
        const routeLineRaw = req.body.route_line?.trim();
        const routeLine = routeLineRaw && /^[1-9]$/.test(routeLineRaw) ? parseInt(routeLineRaw, 10) : null;
        const defaultUnit = req.body.default_unit?.trim() || null;
        const orderNotes = req.body.order_notes?.trim() || null;
        const active = req.body.active === "1" ? 1 : 0;
        if (!name) {
            res.redirect("/admin/customers/" + encodeURIComponent(id) + "/edit?err=name");
            return;
        }
        await db.prepare("UPDATE customers SET name = ?, teraoka_code = ?, hq_cust_code = ?, line_group_name = ?, line_group_id = ?, contact = ?, route_line = ?, default_unit = ?, order_notes = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact, routeLine, defaultUnit, orderNotes, active, id);
        const fromOrders = req.body?.from === "orders";
        res.redirect(fromOrders ? "/admin/orders?ok=edit" : "/admin/customers?ok=edit");
    });
    router.post("/customers/:id/alias", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const customerId = req.params.id;
        const alias = req.body?.alias?.trim();
        const productId = req.body?.product_id?.trim();
        if (!alias || !productId) {
            res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?err=alias");
            return;
        }
        const cust = await db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
        if (!cust) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        try {
            const id = (0, id_js_1.newId)("cpa");
            await db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(id, customerId, productId, alias);
        }
        catch (e) {
            res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?err=dup");
            return;
        }
        res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?ok=alias");
    });
    router.post("/customers/:id/alias/:aliasId/delete", async (req, res) => {
        const customerId = req.params.id;
        const aliasId = req.params.aliasId;
        const row = await db.prepare("SELECT id FROM customer_product_aliases WHERE id = ? AND customer_id = ?").get(aliasId, customerId);
        if (!row) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("找不到此別名"));
            return;
        }
        await db.prepare("DELETE FROM customer_product_aliases WHERE id = ?").run(aliasId);
        res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?ok=alias_del");
    });
    router.get("/customers", async (req, res) => {
        const msg = req.query.ok === "1"
            ? "<p style='color:green'>客戶已建立。</p>"
            : req.query.ok === "edit"
                ? "<p style='color:green'>已儲存。</p>"
                : req.query.ok === "del"
                        ? "<p style='color:green'>已刪除。</p>"
                        : req.query.err
                            ? "<p style='color:red'>" + escapeHtml(String(req.query.err)) + "</p>"
                            : "";
        const q = req.query.q?.trim() ?? "";
        const rows = (q
            ? await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, active FROM customers WHERE name LIKE ? ORDER BY name").all("%" + q + "%")
            : await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, active FROM customers ORDER BY name").all());
        const makeRow = (r) => {
            const active = r.active === 1 || r.active === "1" || r.active === undefined || r.active === null;
            return `<tr data-customer-id="${escapeAttr(r.id)}">
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.teraoka_code ?? "")}</td>
            <td>${escapeHtml(r.hq_cust_code ?? "")}</td>
            <td>${escapeHtml(r.line_group_name ?? "")}</td>
            <td>${r.line_group_id ? "已綁定" : "—"}</td>
            <td>${escapeHtml(r.contact ?? "")}</td>
            <td class="customer-status-cell">${active ? "<span style='color:green'>啟用</span>" : "<span style='color:gray'>停用</span>"}</td>
            <td>
              <a href="/admin/customers/${encodeURIComponent(r.id)}/edit">編輯</a>
              | <button type="button" class="customer-toggle-btn" data-id="${escapeAttr(r.id)}" data-active="${active ? "1" : "0"}">${active ? "停用" : "啟用"}</button>
              | <a href="/admin/customers/${encodeURIComponent(r.id)}/delete">刪除</a>
            </td>
          </tr>`;
        };
        const isCustomerActive = (r) => r.active === 1 || r.active === "1" || r.active === undefined || r.active === null;
        const activeList = rows.filter(isCustomerActive);
        const inactiveList = rows.filter((r) => !isCustomerActive(r));
        const tbodyActive = activeList.map(makeRow).join("") || "<tr class=\"customers-placeholder\"><td colspan='8'>無啟用客戶</td></tr>";
        const tbodyInactive = inactiveList.map(makeRow).join("") || "<tr class=\"customers-placeholder\"><td colspan='8'>無停用客戶</td></tr>";
        const searchVal = escapeAttr(q);
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 客戶管理</div>
        <h1 class="notion-page-title">客戶管理</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/customers/new">＋ 新增客戶</a>、<a href="/admin/import-customers">匯入客戶</a></p>
        <form method="get" action="/admin/customers" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;">
          <label style="margin:0;">搜尋（名稱模糊）：<input type="search" name="q" value="${searchVal}" placeholder="輸入關鍵字" style="width:220px;"></label>
          <button type="submit" class="btn">搜尋</button>
          ${q ? `<a href="/admin/customers" class="btn">清除</a>` : ""}
        </form>
        <p class="notion-msg ok" style="margin-bottom:16px;">匯入後可點「編輯」補上 LINE 群組名稱、LINE 群組 ID。停用後該群組將不再對應叫貨。</p>
        <div class="notion-card">
          <div class="tab-bar" style="display:flex;gap:0;border-bottom:1px solid var(--notion-border);margin-bottom:0;">
            <button type="button" class="tab-btn active" data-tab="customers-active" style="padding:10px 16px;border:none;background:transparent;cursor:pointer;font-size:14px;border-bottom:2px solid var(--notion-accent);margin-bottom:-1px;">啟用</button>
            <button type="button" class="tab-btn" data-tab="customers-inactive" style="padding:10px 16px;border:none;background:transparent;cursor:pointer;font-size:14px;color:var(--notion-text-muted);">停用</button>
          </div>
          <div id="customers-active-panel" class="tab-panel">
            <table>
              <thead><tr><th>名稱</th><th>寺岡編號</th><th>凌越編號</th><th>LINE 群組名稱</th><th>LINE 綁定</th><th>聯絡</th><th>狀態</th><th>操作</th></tr></thead>
              <tbody id="customers-active-tbody">${tbodyActive}</tbody>
            </table>
          </div>
          <div id="customers-inactive-panel" class="tab-panel" style="display:none;">
            <table>
              <thead><tr><th>名稱</th><th>寺岡編號</th><th>凌越編號</th><th>LINE 群組名稱</th><th>LINE 綁定</th><th>聯絡</th><th>狀態</th><th>操作</th></tr></thead>
              <tbody id="customers-inactive-tbody">${tbodyInactive}</tbody>
            </table>
          </div>
        </div>
        <script>
        (function(){
          var activeTbody = document.getElementById("customers-active-tbody");
          var inactiveTbody = document.getElementById("customers-inactive-tbody");
          function removePlaceholder(tbody){
            var first = tbody && tbody.firstElementChild;
            if (first && first.classList && first.classList.contains("customers-placeholder")) tbody.removeChild(first);
          }
          function moveRow(row, toActive){
            var statusCell = row.querySelector(".customer-status-cell");
            var btn = row.querySelector(".customer-toggle-btn");
            if (statusCell) statusCell.innerHTML = toActive ? "<span style=\\"color:green\\">啟用</span>" : "<span style=\\"color:gray\\">停用</span>";
            if (btn){ btn.dataset.active = toActive ? "1" : "0"; btn.textContent = toActive ? "停用" : "啟用"; }
            var fromTbody = row.parentNode;
            var toTbody = toActive ? activeTbody : inactiveTbody;
            removePlaceholder(toTbody);
            fromTbody.removeChild(row);
            toTbody.appendChild(row);
            if (fromTbody.children.length === 0)
              fromTbody.innerHTML = "<tr class=\\"customers-placeholder\\"><td colspan=\\"8\\">" + (fromTbody.id === "customers-active-tbody" ? "無啟用客戶" : "無停用客戶") + "</td></tr>";
          }
          document.querySelectorAll(".tab-btn[data-tab]").forEach(function(btn){
            btn.addEventListener("click", function(){
              var tab = this.dataset.tab;
              document.querySelectorAll(".tab-btn[data-tab]").forEach(function(b){ b.classList.remove("active"); b.style.borderBottom = "none"; b.style.color = ""; });
              this.classList.add("active"); this.style.borderBottom = "2px solid var(--notion-accent)"; this.style.color = "";
              document.querySelectorAll(".tab-panel").forEach(function(p){ p.style.display = "none"; });
              var panel = document.getElementById(tab + "-panel");
              if (panel) panel.style.display = "block";
            });
          });
          document.querySelectorAll(".customer-toggle-btn").forEach(function(btn){
            btn.addEventListener("click", function(){
              var el = this, id = el.dataset.id;
              if (!id) return;
              el.disabled = true;
              fetch("/admin/api/customers/" + encodeURIComponent(id) + "/toggle", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "", credentials: "same-origin" })
                .then(function(r){ return r.json(); })
                .then(function(data){
                  if (data && data.ok === true) {
                    var row = el.closest("tr");
                    if (row) moveRow(row, data.active === 1);
                  }
                  el.disabled = false;
                })
                .catch(function(){ el.disabled = false; });
            });
          });
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("客戶管理", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/api/customers/:id/toggle", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id, active FROM customers WHERE id = ?").get(id);
        if (!row) {
            res.status(404).json({ ok: false, err: "找不到此客戶" });
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE customers SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.json({ ok: true, active: next });
    });
    router.post("/customers/:id/toggle", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT active FROM customers WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE customers SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.redirect("/admin/customers?ok=toggle");
    });
    router.get("/customers/:id/delete", async (req, res) => {
        const customer = await db.prepare("SELECT id, name FROM customers WHERE id = ?").get(req.params.id);
        if (!customer) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        const orderCount = await db.prepare("SELECT COUNT(*) AS c FROM orders WHERE customer_id = ?").get(customer.id);
        const hasOrders = (orderCount?.c ?? 0) > 0;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除客戶</h1>
        <div class="notion-card">
          <p>確定要刪除「${escapeHtml(customer.name)}」？</p>
          ${hasOrders ? "<p class=\"notion-msg err\">此客戶已有訂單，無法刪除。請改為「停用」。</p>" : ""}
          <p style="margin-top:16px;">
            ${!hasOrders ? `<form method="post" action="/admin/customers/${encodeURIComponent(customer.id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form> ` : ""}
            <a href="/admin/customers" class="btn">取消</a>
          </p>
        </div>
      `;
        res.type("text/html").send(notionPage("確認刪除", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/customers/:id/delete", async (req, res) => {
        const id = req.params.id;
        const orderCount = await db.prepare("SELECT COUNT(*) AS c FROM orders WHERE customer_id = ?").get(id);
        if ((orderCount?.c ?? 0) > 0) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("此客戶已有訂單，無法刪除。請改為停用。"));
            return;
        }
        await db.prepare("DELETE FROM customers WHERE id = ?").run(id);
        res.redirect("/admin/customers?ok=del");
    });
    router.get("/products", async (req, res) => {
        const q = req.query.q?.trim() ?? "";
        let products = await db.prepare(`
      SELECT id, name, erp_code, teraoka_barcode, unit, active
      FROM products
      ORDER BY name
    `).all();
        if (q) {
            products = products.filter((p) => p.name.includes(q) ||
                (p.erp_code && p.erp_code.includes(q)) ||
                (p.teraoka_barcode && p.teraoka_barcode.includes(q)));
        }
        const aliasesByProduct = new Map();
        const aliasRows = await db.prepare("SELECT product_id, alias FROM product_aliases").all();
        for (const a of aliasRows) {
            if (!aliasesByProduct.has(a.product_id))
                aliasesByProduct.set(a.product_id, []);
            aliasesByProduct.get(a.product_id).push(a.alias);
        }
        const specsByProduct = new Map();
        try {
            const specRows = await db.prepare("SELECT product_id, unit, note_label, conversion_kg FROM product_unit_specs").all();
            for (const s of specRows) {
                if (!specsByProduct.has(s.product_id))
                    specsByProduct.set(s.product_id, []);
                const t = s.conversion_kg != null ? `${s.unit}（${s.conversion_kg}kg）` : (s.note_label || s.unit);
                specsByProduct.get(s.product_id).push(t);
            }
        }
        catch (_) { /* product_unit_specs 可能尚未建立 */ }
        const okMsg = req.query.ok === "del" ? "已刪除品項。" : req.query.ok === "edit" ? "已儲存。" : req.query.err ? "" : "";
        const msg = okMsg ? "<p style='color:green'>" + okMsg + "</p>" : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const makeRow = (p) => {
            const specSummary = (specsByProduct.get(p.id) ?? []).map((x) => escapeHtml(x)).join("、") || "—";
            const isActive = p.active === 1 || p.active === "1" || p.active === undefined || p.active === null;
            const statusHtml = isActive ? "啟用" : "<span style='color:#888'>停用</span>";
            const toggleLabel = isActive ? "停用" : "啟用";
            return `<tr data-product-id="${escapeAttr(p.id)}">
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.erp_code ?? "")}</td>
            <td>${escapeHtml(p.teraoka_barcode ?? "")}</td>
            <td>${escapeHtml(p.unit)}</td>
            <td>${(aliasesByProduct.get(p.id) ?? []).map((a) => escapeHtml(a)).join("、") || "—"} <a href="/admin/products/${encodeURIComponent(p.id)}/aliases">管理</a></td>
            <td>${specSummary} <a href="/admin/products/${encodeURIComponent(p.id)}/aliases#specs">設定</a></td>
            <td class="product-status-cell">${statusHtml}</td>
            <td>
              <a href="/admin/products/${encodeURIComponent(p.id)}/edit">編輯</a>
              | <button type="button" class="product-toggle-btn" data-id="${escapeAttr(p.id)}" data-active="${isActive ? "1" : "0"}">${escapeHtml(toggleLabel)}</button>
              | <a href="/admin/products/${encodeURIComponent(p.id)}/delete">刪除</a>
            </td>
          </tr>`;
        };
        const isProductActive = (p) => p.active === 1 || p.active === "1" || p.active === undefined || p.active === null;
        const activeList = products.filter(isProductActive);
        const inactiveList = products.filter((p) => !isProductActive(p));
        const tbodyActive = activeList.map(makeRow).join("") || "<tr class=\"products-placeholder\"><td colspan='8'>無啟用品項</td></tr>";
        const tbodyInactive = inactiveList.map(makeRow).join("") || "<tr class=\"products-placeholder\"><td colspan='8'>無停用品項</td></tr>";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 品項與俗名</div>
        <h1 class="notion-page-title">品項與俗名</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/import">匯入品項</a>、<a href="/admin/import-teraoka">寺岡資料對照</a></p>
        <form method="get" action="/admin/products" style="margin-bottom:16px;">
          <input type="search" name="q" value="${escapeAttr(q)}" placeholder="搜尋品名、料號、條碼">
          <button type="submit" class="btn">搜尋</button>
        </form>
        <div class="notion-card">
          <div class="tab-bar" style="display:flex;gap:0;border-bottom:1px solid var(--notion-border);margin-bottom:0;">
            <button type="button" class="tab-btn active" data-tab="products-active" style="padding:10px 16px;border:none;background:transparent;cursor:pointer;font-size:14px;border-bottom:2px solid var(--notion-accent);margin-bottom:-1px;">啟用</button>
            <button type="button" class="tab-btn" data-tab="products-inactive" style="padding:10px 16px;border:none;background:transparent;cursor:pointer;font-size:14px;color:var(--notion-text-muted);">停用</button>
          </div>
          <div id="products-active-panel" class="tab-panel">
            <table>
              <thead><tr><th>標準品名</th><th>凌越料號</th><th>寺岡條碼</th><th>單位</th><th>俗名</th><th>規格</th><th>狀態</th><th>操作</th></tr></thead>
              <tbody id="products-active-tbody">${tbodyActive}</tbody>
            </table>
          </div>
          <div id="products-inactive-panel" class="tab-panel" style="display:none;">
            <table>
              <thead><tr><th>標準品名</th><th>凌越料號</th><th>寺岡條碼</th><th>單位</th><th>俗名</th><th>規格</th><th>狀態</th><th>操作</th></tr></thead>
              <tbody id="products-inactive-tbody">${tbodyInactive}</tbody>
            </table>
          </div>
        </div>
        <script>
        (function(){
          var activeTbody = document.getElementById("products-active-tbody");
          var inactiveTbody = document.getElementById("products-inactive-tbody");
          function removePlaceholder(tbody){
            var first = tbody && tbody.firstElementChild;
            if (first && first.classList && first.classList.contains("products-placeholder")) tbody.removeChild(first);
          }
          function moveRow(row, toActive){
            var statusCell = row.querySelector(".product-status-cell");
            var btn = row.querySelector(".product-toggle-btn");
            if (statusCell) statusCell.innerHTML = toActive ? "啟用" : "<span style=\\"color:#888\\">停用</span>";
            if (btn){ btn.dataset.active = toActive ? "1" : "0"; btn.textContent = toActive ? "停用" : "啟用"; }
            var fromTbody = row.parentNode;
            var toTbody = toActive ? activeTbody : inactiveTbody;
            removePlaceholder(toTbody);
            fromTbody.removeChild(row);
            toTbody.appendChild(row);
            if (fromTbody.children.length === 0)
              fromTbody.innerHTML = "<tr class=\\"products-placeholder\\"><td colspan=\\"8\\">" + (fromTbody.id === "products-active-tbody" ? "無啟用品項" : "無停用品項") + "</td></tr>";
          }
          document.querySelectorAll(".tab-btn[data-tab]").forEach(function(btn){
            btn.addEventListener("click", function(){
              var tab = this.dataset.tab;
              document.querySelectorAll(".tab-btn[data-tab]").forEach(function(b){ b.classList.remove("active"); b.style.borderBottom = "none"; b.style.color = ""; });
              this.classList.add("active"); this.style.borderBottom = "2px solid var(--notion-accent)"; this.style.color = "";
              document.querySelectorAll(".tab-panel").forEach(function(p){ p.style.display = "none"; });
              var panel = document.getElementById(tab + "-panel");
              if (panel) panel.style.display = "block";
            });
          });
          document.querySelectorAll(".product-toggle-btn").forEach(function(btn){
            btn.addEventListener("click", function(){
              var el = this, id = el.dataset.id;
              if (!id) return;
              el.disabled = true;
              fetch("/admin/api/products/" + encodeURIComponent(id) + "/toggle", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "", credentials: "same-origin" })
                .then(function(r){ return r.json(); })
                .then(function(data){
                  if (data && data.ok === true) {
                    var row = el.closest("tr");
                    if (row) moveRow(row, data.active === 1);
                  }
                  el.disabled = false;
                })
                .catch(function(){ el.disabled = false; });
            });
          });
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("品項與俗名", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.get("/products/:id/aliases", async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const aliases = await db.prepare("SELECT id, alias FROM product_aliases WHERE product_id = ? ORDER BY alias").all(productId);
        let specs = [];
        try {
            specs = await db.prepare("SELECT id, unit, note_label, conversion_kg FROM product_unit_specs WHERE product_id = ? ORDER BY unit").all(productId);
        }
        catch (_) { /* 表可能尚未存在 */ }
        const specMsg = req.query.spec_ok === "1" ? "<p style='color:green'>規格已新增。</p>" : req.query.spec_del ? "<p style='color:green'>規格已刪除。</p>" : "";
        const msg = req.query.ok === "1" ? "<p style='color:green'>已儲存。</p>" : req.query.ok === "del" ? "<p style='color:green'>已刪除。</p>" : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const rows = aliases
            .map((a) => `<tr>
            <td>${escapeHtml(a.alias)}</td>
            <td><a href="/admin/aliases/${encodeURIComponent(a.id)}/edit">編輯</a> | <form method="post" action="/admin/aliases/${encodeURIComponent(a.id)}/delete" style="display:inline;"><button type="submit">刪除</button></form></td>
          </tr>`)
            .join("");
        const specRows = specs
            .map((s) => `<tr>
            <td>${escapeHtml(s.unit)}</td>
            <td>${escapeHtml(s.note_label ?? "")}</td>
            <td>${s.conversion_kg != null ? s.conversion_kg : "—"}</td>
            <td><form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs/${encodeURIComponent(s.id)}/delete" style="display:inline;"><button type="submit" class="btn">刪除</button></form></td>
          </tr>`)
            .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / 俗名管理</div>
        <h1 class="notion-page-title">俗名管理：${escapeHtml(product.name)}</h1>
        ${msg}${specMsg}
        <div class="notion-card">
          <h2>俗名</h2>
          <table>
            <thead><tr><th>俗名（別名）</th><th>操作</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='2'>尚無俗名</td></tr>"}</tbody>
          </table>
          <h2 style="margin-top:16px;">新增俗名</h2>
          <form method="post" action="/admin/alias">
            <input type="hidden" name="scope" value="global">
            <input type="hidden" name="product_id" value="${escapeAttr(product.id)}">
            <input type="hidden" name="redirect" value="/admin/products/${encodeURIComponent(product.id)}/aliases">
            <label>別名（客戶可能這樣叫）<input type="text" name="alias" required placeholder="例：高麗菜心" style="width:100%;"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">新增</button></p>
          </form>
        </div>
        <div class="notion-card" id="specs">
          <h2>品項規格</h2>
          <p style="color:var(--notion-text-muted);font-size:13px;margin:0 0 12px;">單位、備註標籤、換算公斤（選填）</p>
          <table>
            <thead><tr><th>單位</th><th>備註標籤</th><th>換算公斤</th><th>操作</th></tr></thead>
            <tbody>${specRows || "<tr><td colspan='4'>尚無規格</td></tr>"}</tbody>
          </table>
          <h2 style="margin-top:16px;">新增規格</h2>
          <form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs">
            <label>單位 <input type="text" name="unit" required placeholder="例：斤、包" style="width:120px;"></label>
            <label>備註標籤 <input type="text" name="note_label" placeholder="選填" style="width:160px;"></label>
            <label>換算公斤 <input type="number" name="conversion_kg" step="0.001" placeholder="選填" style="width:100px;"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">新增規格</button></p>
          </form>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("俗名管理", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/products/:id/specs", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const unit = (req.body?.unit ?? "").trim();
        if (!unit) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?err=" + encodeURIComponent("請填寫單位"));
            return;
        }
        const noteLabel = (req.body?.note_label ?? "").trim() || null;
        const conversionKg = req.body?.conversion_kg !== undefined && req.body.conversion_kg !== "" ? parseFloat(req.body.conversion_kg) : null;
        const specId = (0, id_js_1.newId)("pus");
        try {
            await db.prepare("INSERT INTO product_unit_specs (id, product_id, unit, note_label, conversion_kg) VALUES (?, ?, ?, ?, ?)").run(specId, productId, unit, noteLabel, conversionKg);
        }
        catch (e) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?err=" + encodeURIComponent("新增失敗：" + (e.message || "")));
            return;
        }
        res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?spec_ok=1#specs");
    });
    router.post("/products/:id/specs/:specId/delete", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const specId = req.params.specId;
        const row = await db.prepare("SELECT id FROM product_unit_specs WHERE id = ? AND product_id = ?").get(specId, productId);
        if (!row) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?err=" + encodeURIComponent("找不到此規格"));
            return;
        }
        await db.prepare("DELETE FROM product_unit_specs WHERE id = ?").run(specId);
        res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?spec_del=1#specs");
    });
    router.get("/aliases/:id/edit", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT pa.id, pa.alias, pa.product_id, p.name AS product_name FROM product_aliases pa JOIN products p ON p.id = pa.product_id WHERE pa.id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const errMsg = req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / <a href="/admin/products/${encodeURIComponent(row.product_id)}/aliases">俗名管理</a> / 編輯俗名</div>
        <h1 class="notion-page-title">編輯俗名</h1>
        <div class="notion-card">
          <p>品項：${escapeHtml(row.product_name)}</p>
          ${errMsg}
          <form method="post" action="/admin/aliases/${encodeURIComponent(id)}/edit">
            <label>別名 <input type="text" name="alias" value="${escapeAttr(row.alias)}" required style="width:100%;"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
        <p><a href="/admin/products/${encodeURIComponent(row.product_id)}/aliases">← 回俗名管理</a></p>
      `;
        res.type("text/html").send(notionPage("編輯俗名", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/aliases/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const aliasTrim = req.body?.alias?.trim();
        if (!aliasTrim) {
            res.redirect("/admin/aliases/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("別名不可為空"));
            return;
        }
        const row = await db.prepare("SELECT id, product_id FROM product_aliases WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const existing = await db.prepare("SELECT id FROM product_aliases WHERE alias = ? AND id != ?").get(aliasTrim, id);
        if (existing) {
            res.redirect("/admin/aliases/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("此別名已被其他品項使用"));
            return;
        }
        await db.prepare("UPDATE product_aliases SET alias = ? WHERE id = ?").run(aliasTrim, id);
        res.redirect("/admin/products/" + encodeURIComponent(row.product_id) + "/aliases?ok=1");
    });
    router.post("/aliases/:id/delete", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT product_id FROM product_aliases WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        await db.prepare("DELETE FROM product_aliases WHERE id = ?").run(id);
        res.redirect("/admin/products/" + encodeURIComponent(row.product_id) + "/aliases?ok=del");
    });
    router.get("/products/:id/edit", async (req, res) => {
        const row = await db.prepare("SELECT id, name, erp_code, teraoka_barcode, unit, active FROM products WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const errMsg = req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / 編輯品項</div>
        <h1 class="notion-page-title">編輯品項</h1>
        ${errMsg ? `<div class="notion-msg err">${errMsg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <form method="post" action="/admin/products/${encodeURIComponent(row.id)}/edit">
            <label>標準品名 <input type="text" name="name" value="${escapeAttr(row.name)}" required style="width:100%;"></label>
            <label>凌越料號 <input type="text" name="erp_code" value="${escapeAttr(row.erp_code ?? "")}" style="width:100%;"></label>
            <label>寺岡條碼 <input type="text" name="teraoka_barcode" value="${escapeAttr(row.teraoka_barcode ?? "")}" style="width:100%;"></label>
            <label>單位 <select name="unit" style="width:100%;">
              <option value="公斤" ${row.unit === "公斤" ? "selected" : ""}>公斤</option>
              <option value="斤" ${row.unit === "斤" ? "selected" : ""}>斤</option>
              <option value="把" ${row.unit === "把" ? "selected" : ""}>把</option>
              <option value="包" ${row.unit === "包" ? "selected" : ""}>包</option>
              <option value="箱" ${row.unit === "箱" ? "selected" : ""}>箱</option>
              <option value="顆" ${row.unit === "顆" ? "selected" : ""}>顆</option>
              <option value="粒" ${row.unit === "粒" ? "selected" : ""}>粒</option>
              <option value="盒" ${row.unit === "盒" ? "selected" : ""}>盒</option>
              <option value="袋" ${row.unit === "袋" ? "selected" : ""}>袋</option>
            </select></label>
            <label><input type="checkbox" name="active" value="1" ${row.active === 1 ? "checked" : ""}> 啟用（未勾選即停用）</label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("編輯品項", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/products/:id/edit", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id FROM products WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const name = (req.body?.name ?? "").trim();
        if (!name) {
            res.redirect("/admin/products/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("品名不可為空"));
            return;
        }
        const existing = await db.prepare("SELECT id FROM products WHERE name = ? AND id != ?").get(name, id);
        if (existing) {
            res.redirect("/admin/products/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("品名已存在"));
            return;
        }
        const erpCode = (req.body?.erp_code ?? "").trim() || null;
        const teraokaBarcode = (req.body?.teraoka_barcode ?? "").trim() || null;
        const unit = (req.body?.unit ?? "公斤").trim() || "公斤";
        const active = req.body?.active === "1" ? 1 : 0;
        await db.prepare("UPDATE products SET name = ?, erp_code = ?, teraoka_barcode = ?, unit = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, erpCode, teraokaBarcode, unit, active, id);
        res.redirect("/admin/products?ok=edit");
    });
    router.post("/api/products/:id/toggle", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id, active FROM products WHERE id = ?").get(id);
        if (!row) {
            res.status(404).json({ ok: false, err: "找不到此品項" });
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE products SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.json({ ok: true, active: next });
    });
    router.post("/products/:id/toggle", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id, active FROM products WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE products SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.redirect("/admin/products?ok=toggle");
    });
    router.get("/products/:id/delete", async (req, res) => {
        const id = req.params.id;
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(id);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const refCount = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?").get(id);
        const hasOrders = (refCount?.c ?? 0) > 0;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除品項</h1>
        <div class="notion-card">
          <p>確定要刪除「${escapeHtml(product.name)}」？</p>
          ${hasOrders ? '<p class="notion-msg err">此品項已被訂單使用，無法刪除。請改為「停用」。</p>' : ""}
          <p style="margin-top:16px;">
            ${!hasOrders ? `<form method="post" action="/admin/products/${encodeURIComponent(id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form> ` : ""}
            <a href="/admin/products" class="btn">取消</a>
          </p>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("確認刪除品項", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/products/:id/delete", async (req, res) => {
        const id = req.params.id;
        const refCount = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?").get(id);
        if ((refCount?.c ?? 0) > 0) {
            res.redirect("/admin/products?err=" + encodeURIComponent("此品項已被訂單使用，無法刪除。請改為停用。"));
            return;
        }
        await db.prepare("DELETE FROM products WHERE id = ?").run(id);
        res.redirect("/admin/products?ok=del");
    });
    router.get("/import", async (req, res) => {
        const msg = req.query.ok ? `<p style='color:green'>已匯入 ${req.query.ok} 筆品項。</p>` : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 匯入品項</div>
        <h1 class="notion-page-title">匯入品項</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("已匯入") >= 0 ? "ok" : "err"}">${msg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <h2>支援欄位</h2>
          <p>第一列為標題。</p>
          <ul>
            <li>品名：<code>CommName</code>、<code>標準品名</code>、<code>name</code></li>
            <li>寺岡號碼（條碼）：<code>PluCode</code>、<code>寺岡條碼</code>、<code>teraoka_barcode</code></li>
            <li>凌越料號：<code>HQPluCode</code>、<code>ERP料號</code>、<code>erp_code</code></li>
            <li>單位：<code>QtySymbol</code>、<code>單位</code>、<code>unit</code></li>
          </ul>
          <p>同一品名已存在時會略過不覆蓋。</p>
          <p style="color:var(--notion-text-muted);font-size:13px;">若出現「Service Unavailable」或逾時，可能是筆數過多：請改為分批匯入（每批約 200～500 筆），或在 Cloud Run 將「請求逾時」設為 300 秒。</p>
          <form method="post" action="/admin/import" enctype="multipart/form-data">
            <label>匯入時若單位為空，使用：<select name="default_unit">
              <option value="公斤">公斤</option>
              <option value="斤">斤</option>
              <option value="把">把</option>
              <option value="包">包</option>
              <option value="箱">箱</option>
              <option value="顆">顆</option>
              <option value="粒">粒</option>
              <option value="盒">盒</option>
              <option value="袋">袋</option>
            </select></label>
            <label>上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
            <label>或貼上 CSV：<textarea name="csv" placeholder="貼上 CSV 內容..." style="width:100%;height:160px;"></textarea></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">匯入</button></p>
          </form>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("匯入品項", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/import", upload, async (req, res) => {
        try {
            const sheet = parseRequestToSheet(req);
            if (!sheet || sheet.rows.length === 0) {
                res.redirect("/admin/import?err=" + encodeURIComponent("請貼上 CSV 或上傳 Excel 檔案"));
                return;
            }
            const defaultUnit = (req.body?.default_unit?.trim()) || "公斤";
            const { header, rows } = sheet;
            const h = (i) => (header[i] ?? "").trim().toLowerCase().replace(/\s+/g, "_");
            const nameIdx = header.findIndex((_, i) => {
                const v = h(i);
                return ["標準品名", "品名", "名稱", "name", "commname", "comm_name"].includes(v);
            });
            const erpIdx = header.findIndex((_, i) => ["erp料號", "erp_code", "hqplucode"].includes(h(i)));
            const teraokaIdx = header.findIndex((_, i) => ["寺岡條碼", "teraoka_barcode", "plucode"].includes(h(i)));
            const unitIdx = header.findIndex((_, i) => ["單位", "unit", "qtysymbol"].includes(h(i)));
            if (nameIdx === -1) {
                const headerPreview = header.length > 12 ? header.slice(0, 12).join("、") + "…" : header.join("、") || "（無）";
                res.redirect("/admin/import?err=" + encodeURIComponent("找不到品名欄位（請有 CommName、標準品名、品名或 name）。偵測到的標題：" + headerPreview));
                return;
            }
            let imported = 0;
            const existingNames = new Set((await db.prepare("SELECT name FROM products").all()).map((r) => r.name));
            for (let i = 0; i < rows.length; i++) {
                const cols = rows[i];
                const name = (cols[nameIdx] ?? "").trim();
                if (!name)
                    continue;
                if (existingNames.has(name))
                    continue;
                const erpCode = erpIdx >= 0 ? (cols[erpIdx] ?? "").trim() || null : null;
                const teraoka = teraokaIdx >= 0 ? (cols[teraokaIdx] ?? "").trim() || null : null;
                const unitCell = unitIdx >= 0 ? (cols[unitIdx] ?? "").trim() : "";
                const unit = unitCell || defaultUnit;
                const id = (0, id_js_1.newId)("prod");
                await db.prepare("INSERT INTO products (id, name, erp_code, teraoka_barcode, unit) VALUES (?, ?, ?, ?, ?)").run(id, name, erpCode, teraoka, unit);
                existingNames.add(name);
                imported++;
            }
            res.redirect("/admin/import?ok=" + imported);
        }
        catch (e) {
            console.error("[admin] 匯入品項錯誤:", e);
            const msg = (e && e.message) ? String(e.message) : String(e);
            res.redirect("/admin/import?err=" + encodeURIComponent("匯入失敗：" + (msg.length > 200 ? msg.slice(0, 200) + "…" : msg)));
        }
    });
    router.get("/import-customers", async (req, res) => {
        const msg = req.query.ok ? `<p style='color:green'>匯入結果：${escapeHtml(String(req.query.ok))}。</p>` : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 匯入客戶</div>
        <h1 class="notion-page-title">匯入客戶</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("匯入結果") >= 0 ? "ok" : "err"}">${msg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <h2>支援欄位（第一列為標題）</h2>
          <ul>
            <li><strong>CustName</strong> / 客戶名稱（必填）</li>
            <li><strong>LineGroupId</strong> / LINE 群組 ID（綁定叫貨群組）</li>
            <li><strong>CustCode</strong> → 寺岡編號、<strong>HQCustCode</strong> → 凌越編號</li>
            <li>聯絡：<code>CustTel</code>、<code>Fax</code>、<code>Contact</code>、<code>Email</code> 會合併</li>
          </ul>
          <p><strong>大量群組</strong>：在各群組傳「取得群組ID」，機器人會回傳該群組 ID；收集成 Excel 後用「客戶名稱 + LINE群組ID」匯入即可批次綁定。</p>
          <pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);font-size:13px;overflow:auto;">客戶名稱, LINE群組ID, 聯絡
XX餐廳, C1234..., 02-12345678
YY小吃, C5678...,</pre>
          <form method="post" action="/admin/import-customers" enctype="multipart/form-data">
            <label>上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
            <label>或貼上 CSV：<textarea name="csv" placeholder="貼上 CSV 內容..." style="width:100%;height:160px;"></textarea></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">匯入</button></p>
          </form>
        </div>
        <p style="margin-top:16px;"><a href="/admin/customers" class="btn">← 回客戶列表</a></p>
        `;
        res.type("text/html").send(notionPage("匯入客戶", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/import-customers", upload, async (req, res) => {
        const sheet = parseRequestToSheet(req);
        if (!sheet || sheet.rows.length === 0) {
            res.redirect("/admin/import-customers?err=" + encodeURIComponent("請貼上 CSV 或上傳 Excel 檔案"));
            return;
        }
        const { header, rows } = sheet;
        const h = (i) => (header[i] ?? "").trim().toLowerCase().replace(/\s+/g, "_");
        const nameIdx = header.findIndex((_, i) => ["客戶名稱", "name", "custname"].includes(h(i)));
        const lineGroupIdIdx = header.findIndex((_, i) => ["linegroupid", "line_group_id", "line群組id"].includes(h(i)));
        const custCodeIdx = header.findIndex((_, i) => h(i) === "custcode");
        const hqCustCodeIdx = header.findIndex((_, i) => h(i) === "hqcustcode");
        const custTelIdx = header.findIndex((_, i) => ["custtel", "聯絡", "contact"].includes(h(i)));
        const faxIdx = header.findIndex((_, i) => h(i) === "fax");
        const contactIdx = header.findIndex((_, i) => h(i) === "contact");
        const emailIdx = header.findIndex((_, i) => h(i) === "email");
        if (nameIdx === -1) {
            res.redirect("/admin/import-customers?err=" + encodeURIComponent("找不到客戶名稱欄位（請有 客戶名稱 / name / CustName）"));
            return;
        }
        let imported = 0;
        let updated = 0;
        for (let i = 0; i < rows.length; i++) {
            const cols = rows[i];
            const name = (cols[nameIdx] ?? "").trim();
            if (!name)
                continue;
            const teraokaCode = custCodeIdx >= 0 ? (cols[custCodeIdx] ?? "").trim() || null : null;
            const hqCustCode = hqCustCodeIdx >= 0 ? (cols[hqCustCodeIdx] ?? "").trim() || null : null;
            const lineGroupId = lineGroupIdIdx >= 0 ? (cols[lineGroupIdIdx] ?? "").trim() || null : null;
            const contactParts = [custTelIdx, faxIdx, contactIdx, emailIdx]
                .filter((idx) => idx >= 0)
                .map((idx) => (cols[idx] ?? "").trim())
                .filter(Boolean);
            const contact = contactParts.length > 0 ? contactParts.join(" / ") : null;
            const existing = await db.prepare("SELECT id FROM customers WHERE name = ?").get(name);
            if (existing) {
                await db.prepare("UPDATE customers SET teraoka_code = COALESCE(?, teraoka_code), hq_cust_code = COALESCE(?, hq_cust_code), contact = COALESCE(?, contact), line_group_id = COALESCE(?, line_group_id), updated_at = datetime('now') WHERE id = ?").run(teraokaCode ?? null, hqCustCode ?? null, contact ?? null, lineGroupId || null, existing.id);
                if (lineGroupId)
                    updated++;
            }
            else {
                await db.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_id, contact) VALUES (?, ?, ?, ?, ?, ?)").run((0, id_js_1.newId)("cust"), name, teraokaCode, hqCustCode, lineGroupId, contact);
                imported++;
            }
        }
        const resultMsg = imported > 0 ? `新增 ${imported} 筆` : "";
        const resultMsg2 = updated > 0 ? (resultMsg ? "；" : "") + `更新 ${updated} 筆 LINE 群組綁定` : "";
        res.redirect("/admin/import-customers?ok=" + encodeURIComponent(resultMsg + resultMsg2 || "0"));
    });
    router.get("/import-teraoka", async (req, res) => {
        const ok = req.query.ok;
        const matched = req.query.matched;
        const unmatched = req.query.unmatched;
        let msg = "";
        if (ok === "1" && matched !== undefined)
            msg = `<p class="notion-msg ok">對照完成。已更新寺岡條碼：${matched} 筆。</p>`;
        if (unmatched !== undefined && unmatched !== "0")
            msg += `<p class="notion-msg err">未對應到品項（請先建品項或俗名）：${unmatched} 筆。</p>`;
        if (req.query.err)
            msg += `<p class="notion-msg err">${escapeHtml(String(req.query.err))}</p>`;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 寺岡資料對照</div>
        <h1 class="notion-page-title">寺岡資料對照</h1>
        ${msg}
        <div class="notion-card">
          <p>貼上<strong>寺岡匯出的 CSV</strong>，系統會依<strong>品名</strong>對照到現有品項，並寫入<strong>寺岡條碼</strong>。</p>
          <p>第一列為標題，需有「品名」或「名稱」欄（對應我們的標準品名或俗名）、以及「條碼」或「編號」欄（寺岡條碼）。</p>
          <pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);font-size:13px;overflow:auto;">品名, 條碼
高麗菜, T001
福山萵苣, T002
大陸妹, T002</pre>
          <p>若寺岡的品名與系統不完全一致，請先在「品項與俗名」或「待確認品名」建立俗名對照，再匯入。</p>
          <form method="post" action="/admin/import-teraoka" enctype="multipart/form-data">
            <label>上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
            <label>或貼上 CSV：<textarea name="csv" placeholder="貼上寺岡匯出的 CSV..." style="width:100%;height:180px;"></textarea></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">對照並更新</button></p>
          </form>
        </div>
        <p style="margin-top:16px;"><a href="/admin/products" class="btn">← 回品項列表</a></p>
        `;
        res.type("text/html").send(notionPage("寺岡資料對照", body, "", res.locals.topBarHtml, res.locals.actionBarHtml));
    });
    router.post("/import-teraoka", upload, async (req, res) => {
        const sheet = parseRequestToSheet(req);
        if (!sheet || sheet.rows.length === 0) {
            res.redirect("/admin/import-teraoka?err=" + encodeURIComponent("請貼上 CSV 或上傳 Excel 檔案"));
            return;
        }
        const { header, rows } = sheet;
        const nameIdx = header.findIndex((h) => h === "品名" || h === "名稱" || h === "name" || h === "標準品名");
        const barcodeIdx = header.findIndex((h) => h === "條碼" || h === "編號" || h === "barcode" || h === "code" || h === "寺岡條碼" || h === "teraoka_barcode");
        if (nameIdx === -1) {
            res.redirect("/admin/import-teraoka?err=" + encodeURIComponent("找不到品名欄位（品名、名稱、name、標準品名）"));
            return;
        }
        if (barcodeIdx === -1) {
            res.redirect("/admin/import-teraoka?err=" + encodeURIComponent("找不到條碼欄位（條碼、編號、barcode、code）"));
            return;
        }
        const productByName = new Map();
        for (const row of await db.prepare("SELECT id, name FROM products").all()) {
            productByName.set(row.name, row.id);
        }
        for (const row of await db.prepare("SELECT product_id, alias FROM product_aliases").all()) {
            if (!productByName.has(row.alias))
                productByName.set(row.alias, row.product_id);
        }
        let matched = 0;
        let unmatchedCount = 0;
        for (let i = 0; i < rows.length; i++) {
            const cols = rows[i];
            const name = (cols[nameIdx] ?? "").trim();
            const barcode = (cols[barcodeIdx] ?? "").trim();
            if (!name || !barcode)
                continue;
            const productId = productByName.get(name);
            if (productId) {
                await db.prepare("UPDATE products SET teraoka_barcode = ?, updated_at = datetime('now') WHERE id = ?").run(barcode, productId);
                matched++;
            }
            else {
                unmatchedCount++;
            }
        }
        res.redirect("/admin/import-teraoka?ok=1&matched=" + matched + "&unmatched=" + unmatchedCount);
    });
    return router;
}
function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuoted = !inQuoted;
        }
        else if (ch === "," && !inQuoted) {
            out.push(cur.trim());
            cur = "";
        }
        else {
            cur += ch;
        }
    }
    out.push(cur.trim());
    return out;
}
function parseRequestToSheet(req) {
    if (req.file?.buffer) {
        const wb = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName)
            return null;
        const ws = wb.Sheets[sheetName];
        const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!arr.length)
            return null;
        const header = (arr[0] ?? []).map((c) => String(c ?? "").replace(/\ufeff/g, "").trim());
        const rows = arr.slice(1).map((row) => (Array.isArray(row) ? row : []).map((c) => String(c ?? "").trim()));
        return { header: header.map((h) => h.replace(/\ufeff/g, "").toLowerCase().replace(/\s+/g, "_")), rows };
    }
    const raw = req.body?.csv?.trim().replace(/\ufeff/g, "");
    if (!raw)
        return null;
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2)
        return null;
    const header = lines[0].split(",").map((c) => c.replace(/\ufeff/g, "").trim().toLowerCase().replace(/\s+/g, "_"));
    const rows = lines.slice(1).map((line) => parseCsvLine(line));
    return { header, rows };
}
function escapeHtml(s) {
    if (s == null)
        return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
    if (s == null)
        return "";
    return escapeHtml(s).replace(/'/g, "&#39;");
}
