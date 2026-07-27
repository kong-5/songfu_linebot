"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDashboardRoutes = registerDashboardRoutes;

// 儀表板域（首頁總覽卡片：待辦/今日訂單/盤點/報價提醒＋自訂事件 CRUD＋Gemini 成本摘要）路由：
// 自 index.js 拆出（拆檔批次 7），純搬移、行為不變。
// 註：報價 icon QI 由 index.js 經 ctx 傳入（報價域也在用，見批次 6）。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const quote_report_js_1 = require("../lib/quote-report.js");
const stock_mustcount_js_1 = require("../lib/stock-mustcount.js");
const customer_scoring_js_1 = require("../lib/customer-scoring.js");
const wholesale_price_js_1 = require("../lib/wholesale-price.js");
const wholesale_snapshot_js_1 = require("../lib/wholesale-snapshot.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerDashboardRoutes(router, ctx) {
    const { db, notionPage, logDataChange, getWorkingDate, getTaipeiCalendarDateYYYYMMDD, fmtTaipeiYMDHM, fmtTaipeiMMDDHHmm, QI, nowSqlExpr } = ctx;
    router.get("/", async (req, res) => {
        const today = getTaipeiCalendarDateYYYYMMDD();
        const todayDate = new Date(today + "T12:00:00");
        const weekdayZh = ["日","一","二","三","四","五","六"][todayDate.getDay()];
        // ── 月底：提醒製作下月客戶報價 ─────────────────────────────
        let quoteReminderCard = "";
        try {
            // 狀態流：未建立→建立；已建立未完成→確認完成；已完成待發送→發送（最後一日最醒目）。
            const sendR = await quote_report_js_1.monthEndSendReminder(db, today, { withinDays: 3 });
            if (sendR.show) {
                const emph = sendR.isLastDay;
                const accent = emph ? "#dc2626" : "#16a34a";
                const editHref = `/admin/quotes/${encodeURIComponent(sendR.report.id)}`;
                quoteReminderCard = `
                <div class="sf-card" style="border-left:4px solid ${accent};">
                  <div class="sf-card-head">
                    <a href="${editHref}" style="display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;">
                      <div class="sf-card-title" style="display:flex;align-items:center;gap:6px;"><span style="display:inline-flex;color:${accent};">${QI.calendar}</span>${emph ? "今天請發送" : "待發送"}：${escapeHtml(sendR.rocLabel)} 報價給客戶</div>
                    </a>
                    <a href="${editHref}/sheet" target="_blank" class="sf-card-sub">預覽 / PDF →</a>
                  </div>
                  <div style="padding:12px 16px;font-size:13px;color:var(--txt-2);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <span style="flex:1;min-width:220px;">${emph
                        ? `<strong>今天是本月最後一日</strong>，報價單已完成，請務必發送給客戶。`
                        : `報價單已完成，本月剩 <strong>${sendR.daysLeft}</strong> 天，記得月底前發送給客戶。`}</span>
                    <form method="post" action="/admin/quotes/mark-sent" style="margin:0;">
                      <input type="hidden" name="ym" value="${escapeHtml(sendR.targetYm)}">
                      <button class="sf-btn primary" type="submit">${QI.checkc}<span>標記已發送</span></button>
                    </form>
                  </div>
                </div>`;
            } else {
                const qr = await quote_report_js_1.monthEndReminder(db, today, 7);
                if (qr.show) {
                    quoteReminderCard = `
                    <div class="sf-card" style="border-left:4px solid #f59e0b;">
                      <div class="sf-card-head">
                        <a href="/admin/quotes" style="display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;">
                          <div class="sf-card-title" style="display:flex;align-items:center;gap:6px;"><span style="display:inline-flex;color:#f59e0b;">${QI.calendar}</span>月底提醒：${qr.report ? "確認" : "製作"} ${escapeHtml(qr.rocLabel)} 月報報價</div>
                        </a>
                        <a href="${qr.report ? `/admin/quotes/${encodeURIComponent(qr.report.id)}` : "/admin/quotes"}" class="sf-card-sub">${qr.report ? "前往確認" : "前往製作"} →</a>
                      </div>
                      <div style="padding:12px 16px;font-size:13px;color:var(--txt-2);">
                        本月僅剩 <strong>${qr.daysLeft}</strong> 天。${qr.report ? "下月報價單已建立草稿，請確認價格後設為完成。" : "下月報價單尚未建立，點「前往製作」會自動帶入上月價格當底稿。"}
                      </div>
                    </div>`;
                }
            }
        } catch (e) { console.error("[admin] 月報提醒計算失敗", e); }
        // ── KPI 資料 ──────────────────────────────────────────────
        let totalOrders = 0, pendingOrders = 0, approvedOrders = 0;
        let needReviewCnt = 0;
        try {
            const r1 = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint')").get(today);
            totalOrders = Number(r1?.n) || 0;
            const r2 = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE order_date = ? AND COALESCE(LOWER(TRIM(status)),'') = 'approved'").get(today);
            approvedOrders = Number(r2?.n) || 0;
            const r3 = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','approved','complaint')").get(today);
            pendingOrders = Number(r3?.n) || 0;
            const r4 = await db.prepare("SELECT COUNT(*) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.order_date = ? AND oi.need_review = 1 AND oi.voided_at IS NULL").get(today);
            needReviewCnt = Number(r4?.n) || 0;
        } catch (_) { /* ignore */ }
        let yesterdayOrders = 0;
        try {
            const yesterday = new Date(todayDate.getTime() - 86400000).toISOString().slice(0,10);
            const r = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE order_date = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint')").get(yesterday);
            yesterdayOrders = Number(r?.n) || 0;
        } catch (_) {}
        const deltaOrders = totalOrders - yesterdayOrders;
        // ── 客訴：今日新增 + 未解決總數 + 今日明細 ─────────────────
        let complaintsTodayNew = 0, complaintsOpenTotal = 0, complaintsTodayOpen = [];
        try {
            const r1 = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE order_date = ? AND LOWER(TRIM(COALESCE(status,''))) = 'complaint'").get(today);
            complaintsTodayNew = Number(r1?.n) || 0;
            const r2 = await db.prepare("SELECT COUNT(*) AS n FROM orders o LEFT JOIN complaint_handling ch ON ch.order_id = o.id WHERE LOWER(TRIM(COALESCE(o.status,''))) = 'complaint' AND COALESCE(ch.handle_status, 'pending') <> 'resolved'").get();
            complaintsOpenTotal = Number(r2?.n) || 0;
            complaintsTodayOpen = await db.prepare(
                "SELECT o.id, o.order_no, o.order_date, c.name AS customer_name, o.raw_message, COALESCE(ch.handle_status, 'pending') AS handle_status, ch.handler " +
                "FROM orders o JOIN customers c ON c.id = o.customer_id LEFT JOIN complaint_handling ch ON ch.order_id = o.id " +
                "WHERE LOWER(TRIM(COALESCE(o.status,''))) = 'complaint' AND COALESCE(ch.handle_status, 'pending') <> 'resolved' " +
                "ORDER BY o.order_date DESC, o.id DESC LIMIT 6"
            ).all();
        } catch (e) { console.warn("[admin] dashboard complaints query failed:", e?.message || e); }
        // ── 提醒叫貨：用 bulk helper 取得「逾期未叫貨」客戶數（速度 < 1 秒）──
        let reminderTotal = 0, reminderCritical = 0, reminderTop = [];
        try {
            const reminderStats = await (0, customer_scoring_js_1.fetchAllCustomerReminderStats)(db, today);
            const overdueList = (reminderStats || [])
                .filter(c => c.daysSinceLastOrder != null && c.avgIntervalDays != null && c.daysSinceLastOrder > c.avgIntervalDays * 1.5)
                .map(c => ({ ...c, overdueRatio: c.daysSinceLastOrder / c.avgIntervalDays }));
            reminderTotal = overdueList.length;
            reminderCritical = overdueList.filter(c => c.overdueRatio >= 3).length;
            overdueList.sort((a, b) => b.overdueRatio - a.overdueRatio);
            reminderTop = overdueList.slice(0, 5);
        } catch (e) { console.warn("[admin] dashboard reminder query failed:", e?.message || e); }
        // ── 警示來源：data_change_log 最近 30 筆異常 ──────────────
        let alerts = [];
        try {
            alerts = await db.prepare(
                "SELECT created_at, actor_username, action, summary, entity_type, entity_id " +
                "FROM data_change_log WHERE action IN ('soft_delete','delete','unapprove','approve') " +
                "ORDER BY created_at DESC LIMIT 12"
            ).all();
        } catch (_) {}
        const alertStatusFor = (a) => {
            if (a.action === "soft_delete" || a.action === "delete") return "bad";
            if (a.action === "unapprove") return "warn";
            return "info";
        };
        const alertLabelFor = (a) => ({
            soft_delete: "訂單作廢",
            delete: "刪除品項",
            unapprove: "取消確認",
            approve: "已確認",
        })[a.action] || a.action;
        // ── 訂單流量 24h：依 updated_at 台北日期 = 今日，按台北小時聚合 ──
        // 註：order_date 是送貨日（06:00 後叫的貨會跳到隔天），不適合作為「今日活動」篩選。
        //     orders 沒有 created_at 欄位，但訂單建立時會寫 updated_at，後續編輯也會更新。
        //     用 updated_at 的台北日期做近似「今日活動」。
        const hourBars = new Array(24).fill(0);
        let chartTotal = 0;
        try {
            const isPg = Boolean(process.env.DATABASE_URL);
            const rows = isPg
                ? await db.prepare("SELECT EXTRACT(HOUR FROM (updated_at AT TIME ZONE 'Asia/Taipei'))::int AS h, COUNT(*) AS n FROM orders WHERE (updated_at AT TIME ZONE 'Asia/Taipei')::date = ?::date AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') GROUP BY h").all(today)
                : await db.prepare("SELECT CAST(strftime('%H', datetime(updated_at, '+8 hours')) AS INTEGER) AS h, COUNT(*) AS n FROM orders WHERE date(datetime(updated_at, '+8 hours')) = date(?) AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') GROUP BY h").all(today);
            for (const r of rows || []) {
                const h = Number(r.h);
                const n = Number(r.n) || 0;
                if (Number.isFinite(h) && h >= 0 && h < 24) {
                    hourBars[h] = n;
                    chartTotal += n;
                }
            }
        } catch (e) { console.warn("[admin] dashboard hour bars query failed:", e?.message || e); }
        const hoursWindow = hourBars.slice(6, 22); // 6:00 ~ 21:00
        const hourMax = Math.max(1, ...hoursWindow);
        const peakH = 6 + hoursWindow.indexOf(hourMax);
        const flowBarsHtml = hoursWindow.map((v, i) => {
            const hour = 6 + i;
            const isPeak = v === hourMax && v > 0;
            const barH = Math.round((v / hourMax) * 110);
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
                <span class="mono" style="font-size:9px;color:${v?"var(--txt-2)":"transparent"};margin-bottom:2px;">${v || "·"}</span>
                <div style="width:100%;height:${v?Math.max(barH,2):0}px;background:var(--accent);opacity:${isPeak?1:0.45};border-radius:2px 2px 0 0;"></div>
                <span class="mono" style="font-size:9px;color:var(--txt-3);margin-top:4px;">${hour}</span>
              </div>`;
        }).join("");
        // ── 客戶綁定情況 ────────────────────────────────────────
        let custTotal = 0, custBound = 0;
        try {
            const r = await db.prepare("SELECT COUNT(*) AS n FROM customers").get();
            custTotal = Number(r?.n) || 0;
            const r2 = await db.prepare("SELECT COUNT(*) AS n FROM customers WHERE line_group_id IS NOT NULL AND line_group_id != ''").get();
            custBound = Number(r2?.n) || 0;
        } catch (_) {}
        // ── 冷凍冷藏 / 盤點 ──────────────────────────────────────
        let freezerRows = [];
        try {
            freezerRows = await db.prepare("SELECT name, freezer_type FROM freezer_fridge_warehouses ORDER BY name LIMIT 8").all();
        } catch (_) {}
        const tapmc = wholesale_price_js_1.TAPMC_PRICE_URL;
        // ── 近 7 日走勢（sparkline）：訂單／已確認／客訴 逐日計數（依 order_date）──
        //    待簽核、提醒叫貨屬「當下狀態」無歷史序列，不畫趨勢線（不假造數據）。
        const trendDays = [];
        for (let i = 6; i >= 0; i--)
            trendDays.push(new Date(todayDate.getTime() - i * 86400000).toISOString().slice(0, 10));
        const sparkOrders = new Array(7).fill(0);
        const sparkComplaints = new Array(7).fill(0);
        try {
            const isPg = Boolean(process.env.DATABASE_URL);
            const dcol = isPg ? "to_char(order_date,'YYYY-MM-DD')" : "order_date";
            const from = trendDays[0];
            const idxOf = (d) => trendDays.indexOf(String(d).slice(0, 10));
            const fill = (rows, arr) => { for (const r of rows || []) { const k = idxOf(r.d); if (k >= 0) arr[k] = Number(r.n) || 0; } };
            fill(await db.prepare(`SELECT ${dcol} AS d, COUNT(*) AS n FROM orders WHERE order_date >= ? AND order_date <= ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') GROUP BY ${dcol}`).all(from, today), sparkOrders);
            fill(await db.prepare(`SELECT ${dcol} AS d, COUNT(*) AS n FROM orders WHERE order_date >= ? AND order_date <= ? AND LOWER(TRIM(COALESCE(status,''))) = 'complaint' GROUP BY ${dcol}`).all(from, today), sparkComplaints);
        } catch (e) { console.warn("[admin] dashboard sparkline query failed:", e?.message || e); }
        // ── 北農行情：漲跌幅最大品項（最新快照日 vs 前一快照日，台北一/二以量加權合併均價）──
        //    點入連到 /admin/logistics/market；附該品項近 14 日均價趨勢線。
        let marketMover = null, marketSpark = null;
        try {
            const latestMk = await wholesale_snapshot_js_1.getLatestWholesaleSnapshotDate(db);
            if (latestMk) {
                const prevRow = await db.prepare("SELECT record_date FROM wholesale_market_snapshots WHERE record_date < ? ORDER BY record_date DESC LIMIT 1").get(latestMk);
                const prevMk = prevRow?.record_date || null;
                const wavgByCrop = async (d) => {
                    const rows = await db.prepare("SELECT crop_name, avg_price, volume FROM wholesale_market_snapshots WHERE record_date = ? AND avg_price IS NOT NULL").all(d);
                    const m = new Map();
                    for (const r of rows || []) {
                        const k = String(r.crop_name || "").trim();
                        if (!k) continue;
                        const a = Number(r.avg_price), v = Number(r.volume) || 0;
                        if (!Number.isFinite(a)) continue;
                        if (!m.has(k)) m.set(k, { wsum: 0, vsum: 0, asum: 0, cnt: 0 });
                        const o = m.get(k); o.wsum += a * v; o.vsum += v; o.asum += a; o.cnt++;
                    }
                    const out = new Map();
                    for (const [k, o] of m) out.set(k, o.vsum > 0 ? o.wsum / o.vsum : o.asum / o.cnt);
                    return out;
                };
                if (prevMk) {
                    const tMap = await wavgByCrop(latestMk), pMap = await wavgByCrop(prevMk);
                    let best = null;
                    for (const [crop, tAvg] of tMap) {
                        const pAvg = pMap.get(crop);
                        if (pAvg == null || pAvg < 1 || tAvg == null) continue;
                        const pct = (tAvg - pAvg) / pAvg * 100;
                        if (!best || Math.abs(pct) > Math.abs(best.pct)) best = { crop, pct, todayAvg: tAvg, prevAvg: pAvg };
                    }
                    if (best) {
                        marketMover = { ...best, dir: best.pct >= 0 ? "up" : "down" };
                        const hist = await wholesale_snapshot_js_1.loadWholesaleCropHistory(db, best.crop, 14);
                        marketSpark = (hist || []).map(h => (h.avg != null ? Number(h.avg) : null)).filter(v => v != null && Number.isFinite(v));
                    }
                }
            }
        } catch (e) { console.warn("[admin] dashboard market mover failed:", e?.message || e); }
        let _sparkSeq = 0;
        const sparkSvg = (pts, tone) => {
            if (!Array.isArray(pts) || pts.length < 2 || pts.every(v => !v)) return "";
            const w = 220, h = 30, max = Math.max(...pts), min = Math.min(...pts), rg = (max - min) || 1;
            const X = (i) => +(i * (w / (pts.length - 1))).toFixed(1);
            const Y = (v) => +(h - 2 - ((v - min) / rg) * (h - 6)).toFixed(1);
            let d = "M" + X(0) + " " + Y(pts[0]);
            for (let i = 1; i < pts.length; i++) d += " L" + X(i) + " " + Y(pts[i]);
            const area = d + " L" + w + " " + h + " L0 " + h + " Z";
            const c = "var(--" + (tone || "accent") + ")";
            const gid = "sfspk" + (++_sparkSeq);
            return `<svg class="sf-kpi-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0.22"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
              <path d="${area}" fill="url(#${gid})"/>
              <path d="${d}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
              <circle cx="${X(pts.length - 1)}" cy="${Y(pts[pts.length - 1])}" r="2.4" fill="${c}"/>
            </svg>`;
        };
        const kpiCard = (label, num, unit, sub, status, delta, href, opts = {}) => {
            const tone = opts.tone || status || "accent";
            const badge = opts.badge != null ? opts.badge : null;
            const spark = opts.spark || null;
            return `
          <a href="${href || "#"}" class="sf-kpi sf-kpi-glow ${status?"status-"+status:""}" style="--kpi-glow:var(--${tone}-soft);text-decoration:none;color:inherit;display:block;cursor:pointer;">
            <div class="sf-kpi-head">
              <span class="sf-kpi-label">${label}</span>
              ${badge!=null?`<span class="sf-kpi-badge ${tone}">${badge}</span>`:(status?`<span class="sf-dot ${status}"></span>`:"")}
            </div>
            <div class="sf-kpi-value">
              <span class="sf-kpi-num">${num}</span>
              ${unit?`<span class="sf-kpi-unit">${unit}</span>`:""}
            </div>
            ${spark?sparkSvg(spark, tone):""}
            <div class="sf-kpi-foot">
              ${delta?`<span class="mono">${delta}</span>`:""}
              ${sub?`<span>${sub}</span>`:""}
            </div>
          </a>`;
        };
        const alertsRows = alerts.length
            ? alerts.map(a => {
                const s = alertStatusFor(a);
                return `<div style="padding:12px 16px;border-bottom:var(--hairline);display:flex;gap:10px;${s==="bad"?"background:var(--bad-soft);":""}">
                  <div style="padding-top:4px;"><span class="sf-dot ${s}"></span></div>
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                      <span class="mono" style="font-size:11px;color:var(--txt-3);">${escapeHtml(String(a.created_at||"").slice(11,19))}</span>
                      <span style="font-size:13px;font-weight:500;color:var(--txt-1);">${escapeHtml(alertLabelFor(a))}</span>
                      <span class="sf-pill">${escapeHtml(a.actor_username||"system")}</span>
                    </div>
                    <div style="font-size:12px;color:var(--txt-2);line-height:1.5;">${escapeHtml(a.summary||"")}</div>
                  </div>
                </div>`;
              }).join("")
            : `<div style="padding:24px;text-align:center;color:var(--txt-3);font-size:13px;">尚無稽核事件</div>`;
        const checklistCard = (title, head, items, href) => `
          <a href="${href || "#"}" class="sf-card" style="text-decoration:none;color:inherit;display:block;transition:transform .12s,border-color .12s;">
            <div class="sf-card-head">
              <div class="sf-card-title">${title}</div>
              <span class="mono" style="font-size:11px;color:var(--txt-3);">${head} ›</span>
            </div>
            <div style="padding:12px 16px;display:flex;flex-direction:column;gap:6px;">
              ${items.map((it, idx) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;border-bottom:${idx<items.length-1?"1px dashed var(--line)":"none"};">
                <span class="sf-dot ${it.status||""}"></span>
                <span style="color:var(--txt-2);flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escapeHtml(it.name)}</span>
                <span class="mono" style="color:${it.status==="bad"?"var(--bad)":it.status==="warn"?"var(--warn)":"var(--txt-1)"};">${escapeHtml(it.val||"")}</span>
              </div>`).join("")}
            </div>
          </a>`;
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:20px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="sf-breadcrumb" style="margin-bottom:6px;">日常作業 / 儀表板</div>
              <h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.01em;">松富物流 · HACCP 監控中心</h1>
              <div style="margin-top:6px;font-size:12px;color:var(--txt-3);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <span class="mono">作業日 · ${today} (週${weekdayZh})</span>
                <span class="sf-pill ok"><span class="sf-dot ok"></span>系統正常</span>
                <span class="sf-pill info">DB · ${process.env.DATABASE_URL?"PostgreSQL":"SQLite"}</span>
                <span class="sf-pill accent">${SF_ICONS.spark} 視覺 ${escapeHtml((process.env.GEMINI_MODEL_VISION || process.env.GEMINI_MODEL || "gemini-2.5-flash").replace(/^gemini-/, "Gemini ").replace(/^claude-/, "Claude ").replace(/-/g, " ").replace(/\b(pro|flash|lite|sonnet|opus|haiku)\b/gi, (s) => s.charAt(0).toUpperCase() + s.slice(1)))}</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a class="sf-btn primary" href="/admin/scan-tool" title="用手機相機掃條碼：速查庫存或快速建檔">${SF_ICONS.search}<span>掃碼速查</span></a>
              <a class="sf-btn" href="/admin/export">${SF_ICONS.dl}<span>當日報表</span></a>
              ${(process.env.LIFF_ID_ORDER_REVIEW||"").trim() ? `<button type="button" class="sf-btn" onclick="(async()=>{try{await navigator.clipboard.writeText('https://liff.line.me/${escapeAttr((process.env.LIFF_ID_ORDER_REVIEW||'').trim())}');this.querySelector('span').textContent='已複製，請貼到 LINE';setTimeout(()=>this.querySelector('span').textContent='手機審核連結',2000);}catch(e){prompt('複製失敗，請手動複製：','https://liff.line.me/${escapeAttr((process.env.LIFF_ID_ORDER_REVIEW||'').trim())}');}})();" title="複製訂單審核 LIFF 連結，貼到 LINE 開啟">${SF_ICONS.phone}<span>手機審核連結</span></button>` : ""}
              <a class="sf-btn primary" href="/admin/orders?need_review=1">${SF_ICONS.check}<span>批次簽核 (${pendingOrders})</span></a>
            </div>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            ${kpiCard("今日訂單", totalOrders, "單", "近 7 日走勢 · 昨日 " + yesterdayOrders, "ok", null, "/admin/orders", { tone: "accent", badge: deltaOrders>0?`↑ +${deltaOrders}`:deltaOrders<0?`↓ ${deltaOrders}`:"持平", spark: sparkOrders })}
            ${kpiCard("待簽核", pendingOrders, "單", needReviewCnt?`含品項待確認 ${needReviewCnt}`:"目前無待確認品項", pendingOrders>5?"warn":"ok", null, "/admin/orders?status=pending", { badge: pendingOrders>5?"待處理":"正常" })}
            ${marketMover
                ? kpiCard("北農行情", (marketMover.pct>=0?"+":"")+marketMover.pct.toFixed(1), "%", `${marketMover.crop} $${Math.round(marketMover.prevAvg)}→$${Math.round(marketMover.todayAvg)}`, marketMover.dir==="up"?"bad":"ok", null, "/admin/logistics/market", { badge: marketMover.dir==="up"?"▲ 漲最多":"▼ 跌最多", spark: marketSpark })
                : kpiCard("北農行情", "查看", "", "點入每日各市場行情表", "info", null, "/admin/logistics/market", { badge: "行情表" })}
            ${kpiCard("客訴", complaintsOpenTotal, "未解決", complaintsTodayNew>0?`今日新增 ${complaintsTodayNew}`:"近 7 日客訴走勢", complaintsOpenTotal>0?"bad":"ok", null, "/admin/complaints", { badge: complaintsOpenTotal>0?"未解決":"清空", spark: sparkComplaints })}
            ${kpiCard("提醒叫貨", reminderTotal, "戶", reminderCritical > 0 ? `嚴重逾期 ${reminderCritical} 戶` : reminderTotal > 0 ? "逾期未叫貨" : "全部準時", reminderCritical > 0 ? "bad" : reminderTotal > 0 ? "warn" : "ok", null, "/admin/reminders", { badge: reminderCritical>0?`嚴重 ${reminderCritical}`:reminderTotal>0?"逾期":"準時" })}
          </div>
          ${quoteReminderCard}
          <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
          ${reminderTop.length ? `
          <div class="sf-card" style="flex:1 1 380px;min-width:0;border-left:4px solid #f59e0b;">
            <div class="sf-card-head">
              <a href="/admin/reminders" style="display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;">
                <div class="sf-card-title">${SF_ICONS.bell}提醒叫貨 Top ${reminderTop.length}（共 ${reminderTotal} 戶）</div>
              </a>
              <a href="/admin/reminders" class="sf-card-sub">完整清單 →</a>
            </div>
            <div style="padding:0;">
              ${reminderTop.map(c => {
                const tagCls = c.overdueRatio >= 3 ? "bad" : c.overdueRatio >= 2 ? "warn" : "info";
                const tagLabel = c.overdueRatio >= 3 ? "嚴重" : c.overdueRatio >= 2 ? "高" : "中";
                return `<a href="/admin/customers/${encodeURIComponent(c.id)}/360" style="display:flex;gap:12px;padding:10px 16px;border-bottom:var(--hairline);text-decoration:none;color:inherit;align-items:center;">
                  <span class="sf-pill ${tagCls}">${tagLabel}</span>
                  <span style="flex:1;font-size:13px;">${escapeHtml(c.name)}</span>
                  <span style="font-size:12px;color:var(--txt-3);">最後 ${escapeHtml(c.lastOrderDate || "—")}</span>
                  <span class="mono" style="font-size:12px;"><strong style="color:var(--bad);">${c.daysSinceLastOrder} 天</strong> / 平均 ${c.avgIntervalDays} 天</span>
                </a>`;
              }).join("")}
            </div>
          </div>` : ""}
          ${complaintsTodayOpen.length ? `
          <div class="sf-card" style="flex:1 1 380px;min-width:0;border-left:4px solid #ef4444;">
            <div class="sf-card-head">
              <a href="/admin/complaints" style="display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;">
                <div class="sf-card-title">${SF_ICONS.warn}未解決客訴（${complaintsOpenTotal}）</div>
              </a>
              <a href="/admin/complaints" class="sf-card-sub">前往處理 →</a>
            </div>
            <div>
              ${complaintsTodayOpen.map(c => {
                const t = String(c.raw_message || "").replace(/\[圖片\]/g, "[圖]").trim();
                const preview = t.length > 80 ? t.slice(0, 80) + "…" : t;
                const statusPill = c.handle_status === "handling"
                  ? `<span class="sf-pill warn">處理中</span>`
                  : `<span class="sf-pill bad">待處理</span>`;
                return `<a href="/admin/complaints/${encodeURIComponent(c.id)}" style="display:flex;gap:12px;padding:10px 16px;border-bottom:var(--hairline);text-decoration:none;color:inherit;align-items:flex-start;">
                  <div style="min-width:80px;font-size:12px;color:var(--txt-3);">${escapeHtml(c.order_date)}</div>
                  <div style="min-width:120px;font-size:13px;font-weight:500;">${escapeHtml(c.customer_name)}</div>
                  <div style="flex:1;font-size:12px;color:var(--txt-2);">${escapeHtml(preview) || "<span style='color:var(--txt-3);'>—</span>"}</div>
                  <div style="display:flex;gap:6px;align-items:center;">${statusPill}${c.handler ? `<span style="font-size:12px;color:var(--txt-3);">${escapeHtml(c.handler)}</span>` : ""}</div>
                </a>`;
              }).join("")}
            </div>
          </div>` : ""}
          </div>
          <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;">
            <div class="sf-card">
              <div class="sf-card-head">
                <div class="sf-card-title">${SF_ICONS.list} 今日叫貨流量 · 06:00–21:00</div>
                <span class="sf-card-sub">${chartTotal>0?`尖峰 ${peakH}:00 · 共 ${chartTotal} 單`:"今日尚未收到訂單"}</span>
              </div>
              <div style="padding:16px;">
                ${chartTotal>0
                  ? `<div style="display:flex;align-items:flex-end;gap:4px;height:140px;">${flowBarsHtml}</div>`
                  : `<div style="height:140px;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--txt-3);font-size:13px;border:1px dashed var(--line);border-radius:var(--radius);background:var(--bg-2);">${SF_ICONS.chartBar} 今日（依收單時間）尚未收到訂單</div>`}
                <div style="margin-top:16px;padding-top:14px;border-top:var(--hairline);display:flex;gap:24px;font-size:12px;color:var(--txt-2);flex-wrap:wrap;">
                  ${chartTotal>0?`<span>尖峰 <strong class="mono" style="color:var(--txt-1);margin-left:6px;">${peakH}:00</strong></span>`:""}
                  <span>今日收單 <strong class="mono" style="color:var(--txt-1);margin-left:6px;">${chartTotal}</strong></span>
                  <span>送貨日 ${today} 訂單 <strong class="mono" style="color:var(--txt-1);margin-left:6px;">${totalOrders}</strong></span>
                  <span>待確認 <strong class="mono" style="color:${needReviewCnt?"var(--warn)":"var(--ok)"};margin-left:6px;">${needReviewCnt}/${totalOrders||"-"}</strong></span>
                  <a href="/admin/orders" style="margin-left:auto;font-size:12px;">前往訂單管理 →</a>
                </div>
              </div>
            </div>
            <div class="sf-card" style="display:flex;flex-direction:column;">
              <div class="sf-card-head">
                <a href="/admin/audit" style="display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;">
                  <div class="sf-card-title">${SF_ICONS.bell} 即時稽核事件</div>
                </a>
                <a href="/admin/audit" style="text-decoration:none;"><span class="sf-pill ${alerts.filter(a=>alertStatusFor(a)==="bad").length?"bad":"info"}">${alerts.length} 筆 ›</span></a>
              </div>
              <div style="flex:1;overflow:auto;max-height:380px;">${alertsRows}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
            ${checklistCard("冷凍／冷藏庫", `${freezerRows.length} 個庫房`, freezerRows.slice(0,4).map(r => ({ name: r.name, val: r.freezer_type || "—", status: "info" })), "/admin/freezer-fridge")}
            ${checklistCard("每日盤點", `${today}`, [{ name: "前往盤點作業", val: "→", status: "info" }, { name: "盤差報表", val: "→", status: "info" }, { name: "庫房管理", val: "→", status: "info" }, { name: "ERP 匯入", val: "→", status: "info" }], "/admin/inventory")}
            ${checklistCard("LINE 綁定", `${custBound} / ${custTotal} 戶`, [{ name: "已綁定客戶", val: custBound + " 戶", status: "ok" }, { name: "未綁定客戶", val: (custTotal-custBound) + " 戶", status: custBound===custTotal?"ok":"warn" }, { name: "群發訊息", val: "→", status: "info" }, { name: "綁定檢查", val: "→", status: "info" }], "/admin/customers")}
          </div>
          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.spark} 北農行情</div>
              <a href="${tapmc}" target="_blank" rel="noopener" class="sf-card-sub">前往臺北農產 →</a>
            </div>
            <div style="padding:14px 16px;display:flex;gap:12px;align-items:center;">
              <span style="font-size:12px;color:var(--txt-3);">即時行情請至臺北農產官網查詢。</span>
              <a href="/admin/logistics/market" class="sf-btn sm">系統整理版</a>
            </div>
          </div>
          <div class="sf-card" id="cost-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.spark} 費用概覽</div>
              <span class="sf-card-sub">
                <button type="button" id="cost-refresh-btn" class="sf-btn sm" style="margin-right:8px;">重新整理</button>
                <span class="mono" id="cost-updated" style="font-size:11px;color:var(--txt-3);">載入中…</span>
              </span>
            </div>
            <div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div id="cost-line" style="border:1px solid var(--line);border-radius:var(--radius);padding:14px;background:var(--bg-1);">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                  <strong style="font-size:13px;">LINE 訊息額度（本月）</strong>
                  <span class="mono" id="cost-line-status" style="font-size:11px;color:var(--txt-3);">—</span>
                </div>
                <div id="cost-line-body" style="min-height:96px;display:flex;align-items:center;justify-content:center;color:var(--txt-3);font-size:13px;">載入中…</div>
                <div style="margin-top:8px;font-size:11px;color:var(--txt-3);">含 broadcast / push / multicast；reply 不計費</div>
              </div>
              <div id="cost-gemini" style="border:1px solid var(--line);border-radius:var(--radius);padding:14px;background:var(--bg-1);">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
                  <strong style="font-size:13px;">AI 視覺辨識用量（估算）</strong>
                  <a href="/admin/recognition-stats" class="mono" style="font-size:11px;">辨識成效 →</a>
                </div>
                <div id="cost-gemini-body" style="min-height:96px;display:flex;align-items:center;justify-content:center;color:var(--txt-3);font-size:13px;">載入中…</div>
                <div style="margin-top:8px;font-size:11px;color:var(--txt-3);">含 Gemini + Claude；以各家公告單價估算，實際以 GCP / Anthropic 帳單為準</div>
              </div>
            </div>
          </div>
        </div>
        <script>
        (function(){
          const $ = (s) => document.querySelector(s);
          const fmtInt = (n) => Number(n||0).toLocaleString();
          const fmtUsd = (n) => "US$" + (Number(n||0)).toFixed(4);
          function renderLine(line){
            const box = $("#cost-line-body");
            const status = $("#cost-line-status");
            if (!line || !line.ok) {
              status.textContent = "未連線";
              box.innerHTML = '<span style="color:var(--warn);">' + (line && line.error ? line.error : "無法取得 LINE 額度") + '</span>';
              return;
            }
            if (line.unlimited) {
              status.textContent = "無上限方案";
              box.innerHTML = '<div style="text-align:center;"><div style="font-size:28px;font-weight:600;font-family:var(--mono,monospace);">' + fmtInt(line.used) + '</div><div style="font-size:12px;color:var(--txt-2);">本月已送出（無上限）</div></div>';
              return;
            }
            const pct = Math.min(100, Math.max(0, Number(line.percent)||0));
            const color = pct > 90 ? "var(--bad)" : pct > 70 ? "var(--warn)" : "var(--ok)";
            status.textContent = pct + "% 已用";
            box.innerHTML =
              '<div style="width:100%;">' +
                '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;"><span>已用 <strong class="mono">' + fmtInt(line.used) + '</strong></span><span>剩餘 <strong class="mono" style="color:' + color + ';">' + fmtInt(line.remaining) + '</strong> / ' + fmtInt(line.quota) + '</span></div>' +
                '<div style="height:10px;background:var(--bg-2);border-radius:5px;overflow:hidden;border:1px solid var(--line);"><div style="height:100%;width:' + pct + '%;background:' + color + ';"></div></div>' +
              '</div>';
          }
          function renderGemini(g){
            const box = $("#cost-gemini-body");
            if (!g || !g.ok) {
              box.innerHTML = '<span style="color:var(--warn);">' + (g && g.error ? g.error : "無法統計 AI 用量") + '</span>';
              return;
            }
            const t = g.today || { calls:0, tokens:0, usd:0 };
            const m = g.month || { calls:0, tokens:0, usd:0, byModel:[], byVendor:{} };
            // 供應商徽章樣式
            function vendorBadge(v){
              const styles = {
                gemini: 'background:#e8f1ff;color:#1d4ed8;',
                claude: 'background:#fff0e8;color:#c2410c;',
                unknown: 'background:#f1f1f1;color:#666;',
              };
              const labels = { gemini: 'Gemini', claude: 'Claude', unknown: '?' };
              const s = styles[v] || styles.unknown;
              return '<span style="' + s + 'font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;margin-right:4px;">' + (labels[v] || v) + '</span>';
            }
            // 模型列：加上供應商徽章
            const modelRows = (m.byModel||[]).map(r =>
              '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--txt-2);padding:2px 0;align-items:center;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%;">' + vendorBadge(r.vendor) + r.model + '</span><span class="mono">' + fmtInt(r.in + r.out) + ' tok · ' + fmtUsd(r.usd) + '</span></div>'
            ).join("");
            // 供應商小計（本月）
            const bv = m.byVendor || {};
            const vendorCells = [];
            if (bv.gemini && bv.gemini.calls > 0) {
              vendorCells.push('<div style="font-size:11px;color:var(--txt-2);">' + vendorBadge('gemini') + '<span class="mono">' + fmtUsd(bv.gemini.usd) + ' · ' + fmtInt(bv.gemini.calls) + ' 次</span></div>');
            }
            if (bv.claude && bv.claude.calls > 0) {
              vendorCells.push('<div style="font-size:11px;color:var(--txt-2);">' + vendorBadge('claude') + '<span class="mono">' + fmtUsd(bv.claude.usd) + ' · ' + fmtInt(bv.claude.calls) + ' 次</span></div>');
            }
            const vendorRow = vendorCells.length > 1
              ? '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0;border-top:1px dashed var(--line);padding-top:6px;">' + vendorCells.join("") + '</div>'
              : '';
            box.innerHTML =
              '<div style="width:100%;">' +
                '<div style="display:flex;gap:12px;justify-content:space-around;text-align:center;margin-bottom:10px;">' +
                  '<div><div style="font-size:11px;color:var(--txt-3);">今日</div><div class="mono" style="font-size:18px;font-weight:600;">' + fmtUsd(t.usd) + '</div><div style="font-size:11px;color:var(--txt-2);">' + fmtInt(t.tokens) + ' tok · ' + fmtInt(t.calls) + ' 次</div></div>' +
                  '<div style="border-left:1px solid var(--line);"></div>' +
                  '<div><div style="font-size:11px;color:var(--txt-3);">本月</div><div class="mono" style="font-size:18px;font-weight:600;">' + fmtUsd(m.usd) + '</div><div style="font-size:11px;color:var(--txt-2);">' + fmtInt(m.tokens) + ' tok · ' + fmtInt(m.calls) + ' 次</div></div>' +
                '</div>' +
                vendorRow +
                (modelRows ? '<div style="border-top:1px dashed var(--line);padding-top:6px;">' + modelRows + '</div>' : '') +
              '</div>';
          }
          async function loadCost(){
            try {
              const r = await fetch("/admin/api/cost-summary", { credentials: "same-origin" });
              const j = await r.json();
              renderLine(j.line);
              renderGemini(j.gemini);
              const t = j.generatedAt ? new Date(j.generatedAt) : new Date();
              $("#cost-updated").textContent = "更新於 " + t.toLocaleTimeString("zh-TW", { hour12: false });
            } catch (e) {
              $("#cost-updated").textContent = "讀取失敗";
            }
          }
          document.getElementById("cost-refresh-btn").addEventListener("click", loadCost);
          loadCost();
        })();
        </script>`;
        res.type("text/html").send(notionPage("儀表板", body, "dashboard", res));
    });
    // === 行事曆事件 API ===
    router.get("/api/dashboard-events", async (req, res) => {
        try {
            const d = String(req.query.date || "").trim();
            const from = String(req.query.from || "").trim();
            const to = String(req.query.to || "").trim();
            let rows = [];
            if (d) {
                rows = await db.prepare("SELECT id, event_date, title, description, color, created_by, created_at, updated_at FROM dashboard_events WHERE event_date = ? ORDER BY created_at").all(d);
            } else if (from && to) {
                rows = await db.prepare("SELECT id, event_date, title, description, color FROM dashboard_events WHERE event_date >= ? AND event_date <= ? ORDER BY event_date, created_at").all(from, to);
            } else {
                rows = await db.prepare("SELECT id, event_date, title, description, color FROM dashboard_events ORDER BY event_date DESC LIMIT 200").all();
            }
            res.json({ ok: true, events: rows || [] });
        } catch (e) {
            res.status(500).json({ ok: false, error: e?.message || "讀取失敗" });
        }
    });
    router.post("/api/dashboard-events", express_1.default.json(), async (req, res) => {
        try {
            const event_date = String(req.body?.event_date || "").trim();
            const title = String(req.body?.title || "").trim();
            const description = req.body?.description ? String(req.body.description).trim() : null;
            const color = String(req.body?.color || "#1d5fad").trim().slice(0, 7);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) { res.status(400).json({ ok: false, error: "event_date 格式錯誤" }); return; }
            if (!title) { res.status(400).json({ ok: false, error: "請填入標題" }); return; }
            const id = (0, id_js_1.newId)("ev");
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            await db.prepare("INSERT INTO dashboard_events (id, event_date, title, description, color, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, " + nowSql + ", " + nowSql + ")").run(id, event_date, title, description, color, req.adminUsername || "");
            res.json({ ok: true, id });
        } catch (e) {
            res.status(500).json({ ok: false, error: e?.message || "建立失敗" });
        }
    });
    router.post("/api/dashboard-events/:id/delete", async (req, res) => {
        try {
            await db.prepare("DELETE FROM dashboard_events WHERE id = ?").run(req.params.id);
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ ok: false, error: e?.message || "刪除失敗" });
        }
    });
    // === 費用概覽 API（LINE 訊息額度 + AI 視覺辨識 token 估算）===
    // 註：AI 單價依各家公告（per 1M tokens, USD），與實際帳單可能略有差異；
    //     LINE quota: -1 / type=none 代表無上限方案。
    const AI_PRICE_PER_M = {
        // Gemini
        "gemini-2.5-flash":      { in: 0.30,  out: 2.50,  vendor: "gemini" },
        "gemini-2.5-flash-lite": { in: 0.10,  out: 0.40,  vendor: "gemini" },
        "gemini-2.5-pro":        { in: 1.25,  out: 10.00, vendor: "gemini" },
        "gemini-2.0-flash":      { in: 0.10,  out: 0.40,  vendor: "gemini" },
        "gemini-2.0-flash-lite": { in: 0.075, out: 0.30,  vendor: "gemini" },
        "gemini-1.5-flash":      { in: 0.075, out: 0.30,  vendor: "gemini" },
        "gemini-1.5-pro":        { in: 1.25,  out: 5.00,  vendor: "gemini" },
        // Claude（Anthropic 公告：sonnet-4-5 in $3/out $15、opus-4-5 in $15/out $75、haiku-4-5 in $1/out $5）
        "claude-sonnet-4-5":     { in: 3.00,  out: 15.00, vendor: "claude" },
        "claude-opus-4-5":       { in: 15.00, out: 75.00, vendor: "claude" },
        "claude-haiku-4-5":      { in: 1.00,  out: 5.00,  vendor: "claude" },
        "claude-sonnet-4":       { in: 3.00,  out: 15.00, vendor: "claude" },
        "claude-opus-4":         { in: 15.00, out: 75.00, vendor: "claude" },
        "claude-haiku-4":        { in: 1.00,  out: 5.00,  vendor: "claude" },
    };
    // 向後相容
    const GEMINI_PRICE_PER_M = AI_PRICE_PER_M;
    const AI_PRICE_DEFAULT = { in: 0.30, out: 2.50, vendor: "unknown" };
    const GEMINI_PRICE_DEFAULT = AI_PRICE_DEFAULT;
    function priceForModel(name) {
        const k = String(name || "").toLowerCase().trim();
        if (!k) return AI_PRICE_DEFAULT;
        if (AI_PRICE_PER_M[k]) return AI_PRICE_PER_M[k];
        // 容錯：含關鍵字就比對最相近的
        for (const key of Object.keys(AI_PRICE_PER_M)) {
            if (k.startsWith(key)) return AI_PRICE_PER_M[key];
        }
        // 完全未知但能辨別供應商
        if (k.startsWith("claude-")) return { in: 3.00, out: 15.00, vendor: "claude" };
        if (k.startsWith("gemini-")) return { in: 0.30, out: 2.50, vendor: "gemini" };
        return AI_PRICE_DEFAULT;
    }
    async function fetchLineQuota() {
        const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
        if (!token) return { ok: false, error: "未設定 LINE_CHANNEL_ACCESS_TOKEN" };
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [qr, cr] = await Promise.all([
                fetch("https://api.line.me/v2/bot/message/quota", { headers }),
                fetch("https://api.line.me/v2/bot/message/quota/consumption", { headers }),
            ]);
            if (!qr.ok) return { ok: false, error: `quota HTTP ${qr.status}` };
            if (!cr.ok) return { ok: false, error: `consumption HTTP ${cr.status}` };
            const q = await qr.json();
            const c = await cr.json();
            const type = String(q?.type || "");
            const value = Number(q?.value ?? -1);
            const used = Number(c?.totalUsage ?? 0);
            const unlimited = type === "none" || value < 0;
            return {
                ok: true,
                type,
                unlimited,
                quota: unlimited ? null : value,
                used,
                remaining: unlimited ? null : Math.max(0, value - used),
                percent: unlimited ? null : (value > 0 ? Math.round((used / value) * 1000) / 10 : 0),
            };
        } catch (e) {
            return { ok: false, error: String(e?.message || e).slice(0, 200) };
        }
    }
    async function aggregateGeminiUsage() {
        const isPg = Boolean(process.env.DATABASE_URL);
        const todaySql = isPg
            ? "SELECT model_name, SUM(COALESCE(prompt_tokens,0)) AS pin, SUM(COALESCE(candidates_tokens,0)) AS pout, COUNT(*) AS n FROM gemini_usage_log WHERE (created_at AT TIME ZONE 'Asia/Taipei')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date GROUP BY model_name"
            : "SELECT model_name, SUM(COALESCE(prompt_tokens,0)) AS pin, SUM(COALESCE(candidates_tokens,0)) AS pout, COUNT(*) AS n FROM gemini_usage_log WHERE date(datetime(created_at, '+8 hours')) = date(datetime('now', '+8 hours')) GROUP BY model_name";
        const monthSql = isPg
            ? "SELECT model_name, SUM(COALESCE(prompt_tokens,0)) AS pin, SUM(COALESCE(candidates_tokens,0)) AS pout, COUNT(*) AS n FROM gemini_usage_log WHERE to_char((created_at AT TIME ZONE 'Asia/Taipei')::date, 'YYYY-MM') = to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei')::date, 'YYYY-MM') GROUP BY model_name"
            : "SELECT model_name, SUM(COALESCE(prompt_tokens,0)) AS pin, SUM(COALESCE(candidates_tokens,0)) AS pout, COUNT(*) AS n FROM gemini_usage_log WHERE strftime('%Y-%m', datetime(created_at, '+8 hours')) = strftime('%Y-%m', datetime('now', '+8 hours')) GROUP BY model_name";
        function summarize(rows) {
            const byModel = [];
            const byVendor = { gemini: { calls: 0, tokens: 0, usd: 0 }, claude: { calls: 0, tokens: 0, usd: 0 }, unknown: { calls: 0, tokens: 0, usd: 0 } };
            let calls = 0, tokens = 0, usd = 0;
            for (const r of (rows || [])) {
                const pin = Number(r.pin) || 0;
                const pout = Number(r.pout) || 0;
                const p = priceForModel(r.model_name);
                const cost = (pin / 1_000_000) * p.in + (pout / 1_000_000) * p.out;
                const vendor = p.vendor || "unknown";
                byModel.push({ model: r.model_name || "(unknown)", vendor, calls: Number(r.n) || 0, in: pin, out: pout, usd: Math.round(cost * 10000) / 10000 });
                calls += Number(r.n) || 0;
                tokens += pin + pout;
                usd += cost;
                if (!byVendor[vendor]) byVendor[vendor] = { calls: 0, tokens: 0, usd: 0 };
                byVendor[vendor].calls += Number(r.n) || 0;
                byVendor[vendor].tokens += pin + pout;
                byVendor[vendor].usd += cost;
            }
            // 圓化 vendor usd
            for (const k of Object.keys(byVendor)) byVendor[k].usd = Math.round(byVendor[k].usd * 10000) / 10000;
            return { calls, tokens, usd: Math.round(usd * 10000) / 10000, byModel, byVendor };
        }
        try {
            const [todayRows, monthRows] = await Promise.all([
                db.prepare(todaySql).all(),
                db.prepare(monthSql).all(),
            ]);
            return { ok: true, today: summarize(todayRows), month: summarize(monthRows) };
        } catch (e) {
            return { ok: false, error: String(e?.message || e).slice(0, 200) };
        }
    }
    router.get("/api/cost-summary", async (_req, res) => {
        try {
            const [line, gemini] = await Promise.all([fetchLineQuota(), aggregateGeminiUsage()]);
            res.json({ ok: true, line, gemini, generatedAt: new Date().toISOString() });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });
    // === 營運分析 ===
}
