"use strict";
/**
 * 公告模板註冊：定義每個模板的欄位 schema、HTML 預覽、LINE Flex Message 結構。
 * 新增模板只需加一個 entry 並實作 buildHtml + buildFlex；後台會自動列出。
 *
 * 設計原則：模板資料以 JSON 存進 announcements.payload_json，欄位由 fields[] 描述，
 * 後台可動態渲染表單；不同模板可共用 calendar / item rows 等 sub-component。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTemplates = listTemplates;
exports.getTemplate = getTemplate;
exports.renderHtmlPreview = renderHtmlPreview;
exports.buildFlexMessage = buildFlexMessage;
exports.coerceItemList = coerceItemList;

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function coerceItemList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((it) => ({
            name: String(it?.name ?? "").trim(),
            price: String(it?.price ?? "").trim(),
            unit: String(it?.unit ?? "").trim() || "斤",
            market: String(it?.market ?? "").trim(),
        }))
        .filter((it) => it.name);
}

/** 週曆 mini-grid：給節日紅底模板嵌入用。highlights = { 'YYYY-MM-DD': {label, color} } */
function renderWeekStripHtml(weekStartIso, highlights) {
    const labels = ["一", "二", "三", "四", "五", "六", "日"];
    const cells = [];
    const start = new Date(weekStartIso + "T12:00:00");
    if (Number.isNaN(start.getTime())) return "";
    for (let i = 0; i < 7; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const dayLabel = (i === 0 ? `${d.getMonth() + 1}/` : "") + d.getDate();
        const hl = highlights?.[iso] || null;
        const tone = hl?.color === "red" ? "background:#fff3f3;border-color:#ffd6d6;color:#c0392b;" :
            hl?.color === "amber" ? "background:#fff8e1;border-color:#ffe082;color:#b45309;" :
            "background:#fff;border-color:rgba(255,255,255,0.45);color:#333;";
        cells.push(`<div class="ann-week-cell" style="${tone}"><div class="ann-week-day">${escapeHtml(labels[i])}</div><div class="ann-week-date">${escapeHtml(String(dayLabel))}</div>${hl ? `<div class="ann-week-tag">${escapeHtml(hl.label)}</div>` : ""}</div>`);
    }
    return `<div class="ann-week-strip">${cells.join("")}</div>`;
}

