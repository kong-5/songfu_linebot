"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const fs_1 = require("fs");
const path_1 = require("path");
const index_js_1 = require("./db/index.js");
const line_js_1 = require("./webhook/line.js");
const index_js_2 = require("./admin/index.js");
const PORT = Number(process.env.PORT) || 4000;
const webhookPath = process.env.LINE_WEBHOOK_PATH ?? "/webhook";
const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
// 確保資料庫目錄存在並初始化
const dir = (0, path_1.dirname)(dbPath);
if (!(0, fs_1.existsSync)(dir)) {
    (0, fs_1.mkdirSync)(dir, { recursive: true });
}
(0, index_js_1.initDb)(dbPath);
const app = (0, express_1.default)();
// Webhook 必須用「原始 body」給 LINE 驗證簽章，所以先掛、且用 text 不轉成 JSON
app.use(webhookPath, express_1.default.text({ type: "application/json" }), (req, _res, next) => {
    if (req.method === "POST" && typeof req.body === "string") {
        try {
            const b = JSON.parse(req.body);
            console.log("[LINE] POST /webhook 收到請求，events 數量:", b?.events?.length ?? 0);
        }
        catch {
            console.log("[LINE] POST /webhook 收到請求");
        }
    }
    next();
}, (0, line_js_1.createLineWebhook)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use("/admin", (0, index_js_2.createAdminRouter)());
app.get("/", (_req, res) => {
    res.type("text/html").send(`
    <h1>松富叫貨 LINE 機器人</h1>
    <p>服務運行中。</p>
    <ul>
      <li><a href="/admin">後台</a> － <a href="/admin/review">待確認品名</a>、<a href="/admin/orders">訂單</a>、<a href="/admin/customers">客戶</a>、<a href="/admin/import-customers">匯入客戶</a>、<a href="/admin/products">品項</a>、<a href="/admin/import">匯入品項</a>、<a href="/admin/import-teraoka">寺岡對照</a></li>
      <li><a href="/health">/health</a> － 健康檢查</li>
      <li>LINE Webhook：POST <code>${webhookPath}</code></li>
    </ul>
  `);
});
app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "songfu_linebot" });
});
app.listen(PORT, () => {
    console.log(`songfu_linebot listening on http://localhost:${PORT}`);
    console.log(`LINE webhook: POST ${webhookPath}`);
});
