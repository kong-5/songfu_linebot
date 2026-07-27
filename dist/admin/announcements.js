"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnnouncementsRoutes = registerAnnouncementsRoutes;

// 公告域（模板化公告：列表/新增/詳情/刪除/預覽圖/發送到 LINE 群組）路由：
// 自 index.js 拆出（拆檔批次 6），純搬移、行為不變。
// 註：nowSqlExpr 與行事曆域共用，留 index.js 經 ctx 傳入；Flex 組訊 helper 亦同。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const announcement_templates_js_1 = require("../lib/announcement-templates.js");
const announcement_image_js_1 = require("../lib/announcement-image.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerAnnouncementsRoutes(router, ctx) {
    const { db, notionPage, logDataChange, requireManager, nowSqlExpr, buildPromoFlexMessage, buildNoticeFlexMessage, buildCalendarFlexMessage, fmtTaipeiYMDHM } = ctx;

    // ============================================================
    // 公告管理：模板化群發系統（取代/擴充 broadcast 即時填表）
    // ============================================================
    const ANN_CSS = `<style>
.ann-tpl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; margin-top:14px; }
.ann-tpl-card { display:block; padding:18px 20px; background:var(--notion-card); border:1px solid var(--notion-border); border-radius:10px; text-decoration:none; color:var(--notion-text); transition:border-color .15s,transform .15s,box-shadow .15s; }
.ann-tpl-card:hover { border-color:#3b82c4; transform:translateY(-2px); box-shadow:0 4px 16px rgba(59,130,196,0.12); text-decoration:none; }
.ann-tpl-icon { font-size:32px; line-height:1; margin-bottom:8px; }
.ann-tpl-name { font-size:16px; font-weight:600; margin-bottom:4px; }
.ann-tpl-desc { font-size:12px; color:var(--notion-text-muted); line-height:1.45; }
.ann-form { max-width:760px; }
.ann-form .field { margin-bottom:18px; }
.ann-form label.fl { display:block; font-size:13px; font-weight:500; color:var(--notion-text); margin-bottom:5px; }
.ann-form .hint { font-size:12px; color:var(--notion-text-muted); margin-top:3px; }
.ann-form input[type=text], .ann-form input[type=date], .ann-form textarea { width:100%; padding:8px 10px; border:1px solid var(--notion-border-strong); border-radius:6px; font-size:14px; box-sizing:border-box; background:var(--notion-canvas); color:var(--notion-text); font-family:inherit; }
.ann-form textarea { min-height:96px; resize:vertical; }
.ann-item-rows .row { display:flex; gap:6px; margin-bottom:6px; }
.ann-item-rows .row input { flex:1; padding:6px 8px; border:1px solid var(--notion-border-strong); border-radius:5px; font-size:13px; }
.ann-item-rows .row .col-price { flex:0 0 80px; }
.ann-item-rows .row .col-unit { flex:0 0 60px; }
.ann-item-rows .row .col-market { flex:0 0 80px; }
.ann-item-rows .row .col-rm { flex:0 0 26px; background:none; border:none; cursor:pointer; color:#bbb; }
.ann-add-row { background:none; border:1px dashed #bbb; border-radius:6px; padding:5px 12px; cursor:pointer; font-size:12px; color:#777; }
.ann-add-row:hover { border-color:#3b82c4; color:#3b82c4; }
.ann-list-table { width:100%; border-collapse:collapse; }
.ann-list-table th { text-align:left; padding:10px 12px; font-size:12px; color:#666; border-bottom:1px solid var(--notion-border); font-weight:500; }
.ann-list-table td { padding:12px; border-bottom:1px solid var(--notion-border); font-size:13px; }
.ann-list-table tr:hover td { background:var(--notion-hover); }
.ann-status { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; }
.ann-status.draft { background:#f4f4f0; color:#666; }
.ann-status.sent { background:#ecfdf5; color:#047857; }

/* === 公告卡片：節日紅底 === */
.ann-card { padding:24px; border-radius:14px; max-width:540px; font-family:'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif; }
.ann-holiday-red { background:linear-gradient(180deg,#a82323,#7a1717); color:#fff; }
.ann-holiday-red .ann-title { font-size:32px; font-weight:800; text-align:center; margin-bottom:18px; }
.ann-week-strip { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin:16px 0; }
.ann-week-cell { padding:8px 4px; border-radius:6px; border:1.5px solid; text-align:center; font-size:13px; }
.ann-week-day { font-weight:700; }
.ann-week-date { font-size:18px; font-weight:700; margin-top:2px; }
.ann-week-tag { font-size:10px; margin-top:2px; }
.ann-body { margin-top:14px; }
.ann-line { font-size:15px; line-height:1.7; margin-bottom:6px; color:#fff8e1; }
.ann-line-no { font-weight:700; color:#ffd6c4; margin-right:4px; }
.ann-footer { font-size:20px; text-align:center; margin-top:18px; font-weight:700; color:#fff; }
.ann-brand { font-size:11px; text-align:center; margin-top:14px; opacity:0.7; letter-spacing:2px; }
.ann-brand-light { color:#787774; opacity:1; }

/* 限時優惠黃 */
.ann-promo-yellow { background:#fffaeb; border:2px solid #f5b800; color:#3d2c00; }
.ann-promo-header { display:flex; gap:10px; align-items:flex-start; margin-bottom:10px; }
.ann-promo-bolt { font-size:32px; }
.ann-promo-titles { flex:1; }
.ann-promo-yellow .ann-title { font-size:24px; font-weight:800; color:#3d2c00; }
.ann-promo-sub { font-size:13px; color:#5c4400; margin-top:2px; }
.ann-promo-date { font-size:14px; font-weight:700; color:#a8540a; margin-bottom:12px; }
.ann-promo-items { display:flex; flex-direction:column; gap:6px; }
.ann-promo-item { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#fff; border:1px solid #f5d97e; border-radius:6px; }
.ann-promo-item-name { font-weight:700; flex:1; }
.ann-promo-price-now { font-size:20px; font-weight:800; color:#a8540a; }
.ann-promo-unit { font-size:12px; color:#9a7b3a; margin-left:2px; }
.ann-promo-item-market { font-size:11px; color:#9a7b3a; margin-left:8px; }
.ann-promo-note { margin-top:10px; font-size:12px; color:#5c4400; padding:8px; background:#fff5d6; border-radius:6px; }

/* 通知深色 */
.ann-notice-dark { background:#fafafa; border:1px solid var(--notion-border); }
.ann-notice-header { background:#2c3e50; padding:14px 18px; margin:-24px -24px 14px; border-radius:12px 12px 0 0; }
.ann-notice-icon { color:#90b8d8; font-size:13px; }
.ann-notice-title { display:block; color:#fff; font-size:20px; font-weight:700; margin-top:4px; }
.ann-notice-body p { font-size:14px; line-height:1.7; margin:0 0 10px; color:#37352f; }

/* 新品綠 */
.ann-new-arrival-green { background:#f4faf6; border:2px solid #1e7a5e; color:#37352f; }
.ann-new-tag { display:inline-block; padding:2px 10px; background:#1e7a5e; color:#cdebd9; font-size:11px; font-weight:600; border-radius:10px; margin-bottom:10px; }
.ann-new-arrival-green .ann-title { font-size:24px; font-weight:800; color:#1e7a5e; }
.ann-new-tagline { font-size:14px; color:#5c7a6e; margin-top:4px; margin-bottom:14px; }
.ann-new-highlights { display:flex; flex-direction:column; gap:6px; margin:14px 0; }
.ann-new-bullet { font-size:14px; color:#37352f; }
.ann-new-price { font-size:18px; font-weight:700; color:#1e7a5e; margin:10px 0; }
.ann-new-cta { font-size:14px; font-weight:600; color:#fff; background:#1e7a5e; padding:8px 16px; border-radius:6px; display:inline-block; margin-top:8px; }

.ann-empty { color:#999; text-align:center; padding:24px; font-size:13px; }
.ann-preview-pane { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:18px; }
@media (max-width:880px) { .ann-preview-pane { grid-template-columns:1fr; } }
.ann-preview-col h3 { font-size:13px; color:#666; margin:0 0 8px; font-weight:500; }
.ann-preview-col img { max-width:100%; border:1px solid var(--notion-border); border-radius:8px; }
</style>`;


    function statusBadge(status) {
        const s = String(status || "draft").toLowerCase();
        const label = s === "sent" ? "已送" : "草稿";
        return `<span class="ann-status ${s}">${label}</span>`;
    }

    function renderAnnouncementFormFields(template, data) {
        const out = [];
        for (const f of template.fields) {
            const v = data && Object.prototype.hasOwnProperty.call(data, f.name) ? data[f.name] : "";
            const id = `f_${f.name}`;
            if (f.type === "textarea") {
                out.push(`<div class="field"><label class="fl" for="${id}">${escapeHtml(f.label)}${f.required ? " *" : ""}</label><textarea id="${id}" name="${f.name}" placeholder="${escapeAttr(f.placeholder || "")}"${f.required ? " required" : ""}>${escapeHtml(String(v || ""))}</textarea>${f.hint ? `<div class="hint">${escapeHtml(f.hint)}</div>` : ""}</div>`);
            } else if (f.type === "items") {
                const items = Array.isArray(v) ? v : [{ name: "", price: "", unit: "斤", market: "" }];
                const rowsHtml = items.map((it) => `<div class="row">
<input type="text" placeholder="品名" name="item_name" value="${escapeAttr(it?.name || "")}">
<input type="text" placeholder="價格" class="col-price" name="item_price" value="${escapeAttr(it?.price || "")}">
<input type="text" placeholder="單位" class="col-unit" name="item_unit" value="${escapeAttr(it?.unit || "斤")}">
<input type="text" placeholder="行情" class="col-market" name="item_market" value="${escapeAttr(it?.market || "")}">
<button type="button" class="col-rm" onclick="this.parentElement.remove()" title="刪除">×</button>
</div>`).join("");
                out.push(`<div class="field"><label class="fl">${escapeHtml(f.label)}</label><div id="${id}" class="ann-item-rows">${rowsHtml}</div><button type="button" class="ann-add-row" onclick="annAddItemRow('${id}')">＋ 新增品項</button></div>`);
            } else {
                const t = f.type === "date" ? "date" : "text";
                out.push(`<div class="field"><label class="fl" for="${id}">${escapeHtml(f.label)}${f.required ? " *" : ""}</label><input type="${t}" id="${id}" name="${f.name}" value="${escapeAttr(String(v || ""))}" placeholder="${escapeAttr(f.placeholder || "")}"${f.required ? " required" : ""}>${f.hint ? `<div class="hint">${escapeHtml(f.hint)}</div>` : ""}</div>`);
            }
        }
        return out.join("\n");
    }

    function parseFormBody(template, body) {
        const out = {};
        for (const f of template.fields) {
            if (f.type === "items") {
                const names = [].concat(body.item_name || []);
                const prices = [].concat(body.item_price || []);
                const units = [].concat(body.item_unit || []);
                const markets = [].concat(body.item_market || []);
                const arr = [];
                for (let i = 0; i < names.length; i++) {
                    const n = String(names[i] || "").trim();
                    if (!n) continue;
                    arr.push({ name: n, price: String(prices[i] || "").trim(), unit: String(units[i] || "").trim() || "斤", market: String(markets[i] || "").trim() });
                }
                out[f.name] = arr;
            } else {
                out[f.name] = String(body[f.name] || "").trim();
            }
        }
        return out;
    }

    router.get("/announcements", async (req, res) => {
        const filterStatus = String(req.query.status || "").trim().toLowerCase();
        let sql = "SELECT id, template_id, title, status, created_at, sent_at FROM announcements";
        const params = [];
        if (filterStatus === "draft" || filterStatus === "sent") {
            sql += " WHERE status = ?";
            params.push(filterStatus);
        }
        sql += " ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 200";
        const rows = await db.prepare(sql).all(...params);
        const tmplMap = Object.fromEntries(announcement_templates_js_1.listTemplates().map((t) => [t.id, t]));
        const tableRows = rows.length
            ? rows.map((r) => {
                const t = tmplMap[r.template_id];
                const tplLabel = t ? `${t.icon} ${t.label}` : r.template_id;
                const created = r.created_at ? String(r.created_at).slice(0, 16).replace("T", " ") : "—";
                const sent = r.sent_at ? String(r.sent_at).slice(0, 16).replace("T", " ") : "—";
                return `<tr>
<td><a href="/admin/announcements/${encodeURIComponent(r.id)}">${escapeHtml(r.title || "(未命名)")}</a></td>
<td>${escapeHtml(tplLabel)}</td>
<td>${statusBadge(r.status)}</td>
<td style="color:#787774;font-size:12px;">${created}</td>
<td style="color:#787774;font-size:12px;">${sent}</td>
</tr>`;
            }).join("")
            : `<tr><td colspan="5" style="text-align:center;padding:24px;color:#999;">尚無公告，點右上「＋ 新增公告」開始</td></tr>`;
        const filterLink = (s, label) => `<a href="/admin/announcements${s ? `?status=${s}` : ""}" style="margin-right:8px;padding:4px 10px;border-radius:6px;${filterStatus === s ? "background:#3b82c4;color:#fff;" : "color:#666;"}">${escapeHtml(label)}</a>`;
        const body = `${ANN_CSS}
<div class="notion-page-content">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
  <h1 class="notion-h1" style="margin:0;">公告管理</h1>
  <a href="/admin/announcements/new" class="btn btn-primary">＋ 新增公告</a>
</div>
<p style="color:#888;font-size:13px;margin-bottom:14px;">挑選模板、填寫內容、預覽 → 傳送到 LINE 或下載 PNG。可重複發送與保留歷史紀錄。</p>
<div style="margin-bottom:12px;">${filterLink("", "全部")}${filterLink("draft", "草稿")}${filterLink("sent", "已送")}</div>
<div class="notion-card" style="padding:0;">
  <table class="ann-list-table">
    <thead><tr><th>標題</th><th>模板</th><th>狀態</th><th>建立時間</th><th>送出時間</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>
</div>`;
        res.type("text/html").send(notionPage("公告管理", body, "announcements", res));
    });

    router.get("/announcements/new", requireManager, async (req, res) => {
        const templateId = String(req.query.template || "").trim();
        if (!templateId) {
            const cards = announcement_templates_js_1.listTemplates().map((t) =>
                `<a href="/admin/announcements/new?template=${encodeURIComponent(t.id)}" class="ann-tpl-card">
<div class="ann-tpl-icon">${t.icon}</div>
<div class="ann-tpl-name">${escapeHtml(t.label)}</div>
<div class="ann-tpl-desc">${escapeHtml(t.description)}</div>
</a>`).join("");
            const body = `${ANN_CSS}
<div class="notion-page-content">
<p style="margin:0 0 6px;"><a href="/admin/announcements">← 公告管理</a></p>
<h1 class="notion-h1" style="margin:0 0 8px;">挑選模板</h1>
<p style="color:#888;font-size:13px;">每個模板都會生成 LINE Flex Message + 可下載的 PNG 圖片，挑一個開始。</p>
<div class="ann-tpl-grid">${cards}</div>
</div>`;
            res.type("text/html").send(notionPage("挑選模板", body, "announcements", res));
            return;
        }
        const tpl = announcement_templates_js_1.getTemplate(templateId);
        if (!tpl) { res.redirect("/admin/announcements/new"); return; }

        // 從行事曆帶資料：?from_calendar=YYYY-MM-DD → 自動填入 holiday_red 表單
        let initialData = {};
        const fromCal = String(req.query.from_calendar || "").trim();
        if (templateId === "holiday_red" && /^\d{4}-\d{2}-\d{2}$/.test(fromCal)) {
            try {
                // 找該日的 calendar event（取假日／公休的 label 當標題）
                const event = await db.prepare(
                    "SELECT date, kind, label FROM company_calendar WHERE date = ? AND kind IN ('national_holiday', 'company_off') ORDER BY kind LIMIT 1"
                ).get(fromCal);
                // 算當週週一（公告週曆從週一開始）
                const d = new Date(fromCal + "T12:00:00");
                if (!Number.isNaN(d.getTime())) {
                    const dow = d.getDay(); // 0=Sun..6=Sat
                    const daysToMon = dow === 0 ? 6 : dow - 1;
                    const monday = new Date(d.getTime() - daysToMon * 86400000);
                    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
                    const sunday = new Date(monday.getTime() + 6 * 86400000);
                    const weekEnd = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
                    // 撈該週所有公休／假日
                    const weekEvents = await db.prepare(
                        "SELECT date, kind, label FROM company_calendar WHERE date >= ? AND date <= ? AND kind IN ('national_holiday', 'company_off') ORDER BY date"
                    ).all(weekStart, weekEnd);
                    // 撈該週所有加班日（覆蓋預設）
                    const onDays = await db.prepare(
                        "SELECT date FROM company_calendar WHERE date >= ? AND date <= ? AND kind = 'company_on' ORDER BY date"
                    ).all(weekStart, weekEnd);
                    const offDates = weekEvents.map((e) => e.date);
                    const workDates = onDays.map((e) => e.date);
                    const titleBase = event?.label || "節日";
                    const lines = [];
                    if (offDates.length) {
                        const offFmt = offDates.map((iso) => {
                            const dd = new Date(iso + "T12:00:00");
                            const wd = ["日", "一", "二", "三", "四", "五", "六"][dd.getDay()];
                            return `${iso.slice(0, 4)}/${iso.slice(5, 7)}/${iso.slice(8, 10)}（${wd}）`;
                        }).join("、");
                        lines.push(`${offFmt} 為本公司休假日，請預估使用量提前叫貨喔～`);
                    }
                    if (workDates.length) {
                        const onFmt = workDates.map((iso) => {
                            const dd = new Date(iso + "T12:00:00");
                            const wd = ["日", "一", "二", "三", "四", "五", "六"][dd.getDay()];
                            return `${iso.slice(0, 4)}/${iso.slice(5, 7)}/${iso.slice(8, 10)}（${wd}）`;
                        }).join("、");
                        lines.push(`${onFmt} 公司正常上班。`);
                    }
                    initialData = {
                        title: `${titleBase}休假公告`,
                        week_start: weekStart,
                        off_dates: offDates.join(","),
                        work_dates: workDates.join(","),
                        lines: lines.join("\n"),
                        footer: "祝 佳節愉快",
                    };
                }
            } catch (e) {
                console.warn("[announcements/new from_calendar]", e?.message || e);
            }
        }

        const fieldsHtml = renderAnnouncementFormFields(tpl, initialData);
        const body = `${ANN_CSS}
<div class="notion-page-content">
<p style="margin:0 0 6px;"><a href="/admin/announcements/new">← 重選模板</a></p>
<h1 class="notion-h1" style="margin:0 0 4px;">${tpl.icon} ${escapeHtml(tpl.label)}</h1>
<p style="color:#888;font-size:13px;margin-bottom:14px;">${escapeHtml(tpl.description)}</p>
<form method="post" action="/admin/announcements" class="ann-form notion-card" style="padding:20px;">
<input type="hidden" name="template_id" value="${escapeAttr(tpl.id)}">
${fieldsHtml}
<div style="display:flex;gap:10px;margin-top:18px;">
  <button type="submit" class="btn btn-primary">儲存草稿</button>
  <a href="/admin/announcements" class="btn">取消</a>
</div>
</form>
</div>
<script>
function annAddItemRow(id){
  const wrap=document.getElementById(id);
  const div=document.createElement('div');
  div.className='row';
  div.innerHTML='<input type="text" placeholder="品名" name="item_name"><input type="text" placeholder="價格" class="col-price" name="item_price"><input type="text" placeholder="單位" class="col-unit" name="item_unit" value="斤"><input type="text" placeholder="行情" class="col-market" name="item_market"><button type="button" class="col-rm" onclick="this.parentElement.remove()" title="刪除">×</button>';
  wrap.appendChild(div);
}
</script>`;
        res.type("text/html").send(notionPage("新增公告", body, "announcements", res));
    });

    router.post("/announcements", requireManager, express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const templateId = String(req.body.template_id || "").trim();
        const tpl = announcement_templates_js_1.getTemplate(templateId);
        if (!tpl) { res.status(400).send("未知的模板"); return; }
        const payload = parseFormBody(tpl, req.body);
        const title = String(payload.title || "(未命名)").trim() || "(未命名)";
        const id = (0, id_js_1.newId)("ann");
        await db.prepare(`INSERT INTO announcements (id, template_id, title, payload_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ${nowSqlExpr()}, ${nowSqlExpr()})`)
            .run(id, templateId, title, JSON.stringify(payload));
        res.redirect(`/admin/announcements/${encodeURIComponent(id)}?ok=created`);
    });

    router.get("/announcements/:id", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id, template_id, title, payload_json, status, created_at, sent_at, sent_to_groups_json FROM announcements WHERE id = ?").get(id);
        if (!row) { res.status(404).send("公告不存在"); return; }
        const tpl = announcement_templates_js_1.getTemplate(row.template_id);
        if (!tpl) { res.status(500).send("模板不存在：" + row.template_id); return; }
        const data = JSON.parse(row.payload_json || "{}");
        const previewHtml = announcement_templates_js_1.renderHtmlPreview(row.template_id, data);
        const customers = await db.prepare("SELECT id, name FROM customers WHERE line_group_id IS NOT NULL AND line_group_id != '' ORDER BY name ASC").all();
        const okMsg = req.query.ok === "created" ? "已建立草稿" : (req.query.ok === "sent" ? `已成功送出至 ${req.query.n || "?"} 個群組` : "");
        const errMsg = req.query.err ? decodeURIComponent(String(req.query.err)) : "";
        const sentGroups = row.sent_to_groups_json ? JSON.parse(row.sent_to_groups_json) : null;
        const sentInfo = sentGroups && Array.isArray(sentGroups) && sentGroups.length
            ? `<p style="color:#047857;font-size:13px;margin:8px 0 0;">✓ 已送至 ${sentGroups.length} 個群組（最後送出：${row.sent_at ? String(row.sent_at).slice(0, 16).replace("T", " ") : "—"}）</p>` : "";
        const body = `${ANN_CSS}
<div class="notion-page-content">
<p style="margin:0 0 6px;"><a href="/admin/announcements">← 公告管理</a></p>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
  <h1 class="notion-h1" style="margin:0;">${escapeHtml(row.title)} ${statusBadge(row.status)}</h1>
  <div style="display:flex;gap:8px;">
    <a href="/admin/announcements/${encodeURIComponent(id)}/image.png" download="${escapeAttr(row.title || "announcement")}.png" class="btn">下載 PNG</a>
    <form method="post" action="/admin/announcements/${encodeURIComponent(id)}/delete" style="display:inline;" onsubmit="return confirm('確定刪除？');"><button type="submit" class="btn">刪除</button></form>
  </div>
</div>
<p style="color:#888;font-size:13px;">模板：${tpl.icon} ${escapeHtml(tpl.label)} · 建立：${row.created_at ? String(row.created_at).slice(0, 16).replace("T", " ") : "—"}</p>
${okMsg ? `<p class="notion-msg ok" style="background:#ecfdf5;color:#047857;padding:8px 12px;border-radius:6px;border:1px solid #a7f3d0;">✓ ${escapeHtml(okMsg)}</p>` : ""}
${errMsg ? `<p class="notion-msg err" style="background:#fef2f2;color:#b91c1c;padding:8px 12px;border-radius:6px;border:1px solid #fecaca;">✗ ${escapeHtml(errMsg)}</p>` : ""}
${sentInfo}

<div class="ann-preview-pane">
  <div class="ann-preview-col">
    <h3>HTML 預覽（送 LINE 用）</h3>
    ${previewHtml}
  </div>
  <div class="ann-preview-col">
    <h3>PNG 圖片預覽（下載分享用）</h3>
    <img src="/admin/announcements/${encodeURIComponent(id)}/image.png" alt="PNG 預覽">
  </div>
</div>

<div class="notion-card" style="margin-top:24px;padding:20px;max-width:760px;">
  <h3 style="margin:0 0 12px;font-size:15px;">傳送至 LINE 群組</h3>
  <form method="post" action="/admin/announcements/${encodeURIComponent(id)}/send" onsubmit="if(this.dataset.submitting)return false;if(!confirm('確定傳送至選定的 LINE 群組？'))return false;this.dataset.submitting='1';return true;">
    <div class="field" style="margin-bottom:14px;">
      <label class="fl">傳送對象</label>
      <select name="recipients" style="width:100%;max-width:340px;padding:8px 10px;border:1px solid var(--notion-border-strong);border-radius:6px;background:var(--notion-canvas);color:var(--notion-text);">
        <option value="all">全部客戶（${customers.length} 個 LINE 群組）</option>
        ${customers.map((c) => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)}</option>`).join("")}
      </select>
    </div>
    <button type="submit" class="btn btn-primary">傳送</button>
  </form>
