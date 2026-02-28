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
    if (DATABASE_URL && pgPool) {
        return createPgWrapper(pgPool);
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
    ];
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
async function initPg() {
    const pg = require("pg");
    pgPool = new pg.Pool({ connectionString: DATABASE_URL });
    const client = await pgPool.connect();
    try {
        const schema = (0, fs_1.readFileSync)(schemaPgPath, "utf-8");
        await client.query(schema);
    }
    finally {
        client.release();
    }
}
function initDb(dbPath) {
    if (DATABASE_URL) {
        console.log("[startup] 使用 PostgreSQL (Cloud SQL)");
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
