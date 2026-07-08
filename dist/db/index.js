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
        // [fix 2026-07-08] 交易：從 pool 取單一 client 跑 BEGIN/COMMIT，中途丟錯自動 ROLLBACK。
        // fn 收到與 db 相同的 prepare 介面（get/all/run），所有語句共用同一連線＝原子性。
        // 只放「純寫入」進來（先在外面把解析/讀取算完），交易越短越好，避免長時間佔住連線。
        async transaction(fn) {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                const tx = {
                    prepare(sql) {
                        return {
                            get: (...params) => client.query(sqlForPg(sql), params).then((r) => r.rows[0] ?? null),
                            all: (...params) => client.query(sqlForPg(sql), params).then((r) => r.rows),
                            run: (...params) => client.query(sqlForPg(sql), params).then((r) => ({ changes: r.rowCount ?? 0 })),
                        };
                    },
                };
                const result = await fn(tx);
                await client.query("COMMIT");
                return result;
            }
            catch (e) {
                try { await client.query("ROLLBACK"); } catch (_) { /* 連線已壞，rollback 也會失敗，忽略 */ }
                throw e;
            }
            finally {
                client.release();
            }
        },
    };
}
/** 建立 SQLite 版 db 介面（含交易）；兩處建立點共用，避免重複。 */
function makeSqliteWrapper(sqlite) {
    return {
        prepare(sql) {
            const stmt = sqlite.prepare(sql);
            return {
                get(...params) { return Promise.resolve(stmt.get(...params)); },
                all(...params) { return Promise.resolve(stmt.all(...params)); },
                run(...params) { return Promise.resolve(stmt.run(...params)); },
            };
        },
        // [fix 2026-07-08] SQLite 交易：better-sqlite3 為同步單連線，BEGIN/COMMIT 包住寫入即可；
        // 失敗 ROLLBACK。僅用於本機開發，正式為 PostgreSQL。
        async transaction(fn) {
            sqlite.exec("BEGIN");
            try {
                const tx = {
                    prepare(sql) {
                        const stmt = sqlite.prepare(sql);
                        return {
                            get: (...params) => Promise.resolve(stmt.get(...params)),
                            all: (...params) => Promise.resolve(stmt.all(...params)),
                            run: (...params) => Promise.resolve(stmt.run(...params)),
                        };
                    },
                };
                const result = await fn(tx);
                sqlite.exec("COMMIT");
                return result;
            }
            catch (e) {
                try { sqlite.exec("ROLLBACK"); } catch (_) { /* ignore */ }
                throw e;
            }
        },
        close() { sqlite.close(); },
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
        db = makeSqliteWrapper(sqlite);
    }
    return db;
}
function initSqlite(dbPath) {
    const sqlite = new better_sqlite3_1.default(dbPath);
    sqlite.pragma("journal_mode = WAL");
    const schema = (0, fs_1.readFileSync)(schemaPath, "utf-8");
    sqlite.exec(schema);
    const alters = [
        "ALTER TABLE line_group_speakers ADD COLUMN dismissed_at TEXT",
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
        "ALTER TABLE orders ADD COLUMN line_message_id TEXT",
        "ALTER TABLE order_items ADD COLUMN confidence_score INTEGER",
        "ALTER TABLE customer_handwriting_hints ADD COLUMN wrong_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE customer_handwriting_hints ADD COLUMN last_hit_at TEXT",
        // 作廢機制：voided_at 為作廢時間（NULL=有效）；void_reason 例：ai_wrong/customer_changed/duplicate/other；void_note 自由文字；voided_by=員工 username 或 'liff:xxx'
        "ALTER TABLE order_items ADD COLUMN voided_at TEXT",
        "ALTER TABLE order_items ADD COLUMN voided_by TEXT",
        "ALTER TABLE order_items ADD COLUMN void_reason TEXT",
        "ALTER TABLE order_items ADD COLUMN void_note TEXT",
        // 訂單層級作廢原因（status='deleted' 仍是主要旗標，這幾欄補充原因）
        "ALTER TABLE orders ADD COLUMN voided_at TEXT",
        "ALTER TABLE orders ADD COLUMN voided_by TEXT",
        "ALTER TABLE orders ADD COLUMN void_reason TEXT",
        "ALTER TABLE orders ADD COLUMN void_note TEXT",
        // 訂單確認者／時間（顯示在訂單列表「已確認」徽章下方）
        "ALTER TABLE orders ADD COLUMN approved_by TEXT",
        "ALTER TABLE orders ADD COLUMN approved_at TEXT",
        // 客戶 CRM：員工交接備註（顯示在 /customers/:id/360 上方）
        "ALTER TABLE customers ADD COLUMN crm_handover_notes TEXT",
        // 凌越回寫：lingyue_doc_no=凌越配發單據號、lingyue_written_at=回寫時間
        "ALTER TABLE orders ADD COLUMN lingyue_doc_no TEXT",
        "ALTER TABLE orders ADD COLUMN lingyue_written_at TEXT",
        // 凌越按需匯入：使用者在網站點「轉入凌越」→ 標記排隊，內網 agent 長連線等待後寫入
        "ALTER TABLE orders ADD COLUMN lingyue_queued_at TEXT",
        "ALTER TABLE orders ADD COLUMN lingyue_queued_by TEXT",
        // 盤點：中價貨（品質較差）數量，與上貨合計為 counted_qty；mid_qty 單獨保留供品質標注
        "ALTER TABLE stocktake_count ADD COLUMN mid_qty REAL",
        // [fix 2026-07-08] 凌越 /wait 認領租約：agent 撿走時蓋時間戳，其他 agent／同一 agent 重啟在租約內不會重撿→防重複開單
        "ALTER TABLE orders ADD COLUMN lingyue_claimed_at TEXT",
        // [fix 2026-07-08] 凌越寫入失敗出口：累計嘗試次數與最後錯誤；permanent 或超過上限即移出佇列並顯示原因
        "ALTER TABLE orders ADD COLUMN lingyue_write_attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE orders ADD COLUMN lingyue_last_error TEXT",
    ];
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS order_attachments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, line_message_id TEXT NOT NULL, created_at TEXT, FOREIGN KEY (order_id) REFERENCES orders(id))");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_orders_line_message_id ON orders(line_message_id)");
    }
    catch (_) { /* index may already exist */ }
    // G13: orders.order_no UNIQUE — 防止多實例 Cloud Run 訂單號競態
    try {
        const dups = sqlite.prepare("SELECT order_no, COUNT(*) AS n FROM orders WHERE order_no IS NOT NULL AND order_no <> '' GROUP BY order_no HAVING COUNT(*) > 1").all();
        if (dups.length) {
            console.warn("[migration] orders.order_no 發現 %d 組重複，UNIQUE index 暫不建立。請至後台清查：", dups.length);
            for (const d of dups.slice(0, 10)) console.warn("  order_no=%s 出現 %d 次", d.order_no, d.n);
        } else {
            sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_order_no ON orders(order_no) WHERE order_no IS NOT NULL");
            console.log("[migration] orders.order_no UNIQUE index 已建立（或已存在）");
        }
    }
    catch (e) { console.warn("[migration] orders.order_no UNIQUE 檢查/建立失敗:", e?.message || e); }
    // G15: LINE 收單 session 持久化（SQLite）
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS line_collect_sessions (
          group_id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          all_order_ids_json TEXT,
          last_activity_at INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_line_sessions_last_activity ON line_collect_sessions(last_activity_at)");
    } catch (e) { console.warn("[migration] line_collect_sessions(SQLite) 建立失敗:", e?.message || e); }
    // [fix 2026-07-08] 訊息層級持久化去重表：line_message_id 只在「新建訂單」時落地，
    // 累加品項的訊息僅存記憶體 Set，跨實例／重啟／Cloud Tasks at-least-once 重投遞時 DB 去重查不到 → 品項重複寫入。
    // 這張表在每則訊息入口先 INSERT，衝突即代表已處理過，直接略過（冪等）。
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS processed_line_messages (message_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL)");
    } catch (e) { console.warn("[migration] processed_line_messages(SQLite) 建立失敗:", e?.message || e); }
    // [fix 2026-07-08] G16: 單位規格/客戶別名 去重＋唯一索引。
    // 過去兩表皆無唯一鍵，同(品項,單位)重複規格使換算取值不定、同(客戶,別名)重複使解析不定。
    // 去重保留每組最小 id（與讀取端 ORDER BY id LIMIT 1 一致＝行為不變），再建唯一索引杜絕新重複。
    try {
        const d1 = sqlite.prepare("SELECT COUNT(*) AS n FROM product_unit_specs WHERE id NOT IN (SELECT MIN(id) FROM product_unit_specs GROUP BY product_id, unit)").get();
        if (d1 && d1.n > 0) {
            sqlite.exec("DELETE FROM product_unit_specs WHERE id NOT IN (SELECT MIN(id) FROM product_unit_specs GROUP BY product_id, unit)");
            console.warn("[migration] product_unit_specs 移除 %d 筆重複(保留最早)", d1.n);
        }
        sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_product_unit_specs_prod_unit ON product_unit_specs(product_id, unit)");
    } catch (e) { console.warn("[migration] product_unit_specs 去重/唯一索引失敗:", e?.message || e); }
    try {
        const d2 = sqlite.prepare("SELECT COUNT(*) AS n FROM customer_product_aliases WHERE id NOT IN (SELECT MIN(id) FROM customer_product_aliases GROUP BY customer_id, alias)").get();
        if (d2 && d2.n > 0) {
            sqlite.exec("DELETE FROM customer_product_aliases WHERE id NOT IN (SELECT MIN(id) FROM customer_product_aliases GROUP BY customer_id, alias)");
            console.warn("[migration] customer_product_aliases 移除 %d 筆重複(保留最早)", d2.n);
        }
        sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_cust_prod_alias_cust_alias ON customer_product_aliases(customer_id, alias)");
    } catch (e) { console.warn("[migration] customer_product_aliases 去重/唯一索引失敗:", e?.message || e); }
    try {
        sqlite.exec("ALTER TABLE inventory_warehouse_products ADD COLUMN safety_stock REAL NOT NULL DEFAULT 0");
    }
    catch (_) { /* column may already exist */ }
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_sales (id TEXT PRIMARY KEY, record_date TEXT NOT NULL, warehouse_id TEXT NOT NULL, product_id TEXT NOT NULL, qty_sold REAL NOT NULL DEFAULT 0, imported_at TEXT)");
    }
    catch (_) { /* table may already exist */ }
    try {
        // 凌越貨品主檔目前庫存（SK_NOWQTY）快照。內網 agent 每次推送整批 → 全表覆蓋（DELETE+INSERT）。
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_stock_items (erp_code TEXT PRIMARY KEY, name TEXT, spec TEXT, unit TEXT, qty REAL NOT NULL DEFAULT 0, wh_code TEXT, icpno TEXT, updated_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh ON erp_stock_items(wh_code)");
    }
    catch (_) { /* table may already exist */ }
    try {
        // 凌越倉別設定：代號→中文名、是否納入盤點。代號來源＝erp_stock_items.wh_code。
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_warehouse (code TEXT PRIMARY KEY, name TEXT, include_stocktake INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT)");
    }
    catch (_) { /* table may already exist */ }
    try {
        // 盤點：白名單群組、盤點場次、盤點明細、需記效期的品項
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_group (group_id TEXT PRIMARY KEY, group_name TEXT, created_at TEXT)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_session (id TEXT PRIMARY KEY, wh_code TEXT, wh_name TEXT, count_date TEXT, status TEXT, group_id TEXT, created_by TEXT, created_by_name TEXT, item_count INTEGER NOT NULL DEFAULT 0, counted_count INTEGER NOT NULL DEFAULT 0, created_at TEXT, submitted_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_stk_session_date ON stocktake_session(count_date, wh_code)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_count (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, erp_code TEXT, name TEXT, spec TEXT, unit TEXT, sys_qty REAL, counted_qty REAL, expiry_json TEXT, updated_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_stk_count_session ON stocktake_count(session_id)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_expiry_item (erp_code TEXT PRIMARY KEY, expiry_unit TEXT, created_at TEXT)");
    }
    catch (_) { /* tables may already exist */ }
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
        sqlite.exec(`CREATE TABLE IF NOT EXISTS pending_line_groups (
          group_id TEXT PRIMARY KEY,
          source_type TEXT,
          group_name TEXT,
          first_seen_at TEXT,
          last_seen_at TEXT
        )`);
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS broadcast_messages (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT,
          payload_json TEXT NOT NULL,
          recipients_json TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          sent_at TEXT,
          sent_count INTEGER,
          created_by TEXT,
          created_at TEXT,
          updated_at TEXT
        )`);
        sqlite.exec(`CREATE TABLE IF NOT EXISTS broadcast_images (
          id TEXT PRIMARY KEY,
          token TEXT NOT NULL,
          filename TEXT,
          mime_type TEXT,
          size_bytes INTEGER,
          data_b64 TEXT NOT NULL,
          created_by TEXT,
          created_at TEXT
        )`);
        sqlite.exec(`CREATE TABLE IF NOT EXISTS dashboard_events (
          id TEXT PRIMARY KEY,
          event_date TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          color TEXT,
          created_by TEXT,
          created_at TEXT,
          updated_at TEXT
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_dashboard_events_date ON dashboard_events(event_date)");
    }
    catch (_) { /* tables may already exist */ }
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS wholesale_market_snapshots (id TEXT PRIMARY KEY, record_date TEXT NOT NULL, market_name TEXT NOT NULL, crop_name TEXT NOT NULL, category TEXT, high_price REAL, mid_price REAL, low_price REAL, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_wholesale_snap_date ON wholesale_market_snapshots(record_date)");
        // [feat 2026-07-08] 畜產／家禽（毛豬/白肉雞/雞蛋）行情快照
        sqlite.exec("CREATE TABLE IF NOT EXISTS livestock_price_snapshots (id TEXT PRIMARY KEY, record_date TEXT NOT NULL, category TEXT NOT NULL, item_label TEXT NOT NULL, price REAL, unit TEXT, market_name TEXT, extra_json TEXT, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_livestock_price_date ON livestock_price_snapshots(record_date)");
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
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_data_change_entity ON data_change_log(entity_type)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS gemini_usage_log (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          call_kind TEXT NOT NULL,
          model_name TEXT,
          latency_ms INTEGER,
          prompt_tokens INTEGER,
          candidates_tokens INTEGER,
          total_tokens INTEGER,
          prompt_version_id TEXT,
          created_at TEXT
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_gemini_usage_created ON gemini_usage_log(created_at)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_gemini_usage_customer ON gemini_usage_log(customer_id)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS prompt_versions (
          id TEXT PRIMARY KEY,
          slot TEXT NOT NULL,
          label TEXT NOT NULL,
          body TEXT NOT NULL,
          notes TEXT,
          created_at TEXT,
          updated_at TEXT
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_prompt_versions_slot ON prompt_versions(slot)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec("ALTER TABLE gemini_usage_log ADD COLUMN prompt_version_id TEXT");
    }
    catch (_) { /* column may already exist */ }
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
        sqlite.exec(`CREATE TABLE IF NOT EXISTS rhythm_daily_signals (
          id TEXT PRIMARY KEY,
          signal_date TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          signal_type TEXT NOT NULL,
          meta_json TEXT,
          created_at TEXT NOT NULL
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_rhythm_sig_date ON rhythm_daily_signals(signal_date)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_rhythm_sig_cust ON rhythm_daily_signals(customer_id)");
        sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_rhythm_sig_unique ON rhythm_daily_signals(signal_date, customer_id, product_id, signal_type)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS announcements (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          title TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          rendered_image_path TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT,
          updated_at TEXT,
          sent_at TEXT,
          sent_to_groups_json TEXT,
          created_by TEXT
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS company_calendar (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          kind TEXT NOT NULL,
          label TEXT NOT NULL,
          note TEXT,
          created_at TEXT
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_company_calendar_date ON company_calendar(date)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_company_calendar_kind ON company_calendar(kind)");
    }
    catch (_) { /* table may already exist */ }
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS commodity_prices (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          source TEXT,
          record_date TEXT NOT NULL,
          unit TEXT,
          spec TEXT,
          price REAL,
          high_price REAL,
          mid_price REAL,
          low_price REAL,
          note TEXT,
          created_at TEXT,
          updated_at TEXT
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_commodity_prices_date ON commodity_prices(record_date)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_commodity_prices_cat ON commodity_prices(category)");
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
    try {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS complaint_handling (
          order_id TEXT PRIMARY KEY,
          handle_status TEXT NOT NULL DEFAULT 'pending',
          handler TEXT,
          note TEXT,
          resolved_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(id)
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_complaint_handling_status ON complaint_handling(handle_status)");
        sqlite.exec(`CREATE TABLE IF NOT EXISTS basket_logs (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          log_date TEXT NOT NULL,
          taken_to INTEGER,
          picked_up INTEGER,
          line_group_id TEXT,
          reporter_user_id TEXT,
          reporter_display_name TEXT,
          raw_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        )`);
        sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_basket_logs_cust_date ON basket_logs(customer_id, log_date)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_basket_logs_date ON basket_logs(log_date)");
        sqlite.exec(`CREATE TABLE IF NOT EXISTS basket_log_history (
          id TEXT PRIMARY KEY,
          basket_log_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          log_date TEXT NOT NULL,
          prev_taken_to INTEGER,
          prev_picked_up INTEGER,
          new_taken_to INTEGER,
          new_picked_up INTEGER,
          prev_lines_json TEXT,
          new_lines_json TEXT,
          actor TEXT,
          reporter_user_id TEXT,
          raw_message TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (basket_log_id) REFERENCES basket_logs(id)
        )`);
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_basket_log_hist_log ON basket_log_history(basket_log_id)");
        sqlite.exec(`CREATE TABLE IF NOT EXISTS basket_log_lines (
          id TEXT PRIMARY KEY,
          basket_log_id TEXT NOT NULL,
          basket_kind TEXT NOT NULL,
          basket_no INTEGER NOT NULL DEFAULT 0,
          taken_to INTEGER NOT NULL DEFAULT 0,
          picked_up INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (basket_log_id) REFERENCES basket_logs(id)
        )`);
        sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_basket_log_lines_uniq ON basket_log_lines(basket_log_id, basket_kind, basket_no)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_basket_log_lines_log ON basket_log_lines(basket_log_id)");
        // 既有 DB 補欄位（不存在才加）
        try { sqlite.exec("ALTER TABLE basket_log_history ADD COLUMN prev_lines_json TEXT"); } catch (_) {}
        try { sqlite.exec("ALTER TABLE basket_log_history ADD COLUMN new_lines_json TEXT"); } catch (_) {}
    }
    catch (_) { /* table may already exist */ }
    for (const alt of alters) {
        try {
            sqlite.exec(alt);
        }
        catch (_) { /* column may already exist */ }
    }
    db = makeSqliteWrapper(sqlite);
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
                await client.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS confidence_score INTEGER");
            }
            catch (_) {
                try {
                    await client.query("ALTER TABLE order_items ADD COLUMN confidence_score INTEGER");
                }
                catch (_e) { /* column may exist */ }
            }
            try {
                await client.query("ALTER TABLE customer_handwriting_hints ADD COLUMN IF NOT EXISTS wrong_count INTEGER NOT NULL DEFAULT 0");
            }
            catch (_) {
                try {
                    await client.query("ALTER TABLE customer_handwriting_hints ADD COLUMN wrong_count INTEGER NOT NULL DEFAULT 0");
                }
                catch (_e) { /* column may exist */ }
            }
            try {
                await client.query("ALTER TABLE customer_handwriting_hints ADD COLUMN IF NOT EXISTS last_hit_at TIMESTAMPTZ");
            }
            catch (_) {
                try {
                    await client.query("ALTER TABLE customer_handwriting_hints ADD COLUMN last_hit_at TIMESTAMPTZ");
                }
                catch (_e) { /* column may exist */ }
            }
            // 群組發言者「非公司人員」排除旗標
            try { await client.query("ALTER TABLE line_group_speakers ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ"); } catch (_) {}
            // 作廢機制欄位（品項）
            try { await client.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ"); } catch (_) {}
            try { await client.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_by TEXT"); } catch (_) {}
            try { await client.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS void_reason TEXT"); } catch (_) {}
            try { await client.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS void_note TEXT"); } catch (_) {}
            // 作廢機制欄位（訂單）
            try { await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ"); } catch (_) {}
            try { await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_by TEXT"); } catch (_) {}
            try { await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS void_reason TEXT"); } catch (_) {}
            try { await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS void_note TEXT"); } catch (_) {}
            try { await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_by TEXT"); } catch (_) {}
            try { await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ"); } catch (_) {}
            // CRM 員工交接備註（customers）
            try { await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS crm_handover_notes TEXT"); } catch (_) {}
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
                await client.query("ALTER TABLE orders ADD COLUMN line_message_id TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE orders ADD COLUMN lingyue_doc_no TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE orders ADD COLUMN lingyue_written_at TIMESTAMPTZ");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE orders ADD COLUMN lingyue_queued_at TIMESTAMPTZ");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE orders ADD COLUMN lingyue_queued_by TEXT");
            }
            catch (_) { /* column may already exist */ }
            // [fix 2026-07-08] 凌越 /wait 認領租約欄位（防多 agent／重啟重複開單）
            try {
                await client.query("ALTER TABLE orders ADD COLUMN lingyue_claimed_at TIMESTAMPTZ");
            }
            catch (_) { /* column may already exist */ }
            // [fix 2026-07-08] 凌越寫入失敗出口欄位
            try {
                await client.query("ALTER TABLE orders ADD COLUMN lingyue_write_attempts INTEGER NOT NULL DEFAULT 0");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("ALTER TABLE orders ADD COLUMN lingyue_last_error TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                await client.query("CREATE INDEX IF NOT EXISTS idx_orders_line_message_id ON orders(line_message_id)");
            }
            catch (_) { /* index may already exist */ }
            // G13: orders.order_no UNIQUE — 防止多實例 Cloud Run 訂單號競態
            try {
                const dupRes = await client.query("SELECT order_no, COUNT(*) AS n FROM orders WHERE order_no IS NOT NULL AND order_no <> '' GROUP BY order_no HAVING COUNT(*) > 1");
                const dups = dupRes.rows || [];
                if (dups.length) {
                    console.warn("[migration] orders.order_no 發現 %d 組重複，UNIQUE index 暫不建立。請至後台清查：", dups.length);
                    for (const d of dups.slice(0, 10)) console.warn("  order_no=%s 出現 %s 次", d.order_no, d.n);
                } else {
                    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_order_no ON orders(order_no) WHERE order_no IS NOT NULL");
                    console.log("[migration] orders.order_no UNIQUE index 已建立（或已存在）");
                }
            }
            catch (e) { console.warn("[migration] orders.order_no UNIQUE 檢查/建立失敗:", e?.message || e); }
            // G15: LINE 收單 session 持久化（PostgreSQL）
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS line_collect_sessions (
                  group_id TEXT PRIMARY KEY,
                  order_id TEXT NOT NULL,
                  customer_id TEXT NOT NULL,
                  all_order_ids_json TEXT,
                  last_activity_at BIGINT NOT NULL,
                  updated_at TIMESTAMPTZ NOT NULL
                )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_line_sessions_last_activity ON line_collect_sessions(last_activity_at)");
            } catch (e) { console.warn("[migration] line_collect_sessions(PG) 建立失敗:", e?.message || e); }
            // [fix 2026-07-08] 訊息層級持久化去重表（PG 版，同 SQLite）：跨實例／重啟／Cloud Tasks 重投遞冪等去重。
            try {
                await client.query("CREATE TABLE IF NOT EXISTS processed_line_messages (message_id TEXT PRIMARY KEY, processed_at TIMESTAMPTZ NOT NULL)");
            } catch (e) { console.warn("[migration] processed_line_messages(PG) 建立失敗:", e?.message || e); }
            // [fix 2026-07-08] G16: 單位規格/客戶別名 去重＋唯一索引（PG 版，同 SQLite；保留每組最小 id＝與讀取端 ORDER BY id 一致）
            try {
                const d1 = await client.query("SELECT COUNT(*) AS n FROM product_unit_specs WHERE id NOT IN (SELECT MIN(id) FROM product_unit_specs GROUP BY product_id, unit)");
                const n1 = Number(d1.rows?.[0]?.n || 0);
                if (n1 > 0) {
                    await client.query("DELETE FROM product_unit_specs WHERE id NOT IN (SELECT MIN(id) FROM product_unit_specs GROUP BY product_id, unit)");
                    console.warn("[migration] product_unit_specs 移除 %d 筆重複(保留最早)", n1);
                }
                await client.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_product_unit_specs_prod_unit ON product_unit_specs(product_id, unit)");
            } catch (e) { console.warn("[migration] product_unit_specs 去重/唯一索引失敗:", e?.message || e); }
            try {
                const d2 = await client.query("SELECT COUNT(*) AS n FROM customer_product_aliases WHERE id NOT IN (SELECT MIN(id) FROM customer_product_aliases GROUP BY customer_id, alias)");
                const n2 = Number(d2.rows?.[0]?.n || 0);
                if (n2 > 0) {
                    await client.query("DELETE FROM customer_product_aliases WHERE id NOT IN (SELECT MIN(id) FROM customer_product_aliases GROUP BY customer_id, alias)");
                    console.warn("[migration] customer_product_aliases 移除 %d 筆重複(保留最早)", n2);
                }
                await client.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_cust_prod_alias_cust_alias ON customer_product_aliases(customer_id, alias)");
            } catch (e) { console.warn("[migration] customer_product_aliases 去重/唯一索引失敗:", e?.message || e); }
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
                // 凌越貨品主檔目前庫存（SK_NOWQTY）快照。內網 agent 每次推送整批 → 全表覆蓋（DELETE+INSERT）。
                await client.query("CREATE TABLE IF NOT EXISTS erp_stock_items (erp_code TEXT PRIMARY KEY, name TEXT, spec TEXT, unit TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 0, wh_code TEXT, icpno TEXT, updated_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh ON erp_stock_items(wh_code)");
            }
            catch (_) { /* table may already exist */ }
            try {
                // 凌越倉別設定：代號→中文名、是否納入盤點。
                await client.query("CREATE TABLE IF NOT EXISTS erp_warehouse (code TEXT PRIMARY KEY, name TEXT, include_stocktake INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_group (group_id TEXT PRIMARY KEY, group_name TEXT, created_at TEXT)");
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_session (id TEXT PRIMARY KEY, wh_code TEXT, wh_name TEXT, count_date TEXT, status TEXT, group_id TEXT, created_by TEXT, created_by_name TEXT, item_count INTEGER NOT NULL DEFAULT 0, counted_count INTEGER NOT NULL DEFAULT 0, created_at TEXT, submitted_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_stk_session_date ON stocktake_session(count_date, wh_code)");
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_count (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, erp_code TEXT, name TEXT, spec TEXT, unit TEXT, sys_qty DOUBLE PRECISION, counted_qty DOUBLE PRECISION, expiry_json TEXT, updated_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_stk_count_session ON stocktake_count(session_id)");
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_expiry_item (erp_code TEXT PRIMARY KEY, expiry_unit TEXT, created_at TEXT)");
                await client.query("ALTER TABLE stocktake_count ADD COLUMN IF NOT EXISTS mid_qty DOUBLE PRECISION");
            }
            catch (_) { /* tables may already exist */ }
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
                await client.query(`CREATE TABLE IF NOT EXISTS pending_line_groups (
            group_id TEXT PRIMARY KEY,
            source_type TEXT,
            group_name TEXT,
            first_seen_at TIMESTAMPTZ,
            last_seen_at TIMESTAMPTZ
          )`);
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS broadcast_messages (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT,
            payload_json TEXT NOT NULL,
            recipients_json TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            sent_at TIMESTAMPTZ,
            sent_count INTEGER,
            created_by TEXT,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
          )`);
                await client.query(`CREATE TABLE IF NOT EXISTS broadcast_images (
            id TEXT PRIMARY KEY,
            token TEXT NOT NULL,
            filename TEXT,
            mime_type TEXT,
            size_bytes INTEGER,
            data_b64 TEXT NOT NULL,
            created_by TEXT,
            created_at TIMESTAMPTZ
          )`);
                await client.query(`CREATE TABLE IF NOT EXISTS dashboard_events (
            id TEXT PRIMARY KEY,
            event_date TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            color TEXT,
            created_by TEXT,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_dashboard_events_date ON dashboard_events(event_date)");
            }
            catch (_) { /* tables may already exist */ }
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
            // [feat 2026-07-08] 畜產／家禽行情快照
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS livestock_price_snapshots (
            id TEXT PRIMARY KEY,
            record_date TEXT NOT NULL,
            category TEXT NOT NULL,
            item_label TEXT NOT NULL,
            price DOUBLE PRECISION,
            unit TEXT,
            market_name TEXT,
            extra_json TEXT,
            created_at TIMESTAMPTZ
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_livestock_price_date ON livestock_price_snapshots(record_date)");
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
                await client.query("CREATE INDEX IF NOT EXISTS idx_data_change_entity ON data_change_log(entity_type)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS gemini_usage_log (
            id TEXT PRIMARY KEY,
            customer_id TEXT REFERENCES customers(id),
            call_kind TEXT NOT NULL,
            model_name TEXT,
            latency_ms INTEGER,
            prompt_tokens INTEGER,
            candidates_tokens INTEGER,
            total_tokens INTEGER,
            prompt_version_id TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_gemini_usage_created ON gemini_usage_log(created_at)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_gemini_usage_customer ON gemini_usage_log(customer_id)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS prompt_versions (
            id TEXT PRIMARY KEY,
            slot TEXT NOT NULL,
            label TEXT NOT NULL,
            body TEXT NOT NULL,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_prompt_versions_slot ON prompt_versions(slot)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query("ALTER TABLE gemini_usage_log ADD COLUMN IF NOT EXISTS prompt_version_id TEXT");
            }
            catch (_) {
                try {
                    await client.query("ALTER TABLE gemini_usage_log ADD COLUMN prompt_version_id TEXT");
                }
                catch (_e) { /* column may exist */ }
            }
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
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS rhythm_daily_signals (
            id TEXT PRIMARY KEY,
            signal_date TEXT NOT NULL,
            customer_id TEXT NOT NULL REFERENCES customers(id),
            product_id TEXT NOT NULL REFERENCES products(id),
            signal_type TEXT NOT NULL,
            meta_json TEXT,
            created_at TIMESTAMPTZ NOT NULL
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_rhythm_sig_date ON rhythm_daily_signals(signal_date)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_rhythm_sig_cust ON rhythm_daily_signals(customer_id)");
                await client.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_rhythm_sig_unique ON rhythm_daily_signals(signal_date, customer_id, product_id, signal_type)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS complaint_handling (
            order_id TEXT PRIMARY KEY REFERENCES orders(id),
            handle_status TEXT NOT NULL DEFAULT 'pending',
            handler TEXT,
            note TEXT,
            resolved_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_complaint_handling_status ON complaint_handling(handle_status)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS basket_logs (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL REFERENCES customers(id),
            log_date DATE NOT NULL,
            taken_to INTEGER,
            picked_up INTEGER,
            line_group_id TEXT,
            reporter_user_id TEXT,
            reporter_display_name TEXT,
            raw_message TEXT,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
          )`);
                await client.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_basket_logs_cust_date ON basket_logs(customer_id, log_date)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_basket_logs_date ON basket_logs(log_date)");
                await client.query(`CREATE TABLE IF NOT EXISTS basket_log_history (
            id TEXT PRIMARY KEY,
            basket_log_id TEXT NOT NULL REFERENCES basket_logs(id) ON DELETE CASCADE,
            customer_id TEXT NOT NULL,
            log_date DATE NOT NULL,
            prev_taken_to INTEGER,
            prev_picked_up INTEGER,
            new_taken_to INTEGER,
            new_picked_up INTEGER,
            actor TEXT,
            reporter_user_id TEXT,
            raw_message TEXT,
            created_at TIMESTAMPTZ NOT NULL
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_basket_log_hist_log ON basket_log_history(basket_log_id)");
                await client.query(`CREATE TABLE IF NOT EXISTS basket_log_lines (
            id TEXT PRIMARY KEY,
            basket_log_id TEXT NOT NULL REFERENCES basket_logs(id) ON DELETE CASCADE,
            basket_kind TEXT NOT NULL,
            basket_no INTEGER NOT NULL DEFAULT 0,
            taken_to INTEGER NOT NULL DEFAULT 0,
            picked_up INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL
          )`);
                await client.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_basket_log_lines_uniq ON basket_log_lines(basket_log_id, basket_kind, basket_no)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_basket_log_lines_log ON basket_log_lines(basket_log_id)");
                // 既有 PG DB 補欄位
                try { await client.query("ALTER TABLE basket_log_history ADD COLUMN IF NOT EXISTS prev_lines_json TEXT"); } catch (_) {}
                try { await client.query("ALTER TABLE basket_log_history ADD COLUMN IF NOT EXISTS new_lines_json TEXT"); } catch (_) {}
                await client.query(`CREATE TABLE IF NOT EXISTS announcements (
            id TEXT PRIMARY KEY,
            template_id TEXT NOT NULL,
            title TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            rendered_image_path TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ,
            sent_at TIMESTAMPTZ,
            sent_to_groups_json TEXT,
            created_by TEXT
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS company_calendar (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            kind TEXT NOT NULL,
            label TEXT NOT NULL,
            note TEXT,
            created_at TIMESTAMPTZ
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_company_calendar_date ON company_calendar(date)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_company_calendar_kind ON company_calendar(kind)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query(`CREATE TABLE IF NOT EXISTS commodity_prices (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            source TEXT,
            record_date TEXT NOT NULL,
            unit TEXT,
            spec TEXT,
            price DOUBLE PRECISION,
            high_price DOUBLE PRECISION,
            mid_price DOUBLE PRECISION,
            low_price DOUBLE PRECISION,
            note TEXT,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
          )`);
                await client.query("CREATE INDEX IF NOT EXISTS idx_commodity_prices_date ON commodity_prices(record_date)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_commodity_prices_cat ON commodity_prices(category)");
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
