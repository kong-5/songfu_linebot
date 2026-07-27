"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOrdersRoutes = registerOrdersRoutes;

// 訂單域（訂單列表/序號起始/批次刪除·核准·改日期/批次訂貨單·凌越 xlsx/作廢·還原/
// 明細品項增刪改/貼上原文重建/核准·退回核准/加品項/訂貨單列印）路由：
// 自 index.js 拆出（拆檔批次 5），純搬移、行為不變。
// 註：訂單路由在原檔是不連續的（中間夾凌越機器端點/匯出備份/AI 設定），本檔一次註冊；
//     已用 URL 比對等價性驗證（每個 URL 打到的 handler 與拆前相同），詳見 PR 說明。

const express_1 = { default: require("express") };
const XLSX = require("xlsx");
const id_js_1 = require("../lib/id.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const resolve_product_js_1 = require("../lib/resolve-product.js");
const unit_conversion_js_1 = require("../lib/unit-conversion.js");
const order_form_templates_js_1 = require("../lib/order-form-templates.js");
const order_split_js_1 = require("../lib/order-split.js");
const rebuild_order_from_sources_js_1 = require("../lib/rebuild-order-from-sources.js");
const line_bot_control_js_1 = require("../lib/line-bot-control.js");
const customer_handwriting_hints_js_1 = require("../lib/customer-handwriting-hints.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerOrdersRoutes(router, ctx) {
    const { db, notionPage, logDataChange, loadAdminUsers, getTaipeiCalendarDateYYYYMMDD, fmtTaipeiYMDHM, fmtTaipeiMMDDHHmm, voidReasonModalHtml, formatOrderDateForLingyue, rebuildOrderItemsFromRawText, ORDER_LINE_UNITS } = ctx;
    router.get("/orders", async (req, res) => {
        try {
            const today = getTaipeiCalendarDateYYYYMMDD();
            const onlyNeedReview = req.query.need_review === "1";
            const hasDateFrom = typeof req.query.date_from === "string" && req.query.date_from.trim() !== "";
            const hasDateTo = typeof req.query.date_to === "string" && req.query.date_to.trim() !== "";
            const filterDateFrom = (hasDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_from.trim()))
                ? req.query.date_from.trim()
                : today;
            const filterDateTo = (hasDateTo && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_to.trim()))
                ? req.query.date_to.trim()
                : today;
            let lineOrders = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.updated_at, o.customer_id, c.name AS customer_name, c.route_line AS route_line,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1 AND oi.voided_at IS NULL) AS need_review_count,
        0 AS non_kg_count,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND (oi.include_export IS NULL OR oi.include_export = 1) AND oi.voided_at IS NULL) AS export_item_count,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.voided_at IS NULL) AS total_item_count,
        o.sheet_exported_at, o.lingyue_exported_at, o.lingyue_doc_no, o.lingyue_written_at, o.lingyue_queued_by,
        o.lingyue_queued_at, o.lingyue_last_error,
        o.raw_message AS source_raw_message,
        o.approved_by, o.approved_at,
        (SELECT COUNT(*) FROM order_attachments oa WHERE oa.order_id = o.id) AS source_attachment_count
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.order_date >= ? AND o.order_date <= ? AND COALESCE(LOWER(TRIM(o.status)), '') NOT IN ('deleted','complaint')
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 300
    `).all(filterDateFrom, filterDateTo);
            // 查詢硬上限 LIMIT 300：結果剛好滿 300 筆＝很可能被截斷，列表頂部要提示使用者縮小日期區間
            const ordersHitLimit = Array.isArray(lineOrders) && lineOrders.length === 300;
            let deletedOrders = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id, c.name AS customer_name,
             o.voided_at, o.voided_by, o.void_reason, o.void_note
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.order_date >= ? AND o.order_date <= ? AND COALESCE(LOWER(TRIM(o.status)), '') = 'deleted'
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 300
    `).all(filterDateFrom, filterDateTo);
            let logOrdersRaw = [];
            try {
                logOrdersRaw = await db.prepare(`
      SELECT o.id, o.order_date, o.customer_id, c.name AS customer_name,
        (SELECT COUNT(*) FROM logistics_order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1) AS need_review_count,
        0 AS non_kg_count,
        (SELECT COUNT(*) FROM logistics_order_items oi WHERE oi.order_id = o.id) AS export_item_count
      FROM logistics_orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.order_date >= ? AND o.order_date <= ?
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 300
    `).all(filterDateFrom, filterDateTo);
            }
            catch (_e) {
                logOrdersRaw = [];
            }
            const logOrders = (logOrdersRaw || []).map((o) => ({
                id: o.id,
                order_no: null,
                order_date: o.order_date,
                status: null,
                customer_id: o.customer_id,
                customer_name: o.customer_name,
                need_review_count: o.need_review_count,
                non_kg_count: o.non_kg_count,
                export_item_count: o.export_item_count,
                sheet_exported_at: null,
                lingyue_exported_at: null,
                lingyue_doc_no: null,
                lingyue_written_at: null,
                is_logistics: true,
            }));
            let orders = [...lineOrders, ...logOrders].sort((a, b) => {
                const da = (a.order_date || "").toString();
                const db = (b.order_date || "").toString();
                if (da !== db)
                    return db.localeCompare(da);
                return String(b.id).localeCompare(String(a.id));
            });
            // 狀態篩選：pending=待簽核（未確認）／approved=已確認。與儀表板卡片定義一致。
            const statusFilter = String(req.query.status || "").toLowerCase();
            if (statusFilter === "pending") {
                orders = orders.filter((o) => String(o.status || "").toLowerCase() !== "approved");
            }
            else if (statusFilter === "approved") {
                orders = orders.filter((o) => String(o.status || "").toLowerCase() === "approved");
            }
            if (onlyNeedReview) {
                orders = orders.filter((o) => (o.need_review_count ?? 0) > 0);
            }
            const labelByOrder = new Map();
            if (orders.length) {
                const lineIds = orders.filter((x) => !x.is_logistics).map((x) => x.id);
                const logIds = orders.filter((x) => x.is_logistics).map((x) => x.id);
                if (lineIds.length) {
                    const ph = lineIds.map(() => "?").join(",");
                    const labelRows = await db.prepare(`
      SELECT oi.order_id, COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '—') AS label
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id IN (${ph}) AND oi.voided_at IS NULL
      ORDER BY oi.order_id, oi.id
    `).all(...lineIds);
                    for (const r of labelRows) {
                        const oid = r.order_id;
                        if (!labelByOrder.has(oid))
                            labelByOrder.set(oid, []);
                        const arr = labelByOrder.get(oid);
                        if (arr.length < 6)
                            arr.push(r.label);
                    }
                }
                if (logIds.length) {
                    const ph = logIds.map(() => "?").join(",");
                    const labelRowsLog = await db.prepare(`
      SELECT oi.order_id, COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '—') AS label
      FROM logistics_order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id IN (${ph})
      ORDER BY oi.order_id, oi.id
    `).all(...logIds);
                    for (const r of labelRowsLog) {
                        const oid = r.order_id;
                        if (!labelByOrder.has(oid))
                            labelByOrder.set(oid, []);
                        const arr = labelByOrder.get(oid);
                        if (arr.length < 6)
                            arr.push(r.label);
                    }
                }
            }
            const orderSeqStartRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("order_seq_start_" + today);
            const orderSeqStartVal = orderSeqStartRow?.value ?? "";
            const buildStatusIcons = (o) => {
                const n = o.need_review_count ?? 0;
                const pieces = [];
                if (String(o.status || "").toLowerCase() === "approved") {
                    pieces.push(`<span class="osi osi-approve" title="已確認">✓</span>`);
                }
                if (n > 0) {
                    pieces.push(`<span class="osi osi-warn" title="${n} 項待確認">!</span>`);
                }
                if (o.sheet_exported_at) {
                    pieces.push(`<span class="osi osi-sheet" title="已開啟／匯出揀貨單">${SF_ICONS.printer}</span>`);
                }
                if (o.lingyue_exported_at) {
                    pieces.push(`<span class="osi osi-xlsx" title="已匯出凌越 Excel">▦</span>`);
                }
                if (o.lingyue_doc_no) {
                    pieces.push(`<span class="osi osi-lywb" title="已回寫凌越，單據號 ${escapeAttr(String(o.lingyue_doc_no))}">↩${escapeHtml(String(o.lingyue_doc_no))}</span>`);
                }
                return `<div class="order-status-icons">${pieces.join("")}</div>`;
            };
            /** LINE 訂單：raw 含非「[圖片]」行視為文字來源；order_attachments 有一筆以上視為圖片來源 */
            const buildOrderSourceIcons = (o) => {
                if (o.is_logistics)
                    return "";
                let hasText = false;
                const raw = o.source_raw_message;
                if (raw != null && String(raw).trim() !== "") {
                    for (const line of String(raw).split(/\r?\n/)) {
                        const t = line.trim();
                        if (t && t !== "[圖片]") {
                            hasText = true;
                            break;
                        }
                    }
                }
                const hasImg = (o.source_attachment_count ?? 0) > 0;
                if (!hasText && !hasImg)
                    return "";
                const parts = [];
                if (hasText)
                    parts.push(`<span class="order-src-icon order-src-t" title="含文字叫貨">字</span>`);
                if (hasImg)
                    parts.push(`<span class="order-src-icon order-src-i" title="含圖片叫貨">圖</span>`);
                return `<span class="order-src-icons">${parts.join("")}</span>`;
            };
            // 操作者 email → 顯示名字（狀態列顯示名字而非 email）
            const adminNameMap = new Map();
            try {
                for (const u of (await loadAdminUsers())) {
                    if (u && u.username) adminNameMap.set(String(u.username).toLowerCase(), u.name || u.username);
                }
            } catch (_) { /* 讀不到就退回顯示原字串 */ }
            const nameOf = (u) => {
                if (!u) return "";
                return adminNameMap.get(String(u).toLowerCase()) || String(u);
            };
            const rows = orders
                .map((o, idx) => {
                const n = o.need_review_count ?? 0;
                const cnt = o.export_item_count ?? 0;
                const labels = labelByOrder.get(o.id) || [];
                const preview = labels.slice(0, 4).join("、");
                const previewShort = preview.length > 72 ? preview.slice(0, 72) + "…" : preview;
                const statusLc = String(o.status || "").toLowerCase();
                const isApproved = statusLc === "approved";
                const dotStatus = isApproved ? "ok" : (n > 0 ? "warn" : "info");
                const rawCustName = (o.customer_name && String(o.customer_name).trim()) || "";
                const custDisp = rawCustName
                    || (o.customer_id ? `客戶 ${String(o.customer_id).slice(0, 6)}` : "未選客戶");
                const custFallback = !rawCustName;
                const custLink = o.customer_id
                    ? `<a href="/admin/customers/${encodeURIComponent(o.customer_id)}/quick-view?from=orders" style="color:var(--txt-1);font-weight:500;${custFallback ? "font-style:italic;color:var(--txt-3);" : ""}">${escapeHtml(custDisp)}</a>${custFallback ? ' <span class="sf-pill bad" style="font-size:10px;padding:0 6px;">缺名</span>' : ""}`
                    : `<span style="color:var(--txt-3);">${escapeHtml(custDisp)}</span>`;
                const backBase = `/admin/orders?date_from=${encodeURIComponent(filterDateFrom)}&date_to=${encodeURIComponent(filterDateTo)}${onlyNeedReview ? "&need_review=1" : ""}`;
                const detailUrl = o.is_logistics
                    ? `/admin/logistics/orders/${encodeURIComponent(o.id)}`
                    : `/admin/orders/${encodeURIComponent(o.id)}?back=${encodeURIComponent(backBase)}`;
                // 叫貨日期與時間（訂單無 created_at，用 updated_at＝進單/紀錄時間；MM-DD HH:mm）
                const receivedAt = fmtTaipeiMMDDHHmm(o.updated_at);
                const orderNoCell = `<span class="mono" style="font-size:12px;color:var(--txt-2);white-space:nowrap;">${escapeHtml(receivedAt)}</span>`;
                const checkboxCell = o.is_logistics
                    ? `<span style="color:var(--txt-3);">—</span>`
                    : `<input type="checkbox" name="order_ids" value="${escapeAttr(o.id)}" form="batchOrderActionsForm" class="order-batch-cb">`;
                // 來源 pill
                let hasText = false;
                if (o.source_raw_message != null && String(o.source_raw_message).trim() !== "") {
                    for (const line of String(o.source_raw_message).split(/\r?\n/)) {
                        const t = line.trim();
                        if (t && t !== "[圖片]") { hasText = true; break; }
                    }
                }
                const hasImg = (o.source_attachment_count ?? 0) > 0;
                const srcPills = o.is_logistics ? `<span class="sf-pill">紙本</span>` : [
                    hasText ? `<span class="sf-pill info" title="含文字叫貨">字</span>` : "",
                    hasImg ? `<span class="sf-pill accent" title="含圖片叫貨">圖</span>` : "",
                ].join(" ");
                const approvedByShort = (isApproved && o.approved_by) ? nameOf(o.approved_by) : "";
                const approvedAtShort = (isApproved && o.approved_at) ? fmtTaipeiMMDDHHmm(o.approved_at, "") : "";
                const approvedMeta = isApproved && (approvedByShort || approvedAtShort)
                    ? `<div style="font-size:10px;color:var(--txt-3);margin-top:2px;line-height:1.2;">${approvedByShort ? "by " + escapeHtml(approvedByShort) : ""}${approvedByShort && approvedAtShort ? " · " : ""}${approvedAtShort ? escapeHtml(approvedAtShort) : ""}</div>`
                    : "";
                const statusPill = isApproved
                    ? `<span class="sf-pill ok">✓ 已確認</span>${approvedMeta}`
                    : (n > 0 ? `<span class="sf-pill warn">${n} 待確認</span>` : `<span class="sf-pill">待簽核</span>`);
                const expIcons = [
                    o.sheet_exported_at ? `<span class="sf-pill" title="已匯出揀貨單">${SF_ICONS.printer}</span>` : "",
                    o.lingyue_exported_at ? `<span class="sf-pill" title="已匯出凌越 Excel">▦</span>` : "",
                ].join(" ");
                // mobile 3 列卡片
                const dateShortForCard = (() => {
                    const m = String(o.order_date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
                    if (!m) return o.order_date || "—";
                    // [fix 2026-07-08] 用 Date.UTC + getUTCDay 從日期本身算星期，
                    // 過去用 new Date("...+08:00").getDay() 在 UTC 伺服器上會差一天。
                    const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
                    const wd = "日一二三四五六"[dt.getUTCDay()] || "";
                    return `${Number(m[2])}/${Number(m[3])}` + (wd ? `（${wd}）` : "");
                })();
                const mobileSrcText = o.is_logistics ? "紙本" : (hasText && hasImg ? "字+圖" : (hasText ? "字" : (hasImg ? "圖" : "")));
                const mobileItemCountHtml = cnt > 0
                  ? `<span>· ${cnt} 項</span>`
                  : ((o.total_item_count ?? 0) > 0
                    ? `<span style="color:#b45309;font-weight:600;">· ⚠ 無匯出品項</span>`
                    : `<span style="color:#b91c1c;font-weight:700;">· ⚠ 無品項·可能不是訂單</span>`);
                const mobileCardHtml = `
              <a href="${detailUrl}" class="order-mobile-card">
                <div class="row1">
                  <span class="delivery">${escapeHtml(dateShortForCard)}</span>
                  <span class="cust${custFallback ? " fallback" : ""}">${escapeHtml(custDisp)}</span>
                  ${o.route_line ? `<span class="sf-pill" style="background:#eef2ff;color:#3730a3;font-weight:600;font-size:10px;">${escapeHtml(String(o.route_line))} 號線</span>` : ""}
                  ${statusPill}
                </div>
                <div class="row2">
                  <span class="mono">叫貨 ${escapeHtml(receivedAt)}</span>
                  ${mobileItemCountHtml}
                  ${mobileSrcText ? `<span>· ${escapeHtml(mobileSrcText)}</span>` : ""}
                  ${n > 0 ? `<span style="color:var(--bad);font-weight:600;">· ${n} 待確認</span>` : ""}
                </div>
                <div class="row3">${escapeHtml(previewShort || "—")}</div>
              </a>`;
                const routeVal = (o.route_line != null && o.route_line !== "") ? String(o.route_line) : "";
                const routeCellHtml = routeVal ? `<span class="sf-pill" style="background:#eef2ff;color:#3730a3;font-weight:600;">${escapeHtml(routeVal)} 號線</span>` : `<span style="color:var(--txt-3);">—</span>`;
                return `<tr class="order-row" data-href="${escapeAttr(detailUrl)}" style="cursor:pointer;" data-cust="${escapeAttr(custDisp)}" data-orderno="${escapeAttr(o.is_logistics ? "紙本" : (o.order_no ?? ""))}" data-route="${escapeAttr(routeVal)}" data-status="${escapeAttr(isApproved ? "approved" : (n>0?"need_review":"pending"))}">
            <td class="order-cb-cell" style="width:36px;cursor:pointer;" data-label="">${checkboxCell}</td>
            <td class="order-cb-cell" style="width:24px;cursor:pointer;" data-label=""><span class="sf-dot ${dotStatus}"></span></td>
            <td style="white-space:nowrap;" data-label="叫貨時間">${orderNoCell}</td>
            <td class="mono" style="font-size:12px;color:var(--txt-3);white-space:nowrap;" data-label="出貨日">${escapeHtml(o.order_date)}</td>
            <td data-label="客戶">${custLink}</td>
            <td style="white-space:nowrap;" data-label="路線">${routeCellHtml}</td>
            <td style="white-space:nowrap;" data-label="來源">${srcPills}</td>
            <td style="max-width:380px;" data-label="品項">
              ${cnt > 0
                ? `<div style="font-size:12px;color:var(--txt-1);font-weight:500;">${cnt} 筆品項</div>`
                : ((o.total_item_count ?? 0) > 0
                  ? `<div style="font-size:12px;color:#b45309;font-weight:600;">⚠ 無匯出品項<span style="font-weight:400;font-size:11px;margin-left:4px;">（共 ${o.total_item_count} 筆全部排除）</span></div>`
                  : `<div style="font-size:13px;color:#b91c1c;font-weight:700;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:3px 8px;display:inline-block;">⚠ 無品項 · 可能不是訂單</div>`)
              }
            </td>
            <td style="white-space:nowrap;" data-label="狀態">${statusPill}${expIcons ? " " + expIcons : ""}</td>
            <td style="text-align:right;white-space:nowrap;" data-label="">${o.lingyue_doc_no
                ? `<span class="sf-pill" style="background:#e0f2f1;color:#00695c;font-weight:700;" title="已轉入凌越，單據號 ${escapeAttr(String(o.lingyue_doc_no))}${o.lingyue_queued_by ? "，由 " + escapeAttr(nameOf(o.lingyue_queued_by)) + " 轉入" : ""}（如需重轉請進明細）">✓已轉入 ↩${escapeHtml(String(o.lingyue_doc_no))}${o.lingyue_queued_by ? " ·" + escapeHtml(nameOf(o.lingyue_queued_by)) : ""}</span>`
                : `${(o.lingyue_last_error && !o.lingyue_queued_at) ? `<span class="sf-pill" style="background:#fef2f2;color:#b91c1c;font-weight:700;" title="轉入失敗：${escapeAttr(String(o.lingyue_last_error))}">⚠ 轉入失敗</span> ` : ""}<button type="button" class="sf-btn sm lingyue-transfer-btn" data-id="${escapeAttr(o.id)}" data-orderno="${escapeAttr(o.is_logistics ? "紙本" : (o.order_no || ""))}" title="${o.lingyue_last_error ? escapeAttr("上次失敗：" + String(o.lingyue_last_error) + "。修正後可再轉入") : "轉入凌越（顯示凌越料號並轉入）"}">轉入凌越</button>`} <a class="sf-btn sm" href="${detailUrl}">明細</a></td>
            <td class="order-mobile-only">${mobileCardHtml}</td>
          </tr>`;
            })
                .join("");
            const voidReasonLabel = { ai_wrong:"AI 辨識錯誤", customer_complaint:"客訴", customer_cancelled:"客戶取消", duplicate:"重複叫貨", staff_error:"內部錯誤", not_order:"非訂單訊息", other:"其他" };
            const deletedRows = deletedOrders.map((o) => {
              const backUrl = "/admin/orders?date_from=" + encodeURIComponent(filterDateFrom) + "&date_to=" + encodeURIComponent(filterDateTo) + (onlyNeedReview ? "&need_review=1" : "");
              const reasonLabel = voidReasonLabel[o.void_reason] || (o.void_reason || "—");
              const reasonPillCls = o.void_reason === "ai_wrong" ? "warn" : (o.void_reason === "customer_complaint" ? "bad" : "");
              const voidedShort = fmtTaipeiYMDHM(o.voided_at);
              const custName = (o.customer_name && String(o.customer_name).trim()) || (o.customer_id ? `客戶 ${String(o.customer_id).slice(0,6)}` : "—");
              return `<tr>
                <td style="width:24px;"><span class="sf-dot bad"></span></td>
                <td><span class="mono" style="font-size:12px;">${escapeHtml(o.order_no ?? "—")}</span></td>
                <td class="mono" style="font-size:12px;color:var(--txt-3);">${escapeHtml(o.order_date)}</td>
                <td>${escapeHtml(custName)}</td>
                <td><span class="sf-pill ${reasonPillCls}" style="font-size:11px;">${escapeHtml(reasonLabel)}</span></td>
                <td style="font-size:11px;color:var(--txt-3);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeAttr(o.void_note || "")}">${escapeHtml(o.void_note || "—")}</td>
                <td class="mono" style="font-size:11px;color:var(--txt-3);">${escapeHtml(voidedShort)}${o.voided_by?"<br>by "+escapeHtml(nameOf(o.voided_by)):""}</td>
                <td style="text-align:right;white-space:nowrap;">
                  <form method="post" action="/admin/orders/${encodeURIComponent(o.id)}/unvoid?back=${encodeURIComponent(backUrl)}" style="display:inline-block;margin:0;">
                    <button type="submit" class="sf-btn sm" onclick="return confirm('取消作廢「${escapeAttr(o.order_no || o.id)}」並恢復為待確認？');" title="取消作廢，恢復為待確認">↶ 取消作廢</button>
                  </form>
                  <a class="sf-btn sm" href="/admin/orders/${encodeURIComponent(o.id)}?back=${encodeURIComponent(backUrl)}">明細</a>
                </td>
              </tr>`;
            }).join("");
            const filterLink = onlyNeedReview
                ? `<a href="/admin/orders?date_from=${escapeAttr(filterDateFrom)}&date_to=${escapeAttr(filterDateTo)}">顯示全部訂單</a>`
                : `<a href="/admin/orders?need_review=1&date_from=${escapeAttr(filterDateFrom)}&date_to=${escapeAttr(filterDateTo)}">只看有待確認的訂單</a>`;
            const usingCloudSqlOrders = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
            const orderListDbWarning = usingCloudSqlOrders ? "" : `<p class="notion-msg err" style="margin-bottom:12px;">目前未連線 Cloud SQL，資料不會長期保留，收單後可能看不到或重開就消失。請在 Cloud Run 設定 <strong>DATABASE_URL</strong>。</p>`;
            // 統計
            const totalShown = orders.length;
            const approvedCount = orders.filter(o => String(o.status||"").toLowerCase() === "approved").length;
            // 品項待對應：與 /admin/review 一致，全庫 need_review=1 的訂單明細數（排除已作廢訂單）
            let needReviewSum = 0;
            try {
                const r = await db.prepare(
                    "SELECT COUNT(*) AS c FROM order_items oi JOIN orders o ON o.id = oi.order_id " +
                    "WHERE oi.need_review = 1 AND oi.voided_at IS NULL AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint')"
                ).get();
                needReviewSum = Number(r?.c) || 0;
            } catch (_) { /* fallback 為 0 */ }
            const pendingCount = totalShown - approvedCount;
            // ── 兩欄版型（sf3 cols2）：欄1＝出貨日月曆（每日單量·未確認數），欄2＝原內容 ──
            const keepQ = (onlyNeedReview ? "&need_review=1" : "") + (statusFilter ? "&status=" + encodeURIComponent(statusFilter) : "");
            const singleDay = filterDateFrom === filterDateTo;
            const calM = /^\d{4}-\d{2}$/.test(String(req.query.cal || "")) ? String(req.query.cal) : filterDateFrom.slice(0, 7);
            const dayCounts = new Map(); // date -> {n:單數, p:未確認數}
            try {
                for (const r of (await db.prepare("SELECT order_date AS d, COUNT(*) AS n, SUM(CASE WHEN COALESCE(LOWER(TRIM(status)),'') <> 'approved' THEN 1 ELSE 0 END) AS p FROM orders WHERE order_date >= ? AND order_date <= ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') GROUP BY order_date").all(calM + "-01", calM + "-31")) || [])
                    dayCounts.set(String(r.d), { n: Number(r.n || 0), p: Number(r.p || 0) });
            } catch (_) { }
            try {
                for (const r of (await db.prepare("SELECT order_date AS d, COUNT(*) AS n FROM logistics_orders WHERE order_date >= ? AND order_date <= ? GROUP BY order_date").all(calM + "-01", calM + "-31")) || []) {
                    const k = String(r.d);
                    const a = dayCounts.get(k) || { n: 0, p: 0 };
                    a.n += Number(r.n || 0);
                    dayCounts.set(k, a);
                }
            } catch (_) { }
            const sf3Cal = (() => {
                const [cy, cm] = calM.split("-").map(Number);
                const daysInMonth = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
                const firstWd = new Date(Date.UTC(cy, cm - 1, 1)).getUTCDay(); // 0=日
                const fmtM = (dt) => dt.getUTCFullYear() + "-" + String(dt.getUTCMonth() + 1).padStart(2, "0");
                const prevM = fmtM(new Date(Date.UTC(cy, cm - 2, 1)));
                const nextM = fmtM(new Date(Date.UTC(cy, cm, 1)));
                const rangeQ = `date_from=${encodeURIComponent(filterDateFrom)}&date_to=${encodeURIComponent(filterDateTo)}`;
                let h = `<div class="sf3-cal"><div class="sf3-cal-head">
                    <a class="sf3-cal-nav" href="/admin/orders?${rangeQ}${keepQ}&cal=${prevM}" title="上個月">‹</a>
                    <span>${cy} 年 ${cm} 月</span>
                    <a class="sf3-cal-nav" href="/admin/orders?${rangeQ}${keepQ}&cal=${nextM}" title="下個月">›</a>
                  </div><div class="sf3-cal-grid">`;
                h += "日一二三四五六".split("").map((w) => `<span class="sf3-cal-wd">${w}</span>`).join("");
                for (let i = 0; i < firstWd; i++) h += "<span></span>";
                for (let d = 1; d <= daysInMonth; d++) {
                    const ds = calM + "-" + String(d).padStart(2, "0");
                    const c = dayCounts.get(ds);
                    const cls = (singleDay && filterDateFrom === ds ? " on" : "") + (ds === today ? " today" : "");
                    const cnt = c ? `<span class="c ${c.p > 0 ? "warn" : ""}" title="${c.n} 單${c.p ? "，" + c.p + " 未確認" : ""}">${c.n}</span>` : `<span class="c">&nbsp;</span>`;
                    h += `<a class="sf3-cal-d${cls}" href="/admin/orders?date_from=${ds}&date_to=${ds}${keepQ}&cal=${calM}" title="${ds}${c ? `：${c.n} 單${c.p ? "、" + c.p + " 未確認" : ""}` : ""}"><span class="n">${d}</span>${cnt}</a>`;
                }
                h += `</div><div class="sf3-cal-foot"><a href="/admin/orders?date_from=${today}&date_to=${today}${keepQ}&cal=${today.slice(0, 7)}">回今天</a>${!singleDay ? `<span style="font-size:11px;color:var(--txt-3);display:block;margin-top:3px;">目前查詢區間 ${escapeHtml(filterDateFrom.slice(5))}～${escapeHtml(filterDateTo.slice(5))}</span>` : ""}</div></div>`;
                return h;
            })();
            const statCard = (label, num, status, href) => `
              <a href="${href || "#"}" style="text-decoration:none;color:inherit;padding:10px 16px;background:var(--bg-1);border:var(--hairline);border-radius:var(--radius-md);flex:1;display:flex;align-items:center;gap:10px;min-width:140px;">
                <span class="sf-dot ${status}"></span>
                <div>
                  <div style="font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">${label}</div>
                  <div class="mono" style="font-size:18px;font-weight:600;">${num}</div>
                </div>
              </a>`;
            const body = `
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css">
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="sf-breadcrumb" style="margin-bottom:6px;">日常作業 / 訂單審核</div>
              <h1 style="margin:0;font-size:22px;font-weight:600;">訂單審核</h1>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a class="sf-btn" href="/admin/review">${SF_ICONS.warn}<span>待確認品名</span></a>
              <a class="sf-btn" href="/admin/export">${SF_ICONS.dl}<span>資料匯出</span></a>
              <a class="sf-btn primary" href="/admin/logistics/orders/new">${SF_ICONS.plus}<span>新增訂單</span></a>
            </div>
          </div>
          ${orderListDbWarning}
          ${req.query.ok === "log_saved" ? "<div class=\"sf-pill ok\" style=\"align-self:flex-start;\">已儲存紙本訂單</div>" : ""}
          ${req.query.ok === "seq" ? "<div class=\"sf-pill ok\" style=\"align-self:flex-start;\">已儲存本日起始編號</div>" : ""}
          ${req.query.ok === "del" ? "<div class=\"sf-pill ok\" style=\"align-self:flex-start;\">已將選取訂單作廢（移到「已作廢」清單）</div>" : ""}
          ${req.query.ok === "approved" ? "<div class=\"sf-pill ok\" style=\"align-self:flex-start;\">已將選取訂單標記為已確認</div>" : ""}
          ${req.query.ok === "date" ? "<div class=\"sf-pill ok\" style=\"align-self:flex-start;\">已將選取訂單改到新出貨日（訂單編號不變）</div>" : ""}
          ${req.query.err === "baddate" ? "<div class=\"sf-pill bad\" style=\"align-self:flex-start;\">改出貨日失敗：請確認已勾選訂單並選了有效日期</div>" : ""}
          ${req.query.ok === "approved_done" ? "<div class=\"sf-pill ok\" style=\"align-self:flex-start;\">" + SF_ICONS.spark + "全部待確認都處理完了</div>" : ""}
          ${req.query.err === "none" ? "<div class=\"sf-pill bad\" style=\"align-self:flex-start;\">請先勾選要處理的訂單</div>" : ""}
          <div class="sf3-grid cols2">
            <div class="sf3-col">
              <div class="sf3-col-h">出貨日</div>
              ${sf3Cal}
            </div>
            <div style="min-width:0;display:flex;flex-direction:column;gap:16px;">
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            ${statCard("總訂單", totalShown, "ok", "#")}
            ${statCard("待簽核", pendingCount, pendingCount>0?"warn":"ok", "#")}
            ${statCard("已確認", approvedCount, "ok", "#")}
            ${statCard("品項待對應", needReviewSum, needReviewSum>0?"warn":"ok", "/admin/review")}
            ${statCard("已作廢", deletedOrders.length, deletedOrders.length>0?"bad":"info", "#")}
          </div>
          <div class="sf-card">
            <div class="sf-card-body" style="padding:14px 16px;">
              <form id="ordersFilterForm" method="get" action="/admin/orders" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
                ${onlyNeedReview ? '<input type="hidden" name="need_review" value="1">' : ""}
                <input type="hidden" name="date_from" id="ordersDateFrom" value="${escapeAttr(filterDateFrom)}">
                <input type="hidden" name="date_to" id="ordersDateTo" value="${escapeAttr(filterDateTo)}">
                <label class="sf-label" style="margin:0;display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13px;color:var(--txt-2);">
                  日期區間
                  <input type="text" id="ordersDateRange" readonly placeholder="點選日期" autocomplete="off" style="width:240px;height:36px;padding:0 10px;border:1px solid var(--line-2);border-radius:var(--radius);background:var(--bg-2);color:var(--txt-1);cursor:pointer;font-size:13px;">
                </label>
                <button type="button" class="sf-btn" id="ordersPrevRange" title="向前一天">← 前一日</button>
                <button type="button" class="sf-btn" id="ordersNextRange" title="向後一天">後一日 →</button>
                <button type="submit" class="sf-btn primary">${SF_ICONS.search}<span>查詢</span></button>
                <a class="sf-btn ghost" href="${onlyNeedReview ? "/admin/orders?need_review=1" : "/admin/orders"}">重設</a>
                <div style="flex:1;"></div>
                <a class="sf-btn ghost" href="${onlyNeedReview ? `/admin/orders?date_from=${escapeAttr(filterDateFrom)}&date_to=${escapeAttr(filterDateTo)}` : `/admin/orders?need_review=1&date_from=${escapeAttr(filterDateFrom)}&date_to=${escapeAttr(filterDateTo)}`}">${onlyNeedReview ? "顯示全部" : "只看待確認"}</a>
              </form>
            </div>
          </div>
          <!-- 起始流水號設定區塊：依老闆指示暫時關閉（2026-07-05，出貨日不再與流水號綁定）。程式碼保留在 git 歷史，需要時可還原。 -->
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <div style="position:relative;flex:0 0 240px;">
              <input class="sf-input" id="orderFilterCustomer" placeholder="篩選：客戶名稱" autocomplete="off" style="padding-left:28px;">
              <span style="position:absolute;left:8px;top:10px;color:var(--txt-3);">${SF_ICONS.users}</span>
            </div>
            <select class="sf-input" id="orderFilterRoute" style="flex:0 0 140px;" title="依揀貨路線篩選">
              <option value="">全部路線</option>
              ${[1,2,3,4,5,6,7,8,9].map((n) => `<option value="${n}">${n} 號線</option>`).join("")}
              <option value="__none__">未指定路線</option>
            </select>
            <select class="sf-input" id="orderStatusNav" style="flex:0 0 130px;" title="依狀態篩選（會重新查詢）"
              onchange="location.href='/admin/orders?date_from=${escapeAttr(filterDateFrom)}&date_to=${escapeAttr(filterDateTo)}'+(this.value?'&status='+this.value:'')${onlyNeedReview ? "+'&need_review=1'" : ""}">
              <option value="">全部狀態</option>
              <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>待簽核</option>
              <option value="approved" ${statusFilter === "approved" ? "selected" : ""}>已確認</option>
            </select>
            <div style="flex:1;"></div>
            <form id="batchOrderActionsForm" method="post" action="/admin/orders/batch-delete" style="display:none;margin:0;">
              <input type="hidden" name="void_reason" id="batchVoidReason" value="">
              <input type="hidden" name="void_note" id="batchVoidNote" value="">
            </form>
            <!-- 勾選訂單後才浮出的操作列（toast bar），減少上方常駐按鈕 -->
            <div id="orderBatchBar" style="display:none;position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:1100;background:var(--bg-1,#fff);border:1px solid var(--notion-border,#e3e2e0);box-shadow:0 8px 28px rgba(15,23,42,.18);border-radius:14px;padding:10px 14px;align-items:center;gap:8px;flex-wrap:wrap;max-width:calc(100vw - 24px);">
              <span style="font-size:13px;color:var(--txt-2);white-space:nowrap;">已選 <strong id="obbCount">0</strong> 筆</span>
              <button type="button" class="sf-btn sm primary" id="btnBatchApprove">${SF_ICONS.check}<span>確認</span></button>
              <button type="button" class="sf-btn sm" id="btnBatchChangeDate"><span>${sfInlineIcon('calendar')}改出貨日</span></button>
              <button type="button" class="sf-btn sm" id="btnBatchOrderSheet">${SF_ICONS.dl}<span>揀貨單</span></button>
              <button type="button" class="sf-btn sm" id="btnBatchLingyueXlsx">${SF_ICONS.dl}<span>凌越 Excel</span></button>
              <button type="button" class="sf-btn sm danger" id="btnBatchVoid">${SF_ICONS.x}<span>作廢</span></button>
              <button type="button" class="sf-btn sm ghost" id="orderSelectNone2" title="清除選取">✕</button>
            </div>
            <!-- 改出貨日 modal -->
            <div id="changeDateModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1200;align-items:center;justify-content:center;padding:20px;">
              <div style="background:var(--bg-1,#fff);border-radius:14px;padding:20px;max-width:360px;width:100%;box-shadow:0 12px 32px rgba(0,0,0,.25);">
                <div style="font-weight:600;font-size:15px;margin-bottom:6px;">改出貨日</div>
                <div style="font-size:12px;color:var(--txt-3);margin-bottom:14px;">已選 <span id="cdCount">0</span> 筆訂單，改到下面這個出貨日（訂單編號不變）。</div>
                <input type="date" id="cdDate" class="sf-input" style="width:100%;">
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px;">
                  <button type="button" class="sf-btn" id="cdCancel">取消</button>
                  <button type="button" class="sf-btn primary" id="cdConfirm">確定改期</button>
                </div>
              </div>
            </div>
            <!-- 批次作廢 modal：與訂單明細「作廢此訂單」共用同一組原因選單（voidReasonModalHtml） -->
            ${voidReasonModalHtml({ prefix: "batchVoid", title: "批次作廢訂單" })}
            <script>
            (function(){
              const btn = document.getElementById("btnBatchVoid");
              if (!btn) return;
              btn.addEventListener("click", function(){
                const checked = document.querySelectorAll('input.order-batch-cb:checked').length;
                if (!checked) { alert("請先勾選要作廢的訂單"); return; }
                window.batchVoidModalOpen("將作廢 <strong>" + checked + "</strong> 筆訂單。選擇作廢原因（會記住下一次預設），可由「已作廢訂單」恢復。");
              });
              window.batchVoidModalSubmit = function(reason, note){
                document.getElementById("batchVoidReason").value = reason;
                document.getElementById("batchVoidNote").value = note;
                document.getElementById("batchOrderActionsForm").submit();
              };
            })();
            </script>
          </div>
          ${ordersHitLimit ? `<p class="notion-msg" style="margin:0;background:#fef9c3;color:#854d0e;border:1px solid #fde047;">⚠ 已達 300 筆顯示上限，可能有訂單未列出——請縮小日期區間。</p>` : ""}
          <div class="sf-table-wrap">
            <table class="sf-table">
              <thead>
                <tr>
                  <th style="width:36px;"><input type="checkbox" id="orderSelectAllCb" title="全選"></th>
                  <th style="width:24px;"></th>
                  <th>叫貨時間</th>
                  <th>出貨日</th>
                  <th>客戶</th>
                  <th>路線</th>
                  <th>來源</th>
                  <th>品項</th>
                  <th>狀態</th>
                  <th style="text-align:right;width:80px;"></th>
                </tr>
              </thead>
              <tbody>${rows.length ? rows : `<tr><td colspan='10' style='padding:32px;text-align:center;color:var(--txt-3);'>所選日期區間內無訂單</td></tr>`}</tbody>
            </table>
          </div>
          ${deletedOrders.length ? `<details class="sf-card">
            <summary style="padding:12px 16px;cursor:pointer;font-size:13px;color:var(--txt-2);list-style:none;display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:var(--txt-3);">▸</span>
              <span>已作廢訂單（${deletedOrders.length}）</span>
            </summary>
            <div class="sf-table-wrap" style="border-top:var(--hairline);border-radius:0;">
              <table class="sf-table">
                <thead><tr><th style="width:24px;"></th><th>訂單編號</th><th>出貨日</th><th>客戶</th><th>作廢原因</th><th>備註</th><th>作廢時間</th><th style="text-align:right;"></th></tr></thead>
                <tbody>${deletedRows}</tbody>
              </table>
            </div>
          </details>` : ""}
            </div>
          </div>
        </div>
          <script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js"></script>
          <script>
          (function(){
            // 點勾選欄／狀態圓點欄（附近）→ 切換勾選，不進明細；點其他列區域才進明細
            document.addEventListener("click", function(e){
              var cbCell = e.target.closest("td.order-cb-cell");
              if (cbCell) {
                if (!e.target.closest("input")) {
                  var cb = cbCell.parentNode && cbCell.parentNode.querySelector("input.order-batch-cb");
                  if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event("change", { bubbles: true })); }
                }
                return;
              }
              if (e.target.closest("a, button, input, select, textarea, label")) return;
              var tr = e.target.closest("tr.order-row[data-href]");
              if (!tr) return;
              var href = tr.getAttribute("data-href");
              if (href) window.location.href = href;
            });
          })();
          (function(){
            function allCbs(){ return document.querySelectorAll(".order-batch-cb"); }
            // [fix 2026-07-08] 只作用在「目前可見」的列（被篩選隱藏的列 offsetParent 為 null），
            // 全選不再勾到看不見的訂單。
            function cbVisible(c){ var tr = c.closest("tr"); return !!(tr && tr.offsetParent !== null); }
            function visibleCbs(){ return Array.prototype.filter.call(allCbs(), cbVisible); }
            var allEl = document.getElementById("orderSelectAllCb");
            if (allEl) allEl.addEventListener("change", function(){ visibleCbs().forEach(function(c){ c.checked = allEl.checked; }); updateBar(); });
            var b1 = document.getElementById("orderSelectAll");
            var b2 = document.getElementById("orderSelectNone");
            var b2b = document.getElementById("orderSelectNone2");
            var batchBar = document.getElementById("orderBatchBar");
            var obbCount = document.getElementById("obbCount");
            var selHint = document.getElementById("batchSelectedHint");
            function countChecked(){ var n = 0; allCbs().forEach(function(c){ if (c.checked && cbVisible(c)) n++; }); return n; }
            function updateBar(){
              var n = countChecked();
              if (obbCount) obbCount.textContent = n;
              if (selHint) selHint.textContent = n ? ("已選 " + n + " 筆") : "未選";
              if (batchBar) batchBar.style.display = n ? "flex" : "none";
            }
            function clearSel(){ allCbs().forEach(function(c){ c.checked = false; }); if (allEl) allEl.checked = false; updateBar(); }
            if (b1) b1.onclick = function(){ visibleCbs().forEach(function(c){ c.checked = true; }); if (allEl) allEl.checked = true; updateBar(); };
            if (b2) b2.onclick = clearSel;
            if (b2b) b2b.onclick = clearSel;
            document.addEventListener("change", function(e){ if (e.target && e.target.classList && e.target.classList.contains("order-batch-cb")) updateBar(); });
            updateBar();
            function selectedIds(){
              var a = [];
              allCbs().forEach(function(c){ if (c.checked && cbVisible(c)) a.push(c.value); });
              return a;
            }
            function openBatch(kind){
              var ids = selectedIds();
              if (!ids.length) { alert("請先勾選訂單"); return; }
              if (kind === "sheet") {
                var formSheet = document.createElement("form");
                formSheet.method = "post";
                formSheet.action = "/admin/orders/batch-order-sheet";
                ids.forEach(function(id){
                  var inp = document.createElement("input");
                  inp.type = "hidden";
                  inp.name = "order_ids";
                  inp.value = id;
                  formSheet.appendChild(inp);
                });
                document.body.appendChild(formSheet);
                formSheet.submit();
                document.body.removeChild(formSheet);
                return;
              }
              /* 凌越：一律 POST，避免 GET 網址過長被瀏覽器／Proxy／Cloud Run 截斷導致匯出失敗 */
              var form = document.createElement("form");
              form.method = "post";
              form.action = "/admin/orders/batch-lingyue-xlsx";
              ids.forEach(function(id){
                var inp = document.createElement("input");
                inp.type = "hidden";
                inp.name = "order_ids";
                inp.value = id;
                form.appendChild(inp);
              });
              document.body.appendChild(form);
              form.submit();
              document.body.removeChild(form);
            }
            var bs = document.getElementById("btnBatchOrderSheet");
            var bl = document.getElementById("btnBatchLingyueXlsx");
            var ba = document.getElementById("btnBatchApprove");
            if (bs) bs.onclick = function(){ openBatch("sheet"); };
            if (bl) bl.onclick = function(){ openBatch("xlsx"); };
            if (ba) ba.onclick = function(){
              var ids = selectedIds();
              if (!ids.length) { alert("請先勾選訂單"); return; }
              if (!confirm("確定將勾選訂單標記為已確認？")) return;
              var form = document.createElement("form");
              form.method = "post";
              form.action = "/admin/orders/batch-approve";
              ids.forEach(function(id){
                var i = document.createElement("input");
                i.type = "hidden"; i.name = "order_ids"; i.value = id;
                form.appendChild(i);
              });
              document.body.appendChild(form);
              form.submit();
            };
            // 改出貨日：開 modal → 送出到 batch-change-date（只改 order_date，訂單編號不變）
            var bcd = document.getElementById("btnBatchChangeDate");
            var cdModal = document.getElementById("changeDateModal");
            var cdDate = document.getElementById("cdDate");
            var cdCount = document.getElementById("cdCount");
            if (bcd && cdModal) {
              bcd.onclick = function(){
                var ids = selectedIds();
                if (!ids.length) { alert("請先勾選訂單"); return; }
                if (cdCount) cdCount.textContent = ids.length;
                var d = new Date(); d.setDate(d.getDate() + 1);
                if (cdDate) cdDate.value = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
                cdModal.style.display = "flex";
              };
              var cdCancel = document.getElementById("cdCancel");
              if (cdCancel) cdCancel.onclick = function(){ cdModal.style.display = "none"; };
              cdModal.addEventListener("click", function(e){ if (e.target === cdModal) cdModal.style.display = "none"; });
              var cdConfirm = document.getElementById("cdConfirm");
              if (cdConfirm) cdConfirm.onclick = function(){
                var ids = selectedIds();
                if (!ids.length) { alert("請先勾選訂單"); return; }
                var nd = cdDate ? cdDate.value : "";
                if (!nd || nd.length !== 10) { alert("請選擇有效的出貨日"); return; }
                var form = document.createElement("form");
                form.method = "post"; form.action = "/admin/orders/batch-change-date";
                ids.forEach(function(id){ var i = document.createElement("input"); i.type = "hidden"; i.name = "order_ids"; i.value = id; form.appendChild(i); });
                var di = document.createElement("input"); di.type = "hidden"; di.name = "new_date"; di.value = nd; form.appendChild(di);
                document.body.appendChild(form); form.submit();
              };
            }
            var df = document.getElementById("ordersDateFrom");
            var dt = document.getElementById("ordersDateTo");
            var rangeInp = document.getElementById("ordersDateRange");
            var filterForm = document.getElementById("ordersFilterForm");
            function pad2(n){ return n < 10 ? "0" + n : String(n); }
            function fmtYMD(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
            if (typeof flatpickr !== "undefined" && rangeInp && df && dt && filterForm) {
              var fp = flatpickr(rangeInp, {
                mode: "range",
                dateFormat: "Y-m-d",
                defaultDate: [df.value, dt.value],
                allowInput: false,
                onChange: function(selectedDates){
                  if (selectedDates.length >= 1) {
                    df.value = fmtYMD(selectedDates[0]);
                    dt.value = selectedDates.length >= 2 ? fmtYMD(selectedDates[1]) : fmtYMD(selectedDates[0]);
                  }
                }
              });
              function shiftRange(delta){
                var d1 = new Date(df.value + "T12:00:00");
                var d2 = new Date(dt.value + "T12:00:00");
                if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return;
                d1.setDate(d1.getDate() + delta);
                d2.setDate(d2.getDate() + delta);
                df.value = fmtYMD(d1);
                dt.value = fmtYMD(d2);
                fp.setDate([df.value, dt.value], true);
                filterForm.submit();
              }
              var prevB = document.getElementById("ordersPrevRange");
              var nextB = document.getElementById("ordersNextRange");
              if (prevB) prevB.onclick = function(){ shiftRange(-1); };
              if (nextB) nextB.onclick = function(){ shiftRange(1); };
            }
            function applyListFilters(){
              var qNo = (document.getElementById("orderFilterOrderNo") && document.getElementById("orderFilterOrderNo").value || "").toLowerCase().trim();
              var qCust = (document.getElementById("orderFilterCustomer") && document.getElementById("orderFilterCustomer").value || "").toLowerCase().trim();
              var qRoute = (document.getElementById("orderFilterRoute") && document.getElementById("orderFilterRoute").value || "").trim();
              var exactCust = String(window.__sf3Cust || ""); // 三欄客戶欄選取＝精確比對
              document.querySelectorAll("tr.order-row").forEach(function(tr){
                var no = (tr.getAttribute("data-orderno") || "").toLowerCase();
                var cust = (tr.getAttribute("data-cust") || "").toLowerCase();
                var route = (tr.getAttribute("data-route") || "").trim();
                var okNo = !qNo || no.indexOf(qNo) >= 0;
                var okCust = (!qCust || cust.indexOf(qCust) >= 0) && (!exactCust || (tr.getAttribute("data-cust") || "") === exactCust);
                var okRoute = !qRoute || (qRoute === "__none__" ? route === "" : route === qRoute);
                var show = okNo && okCust && okRoute;
                tr.style.display = show ? "" : "none";
                // [fix 2026-07-08] 被篩選隱藏的列一律取消勾選，避免批次作廢/確認/改期
                // 波及使用者看不到的訂單。dispatch change 讓批次列與計數同步更新。
                if (!show) {
                  var _cb = tr.querySelector("input.order-batch-cb");
                  if (_cb && _cb.checked) { _cb.checked = false; _cb.dispatchEvent(new Event("change", { bubbles: true })); }
                }
              });
            }
            var fo = document.getElementById("orderFilterOrderNo");
            var fc = document.getElementById("orderFilterCustomer");
            var fr = document.getElementById("orderFilterRoute");
            if (fo) fo.addEventListener("input", applyListFilters);
            if (fc) fc.addEventListener("input", applyListFilters);
            if (fr) fr.addEventListener("change", applyListFilters);
            // 即時統計勾選數
            function updateSelectedHint(){
              var n = document.querySelectorAll(".order-batch-cb:checked").length;
              var h = document.getElementById("batchSelectedHint");
              if (h) h.textContent = n > 0 ? "已選 " + n + " 筆" : "未選";
            }
            document.addEventListener("change", function(e){ if (e.target && e.target.classList && e.target.classList.contains("order-batch-cb")) updateSelectedHint(); });
            ["orderSelectAll","orderSelectNone","orderSelectAllCb"].forEach(function(id){ var el = document.getElementById(id); if (el) el.addEventListener("click", function(){ setTimeout(updateSelectedHint, 0); }); });
          })();
          </script>
        <div id="lyTransferModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:flex-start;justify-content:center;padding:32px 16px;overflow:auto;">
          <div class="sf-card" style="max-width:640px;width:100%;margin:auto;" onclick="event.stopPropagation();">
            <div class="sf-card-head">
              <div class="sf-card-title">↩ 轉入凌越 <span id="lyTransferOrderNo" class="sf-pill"></span></div>
              <button type="button" class="sf-btn sm ghost" id="lyTransferClose" title="關閉">✕</button>
            </div>
            <div style="padding:14px 16px;">
              <div id="lyTransferLoading" style="color:var(--txt-3);font-size:13px;">讀取中…</div>
              <div id="lyTransferContent" style="display:none;"></div>
            </div>
            <div style="padding:12px 16px;border-top:var(--hairline);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <span id="lyTransferMsg" style="font-size:12px;color:var(--txt-3);flex:1;min-width:180px;"></span>
              <div style="display:flex;gap:8px;">
                <button type="button" class="sf-btn sm ghost" id="lyTransferCancel">關閉</button>
                <button type="button" class="sf-btn sm primary" id="lyTransferConfirm" disabled>確認轉入</button>
              </div>
            </div>
          </div>
        </div>
        <script>
        (function(){
          var modal = document.getElementById("lyTransferModal");
          if (!modal) return;
          var titleNo = document.getElementById("lyTransferOrderNo");
          var loading = document.getElementById("lyTransferLoading");
          var content = document.getElementById("lyTransferContent");
          var msg = document.getElementById("lyTransferMsg");
          var confirmBtn = document.getElementById("lyTransferConfirm");
          var curId = null;
          function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
          function openModal(){ modal.style.display="flex"; document.body.style.overflow="hidden"; }
          function closeModal(){ modal.style.display="none"; document.body.style.overflow=""; }
          function renderPreview(d){
            if (!d || d.ok === false) { loading.textContent = "讀取失敗：" + ((d && d.error) || ""); return; }
            var rows = (d.items||[]).map(function(it){
              var code = it.product_code ? '<span class="mono">'+esc(it.product_code)+'</span>' : '<span style="color:#b91c1c;font-weight:700;">缺料號</span>';
              return '<tr><td style="font-size:12px;">'+code+'</td><td>'+esc(it.product_name)+'</td><td style="text-align:right;">'+esc(it.quantity)+'</td><td>'+esc(it.unit)+'</td></tr>';
            }).join("");
            var custCode = d.customer_code ? '<span class="mono">('+esc(d.customer_code)+')</span>' : '<span style="color:#b91c1c;">（缺凌越編號）</span>';
            var head = '<div style="font-size:12px;color:var(--txt-2);margin-bottom:8px;">客戶：'+esc(d.customer_name)+' '+custCode+' · 出貨日 '+esc(d.order_date)+'</div>';
            var warn = "";
            if (d.missing_count > 0) warn += '<div class="sf-pill warn" style="margin:0 0 8px;display:inline-block;">有 '+d.missing_count+' 項缺凌越料號，這些列凌越收不進去，請先到明細補料號</div>';
            if (!d.customer_code) warn += '<div class="sf-pill bad" style="margin:0 0 8px;display:inline-block;">此客戶缺凌越編號（HQCustCode），請先到客戶編輯補上</div>';
            content.innerHTML = head + warn + '<div style="overflow-x:auto;"><table class="sf-table" style="font-size:12px;"><thead><tr><th>凌越料號</th><th>品名</th><th style="text-align:right;">數量</th><th>單位</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4" style="text-align:center;color:var(--txt-3);padding:16px;">無可轉入品項</td></tr>')+'</tbody></table></div>';
            content.style.display="block"; loading.style.display="none";
            confirmBtn.disabled = !(d.items && d.items.length);
          }
          document.querySelectorAll(".lingyue-transfer-btn").forEach(function(btn){
            btn.addEventListener("click", function(){
              curId = this.dataset.id;
              titleNo.textContent = this.dataset.orderno || "";
              loading.style.display="block"; loading.textContent="讀取中…"; content.style.display="none"; content.innerHTML="";
              msg.textContent=""; confirmBtn.disabled=true;
              openModal();
              fetch("/admin/orders/"+encodeURIComponent(curId)+"/lingyue-preview", {method:"POST", credentials:"same-origin"})
                .then(function(r){ return r.json(); }).then(renderPreview)
                .catch(function(){ loading.textContent="讀取失敗，請重試。"; });
            });
          });
          function lySubmit(force){
            confirmBtn.disabled=true; msg.textContent="轉入中…";
            fetch("/admin/orders/"+encodeURIComponent(curId)+"/lingyue-transfer"+(force?"?force=1":""), {method:"POST", credentials:"same-origin"})
              .then(function(r){ return r.json(); })
              .then(function(res){
                if (res && res.ok && res.doc_no) { msg.textContent = "✅ 已轉入凌越，單據號 " + res.doc_no + "，即將重新整理…"; setTimeout(function(){ location.reload(); }, 1200); }
                else if (res && res.queued) { msg.textContent = "✅ " + (res.message || "已排入凌越匯入佇列，數秒內自動完成…") + " 稍候自動重新整理。"; setTimeout(function(){ location.reload(); }, 6000); }
                else if (res && res.needConfirm) { if (window.confirm(res.message || "此單已轉入凌越，確定要重新轉入嗎？請先到凌越刪除舊單。")) { lySubmit(true); } else { msg.textContent="已取消重新轉入。"; confirmBtn.disabled=false; } }
                else if (res && res.mode === "preview") { msg.textContent = "ℹ️ " + (res.message || "這台無法直接寫入凌越，僅顯示料號預覽。"); confirmBtn.disabled=false; }
                else { msg.textContent = "❌ " + ((res && res.error) || "轉入失敗"); confirmBtn.disabled=false; }
              })
              .catch(function(){ msg.textContent="❌ 轉入失敗，請重試。"; confirmBtn.disabled=false; });
          }
          confirmBtn.addEventListener("click", function(){ if (!curId) return; lySubmit(false); });
          document.getElementById("lyTransferClose").addEventListener("click", closeModal);
          document.getElementById("lyTransferCancel").addEventListener("click", closeModal);
          modal.addEventListener("click", function(e){ if (e.target===modal) closeModal(); });
          document.addEventListener("keydown", function(e){ if (e.key==="Escape" && modal.style.display==="flex") closeModal(); });
        })();
        </script>
      `;
            res.type("text/html").send(notionPage("訂單審核", body, "orders", res));
        }
        catch (e) {
            const errMsg = (e?.message || String(e)).slice(0, 500);
            console.error("[admin] GET /orders 錯誤:", errMsg, e?.stack);
            res.status(500).type("text/html").send(`
        <!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>訂單審核錯誤</title></head>
        <body style="font-family:sans-serif;padding:2rem;max-width:640px;">
          <h1>訂單審核暫時無法使用</h1>
          <p>請稍後再試，或聯絡管理員檢查後台與資料庫連線。</p>
          <p style="margin-top:1rem;padding:10px;background:#f5f5f5;border-radius:6px;font-size:13px;word-break:break-all;"><strong>錯誤訊息：</strong><br>${escapeHtml(errMsg)}</p>
          <p class="notion-hint" style="margin-top:1rem;">若為「column … does not exist」，請確認 Cloud SQL 已執行過最新 schema（含 order_no、order_attachments 等）。</p>
          <p style="margin-top:1rem;"><a href="/admin">回儀表板</a></p>
        </body></html>`);
        }
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
        const item = await db.prepare("SELECT raw_name, product_id AS prev_product_id FROM order_items WHERE id = ? AND order_id = ?").get(itemId, orderId);
        await db.prepare("UPDATE order_items SET product_id = ?, need_review = 0, confidence_score = 100 WHERE id = ? AND order_id = ?").run(productId, itemId, orderId);
        await logDataChange(req, {
            entityType: "order_item_product",
            entityId: itemId,
            productId,
            action: "set_product",
            summary: `後台將訂單明細改對應品項（${(item?.raw_name || "").trim().slice(0, 40) || itemId}）`,
            meta: {
                order_id: orderId,
                customer_id: order.customer_id,
                old_product_id: item?.prev_product_id ?? null,
                new_product_id: productId,
            },
        });
        // G25：記憶範圍由前端確認步驟決定。
        //   scope=none     → 只改這一筆訂單，不寫任何別名/記憶（預設，最保守）
        //   scope=customer → 記住「此客戶」：客戶別名 + 筆跡記憶（不動全公司）
        //   scope=global   → 記住「全公司」：全公司別名 + 客戶別名 + 筆跡記憶
        // 別名一律 UPSERT（已存在但指向不同品項 → 更新），讓「人工最新校正」永遠為準。
        const learnScopeRaw = String(req.body.scope || "none").trim().toLowerCase();
        const learnScope = (learnScopeRaw === "customer" || learnScopeRaw === "global") ? learnScopeRaw : "none";
        const rawNameTrim = item?.raw_name?.trim();
        if (rawNameTrim && learnScope !== "none") {
            // 全公司俗名別名：僅 scope=global 時寫入/更新
            if (learnScope === "global") {
                const existing = await db.prepare("SELECT id, product_id FROM product_aliases WHERE alias = ?").get(rawNameTrim);
                if (!existing) {
                    try {
                        const paId = (0, id_js_1.newId)("pa");
                        await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run(paId, productId, rawNameTrim);
                    }
                    catch (_) { /* 可能重複 */ }
                }
                else if (String(existing.product_id) !== String(productId)) {
                    try {
                        await db.prepare("UPDATE product_aliases SET product_id = ? WHERE id = ?").run(productId, existing.id);
                        console.log("[learn] product_aliases 更新對應 alias=%s %s→%s", rawNameTrim, existing.product_id, productId);
                    }
                    catch (_) { /* 更新失敗不阻擋 */ }
                }
            }
            // 客戶專用別名：scope=customer 或 global 都寫（UPSERT；resolve 時 cpa 優先級最高）
            const existingCpa = await db.prepare("SELECT id, product_id FROM customer_product_aliases WHERE customer_id = ? AND alias = ?").get(order.customer_id, rawNameTrim);
            if (!existingCpa) {
                try {
                    const cpaId = (0, id_js_1.newId)("cpa");
                    await db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(cpaId, order.customer_id, productId, rawNameTrim);
                }
                catch (_) { /* 可能重複 */ }
            }
            else if (String(existingCpa.product_id) !== String(productId)) {
                try {
                    await db.prepare("UPDATE customer_product_aliases SET product_id = ? WHERE id = ?").run(productId, existingCpa.id);
                    console.log("[learn] customer_product_aliases 更新對應 cust=%s alias=%s %s→%s", order.customer_id, rawNameTrim, existingCpa.product_id, productId);
                }
                catch (_) { /* 更新失敗不阻擋 */ }
            }
            try {
                await customer_handwriting_hints_js_1.recordHandwritingHint(db, order.customer_id, rawNameTrim, productId);
            }
            catch (_) { /* 筆跡對照表寫入失敗不阻擋 */ }
        }
        else {
            console.log("[learn] scope=none，只改本筆訂單不記憶 item=%s", itemId);
        }
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest";
        if (wantsJson) {
            res.json({ ok: true, productName: product.name || "", productId: product.id || productId });
            return;
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=product#items");
    });
    router.post("/orders/batch-delete", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        let ids = req.body.order_ids;
        if (ids == null)
            ids = [];
        if (!Array.isArray(ids))
            ids = [ids];
        ids = ids.map((x) => String(x).trim()).filter(Boolean);
        if (!ids.length) {
            res.redirect("/admin/orders?err=none");
            return;
        }
        // 作廢原因（前端 prompt 帶入）
        const validReasons = ["ai_wrong", "customer_complaint", "customer_cancelled", "duplicate", "staff_error", "not_order", "other"];
        const rawReason = String(req.body.void_reason || "other").trim().toLowerCase();
        const reason = validReasons.includes(rawReason) ? rawReason : "other";
        const note = String(req.body.void_note || "").trim().slice(0, 500);
        const actor = req.adminUsername || "system";
        for (const oid of ids.slice(0, 200)) {
            try {
                const before = await db.prepare("SELECT id, order_no, customer_id, order_date, status, raw_message FROM orders WHERE id = ?").get(oid);
                const itemsSnap = await db.prepare("SELECT id, raw_name, quantity, unit, product_id, remark, sub_customer FROM order_items WHERE order_id = ?").all(oid);
                const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + ", voided_at = " + nowSql + ", voided_by = ?, void_reason = ?, void_note = ? WHERE id = ?").run("deleted", actor, reason, note || null, oid);
                await logDataChange(req, {
                    entityType: "order",
                    entityId: oid,
                    action: "soft_delete",
                    summary: `作廢訂單 ${before?.order_no || oid}（${reason}）${note ? "備註：" + note : ""}`,
                    meta: { before, items: itemsSnap, source: "batch-delete", void_reason: reason, void_note: note },
                });
            }
            catch (e) {
                console.error("[admin] batch-delete order", oid, e?.message || e);
            }
        }
        res.redirect("/admin/orders?ok=del&n=" + ids.length);
    });
    router.post("/orders/:orderId/void", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "";
        const validReasons = ["ai_wrong", "customer_complaint", "customer_cancelled", "duplicate", "staff_error", "not_order", "other"];
        const rawReason = String(req.body?.void_reason || "other").trim().toLowerCase();
        const reason = validReasons.includes(rawReason) ? rawReason : "other";
        const note = String(req.body?.void_note || "").trim().slice(0, 500);
        const actor = req.adminUsername || "system";
        const before = await db.prepare("SELECT id, order_no, customer_id, order_date, status, raw_message FROM orders WHERE id = ?").get(orderId);
        if (!before) { res.status(404).send("訂單不存在"); return; }
        if (String(before.status||"").toLowerCase() === "deleted") {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent("此訂單已作廢"));
            return;
        }
        const itemsSnap = await db.prepare("SELECT id, raw_name, quantity, unit, product_id, remark, sub_customer FROM order_items WHERE order_id = ?").all(orderId);
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + ", voided_at = " + nowSql + ", voided_by = ?, void_reason = ?, void_note = ? WHERE id = ?").run("deleted", actor, reason, note || null, orderId);
        await logDataChange(req, {
            entityType: "order",
            entityId: orderId,
            action: "soft_delete",
            summary: `作廢訂單 ${before.order_no || orderId}（${reason}）${note ? "備註：" + note : ""}`,
            meta: { before, items: itemsSnap, source: "detail-page", void_reason: reason, void_note: note },
        });
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=voided" + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
    });
    router.post("/orders/:orderId/unvoid", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "";
        const before = await db.prepare("SELECT id, order_no, status, void_reason FROM orders WHERE id = ?").get(orderId);
        if (!before) { res.status(404).send("訂單不存在"); return; }
        if (String(before.status||"").toLowerCase() !== "deleted") {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent("此訂單未作廢"));
            return;
        }
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        // 取消作廢：status 回 pending、清掉 voided_at/by/reason/note；保留稽核軌跡
        await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + ", voided_at = NULL, voided_by = NULL, void_reason = NULL, void_note = NULL WHERE id = ?").run("pending", orderId);
        await logDataChange(req, {
            entityType: "order",
            entityId: orderId,
            action: "unvoid",
            summary: `取消作廢訂單 ${before.order_no || orderId}（原作廢原因：${before.void_reason || "—"}）`,
            meta: { before },
        });
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=unvoided" + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
    });
    router.post("/orders/batch-approve", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        let ids = req.body.order_ids;
        if (ids == null)
            ids = [];
        if (!Array.isArray(ids))
            ids = [ids];
        ids = ids.map((x) => String(x).trim()).filter(Boolean);
        if (!ids.length) {
            res.redirect("/admin/orders?err=none");
            return;
        }
        const actor = req.adminUsername || "system";
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        for (const oid of ids.slice(0, 200)) {
            try {
                const before = await db.prepare("SELECT order_no, status FROM orders WHERE id = ?").get(oid);
                // [fix 2026-07-14] 與單筆 approve 相同的狀態機守衛：作廢單／客訴單不可被批次確認復活
                // （復活後會回到 /wait 回寫候選，已在凌越人工刪掉的單可能再次寫入）。
                const beforeStatus = String(before?.status || "").toLowerCase().trim();
                if (!before || beforeStatus === "deleted" || beforeStatus === "complaint") {
                    console.warn("[admin] batch-approve 略過（%s）: %s", beforeStatus || "not-found", oid);
                    continue;
                }
                await db.prepare("UPDATE orders SET status = ?, approved_by = ?, approved_at = " + nowSql + " WHERE id = ?").run("approved", actor, oid);
                await logDataChange(req, {
                    entityType: "order",
                    entityId: oid,
                    action: "approve",
                    summary: `批次確認訂單 ${before?.order_no || oid}（前狀態：${before?.status || "－"}）`,
                    meta: { before, source: "batch-approve" },
                });
            }
            catch (e) {
                console.error("[admin] batch-approve order", oid, e?.message || e);
            }
        }
        res.redirect("/admin/orders?ok=approved");
    });
    /** 批次改出貨日：只更新 order_date（把訂單移到新那天的出貨清單），order_no 維持不變。 */
    router.post("/orders/batch-change-date", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        let ids = req.body.order_ids;
        if (ids == null)
            ids = [];
        if (!Array.isArray(ids))
            ids = [ids];
        ids = ids.map((x) => String(x).trim()).filter(Boolean);
        const newDate = String(req.body.new_date || "").trim();
        if (!ids.length || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            res.redirect("/admin/orders?err=baddate");
            return;
        }
        for (const oid of ids.slice(0, 200)) {
            try {
                const before = await db.prepare("SELECT order_no, order_date FROM orders WHERE id = ?").get(oid);
                if (before && String(before.order_date) === newDate)
                    continue;
                await db.prepare("UPDATE orders SET order_date = ? WHERE id = ?").run(newDate, oid);
                await logDataChange(req, {
                    entityType: "order",
                    entityId: oid,
                    action: "update",
                    summary: `批次改出貨日 ${before?.order_no || oid}：${before?.order_date || "?"} → ${newDate}`,
                    meta: { before, new_date: newDate, source: "batch-change-date" },
                });
            }
            catch (e) {
                console.error("[admin] batch-change-date order", oid, e?.message || e);
            }
        }
        res.redirect("/admin/orders?ok=date&date_from=" + encodeURIComponent(newDate) + "&date_to=" + encodeURIComponent(newDate));
    });
    /** 合併揀貨單 HTML；GET／POST 共用。一次最多 50 筆訂單。 */
    async function sendBatchOrderSheetHtml(res, inputIds) {
        const seen = new Set();
        const ids = [];
        for (const x of inputIds || []) {
            const id = String(x || "").trim();
            if (!id || seen.has(id))
                continue;
            seen.add(id);
            ids.push(id);
            if (ids.length >= 50)
                break;
        }
        if (!ids.length) {
            res.status(400).type("text/html").send("<!DOCTYPE html><html><body><p>請先勾選訂單。</p><a href=\"/admin/orders\">回訂單審核</a></body></html>");
            return;
        }
        const orderSheetPrintStyle = `
<style>
.order-sheet-print { font-size: 17pt; color: #111; box-sizing: border-box; }
.order-sheet-print .order-sheet-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
.order-sheet-print .order-sheet-head-L { flex: 1; min-width: 0; }
.order-sheet-print .order-sheet-head-R { flex-shrink: 0; text-align: right; max-width: 48%; }
.order-sheet-print h1 { font-size: 26pt; margin: 0 0 10px; font-weight: 700; letter-spacing: -0.02em; }
.order-sheet-print .os-meta { font-size: 17pt; margin: 0; line-height: 1.45; }
.order-sheet-print table { width: 100%; border-collapse: collapse; font-size: 17pt; table-layout: fixed; }
.order-sheet-print th, .order-sheet-print td { border: 1px solid #333; padding: 5px 5px; vertical-align: top; }
.order-sheet-print th { font-size: 15pt; background: #f5f5f5; font-weight: 600; }
.order-sheet-print th.col-tg { width: 16%; max-width: 32mm; font-size: 11pt; padding: 4px 3px; }
.order-sheet-print td.col-tg { width: 16%; max-width: 32mm; padding: 3px 3px; }
.order-sheet-print .teraoka-compact { display: flex; flex-direction: column; align-items: flex-start; gap: 0; margin: 0; padding: 0; max-width: 100%; }
.order-sheet-print .teraoka-compact-meta { margin: 0; padding: 0; line-height: 1.1; }
.order-sheet-print .teraoka-compact .tc-code { display: block; font-size: 6.5pt; font-weight: 600; color: #222; letter-spacing: -0.02em; word-break: break-all; }
.order-sheet-print .teraoka-compact .tc-name { display: block; font-size: 6.5pt; color: #444; margin: 0; padding: 0; line-height: 1.15; max-height: 2.5em; overflow: hidden; word-break: break-word; }
.order-sheet-print .os-bc-item-img { height: 51px; width: auto; display: block; margin: 0; padding: 0; max-width: 100%; }
.order-sheet-print .os-bc-order-img { height: 56px; width: auto; display: block; margin-left: auto; max-width: 100%; }
.order-sheet-print .order-sheet-bc-label { font-size: 14pt; margin-top: 4px; }
.order-sheet-print .os-cust-bc { height: 84px; width: auto; max-width: 100%; }
.order-sheet-print .order-sheet-inner { width: 100%; max-width: 190mm; margin: 0 auto; padding: 4mm 6mm; }
</style>`;
        const parts = [];
        const renderedIds = []; // [fix 2026-07-08] 只對「真的印出來」的訂單蓋已匯出章
        let firstOrderMeta = null;
        for (let i = 0; i < ids.length; i++) {
            const orderId = ids[i];
            // [fix 2026-07-08] 改 LEFT JOIN：沒選客戶的訂單也要印出來（原 INNER JOIN 會整筆略過），
            // 否則該筆不出現在揀貨稿卻照樣被蓋「已匯出」章 → 倉庫以為處理過 → 這批貨永遠沒被揀。
            const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
            if (!order)
                continue;
            renderedIds.push(orderId);
            if (!firstOrderMeta) {
                firstOrderMeta = { date: order.order_date || new Date().toISOString().slice(0, 10), customer: order.customer_name || "客戶", orderNo: order.order_no || order.id };
            }
            const items = await db.prepare(`
      SELECT oi.quantity, oi.unit, oi.remark, p.erp_code, p.name AS product_name
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1) AND oi.voided_at IS NULL
      ORDER BY COALESCE(oi.display_order, 999999), oi.id
    `).all(orderId);
            const orderNoForBc = (order.order_no && String(order.order_no).trim()) ? String(order.order_no).trim() : order.id;
            const orderBcImg = orderNoForBc
                ? `<div class="order-sheet-head-R"><img src="/admin/barcode?code=${encodeURIComponent(orderNoForBc)}&scale=3&height=12" alt="" class="os-bc-order-img"/><div class="order-sheet-bc-label">${escapeHtml(order.order_no ?? order.id)}</div></div>`
                : "";
            const rows = items.map((it) => {
                const erp = it.erp_code ?? "—";
                const pname = it.product_name ?? "待確認";
                const qty = it.quantity;
                const u = it.unit && it.unit.trim() ? it.unit : "";
                const remark = (it.remark && it.remark.trim()) ? escapeHtml(it.remark.trim()) : "—";
                return `<tr><td>${escapeHtml(erp)}</td><td>${escapeHtml(pname)}</td><td>${qty}</td><td>${escapeHtml(u)}</td><td>${remark}</td></tr>`;
            }).join("");
            const customerBarcode = order.customer_teraoka_code && order.customer_teraoka_code.trim()
                ? `<p style="font-size:17pt;margin-top:12px;"><strong>客戶條碼</strong>（${escapeHtml(order.customer_name)}）<br><img src="/admin/barcode?code=${encodeURIComponent(order.customer_teraoka_code.trim())}&scale=3&height=14" alt="客戶條碼" class="os-cust-bc"></p>`
                : "";
            const brk = i < ids.length - 1 ? "page-break-after:always;" : "";
            parts.push(`
        <div class="order-sheet-batch-block order-sheet-print" style="${brk} margin-bottom:2rem;">
        <div class="order-sheet-inner">
        <div class="order-sheet-head">
          <div class="order-sheet-head-L">
            <h1>訂貨單</h1>
            <p class="os-meta">訂單編號：${escapeHtml(order.order_no ?? "—")}　日期：${escapeHtml(order.order_date)}　客戶：${escapeHtml(order.customer_name || "（未選客戶）")}</p>
          </div>
          ${orderBcImg}
        </div>
          <table>
            <colgroup><col style="width:10%"><col style="width:40%"><col style="width:10%"><col style="width:10%"><col style="width:30%"></colgroup>
            <thead><tr><th>料號</th><th>品名</th><th>數量</th><th>單位</th><th>備註</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='5'>無品項</td></tr>"}</tbody>
          </table>
        ${customerBarcode ? `<div style="margin-top:1rem;">${customerBarcode}</div>` : ""}
        </div>
        </div>`);
        }
        if (!parts.length) {
            res.status(404).type("text/html").send("<!DOCTYPE html><html><body><p>找不到選取的訂單。</p><a href=\"/admin/orders\">回訂單審核</a></body></html>");
            return;
        }
        const tsSheet = new Date().toISOString();
        for (const oid of renderedIds) {
            try {
                await db.prepare("UPDATE orders SET sheet_exported_at = ? WHERE id = ?").run(tsSheet, oid);
            }
            catch (e) {
                console.error("[admin] sheet_exported_at update", oid, e?.message || e);
            }
        }
        const sheetBody = `
        ${orderSheetPrintStyle}
        <p class="no-print notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單審核</a> / 合併揀貨單</p>
        ${parts.join("\n")}
        <p class="no-print" style="margin-top:1rem;"><a href="/admin/orders">← 回訂單審核</a></p>
      `;
        const meta = firstOrderMeta || { date: new Date().toISOString().slice(0, 10), customer: "客戶", orderNo: "01" };
        const safeCustomer = String(meta.customer).replace(/[\\/:*?"<>|]/g, "_").trim() || "客戶";
        const seq = String(meta.orderNo || "01").replace(/[^\d]/g, "").slice(-2) || "01";
        const dlName = `${meta.date}_${safeCustomer}_${seq}_揀貨單.html`;
        const dlAsciiFallback = dlName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
        res.setHeader("Content-Disposition", "attachment; filename=\"" + dlAsciiFallback + "\"; filename*=UTF-8''" + encodeURIComponent(dlName));
        res.type("text/html").send(notionPage("合併揀貨單", sheetBody, "", res));
    }
    router.get("/orders/batch-order-sheet", async (req, res) => {
        const raw = (req.query.ids || "").toString();
        const ids = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        await sendBatchOrderSheetHtml(res, ids);
    });
    /** POST：與凌越 Excel 相同，避免 GET 網址過長被瀏覽器／Proxy／Cloud Run 截斷而回傳 502／503。 */
    router.post("/orders/batch-order-sheet", express_1.default.urlencoded({ extended: true, limit: "2mb" }), async (req, res) => {
        let ids = req.body.order_ids;
        if (ids == null)
            ids = [];
        if (!Array.isArray(ids))
            ids = [ids];
        ids = ids.map((x) => String(x).trim()).filter(Boolean);
        if (!ids.length && typeof req.body.ids === "string") {
            ids = req.body.ids.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        }
        await sendBatchOrderSheetHtml(res, ids);
    });
    /** 凌越 Excel 儲存格：避免 null／不可列印字元導致 xlsx 寫入失敗 */
    function cellForLingyueXlsx(v) {
        if (v == null || v === undefined)
            return "";
        if (typeof v === "number") {
            if (!Number.isFinite(v))
                return "";
            return v;
        }
        if (typeof v === "bigint")
            return String(v);
        let s = String(v);
        if (s.indexOf("\u0000") >= 0)
            s = s.replace(/\u0000/g, "");
        return s;
    }
    /** 訂單日期 → 凌越欄位用 YYYY/MM/DD（DB 可能回傳字串或 Date） */
    /** 下載檔名用日期（僅 YYYY-MM-DD，避免 Date 字串含冒號／斜線） */
    function safeFilenameOrderDate(d) {
        if (d == null || d === "")
            return new Date().toISOString().slice(0, 10);
        if (d instanceof Date)
            return d.toISOString().slice(0, 10);
        const s = String(d).trim();
        const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (iso)
            return iso[1];
        const m = s.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
        if (m)
            return `${m[1]}-${m[2]}-${m[3]}`;
        return new Date().toISOString().slice(0, 10);
    }
    function bufferFromXlsxWrite(buf) {
        if (buf == null)
            throw new Error("Excel 產生失敗（write 未回傳內容）");
        if (Buffer.isBuffer(buf))
            return buf;
        if (buf instanceof Uint8Array)
            return Buffer.from(buf);
        if (buf instanceof ArrayBuffer)
            return Buffer.from(buf);
        return Buffer.from(buf);
    }
    /** 多筆訂單合併為同一個 xlsx：僅第 1 列表頭，明細依訂單順序（每張訂單一個 DocNo）；訂單排序：日期 → 訂單編號 → id */
    async function sendMergedLingyueXlsx(res, inputIds) {
        const seen = new Set();
        const ids = [];
        for (const x of inputIds || []) {
            const id = String(x || "").trim();
            if (!id || seen.has(id))
                continue;
            seen.add(id);
            ids.push(id);
            if (ids.length >= 50)
                break;
        }
        if (!ids.length) {
            res.status(400).type("text/plain").send("請先勾選訂單");
            return;
        }
        try {
            const placeholders = ids.map(() => "?").join(",");
            const sortedRows = await db.prepare(`
      SELECT o.id FROM orders o WHERE o.id IN (${placeholders})
      ORDER BY o.order_date ASC, o.order_no ASC, o.id ASC
    `).all(...ids);
            const sortedIds = (sortedRows || []).map((r) => r.id).filter(Boolean);
            if (!sortedIds.length) {
                res.status(404).type("text/plain").send("找不到勾選的訂單");
                return;
            }
            const header = [
                "OrderDate",
                "DocNo",
                "CustomerCode",
                "",
                "ProductCode",
                "ProductName",
                "Unit",
                "Quantity",
                "ItemNote",
                "DocRemark",
            ];
            const dataRows = [];
            let docSeq = 1;
            for (const orderId of sortedIds) {
                const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.raw_message, c.name AS customer_name, c.hq_cust_code, c.teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
                if (!order)
                    continue;
                const customerCode = (order.hq_cust_code && String(order.hq_cust_code).trim()) || (order.teraoka_code && String(order.teraoka_code).trim()) || "";
                const docRemark = "";
                const docNo = String(docSeq).padStart(4, "0");
                const orderDateLingyue = formatOrderDateForLingyue(order.order_date);
                const items = await db.prepare(`
      SELECT oi.quantity, oi.unit, oi.remark, oi.raw_name, p.erp_code, p.name AS product_name
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1) AND oi.voided_at IS NULL
      ORDER BY COALESCE(oi.display_order, 999999), oi.id
    `).all(orderId);
                for (const it of items) {
                    const qtyNum = it.quantity != null ? Number(it.quantity) : NaN;
                    const qty = Number.isFinite(qtyNum) ? qtyNum : "";
                    const itemNote = (it.remark && String(it.remark).trim()) || "";
                    const erp = (it.erp_code && String(it.erp_code).trim()) || "";
                    const productName = (it.product_name && String(it.product_name).trim()) || (it.raw_name && String(it.raw_name).trim()) || "";
                    dataRows.push([
                        cellForLingyueXlsx(orderDateLingyue),
                        cellForLingyueXlsx(docNo),
                        cellForLingyueXlsx(customerCode),
                        "",
                        cellForLingyueXlsx(erp),
                        cellForLingyueXlsx(productName),
                        cellForLingyueXlsx((it.unit && String(it.unit).trim()) || "公斤"),
                        cellForLingyueXlsx(qty),
                        cellForLingyueXlsx(itemNote),
                        cellForLingyueXlsx(docRemark),
                    ]);
                }
                docSeq += 1;
            }
            if (!dataRows.length) {
                res.status(404).type("text/plain").send("無可匯出之明細");
                return;
            }
            const tsLingyue = new Date().toISOString();
            for (const oid of sortedIds) {
                try {
                    await db.prepare("UPDATE orders SET lingyue_exported_at = ? WHERE id = ?").run(tsLingyue, oid);
                }
                catch (e) {
                    console.error("[admin] lingyue_exported_at update", oid, e?.message || e);
                }
            }
            const aoa = [header, ...dataRows];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            XLSX.utils.book_append_sheet(wb, ws, "凌越訂單");
            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
            const bin = bufferFromXlsxWrite(buf);
            let fname;
            if (sortedIds.length === 1) {
                const firstOrder = await db.prepare(`
      SELECT o.order_date, c.name AS customer_name, o.order_no, o.id
      FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `).get(sortedIds[0]);
                const fDate = safeFilenameOrderDate(firstOrder?.order_date);
                const fCust = String(firstOrder?.customer_name || "客戶").replace(/[\\/:*?"<>|]/g, "_").trim() || "客戶";
                const fNo = String(firstOrder?.order_no || firstOrder?.id || "01").replace(/[^\d]/g, "").slice(-2) || "01";
                fname = `${fDate}_${fCust}_${fNo}_凌越訂單.xlsx`;
            }
            else {
                const rangeRow = await db.prepare(`
      SELECT MIN(o.order_date) AS dmin FROM orders o WHERE o.id IN (${sortedIds.map(() => "?").join(",")})
    `).get(...sortedIds);
                const fDate = safeFilenameOrderDate(rangeRow?.dmin);
                const safeDate = String(fDate).replace(/[\\/:*?"<>|]/g, "_");
                fname = `${safeDate}_凌越訂單_合併${sortedIds.length}筆.xlsx`;
            }
            const asciiFallback = fname.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
            res.setHeader("Content-Disposition", "attachment; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encodeURIComponent(fname));
            res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(bin);
        }
        catch (e) {
            const detail = String(e?.message || e || "unknown").slice(0, 500);
            console.error("[admin] sendMergedLingyueXlsx", detail, e?.stack);
            if (!res.headersSent) {
                res.status(500).type("text/plain; charset=utf-8").send("匯出失敗：" + detail + "\n\n若為一次勾選過多訂單，請改分批；Cloud Run 請將請求逾時設為至少 300 秒。");
            }
        }
    }
    router.get("/orders/batch-lingyue-xlsx", async (req, res) => {
        const raw = (req.query.ids || "").toString();
        const ids = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        await sendMergedLingyueXlsx(res, ids);
    });
    router.post("/orders/batch-lingyue-xlsx", express_1.default.urlencoded({ extended: true, limit: "2mb" }), async (req, res) => {
        let ids = req.body.order_ids;
        if (ids == null)
            ids = [];
        if (!Array.isArray(ids))
            ids = [ids];
        ids = ids.map((x) => String(x).trim()).filter(Boolean);
        if (!ids.length && typeof req.body.ids === "string") {
            ids = req.body.ids.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        }
        await sendMergedLingyueXlsx(res, ids);
    });
    /**
     * 凌越回寫 — 機器對機器端點（內網 agent 用）。
     * 認證：HTTP 標頭 X-Writeback-Key 需等於環境變數 LINGYUE_WRITEBACK_KEY。
     *
     * GET /admin/lingyue-writeback/pending?date=YYYY-MM-DD
     *   回傳該日「已排隊（使用者按過『轉入凌越』）且尚未回寫」的訂單，JSON 格式。
     *   [fix 2026-07-14] 預設只回 lingyue_queued_at 非空的單：舊版回「當日全部未回寫」，
     *   CLI 拿去整批寫入就是誤寫 60 張事故的路徑（見 docs/凌越回寫-工作交接.md）。
     *   診斷需要看全部未回寫時帶 ?scope=all（僅供人工檢視，不可拿去寫入）。
     *   欄位沿用凌越 Excel 匯出邏輯（CustomerCode、ProductCode=凌越料號…）。
     *   注意：單據號（DocNo）由凌越端配發／內網 agent 依該日既有單據順編，雲端不指定；
     *         agent 寫入成功後再用下方 callback 把凌越實際單據號回填。
     */
    router.post("/orders/:orderId/apply-raw-text", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "/admin/orders";
        try {
            const order = await db.prepare("SELECT id, customer_id, raw_message FROM orders WHERE id = ?").get(orderId);
            if (!order) {
                res.status(404).send("訂單不存在");
                return;
            }
            const pasted = String(req.body?.pasted_raw ?? "").trim();
            if (!pasted) {
                res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=apply_raw_empty&back=" + encodeURIComponent(backTo) + "#pasteRaw");
                return;
            }
            const merge = String(req.body?.merge_mode || "replace").trim() === "append";
            const prev = String(order.raw_message || "").trim();
            const finalRaw = merge && prev ? `${prev}\n${pasted}` : pasted;
            // [fix 2026-07-08] 先用傳入的 finalRaw 解析重建明細，成功才覆寫 raw_message。
            // 過去先覆寫 raw 再解析，解析失敗時原始訊息已被蓋掉、永久遺失且與明細不一致。
            const result = await rebuildOrderItemsFromRawText(orderId, order.customer_id, finalRaw);
            if (!result.ok) {
                res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=apply_raw_parse&back=" + encodeURIComponent(backTo) + "#pasteRaw");
                return;
            }
            await db.prepare("UPDATE orders SET raw_message = ? WHERE id = ?").run(finalRaw, orderId);
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=raw_applied&back=" + encodeURIComponent(backTo) + "#items");
        }
        catch (e) {
            console.error("[admin] apply-raw-text failed", e?.message || e, e?.stack);
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=apply_raw_parse&back=" + encodeURIComponent(backTo) + "#pasteRaw");
        }
    });
    router.post("/orders/:orderId/items", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || (req.get("Accept") || "").includes("application/json");
        try {
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
            const existingItems = await db.prepare("SELECT id, quantity, unit, remark, sub_customer, raw_name FROM order_items WHERE order_id = ?").all(orderId);
            const fmtQty = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n))
                    return "";
                return Number.isInteger(n) ? String(n) : String(n).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
            };
            // [fix 2026-07-18] 數量驗證前移＋明確報錯：舊版非法數量（空白／非數字／負數）被靜默還原成
            // 舊值卻仍回 ok:true，使用者看到「✓ 已儲存明細」以為改成功、其實輸入被丟棄。改為先整批驗證，
            // 任一非法即整筆拒絕（不半套寫入）並回可自救訊息（哪個品項、什麼值、怎麼改）。
            const qtyErrors = [];
            for (const row of existingItems) {
                const itemId = row.id;
                if (!(("qty_" + itemId) in body))
                    continue; // 該列未送出 qty（作廢列等）→ 不驗
                const raw = String(body["qty_" + itemId] ?? "").trim();
                const name = String(row.raw_name || "").trim() || ("品項#" + itemId);
                if (raw === "") { qtyErrors.push(`「${name}」未填數量`); continue; }
                const n = Number(raw);
                if (!Number.isFinite(n)) { qtyErrors.push(`「${name}」數量「${raw}」不是有效數字`); continue; }
                if (n < 0) { qtyErrors.push(`「${name}」數量不可為負數（${raw}）`); continue; }
            }
            if (qtyErrors.length) {
                const shown = qtyErrors.slice(0, 3).join("；");
                const more = qtyErrors.length > 3 ? `（另有 ${qtyErrors.length - 3} 項）` : "";
                const msg = `數量格式錯誤：${shown}${more}。請輸入 0 或正數後再儲存。`;
                if (wantsJson) { res.status(400).json({ ok: false, error: msg }); return; }
                res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent(msg));
                return;
            }
            for (const row of existingItems) {
                const itemId = row.id;
                // [fix 2026-07-08] 只更新「表單有送出欄位」的品項。作廢品項在明細頁不會渲染
                // qty/unit/remark/sub_customer 輸入框，若照樣進迴圈會把它的單位重設成公斤、
                // 備註與子客戶清空。沒有任何對應欄位就跳過該列。
                if (!(("qty_" + itemId) in body) && !(("unit_" + itemId) in body) &&
                    !(("remark_" + itemId) in body) && !(("sub_customer_" + itemId) in body) &&
                    !(("ord_" + itemId) in body)) {
                    continue;
                }
                const qtyRaw = body["qty_" + itemId];
                const qtyParsed = parseFloat(qtyRaw);
                let nextQty = Number.isFinite(qtyParsed) && qtyParsed >= 0 ? qtyParsed : (Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : 0);
                const unitRaw = (body["unit_" + itemId] ?? "").trim();
                const inputUnit = unitRaw || "公斤";
                const remarkInput = (body["remark_" + itemId] ?? "").trim();
                const subCustomerInput = (body["sub_customer_" + itemId] ?? "").trim();
                const prevUnit = String(row.unit || "").trim();
                const prevRemark = String(row.remark || "").trim();
                // [fix 2026-07-08] 手動輸入質量單位（斤/台斤/克/兩）比照 LINE 進單一律換成公斤，
                // 避免「3斤」被原樣存成 3斤、下游當成 3公斤計（斤仍被當公斤的殘留路徑）。
                // resolved 傳 null → applyOrderUnitConversion 只套內建物理換算，不動品項規則，行為可預期。
                const enteredQty = nextQty;
                const massConv = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, { rules: [] }, null, enteredQty, inputUnit);
                nextQty = Number.isFinite(Number(massConv.quantity)) ? Number(massConv.quantity) : enteredQty;
                const nextUnit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(massConv.unit || inputUnit, "公斤");
                let nextRemark = remarkInput;
                // 因質量換算而變成公斤：備註補記原始「Ｎ<單位>」（如 3斤）
                if (nextUnit === "公斤" && (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(inputUnit, "公斤") !== "公斤") {
                    nextRemark = (0, unit_conversion_js_1.withOriginCallRemark)(nextRemark || null, enteredQty, inputUnit, nextUnit);
                }
                // 使用者手動把單位改成公斤（本身非質量換算單位，如把→公斤）時，沿用舊行為補原始單位標記
                const convertedToKg = prevUnit && prevUnit !== "公斤" && nextUnit === "公斤" && (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(inputUnit, "公斤") === "公斤";
                if (convertedToKg && !nextRemark) {
                    const originTag = fmtQty(row.quantity) + prevUnit;
                    nextRemark = prevRemark
                        ? (prevRemark.includes(originTag) ? prevRemark : (prevRemark + "；" + originTag))
                        : originTag;
                }
                await db.prepare("UPDATE order_items SET quantity = ?, unit = ?, remark = ?, sub_customer = ?, include_export = 1 WHERE id = ? AND order_id = ?").run(nextQty, nextUnit, nextRemark || null, subCustomerInput || null, itemId, orderId);
                const ordRaw = body["ord_" + row.id];
                const ordNum = parseInt(String(ordRaw || ""), 10);
                if (Number.isFinite(ordNum) && ordNum > 0) {
                    await db.prepare("UPDATE order_items SET display_order = ? WHERE id = ? AND order_id = ?").run(ordNum, row.id, orderId);
                }
            }
            try {
                await customer_handwriting_hints_js_1.recordHandwritingHintsForOrder(db, orderId);
            }
            catch (_) { /* 筆跡對照表寫入失敗不阻擋 */ }
            if (wantsJson) {
                res.json({ ok: true });
                return;
            }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=items");
        }
        catch (err) {
            const msg = err && err.message ? String(err.message) : String(err);
            console.error("[POST /admin/orders/" + orderId + "/items] 儲存明細失敗：", err);
            if (wantsJson) {
                res.status(500).json({ ok: false, error: "儲存失敗：" + msg });
                return;
            }
            res.status(500).send("儲存失敗：" + msg);
        }
    });
    router.post("/orders/:orderId/items/:itemId/delete", express_1.default.urlencoded({ extended: true }), express_1.default.json(), async (req, res) => {
        const { orderId, itemId } = req.params;
        // 接收作廢原因（dropdown）與備註：預設為 ai_wrong（最常見：AI 辨識錯誤）
        const reason = String(req.body?.void_reason || "ai_wrong").trim().toLowerCase();
        const note = String(req.body?.void_note || "").trim().slice(0, 500);
        const reasonLabel = { ai_wrong: "AI 辨識錯誤", customer_changed: "客戶更改", duplicate: "重複叫貨", other: "其他" }[reason] || reason;
        const order = await db.prepare("SELECT id, order_no, customer_id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const snap = await db.prepare("SELECT id, raw_name, quantity, unit, product_id, remark, sub_customer, need_review, voided_at FROM order_items WHERE id = ? AND order_id = ?").get(itemId, orderId);
        if (!snap) {
            const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || req.get("Accept")?.includes("application/json");
            if (wantsJson) { res.json({ ok: false, error: "品項不存在" }); return; }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId));
            return;
        }
        if (snap.voided_at) {
            const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || req.get("Accept")?.includes("application/json");
            if (wantsJson) { res.json({ ok: true, alreadyVoided: true }); return; }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=already_voided");
            return;
        }
        // 軟刪除：voided_at + voided_by + void_reason + void_note
        const isPg = Boolean(process.env.DATABASE_URL);
        const nowSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
        const actor = req.adminUsername || "system";
        await db.prepare(
            "UPDATE order_items SET voided_at = " + nowSql + ", voided_by = ?, void_reason = ?, void_note = ? WHERE id = ? AND order_id = ?"
        ).run(actor, reason, note || null, itemId, orderId);
        // AI 回饋：若是 AI 辨識錯誤且有對應到 product_id，把該 hint 加 wrong_count
        if (reason === "ai_wrong" && snap.product_id && snap.raw_name && order.customer_id) {
            try {
                await (0, customer_handwriting_hints_js_1.recordHandwritingHintWrong)(db, order.customer_id, snap.raw_name, snap.product_id);
            } catch (e) {
                console.warn("[void item] recordHandwritingHintWrong failed:", e?.message || e);
            }
        }
        await logDataChange(req, {
            entityType: "order_item",
            entityId: itemId,
            productId: snap.product_id ?? null,
            action: "void",
            summary: `作廢訂單 ${order.order_no || orderId} 品項：${snap.raw_name || "(無品名)"} ${snap.quantity ?? ""}${snap.unit ?? ""} · ${reasonLabel}${note ? "（" + note + "）" : ""}`,
            meta: { order_id: orderId, snapshot: snap, void_reason: reason, void_note: note, ai_feedback: reason === "ai_wrong" && snap.product_id ? "wrong_count++" : null },
        });
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || req.get("Accept")?.includes("application/json");
        if (wantsJson) {
            res.json({ ok: true });
            return;
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=void_item#items");
    });
    router.post("/orders/:orderId/approve", async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "";
        const goNext = req.query.next === "1";
        const order = await db.prepare("SELECT id, order_no, order_date, status FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        // [fix 2026-07-08] 狀態機前置守衛：作廢單／客訴單不可被「確認」直接復活成 approved。
        // 過去無檢查，一鍵確認會把 deleted/complaint 單改成 approved，留下矛盾狀態並讓作廢單重新出貨。
        const curStatus = String(order.status || "").toLowerCase().trim();
        if (curStatus === "deleted" || curStatus === "complaint") {
            const msg = curStatus === "deleted" ? "此訂單已作廢，請先『取消作廢』再確認" : "此訂單為客訴狀態，請先由客訴頁還原為訂單再確認";
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent(msg) + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
            return;
        }
        const actor = req.adminUsername || "system";
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare("UPDATE orders SET status = ?, approved_by = ?, approved_at = " + nowSql + " WHERE id = ?").run("approved", actor, orderId);
        await logDataChange(req, {
            entityType: "order",
            entityId: orderId,
            action: "approve",
            summary: `確認訂單 ${order.order_no || orderId}（前狀態：${order.status || "－"}）`,
            meta: { before: order },
        });
        if (goNext) {
            // 找下一筆「pending」訂單（沿用詳細頁 nextOrder 方向：order_date 較小者優先；同日 id 較小者）
            const nextPending = await db.prepare(`
                SELECT id FROM orders
                WHERE LOWER(COALESCE(status,'pending')) = 'pending'
                  AND id != ?
                  AND (order_date < ? OR (order_date = ? AND id < ?))
                ORDER BY order_date DESC, id DESC
                LIMIT 1
            `).get(orderId, order.order_date, order.order_date, orderId);
            if (nextPending && nextPending.id) {
                res.redirect("/admin/orders/" + encodeURIComponent(nextPending.id) + "?ok=approved_prev" + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
                return;
            }
            // 沒有更舊的 pending，試找任何其他 pending（任意方向）
            const anyPending = await db.prepare(`
                SELECT id FROM orders
                WHERE LOWER(COALESCE(status,'pending')) = 'pending'
                  AND id != ?
                ORDER BY order_date DESC, id DESC
                LIMIT 1
            `).get(orderId);
            if (anyPending && anyPending.id) {
                res.redirect("/admin/orders/" + encodeURIComponent(anyPending.id) + "?ok=approved_prev" + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
                return;
            }
            // 完全沒有 pending → 回列表
            res.redirect((backTo || "/admin/orders") + (backTo.includes("?") ? "&" : "?") + "ok=approved_done");
            return;
        }
        // [2026-07-16 使用者定案] 取消「確認後自動跳下一筆」：確認完直接回訂單列表（帶原日期/篩選），
        // 不再被帶去別的訂單點來點去。goNext 分支保留（無按鈕使用）以防外部連結帶 next=1。
        if (backTo) {
            res.redirect(backTo + (backTo.includes("?") ? "&" : "?") + "ok=approved");
            return;
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=approved");
    });
    router.post("/orders/:orderId/set-date", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const newDate = String(req.body?.order_date || "").trim();
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent("日期格式錯誤"));
            return;
        }
        const order = await db.prepare("SELECT id, order_no, order_date, status FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        if (order.order_date === newDate) {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=date_unchanged" + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
            return;
        }
        await db.prepare("UPDATE orders SET order_date = ? WHERE id = ?").run(newDate, orderId);
        await logDataChange(req, {
            entityType: "order",
            entityId: orderId,
            action: "edit_order_date",
            summary: `修改訂單 ${order.order_no || orderId} 出貨日期：${order.order_date || "—"} → ${newDate}`,
            meta: { before: { order_date: order.order_date }, after: { order_date: newDate } },
        });
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=date_saved" + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
    });
    router.post("/orders/:orderId/unapprove", async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "";
        const order = await db.prepare("SELECT id, order_no, status FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        // [fix 2026-07-14] 狀態機守衛：取消確認只適用 approved 之後的單；作廢／客訴單不可經此路徑
        // 復活成 pending（復活後會回到 /wait 回寫候選，已在凌越刪掉的單可能再次寫入）。
        const curStatusUnapprove = String(order.status || "").toLowerCase().trim();
        if (curStatusUnapprove === "deleted" || curStatusUnapprove === "complaint") {
            const msg = curStatusUnapprove === "deleted" ? "此訂單已作廢，請先『取消作廢』" : "此訂單為客訴狀態，請由客訴頁還原";
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent(msg) + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
            return;
        }
        await db.prepare("UPDATE orders SET status = ?, approved_by = NULL, approved_at = NULL WHERE id = ?").run("pending", orderId);
        await logDataChange(req, {
            entityType: "order",
            entityId: orderId,
            action: "unapprove",
            summary: `取消確認訂單 ${order.order_no || orderId}（前狀態：${order.status || "－"}）`,
            meta: { before: order },
        });
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=unconfirmed" + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
    });
    router.get("/orders/:orderId/items/add", async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare("SELECT id, order_date, customer_id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const units = ORDER_LINE_UNITS;
        const unitOpts = units.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單審核</a> / <a href="/admin/orders/${encodeURIComponent(orderId)}">訂單明細</a> / 增加品項</div>
        <h1 class="notion-page-title">增加品項</h1>
        <div class="notion-card">
          <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/items/add" id="addItemForm" onsubmit="if(this.dataset.submitting)return false;this.dataset.submitting='1';return true;">
            <div class="review-product-picker" style="position:relative;max-width:520px;margin-bottom:14px;">
              <label style="display:block;margin-bottom:6px;font-weight:500;">品項（打字搜尋，支援模糊比對）</label>
              <input type="text" class="review-product-search" autocomplete="off" placeholder="輸入品名、料號或條碼…" style="width:100%;box-sizing:border-box;padding:8px 12px;" />
              <input type="hidden" name="product_id" class="review-product-id" value="" />
              <div class="review-product-label notion-hint" style="margin-top:6px;min-height:1.2em;color:var(--notion-text-muted);"></div>
              <div class="review-product-dropdown" style="display:none;position:absolute;left:0;right:0;top:100%;max-height:280px;overflow-y:auto;background:var(--notion-card);border:1px solid var(--notion-border);border-radius:8px;z-index:20;box-shadow:0 4px 12px rgba(0,0,0,.08);margin-top:4px;"></div>
            </div>
            <label>數量 <input type="number" name="quantity" step="any" min="0" value="0" required style="width:8rem;"></label>
            <label>單位 <select name="unit" style="width:8rem;">${unitOpts}</select></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button> <a href="/admin/orders/${encodeURIComponent(orderId)}#items" class="btn">取消</a></p>
          </form>
        </div>
        <script>
        (function(){
          var searchTimeout;
          var wrap = document.querySelector("#addItemForm .review-product-picker");
          if (!wrap) return;
          var inp = wrap.querySelector(".review-product-search");
          var hidden = wrap.querySelector(".review-product-id");
          var label = wrap.querySelector(".review-product-label");
          var dropdown = wrap.querySelector(".review-product-dropdown");
          var form = document.getElementById("addItemForm");
          function showList(arr){
            dropdown.innerHTML = (arr && arr.length) ? arr.map(function(p){
              var esc = function(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); };
              return '<div class="review-product-opt" data-id="' + (p.id || "") + '" data-name="' + esc(p.name) + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--notion-border);font-size:13px;">' +
                esc(p.name) + (p.erp_code ? " \uFF08" + esc(p.erp_code) + "\uFF09" : "") + (p.teraoka_barcode ? " " + esc(p.teraoka_barcode) : "") + "</div>";
            }).join("") : '<div class="notion-hint" style="padding:8px 12px;margin:0;">無符合品項，請換關鍵字或簡稱</div>';
            dropdown.style.display = "block";
          }
          function hideList(){ dropdown.style.display = "none"; }
          function selectProduct(id, name){
            hidden.value = id || "";
            label.textContent = name ? "\u5DF2\u9078\uff1a" + name : "";
            inp.value = name || "";
            hideList();
          }
          inp.addEventListener("input", function(){
            var q = (this.value || "").trim();
            clearTimeout(searchTimeout);
            if (!q) { hideList(); label.textContent = ""; hidden.value = ""; return; }
            searchTimeout = setTimeout(function(){
              fetch("/admin/api/products-search?q=" + encodeURIComponent(q) + "&active=1").then(function(r){ return r.json(); }).then(function(arr){ showList(arr); }).catch(function(){ hideList(); });
            }, 200);
          });
          dropdown.addEventListener("click", function(e){
            var opt = e.target.closest(".review-product-opt");
            if (opt && opt.dataset.id) selectProduct(opt.dataset.id, opt.dataset.name);
          });
          document.addEventListener("click", function(e){ if (wrap && !wrap.contains(e.target)) hideList(); });
          if (form) form.addEventListener("submit", function(e){
            if (!hidden || !String(hidden.value || "").trim()) {
              e.preventDefault();
              alert("\u8acb\u5148\u8f38\u5165\u95dc\u9375\u5b57\u4e26\u5f9e\u4e0b\u62c9\u9078\u64c7\u54c1\u9805\u3002");
            }
          });
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("增加品項", body, "", res));
    });
    router.post("/orders/:orderId/items/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const productId = req.body.product_id?.trim();
        const qty = parseFloat(req.body.quantity);
        const unit = (req.body.unit || "").trim() || "公斤";
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
        await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export, sub_customer, confidence_score) VALUES (?, ?, ?, ?, ?, ?, 0, 1, NULL, 100)").run(itemId, orderId, productId, product.name, qty, unit);
        // 插入位置：after_item_id = 要插在哪一項之後（沒帶或找不到 → 排最後）。
        // 全部重編 display_order（既有品項可能從未存過排序、display_order 皆為 NULL）。
        try {
            const afterItemId = String(req.body.after_item_id || "").trim();
            const ordered = await db.prepare("SELECT id FROM order_items WHERE order_id = ? AND voided_at IS NULL ORDER BY COALESCE(display_order, 999999), id").all(orderId);
            const ids = ordered.map((r) => r.id).filter((x) => x !== itemId);
            let insertAt = ids.length;
            if (afterItemId) {
                const pos = ids.indexOf(afterItemId);
                if (pos >= 0) insertAt = pos + 1;
            }
            ids.splice(insertAt, 0, itemId);
            for (let i = 0; i < ids.length; i++) {
                await db.prepare("UPDATE order_items SET display_order = ? WHERE id = ? AND order_id = ?").run(i + 1, ids[i], orderId);
            }
        }
        catch (e) {
            console.error("[admin] items/add 排序重編失敗（品項已新增，僅落在最後）:", e?.message || e);
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=add_item#items");
    });
    router.get("/orders/:orderId/order-sheet", async (req, res) => {
        const { orderId } = req.params;
        const preview = req.query.preview === "1";
        const download = req.query.download === "1";
        const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.quantity, oi.unit, oi.remark, p.erp_code, p.name AS product_name
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1) AND oi.voided_at IS NULL
    `).all(orderId);
        const orderNoForBc = (order.order_no && String(order.order_no).trim()) ? String(order.order_no).trim() : order.id;
        const orderBcHeader = orderNoForBc
            ? `<div class="order-sheet-head-R"><img src="/admin/barcode?code=${encodeURIComponent(orderNoForBc)}&scale=3&height=12" alt="" class="os-bc-order-img"/><div class="order-sheet-bc-label">${escapeHtml(order.order_no ?? order.id)}</div></div>`
            : "";
        const rows = items.map((i) => {
            const erp = i.erp_code ?? "—";
            const pname = i.product_name ?? "待確認";
            const qty = i.quantity;
            const u = i.unit && i.unit.trim() ? i.unit : "";
            const remark = (i.remark && i.remark.trim()) ? escapeHtml(i.remark.trim()) : "—";
            return `<tr><td>${escapeHtml(erp)}</td><td>${escapeHtml(pname)}</td><td>${qty}</td><td>${escapeHtml(u)}</td><td>${remark}</td></tr>`;
        }).join("");
        const customerBarcode = order.customer_teraoka_code && order.customer_teraoka_code.trim()
            ? `<p style="font-size:17pt;margin-top:12px;"><strong>客戶條碼</strong>（${escapeHtml(order.customer_name)}）<br><img src="/admin/barcode?code=${encodeURIComponent(order.customer_teraoka_code.trim())}&scale=3&height=14" alt="客戶條碼" class="os-cust-bc"></p>`
            : "";
        if (!preview) {
            try {
                await db.prepare("UPDATE orders SET sheet_exported_at = ? WHERE id = ?").run(new Date().toISOString(), orderId);
            }
            catch (e) {
                console.error("[admin] sheet_exported_at single", orderId, e?.message || e);
            }
        }
        const singleOrderSheetStyle = `
<style>
.order-sheet-print { font-size: 17pt; color: #111; box-sizing: border-box; }
.order-sheet-print .order-sheet-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
.order-sheet-print .order-sheet-head-L { flex: 1; min-width: 0; }
.order-sheet-print .order-sheet-head-R { flex-shrink: 0; text-align: right; max-width: 48%; }
.order-sheet-print h1 { font-size: 26pt; margin: 0 0 10px; font-weight: 700; letter-spacing: -0.02em; }
.order-sheet-print .os-meta { font-size: 17pt; margin: 0; line-height: 1.45; }
.order-sheet-print table { width: 100%; border-collapse: collapse; font-size: 17pt; table-layout: fixed; }
.order-sheet-print th, .order-sheet-print td { border: 1px solid #333; padding: 5px 5px; vertical-align: top; }
.order-sheet-print th { font-size: 15pt; background: #f5f5f5; font-weight: 600; }
.order-sheet-print th.col-tg { width: 16%; max-width: 32mm; font-size: 11pt; padding: 4px 3px; }
.order-sheet-print td.col-tg { width: 16%; max-width: 32mm; padding: 3px 3px; }
.order-sheet-print .teraoka-compact { display: flex; flex-direction: column; align-items: flex-start; gap: 0; margin: 0; padding: 0; max-width: 100%; }
.order-sheet-print .teraoka-compact-meta { margin: 0; padding: 0; line-height: 1.1; }
.order-sheet-print .teraoka-compact .tc-code { display: block; font-size: 6.5pt; font-weight: 600; color: #222; letter-spacing: -0.02em; word-break: break-all; }
.order-sheet-print .teraoka-compact .tc-name { display: block; font-size: 6.5pt; color: #444; margin: 0; padding: 0; line-height: 1.15; max-height: 2.5em; overflow: hidden; word-break: break-word; }
.order-sheet-print .os-bc-item-img { height: 51px; width: auto; display: block; margin: 0; padding: 0; max-width: 100%; }
.order-sheet-print .os-bc-order-img { height: 56px; width: auto; display: block; margin-left: auto; max-width: 100%; }
.order-sheet-print .order-sheet-bc-label { font-size: 14pt; margin-top: 4px; }
.order-sheet-print .os-cust-bc { height: 84px; width: auto; max-width: 100%; }
.order-sheet-print .order-sheet-inner { width: 100%; max-width: 190mm; margin: 0 auto; padding: 4mm 6mm; }
</style>`;
        const sheetBody = `
        ${singleOrderSheetStyle}
        <div class="no-print notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單審核</a> / <a href="/admin/orders/${encodeURIComponent(orderId)}">訂單明細</a> / 訂貨單</div>
        ${preview ? "<p class=\"no-print\"><button type=\"button\" class=\"btn btn-primary\" id=\"exportJpgBtn\">匯出 JPG</button> 預覽下方訂單圖後可點此匯出</p>" : ""}
        <div id="order-sheet-content" style="margin-top:12px; width:210mm; min-height:297mm; box-sizing:border-box; background:white; padding:10mm 8mm;" class="order-sheet-a4 order-sheet-print">
        <div class="order-sheet-inner">
        <div class="order-sheet-head">
          <div class="order-sheet-head-L">
            <h1>訂貨單</h1>
            <p class="os-meta">訂單編號：${escapeHtml(order.order_no ?? "—")}　日期：${escapeHtml(order.order_date)}　客戶：${escapeHtml(order.customer_name || "（未選客戶）")}</p>
          </div>
          ${orderBcHeader}
        </div>
          <table>
            <colgroup><col style="width:10%"><col style="width:40%"><col style="width:10%"><col style="width:10%"><col style="width:30%"></colgroup>
            <thead><tr><th>料號</th><th>品名</th><th>數量</th><th>單位</th><th>備註</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ${customerBarcode ? `<div style="margin-top:1.5rem;">${customerBarcode}</div>` : ""}
        </div>
        </div>
        <p class="no-print" style="margin-top:1rem;"><a href="/admin/orders/${encodeURIComponent(orderId)}">← 回訂單明細</a></p>
        ${preview ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script><script>document.getElementById("exportJpgBtn").onclick=function(){ var el = document.getElementById("order-sheet-content"); if (typeof html2canvas !== "undefined") { html2canvas(el, { useCORS: true, allowTaint: true, scale: 2 }).then(function(canvas){ var a = document.createElement("a"); a.download = "order-sheet-' + orderId + '.jpg"; a.href = canvas.toDataURL("image/jpeg", 0.92); a.click(); }); } };</script>' : ""}
      `;
        if (download) {
            const safeCustomer = String(order.customer_name || "客戶").replace(/[\\/:*?"<>|]/g, "_").trim() || "客戶";
            const seq = String(order.order_no || order.id || "01").replace(/[^\d]/g, "").slice(-2) || "01";
            const fname = `${order.order_date}_${safeCustomer}_${seq}_揀貨單.html`;
            const fnameAsciiFallback = fname.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
            res.setHeader("Content-Disposition", "attachment; filename=\"" + fnameAsciiFallback + "\"; filename*=UTF-8''" + encodeURIComponent(fname));
        }
        res.type("text/html").send(notionPage("訂貨單", sheetBody, "", res));
    });
}
