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
    function stkTaipeiDate() {
        try {
            const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
            const g = (t) => (p.find((x) => x.type === t) || {}).value;
            return g("year") + "-" + g("month") + "-" + g("day");
        } catch (_) { return new Date().toISOString().slice(0, 10); }
    }
    async function stkAuth(req, res) {
        const idToken = (0, liff_auth_js_1.readBearerIdToken)(req);
        if (!idToken) { res.status(401).json({ error: "需 LINE 登入" }); return null; }
        const v = await (0, liff_verify_js_1.verifyLineIdToken)(idToken);
        if (!v.ok) { res.status(401).json({ error: v.error || "登入驗證失敗" }); return null; }
        return v;
    }
    router.get("/api/stocktake/warehouses", async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const db = (0, index_js_1.getDb)(dbPath);
            const date = stkTaipeiDate();
            const whRows = await db.prepare("SELECT code, name, include_stocktake, sort_order FROM erp_warehouse").all();
            const cntRows = await db.prepare("SELECT wh_code AS code, COUNT(*) AS cnt FROM erp_stock_items WHERE wh_code IS NOT NULL AND TRIM(wh_code) <> '' GROUP BY wh_code").all();
            const cnt = {}; (cntRows || []).forEach((r) => { cnt[String(r.code)] = Number(r.cnt || 0); });
            const doneRows = await db.prepare("SELECT DISTINCT wh_code FROM stocktake_session WHERE count_date = ? AND status = 'submitted'").all(date);
            const done = {}; (doneRows || []).forEach((r) => { done[String(r.wh_code)] = true; });
            let list;
            if ((whRows || []).length) {
                list = whRows.filter((w) => Number(w.include_stocktake) === 1).map((w) => ({ code: String(w.code), name: String(w.name || ""), sort: Number(w.sort_order || 0), items: cnt[String(w.code)] || 0, countedToday: !!done[String(w.code)] }));
            } else {
                list = Object.keys(cnt).map((code) => ({ code, name: "", sort: 0, items: cnt[code], countedToday: !!done[code] }));
            }
            list.sort((a, b) => (a.sort - b.sort) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
            res.json({ date, warehouses: list });
        } catch (e) { console.error("[liff stocktake warehouses]", e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.get("/api/stocktake/items", async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const code = String(req.query.warehouse || "").trim();
            if (!code) { res.status(400).json({ error: "缺少 warehouse" }); return; }
            const db = (0, index_js_1.getDb)(dbPath);
            const wh = await db.prepare("SELECT code, name FROM erp_warehouse WHERE code = ?").get(code);
            const rows = await db.prepare("SELECT erp_code, name, spec, unit, qty FROM erp_stock_items WHERE wh_code = ? ORDER BY erp_code").all(code);
            const expRows = await db.prepare("SELECT erp_code, expiry_unit FROM stocktake_expiry_item").all();
            const exp = {}; (expRows || []).forEach((r) => { exp[String(r.erp_code)] = String(r.expiry_unit || ""); });
            const items = (rows || []).map((r) => {
                const c = String(r.erp_code || "");
                const isExp = Object.prototype.hasOwnProperty.call(exp, c);
                return { c, n: String(r.name || ""), s: String(r.spec || ""), u: String(r.unit || ""), sys: Number(r.qty || 0), exp: isExp, eunit: isExp ? (exp[c] || String(r.unit || "")) : "" };
            });
            // 續盤：同倉同日若已送出過，帶回已存的實盤數與效期，重開可接著盤
            const date = stkTaipeiDate();
            const saved = {};
            let resumed = false;
            const sess = await db.prepare("SELECT id FROM stocktake_session WHERE wh_code = ? AND count_date = ?").get(code, date);
            if (sess) {
                const cRows = await db.prepare("SELECT erp_code, counted_qty, mid_qty, expiry_json FROM stocktake_count WHERE session_id = ?").all(sess.id);
                for (const r of cRows || []) {
                    let expiry = [];
                    try { expiry = JSON.parse(r.expiry_json || "[]") || []; } catch (_) { expiry = []; }
                    const totalv = (r.counted_qty == null || r.counted_qty === "") ? null : Number(r.counted_qty);
                    const midv = (r.mid_qty == null || r.mid_qty === "") ? null : Number(r.mid_qty);
                    // counted 存的是合計；還原「上貨」= 合計 − 中貨
                    const goodv = totalv == null ? null : Math.round((totalv - (midv || 0)) * 100) / 100;
                    saved[String(r.erp_code || "")] = { counted: goodv, mid: midv, expiry };
                }
                resumed = (cRows || []).length > 0;
            }
            res.json({ date, warehouse: { code, name: wh ? String(wh.name || "") : "" }, items, saved, resumed });
        } catch (e) { console.error("[liff stocktake items]", e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.post("/api/stocktake/submit", express_1.json({ limit: "2mb" }), async (req, res) => {
        try {
            const v = await stkAuth(req, res); if (!v) return;
            const body = req.body || {};
            const code = String(body.warehouse || "").trim();
            const counts = Array.isArray(body.counts) ? body.counts : null;
            if (!code || !counts) { res.status(400).json({ error: "缺少 warehouse 或 counts" }); return; }
            const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? String(body.date) : stkTaipeiDate();
            const db = (0, index_js_1.getDb)(dbPath);
            const { newId } = require("../lib/id.js");
            const wh = await db.prepare("SELECT name FROM erp_warehouse WHERE code = ?").get(code);
            const totalRow = await db.prepare("SELECT COUNT(*) AS n FROM erp_stock_items WHERE wh_code = ?").get(code);
            const total = totalRow ? Number(totalRow.n || 0) : counts.length;
            const now = new Date().toISOString();
            // 同倉同日 → 覆蓋（一天一筆）
            const old = await db.prepare("SELECT id FROM stocktake_session WHERE wh_code = ? AND count_date = ?").all(code, date);
            for (const s of old || []) { await db.prepare("DELETE FROM stocktake_count WHERE session_id = ?").run(s.id); }
            await db.prepare("DELETE FROM stocktake_session WHERE wh_code = ? AND count_date = ?").run(code, date);
            const sid = newId("stk");
            const name = String(body.name || v.name || "").trim();
            await db.prepare("INSERT INTO stocktake_session (id, wh_code, wh_name, count_date, status, group_id, created_by, created_by_name, item_count, counted_count, created_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(sid, code, wh ? String(wh.name || "") : "", date, "submitted", null, v.sub || "", name, total, counts.length, now, now);
            for (const c of counts) {
                // counted=上貨(good)、mid=中貨；counted_qty 存兩者合計，mid_qty 單獨保留供品質標注
                const good = (c.counted == null || c.counted === "") ? null : Number(c.counted);
                const mid = (c.mid == null || c.mid === "") ? null : Number(c.mid);
                const cv = (good == null && mid == null) ? null : ((good || 0) + (mid || 0));
                await db.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, mid_qty, expiry_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                    .run(newId("stc"), sid, String(c.code || ""), String(c.name || ""), String(c.spec || ""), String(c.unit || ""), Number(c.sys || 0), cv, mid, JSON.stringify(c.expiry || []), now);
            }
            res.json({ ok: true, counted: counts.length, total });
        } catch (e) { console.error("[liff stocktake submit]", e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
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
            const p = await (0, liff_bind_token_js_1.consumeLiffBindToken)(db, token);
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
    // GET /liff/api/basket-log/lookup-by-group?groupId=&idToken=
    // （給 Rich Menu 等不帶 customer 參數的進入路徑用：用群組 ID 反查 customer）
    router.get("/api/basket-log/lookup-by-group", async (req, res) => {
        try {
            const idToken = String(req.query?.idToken || "").trim();
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
            // 大小寫不敏感比對（跟 webhook 一致）
            const all = await db.prepare("SELECT id, name, line_group_id FROM customers WHERE (active IS NULL OR active = 1)").all();
            const norm = (s) => (s || "").replace(/\s/g, "").toLowerCase();
            const needle = norm(groupId);
            const found = (all || []).find(r => norm(r.line_group_id) === needle);
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

    // GET /liff/api/basket-log/load?customer=&date=&idToken=
    router.get("/api/basket-log/load", async (req, res) => {
        try {
            const idToken = String(req.query?.idToken || "").trim();
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
            const customer = await db.prepare("SELECT id, name FROM customers WHERE id = ? AND (active IS NULL OR active = 1)").get(customerId);
            if (!customer) {
                res.status(404).json({ ok: false, error: "客戶不存在或已停用" });
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

    // POST /liff/api/basket-log/save  body: { idToken, customerId, date, lines: [{kind,no,takenTo,pickedUp}] }
    router.post("/api/basket-log/save", express_1.json({ limit: "16kb" }), async (req, res) => {
        try {
            const { idToken, customerId, date, lines } = req.body || {};
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
            res.json({ ok: true, message, monthAgg });
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
