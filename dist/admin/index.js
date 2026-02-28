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
const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single("file");
const NOTION_STYLE = `
  :root { --notion-bg:#fff; --notion-sidebar:#f7f6f3; --notion-border:#e3e2e0; --notion-text:#37352f; --notion-text-muted:#787774; --notion-accent:#2383e2; --notion-hover:#f1f1ef; --notion-radius:6px; }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 100%; max-width: 100vw; min-height: 100vh; }
  body { font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif; background: var(--notion-bg); color: var(--notion-text); line-height: 1.5; display: flex; }
  .notion-layout { display: flex; width: 100%; max-width: 100%; min-height: 100vh; flex: 1; min-width: 0; }
  .notion-sidebar { width: 240px; min-width: 240px; background: var(--notion-sidebar); border-right: 1px solid var(--notion-border); padding: 12px 0; flex-shrink: 0; }
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
  @media print { .notion-sidebar, .no-print, .notion-topbar { display: none !important; } .notion-main { max-width: none; } }
`;
const NOTION_SIDEBAR = (active) => `
  <nav class="notion-sidebar">
    <a href="/admin" class="${active === "dashboard" ? "active" : ""}">回後台</a>
    <a href="javascript:history.back()">上一頁</a>
    <details class="sidebar-group" open>
      <summary class="sidebar-group-title">日期結轉</summary>
      <div class="sidebar-links">
        <a href="/admin">結轉日期</a>
      </div>
    </details>
    <details class="sidebar-group" open>
      <summary class="sidebar-group-title">客戶管理</summary>
      <div class="sidebar-links">
        <a href="/admin/customers/new">新增客戶</a>
        <a href="/admin/customers">客戶管理</a>
        <a href="/admin/import-customers">批次匯入客戶</a>
      </div>
    </details>
    <details class="sidebar-group" open>
      <summary class="sidebar-group-title">貨品管理</summary>
      <div class="sidebar-links">
        <a href="/admin/products">品項與俗名</a>
        <a href="/admin/import">批次匯入品項</a>
      </div>
    </details>
    <details class="sidebar-group" open>
      <summary class="sidebar-group-title">訂單管理</summary>
      <div class="sidebar-links">
        <a href="/admin/orders">訂單查詢</a>
        <a href="/admin/review">待確認品項</a>
        <a href="/admin/export">資料匯出</a>
      </div>
    </details>
  </nav>
`;
async function getWorkingDate(database) {
    const row = await database.prepare("SELECT value FROM app_settings WHERE key = ?").get("working_date");
    if (row && row.value)
        return row.value;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
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
function notionPage(title, body, active = "", topBar = "") {
    const main = topBar ? `<div class="notion-main-wrap">${topBar}<main class="notion-main">${body}</main></div>` : `<main class="notion-main">${body}</main>`;
    return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} － 松富叫貨後台</title><style>${NOTION_STYLE}</style></head><body><div class="notion-layout">${NOTION_SIDEBAR(active)}${main}</div></body></html>`;
}
function createAdminRouter() {
    const router = express_1.default.Router();
    const db = (0, index_js_1.getDb)(dbPath);
    router.use(async (_req, res, next) => {
        try {
            const workingDate = await getWorkingDate(db);
            const prev = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("previous_working_date");
            res.locals.topBarHtml = renderTopBar(workingDate, !!(prev && prev.value));
            next();
        }
        catch (e) {
            next(e);
        }
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
    router.get("/", async (_req, res) => {
        const body = `
        <div class="notion-breadcrumb">工作台</div>
        <h1 class="notion-page-title">工作台</h1>
        <div class="notion-card">
          <h2>資料匯入</h2>
          <p><a href="/admin/import-customers">匯入客戶</a>（CSV / Excel，含 CustName 格式）</p>
          <p><a href="/admin/import">匯入品項</a>（標準品名、ERP、寺岡條碼）</p>
          <p><a href="/admin/import-teraoka">寺岡資料對照</a>（依品名寫入寺岡條碼）</p>
        </div>
        <div class="notion-card">
          <h2>查詢與維護</h2>
          <ul style="margin:0;padding-left:20px;">
            <li><a href="/admin/review">待確認品名</a> － 補正俗名／客戶別名</li>
            <li><a href="/admin/orders">訂單查詢</a></li>
            <li><a href="/admin/customers">客戶管理</a>、<a href="/admin/customers/new">新增客戶</a></li>
            <li><a href="/admin/line-binding">LINE 綁定檢查</a> － 確認群組 ID 是否正確</li>
            <li><a href="/admin/products">品項與俗名</a></li>
          </ul>
        </div>
      `;
        res.type("text/html").send(notionPage("工作台", body, "dashboard", res.locals.topBarHtml));
    });
    router.get("/line-binding", async (_req, res) => {
        const dbType = process.env.DATABASE_URL ? "PostgreSQL (Cloud SQL)" : "SQLite";
        const customers = await db.prepare("SELECT id, name, line_group_id, active FROM customers ORDER BY name").all();
        const rows = customers.map((c) => {
            const bound = c.line_group_id && String(c.line_group_id).trim() ? "是" : "否";
            const gid = (c.line_group_id && String(c.line_group_id).trim()) ? escapeHtml(String(c.line_group_id).trim()) : "—";
            const status = c.active === 1 ? "啟用" : "停用";
            return `<tr><td>${escapeHtml(c.name)}</td><td><code style="font-size:12px;word-break:break-all;">${gid}</code></td><td>${bound}</td><td>${status}</td><td><a href="/admin/customers/${encodeURIComponent(c.id)}/edit">編輯</a></td></tr>`;
        });
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / LINE 綁定檢查</div>
        <h1 class="notion-page-title">LINE 綁定檢查</h1>
        <div class="notion-card">
          <h2>如何綁定</h2>
          <ol style="margin:0 0 12px;padding-left:20px;">
            <li>在 LINE 群組裡傳送：<strong>取得群組ID</strong>（或「群組ID」）</li>
            <li>機器人會回傳該群組的 ID（一串英數字），請<strong>完整複製</strong></li>
            <li>到下方對應客戶那一列點「編輯」，把複製的 ID 貼到「LINE 群組 ID」欄位，儲存</li>
          </ol>
          <p style="color:var(--notion-text-muted);font-size:13px;">ID 必須與機器人回傳的<strong>完全一致</strong>（前後不可多空格、不可少字）。</p>
        </div>
        <div class="notion-card">
          <h2>資料庫連線</h2>
          <p>目前使用：<strong>${escapeHtml(dbType)}</strong></p>
        </div>
        <div class="notion-card">
          <h2>客戶與 LINE 群組 ID</h2>
          <table>
            <thead><tr><th>客戶名稱</th><th>LINE 群組 ID</th><th>已綁定</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>${rows.length ? rows.join("") : "<tr><td colspan='5'>尚無客戶</td></tr>"}</tbody>
          </table>
        </div>
        <p><a href="/admin">← 回工作台</a></p>
      `;
        res.type("text/html").send(notionPage("LINE 綁定檢查", body, "", res.locals.topBarHtml));
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
        const products = await db.prepare("SELECT id, name, erp_code FROM products WHERE (active IS NULL OR active = 1) ORDER BY name").all();
        const productOptions = products.map((p) => {
            const label = p.erp_code ? `${p.name}（${p.erp_code}）` : p.name;
            return `<option value="${escapeAttr(p.id)}" data-search="${escapeAttr((p.name + " " + (p.erp_code ?? "")).toLowerCase())}">${escapeHtml(label)}</option>`;
        }).join("");
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
            <form action="/admin/alias" method="post" style="display:inline;">
              <input type="hidden" name="alias" value="${escapeAttr(r.raw_name)}">
              <input type="hidden" name="customer_id" value="${escapeAttr(r.customer_id)}">
              <select name="product_id" required class="product-select">${productOptions}</select>
              <label><input type="radio" name="scope" value="global" checked> 全公司俗名</label>
              <label><input type="radio" name="scope" value="customer"> 此客戶專用</label>
              <button type="submit">加入對照</button>
            </form>
          </td>
        </tr>
      `)
                .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / 待確認品名</div>
        <h1 class="notion-page-title">待確認品名</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("已加入") >= 0 ? "ok" : "err"}">${msg.replace(/<p style='[^']*'>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <p style="margin:0 0 12px;">以下為叫貨時無法對應到標準品項的名稱，請選擇要對應的品項並加入俗名或客戶專用別名。</p>
          <p class="product-search" style="margin-bottom:12px;"><label>搜尋品項：<input type="text" id="productSearch" placeholder="輸入品名或料號篩選下拉選單" style="width:280px;"></label></p>
          <table>
            <thead><tr><th>客戶輸入的名稱</th><th>數量</th><th>單位</th><th>客戶</th><th>對應品項並加入對照</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <script>
          (function(){
            var search = document.getElementById('productSearch');
            var selects = document.querySelectorAll('select.product-select');
            if (!search || !selects.length) return;
            function filterOptions(){
              var q = (search.value || '').trim().toLowerCase();
              selects.forEach(function(sel){
                for (var i = 0; i < sel.options.length; i++){
                  var opt = sel.options[i];
                  if (opt.value === '') { opt.hidden = false; continue; }
                  var show = !q || (opt.getAttribute('data-search') || '').indexOf(q) !== -1;
                  opt.hidden = !show;
                }
                if (sel.options[sel.selectedIndex].hidden) {
                  for (var j = 0; j < sel.options.length; j++) { if (!sel.options[j].hidden) { sel.selectedIndex = j; break; } }
                }
              });
            }
            search.addEventListener('input', filterOptions);
            search.addEventListener('keydown', function(e){ if (e.key === 'Enter') e.preventDefault(); });
          })();
        </script>
      `;
        res.type("text/html").send(notionPage("待確認品名", body, "", res.locals.topBarHtml));
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
        const onlyNeedReview = req.query.need_review === "1";
        let orders = await db.prepare(`
      SELECT o.id, o.order_date, o.status, o.raw_message, o.customer_id, c.name AS customer_name,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1) AS need_review_count
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 200
    `).all();
        if (onlyNeedReview) {
            orders = orders.filter((o) => (o.need_review_count ?? 0) > 0);
        }
        const rows = orders
            .map((o) => {
            const n = o.need_review_count ?? 0;
            const needReviewCell = n > 0 ? `<span style="color:red">${n} 項待確認</span>` : "—";
            return `<tr>
            <td>${escapeHtml(o.order_date)}</td>
            <td><a href="/admin/customers/${encodeURIComponent(o.customer_id)}/quick-view?from=orders">${escapeHtml(o.customer_name)}</a></td>
            <td>${escapeHtml(o.status)}</td>
            <td>${needReviewCell}</td>
            <td><pre style="margin:0;white-space:pre-wrap;">${escapeHtml((o.raw_message ?? "").slice(0, 150))}</pre></td>
            <td><a href="/admin/orders/${escapeAttr(o.id)}">明細</a></td>
          </tr>`;
        })
            .join("");
        const filterLink = onlyNeedReview
            ? `<a href="/admin/orders">顯示全部訂單</a>`
            : `<a href="/admin/orders?need_review=1">只看有待確認的訂單</a>`;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / 訂單查詢</div>
        <h1 class="notion-page-title">訂單查詢</h1>
        <p style="margin-bottom:16px;"><a href="/admin/review">待確認品名</a>（補對照）　${filterLink}</p>
        <div class="notion-card">
          <table>
            <thead><tr><th>日期</th><th>客戶</th><th>狀態</th><th>待確認</th><th>原始訊息</th><th></th></tr></thead>
            <tbody>${rows.length ? rows : "<tr><td colspan='6'>無訂單</td></tr>"}</tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("訂單查詢", body, "", res.locals.topBarHtml));
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / 資料匯出</div>
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
        res.type("text/html").send(notionPage("資料匯出", body, "", res.locals.topBarHtml));
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
        let list = await db.prepare("SELECT id, name, erp_code, teraoka_barcode FROM products WHERE active = 1 ORDER BY name").all();
        if (q) {
            const parts = q.split(/\s+/).filter(Boolean);
            list = list.filter((p) => {
                const name = (p.name || "").toLowerCase();
                const erp = (p.erp_code || "").toLowerCase();
                const teraoka = (p.teraoka_barcode || "").toLowerCase();
                return parts.every((part) => name.includes(part) || erp.includes(part) || teraoka.includes(part));
            });
        }
        res.json(list.slice(0, 80));
    });
    router.post("/orders/:orderId/items/:itemId/product", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId, itemId } = req.params;
        const productId = req.body.product_id?.trim();
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        if (!productId) {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=product");
            return;
        }
        const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=product");
            return;
        }
        await db.prepare("UPDATE order_items SET product_id = ?, need_review = 0 WHERE id = ? AND order_id = ?").run(productId, itemId, orderId);
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=product");
    });
    router.get("/orders/:orderId", async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare(`
      SELECT o.id, o.order_date, o.status, o.raw_message, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.remark, oi.need_review,
        p.id AS product_id, p.erp_code, p.name AS product_name, p.teraoka_barcode
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
    `).all(orderId);
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
                ? `<a href="#" class="product-pick" data-item-id="${escapeAttr(i.item_id)}" data-raw="${escapeAttr(i.raw_name || "")}">待確認</a>`
                : `${pname} <a href="#" class="product-pick" data-item-id="${escapeAttr(i.item_id)}">改品項</a>`;
            const remarkVal = (i.remark && i.remark.trim()) ? escapeAttr(i.remark.trim()) : "";
            return `<tr data-item-id="${escapeAttr(i.item_id)}">
            <td>${escapeHtml(erp)}</td>
            <td>${productCell}</td>
            <td><input type="number" name="qty_${i.item_id}" form="itemsForm" value="${escapeAttr(String(q))}" step="any" min="0" style="width:5rem;"></td>
            <td>${unitSelectWithVal}</td>
            <td><input type="text" name="remark_${i.item_id}" form="itemsForm" value="${remarkVal}" placeholder="備註" style="width:100%;max-width:120px;"></td>
            <td>${teraokaCell}</td>
          </tr>`;
        })
            .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/orders">訂單查詢</a> / 訂單明細</div>
        <h1 class="notion-page-title">訂單明細</h1>
        <p>日期：${escapeHtml(order.order_date)}　客戶：<a href="/admin/customers/${encodeURIComponent(order.customer_id)}/quick-view?from=orders">${escapeHtml(order.customer_name)}</a>　狀態：${escapeHtml(order.status)}</p>
        ${needReviewNote}
        ${req.query.ok === "product" ? "<p class=\"notion-msg ok\">已更新品項。</p>" : ""}
        ${req.query.err === "product" ? "<p class=\"notion-msg err\">請選擇有效品項。</p>" : ""}
        <p><a href="/admin/orders/${encodeURIComponent(orderId)}/order-sheet">匯出訂貨單格式（含條碼）</a>　<a href="/admin/orders/${encodeURIComponent(orderId)}/order-sheet?preview=1">預覽訂單圖</a></p>
        <div class="notion-card"><pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);margin:0;font-size:13px;">${escapeHtml(order.raw_message ?? "")}</pre></div>
        <form id="itemsForm" method="post" action="/admin/orders/${encodeURIComponent(orderId)}/items">
          <div class="notion-card">
            <table>
              <thead><tr><th>凌越料號</th><th>凌越品名</th><th>叫貨數量</th><th>叫貨單位</th><th>備註</th><th>寺岡（料號／條碼）</th></tr></thead>
              <tbody>${itemsRows}</tbody>
            </table>
            <p style="margin:12px 0 0;"><button type="submit" class="btn btn-primary">儲存數量、單位與備註</button></p>
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
          document.querySelectorAll('.product-pick').forEach(function(a){
            a.addEventListener('click', function(e){ e.preventDefault(); currentItemId = this.getAttribute('data-item-id'); modal.style.display = 'flex'; searchEl.value = this.getAttribute('data-raw') || ''; searchProducts(searchEl.value); });
          });
          listEl.addEventListener('click', function(e){
            var div = e.target.closest('.product-option');
            if (!div || !currentItemId) return;
            var productId = div.getAttribute('data-product-id');
            if (!productId) return;
            var form = document.createElement('form');
            form.method = 'post';
            form.action = '/admin/orders/' + encodeURIComponent(orderId) + '/items/' + encodeURIComponent(currentItemId) + '/product';
            form.innerHTML = '<input type="hidden" name="product_id" value="' + productId + '">';
            document.body.appendChild(form);
            form.submit();
          });
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("訂單明細", body, "", res.locals.topBarHtml));
    });
    router.post("/orders/:orderId/items", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const body = req.body;
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
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=items");
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
      SELECT o.id, o.order_date, o.status, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.quantity, oi.unit, oi.remark, p.erp_code, p.name AS product_name, p.teraoka_barcode
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
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
        <div class="no-print notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/orders">訂單查詢</a> / <a href="/admin/orders/${encodeURIComponent(orderId)}">訂單明細</a> / 訂貨單</div>
        ${preview ? "<p class=\"no-print\"><button type=\"button\" class=\"btn btn-primary\" id=\"exportJpgBtn\">匯出 JPG</button> 預覽下方訂單圖後可點此匯出</p>" : ""}
        <div id="order-sheet-content" style="margin-top:12px;">
        <div class="notion-card">
        <h1 class="notion-page-title">訂貨單</h1>
        <p>日期：${escapeHtml(order.order_date)}　客戶：${escapeHtml(order.customer_name)}</p>
          <table>
            <thead><tr><th>凌越料號</th><th>凌越品名</th><th>叫貨數量</th><th>叫貨單位</th><th>備註</th><th>寺岡（料號／條碼）</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="notion-card" style="margin-top:2rem;">
          <p><strong>品項條碼（以下供掃描）</strong></p>
          ${items.filter((i) => i.teraoka_barcode && i.teraoka_barcode.trim()).map((i) => `<span style="display:inline-block;margin:0.5rem;"><img src="/admin/barcode?code=${encodeURIComponent(i.teraoka_barcode.trim())}" alt="" style="height:56px;"><br><small>${escapeHtml(i.product_name ?? i.teraoka_barcode ?? "")}</small></span>`).join("")}
        </div>
        ${customerBarcode ? `<div class="notion-card" style="margin-top:1.5rem;">${customerBarcode}</div>` : ""}
        </div>
        <p class="no-print" style="margin-top:1rem;"><a href="/admin/orders/${encodeURIComponent(orderId)}">← 回訂單明細</a></p>
        ${preview ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script><script>document.getElementById("exportJpgBtn").onclick=function(){ var el = document.getElementById("order-sheet-content"); if (typeof html2canvas !== "undefined") { html2canvas(el, { useCORS: true, allowTaint: true }).then(function(canvas){ var a = document.createElement("a"); a.download = "order-sheet-' + orderId + '.jpg"; a.href = canvas.toDataURL("image/jpeg", 0.92); a.click(); }); } };</script>' : ""}
      `;
        res.type("text/html").send(notionPage("訂貨單", sheetBody, "", res.locals.topBarHtml));
    });
    router.get("/customers/new", async (req, res) => {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/customers">客戶管理</a> / 新增客戶</div>
        <h1 class="notion-page-title">新增客戶</h1>
        <div class="notion-card">
          <form method="post" action="/admin/customers/new">
            <label>客戶名稱 <input type="text" name="name" required placeholder="例：XX餐廳" style="width:100%;"></label>
            <label>寺岡編號（CustCode／QR） <input type="text" name="teraoka_code" placeholder="可留空" style="width:100%;"></label>
            <label>凌越編號（HQCustCode） <input type="text" name="hq_cust_code" placeholder="可留空" style="width:100%;"></label>
            <label>LINE 群組名稱 <input type="text" name="line_group_name" placeholder="可留空，之後可改" style="width:100%;"></label>
            <label>LINE 群組 ID <input type="text" name="line_group_id" placeholder="C開頭群組 ID，可留空後補" style="width:100%;"></label>
            <label>聯絡方式 <input type="text" name="contact" placeholder="電話或備註，可留空" style="width:100%;"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">建立</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增客戶", body, "", res.locals.topBarHtml));
    });
    router.post("/customers/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = req.body.name?.trim();
        const teraokaCode = req.body.teraoka_code?.trim() || null;
        const hqCustCode = req.body.hq_cust_code?.trim() || null;
        const lineGroupName = req.body.line_group_name?.trim() || null;
        const lineGroupId = req.body.line_group_id?.trim() || null;
        const contact = req.body.contact?.trim() || null;
        if (!name) {
            res.redirect("/admin/customers/new?err=name");
            return;
        }
        const id = (0, id_js_1.newId)("cust");
        await db.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact);
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/customers">客戶管理</a> / ${escapeHtml(customer.name)}</div>
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
        res.type("text/html").send(notionPage("客戶資料", body, "", res.locals.topBarHtml));
    });
    router.get("/customers/:id/edit", async (req, res) => {
        try {
            const customer = await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active FROM customers WHERE id = ?").get(req.params.id);
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/customers">客戶管理</a> / 編輯客戶</div>
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
            res.type("text/html").send(notionPage("編輯客戶", editBody, "", res.locals.topBarHtml));
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
        const lineGroupId = req.body.line_group_id?.trim() || null;
        const contact = req.body.contact?.trim() || null;
        const defaultUnit = req.body.default_unit?.trim() || null;
        const orderNotes = req.body.order_notes?.trim() || null;
        const active = req.body.active === "1" ? 1 : 0;
        if (!name) {
            res.redirect("/admin/customers/" + encodeURIComponent(id) + "/edit?err=name");
            return;
        }
        await db.prepare("UPDATE customers SET name = ?, teraoka_code = ?, hq_cust_code = ?, line_group_name = ?, line_group_id = ?, contact = ?, default_unit = ?, order_notes = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact, defaultUnit, orderNotes, active, id);
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
                : req.query.ok === "toggle"
                    ? "<p style='color:green'>已更新狀態。</p>"
                    : req.query.ok === "del"
                        ? "<p style='color:green'>已刪除。</p>"
                        : req.query.err
                            ? "<p style='color:red'>" + escapeHtml(String(req.query.err)) + "</p>"
                            : "";
        const q = req.query.q?.trim() ?? "";
        const rows = (q
            ? await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, active FROM customers WHERE name LIKE ? ORDER BY name").all("%" + q + "%")
            : await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, active FROM customers ORDER BY name").all());
        const tbody = rows
            .map((r) => {
            const active = r.active === undefined || r.active === null || r.active === 1;
            return `<tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.teraoka_code ?? "")}</td>
            <td>${escapeHtml(r.hq_cust_code ?? "")}</td>
            <td>${escapeHtml(r.line_group_name ?? "")}</td>
            <td>${r.line_group_id ? "已綁定" : "—"}</td>
            <td>${escapeHtml(r.contact ?? "")}</td>
            <td>${active ? "<span style='color:green'>啟用</span>" : "<span style='color:gray'>停用</span>"}</td>
            <td>
              <a href="/admin/customers/${encodeURIComponent(r.id)}/edit">編輯</a>
              | <form method="post" action="/admin/customers/${encodeURIComponent(r.id)}/toggle" style="display:inline;"><button type="submit">${active ? "停用" : "啟用"}</button></form>
              | <a href="/admin/customers/${encodeURIComponent(r.id)}/delete">刪除</a>
            </td>
          </tr>`;
        })
            .join("");
        const searchVal = escapeAttr(q);
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / 客戶管理</div>
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
          <table>
            <thead><tr><th>名稱</th><th>寺岡編號</th><th>凌越編號</th><th>LINE 群組名稱</th><th>LINE 綁定</th><th>聯絡</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("客戶管理", body, "", res.locals.topBarHtml));
    });
    router.post("/customers/:id/toggle", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT active FROM customers WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        const next = (row.active === 1 ? 0 : 1);
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/customers">客戶管理</a> / 確認刪除</div>
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
        res.type("text/html").send(notionPage("確認刪除", body, "", res.locals.topBarHtml));
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
        const showInactive = req.query.inactive === "1";
        let products = await db.prepare(`
      SELECT id, name, erp_code, teraoka_barcode, unit, active
      FROM products
      ORDER BY active DESC, name
    `).all();
        if (q) {
            products = products.filter((p) => p.name.includes(q) ||
                (p.erp_code && p.erp_code.includes(q)) ||
                (p.teraoka_barcode && p.teraoka_barcode.includes(q)));
        }
        if (showInactive) {
            products = products.filter((p) => p.active !== 1);
        }
        else {
            products = products.filter((p) => p.active === 1);
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
        const okMsg = req.query.ok === "del" ? "已刪除品項。" : req.query.ok === "edit" ? "已儲存。" : req.query.ok === "toggle" ? "已更新狀態。" : "";
        const msg = okMsg ? "<p style='color:green'>" + okMsg + "</p>" : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const tbody = products
            .map((p) => {
                const specSummary = (specsByProduct.get(p.id) ?? []).map((x) => escapeHtml(x)).join("、") || "—";
                const isActive = p.active === 1;
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
            })
            .join("");
        const filterLink = showInactive
            ? `<a href="/admin/products${q ? "?q=" + encodeURIComponent(q) : ""}">只看啟用</a>`
            : `<a href="/admin/products?inactive=1${q ? "&q=" + encodeURIComponent(q) : ""}">只看停用</a>`;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / 品項與俗名</div>
        <h1 class="notion-page-title">品項與俗名</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/import">匯入品項</a>、<a href="/admin/import-teraoka">寺岡資料對照</a>　${filterLink}</p>
        <form method="get" action="/admin/products" style="margin-bottom:16px;">
          <input type="hidden" name="inactive" value="${showInactive ? "1" : ""}">
          <input type="search" name="q" value="${escapeAttr(q)}" placeholder="搜尋品名、料號、條碼">
          <button type="submit" class="btn">搜尋</button>
        </form>
        <div class="notion-card">
          <table>
            <thead><tr><th>標準品名</th><th>凌越料號</th><th>寺岡條碼</th><th>單位</th><th>俗名</th><th>規格</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>${tbody.length ? tbody : "<tr><td colspan='8'>無符合的品項</td></tr>"}</tbody>
          </table>
        </div>
        <script>
        document.querySelectorAll(".product-toggle-btn").forEach(function(btn){
          btn.addEventListener("click", function(){
            var el = this, id = el.dataset.id;
            if (!id) return;
            el.disabled = true;
            fetch("/admin/api/products/" + encodeURIComponent(id) + "/toggle", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "", credentials: "same-origin" })
              .then(function(r){ return r.json(); })
              .then(function(data){
                if (data && data.ok === true) {
                  var nextActive = data.active === 1;
                  el.dataset.active = nextActive ? "1" : "0";
                  el.textContent = nextActive ? "停用" : "啟用";
                  var row = el.closest("tr");
                  var statusCell = row && row.querySelector(".product-status-cell");
                  if (statusCell) statusCell.innerHTML = nextActive ? "啟用" : "<span style=\"color:#888\">停用</span>";
                }
                el.disabled = false;
              })
              .catch(function(){ el.disabled = false; });
          });
        });
        </script>
      `;
        res.type("text/html").send(notionPage("品項與俗名", body, "", res.locals.topBarHtml));
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/products">品項與俗名</a> / 俗名管理</div>
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
        res.type("text/html").send(notionPage("俗名管理", body, "", res.locals.topBarHtml));
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/products">品項與俗名</a> / <a href="/admin/products/${encodeURIComponent(row.product_id)}/aliases">俗名管理</a> / 編輯俗名</div>
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
        res.type("text/html").send(notionPage("編輯俗名", body, "", res.locals.topBarHtml));
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/products">品項與俗名</a> / 編輯品項</div>
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
        res.type("text/html").send(notionPage("編輯品項", body, "", res.locals.topBarHtml));
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
        const next = row.active === 1 ? 0 : 1;
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
        const next = row.active === 1 ? 0 : 1;
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / <a href="/admin/products">品項與俗名</a> / 確認刪除</div>
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
        res.type("text/html").send(notionPage("確認刪除品項", body, "", res.locals.topBarHtml));
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / 匯入品項</div>
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
        res.type("text/html").send(notionPage("匯入品項", body, "", res.locals.topBarHtml));
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / 匯入客戶</div>
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
        res.type("text/html").send(notionPage("匯入客戶", body, "", res.locals.topBarHtml));
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
        <div class="notion-breadcrumb"><a href="/admin">工作台</a> / 寺岡資料對照</div>
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
        res.type("text/html").send(notionPage("寺岡資料對照", body, "", res.locals.topBarHtml));
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
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
}
