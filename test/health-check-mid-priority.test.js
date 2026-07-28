"use strict";
/**
 * Smoke test：健檢 backlog 中優先項修復（2026-07-27）。
 *   1. 空籃記帳 upsertBasketLogLines：主列建立/前值讀取/分項/總計/history 全在同一交易，
 *      且 history 不再吞錯（舊版主紀錄改成功但 history 失敗＝數字被改卻查不到前後值）
 *   2. 空籃 getOrCreateBasketLog 併發冪等：撞唯一索引時重讀既有列，不把 500 丟到司機手機
 *   3. 叫貨節奏 runRhythmDailyJob：先算完再單一短交易「清當日＋批次插入」，
 *      不再有「DELETE 成功、INSERT 到一半失敗」的殘缺清單
 *   4. 教育訓練「轉為課程」冪等：重按不再多建課程（舊版每按一次多一門孤兒課程）
 *   5. 報價品項 sort_order：改用 INSERT 內子查詢取號，不再先讀後寫製造重號
 *
 * 跑法：npm test（node --test test/）。
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "songfu-mid-"));
process.env.DB_PATH = path.join(TMP, "mid.db");
delete process.env.DATABASE_URL;

const { initDb, getDb } = require("../dist/db/index.js");
const basketLog = require("../dist/lib/basket-log.js");
const quoteReport = require("../dist/lib/quote-report.js");

let db;
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

test.before(async () => {
    await initDb(process.env.DB_PATH);
    db = getDb(process.env.DB_PATH);
    await db.prepare("INSERT INTO customers (id, name, active) VALUES (?, ?, 1)").run("c-mid", "中優先測試客戶");
});

test("空籃：一次回報就寫齊主列/分項/總計/history（全在同一交易）", async () => {
    const r = await basketLog.upsertBasketLogLines(db, {
        customerId: "c-mid", logDate: TODAY, lineGroupId: "G-mid",
        reporterUserId: "U1", reporterDisplayName: "司機甲",
        lines: [{ kind: "numbered", no: 1, takenTo: 3, pickedUp: 2 }, { kind: "square", no: 0, takenTo: 1, pickedUp: 1 }],
        rawMessage: "1號籃 去3回2 四角 去1回1", actor: "line",
    });
    assert.ok(r.logId, "應回傳 logId");
    const log = await db.prepare("SELECT taken_to, picked_up FROM basket_logs WHERE id = ?").get(r.logId);
    assert.equal(Number(log.taken_to), 4, "主列總計＝分項加總");
    assert.equal(Number(log.picked_up), 3);
    const lines = await db.prepare("SELECT COUNT(*) AS c FROM basket_log_lines WHERE basket_log_id = ?").get(r.logId);
    assert.equal(Number(lines.c), 2);
    // history 併進交易後，一定要有一筆（舊版是交易外＋吞錯，失敗就悄悄沒有）
    const hist = await db.prepare("SELECT COUNT(*) AS c FROM basket_log_history WHERE basket_log_id = ?").get(r.logId);
    assert.equal(Number(hist.c), 1, "history 快照必須與主寫入一起成功");
});

test("空籃：同客戶同日重複回報＝更新同一筆（不長第二筆主列），history 累積前後值", async () => {
    const first = await db.prepare("SELECT id FROM basket_logs WHERE customer_id = ? AND log_date = ?").get("c-mid", TODAY);
    const r = await basketLog.upsertBasketLogLines(db, {
        customerId: "c-mid", logDate: TODAY, lineGroupId: "G-mid",
        reporterUserId: "U1", reporterDisplayName: "司機甲",
        lines: [{ kind: "numbered", no: 1, takenTo: 5, pickedUp: 5 }],
        rawMessage: "改成 1號籃 去5回5", actor: "line",
    });
    assert.equal(r.logId, first.id, "同客戶同日必須沿用同一筆主列");
    const n = await db.prepare("SELECT COUNT(*) AS c FROM basket_logs WHERE customer_id = ? AND log_date = ?").get("c-mid", TODAY);
    assert.equal(Number(n.c), 1, "不可長出第二筆主列");
    const hist = await db.prepare("SELECT prev_taken_to, new_taken_to FROM basket_log_history WHERE basket_log_id = ? ORDER BY created_at DESC, id DESC").all(r.logId);
    assert.equal(hist.length, 2, "第二次回報要再留一筆軌跡");
    const latest = hist.find((h) => Number(h.new_taken_to) === 5);
    assert.ok(latest, "最新一筆的新值應為 5");
    assert.equal(Number(latest.prev_taken_to), 4, "前值應為上一次的總計 4");
});

test("空籃：getOrCreateBasketLog 併發撞唯一索引時重讀既有列（不丟 500 給司機）", async () => {
    // 直接製造「查完之後、插入之前有人先插了」的情境：先自行插一筆，再呼叫 helper
    const other = TODAY;
    await db.prepare("INSERT INTO customers (id, name, active) VALUES (?, ?, 1)").run("c-race", "併發測試客戶");
    await db.prepare("INSERT INTO basket_logs (id, customer_id, log_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .run("bl-race", "c-race", other, new Date().toISOString(), new Date().toISOString());
    const got = await basketLog.getOrCreateBasketLog(db, { customerId: "c-race", logDate: other });
    assert.equal(got.id, "bl-race", "應重用既有列");
    assert.equal(got.isNew, false);
});

test("叫貨節奏：訊號產生走單一交易（可重跑、當日清單完整替換）", async () => {
    const rhythm = require("../dist/lib/rhythm-analysis.js");
    const r1 = await rhythm.runRhythmDailyJob(db);
    assert.ok(r1 && typeof r1.inserted === "number", "應回傳 inserted 計數");
    const after1 = await db.prepare("SELECT COUNT(*) AS c FROM rhythm_daily_signals WHERE signal_date = ?").get(r1.signalDate);
    assert.equal(Number(after1.c), r1.inserted, "DB 內當日訊號數應等於回報的 inserted");
    // 重跑：當日清單完整替換而非累加
    const r2 = await rhythm.runRhythmDailyJob(db);
    const after2 = await db.prepare("SELECT COUNT(*) AS c FROM rhythm_daily_signals WHERE signal_date = ?").get(r2.signalDate);
    assert.equal(Number(after2.c), r2.inserted, "重跑後仍等於 inserted（沒有累加殘留）");
});

test("報價品項：連續新增的 sort_order 遞增不重號（改用 INSERT 內子查詢取號）", async () => {
    const rid = await quoteReport.createReport(db, { ym: "2099-01", seedWhenEmpty: false });
    await quoteReport.addItem(db, rid, { category: "生鮮蔬菜", name: "高麗菜", price: "30" });
    await quoteReport.addItem(db, rid, { category: "生鮮蔬菜", name: "小白菜", price: "25" });
    await quoteReport.addItem(db, rid, { category: "生鮮蔬菜", name: "青江菜", price: "28" });
    const rows = await db.prepare("SELECT sort_order FROM quote_item WHERE report_id = ? ORDER BY sort_order").all(rid);
    assert.equal(rows.length, 3);
    const orders = rows.map((r) => Number(r.sort_order));
    assert.equal(new Set(orders).size, 3, "三筆的 sort_order 不可重複，實得 " + JSON.stringify(orders));
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b), "應遞增");
});

test("報價品項：明確指定 sort_order 時照舊採用（不被子查詢覆蓋）", async () => {
    const rid = await quoteReport.createReport(db, { ym: "2099-02", seedWhenEmpty: false });
    await quoteReport.addItem(db, rid, { category: "雜貨", name: "醬油", price: "50", sort_order: 7 });
    // 注意：createReport 會沿用「上一份月報」當底稿，所以這份不只一筆——用品名定位
    const row = await db.prepare("SELECT sort_order FROM quote_item WHERE report_id = ? AND name = ?").get(rid, "醬油");
    assert.equal(Number(row.sort_order), 7);
});

// ── 教育訓練「轉為課程」冪等（需要起 admin server 打真路由，故獨立一組）──
test("教育訓練：計畫項目「轉為課程」重按不會多建課程", async () => {
    const express = require("express");
    const crypto = require("node:crypto");
    const SECRET = "test-secret-mid";
    process.env.ADMIN_SESSION_SECRET = SECRET;
    const { createAdminRouter } = require("../dist/admin/index.js");
    await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
        .run("admin_users", JSON.stringify([{ username: "tr", name: "訓練經理", passwordHash: "x:y", title: "經理", status: "active" }]));
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO training_plan (id, icpno, year, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run("tp-1", "00", "2026", "年度計畫", now, now);
    await db.prepare("INSERT INTO training_plan_item (id, plan_id, month, theme, planned_hours) VALUES (?, ?, ?, ?, ?)")
        .run("tpi-1", "tp-1", "3", "食品安全訓練", 2);

    const app = express();
    app.use("/admin", createAdminRouter());
    const srv = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    const payload = Buffer.from(JSON.stringify({ u: "tr", exp: Date.now() + 3600000 })).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    const base = "http://127.0.0.1:" + srv.address().port;
    const toCourse = () => fetch(base + "/admin/training/plans/items/tpi-1/to-course", {
        method: "POST", redirect: "manual",
        headers: { cookie: "sf_admin_session=" + payload + "." + sig, "content-type": "application/x-www-form-urlencoded" },
        body: "",
    });
    const r1 = await toCourse();
    assert.equal(r1.status, 302);
    const r2 = await toCourse();   // 重按（使用者按兩下／回上一頁再送出）
    assert.equal(r2.status, 302);
    srv.close();

    const courses = await db.prepare("SELECT id FROM training_course WHERE plan_item_id = ?").all("tpi-1");
    assert.equal(courses.length, 1, "重按只能有一門課程，實得 " + courses.length + " 門（舊版每按一次多一門孤兒課程）");
    const item = await db.prepare("SELECT course_id FROM training_plan_item WHERE id = ?").get("tpi-1");
    assert.equal(item.course_id, courses[0].id, "plan_item.course_id 應指向那唯一一門課程");
});
