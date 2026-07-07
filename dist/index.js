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
    app.use(express_1.default.json({ limit: "20mb" }));
    app.use(express_1.default.urlencoded({ extended: true, limit: "20mb" }));
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
    // 後台靜態檔（logo、模板背景、icon sprite 等）— 必須在 /admin 路由前掛載
    app.use("/admin/assets", express_1.default.static((0, path_1.join)(__dirname, "admin", "assets"), {
        maxAge: "1d",
        fallthrough: true,
    }));
    app.use("/admin", adminRouter);
    // LIFF 路由（員工綁定等內部 LIFF 頁面 + API）
    try {
        const liff_index_js_1 = require("./liff/index.js");
        app.use("/liff", liff_index_js_1.createLiffRouter());
        console.log("[startup] LIFF 路由已掛載 /liff");
    } catch (e) {
        console.error("[startup] LIFF 路由建立失敗:", e?.message || e);
    }
    // 隱私權政策 / 服務條款（供 LINE Console publish 用，公開可存取）
    try {
        const legal_index_js_1 = require("./legal/index.js");
        app.use(legal_index_js_1.createLegalRouter());
        console.log("[startup] 法律頁面已掛載 /privacy /terms");
    } catch (e) {
        console.error("[startup] 法律頁面建立失敗:", e?.message || e);
    }
    // 公開圖片端點：給 LINE 抓取群發圖片（無需 cookie）
    app.get("/broadcast-img/:id/:token", async (req, res) => {
        try {
            if (!dbReady) { res.status(503).type("text/plain").send("db not ready"); return; }
            const db = (0, index_js_1.getDb)(dbPath);
            const id = String(req.params.id || "").trim();
            const token = String(req.params.token || "").trim();
            if (!id || !token) { res.status(400).type("text/plain").send("bad request"); return; }
            const row = await db.prepare("SELECT mime_type, data_b64, token FROM broadcast_images WHERE id = ?").get(id);
            if (!row || String(row.token).trim() !== token) {
                res.status(404).type("text/plain").send("not found");
                return;
            }
            const buf = Buffer.from(String(row.data_b64), "base64");
            res.setHeader("Content-Type", row.mime_type || "image/jpeg");
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.send(buf);
        } catch (e) {
            console.error("[broadcast-img] error:", e?.message || e);
            res.status(500).type("text/plain").send("internal error");
        }
    });
    const wholesale_snapshot_js_1 = require("./lib/wholesale-snapshot.js");
    /** Cloud Scheduler 預抓北農行情：建議每日 06:00 / 10:00 / 14:00 各打一次。
     *  ?date=YYYY-MM-DD（預設今日）；可加 X-Wholesale-Job-Secret 限制。 */
    app.post("/api/jobs/wholesale-prefetch", async (req, res) => {
        try {
            if (!dbReady) { res.status(503).json({ ok: false, error: "db not ready" }); return; }
            const secret = (process.env.WHOLESALE_JOB_SECRET || process.env.RHYTHM_JOB_SECRET || process.env.LINE_WORKER_SECRET || "").trim();
            if (secret) {
                const got = String(req.headers["x-wholesale-job-secret"] || req.headers["x-rhythm-job-secret"] || "").trim();
                if (got !== secret) { res.status(401).type("text/plain").send("Unauthorized"); return; }
            }
            const dateStr = String(req.query.date || req.body?.date || "").trim() || new Date().toISOString().slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { res.status(400).json({ ok: false, error: "invalid date" }); return; }
            const db = (0, index_js_1.getDb)(dbPath);
            const snap = await (0, wholesale_snapshot_js_1.loadOrFetchWholesaleMarketPrices)(db, dateStr);
            res.json({
                ok: true,
                date: dateStr,
                source: snap.source,
                status: snap.status,
                count: (snap.prices || []).length,
                rawCount: snap.rawCount || 0,
                apiErrors: snap.apiErrors || [],
            });
        }
        catch (e) {
            console.error("[wholesale-prefetch]", e?.message || e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 400) });
        }
    });

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
    // 內稽：每日 N 點自動推送當日訂單摘要給每個客戶 LINE 群組（後台可切換時刻與啟用）
    const daily_summary_push_js_1 = require("./lib/daily-summary-push.js");
    let dailySummaryMark = null;
    setInterval(async () => {
        if (!dbReady) return;
        try {
            const db = (0, index_js_1.getDb)(dbPath);
            if (!(await daily_summary_push_js_1.isDailySummaryPushEnabled(db))) return;
            const targetHour = await daily_summary_push_js_1.getDailySummaryPushHour(db);
            if (taipeiHourNow() !== targetHour) return;
            const todayMark = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
            if (dailySummaryMark === todayMark) return;
            const out = await daily_summary_push_js_1.runDailySummaryPush(db);
            dailySummaryMark = todayMark;
            console.log("[daily-summary] auto push ok sent=%s skipped=%s errors=%s", out.sent, out.skipped, (out.errors||[]).length);
        } catch (e) {
            console.error("[daily-summary] auto push 失敗:", e?.message || e);
        }
    }, 60000);
})().catch((e) => {
    console.error("[startup] 無法啟動:", e);
    process.exit(1);
});
