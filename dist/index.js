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
    /** 輕量存活探測：供 Cloud Scheduler 保溫用，不查 DB、不呼叫外部服務（僅回 200 + OK） */
    app.get("/ping", (_req, res) => {
        res.status(200).type("text/plain").send("OK");
    });
    app.get("/health", (_req, res) => {
        if (!dbReady) {
            res.status(503).json({
                ok: false,
                service: "songfu_linebot",
                dbReady: false,
                ...(dbError ? { dbError: String(dbError) } : {}),
            });
            return;
        }
        res.json({
            ok: true,
            service: "songfu_linebot",
            dbReady: true,
        });
    });
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
    /** Cloud Tasks Worker：同步處理單一 LINE event（需 LINE_USE_CLOUD_TASKS=1 時由佇列呼叫） */
    app.post("/api/worker/process-line-event", async (req, res) => {
        try {
            const secret = process.env.LINE_WORKER_SECRET && String(process.env.LINE_WORKER_SECRET).trim();
            if (secret) {
                const got = String(req.headers["x-line-worker-secret"] || "").trim();
                if (got !== secret) {
                    res.status(401).type("text/plain").send("Unauthorized");
                    return;
                }
            }
            const ev = req.body?.event;
            if (!ev || typeof ev !== "object") {
                res.status(400).type("text/plain").send("missing event");
                return;
            }
            await (0, line_js_1.processLineWebhookEvents)([ev]);
            res.status(200).type("text/plain").send("Task Completed");
        }
        catch (e) {
            console.error("[worker] process-line-event", e?.message || e, e?.stack);
            res.status(500).type("text/plain").send(String(e?.message || e).slice(0, 500));
        }
    });
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
    const rhythm_analysis_js_1 = require("./lib/rhythm-analysis.js");
    app.post("/api/jobs/rhythm-daily", async (_req, res) => {
        try {
            if (!dbReady) {
                res.status(503).json({ ok: false, error: "db not ready" });
                return;
            }
            const secret = (process.env.RHYTHM_JOB_SECRET || process.env.LINE_WORKER_SECRET || "").trim();
            if (secret) {
                const got = String(_req.headers["x-rhythm-job-secret"] || "").trim();
                if (got !== secret) {
                    res.status(401).type("text/plain").send("Unauthorized");
                    return;
                }
            }
            const db = (0, index_js_1.getDb)(dbPath);
            const out = await rhythm_analysis_js_1.runRhythmDailyJob(db);
            res.json({ ok: true, ...out });
        }
        catch (e) {
            console.error("[rhythm-daily]", e?.message || e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 400) });
        }
    });
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
        <li><a href="/ping">輕量探測 /ping</a>（保溫用）</li>
        <li><a href="/health">健康檢查（含 DB 就緒狀態）</a></li>
      </ul>
    </body></html>`);
    });
    await new Promise((resolve, reject) => {
        const server = app.listen(PORT, "0.0.0.0", () => resolve());
        server.on("error", reject);
    });
    console.log(`[startup] listening on 0.0.0.0:${PORT}（路由已掛載，LINE webhook 可收訊）`);
    console.log(`[startup] LINE webhook: POST ${webhookPath}`);
    let rhythmScheduleMark = null;
    function taipeiHourNow() {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Taipei",
            hour: "numeric",
            hourCycle: "h23",
        }).formatToParts(new Date());
        const hp = parts.find((p) => p.type === "hour");
        return hp ? parseInt(hp.value, 10) : 0;
    }
    setInterval(async () => {
        if (!dbReady || process.env.RHYTHM_AUTO_SCHEDULE !== "1")
            return;
        try {
            if (taipeiHourNow() !== 8)
                return;
            const todayMark = rhythm_analysis_js_1.taipeiTodayIso();
            if (rhythmScheduleMark === todayMark)
                return;
            const db = (0, index_js_1.getDb)(dbPath);
            const out = await rhythm_analysis_js_1.runRhythmDailyJob(db);
            rhythmScheduleMark = todayMark;
            console.log("[rhythm] auto schedule ok", out);
        }
        catch (e) {
            console.error("[rhythm] auto schedule", e?.message || e);
        }
    }, 60000);
})().catch((e) => {
    console.error("[startup] 無法啟動:", e);
    process.exit(1);
});
