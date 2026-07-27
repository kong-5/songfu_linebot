"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCalendarRoutes = registerCalendarRoutes;

// 行事曆域（國定假日/公司公休/加班/自訂事件：月曆頁、新增刪除、CSV 匯出、匯入國定假日）路由：
// 自 index.js 拆出（拆檔批次 6），純搬移、行為不變。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const calendar_holidays_js_1 = require("../lib/calendar-holidays.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerCalendarRoutes(router, ctx) {
    const { db, notionPage, logDataChange, nowSqlExpr, getTaipeiCalendarDateYYYYMMDD } = ctx;
    // ============================================================
    // 行事曆：國定假日、公司公休、加班、自訂事件
    // ============================================================
    router.get("/calendar", async (req, res) => {
        const today = getTaipeiCalendarDateYYYYMMDD();
        const yParam = parseInt(String(req.query.y || ""), 10);
        const mParam = parseInt(String(req.query.m || ""), 10);
        const year = Number.isFinite(yParam) && yParam >= 2020 && yParam <= 2100 ? yParam : Number(today.slice(0, 4));
        const month = Number.isFinite(mParam) && mParam >= 1 && mParam <= 12 ? mParam : Number(today.slice(5, 7));
        const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
        const nextM = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const events = await db.prepare("SELECT id, date, kind, label, note FROM company_calendar WHERE date >= ? AND date < ? ORDER BY date ASC").all(monthStart, nextM);
        const eventsByDate = {};
        for (const e of events) {
            if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
            eventsByDate[e.date].push(e);
        }
        const grid = calendar_holidays_js_1.buildMonthGrid(year, month, eventsByDate);
        const prevY = month === 1 ? year - 1 : year;
        const prevM = month === 1 ? 12 : month - 1;
        const nextY = month === 12 ? year + 1 : year;
        const nextMM = month === 12 ? 1 : month + 1;
        const okMsg = req.query.ok === "imported" ? `已匯入 ${req.query.n || "?"} 筆 ${req.query.y || ""} 年國定假日` : (req.query.ok === "added" ? "已新增" : (req.query.ok === "deleted" ? "已刪除" : ""));

        const kindColor = (k) => {
            if (k === "national_holiday") return "background:#fee2e2;color:#b91c1c;";
            if (k === "company_off") return "background:#fed7aa;color:#9a3412;";
            if (k === "company_on") return "background:#bbf7d0;color:#166534;";
            return "background:#dbeafe;color:#1e40af;";
        };
        const kindLabel = (k) => k === "national_holiday" ? "國定假日" : k === "company_off" ? "公司公休" : k === "company_on" ? "公司加班" : "事件";

        const cellsHtml = grid.map((row) =>
            `<tr>${row.map((c) => {
                if (c.filler) return `<td class="cal-cell cal-filler"></td>`;
                const isToday = c.iso === today;
                const isWeekend = c.dow === 5 || c.dow === 6;
                const evs = c.events || [];
                const hasHoliday = evs.some((e) => e.kind === "national_holiday" || e.kind === "company_off");
                const evHtml = evs.map((e) => `<div class="cal-event" style="${kindColor(e.kind)}" title="${escapeAttr(e.note || e.label)}">
<span>${escapeHtml(e.label)}</span>
<a href="javascript:void(0)" class="cal-event-del" onclick="if(confirm('刪除此事件？'))document.getElementById('del-${e.id}').submit()">×</a>
<form id="del-${e.id}" method="post" action="/admin/calendar/${encodeURIComponent(e.id)}/delete?back=${encodeURIComponent(`/admin/calendar?y=${year}&m=${month}`)}" style="display:none;"></form>
</div>`).join("");
                const quickAnnLink = hasHoliday
                    ? `<a href="/admin/announcements/new?template=holiday_red&from_calendar=${encodeURIComponent(c.iso)}" class="cal-make-ann" title="一鍵建立節日休假公告">${sfInlineIcon("megaphone")} 公告</a>`
                    : "";
                return `<td class="cal-cell${isToday ? " cal-today" : ""}${isWeekend ? " cal-weekend" : ""}">
<div class="cal-day">${c.day}</div>
${evHtml}
${quickAnnLink}
<a href="javascript:void(0)" onclick="openCalEventModal('${c.iso}')" class="cal-add" title="新增事件">＋</a>
</td>`;
            }).join("")}</tr>`).join("");

        const body = `<style>
.cal-table { width:100%; border-collapse:collapse; background:var(--notion-card); border:1px solid var(--notion-border); border-radius:8px; overflow:hidden; }
.cal-table th { padding:8px; font-size:12px; font-weight:500; color:var(--notion-text-muted); background:var(--notion-sidebar); border-bottom:1px solid var(--notion-border); }
.cal-cell { vertical-align:top; padding:6px 6px 28px; height:96px; width:14.28%; border:1px solid var(--notion-border); position:relative; }
.cal-cell.cal-filler { background:var(--notion-canvas); }
.cal-cell.cal-today { background:rgba(35,131,226,0.12); }
.cal-cell.cal-weekend .cal-day { color:#c0392b; }
.cal-day { font-size:14px; font-weight:600; color:var(--notion-text); margin-bottom:4px; }
.cal-event { display:flex; align-items:center; gap:4px; font-size:11px; padding:2px 6px; border-radius:4px; margin-bottom:3px; line-height:1.4; }
.cal-event > span { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cal-event-del { color:inherit; opacity:0.5; text-decoration:none; padding:0 2px; cursor:pointer; }
.cal-event-del:hover { opacity:1; }
.cal-add { position:absolute; right:4px; bottom:4px; font-size:11px; color:#bbb; padding:2px 6px; text-decoration:none; opacity:0; transition:opacity .15s; }
.cal-cell:hover .cal-add { opacity:1; }
.cal-add:hover { background:#f0f0f0; color:#3b82c4; }
.cal-make-ann { position:absolute; left:4px; bottom:4px; font-size:11px; padding:2px 6px; background:#fef3c7; color:#92400e; border-radius:4px; text-decoration:none; }
.cal-make-ann:hover { background:#fde68a; text-decoration:none; }
.cal-toolbar { display:flex; align-items:center; gap:14px; margin-bottom:14px; flex-wrap:wrap; }
.cal-month-title { font-size:22px; font-weight:700; }
.cal-legend { display:flex; gap:10px; font-size:12px; color:#666; flex-wrap:wrap; }
.cal-legend span { padding:2px 8px; border-radius:10px; }
.cal-modal-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.4); z-index:1000; align-items:center; justify-content:center; padding:20px; }
.cal-modal-overlay.is-open { display:flex; }
.cal-modal { background:var(--notion-card); border-radius:10px; padding:24px; max-width:440px; width:100%; box-shadow:0 8px 32px rgba(0,0,0,0.2); }
.cal-modal h2 { margin:0 0 6px; font-size:18px; }
.cal-modal .cal-modal-date { color:var(--notion-text-muted); font-size:13px; margin-bottom:14px; }
.cal-modal label { display:block; font-size:13px; color:var(--notion-text-muted); margin:10px 0 4px; }
.cal-modal input, .cal-modal select { width:100%; padding:8px 10px; border:1px solid var(--notion-border-strong); border-radius:6px; font-size:14px; box-sizing:border-box; background:var(--notion-canvas); color:var(--notion-text); font-family:inherit; }
.cal-modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:18px; }
</style>
<div class="notion-page-content">
<h1 class="notion-h1" style="margin:0 0 8px;">行事曆</h1>
<p style="color:#888;font-size:13px;">國定假日／公司公休／加班／事件。公告模板的日期選擇器會讀此資料來源。</p>
${okMsg ? `<p style="background:#ecfdf5;color:#047857;padding:8px 12px;border-radius:6px;border:1px solid #a7f3d0;font-size:13px;">✓ ${escapeHtml(okMsg)}</p>` : ""}
<div class="cal-toolbar">
  <a href="/admin/calendar?y=${prevY}&m=${prevM}" class="btn">← 上月</a>
  <div class="cal-month-title">${year} 年 ${month} 月</div>
  <a href="/admin/calendar?y=${nextY}&m=${nextMM}" class="btn">下月 →</a>
  <a href="/admin/calendar" class="btn">本月</a>
  <form method="post" action="/admin/calendar/import-holidays" style="display:inline;" onsubmit="return confirm('匯入 ${year} 年國定假日？已存在的不會重複加入');">
    <input type="hidden" name="year" value="${year}">
    <button type="submit" class="btn">匯入 ${year} 年國定假日</button>
  </form>
  <a href="/admin/calendar/export.csv?year=${year}" class="btn">下載 ${year} 年 CSV</a>
  <div class="cal-legend">
    <span style="background:#fee2e2;color:#b91c1c;">國定假日</span>
    <span style="background:#fed7aa;color:#9a3412;">公司公休</span>
    <span style="background:#bbf7d0;color:#166534;">公司加班</span>
    <span style="background:#dbeafe;color:#1e40af;">事件</span>
    <span class="info-pop" tabindex="0" data-tip="• 國定假日：政府公告假日（一鍵匯入內建表）&#10;• 公司公休：公司自訂休息日（戰情室不算未叫貨異常）&#10;• 公司加班：原本休假但公司決定上班的日子&#10;• 事件：自訂提醒（盤點、會議等）&#10;&#10;公告模板選日期時會自動讀此資料源，假日列出在週曆中。">i</span>
  </div>
</div>
<table class="cal-table">
  <thead><tr><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th><th>日</th></tr></thead>
  <tbody>${cellsHtml}</tbody>
</table>
<div id="calEventModal" class="cal-modal-overlay" role="dialog" aria-modal="true">
  <div class="cal-modal">
    <h2>新增事件</h2>
    <div class="cal-modal-date" id="calModalDateLabel">—</div>
    <form method="post" action="/admin/calendar" id="calEventForm">
      <input type="hidden" name="date" id="calModalDate">
      <input type="hidden" name="back" value="/admin/calendar?y=${year}&m=${month}">
      <label for="calModalLabel">事件標題 *</label>
      <input type="text" id="calModalLabel" name="label" placeholder="例：勞動節休假" required autofocus>
      <label for="calModalKind">類型</label>
      <select id="calModalKind" name="kind">
        <option value="company_off">公司公休</option>
        <option value="company_on">公司加班</option>
        <option value="event" selected>事件 / 提醒</option>
        <option value="national_holiday">國定假日</option>
      </select>
      <label for="calModalNote">備註（選填）</label>
      <input type="text" id="calModalNote" name="note" placeholder="例：客戶端提前告知">
      <div class="cal-modal-actions">
        <button type="button" class="btn" onclick="closeCalEventModal()">取消</button>
        <button type="submit" class="btn btn-primary">新增</button>
      </div>
    </form>
  </div>
</div>
<script>
function openCalEventModal(iso){
  document.getElementById('calModalDate').value=iso;
  document.getElementById('calModalDateLabel').textContent=iso;
  document.getElementById('calModalLabel').value='';
  document.getElementById('calModalKind').value='event';
  document.getElementById('calModalNote').value='';
  document.getElementById('calEventModal').classList.add('is-open');
  setTimeout(()=>document.getElementById('calModalLabel').focus(),50);
}
function closeCalEventModal(){
  document.getElementById('calEventModal').classList.remove('is-open');
}
document.getElementById('calEventModal').addEventListener('click',function(e){
  if(e.target===this) closeCalEventModal();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape') closeCalEventModal();
});
</script>
</div>`;
        res.type("text/html").send(notionPage("行事曆", body, "calendar", res));
    });

    router.post("/calendar", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const date = String(req.body.date || "").trim();
        const kind = String(req.body.kind || "event").trim();
        const label = String(req.body.label || "").trim();
        const note = String(req.body.note || "").trim() || null;
        const back = String(req.body.back || "/admin/calendar").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label) { res.redirect(back); return; }
        const id = (0, id_js_1.newId)("cal");
        await db.prepare(`INSERT INTO company_calendar (id, date, kind, label, note, created_at) VALUES (?, ?, ?, ?, ?, ${nowSqlExpr()})`).run(id, date, kind, label, note);
        res.redirect(back + (back.includes("?") ? "&" : "?") + "ok=added");
    });

    router.post("/calendar/:id/delete", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const back = String(req.body.back || req.query.back || "/admin/calendar").trim();
        await db.prepare("DELETE FROM company_calendar WHERE id = ?").run(req.params.id);
        res.redirect(back + (back.includes("?") ? "&" : "?") + "ok=deleted");
    });

    router.get("/calendar/export.csv", async (req, res) => {
        const yearParam = parseInt(String(req.query.year || ""), 10);
        let rows;
        if (Number.isFinite(yearParam) && yearParam >= 2020 && yearParam <= 2100) {
            const start = `${yearParam}-01-01`;
            const end = `${yearParam}-12-31`;
            rows = await db.prepare("SELECT date, kind, label, note FROM company_calendar WHERE date >= ? AND date <= ? ORDER BY date").all(start, end);
        } else {
            rows = await db.prepare("SELECT date, kind, label, note FROM company_calendar ORDER BY date").all();
        }
        const kindLabel = (k) => k === "national_holiday" ? "國定假日" : k === "company_off" ? "公司公休" : k === "company_on" ? "公司加班" : "事件";
        const csvLines = ["日期,類型,標題,備註"];
        for (const r of (rows || [])) {
            const cells = [r.date, kindLabel(r.kind), r.label || "", r.note || ""].map((v) => {
                const s = String(v ?? "");
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            });
            csvLines.push(cells.join(","));
        }
        const filename = `calendar_${yearParam || "all"}.csv`;
        res.set("Content-Type", "text/csv; charset=utf-8");
        res.set("Content-Disposition", `attachment; filename="${filename}"`);
        // 加上 UTF-8 BOM 讓 Excel 開啟中文正常
        res.send("﻿" + csvLines.join("\n"));
    });

    router.post("/calendar/import-holidays", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const year = parseInt(String(req.body.year || ""), 10);
        if (!Number.isFinite(year)) { res.redirect("/admin/calendar"); return; }
        const list = calendar_holidays_js_1.getHolidaysForYear(year);
        let added = 0;
        for (const h of list) {
            const exists = await db.prepare("SELECT id FROM company_calendar WHERE date = ? AND kind = ? AND label = ?").get(h.date, "national_holiday", h.label);
            if (exists) continue;
            const id = (0, id_js_1.newId)("cal");
            await db.prepare(`INSERT INTO company_calendar (id, date, kind, label, note, created_at) VALUES (?, ?, 'national_holiday', ?, NULL, ${nowSqlExpr()})`).run(id, h.date, h.label);
            added++;
        }
        res.redirect(`/admin/calendar?y=${year}&m=1&ok=imported&n=${added}&y=${year}`);
    });

    // ===================================================================
}
