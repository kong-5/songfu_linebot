"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerQuotesRoutes = registerQuotesRoutes;

// 客戶報價域（月報與飯店客戶報價：列表/建立/管理品項/表頭/狀態/刪除/字型/列印頁/JPG/PDF）路由：
// 自 index.js 拆出（拆檔批次 6），純搬移、行為不變。
// 註：報價頁 icon 集合 QI 留 index.js（儀表板的「報價提醒」卡片也在用），經 ctx 傳入。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const quote_report_js_1 = require("../lib/quote-report.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerQuotesRoutes(router, ctx) {
    const { db, notionPage, logDataChange, QI, getTaipeiCalendarDateYYYYMMDD } = ctx;
    // 客戶報價（月報） /admin/quotes
    // ===================================================================
    const QUOTE_STATUS_LABEL = { draft: "草稿", finalized: "已完成" };

    // 報價單字型選項（非宋體；以圓體為主，附系統字型 fallback）。存 app_settings.quote_font。
    const QUOTE_FONTS = {
        rounded:  { label: "圓體", css: "'Yuanti TC','Yuanti SC','YuanTi TC','Hiragino Maru Gothic ProN','jf-openhuninn','Noto Sans TC','PingFang TC',sans-serif" },
        gothic:   { label: "黑體", css: "'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" },
        pingfang: { label: "蘋方黑", css: "'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif" },
        rounded2: { label: "圓潤黑", css: "'Hiragino Maru Gothic ProN','Yuanti TC','jf-openhuninn','Noto Sans TC','PingFang TC',sans-serif" },
    };
    const QUOTE_FONT_DEFAULT = "rounded";
    async function getQuoteFontKey() {
        try {
            const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("quote_font");
            const k = row && row.value ? String(row.value) : "";
            return QUOTE_FONTS[k] ? k : QUOTE_FONT_DEFAULT;
        } catch (_) { return QUOTE_FONT_DEFAULT; }
    }
    function quoteFontCss(key) { return (QUOTE_FONTS[key] || QUOTE_FONTS[QUOTE_FONT_DEFAULT]).css; }


    /**
     * 報價單列印頁（獨立 HTML，A4 兩欄，供瀏覽器「儲存成 PDF」）。
     * 字級放大方便年長客戶閱讀；品項多時自動分成多頁（每頁重印表頭與頁次）。
     */
    function renderQuoteSheetHtml(report, groups, logo, fontKey) {
        const fkey = QUOTE_FONTS[fontKey] ? fontKey : QUOTE_FONT_DEFAULT;
        const fontCss = quoteFontCss(fkey);
        const rows = quote_report_js_1.buildDisplayRows(groups);
        const itemCount = rows.filter(r => r.type === "item").length;
        // 每頁列數：兩欄合計；抓約可容納一整頁 A4 的量（保留邊界避免溢出到下一頁），讓內容自動分頁。
        const PAGE_ROWS = 50;
        const pages = [];
        for (let i = 0; i < rows.length; i += PAGE_ROWS) pages.push(rows.slice(i, i + PAGE_ROWS));
        if (pages.length === 0) pages.push([]);
        const totalPages = pages.length;

        const colHtml = (colRows) => {
            let out = "";
            for (const r of colRows) {
                if (r.type === "cat") {
                    out += `<tr class="catrow"><td colspan="4">${escapeHtml(r.category)}<span class="catn">${r.count} 項</span></td></tr>`;
                } else {
                    const price = r.quoted ? escapeHtml(r.priceText) : `<span class="noq">—</span>`;
                    out += `<tr><td class="seq">${r.seq}</td><td class="nm">${escapeHtml(r.name)}</td><td class="sp">${escapeHtml(r.spec)}</td><td class="pr">${price}</td></tr>`;
                }
            }
            return out;
        };
        const logoHtml = logo
            ? `<img class="logo" src="${escapeAttr(logo)}" alt="LOGO">`
            : `<div class="logo-ph">LOGO</div>`;
        const colgroup = `<colgroup><col style="width:11%"><col style="width:45%"><col style="width:30%"><col style="width:14%"></colgroup>`;
        const thead = `${colgroup}<thead><tr><th>序號</th><th>品　名</th><th>規　格</th><th>單價</th></tr></thead>`;
        const pagesHtml = pages.map((pg, idx) => {
            const [colL, colR] = quote_report_js_1.splitTwoColumns(pg);
            return `<div class="sheet">
  <div class="head">
    ${logoHtml}
    <div class="head-mid">
      <h1>${escapeHtml(report.title || "報 價 單")}</h1>
      <h2>${escapeHtml(report.subtitle || "產 品 表")}</h2>
      <div class="co">${escapeHtml(report.company || "")}　${escapeHtml(report.roc_label || "")}</div>
    </div>
    <div class="head-info">${escapeHtml(report.address || "")}<br>Tel：${escapeHtml(report.tel || "")}<br>Fax：${escapeHtml(report.fax || "")}<br><span class="pageno">第 ${idx + 1} 頁，共 ${totalPages} 頁</span></div>
  </div>
  <div class="cols">
    <table>${thead}<tbody>${colHtml(colL)}</tbody></table>
    <table>${thead}<tbody>${colHtml(colR)}</tbody></table>
  </div>
  <div class="foot">松富物流 · 本報價單為 ${escapeHtml(report.roc_label || report.ym || "")}　單位：新台幣元　「—」表該項本月不報價</div>
</div>`;
        }).join("");

        return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(report.company || "報價單")} ${escapeHtml(report.roc_label || report.ym || "")}</title>
