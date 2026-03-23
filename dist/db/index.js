"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__importDefault) ? mod : { default: mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.initDb = initDb;
exports.closeDb = closeDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = require("fs");
const path_1 = require("path");
const schemaPath = (0, path_1.join)(__dirname, "schema.sql");
const schemaPgPath = (0, path_1.join)(__dirname, "schema.pg.sql");
const DATABASE_URL = process.env.DATABASE_URL;
let db = null;
let pgPool = null;
/** Convert SQLite-style SQL to PostgreSQL (placeholders ? -> $1,$2 and datetime('now') -> CURRENT_TIMESTAMP) */
function sqlForPg(sql) {
    let s = sql.replace(/datetime\s*\(\s*['"]now['"]\s*\)/gi, "CURRENT_TIMESTAMP");
    s = s.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+app_settings\s*\(\s*key\s*,\s*value\s*\)\s*VALUES\s*\(\s*\?\s*,\s*\?\s*\)/gi,
        "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value");
    let n = 1;
    s = s.replace(/\?/g, () => "$" + n++);
    return s;
}
function createPgWrapper(pool) {
    return {
        prepare(sql) {
            return {
                get(...params) {
                    return pool.query(sqlForPg(sql), params).then((r) => r.rows[0] ?? null);
                },
                all(...params) {
                    return pool.query(sqlForPg(sql), params).then((r) => r.rows);
                },
                run(...params) {
                    return pool.query(sqlForPg(sql), params).then((r) => ({ changes: r.rowCount ?? 0 }));
                },
            };
        },
    };
}
function getDb(dbPath) {
    if (DATABASE_URL) {
        if (pgPool) {
            return createPgWrapper(pgPool);
        }
        throw new Error("PostgreSQL 尚未連線成功。請檢查 DATABASE_URL（Supabase 請用 Transaction Pooler 主機如 aws-0-區域.pooler.supabase.com、使用者 postgres.專案ref、埠 6543）與 Cloud Run Logs。");
    }
    if (!db) {
        const sqlite = new better_sqlite3_1.default(dbPath);
        sqlite.pragma("journal_mode = WAL");
        db = {
            prepare(sql) {
                const stmt = sqlite.prepare(sql);
                return {
                    get(...params) { return Promise.resolve(stmt.get(...params)); },
                    all(...params) { return Promise.resolve(stmt.all(...params)); },
                    run(...params) { return Promise.resolve(stmt.run(...params)); },
                };
            },
            close() { sqlite.close(); },
        };
    }
    return db;
}
function initSqlite(dbPath) {
    const sqlite = new better_sqlite3_1.default(dbPath);
    sqlite.pragma("journal_mode = WAL");
    const schema = (0, fs_1.readFileSync)(schemaPath, "utf-8");
    sqlite.exec(schema);
    const alters = [
        "ALTER TABLE customers ADD COLUMN teraoka_code TEXT",
        "ALTER TABLE customers ADD COLUMN hq_cust_code TEXT",
        "ALTER TABLE customers ADD COLUMN line_group_name TEXT",
        "ALTER TABLE customers ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE customers ADD COLUMN order_notes TEXT",
        "ALTER TABLE customers ADD COLUMN default_unit TEXT",
        "ALTER TABLE order_items ADD COLUMN remark TEXT",
        "ALTER TABLE customers ADD COLUMN route_line INTEGER",
        "ALTER TABLE orders ADD COLUMN order_no TEXT",
    ];
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS order_attachments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, line_message_id TEXT NOT NULL, created_at TEXT, FOREIGN KEY (order_id) REFERENCES orders(id))");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec("ALTER TABLE inventory_warehouse_products ADD COLUMN safety_stock REAL NOT NULL DEFAULT 0");
    }
    catch (_) { /* column may already exist */ }
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_sales (id TEXT PRIMARY KEY, record_date TEXT NOT NULL, warehouse_id TEXT NOT NULL, product_id TEXT NOT NULL, qty_sold REAL NOT NULL DEFAULT 0, imported_at TEXT)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS logistics_orders (id TEXT PRIMARY KEY, order_date TEXT NOT NULL, raw_message TEXT, memo TEXT, created_at TEXT)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS logistics_order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT, raw_name TEXT, quantity REAL NOT NULL DEFAULT 0, unit TEXT, amount TEXT, need_review INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (order_id) REFERENCES logistics_orders(id), FOREIGN KEY (product_id) REFERENCES products(id))");
    }
    catch (_) { /* tables may already exist */ }
    try {
        sqlite.exec("ALTER TABLE logistics_order_items ADD COLUMN amount TEXT");
    }
    catch (_) { /* column may already exist */ }
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS line_bot_state_log (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, detail TEXT, created_at TEXT)");
    }
    catch (_) { /* table may already exist */ }
    for (const alt of alters) {
        try {
            sqlite.exec(alt);
        }
        catch (_) { /* column may already exist */ }
    }
    db = {
        prepare(sql) {
            const stmt = sqlite.prepare(sql);
            return {
                get(...params) { return Promise.resolve(stmt.get(...params)); },
                all(...params) { return Promise.resolve(stmt.all(...params)); },
                run(...params) { return Promise.resolve(stmt.run(...params)); },
            };
        },
        close() { sqlite.close(); },
    };
}
function pgPoolOptions() {
    const raw = (DATABASE_URL || "").trim();
    // 連線字串內的 sslmode=require 可能讓 node-pg 仍驗證憑證鏈（自簽名鏈報錯）；改由 opts.ssl 強制關閉驗證
    let conn = raw.replace(/[?&]sslmode=[^&]*/gi, "");
    conn = conn.replace(/\?$/, "");
    const opts = {
        connectionString: conn,
        connectionTimeoutMillis: 20000,
        max: Number(process.env.PG_POOL_MAX || 8),
    };
    const needInsecureTls = /supabase\.(co|com)/i.test(raw) ||
        process.env.PGSSLMODE === "require" ||
        /[?&]sslmode=require/i.test(raw);
    if (needInsecureTls) {
        opts.ssl = { rejectUnauthorized: false };
    }
    return opts;
}
async function initPg() {
    const pg = require("pg");
    pgPool = new pg.Pool(pgPoolOptions());
    try {
        const client = await pgPool.connect();
        try {
            const schema = (0, fs_1.readFileSync)(schemaPgPath, "utf-8");
            await client.query(schema);
            try {
                await client.query("ALTER TABLE customers ADD COLUMN route_line INTEGER");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE orders ADD COLUMN order_no TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("CREATE TABLE IF NOT EXISTS order_attachments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), line_message_id TEXT NOT NULL, created_at TIMESTAMPTZ)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query("ALTER TABLE inventory_warehouse_products ADD COLUMN safety_stock DOUBLE PRECISION NOT NULL DEFAULT 0");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("CREATE TABLE IF NOT EXISTS erp_sales (id TEXT PRIMARY KEY, record_date TEXT NOT NULL, warehouse_id TEXT NOT NULL REFERENCES inventory_warehouses(id), product_id TEXT NOT NULL REFERENCES products(id), qty_sold DOUBLE PRECISION NOT NULL DEFAULT 0, imported_at TIMESTAMPTZ)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query("CREATE TABLE IF NOT EXISTS logistics_orders (id TEXT PRIMARY KEY, order_date TEXT NOT NULL, raw_message TEXT, memo TEXT, created_at TIMESTAMPTZ)");
                await client.query("CREATE TABLE IF NOT EXISTS logistics_order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES logistics_orders(id), product_id TEXT REFERENCES products(id), raw_name TEXT, quantity DOUBLE PRECISION NOT NULL DEFAULT 0, unit TEXT, amount TEXT, need_review INTEGER NOT NULL DEFAULT 0)");
            }
            catch (_) { /* tables may already exist */ }
            try {
                await client.query("ALTER TABLE logistics_order_items ADD COLUMN amount TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("CREATE TABLE IF NOT EXISTS line_bot_state_log (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, detail TEXT, created_at TIMESTAMPTZ)");
            }
            catch (_) { /* table may already exist */ }
        }
        finally {
            client.release();
        }
    }
    catch (e) {
        console.error("[startup] PostgreSQL 連線失敗，請檢查 DATABASE_URL（Supabase 請用 Pooling 連線字串、含 ssl）:", e.message || e);
        throw e;
    }
}
function initDb(dbPath) {
    if (DATABASE_URL) {
        console.log("[startup] 使用 PostgreSQL（Cloud SQL / Supabase 等）");
        return initPg();
    }
    console.log("[startup] 使用 SQLite（部署後資料不會保留，請在 Cloud Run 設定 DATABASE_URL）");
    initSqlite(dbPath);
}
async function closeDb() {
    if (pgPool) {
        await pgPool.end();
        pgPool = null;
    }
    if (db && typeof db.close === "function") {
        db.close();
    }
    db = null;
}
