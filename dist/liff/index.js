"use strict";
/**
 * LIFF 路由：
 *  GET  /liff/employee-bind            -> 員工綁定 LIFF 頁（注入 LIFF_ID）
 *  GET  /liff/api/employee-bind/lookup -> 查詢綁定 token 對應的員工 username
 *  POST /liff/api/employee-bind/verify -> 驗 ID Token + 一次性 token，完成綁定
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLiffRouter = createLiffRouter;

const express_1 = require("express");
const fs_1 = require("fs");
const path_1 = require("path");
const index_js_1 = require("../db/index.js");
const liff_verify_js_1 = require("../lib/liff-verify.js");
const liff_bind_token_js_1 = require("../lib/liff-bind-token.js");
const employee_line_binding_js_1 = require("../lib/employee-line-binding.js");
const line_bot_control_js_1 = require("../lib/line-bot-control.js");

function readTemplate(name) {
    try {
        return (0, fs_1.readFileSync)((0, path_1.join)(__dirname, name), "utf8");
    } catch (e) {
        return null;
    }
}

function noStore(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
}

function createLiffRouter() {
    const router = express_1.Router();
    const dbPath = process.env.DB_PATH ?? "./data/songfu.db";

    // 員工綁定 LIFF 頁
    router.get("/employee-bind", (_req, res) => {
        const liffId = (process.env.LIFF_ID_EMPLOYEE_BIND || "").trim();
        const tpl = readTemplate("employee-bind.html");
        if (!tpl) {
            res.status(500).type("text/plain").send("LIFF 頁面樣板缺失");
            return;
        }
        // 把 LIFF_ID 注入頁面（前端 script 用 window.__LIFF_ID__）
        const html = tpl.replace(
            "<script src=\"https://static.line-scdn.net/liff/edge/2/sdk.js\">",
            `<script>window.__LIFF_ID__=${JSON.stringify(liffId)};</script>\n<script src="https://static.line-scdn.net/liff/edge/2/sdk.js">`
        );
        noStore(res);
        res.type("text/html").send(html);
    });

    // 查綁定 token 對應的員工帳號（不直接執行綁定，只用來在頁面顯示要綁誰）
    router.get("/api/employee-bind/lookup", async (req, res) => {
        try {
            const token = String(req.query?.t || "").trim();
            if (!token) {
                res.json({ ok: false, error: "missing token" });
                return;
            }
            const db = (0, index_js_1.getDb)(dbPath);
            const p = await (0, liff_bind_token_js_1.lookupLiffBindToken)(db, token);
            if (!p) {
                res.json({ ok: false, error: "連結已過期或無效" });
                return;
            }
            res.json({ ok: true, username: p.username, expiresAt: p.expiresAt });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    // 驗證 ID Token + 一次性 token，完成綁定
    router.post("/api/employee-bind/verify", express_1.json({ limit: "8kb" }), async (req, res) => {
        try {
            const { idToken, token, displayName } = req.body || {};
            if (!idToken || !token) {
                res.status(400).json({ ok: false, error: "missing idToken or token" });
                return;
            }
            const verified = await (0, liff_verify_js_1.verifyLineIdToken)(idToken);
            if (!verified.ok) {
                res.status(401).json({ ok: false, error: verified.error || "ID Token 驗證失敗" });
                return;
            }
            const lineUserId = verified.sub;
            const db = (0, index_js_1.getDb)(dbPath);
            const p = await (0, liff_bind_token_js_1.consumeLiffBindToken)(db, token);
            if (!p) {
                res.status(410).json({ ok: false, error: "連結已過期或已被使用" });
                return;
            }
            const username = String(p.username || "").trim();
            if (!username) {
                res.status(400).json({ ok: false, error: "綁定資料異常（缺 username）" });
                return;
            }
            await (0, employee_line_binding_js_1.bindLineUserIdToEmployee)(db, username, lineUserId, displayName || verified.name || null);
            try {
                await (0, line_bot_control_js_1.appendLineBotLog)(db, "employee_bound_liff", {
                    username,
                    lineUserId: lineUserId.slice(0, 8) + "…",
                    displayName: displayName || verified.name || null,
                });
            } catch (_) { /* ignore */ }
            res.json({ ok: true, username });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
        }
    });

    return router;
}
