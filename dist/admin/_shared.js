"use strict";
// 後台共享「無狀態」表現層 helper（拆分批次 1，2026-07-18）。
// 這裡只放純函式／常數：不 close over db、req、session 或任何 createAdminRouter 內部狀態，
// 因此可安全被 index.js 與未來各域檔（dist/admin/<域>.js）共用。有狀態的 helper
//（logDataChange / requireManager / setGroupFeaturesAudited 等）仍留在 closure，之後以 ctx 傳遞。
Object.defineProperty(exports, "__esModule", { value: true });

// ── 線條圖示（line art；16px、1.4 stroke、currentColor、無填色）──
const SF_ICONS = {
  bell: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 11h10l-1.5-2V6a3.5 3.5 0 0 0-7 0v3L3 11z"/><path d="M6.5 13a1.5 1.5 0 0 0 3 0"/></svg>',
  check: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3.5 8.5l3 3 6-6"/></svg>',
  x: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  plus: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 3v10M3 8h10"/></svg>',
  search: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></svg>',
  filter: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 4h12M4 8h8M6 12h4"/></svg>',
  chev_r: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 3l5 5-5 5"/></svg>',
  chev_d: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 6l5 5 5-5"/></svg>',
  thermo: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2v8M8 2a1.5 1.5 0 0 0-1.5 1.5v6a3 3 0 1 0 3 0v-6A1.5 1.5 0 0 0 8 2z"/><circle cx="8" cy="12" r="1.4" fill="currentColor"/></svg>',
  box: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 5l6-3 6 3v6l-6 3-6-3V5z"/><path d="M2 5l6 3 6-3M8 8v6"/></svg>',
  truck: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="4" width="8" height="7"/><path d="M9 6h3l2 2v3H9"/><circle cx="4" cy="12" r="1.2"/><circle cx="11.5" cy="12" r="1.2"/></svg>',
  users: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6" cy="6" r="2.4"/><path d="M2 13c0-2 2-3.5 4-3.5s4 1.5 4 3.5"/><circle cx="11" cy="6" r="1.8"/><path d="M11 9.5c1.7 0 3 1.2 3 3"/></svg>',
  list: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 4h9M5 8h9M5 12h9M2 4h.01M2 8h.01M2 12h.01"/></svg>',
  history: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8a6 6 0 1 0 6-6 6 6 0 0 0-4.2 1.8L2 5.5"/><path d="M2 2v3.5h3.5M8 5v3l2 2"/></svg>',
  warn: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2L1.5 13.5h13L8 2z"/><path d="M8 6v3"/><circle cx="8" cy="11.5" r=".7" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.2"/><path d="M8 7.4v3.4"/><circle cx="8" cy="5.2" r=".7" fill="currentColor"/></svg>',
  dl: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2v9M4 7l4 4 4-4M2.5 13.5h11"/></svg>',
  refresh: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8a6 6 0 0 1 10.5-4M14 2v3.5h-3.5M14 8a6 6 0 0 1-10.5 4M2 14v-3.5h3.5"/></svg>',
  spark: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2l1.4 4.6L14 8l-4.6 1.4L8 14l-1.4-4.6L2 8l4.6-1.4L8 2z"/></svg>',
  edit: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 14l1-3 7-7 3 3-7 7-3 1zM9 5l3 3"/></svg>',
  dots: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><circle cx="4" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12" cy="8" r="1.2"/></svg>',
  link: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5L8 4.5"/><path d="M9 7a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5L8 11.5"/></svg>',
  sun: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M15 8h-2M3 8H1M13 3l-1.5 1.5M4.5 11.5L3 13M13 13l-1.5-1.5M4.5 4.5L3 3"/></svg>',
  moon: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M13 9.5A6 6 0 1 1 6.5 3 5 5 0 0 0 13 9.5z"/></svg>',
  menu: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 4h12M2 8h12M2 12h12"/></svg>',
  megaphone: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 6.5v3h2l1.5 3.5H8L6.5 9.5 13 12V4L6.5 6.5H3z"/><path d="M13 6.5a2 2 0 0 1 0 3"/></svg>',
  bolt: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M9 1.5L3.5 9H7l-1 5.5L12.5 7H9l1-5.5z"/></svg>',
  calendar: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="3.5" width="11" height="10" rx="1"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/></svg>',
  clipboard: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="3" width="9" height="11" rx="1"/><path d="M6 3v-.8a.7.7 0 0 1 .7-.7h2.6a.7.7 0 0 1 .7.7V3zM6 7h4M6 9.5h4"/></svg>',
  note: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 2.5h7l3 3v8H3z"/><path d="M10 2.5v3h3M5.5 8h5M5.5 10.5h3"/></svg>',
  chartLine: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 13V3M2 13h12M4 10l3-3 2 2 4-4"/></svg>',
  chartBar: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 13V3M2 13h12M5 13V8M8.5 13V5M12 13v-3"/></svg>',
  image: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="3" width="11" height="10" rx="1"/><circle cx="6" cy="6.5" r="1"/><path d="M3 12l3.5-3.5 2.5 2.5L11 8l2 2"/></svg>',
  printer: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4.5 6V2.5h7V6M4.5 9.5h7v3.5h-7z"/><path d="M2.5 6h11v5h-2M4.5 11h-2V6"/></svg>',
  message: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 3.5h11v7h-7l-3 2.5V3.5z"/><path d="M5 6.5h6M5 8.5h4"/></svg>',
  mail: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3.5" width="12" height="9" rx="1"/><path d="M2.5 4.5L8 8.5l5.5-4"/></svg>',
  cart: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 2.5H3l1.2 7h6.6l1.2-5H4"/><circle cx="6" cy="12.5" r="1"/><circle cx="10.5" cy="12.5" r="1"/></svg>',
  pin: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 14s4.5-4 4.5-7A4.5 4.5 0 0 0 3.5 7c0 3 4.5 7 4.5 7z"/><circle cx="8" cy="7" r="1.6"/></svg>',
  wand: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2.5 13.5l8-8"/><path d="M10.5 2l.6 1.9L13 4.5l-1.9.6L10.5 7l-.6-1.9L8 4.5l1.9-.6z"/></svg>',
  money: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="4" width="12" height="8" rx="1"/><circle cx="8" cy="8" r="2"/><path d="M4.5 8h.01M11.5 8h.01"/></svg>',
  user: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4"/></svg>',
  doc: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3M6 8h4M6 10.5h4"/></svg>',
  scale: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2.5v10M4 12.5h8M3 5h10M3 5L1.5 8.5h3zM13 5l-1.5 3.5h3z"/></svg>',
  stop: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5.5 2.5h5l3 3v5l-3 3h-5l-3-3v-5z"/><path d="M8 5v3.5"/><circle cx="8" cy="11" r=".7" fill="currentColor"/></svg>',
  tag: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 2.5h5l6 6-5 5-6-6z"/><circle cx="5.5" cy="5.5" r="1"/></svg>',
  trendingUp: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><path d="M2 11l4-4 2.5 2.5L14 4"/><path d="M10 4h4v4"/></svg>',
  phone: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="4.5" y="1.5" width="7" height="13" rx="1.4"/><path d="M7 12.5h2"/></svg>',
  building: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 13.5V2.5h7v11M10 6h3v7.5M2 13.5h12"/><path d="M5 5h1M7.5 5h1M5 7.5h1M7.5 7.5h1M5 10h1M7.5 10h1"/></svg>',
  robot: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="10" height="8" rx="1.4"/><path d="M8 5V3M8 3h.01M1.5 8.5v2M14.5 8.5v2"/><circle cx="6" cy="8.5" r=".7" fill="currentColor"/><circle cx="10" cy="8.5" r=".7" fill="currentColor"/><path d="M6.2 11h3.6"/></svg>',
  bulb: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.5a4.2 4.2 0 0 0-2.4 7.6c.6.5.9 1 .9 1.7h3c0-.7.3-1.2.9-1.7A4.2 4.2 0 0 0 8 1.5z"/><path d="M6.5 12.8h3M7 14.5h2"/></svg>',
};

/** 內嵌用行內圖示（非 flex 容器如按鈕、分頁、標籤內用）。回傳 <span class="sfi">SVG</span> */
function sfInlineIcon(name) {
  return '<span class="sfi">' + (SF_ICONS[name] || "") + "</span>";
}

// ── HTML／屬性／JS 字串跳脫（純函式）──
function escapeHtml(s) {
    if (s == null)
        return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
    if (s == null)
        return "";
    return escapeHtml(s).replace(/'/g, "&#39;");
}
// 將字串安全放進「HTML 屬性內的單引號 JS 字串」（如 onsubmit="return confirm('…')"）：
// 先做 JS 跳脫（反斜線、單引號、換行），外層再用 escapeAttr 做 HTML 屬性跳脫。
function escJsStr(s) {
    if (s == null)
        return "";
    return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, " ");
}

exports.SF_ICONS = SF_ICONS;
exports.sfInlineIcon = sfInlineIcon;
exports.escapeHtml = escapeHtml;
exports.escapeAttr = escapeAttr;
exports.escJsStr = escJsStr;
