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
// [refactor 2026-07-18 批次1] 無狀態表現層 helper 抽到同層 _shared.js（拆分大檔第一步）。
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");
const id_js_1 = require("../lib/id.js");
const parse_order_message_js_1 = require("../lib/parse-order-message.js");
const resolve_product_js_1 = require("../lib/resolve-product.js");
const vision_ocr_js_1 = require("../lib/vision-ocr.js");
const wholesale_price_js_1 = require("../lib/wholesale-price.js");
const wholesale_snapshot_js_1 = require("../lib/wholesale-snapshot.js");
const livestock_price_js_1 = require("../lib/livestock-price.js");
const line_bot_control_js_1 = require("../lib/line-bot-control.js");
const unit_conversion_js_1 = require("../lib/unit-conversion.js");
const gemini_order_helpers_js_1 = require("../lib/gemini-order-helpers.js");
const parse_order_from_image_js_1 = require("../lib/parse-order-from-image.js");
const order_parsed_heuristics_js_1 = require("../lib/order-parsed-heuristics.js");
const order_form_templates_js_1 = require("../lib/order-form-templates.js");
const rebuild_order_from_sources_js_1 = require("../lib/rebuild-order-from-sources.js");
const customer_handwriting_hints_js_1 = require("../lib/customer-handwriting-hints.js");
const order_history_items_js_1 = require("../lib/order-history-items.js");
const few_shot_example_save_js_1 = require("../lib/few-shot-example-save.js");
const gemini_prompt_resolve_js_1 = require("../lib/gemini-prompt-resolve.js");
const gemini_eval_harness_js_1 = require("../lib/gemini-eval-harness.js");
const unit_spec_learn_js_1 = require("../lib/unit-spec-learn.js");
const customer_profile_js_1 = require("../lib/customer-profile.js");
const customer_scoring_js_1 = require("../lib/customer-scoring.js");
const liff_bind_token_js_1 = require("../lib/liff-bind-token.js");
const rhythm_analysis_js_1 = require("../lib/rhythm-analysis.js");
const daily_summary_push_js_1 = require("../lib/daily-summary-push.js");
const employee_line_binding_js_1 = require("../lib/employee-line-binding.js");
const basket_log_js_1 = require("../lib/basket-log.js");
const group_features_js_1 = require("../lib/group-features.js");
const empty_baskets_js_1 = require("../lib/empty-baskets.js");
const order_split_js_1 = require("../lib/order-split.js");
const stocktake_api_js_1 = require("../lib/stocktake-api.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const training_js_1 = require("./training.js");
const cash_js_1 = require("./cash.js");
const inventory_js_1 = require("./inventory.js");
const logistics_js_1 = require("./logistics.js");
const customers_js_1 = require("./customers.js");
const products_js_1 = require("./products.js");
const broadcast_js_1 = require("./broadcast.js");
const orders_js_1 = require("./orders.js");
const order_detail_js_1 = require("./order-detail.js");
const complaints_js_1 = require("./complaints.js");
const stock_mustcount_js_1 = require("../lib/stock-mustcount.js");
const line_conversation_js_1 = require("../lib/line-conversation.js");
const announcement_templates_js_1 = require("../lib/announcement-templates.js");
const announcement_image_js_1 = require("../lib/announcement-image.js");
const calendar_holidays_js_1 = require("../lib/calendar-holidays.js");
const route_war_room_js_1 = require("../lib/route-war-room.js");
const quote_report_js_1 = require("../lib/quote-report.js");
const ops_notify_js_1 = require("../lib/ops-notify.js");
const crypto_1 = require("crypto");
const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
/** 訂單明細／客戶預設單位等下拉選單（常見台灣生鮮單位） */
const ORDER_LINE_UNITS = [
    "公斤", "斤", "k", "個", "小把", "大把", "包", "把", "束", "桶", "箱", "顆", "粒", "盒", "袋", "台", "件", "支", "根", "條", "入", "罐", "瓶", "組", "份", "塊", "片", "尾",
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
/** 客戶主檔逗號名單：去掉括號內簡稱，供下拉選單 */
function parseKnownSubCustomerLabelsForSelect(raw) {
    if (!raw || !String(raw).trim())
        return [];
    return String(raw)
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/\([^)]*\)/g, "").trim())
        .filter(Boolean);
}
async function getNextOrderNoAdmin(db, orderDate) {
    const nextKey = "order_seq_next_" + orderDate;
    const startKey = "order_seq_start_" + orderDate;
    // [fix 2026-07-08] 原子取號：過去「先讀後寫」兩個並發請求會拿到同一個 order_no
    // （靠 ux_orders_order_no 唯一索引擋成 500）。改用單一 upsert + RETURNING：
    // 沒有列＝插入 start+1 並回傳、已有列＝原地 +1 並回傳，兩個並發在 pg/sqlite 都會序列化，
    // 各自拿到不同回傳值；本次序號＝回傳值-1。pg 與 SQLite(3.35+，本專案 3.49) 皆支援 RETURNING。
    try {
        const startRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(startKey);
        const startSeq0 = startRow && startRow.value ? parseInt(startRow.value, 10) : 1;
        const startSeq = Number.isNaN(startSeq0) ? 1 : Math.max(1, startSeq0);
        const ret = await db.prepare(
            "INSERT INTO app_settings (key, value) VALUES (?, ?) " +
            "ON CONFLICT (key) DO UPDATE SET value = CAST(CAST(app_settings.value AS INTEGER) + 1 AS TEXT) " +
            "RETURNING value"
        ).get(nextKey, String(startSeq + 1));
        const newVal = ret && ret.value != null ? parseInt(String(ret.value), 10) : NaN;
        if (Number.isFinite(newVal) && newVal >= 2) {
            const mySeq = newVal - 1;
            return orderDate.replace(/-/g, "") + String(mySeq).padStart(3, "0");
        }
        // 回傳值異常（value 被改成非數字等）→ 走舊邏輯
    }
    catch (e) {
        console.warn("[admin] 原子取號失敗，退回舊邏輯:", e?.message || e);
    }
    let row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(nextKey);
    if (!row || !row.value) {
        row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(startKey);
    }
    const seq = row && row.value ? parseInt(row.value, 10) : 1;
    const nextSeq = Number.isNaN(seq) ? 1 : Math.max(1, seq);
    const orderNo = orderDate.replace(/-/g, "") + String(nextSeq).padStart(3, "0");
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(nextKey, String(nextSeq + 1));
    return orderNo;
}
/**
 * 拆併單共用：找到（或建立）同客戶＋同出貨日、指定子客戶的目標訂單，回傳 targetOrderId。
 * targetSubCustomer 空字串 = 主客戶（未分拆）訂單。新建訂單會複製來源訂單的附件參照，
 * 讓審核子單時也看得到原始訂單照片。
 * 呼叫端：手動拆併單（move-items）、依子客戶一鍵拆單（split-by-sub-customer）。
 */
async function resolveSplitTargetOrder(db, sourceOrder, targetSubCustomer) {
    const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
    // [refactor 2026-07-14] 「找目標單」改用共用 lib（與 line.js 同一份）：修正舊版 ORDER BY id
    // 與 line 端 ORDER BY order_no 的漂移（同日多張主桶單時兩入口會併進不同單）。
    let targetOrderId = await order_split_js_1.findSplitTargetOrderId(db, sourceOrder.customer_id, sourceOrder.order_date, targetSubCustomer);
    if (!targetOrderId) {
        const newOid = (0, id_js_1.newId)("ord");
        const orderNo = await getNextOrderNoAdmin(db, sourceOrder.order_date);
        const remarkNew = targetSubCustomer ? `[子單拆分: ${targetSubCustomer}]` : null;
        // [fix 2026-07-14] 主客戶桶必須存 ''（不是 NULL）：rebuild 語意 NULL＝全部品項、''＝只留空 subCustomer。
        // 舊行為存 NULL，之後整單重辨識會把子客戶品項重建進主桶單 → 與子單重複出貨（與 line.js 對齊）。
        const splitKeyNew = targetSubCustomer;
        await db.prepare(`
      INSERT INTO orders (id, order_no, customer_id, order_date, line_group_id, raw_message, status, remark, order_sub_split_key, line_message_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, NULL, ` + nowSql + `)
    `).run(newOid, orderNo, sourceOrder.customer_id, sourceOrder.order_date, sourceOrder.line_group_id ?? null, sourceOrder.raw_message ?? "", remarkNew, splitKeyNew);
        const attRows = await db.prepare("SELECT line_message_id FROM order_attachments WHERE order_id = ?").all(sourceOrder.id);
        for (const ar of attRows) {
            if (!ar?.line_message_id)
                continue;
            const attId = (0, id_js_1.newId)("att");
            await db.prepare(`INSERT INTO order_attachments (id, order_id, line_message_id, created_at) VALUES (?, ?, ?, ` + nowSql + `)`).run(attId, newOid, ar.line_message_id);
        }
        targetOrderId = newOid;
    }
    return targetOrderId;
}
/** 全站 head 共用 meta：favicon＋PWA（加到手機主畫面用公司 LOGO 圖示與正式站名，不再顯示「儀」字）。
 * icon PNG 由 scripts/generate-app-icons.js 從 assets/logo.svg 產生；/admin/assets 為公開靜態路徑（掛在登入驗證前）。 */
const SF_APP_HEAD_META = [
    '<link rel="icon" type="image/svg+xml" href="/admin/assets/logo.svg">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/admin/assets/app-icon-180.png">',
    '<link rel="manifest" href="/admin/assets/manifest.webmanifest">',
    '<meta name="apple-mobile-web-app-title" content="松富物流">',
    '<meta name="application-name" content="松富物流數位管理系統">',
    '<meta name="theme-color" content="#1a6fb5">',
].join("");
const NOTION_STYLE = `
  :root {
    --notion-bg: #ffffff;
    --notion-canvas: #fbfbfa;
    --notion-sidebar: #f7f6f3;
    --notion-border: rgba(55, 53, 47, 0.09);
    --notion-border-strong: rgba(55, 53, 47, 0.16);
    --notion-text: #37352f;
    --notion-text-muted: #787774;
    --notion-accent: #3b82c4;
    --notion-accent-warm: #c4783b;
    --notion-hover: rgba(55, 53, 47, 0.06);
    --notion-radius: 4px;
    --notion-radius-lg: 8px;
    --notion-shadow: 0 1px 3px rgba(15, 15, 15, 0.05);
    --notion-shadow-soft: 0 2px 12px rgba(55, 53, 47, 0.06);
    --notion-header-h: 48px;
  }
  /* === Lucide-style 行內 icon utility === */
  .lc-icon {
    display: inline-block;
    width: 1em; height: 1em;
    vertical-align: -0.15em;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
  }
  .lc-icon-lg { width: 1.25em; height: 1.25em; }
  /* === 通用 info popover：hover 標題旁的 (i) icon 顯示說明 === */
  .info-pop {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px; height: 16px;
    margin-left: 4px;
    border-radius: 50%;
    background: rgba(55,53,47,0.08);
    color: #787774;
    font-size: 10px;
    font-weight: 700;
    cursor: help;
    user-select: none;
    transition: background .12s, color .12s;
    vertical-align: middle;
  }
  .info-pop:hover { background: rgba(59,130,196,0.15); color: #3b82c4; }
  .info-pop[data-tip]:hover::after,
  .info-pop[data-tip]:focus::after {
    content: attr(data-tip);
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    transform: translateX(-50%);
    padding: 8px 10px;
    background: #1f2937;
    color: #fff;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.5;
    white-space: pre-line;
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    z-index: 100;
    min-width: 200px;
    max-width: 320px;
    pointer-events: none;
    text-align: left;
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--notion-border-strong);
    background: var(--notion-bg);
    color: var(--notion-text);
    border-radius: var(--notion-radius);
    padding: 5px 8px;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }
  /* 桌面（>1024）收合側邊選單：整條隱藏，主內容吃滿寬（drawer 機制只在 ≤1024）。
     注意：實際渲染的是 .sf-sidebar（非 .notion-sidebar），兩者都收以防萬一。 */
  @media (min-width: 1025px) {
    .notion-app.sidebar-collapsed .sf-sidebar,
    .notion-app.sidebar-collapsed .notion-sidebar { display: none !important; }
  }
  .notion-app-logo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--notion-text);
    text-decoration: none;
    padding: 4px 8px;
    margin-left: -8px;
    border-radius: var(--notion-radius);
  }
  .notion-app-logo:hover { background: var(--notion-hover); color: var(--notion-text); text-decoration: none; }
  .notion-app-logo img { height: 26px; width: 26px; display: block; }
  @media (max-width: 480px) {
    .notion-app-logo img { height: 22px; width: 22px; }
    .notion-app-logo .logo-text { display: none; }
  }
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
  .order-status-icons .osi-lywb { background:#e0f2f1; color:#00695c; font-size:11px; gap:2px; padding:0 5px; }
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
  .notion-main { flex: 1; min-width: 0; width: 100%; max-width: min(100%, 1600px); margin: 0 auto; padding: 28px clamp(24px, 3.5vw, 56px) 64px; }
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
  /* 訂單明細：待對應列上色（桌面表格式）。深淺主題通用：用半透明琥珀（比照 stk-low/stk-neg 的 rgba 作法），
     深色下疊在深底上仍是淡琥珀、不會變成白色孤島 */
  table.order-detail-table tbody tr.order-item-need-review > td { background: rgba(245,158,11,0.13); }
  /* 訂單明細：產品為「公斤計價」但辨識成非公斤單位 → 黃底警示，員工容易掃到 */
  table.order-detail-table tbody tr.order-item-unit-mismatch > td { background: rgba(234,179,8,0.16); }
  table.order-detail-table tbody tr.order-item-unit-mismatch > td:first-child { box-shadow: inset 4px 0 0 #ca8a04; }
  /* 單位不符＋低信心同時發生：黃底為主、紅左邊條（避免互相蓋掉） */
  table.order-detail-table tbody tr.order-item-unit-mismatch.order-item-low-conf > td { background: rgba(234,179,8,0.16); }
  .unit-mismatch-badge { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 8px; font-size: 11px; font-weight: 600; line-height: 1.5; vertical-align: middle; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  /* 訂單明細：remark 以「⚠」開頭＝AI 標記警示（如照片辨識幾何校驗「⚠ 字跡跨列」）→ 淡黃底＋琥珀左邊條 */
  table.order-detail-table tbody tr.order-item-remark-warn > td { background: rgba(234,179,8,0.16); }
  table.order-detail-table tbody tr.order-item-remark-warn > td:first-child { box-shadow: inset 4px 0 0 #d97706; }
  table.order-detail-table tbody tr.order-item-remark-warn.order-item-low-conf > td { background: rgba(234,179,8,0.16); }
  /* 辨識信心分數小徽章（顯示在品項旁） */
  .conf-pill { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 8px; font-size: 11px; font-weight: 600; line-height: 1.5; vertical-align: middle; border: 1px solid transparent; }
  .conf-pill.conf-high { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .conf-pill.conf-mid { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  .conf-pill.conf-low { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  .conf-pill.conf-none { background: var(--notion-sidebar); color: var(--notion-text-muted); border-color: var(--notion-border); }
  table.order-detail-table tbody tr.order-item-low-conf > td { background: rgba(239,68,68,0.10); }
  /* 「只看待確認」開關開啟時：隱藏未標記（data-review-flag="0"）的品項列，只留待確認的 */
  table.order-detail-table.show-review-only tbody tr[data-review-flag="0"] { display: none; }
  .order-detail-layout { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: stretch; gap: 16px; margin-top: 4px; position: relative; }
  /* 原始訂單↔明細 連線對照 */
  #orderConnSvg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; overflow: visible; }
  #orderConnSvg path { fill: none; stroke: var(--txt-3); stroke-width: 1; opacity: .28; transition: opacity .1s, stroke-width .1s, stroke .1s; }
  #orderConnSvg path.conn-hot { stroke: var(--accent); stroke-width: 2.25; opacity: 1; }
  #rawLinesPre .raw-match { background: rgba(35,131,226,0.13); color: inherit; border-radius: 3px; padding: 0 2px; cursor: default; transition: background .1s, box-shadow .1s; }
  #rawLinesPre .raw-match.conn-hot { background: rgba(35,131,226,0.30); box-shadow: 0 0 0 1px rgba(35,131,226,0.5); }
  .order-detail-table tbody tr.conn-hot { box-shadow: inset 3px 0 0 var(--accent); }
  .order-conn-toggle { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--txt-2); cursor: pointer; user-select: none; }
  @media (max-width: 1024px) { #orderConnSvg { display: none !important; } }
  /* 訂單檢視：平板與手機橫向（≤1024）兩欄過擠 → 上下堆疊、原始訂單置頂、隱藏連線 */
  @media (min-width: 761px) and (max-width: 1024px) {
    .order-detail-layout { flex-direction: column !important; }
    .order-detail-raw-col { position: sticky !important; top: 0 !important; z-index: 20; flex: none !important; width: 100% !important; max-width: none !important; background: var(--bg-0); }
    .order-detail-raw-col .sf-card[id="rawOrderBlock"] { position: static !important; max-height: 40vh !important; overflow-y: auto !important; }
    /* 列表表格不要被擠爆，改橫向捲動；min-width 給足欄寬，避免客戶名等中文被壓成直排 */
    .sf-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .sf-table { min-width: 940px; }
    /* 客戶名、品名等中文欄位不要一個字一行 */
    .sf-table td .cust-name-text,
    .sf-table td .cust-name-cell,
    .order-final-product,
    .sf-table td { word-break: keep-all; overflow-wrap: normal; }
  }
  /* 左欄寬度維持原本比例，避免擠壓右側辨識明細；內文區可較高、長行橫向捲動。整塊 sticky 捲動時仍跟著視窗 */
  .order-detail-raw-col { flex: 0 0 min(200px, 24vw); min-width: 160px; max-width: 220px; position: relative; }
  .order-detail-raw-inner { position: sticky; top: 10px; max-height: calc(100vh - 20px); overflow-y: auto; }
  .order-detail-raw-inner.notion-card { padding: 10px 12px; margin-bottom: 10px; }
  .order-detail-raw-title { margin: 0; font-size: 15px; font-weight: 600; }
  /* 垂直：至少約 20 行可見；水平：不拉寬整欄，長行用 overflow-x 捲動對照 */
  .order-detail-raw-pre-wrap {
    box-sizing: border-box;
    font-size: 11px;
    line-height: 1.4;
    min-height: calc(1.4em * 20);
    max-height: min(55vh, calc(1.4em * 42));
    overflow-y: auto;
    overflow-x: auto;
    border: 1px solid var(--notion-border);
    border-radius: var(--notion-radius);
  }
  .order-detail-raw-pre-wrap pre { background: var(--notion-sidebar); padding: 6px 8px; border-radius: var(--notion-radius); margin: 0; font-size: 11px; line-height: 1.4; white-space: pre-wrap; word-break: break-all; }
  .order-detail-main-col { flex: 1; min-width: 0; }
  table.order-detail-table th.order-detail-th-sort,
  table.order-detail-table td.order-detail-col-sort { width: 26px; max-width: 30px; padding: 2px 1px; vertical-align: middle; text-align: center; }
  table.order-detail-table th.order-detail-th-idx,
  table.order-detail-table td.order-detail-col-idx { width: 34px; max-width: 40px; padding: 3px 2px; vertical-align: middle; text-align: center; }
  table.order-detail-table .order-detail-idx-num { font-size: 11px; font-weight: 600; line-height: 1; }
  table.order-detail-table .item-sort-stack { display: inline-flex; flex-direction: column; flex-wrap: nowrap; align-items: center; gap: 1px; }
  table.order-detail-table .item-sort-stack .btn { padding: 0 2px; line-height: 1.15; font-size: 10px; min-width: 18px; border-radius: 2px; }
  table.order-detail-table input.order-detail-qty-input { width: 4rem; max-width: 4.5rem; min-width: 3.25rem; box-sizing: border-box; font-size: 19px; font-weight: 700; text-align: center; padding: 4px 6px; -moz-appearance: textfield; }
  /* 去掉數量框上下箭頭（避免誤觸）— 桌面明細列與新增列共用 */
  input.order-detail-qty-input::-webkit-outer-spin-button,
  input.order-detail-qty-input::-webkit-inner-spin-button,
  input.add-item-qty::-webkit-outer-spin-button,
  input.add-item-qty::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input.add-item-qty { -moz-appearance: textfield; font-size: 18px; font-weight: 700; text-align: center; }
  table.order-detail-table .order-del-btn-icon { min-width: 1.75rem; padding: 1px 4px; font-size: 17px; font-weight: 700; line-height: 1.1; color: #b71c1c; border-color: rgba(183, 28, 28, 0.35); }
  table.order-detail-table .order-del-btn-icon:hover { background: rgba(183, 28, 28, 0.07); }
  /* 每列操作鈕（＋插入 / ⊘作廢）：桌面直向堆疊，手機（760px 以下）改橫排 */
  table.order-detail-table .row-act-stack { display: inline-flex; flex-direction: column; gap: 3px; align-items: center; }
  table.order-detail-table .item-insert-btn { min-width: 1.75rem; padding: 1px 4px; font-size: 15px; font-weight: 700; line-height: 1.1; color: #047857; border-color: rgba(4, 120, 87, 0.35); }
  table.order-detail-table .item-insert-btn:hover { background: rgba(4, 120, 87, 0.07); }
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
  @media (max-width: 1024px) {
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
      display: block;
      border-right: none;
      border-bottom: 1px solid var(--notion-border);
      padding: 9px 12px;
      text-align: left;
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    tbody tr td:last-child { border-bottom: none; }
    /* 只有標了 data-label 的欄位才顯示欄名前綴；沒標的直接左對齊、自然換行，
       避免中文被壓成「一欄一字」（客訴／提醒清單等未標欄名的表格）。 */
    tbody tr td[data-label]::before {
      content: attr(data-label);
      display: inline-block;
      min-width: 4.5em;
      margin-right: 8px;
      font-size: 12px;
      color: var(--notion-text-muted);
      font-weight: 600;
      vertical-align: baseline;
    }
    /* 卡片化的表格不要被 .sf-table 的 min-width:560px 撐開造成橫向擠壓 */
    .sf-table:not(.freezer-cal):not(.cal-table) { min-width: 0 !important; }
    /* 帶 table-layout:fixed + <colgroup> 的 .sf-table（如「忘記叫貨提醒」清單）：
       卡片堆疊時 td 變 display:block，但 <table> 仍是 display:table，瀏覽器會用固定欄寬
       把每列擠成窄欄。改讓整個表格以 block 排版（忽略 colgroup/table-layout），每列吃滿寬。 */
    .sf-table:not(.freezer-cal):not(.cal-table),
    .sf-table:not(.freezer-cal):not(.cal-table) > tbody { display: block; }
    .sf-table:not(.freezer-cal):not(.cal-table) { table-layout: auto !important; }
    .sf-table:not(.freezer-cal):not(.cal-table) > colgroup { display: none; }
    /* 月曆類表格（冷凍庫 .freezer-cal／行事曆 .cal-table）維持 7 欄格狀，
       不套用卡片堆疊，否則會垮成「一天一列」。 */
    table.freezer-cal, table.cal-table {
      display: table; table-layout: fixed; width: 100%;
      background: var(--notion-bg); border: 1px solid var(--notion-border);
      border-radius: 10px; overflow: hidden;
    }
    table.freezer-cal thead, table.cal-table thead { display: table-header-group; }
    table.freezer-cal tbody tr, table.cal-table tbody tr {
      display: table-row; background: transparent; border: none;
      border-radius: 0; margin: 0; box-shadow: none;
    }
    table.freezer-cal th, table.freezer-cal tbody tr td,
    table.cal-table th, table.cal-table tbody tr td {
      display: table-cell; text-align: center; padding: 6px 2px;
      min-width: 0; border: 1px solid var(--notion-border); font-size: 12px;
      white-space: normal; word-break: break-word;
    }
    table.freezer-cal thead th, table.cal-table thead th { font-size: 12px; color: var(--notion-text-muted); }
    table.freezer-cal tbody tr td::before, table.cal-table tbody tr td::before { content: none; }
    /* ── 手機清單：更緊湊 + 去雜訊（客戶/貨品/一般清單共用）── */
    tbody tr { margin-bottom: 8px; }
    tbody tr td { padding: 6px 10px; }
    /* 純狀態圓點／勾選的空表頭欄，auto-label 會標成「欄位」，在手機是雜訊 → 隱藏 */
    tbody tr td[data-label="欄位"] { display: none; }
    /* 客戶清單：手機隱藏首欄圓點與常空的「聯絡」欄，壓低卡片高度 */
    .sf-table tbody tr.customer-row > td:nth-child(1),
    .sf-table tbody tr.customer-row > td:nth-child(5) { display: none; }
    /* 貨品清單：手機隱藏寺岡碼／俗名／規格（細節進編輯頁看），只留 品名/ERP/狀態/操作 */
    .sf-table tbody tr.product-row > td:nth-child(3),
    .sf-table tbody tr.product-row > td:nth-child(4),
    .sf-table tbody tr.product-row > td:nth-child(5) { display: none; }
    /* 表單元件不超出螢幕寬度（固定 width 的 input/select 在窄螢幕會溢出）*/
    input, select, textarea { max-width: 100%; }
    /* 手機的操作按鈕列更緊湊，讓一排按鈕自然換行成 2–3 顆一列 */
    .sf-root .sf-btn { font-size: 12px; height: 32px; padding: 0 10px; }
    /* 儀表板等 sf-card 內的「清單列」（客訴／提醒 Top 等 flex 橫列）：手機自動換行，
       並解除 min-width，避免中間文字被擠成「一個字一列」。 */
    .sf-card a[style*="display:flex"][style*="gap:12px"],
    .sf-card div[style*="display:flex"][style*="gap:12px"] { flex-wrap: wrap !important; row-gap: 2px !important; }
    .sf-card [style*="min-width:80px"],
    .sf-card [style*="min-width:100px"],
    .sf-card [style*="min-width:120px"] { min-width: 0 !important; }
    .sf-card a[style*="gap:12px"] > [style*="flex:1"],
    .sf-card div[style*="gap:12px"] > [style*="flex:1"] { min-width: 0 !important; flex-basis: 100% !important; }
    /* 訂單明細：三段卡片（原始資料 / 核定資料 / 備註+刪除） */
    .table-scroll-mobile { overflow: visible; }
    table.order-detail-table { border: none; background: transparent; min-width: 0; }
    table.order-detail-table thead { display: none; }
    table.order-detail-table tbody tr.order-item-need-review { background: rgba(245,158,11,0.13); }
    table.order-detail-table tbody tr.order-item-low-conf { background: rgba(239,68,68,0.10); }
    table.order-detail-table tbody tr.order-item-unit-mismatch { background: rgba(234,179,8,0.16); border-left: 4px solid #ca8a04; }
    table.order-detail-table tbody tr.order-item-remark-warn { background: rgba(234,179,8,0.16); border-left: 4px solid #d97706; }
    .order-detail-layout { flex-direction: column; flex-wrap: wrap; }
    .order-detail-raw-col { flex: none; width: 100%; min-width: 0; }
    .order-detail-raw-inner { position: static; max-height: 220px; }
    .order-detail-raw-pre-wrap { max-height: min(14vh, 110px); }
    .order-detail-raw-sticky-hint { display: none; }
    /* 手機版品項卡：5 段式緊湊版型
       Row1: 原始（灰底）
       Row2: 料號 + 品項名稱（大字）+ 作廢×
       Row3: 數量（大字）+ 單位
       Row4: 子客戶（全寬）
       Row5: 備註（全寬）
       HTML 欄序：1=cb 2=sort 3=idx 4=erp 5=product 6=qty 7=unit 8=sub_customer 9=remark 10=del */
    table.order-detail-table tbody tr {
      display: grid;
      grid-template-columns: minmax(40px, auto) minmax(0, 1fr) auto;
      grid-template-areas:
        "orig orig orig"
        "erp product del"
        "qty unit unit"
        "subcust subcust subcust"
        "remark remark remark";
      gap: 0;
      border: 1px solid var(--notion-border);
      border-radius: 12px;
      margin-bottom: 12px;
      overflow: hidden;
      background: var(--notion-bg);
    }
    table.order-detail-table tbody tr td { border-bottom: none; padding: 8px 10px; display:flex; align-items:center; gap:6px; min-width:0; }
    table.order-detail-table tbody tr td::before { content: none; }
    /* 隱藏 cb、sort、idx（手機版多餘） */
    table.order-detail-table tbody tr td:nth-child(1),
    table.order-detail-table tbody tr td:nth-child(2),
    table.order-detail-table tbody tr td:nth-child(3) { display:none; }
    /* Row 2: 料號 + 品項 + 作廢 */
    table.order-detail-table tbody tr td:nth-child(4) {
      grid-area: erp;
      padding: 10px 4px 10px 12px;
      font-size: 12px;
      color: var(--notion-text-muted);
      font-family: ui-monospace, monospace;
      align-self: center;
      justify-content: flex-start;
      white-space: nowrap;
    }
    table.order-detail-table tbody tr td:nth-child(5) {
      grid-area: product;
      padding: 10px 6px;
      font-size: 18px;
      font-weight: 600;
      color: var(--notion-text);
      align-self: center;
      min-width: 0;
      gap: 4px 8px;
      flex-wrap: wrap; /* 品名 + 信心分數 + 改品項鈕擠不下時折行，避免品名被壓成一字一行 */
      word-break: keep-all;
      overflow-wrap: anywhere;
      line-height: 1.2;
    }
    /* 品名保底寬度：不夠寬時讓「改品項」折行，而不是把品名壓成一字一行 */
    table.order-detail-table tbody tr td:nth-child(5) .order-final-product { flex: 1 1 auto; min-width: 5.5em; }
    table.order-detail-table tbody tr td:nth-child(5) .order-final-product,
    table.order-detail-table tbody tr td:nth-child(5) .order-final-product a,
    table.order-detail-table tbody tr td:nth-child(5) .product-pick { font-size: 18px; font-weight: 600; word-break: keep-all; }
    table.order-detail-table tbody tr td:nth-child(5) .conf-pill { font-size: 11px; font-weight: 600; flex: 0 0 auto; }
    /* 改品項：手機顯示為小圓角鈕（點品名開的是「品項主檔編輯」，換對應要靠這顆，不能藏） */
    table.order-detail-table tbody tr td:nth-child(5) .product-change {
      display: inline-block;
      margin-left: auto;
      flex: 0 0 auto;
      font-size: 12px;
      padding: 3px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--accent);
      background: var(--bg-1);
      text-decoration: none;
      white-space: nowrap;
      line-height: 1.5;
    }
    table.order-detail-table tbody tr td:nth-child(10) {
      grid-area: del;
      padding: 6px 10px 6px 0;
      align-self: center;
      justify-self: end;
      justify-content: flex-end;
    }
    table.order-detail-table tbody tr td:nth-child(10) .order-del-btn-icon { min-width: 1.85rem; font-size: 16px; padding: 2px 6px; }
    /* Row 4: 數量 + 單位（HTML 欄序已改：6=數量 7=單位 8=子客戶） */
    table.order-detail-table tbody tr td:nth-child(6) {
      grid-area: qty;
      padding: 8px 6px 10px 12px;
      border-top: 1px solid var(--notion-border);
      gap: 6px;
    }
    table.order-detail-table tbody tr td:nth-child(6)::before {
      content: "數量";
      color: var(--notion-text-muted);
      font-size: 11px;
      margin-right: 2px;
      flex: 0 0 auto;
    }
    table.order-detail-table tbody tr td:nth-child(6) input {
      font-size: 20px !important;
      font-weight: 700;
      width: 4.5rem !important;
      max-width: 4.5rem !important;
      text-align: center;
      padding: 4px 6px;
    }
    table.order-detail-table tbody tr td:nth-child(7) {
      grid-area: unit;
      padding: 8px 12px 10px 6px;
      border-top: 1px solid var(--notion-border);
      gap: 6px;
      justify-content: flex-start;
    }
    table.order-detail-table tbody tr td:nth-child(7)::before {
      content: "單位";
      color: var(--notion-text-muted);
      font-size: 11px;
      margin-right: 2px;
      flex: 0 0 auto;
    }
    /* Row 3: 子客戶（全寬） */
    table.order-detail-table tbody tr td:nth-child(8) {
      grid-area: subcust;
      padding: 6px 12px 8px;
      border-top: 1px solid var(--notion-border);
      gap: 6px;
    }
    table.order-detail-table tbody tr td:nth-child(8)::before {
      content: "子客戶";
      color: var(--notion-text-muted);
      font-size: 11px;
      margin-right: 4px;
      flex: 0 0 auto;
    }
    table.order-detail-table tbody tr td:nth-child(8) input {
      width: 100% !important;
      max-width: none !important;
      flex: 1 1 auto;
      min-width: 0;
      font-size: 13px;
    }
    table.order-detail-table tbody tr td:nth-child(7) select {
      font-size: 16px;
      font-weight: 600;
      width: auto;
      min-width: 5rem;
      max-width: none;
      padding: 4px 8px;
    }
    /* Row 5: 備註（全寬） */
    table.order-detail-table tbody tr td:nth-child(9) {
      grid-area: remark;
      padding: 8px 12px 10px;
      border-top: 1px solid var(--notion-border);
      gap: 6px;
    }
    table.order-detail-table tbody tr td:nth-child(9)::before {
      content: "備註";
      color: var(--notion-text-muted);
      font-size: 11px;
      margin-right: 4px;
      flex: 0 0 auto;
    }
    table.order-detail-table tbody tr td:nth-child(9) input {
      width: 100% !important;
      max-width: none !important;
      flex: 1 1 auto;
      min-width: 0;
      font-size: 13px;
    }
    /* 第一列：原始 raw_card */
    table.order-detail-table tbody tr::before {
      content: attr(data-raw-card);
      grid-area: orig;
      display: block;
      padding: 9px 12px 8px;
      font-size: 12px;
      color: var(--notion-text-muted);
      border-bottom: 1px solid var(--notion-border);
      background: var(--notion-sidebar);
      white-space: pre-wrap;
      word-break: break-all;
    }
    /* 訂單列表行：手機改用 3 列卡片版型，蓋過上方 td-as-row 的預設行為 */
    .sf-table tbody tr.order-row > td:not(.order-mobile-only) { display: none !important; }
    .sf-table tbody tr.order-row > td.order-mobile-only {
      display: block !important;
      padding: 0 !important;
      border-bottom: none !important;
      text-align: left !important;
    }
    .sf-table tbody tr.order-row > td.order-mobile-only::before { display: none !important; content: none !important; }
    .sf-table tbody tr.order-row { padding: 0 !important; }
    /* 新增品項列（.add-item-row）：不能套上面的品項卡 grid 版型——
       它只有一個 colspan td（nth-child(1) 會被隱藏），整列在手機上會消失、無法新增品項。
       改為整塊直排卡片顯示。 */
    table.order-detail-table tr.add-item-row {
      display: block;
      border: 1.5px dashed var(--notion-border);
      border-radius: 12px;
      margin-bottom: 12px;
      background: var(--notion-bg);
      overflow: visible;
    }
    table.order-detail-table tr.add-item-row::before { content: none; display: none; }
    table.order-detail-table tr.add-item-row > td {
      display: block !important;
      border: none;
      padding: 10px 12px !important;
      background: transparent !important;
    }
    #inlineAddItem .review-product-picker { flex: 1 1 100%; min-width: 0; }
    #inlineAddItem .add-item-qty { width: 6rem !important; font-size: 20px; }
    #inlineAddItem .add-item-unit { min-width: 5.5rem; font-size: 16px; }
    #inlineAddItem #inlineAddBtn { flex: 1 0 auto; height: 38px; font-size: 14px; }
    /* 每列的「＋插入」與「⊘作廢」在手機卡片右上角並排 */
    table.order-detail-table tbody tr td:nth-child(10) .row-act-stack { flex-direction: row; gap: 10px; }
    table.order-detail-table tbody tr td:nth-child(10) .item-insert-btn { min-width: 1.85rem; font-size: 16px; padding: 2px 6px; }
    /* 品項卡左右滑手勢已暫停用（使用回饋卡手）；重啟手勢時要一併恢復這條，
       否則橫向 pointermove 會被瀏覽器攔走：
       table.order-detail-table tbody tr[data-item-id] { touch-action: pan-y; } */
  }
  /* 訂單列表 mobile 卡片：桌面隱藏 */
  .order-mobile-only { display: none; }
  .order-mobile-card { display:block; padding:10px 12px; color:inherit; text-decoration:none; }
  .order-mobile-card .row1 { display:flex; align-items:center; gap:6px; margin-bottom:4px; min-width:0; }
  .order-mobile-card .delivery { font-weight:700; color:var(--accent); font-size:14px; white-space:nowrap; }
  .order-mobile-card .cust { flex:1; font-weight:600; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
  .order-mobile-card .cust.fallback { font-style:italic; color:var(--txt-3); font-weight:500; }
  .order-mobile-card .row2 { font-size:12px; color:var(--txt-2); display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
  .order-mobile-card .row2 .mono { font-family:ui-monospace,monospace; }
  .order-mobile-card .row3 { font-size:12px; color:var(--txt-1); margin-top:4px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  /* 隱藏佔位（保留結構完整） */
  @media (min-width: 761px) {
    .order-mobile-only { display: none !important; }
    /* 桌面版訂單明細表格：恢復為標準 table（手機 grid 規則上方已限定在 max-width:760px） */
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
/* ─────────────────────────────────────────────────────────────────────
 * SF 設計系統（松富 HACCP refresh）
 * 與 NOTION_STYLE 並存：既有頁面以 .notion-* 為主，新頁以 .sf-* 為主
 * Dark 為設計預設，但本系統預設淺色（白天 ERP 看），可由右上角切換
 * ───────────────────────────────────────────────────────────────────── */
const SF_TOKENS = `
:root, [data-theme="light"] {
  --bg-0: #f4f5f7;
  --bg-1: #ffffff;
  --bg-2: #fafbfc;
  --bg-3: #f0f2f5;
  --bg-4: #e6e9ef;
  --line: #e3e6ec;
  --line-2: #d4d8e0;
  --line-3: #b8bcc6;
  --txt-1: #15181f;
  --txt-2: #4a5060;
  --txt-3: #6c7280;
  --txt-4: #9aa1ae;
  /* 松富企業藍 */
  --accent: oklch(0.55 0.17 252);
  --accent-strong: oklch(0.46 0.18 252);
  --accent-soft: oklch(0.55 0.17 252 / 0.10);
  --accent-line: oklch(0.55 0.17 252 / 0.30);
  --ok: oklch(0.50 0.16 150);
  --ok-soft: oklch(0.50 0.16 150 / 0.12);
  --warn: oklch(0.65 0.18 75);
  --warn-soft: oklch(0.65 0.18 75 / 0.14);
  --bad: oklch(0.55 0.22 25);
  --bad-soft: oklch(0.55 0.22 25 / 0.10);
  --info: oklch(0.50 0.14 230);
  --info-soft: oklch(0.50 0.14 230 / 0.12);
  --radius-sm: 3px;
  --radius: 5px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --font-ui: 'Inter','Noto Sans TC',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  --font-mono: 'JetBrains Mono','SF Mono',ui-monospace,Menlo,monospace;
  --hairline: 1px solid var(--line);
  --shadow-kpi: 0 1px 2px rgba(20,24,34,.05), 0 1px 3px rgba(20,24,34,.06);
  --shadow-kpi-hover: 0 8px 24px rgba(20,24,34,.10), 0 3px 8px rgba(20,24,34,.06);
  /* 卡片底色（notion-* 頁沿用；深色主題於下方覆寫） */
  --notion-card: #ffffff;
  --notion-border-soft: #f0efed;
}
[data-theme="dark"] {
  --bg-0: #0a0c10;
  --bg-1: #11141a;
  --bg-2: #181c25;
  --bg-3: #1f2531;
  --bg-4: #262d3c;
  --line: #2a3040;
  --line-2: #353c4d;
  --line-3: #475063;
  --txt-1: #f4f6f8;
  --txt-2: #9aa1ae;
  --txt-3: #6c7280;
  --txt-4: #4a5060;
  /* 松富企業藍（深色版） */
  --accent: oklch(0.70 0.16 252);
  --accent-strong: oklch(0.78 0.17 252);
  --accent-soft: oklch(0.70 0.16 252 / 0.14);
  --accent-line: oklch(0.70 0.16 252 / 0.35);
  --ok: oklch(0.76 0.16 150);
  --ok-soft: oklch(0.76 0.16 150 / 0.14);
  --warn: oklch(0.80 0.16 75);
  --warn-soft: oklch(0.80 0.16 75 / 0.14);
  --bad: oklch(0.66 0.22 25);
  --bad-soft: oklch(0.66 0.22 25 / 0.14);
  --info: oklch(0.74 0.12 230);
  --info-soft: oklch(0.74 0.12 230 / 0.14);
  --shadow-kpi: 0 1px 2px rgba(0,0,0,.35);
  --shadow-kpi-hover: 0 10px 28px rgba(0,0,0,.5);
  /* Notion 系底層變數（頁首／側欄／邊框／文字）也要跟著深色，否則標題列／側欄仍是白底 */
  --notion-bg: #11141a;
  --notion-canvas: #0a0c10;
  --notion-sidebar: #0d1016;
  --notion-border: rgba(255, 255, 255, 0.10);
  --notion-border-strong: rgba(255, 255, 255, 0.18);
  --notion-text: #f4f6f8;
  --notion-text-muted: #9aa1ae;
  --notion-accent: #5b9fdb;
  --notion-hover: rgba(255, 255, 255, 0.07);
  --notion-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  --notion-shadow-soft: 0 2px 12px rgba(0, 0, 0, 0.5);
  --notion-card: var(--bg-1);
  --notion-border-soft: rgba(255, 255, 255, 0.06);
}
/* base */
.sf-root, .sf-root * { box-sizing: border-box; }
.sf-root {
  font-family: var(--font-ui);
  color: var(--txt-1);
  background: var(--bg-0);
  font-feature-settings: 'cv11','ss03','cv02';
  -webkit-font-smoothing: antialiased;
}
.sf-root .mono, .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.sf-root .num, .num { font-variant-numeric: tabular-nums; }
.sf-root a { color: var(--accent-strong); text-decoration: none; }
.sf-root a:hover { text-decoration: underline; }

/* status dot */
.sf-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: var(--txt-3); flex-shrink: 0; vertical-align: middle;
}
.sf-dot.ok { background: var(--ok); box-shadow: 0 0 0 3px var(--ok-soft); }
.sf-dot.warn { background: var(--warn); box-shadow: 0 0 0 3px var(--warn-soft); }
.sf-dot.bad { background: var(--bad); box-shadow: 0 0 0 3px var(--bad-soft); animation: sf-pulse 1.6s ease-in-out infinite; }
.sf-dot.info { background: var(--info); box-shadow: 0 0 0 3px var(--info-soft); }
.sf-dot.accent { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
@keyframes sf-pulse {
  0%,100% { box-shadow: 0 0 0 3px var(--bad-soft); }
  50% { box-shadow: 0 0 0 6px var(--bad-soft); }
}

/* pill */
.sf-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 999px;
  border: 1px solid var(--line-2); background: var(--bg-2); color: var(--txt-2);
  line-height: 1.5; white-space: nowrap;
}
.sf-pill.ok { color: var(--ok); border-color: var(--ok); background: var(--ok-soft); }
.sf-pill.warn { color: var(--warn); border-color: var(--warn); background: var(--warn-soft); }
.sf-pill.bad { color: var(--bad); border-color: var(--bad); background: var(--bad-soft); }
.sf-pill.info { color: var(--info); border-color: var(--info); background: var(--info-soft); }
.sf-pill.accent { color: var(--accent); border-color: var(--accent-line); background: var(--accent-soft); }

/* button */
.sf-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: var(--radius);
  border: 1px solid var(--line-2); background: var(--bg-2); color: var(--txt-1);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: background .12s, border-color .12s; white-space: nowrap;
  font-family: inherit; text-decoration: none;
}
.sf-btn:hover { background: var(--bg-3); border-color: var(--line-3); text-decoration: none; }
.sf-btn:active { transform: translateY(1px); }
.sf-btn.primary { background: var(--accent); border-color: var(--accent); color: #ffffff; }
.sf-btn.primary:hover { background: var(--accent-strong); border-color: var(--accent-strong); }
.sf-btn.ghost { background: transparent; }
.sf-btn.danger { color: var(--bad); border-color: var(--bad-soft); }
.sf-btn.danger:hover { background: var(--bad-soft); }
.sf-btn.lg { height: 40px; padding: 0 16px; font-size: 14px; }
/* ── 統一滑桿元件（全站唯一標準，勿再自刻）──
   開關 on/off：<label class="sf-switch-label"><input type="checkbox"><span class="sf-switch"></span>文字</label>
   分段滑桿  ：<div class="sf-seg"><button class="active">A</button><button>B</button></div>
              或用 <a class="on"> 做導覽型；玻璃通透底、選中子項亮白膠囊。 */
.sf-switch { position: relative; display: inline-block; vertical-align: middle; width: 36px; height: 20px; flex: 0 0 auto; border-radius: 999px; background: rgba(120,119,116,.28); transition: background .18s; cursor: pointer; }
.sf-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .18s; }
input:checked ~ .sf-switch { background: rgba(35,131,226,.9); }
input:checked ~ .sf-switch::after { transform: translateX(16px); }
input:focus-visible ~ .sf-switch { outline: 2px solid #2383e2; outline-offset: 2px; }
.sf-switch-label { margin: 0; display: inline-flex; align-items: center; gap: 8px; min-height: 32px; font-size: 12.5px; white-space: nowrap; cursor: pointer; user-select: none; }
.sf-switch-label input { position: absolute; opacity: 0; width: 0; height: 0; }
.sf-seg { display: inline-flex; align-items: center; gap: 2px; background: rgba(35,131,226,.08); border: 1px solid rgba(35,131,226,.18); border-radius: 999px; padding: 3px; }
.sf-seg > a, .sf-seg > button { border: 0; background: transparent; border-radius: 999px; padding: 6px 15px; font-size: 12.5px; line-height: 1; font-family: inherit; color: #4a6fa5; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: background .18s, color .18s; }
.sf-seg > a.on, .sf-seg > a.active, .sf-seg > button.active, .sf-seg > button.on { background: rgba(255,255,255,.9); color: #2383e2; font-weight: 700; box-shadow: 0 1px 4px rgba(35,131,226,.18); }
.sf-seg svg { width: 15px; height: 15px; }
.sf-btn.sm { height: 26px; padding: 0 8px; font-size: 12px; }
.sf-btn.icon-only { width: 32px; padding: 0; }

/* card */
.sf-card {
  background: var(--bg-1); border: var(--hairline); border-radius: var(--radius-md);
  overflow: hidden;
}
.sf-card-head {
  padding: 12px 16px; border-bottom: var(--hairline);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--bg-2);
}
.sf-card-title { font-size: 13px; font-weight: 600; color: var(--txt-1); display: flex; align-items: center; gap: 8px; }
.sf-card-title > svg { flex: 0 0 auto; color: var(--txt-3); }
.sfi { display: inline-flex; align-items: center; vertical-align: -3px; }
.sf-tab .sfi, .sf-btn .sfi, button .sfi { margin-right: 4px; }
.sfi > svg { width: 15px; height: 15px; }
.sf-card-sub { font-size: 11px; color: var(--txt-3); font-family: var(--font-mono); }
.sf-card-body { padding: 16px; }

/* table — 扁平樣式，不被 card 包住 */
.sf-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; background: var(--bg-1); }
.sf-table thead th {
  text-align: left; font-weight: 500; color: var(--txt-3); font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 10px 14px; border-bottom: 1px solid var(--line-2); background: var(--bg-2);
}
.sf-table tbody td {
  padding: 12px 14px; border-bottom: var(--hairline); vertical-align: middle; color: var(--txt-1);
}
.sf-table tbody tr:last-child td { border-bottom: none; }
.sf-table tbody tr:hover td { background: var(--bg-2); }
.sf-table tbody tr.row-active td { background: var(--accent-soft); }
.sf-table .num, .sf-table td.num { text-align: right; font-variant-numeric: tabular-nums; }

/* 表格容器：subtle border，不像 card 那麼厚重 */
.sf-table-wrap {
  background: var(--bg-1);
  border: var(--hairline);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* 真正的 tabs（上方分頁列，含底線） */
.sf-tabs {
  display: flex; gap: 0; border-bottom: 1px solid var(--line);
  margin-bottom: 0;
}
.sf-tab {
  padding: 10px 18px; background: transparent; border: 0; cursor: pointer;
  font-size: 13px; color: var(--txt-3); font-family: inherit;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  display: inline-flex; align-items: center; gap: 8px;
  transition: color .12s, border-color .12s;
}
.sf-tab:hover { color: var(--txt-1); }
.sf-tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.sf-tab .tab-count {
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; padding: 1px 8px; border-radius: 999px;
  background: var(--bg-3); color: var(--txt-2); min-width: 22px;
}
.sf-tab.active .tab-count { background: var(--accent-soft); color: var(--accent); }
.sf-tab .tab-count.warn { background: var(--warn-soft); color: var(--warn); }
.sf-tab .tab-count.bad { background: var(--bad-soft); color: var(--bad); }

/* form */
.sf-input, .sf-select, .sf-textarea {
  width: 100%; height: 36px; padding: 0 10px;
  background: var(--bg-2); border: 1px solid var(--line-2);
  border-radius: var(--radius); color: var(--txt-1); font-size: 13px;
  outline: none; transition: border-color .12s, box-shadow .12s;
  font-family: inherit;
}
.sf-textarea { height: auto; padding: 8px 10px; min-height: 72px; }
.sf-input:focus, .sf-select:focus, .sf-textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.sf-label {
  display: block; font-size: 11px; font-weight: 500; color: var(--txt-3);
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;
}

/* KPI tile */
.sf-kpi {
  padding: 14px 16px; background: var(--bg-1); border: var(--hairline);
  border-radius: var(--radius-md); flex: 1; min-width: 0;
}
.sf-kpi.status-ok { border-left: 3px solid var(--ok); padding-left: 14px; }
.sf-kpi.status-warn { border-left: 3px solid var(--warn); padding-left: 14px; }
.sf-kpi.status-bad { border-left: 3px solid var(--bad); padding-left: 14px; }
.sf-kpi.status-info { border-left: 3px solid var(--info); padding-left: 14px; }
.sf-kpi-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sf-kpi-label { font-size: 11px; color: var(--txt-3); text-transform: uppercase; letter-spacing: .06em; font-weight: 500; }
.sf-kpi-value { display: flex; align-items: baseline; gap: 4px; }
.sf-kpi-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 28px; font-weight: 600; letter-spacing: -0.02em; }
.sf-kpi-unit { font-size: 12px; color: var(--txt-3); }
.sf-kpi-foot { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 11px; color: var(--txt-3); }

/* KPI 現代版：角落光暈 ＋ 膠囊標籤 ＋ 迷你趨勢線（儀表板專用，不影響其他 .sf-kpi） */
.sf-kpi.sf-kpi-glow {
  padding: 18px; border: var(--hairline); border-radius: var(--radius-lg);
  background: radial-gradient(130% 90% at 0% 0%, var(--kpi-glow, transparent), transparent 62%), var(--bg-1);
  box-shadow: var(--shadow-kpi);
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}
.sf-kpi.sf-kpi-glow:hover { transform: translateY(-3px); box-shadow: var(--shadow-kpi-hover); border-color: var(--line-2); }
.sf-kpi-glow .sf-kpi-value { margin-top: 2px; }
.sf-kpi-glow .sf-kpi-num { font-size: 32px; }
.sf-kpi-badge {
  font-size: 11px; font-weight: 600; letter-spacing: .01em; white-space: nowrap;
  padding: 2px 9px; border-radius: 999px; background: var(--accent-soft); color: var(--accent);
  font-family: var(--font-mono); font-variant-numeric: tabular-nums;
}
.sf-kpi-badge.ok { background: var(--ok-soft); color: var(--ok); }
.sf-kpi-badge.warn { background: var(--warn-soft); color: var(--warn); }
.sf-kpi-badge.bad { background: var(--bad-soft); color: var(--bad); }
.sf-kpi-badge.info { background: var(--info-soft); color: var(--info); }
.sf-kpi-badge.accent { background: var(--accent-soft); color: var(--accent); }
.sf-kpi-spark { display: block; width: 100%; height: 30px; margin: 10px 0 2px; }

/* progress bar */
.sf-prog { height: 6px; background: var(--bg-3); border-radius: 3px; overflow: hidden; }
.sf-prog > span { display: block; height: 100%; background: var(--accent); transition: width .3s; }
.sf-prog.ok > span { background: var(--ok); }
.sf-prog.warn > span { background: var(--warn); }
.sf-prog.bad > span { background: var(--bad); }

/* app shell */
.sf-app { display: flex; min-height: 100vh; background: var(--bg-0); color: var(--txt-1); font-family: var(--font-ui); }
.sf-sidebar {
  width: 220px; flex-shrink: 0; background: var(--bg-1);
  border-right: var(--hairline); display: flex; flex-direction: column;
  position: sticky; top: 0; height: 100vh;
}
.sf-sidebar-brand { padding: 14px 16px; border-bottom: var(--hairline); display: flex; align-items: center; gap: 10px; }
.sf-sidebar-logo {
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--accent); color: #ffffff; font-weight: 700; font-size: 14px;
  font-family: var(--font-mono);
  display: flex; align-items: center; justify-content: center;
}
.sf-sidebar-title { font-size: 13px; font-weight: 600; line-height: 1.2; }
.sf-sidebar-ver { font-size: 10px; color: var(--txt-3); font-family: var(--font-mono); }
.sf-nav { padding: 8px; flex: 1; overflow: auto; }
.sf-nav-group { margin-bottom: 8px; }
details.sf-nav-group > summary { list-style: none; cursor: pointer; }
details.sf-nav-group > summary::-webkit-details-marker { display: none; }
details.sf-nav-group > summary > .sf-nav-group-title {
  padding: 7px 10px; font-size: 12px; color: var(--txt-3);
  text-transform: none; letter-spacing: .01em; font-weight: 600;
  display: flex; align-items: center; justify-content: space-between;
  border-radius: 4px; transition: background .12s;
}
details.sf-nav-group > summary > .sf-nav-group-title::after {
  content: "▸"; font-size: 9px; opacity: .55; transition: transform .15s;
}
details.sf-nav-group[open] > summary > .sf-nav-group-title::after {
  transform: rotate(90deg);
}
details.sf-nav-group > summary:hover > .sf-nav-group-title { background: var(--bg-2); color: var(--txt-2); }
.sf-nav-group-title {
  padding: 7px 10px; font-size: 12px; color: var(--txt-3);
  text-transform: none; letter-spacing: .01em; font-weight: 600;
}
.sf-nav a {
  display: flex; align-items: center; gap: 10px; padding: 7px 10px;
  border-radius: var(--radius); color: var(--txt-2); font-size: 14px; line-height: 1.3;
  text-decoration: none; margin: 1px 0;
}
.sf-nav a:hover { background: var(--bg-3); text-decoration: none; }
.sf-nav a.active { background: var(--bg-3); color: var(--txt-1); font-weight: 500; }
.sf-nav a.active .sf-nav-icon { color: var(--accent); }
.sf-nav-icon { color: var(--txt-3); display: inline-flex; width: 16px; height: 16px; flex-shrink: 0; }
.sf-nav-label { flex: 1; }
.sf-nav-badge {
  font-size: 10px; padding: 0 6px; min-width: 18px; height: 16px;
  border-radius: 999px; background: var(--bad-soft); color: var(--bad);
  display: inline-flex; align-items: center; justify-content: center; line-height: 1;
}
/* ── 三欄工作流版型（sf3）：欄1＝時間/範圍、欄2＝對象、欄3＝內容。
   盤點/庫存統計圖表首創，全平台「選時間→選對象→看內容」的作業頁共用。
   欄1/欄2 是導覽（點了換內容），不是表單；手機(≤1020px)自動摺直排。 ── */
.sf3-grid { display: grid; grid-template-columns: 150px 235px minmax(0,1fr); gap: 14px; align-items: start; }
.sf3-grid.cols2 { grid-template-columns: 235px minmax(0,1fr); }
@media (max-width: 1020px) { .sf3-grid, .sf3-grid.cols2 { grid-template-columns: 1fr; } }
.sf3-col { background: var(--bg-1, #fff); border: 1px solid var(--line, #e3e2e0); border-radius: 12px; overflow: hidden; min-width: 0; }
.sf3-col-h { font-size: 12px; font-weight: 700; color: var(--txt-3, #9b9a97); padding: 9px 13px; border-bottom: 1px solid var(--line-2, #eceae5); }
.sf3-col-body { max-height: 640px; overflow: auto; }
.sf3-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
  border: 0; border-bottom: 1px solid var(--line-2, #f0efed); background: transparent;
  color: var(--txt-2, #5b616e); font: inherit; font-size: 12.5px; padding: 8px 13px;
  cursor: pointer; text-align: left; text-decoration: none; box-sizing: border-box;
}
.sf3-row:last-child { border-bottom: 0; }
.sf3-row:hover { background: rgba(35,131,226,.05); text-decoration: none; }
.sf3-row.on { background: rgba(35,131,226,.10); color: var(--txt-1, inherit); font-weight: 700; box-shadow: inset 3px 0 0 var(--accent, #2383e2); }
.sf3-row .sf3-nm { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sf3-tag {
  font-size: 11px; color: var(--txt-3, #9b9a97); background: var(--bg-2, #f7f6f3);
  border: 1px solid var(--line, #e3e2e0); border-radius: 999px; padding: 0 7px;
  font-variant-numeric: tabular-nums; white-space: nowrap; flex: none;
}
.sf3-row.on .sf3-tag { background: var(--accent, #2383e2); border-color: var(--accent, #2383e2); color: #fff; }
.sf3-tag.warn { background: var(--warn-soft, #fcf3e2); border-color: transparent; color: var(--warn, #8a5a10); }
/* sf3 月曆（欄1 的另一種形態：適合「挑某一天」的頁，如訂單審核） */
.sf3-cal { padding: 8px 8px 10px; }
.sf3-cal-head { display: flex; align-items: center; justify-content: space-between; margin: 2px 2px 6px; font-size: 12.5px; font-weight: 700; color: var(--txt-2, #5b616e); }
.sf3-cal-nav { border: 1px solid var(--line, #e3e2e0); background: transparent; border-radius: 6px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; color: var(--txt-3, #9b9a97); text-decoration: none; font-size: 13px; }
.sf3-cal-nav:hover { border-color: var(--accent, #2383e2); color: var(--accent, #2383e2); text-decoration: none; }
.sf3-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.sf3-cal-wd { font-size: 10px; color: var(--txt-3, #9b9a97); text-align: center; padding: 2px 0; }
.sf3-cal-d { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; height: 38px; border-radius: 8px; font-size: 12px; color: var(--txt-2, #5b616e); text-decoration: none; border: 1px solid transparent; }
a.sf3-cal-d:hover { background: rgba(35,131,226,.07); text-decoration: none; }
.sf3-cal-d.today { border-color: var(--accent, #2383e2); }
.sf3-cal-d.on { background: var(--accent, #2383e2); color: #fff; }
.sf3-cal-d .n { font-variant-numeric: tabular-nums; line-height: 1; }
.sf3-cal-d .c { font-size: 9px; line-height: 1; font-weight: 700; color: var(--txt-3, #9b9a97); font-variant-numeric: tabular-nums; }
.sf3-cal-d .c.warn { color: var(--warn, #b45309); }
.sf3-cal-d.on .c, .sf3-cal-d.on .c.warn { color: #fff; }
.sf3-cal-foot { margin-top: 6px; text-align: center; }
.sf3-cal-foot a { font-size: 11.5px; color: var(--txt-3, #9b9a97); text-decoration: none; }
.sf3-cal-foot a:hover { color: var(--accent, #2383e2); }
.sf-sidebar-foot {
  padding: 10px; border-top: var(--hairline);
  display: flex; align-items: center; gap: 10px;
}
.sf-sidebar-brandfoot {
  padding: 10px 16px 14px; border-top: var(--hairline);
  font-size: 12px; font-weight: 600; color: var(--txt-3); letter-spacing: 0.02em;
}
.sf-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--accent); color: #ffffff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; flex-shrink: 0;
}

.sf-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sf-topbar {
  height: 48px; padding: 0 20px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  border-bottom: var(--hairline); background: var(--bg-1);
  position: sticky; top: 0; z-index: 10;
}
.sf-topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.sf-topbar-right { display: flex; align-items: center; gap: 8px; }
.sf-breadcrumb { font-size: 11px; color: var(--txt-3); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .08em; }
.sf-content { flex: 1; min-width: 0; min-height: 0; }

/* theme toggle button */
.sf-theme-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--radius);
  border: 1px solid var(--line-2); background: var(--bg-2); color: var(--txt-2);
  cursor: pointer; transition: all .12s;
}
.sf-theme-toggle:hover { background: var(--bg-3); color: var(--txt-1); }

/* mobile collapse — 與既有 .notion-app.sidebar-open 機制相容 */
.sf-sidebar-toggle { display: none; }
/* 平板／手機（≤1024）：側邊選單改抽屜，預設收起、點 ☰ 滑出 */
@media (max-width: 1024px) {
  .sf-sidebar {
    position: fixed; top: 0; left: -260px; z-index: 50; height: 100vh;
    transition: left .2s; box-shadow: 0 0 20px rgba(0,0,0,0.2);
  }
  .notion-app.sidebar-open .sf-sidebar { left: 0; }
}
@media (max-width: 760px) {

  /* SF 頁面 padding 縮小，給內容更多橫向空間 */
  .sf-root { padding: 14px !important; }
  .sf-root > *[style*="padding:24px 32px"] { padding: 14px !important; }

  /* 標題與按鈕在手機應該換行 */
  .sf-root h1 { font-size: 18px !important; }

  /* KPI/統計卡：垂直堆疊或 2 欄而非橫向溢出 */
  .sf-root [style*="display:flex"][style*="gap:12px"][style*="flex-wrap:wrap"] > a,
  .sf-root [style*="display:flex"][style*="gap:12px"][style*="flex-wrap:wrap"] > div {
    min-width: calc(50% - 6px) !important;
    flex: 1 1 calc(50% - 6px) !important;
  }

  /* 主要 grid 佈局（1.4fr 1fr、1fr 360px、1fr 1fr 1fr 等）改單欄 */
  .sf-root [style*="grid-template-columns:1.4fr 1fr"],
  .sf-root [style*="grid-template-columns:1fr 360px"],
  .sf-root [style*="grid-template-columns:1fr 1fr 1fr"],
  .sf-root [style*="grid-template-columns:1fr 1fr"] {
    grid-template-columns: 1fr !important;
  }

  /* 行事曆 cells 縮小 */
  .sf-root [style*="min-height:90px"] { min-height: 56px !important; padding: 4px !important; }

  /* 表格容器允許橫向捲動，避免被擠爆 */
  .sf-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .sf-table { min-width: 560px; font-size: 12px; }
  .sf-table thead th { padding: 8px 10px; font-size: 10px; }
  .sf-table tbody td { padding: 10px; }

  /* 原始訂單欄：手機版改為 sticky 緊湊版（隨滾動跟著、方便對品項） */
  .order-detail-raw-col {
    position: sticky !important;
    top: 0 !important;
    z-index: 20;
    flex: none !important; max-width: 100% !important; width: 100% !important;
    background: var(--bg-0);
  }
  .order-detail-raw-col .sf-card[id="rawOrderBlock"] {
    position: static !important;
    max-height: 38vh !important;
    overflow-y: auto !important;
    margin: 0 !important;
    border-radius: 0 0 12px 12px !important;
    box-shadow: 0 4px 8px rgba(0,0,0,0.08);
  }
  /* 內部 padding 縮一點 */
  .order-detail-raw-col .sf-card[id="rawOrderBlock"] > div[style*="padding:14px"] { padding: 10px 12px !important; }
  /* 照片附件縮小——只在「未放大」(data-scale=1) 時鎖高度；
     放大時要解除，否則 !important 蓋過 JS 的 max-height:none，按＋只會變寬不會變大 */
  .order-detail-raw-col .sf-card[id="rawOrderBlock"] img:not(.order-attach-img) { max-height: 180px !important; }
  .order-detail-raw-col .sf-card[id="rawOrderBlock"] img.order-attach-img[data-scale="1"] { max-height: 180px !important; }
  /* 客戶打字內容 pre 字級壓小一點 */
  .order-detail-raw-col .sf-card[id="rawOrderBlock"] pre { font-size: 12px !important; line-height: 1.5 !important; padding: 8px 10px !important; }
  .order-detail-layout { flex-direction: column !important; }

  /* 模態縮 padding */
  .sf-root .sf-card,
  [id$="Modal"] .sf-card { max-width: calc(100vw - 24px); }

  /* 大型 KPI 數字縮 */
  .sf-kpi-num { font-size: 22px !important; }

  /* 行內按鈕擠在一起時自動換行 */
  .sf-root .sf-btn { white-space: nowrap; }
  /* 安全網：頁首/工具列任何含 sf-btn 的 flex 容器，手機一律允許換行，避免按鈕被切到畫面外 */
  .sf-root div:has(> .sf-btn) { flex-wrap: wrap; }
}

/* scrollbars (thin) */
.sf-root *::-webkit-scrollbar, .sf-app *::-webkit-scrollbar { width: 6px; height: 6px; }
.sf-root *::-webkit-scrollbar-thumb, .sf-app *::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 3px; }
.sf-root *::-webkit-scrollbar-track, .sf-app *::-webkit-scrollbar-track { background: transparent; }

/* 全站搜尋 */
.sf-global-search {
  position: relative; flex: 0 1 460px; max-width: 460px;
  min-width: 240px; margin: 0 16px;
  display: flex; align-items: center;
}
.sf-global-search-icon {
  position: absolute; left: 12px; top: 0; bottom: 0;
  display: flex; align-items: center;
  color: var(--txt-3); pointer-events: none;
}
.sf-global-search-icon svg { display: block; width: 16px; height: 16px; }
.sf-global-search-input {
  width: 100%; height: 36px; padding: 0 60px 0 38px;
  background: var(--bg-2); border: 1px solid var(--line-2);
  border-radius: 999px; color: var(--txt-1);
  font-size: 13px; outline: none; font-family: inherit;
  transition: border-color .12s, box-shadow .12s, background .12s;
  line-height: 36px;
}
.sf-global-search-input::placeholder { color: var(--txt-4); }
.sf-global-search-input:hover { background: var(--bg-3); }
.sf-global-search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: var(--bg-1); }
.sf-global-search-kbd {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  font-family: var(--font-mono); font-size: 10px; padding: 2px 7px;
  background: var(--bg-3); color: var(--txt-3); border: 1px solid var(--line);
  border-radius: 4px; pointer-events: none; line-height: 1.4;
  letter-spacing: 0.5px;
}
.sf-global-search-dropdown {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0;
  background: var(--bg-1); border: var(--hairline); border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0,0,0,.1); max-height: 70vh; overflow: auto;
  display: none; z-index: 200;
}
.sf-global-search-dropdown.open { display: block; }
.sf-search-group { padding: 6px 0; border-bottom: var(--hairline); }
.sf-search-group:last-child { border-bottom: none; }
.sf-search-group-title {
  padding: 6px 14px 4px; font-size: 10px; color: var(--txt-3);
  text-transform: uppercase; letter-spacing: .08em; font-weight: 500;
}
.sf-search-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 14px;
  text-decoration: none; color: var(--txt-1); cursor: pointer;
  border-left: 2px solid transparent;
}
.sf-search-item:hover, .sf-search-item.active {
  background: var(--bg-3); border-left-color: var(--accent); text-decoration: none;
}
.sf-search-item-icon { color: var(--txt-3); display: inline-flex; flex-shrink: 0; }
.sf-search-item-main { flex: 1; min-width: 0; }
.sf-search-item-title { font-size: 13px; color: var(--txt-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-search-item-sub { font-size: 11px; color: var(--txt-3); font-family: var(--font-mono); }
.sf-search-empty { padding: 16px 14px; color: var(--txt-3); font-size: 12px; text-align: center; }

@media (max-width: 760px) {
  .sf-global-search { display: none; }
}

/* 撐滿主內容區：含 .sf-root 的頁面不要被 .notion-main 的 max-width:1100px 卡住 */
.notion-main:has(> .sf-root),
.notion-main:has(> div > .sf-root) {
  max-width: none;
  padding: 0;
}
/* fallback for browsers without :has() — 透過 body class */
body.sf-fullwidth .notion-main { max-width: none; padding: 0; }

/* legacy notion-card / notion-page-title 同步進 dark 主題（避免穿色） */
[data-theme="dark"] .notion-page-title { color: var(--txt-1); }
[data-theme="dark"] .notion-hint, [data-theme="dark"] .notion-breadcrumb { color: var(--txt-3); }
[data-theme="dark"] .notion-card { background: var(--bg-1); border-color: var(--line); color: var(--txt-1); }
[data-theme="dark"] .notion-card h2 { color: var(--txt-1); }
[data-theme="dark"] body { background: var(--bg-0); color: var(--txt-1); }
`;

/** SF SVG 圖示集（16px、1.4px stroke、line style）。回傳 string 直接內嵌 */
// [refactor 2026-07-18 批次1] SF_ICONS / sfInlineIcon 已移至 dist/admin/_shared.js（無狀態表現層 helper），改由頂部 require 匯入。

/**
 * 條碼對照「新增品項（掃碼建檔）」彈出視窗。
 * 掃條碼（BarcodeDetector → zxing → 手動）→ 模糊搜尋貨品主檔（/admin/scan/search）
 * → 選品項配對 → /admin/scan/bind 寫入 product_barcode（料號需存在該公司庫存快照）。
 * 純字串（style + html + script），JS 內不含反斜線／反引號，可安全嵌入模板字串。
 */
function barcodeAddModalHtml(icpno, coName) {
  const icJson = JSON.stringify(String(icpno == null ? "02" : icpno));
  const coJson = JSON.stringify(String(coName == null ? "" : coName));
  return `
  <style>
    .bcm-mask{position:fixed;inset:0;background:rgba(15,20,30,.5);z-index:2000;display:none;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto;}
    .bcm-mask.on{display:flex;}
    .bcm-panel{background:var(--notion-card-bg,#fff);color:var(--notion-text,#1f2430);border-radius:14px;width:100%;max-width:520px;box-shadow:0 12px 48px rgba(20,30,50,.28);position:relative;display:flex;flex-direction:column;max-height:calc(100vh - 48px);}
    .bcm-h{padding:16px 18px 12px;border-bottom:1px solid var(--notion-border,#eef0f3);}
    .bcm-h .t{font-size:16px;font-weight:800;display:flex;align-items:center;gap:7px;}
    .bcm-h .s{font-size:12px;color:var(--notion-text-muted,#8b909c);margin-top:3px;}
    .bcm-x{position:absolute;right:12px;top:12px;border:0;background:transparent;color:var(--notion-text-muted,#8b909c);font-size:24px;line-height:1;cursor:pointer;padding:2px 8px;}
    .bcm-body{padding:14px 18px 18px;overflow-y:auto;}
    .bcm-cam{position:relative;border-radius:12px;overflow:hidden;background:#10131a;margin-bottom:10px;}
    .bcm-cam video{display:block;width:100%;height:30vh;max-height:260px;object-fit:cover;}
    .bcm-cam.paused video{opacity:.35;}
    .bcm-camline{position:absolute;left:10%;right:10%;top:50%;height:2px;background:rgba(255,80,80,.85);border-radius:2px;box-shadow:0 0 8px rgba(255,80,80,.7);}
    .bcm-camtools{position:absolute;top:8px;right:8px;display:flex;gap:6px;}
    .bcm-camtools button{border:0;border-radius:9px;background:rgba(0,0,0,.45);color:#fff;font-size:12px;font-weight:700;padding:6px 11px;cursor:pointer;}
    .bcm-camoff{padding:20px 14px;text-align:center;color:#c7ccd6;font-size:13px;line-height:1.6;}
    .bcm-manual{display:flex;gap:8px;margin-bottom:10px;}
    .bcm-manual input{flex:1;}
    .bcm-scanned{background:var(--notion-hover,#f7f8fa);border:1px solid var(--notion-border,#eef0f3);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px;color:var(--notion-text-muted,#8b909c);}
    .bcm-scanned b{color:var(--notion-text,#1f2430);font-variant-numeric:tabular-nums;letter-spacing:.03em;}
    .bcm-dup{color:#b9791b;font-weight:700;margin-top:4px;font-size:12px;}
    .bcm-searchrow{display:flex;align-items:center;gap:7px;margin-bottom:8px;}
    .bcm-searchrow input{flex:1;}
    .bcm-res{max-height:34vh;overflow-y:auto;}
    .bcm-cand{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--notion-card-bg,#fff);border:1px solid var(--notion-border,#eef0f3);border-radius:10px;padding:9px 12px;margin-bottom:7px;cursor:pointer;}
    .bcm-cand:hover{border-color:var(--notion-accent,#2383e2);}
    .bcm-cand .i{flex:1;min-width:0;}
    .bcm-cand .nm{font-size:14px;font-weight:700;}
    .bcm-cand .meta{font-size:11px;color:var(--notion-text-muted,#8b909c);margin-top:1px;font-variant-numeric:tabular-nums;}
    .bcm-cand .sysv{font-size:12px;color:var(--notion-text-muted,#8b909c);white-space:nowrap;font-variant-numeric:tabular-nums;}
    .bcm-sel{background:#e8f1fd;border:1.5px solid var(--notion-accent,#2383e2);border-radius:10px;padding:10px 12px;margin-bottom:10px;}
    .bcm-sel .nm{font-size:14.5px;font-weight:800;}
    .bcm-sel .meta{font-size:11.5px;color:var(--notion-text-muted,#5b616e);margin-top:1px;}
    .bcm-qps{display:flex;align-items:center;gap:10px;background:#fcf3e2;border:1px solid rgba(185,121,27,.3);border-radius:10px;padding:9px 12px;margin-bottom:12px;}
    .bcm-qps .lab{flex:1;font-size:12.5px;color:#8a5b12;font-weight:700;}
    .bcm-qps input{width:84px;text-align:center;}
    .bcm-act{display:flex;gap:10px;}
    .bcm-act .cancel{border:1px solid var(--notion-border,#e5e7ec);border-radius:10px;background:var(--notion-card-bg,#fff);color:var(--notion-text-muted,#5b616e);font-size:14px;font-weight:700;padding:11px 16px;cursor:pointer;}
    .bcm-act .go{flex:1;}
    .bcm-act .go:disabled{opacity:.45;cursor:not-allowed;}
    .bcm-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:26px;z-index:2100;background:rgba(25,30,40,.94);color:#fff;font-size:13.5px;font-weight:700;padding:10px 18px;border-radius:99px;box-shadow:0 4px 18px rgba(0,0,0,.25);opacity:0;transition:opacity .18s;pointer-events:none;max-width:86vw;text-align:center;}
    .bcm-toast.on{opacity:1;}
    .bcm-hint{font-size:12px;color:var(--notion-text-muted,#8b909c);margin:2px 0 8px;}
  </style>
  <div class="bcm-mask" id="bcmMask">
    <div class="bcm-panel">
      <button class="bcm-x" id="bcmX" aria-label="關閉">&times;</button>
      <div class="bcm-h">
        <div class="t">${SF_ICONS.tag}新增品項（掃碼建檔）</div>
        <div class="s" id="bcmSub"></div>
      </div>
      <div class="bcm-body">
        <div class="bcm-cam" id="bcmCam">
          <video id="bcmVideo" playsinline muted autoplay></video>
          <div class="bcm-camline"></div>
          <div class="bcm-camtools"><button id="bcmTorch" style="display:none;">手電筒</button><button id="bcmPause">暫停</button></div>
        </div>
        <div class="bcm-manual"><input id="bcmManual" class="sf-input" inputmode="text" placeholder="掃不到？手動輸入條碼" autocomplete="off"><button type="button" class="btn" id="bcmManualGo">帶入</button></div>
        <div class="bcm-scanned" id="bcmScanned" style="display:none;"></div>
        <div class="bcm-searchrow"><input id="bcmQ" class="sf-input" placeholder="搜尋貨品主檔：品名 / 料號 / 規格" autocomplete="off"></div>
        <p class="bcm-hint">從貨品主檔找到品項點一下配對，設定「每掃單位數」後建檔綁定。</p>
        <div class="bcm-res" id="bcmRes"></div>
        <div id="bcmSelBox"></div>
        <div class="bcm-qps"><span class="lab">掃 1 下＝幾個單位？（整箱條碼填入數）</span><input id="bcmQps" class="sf-input" inputmode="decimal" value="1"></div>
        <div class="bcm-act"><button type="button" class="cancel" id="bcmCancel">取消</button><button type="button" class="btn-primary go" id="bcmGo" disabled>建檔並綁定</button></div>
      </div>
    </div>
  </div>
  <div class="bcm-toast" id="bcmToast"></div>
  <script>
  (function(){
    var IC=${icJson};var CO=${coJson};var API='/admin/scan';
    var mask=document.getElementById('bcmMask');
    var openBtn=document.getElementById('bcmOpen');
    if(!mask||!openBtn)return;
    var S={loaded:false,barcodes:{},scanning:false,stream:null,detector:null,zreader:null,engine:'',sel:null,barcode:'',changed:false,open:false};
    function esc(s){s=(s==null?'':String(s));return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function fmt(n){var v=Number(n);if(!isFinite(v))return '0';return String(Math.round(v*100)/100);}
    function api(p){return fetch(p,{credentials:'same-origin'}).then(function(r){return r.json();});}
    function post(p,b){return fetch(p,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json();});}
    var _tt=null;function toast(m){var el=document.getElementById('bcmToast');if(!el)return;el.textContent=m;el.classList.add('on');if(_tt)clearTimeout(_tt);_tt=setTimeout(function(){el.classList.remove('on');},1500);}
    var _ac=null;
    function beep(ok){try{_ac=_ac||new (window.AudioContext||window.webkitAudioContext)();if(_ac.state==='suspended')_ac.resume();var o=_ac.createOscillator(),g=_ac.createGain();o.connect(g);g.connect(_ac.destination);o.frequency.value=ok?1320:340;g.gain.value=.12;o.start();o.stop(_ac.currentTime+(ok?.08:.22));}catch(_){}try{navigator.vibrate&&navigator.vibrate(ok?40:[70,50,70]);}catch(_){}}

    // ---------- 開關視窗 ----------
    openBtn.addEventListener('click',openModal);
    document.getElementById('bcmX').addEventListener('click',closeModal);
    document.getElementById('bcmCancel').addEventListener('click',closeModal);
    mask.addEventListener('click',function(e){if(e.target===mask)closeModal();});
    function openModal(){
      S.open=true;S.sel=null;S.barcode='';
      mask.classList.add('on');
      var sub=document.getElementById('bcmSub');if(sub)sub.textContent='條碼 → 配對 '+CO+' 貨品主檔品項 → 建檔';
      resetForm();
      loadBarcodes(function(){ startScan(); });
      setTimeout(function(){var q=document.getElementById('bcmQ');if(q)q.focus();},60);
    }
    function closeModal(){
      S.open=false;stopScan();mask.classList.remove('on');
      if(S.changed){ location.reload(); }
    }
    function resetForm(){
      S.sel=null;S.barcode='';
      var sc=document.getElementById('bcmScanned');if(sc){sc.style.display='none';sc.innerHTML='';}
      var q=document.getElementById('bcmQ');if(q)q.value='';
      var r=document.getElementById('bcmRes');if(r)r.innerHTML='';
      var sb=document.getElementById('bcmSelBox');if(sb)sb.innerHTML='';
      var qp=document.getElementById('bcmQps');if(qp)qp.value='1';
      var go=document.getElementById('bcmGo');if(go){go.disabled=true;go.textContent='建檔並綁定';}
    }
    function loadBarcodes(cb){
      if(S.loaded){cb&&cb();return;}
      api(API+'/barcodes?icpno='+encodeURIComponent(IC)).then(function(res){ S.barcodes=(res&&res.map)||{};S.loaded=true;cb&&cb(); }).catch(function(){ S.barcodes={};cb&&cb(); });
    }

    // ---------- 手動輸入 / 搜尋 ----------
    document.getElementById('bcmManualGo').addEventListener('click',manualGo);
    document.getElementById('bcmManual').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();manualGo();}});
    function manualGo(){var el=document.getElementById('bcmManual');var v=(el.value||'').trim();if(!v)return;el.value='';gotBarcode(v);}
    var _st=null;
    document.getElementById('bcmQ').addEventListener('input',function(e){var v=e.target.value.trim();if(_st)clearTimeout(_st);_st=setTimeout(function(){doSearch(v);},200);});
    document.getElementById('bcmGo').addEventListener('click',doBind);

    function gotBarcode(raw){
      S.barcode=raw;
      var sc=document.getElementById('bcmScanned');
      var dup=S.barcodes[raw];
      sc.style.display='';
      sc.innerHTML='已掃到條碼：<b>'+esc(raw)+'</b>'+(dup?('<div class="bcm-dup">此條碼已綁料號 '+esc(dup.c)+'，重新建檔將覆蓋原綁定。</div>'):'');
      beep(true);
      pauseScan();
      var q=document.getElementById('bcmQ');if(q&&!q.value){setTimeout(function(){q.focus();},30);}
    }
    function doSearch(q){
      var box=document.getElementById('bcmRes');if(!box)return;
      if(!q){box.innerHTML='';return;}
      box.innerHTML='<p class="bcm-hint">搜尋中…</p>';
      api(API+'/search?icpno='+encodeURIComponent(IC)+'&q='+encodeURIComponent(q)).then(function(res){
        var items=(res&&res.items)||[];
        if(!items.length){box.innerHTML='<p class="bcm-hint">找不到符合的貨品主檔品項。</p>';return;}
        box.innerHTML=items.map(function(it,i){return '<button type="button" class="bcm-cand" data-i="'+i+'"><div class="i"><div class="nm">'+esc(it.n)+'</div><div class="meta">'+esc(it.c)+(it.s?' · '+esc(it.s):'')+(it.w?' · 倉 '+esc(it.w):'')+'</div></div><div class="sysv">庫存 '+fmt(it.sys)+' '+esc(it.u||'')+'</div></button>';}).join('');
        Array.prototype.forEach.call(box.querySelectorAll('.bcm-cand'),function(b){b.addEventListener('click',function(){ selectItem(items[+b.getAttribute('data-i')]); });});
      }).catch(function(){box.innerHTML='<p class="bcm-hint">搜尋失敗，請再試一次。</p>';});
    }
    function selectItem(it){
      S.sel=it;
      var sb=document.getElementById('bcmSelBox');
      sb.innerHTML='<div class="bcm-sel"><div class="nm">'+esc(it.n)+'</div><div class="meta">'+esc(it.c)+(it.s?' · '+esc(it.s):'')+' · 庫存 '+fmt(it.sys)+' '+esc(it.u||'')+'</div></div>';
      var go=document.getElementById('bcmGo');if(go)go.disabled=!(S.barcode&&S.sel);
    }
    function doBind(){
      if(!S.barcode){toast('請先掃或輸入條碼');return;}
      if(!S.sel){toast('請先配對一個品項');return;}
      var qps=parseFloat(document.getElementById('bcmQps').value);if(!isFinite(qps)||qps<=0)qps=1;
      var go=document.getElementById('bcmGo');go.disabled=true;go.textContent='建檔中…';
      post(API+'/bind',{icpno:IC,barcode:S.barcode,erp_code:S.sel.c,qty_per_scan:qps}).then(function(res){
        if(res&&res.error){go.disabled=false;go.textContent='建檔並綁定';toast('建檔失敗：'+res.error);return;}
        S.barcodes[S.barcode]={c:S.sel.c,q:qps};
        S.changed=true;
        toast('已建檔：'+S.sel.n);
        resetForm();
        resumeScan();
        var m=document.getElementById('bcmManual');if(m)m.focus();
      }).catch(function(){go.disabled=false;go.textContent='建檔並綁定';toast('建檔失敗，請稍後再試');});
    }

    // ---------- 掃描引擎（BarcodeDetector → zxing → 手動）----------
    var FORMATS=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','qr_code'];
    function stopScan(){S.scanning=false;try{if(S.zreader){S.zreader.reset();S.zreader=null;}}catch(_){}try{if(S.stream){S.stream.getTracks().forEach(function(t){t.stop();});S.stream=null;}}catch(_){}}
    function pauseScan(){S.scanning=false;var c=document.getElementById('bcmCam');if(c)c.classList.add('paused');var pb=document.getElementById('bcmPause');if(pb)pb.textContent='繼續';}
    function resumeScan(){var c=document.getElementById('bcmCam');if(c)c.classList.remove('paused');var pb=document.getElementById('bcmPause');if(pb)pb.textContent='暫停';if(S.engine==='native'&&S.stream){S.scanning=true;nativeLoop();}else if(S.engine==='zxing'){S.scanning=true;}}
    var pauseBtn=document.getElementById('bcmPause');
    if(pauseBtn)pauseBtn.addEventListener('click',function(){if(S.scanning)pauseScan();else resumeScan();});
    function startScan(){
      var video=document.getElementById('bcmVideo');if(!video)return;
      if('BarcodeDetector' in window){try{S.detector=new BarcodeDetector({formats:FORMATS});}catch(_){S.detector=null;}if(S.detector){startNative(video);return;}}
      loadZxing(function(ok){ if(ok)startZxing(video); else camManual('這支瀏覽器不支援相機掃碼，請用上方欄位手動輸入條碼。'); });
    }
    function startNative(video){
      navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(stream){
        if(!S.open){stream.getTracks().forEach(function(t){t.stop();});return;}
        S.stream=stream;S.engine='native';video.srcObject=stream;
        return video.play().then(function(){ S.scanning=true;nativeLoop();
          try{var track=stream.getVideoTracks()[0];var caps=track.getCapabilities?track.getCapabilities():{};if(caps.torch){var tb=document.getElementById('bcmTorch');var on=false;tb.style.display='';tb.addEventListener('click',function(){on=!on;track.applyConstraints({advanced:[{torch:on}]}).catch(function(){});tb.textContent=on?'關手電筒':'手電筒';});}}catch(_){}
        });
      }).catch(function(){ camManual('無法開啟相機（可能未授權）。請允許相機，或手動輸入條碼。'); });
    }
    function nativeLoop(){
      if(!S.scanning||S.engine!=='native')return;
      var video=document.getElementById('bcmVideo');if(!video||video.readyState<2){setTimeout(nativeLoop,180);return;}
      S.detector.detect(video).then(function(codes){if(S.scanning&&codes&&codes.length){var raw=String(codes[0].rawValue||'').trim();if(raw)hitBarcode(raw);}}).catch(function(){}).then(function(){if(S.scanning)setTimeout(nativeLoop,240);});
    }
    function loadZxing(cb){if(window.ZXing){cb(true);return;}var s=document.createElement('script');s.src='/liff/vendor/zxing.min.js';s.onload=function(){cb(!!window.ZXing);};s.onerror=function(){cb(false);};document.head.appendChild(s);}
    function startZxing(video){
      try{if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){camManual();return;}
        var Z=window.ZXing;var hints=new Map();
        hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.UPC_E,Z.BarcodeFormat.CODE_128,Z.BarcodeFormat.CODE_39,Z.BarcodeFormat.ITF,Z.BarcodeFormat.QR_CODE]);
        hints.set(Z.DecodeHintType.TRY_HARDER,true);
        S.zreader=new Z.BrowserMultiFormatReader(hints,300);S.engine='zxing';S.scanning=true;
        S.zreader.decodeFromConstraints({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}},audio:false},video,function(result){if(result&&S.scanning){var raw=String(result.getText()||'').trim();if(raw)hitBarcode(raw);}}).catch(function(){camManual('無法開啟相機（可能未授權）。');});
      }catch(_){camManual();}
    }
    function camManual(msg){var cam=document.getElementById('bcmCam');if(cam)cam.innerHTML='<div class="bcm-camoff">'+esc(msg||'這支裝置無法用相機掃描，請用上方欄位手動輸入條碼。')+'</div>';S.engine='manual';}
    var _lastCode='',_lastAt=0;
    function hitBarcode(raw){var now=Date.now();if(raw===_lastCode&&now-_lastAt<=1500)return;_lastCode=raw;_lastAt=now;gotBarcode(raw);}
  })();
  </script>`;
}

/** SF 側邊欄（新版視覺，URL 沿用既有路由） */
function sfSidebar(active, opts = {}) {
  const item = (href, key, icon, label, badge) => `
    <a href="${href}" class="${active === key ? "active" : ""}">
      <span class="sf-nav-icon">${SF_ICONS[icon] || ""}</span>
      <span class="sf-nav-label">${label}</span>
      ${badge ? `<span class="sf-nav-badge">${badge}</span>` : ""}
    </a>`;
  return `
  <aside class="sf-sidebar">
    <nav class="sf-nav">
      <details class="sf-nav-group" open>
        <summary><div class="sf-nav-group-title">日常作業</div></summary>
        ${item("/admin", "dashboard", "spark", "儀表板")}
        ${item("/admin/orders", "orders", "check", "訂單審核")}
        ${item("/admin/complaints", "complaints", "warn", "客訴處理")}
        ${item("/admin/reminders", "reminders", "bell", "忘記叫貨提醒")}
        ${item("/admin/baskets", "baskets", "cart", "空籃記帳")}
        ${item("/admin/quotes", "quotes", "money", "報價管理")}
        ${item("/admin/freezer-fridge", "env", "thermo", "冷凍／冷藏")}
        ${item("/admin/logistics/procurement", "logistics-procurement", "truck", "物流叫貨")}
        ${item("/admin/logistics/market", "logistics-reports", "chartLine", "行情報表")}
      </details>
      ${opts.canCash ? `<details class="sf-nav-group" ${["cash","cash-collect","cash-customers","cash-report"].includes(active) ? "open" : ""}>
        <summary><div class="sf-nav-group-title">收款作業</div></summary>
        ${item("/admin/cash", "cash", "money", "松富銷貨統計")}
        ${item("/admin/cash/collect", "cash-collect", "check", "現金收款")}
        ${item("/admin/cash/customers", "cash-customers", "users", "收款客戶主檔")}
      </details>` : ""}
      <details class="sf-nav-group" ${["inventory","inv-entry","inv-scan","inv-stock","inv-stats","inv-adjust","inv-settings"].includes(active) ? "open" : ""}>
        <summary><div class="sf-nav-group-title">庫存管理</div></summary>
        ${item("/admin/inventory", "inventory", "clipboard", "盤點")}
        ${item("/admin/scan", "inv-scan", "search", "掃碼盤點")}
        ${item("/admin/inventory/stock", "inv-stock", "box", "目前庫存")}
        ${item("/admin/inventory/stats", "inv-stats", "chartBar", "庫存統計")}
        ${item("/admin/inventory/adjustments", "inv-adjust", "refresh", "庫存調整")}
        ${item("/admin/inventory/warehouse-settings", "inv-settings", "pin", "盤點設定")}
      </details>
      <details class="sf-nav-group" ${["customers","cust-groups","products","ai-examples"].includes(active) ? "open" : ""}>
        <summary><div class="sf-nav-group-title">主檔管理</div></summary>
        ${item("/admin/customers", "customers", "users", "客戶管理")}
        ${item("/admin/customers/groups", "cust-groups", "message", "群組功能")}
        ${item("/admin/products", "products", "note", "貨品管理")}
        ${item("/admin/ai-examples", "ai-examples", "wand", "AI 學習庫")}
      </details>
      <details class="sf-nav-group" ${["audit","analytics","recognition-stats","broadcast","announcements","calendar"].includes(active) ? "open" : ""}>
        <summary><div class="sf-nav-group-title">報表與通訊</div></summary>
        ${item("/admin/analytics", "analytics", "chartBar", "營運分析")}
        ${item("/admin/audit", "audit", "history", "稽核軌跡")}
        ${item("/admin/recognition-stats", "recognition-stats", "bolt", "辨識成效")}
        ${item("/admin/broadcast", "broadcast", "mail", "群發訊息")}
        ${item("/admin/announcements", "announcements", "megaphone", "公告管理")}
        ${item("/admin/calendar", "calendar", "calendar", "行事曆")}
      </details>
      <details class="sf-nav-group" ${["tr-dash","tr-plans","tr-courses","tr-employees","tr-system"].includes(active) ? "open" : ""}>
        <summary><div class="sf-nav-group-title">教育訓練</div></summary>
        ${item("/admin/training", "tr-dash", "spark", "訓練儀表板")}
        ${item("/admin/training/plans", "tr-plans", "clipboard", "年度計畫")}
        ${item("/admin/training/courses", "tr-courses", "note", "課程紀錄")}
        ${item("/admin/training/employees", "tr-employees", "user", "員工名冊")}
        ${item("/admin/training/system", "tr-system", "wand", "TTQS 系統文件")}
      </details>
      <details class="sf-nav-group" ${["line-bot","users"].includes(active) ? "open" : ""}>
        <summary><div class="sf-nav-group-title">系統設定</div></summary>
        ${item("/admin/line-bot", "line-bot", "message", "LINE 機器人")}
        ${item("/admin/users", "users", "user", "人員管理")}
      </details>
    </nav>
    <div class="sf-sidebar-foot" id="sfSidebarFoot"></div>
    <div class="sf-sidebar-brandfoot">松富物流</div>
  </aside>
  `;
}

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
let _sessionSecretCache = null;
function getAdminSessionSecret() {
    const env = (process.env.ADMIN_SESSION_SECRET || "").trim();
    if (env)
        return env;
    // [fix 2026-07-08 資安] 未設定時「絕不」回傳寫死在原始碼的預設值——該值公開在 git，
    // 任何看得到程式碼的人都能用它偽造管理員 session cookie 直接登入（含負責人帳號）。
    // 改為 fail-closed：用「本次啟動隨機」祕密（安全，但重啟會使所有 session 失效需重新登入）。
    // 正式環境務必在 Cloud Run 設定固定的 ADMIN_SESSION_SECRET，讓登入跨重啟穩定。
    if (!_sessionSecretCache) {
        _sessionSecretCache = crypto_1.randomBytes(48).toString("hex");
        console.error("[SECURITY] 未設定 ADMIN_SESSION_SECRET！已改用本次啟動隨機祕密（每次重啟會登出所有人）。請盡快在 Cloud Run 設定固定值。");
    }
    return _sessionSecretCache;
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
        canCash: raw.canCash === true || raw.canCash === 1 || raw.canCash === "1",
        approvedBy: raw.approvedBy != null ? String(raw.approvedBy) : null,
        approvedAt: raw.approvedAt != null ? String(raw.approvedAt) : null,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
        lineUserId: raw.lineUserId != null && String(raw.lineUserId).trim() ? String(raw.lineUserId).trim() : null,
        lineUserName: raw.lineUserName != null ? String(raw.lineUserName) : null,
        lineBoundAt: raw.lineBoundAt != null ? String(raw.lineBoundAt) : null,
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
        <a href="/admin" class="notion-app-logo" title="松富物流">
          <img src="/admin/assets/logo.svg" alt="松富物流" width="26" height="26">
          <span class="logo-text">松富物流</span>
        </a>
        <span class="notion-app-header-sep">/</span>
        <span class="notion-app-header-title">${t}</span>
      </div>
      <div class="sf-global-search" id="sfGlobalSearchWrap">
        <span class="sf-global-search-icon">${SF_ICONS.search}</span>
        <input type="search" id="sfGlobalSearchInput" class="sf-global-search-input" placeholder="搜尋訂單號、客戶、品項、頁面…（Ctrl/Cmd+K）" autocomplete="off" spellcheck="false">
        <kbd class="sf-global-search-kbd">⌘K</kbd>
        <div class="sf-global-search-dropdown" id="sfGlobalSearchDropdown"></div>
      </div>
      <div class="notion-app-header-right">
        <button type="button" class="sf-theme-toggle" onclick="window.sfToggleTheme&&window.sfToggleTheme()" aria-label="切換深淺主題" title="切換深淺／淺色"><span id="sfThemeIcon">${SF_ICONS.moon}</span></button>
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
/**
 * 把 DB 時間戳（Postgres timestamptz 回傳為 Date 物件，或 ISO 字串）格式化為台北時間。
 * 舊寫法 String(v).replace("T"," ").slice(...) 遇到 Date 物件會變成 "Fri Jul 03 2026" → 切成 "ul 03 2026"。
 */
function fmtTaipeiParts(v) {
    if (v == null || v === "")
        return null;
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime()))
        return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d);
    const g = (t) => (parts.find((x) => x.type === t) || {}).value || "";
    return { y: g("year"), mo: g("month"), d: g("day"), h: g("hour"), mi: g("minute") };
}
/** 台北時間 MM-DD HH:mm（列表用）；無效回傳 fallback（預設 "—"） */
function fmtTaipeiMMDDHHmm(v, fallback = "—") {
    const p = fmtTaipeiParts(v);
    return p ? `${p.mo}-${p.d} ${p.h}:${p.mi}` : fallback;
}
/** 台北時間 YYYY-MM-DD HH:mm（明細用）；無效回傳 fallback（預設 "—"） */
function fmtTaipeiYMDHM(v, fallback = "—") {
    const p = fmtTaipeiParts(v);
    return p ? `${p.y}-${p.mo}-${p.d} ${p.h}:${p.mi}` : fallback;
}
// ── 目前庫存頁：緊湊表樣式（品項多，行高壓到最小、表頭吸頂）─────────────
const STK_STYLE = `
.stk-wrap{max-width:100%;}
.stk-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:6px 0 8px;}
.stk-toolbar-left,.stk-toolbar-right{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.stk-search{min-width:200px;flex:1 1 200px;padding:6px 10px;border:1px solid var(--notion-border,#e3e2e0);border-radius:7px;font-size:13px;background:var(--notion-card,#fff);color:inherit;}
/* 檢視切換 用全站標準 .sf-seg；隱藏0/只看低量 用全站標準 .sf-switch（見主樣式表） */
/* 倉庫左側欄 ＋ 表格 兩欄版面 */
.stk-main{display:flex;gap:12px;align-items:flex-start;}
.stk-rail{flex:0 0 212px;display:flex;flex-direction:column;border:1px solid var(--notion-border,#e3e2e0);border-radius:8px;overflow:hidden;background:var(--notion-card,#fff);position:sticky;top:8px;}
.stk-rail-h{flex:0 0 auto;font-size:11px;font-weight:700;color:var(--notion-text-light,#787774);padding:8px 12px;background:var(--notion-bg,#f7f7f5);border-bottom:1px solid var(--notion-border,#e3e2e0);}
.stk-rail-body{overflow:visible;}
.stk-rail-item{display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:12.5px;cursor:pointer;border-bottom:1px solid var(--notion-border,#f2f1ee);white-space:nowrap;color:inherit;}
.stk-rail-item:hover{background:rgba(35,131,226,.06);}
.stk-rail-item.active{background:rgba(35,131,226,.10);color:#2383e2;font-weight:600;box-shadow:inset 3px 0 0 #2383e2;}
.stk-rail-name{overflow:hidden;text-overflow:ellipsis;}
.stk-rail-n{margin-left:auto;color:var(--notion-text-light,#787774);font-size:11.5px;font-variant-numeric:tabular-nums;}
.stk-rail-item.active .stk-rail-n{color:#2383e2;}
.stk-main .stk-tablewrap{flex:1;min-width:0;}
.stk-rail-item{text-decoration:none;}
.stk-corail{flex:0 0 138px;}
.stk-corail .stk-rail-item{padding-top:9px;padding-bottom:9px;font-size:13.5px;}
.stk-corail .stk-rail-n{font-size:10.5px;color:var(--notion-text-light,#9b9a97);}
@media (max-width:760px){.stk-main{flex-direction:column;}.stk-rail{flex:0 0 auto;width:100%;max-height:210px;position:static;top:auto;}.stk-corail{max-height:none;}.stk-corail .stk-rail-body{display:flex;overflow-x:auto;}.stk-corail .stk-rail-item{flex:0 0 auto;border-bottom:0;border-right:1px solid var(--notion-border,#f2f1ee);}.stk-rail-body{overflow:auto;}.stk-main .stk-tablewrap{width:100%;}}
.stk-meta{font-size:12px;color:var(--notion-text-light,#787774);white-space:nowrap;}
.stk-status{margin:0 0 8px;padding:8px 12px;border-radius:7px;font-size:13px;}
.stk-status-wait{background:#eef4ff;color:#1d4ed8;}
.stk-status-ok{background:#e7f5e9;color:#2e7d32;}
.stk-status-warn{background:#fff8e1;color:#8a6d1b;}
.stk-tablewrap{max-height:calc(100vh - 190px);overflow:auto;border:1px solid var(--notion-border,#e3e2e0);border-radius:8px;}
.stk-table{border-collapse:separate;border-spacing:0;width:100%;font-size:12px;line-height:1.1;}
.stk-table th,.stk-table td{padding:2px 8px;border-bottom:1px solid var(--notion-border,#efefee);white-space:nowrap;}
.stk-table thead th{position:sticky;top:0;z-index:2;background:var(--notion-card,#f7f7f5);text-align:left;font-weight:700;color:var(--notion-text-light,#555);border-bottom:1px solid var(--notion-border,#e3e2e0);}
.stk-table td.stk-qty,.stk-table th.stk-qty{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;}
.stk-name{max-width:300px;overflow:hidden;text-overflow:ellipsis;}
.stk-spec{max-width:170px;overflow:hidden;text-overflow:ellipsis;color:var(--notion-text-light,#787774);}
.stk-code{color:var(--notion-text-light,#787774);font-variant-numeric:tabular-nums;}
.stk-wh{color:var(--notion-text-light,#787774);}
.stk-table tbody tr:hover{background:rgba(35,131,226,.06);}
.stk-table tbody tr[data-code]{cursor:pointer;}
.stk-table tbody tr[data-code] td.stk-code{color:#2383e2;}
.stk-neg td.stk-qty{color:#c62828;}
.stk-low{background:rgba(255,193,7,.12);}
.stk-neg{background:rgba(198,40,40,.08);}
.stk-grouphead td{position:sticky;top:20px;background:var(--notion-bg,#f1f1ef);font-weight:700;z-index:1;border-top:1px solid var(--notion-border,#e3e2e0);cursor:default;}
.stk-gcount{font-weight:500;font-size:11px;color:var(--notion-text-light,#787774);margin-left:8px;}
.stk-empty{text-align:center;color:var(--notion-text-light,#787774);padding:24px;}
/* 品項照片欄（第四波）：縮圖／上傳鈕／放大 overlay */
/* [2026-07-11] 照片功能暫時關閉（使用者：目前不需要）。整欄隱藏＝連表頭 th 一起收，版面不留空欄。
   要重新開啟：刪掉下面這行 display:none 覆蓋即可，底層路由/資料都還在。 */
.stk-table td.stk-photo,.stk-table th.stk-photo{display:none!important;}
.stk-table td.stk-photo,.stk-table th.stk-photo{text-align:center;width:1%;white-space:nowrap;}
.stk-thumb{width:34px;height:34px;object-fit:cover;border-radius:6px;border:1px solid var(--notion-border,#e3e2e0);cursor:pointer;vertical-align:middle;display:inline-block;background:var(--notion-bg,#f2f1ee);}
.stk-upbtn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--notion-border,#e3e2e0);background:var(--notion-card,#fff);color:var(--notion-text-light,#787774);border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;line-height:1.4;}
.stk-upbtn:hover{color:#2383e2;border-color:#2383e2;}
.stk-upbtn svg{width:14px;height:14px;}
.stk-photo-ov{position:fixed;inset:0;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center;z-index:10000;padding:20px;}
.stk-photo-ov.on{display:flex;}
.stk-photo-ov .box{max-width:min(92vw,520px);display:flex;flex-direction:column;gap:12px;align-items:center;}
.stk-photo-ov img{max-width:100%;max-height:72vh;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.4);background:#fff;}
.stk-photo-ov .acts{display:flex;gap:10px;}
.stk-photo-ov .acts button{border:0;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;}
.stk-ov-replace{background:#fff;color:#2383e2;}
.stk-ov-del{background:#fef2f2;color:#b91c1c;}
.stk-ov-close{background:rgba(255,255,255,.16);color:#fff;}
@media (max-width:640px){.stk-spec{display:none;}.stk-tablewrap{max-height:calc(100vh - 240px);}}
`;
// 目前庫存頁前端腳本（無 backtick、無 ${} 以免與外層樣板字面衝突）
const STK_CLIENT_JS = `
(function(){
  var raw = document.getElementById('stkData');
  var DATA = {items:[],assign:{}};
  try { DATA = JSON.parse(raw.textContent || '{}'); } catch(e){ DATA = {items:[],assign:{}}; }
  var ITEMS = DATA.items || [];
  var ASSIGN = DATA.assign || {};
  var WHNAME = DATA.whname || {};
  var FUT_ON = !!DATA.futOn;   // 未來銷貨加回開關是否打開（開＝it.q 已含加回）
  // 品項照片（第四波）：料號→版本（1＝原有；上傳後改為 Date.now() 作快取破壞）
  var PHOTOS = {}; (DATA.photos || []).forEach(function(c){ PHOTOS[String(c)] = 1; });
  var ICON_CAM = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 5.5h2l1-1.5h3l1 1.5h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"/><circle cx="8" cy="8.5" r="2"/></svg>';
  var els = {
    search: document.getElementById('stkSearch'),
    view: document.getElementById('stkView'),
    hideZero: document.getElementById('stkHideZero'),
    lowOnly: document.getElementById('stkLowOnly'),
    futRev: document.getElementById('stkFutRev'),
    exportBtn: document.getElementById('stkExport'),
    refresh: document.getElementById('stkRefresh'),
    rail: document.getElementById('stkRail'),
    wrap: document.getElementById('stkTableWrap'),
    count: document.getElementById('stkCount'),
    status: document.getElementById('stkStatus')
  };
  var UNSET_LY='（未設倉別）';
  var state = { view:'list', q:'', hideZero:false, low:false, wh:'' };
  try { var saved = JSON.parse(localStorage.getItem('stk.state')||'{}'); if(saved.view) state.view=saved.view; if(saved.hideZero) state.hideZero=!!saved.hideZero; } catch(_){}
  function save(){ try { localStorage.setItem('stk.state', JSON.stringify({view:state.view,hideZero:state.hideZero})); } catch(_){} }
  function esc(s){ s=(s==null?'':String(s)); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function safetyOf(code){ var a=ASSIGN[code]; if(!a||!a.length) return 0; var m=0; for(var i=0;i<a.length;i++){ if(a[i].safety>m) m=a[i].safety; } return m; }
  function fmtQty(q){ if(q===0) return '0'; return String(q); }
  // 一個品項屬於哪些倉（依來源）：自訂庫房可能多個；沒名字就用代號
  // 依凌越倉庫號碼（貨品主檔 SK_RKWHNO）分組；沒設倉別的歸「（未設倉別）」
  function whsOf(it){ return [it.w||UNSET_LY]; }
  function whSort(it){ return it.w?0:1e9; }
  // 顯示標籤：有中文名就顯示「代號 中文名」，否則只顯示代號
  function whLabel(code){ if(code===UNSET_LY) return code; var nm=WHNAME[code]; return nm?(code+' '+nm):code; }
  // 搜尋 + 隱藏0 + 只看低量（不含倉別選取）
  function baseFilter(it){
    if(state.hideZero && it.q===0) return false;
    if(state.low){ var s=safetyOf(it.c); var low=it.q<=0||(s>0&&it.q<s); if(!low) return false; }
    if(state.q){ var q=state.q; if(!((it.c.toLowerCase().indexOf(q)>=0)||(it.n.toLowerCase().indexOf(q)>=0)||(it.s.toLowerCase().indexOf(q)>=0))) return false; }
    return true;
  }
  function photoCell(it){
    if(PHOTOS[it.c]){ var v=(PHOTOS[it.c]>1)?('?v='+PHOTOS[it.c]):''; return '<td class="stk-photo"><img class="stk-thumb" loading="lazy" alt="" src="/admin/inventory/item-photo/'+encodeURIComponent(it.c)+v+'" data-photo="'+esc(it.c)+'"></td>'; }
    return '<td class="stk-photo"><button type="button" class="stk-upbtn" data-upload="'+esc(it.c)+'">'+ICON_CAM+'上傳</button></td>';
  }
  // 未來銷貨加回 badge：開關開＝藍底「未來+N」（it.q 已含）；關＝灰底提示（存在但未加回）
  function futBadge(it){
    if(!it.fut) return '';
    var v=it.fut; var sign=(v>0?'+':'');
    if(FUT_ON){ return '<span title="已加回未來日期銷貨 '+sign+v+'（原凌越 '+fmtQty(it.qraw)+'）" style="margin-left:6px;font-size:10.5px;font-weight:700;color:#0369a1;background:#e0f2fe;border-radius:5px;padding:1px 5px;white-space:nowrap;">未來'+sign+v+'</span>'; }
    return '<span title="有未來日期銷貨 '+sign+v+'（目前未加回；打開上方『未來銷貨加回』會計入顯示庫存）" style="margin-left:6px;font-size:10.5px;font-weight:600;color:#94a3b8;background:#f1f5f9;border-radius:5px;padding:1px 5px;white-space:nowrap;">未來'+sign+v+'</span>';
  }
  function rowHtml(it){
    var s=safetyOf(it.c); var neg=it.q<0; var low=(it.q>0&&s>0&&it.q<s);
    var cls=neg?'stk-neg':(low?'stk-low':'');
    return '<tr class="'+cls+'"'+(TXN_ENABLED?(' data-code="'+esc(it.c)+'" data-name="'+esc(it.n)+'"'):'')+'><td class="stk-code">'+esc(it.c)+'</td><td class="stk-name" title="'+esc(it.n)+'">'+esc(it.n)+'</td><td class="stk-spec">'+esc(it.s)+'</td><td class="stk-unit">'+esc(it.u)+'</td><td class="stk-qty">'+fmtQty(it.q)+(it.adj?('<span title="含人工調整 '+(it.adj>0?'+':'')+it.adj+'（原凌越 '+fmtQty(it.qraw)+'）" style="margin-left:6px;font-size:10.5px;font-weight:700;color:#8250df;background:#f3eefd;border-radius:5px;padding:1px 5px;white-space:nowrap;">調'+(it.adj>0?'+':'')+it.adj+'</span>'):'')+futBadge(it)+'</td><td class="stk-wh">'+esc(whsOf(it).map(whLabel).join('、'))+'</td>'+photoCell(it)+'</tr>';
  }
  function theadHtml(){ return '<thead><tr><th>料號</th><th>品名</th><th>規格</th><th>單位</th><th class="stk-qty">目前庫存</th><th>凌越倉別</th><th class="stk-photo">照片</th></tr></thead>'; }
  function renderList(list){
    var b=[]; for(var i=0;i<list.length;i++) b.push(rowHtml(list[i]));
    return '<table class="stk-table">'+theadHtml()+'<tbody>'+(b.join('')||'<tr><td colspan="7" class="stk-empty">— 無符合條件的品項 —</td></tr>')+'</tbody></table>';
  }
  function renderGroup(list){
    var groups={}; var order=[];
    function ensure(key,sort){ if(!groups[key]){ groups[key]={rows:[],sum:0,sort:sort}; order.push(key); } return groups[key]; }
    for(var i=0;i<list.length;i++){
      var it=list[i]; var whs=whsOf(it); var st=whSort(it);
      for(var j=0;j<whs.length;j++){ var g=ensure(whs[j],st); g.rows.push(it); g.sum+=it.q; }
    }
    order.sort(function(x,y){ var gx=groups[x],gy=groups[y]; if(gx.sort!==gy.sort) return gx.sort-gy.sort; return x<y?-1:(x>y?1:0); });
    var out=['<table class="stk-table">'+theadHtml()+'<tbody>'];
    if(!order.length) out.push('<tr><td colspan="7" class="stk-empty">— 無符合條件的品項 —</td></tr>');
    for(var k=0;k<order.length;k++){
      var key2=order[k]; var g4=groups[key2];
      out.push('<tr class="stk-grouphead"><td colspan="7">'+esc(whLabel(key2))+'<span class="stk-gcount">'+g4.rows.length+' 項 · Σ '+fmtQty(Math.round(g4.sum*100)/100)+'</span></td></tr>');
      for(var r=0;r<g4.rows.length;r++) out.push(rowHtml(g4.rows[r]));
    }
    out.push('</tbody></table>');
    return out.join('');
  }
  function renderRail(base){
    var counts={}, order=[];
    for(var i=0;i<base.length;i++){ var whs=whsOf(base[i]); for(var j=0;j<whs.length;j++){ var w=whs[j]; if(counts[w]==null){ counts[w]=0; order.push(w); } counts[w]++; } }
    order.sort(function(x,y){ return x<y?-1:(x>y?1:0); });
    var html='<div class="stk-rail-item'+(state.wh===''?' active':'')+'" data-w=""><span class="stk-rail-name">全部倉庫</span><span class="stk-rail-n">'+base.length+'</span></div>';
    for(var k=0;k<order.length;k++){ var w=order[k]; html+='<div class="stk-rail-item'+(state.wh===w?' active':'')+'" data-w="'+esc(w)+'"><span class="stk-rail-name">'+esc(whLabel(w))+'</span><span class="stk-rail-n">'+counts[w]+'</span></div>'; }
    els.rail.innerHTML=html;
    Array.prototype.forEach.call(els.rail.querySelectorAll('.stk-rail-item'),function(c){ c.addEventListener('click',function(){ state.wh=c.getAttribute('data-w'); render(); }); });
  }
  var _filtered=[];
  function render(){
    var base=[]; for(var i=0;i<ITEMS.length;i++){ if(baseFilter(ITEMS[i])) base.push(ITEMS[i]); }
    renderRail(base);
    var list;
    if(state.wh===''){ list=base; }
    else { list=[]; for(var i2=0;i2<base.length;i2++){ if(whsOf(base[i2]).indexOf(state.wh)>=0) list.push(base[i2]); } }
    _filtered=list;
    els.count.textContent=list.length+(list.length!==ITEMS.length?(' / '+ITEMS.length):'');
    els.wrap.innerHTML=(state.view==='group')?renderGroup(list):renderList(list);
  }
  var t=null;
  els.search.addEventListener('input',function(){ if(t) clearTimeout(t); t=setTimeout(function(){ state.q=els.search.value.trim().toLowerCase(); render(); },120); });
  Array.prototype.forEach.call(els.view.querySelectorAll('button'),function(btn){
    btn.addEventListener('click',function(){ state.view=btn.getAttribute('data-v'); Array.prototype.forEach.call(els.view.querySelectorAll('button'),function(b){ b.classList.toggle('active',b===btn); }); save(); render(); });
    btn.classList.toggle('active', btn.getAttribute('data-v')===state.view);
  });
  els.hideZero.checked=state.hideZero;
  els.hideZero.addEventListener('change',function(){ state.hideZero=els.hideZero.checked; state.wh=''; save(); render(); });
  els.lowOnly.addEventListener('change',function(){ state.low=els.lowOnly.checked; state.wh=''; render(); });
  // 未來銷貨加回：全域設定，切換後存後台再重載（顯示量含加回/遮蔽由後端算）
  if(els.futRev){ els.futRev.addEventListener('change',function(){
    var on=els.futRev.checked; els.futRev.disabled=true;
    fetch('/admin/inventory/stock/future-toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({on:on})})
      .then(function(r){return r.json();}).then(function(){ location.reload(); })
      .catch(function(){ els.futRev.disabled=false; els.futRev.checked=!on; });
  }); }
  els.exportBtn.addEventListener('click',function(){
    var lines=['料號,品名,規格,單位,目前庫存,凌越倉別'];
    function q(x){ x=(x==null?'':String(x)); return '"'+x.replace(/"/g,'""')+'"'; }
    for(var i=0;i<_filtered.length;i++){ var it=_filtered[i]; lines.push([q(it.c),q(it.n),q(it.s),q(it.u),it.q,q(whsOf(it).join(' '))].join(',')); }
    var blob=new Blob(['\\ufeff'+lines.join('\\r\\n')],{type:'text/csv;charset=utf-8;'});
    var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download='stock.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  });
  els.refresh.addEventListener('click',function(){
    els.refresh.disabled=true;
    els.status.style.display=''; els.status.className='stk-status stk-status-wait'; els.status.textContent='已送出更新請求（本公司），等待內網代理刷新…';
    var baseline='';
    var clickAt=new Date().toISOString();
    // 只重推當頁公司（DATA.icpno）：不必動整合代理設定即可換公司更新
    fetch('/admin/inventory/stock/status').then(function(r){return r.json();}).then(function(m){ baseline=m.snapshot_at||''; return fetch('/admin/inventory/stock/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({icpno:DATA.icpno||''})}); }).then(function(r){return r.json();}).then(function(){
      var tries=0; var iv=setInterval(function(){
        tries++;
        fetch('/admin/inventory/stock/status').then(function(r){return r.json();}).then(function(m){
          if(m.snapshot_at&&m.snapshot_at!==baseline){ clearInterval(iv); els.status.className='stk-status stk-status-ok'; els.status.textContent='已更新，重新載入…'; setTimeout(function(){ location.reload(); },600); return; }
          // 代理已回報這次請求後的錯誤（如凌越連線逾時）→ 直接顯示真正原因
          if(m.refresh_error&&m.refresh_error_at&&m.refresh_error_at>=clickAt){ clearInterval(iv); els.refresh.disabled=false; els.status.className='stk-status stk-status-warn'; els.status.textContent='更新失敗：'+m.refresh_error; return; }
          if(tries>=24){ clearInterval(iv); els.refresh.disabled=false; els.status.className='stk-status stk-status-warn'; els.status.textContent='等待逾時：可能凌越連線異常或代理未執行。資料仍會在下次定時（06:00／12:00）自動更新。'; }
        }).catch(function(){});
      },3000);
    }).catch(function(){ els.refresh.disabled=false; els.status.className='stk-status stk-status-warn'; els.status.textContent='送出失敗，請稍後再試。'; });
  });
  // ── 進銷存抽屜：點品項 → 經內網小幫手查凌越 → 顯示 ─────────────
  var TXN_ENABLED=false;   // 進銷查詢暫時關閉（會打凌越，先停用避免壞）；要開回來改成 true
  var _drawer=document.createElement('div');
  _drawer.style.cssText='position:fixed;top:0;right:0;height:100%;width:400px;max-width:92vw;background:var(--notion-card,#fff);color:inherit;box-shadow:-6px 0 24px rgba(0,0,0,.18);transform:translateX(100%);transition:transform .22s ease;z-index:9999;display:flex;flex-direction:column;';
  _drawer.innerHTML='<div style="padding:14px 16px;border-bottom:1px solid var(--notion-border,#eee);display:flex;align-items:center;gap:8px;"><b id="stkDwTitle" style="flex:1;font-size:15px;"></b><button id="stkDwClose" style="border:0;background:var(--notion-bg,#f2f2f2);color:inherit;border-radius:6px;padding:5px 12px;cursor:pointer;">關閉</button></div><div id="stkDwBody" style="padding:14px 16px;overflow:auto;flex:1;font-size:13px;line-height:1.7;"></div>';
  document.body.appendChild(_drawer);
  var _back=document.createElement('div');
  _back.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .22s;z-index:9998;';
  document.body.appendChild(_back);
  function dwClose(){ _drawer.style.transform='translateX(100%)'; _back.style.opacity='0'; _back.style.pointerEvents='none'; if(_pt){clearInterval(_pt);_pt=null;} }
  _drawer.querySelector('#stkDwClose').addEventListener('click',dwClose);
  _back.addEventListener('click',dwClose);
  var _pt=null;
  function fmtN(v){ if(v==null||v==='') return ''; return String(v); }
  function rnd(v){ var n=Number(v); if(!isFinite(n)) return 0; return Math.round(n*10000)/10000; }
  // 入庫(+)/出庫(-) 判斷：優先用 dir；舊資料沒有 dir 時用類型推（退/進/入=入庫）
  function dirOf(r){ if(r.dir==='in'||r.dir==='out') return r.dir; var k=String(r.kind||''); return (k.indexOf('退')>=0||k.indexOf('進')>=0||k.indexOf('入')>=0)?'in':'out'; }
  var C_IN='#2e7d32', C_OUT='#c0392b';
  function signQty(r){ var q=Number(r.qty); if(!isFinite(q)) return fmtN(r.qty); var s=rnd(dirOf(r)==='in'?q:-q); return (s>0?'+':'')+s; }
  function dwRender(body,m){
    var d=m.data||{}; var recs=d.records||[]; var h='';
    if(m.fetched_at){ h+='<div style="color:var(--notion-text-light,#999);font-size:11px;margin-bottom:8px;">資料時間 '+esc(String(m.fetched_at).replace('T',' ').slice(0,19))+(m.cached?'（快取）':'')+'　共 '+recs.length+' 筆</div>'; }
    // 進/出彙總（優先用後端算好的；沒有就前端自算）
    var sin=(typeof d.sum_in==='number')?d.sum_in:null, sout=(typeof d.sum_out==='number')?d.sum_out:null, net=(typeof d.net==='number')?d.net:null;
    if(sin===null||sout===null){ sin=0; sout=0; for(var a=0;a<recs.length;a++){ var qq=Number(recs[a].qty); if(isFinite(qq)){ if(dirOf(recs[a])==='in') sin+=qq; else sout+=qq; } } net=sin-sout; }
    if(net===null) net=sin-sout;
    if(recs.length){
      var nc=(net>=0)?C_IN:C_OUT;
      h+='<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">'
        +'<div style="flex:1;min-width:78px;background:var(--notion-bg,#f6f8f6);border-radius:8px;padding:7px 9px;text-align:center;"><div style="font-size:10px;color:var(--notion-text-light,#888);">Σ 入庫</div><div style="font-size:15px;font-weight:700;color:'+C_IN+';font-variant-numeric:tabular-nums;">+'+rnd(sin)+'</div></div>'
        +'<div style="flex:1;min-width:78px;background:var(--notion-bg,#f8f6f6);border-radius:8px;padding:7px 9px;text-align:center;"><div style="font-size:10px;color:var(--notion-text-light,#888);">Σ 出庫</div><div style="font-size:15px;font-weight:700;color:'+C_OUT+';font-variant-numeric:tabular-nums;">-'+rnd(sout)+'</div></div>'
        +'<div style="flex:1;min-width:78px;background:var(--notion-bg,#f2f2f0);border-radius:8px;padding:7px 9px;text-align:center;"><div style="font-size:10px;color:var(--notion-text-light,#888);">淨變動</div><div style="font-size:15px;font-weight:700;color:'+nc+';font-variant-numeric:tabular-nums;">'+(rnd(net)>=0?'+':'')+rnd(net)+'</div></div>'
        +'</div>';
    }
    if(d.note){ h+='<div style="color:#b7791f;font-size:12px;margin-bottom:8px;">'+esc(d.note)+'</div>'; }
    if(!recs.length){ h+='<div style="color:var(--notion-text-light,#888);">近期查無進銷交易紀錄。</div>'; body.innerHTML=h; return; }
    h+='<table style="width:100%;border-collapse:collapse;font-size:12px;">';
    h+='<thead><tr>'
      +'<th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--notion-border,#eee);color:var(--notion-text-light,#888);">日期</th>'
      +'<th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--notion-border,#eee);color:var(--notion-text-light,#888);">類型</th>'
      +'<th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--notion-border,#eee);color:var(--notion-text-light,#888);">客戶</th>'
      +'<th style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--notion-border,#eee);color:var(--notion-text-light,#888);">進/出數量</th>'
      +'<th style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--notion-border,#eee);color:var(--notion-text-light,#888);">單價</th>'
      +'<th style="text-align:right;padding:4px 6px;border-bottom:1px solid var(--notion-border,#eee);color:var(--notion-text-light,#888);">金額</th>'
      +'</tr></thead><tbody>';
    for(var i=0;i<recs.length;i++){ var r=recs[i];
      var isIn=(dirOf(r)==='in'); var kc=isIn?C_IN:C_OUT;
      var badge=isIn?'入':'出';
      h+='<tr>'
        +'<td style="padding:3px 6px;border-bottom:1px solid var(--notion-border,#f2f2f0);white-space:nowrap;font-variant-numeric:tabular-nums;">'+esc(r.date||'')+'</td>'
        +'<td style="padding:3px 6px;border-bottom:1px solid var(--notion-border,#f2f2f0);white-space:nowrap;"><span style="display:inline-block;min-width:14px;text-align:center;border-radius:4px;color:#fff;background:'+kc+';font-size:10px;font-weight:700;padding:0 3px;margin-right:4px;">'+badge+'</span><span style="color:'+kc+';font-weight:600;">'+esc(r.kind||'')+'</span></td>'
        +'<td style="padding:3px 6px;border-bottom:1px solid var(--notion-border,#f2f2f0);max-width:150px;overflow:hidden;text-overflow:ellipsis;" title="'+esc(r.customer||'')+'">'+esc(r.customer||'')+'</td>'
        +'<td style="padding:3px 6px;border-bottom:1px solid var(--notion-border,#f2f2f0);text-align:right;font-variant-numeric:tabular-nums;color:'+kc+';font-weight:600;">'+esc(signQty(r))+'</td>'
        +'<td style="padding:3px 6px;border-bottom:1px solid var(--notion-border,#f2f2f0);text-align:right;font-variant-numeric:tabular-nums;color:var(--notion-text-light,#888);">'+esc(fmtN(r.price))+'</td>'
        +'<td style="padding:3px 6px;border-bottom:1px solid var(--notion-border,#f2f2f0);text-align:right;font-variant-numeric:tabular-nums;">'+esc(fmtN(r.amount))+'</td>'
        +'</tr>';
    }
    h+='</tbody></table>';
    body.innerHTML=h;
  }
  function dwOpen(code,name){
    if(_pt){clearInterval(_pt);_pt=null;}
    _drawer.style.transform='translateX(0)'; _back.style.opacity='1'; _back.style.pointerEvents='auto';
    document.getElementById('stkDwTitle').textContent=(code||'')+'　'+(name||'');
    var body=document.getElementById('stkDwBody');
    body.innerHTML='<div style="color:var(--notion-text-light,#888);">查詢近期進銷交易中…（經內網小幫手，約數秒）</div>';
    fetch('/admin/inventory/stock/txn-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code,icpno:(DATA.icpno||'00')})}).catch(function(){});
    var tries=0;
    function tick(){
      tries++;
      fetch('/admin/inventory/stock/txn?code='+encodeURIComponent(code)+'&icpno='+encodeURIComponent(DATA.icpno||'00')).then(function(r){return r.json();}).then(function(m){
        if(m.status==='ready'){ if(_pt){clearInterval(_pt);_pt=null;} dwRender(body,m); }
        else if(m.status==='error'){ if(_pt){clearInterval(_pt);_pt=null;} body.innerHTML='<div style="color:#c0392b;">查詢失敗：'+esc(m.error||'未知')+'</div>'; }
        else if(tries>=20){ if(_pt){clearInterval(_pt);_pt=null;} body.innerHTML='<div style="color:#b7791f;">等待逾時：內網小幫手（凌越整合代理）可能沒在跑。稍後再試。</div>'; }
      }).catch(function(){});
    }
    tick(); _pt=setInterval(tick,1500);
  }
  els.wrap.addEventListener('click',function(e){
    if(!TXN_ENABLED) return;   // 進銷查詢暫時關閉
    var tr=e.target.closest?e.target.closest('tr[data-code]'):null;
    if(!tr) return; var code=tr.getAttribute('data-code'); if(!code) return;
    dwOpen(code,tr.getAttribute('data-name')||'');
  });
  // ── 品項照片：上傳 / 放大檢視 / 刪除（第四波，借鏡 Sortly：照片比文字更好認貨）──────
  var _fileInput=document.createElement('input');
  _fileInput.type='file'; _fileInput.accept='image/*'; _fileInput.style.display='none';
  document.body.appendChild(_fileInput);
  var _upCode='';
  // 上傳期間避免重複提交：鎖住旗標＋把所有上傳/縮圖觸發元件 disable，回應（成功/失敗）後復原。
  var _uploading=false;
  function setUploadUiDisabled(on){
    try{
      var sel=document.querySelectorAll('[data-upload], .stk-thumb, .stk-ov-replace, .stk-ov-del');
      for(var i=0;i<sel.length;i++){
        var n=sel[i];
        if(n.tagName==='BUTTON'||n.tagName==='INPUT') n.disabled=on;
        n.style.pointerEvents=on?'none':'';
        n.style.opacity=on?'0.5':'';
      }
    }catch(_){}
  }
  function stkToast(msg,err){
    // 統一走 shell 級 window.sfToast（uiScript 定義，與訂單頁同一份實作、尺寸、動畫與時長）。
    // stkToast 只在使用者操作（上傳／刪除）時呼叫，屆時 uiScript 已載入 window.sfToast。
    if(window.sfToast){ window.sfToast(msg, err?'err':''); return; }
    // fallback（極端情況 window.sfToast 尚未就緒）：樣式參數已對齊 sfToast，視覺一致
    var w=document.getElementById('sfToastWrap');
    if(!w){ w=document.createElement('div'); w.id='sfToastWrap'; w.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10001;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;'; document.body.appendChild(w); }
    var el=document.createElement('div');
    el.style.cssText='pointer-events:auto;min-width:180px;max-width:88vw;text-align:center;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.18);'+(err?'background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;':'background:#065f46;color:#fff;border:1px solid #047857;');
    el.textContent=msg; w.appendChild(el);
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, err?5000:2400);
  }
  var _ov=document.createElement('div');
  _ov.className='stk-photo-ov';
  _ov.innerHTML='<div class="box"><img alt=""><div class="acts"><button type="button" class="stk-ov-replace">更換</button><button type="button" class="stk-ov-del">刪除</button><button type="button" class="stk-ov-close">關閉</button></div></div>';
  document.body.appendChild(_ov);
  var _ovCode='';
  function ovSrc(code){ var v=(PHOTOS[code]>1)?('?v='+PHOTOS[code]):''; return '/admin/inventory/item-photo/'+encodeURIComponent(code)+v; }
  function ovOpen(code){ _ovCode=code; _ov.querySelector('img').src=ovSrc(code); _ov.classList.add('on'); }
  function ovClose(){ _ov.classList.remove('on'); _ov.querySelector('img').src=''; _ovCode=''; }
  _ov.addEventListener('click',function(e){ if(e.target===_ov||e.target.classList.contains('stk-ov-close')) ovClose(); });
  _ov.querySelector('.stk-ov-replace').addEventListener('click',function(){ if(_uploading) return; if(_ovCode){ _upCode=_ovCode; _fileInput.click(); } });
  _ov.querySelector('.stk-ov-del').addEventListener('click',function(){
    if(!_ovCode) return; if(!confirm('確定刪除此品項照片？')) return;
    var code=_ovCode;
    fetch('/admin/inventory/item-photo/'+encodeURIComponent(code)+'/delete',{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'}}).then(function(r){return r.json();}).then(function(d){
      if(d&&d.ok){ delete PHOTOS[code]; ovClose(); render(); stkToast('已刪除照片'); } else { stkToast((d&&d.error)||'刪除失敗',true); }
    }).catch(function(){ stkToast('刪除失敗',true); });
  });
  _fileInput.addEventListener('change',function(){
    var f=_fileInput.files&&_fileInput.files[0]; var code=_upCode; _fileInput.value='';
    if(!f||!code) return;
    if(_uploading) return; // 上一張還在上傳中，忽略重複觸發
    if(f.size>8*1024*1024){ stkToast('圖片過大（上限 8MB）',true); return; }
    var fd=new FormData(); fd.append('image',f);
    _uploading=true; setUploadUiDisabled(true);
    stkToast('上傳中…');
    var done=function(){ _uploading=false; setUploadUiDisabled(false); };
    fetch('/admin/inventory/item-photo/'+encodeURIComponent(code)+'?icpno='+encodeURIComponent(DATA.icpno||'00'),{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'},body:fd}).then(function(r){return r.json();}).then(function(d){
      done();
      if(d&&d.ok){ PHOTOS[code]=Date.now(); render(); if(_ov.classList.contains('on')&&_ovCode===code) _ov.querySelector('img').src=ovSrc(code); stkToast('已更新照片'); } else { stkToast((d&&d.error)||'上傳失敗',true); }
    }).catch(function(){ done(); stkToast('上傳失敗',true); });
  });
  els.wrap.addEventListener('click',function(e){
    if(_uploading) return; // 上傳中不接受新的上傳/檢視觸發
    var up=e.target.closest?e.target.closest('[data-upload]'):null;
    if(up){ _upCode=up.getAttribute('data-upload'); _fileInput.click(); return; }
    var th=e.target.closest?e.target.closest('.stk-thumb'):null;
    if(th){ ovOpen(th.getAttribute('data-photo')); }
  });
  render();
})();
`;
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
        ${canUndo ? `<form method="post" action="/admin/api/rollover-undo" style="display:inline;" onsubmit="return confirm('確定要反悔上一次結轉？工作日期會退回前一日。');"><button type="submit" class="btn">反悔結轉</button></form> ` : ""}
        <button type="button" class="notion-rollover-btn" onclick="if(confirm('確定要結轉？結轉後工作日期將改為下一日。')) document.getElementById('rolloverForm').submit();">結轉</button>
        <form id="rolloverForm" method="post" action="/admin/api/rollover" style="display:none;"></form>
      </div>
    </div>`;
}
function notionPage(title, body, active = "", topBarOrRes = "", loggedInUserLegacy = "") {
    let topBar = "";
    let loggedInUser = "";
    let headerOpts = {};
    let sfTheme = "light";
    let adminUserName = "";
    let adminTitle = "";
    let sidebarOpts = { canCash: true };
    if (topBarOrRes && typeof topBarOrRes === "object" && topBarOrRes.locals) {
        const res = topBarOrRes;
        topBar = res.locals.topBarHtml || "";
        loggedInUser = res.locals.adminUser || "";
        sfTheme = res.locals.sfTheme === "dark" ? "dark" : "light";
        adminUserName = res.locals.adminUser || "";
        adminTitle = res.locals.adminTitle || "";
        sidebarOpts = { canCash: res.locals.canCash === true };
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
    // 使用新 SF 側邊欄，但容器仍維持既有 .notion-app / .notion-layout 以利不破壞既有 layout JS
    const shell = headerHtml
        ? `<div class="notion-app" id="notionAppRoot">${headerHtml}<div class="notion-layout">${sfSidebar(active, sidebarOpts)}<div class="notion-sidebar-overlay" id="sidebarOverlay"></div>${mainWrap}</div></div>`
        : `<div class="notion-layout">${sfSidebar(active, sidebarOpts)}${mainWrap}</div>`;
    const uiScript = `<script>(function(){
      // 全域 toast（shell 級共用實作）：固定畫面下方中央，捲到哪都看得到。
      // 訂單頁與庫存頁共用同一份實作與時長，避免兩套 toast 尺寸／動畫／時長不一致。
      // kind==='err' → 紅底、留 5s；否則綠底、留 2.4s。
      if (!window.sfToast) window.sfToast = function(text, kind){
        var wrap = document.getElementById('sfToastWrap');
        if (!wrap) {
          wrap = document.createElement('div');
          wrap.id = 'sfToastWrap';
          wrap.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10001;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
          document.body.appendChild(wrap);
        }
        var t = document.createElement('div');
        var isErr = kind === 'err';
        t.style.cssText = 'pointer-events:auto;min-width:180px;max-width:88vw;text-align:center;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.18);opacity:0;transform:translateY(8px);transition:opacity .18s,transform .18s;'
          + (isErr ? 'background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;' : 'background:#065f46;color:#fff;border:1px solid #047857;');
        t.textContent = text;
        wrap.appendChild(t);
        requestAnimationFrame(function(){ t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
        setTimeout(function(){ t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, 220); }, isErr ? 5000 : 2400);
      };
      var app = document.getElementById('notionAppRoot');
      var btn = document.getElementById('sidebarToggleBtn');
      var overlay = document.getElementById('sidebarOverlay');
      function closeSidebar(){ if(app) app.classList.remove('sidebar-open'); }
      function isWide(){ return window.matchMedia('(min-width: 1025px)').matches; }
      // 還原桌面收合狀態（避免只在窄螢幕才能收）
      try { if (app && isWide() && localStorage.getItem('songfu.sidebar_collapsed') === '1') app.classList.add('sidebar-collapsed'); } catch(_){}
      if(btn && app){
        btn.addEventListener('click', function(){
          if (isWide()) {
            app.classList.toggle('sidebar-collapsed');
            try { localStorage.setItem('songfu.sidebar_collapsed', app.classList.contains('sidebar-collapsed') ? '1' : '0'); } catch(_){}
          } else {
            app.classList.toggle('sidebar-open');
          }
        });
      }
      if(overlay){ overlay.addEventListener('click', closeSidebar); }
      document.addEventListener('click', function(e){
        var a = e.target.closest('.notion-sidebar a, .sf-nav a');
        if (a) closeSidebar();
      });
      // theme toggle (cookie 用 /admin/api/theme 寫入)
      window.sfToggleTheme = function(){
        var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        fetch('/admin/api/theme', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:'theme='+next, credentials:'same-origin' }).catch(function(){});
        var ic = document.getElementById('sfThemeIcon');
        if (ic) ic.innerHTML = next === 'dark' ? \`${SF_ICONS.sun.replace(/`/g, "\\`")}\` : \`${SF_ICONS.moon.replace(/`/g, "\\`")}\`;
      };
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
      // 全站搜尋
      (function(){
        var input = document.getElementById('sfGlobalSearchInput');
        var wrap = document.getElementById('sfGlobalSearchWrap');
        var dd = document.getElementById('sfGlobalSearchDropdown');
        if (!input || !dd) return;
        var timer = null;
        var activeIdx = -1;
        var currentItems = [];
        function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
        function close(){ dd.classList.remove('open'); activeIdx = -1; }
        function open(){ dd.classList.add('open'); }
        function renderEmpty(msg){ dd.innerHTML = '<div class="sf-search-empty">'+esc(msg)+'</div>'; open(); }
        function render(payload){
          var groups = [];
          currentItems = [];
          function addGroup(title, arr, makeItem){
            if (!arr || !arr.length) return;
            var rows = arr.map(function(x){
              var item = makeItem(x);
              currentItems.push(item);
              return '<a class="sf-search-item" href="'+esc(item.href)+'" data-href="'+esc(item.href)+'">'
                + '<span class="sf-search-item-icon">'+(item.icon||'')+'</span>'
                + '<span class="sf-search-item-main"><span class="sf-search-item-title">'+esc(item.title)+'</span>'
                + (item.sub?'<span class="sf-search-item-sub">'+esc(item.sub)+'</span>':'')
                + '</span></a>';
            }).join('');
            groups.push('<div class="sf-search-group"><div class="sf-search-group-title">'+esc(title)+'</div>'+rows+'</div>');
          }
          addGroup('訂單', payload.orders, function(o){
            return { href: '/admin/orders/'+encodeURIComponent(o.id), title: (o.order_no||o.id) + ' · ' + (o.customer_name||'—'), sub: o.order_date + (o.status?' · '+o.status:''), icon: \`${SF_ICONS.list.replace(/`/g, "\\`")}\` };
          });
          addGroup('客戶', payload.customers, function(c){
            return { href: '/admin/customers/'+encodeURIComponent(c.id)+'/quick-view', title: c.name, sub: c.line_group_id ? ('LINE 已綁定 · '+c.line_group_id.slice(0,8)+'…') : 'LINE 未綁定', icon: \`${SF_ICONS.users.replace(/`/g, "\\`")}\` };
          });
          addGroup('品項', payload.products, function(p){
            return { href: '/admin/products/'+encodeURIComponent(p.id)+'/edit', title: p.name, sub: (p.erp_code||'') + (p.teraoka_barcode?' · '+p.teraoka_barcode:''), icon: \`${SF_ICONS.box.replace(/`/g, "\\`")}\` };
          });
          addGroup('頁面', payload.pages, function(p){
            return { href: p.href, title: p.title, sub: p.href, icon: \`${SF_ICONS.spark.replace(/`/g, "\\`")}\` };
          });
          if (!groups.length) { renderEmpty('找不到符合的結果'); return; }
          dd.innerHTML = groups.join('');
          activeIdx = -1;
          open();
        }
        function doSearch(q){
          if (!q || q.trim().length < 1) { close(); return; }
          fetch('/admin/api/search?q='+encodeURIComponent(q.trim()), { credentials: 'same-origin' })
            .then(function(r){ return r.json(); })
            .then(render)
            .catch(function(){ renderEmpty('搜尋失敗，請稍後再試'); });
        }
        input.addEventListener('input', function(){
          clearTimeout(timer);
          var q = this.value;
          timer = setTimeout(function(){ doSearch(q); }, 180);
        });
        input.addEventListener('focus', function(){ if (this.value.trim()) doSearch(this.value); });
        input.addEventListener('keydown', function(e){
          var items = dd.querySelectorAll('.sf-search-item');
          if (e.key === 'Escape') { close(); this.blur(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(items.length-1, activeIdx+1); items.forEach(function(el,i){ el.classList.toggle('active', i===activeIdx); }); items[activeIdx]?.scrollIntoView({block:'nearest'}); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(0, activeIdx-1); items.forEach(function(el,i){ el.classList.toggle('active', i===activeIdx); }); items[activeIdx]?.scrollIntoView({block:'nearest'}); }
          else if (e.key === 'Enter') {
            if (activeIdx >= 0 && items[activeIdx]) { e.preventDefault(); location.href = items[activeIdx].getAttribute('data-href'); }
            else if (items.length) { e.preventDefault(); location.href = items[0].getAttribute('data-href'); }
          }
        });
        document.addEventListener('click', function(e){
          if (wrap && !wrap.contains(e.target)) close();
        });
        // 全域 ⌘K / Ctrl+K
        document.addEventListener('keydown', function(e){
          if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            input.focus();
            input.select();
          }
        });
      })();
    })();</script>`;
    const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet">`;
    return `<!DOCTYPE html><html lang="zh-TW" data-theme="${sfTheme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${SF_APP_HEAD_META}<title>${escapeHtml(title)} － 松富物流數位管理系統</title>${fonts}<style>${NOTION_STYLE}${SF_TOKENS}</style></head><body>${shell}${uiScript}</body></html>`;
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
    const sfTheme = (res && res.locals && res.locals.sfTheme === "dark") ? "dark" : "light";
    const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet">`;
    return `<!DOCTYPE html><html lang="zh-TW" data-theme="${sfTheme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${SF_APP_HEAD_META}<title>${escapeHtml(title)} － 松富物流數位管理系統</title>${fonts}<style>${NOTION_STYLE}${SF_TOKENS}</style></head><body>${shell}</body></html>`;
}
/** 編輯距離（品名短字串模糊比對） */
function levenshteinDistance(a, b) {
    if (!a?.length)
        return b?.length ?? 0;
    if (!b?.length)
        return a.length;
    const m = a.length, n = b.length;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++)
        dp[j] = j;
    for (let i = 1; i <= m; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= n; j++) {
            const tmp = dp[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
            prev = tmp;
        }
    }
    return dp[n];
}
/** 查詢字元是否依序出現在字串中（簡易模糊） */
function isSubsequenceInOrder(haystack, needle) {
    if (!needle)
        return true;
    let i = 0;
    for (let k = 0; k < haystack.length && i < needle.length; k++) {
        if (haystack[k] === needle[i])
            i++;
    }
    return i === needle.length;
}
/** 品項模糊相關分數（愈高愈相關） */
function fuzzyProductScore(p, qNorm) {
    const name = (p.name || "").toLowerCase();
    const erp = (p.erp_code || "").toLowerCase();
    const teraoka = (p.teraoka_barcode || "").toLowerCase();
    const merged = `${name} ${erp} ${teraoka}`;
    if (!qNorm)
        return 0;
    if (name.includes(qNorm))
        return 10000;
    if (erp.includes(qNorm) || teraoka.includes(qNorm))
        return 9000;
    if (merged.includes(qNorm))
        return 7500;
    let score = 0;
    if (isSubsequenceInOrder(name, qNorm))
        score += 4200;
    const slice = name.slice(0, Math.min(name.length, 72));
    const d = levenshteinDistance(qNorm, slice);
    const maxL = Math.max(qNorm.length, slice.length, 1);
    score += Math.max(0, 3500 - (d / maxL) * 3000);
    let hit = 0;
    for (const ch of qNorm) {
        if (merged.includes(ch))
            hit++;
    }
    score += (hit / Math.max(qNorm.length, 1)) * 600;
    return score;
}
function createAdminRouter() {
    const router = express_1.default.Router();
    // [fix 2026-07-08] 全域包裹 async handler：Express 4 不會自動接住 async handler / async 中介層
    // 丟出的 rejection，未兜底時 Node 20 預設會直接終止整個程序（Cloud Run 重啟、所有進行中請求一起死），
    // 或請求永遠 hang。這裡攔截 router 的動詞方法與 use，把每個 handler 用 Promise.resolve().catch(next) 包起來，
    // 讓錯誤轉交 dist/index.js:225 的全域錯誤中介層（回 500 頁）而不是 crash / hang。
    // length >= 4 的錯誤中介層 (err,req,res,next) 不包；同步 middleware 不回傳 promise，包了也透明無副作用。
    for (const _m of ["get", "post", "put", "delete", "patch", "all", "use"]) {
        const _orig = router[_m].bind(router);
        router[_m] = function (...args) {
            const wrapped = args.map((h) => (typeof h === "function" && h.length < 4)
                ? function (req, res, next) {
                    try {
                        const r = h(req, res, next);
                        if (r && typeof r.then === "function")
                            r.catch(next);
                        return r;
                    }
                    catch (e) {
                        next(e);
                    }
                }
                : h);
            return _orig(...wrapped);
        };
    }
    const db = (0, index_js_1.getDb)(dbPath);
    // [UX 2026-07-19 C] 記住上次選的公司、跨庫存頁沿用：解決「松揚員工每進一頁先切一次公司、
    // 且各頁預設不一致（stock/settings 預設 00、adjustments/barcodes/expiry 預設 02）」。
    // 帶 ?icpno＝明確選公司→用它並寫 cookie 記住；沒帶→沿用上次 cookie；再沒有才用該頁預設。
    // 只作用於庫存頁；收款頁用另一種寫法不受影響（收款不與庫存共用公司記憶）。
    function stickyIcpno(req, res, fallback) {
        const fb = fallback == null ? "00" : fallback;
        const q = req && req.query ? req.query.icpno : undefined;
        if (q != null && String(q).trim() !== "") {
            const ic = erp_companies_js_1.normIcpno(q, fb);
            try { res.cookie("sf_icpno", ic, { path: "/admin", sameSite: "Lax", maxAge: 180 * 86400000 }); }
            catch (_) { /* 設 cookie 失敗不阻斷頁面 */ }
            return ic;
        }
        try {
            const ck = parseAdminCookies(req.headers.cookie || "").sf_icpno;
            if (ck && /^\d{2}$/.test(String(ck).trim())) return String(ck).trim();
        }
        catch (_) { /* 無 cookie／解析失敗→用該頁預設 */ }
        return fb;
    }
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
    // [fix 2026-07-18 稽核] 群組功能開關（辨識訂單/盤點/空籃）異動須留軌跡：開錯會漏單/漏盤。
    // 讀當前有效設定當 before，寫入後只在「真有變動」時記錄舊值→新值＋操作者。
    async function setGroupFeaturesAudited(req, groupId, feats, source) {
        const gid = String(groupId || "").replace(/\s/g, "").trim();
        if (!gid) return;
        let before = null;
        try { before = await group_features_js_1.getGroupFeatures(db, gid); }
        catch (_) { /* 讀失敗→before 視為未知，仍照常寫入並記錄 */ }
        await group_features_js_1.setGroupFeatures(db, gid, feats);
        const after = { order: !!feats.order, stocktake: !!feats.stocktake, basket: !!feats.basket };
        const changed = !before || before.order !== after.order || before.stocktake !== after.stocktake || before.basket !== after.basket;
        if (!changed) return;
        const fmt = (f) => `辨識訂單${f.order ? "開" : "關"}/盤點${f.stocktake ? "開" : "關"}/空籃${f.basket ? "開" : "關"}`;
        await logDataChange(req, {
            entityType: "group_features",
            entityId: gid,
            action: "set",
            summary: `群組功能（${source}）${gid}：${before ? fmt(before) : "（預設）"} → ${fmt(after)}`,
            meta: { source, before, after },
        });
    }
    /**
     * 在備註欄補上「原 X 單位」前綴；如備註已有相同前綴則不重複加。
     */
    function buildOrigUnitRemark(originalQty, originalUnit, existingRemark) {
        const tag = `原 ${originalQty} ${originalUnit}`;
        const existing = String(existingRemark || "").trim();
        if (!existing) return tag;
        // 若已存在「原 N 單位」前綴，剝除避免重複
        const stripped = existing.replace(/^原\s+[\d.]+\s+\S+\s*(?:／|\/)?\s*/, "").trim();
        if (!stripped) return tag;
        return tag + "／" + stripped;
    }
    /**
     * 公斤計價品項：自動把客戶寫的非公斤單位（把/小把/罐…）換算成公斤儲存。
     * 規則：products.unit === '公斤' 才會作用（按件計價的品項不受影響）；
     *      只動有 unit_specs.conversion_kg 對應、quantity 是有效正數、未作廢的訂單品項。
     *      備註欄自動補「原 X 單位」前綴（保留客戶原始叫貨方式）。
     * @param {*} req 用於 logDataChange 抓 actor
     * @param {string} productId
     * @param {string} [restrictUnit] 若提供：只處理 unit = 此值的品項（給「剛新增單位規則時」用）
     * @returns {Promise<{converted:number, byUnit:Object, skipped?:string, masterUnit?:string}>}
     */
    async function autoConvertOrderItemsToKg(req, productId, restrictUnit) {
        const product = await db.prepare("SELECT id, name, unit FROM products WHERE id = ?").get(productId);
        if (!product) return { converted: 0, byUnit: {}, skipped: "no_product" };
        const masterUnit = String(product.unit || "").trim();
        if (masterUnit !== "公斤") return { converted: 0, byUnit: {}, skipped: "not_kg_billed", masterUnit };
        const specs = await db.prepare(
            "SELECT unit, conversion_kg FROM product_unit_specs WHERE product_id = ? AND conversion_kg IS NOT NULL AND conversion_kg > 0"
        ).all(productId);
        const kgPerUnit = {};
        for (const s of specs || []) {
            kgPerUnit[String(s.unit || "").trim()] = Number(s.conversion_kg);
        }
        if (Object.keys(kgPerUnit).length === 0) return { converted: 0, byUnit: {}, skipped: "no_specs" };
        let sql = "SELECT id, order_id, quantity, unit, raw_name, remark FROM order_items WHERE product_id = ? AND voided_at IS NULL AND TRIM(COALESCE(unit, '')) NOT IN ('公斤', '')";
        const params = [productId];
        const r = String(restrictUnit || "").trim();
        if (r) {
            sql += " AND TRIM(COALESCE(unit, '')) = ?";
            params.push(r);
        }
        const items = await db.prepare(sql).all(...params);
        let converted = 0;
        const byUnit = {};
        for (const it of items || []) {
            const u = String(it.unit || "").trim();
            const kg = kgPerUnit[u];
            if (!kg) continue;
            const q = Number(it.quantity);
            if (!Number.isFinite(q) || q <= 0) continue;
            const newQty = Math.round(q * kg * 10000) / 10000; // 4 位小數精度
            // 備註欄補上原叫貨方式（保留客戶原始描述供司機/匯出參考）
            const origForRemark = (Number.isInteger(q) ? String(q) : String(q));
            const newRemark = buildOrigUnitRemark(origForRemark, u, it.remark);
            await db.prepare("UPDATE order_items SET quantity = ?, unit = '公斤', remark = ? WHERE id = ?").run(newQty, newRemark, it.id);
            converted++;
            byUnit[u] = (byUnit[u] || 0) + 1;
            try {
                await logDataChange(req, {
                    entityType: "order_item",
                    entityId: it.id,
                    productId,
                    action: "auto_convert_to_kg",
                    summary: `${product.name}：${q} ${u} → ${newQty} 公斤（自動換算，1 ${u} = ${kg} 公斤；備註已補「原 ${q} ${u}」）`,
                    meta: { order_id: it.order_id, before: { quantity: q, unit: u, remark: it.remark }, after: { quantity: newQty, unit: "公斤", remark: newRemark }, conversion_kg: kg, source: "auto_convert" },
                });
            } catch (_) { /* ignore log err */ }
        }
        return { converted, byUnit };
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
        res.type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${SF_APP_HEAD_META}<title>登入 － 松富物流數位管理系統</title><style>:root{color-scheme:light;}*{box-sizing:border-box;}body{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;background:#f7f6f3;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:clamp(12px,4vw,24px);} .box{max-width:420px;width:100%;background:#fff;border:1px solid #e3e2e0;border-radius:12px;padding:clamp(16px,4vw,28px);box-shadow:0 4px 16px rgba(15,23,42,.06);} .box h1{font-size:clamp(20px,5vw,24px);line-height:1.3;margin:0 0 14px;color:#37352f;}form{display:flex;flex-direction:column;gap:12px;}label{display:block;font-size:14px;color:#37352f;}input{width:100%;padding:12px;border:1px solid #d7d6d4;border-radius:8px;font-size:16px;margin-top:6px;line-height:1.25;}input:focus{outline:2px solid rgba(35,131,226,.28);border-color:#2383e2;}button{margin-top:6px;width:100%;padding:12px;background:#2383e2;color:#fff;border:none;border-radius:8px;font-size:16px;line-height:1.2;cursor:pointer;font-weight:700;min-height:44px;}button:active{transform:translateY(1px);} .err,.ok,.warn{padding:10px 12px;border-radius:8px;font-size:14px;margin:0 0 10px;} .err{background:#ffebee;color:#c62828;} .ok{background:#e7f5e9;color:#2e7d32;} .warn{background:#fff8e1;color:#856404;}@media (max-width:480px){body{align-items:flex-start;padding:12px;} .box{margin-top:12px;border-radius:10px;} .box h1{margin-bottom:12px;}}</style></head><body><div class="box"><h1>松富物流數位管理系統</h1>${err ? "<div class=\"err\">帳號或密碼錯誤。</div>" : ""}${disabled ? "<div class=\"err\">此帳號已停用，請聯絡管理員。</div>" : ""}${pendingMsg ? "<div class=\"warn\">若帳號尚待審核，請待負責人核准後再登入。</div>" : ""}${ok ? "<div class=\"ok\">已建立管理員，請登入。</div>" : ""}<form method="post" action="/admin/login"><input type="hidden" name="next" value="${escapeAttr(nextParam)}"><label>帳號 <input type="text" name="username" required autocomplete="username"></label><label>密碼 <input type="password" name="password" required autocomplete="current-password"></label><button type="submit">登入</button></form></div></body></html>`);
    });
    router.get("/setup", async (_req, res) => {
        const users = await loadAdminUsers();
        if (users.length > 0) {
            res.redirect(302, "/admin/login");
            return;
        }
        const err = _req.query.err;
        const errHtml = err === "weak" ? "<div class=\"err\">帳號至少 2 字元、密碼至少 4 字元。</div>" : "";
        res.type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${SF_APP_HEAD_META}<title>首次設定管理員 － 松富物流數位管理系統</title><style>:root{color-scheme:light;}*{box-sizing:border-box;}body{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;background:#f7f6f3;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:clamp(12px,4vw,24px);} .box{max-width:420px;width:100%;background:#fff;border:1px solid #e3e2e0;border-radius:12px;padding:clamp(16px,4vw,28px);box-shadow:0 4px 16px rgba(15,23,42,.06);} .box h1{font-size:clamp(20px,5vw,24px);line-height:1.3;margin:0 0 8px;color:#37352f;}p{color:#787774;font-size:14px;margin:0 0 16px;line-height:1.5;}form{display:flex;flex-direction:column;gap:12px;}label{display:block;font-size:14px;color:#37352f;}input{width:100%;padding:12px;border:1px solid #d7d6d4;border-radius:8px;font-size:16px;margin-top:6px;line-height:1.25;}input:focus{outline:2px solid rgba(35,131,226,.28);border-color:#2383e2;}button{margin-top:6px;width:100%;padding:12px;background:#2383e2;color:#fff;border:none;border-radius:8px;font-size:16px;line-height:1.2;cursor:pointer;font-weight:700;min-height:44px;}button:active{transform:translateY(1px);} .err{background:#ffebee;color:#c62828;padding:10px 12px;border-radius:8px;font-size:14px;margin:0 0 10px;}@media (max-width:480px){body{align-items:flex-start;padding:12px;} .box{margin-top:12px;border-radius:10px;} .box h1{margin-bottom:10px;}}</style></head><body><div class="box"><h1>首次設定管理員</h1><p>尚無後台帳號，請建立第一組帳號密碼。</p>${errHtml}<form method="post" action="/admin/setup"><label>帳號 <input type="text" name="username" required minlength="2" autocomplete="username"></label><label>密碼 <input type="password" name="password" required minlength="4" autocomplete="new-password"></label><button type="submit">建立並前往登入</button></form></div></body></html>`);
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
    // [fix 2026-07-14] 登入節流：同帳號（或同 IP）10 分鐘內失敗 10 次 → 暫停 10 分鐘。
    // in-memory 即可（單實例為主；多實例下每實例各自計數，仍有上限效果）。pbkdf2 100k 次已減速，
    // 這層擋的是無腦線上爆破。成功登入即清零。
    const loginFails = new Map(); // key → { n, until }
    const LOGIN_FAIL_MAX = 10, LOGIN_FAIL_WINDOW_MS = 10 * 60 * 1000;
    function loginThrottleKey(req, username) {
        const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
        return username + "|" + ip;
    }
    router.post("/login", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const users = await loadAdminUsers();
        const username = (req.body.username || "").trim();
        const password = (req.body.password || "").toString();
        const tkey = loginThrottleKey(req, username);
        const rec = loginFails.get(tkey);
        if (rec && rec.n >= LOGIN_FAIL_MAX && Date.now() < rec.until) {
            res.redirect("/admin/login?err=throttled");
            return;
        }
        const u = users.find((x) => x.username === username);
        if (!u || !verifyAdminPassword(password, u.passwordHash)) {
            const cur = loginFails.get(tkey) || { n: 0, until: 0 };
            cur.n += 1;
            cur.until = Date.now() + LOGIN_FAIL_WINDOW_MS;
            loginFails.set(tkey, cur);
            if (loginFails.size > 1000) loginFails.clear(); // 簡單上限防記憶體累積
            res.redirect("/admin/login?err=1");
            return;
        }
        loginFails.delete(tkey);
        if (u.status === "disabled") {
            res.redirect("/admin/login?disabled=1");
            return;
        }
        const token = signAdminSession(username);
        // [fix 2026-07-14] 正式環境（Cloud Run 全 HTTPS）補 Secure 旗標；本機 http 開發不加
        const secureFlag = process.env.DATABASE_URL ? "; Secure" : "";
        res.setHeader("Set-Cookie", `sf_admin_session=${encodeURIComponent(token)}; Path=/admin; HttpOnly; Max-Age=${7 * 24 * 3600}; SameSite=Lax${secureFlag}`);
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
        // 凌越回寫：機器對機器端點（內網 agent 拉資料／回寫單據號），用 API 金鑰而非 cookie session
        if (pathname.startsWith("/lingyue-writeback/")) {
            const expected = String(process.env.LINGYUE_WRITEBACK_KEY || "").trim();
            const provided = String(req.headers["x-writeback-key"] || "").trim();
            if (!expected) {
                res.status(503).json({ error: "LINGYUE_WRITEBACK_KEY 未設定（請於 Cloud Run 環境變數設定後再用）" });
                return;
            }
            // [fix 2026-07-10] 金鑰比對改 timingSafeEqual：避免逐字元比較的時間側信道（長度不同先擋，
            // timingSafeEqual 要求兩邊等長，長度本身不視為秘密）。
            const providedBuf = Buffer.from(provided, "utf8");
            const expectedBuf = Buffer.from(expected, "utf8");
            if (!provided || providedBuf.length !== expectedBuf.length
                || !crypto_1.timingSafeEqual(providedBuf, expectedBuf)) {
                res.status(401).json({ error: "unauthorized" });
                return;
            }
            req.adminUsername = "lingyue-writeback-agent";
            return next();
        }
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
        res.locals.canCash = profile.title === "經理" || profile.canCash === true; // 收款作業權限（經理天生有）
        res.locals.isOwner = isAdminOwnerUsername(uname);
        // SF 主題：從 cookie sf_theme=dark|light 讀取（預設淺色）
        res.locals.sfTheme = (cookies.sf_theme === "dark") ? "dark" : "light";
        next();
    });
    router.post("/api/theme", express_1.default.urlencoded({ extended: true }), (req, res) => {
        const t = req.body?.theme === "dark" ? "dark" : "light";
        res.setHeader("Set-Cookie", `sf_theme=${t}; Path=/admin; Max-Age=${60*60*24*365}; SameSite=Lax`);
        res.json({ ok: true, theme: t });
    });
    // 全站搜尋：訂單號／客戶／品項／頁面
    const SF_PAGES_INDEX = [
        { title: "儀表板", href: "/admin", keywords: ["dashboard", "首頁", "戰情"] },
        { title: "訂單審核", href: "/admin/orders", keywords: ["orders", "訂單", "查詢"] },
        { title: "待確認品名", href: "/admin/review", keywords: ["review", "待對應"] },
        { title: "客戶管理", href: "/admin/customers", keywords: ["customers", "客戶"] },
        { title: "群組功能", href: "/admin/customers/groups", keywords: ["groups", "群組", "白名單", "辨識訂單", "盤點群組", "空籃"] },
        { title: "貨品管理", href: "/admin/products", keywords: ["products", "品項", "俗名"] },
        { title: "AI 學習庫", href: "/admin/ai-examples", keywords: ["ai", "few-shot", "範例"] },
        { title: "稽核軌跡", href: "/admin/audit", keywords: ["audit", "稽核", "log"] },
        { title: "辨識成效", href: "/admin/recognition-stats", keywords: ["stats", "gemini", "辨識"] },
        { title: "群發訊息", href: "/admin/broadcast", keywords: ["broadcast", "公告", "優惠"] },
        { title: "LINE 機器人", href: "/admin/line-bot", keywords: ["line", "bot", "排程"] },
        { title: "人員管理", href: "/admin/users", keywords: ["users", "帳號", "員工"] },
        { title: "冷凍／冷藏庫", href: "/admin/freezer-fridge", keywords: ["freezer", "fridge", "冰箱"] },
        { title: "目前庫存", href: "/admin/inventory/stock", keywords: ["stock", "庫存", "凌越", "現有量", "nowqty"] },
        { title: "盤點", href: "/admin/inventory", keywords: ["inventory", "盤點", "每日盤點", "盤差", "盤點結果"] },
        { title: "庫存統計圖表", href: "/admin/inventory/stats", keywords: ["stats", "統計", "圖表", "K線", "盤差", "熱力圖", "趨勢"] },
        { title: "網站盤點", href: "/admin/inventory/entry", keywords: ["盤點", "網站盤點", "輸入", "複盤", "web"] },
        { title: "掃碼盤點", href: "/admin/scan", keywords: ["scan", "掃碼", "條碼", "盤點", "pda"] },
        { title: "庫存調整", href: "/admin/inventory/adjustments", keywords: ["adjust", "調整", "誤差", "補償", "調整單"] },
        { title: "盤點設定", href: "/admin/inventory/warehouse-settings", keywords: ["settings", "盤點設定", "倉庫設定", "條碼對照", "效期品", "設定"] },
        { title: "效期品設定", href: "/admin/inventory/expiry-items", keywords: ["效期", "效期品", "批號", "expiry"] },
        { title: "條碼對照", href: "/admin/inventory/barcodes", keywords: ["barcode", "條碼", "對照", "綁定"] },
        { title: "物流叫貨", href: "/admin/logistics/procurement", keywords: ["procurement", "採購"] },
        { title: "北農行情", href: "/admin/logistics/market", keywords: ["market", "北農", "價格"] },
        { title: "畜產雞蛋行情", href: "/admin/logistics/livestock", keywords: ["livestock", "毛豬", "豬價", "雞", "白肉雞", "雞蛋", "蛋價", "畜產", "行情", "價格"] },
        { title: "資料匯出", href: "/admin/export", keywords: ["export", "csv", "匯出"] },
        { title: "LINE 綁定檢查", href: "/admin/line-binding", keywords: ["binding", "綁定"] },
        { title: "Gemini Prompt", href: "/admin/gemini-prompts", keywords: ["prompt", "gemini", "ab"] },
        { title: "報價管理", href: "/admin/quotes", keywords: ["quotes", "報價", "報價單"] },
        { title: "客訴處理", href: "/admin/complaints", keywords: ["complaints", "客訴", "退貨"] },
        { title: "空籃記帳", href: "/admin/baskets", keywords: ["baskets", "空籃", "空藍", "籃子"] },
        { title: "忘記叫貨提醒", href: "/admin/reminders", keywords: ["reminders", "提醒", "未叫貨", "漏單"] },
        { title: "營運分析", href: "/admin/analytics", keywords: ["analytics", "營運", "分析", "報表"] },
        { title: "群組功能", href: "/admin/inventory/stocktake-groups", keywords: ["group", "群組", "白名單", "盤點群組", "辨識訂單", "空籃"] },
        { title: "倉庫設定", href: "/admin/inventory/warehouse-settings", keywords: ["warehouse", "倉庫", "倉別", "盤點倉"] },
        { title: "公告管理", href: "/admin/announcements", keywords: ["announcements", "公告", "flex", "海報", "模板"] },
        { title: "行事曆", href: "/admin/calendar", keywords: ["calendar", "行事曆", "假日", "公休", "加班", "國定假日"] },
        { title: "客戶×品項週期分析", href: "/admin/rhythm", keywords: ["rhythm", "週期", "預期清單", "節奏"] },
        { title: "資料備份", href: "/admin/backup", keywords: ["backup", "備份", "下載資料庫"] },
        { title: "訂單圖 Golden Set 評測", href: "/admin/order-eval", keywords: ["eval", "golden", "評測", "harness", "訂單圖"] },
        { title: "叫貨單位換算（LINE）", href: "/admin/line-bot/unit-conversion", keywords: ["unit", "單位", "換算", "conversion"] },
        { title: "大宗原物料行情", href: "/admin/logistics/commodities", keywords: ["commodities", "原物料", "黃豆", "玉米", "小麥", "行情"] },
        { title: "訓練儀表板", href: "/admin/training", keywords: ["training", "ttqs", "pddro", "教育訓練", "訓練"] },
        { title: "年度計畫（教育訓練）", href: "/admin/training/plans", keywords: ["training", "年度計畫", "教育訓練計畫", "訓練計畫", "ttqs"] },
        { title: "課程紀錄（教育訓練）", href: "/admin/training/courses", keywords: ["training", "課程", "紀錄表", "簽到", "滿意度", "成效", "教育訓練"] },
        { title: "員工名冊（教育訓練）", href: "/admin/training/employees", keywords: ["training", "員工", "名冊", "參加人員", "教育訓練"] },
        { title: "TTQS 系統文件", href: "/admin/training/system", keywords: ["ttqs", "pddro", "使命", "願景", "目標", "查核", "教育訓練"] },
    ];
    router.get("/api/search", async (req, res) => {
        const q = String(req.query.q || "").trim();
        if (!q) { res.json({ orders: [], customers: [], products: [], pages: [] }); return; }
        const like = "%" + q + "%";
        const out = { orders: [], customers: [], products: [], pages: [] };
        // 訂單：order_no 精準/前綴/模糊
        try {
            out.orders = await db.prepare(
                "SELECT o.id, o.order_no, o.order_date, o.status, c.name AS customer_name " +
                "FROM orders o LEFT JOIN customers c ON c.id = o.customer_id " +
                "WHERE (o.order_no LIKE ? OR o.id LIKE ?) AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') " +
                "ORDER BY o.order_date DESC, o.id DESC LIMIT 8"
            ).all(like, like);
        } catch (_) {}
        // 客戶
        try {
            out.customers = await db.prepare(
                "SELECT id, name, line_group_id FROM customers WHERE name LIKE ? OR teraoka_code LIKE ? OR hq_cust_code LIKE ? ORDER BY name LIMIT 8"
            ).all(like, like, like);
        } catch (_) {}
        // 品項
        try {
            out.products = await db.prepare(
                "SELECT id, name, erp_code, teraoka_barcode FROM products WHERE name LIKE ? OR erp_code LIKE ? OR teraoka_barcode LIKE ? ORDER BY name LIMIT 8"
            ).all(like, like, like);
        } catch (_) {}
        // 頁面（記憶體 fuzzy）
        const qLower = q.toLowerCase();
        out.pages = SF_PAGES_INDEX.filter(p => {
            if (p.title.includes(q) || p.title.toLowerCase().includes(qLower)) return true;
            if (p.href.toLowerCase().includes(qLower)) return true;
            if ((p.keywords || []).some(k => k.toLowerCase().includes(qLower) || k.includes(q))) return true;
            return false;
        }).slice(0, 6);
        res.json(out);
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
        const userDataAttrs = (u) => `data-username="${escapeAttr(u.username)}" data-name="${escapeAttr(u.name || "")}" data-title="${escapeAttr(u.title || "")}" data-owner="${isAdminOwnerUsername(u.username) ? "1" : "0"}"`;
        const activeRows = activeList.map((u) => {
            const ownerMark = isAdminOwnerUsername(u.username) ? ` <span class="sf-pill accent" style="font-size:10px;">負責人</span>` : "";
            const ops = [];
            ops.push(`<button type="button" class="sf-btn sm" onclick='openUserEdit(${JSON.stringify({u:u.username,n:u.name||"",t:u.title||"",owner:isAdminOwnerUsername(u.username),c:!!u.canCash})})'>${SF_ICONS.edit}<span>編輯</span></button>`);
            if (!isAdminOwnerUsername(u.username)) {
                ops.push(`<form method="post" action="/admin/users/set-status" style="display:inline;margin:0;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><input type="hidden" name="status" value="disabled"><button type="submit" class="sf-btn sm" onclick="return confirm('確定停用此帳號？');">停用</button></form>`);
            }
            if (!isAdminOwnerUsername(u.username) && users.length > 1) {
                ops.push(`<form method="post" action="/admin/users/delete" style="display:inline;margin:0;" onsubmit="return confirm('確定刪除？此動作無法復原。');"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm danger">${SF_ICONS.x}</button></form>`);
            }
            return `<tr ${userDataAttrs(u)}>
              <td><strong>${escapeHtml(u.name || u.username)}</strong>${ownerMark}</td>
              <td><code class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml(u.username)}</code></td>
              <td><span class="sf-pill">${escapeHtml(u.title)}</span></td>
              <td><span class="sf-pill ok">啟用</span></td>
              <td style="white-space:nowrap;">${ops.join(" ")}</td>
            </tr>`;
        }).join("");
        const disabledRows = disabledList.map((u) => {
            const enForm = `<form method="post" action="/admin/users/set-status" style="display:inline;margin:0;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><input type="hidden" name="status" value="active"><button type="submit" class="sf-btn sm">重新啟用</button></form>`;
            const delForm = `<form method="post" action="/admin/users/delete" style="display:inline;margin:0;" onsubmit="return confirm('確定刪除此帳號？');"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm danger">${SF_ICONS.x}</button></form>`;
            return `<tr>
              <td><strong>${escapeHtml(u.name || u.username)}</strong></td>
              <td><code class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml(u.username)}</code></td>
              <td><span class="sf-pill">${escapeHtml(u.title)}</span></td>
              <td><span class="sf-pill">停用</span></td>
              <td style="white-space:nowrap;">${enForm} ${!isAdminOwnerUsername(u.username) ? delForm : ""}</td>
            </tr>`;
        }).join("");
        // 全站可用職稱
        const titleOptsAll = ADMIN_TITLES.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join("");
        const bindOkCode = typeof req.query.bind_code === "string" ? req.query.bind_code.trim() : "";
        const bindOkUser = typeof req.query.bind_user === "string" ? req.query.bind_user.trim() : "";
        const bindOkLink = typeof req.query.bind_link === "string" ? req.query.bind_link.trim() : "";
        const bindMsg = bindOkLink && bindOkUser
            ? `<div class="sf-card" style="border-left:3px solid var(--accent);margin-bottom:16px;padding:14px 18px;">
                <div style="font-size:13px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">LIFF 員工綁定連結</div>
                <div style="font-size:14px;margin-bottom:10px;">已為 <strong>${escapeHtml(bindOkUser)}</strong> 產生綁定連結（30 分鐘內有效）：</div>
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                  <input id="liff-bind-url" type="text" readonly value="${escapeAttr(bindOkLink)}" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-family:ui-monospace,monospace;font-size:12px;">
                  <button type="button" class="sf-btn sm" onclick="navigator.clipboard.writeText(document.getElementById('liff-bind-url').value).then(()=>{this.textContent='已複製';setTimeout(()=>this.textContent='複製',1500);})">複製</button>
                </div>
                <div style="font-size:12px;color:var(--txt-2);line-height:1.6;">請將此連結 LINE 給該員工。員工在 LINE 中點開連結 → 確認身份 → 按「綁定」即完成。一次性使用。</div>
              </div>`
            : (bindOkCode && bindOkUser
            ? `<div class="sf-card" style="border-left:3px solid var(--accent);margin-bottom:16px;padding:14px 18px;">
                <div style="font-size:13px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">員工 LINE 綁定碼</div>
                <div style="font-size:14px;margin-bottom:10px;">已為 <strong>${escapeHtml(bindOkUser)}</strong> 產生綁定碼（10 分鐘內有效）：</div>
                <div class="mono" style="font-size:32px;font-weight:700;letter-spacing:6px;color:var(--accent);margin-bottom:10px;">${escapeHtml(bindOkCode)}</div>
                <div style="font-size:12px;color:var(--txt-2);line-height:1.6;">請該員工在 LINE 私訊本 Bot 傳送：<br><code style="background:var(--bg-3);padding:2px 8px;border-radius:3px;">綁定 ${escapeHtml(bindOkCode)}</code><br>送出後其 LINE userId 會自動綁到此帳號，之後該員工在客戶群內傳訊息將跳過 AI 解析（僅記錄稽核軌跡）。</div>
              </div>`
            : "");
        const liffEmployeeBindReady = Boolean((process.env.LIFF_ID_EMPLOYEE_BIND || "").trim() && (process.env.LINE_LOGIN_CHANNEL_ID || "").trim());
        // 員工 LINE 綁定列（僅啟用中帳號）
        const bindingRows = activeList.map(u => {
            const lu = u.lineUserId;
            const bound = !!lu;
            const luShort = lu ? `<code class="mono" style="font-size:11px;color:var(--txt-2);" title="${escapeAttr(lu)}">${escapeHtml(lu.slice(0,6))}…${escapeHtml(lu.slice(-4))}</code>` : "—";
            const boundAt = u.lineBoundAt ? `<span style="font-size:11px;color:var(--txt-3);">${escapeHtml(String(u.lineBoundAt).slice(0,16).replace("T"," "))}</span>` : "";
            const liffBtn = liffEmployeeBindReady
                ? `<form method="post" action="/admin/users/line-bind-link" style="display:inline;margin-right:4px;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm primary" title="產生一次性 LIFF 綁定連結（30 分鐘有效）">LIFF 連結</button></form>`
                : `<button type="button" class="sf-btn sm" disabled title="尚未設定 LIFF_ID_EMPLOYEE_BIND / LINE_LOGIN_CHANNEL_ID">LIFF 連結</button>`;
            const btn = bound
                ? `<form method="post" action="/admin/users/line-unbind" style="display:inline;" onsubmit="return confirm('確定解除 ${escapeAttr(u.username)} 的 LINE 綁定？');"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm danger">解綁</button></form>`
                : `${liffBtn}<form method="post" action="/admin/users/line-bind-code" style="display:inline;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm" title="舊式：產生 6 位數綁定碼，員工私訊 Bot 輸入完成綁定">6 位碼</button></form>`;
            return `<tr>
              <td>${escapeHtml(u.name || u.username)} <span class="sf-pill">${escapeHtml(u.title)}</span></td>
              <td><code>${escapeHtml(u.username)}</code></td>
              <td>${bound ? `<span class="sf-pill ok">已綁定</span>` : `<span class="sf-pill">未綁定</span>`}</td>
              <td>${luShort}</td>
              <td>${boundAt}</td>
              <td>${btn}</td>
            </tr>`;
        }).join("");
        // 群組發言成員（自動偵測）：曾在客戶群發言的 LINE 帳號。
        // 主名單只留「未判定」的人；標成同事或按「非公司人員」排除後移到收合的「已處理」區，名單不會被客戶塞滿。
        const speakers = await line_conversation_js_1.listGroupSpeakers(db, 200);
        const boundByLineUserId = new Map();
        for (const u of activeList) {
            if (u.lineUserId) boundByLineUserId.set(String(u.lineUserId).trim(), u);
        }
        const speakerUserOpts = activeList.map(u => `<option value="${escapeAttr(u.username)}">${escapeHtml(u.name || u.username)}${u.title ? `（${escapeHtml(u.title)}）` : ""}</option>`).join("");
        const renderSpeakerRow = (s) => {
            const lu = String(s.line_user_id || "");
            const bound = boundByLineUserId.get(lu);
            const nameCell = s.display_name ? `<strong>${escapeHtml(s.display_name)}</strong>` : `<span style="color:var(--txt-3);">（取不到名稱）</span>`;
            const luShort = `<code class="mono" style="font-size:11px;color:var(--txt-3);" title="${escapeAttr(lu)}">${escapeHtml(lu.slice(0, 6))}…${escapeHtml(lu.slice(-4))}</code>`;
            const grp = s.customer_name ? escapeHtml(s.customer_name) : `<code class="mono" style="font-size:11px;color:var(--txt-3);" title="${escapeAttr(String(s.group_id || ""))}">${escapeHtml(String(s.group_id || "").slice(0, 8))}…</code>`;
            const last = s.last_spoke_at ? escapeHtml(fmtTaipeiYMDHM(s.last_spoke_at)) : "—";
            let statusCell, actionCell;
            if (bound) {
                statusCell = `<span class="sf-pill ok">同事：${escapeHtml(bound.name || bound.username)}</span>`;
                actionCell = `<form method="post" action="/admin/users/line-unbind" style="display:inline;margin:0;" onsubmit="return confirm('解除 ${escapeAttr(bound.username)} 的 LINE 綁定？其訊息將回到一般客戶訊息處理。');"><input type="hidden" name="username" value="${escapeAttr(bound.username)}"><button type="submit" class="sf-btn sm">解除標記</button></form>`;
            }
            else if (s.dismissed_at) {
                statusCell = `<span class="sf-pill">非公司人員</span>`;
                actionCell = `<form method="post" action="/admin/users/speaker-visibility" style="display:inline;margin:0;"><input type="hidden" name="line_user_id" value="${escapeAttr(lu)}"><input type="hidden" name="visibility" value="restore"><button type="submit" class="sf-btn sm">恢復到名單</button></form>`;
            }
            else {
                statusCell = `<span class="sf-pill warn">未判定</span>`;
                actionCell = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                    <form method="post" action="/admin/users/bind-line-from-speaker" style="display:flex;gap:6px;align-items:center;margin:0;" onsubmit="return confirm('確定將此發言者標記為所選同事？\\n之後其在客戶群的訊息不做 AI 解析，並在訂單對話以「同事」樣式顯示。');">
                      <input type="hidden" name="line_user_id" value="${escapeAttr(lu)}">
                      <input type="hidden" name="display_name" value="${escapeAttr(s.display_name || "")}">
                      <select name="username" class="sf-select" style="min-width:9rem;font-size:12px;height:30px;padding:2px 6px;">${speakerUserOpts}</select>
                      <button type="submit" class="sf-btn sm primary">標記為同事</button>
                    </form>
                    <form method="post" action="/admin/users/speaker-visibility" style="display:inline;margin:0;">
                      <input type="hidden" name="line_user_id" value="${escapeAttr(lu)}">
                      <input type="hidden" name="visibility" value="dismiss">
                      <button type="submit" class="sf-btn sm" title="標記為客戶／非公司人員，移到下方「已處理」收合區（可隨時恢復）">非公司人員</button>
                    </form>
                  </div>`;
            }
            return `<tr><td>${nameCell}<div>${luShort}</div></td><td>${grp}</td><td style="text-align:right;">${s.message_count ?? 0}</td><td style="white-space:nowrap;">${last}</td><td>${statusCell}</td><td>${actionCell}</td></tr>`;
        };
        const pendingSpeakers = (speakers || []).filter(s => !boundByLineUserId.get(String(s.line_user_id || "")) && !s.dismissed_at);
        const handledSpeakers = (speakers || []).filter(s => boundByLineUserId.get(String(s.line_user_id || "")) || s.dismissed_at);
        const pendingSpeakerRows = pendingSpeakers.map(renderSpeakerRow).join("");
        const handledSpeakerRows = handledSpeakers.map(renderSpeakerRow).join("");
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="sf-breadcrumb" style="margin-bottom:6px;">系統設定 / 人員管理</div>
              <h1 style="margin:0;font-size:22px;font-weight:600;">人員管理</h1>
              <p style="margin-top:4px;color:var(--txt-3);font-size:12px;">僅<strong>經理</strong>可進入本頁。負責人：<code class="mono" style="font-size:11px;">${escapeHtml(ADMIN_OWNER_EMAIL)}</code>。新帳號須由負責人核准後才可登入。</p>
            </div>
            <button type="button" class="sf-btn primary" onclick="document.getElementById('addUserModal').style.display='flex'">${SF_ICONS.plus}<span>新增帳號</span></button>
          </div>
          ${msg.replace(/<p class="notion-msg ok">/g, '<div class="sf-pill ok" style="align-self:flex-start;">').replace(/<p class="notion-msg err">/g, '<div class="sf-pill bad" style="align-self:flex-start;">').replace(/<\/p>/g, "</div>")}
          ${bindMsg}

          ${pending.length ? `<div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.warn} 待審核（${pending.length}）</div>
              <span class="sf-card-sub">新帳號須由負責人核准</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th>姓名</th><th>帳號</th><th>職稱</th><th style="width:120px;">操作</th></tr></thead>
                <tbody>${pendingRows}</tbody>
              </table>
            </div>
          </div>` : ""}

          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.users} 啟用中（${activeList.length}）</div>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th>姓名</th><th>帳號</th><th style="width:90px;">職稱</th><th style="width:80px;">狀態</th><th style="width:220px;">操作</th></tr></thead>
                <tbody>${activeRows || `<tr><td colspan='5' style='padding:24px;text-align:center;color:var(--txt-3);'>尚無啟用帳號</td></tr>`}</tbody>
              </table>
            </div>
          </div>

          ${disabledList.length ? `<details class="sf-card">
            <summary style="padding:12px 16px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:var(--txt-3);">▸</span>
              <span style="font-size:13px;font-weight:600;">停用（${disabledList.length}）</span>
            </summary>
            <div class="sf-table-wrap" style="border:0;border-radius:0;border-top:var(--hairline);">
              <table class="sf-table">
                <thead><tr><th>姓名</th><th>帳號</th><th style="width:90px;">職稱</th><th style="width:80px;">狀態</th><th style="width:220px;">操作</th></tr></thead>
                <tbody>${disabledRows}</tbody>
              </table>
            </div>
          </details>` : ""}

          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.users} 群組發言成員（自動偵測・待判定 ${pendingSpeakers.length}）</div>
              <span class="sf-card-sub">曾在客戶群發言的 LINE 帳號——是同事就標記、不是就按「非公司人員」移出名單</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th>LINE 名稱</th><th>群組（客戶）</th><th style="width:70px;">訊息數</th><th style="width:150px;">最後發言</th><th style="width:120px;">身份</th><th style="width:340px;">操作</th></tr></thead>
                <tbody>${pendingSpeakerRows || `<tr><td colspan='6' style='padding:24px;text-align:center;color:var(--txt-3);'>沒有待判定的發言者${handledSpeakers.length ? "（已處理的收在下方）" : "——客戶群內有人發言就會自動出現在這裡"}</td></tr>`}</tbody>
              </table>
            </div>
            ${handledSpeakers.length ? `
            <details style="border-top:var(--hairline);">
              <summary style="padding:10px 16px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;color:var(--txt-3);">▸</span>
                <span style="font-size:13px;font-weight:600;color:var(--txt-2);">已處理（${handledSpeakers.length}）</span>
                <span style="font-size:11px;color:var(--txt-3);">同事與已排除的非公司人員收在這裡，可解除或恢復</span>
              </summary>
              <div class="sf-table-wrap" style="border:0;border-radius:0;border-top:var(--hairline);">
                <table class="sf-table">
                  <thead><tr><th>LINE 名稱</th><th>群組（客戶）</th><th style="width:70px;">訊息數</th><th style="width:150px;">最後發言</th><th style="width:120px;">身份</th><th style="width:340px;">操作</th></tr></thead>
                  <tbody>${handledSpeakerRows}</tbody>
                </table>
              </div>
            </details>` : ""}
          </div>

          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.link} 員工 LINE 綁定（內稽用）</div>
              <span class="sf-card-sub">綁定後，員工在客戶群組內傳訊息不會觸發 AI 解析</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th>姓名</th><th>帳號</th><th style="width:90px;">綁定狀態</th><th>LINE userId</th><th style="width:160px;">綁定時間</th><th style="width:140px;">操作</th></tr></thead>
                <tbody>${bindingRows || `<tr><td colspan='6' style='padding:24px;text-align:center;color:var(--txt-3);'>尚無啟用帳號</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 編輯使用者 Modal -->
        <div id="userEditModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;padding:24px;">
          <div class="sf-card" style="max-width:480px;width:100%;background:var(--bg-1);">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.edit} 編輯員工資料</div>
              <button type="button" class="sf-btn sm ghost" onclick="document.getElementById('userEditModal').style.display='none'">✕</button>
            </div>
            <form method="post" action="/admin/users/set-title" style="padding:16px 18px;display:flex;flex-direction:column;gap:14px;">
              <input type="hidden" name="username" id="ue-username">
              <div>
                <label class="sf-label">帳號（不可修改）</label>
                <input class="sf-input" id="ue-username-display" disabled style="background:var(--bg-3);color:var(--txt-3);">
              </div>
              <div>
                <label class="sf-label">姓名</label>
                <input class="sf-input" name="name" id="ue-name" required>
              </div>
              <div id="ue-title-row">
                <label class="sf-label">職稱</label>
                <select class="sf-select" name="title" id="ue-title">${titleOptsAll}</select>
                <p style="margin-top:6px;font-size:11px;color:var(--txt-3);">負責人帳號無法變更職稱。<strong>移工</strong>無法刪除任何資料（系統限制）。</p>
              </div>
              <div>
                <label class="sf-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" name="can_cash" id="ue-cancash" value="1"> 收款作業權限（可進入松富銷貨統計／現金收款／收款客戶主檔）
                </label>
                <p style="margin-top:6px;font-size:11px;color:var(--txt-3);">經理天生具備此權限，無需勾選。</p>
              </div>
              <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:6px;border-top:var(--hairline);">
                <button type="button" class="sf-btn ghost" onclick="document.getElementById('userEditModal').style.display='none'">取消</button>
                <button type="submit" class="sf-btn primary">${SF_ICONS.check}<span>儲存</span></button>
              </div>
            </form>
            <div style="padding:14px 18px;border-top:var(--hairline);background:var(--bg-2);">
              <div style="font-size:12px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">重設密碼</div>
              <form method="post" action="/admin/users/reset-password" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;" onsubmit="return confirm('確定要重設此帳號密碼？');">
                <input type="hidden" name="username" id="ue-pwd-username">
                <input class="sf-input" name="new_password" type="password" placeholder="新密碼（至少 4 字元）" minlength="4" required style="flex:1;min-width:160px;">
                <button type="submit" class="sf-btn danger">${SF_ICONS.refresh}<span>重設</span></button>
              </form>
            </div>
          </div>
        </div>

        <!-- 新增帳號 Modal -->
        <div id="addUserModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;padding:24px;">
          <div class="sf-card" style="max-width:480px;width:100%;background:var(--bg-1);">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.plus} 新增帳號（待審核）</div>
              <button type="button" class="sf-btn sm ghost" onclick="document.getElementById('addUserModal').style.display='none'">✕</button>
            </div>
            <form method="post" action="/admin/users/add" style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
              <div><label class="sf-label">姓名</label><input class="sf-input" type="text" name="name" required minlength="1" autocomplete="off"></div>
              <div><label class="sf-label">帳號（建議用信箱）</label><input class="sf-input" type="text" name="username" required minlength="2" autocomplete="off"></div>
              <div><label class="sf-label">密碼（至少 4 字元）</label><input class="sf-input" type="password" name="password" required minlength="4" autocomplete="new-password"></div>
              <div><label class="sf-label">職稱</label><select class="sf-select" name="title">${titleOpts}</select></div>
              <p style="margin:0;font-size:11px;color:var(--txt-3);">送出後須由負責人（<code class="mono">${escapeHtml(ADMIN_OWNER_EMAIL)}</code>）核准才可登入。</p>
              <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:6px;border-top:var(--hairline);">
                <button type="button" class="sf-btn ghost" onclick="document.getElementById('addUserModal').style.display='none'">取消</button>
                <button type="submit" class="sf-btn primary">${SF_ICONS.check}<span>建立</span></button>
              </div>
            </form>
          </div>
        </div>

        <script>
        function openUserEdit(info){
          document.getElementById('ue-username').value = info.u;
          document.getElementById('ue-username-display').value = info.u;
          document.getElementById('ue-name').value = info.n || '';
          document.getElementById('ue-pwd-username').value = info.u;
          const titleRow = document.getElementById('ue-title-row');
          const titleSel = document.getElementById('ue-title');
          if (info.owner) {
            titleRow.style.opacity = '0.5';
            titleSel.disabled = true;
            titleSel.value = info.t || '經理';
          } else {
            titleRow.style.opacity = '1';
            titleSel.disabled = false;
            titleSel.value = info.t || '行政';
          }
          var cc = document.getElementById('ue-cancash');
          if (cc) { cc.checked = !!info.c; cc.disabled = !!info.owner; }
          document.getElementById('userEditModal').style.display = 'flex';
        }
        </script>`;
        res.type("text/html").send(notionPage("人員管理", body, "users", res));
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
        // [fix 2026-07-18 稽核] 帳號異動留軌跡；一律不記 passwordHash／密碼明文。
        try { await logDataChange(req, { entityType: "admin_user", entityId: username, action: "create", summary: `新增帳號 ${username}（${name}，職稱 ${title}，待核准）`, meta: { username, name, title, status: "pending" } }); } catch (_) {}
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
        try { await logDataChange(req, { entityType: "admin_user", entityId: target, action: "approve", summary: `核准帳號 ${target}`, meta: { before: { status: "pending" }, after: { status: "active", approvedBy: req.adminUsername } } }); } catch (_) {}
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
        const beforeStatus = users[ix].status;
        users[ix].status = status;
        await saveAdminUsers(users);
        if (beforeStatus !== status) { try { await logDataChange(req, { entityType: "admin_user", entityId: target, action: "set_status", summary: `帳號 ${target} 狀態：${beforeStatus || "—"} → ${status}`, meta: { before: { status: beforeStatus }, after: { status } } }); } catch (_) {} }
        res.redirect("/admin/users?ok=status");
    });
    router.post("/users/set-title", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const target = (req.body.username || "").trim();
        const name = String(req.body.name || "").trim();
        let title = String(req.body.title || "").trim();
        if (isAdminOwnerUsername(target)) {
            // 負責人帳號允許更新姓名，但不變更職稱
            const users = await loadAdminUsers();
            const ix = users.findIndex((x) => x.username === target);
            if (ix >= 0 && name) {
                const beforeName = users[ix].name;
                users[ix].name = name;
                await saveAdminUsers(users);
                if (beforeName !== name) { try { await logDataChange(req, { entityType: "admin_user", entityId: target, action: "set_title", summary: `更新負責人姓名：${beforeName || "—"} → ${name}`, meta: { before: { name: beforeName }, after: { name } } }); } catch (_) {} }
            }
            res.redirect("/admin/users?ok=status");
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
        const beforeTitle = { title: users[ix].title, name: users[ix].name, canCash: !!users[ix].canCash };
        users[ix].title = title;
        if (name) users[ix].name = name;
        users[ix].canCash = (req.body.can_cash === "1" || req.body.can_cash === "on");
        await saveAdminUsers(users);
        const afterTitle = { title, name: name || beforeTitle.name, canCash: users[ix].canCash };
        if (beforeTitle.title !== afterTitle.title || beforeTitle.name !== afterTitle.name || beforeTitle.canCash !== afterTitle.canCash) {
            try { await logDataChange(req, { entityType: "admin_user", entityId: target, action: "set_title", summary: `帳號 ${target} 職稱/權限異動：${beforeTitle.title || "—"} → ${title}`, meta: { before: beforeTitle, after: afterTitle } }); } catch (_) {}
        }
        res.redirect("/admin/users?ok=status");
    });
    router.post("/users/reset-password", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const target = (req.body.username || "").trim();
        const newPwd = String(req.body.new_password || "");
        if (!target || newPwd.length < 4) {
            res.redirect("/admin/users?err=weak");
            return;
        }
        // [fix 2026-07-08] 只有負責人本人能重設負責人密碼，否則任一經理可重設負責人密碼奪權
        if (isAdminOwnerUsername(target) && !isAdminOwnerUsername(req.adminUsername)) {
            res.redirect("/admin/users?err=" + encodeURIComponent("僅負責人本人可重設負責人密碼"));
            return;
        }
        const users = await loadAdminUsers();
        const ix = users.findIndex((x) => x.username === target);
        if (ix < 0) {
            res.redirect("/admin/users?err=" + encodeURIComponent("找不到帳號"));
            return;
        }
        users[ix].passwordHash = hashAdminPassword(newPwd);
        await saveAdminUsers(users);
        try {
            await logDataChange(req, {
                entityType: "admin_user",
                entityId: target,
                action: "reset_password",
                summary: `重設帳號 ${target} 的密碼`,
            });
        } catch (_) {}
        res.redirect("/admin/users?ok=" + encodeURIComponent("已重設密碼"));
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
        const removed = users.find((x) => x.username === delName);
        const next = users.filter((x) => x.username !== delName);
        if (next.length === users.length) {
            res.redirect("/admin/users");
            return;
        }
        await saveAdminUsers(next);
        try { await logDataChange(req, { entityType: "admin_user", entityId: delName, action: "delete", summary: `刪除帳號 ${delName}`, meta: { before: removed ? { username: removed.username, name: removed.name, title: removed.title, status: removed.status } : null, after: null } }); } catch (_) {}
        res.redirect("/admin/users?ok=del");
    });
    router.post("/users/line-bind-link", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const username = String(req.body?.username || "").trim();
        if (!username) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const users = await loadAdminUsers();
        if (!users.find(u => u.username === username)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const liffId = (process.env.LIFF_ID_EMPLOYEE_BIND || "").trim();
        if (!liffId) {
            res.redirect("/admin/users?err=" + encodeURIComponent("尚未設定 LIFF_ID_EMPLOYEE_BIND"));
            return;
        }
        try {
            const out = await (0, liff_bind_token_js_1.issueLiffBindToken)(db, username);
            // LIFF 永久短網址：https://liff.line.me/<liffId>?t=<token>
            const link = `https://liff.line.me/${encodeURIComponent(liffId)}?t=${encodeURIComponent(out.token)}`;
            await logDataChange(req, {
                entityType: "employee_line_binding",
                entityId: username,
                action: "generate_liff_link",
                summary: `為員工 ${username} 產生 LIFF 綁定連結（30 分鐘有效）`,
            });
            res.redirect(`/admin/users?bind_link=${encodeURIComponent(link)}&bind_user=${encodeURIComponent(username)}`);
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "綁定連結產生失敗"));
        }
    });
    router.post("/users/line-bind-code", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const username = String(req.body?.username || "").trim();
        if (!username) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const users = await loadAdminUsers();
        if (!users.find(u => u.username === username)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        try {
            const out = await (0, employee_line_binding_js_1.generateBindCode)(db, username);
            await logDataChange(req, {
                entityType: "employee_line_binding",
                entityId: username,
                action: "generate_code",
                summary: `為員工 ${username} 產生 LINE 綁定碼（10 分鐘有效）`,
            });
            res.redirect(`/admin/users?bind_code=${encodeURIComponent(out.code)}&bind_user=${encodeURIComponent(username)}`);
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "綁定碼產生失敗"));
        }
    });
    router.post("/users/line-unbind", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const username = String(req.body?.username || "").trim();
        if (!username) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        try {
            const changed = await (0, employee_line_binding_js_1.unbindLineUserIdFromEmployee)(db, username);
            if (changed) {
                await logDataChange(req, {
                    entityType: "employee_line_binding",
                    entityId: username,
                    action: "unbind",
                    summary: `解除員工 ${username} 的 LINE 綁定`,
                });
            }
            res.redirect("/admin/users?ok=status");
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "解綁失敗"));
        }
    });
    // 從「群組發言成員」名單直接把某 LINE 發言者標記為同事（免綁定碼／LIFF，沿用同一套綁定儲存）
    router.post("/users/bind-line-from-speaker", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const username = String(req.body?.username || "").trim();
        const lineUserId = String(req.body?.line_user_id || "").trim();
        const displayName = String(req.body?.display_name || "").trim() || null;
        if (!username || !lineUserId) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const users = await loadAdminUsers();
        if (!users.find(u => u.username === username)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        try {
            await (0, employee_line_binding_js_1.bindLineUserIdToEmployee)(db, username, lineUserId, displayName);
            await logDataChange(req, {
                entityType: "employee_line_binding",
                entityId: username,
                action: "bind_from_speaker",
                summary: `從群組發言名單將 ${displayName || lineUserId.slice(0, 8) + "…"} 標記為同事（帳號 ${username}）`,
            });
            res.redirect("/admin/users?ok=status");
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "標記失敗"));
        }
    });
    // 發言者「非公司人員」排除／恢復：判定過的人移出主名單，避免名單被客戶塞滿
    router.post("/users/speaker-visibility", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const lineUserId = String(req.body?.line_user_id || "").trim();
        const visibility = String(req.body?.visibility || "").trim();
        if (!lineUserId || !["dismiss", "restore"].includes(visibility)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        try {
            await line_conversation_js_1.setSpeakerDismissed(db, lineUserId, visibility === "dismiss");
            await logDataChange(req, {
                entityType: "line_group_speaker",
                entityId: lineUserId.slice(0, 12),
                action: visibility === "dismiss" ? "speaker_dismiss" : "speaker_restore",
                summary: visibility === "dismiss" ? "發言者標記為非公司人員（移出名單）" : "發言者恢復到待判定名單",
            });
            res.redirect("/admin/users?ok=status");
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "操作失敗"));
        }
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
        let dailySummaryEnabled = false;
        let dailySummaryHour = 22;
        try {
            const r1 = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("daily_summary_push_enabled");
            dailySummaryEnabled = !!(r1 && (r1.value === "1" || r1.value === "true"));
            const r2 = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("daily_summary_push_hour");
            const n = r2?.value ? parseInt(String(r2.value), 10) : NaN;
            if (Number.isFinite(n) && n >= 0 && n <= 23) dailySummaryHour = n;
        } catch (_) { /* ignore */ }
        let logs = [];
        try {
            logs = await db.prepare("SELECT event_type, detail, created_at FROM line_bot_state_log ORDER BY created_at DESC LIMIT 80").all();
        }
        catch (_) { }
        const modeOpts = [
            { v: "always_on", l: "一律開啟（測試／全天候）" },
            { v: "always_off", l: "一律關閉（不回覆叫貨）" },
            { v: "scheduled", l: "依下方時段（台北時間）" },
        ].map((o) => `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:var(--hairline);border-radius:var(--radius);margin-bottom:6px;cursor:pointer;${s.mode === o.v ? "background:var(--accent-soft);border-color:var(--accent-line);" : ""}"><input type="radio" name="line_bot_mode" value="${escapeAttr(o.v)}" ${s.mode === o.v ? "checked" : ""}> <span style="font-size:13px;">${escapeHtml(o.l)}</span></label>`).join("");
        const logRows = logs.length
            ? logs.map((r) => `<tr><td class="mono" style="white-space:nowrap;font-size:11px;color:var(--txt-3);">${escapeHtml(r.created_at || "")}</td><td><span class="sf-pill">${escapeHtml(r.event_type || "")}</span></td><td style="font-size:12px;color:var(--txt-2);word-break:break-all;">${escapeHtml((r.detail || "").slice(0, 200))}</td></tr>`).join("")
            : `<tr><td colspan='3' style="padding:24px;text-align:center;color:var(--txt-3);">尚無紀錄</td></tr>`;
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div>
            <div class="sf-breadcrumb" style="margin-bottom:6px;">系統設定 / LINE 機器人</div>
            <h1 style="margin:0;font-size:22px;font-weight:600;">LINE 機器人：啟動與排程</h1>
          </div>
          ${_req.query.ok === "1" ? `<div class="sf-pill ok" style="align-self:flex-start;">已儲存設定</div>` : ""}
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div class="sf-kpi ${accepting ? "status-ok" : "status-bad"}" style="max-width:380px;">
              <div class="sf-kpi-head">
                <span class="sf-kpi-label">目前狀態</span>
                <span class="sf-dot ${accepting ? "ok" : "bad"}"></span>
              </div>
              <div style="font-size:14px;color:var(--txt-1);font-weight:500;margin-top:4px;">${accepting ? "可收單" : "休眠中"}</div>
              <div style="font-size:11px;color:var(--txt-3);margin-top:4px;">${accepting ? "機器人會解析叫貨／可跑 AI" : "不呼叫 Gemini／不 OCR／不寫訂單"}</div>
            </div>
            ${s.suppressCustomerReply ? `<div class="sf-kpi status-warn" style="max-width:380px;">
              <div class="sf-kpi-head"><span class="sf-kpi-label">對客戶回覆</span><span class="sf-dot warn"></span></div>
              <div style="font-size:14px;color:var(--txt-1);font-weight:500;margin-top:4px;">靜音中</div>
              <div style="font-size:11px;color:var(--txt-3);margin-top:4px;">仍照常寫庫；只是不向群組發回覆</div>
            </div>` : ""}
          </div>
          <form method="post" action="/admin/line-bot" style="display:flex;flex-direction:column;gap:16px;">
            <div class="sf-card">
              <div class="sf-card-head">
                <div class="sf-card-title">${SF_ICONS.spark} 運作模式</div>
              </div>
              <div style="padding:16px 18px;">
                ${modeOpts}
                <div style="margin-top:14px;padding-top:14px;border-top:var(--hairline);">
                  <label class="sf-label">排程時段（台北時間）</label>
                  <p style="margin:0 0 10px;font-size:12px;color:var(--txt-3);line-height:1.5;">僅在選「依下方時段」時生效。時段內可收單，時段外休眠（不產生 Gemini／OCR 費用）。建議範例：18:00～03:00（日間上班時間休眠）。</p>
                  <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--txt-2);">開始 <input class="sf-input" type="time" name="line_bot_window_start" value="${escapeAttr(s.windowStart)}" style="width:120px;height:32px;"></label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--txt-2);">結束 <input class="sf-input" type="time" name="line_bot_window_end" value="${escapeAttr(s.windowEnd)}" style="width:120px;height:32px;"></label>
                  </div>
                </div>
              </div>
            </div>

            <div class="sf-card">
              <div class="sf-card-head">
                <div class="sf-card-title">${SF_ICONS.bell} 回覆與靜音</div>
              </div>
              <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px;">
                <label class="sf-switch-label" style="align-items:flex-start;white-space:normal;font-size:13px;">
                  <input type="checkbox" name="line_bot_ai_gate" value="1" ${s.aiGate ? "checked" : ""}>
                  <span class="sf-switch" style="margin-top:2px;"></span>
                  <span><strong style="color:var(--txt-1);">啟用 AI 過濾</strong><br><span style="font-size:12px;color:var(--txt-3);">僅對「非收單關鍵字」的閒聊不回覆。需設定 GOOGLE_GEMINI_API_KEY。</span></span>
                </label>
                <label class="sf-switch-label" style="align-items:flex-start;white-space:normal;font-size:13px;">
                  <input type="checkbox" name="line_bot_suppress_reply" value="1" ${s.suppressCustomerReply ? "checked" : ""}>
                  <span class="sf-switch" style="margin-top:2px;"></span>
                  <span><strong style="color:var(--txt-1);">對客戶訊息靜音</strong><br><span style="font-size:12px;color:var(--txt-3);">仍照常收單並寫入訂單；僅不向群組發送一般回覆與 30 秒結單推播。「取得群組ID」「群組ID」仍會回覆（供綁定）。</span></span>
                </label>
              </div>
            </div>

            <div class="sf-card">
              <div class="sf-card-head">
                <div class="sf-card-title">${SF_ICONS.check} 訂單編號自動確認回覆</div>
              </div>
              <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
                <label class="sf-switch-label" style="align-items:flex-start;white-space:normal;font-size:13px;">
                  <input type="checkbox" name="line_order_confirm_reply_enabled" value="1" ${s.orderConfirmReplyEnabled ? "checked" : ""}>
                  <span class="sf-switch" style="margin-top:2px;"></span>
                  <span><strong style="color:var(--txt-1);">啟用</strong><br><span style="font-size:12px;color:var(--txt-3);">客戶最後一則訊息後若 N 秒內無新訊息，自動回覆「感謝您的下訂，訂單已成立，訂單編號：XXX」。預設關閉。</span></span>
                </label>
                <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--txt-2);">
                  延遲秒數 <input class="sf-input" type="number" name="line_order_confirm_reply_delay_sec" min="30" max="3600" step="10" value="${escapeAttr(String(s.orderConfirmReplyDelaySec || 600))}" style="width:110px;height:32px;">
                  <span style="font-size:11px;color:var(--txt-3);">30 ~ 3600 秒；預設 600 秒（10 分鐘）。建議拉長避免客戶還在補品項時誤觸發。</span>
                </div>
              </div>
            </div>

            <div class="sf-card">
              <div class="sf-card-head">
                <div class="sf-card-title">${SF_ICONS.bell} 每日訂單摘要推播（內稽用）</div>
              </div>
              <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
                <label class="sf-switch-label" style="align-items:flex-start;white-space:normal;font-size:13px;">
                  <input type="checkbox" name="daily_summary_push_enabled" value="1" ${dailySummaryEnabled ? "checked" : ""}>
                  <span class="sf-switch" style="margin-top:2px;"></span>
                  <span><strong style="color:var(--txt-1);">啟用</strong><br><span style="font-size:12px;color:var(--txt-3);">每日於指定時刻自動推送 Flex Message 給每個客戶 LINE 群組，列出當日所有訂單品項。客戶有錯誤可立刻回覆。預設關閉。</span></span>
                </label>
                <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--txt-2);flex-wrap:wrap;">
                  推送時刻
                  <select class="sf-select" name="daily_summary_push_hour" style="width:120px;height:32px;">${Array.from({length:24},(_,h)=>`<option value="${h}" ${h===dailySummaryHour?"selected":""}>${String(h).padStart(2,"0")}:00</option>`).join("")}</select>
                  <span style="font-size:11px;color:var(--txt-3);">台北時間；預設 22:00；推送會避開已作廢訂單。</span>
                  <a href="/admin/daily-summary-test" class="sf-btn sm ghost" style="margin-left:auto;">→ 手動測試推播</a>
                </div>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:center;">
              <button type="submit" class="sf-btn primary">${SF_ICONS.check}<span>儲存所有設定</span></button>
              <span style="font-size:12px;color:var(--txt-3);">測試階段建議選「一律開啟」，確認無誤後再改「依時段」。AI 過濾建議先關閉，避免誤擋。</span>
            </div>
          </form>

          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.history} 設定與狀態紀錄</div>
              <span class="sf-card-sub">最近 80 筆</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th style="width:160px;">時間</th><th style="width:160px;">類型</th><th>內容</th></tr></thead>
                <tbody>${logRows}</tbody>
              </table>
            </div>
          </div>
        </div>`;
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
        const confirmEnabled = req.body.line_order_confirm_reply_enabled === "1" ? "1" : "0";
        const confirmDelayRaw = parseInt(String(req.body.line_order_confirm_reply_delay_sec || "600"), 10);
        const confirmDelay = Number.isFinite(confirmDelayRaw) ? Math.max(30, Math.min(3600, confirmDelayRaw)) : 600;
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_order_confirm_reply_enabled", confirmEnabled);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_order_confirm_reply_delay_sec", String(confirmDelay));
        const dailyEnabled = req.body.daily_summary_push_enabled === "1" ? "1" : "0";
        const dailyHourRaw = parseInt(String(req.body.daily_summary_push_hour || "22"), 10);
        const dailyHour = Number.isFinite(dailyHourRaw) && dailyHourRaw >= 0 && dailyHourRaw <= 23 ? dailyHourRaw : 22;
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("daily_summary_push_enabled", dailyEnabled);
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("daily_summary_push_hour", String(dailyHour));
        await (0, line_bot_control_js_1.appendLineBotLog)(db, "settings_saved", { mode: m, windowStart: wStart, windowEnd: wEnd, aiGate: aiGate === "1", suppressCustomerReply: suppressReply === "1", orderConfirmReplyEnabled: confirmEnabled === "1", orderConfirmReplyDelaySec: confirmDelay, dailySummaryPushEnabled: dailyEnabled === "1", dailySummaryPushHour: dailyHour });
        res.redirect("/admin/line-bot?ok=1");
    });
    router.get("/daily-summary-test", requireManager, async (req, res) => {
        const dry = req.query.dry === "1";
        try {
            const out = await daily_summary_push_js_1.runDailySummaryPush(db, { dryRun: dry });
            await logDataChange(req, {
                entityType: "broadcast",
                entityId: new Date().toISOString(),
                action: dry ? "daily_summary_dry_run" : "daily_summary_manual",
                summary: `${dry ? "（試跑）" : ""}手動觸發每日訂單摘要：成功 ${out.sent} 個，略過 ${out.skipped} 個，錯誤 ${(out.errors||[]).length}`,
                meta: out,
            });
            res.type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>每日訂單摘要 手動測試</title><style>body{font-family:system-ui;padding:24px;max-width:680px;margin:0 auto;}pre{background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto;}</style></head><body><h2>每日訂單摘要手動觸發${dry?"（試跑，不實際發送）":""}</h2><p><strong>結果：</strong>成功 ${out.sent} 個群組，略過 ${out.skipped} 個（當日無訂單），錯誤 ${(out.errors||[]).length}</p><pre>${escapeHtml(JSON.stringify(out, null, 2))}</pre><p><a href="/admin/daily-summary-test?dry=1">試跑模式</a> | <a href="/admin/daily-summary-test">實際發送</a> | <a href="/admin/line-bot">回 LINE 機器人設定</a></p></body></html>`);
        } catch (e) {
            res.status(500).type("text/plain").send("失敗：" + (e?.message || e));
        }
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
        <p class="notion-hint">當客戶用「把／條／根／支／包」下單，但實際是公斤計價時，請先在本頁建立規則。第一分頁會自動列出系統偵測到的未確認品項；第二分頁是已確認規則，可搜尋與持續建置。<strong>儲存規則後會自動同步寫入符合品項的「2-2 單位→公斤」（<code>product_unit_specs</code>）</strong>，進單時優先於通用 JSON 規則套用。</p>
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
                try {
                    await unit_spec_learn_js_1.syncProductUnitSpecsFromLineRules(db, await loadLineUnitRulesObject());
                }
                catch (e) {
                    console.error("[admin] sync product_unit_specs from line rules", e?.message || e);
                }
                res.redirect("/admin/line-bot/unit-conversion?ok=1");
                return;
            }
            if (action === "delete_rule") {
                const idx = Number(req.body?.rule_index);
                const obj = await loadLineUnitRulesObject();
                if (Number.isInteger(idx) && idx >= 0 && idx < obj.rules.length) {
                    obj.rules.splice(idx, 1);
                    await saveLineUnitRulesObject(normalizeLineUnitRules(JSON.stringify(obj)));
                    try {
                        await unit_spec_learn_js_1.syncProductUnitSpecsFromLineRules(db, await loadLineUnitRulesObject());
                    }
                    catch (e) {
                        console.error("[admin] sync product_unit_specs after rule delete", e?.message || e);
                    }
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
            try {
                await unit_spec_learn_js_1.syncProductUnitSpecsFromLineRules(db, await loadLineUnitRulesObject());
            }
            catch (e) {
                console.error("[admin] sync product_unit_specs from line rules (json)", e?.message || e);
            }
            res.redirect("/admin/line-bot/unit-conversion?ok=1");
        }
        catch (_e) {
            res.redirect("/admin/line-bot/unit-conversion?err=1");
        }
    });
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
    router.get("/analytics", async (req, res) => {
        try {
            const isPg = Boolean(process.env.DATABASE_URL);
            // 期間（預設 90 天）
            const periodDays = Math.max(7, Math.min(365, parseInt(String(req.query.period || "90"), 10) || 90));
            const todayIso = getTaipeiCalendarDateYYYYMMDD();
            const fromIso = (() => {
                const d = new Date(todayIso + "T00:00:00+08:00");
                d.setDate(d.getDate() - periodDays + 1);
                return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d);
            })();
            // 期間以「文字 YYYY-MM-DD」比較（PG/SQLite 共用）
            const periodWhere = " AND o.order_date >= ? AND o.order_date <= ?";
            const notVoidStatus = " AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint')";
            // ── KPI ──
            const totalActive = Number((await db.prepare("SELECT COUNT(*) AS n FROM customers WHERE active = 1 OR active IS NULL").get())?.n) || 0;
            const activeInPeriod = Number((await db.prepare(
                "SELECT COUNT(DISTINCT o.customer_id) AS n FROM orders o WHERE 1=1" + notVoidStatus + periodWhere
            ).get(fromIso, todayIso))?.n) || 0;
            const totalOrdersInPeriod = Number((await db.prepare(
                "SELECT COUNT(*) AS n FROM orders o WHERE 1=1" + notVoidStatus + periodWhere
            ).get(fromIso, todayIso))?.n) || 0;
            const complaintsInPeriod = Number((await db.prepare(
                "SELECT COUNT(*) AS n FROM orders o WHERE LOWER(TRIM(COALESCE(o.status,''))) = 'complaint'" + periodWhere
            ).get(fromIso, todayIso))?.n) || 0;
            const complaintRate = totalOrdersInPeriod > 0 ? Math.round((complaintsInPeriod / totalOrdersInPeriod) * 1000) / 10 : 0;
            // 本月新客戶（第一張訂單在本月）
            const monthStart = todayIso.slice(0, 8) + "01";
            let newCustomersThisMonth = 0;
            try {
                const r = await db.prepare(
                    "SELECT COUNT(*) AS n FROM (SELECT customer_id, MIN(order_date) AS first_d FROM orders WHERE COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') GROUP BY customer_id) sub WHERE sub.first_d >= ?"
                ).get(monthStart);
                newCustomersThisMonth = Number(r?.n) || 0;
            } catch (_) {}
            // ── 客戶排名 Top 20 ──
            const topCustomers = await db.prepare(
                "SELECT c.id, c.name, COUNT(*) AS order_count, " +
                "SUM((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.voided_at IS NULL)) AS item_count, " +
                "MAX(o.order_date) AS last_date " +
                "FROM orders o JOIN customers c ON c.id = o.customer_id " +
                "WHERE 1=1" + notVoidStatus + periodWhere + " " +
                "GROUP BY c.id, c.name ORDER BY order_count DESC LIMIT 20"
            ).all(fromIso, todayIso);
            // ── 客戶客訴排名（同期間客訴數最多的）──
            const topComplainCustomers = await db.prepare(
                "SELECT c.id, c.name, COUNT(*) AS complaint_count " +
                "FROM orders o JOIN customers c ON c.id = o.customer_id " +
                "WHERE LOWER(TRIM(COALESCE(o.status,''))) = 'complaint'" + periodWhere + " " +
                "GROUP BY c.id, c.name ORDER BY complaint_count DESC LIMIT 10"
            ).all(fromIso, todayIso);
            // ── 品項排名 Top 30 ──
            const topProducts = await db.prepare(
                "SELECT COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '(未對應)') AS name, " +
                "COUNT(*) AS hit_count, " +
                "SUM(COALESCE(oi.quantity, 0)) AS total_qty, " +
                "COUNT(DISTINCT o.customer_id) AS customer_count " +
                "FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id " +
                "WHERE oi.voided_at IS NULL" + notVoidStatus + periodWhere + " " +
                "GROUP BY COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''), '(未對應)') " +
                "ORDER BY hit_count DESC LIMIT 30"
            ).all(fromIso, todayIso);
            // ── 每日訂單量趨勢 ──
            const dailyTrend = await db.prepare(
                "SELECT o.order_date AS d, COUNT(*) AS n FROM orders o " +
                "WHERE 1=1" + notVoidStatus + periodWhere + " " +
                "GROUP BY o.order_date ORDER BY o.order_date"
            ).all(fromIso, todayIso);
            // ── 週幾分布 ──
            const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]; // 0=日 ~ 6=六
            for (const r of dailyTrend) {
                const d = new Date(String(r.d) + "T00:00:00+08:00");
                if (!Number.isNaN(d.getTime())) weekdayCounts[d.getDay()] += Number(r.n) || 0;
            }
            const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];
            // ── 流失風險客戶（超過正常 2 倍間隔還沒叫貨）──
            const churnRisk = await db.prepare(
                "SELECT c.id, c.name, MAX(o.order_date) AS last_date, COUNT(*) AS order_count " +
                "FROM orders o JOIN customers c ON c.id = o.customer_id " +
                "WHERE (c.active = 1 OR c.active IS NULL)" + notVoidStatus + " " +
                "GROUP BY c.id, c.name " +
                "HAVING MAX(o.order_date) < ? " +
                "ORDER BY order_count DESC LIMIT 15"
            ).all((() => {
                // 14 天前的日期（沒叫貨 14 天以上視為流失風險，可後續改成依各客戶平均間隔）
                const d = new Date(todayIso + "T00:00:00+08:00");
                d.setDate(d.getDate() - 14);
                return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d);
            })());
            // ── HTML ──
            const maxOrderCount = Math.max(1, ...topCustomers.map(c => Number(c.order_count) || 0));
            const maxProductHit = Math.max(1, ...topProducts.map(p => Number(p.hit_count) || 0));
            const maxDaily = Math.max(1, ...dailyTrend.map(r => Number(r.n) || 0));
            const maxWeekday = Math.max(1, ...weekdayCounts);
            const periodOpts = [7, 14, 30, 60, 90, 180, 365].map(d => `<option value="${d}" ${d === periodDays ? "selected" : ""}>過去 ${d} 天</option>`).join("");
            const kpi = (label, num, unit, sub, status) => `
              <div class="sf-card" style="padding:14px 18px;">
                <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">${label}</div>
                <div class="mono" style="font-size:26px;font-weight:600;color:${status === "bad" ? "var(--bad)" : status === "warn" ? "var(--warn)" : "var(--txt-1)"};">${num}${unit ? `<span style="font-size:14px;color:var(--txt-3);margin-left:4px;">${unit}</span>` : ""}</div>
                <div style="font-size:12px;color:var(--txt-2);">${sub || ""}</div>
              </div>`;
            const body = `
              <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;max-width:1200px;margin:0 auto;">
                <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                  <div>
                    <div class="sf-breadcrumb" style="margin-bottom:6px;">報表與通訊 / 營運分析</div>
                    <h1 style="margin:0;font-size:22px;font-weight:600;">營運分析</h1>
                    <p style="margin:6px 0 0;color:var(--txt-3);font-size:12px;">期間：${escapeHtml(fromIso)} ~ ${escapeHtml(todayIso)}（${periodDays} 天）。不含已作廢／客訴訂單。</p>
                  </div>
                  <form method="get" action="/admin/analytics" style="display:flex;gap:8px;align-items:center;">
                    <label style="font-size:13px;color:var(--txt-2);">期間
                      <select name="period" class="sf-input" style="margin-left:6px;" onchange="this.form.submit()">${periodOpts}</select>
                    </label>
                  </form>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                  ${kpi("活躍客戶", activeInPeriod, "/ " + totalActive, `期間內有叫貨 · 活躍率 ${totalActive > 0 ? Math.round(activeInPeriod * 100 / totalActive) : 0}%`)}
                  ${kpi("期間訂單數", totalOrdersInPeriod, "張", `平均每天 ${(totalOrdersInPeriod / periodDays).toFixed(1)} 張`)}
                  ${kpi("客訴率", complaintRate + "%", "", `客訴 ${complaintsInPeriod} 張`, complaintRate > 5 ? "bad" : complaintRate > 2 ? "warn" : "ok")}
                  ${kpi("本月新客戶", newCustomersThisMonth, "戶", "首張訂單在本月")}
                </div>

                <div class="sf-card">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.chartLine}每日訂單量趨勢</div></div>
                  <div style="padding:14px 16px;">
                    ${dailyTrend.length ? `<div style="display:flex;align-items:flex-end;gap:2px;height:120px;">${dailyTrend.map(r => {
                      const h = Math.round((Number(r.n) || 0) / maxDaily * 110);
                      return `<div title="${escapeAttr(r.d)} · ${r.n} 張" style="flex:1;min-width:6px;background:var(--accent);opacity:.65;height:${h}px;border-radius:2px 2px 0 0;"></div>`;
                    }).join("")}</div><div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--txt-3);"><span>${escapeHtml(dailyTrend[0]?.d || "")}</span><span>${escapeHtml(dailyTrend[dailyTrend.length-1]?.d || "")}</span></div>` : `<p style="color:var(--txt-3);text-align:center;margin:0;">期間內無訂單</p>`}
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.users}客戶排名 Top 20</div></div>
                    <div style="padding:0;">
                      ${topCustomers.length ? topCustomers.map((c, i) => {
                        const pct = Math.round((Number(c.order_count) || 0) * 100 / maxOrderCount);
                        return `<a href="/admin/customers/${encodeURIComponent(c.id)}/360" style="display:block;padding:8px 14px;border-bottom:1px solid var(--line);text-decoration:none;color:inherit;">
                          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:4px;">
                            <span><span class="mono" style="color:var(--txt-3);margin-right:6px;">${String(i+1).padStart(2,"0")}</span>${escapeHtml(c.name)}</span>
                            <span class="mono"><strong>${c.order_count}</strong> 張 · ${c.item_count || 0} 項</span>
                          </div>
                          <div style="height:6px;background:var(--bg-2);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--accent);"></div></div>
                        </a>`;
                      }).join("") : `<p style="padding:18px;color:var(--txt-3);text-align:center;font-size:13px;margin:0;">期間內無訂單</p>`}
                    </div>
                  </div>
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.box}品項排名 Top 30（依被叫次數）</div></div>
                    <div style="padding:0;max-height:540px;overflow-y:auto;">
                      ${topProducts.length ? topProducts.map((p, i) => {
                        const pct = Math.round((Number(p.hit_count) || 0) * 100 / maxProductHit);
                        const totalQty = Number(p.total_qty) || 0;
                        const qtyDisp = totalQty % 1 === 0 ? String(totalQty) : totalQty.toFixed(2);
                        return `<div style="padding:8px 14px;border-bottom:1px solid var(--line);">
                          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:4px;">
                            <span><span class="mono" style="color:var(--txt-3);margin-right:6px;">${String(i+1).padStart(2,"0")}</span>${escapeHtml(p.name)}</span>
                            <span class="mono" style="font-size:12px;"><strong>${p.hit_count}</strong> 次 · ${qtyDisp} · ${p.customer_count} 戶</span>
                          </div>
                          <div style="height:6px;background:var(--bg-2);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--ok);"></div></div>
                        </div>`;
                      }).join("") : `<p style="padding:18px;color:var(--txt-3);text-align:center;font-size:13px;margin:0;">期間內無品項紀錄</p>`}
                    </div>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.calendar}週幾叫貨分布</div></div>
                    <div style="padding:14px 16px;">
                      <div style="display:flex;align-items:flex-end;gap:8px;height:120px;">
                        ${weekdayCounts.map((n, i) => {
                          const h = Math.round(n / maxWeekday * 100);
                          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
                            <span class="mono" style="font-size:11px;color:var(--txt-2);margin-bottom:2px;">${n}</span>
                            <div style="width:100%;height:${Math.max(h,2)}px;background:var(--accent);opacity:.7;border-radius:3px 3px 0 0;"></div>
                            <span style="font-size:11px;color:var(--txt-3);margin-top:4px;">週${weekdayLabels[i]}</span>
                          </div>`;
                        }).join("")}
                      </div>
                    </div>
                  </div>
                  <div class="sf-card">
                    <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.warn}客訴客戶排名（期間）</div></div>
                    <div style="padding:0;">
                      ${topComplainCustomers.length ? topComplainCustomers.map((c, i) => `
                        <a href="/admin/customers/${encodeURIComponent(c.id)}/360" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);text-decoration:none;color:inherit;font-size:13px;">
                          <span><span class="mono" style="color:var(--txt-3);margin-right:6px;">${String(i+1).padStart(2,"0")}</span>${escapeHtml(c.name)}</span>
                          <span class="sf-pill bad">${c.complaint_count} 筆</span>
                        </a>
                      `).join("") : `<p style="padding:18px;color:var(--ok);text-align:center;font-size:13px;margin:0;">✓ 期間內無客訴</p>`}
                    </div>
                  </div>
                </div>

                <div class="sf-card">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.stop}流失風險客戶（超過 14 天未叫貨）</div><span class="sf-card-sub">依累計訂單數排序，優先關心舊客戶</span></div>
                  <div style="padding:0;">
                    ${churnRisk.length ? `<table class="sf-table" style="font-size:13px;"><thead><tr><th>客戶</th><th>最後叫貨</th><th style="text-align:right;">累計訂單</th><th></th></tr></thead><tbody>${churnRisk.map(c => {
                      const last = new Date(String(c.last_date) + "T00:00:00+08:00");
                      const days = Math.round((new Date(todayIso + "T00:00:00+08:00") - last) / 86400000);
                      return `<tr><td>${escapeHtml(c.name)}</td><td class="mono">${escapeHtml(c.last_date)} <span style="color:var(--bad);">(${days} 天前)</span></td><td style="text-align:right;" class="mono">${c.order_count}</td><td style="text-align:right;"><a href="/admin/customers/${encodeURIComponent(c.id)}/360" class="sf-btn sm">查看</a></td></tr>`;
                    }).join("")}</tbody></table>` : `<p style="padding:18px;color:var(--ok);text-align:center;font-size:13px;margin:0;">✓ 沒有客戶超過 14 天未叫貨</p>`}
                  </div>
                </div>
              </div>`;
            res.type("text/html").send(notionPage("營運分析", body, "analytics", res));
        } catch (e) {
            console.error("[admin] /analytics failed", e);
            res.status(500).send("載入營運分析失敗：" + (e?.message || e));
        }
    });
    // === 忘記叫貨提醒（流失風險清單）===
    router.get("/reminders", async (req, res) => {
        try {
            const todayIso = getTaipeiCalendarDateYYYYMMDD();
            // 單一 aggregate query 取得所有客戶資料（從 30 秒+ 降到 ~1 秒）
            const all = await (0, customer_scoring_js_1.fetchAllCustomerReminderStats)(db, todayIso);
            const totalActive = all.length;
            const rows = [];
            for (const c of all) {
                if (c.daysSinceLastOrder == null || c.avgIntervalDays == null) continue;
                if (c.daysSinceLastOrder <= c.avgIntervalDays * 1.5) continue;
                const { score } = (0, customer_scoring_js_1.computeCustomerScore)({
                    orders90: c.orders90, ordersAll: c.ordersAll, items90: 0,
                    complaintsAll: 0, complaintsOpen: 0,
                    daysSinceLastOrder: c.daysSinceLastOrder, avgIntervalDays: c.avgIntervalDays,
                });
                const tier = (0, customer_scoring_js_1.scoreToTier)(score);
                rows.push({
                    id: c.id, name: c.name,
                    lineGroupId: c.lineGroupId, handoverNotes: c.handoverNotes,
                    daysSince: c.daysSinceLastOrder,
                    avg: c.avgIntervalDays,
                    overdueRatio: c.daysSinceLastOrder / c.avgIntervalDays,
                    lastOrderDate: c.lastOrderDate,
                    orders90: c.orders90, ordersAll: c.ordersAll,
                    score, tier,
                });
            }
            // 依「逾期倍數 × 客戶分」排序（主力客戶且逾期久的優先）
            rows.sort((a, b) => (b.overdueRatio * (b.score / 100)) - (a.overdueRatio * (a.score / 100)));
            const groupedSeverity = {
                critical: rows.filter(r => r.overdueRatio >= 3).length,
                high: rows.filter(r => r.overdueRatio >= 2 && r.overdueRatio < 3).length,
                medium: rows.filter(r => r.overdueRatio >= 1.5 && r.overdueRatio < 2).length,
            };
            const severityPill = (ratio) => {
                if (ratio >= 3) return `<span class="sf-pill bad">嚴重</span>`;
                if (ratio >= 2) return `<span class="sf-pill" style="background:#fee2e2;color:#b91c1c;">高</span>`;
                return `<span class="sf-pill warn">中</span>`;
            };
            const body = `
              <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
                <div>
                  <div class="sf-breadcrumb" style="margin-bottom:6px;">日常作業 / 忘記叫貨提醒</div>
                  <h1 style="margin:0;font-size:22px;font-weight:600;">忘記叫貨提醒</h1>
                  <p style="margin:6px 0 0;color:var(--txt-3);font-size:12px;">客戶有平均叫貨節奏、且距上次叫貨已超過平均間隔 1.5 倍以上時列出。優先順序 = 逾期倍數 × 客戶評分。</p>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                  <div class="sf-card" style="padding:14px 18px;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">需提醒</div>
                    <div class="mono" style="font-size:26px;font-weight:600;">${rows.length}</div>
                    <div style="font-size:12px;color:var(--txt-2);">總啟用客戶 ${totalActive}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;border-left:4px solid var(--bad);">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">嚴重（≥3 倍）</div>
                    <div class="mono" style="font-size:26px;font-weight:600;color:var(--bad);">${groupedSeverity.critical}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;border-left:4px solid #f59e0b;">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">高（2–3 倍）</div>
                    <div class="mono" style="font-size:26px;font-weight:600;color:#b45309;">${groupedSeverity.high}</div>
                  </div>
                  <div class="sf-card" style="padding:14px 18px;border-left:4px solid var(--warn);">
                    <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">中（1.5–2 倍）</div>
                    <div class="mono" style="font-size:26px;font-weight:600;color:var(--warn);">${groupedSeverity.medium}</div>
                  </div>
                </div>
                <div class="sf-card">
                  <div class="sf-card-head"><div class="sf-card-title">${SF_ICONS.clipboard}提醒清單（依優先順序）</div><span class="sf-card-sub">點客戶名跳客戶 360；點「複製訊息」可貼到 LINE 給客戶</span></div>
                  <div style="padding:0;">
                    ${rows.length ? `<div style="overflow-x:auto;"><table class="sf-table" style="font-size:13px;table-layout:fixed;width:100%;">
                      <colgroup>
                        <col style="width:64px;">
                        <col>
                        <col style="width:110px;">
                        <col style="width:80px;">
                        <col style="width:90px;">
                        <col style="width:80px;">
                        <col style="width:60px;">
                        <col style="width:88px;">
                      </colgroup>
                      <thead><tr>
                        <th style="text-align:center;">等級</th>
                        <th>客戶</th>
                        <th>最後叫貨</th>
                        <th style="text-align:right;">已 N 天</th>
                        <th style="text-align:right;">平均間隔</th>
                        <th style="text-align:right;">逾期倍</th>
                        <th style="text-align:center;">分數</th>
                        <th style="text-align:center;"></th>
                      </tr></thead>
                      <tbody>${rows.map(r => `
                      <tr>
                        <td data-label="等級" style="text-align:center;">${severityPill(r.overdueRatio)}</td>
                        <td data-label="客戶" style="overflow:hidden;">
                          <a href="/admin/customers/${encodeURIComponent(r.id)}/360" style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:100%;">${escapeHtml(r.name)}</a>
                          ${r.handoverNotes ? `<div style="font-size:11px;color:var(--txt-3);margin-top:2px;display:flex;align-items:center;gap:4px;overflow:hidden;" title="${escapeAttr(r.handoverNotes)}">${sfInlineIcon('note')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(String(r.handoverNotes).slice(0,40))}${String(r.handoverNotes).length>40?"…":""}</span></div>` : ""}
                        </td>
                        <td data-label="最後叫貨" class="mono" style="color:var(--txt-3);white-space:nowrap;">${escapeHtml(r.lastOrderDate || "—")}</td>
                        <td data-label="已 N 天" style="text-align:right;white-space:nowrap;" class="mono"><strong style="color:var(--bad);">${r.daysSince}</strong></td>
                        <td data-label="平均間隔" style="text-align:right;white-space:nowrap;color:var(--txt-3);" class="mono">${r.avg}</td>
                        <td data-label="逾期倍" style="text-align:right;white-space:nowrap;" class="mono">${r.overdueRatio.toFixed(1)}×</td>
                        <td data-label="分數" style="text-align:center;"><span class="sf-pill" style="background:${r.tier.bg};color:${r.tier.color};font-size:11px;padding:1px 6px;">${r.score}</span></td>
                        <td style="text-align:center;"><button type="button" class="sf-btn sm copy-reminder-btn" data-name="${escapeAttr(r.name)}" data-days="${r.daysSince}" title="複製提醒訊息給客戶">複製</button></td>
                      </tr>`).join("")}</tbody>
                    </table></div>` : `<p style="padding:24px;text-align:center;color:var(--ok);">✓ 目前沒有客戶需要提醒</p>`}
                  </div>
                </div>
              </div>
              <script>
              (function(){
                document.querySelectorAll(".copy-reminder-btn").forEach(btn => {
                  btn.addEventListener("click", function(){
                    const name = btn.dataset.name || "客戶";
                    const days = btn.dataset.days || "";
                    const msg = name + " 老闆好，您已經 " + days + " 天沒有叫貨了，請問今天需要安排送貨嗎？";
                    try {
                      navigator.clipboard.writeText(msg).then(() => {
                        const orig = btn.textContent;
                        btn.textContent = "✓ 已複製";
                        setTimeout(() => btn.textContent = orig, 1500);
                      });
                    } catch (e) {
                      prompt("請手動複製：", msg);
                    }
                  });
                });
              })();
              </script>`;
            res.type("text/html").send(notionPage("忘記叫貨提醒", body, "reminders", res));
        } catch (e) {
            console.error("[admin] /reminders failed", e);
            res.status(500).send("載入提醒清單失敗：" + (e?.message || e));
        }
    });
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
    // ── 每日盤點（LINE 盤點結果總覽）：當日各倉一次列出＋完成比例＋盤差 ──
    function stkAdminTaipeiDate() {
        try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date()); }
        catch (_) { return new Date().toISOString().slice(0, 10); }
    }
    (0, inventory_js_1.registerInventoryRoutes)(router, {
        db,
        notionPage,
        logDataChange,
        loadAdminUsers,
        stkAdminTaipeiDate,
        saveGroupFeatures: (req, res) => saveGroupFeatures(req, res),
        stickyIcpno,
        fmtTaipeiYMDHM,
        STK_STYLE,
        STK_CLIENT_JS,
        barcodeAddModalHtml,
    });
    // ── 群組功能白名單：每個 LINE 群組可分別開關「辨識訂單／盤點／空籃」。無 group_features 列＝三項全開。 ──
    async function loadStocktakeGroupCandidates() {
        const gnorm = (s) => String(s || "").replace(/\s/g, "").toLowerCase();
        const byId = new Map();
        const put = (gid, name, src) => {
            const id = String(gid || "").trim();
            if (!id) return;
            const cur = byId.get(id) || { group_id: id, name: "", sources: new Set() };
            if (name && !cur.name) cur.name = String(name).trim();
            cur.sources.add(src);
            byId.set(id, cur);
        };
        // group_features 為功能設定的權威來源；先收錄所有已設定的群組。
        let featRows = [];
        try { featRows = await db.prepare("SELECT group_id, feat_order, feat_stocktake, feat_basket FROM group_features").all(); } catch (_) { featRows = []; }
        const featMap = new Map((featRows || []).map((r) => [gnorm(r.group_id), r]));
        for (const r of (featRows || [])) put(r.group_id, null, "已設定");
        // 舊盤點群組白名單：作為群組探索來源（行為已改由 group_features 決定）。
        try { const wl = await db.prepare("SELECT group_id, group_name FROM stocktake_group").all(); for (const w of wl) put(w.group_id, w.group_name, "已納入"); } catch (_) {}
        try { const pend = await db.prepare("SELECT group_id, group_name FROM pending_line_groups").all(); for (const p of pend) put(p.group_id, p.group_name, "待綁定"); } catch (_) {}
        try {
            const cust = await db.prepare("SELECT id, name, line_group_id FROM customers WHERE line_group_id IS NOT NULL AND line_group_id <> ''").all();
            for (const c of cust) { put(c.line_group_id, c.name, "客戶群"); const it = byId.get(String(c.line_group_id).trim()); if (it) { it.isCustomer = true; it.customerName = String(c.name || ""); it.customerId = String(c.id || ""); } }
        } catch (_) {}
        const onTrue = (v) => (v == null ? true : !!Number(v));
        const onFalse = (v) => (v == null ? false : !!Number(v));
        return Array.from(byId.values()).map((c) => {
            const fr = featMap.get(gnorm(c.group_id));
            // 無資料列：訂單／空籃預設開、盤點預設關（opt-in 白名單）。
            const feats = fr ? { order: onTrue(fr.feat_order), stocktake: onFalse(fr.feat_stocktake), basket: onTrue(fr.feat_basket) } : { order: true, stocktake: false, basket: true };
            return { ...c, sources: Array.from(c.sources), isCustomer: !!c.isCustomer, feats };
        }).sort((a, b) => (Number(a.isCustomer) - Number(b.isCustomer)) || String(a.name || a.group_id).localeCompare(String(b.name || b.group_id)));
    }
    // [change 2026-07-10] 群組功能整併進「客戶管理」：正式路徑 /admin/customers/groups
    //（收單來源就是 LINE 群組，設定歸客戶主檔）。舊路徑 /admin/inventory/stocktake-groups 轉跳保留。
    const renderGroupFeaturesPage = async (req, res) => {
        const list = await loadStocktakeGroupCandidates();
        const ok = req.query.ok ? `<div style="background:#e7f5e9;color:#2e7d32;padding:10px 12px;border-radius:8px;margin-bottom:16px;">已儲存。</div>` : "";
        const typeTag = (g) => {
            if (g.isCustomer) return `<span style="display:inline-block;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:6px;background:#eef2fb;color:#3457b1;">客戶群${g.customerName ? "：" + (g.customerId ? `<a href="/admin/customers/${encodeURIComponent(g.customerId)}/edit" style="color:inherit;">${escapeHtml(g.customerName)}</a>` : escapeHtml(g.customerName)) : ""}</span>`;
            if (!g.feats.order) return `<span style="display:inline-block;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:6px;background:#e7f6ee;color:#1f7a46;">內部群</span>`;
            return `<span style="display:inline-block;font-size:11.5px;padding:2px 8px;border-radius:6px;background:#eef0f3;color:#5b616e;">一般</span>`;
        };
        const sw = (name, gid, on) => `<label class="sf-switch-label" style="justify-content:center;"><input type="checkbox" name="${name}[${escapeAttr(gid)}]" value="1" ${on ? "checked" : ""}><span class="sf-switch"></span></label>`;
        const rowsHtml = list.map((g) => {
          const typeText = g.isCustomer ? ("客戶群 " + (g.customerName || "")) : (!g.feats.order ? "內部群" : "一般");
          const searchStr = [g.name || "", g.group_id, typeText].join(" ").toLowerCase();
          return `
      <tr class="gf-row" data-search="${escapeAttr(searchStr)}">
        <td>${escapeHtml(g.name || "（未命名群組）")}</td>
        <td style="font-variant-numeric:tabular-nums;color:var(--notion-text-muted);font-size:12px;word-break:break-all;">${escapeHtml(g.group_id)}</td>
        <td>${typeTag(g)}</td>
        <td style="text-align:center;">${sw("order", g.group_id, g.feats.order)}</td>
        <td style="text-align:center;">${sw("stk", g.group_id, g.feats.stocktake)}</td>
        <td style="text-align:center;">${sw("bsk", g.group_id, g.feats.basket)}</td>
        <input type="hidden" name="orig[${escapeAttr(g.group_id)}]" value="${(g.feats.order ? 1 : 0)}${(g.feats.stocktake ? 1 : 0)}${(g.feats.basket ? 1 : 0)}">
      </tr>`;
        }).join("");
        const knownIds = list.map((g) => g.group_id).join(",");
        const body = `
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/customers">客戶管理</a> / 群組功能</div>
      <h1 class="notion-page-title">群組功能</h1>
      <p class="notion-hint" style="margin:-2px 0 18px;">每個 LINE 群組可分別開關三項功能（勾＝開）：<b>辨識訂單</b>＝把一般文字送 AI 當訂單解析（<b>預設開</b>）；<b>盤點</b>＝群內打「<b>#盤點</b>」跳出倉庫盤點按鈕（<b>預設關</b>，白名單制，只有勾選的群組才回應）；<b>空籃</b>＝群內打「空籃」跳出空籃記帳 LIFF（<b>預設開</b>；也收常打錯的「空藍」）。關閉「辨識訂單」的群組＝<b>內部群</b>：機器人仍收訊息、仍回應指令，只是不把文字當訂單。客戶群的功能也可在「<a href="/admin/customers">客戶管理</a> → 編輯客戶」裡設定，兩處同步。清單自動收集機器人所在的群組；若沒出現，先在群裡對機器人傳一句話，或把群組 ID 貼到下方手動加入。</p>
      ${ok}
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <input id="gfSearch" type="text" class="sf-input" placeholder="搜尋群組名稱 / ID / 類型…" autocomplete="off" style="max-width:360px;" oninput="gfFilter(this.value)">
        <span id="gfCount" style="color:var(--notion-text-muted);font-size:12px;"></span>
      </div>
      <form method="post" action="/admin/customers/groups">
        <input type="hidden" name="known_ids" value="${escapeAttr(knownIds)}">
        <div class="notion-card" style="padding:0;overflow:hidden;">
          <table>
            <thead><tr>
              <th>群組名稱</th><th>群組 ID</th><th style="width:130px;">類型</th>
              <th style="text-align:center;width:84px;">辨識訂單</th><th style="text-align:center;width:84px;">盤點</th><th style="text-align:center;width:84px;">空籃</th>
            </tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="6" style="text-align:center;color:var(--notion-text-muted);padding:22px;">還沒有偵測到任何群組。請把機器人加入群組後，於群內傳一句話。</td></tr>'}</tbody>
          </table>
        </div>
        <div class="notion-card" style="margin-top:16px;">
          <h2>手動加入群組 ID</h2>
          <p class="notion-hint" style="margin:-6px 0 10px;">每行一個，選填。新加入的群組預設辨識訂單／空籃開、盤點關，之後可在上表調整。適用於群組沒自動出現時。</p>
          <textarea name="manual_ids" rows="3" placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" class="sf-textarea" style="width:100%;font-family:monospace;font-size:12px;"></textarea>
        </div>
        <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button></p>
      </form>
      <script>
        function gfFilter(q){
          q = (q || '').trim().toLowerCase();
          var rows = document.querySelectorAll('tr.gf-row'), shown = 0;
          rows.forEach(function(r){
            var hit = !q || (r.getAttribute('data-search') || '').indexOf(q) >= 0;
            r.style.display = hit ? '' : 'none';
            if (hit) shown++;
          });
          var c = document.getElementById('gfCount');
          if (c) c.textContent = q ? (shown + ' / ' + rows.length + ' 個群組') : (rows.length + ' 個群組');
        }
        document.addEventListener('DOMContentLoaded', function(){ gfFilter(''); });
      </script>`;
        res.type("text/html").send(notionPage("群組功能", body, "cust-groups", res));
    };
    const saveGroupFeatures = async (req, res) => {
        try {
            const orderMap = (req.body && typeof req.body.order === "object" && req.body.order) ? req.body.order : {};
            const stkMap = (req.body && typeof req.body.stk === "object" && req.body.stk) ? req.body.stk : {};
            const bskMap = (req.body && typeof req.body.bsk === "object" && req.body.bsk) ? req.body.bsk : {};
            const origMap = (req.body && typeof req.body.orig === "object" && req.body.orig) ? req.body.orig : {};
            const knownRaw = String((req.body && req.body.known_ids) || "");
            const manualRaw = String((req.body && req.body.manual_ids) || "");
            // 已列出的群組：用各自的勾選狀態（未勾＝關）；手動新增的群組：預設三項全開。
            // [fix 2026-07-14] 只寫「有變動」的列（比對頁面載入時的 orig 快照）：舊版整表重寫，
            // A 開著總表期間 B 在客戶編輯頁改了某群開關，A 按儲存會把 B 的變更用舊值靜默還原。
            const universe = new Map(); // group_id -> {order,stocktake,basket}
            for (const line of knownRaw.split(/[\r\n,]+/)) {
                const id = line.trim(); if (!id) continue;
                const feats = { order: orderMap[id] === "1", stocktake: stkMap[id] === "1", basket: bskMap[id] === "1" };
                const nowStr = (feats.order ? 1 : 0) + "" + (feats.stocktake ? 1 : 0) + "" + (feats.basket ? 1 : 0);
                const origStr = typeof origMap[id] === "string" ? origMap[id].trim() : null;
                if (origStr !== null && origStr === nowStr) continue; // 這列沒動過 → 不覆寫
                universe.set(id, feats);
            }
            for (const line of manualRaw.split(/[\r\n,]+/)) {
                const id = line.trim(); if (!id || universe.has(id)) continue;
                universe.set(id, { order: true, stocktake: false, basket: true });
            }
            for (const [gid, feats] of universe) {
                await setGroupFeaturesAudited(req, gid, feats, "群組功能總表");
            }
            res.redirect("/admin/customers/groups?ok=1");
        }
        catch (e) {
            console.error("[admin] group-features save", e?.message || e);
            res.status(500).send("儲存失敗：" + String(e?.message || e));
        }
    };
    router.get("/customers/groups", renderGroupFeaturesPage);
    router.post("/customers/groups", express_1.default.urlencoded({ extended: true }), saveGroupFeatures);
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
    // 拆檔批次 4：物流域路由搬至 ./logistics.js（原位註冊，順序不變）
    (0, logistics_js_1.registerLogisticsRoutes)(router, {
        db, notionPage, getTaipeiCalendarDateYYYYMMDD, uploadImageSafe,
    });
    /** 將已解析列寫入訂單（先刪除既有品項）。 */
    async function replaceOrderItemsFromParsedRows(orderId, customerId, parsed) {
        await (0, rebuild_order_from_sources_js_1.replaceOrderItemsFromParsedRows)(db, orderId, customerId, parsed);
    }
    /** 依全文解析並重建訂單明細（先刪除既有品項）。rawText 須為非空字串。 */
    /**
     * 依客戶路線把空籃（號碼籃 + 四角籃 C0100065）補回訂單。
     * 與 webhook 收單時的邏輯一致；後台「重新辨識／補登」會清空並重建品項，
     * 若不補回，路線空籃與四角空籃就會消失，故重建成功後呼叫此函式還原。
     */
    async function insertRouteEmptyBaskets(orderId, customerId) {
        if (!orderId || !customerId)
            return;
        // [fix 2026-07-08] 改為委派給 lib/empty-baskets.js（webhook 收單也用同一支），
        // 空籃料號對映（查表，跳過4號籃）只維護一處，不再有多份複本可各自壞掉。
        // 過去這裡是一份獨立複本，且在未提交工作合併時被蓋回舊的 56+路線 連號公式（5-9號線對錯籃）。
        await empty_baskets_js_1.insertEmptyBaskets(db, customerId, [orderId]);
    }
    async function rebuildOrderItemsFromRawText(orderId, customerId, rawText) {
        const rawTrim = String(rawText || "").trim();
        if (!rawTrim)
            return { ok: false, error: "empty" };
        const r = await (0, rebuild_order_from_sources_js_1.rebuildOrderItemsFromOrderSources)(db, orderId, customerId, rawTrim, []);
        if (r && r.ok)
            await insertRouteEmptyBaskets(orderId, customerId);
        return r;
    }
    /**
     * 後台「重新辨識」：文字略過僅含「[圖片]」的行後再解析，並對 order_attachments 逐張向 LINE 取圖，
     * 與 webhook 相同流程（OCR → 規則 → Gemini 文字 → Gemini 視覺）。
     */
    async function rebuildOrderItemsForReRecognize(orderId, customerId, rawMessage, attachmentRows, imageExtraOpts) {
        const result = await (0, rebuild_order_from_sources_js_1.rebuildOrderItemsFromOrderSources)(db, orderId, customerId, rawMessage, attachmentRows, imageExtraOpts);
        if (result.ok) {
            await insertRouteEmptyBaskets(orderId, customerId);
            return { ok: true };
        }
        return { ok: false, error: result.error || "parse" };
    }
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
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 冷凍庫冷藏庫檢查表</div>
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
          <h2 style="margin-top:0;">${sfInlineIcon("warn")} 仍顯示「尚未綁定」請先確認</h2>
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
        res.type("text/html").send(notionPage("LINE 綁定檢查", body, "line-bind", res));
    });
    // 待確認品名：列出 need_review=1 的明細，可選擇對應品項並加入俗名
    router.get("/review", async (req, res) => {
        const msg = req.query.ok === "1" ? "<p style='color:green'>已加入對照。</p>"
            : req.query.err === "dup" ? "<p style='color:red'>此俗名已存在，請勿重複新增。</p>"
            : req.query.err === "missing" ? "<p style='color:red'>尚未選擇對應品項：請先在搜尋框輸入品名或料號，並「點選」下拉清單中的品項，再按「加入對照」。</p>"
            : "";
        const rows = await db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.order_id, o.customer_id, c.name AS customer_name
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN customers c ON c.id = o.customer_id
      WHERE oi.need_review = 1 AND oi.voided_at IS NULL
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
            <form action="/admin/alias" method="post" class="review-alias-form" style="display:inline;" onsubmit="if(!this.querySelector('.review-product-id').value){alert('請先從下拉清單點選一個品項，再按「加入對照」');return false;}return true;">
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
                  var nmEsc = (p.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                  var ecEsc = (p.erp_code || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                  return '<div class="review-product-opt" data-id="' + (p.id || '') + '" data-name="' + nmEsc + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--notion-border);font-size:13px;">' + nmEsc + (ecEsc ? ' \uFF08' + ecEsc + '\uFF09' : '') + '</div>';
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
                // [fix 2026-07-27 體檢] 冪等：product_aliases 無唯一鍵，重按/重整表單會長出同 alias 多列，
                // resolve 時同名多列取值不定（同一句俗名有時對到 A 有時對到 B）。已有同 (product_id, alias) 就跳過。
                const dup = await db.prepare("SELECT id FROM product_aliases WHERE product_id = ? AND alias = ?").get(product_id, aliasTrim);
                if (!dup) {
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
            }
            else if (customer_id) {
                // [fix 2026-07-27 體檢] 同上冪等防重；並補稽核軌跡（舊版只有全域分支有 logDataChange，
                // 客戶專用別名 resolve 優先級最高、建立卻完全無軌跡）。
                const dupC = await db.prepare("SELECT id FROM customer_product_aliases WHERE customer_id = ? AND product_id = ? AND alias = ?").get(customer_id, product_id, aliasTrim);
                if (!dupC) {
                    const id = (0, id_js_1.newId)("cpa");
                    await db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(id, customer_id, product_id, aliasTrim);
                    await logDataChange(req, {
                        entityType: "customer_product_alias",
                        entityId: id,
                        productId: product_id,
                        action: "create",
                        summary: `新增客戶專用俗名「${aliasTrim}」（POST /alias）`,
                        meta: { alias: aliasTrim, customer_id, via: "alias_form" },
                    });
                }
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
        // 改成作廢（軟刪除）：待對應的品項按「移除」時，視為 AI 辨識錯誤而留檔
        const isPg = Boolean(process.env.DATABASE_URL);
        const nowSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
        const actor = req.adminUsername || "system";
        const snap = await db.prepare("SELECT id, order_id, raw_name, quantity, unit, product_id, voided_at FROM order_items WHERE id = ? AND need_review = 1").get(itemId);
        if (snap && !snap.voided_at) {
            await db.prepare(
                "UPDATE order_items SET voided_at = " + nowSql + ", voided_by = ?, void_reason = ?, void_note = ? WHERE id = ? AND need_review = 1"
            ).run(actor, "ai_wrong", "（從待對應清單作廢）", itemId);
            try {
                await logDataChange(req, {
                    entityType: "order_item",
                    entityId: itemId,
                    productId: snap.product_id ?? null,
                    action: "void",
                    summary: `從待對應清單作廢品項：${snap.raw_name || "(無品名)"} ${snap.quantity ?? ""}${snap.unit ?? ""}`,
                    meta: { order_id: snap.order_id, snapshot: snap, void_reason: "ai_wrong", source: "/review/delete-item" },
                });
            } catch (_) {}
        }
        res.redirect("/admin/review?ok=1");
    });
    // 拆檔批次 5：訂單三域共用 ctx（只傳跨域共用者；訂單專屬 helper 已隨路由搬走）
    const ORDERS_CTX = {
        db, notionPage, logDataChange, loadAdminUsers, getTaipeiCalendarDateYYYYMMDD,
        fmtTaipeiYMDHM, fmtTaipeiMMDDHHmm, voidReasonModalHtml, ORDER_LINE_UNITS,
        formatOrderDateForLingyue, rebuildOrderItemsFromRawText, rebuildOrderItemsForReRecognize,
        buildLingyuePreview, runLingyueWrite, parseKnownSubCustomerLabelsForSelect,
        resolveSplitTargetOrder, getNextOrderNoAdmin,
    };
    // 拆檔批次 5：訂單域路由搬至 ./orders.js（原不連續的六個區塊在此一次註冊；
    // 已用 URL 比對等價性驗證每個 URL 命中的 handler 與拆前相同）
    (0, orders_js_1.registerOrdersRoutes)(router, ORDERS_CTX);
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
        res.type("text/html").send(notionPage("資料匯出", body, "export", res));
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
        const fullList = await db.prepare(activeOnly
            ? "SELECT id, name, erp_code, teraoka_barcode FROM products WHERE (active IS NULL OR active = 1) ORDER BY name"
            : "SELECT id, name, erp_code, teraoka_barcode FROM products ORDER BY name").all();
        let list = fullList || [];
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
            if (filtered.length > 0) {
                filtered.sort((a, b) => fuzzyProductScore(b, q) - fuzzyProductScore(a, q));
                list = filtered;
            }
            else {
                const scored = list
                    .map((p) => ({ p, s: fuzzyProductScore(p, q) }))
                    .filter((x) => x.s >= 650)
                    .sort((a, b) => b.s - a.s)
                    .map((x) => x.p);
                list = scored;
            }
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
    router.get("/lingyue-writeback/pending", async (req, res) => {
        try {
            const dateParam = (typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date.trim()))
                ? req.query.date.trim()
                : getTaipeiCalendarDateYYYYMMDD();
            const scopeAll = String(req.query.scope || "") === "all";
            const orderRows = await db.prepare(`
        SELECT o.id, o.order_no, o.order_date, o.remark, c.name AS customer_name, c.hq_cust_code, c.teraoka_code
        FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE o.order_date = ?
          AND COALESCE(LOWER(TRIM(o.status)), '') <> 'deleted'
          AND o.lingyue_written_at IS NULL
          ${scopeAll ? "" : "AND o.lingyue_queued_at IS NOT NULL"}
        ORDER BY o.order_date ASC, o.order_no ASC, o.id ASC
      `).all(dateParam);
            const orders = [];
            for (const order of orderRows || []) {
                const customerCode = (order.hq_cust_code && String(order.hq_cust_code).trim())
                    || (order.teraoka_code && String(order.teraoka_code).trim()) || "";
                const itemRows = await db.prepare(`
        SELECT oi.quantity, oi.unit, oi.remark, oi.raw_name, p.erp_code, p.name AS product_name
        FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1)
          AND oi.voided_at IS NULL
        ORDER BY COALESCE(oi.display_order, 999999), oi.id
      `).all(order.id);
                const items = (itemRows || []).map((it) => {
                    const qtyNum = it.quantity != null ? Number(it.quantity) : NaN;
                    return {
                        product_code: (it.erp_code && String(it.erp_code).trim()) || "",
                        product_name: (it.product_name && String(it.product_name).trim())
                            || (it.raw_name && String(it.raw_name).trim()) || "",
                        unit: (it.unit && String(it.unit).trim()) || "公斤",
                        quantity: Number.isFinite(qtyNum) ? qtyNum : null,
                        item_note: (it.remark && String(it.remark).trim()) || "",
                    };
                });
                if (!items.length)
                    continue;
                orders.push({
                    order_id: order.id,
                    order_no: order.order_no || null,
                    order_date: formatOrderDateForLingyue(order.order_date),
                    customer_code: customerCode,
                    customer_name: order.customer_name || "",
                    doc_remark: (order.remark && String(order.remark).trim()) || "",
                    items,
                });
            }
            res.json({ date: dateParam, scope: scopeAll ? "all" : "queued", count: orders.length, orders });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/pending", e?.message || e);
            res.status(500).json({ error: "pending 取得失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * GET /admin/lingyue-writeback/wait?timeout=25
     *   長連線等待（long-poll）：內網 agent 掛一條線等待「使用者已在網站點『轉入凌越』」的排隊訂單。
     *   有排隊單（lingyue_queued_at 非空且尚未回寫）立刻回傳；否則 hold 到 timeout 秒（預設 25、上限 50）才回空。
     *   agent 拿到後寫入凌越，再用 callback 回填單號（回填後 lingyue_written_at 非空，即退出佇列）。
     */
    router.get("/lingyue-writeback/wait", async (req, res) => {
        let timeoutSec = parseInt(String(req.query.timeout || "25"), 10);
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0)
            timeoutSec = 25;
        if (timeoutSec > 50)
            timeoutSec = 50;
        const deadline = Date.now() + timeoutSec * 1000;
        // [fix 2026-07-08] 認領租約：過去 /wait 對「已排隊未回寫」的單無條件回傳，
        // 多個 agent 或 agent 重啟同時 /wait 會拿到同一批單 → 各自寫入凌越 → 重複開單。
        // 改成每張單先用條件式 UPDATE 蓋 claimed_at 認領；只有 changes=1（本次真的搶到）才回傳。
        // 租約期間其他 /wait 不會再撿到同一張；agent 若掛掉沒回填，租約到期後自動重新可撿（自帶重試）。
        // [fix 2026-07-10] 租約 90 秒 → 10 分鐘：一批單最壞寫入時間（凌越 SOAP 逐張寫＋逐張查倉別）
        // 遠超 90 秒，租約先過期＝別條 /wait 重撿同單＝重複開單。10 分鐘涵蓋最壞批次＋回報時間。
        // 同時單批上限 20 → 5（下方 SQL LIMIT）：縮短「已寫入凌越、尚未回填」的風險窗口。
        const LEASE_MS = 600000;
        try {
            // [ops 2026-07-10] 心跳：記錄內網代理最後一次連上 /wait 的時間（後台庫存頁顯示「內網代理最後連線」）。
            try {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("ly_agent_last_wait_at", new Date().toISOString());
            }
            catch (_) { /* 心跳寫入失敗不影響主流程 */ }
            while (true) {
                const claimBefore = new Date(Date.now() - LEASE_MS).toISOString();
                const rows = await db.prepare(`
          SELECT o.id, o.order_no, o.order_date, o.remark, o.lingyue_queued_at, c.name AS customer_name, c.hq_cust_code, c.teraoka_code
          FROM orders o JOIN customers c ON c.id = o.customer_id
          WHERE o.lingyue_queued_at IS NOT NULL
            AND o.lingyue_written_at IS NULL
            AND COALESCE(LOWER(TRIM(o.status)), '') <> 'deleted'
            AND (o.lingyue_claimed_at IS NULL OR o.lingyue_claimed_at < ?)
          ORDER BY o.lingyue_queued_at ASC, o.id ASC
          LIMIT 5
        `).all(claimBefore);
                if (rows && rows.length) {
                    const orders = [];
                    for (const order of rows) {
                        // 條件式認領：單一 UPDATE 語句在 pg/sqlite 皆為原子，兩個並發只會有一個 changes=1。
                        const nowIso = new Date().toISOString();
                        const claim = await db.prepare(
                            "UPDATE orders SET lingyue_claimed_at = ? WHERE id = ? AND lingyue_written_at IS NULL AND (lingyue_claimed_at IS NULL OR lingyue_claimed_at < ?)"
                        ).run(nowIso, order.id, claimBefore);
                        if (!claim || Number(claim.changes || 0) !== 1)
                            continue; // 已被別的 agent 認領
                        const preview = await buildLingyuePreview(order);
                        if (preview.items.length) {
                            preview.queued_at = order.lingyue_queued_at ? String(order.lingyue_queued_at) : "";
                            orders.push(preview);
                        }
                        else {
                            // 無可轉品項（全作廢等）：釋放認領，避免佔住租約
                            await db.prepare("UPDATE orders SET lingyue_claimed_at = NULL WHERE id = ?").run(order.id);
                        }
                    }
                    if (orders.length) {
                        res.json({ count: orders.length, orders });
                        return;
                    }
                }
                if (Date.now() >= deadline) {
                    res.json({ count: 0, orders: [] });
                    return;
                }
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/wait", e?.message || e);
            res.status(500).json({ error: "wait 失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * POST /admin/lingyue-writeback/callback
     *   body: { "results": [ { "order_id": "...", "doc_no": "凌越單據號", "ok": true, "error": "" }, ... ] }
     *   把凌越寫入後回傳的單據號回填到 orders.lingyue_doc_no，並記錄 lingyue_written_at。
     *   ok=false 或缺 doc_no 的項目視為失敗，不標記為已回寫（會在下次 pending 再次出現）。
     */
    router.post("/lingyue-writeback/callback", express_1.default.json({ limit: "2mb" }), async (req, res) => {
        try {
            const results = Array.isArray(req.body?.results) ? req.body.results : null;
            if (!results) {
                res.status(400).json({ error: "缺少 results 陣列" });
                return;
            }
            const now = new Date().toISOString();
            const updated = [];
            const failed = [];
            for (const r of results) {
                const orderId = String(r?.order_id || "").trim();
                const docNo = r?.doc_no != null ? String(r.doc_no).trim() : "";
                const ok = r?.ok !== false;
                if (!orderId) {
                    failed.push({ order_id: r?.order_id ?? null, reason: "缺少 order_id" });
                    continue;
                }
                if (!ok || !docNo) {
                    // [fix 2026-07-08] 失敗出口：記錄錯誤。permanent（如缺料號）或累計 >=3 次即移出佇列（清 queued/claimed），
                    // 否則保留佇列讓租約到期後自動重試（不清 claimed_at＝維持租約節流，不狂重試）。
                    const errMsg = (r?.error ? String(r.error) : "寫入未成功或缺少 doc_no").slice(0, 500);
                    const permanent = r?.permanent === true;
                    try {
                        const cur = await db.prepare("SELECT COALESCE(lingyue_write_attempts, 0) AS n, order_no FROM orders WHERE id = ?").get(orderId);
                        const n = (cur?.n || 0) + 1;
                        if (permanent || n >= 3) {
                            await db.prepare("UPDATE orders SET lingyue_write_attempts = ?, lingyue_last_error = ?, lingyue_queued_at = NULL, lingyue_claimed_at = NULL WHERE id = ?").run(n, errMsg, orderId);
                            // [ops 2026-07-10] 三振出局（或永久失敗）＝移出佇列後不會再自動重試，推播告警提醒人工處理。
                            ops_notify_js_1.notifyOps(db, `凌越回寫失敗已移出佇列（${permanent ? "永久錯誤" : `已重試 ${n} 次`}）：訂單 ${cur?.order_no || orderId}，錯誤：${errMsg.slice(0, 200)}`).catch(() => { });
                        }
                        else {
                            await db.prepare("UPDATE orders SET lingyue_write_attempts = ?, lingyue_last_error = ? WHERE id = ?").run(n, errMsg, orderId);
                        }
                    }
                    catch (_) { /* 記錄失敗不影響其他項回填 */ }
                    failed.push({ order_id: orderId, reason: errMsg, permanent, exited_queue: permanent });
                    continue;
                }
                try {
                    // [fix 2026-07-10] 冪等防護：agent 可能因 callback 失敗而重送（journal 重播）。
                    //  - 已有相同 doc_no → 視為冪等成功，不再覆寫（保留原 written_at）。
                    //  - 已有「不同」doc_no → 衝突（可能重複開單）：不覆蓋，記 lingyue_last_error ＋推播告警，人工到凌越核對。
                    const cur = await db.prepare("SELECT lingyue_doc_no, order_no FROM orders WHERE id = ?").get(orderId);
                    if (!cur) {
                        failed.push({ order_id: orderId, reason: "查無此訂單" });
                        continue;
                    }
                    const existing = cur.lingyue_doc_no != null ? String(cur.lingyue_doc_no).trim() : "";
                    if (existing && existing === docNo) {
                        updated.push({ order_id: orderId, doc_no: docNo, idempotent: true });
                        continue;
                    }
                    if (existing && existing !== docNo) {
                        const conflictMsg = `凌越單號衝突：後台已記 ${existing}，agent 又回報 ${docNo}（未覆蓋）。可能重複開單，請到凌越核對並刪除多餘的單。`;
                        console.error("[admin] lingyue-writeback/callback 單號衝突", orderId, "existing=", existing, "incoming=", docNo);
                        await db.prepare("UPDATE orders SET lingyue_last_error = ? WHERE id = ?").run(conflictMsg.slice(0, 500), orderId);
                        ops_notify_js_1.notifyOps(db, `訂單 ${cur.order_no || orderId} ${conflictMsg}`).catch(() => { });
                        failed.push({ order_id: orderId, reason: conflictMsg, conflict: true });
                        continue;
                    }
                    // 成功：回填單號＋時間，並清掉失敗計數/錯誤與認領。
                    const ret = await db.prepare("UPDATE orders SET lingyue_doc_no = ?, lingyue_written_at = ?, lingyue_last_error = NULL, lingyue_write_attempts = 0, lingyue_claimed_at = NULL WHERE id = ?").run(docNo, now, orderId);
                    if (ret && (ret.changes === 0)) {
                        failed.push({ order_id: orderId, reason: "查無此訂單" });
                        continue;
                    }
                    updated.push({ order_id: orderId, doc_no: docNo });
                }
                catch (e) {
                    failed.push({ order_id: orderId, reason: String(e?.message || e) });
                }
            }
            res.json({ updated_count: updated.length, failed_count: failed.length, updated, failed });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/callback", e?.message || e);
            res.status(500).json({ error: "callback 失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * 目前庫存快照 — 機器對機器端點（內網 agent 用，X-Writeback-Key 認證）。
     *
     * POST /admin/lingyue-writeback/inventory-push
     *   body: { icpno, snapshot_at, items: [{ code, name, spec, unit, qty, wh_code }, ...] }
     *   內網 agent 用 ly_query_stock.py --all 撈整張貨品主檔的 SK_NOWQTY，整批推上來 → 全表覆蓋。
     */
    router.post("/lingyue-writeback/inventory-push", express_1.default.json({ limit: "16mb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const items = Array.isArray(body.items) ? body.items : null;
            if (!items) {
                res.status(400).json({ error: "缺少 items 陣列" });
                return;
            }
            const icpno = String(body.icpno || "00").trim() || "00";
            // 守門：只收兩位數公司代碼。內網 GUI 的 first_icpno() 理應擋掉 "all"/"00,02"，
            // 但伺服器端也要有防線——一旦以 icpno='all' 落庫，按公司查詢全看不到、
            // 不帶過濾的讀取又會與 '00' 真資料互相污染。
            if (!/^\d{2}$/.test(icpno)) {
                res.status(400).json({ error: `icpno 格式錯誤：收到 "${icpno}"，此端點只接受單一兩位數公司代碼（如 00/02）。請檢查內網代理 LY_ICPNO 設定——多公司請由代理逐家推送，不要把 "all" 或逗號清單傳進來。` });
                return;
            }
            const snapshotAt = (typeof body.snapshot_at === "string" && body.snapshot_at.trim())
                ? body.snapshot_at.trim() : new Date().toISOString();
            const rows = [];
            for (const it of items) {
                const code = String(it?.code ?? it?.erp_code ?? "").trim();
                if (!code)
                    continue;
                const qtyNum = Number(it?.qty);
                rows.push([
                    code,
                    String(it?.name ?? "").trim(),
                    String(it?.spec ?? "").trim(),
                    String(it?.unit ?? "").trim(),
                    Number.isFinite(qtyNum) ? qtyNum : 0,
                    String(it?.wh_code ?? "").trim(),
                    icpno,
                    snapshotAt,
                ]);
            }
            // [分倉庫存 2026-07-10] 頂層 warehouse_qty（來自 ly_stock_push.py 查 000009）：
            // 「欄位存在且為陣列」＝本批有分倉資料 → 同一交易內全表覆蓋 erp_stock_wh_qty；
            // 欄位不存在（內網查 000009 失敗/無資料時保證完全不帶）→ 完全不動該表，保留上一份分倉快照。
            // 用 Map 以 (erp_code, wh_code) 去重（後者蓋前者），避免 payload 重複列撞 PK。
            const hasWhQty = Array.isArray(body.warehouse_qty);
            let whRows = null;
            if (hasWhQty) {
                const whMap = new Map();
                for (const w of body.warehouse_qty) {
                    const c = String(w?.erp_code ?? "").trim();
                    const wc = String(w?.wh_code ?? "").trim();
                    if (!c || !wc)
                        continue;
                    const q = Number(w?.qty);
                    whMap.set(c + " " + wc, [c, wc, Number.isFinite(q) ? q : 0, snapshotAt]);
                }
                whRows = Array.from(whMap.values());
            }
            // [未來銷貨加回 2026-07-17] 頂層 future_sales（來自 ly_stock_push.py 查未來日期 A1−A2 淨量）：
            // 「欄位存在且為陣列」＝本批查詢成功 → 同交易內按公司覆蓋 erp_future_sales（含空陣列＝清空該公司加回）；
            // 欄位不存在（查詢失敗/舊代理未帶）→ 完全不動該表，保留上一份加回。用 Map 以 erp_code 去重。
            const hasFut = Array.isArray(body.future_sales);
            let futRows = null;
            if (hasFut) {
                const futMap = new Map();
                for (const f of body.future_sales) {
                    const c = String(f?.erp_code ?? f?.code ?? "").trim();
                    if (!c)
                        continue;
                    const q = Number(f?.qty);
                    futMap.set(c, [c, Number.isFinite(q) ? q : 0, snapshotAt]);
                }
                futRows = Array.from(futMap.values());
            }
            // [fix 2026-07-08] 全表覆蓋（DELETE + 分批 INSERT + meta 更新）包進單一交易：
            // 過去無交易，推送中途失敗（網路斷、pool 瞬斷）會留下「半空的庫存表」且快照時間未更新，
            // 使用者看到的是殘缺庫存卻無從察覺；交易失敗整批回滾＝保留上一份完整快照。
            // 多公司：只覆蓋該次推送的公司（icpno），其他公司的快照不動。
            const doReplace = async (h) => {
                await h.prepare("DELETE FROM erp_stock_items WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").run(icpno);
                const CHUNK = 100;
                for (let i = 0; i < rows.length; i += CHUNK) {
                    const chunk = rows.slice(i, i + CHUNK);
                    const ph = chunk.map(() => "(?,?,?,?,?,?,?,?)").join(",");
                    const flat = [];
                    for (const r of chunk)
                        flat.push(...r);
                    await h.prepare("INSERT INTO erp_stock_items (erp_code, name, spec, unit, qty, wh_code, icpno, updated_at) VALUES " + ph).run(...flat);
                }
                // 每日庫存快照（供盤點「必盤」判定＋統計圖表 K 線）：同交易內，一天一份、最後一次推送為準（先刪今天這家再整批插）。
                // [統計圖表 2026-07-16] K 線 OHLC：開＝當日第一次推送時的「昨日收」（無昨日快照＝當次量）；
                // 高/低＝當日所有推送觀測到的極值（含開）；qty＝收（最後推送量）。同日重推保留既有 open、只擴 high/low。
                const dailySnapDate = stkAdminTaipeiDate();
                const todayOhlc = new Map(); // erp_code -> {open,hi,lo}
                try {
                    for (const t of (await h.prepare("SELECT erp_code, qty_open, qty_high, qty_low FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").all(icpno, dailySnapDate)) || [])
                        todayOhlc.set(String(t.erp_code), { open: Number(t.qty_open), hi: Number(t.qty_high), lo: Number(t.qty_low) });
                } catch (_) { /* 舊庫尚無 OHLC 欄時視同全新一天 */ }
                const ydayClose = new Map(); // erp_code -> 昨收
                try {
                    const pv = await h.prepare("SELECT MAX(snap_date) AS d FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date < ?").get(icpno, dailySnapDate);
                    if (pv && pv.d) {
                        for (const r0 of (await h.prepare("SELECT erp_code, qty FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").all(icpno, String(pv.d))) || [])
                            ydayClose.set(String(r0.erp_code), Number(r0.qty));
                    }
                } catch (_) { /* 無昨日快照＝open 退回當次量 */ }
                const mergeOhlc = (exist, yday, qty) => {
                    const open = (exist && Number.isFinite(exist.open)) ? exist.open : (Number.isFinite(yday) ? yday : qty);
                    const hi = Math.max(Number.isFinite(exist?.hi) ? exist.hi : -Infinity, qty, open);
                    const lo = Math.min(Number.isFinite(exist?.lo) ? exist.lo : Infinity, qty, open);
                    return [open, hi, lo];
                };
                await h.prepare("DELETE FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").run(icpno, dailySnapDate);
                for (let i = 0; i < rows.length; i += CHUNK) {
                    const chunk = rows.slice(i, i + CHUNK);
                    const ph = chunk.map(() => "(?,?,?,?,?,?,?,?)").join(",");
                    const flat = [];
                    for (const r of chunk) { // r = [code,name,spec,unit,qty,wh_code,icpno,at]；qty=r[4]
                        const [o, hi, lo] = mergeOhlc(todayOhlc.get(r[0]), ydayClose.get(r[0]), r[4]);
                        flat.push(icpno, r[0], dailySnapDate, r[4], o, hi, lo, snapshotAt);
                    }
                    await h.prepare("INSERT INTO erp_stock_daily (icpno, erp_code, snap_date, qty, qty_open, qty_high, qty_low, updated_at) VALUES " + ph).run(...flat);
                }
                try { // 只留近 90 天（統計圖表月 K 需要較長歷史），避免無限成長
                    const pruneBefore = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - 90 * 86400000));
                    await h.prepare("DELETE FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date < ?").run(icpno, pruneBefore);
                    await h.prepare("DELETE FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date < ?").run(icpno, pruneBefore);
                } catch (_) { /* prune 失敗不影響推送 */ }
                // 分倉快照：同交易內覆蓋（失敗整批回滾，與主表一致）；沒帶 warehouse_qty 就跳過不動。
                // [fix 2026-07-14] 多公司安全改為「按公司覆蓋」：凌越倉號可跨公司重複（erp_warehouse
                // 已是 (icpno, code) 主鍵），舊版只以倉別清會把別家公司同倉號的列一起刪掉。
                if (whRows) {
                    await h.prepare("DELETE FROM erp_stock_wh_qty WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").run(icpno);
                    const WCHUNK = 50;
                    for (let i = 0; i < whRows.length; i += WCHUNK) {
                        const chunk = whRows.slice(i, i + WCHUNK);
                        const ph = chunk.map(() => "(?,?,?,?,?)").join(",");
                        const flat = [];
                        for (const r of chunk)
                            flat.push(icpno, ...r);
                        await h.prepare("INSERT INTO erp_stock_wh_qty (icpno, erp_code, wh_code, qty, updated_at) VALUES " + ph).run(...flat);
                    }
                    await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_wh_snapshot_at", snapshotAt);
                    // [統計圖表 2026-07-16] 分倉每日快照＋OHLC（K 線分倉檢視）：與公司層級同一套規則。
                    const whKey = (c, wc) => c + "" + wc;
                    const whTodayOhlc = new Map();
                    try {
                        for (const t of (await h.prepare("SELECT erp_code, wh_code, qty_open, qty_high, qty_low FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").all(icpno, dailySnapDate)) || [])
                            whTodayOhlc.set(whKey(String(t.erp_code), String(t.wh_code)), { open: Number(t.qty_open), hi: Number(t.qty_high), lo: Number(t.qty_low) });
                    } catch (_) { }
                    const whYdayClose = new Map();
                    try {
                        const pvw = await h.prepare("SELECT MAX(snap_date) AS d FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date < ?").get(icpno, dailySnapDate);
                        if (pvw && pvw.d) {
                            for (const r0 of (await h.prepare("SELECT erp_code, wh_code, qty FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").all(icpno, String(pvw.d))) || [])
                                whYdayClose.set(whKey(String(r0.erp_code), String(r0.wh_code)), Number(r0.qty));
                        }
                    } catch (_) { }
                    await h.prepare("DELETE FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").run(icpno, dailySnapDate);
                    for (let i = 0; i < whRows.length; i += WCHUNK) {
                        const chunk = whRows.slice(i, i + WCHUNK);
                        const ph = chunk.map(() => "(?,?,?,?,?,?,?,?,?)").join(",");
                        const flat = [];
                        for (const r of chunk) { // r = [erp_code, wh_code, qty, at]
                            const k = whKey(r[0], r[1]);
                            const [o, hi, lo] = mergeOhlc(whTodayOhlc.get(k), whYdayClose.get(k), r[2]);
                            flat.push(icpno, r[1], r[0], dailySnapDate, r[2], o, hi, lo, snapshotAt);
                        }
                        await h.prepare("INSERT INTO erp_stock_wh_daily (icpno, wh_code, erp_code, snap_date, qty, qty_open, qty_high, qty_low, updated_at) VALUES " + ph).run(...flat);
                    }
                }
                // [未來銷貨加回] future_sales 帶陣列（即使空）＝本批查詢成功 → 按公司覆蓋（空＝清空該公司加回，
                // 表示已無未來銷貨、加回歸零）；沒帶＝查詢失敗/舊代理，上面 futRows 為 null 完全不動、保留上一份。
                if (futRows) {
                    await h.prepare("DELETE FROM erp_future_sales WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").run(icpno);
                    const FCHUNK = 100;
                    for (let i = 0; i < futRows.length; i += FCHUNK) {
                        const chunk = futRows.slice(i, i + FCHUNK);
                        const ph = chunk.map(() => "(?,?,?,?)").join(",");
                        const flat = [];
                        for (const r of chunk)
                            flat.push(icpno, ...r); // r = [erp_code, qty, at]
                        await h.prepare("INSERT INTO erp_future_sales (icpno, erp_code, qty, updated_at) VALUES " + ph).run(...flat);
                    }
                    await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_future_sales_snapshot_at", snapshotAt);
                }
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_snapshot_at", snapshotAt);
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_item_count", String(rows.length));
                // 每家公司各自的快照時間/筆數（顯示用；legacy 兩鍵維持＝最後一次推送）
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_snapshot_at_" + icpno, snapshotAt);
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_item_count_" + icpno, String(rows.length));
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_status", "done");
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_requested_at", "");
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_error", "");
            };
            if (typeof db.transaction === "function")
                await db.transaction(doReplace);
            else
                await doReplace(db);
            console.log("[admin] inventory-push 完成：items", rows.length, "筆；warehouse_qty", whRows ? whRows.length + " 筆（分倉快照已覆蓋）" : "未帶（分倉快照保留上一份）", "；future_sales", futRows ? futRows.length + " 筆（未來銷貨加回已覆蓋）" : "未帶（加回保留上一份）");
            res.json({ ok: true, count: rows.length, warehouse_qty_count: whRows ? whRows.length : null, future_sales_count: futRows ? futRows.length : null, snapshot_at: snapshotAt });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/inventory-push", e?.message || e);
            // [ops 2026-07-10] 庫存推送失敗＝後台庫存可能過期，推播告警（交易已回滾、保留上一份快照）。
            ops_notify_js_1.notifyOps(db, `凌越庫存推送（inventory-push）失敗：${String(e?.message || e).slice(0, 200)}`).catch(() => { });
            res.status(500).json({ error: "inventory-push 失敗", detail: String(e?.message || e) });
        }
    });
    // ============================================================
    //  每日帳款收款（Phase 1：取單上雲 + 銷貨單總計表）
    //  資料源：凌越銷貨單(0000A1) 主表 + 客戶主檔(00000D) 結帳方式(CT_FKFS)，
    //  由內網代理 scripts/ly_sales_push.py 推上雲（air-gap，雲端連不到凌越）。
    // ============================================================
    // 內網推當日銷貨單上雲（機器對機器，X-Writeback-Key，走上方 /lingyue-writeback/ 中介層）
    router.post("/lingyue-writeback/cash-ingest", express_1.default.json({ limit: "16mb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const docs = Array.isArray(body.docs) ? body.docs : null;
            if (!docs) {
                res.status(400).json({ error: "缺少 docs 陣列" });
                return;
            }
            const icpno = erp_companies_js_1.normIcpno(body.icpno, "00");
            const date = (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date.trim())) ? body.date.trim() : "";
            if (!date) {
                res.status(400).json({ error: "缺少或格式錯誤 date (需 YYYY-MM-DD)" });
                return;
            }
            const ingestedAt = new Date().toISOString();
            const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) ? n : 0; };
            const docRows = [];
            for (const d of docs) {
                const spNo = String(d?.sp_no ?? "").trim();
                if (!spNo)
                    continue;
                const kind = spNo.toUpperCase().startsWith("A") ? "A" : "num";
                docRows.push([
                    icpno, spNo, date,
                    String(d?.ct_no ?? "").trim(),
                    String(d?.ct_name ?? "").trim(),
                    String(d?.fkfs ?? "").trim(),
                    num(d?.total), num(d?.unpaid), num(d?.paid),
                    String(d?.nopay_fg ?? "").trim(),
                    String(d?.sales ?? "").trim(),
                    kind, ingestedAt, String(body.pushed_by ?? "agent").trim(),
                ]);
            }
            // 收款客戶主檔 seed：name/fkfs/sales/stop 由推送覆蓋；is_cash/route_line/note 為人工維護，不覆蓋。
            const custList = Array.isArray(body.customers) ? body.customers : [];
            const custRows = [];
            for (const c of custList) {
                const ctNo = String(c?.ct_no ?? "").trim();
                if (!ctNo)
                    continue;
                const fkfs = String(c?.fkfs ?? "").trim();
                const isCashSeed = /現金|現收|cash/i.test(fkfs) ? 1 : 0; // 由結帳方式含「現金」推定；人工可覆蓋
                const route = String(c?.route ?? "").trim(); // 由凌越送貨地址 [N] 解析而來（內網腳本送）
                const lastTxn = String(c?.last_txn ?? "").trim().slice(0, 10); // CT_LAST_DT 最後交易日
                custRows.push([
                    icpno, ctNo, String(c?.name ?? "").trim(), fkfs,
                    String(c?.sales ?? "").trim(), isCashSeed, (c?.stop ? 1 : 0), route, lastTxn, ingestedAt,
                ]);
            }
            const doIngest = async (h) => {
                // 該公司該日全表覆蓋：重新取單即反映凌越當下狀態（含新增/刪除），對應「印報表再跑一次」。
                await h.prepare("DELETE FROM cash_sales_doc WHERE icpno = ? AND doc_date = ?").run(icpno, date);
                const CHUNK = 100;
                for (let i = 0; i < docRows.length; i += CHUNK) {
                    const chunk = docRows.slice(i, i + CHUNK);
                    const ph = chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
                    const flat = [];
                    for (const r of chunk)
                        flat.push(...r);
                    await h.prepare("INSERT INTO cash_sales_doc (icpno, sp_no, doc_date, ct_no, ct_name, fkfs, total, unpaid, paid, nopay_fg, sales, kind, ingested_at, ingested_by) VALUES " + ph).run(...flat);
                }
                for (const r of custRows) {
                    // route_line：凌越送貨地址 [N] 有解析到就更新（地址為權威來源）、沒解析到就保留原本（可能是人工/客戶管理帶入）
                    await h.prepare("INSERT INTO cash_customer (icpno, ct_no, name, fkfs, sales, is_cash, stop, route_line, last_txn, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) " +
                        "ON CONFLICT (icpno, ct_no) DO UPDATE SET name = excluded.name, fkfs = excluded.fkfs, sales = excluded.sales, stop = excluded.stop, " +
                        "is_cash = COALESCE(cash_customer.is_cash, excluded.is_cash), last_txn = excluded.last_txn, " +
                        "route_line = CASE WHEN COALESCE(excluded.route_line,'') <> '' THEN excluded.route_line ELSE cash_customer.route_line END, " +
                        "updated_at = excluded.updated_at").run(...r);
                }
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_sales_ingested_at_" + icpno + "_" + date, ingestedAt);
                // 重新取單完成標記：讓網站前端輪詢 refresh-status 判斷「資料已更新」→ 自動重整。冪等，定時推送也會寫（無害）。
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_status", "done");
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_done_at", ingestedAt);
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_error", "");
            };
            if (typeof db.transaction === "function")
                await db.transaction(doIngest);
            else
                await doIngest(db);
            console.log("[admin] cash-ingest 完成：", icpno, date, "docs", docRows.length, "customers", custRows.length);
            res.json({ ok: true, date, icpno, docs: docRows.length, customers: custRows.length, ingested_at: ingestedAt });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/cash-ingest", e?.message || e);
            res.status(500).json({ error: "cash-ingest 失敗", detail: String(e?.message || e) });
        }
    });
    // 收款域（銷貨統計／現金收款／現金日報表）模組路由（拆檔批次 2；註冊位置不可移動，維持原路由順序）
    (0, cash_js_1.registerCashRoutes)(router, {
        db,
        notionPage,
        logDataChange,
        getTaipeiCalendarDateYYYYMMDD,
    });
    /**
     * GET /admin/lingyue-writeback/inventory-wait?timeout=25
     *   長連線等待（long-poll）：內網 agent 掛一條線等「使用者在網站點了『庫存更新』」。
     *   有待處理請求（app_settings.erp_stock_refresh_requested_at 非空）立刻回 {refresh:true}，
     *   否則 hold 到 timeout 秒（預設 25、上限 50）回 {refresh:false}。agent 收到後撈凌越並 inventory-push。
     */
    router.get("/lingyue-writeback/inventory-wait", async (req, res) => {
        let timeoutSec = parseInt(String(req.query.timeout || "25"), 10);
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0)
            timeoutSec = 25;
        if (timeoutSec > 50)
            timeoutSec = 50;
        const deadline = Date.now() + timeoutSec * 1000;
        try {
            // [ops 2026-07-10] 心跳：記錄內網代理最後一次連上 inventory-wait 的時間。
            try {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("ly_agent_last_inventory_wait_at", new Date().toISOString());
            }
            catch (_) { /* 心跳寫入失敗不影響主流程 */ }
            while (true) {
                const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_stock_refresh_requested_at");
                const reqAt = row && row.value ? String(row.value).trim() : "";
                if (reqAt) {
                    // [依公司自主更新] 一起讀出這次請求指定的公司（空＝全公司，代理沿用自身 LY_ICPNO 設定）。
                    let reqIcpno = "";
                    try { const ir = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_stock_refresh_icpno"); reqIcpno = ir && ir.value ? String(ir.value).trim() : ""; }
                    catch (_) { }
                    // 一領到就清掉旗標：避免推送失敗時旗標一直在、代理每次輪詢又重撈重推（無限重試風暴、狂打凌越）。
                    // 單次請求＝單次嘗試；失敗就等使用者再按或下次定時推。成功推送時 inventory-push 也會再清一次（冪等）。
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_requested_at", "");
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_icpno", "");
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_status", "running");
                    res.json({ refresh: true, requested_at: reqAt, icpno: reqIcpno });
                    return;
                }
                if (Date.now() >= deadline) {
                    res.json({ refresh: false });
                    return;
                }
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/inventory-wait", e?.message || e);
            res.status(500).json({ error: "inventory-wait 失敗", detail: String(e?.message || e) });
        }
    });
    // 代理回報庫存刷新失敗原因（如凌越連線逾時），讓網站顯示真正原因而非「代理未執行」
    router.post("/lingyue-writeback/inventory-report", express_1.default.json({ limit: "64kb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const now = new Date().toISOString();
            if (body.ok) {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_error", "");
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_status", "done");
            } else {
                const err = String(body.error || "未知錯誤").slice(0, 500);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_error", err);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_error_at", now);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_status", "error");
                // [ops 2026-07-10] 代理回報庫存刷新失敗（如凌越連線逾時）→ 推播告警。
                ops_notify_js_1.notifyOps(db, `凌越庫存刷新失敗（代理回報）：${err.slice(0, 200)}`).catch(() => { });
            }
            res.json({ ok: true });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    /**
     * GET /admin/lingyue-writeback/cash-refresh-wait?timeout=25
     *   長連線：內網代理掛一條線等「使用者在銷貨統計/收款頁按了『重新取單』」。
     *   有待處理（app_settings.cash_refresh_requested 非空）立刻回 {refresh:true, icpno, date}，
     *   否則 hold 到 timeout 秒回 {refresh:false}。代理收到後重撈凌越該日 → cash-ingest。
     */
    router.get("/lingyue-writeback/cash-refresh-wait", async (req, res) => {
        let timeoutSec = parseInt(String(req.query.timeout || "25"), 10);
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0)
            timeoutSec = 25;
        if (timeoutSec > 50)
            timeoutSec = 50;
        const deadline = Date.now() + timeoutSec * 1000;
        try {
            try {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("ly_agent_last_cash_wait_at", new Date().toISOString());
            }
            catch (_) { /* 心跳寫入失敗不影響主流程 */ }
            while (true) {
                const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("cash_refresh_requested");
                const raw = row && row.value ? String(row.value).trim() : "";
                if (raw) {
                    let icpno = "00", date = "";
                    try { const p = JSON.parse(raw); icpno = erp_companies_js_1.normIcpno(p.icpno, "00"); date = String(p.date || "").trim(); }
                    catch (_) { }
                    // 一領到就清旗標：避免推送失敗時旗標一直在、代理每輪又重撈重推。單次請求＝單次嘗試。
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_requested", "");
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_status", "running");
                    res.json({ refresh: true, icpno, date });
                    return;
                }
                if (Date.now() >= deadline) {
                    res.json({ refresh: false });
                    return;
                }
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/cash-refresh-wait", e?.message || e);
            res.status(500).json({ error: "cash-refresh-wait 失敗", detail: String(e?.message || e) });
        }
    });
    // 代理回報重新取單結果（cash-ingest 成功會另外寫時間戳；這裡主要記錄失敗原因供網站顯示）
    router.post("/lingyue-writeback/cash-refresh-report", express_1.default.json({ limit: "16kb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const now = new Date().toISOString();
            if (body.ok) {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_error", "");
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_status", "done");
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_done_at", now);
            }
            else {
                const err = String(body.error || "未知錯誤").slice(0, 500);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_error", err);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_status", "error");
                ops_notify_js_1.notifyOps(db, `凌越重新取單失敗（代理回報）：${err.slice(0, 200)}`).catch(() => { });
            }
            res.json({ ok: true });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    /**
     * GET /admin/lingyue-writeback/txn-wait?timeout=25
     *   長連線：agent 等「使用者在庫存頁點品項要查進銷存」的請求。
     *   有請求（app_settings.erp_txn_req_<料號>）立刻回 {codes:[{code,icpno}]}；否則 hold 到 timeout。
     */
    router.get("/lingyue-writeback/txn-wait", async (req, res) => {
        let timeoutSec = parseInt(String(req.query.timeout || "25"), 10);
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0)
            timeoutSec = 25;
        if (timeoutSec > 50)
            timeoutSec = 50;
        const deadline = Date.now() + timeoutSec * 1000;
        try {
            // [ops 2026-07-10] 心跳：記錄內網代理最後一次連上 txn-wait 的時間。
            try {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("ly_agent_last_txn_wait_at", new Date().toISOString());
            }
            catch (_) { /* 心跳寫入失敗不影響主流程 */ }
            while (true) {
                const rows = await db.prepare("SELECT key, value FROM app_settings WHERE key LIKE ?").all("erp_txn_req_%");
                if (rows && rows.length) {
                    const codes = rows.map((r) => {
                        let icpno = "00";
                        try { icpno = JSON.parse(r.value).icpno || "00"; } catch (_) { }
                        // [fix 2026-07-14] 新鍵格式 erp_txn_req_<icpno>_<code>；部署交界期可能殘留
                        // 舊格式（不含公司前綴）的在途請求，兩種都解析（icpno 以 value JSON 為權威）。
                        let rest = String(r.key).slice("erp_txn_req_".length);
                        const m = rest.match(/^(\d{2})_(.+)$/);
                        if (m) { icpno = m[1]; rest = m[2]; }
                        return { code: rest, icpno };
                    });
                    res.json({ codes });
                    return;
                }
                if (Date.now() >= deadline) {
                    res.json({ codes: [] });
                    return;
                }
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/txn-wait", e?.message || e);
            res.status(500).json({ error: "txn-wait 失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * POST /admin/lingyue-writeback/txn-callback
     *   body: { results:[ {code, icpno, data:{summary,fields}, error} ] }
     *   agent 撈完凌越進銷存後回填；寫 erp_txn_res_<code>、刪 erp_txn_req_<code>。
     */
    router.post("/lingyue-writeback/txn-callback", express_1.default.json({ limit: "8mb" }), async (req, res) => {
        try {
            const results = Array.isArray(req.body?.results) ? req.body.results : [];
            const now = new Date().toISOString();
            let n = 0;
            for (const r of results) {
                const code = String(r?.code || "").trim();
                if (!code)
                    continue;
                const rIcp = (0, erp_companies_js_1.normIcpno)(r.icpno);
                const payload = JSON.stringify({ icpno: rIcp, data: r.data || null, error: r.error || null, fetched_at: now });
                // [fix 2026-07-14] 結果鍵含公司；請求鍵新舊格式都清（部署交界期的在途請求）
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_txn_res_" + rIcp + "_" + code, payload);
                await db.prepare("DELETE FROM app_settings WHERE key = ?").run("erp_txn_req_" + rIcp + "_" + code);
                await db.prepare("DELETE FROM app_settings WHERE key = ?").run("erp_txn_req_" + code);
                n++;
            }
            res.json({ ok: true, updated: n });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/txn-callback", e?.message || e);
            res.status(500).json({ error: "txn-callback 失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * 轉入凌越 — 單張。組出凌越料號對映（沿用 /pending 的欄位邏輯），供列表「轉入凌越」按鈕用。
     * @param {*} order  已含 hq_cust_code / teraoka_code / customer_name / order_date / remark 的訂單列
     */
    async function buildLingyuePreview(order) {
        const customer_code = (order.hq_cust_code && String(order.hq_cust_code).trim())
            || (order.teraoka_code && String(order.teraoka_code).trim()) || "";
        const itemRows = await db.prepare(`
        SELECT oi.quantity, oi.unit, oi.remark, oi.raw_name, p.erp_code, p.name AS product_name
        FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1)
          AND oi.voided_at IS NULL
        ORDER BY COALESCE(oi.display_order, 999999), oi.id
      `).all(order.id);
        let missing_count = 0;
        const items = (itemRows || []).map((it) => {
            const product_code = (it.erp_code && String(it.erp_code).trim()) || "";
            if (!product_code)
                missing_count += 1;
            const qtyNum = it.quantity != null ? Number(it.quantity) : null;
            return {
                product_code,
                product_name: (it.product_name && String(it.product_name).trim())
                    || (it.raw_name && String(it.raw_name).trim()) || "",
                unit: (it.unit && String(it.unit).trim()) || "公斤",
                quantity: Number.isFinite(qtyNum) ? qtyNum : 0,
                item_note: (it.remark && String(it.remark).trim()) || "",
            };
        });
        return {
            order_id: order.id,
            order_no: order.order_no || null,
            order_date: formatOrderDateForLingyue(order.order_date),
            customer_code,
            customer_name: order.customer_name || "",
            doc_remark: (order.remark && String(order.remark).trim()) || "",
            items,
            missing_count,
        };
    }
    /** 呼叫外部凌越寫入橋接（LINGYUE_WRITE_CMD，讀 stdin JSON、輸出 {ok,doc_no,error}）。 */
    function runLingyueWrite(cmd, payload) {
        return new Promise((resolve) => {
            let child;
            try {
                child = require("child_process").spawn(cmd, { shell: true });
            }
            catch (e) {
                resolve({ ok: false, error: "無法啟動寫入程序：" + (e?.message || e) });
                return;
            }
            let out = "", err = "";
            const timer = setTimeout(() => { try { child.kill(); } catch (_) { } resolve({ ok: false, error: "凌越寫入逾時（60 秒）" }); }, 60000);
            child.stdout.on("data", (d) => { out += d.toString(); });
            child.stderr.on("data", (d) => { err += d.toString(); });
            child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: "寫入程序錯誤：" + (e?.message || e) }); });
            child.on("close", () => {
                clearTimeout(timer);
                try {
                    const lastLine = out.trim().split(/\r?\n/).pop();
                    resolve(JSON.parse(lastLine));
                }
                catch (_) {
                    resolve({ ok: false, error: (err || out || "無法解析寫入結果").slice(0, 300) });
                }
            });
            try { child.stdin.write(payload); child.stdin.end(); } catch (_) { }
        });
    }
    // 轉入凌越：預覽（顯示凌越料號、缺料號檢查）— 離線可用，不寫入、不改狀態。
    // 拆檔批次 5：訂單明細頁域搬至 ./order-detail.js（原位註冊，順序不變）
    (0, order_detail_js_1.registerOrderDetailRoutes)(router, ORDERS_CTX);
    router.get("/gemini-prompts", async (req, res) => {
        await gemini_prompt_resolve_js_1.ensureSeedPromptVersions(db);
        const SK = gemini_prompt_resolve_js_1.SETTINGS_KEYS;
        async function gv(k) {
            const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k);
            return r?.value != null ? String(r.value).trim() : "";
        }
        const liveText = await gv(SK.KEY_TEXT_LIVE);
        const liveVision = await gv(SK.KEY_VISION_LIVE);
        const abTextId = await gv(SK.KEY_TEXT_AB);
        const abTextPct = (await gv(SK.KEY_TEXT_AB_PCT)) || "0";
        const abVisId = await gv(SK.KEY_VISION_AB);
        const abVisPct = (await gv(SK.KEY_VISION_AB_PCT)) || "0";
        let textRows = [];
        let visionRows = [];
        try {
            textRows = (await db.prepare("SELECT id, label, notes, updated_at FROM prompt_versions WHERE slot = 'text' ORDER BY updated_at DESC").all()) || [];
            visionRows = (await db.prepare("SELECT id, label, notes, updated_at FROM prompt_versions WHERE slot = 'vision' ORDER BY updated_at DESC").all()) || [];
        }
        catch (e) {
            console.error("[admin] gemini-prompts list", e);
        }
        const editId = typeof req.query.edit === "string" ? req.query.edit.trim() : "";
        let editRow = null;
        if (editId) {
            editRow = await db.prepare("SELECT id, slot, label, body, notes FROM prompt_versions WHERE id = ?").get(editId);
        }
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存。</p>"
            : req.query.ok === "live" ? "<p class=\"notion-msg ok\">已更新線上版本。</p>"
                : req.query.ok === "dup" ? "<p class=\"notion-msg ok\">已複製新版本。</p>"
                    : req.query.ok === "ab" ? "<p class=\"notion-msg ok\">已更新 A/B 設定（快取已清除）。</p>"
                        : "";
        const err = req.query.err === "1" ? "<p class=\"notion-msg err\">操作失敗。</p>" : "";
        const rowHtml = (rows, liveId, slot) => (rows || []).map((r) => {
            const isLive = r.id === liveId;
            return `<tr><td><code style="font-size:11px;">${escapeHtml(r.id)}</code></td><td>${escapeHtml(r.label || "")}</td><td>${escapeHtml(String(r.updated_at || "—"))}</td><td>${isLive ? "<strong>線上</strong>" : "—"}</td><td style="white-space:normal;"><a href="/admin/gemini-prompts?edit=${encodeURIComponent(r.id)}" class="btn">編輯</a> <form method="post" action="/admin/gemini-prompts/set-live" style="display:inline;"><input type="hidden" name="slot" value="${escapeAttr(slot)}"><input type="hidden" name="version_id" value="${escapeAttr(r.id)}"><button type="submit" class="btn">設為線上</button></form> <form method="post" action="/admin/gemini-prompts/duplicate" style="display:inline;" onsubmit="return confirm('複製此版本為新草稿？');"><input type="hidden" name="slot" value="${escapeAttr(slot)}"><input type="hidden" name="from_id" value="${escapeAttr(r.id)}"><button type="submit" class="btn">複製新建</button></form></td></tr>`;
        }).join("");
        const editForm = editRow ? `
        <div class="notion-card" style="margin-top:16px;">
          <h2 style="margin-top:0;">編輯版本</h2>
          <form method="post" action="/admin/gemini-prompts/save-version">
            <input type="hidden" name="id" value="${escapeAttr(editRow.id)}">
            <label>標籤 <input type="text" name="label" value="${escapeAttr(editRow.label || "")}" style="width:100%;max-width:420px;"></label>
            <label style="display:block;margin-top:12px;">備註 <input type="text" name="notes" value="${escapeAttr(editRow.notes || "")}" style="width:100%;max-width:520px;"></label>
            <label style="display:block;margin-top:12px;">System instruction 全文<br><textarea name="body" rows="24" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.45;">${escapeHtml(editRow.body || "")}</textarea></label>
            <p><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/gemini-prompts" class="btn">取消</a></p>
          </form>
        </div>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / Gemini Prompt 版本</div>
        <h1 class="notion-page-title">Gemini Prompt 版本與 A/B</h1>
        <p class="notion-hint" style="margin-top:0;">文字叫貨與圖像 vision 使用<strong>不同 slot</strong>；均不含子客戶／歷史品項小抄（執行時會自動附加）。儲存或設為線上後會清除快取。配合辨識成效儀表之 <code>gemini_usage_log.prompt_version_id</code> 可比對不同版本。</p>
        ${msg}${err}
        <div class="notion-card">
          <h2 style="margin-top:0;">A/B 分流（可選）</h2>
          <p class="notion-hint">將<strong>對照版本（B）</strong>依百分比隨機套用。設 B 為空或 0% 則永遠使用線上版。</p>
          <form method="post" action="/admin/gemini-prompts/ab-settings">
            <fieldset style="border:1px solid var(--notion-border);border-radius:8px;padding:12px;margin-bottom:12px;">
              <legend><strong>純文字（text）</strong></legend>
              <label>B 版本（對照）
                <select name="text_ab_id" style="display:block;margin-top:6px;max-width:100%;">
                  <option value="">— 未啟用 B —</option>
                  ${textRows.map((r) => `<option value="${escapeAttr(r.id)}" ${r.id === abTextId ? "selected" : ""}>${escapeHtml(r.label)} (${escapeHtml(r.id)})</option>`).join("")}
                </select>
              </label>
              <label style="display:block;margin-top:10px;">B 分流百分比（0–100）<input type="number" name="text_ab_pct" min="0" max="100" value="${escapeAttr(abTextPct)}" style="width:100px;"></label>
            </fieldset>
            <fieldset style="border:1px solid var(--notion-border);border-radius:8px;padding:12px;margin-bottom:12px;">
              <legend><strong>圖像／視覺（vision）</strong></legend>
              <label>B 版本（對照）
                <select name="vision_ab_id" style="display:block;margin-top:6px;max-width:100%;">
                  <option value="">— 未啟用 B —</option>
                  ${visionRows.map((r) => `<option value="${escapeAttr(r.id)}" ${r.id === abVisId ? "selected" : ""}>${escapeHtml(r.label)} (${escapeHtml(r.id)})</option>`).join("")}
                </select>
              </label>
              <label style="display:block;margin-top:10px;">B 分流百分比（0–100）<input type="number" name="vision_ab_pct" min="0" max="100" value="${escapeAttr(abVisPct)}" style="width:100px;"></label>
            </fieldset>
            <button type="submit" class="btn btn-primary">儲存 A/B 設定</button>
          </form>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">文字 Prompt 版本</h2>
          <p class="notion-hint">線上：<code>${escapeHtml(liveText || "—")}</code></p>
          <div class="table-scroll-mobile"><table style="font-size:13px;width:100%;"><thead><tr><th>ID</th><th>標籤</th><th>更新</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rowHtml(textRows, liveText, "text") || "<tr><td colspan=\"5\">尚無資料</td></tr>"}</tbody></table></div>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">圖像 Prompt 版本</h2>
          <p class="notion-hint">線上：<code>${escapeHtml(liveVision || "—")}</code></p>
          <div class="table-scroll-mobile"><table style="font-size:13px;width:100%;"><thead><tr><th>ID</th><th>標籤</th><th>更新</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rowHtml(visionRows, liveVision, "vision") || "<tr><td colspan=\"5\">尚無資料</td></tr>"}</tbody></table></div>
        </div>
        ${editForm}
      `;
        res.type("text/html").send(notionPage("Gemini Prompt 版本", body, "gemini-prompts", res));
    });
    router.post("/gemini-prompts/set-live", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const slot = String(req.body.slot || "").trim();
            const vid = String(req.body.version_id || "").trim();
            if ((slot !== "text" && slot !== "vision") || !vid) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const row = await db.prepare("SELECT id, slot FROM prompt_versions WHERE id = ?").get(vid);
            if (!row || row.slot !== slot) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const SK = gemini_prompt_resolve_js_1.SETTINGS_KEYS;
            const key = slot === "vision" ? SK.KEY_VISION_LIVE : SK.KEY_TEXT_LIVE;
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(key, vid);
            gemini_prompt_resolve_js_1.invalidatePromptCache();
            res.redirect("/admin/gemini-prompts?ok=live");
        }
        catch (_e) {
            res.redirect("/admin/gemini-prompts?err=1");
        }
    });
    router.post("/gemini-prompts/save-version", express_1.default.urlencoded({ extended: true, limit: "4mb" }), async (req, res) => {
        try {
            const id = String(req.body.id || "").trim();
            const label = String(req.body.label || "").trim() || "未命名";
            const notes = String(req.body.notes || "").trim() || null;
            const body = String(req.body.body ?? "");
            if (!id) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            await db.prepare(`UPDATE prompt_versions SET label = ?, notes = ?, body = ?, updated_at = ${nowSql} WHERE id = ?`).run(label, notes, body, id);
            gemini_prompt_resolve_js_1.invalidatePromptCache();
            res.redirect("/admin/gemini-prompts?edit=" + encodeURIComponent(id) + "&ok=1");
        }
        catch (_e) {
            res.redirect("/admin/gemini-prompts?err=1");
        }
    });
    router.post("/gemini-prompts/duplicate", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const slot = String(req.body.slot || "").trim();
            const fromId = String(req.body.from_id || "").trim();
            if ((slot !== "text" && slot !== "vision") || !fromId) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const src = await db.prepare("SELECT body, label FROM prompt_versions WHERE id = ? AND slot = ?").get(fromId, slot);
            if (!src) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const newId = (0, id_js_1.newId)("pvp");
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            const newLabel = (src.label || "") + "（複製）";
            await db.prepare(`INSERT INTO prompt_versions (id, slot, label, body, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ${nowSql}, ${nowSql})`).run(newId, slot, newLabel, src.body, "由複製建立");
            gemini_prompt_resolve_js_1.invalidatePromptCache();
            res.redirect("/admin/gemini-prompts?edit=" + encodeURIComponent(newId) + "&ok=dup");
        }
        catch (_e) {
            res.redirect("/admin/gemini-prompts?err=1");
        }
    });
    router.post("/gemini-prompts/ab-settings", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const SK = gemini_prompt_resolve_js_1.SETTINGS_KEYS;
            const ta = String(req.body.text_ab_id || "").trim();
            const tp = String(Math.min(100, Math.max(0, parseInt(String(req.body.text_ab_pct || "0"), 10) || 0)));
            const va = String(req.body.vision_ab_id || "").trim();
            const vp = String(Math.min(100, Math.max(0, parseInt(String(req.body.vision_ab_pct || "0"), 10) || 0)));
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(SK.KEY_TEXT_AB, ta);
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(SK.KEY_TEXT_AB_PCT, tp);
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(SK.KEY_VISION_AB, va);
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(SK.KEY_VISION_AB_PCT, vp);
            gemini_prompt_resolve_js_1.invalidatePromptCache();
            res.redirect("/admin/gemini-prompts?ok=ab");
        }
        catch (_e) {
            res.redirect("/admin/gemini-prompts?err=1");
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
        // 按客戶 group 統計
        const byCust = new Map();
        for (const r of rows) {
            const cn = r.customer_name || "—";
            if (!byCust.has(cn)) byCust.set(cn, 0);
            byCust.set(cn, byCust.get(cn) + 1);
        }
        const tableRows = (rows || [])
            .map((r) => {
            const oid = r.order_id || "";
            const oidDisp = oid ? `<a href="/admin/orders/${encodeURIComponent(oid)}" class="mono" style="font-size:11px;">${escapeHtml(oid.slice(0,12))}</a>` : `<span style="color:var(--txt-3);">—</span>`;
            const created = r.created_at != null ? escapeHtml(String(r.created_at).slice(0,16).replace("T"," ")) : "—";
            const noteCell = r.note && String(r.note).trim() ? escapeHtml(String(r.note).trim()) : `<span style="color:var(--txt-3);">—</span>`;
            const qs = r.quality_score != null ? Number(r.quality_score) : null;
            const qsHtml = qs != null
                ? `<span class="sf-pill ${qs>=80?"ok":qs>=50?"warn":"bad"}" style="font-size:10px;">${qs}</span>`
                : `<span style="color:var(--txt-3);">—</span>`;
            return `<tr data-example-id="${escapeAttr(r.id)}">
            <td><code class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml(r.id.slice(0,10))}</code></td>
            <td><span style="font-weight:500;">${escapeHtml(r.customer_name || "—")}</span></td>
            <td>${oidDisp}</td>
            <td class="mono" style="font-size:11px;color:var(--txt-3);white-space:nowrap;">${created}</td>
            <td style="text-align:right;">${qsHtml}</td>
            <td style="max-width:380px;"><pre style="margin:0;font-size:11px;line-height:1.4;color:var(--txt-2);white-space:pre-wrap;word-break:break-all;font-family:var(--font-mono);max-height:60px;overflow:hidden;">${escapeHtml(previewParsed(r.parsed_json))}</pre></td>
            <td style="font-size:11px;color:var(--txt-3);max-width:140px;word-break:break-all;">${escapeHtml(String(r.image_path || "").slice(0, 60))}${String(r.image_path || "").length > 60 ? "…" : ""}</td>
            <td style="font-size:12px;">${noteCell}</td>
            <td><button type="button" class="sf-btn sm danger ai-example-del" data-id="${escapeAttr(r.id)}">${SF_ICONS.x}<span>停用</span></button></td>
          </tr>`;
        })
            .join("");
        const statCard = (label, num, sub, status) => `
          <div style="padding:14px 16px;background:var(--bg-1);border:var(--hairline);border-radius:var(--radius-md);${status?`border-left:3px solid var(--${status});padding-left:14px;`:""}flex:1;min-width:160px;">
            <div style="font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${label}</div>
            <div class="mono" style="font-size:22px;font-weight:600;letter-spacing:-0.02em;">${num}</div>
            ${sub?`<div style="font-size:11px;color:var(--txt-3);margin-top:4px;">${sub}</div>`:""}
          </div>`;
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div>
            <div class="sf-breadcrumb" style="margin-bottom:6px;">主檔管理 / AI 學習庫</div>
            <h1 style="margin:0;font-size:22px;font-weight:600;">AI 學習庫管理</h1>
            <p style="margin-top:4px;color:var(--txt-3);font-size:12px;">客戶訂單圖 Few-Shot 範例（<code class="mono" style="font-size:11px;">customer_order_image_examples</code>）。每筆範例會在該客戶下次傳訂單圖時，作為示範資料丟給 Gemini Vision，幫助辨識手寫筆跡與品名習慣。停用後資料仍保留，只是不再用於辨識。</p>
          </div>
          ${okMsg ? `<div class="sf-pill ok" style="align-self:flex-start;">${okMsg.replace(/<[^>]*>/g,"")}</div>` : ""}
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            ${statCard("啟用中範例", rows.length, "目前供 AI 辨識使用", "accent")}
            ${statCard("涵蓋客戶", byCust.size + " 戶", "有 Few-Shot 範例的客戶", "ok")}
            ${statCard("平均/客戶", (rows.length && byCust.size) ? (rows.length/byCust.size).toFixed(1) : "—", "範例數 / 客戶數", "info")}
          </div>
          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.spark} 全部啟用中的學習範例</div>
              <span class="sf-card-sub">${rows.length} 筆</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th>範本 ID</th>
                    <th>客戶</th>
                    <th>來源訂單</th>
                    <th>建立時間</th>
                    <th style="text-align:right;">品質分</th>
                    <th>JSON 預覽</th>
                    <th>圖片路徑</th>
                    <th>備註</th>
                    <th style="width:90px;"></th>
                  </tr>
                </thead>
                <tbody>${tableRows || `<tr><td colspan='9' style='padding:24px;text-align:center;color:var(--txt-3);'>尚無啟用中的範例。可在訂單明細頁點「儲存為 AI 學習範例」加入。</td></tr>`}</tbody>
              </table>
            </div>
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
    // 拆檔批次 5：客訴域搬至 ./complaints.js（原位註冊，順序不變）
    (0, complaints_js_1.registerComplaintsRoutes)(router, ORDERS_CTX);
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
    // 拆檔批次 4：客戶域路由搬至 ./customers.js（原位註冊，順序不變；/customers/groups 留本檔）
    (0, customers_js_1.registerCustomersRoutes)(router, {
        db, notionPage, logDataChange, getTaipeiCalendarDateYYYYMMDD, fmtTaipeiYMDHM, setGroupFeaturesAudited, ORDER_LINE_UNITS,
    });
    // 拆檔批次 4：貨品域路由搬至 ./products.js（原位註冊，順序不變）
    (0, products_js_1.registerProductsRoutes)(router, {
        db, notionPage, logDataChange, requireManager, safeAdminReturnPath, appendQueryToAdminPath, productEditEmbedQuery, computeDerivedKgByUnit, notionEmbedPage, autoConvertOrderItemsToKg, normalizeLineUnitRules, loadLineUnitRulesObject, saveLineUnitRulesObject, ORDER_LINE_UNITS,
    });
    router.get("/import", async (req, res) => {
        const msg = req.query.ok ? `<p style='color:green'>已匯入 ${escapeHtml(String(req.query.ok))} 筆品項。</p>` : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
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
        const skippedGroups = [];
        // [fix 2026-07-27 體檢] (1) 整份匯入包交易：舊版逐列裸奔，中途失敗前半已寫入、畫面只回一句失敗。
        // (2) LINE 群組唯一性：/customers/new 有「同一群組不可綁兩個客戶」守衛（叫貨會歸錯客戶），
        //     這條 CSV 路徑過去零檢查、可直接蓋 → 同群組已綁其他客戶時跳過該綁定並在結果列出。
        const doImportCust = async (h) => {
            for (let i = 0; i < rows.length; i++) {
                const cols = rows[i];
                const name = (cols[nameIdx] ?? "").trim();
                if (!name)
                    continue;
                const teraokaCode = custCodeIdx >= 0 ? (cols[custCodeIdx] ?? "").trim() || null : null;
                const hqCustCode = hqCustCodeIdx >= 0 ? (cols[hqCustCodeIdx] ?? "").trim() || null : null;
                let lineGroupId = lineGroupIdIdx >= 0 ? (cols[lineGroupIdIdx] ?? "").trim() || null : null;
                const contactParts = [custTelIdx, faxIdx, contactIdx, emailIdx]
                    .filter((idx) => idx >= 0)
                    .map((idx) => (cols[idx] ?? "").trim())
                    .filter(Boolean);
                const contact = contactParts.length > 0 ? contactParts.join(" / ") : null;
                const existing = await h.prepare("SELECT id FROM customers WHERE name = ?").get(name);
                if (lineGroupId) {
                    const bound = await h.prepare("SELECT id, name FROM customers WHERE line_group_id = ?").get(lineGroupId);
                    if (bound && (!existing || String(bound.id) !== String(existing.id))) {
                        skippedGroups.push(`${name}（群組已綁「${bound.name}」）`);
                        lineGroupId = null;
                    }
                }
                if (existing) {
                    await h.prepare("UPDATE customers SET teraoka_code = COALESCE(?, teraoka_code), hq_cust_code = COALESCE(?, hq_cust_code), contact = COALESCE(?, contact), line_group_id = COALESCE(?, line_group_id), updated_at = datetime('now') WHERE id = ?").run(teraokaCode ?? null, hqCustCode ?? null, contact ?? null, lineGroupId || null, existing.id);
                    if (lineGroupId)
                        updated++;
                }
                else {
                    await h.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_id, contact) VALUES (?, ?, ?, ?, ?, ?)").run((0, id_js_1.newId)("cust"), name, teraokaCode, hqCustCode, lineGroupId, contact);
                    imported++;
                }
            }
        };
        if (typeof db.transaction === "function") await db.transaction(doImportCust);
        else await doImportCust(db);
        // [fix 2026-07-27 體檢] 批次寫入客戶主檔補稽核軌跡（守則 #3）
        try {
            await logDataChange(req, {
                entityType: "customer",
                entityId: "import-" + new Date().toISOString(),
                action: "import_customers",
                summary: `CSV 匯入客戶：新增 ${imported} 筆、更新群組綁定 ${updated} 筆${skippedGroups.length ? `、跳過已綁定群組 ${skippedGroups.length} 筆` : ""}`,
                meta: { imported, updated, skipped_groups: skippedGroups },
            });
        } catch (_) { /* 稽核失敗不擋匯入結果 */ }
        const resultMsg = imported > 0 ? `新增 ${imported} 筆` : "";
        const resultMsg2 = updated > 0 ? (resultMsg ? "；" : "") + `更新 ${updated} 筆 LINE 群組綁定` : "";
        const resultMsg3 = skippedGroups.length ? ((resultMsg + resultMsg2) ? "；" : "") + `跳過 ${skippedGroups.length} 筆群組綁定（已綁其他客戶）：${skippedGroups.slice(0, 5).join("、")}${skippedGroups.length > 5 ? "…" : ""}` : "";
        res.redirect("/admin/import-customers?ok=" + encodeURIComponent(resultMsg + resultMsg2 + resultMsg3 || "0"));
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
    // 拆檔批次 4：群發域路由搬至 ./broadcast.js（原位註冊，順序不變；/announcements 留本檔）
    (0, broadcast_js_1.registerBroadcastRoutes)(router, {
        db, notionPage, logDataChange, requireManager, upload, buildPromoFlexMessage, buildNoticeFlexMessage, buildCalendarFlexMessage,
    });

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

    function nowSqlExpr() {
        return process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
    }

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

    // 報價頁 icon：採 Feather Icons（線條/outline 風格；MIT）內嵌 SVG，
    // 統一 viewBox 0 0 24 24、stroke-width 2、圓角端點，與線條感一致（不拉外部 CDN）。
    const _fi = (paths) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    const QI = {
        price: _fi('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'),
        manage: _fi('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
        print: _fi('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
        image: _fi('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
        doc: _fi('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>'),
        users: _fi('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
        calendar: _fi('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
        save: _fi('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
        checkc: _fi('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
        back: _fi('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
        pdf: _fi('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8.5 13.5h1a1 1 0 0 1 0 2h-1zM8.5 15.5V18"/><path d="M12.5 13.5V18h1a1.2 1.2 0 0 0 1.2-1.2v-2.1a1.2 1.2 0 0 0-1.2-1.2z"/>'),
        dl: _fi('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
        // 管理品項頁的排序 UI：拖曳握把（四條橫線）＋ 上下移一格
        grip: _fi('<line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/>'),
        up: _fi('<polyline points="18 15 12 9 6 15"/>'),
        down: _fi('<polyline points="6 9 12 15 18 9"/>'),
    };

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

    // 報價分兩種：月報（quote_report，id 前綴 qr_）與飯店客戶報價（hotel_quote，id 前綴 hq_）。
    // 品項都存在 quote_item（report_id = 各自表頭 id），因此編輯／存檔／輸出邏輯可共用。
    function quoteKindOf(id) { return String(id || "").startsWith("hq_") ? "hotel" : "monthly"; }
    async function resolveQuoteRow(id) {
        if (quoteKindOf(id) === "hotel") return { kind: "hotel", row: await quote_report_js_1.getHotelQuote(db, id) };
        return { kind: "monthly", row: await quote_report_js_1.getReport(db, id) };
    }

    // 分頁列（月報 / 飯店客戶報價）
    function renderQuoteTabs(active) {
        const tab = (key, label, href) => `<a class="sf-qtab ${active === key ? "on" : ""}" href="${href}">${label}</a>`;
        return `<div class="sf-qtabs">
          ${tab("monthly", "月報", "/admin/quotes")}
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
        const allCats = Array.from(new Set([...quote_report_js_1.CATEGORY_ORDER, ...groups.map(g => g.category)]));
        const catOptions = (sel) => allCats.map(c => `<option value="${escapeAttr(c)}"${c === sel ? " selected" : ""}>${escapeHtml(c)}</option>`).join("");
        const enc = encodeURIComponent(id);
        const isHotel = kind === "hotel";
        const titleMain = isHotel ? escapeHtml(row.customer_name || "飯店") : escapeHtml(row.roc_label || row.ym || "");
        const backHref = isHotel ? "/admin/quotes?tab=hotel" : "/admin/quotes";
        const backLabel = isHotel ? "飯店客戶報價" : "月報";
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
                <h1>${titleMain} 報價單 ${statusPill}</h1>
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
                <label style="font-size:12px;color:var(--txt-3);">分類<select name="category" style="width:100%;font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:4px;margin-top:3px;">${catOptions(quote_report_js_1.CATEGORY_ORDER[0])}</select></label>
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
            const tab = String(req.query.tab || "") === "hotel" ? "hotel" : "monthly";
            const okMsg = String(req.query.ok || "");
            let inner = "";

            if (tab === "hotel") {
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
            // 前月價格比較：只對「月報」且非管理模式建 map（飯店報價無月份概念）。前月不存在則靜默省略。
            let prevMap = null;
            if (kind === "monthly" && !manage && row.ym) {
                try { prevMap = await quote_report_js_1.buildPrevPriceMap(db, row.ym); } catch (_) { prevMap = null; }
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
            if (quoteKindOf(req.params.id) === "hotel") {
                header.customer_name = req.body.customer_name;
                await quote_report_js_1.updateHotelHeader(db, req.params.id, header);
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
            if (quoteKindOf(req.params.id) === "hotel") await quote_report_js_1.setHotelStatus(db, req.params.id, status);
            else await quote_report_js_1.setReportStatus(db, req.params.id, status);
        } catch (e) { console.error("[admin] set status failed", e); }
        res.redirect(`/admin/quotes/${encodeURIComponent(req.params.id)}`);
    });

    // 刪除整份報價
    router.post("/quotes/:id/delete", async (req, res) => {
        const isHotel = quoteKindOf(req.params.id) === "hotel";
        try {
            if (isHotel) await quote_report_js_1.deleteHotelQuote(db, req.params.id);
            else await quote_report_js_1.deleteReport(db, req.params.id);
        } catch (e) { console.error("[admin] delete quote failed", e); }
        res.redirect(isHotel ? "/admin/quotes?tab=hotel" : "/admin/quotes");
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

    // 教育訓練（TTQS / PDDRO）模組路由
    (0, training_js_1.registerTrainingRoutes)(router, {
        db,
        notionPage,
        escapeHtml,
        escapeAttr,
        newId: id_js_1.newId,
        erp: erp_companies_js_1,
        loadAdminUsers,
        logDataChange,
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
function sanitizeHexColor(c, fallback) {
    if (!c) return fallback;
    const s = String(c).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
        return "#" + s.slice(1).split("").map(ch => ch + ch).join("");
    }
    return fallback;
}
function buildPromoFlexMessage(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const dateText = (data.promo_date || "").trim();
    const subtitle = (data.promo_subtitle || "").trim();
    const note = (data.promo_note || "").trim();
    const headerColor = sanitizeHexColor(data.header_color, "#1a7c6e");
    const itemBoxes = items.filter(it => it.name).map(it => ({
        type: "box",
        layout: "horizontal",
        paddingTop: "8px",
        paddingBottom: "8px",
        contents: [
            { type: "text", text: String(it.name), size: "sm", color: "#222222", flex: 3, wrap: true },
            {
                type: "box", layout: "vertical", flex: 2, alignItems: "flex-end",
                contents: [
                    { type: "text", text: it.price ? `$${it.price}/${it.unit || "斤"}` : "—", size: "sm", color: "#e05000", weight: "bold", align: "end" },
                ]
            },
            {
                type: "box", layout: "vertical", flex: 2, alignItems: "flex-end",
                contents: [
                    { type: "text", text: it.market ? `$${it.market}` : "—", size: "sm", color: "#888888", align: "end" },
                ]
            },
        ],
    }));
    const separators = [];
    for (let i = 0; i < itemBoxes.length; i++) {
        separators.push(itemBoxes[i]);
        if (i < itemBoxes.length - 1) separators.push({ type: "separator", color: "#eeeeee" });
    }
    const headerContents = [
        { type: "text", text: "⚡ 限時優惠", color: "#ffffff", size: "xl", weight: "bold" },
    ];
    if (subtitle) headerContents.push({ type: "text", text: subtitle, color: "#b2dfdb", size: "sm", margin: "sm" });
    const columnHeader = {
        type: "box", layout: "horizontal", paddingBottom: "6px",
        contents: [
            { type: "text", text: "品名", size: "xs", color: "#aaaaaa", flex: 3 },
            { type: "text", text: "優惠單價", size: "xs", color: "#aaaaaa", flex: 2, align: "end" },
            { type: "text", text: "行情上價", size: "xs", color: "#aaaaaa", flex: 2, align: "end" },
        ],
    };
    const footerContents = [];
    if (dateText) footerContents.push({ type: "text", text: `🕐 訂購時間：${dateText}`, size: "xs", color: "#666666", wrap: true });
    if (note) footerContents.push({ type: "text", text: `📝 ${note}`, size: "xs", color: "#888888", margin: "sm", wrap: true });
    return {
        type: "bubble",
        size: "kilo",
        header: {
            type: "box", layout: "vertical", backgroundColor: headerColor, paddingAll: "16px",
            contents: headerContents,
        },
        body: {
            type: "box", layout: "vertical", backgroundColor: "#f9f9f9", paddingAll: "16px", spacing: "none",
            contents: [
                columnHeader,
                { type: "separator", color: "#cccccc" },
                ...separators,
            ],
        },
        ...(footerContents.length ? {
            footer: {
                type: "box", layout: "vertical", backgroundColor: "#ffffff", paddingAll: "12px",
                contents: footerContents,
            }
        } : {}),
    };
}
function buildNoticeFlexMessage(data) {
    const title = (data.notice_title || "公告").trim();
    const subtitle = (data.notice_subtitle || "").trim();
    const content = (data.notice_content || "").trim();
    const headerColor = sanitizeHexColor(data.header_color, "#b91c1c");
    const headerContents = [
        { type: "text", text: "📢 " + title, color: "#ffffff", size: "xl", weight: "bold", wrap: true, align: "center" },
    ];
    if (subtitle) headerContents.push({ type: "text", text: subtitle, color: "#ffffff", size: "sm", margin: "sm", align: "center", wrap: true });
    return {
        type: "bubble",
        size: "kilo",
        header: {
            type: "box", layout: "vertical", backgroundColor: headerColor, paddingAll: "22px",
            contents: headerContents,
        },
        body: {
            type: "box", layout: "vertical", paddingAll: "20px",
            contents: [
                { type: "text", text: content || "（無內容）", size: "md", color: "#333333", wrap: true, lineSpacing: "8px" },
            ],
        },
        footer: {
            type: "box", layout: "vertical", backgroundColor: "#f5f5f5", paddingAll: "10px",
            contents: [
                { type: "text", text: "松富生鮮物流", size: "xs", color: "#999999", align: "center" },
            ],
        },
    };
}
/** 行事曆公告 Flex Message */
function buildCalendarFlexMessage(data) {
    const title = (data.cal_title || "休假公告").trim();
    const subtitle = (data.cal_subtitle || "").trim();
    const note = (data.cal_note || "").trim();
    const headerColor = sanitizeHexColor(data.header_color, "#b91c1c");
    const ym = (data.cal_year_month || "").trim(); // YYYY-MM
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;
    if (/^\d{4}-\d{2}$/.test(ym)) {
        const [y, m] = ym.split("-").map(Number);
        year = y; month = m;
    }
    // marks: [{ date: "2026-05-01", label: "公休", type: "off"|"work"|"highlight" }]
    const marksRaw = Array.isArray(data.cal_marks) ? data.cal_marks : [];
    const marks = {};
    for (const m of marksRaw) {
        if (m && m.date) marks[String(m.date).trim()] = {
            label: String(m.label || "").trim(),
            type: m.type || "off",
        };
    }
    // 產生月曆格子：一二三四五六日（週一為首）
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startWeekday = (firstDay.getDay() + 6) % 7; // 週一 = 0
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    // 切成 row
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    const weekdayHeader = {
        type: "box", layout: "horizontal", paddingBottom: "4px",
        contents: ["一", "二", "三", "四", "五", "六", "日"].map((w, i) => ({
            type: "text", text: w, flex: 1, align: "center", size: "xs",
            color: i >= 5 ? "#b91c1c" : "#666666", weight: "bold",
        })),
    };
    const cellBox = (cell) => {
        if (cell == null) return { type: "filler", flex: 1 };
        const ymd = `${year}-${String(month).padStart(2, "0")}-${String(cell).padStart(2, "0")}`;
        const mark = marks[ymd];
        let bg = "#ffffff";
        let labelColor = "#666666";
        let numColor = "#222222";
        let labelText = "";
        if (mark) {
            labelText = mark.label || (mark.type === "work" ? "正常" : "公休");
            if (mark.type === "work") { bg = "#fff8e1"; labelColor = "#8b6914"; numColor = "#5a4500"; }
            else if (mark.type === "highlight") { bg = "#fef3c7"; labelColor = "#92400e"; numColor = "#5a4500"; }
            else { bg = "#fee2e2"; labelColor = "#b91c1c"; numColor = "#7f1d1d"; }
        }
        return {
            type: "box", layout: "vertical", flex: 1, backgroundColor: bg,
            cornerRadius: "4px", paddingAll: "6px", spacing: "none",
            contents: [
                { type: "text", text: String(cell), size: "sm", weight: "bold", color: numColor, align: "center" },
                ...(labelText ? [{ type: "text", text: labelText, size: "xxs", color: labelColor, align: "center", margin: "xs" }] : [{ type: "text", text: " ", size: "xxs", color: "#ffffff", align: "center", margin: "xs" }]),
            ],
        };
    };
    const weekRows = rows.map(row => ({
        type: "box", layout: "horizontal", spacing: "xs", margin: "xs",
        contents: row.map(cellBox),
    }));
    const headerContents = [
        { type: "text", text: title, color: "#ffffff", size: "xl", weight: "bold", wrap: true, align: "center" },
    ];
    if (subtitle) headerContents.push({ type: "text", text: subtitle, color: "#ffffff", size: "sm", margin: "sm", align: "center", wrap: true });
    const noteBlock = note ? [
        { type: "separator", margin: "lg", color: "#e5e5e5" },
        { type: "text", text: note, size: "sm", color: "#444444", wrap: true, margin: "md", lineSpacing: "6px" },
    ] : [];
    return {
        type: "bubble",
        size: "giga",
        header: {
            type: "box", layout: "vertical", backgroundColor: headerColor, paddingAll: "22px",
            contents: headerContents,
        },
        body: {
            type: "box", layout: "vertical", paddingAll: "16px",
            contents: [
                { type: "text", text: `${year} 年 ${month} 月`, size: "md", color: "#888888", align: "center", weight: "bold" },
                { type: "box", layout: "vertical", margin: "md", spacing: "none",
                  contents: [weekdayHeader, { type: "separator", color: "#e5e5e5" }, ...weekRows] },
                ...noteBlock,
            ],
        },
        footer: {
            type: "box", layout: "vertical", backgroundColor: "#f5f5f5", paddingAll: "10px",
            contents: [
                { type: "text", text: "松富生鮮物流 · 祝佳節愉快", size: "xs", color: "#999999", align: "center" },
            ],
        },
    };
}
// [refactor 2026-07-18 批次1] escapeHtml / escapeAttr / escJsStr 已移至 dist/admin/_shared.js，改由頂部 require 匯入。
// 作廢原因 modal（訂單明細「作廢此訂單」與訂單列表「批次作廢」共用）。
// 產出 modal HTML＋樣式＋通用腳本；使用頁面需另外：
//   1. 定義 window[prefix + "ModalSubmit"](reason, note) —— 按「確定作廢」後的送出行為。
//   2. 呼叫 window[prefix + "ModalOpen"](descHtml?) 開啟 —— 可帶說明文字覆寫預設（如「將作廢 N 筆訂單」）。
// 最近一次選的原因記在 localStorage（單筆與批次共用同一鍵）。
function voidReasonModalHtml(opts) {
    const prefix = opts.prefix;
    const title = opts.title || "作廢此訂單";
    const desc = opts.desc || "選擇作廢原因（會記住下一次預設），可由「已作廢訂單」恢復。";
    const reasons = [
        { value: "not_order", icon: "stop", label: "非訂單訊息", hint: "匯款證明、寒喧、門市互動等" },
        { value: "duplicate", icon: "refresh", label: "重複叫貨", hint: "同一筆叫貨被讀進 2 次" },
        { value: "customer_cancelled", icon: "x", label: "客戶取消", hint: "客戶主動說不要了" },
        { value: "customer_complaint", icon: "message", label: "客訴問題", hint: "" },
        { value: "ai_wrong", icon: "robot", label: "AI 辨識整單錯誤", hint: "會回饋學習庫" },
        { value: "staff_error", icon: "user", label: "內部錯誤", hint: "" },
        { value: "other", icon: "edit", label: "其他", hint: "" },
    ];
    const rowsHtml = reasons.map((r) => `<label class="void-reason-row"><input type="radio" name="${prefix}_reason_pick" value="${r.value}"><span class="void-reason-icon">${SF_ICONS[r.icon] || ""}</span><span class="void-reason-text"><strong>${r.label}</strong>${r.hint ? `<br><span style="font-size:11px;color:var(--txt-3);">${r.hint}</span>` : ""}</span></label>`).join("\n                ");
    return `
          <div id="${prefix}Modal" class="notion-modal-overlay" style="display:none;z-index:1200;" role="dialog" aria-modal="true" aria-labelledby="${prefix}ModalTitle">
            <div class="notion-modal" style="max-width:460px;">
              <h3 id="${prefix}ModalTitle" style="margin:0 0 4px;font-size:16px;display:flex;align-items:center;gap:8px;">
                <span style="color:#dc2626;">⊘</span>
                <span>${title}</span>
              </h3>
              <p id="${prefix}ModalDesc" style="margin:0 0 14px;font-size:12px;color:var(--txt-3);">${desc}</p>
              <div id="${prefix}ReasonGroup" style="display:flex;flex-direction:column;gap:6px;">
                ${rowsHtml}
              </div>
              <textarea id="${prefix}ModalNote" placeholder="備註（可留白）" rows="2" style="margin-top:12px;width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-family:inherit;font-size:13px;resize:vertical;"></textarea>
              <div class="notion-modal-actions" style="justify-content:flex-end;">
                <button type="button" class="sf-btn" id="${prefix}ModalCancel">取消</button>
                <button type="button" class="sf-btn danger" id="${prefix}ModalConfirm">確定作廢</button>
              </div>
            </div>
          </div>
          <style>
            .void-reason-row { display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;cursor:pointer;background:var(--bg-1);transition:background .1s,border-color .1s;margin:0;font-size:13px; }
            .void-reason-row:hover { background:var(--bg-2);border-color:var(--txt-3); }
            .void-reason-row input[type=radio] { margin-top:3px; }
            .void-reason-row.is-selected { background:#fee2e2;border-color:#dc2626; }
            .void-reason-icon { display:inline-flex;align-items:center;color:var(--txt-2);line-height:1;margin-top:1px;flex:0 0 auto; }
            .void-reason-text { flex:1;line-height:1.4; }
          </style>
          <script>
          (function(){
            const modal = document.getElementById("${prefix}Modal");
            const cancelBtn = document.getElementById("${prefix}ModalCancel");
            const confirmBtn = document.getElementById("${prefix}ModalConfirm");
            const noteInput = document.getElementById("${prefix}ModalNote");
            const descEl = document.getElementById("${prefix}ModalDesc");
            const group = document.getElementById("${prefix}ReasonGroup");
            if (!modal || !confirmBtn || !group || !noteInput) return;
            const LS_KEY = "songfu.void_order.last_reason";
            function getLast() { try { return localStorage.getItem(LS_KEY) || "not_order"; } catch(_) { return "not_order"; } }
            function setLast(v) { try { localStorage.setItem(LS_KEY, v); } catch(_) {} }
            function getPicked() {
              const r = group.querySelector('input[name="${prefix}_reason_pick"]:checked');
              return r ? r.value : "";
            }
            function highlight() {
              group.querySelectorAll(".void-reason-row").forEach(row => {
                const r = row.querySelector('input[type=radio]');
                row.classList.toggle("is-selected", r && r.checked);
              });
            }
            function close() { modal.style.display = "none"; }
            window["${prefix}ModalOpen"] = function(descHtml){
              if (descHtml && descEl) descEl.innerHTML = descHtml;
              const last = getLast();
              const target = group.querySelector('input[value="' + last + '"]') || group.querySelector('input[type=radio]');
              if (target) target.checked = true;
              noteInput.value = "";
              confirmBtn.disabled = false;
              confirmBtn.textContent = "確定作廢";
              highlight();
              modal.style.display = "flex";
              noteInput.focus();
            };
            if (cancelBtn) cancelBtn.addEventListener("click", close);
            modal.addEventListener("click", function(e){ if (e.target === modal) close(); });
            document.addEventListener("keydown", function(e){
              if (modal.style.display === "none") return;
              if (e.key === "Escape") close();
              else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) confirmBtn.click();
            });
            group.addEventListener("change", highlight);
            confirmBtn.addEventListener("click", function(){
              const reason = getPicked();
              if (!reason) { alert("請選擇作廢原因"); return; }
              setLast(reason);
              confirmBtn.disabled = true;
              confirmBtn.textContent = "作廢中…";
              const fn = window["${prefix}ModalSubmit"];
              if (typeof fn === "function") fn(reason, noteInput.value.trim());
            });
          })();
          </script>`;
}
