"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnalyticsRoutes = registerAnalyticsRoutes;

// 營運分析域（/analytics 客戶×品項統計、/reminders 忘記叫貨提醒清單）路由：
// 自 index.js 拆出（拆檔批次 7），純搬移、行為不變。

const express_1 = { default: require("express") };
const customer_scoring_js_1 = require("../lib/customer-scoring.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerAnalyticsRoutes(router, ctx) {
    const { db, notionPage, getTaipeiCalendarDateYYYYMMDD, fmtTaipeiYMDHM } = ctx;
    router.get("/analytics", async (req, res) => {
        try {
            const isPg = Boolean(process.env.DATABASE_URL);
            // 期間（預設 90 天）
            const periodDays = Math.max(7, Math.min(365, parseInt(String(req.query.period || "90"), 10) || 90));
            const todayIso = getTaipeiCalendarDateYYYYMMDD();
            const fromIso = (() => {
                const d = new Date(todayIso + "T00:00:00+08:00");
                d.setDate(d.getDate() - periodDays + 1);
                return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d);
            })();
            // 期間以「文字 YYYY-MM-DD」比較（PG/SQLite 共用）
            const periodWhere = " AND o.order_date >= ? AND o.order_date <= ?";
            const notVoidStatus = " AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint')";
            // ── KPI ──
            const totalActive = Number((await db.prepare("SELECT COUNT(*) AS n FROM customers WHERE active = 1 OR active IS NULL").get())?.n) || 0;
            const activeInPeriod = Number((await db.prepare(
                "SELECT COUNT(DISTINCT o.customer_id) AS n FROM orders o WHERE 1=1" + notVoidStatus + periodWhere
            ).get(fromIso, todayIso))?.n) || 0;
            const totalOrdersInPeriod = Number((await db.prepare(
                "SELECT COUNT(*) AS n FROM orders o WHERE 1=1" + notVoidStatus + periodWhere
            ).get(fromIso, todayIso))?.n) || 0;
            const complaintsInPeriod = Number((await db.prepare(
                "SELECT COUNT(*) AS n FROM orders o WHERE LOWER(TRIM(COALESCE(o.status,''))) = 'complaint'" + periodWhere
            ).get(fromIso, todayIso))?.n) || 0;
            const complaintRate = totalOrdersInPeriod > 0 ? Math.round((complaintsInPeriod / totalOrdersInPeriod) * 1000) / 10 : 0;
            // 本月新客戶（第一張訂單在本月）
            const monthStart = todayIso.slice(0, 8) + "01";
            let newCustomersThisMonth = 0;
            try {
                const r = await db.prepare(
                    "SELECT COUNT(*) AS n FROM (SELECT customer_id, MIN(order_date) AS first_d FROM orders WHERE COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') GROUP BY customer_id) sub WHERE sub.first_d >= ?"
                ).get(monthStart);
                newCustomersThisMonth = Number(r?.n) || 0;
            } catch (_) {}
            // ── 客戶排名 Top 20 ──
            const topCustomers = await db.prepare(
                "SELECT c.id, c.name, COUNT(*) AS order_count, " +
                "SUM((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.voided_at IS NULL)) AS item_count, " +
                "MAX(o.order_date) AS last_date " +
                "FROM orders o JOIN customers c ON c.id = o.customer_id " +
                "WHERE 1=1" + notVoidStatus + periodWhere + " " +
                "GROUP BY c.id, c.name ORDER BY order_count DESC LIMIT 20"
            ).all(fromIso, todayIso);
            // ── 客戶客訴排名（同期間客訴數最多的）──
            const topComplainCustomers = await db.prepare(
                "SELECT c.id, c.name, COUNT(*) AS complaint_count " +
                "FROM orders o JOIN customers c ON c.id = o.customer_id " +
                "WHERE LOWER(TRIM(COALESCE(o.status,''))) = 'complaint'" + periodWhere + " " +
                "GROUP BY c.id, c.name ORDER BY complaint_count DESC LIMIT 10"
            ).all(fromIso, todayIso);
            // ── 品項排名 Top 30 ──
            const topProducts = await db.prepare(
                "SELECT COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '(未對應)') AS name, " +
                "COUNT(*) AS hit_count, " +
                "SUM(COALESCE(oi.quantity, 0)) AS total_qty, " +
                "COUNT(DISTINCT o.customer_id) AS customer_count " +
                "FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id " +
                "WHERE oi.voided_at IS NULL" + notVoidStatus + periodWhere + " " +
                "GROUP BY COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '(未對應)') " +
                "ORDER BY hit_count DESC LIMIT 30"
            ).all(fromIso, todayIso);
            // ── 每日訂單量趨勢 ──
            const dailyTrend = await db.prepare(
                "SELECT o.order_date AS d, COUNT(*) AS n FROM orders o " +
                "WHERE 1=1" + notVoidStatus + periodWhere + " " +
                "GROUP BY o.order_date ORDER BY o.order_date"
            ).all(fromIso, todayIso);
            // ── 週幾分布 ──
            const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]; // 0=日 ~ 6=六
            for (const r of dailyTrend) {
                const d = new Date(String(r.d) + "T00:00:00+08:00");
                if (!Number.isNaN(d.getTime())) weekdayCounts[d.getDay()] += Number(r.n) || 0;
            }
            const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];
            // ── 流失風險客戶（超過正常 2 倍間隔還沒叫貨）──
            const churnRisk = await db.prepare(
                "SELECT c.id, c.name, MAX(o.order_date) AS last_date, COUNT(*) AS order_count " +
                "FROM orders o JOIN customers c ON c.id = o.customer_id " +
                "WHERE (c.active = 1 OR c.active IS NULL)" + notVoidStatus + " " +
                "GROUP BY c.id, c.name " +
                "HAVING MAX(o.order_date) < ? " +
                "ORDER BY order_count DESC LIMIT 15"
            ).all((() => {
                // 14 天前的日期（沒叫貨 14 天以上視為流失風險，可後續改成依各客戶平均間隔）
                const d = new Date(todayIso + "T00:00:00+08:00");
                d.setDate(d.getDate() - 14);
                return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d);
            })());
            // ── HTML ──
            const maxOrderCount = Math.max(1, ...topCustomers.map(c => Number(c.order_count) || 0));
            const maxProductHit = Math.max(1, ...topProducts.map(p => Number(p.hit_count) || 0));
            const maxDaily = Math.max(1, ...dailyTrend.map(r => Number(r.n) || 0));
            const maxWeekday = Math.max(1, ...weekdayCounts);
            const periodOpts = [7, 14, 30, 60, 90, 180, 365].map(d => `<option value="${d}" ${d === periodDays ? "selected" : ""}>過去 ${d} 天</option>`).join("");
            const kpi = (label, num, unit, sub, status) => `
              <div class="sf-card" style="padding:14px 18px;">
                <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">${label}</div>
                <div class="mono" style="font-size:26px;font-weight:600;color:${status === "bad" ? "var(--bad)" : status === "warn" ? "var(--warn)" : "var(--txt-1)"};">${num}${unit ? `<span style="font-size:14px;color:var(--txt-3);margin-left:4px;">${unit}</span>` : ""}</div>
                <div style="font-size:12px;color:var(--txt-2);">${sub || ""}</div>
              </div>`;
            const body = `
              <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;max-width:1200px;margin:0 auto;">
                <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                  <div>
                    <div class="sf-breadcrumb" style="margin-bottom:6px;">報表與通訊 / 營運分析</div>
                    <h1 style="margin:0;font-size:22px;font-weight:600;">營運分析</h1>
                    <p style="margin:6px 0 0;color:var(--txt-3);font-size:12px;">期間：${escapeHtml(fromIso)} ~ ${escapeHtml(todayIso)}（${periodDays} 天）。不含已作廢／客訴訂單。</p>
                  </div>
                  <form method="get" action="/admin/analytics" style="display:flex;gap:8px;align-items:center;">
                    <label style="font-size:13px;color:var(--txt-2);">期間
                      <select name="period" class="sf-input" style="margin-left:6px;" onchange="this.form.submit()">${periodOpts}</select>
                    </label>
                  </form>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                  ${kpi("活躍客戶", activeInPeriod, "/ " + totalActive, `期間內有叫貨 · 活躍率 ${totalActive > 0 ? Math.round(activeInPeriod * 100 / totalActive) : 0}%`)}
                  ${kpi("期間訂單數", totalOrdersInPeriod, "張", `平均每天 ${(totalOrdersInPeriod / periodDays).toFixed(1)} 張`)}
                  ${kpi("客訴率", complaintRate + "%", "", `客訴 ${complaintsInPeriod} 張`, complaintRate > 5 ? "bad" : complaintRate > 2 ? "warn" : "ok")}
                  ${kpi("本月新客戶", newCustomersThisMonth, "戶", "首張訂單在本月")}
                </div>

                <div class="sf-card">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.chartLine}每日訂單量趨勢</div></div>
                  <div style="padding:14px 16px;">
                    ${dailyTrend.length ? `<div style="display:flex;align-items:flex-end;gap:2px;height:120px;">${dailyTrend.map(r => {
                      const h = Math.round((Number(r.n) || 0) / maxDaily * 110);
                      return `<div title="${escapeAttr(r.d)} · ${r.n} 張" style="flex:1;min-width:6px;background:var(--accent);opacity:.65;height:${h}px;border-radius:2px 2px 0 0;"></div>`;
                    }).join("")}</div><div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--txt-3);"><span>${escapeHtml(dailyTrend[0]?.d || "")}</span><span>${escapeHtml(dailyTrend[dailyTrend.length-1]?.d || "")}</span></div>` : `<p style="color:var(--txt-3);text-align:center;margin:0;">期間內無訂單</p>`}
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.users}客戶排名 Top 20</div></div>
                    <div style="padding:0;">
                      ${topCustomers.length ? topCustomers.map((c, i) => {
                        const pct = Math.round((Number(c.order_count) || 0) * 100 / maxOrderCount);
                        return `<a href="/admin/customers/${encodeURIComponent(c.id)}/360" style="display:block;padding:8px 14px;border-bottom:1px solid var(--line);text-decoration:none;color:inherit;">
                          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:4px;">
                            <span><span class="mono" style="color:var(--txt-3);margin-right:6px;">${String(i+1).padStart(2,"0")}</span>${escapeHtml(c.name)}</span>
                            <span class="mono"><strong>${c.order_count}</strong> 張 · ${c.item_count || 0} 項</span>
                          </div>
                          <div style="height:6px;background:var(--bg-2);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--accent);"></div></div>
                        </a>`;
                      }).join("") : `<p style="padding:18px;color:var(--txt-3);text-align:center;font-size:13px;margin:0;">期間內無訂單</p>`}
                    </div>
                  </div>
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.box}品項排名 Top 30（依被叫次數）</div></div>
                    <div style="padding:0;max-height:540px;overflow-y:auto;">
                      ${topProducts.length ? topProducts.map((p, i) => {
                        const pct = Math.round((Number(p.hit_count) || 0) * 100 / maxProductHit);
                        const totalQty = Number(p.total_qty) || 0;
                        const qtyDisp = totalQty % 1 === 0 ? String(totalQty) : totalQty.toFixed(2);
                        return `<div style="padding:8px 14px;border-bottom:1px solid var(--line);">
                          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:4px;">
                            <span><span class="mono" style="color:var(--txt-3);margin-right:6px;">${String(i+1).padStart(2,"0")}</span>${escapeHtml(p.name)}</span>
                            <span class="mono" style="font-size:12px;"><strong>${p.hit_count}</strong> 次 · ${qtyDisp} · ${p.customer_count} 戶</span>
                          </div>
                          <div style="height:6px;background:var(--bg-2);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--ok);"></div></div>
                        </div>`;
                      }).join("") : `<p style="padding:18px;color:var(--txt-3);text-align:center;font-size:13px;margin:0;">期間內無品項紀錄</p>`}
                    </div>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.calendar}週幾叫貨分布</div></div>
                    <div style="padding:14px 16px;">
                      <div style="display:flex;align-items:flex-end;gap:8px;height:120px;">
                        ${weekdayCounts.map((n, i) => {
                          const h = Math.round(n / maxWeekday * 100);
                          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
                            <span class="mono" style="font-size:11px;color:var(--txt-2);margin-bottom:2px;">${n}</span>
                            <div style="width:100%;height:${Math.max(h,2)}px;background:var(--accent);opacity:.7;border-radius:3px 3px 0 0;"></div>
                            <span style="font-size:11px;color:var(--txt-3);margin-top:4px;">週${weekdayLabels[i]}</span>
                          </div>`;
                        }).join("")}
                      </div>
                    </div>
                  </div>
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.warn}客訴客戶排名（期間）</div></div>
                    <div style="padding:0;">
                      ${topComplainCustomers.length ? topComplainCustomers.map((c, i) => `
                        <a href="/admin/customers/${encodeURIComponent(c.id)}/360" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);text-decoration:none;color:inherit;font-size:13px;">
                          <span><span class="mono" style="color:var(--txt-3);margin-right:6px;">${String(i+1).padStart(2,"0")}</span>${escapeHtml(c.name)}</span>
                          <span class="sf-pill bad">${c.complaint_count} 筆</span>
                        </a>
                      `).join("") : `<p style="padding:18px;color:var(--ok);text-align:center;font-size:13px;margin:0;">✓ 期間內無客訴</p>`}
                    </div>
                  </div>
                </div>

                <div class="sf-card">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.stop}流失風險客戶（超過 14 天未叫貨）</div><span class="sf-card-sub">依累計訂單數排序，優先關心舊客戶</span></div>
                  <div style="padding:0;">
                    ${churnRisk.length ? `<table class="sf-table" style="font-size:13px;"><thead><tr><th>客戶</th><th>最後叫貨</th><th style="text-align:right;">累計訂單</th><th></th></tr></thead><tbody>${churnRisk.map(c => {
                      const last = new Date(String(c.last_date) + "T00:00:00+08:00");
                      const days = Math.round((new Date(todayIso + "T00:00:00+08:00") - last) / 86400000);
                      return `<tr><td>${escapeHtml(c.name)}</td><td class="mono">${escapeHtml(c.last_date)} <span style="color:var(--bad);">(${days} 天前)</span></td><td style="text-align:right;" class="mono">${c.order_count}</td><td style="text-align:right;"><a href="/admin/customers/${encodeURIComponent(c.id)}/360" class="sf-btn sm">查看</a></td></tr>`;
                    }).join("")}</tbody></table>` : `<p style="padding:18px;color:var(--ok);text-align:center;font-size:13px;margin:0;">✓ 沒有客戶超過 14 天未叫貨</p>`}
                  </div>
                </div>
              </div>`;
            res.type("text/html").send(notionPage("營運分析", body, "analytics", res));
        } catch (e) {
            console.error("[admin] /analytics failed", e);
            res.status(500).send("載入營運分析失敗：" + (e?.message || e));
        }
    });
    // === 忘記叫貨提醒（流失風險清單）===
    router.get("/reminders", async (req, res) => {
        try {
            const todayIso = getTaipeiCalendarDateYYYYMMDD();
            // 單一 aggregate query 取得所有客戶資料（從 30 秒+ 降到 ~1 秒）
            const all = await (0, customer_scoring_js_1.fetchAllCustomerReminderStats)(db, todayIso);
            const totalActive = all.length;
            const rows = [];
            for (const c of all) {
                if (c.daysSinceLastOrder == null || c.avgIntervalDays == null) continue;
                if (c.daysSinceLastOrder <= c.avgIntervalDays * 1.5) continue;
                const { score } = (0, customer_scoring_js_1.computeCustomerScore)({
                    orders90: c.orders90, ordersAll: c.ordersAll, items90: 0,
                    complaintsAll: 0, complaintsOpen: 0,
                    daysSinceLastOrder: c.daysSinceLastOrder, avgIntervalDays: c.avgIntervalDays,
                });
                const tier = (0, customer_scoring_js_1.scoreToTier)(score);
                rows.push({
                    id: c.id, name: c.name,
                    lineGroupId: c.lineGroupId, handoverNotes: c.handoverNotes,
                    daysSince: c.daysSinceLastOrder,
                    avg: c.avgIntervalDays,
                    overdueRatio: c.daysSinceLastOrder / c.avgIntervalDays,
                    lastOrderDate: c.lastOrderDate,
                    orders90: c.orders90, ordersAll: c.ordersAll,
                    score, tier,
                });
            }
            // 依「逾期倍數 × 客戶分」排序（主力客戶且逾期久的優先）
            rows.sort((a, b) => (b.overdueRatio * (b.score / 100)) - (a.overdueRatio * (a.score / 100)));
            const groupedSeverity = {
                critical: rows.filter(r => r.overdueRatio >= 3).length,
                high: rows.filter(r => r.overdueRatio >= 2 && r.overdueRatio < 3).length,
                medium: rows.filter(r => r.overdueRatio >= 1.5 && r.overdueRatio < 2).length,
            };
            const severityPill = (ratio) => {
                if (ratio >= 3) return `<span class="sf-pill bad">嚴重</span>`;
                if (ratio >= 2) return `<span class="sf-pill" style="background:#fee2e2;color:#b91c1c;">高</span>`;
                return `<span class="sf-pill warn">中</span>`;
            };
            const body = `
              <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
                <div>
                  <div class="sf-breadcrumb" style="margin-bottom:6px;">日常作業 / 忘記叫貨提醒</div>
                  <h1 style="margin:0;font-size:22px;font-weight:600;">忘記叫貨提醒</h1>
                  <p style="margin:6px 0 0;color:var(--txt-3);font-size:12px;">客戶有平均叫貨節奏、且距上次叫貨已超過平均間隔 1.5 倍以上時列出。優先順序 = 逾期倍數 × 客戶評分。</p>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                  <div class="sf-card" style="padding:14px 18px;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">需提醒</div>
                    <div class="mono" style="font-size:26px;font-weight:600;">${rows.length}</div>
                    <div style="font-size:12px;color:var(--txt-2);">總啟用客戶 ${totalActive}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;border-left:4px solid var(--bad);">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">嚴重（≥3 倍）</div>
                    <div class="mono" style="font-size:26px;font-weight:600;color:var(--bad);">${groupedSeverity.critical}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;border-left:4px solid #f59e0b;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">高（2–3 倍）</div>
                    <div class="mono" style="font-size:26px;font-weight:600;color:#b45309;">${groupedSeverity.high}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;border-left:4px solid var(--warn);">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">中（1.5–2 倍）</div>
                    <div class="mono" style="font-size:26px;font-weight:600;color:var(--warn);">${groupedSeverity.medium}</div>
                  </div>
                </div>
                <div class="sf-card">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.clipboard}提醒清單（依優先順序）</div><span class="sf-card-sub">點客戶名跳客戶 360；點「複製訊息」可貼到 LINE 給客戶</span></div>
                  <div style="padding:0;">
                    ${rows.length ? `<div style="overflow-x:auto;"><table class="sf-table" style="font-size:13px;table-layout:fixed;width:100%;">
                      <colgroup>
                        <col style="width:64px;">
                        <col>
                        <col style="width:110px;">
                        <col style="width:80px;">
                        <col style="width:90px;">
                        <col style="width:80px;">
                        <col style="width:60px;">
                        <col style="width:88px;">
                      </colgroup>
                      <thead><tr>
                        <th style="text-align:center;">等級</th>
                        <th>客戶</th>
                        <th>最後叫貨</th>
                        <th style="text-align:right;">已 N 天</th>
                        <th style="text-align:right;">平均間隔</th>
                        <th style="text-align:right;">逾期倍</th>
                        <th style="text-align:center;">分數</th>
                        <th style="text-align:center;"></th>
                      </tr></thead>
                      <tbody>${rows.map(r => `
                      <tr>
                        <td data-label="等級" style="text-align:center;">${severityPill(r.overdueRatio)}</td>
                        <td data-label="客戶" style="overflow:hidden;">
                          <a href="/admin/customers/${encodeURIComponent(r.id)}/360" style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:100%;">${escapeHtml(r.name)}</a>
                          ${r.handoverNotes ? `<div style="font-size:11px;color:var(--txt-3);margin-top:2px;display:flex;align-items:center;gap:4px;overflow:hidden;" title="${escapeAttr(r.handoverNotes)}">${sfInlineIcon('note')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(String(r.handoverNotes).slice(0,40))}${String(r.handoverNotes).length>40?"…":""}</span></div>` : ""}
                        </td>
                        <td data-label="最後叫貨" class="mono" style="color:var(--txt-3);white-space:nowrap;">${escapeHtml(r.lastOrderDate || "—")}</td>
                        <td data-label="已 N 天" style="text-align:right;white-space:nowrap;" class="mono"><strong style="color:var(--bad);">${r.daysSince}</strong></td>
                        <td data-label="平均間隔" style="text-align:right;white-space:nowrap;color:var(--txt-3);" class="mono">${r.avg}</td>
                        <td data-label="逾期倍" style="text-align:right;white-space:nowrap;" class="mono">${r.overdueRatio.toFixed(1)}×</td>
                        <td data-label="分數" style="text-align:center;"><span class="sf-pill" style="background:${r.tier.bg};color:${r.tier.color};font-size:11px;padding:1px 6px;">${r.score}</span></td>
                        <td style="text-align:center;"><button type="button" class="sf-btn sm copy-reminder-btn" data-name="${escapeAttr(r.name)}" data-days="${r.daysSince}" title="複製提醒訊息給客戶">複製</button></td>
                      </tr>`).join("")}</tbody>
                    </table></div>` : `<p style="padding:24px;text-align:center;color:var(--ok);">✓ 目前沒有客戶需要提醒</p>`}
                  </div>
                </div>
              </div>
              <script>
              (function(){
                document.querySelectorAll(".copy-reminder-btn").forEach(btn => {
                  btn.addEventListener("click", function(){
                    const name = btn.dataset.name || "客戶";
                    const days = btn.dataset.days || "";
                    const msg = name + " 老闆好，您已經 " + days + " 天沒有叫貨了，請問今天需要安排送貨嗎？";
                    try {
                      navigator.clipboard.writeText(msg).then(() => {
                        const orig = btn.textContent;
                        btn.textContent = "✓ 已複製";
                        setTimeout(() => btn.textContent = orig, 1500);
                      });
                    } catch (e) {
                      prompt("請手動複製：", msg);
                    }
                  });
                });
              })();
              </script>`;
            res.type("text/html").send(notionPage("忘記叫貨提醒", body, "reminders", res));
        } catch (e) {
            console.error("[admin] /reminders failed", e);
            res.status(500).send("載入提醒清單失敗：" + (e?.message || e));
        }
    });
}
