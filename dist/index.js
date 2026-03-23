"use strict";
console.log("[startup] songfu_linebot 開始啟動…");
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__importDefault) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
try {
    require("dotenv/config");
    console.log("[startup] dotenv 已載入");
} catch (e) {
    console.warn("[startup] dotenv 載入略過:", e.message);
}
const express_1 = __importDefault(require("express"));
const fs_1 = require("fs");
const path_1 = require("path");
const PORT = Number(process.env.PORT) || 4000;
const webhookPath = process.env.LINE_WEBHOOK_PATH ?? "/webhook";
const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
console.log("[startup] PORT=%s dbPath=%s DATABASE_URL=%s", PORT, dbPath, process.env.DATABASE_URL ? "已設定" : "未設定(SQLite)");
(async () => {
    if (!process.env.DATABASE_URL) {
        const dir = (0, path_1.dirname)(dbPath);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true });
            console.log("[startup] 已建立目錄:", dir);
        }
    }
    const app = (0, express_1.default)();
    let dbReady = false;
    let dbError = null;
    app.get("/health", (_req, res) => {
        res.json({
            ok: true,
            service: "songfu_linebot",
            dbReady,
            ...(dbError ? { dbError: String(dbError) } : {}),
        });
    });
    await new Promise((resolve, reject) => {
        const server = app.listen(PORT, "0.0.0.0", () => resolve());
        server.on("error", reject);
    });
    console.log(`[startup] listening on 0.0.0.0:${PORT}（Cloud Run 探測可通過，載入 db / webhook / admin…）`);
    console.log("[startup] 載入 db 模組…");
    const index_js_1 = require("./db/index.js");
    console.log("[startup] 初始化資料庫…");
    try {
        await (0, index_js_1.initDb)(dbPath);
        dbReady = true;
        console.log("[startup] 資料庫就緒");
    }
    catch (e) {
        dbError = e?.message || e;
        console.error("[startup] 資料庫初始化失敗:", dbError);
    }
    const dbDownHtml = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>資料庫未就緒</title></head><body style="font-family:sans-serif;padding:2rem;max-width:560px;margin:0 auto;"><h1>資料庫尚未連線成功</h1><p>請檢查 Cloud Run 的 <code>DATABASE_URL</code>（Supabase：<code>postgres</code> @ <code>db.&lt;ref&gt;.supabase.co:6543</code>），勿使用 <code>host=/cloudsql/...</code>。</p><p><a href="/health">/health</a></p></body></html>`;
    console.log("[startup] 載入 webhook / admin…");
    const line_js_1 = require("./webhook/line.js");
    const index_js_2 = require("./admin/index.js");
    let lineWebhookRouter;
    try {
        lineWebhookRouter = (0, line_js_1.createLineWebhook)();
    }
    catch (e) {
        console.error("[startup] LINE webhook 無法建立:", e?.message || e);
        lineWebhookRouter = express_1.default.Router();
        lineWebhookRouter.use((_req, res) => res.status(503).type("html").send(dbDownHtml));
    }
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
    }, lineWebhookRouter);
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    let adminRouter;
    try {
        adminRouter = (0, index_js_2.createAdminRouter)();
    }
    catch (e) {
        console.error("[startup] 後台無法建立:", e?.message || e);
        adminRouter = express_1.default.Router();
        adminRouter.use((_req, res) => res.status(503).type("html").send(dbDownHtml));
    }
    app.use("/admin", adminRouter);
    app.get("/", (_req, res) => {
        res.redirect(302, "/admin");
    });
    app.use((err, _req, res, _next) => {
        console.error("[app] 未處理錯誤:", err?.message || err, err?.stack);
        if (!res.headersSent)
            res.status(500).type("text/html").send(`<!DOCTYPE html><html lang="zh-TW"><head><meta charset="utf-8"><title>錯誤</title></head><body style="font-family:sans-serif;padding:2rem;"><h1>伺服器錯誤</h1><p>請稍後再試。</p><p><a href="/admin">回後台</a></p></body></html>`);
    });
    app.use((_req, res) => {
        res.status(404).type("text/html").send(`
    <!DOCTYPE html>
    <html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>找不到頁面</title></head>
    <body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto;">
      <h1>找不到頁面</h1>
      <p>您輸入的網址在此服務中不存在。</p>
      <p>請使用以下連結：</p>
      <ul>
        <li><a href="/admin">後台</a></li>
        <li><a href="/admin/line-binding">LINE 綁定檢查</a></li>
        <li><a href="/admin/customers">客戶管理</a></li>
        <li><a href="/health">健康檢查</a></li>
      </ul>
    </body></html>`);
    });
    console.log(`[startup] LINE webhook: POST ${webhookPath}`);
})().catch((e) => {
    console.error("[startup] 無法啟動:", e);
    process.exit(1);
});
