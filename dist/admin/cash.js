"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCashRoutes = registerCashRoutes;

// 收款域（銷貨統計／現金收款／收款客戶主檔／現金日報表）路由：自 index.js 拆出（拆檔批次 2），純搬移、行為不變。

const express_1 = { default: require("express") };
const XLSX = require("xlsx");
const id_js_1 = require("../lib/id.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const { SF_ICONS, escapeHtml, escapeAttr } = require("./_shared.js");

function registerCashRoutes(router, ctx) {
    const { db, notionPage, logDataChange, getTaipeiCalendarDateYYYYMMDD } = ctx;
    // 收款作業權限：經理天生有；其他人需在人員管理勾「收款權限」
    function requireCash(req, res, next) {
        const p = req.adminProfile;
        if (p && (p.title === "經理" || p.canCash === true)) {
            next();
            return;
        }
        const wantsJson = req.method === "POST" || (req.headers.accept || "").includes("application/json");
        if (wantsJson) {
            res.status(403).json({ error: "無收款作業權限（請聯絡經理開通）" });
            return;
        }
        res.status(403).type("text/html").send("<!DOCTYPE html><html lang=\"zh-TW\"><head><meta charset=\"utf-8\"><title>權限不足</title></head><body style=\"font-family:sans-serif;padding:24px;\"><p><strong>收款作業</strong>僅限有權限的人員使用，請聯絡經理開通。</p><p><a href=\"/admin\">返回儀表板</a></p></body></html>");
    }
    // 使用者在網站按「重新取單」→ 記一個待處理旗標；內網代理長連線（cash-refresh-wait）領走後重撈凌越該日 → cash-ingest。
    // 用途：客戶改單後，網站數量會跟一早抓的不符，按這顆就能即時反映凌越當下狀態（不必去內網手動跑腳本）。
    router.post("/cash/request-refresh", requireCash, express_1.default.json({ limit: "8kb" }), async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.body?.icpno, "00");
            const date = cashValidDate(req.body?.date) || getTaipeiCalendarDateYYYYMMDD();
            const at = new Date().toISOString();
            const payload = JSON.stringify({ icpno, date, at });
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_requested", payload);
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_status", "queued");
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_error", "");
            res.json({ ok: true, icpno, date, requested_at: at });
        }
        catch (e) {
            console.error("[admin] /cash/request-refresh", e?.message || e);
            res.status(500).json({ error: "送出失敗", detail: String(e?.message || e) });
        }
    });
    // 前端輪詢：這顆回目前刷新狀態＋該 icpno/date 最新一次 cash-ingest 的時間戳（用來判斷資料是否已更新→自動重整）
    router.get("/cash/refresh-status", requireCash, async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.query.icpno, "00");
            const date = cashValidDate(req.query.date) || getTaipeiCalendarDateYYYYMMDD();
            const get = async (k) => { const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k); return r && r.value ? String(r.value) : ""; };
            const status = await get("cash_refresh_status");
            const error = await get("cash_refresh_error");
            const ingestedAt = await get("cash_sales_ingested_at_" + icpno + "_" + date);
            const lastWaitAt = await get("ly_agent_last_cash_wait_at");
            res.json({ ok: true, status, error, ingested_at: ingestedAt, agent_last_wait_at: lastWaitAt });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    // 讀當日銷貨單快照 + 分組加總（頁面/匯出/列印共用）
    // 解析銷貨單號 → {series:'num'|'A', prefix:YYYYMMDD, width, seq}；不符格式回 null
    function parseCashSeq(spNo) {
        const s = String(spNo || "").trim().toUpperCase();
        const m = s.match(/^(A?)(\d{8})(\d+)$/);
        if (!m)
            return null;
        return { series: m[1] === "A" ? "A" : "num", prefix: m[2], width: m[3].length, seq: parseInt(m[3], 10) };
    }
    async function loadCashDaily(icpno, date) {
        const rows = await db.prepare("SELECT sp_no, doc_date, ct_no, ct_name, fkfs, total, unpaid, paid, kind FROM cash_sales_doc WHERE icpno = ? AND doc_date = ? ORDER BY sp_no ASC").all(icpno, date) || [];
        const numRows = rows.filter((r) => r.kind !== "A");
        const aRows = rows.filter((r) => r.kind === "A");
        const sum = (arr, f) => arr.reduce((s, r) => s + Number(r[f] || 0), 0);
        const meta = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("cash_sales_ingested_at_" + icpno + "_" + date);
        // 流水號斷號檢查：同 series+prefix，找 min..max 間缺的號（可能是作廢/刪單，須填原因）
        const groups = new Map();
        for (const r of rows) {
            const p = parseCashSeq(r.sp_no);
            if (!p)
                continue;
            const key = p.series + "|" + p.prefix;
            if (!groups.has(key))
                groups.set(key, { series: p.series, prefix: p.prefix, width: p.width, seqs: new Set(), min: p.seq, max: p.seq });
            const g = groups.get(key);
            g.seqs.add(p.seq);
            if (p.width > g.width)
                g.width = p.width;
            if (p.seq < g.min)
                g.min = p.seq;
            if (p.seq > g.max)
                g.max = p.seq;
        }
        const reasonRows = await db.prepare("SELECT series, seq, reason FROM cash_seq_gap_reason WHERE icpno = ? AND doc_date = ?").all(icpno, date) || [];
        const reasonMap = new Map(reasonRows.map((x) => [x.series + "|" + x.seq, x.reason || ""]));
        const gaps = [];
        const seriesInfo = {};
        for (const g of groups.values()) {
            seriesInfo[g.series] = { min: g.min, max: g.max, count: g.seqs.size, width: g.width, prefix: g.prefix };
            for (let i = g.min; i <= g.max; i++) {
                if (g.seqs.has(i))
                    continue;
                const spNo = (g.series === "A" ? "A" : "") + g.prefix + String(i).padStart(g.width, "0");
                gaps.push({ series: g.series, seq: i, spNo, reason: reasonMap.get(g.series + "|" + i) || "" });
            }
        }
        gaps.sort((a, b) => a.series === b.series ? a.seq - b.seq : (a.series < b.series ? 1 : -1)); // num 在前、A 在後
        const gapsMissingReason = gaps.filter((x) => !String(x.reason).trim()).length;
        return {
            rows, numRows, aRows,
            numTotal: sum(numRows, "total"), aTotal: sum(aRows, "total"),
            grandTotal: sum(rows, "total"), unpaidTotal: sum(rows, "unpaid"),
            ingestedAt: meta?.value || "",
            gaps, gapsMissingReason, seriesInfo,
        };
    }
    const CASH_COMPANIES = erp_companies_js_1.ERP_COMPANY_NAMES || { "00": "松富", "01": "龍港", "02": "松揚", "03": "松成" };
    const CASH_METHOD_LABEL = { cash: "現金", transfer: "匯款", check: "票" };
    const cashMethodLabel = (m) => CASH_METHOD_LABEL[String(m || "cash").trim()] || "現金";
    function cashMoney(n) { return Number(n || 0).toLocaleString("en-US"); }
    // 「重新取單」按鈕的前端邏輯（銷貨統計/收款頁共用）：送出請求→輪詢 refresh-status→資料更新後自動重整。
    // btnId 可選（預設 cashRefreshBtn）；msgId 預設 cashRefreshMsg。
    function cashRefreshScript(icpno, date, initialIngestedAt, btnId, msgId) {
        const BTN = btnId || "cashRefreshBtn", MSG = msgId || "cashRefreshMsg";
        return `(function(){
      var btn=document.getElementById(${JSON.stringify(BTN)}); if(!btn) return;
      var msg=document.getElementById(${JSON.stringify(MSG)});
      var ICPNO=${JSON.stringify(icpno)}, DATE=${JSON.stringify(date)}, INIT=${JSON.stringify(String(initialIngestedAt || ""))};
      function show(t,c){ if(msg){ msg.style.display='block'; msg.textContent=t; msg.style.color=c||'#787774'; } }
      btn.addEventListener('click',function(){
        btn.disabled=true; show('已送出重新取單請求，等待內網凌越整合代理處理…（約 10–40 秒）');
        fetch('/admin/cash/request-refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({icpno:ICPNO,date:DATE})}).then(function(r){return r.json();}).then(function(j){
          if(!j||!j.ok){ btn.disabled=false; show('送出失敗：'+((j&&j.error)||''),'#c62828'); return; }
          var tries=0, max=30; // 每 2 秒一次，最多約 60 秒
          var timer=setInterval(function(){
            tries++;
            fetch('/admin/cash/refresh-status?icpno='+encodeURIComponent(ICPNO)+'&date='+encodeURIComponent(DATE)).then(function(r){return r.json();}).then(function(s){
              if(s&&s.status==='error'){ clearInterval(timer); btn.disabled=false; show('取單失敗：'+(s.error||'內網代理回報錯誤'),'#c62828'); return; }
              if(s&&s.ingested_at&&s.ingested_at!==INIT){ clearInterval(timer); show('資料已更新，正在重新整理…','#2e7d32'); setTimeout(function(){location.reload();},600); return; }
              if(tries>=max){ clearInterval(timer); btn.disabled=false; show('內網代理尚未回應——請確認「凌越整合代理」視窗是否開啟並已連上凌越，稍後可再試。','#c62828'); }
            }).catch(function(){});
          },2000);
        }).catch(function(){ btn.disabled=false; show('送出失敗（網路）','#c62828'); });
      });
    })();`;
    }
    // 流水號檢查卡片：列出斷號、每個缺號要填原因（存 cash_seq_gap_reason）
    function renderGapCard(d, icpno, date) {
        const si = d.seriesInfo || {};
        const range = (k) => si[k]
            ? `${String(si[k].min).padStart(si[k].width, "0")}–${String(si[k].max).padStart(si[k].width, "0")}，共 ${si[k].count} 張`
            : "（無資料）";
        const numGaps = (d.gaps || []).filter((g) => g.series === "num");
        const aGaps = (d.gaps || []).filter((g) => g.series === "A");
        const gapRows = (arr) => arr.map((g) => `
        <tr>
          <td style="font-family:ui-monospace,monospace;color:#c62828;font-weight:600;">${escapeHtml(g.spNo)}</td>
          <td><input class="sf-input cash-gap-reason" data-series="${g.series}" data-seq="${g.seq}" value="${escapeAttr(g.reason || "")}" placeholder="必填：斷號原因（作廢／跳號／退回…）" style="width:100%;${String(g.reason || "").trim() ? "" : "border-color:#c62828;"}"></td>
          <td><button type="button" class="sf-btn cash-gap-save" data-series="${g.series}" data-seq="${g.seq}">儲存</button></td>
        </tr>`).join("");
        const hasGaps = (d.gaps || []).length > 0;
        const head = hasGaps
            ? `<strong style="color:#c62828;">⚠ 流水號有斷號 ${d.gaps.length} 個${d.gapsMissingReason ? `（其中 ${d.gapsMissingReason} 個未填原因）` : "（原因皆已填）"}</strong>`
            : `<strong style="color:#2e7d32;">✅ 流水號連續、無斷號</strong>`;
        const table = hasGaps ? `
          <table style="margin-top:8px;">
            <thead><tr><th style="width:180px;">缺號</th><th>斷號原因（必填）</th><th style="width:80px;"></th></tr></thead>
            <tbody>
              ${numGaps.length ? `<tr><td colspan="3" style="background:#f7f6f3;font-weight:600;">純數字（直打凌越）</td></tr>${gapRows(numGaps)}` : ""}
              ${aGaps.length ? `<tr><td colspan="3" style="background:#f7f6f3;font-weight:600;">A 開頭（寺岡EDI）</td></tr>${gapRows(aGaps)}` : ""}
            </tbody>
          </table>` : "";
        const script = hasGaps ? `<script>(function(){
          document.querySelectorAll('.cash-gap-save').forEach(function(btn){
            btn.addEventListener('click', function(){
              var s=btn.getAttribute('data-series'), q=btn.getAttribute('data-seq');
              var inp=document.querySelector('.cash-gap-reason[data-series="'+s+'"][data-seq="'+q+'"]');
              var reason=(inp&&inp.value||'').trim();
              if(!reason){ if(window.sfToast)sfToast('請先填斷號原因','err'); if(inp)inp.focus(); return; }
              fetch('/admin/cash/gap-reason',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({icpno:'${icpno}',date:'${date}',series:s,seq:parseInt(q,10),reason:reason})})
                .then(function(r){return r.json();}).then(function(j){ if(j&&j.ok){ if(inp)inp.style.borderColor=''; if(window.sfToast)sfToast('已儲存原因'); } else { if(window.sfToast)sfToast('儲存失敗','err'); } })
                .catch(function(){ if(window.sfToast)sfToast('儲存失敗','err'); });
            });
          });
        })();</script>` : "";
        return `<div class="notion-card" style="margin-bottom:16px;">
          <div style="margin-bottom:6px;">${head}</div>
          <div style="font-size:13px;color:#787774;">純數字：${range("num")}　｜　A 開頭：${range("A")}</div>
          ${table}${script}
        </div>`;
    }
    // 月曆（左欄）：有資料的日子標張數、有未收標紅點；點日期切換
    function renderCashCalendar(icpno, month, selDate, aggMap, todayStr) {
        const y = parseInt(month.slice(0, 4), 10), m = parseInt(month.slice(5, 7), 10);
        const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
        const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const prevM = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
        const nextM = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const cells = [];
        for (let i = 0; i < firstDow; i++)
            cells.push(`<div class="empty"></div>`);
        for (let day = 1; day <= daysInMonth; day++) {
            const ds = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const a = aggMap.get(ds);
            const isSel = ds === selDate, isToday = ds === todayStr;
            const bg = isSel ? "background:#2383e2;color:#fff;" : (a ? "background:#eef3fb;" : "");
            const ring = (isToday && !isSel) ? "outline:2px solid #2383e2;outline-offset:-2px;" : "";
            const info = a
                ? `<div style="font-size:10px;line-height:1.2;${isSel ? "color:#e8f0fe;" : "color:#787774;"}">${a.count}張</div>${a.unpaid > 0 ? `<div style="font-size:10px;line-height:1.2;${isSel ? "color:#ffd7d7;" : "color:#c62828;"}">●未收</div>` : ""}`
                : "";
            cells.push(`<a href="/admin/cash?icpno=${icpno}&date=${ds}" style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:4px 2px;text-decoration:none;border-radius:8px;color:#37352f;${bg}${ring}"><span style="font-weight:600;font-size:13px;">${day}</span>${info}</a>`);
        }
        const dow = ["日", "一", "二", "三", "四", "五", "六"].map((w) => `<div class="dow" style="text-align:center;font-size:12px;color:#9b9a97;">${w}</div>`).join("");
        return `<div class="notion-card" style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <a class="sf-btn sf-btn-sm" href="/admin/cash?icpno=${icpno}&date=${prevM}">‹ 上月</a>
            <strong>${y} 年 ${m} 月</strong>
            <a class="sf-btn sf-btn-sm" href="/admin/cash?icpno=${icpno}&date=${nextM}">下月 ›</a>
          </div>
          <div class="cash-cal">${dow}${cells.join("")}</div>
        </div>`;
    }
    // 後台頁：銷貨單總計表（左月曆＋當日摘要、右明細）
    router.get("/cash", requireCash, async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.query.icpno, "00");
            const date = (typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date.trim()))
                ? req.query.date.trim() : getTaipeiCalendarDateYYYYMMDD();
            const d = await loadCashDaily(icpno, date);
            const companyOpts = Object.keys(CASH_COMPANIES).map((k) => `<option value="${k}" ${k === icpno ? "selected" : ""}>${escapeHtml(CASH_COMPANIES[k])}(${k})</option>`).join("");
            const renderRows = (arr) => arr.length ? arr.map((r) => `
        <tr>
          <td style="font-family:var(--sf-mono,monospace);">${escapeHtml(r.sp_no)}</td>
          <td>${escapeHtml(String(r.doc_date || "").slice(0, 10))}</td>
          <td>${escapeHtml(r.ct_name || "")}</td>
          <td>${escapeHtml(r.fkfs || "")}</td>
          <td style="text-align:right;">${cashMoney(r.total)}</td>
          <td style="text-align:right;${Number(r.unpaid || 0) > 0 ? "color:#c62828;font-weight:600;" : "color:#9b9a97;"}">${cashMoney(r.unpaid)}</td>
        </tr>`).join("") : `<tr><td colspan="6" style="text-align:center;color:#9b9a97;padding:18px;">（無資料）</td></tr>`;
            const section = (title, arr, subtotal) => `
        <div class="notion-card" style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
            <strong>${title}</strong>
            <span>${arr.length} 張　合計 <strong>${cashMoney(subtotal)}</strong></span>
          </div>
          <table>
            <thead><tr><th>單號</th><th>單據日期</th><th>客戶名稱</th><th>結帳方式</th><th style="text-align:right;">金額</th><th style="text-align:right;">未收</th></tr></thead>
            <tbody>${renderRows(arr)}</tbody>
          </table>
        </div>`;
            // 月曆資料：該月各日彙總（張數、應收、未收）
            const month = date.slice(0, 7);
            const y = parseInt(month.slice(0, 4), 10), mo = parseInt(month.slice(5, 7), 10);
            const monthStart = `${month}-01`;
            const monthEnd = `${month}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
            const aggRows = await db.prepare("SELECT doc_date, COUNT(*) AS c, SUM(total) AS t, SUM(unpaid) AS u, SUM(CASE WHEN unpaid > 0 THEN 1 ELSE 0 END) AS uc FROM cash_sales_doc WHERE icpno = ? AND doc_date BETWEEN ? AND ? GROUP BY doc_date").all(icpno, monthStart, monthEnd) || [];
            const aggMap = new Map(aggRows.map((r) => [String(r.doc_date).slice(0, 10), { count: Number(r.c || 0), total: Number(r.t || 0), unpaid: Number(r.u || 0), unpaidCount: Number(r.uc || 0) }]));
            const todayStr = getTaipeiCalendarDateYYYYMMDD();
            const selUnpaidCount = d.rows.filter((r) => Number(r.unpaid || 0) > 0).length;
            const ingestNote = d.ingestedAt
                ? `資料更新：${escapeHtml(new Date(d.ingestedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }))}`
                : `<span style="color:#c62828;">此日尚無資料——內網「凌越整合代理」按「立即取單」或執行 <code>ly_sales_push.py --date ${date}</code>。</span>`;
            const q = `?icpno=${icpno}&date=${date}`;
            // 左欄：月曆 + 當日摘要
            const daySummary = `
      <div class="notion-card">
        <div style="font-weight:700;margin-bottom:8px;">${escapeHtml(date)}　當日摘要</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><div style="font-size:12px;color:#9b9a97;">單數</div><strong style="font-size:20px;">${d.rows.length}</strong> 張</div>
          <div><div style="font-size:12px;color:#9b9a97;">應收合計</div><strong style="font-size:20px;">${cashMoney(d.grandTotal)}</strong></div>
          <div><div style="font-size:12px;color:#9b9a97;">未收筆數</div><strong style="font-size:20px;color:${selUnpaidCount ? "#c62828" : "#2e7d32"};">${selUnpaidCount}</strong> 張</div>
          <div><div style="font-size:12px;color:#9b9a97;">未收合計</div><strong style="font-size:20px;color:#c62828;">${cashMoney(d.unpaidTotal)}</strong></div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:#787774;border-top:1px solid #eee;padding-top:8px;">
          純數字 ${d.numRows.length} 張／${cashMoney(d.numTotal)}　·　A 開頭 ${d.aRows.length} 張／${cashMoney(d.aTotal)}
        </div>
        <div style="margin-top:8px;font-size:12px;color:#9b9a97;">${ingestNote}</div>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <a class="sf-btn sf-btn-sm" href="/admin/cash/export.xlsx${q}">Excel</a>
          <a class="sf-btn sf-btn-sm" href="/admin/cash/print${q}" target="_blank">列印/PDF</a>
        </div>
      </div>`;
            const body = `
      <style>
        .cash-2pane{display:grid;grid-template-columns:340px minmax(0,1fr);gap:16px;align-items:start;}
        @media(max-width:900px){.cash-2pane{grid-template-columns:1fr;}}
        .cash-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
        .cash-cal a,.cash-cal .empty,.cash-cal .dow{min-height:46px;}
        .cash-cal .dow{min-height:auto;}
      </style>
      <h1 class="notion-page-title">松富銷貨統計</h1>
      <div class="notion-card" style="margin-bottom:16px;">
        <form method="get" action="/admin/cash" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
          <label>公司<br><select name="icpno" class="sf-input">${companyOpts}</select></label>
          <label>跳到日期<br><input type="date" name="date" value="${date}" class="sf-input"></label>
          <button type="submit" class="btn-primary">查詢</button>
          <span style="flex:1;"></span>
          <button type="button" class="sf-btn" id="cashRefreshBtn" title="客戶改單後，重撈凌越當日最新銷貨單（透過內網代理）">重新取單（更新改單）</button>
          <a class="sf-btn" href="/admin/cash/collect?icpno=${icpno}&date=${date}">前往收款處 →</a>
        </form>
        <div id="cashRefreshMsg" style="margin-top:8px;font-size:13px;color:#787774;display:none;"></div>
      </div>
      <script>${cashRefreshScript(icpno, date, d.ingestedAt || "")}</script>
      <div class="cash-2pane">
        <div>
          ${renderCashCalendar(icpno, month, date, aggMap, todayStr)}
          ${daySummary}
        </div>
        <div>
          ${renderGapCard(d, icpno, date)}
          ${section("純數字（直打凌越）", d.numRows, d.numTotal)}
          ${section("A 開頭（訂單拋轉寺岡 EDI 回轉）", d.aRows, d.aTotal)}
        </div>
      </div>`;
            res.type("text/html").send(notionPage("松富銷貨統計", body, "cash", res));
        }
        catch (e) {
            console.error("[admin] /cash", e?.message || e);
            res.status(500).type("text/html").send("讀取失敗：" + escapeHtml(String(e?.message || e)));
        }
    });
    // 儲存流水號斷號原因
    router.post("/cash/gap-reason", requireCash, express_1.default.json({ limit: "64kb" }), async (req, res) => {
        try {
            const b = req.body || {};
            const icpno = erp_companies_js_1.normIcpno(b.icpno, "00");
            const date = (typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date.trim())) ? b.date.trim() : "";
            const series = b.series === "A" ? "A" : "num";
            const seq = parseInt(b.seq, 10);
            const reason = String(b.reason ?? "").trim();
            if (!date || !Number.isInteger(seq)) {
                res.status(400).json({ error: "參數錯誤（date/seq）" });
                return;
            }
            const by = (res.locals && res.locals.adminUser) || "";
            const at = new Date().toISOString();
            await db.prepare("INSERT INTO cash_seq_gap_reason (icpno, doc_date, series, seq, reason, updated_by, updated_at) VALUES (?,?,?,?,?,?,?) " +
                "ON CONFLICT (icpno, doc_date, series, seq) DO UPDATE SET reason = excluded.reason, updated_by = excluded.updated_by, updated_at = excluded.updated_at").run(icpno, date, series, seq, reason, by, at);
            res.json({ ok: true });
        }
        catch (e) {
            console.error("[admin] /cash/gap-reason", e?.message || e);
            res.status(500).json({ error: "儲存失敗", detail: String(e?.message || e) });
        }
    });
    // 匯出 Excel（銷貨單總計表）
    router.get("/cash/export.xlsx", requireCash, async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.query.icpno, "00");
            const date = (typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date.trim()))
                ? req.query.date.trim() : getTaipeiCalendarDateYYYYMMDD();
            const d = await loadCashDaily(icpno, date);
            const printedBy = (res.locals && res.locals.adminUser) || "";
            const aoa = [
                ["松富物流股份有限公司　銷貨單總計表"],
                [`公司：${CASH_COMPANIES[icpno] || icpno}(${icpno})`, `日期：${date}`, `列印人：${printedBy}`],
                [],
                ["單號", "單據日期", "客戶名稱", "結帳方式", "金額", "未收", "類型"],
            ];
            const pushGroup = (label, arr, subtotal) => {
                aoa.push([label]);
                for (const r of arr)
                    aoa.push([r.sp_no, String(r.doc_date || "").slice(0, 10), r.ct_name || "", r.fkfs || "", Number(r.total || 0), Number(r.unpaid || 0), r.kind === "A" ? "A" : "純數字"]);
                aoa.push(["小計", "", "", "", subtotal, "", ""]);
                aoa.push([]);
            };
            pushGroup("【純數字（直打凌越）】", d.numRows, d.numTotal);
            pushGroup("【A 開頭（寺岡EDI）】", d.aRows, d.aTotal);
            aoa.push(["總計", "", "", "", d.grandTotal, d.unpaidTotal, ""]);
            // 流水號斷號區
            aoa.push([]);
            if ((d.gaps || []).length) {
                aoa.push([`流水號斷號（${d.gaps.length} 個）`, "缺號", "原因"]);
                for (const g of d.gaps)
                    aoa.push([g.series === "A" ? "A開頭" : "純數字", g.spNo, String(g.reason || "").trim() || "（未填原因）"]);
            }
            else {
                aoa.push(["流水號連續、無斷號"]);
            }
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "銷貨單總計表");
            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="sales_total_${icpno}_${date}.xlsx"`);
            res.send(buf);
        }
        catch (e) {
            console.error("[admin] /cash/export.xlsx", e?.message || e);
            res.status(500).send("匯出失敗：" + escapeHtml(String(e?.message || e)));
        }
    });
    // 列印版（瀏覽器另存 PDF）：表頭帶公司名／日期／列印人／列印時間
    router.get("/cash/print", requireCash, async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.query.icpno, "00");
            const date = (typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date.trim()))
                ? req.query.date.trim() : getTaipeiCalendarDateYYYYMMDD();
            const d = await loadCashDaily(icpno, date);
            const printedBy = (res.locals && res.locals.adminUser) || "";
            const printedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
            const rowHtml = (arr) => arr.map((r) => `<tr><td class="mono">${escapeHtml(r.sp_no)}</td><td>${escapeHtml(String(r.doc_date || "").slice(0, 10))}</td><td>${escapeHtml(r.ct_name || "")}</td><td>${escapeHtml(r.fkfs || "")}</td><td class="r">${cashMoney(r.total)}</td><td class="r">${cashMoney(r.unpaid)}</td></tr>`).join("");
            const grp = (label, arr, subtotal) => `<tr class="grp"><td colspan="6">${escapeHtml(label)}（${arr.length} 張）</td></tr>${rowHtml(arr)}<tr class="sub"><td colspan="4">小計</td><td class="r">${cashMoney(subtotal)}</td><td></td></tr>`;
            res.type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>銷貨單總計表 ${date}</title>
      <style>
        *{box-sizing:border-box;} body{font-family:'Noto Sans TC',ui-sans-serif,sans-serif;color:#111;margin:24px;}
        h1{font-size:20px;margin:0 0 2px;text-align:center;} .sub-h{text-align:center;font-size:15px;margin:0 0 4px;}
        .meta{display:flex;justify-content:space-between;font-size:12px;color:#333;margin:8px 0;border-bottom:1px solid #999;padding-bottom:6px;}
        table{width:100%;border-collapse:collapse;font-size:12px;} th,td{border:1px solid #bbb;padding:4px 6px;} th{background:#f0f0f0;}
        td.r,th.r{text-align:right;} td.mono{font-family:ui-monospace,monospace;} tr.grp td{background:#eef3fb;font-weight:700;} tr.sub td{background:#fafafa;font-weight:600;}
        tr.total td{background:#fff3cd;font-weight:700;font-size:13px;}
        .btns{margin:12px 0;} @media print{.btns{display:none;}}
      </style></head><body>
      <div class="btns"><button onclick="window.print()">列印 / 另存 PDF</button></div>
      <h1>松富物流股份有限公司</h1>
      <div class="sub-h">銷貨單總計表</div>
      <div class="meta"><span>公司：${escapeHtml(CASH_COMPANIES[icpno] || icpno)}(${icpno})</span><span>日期：${date}</span><span>列印人：${escapeHtml(printedBy)}</span><span>列印時間：${escapeHtml(printedAt)}</span></div>
      <table>
        <thead><tr><th>單號</th><th>單據日期</th><th>客戶名稱</th><th>結帳方式</th><th class="r">金額</th><th class="r">未收</th></tr></thead>
        <tbody>
          ${grp("純數字（直打凌越）", d.numRows, d.numTotal)}
          ${grp("A 開頭（訂單拋轉寺岡 EDI 回轉）", d.aRows, d.aTotal)}
          <tr class="total"><td colspan="4">總計（${d.rows.length} 張）</td><td class="r">${cashMoney(d.grandTotal)}</td><td class="r">${cashMoney(d.unpaidTotal)}</td></tr>
        </tbody>
      </table>
      ${(d.gaps || []).length
                ? `<h3 style="font-size:14px;margin:14px 0 4px;">流水號斷號（${d.gaps.length} 個${d.gapsMissingReason ? `，${d.gapsMissingReason} 個未填原因` : ""}）</h3>
      <table><thead><tr><th style="width:90px;">類別</th><th style="width:160px;">缺號</th><th>斷號原因</th></tr></thead><tbody>
        ${d.gaps.map((g) => `<tr><td>${g.series === "A" ? "A開頭" : "純數字"}</td><td class="mono">${escapeHtml(g.spNo)}</td><td${String(g.reason || "").trim() ? "" : ' style="color:#c62828;font-weight:700;"'}>${escapeHtml(String(g.reason || "").trim() || "（未填原因）")}</td></tr>`).join("")}
      </tbody></table>`
                : `<p style="font-size:12px;color:#2e7d32;margin-top:12px;">流水號連續、無斷號。</p>`}
      </body></html>`);
        }
        catch (e) {
            console.error("[admin] /cash/print", e?.message || e);
            res.status(500).send("列印頁失敗：" + escapeHtml(String(e?.message || e)));
        }
    });
    // ============================================================
    //  收款處（Phase2）：一筆收款可對應一或多張銷貨單；支援現金＋票據；未收跨日；司機合計
    // ============================================================
    function cashNum(v) { const n = Number(String(v ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) ? n : 0; }
    function cashValidDate(v) { return (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) ? v.trim() : ""; }
    async function loadCollectData(icpno, date) {
        const dayUnits = await db.prepare(
            "SELECT s.sp_no, s.doc_date, s.ct_no, s.ct_name, s.fkfs, s.total, s.unpaid, s.nopay_fg, s.kind, COALESCE(c.route_line,'') AS route_line, c.is_cash AS is_cash " +
            "FROM cash_sales_doc s LEFT JOIN cash_customer c ON c.icpno = s.icpno AND c.ct_no = s.ct_no " +
            "WHERE s.icpno = ? AND s.doc_date = ? ORDER BY COALESCE(c.route_line,''), s.ct_name, s.sp_no").all(icpno, date) || [];
        const allocRows = await db.prepare("SELECT a.sp_no, a.payment_id, p.collected_by, p.recorded_by, p.recorded_at FROM cash_payment_alloc a JOIN cash_payment p ON p.id = a.payment_id WHERE a.icpno = ?").all(icpno) || [];
        const allocBySp = new Map(allocRows.map((r) => [r.sp_no, r]));
        const driverRows = await db.prepare("SELECT COALESCE(NULLIF(TRIM(collected_by),''),'（未填）') AS who, COUNT(*) AS c, SUM(cash_amount) AS cash, SUM(check_amount) AS chk, SUM(total_amount) AS tot FROM cash_payment WHERE icpno = ? AND pay_date = ? GROUP BY COALESCE(NULLIF(TRIM(collected_by),''),'（未填）') ORDER BY SUM(total_amount) DESC").all(icpno, date) || [];
        // 跨日未收：選定日期之前、尚未收款的單（客戶一週結一次會累積在這）
        const priorUnpaid = await db.prepare(
            "SELECT s.sp_no, s.doc_date, s.ct_no, s.ct_name, s.fkfs, s.total, s.unpaid, s.nopay_fg, COALESCE(c.route_line,'') AS route_line, c.is_cash AS is_cash " +
            "FROM cash_sales_doc s LEFT JOIN cash_customer c ON c.icpno = s.icpno AND c.ct_no = s.ct_no " +
            "WHERE s.icpno = ? AND s.doc_date < ? AND COALESCE(s.unpaid,0) > 0 AND NOT EXISTS (SELECT 1 FROM cash_payment_alloc a WHERE a.icpno = s.icpno AND a.sp_no = s.sp_no) " +
            "ORDER BY COALESCE(c.route_line,''), s.ct_name, s.doc_date, s.sp_no").all(icpno, date) || [];
        return { dayUnits, allocBySp, driverRows, priorUnpaid };
    }
    async function cashDriverList() {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("cash_drivers");
        return String(row?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
    }
    // 收款處（列表式：左路線、右單據勾選 → 收款彈窗 → 明細彈窗 → 產生 JPG）
    router.get("/cash/collect", requireCash, async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.query.icpno, "00");
            const date = cashValidDate(req.query.date) || getTaipeiCalendarDateYYYYMMDD();
            const route = typeof req.query.route === "string" ? req.query.route : "all";
            const { dayUnits, allocBySp, driverRows, priorUnpaid } = await loadCollectData(icpno, date);
            const drivers = await cashDriverList();
            const me = (res.locals && res.locals.adminUser) || "";
            const collectIngestedAt = (await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("cash_sales_ingested_at_" + icpno + "_" + date))?.value || "";
            const companyOpts = Object.keys(CASH_COMPANIES).map((k) => `<option value="${k}" ${k === icpno ? "selected" : ""}>${escapeHtml(CASH_COMPANIES[k])}(${k})</option>`).join("");
            const isCashRow = (u) => (u.is_cash === 1 || u.is_cash === "1") ? true : ((u.is_cash === 0 || u.is_cash === "0") ? false : /現金|現收/.test(String(u.fkfs || "")));
            const fmtTs = (iso) => { try { return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; } };
            const erpUnpaid = (u) => cashNum(u.unpaid) > 0; // 凌越未付>0＝ERP尚未沖帳；=0＝會計已沖帳(視為已收)
            // 「未收」= 我方未登記收款 且 凌越仍未付；已沖帳(unpaid=0)不算未收
            const isUnpaidRow = (u) => !allocBySp.has(u.sp_no) && erpUnpaid(u);
            // 左欄計數：只算「收現金」客戶（與預設『只看收現金』一致）
            const routeAgg = new Map();
            for (const u of dayUnits) {
                if (!isCashRow(u))
                    continue;
                const rt = String(u.route_line || "").trim();
                if (!routeAgg.has(rt))
                    routeAgg.set(rt, { total: 0, unpaid: 0 });
                const a = routeAgg.get(rt);
                a.total++;
                if (isUnpaidRow(u))
                    a.unpaid++;
            }
            const routeKeys = Array.from(routeAgg.keys()).sort((x, y) => (x === "" ? 1 : y === "" ? -1 : String(x).localeCompare(String(y), "zh-Hant", { numeric: true })));
            const routeLabel = (rt) => rt === "" ? "未分路線" : "路線 " + rt;
            const cashUnits = dayUnits.filter(isCashRow);
            const allTotal = cashUnits.length;
            const allUnpaid = cashUnits.filter(isUnpaidRow).length;
            const rtLink = (key, label, tot, un) => `<a href="/admin/cash/collect?icpno=${icpno}&date=${date}&route=${encodeURIComponent(key)}" class="cash-rt${(route === key || (key === "all" && route === "all")) ? " on" : ""}"><span>${escapeHtml(label)}</span><span class="rt-n">${tot}${un ? `／<b style="color:#c62828;">未${un}</b>` : ""}</span></a>`;
            const leftNav = `
        <div class="notion-card" style="padding:8px;position:sticky;top:8px;">
          <div style="font-weight:700;margin:2px 6px 8px;">路線</div>
          ${rtLink("all", "全部路線", allTotal, allUnpaid)}
          ${routeKeys.map((rt) => rtLink(rt, routeLabel(rt), routeAgg.get(rt).total, routeAgg.get(rt).unpaid)).join("")}
          <div style="margin-top:10px;border-top:1px solid #eee;padding-top:8px;">
            <a class="sf-btn sf-btn-sm" href="/admin/cash/customers?icpno=${icpno}" style="width:100%;text-align:center;">維護路線 / 司機</a>
          </div>
        </div>`;
            const shown = route === "all" ? dayUnits : dayUnits.filter((u) => String(u.route_line || "").trim() === route);
            // 單列（當日與跨日未收共用）；prior=true 時單號後顯示原單日期
            const unitRow = (u, prior) => {
                const a = allocBySp.get(u.sp_no);
                const paid = !!a;
                const erpPaid = !paid && !erpUnpaid(u); // 我方沒登記、但凌越已沖帳
                const collectable = !paid && !erpPaid; // 真正未收（可收款）
                const cashFlag = isCashRow(u);
                const searchKey = ((u.sp_no || "") + " " + (u.ct_name || "") + " " + (u.ct_no || "")).toLowerCase();
                const status = paid
                    ? `<span style="color:#2e7d32;">已收${a.collected_by ? "・" + escapeHtml(a.collected_by) : ""}</span>${a.recorded_by || a.recorded_at ? `<span style="color:#9b9a97;font-size:11px;"> （${a.recorded_by ? escapeHtml(a.recorded_by) : ""}${a.recorded_at ? " " + escapeHtml(fmtTs(a.recorded_at)) : ""}）</span>` : ""} <button type="button" class="link-undo cf-undo" data-pid="${a.payment_id}">取消</button>`
                    : (erpPaid
                        ? `<span style="color:#2e7d32;">已收（ERP沖帳）</span>`
                        : `<button type="button" class="btn-primary cc-payone" style="padding:2px 10px;font-size:12px;" data-sp="${escapeAttr(u.sp_no)}">收款</button> <span style="color:#c62828;font-size:12px;">未收</span>`);
                return `<tr class="cc-tr" data-cash="${cashFlag ? 1 : 0}" data-search="${escapeAttr(searchKey)}">
            <td style="text-align:center;">${collectable ? `<input type="checkbox" class="cc-row" value="${escapeAttr(u.sp_no)}" data-due="${cashNum(u.total)}" data-ct="${escapeAttr(u.ct_no)}" data-ctname="${escapeAttr(u.ct_name || "")}">` : ""}</td>
            <td style="font-family:ui-monospace,monospace;">${escapeHtml(u.sp_no)}${prior ? `<span style="color:#c62828;font-size:11px;"> (${escapeHtml(String(u.doc_date || "").slice(5, 10))})</span>` : ""}</td>
            <td>${escapeHtml(u.ct_name || "")}</td>
            <td style="text-align:center;">${escapeHtml(String(u.route_line || "").trim() || "—")}</td>
            <td>${escapeHtml(u.fkfs || "")}${cashFlag ? "" : ` <span style="color:#9b9a97;font-size:11px;">非現金</span>`}</td>
            <td style="text-align:right;">${cashMoney(u.total)}</td>
            <td>${status}</td>
          </tr>`;
            };
            const rowHtml = shown.length ? shown.map((u) => unitRow(u, false)).join("") : `<tr><td colspan="7" style="text-align:center;color:#9b9a97;padding:18px;">此路線當日無單據。</td></tr>`;
            // 跨日未收（依路線篩），下方獨立區、可勾選帶入收款
            const priorShown = (route === "all" ? priorUnpaid : priorUnpaid.filter((u) => String(u.route_line || "").trim() === route)).filter(isCashRow);
            const priorHtml = priorShown.map((u) => unitRow(u, true)).join("");
            const priorDue = priorShown.reduce((s, u) => s + cashNum(u.total), 0);
            const shownDueTotalPlaceholder = shown.reduce((s, u) => s + cashNum(u.total), 0);
            const shownUnpaidPlaceholder = shown.filter((u) => !allocBySp.has(u.sp_no)).reduce((s, u) => s + cashNum(u.total), 0);
            const driverBar = driverRows.length
                ? driverRows.map((r) => `${escapeHtml(r.who)} <b>${cashMoney(r.tot)}</b>（現${cashMoney(r.cash)}／票${cashMoney(r.chk)}・${r.c}筆）`).join("　·　")
                : "今日尚無收款";
            const driverOpts = `<option value="">（選司機）</option>` + drivers.map((d) => `<option value="${escapeAttr(d)}">${escapeHtml(d)}</option>`).join("") + `<option value="__other__">＋自行輸入</option>`;
            const body = `
      <style>
        .cash-collect{display:grid;grid-template-columns:210px minmax(0,1fr);gap:14px;align-items:start;}
        @media(max-width:820px){.cash-collect{grid-template-columns:1fr;}}
        .cash-rt{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:7px 9px;border-radius:8px;text-decoration:none;color:#37352f;font-size:14px;}
        .cash-rt:hover{background:#f1f0ee;} .cash-rt.on{background:#2383e2;color:#fff;} .cash-rt .rt-n{font-size:12px;opacity:.85;}
        .cc-table{width:100%;} .cc-table th,.cc-table td{padding:5px 8px;font-size:13px;}
        .link-undo{background:none;border:none;color:#c62828;cursor:pointer;font-size:12px;text-decoration:underline;padding:0;}
        .cc-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;z-index:9999;}
        .cc-modal{background:#fff;border-radius:12px;padding:18px;max-width:560px;width:92%;max-height:88vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.2);}
        .cc-modal h3{margin:0 0 10px;font-size:17px;} .cc-modal label{font-size:13px;display:block;margin-top:8px;}
        .cc-check-row{display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end;margin-top:6px;}
      </style>
      <h1 class="notion-page-title">現金收款</h1>
      <div style="display:flex;gap:4px;margin:0 0 14px;">
        <a href="/admin/cash/collect?icpno=${icpno}&date=${date}" style="padding:6px 16px;border-radius:8px 8px 0 0;text-decoration:none;font-weight:600;background:#2383e2;color:#fff;">收款</a>
        <a href="/admin/cash/daily-report?icpno=${icpno}&date=${date}" style="padding:6px 16px;border-radius:8px 8px 0 0;text-decoration:none;font-weight:600;background:#f1f0ee;color:#37352f;">現金日報表</a>
      </div>
      <div class="notion-card" style="margin-bottom:12px;">
        <form method="get" action="/admin/cash/collect" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
          <input type="hidden" name="route" value="${escapeAttr(route)}">
          <label>公司<br><select name="icpno" class="sf-input">${companyOpts}</select></label>
          <label>日期<br><input type="date" name="date" value="${date}" class="sf-input"></label>
          <button type="submit" class="btn-primary">查詢</button>
          <span style="flex:1;"></span>
          <button type="button" class="sf-btn" id="cashRefreshBtn" title="客戶改單後，重撈凌越當日最新銷貨單（透過內網代理）">重新取單（更新改單）</button>
          <a class="sf-btn" href="/admin/cash?icpno=${icpno}&date=${date}">← 銷貨單總計表</a>
        </form>
        <div style="margin-top:8px;font-size:12px;color:#787774;">司機收款：${driverBar}</div>
        <div id="cashRefreshMsg" style="margin-top:6px;font-size:13px;color:#787774;display:none;"></div>
      </div>
      <script>${cashRefreshScript(icpno, date, collectIngestedAt)}</script>
      <div class="cash-collect">
        ${leftNav}
        <div class="notion-card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
            <div><strong>${route === "all" ? "全部路線" : escapeHtml(routeLabel(route))}</strong>　<span style="color:#787774;font-size:13px;">${escapeHtml(date)}</span></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="sf-btn sf-btn-sm" id="ccSelAll">全選未收</button>
              <button type="button" class="btn-primary" id="ccPayBtn">收款（<span id="ccSelN">0</span>）</button>
              <button type="button" class="sf-btn sf-btn-sm" id="ccJpgBtn">產生 JPG</button>
              <button type="button" class="sf-btn sf-btn-sm" id="ccExtraBtn">手動入帳</button>
            </div>
          </div>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
            <label style="display:inline-flex;gap:6px;align-items:center;font-size:13px;cursor:pointer;"><input type="checkbox" id="ccCashOnly" checked> 只看收現金客戶（匯款/月結不列）</label>
            <div style="position:relative;width:280px;max-width:100%;">
              <input type="text" id="ccSearch" class="sf-input" placeholder="打單號或客戶找單（例外收現也找得到）" style="width:100%;padding-left:28px;">
              <span style="position:absolute;left:8px;top:10px;color:var(--txt-3);">${SF_ICONS.search}</span>
            </div>
            <span style="color:#787774;font-size:12px;">顯示 <span id="ccShownN">0</span> 筆・未收 <span id="ccShownDue">0</span></span>
          </div>
          <table class="cc-table">
            <thead><tr><th style="width:34px;"></th><th>單號</th><th>客戶</th><th style="width:54px;text-align:center;">路線</th><th>結帳</th><th style="text-align:right;">應收</th><th style="width:210px;">狀態</th></tr></thead>
            <tbody id="ccBody">${rowHtml}</tbody>
          </table>
          ${priorShown.length ? `<details id="ccPriorDetails" style="margin-top:14px;" open>
            <summary style="cursor:pointer;font-weight:700;color:#c62828;">此路線跨日未收（${priorShown.length} 張，${cashMoney(priorDue)}）— 可用上面搜尋框找、勾選一起收款</summary>
            <table class="cc-table" style="margin-top:6px;">
              <thead><tr><th style="width:34px;"></th><th>單號(原單日)</th><th>客戶</th><th style="width:54px;text-align:center;">路線</th><th>結帳</th><th style="text-align:right;">應收</th><th style="width:210px;">狀態</th></tr></thead>
              <tbody id="ccBodyPrior">${priorHtml}</tbody>
            </table>
          </details>` : ""}
        </div>
      </div>
      <div class="cc-modal-bg" id="ccModalBg">
        <div class="cc-modal">
          <h3>登記收款</h3>
          <div id="ccSummary" style="font-size:15px;margin-bottom:6px;font-weight:600;"></div>
          <div id="ccBreakdown" style="font-size:13px;margin-bottom:10px;border:1px solid #eee;border-radius:8px;max-height:180px;overflow:auto;"></div>
          <label>現金金額<input type="number" step="1" id="ccCash" class="sf-input" placeholder="0" style="width:160px;"></label>
          <label>匯款金額<input type="number" step="1" id="ccTransfer" class="sf-input" placeholder="0" style="width:160px;"></label>
          <div style="margin-top:8px;font-size:13px;font-weight:600;">票據（可多張）</div>
          <div id="ccChecks"></div>
          <button type="button" class="sf-btn sf-btn-sm" id="ccAddCheck" style="margin-top:6px;">＋加一張票</button>
          <label>司機<select id="ccDriver" class="sf-input" style="width:200px;">${driverOpts}</select></label>
          <input type="text" id="ccDriverOther" class="sf-input" placeholder="自行輸入司機" style="display:none;width:200px;margin-top:4px;">
          <label>備註（自由填寫）<input type="text" id="ccNote" class="sf-input" style="width:100%;"></label>
          <div id="ccCalc" style="margin-top:10px;font-size:14px;padding:8px;background:#f7f6f3;border-radius:8px;"></div>
          <div style="font-size:12px;color:#787774;margin-top:6px;">收款人：${escapeHtml(me || "（未登入）")}</div>
          <div style="margin-top:14px;text-align:right;display:flex;gap:8px;justify-content:flex-end;">
            <button type="button" class="sf-btn" id="ccCancel">取消</button>
            <button type="button" class="btn-primary" id="ccConfirm">確認收款</button>
          </div>
        </div>
      </div>
      <div class="cc-modal-bg" id="ccDetailBg">
        <div class="cc-modal">
          <h3>收款明細</h3>
          <div id="ccDetail" style="font-size:14px;"></div>
          <div style="margin-top:14px;text-align:right;display:flex;gap:8px;justify-content:flex-end;">
            <button type="button" class="sf-btn" id="ccDetailJpg">存成 JPG</button>
            <button type="button" class="btn-primary" id="ccDetailClose">關閉</button>
          </div>
        </div>
      </div>
      <div class="cc-modal-bg" id="ccExtraBg">
        <div class="cc-modal">
          <h3>手動入帳（非銷貨單的款）</h3>
          <div style="font-size:13px;color:#787774;margin-bottom:6px;">找不到單、或不是銷貨單的收入（如雜項、回收）用這裡。會進「現金日報表 → 額外收入」。</div>
          <label>項目<input type="text" id="ceItem" class="sf-input" placeholder="例：回收紙箱／臨時雜項" style="width:100%;"></label>
          <label>金額<input type="number" id="ceAmount" class="sf-input" style="width:150px;"></label>
          <label>入帳方式<select id="ceMethod" class="sf-input" style="width:150px;"><option value="cash">現金</option><option value="transfer">匯款</option><option value="check">票</option></select></label>
          <label>司機／收款人<input type="text" id="ceBy" class="sf-input" value="${escapeAttr(me)}" style="width:180px;"></label>
          <label>備註<input type="text" id="ceNote" class="sf-input" style="width:100%;"></label>
          <div style="margin-top:14px;text-align:right;display:flex;gap:8px;justify-content:flex-end;">
            <button type="button" class="sf-btn" id="ceCancel">取消</button>
            <button type="button" class="btn-primary" id="ceConfirm">新增入帳</button>
          </div>
        </div>
      </div>
      <canvas id="ccCanvas" style="display:none;"></canvas>
      <script>(function(){
        var ICPNO=${JSON.stringify(icpno)}, PAYDATE=${JSON.stringify(date)}, ME=${JSON.stringify(me)}, ROUTE=${JSON.stringify(route === "all" ? "全部路線" : routeLabel(route))}, COMPANY=${JSON.stringify(CASH_COMPANIES[icpno] || icpno)};
        function money(n){ return Number(n||0).toLocaleString(); }
        // 篩選：只看收現金（預設）＋搜尋單號/客戶（搜尋時連非現金也顯示，供例外收現）
        function applyFilter(){
          var cashOnly=document.getElementById('ccCashOnly').checked;
          var q=(document.getElementById('ccSearch').value||'').trim().toLowerCase();
          var rows=document.querySelectorAll('.cc-tr'); var n=0, due=0;
          rows.forEach(function(tr){
            var isCash=tr.getAttribute('data-cash')==='1';
            var hitQ=!q||(tr.getAttribute('data-search')||'').indexOf(q)>=0;
            var show = hitQ && (q ? true : (cashOnly ? isCash : true));
            tr.style.display=show?'':'none';
            if(show){ n++; var cb=tr.querySelector('.cc-row'); if(cb){ due+=Number(cb.dataset.due||0); } if(cb&&!cb.checked){} }
          });
          var sn=document.getElementById('ccShownN'); if(sn)sn.textContent=n;
          var sd=document.getElementById('ccShownDue'); if(sd)sd.textContent=money(due);
          var det=document.getElementById('ccPriorDetails'); if(det&&q){ det.open=true; } // 搜尋時自動展開跨日未收
        }
        document.getElementById('ccCashOnly').addEventListener('change',applyFilter);
        document.getElementById('ccSearch').addEventListener('input',applyFilter);
        // 手動入帳
        document.getElementById('ccExtraBtn').addEventListener('click',function(){ document.getElementById('ccExtraBg').style.display='flex'; });
        document.getElementById('ceCancel').addEventListener('click',function(){ document.getElementById('ccExtraBg').style.display='none'; });
        document.getElementById('ceConfirm').addEventListener('click',function(){
          var item=document.getElementById('ceItem').value.trim(); var amt=document.getElementById('ceAmount').value;
          if(!item||!amt){ if(window.sfToast)sfToast('請填項目與金額','err'); return; }
          var b=this; b.disabled=true;
          fetch('/admin/cash/extra-income',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({icpno:ICPNO,income_date:PAYDATE,item:item,amount:amt,method:document.getElementById('ceMethod').value,collected_by:document.getElementById('ceBy').value,note:document.getElementById('ceNote').value})}).then(function(r){return r.json();}).then(function(j){ b.disabled=false; if(j&&j.ok){ if(window.sfToast)sfToast('已新增入帳'); document.getElementById('ccExtraBg').style.display='none'; document.getElementById('ceItem').value='';document.getElementById('ceAmount').value='';document.getElementById('ceNote').value=''; } else { if(window.sfToast)sfToast('新增失敗','err'); } }).catch(function(){ b.disabled=false; if(window.sfToast)sfToast('新增失敗','err'); });
        });
        function checked(){ return [].slice.call(document.querySelectorAll('.cc-row:checked')); }
        function selTotal(){ var t=0; checked().forEach(function(r){ t+=Number(r.dataset.due||0); }); return t; }
        function refreshN(showToast){ var n=checked().length; var t=selTotal(); document.getElementById('ccSelN').textContent=n+(n?('・'+money(t)):''); if(showToast&&n>0&&window.sfToast){ sfToast('已選 '+n+' 張・合計 '+money(t)); } }
        // 兩個表（當日＋跨日未收）的勾選都要更新上面數字＋跳 toast
        document.addEventListener('change',function(e){ if(e.target&&e.target.classList&&e.target.classList.contains('cc-row')) refreshN(true); });
        document.getElementById('ccSelAll').addEventListener('click',function(){ var b=[].slice.call(document.querySelectorAll('.cc-row')).filter(function(x){var tr=x.closest('tr');return tr&&tr.style.display!=='none';}); var allOn=b.length&&b.every(function(x){return x.checked;}); b.forEach(function(x){x.checked=!allOn;}); refreshN(true); });
        // 票列
        function checkRow(){ var d=document.createElement('div'); d.className='cc-check-row';
          d.innerHTML='<label style="margin:0;">票號<br><input class="ck-no sf-input" style="width:110px;"></label>'+
            '<label style="margin:0;">銀行/分行<br><input class="ck-bank sf-input" style="width:120px;"></label>'+
            '<label style="margin:0;">到期日<br><input type="date" class="ck-due sf-input"></label>'+
            '<label style="margin:0;">金額<br><input type="number" class="ck-amt sf-input" style="width:100px;"></label>'+
            '<button type="button" class="sf-btn sf-btn-sm ck-del">刪</button>';
          return d; }
        document.getElementById('ccAddCheck').addEventListener('click',function(){ document.getElementById('ccChecks').appendChild(checkRow()); recalc(); });
        document.getElementById('ccChecks').addEventListener('click',function(e){ if(e.target.classList.contains('ck-del')){ e.target.closest('.cc-check-row').remove(); recalc(); } });
        document.getElementById('ccChecks').addEventListener('input',recalc);
        document.getElementById('ccCash').addEventListener('input',recalc);
        document.getElementById('ccTransfer').addEventListener('input',recalc);
        document.getElementById('ccDriver').addEventListener('change',function(){ document.getElementById('ccDriverOther').style.display=(this.value==='__other__')?'block':'none'; });
        function selInfo(){ var rows=checked(); var due=0, custs={}, order=[]; rows.forEach(function(r){ var d=Number(r.dataset.due||0); due+=d; var ct=r.dataset.ct; if(!custs[ct]){ custs[ct]={name:r.dataset.ctname,due:0,n:0}; order.push(ct); } custs[ct].due+=d; custs[ct].n++; }); var byCust=order.map(function(ct){return custs[ct];}); return {rows:rows, due:due, custN:order.length, byCust:byCust, custName:order.length===1?(rows[0]?rows[0].dataset.ctname:''):('多客戶('+order.length+'家)')}; }
        function checksData(){ return [].slice.call(document.querySelectorAll('#ccChecks .cc-check-row')).map(function(r){ return {check_no:r.querySelector('.ck-no').value, bank:r.querySelector('.ck-bank').value, due_date:r.querySelector('.ck-due').value, amount:r.querySelector('.ck-amt').value}; }); }
        function recalc(){ var i=selInfo(); var cash=Number(document.getElementById('ccCash').value||0); var tr=Number(document.getElementById('ccTransfer').value||0); var chk=checksData().reduce(function(s,c){return s+Number(c.amount||0);},0); var got=cash+tr+chk; var diff=got-i.due; var t=diff===0?'剛好':(diff>0?('溢收 '+money(diff)):('短收 '+money(-diff))); document.getElementById('ccCalc').innerHTML='應收 <b>'+money(i.due)+'</b>　實收 <b>'+money(got)+'</b>（現'+money(cash)+'／匯'+money(tr)+'／票'+money(chk)+'）　差額：<b style="color:'+(diff<0?'#c62828':'#2e7d32')+'">'+t+'</b>'; }
        function openPayModal(){ var i=selInfo(); if(!i.rows.length){ if(window.sfToast)sfToast('請先勾要收款的單','err'); return; }
          document.getElementById('ccSummary').innerHTML='總計：'+i.rows.length+' 張・'+i.custN+' 家・應收 <b>'+money(i.due)+'</b>';
          var bd='<table style="width:100%;font-size:13px;"><thead><tr><th style="text-align:left;padding:4px 8px;">客戶</th><th style="text-align:right;padding:4px 8px;">張數</th><th style="text-align:right;padding:4px 8px;">應收</th></tr></thead><tbody>';
          i.byCust.forEach(function(c){ bd+='<tr><td style="padding:3px 8px;">'+(c.name||'')+'</td><td style="text-align:right;padding:3px 8px;">'+c.n+'</td><td style="text-align:right;padding:3px 8px;">'+money(c.due)+'</td></tr>'; });
          bd+='</tbody></table>';
          document.getElementById('ccBreakdown').innerHTML=bd;
          document.getElementById('ccCash').value=i.due; document.getElementById('ccTransfer').value=''; document.getElementById('ccChecks').innerHTML=''; document.getElementById('ccNote').value=''; recalc(); document.getElementById('ccModalBg').style.display='flex'; }
        document.getElementById('ccPayBtn').addEventListener('click',openPayModal);
        // 每列「收款」按鈕：直接收這一單（不用先打勾）
        document.addEventListener('click',function(e){ if(e.target&&e.target.classList.contains('cc-payone')){ var tr=e.target.closest('tr'); var cb=tr&&tr.querySelector('.cc-row'); if(cb){ cb.checked=true; refreshN(); } openPayModal(); } });
        document.getElementById('ccCancel').addEventListener('click',function(){ document.getElementById('ccModalBg').style.display='none'; });
        document.getElementById('ccConfirm').addEventListener('click',function(){
          var i=selInfo(); if(!i.rows.length) return;
          var drvSel=document.getElementById('ccDriver').value; var driver=(drvSel==='__other__')?document.getElementById('ccDriverOther').value.trim():drvSel;
          var cash=document.getElementById('ccCash').value; var transfer=document.getElementById('ccTransfer').value; var checks=checksData(); var note=document.getElementById('ccNote').value;
          var payload={icpno:ICPNO,pay_date:PAYDATE,collected_by:driver,cash_amount:cash,transfer_amount:transfer,note:note,sp_nos:i.rows.map(function(r){return r.value;}),checks:checks};
          var btn=this; btn.disabled=true;
          fetch('/admin/cash/collect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(j){
            btn.disabled=false;
            if(!j||!j.ok){ if(window.sfToast)sfToast((j&&j.error)||'登記失敗','err'); return; }
            var chkTot=checks.reduce(function(s,c){return s+Number(c.amount||0);},0); var cashN=Number(cash||0); var trN=Number(transfer||0);
            if(window.sfToast)sfToast('✅ 收款成功，共 '+i.rows.length+' 張・實收 '+money(cashN+trN+chkTot));
            document.getElementById('ccModalBg').style.display='none';
            var rowsHtml=i.rows.map(function(r){return '<tr><td style="font-family:monospace;">'+r.value+'</td><td>'+r.dataset.ctname+'</td><td style="text-align:right;">'+money(r.dataset.due)+'</td></tr>';}).join('');
            window.__lastDetail={company:COMPANY,route:ROUTE,date:PAYDATE,driver:driver||'（未填）',me:ME,rows:i.rows.map(function(r){return {sp:r.value,ct:r.dataset.ctname,due:Number(r.dataset.due||0)};}),cash:cashN,transfer:trN,chk:chkTot,due:i.due,diff:j.diff};
            document.getElementById('ccDetail').innerHTML='<div style="margin-bottom:6px;">客戶 <b>'+i.custName+'</b>　司機 <b>'+(driver||'（未填）')+'</b>　收款人 <b>'+ME+'</b></div>'+
              '<table><thead><tr><th>單號</th><th>客戶</th><th style="text-align:right;">應收</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>'+
              '<div style="margin-top:8px;">應收 <b>'+money(i.due)+'</b>　實收 <b>'+money(cashN+trN+chkTot)+'</b>（現'+money(cashN)+'／匯'+money(trN)+'／票'+money(chkTot)+'）　差額 <b style="color:'+((j.diff<0)?'#c62828':'#2e7d32')+'">'+money(j.diff)+'</b></div>';
            document.getElementById('ccDetailBg').style.display='flex';
          }).catch(function(){ btn.disabled=false; if(window.sfToast)sfToast('登記失敗','err'); });
        });
        document.getElementById('ccDetailClose').addEventListener('click',function(){ location.reload(); });
        // 取消收款
        document.querySelectorAll('.cf-undo').forEach(function(b){ b.addEventListener('click',function(){ if(!confirm('確定取消這筆收款？（相關單退回未收）'))return; fetch('/admin/cash/collect/undo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payment_id:b.dataset.pid})}).then(function(r){return r.json();}).then(function(j){ if(j&&j.ok){location.reload();}else{ if(window.sfToast)sfToast('取消失敗','err'); } }); }); });
        // 產生 JPG（該路線收款清單）
        function drawListJpg(){
          var rows=[].slice.call(document.querySelectorAll('#ccBody tr')).filter(function(tr){ return tr.style.display!=='none'; }).map(function(tr){ var t=tr.querySelectorAll('td'); if(t.length<7) return null; return {sp:t[1].innerText.trim(),ct:t[2].innerText.trim(),rt:t[3].innerText.trim(),due:t[5].innerText.trim(),st:t[6].innerText.trim()}; }).filter(Boolean);
          var W=760, pad=24, lh=26, top=110; var H=top+rows.length*lh+60;
          var cv=document.getElementById('ccCanvas'); cv.width=W; cv.height=H; var g=cv.getContext('2d');
          g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#111';
          g.font='bold 20px "Microsoft JhengHei",sans-serif'; g.fillText(COMPANY+'　收款清單', pad, 34);
          g.font='13px "Microsoft JhengHei",sans-serif'; g.fillStyle='#333';
          g.fillText('路線：'+ROUTE+'　日期：'+PAYDATE+'　收款人：'+ME, pad, 58);
          g.fillText('列印時間：'+new Date().toLocaleString('zh-TW',{hour12:false}), pad, 78);
          g.strokeStyle='#999'; g.beginPath(); g.moveTo(pad,90); g.lineTo(W-pad,90); g.stroke();
          g.font='bold 13px "Microsoft JhengHei",sans-serif'; g.fillStyle='#111';
          g.fillText('單號',pad,top-6); g.fillText('客戶',pad+150,top-6); g.fillText('路線',pad+360,top-6); g.fillText('應收',pad+430,top-6); g.fillText('狀態',pad+560,top-6);
          g.font='13px "Microsoft JhengHei",sans-serif';
          rows.forEach(function(r,idx){ var y=top+idx*lh+14; g.fillStyle=(idx%2)?'#f4f4f4':'#fff'; g.fillRect(pad,y-16,W-2*pad,lh); g.fillStyle='#111';
            g.fillText(r.sp,pad,y); g.fillText(r.ct.slice(0,14),pad+150,y); g.fillText(r.rt,pad+360,y); g.textAlign='right'; g.fillText(r.due,pad+520,y); g.textAlign='left'; g.fillStyle=(r.st.indexOf('未收')>=0)?'#c62828':'#2e7d32'; g.fillText(r.st.replace(/取消/,'').trim(),pad+560,y); g.fillStyle='#111'; });
          var link=document.createElement('a'); link.download='收款清單_'+ROUTE+'_'+PAYDATE+'.jpg'; link.href=cv.toDataURL('image/jpeg',0.92); link.click();
        }
        // 收款明細 JPG：畫「這一筆剛收的款」（不是整條路線），所以不會顯示未收
        function drawDetailJpg(){
          var d=window.__lastDetail; if(!d){ if(window.sfToast)sfToast('無明細可存','err'); return; }
          var W=680, pad=24, lh=26, top=132; var H=top+d.rows.length*lh+90;
          var cv=document.getElementById('ccCanvas'); cv.width=W; cv.height=H; var g=cv.getContext('2d');
          g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#111';
          g.font='bold 20px "Microsoft JhengHei",sans-serif'; g.fillText(d.company+'　收款明細', pad, 34);
          g.font='13px "Microsoft JhengHei",sans-serif'; g.fillStyle='#333';
          g.fillText('日期：'+d.date+'　路線：'+d.route+'　司機：'+d.driver, pad, 58);
          g.fillText('收款人：'+d.me+'　列印：'+new Date().toLocaleString('zh-TW',{hour12:false}), pad, 78);
          g.strokeStyle='#999'; g.beginPath(); g.moveTo(pad,92); g.lineTo(W-pad,92); g.stroke();
          g.font='bold 13px "Microsoft JhengHei",sans-serif'; g.fillStyle='#111';
          g.fillText('單號',pad,top-6); g.fillText('客戶',pad+180,top-6); g.textAlign='right'; g.fillText('應收',pad+430,top-6); g.textAlign='left';
          g.font='13px "Microsoft JhengHei",sans-serif';
          d.rows.forEach(function(r,idx){ var y=top+idx*lh+14; g.fillStyle=(idx%2)?'#f4f4f4':'#fff'; g.fillRect(pad,y-16,W-2*pad,lh); g.fillStyle='#111'; g.fillText(r.sp,pad,y); g.fillText((r.ct||'').slice(0,14),pad+180,y); g.textAlign='right'; g.fillText(money(r.due),pad+430,y); g.textAlign='left'; });
          var yy=top+d.rows.length*lh+24; g.font='bold 14px "Microsoft JhengHei",sans-serif';
          g.fillText('應收 '+money(d.due)+'　實收 '+money(d.cash+(d.transfer||0)+d.chk)+'（現'+money(d.cash)+'／匯'+money(d.transfer||0)+'／票'+money(d.chk)+'）　差額 '+money(d.diff), pad, yy);
          var link=document.createElement('a'); link.download='收款明細_'+d.date+'.jpg'; link.href=cv.toDataURL('image/jpeg',0.92); link.click();
        }
        document.getElementById('ccJpgBtn').addEventListener('click',drawListJpg);
        document.getElementById('ccDetailJpg').addEventListener('click',drawDetailJpg);
        refreshN();
        applyFilter();
      })();</script>`;
            res.type("text/html").send(notionPage("現金收款", body, "cash-collect", res));
        }
        catch (e) {
            console.error("[admin] /cash/collect", e?.message || e);
            res.status(500).type("text/html").send("讀取失敗：" + escapeHtml(String(e?.message || e)));
        }
    });
    // 登記收款
    router.post("/cash/collect", requireCash, express_1.default.json({ limit: "256kb" }), async (req, res) => {
        try {
            const b = req.body || {};
            const icpno = erp_companies_js_1.normIcpno(b.icpno, "00");
            const payDate = cashValidDate(b.pay_date) || getTaipeiCalendarDateYYYYMMDD();
            const collectedBy = String(b.collected_by ?? "").trim();
            const routeLine = String(b.route_line ?? "").trim();
            const note = String(b.note ?? "").trim();
            const cashAmount = cashNum(b.cash_amount);
            const transferAmount = cashNum(b.transfer_amount);
            const spNos = Array.isArray(b.sp_nos) ? Array.from(new Set(b.sp_nos.map((x) => String(x).trim()).filter(Boolean))) : [];
            if (!spNos.length) {
                res.status(400).json({ error: "請至少選一張要收款的銷貨單" });
                return;
            }
            const ph = spNos.map(() => "?").join(",");
            const units = await db.prepare(`SELECT sp_no, doc_date, total, ct_no, ct_name FROM cash_sales_doc WHERE icpno = ? AND sp_no IN (${ph})`).all(icpno, ...spNos) || [];
            const unitMap = new Map(units.map((u) => [u.sp_no, u]));
            // [fix 2026-07-14] 完整性驗證：頁面載入後單被「重新取單」刪掉/改號時，舊版對查無的單
            // 照插 due=0 的 alloc（孤兒分配，日報表對不上帳且畫面上找不到那張單）。改成明確拒絕。
            if (units.length !== spNos.length) {
                const missing = spNos.filter((sp) => !unitMap.has(sp));
                res.status(409).json({ error: "下列單已不存在（可能被重新取單更新），請重整頁面後再收：" + missing.join("、") });
                return;
            }
            // 由勾選的單推客戶：全同一家＝該客戶；跨多家＝標「多客戶(N)」（明細仍逐單留客戶）
            const ctSet = new Map();
            for (const u of units)
                ctSet.set(u.ct_no, u.ct_name);
            const ctNo = ctSet.size === 1 ? (units[0]?.ct_no || "") : "";
            const ctName = ctSet.size === 1 ? (units[0]?.ct_name || "") : `多客戶(${ctSet.size}家)`;
            const already = await db.prepare(`SELECT sp_no FROM cash_payment_alloc WHERE icpno = ? AND sp_no IN (${ph})`).all(icpno, ...spNos) || [];
            if (already.length) {
                res.status(409).json({ error: "下列單已收款過，請先重整：" + already.map((a) => a.sp_no).join("、") });
                return;
            }
            const checkRows = (Array.isArray(b.checks) ? b.checks : [])
                .map((c) => ({ check_no: String(c.check_no ?? "").trim(), bank: String(c.bank ?? "").trim(), due_date: cashValidDate(c.due_date), amount: cashNum(c.amount) }))
                .filter((c) => c.check_no || c.bank || c.amount || c.due_date);
            const checkAmount = checkRows.reduce((s, c) => s + c.amount, 0);
            const dueTotal = spNos.reduce((s, sp) => s + cashNum(unitMap.get(sp)?.total), 0);
            const totalAmount = cashAmount + transferAmount + checkAmount;
            const diff = Math.round((totalAmount - dueTotal) * 100) / 100; // >0 溢收、<0 短收
            const by = (res.locals && res.locals.adminUser) || "";
            const at = new Date().toISOString();
            const payId = (0, id_js_1.newId)("cpay");
            const doIns = async (h) => {
                await h.prepare("INSERT INTO cash_payment (id,icpno,ct_no,ct_name,pay_date,collected_by,route_line,cash_amount,transfer_amount,check_amount,total_amount,due_total,diff,note,recorded_by,recorded_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                    .run(payId, icpno, ctNo, ctName, payDate, collectedBy, routeLine, cashAmount, transferAmount, checkAmount, totalAmount, dueTotal, diff, note, by, at, at);
                for (const sp of spNos) {
                    const u = unitMap.get(sp);
                    await h.prepare("INSERT INTO cash_payment_alloc (id,payment_id,icpno,sp_no,doc_date,due_amount,alloc_amount) VALUES (?,?,?,?,?,?,?)")
                        .run((0, id_js_1.newId)("calc"), payId, icpno, sp, u?.doc_date || "", cashNum(u?.total), cashNum(u?.total));
                }
                for (const c of checkRows) {
                    await h.prepare("INSERT INTO cash_check (id,payment_id,icpno,check_no,bank,due_date,amount,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
                        .run((0, id_js_1.newId)("cchk"), payId, icpno, c.check_no, c.bank, c.due_date, c.amount, "", at);
                }
            };
            if (typeof db.transaction === "function")
                await db.transaction(doIns);
            else
                await doIns(db);
            res.json({ ok: true, payment_id: payId, diff });
        }
        catch (e) {
            const msg = String(e?.message || e);
            // 併發防護：唯一約束擋下同一單重複收款 → 回 409（交易已回滾，不會重複入帳）
            if (/idx_cash_alloc_sp_uniq|UNIQUE constraint failed: cash_payment_alloc|duplicate key value/i.test(msg)) {
                res.status(409).json({ error: "這些單有的剛被收款（可能同時有人在收），請重新整理後再試" });
                return;
            }
            console.error("[admin] /cash/collect POST", e?.message || e);
            res.status(500).json({ error: "收款登記失敗", detail: msg });
        }
    });
    // 取消一筆收款
    router.post("/cash/collect/undo", requireCash, express_1.default.json({ limit: "16kb" }), async (req, res) => {
        try {
            const payId = String(req.body?.payment_id ?? "").trim();
            if (!payId) {
                res.status(400).json({ error: "缺 payment_id" });
                return;
            }
            // [fix 2026-07-14] 金錢操作可稽核：舊版硬刪三表、不存在也回 ok、誰取消了哪筆完全查不到。
            // 改成先快照（payment＋allocs＋checks）寫進 data_change_log 再刪；查無回 404。
            const pay = await db.prepare("SELECT * FROM cash_payment WHERE id = ?").get(payId);
            if (!pay) {
                res.status(404).json({ error: "找不到這筆收款（可能已被取消）" });
                return;
            }
            const allocSnap = await db.prepare("SELECT sp_no, doc_date, due_amount, alloc_amount FROM cash_payment_alloc WHERE payment_id = ?").all(payId) || [];
            const checkSnap = await db.prepare("SELECT check_no, bank, due_date, amount FROM cash_check WHERE payment_id = ?").all(payId) || [];
            await logDataChange(req, {
                entityType: "cash_payment",
                entityId: payId,
                action: "undo_collect",
                summary: `取消收款 ${pay.ct_name || pay.ct_no || ""} ${pay.pay_date} 共 ${pay.total_amount}（${allocSnap.length} 張單退回未收）`,
                meta: { payment: pay, allocs: allocSnap, checks: checkSnap },
            });
            const doDel = async (h) => {
                await h.prepare("DELETE FROM cash_check WHERE payment_id = ?").run(payId);
                await h.prepare("DELETE FROM cash_payment_alloc WHERE payment_id = ?").run(payId);
                await h.prepare("DELETE FROM cash_payment WHERE id = ?").run(payId);
            };
            if (typeof db.transaction === "function")
                await db.transaction(doDel);
            else
                await doDel(db);
            res.json({ ok: true });
        }
        catch (e) {
            console.error("[admin] /cash/collect/undo", e?.message || e);
            res.status(500).json({ error: "取消失敗", detail: String(e?.message || e) });
        }
    });
    // 收款客戶主檔（維護路線／收現金／備註）＋ 司機名單。資料源＝凌越銷貨單帶入的 cash_customer。
    router.get("/cash/customers", requireCash, async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.query.icpno, "00");
            const qs = typeof req.query.q === "string" ? req.query.q.trim() : "";
            const showAll = req.query.all === "1";
            const cutoff = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })();
            const companyOpts = Object.keys(CASH_COMPANIES).map((k) => `<option value="${k}" ${k === icpno ? "selected" : ""}>${escapeHtml(CASH_COMPANIES[k])}(${k})</option>`).join("");
            const cols = "ct_no, name, fkfs, route_line, is_cash, note, last_txn, stop";
            // 有效客戶：未停用 且（最後交易日未知或在一年內）。未知(NULL/空)＝尚未同步過→先顯示，不誤藏。
            const activeCond = showAll ? "" : " AND COALESCE(stop,0)=0 AND (last_txn IS NULL OR last_txn='' OR last_txn >= ?)";
            let rows;
            if (qs) {
                const like = "%" + qs.toLowerCase() + "%";
                const sql = `SELECT ${cols} FROM cash_customer WHERE icpno = ? AND (LOWER(name) LIKE ? OR LOWER(ct_no) LIKE ? OR COALESCE(route_line,'') LIKE ?)` + activeCond + " ORDER BY COALESCE(route_line,''), name";
                const params = showAll ? [icpno, like, like, "%" + qs + "%"] : [icpno, like, like, "%" + qs + "%", cutoff];
                rows = await db.prepare(sql).all(...params) || [];
            }
            else {
                const sql = `SELECT ${cols} FROM cash_customer WHERE icpno = ?` + activeCond + " ORDER BY COALESCE(route_line,''), name";
                const params = showAll ? [icpno] : [icpno, cutoff];
                rows = await db.prepare(sql).all(...params) || [];
            }
            const drvRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("cash_drivers");
            const drivers = String(drvRow?.value || "");
            const tr = (r) => `<tr data-ct="${escapeAttr(r.ct_no)}" data-search="${escapeAttr(((r.name || "") + " " + (r.ct_no || "") + " " + (r.route_line || "")).toLowerCase())}">
          <td style="font-family:ui-monospace,monospace;">${escapeHtml(r.ct_no)}</td>
          <td>${escapeHtml(r.name || "")}${Number(r.stop) ? ` <span style="color:#c62828;font-size:11px;">停用</span>` : ""}</td>
          <td style="background:#fbfbfa;"><input class="cm-route sf-input" value="${escapeAttr(r.route_line || "")}" placeholder="路線" style="width:80px;"></td>
          <td style="color:#787774;">${escapeHtml(r.fkfs || "")}</td>
          <td style="color:#787774;font-size:12px;">${escapeHtml(r.last_txn || "—")}</td>
          <td style="text-align:center;"><input type="checkbox" class="cm-cash" ${Number(r.is_cash) ? "checked" : ""}></td>
          <td><input class="cm-note sf-input" value="${escapeAttr(r.note || "")}" style="width:100%;"></td>
          <td><button type="button" class="sf-btn sf-btn-sm cm-save">存</button></td>
        </tr>`;
            const body = `
      <h1 class="notion-page-title">收款客戶主檔</h1>
      <div class="notion-card" style="margin-bottom:12px;">
        <div style="font-size:13px;color:#787774;margin-bottom:8px;">此主檔由凌越客戶主檔自動帶入（含停用／未綁 LINE 的客戶）。<b>路線優先取凌越送貨地址的 <code>[數字]</code></b>（每次取單自動帶入）；地址沒寫的才需在此手填。</div>
        <form method="get" action="/admin/cash/customers" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
          <label>公司<br><select name="icpno" class="sf-input">${companyOpts}</select></label>
          <label>搜尋<br><input type="text" name="q" value="${escapeAttr(qs)}" placeholder="客戶名／編號／路線" class="sf-input"></label>
          <input type="hidden" name="all" value="${showAll ? "1" : ""}">
          <button type="submit" class="btn-primary">查詢</button>
          <a class="sf-btn" href="/admin/cash/customers?icpno=${icpno}${qs ? "&q=" + encodeURIComponent(qs) : ""}${showAll ? "" : "&all=1"}">${showAll ? "只看有效客戶" : "顯示全部（含停用/舊客戶）"}</a>
        </form>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;border-top:1px solid #eee;padding-top:10px;">
          <label style="flex:1;min-width:240px;">司機名單（逗號分隔，收款彈窗會用）<br><input type="text" id="cmDrivers" class="sf-input" value="${escapeAttr(drivers)}" placeholder="例：阿明,阿華,老王" style="width:100%;"></label>
          <button type="button" class="btn-primary" id="cmDrvSave">儲存司機名單</button>
          <button type="button" class="sf-btn" id="cmImportRoutes" title="把 LINE 客戶管理已填的路線，依凌越客戶編號帶進這裡的空白路線">從客戶管理帶入路線</button>
        </div>
      </div>
      <div class="notion-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          <div style="color:#787774;font-size:13px;">共 <span id="cmCount">${rows.length}</span> 家${qs ? "（篩選後）" : ""}${showAll ? "（含停用/舊客戶）" : "（僅有效客戶：未停用且一年內有交易）"}${(!showAll && rows.filter((r) => !r.last_txn).length) ? `<br><span style="color:#c62828;">⚠ 其中 ${rows.filter((r) => !r.last_txn).length} 家「最後交易日」未同步（顯示為 —），需用<b>新版 ly_sales_push.py</b>「立即取單」後才能依交易日過濾舊客戶。</span>` : ""}</div>
          <div style="position:relative;width:260px;max-width:100%;">
            <input type="text" id="cmFilter" class="sf-input" placeholder="即時搜尋（客戶名／編號／路線）" style="width:100%;padding-left:28px;">
            <span style="position:absolute;left:8px;top:10px;color:var(--txt-3);">${SF_ICONS.search}</span>
          </div>
        </div>
        <table><thead><tr><th>客戶編號</th><th>客戶名稱</th><th style="background:#eef3fb;">路線</th><th>結帳方式</th><th>最後交易</th><th style="text-align:center;">收現金</th><th>備註</th><th></th></tr></thead>
        <tbody id="cmBody">${rows.map(tr).join("") || `<tr><td colspan="8" style="text-align:center;color:#9b9a97;padding:16px;">尚無客戶資料——內網「立即取單」推過（新版腳本）後就會帶入。</td></tr>`}</tbody></table>
      </div>
      <script>(function(){
        var ICPNO=${JSON.stringify(icpno)};
        var flt=document.getElementById('cmFilter');
        if(flt){ flt.addEventListener('input',function(){
          var q=this.value.trim().toLowerCase(); var rows=document.querySelectorAll('#cmBody tr'); var n=0;
          rows.forEach(function(tr){ var s=tr.getAttribute('data-search')||''; var hit=!q||s.indexOf(q)>=0; tr.style.display=hit?'':'none'; if(hit&&tr.dataset.ct)n++; });
          var c=document.getElementById('cmCount'); if(c)c.textContent=n;
        }); }
        document.querySelectorAll('.cm-save').forEach(function(b){ b.addEventListener('click',function(){
          var tr=b.closest('tr');
          var payload={icpno:ICPNO,ct_no:tr.dataset.ct,route_line:tr.querySelector('.cm-route').value,is_cash:tr.querySelector('.cm-cash').checked?1:0,note:tr.querySelector('.cm-note').value};
          b.disabled=true;
          fetch('/admin/cash/customers/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(j){ b.disabled=false; if(j&&j.ok){ if(window.sfToast)sfToast('已儲存'); b.textContent='✓'; setTimeout(function(){b.textContent='存';},1200);} else { if(window.sfToast)sfToast('儲存失敗','err'); } }).catch(function(){ b.disabled=false; if(window.sfToast)sfToast('儲存失敗','err'); });
        }); });
        document.getElementById('cmDrvSave').addEventListener('click',function(){
          var v=document.getElementById('cmDrivers').value;
          fetch('/admin/cash/drivers/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({drivers:v})}).then(function(r){return r.json();}).then(function(j){ if(j&&j.ok){ if(window.sfToast)sfToast('司機名單已儲存'); } else { if(window.sfToast)sfToast('儲存失敗','err'); } });
        });
        document.getElementById('cmImportRoutes').addEventListener('click',function(){
          if(!confirm('把 LINE 客戶管理已填的路線，帶進「路線空白」的收款客戶？（已填的不會被覆蓋）')) return;
          var b=this; b.disabled=true;
          fetch('/admin/cash/customers/import-routes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({icpno:ICPNO})}).then(function(r){return r.json();}).then(function(j){ b.disabled=false; if(j&&j.ok){ if(window.sfToast)sfToast('已帶入 '+j.updated+' 家路線'); location.reload(); } else { if(window.sfToast)sfToast((j&&j.error)||'帶入失敗','err'); } }).catch(function(){ b.disabled=false; if(window.sfToast)sfToast('帶入失敗','err'); });
        });
      })();</script>`;
            res.type("text/html").send(notionPage("收款客戶主檔", body, "cash-customers", res));
        }
        catch (e) {
            console.error("[admin] /cash/customers", e?.message || e);
            res.status(500).type("text/html").send("讀取失敗：" + escapeHtml(String(e?.message || e)));
        }
    });
    router.post("/cash/customers/save", requireCash, express_1.default.json({ limit: "32kb" }), async (req, res) => {
        try {
            const b = req.body || {};
            const icpno = erp_companies_js_1.normIcpno(b.icpno, "00");
            const ctNo = String(b.ct_no ?? "").trim();
            if (!ctNo) {
                res.status(400).json({ error: "缺 ct_no" });
                return;
            }
            const routeLine = String(b.route_line ?? "").trim();
            const isCash = b.is_cash ? 1 : 0;
            const note = String(b.note ?? "").trim();
            const at = new Date().toISOString();
            await db.prepare("INSERT INTO cash_customer (icpno, ct_no, route_line, is_cash, note, updated_at) VALUES (?,?,?,?,?,?) " +
                "ON CONFLICT (icpno, ct_no) DO UPDATE SET route_line = excluded.route_line, is_cash = excluded.is_cash, note = excluded.note, updated_at = excluded.updated_at").run(icpno, ctNo, routeLine, isCash, note, at);
            res.json({ ok: true });
        }
        catch (e) {
            console.error("[admin] /cash/customers/save", e?.message || e);
            res.status(500).json({ error: "儲存失敗", detail: String(e?.message || e) });
        }
    });
    router.post("/cash/drivers/save", requireCash, express_1.default.json({ limit: "8kb" }), async (req, res) => {
        try {
            const list = String(req.body?.drivers ?? "").split(",").map((s) => s.trim()).filter(Boolean).join(",");
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_drivers", list);
            res.json({ ok: true });
        }
        catch (e) {
            console.error("[admin] /cash/drivers/save", e?.message || e);
            res.status(500).json({ error: "儲存失敗", detail: String(e?.message || e) });
        }
    });
    // 從 LINE 客戶管理帶入路線：依凌越客戶編號(CT_NO)對 hq_cust_code/teraoka_code，填進路線空白的收款客戶（不覆蓋已填）
    router.post("/cash/customers/import-routes", requireCash, express_1.default.json({ limit: "8kb" }), async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.body?.icpno, "00");
            const r = await db.prepare("UPDATE cash_customer SET route_line = (" +
                "SELECT CAST(c.route_line AS TEXT) FROM customers c WHERE (c.hq_cust_code = cash_customer.ct_no OR c.teraoka_code = cash_customer.ct_no) AND c.route_line IS NOT NULL LIMIT 1" +
                ") WHERE icpno = ? AND COALESCE(route_line,'') = '' AND EXISTS (" +
                "SELECT 1 FROM customers c WHERE (c.hq_cust_code = cash_customer.ct_no OR c.teraoka_code = cash_customer.ct_no) AND c.route_line IS NOT NULL)").run(icpno);
            res.json({ ok: true, updated: (r && r.changes) || 0 });
        }
        catch (e) {
            console.error("[admin] /cash/customers/import-routes", e?.message || e);
            res.status(500).json({ error: "帶入失敗", detail: String(e?.message || e) });
        }
    });
    // ============================================================
    //  現金日報表（Phase2 步驟2）：當日收款（現金/票分列）＋額外收入＋應收/實收總計
    // ============================================================
    async function loadDailyReport(icpno, date) {
        const payments = await db.prepare("SELECT id, ct_no, ct_name, collected_by, cash_amount, transfer_amount, check_amount, total_amount, due_total, diff, note, recorded_by FROM cash_payment WHERE icpno = ? AND pay_date = ? ORDER BY COALESCE(collected_by,''), recorded_at").all(icpno, date) || [];
        // 每筆收款對應的銷貨單（日期/單號/金額），供日報表逐單顯示與多筆對帳
        const allocs = await db.prepare("SELECT a.payment_id, a.sp_no, a.doc_date, a.due_amount FROM cash_payment_alloc a JOIN cash_payment p ON p.id = a.payment_id WHERE a.icpno = ? AND p.pay_date = ? ORDER BY a.doc_date, a.sp_no").all(icpno, date) || [];
        const allocByPay = new Map();
        for (const al of allocs) {
            const arr = allocByPay.get(al.payment_id) || [];
            arr.push(al);
            allocByPay.set(al.payment_id, arr);
        }
        for (const p of payments)
            p.allocs = allocByPay.get(p.id) || [];
        const checks = await db.prepare("SELECT ch.check_no, ch.bank, ch.due_date, ch.amount, p.ct_name, p.collected_by FROM cash_check ch JOIN cash_payment p ON p.id = ch.payment_id WHERE ch.icpno = ? AND p.pay_date = ? ORDER BY ch.due_date, ch.check_no").all(icpno, date) || [];
        const extra = await db.prepare("SELECT id, item, amount, method, collected_by, note FROM cash_extra_income WHERE icpno = ? AND income_date = ? ORDER BY created_at").all(icpno, date) || [];
        const ds = await db.prepare("SELECT COALESCE(SUM(total),0) AS t FROM cash_sales_doc WHERE icpno = ? AND doc_date = ?").get(icpno, date);
        const sum = (arr, f) => arr.reduce((s, r) => s + Number(r[f] || 0), 0);
        const t = {
            due: sum(payments, "due_total"),
            cash: sum(payments, "cash_amount"),
            transfer: sum(payments, "transfer_amount"),
            check: sum(payments, "check_amount"),
            received: sum(payments, "total_amount"),
            diff: sum(payments, "diff"),
            extra: sum(extra, "amount"),
            daySales: Number(ds?.t || 0),
        };
        // 司機小計
        const byDriver = new Map();
        for (const p of payments) {
            const who = String(p.collected_by || "").trim() || "（未填）";
            if (!byDriver.has(who))
                byDriver.set(who, { cash: 0, transfer: 0, check: 0, received: 0, c: 0 });
            const a = byDriver.get(who);
            a.cash += Number(p.cash_amount || 0);
            a.transfer += Number(p.transfer_amount || 0);
            a.check += Number(p.check_amount || 0);
            a.received += Number(p.total_amount || 0);
            a.c++;
        }
        return { payments, checks, extra, t, byDriver };
    }
    router.get("/cash/daily-report", requireCash, async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.query.icpno, "00");
            const date = cashValidDate(req.query.date) || getTaipeiCalendarDateYYYYMMDD();
            const d = await loadDailyReport(icpno, date);
            const me = (res.locals && res.locals.adminUser) || "";
            const companyOpts = Object.keys(CASH_COMPANIES).map((k) => `<option value="${k}" ${k === icpno ? "selected" : ""}>${escapeHtml(CASH_COMPANIES[k])}(${k})</option>`).join("");
            const diffTxt = (n) => Number(n) === 0 ? "0" : (Number(n) > 0 ? `+${cashMoney(n)}（溢收）` : `${cashMoney(n)}（短收）`);
            const allocLineHtml = (p) => (p.allocs || []).map((a) => `${escapeHtml(a.sp_no)} <span style="color:#9b9a97;">${escapeHtml(String(a.doc_date || "").slice(0, 10))}</span> ${cashMoney(a.due_amount)}`).join("<br>");
            const autoNoteHtml = (p) => { const n = (p.allocs || []).length; const base = p.note ? escapeHtml(p.note) : ""; if (n > 1) { const nos = (p.allocs || []).map((a) => a.sp_no).join("、"); return (base ? base + "　" : "") + `<span style="color:#787774;">共 ${n} 筆：${escapeHtml(nos)}</span>`; } return base; };
            const payRows = d.payments.length ? d.payments.map((p) => `<tr>
          <td>${escapeHtml(p.ct_name || p.ct_no || "")}<div style="color:#787774;font-size:11px;margin-top:2px;">${allocLineHtml(p)}</div></td>
          <td>${escapeHtml(p.collected_by || "")}</td>
          <td style="text-align:right;">${cashMoney(p.due_total)}</td>
          <td style="text-align:right;">${cashMoney(p.cash_amount)}</td>
          <td style="text-align:right;">${cashMoney(p.transfer_amount)}</td>
          <td style="text-align:right;">${cashMoney(p.check_amount)}</td>
          <td style="text-align:right;font-weight:600;">${cashMoney(p.total_amount)}</td>
          <td style="text-align:right;color:${Number(p.diff) < 0 ? "#c62828" : "#2e7d32"};">${Number(p.diff) === 0 ? "" : diffTxt(p.diff)}</td>
          <td>${autoNoteHtml(p)}</td>
        </tr>`).join("") : `<tr><td colspan="9" style="text-align:center;color:#9b9a97;padding:16px;">當日尚無收款紀錄。</td></tr>`;
            const checkRows = d.checks.length ? d.checks.map((c) => `<tr>
          <td style="font-family:ui-monospace,monospace;">${escapeHtml(c.check_no || "")}</td>
          <td>${escapeHtml(c.bank || "")}</td>
          <td>${escapeHtml(String(c.due_date || "").slice(0, 10))}</td>
          <td style="text-align:right;">${cashMoney(c.amount)}</td>
          <td>${escapeHtml(c.ct_name || "")}</td>
        </tr>`).join("") : `<tr><td colspan="5" style="text-align:center;color:#9b9a97;padding:12px;">當日無票據。</td></tr>`;
            const extraRows = d.extra.length ? d.extra.map((e) => `<tr data-id="${escapeAttr(e.id)}">
          <td>${escapeHtml(e.item || "")}</td>
          <td style="text-align:right;">${cashMoney(e.amount)}</td>
          <td>${escapeHtml(cashMethodLabel(e.method))}</td>
          <td>${escapeHtml(e.collected_by || "")}</td>
          <td>${escapeHtml(e.note || "")}</td>
          <td><button type="button" class="link-undo ei-del" data-id="${escapeAttr(e.id)}">刪</button></td>
        </tr>`).join("") : `<tr><td colspan="6" style="text-align:center;color:#9b9a97;padding:12px;">無額外收入。</td></tr>`;
            const driverRows = Array.from(d.byDriver.entries()).map(([who, a]) => `<tr><td>${escapeHtml(who)}</td><td style="text-align:right;">${cashMoney(a.cash)}</td><td style="text-align:right;">${cashMoney(a.transfer)}</td><td style="text-align:right;">${cashMoney(a.check)}</td><td style="text-align:right;font-weight:600;">${cashMoney(a.received)}</td><td style="text-align:right;">${a.c}</td></tr>`).join("");
            const q = `?icpno=${icpno}&date=${date}`;
            const body = `
      <style>.link-undo{background:none;border:none;color:#c62828;cursor:pointer;text-decoration:underline;padding:0;font-size:12px;}</style>
      <h1 class="notion-page-title">現金收款</h1>
      <div style="display:flex;gap:4px;margin:0 0 14px;">
        <a href="/admin/cash/collect?icpno=${icpno}&date=${date}" style="padding:6px 16px;border-radius:8px 8px 0 0;text-decoration:none;font-weight:600;background:#f1f0ee;color:#37352f;">收款</a>
        <a href="/admin/cash/daily-report?icpno=${icpno}&date=${date}" style="padding:6px 16px;border-radius:8px 8px 0 0;text-decoration:none;font-weight:600;background:#2383e2;color:#fff;">現金日報表</a>
      </div>
      <div class="notion-card" style="margin-bottom:12px;">
        <form method="get" action="/admin/cash/daily-report" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
          <label>公司<br><select name="icpno" class="sf-input">${companyOpts}</select></label>
          <label>日期<br><input type="date" name="date" value="${date}" class="sf-input"></label>
          <button type="submit" class="btn-primary">查詢</button>
          <span style="flex:1;"></span>
          <a class="sf-btn" href="/admin/cash/collect?icpno=${icpno}&date=${date}">← 收款處</a>
          <a class="sf-btn" href="/admin/cash/daily-report/export.xlsx${q}">下載 Excel</a>
          <a class="sf-btn" href="/admin/cash/daily-report/print${q}" target="_blank">列印 / PDF</a>
        </form>
      </div>
      <div class="notion-card" style="margin-bottom:12px;display:flex;gap:20px;flex-wrap:wrap;">
        <div>應收合計<br><strong style="font-size:20px;">${cashMoney(d.t.due)}</strong></div>
        <div>現金<br><strong style="font-size:20px;">${cashMoney(d.t.cash)}</strong></div>
        <div>匯款<br><strong style="font-size:20px;">${cashMoney(d.t.transfer)}</strong></div>
        <div>票<br><strong style="font-size:20px;">${cashMoney(d.t.check)}</strong></div>
        <div>額外收入<br><strong style="font-size:20px;">${cashMoney(d.t.extra)}</strong></div>
        <div>實收合計（現金+匯款+票+額外）<br><strong style="font-size:20px;color:#2383e2;">${cashMoney(d.t.received + d.t.extra)}</strong></div>
        <div>短收／溢收<br><strong style="font-size:20px;color:${d.t.diff < 0 ? "#c62828" : "#2e7d32"};">${diffTxt(d.t.diff)}</strong></div>
      </div>
      <div class="notion-card" style="margin-bottom:12px;">
        <strong>司機小計</strong>
        ${driverRows ? `<table style="margin-top:6px;"><thead><tr><th>收款人/司機</th><th style="text-align:right;">現金</th><th style="text-align:right;">匯款</th><th style="text-align:right;">票</th><th style="text-align:right;">合計</th><th style="text-align:right;">筆數</th></tr></thead><tbody>${driverRows}</tbody></table>` : `<div style="color:#9b9a97;margin-top:6px;">今日尚無收款。</div>`}
      </div>
      <div class="notion-card" style="margin-bottom:12px;">
        <strong>收款明細</strong>
        <table style="margin-top:6px;"><thead><tr><th>客戶</th><th>收款人</th><th style="text-align:right;">應收</th><th style="text-align:right;">現金</th><th style="text-align:right;">匯款</th><th style="text-align:right;">票</th><th style="text-align:right;">實收</th><th style="text-align:right;">短溢收</th><th>備註</th></tr></thead><tbody>${payRows}</tbody></table>
      </div>
      <div class="notion-card" style="margin-bottom:12px;">
        <strong>票據明細</strong>
        <table style="margin-top:6px;"><thead><tr><th>票號</th><th>銀行/分行</th><th>到期日</th><th style="text-align:right;">金額</th><th>客戶</th></tr></thead><tbody>${checkRows}</tbody></table>
      </div>
      <div class="notion-card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;"><strong>額外收入（非銷貨單的款）</strong><span style="color:#787774;">合計 ${cashMoney(d.t.extra)}</span></div>
        <table style="margin-top:6px;"><thead><tr><th>項目</th><th style="text-align:right;">金額</th><th>入帳方式</th><th>收款人</th><th>備註</th><th></th></tr></thead><tbody id="eiBody">${extraRows}</tbody></table>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;border-top:1px dashed #ddd;padding-top:8px;">
          <label>項目<br><input type="text" id="eiItem" class="sf-input" style="width:160px;"></label>
          <label>金額<br><input type="number" id="eiAmount" class="sf-input" style="width:110px;"></label>
          <label>入帳方式<br><select id="eiMethod" class="sf-input" style="width:110px;"><option value="cash">現金</option><option value="transfer">匯款</option><option value="check">票</option></select></label>
          <label>收款人<br><input type="text" id="eiBy" class="sf-input" value="${escapeAttr(me)}" style="width:110px;"></label>
          <label style="flex:1;min-width:140px;">備註<br><input type="text" id="eiNote" class="sf-input" style="width:100%;"></label>
          <button type="button" class="btn-primary" id="eiAdd">新增額外收入</button>
        </div>
      </div>
      <div style="color:#787774;font-size:12px;margin-bottom:20px;">列印人：${escapeHtml(me)}</div>
      <script>(function(){
        var ICPNO=${JSON.stringify(icpno)}, DATE=${JSON.stringify(date)};
        document.getElementById('eiAdd').addEventListener('click',function(){
          var item=document.getElementById('eiItem').value.trim(); var amt=document.getElementById('eiAmount').value;
          if(!item||!amt){ if(window.sfToast)sfToast('請填項目與金額','err'); return; }
          var b=this; b.disabled=true;
          fetch('/admin/cash/extra-income',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({icpno:ICPNO,income_date:DATE,item:item,amount:amt,method:document.getElementById('eiMethod').value,collected_by:document.getElementById('eiBy').value,note:document.getElementById('eiNote').value})}).then(function(r){return r.json();}).then(function(j){ b.disabled=false; if(j&&j.ok){ location.reload(); } else { if(window.sfToast)sfToast('新增失敗','err'); } }).catch(function(){ b.disabled=false; if(window.sfToast)sfToast('新增失敗','err'); });
        });
        document.querySelectorAll('.ei-del').forEach(function(b){ b.addEventListener('click',function(){ if(!confirm('刪除這筆額外收入？'))return; fetch('/admin/cash/extra-income/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.id})}).then(function(r){return r.json();}).then(function(j){ if(j&&j.ok){location.reload();}else{ if(window.sfToast)sfToast('刪除失敗','err'); } }); }); });
      })();</script>`;
            res.type("text/html").send(notionPage("現金日報表", body, "cash-collect", res));
        }
        catch (e) {
            console.error("[admin] /cash/daily-report", e?.message || e);
            res.status(500).type("text/html").send("讀取失敗：" + escapeHtml(String(e?.message || e)));
        }
    });
    router.post("/cash/extra-income", requireCash, express_1.default.json({ limit: "16kb" }), async (req, res) => {
        try {
            const b = req.body || {};
            const icpno = erp_companies_js_1.normIcpno(b.icpno, "00");
            const date = cashValidDate(b.income_date) || getTaipeiCalendarDateYYYYMMDD();
            const item = String(b.item ?? "").trim();
            const amount = cashNum(b.amount);
            if (!item || !amount) {
                res.status(400).json({ error: "請填項目與金額" });
                return;
            }
            const method = (["cash", "transfer", "check"].includes(String(b.method ?? "").trim()) ? String(b.method).trim() : "cash");
            // [fix 2026-07-14] 重送冪等：手動入帳無唯一鍵可擋（銷貨收款有 idx_cash_alloc_sp_uniq、
            // 這裡沒有），網路逾時重按/請求重送會重複入帳。15 秒內完全相同的一筆視為重複送出，
            // 直接回 ok（刻意連續入兩筆相同金額的正常情境，間隔必然超過 15 秒）。
            try {
                const dupWindow = new Date(Date.now() - 15000).toISOString();
                const dup = await db.prepare("SELECT id FROM cash_extra_income WHERE icpno = ? AND income_date = ? AND item = ? AND amount = ? AND method = ? AND COALESCE(collected_by,'') = ? AND created_at > ? LIMIT 1")
                    .get(icpno, date, item, amount, method, String(b.collected_by ?? "").trim(), dupWindow);
                if (dup) {
                    res.json({ ok: true, dedup: true });
                    return;
                }
            } catch (_) { /* 查重失敗照常入帳 */ }
            await db.prepare("INSERT INTO cash_extra_income (id, icpno, income_date, item, amount, method, collected_by, note, recorded_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
                .run((0, id_js_1.newId)("cei"), icpno, date, item, amount, method, String(b.collected_by ?? "").trim(), String(b.note ?? "").trim(), (res.locals && res.locals.adminUser) || "", new Date().toISOString());
            res.json({ ok: true });
        }
        catch (e) {
            console.error("[admin] /cash/extra-income", e?.message || e);
            res.status(500).json({ error: "新增失敗", detail: String(e?.message || e) });
        }
    });
    router.post("/cash/extra-income/delete", requireCash, express_1.default.json({ limit: "8kb" }), async (req, res) => {
        try {
            const id = String(req.body?.id ?? "").trim();
            if (!id) {
                res.status(400).json({ error: "缺 id" });
                return;
            }
            await db.prepare("DELETE FROM cash_extra_income WHERE id = ?").run(id);
            res.json({ ok: true });
        }
        catch (e) {
            console.error("[admin] /cash/extra-income/delete", e?.message || e);
            res.status(500).json({ error: "刪除失敗", detail: String(e?.message || e) });
        }
    });
    router.get("/cash/daily-report/export.xlsx", requireCash, async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.query.icpno, "00");
            const date = cashValidDate(req.query.date) || getTaipeiCalendarDateYYYYMMDD();
            const d = await loadDailyReport(icpno, date);
            const printedBy = (res.locals && res.locals.adminUser) || "";
            const aoa = [
                ["松富物流股份有限公司　現金日報表"],
                [`公司：${CASH_COMPANIES[icpno] || icpno}(${icpno})`, `日期：${date}`, `列印人：${printedBy}`],
                [],
                ["客戶", "收款人", "應收", "現金", "匯款", "票", "實收", "短溢收", "備註", "銷貨單明細（單號 日期 金額）"],
            ];
            for (const p of d.payments) {
                const detail = (p.allocs || []).map((a) => `${a.sp_no} ${String(a.doc_date || "").slice(0, 10)} ${Number(a.due_amount || 0)}`).join(" ; ");
                const noteN = (p.allocs || []).length > 1 ? ((p.note ? p.note + " " : "") + "共" + (p.allocs || []).length + "筆") : (p.note || "");
                aoa.push([p.ct_name || p.ct_no || "", p.collected_by || "", Number(p.due_total || 0), Number(p.cash_amount || 0), Number(p.transfer_amount || 0), Number(p.check_amount || 0), Number(p.total_amount || 0), Number(p.diff || 0), noteN, detail]);
            }
            aoa.push(["合計", "", d.t.due, d.t.cash, d.t.transfer, d.t.check, d.t.received, d.t.diff, "", ""]);
            aoa.push([]);
            aoa.push(["票據明細", "票號", "銀行/分行", "到期日", "金額", "客戶"]);
            for (const c of d.checks)
                aoa.push(["", c.check_no || "", c.bank || "", String(c.due_date || "").slice(0, 10), Number(c.amount || 0), c.ct_name || ""]);
            aoa.push([]);
            aoa.push(["額外收入", "項目", "金額", "入帳方式", "收款人", "備註"]);
            for (const e of d.extra)
                aoa.push(["", e.item || "", Number(e.amount || 0), cashMethodLabel(e.method), e.collected_by || "", e.note || ""]);
            aoa.push(["額外收入合計", "", d.t.extra]);
            aoa.push([]);
            aoa.push(["實收合計（現金+匯款+票+額外）", d.t.received + d.t.extra]);
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "現金日報表");
            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="cash_daily_${icpno}_${date}.xlsx"`);
            res.send(buf);
        }
        catch (e) {
            console.error("[admin] /cash/daily-report/export.xlsx", e?.message || e);
            res.status(500).send("匯出失敗：" + escapeHtml(String(e?.message || e)));
        }
    });
    router.get("/cash/daily-report/print", requireCash, async (req, res) => {
        try {
            const icpno = erp_companies_js_1.normIcpno(req.query.icpno, "00");
            const date = cashValidDate(req.query.date) || getTaipeiCalendarDateYYYYMMDD();
            const d = await loadDailyReport(icpno, date);
            const printedBy = (res.locals && res.locals.adminUser) || "";
            const printedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
            const diffTxt = (n) => Number(n) === 0 ? "0" : (Number(n) > 0 ? `+${cashMoney(n)}` : `${cashMoney(n)}`);
            const pAllocs = (p) => (p.allocs || []).map((a) => `${escapeHtml(a.sp_no)} ${escapeHtml(String(a.doc_date || "").slice(0, 10))} ${cashMoney(a.due_amount)}`).join("<br>");
            const pNote = (p) => { const n = (p.allocs || []).length; const base = p.note ? escapeHtml(p.note) : ""; if (n > 1) return (base ? base + "　" : "") + "共 " + n + " 筆"; return base; };
            const payRows = d.payments.map((p) => `<tr><td>${escapeHtml(p.ct_name || p.ct_no || "")}<div style="color:#666;font-size:10px;">${pAllocs(p)}</div></td><td>${escapeHtml(p.collected_by || "")}</td><td class="r">${cashMoney(p.due_total)}</td><td class="r">${cashMoney(p.cash_amount)}</td><td class="r">${cashMoney(p.transfer_amount)}</td><td class="r">${cashMoney(p.check_amount)}</td><td class="r">${cashMoney(p.total_amount)}</td><td class="r">${Number(p.diff) === 0 ? "" : diffTxt(p.diff)}</td><td>${pNote(p)}</td></tr>`).join("");
            const checkRows = d.checks.map((c) => `<tr><td class="mono">${escapeHtml(c.check_no || "")}</td><td>${escapeHtml(c.bank || "")}</td><td>${escapeHtml(String(c.due_date || "").slice(0, 10))}</td><td class="r">${cashMoney(c.amount)}</td><td>${escapeHtml(c.ct_name || "")}</td></tr>`).join("");
            const extraRows = d.extra.map((e) => `<tr><td>${escapeHtml(e.item || "")}</td><td class="r">${cashMoney(e.amount)}</td><td>${escapeHtml(cashMethodLabel(e.method))}</td><td>${escapeHtml(e.collected_by || "")}</td><td>${escapeHtml(e.note || "")}</td></tr>`).join("");
            res.type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>現金日報表 ${date}</title>
      <style>*{box-sizing:border-box;}body{font-family:'Noto Sans TC',ui-sans-serif,sans-serif;color:#111;margin:24px;}
      h1{font-size:20px;margin:0 0 2px;text-align:center;}.sub-h{text-align:center;font-size:15px;margin:0 0 4px;}
      .meta{display:flex;justify-content:space-between;font-size:12px;color:#333;margin:8px 0;border-bottom:1px solid #999;padding-bottom:6px;}
      h3{font-size:14px;margin:14px 0 4px;}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px;}th,td{border:1px solid #bbb;padding:4px 6px;}th{background:#f0f0f0;}
      td.r,th.r{text-align:right;}td.mono{font-family:ui-monospace,monospace;}
      .tot{background:#fff3cd;font-weight:700;}.btns{margin:12px 0;}@media print{.btns{display:none;}}</style></head><body>
      <div class="btns"><button onclick="window.print()">列印 / 另存 PDF</button></div>
      <h1>松富物流股份有限公司</h1><div class="sub-h">現金日報表</div>
      <div class="meta"><span>公司：${escapeHtml(CASH_COMPANIES[icpno] || icpno)}(${icpno})</span><span>日期：${date}</span><span>列印人：${escapeHtml(printedBy)}</span><span>列印時間：${escapeHtml(printedAt)}</span></div>
      <h3>收款明細</h3>
      <table><thead><tr><th>客戶</th><th>收款人</th><th class="r">應收</th><th class="r">現金</th><th class="r">匯款</th><th class="r">票</th><th class="r">實收</th><th class="r">短溢收</th><th>備註</th></tr></thead>
      <tbody>${payRows || `<tr><td colspan="9" style="text-align:center;">無</td></tr>`}
      <tr class="tot"><td colspan="2">合計</td><td class="r">${cashMoney(d.t.due)}</td><td class="r">${cashMoney(d.t.cash)}</td><td class="r">${cashMoney(d.t.transfer)}</td><td class="r">${cashMoney(d.t.check)}</td><td class="r">${cashMoney(d.t.received)}</td><td class="r">${diffTxt(d.t.diff)}</td><td></td></tr></tbody></table>
      <h3>票據明細</h3>
      <table><thead><tr><th>票號</th><th>銀行/分行</th><th>到期日</th><th class="r">金額</th><th>客戶</th></tr></thead><tbody>${checkRows || `<tr><td colspan="5" style="text-align:center;">無</td></tr>`}</tbody></table>
      <h3>額外收入</h3>
      <table><thead><tr><th>項目</th><th class="r">金額</th><th>入帳方式</th><th>收款人</th><th>備註</th></tr></thead><tbody>${extraRows || `<tr><td colspan="5" style="text-align:center;">無</td></tr>`}
      <tr class="tot"><td>合計</td><td class="r">${cashMoney(d.t.extra)}</td><td colspan="3"></td></tr></tbody></table>
      <h3>總計</h3>
      <table><tbody><tr class="tot"><td>實收合計（現金＋匯款＋票＋額外收入）</td><td class="r">${cashMoney(d.t.received + d.t.extra)}</td></tr>
      <tr><td>其中現金</td><td class="r">${cashMoney(d.t.cash)}</td></tr><tr><td>其中匯款</td><td class="r">${cashMoney(d.t.transfer)}</td></tr><tr><td>其中票</td><td class="r">${cashMoney(d.t.check)}</td></tr>
      <tr><td>額外收入</td><td class="r">${cashMoney(d.t.extra)}</td></tr><tr><td>應收合計／短溢收</td><td class="r">${cashMoney(d.t.due)}　/　${diffTxt(d.t.diff)}</td></tr></tbody></table>
      </body></html>`);
        }
        catch (e) {
            console.error("[admin] /cash/daily-report/print", e?.message || e);
            res.status(500).send("列印頁失敗：" + escapeHtml(String(e?.message || e)));
        }
    });
}
