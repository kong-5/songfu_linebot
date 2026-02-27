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
const ADMIN_STYLE = `
  :root { --admin-primary: #166534; --admin-primary-hover: #14532d; --admin-bg: #fafafa; --admin-card: #fff; --admin-border: #e5e7eb; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif; background: var(--admin-bg); color: #37352f; line-height: 1.5; }
  a { color: var(--admin-primary); text-decoration: none; }
  .btn, a.btn { display: inline-block; padding: 0.5rem 1rem; border-radius: 6px; background: var(--admin-card); border: 1px solid var(--admin-border); color: var(--admin-primary); font-size: 0.875rem; margin: 0.25rem 0.25rem 0.25rem 0; }
  .btn:hover, a.btn:hover { background: var(--admin-primary); color: #fff; border-color: var(--admin-primary); }
  .card { background: var(--admin-card); border-radius: 8px; border: 1px solid var(--admin-border); padding: 1.25rem; margin-bottom: 1rem; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid var(--admin-border); padding: 0.5rem 0.75rem; }
`;
const TOP_NAV = '<nav style="margin-bottom:1.5rem;"><a href="/" class="btn">← 回首頁</a> <a href="/admin" class="btn">回後台</a></nav>';
function createAdminRouter() {
    const router = express_1.default.Router();
    const db = (0, index_js_1.getDb)(dbPath);
    router.get("/", (_req, res) => {
        const reviewCount = db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE need_review = 1").get();
        const needReviewOrders = db.prepare("SELECT COUNT(DISTINCT order_id) AS c FROM order_items WHERE need_review = 1").get();
        const specsPending = db.prepare("SELECT COUNT(*) AS c FROM product_unit_specs WHERE (note_label IS NULL OR TRIM(COALESCE(note_label,'')) = '') OR conversion_kg IS NULL").get();
        const specsPendingNum = (specsPending && specsPending.c != null) ? specsPending.c : 0;
        const orderTotal = db.prepare("SELECT COUNT(*) AS c FROM orders").get();
        const orderTotalNum = (orderTotal && orderTotal.c != null) ? orderTotal.c : 0;
        const reviewNum = (reviewCount && reviewCount.c != null) ? reviewCount.c : 0;
        const needReviewOrderNum = (needReviewOrders && needReviewOrders.c != null) ? needReviewOrders.c : 0;
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>松富叫貨－後台</title>
      <style>${ADMIN_STYLE} .page{max-width:720px;margin:2rem auto;padding:0 1.5rem;} .page h1{font-size:1.5rem;font-weight:600;margin-bottom:1.5rem;color:#37352f;} .page h2{font-size:0.95rem;font-weight:600;margin:0 0 0.75rem 0;color:#37352f;} .btn-wrap{display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.5rem;}</style>
      </head>
      <body>
        <div class="page">
          ${TOP_NAV}
          <h1>松富叫貨 － 後台</h1>
          <div class="card">
            <h2>查詢與維護</h2>
            <p class="btn-wrap"><a href="/admin/orders" class="btn"><strong>客戶訂單查詢</strong></a>（${orderTotalNum} 筆）</p>
            <p class="btn-wrap">
              <a href="/admin/review" class="btn">待確認品名（補對照）${reviewNum > 0 ? " " + reviewNum + " 項" : ""}</a>
              <a href="/admin/specs" class="btn">單品規格表（顆／粒／根）${specsPendingNum > 0 ? " " + specsPendingNum + " 項待補" : ""}</a>
              <a href="/admin/export" class="btn">批次匯出</a>
              <a href="/admin/orders?need_review=1" class="btn">只看有待確認的訂單${needReviewOrderNum > 0 ? " " + needReviewOrderNum + " 筆" : ""}</a>
            </p>
            <p class="btn-wrap">
              <a href="/admin/customers" class="btn">客戶管理</a>
              <a href="/admin/customers/new" class="btn">新增客戶</a>
              <a href="/admin/products" class="btn">品項與俗名</a>
            </p>
          </div>
          <div class="card" style="margin-top:1.5rem;">
            <h2>📥 資料匯入</h2>
            <p class="btn-wrap">
              <a href="/admin/import-customers" class="btn">匯入客戶</a>
              <a href="/admin/import" class="btn">匯入品項</a>
              <a href="/admin/import-teraoka" class="btn">寺岡資料對照</a>
            </p>
          </div>
          <div class="card">
            <h2>⚙️ 設定</h2>
            <p class="btn-wrap"><a href="/admin/settings" class="btn">結轉時間等</a></p>
          </div>
        </div>
      </body>
      </html>
    `);
    });
    router.get("/settings", (req, res) => {
        const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("order_cutoff_time");
        const cutoff = (row && row.value) ? String(row.value).trim() : "";
        const msg = req.query.ok === "1" ? "<p style='color:green'>已儲存。</p>" : "";
        res.type("text/html").send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>後台設定</title>
      <style>${ADMIN_STYLE} .page{max-width:480px;margin:2rem auto;padding:0 1.5rem;} label{display:block;margin:0.75rem 0;} input[type=text]{padding:0.5rem;border:1px solid var(--admin-border);border-radius:6px;width:100%;box-sizing:border-box;} button.btn{background:var(--admin-primary);color:#fff;border:none;cursor:pointer;} button.btn:hover{background:var(--admin-primary-hover);}</style></head><body>
        <div class="page">${TOP_NAV}
        <h1>後台設定</h1>${msg}
        <div class="card">
        <form method="post" action="/admin/settings">
          <label><strong>訂單結轉時間</strong>（例：17:00，留空表示不限制）<br>
            <input type="text" name="order_cutoff_time" value="${escapeAttr(cutoff)}" placeholder="HH:MM"></label>
          <p><button type="submit" class="btn">儲存</button></p>
        </form>
        <p style="color:#6b7280;font-size:0.875rem;">結轉時間可作為當日訂單截止時點，供後續流程或報表使用。</p>
        </div>
        <p><a href="/admin" class="btn">← 回後台</a></p>
        </div></body></html>`);
    });
    router.post("/settings", express_1.default.urlencoded({ extended: true }), (req, res) => {
        const cutoff = (req.body.order_cutoff_time || "").trim();
        db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("order_cutoff_time", cutoff);
        res.redirect("/admin/settings?ok=1");
    });
    // 待確認品名：列出 need_review=1 的明細，可選擇對應品項並加入俗名
    router.get("/review", (req, res) => {
        const msg = req.query.ok === "1" ? "<p style='color:green'>已加入對照。</p>" : req.query.err === "dup" ? "<p style='color:red'>此俗名已存在，請勿重複新增。</p>" : "";
        const rows = db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.order_id, o.customer_id, c.name AS customer_name
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN customers c ON c.id = o.customer_id
      WHERE oi.need_review = 1
      ORDER BY oi.created_at DESC
    `).all();
        const products = db.prepare("SELECT id, name, erp_code FROM products WHERE (active IS NULL OR active = 1) ORDER BY name").all();
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
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>待確認品名</title>
      <style>body{font-family:sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:0.5rem;} select,button{padding:0.35rem 0.75rem;} label{margin-right:0.75rem;} .product-search{margin-bottom:0.5rem;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>待確認品名</h1>
        ${msg}
        <p>以下為叫貨時無法對應到標準品項的名稱，請選擇要對應的品項並加入俗名或客戶專用別名。</p>
        <p class="product-search"><label>搜尋品項：<input type="text" id="productSearch" placeholder="輸入品名或料號篩選下拉選單" style="width:280px;padding:0.35rem;"></label></p>
        <table>
          <thead><tr><th>客戶輸入的名稱</th><th>數量</th><th>單位</th><th>客戶</th><th>對應品項並加入對照</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p><a href="/admin">← 回後台</a></p>
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
      </body>
      </html>
    `);
    });
    router.post("/alias", express_1.default.urlencoded({ extended: true }), (req, res) => {
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
                db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run(id, product_id, aliasTrim);
            }
            else if (customer_id) {
                const id = (0, id_js_1.newId)("cpa");
                db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(id, customer_id, product_id, aliasTrim);
            }
            // 將同名稱的待確認明細改為已對應（若為客戶專用則只更新該客戶的訂單明細）
            if (isGlobal) {
                db.prepare("UPDATE order_items SET need_review = 0, product_id = ? WHERE raw_name = ? AND need_review = 1").run(product_id, aliasTrim);
            }
            else if (customer_id) {
                db.prepare(`UPDATE order_items SET need_review = 0, product_id = ?
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
    router.get("/orders", (req, res) => {
        const onlyNeedReview = req.query.need_review === "1";
        const from = (req.query.from || "").trim();
        const to = (req.query.to || "").trim();
        let orders = db.prepare(`
      SELECT o.id, o.order_date, o.status, o.raw_message, o.customer_id, c.name AS customer_name,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1) AS need_review_count
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      ORDER BY o.order_date DESC, o.created_at DESC
      LIMIT 500
    `).all();
        if (from) {
            orders = orders.filter((o) => o.order_date >= from);
        }
        if (to) {
            orders = orders.filter((o) => o.order_date <= to);
        }
        if (onlyNeedReview) {
            orders = orders.filter((o) => (o.need_review_count ?? 0) > 0);
        }
        const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
        const getWeekday = (dateStr) => {
            const d = new Date(dateStr + "T12:00:00");
            return weekdays[d.getDay()];
        };
        const rows = orders
            .map((o) => {
            const n = o.need_review_count ?? 0;
            const wd = getWeekday(o.order_date);
            const needReviewCell = n > 0 ? `<span style="color:red">${n} 項待確認</span>` : "—";
            return `<tr>
            <td>${escapeHtml(o.order_date)}（${wd}）</td>
            <td><a href="/admin/customers/${encodeURIComponent(o.customer_id)}/quick-view?from=orders">${escapeHtml(o.customer_name)}</a></td>
            <td>${escapeHtml(o.status)}</td>
            <td>${needReviewCell}</td>
            <td><pre style="margin:0;white-space:pre-wrap;">${escapeHtml((o.raw_message ?? "").slice(0, 150))}</pre></td>
            <td><a href="/admin/orders/${escapeAttr(o.id)}">明細</a></td>
          </tr>`;
        })
            .join("");
        const reviewCount = db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE need_review = 1").get();
        const needReviewOrderCount = db.prepare("SELECT COUNT(DISTINCT order_id) AS c FROM order_items WHERE need_review = 1").get();
        const reviewNum = (reviewCount && reviewCount.c != null) ? reviewCount.c : 0;
        const needReviewOrderNum = (needReviewOrderCount && needReviewOrderCount.c != null) ? needReviewOrderCount.c : 0;
        const filterLink = onlyNeedReview
            ? `<a href="/admin/orders" class="btn">顯示全部訂單</a>`
            : `<a href="/admin/orders?need_review=1" class="btn">只看有待確認的訂單（${needReviewOrderNum} 筆）</a>`;
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>訂單查詢</title>
      <style>${ADMIN_STYLE} .page{max-width:1100px;margin:2rem auto;padding:0 1.5rem;} .btn-wrap{display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem;} pre{font-size:0.9em;} .filters{margin-bottom:1rem;} .filters label{margin-right:1rem;} .filters input[type=date],.filters button{padding:0.4rem 0.6rem;border-radius:6px;border:1px solid var(--admin-border);} #exportTableJpg{margin-left:0.5rem;}</style>
      </head>
      <body>
        <div class="page">${TOP_NAV}
        <h1>訂單查詢</h1>
        <p class="btn-wrap">
          <a href="/admin/review" class="btn">待確認品名（補對照）${reviewNum > 0 ? " " + reviewNum + " 項" : ""}</a>
          <a href="/admin/specs" class="btn">單品規格表</a>
          <a href="/admin/export" class="btn">批次匯出</a>
          ${filterLink}
        </p>
        <div class="filters">
          <form method="get" action="/admin/orders" style="display:inline;">
            ${onlyNeedReview ? '<input type="hidden" name="need_review" value="1">' : ""}
            <label>日期起 <input type="date" name="from" value="${escapeAttr(from)}"></label>
            <label>日期訖 <input type="date" name="to" value="${escapeAttr(to)}"></label>
            <button type="submit" class="btn">篩選</button>
          </form>
          <button type="button" id="exportTableJpg" class="btn">匯出表格為 JPG</button>
        </div>
        <div id="orders-table-wrap">
        <table>
          <thead><tr><th>日期</th><th>客戶</th><th>狀態</th><th>待確認</th><th>原始訊息</th><th></th></tr></thead>
          <tbody>${rows.length ? rows : "<tr><td colspan='6'>無訂單</td></tr>"}</tbody>
        </table>
        </div>
        <p><a href="/admin" class="btn">← 回後台</a></p>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
        <script>
        document.getElementById('exportTableJpg').onclick=function(){
          if(typeof html2canvas==='undefined'){ alert('無法載入匯出功能，請稍後再試'); return; }
          var el=document.getElementById('orders-table-wrap');
          html2canvas(el,{scale:2,useCORS:true,logging:false}).then(function(canvas){
            var a=document.createElement('a');
            a.download='訂單查詢_'+new Date().toISOString().slice(0,10)+'.jpg';
            a.href=canvas.toDataURL('image/jpeg',0.9);
            a.click();
          }).catch(function(err){ alert('匯出失敗：'+err); });
        };
        </script>
      </body>
      </html>
    `);
    });
    router.get("/orders/:orderId", (req, res) => {
        const { orderId } = req.params;
        const order = db.prepare(`
      SELECT o.id, o.order_date, o.status, o.raw_message, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.need_review, oi.include_export,
        p.id AS product_id, p.erp_code, p.name AS product_name, p.teraoka_barcode,
        s.note_label AS spec_note, s.conversion_kg AS spec_kg
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_unit_specs s ON s.product_id = oi.product_id AND s.unit = oi.unit
      WHERE oi.order_id = ?
    `).all(orderId);
        const needReviewCount = items.filter((i) => i.need_review === 1).length;
        const needReviewNote = needReviewCount > 0
            ? `<p style="color:red">本單有 <strong>${needReviewCount} 項待確認</strong>，請至 <a href="/admin/review">待確認品名</a> 補對照。</p>`
            : "";
        const units = ["公斤", "斤", "把", "包", "件", "箱", "顆", "粒", "盒", "袋"];
        const unitOptions = units.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("");
        const itemsRows = items
            .map((i) => {
            const includeExport = (i.include_export === 1 || i.include_export == null);
            const q = Number(i.quantity);
            const u = (i.unit && i.unit.trim()) || "";
            const unitSelectWithVal = units.includes(u)
                ? `<select name="unit_${i.item_id}" form="itemsForm"><option value="">—</option>${units.map((x) => `<option value="${escapeAttr(x)}" ${x === u ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}</select>`
                : `<select name="unit_${i.item_id}" form="itemsForm"><option value="">—</option>${unitOptions}</select>`;
            const erp = i.erp_code ?? "—";
            const pname = i.product_name ? escapeHtml(i.product_name) : "<span style='color:red'>待確認</span>";
            const teraoka = (i.teraoka_barcode && i.teraoka_barcode.trim()) ? escapeHtml(i.teraoka_barcode) : "—";
            const barcodeImg = i.teraoka_barcode && i.teraoka_barcode.trim()
                ? `<img src="/admin/barcode?code=${encodeURIComponent(i.teraoka_barcode.trim())}" alt="條碼" style="height:36px;vertical-align:middle;">`
                : "—";
            const specNote = (i.spec_note && i.spec_note.trim()) ? escapeHtml(i.spec_note) : "—";
            const specKg = i.spec_kg != null && Number.isFinite(i.spec_kg) ? (q * i.spec_kg).toFixed(2) : "—";
            const rowClass = includeExport ? "" : " class=\"row-excluded\"";
            const checkVal = includeExport ? "1" : "0";
            return `<tr${rowClass}>
            <td style="background:#e9ecef;">${escapeHtml(i.raw_name ?? "")}</td>
            <td style="background:#e9ecef;">${q}</td>
            <td style="background:#e9ecef;">${escapeHtml(u)}</td>
            <td><input type="hidden" name="inc_${i.item_id}" value="${checkVal}"><input type="checkbox" form="itemsForm" class="inc-export-cb" ${includeExport ? "checked" : ""} data-item-id="${escapeAttr(i.item_id)}"></td>
            <td>${escapeHtml(erp)}</td>
            <td>${pname}</td>
            <td><input type="number" name="qty_${i.item_id}" form="itemsForm" value="${escapeAttr(String(q))}" step="any" min="0" style="width:5rem;"></td>
            <td>${unitSelectWithVal}</td>
            <td>${teraoka}</td>
            <td>${barcodeImg}</td>
            <td>${specNote}</td>
            <td>${specKg}</td>
          </tr>`;
        })
            .join("");
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>訂單明細</title>
      <style>${ADMIN_STYLE} .page{max-width:1200px;margin:2rem auto;padding:0 1.5rem;} input[type=number]{text-align:right;} tr.row-excluded{background:#e9ecef;} tr.row-excluded td{color:#6c757d;} pre{background:var(--admin-bg);padding:0.75rem;border-radius:6px;border:1px solid var(--admin-border);}</style>
      </head>
      <body>
        <div class="page">${TOP_NAV}
        <h1>訂單明細</h1>
        <p>日期：${escapeHtml(order.order_date)}　客戶：<a href="/admin/customers/${encodeURIComponent(order.customer_id)}/quick-view?from=orders" class="btn">${escapeHtml(order.customer_name)}</a>　狀態：${escapeHtml(order.status)}</p>
        ${needReviewNote}
        <p><a href="/admin/orders/${encodeURIComponent(orderId)}/order-sheet" class="btn">匯出訂貨單格式（含條碼）</a> <a href="/admin/export" class="btn">批次匯出</a></p>
        <pre style="background:#f5f5f5;padding:0.5rem;">${escapeHtml(order.raw_message ?? "")}</pre>
        <form id="itemsForm" method="post" action="/admin/orders/${encodeURIComponent(orderId)}/items" enctype="application/x-www-form-urlencoded">
          <table>
            <thead><tr><th colspan="3">客戶原始</th><th>確認</th><th colspan="7">我們輸出</th></tr>
            <tr><th>品名</th><th>數量</th><th>單位</th><th>勾選</th><th>凌越料號</th><th>凌越品名</th><th>叫貨數量</th><th>叫貨單位</th><th>寺岡料號</th><th>寺岡條碼</th><th>備註</th><th>推算公斤</th></tr></thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <p><button type="submit" class="btn" style="background:var(--admin-primary);color:#fff;border:none;">儲存數量與單位</button></p>
        </form>
        <p><a href="/admin/orders" class="btn">← 回訂單列表</a></p>
        </div>
        <script>
        document.querySelectorAll('.inc-export-cb').forEach(function(cb){
          cb.addEventListener('change',function(){
            var prev = this.previousElementSibling;
            var row = this.closest('tr');
            if(!this.checked){
              if(!confirm('確定不匯出此項？（此列將不會出現在訂貨單與批次匯出）')){
                this.checked = true;
                if(prev) prev.value = '1';
                if(row) row.classList.remove('row-excluded');
                return;
              }
            }
            if(prev) prev.value = this.checked ? '1' : '0';
            if(row) row.classList.toggle('row-excluded', !this.checked);
          });
        });
        </script>
      </body>
      </html>
    `);
    });
    router.post("/orders/:orderId/items", express_1.default.urlencoded({ extended: true }), (req, res) => {
        const { orderId } = req.params;
        const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
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
                db.prepare("UPDATE order_items SET quantity = ? WHERE id = ? AND order_id = ?").run(qty, itemId, orderId);
            }
            else if (key.startsWith("unit_")) {
                const itemId = key.slice(5);
                const unit = (body[key] ?? "").trim() || null;
                db.prepare("UPDATE order_items SET unit = ? WHERE id = ? AND order_id = ?").run(unit, itemId, orderId);
            }
            else if (key.startsWith("inc_")) {
                const itemId = key.slice(4);
                const inc = (body[key] === "1" || body[key] === 1) ? 1 : 0;
                db.prepare("UPDATE order_items SET include_export = ? WHERE id = ? AND order_id = ?").run(inc, itemId, orderId);
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
    router.get("/orders/:orderId/order-sheet", (req, res) => {
        const { orderId } = req.params;
        const order = db.prepare(`
      SELECT o.id, o.order_date, o.status, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = db.prepare(`
      SELECT oi.quantity, oi.unit, p.erp_code, p.name AS product_name, p.teraoka_barcode
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND (oi.include_export = 1 OR oi.include_export IS NULL)
    `).all(orderId);
        const rows = items.map((i) => {
            const erp = i.erp_code ?? "—";
            const pname = i.product_name ?? "待確認";
            const qty = i.quantity;
            const u = i.unit && i.unit.trim() ? i.unit : "";
            const teraoka = i.teraoka_barcode && i.teraoka_barcode.trim() ? i.teraoka_barcode : "—";
            const barcodeImg = i.teraoka_barcode && i.teraoka_barcode.trim()
                ? `<img src="/admin/barcode?code=${encodeURIComponent(i.teraoka_barcode.trim())}" alt="條碼" style="height:48px;display:block;">`
                : "—";
            return `<tr><td>${escapeHtml(erp)}</td><td>${escapeHtml(pname)}</td><td>${qty}</td><td>${escapeHtml(u)}</td><td>${escapeHtml(teraoka)}</td><td>${barcodeImg}</td></tr>`;
        }).join("");
        const customerBarcode = order.customer_teraoka_code && order.customer_teraoka_code.trim()
            ? `<p><strong>客戶條碼</strong>（${escapeHtml(order.customer_name)}）<br><img src="/admin/barcode?code=${encodeURIComponent(order.customer_teraoka_code.trim())}" alt="客戶條碼" style="height:56px;"></p>`
            : "";
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>訂貨單 ${escapeHtml(order.order_date)} ${escapeHtml(order.customer_name)}</title>
      <style>body{font-family:sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #333;padding:0.5rem;} @media print{ body{margin:0;} .no-print{display:none;} }</style>
      </head>
      <body>
        <div class="no-print">${TOP_NAV}</div>
        <h1>訂貨單</h1>
        <p>日期：${escapeHtml(order.order_date)}　客戶：${escapeHtml(order.customer_name)}</p>
        <table>
          <thead><tr><th>凌越料號</th><th>凌越品名</th><th>叫貨數量</th><th>叫貨單位</th><th>寺岡料號</th><th>寺岡條碼</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:2rem;">
          <p><strong>品項條碼（以下供掃描）</strong></p>
          ${items.filter((i) => i.teraoka_barcode && i.teraoka_barcode.trim()).map((i) => `<span style="display:inline-block;margin:0.5rem;"><img src="/admin/barcode?code=${encodeURIComponent(i.teraoka_barcode.trim())}" alt="" style="height:56px;"><br><small>${escapeHtml(i.product_name ?? i.teraoka_barcode ?? "")}</small></span>`).join("")}
        </div>
        ${customerBarcode ? `<div style="margin-top:1.5rem;">${customerBarcode}</div>` : ""}
        <p class="no-print" style="margin-top:1rem;"><a href="/admin/orders/${encodeURIComponent(orderId)}">← 回訂單明細</a></p>
      </body>
      </html>
    `);
    });
    router.get("/api/products/search", (req, res) => {
        const q = (req.query.q || "").trim();
        if (!q) {
            res.json([]);
            return;
        }
        const terms = q.split(/\s+/).filter(Boolean).map((t) => "%" + t + "%");
        if (terms.length === 0) {
            res.json([]);
            return;
        }
        const placeholders = terms.map(() => "(p.name LIKE ? OR p.erp_code LIKE ? OR pa.alias LIKE ?)").join(" AND ");
        const params = terms.flatMap((t) => [t, t, t]);
        const rows = db.prepare(`
      SELECT DISTINCT p.id, p.name, p.erp_code, p.teraoka_barcode, p.unit
      FROM products p
      LEFT JOIN product_aliases pa ON pa.product_id = p.id
      WHERE (p.active IS NULL OR p.active = 1) AND (${placeholders})
      ORDER BY p.name LIMIT 50
    `).all(...params);
        res.json(rows);
    });
    router.get("/export", (req, res) => {
        const from = (req.query.from || "").trim();
        const to = (req.query.to || "").trim();
        const customerIds = req.query.customer_id;
        const ids = Array.isArray(customerIds) ? customerIds : (customerIds ? [customerIds] : []);
        const action = (req.query.action || "").trim();
        const customers = db.prepare("SELECT id, name FROM customers WHERE (active IS NULL OR active = 1) ORDER BY name").all();
        const customerOptions = customers.map((c) => `<label><input type="checkbox" name="customer_id" value="${escapeAttr(c.id)}" ${ids.includes(c.id) ? "checked" : ""}> ${escapeHtml(c.name)}</label>`).join("<br>");
        if (action === "summary" || action === "report") {
            if (ids.length === 0) {
                res.redirect("/admin/export?err=no_customer&from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to));
                return;
            }
            let orders = db.prepare(`
      SELECT o.id, o.order_date, o.customer_id, c.name AS customer_name
      FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE o.customer_id IN (${ids.map(() => "?").join(",")})
      ORDER BY o.order_date DESC, o.created_at DESC
      LIMIT 500
    `).all(...ids);
            if (from)
                orders = orders.filter((o) => o.order_date >= from);
            if (to)
                orders = orders.filter((o) => o.order_date <= to);
            if (action === "summary") {
                const rows = orders.map((o) => {
                    const itemCount = db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE order_id = ? AND (include_export = 1 OR include_export IS NULL)").get(o.id);
                    const n = (itemCount && itemCount.c != null) ? itemCount.c : 0;
                    return `<tr><td>${escapeHtml(o.order_date)}</td><td>${escapeHtml(o.customer_name)}</td><td>${n}</td><td><a href="/admin/orders/${encodeURIComponent(o.id)}">明細</a>　<a href="/admin/orders/${encodeURIComponent(o.id)}/order-sheet">訂貨單</a></td></tr>`;
                }).join("");
                res.type("text/html").send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>批次匯出－總表</title>
      <style>body{font-family:sans-serif;max-width:900px;margin:2rem auto;} table{border-collapse:collapse;} th,td{border:1px solid #ddd;padding:0.5rem;}</style></head><body>
        ${TOP_NAV}<h1>批次匯出－總表</h1>
        <p>日期：${escapeHtml(from || "—")} ～ ${escapeHtml(to || "—")}　已選 ${ids.length} 位客戶</p>
        <table><thead><tr><th>日期</th><th>客戶</th><th>品項數</th><th>操作</th></tr></thead><tbody>${rows || "<tr><td colspan='4'>無訂單</td></tr>"}</tbody></table>
        <p><a href="/admin/export">← 重選條件</a></p></body></html>`);
                return;
            }
            const htmlBlocks = orders.map((o) => {
                const items = db.prepare(`
          SELECT oi.quantity, oi.unit, p.erp_code, p.name AS product_name, p.teraoka_barcode
          FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ? AND (oi.include_export = 1 OR oi.include_export IS NULL)
        `).all(o.id);
                const order = db.prepare("SELECT o.order_date, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?").get(o.id);
                const rows = items.map((i) => {
                    const erp = i.erp_code ?? "—";
                    const pname = i.product_name ?? "待確認";
                    const teraoka = i.teraoka_barcode && i.teraoka_barcode.trim() ? i.teraoka_barcode : "—";
                    const barcodeImg = i.teraoka_barcode && i.teraoka_barcode.trim() ? `<img src="/admin/barcode?code=${encodeURIComponent(i.teraoka_barcode.trim())}" alt="" style="height:48px;">` : "—";
                    return `<tr><td>${escapeHtml(erp)}</td><td>${escapeHtml(pname)}</td><td>${i.quantity}</td><td>${escapeHtml(i.unit || "")}</td><td>${escapeHtml(teraoka)}</td><td>${barcodeImg}</td></tr>`;
                }).join("");
                const custBarcode = order.customer_teraoka_code && order.customer_teraoka_code.trim() ? `<p><strong>客戶條碼</strong>　<img src="/admin/barcode?code=${encodeURIComponent(order.customer_teraoka_code.trim())}" alt="" style="height:56px;"></p>` : "";
                return `<div class="order-block" style="margin-bottom:3rem; page-break-after:always;">
        <h2>訂貨單　${escapeHtml(order.order_date)}　${escapeHtml(order.customer_name)}</h2>
        <table><thead><tr><th>凌越料號</th><th>凌越品名</th><th>叫貨數量</th><th>叫貨單位</th><th>寺岡料號</th><th>寺岡條碼</th></tr></thead><tbody>${rows}</tbody></table>
        ${custBarcode}
        <p>${items.filter((i) => i.teraoka_barcode && i.teraoka_barcode.trim()).map((i) => `<span style="display:inline-block;margin:0.5rem;"><img src="/admin/barcode?code=${encodeURIComponent(i.teraoka_barcode.trim())}" alt="" style="height:56px;"><br><small>${escapeHtml(i.product_name ?? "")}</small></span>`).join("")}</p>
        </div>`;
            }).join("");
            res.type("text/html").send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>批次匯出報表</title>
      <style>body{font-family:sans-serif;max-width:900px;margin:2rem auto;} table{border-collapse:collapse;} th,td{border:1px solid #333;padding:0.5rem;} @media print{.no-print{display:none;}}</style></head><body>
        <div class="no-print">${TOP_NAV}<p><button onclick="window.print()">列印／另存 PDF</button></p></div>
        ${htmlBlocks}
      </body></html>`);
            return;
        }
        const errMsg = req.query.err === "no_customer" ? "<p style='color:red'>請至少選擇一位客戶。</p>" : "";
        res.type("text/html").send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>批次匯出</title>
      <style>${ADMIN_STYLE} .page{max-width:600px;margin:2rem auto;padding:0 1.5rem;} label{display:block;margin:0.5rem 0;} .cust-list{max-height:200px;overflow:auto;border:1px solid var(--admin-border);padding:0.75rem;border-radius:6px;background:var(--admin-card);} .cust-list label{margin:0.35rem 0;}</style></head><body>
        <div class="page">${TOP_NAV}<h1>批次匯出</h1>${errMsg}
        <div class="card"><form method="get" action="/admin/export">
          <label>日期起 <input type="date" name="from" value="${escapeAttr(from)}"></label>
          <label>日期訖 <input type="date" name="to" value="${escapeAttr(to)}"></label>
          <p>客戶（至少選一）：</p>
          <div class="cust-list">
            <label><input type="checkbox" id="selAll"> 全選</label>
            <label><input type="checkbox" id="selNone"> 全不選</label>
            <br>${customerOptions}
          </div>
          <p>
            <button type="submit" name="action" value="summary" class="btn" style="background:var(--admin-primary);color:#fff;border:none;">看總表</button>
            <button type="submit" name="action" value="report" class="btn" style="background:var(--admin-primary);color:#fff;border:none;">匯出報表（多筆訂貨單）</button>
          </p>
        </form></div>
        <script>
        document.getElementById('selAll').onclick=function(){ document.querySelectorAll('input[name=customer_id]').forEach(function(c){c.checked=true;}); };
        document.getElementById('selNone').onclick=function(){ document.querySelectorAll('input[name=customer_id]').forEach(function(c){c.checked=false;}); };
        </script>
        <p><a href="/admin/orders" class="btn">← 回訂單查詢</a></p></div></body></html>`);
    });
    router.get("/specs", (req, res) => {
        const specRows = db.prepare(`
      SELECT s.id, s.product_id, s.unit, s.note_label, s.conversion_kg, p.name AS product_name
      FROM product_unit_specs s JOIN products p ON p.id = s.product_id ORDER BY p.name, s.unit
    `).all();
        const orderCombos = db.prepare(`
      SELECT DISTINCT oi.product_id, oi.unit FROM order_items oi
      WHERE LOWER(TRIM(oi.unit)) IN ('顆','粒','根') AND oi.product_id IS NOT NULL
    `).all();
        const comboKey = (r) => (r.product_id || "") + "|" + (r.unit || "");
        const specMap = new Map();
        specRows.forEach((r) => specMap.set(comboKey(r), r));
        const seen = new Set(orderCombos.map(comboKey));
        const productNames = new Map(db.prepare("SELECT id, name FROM products").all().map((r) => [r.id, r.name]));
        const rows = [];
        orderCombos.forEach((c) => {
            const key = comboKey(c);
            const spec = specMap.get(key);
            rows.push({
                product_id: c.product_id,
                unit: c.unit,
                product_name: productNames.get(c.product_id) || "—",
                spec_id: spec ? spec.id : null,
                note_label: spec ? spec.note_label : null,
                conversion_kg: spec ? spec.conversion_kg : null,
                from_orders: true,
            });
        });
        specRows.forEach((s) => {
            if (!seen.has(comboKey(s)))
                rows.push({ product_id: s.product_id, unit: s.unit, product_name: s.product_name, spec_id: s.id, note_label: s.note_label, conversion_kg: s.conversion_kg, from_orders: false });
        });
        rows.sort((a, b) => (a.product_name || "").localeCompare(b.product_name || "") || (a.unit || "").localeCompare(b.unit || ""));
        const msg = req.query.ok === "1" ? "<p style='color:green'>已儲存。</p>" : "";
        const tableRows = rows.map((r) => {
            const pending = !r.spec_id || (r.note_label == null || String(r.note_label).trim() === "") || r.conversion_kg == null;
            const badge = pending ? "<span style='color:red'>待補</span>" : "";
            const noteVal = (r.note_label != null && r.note_label !== "") ? escapeHtml(r.note_label) : "";
            const kgVal = r.conversion_kg != null ? String(r.conversion_kg) : "";
            if (r.spec_id) {
                return `<tr><td>${escapeHtml(r.product_name)}</td><td>${escapeHtml(r.unit)}</td><td>${badge}</td><td><form method="post" action="/admin/specs/update" style="display:inline;"><input type="hidden" name="spec_id" value="${escapeAttr(r.spec_id)}"><input type="text" name="note_label" value="${escapeAttr(noteVal)}" placeholder="備註"></td><td><input type="number" name="conversion_kg" value="${escapeAttr(kgVal)}" step="any" placeholder="推算公斤" style="width:6rem;"></td><td><button type="submit">儲存</button></form></td></tr>`;
            }
            return `<tr><td>${escapeHtml(r.product_name)}</td><td>${escapeHtml(r.unit)}</td><td>${badge}</td><td colspan="3"><form method="post" action="/admin/specs/new" style="display:inline;"><input type="hidden" name="product_id" value="${escapeAttr(r.product_id)}"><input type="hidden" name="unit" value="${escapeAttr(r.unit)}"><input type="text" name="note_label" placeholder="備註"><input type="number" name="conversion_kg" step="any" placeholder="推算公斤" style="width:6rem;"><button type="submit">新增規格</button></form></td></tr>`;
        }).join("");
        res.type("text/html").send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>單品規格表</title>
      <style>${ADMIN_STYLE} .page{max-width:900px;margin:2rem auto;padding:0 1.5rem;} input[type=text],input[type=number]{padding:0.4rem;border:1px solid var(--admin-border);border-radius:6px;}</style></head><body>
        <div class="page">${TOP_NAV}<h1>單品規格表（顆／粒／根）</h1>${msg}
        <div class="card"><p style="color:#6b7280;font-size:0.875rem;margin-top:0;">以下為訂單曾出現的品項＋單位，或手動新增的規格。可填<strong>備註</strong>（如「1顆」）與<strong>推算公斤</strong>，訂單明細會顯示推算結果。</p>
        <table><thead><tr><th>品項</th><th>單位</th><th>狀態</th><th>備註</th><th>推算公斤</th><th></th></tr></thead><tbody>${tableRows || "<tr><td colspan='6'>尚無資料</td></tr>"}</tbody></table>
        </div><p><a href="/admin" class="btn">← 回後台</a></p></div></body></html>`);
    });
    router.post("/specs/update", express_1.default.urlencoded({ extended: true }), (req, res) => {
        const specId = (req.body.spec_id || "").trim();
        const noteLabel = (req.body.note_label || "").trim() || null;
        const conversionKg = req.body.conversion_kg !== undefined && req.body.conversion_kg !== "" ? parseFloat(req.body.conversion_kg) : null;
        if (!specId) {
            res.redirect("/admin/specs?err=id");
            return;
        }
        db.prepare("UPDATE product_unit_specs SET note_label = ?, conversion_kg = ?, updated_at = datetime('now') WHERE id = ?").run(noteLabel, conversionKg, specId);
        res.redirect("/admin/specs?ok=1");
    });
    router.post("/specs/new", express_1.default.urlencoded({ extended: true }), (req, res) => {
        const productId = (req.body.product_id || "").trim();
        const unit = (req.body.unit || "").trim();
        const noteLabel = (req.body.note_label || "").trim() || null;
        const conversionKg = req.body.conversion_kg !== undefined && req.body.conversion_kg !== "" ? parseFloat(req.body.conversion_kg) : null;
        if (!productId || !unit) {
            res.redirect("/admin/specs?err=missing");
            return;
        }
        const id = (0, id_js_1.newId)("spec");
        db.prepare("INSERT OR IGNORE INTO product_unit_specs (id, product_id, unit, note_label, conversion_kg) VALUES (?, ?, ?, ?, ?)").run(id, productId, unit, noteLabel, conversionKg);
        res.redirect("/admin/specs?ok=1");
    });
    router.get("/customers/new", (req, res) => {
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>新增客戶</title>
      <style>body{font-family:sans-serif;max-width:520px;margin:2rem auto;padding:0 1rem;} label{display:block;margin-top:0.75rem;} input{width:100%;padding:0.5rem;box-sizing:border-box;} button{margin-top:1rem;padding:0.5rem 1rem;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>新增客戶</h1>
        <form method="post" action="/admin/customers/new">
          <label>客戶名稱 <input type="text" name="name" required placeholder="例：XX餐廳"></label>
          <label>寺岡編號（CustCode／QR） <input type="text" name="teraoka_code" placeholder="可留空"></label>
          <label>凌越編號（HQCustCode） <input type="text" name="hq_cust_code" placeholder="可留空"></label>
          <label>LINE 群組名稱 <input type="text" name="line_group_name" placeholder="可留空，之後可改"></label>
          <label>LINE 群組 ID <input type="text" name="line_group_id" placeholder="C開頭群組 ID，可留空後補"></label>
          <label>聯絡方式 <input type="text" name="contact" placeholder="電話或備註，可留空"></label>
          <button type="submit">建立</button>
        </form>
        <p><a href="/admin/customers">← 回客戶列表</a></p>
      </body>
      </html>
    `);
    });
    router.post("/customers/new", express_1.default.urlencoded({ extended: true }), (req, res) => {
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
        db.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact);
        res.redirect("/admin/customers?ok=1");
    });
    router.get("/customers/:id/quick-view", (req, res) => {
        const customer = db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active FROM customers WHERE id = ?").get(req.params.id);
        if (!customer) {
            res.status(404).send("客戶不存在");
            return;
        }
        const aliases = db.prepare(`
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
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>客戶資料</title>
      <style>body{font-family:sans-serif;max-width:560px;margin:2rem auto;padding:0 1rem;} table{border-collapse:collapse;} th,td{border:1px solid #ddd;padding:0.4rem;} .block{margin-top:1rem;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>${escapeHtml(customer.name)}</h1>
        <p><strong>聯絡</strong>：${escapeHtml(customer.contact ?? "—")}</p>
        <p><strong>預設單位</strong>（未填時）：${escapeHtml(customer.default_unit || "公斤")}</p>
        <p><strong>寺岡／凌越編號</strong>：${escapeHtml(customer.teraoka_code ?? "—")}／${escapeHtml(customer.hq_cust_code ?? "—")}</p>
        <p><strong>LINE 群組</strong>：${escapeHtml(customer.line_group_name ?? "—")} ${customer.line_group_id ? "（已綁定）" : "（未綁定）"}</p>
        <div class="block">
          <p><strong>叫貨備註／特殊情況</strong></p>
          <p style="white-space:pre-wrap;background:#f5f5f5;padding:0.5rem;">${escapeHtml(customer.order_notes || "（無）")}</p>
        </div>
        <div class="block">
          <p><strong>此客戶專用別名</strong></p>
          <table><thead><tr><th>客戶常叫的名稱</th><th>對應品項</th></tr></thead><tbody>${aliasRows || "<tr><td colspan='2'>尚無</td></tr>"}</tbody></table>
        </div>
        <p>${editLink}　${backLink}</p>
      </body>
      </html>
    `);
    });
    router.get("/customers/:id/edit", (req, res) => {
        const customer = db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active FROM customers WHERE id = ?").get(req.params.id);
        if (!customer) {
            res.status(404).send("客戶不存在");
            return;
        }
        const v = (s) => escapeAttr(s ?? "");
        const activeChecked = customer.active === undefined || customer.active === null || customer.active === 1;
        const editMsg = req.query.ok === "alias" ? "<p style='color:green'>已新增專用別名。</p>" : req.query.ok === "alias_del" ? "<p style='color:green'>已刪除專用別名。</p>" : req.query.err === "alias" ? "<p style='color:red'>請填寫別名與品項。</p>" : req.query.err === "dup" ? "<p style='color:red'>此客戶已存在相同別名。</p>" : "";
        const custAliases = db.prepare(`
      SELECT cpa.id, cpa.alias, p.name AS product_name
      FROM customer_product_aliases cpa
      JOIN products p ON p.id = cpa.product_id
      WHERE cpa.customer_id = ?
      ORDER BY cpa.alias
    `).all(customer.id);
        const productOptions = db.prepare("SELECT id, name FROM products WHERE (active IS NULL OR active = 1) ORDER BY name").all()
            .map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`)
            .join("");
        const aliasRows = custAliases
            .map((a) => `<tr><td>${escapeHtml(a.alias)}</td><td>${escapeHtml(a.product_name)}</td><td><form method="post" action="/admin/customers/${encodeURIComponent(customer.id)}/alias/${encodeURIComponent(a.id)}/delete" style="display:inline;"><button type="submit">刪除</button></form></td></tr>`)
            .join("");
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>編輯客戶</title>
      <style>body{font-family:sans-serif;max-width:620px;margin:2rem auto;padding:0 1rem;} label{display:block;margin-top:0.75rem;} input[type=text],textarea{width:100%;padding:0.5rem;box-sizing:border-box;} textarea{min-height:60px;} button{margin-top:1rem;padding:0.5rem 1rem;} table{border-collapse:collapse;} th,td{border:1px solid #ddd;padding:0.4rem;} .block{margin-top:1.5rem;padding:1rem;background:#f8f9fa;border-radius:8px;} .block h2{margin-top:0;font-size:1rem;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>編輯客戶</h1>
        ${editMsg}
        <form method="post" action="/admin/customers/${v(customer.id)}/edit">
          ${req.query.from === "orders" ? '<input type="hidden" name="from" value="orders">' : ""}
          <label>客戶名稱 <input type="text" name="name" value="${v(customer.name)}" required></label>
          <label>寺岡編號（CustCode／QR） <input type="text" name="teraoka_code" value="${v(customer.teraoka_code)}"></label>
          <label>凌越編號（HQCustCode） <input type="text" name="hq_cust_code" value="${v(customer.hq_cust_code)}"></label>
          <label>LINE 群組名稱 <input type="text" name="line_group_name" value="${v(customer.line_group_name)}" placeholder="可之後填"></label>
          <label>LINE 群組 ID <input type="text" name="line_group_id" value="${v(customer.line_group_id)}" placeholder="C開頭，綁定後機器人會認此群組"></label>
          <label>聯絡方式 <input type="text" name="contact" value="${v(customer.contact)}"></label>
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
          <label>叫貨備註／習慣說明 <textarea name="order_notes" placeholder="此客戶叫貨的習慣、特定說法或規則，僅供內部參考">${v(customer.order_notes)}</textarea></label>
          <label><input type="checkbox" name="active" value="1" ${activeChecked ? "checked" : ""}> 啟用（未勾選＝停用，停用後該群組不再對應叫貨）</label>
          <button type="submit">儲存</button>
        </form>
        <div class="block">
          <h2>此客戶專用別名（叫貨習慣）</h2>
          <p>此客戶在 LINE 叫貨時若輸入下列名稱，會對應到指定品項（僅此客戶適用）。</p>
          <table>
            <thead><tr><th>客戶常叫的名稱</th><th>對應品項</th><th>操作</th></tr></thead>
            <tbody>${aliasRows || "<tr><td colspan='3'>尚無專用別名</td></tr>"}</tbody>
          </table>
          <form method="post" action="/admin/customers/${v(customer.id)}/alias" style="margin-top:0.75rem;">
            <label>新增：客戶叫「<input type="text" name="alias" required placeholder="例：大陸妹">」→ 對應 <select name="product_id" required>${productOptions}</select></label>
            <button type="submit">新增</button>
          </form>
        </div>
        <p>${req.query.from === "orders" ? `<a href="/admin/orders">← 回訂單查詢</a>` : `<a href="/admin/customers">← 回客戶列表</a>`}</p>
      </body>
      </html>
    `);
    });
    router.post("/customers/:id/edit", express_1.default.urlencoded({ extended: true }), (req, res) => {
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
        db.prepare("UPDATE customers SET name = ?, teraoka_code = ?, hq_cust_code = ?, line_group_name = ?, line_group_id = ?, contact = ?, default_unit = ?, order_notes = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact, defaultUnit, orderNotes, active, id);
        const fromOrders = req.body?.from === "orders";
        res.redirect(fromOrders ? "/admin/orders?ok=edit" : "/admin/customers?ok=edit");
    });
    router.post("/customers/:id/alias", express_1.default.urlencoded({ extended: true }), (req, res) => {
        const customerId = req.params.id;
        const alias = req.body?.alias?.trim();
        const productId = req.body?.product_id?.trim();
        if (!alias || !productId) {
            res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?err=alias");
            return;
        }
        const cust = db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
        if (!cust) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        try {
            const id = (0, id_js_1.newId)("cpa");
            db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(id, customerId, productId, alias);
        }
        catch (e) {
            res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?err=dup");
            return;
        }
        res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?ok=alias");
    });
    router.post("/customers/:id/alias/:aliasId/delete", (req, res) => {
        const customerId = req.params.id;
        const aliasId = req.params.aliasId;
        const row = db.prepare("SELECT id FROM customer_product_aliases WHERE id = ? AND customer_id = ?").get(aliasId, customerId);
        if (!row) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("找不到此別名"));
            return;
        }
        db.prepare("DELETE FROM customer_product_aliases WHERE id = ?").run(aliasId);
        res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?ok=alias_del");
    });
    router.get("/customers", (req, res) => {
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
            ? db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, active FROM customers WHERE name LIKE ? ORDER BY name").all("%" + q + "%")
            : db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, active FROM customers ORDER BY name").all());
        const tbody = rows
            .map((r) => {
            const active = r.active === undefined || r.active === null || r.active === 1;
            return `<tr data-customer-id="${escapeAttr(r.id)}">
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.teraoka_code ?? "")}</td>
            <td>${escapeHtml(r.hq_cust_code ?? "")}</td>
            <td>${escapeHtml(r.line_group_name ?? "")}</td>
            <td>${r.line_group_id ? "已綁定" : "—"}</td>
            <td>${escapeHtml(r.contact ?? "")}</td>
            <td class="cust-status">${active ? "<span style='color:green'>啟用</span>" : "<span style='color:gray'>停用</span>"}</td>
            <td>
              <a href="/admin/customers/${encodeURIComponent(r.id)}/edit">編輯</a>
              | <button type="button" class="toggle-cust" data-id="${escapeAttr(r.id)}">${active ? "停用" : "啟用"}</button>
              | <a href="/admin/customers/${encodeURIComponent(r.id)}/delete">刪除</a>
            </td>
          </tr>`;
        })
            .join("");
        const searchVal = escapeAttr(q);
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>客戶管理</title>
      <style>body{font-family:sans-serif;max-width:1200px;margin:2rem auto;padding:0 1rem;} table{border-collapse:collapse;} th,td{border:1px solid #ddd;padding:0.5rem;} input[type=search]{padding:0.4rem 0.6rem;width:220px;} .search-form{display:flex;gap:0.5rem;align-items:center;margin-bottom:1rem;} button.toggle-cust{padding:0.2rem 0.5rem;cursor:pointer;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>客戶管理</h1>
        ${msg}
        <p><a href="/admin/customers/new">＋ 新增客戶</a>、<a href="/admin/import-customers">匯入客戶</a></p>
        <form method="get" action="/admin/customers" class="search-form">
          <label>搜尋（名稱模糊）：<input type="search" name="q" value="${searchVal}" placeholder="輸入關鍵字"></label>
          <button type="submit">搜尋</button>
          ${q ? `<a href="/admin/customers">清除</a>` : ""}
        </form>
        <p>匯入後可點「編輯」補上 LINE 群組名稱、LINE 群組 ID。停用後該群組將不再對應叫貨。</p>
        <table>
          <thead><tr><th>名稱</th><th>寺岡編號</th><th>凌越編號</th><th>LINE 群組名稱</th><th>LINE 綁定</th><th>聯絡</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>${tbody}</tbody>
        </table>
        <p><a href="/admin">← 回後台</a></p>
        <script>
        document.querySelectorAll('.toggle-cust').forEach(function(btn){
          btn.onclick=function(){
            var id=this.dataset.id; var self=this;
            fetch('/admin/customers/'+encodeURIComponent(id)+'/toggle',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:''})
              .then(function(r){return r.json();}).then(function(d){
                if(d.ok){
                  var row=document.querySelector('tr[data-customer-id="'+id.replace(/"/g,'\\"')+'"]');
                  if(row){ var statusTd=row.querySelector('.cust-status'); if(statusTd) statusTd.innerHTML=d.active===1?"<span style=\\"color:green\\">啟用</span>":"<span style=\\"color:gray\\">停用</span>"; self.textContent=d.active===1?'停用':'啟用'; }
                }
              });
          };
        });
        </script>
      </body>
      </html>
    `);
    });
    router.post("/customers/:id/toggle", express_1.default.urlencoded({ extended: true }), (req, res) => {
        const id = req.params.id;
        const wantsJson = /application\/json/i.test(req.get("Accept") || "");
        const row = db.prepare("SELECT active FROM customers WHERE id = ?").get(id);
        if (!row) {
            if (wantsJson)
                return res.status(404).json({ ok: false, error: "客戶不存在" });
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        const next = (row.active === 1 ? 0 : 1);
        db.prepare("UPDATE customers SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        if (wantsJson)
            return res.json({ ok: true, active: next });
        res.redirect("/admin/customers?ok=toggle");
    });
    router.get("/customers/:id/delete", (req, res) => {
        const customer = db.prepare("SELECT id, name FROM customers WHERE id = ?").get(req.params.id);
        if (!customer) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        const orderCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE customer_id = ?").get(customer.id);
        const hasOrders = (orderCount?.c ?? 0) > 0;
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>確認刪除</title>
      <style>body{font-family:sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem;} .btn{margin-right:0.5rem;padding:0.4rem 0.8rem;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>確認刪除客戶</h1>
        <p>確定要刪除「${escapeHtml(customer.name)}」？</p>
        ${hasOrders ? "<p style='color:red'>此客戶已有訂單，無法刪除。請改為「停用」。</p>" : ""}
        <p>
          ${!hasOrders ? `<form method="post" action="/admin/customers/${encodeURIComponent(customer.id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form>` : ""}
          <a href="/admin/customers" class="btn">取消</a>
        </p>
        <p><a href="/admin/customers">← 回客戶列表</a></p>
      </body>
      </html>
    `);
    });
    router.post("/customers/:id/delete", (req, res) => {
        const id = req.params.id;
        const orderCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE customer_id = ?").get(id);
        if ((orderCount?.c ?? 0) > 0) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("此客戶已有訂單，無法刪除。請改為停用。"));
            return;
        }
        db.prepare("DELETE FROM customers WHERE id = ?").run(id);
        res.redirect("/admin/customers?ok=del");
    });
    router.get("/products", (req, res) => {
        const q = req.query.q?.trim() ?? "";
        const showInactive = req.query.inactive === "1";
        let products = db.prepare(`
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
        const aliasRows = db.prepare("SELECT product_id, alias FROM product_aliases").all();
        for (const a of aliasRows) {
            if (!aliasesByProduct.has(a.product_id))
                aliasesByProduct.set(a.product_id, []);
            aliasesByProduct.get(a.product_id).push(a.alias);
        }
        const okMsg = req.query.ok === "del" ? "已刪除品項。" : req.query.ok === "edit" ? "已儲存。" : req.query.ok === "toggle" ? "已更新狀態。" : "";
        const msg = okMsg ? "<p style='color:green'>" + okMsg + "</p>" : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const tbody = products
            .map((p) => {
            const active = p.active === 1;
            return `<tr data-product-id="${escapeAttr(p.id)}">
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.erp_code ?? "")}</td>
            <td>${escapeHtml(p.teraoka_barcode ?? "")}</td>
            <td>${escapeHtml(p.unit)}</td>
            <td>${(aliasesByProduct.get(p.id) ?? []).map((a) => escapeHtml(a)).join("、") || "—"} <a href="/admin/products/${encodeURIComponent(p.id)}/aliases">管理</a></td>
            <td class="prod-status">${active ? "啟用" : "<span style='color:#888'>停用</span>"}</td>
            <td>
              <a href="/admin/products/${encodeURIComponent(p.id)}/edit">編輯</a>
              | <button type="button" class="toggle-prod" data-id="${escapeAttr(p.id)}">${active ? "停用" : "啟用"}</button>
              | <a href="/admin/products/${encodeURIComponent(p.id)}/delete">刪除</a>
            </td>
          </tr>`;
        })
            .join("");
        const filterLink = showInactive
            ? `<a href="/admin/products${q ? "?q=" + encodeURIComponent(q) : ""}">只看啟用</a>`
            : `<a href="/admin/products?inactive=1${q ? "&q=" + encodeURIComponent(q) : ""}">只看停用</a>`;
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>品項與俗名</title>
      <style>body{font-family:sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;} table{border-collapse:collapse;} th,td{border:1px solid #ddd;padding:0.5rem;} .ops a, .ops form{display:inline;margin-right:0.25rem;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>品項與俗名</h1>
        ${msg}
        <p><a href="/admin/import">匯入品項</a>、<a href="/admin/import-teraoka">寺岡資料對照</a>　${filterLink}</p>
        <form method="get" action="/admin/products" style="margin-bottom:1rem;">
          <input type="hidden" name="inactive" value="${showInactive ? "1" : ""}">
          <input type="search" name="q" value="${escapeAttr(q)}" placeholder="搜尋品名、料號、條碼">
          <button type="submit">搜尋</button>
        </form>
        <p><strong>查詢俗名</strong>（排查重複）：輸入俗名可查目前對應哪個品項　<a href="/admin/alias-lookup">前往查詢</a></p>
        <table>
          <thead><tr><th>標準品名</th><th>凌越料號</th><th>寺岡條碼</th><th>單位</th><th>俗名</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>${tbody.length ? tbody : "<tr><td colspan='7'>無符合的品項</td></tr>"}</tbody>
        </table>
        <p><a href="/admin">← 回後台</a></p>
        <script>
        document.querySelectorAll('.toggle-prod').forEach(function(btn){
          btn.onclick=function(){ var id=this.dataset.id; var self=this;
            fetch('/admin/products/'+encodeURIComponent(id)+'/toggle',{method:'POST',headers:{'Accept':'application/json'}})
              .then(function(r){return r.json();}).then(function(d){
                if(d.ok){ var row=document.querySelector('tr[data-product-id="'+id.replace(/"/g,'\\\\"')+'"]');
                  if(row){ var statusTd=row.querySelector('.prod-status'); if(statusTd) statusTd.innerHTML=d.active===1?'啟用':"<span style=\\"color:#888\\">停用</span>"; self.textContent=d.active===1?'停用':'啟用'; }
                }
              });
          };
        });
        </script>
      </body>
      </html>
    `);
    });
    router.get("/alias-lookup", (req, res) => {
        const q = (req.query.q || "").trim();
        let result = "";
        if (q) {
            const row = db.prepare("SELECT pa.alias, p.id AS product_id, p.name AS product_name FROM product_aliases pa JOIN products p ON p.id = pa.product_id WHERE LOWER(TRIM(pa.alias)) = ?").get(q.toLowerCase().trim());
            const custRows = db.prepare("SELECT cpa.alias, c.name AS customer_name, p.name AS product_name FROM customer_product_aliases cpa JOIN products p ON p.id = cpa.product_id JOIN customers c ON c.id = cpa.customer_id WHERE LOWER(TRIM(cpa.alias)) = ?").all(q.toLowerCase().trim());
            if (row)
                result = "<p>俗名「" + escapeHtml(q) + "」對應品項：<strong>" + escapeHtml(row.product_name) + "</strong>（" + escapeHtml(row.product_id) + "）</p>";
            else if (custRows.length > 0)
                result = "<p>俗名「" + escapeHtml(q) + "」為<strong>客戶專用別名</strong>：</p><ul>" + custRows.map((r) => "<li>" + escapeHtml(r.customer_name) + " → " + escapeHtml(r.product_name) + "</li>").join("") + "</ul>";
            else
                result = "<p>查無俗名「" + escapeHtml(q) + "」的對照。</p>";
        }
        res.type("text/html").send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>查詢俗名</title>
      <style>body{font-family:sans-serif;max-width:560px;margin:2rem auto;} label{display:block;margin:0.5rem 0;}</style></head><body>
        ${TOP_NAV}<h1>查詢俗名</h1>
        <p>輸入俗名可查目前對應哪個品項（排查重複用）。</p>
        <form method="get" action="/admin/alias-lookup">
          <label>俗名 <input type="text" name="q" value="${escapeAttr(q)}" placeholder="例：大陸妹"></label>
          <button type="submit">查詢</button>
        </form>
        ${result}
        <p><a href="/admin/products">← 回品項與俗名</a></p>
      </body></html>`);
    });
    router.get("/products/:id/aliases", (req, res) => {
        const productId = req.params.id;
        const product = db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const aliases = db.prepare("SELECT id, alias FROM product_aliases WHERE product_id = ? ORDER BY alias").all(productId);
        const msg = req.query.ok === "1" ? "<p style='color:green'>已儲存。</p>" : req.query.ok === "del" ? "<p style='color:green'>已刪除。</p>" : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const rows = aliases
            .map((a) => `<tr>
            <td>${escapeHtml(a.alias)}</td>
            <td><a href="/admin/aliases/${encodeURIComponent(a.id)}/edit">編輯</a> | <form method="post" action="/admin/aliases/${encodeURIComponent(a.id)}/delete" style="display:inline;"><button type="submit">刪除</button></form></td>
          </tr>`)
            .join("");
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>俗名管理</title>
      <style>body{font-family:sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;} table{border-collapse:collapse;} th,td{border:1px solid #ddd;padding:0.5rem;} form{display:inline;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>俗名管理：${escapeHtml(product.name)}</h1>
        ${msg}
        <table>
          <thead><tr><th>俗名（別名）</th><th>操作</th></tr></thead>
          <tbody>${rows || "<tr><td colspan='2'>尚無俗名</td></tr>"}</tbody>
        </table>
        <h2>新增俗名</h2>
        <form method="post" action="/admin/alias" style="display:block;">
          <input type="hidden" name="scope" value="global">
          <input type="hidden" name="product_id" value="${escapeAttr(product.id)}">
          <input type="hidden" name="redirect" value="/admin/products/${encodeURIComponent(product.id)}/aliases">
          <label>別名（客戶可能這樣叫）<input type="text" name="alias" required placeholder="例：高麗菜心"></label>
          <button type="submit">新增</button>
        </form>
        <p><a href="/admin/products">← 回品項列表</a></p>
      </body>
      </html>
    `);
    });
    router.get("/aliases/:id/edit", (req, res) => {
        const id = req.params.id;
        const row = db.prepare("SELECT pa.id, pa.alias, pa.product_id, p.name AS product_name FROM product_aliases pa JOIN products p ON p.id = pa.product_id WHERE pa.id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const errMsg = req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>編輯俗名</title>
      <style>body{font-family:sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem;} label{display:block;margin-top:0.5rem;} input{width:100%;padding:0.4rem;box-sizing:border-box;} button{margin-top:0.5rem;padding:0.4rem 0.8rem;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>編輯俗名</h1>
        <p>品項：${escapeHtml(row.product_name)}</p>
        ${errMsg}
        <form method="post" action="/admin/aliases/${encodeURIComponent(id)}/edit">
          <label>別名 <input type="text" name="alias" value="${escapeAttr(row.alias)}" required></label>
          <button type="submit">儲存</button>
        </form>
        <p><a href="/admin/products/${encodeURIComponent(row.product_id)}/aliases">← 回俗名管理</a></p>
      </body>
      </html>
    `);
    });
    router.post("/aliases/:id/edit", express_1.default.urlencoded({ extended: true }), (req, res) => {
        const id = req.params.id;
        const aliasTrim = req.body?.alias?.trim();
        if (!aliasTrim) {
            res.redirect("/admin/aliases/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("別名不可為空"));
            return;
        }
        const row = db.prepare("SELECT id, product_id FROM product_aliases WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const existing = db.prepare("SELECT id FROM product_aliases WHERE alias = ? AND id != ?").get(aliasTrim, id);
        if (existing) {
            res.redirect("/admin/aliases/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("此別名已被其他品項使用"));
            return;
        }
        db.prepare("UPDATE product_aliases SET alias = ? WHERE id = ?").run(aliasTrim, id);
        res.redirect("/admin/products/" + encodeURIComponent(row.product_id) + "/aliases?ok=1");
    });
    router.post("/aliases/:id/delete", (req, res) => {
        const id = req.params.id;
        const row = db.prepare("SELECT product_id FROM product_aliases WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        db.prepare("DELETE FROM product_aliases WHERE id = ?").run(id);
        res.redirect("/admin/products/" + encodeURIComponent(row.product_id) + "/aliases?ok=del");
    });
    router.get("/products/:id/edit", (req, res) => {
        const row = db.prepare("SELECT id, name, erp_code, teraoka_barcode, unit, active FROM products WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const errMsg = req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>編輯品項</title>
      <style>body{font-family:sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem;} label{display:block;margin-top:0.75rem;} input[type=text],select{width:100%;padding:0.4rem;box-sizing:border-box;} button{margin-top:1rem;padding:0.5rem 1rem;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>編輯品項</h1>
        ${errMsg}
        <form method="post" action="/admin/products/${encodeURIComponent(row.id)}/edit">
          <label>標準品名 <input type="text" name="name" value="${escapeAttr(row.name)}" required></label>
          <label>凌越料號 <input type="text" name="erp_code" value="${escapeAttr(row.erp_code ?? "")}"></label>
          <label>寺岡條碼 <input type="text" name="teraoka_barcode" value="${escapeAttr(row.teraoka_barcode ?? "")}"></label>
          <label>單位 <select name="unit">
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
          <br><button type="submit">儲存</button>
        </form>
        <p><a href="/admin/products">← 回品項列表</a></p>
      </body>
      </html>
    `);
    });
    router.post("/products/:id/edit", (req, res) => {
        const id = req.params.id;
        const row = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const name = (req.body?.name ?? "").trim();
        if (!name) {
            res.redirect("/admin/products/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("品名不可為空"));
            return;
        }
        const existing = db.prepare("SELECT id FROM products WHERE name = ? AND id != ?").get(name, id);
        if (existing) {
            res.redirect("/admin/products/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("品名已存在"));
            return;
        }
        const erpCode = (req.body?.erp_code ?? "").trim() || null;
        const teraokaBarcode = (req.body?.teraoka_barcode ?? "").trim() || null;
        const unit = (req.body?.unit ?? "公斤").trim() || "公斤";
        const active = req.body?.active === "1" ? 1 : 0;
        db.prepare("UPDATE products SET name = ?, erp_code = ?, teraoka_barcode = ?, unit = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, erpCode, teraokaBarcode, unit, active, id);
        res.redirect("/admin/products?ok=edit");
    });
    router.post("/products/:id/toggle", (req, res) => {
        const id = req.params.id;
        const wantsJson = /application\/json/i.test(req.get("Accept") || "");
        const row = db.prepare("SELECT id, active FROM products WHERE id = ?").get(id);
        if (!row) {
            if (wantsJson)
                return res.status(404).json({ ok: false, error: "找不到此品項" });
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const next = row.active === 1 ? 0 : 1;
        db.prepare("UPDATE products SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        if (wantsJson)
            return res.json({ ok: true, active: next });
        res.redirect("/admin/products?ok=toggle");
    });
    router.get("/products/:id/delete", (req, res) => {
        const id = req.params.id;
        const product = db.prepare("SELECT id, name FROM products WHERE id = ?").get(id);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const refCount = db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?").get(id);
        const hasOrders = (refCount?.c ?? 0) > 0;
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>確認刪除品項</title>
      <style>body{font-family:sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem;} .btn{margin-right:0.5rem;padding:0.4rem 0.8rem;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>確認刪除品項</h1>
        <p>確定要刪除「${escapeHtml(product.name)}」？</p>
        ${hasOrders ? "<p style='color:red'>此品項已被訂單使用，無法刪除。請改為「停用」。</p>" : ""}
        <p>
          ${!hasOrders ? `<form method="post" action="/admin/products/${encodeURIComponent(id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form>` : ""}
          <a href="/admin/products" class="btn">取消</a>
        </p>
        <p><a href="/admin/products">← 回品項列表</a></p>
      </body>
      </html>
    `);
    });
    router.post("/products/:id/delete", (req, res) => {
        const id = req.params.id;
        const refCount = db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?").get(id);
        if ((refCount?.c ?? 0) > 0) {
            res.redirect("/admin/products?err=" + encodeURIComponent("此品項已被訂單使用，無法刪除。請改為停用。"));
            return;
        }
        db.prepare("DELETE FROM products WHERE id = ?").run(id);
        res.redirect("/admin/products?ok=del");
    });
    router.get("/import", (req, res) => {
        const msg = req.query.ok ? `<p style='color:green'>已匯入 ${req.query.ok} 筆品項。</p>` : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>匯入品項</title>
      <style>body{font-family:sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;} textarea{width:100%;height:200px;padding:0.5rem;box-sizing:border-box;} button{margin-top:0.5rem;padding:0.5rem 1rem;} label{display:block;margin-top:0.5rem;} pre{background:#f5f5f5;padding:0.75rem;overflow:auto;font-size:0.9em;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>匯入品項</h1>
        ${msg}
        <p>第一列為標題，支援欄位：</p>
        <ul>
          <li>品名：<code>CommName</code>、<code>標準品名</code>、<code>name</code></li>
          <li>寺岡號碼（條碼）：<code>PluCode</code>、<code>寺岡條碼</code>、<code>teraoka_barcode</code></li>
          <li>凌越料號：<code>HQPluCode</code>、<code>ERP料號</code>、<code>erp_code</code></li>
          <li>單位：<code>QtySymbol</code>、<code>單位</code>、<code>unit</code></li>
        </ul>
        <p>同一品名已存在時會略過不覆蓋。</p>
        <form method="post" action="/admin/import" enctype="multipart/form-data">
          <label>匯入時若單位為空，使用（常用單位）：<select name="default_unit">
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
          <label>或上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
          <br>或貼上 CSV：
          <textarea name="csv" placeholder="貼上 CSV 內容..."></textarea>
          <br><button type="submit">匯入</button>
        </form>
        <p><a href="/admin/products">← 回品項列表</a></p>
      </body>
      </html>
    `);
    });
    router.post("/import", upload, (req, res) => {
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
        const existingNames = new Set(db.prepare("SELECT name FROM products").all().map((r) => r.name));
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
            db.prepare("INSERT INTO products (id, name, erp_code, teraoka_barcode, unit) VALUES (?, ?, ?, ?, ?)").run(id, name, erpCode, teraoka, unit);
            existingNames.add(name);
            imported++;
        }
        res.redirect("/admin/import?ok=" + imported);
    });
    router.get("/import-customers", (req, res) => {
        const msg = req.query.ok ? `<p style='color:green'>匯入結果：${escapeHtml(String(req.query.ok))}。</p>` : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>匯入客戶</title>
      <style>body{font-family:sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;} textarea{width:100%;height:180px;padding:0.5rem;box-sizing:border-box;} button{margin-top:0.5rem;padding:0.5rem 1rem;} pre{background:#f5f5f5;padding:0.75rem;font-size:0.9em;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>匯入客戶</h1>
        ${msg}
        <p>請貼上 CSV 或上傳 Excel，<strong>第一列為標題</strong>。支援欄位：</p>
        <ul>
          <li><strong>CustName</strong> / 客戶名稱（必填）</li>
          <li><strong>LineGroupId</strong> / LINE群組ID － 綁定叫貨群組（可匯入時一併填，或之後編輯補上）</li>
          <li><strong>CustCode</strong> → 寺岡編號、<strong>HQCustCode</strong> → 凌越編號</li>
          <li>聯絡：<code>CustTel</code>、<code>Fax</code>、<code>Contact</code>、<code>Email</code> 會合併</li>
        </ul>
        <p><strong>大量群組</strong>：在各群組傳「取得群組ID」，機器人會回傳該群組 ID；收集成 Excel 後用「客戶名稱 + LINE群組ID」匯入即可批次綁定。</p>
        <pre>客戶名稱, LINE群組ID, 聯絡
XX餐廳, C1234..., 02-12345678
YY小吃, C5678...,</pre>
        <p>支援 <strong>CSV 貼上</strong> 或 <strong>Excel（.xlsx / .xls）上傳</strong>。</p>
        <form method="post" action="/admin/import-customers" enctype="multipart/form-data">
          <label>或上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
          <br><br>或貼上 CSV：
          <textarea name="csv" placeholder="貼上 CSV 內容..."></textarea>
          <br><button type="submit">匯入</button>
        </form>
        <p><a href="/admin/customers">← 回客戶列表</a></p>
      </body>
      </html>
    `);
    });
    router.post("/import-customers", upload, (req, res) => {
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
            const existing = db.prepare("SELECT id FROM customers WHERE name = ?").get(name);
            if (existing) {
                db.prepare("UPDATE customers SET teraoka_code = COALESCE(?, teraoka_code), hq_cust_code = COALESCE(?, hq_cust_code), contact = COALESCE(?, contact), line_group_id = COALESCE(?, line_group_id), updated_at = datetime('now') WHERE id = ?").run(teraokaCode ?? null, hqCustCode ?? null, contact ?? null, lineGroupId || null, existing.id);
                if (lineGroupId)
                    updated++;
            }
            else {
                db.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_id, contact) VALUES (?, ?, ?, ?, ?, ?)").run((0, id_js_1.newId)("cust"), name, teraokaCode, hqCustCode, lineGroupId, contact);
                imported++;
            }
        }
        const resultMsg = imported > 0 ? `新增 ${imported} 筆` : "";
        const resultMsg2 = updated > 0 ? (resultMsg ? "；" : "") + `更新 ${updated} 筆 LINE 群組綁定` : "";
        res.redirect("/admin/import-customers?ok=" + encodeURIComponent(resultMsg + resultMsg2 || "0"));
    });
    router.get("/import-teraoka", (req, res) => {
        const ok = req.query.ok;
        const matched = req.query.matched;
        const unmatched = req.query.unmatched;
        let msg = "";
        if (ok === "1" && matched !== undefined)
            msg = `<p style='color:green'>對照完成。已更新寺岡條碼：${matched} 筆。</p>`;
        if (unmatched !== undefined && unmatched !== "0")
            msg += `<p style='color:orange'>未對應到品項（請先建品項或俗名）：${unmatched} 筆。</p>`;
        if (req.query.err)
            msg += `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>`;
        res.type("text/html").send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>寺岡資料對照</title>
      <style>body{font-family:sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;} textarea{width:100%;height:200px;padding:0.5rem;box-sizing:border-box;} button{margin-top:0.5rem;padding:0.5rem 1rem;} pre{background:#f5f5f5;padding:0.75rem;font-size:0.9em;}</style>
      </head>
      <body>
        ${TOP_NAV}
        <h1>寺岡資料對照</h1>
        ${msg}
        <p>貼上<strong>寺岡匯出的 CSV</strong>，系統會依<strong>品名</strong>對照到現有品項，並寫入<strong>寺岡條碼</strong>。</p>
        <p>第一列為標題，需有「品名」或「名稱」欄（對應我們的標準品名或俗名）、以及「條碼」或「編號」欄（寺岡條碼）。</p>
        <pre>品名, 條碼
高麗菜, T001
福山萵苣, T002
大陸妹, T002</pre>
        <p>若寺岡的品名與系統不完全一致，請先在「品項與俗名」或「待確認品名」建立俗名對照，再匯入。</p>
        <p>支援 <strong>CSV 貼上</strong> 或 <strong>Excel（.xlsx / .xls）上傳</strong>。</p>
        <form method="post" action="/admin/import-teraoka" enctype="multipart/form-data">
          <label>或上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
          <br><br>或貼上 CSV：
          <textarea name="csv" placeholder="貼上寺岡匯出的 CSV..."></textarea>
          <br><button type="submit">對照並更新</button>
        </form>
        <p><a href="/admin/products">← 回品項列表</a></p>
      </body>
      </html>
    `);
    });
    router.post("/import-teraoka", upload, (req, res) => {
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
        for (const row of db.prepare("SELECT id, name FROM products").all()) {
            productByName.set(row.name, row.id);
        }
        for (const row of db.prepare("SELECT product_id, alias FROM product_aliases").all()) {
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
                db.prepare("UPDATE products SET teraoka_barcode = ?, updated_at = datetime('now') WHERE id = ?").run(barcode, productId);
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
