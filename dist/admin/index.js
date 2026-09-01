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
const audit_js_1 = require("../lib/audit.js");
const parse_order_message_js_1 = require("../lib/parse-order-message.js");
const resolve_product_js_1 = require("../lib/resolve-product.js");
const vision_ocr_js_1 = require("../lib/vision-ocr.js");
const wholesale_price_js_1 = require("../lib/wholesale-price.js");
const wholesale_snapshot_js_1 = require("../lib/wholesale-snapshot.js");
const livestock_price_js_1 = require("../lib/livestock-price.js");
const line_bot_control_js_1 = require("../lib/line-bot-control.js");
const cash_feature_js_1 = require("../lib/cash-feature.js");
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
const users_js_1 = require("./users.js");
const announcements_js_1 = require("./announcements.js");
const calendar_js_1 = require("./calendar.js");
const quotes_js_1 = require("./quotes.js");
const dashboard_js_1 = require("./dashboard.js");
const analytics_js_1 = require("./analytics.js");
const baskets_js_1 = require("./baskets.js");
const analysis_js_1 = require("./analysis.js");
const freezer_fridge_js_1 = require("./freezer-fridge.js");
const review_js_1 = require("./review.js");
const export_backup_js_1 = require("./export-backup.js");
const lingyue_writeback_js_1 = require("./lingyue-writeback.js");
const ai_settings_js_1 = require("./ai-settings.js");
const imports_js_1 = require("./imports.js");
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
      ${(opts.canCash && opts.cashEnabled) ? `<details class="sf-nav-group" ${["cash","cash-collect","cash-customers","cash-report"].includes(active) ? "open" : ""}>
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
      <details class="sf-nav-group" ${["line-bot","users","cash-feature"].includes(active) ? "open" : ""}>
        <summary><div class="sf-nav-group-title">系統設定</div></summary>
        ${item("/admin/line-bot", "line-bot", "message", "LINE 機器人")}
        ${opts.canManageUsers ? item("/admin/cash/feature", "cash-feature", "money", "每日帳款收款", opts.cashEnabled ? "" : "已停用") : ""}
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
        sidebarOpts = { canCash: res.locals.canCash === true, cashEnabled: res.locals.cashEnabled === true, canManageUsers: res.locals.canManageUsers === true };
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
    // 稽核軌跡的實作已收斂到 dist/lib/audit.js（單一權威）。這裡保留同名同簽章的
    // 薄包裝，26 個域檔透過 ctx 拿到的還是 logDataChange(req, opts)，呼叫處不用改。
    // ⚠ 這條路徑是「主寫入 commit 後才補軌跡」＝失敗只留 log。要讓軌跡與主寫入
    //   同生共死，請在交易內改用 writeAudit(h, {...})，見 lib/audit.js 開頭說明。
    async function logDataChange(req, opts) {
        return (0, audit_js_1.writeAuditSafe)(db, { ...opts, actor: req.adminUsername || "" });
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
    // [fix 2026-09-01 體檢] 舊版節流可以用一個 header 完全繞過：
    //   (a) key 取 X-Forwarded-For 的「第一段」＝完全由用戶端自填，每次換一個值就換一把 key
    //   (b) loginFails.size > 1000 時整個 clear()，攻擊者塞 1000 把假 key 就能清空所有計數
    // 兩個一起用，線上密碼爆破等於沒有節流。修法：
    //   1. XFF 改取「最後一段」——那是 Cloud Run 附加上去的，用戶端偽造不了前面幾段的位置
    //   2. 另開一條「只看帳號、不看 IP」的計數：換 IP 也擋得住（這條才是真正防爆破的）
    //   3. 滿了改成淘汰最舊的一批（Map 保有插入順序），不再一次清光
    const LOGIN_FAIL_MAX_USER = 20; // 帳號層級放寬一點：太嚴會被人用「一直打錯」鎖住同事的帳號
    const LOGIN_FAILS_CAP = 5000;
    function clientIpForThrottle(req) {
        const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
        if (xff.length) return xff[xff.length - 1];
        return String(req.ip || "").trim();
    }
    function loginThrottleKeys(req, username) {
        return {
            ip: "ip|" + username + "|" + clientIpForThrottle(req),
            user: "user|" + username,   // 不含 IP：換 IP 重來也躲不掉
        };
    }
    function throttleBlocked(keys) {
        const now = Date.now();
        const a = loginFails.get(keys.ip);
        if (a && a.n >= LOGIN_FAIL_MAX && now < a.until) return true;
        const b = loginFails.get(keys.user);
        if (b && b.n >= LOGIN_FAIL_MAX_USER && now < b.until) return true;
        return false;
    }
    function bumpLoginFail(k) {
        const cur = loginFails.get(k) || { n: 0, until: 0 };
        cur.n += 1;
        cur.until = Date.now() + LOGIN_FAIL_WINDOW_MS;
        loginFails.delete(k);      // 重新 set 讓它移到 Map 尾端＝最近使用
        loginFails.set(k, cur);
        if (loginFails.size > LOGIN_FAILS_CAP) {
            // 淘汰最舊的一成，而不是 clear()——否則塞爆就等於解鎖
            const drop = Math.floor(LOGIN_FAILS_CAP / 10);
            let i = 0;
            for (const key of loginFails.keys()) { loginFails.delete(key); if (++i >= drop) break; }
        }
    }
    router.post("/login", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const users = await loadAdminUsers();
        const username = (req.body.username || "").trim();
        const password = (req.body.password || "").toString();
        const tkeys = loginThrottleKeys(req, username);
        if (throttleBlocked(tkeys)) {
            res.redirect("/admin/login?err=throttled");
            return;
        }
        const u = users.find((x) => x.username === username);
        if (!u || !verifyAdminPassword(password, u.passwordHash)) {
            bumpLoginFail(tkeys.ip);
            bumpLoginFail(tkeys.user);
            res.redirect("/admin/login?err=1");
            return;
        }
        loginFails.delete(tkeys.ip);
        loginFails.delete(tkeys.user);
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
        // [security 2026-09-01 體檢] CSRF：全站沒有 CSRF token，唯一防線是 cookie 的
        // SameSite=Lax。Lax 擋得住跨站的自動表單 POST，但擋不住 GET 型破壞性操作
        // （pathLooksLikeDelete 自承系統存在 GET + /delete 的模式，Lax 對跨站 top-level
        // GET 導航是會帶 cookie 的），舊版 Safari／某些 WebView 也可能把 Lax 當 None。
        // 這裡加一道低成本的同源檢查，覆蓋所有既有表單、不用改任何一頁：
        //   - 有 Origin → 必須同源
        //   - 沒有 Origin 但有 Referer → 用 Referer 比對
        //   - 兩者都沒有 → 放行（curl／內網代理等非瀏覽器客戶端；CSRF 要有瀏覽器才成立）
        // 機器端點（/lingyue-writeback/*）在上面的分支已經 return，不會走到這裡。
        if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
            const host = String(req.headers.host || "").trim();
            const origin = String(req.headers.origin || "").trim();
            const referer = String(req.headers.referer || "").trim();
            const hostOf = (u) => { try { return new URL(u).host; } catch (_) { return null; } };
            const src = origin || referer;
            if (src && host) {
                const srcHost = hostOf(src);
                if (srcHost && srcHost !== host) {
                    console.warn("[admin] 擋下跨站寫入請求 path=%s origin=%s host=%s", pathname, src, host);
                    res.status(403).type("text/plain")
                        .send("跨站請求已被阻擋。請直接從後台頁面操作，不要從其他網站送出表單。");
                    return;
                }
            }
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
        // [2026-08-30 停用取銷貨單] 總開關關著＝側欄不顯示「收款作業」；經理才看得到系統設定裡的開關入口。
        res.locals.cashEnabled = await cash_feature_js_1.cashFeatureEnabled(db);
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
        { title: "每日帳款收款（開關）", href: "/admin/cash/feature", keywords: ["cash", "收款", "銷貨", "取單", "停用"] },
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
    // 拆檔批次 6：人員/公告/行事曆/報價四域共用 ctx（只放跨域共用者）
    const ADMIN_MISC_CTX = {
        db, notionPage, logDataChange, requireManager, loadAdminUsers, saveAdminUsers,
        normalizeAdminUserRecord, hashAdminPassword, isAdminOwnerUsername, ADMIN_TITLES, ADMIN_OWNER_EMAIL,
        fmtTaipeiYMDHM, getTaipeiCalendarDateYYYYMMDD, nowSqlExpr,
        buildPromoFlexMessage, buildNoticeFlexMessage, buildCalendarFlexMessage,
    };
    // 拆檔批次 6：人員管理域搬至 ./users.js（原位註冊，順序不變）
    (0, users_js_1.registerUsersRoutes)(router, ADMIN_MISC_CTX);
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
        // [fix 2026-07-28 §五C1] 系統告警群組（ops_alert_group_id）：未設定＝notifyOps 全靜默 no-op，
        // 回寫三振／單號衝突／庫存推送失敗／LINE 漏單等告警都不會發出。這裡提供設定入口＋未設定紅字提示。
        let opsAlertGroupId = "";
        try {
            const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("ops_alert_group_id");
            opsAlertGroupId = r && r.value ? String(r.value).trim() : "";
        } catch (_) { /* ignore */ }
        let opsGroups = [];
        try {
            opsGroups = (await db.prepare("SELECT group_id, group_name FROM stocktake_group ORDER BY group_name").all()) || [];
        } catch (_) { opsGroups = []; }
        let logs = [];
        try {
            logs = await db.prepare("SELECT event_type, detail, created_at FROM line_bot_state_log ORDER BY created_at DESC LIMIT 80").all();
        }
        catch (_) { }
        const modeOpts = [
            { v: "always_on", l: "一律開啟（全天候辨識訂單）" },
            { v: "always_off", l: "一律關閉（停止訂單辨識・不呼叫 AI，省費用）" },
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
              <div style="font-size:14px;color:var(--txt-1);font-weight:500;margin-top:4px;">${accepting ? "訂單辨識：開啟" : "訂單辨識：已停用"}</div>
              <div style="font-size:11px;color:var(--txt-3);margin-top:4px;">${accepting ? "機器人會解析叫貨／可跑 AI" : "不呼叫 Gemini／不 OCR／不寫訂單（盤點・空籃・群組指令不受影響）"}</div>
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
                <p style="margin:0 0 10px;font-size:12px;color:var(--txt-3);line-height:1.6;">這是 <strong style="color:var(--txt-1);">LINE 訂單辨識的總開關</strong>。選「一律關閉」後，機器人仍會待在群組、仍回應 <code>#盤點</code>／空籃／取得群組ID 等指令，只是<strong style="color:var(--txt-1);">不再把一般文字與照片送 AI 解析成訂單</strong>（不產生 Gemini／OCR 費用）。日後要恢復收單，改回「一律開啟」並儲存即可，不需重新部署。</p>
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

            <div class="sf-card">
              <div class="sf-card-head">
                <div class="sf-card-title">${SF_ICONS.bell} 系統告警群組（ops）</div>
              </div>
              <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
                ${opsAlertGroupId ? "" : `<div class="sf-pill" style="align-self:flex-start;background:#fde8e8;color:#c0392b;border-color:#f5c6c6;">⚠ 尚未設定：回寫重複開單／庫存推送失敗／LINE 漏單等系統告警目前只記 log、不會推播</div>`}
                <p style="margin:0;font-size:12px;color:var(--txt-3);line-height:1.5;">選一個內部 LINE 群組接收系統告警（回寫三振、單號衝突、庫存推送失敗、LINE 訊息重試放棄漏單等）。群組需先與機器人互動過才會出現在清單（來源同盤點群組）。</p>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <select class="sf-select" name="ops_alert_group_id" style="min-width:280px;height:32px;">
                    <option value="">（未設定 — 不推播告警）</option>
                    ${(() => {
                        const seen = new Set();
                        const opts = opsGroups.map((g) => { seen.add(String(g.group_id)); return `<option value="${escapeAttr(g.group_id)}" ${String(g.group_id) === opsAlertGroupId ? "selected" : ""}>${escapeHtml(g.group_name || g.group_id)}</option>`; });
                        if (opsAlertGroupId && !seen.has(opsAlertGroupId)) opts.unshift(`<option value="${escapeAttr(opsAlertGroupId)}" selected>目前設定：${escapeHtml(opsAlertGroupId)}</option>`);
                        return opts.join("");
                    })()}
                  </select>
                  <a href="/admin/line-bot/ops-alert-test" class="sf-btn sm ghost">發測試告警</a>
                  ${_req.query.opstest === "sent" ? `<span class="sf-pill ok">已送出測試告警</span>` : ""}
                  ${_req.query.opstest === "nogroup" ? `<span class="sf-pill" style="background:#fde8e8;color:#c0392b;">尚未設定告警群組</span>` : ""}
                  ${_req.query.opstest === "notoken" ? `<span class="sf-pill" style="background:#fde8e8;color:#c0392b;">缺 LINE token，無法推播</span>` : ""}
                  ${_req.query.opstest === "fail" ? `<span class="sf-pill" style="background:#fde8e8;color:#c0392b;">推播失敗，請看紀錄</span>` : ""}
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
        // [fix 2026-07-28 §五C1] 系統告警群組：改動會影響所有 notifyOps 是否發得出去，留稽核。
        const opsGroupNew = String(req.body.ops_alert_group_id || "").trim();
        let opsGroupOld = "";
        try { const or = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("ops_alert_group_id"); opsGroupOld = or && or.value ? String(or.value).trim() : ""; } catch (_) { /* ignore */ }
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("ops_alert_group_id", opsGroupNew);
        if (opsGroupNew !== opsGroupOld) {
            try {
                await logDataChange(req, {
                    entityType: "app_settings",
                    entityId: "ops_alert_group_id",
                    action: "set",
                    summary: `系統告警群組：${opsGroupOld || "（未設定）"} → ${opsGroupNew || "（未設定）"}`,
                    meta: { before: opsGroupOld, after: opsGroupNew },
                });
            } catch (_) { /* ignore */ }
        }
        await (0, line_bot_control_js_1.appendLineBotLog)(db, "settings_saved", { mode: m, windowStart: wStart, windowEnd: wEnd, aiGate: aiGate === "1", suppressCustomerReply: suppressReply === "1", orderConfirmReplyEnabled: confirmEnabled === "1", orderConfirmReplyDelaySec: confirmDelay, dailySummaryPushEnabled: dailyEnabled === "1", dailySummaryPushHour: dailyHour });
        res.redirect("/admin/line-bot?ok=1");
    });
    // [fix 2026-07-28 §五C1] 發一則測試告警，確認 ops_alert_group_id 設定正確、機器人推得到。
    router.get("/line-bot/ops-alert-test", requireManager, async (req, res) => {
        try {
            const stamp = await getTaipeiCalendarDateYYYYMMDD();
            const r = await (0, ops_notify_js_1.notifyOps)(db, `🔔 系統告警測試（${stamp}）：這是一則由後台手動觸發的測試告警，收到代表告警群組設定正確。#${Date.now()}`);
            const flag = r && r.ok ? "sent" : (r && r.skipped === "no_group" ? "nogroup" : (r && r.skipped === "no_token" ? "notoken" : "fail"));
            res.redirect("/admin/line-bot?opstest=" + flag);
        } catch (e) {
            console.error("[ops-alert-test] 失敗:", e?.message || e);
            res.redirect("/admin/line-bot?opstest=fail");
        }
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
    // 拆檔批次 7：儀表板/分析/空籃/環境衛生共用 ctx（只放跨域共用者）
    // ⚠ QI 是 const（宣告在報價區塊），故本 ctx 與儀表板註冊呼叫都必須放在 QI 之後（批次 6 教訓）。
    const ADMIN_VIEW_CTX = {
        db, notionPage, logDataChange, requireManager, getWorkingDate,
        getTaipeiCalendarDateYYYYMMDD, fmtTaipeiYMDHM, fmtTaipeiMMDDHHmm, nowSqlExpr, QI,
    };
    // 拆檔批次 7：儀表板域搬至 ./dashboard.js（原位註冊，順序不變）
    (0, dashboard_js_1.registerDashboardRoutes)(router, ADMIN_VIEW_CTX);
    // 拆檔批次 7：營運分析域搬至 ./analytics.js（原位註冊，順序不變）
    (0, analytics_js_1.registerAnalyticsRoutes)(router, ADMIN_VIEW_CTX);
    // 拆檔批次 7：空籃記帳域搬至 ./baskets.js（原位註冊，順序不變）
    (0, baskets_js_1.registerBasketsRoutes)(router, ADMIN_VIEW_CTX);
    // 拆檔批次 7：分析報表域（稽核/辨識統計/AI 評測/叫貨節奏）搬至 ./analysis.js（原位註冊，順序不變）
    (0, analysis_js_1.registerAnalysisRoutes)(router, ADMIN_VIEW_CTX);
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
    // 拆檔批次 7：環境衛生域搬至 ./freezer-fridge.js（原位註冊，順序不變）
    (0, freezer_fridge_js_1.registerFreezerFridgeRoutes)(router, ADMIN_VIEW_CTX);
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
    // 拆檔批次 8：待確認品項/匯出備份/凌越機器端點/AI 設定/匯入五域共用 ctx。
    // buildLingyuePreview 等為 function 宣告（會提升），放這裡引用安全。
    const ADMIN_OPS_CTX = {
        db, notionPage, logDataChange, requireManager, getWorkingDate, getTaipeiCalendarDateYYYYMMDD,
        fmtTaipeiYMDHM, upload, parseRequestToSheet,
        buildLingyuePreview, formatOrderDateForLingyue, stkAdminTaipeiDate,
    };
    // 拆檔批次 8：待確認品項域搬至 ./review.js（原位註冊，順序不變）
    (0, review_js_1.registerReviewRoutes)(router, ADMIN_OPS_CTX);
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
    // 拆檔批次 8：匯出備份域搬至 ./export-backup.js（原位註冊，順序不變）
    (0, export_backup_js_1.registerExportBackupRoutes)(router, ADMIN_OPS_CTX);
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
    // 拆檔批次 8：凌越整合代理的機器端點搬至 ./lingyue-writeback.js（原位註冊，順序不變）
    (0, lingyue_writeback_js_1.registerLingyueWritebackRoutes)(router, ADMIN_OPS_CTX);
    // 收款域（銷貨統計／現金收款／現金日報表）模組路由（拆檔批次 2；註冊位置不可移動，維持原路由順序）
    (0, cash_js_1.registerCashRoutes)(router, {
        db,
        notionPage,
        logDataChange,
        getTaipeiCalendarDateYYYYMMDD,
    });
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
    // 拆檔批次 8：AI 設定域搬至 ./ai-settings.js（原位註冊，順序不變）
    (0, ai_settings_js_1.registerAiSettingsRoutes)(router, ADMIN_OPS_CTX);
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
    // 拆檔批次 8：匯入域搬至 ./imports.js（原位註冊，順序不變）
    (0, imports_js_1.registerImportsRoutes)(router, ADMIN_OPS_CTX);
    // 拆檔批次 4：群發域路由搬至 ./broadcast.js（原位註冊，順序不變；/announcements 留本檔）
    (0, broadcast_js_1.registerBroadcastRoutes)(router, {
        db, notionPage, logDataChange, requireManager, upload, buildPromoFlexMessage, buildNoticeFlexMessage, buildCalendarFlexMessage,
    });
    // 拆檔批次 6：公告域搬至 ./announcements.js（原位註冊，順序不變；nowSqlExpr 與行事曆共用留本檔）
    (0, announcements_js_1.registerAnnouncementsRoutes)(router, ADMIN_MISC_CTX);
    function nowSqlExpr() {
        return process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
    }

    // 拆檔批次 6：行事曆域搬至 ./calendar.js（原位註冊，順序不變）
    (0, calendar_js_1.registerCalendarRoutes)(router, ADMIN_MISC_CTX);
    // 拆檔批次 6：客戶報價域搬至 ./quotes.js（QI 儀表板的報價提醒卡也在用，留本檔經 ctx 傳入）。
    // 註冊點放在 QI 宣告之後：QI 是 const，在更前面求值會 TDZ；這中間本來就沒有路由，順序不受影響。
    (0, quotes_js_1.registerQuotesRoutes)(router, { ...ADMIN_MISC_CTX, QI });

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