<style>
  :root{ --green:#1a6fb5; --line:#c8d0da; }
  *{ box-sizing:border-box; }
  body{ font-family:${fontCss}; margin:0; color:#1c1c1c; background:#f3f4f6; }
  .toolbar select{ font:inherit; font-size:13px; padding:6px 8px; border:1px solid var(--line); border-radius:6px; background:#fff; color:#333; }
  .toolbar .fontlbl{ font-size:12px; color:#889; }
  .toolbar{ position:sticky; top:0; background:#fff; border-bottom:1px solid var(--line); padding:10px 16px; display:flex; gap:8px; align-items:center; z-index:5; }
  .toolbar a,.toolbar button{ font:inherit; font-size:13px; padding:7px 14px; border:1px solid var(--line); border-radius:6px; background:#fff; color:#333; text-decoration:none; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
  .toolbar svg{ width:15px; height:15px; }
  .toolbar .primary{ background:var(--green); color:#fff; border-color:var(--green); }
  .toolbar .sp{ flex:1; }
  .sheet{ width:210mm; min-height:297mm; margin:16px auto; background:#fff; padding:12mm 10mm; box-shadow:0 1px 6px rgba(0,0,0,.12); }
  .head{ display:flex; align-items:flex-start; gap:14px; border-bottom:3px solid var(--green); padding-bottom:8px; }
  .logo,.logo-ph{ width:82px; height:82px; object-fit:contain; }
  .logo-ph{ border:1px dashed var(--line); display:flex; align-items:center; justify-content:center; color:#aab; font-size:12px; }
  .head-mid{ flex:1; text-align:center; }
  .head-mid h1{ margin:0; font-size:34px; letter-spacing:9px; color:var(--green); }
  .head-mid h2{ margin:2px 0 4px; font-size:19px; letter-spacing:9px; color:#334; }
  .head-mid .co{ font-size:18px; font-weight:600; }
  .head-info{ font-size:12px; color:#556; text-align:right; white-space:nowrap; line-height:1.6; }
  .head-info .pageno{ color:#889; }
  .cols{ display:flex; gap:7mm; margin-top:8px; }
  .cols table{ flex:1; width:50%; border-collapse:collapse; font-size:16px; table-layout:fixed; }
  th,td{ border:1px solid #d7dee6; padding:3px 7px; overflow:hidden; vertical-align:middle; }
  thead th{ background:#eef2f7; color:#223; font-size:14px; white-space:nowrap; }
  td.seq{ text-align:center; color:#667; font-size:13px; white-space:nowrap; }
  td.nm{ font-size:16px; font-weight:500; white-space:normal; word-break:break-word; line-height:1.25; }
  td.sp{ color:#556; font-size:13px; white-space:nowrap; text-overflow:ellipsis; }
  td.pr{ text-align:right; font-weight:700; font-size:17px; white-space:nowrap; }
  .noq{ color:#b0b6bf; font-weight:400; }
  tr.catrow td{ background:var(--green); color:#fff; font-weight:700; letter-spacing:2px; font-size:16px; padding:4px 10px; }
  tr.catrow .catn{ float:right; font-weight:400; font-size:12px; color:#cdebd9; }
  tr:nth-child(even) td{ background:#f7f9fb; }
  tr.catrow:nth-child(even) td{ background:var(--green); }
  .foot{ margin-top:12px; text-align:center; font-size:13px; color:#99a; }
  @media print{ body{ background:#fff; } .toolbar{ display:none; } .sheet{ box-shadow:none; margin:0; width:auto; min-height:auto; padding:4mm; page-break-after:always; } .sheet:last-child{ page-break-after:auto; } @page{ size:A4; margin:8mm; } }
</style></head><body>
<div class="toolbar">
  <a class="primary" href="/admin/quotes/${escapeAttr(report.id)}/pdf">${QI.pdf}<span>下載 PDF</span></a>
  <button onclick="window.print()">${QI.print}<span>列印</span></button>
  <a href="/admin/quotes/${escapeAttr(report.id)}/image.jpg" download>${QI.image}<span>下載 JPG 圖</span></a>
  <a href="/admin/quotes/${escapeAttr(report.id)}">${QI.back}<span>回編輯</span></a>
  <span class="fontlbl">字型</span>
  <select id="qfont" onchange="qSetFont(this.value)" title="選擇報價單字型（會套用到列印與 JPG）">
    ${Object.entries(QUOTE_FONTS).map(([k, v]) => `<option value="${k}"${k === fkey ? " selected" : ""}>${escapeHtml(v.label)}</option>`).join("")}
  </select>
  <span class="sp"></span>
  <span style="font-size:12px;color:#889;">共 ${itemCount} 項 · ${totalPages} 頁 · ${escapeHtml(QUOTE_STATUS_LABEL[report.status] || report.status)}</span>
</div>
${pagesHtml}
<script>
var QFONTS = ${JSON.stringify(Object.fromEntries(Object.entries(QUOTE_FONTS).map(([k, v]) => [k, v.css])))};
function qSetFont(v){ if(!QFONTS[v]) return; document.body.style.fontFamily = QFONTS[v]; try{ fetch('/admin/quotes/font',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'font='+encodeURIComponent(v),credentials:'same-origin'}); }catch(e){} }
</script>
</body></html>`;
    }

    // 報價分三種：青菜月報（quote_report，id 前綴 qr_）、飯店客戶報價（hotel_quote，hq_）、
    // 冷凍報價（frozen_quote，fz_）。品項都存在 quote_item（report_id = 各自表頭 id），
    // 因此編輯／存檔／輸出邏輯可共用；只有「列表／建立／表頭／狀態／刪除」依 id 前綴分流。
    function quoteKindOf(id) {
        const s = String(id || "");
        if (s.startsWith("hq_")) return "hotel";
        if (s.startsWith("fz_")) return "frozen";
        return "monthly";
    }
    async function resolveQuoteRow(id) {
        const kind = quoteKindOf(id);
        if (kind === "hotel") return { kind, row: await quote_report_js_1.getHotelQuote(db, id) };
        if (kind === "frozen") return { kind, row: await quote_report_js_1.getFrozenQuote(db, id) };
        return { kind, row: await quote_report_js_1.getReport(db, id) };
    }

    // 分頁列（月報 / 冷凍報價 / 飯店客戶報價）
    function renderQuoteTabs(active) {
        const tab = (key, label, href) => `<a class="sf-qtab ${active === key ? "on" : ""}" href="${href}">${label}</a>`;
        return `<div class="sf-qtabs">
          ${tab("monthly", "月報", "/admin/quotes")}
          ${tab("frozen", "冷凍報價", "/admin/quotes?tab=frozen")}
          ${tab("hotel", "飯店客戶報價", "/admin/quotes?tab=hotel")}
        </div>`;
    }

    // 報價管理共用樣式（列表 + 分頁 + 編輯頁）
    const QUOTE_STYLE = `<style>
      .sf-qwrap{ padding:24px 32px; max-width:1000px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
      .sf-qhead h1{ margin:0; font-size:22px; font-weight:600; }
      .sf-qhead p{ margin:6px 0 0; color:var(--txt-3); font-size:13px; line-height:1.6; max-width:600px; }
      .sf-qtabs{ display:flex; gap:4px; border-bottom:var(--hairline); }
      .sf-qtab{ padding:9px 16px; font-size:14px; color:var(--txt-3); text-decoration:none; border-bottom:2px solid transparent; margin-bottom:-1px; }
      .sf-qtab:hover{ color:var(--txt-1); }
      .sf-qtab.on{ color:var(--notion-accent,#1a6fb5); border-bottom-color:var(--notion-accent,#1a6fb5); font-weight:600; }
      .sf-qbar{ display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:12px; }
      .sf-qnew{ margin:0; display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; }
      .sf-qnew label{ display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--txt-3); }
      .sf-qnew input, .sf-qnew select{ font:inherit; padding:8px 10px; border:1px solid var(--line); border-radius:8px; color:var(--txt-1); }
      .sf-qflash{ border-left:4px solid #16a34a; padding:10px 16px; font-size:13px; display:flex; align-items:center; gap:8px; }
      .sf-qflash svg{ width:17px; height:17px; color:#16a34a; flex:none; }
      .sf-qbar .sf-btn svg, .sf-qrow-actions .sf-btn svg, .sf-modebar svg{ width:15px; height:15px; }
      .sf-btn{ display:inline-flex; align-items:center; gap:6px; }
      .sf-qlist{ padding:0; overflow:hidden; }
      .sf-qlist-head, .sf-qrow{ display:grid; grid-template-columns:1fr auto minmax(220px,auto); gap:16px; align-items:center; padding:12px 18px; }
      .sf-qlist-head{ font-size:12px; color:var(--txt-3); border-bottom:var(--hairline); }
      .sf-qrow{ border-top:var(--hairline); }
      .sf-qrow:first-of-type{ border-top:none; }
      .sf-qrow:hover{ background:var(--bg-1); }
      .sf-qrow-name{ display:flex; flex-direction:column; text-decoration:none; }
      .sf-qrow-t1{ font-weight:600; color:var(--txt-1); }
      .sf-qrow-t2{ font-size:11px; color:var(--txt-3); }
      .sf-qrow-actions{ display:flex; gap:6px; justify-content:flex-end; flex-wrap:wrap; }
      .sf-qempty{ text-align:center; padding:40px 24px; display:flex; flex-direction:column; align-items:center; gap:8px; }
      .sf-qempty-icon{ color:var(--txt-3); line-height:0; }
      .sf-qempty-icon svg{ width:44px; height:44px; stroke-width:1.6; }
      .sf-qempty-title{ font-size:16px; font-weight:600; }
      .sf-qempty-desc{ color:var(--txt-3); font-size:13px; line-height:1.7; max-width:460px; margin:0 0 6px; }
      .sf-qremind{ display:flex; align-items:center; gap:12px; padding:14px 18px; border-left:4px solid #f59e0b; }
      .sf-qremind-ico{ display:inline-flex; color:#f59e0b; }
      .sf-qremind-ico svg{ width:22px; height:22px; }
      /* 編輯頁 */
      .qe-modebar{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
      /* 分段切換用全站標準 .sf-seg（見主樣式表） */
      .qe-cat{ display:flex; align-items:center; gap:8px; padding:4px 10px; margin-top:8px; background:var(--bg-1); border-radius:6px; font-weight:600; font-size:12px; color:#1a6fb5; }
      .qe-cat .n{ color:var(--txt-3); font-weight:400; font-size:11px; }
      .qe-row{ display:grid; align-items:center; gap:8px; padding:2px 10px; border-bottom:var(--hairline); }
      .qe-row:hover{ background:var(--bg-1); }
      /* 價格模式＝緊湊表格：序｜名稱｜單位｜前月｜價格｜不報價；兩欄平衡、置左 */
      .qe-price-mode{ max-width:1320px; }
      .qe-cols{ display:grid; grid-template-columns:1fr 1fr; gap:8px 20px; align-items:start; }
      .qe-col{ min-width:0; overflow-x:auto; }
      .qe-price-mode .qe-thead,
      .qe-price-mode .qe-row{ display:grid; align-items:center; gap:8px; min-width:440px;
        grid-template-columns:28px minmax(72px,1fr) 58px 96px 70px 46px; }
      .qe-price-mode .qe-row{ padding:1px 10px; }
      @media (max-width:960px){ .qe-price-mode{ max-width:800px; } .qe-cols{ grid-template-columns:1fr; } }
      .qe-thead{ padding:5px 10px; font-size:11px; font-weight:600; color:var(--txt-3); border-bottom:var(--hairline); }
      .qe-thead .qe-th-price, .qe-thead .qe-th-prev{ text-align:right; }
      .qe-thead .qe-th-noq{ text-align:center; }
      .qe-price-mode .qe-name{ flex-direction:row; align-items:baseline; gap:8px; }
      .qe-price-mode .qe-in{ padding:3px 8px; }
      /* 管理品項模式：握把｜序｜品名｜規格｜分類｜價格｜不報價｜上下移｜刪 */
      .qe-manage-mode .qe-row{ grid-template-columns:20px 28px 1.5fr 1.2fr 1fr 88px 76px 46px 38px; }
      /* 排序 UI（僅管理品項模式）：拖曳握把＋↑↓ 一格一格移；分類群組是拖放容器 */
      .qe-grp{ display:block; min-height:4px; }
      .qe-grp.qe-grp-empty{ min-height:28px; margin:4px 10px; border:1px dashed var(--line); border-radius:6px; }
      .qe-drag{ display:flex; align-items:center; justify-content:center; line-height:0; color:var(--txt-3); cursor:grab; }
      .qe-drag svg{ width:14px; height:14px; }
      .qe-row.qe-dragging{ opacity:.4; }
      .qe-row.qe-drop-hint{ box-shadow:inset 0 2px 0 0 var(--notion-accent,#1a6fb5); }
      .qe-move{ display:flex; gap:2px; }
      .qe-mv{ font:inherit; padding:2px 3px; line-height:0; border:1px solid var(--line); border-radius:4px; background:transparent; color:var(--txt-3); cursor:pointer; }
      .qe-mv:hover{ color:var(--txt-1); background:var(--bg-1); }
      .qe-mv svg{ width:12px; height:12px; display:block; }
      .qe-seq{ color:var(--txt-3); font-size:12px; text-align:center; }
      .qe-name{ display:flex; flex-direction:column; min-width:0; }
      .qe-nm{ font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .qe-spec{ font-size:12px; color:var(--txt-3); white-space:nowrap; }
      .qe-unit{ font-size:12px; color:var(--txt-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .qe-prev{ display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:1px; font-size:12px; line-height:1.2; color:var(--txt-3); text-align:right; overflow:hidden; }
      .qe-prev .qe-prevval{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
      .qe-delta{ font-size:10px; white-space:nowrap; font-weight:600; }
      .qe-prev .qe-up, .qe-delta.qe-up{ color:#d92d20; font-weight:600; }   /* 漲＝紅（台灣習慣）*/
      .qe-prev .qe-down, .qe-delta.qe-down{ color:#12805c; font-weight:600; } /* 跌＝綠 */
      .qe-in{ width:100%; font:inherit; padding:5px 8px; border:1px solid var(--line); border-radius:6px; box-sizing:border-box; }
      .qe-price{ text-align:right; }
      .qe-noq{ font-size:12px; color:var(--txt-3); display:flex; align-items:center; gap:4px; white-space:nowrap; justify-content:center; }
      /* 不報價 → 整列變暗（初始 is_quoted=0 也帶此 class） */
      .qe-row.qe-noq-on{ opacity:.5; }
      .qe-row.qe-noq-on .qe-nm,
      .qe-row.qe-noq-on .qe-unit,
      .qe-row.qe-noq-on .qe-prev{ color:var(--txt-3); }
      .qe-del{ color:#b91c1c; }
      @media (max-width:640px){
        .sf-qwrap{ padding:16px; }
        .sf-qlist-head{ display:none; }
        .sf-qrow{ grid-template-columns:1fr auto; row-gap:10px; }
        .sf-qrow-actions{ grid-column:1 / -1; justify-content:flex-start; }
        .qe-manage-mode .qe-row{ grid-template-columns:20px 28px 1fr 1fr; }
      }
    </style>`;

    /**
     * 編輯頁本體。kind='monthly'|'hotel'；manage=true 時顯示可改品名/規格/分類/刪除的「管理品項」模式，
     * 否則為「價格模式」——品名規格純文字、只編輯單價與不報價（每月主要操作）。
     */
    function renderQuoteEditor(row, groups, opts) {
        const kind = opts.kind;
        const manage = !!opts.manage;
        const okMsg = opts.okMsg || "";
        const id = row.id;
        const items = groups.flatMap(g => g.items);
        // 分類下拉依報價種類給對應那組（冷凍單不該出現「生鮮蔬菜」，反之亦然）；
        // 已存在於本份報價的分類一律保留，免得舊資料的分類在下拉裡消失、一存檔就被改掉。
        const baseCats = kind === "frozen" ? quote_report_js_1.FROZEN_CATEGORY_ORDER : quote_report_js_1.CATEGORY_ORDER;
        const allCats = Array.from(new Set([...baseCats, ...groups.map(g => g.category)]));
        const catOptions = (sel) => allCats.map(c => `<option value="${escapeAttr(c)}"${c === sel ? " selected" : ""}>${escapeHtml(c)}</option>`).join("");
        const enc = encodeURIComponent(id);
        const isHotel = kind === "hotel";
        const isFrozen = kind === "frozen";
        const titleMain = isHotel ? escapeHtml(row.customer_name || "飯店") : escapeHtml(row.roc_label || row.ym || "");
        const backHref = isHotel ? "/admin/quotes?tab=hotel" : isFrozen ? "/admin/quotes?tab=frozen" : "/admin/quotes";
        const backLabel = isHotel ? "飯店客戶報價" : isFrozen ? "冷凍報價" : "月報";
        const statusPill = row.status === "finalized"
            ? `<span class="sf-pill ok" style="vertical-align:middle;">已完成</span>`
            : `<span class="sf-pill warn" style="vertical-align:middle;">草稿</span>`;

        // 前月價格 map（僅價格模式、僅內部編輯頁使用；列印頁不受影響）。
        const prevMap = opts.prevMap instanceof Map ? opts.prevMap : null;
        const normName = (s) => String(s == null ? "" : s).replace(/\s+/g, "").toLowerCase();
        // 前月價資訊：回傳 { hasPrev, prevStr, prevNum }（僅價格模式使用）。
        function prevInfo(it) {
            if (!prevMap || prevMap.size === 0) return { hasPrev: false };
            const prev = prevMap.get(normName(it.name));
            if (!prev || !prev.is_quoted || prev.price == null || String(prev.price).trim() === "") return { hasPrev: false };
            const prevStr = String(prev.price).trim();
            const prevNum = Number(prevStr);
            return { hasPrev: true, prevStr, prevNum: Number.isFinite(prevNum) ? prevNum : NaN };
        }
        const fmtDelta = (n) => Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
        // 「前月」欄內容：前月價 ＋ 即時漲跌初值（漲紅↑／跌綠↓，含金額與 %）；之後由 JS 依 data-prev 覆蓋。
        function prevCell(pi, quoted, price) {
            if (!pi.hasPrev) return `<span class="qe-prevval">—</span>`;
            const curNum = quoted && price != null && String(price).trim() !== "" ? Number(String(price).trim()) : NaN;
            let delta = `<span class="qe-delta"></span>`;
            if (Number.isFinite(pi.prevNum) && Number.isFinite(curNum) && curNum !== pi.prevNum) {
                const up = curNum > pi.prevNum;
                const diff = curNum - pi.prevNum;
                const amt = (up ? "+" : "-") + fmtDelta(Math.abs(diff));
                const pct = pi.prevNum !== 0 ? ` (${up ? "+" : "-"}${Math.round(Math.abs(diff) / Math.abs(pi.prevNum) * 100)}%)` : "";
                delta = `<span class="qe-delta ${up ? "qe-up" : "qe-down"}">${up ? "↑" : "↓"}${escapeHtml(amt + pct)}</span>`;
            }
            return `<span class="qe-prevval">${escapeHtml(pi.prevStr)}</span>${delta}`;
        }

        let groupsHtml = "";
        let seq = 0;
        // 價格模式表頭列（緊湊表格）；兩欄版每欄各放一份。
        const priceThead = manage ? "" : `<div class="qe-thead">
            <span style="text-align:center;">序</span>
            <span>名稱</span>
            <span>單位</span>
            <span class="qe-th-prev">前月</span>
            <span class="qe-th-price">價格</span>
            <span class="qe-th-noq">不報價</span>
          </div>`;
        // 類別標頭（cont=true → 跨欄切割時右欄的「（續）」）。
        const catHead = (g, cont) => `<div class="qe-cat">${escapeHtml(g.category)}${cont ? `<span class="n">（續）</span>` : ` <span class="n">${g.items.length} 項</span>`}</div>`;
        // 價格模式單列。
        function priceRow(it) {
            seq++;
            const quoted = !!it.is_quoted;
            const noqCls = quoted ? "" : " qe-noq-on";
            const priceVal = escapeAttr(quoted ? (it.price == null ? "" : it.price) : "");
            const hidden = `<input type="hidden" name="row__${escapeAttr(it.id)}" value="1">`;
            const pi = prevInfo(it);
            const dataPrev = pi.hasPrev ? ` data-prev="${escapeAttr(pi.prevStr)}"` : "";
            return `<div class="qe-row${noqCls}">
                <span class="qe-seq">${seq}</span>
                <div class="qe-name"><span class="qe-nm">${escapeHtml(it.name)}</span></div>
                <span class="qe-unit">${escapeHtml(it.spec || "")}</span>
                <span class="qe-prev">${prevCell(pi, quoted, it.price)}</span>
                <input class="qe-in qe-price" name="price__${escapeAttr(it.id)}" value="${priceVal}" inputmode="decimal" placeholder="${quoted ? "價格" : "—"}"${quoted ? "" : " disabled"}${dataPrev}>
                <label class="qe-noq"><input type="checkbox" name="noq__${escapeAttr(it.id)}" onchange="var r=this.closest('.qe-row');var p=r.querySelector('.qe-price');p.disabled=this.checked;if(this.checked)p.value='';r.classList.toggle('qe-noq-on',this.checked);"${quoted ? "" : " checked"}> 不報價</label>
                ${hidden}
              </div>`;
        }
        if (manage) {
            for (const g of groups) {
                let rows = "";
                for (const it of g.items) {
                    seq++;
                    const quoted = !!it.is_quoted;
                    const noqCls = quoted ? "" : " qe-noq-on";
                    const priceVal = escapeAttr(quoted ? (it.price == null ? "" : it.price) : "");
                    const hidden = `<input type="hidden" name="row__${escapeAttr(it.id)}" value="1">`;
                    rows += `<div class="qe-row${noqCls}" data-id="${escapeAttr(it.id)}">
                        <span class="qe-drag" title="拖曳調整順序">${QI.grip}</span>
                        <span class="qe-seq">${seq}</span>
                        <input class="qe-in" name="name__${escapeAttr(it.id)}" value="${escapeAttr(it.name)}">
                        <input class="qe-in" name="spec__${escapeAttr(it.id)}" value="${escapeAttr(it.spec || "")}">
                        <select class="qe-in qe-cat-sel" name="cat__${escapeAttr(it.id)}">${catOptions(it.category)}</select>
                        <input class="qe-in qe-price" name="price__${escapeAttr(it.id)}" value="${priceVal}" inputmode="decimal" placeholder="${quoted ? "價格" : "—"}">
                        <label class="qe-noq"><input type="checkbox" name="noq__${escapeAttr(it.id)}" onchange="this.closest('.qe-row').classList.toggle('qe-noq-on',this.checked);"${quoted ? "" : " checked"}> 不報價</label>
                        <span class="qe-move">
                          <button type="button" class="qe-mv" data-mv="-1" title="上移一格">${QI.up}</button>
                          <button type="button" class="qe-mv" data-mv="1" title="下移一格">${QI.down}</button>
                        </span>
                        <button type="submit" formaction="/admin/quotes/${enc}/item/${encodeURIComponent(it.id)}/delete" formnovalidate class="sf-btn sm qe-del" onclick="return confirm('刪除此品項？')">刪</button>
                        ${hidden}
                      </div>`;
                }
                // 每個分類的品項包一層 .qe-grp 當拖放容器（分類間可互拖，落點分類會同步寫進該列的分類下拉）
                groupsHtml += `${catHead(g, false)}<div class="qe-grp" data-cat="${escapeAttr(g.category)}">${rows}</div>`;
            }
            // 順序以單一隱藏欄位帶回（逗號串接品項 id），不佔用每列一個欄位；JS 停用時＝維持現況順序。
            if (items.length) {
                groupsHtml = `<div id="qeManage">${groupsHtml}</div>
              <input type="hidden" id="qeOrder" name="item_order" value="${escapeAttr(items.map(it => it.id).join(","))}">`;
            }
        } else if (items.length) {
            // 價格模式：依累計品項數平均切成左右兩欄；類別標頭跟著品項，跨欄切割時右欄補「（續）」標頭。
            const half = Math.ceil(items.length / 2);
            const cols = ["", ""];
            let col = 0, n = 0;
            for (const g of groups) {
                let headerCol = -1;   // 此類別標頭目前所在欄（-1＝尚未放）
                let emitted = false;  // 是否已放過此類別標頭（跨欄時右欄補「（續）」）
                for (const it of g.items) {
                    if (col === 0 && n >= half) col = 1;
                    if (headerCol !== col) { cols[col] += catHead(g, emitted); headerCol = col; emitted = true; }
                    cols[col] += priceRow(it);
                    n++;
                }
            }
            groupsHtml = `<div class="qe-cols">
                <div class="qe-col">${priceThead}${cols[0]}</div>
                ${cols[1] ? `<div class="qe-col">${priceThead}${cols[1]}</div>` : ""}
              </div>`;
        }

        // 價格模式：即時漲跌（金額＋%，漲紅↓跌綠）。伺服器端已算初值，這裡依 data-prev 即時覆蓋。
        const priceScript = manage ? "" : `<script>
(function(){
  function fmt(n){ return Number.isInteger(n) ? String(n) : String(Math.round(n*100)/100); }
  function calc(input){
    var row = input.closest('.qe-row'); if(!row) return;
    var delta = row.querySelector('.qe-delta'); if(!delta) return;
    var pa = input.getAttribute('data-prev');
    var prev = (pa==null||pa==='') ? NaN : Number(pa);
    var raw = input.disabled ? '' : String(input.value).trim();
    var cur = raw==='' ? NaN : Number(raw);
    if(!isFinite(prev) || !isFinite(cur) || cur===prev){ delta.className='qe-delta'; delta.textContent=''; return; }
    var diff = cur - prev, up = diff > 0;
    var amt = (up?'+':'-') + fmt(Math.abs(diff));
    var pct = prev!==0 ? ' ('+(up?'+':'-')+Math.round(Math.abs(diff)/Math.abs(prev)*100)+'%)' : '';
    delta.className = 'qe-delta ' + (up?'qe-up':'qe-down');
    delta.textContent = (up?'\\u2191':'\\u2193') + amt + pct;
  }
  var priceInputs = document.querySelectorAll('.qe-price-mode .qe-price[data-prev]');
  for(var i=0;i<priceInputs.length;i++){ (function(inp){ calc(inp); inp.addEventListener('input', function(){ calc(inp); }); })(priceInputs[i]); }
  var noqs = document.querySelectorAll('.qe-price-mode .qe-noq input[type=checkbox]');
  for(var j=0;j<noqs.length;j++){ noqs[j].addEventListener('change', function(e){ var r=e.target.closest('.qe-row'); if(!r) return; var p=r.querySelector('.qe-price'); if(p) calc(p); }); }
})();
</script>`;

        // 管理品項模式：調整品項順序（桌機拖曳握把、手機／鍵盤用 ↑↓ 一格一格移）。
        // 畫面順序寫進隱藏欄位 item_order，按「儲存」時一起送出 → 後端寫回 sort_order。
        // 拖到別的分類群組＝連同分類一起改（同步該列的分類下拉），與手動改分類等價。
        const orderScript = (manage && items.length) ? `<script>
(function(){
  var wrap = document.getElementById('qeManage');
  var field = document.getElementById('qeOrder');
  if(!wrap || !field) return;
  var dragRow = null;

  function closestEl(t, sel){ return (t && t.closest) ? t.closest(sel) : null; }

  // 重算：序號、順序欄位、各分類「N 項」，以及空分類的虛線落點框。
  function sync(){
    var rows = wrap.querySelectorAll('.qe-row'), ids = [];
    for(var i=0;i<rows.length;i++){
      var s = rows[i].querySelector('.qe-seq');
      if(s) s.textContent = String(i+1);
      ids.push(rows[i].getAttribute('data-id'));
    }
    field.value = ids.join(',');
    var grps = wrap.querySelectorAll('.qe-grp');
    for(var g=0; g<grps.length; g++){
      var n = grps[g].querySelectorAll('.qe-row').length;
      grps[g].classList.toggle('qe-grp-empty', n === 0);
      var head = grps[g].previousElementSibling;
      if(head && head.classList.contains('qe-cat')){
        var cnt = head.querySelector('.n');
        if(cnt) cnt.textContent = n + ' 項';
      }
    }
  }

  // 跨分類移動後，把該列的分類下拉改成落點分類（沒有對應選項就不動，避免送出無效分類）。
  function applyCat(row){
    var grp = row.parentNode;
    if(!grp || !grp.classList || !grp.classList.contains('qe-grp')) return;
    var cat = grp.getAttribute('data-cat');
    var sel = row.querySelector('.qe-cat-sel');
    if(!sel) return;
    for(var i=0;i<sel.options.length;i++){
      if(sel.options[i].value === cat){ sel.value = cat; return; }
    }
  }

  // ↑↓：在同一分類內上下移一格（已在頭／尾就不動）。
  wrap.addEventListener('click', function(e){
    var btn = closestEl(e.target, '.qe-mv');
    if(!btn) return;
    e.preventDefault();
    var row = closestEl(btn, '.qe-row'); if(!row) return;
    var grp = row.parentNode;
    var dir = Number(btn.getAttribute('data-mv')) < 0 ? -1 : 1;
    var sib = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
    if(!sib) return;
    if(dir < 0) grp.insertBefore(row, sib); else grp.insertBefore(sib, row);
    sync();
  });

  // 拖曳：只有按住握把才讓整列變成可拖，避免影響欄位內選字。
  function clearDraggable(){
    var ds = wrap.querySelectorAll('.qe-row[draggable="true"]');
    for(var i=0;i<ds.length;i++) ds[i].removeAttribute('draggable');
  }
  wrap.addEventListener('mousedown', function(e){
    var h = closestEl(e.target, '.qe-drag'); if(!h) return;
    var row = closestEl(h, '.qe-row'); if(row) row.setAttribute('draggable', 'true');
  });
  wrap.addEventListener('mouseup', clearDraggable);

  wrap.addEventListener('dragstart', function(e){
    var row = closestEl(e.target, '.qe-row'); if(!row) return;
    dragRow = row;
    row.classList.add('qe-dragging');
    if(e.dataTransfer){
      e.dataTransfer.effectAllowed = 'move';
      try{ e.dataTransfer.setData('text/plain', row.getAttribute('data-id') || ''); }catch(_){}
    }
  });
  wrap.addEventListener('dragend', function(){
    if(dragRow) dragRow.classList.remove('qe-dragging');
    dragRow = null;
    clearDraggable();
    sync();
  });
  wrap.addEventListener('dragover', function(e){
    if(!dragRow) return;
    e.preventDefault();
    if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    var over = closestEl(e.target, '.qe-row');
    if(over && over !== dragRow && over.parentNode){
      var r = over.getBoundingClientRect();
      var after = (e.clientY - r.top) > r.height / 2;
      over.parentNode.insertBefore(dragRow, after ? over.nextSibling : over);
      applyCat(dragRow);
      return;
    }
    // 拖進空分類（虛線框）＝移到該分類
    var grp = closestEl(e.target, '.qe-grp');
    if(grp && grp !== dragRow.parentNode && grp.querySelectorAll('.qe-row').length === 0){
      grp.appendChild(dragRow);
      applyCat(dragRow);
    }
  });
  wrap.addEventListener('drop', function(e){ if(dragRow) e.preventDefault(); });

  sync();
})();
</script>` : "";

        const headerFields = isHotel
            ? [["customer_name", "飯店名稱", row.customer_name], ["title", "標題", row.title], ["subtitle", "副標", row.subtitle], ["company", "公司", row.company], ["address", "地址", row.address], ["tel", "電話", row.tel], ["fax", "傳真", row.fax]]
            : [["title", "標題", row.title], ["subtitle", "副標", row.subtitle], ["company", "公司", row.company], ["address", "地址", row.address], ["tel", "電話", row.tel], ["fax", "傳真", row.fax]];

        return `${QUOTE_STYLE}
          <div class="sf-qwrap">
            <div class="sf-qbar">
              <div class="sf-qhead">
                <div class="sf-breadcrumb" style="margin-bottom:6px;">報價管理 / <a href="${backHref}" style="color:inherit;">${backLabel}</a> / ${titleMain}</div>
                <h1>${titleMain} ${isFrozen ? "冷凍" : ""}報價單 ${statusPill}</h1>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <a class="sf-btn primary" href="/admin/quotes/${enc}/pdf">${QI.pdf}<span>下載 PDF</span></a>
                <a class="sf-btn" href="/admin/quotes/${enc}/image.jpg" download>${QI.image}<span>下載 JPG</span></a>
                <a class="sf-btn" href="/admin/quotes/${enc}/sheet" target="_blank">${QI.print}<span>預覽 / 列印</span></a>
              </div>
            </div>
            ${okMsg === "created" ? `<div class="sf-card sf-qflash">${QI.checkc}<span>已建立，${items.length ? "已帶入品項與價格，請逐項確認單價。" : "目前尚無品項，請切到「管理品項」新增。"}</span></div>` : ""}
            ${okMsg === "saved" ? `<div class="sf-card sf-qflash">${QI.checkc}<span>已儲存。</span></div>` : ""}

            <div class="qe-modebar">
              <div class="sf-seg">
                <a href="/admin/quotes/${enc}" class="${manage ? "" : "on"}">${QI.price}<span>價格</span></a>
                <a href="/admin/quotes/${enc}?manage=1" class="${manage ? "on" : ""}">${QI.manage}<span>管理品項</span></a>
              </div>
              <span style="font-size:12px;color:var(--txt-3);">${manage ? "可改品名／規格／分類、拖曳握把或按 ↑↓ 調整順序、刪除或新增品項。順序與內容都要按「儲存」才生效。" : "只編輯單價；勾「不報價」則留白仍列出。要改品名、順序或增減品項請切到「管理品項」。"}</span>
            </div>

            <details class="sf-card" style="padding:0;">
              <summary style="padding:12px 16px;cursor:pointer;font-weight:600;">表頭設定（${isHotel ? "飯店名稱、" : ""}公司、地址、電話…）</summary>
              <form method="post" action="/admin/quotes/${enc}/header" style="padding:0 16px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
                ${headerFields.map(([k, label, v]) => `<label style="font-size:12px;color:var(--txt-3);">${label}<input name="${k}" value="${escapeAttr(v || "")}" style="width:100%;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:4px;margin-top:3px;color:var(--txt-1);"></label>`).join("")}
                <div style="grid-column:1/-1;"><button class="sf-btn" type="submit">儲存表頭</button></div>
              </form>
            </details>

            <form method="post" action="/admin/quotes/${enc}/save${manage ? "?manage=1" : ""}">
              <div class="sf-card ${manage ? "qe-manage-mode" : "qe-price-mode"}" style="overflow-x:auto;padding:12px 6px;">
                <div style="padding:0 6px 8px;font-size:12px;color:var(--txt-3);display:flex;justify-content:space-between;">
                  <span>共 ${items.length} 項${manage ? "　·　同分類內可自行排序" : "　·　依分類排序"}</span>
                </div>
                ${groupsHtml || `<div style="text-align:center;color:var(--txt-3);padding:24px;">尚無品項，請切到「管理品項」新增。</div>`}
              </div>
              <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center;">
                <button class="sf-btn primary" type="submit">${QI.save}<span>儲存</span></button>
                ${row.status === "finalized"
                    ? `<button class="sf-btn" type="submit" formaction="/admin/quotes/${enc}/status" formnovalidate name="status" value="draft">改回草稿</button>`
                    : `<button class="sf-btn" type="submit" formaction="/admin/quotes/${enc}/status" formnovalidate name="status" value="finalized">設為完成</button>`}
                <span style="flex:1;"></span>
                <button class="sf-btn" type="submit" formaction="/admin/quotes/${enc}/delete" formnovalidate style="color:#b91c1c;" onclick="return confirm('確定刪除整份報價？')">刪除</button>
              </div>
            </form>

            ${manage ? `
            <div class="sf-card" style="padding:16px 18px;">
              <div style="font-weight:600;margin-bottom:10px;">＋ 新增品項</div>
              <form method="post" action="/admin/quotes/${enc}/item/add" style="display:grid;grid-template-columns:2fr 1.4fr 1.4fr 1fr auto;gap:8px;align-items:end;">
                <label style="font-size:12px;color:var(--txt-3);">品名<input name="name" required style="width:100%;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:4px;margin-top:3px;"></label>
                <label style="font-size:12px;color:var(--txt-3);">規格<input name="spec" placeholder="KG / 盒…" style="width:100%;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:4px;margin-top:3px;"></label>
                <label style="font-size:12px;color:var(--txt-3);">分類<select name="category" style="width:100%;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:4px;margin-top:3px;">${catOptions(baseCats[0])}</select></label>
                <label style="font-size:12px;color:var(--txt-3);">單價<input name="price" inputmode="decimal" placeholder="留白=不報價" style="width:100%;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:4px;margin-top:3px;text-align:right;"></label>
                <button class="sf-btn" type="submit">新增</button>
              </form>
            </div>` : ""}
            ${priceScript}${orderScript}
          </div>`;
    }

    // 列表頁（分頁：月報 / 飯店客戶報價）
    router.get("/quotes", async (req, res) => {
        try {
            const tabRaw = String(req.query.tab || "");
            const tab = tabRaw === "hotel" ? "hotel" : tabRaw === "frozen" ? "frozen" : "monthly";
            const okMsg = String(req.query.ok || "");
            let inner = "";

            if (tab === "frozen") {
                // 冷凍報價：作業方式與青菜月報完全相同（一月一份、帶入上月、月底提醒）。
                const todayIso = getTaipeiCalendarDateYYYYMMDD();
                const quotes = await quote_report_js_1.listFrozenQuotes(db);
                const reminder = await quote_report_js_1.monthEndReminder(db, todayIso, 7, quote_report_js_1.getFrozenQuoteByYm);
                const suggestYm = reminder.targetYm || quote_report_js_1.nextYm(todayIso.slice(0, 7));
                const createForm = (label) => `<form method="post" action="/admin/quotes/frozen/create" class="sf-qnew">
                    <label>月份<input type="month" name="ym" value="${escapeAttr(suggestYm)}" required></label>
                    <button class="sf-btn primary" type="submit">${label}</button>
                  </form>`;
                const list = quotes.length
                    ? `<div class="sf-card sf-qlist">
                        <div class="sf-qlist-head"><span>月份</span><span>狀態</span><span style="text-align:right;">操作</span></div>
                        ${quotes.map((r) => `<div class="sf-qrow">
                          <a class="sf-qrow-name" href="/admin/quotes/${encodeURIComponent(r.id)}"><span class="sf-qrow-t1">${escapeHtml(r.roc_label || r.ym)}</span><span class="sf-qrow-t2">冷凍報價 · ${escapeHtml(r.ym)}</span></a>
                          <div>${r.status === "finalized" ? `<span class="sf-pill ok">已完成</span>` : `<span class="sf-pill warn">草稿</span>`}</div>
                          <div class="sf-qrow-actions">
                            <a class="sf-btn sm" href="/admin/quotes/${encodeURIComponent(r.id)}">編輯</a>
                            <a class="sf-btn sm" href="/admin/quotes/${encodeURIComponent(r.id)}/pdf">PDF</a>
                            <a class="sf-btn sm" href="/admin/quotes/${encodeURIComponent(r.id)}/image.jpg" download>JPG</a>
                          </div></div>`).join("")}
                      </div>`
                    : `<div class="sf-card sf-qempty">
                        <div class="sf-qempty-icon">${QI.doc}</div>
                        <div class="sf-qempty-title">尚無冷凍報價</div>
                        <p class="sf-qempty-desc">建立第一份冷凍報價時，系統會自動帶入冷凍品項清單（包子饅頭、冷凍點心、龍港包子、雞肉、豬肉）當底稿，你只要調整價格即可。之後每個月新增，會自動沿用上一份的品項與價格。</p>
                        ${createForm("＋ 建立第一份冷凍報價")}
                      </div>`;
                const reminderBanner = reminder.show ? `
                  <div class="sf-card sf-qremind">
                    <span class="sf-qremind-ico">${QI.calendar}</span>
                    <div style="flex:1;min-width:200px;">
                      <div style="font-weight:600;">月底提醒：請準備 ${escapeHtml(reminder.rocLabel)} 冷凍報價</div>
                      <div style="font-size:12px;color:var(--txt-3);margin-top:2px;">本月僅剩 ${reminder.daysLeft} 天。${reminder.report ? "已建立草稿，請確認價格後設為完成。" : "尚未建立，新增時會自動帶入上月價格當底稿。"}</div>
                    </div>
                    ${reminder.report
                        ? `<a class="sf-btn primary" href="/admin/quotes/${encodeURIComponent(reminder.report.id)}">前往編輯 →</a>`
                        : `<form method="post" action="/admin/quotes/frozen/create" style="margin:0;"><input type="hidden" name="ym" value="${escapeAttr(reminder.targetYm)}"><button class="sf-btn primary" type="submit">建立 ${escapeHtml(reminder.rocLabel)} →</button></form>`}
                  </div>` : "";
                inner = `<div class="sf-qbar">
                    <p style="margin:0;color:var(--txt-3);font-size:13px;max-width:560px;">冷凍品項（包子饅頭、點心、雞肉、豬肉）的月報價，作業方式與青菜月報相同：新增會自動帶入上月價格當底稿，只需改動有變動的項目；輸出可存 PDF 或下載 JPG。</p>
                    ${quotes.length ? createForm("＋ 新增冷凍報價") : ""}
                  </div>
                  ${okMsg === "created" ? `<div class="sf-card sf-qflash">${QI.checkc}<span>冷凍報價已建立。</span></div>` : ""}
                  ${reminderBanner}
                  ${list}`;
            } else if (tab === "hotel") {
                const hotels = await quote_report_js_1.listHotelQuotes(db);
                let names = [];
                try { names = (await db.prepare("SELECT DISTINCT name FROM customers WHERE active = 1 ORDER BY name").all()).map(r => r.name).filter(Boolean); } catch (_) {}
                const datalist = `<datalist id="qhotelnames">${names.map(n => `<option value="${escapeAttr(n)}"></option>`).join("")}</datalist>`;
                const newForm = `<form method="post" action="/admin/quotes/hotel/create" class="sf-qnew">
                    <label>飯店名稱<input name="customer_name" list="qhotelnames" placeholder="輸入或選擇客戶" required autocomplete="off"></label>
                    <button class="sf-btn primary" type="submit">＋ 新增飯店報價</button>
                  </form>`;
                const list = hotels.length
                    ? `<div class="sf-card sf-qlist">
                        <div class="sf-qlist-head"><span>飯店客戶</span><span>狀態</span><span style="text-align:right;">操作</span></div>
                        ${hotels.map(h => `<div class="sf-qrow">
                          <a class="sf-qrow-name" href="/admin/quotes/${encodeURIComponent(h.id)}"><span class="sf-qrow-t1">${escapeHtml(h.customer_name)}</span><span class="sf-qrow-t2">飯店客戶報價</span></a>
                          <div>${h.status === "finalized" ? `<span class="sf-pill ok">已完成</span>` : `<span class="sf-pill warn">草稿</span>`}</div>
                          <div class="sf-qrow-actions">
                            <a class="sf-btn sm" href="/admin/quotes/${encodeURIComponent(h.id)}">編輯</a>
                            <a class="sf-btn sm" href="/admin/quotes/${encodeURIComponent(h.id)}/pdf">PDF</a>
                            <a class="sf-btn sm" href="/admin/quotes/${encodeURIComponent(h.id)}/image.jpg" download>JPG</a>
                          </div></div>`).join("")}
                      </div>`
                    : `<div class="sf-card sf-qempty">
                        <div class="sf-qempty-icon">${QI.users}</div>
                        <div class="sf-qempty-title">尚無飯店報價</div>
                        <p class="sf-qempty-desc">為飯店客戶各建立一份專屬報價單。新增時會以最新月報為底帶入全部品項與價格，你只要調整該飯店的專屬價格即可。</p>
                        ${newForm}
                      </div>`;
                inner = `${datalist}
                  <div class="sf-qbar">
                    <p style="margin:0;color:var(--txt-3);font-size:13px;max-width:560px;">每家飯店客戶各一份報價單，以最新月報為底、再調整專屬價格；輸出可存 PDF 或下載 JPG。</p>
                    ${hotels.length ? newForm : ""}
                  </div>
                  ${okMsg === "hotel-created" ? `<div class="sf-card sf-qflash">${QI.checkc}<span>飯店報價已建立，已帶入月報品項，請調整專屬價格。</span></div>` : ""}
                  ${list}`;
            } else {
                const todayIso = getTaipeiCalendarDateYYYYMMDD();
                const reports = await quote_report_js_1.listReports(db);
                const reminder = await quote_report_js_1.monthEndReminder(db, todayIso, 7);
                const suggestYm = reminder.targetYm || quote_report_js_1.nextYm(todayIso.slice(0, 7));
                const createForm = (label) => `<form method="post" action="/admin/quotes/create" class="sf-qnew">
                    <label>月份<input type="month" name="ym" value="${escapeAttr(suggestYm)}" required></label>
                    <button class="sf-btn primary" type="submit">${label}</button>
                  </form>`;
                const list = reports.length
                    ? `<div class="sf-card sf-qlist">
                        <div class="sf-qlist-head"><span>月份</span><span>狀態</span><span style="text-align:right;">操作</span></div>
                        ${reports.map((r) => `<div class="sf-qrow">
                          <a class="sf-qrow-name" href="/admin/quotes/${encodeURIComponent(r.id)}"><span class="sf-qrow-t1">${escapeHtml(r.roc_label || r.ym)}</span><span class="sf-qrow-t2">${escapeHtml(r.ym)}</span></a>
                          <div>${r.status === "finalized" ? `<span class="sf-pill ok">已完成</span>` : `<span class="sf-pill warn">草稿</span>`}</div>
                          <div class="sf-qrow-actions">
                            <a class="sf-btn sm" href="/admin/quotes/${encodeURIComponent(r.id)}">編輯</a>
                            <a class="sf-btn sm" href="/admin/quotes/${encodeURIComponent(r.id)}/pdf">PDF</a>
                            <a class="sf-btn sm" href="/admin/quotes/${encodeURIComponent(r.id)}/image.jpg" download>JPG</a>
                          </div></div>`).join("")}
                      </div>`
                    : `<div class="sf-card sf-qempty">
                        <div class="sf-qempty-icon">${QI.doc}</div>
                        <div class="sf-qempty-title">尚無月報</div>
                        <p class="sf-qempty-desc">建立第一份月報時，系統會自動帶入完整品項清單當底稿，你只要調整價格即可。之後每個月新增，會自動沿用上一份的品項與價格。</p>
                        ${createForm("＋ 建立第一份月報")}
                      </div>`;
                const reminderBanner = reminder.show ? `
                  <div class="sf-card sf-qremind">
                    <span class="sf-qremind-ico">${QI.calendar}</span>
                    <div style="flex:1;min-width:200px;">
                      <div style="font-weight:600;">月底提醒：請準備 ${escapeHtml(reminder.rocLabel)} 報價單</div>
                      <div style="font-size:12px;color:var(--txt-3);margin-top:2px;">本月僅剩 ${reminder.daysLeft} 天。${reminder.report ? "已建立草稿，請確認價格後設為完成。" : "尚未建立，新增時會自動帶入上月價格當底稿。"}</div>
                    </div>
                    ${reminder.report
                        ? `<a class="sf-btn primary" href="/admin/quotes/${encodeURIComponent(reminder.report.id)}">前往編輯 →</a>`
                        : `<form method="post" action="/admin/quotes/create" style="margin:0;"><input type="hidden" name="ym" value="${escapeAttr(reminder.targetYm)}"><button class="sf-btn primary" type="submit">建立 ${escapeHtml(reminder.rocLabel)} →</button></form>`}
                  </div>` : "";
                inner = `<div class="sf-qbar">
                    <p style="margin:0;color:var(--txt-3);font-size:13px;max-width:560px;">每月月底前製作下個月報價單。新增會自動帶入上月價格當底稿，只需改動有變動的項目；輸出可存 PDF 或下載 JPG。</p>
                    ${reports.length ? createForm("＋ 新增月報") : ""}
                  </div>
                  ${okMsg === "created" ? `<div class="sf-card sf-qflash">${QI.checkc}<span>月報已建立。</span></div>` : ""}
                  ${reminderBanner}
                  ${list}`;
            }

            const body = `${QUOTE_STYLE}
              <div class="sf-qwrap">
                <div class="sf-qhead">
                  <div class="sf-breadcrumb" style="margin-bottom:6px;">日常作業 / 報價管理</div>
                  <h1>報價管理</h1>
                </div>
                ${renderQuoteTabs(tab)}
                ${inner}
              </div>`;
            res.type("text/html").send(notionPage("報價管理", body, "quotes", res));
        } catch (e) {
            console.error("[admin] /quotes failed", e);
            res.status(500).type("text/html").send(notionPage("報價管理", `<div style="padding:32px;">讀取失敗：${escapeHtml(String(e && e.message || e))}</div>`, "quotes", res));
        }
    });

    // 建立飯店報價（以最新月報為底）
    router.post("/quotes/hotel/create", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const customerName = String(req.body.customer_name || "").trim();
            const id = await quote_report_js_1.createHotelQuote(db, { customerName });
            res.redirect(`/admin/quotes/${encodeURIComponent(id)}?ok=created`);
        } catch (e) {
            console.error("[admin] /quotes/hotel/create failed", e);
            res.status(400).type("text/html").send(notionPage("報價管理", `<div style="padding:32px;">建立失敗：${escapeHtml(String(e && e.message || e))}<br><a href="/admin/quotes?tab=hotel">返回</a></div>`, "quotes", res));
        }
    });

    // 建立冷凍報價（帶入上一份；第一份帶入冷凍品項 seed）
    router.post("/quotes/frozen/create", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const ym = String(req.body.ym || "").trim();
            const id = await quote_report_js_1.createFrozenQuote(db, { ym });
            res.redirect(`/admin/quotes/${encodeURIComponent(id)}?ok=created`);
        } catch (e) {
            console.error("[admin] /quotes/frozen/create failed", e);
            res.status(400).type("text/html").send(notionPage("報價管理", `<div style="padding:32px;">建立失敗：${escapeHtml(String(e && e.message || e))}<br><a href="/admin/quotes?tab=frozen">返回</a></div>`, "quotes", res));
        }
    });

    // 建立月報（帶入上月）
    router.post("/quotes/create", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const ym = String(req.body.ym || "").trim();
            const id = await quote_report_js_1.createReport(db, { ym });
            res.redirect(`/admin/quotes/${encodeURIComponent(id)}?ok=created`);
        } catch (e) {
            console.error("[admin] /quotes/create failed", e);
            res.status(400).type("text/html").send(notionPage("客戶報價", `<div style="padding:32px;">建立失敗：${escapeHtml(String(e && e.message || e))}<br><a href="/admin/quotes">返回</a></div>`, "quotes", res));
        }
    });


    // 標記月報「已發送給客戶」（寫 app_settings quote_sent_<ym>；儀表板發送提醒的按鈕呼叫）
    router.post("/quotes/mark-sent", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const ym = String(req.body.ym || "").trim();
            if (/^\d{4}-\d{2}$/.test(ym)) await quote_report_js_1.markQuoteSent(db, ym);
        } catch (e) {
            console.error("[admin] /quotes/mark-sent failed", e);
        }
        res.redirect(String(req.body.back || "") === "quotes" ? "/admin/quotes" : "/admin");
    });

    // 編輯頁（月報與飯店共用；?manage=1 進管理品項模式）
    router.get("/quotes/:id", async (req, res) => {
        try {
            const { kind, row } = await resolveQuoteRow(req.params.id);
            if (!row) { res.status(404).type("text/html").send(notionPage("報價管理", `<div style="padding:32px;">找不到此報價。<a href="/admin/quotes">返回</a></div>`, "quotes", res)); return; }
            const groups = await quote_report_js_1.getItemsGrouped(db, row.id);
            const manage = String(req.query.manage || "") === "1";
            const okMsg = String(req.query.ok || "");
            // 前月價格比較：只對「月報／冷凍報價」且非管理模式建 map（飯店報價無月份概念）。
            // 冷凍要比的是上個月的「冷凍」報價，故傳 getFrozenQuoteByYm；前月不存在則靜默省略。
            let prevMap = null;
            if ((kind === "monthly" || kind === "frozen") && !manage && row.ym) {
                const byYm = kind === "frozen" ? quote_report_js_1.getFrozenQuoteByYm : undefined;
                try { prevMap = await quote_report_js_1.buildPrevPriceMap(db, row.ym, byYm); } catch (_) { prevMap = null; }
            }
            const body = renderQuoteEditor(row, groups, { kind, manage, okMsg, prevMap });
            res.type("text/html").send(notionPage("編輯報價單", body, "quotes", res));
        } catch (e) {
            console.error("[admin] /quotes/:id failed", e);
            res.status(500).type("text/html").send(notionPage("報價管理", `<div style="padding:32px;">讀取失敗：${escapeHtml(String(e && e.message || e))}<br><a href="/admin/quotes">返回</a></div>`, "quotes", res));
        }
    });

    // 儲存品項（月報／飯店共用）。價格模式只送價格；管理模式送品名/規格/分類＋品項順序。
    // parameterLimit 放大：一份報價常有上百項 × 每項 5~6 個欄位，預設 1000 會擋下整份儲存。
    router.post("/quotes/:id/save", express_1.default.urlencoded({ extended: true, parameterLimit: 20000 }), async (req, res) => {
        try {
            const { row } = await resolveQuoteRow(req.params.id);
            if (!row) { res.redirect("/admin/quotes"); return; }
            const manage = String(req.query.manage || "") === "1";
            const items = await quote_report_js_1.getItems(db, row.id);
            // 管理品項模式會帶回畫面順序（item_order＝逗號串接的品項 id）。先在交易外算好最終順序，
            // 沒送 item_order（價格模式／JS 停用）就不動 sort_order。
            const orderRaw = String(req.body.item_order || "").trim();
            const orderIds = orderRaw ? orderRaw.split(",") : [];
            const planned = orderIds.length ? quote_report_js_1.planItemOrder(items, orderIds) : null;
            const orderChanged = !!planned && planned.some((id, i) => items[i] && items[i].id !== id);
            for (const it of items) {
                // 只更新「這次表單有送出的列」（每列都有 hidden row__id），避免部分送出誤清空其他品項。
                if (!(`row__${it.id}` in req.body)) continue;
                const patch = {};
                if (`name__${it.id}` in req.body) patch.name = req.body[`name__${it.id}`];
                if (`spec__${it.id}` in req.body) patch.spec = req.body[`spec__${it.id}`];
                if (`cat__${it.id}` in req.body) patch.category = req.body[`cat__${it.id}`];
                if (req.body[`noq__${it.id}`] != null) { patch.is_quoted = 0; }
                else if (`price__${it.id}` in req.body) { patch.price = req.body[`price__${it.id}`]; }
                await quote_report_js_1.updateItem(db, it.id, patch);
            }
            if (planned) {
                // 整份順序一次寫入包同一交易：中斷會留下重複／跳號的 sort_order，畫面順序就亂了。
                const doOrder = (h) => quote_report_js_1.applyItemOrder(h, row.id, planned);
                if (typeof db.transaction === "function") await db.transaction(doOrder);
                else await doOrder(db);
            }
            if (orderChanged) {
                const nameOf = new Map(items.map(it => [it.id, it.name]));
                await logDataChange(req, {
                    entityType: "quote_item_order",
                    entityId: row.id,
                    action: "reorder",
                    summary: `調整報價品項順序（${row.roc_label || row.customer_name || row.ym || row.id}）共 ${planned.length} 項`,
                    meta: { before: items.map(it => it.name), after: planned.map(id => nameOf.get(id) || id) },
                });
            }
            res.redirect(`/admin/quotes/${encodeURIComponent(row.id)}${manage ? "?manage=1&" : "?"}ok=saved`);
        } catch (e) {
            console.error("[admin] /quotes/:id/save failed", e);
            res.status(400).type("text/html").send(notionPage("報價管理", `<div style="padding:32px;">儲存失敗：${escapeHtml(String(e && e.message || e))}<br><a href="/admin/quotes/${encodeURIComponent(req.params.id)}">返回</a></div>`, "quotes", res));
        }
    });

    // 表頭儲存（月報／飯店分流；飯店多一個飯店名稱欄）
    router.post("/quotes/:id/header", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const header = {
                title: req.body.title, subtitle: req.body.subtitle, company: req.body.company,
                address: req.body.address, tel: req.body.tel, fax: req.body.fax,
            };
            const kind = quoteKindOf(req.params.id);
            if (kind === "hotel") {
                header.customer_name = req.body.customer_name;
                await quote_report_js_1.updateHotelHeader(db, req.params.id, header);
            } else if (kind === "frozen") {
                await quote_report_js_1.updateFrozenHeader(db, req.params.id, header);
            } else {
                await quote_report_js_1.updateReportHeader(db, req.params.id, header);
            }
            res.redirect(`/admin/quotes/${encodeURIComponent(req.params.id)}?ok=saved`);
        } catch (e) {
            console.error("[admin] /quotes/:id/header failed", e);
            res.redirect(`/admin/quotes/${encodeURIComponent(req.params.id)}`);
        }
    });

    // 新增品項（回管理模式）
    router.post("/quotes/:id/item/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            await quote_report_js_1.addItem(db, req.params.id, {
                category: req.body.category, name: req.body.name, spec: req.body.spec, price: req.body.price,
            });
            res.redirect(`/admin/quotes/${encodeURIComponent(req.params.id)}?manage=1`);
        } catch (e) {
            console.error("[admin] /quotes/:id/item/add failed", e);
            res.redirect(`/admin/quotes/${encodeURIComponent(req.params.id)}?manage=1`);
        }
    });

    // 刪除品項（回管理模式）
    router.post("/quotes/:id/item/:itemId/delete", async (req, res) => {
        try { await quote_report_js_1.deleteItem(db, req.params.itemId); } catch (e) { console.error("[admin] delete item failed", e); }
        res.redirect(`/admin/quotes/${encodeURIComponent(req.params.id)}?manage=1`);
    });

    // 設定狀態（完成／草稿）
    router.post("/quotes/:id/status", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const status = String(req.body.status || "draft") === "finalized" ? "finalized" : "draft";
            const kind = quoteKindOf(req.params.id);
            if (kind === "hotel") await quote_report_js_1.setHotelStatus(db, req.params.id, status);
            else if (kind === "frozen") await quote_report_js_1.setFrozenStatus(db, req.params.id, status);
            else await quote_report_js_1.setReportStatus(db, req.params.id, status);
        } catch (e) { console.error("[admin] set status failed", e); }
        res.redirect(`/admin/quotes/${encodeURIComponent(req.params.id)}`);
    });

    // 刪除整份報價
    router.post("/quotes/:id/delete", async (req, res) => {
        const kind = quoteKindOf(req.params.id);
        try {
            if (kind === "hotel") await quote_report_js_1.deleteHotelQuote(db, req.params.id);
            else if (kind === "frozen") await quote_report_js_1.deleteFrozenQuote(db, req.params.id);
            else await quote_report_js_1.deleteReport(db, req.params.id);
        } catch (e) { console.error("[admin] delete quote failed", e); }
        res.redirect(kind === "hotel" ? "/admin/quotes?tab=hotel" : kind === "frozen" ? "/admin/quotes?tab=frozen" : "/admin/quotes");
    });

    // 供輸出用：把飯店報價正規化成 render 用的表頭（飯店名稱放 roc_label 位置顯示）
    async function loadQuoteForRender(id) {
        const { kind, row } = await resolveQuoteRow(id);
        if (!row) return null;
        const groups = await quote_report_js_1.getItemsGrouped(db, id);
        const report = kind === "hotel" ? { ...row, roc_label: row.customer_name, ym: row.customer_name } : row;
        return { report, groups, kind };
    }

    // 列印頁（A4 / 存 PDF）
    // 儲存報價單字型偏好（列印頁字型下拉會呼叫）
    router.post("/quotes/font", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const key = String(req.body.font || "").trim();
            if (QUOTE_FONTS[key]) {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("quote_font", key);
            }
            res.json({ ok: true });
        } catch (e) {
            console.error("[admin] /quotes/font failed", e);
            res.status(400).json({ ok: false });
        }
    });

    router.get("/quotes/:id/sheet", async (req, res) => {
        try {
            const data = await loadQuoteForRender(req.params.id);
            if (!data) { res.status(404).type("text/html").send("找不到此報價"); return; }
            const logo = await quote_report_js_1.getDefaultLogoDataUri();
            const fontKey = await getQuoteFontKey();
            res.type("text/html").send(renderQuoteSheetHtml(data.report, data.groups, logo, fontKey));
        } catch (e) {
            console.error("[admin] /quotes/:id/sheet failed", e);
            res.status(500).type("text/html").send("產生失敗：" + escapeHtml(String(e && e.message || e)));
        }
    });

    // JPG 圖（分頁直向堆疊成一張長圖，內容與 PDF 一致）
    router.get("/quotes/:id/image.jpg", async (req, res) => {
        try {
            const data = await loadQuoteForRender(req.params.id);
            if (!data) { res.status(404).send("找不到此報價"); return; }
            const logo = await quote_report_js_1.getDefaultLogoDataUri();
            const fontCss = quoteFontCss(await getQuoteFontKey());
            const buf = await quote_report_js_1.renderQuoteStackedJpeg(data.report, data.groups, { logoDataUri: logo, fontCss });
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Content-Disposition", `inline; filename="quote-${encodeURIComponent(data.report.ym || req.params.id)}.jpg"`);
            res.send(buf);
        } catch (e) {
            console.error("[admin] /quotes/:id/image.jpg failed", e);
            res.status(500).send("產生失敗：" + String(e && e.message || e));
        }
    });

    // PDF 下載（伺服器直接產生多頁 A4 PDF，不需瀏覽器列印）
    router.get("/quotes/:id/pdf", async (req, res) => {
        try {
            const data = await loadQuoteForRender(req.params.id);
            if (!data) { res.status(404).send("找不到此報價"); return; }
            const logo = await quote_report_js_1.getDefaultLogoDataUri();
            const fontCss = quoteFontCss(await getQuoteFontKey());
            const buf = await quote_report_js_1.renderQuotePdf(data.report, data.groups, { logoDataUri: logo, fontCss });
            const fname = "報價單-" + (data.report.ym || data.report.customer_name || req.params.id) + ".pdf";
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="quote-${encodeURIComponent(data.report.ym || req.params.id)}.pdf"; filename*=UTF-8''${encodeURIComponent(fname)}`);
            res.send(buf);
        } catch (e) {
            console.error("[admin] /quotes/:id/pdf failed", e);
            res.status(500).send("產生失敗：" + String(e && e.message || e));
        }
    });
}
