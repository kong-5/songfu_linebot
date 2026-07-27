"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerComplaintsRoutes = registerComplaintsRoutes;

// 客訴域（訂單↔客訴互轉、客訴列表·新增·詳情·處理更新、客訴 xlsx 匯出）路由：
// 自 index.js 拆出（拆檔批次 5），純搬移、行為不變。

const express_1 = { default: require("express") };
const XLSX = require("xlsx");
const id_js_1 = require("../lib/id.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerComplaintsRoutes(router, ctx) {
    const { db, notionPage, logDataChange, getTaipeiCalendarDateYYYYMMDD, getNextOrderNoAdmin } = ctx;
    router.post("/orders/:orderId/to-complaint", async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare("SELECT id, order_no, status FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        // [fix 2026-07-08] 作廢單不可直接轉客訴（會把 deleted 單復活進客訴佇列）。
        if (String(order.status || "").toLowerCase().trim() === "deleted") {
            const wantsJson0 = (req.get("x-requested-with") === "XMLHttpRequest") || String(req.get("accept") || "").indexOf("application/json") >= 0;
            if (wantsJson0) { res.status(400).json({ ok: false, error: "此訂單已作廢，請先取消作廢再轉客訴" }); return; }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent("此訂單已作廢，請先取消作廢再轉客訴"));
            return;
        }
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + " WHERE id = ?").run("complaint", orderId);
        const existing = await db.prepare("SELECT order_id FROM complaint_handling WHERE order_id = ?").get(orderId);
        if (!existing) {
            await db.prepare("INSERT INTO complaint_handling (order_id, handle_status, created_at, updated_at) VALUES (?, ?, " + nowSql + ", " + nowSql + ")").run(orderId, "pending");
        }
        await logDataChange(req, {
            entityType: "order",
            entityId: orderId,
            action: "to_complaint",
            summary: `轉為客訴 ${order.order_no || orderId}（前狀態：${order.status || "－"}）`,
            meta: { before: order },
        });
        const wantsJson = (req.get("x-requested-with") === "XMLHttpRequest") || String(req.get("accept") || "").indexOf("application/json") >= 0;
        if (wantsJson) {
            res.json({ ok: true, complaintUrl: "/admin/complaints/" + encodeURIComponent(orderId) });
            return;
        }
        res.redirect("/admin/complaints/" + encodeURIComponent(orderId));
    });
    router.post("/complaints/:orderId/to-order", async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare("SELECT id, order_no, status FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        // [fix 2026-07-14] 狀態機守衛：只有客訴單能「還原為訂單」；其他狀態（尤其 deleted）
        // 不可經此路徑被改成 pending 復活。
        if (String(order.status || "").toLowerCase().trim() !== "complaint") {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent("此訂單不是客訴狀態，無法還原"));
            return;
        }
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + " WHERE id = ?").run("pending", orderId);
        await logDataChange(req, {
            entityType: "order",
            entityId: orderId,
            action: "from_complaint",
            summary: `從客訴還原為訂單 ${order.order_no || orderId}`,
            meta: { before: order },
        });
        res.redirect("/admin/orders/" + encodeURIComponent(orderId));
    });
    router.post("/complaints/:orderId/update", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare("SELECT id, order_no, status FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const handleStatusRaw = String(req.body.handle_status || "pending").trim();
        const handleStatus = ["pending", "handling", "resolved"].includes(handleStatusRaw) ? handleStatusRaw : "pending";
        const handler = String(req.body.handler || "").trim() || null;
        const note = String(req.body.note || "").trim() || null;
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        const existing = await db.prepare("SELECT order_id, handle_status FROM complaint_handling WHERE order_id = ?").get(orderId);
        if (existing) {
            if (handleStatus === "resolved" && existing.handle_status !== "resolved") {
                await db.prepare("UPDATE complaint_handling SET handle_status = ?, handler = ?, note = ?, resolved_at = " + nowSql + ", updated_at = " + nowSql + " WHERE order_id = ?").run(handleStatus, handler, note, orderId);
            }
            else if (handleStatus !== "resolved" && existing.handle_status === "resolved") {
                await db.prepare("UPDATE complaint_handling SET handle_status = ?, handler = ?, note = ?, resolved_at = NULL, updated_at = " + nowSql + " WHERE order_id = ?").run(handleStatus, handler, note, orderId);
            }
            else {
                await db.prepare("UPDATE complaint_handling SET handle_status = ?, handler = ?, note = ?, updated_at = " + nowSql + " WHERE order_id = ?").run(handleStatus, handler, note, orderId);
            }
        }
        else {
            const resolvedSql = handleStatus === "resolved" ? nowSql : "NULL";
            await db.prepare("INSERT INTO complaint_handling (order_id, handle_status, handler, note, resolved_at, created_at, updated_at) VALUES (?, ?, ?, ?, " + resolvedSql + ", " + nowSql + ", " + nowSql + ")").run(orderId, handleStatus, handler, note);
        }
        await logDataChange(req, {
            entityType: "complaint",
            entityId: orderId,
            action: "complaint_update",
            summary: `更新客訴處理 ${order.order_no || orderId}（${handleStatus}）`,
            meta: { handleStatus, handler, note },
        });
        res.redirect("/admin/complaints/" + encodeURIComponent(orderId) + "?ok=updated");
    });
    function complaintsBuildWhere(filterStatus, dateFrom, dateTo) {
        const parts = ["LOWER(TRIM(COALESCE(o.status,''))) = 'complaint'"];
        const params = [];
        if (filterStatus === "pending") parts.push("COALESCE(ch.handle_status, 'pending') = 'pending'");
        else if (filterStatus === "handling") parts.push("ch.handle_status = 'handling'");
        else if (filterStatus === "resolved") parts.push("ch.handle_status = 'resolved'");
        else if (filterStatus === "open") parts.push("COALESCE(ch.handle_status, 'pending') <> 'resolved'");
        if (dateFrom) { parts.push("o.order_date >= ?"); params.push(dateFrom); }
        if (dateTo) { parts.push("o.order_date <= ?"); params.push(dateTo); }
        return { where: parts.join(" AND "), params };
    }
    async function complaintsFetchRows(filterStatus, dateFrom, dateTo, limit) {
        const { where, params } = complaintsBuildWhere(filterStatus, dateFrom, dateTo);
        const sql = "SELECT o.id, o.order_no, o.order_date, o.customer_id, c.name AS customer_name, o.raw_message, o.updated_at, o.line_group_id, " +
            "COALESCE(ch.handle_status, 'pending') AS handle_status, ch.handler, ch.note, ch.resolved_at, ch.created_at AS complaint_created_at, ch.updated_at AS handle_updated_at " +
            "FROM orders o " +
            "JOIN customers c ON c.id = o.customer_id " +
            "LEFT JOIN complaint_handling ch ON ch.order_id = o.id " +
            "WHERE " + where + " " +
            "ORDER BY o.order_date DESC, o.id DESC LIMIT " + Number(limit || 500);
        return db.prepare(sql).all(...params);
    }
    router.get("/complaints", async (req, res) => {
        try {
            const filterRaw = String(req.query.status || "open").toLowerCase();
            const filter = ["open", "all", "pending", "handling", "resolved"].includes(filterRaw) ? filterRaw : "open";
            const dateRe = /^\d{4}-\d{2}-\d{2}$/;
            const dateFromRaw = String(req.query.date_from || "").trim();
            const dateToRaw = String(req.query.date_to || "").trim();
            const dateFrom = dateRe.test(dateFromRaw) ? dateFromRaw : "";
            const dateTo = dateRe.test(dateToRaw) ? dateToRaw : "";
            const rowsRaw = await complaintsFetchRows(filter, dateFrom, dateTo, 500);
            const periodWhereSql = (dateFrom ? " AND o.order_date >= '" + dateFrom + "'" : "") + (dateTo ? " AND o.order_date <= '" + dateTo + "'" : "");
            const cntPending = Number((await db.prepare("SELECT COUNT(*) AS n FROM orders o LEFT JOIN complaint_handling ch ON ch.order_id = o.id WHERE LOWER(TRIM(COALESCE(o.status,''))) = 'complaint' AND COALESCE(ch.handle_status,'pending') = 'pending'" + periodWhereSql).get())?.n) || 0;
            const cntHandling = Number((await db.prepare("SELECT COUNT(*) AS n FROM orders o LEFT JOIN complaint_handling ch ON ch.order_id = o.id WHERE LOWER(TRIM(COALESCE(o.status,''))) = 'complaint' AND ch.handle_status = 'handling'" + periodWhereSql).get())?.n) || 0;
            const cntResolved = Number((await db.prepare("SELECT COUNT(*) AS n FROM orders o LEFT JOIN complaint_handling ch ON ch.order_id = o.id WHERE LOWER(TRIM(COALESCE(o.status,''))) = 'complaint' AND ch.handle_status = 'resolved'" + periodWhereSql).get())?.n) || 0;
            const cntAll = cntPending + cntHandling + cntResolved;
            const resolveRate = cntAll > 0 ? Math.round((cntResolved * 100) / cntAll) : 0;
            const periodLabel = (dateFrom || dateTo) ? `${dateFrom || "—"} ~ ${dateTo || "—"}` : "全部期間";
            const statusPill = (s) => {
                if (s === "resolved") return `<span class="sf-pill ok">已解決</span>`;
                if (s === "handling") return `<span class="sf-pill warn">處理中</span>`;
                return `<span class="sf-pill bad">待處理</span>`;
            };
            const previewRaw = (raw) => {
                const t = String(raw || "").replace(/\[圖片\]/g, "[圖]").trim();
                if (!t) return "<span style='color:var(--txt-3);'>—</span>";
                const short = t.length > 60 ? t.slice(0, 60) + "…" : t;
                return escapeHtml(short);
            };
            const rows = rowsRaw.map((r) => `
              <tr>
                <td><a href="/admin/complaints/${encodeURIComponent(r.id)}">${escapeHtml(r.order_no || r.id)}</a></td>
                <td>${escapeHtml(r.order_date)}</td>
                <td><a href="/admin/customers/${encodeURIComponent(r.customer_id)}/quick-view?from=complaints" style="color:inherit;">${escapeHtml(r.customer_name)}</a></td>
                <td style="max-width:380px;">${previewRaw(r.raw_message)}</td>
                <td>${statusPill(r.handle_status)}</td>
                <td>${escapeHtml(r.handler || "—")}</td>
                <td>${escapeHtml(String(r.handle_updated_at || r.updated_at || "").slice(0,16).replace("T"," "))}</td>
                <td><a class="sf-btn sm" href="/admin/complaints/${encodeURIComponent(r.id)}">處理</a></td>
              </tr>`).join("");
            const qsCommon = (extra) => {
                const params = new URLSearchParams();
                if (dateFrom) params.set("date_from", dateFrom);
                if (dateTo) params.set("date_to", dateTo);
                Object.entries(extra || {}).forEach(([k, v]) => params.set(k, v));
                const s = params.toString();
                return s ? "?" + s : "";
            };
            const tabLink = (key, label, count) => `<a class="sf-btn sm ${filter===key?'primary':''}" href="/admin/complaints${qsCommon({ status: key })}">${escapeHtml(label)}<span style="margin-left:6px;opacity:0.7;">${count}</span></a>`;
            const exportQs = qsCommon({ status: filter });
            const statCard = (label, num, status, sub) => `
              <div style="padding:10px 16px;background:var(--bg-1);border:var(--hairline);border-radius:var(--radius-md);flex:1;display:flex;align-items:center;gap:10px;min-width:140px;">
                <span class="sf-dot ${status}"></span>
                <div>
                  <div style="font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(label)}</div>
                  <div class="mono" style="font-size:18px;font-weight:600;">${num}</div>
                  ${sub ? `<div style="font-size:11px;color:var(--txt-3);">${escapeHtml(sub)}</div>` : ""}
                </div>
              </div>`;
            const body = `
              <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css">
              <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
                <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                  <div>
                    <div class="sf-breadcrumb" style="margin-bottom:6px;">日常作業 / 客訴處理</div>
                    <h1 style="margin:0;font-size:22px;font-weight:600;">客訴處理</h1>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <a class="sf-btn" href="/admin/complaints/new" title="客戶在 LINE 純抱怨沒進訂單時，從這邊建空白客訴單">${SF_ICONS.plus}<span>新增空白客訴</span></a>
                    <a class="sf-btn primary" href="/admin/complaints/export.xlsx${exportQs}" title="依目前篩選匯出 Excel 報表">${SF_ICONS.dl}<span>匯出報表</span></a>
                  </div>
                </div>
                <p style="margin:0;color:var(--txt-3);font-size:13px;">三種來源：① 訂單頁「轉為客訴」按鈕 ② 客戶 LINE 訊息含關鍵詞時自動建立 ③「新增空白客訴」手動建立。客訴不會出現在訂單列表，不會匯出到凌越。員工在 LINE 群組回覆客戶的訊息會自動串到對話時間軸。</p>
                <div class="sf-card">
                  <div class="sf-card-body" style="padding:14px 16px;">
                    <form id="complaintsFilterForm" method="get" action="/admin/complaints" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
                      <input type="hidden" name="status" value="${escapeAttr(filter)}">
                      <input type="hidden" name="date_from" id="complaintsDateFrom" value="${escapeAttr(dateFrom)}">
                      <input type="hidden" name="date_to" id="complaintsDateTo" value="${escapeAttr(dateTo)}">
                      <label class="sf-label" style="margin:0;display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13px;color:var(--txt-2);">
                        日期區間
                        <input type="text" id="complaintsDateRange" readonly placeholder="不限期間" autocomplete="off" style="width:240px;height:36px;padding:0 10px;border:1px solid var(--line-2);border-radius:var(--radius);background:var(--bg-2);color:var(--txt-1);cursor:pointer;font-size:13px;">
                      </label>
                      <button type="submit" class="sf-btn primary">${SF_ICONS.search}<span>查詢</span></button>
                      <a class="sf-btn ghost" href="/admin/complaints?status=${escapeAttr(filter)}">清除日期</a>
                      <div style="flex:1;"></div>
                      <span style="font-size:12px;color:var(--txt-3);">期間：<strong>${escapeHtml(periodLabel)}</strong></span>
                    </form>
                  </div>
                </div>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                  ${statCard("總筆數", cntAll, "info", periodLabel)}
                  ${statCard("待處理", cntPending, cntPending>0?"bad":"ok")}
                  ${statCard("處理中", cntHandling, cntHandling>0?"warn":"ok")}
                  ${statCard("已解決", cntResolved, "ok")}
                  ${statCard("解決率", cntAll ? resolveRate + "%" : "—", resolveRate>=80?"ok":resolveRate>=50?"warn":"bad")}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  ${tabLink("open", "未解決", cntPending + cntHandling)}
                  ${tabLink("pending", "待處理", cntPending)}
                  ${tabLink("handling", "處理中", cntHandling)}
                  ${tabLink("resolved", "已解決", cntResolved)}
                  ${tabLink("all", "全部", cntAll)}
                </div>
                <div class="sf-table-wrap">
                  <table class="sf-table">
                    <thead><tr><th>訂單編號</th><th>日期</th><th>客戶</th><th>客訴內容</th><th>處理狀態</th><th>處理人</th><th>更新</th><th></th></tr></thead>
                    <tbody>${rows || `<tr><td colspan='8' style='padding:32px;text-align:center;color:var(--txt-3);'>此期間 / 分類無客訴</td></tr>`}</tbody>
                  </table>
                </div>
              </div>
              <script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js"></script>
              <script>
                (function(){
                  var df = document.getElementById("complaintsDateFrom");
                  var dt = document.getElementById("complaintsDateTo");
                  var rangeInp = document.getElementById("complaintsDateRange");
                  function pad2(n){ return n < 10 ? "0" + n : String(n); }
                  function fmtYMD(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
                  if (typeof flatpickr !== "undefined" && rangeInp && df && dt) {
                    flatpickr(rangeInp, {
                      mode: "range",
                      dateFormat: "Y-m-d",
                      defaultDate: df.value && dt.value ? [df.value, dt.value] : null,
                      allowInput: false,
                      onChange: function(selectedDates){
                        if (selectedDates.length >= 1) {
                          df.value = fmtYMD(selectedDates[0]);
                          dt.value = selectedDates.length >= 2 ? fmtYMD(selectedDates[1]) : fmtYMD(selectedDates[0]);
                        }
                      }
                    });
                  }
                })();
              </script>`;
            res.type("text/html").send(notionPage("客訴處理", body, "complaints", res));
        } catch (e) {
            console.error("[admin] /complaints", e);
            res.status(500).send("載入客訴列表失敗：" + (e?.message || e));
        }
    });
    router.get("/complaints/new", async (req, res) => {
        try {
            const customers = await db.prepare("SELECT id, name, line_group_id FROM customers WHERE active = 1 OR active IS NULL ORDER BY name").all();
            const today = getTaipeiCalendarDateYYYYMMDD();
            const errMsg = req.query.err ? `<div class="sf-pill bad" style="align-self:flex-start;margin-bottom:8px;">${escapeHtml(String(req.query.err))}</div>` : "";
            const body = `
              <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;max-width:840px;margin:0 auto;">
                <div>
                  <div class="sf-breadcrumb" style="margin-bottom:6px;"><a href="/admin/complaints">客訴處理</a> / 新增空白客訴</div>
                  <h1 style="margin:0;font-size:22px;font-weight:600;">新增空白客訴</h1>
                  <p style="color:var(--txt-3);font-size:13px;margin:6px 0 0;">客戶在 LINE 純粹抱怨沒提到具體叫貨內容時用。建立後會出現在客訴清單，後續流程與一般客訴一致。</p>
                </div>
                ${errMsg}
                <form method="post" action="/admin/complaints/new" class="sf-card" style="padding:18px 22px;display:flex;flex-direction:column;gap:14px;">
                  <label style="font-size:13px;color:var(--txt-2);">客戶 <span style="color:var(--bad);">*</span>
                    <select name="customer_id" class="sf-input" required style="margin-top:4px;">
                      <option value="">— 請選擇 —</option>
                      ${customers.map(c => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)}${c.line_group_id ? "" : "（未綁定 LINE）"}</option>`).join("")}
                    </select>
                  </label>
                  <label style="font-size:13px;color:var(--txt-2);">客訴日期
                    <input type="date" name="order_date" class="sf-input" value="${escapeAttr(today)}" style="margin-top:4px;">
                  </label>
                  <label style="font-size:13px;color:var(--txt-2);">客訴內容（客戶原話／員工轉述）<span style="color:var(--bad);">*</span>
                    <textarea name="raw_message" class="sf-input" rows="6" required placeholder="例：上週送的高麗菜底部有些爛掉，客戶說下次想換廠商。可貼上 LINE 對話截圖文字。" style="margin-top:4px;font-family:inherit;"></textarea>
                  </label>
                  <label style="font-size:13px;color:var(--txt-2);">備註（選填）
                    <input type="text" name="memo" class="sf-input" placeholder="例：經電話確認、來自 LINE 群組對話" style="margin-top:4px;">
                  </label>
                  <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
                    <a class="sf-btn ghost" href="/admin/complaints">取消</a>
                    <button type="submit" class="sf-btn primary">建立客訴單</button>
                  </div>
                </form>
              </div>`;
            res.type("text/html").send(notionPage("新增空白客訴", body, "complaints", res));
        } catch (e) {
            console.error("[admin] GET /complaints/new", e);
            res.status(500).send("載入失敗：" + (e?.message || e));
        }
    });
    router.post("/complaints/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const customerId = String(req.body?.customer_id || "").trim();
            const orderDate = String(req.body?.order_date || "").trim();
            const rawMessage = String(req.body?.raw_message || "").trim();
            const memo = String(req.body?.memo || "").trim();
            if (!customerId) {
                res.redirect("/admin/complaints/new?err=" + encodeURIComponent("請選擇客戶"));
                return;
            }
            if (!rawMessage) {
                res.redirect("/admin/complaints/new?err=" + encodeURIComponent("請填寫客訴內容"));
                return;
            }
            const customer = await db.prepare("SELECT id, name, line_group_id FROM customers WHERE id = ?").get(customerId);
            if (!customer) {
                res.redirect("/admin/complaints/new?err=" + encodeURIComponent("找不到客戶"));
                return;
            }
            const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(orderDate) ? orderDate : getTaipeiCalendarDateYYYYMMDD();
            const orderId = (0, id_js_1.newId)("ord");
            const isPg = Boolean(process.env.DATABASE_URL);
            const nowSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
            // 訂單編號用日期+序號（與一般訂單同邏輯，但 status='complaint'）
            // [fix 2026-07-27 體檢] 改走 getNextOrderNoAdmin 原子取號：舊版自刻「讀最大值+1」
            // 繞過了 2026-07-08 修好的先讀後寫撞號（兩人同時建客訴／與 LINE 收單併發會拿到同號，
            // 撞 ux_orders_order_no 回 500；唯一索引沒建起來的庫則直接寫出兩張同號單）。
            const orderNo = await getNextOrderNoAdmin(db, dateOk);
            await db.prepare(
                "INSERT INTO orders (id, order_no, customer_id, order_date, status, raw_message, remark, line_group_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, " + nowSql + ")"
            ).run(orderId, orderNo, customerId, dateOk, "complaint", rawMessage, memo || null, customer.line_group_id || null);
            await logDataChange(req, {
                entityType: "order",
                entityId: orderId,
                action: "create_complaint",
                summary: `手動新增空白客訴 ${orderNo}（客戶：${customer.name}）`,
                meta: { customer_id: customerId, customer_name: customer.name, order_date: dateOk, raw_message: rawMessage, memo, source: "manual_new" },
            });
            res.redirect("/admin/complaints/" + encodeURIComponent(orderId));
        } catch (e) {
            console.error("[admin] POST /complaints/new", e);
            res.redirect("/admin/complaints/new?err=" + encodeURIComponent("建立失敗：" + (e?.message || e)));
        }
    });
    router.get("/complaints/export.xlsx", async (req, res) => {
        try {
            const filterRaw = String(req.query.status || "all").toLowerCase();
            const filter = ["open", "all", "pending", "handling", "resolved"].includes(filterRaw) ? filterRaw : "all";
            const dateRe = /^\d{4}-\d{2}-\d{2}$/;
            const dateFromRaw = String(req.query.date_from || "").trim();
            const dateToRaw = String(req.query.date_to || "").trim();
            const dateFrom = dateRe.test(dateFromRaw) ? dateFromRaw : "";
            const dateTo = dateRe.test(dateToRaw) ? dateToRaw : "";
            const rowsRaw = await complaintsFetchRows(filter, dateFrom, dateTo, 5000);
            const statusLabel = (s) => s === "resolved" ? "已解決" : s === "handling" ? "處理中" : "待處理";
            const cleanText = (t) => String(t == null ? "" : t).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
            const formatTs = (ts) => {
                const s = String(ts || "");
                return s ? s.slice(0, 16).replace("T", " ") : "";
            };
            const header = ["訂單編號", "客訴日期", "客戶", "客訴內容", "處理狀態", "處理人", "處理備註", "客訴建立時間", "解決時間", "最後更新"];
            const aoa = [header];
            for (const r of rowsRaw) {
                aoa.push([
                    cleanText(r.order_no || r.id),
                    cleanText(r.order_date),
                    cleanText(r.customer_name),
                    cleanText(String(r.raw_message || "").replace(/\[圖片\]/g, "[圖]")),
                    statusLabel(r.handle_status),
                    cleanText(r.handler),
                    cleanText(r.note),
                    formatTs(r.complaint_created_at),
                    formatTs(r.resolved_at),
                    formatTs(r.handle_updated_at || r.updated_at),
                ]);
            }
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 50 }, { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
            XLSX.utils.book_append_sheet(wb, ws, "客訴紀錄");
            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
            const bin = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
            const period = (dateFrom || dateTo) ? `${dateFrom || "起"}_${dateTo || "迄"}` : "全部";
            const fname = `客訴紀錄_${period}_${filter}.xlsx`;
            res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodeURIComponent(fname));
            res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(bin);
        } catch (e) {
            console.error("[admin] /complaints/export.xlsx", e);
            res.status(500).type("text/plain; charset=utf-8").send("匯出失敗：" + (e?.message || e));
        }
    });
    router.get("/complaints/:orderId", async (req, res) => {
        try {
            const { orderId } = req.params;
            const order = await db.prepare(
                "SELECT o.id, o.order_no, o.order_date, o.status, o.raw_message, o.customer_id, o.line_group_id, o.updated_at, c.name AS customer_name " +
                "FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?"
            ).get(orderId);
            if (!order) {
                res.status(404).send("訂單不存在");
                return;
            }
            const handling = await db.prepare("SELECT order_id, handle_status, handler, note, resolved_at, created_at, updated_at FROM complaint_handling WHERE order_id = ?").get(orderId);
            const handleStatus = handling?.handle_status || "pending";
            const handlerVal = handling?.handler || "";
            const noteVal = handling?.note || "";
            // 用於自動填入「處理人」「處理備註」（只在欄位空白時建議）
            let suggestedHandler = "";
            let suggestedNote = "";
            const attachments = await db.prepare("SELECT id, line_message_id FROM order_attachments WHERE order_id = ?").all(orderId);
            const groupId = order.line_group_id || null;
            const baseTime = String(handling?.created_at || order.updated_at || "");
            const windowEndRaw = handling?.resolved_at || null;
            let employeeMsgs = [];
            if (groupId) {
                try {
                    const isPg = Boolean(process.env.DATABASE_URL);
                    const baseClause = isPg ? "created_at >= $1::timestamptz - INTERVAL '1 day'" : "created_at >= datetime(?, '-1 day')";
                    const endClause = windowEndRaw
                        ? (isPg ? " AND created_at <= $2::timestamptz + INTERVAL '1 day'" : " AND created_at <= datetime(?, '+1 day')")
                        : "";
                    const sql = "SELECT id, event_type, detail, created_at FROM line_bot_state_log " +
                        "WHERE event_type = 'internal_employee_message' AND " + baseClause + endClause +
                        " ORDER BY created_at ASC LIMIT 200";
                    const params = windowEndRaw ? [baseTime, windowEndRaw] : [baseTime];
                    const all = await db.prepare(sql).all(...params);
                    employeeMsgs = (all || []).filter((r) => {
                        try {
                            const d = typeof r.detail === "string" ? JSON.parse(r.detail) : r.detail;
                            return d && d.groupId === groupId;
                        } catch (_) { return false; }
                    });
                } catch (e) {
                    console.warn("[admin] /complaints/:id timeline query failed:", e?.message || e);
                }
            }
            // [fix 2026-07-27 體檢] isPg 前置分支（比照本 handler 上方寫法）：舊版先打 sqlite 的
            // date(?, '-3 day') 讓 PG 報錯再走 .catch 補救——雲端每開一次客訴頁就記一筆 PG 錯誤，
            // 且該句一旦被搬進交易會毒化整個交易（25P02）連 fallback 一起死。
            const isPgCplDates = !!process.env.DATABASE_URL;
            const otherCustOrders = await (isPgCplDates
                ? db.prepare(
                    "SELECT id, order_no, order_date, status, raw_message, updated_at FROM orders " +
                    "WHERE customer_id = $1 AND id <> $2 AND order_date::date >= ($3::date - INTERVAL '3 day') AND order_date::date <= ($3::date + INTERVAL '7 day') " +
                    "ORDER BY order_date DESC, id DESC LIMIT 50"
                ).all(order.customer_id, orderId, order.order_date)
                : db.prepare(
                    "SELECT id, order_no, order_date, status, raw_message, updated_at FROM orders " +
                    "WHERE customer_id = ? AND id <> ? AND order_date >= date(?, '-3 day') AND order_date <= date(?, '+7 day') " +
                    "ORDER BY order_date DESC, id DESC LIMIT 50"
                ).all(order.customer_id, orderId, order.order_date, order.order_date)
            ).catch(() => []);
            const formatTs = (ts) => {
                const s = String(ts || "");
                if (!s) return "";
                return s.slice(0, 16).replace("T", " ");
            };
            const attachmentBlock = attachments.length
                ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">${attachments.map((a) => `<img src="/admin/orders/${encodeURIComponent(orderId)}/attachment/${encodeURIComponent(a.line_message_id)}" alt="客戶傳的照片" style="max-width:100%;border:1px solid var(--line-2);border-radius:6px;">`).join("")}</div>`
                : "";
            const rawText = String(order.raw_message || "").replace(/\[圖片\]/g, "").trim();
            const originalCard = `
              <div class="sf-card" style="border-left:4px solid #ef4444;">
                <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.mail}客戶原始客訴 · ${escapeHtml(order.order_date)} ${formatTs(order.updated_at)}</div></div>
                <div style="padding:14px;">
                  ${rawText ? `<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;margin:0;background:var(--bg-2);padding:10px;border-radius:6px;">${escapeHtml(rawText)}</pre>` : "<p style='color:var(--txt-3);margin:0;'>無原始文字</p>"}
                  ${attachmentBlock}
                </div>
              </div>`;
            const timelineItems = [];
            const empReplyForNote = [];
            const empNameOrder = [];
            const empNameCount = new Map();
            for (const m of employeeMsgs) {
                let d = {};
                try { d = typeof m.detail === "string" ? JSON.parse(m.detail) : (m.detail || {}); } catch (_) { d = {}; }
                const username = String(d.username || "").trim();
                const displayName = String(d.name || d.displayName || "").trim();
                const empName = displayName || username || "員工";
                const empLabel = `${d.username || "員工"}${d.title ? `（${d.title}）` : ""}`;
                const preview = String(d.preview || "").trim();
                // 收集員工名稱（去重，保留出現順序；同時記錄出現次數，用於挑「主要處理人」）
                if (empName && empName !== "員工") {
                    if (!empNameOrder.includes(empName)) empNameOrder.push(empName);
                    empNameCount.set(empName, (empNameCount.get(empName) || 0) + 1);
                }
                // 收集員工回覆內容（給處理備註用，格式：HH:MM 員工：訊息）
                if (preview) {
                    const hhmm = String(m.created_at || "").slice(11, 16);
                    empReplyForNote.push(`[${hhmm}] ${empName}：${preview}`);
                }
                timelineItems.push({
                    ts: m.created_at,
                    html: `<div style="border-left:3px solid #2383e2;padding:10px 14px;margin-bottom:8px;background:var(--bg-1);border-radius:0 6px 6px 0;">
                      <div style="font-size:12px;color:var(--txt-3);margin-bottom:4px;">${sfInlineIcon("user")} ${escapeHtml(empLabel)} 回覆 · ${formatTs(m.created_at)}</div>
                      <div style="white-space:pre-wrap;font-size:13px;">${escapeHtml(preview)}</div>
                    </div>`
                });
            }
            // 處理人建議：以「回覆最多次」為主，相同次數時取最先回覆者
            if (empNameOrder.length) {
                const ranked = [...empNameOrder].sort((a, b) => {
                    const ca = empNameCount.get(a) || 0, cb = empNameCount.get(b) || 0;
                    if (ca !== cb) return cb - ca;
                    return empNameOrder.indexOf(a) - empNameOrder.indexOf(b);
                });
                suggestedHandler = ranked[0];
                // 若有多位回覆，加註其他人（最多顯示 3 位）
                if (ranked.length > 1) {
                    suggestedHandler += "（協同：" + ranked.slice(1, 4).join("、") + "）";
                }
            }
            // 處理備註建議：列出員工回覆的時間軸
            if (empReplyForNote.length) {
                const rawText = String(order.raw_message || "").replace(/\[圖片\]/g, "").trim();
                const lines = [];
                if (rawText) {
                    const short = rawText.length > 120 ? rawText.slice(0, 120) + "…" : rawText;
                    lines.push(`【客戶訴求】${short}`);
                    lines.push("");
                }
                lines.push("【員工回覆】");
                for (const r of empReplyForNote) lines.push(r);
                suggestedNote = lines.join("\n");
            }
            for (const o of (otherCustOrders || [])) {
                const t = String(o.raw_message || "").replace(/\[圖片\]/g, "[圖]").trim();
                if (!t) continue;
                const short = t.length > 200 ? t.slice(0, 200) + "…" : t;
                timelineItems.push({
                    ts: o.updated_at,
                    html: `<div style="border-left:3px solid #d1d5db;padding:10px 14px;margin-bottom:8px;background:var(--bg-1);border-radius:0 6px 6px 0;">
                      <div style="font-size:12px;color:var(--txt-3);margin-bottom:4px;">${sfInlineIcon("mail")} 客戶同期訊息（訂單 <a href="/admin/orders/${encodeURIComponent(o.id)}">${escapeHtml(o.order_no || o.id)}</a>） · ${escapeHtml(o.order_date)} ${formatTs(o.updated_at)}</div>
                      <div style="white-space:pre-wrap;font-size:13px;">${escapeHtml(short)}</div>
                    </div>`
                });
            }
            timelineItems.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
            const timelineHtml = timelineItems.length
                ? timelineItems.map((x) => x.html).join("")
                : `<p style="color:var(--txt-3);margin:0;">尚無後續訊息（員工在 LINE 群組回覆會自動出現於此）</p>`;
            const okMsg = req.query.ok === "updated" ? `<div class="sf-pill ok" style="align-self:flex-start;">已更新處理狀態</div>` : "";
            const body = `
              <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                  <div>
                    <div class="sf-breadcrumb" style="margin-bottom:6px;"><a href="/admin/complaints">客訴處理</a> / 客訴明細</div>
                    <h2 style="margin:0;font-size:20px;font-weight:600;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                      <a href="/admin/customers/${encodeURIComponent(order.customer_id)}/quick-view?from=complaints" style="color:inherit;">${escapeHtml(order.customer_name)}</a>
                      <span class="sf-pill bad">客訴</span>
                    </h2>
                    <div style="margin-top:6px;font-size:12px;color:var(--txt-3);">${escapeHtml(order.order_no || order.id)} · ${escapeHtml(order.order_date)}${groupId ? "" : ' · <span style="color:#b91c1c;">⚠ 客戶未綁定 LINE 群組，無法串接對話</span>'}</div>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <a class="sf-btn ghost" href="/admin/complaints">← 回客訴列表</a>
                    <form method="post" action="/admin/complaints/${encodeURIComponent(orderId)}/to-order" style="display:inline;margin:0;">
                      <button type="submit" class="sf-btn" onclick="return confirm('確定要從客訴還原為訂單？將回到待確認訂單列表。');">還原為訂單</button>
                    </form>
                  </div>
                </div>
                ${okMsg}
                <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:flex-start;">
                  <div style="display:flex;flex-direction:column;gap:14px;">
                    ${originalCard}
                    <div class="sf-card">
                      <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.message}對話時間軸</div></div>
                      <div style="padding:14px;">${timelineHtml}</div>
                    </div>
                  </div>
                  <div class="sf-card" style="position:sticky;top:12px;">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.note}處理紀錄</div></div>
                    <form method="post" action="/admin/complaints/${encodeURIComponent(orderId)}/update" style="padding:14px;display:flex;flex-direction:column;gap:12px;">
                      <label style="font-size:13px;color:var(--txt-2);">處理狀態
                        <select name="handle_status" class="sf-input" style="margin-top:4px;">
                          <option value="pending" ${handleStatus==="pending"?"selected":""}>待處理</option>
                          <option value="handling" ${handleStatus==="handling"?"selected":""}>處理中</option>
                          <option value="resolved" ${handleStatus==="resolved"?"selected":""}>已解決</option>
                        </select>
                      </label>
                      <label style="font-size:13px;color:var(--txt-2);">處理人
                        <input type="text" name="handler" class="sf-input" value="${escapeAttr(handlerVal || suggestedHandler)}" placeholder="例：阿榮、客服小敏" style="margin-top:4px;">
                        ${(!handlerVal && suggestedHandler) ? `<span style="font-size:11px;color:var(--ok);display:block;margin-top:4px;">${sfInlineIcon("wand")} 已依員工回覆自動帶入「${escapeHtml(suggestedHandler)}」，可修改後再儲存</span>` : ""}
                      </label>
                      <label style="font-size:13px;color:var(--txt-2);">處理備註
                        <textarea name="note" class="sf-input" rows="8" placeholder="記錄處理經過、客戶回覆、補償方案等" style="margin-top:4px;font-family:inherit;">${escapeHtml(noteVal || suggestedNote)}</textarea>
                        ${(!noteVal && suggestedNote) ? `<span style="font-size:11px;color:var(--ok);display:block;margin-top:4px;">${sfInlineIcon("wand")} 已彙整對話內容自動帶入，可修改／補充後再儲存</span>` : ""}
                      </label>
                      <button type="submit" class="sf-btn primary">儲存</button>
                      ${handling?.resolved_at ? `<div style="font-size:12px;color:var(--txt-3);">解決時間：${escapeHtml(formatTs(handling.resolved_at))}</div>` : ""}
                    </form>
                  </div>
                </div>
              </div>`;
            res.type("text/html").send(notionPage("客訴明細", body, "complaints", res));
        } catch (e) {
            console.error("[admin] /complaints/:id", e);
            res.status(500).send("載入客訴明細失敗：" + (e?.message || e));
        }
    });
}
