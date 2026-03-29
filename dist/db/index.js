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
        "ALTER TABLE order_items ADD COLUMN display_order INTEGER",
        "ALTER TABLE customers ADD COLUMN route_line INTEGER",
        "ALTER TABLE orders ADD COLUMN order_no TEXT",
        "ALTER TABLE orders ADD COLUMN sheet_exported_at TEXT",
        "ALTER TABLE orders ADD COLUMN lingyue_exported_at TEXT",
        "ALTER TABLE customers ADD COLUMN known_sub_customers TEXT",
        "ALTER TABLE order_items ADD COLUMN sub_customer TEXT",
        "ALTER TABLE orders ADD COLUMN remark TEXT",
        "ALTER TABLE orders ADD COLUMN order_sub_split_key TEXT",
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
        sqlite.exec("CREATE TABLE IF NOT EXISTS logistics_order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT, raw_name TEXT, quantity REAL NOT NULL DEFAULT 0, unit TEXT, remark TEXT, amount TEXT, need_review INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (order_id) REFERENCES logistics_orders(id), FOREIGN KEY (product_id) REFERENCES products(id))");
    }
    catch (_) { /* tables may already exist */ }
    try {
        sqlite.exec("ALTER TABLE logistics_order_items ADD COLUMN amount TEXT");
    }
    catch (_) { /* column may already exist */ }
    try {
        sqlite.exec("ALTER TABLE logistics_order_items ADD COLUMN remark TEXT");
    }
    catch (_) { /* column may already exist */ }
    try {
        sqlite.exec("ALTER TABLE logistics_orders ADD COLUMN customer_id TEXT");
    }
    catch (_) { /* column may already exist */ }
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS line_bot_state_log (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, detail TEXT, created_at TEXT)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS wholesale_market_snapshots (id TEXT PRIMARY KEY, record_date TEXT NOT NULL, market_name TEXT NOT NULL, crop_name TEXT NOT NULL, category TEXT, high_price REAL, mid_price REAL, low_price REAL, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_wholesale_snap_date ON wholesale_market_snapshots(record_date)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS data_change_log (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          product_id TEXT,
          action TEXT NOT NULL,
          summary TEXT,
          meta_json TEXT,
          actor_username TEXT,
          created_at TEXT
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_data_change_product ON data_change_log(product_id)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_data_change_created ON data_change_log(created_at)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS customer_handwriting_hints (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          raw_key TEXT NOT NULL,
          raw_name_last TEXT,
          product_id TEXT NOT NULL,
          hit_count INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (product_id) REFERENCES products(id),
          UNIQUE(customer_id, raw_key)
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cust_handwriting_hints_customer ON customer_handwriting_hints(customer_id)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS customer_order_image_examples (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          source_order_id TEXT,
          image_path TEXT NOT NULL,
          parsed_json TEXT NOT NULL,
          quality_score INTEGER DEFAULT 100,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          order_id TEXT,
          attachment_id TEXT,
          note TEXT,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (attachment_id) REFERENCES order_attachments(id)
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_customer_examples ON customer_order_image_examples(customer_id, is_active)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cust_order_img_ex_customer ON customer_order_image_examples(customer_id)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cust_order_img_ex_order ON customer_order_image_examples(order_id)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS product_packaging_ratios (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          outer_unit TEXT NOT NULL,
          inner_unit TEXT NOT NULL,
          inner_count REAL NOT NULL,
          note TEXT,
          created_at TEXT,
          FOREIGN KEY (product_id) REFERENCES products(id)
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_product_pack_ratio ON product_packaging_ratios(product_id)");
        sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_product_pack_pair ON product_packaging_ratios(product_id, outer_unit, inner_unit)");
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
                await client.query("ALTER TABLE orders ADD COLUMN sheet_exported_at TIMESTAMPTZ");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE orders ADD COLUMN lingyue_exported_at TIMESTAMPTZ");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE order_items ADD COLUMN display_order INTEGER");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE customers ADD COLUMN known_sub_customers TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE order_items ADD COLUMN sub_customer TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE orders ADD COLUMN remark TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE orders ADD COLUMN order_sub_split_key TEXT");
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
                await client.query("CREATE TABLE IF NOT EXISTS logistics_order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES logistics_orders(id), product_id TEXT REFERENCES products(id), raw_name TEXT, quantity DOUBLE PRECISION NOT NULL DEFAULT 0, unit TEXT, remark TEXT, amount TEXT, need_review INTEGER NOT NULL DEFAULT 0)");
            }
            catch (_) { /* tables may already exist */ }
            try {
                await client.query("ALTER TABLE logistics_order_items ADD COLUMN amount TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE logistics_order_items ADD COLUMN remark TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE logistics_orders ADD COLUMN customer_id TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("CREATE TABLE IF NOT EXISTS line_bot_state_log (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, detail TEXT, created_at TIMESTAMPTZ)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS wholesale_market_snapshots (
            id TEXT PRIMARY KEY,
            record_date TEXT NOT NULL,
            market_name TEXT NOT NULL,
            crop_name TEXT NOT NULL,
            category TEXT,
            high_price DOUBLE PRECISION,
            mid_price DOUBLE PRECISION,
            low_price DOUBLE PRECISION,
            created_at TIMESTAMPTZ
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_wholesale_snap_date ON wholesale_market_snapshots(record_date)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS product_packaging_ratios (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL REFERENCES products(id),
            outer_unit TEXT NOT NULL,
            inner_unit TEXT NOT NULL,
            inner_count DOUBLE PRECISION NOT NULL,
            note TEXT,
            created_at TIMESTAMPTZ
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_product_pack_ratio ON product_packaging_ratios(product_id)");
                await client.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_product_pack_pair ON product_packaging_ratios(product_id, outer_unit, inner_unit)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS data_change_log (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            product_id TEXT,
            action TEXT NOT NULL,
            summary TEXT,
            meta_json TEXT,
            actor_username TEXT,
            created_at TIMESTAMPTZ
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_data_change_product ON data_change_log(product_id)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_data_change_created ON data_change_log(created_at)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS customer_order_image_examples (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL REFERENCES customers(id),
            source_order_id TEXT,
            image_path TEXT NOT NULL,
            parsed_json TEXT NOT NULL,
            quality_score INTEGER DEFAULT 100,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            order_id TEXT REFERENCES orders(id),
            attachment_id TEXT REFERENCES order_attachments(id),
            note TEXT
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_customer_examples ON customer_order_image_examples(customer_id, is_active)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_cust_order_img_ex_customer ON customer_order_image_examples(customer_id)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_cust_order_img_ex_order ON customer_order_image_examples(order_id)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS customer_handwriting_hints (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL REFERENCES customers(id),
            raw_key TEXT NOT NULL,
            raw_name_last TEXT,
            product_id TEXT NOT NULL REFERENCES products(id),
            hit_count INTEGER NOT NULL DEFAULT 1,
            updated_at TIMESTAMPTZ NOT NULL,
            UNIQUE(customer_id, raw_key)
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_cust_handwriting_hints_customer ON customer_handwriting_hints(customer_id)");
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
