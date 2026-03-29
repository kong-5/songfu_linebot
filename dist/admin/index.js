"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminRouter = createAdminRouter;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const XLSX = __importStar(require("xlsx"));
const bwip_js_1 = __importDefault(require("bwip-js"));
const index_js_1 = require("../db/index.js");
const id_js_1 = require("../lib/id.js");
const parse_order_message_js_1 = require("../lib/parse-order-message.js");
const resolve_product_js_1 = require("../lib/resolve-product.js");
const vision_ocr_js_1 = require("../lib/vision-ocr.js");
const wholesale_price_js_1 = require("../lib/wholesale-price.js");
const wholesale_snapshot_js_1 = require("../lib/wholesale-snapshot.js");
const line_bot_control_js_1 = require("../lib/line-bot-control.js");
const unit_conversion_js_1 = require("../lib/unit-conversion.js");
const gemini_order_helpers_js_1 = require("../lib/gemini-order-helpers.js");
const parse_order_from_image_js_1 = require("../lib/parse-order-from-image.js");
const order_parsed_heuristics_js_1 = require("../lib/order-parsed-heuristics.js");
const order_form_templates_js_1 = require("../lib/order-form-templates.js");
const rebuild_order_from_sources_js_1 = require("../lib/rebuild-order-from-sources.js");
const customer_handwriting_hints_js_1 = require("../lib/customer-handwriting-hints.js");
const few_shot_example_save_js_1 = require("../lib/few-shot-example-save.js");
const crypto_1 = require("crypto");
const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
/** 訂單明細／客戶預設單位等下拉選單（常見台灣生鮮單位） */
const ORDER_LINE_UNITS = [
    "公斤", "斤", "k", "小把", "大把", "包", "把", "束", "桶", "箱", "顆", "粒", "盒", "袋", "台", "件", "支", "根", "條", "入", "罐", "瓶", "組", "份", "塊", "片", "尾",
];
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single("file");
const uploadImageMiddleware = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single("image");
function uploadImageSafe(req, res, next) {
    uploadImageMiddleware(req, res, (err) => {
        if (err) {
            console.error("[admin] multer logistics recognize:", err?.message || err);
            res.status(400).json({ error: "上傳處理失敗（檔案過大請小於 5MB，或請改只貼文字）。" });
            return;
        }
        next();
    });
}
const NOTION_STYLE = `
  :root {
    --notion-bg: #ffffff;
    --notion-canvas: #fbfbfa;
    --notion-sidebar: #f7f6f3;
    --notion-border: rgba(55, 53, 47, 0.09);
    --notion-border-strong: rgba(55, 53, 47, 0.16);
    --notion-text: #37352f;
    --notion-text-muted: #787774;
    --notion-accent: #2383e2;
    --notion-hover: rgba(55, 53, 47, 0.08);
    --notion-radius: 4px;
    --notion-radius-lg: 6px;
    --notion-shadow: 0 1px 3px rgba(15, 15, 15, 0.06);
    --notion-header-h: 48px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 100%; max-width: 100vw; min-height: 100vh; }
  body {
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
    background: var(--notion-canvas);
    color: var(--notion-text);
    line-height: 1.55;
    font-size: 15px;
    -webkit-font-smoothing: antialiased;
  }
  .notion-app { display: flex; flex-direction: column; min-height: 100vh; width: 100%; }
  .notion-app-header {
    flex-shrink: 0;
    height: var(--notion-header-h);
    min-height: var(--notion-header-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 16px 0 20px;
    background: var(--notion-bg);
    border-bottom: 1px solid var(--notion-border);
    box-shadow: 0 1px 0 rgba(15, 15, 15, 0.03);
    z-index: 20;
  }
  .notion-app-header-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
  .sidebar-toggle {
    display: none;
    border: 1px solid var(--notion-border-strong);
    background: var(--notion-bg);
    color: var(--notion-text);
    border-radius: var(--notion-radius);
    padding: 5px 8px;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }
  .notion-app-logo {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--notion-text);
    text-decoration: none;
    padding: 6px 8px;
    margin-left: -8px;
    border-radius: var(--notion-radius);
  }
  .notion-app-logo:hover { background: var(--notion-hover); color: var(--notion-text); text-decoration: none; }
  .notion-app-header-sep { color: var(--notion-border-strong); font-weight: 300; user-select: none; }
  .notion-app-header-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--notion-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: min(50vw, 420px);
  }
  .notion-app-header-right { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; justify-content: flex-end; flex-shrink: 0; }
  .notion-app-header-right .btn-header {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    font-size: 13px;
    border-radius: var(--notion-radius);
    border: none;
    background: transparent;
    color: var(--notion-text-muted);
    cursor: pointer;
    font-family: inherit;
    text-decoration: none;
  }
  .notion-app-header-right .btn-header:hover { background: var(--notion-hover); color: var(--notion-text); text-decoration: none; }
  .notion-app-header-right .btn-header-primary { color: var(--notion-accent); font-weight: 500; }
  .notion-app-header-right .btn-header-primary:hover { color: var(--notion-accent); }
  .notion-app-header-user { font-size: 13px; color: var(--notion-text-muted); padding: 0 6px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .notion-layout { display: flex; width: 100%; flex: 1; min-height: 0; min-width: 0; }
  .notion-sidebar-overlay { display:none; }
  .order-status-icons { display:inline-flex; flex-wrap:wrap; align-items:center; gap:3px; max-width:130px; vertical-align:middle; }
  .order-status-icons .osi { display:inline-flex; align-items:center; justify-content:center; min-width:22px; height:22px; border-radius:4px; font-size:12px; line-height:1; font-weight:700; box-sizing:border-box; }
  .order-status-icons .osi-ok { background:#e8f5e9; color:#2e7d32; }
  .order-status-icons .osi-approve { background:#d7f5df; color:#1b8f3a; }
  .order-status-icons .osi-warn { background:#fff3e0; color:#e65100; }
  .order-status-icons .osi-sheet { background:#e3f2fd; color:#1565c0; font-size:11px; }
  .order-status-icons .osi-xlsx { background:#f3e5f5; color:#6a1b9a; font-size:11px; }
  .admin-info-icon {
    display:inline-flex; align-items:center; justify-content:center;
    width:1.25em; height:1.25em; margin-left:6px; border-radius:50%;
    background:var(--notion-border-strong); color:var(--notion-bg); font-size:14px; font-weight:700;
    font-style:normal; line-height:1; cursor:help; vertical-align:middle;
    user-select:none;
  }
  .admin-info-icon:hover { background:var(--notion-accent); }
  .notion-sidebar {
    width: 168px;
    min-width: 168px;
    background: var(--notion-sidebar);
    border-right: 1px solid var(--notion-border);
    padding: 8px 0 24px;
    flex-shrink: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .notion-sidebar-home {
    display: flex;
    align-items: center;
    margin: 4px 12px 12px;
    padding: 8px 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--notion-text);
    text-decoration: none;
    border-radius: var(--notion-radius);
  }
  .notion-sidebar-home:hover { background: var(--notion-hover); text-decoration: none; }
  .notion-sidebar-home.active { background: var(--notion-hover); color: var(--notion-accent); }
  .notion-sidebar a { display: block; padding: 6px 12px; margin: 0 8px; color: var(--notion-text); text-decoration: none; font-size: 14px; border-radius: var(--notion-radius); }
  .notion-sidebar a:hover { background: var(--notion-hover); text-decoration: none; }
  .notion-sidebar .active { background: var(--notion-hover); color: var(--notion-accent); font-weight: 500; }
  .notion-sidebar .sidebar-group { margin: 0; border: none; }
  .notion-sidebar .sidebar-group-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--notion-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 10px 14px 6px;
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .notion-sidebar .sidebar-group-title::-webkit-details-marker { display: none; }
  .notion-sidebar .sidebar-group-title::after { content: "▾"; font-size: 11px; color: var(--notion-text-muted); font-weight: 400; opacity: 0.8; }
  .notion-sidebar .sidebar-group[open] .sidebar-group-title::after { content: "▴"; }
  .notion-sidebar .sidebar-group .sidebar-links { padding: 0 0 6px 0; }
  .notion-sidebar .sidebar-group .sidebar-links a { padding: 5px 12px 5px 16px; margin: 1px 8px; font-size: 14px; }
  .notion-main-wrap { flex: 1; min-width: 0; width: 100%; display: flex; flex-direction: column; max-width: 100%; background: var(--notion-bg); }
  .notion-main { flex: 1; min-width: 0; width: 100%; max-width: 1100px; margin: 0 auto; padding: 28px 40px 64px; }
  .notion-page-title { font-size: 32px; font-weight: 700; letter-spacing: -0.03em; margin: 0 0 4px; color: var(--notion-text); line-height: 1.2; }
  .notion-breadcrumb { font-size: 13px; color: var(--notion-text-muted); margin-bottom: 18px; }
  .notion-breadcrumb a { color: var(--notion-text-muted); text-decoration: none; }
  .notion-breadcrumb a:hover { color: var(--notion-accent); }
  .notion-card {
    background: var(--notion-bg);
    border: 1px solid var(--notion-border);
    border-radius: var(--notion-radius-lg);
    padding: 18px 22px;
    margin-bottom: 14px;
    box-shadow: var(--notion-shadow);
  }
  .notion-card h2 { font-size: 15px; font-weight: 600; color: var(--notion-text); margin: 0 0 12px; }
  table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 14px; border: 1px solid var(--notion-border); border-radius: var(--notion-radius-lg); overflow: hidden; }
  th, td { border-bottom: 1px solid var(--notion-border); border-right: 1px solid var(--notion-border); padding: 10px 14px; text-align: left; }
  th:last-child, td:last-child { border-right: none; }
  tr:last-child td { border-bottom: none; }
  th { background: rgba(247, 246, 243, 0.85); font-weight: 600; font-size: 12px; color: var(--notion-text-muted); text-transform: uppercase; letter-spacing: 0.02em; }
  tr:hover td { background: rgba(55, 53, 47, 0.03); }
  a { color: var(--notion-accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .btn, button[type=submit] {
    display: inline-block;
    padding: 7px 12px;
    font-size: 14px;
    border-radius: var(--notion-radius);
    border: 1px solid var(--notion-border-strong);
    background: var(--notion-bg);
    color: var(--notion-text);
    cursor: pointer;
    font-family: inherit;
    box-shadow: 0 1px 2px rgba(15, 15, 15, 0.04);
  }
  .btn:hover, button[type=submit]:hover { background: var(--notion-hover); }
  .btn-primary { background: var(--notion-accent); color: #fff; border-color: transparent; box-shadow: none; }
  .btn-primary:hover { opacity: 0.92; background: var(--notion-accent); text-decoration: none; }
  /* 須用 .btn.btn-cute-*，否則 button[type=submit] 特異性會蓋掉底色 */
  .btn.btn-cute-approve { background:#16a34a; border-color:#15803d; color:#fff; box-shadow:0 1px 2px rgba(22,163,74,.22); }
  .btn.btn-cute-approve:hover { background:#15803d; border-color:#166534; color:#fff; text-decoration:none; }
  .btn.btn-cute-next { background:#ece7fb; border-color:#d6ccfa; color:#5b3ea6; }
  .btn.btn-cute-next:hover { background:#e1d8fa; border-color:#c4b5fd; color:#4c1d95; text-decoration:none; }
  .btn.btn-cute-rerecog { background:#f97316; border-color:#ea580c; color:#fff; font-weight:700; box-shadow:0 1px 2px rgba(249,115,22,.22); }
  .btn.btn-cute-rerecog:hover { background:#ea580c; border-color:#c2410c; color:#fff; text-decoration:none; }
  .btn.btn-cute-lingyue { background:#2563eb; border-color:#1d4ed8; color:#fff; box-shadow:0 1px 2px rgba(37,99,235,.22); }
  .btn.btn-cute-lingyue:hover { background:#1d4ed8; border-color:#1e40af; color:#fff; text-decoration:none; }
  .btn.btn-cute-preview { background:#0ea5e9; border-color:#0284c7; color:#fff; box-shadow:0 1px 2px rgba(14,165,233,.2); }
  .btn.btn-cute-preview:hover { background:#0284c7; border-color:#0369a1; color:#fff; text-decoration:none; }
  .btn.btn-cute-ordersheet { background:#7c3aed; border-color:#6d28d9; color:#fff; box-shadow:0 1px 2px rgba(124,58,237,.2); }
  .btn.btn-cute-ordersheet:hover { background:#6d28d9; border-color:#5b21b6; color:#fff; text-decoration:none; }
  .btn.btn-cute-save { background:#dbeafe; border-color:#bfdbfe; color:#1e3a8a; font-weight:700; }
  .btn.btn-cute-save:hover { background:#cfe3ff; border-color:#93c5fd; color:#1e3a8a; text-decoration:none; }
  .btn.btn-info { background:#0d9488; border-color:#0f766e; color:#fff; font-weight:700; box-shadow:0 1px 2px rgba(13,148,136,.22); }
  .btn.btn-info:hover:not(:disabled) { background:#0f766e; border-color:#115e59; color:#fff; text-decoration:none; }
  .btn.btn-info:disabled { opacity:.55; cursor:not-allowed; }
  input[type=text], input[type=search], input[type=password], input[type=date], input[type=time], select, textarea {
    padding: 8px 10px;
    border: 1px solid var(--notion-border-strong);
    border-radius: var(--notion-radius);
    font-size: 14px;
    font-family: inherit;
    background: var(--notion-bg);
  }
  input:focus, select:focus, textarea:focus { outline: 2px solid rgba(35, 131, 226, 0.35); outline-offset: 0; border-color: var(--notion-accent); }
  label { display: block; margin-top: 12px; font-size: 14px; color: var(--notion-text); }
  label:first-of-type { margin-top: 0; }
  .form-inline label { display: inline; margin-right: 12px; }
  .notion-msg { padding: 10px 14px; border-radius: var(--notion-radius-lg); margin-bottom: 16px; font-size: 14px; }
  .notion-msg.ok { background: rgba(46, 125, 50, 0.08); color: #1b5e20; border: 1px solid rgba(46, 125, 50, 0.2); }
  .notion-msg.err { background: rgba(198, 40, 40, 0.06); color: #b71c1c; border: 1px solid rgba(198, 40, 40, 0.15); }
  .notion-hint, p.notion-hint, span.notion-hint, div.notion-hint {
    font-size: 12px;
    line-height: 1.55;
    color: var(--notion-text-muted);
    margin: 0 0 12px;
    font-weight: 400;
  }
  .notion-hint:last-child, p.notion-hint:last-child { margin-bottom: 0; }
  .notion-hint code, p.notion-hint code {
    font-size: 11px;
    background: rgba(55, 53, 47, 0.06);
    padding: 2px 5px;
    border-radius: 3px;
    color: var(--notion-text-muted);
  }
  .notion-hint strong { color: var(--notion-text-muted); font-weight: 600; }
  .notion-hint a { color: var(--notion-accent); text-decoration: none; }
  .notion-hint a:hover { text-decoration: underline; }
  .notion-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 48px;
    background: var(--notion-canvas);
    border-bottom: 1px solid var(--notion-border);
  }
  .notion-topbar .topbar-date { font-size: 14px; display: flex; align-items: center; gap: 8px; color: var(--notion-text); }
  .notion-topbar .topbar-date input[type=date] { padding: 6px 10px; }
  .notion-rollover-btn { background: #2e7d32; color: #fff; border: none; padding: 8px 14px; border-radius: var(--notion-radius); font-weight: 600; cursor: pointer; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
  .notion-rollover-btn:hover { background: #1b5e20; }
  .notion-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .notion-modal { background: var(--notion-bg); border-radius: var(--notion-radius); padding: 20px; max-width: 420px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
  .notion-modal h3 { margin: 0 0 12px; font-size: 16px; }
  .notion-modal-actions { margin-top: 16px; display: flex; gap: 8px; }
  .notion-modal-search { width: 100%; padding: 8px 10px; margin-bottom: 12px; }
  .notion-modal-list { max-height: 280px; overflow-y: auto; border: 1px solid var(--notion-border); border-radius: var(--notion-radius); }
  .notion-modal-list div { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--notion-border); }
  .notion-modal-list div:hover { background: var(--notion-hover); }
  .teraoka-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
  .teraoka-cell .code { font-weight: 600; }
  .teraoka-cell .name { font-size: 12px; color: var(--notion-text-muted); }
  .order-table-col-system { border-left: 2px solid var(--notion-accent); }
  tr.order-row-excluded { background: var(--notion-sidebar); color: var(--notion-text-muted); }
  tr.order-row-excluded input, tr.order-row-excluded select { opacity: 0.85; }
  /* 訂單明細：待確認列上色（桌面表格式） */
  table.order-detail-table tbody tr.order-item-need-review > td { background: #fff7ed; }
  .order-detail-layout { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: stretch; gap: 16px; margin-top: 4px; }
  .order-detail-raw-col { flex: 0 0 min(200px, 24vw); min-width: 160px; max-width: 220px; position: relative; }
  .order-detail-raw-inner { position: sticky; top: 10px; max-height: calc(100vh - 20px); overflow-y: auto; }
  .order-detail-raw-inner.notion-card { padding: 10px 12px; margin-bottom: 10px; }
  .order-detail-raw-title { margin: 0; font-size: 15px; font-weight: 600; }
  .order-detail-raw-pre-wrap { max-height: min(18vh, 140px); overflow-y: auto; overflow-x: auto; border: 1px solid var(--notion-border); border-radius: var(--notion-radius); }
  .order-detail-raw-pre-wrap pre { background: var(--notion-sidebar); padding: 6px 8px; border-radius: var(--notion-radius); margin: 0; font-size: 11px; line-height: 1.4; white-space: pre-wrap; word-break: break-all; }
  .order-detail-main-col { flex: 1; min-width: 0; }
  table.order-detail-table th.order-detail-th-sort,
  table.order-detail-table td.order-detail-col-sort { width: 26px; max-width: 30px; padding: 2px 1px; vertical-align: middle; text-align: center; }
  table.order-detail-table th.order-detail-th-idx,
  table.order-detail-table td.order-detail-col-idx { width: 34px; max-width: 40px; padding: 3px 2px; vertical-align: middle; text-align: center; }
  table.order-detail-table .order-detail-idx-num { font-size: 11px; font-weight: 600; line-height: 1; }
  table.order-detail-table .item-sort-stack { display: inline-flex; flex-direction: column; flex-wrap: nowrap; align-items: center; gap: 1px; }
  table.order-detail-table .item-sort-stack .btn { padding: 0 2px; line-height: 1.15; font-size: 10px; min-width: 18px; border-radius: 2px; }
  table.order-detail-table input.order-detail-qty-input { width: 3rem; max-width: 3.25rem; min-width: 2.75rem; box-sizing: border-box; }
  table.order-detail-table .order-del-btn-icon { min-width: 1.75rem; padding: 1px 4px; font-size: 17px; font-weight: 700; line-height: 1.1; color: #b71c1c; border-color: rgba(183, 28, 28, 0.35); }
  table.order-detail-table .order-del-btn-icon:hover { background: rgba(183, 28, 28, 0.07); }
  table.order-detail-table tbody td { padding-top: 5px; padding-bottom: 5px; }
  table.order-detail-table thead th { padding: 6px 8px; font-size: 12px; }
  .order-legend { font-size: 12px; color: var(--notion-text-muted); margin: 0 0 10px; line-height: 1.5; }
  .order-legend-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px; margin: 0 5px 0 14px; vertical-align: middle; border: 1px solid rgba(0,0,0,.12); }
  .order-legend-swatch:first-of-type { margin-left: 0; }
  .order-legend-swatch.sw-need { background: #fff7ed; border-color: #fdba74; }
  .order-detail-raw-sticky-hint { margin: 4px 0 0; font-size: 11px; color: var(--notion-text-muted); line-height: 1.35; }
  a.product-pick.need-review { color: #c00; font-weight: 600; }
  a.product-pick.product-change { color: var(--notion-accent); }
  .assign-section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--notion-text-muted); margin: 0 0 8px; }
  .assign-section h2.notion-card-title { font-size: 17px; font-weight: 600; color: var(--notion-text); margin: 0 0 10px; letter-spacing: -0.02em; }
  @media (max-width: 900px) {
    .notion-sidebar { width: 168px; min-width: 168px; }
    .notion-main { padding: 20px 24px 48px; max-width: none; }
    .notion-topbar { padding: 12px 20px; }
    .notion-app-header { padding: 0 12px; }
    .sidebar-toggle { display:inline-flex; align-items:center; justify-content:center; }
    .notion-sidebar {
      position: fixed;
      left: 0;
      top: var(--notion-header-h);
      bottom: 0;
      z-index: 30;
      transform: translateX(-104%);
      transition: transform .2s ease;
      box-shadow: 6px 0 16px rgba(0,0,0,.08);
    }
    .notion-app.sidebar-open .notion-sidebar { transform: translateX(0); }
    .notion-sidebar-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.35);
      z-index: 28;
      display: none;
    }
    .notion-app.sidebar-open .notion-sidebar-overlay { display:block; }
  }
  @media (max-width: 760px) {
    .notion-main { padding: 14px 12px 34px; }
    .notion-page-title { font-size: 26px; }
    .notion-card { padding: 14px 12px; border-radius: 10px; margin-bottom: 10px; }
    .notion-app-header { gap: 8px; }
    .notion-app-header-sep, .notion-app-header-title { display: none; }
    .notion-app-header-right { gap: 4px; }
    .notion-app-header-user { max-width: 88px; font-size: 12px; padding: 0 2px; }
    .header-back-btn, .header-users-btn { display: none !important; }
    .header-logout-btn { padding: 5px 8px; font-size: 12px; }
    table { border: none; background: transparent; }
    thead { display: none; }
    tbody tr {
      display: block;
      background: var(--notion-bg);
      border: 1px solid var(--notion-border);
      border-radius: 10px;
      margin-bottom: 10px;
      box-shadow: var(--notion-shadow);
      overflow: hidden;
    }
    tbody tr td {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border-right: none;
      border-bottom: 1px solid var(--notion-border);
      padding: 9px 10px;
      text-align: right;
    }
    tbody tr td:last-child { border-bottom: none; }
    tbody tr td::before {
      content: attr(data-label);
      font-size: 12px;
      color: var(--notion-text-muted);
      font-weight: 600;
      margin-right: auto;
      text-align: left;
    }
    /* 訂單明細：三段卡片（原始資料 / 核定資料 / 備註+刪除） */
    .table-scroll-mobile { overflow: visible; }
    table.order-detail-table { border: none; background: transparent; min-width: 0; }
    table.order-detail-table thead { display: none; }
    table.order-detail-table tbody tr.order-item-need-review { background: #fff7ed; }
    .order-detail-layout { flex-direction: column; flex-wrap: wrap; }
    .order-detail-raw-col { flex: none; width: 100%; min-width: 0; }
    .order-detail-raw-inner { position: static; max-height: 220px; }
    .order-detail-raw-pre-wrap { max-height: min(14vh, 110px); }
    .order-detail-raw-sticky-hint { display: none; }
    table.order-detail-table tbody tr {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas:
        "orig orig"
        "erp erp"
        "product product"
        "qty unit"
        "remark del";
      gap: 0;
      border: 1px solid var(--notion-border);
      border-radius: 12px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    table.order-detail-table tbody tr td { border-bottom: none; padding: 8px 10px; }
    table.order-detail-table tbody tr td::before { content: none; }
    table.order-detail-table tbody tr td:nth-child(1),
    table.order-detail-table tbody tr td:nth-child(2) { display:none; }
    table.order-detail-table tbody tr td:nth-child(3) { grid-area: erp; border-top: 1px solid var(--notion-border); padding-top: 6px; padding-bottom: 4px; }
    table.order-detail-table tbody tr td:nth-child(4) { grid-area: product; padding-top: 2px; padding-bottom: 8px; }
    table.order-detail-table tbody tr td:nth-child(5) { grid-area: qty; border-top: 1px solid var(--notion-border); }
    table.order-detail-table tbody tr td:nth-child(6) { grid-area: unit; border-top: 1px solid var(--notion-border); }
    table.order-detail-table tbody tr td:nth-child(7) { grid-area: remark; border-top: 1px solid var(--notion-border); }
    table.order-detail-table tbody tr td:nth-child(8) { grid-area: del; border-top: 1px solid var(--notion-border); justify-content:flex-end; align-items:flex-end; }
    table.order-detail-table tbody tr td:nth-child(3)::before { content: "料號"; color:var(--notion-text-muted); font-size:11px; margin-right:6px; }
    table.order-detail-table tbody tr td:nth-child(5)::before { content: "數量"; color:var(--notion-text-muted); font-size:11px; margin-right:6px; }
    table.order-detail-table tbody tr td:nth-child(6)::before { content: "單位"; color:var(--notion-text-muted); font-size:11px; margin-right:6px; }
    table.order-detail-table tbody tr td:nth-child(7)::before { content: "備註"; color:var(--notion-text-muted); font-size:11px; margin-right:6px; }
    table.order-detail-table tbody tr::before {
      content: attr(data-raw-card);
      grid-area: orig;
      display: block;
      padding: 9px 10px 8px;
      font-size: 13px;
      color: var(--notion-text-muted);
      border-bottom: 1px solid var(--notion-border);
      white-space: pre-wrap;
    }
    .order-final-erp { display:block; font-size:11px; color:var(--notion-text-muted); margin-bottom:2px; }
    .order-final-product { font-size: 18px; font-weight: 800; letter-spacing: 0.01em; }
    .order-del-btn { min-height: 32px; }
    .item-sort-stack { display: inline-flex; flex-direction: column; flex-wrap: nowrap; gap: 1px; align-items: center; }
    .item-sort-stack .btn { padding: 0 2px; font-size: 10px; line-height: 1.15; min-width: 18px; }
  }
  @media print { .notion-sidebar, .notion-app-header, .no-print, .notion-topbar { display: none !important; } .notion-main { max-width: none; padding: 0; } }
  .notion-main-embed { max-width: 720px; padding: 20px 24px 48px; }
  .notion-modal-embed { max-width: 920px; width: 95%; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
  .notion-modal-embed iframe { flex: 1; border: none; width: 100%; min-height: 480px; background: var(--notion-bg); }
  .notion-modal-embed-hd { padding: 12px 16px; border-bottom: 1px solid var(--notion-border); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-shrink: 0; }
  a.product-name-edit { color: var(--notion-accent); font-weight: 600; cursor: pointer; text-decoration: underline; }
  .pu-sop { margin-bottom: 16px; }
  .pu-sop-intro { font-size: 13px; color: var(--notion-text-muted); margin: 0 0 14px; line-height: 1.55; }
  .pu-sop-step { border: 1px solid var(--notion-border); border-radius: var(--notion-radius-lg); padding: 14px 16px; margin-bottom: 12px; background: var(--notion-bg); }
  .pu-sop-step > summary { cursor: pointer; font-weight: 600; font-size: 15px; list-style: none; display: flex; align-items: center; gap: 8px; }
  .pu-sop-step > summary::-webkit-details-marker { display: none; }
  .pu-sop-step > summary::before { content: "▸"; font-size: 12px; color: var(--notion-text-muted); }
  .pu-sop-step[open] > summary::before { content: "▾"; }
  .pu-sop-step .pu-step-body { margin-top: 12px; padding-top: 4px; }
  .pu-sop-step .step-hint { font-size: 12px; color: var(--notion-text-muted); margin: 0 0 12px; line-height: 1.5; }
  .pu-sop-badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 3px; background: var(--notion-sidebar); color: var(--notion-text-muted); margin-right: 6px; vertical-align: middle; }
  .pu-chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 12px; align-items: center; }
  .pu-chip { font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--notion-border); background: var(--notion-canvas); cursor: pointer; font-family: inherit; color: var(--notion-text); }
  .pu-chip:hover { border-color: var(--notion-accent); color: var(--notion-accent); }
  .pu-order-ctx { background: rgba(35, 131, 226, 0.06); border: 1px solid rgba(35, 131, 226, 0.2); border-radius: var(--notion-radius); padding: 12px 14px; margin-bottom: 12px; }
  .pu-derived { font-size: 13px; line-height: 1.65; }
  .pu-derived li { margin: 4px 0; }
`;
const NOTION_SIDEBAR = (active) => `
  <nav class="notion-sidebar">
    <a href="/admin" class="notion-sidebar-home ${active === "dashboard" ? "active" : ""}">儀表板</a>
    <details class="sidebar-group" ${active === "line-bot" || active === "line-bot-unit" || active === "ai-examples" ? "open" : ""}>
      <summary class="sidebar-group-title">LINE 機器人</summary>
      <div class="sidebar-links">
        <a href="/admin/line-bot" class="${active === "line-bot" ? "active" : ""}">啟動與排程</a>
        <a href="/admin/line-bot/unit-conversion" class="${active === "line-bot-unit" ? "active" : ""}">叫貨單位換算</a>
        <a href="/admin/ai-examples" class="${active === "ai-examples" ? "active" : ""}">AI 學習庫管理</a>
      </div>
    </details>
    <details class="sidebar-group">
      <summary class="sidebar-group-title">客戶管理</summary>
      <div class="sidebar-links">
        <a href="/admin/customers/new">新增客戶</a>
        <a href="/admin/customers">客戶管理</a>
        <a href="/admin/import-customers">批次匯入客戶</a>
      </div>
    </details>
    <details class="sidebar-group">
      <summary class="sidebar-group-title">貨品管理</summary>
      <div class="sidebar-links">
        <a href="/admin/products">品項與俗名</a>
        <a href="/admin/import">批次匯入品項</a>
      </div>
    </details>
    <details class="sidebar-group">
      <summary class="sidebar-group-title">訂單管理</summary>
      <div class="sidebar-links">
        <a href="/admin/orders">訂單查詢</a>
        <a href="/admin/review">待確認品項</a>
        <a href="/admin/export">資料匯出</a>
        <a href="/admin/backup" class="${active === "backup" ? "active" : ""}">資料備份</a>
      </div>
    </details>
    <details class="sidebar-group" ${active === "inventory" ? "open" : ""}>
      <summary class="sidebar-group-title">盤點作業</summary>
      <div class="sidebar-links">
        <a href="/admin/inventory" class="${active === "inventory" ? "active" : ""}">盤點作業</a>
        <a href="/admin/inventory/warehouses" class="${active === "inv-wh" ? "active" : ""}">庫房管理</a>
        <a href="/admin/inventory/assign" class="${active === "inv-assign" ? "active" : ""}">品項歸倉</a>
        <a href="/admin/inventory/daily" class="${active === "inv-daily" ? "active" : ""}">每日盤點</a>
        <a href="/admin/inventory/import-erp" class="${active === "inv-erp" ? "active" : ""}">匯入 ERP 資料</a>
        <a href="/admin/inventory/variance-report" class="${active === "inv-report" ? "active" : ""}">盤差報表</a>
        <a href="/admin/inventory/manager" class="${active === "inv-manager" ? "active" : ""}">管理人設定</a>
      </div>
    </details>
    <details class="sidebar-group" ${active === "logistics" || active === "logistics-procurement" || active === "logistics-market" ? "open" : ""}>
      <summary class="sidebar-group-title">物流工具</summary>
      <div class="sidebar-links">
        <a href="/admin/logistics/procurement" class="${active === "logistics-procurement" ? "active" : ""}">採購分析</a>
        <a href="/admin/logistics/market" class="${active === "logistics-market" ? "active" : ""}">北農行情</a>
      </div>
    </details>
    <details class="sidebar-group" ${active === "env" ? "open" : ""}>
      <summary class="sidebar-group-title">環境衛生管理</summary>
      <div class="sidebar-links">
        <a href="/admin/freezer-fridge" class="${active === "env" ? "active" : ""}">冷凍庫冷藏庫檢查表</a>
      </div>
    </details>
  </nav>
`;
function parseAdminCookies(header) {
    const out = {};
    if (!header)
        return out;
    for (const part of header.split(";")) {
        const idx = part.indexOf("=");
        if (idx < 0)
            continue;
        const k = part.slice(0, idx).trim();
        const v = decodeURIComponent(part.slice(idx + 1).trim());
        out[k] = v;
    }
    return out;
}
function getAdminSessionSecret() {
    return process.env.ADMIN_SESSION_SECRET || "songfu-admin-dev-secret-change-in-production";
}
function hashAdminPassword(password) {
    const salt = crypto_1.randomBytes(16).toString("hex");
    const hash = crypto_1.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return salt + ":" + hash;
}
function verifyAdminPassword(password, stored) {
    const parts = String(stored).split(":");
    if (parts.length !== 2)
        return false;
    const salt = parts[0];
    const hash = parts[1];
    const h = crypto_1.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    try {
        return crypto_1.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(h, "hex"));
    }
    catch {
        return false;
    }
}
function signAdminSession(username) {
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
    const sig = crypto_1.createHmac("sha256", getAdminSessionSecret()).update(payload).digest("base64url");
    return payload + "." + sig;
}
/** 負責人信箱：新帳號須由此帳號審核；此帳號一律為經理且啟用 */
const ADMIN_OWNER_EMAIL = String(process.env.ADMIN_OWNER_EMAIL || "s946185@gmail.com").trim().toLowerCase();
const ADMIN_TITLES = ["經理", "主任", "課長", "行政", "移工"];
function normalizeAdminUserRecord(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const username = String(raw.username || "").trim();
    if (!username)
        return null;
    const passwordHash = raw.passwordHash;
    const name = String(raw.name || raw.displayName || username).trim() || username;
    let title = String(raw.title || raw.role || "").trim();
    if (!ADMIN_TITLES.includes(title))
        title = "經理";
    let status = String(raw.status || "active").trim();
    if (status !== "active" && status !== "pending" && status !== "disabled")
        status = "active";
    if (username.toLowerCase() === ADMIN_OWNER_EMAIL) {
        title = "經理";
        status = "active";
    }
    return {
        username,
        name,
        passwordHash,
        title,
        status,
        approvedBy: raw.approvedBy != null ? String(raw.approvedBy) : null,
        approvedAt: raw.approvedAt != null ? String(raw.approvedAt) : null,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
    };
}
function isAdminOwnerUsername(username) {
    return String(username || "").trim().toLowerCase() === ADMIN_OWNER_EMAIL;
}
function pathLooksLikeDelete(req) {
    const p = req.path || "";
    if (req.method === "POST" && (p.includes("/delete") || p === "/orders/batch-delete"))
        return true;
    if (req.method === "GET" && p.includes("/delete"))
        return true;
    return false;
}
function verifyAdminSessionToken(token) {
    if (!token || typeof token !== "string")
        return null;
    const parts = token.split(".");
    if (parts.length !== 2)
        return null;
    const payload = parts[0];
    const sig = parts[1];
    const expected = crypto_1.createHmac("sha256", getAdminSessionSecret()).update(payload).digest("base64url");
    try {
        if (!crypto_1.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
            return null;
    }
    catch {
        return null;
    }
    try {
        const data = JSON.parse(Buffer.from(payload, "base64url").toString());
        if (!data.u || !data.exp || Date.now() > data.exp)
            return null;
        return String(data.u);
    }
    catch {
        return null;
    }
}
function renderNotionAppHeader(username, pageTitle, opts = {}) {
    const u = escapeHtml(username || "");
    const rawUser = String(username || "").trim();
    const shortUser = rawUser.includes("@") ? rawUser.split("@")[0] : rawUser;
    const uShort = escapeHtml(shortUser || rawUser || "");
    const t = escapeHtml(pageTitle || "");
    const showUsers = opts.canManageUsers === true;
    const showSidebarToggle = opts.withSidebar === true;
    const titleBadge = opts.adminTitle ? `<span class="notion-app-header-user" style="opacity:0.85;font-size:12px;margin-right:8px;">${escapeHtml(opts.adminTitle)}</span>` : "";
    return `
    <header class="notion-app-header no-print">
      <div class="notion-app-header-left">
        ${showSidebarToggle ? `<button type="button" class="sidebar-toggle" id="sidebarToggleBtn" aria-label="切換側邊欄">☰</button>` : ""}
        <a href="/admin" class="notion-app-logo">松富物流</a>
        <span class="notion-app-header-sep">/</span>
        <span class="notion-app-header-title">${t}</span>
      </div>
      <div class="notion-app-header-right">
        <button type="button" class="btn-header header-back-btn" onclick="history.back()">上一頁</button>
        ${showUsers ? `<a href="/admin/users" class="btn-header btn-header-primary header-users-btn">人員管理</a>` : ""}
        ${titleBadge}
        <span class="notion-app-header-user" title="${u}">${uShort}</span>
        <form method="post" action="/admin/logout" style="display:inline;margin:0;"><button type="submit" class="btn-header header-logout-btn">登出</button></form>
      </div>
    </header>`;
}
/** 台灣日曆日期 YYYY-MM-DD（勿用 UTC 的 toISOString，否則台北凌晨仍會是「昨日」） */
function getTaipeiCalendarDateYYYYMMDD() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d)
        return `${y}-${m}-${d}`;
    return new Date().toISOString().slice(0, 10);
}
async function getWorkingDate(database) {
    const row = await database.prepare("SELECT value FROM app_settings WHERE key = ?").get("working_date");
    if (row && row.value)
        return row.value;
    return getTaipeiCalendarDateYYYYMMDD();
}
function renderTopBar(workingDate, canUndo) {
    const d = new Date(workingDate + "T12:00:00");
    const dateLabel = d.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" });
    return `
    <div class="notion-topbar no-print">
      <div class="topbar-date">
        <span>結轉日期（收訂單用）：<strong>${escapeHtml(dateLabel)}</strong></span>
        <form method="post" action="/admin/api/working-date" style="display:inline-flex;align-items:center;gap:8px;margin-left:12px;">
          <input type="date" name="date" value="${escapeAttr(workingDate)}" required>
          <button type="submit" class="btn">套用</button>
        </form>
      </div>
      <div>
        ${canUndo ? `<form method="post" action="/admin/api/rollover-undo" style="display:inline;"><button type="submit" class="btn">反悔結轉</button></form> ` : ""}
        <button type="button" class="notion-rollover-btn" onclick="if(confirm('確定要結轉？結轉後工作日期將改為下一日。')) document.getElementById('rolloverForm').submit();">結轉</button>
        <form id="rolloverForm" method="post" action="/admin/api/rollover" style="display:none;"></form>
      </div>
    </div>`;
}
function notionPage(title, body, active = "", topBarOrRes = "", loggedInUserLegacy = "") {
    let topBar = "";
    let loggedInUser = "";
    let headerOpts = {};
    if (topBarOrRes && typeof topBarOrRes === "object" && topBarOrRes.locals) {
        const res = topBarOrRes;
        topBar = res.locals.topBarHtml || "";
        loggedInUser = res.locals.adminUser || "";
        headerOpts = {
            canManageUsers: res.locals.canManageUsers === true,
            adminTitle: res.locals.adminTitle || "",
            withSidebar: true,
        };
    }
    else {
        topBar = topBarOrRes || "";
        loggedInUser = loggedInUserLegacy || "";
        headerOpts = { canManageUsers: true, adminTitle: "", withSidebar: true };
    }
    const headerHtml = loggedInUser ? renderNotionAppHeader(loggedInUser, title, headerOpts) : "";
    const tb = topBar || "";
    const mainWrap = `<div class="notion-main-wrap">${tb}<main class="notion-main">${body}</main></div>`;
    const shell = headerHtml
        ? `<div class="notion-app" id="notionAppRoot">${headerHtml}<div class="notion-layout">${NOTION_SIDEBAR(active)}<div class="notion-sidebar-overlay" id="sidebarOverlay"></div>${mainWrap}</div></div>`
        : `<div class="notion-layout">${NOTION_SIDEBAR(active)}${mainWrap}</div>`;
    const uiScript = `<script>(function(){
      var app = document.getElementById('notionAppRoot');
      var btn = document.getElementById('sidebarToggleBtn');
      var overlay = document.getElementById('sidebarOverlay');
      function closeSidebar(){ if(app) app.classList.remove('sidebar-open'); }
      if(btn && app){ btn.addEventListener('click', function(){ app.classList.toggle('sidebar-open'); }); }
      if(overlay){ overlay.addEventListener('click', closeSidebar); }
      document.addEventListener('click', function(e){
        var a = e.target.closest('.notion-sidebar a');
        if (a) closeSidebar();
      });
      if (window.matchMedia && window.matchMedia('(max-width: 760px)').matches) {
        document.querySelectorAll('table').forEach(function(tbl){
          var heads = Array.prototype.map.call(tbl.querySelectorAll('thead th'), function(th){ return (th.textContent || '').trim(); });
          if (!heads.length) return;
          tbl.querySelectorAll('tbody tr').forEach(function(tr){
            Array.prototype.forEach.call(tr.children, function(td, i){
              if (!td.getAttribute('data-label')) td.setAttribute('data-label', heads[i] || '欄位');
            });
          });
        });
      }
    })();</script>`;
    return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} － 松富物流後台</title><style>${NOTION_STYLE}</style></head><body>${shell}${uiScript}</body></html>`;
}
/** 僅允許站內 /admin 路徑，供編輯頁儲存後導回（防開放重導向） */
function safeAdminReturnPath(s) {
    if (typeof s !== "string" || !s.startsWith("/admin"))
        return null;
    if (s.includes("\n") || s.includes("\r"))
        return null;
    return s;
}
/** 在帶 hash 的路徑上安全附加 query（例如 /admin/orders/x#items） */
function appendQueryToAdminPath(path, key, value) {
    try {
        const hashIdx = path.indexOf("#");
        const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
        const base = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
        const u = new URL(base, "http://local.invalid");
        u.searchParams.set(key, String(value));
        return u.pathname + u.search + hash;
    }
    catch {
        return path;
    }
}
/** 品項編輯頁 POST 錯誤導向時附加 embed／return */
function productEditEmbedQuery(body) {
    if (!body || body.embed !== "1")
        return "";
    const r = safeAdminReturnPath(typeof body?.redirect === "string" ? body.redirect : "");
    return r ? "&embed=1&return=" + encodeURIComponent(r) : "&embed=1";
}
/** 由「叫貨單位→公斤」與包裝 1 外層 = N 內層 推算各單位對應公斤；已在規格中直接填寫的單位不覆寫 */
function computeDerivedKgByUnit(specRows, ratioRows) {
    const kg = new Map();
    const direct = new Set();
    for (const s of specRows || []) {
        const u = String(s.unit || "").trim();
        const k = s.conversion_kg != null ? Number(s.conversion_kg) : NaN;
        if (u && Number.isFinite(k) && k > 0) {
            kg.set(u, k);
            direct.add(u);
        }
    }
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 40) {
        changed = false;
        for (const r of ratioRows || []) {
            const ou = String(r.outer_unit || "").trim();
            const iu = String(r.inner_unit || "").trim();
            const cnt = Number(r.inner_count);
            if (!ou || !iu || !Number.isFinite(cnt) || cnt <= 0)
                continue;
            if (direct.has(ou))
                continue;
            const innerKg = kg.get(iu);
            if (innerKg != null && Number.isFinite(innerKg)) {
                const next = cnt * innerKg;
                const prev = kg.get(ou);
                if (prev == null || Math.abs(Number(prev) - next) > 1e-6) {
                    kg.set(ou, next);
                    changed = true;
                }
            }
        }
    }
    return { kgMap: kg, directSet: direct };
}
/** 無側欄，供 iframe 內嵌編輯 */
function notionEmbedPage(title, body, res) {
    let loggedInUser = "";
    let headerOpts = {};
    if (res && typeof res === "object" && res.locals) {
        loggedInUser = res.locals.adminUser || "";
        headerOpts = {
            canManageUsers: res.locals.canManageUsers === true,
            adminTitle: res.locals.adminTitle || "",
            withSidebar: false,
        };
    }
    const headerHtml = loggedInUser ? renderNotionAppHeader(loggedInUser, title, headerOpts) : "";
    const mainWrap = `<div class="notion-main-wrap"><main class="notion-main notion-main-embed">${body}</main></div>`;
    const shell = headerHtml ? `<div class="notion-app">${headerHtml}${mainWrap}</div>` : `<div class="notion-app">${mainWrap}</div>`;
    return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} － 松富物流後台</title><style>${NOTION_STYLE}</style></head><body>${shell}</body></html>`;
}
function createAdminRouter() {
    const router = express_1.default.Router();
    const db = (0, index_js_1.getDb)(dbPath);
    async function logDataChange(req, opts) {
        const logId = (0, id_js_1.newId)("dcl");
        const actor = req.adminUsername || "";
        const metaJson = opts.meta != null ? JSON.stringify(opts.meta) : null;
        try {
            await db.prepare(`INSERT INTO data_change_log (id, entity_type, entity_id, product_id, action, summary, meta_json, actor_username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(logId, opts.entityType, opts.entityId, opts.productId ?? null, opts.action, opts.summary ?? null, metaJson, actor);
        }
        catch (e) {
            console.error("[admin] data_change_log insert failed", e);
        }
    }
    async function loadAdminUsers() {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("admin_users");
        if (!row?.value)
            return [];
        try {
            const j = JSON.parse(row.value);
            if (!Array.isArray(j))
                return [];
            return j.map((x) => normalizeAdminUserRecord(x)).filter(Boolean);
        }
        catch {
            return [];
        }
    }
    async function saveAdminUsers(users) {
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify(users));
    }
    router.use((_req, res, next) => {
        res.locals.topBarHtml = "";
        res.locals.adminUser = "";
        res.locals.adminTitle = "";
        res.locals.canManageUsers = false;
        next();
    });
    router.use((req, res, next) => {
        if (req.method === "GET" && !(req.path || "").startsWith("/api/")) {
            res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
        }
        next();
    });
    router.get("/login", async (_req, res) => {
        const users = await loadAdminUsers();
        if (users.length === 0) {
            res.redirect(302, "/admin/setup");
            return;
        }
        const err = _req.query.err === "1";
        const ok = _req.query.ok === "1";
        const disabled = _req.query.disabled === "1";
        const pendingMsg = _req.query.pending === "1";
        const nextParam = typeof _req.query.next === "string" && _req.query.next.startsWith("/admin") ? _req.query.next : "/admin";
        res.type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>登入 － 松富物流後台</title><style>:root{color-scheme:light;}*{box-sizing:border-box;}body{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;background:#f7f6f3;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:clamp(12px,4vw,24px);} .box{max-width:420px;width:100%;background:#fff;border:1px solid #e3e2e0;border-radius:12px;padding:clamp(16px,4vw,28px);box-shadow:0 4px 16px rgba(15,23,42,.06);} .box h1{font-size:clamp(20px,5vw,24px);line-height:1.3;margin:0 0 14px;color:#37352f;}form{display:flex;flex-direction:column;gap:12px;}label{display:block;font-size:14px;color:#37352f;}input{width:100%;padding:12px;border:1px solid #d7d6d4;border-radius:8px;font-size:16px;margin-top:6px;line-height:1.25;}input:focus{outline:2px solid rgba(35,131,226,.28);border-color:#2383e2;}button{margin-top:6px;width:100%;padding:12px;background:#2383e2;color:#fff;border:none;border-radius:8px;font-size:16px;line-height:1.2;cursor:pointer;font-weight:700;min-height:44px;}button:active{transform:translateY(1px);} .err,.ok,.warn{padding:10px 12px;border-radius:8px;font-size:14px;margin:0 0 10px;} .err{background:#ffebee;color:#c62828;} .ok{background:#e7f5e9;color:#2e7d32;} .warn{background:#fff8e1;color:#856404;}@media (max-width:480px){body{align-items:flex-start;padding:12px;} .box{margin-top:12px;border-radius:10px;} .box h1{margin-bottom:12px;}}</style></head><body><div class="box"><h1>松富物流 後台登入</h1>${err ? "<div class=\"err\">帳號或密碼錯誤。</div>" : ""}${disabled ? "<div class=\"err\">此帳號已停用，請聯絡管理員。</div>" : ""}${pendingMsg ? "<div class=\"warn\">若帳號尚待審核，請待負責人核准後再登入。</div>" : ""}${ok ? "<div class=\"ok\">已建立管理員，請登入。</div>" : ""}<form method="post" action="/admin/login"><input type="hidden" name="next" value="${escapeAttr(nextParam)}"><label>帳號 <input type="text" name="username" required autocomplete="username"></label><label>密碼 <input type="password" name="password" required autocomplete="current-password"></label><button type="submit">登入</button></form></div></body></html>`);
    });
    router.get("/setup", async (_req, res) => {
        const users = await loadAdminUsers();
        if (users.length > 0) {
            res.redirect(302, "/admin/login");
            return;
        }
        const err = _req.query.err;
        const errHtml = err === "weak" ? "<div class=\"err\">帳號至少 2 字元、密碼至少 4 字元。</div>" : "";
        res.type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>首次設定管理員 － 松富物流</title><style>:root{color-scheme:light;}*{box-sizing:border-box;}body{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;background:#f7f6f3;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:clamp(12px,4vw,24px);} .box{max-width:420px;width:100%;background:#fff;border:1px solid #e3e2e0;border-radius:12px;padding:clamp(16px,4vw,28px);box-shadow:0 4px 16px rgba(15,23,42,.06);} .box h1{font-size:clamp(20px,5vw,24px);line-height:1.3;margin:0 0 8px;color:#37352f;}p{color:#787774;font-size:14px;margin:0 0 16px;line-height:1.5;}form{display:flex;flex-direction:column;gap:12px;}label{display:block;font-size:14px;color:#37352f;}input{width:100%;padding:12px;border:1px solid #d7d6d4;border-radius:8px;font-size:16px;margin-top:6px;line-height:1.25;}input:focus{outline:2px solid rgba(35,131,226,.28);border-color:#2383e2;}button{margin-top:6px;width:100%;padding:12px;background:#2383e2;color:#fff;border:none;border-radius:8px;font-size:16px;line-height:1.2;cursor:pointer;font-weight:700;min-height:44px;}button:active{transform:translateY(1px);} .err{background:#ffebee;color:#c62828;padding:10px 12px;border-radius:8px;font-size:14px;margin:0 0 10px;}@media (max-width:480px){body{align-items:flex-start;padding:12px;} .box{margin-top:12px;border-radius:10px;} .box h1{margin-bottom:10px;}}</style></head><body><div class="box"><h1>首次設定管理員</h1><p>尚無後台帳號，請建立第一組帳號密碼。</p>${errHtml}<form method="post" action="/admin/setup"><label>帳號 <input type="text" name="username" required minlength="2" autocomplete="username"></label><label>密碼 <input type="password" name="password" required minlength="4" autocomplete="new-password"></label><button type="submit">建立並前往登入</button></form></div></body></html>`);
    });
    router.post("/setup", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const users = await loadAdminUsers();
        if (users.length > 0) {
            res.redirect("/admin/login");
            return;
        }
        const username = (req.body.username || "").trim();
        const password = (req.body.password || "").toString();
        if (username.length < 2 || password.length < 4) {
            res.redirect("/admin/setup?err=weak");
            return;
        }
        const now = new Date().toISOString();
        await saveAdminUsers([{ username, name: "系統管理者", passwordHash: hashAdminPassword(password), title: "經理", status: "active", createdAt: now }]);
        res.redirect("/admin/login?ok=1");
    });
    router.post("/login", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const users = await loadAdminUsers();
        const username = (req.body.username || "").trim();
        const password = (req.body.password || "").toString();
        const u = users.find((x) => x.username === username);
        if (!u || !verifyAdminPassword(password, u.passwordHash)) {
            res.redirect("/admin/login?err=1");
            return;
        }
        if (u.status === "disabled") {
            res.redirect("/admin/login?disabled=1");
            return;
        }
        const token = signAdminSession(username);
        res.setHeader("Set-Cookie", `sf_admin_session=${encodeURIComponent(token)}; Path=/admin; HttpOnly; Max-Age=${7 * 24 * 3600}; SameSite=Lax`);
        let nextUrl = (req.body.next || "/admin").toString();
        if (!nextUrl.startsWith("/admin"))
            nextUrl = "/admin";
        if (u.status === "pending")
            nextUrl = "/admin/pending";
        res.redirect(302, nextUrl);
    });
    router.post("/logout", (_req, res) => {
        res.setHeader("Set-Cookie", "sf_admin_session=; Path=/admin; HttpOnly; Max-Age=0; SameSite=Lax");
        res.redirect(302, "/admin/login");
    });
    router.use(async (req, res, next) => {
        const pathname = req.path || "/";
        if (pathname === "/login" && req.method === "GET")
            return next();
        if (pathname === "/setup" && req.method === "GET")
            return next();
        if (pathname === "/login" && req.method === "POST")
            return next();
        if (pathname === "/setup" && req.method === "POST")
            return next();
        if (pathname === "/logout" && req.method === "POST")
            return next();
        const cookies = parseAdminCookies(req.headers.cookie || "");
        const token = cookies.sf_admin_session;
        const uname = verifyAdminSessionToken(token);
        if (!uname) {
            const nu = encodeURIComponent(req.originalUrl || "/admin");
            res.redirect(302, "/admin/login?next=" + nu);
            return;
        }
        const users = await loadAdminUsers();
        const profile = users.find((x) => x.username === uname);
        if (!profile) {
            res.setHeader("Set-Cookie", "sf_admin_session=; Path=/admin; HttpOnly; Max-Age=0; SameSite=Lax");
            res.redirect(302, "/admin/login?err=1");
            return;
        }
        req.adminUsername = uname;
        req.adminProfile = profile;
        if (profile.status === "disabled") {
            res.setHeader("Set-Cookie", "sf_admin_session=; Path=/admin; HttpOnly; Max-Age=0; SameSite=Lax");
            res.redirect(302, "/admin/login?disabled=1");
            return;
        }
        if (profile.status === "pending") {
            const allowed = pathname === "/pending" || (pathname === "/logout" && req.method === "POST");
            if (!allowed) {
                res.redirect(302, "/admin/pending");
                return;
            }
        }
        res.locals.adminUser = profile.name || uname;
        res.locals.adminTitle = profile.title;
        res.locals.canManageUsers = profile.title === "經理";
        res.locals.isOwner = isAdminOwnerUsername(uname);
        next();
    });
    router.use((req, res, next) => {
        if (!pathLooksLikeDelete(req))
            return next();
        if (req.adminProfile?.title === "移工") {
            res.status(403).type("text/html").send("<!DOCTYPE html><html lang=\"zh-TW\"><head><meta charset=\"utf-8\"><title>權限不足</title></head><body style=\"font-family:sans-serif;padding:24px;\"><p>您的職稱為<strong>移工</strong>，依規定<strong>不可刪除</strong>任何資料（含訂單、客戶、品項等）。</p><p><a href=\"/admin\">返回儀表板</a></p></body></html>");
            return;
        }
        next();
    });
    router.get("/pending", (req, res) => {
        const body = `
        <div class="notion-breadcrumb">待審核</div>
        <h1 class="notion-page-title">帳號待審核</h1>
        <div class="notion-card">
          <p>您的帳號已建立，尚待負責人（<strong>${escapeHtml(ADMIN_OWNER_EMAIL)}</strong>）於「人員管理」審核通過後，即可使用後台。</p>
          <p class="notion-hint">審核通過後請重新登入。若需聯絡管理員，請使用公司管道。</p>
          <form method="post" action="/admin/logout" style="margin-top:16px;"><button type="submit" class="btn">登出</button></form>
        </div>
      `;
        res.type("text/html").send(notionPage("待審核", body, "", res));
    });
    function requireManager(req, res, next) {
        if (req.adminProfile?.title !== "經理") {
            res.status(403).type("text/html").send("<!DOCTYPE html><html lang=\"zh-TW\"><head><meta charset=\"utf-8\"><title>權限不足</title></head><body style=\"font-family:sans-serif;padding:24px;\"><p>此功能僅限<strong>經理</strong>使用。</p><p><a href=\"/admin\">返回儀表板</a></p></body></html>");
            return;
        }
        next();
    }
    router.get("/users", requireManager, async (req, res) => {
        const users = await loadAdminUsers();
        const msg = req.query.ok === "add" ? "<p class=\"notion-msg ok\">已新增帳號（待審核）。</p>"
            : req.query.ok === "del" ? "<p class=\"notion-msg ok\">已刪除帳號。</p>"
                : req.query.ok === "approve" ? "<p class=\"notion-msg ok\">已核准帳號。</p>"
                    : req.query.ok === "status" ? "<p class=\"notion-msg ok\">已更新狀態。</p>"
                        : req.query.err === "dup" ? "<p class=\"notion-msg err\">帳號已存在。</p>"
                            : req.query.err === "last" ? "<p class=\"notion-msg err\">至少需保留一個帳號。</p>"
                                : req.query.err === "weak" ? "<p class=\"notion-msg err\">帳號至少 2 字元、密碼至少 4 字元。</p>"
                                    : req.query.err === "forbidden" ? "<p class=\"notion-msg err\">無權限執行此操作。</p>"
                                        : req.query.err === "owner" ? "<p class=\"notion-msg err\">不可變更負責人帳號。</p>" : "";
        const titleOpts = ADMIN_TITLES.map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join("");
        const pending = users.filter((u) => u.status === "pending");
        const activeList = users.filter((u) => u.status === "active");
        const disabledList = users.filter((u) => u.status === "disabled");
        const pendingRows = pending.map((u) => {
            const approveBtn = isAdminOwnerUsername(req.adminUsername)
                ? `<form method="post" action="/admin/users/approve" style="display:inline;margin-right:8px;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="btn btn-primary">核准</button></form>`
                : "<span class=\"notion-hint\">僅負責人可核准</span>";
            return `<tr><td>${escapeHtml(u.name || u.username)}</td><td><code>${escapeHtml(u.username)}</code></td><td>${escapeHtml(u.title)}</td><td>${approveBtn}</td></tr>`;
        }).join("");
        const activeRows = activeList.map((u) => {
            const ownerMark = isAdminOwnerUsername(u.username) ? " <span class=\"notion-hint\">(負責人)</span>" : "";
            const delForm = (!isAdminOwnerUsername(u.username) && users.length > 1)
                ? `<form method="post" action="/admin/users/delete" style="display:inline;margin-left:8px;" onsubmit="return confirm('確定刪除？');"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="btn">刪除</button></form>`
                : "";
            const disForm = !isAdminOwnerUsername(u.username)
                ? `<form method="post" action="/admin/users/set-status" style="display:inline;margin-left:8px;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><input type="hidden" name="status" value="disabled"><button type="submit" class="btn">停用</button></form>`
                : "";
            const titleForm = !isAdminOwnerUsername(u.username)
                ? `<form method="post" action="/admin/users/set-title" style="display:inline-flex;align-items:center;gap:6px;margin-left:8px;flex-wrap:wrap;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><input type="text" name="name" value="${escapeAttr(u.name || "")}" placeholder="姓名" style="width:110px;"><select name="title">${ADMIN_TITLES.map((t) => `<option value="${escapeAttr(t)}" ${u.title === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}</select><button type="submit" class="btn">更新</button></form>`
                : escapeHtml(u.title);
            return `<tr><td>${escapeHtml(u.name || u.username)}${ownerMark}</td><td><code>${escapeHtml(u.username)}</code></td><td>${isAdminOwnerUsername(u.username) ? escapeHtml(u.title) : titleForm}</td><td>啟用 ${disForm} ${delForm}</td></tr>`;
        }).join("");
        const disabledRows = disabledList.map((u) => {
            const enForm = `<form method="post" action="/admin/users/set-status" style="display:inline;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><input type="hidden" name="status" value="active"><button type="submit" class="btn">重新啟用</button></form>`;
            const delForm = `<form method="post" action="/admin/users/delete" style="display:inline;margin-left:8px;" onsubmit="return confirm('確定刪除此帳號？');"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="btn">刪除</button></form>`;
            return `<tr><td>${escapeHtml(u.name || u.username)}</td><td><code>${escapeHtml(u.username)}</code></td><td>${escapeHtml(u.title)}</td><td>停用 ${enForm} ${!isAdminOwnerUsername(u.username) ? delForm : ""}</td></tr>`;
        }).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 人員管理</div>
        <h1 class="notion-page-title">人員管理</h1>
        <p class="notion-hint">僅<strong>經理</strong>可進入本頁。負責人信箱：<code>${escapeHtml(ADMIN_OWNER_EMAIL)}</code>（可環境變數 <code>ADMIN_OWNER_EMAIL</code> 覆寫）。新帳號須由負責人<strong>核准</strong>後才可登入。<strong>移工</strong>無法刪除任何資料。</p>
        ${msg}
        <div class="notion-card">
          <h2 style="margin-top:0;">待審核</h2>
          <table><thead><tr><th>姓名</th><th>帳號</th><th>職稱</th><th>操作</th></tr></thead><tbody>${pendingRows || "<tr><td colspan=\"4\">尚無待審核帳號</td></tr>"}</tbody></table>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">啟用中</h2>
          <table><thead><tr><th>姓名</th><th>帳號</th><th>職稱</th><th>操作</th></tr></thead><tbody>${activeRows || "<tr><td colspan=\"4\">—</td></tr>"}</tbody></table>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">停用</h2>
          <table><thead><tr><th>姓名</th><th>帳號</th><th>職稱</th><th>操作</th></tr></thead><tbody>${disabledRows || "<tr><td colspan=\"4\">尚無停用帳號</td></tr>"}</tbody></table>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">新增帳號（待審核）</h2>
          <form method="post" action="/admin/users/add">
            <label>姓名 <input type="text" name="name" required minlength="1" autocomplete="off"></label>
            <label>帳號（建議信箱） <input type="text" name="username" required minlength="2" autocomplete="off"></label>
            <label>密碼 <input type="password" name="password" required minlength="4" autocomplete="new-password"></label>
            <label>職稱 <select name="title">${titleOpts}</select></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增（送出後須負責人核准）</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("人員管理", body, "", res));
    });
    router.post("/users/add", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const name = (req.body.name || "").trim();
        const username = (req.body.username || "").trim();
        const password = (req.body.password || "").toString();
        let title = String(req.body.title || "行政").trim();
        if (!ADMIN_TITLES.includes(title))
            title = "行政";
        if (!name || username.length < 2 || password.length < 4) {
            res.redirect("/admin/users?err=weak");
            return;
        }
        const users = await loadAdminUsers();
        if (users.some((x) => x.username === username)) {
            res.redirect("/admin/users?err=dup");
            return;
        }
        const now = new Date().toISOString();
        users.push({ username, name, passwordHash: hashAdminPassword(password), title, status: "pending", createdAt: now });
        await saveAdminUsers(users);
        res.redirect("/admin/users?ok=add");
    });
    router.post("/users/approve", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        if (!isAdminOwnerUsername(req.adminUsername)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const target = (req.body.username || "").trim();
        const name = (req.body.name || "").trim();
        const users = await loadAdminUsers();
        const ix = users.findIndex((x) => x.username === target);
        if (ix < 0 || users[ix].status !== "pending") {
            res.redirect("/admin/users");
            return;
        }
        users[ix].status = "active";
        users[ix].approvedBy = req.adminUsername;
        users[ix].approvedAt = new Date().toISOString();
        await saveAdminUsers(users);
        res.redirect("/admin/users?ok=approve");
    });
    router.post("/users/set-status", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const target = (req.body.username || "").trim();
        const status = String(req.body.status || "").trim();
        if (status !== "active" && status !== "disabled") {
            res.redirect("/admin/users");
            return;
        }
        if (isAdminOwnerUsername(target)) {
            res.redirect("/admin/users?err=owner");
            return;
        }
        const users = await loadAdminUsers();
        const ix = users.findIndex((x) => x.username === target);
        if (ix < 0) {
            res.redirect("/admin/users");
            return;
        }
        users[ix].status = status;
        await saveAdminUsers(users);
        res.redirect("/admin/users?ok=status");
    });
    router.post("/users/set-title", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const target = (req.body.username || "").trim();
        let title = String(req.body.title || "").trim();
        if (isAdminOwnerUsername(target)) {
            res.redirect("/admin/users?err=owner");
            return;
        }
        if (!ADMIN_TITLES.includes(title))
            title = "行政";
        const users = await loadAdminUsers();
        const ix = users.findIndex((x) => x.username === target);
        if (ix < 0) {
            res.redirect("/admin/users");
            return;
        }
        users[ix].title = title;
        if (name)
            users[ix].name = name;
        await saveAdminUsers(users);
        res.redirect("/admin/users?ok=status");
    });
    router.post("/users/delete", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const delName = (req.body.username || "").trim();
        if (isAdminOwnerUsername(delName)) {
            res.redirect("/admin/users?err=owner");
            return;
        }
        const users = await loadAdminUsers();
        if (users.length <= 1) {
            res.redirect("/admin/users?err=last");
            return;
        }
        const next = users.filter((x) => x.username !== delName);
        if (next.length === users.length) {
            res.redirect("/admin/users");
            return;
        }
        await saveAdminUsers(next);
        res.redirect("/admin/users?ok=del");
    });
    router.post("/api/working-date", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const date = req.body.date?.trim();
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.redirect("/admin?err=date");
            return;
        }
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("working_date", date);
        res.redirect(req.get("Referrer") || "/admin");
    });
    router.post("/api/rollover", async (req, res) => {
        const current = await getWorkingDate(db);
        const next = new Date(current + "T12:00:00");
        next.setDate(next.getDate() + 1);
        const nextStr = next.toISOString().slice(0, 10);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("previous_working_date", current);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("working_date", nextStr);
        res.redirect(req.get("Referrer") || "/admin");
    });
    router.post("/api/rollover-undo", async (req, res) => {
        const prev = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("previous_working_date");
        if (prev && prev.value) {
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("working_date", prev.value);
            await db.prepare("DELETE FROM app_settings WHERE key = ?").run("previous_working_date");
        }
        res.redirect(req.get("Referrer") || "/admin");
    });
    router.get("/line-bot", async (_req, res) => {
        const s = await (0, line_bot_control_js_1.getLineBotSettings)(db);
        const accepting = await (0, line_bot_control_js_1.isBotAcceptingOrders)(db);
        let logs = [];
        try {
            logs = await db.prepare("SELECT event_type, detail, created_at FROM line_bot_state_log ORDER BY created_at DESC LIMIT 80").all();
        }
        catch (_) { }
        const statusBadge = accepting
            ? `<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:#e6f7e6;color:#0a5;font-weight:600;">目前狀態：可收單（機器人會解析叫貨／可跑 AI）</span>`
            : `<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:#ffeaea;color:#a00;font-weight:600;">目前狀態：休眠（不呼叫 Gemini／不 OCR／不寫訂單；群組內僅「取得群組ID」仍會回覆）</span>`;
        const suppressBadge = s.suppressCustomerReply
            ? `<p style="margin-top:10px;"><span style="display:inline-block;padding:4px 10px;border-radius:6px;background:#fff7e6;color:#a60;font-weight:600;">對客戶訊息：靜音中（仍照常收單寫庫；不發一般回覆與 30 秒結單推播；「取得群組ID」「群組ID」仍會回覆）</span></p>`
            : "";
        const modeOpts = [
            { v: "always_on", l: "一律開啟（測試／全天候）" },
            { v: "always_off", l: "一律關閉（不回覆叫貨）" },
            { v: "scheduled", l: "依下方時段（台北時間）" },
        ].map((o) => `<label style="display:block;margin:6px 0;"><input type="radio" name="line_bot_mode" value="${escapeAttr(o.v)}" ${s.mode === o.v ? "checked" : ""}> ${escapeHtml(o.l)}</label>`).join("");
        const logRows = logs.length
            ? logs.map((r) => `<tr><td style="white-space:nowrap;font-size:12px;">${escapeHtml(r.created_at || "")}</td><td>${escapeHtml(r.event_type || "")}</td><td style="font-size:12px;word-break:break-all;">${escapeHtml((r.detail || "").slice(0, 200))}</td></tr>`).join("")
            : "<tr><td colspan='3'>尚無紀錄</td></tr>";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / LINE 機器人</div>
        <h1 class="notion-page-title">LINE 機器人：啟動與排程</h1>
        ${_req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存設定。</p>" : ""}
        <p>${statusBadge}</p>
        ${suppressBadge}
        <div class="notion-card">
          <h2 style="margin-top:0;">運作模式</h2>
          <form method="post" action="/admin/line-bot">
            ${modeOpts}
            <p class="notion-hint" style="margin-top:12px;"><strong>排程時段（台北時間）</strong>　僅在選「依下方時段」時生效：此時段<strong>內</strong>為可收單；<strong>時段外</strong>機器人休眠（不產生 Gemini／圖片 OCR 等費用）。預設範例：18:00～隔日 03:00（日間上班時間休眠）。</p>
            <label>開始 <input type="time" name="line_bot_window_start" value="${escapeAttr(s.windowStart)}"></label>
            　<label>結束 <input type="time" name="line_bot_window_end" value="${escapeAttr(s.windowEnd)}"></label>
            <p class="notion-hint" style="margin-top:16px;"><label style="margin:0;font-weight:400;"><input type="checkbox" name="line_bot_ai_gate" value="1" ${s.aiGate ? "checked" : ""}> 啟用 AI 過濾（僅對「非收單關鍵字」的閒聊不回覆；需設定 GOOGLE_GEMINI_API_KEY）</label></p>
            <p class="notion-hint" style="margin-top:12px;"><label style="margin:0;font-weight:400;"><input type="checkbox" name="line_bot_suppress_reply" value="1" ${s.suppressCustomerReply ? "checked" : ""}> <strong>對客戶訊息靜音</strong>：仍照常收單並寫入訂單；僅不向群組發送一般回覆與 30 秒結單推播。群組內傳「取得群組ID」或「群組ID」仍會回覆（供綁定）。</label></p>
            <p class="notion-hint">若從未在此儲存過本項，可沿用伺服器環境變數 <code>LINE_SUPPRESS_LINE_REPLIES</code>；儲存後以本頁勾選為準。</p>
            <p class="notion-hint">測試階段建議選「一律開啟」，確認無誤後再改「依時段」。AI 過濾建議先關閉，避免誤擋。</p>
            <p><button type="submit" class="btn btn-primary">儲存設定</button></p>
          </form>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">設定與狀態紀錄</h2>
          <table><thead><tr><th>時間</th><th>類型</th><th>內容</th></tr></thead><tbody>${logRows}</tbody></table>
        </div>
      `;
        res.type("text/html").send(notionPage("LINE 機器人", body, "line-bot", res));
    });
    router.post("/line-bot", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const mode = (req.body.line_bot_mode || "always_on").toString().trim();
        const wStart = (req.body.line_bot_window_start || "18:00").toString().trim();
        const wEnd = (req.body.line_bot_window_end || "03:00").toString().trim();
        const aiGate = req.body.line_bot_ai_gate === "1" ? "1" : "0";
        const suppressReply = req.body.line_bot_suppress_reply === "1" ? "1" : "0";
        const allowed = new Set(["always_on", "always_off", "scheduled"]);
        const m = allowed.has(mode) ? mode : "always_on";
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_bot_mode", m);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_bot_window_start", wStart);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_bot_window_end", wEnd);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_bot_ai_gate", aiGate);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_suppress_customer_reply", suppressReply);
        await (0, line_bot_control_js_1.appendLineBotLog)(db, "settings_saved", { mode: m, windowStart: wStart, windowEnd: wEnd, aiGate: aiGate === "1", suppressCustomerReply: suppressReply === "1" });
        res.redirect("/admin/line-bot?ok=1");
    });
    /** DB 尚無 line_unit_conversion_rules 時的範例；胡蘿蔔／小黃瓜等請改用品項 2-2 或自行在換算頁新增，避免與品項設定衝突 */
    const DEFAULT_LINE_UNIT_RULES = JSON.stringify({
        rules: [
            {
                productNameContains: "芹菜",
                fromUnits: ["小把"],
                toUnit: "公斤",
                kgPerUnit: 0.05,
                kgSafetyFactor: 1,
                remarkStyle: "prefix",
            },
        ],
    }, null, 2);
    function normalizeLineUnitRules(rawText) {
        const j = JSON.parse(rawText || "{}");
        if (!j || typeof j !== "object" || !Array.isArray(j.rules))
            throw new Error("invalid shape");
        const out = [];
        for (const r of j.rules) {
            const from = Array.isArray(r.fromUnits) ? r.fromUnits : (r.fromUnit ? [r.fromUnit] : []);
            if (from.length === 0)
                throw new Error("fromUnits");
            const kg = Number(r.kgPerUnit ?? r.kg_per_unit);
            if (!Number.isFinite(kg) || kg <= 0)
                throw new Error("kgPerUnit");
            if (!r.productId && !r.productNameContains)
                throw new Error("need productId or productNameContains");
            out.push({
                productId: r.productId ? String(r.productId).trim() : undefined,
                productNameContains: r.productNameContains ? String(r.productNameContains).trim() : undefined,
                fromUnits: from.map((x) => String(x).trim()).filter(Boolean),
                toUnit: (r.toUnit ? String(r.toUnit).trim() : "公斤") || "公斤",
                kgPerUnit: kg,
                kgSafetyFactor: r.kgSafetyFactor != null ? Number(r.kgSafetyFactor) : undefined,
                remarkStyle: r.remarkStyle ? String(r.remarkStyle).trim() : "prefix",
            });
        }
        return { rules: out };
    }
    async function loadLineUnitRulesObject() {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_unit_conversion_rules");
        const txt = (row?.value && String(row.value).trim()) ? String(row.value) : DEFAULT_LINE_UNIT_RULES;
        return normalizeLineUnitRules(txt);
    }
    async function saveLineUnitRulesObject(obj) {
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_unit_conversion_rules", JSON.stringify(obj));
    }
    async function loadLineUnitIgnoredList() {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_unit_conversion_ignored");
        if (!row?.value)
            return [];
        try {
            const arr = JSON.parse(String(row.value));
            return Array.isArray(arr) ? arr.map((x) => String(x || "").trim()).filter(Boolean) : [];
        }
        catch (_) {
            return [];
        }
    }
    async function saveLineUnitIgnoredList(arr) {
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_unit_conversion_ignored", JSON.stringify(arr));
    }
    router.get("/line-bot/unit-conversion", async (req, res) => {
        let rulesObj;
        try {
            rulesObj = await loadLineUnitRulesObject();
        }
        catch (_) {
            rulesObj = JSON.parse(DEFAULT_LINE_UNIT_RULES);
        }
        const rulesText = JSON.stringify(rulesObj, null, 2);
        const ok = req.query.ok === "1";
        const err = req.query.err === "1";
        const candidatesAll = await db.prepare(`
      SELECT oi.raw_name, oi.unit, COUNT(*) AS c
      FROM order_items oi
      WHERE oi.unit IS NOT NULL AND TRIM(oi.unit) <> '' AND TRIM(oi.unit) <> '公斤'
      GROUP BY oi.raw_name, oi.unit
      ORDER BY c DESC, oi.raw_name
      LIMIT 300
    `).all();
        const hasRuleFor = (name, unit) => {
            const n = String(name || "");
            const u = String(unit || "");
            return (rulesObj.rules || []).some((r) => {
                const from = Array.isArray(r.fromUnits) ? r.fromUnits.map((x) => String(x)) : [];
                if (!from.includes(u))
                    return false;
                if (!r.productNameContains)
                    return false;
                return n.includes(String(r.productNameContains));
            });
        };
        const pendingRows = candidatesAll.filter((r) => !hasRuleFor(r.raw_name, r.unit));
        const ignored = await loadLineUnitIgnoredList();
        const ignoredSet = new Set(ignored);
        const pendingVisible = pendingRows.filter((r) => !ignoredSet.has(`${String(r.raw_name || "").trim()}||${String(r.unit || "").trim()}`));
        const confirmedRows = (rulesObj.rules || []).map((r, idx) => ({
            idx,
            productNameContains: r.productNameContains || "",
            fromUnits: Array.isArray(r.fromUnits) ? r.fromUnits.join("、") : "",
            kgPerUnit: r.kgPerUnit,
            toUnit: r.toUnit || "公斤",
        }));
        const pendingBadge = pendingVisible.length > 0
            ? `<span style="display:inline-block;background:#ffe5e5;color:#b00020;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;">${pendingVisible.length}</span>`
            : `<span style="display:inline-block;background:#e8f5e9;color:#2e7d32;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;">0</span>`;
        const pendingTable = pendingVisible.length
            ? pendingVisible.map((r) => `<tr><td>${escapeHtml(r.raw_name || "")}</td><td>${escapeHtml(r.unit || "")}</td><td>${Number(r.c) || 0}</td><td><form method="post" action="/admin/line-bot/unit-conversion" style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;"><input type="hidden" name="action" value="add_rule"><input type="hidden" name="product_name_contains" value="${escapeAttr(r.raw_name || "")}"><input type="hidden" name="from_unit" value="${escapeAttr(r.unit || "")}"><input type="number" step="0.001" min="0.001" name="kg_per_unit" value="0.1" style="width:88px;" required><button type="submit" class="btn btn-primary">加入規則</button></form></td><td><form method="post" action="/admin/line-bot/unit-conversion" style="display:inline;"><input type="hidden" name="action" value="delete_pending"><input type="hidden" name="raw_name" value="${escapeAttr(r.raw_name || "")}"><input type="hidden" name="unit" value="${escapeAttr(r.unit || "")}"><button type="submit" class="btn">刪除</button></form></td></tr>`).join("")
            : "<tr><td colspan='5'>目前沒有未確認品項。</td></tr>";
        const confirmedTable = confirmedRows.length
            ? confirmedRows.map((r) => `<tr data-rule-row><td>${escapeHtml(r.productNameContains)}</td><td>${escapeHtml(r.fromUnits)}</td><td>${escapeHtml(String(r.kgPerUnit))}</td><td>${escapeHtml(r.toUnit)}</td><td><form method="post" action="/admin/line-bot/unit-conversion" style="display:inline;"><input type="hidden" name="action" value="delete_rule"><input type="hidden" name="rule_index" value="${r.idx}"><button type="submit" class="btn">刪除</button></form></td></tr>`).join("")
            : "<tr><td colspan='5'>尚未建立任何換算規則。</td></tr>";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/line-bot">LINE 機器人</a> / 叫貨單位換算</div>
        <h1 class="notion-page-title">叫貨單位換算（LINE）</h1>
        ${ok ? "<p class=\"notion-msg ok\">已儲存規則。</p>" : ""}
        ${err ? "<p class=\"notion-msg err\">JSON 格式錯誤：須為物件且含 <code>rules</code> 陣列；每條規則須有 <code>fromUnits</code> 與有效的 <code>kgPerUnit</code>，並需設定 <code>productId</code> 或 <code>productNameContains</code>。</p>" : ""}
        <p class="notion-hint">當客戶用「把／條／根／支／包」下單，但實際是公斤計價時，請先在本頁建立規則。第一分頁會自動列出系統偵測到的未確認品項；第二分頁是已確認規則，可搜尋與持續建置。</p>
        <div class="notion-card" style="margin-bottom:16px;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button type="button" id="tabPendingBtn" class="btn btn-primary">未確認品項 ${pendingBadge}</button>
            <button type="button" id="tabConfirmedBtn" class="btn">已確認規則（可搜尋）</button>
          </div>
          <div id="tabPending" style="margin-top:12px;">
            <table><thead><tr><th>品項名稱</th><th>下單單位</th><th>出現次數</th><th>快速加入規則（公斤/單位）</th><th>操作</th></tr></thead><tbody>${pendingTable}</tbody></table>
          </div>
          <div id="tabConfirmed" style="display:none;margin-top:12px;">
            <p style="margin:0 0 8px;"><input type="search" id="ruleSearchInput" placeholder="模糊搜尋品項或單位" style="width:260px;"></p>
            <table><thead><tr><th>品項關鍵字</th><th>來源單位</th><th>kgPerUnit</th><th>目標單位</th><th>操作</th></tr></thead><tbody id="ruleTableBody">${confirmedTable}</tbody></table>
            <h3 style="margin-top:14px;">新增規則</h3>
            <form method="post" action="/admin/line-bot/unit-conversion" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
              <input type="hidden" name="action" value="add_rule">
              <label style="margin:0;">品項關鍵字 <input type="text" name="product_name_contains" required placeholder="例：白蘿蔔"></label>
              <label style="margin:0;">來源單位 <input type="text" name="from_unit" required placeholder="例：條"></label>
              <label style="margin:0;">公斤/單位 <input type="number" step="0.001" min="0.001" name="kg_per_unit" required placeholder="例：0.2"></label>
              <button type="submit" class="btn btn-primary">新增</button>
            </form>
          </div>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">進階：JSON 批次編輯</h2>
          <form method="post" action="/admin/line-bot/unit-conversion">
            <textarea name="rules_json" rows="22" style="width:100%;box-sizing:border-box;font-family:ui-monospace,monospace;font-size:13px;">${escapeHtml(rulesText)}</textarea>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">儲存規則</button></p>
          </form>
        </div>
        <script>
        (function(){
          var bP = document.getElementById('tabPendingBtn');
          var bC = document.getElementById('tabConfirmedBtn');
          var p = document.getElementById('tabPending');
          var c = document.getElementById('tabConfirmed');
          if (bP && bC && p && c) {
            bP.onclick = function(){ p.style.display='block'; c.style.display='none'; bP.classList.add('btn-primary'); bC.classList.remove('btn-primary'); };
            bC.onclick = function(){ p.style.display='none'; c.style.display='block'; bC.classList.add('btn-primary'); bP.classList.remove('btn-primary'); };
          }
          var inp = document.getElementById('ruleSearchInput');
          var tbody = document.getElementById('ruleTableBody');
          if (inp && tbody) {
            inp.addEventListener('input', function(){
              var q = (inp.value || '').toLowerCase().trim();
              Array.prototype.forEach.call(tbody.querySelectorAll('tr[data-rule-row]'), function(tr){
                var t = (tr.textContent || '').toLowerCase();
                tr.style.display = (!q || t.indexOf(q) >= 0) ? '' : 'none';
              });
            });
          }
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("叫貨單位換算", body, "line-bot-unit", res));
    });
    router.post("/line-bot/unit-conversion", express_1.default.urlencoded({ extended: true, limit: "512kb" }), async (req, res) => {
        const action = String(req.body?.action || "").trim();
        try {
            if (action === "add_rule") {
                const pname = String(req.body?.product_name_contains || "").trim();
                const fromUnit = String(req.body?.from_unit || "").trim();
                const kg = Number(req.body?.kg_per_unit);
                if (!pname || !fromUnit || !Number.isFinite(kg) || kg <= 0)
                    throw new Error("invalid add");
                const obj = await loadLineUnitRulesObject();
                obj.rules.push({
                    productNameContains: pname,
                    fromUnits: [fromUnit],
                    toUnit: "公斤",
                    kgPerUnit: kg,
                    kgSafetyFactor: 1,
                    remarkStyle: "prefix",
                });
                await saveLineUnitRulesObject(normalizeLineUnitRules(JSON.stringify(obj)));
                res.redirect("/admin/line-bot/unit-conversion?ok=1");
                return;
            }
            if (action === "delete_rule") {
                const idx = Number(req.body?.rule_index);
                const obj = await loadLineUnitRulesObject();
                if (Number.isInteger(idx) && idx >= 0 && idx < obj.rules.length) {
                    obj.rules.splice(idx, 1);
                    await saveLineUnitRulesObject(normalizeLineUnitRules(JSON.stringify(obj)));
                }
                res.redirect("/admin/line-bot/unit-conversion?ok=1");
                return;
            }
            if (action === "delete_pending") {
                const rawName = String(req.body?.raw_name || "").trim();
                const unit = String(req.body?.unit || "").trim();
                if (!rawName || !unit)
                    throw new Error("invalid delete pending");
                const arr = await loadLineUnitIgnoredList();
                const key = `${rawName}||${unit}`;
                if (!arr.includes(key))
                    arr.push(key);
                await saveLineUnitIgnoredList(arr);
                res.redirect("/admin/line-bot/unit-conversion?ok=1");
                return;
            }
            const txt = String(req.body?.rules_json ?? "").trim();
            const j = normalizeLineUnitRules(txt || "{}");
            await saveLineUnitRulesObject(j);
            res.redirect("/admin/line-bot/unit-conversion?ok=1");
        }
        catch (_e) {
            res.redirect("/admin/line-bot/unit-conversion?err=1");
        }
    });
    router.get("/", (_req, res) => {
        const tapmc = wholesale_price_js_1.TAPMC_PRICE_URL;
        const body = `
        <div class="notion-breadcrumb">儀表板</div>
        <h1 class="notion-page-title">儀表板</h1>
        <div class="notion-card" style="border-left:4px solid var(--notion-accent);">
          <h2 style="margin-top:0;">北農單日交易行情</h2>
          <p class="notion-hint" style="margin-top:0;">即時行情請至臺北農產官網查詢（場內拍賣／全場交易、上／中／下價說明與 Excel／PDF 下載皆在該站）。本頁不載入資料以加快儀表板開啟速度。</p>
          <p style="margin-top:12px;"><a href="${tapmc}" target="_blank" rel="noopener" class="btn btn-primary">開啟臺北農產「單日交易行情查詢」</a></p>
          <p class="notion-hint" style="margin-top:12px;">若需本系統內依農業部開放資料整理的北農行情，請至 <a href="/admin/logistics/market">物流工具 → 北農行情</a>。</p>
        </div>
        <p class="notion-hint">更多儀表板項目將陸續新增。</p>
      `;
        res.type("text/html").send(notionPage("儀表板", body, "dashboard", res));
    });
    router.get("/inventory", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const managerRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("inventory_manager");
        const managerName = managerRow?.value ?? "";
        const whFilter = (req.query.warehouse_id || "").trim();
        const qFilter = (req.query.q || "").trim().toLowerCase();
        const assignRows = await db.prepare(`
          SELECT iw.name AS warehouse_name, iwp.warehouse_id, iwp.product_id, p.name AS product_name, p.unit,
                 COALESCE(iwp.safety_stock, 0) AS safety_stock
          FROM inventory_warehouse_products iwp
          JOIN inventory_warehouses iw ON iw.id = iwp.warehouse_id
          JOIN products p ON p.id = iwp.product_id
          ORDER BY iw.sort_order, iw.name, iwp.sort_order, p.name
        `).all();
        const latestByWh = {};
        for (const w of warehouses) {
            const rec = await db.prepare("SELECT record_date, items FROM daily_inventory WHERE warehouse_id = ? ORDER BY record_date DESC LIMIT 1").get(w.id);
            if (rec) {
                const items = typeof rec.items === "string" ? JSON.parse(rec.items || "{}") : rec.items || {};
                latestByWh[w.id] = items;
            }
            else {
                latestByWh[w.id] = {};
            }
        }
        let rows = assignRows.map((r) => {
            const items = latestByWh[r.warehouse_id] || {};
            const current = items[r.product_id];
            const currentNum = current != null ? (typeof current === "number" ? current : parseFloat(current)) : null;
            return {
                warehouse_id: r.warehouse_id,
                warehouse_name: r.warehouse_name,
                product_id: r.product_id,
                product_name: r.product_name,
                unit: r.unit,
                safety_stock: Number(r.safety_stock) || 0,
                current_stock: currentNum,
            };
        });
        if (whFilter)
            rows = rows.filter((r) => r.warehouse_id === whFilter);
        if (qFilter)
            rows = rows.filter((r) => (r.product_name || "").toLowerCase().indexOf(qFilter) >= 0);
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whFilter ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 盤點作業</div>
        <h1 class="notion-page-title">盤點作業</h1>
        <div class="notion-card">
          <h2>各品項目前存量與安全庫存</h2>
          <form method="get" action="/admin/inventory" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <label>倉庫 <select name="warehouse_id" onchange="this.form.submit()"><option value="">全部</option>${optWh}</select></label>
            <label>搜尋品項 <input type="text" name="q" value="${escapeAttr(req.query.q || "")}" placeholder="品名"></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          <table>
            <thead><tr><th>倉庫</th><th>品項</th><th>單位</th><th>目前存量</th><th>安全庫存</th><th>狀態</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => {
          const low = r.safety_stock > 0 && (r.current_stock == null || Number(r.current_stock) < r.safety_stock);
          return `<tr><td>${escapeHtml(r.warehouse_name)}</td><td>${escapeHtml(r.product_name)}</td><td>${escapeHtml(r.unit || "")}</td><td>${r.current_stock != null ? r.current_stock : "—"}</td><td>${r.safety_stock}</td><td>${low ? "<span style=\"color:#c00;\">低於安全庫存</span>" : "正常"}</td></tr>`;
        }).join("") : "<tr><td colspan=\"6\">尚無品項歸倉資料，請先至「品項歸倉」設定。</td></tr>"}
            </tbody>
          </table>
        </div>
        <div class="notion-card">
          <h2>快速連結</h2>
          <ul style="margin:0;padding-left:20px;">
            <li><a href="/admin/inventory/warehouses">庫房管理</a> － 新增／編輯／刪除庫房（共 ${warehouses.length} 個）</li>
            <li><a href="/admin/inventory/assign">品項歸倉</a> － 將貨品管理中的品項填入指定庫房，並設定排序與安全庫存</li>
            <li><a href="/admin/inventory/daily">每日盤點</a> － 依日期與庫房填寫盤點數量</li>
            <li><a href="/admin/inventory/import-erp">匯入 ERP 資料</a> － 匯入銷貨數量以便計算盤差</li>
            <li><a href="/admin/inventory/variance-report">盤差報表</a> － 依倉庫與日期區間產出盤差、匯出與易盤差品項統計</li>
            <li><a href="/admin/inventory/manager">管理人設定</a> － ${managerName ? "目前管理人：" + escapeHtml(managerName) : "尚未設定管理人"}</li>
          </ul>
        </div>
      `;
        res.type("text/html").send(notionPage("盤點作業", body, "inventory", res));
    });
    router.get("/inventory/warehouses", async (req, res) => {
        const rows = await db.prepare("SELECT id, name, sort_order FROM inventory_warehouses ORDER BY sort_order, name").all();
        const managerRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("inventory_manager");
        const currentManager = (managerRow && managerRow.value) || "";
        const adminUsers = (await loadAdminUsers()).filter((u) => u.status === "active");
        const managerOpts = [`<option value="">— 未指定 —</option>`, ...adminUsers.map((u) => {
                const n = (u.name || u.username || "").trim();
                return `<option value="${escapeAttr(n)}" ${n === currentManager ? "selected" : ""}>${escapeHtml(n)}（${escapeHtml(u.title || "")}）</option>`;
            })].join("");
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已新增庫房。</p>" : req.query.ok === "edit" ? "<p class=\"notion-msg ok\">已儲存。</p>" : req.query.ok === "del" ? "<p class=\"notion-msg ok\">已刪除。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 庫房管理</div>
        <h1 class="notion-page-title">庫房管理</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/inventory/warehouses/new" class="btn btn-primary">＋ 新增庫房</a></p>
        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">盤點作業管理人</h2>
          <form method="post" action="/admin/inventory/manager" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label style="margin:0;">管理人姓名 <select name="manager_name">${managerOpts}</select></label>
            <button type="submit" class="btn btn-primary">儲存管理人</button>
          </form>
        </div>
        <div class="notion-card">
          <table>
            <thead><tr><th>順序</th><th>庫房名稱</th><th>操作</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => `<tr><td>${r.sort_order}</td><td>${escapeHtml(r.name)}</td><td><a href="/admin/inventory/warehouses/${encodeURIComponent(r.id)}/edit">編輯</a> | <a href="/admin/inventory/warehouses/${encodeURIComponent(r.id)}/delete">刪除</a></td></tr>`).join("") : "<tr><td colspan=\"3\">尚無庫房，請先新增。</td></tr>"}
            </tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("庫房管理", body, "inv-wh", res));
    });
    router.get("/inventory/warehouses/new", async (_req, res) => {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / <a href="/admin/inventory/warehouses">庫房管理</a> / 新增庫房</div>
        <h1 class="notion-page-title">新增庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/inventory/warehouses/new">
            <label>庫房名稱 <input type="text" name="name" required placeholder="例：1號庫蔬菜"></label>
            <label>順序（數字，愈小愈前面） <input type="number" name="sort_order" value="0"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button> <a href="/admin/inventory/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增庫房", body, "inv-wh", res));
    });
    router.post("/inventory/warehouses/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = (req.body.name || "").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        if (!name) {
            res.redirect("/admin/inventory/warehouses/new?err=name");
            return;
        }
        const id = (0, id_js_1.newId)("invwh");
        const now = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare(`INSERT INTO inventory_warehouses (id, name, sort_order, created_at) VALUES (?, ?, ?, ${now})`).run(id, name, sortOrder);
        res.redirect("/admin/inventory/warehouses?ok=1");
    });
    router.get("/inventory/warehouses/:id/edit", async (req, res) => {
        const row = await db.prepare("SELECT id, name, sort_order FROM inventory_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/inventory/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / <a href="/admin/inventory/warehouses">庫房管理</a> / 編輯庫房</div>
        <h1 class="notion-page-title">編輯庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/inventory/warehouses/${encodeURIComponent(row.id)}/edit">
            <label>庫房名稱 <input type="text" name="name" value="${escapeAttr(row.name)}" required></label>
            <label>順序 <input type="number" name="sort_order" value="${row.sort_order}"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/inventory/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("編輯庫房", body, "inv-wh", res));
    });
    router.post("/inventory/warehouses/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const name = (req.body.name || "").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        const row = await db.prepare("SELECT id FROM inventory_warehouses WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/inventory/warehouses?err=notfound");
            return;
        }
        if (!name) {
            res.redirect("/admin/inventory/warehouses/" + encodeURIComponent(id) + "/edit?err=name");
            return;
        }
        await db.prepare("UPDATE inventory_warehouses SET name = ?, sort_order = ? WHERE id = ?").run(name, sortOrder, id);
        res.redirect("/admin/inventory/warehouses?ok=edit");
    });
    router.get("/inventory/warehouses/:id/delete", async (req, res) => {
        const row = await db.prepare("SELECT id, name FROM inventory_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/inventory/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / <a href="/admin/inventory/warehouses">庫房管理</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除庫房</h1>
        <div class="notion-card">
          <p>確定要刪除「${escapeHtml(row.name)}」？此庫房內已歸倉的品項與每日盤點紀錄將一併移除關聯。</p>
          <p style="margin-top:16px;">
            <form method="post" action="/admin/inventory/warehouses/${encodeURIComponent(row.id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form>
            <a href="/admin/inventory/warehouses" class="btn">取消</a>
          </p>
        </div>
      `;
        res.type("text/html").send(notionPage("確認刪除庫房", body, "inv-wh", res));
    });
    router.post("/inventory/warehouses/:id/delete", async (req, res) => {
        const id = req.params.id;
        await db.prepare("DELETE FROM inventory_warehouse_products WHERE warehouse_id = ?").run(id);
        await db.prepare("DELETE FROM daily_inventory WHERE warehouse_id = ?").run(id);
        await db.prepare("DELETE FROM inventory_warehouses WHERE id = ?").run(id);
        res.redirect("/admin/inventory/warehouses?ok=del");
    });
    router.get("/inventory/assign", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const whId = req.query.warehouse_id?.trim() || (warehouses[0] && warehouses[0].id) || "";
        const searchQ = (req.query.q || "").trim().replace(/%/g, "");
        let inWarehouse = [];
        let allProducts = [];
        if (whId) {
            inWarehouse = await db.prepare("SELECT pwp.product_id, pwp.sort_order, COALESCE(pwp.safety_stock, 0) as safety_stock, p.name, p.unit FROM inventory_warehouse_products pwp JOIN products p ON p.id = pwp.product_id WHERE pwp.warehouse_id = ? ORDER BY pwp.sort_order, p.name").all(whId);
            if (searchQ) {
                const like = "%" + searchQ + "%";
                allProducts = await db.prepare("SELECT id, name, unit, erp_code FROM products WHERE (active = 1 OR active IS NULL) AND (name LIKE ? OR (erp_code IS NOT NULL AND erp_code LIKE ?)) ORDER BY name").all(like, like);
            }
            else {
                allProducts = await db.prepare("SELECT id, name, unit, erp_code FROM products WHERE active = 1 OR active IS NULL ORDER BY name").all();
            }
        }
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const availableProducts = whId ? allProducts.filter((p) => !inWarehouse.some((x) => x.product_id === p.id)) : [];
        const whName = whId ? (warehouses.find((w) => w.id === whId)?.name || "") : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 品項歸倉</div>
        <h1 class="notion-page-title">品項歸倉</h1>
        ${req.query.ok === "1" ? "<p class=\"notion-msg ok\">已加入品項。</p>" : req.query.ok === "settings" ? "<p class=\"notion-msg ok\">已儲存排序與安全庫存。</p>" : req.query.ok === "remove" ? "<p class=\"notion-msg ok\">已移出。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : ""}
        <div class="notion-card assign-section">
          <div class="assign-section-title">區域一 · 選擇庫房</div>
          <h2 class="notion-card-title">庫房</h2>
          <p class="notion-hint">請先選定要設定的庫房；變更庫房後，第二區與第三區會跟著切換。</p>
          <form method="get" action="/admin/inventory/assign" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <label style="margin:0;">庫房 <select name="warehouse_id" onchange="this.form.submit()">${optWh || "<option value=\"\">— 請先至庫房管理新增庫房 —</option>"}</select></label>
          </form>
        </div>
        ${whId ? `
        <div class="notion-card assign-section">
          <div class="assign-section-title">區域二 · 搜尋並加入品項</div>
          <h2 class="notion-card-title">加入品項</h2>
          <p class="notion-hint">目標庫房：<strong>${escapeHtml(whName)}</strong>。將「貨品管理」中的品項加入此庫房後，才會出現在「每日盤點」。可先向伺服器<strong>模糊搜尋</strong>（品名／ERP），再在下方清單用<strong>第二個框</strong>即時篩選。</p>
          <form method="get" action="/admin/inventory/assign" style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:12px;">
            <input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}">
            <label style="margin:0;">伺服器搜尋（模糊） <input type="text" name="q" value="${escapeAttr(searchQ)}" placeholder="例如：高麗菜、LM…" style="min-width:220px;"></label>
            <button type="submit" class="btn">搜尋</button>
            ${searchQ ? `<a href="/admin/inventory/assign?warehouse_id=${encodeURIComponent(whId)}" class="btn" style="text-decoration:none;">清除搜尋</a>` : ""}
          </form>
          <p class="notion-hint">以下為尚未加入「${escapeHtml(whName)}」的品項；可在框內即時篩選（不經伺服器）。</p>
          <input type="text" id="addProductSearch" placeholder="輸入品名或 ERP 代碼篩選…" style="margin-bottom:12px;width:100%;max-width:420px;">
          <div id="addProductList" style="max-height:280px;overflow:auto;border:1px solid var(--notion-border);border-radius:6px;padding:8px;background:var(--notion-canvas);">
            ${availableProducts.length ? availableProducts.map((p) => `<div class="add-product-row" data-name="${escapeAttr((p.name || "") + " " + (p.erp_code || ""))}"><form method="post" action="/admin/inventory/assign/add" style="display:inline;"><input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}"><input type="hidden" name="product_id" value="${escapeAttr(p.id)}"><button type="submit" class="btn btn-primary" style="margin:2px;">加入</button></form> ${escapeHtml(p.name)}${p.erp_code ? " <span class=\"notion-hint\" style=\"display:inline;margin:0;\">(" + escapeHtml(p.erp_code) + ")</span>" : ""} ${p.unit ? "<span class=\"notion-hint\" style=\"display:inline;margin:0;\">" + escapeHtml(p.unit) + "</span>" : ""}</div>`).join("") : "<p class=\"notion-hint\" style=\"margin:0;\">— 已全加入或貨品管理尚無品項 —</p>"}
          </div>
          <script>
            (function(){
              var search=document.getElementById('addProductSearch'), list=document.getElementById('addProductList');
              if(!search || !list) return;
              search.oninput=search.onkeyup=function(){
                var q=(this.value||'').toLowerCase();
                [].forEach.call(list.querySelectorAll('.add-product-row'), function(row){
                  var text=(row.getAttribute('data-name')||'').toLowerCase();
                  row.style.display=!q || text.indexOf(q)>=0 ? '' : 'none';
                });
              };
            })();
          </script>
        </div>
        <div class="notion-card assign-section">
          <div class="assign-section-title">區域三 · 已歸入此庫房的品項</div>
          <h2 class="notion-card-title">已歸入品項（${inWarehouse.length} 項）</h2>
          <p class="notion-hint">可編輯排序與安全庫存，或將品項移出本庫房。</p>
          <form method="post" action="/admin/inventory/assign/update-settings">
            <input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}">
            <table>
              <thead><tr><th>排序</th><th>品項</th><th>單位</th><th>安全庫存量</th><th>操作</th></tr></thead>
              <tbody>
                ${inWarehouse.length ? inWarehouse.map((p) => `<tr><td><input type="number" name="sort_${escapeAttr(p.product_id)}" value="${p.sort_order}" style="width:60px;"></td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.unit || "")}</td><td><input type="number" step="any" name="safety_${escapeAttr(p.product_id)}" value="${p.safety_stock}" style="width:80px;" placeholder="0"></td><td><a href="#" onclick="document.getElementById('remove_${escapeAttr(p.product_id)}').submit();return false;">移出</a></td></tr>`).join("") : "<tr><td colspan=\"5\"><span class=\"notion-hint\" style=\"display:inline;margin:0;\">尚無品項，請從區域二「加入品項」新增。</span></td></tr>"}
              </tbody>
            </table>
            ${inWarehouse.length ? "<p style=\"margin-top:12px;\"><button type=\"submit\" class=\"btn btn-primary\">儲存排序與安全庫存</button></p>" : ""}
          </form>
          ${inWarehouse.map((p) => `<form id="remove_${escapeAttr(p.product_id)}" method="post" action="/admin/inventory/assign/remove" style="display:none;"><input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}"><input type="hidden" name="product_id" value="${escapeAttr(p.product_id)}"></form>`).join("")}
        </div>
        ` : `
        <div class="notion-card">
          <p class="notion-hint">請先至「庫房管理」新增庫房後，即可於<strong>區域一</strong>選擇庫房，並在<strong>區域二</strong>加入品項、<strong>區域三</strong>管理已歸入品項。</p>
        </div>
        `}
      `;
        res.type("text/html").send(notionPage("品項歸倉", body, "inv-assign", res));
    });
    router.post("/inventory/assign/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const whId = (req.body.warehouse_id || "").trim();
        const productId = (req.body.product_id || "").trim();
        if (!whId || !productId) {
            res.redirect("/admin/inventory/assign?err=missing");
            return;
        }
        const maxSort = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort FROM inventory_warehouse_products WHERE warehouse_id = ?").get(whId);
        const nextSort = (maxSort && maxSort.next_sort != null) ? maxSort.next_sort : 0;
        try {
            await db.prepare("INSERT INTO inventory_warehouse_products (warehouse_id, product_id, sort_order, safety_stock) VALUES (?, ?, ?, 0)").run(whId, productId, nextSort);
        }
        catch (_) { /* already in warehouse */ }
        res.redirect("/admin/inventory/assign?warehouse_id=" + encodeURIComponent(whId) + "&ok=1");
    });
    router.post("/inventory/assign/update-settings", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const whId = (req.body.warehouse_id || "").trim();
        if (!whId) {
            res.redirect("/admin/inventory/assign?err=missing");
            return;
        }
        const inWarehouse = await db.prepare("SELECT product_id FROM inventory_warehouse_products WHERE warehouse_id = ?").all(whId);
        for (const row of inWarehouse) {
            const pid = row.product_id;
            const sortVal = req.body["sort_" + pid];
            const safetyVal = req.body["safety_" + pid];
            const sortOrder = sortVal !== undefined && sortVal !== "" ? parseInt(String(sortVal), 10) : null;
            const safetyStock = safetyVal !== undefined && safetyVal !== "" ? parseFloat(String(safetyVal)) : null;
            if (sortOrder !== null && !Number.isNaN(sortOrder))
                await db.prepare("UPDATE inventory_warehouse_products SET sort_order = ? WHERE warehouse_id = ? AND product_id = ?").run(sortOrder, whId, pid);
            if (safetyStock !== null && !Number.isNaN(safetyStock))
                await db.prepare("UPDATE inventory_warehouse_products SET safety_stock = ? WHERE warehouse_id = ? AND product_id = ?").run(safetyStock, whId, pid);
        }
        res.redirect("/admin/inventory/assign?warehouse_id=" + encodeURIComponent(whId) + "&ok=settings");
    });
    router.post("/inventory/assign/remove", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const whId = (req.body.warehouse_id || "").trim();
        const productId = (req.body.product_id || "").trim();
        if (whId && productId)
            await db.prepare("DELETE FROM inventory_warehouse_products WHERE warehouse_id = ? AND product_id = ?").run(whId, productId);
        res.redirect("/admin/inventory/assign?warehouse_id=" + encodeURIComponent(whId || "") + "&ok=remove");
    });
    router.get("/inventory/daily", async (req, res) => {
        const date = req.query.date?.trim() || new Date().toISOString().slice(0, 10);
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const whId = req.query.warehouse_id?.trim() || (warehouses[0] && warehouses[0].id) || "";
        let products = [];
        let existing = null;
        if (whId) {
            products = await db.prepare("SELECT pwp.product_id, pwp.sort_order, p.name, p.unit FROM inventory_warehouse_products pwp JOIN products p ON p.id = pwp.product_id WHERE pwp.warehouse_id = ? ORDER BY pwp.sort_order, p.name").all(whId);
            const rec = await db.prepare("SELECT id, filler_name, items, confirmed_at FROM daily_inventory WHERE record_date = ? AND warehouse_id = ?").get(date, whId);
            existing = rec;
        }
        const itemsJson = existing && existing.items ? (typeof existing.items === "string" ? JSON.parse(existing.items || "{}") : existing.items) : {};
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存盤點。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 每日盤點</div>
        <h1 class="notion-page-title">每日盤點</h1>
        ${msg}
        <form method="get" action="/admin/inventory/daily" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <label>日期 <input type="date" name="date" value="${escapeAttr(date)}"></label>
          <label>庫房 <select name="warehouse_id" onchange="this.form.submit()">${optWh || "<option value=\"\">— 請先新增庫房並品項歸倉 —</option>"}</select></label>
          <button type="submit" class="btn">查詢</button>
        </form>
        ${whId && products.length ? `
        <div class="notion-card">
          <form method="post" action="/admin/inventory/daily/save">
            <input type="hidden" name="record_date" value="${escapeAttr(date)}">
            <input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}">
            <label>填表人 <input type="text" name="filler_name" value="${escapeAttr(existing?.filler_name || "")}" placeholder="填表人姓名"></label>
            <table>
              <thead><tr><th>品項</th><th>單位</th><th>數量</th></tr></thead>
              <tbody>
                ${products.map((p) => {
            const qty = itemsJson[p.product_id] != null ? itemsJson[p.product_id] : "";
            return `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.unit || "")}</td><td><input type="text" inputmode="decimal" name="qty_${escapeAttr(p.product_id)}" value="${escapeAttr(String(qty))}" placeholder="0"></td></tr>`;
        }).join("")}
              </tbody>
            </table>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存盤點</button></p>
          </form>
          ${existing?.confirmed_at ? "<p class=\"notion-msg ok\">此筆已確認。</p>" : ""}
        </div>
        ` : whId ? "<p class=\"notion-msg err\">此庫房尚無品項，請先至「品項歸倉」將品項加入此庫房。</p>" : ""}
      `;
        res.type("text/html").send(notionPage("每日盤點", body, "inv-daily", res));
    });
    router.post("/inventory/daily/save", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const recordDate = (req.body.record_date || "").trim();
        const warehouseId = (req.body.warehouse_id || "").trim();
        const fillerName = (req.body.filler_name || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || !warehouseId) {
            res.redirect("/admin/inventory/daily?err=date");
            return;
        }
        const items = {};
        for (const [k, v] of Object.entries(req.body)) {
            if (k.startsWith("qty_") && v !== "" && v !== undefined) {
                const productId = k.slice(4);
                const num = parseFloat(String(v).trim());
                if (!Number.isNaN(num))
                    items[productId] = num;
                else
                    items[productId] = String(v).trim();
            }
        }
        const id = recordDate + "_" + warehouseId;
        const now = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        const itemsStr = JSON.stringify(items);
        const existing = await db.prepare("SELECT id FROM daily_inventory WHERE record_date = ? AND warehouse_id = ?").get(recordDate, warehouseId);
        if (existing) {
            await db.prepare("UPDATE daily_inventory SET filler_name = ?, recorded_at = " + now + ", items = ? WHERE id = ?").run(fillerName || "—", itemsStr, existing.id);
        }
        else {
            await db.prepare("INSERT INTO daily_inventory (id, record_date, warehouse_id, filler_name, recorded_at, items) VALUES (?, ?, ?, ?, " + now + ", ?)").run(id, recordDate, warehouseId, fillerName || "—", itemsStr);
        }
        res.redirect("/admin/inventory/daily?date=" + encodeURIComponent(recordDate) + "&warehouse_id=" + encodeURIComponent(warehouseId) + "&ok=1");
    });
    router.get("/inventory/import-erp", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}">${escapeHtml(w.name)}</option>`).join("");
        const count = req.query.count ? Number(req.query.count) : 0;
        const msg = req.query.ok ? "<p class=\"notion-msg ok\">已匯入 ERP 資料" + (count ? "，共 " + count + " 筆。" : "。") + "</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 匯入 ERP 資料</div>
        <h1 class="notion-page-title">匯入 ERP 銷貨資料</h1>
        ${msg}
        <p>上傳 CSV 或貼上內容，格式：<strong>日期,品項,銷貨數量,倉庫</strong>。日期為 YYYY-MM-DD；品項為品項 ID 或品名；倉庫為倉庫 ID 或名稱（可省略則需於下方選擇預設倉庫）。</p>
        <div class="notion-card">
          <form method="post" action="/admin/inventory/import-erp" enctype="multipart/form-data">
            <label>預設倉庫（當 CSV 未含倉庫欄時使用） <select name="default_warehouse_id">${optWh || "<option value=\"\">— 請先新增庫房 —</option>"}</select></label>
            <label>CSV 檔案 <input type="file" name="csv_file" accept=".csv,.txt"></label>
            <p>或貼上 CSV 內容：</p>
            <textarea name="csv_text" rows="10" style="width:100%;" placeholder="日期,品項,銷貨數量,倉庫"></textarea>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">匯入</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("匯入 ERP 資料", body, "inv-erp", res));
    });
    const multer = require("multer");
    const uploadMemory = multer({ storage: multer.memoryStorage() });
    router.post("/inventory/import-erp", uploadMemory.single("csv_file"), async (req, res) => {
        const body = req.body || {};
        const defaultWhId = body.default_warehouse_id ? String(body.default_warehouse_id).trim() : "";
        let raw = "";
        if (body.csv_text)
            raw = String(body.csv_text).trim();
        else if (req.file && req.file.buffer)
            raw = req.file.buffer.toString("utf-8");
        if (!raw) {
            res.redirect("/admin/inventory/import-erp?err=no_data");
            return;
        }
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses").all();
        const whById = Object.fromEntries(warehouses.map((w) => [w.id, w]));
        const whByName = Object.fromEntries(warehouses.map((w) => [w.name, w]));
        const products = await db.prepare("SELECT id, name FROM products").all();
        const productById = Object.fromEntries(products.map((p) => [p.id, p]));
        const productByName = Object.fromEntries(products.map((p) => [p.name, p]));
        const now = process.env.DATABASE_URL ? new Date().toISOString() : new Date().toISOString();
        const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        let imported = 0;
        for (let i = 0; i < lines.length; i++) {
            const cells = lines[i].split(",").map((c) => c.trim());
            if (cells.length < 3)
                continue;
            const dateStr = cells[0];
            const productKey = cells[1];
            const qty = parseFloat(cells[2]);
            const whKey = cells[3];
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || Number.isNaN(qty))
                continue;
            const product = productById[productKey] || productByName[productKey];
            const wh = (whKey && (whById[whKey] || whByName[whKey])) || (defaultWhId && whById[defaultWhId]);
            if (!product || !wh)
                continue;
            const wid = wh.id;
            const pid = product.id;
            const id = (0, id_js_1.newId)("erp");
            try {
                await db.prepare("INSERT INTO erp_sales (id, record_date, warehouse_id, product_id, qty_sold, imported_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, dateStr, wid, pid, qty, now);
                imported++;
            }
            catch (_) { /* duplicate or constraint */ }
        }
        res.redirect("/admin/inventory/import-erp?ok=1&count=" + imported);
    });
    router.get("/inventory/variance-report", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const dateFrom = (req.query.date_from || "").trim();
        const dateTo = (req.query.date_to || "").trim();
        const whId = (req.query.warehouse_id || "").trim();
        const exportCsv = req.query.export === "csv";
        let rows = [];
        let freqList = [];
        if (dateFrom && dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
            const from = new Date(dateFrom);
            const to = new Date(dateTo);
            if (from <= to) {
                const warehouseIds = whId ? [whId] : warehouses.map((w) => w.id);
                const productNames = {};
                const whNames = {};
                warehouses.forEach((w) => { whNames[w.id] = w.name; });
                const prods = await db.prepare("SELECT id, name FROM products").all();
                prods.forEach((p) => { productNames[p.id] = p.name; });
                const varianceCount = {};
                for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().slice(0, 10);
                    for (const wid of warehouseIds) {
                        const prevRec = await db.prepare("SELECT items FROM daily_inventory WHERE warehouse_id = ? AND record_date < ? ORDER BY record_date DESC LIMIT 1").get(wid, dateStr);
                        const currRec = await db.prepare("SELECT items FROM daily_inventory WHERE warehouse_id = ? AND record_date = ?").get(wid, dateStr);
                        const erpRows = await db.prepare("SELECT product_id, SUM(qty_sold) as total FROM erp_sales WHERE warehouse_id = ? AND record_date = ? GROUP BY product_id").all(wid, dateStr);
                        const erpByProduct = Object.fromEntries((erpRows || []).map((r) => [r.product_id, Number(r.total) || 0]));
                        const prevItems = prevRec && prevRec.items ? (typeof prevRec.items === "string" ? JSON.parse(prevRec.items || "{}") : prevRec.items) : {};
                        const currItems = currRec && currRec.items ? (typeof currRec.items === "string" ? JSON.parse(currRec.items || "{}") : currRec.items) : {};
                        const allProductIds = new Set([...Object.keys(prevItems), ...Object.keys(currItems), ...Object.keys(erpByProduct)]);
                        for (const pid of allProductIds) {
                            const prevQty = Number(prevItems[pid]) || 0;
                            const currQty = currItems[pid] != null ? Number(currItems[pid]) : null;
                            const erpQty = erpByProduct[pid] || 0;
                            const book = prevQty - erpQty;
                            if (currQty === null)
                                continue;
                            const variance = currQty - book;
                            if (Math.abs(variance) > 1e-6) {
                                rows.push({ date: dateStr, warehouse_id: wid, warehouse_name: whNames[wid] || wid, product_id: pid, product_name: productNames[pid] || pid, book, curr: currQty, variance });
                                varianceCount[pid] = (varianceCount[pid] || 0) + 1;
                            }
                        }
                    }
                }
                freqList = Object.entries(varianceCount).sort((a, b) => b[1] - a[1]).map(([pid, count]) => ({ product_id: pid, product_name: productNames[pid] || pid, count }));
            }
        }
        if (exportCsv && rows.length) {
            const BOM = "\uFEFF";
            const csv = BOM + "日期,倉庫,品項,帳面數量,盤點數量,盤差\n" + rows.map((r) => [r.date, r.warehouse_name, r.product_name, r.book, r.curr, r.variance].join(",")).join("\n");
            res.type("text/csv").set("Content-Disposition", "attachment; filename=variance-report.csv").send(csv);
            return;
        }
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 盤差報表</div>
        <h1 class="notion-page-title">盤差報表</h1>
        <p>依日期區間與倉庫計算盤差（盤點數量 − 帳面數量，帳面 = 前日盤點 − 當日 ERP 銷貨）。可匯出 CSV，並檢視易盤差品項統計。</p>
        <div class="notion-card">
          <form method="get" action="/admin/inventory/variance-report" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <label>日期起 <input type="date" name="date_from" value="${escapeAttr(dateFrom)}"></label>
            <label>日期訖 <input type="date" name="date_to" value="${escapeAttr(dateTo)}"></label>
            <label>倉庫 <select name="warehouse_id"><option value="">全部</option>${optWh}</select></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          ${rows.length ? `<p><a href="/admin/inventory/variance-report?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&warehouse_id=${encodeURIComponent(whId)}&export=csv" class="btn btn-primary">匯出 CSV（${rows.length} 筆）</a></p>` : ""}
          <h3>易盤差品項（區間內出現盤差次數）</h3>
          ${freqList.length ? `<table><thead><tr><th>品項</th><th>盤差次數</th></tr></thead><tbody>${freqList.map((f) => `<tr><td>${escapeHtml(f.product_name)}</td><td>${f.count}</td></tr>`).join("")}</tbody></table>` : "<p>請選擇日期區間並查詢。</p>"}
          <h3>盤差明細</h3>
          ${rows.length ? `<table><thead><tr><th>日期</th><th>倉庫</th><th>品項</th><th>帳面</th><th>盤點</th><th>盤差</th></tr></thead><tbody>${rows.slice(0, 500).map((r) => `<tr><td>${r.date}</td><td>${escapeHtml(r.warehouse_name)}</td><td>${escapeHtml(r.product_name)}</td><td>${r.book}</td><td>${r.curr}</td><td style="color:${r.variance !== 0 ? "#c00" : ""}">${r.variance}</td></tr>`).join("")}</tbody></table>${rows.length > 500 ? "<p>僅顯示前 500 筆，請用匯出 CSV 取得完整資料。</p>" : ""}` : "<p>請選擇日期區間並查詢。</p>"}
        </div>
      `;
        res.type("text/html").send(notionPage("盤差報表", body, "inv-report", res));
    });
    router.get("/inventory/manager", async (req, res) => {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("inventory_manager");
        const current = (row && row.value) || "";
        const adminUsers = (await loadAdminUsers()).filter((u) => u.status === "active");
        const managerOpts = [`<option value="">— 未指定 —</option>`, ...adminUsers.map((u) => {
                const n = (u.name || u.username || "").trim();
                return `<option value="${escapeAttr(n)}" ${n === current ? "selected" : ""}>${escapeHtml(n)}（${escapeHtml(u.title || "")}）</option>`;
            })].join("");
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存管理人。</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點作業</a> / 管理人設定</div>
        <h1 class="notion-page-title">盤點作業管理人</h1>
        ${msg}
        <div class="notion-card">
          <form method="post" action="/admin/inventory/manager">
            <label>管理人姓名 <select name="manager_name">${managerOpts}</select></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("管理人設定", body, "inv-manager", res));
    });
    router.post("/inventory/manager", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = (req.body.manager_name || "").trim();
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("inventory_manager", name);
        res.redirect("/admin/inventory/manager?ok=1");
    });
    function parseFridgeEntriesJson(entriesJson) {
        if (!entriesJson)
            return [];
        try {
            return typeof entriesJson === "string" ? JSON.parse(entriesJson) : entriesJson;
        }
        catch (_) {
            return [];
        }
    }
    // ---------- 物流工具：訂單整理 ----------
    router.get("/logistics/orders", async (req, res) => {
        const from = (req.query.from || req.query.date_from || "").toString().trim();
        const to = (req.query.to || req.query.date_to || "").toString().trim();
        const qs = new URLSearchParams();
        if (/^\d{4}-\d{2}-\d{2}$/.test(from))
            qs.set("date_from", from);
        if (/^\d{4}-\d{2}-\d{2}$/.test(to))
            qs.set("date_to", to);
        if (req.query.ok === "1")
            qs.set("ok", "log_saved");
        const qstr = qs.toString();
        res.redirect("/admin/orders" + (qstr ? "?" + qstr : ""));
    });
    router.get("/logistics/orders/new", async (_req, res) => {
        const today = getTaipeiCalendarDateYYYYMMDD();
        const body = `
        <style>
        .new-order-mobile .toolbar { display:flex; flex-wrap:wrap; align-items:flex-end; gap:12px; margin:0 0 12px; }
        .new-order-mobile .toolbar > label { margin:0; }
        .new-order-mobile .table-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .new-order-mobile #previewTable { min-width: 760px; }
        .new-order-mobile .preview-actions { margin-top:12px; display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .new-order-mobile .preview-actions .btn { margin:0; }
        @media (max-width: 720px) {
          .new-order-mobile .toolbar { flex-direction:column; align-items:stretch; gap:10px; }
          .new-order-mobile #orderCustomerPicker { min-width:0 !important; max-width:100% !important; width:100%; }
          .new-order-mobile #orderCustomerSearch { font-size:16px !important; min-height:42px; }
          .new-order-mobile input[type="date"],
          .new-order-mobile input[type="text"],
          .new-order-mobile textarea,
          .new-order-mobile input[type="file"] { width:100%; font-size:16px; }
          .new-order-mobile #rawMessage { min-height:180px; }
          .new-order-mobile #recognizeBtn,
          .new-order-mobile #fillWholesaleBtn,
          .new-order-mobile #reRecognizeBtn,
          .new-order-mobile #saveOrderBtn { width:100%; min-height:44px; }
          .new-order-mobile .preview-actions { flex-direction:column; align-items:stretch; }
        }
        </style>
        <div class="new-order-mobile">
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單查詢</a> / 新增訂單</div>
        <h1 class="notion-page-title">新增紙本訂單</h1>
        <p>貼上訂單文字（可複製 LINE 對話），系統會用<strong>與收單機器人相同的規則</strong>解析品項；規則解析不到時才會嘗試 Google AI。若需依客戶別名對照品項，請先<strong>搜尋並點選客戶</strong>。上傳照片時會先以 Cloud Vision OCR 辨識文字。</p>
        <div class="notion-card">
          <form id="newOrderForm" method="post" action="/admin/logistics/orders">
            <p class="toolbar">
              <label style="margin:0;">訂單日期 <input type="date" name="order_date" value="${escapeAttr(today)}" required></label>
              <label style="margin:0;display:flex;flex-direction:column;gap:4px;">
                <span>客戶（選填，用於品名對照）</span>
                <div id="orderCustomerPicker" style="position:relative;min-width:260px;max-width:min(360px,92vw);">
                  <input type="text" id="orderCustomerSearch" placeholder="輸入客戶名稱搜尋…" autocomplete="off" style="width:100%;padding:8px 10px;border:1px solid var(--notion-border-strong);border-radius:var(--notion-radius);font-size:14px;box-sizing:border-box;">
                  <input type="hidden" name="customer_id" id="orderCustomerId" value="">
                  <span id="orderCustomerLabel" class="notion-hint" style="display:block;margin-top:4px;font-size:12px;"></span>
                  <div id="orderCustomerDropdown" style="display:none;position:absolute;left:0;top:100%;margin-top:2px;max-height:220px;overflow:auto;border:1px solid var(--notion-border);background:var(--notion-bg);border-radius:var(--notion-radius);box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:20;width:100%;box-sizing:border-box;"></div>
                </div>
              </label>
            </p>
            <p style="margin-top:12px;"><label>原始文字（貼上紙本內容或辨識結果）</label><br>
            <textarea name="raw_message" id="rawMessage" rows="8" style="width:100%;box-sizing:border-box;" placeholder="例如：高麗菜 5 斤&#10;大陸妹 2 把&#10;芹菜 3 包"></textarea></p>
            <p>或上傳圖片：<input type="file" name="image" id="imageFile" accept="image/*"></p>
            <button type="button" id="recognizeBtn" class="btn btn-primary">解析並預覽品項</button>
            <div id="recognizeErr" style="color:#c00;margin-top:8px;display:none;"></div>
          </form>
        </div>
        <div class="notion-card" id="previewBlock" style="display:none;">
          <h2>預覽品項（可調整後再儲存）</h2>
          <p>確認下方列表無誤後，按「儲存訂單」寫入；若有待確認品名可至「待確認品名」補對照。<br>金額可手動填寫，或依「訂單日期」帶入<strong>台北果菜市場（台北一、台北二）</strong>青菜／葉菜批發行情（優先<strong>中價</strong>，無則上／下價，元/公斤）作為參考。</p>
          <p style="margin-bottom:8px;"><button type="button" id="fillWholesaleBtn" class="btn">帶入台北批發價</button> <span id="wholesaleMsg" class="notion-hint" style="display:inline;margin:0;"></span></p>
          <div class="table-scroll"><table id="previewTable"><thead><tr><th>品名</th><th>數量</th><th>單位</th><th>備註</th><th>金額（元/公斤）</th><th>對應品項</th></tr></thead><tbody></tbody></table></div>
          <input type="hidden" name="items_json" id="itemsJson" form="newOrderForm">
          <p class="preview-actions"><button type="button" id="reRecognizeBtn" class="btn">重新辨識</button> <button type="button" id="saveOrderBtn" class="btn btn-primary">儲存訂單</button> <a href="/admin/orders" class="btn">取消</a></p>
        </div>
        </div>
        <script>
        (function(){
          var form = document.getElementById('newOrderForm');
          var rawMessage = document.getElementById('rawMessage');
          var imageFile = document.getElementById('imageFile');
          var recognizeBtn = document.getElementById('recognizeBtn');
          var recognizeErr = document.getElementById('recognizeErr');
          var previewBlock = document.getElementById('previewBlock');
          var previewTable = document.getElementById('previewTable').querySelector('tbody');
          var itemsJson = document.getElementById('itemsJson');
          var saveOrderBtn = document.getElementById('saveOrderBtn');
          var reRecognizeBtn = document.getElementById('reRecognizeBtn');
          var currentItems = [];
          var custSearch = document.getElementById('orderCustomerSearch');
          var custHidden = document.getElementById('orderCustomerId');
          var custDropdown = document.getElementById('orderCustomerDropdown');
          var custLabel = document.getElementById('orderCustomerLabel');
          var custPicker = document.getElementById('orderCustomerPicker');
          var custTimer;
          function hideCustDd(){ if (custDropdown) custDropdown.style.display = 'none'; }
          function escAttr(s){ return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
          function escHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
          function showCustList(arr){
            if (!custDropdown) return;
            custDropdown.innerHTML = (arr && arr.length) ? arr.map(function(c){
              var id = c.id || '';
              var name = c.name || '';
              return '<div class="order-customer-opt" data-id="' + escAttr(id) + '" data-name="' + escAttr(name) + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--notion-border);font-size:14px;">' + escHtml(name) + '</div>';
            }).join('') : '<div class="notion-hint" style="padding:8px 12px;margin:0;">無符合客戶</div>';
            custDropdown.style.display = 'block';
          }
          function selectCustomer(id, name){
            if (custHidden) custHidden.value = id || '';
            if (custSearch) custSearch.value = name || '';
            if (custLabel) custLabel.textContent = id ? ('已選：' + (name || '')) : '';
            hideCustDd();
          }
          if (custSearch && custHidden && custDropdown && custPicker) {
            custSearch.addEventListener('input', function(){
              var q = (this.value || '').trim();
              clearTimeout(custTimer);
              if (!q) { custHidden.value = ''; if (custLabel) custLabel.textContent = ''; hideCustDd(); return; }
              custTimer = setTimeout(function(){
                fetch('/admin/api/customers-search?q=' + encodeURIComponent(q), { credentials: 'same-origin' }).then(function(r){ return r.json(); }).then(showCustList).catch(hideCustDd);
              }, 200);
            });
            custDropdown.addEventListener('click', function(e){
              var opt = e.target.closest('.order-customer-opt');
              if (opt && opt.getAttribute('data-id')) selectCustomer(opt.getAttribute('data-id'), opt.getAttribute('data-name') || '');
            });
            document.addEventListener('click', function(e){ if (custPicker && !custPicker.contains(e.target)) hideCustDd(); });
          }
          function showErr(msg){ recognizeErr.textContent = msg || ''; recognizeErr.style.display = msg ? 'block' : 'none'; }
          function renderPreview(){
            previewTable.innerHTML = currentItems.map(function(it, i){
              return '<tr><td><input type="text" value="' + (it.rawName || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="rawName" style="width:100%;max-width:180px;"></td><td><input type="number" value="' + (it.quantity ?? '') + '" data-i="' + i + '" data-f="quantity" step="any" min="0" style="width:80px;"></td><td><input type="text" value="' + (it.unit || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="unit" style="width:60px;"></td><td><input type="text" value="' + (it.remark || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="remark" placeholder="例：攪2次" style="width:120px;"></td><td><input type="text" value="' + (it.amount || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="amount" placeholder="可空白" style="width:80px;"></td><td>' + (it.productName || '待確認') + '</td></tr>';
            }).join('');
            previewTable.querySelectorAll('input').forEach(function(inp){
              inp.addEventListener('change', function(){ var i = parseInt(this.getAttribute('data-i'),10); var f = this.getAttribute('data-f'); if(currentItems[i]) currentItems[i][f] = this.value; if(f==='quantity') currentItems[i].quantity = parseFloat(this.value)||0; });
            });
            itemsJson.value = JSON.stringify(currentItems);
          }
          recognizeBtn.addEventListener('click', function(){
            showErr('');
            var text = rawMessage.value.trim();
            var file = imageFile.files[0];
            if (!text && !file) { showErr('請貼上文字或選擇一張圖片'); return; }
            recognizeBtn.disabled = true;
            recognizeBtn.textContent = '解析中…';
            var formData = new FormData();
            formData.append('raw_message', text);
            var custEl = document.getElementById('orderCustomerId');
            if (custEl && custEl.value) formData.append('customer_id', custEl.value);
            if (file) formData.append('image', file);
            fetch('/admin/api/logistics/recognize', { method: 'POST', body: formData, credentials: 'same-origin' })
              .then(function(r){
                return r.text().then(function(t){
                  try { return { ok: r.ok, data: JSON.parse(t), rawText: t }; }
                  catch (e) { return { ok: false, data: { error: '伺服器回傳非 JSON（可能未登入或逾時）。請重新整理後再試。' }, rawText: t }; }
                });
              })
              .then(function(result){
                recognizeBtn.disabled = false;
                recognizeBtn.textContent = '解析並預覽品項';
                if (!result.ok || result.data.error) { showErr(result.data.error || '解析失敗'); return; }
                if (result.data.raw_message) rawMessage.value = result.data.raw_message;
                currentItems = result.data.items || [];
                renderPreview();
                previewBlock.style.display = 'block';
              })
              .catch(function(){ recognizeBtn.disabled = false; recognizeBtn.textContent = '解析並預覽品項'; showErr('請求失敗（請檢查網路或稍後再試）'); });
          });
          saveOrderBtn.addEventListener('click', function(){
            itemsJson.value = JSON.stringify(currentItems);
            form.submit();
          });
          if (reRecognizeBtn) reRecognizeBtn.addEventListener('click', function(){
            if (recognizeBtn && !recognizeBtn.disabled)
              recognizeBtn.click();
          });
          var fillWholesaleBtn = document.getElementById('fillWholesaleBtn');
          var wholesaleMsg = document.getElementById('wholesaleMsg');
          if (fillWholesaleBtn) fillWholesaleBtn.addEventListener('click', function(){
            var orderDate = document.querySelector('#newOrderForm input[name="order_date"]');
            var date = orderDate ? orderDate.value : new Date().toISOString().slice(0, 10);
            if (!date) { wholesaleMsg.textContent = '請先選擇訂單日期'; return; }
            wholesaleMsg.textContent = '取得批發行情中…';
            fillWholesaleBtn.disabled = true;
            fetch('/admin/api/logistics/wholesale-prices?date=' + encodeURIComponent(date))
              .then(function(r){ return r.json(); })
              .then(function(data){
                fillWholesaleBtn.disabled = false;
                if (data.error) { wholesaleMsg.textContent = data.error; return; }
                var prices = data.prices || [];
                if (prices.length === 0) { wholesaleMsg.textContent = data.message || '該日尚無台北批發行情'; return; }
                var normalized = function(s){ return (s || '').toString().trim().replace(/\s+/g, ''); };
                var matched = 0;
                currentItems.forEach(function(it){
                  var name = normalized(it.rawName || it.productName || '');
                  if (!name) return;
                  var found = null;
                  for (var i = 0; i < prices.length; i++) {
                    var crop = normalized(prices[i].cropName || '');
                    if (crop === name || crop.indexOf(name) !== -1 || name.indexOf(crop) !== -1) { found = prices[i]; break; }
                  }
                  if (!found && name.length >= 2) {
                    for (var j = 0; j < prices.length; j++) {
                      if (normalized(prices[j].cropName || '').slice(0, 2) === name.slice(0, 2)) { found = prices[j]; break; }
                    }
                  }
                  if (found) {
                    var rp = found.midPrice != null ? found.midPrice : (found.highPrice != null ? found.highPrice : (found.lowPrice != null ? found.lowPrice : (found.avgPrice != null ? found.avgPrice : null)));
                    if (rp != null) { it.amount = String(rp); matched++; }
                  }
                });
                renderPreview();
                var hintExtra = (data.hint || '').trim();
                wholesaleMsg.textContent = '已帶入 ' + matched + ' 筆台北批發參考價（優先中價，元/公斤），共 ' + prices.length + ' 筆行情。' + (hintExtra ? (' ' + hintExtra) : '');
              })
              .catch(function(){
                fillWholesaleBtn.disabled = false;
                wholesaleMsg.textContent = '取得批發行情失敗，請稍後再試。';
              });
          });
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("新增紙本訂單", body, "logistics", res));
    });
    router.get("/logistics/market", async (req, res) => {
        const dateStr = (req.query.date || "").toString().trim() || new Date().toISOString().slice(0, 10);
        let prices = [];
        let msg = "";
        let snapHint = "";
        let snapSource = "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            try {
                const snap = await (0, wholesale_snapshot_js_1.loadOrFetchWholesaleMarketPrices)(db, dateStr);
                prices = snap.prices || [];
                snapHint = snap.hint || "";
                snapSource = snap.source || "";
                if (!prices.length)
                    msg = snapSource === "empty"
                        ? "該日尚無台北果菜市場行情，且本地無快照。"
                        : "該日無符合「青菜／葉菜」篩選之資料。";
            }
            catch (e) {
                msg = "讀取行情失敗，請稍後再試。";
            }
        }
        else {
            msg = "日期格式錯誤，請使用 YYYY-MM-DD。";
        }
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_price_prefix_rules");
        const rulesText = row?.value || JSON.stringify({ "*": 2, LM: 10 }, null, 2);
        const rows = prices.slice(0, 300).map((p) => `<tr><td>${escapeHtml(p.marketName || "")}</td><td>${escapeHtml(p.category || "")}</td><td>${escapeHtml(p.cropName || "")}</td><td>${p.highPrice ?? "—"}</td><td>${p.midPrice ?? "—"}</td><td>${p.lowPrice ?? "—"}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 物流工具 / 北農行情</div>
        <h1 class="notion-page-title">北農行情（台北一、台北二）— 青菜／葉菜</h1>
        <p class="notion-hint">僅顯示作物種類為青菜／葉菜／包葉等；欄位為<strong>上／中／下價</strong>（元／公斤）。API 有資料時會自動寫入本地每日快照。與<a href="${wholesale_price_js_1.TAPMC_PRICE_URL}" target="_blank" rel="noopener">臺北農產運銷「單日交易行情查詢」</a>為同一市場；若需與官網逐筆核對請至該頁下載檔案。</p>
        ${snapSource === "snapshot" && prices.length ? `<p class="notion-msg warn">本日資料來自<strong>本地快照</strong>（農業部 API 暫無該日資料）。</p>` : ""}
        ${snapHint ? `<p class="notion-hint">${escapeHtml(snapHint)}</p>` : ""}
        ${req.query.ok === "1" ? '<p class="notion-msg ok">已儲存加價規則。</p>' : ""}
        ${req.query.err === "rules" ? '<p class="notion-msg err">規則格式錯誤，請輸入 JSON 物件。</p>' : ""}
        <form method="get" action="/admin/logistics/market" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <label>日期 <input type="date" name="date" value="${escapeAttr(dateStr)}"></label>
          <button type="submit" class="btn">查詢</button>
        </form>
        ${msg ? `<p class="notion-msg warn">${escapeHtml(msg)}</p>` : ""}
        <div class="notion-card">
          <table><thead><tr><th>市場</th><th>種類</th><th>作物</th><th>上價</th><th>中價</th><th>下價</th></tr></thead><tbody>${rows || "<tr><td colspan='6'>無資料</td></tr>"}</tbody></table>
        </div>
        <div class="notion-card" style="margin-top:16px;">
          <h2 style="margin-top:0;">LINE 報價加價規則</h2>
          <p class="notion-hint">格式為 JSON，key 為 ERP 料號前綴、value 為加價。<code>*</code> 代表預設。例：<code>{"*":2,"LM":10}</code>。</p>
          <form method="post" action="/admin/logistics/market/rules">
            <textarea name="rules_json" rows="8" style="width:100%;box-sizing:border-box;">${escapeHtml(rulesText)}</textarea>
            <p style="margin-top:8px;"><button type="submit" class="btn btn-primary">儲存規則</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("北農行情", body, "logistics-market", res));
    });
    router.post("/logistics/market/rules", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const txt = String(req.body?.rules_json || "").trim();
        try {
            const j = JSON.parse(txt || "{}");
            if (!j || typeof j !== "object")
                throw new Error("規則必須是 JSON 物件");
            const normalized = {};
            for (const [k, v] of Object.entries(j)) {
                const n = Number(v);
                if (!Number.isFinite(n))
                    continue;
                normalized[String(k).toUpperCase()] = n;
            }
            if (normalized["*"] == null)
                normalized["*"] = 2;
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_price_prefix_rules", JSON.stringify(normalized));
            res.redirect("/admin/logistics/market?ok=1");
        }
        catch (_e) {
            res.redirect("/admin/logistics/market?err=rules");
        }
    });
    /** 將已解析列寫入訂單（先刪除既有品項）。 */
    async function replaceOrderItemsFromParsedRows(orderId, customerId, parsed) {
        await (0, rebuild_order_from_sources_js_1.replaceOrderItemsFromParsedRows)(db, orderId, customerId, parsed);
    }
    /** 依全文解析並重建訂單明細（先刪除既有品項）。rawText 須為非空字串。 */
    async function rebuildOrderItemsFromRawText(orderId, customerId, rawText) {
        const rawTrim = String(rawText || "").trim();
        if (!rawTrim)
            return { ok: false, error: "empty" };
        return (0, rebuild_order_from_sources_js_1.rebuildOrderItemsFromOrderSources)(db, orderId, customerId, rawTrim, []);
    }
    /**
     * 後台「重新辨識」：文字略過僅含「[圖片]」的行後再解析，並對 order_attachments 逐張向 LINE 取圖，
     * 與 webhook 相同流程（OCR → 規則 → Gemini 文字 → Gemini 視覺）。
     */
    async function rebuildOrderItemsForReRecognize(orderId, customerId, rawMessage, attachmentRows) {
        const result = await (0, rebuild_order_from_sources_js_1.rebuildOrderItemsFromOrderSources)(db, orderId, customerId, rawMessage, attachmentRows);
        if (result.ok)
            return { ok: true };
        return { ok: false, error: result.error || "parse" };
    }
    router.post("/api/logistics/recognize", uploadImageSafe, async (req, res) => {
        try {
            let rawText = (req.body && req.body.raw_message) ? String(req.body.raw_message).trim() : "";
            const customerId = (req.body && req.body.customer_id) ? String(req.body.customer_id).trim() || null : null;
            const file = req.file;
            let fallbackUnit = "公斤";
            let geminiHintOpts = undefined;
            let geminiImageOpts = undefined;
            if (customerId) {
                try {
                    const custRow = await db.prepare("SELECT default_unit, known_sub_customers FROM customers WHERE id = ?").get(customerId);
                    fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                    const knownSub = custRow?.known_sub_customers != null ? String(custRow.known_sub_customers).trim() : "";
                    let hw = "";
                    try {
                        hw = (await customer_handwriting_hints_js_1.buildPromptSuffixForCustomerHandwritingHints(db, customerId)) || "";
                    }
                    catch (_) { }
                    geminiHintOpts = {
                        ...(hw ? { extraPromptSuffix: hw } : {}),
                        ...(knownSub ? { knownSubCustomers: knownSub } : {}),
                    };
                    if (Object.keys(geminiHintOpts).length === 0)
                        geminiHintOpts = undefined;
                    geminiImageOpts = {
                        ...(hw ? { extraPromptSuffix: hw } : {}),
                        ...(knownSub ? { knownSubCustomers: knownSub } : {}),
                        db,
                        customerId,
                    };
                }
                catch (_) { }
            }
            if (file && file.buffer) {
                const visionKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
                if (visionKey && visionKey.trim()) {
                    const ocrText = await (0, vision_ocr_js_1.getTextFromImageBuffer)(file.buffer);
                    if (ocrText)
                        rawText = (rawText ? rawText + "\n" : "") + ocrText;
                }
            }
            const detectedTpl = (0, order_form_templates_js_1.detectOrderFormTemplate)(rawText);
            const normalizedRawText = detectedTpl
                ? (0, order_form_templates_js_1.preprocessOcrTextByTemplate)(rawText, detectedTpl)
                : rawText;
                if (!rawText || !rawText.trim()) {
                if (file?.buffer?.length && (0, gemini_order_helpers_js_1.getGeminiApiKey)()) {
                    const visRaw = await (0, gemini_order_helpers_js_1.parseOrderWithGeminiImage)(file.buffer, geminiImageOpts);
                    const vis = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)((visRaw || []).map((p) => ({ rawName: p.rawName, quantity: p.quantity, unit: p.unit || null, remark: p.remark ?? null, amount: p.amount ?? null, subCustomer: p.subCustomer ?? null })));
                    if (vis && vis.length) {
                        const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
                        const items = [];
                        for (const p of vis) {
                            try {
                                const resolved = await (0, resolve_product_js_1.resolveProductName)(db, p.rawName, customerId);
                                const inputUnit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(p.unit, fallbackUnit);
                                let qty = Number.isFinite(Number(p.quantity)) ? Number(p.quantity) : 0;
                                let unit = inputUnit;
                                let remark = p.remark != null && String(p.remark).trim() !== "" ? String(p.remark).trim() : null;
                                if (resolved) {
                                    const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
                                    qty = Number(c.quantity);
                                    unit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(c.unit || fallbackUnit, fallbackUnit);
                                    if (c.remark)
                                        remark = remark ? (remark + "；" + c.remark) : c.remark;
                                }
                                remark = (0, unit_conversion_js_1.withOriginCallRemark)(remark, p.quantity, inputUnit, unit);
                                items.push({
                                    rawName: p.rawName,
                                    quantity: qty,
                                    unit: unit || null,
                                    remark,
                                    amount: p.amount ?? null,
                                    subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                                    productId: resolved?.productId ?? null,
                                    productName: resolved?.productId ? (resolved.productName || null) : null,
                                    needReview: resolved ? 0 : 1,
                                });
                            }
                            catch (itemErr) {
                                console.error("[admin] logistics recognize item (vision)", itemErr?.message || itemErr);
                                items.push({
                                    rawName: p.rawName,
                                    quantity: p.quantity,
                                    unit: p.unit || null,
                                    remark: p.remark || null,
                                    amount: p.amount ?? null,
                                    subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                                    productId: null,
                                    productName: null,
                                    needReview: 1,
                                });
                            }
                        }
                        res.json({ raw_message: "[圖片]", items });
                        return;
                    }
                }
                res.status(400).json({ error: "無法取得內容（請貼上文字，或上傳圖片並設定 GOOGLE_CLOUD_VISION_API_KEY／GOOGLE_GEMINI_API_KEY）。" });
                return;
            }
            const ruleBased = await (0, parse_order_message_js_1.parseOrderMessage)(normalizedRawText, fallbackUnit, geminiHintOpts);
            let parsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(ruleBased.map((p) => ({ rawName: p.rawName, quantity: p.quantity, unit: p.unit || null, remark: p.remark || null, amount: null, subCustomer: p.subCustomer ?? null })));
            if (!parsed.length && file?.buffer?.length && (0, gemini_order_helpers_js_1.getGeminiApiKey)()) {
                const vis = await (0, gemini_order_helpers_js_1.parseOrderWithGeminiImage)(file.buffer, geminiImageOpts);
                if (vis && vis.length) {
                    parsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(vis.map((p) => ({ rawName: p.rawName, quantity: p.quantity, unit: p.unit || null, remark: p.remark ?? null, amount: p.amount ?? null, subCustomer: p.subCustomer ?? null })));
                }
            }
            const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
            const items = [];
            for (const p of parsed) {
                try {
                    const resolved = await (0, resolve_product_js_1.resolveProductName)(db, p.rawName, customerId);
                    const inputUnit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(p.unit, fallbackUnit);
                    let qty = Number.isFinite(Number(p.quantity)) ? Number(p.quantity) : 0;
                    let unit = inputUnit;
                    let remark = p.remark != null && String(p.remark).trim() !== "" ? String(p.remark).trim() : null;
                    if (resolved) {
                        const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
                        qty = Number(c.quantity);
                        unit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(c.unit || fallbackUnit, fallbackUnit);
                        if (c.remark) {
                            remark = remark ? (remark + "；" + c.remark) : c.remark;
                        }
                    }
                    remark = (0, unit_conversion_js_1.withOriginCallRemark)(remark, p.quantity, inputUnit, unit);
                    items.push({
                        rawName: p.rawName,
                        quantity: qty,
                        unit: unit || null,
                        remark,
                        amount: p.amount ?? null,
                        subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                        productId: resolved?.productId ?? null,
                        productName: resolved?.productId ? (resolved.productName || null) : null,
                        needReview: resolved ? 0 : 1,
                    });
                }
                catch (itemErr) {
                    console.error("[admin] logistics recognize item", itemErr?.message || itemErr);
                    items.push({
                        rawName: p.rawName,
                        quantity: p.quantity,
                        unit: p.unit || null,
                        remark: p.remark || null,
                        amount: p.amount ?? null,
                        subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                        productId: null,
                        productName: null,
                        needReview: 1,
                    });
                }
            }
            res.json({ raw_message: normalizedRawText || rawText, items });
        }
        catch (e) {
            console.error("[admin] /api/logistics/recognize", e?.message || e, e?.stack);
            if (!res.headersSent)
                res.status(500).json({ error: "解析失敗：" + String(e?.message || e).slice(0, 400) });
        }
    });
    router.get("/api/logistics/wholesale-prices", async (req, res) => {
        const dateStr = (req.query.date || "").toString().trim() || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            res.status(400).json({ error: "請提供有效日期參數 date（YYYY-MM-DD）。" });
            return;
        }
        try {
            const snap = await (0, wholesale_snapshot_js_1.loadOrFetchWholesaleMarketPrices)(db, dateStr);
            const prices = snap.prices || [];
            if (!prices.length) {
                const emptyMsg = snap.source === "empty"
                    ? "該日尚無台北果菜市場批發行情，且本地無快照；可能為休市或資料尚未更新。"
                    : "該日無青菜／葉菜篩選結果。";
                res.json({ prices: [], message: emptyMsg, hint: snap.hint || "", source: snap.source });
                return;
            }
            res.json({
                prices,
                hint: snap.hint || "",
                source: snap.source,
            });
        }
        catch (e) {
            console.error("[admin] 批發行情取得失敗:", e?.message || e);
            res.status(500).json({ error: "無法取得批發行情，請稍後再試。" });
        }
    });
    router.post("/logistics/orders", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const orderDate = (req.body.order_date || "").trim();
        const rawMessage = (req.body.raw_message || "").trim();
        const customerIdPost = (req.body.customer_id || "").trim() || null;
        let items = [];
        try {
            const j = req.body.items_json;
            if (j)
                items = JSON.parse(j);
        }
        catch (_) { }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
            res.redirect("/admin/logistics/orders/new?err=date");
            return;
        }
        const orderId = (0, id_js_1.newId)("log");
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare("INSERT INTO logistics_orders (id, order_date, customer_id, raw_message, created_at) VALUES (?, ?, ?, ?, " + nowSql + ")").run(orderId, orderDate, customerIdPost, rawMessage);
        for (const it of items) {
            const itemId = (0, id_js_1.newId)("logitem");
            const qty = parseFloat(it.quantity);
            const needReview = it.needReview === 1 || it.needReview === true ? 1 : 0;
            const amountVal = it.amount != null && String(it.amount).trim() !== "" ? String(it.amount).trim() : null;
            const remarkVal = it.remark != null && String(it.remark).trim() !== "" ? String(it.remark).trim() : null;
            await db.prepare("INSERT INTO logistics_order_items (id, order_id, product_id, raw_name, quantity, unit, remark, amount, need_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(itemId, orderId, it.productId || null, it.rawName || "", Number.isFinite(qty) ? qty : 0, it.unit || null, remarkVal, amountVal, needReview);
        }
        res.redirect("/admin/orders?date_from=" + encodeURIComponent(orderDate) + "&date_to=" + encodeURIComponent(orderDate) + "&ok=log_saved");
    });
    router.get("/logistics/orders/:id", async (req, res) => {
        const order = await db.prepare(`
      SELECT o.id, o.order_date, o.raw_message, o.memo, o.customer_id, c.name AS customer_name
      FROM logistics_orders o LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `).get(req.params.id);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.id, oi.raw_name, oi.quantity, oi.unit, oi.remark, oi.amount, oi.need_review, p.name AS product_name
      FROM logistics_order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
    `).all(order.id);
        const rows = items.map((i) => `<tr><td>${escapeHtml(i.raw_name ?? "")}</td><td>${i.quantity}</td><td>${escapeHtml((i.unit || "") + (i.need_review === 1 ? " [待確認]" : ""))}</td><td>${escapeHtml(i.remark ?? "—")}</td><td>${escapeHtml(i.amount ?? "—")}</td><td>${escapeHtml(i.product_name || "—")}</td></tr>`).join("");
        const custLine = order.customer_name ? `　客戶：${escapeHtml(order.customer_name)}` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/logistics/orders">訂單整理</a> / 明細</div>
        <h1 class="notion-page-title">紙本訂單明細</h1>
        <p>日期：${escapeHtml(order.order_date)}${custLine}　<a href="/admin/logistics/orders">← 回列表</a></p>
        <div class="notion-card raw-message-scroll"><h3 style="margin-top:0;">原始訂單</h3><pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);margin:0;font-size:13px;max-height:240px;overflow:auto;">${escapeHtml(order.raw_message || "")}</pre></div>
        <div class="notion-card">
          <table><thead><tr><th>品名</th><th>數量</th><th>單位</th><th>備註</th><th>金額（元/公斤）</th><th>對應品項</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
      `;
        res.type("text/html").send(notionPage("訂單明細", body, "logistics", res));
    });
    router.get("/logistics/procurement", async (req, res) => {
        const dateFrom = req.query.from?.trim() || new Date().toISOString().slice(0, 10);
        const dateTo = req.query.to?.trim() || dateFrom;
        const rows = await db.prepare(`
      SELECT oi.raw_name, oi.unit, oi.product_id, p.name AS product_name, SUM(oi.quantity) AS total_qty
      FROM logistics_order_items oi
      LEFT JOIN logistics_orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.order_date >= ? AND o.order_date <= ?
      GROUP BY oi.product_id, oi.raw_name, oi.unit, p.name
      ORDER BY p.name, oi.raw_name, oi.unit
    `).all(dateFrom, dateTo);
        const tableRows = rows.length === 0
            ? "<tr><td colspan='4'>此區間無資料</td></tr>"
            : rows.map((r) => `<tr><td>${escapeHtml(r.product_name || r.raw_name || "待確認")}</td><td>${Number(r.total_qty)}</td><td>${escapeHtml(r.unit || "—")}</td><td>${escapeHtml(r.raw_name && !r.product_name ? "待對照" : "—")}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 物流工具 / 採購分析</div>
        <h1 class="notion-page-title">採購分析</h1>
        <p>依日期區間彙總「訂單整理」內紙本訂單，某日某品項需採購數量（供採購人員使用）。</p>
        <div class="notion-card">
          <form method="get" action="/admin/logistics/procurement" style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:12px;">
            <label>日期區間 <input type="date" name="from" value="${escapeAttr(dateFrom)}"> ～ <input type="date" name="to" value="${escapeAttr(dateTo)}"></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          <table>
            <thead><tr><th>品項</th><th>合計數量</th><th>單位</th><th>備註</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("採購分析", body, "logistics-procurement", res));
    });
    // ---------- 環境衛生管理 ----------
    router.get("/freezer-fridge", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name").all();
        const month = req.query.month?.trim() || new Date().toISOString().slice(0, 7);
        const [y, m] = month.split("-").map(Number);
        const nextMonthFirst = m === 12 ? (y + 1) + "-01-01" : y + "-" + String(m + 1).padStart(2, "0") + "-01";
        const records = await db.prepare("SELECT date, filler_name, confirmed_at, anomaly FROM freezer_fridge_daily WHERE date >= ? AND date < ? ORDER BY date").all(month + "-01", nextMonthFirst);
        const recordByDate = {};
        records.forEach((r) => { recordByDate[r.date] = r; });
        const firstDay = new Date(y, m - 1, 1);
        const daysInMonth = new Date(y, m, 0).getDate();
        const calRows = [];
        let week = [];
        const startPad = firstDay.getDay();
        for (let i = 0; i < startPad; i++)
            week.push("");
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = month + "-" + String(d).padStart(2, "0");
            const rec = recordByDate[dateStr];
            week.push(rec ? `<a href="/admin/freezer-fridge/daily?date=${dateStr}" class="cal-day filled">${d}</a>` : `<a href="/admin/freezer-fridge/daily?date=${dateStr}" class="cal-day">${d}</a>`);
            if (week.length === 7) {
                calRows.push(week);
                week = [];
            }
        }
        if (week.length)
            calRows.push(week);
        const calHtml = "<table class=\"freezer-cal\"><thead><tr><th>日</th><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th></tr></thead><tbody>" + calRows.map((row) => "<tr>" + row.map((cell) => "<td>" + (cell || "") + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 環境衛生管理 / 冷凍庫冷藏庫檢查表</div>
        <h1 class="notion-page-title">冷凍庫冷藏庫檢查表</h1>
        <p class="notion-hint" style="margin-bottom:16px;">每日填寫各庫房溫度、電源、電燈、電熱；請先至「庫房管理」新增庫房。</p>
        <p style="margin-bottom:16px;"><a href="/admin/freezer-fridge/warehouses" class="btn">庫房管理</a>（共 ${warehouses.length} 個庫房）</p>
        <div class="notion-card">
          <h2>${month} 月曆</h2>
          <form method="get" action="/admin/freezer-fridge" style="margin-bottom:12px;">
            <input type="month" name="month" value="${escapeAttr(month)}"> <button type="submit" class="btn">切換月份</button>
          </form>
          ${calHtml}
          <p class="notion-hint" style="margin-top:12px;">點選日期填寫當日檢查表。</p>
        </div>
        <div class="notion-card">
          <h2>當月填表紀錄</h2>
          ${records.length ? "<table><thead><tr><th>日期</th><th>填表人</th><th>狀態</th><th>操作</th></tr></thead><tbody>" + records.map((r) => `<tr><td>${r.date}</td><td>${escapeHtml(r.filler_name || "")}</td><td>${r.confirmed_at ? "已確認" : "已填"}${r.anomaly ? "、異常" : ""}</td><td><a href="/admin/freezer-fridge/daily?date=${r.date}">編輯</a></td></tr>`).join("") + "</tbody></table>" : "<p>本月尚無填表紀錄</p>"}
        </div>
      `;
        res.type("text/html").send(notionPage("冷凍庫冷藏庫檢查表", body + "\n<style>.freezer-cal td,.freezer-cal th{border:1px solid var(--notion-border);padding:8px;min-width:40px;}.freezer-cal .cal-day{display:block;text-align:center;text-decoration:none;color:var(--notion-accent);}.freezer-cal .cal-day.filled{font-weight:600;}</style>", "env", res));
    });
    router.get("/freezer-fridge/warehouses", async (req, res) => {
        const rows = await db.prepare("SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name").all();
        const msg = req.query.ok ? "<p class=\"notion-msg ok\">已儲存。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / 庫房管理</div>
        <h1 class="notion-page-title">冷凍／冷藏庫房設定</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/freezer-fridge/warehouses/new" class="btn btn-primary">＋ 新增庫房</a></p>
        <div class="notion-card">
          <table>
            <thead><tr><th>順序</th><th>庫房名稱</th><th>合規溫度</th><th>電源</th><th>電燈</th><th>電熱</th><th>操作</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => `<tr><td>${r.sort_order}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.compliant_temp || "")}</td><td>${r.power_compliant}</td><td>${r.light_compliant}</td><td>${r.heat_compliant}</td><td><a href="/admin/freezer-fridge/warehouses/${encodeURIComponent(r.id)}/edit">編輯</a> | <a href="/admin/freezer-fridge/warehouses/${encodeURIComponent(r.id)}/delete">刪除</a></td></tr>`).join("") : "<tr><td colspan=\"7\">尚無庫房</td></tr>"}
            </tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("冷凍冷藏庫房管理", body, "env", res));
    });
    router.get("/freezer-fridge/warehouses/new", async (_req, res) => {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / <a href="/admin/freezer-fridge/warehouses">庫房管理</a> / 新增</div>
        <h1 class="notion-page-title">新增庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/freezer-fridge/warehouses/new">
            <label>庫房名稱 <input type="text" name="name" required placeholder="例：9號冷凍庫"></label>
            <label>合規溫度 <input type="text" name="compliant_temp" placeholder="例：−18°C 以下 或 2~7"></label>
            <label>電源合規 <select name="power_compliant"><option value="on">正常為開</option><option value="off">正常為關</option></select></label>
            <label>電燈合規 <select name="light_compliant"><option value="off">應關閉</option><option value="on">應開啟</option></select></label>
            <label>電熱合規 <select name="heat_compliant"><option value="off">符合為關</option><option value="on">符合為開</option></select></label>
            <label>順序 <input type="number" name="sort_order" value="0"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button> <a href="/admin/freezer-fridge/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增庫房", body, "env", res));
    });
    router.post("/freezer-fridge/warehouses/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = (req.body.name || "").trim();
        const compliantTemp = (req.body.compliant_temp || "").trim();
        const powerCompliant = (req.body.power_compliant || "on").trim();
        const lightCompliant = (req.body.light_compliant || "off").trim();
        const heatCompliant = (req.body.heat_compliant || "off").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        if (!name) {
            res.redirect("/admin/freezer-fridge/warehouses/new?err=name");
            return;
        }
        const id = (0, id_js_1.newId)("ffwh");
        await db.prepare("INSERT INTO freezer_fridge_warehouses (id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, name, sortOrder, compliantTemp, powerCompliant, lightCompliant, heatCompliant);
        res.redirect("/admin/freezer-fridge/warehouses?ok=1");
    });
    router.get("/freezer-fridge/warehouses/:id/edit", async (req, res) => {
        const row = await db.prepare("SELECT * FROM freezer_fridge_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/freezer-fridge/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / <a href="/admin/freezer-fridge/warehouses">庫房管理</a> / 編輯</div>
        <h1 class="notion-page-title">編輯庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/freezer-fridge/warehouses/${encodeURIComponent(row.id)}/edit">
            <label>庫房名稱 <input type="text" name="name" value="${escapeAttr(row.name)}" required></label>
            <label>合規溫度 <input type="text" name="compliant_temp" value="${escapeAttr(row.compliant_temp || "")}"></label>
            <label>電源合規 <select name="power_compliant"><option value="on" ${row.power_compliant === "on" ? "selected" : ""}>正常為開</option><option value="off" ${row.power_compliant === "off" ? "selected" : ""}>正常為關</option></select></label>
            <label>電燈合規 <select name="light_compliant"><option value="off" ${row.light_compliant === "off" ? "selected" : ""}>應關閉</option><option value="on" ${row.light_compliant === "on" ? "selected" : ""}>應開啟</option></select></label>
            <label>電熱合規 <select name="heat_compliant"><option value="off" ${row.heat_compliant === "off" ? "selected" : ""}>符合為關</option><option value="on" ${row.heat_compliant === "on" ? "selected" : ""}>符合為開</option></select></label>
            <label>順序 <input type="number" name="sort_order" value="${row.sort_order}"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/freezer-fridge/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("編輯庫房", body, "env", res));
    });
    router.post("/freezer-fridge/warehouses/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const name = (req.body.name || "").trim();
        const compliantTemp = (req.body.compliant_temp || "").trim();
        const powerCompliant = (req.body.power_compliant || "on").trim();
        const lightCompliant = (req.body.light_compliant || "off").trim();
        const heatCompliant = (req.body.heat_compliant || "off").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        const row = await db.prepare("SELECT id FROM freezer_fridge_warehouses WHERE id = ?").get(id);
        if (!row || !name) {
            res.redirect("/admin/freezer-fridge/warehouses?err=name");
            return;
        }
        await db.prepare("UPDATE freezer_fridge_warehouses SET name = ?, sort_order = ?, compliant_temp = ?, power_compliant = ?, light_compliant = ?, heat_compliant = ? WHERE id = ?").run(name, sortOrder, compliantTemp, powerCompliant, lightCompliant, heatCompliant, id);
        res.redirect("/admin/freezer-fridge/warehouses?ok=1");
    });
    router.get("/freezer-fridge/warehouses/:id/delete", async (req, res) => {
        const row = await db.prepare("SELECT id, name FROM freezer_fridge_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/freezer-fridge/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / <a href="/admin/freezer-fridge/warehouses">庫房管理</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除</h1>
        <div class="notion-card"><p>確定要刪除「${escapeHtml(row.name)}」？<br><form method="post" action="/admin/freezer-fridge/warehouses/${encodeURIComponent(row.id)}/delete" style="display:inline;margin-top:12px;"><button type="submit" class="btn">確定刪除</button></form> <a href="/admin/freezer-fridge/warehouses" class="btn">取消</a></p></div>
      `;
        res.type("text/html").send(notionPage("確認刪除", body, "env", res));
    });
    router.post("/freezer-fridge/warehouses/:id/delete", async (req, res) => {
        await db.prepare("DELETE FROM freezer_fridge_warehouses WHERE id = ?").run(req.params.id);
        res.redirect("/admin/freezer-fridge/warehouses?ok=del");
    });
    router.get("/freezer-fridge/daily", async (req, res) => {
        const date = req.query.date?.trim() || new Date().toISOString().slice(0, 10);
        const warehouses = await db.prepare("SELECT id, name, sort_order, compliant_temp, power_compliant, light_compliant, heat_compliant FROM freezer_fridge_warehouses ORDER BY sort_order, name").all();
        const row = await db.prepare("SELECT * FROM freezer_fridge_daily WHERE date = ?").get(date);
        const entries = row ? parseFridgeEntriesJson(row.entries_json) : [];
        const entryByWh = {};
        entries.forEach((e) => { entryByWh[e.warehouseId] = e; });
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/freezer-fridge">冷凍庫冷藏庫檢查表</a> / 每日填報</div>
        <h1 class="notion-page-title">${date} 冷凍冷藏庫房檢查</h1>
        ${warehouses.length === 0 ? "<p class=\"notion-msg err\">請先至庫房管理新增庫房。</p>" : `
        <div class="notion-card">
          <form method="post" action="/admin/freezer-fridge/daily/save">
            <input type="hidden" name="date" value="${escapeAttr(date)}">
            <label>填表人 <input type="text" name="filler_name" value="${escapeAttr(row?.filler_name || "")}"></label>
            <table>
              <thead><tr><th>庫房</th><th>合規溫度</th><th>溫度</th><th>電源</th><th>電燈</th><th>電熱</th></tr></thead>
              <tbody>
                ${warehouses.map((w) => {
            const e = entryByWh[w.id] || { warehouseId: w.id, temp: "", powerOk: true, lightOff: true, heatOk: true };
            return `<tr>
              <td>${escapeHtml(w.name)}</td>
              <td>${escapeHtml(w.compliant_temp || "")}</td>
              <td><input type="text" name="temp_${escapeAttr(w.id)}" value="${escapeAttr(e.temp || "")}" placeholder="例：-18"></td>
              <td><select name="power_${escapeAttr(w.id)}"><option value="ok" ${e.powerOk ? "selected" : ""}>正常</option><option value="ng" ${!e.powerOk ? "selected" : ""}>異常</option></select></td>
              <td><select name="light_${escapeAttr(w.id)}"><option value="off" ${e.lightOff ? "selected" : ""}>關閉</option><option value="on" ${!e.lightOff ? "selected" : ""}>開啟</option></select></td>
              <td><select name="heat_${escapeAttr(w.id)}"><option value="ok" ${e.heatOk ? "selected" : ""}>符合</option><option value="ng" ${!e.heatOk ? "selected" : ""}>不符合</option></select></td>
            </tr>`;
        }).join("")}
              </tbody>
            </table>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/freezer-fridge?month=${encodeURIComponent(date.slice(0, 7))}" class="btn">返回月曆</a></p>
          </form>
        </div>
        `}
      `;
        res.type("text/html").send(notionPage(date + " 檢查表", body, "env", res));
    });
    router.post("/freezer-fridge/daily/save", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const date = (req.body.date || "").trim();
        const fillerName = (req.body.filler_name || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.redirect("/admin/freezer-fridge/daily?date=" + encodeURIComponent(date || new Date().toISOString().slice(0, 10)) + "&err=date");
            return;
        }
        const warehouses = await db.prepare("SELECT id FROM freezer_fridge_warehouses").all();
        const entries = warehouses.map((w) => {
            const temp = (req.body["temp_" + w.id] || "").trim();
            const power = req.body["power_" + w.id];
            const light = req.body["light_" + w.id];
            const heat = req.body["heat_" + w.id];
            return {
                warehouseId: w.id,
                temp,
                powerOk: power === "ok",
                lightOff: light === "off",
                heatOk: heat === "ok",
            };
        });
        const entriesJson = JSON.stringify(entries);
        const existing = await db.prepare("SELECT date FROM freezer_fridge_daily WHERE date = ?").get(date);
        if (existing) {
            await db.prepare("UPDATE freezer_fridge_daily SET entries_json = ?, filler_name = ? WHERE date = ?").run(entriesJson, fillerName || "—", date);
        }
        else {
            await db.prepare("INSERT INTO freezer_fridge_daily (date, entries_json, filler_name) VALUES (?, ?, ?)").run(date, entriesJson, fillerName || "—");
        }
        res.redirect("/admin/freezer-fridge/daily?date=" + encodeURIComponent(date) + "&ok=1");
    });
    router.get("/api/binding-status", async (_req, res) => {
        try {
            const all = await db.prepare("SELECT id, line_group_id, active FROM customers").all();
            const withLineId = all.filter((c) => (c.line_group_id || "").trim() !== "");
            const active = all.filter((c) => c.active === 1 || c.active === null || c.active === undefined);
            res.json({
                ok: true,
                database: process.env.DATABASE_URL ? "PostgreSQL" : "SQLite",
                totalCustomers: all.length,
                customersWithLineGroupId: withLineId.length,
                activeCustomers: active.length,
            });
        }
        catch (e) {
            res.status(500).json({ ok: false, err: (e.message || String(e)).slice(0, 100) });
        }
    });
    router.get("/line-binding", async (req, res) => {
        const dbType = process.env.DATABASE_URL ? "PostgreSQL (Cloud SQL)" : "SQLite";
        const currentHost = req.get("host") || "";
        const customers = await db.prepare("SELECT id, name, line_group_id, active FROM customers ORDER BY name").all();
        const rows = customers.map((c) => {
            const bound = c.line_group_id && String(c.line_group_id).trim() ? "是" : "否";
            const gid = (c.line_group_id && String(c.line_group_id).trim()) ? escapeHtml(String(c.line_group_id).trim()) : "—";
            const status = c.active === 1 ? "啟用" : "停用";
            return `<tr><td>${escapeHtml(c.name)}</td><td><code style="font-size:12px;word-break:break-all;">${gid}</code></td><td>${bound}</td><td>${status}</td><td><a href="/admin/customers/${encodeURIComponent(c.id)}/edit">編輯</a></td></tr>`;
        });
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / LINE 綁定檢查</div>
        <h1 class="notion-page-title">LINE 綁定檢查</h1>
        <div class="notion-card" style="border-left:4px solid #e03;background:var(--notion-sidebar);">
          <h2 style="margin-top:0;">⚠️ 仍顯示「尚未綁定」請先確認</h2>
          <p><strong>收單機器人只會讀取「與本頁相同網址」的後台資料。</strong>若您是在<strong>本機 (localhost)</strong>或其它網址開後台、編輯客戶並填了 LINE 群組 ID，那份資料<strong>不會</strong>被 Cloud Run 上的收單用到。</p>
          <p>請務必：用瀏覽器打開<strong>與本頁相同的網址</strong>（例如 <code>https://您的服務.run.app/admin</code>），到「客戶管理」→ 點該客戶「編輯」→ 在「LINE 群組 ID」貼上群組內傳「取得群組ID」後機器人回傳的那串 → 儲存。下方表格即為<strong>本服務目前</strong>的綁定狀態。</p>
        </div>
        <div class="notion-card" style="border-left:4px solid #0a0;">
          <h2>可觸發收單的關鍵字</h2>
          <p><strong>開始收單</strong>（任一句即可，可同則帶品項，例：收單 高麗菜 5 斤）：</p>
          <ul style="margin:4px 0 12px;padding-left:20px;">
            <li>收單</li>
            <li>開始收單</li>
            <li>訂單</li>
            <li>我要下訂</li>
            <li>明日訂單</li>
          </ul>
          <p><strong>結束收單</strong>：</p>
          <ul style="margin:4px 0 0;padding-left:20px;">
            <li>完成</li>
            <li>結束收單</li>
            <li>以上X收單（X 為數字，例：以上5收單）</li>
          </ul>
          <p class="notion-hint" style="margin-top:12px;">收單結束時機器人會回覆：訂單日期、星期、共收幾項（不列出品項明細）。</p>
        </div>
        <div class="notion-card">
          <h2>如何綁定</h2>
          <ol style="margin:0 0 12px;padding-left:20px;">
            <li>在 LINE <strong>群組</strong>或<strong>多人聊天</strong>裡傳送：<strong>取得群組ID</strong>（或「群組ID」）</li>
            <li>機器人會回傳該群組/聊天室的 ID（一串英數字），請<strong>完整複製</strong></li>
            <li>到下方對應客戶那一列點「編輯」，把複製的 ID 貼到「LINE 群組 ID」欄位，儲存</li>
          </ol>
          <p class="notion-hint">ID 必須與機器人回傳的<strong>完全一致</strong>。下方表格即為目前資料庫內的綁定狀態（與收單機器人讀取的是同一份）。</p>
        </div>
        <div class="notion-card" style="border-left:4px solid #08c;">
          <h2>「連接通道」檢查清單（仍無法綁定時請逐項確認）</h2>
          <ol style="margin:0 0 12px;padding-left:20px;">
            <li><strong>LINE Developers Console</strong>（<a href="https://developers.line.biz/console/" target="_blank" rel="noopener">developers.line.biz/console</a>）→ 您的 Channel → <strong>Messaging API</strong> 分頁：<br>「Webhook URL」必須為 <code>https://您的服務.run.app/webhook</code>（與本後台同網址、結尾 /webhook），且「Use webhook」為 <strong>Enabled</strong>。</li>
            <li><strong>機器人已加入該群組</strong>：收單只認「群組」或「多人聊天」。請在 LINE 群組成員名單確認有您的官方帳號（機器人）；若沒有，請在群組內加入該帳號為成員。</li>
            <li><strong>在「群組內」傳訊息</strong>：若您是在「與機器人 1 對 1」聊天視窗傳，不會觸發群組綁定。請改在<strong>群組或多人聊天</strong>裡傳「取得群組ID」或「收單」。</li>
            <li><strong>後台與收單同一網址</strong>：綁定必須在「本頁相同網址」的後台編輯並儲存。開啟 <a href="/admin/api/binding-status" target="_blank">/admin/api/binding-status</a> 可確認此服務目前看到的客戶數與有填 LINE 群組 ID 的數量（應 ≥ 1）。</li>
          </ol>
        </div>
        <div class="notion-card">
          <h2>收不到／仍顯示未綁定時請查日誌</h2>
          <p>到 <strong>Google Cloud Console → Cloud Run → 你的服務 → 日誌</strong>，在群組/聊天室傳一則訊息後搜尋 <code>[LINE]</code>。</p>
          <ul style="margin:8px 0 0;padding-left:20px;">
            <li>有 <code>[LINE] 綁定查詢 OK customer=xxx</code> → 綁定成功，可傳「收單」開始收單。</li>
            <li>有 <code>[LINE] 非群組/聊天室 source.type= user</code> → 您是在「與機器人 1 對 1」聊天，請改在<strong>群組或多人聊天</strong>裡傳。</li>
            <li>有 <code>[LINE] 綁定查詢失敗</code> → 日誌會印出 LINE 傳來的 ID 與 DB 第一筆的前 8 字元比對；若「DB內有line_group_id的客戶數=0」代表此實例讀到的資料庫沒有綁定資料。</li>
            <li>完全沒有 <code>[LINE]</code> 日誌 → Webhook 未收到（請確認上述「連接通道」：Webhook URL、Use webhook、機器人已在群組內）。</li>
          </ul>
        </div>
        <div class="notion-card">
          <h2>資料庫連線與目前後台網址</h2>
          <p>目前使用：<strong>${escapeHtml(dbType)}</strong></p>
          <p>您目前連線的後台：<code>${escapeHtml(currentHost ? "https://" + currentHost + "/admin" : "(無法取得)")}</code></p>
          <p class="notion-hint">若此網址是 <code>localhost</code>，代表您開的是本機後台，收單機器人（Cloud Run）讀不到這裡的資料。請改開「已部署的 Cloud Run 後台網址」再編輯客戶綁定。</p>
        </div>
        <div class="notion-card">
          <h2>客戶與 LINE 群組 ID</h2>
          <table>
            <thead><tr><th>客戶名稱</th><th>LINE 群組 ID</th><th>已綁定</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody>${rows.length ? rows.join("") : "<tr><td colspan='5'>尚無客戶</td></tr>"}</tbody>
          </table>
        </div>
        <p><a href="/admin">← 回儀表板</a></p>
      `;
        res.type("text/html").send(notionPage("LINE 綁定檢查", body, "", res));
    });
    // 待確認品名：列出 need_review=1 的明細，可選擇對應品項並加入俗名
    router.get("/review", async (req, res) => {
        const msg = req.query.ok === "1" ? "<p style='color:green'>已加入對照。</p>" : req.query.err === "dup" ? "<p style='color:red'>此俗名已存在，請勿重複新增。</p>" : "";
        const rows = await db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.order_id, o.customer_id, c.name AS customer_name
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN customers c ON c.id = o.customer_id
      WHERE oi.need_review = 1
      ORDER BY oi.id
    `).all();
        const rowsHtml = rows.length === 0
            ? "<tr><td colspan='6'>目前沒有待確認品名</td></tr>"
            : rows
                .map((r) => `
        <tr>
          <td>${escapeHtml(r.raw_name)}</td>
          <td>${r.quantity}</td>
          <td>${escapeHtml(r.unit ?? "")}</td>
          <td>${escapeHtml(r.customer_name)}</td>
          <td>
            <form action="/admin/alias" method="post" class="review-alias-form" style="display:inline;">
              <input type="hidden" name="alias" value="${escapeAttr(r.raw_name)}">
              <input type="hidden" name="customer_id" value="${escapeAttr(r.customer_id)}">
              <div class="review-product-picker" style="position:relative;display:inline-block;vertical-align:middle;">
                <input type="text" class="review-product-search" placeholder="輸入品名或料號搜尋" style="width:240px;" autocomplete="off">
                <input type="hidden" name="product_id" required class="review-product-id">
                <span class="review-product-label notion-hint" style="margin-left:6px;display:inline;"></span>
                <div class="review-product-dropdown" style="display:none;position:absolute;left:0;top:100%;margin-top:2px;max-height:200px;overflow:auto;border:1px solid var(--notion-border);background:var(--notion-bg);border-radius:var(--notion-radius);box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:20;min-width:260px;"></div>
              </div>
              <label style="margin-left:8px;"><input type="radio" name="scope" value="global" checked> 全公司俗名</label>
              <label><input type="radio" name="scope" value="customer"> 此客戶專用</label>
              <button type="submit" style="margin-left:8px;">加入對照</button>
            </form>
            <form action="/admin/review/delete-item" method="post" style="display:inline;margin-left:8px;" onsubmit="return confirm('確定刪除此筆誤判資料？');">
              <input type="hidden" name="item_id" value="${escapeAttr(r.item_id)}">
              <button type="submit" class="btn">刪除</button>
            </form>
          </td>
        </tr>
      `)
                .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 待確認品名</div>
        <h1 class="notion-page-title">待確認品名</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("已加入") >= 0 ? "ok" : "err"}">${msg.replace(/<p style='[^']*'>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <p class="notion-hint" style="margin:0 0 12px;">以下為叫貨時無法對應到標準品項的名稱，請在「對應品項」欄輸入品名或料號搜尋、點選品項後加入俗名或客戶專用別名。</p>
          <table>
            <thead><tr><th>客戶輸入的名稱</th><th>數量</th><th>單位</th><th>客戶</th><th>對應品項並加入對照</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <script>
          (function(){
            var searchTimeout;
            document.querySelectorAll('.review-product-search').forEach(function(inp){
              var wrap = inp.closest('.review-product-picker');
              var hidden = wrap && wrap.querySelector('.review-product-id');
              var label = wrap && wrap.querySelector('.review-product-label');
              var dropdown = wrap && wrap.querySelector('.review-product-dropdown');
              if (!wrap || !hidden || !dropdown) return;
              function showList(arr){
                dropdown.innerHTML = (arr && arr.length) ? arr.map(function(p){
                  var text = (p.name || '') + (p.erp_code ? ' (' + p.erp_code + ')' : '') + (p.teraoka_barcode ? ' ' + p.teraoka_barcode : '');
                  return '<div class="review-product-opt" data-id="' + (p.id || '') + '" data-name="' + (p.name || '').replace(/"/g, '&quot;') + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--notion-border);font-size:13px;">' + (p.name || '') + (p.erp_code ? ' \uFF08' + p.erp_code + '\uFF09' : '') + '</div>';
                }).join('') : '<div class="notion-hint" style="padding:8px 12px;margin:0;">無符合品項</div>';
                dropdown.style.display = 'block';
              }
              function hideList(){ dropdown.style.display = 'none'; }
              function selectProduct(id, name){
                hidden.value = id || '';
                label.textContent = name || '';
                inp.value = name || '';
                hideList();
              }
              inp.addEventListener('input', function(){
                var q = (this.value || '').trim();
                clearTimeout(searchTimeout);
                if (!q){ hideList(); label.textContent = ''; hidden.value = ''; return; }
                searchTimeout = setTimeout(function(){
                  fetch('/admin/api/products-search?q=' + encodeURIComponent(q) + '&active=1').then(function(r){ return r.json(); }).then(function(arr){ showList(arr); }).catch(function(){ hideList(); });
                }, 200);
              });
              dropdown.addEventListener('click', function(e){
                var opt = e.target.closest('.review-product-opt');
                if (opt && opt.dataset.id) selectProduct(opt.dataset.id, opt.dataset.name);
              });
              document.addEventListener('click', function(e){ if (!wrap.contains(e.target)) hideList(); });
            });
          })();
        </script>
      `;
        res.type("text/html").send(notionPage("待確認品名", body, "", res));
    });
    router.post("/alias", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { alias, product_id, customer_id, scope, redirect } = req.body;
        if (!alias?.trim() || !product_id) {
            res.redirect(redirect && redirect.startsWith("/admin") ? redirect + "?err=missing" : "/admin/review?err=missing");
            return;
        }
        const aliasTrim = alias.trim();
        const isGlobal = scope !== "customer";
        try {
            if (isGlobal) {
                const id = (0, id_js_1.newId)("pa");
                await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run(id, product_id, aliasTrim);
                await logDataChange(req, {
                    entityType: "product_alias",
                    entityId: id,
                    productId: product_id,
                    action: "create",
                    summary: `新增俗名「${aliasTrim}」（POST /alias）`,
                    meta: { alias: aliasTrim, via: "alias_form" },
                });
            }
            else if (customer_id) {
                const id = (0, id_js_1.newId)("cpa");
                await db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(id, customer_id, product_id, aliasTrim);
            }
            // 將同名稱的待確認明細改為已對應（若為客戶專用則只更新該客戶的訂單明細）
            if (isGlobal) {
                await db.prepare("UPDATE order_items SET need_review = 0, product_id = ? WHERE raw_name = ? AND need_review = 1").run(product_id, aliasTrim);
            }
            else if (customer_id) {
                await db.prepare(`UPDATE order_items SET need_review = 0, product_id = ?
           WHERE raw_name = ? AND need_review = 1 AND order_id IN (SELECT id FROM orders WHERE customer_id = ?)`).run(product_id, aliasTrim, customer_id);
            }
        }
        catch (e) {
            console.error("[admin] alias insert error", e);
            res.redirect(redirect && redirect.startsWith("/admin") ? redirect + "?err=dup" : "/admin/review?err=dup");
            return;
        }
        const doneUrl = redirect && redirect.startsWith("/admin") ? redirect + "?ok=1" : "/admin/review?ok=1";
        res.redirect(doneUrl);
    });
    router.post("/review/delete-item", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const itemId = String(req.body.item_id || "").trim();
        if (!itemId) {
            res.redirect("/admin/review");
            return;
        }
        await db.prepare("DELETE FROM order_items WHERE id = ? AND need_review = 1").run(itemId);
        res.redirect("/admin/review?ok=1");
    });
    router.get("/orders", async (req, res) => {
        try {
            const today = getTaipeiCalendarDateYYYYMMDD();
            const onlyNeedReview = req.query.need_review === "1";
            const hasDateFrom = typeof req.query.date_from === "string" && req.query.date_from.trim() !== "";
            const hasDateTo = typeof req.query.date_to === "string" && req.query.date_to.trim() !== "";
            const filterDateFrom = (hasDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_from.trim()))
                ? req.query.date_from.trim()
                : today;
            const filterDateTo = (hasDateTo && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date_to.trim()))
                ? req.query.date_to.trim()
                : today;
            let lineOrders = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id, c.name AS customer_name,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1) AS need_review_count,
        0 AS non_kg_count,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND (oi.include_export IS NULL OR oi.include_export = 1)) AS export_item_count,
        o.sheet_exported_at, o.lingyue_exported_at
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.order_date >= ? AND o.order_date <= ? AND COALESCE(LOWER(TRIM(o.status)), '') <> 'deleted'
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 300
    `).all(filterDateFrom, filterDateTo);
            let deletedOrders = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id, c.name AS customer_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.order_date >= ? AND o.order_date <= ? AND COALESCE(LOWER(TRIM(o.status)), '') = 'deleted'
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 300
    `).all(filterDateFrom, filterDateTo);
            let logOrdersRaw = [];
            try {
                logOrdersRaw = await db.prepare(`
      SELECT o.id, o.order_date, o.customer_id, c.name AS customer_name,
        (SELECT COUNT(*) FROM logistics_order_items oi WHERE oi.order_id = o.id AND oi.need_review = 1) AS need_review_count,
        0 AS non_kg_count,
        (SELECT COUNT(*) FROM logistics_order_items oi WHERE oi.order_id = o.id) AS export_item_count
      FROM logistics_orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.order_date >= ? AND o.order_date <= ?
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 300
    `).all(filterDateFrom, filterDateTo);
            }
            catch (_e) {
                logOrdersRaw = [];
            }
            const logOrders = (logOrdersRaw || []).map((o) => ({
                id: o.id,
                order_no: null,
                order_date: o.order_date,
                status: null,
                customer_id: o.customer_id,
                customer_name: o.customer_name,
                need_review_count: o.need_review_count,
                non_kg_count: o.non_kg_count,
                export_item_count: o.export_item_count,
                sheet_exported_at: null,
                lingyue_exported_at: null,
                is_logistics: true,
            }));
            let orders = [...lineOrders, ...logOrders].sort((a, b) => {
                const da = (a.order_date || "").toString();
                const db = (b.order_date || "").toString();
                if (da !== db)
                    return db.localeCompare(da);
                return String(b.id).localeCompare(String(a.id));
            });
            if (onlyNeedReview) {
                orders = orders.filter((o) => (o.need_review_count ?? 0) > 0);
            }
            const labelByOrder = new Map();
            if (orders.length) {
                const lineIds = orders.filter((x) => !x.is_logistics).map((x) => x.id);
                const logIds = orders.filter((x) => x.is_logistics).map((x) => x.id);
                if (lineIds.length) {
                    const ph = lineIds.map(() => "?").join(",");
                    const labelRows = await db.prepare(`
      SELECT oi.order_id, COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '—') AS label
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id IN (${ph})
      ORDER BY oi.order_id, oi.id
    `).all(...lineIds);
                    for (const r of labelRows) {
                        const oid = r.order_id;
                        if (!labelByOrder.has(oid))
                            labelByOrder.set(oid, []);
                        const arr = labelByOrder.get(oid);
                        if (arr.length < 6)
                            arr.push(r.label);
                    }
                }
                if (logIds.length) {
                    const ph = logIds.map(() => "?").join(",");
                    const labelRowsLog = await db.prepare(`
      SELECT oi.order_id, COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '—') AS label
      FROM logistics_order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id IN (${ph})
      ORDER BY oi.order_id, oi.id
    `).all(...logIds);
                    for (const r of labelRowsLog) {
                        const oid = r.order_id;
                        if (!labelByOrder.has(oid))
                            labelByOrder.set(oid, []);
                        const arr = labelByOrder.get(oid);
                        if (arr.length < 6)
                            arr.push(r.label);
                    }
                }
            }
            const orderSeqStartRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("order_seq_start_" + today);
            const orderSeqStartVal = orderSeqStartRow?.value ?? "";
            const buildStatusIcons = (o) => {
                const n = o.need_review_count ?? 0;
                const pieces = [];
                if (String(o.status || "").toLowerCase() === "approved") {
                    pieces.push(`<span class="osi osi-approve" title="已確認">✓</span>`);
                }
                if (n > 0) {
                    pieces.push(`<span class="osi osi-warn" title="${n} 項待確認">!</span>`);
                }
                if (o.sheet_exported_at) {
                    pieces.push(`<span class="osi osi-sheet" title="已開啟／匯出揀貨單">🖨</span>`);
                }
                if (o.lingyue_exported_at) {
                    pieces.push(`<span class="osi osi-xlsx" title="已匯出凌越 Excel">▦</span>`);
                }
                return `<div class="order-status-icons">${pieces.join("")}</div>`;
            };
            const rows = orders
                .map((o, idx) => {
                const n = o.need_review_count ?? 0;
                const cnt = o.export_item_count ?? 0;
                const labels = labelByOrder.get(o.id) || [];
                const preview = labels.slice(0, 4).join("、");
                const previewShort = preview.length > 72 ? preview.slice(0, 72) + "…" : preview;
                const infoHtml = cnt > 0
                    ? `<span>${cnt} 筆品項</span>${previewShort ? `<span class="notion-hint" style="display:block;margin-top:4px;font-size:12px;">${escapeHtml(previewShort)}</span>` : ""}${n > 0 ? `<span style="color:#c00;font-size:12px;display:block;margin-top:2px;">${n} 項待確認</span>` : ""}`
                    : `<span class="notion-hint">無品項</span>`;
                const custDisp = o.customer_name || "未選客戶";
                const custLink = o.customer_id
                    ? `<a href="/admin/customers/${encodeURIComponent(o.customer_id)}/quick-view?from=orders">${escapeHtml(o.customer_name)}</a>`
                    : `<span class="notion-hint">${escapeHtml(custDisp)}</span>`;
                const backBase = `/admin/orders?date_from=${encodeURIComponent(filterDateFrom)}&date_to=${encodeURIComponent(filterDateTo)}${onlyNeedReview ? "&need_review=1" : ""}`;
                const detailUrl = o.is_logistics
                    ? `/admin/logistics/orders/${encodeURIComponent(o.id)}`
                    : `/admin/orders/${encodeURIComponent(o.id)}?back=${encodeURIComponent(backBase)}`;
                const detailLabel = o.is_logistics ? "紙本明細" : "明細";
                const orderNoCell = o.is_logistics
                    ? `<span class="notion-hint" title="後台新增訂單">紙本</span>`
                    : `${escapeHtml(o.order_no ?? "—")}`;
                const checkboxCell = o.is_logistics
                    ? `<span class="notion-hint" title="批次操作用於 LINE 訂單；紙本請點明細">—</span>`
                    : `<input type="checkbox" name="order_ids" value="${escapeAttr(o.id)}" form="batchOrderActionsForm" class="order-batch-cb">`;
                return `<tr class="order-row" data-cust="${escapeAttr(custDisp)}" data-orderno="${escapeAttr(o.is_logistics ? "紙本" : (o.order_no ?? ""))}">
            <td>${idx + 1}</td>
            <td>${checkboxCell}</td>
            <td style="white-space:nowrap;">${buildStatusIcons(o)}</td>
            <td>${orderNoCell}</td>
            <td>${escapeHtml(o.order_date)}</td>
            <td>${custLink}</td>
            <td style="max-width:min(320px, 40vw);">${infoHtml}</td>
            <td><a href="${detailUrl}">${detailLabel}</a></td>
          </tr>`;
            })
                .join("");
            const deletedRows = deletedOrders.map((o, idx) => `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(o.order_no ?? "—")}</td>
            <td>${escapeHtml(o.order_date)}</td>
            <td>${escapeHtml(o.customer_name ?? "—")}</td>
            <td><a href="/admin/orders/${encodeURIComponent(o.id)}?back=${encodeURIComponent("/admin/orders?date_from=" + encodeURIComponent(filterDateFrom) + "&date_to=" + encodeURIComponent(filterDateTo) + (onlyNeedReview ? "&need_review=1" : ""))}">明細</a></td>
          </tr>`).join("");
            const filterLink = onlyNeedReview
                ? `<a href="/admin/orders?date_from=${escapeAttr(filterDateFrom)}&date_to=${escapeAttr(filterDateTo)}">顯示全部訂單</a>`
                : `<a href="/admin/orders?need_review=1&date_from=${escapeAttr(filterDateFrom)}&date_to=${escapeAttr(filterDateTo)}">只看有待確認的訂單</a>`;
            const usingCloudSqlOrders = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
            const orderListDbWarning = usingCloudSqlOrders ? "" : `<p class="notion-msg err" style="margin-bottom:12px;">目前未連線 Cloud SQL，資料不會長期保留，收單後可能看不到或重開就消失。請在 Cloud Run 設定 <strong>DATABASE_URL</strong>。</p>`;
            const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 訂單查詢</div>
        <h1 class="notion-page-title">訂單查詢</h1>
        ${orderListDbWarning}
        ${req.query.ok === "log_saved" ? "<p class=\"notion-msg ok\">已儲存紙本訂單。</p>" : ""}
        ${req.query.ok === "seq" ? "<p class=\"notion-msg ok\">已儲存本日起始編號。</p>" : ""}
        ${req.query.ok === "del" ? "<p class=\"notion-msg ok\">已將選取訂單移至下方「已刪除訂單」區。</p>" : ""}
        ${req.query.ok === "approved" ? "<p class=\"notion-msg ok\">已將選取訂單標記為已確認。</p>" : ""}
        ${req.query.err === "none" ? "<p class=\"notion-msg err\">請先勾選要處理的訂單。</p>" : ""}
        <p class="notion-hint" style="margin-bottom:8px;">依訂單日期區間篩選（預設為當日）。</p>
        <p class="notion-hint" style="margin-bottom:12px;"><a href="/admin/review">待確認品名</a>（補對照）　${filterLink}</p>
        <p style="margin-bottom:12px;"><a href="/admin/logistics/orders/new" class="btn btn-primary" style="background:#f59e0b;border-color:#f59e0b;color:#fff;">＋ 新增訂單</a></p>
        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">篩選</h2>
          <p class="notion-hint" style="margin:0 0 10px;">僅依<strong>訂單日期</strong>向伺服器查詢；客戶與貨單編號請在下方列表旁篩選（僅限本頁已載入之訂單）。</p>
          <form id="ordersFilterForm" method="get" action="/admin/orders" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
            ${onlyNeedReview ? '<input type="hidden" name="need_review" value="1">' : ""}
            <input type="hidden" name="date_from" id="ordersDateFrom" value="${escapeAttr(filterDateFrom)}">
            <input type="hidden" name="date_to" id="ordersDateTo" value="${escapeAttr(filterDateTo)}">
            <label style="margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span>日期區間</span>
              <input type="text" id="ordersDateRange" readonly placeholder="點選選擇起訖日期" autocomplete="off" style="width:min(260px, 85vw);padding:8px 10px;border:1px solid var(--notion-border-strong);border-radius:var(--notion-radius);background:var(--notion-bg);cursor:pointer;font-size:14px;">
            </label>
            <button type="button" class="btn" id="ordersPrevRange" title="整段區間向前移一天">前一日</button>
            <button type="button" class="btn" id="ordersNextRange" title="整段區間向後移一天">後一日</button>
            <button type="submit" class="btn">查詢</button>
            <a href="${onlyNeedReview ? "/admin/orders?need_review=1" : "/admin/orders"}" class="btn">清除（預設當日）</a>
          </form>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.css">
        </div>
        <details class="notion-card" style="margin-bottom:16px;">
          <summary style="cursor:pointer;font-weight:600;list-style:none;display:flex;align-items:center;gap:8px;">
            <span style="color:var(--notion-text-muted);font-size:11px;">▸</span> 本日起始編號（與 ERP 對齊）
          </summary>
          <div style="padding-top:12px;">
            <p class="notion-hint">訂單編號規則：西元年月日＋流水號（例 20250226001）。設定本日（${escapeHtml(today)}）的起始流水號，之後新訂單依序遞增。</p>
            <form method="post" action="/admin/api/order-seq-start" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <input type="hidden" name="date" value="${escapeAttr(today)}">
              <label>起始流水號 <input type="number" name="start" value="${escapeAttr(orderSeqStartVal)}" min="1" placeholder="1" style="width:80px;"></label>
              <button type="submit" class="btn">儲存</button>
            </form>
          </div>
        </details>
        <div class="notion-card">
          <h2 style="margin-top:0;display:flex;align-items:center;flex-wrap:wrap;">訂單列表<span class="admin-info-icon" title="勾選訂單後，可批次刪除、下載揀貨單（含條碼）。凌越 Excel：多筆合併為同一檔案（表頭一列），依訂單日期／編號排序；一次勾選過多若下載失敗請分批。" tabindex="0">i</span></h2>
          <p style="margin:0 0 12px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;">
            <label style="margin:0;display:flex;align-items:center;gap:6px;font-size:14px;">貨單編號 <input type="search" id="orderFilterOrderNo" placeholder="篩選列表內" autocomplete="off" style="width:min(200px, 50vw);padding:6px 8px;border:1px solid var(--notion-border-strong);border-radius:var(--notion-radius);font-size:14px;"></label>
            <label style="margin:0;display:flex;align-items:center;gap:6px;font-size:14px;">客戶 <input type="search" id="orderFilterCustomer" placeholder="篩選列表內" autocomplete="off" style="width:min(200px, 50vw);padding:6px 8px;border:1px solid var(--notion-border-strong);border-radius:var(--notion-radius);font-size:14px;"></label>
          </p>
          <p class="notion-hint" style="margin-top:0;margin-bottom:10px;">狀態圖示：<span class="osi osi-approve" style="display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;border-radius:4px;">✓</span> 已確認、<span class="osi osi-warn" style="display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;border-radius:4px;">!</span> 待確認、<span class="osi osi-sheet" style="display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;border-radius:4px;">🖨</span> 已匯出揀貨單、<span class="osi osi-xlsx" style="display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;border-radius:4px;">▦</span> 已匯出凌越。</p>
          <form id="batchOrderActionsForm" method="post" action="/admin/orders/batch-delete" style="margin-bottom:12px;">
          <p style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
            <button type="button" class="btn" id="orderSelectAll">全選</button>
            <button type="button" class="btn" id="orderSelectNone">取消全選</button>
            <button type="button" class="btn btn-primary" id="btnBatchApprove">選取後確認</button>
            <button type="submit" class="btn" onclick="return confirm('確定要刪除勾選的訂單？此動作無法復原。');">刪除選取訂單</button>
            <button type="button" class="btn btn-primary" id="btnBatchOrderSheet">匯出揀貨單（含條碼）</button>
            <button type="button" class="btn btn-primary" id="btnBatchLingyueXlsx">匯出凌越訂單 Excel</button>
          </p>
          </form>
          <table>
            <thead><tr><th style="width:48px;">項次</th><th style="width:36px;"><input type="checkbox" id="orderSelectAllCb" title="全選"></th><th>狀態</th><th>訂單編號</th><th>日期</th><th>客戶</th><th>訂單資訊</th><th></th></tr></thead>
            <tbody>${rows.length ? rows : "<tr><td colspan='8'>無訂單</td></tr>"}</tbody>
          </table>
          <details style="margin-top:14px;">
            <summary style="cursor:pointer;">已刪除訂單（${deletedOrders.length}）</summary>
            <div style="margin-top:8px;">
              <table>
                <thead><tr><th style="width:48px;">項次</th><th>訂單編號</th><th>日期</th><th>客戶</th><th></th></tr></thead>
                <tbody>${deletedRows || "<tr><td colspan='5'>目前無已刪除訂單</td></tr>"}</tbody>
              </table>
            </div>
          </details>
          <script src="https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js"></script>
          <script>
          (function(){
            function allCbs(){ return document.querySelectorAll(".order-batch-cb"); }
            var allEl = document.getElementById("orderSelectAllCb");
            if (allEl) allEl.addEventListener("change", function(){ allCbs().forEach(function(c){ c.checked = allEl.checked; }); });
            var b1 = document.getElementById("orderSelectAll");
            var b2 = document.getElementById("orderSelectNone");
            if (b1) b1.onclick = function(){ allCbs().forEach(function(c){ c.checked = true; }); if (allEl) allEl.checked = true; };
            if (b2) b2.onclick = function(){ allCbs().forEach(function(c){ c.checked = false; }); if (allEl) allEl.checked = false; };
            function selectedIds(){
              var a = [];
              allCbs().forEach(function(c){ if (c.checked) a.push(c.value); });
              return a;
            }
            function openBatch(kind){
              var ids = selectedIds();
              if (!ids.length) { alert("請先勾選訂單"); return; }
              var q = ids.map(encodeURIComponent).join(",");
              if (kind === "sheet") {
                window.location.href = "/admin/orders/batch-order-sheet?ids=" + q;
                return;
              }
              /* 凌越：一律 POST，避免 GET 網址過長被瀏覽器／Proxy／Cloud Run 截斷導致匯出失敗 */
              var form = document.createElement("form");
              form.method = "post";
              form.action = "/admin/orders/batch-lingyue-xlsx";
              ids.forEach(function(id){
                var inp = document.createElement("input");
                inp.type = "hidden";
                inp.name = "order_ids";
                inp.value = id;
                form.appendChild(inp);
              });
              document.body.appendChild(form);
              form.submit();
              document.body.removeChild(form);
            }
            var bs = document.getElementById("btnBatchOrderSheet");
            var bl = document.getElementById("btnBatchLingyueXlsx");
            var ba = document.getElementById("btnBatchApprove");
            if (bs) bs.onclick = function(){ openBatch("sheet"); };
            if (bl) bl.onclick = function(){ openBatch("xlsx"); };
            if (ba) ba.onclick = function(){
              var ids = selectedIds();
              if (!ids.length) { alert("請先勾選訂單"); return; }
              if (!confirm("確定將勾選訂單標記為已確認？")) return;
              var form = document.createElement("form");
              form.method = "post";
              form.action = "/admin/orders/batch-approve";
              ids.forEach(function(id){
                var i = document.createElement("input");
                i.type = "hidden"; i.name = "order_ids"; i.value = id;
                form.appendChild(i);
              });
              document.body.appendChild(form);
              form.submit();
            };
            var df = document.getElementById("ordersDateFrom");
            var dt = document.getElementById("ordersDateTo");
            var rangeInp = document.getElementById("ordersDateRange");
            var filterForm = document.getElementById("ordersFilterForm");
            function pad2(n){ return n < 10 ? "0" + n : String(n); }
            function fmtYMD(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
            if (typeof flatpickr !== "undefined" && rangeInp && df && dt && filterForm) {
              var fp = flatpickr(rangeInp, {
                mode: "range",
                dateFormat: "Y-m-d",
                defaultDate: [df.value, dt.value],
                allowInput: false,
                onChange: function(selectedDates){
                  if (selectedDates.length >= 1) {
                    df.value = fmtYMD(selectedDates[0]);
                    dt.value = selectedDates.length >= 2 ? fmtYMD(selectedDates[1]) : fmtYMD(selectedDates[0]);
                  }
                }
              });
              function shiftRange(delta){
                var d1 = new Date(df.value + "T12:00:00");
                var d2 = new Date(dt.value + "T12:00:00");
                if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return;
                d1.setDate(d1.getDate() + delta);
                d2.setDate(d2.getDate() + delta);
                df.value = fmtYMD(d1);
                dt.value = fmtYMD(d2);
                fp.setDate([df.value, dt.value], true);
                filterForm.submit();
              }
              var prevB = document.getElementById("ordersPrevRange");
              var nextB = document.getElementById("ordersNextRange");
              if (prevB) prevB.onclick = function(){ shiftRange(-1); };
              if (nextB) nextB.onclick = function(){ shiftRange(1); };
            }
            function applyListFilters(){
              var qNo = (document.getElementById("orderFilterOrderNo") && document.getElementById("orderFilterOrderNo").value || "").toLowerCase().trim();
              var qCust = (document.getElementById("orderFilterCustomer") && document.getElementById("orderFilterCustomer").value || "").toLowerCase().trim();
              document.querySelectorAll("tr.order-row").forEach(function(tr){
                var no = (tr.getAttribute("data-orderno") || "").toLowerCase();
                var cust = (tr.getAttribute("data-cust") || "").toLowerCase();
                var okNo = !qNo || no.indexOf(qNo) >= 0;
                var okCust = !qCust || cust.indexOf(qCust) >= 0;
                tr.style.display = okNo && okCust ? "" : "none";
              });
            }
            var fo = document.getElementById("orderFilterOrderNo");
            var fc = document.getElementById("orderFilterCustomer");
            if (fo) fo.addEventListener("input", applyListFilters);
            if (fc) fc.addEventListener("input", applyListFilters);
          })();
          </script>
        </div>
      `;
            res.type("text/html").send(notionPage("訂單查詢", body, "", res));
        }
        catch (e) {
            const errMsg = (e?.message || String(e)).slice(0, 500);
            console.error("[admin] GET /orders 錯誤:", errMsg, e?.stack);
            res.status(500).type("text/html").send(`
        <!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>訂單查詢錯誤</title></head>
        <body style="font-family:sans-serif;padding:2rem;max-width:640px;">
          <h1>訂單查詢暫時無法使用</h1>
          <p>請稍後再試，或聯絡管理員檢查後台與資料庫連線。</p>
          <p style="margin-top:1rem;padding:10px;background:#f5f5f5;border-radius:6px;font-size:13px;word-break:break-all;"><strong>錯誤訊息：</strong><br>${escapeHtml(errMsg)}</p>
          <p class="notion-hint" style="margin-top:1rem;">若為「column … does not exist」，請確認 Cloud SQL 已執行過最新 schema（含 order_no、order_attachments 等）。</p>
          <p style="margin-top:1rem;"><a href="/admin">回儀表板</a></p>
        </body></html>`);
        }
    });
    router.post("/api/order-seq-start", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const date = req.body?.date?.trim();
        const start = req.body?.start?.trim();
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.redirect("/admin/orders?err=date");
            return;
        }
        const num = start ? parseInt(start, 10) : 1;
        const val = (Number.isNaN(num) || num < 1) ? "1" : String(num);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("order_seq_start_" + date, val);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("order_seq_next_" + date, val);
        res.redirect("/admin/orders?ok=seq&date_from=" + encodeURIComponent(date) + "&date_to=" + encodeURIComponent(date));
    });
    router.get("/export", async (req, res) => {
        const workingDate = await getWorkingDate(db);
        const date = (req.query.date || workingDate).toString().trim();
        const customerId = req.query.customer_id?.trim() || "";
        const customers = await db.prepare("SELECT id, name FROM customers WHERE active = 1 ORDER BY name").all();
        let orders = [];
        if (date) {
            orders = await db.prepare(`
              SELECT o.id, o.order_date, o.customer_id, c.name AS customer_name
              FROM orders o JOIN customers c ON c.id = o.customer_id
              WHERE o.order_date = ?
              ORDER BY c.name
            `).all(date);
            if (customerId)
                orders = orders.filter((o) => o.customer_id === customerId);
        }
        const customerOptions = customers.map((c) => `<option value="${escapeAttr(c.id)}" ${c.id === customerId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
        const rows = orders.map((o) => `<tr><td>${escapeHtml(o.order_date)}</td><td>${escapeHtml(o.customer_name)}</td><td><a href="/admin/orders/${encodeURIComponent(o.id)}">明細</a></td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 資料匯出</div>
        <h1 class="notion-page-title">資料匯出</h1>
        <div class="notion-card">
          <form method="get" action="/admin/export">
            <label class="form-inline">日期 <input type="date" name="date" value="${escapeAttr(date)}" required></label>
            <label class="form-inline">客戶 <select name="customer_id"><option value="">全部</option>${customerOptions}</select></label>
            <button type="submit" class="btn">查詢</button>
          </form>
        </div>
        <div class="notion-card">
          <h2>指定日期訂單${customerId ? "（已篩選客戶）" : ""}</h2>
          <table>
            <thead><tr><th>日期</th><th>客戶</th><th></th></tr></thead>
            <tbody>${rows.length ? rows : "<tr><td colspan='3'>無訂單</td></tr>"}</tbody>
          </table>
          ${orders.length ? `<p style="margin-top:12px;"><a href="/admin/export/download?date=${encodeURIComponent(date)}${customerId ? "&customer_id=" + encodeURIComponent(customerId) : ""}" class="btn">匯出 CSV</a></p>` : ""}
        </div>
      `;
        res.type("text/html").send(notionPage("資料匯出", body, "", res));
    });
    router.get("/export/download", async (req, res) => {
        const date = req.query.date?.trim();
        const customerId = req.query.customer_id?.trim() || "";
        if (!date) {
            res.redirect("/admin/export?err=date");
            return;
        }
        let orders = await db.prepare(`
          SELECT o.id, o.order_date, o.customer_id, c.name AS customer_name
          FROM orders o JOIN customers c ON c.id = o.customer_id
          WHERE o.order_date = ?
          ORDER BY c.name
        `).all(date);
        if (customerId)
            orders = orders.filter((o) => o.customer_id === customerId);
        const lines = ["日期,客戶,訂單ID"];
        for (const o of orders)
            lines.push([o.order_date, '"' + (o.customer_name || "").replace(/"/g, '""') + '"', o.id].join(","));
        res.setHeader("Content-Disposition", "attachment; filename=\"orders-" + date + ".csv\"");
        res.type("text/csv").send(lines.join("\n"));
    });
    const BACKUP_TABLE_NAMES = [
        "customers", "products", "orders", "order_items", "order_attachments",
        "app_settings", "wholesale_market_snapshots", "line_bot_state_log",
        "product_aliases", "customer_product_aliases", "customer_handwriting_hints", "customer_order_image_examples", "product_unit_specs", "product_packaging_ratios",
        "inventory_warehouses", "inventory_warehouse_products", "erp_sales", "daily_inventory",
        "logistics_orders", "logistics_order_items",
        "freezer_fridge_warehouses", "freezer_fridge_daily",
    ];
    function jsonSafeBackupValue(v) {
        if (v == null)
            return v;
        if (v instanceof Date)
            return v.toISOString();
        return v;
    }
    function jsonSafeBackupRow(row) {
        if (!row || typeof row !== "object")
            return row;
        const o = {};
        for (const k of Object.keys(row))
            o[k] = jsonSafeBackupValue(row[k]);
        return o;
    }
    router.get("/backup", async (_req, res) => {
        const isPg = Boolean(process.env.DATABASE_URL);
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 資料備份</div>
        <h1 class="notion-page-title">資料備份</h1>
        <div class="notion-card">
          <h2 style="margin-top:0;">一鍵匯出（JSON）</h2>
          <p class="notion-hint">將主要資料表匯成單一 JSON 檔，可另存於本機或雲端硬碟；內容含客戶、品項、訂單、盤點、北農行情快照、紙本訂單等。請妥善保管，檔案可能含營業資訊。</p>
          <p><a href="/admin/backup/download-json" class="btn btn-primary">下載完整備份 JSON</a></p>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">資料庫檔案層級備份</h2>
          <p class="notion-hint">${isPg
            ? "目前使用 <strong>PostgreSQL</strong>（<code>DATABASE_URL</code>）。請依主機方案啟用自動備份，或自行以 <code>pg_dump</code> 定期匯出；亦可搭配上方 JSON 作為額外副本。"
            : "目前使用 <strong>SQLite</strong>（預設路徑見環境變數 <code>DB_PATH</code>）。可定期複製 <code>.db</code> 檔至安全位置；專案內附 <code>scripts/backup-db.sh</code> 可將資料庫複製到 <code>data/backups/</code>。"}</p>
        </div>
      `;
        res.type("text/html").send(notionPage("資料備份", body, "backup", res));
    });
    router.get("/backup/download-json", async (_req, res) => {
        const exportedAt = new Date().toISOString();
        const payload = {
            exportedAt,
            format: "songfu_linebot_backup_v1",
            databaseKind: process.env.DATABASE_URL ? "postgresql" : "sqlite",
            tables: {},
        };
        for (const name of BACKUP_TABLE_NAMES) {
            try {
                const rows = await db.prepare("SELECT * FROM " + name).all();
                payload.tables[name] = (rows || []).map((r) => jsonSafeBackupRow(r));
            }
            catch (e) {
                payload.tables[name] = { _error: String(e?.message || e) };
            }
        }
        const stamp = exportedAt.slice(0, 10);
        res.setHeader("Content-Disposition", "attachment; filename=\"songfu-backup-" + stamp + ".json\"");
        res.type("application/json; charset=utf-8").send(JSON.stringify(payload, null, 2));
    });
    router.get("/api/products-search", async (req, res) => {
        const q = (req.query.q || "").trim().toLowerCase();
        const activeOnly = req.query.active === "1";
        let list = await db.prepare(activeOnly
            ? "SELECT id, name, erp_code, teraoka_barcode FROM products WHERE (active IS NULL OR active = 1) ORDER BY name"
            : "SELECT id, name, erp_code, teraoka_barcode FROM products ORDER BY name").all();
        if (q) {
            const parts = q.split(/\s+/).filter(Boolean);
            let filtered = list.filter((p) => {
                const name = (p.name || "").toLowerCase();
                const erp = (p.erp_code || "").toLowerCase();
                const teraoka = (p.teraoka_barcode || "").toLowerCase();
                return parts.every((part) => name.includes(part) || erp.includes(part) || teraoka.includes(part));
            });
            if (filtered.length === 0 && parts.length > 0)
                filtered = list.filter((p) => {
                    const name = (p.name || "").toLowerCase();
                    const erp = (p.erp_code || "").toLowerCase();
                    const teraoka = (p.teraoka_barcode || "").toLowerCase();
                    const all = name + " " + erp + " " + teraoka;
                    return parts.some((part) => all.includes(part));
                });
            list = filtered;
        }
        res.json(list.slice(0, 80));
    });
    router.get("/api/customers-search", async (req, res) => {
        const q = (req.query.q || "").trim().toLowerCase();
        let list = await db.prepare("SELECT id, name FROM customers WHERE active IS NULL OR active = 1 ORDER BY name").all();
        if (q) {
            const parts = q.split(/\s+/).filter(Boolean);
            list = list.filter((c) => {
                const name = (c.name || "").toLowerCase();
                return parts.every((part) => name.includes(part));
            });
            if (list.length === 0 && parts.length > 0) {
                list = (await db.prepare("SELECT id, name FROM customers WHERE active IS NULL OR active = 1 ORDER BY name").all()).filter((c) => {
                    const name = (c.name || "").toLowerCase();
                    return parts.some((part) => name.includes(part));
                });
            }
        }
        res.json((list || []).slice(0, 80));
    });
    router.post("/orders/:orderId/items/:itemId/product", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId, itemId } = req.params;
        const productId = req.body.product_id?.trim();
        const order = await db.prepare("SELECT id, customer_id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        if (!productId) {
            if (req.get("X-Requested-With") === "XMLHttpRequest") {
                res.status(400).json({ error: "請選擇有效品項。" });
                return;
            }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=product#items");
            return;
        }
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest";
            if (wantsJson) {
                res.status(400).json({ error: "請選擇有效品項。" });
                return;
            }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=product#items");
            return;
        }
        const item = await db.prepare("SELECT raw_name FROM order_items WHERE id = ? AND order_id = ?").get(itemId, orderId);
        await db.prepare("UPDATE order_items SET product_id = ?, need_review = 0 WHERE id = ? AND order_id = ?").run(productId, itemId, orderId);
        const rawNameTrim = item?.raw_name?.trim();
        if (rawNameTrim) {
            const existing = await db.prepare("SELECT id FROM product_aliases WHERE alias = ?").get(rawNameTrim);
            if (!existing) {
                try {
                    const paId = (0, id_js_1.newId)("pa");
                    await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run(paId, productId, rawNameTrim);
                }
                catch (_) { /* 可能重複 */ }
            }
            const existingCpa = await db.prepare("SELECT id FROM customer_product_aliases WHERE customer_id = ? AND alias = ?").get(order.customer_id, rawNameTrim);
            if (!existingCpa) {
                try {
                    const cpaId = (0, id_js_1.newId)("cpa");
                    await db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(cpaId, order.customer_id, productId, rawNameTrim);
                }
                catch (_) { /* 可能重複 */ }
            }
            try {
                await customer_handwriting_hints_js_1.recordHandwritingHint(db, order.customer_id, rawNameTrim, productId);
            }
            catch (_) { /* 筆跡對照表寫入失敗不阻擋 */ }
        }
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest";
        if (wantsJson) {
            res.json({ ok: true, productName: product.name || "", productId: product.id || productId });
            return;
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=product#items");
    });
    router.post("/orders/batch-delete", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        let ids = req.body.order_ids;
        if (ids == null)
            ids = [];
        if (!Array.isArray(ids))
            ids = [ids];
        ids = ids.map((x) => String(x).trim()).filter(Boolean);
        if (!ids.length) {
            res.redirect("/admin/orders?err=none");
            return;
        }
        for (const oid of ids.slice(0, 200)) {
            try {
                const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                await db.prepare("UPDATE orders SET status = ?, updated_at = " + nowSql + " WHERE id = ?").run("deleted", oid);
            }
            catch (e) {
                console.error("[admin] batch-delete order", oid, e?.message || e);
            }
        }
        res.redirect("/admin/orders?ok=del");
    });
    router.post("/orders/batch-approve", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        let ids = req.body.order_ids;
        if (ids == null)
            ids = [];
        if (!Array.isArray(ids))
            ids = [ids];
        ids = ids.map((x) => String(x).trim()).filter(Boolean);
        if (!ids.length) {
            res.redirect("/admin/orders?err=none");
            return;
        }
        for (const oid of ids.slice(0, 200)) {
            try {
                await db.prepare("UPDATE orders SET status = ? WHERE id = ?").run("approved", oid);
            }
            catch (e) {
                console.error("[admin] batch-approve order", oid, e?.message || e);
            }
        }
        res.redirect("/admin/orders?ok=approved");
    });
    router.get("/orders/batch-order-sheet", async (req, res) => {
        const raw = (req.query.ids || "").toString();
        const ids = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 50);
        if (!ids.length) {
            res.status(400).type("text/html").send("<!DOCTYPE html><html><body><p>請先勾選訂單。</p><a href=\"/admin/orders\">回訂單查詢</a></body></html>");
            return;
        }
        const orderSheetPrintStyle = `
<style>
.order-sheet-print { font-size: 17pt; color: #111; box-sizing: border-box; }
.order-sheet-print .order-sheet-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
.order-sheet-print .order-sheet-head-L { flex: 1; min-width: 0; }
.order-sheet-print .order-sheet-head-R { flex-shrink: 0; text-align: right; max-width: 48%; }
.order-sheet-print h1 { font-size: 26pt; margin: 0 0 10px; font-weight: 700; letter-spacing: -0.02em; }
.order-sheet-print .os-meta { font-size: 17pt; margin: 0; line-height: 1.45; }
.order-sheet-print table { width: 100%; border-collapse: collapse; font-size: 17pt; table-layout: fixed; }
.order-sheet-print th, .order-sheet-print td { border: 1px solid #333; padding: 5px 5px; vertical-align: top; }
.order-sheet-print th { font-size: 15pt; background: #f5f5f5; font-weight: 600; }
.order-sheet-print th.col-tg { width: 16%; max-width: 32mm; font-size: 11pt; padding: 4px 3px; }
.order-sheet-print td.col-tg { width: 16%; max-width: 32mm; padding: 3px 3px; }
.order-sheet-print .teraoka-compact { display: flex; flex-direction: column; align-items: flex-start; gap: 0; margin: 0; padding: 0; max-width: 100%; }
.order-sheet-print .teraoka-compact-meta { margin: 0; padding: 0; line-height: 1.1; }
.order-sheet-print .teraoka-compact .tc-code { display: block; font-size: 6.5pt; font-weight: 600; color: #222; letter-spacing: -0.02em; word-break: break-all; }
.order-sheet-print .teraoka-compact .tc-name { display: block; font-size: 6.5pt; color: #444; margin: 0; padding: 0; line-height: 1.15; max-height: 2.5em; overflow: hidden; word-break: break-word; }
.order-sheet-print .os-bc-item-img { height: 51px; width: auto; display: block; margin: 0; padding: 0; max-width: 100%; }
.order-sheet-print .os-bc-order-img { height: 56px; width: auto; display: block; margin-left: auto; max-width: 100%; }
.order-sheet-print .order-sheet-bc-label { font-size: 14pt; margin-top: 4px; }
.order-sheet-print .os-cust-bc { height: 84px; width: auto; max-width: 100%; }
.order-sheet-print .order-sheet-inner { width: 100%; max-width: 190mm; margin: 0 auto; padding: 4mm 6mm; }
</style>`;
        const parts = [];
        let firstOrderMeta = null;
        for (let i = 0; i < ids.length; i++) {
            const orderId = ids[i];
            const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
            if (!order)
                continue;
            if (!firstOrderMeta) {
                firstOrderMeta = { date: order.order_date || new Date().toISOString().slice(0, 10), customer: order.customer_name || "客戶", orderNo: order.order_no || order.id };
            }
            const items = await db.prepare(`
      SELECT oi.quantity, oi.unit, oi.remark, p.erp_code, p.name AS product_name
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1)
      ORDER BY COALESCE(oi.display_order, 999999), oi.id
    `).all(orderId);
            const orderNoForBc = (order.order_no && String(order.order_no).trim()) ? String(order.order_no).trim() : order.id;
            const orderBcImg = orderNoForBc
                ? `<div class="order-sheet-head-R"><img src="/admin/barcode?code=${encodeURIComponent(orderNoForBc)}&scale=3&height=12" alt="" class="os-bc-order-img"/><div class="order-sheet-bc-label">${escapeHtml(order.order_no ?? order.id)}</div></div>`
                : "";
            const rows = items.map((it) => {
                const erp = it.erp_code ?? "—";
                const pname = it.product_name ?? "待確認";
                const qty = it.quantity;
                const u = it.unit && it.unit.trim() ? it.unit : "";
                const remark = (it.remark && it.remark.trim()) ? escapeHtml(it.remark.trim()) : "—";
                return `<tr><td>${escapeHtml(erp)}</td><td>${escapeHtml(pname)}</td><td>${qty}</td><td>${escapeHtml(u)}</td><td>${remark}</td></tr>`;
            }).join("");
            const customerBarcode = order.customer_teraoka_code && order.customer_teraoka_code.trim()
                ? `<p style="font-size:17pt;margin-top:12px;"><strong>客戶條碼</strong>（${escapeHtml(order.customer_name)}）<br><img src="/admin/barcode?code=${encodeURIComponent(order.customer_teraoka_code.trim())}&scale=3&height=14" alt="客戶條碼" class="os-cust-bc"></p>`
                : "";
            const brk = i < ids.length - 1 ? "page-break-after:always;" : "";
            parts.push(`
        <div class="order-sheet-batch-block order-sheet-print" style="${brk} margin-bottom:2rem;">
        <div class="order-sheet-inner">
        <div class="order-sheet-head">
          <div class="order-sheet-head-L">
            <h1>訂貨單</h1>
            <p class="os-meta">訂單編號：${escapeHtml(order.order_no ?? "—")}　日期：${escapeHtml(order.order_date)}　客戶：${escapeHtml(order.customer_name)}</p>
          </div>
          ${orderBcImg}
        </div>
          <table>
            <colgroup><col style="width:10%"><col style="width:40%"><col style="width:10%"><col style="width:10%"><col style="width:30%"></colgroup>
            <thead><tr><th>料號</th><th>品名</th><th>數量</th><th>單位</th><th>備註</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='5'>無品項</td></tr>"}</tbody>
          </table>
        ${customerBarcode ? `<div style="margin-top:1rem;">${customerBarcode}</div>` : ""}
        </div>
        </div>`);
        }
        if (!parts.length) {
            res.status(404).type("text/html").send("<!DOCTYPE html><html><body><p>找不到選取的訂單。</p><a href=\"/admin/orders\">回訂單查詢</a></body></html>");
            return;
        }
        const tsSheet = new Date().toISOString();
        for (const oid of ids) {
            try {
                await db.prepare("UPDATE orders SET sheet_exported_at = ? WHERE id = ?").run(tsSheet, oid);
            }
            catch (e) {
                console.error("[admin] sheet_exported_at update", oid, e?.message || e);
            }
        }
        const sheetBody = `
        ${orderSheetPrintStyle}
        <p class="no-print notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單查詢</a> / 合併揀貨單</p>
        ${parts.join("\n")}
        <p class="no-print" style="margin-top:1rem;"><a href="/admin/orders">← 回訂單查詢</a></p>
      `;
        const meta = firstOrderMeta || { date: new Date().toISOString().slice(0, 10), customer: "客戶", orderNo: "01" };
        const safeCustomer = String(meta.customer).replace(/[\\/:*?"<>|]/g, "_").trim() || "客戶";
        const seq = String(meta.orderNo || "01").replace(/[^\d]/g, "").slice(-2) || "01";
        const dlName = `${meta.date}_${safeCustomer}_${seq}_揀貨單.html`;
        res.setHeader("Content-Disposition", "attachment; filename=\"" + dlName + "\"");
        res.type("text/html").send(notionPage("合併揀貨單", sheetBody, "", res));
    });
    /** 凌越 Excel 儲存格：避免 null／不可列印字元導致 xlsx 寫入失敗 */
    function cellForLingyueXlsx(v) {
        if (v == null || v === undefined)
            return "";
        if (typeof v === "number") {
            if (!Number.isFinite(v))
                return "";
            return v;
        }
        if (typeof v === "bigint")
            return String(v);
        let s = String(v);
        if (s.indexOf("\u0000") >= 0)
            s = s.replace(/\u0000/g, "");
        return s;
    }
    /** 訂單日期 → 凌越欄位用 YYYY/MM/DD（DB 可能回傳字串或 Date） */
    function formatOrderDateForLingyue(d) {
        if (d == null || d === "")
            return "";
        if (d instanceof Date)
            return d.toISOString().slice(0, 10).replace(/-/g, "/");
        const s = String(d).trim();
        const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (iso)
            return iso[1].replace(/-/g, "/");
        return s.replace(/-/g, "/");
    }
    /** 下載檔名用日期（僅 YYYY-MM-DD，避免 Date 字串含冒號／斜線） */
    function safeFilenameOrderDate(d) {
        if (d == null || d === "")
            return new Date().toISOString().slice(0, 10);
        if (d instanceof Date)
            return d.toISOString().slice(0, 10);
        const s = String(d).trim();
        const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (iso)
            return iso[1];
        const m = s.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
        if (m)
            return `${m[1]}-${m[2]}-${m[3]}`;
        return new Date().toISOString().slice(0, 10);
    }
    function bufferFromXlsxWrite(buf) {
        if (buf == null)
            throw new Error("Excel 產生失敗（write 未回傳內容）");
        if (Buffer.isBuffer(buf))
            return buf;
        if (buf instanceof Uint8Array)
            return Buffer.from(buf);
        if (buf instanceof ArrayBuffer)
            return Buffer.from(buf);
        return Buffer.from(buf);
    }
    /** 多筆訂單合併為同一個 xlsx：僅第 1 列表頭，明細依訂單順序（每張訂單一個 DocNo）；訂單排序：日期 → 訂單編號 → id */
    async function sendMergedLingyueXlsx(res, inputIds) {
        const seen = new Set();
        const ids = [];
        for (const x of inputIds || []) {
            const id = String(x || "").trim();
            if (!id || seen.has(id))
                continue;
            seen.add(id);
            ids.push(id);
            if (ids.length >= 50)
                break;
        }
        if (!ids.length) {
            res.status(400).type("text/plain").send("請先勾選訂單");
            return;
        }
        try {
            const placeholders = ids.map(() => "?").join(",");
            const sortedRows = await db.prepare(`
      SELECT o.id FROM orders o WHERE o.id IN (${placeholders})
      ORDER BY o.order_date ASC, o.order_no ASC, o.id ASC
    `).all(...ids);
            const sortedIds = (sortedRows || []).map((r) => r.id).filter(Boolean);
            if (!sortedIds.length) {
                res.status(404).type("text/plain").send("找不到勾選的訂單");
                return;
            }
            const header = [
                "OrderDate",
                "DocNo",
                "CustomerCode",
                "",
                "ProductCode",
                "ProductName",
                "Unit",
                "Quantity",
                "ItemNote",
                "DocRemark",
            ];
            const dataRows = [];
            let docSeq = 1;
            for (const orderId of sortedIds) {
                const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.raw_message, c.name AS customer_name, c.hq_cust_code, c.teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
                if (!order)
                    continue;
                const customerCode = (order.hq_cust_code && String(order.hq_cust_code).trim()) || (order.teraoka_code && String(order.teraoka_code).trim()) || "";
                const docRemark = "";
                const docNo = String(docSeq).padStart(4, "0");
                const orderDateLingyue = formatOrderDateForLingyue(order.order_date);
                const items = await db.prepare(`
      SELECT oi.quantity, oi.unit, oi.remark, oi.raw_name, p.erp_code, p.name AS product_name
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1)
      ORDER BY COALESCE(oi.display_order, 999999), oi.id
    `).all(orderId);
                for (const it of items) {
                    const qtyNum = it.quantity != null ? Number(it.quantity) : NaN;
                    const qty = Number.isFinite(qtyNum) ? qtyNum : "";
                    const itemNote = (it.remark && String(it.remark).trim()) || "";
                    const erp = (it.erp_code && String(it.erp_code).trim()) || "";
                    const productName = (it.product_name && String(it.product_name).trim()) || (it.raw_name && String(it.raw_name).trim()) || "";
                    dataRows.push([
                        cellForLingyueXlsx(orderDateLingyue),
                        cellForLingyueXlsx(docNo),
                        cellForLingyueXlsx(customerCode),
                        "",
                        cellForLingyueXlsx(erp),
                        cellForLingyueXlsx(productName),
                        cellForLingyueXlsx((it.unit && String(it.unit).trim()) || "公斤"),
                        cellForLingyueXlsx(qty),
                        cellForLingyueXlsx(itemNote),
                        cellForLingyueXlsx(docRemark),
                    ]);
                }
                docSeq += 1;
            }
            if (!dataRows.length) {
                res.status(404).type("text/plain").send("無可匯出之明細");
                return;
            }
            const tsLingyue = new Date().toISOString();
            for (const oid of sortedIds) {
                try {
                    await db.prepare("UPDATE orders SET lingyue_exported_at = ? WHERE id = ?").run(tsLingyue, oid);
                }
                catch (e) {
                    console.error("[admin] lingyue_exported_at update", oid, e?.message || e);
                }
            }
            const aoa = [header, ...dataRows];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            XLSX.utils.book_append_sheet(wb, ws, "凌越訂單");
            const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
            const bin = bufferFromXlsxWrite(buf);
            let fname;
            if (sortedIds.length === 1) {
                const firstOrder = await db.prepare(`
      SELECT o.order_date, c.name AS customer_name, o.order_no, o.id
      FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `).get(sortedIds[0]);
                const fDate = safeFilenameOrderDate(firstOrder?.order_date);
                const fCust = String(firstOrder?.customer_name || "客戶").replace(/[\\/:*?"<>|]/g, "_").trim() || "客戶";
                const fNo = String(firstOrder?.order_no || firstOrder?.id || "01").replace(/[^\d]/g, "").slice(-2) || "01";
                fname = `${fDate}_${fCust}_${fNo}_凌越訂單.xlsx`;
            }
            else {
                const rangeRow = await db.prepare(`
      SELECT MIN(o.order_date) AS dmin FROM orders o WHERE o.id IN (${sortedIds.map(() => "?").join(",")})
    `).get(...sortedIds);
                const fDate = safeFilenameOrderDate(rangeRow?.dmin);
                const safeDate = String(fDate).replace(/[\\/:*?"<>|]/g, "_");
                fname = `${safeDate}_凌越訂單_合併${sortedIds.length}筆.xlsx`;
            }
            res.setHeader("Content-Disposition", "attachment; filename=\"" + fname + "\"");
            res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(bin);
        }
        catch (e) {
            const detail = String(e?.message || e || "unknown").slice(0, 500);
            console.error("[admin] sendMergedLingyueXlsx", detail, e?.stack);
            if (!res.headersSent) {
                res.status(500).type("text/plain; charset=utf-8").send("匯出失敗：" + detail + "\n\n若為一次勾選過多訂單，請改分批；Cloud Run 請將請求逾時設為至少 300 秒。");
            }
        }
    }
    router.get("/orders/batch-lingyue-xlsx", async (req, res) => {
        const raw = (req.query.ids || "").toString();
        const ids = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        await sendMergedLingyueXlsx(res, ids);
    });
    router.post("/orders/batch-lingyue-xlsx", express_1.default.urlencoded({ extended: true, limit: "2mb" }), async (req, res) => {
        let ids = req.body.order_ids;
        if (ids == null)
            ids = [];
        if (!Array.isArray(ids))
            ids = [ids];
        ids = ids.map((x) => String(x).trim()).filter(Boolean);
        if (!ids.length && typeof req.body.ids === "string") {
            ids = req.body.ids.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
        }
        await sendMergedLingyueXlsx(res, ids);
    });
    router.get("/orders/:orderId", async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "/admin/orders?date_from=" + encodeURIComponent(getTaipeiCalendarDateYYYYMMDD()) + "&date_to=" + encodeURIComponent(getTaipeiCalendarDateYYYYMMDD());
        const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.raw_message, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.remark, oi.display_order, oi.need_review, oi.sub_customer,
        p.id AS product_id, p.erp_code, p.name AS product_name
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
      ORDER BY COALESCE(oi.display_order, 999999), oi.id
    `).all(orderId);
        const attachments = await db.prepare("SELECT id, line_message_id FROM order_attachments WHERE order_id = ?").all(orderId);
        const needReviewCount = items.filter((i) => i.need_review === 1).length;
        const needReviewNote = needReviewCount > 0
            ? `<p class="notion-msg err" style="margin:8px 0;"><strong>${needReviewCount}</strong> 項待確認 · <a href="/admin/review">待確認清單</a></p>`
            : "";
        const prevOrder = await db.prepare(`
      SELECT id FROM orders
      WHERE (order_date > ? OR (order_date = ? AND id > ?))
      ORDER BY order_date ASC, id ASC
      LIMIT 1
    `).get(order.order_date, order.order_date, order.id);
        const nextOrder = await db.prepare(`
      SELECT id FROM orders
      WHERE (order_date < ? OR (order_date = ? AND id < ?))
      ORDER BY order_date DESC, id DESC
      LIMIT 1
    `).get(order.order_date, order.order_date, order.id);
        const units = ORDER_LINE_UNITS;
        const unitOptions = units.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("");
        const itemsRows = items
            .map((i, idx) => {
            const q = Number(i.quantity);
            const u = (i.unit && i.unit.trim()) || "";
            const unitSelect = `<select name="unit_${i.item_id}" form="itemsForm">${unitOptions}</select>`;
            const unitSelectWithVal = units.includes(u)
                ? `<select name="unit_${i.item_id}" form="itemsForm"><option value="">—</option>${units.map((x) => `<option value="${escapeAttr(x)}" ${x === u ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}</select>`
                : `<select name="unit_${i.item_id}" form="itemsForm"><option value="">—</option>${unitOptions}</select>`;
            const erp = i.erp_code ?? "—";
            const pname = i.product_name ? escapeHtml(i.product_name) : "";
            const pid = i.product_id ? String(i.product_id) : "";
            const nameEditLink = pid && pname
                ? `<a href="#" class="product-name-edit" data-product-id="${escapeAttr(pid)}" title="編輯此品項（俗名、單位等）">${pname}</a>`
                : pname;
            const productCell = i.need_review === 1
                ? `<a href="#" class="product-pick need-review" data-item-id="${escapeAttr(i.item_id)}" data-raw="${escapeAttr(i.raw_name || "")}">待確認</a>`
                : `<span class="order-final-product">${nameEditLink}</span> <a href="#" class="product-pick product-change" data-item-id="${escapeAttr(i.item_id)}">改品項</a>`;
            const remarkVal = (i.remark && i.remark.trim()) ? escapeAttr(i.remark.trim()) : "";
            const subCustomerVal = (i.sub_customer && String(i.sub_customer).trim()) ? escapeAttr(String(i.sub_customer).trim()) : "";
            const rowClasses = i.need_review === 1 ? "order-item-need-review" : "";
            const rawCard = `${idx + 1}. 原始：${String(i.raw_name ?? "").trim() || "—"} ${String(q)}${(i.unit && i.unit.trim()) || ""}`;
            return `<tr data-item-id="${escapeAttr(i.item_id)}" data-raw-name="${escapeAttr(i.raw_name ?? "")}" data-line-unit="${escapeAttr((i.unit && i.unit.trim()) || "")}" data-raw-card="${escapeAttr(rawCard)}" class="${escapeAttr(rowClasses)}">
            <td class="order-detail-col-sort">
              <span class="item-sort-stack">
                <button type="button" class="btn btn-move-up" title="上移">↑</button>
                <button type="button" class="btn btn-move-down" title="下移">↓</button>
              </span>
            </td>
            <td class="order-detail-col-idx"><span class="order-detail-idx-num">${idx + 1}</span></td>
            <td class="order-table-col-system"><span class="order-final-erp">${escapeHtml(erp)}</span></td>
            <td>${productCell}</td>
            <td><input type="text" name="sub_customer_${i.item_id}" form="itemsForm" value="${subCustomerVal}" placeholder="子客戶" style="width:100%;max-width:7rem;"></td>
            <td><input type="number" class="order-detail-qty-input" name="qty_${i.item_id}" form="itemsForm" value="${escapeAttr(String(q))}" step="any" min="0"></td>
            <td>${unitSelectWithVal}</td>
            <td><input type="text" name="remark_${i.item_id}" form="itemsForm" value="${remarkVal}" placeholder="備註" style="width:100%;max-width:100px;"></td>
            <td><button type="button" class="btn btn-delete-item order-del-btn order-del-btn-icon" data-item-id="${escapeAttr(i.item_id)}" data-order-id="${escapeAttr(orderId)}" title="刪除此列" aria-label="刪除此列">×</button></td>
          </tr>`;
        })
            .join("");
        const orderStatusLc = String(order.status || "").toLowerCase();
        const orderStatusDisplay = orderStatusLc === "approved" ? "已確認" : orderStatusLc === "pending" ? "待確認" : orderStatusLc === "deleted" ? "已刪除" : escapeHtml(String(order.status || ""));
        const confirmOrderFormHtml = orderStatusLc === "approved"
            ? `<form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/unapprove?back=${encodeURIComponent(backTo)}" style="display:inline;margin:0;flex:0 0 auto;"><button type="submit" class="btn btn-cute-approve" title="再按一次可撤銷確認" onclick="return confirm('確定要撤銷確認？訂單將恢復為待確認。');">已確認</button></form>`
            : `<form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/approve?back=${encodeURIComponent(backTo)}" style="display:inline;margin:0;flex:0 0 auto;"><button type="submit" class="btn btn-cute-approve">確認</button></form>`;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單查詢</a> / 訂單明細</div>
        <h1 class="notion-page-title" style="margin-bottom:6px;">訂單明細</h1>
        <p style="margin:0 0 10px;color:var(--notion-text-secondary, #555);font-size:14px;">${escapeHtml(order.order_no ?? "—")} · ${escapeHtml(order.order_date)} · <a href="/admin/customers/${encodeURIComponent(order.customer_id)}/quick-view?from=orders">${escapeHtml(order.customer_name)}</a> · ${orderStatusDisplay}</p>
        ${needReviewNote}
        ${req.query.ok === "product" ? "<p class=\"notion-msg ok\">已更新。</p>" : ""}
        ${req.query.ok === "prod_edit" ? "<p class=\"notion-msg ok\">已儲存品項。</p>" : ""}
        ${req.query.ok === "approved" ? "<p class=\"notion-msg ok\">已標記為已確認。</p>" : ""}
        ${req.query.ok === "unconfirmed" ? "<p class=\"notion-msg ok\">已撤銷確認。</p>" : ""}
        ${req.query.ok === "rerecog" ? "<p class=\"notion-msg ok\">已重新辨識明細。</p>" : ""}
        ${req.query.ok === "raw_applied" ? "<p class=\"notion-msg ok\">已補登並解析。</p>" : ""}
        ${req.query.err === "product" ? "<p class=\"notion-msg err\">請選擇有效品項。</p>" : ""}
        ${req.query.err === "rerecog" ? "<p class=\"notion-msg err\">重新辨識失敗：無法從文字或圖片解析出品項。圖片訂單請確認已設定 LINE_CHANNEL_ACCESS_TOKEN，並至少設定 GOOGLE_CLOUD_VISION_API_KEY 或 GOOGLE_GEMINI_API_KEY／GEMINI_API_KEY。</p>" : ""}
        ${req.query.err === "rerecog_line" ? "<p class=\"notion-msg err\">重新辨識失敗：訂單有圖片附件，但未設定 LINE_CHANNEL_ACCESS_TOKEN，無法向 LINE 取回圖片。</p>" : ""}
        ${req.query.err === "rerecog_vision" ? "<p class=\"notion-msg err\">重新辨識失敗：有圖片附件但無法辨識。請設定 Cloud Vision 或 Gemini API 金鑰。</p>" : ""}
        ${req.query.err === "apply_raw_empty" ? "<p class=\"notion-msg err\">請貼上內容後再送出。</p>" : ""}
        ${req.query.err === "apply_raw_parse" ? "<p class=\"notion-msg err\">無法解析。請改內容或檢查 Gemini API 金鑰。</p>" : ""}
        <p style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 8px;">
          <a href="${escapeAttr(backTo)}" class="btn">← 回上層列表</a>
          ${prevOrder ? `<a href="/admin/orders/${encodeURIComponent(prevOrder.id)}?back=${encodeURIComponent(backTo)}" class="btn">上一筆</a>` : ""}
          ${nextOrder ? `<a href="/admin/orders/${encodeURIComponent(nextOrder.id)}?back=${encodeURIComponent(backTo)}" class="btn">下一筆</a>` : ""}
          ${(orderStatusLc === "approved" && nextOrder) ? `<a href="/admin/orders/${encodeURIComponent(nextOrder.id)}?back=${encodeURIComponent(backTo)}" class="btn btn-cute-next">下一筆待確認</a>` : ""}
        </p>
        <p class="order-detail-toolbar-main" style="display:flex;flex-wrap:nowrap;gap:8px;align-items:center;margin:0 0 12px;overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;box-sizing:border-box;">
          ${confirmOrderFormHtml}
          <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/re-recognize?back=${encodeURIComponent(backTo)}" style="display:inline;margin:0;flex:0 0 auto;">
            <button type="submit" class="btn btn-cute-rerecog" title="依原始文字與 LINE 圖片附件重建明細（覆寫現有品項）" onclick="return confirm('依原始訂單重建明細？將覆寫現有品項。');">重新辨識</button>
          </form>
          <button type="button" id="btn-save-example" class="btn btn-info" title="將目前畫面上的明細與附件圖存為該客戶 Few-Shot 範例（多張附件時以第一張為準）" style="flex:0 0 auto;white-space:nowrap;" ${attachments.length === 0 ? "disabled" : ""}>🎓 儲存為本客戶的 AI 學習範例</button>
          <a href="/admin/orders/batch-lingyue-xlsx?ids=${encodeURIComponent(orderId)}" class="btn btn-cute-lingyue" style="flex:0 0 auto;white-space:nowrap;">匯出凌越</a>
          <a href="/admin/orders/${encodeURIComponent(orderId)}/order-sheet?preview=1" class="btn btn-cute-preview" style="flex:0 0 auto;white-space:nowrap;">預覽訂單</a>
          <a href="/admin/orders/${encodeURIComponent(orderId)}/order-sheet?download=1" class="btn btn-cute-ordersheet" style="flex:0 0 auto;white-space:nowrap;">匯出訂貨單</a>
        </p>
        ${attachments.length > 0 ? `<p style="margin:0 0 10px;font-size:13px;">附件 ${attachments.length} 張：${attachments.map((a, idx) => `<a href="/admin/orders/${encodeURIComponent(orderId)}/attachment/${encodeURIComponent(a.line_message_id)}" target="_blank" rel="noopener">圖${idx + 1}</a>`).join(" · ")}</p>` : ""}
        <div class="order-detail-layout">
        <aside class="order-detail-raw-col" aria-label="原始訂單對照">
          <div class="order-detail-raw-inner notion-card raw-message-scroll" id="rawOrderBlock">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <div>
              <h3 class="order-detail-raw-title">原始訂單</h3>
              <p class="order-detail-raw-sticky-hint">寬螢幕捲動明細時，此區塊會固定在左側方便核對。</p>
            </div>
            <button type="button" class="btn" id="pasteRawToggleBtn" aria-expanded="false" aria-controls="pasteRaw" style="padding:4px 10px;font-size:12px;">補登／修正</button>
          </div>
          <div class="order-detail-raw-pre-wrap"><pre>${escapeHtml(order.raw_message ?? "")}</pre></div>
          <div id="pasteRaw" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--notion-border);">
            <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/apply-raw-text?back=${encodeURIComponent(backTo)}" style="margin:0;">
              <textarea name="pasted_raw" rows="5" style="width:100%;box-sizing:border-box;font-size:13px;" placeholder="貼上叫貨全文（會覆寫明細）" required title="送出後依全文重建明細"></textarea>
              <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:8px 0 0;font-size:12px;">
                <label style="margin:0;"><input type="radio" name="merge_mode" value="replace" checked> 取代整段</label>
                <label style="margin:0;"><input type="radio" name="merge_mode" value="append"> 接到後面</label>
              </div>
              <p style="margin:8px 0 0;"><button type="submit" class="btn btn-primary" onclick="return confirm('依新全文重建明細？現有品項將刪除後重算。');">儲存並解析</button></p>
            </form>
          </div>
          </div>
        </aside>
        <div class="order-detail-main-col">
        <form id="itemsForm" method="post" action="/admin/orders/${encodeURIComponent(orderId)}/items" novalidate>
          <div class="notion-card" id="items">
            <p style="margin:0 0 10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button type="submit" class="btn btn-cute-save" id="itemsSaveBtnTop" title="儲存數量、單位、備註與排序">儲存明細</button>
            </p>
            <p class="order-legend"><span class="order-legend-swatch sw-need"></span>待確認</p>
            <div class="table-scroll-mobile"><table class="order-detail-table" style="font-size:12px;">
              <thead><tr><th class="order-detail-th-sort" title="順序（上移／下移）"></th><th class="order-detail-th-idx">項次</th><th class="order-table-col-system">料號</th><th>品名</th><th>子客戶/分店</th><th style="width:3.5rem;">數量</th><th>單位</th><th>備註</th><th style="width:2.75rem;">刪除</th></tr></thead>
              <tbody>${itemsRows}</tbody>
              <tr><td colspan="9" style="background:var(--notion-sidebar);padding:6px;"><a href="/admin/orders/${encodeURIComponent(orderId)}/items/add" class="btn">＋ 增加品項</a></td></tr>
            </table></div>
            <p style="margin:10px 0 0;"><button type="submit" class="btn btn-cute-save" title="儲存數量、單位、備註與排序">儲存明細</button></p>
          </div>
        </form>
        </div>
        </div>
        <div id="productModal" class="notion-modal-overlay" style="display:none;">
          <div class="notion-modal">
            <h3>選擇品項（模糊搜尋）</h3>
            <input type="search" class="notion-modal-search" id="productSearch" placeholder="輸入品名、料號、條碼...">
            <div class="notion-modal-list" id="productList"></div>
            <div class="notion-modal-actions"><button type="button" class="btn" onclick="document.getElementById('productModal').style.display='none'">取消</button></div>
          </div>
        </div>
        <div id="productEditModal" class="notion-modal-overlay" style="display:none;">
          <div class="notion-modal notion-modal-embed">
            <div class="notion-modal-embed-hd">
              <span>編輯品項</span>
              <button type="button" class="btn" id="productEditModalClose">關閉</button>
            </div>
            <iframe id="productEditFrame" title="編輯品項" src="about:blank"></iframe>
          </div>
        </div>
        <script>
        (function(){
          var orderId = ${JSON.stringify(orderId)};
          var firstAttachmentId = ${JSON.stringify(attachments[0]?.id ?? null)};
          var returnPath = '/admin/orders/' + encodeURIComponent(orderId) + '#items';
          var modal = document.getElementById('productModal');
          var editModal = document.getElementById('productEditModal');
          var editFrame = document.getElementById('productEditFrame');
          var editModalClose = document.getElementById('productEditModalClose');
          var listEl = document.getElementById('productList');
          var searchEl = document.getElementById('productSearch');
          var currentItemId = null;
          var formDirty = false;
          function openProductEdit(productId, ctx){
            if (!productId || !editModal || !editFrame) return;
            var u = '/admin/products/' + encodeURIComponent(productId) + '/edit?embed=1&return=' + encodeURIComponent(returnPath);
            if (ctx && ctx.raw) u += '&context_raw=' + encodeURIComponent(ctx.raw);
            if (ctx && ctx.unit) u += '&context_unit=' + encodeURIComponent(ctx.unit);
            editFrame.src = u;
            editModal.style.display = 'flex';
          }
          function closeProductEdit(){
            if (editModal) editModal.style.display = 'none';
            if (editFrame) editFrame.src = 'about:blank';
          }
          if (editModalClose) editModalClose.addEventListener('click', closeProductEdit);
          if (editModal) editModal.addEventListener('click', function(e){ if (e.target === editModal) closeProductEdit(); });
          var btnSaveExample = document.getElementById('btn-save-example');
          if (btnSaveExample) {
            btnSaveExample.addEventListener('click', function(){
              if (!firstAttachmentId) {
                alert('此訂單無圖片附件，無法存為 AI 視覺範例。');
                return;
              }
              if (!confirm('請確認目前畫面上的品項與數量皆已 100% 正確。是否將此單存為該客戶的 AI 辨識範例？')) return;
              btnSaveExample.disabled = true;
              fetch('/admin/api/orders/' + encodeURIComponent(orderId) + '/save-as-example', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ attachment_id: firstAttachmentId, quality_score: 100 })
              })
                .then(function(r){
                  return r.text().then(function(t){
                    try { return { ok: r.ok, status: r.status, j: JSON.parse(t) }; } catch (e) { return { ok: false, status: r.status, j: { ok: false, error: t || ('HTTP ' + r.status) } }; }
                  });
                })
                .then(function(x){
                  btnSaveExample.disabled = false;
                  if (x.ok && x.j && x.j.ok) {
                    alert('儲存成功');
                  } else {
                    var errMsg = (x.j && (x.j.error || x.j.message)) ? String(x.j.error || x.j.message) : ('HTTP ' + (x.status || ''));
                    alert('儲存失敗: ' + errMsg);
                  }
                })
                .catch(function(err){
                  btnSaveExample.disabled = false;
                  alert('儲存失敗: ' + (err && err.message ? err.message : '請稍後再試'));
                });
            });
          }
          function searchProducts(q){
            fetch('/admin/api/products-search?q=' + encodeURIComponent(q)).then(function(r){ return r.json(); }).then(function(arr){
              listEl.innerHTML = arr.map(function(p){
                return '<div data-product-id="' + (p.id || '') + '" class="product-option">' + (p.name || '') + ' ' + (p.erp_code || '') + ' ' + (p.teraoka_barcode || '') + '</div>';
              }).join('') || '<div>無符合品項</div>';
            });
          }
          searchProducts('');
          searchEl.oninput = function(){ searchProducts(searchEl.value); };
          document.addEventListener('click', function(e){
            var nameEdit = e.target.closest('.product-name-edit');
            if (nameEdit) {
              e.preventDefault();
              var tr = nameEdit.closest('tr');
              var raw = (tr && tr.getAttribute('data-raw-name')) || '';
              var uu = (tr && tr.getAttribute('data-line-unit')) || '';
              openProductEdit(nameEdit.getAttribute('data-product-id'), { raw: raw, unit: uu });
              return;
            }
            var pick = e.target.closest('.product-pick');
            if (pick) { e.preventDefault(); currentItemId = pick.getAttribute('data-item-id'); modal.style.display = 'flex'; searchEl.value = pick.getAttribute('data-raw') || ''; searchProducts(searchEl.value); }
          });
          listEl.addEventListener('click', function(e){
            var div = e.target.closest('.product-option');
            if (!div || !currentItemId) return;
            var productId = div.getAttribute('data-product-id');
            if (!productId) return;
            modal.style.display = 'none';
            var url = '/admin/orders/' + encodeURIComponent(orderId) + '/items/' + encodeURIComponent(currentItemId) + '/product';
            var body = 'product_id=' + encodeURIComponent(productId);
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: body })
              .then(function(r){ return r.json(); })
              .then(function(data){
                if (data && data.ok && data.productName !== undefined) {
                  var tr = document.querySelector('tr[data-item-id="' + currentItemId.replace(/"/g, '\\"') + '"]');
                  var pid = (data.productId || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                  var pnm = (data.productName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  var namePart = pid ? ('<a href="#" class="product-name-edit" data-product-id="' + pid + '" title="編輯此品項（俗名、單位等）">' + pnm + '</a>') : pnm;
                  if (tr && tr.cells[3]) tr.cells[3].innerHTML = namePart + ' <a href="#" class="product-pick product-change" data-item-id="' + currentItemId.replace(/"/g, '&quot;') + '">改品項</a>';
                } else { alert(data && data.error ? data.error : '更新失敗'); }
              })
              .catch(function(){ alert('請求失敗'); });
          });
          document.addEventListener('click', function(e){
            var up = e.target.closest('.btn-move-up');
            if (up) {
              var trU = up.closest('tr');
              if (trU && trU.previousElementSibling) {
                trU.parentNode.insertBefore(trU, trU.previousElementSibling);
                formDirty = true;
              }
              return;
            }
            var down = e.target.closest('.btn-move-down');
            if (down) {
              var trD = down.closest('tr');
              if (trD && trD.nextElementSibling) {
                trD.parentNode.insertBefore(trD.nextElementSibling, trD);
                formDirty = true;
              }
              return;
            }
            var btn = e.target.closest('.btn-delete-item');
            if (!btn) return;
            var itemId = btn.getAttribute('data-item-id');
            var ordId = btn.getAttribute('data-order-id');
            if (!itemId || !ordId || !confirm('確定要刪除此筆明細？')) return;
            var url = '/admin/orders/' + encodeURIComponent(ordId) + '/items/' + encodeURIComponent(itemId) + '/delete';
            fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
              .then(function(r){ return r.json(); })
              .then(function(data){ if (data && data.ok) { var tr = btn.closest('tr'); if (tr) tr.remove(); } else { alert(data && data.error ? data.error : '刪除失敗'); } })
              .catch(function(){ alert('請求失敗'); });
          });
          var itemsForm = document.getElementById('itemsForm');
          if (itemsForm) {
            itemsForm.addEventListener('change', function(){ formDirty = true; });
            itemsForm.addEventListener('input', function(){ formDirty = true; });
            itemsForm.addEventListener('submit', function(e){
              e.preventDefault();
              var btn = itemsForm.querySelector('button[type="submit"]');
              var origText = btn ? btn.textContent : '';
              if (btn) { btn.disabled = true; btn.textContent = '儲存中…'; }
              var formData = new FormData(itemsForm);
              var params = new URLSearchParams(formData);
              var seq = 1;
              itemsForm.querySelectorAll('tbody tr[data-item-id]').forEach(function(tr){
                var id = tr.getAttribute('data-item-id');
                if (id) { params.append('ord_' + id, String(seq)); seq++; }
              });
              fetch(itemsForm.action, { method: 'POST', body: params, headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } })
                .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
                .then(function(result){
                  if (btn) { btn.disabled = false; btn.textContent = origText; }
                  if (result.ok && result.data && result.data.ok) {
                    formDirty = false;
                    var msg = document.getElementById('itemsFormSavedMsg');
                    if (!msg) { msg = document.createElement('p'); msg.id = 'itemsFormSavedMsg'; msg.className = 'notion-msg ok'; itemsForm.querySelector('.notion-card').appendChild(msg); }
                    msg.textContent = '已儲存。';
                    msg.style.display = 'block';
                    setTimeout(function(){ msg.style.display = 'none'; }, 3000);
                  } else {
                    alert(result.data && result.data.error ? result.data.error : '儲存失敗，請稍後再試。');
                  }
                })
                .catch(function(){
                  if (btn) { btn.disabled = false; btn.textContent = origText; }
                  alert('儲存請求失敗，請稍後再試。');
                });
            });
          }
          window.addEventListener('beforeunload', function(e){
            if (!formDirty) return;
            e.preventDefault();
            e.returnValue = '';
          });
          document.addEventListener('submit', function(e){
            var f = e.target;
            if (!formDirty || !f || f.tagName !== 'FORM') return;
            if (f.id === 'itemsForm') return;
            if (!confirm('明細有尚未儲存的變更，確定要離開此頁？')) e.preventDefault();
          }, true);
          document.addEventListener('click', function(e){
            var a = e.target.closest('a');
            if (!a || !formDirty) return;
            var href = a.getAttribute('href') || '';
            if (!href || href.startsWith('#')) return;
            if (confirm('明細有尚未儲存的變更，確定要離開此頁？')) return;
            e.preventDefault();
          }, true);
          var pasteBtn = document.getElementById('pasteRawToggleBtn');
          var pastePanel = document.getElementById('pasteRaw');
          function setPasteOpen(open){
            if (!pastePanel || !pasteBtn) return;
            pastePanel.style.display = open ? 'block' : 'none';
            pasteBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            pasteBtn.textContent = open ? '收合' : '補登／修正';
          }
          if (pasteBtn && pastePanel) {
            pasteBtn.addEventListener('click', function(){
              var hidden = window.getComputedStyle(pastePanel).display === 'none';
              setPasteOpen(hidden);
            });
            var qs = window.location.search || '';
            var h = (window.location.hash || '').replace(/^#/, '');
            if (h === 'pasteRaw' || /err=apply_raw/.test(qs)) setPasteOpen(true);
          }
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("訂單明細", body, "", res));
    });
    router.get("/orders/:orderId/attachment/:messageId", async (req, res) => {
        const { orderId, messageId } = req.params;
        const att = await db.prepare("SELECT id FROM order_attachments WHERE order_id = ? AND line_message_id = ?").get(orderId, messageId);
        if (!att) {
            res.status(404).send("找不到該附件");
            return;
        }
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!token) {
            res.status(503).send("未設定 LINE Channel Access Token，無法取得圖片");
            return;
        }
        try {
            const resp = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!resp.ok) {
                res.status(resp.status).send("無法取得 LINE 圖片");
                return;
            }
            const contentType = resp.headers.get("content-type") || "image/jpeg";
            res.setHeader("Content-Type", contentType);
            const buf = await resp.arrayBuffer();
            res.send(Buffer.from(buf));
        }
        catch (e) {
            console.error("[admin] 取得 LINE 圖片失敗:", e?.message || e);
            res.status(500).send("取得圖片時發生錯誤");
        }
    });
    router.post("/orders/:orderId/re-recognize", async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "/admin/orders";
        const redirErr = (code) => {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=" + encodeURIComponent(code) + "&back=" + encodeURIComponent(backTo) + "#items");
        };
        try {
            const order = await db.prepare("SELECT id, customer_id, raw_message FROM orders WHERE id = ?").get(orderId);
            if (!order) {
                res.status(404).send("訂單不存在");
                return;
            }
            const attachments = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ? ORDER BY created_at ASC").all(orderId);
            const result = await rebuildOrderItemsForReRecognize(orderId, order.customer_id, order.raw_message, attachments);
            if (!result.ok) {
                redirErr(result.error === "line_token" ? "rerecog_line" : result.error === "no_vision" ? "rerecog_vision" : "rerecog");
                return;
            }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=rerecog&back=" + encodeURIComponent(backTo) + "#items");
        }
        catch (e) {
            console.error("[admin] re-recognize failed", e?.message || e, e?.stack);
            redirErr("rerecog");
        }
    });
    /** 手動將訂單附件圖 + 目前明細存為 Few-Shot 範例（圖檔存於 data/few-shot-examples，DB 僅存 image_path） */
    router.post("/orders/:orderId/few-shot-example", express_1.default.json(), express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || (req.get("Accept") || "").includes("application/json");
        try {
            const attachmentId = String(req.body?.attachment_id ?? "").trim();
            const qualityRaw = req.body?.quality_score;
            const note = String(req.body?.note ?? "").trim().slice(0, 500);
            const qualityScore = qualityRaw != null && qualityRaw !== "" ? parseFloat(String(qualityRaw)) : 1;
            if (!attachmentId) {
                if (wantsJson) {
                    res.status(400).json({ ok: false, error: "缺少 attachment_id（order_attachments 資料表 id）" });
                    return;
                }
                res.status(400).send("缺少 attachment_id");
                return;
            }
            const result = await few_shot_example_save_js_1.saveFewShotExampleFromOrderAttachment(db, {
                orderId,
                attachmentId,
                qualityScore,
                note,
            });
            if (wantsJson) {
                res.json({ ok: true, ...result });
                return;
            }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=few_shot#items");
        }
        catch (e) {
            console.error("[admin] few-shot-example", e?.message || e);
            if (wantsJson) {
                res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 400) });
                return;
            }
            res.status(500).send("儲存 Few-Shot 範例失敗");
        }
    });
    /** JSON API：一鍵將訂單附件＋目前明細存為 Few-Shot（未傳 attachment_id 時使用該訂單第一張附件） */
    router.post("/api/orders/:orderId/save-as-example", express_1.default.json(), async (req, res) => {
        const { orderId } = req.params;
        try {
            let attachmentId = String(req.body?.attachment_id ?? "").trim();
            if (!attachmentId) {
                const row = await db.prepare("SELECT id FROM order_attachments WHERE order_id = ? ORDER BY COALESCE(created_at, '') ASC, id ASC LIMIT 1").get(orderId);
                attachmentId = row?.id ? String(row.id) : "";
            }
            if (!attachmentId) {
                res.status(400).json({ ok: false, error: "此訂單無圖片附件，無法存為視覺範例。" });
                return;
            }
            const qs = req.body?.quality_score;
            const qualityScore = qs != null && qs !== "" ? parseFloat(String(qs)) : 100;
            const note = String(req.body?.note ?? "").trim().slice(0, 500);
            const result = await few_shot_example_save_js_1.saveFewShotExampleFromOrderAttachment(db, {
                orderId,
                attachmentId,
                qualityScore: Number.isFinite(qualityScore) && qualityScore > 0 ? qualityScore : 100,
                note,
            });
            res.json({
                ok: true,
                message: "儲存成功",
                ...result,
            });
        }
        catch (e) {
            const msg = e && typeof e.message === "string" ? e.message : String(e ?? "unknown");
            console.error("[Save Example Error]", e);
            res.status(500).json({ ok: false, error: msg.slice(0, 800), message: msg.slice(0, 800) });
        }
    });
    /** AI Few-Shot 範例庫：列表（僅 is_active = 1） */
    router.get("/ai-examples", async (req, res) => {
        const okMsg = req.query.ok === "deleted" ? "<p class=\"notion-msg ok\">已停用該筆學習範本。</p>" : "";
        let rows = [];
        try {
            rows = await db
                .prepare(`SELECT e.id, e.customer_id, e.order_id, e.parsed_json, e.created_at, e.image_path, e.quality_score, e.note,
        COALESCE(NULLIF(TRIM(COALESCE(c.name, '')), ''), '（未知客戶）') AS customer_name
     FROM customer_order_image_examples e
     LEFT JOIN customers c ON c.id = e.customer_id
     WHERE COALESCE(e.is_active, 1) = 1
     ORDER BY e.created_at DESC`)
                .all();
            console.log("撈到的範例筆數:", Array.isArray(rows) ? rows.length : 0);
        }
        catch (e) {
            console.error("[Load Examples Error]", e);
            rows = [];
        }
        const previewParsed = (raw) => {
            const s = String(raw || "").trim();
            if (!s)
                return "—";
            const one = s.replace(/\s+/g, " ");
            const max = 320;
            return (one.length > max ? one.slice(0, max) + "…" : one);
        };
        const tableRows = (rows || [])
            .map((r) => {
            const oid = r.order_id || "";
            const oidDisp = oid ? `<a href="/admin/orders/${encodeURIComponent(oid)}">${escapeHtml(oid)}</a>` : "—";
            const created = r.created_at != null ? escapeHtml(String(r.created_at)) : "—";
            const noteCell = r.note && String(r.note).trim() ? escapeHtml(String(r.note).trim()) : "—";
            return `<tr data-example-id="${escapeAttr(r.id)}">
            <td><code style="font-size:11px;">${escapeHtml(r.id)}</code></td>
            <td>${escapeHtml(r.customer_name || "—")}</td>
            <td>${oidDisp}</td>
            <td style="white-space:nowrap;font-size:13px;">${created}</td>
            <td style="text-align:right;">${r.quality_score != null ? escapeHtml(String(r.quality_score)) : "—"}</td>
            <td style="max-width:min(420px, 50vw);font-size:12px;line-height:1.4;"><pre style="margin:0;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(previewParsed(r.parsed_json))}</pre></td>
            <td style="font-size:11px;color:var(--notion-text-muted);max-width:180px;word-break:break-all;">${escapeHtml(String(r.image_path || "").slice(0, 120))}${String(r.image_path || "").length > 120 ? "…" : ""}</td>
            <td style="font-size:12px;">${noteCell}</td>
            <td><button type="button" class="btn ai-example-del" data-id="${escapeAttr(r.id)}" style="white-space:nowrap;">🗑️ 刪除／停用此範本</button></td>
          </tr>`;
        })
            .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / AI 學習庫管理</div>
        <h1 class="notion-page-title">AI 學習庫管理</h1>
        <p class="notion-hint" style="margin-top:0;">列出已啟用之客戶訂單圖 Few-Shot 範例（<code>customer_order_image_examples</code>）。停用後將不再供 Gemini 視覺辨識使用，資料仍保留於資料庫。</p>
        ${okMsg}
        <div class="notion-card">
          <div class="table-scroll-mobile">
          <table style="font-size:13px;">
            <thead><tr>
              <th>範本 ID</th><th>客戶</th><th>來源訂單</th><th>建立時間</th><th style="text-align:right;">品質分</th>
              <th>JSON 明細預覽</th><th>圖片路徑</th><th>備註</th><th></th>
            </tr></thead>
            <tbody>${tableRows || "<tr><td colspan=\"9\">尚無啟用中的範例。</td></tr>"}</tbody>
          </table>
          </div>
        </div>
        <script>
        (function(){
          document.querySelectorAll(".ai-example-del").forEach(function(btn){
            btn.addEventListener("click", function(){
              var id = btn.getAttribute("data-id");
              if (!id || !confirm("確定要停用此筆 AI 學習範本？\\n（可維護資料品質，停用後不再用於辨識）")) return;
              btn.disabled = true;
              fetch("/admin/api/ai-examples/" + encodeURIComponent(id) + "/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                credentials: "same-origin",
                body: "{}"
              }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
              .then(function(x){
                if (x.j && x.j.ok) {
                  window.location.href = "/admin/ai-examples?ok=deleted";
                  return;
                }
                alert((x.j && x.j.error) ? x.j.error : "停用失敗");
                btn.disabled = false;
              })
              .catch(function(){ alert("網路錯誤"); btn.disabled = false; });
            });
          });
        })();
        </script>`;
        res.type("text/html").send(notionPage("AI 學習庫管理", body, "ai-examples", res));
    });
    /** 停用 Few-Shot 範例（is_active = 0） */
    router.post("/api/ai-examples/:id/delete", express_1.default.json(), async (req, res) => {
        const exampleId = String(req.params.id || "").trim();
        if (!exampleId) {
            res.status(400).json({ ok: false, error: "缺少範本 id" });
            return;
        }
        try {
            const row = await db.prepare("SELECT id FROM customer_order_image_examples WHERE id = ? AND is_active = 1").get(exampleId);
            if (!row) {
                res.status(404).json({ ok: false, error: "找不到此範本或已停用" });
                return;
            }
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            await db.prepare(`UPDATE customer_order_image_examples SET is_active = 0, updated_at = ${nowSql} WHERE id = ?`).run(exampleId);
            res.json({ ok: true });
        }
        catch (e) {
            console.error("[admin] ai-examples delete", e?.message || e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 400) });
        }
    });
    router.post("/orders/:orderId/apply-raw-text", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "/admin/orders";
        try {
            const order = await db.prepare("SELECT id, customer_id, raw_message FROM orders WHERE id = ?").get(orderId);
            if (!order) {
                res.status(404).send("訂單不存在");
                return;
            }
            const pasted = String(req.body?.pasted_raw ?? "").trim();
            if (!pasted) {
                res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=apply_raw_empty&back=" + encodeURIComponent(backTo) + "#pasteRaw");
                return;
            }
            const merge = String(req.body?.merge_mode || "replace").trim() === "append";
            const prev = String(order.raw_message || "").trim();
            const finalRaw = merge && prev ? `${prev}\n${pasted}` : pasted;
            await db.prepare("UPDATE orders SET raw_message = ? WHERE id = ?").run(finalRaw, orderId);
            const result = await rebuildOrderItemsFromRawText(orderId, order.customer_id, finalRaw);
            if (!result.ok) {
                res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=apply_raw_parse&back=" + encodeURIComponent(backTo) + "#pasteRaw");
                return;
            }
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=raw_applied&back=" + encodeURIComponent(backTo) + "#items");
        }
        catch (e) {
            console.error("[admin] apply-raw-text failed", e?.message || e, e?.stack);
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?err=apply_raw_parse&back=" + encodeURIComponent(backTo) + "#pasteRaw");
        }
    });
    router.post("/orders/:orderId/items", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest" || (req.get("Accept") || "").includes("application/json");
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            if (wantsJson) {
                res.status(404).json({ error: "訂單不存在" });
                return;
            }
            res.status(404).send("訂單不存在");
            return;
        }
        const body = req.body;
        const existingItems = await db.prepare("SELECT id, quantity, unit, remark, sub_customer FROM order_items WHERE order_id = ?").all(orderId);
        const fmtQty = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n))
                return "";
            return Number.isInteger(n) ? String(n) : String(n).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
        };
        for (const row of existingItems) {
            const itemId = row.id;
            const qtyRaw = body["qty_" + itemId];
            const qtyParsed = parseFloat(qtyRaw);
            const nextQty = Number.isFinite(qtyParsed) && qtyParsed >= 0 ? qtyParsed : (Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : 0);
            const unitRaw = (body["unit_" + itemId] ?? "").trim();
            const nextUnit = unitRaw || "公斤";
            const remarkInput = (body["remark_" + itemId] ?? "").trim();
            const subCustomerInput = (body["sub_customer_" + itemId] ?? "").trim();
            const prevUnit = String(row.unit || "").trim();
            const prevRemark = String(row.remark || "").trim();
            let nextRemark = remarkInput;
            const convertedToKg = prevUnit && prevUnit !== "公斤" && nextUnit === "公斤";
            if (convertedToKg && !nextRemark) {
                const originTag = fmtQty(row.quantity) + prevUnit;
                nextRemark = prevRemark
                    ? (prevRemark.includes(originTag) ? prevRemark : (prevRemark + "；" + originTag))
                    : originTag;
            }
            await db.prepare("UPDATE order_items SET quantity = ?, unit = ?, remark = ?, sub_customer = ?, include_export = 1 WHERE id = ? AND order_id = ?").run(nextQty, nextUnit, nextRemark || null, subCustomerInput || null, itemId, orderId);
            const ordRaw = body["ord_" + row.id];
            const ordNum = parseInt(String(ordRaw || ""), 10);
            if (Number.isFinite(ordNum) && ordNum > 0) {
                await db.prepare("UPDATE order_items SET display_order = ? WHERE id = ? AND order_id = ?").run(ordNum, row.id, orderId);
            }
        }
        try {
            await customer_handwriting_hints_js_1.recordHandwritingHintsForOrder(db, orderId);
        }
        catch (_) { /* 筆跡對照表寫入失敗不阻擋 */ }
        if (wantsJson) {
            res.json({ ok: true });
            return;
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=items");
    });
    router.post("/orders/:orderId/items/:itemId/delete", async (req, res) => {
        const { orderId, itemId } = req.params;
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        await db.prepare("DELETE FROM order_items WHERE id = ? AND order_id = ?").run(itemId, orderId);
        const wantsJson = req.get("X-Requested-With") === "XMLHttpRequest";
        if (wantsJson) {
            res.json({ ok: true });
            return;
        }
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=del_item#items");
    });
    router.post("/orders/:orderId/approve", async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "";
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        await db.prepare("UPDATE orders SET status = ? WHERE id = ?").run("approved", orderId);
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=approved" + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
    });
    router.post("/orders/:orderId/unapprove", async (req, res) => {
        const { orderId } = req.params;
        const backTo = (typeof req.query.back === "string" && req.query.back.startsWith("/admin/orders"))
            ? req.query.back
            : "";
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        await db.prepare("UPDATE orders SET status = ? WHERE id = ?").run("pending", orderId);
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=unconfirmed" + (backTo ? "&back=" + encodeURIComponent(backTo) : ""));
    });
    router.get("/orders/:orderId/items/add", async (req, res) => {
        const { orderId } = req.params;
        const order = await db.prepare("SELECT id, order_date, customer_id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const products = await db.prepare("SELECT id, name, erp_code, unit FROM products WHERE (active IS NULL OR active = 1) ORDER BY name").all();
        const productOptions = products.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)} ${escapeHtml(p.erp_code ?? "")}</option>`).join("");
        const units = [...ORDER_LINE_UNITS, "個"];
        const unitOpts = units.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單查詢</a> / <a href="/admin/orders/${encodeURIComponent(orderId)}">訂單明細</a> / 增加品項</div>
        <h1 class="notion-page-title">增加品項</h1>
        <div class="notion-card">
          <form method="post" action="/admin/orders/${encodeURIComponent(orderId)}/items/add">
            <label>品項 <select name="product_id" required style="width:100%;">${productOptions}</select></label>
            <label>數量 <input type="number" name="quantity" step="any" min="0" value="0" required style="width:8rem;"></label>
            <label>單位 <select name="unit" style="width:8rem;">${unitOpts}</select></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button> <a href="/admin/orders/${encodeURIComponent(orderId)}#items" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("增加品項", body, "", res));
    });
    router.post("/orders/:orderId/items/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { orderId } = req.params;
        const productId = req.body.product_id?.trim();
        const qty = parseFloat(req.body.quantity);
        const unit = (req.body.unit || "").trim() || "公斤";
        const order = await db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        if (!productId || !Number.isFinite(qty) || qty < 0) {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "/items/add?err=1");
            return;
        }
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "/items/add?err=product");
            return;
        }
        const itemId = (0, id_js_1.newId)("item");
        await db.prepare("INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export, sub_customer) VALUES (?, ?, ?, ?, ?, ?, 0, 1, NULL)").run(itemId, orderId, productId, product.name, qty, unit);
        res.redirect("/admin/orders/" + encodeURIComponent(orderId) + "?ok=add_item#items");
    });
    router.get("/barcode", async (req, res) => {
        const code = req.query.code?.trim();
        if (!code || code.length > 80) {
            res.status(400).send("缺少或無效的 code 參數");
            return;
        }
        const scaleRaw = parseInt(String(req.query.scale ?? "2"), 10);
        const heightRaw = parseInt(String(req.query.height ?? "10"), 10);
        const scale = Number.isFinite(scaleRaw) ? Math.min(8, Math.max(1, scaleRaw)) : 2;
        const height = Number.isFinite(heightRaw) ? Math.min(30, Math.max(6, heightRaw)) : 10;
        try {
            const png = await bwip_js_1.default.toBuffer({
                bcid: "code128",
                text: code,
                scale,
                height,
                includetext: false,
            });
            res.type("image/png").send(png);
        }
        catch (e) {
            console.error("[admin] barcode error", e);
            res.status(500).send("條碼產生失敗");
        }
    });
    router.get("/orders/:orderId/order-sheet", async (req, res) => {
        const { orderId } = req.params;
        const preview = req.query.preview === "1";
        const download = req.query.download === "1";
        const order = await db.prepare(`
      SELECT o.id, o.order_no, o.order_date, o.status, o.customer_id, c.name AS customer_name, c.teraoka_code AS customer_teraoka_code
      FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?
    `).get(orderId);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.quantity, oi.unit, oi.remark, p.erp_code, p.name AS product_name
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1)
    `).all(orderId);
        const orderNoForBc = (order.order_no && String(order.order_no).trim()) ? String(order.order_no).trim() : order.id;
        const orderBcHeader = orderNoForBc
            ? `<div class="order-sheet-head-R"><img src="/admin/barcode?code=${encodeURIComponent(orderNoForBc)}&scale=3&height=12" alt="" class="os-bc-order-img"/><div class="order-sheet-bc-label">${escapeHtml(order.order_no ?? order.id)}</div></div>`
            : "";
        const rows = items.map((i) => {
            const erp = i.erp_code ?? "—";
            const pname = i.product_name ?? "待確認";
            const qty = i.quantity;
            const u = i.unit && i.unit.trim() ? i.unit : "";
            const remark = (i.remark && i.remark.trim()) ? escapeHtml(i.remark.trim()) : "—";
            return `<tr><td>${escapeHtml(erp)}</td><td>${escapeHtml(pname)}</td><td>${qty}</td><td>${escapeHtml(u)}</td><td>${remark}</td></tr>`;
        }).join("");
        const customerBarcode = order.customer_teraoka_code && order.customer_teraoka_code.trim()
            ? `<p style="font-size:17pt;margin-top:12px;"><strong>客戶條碼</strong>（${escapeHtml(order.customer_name)}）<br><img src="/admin/barcode?code=${encodeURIComponent(order.customer_teraoka_code.trim())}&scale=3&height=14" alt="客戶條碼" class="os-cust-bc"></p>`
            : "";
        if (!preview) {
            try {
                await db.prepare("UPDATE orders SET sheet_exported_at = ? WHERE id = ?").run(new Date().toISOString(), orderId);
            }
            catch (e) {
                console.error("[admin] sheet_exported_at single", orderId, e?.message || e);
            }
        }
        const singleOrderSheetStyle = `
<style>
.order-sheet-print { font-size: 17pt; color: #111; box-sizing: border-box; }
.order-sheet-print .order-sheet-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
.order-sheet-print .order-sheet-head-L { flex: 1; min-width: 0; }
.order-sheet-print .order-sheet-head-R { flex-shrink: 0; text-align: right; max-width: 48%; }
.order-sheet-print h1 { font-size: 26pt; margin: 0 0 10px; font-weight: 700; letter-spacing: -0.02em; }
.order-sheet-print .os-meta { font-size: 17pt; margin: 0; line-height: 1.45; }
.order-sheet-print table { width: 100%; border-collapse: collapse; font-size: 17pt; table-layout: fixed; }
.order-sheet-print th, .order-sheet-print td { border: 1px solid #333; padding: 5px 5px; vertical-align: top; }
.order-sheet-print th { font-size: 15pt; background: #f5f5f5; font-weight: 600; }
.order-sheet-print th.col-tg { width: 16%; max-width: 32mm; font-size: 11pt; padding: 4px 3px; }
.order-sheet-print td.col-tg { width: 16%; max-width: 32mm; padding: 3px 3px; }
.order-sheet-print .teraoka-compact { display: flex; flex-direction: column; align-items: flex-start; gap: 0; margin: 0; padding: 0; max-width: 100%; }
.order-sheet-print .teraoka-compact-meta { margin: 0; padding: 0; line-height: 1.1; }
.order-sheet-print .teraoka-compact .tc-code { display: block; font-size: 6.5pt; font-weight: 600; color: #222; letter-spacing: -0.02em; word-break: break-all; }
.order-sheet-print .teraoka-compact .tc-name { display: block; font-size: 6.5pt; color: #444; margin: 0; padding: 0; line-height: 1.15; max-height: 2.5em; overflow: hidden; word-break: break-word; }
.order-sheet-print .os-bc-item-img { height: 51px; width: auto; display: block; margin: 0; padding: 0; max-width: 100%; }
.order-sheet-print .os-bc-order-img { height: 56px; width: auto; display: block; margin-left: auto; max-width: 100%; }
.order-sheet-print .order-sheet-bc-label { font-size: 14pt; margin-top: 4px; }
.order-sheet-print .os-cust-bc { height: 84px; width: auto; max-width: 100%; }
.order-sheet-print .order-sheet-inner { width: 100%; max-width: 190mm; margin: 0 auto; padding: 4mm 6mm; }
</style>`;
        const sheetBody = `
        ${singleOrderSheetStyle}
        <div class="no-print notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單查詢</a> / <a href="/admin/orders/${encodeURIComponent(orderId)}">訂單明細</a> / 訂貨單</div>
        ${preview ? "<p class=\"no-print\"><button type=\"button\" class=\"btn btn-primary\" id=\"exportJpgBtn\">匯出 JPG</button> 預覽下方訂單圖後可點此匯出</p>" : ""}
        <div id="order-sheet-content" style="margin-top:12px; width:210mm; min-height:297mm; box-sizing:border-box; background:white; padding:10mm 8mm;" class="order-sheet-a4 order-sheet-print">
        <div class="order-sheet-inner">
        <div class="order-sheet-head">
          <div class="order-sheet-head-L">
            <h1>訂貨單</h1>
            <p class="os-meta">訂單編號：${escapeHtml(order.order_no ?? "—")}　日期：${escapeHtml(order.order_date)}　客戶：${escapeHtml(order.customer_name)}</p>
          </div>
          ${orderBcHeader}
        </div>
          <table>
            <colgroup><col style="width:10%"><col style="width:40%"><col style="width:10%"><col style="width:10%"><col style="width:30%"></colgroup>
            <thead><tr><th>料號</th><th>品名</th><th>數量</th><th>單位</th><th>備註</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ${customerBarcode ? `<div style="margin-top:1.5rem;">${customerBarcode}</div>` : ""}
        </div>
        </div>
        <p class="no-print" style="margin-top:1rem;"><a href="/admin/orders/${encodeURIComponent(orderId)}">← 回訂單明細</a></p>
        ${preview ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script><script>document.getElementById("exportJpgBtn").onclick=function(){ var el = document.getElementById("order-sheet-content"); if (typeof html2canvas !== "undefined") { html2canvas(el, { useCORS: true, allowTaint: true, scale: 2 }).then(function(canvas){ var a = document.createElement("a"); a.download = "order-sheet-' + orderId + '.jpg"; a.href = canvas.toDataURL("image/jpeg", 0.92); a.click(); }); } };</script>' : ""}
      `;
        if (download) {
            const safeCustomer = String(order.customer_name || "客戶").replace(/[\\/:*?"<>|]/g, "_").trim() || "客戶";
            const seq = String(order.order_no || order.id || "01").replace(/[^\d]/g, "").slice(-2) || "01";
            const fname = `${order.order_date}_${safeCustomer}_${seq}_揀貨單.html`;
            res.setHeader("Content-Disposition", "attachment; filename=\"" + fname + "\"");
        }
        res.type("text/html").send(notionPage("訂貨單", sheetBody, "", res));
    });
    router.get("/customers/new", async (req, res) => {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / 新增客戶</div>
        <h1 class="notion-page-title">新增客戶</h1>
        <div class="notion-card">
          <form method="post" action="/admin/customers/new">
            <label>客戶名稱 <input type="text" name="name" required placeholder="例：XX餐廳" style="width:100%;"></label>
            <label>寺岡編號（CustCode／QR） <input type="text" name="teraoka_code" placeholder="可留空" style="width:100%;"></label>
            <label>凌越編號（HQCustCode） <input type="text" name="hq_cust_code" placeholder="可留空" style="width:100%;"></label>
            <label>LINE 群組名稱 <input type="text" name="line_group_name" placeholder="可留空，之後可改" style="width:100%;"></label>
            <label>LINE 群組 ID <input type="text" name="line_group_id" placeholder="C開頭群組 ID，可留空後補" style="width:100%;"></label>
            <label>聯絡方式 <input type="text" name="contact" placeholder="電話或備註，可留空" style="width:100%;"></label>
            <label>第幾號線（檢貨路線）<select name="route_line"><option value="">— 不指定</option>${[1,2,3,4,5,6,7,8,9].map((n) => `<option value="${n}">${n} 號線</option>`).join("")}</select></label>
            <label>專屬子客戶/分店名單 (請用逗號分隔) <input type="text" name="known_sub_customers" placeholder="例：東大附小,豐源國小,馬蘭國小" style="width:100%;"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">建立</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增客戶", body, "", res));
    });
    router.post("/customers/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = req.body.name?.trim();
        const teraokaCode = req.body.teraoka_code?.trim() || null;
        const hqCustCode = req.body.hq_cust_code?.trim() || null;
        const lineGroupName = req.body.line_group_name?.trim() || null;
        const lineGroupId = (req.body.line_group_id || "").replace(/\s/g, "").trim() || null;
        const contact = req.body.contact?.trim() || null;
        const routeLineRaw = req.body.route_line?.trim();
        const routeLine = routeLineRaw && /^[1-9]$/.test(routeLineRaw) ? parseInt(routeLineRaw, 10) : null;
        const knownSubCustomers = req.body.known_sub_customers?.trim() || null;
        if (!name) {
            res.redirect("/admin/customers/new?err=name");
            return;
        }
        const id = (0, id_js_1.newId)("cust");
        await db.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, route_line, known_sub_customers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact, routeLine, knownSubCustomers);
        res.redirect("/admin/customers?ok=1");
    });
    router.get("/customers/:id/quick-view", async (req, res) => {
        const customer = await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active FROM customers WHERE id = ?").get(req.params.id);
        if (!customer) {
            res.status(404).send("客戶不存在");
            return;
        }
        const aliases = await db.prepare(`
      SELECT cpa.alias, p.name AS product_name
      FROM customer_product_aliases cpa
      JOIN products p ON p.id = cpa.product_id
      WHERE cpa.customer_id = ?
      ORDER BY cpa.alias
    `).all(customer.id);
        const fromOrders = req.query.from === "orders";
        const backLink = fromOrders ? "<a href=\"/admin/orders\">← 回訂單查詢</a>" : "<a href=\"/admin/customers\">← 回客戶列表</a>";
        const editLink = fromOrders
            ? `<a href="/admin/customers/${encodeURIComponent(customer.id)}/edit?from=orders">編輯</a>`
            : `<a href="/admin/customers/${encodeURIComponent(customer.id)}/edit">編輯</a>`;
        const aliasRows = aliases.map((a) => `<tr><td>${escapeHtml(a.alias)}</td><td>${escapeHtml(a.product_name)}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / ${escapeHtml(customer.name)}</div>
        <h1 class="notion-page-title">${escapeHtml(customer.name)}</h1>
        <div class="notion-card">
          <p><strong>聯絡</strong>：${escapeHtml(customer.contact ?? "—")}</p>
          <p><strong>預設單位</strong>（未填時）：${escapeHtml(customer.default_unit || "公斤")}</p>
          <p><strong>寺岡／凌越編號</strong>：${escapeHtml(customer.teraoka_code ?? "—")}／${escapeHtml(customer.hq_cust_code ?? "—")}</p>
          <p><strong>LINE 群組</strong>：${escapeHtml(customer.line_group_name ?? "—")} ${customer.line_group_id ? "（已綁定）" : "（未綁定）"}</p>
        </div>
        <div class="notion-card">
          <h2>叫貨備註／特殊情況</h2>
          <p style="white-space:pre-wrap;margin:0;background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);">${escapeHtml(customer.order_notes || "（無）")}</p>
        </div>
        <div class="notion-card">
          <h2>此客戶專用別名</h2>
          <table><thead><tr><th>客戶常叫的名稱</th><th>對應品項</th></tr></thead><tbody>${aliasRows || "<tr><td colspan='2'>尚無</td></tr>"}</tbody></table>
        </div>
        <p>${editLink}　${backLink}</p>
      `;
        res.type("text/html").send(notionPage("客戶資料", body, "", res));
    });
    router.get("/customers/:id/edit", async (req, res) => {
        try {
            const customer = await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, order_notes, default_unit, active, route_line, known_sub_customers FROM customers WHERE id = ?").get(req.params.id);
            if (!customer) {
                res.status(404).send("客戶不存在");
                return;
            }
            const v = (s) => escapeAttr(s ?? "");
            const activeChecked = customer.active === undefined || customer.active === null || customer.active === 1;
            const editMsg = req.query.ok === "alias" ? "<p style='color:green'>已新增專用別名。</p>" : req.query.ok === "alias_del" ? "<p style='color:green'>已刪除專用別名。</p>" : req.query.err === "alias" ? "<p style='color:red'>請填寫別名與品項。</p>" : req.query.err === "dup" ? "<p style='color:red'>此客戶已存在相同別名。</p>" : "";
            const custAliases = await db.prepare(`
      SELECT cpa.id, cpa.alias, p.name AS product_name
      FROM customer_product_aliases cpa
      JOIN products p ON p.id = cpa.product_id
      WHERE cpa.customer_id = ?
      ORDER BY cpa.alias
    `).all(customer.id);
            const productList = await db.prepare("SELECT id, name FROM products WHERE (active IS NULL OR active = 1) ORDER BY name").all();
            const productOptions = productList.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join("");
            const aliasRows = custAliases
            .map((a) => `<tr><td>${escapeHtml(a.alias)}</td><td>${escapeHtml(a.product_name)}</td><td><form method="post" action="/admin/customers/${encodeURIComponent(customer.id)}/alias/${encodeURIComponent(a.id)}/delete" style="display:inline;"><button type="submit">刪除</button></form></td></tr>`)
            .join("");
        const editBody = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / 編輯客戶</div>
        <h1 class="notion-page-title">編輯客戶</h1>
        ${editMsg ? `<div class="notion-msg ${editMsg.indexOf("已") >= 0 ? "ok" : "err"}">${editMsg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <form method="post" action="/admin/customers/${v(customer.id)}/edit">
            ${req.query.from === "orders" ? '<input type="hidden" name="from" value="orders">' : ""}
            <label>客戶名稱 <input type="text" name="name" value="${v(customer.name)}" required style="width:100%;"></label>
            <label>寺岡編號（CustCode／QR） <input type="text" name="teraoka_code" value="${v(customer.teraoka_code)}" style="width:100%;"></label>
            <label>凌越編號（HQCustCode） <input type="text" name="hq_cust_code" value="${v(customer.hq_cust_code)}" style="width:100%;"></label>
            <label>LINE 群組名稱 <input type="text" name="line_group_name" value="${v(customer.line_group_name)}" placeholder="可之後填" style="width:100%;"></label>
            <label>LINE 群組 ID <input type="text" name="line_group_id" value="${v(customer.line_group_id)}" placeholder="C開頭，綁定後機器人會認此群組" style="width:100%;"></label>
            <label>聯絡方式 <input type="text" name="contact" value="${v(customer.contact)}" style="width:100%;"></label>
            <label>第幾號線（檢貨路線）<select name="route_line"><option value="">— 不指定</option>${[1,2,3,4,5,6,7,8,9].map((n) => `<option value="${n}" ${customer.route_line === n ? "selected" : ""}>${n} 號線</option>`).join("")}</select></label>
            <label>預設單位（客戶只打數字未填單位時使用）<select name="default_unit">
              <option value="" ${!customer.default_unit ? "selected" : ""}>公斤（預設）</option>
              ${ORDER_LINE_UNITS.map((u) => `<option value="${escapeAttr(u)}" ${customer.default_unit === u ? "selected" : ""}>${escapeHtml(u)}</option>`).join("")}
            </select></label>
            <label>叫貨備註／習慣說明 <textarea name="order_notes" placeholder="此客戶叫貨的習慣、特定說法或規則，僅供內部參考" style="width:100%;min-height:60px;">${v(customer.order_notes)}</textarea></label>
            <label>專屬子客戶/分店名單 (請用逗號分隔) <input type="text" name="known_sub_customers" value="${v(customer.known_sub_customers)}" placeholder="例：東大附小,豐源國小,馬蘭國小" style="width:100%;"></label>
            <label><input type="checkbox" name="active" value="1" ${activeChecked ? "checked" : ""}> 啟用（未勾選＝停用）</label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
        <div class="notion-card">
          <h2>此客戶專用別名（叫貨習慣）</h2>
          <p>此客戶在 LINE 叫貨時若輸入下列名稱，會對應到指定品項（僅此客戶適用）。</p>
          <table>
            <thead><tr><th>客戶常叫的名稱</th><th>對應品項</th><th>操作</th></tr></thead>
            <tbody>${aliasRows || "<tr><td colspan='3'>尚無專用別名</td></tr>"}</tbody>
          </table>
          <form method="post" action="/admin/customers/${v(customer.id)}/alias" style="margin-top:12px;">
            <label style="margin:0;">新增：客戶叫「<input type="text" name="alias" required placeholder="例：大陸妹">」→ 對應 <select name="product_id" required>${productOptions}</select></label>
            <button type="submit" class="btn">新增</button>
          </form>
        </div>
        <p>${req.query.from === "orders" ? `<a href="/admin/orders">← 回訂單查詢</a>` : `<a href="/admin/customers">← 回客戶列表</a>`}</p>
      `;
            res.type("text/html").send(notionPage("編輯客戶", editBody, "", res));
        }
        catch (e) {
            console.error("[admin] 客戶編輯頁錯誤:", e);
            res.redirect("/admin/customers?err=" + encodeURIComponent("載入失敗：" + (e.message || String(e)).slice(0, 80)));
        }
    });
    router.post("/customers/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const name = req.body.name?.trim();
        const teraokaCode = req.body.teraoka_code?.trim() || null;
        const hqCustCode = req.body.hq_cust_code?.trim() || null;
        const lineGroupName = req.body.line_group_name?.trim() || null;
        const lineGroupId = (req.body.line_group_id || "").replace(/\s/g, "").trim() || null;
        const contact = req.body.contact?.trim() || null;
        const routeLineRaw = req.body.route_line?.trim();
        const routeLine = routeLineRaw && /^[1-9]$/.test(routeLineRaw) ? parseInt(routeLineRaw, 10) : null;
        const defaultUnit = req.body.default_unit?.trim() || null;
        const orderNotes = req.body.order_notes?.trim() || null;
        const knownSubCustomers = req.body.known_sub_customers?.trim() || null;
        const active = req.body.active === "1" ? 1 : 0;
        if (!name) {
            res.redirect("/admin/customers/" + encodeURIComponent(id) + "/edit?err=name");
            return;
        }
        await db.prepare("UPDATE customers SET name = ?, teraoka_code = ?, hq_cust_code = ?, line_group_name = ?, line_group_id = ?, contact = ?, route_line = ?, default_unit = ?, order_notes = ?, known_sub_customers = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, teraokaCode, hqCustCode, lineGroupName, lineGroupId, contact, routeLine, defaultUnit, orderNotes, knownSubCustomers, active, id);
        const fromOrders = req.body?.from === "orders";
        res.redirect(fromOrders ? "/admin/orders?ok=edit" : "/admin/customers?ok=edit");
    });
    router.post("/customers/:id/alias", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const customerId = req.params.id;
        const alias = req.body?.alias?.trim();
        const productId = req.body?.product_id?.trim();
        if (!alias || !productId) {
            res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?err=alias");
            return;
        }
        const cust = await db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
        if (!cust) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        try {
            const id = (0, id_js_1.newId)("cpa");
            await db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(id, customerId, productId, alias);
        }
        catch (e) {
            res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?err=dup");
            return;
        }
        res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?ok=alias");
    });
    router.post("/customers/:id/alias/:aliasId/delete", async (req, res) => {
        const customerId = req.params.id;
        const aliasId = req.params.aliasId;
        const row = await db.prepare("SELECT id FROM customer_product_aliases WHERE id = ? AND customer_id = ?").get(aliasId, customerId);
        if (!row) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("找不到此別名"));
            return;
        }
        await db.prepare("DELETE FROM customer_product_aliases WHERE id = ?").run(aliasId);
        res.redirect("/admin/customers/" + encodeURIComponent(customerId) + "/edit?ok=alias_del");
    });
    router.get("/customers", async (req, res) => {
        const msg = req.query.ok === "1"
            ? "<p style='color:green'>客戶已建立。</p>"
            : req.query.ok === "edit"
                ? "<p style='color:green'>已儲存。</p>"
                : req.query.ok === "del"
                        ? "<p style='color:green'>已刪除。</p>"
                        : req.query.err
                            ? "<p style='color:red'>" + escapeHtml(String(req.query.err)) + "</p>"
                            : "";
        const q = req.query.q?.trim() ?? "";
        const rows = (q
            ? await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, active FROM customers WHERE name LIKE ? ORDER BY name").all("%" + q + "%")
            : await db.prepare("SELECT id, name, teraoka_code, hq_cust_code, line_group_name, line_group_id, contact, active FROM customers ORDER BY name").all());
        const makeRow = (r) => {
            const active = r.active === 1 || r.active === "1" || r.active === undefined || r.active === null;
            return `<tr data-customer-id="${escapeAttr(r.id)}">
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.teraoka_code ?? "")}</td>
            <td>${escapeHtml(r.hq_cust_code ?? "")}</td>
            <td>${escapeHtml(r.line_group_name ?? "")}</td>
            <td>${r.line_group_id ? "已綁定" : "—"}</td>
            <td>${escapeHtml(r.contact ?? "")}</td>
            <td class="customer-status-cell">${active ? "<span style='color:green'>啟用</span>" : "<span style='color:gray'>停用</span>"}</td>
            <td>
              <a href="/admin/customers/${encodeURIComponent(r.id)}/edit">編輯</a>
              | <button type="button" class="customer-toggle-btn" data-id="${escapeAttr(r.id)}" data-active="${active ? "1" : "0"}">${active ? "停用" : "啟用"}</button>
              | <a href="/admin/customers/${encodeURIComponent(r.id)}/delete">刪除</a>
            </td>
          </tr>`;
        };
        const isCustomerActive = (r) => r.active === 1 || r.active === "1" || r.active === undefined || r.active === null;
        const activeList = rows.filter(isCustomerActive);
        const inactiveList = rows.filter((r) => !isCustomerActive(r));
        const tbodyActive = activeList.map(makeRow).join("") || "<tr class=\"customers-placeholder\"><td colspan='8'>無啟用客戶</td></tr>";
        const tbodyInactive = inactiveList.map(makeRow).join("") || "<tr class=\"customers-placeholder\"><td colspan='8'>無停用客戶</td></tr>";
        const searchVal = escapeAttr(q);
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 客戶管理</div>
        <h1 class="notion-page-title">客戶管理</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/customers/new">＋ 新增客戶</a>、<a href="/admin/import-customers">匯入客戶</a></p>
        <form method="get" action="/admin/customers" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;">
          <label style="margin:0;">搜尋（名稱模糊）：<input type="search" name="q" value="${searchVal}" placeholder="輸入關鍵字" style="width:220px;"></label>
          <button type="submit" class="btn">搜尋</button>
          ${q ? `<a href="/admin/customers" class="btn">清除</a>` : ""}
        </form>
        <p class="notion-msg ok" style="margin-bottom:16px;">匯入後可點「編輯」補上 LINE 群組名稱、LINE 群組 ID。停用後該群組將不再對應叫貨。</p>
        <div class="notion-card">
          <div class="tab-bar" style="display:flex;gap:0;border-bottom:1px solid var(--notion-border);margin-bottom:0;">
            <button type="button" class="tab-btn active" data-tab="customers-active" style="padding:10px 16px;border:none;background:transparent;cursor:pointer;font-size:14px;border-bottom:2px solid var(--notion-accent);margin-bottom:-1px;">啟用</button>
            <button type="button" class="tab-btn" data-tab="customers-inactive" style="padding:10px 16px;border:none;background:transparent;cursor:pointer;font-size:14px;color:var(--notion-text-muted);">停用</button>
          </div>
          <div id="customers-active-panel" class="tab-panel">
            <table>
              <thead><tr><th>名稱</th><th>寺岡編號</th><th>凌越編號</th><th>LINE 群組名稱</th><th>LINE 綁定</th><th>聯絡</th><th>狀態</th><th>操作</th></tr></thead>
              <tbody id="customers-active-tbody">${tbodyActive}</tbody>
            </table>
          </div>
          <div id="customers-inactive-panel" class="tab-panel" style="display:none;">
            <table>
              <thead><tr><th>名稱</th><th>寺岡編號</th><th>凌越編號</th><th>LINE 群組名稱</th><th>LINE 綁定</th><th>聯絡</th><th>狀態</th><th>操作</th></tr></thead>
              <tbody id="customers-inactive-tbody">${tbodyInactive}</tbody>
            </table>
          </div>
        </div>
        <script>
        (function(){
          var activeTbody = document.getElementById("customers-active-tbody");
          var inactiveTbody = document.getElementById("customers-inactive-tbody");
          function removePlaceholder(tbody){
            var first = tbody && tbody.firstElementChild;
            if (first && first.classList && first.classList.contains("customers-placeholder")) tbody.removeChild(first);
          }
          function moveRow(row, toActive){
            var statusCell = row.querySelector(".customer-status-cell");
            var btn = row.querySelector(".customer-toggle-btn");
            if (statusCell) statusCell.innerHTML = toActive ? "<span style=\\"color:green\\">啟用</span>" : "<span style=\\"color:gray\\">停用</span>";
            if (btn){ btn.dataset.active = toActive ? "1" : "0"; btn.textContent = toActive ? "停用" : "啟用"; }
            var fromTbody = row.parentNode;
            var toTbody = toActive ? activeTbody : inactiveTbody;
            removePlaceholder(toTbody);
            fromTbody.removeChild(row);
            toTbody.appendChild(row);
            if (fromTbody.children.length === 0)
              fromTbody.innerHTML = "<tr class=\\"customers-placeholder\\"><td colspan=\\"8\\">" + (fromTbody.id === "customers-active-tbody" ? "無啟用客戶" : "無停用客戶") + "</td></tr>";
          }
          document.querySelectorAll(".tab-btn[data-tab]").forEach(function(btn){
            btn.addEventListener("click", function(){
              var tab = this.dataset.tab;
              document.querySelectorAll(".tab-btn[data-tab]").forEach(function(b){ b.classList.remove("active"); b.style.borderBottom = "none"; b.style.color = ""; });
              this.classList.add("active"); this.style.borderBottom = "2px solid var(--notion-accent)"; this.style.color = "";
              document.querySelectorAll(".tab-panel").forEach(function(p){ p.style.display = "none"; });
              var panel = document.getElementById(tab + "-panel");
              if (panel) panel.style.display = "block";
            });
          });
          document.querySelectorAll(".customer-toggle-btn").forEach(function(btn){
            btn.addEventListener("click", function(){
              var el = this, id = el.dataset.id;
              if (!id) return;
              el.disabled = true;
              fetch("/admin/api/customers/" + encodeURIComponent(id) + "/toggle", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "", credentials: "same-origin" })
                .then(function(r){ return r.json(); })
                .then(function(data){
                  if (data && data.ok === true) {
                    var row = el.closest("tr");
                    if (row) moveRow(row, data.active === 1);
                  }
                  el.disabled = false;
                })
                .catch(function(){ el.disabled = false; });
            });
          });
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("客戶管理", body, "", res));
    });
    router.post("/api/customers/:id/toggle", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id, active FROM customers WHERE id = ?").get(id);
        if (!row) {
            res.status(404).json({ ok: false, err: "找不到此客戶" });
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE customers SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.json({ ok: true, active: next });
    });
    router.post("/customers/:id/toggle", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT active FROM customers WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE customers SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.redirect("/admin/customers?ok=toggle");
    });
    router.get("/customers/:id/delete", async (req, res) => {
        const customer = await db.prepare("SELECT id, name FROM customers WHERE id = ?").get(req.params.id);
        if (!customer) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("客戶不存在"));
            return;
        }
        const orderCount = await db.prepare("SELECT COUNT(*) AS c FROM orders WHERE customer_id = ?").get(customer.id);
        const hasOrders = (orderCount?.c ?? 0) > 0;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除客戶</h1>
        <div class="notion-card">
          <p>確定要刪除「${escapeHtml(customer.name)}」？</p>
          ${hasOrders ? "<p class=\"notion-msg err\">此客戶已有訂單，無法刪除。請改為「停用」。</p>" : ""}
          <p style="margin-top:16px;">
            ${!hasOrders ? `<form method="post" action="/admin/customers/${encodeURIComponent(customer.id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form> ` : ""}
            <a href="/admin/customers" class="btn">取消</a>
          </p>
        </div>
      `;
        res.type("text/html").send(notionPage("確認刪除", body, "", res));
    });
    router.post("/customers/:id/delete", async (req, res) => {
        const id = req.params.id;
        const orderCount = await db.prepare("SELECT COUNT(*) AS c FROM orders WHERE customer_id = ?").get(id);
        if ((orderCount?.c ?? 0) > 0) {
            res.redirect("/admin/customers?err=" + encodeURIComponent("此客戶已有訂單，無法刪除。請改為停用。"));
            return;
        }
        await db.prepare("DELETE FROM customers WHERE id = ?").run(id);
        res.redirect("/admin/customers?ok=del");
    });
    router.get("/products", async (req, res) => {
        const q = req.query.q?.trim() ?? "";
        let products = await db.prepare(`
      SELECT id, name, erp_code, teraoka_barcode, unit, active
      FROM products
      ORDER BY name
    `).all();
        if (q) {
            products = products.filter((p) => p.name.includes(q) ||
                (p.erp_code && p.erp_code.includes(q)) ||
                (p.teraoka_barcode && p.teraoka_barcode.includes(q)));
        }
        const aliasesByProduct = new Map();
        const aliasRows = await db.prepare("SELECT product_id, alias FROM product_aliases").all();
        for (const a of aliasRows) {
            if (!aliasesByProduct.has(a.product_id))
                aliasesByProduct.set(a.product_id, []);
            aliasesByProduct.get(a.product_id).push(a.alias);
        }
        const specsByProduct = new Map();
        try {
            const specRows = await db.prepare("SELECT product_id, unit, note_label, conversion_kg FROM product_unit_specs").all();
            for (const s of specRows) {
                if (!specsByProduct.has(s.product_id))
                    specsByProduct.set(s.product_id, []);
                const t = s.conversion_kg != null ? `${s.unit}（${s.conversion_kg}kg）` : (s.note_label || s.unit);
                specsByProduct.get(s.product_id).push(t);
            }
        }
        catch (_) { /* product_unit_specs 可能尚未建立 */ }
        try {
            const packRows = await db.prepare("SELECT product_id, outer_unit, inner_unit, inner_count FROM product_packaging_ratios").all();
            for (const p of packRows) {
                if (!specsByProduct.has(p.product_id))
                    specsByProduct.set(p.product_id, []);
                const t = `1${p.outer_unit}=${p.inner_count}${p.inner_unit}`;
                specsByProduct.get(p.product_id).push(t);
            }
        }
        catch (_) { /* product_packaging_ratios 可能尚未建立 */ }
        const okMsg = req.query.ok === "del" ? "已刪除品項。" : req.query.ok === "edit" ? "已儲存。" : req.query.err ? "" : "";
        const msg = okMsg ? "<p style='color:green'>" + okMsg + "</p>" : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const makeRow = (p) => {
            const specSummary = (specsByProduct.get(p.id) ?? []).map((x) => escapeHtml(x)).join("、") || "—";
            const isActive = p.active === 1 || p.active === "1" || p.active === undefined || p.active === null;
            const statusHtml = isActive ? "啟用" : "<span class=\"notion-hint\" style=\"display:inline;margin:0;\">停用</span>";
            const toggleLabel = isActive ? "停用" : "啟用";
            return `<tr data-product-id="${escapeAttr(p.id)}">
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.erp_code ?? "")}</td>
            <td>${escapeHtml(p.teraoka_barcode ?? "")}</td>
            <td>${escapeHtml(p.unit)}</td>
            <td>${(aliasesByProduct.get(p.id) ?? []).map((a) => escapeHtml(a)).join("、") || "—"} <a href="/admin/products/${encodeURIComponent(p.id)}/aliases">管理</a></td>
            <td>${specSummary} <a href="/admin/products/${encodeURIComponent(p.id)}/edit#unit-sop">設定</a></td>
            <td class="product-status-cell">${statusHtml}</td>
            <td>
              <a href="/admin/products/${encodeURIComponent(p.id)}/edit">編輯</a>
              | <button type="button" class="product-toggle-btn" data-id="${escapeAttr(p.id)}" data-active="${isActive ? "1" : "0"}">${escapeHtml(toggleLabel)}</button>
              | <a href="/admin/products/${encodeURIComponent(p.id)}/delete">刪除</a>
            </td>
          </tr>`;
        };
        const isProductActive = (p) => p.active === 1 || p.active === "1" || p.active === undefined || p.active === null;
        const activeList = products.filter(isProductActive);
        const inactiveList = products.filter((p) => !isProductActive(p));
        const tbodyActive = activeList.map(makeRow).join("") || "<tr class=\"products-placeholder\"><td colspan='8'>無啟用品項</td></tr>";
        const tbodyInactive = inactiveList.map(makeRow).join("") || "<tr class=\"products-placeholder\"><td colspan='8'>無停用品項</td></tr>";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 品項與俗名</div>
        <h1 class="notion-page-title">品項與俗名</h1>
        ${msg}
        <p style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><button type="button" class="btn btn-primary" id="openQuickAddProduct">＋ 新增貨品</button><a href="/admin/import">匯入品項</a>、<a href="/admin/import-teraoka">寺岡資料對照</a></p>
        <form method="get" action="/admin/products" style="margin-bottom:16px;">
          <input type="search" name="q" value="${escapeAttr(q)}" placeholder="搜尋品名、料號、條碼">
          <button type="submit" class="btn">搜尋</button>
        </form>
        <div class="notion-card">
          <div class="tab-bar" style="display:flex;gap:0;border-bottom:1px solid var(--notion-border);margin-bottom:0;">
            <button type="button" class="tab-btn active" data-tab="products-active" style="padding:10px 16px;border:none;background:transparent;cursor:pointer;font-size:14px;border-bottom:2px solid var(--notion-accent);margin-bottom:-1px;">啟用</button>
            <button type="button" class="tab-btn" data-tab="products-inactive" style="padding:10px 16px;border:none;background:transparent;cursor:pointer;font-size:14px;color:var(--notion-text-muted);">停用</button>
          </div>
          <div id="products-active-panel" class="tab-panel">
            <table>
              <thead><tr><th>標準品名</th><th>凌越料號</th><th>寺岡條碼</th><th>單位</th><th>俗名</th><th>規格</th><th>狀態</th><th>操作</th></tr></thead>
              <tbody id="products-active-tbody">${tbodyActive}</tbody>
            </table>
          </div>
          <div id="products-inactive-panel" class="tab-panel" style="display:none;">
            <table>
              <thead><tr><th>標準品名</th><th>凌越料號</th><th>寺岡條碼</th><th>單位</th><th>俗名</th><th>規格</th><th>狀態</th><th>操作</th></tr></thead>
              <tbody id="products-inactive-tbody">${tbodyInactive}</tbody>
            </table>
          </div>
        </div>
        <script>
        (function(){
          var quickBtn = document.getElementById("openQuickAddProduct");
          if (quickBtn) quickBtn.addEventListener("click", function(){
            var modal = document.getElementById("quickAddProductModal");
            if (modal) modal.style.display = "flex";
          });
          var quickClose = document.getElementById("closeQuickAddProduct");
          if (quickClose) quickClose.addEventListener("click", function(){
            var modal = document.getElementById("quickAddProductModal");
            if (modal) modal.style.display = "none";
          });
          document.addEventListener("click", function(e){
            var modal = document.getElementById("quickAddProductModal");
            if (modal && e.target === modal) modal.style.display = "none";
          });
          var activeTbody = document.getElementById("products-active-tbody");
          var inactiveTbody = document.getElementById("products-inactive-tbody");
          function removePlaceholder(tbody){
            var first = tbody && tbody.firstElementChild;
            if (first && first.classList && first.classList.contains("products-placeholder")) tbody.removeChild(first);
          }
          function moveRow(row, toActive){
            var statusCell = row.querySelector(".product-status-cell");
            var btn = row.querySelector(".product-toggle-btn");
            if (statusCell) statusCell.innerHTML = toActive ? "啟用" : "<span class=\\"notion-hint\\" style=\\"display:inline;margin:0;\\">停用</span>";
            if (btn){ btn.dataset.active = toActive ? "1" : "0"; btn.textContent = toActive ? "停用" : "啟用"; }
            var fromTbody = row.parentNode;
            var toTbody = toActive ? activeTbody : inactiveTbody;
            removePlaceholder(toTbody);
            fromTbody.removeChild(row);
            toTbody.appendChild(row);
            if (fromTbody.children.length === 0)
              fromTbody.innerHTML = "<tr class=\\"products-placeholder\\"><td colspan=\\"8\\">" + (fromTbody.id === "products-active-tbody" ? "無啟用品項" : "無停用品項") + "</td></tr>";
          }
          document.querySelectorAll(".tab-btn[data-tab]").forEach(function(btn){
            btn.addEventListener("click", function(){
              var tab = this.dataset.tab;
              document.querySelectorAll(".tab-btn[data-tab]").forEach(function(b){ b.classList.remove("active"); b.style.borderBottom = "none"; b.style.color = ""; });
              this.classList.add("active"); this.style.borderBottom = "2px solid var(--notion-accent)"; this.style.color = "";
              document.querySelectorAll(".tab-panel").forEach(function(p){ p.style.display = "none"; });
              var panel = document.getElementById(tab + "-panel");
              if (panel) panel.style.display = "block";
            });
          });
          document.querySelectorAll(".product-toggle-btn").forEach(function(btn){
            btn.addEventListener("click", function(){
              var el = this, id = el.dataset.id;
              if (!id) return;
              el.disabled = true;
              fetch("/admin/api/products/" + encodeURIComponent(id) + "/toggle", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "", credentials: "same-origin" })
                .then(function(r){ return r.json(); })
                .then(function(data){
                  if (data && data.ok === true) {
                    var row = el.closest("tr");
                    if (row) moveRow(row, data.active === 1);
                  }
                  el.disabled = false;
                })
                .catch(function(){ el.disabled = false; });
            });
          });
        })();
        </script>
        <div id="quickAddProductModal" class="notion-modal-overlay" style="display:none;">
          <div class="notion-modal">
            <h3>新增貨品</h3>
            <form method="post" action="/admin/products/quick-add">
              <label>標準品名 <input type="text" name="name" required style="width:100%;"></label>
              <label>凌越料號 <input type="text" name="erp_code" style="width:100%;"></label>
              <label>寺岡條碼 <input type="text" name="teraoka_barcode" style="width:100%;"></label>
              <label>單位 <input type="text" name="unit" value="公斤" required style="width:100%;"></label>
              <div class="notion-modal-actions">
                <button type="button" class="btn" id="closeQuickAddProduct">取消</button>
                <button type="submit" class="btn btn-primary">新增</button>
              </div>
            </form>
          </div>
        </div>
      `;
        res.type("text/html").send(notionPage("品項與俗名", body, "", res));
    });
    router.post("/products/quick-add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = String(req.body.name || "").trim();
        const unit = String(req.body.unit || "").trim() || "公斤";
        const erpCode = String(req.body.erp_code || "").trim() || null;
        const teraokaBarcode = String(req.body.teraoka_barcode || "").trim() || null;
        if (!name) {
            res.redirect("/admin/products?err=" + encodeURIComponent("請輸入標準品名"));
            return;
        }
        const dup = await db.prepare("SELECT id FROM products WHERE name = ?").get(name);
        if (dup) {
            res.redirect("/admin/products?err=" + encodeURIComponent("品名已存在"));
            return;
        }
        const id = (0, id_js_1.newId)("prod");
        await db.prepare("INSERT INTO products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)").run(id, name, erpCode, teraokaBarcode, unit, new Date().toISOString());
        res.redirect("/admin/products?ok=edit");
    });
    router.get("/products/:id/aliases", async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const aliases = await db.prepare("SELECT id, alias FROM product_aliases WHERE product_id = ? ORDER BY alias").all(productId);
        let specs = [];
        try {
            specs = await db.prepare("SELECT id, unit, note_label, conversion_kg FROM product_unit_specs WHERE product_id = ? ORDER BY unit").all(productId);
        }
        catch (_) { /* 表可能尚未存在 */ }
        const specMsg = req.query.spec_ok === "1" ? "<p style='color:green'>規格已新增。</p>" : req.query.spec_del ? "<p style='color:green'>規格已刪除。</p>" : "";
        const msg = req.query.ok === "1" ? "<p style='color:green'>已儲存。</p>" : req.query.ok === "del" ? "<p style='color:green'>已刪除。</p>" : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const rows = aliases
            .map((a) => `<tr>
            <td>${escapeHtml(a.alias)}</td>
            <td><a href="/admin/aliases/${encodeURIComponent(a.id)}/edit">編輯</a> | <form method="post" action="/admin/aliases/${encodeURIComponent(a.id)}/delete" style="display:inline;"><button type="submit">刪除</button></form></td>
          </tr>`)
            .join("");
        const specRows = specs
            .map((s) => `<tr>
            <td>${escapeHtml(s.unit)}</td>
            <td>${escapeHtml(s.note_label ?? "")}</td>
            <td>${s.conversion_kg != null ? s.conversion_kg : "—"}</td>
            <td><form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs/${encodeURIComponent(s.id)}/delete" style="display:inline;"><button type="submit" class="btn">刪除</button></form></td>
          </tr>`)
            .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / 俗名管理</div>
        <h1 class="notion-page-title">俗名管理：${escapeHtml(product.name)}</h1>
        <p class="notion-hint">單位換算與包裝規格已整合至 <a href="/admin/products/${encodeURIComponent(productId)}/edit#unit-sop">品項編輯 → 2. 單位與換算</a>，建議以此為主。</p>
        ${msg}${specMsg}
        <div class="notion-card">
          <h2>俗名</h2>
          <table>
            <thead><tr><th>俗名（別名）</th><th>操作</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='2'>尚無俗名</td></tr>"}</tbody>
          </table>
          <h2 style="margin-top:16px;">新增俗名</h2>
          <form method="post" action="/admin/alias">
            <input type="hidden" name="scope" value="global">
            <input type="hidden" name="product_id" value="${escapeAttr(product.id)}">
            <input type="hidden" name="redirect" value="/admin/products/${encodeURIComponent(product.id)}/aliases">
            <label>別名（客戶可能這樣叫）<input type="text" name="alias" required placeholder="例：高麗菜心" style="width:100%;"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">新增</button></p>
          </form>
        </div>
        <div class="notion-card" id="specs">
          <h2>品項規格</h2>
          <p class="notion-hint" style="margin:0 0 12px;">單位、備註標籤、換算公斤（選填）</p>
          <table>
            <thead><tr><th>單位</th><th>備註標籤</th><th>換算公斤</th><th>操作</th></tr></thead>
            <tbody>${specRows || "<tr><td colspan='4'>尚無規格</td></tr>"}</tbody>
          </table>
          <h2 style="margin-top:16px;">新增規格</h2>
          <form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs">
            <label>單位 <input type="text" name="unit" required placeholder="例：斤、包" style="width:120px;"></label>
            <label>備註標籤 <input type="text" name="note_label" placeholder="選填" style="width:160px;"></label>
            <label>換算公斤 <input type="number" name="conversion_kg" step="0.001" placeholder="選填" style="width:100px;"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">新增規格</button></p>
          </form>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("俗名管理", body, "", res));
    });
    router.post("/products/:id/specs", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const unit = (req.body?.unit ?? "").trim();
        const embed = req.body?.embed === "1";
        const returnUrl = safeAdminReturnPath(typeof req.body?.return === "string" ? req.body.return : "") || "";
        const redirectToEdit = req.body?.redirect_to_edit === "1";
        const ctxRaw = (req.body?.context_raw ?? "").trim();
        const ctxUnit = (req.body?.context_unit ?? "").trim();
        const qCtx = (ctxRaw ? "&context_raw=" + encodeURIComponent(ctxRaw) : "") + (ctxUnit ? "&context_unit=" + encodeURIComponent(ctxUnit) : "");
        const buildEditRedirect = (queryErr) => {
            const base = "/admin/products/" + encodeURIComponent(productId) + "/edit";
            if (queryErr)
                return base + "?err=" + encodeURIComponent(queryErr) + (embed ? "&embed=1" : "") + (returnUrl && embed ? "&return=" + encodeURIComponent(returnUrl) : "") + qCtx;
            let u = base + "?ok=spec_add" + (embed ? "&embed=1" : "") + (returnUrl && embed ? "&return=" + encodeURIComponent(returnUrl) : "") + qCtx;
            return u;
        };
        if (!unit) {
            if (redirectToEdit) {
                res.redirect(302, buildEditRedirect("請填寫單位"));
                return;
            }
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?err=" + encodeURIComponent("請填寫單位"));
            return;
        }
        const noteLabel = (req.body?.note_label ?? "").trim() || null;
        const conversionKg = req.body?.conversion_kg !== undefined && req.body.conversion_kg !== "" ? parseFloat(req.body.conversion_kg) : null;
        const syncLine = conversionKg != null && Number.isFinite(conversionKg) && conversionKg > 0;
        const specId = (0, id_js_1.newId)("pus");
        try {
            await db.prepare("INSERT INTO product_unit_specs (id, product_id, unit, note_label, conversion_kg) VALUES (?, ?, ?, ?, ?)").run(specId, productId, unit, noteLabel, conversionKg);
        }
        catch (e) {
            if (redirectToEdit) {
                res.redirect(302, buildEditRedirect("新增失敗：" + (e.message || "")));
                return;
            }
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?err=" + encodeURIComponent("新增失敗：" + (e.message || "")));
            return;
        }
        await logDataChange(req, {
            entityType: "product_unit_spec",
            entityId: specId,
            productId,
            action: "create",
            summary: `新增規格：${unit}${conversionKg != null ? ` → ${conversionKg}kg` : ""}${syncLine ? "（已同步 LINE 換算）" : ""}`,
            meta: { unit, note_label: noteLabel, conversion_kg: conversionKg, line_rules_synced: syncLine },
        });
        if (syncLine) {
            try {
                const obj = await loadLineUnitRulesObject();
                const fu = unit.trim();
                obj.rules = obj.rules.filter((r) => !(r.productId === productId && Array.isArray(r.fromUnits) && r.fromUnits.map((x) => String(x).trim()).includes(fu)));
                obj.rules.push({
                    productId,
                    fromUnits: [fu],
                    toUnit: "公斤",
                    kgPerUnit: conversionKg,
                    kgSafetyFactor: 1,
                    remarkStyle: "prefix",
                });
                await saveLineUnitRulesObject(normalizeLineUnitRules(JSON.stringify(obj)));
            }
            catch (e) {
                console.error("[admin] sync line unit rule from spec", e);
            }
        }
        if (redirectToEdit) {
            let u = buildEditRedirect("");
            if (syncLine)
                u = appendQueryToAdminPath(u, "sync_line", "1");
            res.redirect(302, u);
            return;
        }
        res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?spec_ok=1#specs");
    });
    router.post("/products/:id/specs/:specId/delete", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const specId = req.params.specId;
        const row = await db.prepare("SELECT id, unit FROM product_unit_specs WHERE id = ? AND product_id = ?").get(specId, productId);
        if (!row) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?err=" + encodeURIComponent("找不到此規格"));
            return;
        }
        await db.prepare("DELETE FROM product_unit_specs WHERE id = ?").run(specId);
        await logDataChange(req, {
            entityType: "product_unit_spec",
            entityId: specId,
            productId,
            action: "delete",
            summary: `刪除規格「${String(row.unit ?? "")}」`,
            meta: {},
        });
        const redirectToEdit = req.body?.redirect_to_edit === "1";
        const embed = req.body?.embed === "1";
        const returnUrl = safeAdminReturnPath(typeof req.body?.return === "string" ? req.body.return : "") || "";
        if (redirectToEdit) {
            let u = "/admin/products/" + encodeURIComponent(productId) + "/edit?ok=spec_del";
            if (embed)
                u += "&embed=1";
            if (returnUrl && embed)
                u += "&return=" + encodeURIComponent(returnUrl);
            res.redirect(302, u);
            return;
        }
        res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?spec_del=1#specs");
    });
    router.post("/products/:id/pack-ratios/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const outer = (req.body?.outer_unit ?? "").trim();
        const inner = (req.body?.inner_unit ?? "").trim();
        const cnt = parseFloat(String(req.body?.inner_count ?? "").trim());
        const note = (req.body?.note ?? "").trim() || null;
        const embed = req.body?.embed === "1";
        const returnUrl = safeAdminReturnPath(typeof req.body?.return === "string" ? req.body.return : "") || "";
        const ctxRaw = (req.body?.context_raw ?? "").trim();
        const ctxUnit = (req.body?.context_unit ?? "").trim();
        const qCtx = (ctxRaw ? "&context_raw=" + encodeURIComponent(ctxRaw) : "") + (ctxUnit ? "&context_unit=" + encodeURIComponent(ctxUnit) : "");
        const buildPackRedirect = (errMsg) => {
            const base = "/admin/products/" + encodeURIComponent(productId) + "/edit";
            if (errMsg)
                return base + "?err=" + encodeURIComponent(errMsg) + (embed ? "&embed=1" : "") + (returnUrl && embed ? "&return=" + encodeURIComponent(returnUrl) : "") + qCtx;
            return base + "?ok=pack_add" + (embed ? "&embed=1" : "") + (returnUrl && embed ? "&return=" + encodeURIComponent(returnUrl) : "") + qCtx;
        };
        if (!outer || !inner || !Number.isFinite(cnt) || cnt <= 0) {
            res.redirect(302, buildPackRedirect("請填寫外層／內層單位，且數量須大於 0"));
            return;
        }
        const rid = (0, id_js_1.newId)("ppr");
        try {
            await db.prepare("INSERT INTO product_packaging_ratios (id, product_id, outer_unit, inner_unit, inner_count, note, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").run(rid, productId, outer, inner, cnt, note);
        }
        catch (e) {
            const msg = String(e?.message || "").includes("UNIQUE") || String(e?.code || "") === "23505"
                ? "此包裝組合已存在（同品項、同外層／內層）"
                : "新增失敗：" + (e.message || "");
            res.redirect(302, buildPackRedirect(msg));
            return;
        }
        await logDataChange(req, {
            entityType: "product_pack_ratio",
            entityId: rid,
            productId,
            action: "create",
            summary: `包裝：1 ${outer} = ${cnt} ${inner}`,
            meta: { outer_unit: outer, inner_unit: inner, inner_count: cnt },
        });
        res.redirect(302, buildPackRedirect(""));
    });
    router.post("/products/:id/pack-ratios/:rid/delete", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const rid = req.params.rid;
        const row = await db.prepare("SELECT id, outer_unit, inner_unit FROM product_packaging_ratios WHERE id = ? AND product_id = ?").get(rid, productId);
        if (!row) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?err=" + encodeURIComponent("找不到此包裝規格"));
            return;
        }
        await db.prepare("DELETE FROM product_packaging_ratios WHERE id = ?").run(rid);
        await logDataChange(req, {
            entityType: "product_pack_ratio",
            entityId: rid,
            productId,
            action: "delete",
            summary: `刪除包裝：${String(row.outer_unit)}→${String(row.inner_unit)}`,
            meta: {},
        });
        const embed = req.body?.embed === "1";
        const returnUrl = safeAdminReturnPath(typeof req.body?.return === "string" ? req.body.return : "") || "";
        let u = "/admin/products/" + encodeURIComponent(productId) + "/edit?ok=pack_del";
        if (embed)
            u += "&embed=1";
        if (returnUrl && embed)
            u += "&return=" + encodeURIComponent(returnUrl);
        res.redirect(302, u);
    });
    router.get("/aliases/:id/edit", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT pa.id, pa.alias, pa.product_id, p.name AS product_name FROM product_aliases pa JOIN products p ON p.id = pa.product_id WHERE pa.id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const errMsg = req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / <a href="/admin/products/${encodeURIComponent(row.product_id)}/aliases">俗名管理</a> / 編輯俗名</div>
        <h1 class="notion-page-title">編輯俗名</h1>
        <div class="notion-card">
          <p>品項：${escapeHtml(row.product_name)}</p>
          ${errMsg}
          <form method="post" action="/admin/aliases/${encodeURIComponent(id)}/edit">
            <label>別名 <input type="text" name="alias" value="${escapeAttr(row.alias)}" required style="width:100%;"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
        <p><a href="/admin/products/${encodeURIComponent(row.product_id)}/aliases">← 回俗名管理</a></p>
      `;
        res.type("text/html").send(notionPage("編輯俗名", body, "", res));
    });
    router.post("/aliases/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const aliasTrim = req.body?.alias?.trim();
        if (!aliasTrim) {
            res.redirect("/admin/aliases/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("別名不可為空"));
            return;
        }
        const row = await db.prepare("SELECT id, product_id, alias FROM product_aliases WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const existing = await db.prepare("SELECT id FROM product_aliases WHERE alias = ? AND id != ?").get(aliasTrim, id);
        if (existing) {
            res.redirect("/admin/aliases/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("此別名已被其他品項使用"));
            return;
        }
        const oldAlias = String(row.alias ?? "");
        await db.prepare("UPDATE product_aliases SET alias = ? WHERE id = ?").run(aliasTrim, id);
        if (oldAlias !== aliasTrim) {
            await logDataChange(req, {
                entityType: "product_alias",
                entityId: id,
                productId: row.product_id,
                action: "update",
                summary: `俗名「${oldAlias}」→「${aliasTrim}」`,
                meta: { from: oldAlias, to: aliasTrim },
            });
        }
        res.redirect("/admin/products/" + encodeURIComponent(row.product_id) + "/aliases?ok=1");
    });
    router.post("/aliases/:id/delete", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT product_id, alias FROM product_aliases WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const aliasStr = String(row.alias ?? "");
        await db.prepare("DELETE FROM product_aliases WHERE id = ?").run(id);
        await logDataChange(req, {
            entityType: "product_alias",
            entityId: id,
            productId: row.product_id,
            action: "delete",
            summary: `刪除俗名「${aliasStr}」`,
            meta: { alias: aliasStr },
        });
        res.redirect("/admin/products/" + encodeURIComponent(row.product_id) + "/aliases?ok=del");
    });
    router.post("/products/:id/aliases/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const aliasTrim = (req.body?.alias ?? "").trim();
        const embed = req.body?.embed === "1";
        const returnRaw = typeof req.body?.return === "string" ? req.body.return : "";
        const returnUrl = safeAdminReturnPath(returnRaw) || "";
        const qEmbed = embed ? "&embed=1" + (returnUrl ? "&return=" + encodeURIComponent(returnUrl) : "") : "";
        const ctxRaw = (req.body?.context_raw ?? "").trim();
        const ctxUnit = (req.body?.context_unit ?? "").trim();
        const qCtx = (ctxRaw ? "&context_raw=" + encodeURIComponent(ctxRaw) : "") + (ctxUnit ? "&context_unit=" + encodeURIComponent(ctxUnit) : "");
        if (!aliasTrim) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?err=" + encodeURIComponent("請填寫俗名") + qEmbed + qCtx);
            return;
        }
        const dup = await db.prepare("SELECT id FROM product_aliases WHERE alias = ?").get(aliasTrim);
        if (dup) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?err=" + encodeURIComponent("此俗名已被使用") + qEmbed + qCtx);
            return;
        }
        const paId = (0, id_js_1.newId)("pa");
        try {
            await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run(paId, productId, aliasTrim);
        }
        catch (e) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?err=" + encodeURIComponent("新增失敗：" + (e.message || "")) + qEmbed + qCtx);
            return;
        }
        await logDataChange(req, {
            entityType: "product_alias",
            entityId: paId,
            productId,
            action: "create",
            summary: `新增俗名「${aliasTrim}」`,
            meta: { alias: aliasTrim },
        });
        res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?ok=alias_add" + qEmbed + qCtx);
    });
    router.get("/products/:id/edit", async (req, res) => {
        const productId = req.params.id;
        const row = await db.prepare("SELECT id, name, erp_code, teraoka_barcode, unit, active FROM products WHERE id = ?").get(productId);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const embed = req.query.embed === "1" || req.query.embed === "true";
        const returnUrl = safeAdminReturnPath(typeof req.query.return === "string" ? req.query.return : "") || "";
        const contextRaw = typeof req.query.context_raw === "string" ? req.query.context_raw : "";
        const contextUnit = typeof req.query.context_unit === "string" ? req.query.context_unit : "";
        const hasOrderContext = contextRaw.trim().length > 0;
        const defaultSpecUnit = (contextUnit && contextUnit.trim()) ? contextUnit.trim() : "包";
        const aliases = await db.prepare("SELECT id, alias FROM product_aliases WHERE product_id = ? ORDER BY alias").all(productId);
        let unitSpecs = [];
        let packRatios = [];
        try {
            unitSpecs = await db.prepare("SELECT id, unit, note_label, conversion_kg FROM product_unit_specs WHERE product_id = ? ORDER BY unit").all(productId);
        }
        catch (_) {
            unitSpecs = [];
        }
        try {
            packRatios = await db.prepare("SELECT id, outer_unit, inner_unit, inner_count, note FROM product_packaging_ratios WHERE product_id = ? ORDER BY outer_unit, inner_unit").all(productId);
        }
        catch (_) {
            packRatios = [];
        }
        const fmtKgDisplay = (n) => {
            const x = Number(n);
            if (!Number.isFinite(x))
                return "—";
            return String(x.toFixed(4)).replace(/\.?0+$/, "");
        };
        const { kgMap: derivedKgMap, directSet: derivedDirect } = computeDerivedKgByUnit(unitSpecs, packRatios);
        let recentLogs = [];
        try {
            recentLogs = await db.prepare("SELECT action, summary, actor_username, created_at FROM data_change_log WHERE product_id = ? ORDER BY created_at DESC LIMIT 25").all(productId);
        }
        catch (_) {
            recentLogs = [];
        }
        const unitOptsHtml = ORDER_LINE_UNITS.map((u) => `<option value="${escapeAttr(u)}" ${String(row.unit) === u ? "selected" : ""}>${escapeHtml(u)}</option>`).join("");
        const linkTarget = "";
        const formTarget = "";
        const specTableRows = unitSpecs.map((s) => {
            const kgDisp = s.conversion_kg != null ? `${fmtKgDisplay(s.conversion_kg)} kg` : "—";
            const hid = `<input type="hidden" name="redirect_to_edit" value="1"><input type="hidden" name="embed" value="${embed ? "1" : ""}"><input type="hidden" name="return" value="${escapeAttr(returnUrl)}">`;
            return `<tr><td>${escapeHtml(s.unit)}</td><td>${escapeHtml(s.note_label ?? "")}</td><td>${escapeHtml(kgDisp)}</td><td><form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs/${encodeURIComponent(s.id)}/delete"${formTarget} style="display:inline;margin:0;">${hid}<button type="submit" class="btn">刪除</button></form></td></tr>`;
        }).join("");
        const packTableRows = packRatios.map((r) => {
            const hid = `<input type="hidden" name="embed" value="${embed ? "1" : ""}"><input type="hidden" name="return" value="${escapeAttr(returnUrl)}">`;
            return `<tr><td>${escapeHtml(r.outer_unit)}</td><td style="text-align:right;">${escapeHtml(String(r.inner_count))}</td><td>${escapeHtml(r.inner_unit)}</td><td>${escapeHtml(r.note ?? "")}</td><td><form method="post" action="/admin/products/${encodeURIComponent(productId)}/pack-ratios/${encodeURIComponent(r.id)}/delete"${formTarget} style="display:inline;margin:0;">${hid}<button type="submit" class="btn">刪除</button></form></td></tr>`;
        }).join("");
        const derivedLines = [...derivedKgMap.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-Hant"));
        const derivedHtml = derivedLines.length === 0
            ? `<p class="notion-hint" style="margin:0;">尚無公斤換算。請先在「2-2」填<strong>最內層叫貨單位</strong>（如：一包、一罐）的公斤；再視需要於「2-3」設定 1 箱＝幾包。</p>`
            : `<ul class="pu-derived" style="margin:0;padding-left:0;list-style:none;">${derivedLines.map(([u, k]) => {
                const tag = derivedDirect.has(u) ? "直接" : "推算";
                return `<li style="margin:4px 0;"><span class="pu-sop-badge">${escapeHtml(tag)}</span> 1 <strong>${escapeHtml(u)}</strong> ≈ <strong>${escapeHtml(fmtKgDisplay(k))}</strong> 公斤</li>`;
            }).join("")}</ul>`;
        const aliasRows = aliases.map((a) => `<tr><td>${escapeHtml(a.alias)}</td><td><a href="/admin/aliases/${encodeURIComponent(a.id)}/edit"${linkTarget}>編輯</a> | <form method="post" action="/admin/aliases/${encodeURIComponent(a.id)}/delete" style="display:inline;"${embed ? ' target="_parent"' : ""}><button type="submit">刪除</button></form></td></tr>`).join("");
        const logRows = recentLogs.map((l) => `<tr><td style="white-space:nowrap;font-size:12px;">${escapeHtml(String(l.created_at ?? ""))}</td><td>${escapeHtml(String(l.actor_username ?? "—"))}</td><td>${escapeHtml(String(l.action ?? ""))}</td><td>${escapeHtml(String(l.summary ?? "—"))}</td></tr>`).join("");
        const errMsg = req.query.err ? `<div class="notion-msg err">${escapeHtml(String(req.query.err))}</div>` : "";
        const okFlash = req.query.ok === "alias_add"
            ? `<div class="notion-msg ok">已新增俗名。</div>`
            : req.query.ok === "spec_add"
                ? `<div class="notion-msg ok">已新增叫貨單位換算。${req.query.sync_line === "1" ? "已更新 <strong>LINE 叫貨單位換算</strong>規則（與進線換算一致）。" : ""}</div>`
                : req.query.ok === "spec_del"
                    ? `<div class="notion-msg ok">已刪除一筆叫貨單位換算。</div>`
                    : req.query.ok === "pack_add"
                        ? `<div class="notion-msg ok">已新增包裝規格。</div>`
                        : req.query.ok === "pack_del"
                            ? `<div class="notion-msg ok">已刪除包裝規格。</div>`
                            : "";
        const embedHint = embed
            ? `<p class="notion-hint">嵌入模式：儲存基本資料或完成下方步驟後，可關閉視窗或按「返回」回到訂單。</p>`
            : "";
        const hiddenReturn = returnUrl ? `<input type="hidden" name="redirect" value="${escapeAttr(returnUrl)}">` : "";
        const hiddenEmbed = embed ? `<input type="hidden" name="embed" value="1">` : "";
        const orderCtxBlock = hasOrderContext
            ? `<div class="pu-order-ctx">
          <strong>本筆訂單帶入</strong>　原始品名：<strong>${escapeHtml(contextRaw)}</strong>　原始單位：<strong>${escapeHtml((contextUnit || "").trim() || "—")}</strong>
          <p class="notion-hint" style="margin:8px 0 0;">可先完成 2-1 俗名，再在 2-2 用相同單位填公斤；冷凍／箱裝請再設 2-3。</p>
        </div>`
            : "";
        const chipUnits = ["包", "把", "小把", "罐", "箱", "盒", "入", "斤"];
        const unitChipsHtml = chipUnits.map((cu) => `<button type="button" class="pu-chip" data-target="puSpecUnitInput" data-unit="${escapeAttr(cu)}">${escapeHtml(cu)}</button>`).join("");
        const packUnitOptionsHtml = ORDER_LINE_UNITS.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("");
        const packOuterSelectHtml = `<select name="outer_unit" required class="pu-pack-unit" aria-label="外層單位" style="width:5.5rem;">
            <option value="" disabled selected>外層</option>${packUnitOptionsHtml}</select>`;
        const packInnerSelectHtml = `<select name="inner_unit" required class="pu-pack-unit" aria-label="內層單位" style="width:5.5rem;">
            <option value="" disabled selected>內層</option>${packUnitOptionsHtml}</select>`;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / 編輯品項</div>
        <h1 class="notion-page-title" id="unit-sop">編輯品項</h1>
        <p style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px;">
          <a href="#unit-sop" class="btn">1.基本資料</a>
          <a href="#step-21" class="btn">2-1 俗名</a>
          <a href="#step-22" class="btn">2-2 單位→公斤</a>
          <a href="#step-23" class="btn">2-3 包裝規格</a>
          <a href="#step-24" class="btn">2-4 推算</a>
        </p>
        ${embedHint}
        ${errMsg}
        ${okFlash}
        <div class="notion-card">
          <h2 style="margin-top:0;">1. 基本資料（主檔）</h2>
          <p class="notion-hint" style="margin-top:0;">標準品名、ERP／條碼、預設單位。與下方「叫貨單位」可不同（青菜常出現包／把等非主檔單位）。</p>
          <form method="post" action="/admin/products/${encodeURIComponent(row.id)}/edit"${formTarget}>
            ${hiddenReturn}
            ${hiddenEmbed}
            <label>標準品名 <input type="text" name="name" value="${escapeAttr(row.name)}" required style="width:100%;"></label>
            <label>凌越料號 <input type="text" name="erp_code" value="${escapeAttr(row.erp_code ?? "")}" style="width:100%;"></label>
            <label>寺岡條碼 <input type="text" name="teraoka_barcode" value="${escapeAttr(row.teraoka_barcode ?? "")}" style="width:100%;"></label>
            <label>主檔預設單位 <select name="unit" style="width:100%;">${unitOptsHtml}</select></label>
            <label><input type="checkbox" name="active" value="1" ${row.active === 1 ? "checked" : ""}> 啟用（未勾選即停用）</label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存基本資料</button></p>
          </form>
        </div>
        <div class="notion-card pu-sop">
          <h2 style="margin-top:0;">2. 單位與換算（俗名／非規格／包裝／推算）</h2>
          <p class="pu-sop-intro"><strong>建議順序：</strong>2-1 俗名 → 2-2 <strong>非規格</strong>（叫貨單位直接換公斤，青菜常用）→ 2-3 <strong>規格</strong>（一箱幾包、一箱幾罐）→ 2-4 看推算。2-2 填公斤換算時會<strong>自動</strong>寫入 LINE 叫貨單位換算規則。</p>
          ${orderCtxBlock}
          <details class="pu-sop-step" open id="step-21">
            <summary>2-1 俗名（客戶用語 → 本品項）</summary>
            <div class="pu-step-body">
              <p class="step-hint">全公司有效；與「主檔品名」不同時特別有用。</p>
              <table style="font-size:13px;"><thead><tr><th>俗名</th><th>操作</th></tr></thead><tbody>${aliasRows || "<tr><td colspan='2'>尚無俗名</td></tr>"}</tbody></table>
              <form method="post" action="/admin/products/${encodeURIComponent(productId)}/aliases/add" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;max-width:640px;"${formTarget}>
                <input type="hidden" name="return" value="${escapeAttr(returnUrl)}">
                ${embed ? `<input type="hidden" name="embed" value="1">` : ""}
                <input type="hidden" name="context_raw" value="${escapeAttr(contextRaw)}">
                <input type="hidden" name="context_unit" value="${escapeAttr(contextUnit)}">
                <label style="margin:0;flex:1;min-width:200px;">新增俗名 <input type="text" name="alias" placeholder="例：薑絲一包、大陸妹" required style="width:100%;"></label>
                <button type="submit" class="btn btn-primary">新增</button>
              </form>
              <p class="notion-hint" style="margin-bottom:0;"><a href="/admin/products/${encodeURIComponent(productId)}/aliases"${linkTarget}>開啟舊版俗名整頁</a>（一般不必）</p>
            </div>
          </details>
          <details class="pu-sop-step" open id="step-22">
            <summary>2-2 叫貨單位 → 公斤（<strong>非規格</strong>，最常用）</summary>
            <div class="pu-step-body">
              <p class="step-hint">客戶下單用的單位字（一包、一小把、一罐…），對應<strong>幾公斤</strong>。與主檔「預設單位」可不同。</p>
              <div class="pu-chip-row"><span class="notion-hint" style="margin:0;">快速帶入單位：</span>${unitChipsHtml}</div>
              <table style="font-size:13px;"><thead><tr><th>叫貨單位</th><th>備註</th><th>每 1 單位＝</th><th></th></tr></thead><tbody>${specTableRows || "<tr><td colspan='4'>尚無，請用下方表單新增</td></tr>"}</tbody></table>
              <form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--notion-border);"${formTarget}>
                <input type="hidden" name="return" value="${escapeAttr(returnUrl)}">
                ${embed ? `<input type="hidden" name="embed" value="1">` : ""}
                <input type="hidden" name="redirect_to_edit" value="1">
                <input type="hidden" name="context_raw" value="${escapeAttr(contextRaw)}">
                <input type="hidden" name="context_unit" value="${escapeAttr(contextUnit)}">
                <label style="display:inline-block;margin-right:10px;">叫貨單位 <input type="text" name="unit" id="puSpecUnitInput" required value="${escapeAttr(defaultSpecUnit)}" placeholder="包、把…" style="width:5rem;"></label>
                <label style="display:inline-block;margin-right:10px;">備註 <input type="text" name="note_label" placeholder="選填" style="width:7rem;"></label>
                <label style="display:inline-block;">每 1 單位＝ <input type="number" name="conversion_kg" step="0.001" min="0.001" value="1" style="width:5rem;"> 公斤</label>
                <p class="notion-hint" style="margin:10px 0 0;">有填公斤換算時，會自動更新 <strong>LINE 叫貨單位換算</strong>規則（與進線訂單換算一致，無須另勾選）。</p>
                <p style="margin-top:10px;"><button type="submit" class="btn btn-primary">新增一筆 2-2</button></p>
              </form>
            </div>
          </details>
          <details class="pu-sop-step" open id="step-23">
            <summary>2-3 包裝規格（<strong>規格</strong>：箱／盒與內層）</summary>
            <div class="pu-step-body">
              <p class="step-hint">描述「1 外層＝幾個內層」，例如 1 箱＝12 包、1 箱＝24 罐。內層重量請在 2-2 先填好，本區會一併<strong>推算</strong>外層公斤（2-4）。</p>
              <table style="font-size:13px;"><thead><tr><th>1 外層單位</th><th>＝ 幾個內層</th><th>內層單位</th><th>備註</th><th></th></tr></thead><tbody>${packTableRows || "<tr><td colspan='5'>尚無包裝關係</td></tr>"}</tbody></table>
              <form method="post" action="/admin/products/${encodeURIComponent(productId)}/pack-ratios/add" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--notion-border);"${formTarget}>
                <input type="hidden" name="return" value="${escapeAttr(returnUrl)}">
                ${embed ? `<input type="hidden" name="embed" value="1">` : ""}
                <input type="hidden" name="context_raw" value="${escapeAttr(contextRaw)}">
                <input type="hidden" name="context_unit" value="${escapeAttr(contextUnit)}">
                <span style="display:inline-flex;align-items:center;gap:4px;margin-right:8px;">1 ${packOuterSelectHtml}</span>
                <span style="margin:0 4px;">＝</span>
                <input type="number" name="inner_count" step="0.001" min="0.001" value="1" required style="width:4.5rem;">
                <span style="display:inline-flex;align-items:center;margin-left:8px;">${packInnerSelectHtml}</span>
                <label style="display:inline-block;margin-left:10px;">備註 <input type="text" name="note" placeholder="選填" style="width:6rem;"></label>
                <p style="margin-top:10px;"><button type="submit" class="btn btn-primary">新增包裝關係</button></p>
              </form>
            </div>
          </details>
          <details class="pu-sop-step" open id="step-24">
            <summary>2-4 推算：各叫貨單位約幾公斤</summary>
            <div class="pu-step-body">
              <p class="step-hint"><span class="pu-sop-badge">直接</span>＝在 2-2 填寫；<span class="pu-sop-badge">推算</span>＝由 2-2＋2-3 計算。外層單位若要進 LINE，請在 2-2 為該單位各別新增並勾選同步（或至 <a href="/admin/line-bot/unit-conversion"${linkTarget}>叫貨單位換算</a>）。</p>
              ${derivedHtml}
            </div>
          </details>
        </div>
        <details class="notion-card">
          <summary style="cursor:pointer;font-weight:600;">變更紀錄</summary>
          <div style="margin-top:12px;">
            <p class="notion-hint">品項、俗名、規格異動。</p>
            <div style="overflow-x:auto;">
              <table style="font-size:13px;"><thead><tr><th>時間</th><th>操作者</th><th>動作</th><th>摘要</th></tr></thead><tbody>${logRows || "<tr><td colspan='4'>尚無紀錄</td></tr>"}</tbody></table>
            </div>
          </div>
        </details>
        <p>${embed ? `<a href="${escapeAttr(returnUrl || "/admin/products")}"${linkTarget}>← 返回</a>` : `<a href="/admin/products">← 回品項列表</a>`}</p>
        <script>
        (function(){
          document.querySelectorAll(".pu-chip[data-target][data-unit]").forEach(function(btn){
            btn.addEventListener("click", function(){
              var id = this.getAttribute("data-target");
              var u = this.getAttribute("data-unit") || "";
              var el = id && document.getElementById(id);
              if (el) { el.value = u; el.focus(); }
            });
          });
        })();
        </script>
      `;
        const html = embed ? notionEmbedPage("編輯品項", body, res) : notionPage("編輯品項", body, "", res);
        res.type("text/html").send(html);
    });
    router.post("/products/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const old = await db.prepare("SELECT id, name, erp_code, teraoka_barcode, unit, active FROM products WHERE id = ?").get(id);
        if (!old) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const name = (req.body?.name ?? "").trim();
        if (!name) {
            res.redirect("/admin/products/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("品名不可為空") + productEditEmbedQuery(req.body));
            return;
        }
        const existing = await db.prepare("SELECT id FROM products WHERE name = ? AND id != ?").get(name, id);
        if (existing) {
            res.redirect("/admin/products/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("品名已存在") + productEditEmbedQuery(req.body));
            return;
        }
        const erpCode = (req.body?.erp_code ?? "").trim() || null;
        const teraokaBarcode = (req.body?.teraoka_barcode ?? "").trim() || null;
        const unit = (req.body?.unit ?? "公斤").trim() || "公斤";
        const active = req.body?.active === "1" ? 1 : 0;
        const meta = {};
        if (String(old.name) !== name)
            meta.name = { from: old.name, to: name };
        if (String(old.erp_code ?? "") !== String(erpCode ?? ""))
            meta.erp_code = { from: old.erp_code, to: erpCode };
        if (String(old.teraoka_barcode ?? "") !== String(teraokaBarcode ?? ""))
            meta.teraoka_barcode = { from: old.teraoka_barcode, to: teraokaBarcode };
        if (String(old.unit ?? "") !== String(unit))
            meta.unit = { from: old.unit, to: unit };
        const oldActive = old.active === 1 || old.active === "1" ? 1 : 0;
        if (oldActive !== active)
            meta.active = { from: oldActive, to: active };
        await db.prepare("UPDATE products SET name = ?, erp_code = ?, teraoka_barcode = ?, unit = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, erpCode, teraokaBarcode, unit, active, id);
        if (Object.keys(meta).length > 0) {
            await logDataChange(req, {
                entityType: "product",
                entityId: id,
                productId: id,
                action: "update",
                summary: `更新品項「${name}」`,
                meta,
            });
        }
        const red = safeAdminReturnPath(typeof req.body?.redirect === "string" ? req.body.redirect : "");
        if (red) {
            res.redirect(302, appendQueryToAdminPath(red, "ok", "prod_edit"));
            return;
        }
        res.redirect("/admin/products?ok=edit");
    });
    router.post("/api/products/:id/toggle", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id, active FROM products WHERE id = ?").get(id);
        if (!row) {
            res.status(404).json({ ok: false, err: "找不到此品項" });
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE products SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.json({ ok: true, active: next });
    });
    router.post("/products/:id/toggle", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id, active FROM products WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE products SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.redirect("/admin/products?ok=toggle");
    });
    router.get("/products/:id/delete", async (req, res) => {
        const id = req.params.id;
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(id);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const refCount = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?").get(id);
        const hasOrders = (refCount?.c ?? 0) > 0;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除品項</h1>
        <div class="notion-card">
          <p>確定要刪除「${escapeHtml(product.name)}」？</p>
          ${hasOrders ? '<p class="notion-msg err">此品項已被訂單使用，無法刪除。請改為「停用」。</p>' : ""}
          <p style="margin-top:16px;">
            ${!hasOrders ? `<form method="post" action="/admin/products/${encodeURIComponent(id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form> ` : ""}
            <a href="/admin/products" class="btn">取消</a>
          </p>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("確認刪除品項", body, "", res));
    });
    router.post("/products/:id/delete", async (req, res) => {
        const id = req.params.id;
        const refCount = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?").get(id);
        if ((refCount?.c ?? 0) > 0) {
            res.redirect("/admin/products?err=" + encodeURIComponent("此品項已被訂單使用，無法刪除。請改為停用。"));
            return;
        }
        await db.prepare("DELETE FROM products WHERE id = ?").run(id);
        res.redirect("/admin/products?ok=del");
    });
    router.get("/import", async (req, res) => {
        const msg = req.query.ok ? `<p style='color:green'>已匯入 ${req.query.ok} 筆品項。</p>` : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 匯入品項</div>
        <h1 class="notion-page-title">匯入品項</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("已匯入") >= 0 ? "ok" : "err"}">${msg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <h2>支援欄位</h2>
          <p>第一列為標題。</p>
          <ul>
            <li>品名：<code>CommName</code>、<code>標準品名</code>、<code>name</code></li>
            <li>寺岡號碼（條碼）：<code>PluCode</code>、<code>寺岡條碼</code>、<code>teraoka_barcode</code></li>
            <li>凌越料號：<code>HQPluCode</code>、<code>ERP料號</code>、<code>erp_code</code></li>
            <li>單位：<code>QtySymbol</code>、<code>單位</code>、<code>unit</code></li>
          </ul>
          <p>同一品名已存在時會略過不覆蓋。</p>
          <p class="notion-hint">若出現「Service Unavailable」或逾時，可能是筆數過多：請改為分批匯入（每批約 200～500 筆），或在 Cloud Run 將「請求逾時」設為 300 秒。</p>
          <form method="post" action="/admin/import" enctype="multipart/form-data">
            <label>匯入時若單位為空，使用：<select name="default_unit">
              <option value="公斤">公斤</option>
              <option value="斤">斤</option>
              <option value="把">把</option>
              <option value="包">包</option>
              <option value="箱">箱</option>
              <option value="顆">顆</option>
              <option value="粒">粒</option>
              <option value="盒">盒</option>
              <option value="袋">袋</option>
            </select></label>
            <label>上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
            <label>或貼上 CSV：<textarea name="csv" placeholder="貼上 CSV 內容..." style="width:100%;height:160px;"></textarea></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">匯入</button></p>
          </form>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("匯入品項", body, "", res));
    });
    router.post("/import", upload, async (req, res) => {
        try {
            const sheet = parseRequestToSheet(req);
            if (!sheet || sheet.rows.length === 0) {
                res.redirect("/admin/import?err=" + encodeURIComponent("請貼上 CSV 或上傳 Excel 檔案"));
                return;
            }
            const defaultUnit = (req.body?.default_unit?.trim()) || "公斤";
            const { header, rows } = sheet;
            const h = (i) => (header[i] ?? "").trim().toLowerCase().replace(/\s+/g, "_");
            const nameIdx = header.findIndex((_, i) => {
                const v = h(i);
                return ["標準品名", "品名", "名稱", "name", "commname", "comm_name"].includes(v);
            });
            const erpIdx = header.findIndex((_, i) => ["erp料號", "erp_code", "hqplucode"].includes(h(i)));
            const teraokaIdx = header.findIndex((_, i) => ["寺岡條碼", "teraoka_barcode", "plucode"].includes(h(i)));
            const unitIdx = header.findIndex((_, i) => ["單位", "unit", "qtysymbol"].includes(h(i)));
            if (nameIdx === -1) {
                const headerPreview = header.length > 12 ? header.slice(0, 12).join("、") + "…" : header.join("、") || "（無）";
                res.redirect("/admin/import?err=" + encodeURIComponent("找不到品名欄位（請有 CommName、標準品名、品名或 name）。偵測到的標題：" + headerPreview));
                return;
            }
            let imported = 0;
            const existingNames = new Set((await db.prepare("SELECT name FROM products").all()).map((r) => r.name));
            for (let i = 0; i < rows.length; i++) {
                const cols = rows[i];
                const name = (cols[nameIdx] ?? "").trim();
                if (!name)
                    continue;
                if (existingNames.has(name))
                    continue;
                const erpCode = erpIdx >= 0 ? (cols[erpIdx] ?? "").trim() || null : null;
                const teraoka = teraokaIdx >= 0 ? (cols[teraokaIdx] ?? "").trim() || null : null;
                const unitCell = unitIdx >= 0 ? (cols[unitIdx] ?? "").trim() : "";
                const unit = unitCell || defaultUnit;
                const id = (0, id_js_1.newId)("prod");
                await db.prepare("INSERT INTO products (id, name, erp_code, teraoka_barcode, unit) VALUES (?, ?, ?, ?, ?)").run(id, name, erpCode, teraoka, unit);
                existingNames.add(name);
                imported++;
            }
            res.redirect("/admin/import?ok=" + imported);
        }
        catch (e) {
            console.error("[admin] 匯入品項錯誤:", e);
            const msg = (e && e.message) ? String(e.message) : String(e);
            res.redirect("/admin/import?err=" + encodeURIComponent("匯入失敗：" + (msg.length > 200 ? msg.slice(0, 200) + "…" : msg)));
        }
    });
    router.get("/import-customers", async (req, res) => {
        const msg = req.query.ok ? `<p style='color:green'>匯入結果：${escapeHtml(String(req.query.ok))}。</p>` : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 匯入客戶</div>
        <h1 class="notion-page-title">匯入客戶</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("匯入結果") >= 0 ? "ok" : "err"}">${msg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <h2>支援欄位（第一列為標題）</h2>
          <ul>
            <li><strong>CustName</strong> / 客戶名稱（必填）</li>
            <li><strong>LineGroupId</strong> / LINE 群組 ID（綁定叫貨群組）</li>
            <li><strong>CustCode</strong> → 寺岡編號、<strong>HQCustCode</strong> → 凌越編號</li>
            <li>聯絡：<code>CustTel</code>、<code>Fax</code>、<code>Contact</code>、<code>Email</code> 會合併</li>
          </ul>
          <p><strong>大量群組</strong>：在各群組傳「取得群組ID」，機器人會回傳該群組 ID；收集成 Excel 後用「客戶名稱 + LINE群組ID」匯入即可批次綁定。</p>
          <pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);font-size:13px;overflow:auto;">客戶名稱, LINE群組ID, 聯絡
XX餐廳, C1234..., 02-12345678
YY小吃, C5678...,</pre>
          <form method="post" action="/admin/import-customers" enctype="multipart/form-data">
            <label>上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
            <label>或貼上 CSV：<textarea name="csv" placeholder="貼上 CSV 內容..." style="width:100%;height:160px;"></textarea></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">匯入</button></p>
          </form>
        </div>
        <p style="margin-top:16px;"><a href="/admin/customers" class="btn">← 回客戶列表</a></p>
        `;
        res.type("text/html").send(notionPage("匯入客戶", body, "", res));
    });
    router.post("/import-customers", upload, async (req, res) => {
        const sheet = parseRequestToSheet(req);
        if (!sheet || sheet.rows.length === 0) {
            res.redirect("/admin/import-customers?err=" + encodeURIComponent("請貼上 CSV 或上傳 Excel 檔案"));
            return;
        }
        const { header, rows } = sheet;
        const h = (i) => (header[i] ?? "").trim().toLowerCase().replace(/\s+/g, "_");
        const nameIdx = header.findIndex((_, i) => ["客戶名稱", "name", "custname"].includes(h(i)));
        const lineGroupIdIdx = header.findIndex((_, i) => ["linegroupid", "line_group_id", "line群組id"].includes(h(i)));
        const custCodeIdx = header.findIndex((_, i) => h(i) === "custcode");
        const hqCustCodeIdx = header.findIndex((_, i) => h(i) === "hqcustcode");
        const custTelIdx = header.findIndex((_, i) => ["custtel", "聯絡", "contact"].includes(h(i)));
        const faxIdx = header.findIndex((_, i) => h(i) === "fax");
        const contactIdx = header.findIndex((_, i) => h(i) === "contact");
        const emailIdx = header.findIndex((_, i) => h(i) === "email");
        if (nameIdx === -1) {
            res.redirect("/admin/import-customers?err=" + encodeURIComponent("找不到客戶名稱欄位（請有 客戶名稱 / name / CustName）"));
            return;
        }
        let imported = 0;
        let updated = 0;
        for (let i = 0; i < rows.length; i++) {
            const cols = rows[i];
            const name = (cols[nameIdx] ?? "").trim();
            if (!name)
                continue;
            const teraokaCode = custCodeIdx >= 0 ? (cols[custCodeIdx] ?? "").trim() || null : null;
            const hqCustCode = hqCustCodeIdx >= 0 ? (cols[hqCustCodeIdx] ?? "").trim() || null : null;
            const lineGroupId = lineGroupIdIdx >= 0 ? (cols[lineGroupIdIdx] ?? "").trim() || null : null;
            const contactParts = [custTelIdx, faxIdx, contactIdx, emailIdx]
                .filter((idx) => idx >= 0)
                .map((idx) => (cols[idx] ?? "").trim())
                .filter(Boolean);
            const contact = contactParts.length > 0 ? contactParts.join(" / ") : null;
            const existing = await db.prepare("SELECT id FROM customers WHERE name = ?").get(name);
            if (existing) {
                await db.prepare("UPDATE customers SET teraoka_code = COALESCE(?, teraoka_code), hq_cust_code = COALESCE(?, hq_cust_code), contact = COALESCE(?, contact), line_group_id = COALESCE(?, line_group_id), updated_at = datetime('now') WHERE id = ?").run(teraokaCode ?? null, hqCustCode ?? null, contact ?? null, lineGroupId || null, existing.id);
                if (lineGroupId)
                    updated++;
            }
            else {
                await db.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_id, contact) VALUES (?, ?, ?, ?, ?, ?)").run((0, id_js_1.newId)("cust"), name, teraokaCode, hqCustCode, lineGroupId, contact);
                imported++;
            }
        }
        const resultMsg = imported > 0 ? `新增 ${imported} 筆` : "";
        const resultMsg2 = updated > 0 ? (resultMsg ? "；" : "") + `更新 ${updated} 筆 LINE 群組綁定` : "";
        res.redirect("/admin/import-customers?ok=" + encodeURIComponent(resultMsg + resultMsg2 || "0"));
    });
    router.get("/import-teraoka", async (req, res) => {
        const ok = req.query.ok;
        const matched = req.query.matched;
        const unmatched = req.query.unmatched;
        let msg = "";
        if (ok === "1" && matched !== undefined)
            msg = `<p class="notion-msg ok">對照完成。已更新寺岡條碼：${matched} 筆。</p>`;
        if (unmatched !== undefined && unmatched !== "0")
            msg += `<p class="notion-msg err">未對應到品項（請先建品項或俗名）：${unmatched} 筆。</p>`;
        if (req.query.err)
            msg += `<p class="notion-msg err">${escapeHtml(String(req.query.err))}</p>`;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 寺岡資料對照</div>
        <h1 class="notion-page-title">寺岡資料對照</h1>
        ${msg}
        <div class="notion-card">
          <p>貼上<strong>寺岡匯出的 CSV</strong>，系統會依<strong>品名</strong>對照到現有品項，並寫入<strong>寺岡條碼</strong>。</p>
          <p>第一列為標題，需有「品名」或「名稱」欄（對應我們的標準品名或俗名）、以及「條碼」或「編號」欄（寺岡條碼）。</p>
          <pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);font-size:13px;overflow:auto;">品名, 條碼
高麗菜, T001
福山萵苣, T002
大陸妹, T002</pre>
          <p>若寺岡的品名與系統不完全一致，請先在「品項與俗名」或「待確認品名」建立俗名對照，再匯入。</p>
          <form method="post" action="/admin/import-teraoka" enctype="multipart/form-data">
            <label>上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
            <label>或貼上 CSV：<textarea name="csv" placeholder="貼上寺岡匯出的 CSV..." style="width:100%;height:180px;"></textarea></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">對照並更新</button></p>
          </form>
        </div>
        <p style="margin-top:16px;"><a href="/admin/products" class="btn">← 回品項列表</a></p>
        `;
        res.type("text/html").send(notionPage("寺岡資料對照", body, "", res));
    });
    router.post("/import-teraoka", upload, async (req, res) => {
        const sheet = parseRequestToSheet(req);
        if (!sheet || sheet.rows.length === 0) {
            res.redirect("/admin/import-teraoka?err=" + encodeURIComponent("請貼上 CSV 或上傳 Excel 檔案"));
            return;
        }
        const { header, rows } = sheet;
        const nameIdx = header.findIndex((h) => h === "品名" || h === "名稱" || h === "name" || h === "標準品名");
        const barcodeIdx = header.findIndex((h) => h === "條碼" || h === "編號" || h === "barcode" || h === "code" || h === "寺岡條碼" || h === "teraoka_barcode");
        if (nameIdx === -1) {
            res.redirect("/admin/import-teraoka?err=" + encodeURIComponent("找不到品名欄位（品名、名稱、name、標準品名）"));
            return;
        }
        if (barcodeIdx === -1) {
            res.redirect("/admin/import-teraoka?err=" + encodeURIComponent("找不到條碼欄位（條碼、編號、barcode、code）"));
            return;
        }
        const productByName = new Map();
        for (const row of await db.prepare("SELECT id, name FROM products").all()) {
            productByName.set(row.name, row.id);
        }
        for (const row of await db.prepare("SELECT product_id, alias FROM product_aliases").all()) {
            if (!productByName.has(row.alias))
                productByName.set(row.alias, row.product_id);
        }
        let matched = 0;
        let unmatchedCount = 0;
        for (let i = 0; i < rows.length; i++) {
            const cols = rows[i];
            const name = (cols[nameIdx] ?? "").trim();
            const barcode = (cols[barcodeIdx] ?? "").trim();
            if (!name || !barcode)
                continue;
            const productId = productByName.get(name);
            if (productId) {
                await db.prepare("UPDATE products SET teraoka_barcode = ?, updated_at = datetime('now') WHERE id = ?").run(barcode, productId);
                matched++;
            }
            else {
                unmatchedCount++;
            }
        }
        res.redirect("/admin/import-teraoka?ok=1&matched=" + matched + "&unmatched=" + unmatchedCount);
    });
    return router;
}
function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuoted = !inQuoted;
        }
        else if (ch === "," && !inQuoted) {
            out.push(cur.trim());
            cur = "";
        }
        else {
            cur += ch;
        }
    }
    out.push(cur.trim());
    return out;
}
function parseRequestToSheet(req) {
    if (req.file?.buffer) {
        const wb = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName)
            return null;
        const ws = wb.Sheets[sheetName];
        const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!arr.length)
            return null;
        const header = (arr[0] ?? []).map((c) => String(c ?? "").replace(/\ufeff/g, "").trim());
        const rows = arr.slice(1).map((row) => (Array.isArray(row) ? row : []).map((c) => String(c ?? "").trim()));
        return { header: header.map((h) => h.replace(/\ufeff/g, "").toLowerCase().replace(/\s+/g, "_")), rows };
    }
    const raw = req.body?.csv?.trim().replace(/\ufeff/g, "");
    if (!raw)
        return null;
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2)
        return null;
    const header = lines[0].split(",").map((c) => c.replace(/\ufeff/g, "").trim().toLowerCase().replace(/\s+/g, "_"));
    const rows = lines.slice(1).map((line) => parseCsvLine(line));
    return { header, rows };
}
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
