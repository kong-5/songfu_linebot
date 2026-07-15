#!/usr/bin/env node
"use strict";
/**
 * PostgreSQL 冒煙測試——攔「本機 SQLite 全綠、雲端 PG 才壞」的整類回歸
 *（歷史案例：customer-profile 42804 型別錯誤、DATE 回 Date 物件、sqlForPg 轉不動的語法）。
 *
 * 跑法：DATABASE_URL=postgres://... node scripts/pg-smoke.js
 *   - cloudbuild 內對 docker postgres 跑（見 cloudbuild.yaml smoke 步驟）
 *   - 本機也可對任何測試用 PG 跑（⚠ 會執行 initDb 的全部遷移，勿指向正式庫）
 * 內容：initPg 全套遷移（冪等）→ 核心查詢/寫入各走一輪 → 自我清理（smoke_ 前綴資料）。
 */
const assert = require("node:assert/strict");

async function waitForPg(url, timeoutMs = 60000) {
    const { Client } = require("pg");
    const deadline = Date.now() + timeoutMs;
    let lastErr;
    while (Date.now() < deadline) {
        const c = new Client({ connectionString: url });
        try { await c.connect(); await c.query("SELECT 1"); await c.end(); return; }
        catch (e) { lastErr = e; try { await c.end(); } catch (_) {} await new Promise((r) => setTimeout(r, 2000)); }
    }
    throw new Error("等不到 PostgreSQL 就緒：" + (lastErr?.message || lastErr));
}

(async () => {
    const url = (process.env.DATABASE_URL || "").trim();
    if (!url) { console.log("（未設 DATABASE_URL，略過 PG 冒煙）"); process.exit(0); }
    console.log("▶ 等待 PostgreSQL 就緒…");
    await waitForPg(url);

    console.log("▶ initDb（跑全套 initPg 遷移，冪等）…");
    const { initDb, getDb } = require("../dist/db/index.js");
    await initDb("./ignored-when-pg.db");
    const db = getDb("./ignored-when-pg.db");
    const P = "smoke_";

    // 先清掉上次殘留（可重跑）
    await db.prepare(`DELETE FROM order_items WHERE order_id LIKE '${P}%'`).run();
    await db.prepare(`DELETE FROM orders WHERE id LIKE '${P}%'`).run();
    await db.prepare(`DELETE FROM customers WHERE id LIKE '${P}%'`).run();
    await db.prepare(`DELETE FROM app_settings WHERE key LIKE '${P}%'`).run();
    await db.prepare(`DELETE FROM group_features WHERE group_id LIKE '${P}%'`).run();

    console.log("▶ 1/6 app_settings 原子 claim（upsert + changes 語意）…");
    const claim = async (mark) => {
        const r = await db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE app_settings.value <> excluded.value").run(P + "claim", mark);
        return Number(r?.changes || 0) === 1;
    };
    assert.equal(await claim("d1"), true);
    assert.equal(await claim("d1"), false);
    assert.equal(await claim("d2"), true);

    console.log("▶ 2/6 拆單唯一索引（ux_orders_split_key_day）…");
    await db.prepare("INSERT INTO customers (id, name) VALUES (?, ?)").run(P + "c1", "冒煙客戶");
    const insOrder = (id, no, key, status = "pending") =>
        db.prepare("INSERT INTO orders (id, order_no, customer_id, order_date, status, order_sub_split_key) VALUES (?,?,?,?,?,?)")
            .run(P + id, P + no, P + "c1", "2099-01-01", status, key);
    await insOrder("o1", "A1", "冒煙子客戶");
    let conflicted = false;
    try { await insOrder("o2", "A2", "冒煙子客戶"); } catch (e) { conflicted = /ux_orders_split_key_day|duplicate key/i.test(String(e?.message)); }
    assert.equal(conflicted, true, "同 key 第二張應撞唯一索引（索引若沒建成功這裡會抓到）");
    await insOrder("m1", "A3", "");
    await insOrder("m2", "A4", "");   // '' 主桶多張合法

    console.log("▶ 3/6 customer-profile 熱查詢（歷史 42804 案發點）…");
    const { computeCustomerProfile } = require("../dist/lib/customer-profile.js");
    const prof = await computeCustomerProfile(db, P + "c1");
    assert.ok(prof, "computeCustomerProfile 應回物件");

    console.log("▶ 4/6 group_features upsert＋讀回…");
    const gf = require("../dist/lib/group-features.js");
    await gf.setGroupFeatures(db, P + "G1", { order: false, stocktake: true, basket: true });
    assert.deepEqual(await gf.getGroupFeatures(db, P + "G1"), { order: false, stocktake: true, basket: true });

    console.log("▶ 5/6 DATE 型別（setTypeParser 後應回字串）…");
    const dateRow = await db.prepare("SELECT CURRENT_DATE AS d").get();
    assert.equal(typeof dateRow.d, "string", "DATE 應為 'YYYY-MM-DD' 字串，收到: " + typeof dateRow.d);
    const cntRow = await db.prepare("SELECT COUNT(*) AS n FROM customers WHERE id = ?").get(P + "c1");
    assert.equal(typeof cntRow.n, "number", "COUNT(INT8) 應為 Number");

    console.log("▶ 6/6 品項冪等鍵欄位存在＋交易寫入…");
    await db.transaction(async (tx) => {
        await tx.prepare("INSERT INTO order_items (id, order_id, raw_name, quantity, unit, need_review, src_line_message_id) VALUES (?,?,?,?,?,?,?)")
            .run(P + "it1", P + "o1", "冒煙品項", 1, "公斤", 0, P + "msg1");
    });
    const it = await db.prepare("SELECT src_line_message_id FROM order_items WHERE id = ?").get(P + "it1");
    assert.equal(it.src_line_message_id, P + "msg1");

    // 清理
    await db.prepare(`DELETE FROM order_items WHERE order_id LIKE '${P}%'`).run();
    await db.prepare(`DELETE FROM orders WHERE id LIKE '${P}%'`).run();
    await db.prepare(`DELETE FROM customers WHERE id LIKE '${P}%'`).run();
    await db.prepare(`DELETE FROM app_settings WHERE key LIKE '${P}%'`).run();
    await db.prepare(`DELETE FROM group_features WHERE group_id LIKE '${P}%'`).run();
    console.log("✅ PG 冒煙 6/6 全過");
    process.exit(0);
})().catch((e) => { console.error("❌ PG 冒煙失敗：", e); process.exit(1); });
