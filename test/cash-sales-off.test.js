"use strict";
/**
 * Smoke test：停用「取銷貨單／每日帳款收款」（2026-08-30）。
 * 背景：現場已不用收款作業，但這條線每天固定把凌越當日銷貨單（客戶、金額、未收）整份推上雲端
 * 保存＝白留一份高完整度的營業資料在外面。作法＝單一總開關 app_settings.cash_sales_enabled，
 * **未設定＝停用**（所以不需要一次性遷移，也不會被下次部署蓋回去）。
 *
 * 鎖住的行為：
 *   1. 全新 DB（沒有 cash_sales_enabled 這個鍵）＝停用；寫 1 才啟用；DB 壞掉也回停用（fail-closed）。
 *   2. 既有資料不動：停用不會刪 cash_sales_doc／cash_customer／收款紀錄（使用者要的是「先保留」）。
 *   3. 機器端點閘門：cash-ingest／cash-refresh-wait／cash-refresh-report 三支都在動資料之前先問開關。
 *   4. 後台閘門：所有 /cash* 路由共用的 requireCash 會問開關；只有開關頁 /cash/feature 例外
 *      （不然關掉就沒有入口開回來），且開關頁限經理。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const crypto = require("node:crypto");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-cashoff-"));
const DB_PATH = path.join(TMP, "smoke.db");
const SECRET = "test-secret-cashoff";
process.env.DB_PATH = DB_PATH;
process.env.ADMIN_SESSION_SECRET = SECRET;
process.env.LINGYUE_WRITEBACK_KEY = "test-writeback-key";
delete process.env.DATABASE_URL;

const ROOT = path.join(__dirname, "..");
const express = require("express");
const { initDb, getDb } = require("../dist/db/index.js");
const { createAdminRouter } = require("../dist/admin/index.js");
const { cashFeatureEnabled, setCashFeatureEnabled, CASH_FEATURE_KEY } = require("../dist/lib/cash-feature.js");

let db, server, baseUrl;

function signSession(username) {
    const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + 3600e3 })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    return payload + "." + sig;
}
const asUser = (u) => ({ cookie: "sf_admin_session=" + signSession(u) });
async function get(p, user = "boss") {
    const res = await fetch(baseUrl + p, { redirect: "manual", headers: asUser(user) });
    return { status: res.status, text: await res.text() };
}
async function postForm(p, body, user = "boss") {
    const res = await fetch(baseUrl + p, {
        method: "POST", redirect: "manual",
        headers: Object.assign({ "content-type": "application/x-www-form-urlencoded" }, asUser(user)),
        body,
    });
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
}

test.before(async () => {
    await initDb(DB_PATH);
    db = getDb(DB_PATH);
    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("admin_users", JSON.stringify([
        { username: "boss", name: "經理", passwordHash: "x:y", title: "經理", status: "active" },
        { username: "acc", name: "會計", passwordHash: "x:y", title: "行政", status: "active", canCash: true },
    ]));
    const app = express();
    app.use("/admin", createAdminRouter());
    await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
test.after(() => new Promise((r) => (server ? server.close(r) : r())));

test("1. 未設定＝停用；寫 1 才啟用；查詢失敗也回停用", async () => {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(CASH_FEATURE_KEY);
    assert.equal(row, undefined, "全新 DB 不該預先寫這個鍵（未設定就是停用，不必遷移）");
    assert.equal(await cashFeatureEnabled(db), false, "未設定必須視為停用");

    await setCashFeatureEnabled(db, true);
    assert.equal(await cashFeatureEnabled(db), true, "寫入 1 後應為啟用");
    await setCashFeatureEnabled(db, false);
    assert.equal(await cashFeatureEnabled(db), false, "寫入 0 後應為停用");

    const brokenDb = { prepare() { throw new Error("db down"); } };
    assert.equal(await cashFeatureEnabled(brokenDb), false, "查詢失敗必須 fail-closed（回停用）");
    assert.equal(await cashFeatureEnabled(null), false);
});

test("2. 停用不刪既有資料：銷貨快照與收款客戶原封不動", async () => {
    await db.prepare("INSERT OR REPLACE INTO cash_sales_doc (icpno, sp_no, doc_date, ct_no, ct_name, total, unpaid, paid) VALUES (?,?,?,?,?,?,?,?)")
        .run("00", "SMOKE0001", "2026-08-30", "C001", "測試客戶", 100, 100, 0);
    await setCashFeatureEnabled(db, false);
    const doc = await db.prepare("SELECT sp_no, total FROM cash_sales_doc WHERE sp_no = ?").get("SMOKE0001");
    assert.equal(doc?.sp_no, "SMOKE0001", "停用只擋新資料與畫面，既有銷貨快照必須留著");
    assert.equal(Number(doc.total), 100);
});

test("3. 機器端點：三支收款端點都在動資料之前先問開關", () => {
    const src = fs.readFileSync(path.join(ROOT, "dist/admin/lingyue-writeback.js"), "utf8");
    const at = (needle, label) => {
        const i = src.indexOf(needle);
        assert.ok(i > 0, `lingyue-writeback.js 找不到 ${label}（${needle}）`);
        return i;
    };
    const gate = "cash_feature_js_1.cashFeatureEnabled(db)";
    assert.equal(src.split(gate).length - 1, 3, "cash-ingest／cash-refresh-wait／cash-refresh-report 各要有一個閘門");

    const idxIngest = at('router.post("/lingyue-writeback/cash-ingest"', "cash-ingest 路由");
    const idxIngestGate = src.indexOf(gate, idxIngest);
    const idxIngestWrite = at('DELETE FROM cash_sales_doc WHERE icpno = ? AND doc_date = ?', "cash-ingest 覆蓋寫入");
    assert.ok(idxIngestGate > idxIngest && idxIngestGate < idxIngestWrite, "cash-ingest 必須先問開關再寫任何一列");

    const idxWait = at('router.get("/lingyue-writeback/cash-refresh-wait"', "cash-refresh-wait 路由");
    const idxWaitGate = src.indexOf(gate, idxWait);
    const idxHeartbeat = src.indexOf('"ly_agent_last_cash_wait_at"', idxWait);
    assert.ok(idxWaitGate > idxWait && idxWaitGate < idxHeartbeat, "cash-refresh-wait 必須先問開關，關著就別 hold 長連線");

    const idxReport = at('router.post("/lingyue-writeback/cash-refresh-report"', "cash-refresh-report 路由");
    const idxReportGate = src.indexOf(gate, idxReport);
    const idxNotify = src.indexOf("凌越重新取單失敗（代理回報）", idxReport);
    assert.ok(idxReportGate > idxReport && idxReportGate < idxNotify, "cash-refresh-report 關著時不得寫狀態或發告警");
});

test("4. 後台閘門：requireCash 問開關；開關頁例外且限經理", () => {
    const src = fs.readFileSync(path.join(ROOT, "dist/admin/cash.js"), "utf8");
    const idxRequire = src.indexOf("async function requireCash(req, res, next)");
    assert.ok(idxRequire > 0, "requireCash 應為 async（要 await 開關）");
    const idxGate = src.indexOf("cash_feature_js_1.cashFeatureEnabled(db)", idxRequire);
    const idxNext = src.indexOf("next();", idxGate);
    assert.ok(idxGate > idxRequire && idxNext > idxGate, "requireCash 必須先確認開關才放行");

    // 所有對外的 /cash 路由都掛 requireCash；唯二例外是開關頁本身
    const routes = [...src.matchAll(/router\.(get|post)\("(\/cash[^"]*)"([^\n]*)/g)]
        .map((m) => ({ path: m[2], rest: m[3] }));
    assert.ok(routes.length >= 15, "應抓得到收款域全部路由");
    for (const r of routes) {
        if (r.path === "/cash/feature") continue;
        assert.ok(r.rest.includes("requireCash"), `${r.path} 沒有掛 requireCash，會繞過停用閘門`);
    }
    const featureRoutes = routes.filter((r) => r.path === "/cash/feature");
    assert.equal(featureRoutes.length, 2, "開關頁應有 GET（看狀態）與 POST（切換）兩支");
    for (const r of featureRoutes) {
        assert.ok(!r.rest.includes("requireCash"), "開關頁不能走 requireCash，否則關掉後就開不回來");
    }
    assert.ok(src.includes('req.adminProfile?.title !== "經理"'), "開關頁必須限經理");
    assert.ok(src.includes("cash_feature_js_1.setCashFeatureEnabled"), "切換要寫進 app_settings");
    assert.ok(src.includes("每日帳款收款（取銷貨單）：${before"), "切換要留稽核軌跡（舊值→新值）");
});

test("5. 側欄：停用時不顯示「收款作業」，經理仍看得到系統設定入口", () => {
    const src = fs.readFileSync(path.join(ROOT, "dist/admin/index.js"), "utf8");
    assert.ok(src.includes("${(opts.canCash && opts.cashEnabled) ?"), "收款作業群組要同時看權限與總開關");
    assert.ok(src.includes('item("/admin/cash/feature", "cash-feature", "money", "每日帳款收款"'), "系統設定要有開關入口");
    assert.ok(src.includes("res.locals.cashEnabled = await cash_feature_js_1.cashFeatureEnabled(db);"), "登入中介層要帶出開關狀態");
});

test("6. 端對端（停用中）：後台頁面全擋、側欄不出現、機器端點不收資料", async () => {
    await setCashFeatureEnabled(db, false);

    for (const p of ["/admin/cash?icpno=00", "/admin/cash/collect?icpno=00", "/admin/cash/customers", "/admin/cash/daily-report", "/admin/cash/export.xlsx"]) {
        const r = await get(p);
        assert.equal(r.status, 403, p + " 停用時應被擋下");
    }
    const page = await get("/admin/cash?icpno=00");
    assert.ok(page.text.includes("已停用"), "被擋下時要看得到停用說明，不是空白 403");
    assert.ok(!page.text.includes("松富銷貨統計"), "側欄「收款作業」群組停用時不該出現");

    // 有收款權限但非經理：POST 也擋（且回 JSON 錯誤而不是頁面）
    const jr = await fetch(baseUrl + "/admin/cash/request-refresh", {
        method: "POST", redirect: "manual",
        headers: Object.assign({ "content-type": "application/json" }, asUser("acc")),
        body: JSON.stringify({ icpno: "00", date: "2026-08-30" }),
    });
    assert.equal(jr.status, 403, "重新取單停用時要擋");
    assert.match((await jr.json()).error || "", /停用/);
    const flag = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("cash_refresh_requested");
    assert.ok(!flag || !String(flag.value).trim(), "停用時不得留下待處理的『重新取單』旗標");

    // 機器端點：整包丟掉、回 200 disabled（讓代理安靜停下，不重試也不告警）
    const ing = await fetch(baseUrl + "/admin/lingyue-writeback/cash-ingest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-writeback-key": "test-writeback-key" },
        body: JSON.stringify({ icpno: "00", date: "2026-08-29", docs: [{ sp_no: "BLOCKED1", total: 999 }] }),
    });
    assert.equal(ing.status, 200);
    assert.equal((await ing.json()).disabled, true);
    const blocked = await db.prepare("SELECT sp_no FROM cash_sales_doc WHERE sp_no = ?").get("BLOCKED1");
    assert.equal(blocked, undefined, "停用時 cash-ingest 一列都不能寫進來");

    const waitRes = await fetch(baseUrl + "/admin/lingyue-writeback/cash-refresh-wait?timeout=25", {
        headers: { "x-writeback-key": "test-writeback-key" },
    });
    const waitJson = await waitRes.json();
    assert.equal(waitJson.disabled, true, "停用時長連線要立刻回 disabled，不 hold 25 秒");
    assert.equal(waitJson.refresh, false);
});

test("7. 端對端（開回來）：經理按啟用後整條線恢復；非經理不能動開關", async () => {
    const forbidden = await postForm("/admin/cash/feature", "enabled=1", "acc");
    assert.equal(forbidden.status, 403, "只有經理能開關這個功能");
    assert.equal(await cashFeatureEnabled(db), false);

    const ok = await postForm("/admin/cash/feature", "enabled=1", "boss");
    assert.equal(ok.status, 302);
    assert.equal(await cashFeatureEnabled(db), true);
    const audit = await db.prepare("SELECT summary FROM data_change_log WHERE entity_id = ? ORDER BY created_at DESC").get(CASH_FEATURE_KEY);
    assert.match(audit?.summary || "", /停用 → 啟用/, "開關異動要留稽核軌跡");

    const page = await get("/admin/cash?icpno=00");
    assert.equal(page.status, 200, "開回來後頁面應正常");
    assert.ok(page.text.includes("松富銷貨統計"), "側欄「收款作業」群組應回來");

    const ing = await fetch(baseUrl + "/admin/lingyue-writeback/cash-ingest", {
        method: "POST",
        headers: { "content-type": "application/json", "x-writeback-key": "test-writeback-key" },
        body: JSON.stringify({ icpno: "00", date: "2026-08-29", docs: [{ sp_no: "ALLOWED1", total: 500 }] }),
    });
    assert.equal(ing.status, 200);
    assert.ok(!(await ing.json()).disabled);
    const row = await db.prepare("SELECT total FROM cash_sales_doc WHERE sp_no = ?").get("ALLOWED1");
    assert.equal(Number(row?.total), 500, "開回來後 cash-ingest 應照常寫入");

    await setCashFeatureEnabled(db, false); // 收尾：回到停用（本專案現況）
});
