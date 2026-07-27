"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnalysisRoutes = registerAnalysisRoutes;

// 分析報表域（稽核軌跡 /audit、AI 辨識統計 /recognition-stats、AI 評測 /order-eval、
// 叫貨節奏 /rhythm）路由：自 index.js 拆出（拆檔批次 7），純搬移、行為不變。

const express_1 = { default: require("express") };
const gemini_eval_harness_js_1 = require("../lib/gemini-eval-harness.js");
const rhythm_analysis_js_1 = require("../lib/rhythm-analysis.js");
const gemini_prompt_resolve_js_1 = require("../lib/gemini-prompt-resolve.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerAnalysisRoutes(router, ctx) {
    const { db, notionPage, requireManager, getTaipeiCalendarDateYYYYMMDD, fmtTaipeiYMDHM, fmtTaipeiMMDDHHmm } = ctx;
    router.get("/audit", async (req, res) => {
        const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
        const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
        const actor = typeof req.query.actor === "string" ? req.query.actor.trim() : "";
        const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit||"200"), 10) || 200));
        // ── 統計（今日／本週） ─────────────────────────────────
        let todayCount = 0, manualFixCount = 0, geminiCount = 0, alertCount = 0, criticalCount = 0;
        try {
            const today = getTaipeiCalendarDateYYYYMMDD();
            const isPg = Boolean(process.env.DATABASE_URL);
            const todayClause = isPg ? "created_at::date = ?::date" : "date(created_at) = date(?)";
            const r1 = await db.prepare(`SELECT COUNT(*) AS n FROM data_change_log WHERE ${todayClause}`).get(today);
            todayCount = Number(r1?.n) || 0;
            const r2 = await db.prepare(`SELECT COUNT(*) AS n FROM data_change_log WHERE ${todayClause} AND action LIKE 'set_%'`).get(today);
            manualFixCount = Number(r2?.n) || 0;
            const r3 = await db.prepare(`SELECT COUNT(*) AS n FROM gemini_usage_log WHERE ${todayClause}`).get(today);
            geminiCount = Number(r3?.n) || 0;
            const r4 = await db.prepare(`SELECT COUNT(*) AS n FROM data_change_log WHERE ${todayClause} AND action IN ('soft_delete','delete','unapprove')`).get(today);
            alertCount = Number(r4?.n) || 0;
            const r5 = await db.prepare(`SELECT COUNT(*) AS n FROM data_change_log WHERE ${todayClause} AND action IN ('soft_delete','delete')`).get(today);
            criticalCount = Number(r5?.n) || 0;
        } catch (_) { /* ignore */ }
        // ── 主清單 ─────────────────────────────────────────────
        let rows = [];
        try {
            const where = [];
            const params = [];
            if (q) {
                where.push("(summary LIKE ? OR entity_id LIKE ? OR actor_username LIKE ?)");
                const v = `%${q}%`;
                params.push(v, v, v);
            }
            if (action) { where.push("action = ?"); params.push(action); }
            if (actor) { where.push("actor_username = ?"); params.push(actor); }
            const sql = "SELECT created_at, actor_username, action, summary, entity_type, entity_id, meta_json FROM data_change_log" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY created_at DESC LIMIT ?";
            params.push(limit);
            rows = await db.prepare(sql).all(...params);
        } catch (e) {
            console.warn("[audit]", e?.message || e);
        }
        const statusForAction = (a) => {
            if (a === "soft_delete" || a === "delete") return "bad";
            if (a === "unapprove") return "warn";
            if (a === "approve") return "ok";
            if (a && a.startsWith("set_")) return "info";
            if (a === "send_promo" || a === "send_notice" || a === "daily_summary_manual" || a === "daily_summary_dry_run") return "accent";
            return "info";
        };
        const actorColorFor = (name) => {
            const s = String(name || "");
            if (s.toLowerCase().includes("system")) return "var(--txt-3)";
            if (s.toLowerCase().includes("gemini")) return "var(--accent)";
            if (s.toLowerCase().includes("line")) return "var(--ok)";
            return "var(--info)";
        };
        const rowsHtml = rows.length
            ? rows.map(r => {
                const s = statusForAction(r.action);
                let metaPills = "";
                try {
                    if (r.meta_json) {
                        const m = typeof r.meta_json === "string" ? JSON.parse(r.meta_json) : r.meta_json;
                        const entries = [];
                        if (m && typeof m === "object") {
                            for (const [k, v] of Object.entries(m)) {
                                if (v == null || typeof v === "object") continue;
                                if (typeof v === "string" && v.length > 60) continue;
                                entries.push([k, String(v)]);
                                if (entries.length >= 4) break;
                            }
                        }
                        if (entries.length) metaPills = `<div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;">${entries.map(([k,v]) => `<span class="mono" style="font-size:10px;padding:1px 6px;background:var(--bg-3);border-radius:3px;color:var(--txt-3);">${escapeHtml(k)}: <span style="color:var(--txt-1);">${escapeHtml(v)}</span></span>`).join("")}</div>`;
                    }
                } catch (_) {}
                const actorInitial = (r.actor_username || "?").charAt(0).toUpperCase();
                return `<tr>
                  <td class="mono" style="font-size:11px;color:var(--txt-3);white-space:nowrap;">${escapeHtml(String(r.created_at||"").slice(0,19))}</td>
                  <td><span class="sf-dot ${s}"></span></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span class="sf-avatar" style="width:18px;height:18px;font-size:10px;background:${actorColorFor(r.actor_username)};">${escapeHtml(actorInitial)}</span>
                      <span style="font-size:12px;">${escapeHtml(r.actor_username||"system")}</span>
                    </div>
                  </td>
                  <td class="mono" style="font-size:11px;color:var(--accent);">${escapeHtml(r.action||"")}</td>
                  <td class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml((r.entity_type||"") + (r.entity_id?":"+r.entity_id:""))}</td>
                  <td style="font-size:12px;">${escapeHtml(r.summary||"")}${metaPills}</td>
                </tr>`;
              }).join("")
            : `<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--txt-3);">尚無稽核紀錄（或無符合條件的紀錄）</td></tr>`;
        const statCard = (label, num, status) => `
          <div style="padding:10px 16px;background:var(--bg-1);border:var(--hairline);border-radius:var(--radius-md);flex:1;display:flex;align-items:center;gap:10px;">
            <span class="sf-dot ${status}"></span>
            <div>
              <div style="font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">${label}</div>
              <div class="mono" style="font-size:18px;font-weight:600;">${num}</div>
            </div>
          </div>`;
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div>
            <div class="sf-breadcrumb" style="margin-bottom:6px;">報表與通訊 / 稽核軌跡</div>
            <h1 style="margin:0;font-size:22px;font-weight:600;">稽核軌跡</h1>
            <p style="margin-top:4px;color:var(--txt-3);font-size:12px;">所有資料變更皆永久保存。誰、何時、改了什麼，皆可追溯。重大事件（作廢／刪除品項）會以紅色標示。</p>
          </div>
          <form method="get" action="/admin/audit" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <div style="position:relative;flex:0 0 280px;">
              <input class="sf-input" name="q" value="${escapeAttr(q)}" placeholder="搜尋（實體、操作者、摘要）..." style="padding-left:28px;">
              <span style="position:absolute;left:8px;top:10px;color:var(--txt-3);">${SF_ICONS.search}</span>
            </div>
            <input class="sf-input" name="action" value="${escapeAttr(action)}" placeholder="動作（如 soft_delete）" style="flex:0 0 180px;">
            <input class="sf-input" name="actor" value="${escapeAttr(actor)}" placeholder="操作者帳號" style="flex:0 0 160px;">
            <button class="sf-btn" type="submit">${SF_ICONS.filter}<span>套用篩選</span></button>
            <a class="sf-btn" href="/admin/audit">重設</a>
            <div style="flex:1;"></div>
            <span class="sf-pill">共 ${rows.length} 筆 / 限制 ${limit}</span>
          </form>
          <div style="display:flex;gap:12px;">
            ${statCard("今日事件", todayCount, "ok")}
            ${statCard("人工修正", manualFixCount, "info")}
            ${statCard("AI 辨識", geminiCount, "accent")}
            ${statCard("系統警示", alertCount, "warn")}
            ${statCard("重大變更", criticalCount, "bad")}
          </div>
          <div class="sf-card" style="flex:1;min-height:0;display:flex;flex-direction:column;">
            <div>
              <table class="sf-table">
                <thead>
                  <tr>
                    <th style="width:160px;">時間</th>
                    <th style="width:24px;"></th>
                    <th style="width:140px;">操作者</th>
                    <th style="width:200px;">動作</th>
                    <th style="width:200px;">實體</th>
                    <th>摘要</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>
        </div>`;
        res.type("text/html").send(notionPage("稽核軌跡", body, "audit", res));
    });
    router.get("/recognition-stats", async (req, res) => {
        const isPg = Boolean(process.env.DATABASE_URL);
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        let dateFromStr;
        let dateToStr;
        const qf = typeof req.query.date_from === "string" ? req.query.date_from.trim() : "";
        const qt = typeof req.query.date_to === "string" ? req.query.date_to.trim() : "";
        if (dateRe.test(qf) && dateRe.test(qt) && qf <= qt) {
            dateFromStr = qf;
            dateToStr = qt;
        }
        else {
            const days = Math.min(9999, Math.max(1, parseInt(String(req.query.days ?? "30"), 10) || 30));
            const end = new Date();
            const start = new Date(Date.now() - days * 86400000);
            dateFromStr = start.toISOString().slice(0, 10);
            dateToStr = end.toISOString().slice(0, 10);
        }
        let orderDateMin = "2010-01-01";
        let orderDateMax = new Date().toISOString().slice(0, 10);
        try {
            const b = await db.prepare("SELECT MIN(order_date) AS mn, MAX(order_date) AS mx FROM orders").get();
            if (b?.mn != null && dateRe.test(String(b.mn).slice(0, 10)))
                orderDateMin = String(b.mn).slice(0, 10);
            if (b?.mx != null && dateRe.test(String(b.mx).slice(0, 10)))
                orderDateMax = String(b.mx).slice(0, 10);
        }
        catch (_) { /* ignore */ }
        const logDateClause = isPg
            ? `(created_at::date >= ?::date AND created_at::date <= ?::date)`
            : `(date(created_at) >= date(?) AND date(created_at) <= date(?))`;
        let itemStats = [];
        try {
            itemStats = (await db
                .prepare(`SELECT o.customer_id AS cid,
         SUM(CASE WHEN oi.need_review = 1 THEN 1 ELSE 0 END) AS need_review_cnt,
         COUNT(oi.id) AS item_cnt
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.order_date >= ? AND o.order_date <= ?
  GROUP BY o.customer_id`)
                .all(dateFromStr, dateToStr)) || [];
        }
        catch (e) {
            console.error("[admin] recognition-stats itemStats", e?.message || e);
        }
        let fixRows = [];
        try {
            fixRows =
                (await db
                    .prepare(`SELECT meta_json FROM data_change_log WHERE entity_type = 'order_item_product' AND action = 'set_product' AND ${logDateClause}`)
                    .all(dateFromStr, dateToStr)) || [];
        }
        catch (e) {
            console.error("[admin] recognition-stats fixes", e?.message || e);
        }
        const manualByCustomer = {};
        for (const r of fixRows) {
            try {
                const raw = r.meta_json;
                const m = typeof raw === "string" && raw.trim() ? JSON.parse(raw) : typeof raw === "object" && raw ? raw : {};
                const cid = m.customer_id;
                if (cid)
                    manualByCustomer[cid] = (manualByCustomer[cid] || 0) + 1;
            }
            catch (_) { }
        }
        let hintRows = [];
        try {
            hintRows =
                (await db
                    .prepare(`SELECT customer_id AS cid, COUNT(*) AS hint_rows, COALESCE(SUM(hit_count), 0) AS hit_sum
         FROM customer_handwriting_hints
         GROUP BY customer_id`)
                    .all()) || [];
        }
        catch (e) {
            console.error("[admin] recognition-stats hints", e?.message || e);
        }
        const hintMap = Object.fromEntries((hintRows || []).map((h) => [h.cid, h]));
        let fsRows = [];
        try {
            fsRows =
                (await db
                    .prepare(`SELECT customer_id AS cid, COUNT(*) AS few_shot_n
         FROM customer_order_image_examples
         WHERE is_active = 1
         GROUP BY customer_id`)
                    .all()) || [];
        }
        catch (e) {
            console.error("[admin] recognition-stats few-shot", e?.message || e);
        }
        const fsMap = Object.fromEntries((fsRows || []).map((x) => [x.cid, x.few_shot_n]));
        let gemAgg = [];
        let gemTotals = null;
        try {
            gemAgg =
                (await db
                    .prepare(`SELECT call_kind,
         COUNT(*) AS n,
         AVG(latency_ms) AS avg_lat,
         SUM(COALESCE(prompt_tokens, 0)) AS prompt_sum,
         SUM(COALESCE(candidates_tokens, 0)) AS cand_sum,
         SUM(COALESCE(total_tokens, 0)) AS total_tok_sum
  FROM gemini_usage_log
  WHERE ${logDateClause}
  GROUP BY call_kind`)
                    .all(dateFromStr, dateToStr)) || [];
            gemTotals = await db
                .prepare(`SELECT COUNT(*) AS n,
         AVG(latency_ms) AS avg_lat,
         SUM(COALESCE(prompt_tokens, 0)) AS prompt_sum,
         SUM(COALESCE(candidates_tokens, 0)) AS cand_sum,
         SUM(COALESCE(total_tokens, 0)) AS total_tok_sum
  FROM gemini_usage_log
  WHERE ${logDateClause}`)
                .get(dateFromStr, dateToStr);
        }
        catch (e) {
            console.error("[admin] recognition-stats gemini", e?.message || e);
        }
        const custRows = (await db.prepare("SELECT id, name FROM customers ORDER BY name").all()) || [];
        const nameById = Object.fromEntries(custRows.map((c) => [c.id, c.name]));
        const cidSet = new Set();
        for (const r of itemStats)
            cidSet.add(r.cid);
        for (const cid of Object.keys(manualByCustomer))
            cidSet.add(cid);
        for (const h of hintRows || [])
            cidSet.add(h.cid);
        for (const x of fsRows || [])
            cidSet.add(x.cid);
        const pct = (a, b) => {
            const aa = Number(a) || 0;
            const bb = Number(b) || 0;
            if (bb <= 0)
                return "—";
            return ((100 * aa) / bb).toFixed(1) + "%";
        };
        const fmtNum = (x) => (x == null || Number.isNaN(Number(x)) ? "—" : Number(x).toLocaleString("zh-TW"));
        const fmtMs = (x) => (x == null || Number.isNaN(Number(x)) ? "—" : `${Math.round(Number(x))} ms`);
        const combined = [...cidSet]
            .map((cid) => {
            const st = itemStats.find((x) => x.cid === cid);
            const need = Number(st?.need_review_cnt) || 0;
            const tot = Number(st?.item_cnt) || 0;
            const man = manualByCustomer[cid] || 0;
            const hm = hintMap[cid];
            const hintRows = hm ? Number(hm.hint_rows) || 0 : 0;
            const hitSum = hm ? Number(hm.hit_sum) || 0 : 0;
            const fs = fsMap[cid] != null ? Number(fsMap[cid]) || 0 : 0;
            return {
                cid,
                name: nameById[cid] || cid,
                need,
                tot,
                needPct: pct(need, tot),
                man,
                manPct: pct(man, tot),
                hintRows,
                hitSum,
                fs,
            };
        })
            .sort((a, b) => {
            const ra = a.tot > 0 ? a.need / a.tot : 0;
            const rb = b.tot > 0 ? b.need / b.tot : 0;
            return rb - ra || b.tot - a.tot;
        });
        const gemRowsHtml = (gemAgg || [])
            .map((g) => {
            const k = escapeHtml(String(g.call_kind || ""));
            return `<tr><td><code>${k}</code></td><td style="text-align:right;">${fmtNum(g.n)}</td><td style="text-align:right;">${fmtMs(g.avg_lat)}</td><td style="text-align:right;">${fmtNum(g.prompt_sum)}</td><td style="text-align:right;">${fmtNum(g.cand_sum)}</td><td style="text-align:right;">${fmtNum(g.total_tok_sum)}</td></tr>`;
        })
            .join("");
        const rangeLabel = `${dateFromStr} ～ ${dateToStr}`;
        const fullRangeUrl = `/admin/recognition-stats?date_from=${encodeURIComponent(orderDateMin)}&date_to=${encodeURIComponent(orderDateMax)}`;
        const gemRowsHtmlSf = (gemAgg || []).map(g => `<tr>
          <td><code class="mono" style="font-size:12px;">${escapeHtml(String(g.call_kind || ""))}</code></td>
          <td class="mono" style="text-align:right;">${fmtNum(g.n)}</td>
          <td class="mono" style="text-align:right;">${fmtMs(g.avg_lat)}</td>
          <td class="mono" style="text-align:right;">${fmtNum(g.prompt_sum)}</td>
          <td class="mono" style="text-align:right;">${fmtNum(g.cand_sum)}</td>
          <td class="mono" style="text-align:right;">${fmtNum(g.total_tok_sum)}</td>
        </tr>`).join("");
        const custRowsHtmlSf = combined.map(r => `<tr>
          <td><a href="/admin/customers/${encodeURIComponent(r.cid)}/edit" style="color:var(--txt-1);font-weight:500;">${escapeHtml(r.name)}</a></td>
          <td class="mono" style="text-align:right;">${fmtNum(r.tot)}</td>
          <td class="mono" style="text-align:right;color:${(Number(r.need)/Math.max(1,Number(r.tot)))>0.2?"var(--warn)":"var(--txt-1)"};">${escapeHtml(r.needPct)} <span style="color:var(--txt-3);font-size:11px;">(${fmtNum(r.need)})</span></td>
          <td class="mono" style="text-align:right;">${fmtNum(r.man)}</td>
          <td class="mono" style="text-align:right;">${escapeHtml(r.manPct)}</td>
          <td class="mono" style="text-align:right;">${fmtNum(r.hintRows)}</td>
          <td class="mono" style="text-align:right;color:${r.hitSum>30?"var(--ok)":r.hitSum>10?"var(--warn)":"var(--txt-3)"};">${fmtNum(r.hitSum)}</td>
          <td class="mono" style="text-align:right;">${fmtNum(r.fs)}</td>
        </tr>`).join("");
        const kpiTotal = gemTotals ? Number(gemTotals.n) || 0 : 0;
        const kpiAvgLat = gemTotals ? gemTotals.avg_lat : null;
        const totalTokens = gemTotals ? Number(gemTotals.total_tok_sum) || 0 : 0;
        const statCard = (label, num, sub, status) => `
          <div style="padding:14px 16px;background:var(--bg-1);border:var(--hairline);border-radius:var(--radius-md);${status?`border-left:3px solid var(--${status});padding-left:14px;`:""}flex:1;min-width:160px;">
            <div style="font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${label}</div>
            <div class="mono" style="font-size:22px;font-weight:600;letter-spacing:-0.02em;">${num}</div>
            ${sub?`<div style="font-size:11px;color:var(--txt-3);margin-top:4px;">${sub}</div>`:""}
          </div>`;
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div>
            <div class="sf-breadcrumb" style="margin-bottom:6px;">報表與通訊 / 辨識成效儀表</div>
            <h1 style="margin:0;font-size:22px;font-weight:600;">辨識成效儀表</h1>
            <p style="margin-top:4px;color:var(--txt-3);font-size:12px;">統計區間：<strong style="color:var(--txt-1);">${escapeHtml(rangeLabel)}</strong>　訂單／待確認依 <code>order_date</code>；後台改品項依 <code>data_change_log</code> 紀錄日；Gemini 依 <code>gemini_usage_log</code>。筆跡對照／Few-Shot 為目前 DB 累積，不受區間限制。</p>
          </div>

          <form method="get" action="/admin/recognition-stats" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:14px 16px;background:var(--bg-1);border:var(--hairline);border-radius:var(--radius-md);">
            <div>
              <label class="sf-label" style="margin-bottom:4px;">起日</label>
              <input class="sf-input" type="date" name="date_from" value="${escapeAttr(dateFromStr)}" style="width:160px;">
            </div>
            <div>
              <label class="sf-label" style="margin-bottom:4px;">迄日</label>
              <input class="sf-input" type="date" name="date_to" value="${escapeAttr(dateToStr)}" style="width:160px;">
            </div>
            <button type="submit" class="sf-btn primary">${SF_ICONS.search}<span>套用</span></button>
            <span style="font-size:12px;color:var(--txt-3);align-self:center;margin-left:8px;">快捷</span>
            <a class="sf-btn sm" href="/admin/recognition-stats?days=30">近 30 日</a>
            <a class="sf-btn sm" href="/admin/recognition-stats?days=90">近 90 日</a>
            <a class="sf-btn sm" href="/admin/recognition-stats?days=365">近一年</a>
            <a class="sf-btn sm" href="${escapeAttr(fullRangeUrl)}">訂單全期</a>
          </form>

          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            ${statCard("Gemini 呼叫", fmtNum(kpiTotal), "區間內全站", "accent")}
            ${statCard("平均延遲", fmtMs(kpiAvgLat), "API 回應時間", "info")}
            ${statCard("Total Tokens", fmtNum(totalTokens), "輸入+輸出累計", "ok")}
            ${statCard("客戶數", combined.length+" 戶", "區間內有叫貨", "info")}
          </div>

          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.spark} Gemini 呼叫明細</div>
              <span class="sf-card-sub">${escapeHtml(rangeLabel)}</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th>類型</th>
                    <th style="text-align:right;">次數</th>
                    <th style="text-align:right;">平均延遲</th>
                    <th style="text-align:right;">Prompt tokens</th>
                    <th style="text-align:right;">輸出 tokens</th>
                    <th style="text-align:right;">Total tokens</th>
                  </tr>
                </thead>
                <tbody>${gemRowsHtmlSf || `<tr><td colspan='6' style='padding:24px;text-align:center;color:var(--txt-3);'>本區間無 Gemini 呼叫紀錄</td></tr>`}</tbody>
              </table>
            </div>
            <div style="padding:10px 16px;border-top:var(--hairline);font-size:11px;color:var(--txt-3);">
              類型：<code>text</code> 純文字叫貨 · <code>vision</code> 單圖視覺 · <code>vision_few_shot</code> 多輪 Few-Shot 視覺。
            </div>
          </div>

          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.users} 依客戶 — 辨識難度與學習資產</div>
              <span class="sf-card-sub">${combined.length} 戶 · 待確認比例高的排前面</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th>客戶</th>
                    <th style="text-align:right;">明細筆數</th>
                    <th style="text-align:right;">待確認比例</th>
                    <th style="text-align:right;">後台改次數</th>
                    <th style="text-align:right;">改/明細</th>
                    <th style="text-align:right;">筆跡列數</th>
                    <th style="text-align:right;">累積命中</th>
                    <th style="text-align:right;">Few-Shot</th>
                  </tr>
                </thead>
                <tbody>${custRowsHtmlSf || `<tr><td colspan='8' style='padding:24px;text-align:center;color:var(--txt-3);'>本區間無訂單明細</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </div>`;
        res.type("text/html").send(notionPage("辨識成效儀表", body, "recognition-stats", res));
    });
    router.get("/order-eval", requireManager, async (req, res) => {
        await gemini_prompt_resolve_js_1.ensureSeedPromptVersions(db);
        const quota = await gemini_eval_harness_js_1.getEvalQuotaToday(db);
        const visionRows = (await db.prepare("SELECT id, label, updated_at FROM prompt_versions WHERE slot = 'vision' ORDER BY updated_at DESC").all()) || [];
        const preview = await gemini_eval_harness_js_1.loadGoldenExampleRows(db, {
            maxExamples: 100,
            activeOnly: true,
        });
        const keyOk = Boolean((process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim());
        const errMsg = req.query.err === "quota"
            ? `<p class="notion-msg err">今日「全量評測」已達上限（每日最多 ${gemini_eval_harness_js_1.EVAL_FULL_RUN_DAILY_CAP} 次）。請明日再試，或聯絡負責人調整流程。</p>`
            : req.query.err === "confirm"
                ? `<p class="notion-msg err">請勾選確認後再執行。</p>`
                : "";
        const pvOpts = [`<option value="">（線上解析：目前生效之 vision 版本）</option>`].concat(visionRows.map((r) => `<option value="${escapeAttr(r.id)}">${escapeHtml(r.label || r.id)} — ${escapeHtml(String(r.updated_at || "—"))}</option>`));
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 訂單圖 Eval 評測</div>
        <h1 class="notion-page-title">訂單圖 Golden Set 評測（Eval Harness）</h1>
        ${errMsg}
        <p class="notion-hint" style="margin-top:0;">以 <code>customer_order_image_examples</code> 的 <code>parsed_json</code> 為標準答案，對同一批圖重跑 Gemini。調整 <code>SYSTEM_INSTRUCTION_ERP_ORDER_CLERK_CORE</code>（vision prompt）前後各跑一次，可比對<strong>精確度／召回率／數量誤差／單位一致率</strong>。評測時會<strong>排除當前題目圖</strong>作 Few-Shot，避免洩題。</p>
        <div class="notion-card">
          <p style="margin-top:0;"><strong>今日全量配額</strong>：已用 ${quota.used}／${gemini_eval_harness_js_1.EVAL_FULL_RUN_DAILY_CAP} 次 · 剩餘 ${quota.remaining} 次（每日曆日重置）。</p>
          <p class="notion-hint" style="margin-bottom:0;">防呆：避免腳本或誤操作在迴圈中連續呼叫全量評測；每次按下「重跑全部評測」會預扣配額。</p>
        </div>
        <div class="notion-card">
          <p style="margin-top:0;"><strong>目前 Golden 後選</strong>：最多 ${preview.length} 張有效（有明細、啟用中、依品質排序；實際張數受「最多評測張數」表單限制）。${!keyOk ? " <span style=\"color:#c92a2a;\">尚未設定 GOOGLE_GEMINI_API_KEY／GEMINI_API_KEY，無法呼叫 API。</span>" : ""}</p>
          <form method="post" action="/admin/order-eval/run" style="margin-top:12px;">
            <label style="display:block;margin:8px 0;">Vision Prompt 版本
              <select name="prompt_version_id" style="margin-top:4px;min-width:280px;">${pvOpts.join("")}</select>
            </label>
            <label style="display:block;margin:8px 0;">模型（留空＝環境變數預設）
              <select name="model_name" style="margin-top:4px;min-width:280px;">
                <option value="">（GEMINI_MODEL_VISION／GEMINI_MODEL）</option>
                <optgroup label="Gemini">
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                </optgroup>
                <optgroup label="Claude（需設定 ANTHROPIC_API_KEY）">
                  <option value="claude-sonnet-4-5">claude-sonnet-4-5（推薦）</option>
                  <option value="claude-opus-4-5">claude-opus-4-5（最強）</option>
                  <option value="claude-haiku-4-5">claude-haiku-4-5（最便宜）</option>
                </optgroup>
              </select>
            </label>
            <label style="display:block;margin:8px 0;">Few-Shot 策略
              <select name="few_shot_strategy" style="margin-top:4px;min-width:280px;">
                <option value="standard">standard（與線上單圖視覺相同 + 動態 Few-Shot）</option>
                <option value="none">none（無參考範例圖）</option>
                <option value="explicit">explicit（長前言，同 vision_few_shot 風格）</option>
              </select>
            </label>
            <label style="display:block;margin:8px 0;">Few-Shot 範例數（0–5；standard／explicit 有效）
              <input type="number" name="example_limit" value="2" min="0" max="5" style="margin-top:4px;width:100px;">
            </label>
            <label style="display:block;margin:8px 0;">最多評測張數（1–100）
              <input type="number" name="max_examples" value="80" min="1" max="100" style="margin-top:4px;width:100px;">
            </label>
            <label style="display:block;margin:8px 0;"><input type="checkbox" name="active_only" value="1" checked> 僅啟用中的範例（<code>is_active=1</code>）</label>
            <label style="display:block;margin:12px 0;"><input type="checkbox" name="confirm" value="1" required> 我了解將對 Golden Set 逐張呼叫 Gemini（可能產生費用與較長等待），並同意預扣今日全量配額一次。</label>
            <p><button type="submit" class="btn btn-primary" ${!keyOk ? "disabled" : ""}>重跑全部評測</button></p>
          </form>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">指標說明</h2>
          <ul style="margin:0;padding-left:1.2em;line-height:1.65;">
            <li><strong>精確度（micro）</strong>：ΣTP／(ΣTP+ΣFP)，預測列中多少對應到標準品項列。</li>
            <li><strong>召回率（micro）</strong>：ΣTP／(ΣTP+ΣFN)，標準品項列有多少被預測到（品名規格化後相同算命中）。</li>
            <li><strong>數量誤差</strong>：命中列之平均 |預測量−標準量|／標準量（標準量為 0 時改絕對差）。</li>
            <li><strong>單位一致率</strong>：命中列中單位字串（去空白）一致的比例。</li>
          </ul>
          <p class="notion-hint" style="margin-bottom:0;">品名比對規則：去空白、小寫、連續空白折疊後完全相同才算同一品項（與潦草異體字仍可能漏配對）。</p>
        </div>
      `;
        res.type("text/html").send(notionPage("訂單圖 Eval 評測", body, "order-eval", res));
    });
    router.post("/order-eval/run", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        if (req.body.confirm !== "1") {
            res.redirect(302, "/admin/order-eval?err=confirm");
            return;
        }
        const reserve = await gemini_eval_harness_js_1.reserveFullEvalSlot(db);
        if (!reserve.ok) {
            res.redirect(302, "/admin/order-eval?err=quota");
            return;
        }
        const promptVersionId = String(req.body.prompt_version_id || "").trim();
        const modelName = String(req.body.model_name || "").trim();
        const fewShotStrategy = String(req.body.few_shot_strategy || "standard").trim();
        const exampleLimit = Math.min(5, Math.max(0, parseInt(String(req.body.example_limit || "2"), 10) || 2));
        const maxExamples = Math.min(100, Math.max(1, parseInt(String(req.body.max_examples || "80"), 10) || 80));
        const activeOnly = req.body.active_only === "1";
        let result;
        try {
            result = await gemini_eval_harness_js_1.runVisionGoldenEval(db, {
                promptVersionId: promptVersionId || undefined,
                modelName: modelName || undefined,
                fewShotStrategy,
                exampleLimit,
                maxExamples,
                activeOnly,
            });
        }
        catch (e) {
            console.error("[admin] order-eval run", e?.message || e, e?.stack);
            const bodyErr = `
            <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/order-eval">Eval</a></div>
            <h1 class="notion-page-title">評測失敗</h1>
            <p class="notion-msg err">${escapeHtml(String(e?.message || e).slice(0, 800))}</p>
            <p><a href="/admin/order-eval" class="btn">返回</a></p>`;
            res.type("text/html").send(notionPage("Eval 失敗", bodyErr, "order-eval", res));
            return;
        }
        const fmtPct = (x) => x == null || Number.isNaN(Number(x)) ? "—" : `${(100 * Number(x)).toFixed(2)}%`;
        const fmtFloat = (x) => x == null || Number.isNaN(Number(x)) ? "—" : Number(x).toFixed(4);
        const rowSlice = result.perImage.slice(0, 80);
        const perRows = rowSlice
            .map((r) => `<tr><td><code style="font-size:11px;">${escapeHtml(r.exampleId)}</code></td><td><code>${escapeHtml(r.customerId)}</code></td><td style="text-align:right;">${r.goldLines}</td><td style="text-align:right;">${r.predLines}</td><td style="text-align:right;">${fmtPct(r.precision)}</td><td style="text-align:right;">${fmtPct(r.recall)}</td><td style="text-align:right;">${fmtFloat(r.avgQtyRelErr)}</td><td style="text-align:right;">${fmtPct(r.unitMatchRate)}</td><td>${r.readErr ? escapeHtml(r.readErr) : "—"}</td></tr>`)
            .join("");
        const moreHint = result.perImage.length > rowSlice.length
            ? `<p class="notion-hint">僅顯示前 ${rowSlice.length} 筆，共 ${result.perImage.length} 筆。</p>`
            : "";
        const quotaAfter = await gemini_eval_harness_js_1.getEvalQuotaToday(db);
        const bodyResult = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/order-eval">Eval</a></div>
        <h1 class="notion-page-title">評測結果</h1>
        <div class="notion-card">
          <p style="margin-top:0;"><strong>設定</strong>：Prompt 版本 <code>${escapeHtml(result.promptVersionId || "—")}</code> · 模型 ${escapeHtml(result.modelLabel)} · Few-Shot ${escapeHtml(result.fewShotStrategy)} · 範例數 ${result.exampleLimit} · 實際評測 ${result.goldenCount} 張</p>
          <p><strong>Micro 精確度</strong>：${fmtPct(result.microPrecision)}　<strong>Micro 召回率</strong>：${fmtPct(result.microRecall)}　<strong>平均數量相對誤差</strong>：${fmtFloat(result.microAvgQtyRelErr)}　<strong>單位一致率</strong>：${fmtPct(result.microUnitMatchRate)}</p>
          <p class="notion-hint" style="margin-bottom:0;">ΣTP=${result.sumTp} ΣFP=${result.sumFp} ΣFN=${result.sumFn} · API／讀圖失敗列≈${result.apiErrors} · 今日剩餘全量次數：${quotaAfter.remaining}</p>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">逐圖摘要</h2>
          ${moreHint}
          <div style="overflow:auto;max-height:480px;">
          <table class="notion-table-like" style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr>
              <th style="text-align:left;padding:6px;border-bottom:1px solid var(--notion-border);">範例 id</th>
              <th style="text-align:left;padding:6px;border-bottom:1px solid var(--notion-border);">客戶</th>
              <th style="text-align:right;padding:6px;border-bottom:1px solid var(--notion-border);">標準列數</th>
              <th style="text-align:right;padding:6px;border-bottom:1px solid var(--notion-border);">預測列數</th>
              <th style="text-align:right;padding:6px;border-bottom:1px solid var(--notion-border);">精確度</th>
              <th style="text-align:right;padding:6px;border-bottom:1px solid var(--notion-border);">召回率</th>
              <th style="text-align:right;padding:6px;border-bottom:1px solid var(--notion-border);">數量誤差</th>
              <th style="text-align:right;padding:6px;border-bottom:1px solid var(--notion-border);">單位一致</th>
              <th style="text-align:left;padding:6px;border-bottom:1px solid var(--notion-border);">錯誤</th>
            </tr></thead>
            <tbody>${perRows || "<tr><td colspan=\"9\" class=\"notion-hint\">無資料</td></tr>"}</tbody>
          </table>
          </div>
          <p style="margin-top:16px;"><a href="/admin/order-eval" class="btn btn-primary">再跑一次</a> <a href="/admin/gemini-prompts" class="btn">編輯 Prompt</a></p>
        </div>
      `;
        res.type("text/html").send(notionPage("Eval 結果", bodyResult, "order-eval", res));
    });
    router.get("/rhythm", async (req, res) => {
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        const dateRaw = typeof req.query.date === "string" ? req.query.date.trim() : "";
        const signalDate = dateRe.test(dateRaw) ? dateRaw : rhythm_analysis_js_1.taipeiTodayIso();
        let rows = [];
        try {
            rows =
                (await db
                    .prepare(`SELECT r.signal_type, r.meta_json, r.customer_id, r.product_id,
               c.name AS customer_name, p.name AS product_name
        FROM rhythm_daily_signals r
        LEFT JOIN customers c ON c.id = r.customer_id
        LEFT JOIN products p ON p.id = r.product_id
        WHERE r.signal_date = ?
        ORDER BY r.signal_type, c.name, p.name`)
                    .all(signalDate)) || [];
        }
        catch (e) {
            console.error("[admin] rhythm list", e?.message || e);
        }
        let forecast = null;
        try {
            forecast = await rhythm_analysis_js_1.forecastTomorrowCompanyOrders(db);
        }
        catch (_) {
            forecast = null;
        }
        let lastJobAt = "";
        try {
            const jr = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("rhythm_last_job_at");
            lastJobAt = jr?.value ? String(jr.value) : "";
        }
        catch (_) { /* ignore */ }
        const typeLabel = (t) => t === "churn_risk"
            ? "流失風險"
            : t === "expected_missing"
                ? "預期應叫（尚未叫）"
                : escapeHtml(String(t || ""));
        const tbody = rows.length
            ? rows
                .map((r) => {
                let meta = {};
                try {
                    meta = r.meta_json ? JSON.parse(String(r.meta_json)) : {};
                }
                catch {
                    meta = {};
                }
                const bits = [
                    meta.avg_cycle_days != null ? `平均間隔 ${meta.avg_cycle_days} 天` : "",
                    meta.days_since_last != null ? `距上次 ${meta.days_since_last} 天` : "",
                    meta.last_order_date ? `最後叫貨日 ${meta.last_order_date}` : "",
                    meta.weekday_distribution ? String(meta.weekday_distribution).slice(0, 120) : "",
                ].filter(Boolean);
                const metaCell = escapeHtml(bits.join(" · "));
                return `<tr><td>${typeLabel(r.signal_type)}</td><td><a href="/admin/customers/${encodeURIComponent(r.customer_id)}/edit">${escapeHtml(r.customer_name || r.customer_id)}</a></td><td>${escapeHtml(r.product_name || r.product_id)}</td><td style="font-size:13px;">${escapeHtml(meta.reason || "")}</td><td style="font-size:12px;color:var(--notion-text-muted);line-height:1.45;">${metaCell}</td></tr>`;
            })
                .join("")
            : "<tr><td colspan=\"5\" class=\"notion-hint\">尚無紀錄。請執行每日排程或由經理按「立即重算」。</td></tr>";
        const fcHtml = forecast?.avgOrders != null
            ? `<p style="margin:0 0 8px;"><strong>明日（${escapeHtml(forecast.weekdayLabel || "")} ${escapeHtml(forecast.tomorrow || "")}）</strong>粗估訂單量：歷史同日平均約 <strong>${escapeHtml(String(forecast.avgOrders))}</strong> 張（樣本 ${forecast.sampleDays} 個曆日，僅供備貨參考）。</p>`
            : "<p class=\"notion-hint\" style=\"margin:0 0 8px;\">明日訂單量粗估：資料不足。</p>";
        const flash = req.query.ok === "1"
            ? "<p class=\"notion-msg ok\">已重算並寫入今日訊號。</p>"
            : req.query.err === "1"
                ? "<p class=\"notion-msg err\">重算失敗，請見伺服器日誌。</p>"
                : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 週期與預期清單</div>
        <h1 class="notion-page-title">客戶×品項週期分析（零 AI 成本）</h1>
        ${flash}
        <p class="notion-hint" style="margin-top:0;">以最近 90 天訂單明細統計：平均叫貨間隔、星期分佈、數量均值／標準差（見最右欄摘要）。每日排程將符合「今日常叫星期 + 已超過平均週期 + 今日尚未叫該品項」者列入<strong>預期應叫</strong>；並另列<strong>流失風險</strong>（過往頻繁卻長時間未叫）。排程請設 <code>POST /api/jobs/rhythm-daily</code>（標頭 <code>X-Rhythm-Job-Secret</code>，與環境變數 <code>RHYTHM_JOB_SECRET</code> 或 <code>LINE_WORKER_SECRET</code> 相同時驗證）。</p>
        <div class="notion-card">
          ${fcHtml}
          <form method="get" action="/admin/rhythm" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px;">
            <label style="margin:0;">日期 <input type="date" name="date" value="${escapeAttr(signalDate)}"></label>
            <button type="submit" class="btn">檢視</button>
          </form>
          <p class="notion-hint" style="margin:0 0 12px;">上次排程完成時間：${lastJobAt ? escapeHtml(lastJobAt) : "—"}（見 <code>app_settings.rhythm_last_job_at</code>）</p>
          <form method="post" action="/admin/rhythm/run" style="margin-bottom:12px;">
            <button type="submit" class="btn btn-primary">立即重算今日清單</button>
            <span class="notion-hint" style="margin-left:8px;">（僅經理）</span>
          </form>
          <table class="notion-table-like" style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--notion-border);">類型</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--notion-border);">客戶</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--notion-border);">品項</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--notion-border);">說明</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--notion-border);">統計摘要（meta）</th>
            </tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("週期與預期清單", body, "rhythm", res));
    });
    router.post("/rhythm/run", express_1.default.urlencoded({ extended: true }), requireManager, async (_req, res) => {
        try {
            await rhythm_analysis_js_1.runRhythmDailyJob(db);
            res.redirect(302, "/admin/rhythm?ok=1");
        }
        catch (e) {
            console.error("[admin] rhythm run", e?.message || e);
            res.redirect(302, "/admin/rhythm?err=1");
        }
    });
}
