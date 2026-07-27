"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBasketsRoutes = registerBasketsRoutes;

// 空籃記帳域（v2 多規格分項：月表/明細 API/刪除整天/xlsx 匯出/群組清單匯出）路由：
// 自 index.js 拆出（拆檔批次 7），純搬移、行為不變。

const express_1 = { default: require("express") };
const XLSX = require("xlsx");
const id_js_1 = require("../lib/id.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerBasketsRoutes(router, ctx) {
    const { db, notionPage, getTaipeiCalendarDateYYYYMMDD } = ctx;
    // ── 空籃記帳（v2：多規格分項，司機透過 LIFF 記帳） ─────────────
    function currentTwYM() {
        const tw = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
        return tw.toISOString().slice(0, 7);
    }
    function monthRange(ym) {
        const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
        const start = `${ym}-01`;
        const nextY = m === 12 ? y + 1 : y;
        const nextM = m === 12 ? 1 : m + 1;
        const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
        return { start, end };
    }
    function escapeHtmlBsk(s) {
        return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
    }
    function formatBasketLineForCell(line) {
        const kind = line.basket_kind;
        const label = kind === "numbered" ? `${line.basket_no}號` : (kind === "square" ? "四角" : "圓");
        return `${label} 去${line.taken_to}回${line.picked_up}`;
    }
    function safeParseJson(s) {
        if (!s) return [];
        try { const v = typeof s === "string" ? JSON.parse(s) : s; return Array.isArray(v) ? v : []; }
        catch (_) { return []; }
    }
    router.get("/baskets", async (req, res) => {
        try {
            const ymRaw = typeof req.query.ym === "string" ? req.query.ym.trim() : "";
            const ym = /^\d{4}-\d{2}$/.test(ymRaw) ? ymRaw : currentTwYM();
            const { start, end } = monthRange(ym);
            const customers = await db.prepare("SELECT id, name FROM customers WHERE (active IS NULL OR active = 1) ORDER BY name ASC").all();
            const custMap = new Map(customers.map((c) => [c.id, c]));
            const logs = await db.prepare(
                "SELECT id, customer_id, log_date, taken_to, picked_up, reporter_display_name, updated_at " +
                "FROM basket_logs WHERE log_date >= ? AND log_date < ? ORDER BY log_date ASC"
            ).all(start, end);
            // 一次撈當月所有分項，groupBy log_id
            const logIds = logs.map(l => l.id);
            const linesByLogId = new Map();
            if (logIds.length) {
                const ph = logIds.map(() => "?").join(",");
                const allLines = await db.prepare(
                    `SELECT basket_log_id, basket_kind, basket_no, taken_to, picked_up FROM basket_log_lines WHERE basket_log_id IN (${ph}) ORDER BY basket_kind, basket_no`
                ).all(...logIds);
                for (const ln of allLines || []) {
                    const arr = linesByLogId.get(ln.basket_log_id) || [];
                    arr.push(ln);
                    linesByLogId.set(ln.basket_log_id, arr);
                }
            }
            // 按月切上下月導覽
            const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
            const prevY = m === 1 ? y - 1 : y;
            const prevM = m === 1 ? 12 : m - 1;
            const prevYm = `${prevY}-${String(prevM).padStart(2, "0")}`;
            const nextY = m === 12 ? y + 1 : y;
            const nextM = m === 12 ? 1 : m + 1;
            const nextYm = `${nextY}-${String(nextM).padStart(2, "0")}`;
            // 總覽：客戶 × 月合計
            const byCust = new Map();
            for (const l of logs) {
                const k = l.customer_id;
                if (!byCust.has(k)) byCust.set(k, { takenTo: 0, pickedUp: 0, days: 0 });
                const acc = byCust.get(k);
                acc.takenTo += Number(l.taken_to || 0);
                acc.pickedUp += Number(l.picked_up || 0);
                acc.days += 1;
            }
            const overviewRows = [];
            for (const [cid, acc] of byCust) {
                const c = custMap.get(cid);
                overviewRows.push({
                    id: cid,
                    name: c?.name || "(已停用/不存在)",
                    takenTo: acc.takenTo,
                    pickedUp: acc.pickedUp,
                    net: acc.takenTo - acc.pickedUp,
                    days: acc.days,
                });
            }
            overviewRows.sort((a, b) => (b.takenTo + b.pickedUp) - (a.takenTo + a.pickedUp));
            const sumAllTo = overviewRows.reduce((s, r) => s + r.takenTo, 0);
            const sumAllPick = overviewRows.reduce((s, r) => s + r.pickedUp, 0);
            // 明細改用 JS modal 彈窗（fetch /admin/api/baskets/detail）；不在 server-side render
            const overviewTbody = overviewRows.map((r) => `
                <tr>
                  <td><button type="button" class="bsk-open-detail" data-cid="${escapeHtmlBsk(r.id)}" data-cname="${escapeHtmlBsk(r.name)}" data-ym="${ym}" style="background:none;border:none;color:var(--accent);text-decoration:underline;cursor:pointer;font-size:13px;padding:0;font-family:inherit;">${escapeHtmlBsk(r.name)}</button></td>
                  <td class="mono" style="text-align:right;">${r.takenTo}</td>
                  <td class="mono" style="text-align:right;">${r.pickedUp}</td>
                  <td class="mono" style="text-align:right;color:${r.net >= 0 ? "var(--txt-1)" : "var(--bad)"};font-weight:600;">${r.net >= 0 ? "+" : ""}${r.net}</td>
                  <td class="mono" style="text-align:right;color:var(--txt-3);">${r.days}</td>
                </tr>
            `).join("");
            const body = `
              <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
                <div>
                  <div class="sf-breadcrumb" style="margin-bottom:6px;">日常作業 / 空籃記帳</div>
                  <h1 style="margin:0;font-size:22px;font-weight:600;">空籃記帳</h1>
                  <p style="margin:6px 0 0;color:var(--txt-3);font-size:12px;">司機在 LINE 群組打「<b>空籃</b>」會收到 LIFF 連結，點開填三類規格（號碼籃 1-9 / 四角空籃 / 圓籃）。同一天重新提交會覆蓋當天數字。淨值 = 去 − 回（正值代表本月客戶手上多了幾個籃）。</p>
                </div>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                  <a href="/admin/baskets?ym=${prevYm}" class="sf-btn sf-btn-sm">← ${prevYm}</a>
                  <form method="get" action="/admin/baskets" style="display:flex;gap:8px;align-items:center;">
                    <input type="month" name="ym" value="${ym}" />
                    <button type="submit" class="sf-btn sf-btn-sm">查詢</button>
                  </form>
                  <a href="/admin/baskets?ym=${nextYm}" class="sf-btn sf-btn-sm">${nextYm} →</a>
                  <div style="flex:1;"></div>
                  <a href="/admin/baskets/export.xlsx?ym=${ym}" class="sf-btn sf-btn-sm">下載 Excel</a>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                  <div class="sf-card" style="padding:14px 18px;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">${ym} 客戶數</div>
                    <div class="mono" style="font-size:26px;font-weight:600;">${overviewRows.length}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">本月總計「去」</div>
                    <div class="mono" style="font-size:26px;font-weight:600;">${sumAllTo}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">本月總計「回」</div>
                    <div class="mono" style="font-size:26px;font-weight:600;">${sumAllPick}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;border-left:4px solid ${sumAllTo - sumAllPick >= 0 ? "var(--accent)" : "var(--bad)"};">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">淨值</div>
                    <div class="mono" style="font-size:26px;font-weight:600;color:${sumAllTo - sumAllPick >= 0 ? "var(--txt-1)" : "var(--bad)"};">${sumAllTo - sumAllPick >= 0 ? "+" : ""}${sumAllTo - sumAllPick}</div>
                  </div>
                </div>
                <div class="sf-card">
                  <div class="sf-card-head">
                    <div class="sf-card-title">${SF_ICONS.chartBar}各客戶月合計</div>
                    <span class="sf-card-sub">點客戶名看本月明細／可編輯</span>
                  </div>
                  <div style="padding:0;overflow-x:auto;">
                    <table class="sf-table" style="font-size:13px;width:100%;">
                      <thead>
                        <tr>
                          <th>客戶</th>
                          <th style="text-align:right;">合計「去」</th>
                          <th style="text-align:right;">合計「回」</th>
                          <th style="text-align:right;">淨值（去 − 回）</th>
                          <th style="text-align:right;">紀錄天數</th>
                        </tr>
                      </thead>
                      <tbody>${overviewTbody || `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--txt-3);">本月尚無任何空籃紀錄</td></tr>`}</tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- 明細 modal -->
              <div id="bsk-modal-bg" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)window.bskCloseModal()">
                <div style="background:#fff;border-radius:12px;max-width:900px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,.2);">
                  <div style="padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <div style="font-size:16px;font-weight:600;" id="bsk-modal-title">客戶明細</div>
                    <button type="button" onclick="window.bskCloseModal()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--txt-3);line-height:1;padding:4px 8px;">×</button>
                  </div>
                  <div style="padding:0;overflow:auto;flex:1;" id="bsk-modal-body">
                    <div style="padding:40px;text-align:center;color:var(--txt-3);">載入中…</div>
                  </div>
                </div>
              </div>

              <script>
              (function(){
                const modalBg = document.getElementById('bsk-modal-bg');
                const modalTitle = document.getElementById('bsk-modal-title');
                const modalBody = document.getElementById('bsk-modal-body');
                function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c])); }
                window.bskCloseModal = function(){ modalBg.style.display='none'; };
                window.bskOpenDetail = async function(cid, cname, ym){
                  modalTitle.innerHTML = '${sfInlineIcon("clipboard")} ' + esc(cname) + '　' + esc(ym) + ' 明細';
                  modalBody.innerHTML = '<div style="padding:40px;text-align:center;color:var(--txt-3);">載入中…</div>';
                  modalBg.style.display = 'flex';
                  try {
                    const r = await fetch('/admin/api/baskets/detail?customer=' + encodeURIComponent(cid) + '&ym=' + encodeURIComponent(ym));
                    const data = await r.json();
                    if (!data.ok) throw new Error(data.error || 'fail');
                    let html = '<table class="sf-table" style="font-size:13px;width:100%;">'
                      + '<thead><tr>'
                      + '<th style="width:100px;">日期</th>'
                      + '<th>分項（號碼籃 / 四角 / 圓）</th>'
                      + '<th style="text-align:right;width:60px;">去</th>'
                      + '<th style="text-align:right;width:60px;">回</th>'
                      + '<th style="text-align:right;width:60px;">淨</th>'
                      + '<th style="width:110px;">回報人</th>'
                      + '<th style="width:90px;">動作</th>'
                      + '</tr></thead><tbody>';
                    if (!data.days.length) {
                      html += '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--txt-3);">本月尚無紀錄</td></tr>';
                    } else {
                      let sumTo=0, sumPk=0;
                      for (const d of data.days) {
                        sumTo += d.takenTo; sumPk += d.pickedUp;
                        const net = d.takenTo - d.pickedUp;
                        const linesHtml = d.lines.length
                          ? d.lines.map(ln => '<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;background:var(--bg-2);border-radius:4px;font-size:12px;">'
                              + esc(ln.kind === 'numbered' ? (ln.no + '號') : (ln.kind === 'square' ? '四角' : '圓'))
                              + ' 去' + ln.takenTo + '回' + ln.pickedUp
                              + '</span>').join('')
                          : '<span style="color:var(--txt-3);font-size:12px;">（無分項）</span>';
                        const netColor = net >= 0 ? 'var(--txt-2)' : 'var(--bad)';
                        html += '<tr>'
                          + '<td class="mono" style="vertical-align:top;">' + esc(d.date) + '</td>'
                          + '<td style="vertical-align:top;">' + linesHtml + '</td>'
                          + '<td class="mono" style="text-align:right;vertical-align:top;">' + d.takenTo + '</td>'
                          + '<td class="mono" style="text-align:right;vertical-align:top;">' + d.pickedUp + '</td>'
                          + '<td class="mono" style="text-align:right;vertical-align:top;color:' + netColor + ';">' + net + '</td>'
                          + '<td style="vertical-align:top;">' + esc(d.reporter || '') + '</td>'
                          + '<td style="vertical-align:top;">'
                          + '<form method="post" action="/admin/baskets/delete-day" onsubmit="return confirm(\\'確定刪除 ' + esc(d.date) + ' 整天紀錄？\\');" style="display:inline;">'
                          + '<input type="hidden" name="ym" value="' + esc(ym) + '" />'
                          + '<input type="hidden" name="customer_id" value="' + esc(cid) + '" />'
                          + '<input type="hidden" name="log_date" value="' + esc(d.date) + '" />'
                          + '<button type="submit" class="sf-btn sf-btn-sm" style="color:var(--bad);">刪除整天</button>'
                          + '</form>'
                          + '</td></tr>';
                      }
                      const netT = sumTo - sumPk;
                      html += '</tbody><tfoot><tr style="background:var(--bg-1);font-weight:600;">'
                        + '<td colspan="2">本月合計</td>'
                        + '<td class="mono" style="text-align:right;">' + sumTo + '</td>'
                        + '<td class="mono" style="text-align:right;">' + sumPk + '</td>'
                        + '<td class="mono" style="text-align:right;">' + netT + '</td>'
                        + '<td colspan="2"></td></tr></tfoot>';
                    }
                    html += '</table>'
                      + '<div style="padding:12px 16px;border-top:1px solid var(--line);background:var(--bg-1);font-size:12px;color:var(--txt-3);">${sfInlineIcon("bulb")} 編輯：請司機在 LINE 群組重新打「<b>空籃</b>」，從 LIFF 重新提交即可覆蓋當天數字。</div>';
                    // 變更紀錄
                    function fmtTime(iso){ if(!iso) return ''; try { return new Date(iso).toLocaleString('zh-TW',{hour12:false}); } catch(_) { return String(iso); } }
                    function fmtActor(actor, reporter){
                      if (!actor) return reporter || '—';
                      if (actor.indexOf('liff:') === 0) return 'LIFF · 司機 ' + (reporter || '—');
                      if (actor.indexOf('admin:') === 0) {
                        const u = actor.slice(6);
                        return '後台管理員 ' + (u === '?' ? '' : u);
                      }
                      return actor;
                    }
                    function fmtLines(lines){
                      if (!Array.isArray(lines) || !lines.length) return '<span style="color:var(--txt-3);">（無）</span>';
                      return lines.map(ln => {
                        const lbl = ln.kind === 'numbered' ? (ln.no + '號') : (ln.kind === 'square' ? '四角' : '圓');
                        return '<span style="display:inline-block;margin:1px 4px 1px 0;padding:1px 6px;background:var(--bg-2);border-radius:3px;font-size:11px;">' + esc(lbl) + ' 去' + (ln.takenTo||0) + '回' + (ln.pickedUp||0) + '</span>';
                      }).join('');
                    }
                    const histList = data.history || [];
                    let histHtml = '<div style="padding:14px 16px 8px;border-top:2px solid var(--line);background:var(--bg-1);"><div style="font-weight:600;font-size:14px;margin-bottom:8px;">${sfInlineIcon("history")} 變更紀錄（' + histList.length + ' 筆）</div>';
                    if (!histList.length) {
                      histHtml += '<div style="color:var(--txt-3);font-size:12px;padding:8px 0;">本月尚無變更紀錄。</div>';
                    } else {
                      histHtml += '<table class="sf-table" style="font-size:12px;width:100%;">'
                        + '<thead><tr>'
                        + '<th style="width:140px;">時間</th>'
                        + '<th style="width:160px;">操作者</th>'
                        + '<th style="width:90px;">資料日期</th>'
                        + '<th style="text-align:right;width:90px;">總和變化</th>'
                        + '<th>新的分項</th>'
                        + '<th>原本分項</th>'
                        + '</tr></thead><tbody>';
                      for (const h of histList) {
                        const sumPrev = (h.prevTo||0) + (h.prevPk||0);
                        const sumNew = (h.newTo||0) + (h.newPk||0);
                        const totChg = (h.prevTo == null || h.prevPk == null)
                          ? '新增'
                          : ('去 ' + h.prevTo + '→' + h.newTo + '　回 ' + h.prevPk + '→' + h.newPk);
                        const color = (sumNew > sumPrev) ? 'var(--ok,#16a34a)' : (sumNew < sumPrev ? 'var(--bad)' : 'var(--txt-2)');
                        histHtml += '<tr>'
                          + '<td class="mono" style="vertical-align:top;">' + esc(fmtTime(h.at)) + '</td>'
                          + '<td style="vertical-align:top;">' + esc(fmtActor(h.actor, h.reporter)) + '</td>'
                          + '<td class="mono" style="vertical-align:top;">' + esc(h.logDate) + '</td>'
                          + '<td class="mono" style="text-align:right;vertical-align:top;color:' + color + ';">' + esc(totChg) + '</td>'
                          + '<td style="vertical-align:top;">' + fmtLines(h.newLines) + '</td>'
                          + '<td style="vertical-align:top;">' + fmtLines(h.prevLines) + '</td>'
                          + '</tr>';
                      }
                      histHtml += '</tbody></table>';
                    }
                    histHtml += '</div>';
                    html += histHtml;
                    modalBody.innerHTML = html;
                  } catch (e) {
                    modalBody.innerHTML = '<div style="padding:40px;text-align:center;color:var(--bad);">載入失敗：' + esc(e.message || e) + '</div>';
                  }
                };
                document.querySelectorAll('.bsk-open-detail').forEach(btn => {
                  btn.addEventListener('click', () => {
                    window.bskOpenDetail(btn.dataset.cid, btn.dataset.cname, btn.dataset.ym);
                  });
                });
                document.addEventListener('keydown', e => { if (e.key === 'Escape') window.bskCloseModal(); });
              })();
              </script>
            `;
            res.type("text/html").send(notionPage("空籃記帳", body, "baskets", res));
        } catch (e) {
            console.error("[admin] /baskets failed", e);
            res.status(500).send("載入空籃記帳失敗：" + (e?.message || e));
        }
    });
    router.get("/api/baskets/detail", async (req, res) => {
        try {
            const customerId = String(req.query.customer || "").trim();
            const ymRaw = String(req.query.ym || "").trim();
            const ym = /^\d{4}-\d{2}$/.test(ymRaw) ? ymRaw : currentTwYM();
            if (!customerId) {
                return res.status(400).json({ ok: false, error: "missing customer" });
            }
            const { start, end } = monthRange(ym);
            const logs = await db.prepare(
                "SELECT id, log_date, taken_to, picked_up, reporter_display_name FROM basket_logs " +
                "WHERE customer_id = ? AND log_date >= ? AND log_date < ? ORDER BY log_date ASC"
            ).all(customerId, start, end);
            const logIds = (logs || []).map(l => l.id);
            const linesByLog = new Map();
            if (logIds.length) {
                const ph = logIds.map(() => "?").join(",");
                const allLines = await db.prepare(
                    `SELECT basket_log_id, basket_kind, basket_no, taken_to, picked_up FROM basket_log_lines WHERE basket_log_id IN (${ph}) ORDER BY basket_kind, basket_no`
                ).all(...logIds);
                for (const ln of allLines || []) {
                    const arr = linesByLog.get(ln.basket_log_id) || [];
                    arr.push(ln);
                    linesByLog.set(ln.basket_log_id, arr);
                }
            }
            const days = (logs || []).map(l => ({
                date: l.log_date,
                takenTo: Number(l.taken_to || 0),
                pickedUp: Number(l.picked_up || 0),
                reporter: l.reporter_display_name || "",
                lines: (linesByLog.get(l.id) || []).map(ln => ({
                    kind: ln.basket_kind,
                    no: Number(ln.basket_no) || 0,
                    takenTo: Number(ln.taken_to || 0),
                    pickedUp: Number(ln.picked_up || 0),
                })),
            }));
            // 變更紀錄（含 LIFF 提交 + 後台刪除）
            const hist = await db.prepare(
                "SELECT h.created_at, h.actor, h.log_date, h.prev_taken_to, h.prev_picked_up, " +
                "h.new_taken_to, h.new_picked_up, h.prev_lines_json, h.new_lines_json, " +
                "b.reporter_display_name " +
                "FROM basket_log_history h LEFT JOIN basket_logs b ON b.id = h.basket_log_id " +
                "WHERE h.customer_id = ? AND h.log_date >= ? AND h.log_date < ? " +
                "ORDER BY h.created_at DESC"
            ).all(customerId, start, end);
            const history = (hist || []).map(h => ({
                at: h.created_at,
                actor: h.actor || "",
                reporter: h.reporter_display_name || "",
                logDate: h.log_date,
                prevTo: h.prev_taken_to == null ? null : Number(h.prev_taken_to),
                prevPk: h.prev_picked_up == null ? null : Number(h.prev_picked_up),
                newTo: h.new_taken_to == null ? null : Number(h.new_taken_to),
                newPk: h.new_picked_up == null ? null : Number(h.new_picked_up),
                prevLines: safeParseJson(h.prev_lines_json),
                newLines: safeParseJson(h.new_lines_json),
            }));
            res.json({ ok: true, customerId, ym, days, history });
        } catch (e) {
            console.error("[admin] /api/baskets/detail failed", e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    router.post("/baskets/delete-day", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const ym = String(req.body.ym || "").trim();
            const customerId = String(req.body.customer_id || "").trim();
            const logDate = String(req.body.log_date || "").trim();
            if (!customerId || !logDate || !/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
                const backYm0 = /^\d{4}-\d{2}$/.test(ym) ? ym : currentTwYM();
                return res.status(400).send(`參數不正確：缺少客戶或日期（日期需為 YYYY-MM-DD）。請回上一頁重新點「刪除整天」。<p><a href="/admin/baskets?ym=${backYm0}">← 回空籃記帳</a></p>`);
            }
            // 找到主 log 並刪除其分項；保留 basket_logs 主紀錄但歸零，並寫 history
            const row = await db.prepare("SELECT id FROM basket_logs WHERE customer_id = ? AND log_date = ?").get(customerId, logDate);
            if (row) {
                const prevLines = await db.prepare("SELECT basket_kind, basket_no, taken_to, picked_up FROM basket_log_lines WHERE basket_log_id = ?").all(row.id);
                const nowSql2 = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                // [fix 2026-07-27 體檢] 三步寫入（刪分項/歸零總計/寫 history）包進同一交易：
                // 舊版裸奔且 history 吞錯——中途失敗會留下「分項已刪、總計還是舊數字」的不一致列，
                // 或資料已改卻無軌跡。lib/basket-log.js 的寫入路徑已包交易，這條是漏網的雙胞胎。
                const doDeleteDay = async (h) => {
                    await h.prepare("DELETE FROM basket_log_lines WHERE basket_log_id = ?").run(row.id);
                    await h.prepare("UPDATE basket_logs SET taken_to = 0, picked_up = 0, updated_at = " + nowSql2 + " WHERE id = ?").run(row.id);
                    const hid = (0, id_js_1.newId)("bskh");
                    await h.prepare(
                        "INSERT INTO basket_log_history (id, basket_log_id, customer_id, log_date, prev_taken_to, prev_picked_up, new_taken_to, new_picked_up, prev_lines_json, new_lines_json, actor, raw_message, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, " + nowSql2 + ")"
                    ).run(hid, row.id, customerId, logDate,
                        prevLines.reduce((s, l) => s + Number(l.taken_to || 0), 0),
                        prevLines.reduce((s, l) => s + Number(l.picked_up || 0), 0),
                        JSON.stringify(prevLines), "[]",
                        "admin:" + (res.locals.adminUser || "?"), "[admin delete-day]");
                };
                if (typeof db.transaction === "function") await db.transaction(doDeleteDay);
                else await doDeleteDay(db);
            }
            const backYm = /^\d{4}-\d{2}$/.test(ym) ? ym : currentTwYM();
            res.redirect(`/admin/baskets?ym=${backYm}&customer=${encodeURIComponent(customerId)}`);
        } catch (e) {
            console.error("[admin] /baskets/delete-day failed", e);
            res.status(500).send("刪除失敗：" + (e?.message || e));
        }
    });
    router.get("/baskets/export.xlsx", async (req, res) => {
        try {
            const ymRaw = typeof req.query.ym === "string" ? req.query.ym.trim() : "";
            const ym = /^\d{4}-\d{2}$/.test(ymRaw) ? ymRaw : currentTwYM();
            const { start, end } = monthRange(ym);
            const customers = await db.prepare("SELECT id, name FROM customers WHERE (active IS NULL OR active = 1) ORDER BY name ASC").all();
            const custMap = new Map(customers.map((c) => [c.id, c.name]));
            const logs = await db.prepare(
                "SELECT id, customer_id, log_date, taken_to, picked_up, reporter_display_name " +
                "FROM basket_logs WHERE log_date >= ? AND log_date < ? ORDER BY customer_id ASC, log_date ASC"
            ).all(start, end);
            const logIds = logs.map(l => l.id);
            const linesByLog = new Map();
            if (logIds.length) {
                const ph = logIds.map(() => "?").join(",");
                const allLines = await db.prepare(
                    `SELECT basket_log_id, basket_kind, basket_no, taken_to, picked_up FROM basket_log_lines WHERE basket_log_id IN (${ph})`
                ).all(...logIds);
                for (const ln of allLines || []) {
                    const arr = linesByLog.get(ln.basket_log_id) || [];
                    arr.push(ln);
                    linesByLog.set(ln.basket_log_id, arr);
                }
            }
            const wb = XLSX.utils.book_new();
            // Sheet 1：月合計（按客戶）
            const byCust = new Map();
            for (const l of logs) {
                if (!byCust.has(l.customer_id)) byCust.set(l.customer_id, { to: 0, pk: 0, days: 0 });
                const acc = byCust.get(l.customer_id);
                acc.to += Number(l.taken_to || 0);
                acc.pk += Number(l.picked_up || 0);
                acc.days += 1;
            }
            const summary = [["客戶", "合計 去", "合計 回", "淨值 (去−回)", "紀錄天數"]];
            for (const [cid, acc] of byCust) {
                summary.push([custMap.get(cid) || cid, acc.to, acc.pk, acc.to - acc.pk, acc.days]);
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), `${ym} 月合計`);
            // Sheet 1.5：客戶 × 規格 月合計（矩陣式：每客戶一列，各規格去/回各一欄）
            // 對每個客戶累加各 kind/no 的 takenTo/pickedUp
            const NUM_NOS = [1,2,3,5,6,7,8,9];
            const cxByCust = new Map();
            for (const l of logs) {
                if (!cxByCust.has(l.customer_id)) {
                    cxByCust.set(l.customer_id, { numbered: {}, square: { to: 0, pk: 0 }, round: { to: 0, pk: 0 } });
                }
                const slot = cxByCust.get(l.customer_id);
                const lines = linesByLog.get(l.id) || [];
                for (const ln of lines) {
                    const t = Number(ln.taken_to || 0), p = Number(ln.picked_up || 0);
                    if (ln.basket_kind === "numbered") {
                        const n = Number(ln.basket_no) || 0;
                        if (!slot.numbered[n]) slot.numbered[n] = { to: 0, pk: 0 };
                        slot.numbered[n].to += t; slot.numbered[n].pk += p;
                    } else if (ln.basket_kind === "square") {
                        slot.square.to += t; slot.square.pk += p;
                    } else if (ln.basket_kind === "round") {
                        slot.round.to += t; slot.round.pk += p;
                    }
                }
            }
            // 表頭：客戶 | 1號去 | 1號回 | 2號去 | 2號回 | ... | 四角去 | 四角回 | 圓去 | 圓回 | 總去 | 總回 | 淨
            const cxHeader = ["客戶"];
            for (const n of NUM_NOS) { cxHeader.push(`${n}號 去`); cxHeader.push(`${n}號 回`); }
            cxHeader.push("四角 去", "四角 回", "圓 去", "圓 回", "總計 去", "總計 回", "淨值");
            const cxRows = [cxHeader];
            // 依客戶名排序，方便看
            const cxSorted = [...cxByCust.entries()].map(([cid, slot]) => ({
                cid, name: custMap.get(cid) || cid, slot
            })).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
            for (const { name, slot } of cxSorted) {
                const row = [name];
                let totTo = 0, totPk = 0;
                for (const n of NUM_NOS) {
                    const x = slot.numbered[n] || { to: 0, pk: 0 };
                    row.push(x.to, x.pk);
                    totTo += x.to; totPk += x.pk;
                }
                row.push(slot.square.to, slot.square.pk, slot.round.to, slot.round.pk);
                totTo += slot.square.to + slot.round.to;
                totPk += slot.square.pk + slot.round.pk;
                row.push(totTo, totPk, totTo - totPk);
                cxRows.push(row);
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cxRows), `${ym} 客戶×規格`);
            // Sheet 2：每日總計
            const detail = [["客戶", "日期", "去", "回", "淨", "回報人"]];
            for (const l of logs) {
                const t = Number(l.taken_to ?? 0), p = Number(l.picked_up ?? 0);
                detail.push([custMap.get(l.customer_id) || l.customer_id, l.log_date, l.taken_to ?? 0, l.picked_up ?? 0, t - p, l.reporter_display_name || ""]);
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detail), `${ym} 每日總計`);
            // Sheet 3：每日分項（規格 × 號碼）
            const itemized = [["客戶", "日期", "規格", "號碼", "去", "回", "淨"]];
            for (const l of logs) {
                const lines = linesByLog.get(l.id) || [];
                for (const ln of lines) {
                    const kindLabel = ln.basket_kind === "numbered" ? "號碼籃" : (ln.basket_kind === "square" ? "四角空籃" : "圓籃");
                    const no = ln.basket_kind === "numbered" ? ln.basket_no : "";
                    const t = Number(ln.taken_to || 0), p = Number(ln.picked_up || 0);
                    itemized.push([custMap.get(l.customer_id) || l.customer_id, l.log_date, kindLabel, no, t, p, t - p]);
                }
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itemized), `${ym} 每日分項`);
            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="basket_${ym}.xlsx"`);
            res.send(buf);
        } catch (e) {
            console.error("[admin] /baskets/export.xlsx failed", e);
            res.status(500).send("匯出失敗：" + (e?.message || e));
        }
    });
    // 匯出「機器人目前所在的 LINE 群組」清單（已綁定客戶 + 待綁定）
    router.get("/groups/export.xlsx", async (req, res) => {
        try {
            const custs = await db.prepare("SELECT name, line_group_id, active FROM customers ORDER BY name ASC").all();
            const bound = (custs || []).filter((c) => c.line_group_id && String(c.line_group_id).trim() !== "");
            let pending = [];
            try {
                pending = await db.prepare("SELECT group_id, source_type, group_name, first_seen_at, last_seen_at FROM pending_line_groups ORDER BY last_seen_at DESC").all();
            }
            catch (_) { /* 表可能尚未建立 */ }
            const fmtTs = (s) => s ? String(s).replace("T", " ").replace("Z", "").slice(0, 19) : "";
            const rows = [["狀態", "客戶 / 群組名稱", "類型", "群組 ID", "啟用中", "最後出現"]];
            for (const c of bound) {
                rows.push(["已綁定", c.name || "", "群組", String(c.line_group_id).trim(),
                    (c.active === 0 ? "否" : "是"), ""]);
            }
            for (const g of pending) {
                const stype = g.source_type === "room" ? "聊天室" : g.source_type === "group" ? "群組" : "";
                rows.push(["待綁定", g.group_name ? String(g.group_name) : "（未取得名稱）", stype,
                    String(g.group_id || ""), "", fmtTs(g.last_seen_at)]);
            }
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "機器人所在群組");
            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
            const ymd = new Date().toISOString().slice(0, 10);
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="line_groups_${ymd}.xlsx"`);
            res.send(buf);
        } catch (e) {
            console.error("[admin] /groups/export.xlsx failed", e);
            res.status(500).send("匯出失敗：" + (e?.message || e));
        }
    });
}
