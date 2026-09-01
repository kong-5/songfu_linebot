"use strict";
/**
 * 不變式：dist/db/index.js 的 initSqlite 與 initPg 必須維持同一組資料表。
 *
 * 為什麼要有這條（2026-09-01 體檢）：
 *   雙份平行 schema 目前表名完全一致，但那是靠人力維持的——加一張表要在兩邊各寫一次
 *   DDL。而且**每一邊各有兩個來源**（很容易只改到其中一個）：
 *     SQLite：dist/db/schema.sql       ＋ initSqlite 內的 sqlite.exec("CREATE TABLE …")
 *     PG    ：dist/db/schema.pg.sql    ＋ initPg 內的 client.query("CREATE TABLE …")
 *   一旦漏了 PG 那邊，
 *   **本機 SQLite 測試全綠、部署到雲端 PG 才 500**，而且錯誤會出現在跟改動無關的地方。
 *   這是全專案失效模式最惡劣的一處，所以用最便宜的方式（靜態掃原始碼）鎖住。
 *
 * 這條測試擋不住什麼（老實說明，別誤以為有保障）：
 *   - 欄位差異、型別差異（TEXT vs TIMESTAMPTZ）、索引差異都不管，只比表名
 *   - 真正的型別回歸靠 cloudbuild 的 `npm run smoke:pg`（對真 postgres 跑 initPg）
 *
 * 改法：新增資料表時兩邊都要寫。SQLite 專屬的 `xxx_v2` 遷移暫存表除外
 *   （SQLite 不能 ALTER PRIMARY KEY，只能建新表搬資料；PG 直接 ALTER 不需要）。
 *
 * 跑法：npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DB_DIR = path.join(__dirname, "..", "dist", "db");
const SRC = fs.readFileSync(path.join(DB_DIR, "index.js"), "utf8");
const SCHEMA_SQLITE = fs.readFileSync(path.join(DB_DIR, "schema.sql"), "utf8");
const SCHEMA_PG = fs.readFileSync(path.join(DB_DIR, "schema.pg.sql"), "utf8");

/** 取出 `function initSqlite(` / `async function initPg(` 的函式主體（用大括號配對，不靠行號） */
function extractFunctionBody(src, header) {
    const start = src.indexOf(header);
    assert.notEqual(start, -1, `找不到 ${header}——db/index.js 結構改了，這條測試要跟著更新`);
    const braceStart = src.indexOf("{", start + header.length);
    assert.notEqual(braceStart, -1, `${header} 後找不到函式主體`);
    let depth = 0;
    for (let i = braceStart; i < src.length; i++) {
        const ch = src[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) return src.slice(braceStart, i + 1);
        }
    }
    throw new Error(`${header} 的大括號沒有配對成功`);
}

const CREATE_TABLE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/gi;

function tableNames(body) {
    const out = new Set();
    for (const m of body.matchAll(CREATE_TABLE)) {
        const name = m[1];
        // SQLite 專屬的遷移暫存表：建新表→搬資料→DROP 舊表→RENAME。PG 用 ALTER，沒有這種表。
        if (/_v2$/.test(name)) continue;
        out.add(name);
    }
    return out;
}

// 每一邊都是「schema 檔 ∪ init 函式內的 inline DDL」的聯集
function union(a, b) { return new Set([...a, ...b]); }
const sqliteTables = union(
    tableNames(SCHEMA_SQLITE),
    tableNames(extractFunctionBody(SRC, "function initSqlite("))
);
const pgTables = union(
    tableNames(SCHEMA_PG),
    tableNames(extractFunctionBody(SRC, "async function initPg("))
);

test("initSqlite 與 initPg 的資料表集合必須完全相等", () => {
    const onlySqlite = [...sqliteTables].filter((t) => !pgTables.has(t)).sort();
    const onlyPg = [...pgTables].filter((t) => !sqliteTables.has(t)).sort();

    assert.deepEqual(
        onlySqlite, [],
        "這些表只在 SQLite 有、PG 沒有 → 本機測試會全綠，部署到雲端才炸。" +
        "請到 dist/db/schema.pg.sql 或 initPg 補上同名表：" + onlySqlite.join(", ")
    );
    assert.deepEqual(
        onlyPg, [],
        "這些表只在 PG 有、SQLite 沒有 → 本機測試碰不到這段程式。" +
        "請到 dist/db/schema.sql 或 initSqlite 補上同名表：" + onlyPg.join(", ")
    );
});

test("兩邊都要抓得到合理數量的表（防止 regex 或函式邊界解析失效而空過）", () => {
    assert.ok(sqliteTables.size >= 70, `SQLite 側只解析到 ${sqliteTables.size} 張表，解析八成壞了`);
    assert.ok(pgTables.size >= 70, `PG 側只解析到 ${pgTables.size} 張表，解析八成壞了`);
    assert.equal(sqliteTables.size, pgTables.size);
});

test("體檢當下（2026-09-01）已知的核心表兩邊都在", () => {
    // 抽樣幾張「壞了會直接影響現場」的表當哨兵，避免解析退化成空集合還過關
    for (const t of [
        "orders", "order_items", "customers", "products",
        "stocktake_session", "stocktake_count", "stocktake_authorized_user",
        "erp_stock_items", "group_features", "data_change_log",
    ]) {
        assert.ok(sqliteTables.has(t), `SQLite 缺少核心表 ${t}`);
        assert.ok(pgTables.has(t), `PG 缺少核心表 ${t}`);
    }
});