// ---------- Template 1: 節日休假公告（紅底） ----------
const HOLIDAY_RED = {
    id: "holiday_red",
    label: "節日休假公告",
    icon: "🏮",
    description: "節日／國定假日／公司公休 — 紅底配週曆，跟你提供的勞動節範例同款",
    fields: [
        { name: "title", label: "公告標題", type: "text", required: true, placeholder: "例：勞動節休假公告" },
        { name: "week_start", label: "週起始日（週一）", type: "date", required: true, hint: "選此公告要標示的那一週的週一" },
        { name: "off_dates", label: "公休日（多個用逗號分隔，YYYY-MM-DD）", type: "text", placeholder: "例：2026-05-01,2026-05-03" },
        { name: "work_dates", label: "正常上班日（覆蓋假日標示）", type: "text", placeholder: "例：2026-05-02" },
        { name: "lines", label: "公告內文（每行一條，可空）", type: "textarea", placeholder: "例：\n2026/5/1（五）、2026/5/3（日）為本公司休假日，請預估使用量提前叫貨喔～\n2026/5/2（六）公司正常上班。" },
        { name: "footer", label: "結尾祝賀詞", type: "text", placeholder: "例：祝 佳節愉快" },
    ],
    altText: "松富物流公告",
    buildHtml(data) {
        const off = String(data.off_dates || "").split(",").map(s => s.trim()).filter(Boolean);
        const on = String(data.work_dates || "").split(",").map(s => s.trim()).filter(Boolean);
        const highlights = {};
        for (const d of off) highlights[d] = { label: "公休", color: "red" };
        for (const d of on) highlights[d] = { label: "上班", color: "amber" };
        const week = data.week_start ? renderWeekStripHtml(data.week_start, highlights) : "";
        const lines = String(data.lines || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const linesHtml = lines.map((l, i) => `<div class="ann-line"><span class="ann-line-no">${i + 1}.</span> ${escapeHtml(l)}</div>`).join("");
        return `
<div class="ann-card ann-holiday-red">
  <div class="ann-title">${escapeHtml(data.title || "公告")}</div>
  ${week}
  <div class="ann-body">${linesHtml}</div>
  <div class="ann-footer">${escapeHtml(data.footer || "")}</div>
  <div class="ann-brand">松富物流</div>
</div>`;
    },
    buildFlex(data) {
        const lines = String(data.lines || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const off = String(data.off_dates || "").split(",").map(s => s.trim()).filter(Boolean);
        const dateRangeLabel = off.length ? `公休：${off.join("、")}` : (data.week_start || "");
        return {
            type: "bubble",
            size: "kilo",
            header: {
                type: "box", layout: "vertical", paddingAll: "20px", backgroundColor: "#a82323",
                contents: [
                    { type: "text", text: data.title || "公告", weight: "bold", color: "#ffffff", size: "xl", align: "center", wrap: true },
                    ...(dateRangeLabel ? [{ type: "text", text: dateRangeLabel, color: "#ffe5d4", size: "sm", align: "center", margin: "sm", wrap: true }] : []),
                ],
            },
            body: {
                type: "box", layout: "vertical", paddingAll: "20px", backgroundColor: "#fafafa", spacing: "md",
                contents: [
                    ...(lines.length ? lines.map((l, i) => ({ type: "text", text: `${i + 1}. ${l}`, size: "sm", color: "#3d2929", wrap: true })) : [{ type: "text", text: "（無說明）", color: "#999", size: "sm" }]),
                    ...(data.footer ? [{ type: "text", text: data.footer, size: "md", color: "#a82323", weight: "bold", align: "center", margin: "lg" }] : []),
                ],
            },
            footer: {
                type: "box", layout: "vertical", paddingAll: "12px", backgroundColor: "#fff3e6",
                contents: [{ type: "text", text: "— 松富物流 敬上 —", size: "xs", color: "#a82323", align: "center" }],
            },
        };
    },
};

// ---------- Template 2: 限時優惠（黃底） ----------
const PROMO_YELLOW = {
    id: "promo_yellow",
    label: "限時優惠",
    icon: "⚡",
    description: "限時特價／搶購活動 — 帶入品名、優惠價、行情價對照",
    fields: [
        { name: "title", label: "活動標題", type: "text", required: true, placeholder: "例：本週限時特價" },
        { name: "promo_date", label: "優惠時間", type: "text", required: true, placeholder: "例：5/3（六）早上 6 點前" },
        { name: "subtitle", label: "副標題（選填）", type: "text", placeholder: "例：當日限量，先搶先贏" },
        { name: "items", label: "品項清單", type: "items", placeholder: "品名 / 優惠價 / 單位 / 行情上價" },
        { name: "note", label: "備註（選填）", type: "text", placeholder: "例：需提前告知數量" },
    ],
    altText: "松富物流限時優惠",
    buildHtml(data) {
        const items = coerceItemList(data.items);
        const itemsHtml = items.length
            ? items.map((it) => `
<div class="ann-promo-item">
  <div class="ann-promo-item-name">${escapeHtml(it.name)}</div>
  <div class="ann-promo-item-price"><span class="ann-promo-price-now">${escapeHtml(it.price || "—")}</span><span class="ann-promo-unit">/${escapeHtml(it.unit)}</span></div>
  ${it.market ? `<div class="ann-promo-item-market">行情 ${escapeHtml(it.market)}</div>` : ""}
</div>`).join("")
            : `<div class="ann-empty">（尚未加入品項）</div>`;
        return `
<div class="ann-card ann-promo-yellow">
  <div class="ann-promo-header">
    <div class="ann-promo-bolt">⚡</div>
    <div class="ann-promo-titles">
      <div class="ann-title">${escapeHtml(data.title || "限時優惠")}</div>
      ${data.subtitle ? `<div class="ann-promo-sub">${escapeHtml(data.subtitle)}</div>` : ""}
    </div>
  </div>
  <div class="ann-promo-date">${escapeHtml(data.promo_date || "")}</div>
  <div class="ann-promo-items">${itemsHtml}</div>
  ${data.note ? `<div class="ann-promo-note">📌 ${escapeHtml(data.note)}</div>` : ""}
  <div class="ann-brand">松富物流</div>
</div>`;
    },
    buildFlex(data) {
        const items = coerceItemList(data.items);
        return {
            type: "bubble", size: "kilo",
            header: {
                type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#f5b800",
                contents: [
                    { type: "text", text: `⚡ ${data.title || "限時優惠"}`, weight: "bold", color: "#3d2c00", size: "lg", wrap: true },
                    ...(data.subtitle ? [{ type: "text", text: data.subtitle, color: "#5c4400", size: "xs", margin: "xs" }] : []),
                    ...(data.promo_date ? [{ type: "text", text: data.promo_date, color: "#3d2c00", size: "sm", weight: "bold", margin: "md" }] : []),
                ],
            },
            body: {
                type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#fffaeb", spacing: "sm",
                contents: items.length ? items.map((it) => ({
                    type: "box", layout: "horizontal", spacing: "sm",
                    contents: [
                        { type: "text", text: it.name, flex: 4, size: "sm", weight: "bold", color: "#3d2c00", wrap: true },
                        { type: "text", text: `${it.price || "—"} /${it.unit}`, flex: 3, size: "sm", color: "#a8540a", align: "end" },
                        ...(it.market ? [{ type: "text", text: `行情 ${it.market}`, flex: 3, size: "xs", color: "#9a7b3a", align: "end" }] : []),
                    ],
                })) : [{ type: "text", text: "（尚未加入品項）", color: "#999", size: "sm" }],
            },
            ...(data.note ? {
                footer: {
                    type: "box", layout: "vertical", paddingAll: "12px", backgroundColor: "#fff5d6",
                    contents: [{ type: "text", text: `📌 ${data.note}`, size: "xs", color: "#5c4400", wrap: true }],
                },
            } : {}),
        };
    },
};

// ---------- Template 3: 一般通知（深色） ----------
const NOTICE_DARK = {
    id: "notice_dark",
    label: "一般通知",
    icon: "📢",
    description: "簡易文字通知 — 標題 + 內文",
    fields: [
        { name: "title", label: "通知標題", type: "text", required: true, placeholder: "例：本週叫貨提醒" },
        { name: "content", label: "通知內容", type: "textarea", required: true, placeholder: "請輸入通知內容..." },
    ],
    altText: "松富物流通知",
    buildHtml(data) {
        const paragraphs = String(data.content || "").split(/\r?\n\r?\n/).map(p => p.trim()).filter(Boolean);
        return `
<div class="ann-card ann-notice-dark">
  <div class="ann-notice-header">
    <span class="ann-notice-icon">📢</span>
    <span class="ann-title ann-notice-title">${escapeHtml(data.title || "通知")}</span>
  </div>
  <div class="ann-notice-body">
    ${paragraphs.map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("")}
  </div>
  <div class="ann-brand ann-brand-light">松富物流 敬上</div>
</div>`;
    },
    buildFlex(data) {
        return {
            type: "bubble", size: "kilo",
            header: {
                type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#2c3e50",
                contents: [
                    { type: "text", text: "📢 通知", color: "#90b8d8", size: "xs" },
                    { type: "text", text: data.title || "通知", weight: "bold", color: "#ffffff", size: "lg", margin: "sm", wrap: true },
                ],
            },
            body: {
                type: "box", layout: "vertical", paddingAll: "16px",
                contents: [{ type: "text", text: data.content || "", size: "sm", color: "#37352f", wrap: true }],
            },
            footer: {
                type: "box", layout: "vertical", paddingAll: "10px", backgroundColor: "#f7f6f3",
                contents: [{ type: "text", text: "— 松富物流 敬上 —", size: "xs", color: "#787774", align: "center" }],
            },
        };
    },
};

// ---------- Template 4: 新品上架（綠底） ----------
const NEW_ARRIVAL_GREEN = {
    id: "new_arrival_green",
    label: "新品上架",
    icon: "🌿",
    description: "新品介紹 — 名稱、特色、CTA",
    fields: [
        { name: "title", label: "新品名稱", type: "text", required: true, placeholder: "例：日本特選鮭魚卵" },
        { name: "tagline", label: "一句話特色", type: "text", placeholder: "例：北海道直送，限量到貨" },
        { name: "highlights", label: "特色（每行一條）", type: "textarea", placeholder: "例：\n◆ 顆粒飽滿\n◆ 冷凍宅配" },
        { name: "price_label", label: "價格資訊（選填）", type: "text", placeholder: "例：每盒 NT$680" },
        { name: "cta", label: "行動呼籲", type: "text", placeholder: "例：欲訂請洽業務" },
    ],
    altText: "松富物流新品上架",
    buildHtml(data) {
        const highlights = String(data.highlights || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        return `
<div class="ann-card ann-new-arrival-green">
  <div class="ann-new-tag">NEW · 新品</div>
  <div class="ann-title">${escapeHtml(data.title || "新品上架")}</div>
  ${data.tagline ? `<div class="ann-new-tagline">${escapeHtml(data.tagline)}</div>` : ""}
  <div class="ann-new-highlights">
    ${highlights.map(h => `<div class="ann-new-bullet">${escapeHtml(h)}</div>`).join("")}
  </div>
  ${data.price_label ? `<div class="ann-new-price">${escapeHtml(data.price_label)}</div>` : ""}
  ${data.cta ? `<div class="ann-new-cta">${escapeHtml(data.cta)}</div>` : ""}
  <div class="ann-brand">松富物流</div>
</div>`;
    },
    buildFlex(data) {
        const highlights = String(data.highlights || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        return {
            type: "bubble", size: "kilo",
            header: {
                type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#1e7a5e",
                contents: [
                    { type: "text", text: "🌿 NEW · 新品上架", color: "#cdebd9", size: "xs" },
                    { type: "text", text: data.title || "新品", weight: "bold", color: "#ffffff", size: "lg", margin: "sm", wrap: true },
                    ...(data.tagline ? [{ type: "text", text: data.tagline, color: "#cdebd9", size: "sm", margin: "xs", wrap: true }] : []),
                ],
            },
            body: {
                type: "box", layout: "vertical", paddingAll: "16px", spacing: "sm",
                contents: [
                    ...highlights.map(h => ({ type: "text", text: `◆ ${h}`, size: "sm", color: "#37352f", wrap: true })),
                    ...(data.price_label ? [{ type: "text", text: data.price_label, size: "md", color: "#1e7a5e", weight: "bold", margin: "md" }] : []),
                    ...(data.cta ? [{ type: "text", text: data.cta, size: "sm", color: "#787774", margin: "sm", wrap: true }] : []),
                ],
            },
        };
    },
};

const TEMPLATES = [HOLIDAY_RED, PROMO_YELLOW, NOTICE_DARK, NEW_ARRIVAL_GREEN];
const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

function listTemplates() {
    return TEMPLATES.map((t) => ({
        id: t.id, label: t.label, icon: t.icon, description: t.description, fields: t.fields,
    }));
}

function getTemplate(id) {
    return TEMPLATE_BY_ID[id] || null;
}

function renderHtmlPreview(templateId, data) {
    const t = getTemplate(templateId);
    if (!t) throw new Error(`未知的公告模板：${templateId}`);
    return t.buildHtml(data || {});
}

function buildFlexMessage(templateId, data) {
    const t = getTemplate(templateId);
    if (!t) throw new Error(`未知的公告模板：${templateId}`);
    const altText = (data && data.title) ? String(data.title).slice(0, 80) : t.altText;
    return {
        type: "flex",
        altText: altText || "松富物流公告",
        contents: t.buildFlex(data || {}),
    };
}