</div>
</div>`;
        res.type("text/html").send(notionPage(row.title, body, "announcements", res));
    });

    router.post("/announcements/:id/delete", requireManager, async (req, res) => {
        await db.prepare("DELETE FROM announcements WHERE id = ?").run(req.params.id);
        res.redirect("/admin/announcements");
    });

    router.get("/announcements/:id/image.png", async (req, res) => {
        const row = await db.prepare("SELECT template_id, payload_json FROM announcements WHERE id = ?").get(req.params.id);
        if (!row) { res.status(404).send("not found"); return; }
        try {
            const data = JSON.parse(row.payload_json || "{}");
            const buf = await announcement_image_js_1.renderAnnouncementPng(row.template_id, data);
            if (!buf) { res.status(404).send("此模板不支援 PNG 渲染"); return; }
            res.set("Content-Type", "image/png");
            res.set("Cache-Control", "private, max-age=60");
            res.send(buf);
        } catch (e) {
            console.error("[announcement-image]", e?.message || e);
            res.status(500).send("PNG 渲染失敗：" + (e?.message || "unknown"));
        }
    });

    router.post("/announcements/:id/send", requireManager, express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        const row = await db.prepare("SELECT template_id, title, payload_json FROM announcements WHERE id = ?").get(id);
        if (!row) { res.status(404).send("公告不存在"); return; }
        if (!token) { res.redirect(`/admin/announcements/${encodeURIComponent(id)}?err=${encodeURIComponent("未設定 LINE_CHANNEL_ACCESS_TOKEN")}`); return; }
        let lineMsg;
        try {
            const data = JSON.parse(row.payload_json || "{}");
            lineMsg = announcement_templates_js_1.buildFlexMessage(row.template_id, data);
        } catch (e) {
            res.redirect(`/admin/announcements/${encodeURIComponent(id)}?err=${encodeURIComponent("Flex Message 建立失敗：" + (e?.message || ""))}`);
            return;
        }
        const recipients = String(req.body.recipients || "all");
        let targets = [];
        if (recipients !== "all") {
            const cust = await db.prepare("SELECT id, line_group_id, name FROM customers WHERE id = ? AND line_group_id IS NOT NULL AND line_group_id != ''").get(recipients);
            if (cust) targets = [cust];
        } else {
            targets = await db.prepare("SELECT id, line_group_id, name FROM customers WHERE line_group_id IS NOT NULL AND line_group_id != '' ORDER BY name ASC").all();
        }
        let sent = 0;
        const errors = [];
        const sentGroupIds = [];
        for (const t of targets) {
            try {
                const resp = await fetch("https://api.line.me/v2/bot/message/push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ to: t.line_group_id, messages: [lineMsg] }),
                });
                if (resp.ok) { sent++; sentGroupIds.push(t.id); }
                else { errors.push(`${t.name}: ${resp.status} ${(await resp.text().catch(() => "")).slice(0, 100)}`); }
            } catch (e) {
                errors.push(`${t.name}: ${e?.message || e}`);
            }
        }
        if (errors.length) console.warn("[announcement-send]", errors.join(" | "));
        await db.prepare(`UPDATE announcements SET status = 'sent', sent_at = ${nowSqlExpr()}, sent_to_groups_json = ?, updated_at = ${nowSqlExpr()} WHERE id = ?`)
            .run(JSON.stringify(sentGroupIds), id);
        if (sent === 0 && errors.length) {
            res.redirect(`/admin/announcements/${encodeURIComponent(id)}?err=${encodeURIComponent("全部失敗：" + errors[0])}`);
            return;
        }
        res.redirect(`/admin/announcements/${encodeURIComponent(id)}?ok=sent&n=${sent}`);
    });
}
