"use strict";
/**
 * LIFF 路由：
 *  GET  /liff/employee-bind            -> 員工綁定 LIFF 頁（注入 LIFF_ID）
 *  GET  /liff/api/employee-bind/lookup -> 查詢綁定 token 對應的員工 username
 *  POST /liff/api/employee-bind/verify -> 驗 ID Token + 一次性 token，完成綁定
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLiffRouter = createLiffRouter;

const express_1 = require("express");
const fs_1 = require("fs");
const path_1 = require("path");
const index_js_1 = require("../db/index.js");
const liff_verify_js_1 = require("../lib/liff-verify.js");
const liff_bind_token_js_1 = require("../lib/liff-bind-token.js");
const liff_auth_js_1 = require("../lib/liff-auth.js");
const employee_line_binding_js_1 = require("../lib/employee-line-binding.js");
const line_bot_control_js_1 = require("../lib/line-bot-control.js");
const basket_log_js_1 = require("../lib/basket-log.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const stocktake_api_js_1 = require("../lib/stocktake-api.js");

// 訂單審核 LIFF 允許的職稱（之後若要擴可加 "課長"、"行政"）
const ORDER_REVIEW_ROLES = ["經理", "主任", "課長"];

function readTemplate(name) {
    try {
        return (0, fs_1.readFileSync)((0, path_1.join)(__dirname, name), "utf8");
    } catch (e) {
        return null;
    }
}

function noStore(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
}

function createLiffRouter() {
    const router = express_1.Router();
    const dbPath = process.env.DB_PATH ?? "./data/songfu.db";

    // 通用：把 LIFF_ID 注入頁面後回傳
    function serveLiffPage(res, fileName, liffId) {
        const tpl = readTemplate(fileName);
        if (!tpl) {
            res.status(500).type("text/plain").send("LIFF 頁面樣板缺失：" + fileName);
            return;
        }
        const html = tpl.replace(
            "<script src=\"https://static.line-scdn.net/liff/edge/2/sdk.js\">",
            `<script>window.__LIFF_ID__=${JSON.stringify(liffId || "")};</script>\n<script src="https://static.line-scdn.net/liff/edge/2/sdk.js">`
        );
        noStore(res);
        res.type("text/html").send(html);
    }

    // 員工綁定 LIFF 頁
    router.get("/employee-bind", (_req, res) => {
        serveLiffPage(res, "employee-bind.html", (process.env.LIFF_ID_EMPLOYEE_BIND || "").trim());
    });

    // 訂單審核 LIFF 頁
    router.get("/order-review", (_req, res) => {
        serveLiffPage(res, "order-review.html", (process.env.LIFF_ID_ORDER_REVIEW || "").trim());
    });
    // 冷凍冷藏溫度記錄 LIFF 頁
    router.get("/freezer-temp", (_req, res) => {
        serveLiffPage(res, "freezer-temp.html", (process.env.LIFF_ID_FREEZER_TEMP || "").trim());
    });
    // 客戶速查 LIFF 頁
    router.get("/customer-lookup", (_req, res) => {
        serveLiffPage(res, "customer-lookup.html", (process.env.LIFF_ID_CUSTOMER_LOOKUP || "").trim());
    });
    // 空籃記帳 LIFF 頁
    router.get("/basket-log", (_req, res) => {
        serveLiffPage(res, "basket-log.html", (process.env.LIFF_ID_BASKET_LOG || "").trim());
    });

    // ── 盤點 LIFF 頁 + API（誰都可以盤，需 LINE 登入；群組白名單由 #盤點 控制）──
    const STOCKTAKE_LIFF_ID = (process.env.LIFF_ID_STOCKTAKE || "2010106501-VocNwkbA").trim();
    router.get("/stocktake", (_req, res) => { serveLiffPage(res, "stocktake.html", STOCKTAKE_LIFF_ID); });
    // 台北時區日期改用 lib/stocktake-api.js 的 stkTaipeiDate（單一實作）
    async function stkAuth(req, res) {
        const idToken = (0, liff_auth_js_1.readBearerIdToken)(req);
        if (!idToken) { res.status(401).json({ error: "需 LINE 登入" }); return null; }
        const v = await (0, liff_verify_js_1.verifyLineIdToken)(idToken);
        if (!v.ok) { res.status(401).json({ error: v.error || "登入驗證失敗" }); return null; }
        return v;
    }
    // [refactor 2026-07-14] warehouses/items/submit 三套端點（LIFF／後台掃碼／後台網頁盤點）
    // 的資料邏輯收斂到 dist/lib/stocktake-api.js 單一權威；這裡只剩認證＋參數＋身分。
    router.get("/api/stocktake/warehouses", async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const db = (0, index_js_1.getDb)(dbPath);
            // 多公司：不帶 icpno＝'00'（松富，行為不變）；掃碼頁帶 icpno=02（松揚）等
            const icpno = (0, erp_companies_js_1.normIcpno)(req.query.icpno);
            res.json(await stocktake_api_js_1.listStocktakeWarehouses(db, { icpno }));
        } catch (e) { console.error("[liff stocktake warehouses]", e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.get("/api/stocktake/items", async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const code = String(req.query.warehouse || "").trim();
            if (!code) { res.status(400).json({ error: "缺少 warehouse" }); return; }
            const icpno = (0, erp_companies_js_1.normIcpno)(req.query.icpno);
            const db = (0, index_js_1.getDb)(dbPath);
            res.json(await stocktake_api_js_1.getStocktakeItems(db, { icpno, whCode: code, minimal: false }));
        } catch (e) { console.error("[liff stocktake items]", e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    // 單張取圖（第四波）：回 JSON { url: data URI }。<img> 無法帶 Authorization header，
    // 故前端用 fetch（帶 Bearer）取回 data URI 後再填進縮圖／燈箱；沿用 stkAuth（LIFF token）。
    router.get("/api/stocktake/photo/:erpCode", async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const code = String(req.params.erpCode || "").trim();
            if (!code) { res.status(400).json({ error: "缺少料號" }); return; }
            const db = (0, index_js_1.getDb)(dbPath);
            const row = await db.prepare("SELECT photo_url FROM erp_stock_item_photo WHERE erp_code = ?").get(code);
            if (!row || !row.photo_url) { res.status(404).json({ error: "無照片" }); return; }
            res.json({ url: String(row.photo_url) });
        } catch (e) { console.error("[liff stocktake photo]", e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.post("/api/stocktake/submit", express_1.json({ limit: "2mb" }), async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const body = req.body || {};
            const code = String(body.warehouse || "").trim();
            const counts = Array.isArray(body.counts) ? body.counts : null;
            if (!code || !counts) { res.status(400).json({ error: "缺少 warehouse 或 counts" }); return; }
            const icpno = (0, erp_companies_js_1.normIcpno)(body.icpno);
            const db = (0, index_js_1.getDb)(dbPath);
            const out = await stocktake_api_js_1.submitStocktake(db, {
                icpno, whCode: code, date: body.date, counts,
                createdBy: v.sub || "",
                createdByName: String(body.name || v.name || "").trim(),
                baseSubmittedAt: body.baseSubmittedAt,
            });
            res.json(out);
        } catch (e) {
            if (e && e.name === "StkApiError") {
                res.status(e.httpStatus).json({ error: e.message, ...(e.code ? { code: e.code } : {}) });
                return;
            }
            console.error("[liff stocktake submit]", e);
            res.status(500).json({ error: String(e?.message || e).slice(0, 200) });
        }
    });

    // ── 掃碼盤點 LIFF 頁（手機當 PDA）＋條碼 API ─────────────────────────
    // 預設松揚（icpno=02，冷凍貨/雜貨），頁面可用 ?icpno= 切公司。
    // 條碼從零建置：掃到未知條碼 → 搜品名綁定（product_barcode），第一輪盤點＝條碼建檔。
    const SCAN_LIFF_ID = (process.env.LIFF_ID_SCAN || process.env.LIFF_ID_STOCKTAKE || "2010106501-VocNwkbA").trim();
    router.get("/scan", (_req, res) => { serveLiffPage(res, "scan.html", SCAN_LIFF_ID); });
    // 本地 vendor（zxing 掃碼 fallback）：iPhone 的 LINE 瀏覽器沒有 BarcodeDetector，改用這顆純 JS 解碼
    router.get("/vendor/zxing.min.js", (_req, res) => {
        try {
            const buf = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, "vendor", "zxing.min.js"));
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.type("application/javascript").send(buf);
        } catch (_) { res.status(404).type("text/plain").send("vendor 檔缺失：zxing.min.js"); }
    });
    // 整家公司的條碼對照一次載入 → 掃描時本機即時比對，不用每掃打一次 API
    router.get("/api/scan/barcodes", async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const icpno = (0, erp_companies_js_1.normIcpno)(req.query.icpno);
            const db = (0, index_js_1.getDb)(dbPath);
            const rows = await db.prepare("SELECT barcode, erp_code, qty_per_scan FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icpno);
            const map = {};
            for (const r of rows || []) map[String(r.barcode)] = { c: String(r.erp_code || ""), q: Number(r.qty_per_scan || 1) || 1 };
            res.json({ icpno, count: (rows || []).length, map });
        } catch (e) { console.error("[liff scan barcodes]", e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    // 綁定條碼時搜品項（該公司全品項，不限倉別）
    router.get("/api/scan/search", async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const icpno = (0, erp_companies_js_1.normIcpno)(req.query.icpno);
            const q = String(req.query.q || "").trim();
            if (!q) { res.json({ items: [] }); return; }
            const db = (0, index_js_1.getDb)(dbPath);
            const like = "%" + q.replace(/[%_]/g, "") + "%";
            const rows = await db.prepare("SELECT erp_code, name, spec, unit, qty, wh_code FROM erp_stock_items WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND (erp_code LIKE ? OR name LIKE ? OR spec LIKE ?) ORDER BY erp_code LIMIT 30").all(icpno, like, like, like);
            res.json({ items: (rows || []).map((r) => ({ c: String(r.erp_code || ""), n: String(r.name || ""), s: String(r.spec || ""), u: String(r.unit || ""), sys: Number(r.qty || 0), w: String(r.wh_code || "") })) });
        } catch (e) { console.error("[liff scan search]", e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    // 綁定（或更新）條碼 → 品項；qty_per_scan=掃一下代表幾個單位（箱碼>1）
    router.post("/api/scan/bind", express_1.json({ limit: "16kb" }), async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const body = req.body || {};
            const icpno = (0, erp_companies_js_1.normIcpno)(body.icpno);
            const barcode = String(body.barcode || "").trim();
            const erpCode = String(body.erp_code || "").trim();
            let qps = Number(body.qty_per_scan);
            if (!Number.isFinite(qps) || qps <= 0) qps = 1;
            if (!barcode || !erpCode) { res.status(400).json({ error: "缺少 barcode 或 erp_code" }); return; }
            if (barcode.length > 64) { res.status(400).json({ error: "條碼過長" }); return; }
            const db = (0, index_js_1.getDb)(dbPath);
            const item = await db.prepare("SELECT erp_code, name, spec, unit, qty FROM erp_stock_items WHERE erp_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").get(erpCode, icpno);
            if (!item) { res.status(404).json({ error: "查無此品項（料號 " + erpCode + "）" }); return; }
            const now = new Date().toISOString();
            // [fix 2026-07-17] 原「先刪後插」非原子：兩支手機同時綁同一條碼會撞 PK 直接 500，
            // DELETE 與 INSERT 之間崩潰則舊綁定遺失。改 ON CONFLICT upsert（sqlite/pg 皆支援）；
            // 仍先清「正規化後同鍵、但 icpno 寫法不同」的殘留舊列，避免同條碼雙綁。
            await db.prepare("DELETE FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND barcode = ? AND icpno <> ?").run(icpno, barcode, icpno);
            await db.prepare("INSERT INTO product_barcode (icpno, barcode, erp_code, qty_per_scan, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (icpno, barcode) DO UPDATE SET erp_code = EXCLUDED.erp_code, qty_per_scan = EXCLUDED.qty_per_scan, created_by = EXCLUDED.created_by, created_by_name = EXCLUDED.created_by_name, updated_at = EXCLUDED.updated_at")
                .run(icpno, barcode, erpCode, qps, v.sub || "", String(v.name || "").trim(), now, now);
            res.json({ ok: true, item: { c: String(item.erp_code), n: String(item.name || ""), s: String(item.spec || ""), u: String(item.unit || ""), sys: Number(item.qty || 0), q: qps } });
        } catch (e) { console.error("[liff scan bind]", e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });

    // 查綁定 token 對應的員工帳號（不直接執行綁定，只用來在頁面顯示要綁誰）
    router.get("/api/employee-bind/lookup", async (req, res) => {
        try {
            const token = String(req.query?.t || "").trim();
            if (!token) {
                res.json({ ok: false, error: "missing token" });
                return;
            }
            const db = (0, index_js_1.getDb)(dbPath);
            const p = await (0, liff_bind_token_js_1.lookupLiffBindToken)(db, token);
            if (!p) {
                res.json({ ok: false, error: "連結已過期或無效" });
                return;
            }
            res.json({ ok: true, username: p.username, expiresAt: p.expiresAt });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // 驗證 ID Token + 一次性 token，完成綁定
    router.post("/api/employee-bind/verify", express_1.json({ limit: "8kb" }), async (req, res) => {
        try {
            const { idToken, token, displayName } = req.body || {};
            if (!idToken || !token) {
                res.status(400).json({ ok: false, error: "missing idToken or token" });
                return;
            }
            const verified = await (0, liff_verify_js_1.verifyLineIdToken)(idToken);
            if (!verified.ok) {
                res.status(401).json({ ok: false, error: verified.error || "ID Token 驗證失敗" });
                return;
            }
            const lineUserId = verified.sub;
            const db = (0, index_js_1.getDb)(dbPath);
            // [fix 2026-07-14] 先綁定成功才銷毀一次性 token：舊順序（先 consume 再 bind）在
            // bind 失敗（DB 瞬斷等）時 token 已被燒掉，員工重按也救不回，得重新產生連結。
            const p = await (0, liff_bind_token_js_1.lookupLiffBindToken)(db, token);
            if (!p) {
                res.status(410).json({ ok: false, error: "連結已過期或已被使用" });
                return;
            }
            const username = String(p.username || "").trim();
            if (!username) {
                res.status(400).json({ ok: false, error: "綁定資料異常（缺 username）" });
                return;
            }
            await (0, employee_line_binding_js_1.bindLineUserIdToEmployee)(db, username, lineUserId, displayName || verified.name || null);
            await (0, liff_bind_token_js_1.consumeLiffBindToken)(db, token);
            try {
                await (0, line_bot_control_js_1.appendLineBotLog)(db, "employee_bound_liff", {
                    username,
                    lineUserId: lineUserId.slice(0, 8) + "…",
                    displayName: displayName || verified.name || null,
                });
            } catch (_) { /* ignore */ }
            res.json({ ok: true, username });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // ===== 訂單審核 LIFF API =====
    // 寫入 data_change_log（無 admin session，僅記錄是哪個員工從 LIFF 操作）
    async function logFromLiff(db, employee, opts) {
        try {
            const id_js = require("../lib/id.js");
            const logId = id_js.newId("dcl");
            const actor = `liff:${employee.username}`;
            const metaJson = opts.meta != null ? JSON.stringify(opts.meta) : null;
            const isPg = Boolean(process.env.DATABASE_URL);
            const tsSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
            await db
                .prepare(`INSERT INTO data_change_log (id, entity_type, entity_id, product_id, action, summary, meta_json, actor_username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${tsSql})`)
                .run(logId, opts.entityType, opts.entityId, opts.productId ?? null, opts.action, opts.summary ?? null, metaJson, actor);
        } catch (e) {
            console.warn("[liff] data_change_log insert failed:", e?.message || e);
        }
    }

    // GET /liff/api/order-review/list?date=YYYY-MM-DD&only_pending=1
    router.get("/api/order-review/list", async (req, res) => {
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            const auth = await (0, liff_auth_js_1.authenticateLiffEmployee)(db, req, { roles: ORDER_REVIEW_ROLES });
            if (!auth.ok) {
                res.status(auth.status || 401).json({ ok: false, error: auth.error });
                return;
            }
            const date = String(req.query?.date || "").trim();
            const onlyPending = String(req.query?.only_pending || "1") === "1";
            const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
            const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
            const statusFilter = onlyPending
                ? "AND COALESCE(LOWER(TRIM(o.status)), '') NOT IN ('approved','deleted')"
                : "AND COALESCE(LOWER(TRIM(o.status)), '') <> 'deleted'";
            // DB-agnostic：訂單清單 + 各自的 count，items_preview 改用第二個 query 後在 JS 聚合
            // LEFT JOIN customers：即便 customer 缺漏也回傳訂單，後續以 customer_id 作 fallback 顯示
            const rows = await db.prepare(`
                SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id, o.updated_at,
                       c.name AS customer_name,
                       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.voided_at IS NULL) AS item_count,
                       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1 AND oi.voided_at IS NULL) AS need_review_count
                FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
                WHERE o.order_date = ? ${statusFilter}
                ORDER BY o.updated_at DESC, o.id DESC
                LIMIT 100
            `).all(d);
            const orders = rows || [];
            // items_preview：拿出 order_id IN (...) 全部品項名稱，JS 內每單取前 4 個用「、」串
            const previewByOrder = new Map();
            if (orders.length) {
                const ids = orders.map(o => o.id);
                const ph = ids.map(() => "?").join(",");
                const itemRows = await db.prepare(`
                    SELECT oi.order_id, COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '—') AS name
                    FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
                    WHERE oi.order_id IN (${ph}) AND oi.voided_at IS NULL ORDER BY oi.order_id, oi.id
                `).all(...ids);
                for (const r of itemRows || []) {
                    const arr = previewByOrder.get(r.order_id) || [];
                    if (arr.length < 4) arr.push(r.name);
                    previewByOrder.set(r.order_id, arr);
                }
            }
            res.json({
                ok: true,
                date: d,
                employee: { username: auth.employee.username, name: auth.employee.name, title: auth.employee.title },
                orders: orders.map(o => {
                    const rawName = (o.customer_name || "").trim();
                    const fallback = o.customer_id ? `客戶 ${String(o.customer_id).slice(0,6)}` : "（未指定客戶）";
                    return {
                        id: o.id,
                        order_no: o.order_no,
                        order_date: o.order_date,
                        status: o.status,
                        customer_id: o.customer_id,
                        customer_name: rawName || fallback,
                        has_customer_name: rawName !== "",
                        updated_at: o.updated_at,
                        item_count: Number(o.item_count) || 0,
                        need_review_count: Number(o.need_review_count) || 0,
                        items_preview: (previewByOrder.get(o.id) || []).join("、"),
                    };
                }),
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // GET /liff/api/order-review/detail?id=...
    router.get("/api/order-review/detail", async (req, res) => {
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            const auth = await (0, liff_auth_js_1.authenticateLiffEmployee)(db, req, { roles: ORDER_REVIEW_ROLES });
            if (!auth.ok) {
                res.status(auth.status || 401).json({ ok: false, error: auth.error });
                return;
            }
            const orderId = String(req.query?.id || "").trim();
            if (!orderId) {
                res.status(400).json({ ok: false, error: "missing id" });
                return;
            }
            const o = await db.prepare(`
                SELECT o.id, o.order_no, o.order_date, o.status, o.updated_at, o.customer_id, c.name AS customer_name,
                       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1 AND oi.voided_at IS NULL) AS need_review_count
                FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
            `).get(orderId);
            if (!o) {
                res.status(404).json({ ok: false, error: "訂單不存在" });
                return;
            }
            const items = await db.prepare(`
                SELECT oi.id, COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '—') AS name,
                       oi.quantity, oi.unit, oi.need_review
                FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = ? AND oi.voided_at IS NULL ORDER BY oi.id
            `).all(orderId);
            const rawName = (o.customer_name || "").trim();
            const fallback = o.customer_id ? `客戶 ${String(o.customer_id).slice(0,6)}` : "（未指定客戶）";
            res.json({
                ok: true,
                order: {
                    id: o.id,
                    order_no: o.order_no,
                    order_date: o.order_date,
                    status: o.status,
                    updated_at: o.updated_at,
                    customer_id: o.customer_id,
                    customer_name: rawName || fallback,
                    has_customer_name: rawName !== "",
                    need_review_count: Number(o.need_review_count) || 0,
                    items: (items || []).map(it => ({
                        id: it.id,
                        name: it.name,
                        quantity: it.quantity,
                        unit: it.unit,
                        need_review: !!it.need_review,
                    })),
                },
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // POST /liff/api/order-review/approve  body: { orderId }
    router.post("/api/order-review/approve", express_1.json({ limit: "8kb" }), async (req, res) => {
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            const auth = await (0, liff_auth_js_1.authenticateLiffEmployee)(db, req, { roles: ORDER_REVIEW_ROLES });
            if (!auth.ok) {
                res.status(auth.status || 401).json({ ok: false, error: auth.error });
                return;
            }
            const orderId = String(req.body?.orderId || "").trim();
            if (!orderId) { res.status(400).json({ ok:false, error:"missing orderId" }); return; }
            const order = await db.prepare("SELECT id, order_no, status FROM orders WHERE id = ?").get(orderId);
            if (!order) { res.status(404).json({ ok:false, error:"訂單不存在" }); return; }
            if ((order.status||"").toLowerCase() === "approved") {
                res.json({ ok: true, alreadyApproved: true });
                return;
            }
            await db.prepare("UPDATE orders SET status = ? WHERE id = ?").run("approved", orderId);
            await logFromLiff(db, auth.employee, {
                entityType: "order",
                entityId: orderId,
                action: "approve",
                summary: `[LIFF] ${auth.employee.name || auth.employee.username} 確認訂單 ${order.order_no || orderId}（前狀態：${order.status || "－"}）`,
                meta: { before: order, source: "liff:order-review" },
            });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // POST /liff/api/order-review/set-date  body: { orderId, orderDate (YYYY-MM-DD) }
    router.post("/api/order-review/set-date", express_1.json({ limit: "8kb" }), async (req, res) => {
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            const auth = await (0, liff_auth_js_1.authenticateLiffEmployee)(db, req, { roles: ORDER_REVIEW_ROLES });
            if (!auth.ok) {
                res.status(auth.status || 401).json({ ok: false, error: auth.error });
                return;
            }
            const orderId = String(req.body?.orderId || "").trim();
            const newDate = String(req.body?.orderDate || "").trim();
            if (!orderId) { res.status(400).json({ ok:false, error:"missing orderId" }); return; }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { res.status(400).json({ ok:false, error:"orderDate 格式需為 YYYY-MM-DD" }); return; }
            const order = await db.prepare("SELECT id, order_no, order_date, status FROM orders WHERE id = ?").get(orderId);
            if (!order) { res.status(404).json({ ok:false, error:"訂單不存在" }); return; }
            if (order.order_date === newDate) { res.json({ ok: true, unchanged: true }); return; }
            await db.prepare("UPDATE orders SET order_date = ? WHERE id = ?").run(newDate, orderId);
            await logFromLiff(db, auth.employee, {
                entityType: "order",
                entityId: orderId,
                action: "edit_order_date",
                summary: `[LIFF] ${auth.employee.name || auth.employee.username} 修改訂單 ${order.order_no || orderId} 出貨日期：${order.order_date || "—"} → ${newDate}`,
                meta: { before: { order_date: order.order_date }, after: { order_date: newDate }, source: "liff:order-review" },
            });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // ===== 冷凍冷藏溫度記錄 LIFF API =====
    // GET /liff/api/freezer-temp/load?date=YYYY-MM-DD
    router.get("/api/freezer-temp/load", async (req, res) => {
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            const auth = await (0, liff_auth_js_1.authenticateLiffEmployee)(db, req);
            if (!auth.ok) { res.status(auth.status || 401).json({ ok: false, error: auth.error }); return; }
            const date = String(req.query?.date || "").trim();
            const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
            const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayIso;
            const warehouses = await db.prepare(
                "SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name"
            ).all();
            const row = await db.prepare("SELECT entries_json, filler_name, confirmed_at, anomaly FROM freezer_fridge_daily WHERE date = ?").get(d);
            let entries = [];
            if (row?.entries_json) {
                try { entries = typeof row.entries_json === "string" ? JSON.parse(row.entries_json) : (row.entries_json || []); } catch (_) { entries = []; }
            }
            res.json({
                ok: true, date: d,
                warehouses: (warehouses || []).map(w => ({ id: w.id, name: w.name, compliant_temp: w.compliant_temp })),
                entries: Array.isArray(entries) ? entries : [],
                filler_name: row?.filler_name || "",
                confirmed_at: row?.confirmed_at || null,
                anomaly: row?.anomaly === 1 || row?.anomaly === true,
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });
    // POST /liff/api/freezer-temp/save  body: { date, fillerName, entries: [{warehouseId, temp, powerOk, lightOff, heatOk}] }
    router.post("/api/freezer-temp/save", express_1.json({ limit: "32kb" }), async (req, res) => {
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            const auth = await (0, liff_auth_js_1.authenticateLiffEmployee)(db, req);
            if (!auth.ok) { res.status(auth.status || 401).json({ ok: false, error: auth.error }); return; }
            const date = String(req.body?.date || "").trim();
            const fillerName = String(req.body?.fillerName || auth.employee.name || auth.employee.username || "").trim();
            const entriesInput = Array.isArray(req.body?.entries) ? req.body.entries : [];
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ ok: false, error: "date 格式錯誤" }); return; }
            if (!fillerName) { res.status(400).json({ ok: false, error: "請填寫填表人" }); return; }
            // 計算 anomaly：任一條目 powerOk=false / heatOk=false / lightOff=false 或溫度超標
            const warehouses = await db.prepare("SELECT id, compliant_temp FROM freezer_fridge_warehouses").all();
            const compliantMap = new Map((warehouses || []).map(w => [w.id, w.compliant_temp || ""]));
            let anomaly = false;
            const normalized = entriesInput.map(e => {
                const wId = String(e?.warehouseId || "").trim();
                const temp = String(e?.temp || "").trim();
                const powerOk = e?.powerOk !== false;
                const lightOff = e?.lightOff !== false;
                const heatOk = e?.heatOk !== false;
                if (!powerOk || !lightOff || !heatOk) anomaly = true;
                const stdStr = String(compliantMap.get(wId) || "");
                const stdN = parseFloat((stdStr.match(/-?\d+(\.\d+)?/) || [])[0] || "");
                const curN = parseFloat(temp);
                if (Number.isFinite(stdN) && Number.isFinite(curN) && (curN - stdN) > 5) anomaly = true;
                return { warehouseId: wId, temp, powerOk, lightOff, heatOk };
            });
            const entriesJson = JSON.stringify(normalized);
            const isPg = Boolean(process.env.DATABASE_URL);
            const nowSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
            // upsert (PG: ON CONFLICT; SQLite: INSERT OR REPLACE)
            if (isPg) {
                await db.prepare(
                    "INSERT INTO freezer_fridge_daily (date, entries_json, filler_name, confirmed_at, anomaly) VALUES (?, ?, ?, " + nowSql + ", ?) " +
                    "ON CONFLICT (date) DO UPDATE SET entries_json = EXCLUDED.entries_json, filler_name = EXCLUDED.filler_name, confirmed_at = EXCLUDED.confirmed_at, anomaly = EXCLUDED.anomaly"
                ).run(date, entriesJson, fillerName, anomaly ? 1 : 0);
            } else {
                await db.prepare("INSERT OR REPLACE INTO freezer_fridge_daily (date, entries_json, filler_name, confirmed_at, anomaly) VALUES (?, ?, ?, " + nowSql + ", ?)").run(date, entriesJson, fillerName, anomaly ? 1 : 0);
            }
            res.json({ ok: true, anomaly });
        } catch (e) {
            console.error("[liff freezer-temp save]", e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // ===== 客戶速查 LIFF API =====
    const customer_scoring_js_1 = require("../lib/customer-scoring.js");
    const customer_profile_js_1 = require("../lib/customer-profile.js");
    // GET /liff/api/customer-lookup/search?q=...
    router.get("/api/customer-lookup/search", async (req, res) => {
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            const auth = await (0, liff_auth_js_1.authenticateLiffEmployee)(db, req);
            if (!auth.ok) { res.status(auth.status || 401).json({ ok: false, error: auth.error }); return; }
            const q = String(req.query?.q || "").trim();
            if (!q) { res.json({ ok: true, customers: [] }); return; }
            const like = "%" + q.replace(/[%_]/g, "\\$&") + "%";
            const rows = await db.prepare(
                "SELECT id, name FROM customers WHERE (active = 1 OR active IS NULL) AND (name LIKE ? OR teraoka_code LIKE ? OR hq_cust_code LIKE ?) ORDER BY name LIMIT 30"
            ).all(like, like, like);
            const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
            const results = [];
            for (const c of rows || []) {
                const inputs = await (0, customer_scoring_js_1.fetchCustomerScoringInputs)(db, c.id, todayIso);
                const { score } = (0, customer_scoring_js_1.computeCustomerScore)(inputs || {});
                const tier = (0, customer_scoring_js_1.scoreToTier)(score);
                results.push({ id: c.id, name: c.name, score, tier });
            }
            res.json({ ok: true, customers: results });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });
    // GET /liff/api/customer-lookup/detail?id=...
    router.get("/api/customer-lookup/detail", async (req, res) => {
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            const auth = await (0, liff_auth_js_1.authenticateLiffEmployee)(db, req);
            if (!auth.ok) { res.status(auth.status || 401).json({ ok: false, error: auth.error }); return; }
            const id = String(req.query?.id || "").trim();
            if (!id) { res.status(400).json({ ok: false, error: "missing id" }); return; }
            const customer = await db.prepare("SELECT id, name, line_group_id, contact, crm_handover_notes FROM customers WHERE id = ?").get(id);
            if (!customer) { res.status(404).json({ ok: false, error: "找不到客戶" }); return; }
            const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
            const inputs = await (0, customer_scoring_js_1.fetchCustomerScoringInputs)(db, id, todayIso);
            const { score } = (0, customer_scoring_js_1.computeCustomerScore)(inputs || {});
            const tier = (0, customer_scoring_js_1.scoreToTier)(score);
            let profile = null;
            try { profile = await (0, customer_profile_js_1.computeCustomerProfile)(db, id); } catch (_) {}
            // 最近客訴
            const recentComplaints = await db.prepare(
                "SELECT o.id, o.order_date, o.raw_message, COALESCE(ch.handle_status, 'pending') AS handle_status " +
                "FROM orders o LEFT JOIN complaint_handling ch ON ch.order_id = o.id " +
                "WHERE o.customer_id = ? AND LOWER(TRIM(COALESCE(o.status,''))) = 'complaint' " +
                "ORDER BY o.order_date DESC LIMIT 5"
            ).all(id);
            res.json({
                ok: true,
                customer,
                score, tier,
                orders90: inputs?.orders90 ?? 0,
                ordersAll: inputs?.ordersAll ?? 0,
                daysSinceLastOrder: inputs?.daysSinceLastOrder ?? null,
                avgIntervalDays: inputs?.avgIntervalDays ?? null,
                lastOrderDate: inputs?.lastOrderDate ?? null,
                complaintsTotal: inputs?.complaintsAll ?? 0,
                openComplaints: inputs?.complaintsOpen ?? 0,
                topItems: profile?.topItems || [],
                topWeekdays: profile?.topWeekdays || [],
                recentComplaints,
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // ===== 空籃記帳 LIFF API =====
    // [fix 2026-07-10] 授權缺口修補：save/load/lookup-by-group 過去只驗 idToken 有效，
    // 任何 LINE 使用者可讀寫任意客戶空籃帳。現一律：
    //   (a) 綁定員工（admin_users 的 LINE 綁定，findEmployeeByLineUserId）→ 放行；
    //   (b) 否則須為「該客戶綁定群組」的成員（LINE API GET /v2/bot/group/{gid}/member/{uid}，
    //       200 放行、404 → 403；查詢結果 in-memory 快取 10 分鐘）。
    //   LINE API 逾時（5 秒 AbortController）或非 404 失敗 → 一律 503 拒絕（寧可暫時擋住也不放行）。
    const BK_MEMBER_TTL_MS = 10 * 60 * 1000;
    const bkMemberCache = new Map(); // key = userId + "|" + groupId → { ok, exp }
    async function bkIsGroupMember(userId, groupId) {
        const key = userId + "|" + groupId;
        const nowMs = Date.now();
        const hit = bkMemberCache.get(key);
        if (hit && hit.exp > nowMs) return hit.ok ? { ok: true } : { ok: false, status: 403 };
        // 簡單防爆量：過大時先清掉過期項
        if (bkMemberCache.size > 5000) {
            for (const [k, val] of bkMemberCache) { if (val.exp <= nowMs) bkMemberCache.delete(k); }
        }
        const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
        if (!token) return { ok: false, status: 503, error: "驗證暫時無法完成，請稍後再試" };
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        let resp;
        try {
            resp = await fetch(`https://api.line.me/v2/bot/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(userId)}`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: ctrl.signal,
            });
        } catch (e) {
            clearTimeout(timer);
            console.warn("[liff basket-log] LINE 群組成員查詢失敗:", e?.message || e);
            return { ok: false, status: 503, error: "驗證暫時無法完成，請稍後再試" };
        }
        clearTimeout(timer);
        if (resp.status === 200) { bkMemberCache.set(key, { ok: true, exp: nowMs + BK_MEMBER_TTL_MS }); return { ok: true }; }
        if (resp.status === 404) {
            // 404＝非成員「或 groupId 本身不存在」（例如 DB 存的 line_group_id 大小寫/空白有誤）；
            // log 帶上查詢用的 gid 方便排查是哪種情況
            console.warn("[liff basket-log] LINE 群組成員查詢 404（非成員或群組ID無效）: gid=" + groupId);
            bkMemberCache.set(key, { ok: false, exp: nowMs + BK_MEMBER_TTL_MS });
            return { ok: false, status: 403 };
        }
        console.warn("[liff basket-log] LINE 群組成員查詢非預期狀態:", resp.status, "gid=" + groupId);
        return { ok: false, status: 503, error: "驗證暫時無法完成，請稍後再試" };
    }
    // 群組 ID 正規化（去空白＋小寫），與 webhook / lookup-by-group 的比對方式一致
    function bkNormGid(s) { return (s || "").replace(/\s/g, "").toLowerCase(); }
    /**
     * 挑選要拿去打 LINE API 的群組 ID：
     * [fix 2026-07-10] DB 存的 line_group_id 若大小寫/空白與真實群組 ID 不符，直接拿去查
     * 成員會 404 → 誤判 403（且快取 10 分鐘）。若前端帶了 LIFF context 的真實 groupId
     * 且正規化後與 DB 存值相同 → 改用真實 ID 呼叫；否則 fallback 用 DB 存值
     * （相容外部瀏覽器開啟、無 LIFF context 的情況）。
     */
    function bkPickGroupId(storedGid, ctxGid) {
        const ctx = String(ctxGid || "").trim();
        if (ctx && bkNormGid(ctx) === bkNormGid(storedGid)) return ctx;
        return storedGid;
    }
    /** 空籃記帳授權：員工放行；否則須為 groupId 群組成員。回 { ok } 或 { ok:false, status, error }。 */
    async function bkAuthorize(db, verified, groupId) {
        try {
            const emp = await (0, employee_line_binding_js_1.findEmployeeByLineUserId)(db, verified.sub);
            if (emp) return { ok: true, via: "employee" };
        } catch (e) {
            console.warn("[liff basket-log] 員工綁定查詢失敗（續走群組成員檢查）:", e?.message || e);
        }
        const gid = String(groupId || "").trim();
        if (!gid) return { ok: false, status: 403, error: "無權限：僅員工或該客戶綁定群組的成員可操作" };
        const r = await bkIsGroupMember(verified.sub, gid);
        if (r.ok) return { ok: true, via: "group" };
        return { ok: false, status: r.status || 403, error: r.error || "無權限：僅員工或該客戶綁定群組的成員可操作" };
    }
    // GET /liff/api/basket-log/lookup-by-group?groupId=（idToken 改走 Authorization: Bearer header）
    // （給 Rich Menu 等不帶 customer 參數的進入路徑用：用群組 ID 反查 customer）
    router.get("/api/basket-log/lookup-by-group", async (req, res) => {
        try {
            const idToken = (0, liff_auth_js_1.readBearerIdToken)(req);
            const groupId = String(req.query?.groupId || "").trim();
            if (!idToken || !groupId) {
                res.status(400).json({ ok: false, error: "missing params" });
                return;
            }
            const verified = await (0, liff_verify_js_1.verifyLineIdToken)(idToken);
            if (!verified.ok) {
                res.status(401).json({ ok: false, error: verified.error || "ID Token 驗證失敗" });
                return;
            }
            const db = (0, index_js_1.getDb)(dbPath);
            // 授權：requester 須為該群組成員或綁定員工
            const authz = await bkAuthorize(db, verified, groupId);
            if (!authz.ok) {
                res.status(authz.status || 403).json({ ok: false, error: authz.error });
                return;
            }
            // 大小寫不敏感比對（跟 webhook 一致；沿用共用的 bkNormGid）
            const all = await db.prepare("SELECT id, name, line_group_id FROM customers WHERE (active IS NULL OR active = 1)").all();
            const needle = bkNormGid(groupId);
            const found = (all || []).find(r => bkNormGid(r.line_group_id) === needle);
            if (!found) {
                res.status(404).json({ ok: false, error: "此群組尚未綁定客戶" });
                return;
            }
            res.json({ ok: true, customerId: found.id, customerName: found.name });
        } catch (e) {
            console.error("[liff basket-log lookup-by-group]", e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // GET /liff/api/basket-log/load?customer=&date=（idToken 改走 Authorization: Bearer header）
    router.get("/api/basket-log/load", async (req, res) => {
        try {
            const idToken = (0, liff_auth_js_1.readBearerIdToken)(req);
            const customerId = String(req.query?.customer || "").trim();
            const date = String(req.query?.date || "").trim();
            if (!idToken || !customerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                res.status(400).json({ ok: false, error: "missing or invalid params" });
                return;
            }
            const verified = await (0, liff_verify_js_1.verifyLineIdToken)(idToken);
            if (!verified.ok) {
                res.status(401).json({ ok: false, error: verified.error || "ID Token 驗證失敗" });
                return;
            }
            const db = (0, index_js_1.getDb)(dbPath);
            const customer = await db.prepare("SELECT id, name, line_group_id FROM customers WHERE id = ? AND (active IS NULL OR active = 1)").get(customerId);
            if (!customer) {
                res.status(404).json({ ok: false, error: "客戶不存在或已停用" });
                return;
            }
            // 授權：員工或該客戶綁定群組的成員才可讀
            // [fix 2026-07-10] 若前端帶了 LIFF context 的真實 groupId（ctxGroupId）且與 DB 存值
            // 正規化後相同 → 用真實 ID 打 LINE API，避免存值大小寫/空白有誤時 404 → 誤 403
            const authz = await bkAuthorize(db, verified, bkPickGroupId(customer.line_group_id, req.query?.ctxGroupId));
            if (!authz.ok) {
                res.status(authz.status || 403).json({ ok: false, error: authz.error });
                return;
            }
            const lines = await (0, basket_log_js_1.getBasketLinesForDay)(db, customerId, date);
            res.json({
                ok: true,
                customerName: customer.name,
                date,
                lines,
            });
        } catch (e) {
            console.error("[liff basket-log load]", e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // POST /liff/api/basket-log/save  body: { customerId, date, lines: [{kind,no,takenTo,pickedUp}] }
    //（idToken 改走 Authorization: Bearer header）
    router.post("/api/basket-log/save", express_1.json({ limit: "16kb" }), async (req, res) => {
        try {
            const { customerId, date, lines } = req.body || {};
            const idToken = (0, liff_auth_js_1.readBearerIdToken)(req);
            if (!idToken || !customerId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
                res.status(400).json({ ok: false, error: "missing or invalid params" });
                return;
            }
            if (!Array.isArray(lines)) {
                res.status(400).json({ ok: false, error: "lines must be an array" });
                return;
            }
            const verified = await (0, liff_verify_js_1.verifyLineIdToken)(idToken);
            if (!verified.ok) {
                res.status(401).json({ ok: false, error: verified.error || "ID Token 驗證失敗" });
                return;
            }
            const db = (0, index_js_1.getDb)(dbPath);
            const customer = await db.prepare("SELECT id, name, line_group_id FROM customers WHERE id = ? AND (active IS NULL OR active = 1)").get(customerId);
            if (!customer) {
                res.status(404).json({ ok: false, error: "客戶不存在或已停用" });
                return;
            }
            // 授權：員工或該客戶綁定群組的成員才可寫
            // [fix 2026-07-10] 同 load：ctxGroupId 與 DB 存值正規化相同時改用真實 ID 打 LINE API
            const authz = await bkAuthorize(db, verified, bkPickGroupId(customer.line_group_id, req.body?.ctxGroupId));
            if (!authz.ok) {
                res.status(authz.status || 403).json({ ok: false, error: authz.error });
                return;
            }
            // [fix 2026-07-14] 樂觀鎖：save 是「整日覆蓋」upsert，兩位司機同開頁時後送者會
            // 蓋掉先送者；舊版唯一防線是「開頁當下 hasExisting」的 confirm，攔不到開頁後才
            // 送出的人。前端帶「載入當下整日內容指紋」，不一致＝開頁後有人送過 → 409 重載。
            const fpOfBk = (rows) => JSON.stringify((rows || [])
                .map((l) => [String(l.basket_kind), Number(l.basket_no || 0), Number(l.taken_to || 0), Number(l.picked_up || 0)])
                .filter((x) => x[2] || x[3])
                .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1])));
            const baseFp = req.body?.baseFp;
            if (typeof baseFp === "string") {
                const curRows = await (0, basket_log_js_1.getBasketLinesForDay)(db, customerId, date);
                if (fpOfBk(curRows) !== baseFp) {
                    res.status(409).json({ ok: false, code: "conflict_stale", error: "開頁後已有其他人送出當日紀錄，請關閉重開此頁確認最新數字後再送出" });
                    return;
                }
            }
            // 寫入
            await (0, basket_log_js_1.upsertBasketLogLines)(db, {
                customerId,
                logDate: date,
                lines,
                lineGroupId: customer.line_group_id || null,
                reporterUserId: verified.sub,
                reporterDisplayName: verified.name || null,
                actor: "liff:basket-log",
                rawMessage: null,
            });
            // 取本月合計 + 今日 lines 用於回傳訊息
            const ym = String(date).slice(0, 7);
            const monthAgg = await (0, basket_log_js_1.getMonthAggregates)(db, customerId, ym);
            const todayLinesRaw = await (0, basket_log_js_1.getBasketLinesForDay)(db, customerId, date);
            const todayLines = (todayLinesRaw || []).map((l) => ({
                kind: l.basket_kind,
                no: l.basket_no,
                takenTo: Number(l.taken_to || 0),
                pickedUp: Number(l.picked_up || 0),
            }));
            const message = (0, basket_log_js_1.formatLiffRecordMessage)({
                customerName: customer.name,
                date,
                todayLines,
                monthAgg,
            });
            res.json({ ok: true, message, monthAgg, fp: fpOfBk(todayLinesRaw) });
        } catch (e) {
            console.error("[liff basket-log save]", e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // POST /liff/api/order-review/unapprove  body: { orderId }
    router.post("/api/order-review/unapprove", express_1.json({ limit: "8kb" }), async (req, res) => {
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            const auth = await (0, liff_auth_js_1.authenticateLiffEmployee)(db, req, { roles: ORDER_REVIEW_ROLES });
            if (!auth.ok) {
                res.status(auth.status || 401).json({ ok: false, error: auth.error });
                return;
            }
            const orderId = String(req.body?.orderId || "").trim();
            if (!orderId) { res.status(400).json({ ok:false, error:"missing orderId" }); return; }
            const order = await db.prepare("SELECT id, order_no, status FROM orders WHERE id = ?").get(orderId);
            if (!order) { res.status(404).json({ ok:false, error:"訂單不存在" }); return; }
            await db.prepare("UPDATE orders SET status = ? WHERE id = ?").run("pending", orderId);
            await logFromLiff(db, auth.employee, {
                entityType: "order",
                entityId: orderId,
                action: "unapprove",
                summary: `[LIFF] ${auth.employee.name || auth.employee.username} 取消確認訂單 ${order.order_no || orderId}（前狀態：${order.status || "－"}）`,
                meta: { before: order, source: "liff:order-review" },
            });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    return router;
}
