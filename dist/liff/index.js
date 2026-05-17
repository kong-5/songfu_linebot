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
            const rows = await db.prepare(`
                SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id,
                       c.name AS customer_name,
                       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1) AS need_review_count,
                       (SELECT GROUP_CONCAT(COALESCE(NULLIF(TRIM(p.name),''), NULLIF(TRIM(oi2.raw_name),''), '—'), '、')
                          FROM (SELECT * FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 4) oi2
                          LEFT JOIN products p ON p.id = oi2.product_id) AS items_preview
                FROM orders o JOIN customers c ON c.id = o.customer_id
                WHERE o.order_date = ? ${statusFilter}
                ORDER BY o.updated_at DESC, o.id DESC
                LIMIT 100
            `).all(d);
            // PG 沒有 GROUP_CONCAT；上面是 SQLite 寫法。若是 PG，重做 items_preview。
            const isPg = Boolean(process.env.DATABASE_URL);
            let orders = rows || [];
            if (isPg) {
                const pgRows = await db.prepare(`
                    SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id,
                           c.name AS customer_name,
                           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1) AS need_review_count,
                           (SELECT string_agg(COALESCE(NULLIF(TRIM(p.name),''), NULLIF(TRIM(oi2.raw_name),''), '—'), '、')
                              FROM (SELECT * FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 4) oi2
                              LEFT JOIN products p ON p.id = oi2.product_id) AS items_preview
                    FROM orders o JOIN customers c ON c.id = o.customer_id
                    WHERE o.order_date = ? ${statusFilter}
                    ORDER BY o.updated_at DESC, o.id DESC
                    LIMIT 100
                `).all(d);
                orders = pgRows || [];
            }
            res.json({
                ok: true,
                date: d,
                employee: { username: auth.employee.username, name: auth.employee.name, title: auth.employee.title },
                orders: orders.map(o => ({
                    id: o.id,
                    order_no: o.order_no,
                    order_date: o.order_date,
                    status: o.status,
                    customer_name: o.customer_name,
                    item_count: Number(o.item_count) || 0,
                    need_review_count: Number(o.need_review_count) || 0,
                    items_preview: o.items_preview || "",
                })),
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
                       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1) AS need_review_count
                FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
            `).get(orderId);
            if (!o) {
                res.status(404).json({ ok: false, error: "訂單不存在" });
                return;
            }
            const items = await db.prepare(`
                SELECT oi.id, COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '—') AS name,
                       oi.quantity, oi.unit, oi.need_review
                FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = ? ORDER BY oi.id
            `).all(orderId);
            res.json({
                ok: true,
                order: {
                    id: o.id,
                    order_no: o.order_no,
                    order_date: o.order_date,
                    status: o.status,
                    updated_at: o.updated_at,
                    customer_name: o.customer_name,
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
