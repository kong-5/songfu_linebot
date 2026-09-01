"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomersRoutes = registerCustomersRoutes;

// 客戶域（客戶主檔／新增編輯／360／別名／待綁定／停用刪除）路由：自 index.js 拆出（拆檔批次 4），純搬移、行為不變。
// 注：/customers/groups（群組功能總表）留在 index.js（與 inventory ctx 共用 saveGroupFeatures，批次 3 已定案）。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const customer_profile_js_1 = require("../lib/customer-profile.js");
const customer_scoring_js_1 = require("../lib/customer-scoring.js");
const group_features_js_1 = require("../lib/group-features.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerCustomersRoutes(router, ctx) {
    const { db, notionPage, logDataChange, getTaipeiCalendarDateYYYYMMDD, fmtTaipeiYMDHM, setGroupFeaturesAudited, ORDER_LINE_UNITS } = ctx;
    // [fix 2026-07-27 體檢] 判斷是不是撞到「一群組只能綁一客戶」的唯一索引 ux_customers_line_group
    // （SQLite 與 PG 的錯誤訊息不同）。三個綁定入口都先查後寫，這是 race window 的最後一道。
    const isLineGroupUniqueViolation = (e) => {
        const m = String(e?.message || e);
        return /ux_customers_line_group/i.test(m)
            || (/UNIQUE constraint failed/i.test(m) && /customers\.line_group_id/i.test(m))
            || (/duplicate key value/i.test(m) && /line_group/i.test(m));
    };
    router.get("/customers/new", async (req, res) => {
        // POST /customers/new 失敗會重導 ?err=（含「群組已綁定其他客戶」完整訊息）；沒渲染會讓使用者以為建立成功。
        const errRaw = typeof req.query.err === "string" ? req.query.err : "";
        const errMsg = errRaw === "name" ? "請填寫客戶名稱後再送出" : errRaw;
        const errBanner = errMsg ? `<div class="sf-pill bad" style="margin-bottom:12px;">${escapeHtml(errMsg)}</div>` : "";
        // 支援 query 預填（凌越客戶主檔頁「建立客戶」帶 name/hq_cust_code/contact 過來，直接存就好）
        const pre = (k) => escapeAttr(String(req.query[k] || "").trim());
        const preHint = String(req.query.hq_cust_code || "").trim()
            ? `<p style="font-size:13px;color:var(--txt-2);background:var(--notion-sidebar);padding:8px 12px;border-radius:var(--notion-radius);">已由凌越客戶主檔帶入名稱／凌越編號／電話，確認後按建立即可。</p>`
            : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / 新增客戶</div>
        <h1 class="notion-page-title">新增客戶</h1>
        ${errBanner}
        <div class="notion-card">
          ${preHint}
          <form method="post" action="/admin/customers/new">
            <label>客戶名稱 <input type="text" name="name" required placeholder="例：XX餐廳" value="${pre("name")}" style="width:100%;"></label>
            <label>寺岡編號（CustCode／QR） <input type="text" name="teraoka_code" placeholder="可留空" style="width:100%;"></label>
            <label>凌越編號（HQCustCode） <input type="text" name="hq_cust_code" placeholder="可留空" value="${pre("hq_cust_code")}" style="width:100%;"></label>
            <label>LINE 群組名稱 <input type="text" name="line_group_name" placeholder="可留空，之後可改" style="width:100%;"></label>
            <label>LINE 群組 ID <input type="text" name="line_group_id" placeholder="C開頭群組 ID，可留空後補" style="width:100%;"></label>
            <label>聯絡方式 <input type="text" name="contact" placeholder="電話或備註，可留空" value="${pre("contact")}" style="width:100%;"></label>
            <label>第幾號線（檢貨路線）<select name="route_line"><option value="">— 不指定</option>${[1,2,3,4,5,6,7,8,9].map((n) => `<option value="${n}">${n} 號線</option>`).join("")}</select></label>
            <label>專屬子客戶/分店名單 (請用逗號分隔) <input type="text" name="known_sub_customers" placeholder="例：東大附小,豐源國小,馬蘭國小" style="width:100%;"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">建立</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增客戶", body, "", res));
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
        const knownSubCustomers = req.body.known_sub_customers?.trim() || null;
        if (!name) {
            res.redirect("/admin/customers/new?err=name");
            return;
        }
        // [fix 2026-07-08] 同一 LINE 群組不可綁到兩個客戶（會造成叫貨歸屬錯亂）。
        if (lineGroupId) {
            const clash = await db.prepare("SELECT id, name FROM customers WHERE line_group_id = ? LIMIT 1").get(lineGroupId);
            if (clash) {
                res.redirect("/admin/customers/new?err=" + encodeURIComponent(`此 LINE 群組已綁定客戶「${clash.name || clash.id}」，不能重複綁定`));
                return;
            }
        }
        const id = (0, id_js_1.newId)("cust");
        try {
            await db.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, route_line, known_sub_customers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact, routeLine, knownSubCustomers);
        }
        catch (e) {
            // [fix 2026-07-27 體檢] 上面的先查後寫有 race window（表單雙擊／併發），
            // DB 的 ux_customers_line_group 是最後一道；撞到時回可行動訊息而非原始 500。
            if (isLineGroupUniqueViolation(e)) {
                res.redirect("/admin/customers/new?err=" + encodeURIComponent("此 LINE 群組剛被綁到其他客戶（可能同時有人在操作），請重新整理客戶列表確認後再試"));
                return;
            }
            throw e;
        }
        if (lineGroupId) {
            try {
                await db.prepare("DELETE FROM pending_line_groups WHERE group_id = ?").run(lineGroupId);
            }
            catch (_) { /* 表可能尚未建立 */ }
        }
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
        const backLink = fromOrders ? "<a href=\"/admin/orders\">← 回訂單審核</a>" : "<a href=\"/admin/customers\">← 回客戶列表</a>";
        const editLink = fromOrders
            ? `<a href="/admin/customers/${encodeURIComponent(customer.id)}/edit?from=orders">編輯</a>`
            : `<a href="/admin/customers/${encodeURIComponent(customer.id)}/edit">編輯</a>`;
        const view360Link = `<a href="/admin/customers/${encodeURIComponent(customer.id)}/360" style="margin-left:12px;font-weight:600;color:var(--accent);">${sfInlineIcon("chartBar")} 360 完整檔案</a>`;
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
        <p>${editLink}　${view360Link}　${backLink}</p>
      `;
        res.type("text/html").send(notionPage("客戶資料", body, "", res));
    });
    // === 客戶 360 CRM 完整檔案 ===
    router.get("/customers/:id/360", async (req, res) => {
        try {
            const customer = await db.prepare(
                "SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, route_line, crm_handover_notes FROM customers WHERE id = ?"
            ).get(req.params.id);
            if (!customer) { res.status(404).send("找不到客戶"); return; }
            const cid = customer.id;
            const isPg = Boolean(process.env.DATABASE_URL);
            // 過去 90 / 30 / 全部 訂單統計
            // 注意：order_date 在 PG 是 TEXT，需 cast 成 date 比較；或用 to_char 將右邊轉成 'YYYY-MM-DD' 文字
            const periodSqls = isPg
                ? {
                    p90: "AND o.order_date >= to_char((CURRENT_DATE - INTERVAL '90 day'), 'YYYY-MM-DD')",
                    p30: "AND o.order_date >= to_char((CURRENT_DATE - INTERVAL '30 day'), 'YYYY-MM-DD')",
                }
                : {
                    p90: "AND o.order_date >= date('now', '-90 day')",
                    p30: "AND o.order_date >= date('now', '-30 day')",
                };
            async function countOrders(extra) {
                const sql = "SELECT COUNT(*) AS n FROM orders o WHERE o.customer_id = ? AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') " + (extra || "");
                const r = await db.prepare(sql).get(cid);
                return Number(r?.n) || 0;
            }
            const orders90 = await countOrders(periodSqls.p90);
            const orders30 = await countOrders(periodSqls.p30);
            const ordersAll = await countOrders("");
            // 最後一張訂單（含 complaint，看最近一次互動）
            const lastOrderRow = await db.prepare(
                "SELECT id, order_no, order_date, status, updated_at FROM orders WHERE customer_id = ? ORDER BY order_date DESC, id DESC LIMIT 1"
            ).get(cid);
            // 距上次叫貨天數（不含客訴）
            const lastNonComplaintRow = await db.prepare(
                "SELECT order_date FROM orders WHERE customer_id = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_date DESC LIMIT 1"
            ).get(cid);
            const todayIso = getTaipeiCalendarDateYYYYMMDD();
            let daysSinceLastOrder = null;
            if (lastNonComplaintRow?.order_date) {
                const last = new Date(String(lastNonComplaintRow.order_date) + "T00:00:00+08:00");
                const today = new Date(todayIso + "T00:00:00+08:00");
                daysSinceLastOrder = Math.round((today - last) / 86400000);
            }
            // 平均叫貨間隔（過去 90 天）
            const last90Orders = await db.prepare(
                "SELECT DISTINCT order_date FROM orders o WHERE o.customer_id = ? AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') " + periodSqls.p90 + " ORDER BY order_date DESC"
            ).all(cid);
            let avgIntervalDays = null;
            if (last90Orders && last90Orders.length >= 2) {
                const dates = last90Orders.map(r => new Date(String(r.order_date) + "T00:00:00+08:00").getTime()).sort((a, b) => b - a);
                const gaps = [];
                for (let i = 1; i < dates.length; i++) gaps.push((dates[i - 1] - dates[i]) / 86400000);
                avgIntervalDays = Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10;
            }
            // 客戶 profile（既有 helper）
            let profile = null;
            try { profile = await (0, customer_profile_js_1.computeCustomerProfile)(db, cid); } catch (_) {}
            // 客訴清單
            const complaints = await db.prepare(
                "SELECT o.id, o.order_no, o.order_date, o.raw_message, o.updated_at, COALESCE(ch.handle_status, 'pending') AS handle_status, ch.handler, ch.resolved_at " +
                "FROM orders o LEFT JOIN complaint_handling ch ON ch.order_id = o.id " +
                "WHERE o.customer_id = ? AND LOWER(TRIM(COALESCE(o.status,''))) = 'complaint' " +
                "ORDER BY o.order_date DESC, o.id DESC LIMIT 30"
            ).all(cid);
            const openComplaints = complaints.filter(c => String(c.handle_status || "pending") !== "resolved").length;
            // 客戶手寫 hints（系統學過的對應）
            let hints = [];
            try {
                hints = await db.prepare(
                    "SELECT raw_name_last, p.name AS product_name, h.hit_count, h.wrong_count, h.last_hit_at " +
                    "FROM customer_handwriting_hints h LEFT JOIN products p ON p.id = h.product_id " +
                    "WHERE h.customer_id = ? ORDER BY h.hit_count DESC LIMIT 20"
                ).all(cid);
            } catch (_) {}
            // 最近 5 張訂單
            const recentOrders = await db.prepare(
                "SELECT o.id, o.order_no, o.order_date, o.status, o.updated_at, " +
                "(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.voided_at IS NULL) AS item_count " +
                "FROM orders o WHERE o.customer_id = ? AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted') ORDER BY o.order_date DESC, o.id DESC LIMIT 5"
            ).all(cid);
            // 使用正式版評分演算法
            let items90 = 0;
            try {
                const r = await db.prepare(
                    "SELECT COUNT(*) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id " +
                    "WHERE o.customer_id = ? AND oi.voided_at IS NULL AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') AND o.order_date >= ? AND o.order_date <= ?"
                ).get(cid, (function(){const d=new Date(todayIso+"T00:00:00+08:00"); d.setDate(d.getDate()-89); return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei"}).format(d);})(), todayIso);
                items90 = Number(r?.n) || 0;
            } catch (_) {}
            const { score, breakdown } = (0, customer_scoring_js_1.computeCustomerScore)({
                orders90, ordersAll, items90,
                complaintsAll: complaints.length, complaintsOpen: openComplaints,
                daysSinceLastOrder, avgIntervalDays,
            });
            const tier = (0, customer_scoring_js_1.scoreToTier)(score);
            const stars = tier.stars;
            // === HTML ===
            const okMsg = req.query.ok === "handover_saved" ? `<div class="sf-pill ok" style="align-self:flex-start;">已儲存交接備註</div>` : "";
            const fmtTs = (s) => fmtTaipeiYMDHM(s, "");
            const statusBadge = (s) => {
                const lc = String(s || "").toLowerCase();
                if (lc === "approved") return `<span class="sf-pill ok">已確認</span>`;
                if (lc === "complaint") return `<span class="sf-pill bad">客訴</span>`;
                if (lc === "deleted") return `<span class="sf-pill">作廢</span>`;
                return `<span class="sf-pill warn">待確認</span>`;
            };
            const rhythmAlert = (daysSinceLastOrder != null && avgIntervalDays != null && daysSinceLastOrder > avgIntervalDays * 1.5)
                ? `<div style="margin-top:10px;padding:10px 14px;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;font-size:13px;color:#92400e;">⚠ 已 ${daysSinceLastOrder} 天沒叫貨（平均間隔 ${avgIntervalDays} 天），可能忘記叫貨</div>`
                : "";
            const body = `
              <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;max-width:1100px;margin:0 auto;">
                <div>
                  <div class="sf-breadcrumb" style="margin-bottom:6px;"><a href="/admin/customers">客戶管理</a> / 360 完整檔案</div>
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                    <h1 style="margin:0;font-size:24px;font-weight:600;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                      ${escapeHtml(customer.name)}
                      <span class="sf-pill" style="background:${tier.bg};color:${tier.color};font-weight:600;">${tier.label}</span>
                      <span style="font-size:18px;color:#f59e0b;">${stars}</span>
                      <span class="mono" style="font-size:13px;color:var(--txt-3);">${score}/100</span>
                    </h1>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                      <a class="sf-btn" href="/admin/customers/${encodeURIComponent(cid)}/quick-view">快速檢視</a>
                      <a class="sf-btn" href="/admin/customers/${encodeURIComponent(cid)}/edit">編輯</a>
                      <a class="sf-btn ghost" href="/admin/customers">← 回列表</a>
                    </div>
                  </div>
                  ${okMsg}
                  ${rhythmAlert}
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                  <div class="sf-card" style="padding:14px 18px;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">過去 90 天訂單</div>
                    <div class="mono" style="font-size:24px;font-weight:600;">${orders90}</div>
                    <div style="font-size:12px;color:var(--txt-2);">30 天 ${orders30} · 累計 ${ordersAll}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">距上次叫貨</div>
                    <div class="mono" style="font-size:24px;font-weight:600;color:${daysSinceLastOrder != null && avgIntervalDays != null && daysSinceLastOrder > avgIntervalDays * 1.5 ? "var(--bad)" : "var(--txt-1)"};">${daysSinceLastOrder != null ? daysSinceLastOrder + " 天" : "—"}</div>
                    <div style="font-size:12px;color:var(--txt-2);">${lastNonComplaintRow?.order_date ? "最後 " + lastNonComplaintRow.order_date : "尚無紀錄"}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">平均叫貨間隔</div>
                    <div class="mono" style="font-size:24px;font-weight:600;">${avgIntervalDays != null ? avgIntervalDays + " 天" : "—"}</div>
                    <div style="font-size:12px;color:var(--txt-2);">過去 90 天樣本</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">客訴</div>
                    <div class="mono" style="font-size:24px;font-weight:600;color:${openComplaints > 0 ? "var(--bad)" : "var(--ok)"};">${complaints.length}</div>
                    <div style="font-size:12px;color:var(--txt-2);">未解決 <strong style="color:${openComplaints > 0 ? "var(--bad)" : "var(--ok)"};">${openComplaints}</strong></div>
                  </div>
                </div>

                <div class="sf-card" style="border-left:4px solid var(--accent);">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.note}員工交接備註</div><span class="sf-card-sub">換班接手時的關鍵注意事項</span></div>
                  <form method="post" action="/admin/customers/${encodeURIComponent(cid)}/handover-notes" style="padding:14px;">
                    <textarea name="crm_handover_notes" rows="4" class="sf-input" style="width:100%;font-family:inherit;" placeholder="例：客戶習慣晚上 10 點叫貨；說話比較急但人很好；曾退過一次貨；地址會變請打電話確認；…">${escapeHtml(customer.crm_handover_notes || "")}</textarea>
                    <div style="margin-top:10px;display:flex;justify-content:flex-end;"><button type="submit" class="sf-btn primary sm">儲存</button></div>
                  </form>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.cart}常買品項 Top ${Math.min(10, (profile?.topItems || []).length)}</div></div>
                    <div style="padding:8px 16px 14px;">
                      ${(profile?.topItems || []).slice(0, 10).map((it, i) => `
                        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:${i < 9 ? '1px dashed var(--line)' : 'none'};font-size:13px;">
                          <span>${i + 1}. ${escapeHtml(it.name)}</span>
                          <span class="mono" style="color:var(--txt-2);">${it.count} 次</span>
                        </div>`).join("") || `<p style="color:var(--txt-3);font-size:13px;margin:8px 0;">尚無資料</p>`}
                    </div>
                  </div>
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.calendar}叫貨時段／週幾偏好</div></div>
                    <div style="padding:12px 16px;">
                      <div style="font-size:12px;color:var(--txt-2);margin-bottom:8px;">常下單週幾</div>
                      <div style="font-size:13px;margin-bottom:14px;">${(profile?.topWeekdays || []).map(([k, v]) => `<span class="sf-pill" style="margin-right:4px;margin-bottom:4px;">${escapeHtml(k)} ${v}</span>`).join("") || "—"}</div>
                      <div style="font-size:12px;color:var(--txt-2);margin-bottom:8px;">常見時段</div>
                      <div style="font-size:13px;">${(profile?.topHours || []).map(([k, v]) => `<span class="sf-pill" style="margin-right:4px;margin-bottom:4px;">${escapeHtml(k)} ${v}</span>`).join("") || "—"}</div>
                      <div style="margin-top:14px;padding-top:14px;border-top:var(--hairline);font-size:12px;color:var(--txt-3);">圖片訂單比例：${profile?.imageOrderRatio != null ? Math.round(profile.imageOrderRatio * 100) + "%" : "—"}（共 ${profile?.ordersSampledForImageRatio ?? 0} 筆）</div>
                    </div>
                  </div>
                </div>

                <div class="sf-card">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.mail}客訴歷史 <span class="sf-pill ${openComplaints > 0 ? "bad" : "ok"}" style="margin-left:6px;">${complaints.length} 筆／未解 ${openComplaints}</span></div></div>
                  <div style="padding:0;">
                    ${complaints.length ? complaints.slice(0, 10).map(c => {
                      const stPill = String(c.handle_status||"pending") === "resolved" ? '<span class="sf-pill ok">已解決</span>' : String(c.handle_status||"") === "handling" ? '<span class="sf-pill warn">處理中</span>' : '<span class="sf-pill bad">待處理</span>';
                      const txt = String(c.raw_message || "").replace(/\[圖片\]/g, "[圖]").trim();
                      const short = txt.length > 100 ? txt.slice(0, 100) + "…" : txt;
                      return `<a href="/admin/complaints/${encodeURIComponent(c.id)}" style="display:flex;gap:12px;padding:10px 16px;border-bottom:var(--hairline);text-decoration:none;color:inherit;align-items:flex-start;">
                        <span class="mono" style="font-size:11px;color:var(--txt-3);white-space:nowrap;">${escapeHtml(c.order_date)}</span>
                        <span style="flex:1;font-size:13px;">${escapeHtml(short || "（無內容）")}</span>
                        <span style="display:flex;gap:6px;align-items:center;">${stPill}${c.handler ? `<span style="font-size:11px;color:var(--txt-3);">${escapeHtml(c.handler)}</span>` : ""}</span>
                      </a>`;
                    }).join("") : `<p style="padding:18px;color:var(--txt-3);text-align:center;font-size:13px;margin:0;">無客訴紀錄</p>`}
                  </div>
                </div>

                <div class="sf-card">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.edit}客戶寫法學習</div><span class="sf-card-sub">系統從歷史訂單學到的「客戶寫法 → 標準品項」對應</span></div>
                  <div style="padding:0;">
                    ${hints.length ? `<table class="sf-table" style="font-size:13px;"><thead><tr><th>客戶寫法</th><th>對應品項</th><th style="text-align:right;">命中</th><th style="text-align:right;">糾錯</th><th>最後使用</th></tr></thead><tbody>${hints.map(h => `
                      <tr><td>${escapeHtml(h.raw_name_last || "—")}</td><td>${escapeHtml(h.product_name || "（未對應）")}</td><td style="text-align:right;" class="mono">${h.hit_count || 0}</td><td style="text-align:right;color:${(h.wrong_count||0) > 0 ? 'var(--bad)' : 'var(--txt-3)'};" class="mono">${h.wrong_count || 0}</td><td class="mono" style="font-size:11px;color:var(--txt-3);">${fmtTs(h.last_hit_at)}</td></tr>
                    `).join("")}</tbody></table>` : `<p style="padding:18px;color:var(--txt-3);text-align:center;font-size:13px;margin:0;">尚未累積學習資料</p>`}
                  </div>
                </div>

                <div class="sf-card">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.clipboard}最近 5 張訂單</div><a href="/admin/orders?customer_id=${encodeURIComponent(cid)}" class="sf-card-sub">查看全部 →</a></div>
                  <div style="padding:0;">
                    ${recentOrders.length ? recentOrders.map(o => `
                      <a href="/admin/orders/${encodeURIComponent(o.id)}" style="display:flex;gap:12px;padding:10px 16px;border-bottom:var(--hairline);text-decoration:none;color:inherit;align-items:center;">
                        <span class="mono" style="font-size:12px;color:var(--txt-3);white-space:nowrap;">${escapeHtml(o.order_date)}</span>
                        <span class="mono" style="font-size:12px;">${escapeHtml(o.order_no || o.id.slice(0,8))}</span>
                        <span style="flex:1;font-size:13px;">${o.item_count} 項</span>
                        ${statusBadge(o.status)}
                      </a>
                    `).join("") : `<p style="padding:18px;color:var(--txt-3);text-align:center;font-size:13px;margin:0;">尚無訂單</p>`}
                  </div>
                </div>
              </div>`;
            res.type("text/html").send(notionPage("客戶 360：" + customer.name, body, "customers", res));
        } catch (e) {
            console.error("[admin] /customers/:id/360 failed", e);
            res.status(500).send("載入客戶檔案失敗：" + (e?.message || e));
        }
    });
    router.post("/customers/:id/handover-notes", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const cid = String(req.params.id || "").trim();
        const notes = String(req.body?.crm_handover_notes || "").trim().slice(0, 4000);
        const customer = await db.prepare("SELECT id, name FROM customers WHERE id = ?").get(cid);
        if (!customer) { res.status(404).send("找不到客戶"); return; }
        await db.prepare("UPDATE customers SET crm_handover_notes = ? WHERE id = ?").run(notes || null, cid);
        await logDataChange(req, {
            entityType: "customer",
            entityId: cid,
            action: "edit_handover_notes",
            summary: `編輯交接備註（${customer.name}）`,
            meta: { length: notes.length, source: "360_page" },
        });
        res.redirect("/admin/customers/" + encodeURIComponent(cid) + "/360?ok=handover_saved");
    });
    router.get("/customers/:id/edit", async (req, res) => {
        try {
            const customer = await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, route_line, known_sub_customers FROM customers WHERE id = ?").get(req.params.id);
            if (!customer) {
                res.status(404).send("客戶不存在");
                return;
            }
            const v = (s) => escapeAttr(s ?? "");
            const activeChecked = customer.active === undefined || customer.active === null || customer.active === 1;
            // 群組功能白名單（辨識訂單／盤點／空籃）：以此客戶綁定的 LINE 群組 ID 為鍵；無設定＝三項全開。
            const hasGroupId = !!(customer.line_group_id && String(customer.line_group_id).trim());
            const gfeat = await group_features_js_1.getGroupFeatures(db, customer.line_group_id);
            // POST /customers/:id/edit 失敗會重導 ?err=（name／「群組已綁定其他客戶」完整訊息／儲存失敗）；
            // 舊版只認 alias/dup，其他訊息被吞掉（伺服器有擋、使用者無感），未知代碼一律原文顯示。
            const editErrRaw = typeof req.query.err === "string" ? req.query.err : "";
            const editErrMsg = editErrRaw === "alias" ? "請填寫別名與品項。"
                : editErrRaw === "dup" ? "此客戶已存在相同別名。"
                : editErrRaw === "name" ? "請填寫客戶名稱後再送出。"
                : editErrRaw;
            const editMsg = req.query.ok === "alias" ? "<p style='color:green'>已新增專用別名。</p>"
                : req.query.ok === "alias_del" ? "<p style='color:green'>已刪除專用別名。</p>"
                : editErrMsg ? `<p style='color:red'>${escapeHtml(editErrMsg)}</p>`
                : "";
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
            .map((a) => `<tr><td>${escapeHtml(a.alias)}</td><td>${escapeHtml(a.product_name)}</td><td><form method="post" action="/admin/customers/${encodeURIComponent(customer.id)}/alias/${encodeURIComponent(a.id)}/delete" style="display:inline;" onsubmit="return confirm('確定刪除「${escapeAttr(escJsStr(a.alias))}」？')"><button type="submit">刪除</button></form></td></tr>`)
            .join("");
            let profileSection = "";
            try {
                const profile = await customer_profile_js_1.computeCustomerProfile(db, customer.id);
                const sheetText = await customer_profile_js_1.buildCustomerCheatSheetText(db, customer.id);
                if (profile) {
                    const unitsLine = profile.topUnits.length
                        ? profile.topUnits.map((x) => `${escapeHtml(x.unit)}（${x.count}）`).join("、")
                        : "—";
                    const itemsLine = profile.topItems.length
                        ? profile.topItems.slice(0, 18).map((x) => escapeHtml(x.name)).join("、") + (profile.topItems.length > 18 ? "…" : "")
                        : "—";
                    const hotspots = profile.errorHotspots.length
                        ? profile.errorHotspots.slice(0, 12).map((x) => `${escapeHtml(x.name)}（${x.fixCount}）`).join("、")
                        : "—";
                    const imgPct = profile.imageOrderRatio != null && profile.ordersSampledForImageRatio > 0
                        ? `${Math.round(profile.imageOrderRatio * 100)}%（樣本訂單 ${profile.ordersSampledForImageRatio} 筆）`
                        : "—";
                    profileSection = `
        <div class="notion-card">
          <h2 style="margin-top:0;">客戶畫像（自動生成）</h2>
          <p class="notion-hint">由歷史叫貨、別名與後台改正紀錄彙總；Gemini 解析時會附於提示前方。下列「改正熱區」來自後台將明細對應到不同品項之次數。</p>
          <table class="notion-table-like" style="width:100%;font-size:14px;border-collapse:collapse;"><tbody>
            <tr><td style="padding:6px 8px;border-bottom:1px solid var(--notion-border);vertical-align:top;width:140px;"><strong>常用單位 Top5</strong></td><td style="padding:6px 8px;border-bottom:1px solid var(--notion-border);">${unitsLine}</td></tr>
            <tr><td style="padding:6px 8px;border-bottom:1px solid var(--notion-border);vertical-align:top;"><strong>常用品項 Top（節錄）</strong></td><td style="padding:6px 8px;border-bottom:1px solid var(--notion-border);">${itemsLine}</td></tr>
            <tr><td style="padding:6px 8px;border-bottom:1px solid var(--notion-border);vertical-align:top;"><strong>有附圖之訂單占比</strong></td><td style="padding:6px 8px;border-bottom:1px solid var(--notion-border);">${escapeHtml(imgPct)}（高者可能常拍照手寫／雙欄表）</td></tr>
            <tr><td style="padding:6px 8px;border-bottom:1px solid var(--notion-border);vertical-align:top;"><strong>多子客戶／分店</strong></td><td style="padding:6px 8px;border-bottom:1px solid var(--notion-border);">${profile.multiSubCustomer ? `是（曾見 ${profile.distinctSubCount} 種不同標籤）` : "否"}</td></tr>
            <tr><td style="padding:6px 8px;vertical-align:top;"><strong>改正熱區</strong></td><td style="padding:6px 8px;">${hotspots}</td></tr>
          </tbody></table>
          <details style="margin-top:12px;"><summary style="cursor:pointer;color:var(--notion-accent);">給模型的完整 cheat sheet 文字</summary>
          <pre style="white-space:pre-wrap;font-size:12px;background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);margin-top:8px;">${escapeHtml(sheetText || "")}</pre>
          </details>
        </div>`;
                }
            }
            catch (pe) {
                console.error("[admin] customer profile section", pe?.message || pe);
            }
            // 凌越客戶主檔（erp_customers 快照，內網代理同步）：hq_cust_code＝凌越 CT_NO。
            // 唯讀顯示（永遠跟凌越同步，不用抄進網站欄位）；「帶入聯絡方式」只是把電話填進上方表單方便存檔。
            let erpSection = "";
            try {
                const hq = String(customer.hq_cust_code || "").trim();
                if (hq) {
                    const erps = (await db.prepare("SELECT icpno, ctno, name, short_name, addr1, addr2, tel1, tel2, fax, unino, boss, contact, fkfs, sales, stop, updated_at FROM erp_customers WHERE ctno = ? ORDER BY icpno").all(hq)) || [];
                    const fld = (label, val) => (val && String(val).trim() ? `<tr><td style="padding:5px 8px;color:var(--txt-3);white-space:nowrap;width:90px;">${label}</td><td style="padding:5px 8px;">${escapeHtml(String(val).trim())}</td></tr>` : "");
                    const blocks = erps.map((r) => {
                        const stopped = ["1", "Y", "YES", "TRUE"].includes(String(r.stop || "").trim().toUpperCase());
                        const telVal = String(r.tel1 || r.tel2 || "").trim();
                        return `
                        <div style="flex:1;min-width:260px;border:var(--hairline);border-radius:var(--radius-md);padding:10px 12px;">
                          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <span class="sf-pill" style="font-size:11px;">${escapeHtml((0, erp_companies_js_1.erpCompanyName)(r.icpno))}</span>
                            <span class="mono" style="font-size:12px;color:var(--txt-3);">${escapeHtml(r.ctno)}</span>
                            ${stopped ? '<span class="sf-pill" style="font-size:10px;">凌越停用</span>' : ""}
                            ${telVal ? `<button type="button" class="sf-btn sm erp-fill-contact" data-v="${escapeAttr(telVal)}" style="margin-left:auto;">帶入聯絡方式</button>` : ""}
                          </div>
                          <table style="width:100%;font-size:13px;border-collapse:collapse;"><tbody>
                            ${fld("名稱", r.name)}${fld("簡稱", r.short_name)}
                            ${fld("地址", r.addr1)}${fld("地址2", r.addr2)}
                            ${fld("電話", [r.tel1, r.tel2].filter((x) => x && String(x).trim()).join(" / "))}
                            ${fld("傳真", r.fax)}${fld("統編", r.unino)}
                            ${fld("負責人", r.boss)}${fld("聯絡人", r.contact)}
                            ${fld("付款方式", r.fkfs)}${fld("業務員", r.sales)}
                          </tbody></table>
                        </div>`;
                    }).join("");
                    erpSection = `
                    <div class="sf-card" style="margin-top:14px;">
                      <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.doc} 凌越主檔資料（自動同步，唯讀）</div>
                        <span class="sf-card-sub">${erps.length ? "來自凌越客戶主檔，內網代理隨庫存推送更新；要改請在凌越改" : ""}<a href="/admin/customers/erp?q=${encodeURIComponent(hq)}" style="margin-left:8px;">總表</a></span></div>
                      <div style="padding:12px 16px;">
                        ${erps.length
                            ? `<div style="display:flex;gap:12px;flex-wrap:wrap;">${blocks}</div>`
                            : `<p style="margin:0;font-size:13px;color:var(--txt-2);">凌越編號 <code class="mono">${escapeHtml(hq)}</code> 查無主檔資料——可能編號不一致，或內網代理尚未同步客戶主檔（更新代理資料夾的 <code>ly_stock_push.py</code> 後會隨庫存推送自動同步）。</p>`}
                      </div>
                    </div>
                    <script>document.querySelectorAll(".erp-fill-contact").forEach(function(b){b.addEventListener("click",function(){var i=document.querySelector('input[name="contact"]');if(i){i.value=this.getAttribute("data-v")||"";i.focus();}});});</script>`;
                }
            }
            catch (ee) {
                console.error("[admin] customer erp section", ee?.message || ee);
            }
        const editBody = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / 編輯客戶</div>
        <h1 class="notion-page-title">編輯客戶</h1>
        ${editMsg ? `<div class="notion-msg ${editMsg.indexOf("已") >= 0 ? "ok" : "err"}">${editMsg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="sf-card">
          <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.edit} 客戶資料</div></div>
          <form method="post" action="/admin/customers/${v(customer.id)}/edit" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
            ${req.query.from === "orders" ? '<input type="hidden" name="from" value="orders">' : ""}
            <label style="font-size:12px;color:var(--txt-2);">客戶名稱 <input class="sf-input" type="text" name="name" value="${v(customer.name)}" required style="margin-top:4px;"></label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label style="font-size:12px;color:var(--txt-2);flex:1;min-width:150px;">寺岡編號（CustCode／QR） <input class="sf-input" type="text" name="teraoka_code" value="${v(customer.teraoka_code)}" style="margin-top:4px;"></label>
              <label style="font-size:12px;color:var(--txt-2);flex:1;min-width:150px;">凌越編號（HQCustCode） <input class="sf-input" type="text" name="hq_cust_code" value="${v(customer.hq_cust_code)}" style="margin-top:4px;"></label>
            </div>
            <label style="font-size:12px;color:var(--txt-2);">LINE 群組名稱 <input class="sf-input" type="text" name="line_group_name" value="${v(customer.line_group_name)}" placeholder="可之後填" style="margin-top:4px;"></label>
            <label style="font-size:12px;color:var(--txt-2);">LINE 群組 ID <input class="sf-input" type="text" name="line_group_id" value="${v(customer.line_group_id)}" placeholder="C開頭，綁定後機器人會認此群組" style="margin-top:4px;"></label>
            <label style="font-size:12px;color:var(--txt-2);">聯絡方式 <input class="sf-input" type="text" name="contact" value="${v(customer.contact)}" style="margin-top:4px;"></label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label style="font-size:12px;color:var(--txt-2);flex:1;min-width:150px;">第幾號線（檢貨路線）
                <select class="sf-input" name="route_line" style="margin-top:4px;"><option value="">— 不指定</option>${[1,2,3,4,5,6,7,8,9].map((n) => `<option value="${n}" ${customer.route_line === n ? "selected" : ""}>${n} 號線</option>`).join("")}</select>
              </label>
              <label style="font-size:12px;color:var(--txt-2);flex:1;min-width:150px;">預設單位（客戶只打數字未填單位）
                <select class="sf-input" name="default_unit" style="margin-top:4px;"><option value="" ${!customer.default_unit ? "selected" : ""}>公斤（預設）</option>${ORDER_LINE_UNITS.map((u) => `<option value="${escapeAttr(u)}" ${customer.default_unit === u ? "selected" : ""}>${escapeHtml(u)}</option>`).join("")}</select>
              </label>
            </div>
            <label style="font-size:12px;color:var(--txt-2);">叫貨備註／習慣說明 <textarea class="sf-input" name="order_notes" placeholder="此客戶叫貨的習慣、特定說法或規則，僅供內部參考" style="margin-top:4px;min-height:60px;">${v(customer.order_notes)}</textarea></label>
            <label style="font-size:12px;color:var(--txt-2);">專屬子客戶/分店名單（逗號分隔） <input class="sf-input" type="text" name="known_sub_customers" value="${v(customer.known_sub_customers)}" placeholder="例：東大附小,豐源國小,馬蘭國小" style="margin-top:4px;"></label>
            <label class="sf-switch-label" style="font-size:13px;color:var(--txt-1);"><input type="checkbox" name="active" value="1" ${activeChecked ? "checked" : ""}><span class="sf-switch"></span>啟用（未勾選＝停用）</label>
            <div style="border-top:1px solid var(--line, #eceae5);margin-top:4px;padding-top:12px;">
              <div style="font-size:12px;color:var(--txt-2);margin-bottom:2px;font-weight:600;">此群組功能（白名單）</div>
              <p style="margin:0 0 10px;font-size:12px;color:var(--txt-3);line-height:1.5;">勾選＝開啟。辨識訂單／空籃預設開、<b>盤點預設關</b>（白名單制）。關閉「辨識訂單」後，機器人仍會收訊息、仍回應 <b>#盤點</b>／<b>空籃</b>／取得群組ID 等指令，只是<b>不把一般文字當訂單解析</b>（適合內部群）。${hasGroupId ? "" : "<br><span style=\"color:var(--bad,#b3261e);\">尚未填 LINE 群組 ID，功能設定要先綁定群組 ID 才會生效。</span>"}</p>
              <input type="hidden" name="feat_form" value="1">
            <div style="display:flex;flex-wrap:wrap;gap:16px;">
                <label class="sf-switch-label"><input type="checkbox" name="feat_order" value="1" ${gfeat.order ? "checked" : ""}><span class="sf-switch"></span>辨識訂單</label>
                <label class="sf-switch-label"><input type="checkbox" name="feat_stocktake" value="1" ${gfeat.stocktake ? "checked" : ""}><span class="sf-switch"></span>盤點（#盤點）</label>
                <label class="sf-switch-label"><input type="checkbox" name="feat_basket" value="1" ${gfeat.basket ? "checked" : ""}><span class="sf-switch"></span>空籃</label>
              </div>
            </div>
            <div style="margin-top:6px;"><button type="submit" class="sf-btn primary">${SF_ICONS.check}<span>儲存</span></button></div>
          </form>
        </div>
        ${erpSection}
        <div class="sf-card" style="margin-top:14px;">
          <div class="sf-card-head"><div class="sf-card-title">此客戶專用別名（叫貨習慣）</div></div>
          <div style="padding:14px 16px;">
            <p style="margin:0 0 10px;font-size:13px;color:var(--txt-2);">此客戶在 LINE 叫貨時若輸入下列名稱，會對應到指定品項（僅此客戶適用）。</p>
            <div class="sf-table-wrap"><table class="sf-table" style="font-size:13px;">
              <thead><tr><th>客戶常叫的名稱</th><th>對應品項</th><th style="width:60px;">操作</th></tr></thead>
              <tbody>${aliasRows || "<tr><td colspan='3' style='padding:16px;text-align:center;color:var(--txt-3);'>尚無專用別名</td></tr>"}</tbody>
            </table></div>
            <form method="post" action="/admin/customers/${v(customer.id)}/alias" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <span style="font-size:13px;color:var(--txt-2);">新增：客戶叫</span>
              <input class="sf-input" type="text" name="alias" required placeholder="例：大陸妹" style="width:140px;">
              <span style="font-size:13px;color:var(--txt-2);">→ 對應</span>
              <select class="sf-input" name="product_id" required style="max-width:220px;">${productOptions}</select>
              <button type="submit" class="sf-btn sm primary">新增</button>
            </form>
          </div>
        </div>
        ${profileSection}
        <p>${req.query.from === "orders" ? `<a href="/admin/orders">← 回訂單審核</a>` : `<a href="/admin/customers">← 回客戶列表</a>`}</p>
      `;
            res.type("text/html").send(notionPage("編輯客戶", editBody, "", res));
        }
        catch (e) {
            console.error("[admin] 客戶編輯頁錯誤:", e);
            res.redirect("/admin/customers?err=" + encodeURIComponent("載入失敗：" + (e.message || String(e)).slice(0, 80)));
        }
    });
    router.post("/customers/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || (req.get("Accept") || "").includes("application/json");
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
        const knownSubCustomers = req.body.known_sub_customers?.trim() || null;
        const active = req.body.active === "1" ? 1 : 0;
        if (!name) {
            if (wantsJson) { res.status(400).json({ ok: false, error: "請填客戶名稱" }); return; }
            res.redirect("/admin/customers/" + encodeURIComponent(id) + "/edit?err=name");
            return;
        }
        // [fix 2026-07-08] 同一 LINE 群組不可綁到兩個客戶，否則該群組叫貨歸屬會錯亂。
        if (lineGroupId) {
            const clash = await db.prepare("SELECT id, name FROM customers WHERE line_group_id = ? AND id != ? LIMIT 1").get(lineGroupId, id);
            if (clash) {
                const msg = `此 LINE 群組已綁定客戶「${clash.name || clash.id}」，不能重複綁定（會造成叫貨歸屬錯亂）。請先解除該客戶的群組綁定。`;
                if (wantsJson) { res.status(409).json({ ok: false, error: msg }); return; }
                res.redirect("/admin/customers/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent(msg));
                return;
            }
        }
        try {
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            await db.prepare("UPDATE customers SET name = ?, teraoka_code = ?, hq_cust_code = ?, line_group_name = ?, line_group_id = ?, contact = ?, route_line = ?, default_unit = ?, order_notes = ?, known_sub_customers = ?, active = ?, updated_at = " + nowSql + " WHERE id = ?").run(name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact, routeLine, defaultUnit, orderNotes, knownSubCustomers, active, id);
            if (lineGroupId) {
                try {
                    await db.prepare("DELETE FROM pending_line_groups WHERE group_id = ?").run(lineGroupId);
                }
                catch (_) { /* 表可能尚未建立 */ }
                // 群組功能白名單（辨識訂單／盤點／空籃）以綁定的群組 ID 為鍵存 group_features。
                // 只在完整編輯表單（含 feat_form 標記）時寫入，避免部分欄位的 AJAX 儲存把開關全清成關。
                if (req.body.feat_form === "1") {
                    try {
                        await setGroupFeaturesAudited(req, lineGroupId, {
                            order: req.body.feat_order === "1",
                            stocktake: req.body.feat_stocktake === "1",
                            basket: req.body.feat_basket === "1",
                        }, "客戶編輯");
                    }
                    catch (e) { console.warn("[admin] group_features 儲存失敗:", e?.message || e); }
                }
            }
        }
        catch (e) {
            // [fix 2026-07-27 體檢] 撞到 ux_customers_line_group＝上面的先查後寫被併發插隊，
            // 回可行動訊息（守則 #4）而不是「儲存失敗」四個字。
            if (isLineGroupUniqueViolation(e)) {
                const msg = "此 LINE 群組剛被綁到其他客戶（可能同時有人在操作），請重新整理本頁確認後再存";
                if (wantsJson) { res.status(409).json({ ok: false, error: msg }); return; }
                res.redirect("/admin/customers/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent(msg));
                return;
            }
            console.error("[admin] 客戶儲存失敗:", e?.message || e);
            if (wantsJson) { res.status(500).json({ ok: false, error: "儲存失敗：" + (e?.message || String(e)).slice(0, 120) }); return; }
            res.redirect("/admin/customers/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("儲存失敗"));
            return;
        }
        if (wantsJson) { res.json({ ok: true }); return; }
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
    // === 凌越客戶主檔（erp_customers 快照）===
    // 內網代理（ly_stock_push.py）隨庫存推送整批同步凌越客戶主檔(000001)上來，按公司覆蓋。
    // 這頁是唯讀總表：搜尋、公司切換、與網站客戶比對（hq_cust_code＝凌越 CT_NO）、一鍵建立網站客戶。
    router.get("/customers/erp", async (req, res) => {
        try {
            let coRows = [];
            try {
                coRows = (await db.prepare("SELECT COALESCE(NULLIF(TRIM(icpno),''),'00') AS c, COUNT(*) AS n FROM erp_customers GROUP BY c ORDER BY c").all()) || [];
            }
            catch (_) { coRows = []; }
            const companies = coRows.map((r) => (0, erp_companies_js_1.normIcpno)(r.c));
            const counts = {};
            coRows.forEach((r) => { counts[(0, erp_companies_js_1.normIcpno)(r.c)] = Number(r.n || 0); });
            const icpno = (0, erp_companies_js_1.normIcpno)(req.query.icpno, companies[0] || "00");
            const q = String(req.query.q || "").trim();
            const LIMIT = 800;
            const rows = q
                ? await db.prepare("SELECT ctno, name, short_name, addr1, addr2, tel1, tel2, fax, unino, boss, contact, fkfs, sales, stop FROM erp_customers WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND (ctno LIKE ? OR name LIKE ? OR addr1 LIKE ? OR tel1 LIKE ? OR unino LIKE ?) ORDER BY ctno LIMIT " + LIMIT).all(icpno, "%" + q + "%", "%" + q + "%", "%" + q + "%", "%" + q + "%", "%" + q + "%")
                : await db.prepare("SELECT ctno, name, short_name, addr1, addr2, tel1, tel2, fax, unino, boss, contact, fkfs, sales, stop FROM erp_customers WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? ORDER BY ctno LIMIT " + LIMIT).all(icpno);
            // 網站客戶對照：hq_cust_code（凌越 CT_NO）→ 網站客戶
            const siteMap = {};
            try {
                ((await db.prepare("SELECT id, name, hq_cust_code FROM customers WHERE hq_cust_code IS NOT NULL AND TRIM(hq_cust_code) <> ''").all()) || [])
                    .forEach((c) => { siteMap[String(c.hq_cust_code).trim()] = c; });
            }
            catch (_) { }
            let snapshotAt = "";
            try {
                const s = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_customers_snapshot_at_" + icpno);
                snapshotAt = String(s?.value || "").replace("T", " ").slice(0, 19);
            }
            catch (_) { }
            const isStopped = (v) => ["1", "Y", "YES", "TRUE"].includes(String(v || "").trim().toUpperCase());
            const coSeg = companies.length > 1
                ? `<div class="sf-seg" style="display:inline-flex;">${companies.map((c) => `<a class="${c === icpno ? "active" : ""}" href="/admin/customers/erp?icpno=${c}${q ? "&q=" + encodeURIComponent(q) : ""}">${escapeHtml((0, erp_companies_js_1.erpCompanyName)(c))} <span class="mono" style="font-size:11px;opacity:.7;">${counts[c] ?? ""}</span></a>`).join("")}</div>`
                : "";
            const trows = rows.map((r) => {
                const site = siteMap[String(r.ctno).trim()];
                const stopped = isStopped(r.stop);
                const tel = [r.tel1, r.tel2].filter((x) => x && String(x).trim()).map((x) => escapeHtml(x)).join(" / ");
                const addr = escapeHtml(r.addr1 || "") + (r.addr2 && String(r.addr2).trim() ? `<div style="color:var(--txt-3);">${escapeHtml(r.addr2)}</div>` : "");
                const siteCell = site
                    ? `<a href="/admin/customers/${encodeURIComponent(site.id)}/edit" style="color:var(--accent);text-decoration:none;">${escapeHtml(site.name)}</a>`
                    : `<a class="sf-btn sm" href="/admin/customers/new?name=${encodeURIComponent(r.name || "")}&hq_cust_code=${encodeURIComponent(r.ctno)}&contact=${encodeURIComponent(r.tel1 || "")}">${SF_ICONS.plus}<span>建立客戶</span></a>`;
                return `<tr${stopped ? ' style="opacity:.55;"' : ""}>
                  <td class="mono" style="font-size:12px;white-space:nowrap;">${escapeHtml(r.ctno)}</td>
                  <td><div style="font-weight:500;">${escapeHtml(r.name || "")}</div>${r.short_name && String(r.short_name).trim() ? `<div style="font-size:11px;color:var(--txt-3);">${escapeHtml(r.short_name)}</div>` : ""}${stopped ? '<span class="sf-pill" style="font-size:10px;">停用</span>' : ""}</td>
                  <td style="font-size:12px;">${addr || "<span style='color:var(--txt-3);'>—</span>"}</td>
                  <td class="mono" style="font-size:12px;white-space:nowrap;">${tel || "—"}</td>
                  <td class="mono" style="font-size:12px;">${escapeHtml(r.unino || "") || "—"}</td>
                  <td style="font-size:12px;">${escapeHtml(r.boss || r.contact || "") || "—"}</td>
                  <td class="mono" style="font-size:12px;">${escapeHtml(r.fkfs || "")}${r.sales && String(r.sales).trim() ? ` / ${escapeHtml(r.sales)}` : ""}</td>
                  <td>${siteCell}</td>
                </tr>`;
            }).join("");
            const emptyHint = companies.length === 0
                ? `<div class="notion-card" style="margin-top:14px;"><p style="margin:0;color:var(--txt-2);">尚無凌越客戶主檔資料。內網「凌越整合代理」更新 <code>ly_stock_push.py</code> 後，客戶主檔會隨每次庫存推送自動同步上來（也可在庫存管理按「庫存更新」立即觸發）。</p></div>`
                : "";
            const body = `
            <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:14px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
              <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                <div>
                  <div class="sf-breadcrumb" style="margin-bottom:6px;"><a href="/admin/customers" style="color:inherit;text-decoration:none;">主檔管理 / 客戶管理</a> / 凌越客戶主檔</div>
                  <h1 style="margin:0;font-size:22px;font-weight:600;">凌越客戶主檔</h1>
                  <div style="font-size:12px;color:var(--txt-3);margin-top:4px;">唯讀快照，由內網代理隨庫存推送自動同步${snapshotAt ? `；最後同步 ${escapeHtml(snapshotAt)}` : ""}。要改資料請在凌越改，下次推送自動更新。</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">${coSeg}</div>
              </div>
              <form method="get" action="/admin/customers/erp" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <input type="hidden" name="icpno" value="${escapeAttr(icpno)}">
                <div style="position:relative;flex:0 0 320px;">
                  <input class="sf-input" name="q" value="${escapeAttr(q)}" placeholder="搜尋 編號／名稱／地址／電話／統編..." style="padding-left:28px;">
                  <span style="position:absolute;left:8px;top:10px;color:var(--txt-3);">${SF_ICONS.search}</span>
                </div>
                <button class="sf-btn" type="submit">${SF_ICONS.search}<span>搜尋</span></button>
                ${q ? `<a class="sf-btn ghost" href="/admin/customers/erp?icpno=${escapeAttr(icpno)}">清除</a>` : ""}
                <span style="font-size:12px;color:var(--txt-3);">共 ${rows.length}${rows.length >= LIMIT ? "+（已達顯示上限，請用搜尋縮小）" : ""} 筆</span>
              </form>
              ${emptyHint}
              <div class="sf-table-wrap">
                <table class="sf-table">
                  <thead><tr>
                    <th style="width:90px;">編號</th><th>名稱</th><th>地址</th><th style="width:130px;">電話</th>
                    <th style="width:90px;">統編</th><th style="width:90px;">負責人</th><th style="width:110px;">付款/業務</th><th style="width:150px;">網站客戶</th>
                  </tr></thead>
                  <tbody>${trows || `<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--txt-3);">${q ? "無符合資料" : "此公司尚無客戶主檔資料"}</td></tr>`}</tbody>
                </table>
              </div>
            </div>`;
            res.type("text/html").send(notionPage("凌越客戶主檔", body, "customers", res));
        }
        catch (e) {
            console.error("[admin] 凌越客戶主檔頁錯誤:", e?.message || e);
            res.redirect("/admin/customers?err=" + encodeURIComponent("凌越客戶主檔載入失敗：" + (e?.message || String(e)).slice(0, 80)));
        }
    });
    // 匯出客戶清單 CSV（含路線、綁定、狀態）——可用來對帳凌越當日出貨、找出沒下單的客戶
    router.get("/customers/export.csv", async (req, res) => {
        try {
            const rows = await db.prepare("SELECT name, route_line, teraoka_code, hq_cust_code, line_group_id, active FROM customers ORDER BY name").all();
            const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
            const lines = [["客戶名稱", "路線", "寺岡編號", "凌越編號", "已綁定LINE", "狀態"].join(",")];
            for (const r of (rows || [])) {
                const isActive = !(r.active === 0 || r.active === "0");
                lines.push([r.name, r.route_line ?? "", r.teraoka_code ?? "", r.hq_cust_code ?? "", r.line_group_id ? "是" : "", isActive ? "啟用" : "停用"].map(esc).join(","));
            }
            const csv = "﻿" + lines.join("\r\n");
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", 'attachment; filename="customers.csv"');
            res.send(csv);
        }
        catch (e) {
            res.status(500).send("匯出失敗：" + (e?.message || String(e)));
        }
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
            ? await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, route_line, default_unit, order_notes, known_sub_customers, active FROM customers WHERE name LIKE ? ORDER BY name").all("%" + q + "%")
            : await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, route_line, default_unit, order_notes, known_sub_customers, active FROM customers ORDER BY name").all());
        const makeRow = (r) => {
            const active = r.active === 1 || r.active === "1" || r.active === undefined || r.active === null;
            const bound = !!r.line_group_id;
            const initial = (r.name || "?").charAt(0).toUpperCase();
            const groupCell = bound
                ? `<div style="display:flex;align-items:center;gap:6px;">
                     <span style="color:var(--ok);display:inline-flex;">${SF_ICONS.check}</span>
                     <code class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml((r.line_group_id||"").slice(0,12))}${r.line_group_id && r.line_group_id.length > 12 ? "…" : ""}</code>
                     ${r.line_group_name ? `<span style="font-size:11px;color:var(--txt-3);">· ${escapeHtml(r.line_group_name)}</span>` : ""}
                   </div>`
                : `<span class="sf-pill warn">${SF_ICONS.warn}<span>尚未綁定</span></span>`;
            const codeCell = `<span class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml(r.teraoka_code ?? "—")} / ${escapeHtml(r.hq_cust_code ?? "—")}</span>`;
            return `<tr class="customer-row" data-customer-id="${escapeAttr(r.id)}" style="cursor:pointer;">
            <td><span class="sf-dot ${active ? "ok" : ""}"></span></td>
            <td>
              <div class="cust-name-cell" style="display:flex;align-items:center;gap:8px;">
                <span class="sf-avatar" style="background:${bound?"var(--accent)":"var(--txt-3)"};">${escapeHtml(initial)}</span>
                <div>
                  <div class="cust-name-text" style="font-size:13px;font-weight:500;">${escapeHtml(r.name)}</div>
                  <div class="mono" style="font-size:10px;color:var(--txt-3);">${escapeHtml(r.id)}</div>
                </div>
                ${r.route_line ? `<span class="sf-pill cust-route-pill" title="檢貨路線" style="margin-left:auto;font-size:11px;background:var(--bg-2);color:var(--txt-2);">路線 ${escapeHtml(String(r.route_line))}</span>` : ""}
              </div>
            </td>
            <td>${groupCell}</td>
            <td>${codeCell}</td>
            <td class="cust-contact-cell" style="font-size:12px;color:var(--txt-2);">${escapeHtml(r.contact ?? "")}</td>
            <td style="text-align:right;" class="customer-status-cell">${active ? `<span class="sf-pill ok">啟用</span>` : `<span class="sf-pill">停用</span>`}</td>
            <td style="white-space:nowrap;">
              <a class="sf-btn sm" href="/admin/customers/${encodeURIComponent(r.id)}/360" title="客戶完整檔案">${SF_ICONS.spark}</a>
              <button type="button" class="sf-btn sm customer-edit-btn" title="編輯"
                data-id="${escapeAttr(r.id)}"
                data-name="${escapeAttr(r.name ?? "")}"
                data-teraoka_code="${escapeAttr(r.teraoka_code ?? "")}"
                data-hq_cust_code="${escapeAttr(r.hq_cust_code ?? "")}"
                data-line_group_name="${escapeAttr(r.line_group_name ?? "")}"
                data-line_group_id="${escapeAttr(r.line_group_id ?? "")}"
                data-contact="${escapeAttr(r.contact ?? "")}"
                data-route_line="${escapeAttr(r.route_line != null ? String(r.route_line) : "")}"
                data-default_unit="${escapeAttr(r.default_unit ?? "")}"
                data-order_notes="${escapeAttr(r.order_notes ?? "")}"
                data-known_sub_customers="${escapeAttr(r.known_sub_customers ?? "")}"
                data-active="${active ? "1" : "0"}">${SF_ICONS.edit}</button>
            </td>
          </tr>`;
        };
        const isCustomerActive = (r) => r.active === 1 || r.active === "1" || r.active === undefined || r.active === null;
        const isBound = (r) => !!(r.line_group_id && String(r.line_group_id).trim());
        // 三組：已綁定（active+bound）、未綁定（active+unbound）、停用（!active）
        const boundList = rows.filter(r => isCustomerActive(r) && isBound(r));
        const unboundList = rows.filter(r => isCustomerActive(r) && !isBound(r));
        const inactiveList = rows.filter(r => !isCustomerActive(r));
        const tbodyBound = boundList.map(makeRow).join("") || "<tr class=\"customers-placeholder\"><td colspan='7' style='padding:24px;text-align:center;color:var(--txt-3);'>無已綁定客戶</td></tr>";
        const tbodyUnbound = unboundList.map(makeRow).join("") || "<tr class=\"customers-placeholder\"><td colspan='7' style='padding:24px;text-align:center;color:var(--txt-3);'>所有啟用中客戶皆已綁定 LINE</td></tr>";
        const tbodyInactive = inactiveList.map(makeRow).join("") || "<tr class=\"customers-placeholder\"><td colspan='7' style='padding:24px;text-align:center;color:var(--txt-3);'>無停用客戶</td></tr>";
        const searchVal = escapeAttr(q);
        // 統計
        const totalN = rows.length;
        const boundN = boundList.length;
        const unboundN = unboundList.length;
        const inactiveN = inactiveList.length;
        const okMsg = req.query.ok === "1" ? "客戶已建立。"
            : req.query.ok === "edit" ? "已儲存。"
            : req.query.ok === "del" ? "已刪除。" : "";
        const errMsg = req.query.err ? String(req.query.err) : "";
        // 待綁定 LINE 群組：機器人加入新群組或在未綁定群組收到訊息時自動登錄
        let pendingGroups = [];
        try {
            pendingGroups = await db.prepare("SELECT group_id, source_type, group_name, first_seen_at, last_seen_at FROM pending_line_groups ORDER BY last_seen_at DESC").all();
        }
        catch (_) { /* 表可能尚未建立 */ }
        const pendingRows = pendingGroups.map((g, i) => {
            const gid = String(g.group_id || "");
            const gidShort = gid.length > 14 ? gid.slice(0, 6) + "…" + gid.slice(-6) : gid;
            const gname = g.group_name && String(g.group_name).trim() !== "" ? escapeHtml(String(g.group_name)) : `<span style="color:var(--txt-3);">（未取得名稱）</span>`;
            const stype = g.source_type === "room" ? "聊天室" : g.source_type === "group" ? "群組" : "—";
            const seen = g.last_seen_at ? escapeHtml(String(g.last_seen_at).replace("T", " ").replace("Z", "").slice(0, 19)) : "—";
            return `
            <tr>
              <td>
                <div style="font-weight:500;">${gname}</div>
                <div style="font-size:11px;color:var(--txt-3);"><code class="mono">${escapeHtml(gidShort)}</code></div>
              </td>
              <td><span class="sf-pill">${stype}</span></td>
              <td class="mono" style="font-size:11px;color:var(--txt-3);white-space:nowrap;">${seen}</td>
              <td>
                <form method="post" action="/admin/customers/pending-bind" class="pgrp-bind-form" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0;">
                  <input type="hidden" name="group_id" value="${escapeAttr(gid)}">
                  <input type="hidden" name="group_name" value="${escapeAttr(g.group_name || "")}">
                  <input type="hidden" name="mode" value="existing">
                  <div class="pgrp-cust-picker" data-row="${i}" style="position:relative;min-width:220px;">
                    <input type="hidden" name="customer_id" class="pgrp-cust-id" value="">
                    <input type="text" class="pgrp-cust-search sf-input" autocomplete="off" placeholder="輸入客戶名稱搜尋…" style="width:220px;height:32px;">
                    <div class="pgrp-cust-dd" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:30;max-height:240px;overflow:auto;background:var(--bg-1);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 4px 12px rgba(0,0,0,.08);"></div>
                  </div>
                  <button type="submit" class="sf-btn sm primary">綁定</button>
                </form>
                <form method="post" action="/admin/customers/pending-bind" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 0 0;">
                  <input type="hidden" name="group_id" value="${escapeAttr(gid)}">
                  <input type="hidden" name="group_name" value="${escapeAttr(g.group_name || "")}">
                  <input type="hidden" name="mode" value="new">
                  <input type="text" name="name" placeholder="新客戶名稱" required class="sf-input" style="width:160px;height:32px;">
                  <select name="route_line" class="sf-input" style="width:110px;height:32px;" title="揀貨路線">
                    <option value="">路線…</option>
                    ${[1,2,3,4,5,6,7,8,9].map((n) => `<option value="${n}">${n} 號線</option>`).join("")}
                  </select>
                  <button type="submit" class="sf-btn sm">建立並綁定</button>
                </form>
                <form method="post" action="/admin/customers/pending-dismiss" style="display:inline;margin:6px 0 0 0;">
                  <input type="hidden" name="group_id" value="${escapeAttr(gid)}">
                  <button type="submit" class="sf-btn sm ghost" style="color:var(--txt-3);">忽略</button>
                </form>
              </td>
            </tr>`;
        }).join("");
        const pendingPanel = pendingGroups.length
            ? `
          <div class="sf-card" style="border-left:3px solid var(--accent);">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.link} 待綁定 LINE 群組 <span class="sf-pill warn" style="margin-left:4px;">${pendingGroups.length}</span></div>
              <span class="sf-card-sub">機器人加入群組後會自動列出</span>
            </div>
            <div style="padding:0;">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th>群組名稱 / ID</th>
                    <th style="width:80px;">類型</th>
                    <th style="width:160px;">最後出現</th>
                    <th>串聯動作</th>
                  </tr>
                </thead>
                <tbody>${pendingRows}</tbody>
              </table>
            </div>
          </div>
          <script>
          (function(){
            var pickers = document.querySelectorAll(".pgrp-cust-picker");
            if (!pickers.length) return;
            function escAttr(s){ return String(s || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;"); }
            function escHtml(s){ return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
            pickers.forEach(function(picker){
              var hidden = picker.querySelector(".pgrp-cust-id");
              var input = picker.querySelector(".pgrp-cust-search");
              var dd = picker.querySelector(".pgrp-cust-dd");
              var timer = null;
              function hide(){ dd.style.display = "none"; dd.innerHTML = ""; }
              function show(arr){
                if (!arr || !arr.length){
                  dd.innerHTML = '<div style="padding:8px 12px;color:var(--txt-3);font-size:13px;">無符合客戶</div>';
                } else {
                  dd.innerHTML = arr.map(function(c){
                    return '<div class="pgrp-cust-opt" data-id="' + escAttr(c.id) + '" data-name="' + escAttr(c.name) + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--line);font-size:14px;color:var(--txt-1);">' + escHtml(c.name) + '</div>';
                  }).join("");
                }
                dd.style.display = "block";
              }
              input.addEventListener("input", function(){
                hidden.value = "";
                var q = (this.value || "").trim();
                clearTimeout(timer);
                if (!q) { hide(); return; }
                timer = setTimeout(function(){
                  fetch("/admin/api/customers-search?q=" + encodeURIComponent(q), { credentials: "same-origin" })
                    .then(function(r){ return r.json(); })
                    .then(show)
                    .catch(hide);
                }, 180);
              });
              input.addEventListener("focus", function(){
                if ((this.value || "").trim() && dd.innerHTML) dd.style.display = "block";
              });
              dd.addEventListener("click", function(e){
                var opt = e.target.closest(".pgrp-cust-opt");
                if (!opt) return;
                hidden.value = opt.getAttribute("data-id") || "";
                input.value = opt.getAttribute("data-name") || "";
                hide();
              });
              document.addEventListener("click", function(e){ if (!picker.contains(e.target)) hide(); });
            });
            document.querySelectorAll(".pgrp-bind-form").forEach(function(f){
              f.addEventListener("submit", function(e){
                var hidden = f.querySelector(".pgrp-cust-id");
                if (!hidden || !hidden.value) {
                  e.preventDefault();
                  alert("請從搜尋結果中選擇要綁定的客戶");
                }
              });
            });
          })();
          </script>`
            : "";
        const statCard = (label, num, status, href) => `
          <a href="${href || "#"}" style="text-decoration:none;color:inherit;padding:10px 16px;background:var(--bg-1);border:var(--hairline);border-radius:var(--radius-md);flex:1;display:flex;align-items:center;gap:10px;min-width:160px;">
            <span class="sf-dot ${status}"></span>
            <div>
              <div style="font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">${label}</div>
              <div class="mono" style="font-size:18px;font-weight:600;">${num}</div>
            </div>
          </a>`;
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="sf-breadcrumb" style="margin-bottom:6px;">主檔管理 / 客戶管理</div>
              <h1 style="margin:0;font-size:22px;font-weight:600;">客戶管理</h1>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
              <a class="sf-btn" href="/admin/customers/erp">${SF_ICONS.doc}<span>凌越客戶主檔</span></a>
              <a class="sf-btn" href="/admin/customers/groups">${SF_ICONS.users}<span>群組功能</span></a>
              <a class="sf-btn" href="/admin/import-customers">${SF_ICONS.dl}<span>匯入 CSV</span></a>
              <a class="sf-btn" href="/admin/customers/export.csv">${SF_ICONS.dl}<span>匯出客戶 CSV</span></a>
              <a class="sf-btn" href="/admin/groups/export.xlsx">${SF_ICONS.dl}<span>下載群組 Excel</span></a>
              <a class="sf-btn" href="/admin/line-binding">${SF_ICONS.link}<span>LINE 綁定檢查</span></a>
              <a class="sf-btn primary" href="/admin/customers/new">${SF_ICONS.plus}<span>新增客戶</span></a>
            </div>
          </div>
          ${okMsg ? `<div class="sf-pill ok" style="align-self:flex-start;">${escapeHtml(okMsg)}</div>` : ""}
          ${errMsg ? `<div class="sf-pill bad" style="align-self:flex-start;">${escapeHtml(errMsg)}</div>` : ""}
          ${pendingPanel}
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            ${statCard("客戶總數", totalN, "ok", "#")}
            ${statCard("已綁定 LINE", boundN, "ok", "#")}
            ${statCard("未綁定", unboundN, unboundN>0?"warn":"ok", "#")}
            ${statCard("停用客戶", inactiveN, "accent", "#")}
          </div>
          <form method="get" action="/admin/customers" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <div style="position:relative;flex:0 0 320px;">
              <input class="sf-input" name="q" value="${searchVal}" placeholder="搜尋客戶（名稱）..." style="padding-left:28px;">
              <span style="position:absolute;left:8px;top:10px;color:var(--txt-3);">${SF_ICONS.search}</span>
            </div>
            <button class="sf-btn" type="submit">${SF_ICONS.search}<span>搜尋</span></button>
            ${q ? `<a class="sf-btn ghost" href="/admin/customers">清除</a>` : ""}
          </form>
          <div class="sf-tabs">
            <button type="button" class="sf-tab active" id="tab-btn-bound" data-tab="customers-bound">已綁定 <span class="tab-count">${boundN}</span></button>
            <button type="button" class="sf-tab" id="tab-btn-unbound" data-tab="customers-unbound">未綁定 <span class="tab-count ${unboundN>0?"warn":""}">${unboundN}</span></button>
            <button type="button" class="sf-tab" id="tab-btn-inactive" data-tab="customers-inactive">停用 <span class="tab-count">${inactiveN}</span></button>
          </div>
          <div style="flex:1;min-height:0;display:flex;flex-direction:column;">
            <div id="customers-bound-panel" class="tab-panel sf-table-wrap">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th style="width:24px;"></th>
                    <th>客戶名稱</th>
                    <th>LINE 群組</th>
                    <th>寺岡 / 凌越</th>
                    <th>聯絡</th>
                    <th style="text-align:right;width:90px;">狀態</th>
                    <th style="width:160px;">操作</th>
                  </tr>
                </thead>
                <tbody id="customers-bound-tbody">${tbodyBound}</tbody>
              </table>
            </div>
            <div id="customers-unbound-panel" class="tab-panel sf-table-wrap" style="display:none;">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th style="width:24px;"></th>
                    <th>客戶名稱</th>
                    <th>LINE 群組</th>
                    <th>寺岡 / 凌越</th>
                    <th>聯絡</th>
                    <th style="text-align:right;width:90px;">狀態</th>
                    <th style="width:160px;">操作</th>
                  </tr>
                </thead>
                <tbody id="customers-unbound-tbody">${tbodyUnbound}</tbody>
              </table>
            </div>
            <div id="customers-inactive-panel" class="tab-panel sf-table-wrap" style="display:none;">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th style="width:24px;"></th>
                    <th>客戶名稱</th>
                    <th>LINE 群組</th>
                    <th>寺岡 / 凌越</th>
                    <th>聯絡</th>
                    <th style="text-align:right;width:90px;">狀態</th>
                    <th style="width:160px;">操作</th>
                  </tr>
                </thead>
                <tbody id="customers-inactive-tbody">${tbodyInactive}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div id="custEditModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:flex-start;justify-content:center;padding:32px 16px;overflow:auto;">
          <div class="sf-card" style="max-width:560px;width:100%;margin:auto;" onclick="event.stopPropagation();">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.edit} 編輯客戶</div>
              <button type="button" class="sf-btn sm ghost" id="custEditClose" title="關閉">${SF_ICONS.x}</button>
            </div>
            <form id="custEditForm" method="post" action="" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
              <label style="font-size:12px;color:var(--txt-2);">客戶名稱 <input class="sf-input" type="text" name="name" required style="margin-top:4px;"></label>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <label style="font-size:12px;color:var(--txt-2);flex:1;min-width:150px;">寺岡編號 <input class="sf-input" type="text" name="teraoka_code" style="margin-top:4px;"></label>
                <label style="font-size:12px;color:var(--txt-2);flex:1;min-width:150px;">凌越編號 <input class="sf-input" type="text" name="hq_cust_code" style="margin-top:4px;"></label>
              </div>
              <label style="font-size:12px;color:var(--txt-2);">LINE 群組名稱 <input class="sf-input" type="text" name="line_group_name" placeholder="可之後填" style="margin-top:4px;"></label>
              <label style="font-size:12px;color:var(--txt-2);">LINE 群組 ID <input class="sf-input" type="text" name="line_group_id" placeholder="C開頭，綁定後機器人會認此群組" style="margin-top:4px;"></label>
              <label style="font-size:12px;color:var(--txt-2);">聯絡方式 <input class="sf-input" type="text" name="contact" style="margin-top:4px;"></label>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <label style="font-size:12px;color:var(--txt-2);flex:1;min-width:150px;">第幾號線（檢貨路線）
                  <select class="sf-input" name="route_line" style="margin-top:4px;"><option value="">— 不指定</option>${[1,2,3,4,5,6,7,8,9].map((n) => `<option value="${n}">${n} 號線</option>`).join("")}</select>
                </label>
                <label style="font-size:12px;color:var(--txt-2);flex:1;min-width:150px;">預設單位
                  <select class="sf-input" name="default_unit" style="margin-top:4px;"><option value="">公斤（預設）</option>${ORDER_LINE_UNITS.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("")}</select>
                </label>
              </div>
              <label style="font-size:12px;color:var(--txt-2);">叫貨備註／習慣說明 <textarea class="sf-input" name="order_notes" style="margin-top:4px;min-height:56px;"></textarea></label>
              <label style="font-size:12px;color:var(--txt-2);">專屬子客戶/分店（逗號分隔） <input class="sf-input" type="text" name="known_sub_customers" placeholder="例：東大附小,豐源國小" style="margin-top:4px;"></label>
              <label class="sf-switch-label" style="font-size:13px;color:var(--txt-1);"><input type="checkbox" name="active" value="1"><span class="sf-switch"></span>啟用（未勾選＝停用）</label>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;">
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                  <a class="sf-btn sm ghost" id="custEditAdvanced" href="#" target="_blank" title="別名、客戶畫像等進階設定">別名／完整檔案…</a>
                  <button type="button" class="sf-btn sm" id="custEditToggle">停用</button>
                  <button type="button" class="sf-btn sm danger" id="custEditDelete" title="刪除此客戶">${SF_ICONS.x}<span>刪除</span></button>
                </div>
                <div style="display:flex;gap:8px;">
                  <button type="button" class="sf-btn sm ghost" id="custEditCancel">取消</button>
                  <button type="submit" class="sf-btn sm primary">${SF_ICONS.check}<span>儲存</span></button>
                </div>
              </div>
            </form>
          </div>
        </div>
        <script>
        (function(){
          var boundTbody = document.getElementById("customers-bound-tbody");
          var unboundTbody = document.getElementById("customers-unbound-tbody");
          var inactiveTbody = document.getElementById("customers-inactive-tbody");
          function removePlaceholder(tbody){
            var first = tbody && tbody.firstElementChild;
            if (first && first.classList && first.classList.contains("customers-placeholder")) tbody.removeChild(first);
          }
          function placeholderHtml(tbodyId){
            if (tbodyId === "customers-bound-tbody") return '<tr class="customers-placeholder"><td colspan="7" style="padding:24px;text-align:center;color:var(--txt-3);">無已綁定客戶</td></tr>';
            if (tbodyId === "customers-unbound-tbody") return '<tr class="customers-placeholder"><td colspan="7" style="padding:24px;text-align:center;color:var(--txt-3);">所有啟用中客戶皆已綁定 LINE</td></tr>';
            return '<tr class="customers-placeholder"><td colspan="7" style="padding:24px;text-align:center;color:var(--txt-3);">無停用客戶</td></tr>';
          }
          function moveRow(row, toActive){
            var statusCell = row.querySelector(".customer-status-cell");
            // [fix 2026-07-08] 原本更新的是不存在的 .customer-toggle-btn（列上只有 .customer-edit-btn），
            // 導致編輯按鈕的 data-active 沒被更新 → 停用/啟用後重開彈窗仍讀到舊狀態，一按儲存又把舊狀態寫回 DB。
            // 改為更新 .customer-edit-btn 的 data-active（不動它的圖示內容）。
            var editBtn = row.querySelector(".customer-edit-btn");
            var dot = row.querySelector(".sf-dot");
            if (statusCell) statusCell.innerHTML = toActive ? '<span class="sf-pill ok">啟用</span>' : '<span class="sf-pill">停用</span>';
            if (dot) dot.className = "sf-dot" + (toActive ? " ok" : "");
            if (editBtn){ editBtn.dataset.active = toActive ? "1" : "0"; }
            var fromTbody = row.parentNode;
            // 啟用 → 依綁定狀態進 bound/unbound；停用 → inactive
            var hasGroup = !!row.querySelector(".sf-pill.warn") ? false : true;
            var toTbody = toActive ? (hasGroup ? boundTbody : unboundTbody) : inactiveTbody;
            if (toTbody === fromTbody) return;
            removePlaceholder(toTbody);
            fromTbody.removeChild(row);
            toTbody.appendChild(row);
            if (fromTbody.children.length === 0) fromTbody.innerHTML = placeholderHtml(fromTbody.id);
          }
          document.querySelectorAll("[data-tab]").forEach(function(btn){
            btn.addEventListener("click", function(e){
              e.preventDefault();
              var tab = this.dataset.tab;
              document.querySelectorAll("[data-tab]").forEach(function(b){ b.classList.remove("active"); });
              this.classList.add("active");
              document.querySelectorAll(".tab-panel").forEach(function(p){ p.style.display = "none"; });
              var panel = document.getElementById(tab + "-panel");
              if (panel) panel.style.display = "block";
            });
          });
          // 迷你 toast（存/停用/刪除的即時反饋，不整頁刷新）
          function custToast(text, kind){
            var t = document.createElement("div");
            t.textContent = text;
            t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2000;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.18);opacity:0;transition:opacity .18s;"
              + (kind==="err" ? "background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;" : "background:#065f46;color:#fff;");
            document.body.appendChild(t);
            requestAnimationFrame(function(){ t.style.opacity="1"; });
            setTimeout(function(){ t.style.opacity="0"; setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 220); }, kind==="err"?4000:2200);
          }
          // ── 編輯客戶：點整列開啟彈窗；停用/刪除移入彈窗；儲存走 AJAX，不整頁刷新 ──
          var modal = document.getElementById("custEditModal");
          var form = document.getElementById("custEditForm");
          if (modal && form) {
            var advLink = document.getElementById("custEditAdvanced");
            var toggleBtn = document.getElementById("custEditToggle");
            var deleteBtn = document.getElementById("custEditDelete");
            var curRow = null, curId = null, curActive = true;
            function setField(name, val){
              var f = form.elements[name];
              if (!f) return;
              if (f.type === "checkbox") { f.checked = String(val) === "1"; }
              else { f.value = (val == null ? "" : String(val)); }
            }
            function fval(n){ var f = form.elements[n]; return f ? (f.type==="checkbox" ? (f.checked?"1":"0") : f.value) : ""; }
            function openModal(){ modal.style.display = "flex"; document.body.style.overflow = "hidden"; }
            function closeModal(){ modal.style.display = "none"; document.body.style.overflow = ""; curRow = null; curId = null; }
            function syncToggleLabel(){ if (toggleBtn) toggleBtn.textContent = curActive ? "停用" : "啟用"; }
            function openForRow(row){
              var btn = row.querySelector(".customer-edit-btn");
              if (!btn) return;
              var d = btn.dataset;
              curRow = row; curId = d.id; curActive = d.active === "1";
              form.action = "/admin/customers/" + encodeURIComponent(d.id) + "/edit";
              if (advLink) advLink.href = "/admin/customers/" + encodeURIComponent(d.id) + "/edit";
              setField("name", d.name); setField("teraoka_code", d.teraoka_code); setField("hq_cust_code", d.hq_cust_code);
              setField("line_group_name", d.line_group_name); setField("line_group_id", d.line_group_id);
              setField("contact", d.contact); setField("route_line", d.route_line); setField("default_unit", d.default_unit);
              setField("order_notes", d.order_notes); setField("known_sub_customers", d.known_sub_customers); setField("active", d.active);
              syncToggleLabel(); openModal();
              var nameEl = form.elements["name"]; if (nameEl) { try { nameEl.focus(); } catch(_){} }
            }
            // 點整列開啟（點連結/按鈕/輸入不觸發）
            document.addEventListener("click", function(e){
              if (e.target.closest("a, button, input, select, textarea, label")) return;
              var row = e.target.closest("tr.customer-row");
              if (row) openForRow(row);
            });
            document.querySelectorAll(".customer-edit-btn").forEach(function(btn){
              btn.addEventListener("click", function(e){ e.stopPropagation(); var row = this.closest("tr"); if (row) openForRow(row); });
            });
            // 停用/啟用（彈窗內）
            if (toggleBtn) toggleBtn.addEventListener("click", function(){
              if (!curId) return;
              toggleBtn.disabled = true;
              fetch("/admin/api/customers/" + encodeURIComponent(curId) + "/toggle", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:"", credentials:"same-origin" })
                .then(function(r){ return r.json(); })
                .then(function(data){
                  toggleBtn.disabled = false;
                  if (data && data.ok === true) {
                    curActive = data.active === 1; syncToggleLabel(); setField("active", curActive ? "1":"0");
                    if (curRow) moveRow(curRow, curActive);
                    custToast(curActive ? "已啟用" : "已停用");
                  } else { custToast((data&&data.err)||"操作失敗","err"); }
                })
                .catch(function(){ toggleBtn.disabled = false; custToast("操作失敗","err"); });
            });
            // 刪除（彈窗內）
            if (deleteBtn) deleteBtn.addEventListener("click", function(){
              if (!curId) return;
              if (!confirm("確定刪除此客戶？此動作無法復原。")) return;
              deleteBtn.disabled = true;
              fetch("/admin/customers/" + encodeURIComponent(curId) + "/delete", { method:"POST", headers:{"X-Requested-With":"XMLHttpRequest","Accept":"application/json"}, credentials:"same-origin" })
                .then(function(r){ return r.json().catch(function(){ return { ok: r.ok }; }); })
                .then(function(data){
                  deleteBtn.disabled = false;
                  if (data && data.ok !== false) {
                    var row = curRow; closeModal();
                    if (row){ var tb = row.parentNode; tb.removeChild(row); if (tb.children.length===0) tb.innerHTML = placeholderHtml(tb.id); }
                    custToast("已刪除客戶");
                  } else { custToast((data&&data.error)||"刪除失敗","err"); }
                })
                .catch(function(){ deleteBtn.disabled = false; custToast("刪除失敗","err"); });
            });
            function updateRowFromForm(row){
              var editBtn = row.querySelector(".customer-edit-btn");
              var nameEl = row.querySelector(".cust-name-text"); if (nameEl) nameEl.textContent = fval("name");
              var contactCell = row.querySelector(".cust-contact-cell"); if (contactCell) contactCell.textContent = fval("contact");
              if (editBtn){ ["name","teraoka_code","hq_cust_code","line_group_name","line_group_id","contact","route_line","default_unit","order_notes","known_sub_customers"].forEach(function(n){ editBtn.dataset[n] = fval(n); }); }
              var cell = row.querySelector(".cust-name-cell");
              if (cell){
                var pill = cell.querySelector(".cust-route-pill"); var rv = fval("route_line");
                if (rv){ if(!pill){ pill=document.createElement("span"); pill.className="sf-pill cust-route-pill"; pill.title="檢貨路線"; pill.style.cssText="margin-left:auto;font-size:11px;background:var(--bg-2);color:var(--txt-2);"; cell.appendChild(pill);} pill.textContent = "路線 " + rv; }
                else if (pill){ pill.parentNode.removeChild(pill); }
              }
            }
            // 儲存（AJAX，不整頁刷新，更新該列）
            form.addEventListener("submit", function(e){
              e.preventDefault();
              var saveBtn = form.querySelector('button[type="submit"]');
              if (saveBtn) saveBtn.disabled = true;
              var params = new URLSearchParams(new FormData(form));
              fetch(form.action, { method:"POST", headers:{"X-Requested-With":"XMLHttpRequest","Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"}, body: params, credentials:"same-origin" })
                .then(function(r){ return r.json().catch(function(){ return { ok: r.ok }; }); })
                .then(function(data){
                  if (saveBtn) saveBtn.disabled = false;
                  if (data && data.ok !== false) { if (curRow) updateRowFromForm(curRow); custToast("已儲存客戶"); closeModal(); }
                  else { custToast((data&&data.error)||"儲存失敗","err"); }
                })
                .catch(function(){ if (saveBtn) saveBtn.disabled = false; custToast("儲存失敗，請重試","err"); });
            });
            var closeBtn = document.getElementById("custEditClose");
            var cancelBtn = document.getElementById("custEditCancel");
            if (closeBtn) closeBtn.addEventListener("click", closeModal);
            if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
            modal.addEventListener("click", function(e){ if (e.target === modal) closeModal(); });
            document.addEventListener("keydown", function(e){ if (e.key === "Escape" && modal.style.display === "flex") closeModal(); });
          }
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("客戶管理", body, "customers", res));
    });
    router.post("/customers/pending-bind", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const groupId = (req.body.group_id || "").replace(/\s/g, "").trim();
        const mode = (req.body.mode || "").trim();
        const groupName = (req.body.group_name || "").trim() || null;
        if (!groupId) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("缺少群組 ID"));
            return;
        }
        try {
            // 若已被其他客戶綁定，提示衝突
            const conflict = await db.prepare("SELECT id, name FROM customers WHERE line_group_id = ? LIMIT 1").get(groupId);
            if (conflict) {
                await db.prepare("DELETE FROM pending_line_groups WHERE group_id = ?").run(groupId);
                res.redirect("/admin/customers?err=" + encodeURIComponent("此群組已綁定客戶：" + conflict.name));
                return;
            }
            if (mode === "existing") {
                const customerId = (req.body.customer_id || "").trim();
                if (!customerId) {
                    res.redirect("/admin/customers?err=" + encodeURIComponent("請選擇要綁定的客戶"));
                    return;
                }
                const target = await db.prepare("SELECT id, line_group_name, line_group_id, name FROM customers WHERE id = ?").get(customerId);
                if (!target) {
                    res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
                    return;
                }
                // [fix 2026-07-08] 該客戶若已綁「別的」群組，直接覆寫會讓舊群組叫貨失效。先擋下請人工確認。
                if (target.line_group_id && String(target.line_group_id).trim() && String(target.line_group_id).trim() !== groupId) {
                    res.redirect("/admin/customers?err=" + encodeURIComponent(`客戶「${target.name}」已綁定另一個 LINE 群組，若確定要改綁請先到該客戶編輯頁清除舊群組再操作`));
                    return;
                }
                const keepName = target.line_group_name && String(target.line_group_name).trim() !== "" ? target.line_group_name : groupName;
                const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                try {
                    await db.prepare("UPDATE customers SET line_group_id = ?, line_group_name = ?, updated_at = " + nowSql + " WHERE id = ?").run(groupId, keepName, customerId);
                }
                catch (e) {
                    // [fix 2026-07-27 體檢] 同上：撞唯一索引＝這個群組剛被別人綁走
                    if (isLineGroupUniqueViolation(e)) {
                        res.redirect("/admin/customers?err=" + encodeURIComponent("此 LINE 群組剛被綁到其他客戶（可能同時有人在操作），請重新整理待綁定清單再試"));
                        return;
                    }
                    throw e;
                }
                await db.prepare("DELETE FROM pending_line_groups WHERE group_id = ?").run(groupId);
                await logDataChange(req, {
                    entityType: "customer",
                    entityId: customerId,
                    action: "bind_line_group",
                    summary: `將 LINE 群組綁定到客戶 ${target.name}`,
                    meta: { groupId: groupId.slice(0,6)+"…"+groupId.slice(-6), groupName: keepName || null },
                });
                res.redirect("/admin/customers?ok=edit");
                return;
            }
            if (mode === "new") {
                const name = (req.body.name || "").trim();
                if (!name) {
                    res.redirect("/admin/customers?err=" + encodeURIComponent("請輸入新客戶名稱"));
                    return;
                }
                const newCid = (0, id_js_1.newId)("cust");
                const routeRaw = (req.body.route_line || "").trim();
                const routeLine = /^[1-9]$/.test(routeRaw) ? parseInt(routeRaw, 10) : null;
                await db.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, route_line, known_sub_customers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(newCid, name, null, null, groupName, groupId, null, routeLine, null);
                await db.prepare("DELETE FROM pending_line_groups WHERE group_id = ?").run(groupId);
                await logDataChange(req, {
                    entityType: "customer",
                    entityId: newCid,
                    action: "create_and_bind",
                    summary: `建立新客戶 ${name} 並綁定 LINE 群組`,
                    meta: { groupId: groupId.slice(0,6)+"…"+groupId.slice(-6), groupName: groupName || null },
                });
                res.redirect("/admin/customers?ok=1");
                return;
            }
            res.redirect("/admin/customers?err=" + encodeURIComponent("未知的綁定模式"));
        }
        catch (e) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("綁定失敗：" + (e?.message || String(e)).slice(0, 80)));
        }
    });
    router.post("/customers/pending-dismiss", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const groupId = (req.body.group_id || "").replace(/\s/g, "").trim();
        if (groupId) {
            try {
                await db.prepare("DELETE FROM pending_line_groups WHERE group_id = ?").run(groupId);
            }
            catch (e) {
                res.redirect("/admin/customers?err=" + encodeURIComponent("忽略失敗：" + (e?.message || String(e)).slice(0, 80)));
                return;
            }
        }
        res.redirect("/admin/customers");
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
        res.type("text/html").send(notionPage("確認刪除", body, "", res));
    });
    router.post("/customers/:id/delete", async (req, res) => {
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || (req.get("Accept") || "").includes("application/json");
        const id = req.params.id;
        try {
            const orderCount = await db.prepare("SELECT COUNT(*) AS c FROM orders WHERE customer_id = ?").get(id);
            if ((orderCount?.c ?? 0) > 0) {
                if (wantsJson) { res.status(409).json({ ok: false, error: "此客戶已有訂單，無法刪除。請改為停用。" }); return; }
                res.redirect("/admin/customers?err=" + encodeURIComponent("此客戶已有訂單，無法刪除。請改為停用。"));
                return;
            }
            // [fix 2026-07-08] 過去只擋訂單，客戶若有別名/筆跡提示/籃子紀錄/Gemini用量/範例圖等會撞 FK。
            // 交易內先清掉這些「隨客戶消滅」的中繼/衍生資料再刪客戶；basket_logs 的分項/歷史在 PG 為 ON DELETE CASCADE。
            // [fix 2026-07-27 體檢] 硬刪 7 張表補稽核軌跡（守則 #3）：先快照主檔再刪。
            const beforeSnap = await db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
            const doDel = async (h) => {
                await h.prepare("DELETE FROM customer_product_aliases WHERE customer_id = ?").run(id);
                await h.prepare("DELETE FROM customer_handwriting_hints WHERE customer_id = ?").run(id);
                await h.prepare("DELETE FROM customer_order_image_examples WHERE customer_id = ?").run(id);
                await h.prepare("DELETE FROM gemini_usage_log WHERE customer_id = ?").run(id);
                await h.prepare("DELETE FROM rhythm_daily_signals WHERE customer_id = ?").run(id);
                await h.prepare("DELETE FROM basket_logs WHERE customer_id = ?").run(id);
                await h.prepare("DELETE FROM customers WHERE id = ?").run(id);
            };
            if (typeof db.transaction === "function") await db.transaction(doDel);
            else await doDel(db);
            if (beforeSnap) {
                try {
                    await logDataChange(req, {
                        entityType: "customer",
                        entityId: id,
                        action: "delete",
                        summary: `刪除客戶「${beforeSnap.name || id}」（含別名/筆跡/範例圖/用量/節奏/空籃衍生資料）`,
                        meta: { before: beforeSnap },
                    });
                } catch (_) { /* 稽核失敗不擋刪除結果 */ }
            }
        }
        catch (e) {
            console.error("[admin] 客戶刪除失敗:", e?.message || e);
            const msg = "此客戶仍被其他資料引用，無法刪除。建議改為停用。";
            if (wantsJson) { res.status(409).json({ ok: false, error: msg }); return; }
            res.redirect("/admin/customers?err=" + encodeURIComponent(msg));
            return;
        }
        if (wantsJson) { res.json({ ok: true }); return; }
        res.redirect("/admin/customers?ok=del");
    });
}
