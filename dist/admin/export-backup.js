"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExportBackupRoutes = registerExportBackupRoutes;

// 匯出備份域（當日出貨明細匯出、整庫 JSON 備份下載）路由：
// 自 index.js 拆出（拆檔批次 8），純搬移、行為不變。

const express_1 = { default: require("express") };
const XLSX = require("xlsx");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerExportBackupRoutes(router, ctx) {
    const { db, notionPage, getWorkingDate } = ctx;
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
        res.type("text/html").send(notionPage("資料匯出", body, "export", res));
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
    const BACKUP_TABLE_NAMES = [
        "customers", "products", "orders", "order_items", "order_attachments",
        "app_settings", "wholesale_market_snapshots", "line_bot_state_log",
        "product_aliases", "customer_product_aliases", "customer_handwriting_hints", "customer_order_image_examples", "product_unit_specs", "product_packaging_ratios",
        "inventory_warehouses", "inventory_warehouse_products", "erp_sales", "daily_inventory",
        "logistics_orders", "logistics_order_items",
        "freezer_fridge_warehouses", "freezer_fridge_daily",
    ];
    function jsonSafeBackupValue(v) {
        if (v == null)
            return v;
        if (v instanceof Date)
            return v.toISOString();
        return v;
    }
    function jsonSafeBackupRow(row) {
        if (!row || typeof row !== "object")
            return row;
        const o = {};
        for (const k of Object.keys(row))
            o[k] = jsonSafeBackupValue(row[k]);
        return o;
    }
    router.get("/backup", async (_req, res) => {
        const isPg = Boolean(process.env.DATABASE_URL);
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 資料備份</div>
        <h1 class="notion-page-title">資料備份</h1>
        <div class="notion-card">
          <h2 style="margin-top:0;">一鍵匯出（JSON）</h2>
          <p class="notion-hint">將主要資料表匯成單一 JSON 檔，可另存於本機或雲端硬碟；內容含客戶、品項、訂單、盤點、北農行情快照、紙本訂單等。請妥善保管，檔案可能含營業資訊。</p>
          <p><a href="/admin/backup/download-json" class="btn btn-primary">下載完整備份 JSON</a></p>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">資料庫檔案層級備份</h2>
          <p class="notion-hint">${isPg
            ? "目前使用 <strong>PostgreSQL</strong>（<code>DATABASE_URL</code>）。請依主機方案啟用自動備份，或自行以 <code>pg_dump</code> 定期匯出；亦可搭配上方 JSON 作為額外副本。"
            : "目前使用 <strong>SQLite</strong>（預設路徑見環境變數 <code>DB_PATH</code>）。可定期複製 <code>.db</code> 檔至安全位置；專案內附 <code>scripts/backup-db.sh</code> 可將資料庫複製到 <code>data/backups/</code>。"}</p>
        </div>
      `;
        res.type("text/html").send(notionPage("資料備份", body, "backup", res));
    });
    router.get("/backup/download-json", async (_req, res) => {
        const exportedAt = new Date().toISOString();
        const payload = {
            exportedAt,
            format: "songfu_linebot_backup_v1",
            databaseKind: process.env.DATABASE_URL ? "postgresql" : "sqlite",
            tables: {},
        };
        for (const name of BACKUP_TABLE_NAMES) {
            try {
                const rows = await db.prepare("SELECT * FROM " + name).all();
                payload.tables[name] = (rows || []).map((r) => jsonSafeBackupRow(r));
            }
            catch (e) {
                payload.tables[name] = { _error: String(e?.message || e) };
            }
        }
        const stamp = exportedAt.slice(0, 10);
        res.setHeader("Content-Disposition", "attachment; filename=\"songfu-backup-" + stamp + ".json\"");
        res.type("application/json; charset=utf-8").send(JSON.stringify(payload, null, 2));
    });
}
