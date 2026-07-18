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
    // [fix 2026-07-14] fail-fast：其餘 SQLite 專屬語法本轉換層「轉不動」，過去會原樣送進 PG
    // 直到雲端 500 才發現（本機 SQLite 全測不出）。改成一進來就丟明確錯誤，
    // 逼寫的人當場用 isPg 雙分支或可攜語法（ON CONFLICT / to_char …）。
    // [fix 2026-07-17] 補攔 datetime(...)：上面只轉換無修飾詞的 datetime('now')，
    // 帶修飾詞寫法（如 datetime('now','+8 hours')）過去會漏網原樣送進 PG 執行期才炸。
    const unsupported = s.match(/INSERT\s+OR\s+(REPLACE|IGNORE)\s|strftime\s*\(|GROUP_CONCAT\s*\(|\bdate\s*\(\s*['"]now['"]|\bdatetime\s*\(/i);
    if (unsupported) {
        throw new Error("sqlForPg: SQL 含 SQLite 專屬語法「" + unsupported[0].trim() + "」，PG 無法執行。" +
            "請改用可攜寫法（ON CONFLICT…DO UPDATE / to_char）或依 DATABASE_URL 分支。SQL 開頭：" + s.slice(0, 120));
    }
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
        // [fix 2026-07-14] 品項冪等鍵：來源 LINE 訊息 id。redelivery/租約重跑時同訊息品項不重插。
        "ALTER TABLE order_items ADD COLUMN src_line_message_id TEXT",
        // [prov 2026-07-14] 照片來源公司（provenance）：PK 維持 erp_code＝「一料號一張照片、全公司共用」
        // 屬刻意決策（照片是人工上傳、跨公司撞料號極少）；此欄記錄上傳當下的公司，
        // 未來若真的發生撞號錯圖，有資料可升級成 (icpno, erp_code) 主鍵而不用猜歸屬。
        "ALTER TABLE erp_stock_item_photo ADD COLUMN icpno TEXT",
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
        // [2026-07-13] 每日盤點頁「複盤直接改實盤」：記最後修改時間/人（完整軌跡另存 stocktake_count_audit）
        "ALTER TABLE stocktake_count ADD COLUMN edited_at TEXT",
        "ALTER TABLE stocktake_count ADD COLUMN edited_by TEXT",
        "ALTER TABLE stocktake_count ADD COLUMN edited_by_name TEXT",
        // [fix 2026-07-08] 凌越 /wait 認領租約：agent 撿走時蓋時間戳，其他 agent／同一 agent 重啟在租約內不會重撿→防重複開單
        "ALTER TABLE orders ADD COLUMN lingyue_claimed_at TEXT",
        // [fix 2026-07-08] 凌越寫入失敗出口：累計嘗試次數與最後錯誤；permanent 或超過上限即移出佇列並顯示原因
        "ALTER TABLE orders ADD COLUMN lingyue_write_attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE orders ADD COLUMN lingyue_last_error TEXT",
        // 多公司盤點（松富00＋松揚02…）：場次記公司代碼，NULL 視為 '00'
        "ALTER TABLE stocktake_session ADD COLUMN icpno TEXT",
        // [fix 2026-07-10] 租約式去重：status='processing' 為原子佔位（入口 INSERT ON CONFLICT DO NOTHING），
        // 成功改 'done'、失敗只刪自己的 processing 列；舊列 status NULL 視同 'done'（舊語意下已處理完成）
        "ALTER TABLE processed_line_messages ADD COLUMN status TEXT",
        "ALTER TABLE processed_line_messages ADD COLUMN claimed_at TEXT",
        // [統計圖表 2026-07-16] 每日快照加 K 線 OHLC（open=當日首推時的昨收、high/low=當日各次推送極值；qty=收）
        "ALTER TABLE erp_stock_daily ADD COLUMN qty_open REAL",
        "ALTER TABLE erp_stock_daily ADD COLUMN qty_high REAL",
        "ALTER TABLE erp_stock_daily ADD COLUMN qty_low REAL",
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
    // [fix 2026-07-14] 拆單唯一性下沉 DB：同客戶＋同日＋同（非空）split key 至多一張有效單。
    // 應用層 SELECT→INSERT 在並發（Cloud Tasks 多 worker／多實例）下守不住——兩張同 key 單
    // 在結單 rebuild 時各依同一 key 重建品項＝重複出貨。部分唯一索引只約束「有名字的子客戶單」
    // （''主桶與 NULL 不限制：同日多張主單屬合法），並排除作廢/客訴單。
    // 既有資料已重複時比照 G13：先警告不建，人工（搬移品項併單）清完後重啟自動建立。
    try {
        const dupSplit = sqlite.prepare("SELECT customer_id, order_date, order_sub_split_key, COUNT(*) AS n FROM orders WHERE order_sub_split_key IS NOT NULL AND order_sub_split_key <> '' AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') GROUP BY customer_id, order_date, order_sub_split_key HAVING COUNT(*) > 1").all();
        if (dupSplit.length) {
            console.warn("[migration] orders 拆單鍵發現 %d 組重複，唯一索引暫不建立。請至後台用「搬移品項」併單：", dupSplit.length);
            for (const d of dupSplit.slice(0, 10)) console.warn("  customer=%s date=%s key=%s ×%s", d.customer_id, d.order_date, d.order_sub_split_key, d.n);
        } else {
            sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_split_key_day ON orders(customer_id, order_date, order_sub_split_key) WHERE order_sub_split_key IS NOT NULL AND order_sub_split_key <> '' AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint')");
        }
    }
    catch (e) { console.warn("[migration] orders 拆單鍵 UNIQUE 檢查/建立失敗:", e?.message || e); }
    // [perf 2026-07-14] 熱路徑補索引：orders(customer_id, order_date) 被每則 LINE 訊息的
    // 同日訂單查詢/拆單 find 打（全 codebase 17 處）；order_items(order_id) 是訂單明細/rebuild
    // 的基本查法，兩者過去都靠全表掃描。附件表同理。
    try {
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders(customer_id, order_date)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_order_attachments_order ON order_attachments(order_id)");
    }
    catch (_) { /* index may already exist */ }
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
        // 凌越貨品主檔目前庫存（SK_NOWQTY）快照。內網 agent 每次推送整批 → 按公司(icpno)覆蓋（DELETE WHERE icpno + INSERT）。
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_stock_items (erp_code TEXT PRIMARY KEY, name TEXT, spec TEXT, unit TEXT, qty REAL NOT NULL DEFAULT 0, wh_code TEXT, icpno TEXT, updated_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh ON erp_stock_items(wh_code)");
    }
    catch (_) { /* table may already exist */ }
    // [migration 2026-07-10] 多公司（松富00＋松揚02…）：料號各公司獨立，主鍵改 (icpno, erp_code)；舊資料補 icpno='00'。
    try {
        const pkCols = sqlite.prepare("SELECT name FROM pragma_table_info('erp_stock_items') WHERE pk > 0 ORDER BY pk").all().map((r) => String(r.name));
        if (pkCols.length === 1 && pkCols[0] === "erp_code") {
            sqlite.exec("BEGIN");
            sqlite.exec("CREATE TABLE erp_stock_items_v2 (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, name TEXT, spec TEXT, unit TEXT, qty REAL NOT NULL DEFAULT 0, wh_code TEXT, updated_at TEXT, PRIMARY KEY (icpno, erp_code))");
            sqlite.exec("INSERT INTO erp_stock_items_v2 (icpno, erp_code, name, spec, unit, qty, wh_code, updated_at) SELECT COALESCE(NULLIF(TRIM(icpno),''),'00'), erp_code, name, spec, unit, qty, wh_code, updated_at FROM erp_stock_items");
            sqlite.exec("DROP TABLE erp_stock_items");
            sqlite.exec("ALTER TABLE erp_stock_items_v2 RENAME TO erp_stock_items");
            sqlite.exec("COMMIT");
            sqlite.exec("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh ON erp_stock_items(wh_code)");
            console.log("[migration] erp_stock_items 主鍵改為 (icpno, erp_code)");
        }
    }
    catch (e) { try { sqlite.exec("ROLLBACK"); } catch (_) { } console.warn("[migration] erp_stock_items 多公司主鍵遷移失敗:", e?.message || e); }
    try {
        // 凌越分倉庫存（資料種類 000009「目前庫存-廠內倉」）快照：每「品項×倉別」一筆。
        // 由 inventory-push 的頂層 warehouse_qty 全表覆蓋（DELETE+INSERT；接收端下一階段實作）；
        // payload 沒帶 warehouse_qty＝該批推送無分倉資料，此表不動。用途：盤點按倉別進行時的分倉帳面基準
        //（取代單一公司總量 SK_NOWQTY 造成的多倉共用品項盤差失真）。
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_stock_wh_qty (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, wh_code TEXT NOT NULL, qty REAL NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (icpno, erp_code, wh_code))");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh_qty_wh ON erp_stock_wh_qty(wh_code)");
    }
    catch (_) { /* table may already exist */ }
    // [migration 2026-07-14] 分倉快照也按公司：主鍵 (erp_code, wh_code) → (icpno, erp_code, wh_code)。
    // 凌越倉號可跨公司重複（erp_warehouse 已是 (icpno, code) 主鍵），此表無 icpno 時公司間推送
    // 互相覆蓋、盤點分倉基準誤讀。舊資料補 '00'——此表是每輪推送整批覆蓋的快照，下一輪各公司
    // 推送即自癒，暫時標錯無累積影響。
    try {
        const whPk = sqlite.prepare("SELECT name FROM pragma_table_info('erp_stock_wh_qty') WHERE pk > 0 ORDER BY pk").all().map((r) => String(r.name));
        if (!whPk.includes("icpno")) {
            sqlite.exec("BEGIN");
            sqlite.exec("CREATE TABLE erp_stock_wh_qty_v2 (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, wh_code TEXT NOT NULL, qty REAL NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (icpno, erp_code, wh_code))");
            sqlite.exec("INSERT INTO erp_stock_wh_qty_v2 (icpno, erp_code, wh_code, qty, updated_at) SELECT '00', erp_code, wh_code, qty, updated_at FROM erp_stock_wh_qty");
            sqlite.exec("DROP TABLE erp_stock_wh_qty");
            sqlite.exec("ALTER TABLE erp_stock_wh_qty_v2 RENAME TO erp_stock_wh_qty");
            sqlite.exec("COMMIT");
            sqlite.exec("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh_qty_wh ON erp_stock_wh_qty(wh_code)");
            console.log("[migration] erp_stock_wh_qty 主鍵改為 (icpno, erp_code, wh_code)");
        }
    }
    catch (e) { try { sqlite.exec("ROLLBACK"); } catch (_) { } console.warn("[migration] erp_stock_wh_qty 多公司主鍵遷移失敗:", e?.message || e); }
    try {
        // [fix 2026-07-10] 品項照片：以 erp_code 為鍵獨立存放（不放 erp_stock_items——該表每次庫存推送
        // 全表覆蓋會清掉）。盤點頁縮圖用（對語言不通的員工照片比文字更直觀）。photo_url 存後台上傳後的可存取路徑。
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_stock_item_photo (erp_code TEXT PRIMARY KEY, photo_url TEXT, updated_by TEXT, updated_at TEXT)");
        // 庫存人工調整值（彌補凌越系統誤差，免重整）：每公司每料號一個總調整值 delta；
        // 顯示庫存＝凌越快照 + delta（獨立表，庫存推送覆蓋 erp_stock_items 不會洗掉）；只影響內部顯示/盤差，不流入凌越回寫。
        sqlite.exec("CREATE TABLE IF NOT EXISTS stock_adjustment (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, delta REAL NOT NULL DEFAULT 0, name TEXT, spec TEXT, unit TEXT, base_qty REAL, counted_qty REAL, note TEXT, created_by TEXT, created_by_name TEXT, created_at TEXT, updated_at TEXT, PRIMARY KEY (icpno, erp_code))");
        // 每日庫存快照（供盤點「必盤」判定：跟昨天/上次有無變動）：庫存推送時一天存一份（最後一次為準）。
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_stock_daily (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, snap_date TEXT NOT NULL, qty REAL NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (icpno, erp_code, snap_date))");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_erp_stock_daily_date ON erp_stock_daily(icpno, snap_date)");
        // [統計圖表 2026-07-16] 分倉每日快照（K線分倉檢視用）：帶 warehouse_qty 的推送一天一份、
        // OHLC 同 erp_stock_daily（open=當日首推時的昨收、high/low=當日各次推送極值）。
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_stock_wh_daily (icpno TEXT NOT NULL DEFAULT '00', wh_code TEXT NOT NULL, erp_code TEXT NOT NULL, snap_date TEXT NOT NULL, qty REAL NOT NULL DEFAULT 0, qty_open REAL, qty_high REAL, qty_low REAL, updated_at TEXT, PRIMARY KEY (icpno, wh_code, erp_code, snap_date))");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh_daily_date ON erp_stock_wh_daily(icpno, wh_code, snap_date)");
        // [未來銷貨加回 2026-07-17] 提前打進凌越的「未來日期銷貨」會即時扣掉 SK_NOWQTY，使快照低於實際在架量。
        // 內網代理隨庫存推送順帶查未來日期 A1(銷貨)−A2(銷退) 逐料號淨量，塞進此表（獨立表，庫存推送全表覆蓋不會洗掉）。
        // qty＝該料號未來日期銷貨淨量（正＝顯示時要「加回」）。開關（app_settings.stock_future_reversal_enabled）
        // 打開時顯示庫存＝凌越快照＋人工調整＋此加回；關閉時遮蔽（回原凌越量方便對照查詢）。只影響內部顯示，不流入凌越回寫。
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_future_sales (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, qty REAL NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (icpno, erp_code))");
    }
    catch (_) { /* table may already exist */ }
    try {
        // 凌越倉別設定：代號→中文名、是否納入盤點。代號來源＝erp_stock_items.wh_code。
        sqlite.exec("CREATE TABLE IF NOT EXISTS erp_warehouse (code TEXT PRIMARY KEY, name TEXT, include_stocktake INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT)");
    }
    catch (_) { /* table may already exist */ }
    // [migration 2026-07-10] 倉別也按公司：主鍵改 (icpno, code)；舊資料補 icpno='00'。
    try {
        const whPk = sqlite.prepare("SELECT name FROM pragma_table_info('erp_warehouse') WHERE pk > 0 ORDER BY pk").all().map((r) => String(r.name));
        if (whPk.length === 1 && whPk[0] === "code") {
            sqlite.exec("BEGIN");
            sqlite.exec("CREATE TABLE erp_warehouse_v2 (icpno TEXT NOT NULL DEFAULT '00', code TEXT NOT NULL, name TEXT, include_stocktake INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (icpno, code))");
            sqlite.exec("INSERT INTO erp_warehouse_v2 (icpno, code, name, include_stocktake, sort_order, updated_at) SELECT '00', code, name, include_stocktake, sort_order, updated_at FROM erp_warehouse");
            sqlite.exec("DROP TABLE erp_warehouse");
            sqlite.exec("ALTER TABLE erp_warehouse_v2 RENAME TO erp_warehouse");
            sqlite.exec("COMMIT");
            console.log("[migration] erp_warehouse 主鍵改為 (icpno, code)");
        }
    }
    catch (e) { try { sqlite.exec("ROLLBACK"); } catch (_) { } console.warn("[migration] erp_warehouse 多公司主鍵遷移失敗:", e?.message || e); }
    try {
        // 商品條碼對照（掃碼盤點/進貨用）：一個品項可多條碼；qty_per_scan=掃一下代表幾個單位（箱碼>1）。
        sqlite.exec("CREATE TABLE IF NOT EXISTS product_barcode (icpno TEXT NOT NULL DEFAULT '00', barcode TEXT NOT NULL, erp_code TEXT NOT NULL, qty_per_scan REAL NOT NULL DEFAULT 1, note TEXT, created_by TEXT, created_by_name TEXT, created_at TEXT, updated_at TEXT, PRIMARY KEY (icpno, barcode))");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_product_barcode_item ON product_barcode(icpno, erp_code)");
    }
    catch (_) { /* table may already exist */ }
    try {
        // 盤點：白名單群組、盤點場次、盤點明細、需記效期的品項
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_group (group_id TEXT PRIMARY KEY, group_name TEXT, created_at TEXT)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_session (id TEXT PRIMARY KEY, wh_code TEXT, wh_name TEXT, count_date TEXT, status TEXT, group_id TEXT, created_by TEXT, created_by_name TEXT, item_count INTEGER NOT NULL DEFAULT 0, counted_count INTEGER NOT NULL DEFAULT 0, created_at TEXT, submitted_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_stk_session_date ON stocktake_session(count_date, wh_code)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_count (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, erp_code TEXT, name TEXT, spec TEXT, unit TEXT, sys_qty REAL, counted_qty REAL, expiry_json TEXT, updated_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_stk_count_session ON stocktake_count(session_id)");
        // 每日盤點「複盤直接改實盤」的修改軌跡（audit）：每次修改一列，保留舊/新值與修改人時間。
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_count_audit (id TEXT PRIMARY KEY, session_id TEXT, icpno TEXT, wh_code TEXT, count_date TEXT, erp_code TEXT, name TEXT, old_counted REAL, new_counted REAL, actor TEXT, actor_name TEXT, note TEXT, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_stk_count_audit_session ON stocktake_count_audit(session_id)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_expiry_item (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, expiry_unit TEXT, created_at TEXT, PRIMARY KEY (icpno, erp_code))");
    }
    catch (_) { }
    try {
        // [2026-07-17] 盤點「進行中」鎖＋草稿雲端備援（一倉一日一筆）：
        // device_id/holder_name/last_seen_at＝目前持鎖裝置（心跳續租、逾時視為棄鎖可接手），
        // payload＝該裝置未送出的盤點草稿 JSON（手機當機/LINE 清快取後可從伺服器帶回）。
        // 送出成功時由 submitStocktake 同交易刪除。
        sqlite.exec("CREATE TABLE IF NOT EXISTS stocktake_draft (icpno TEXT NOT NULL DEFAULT '00', wh_code TEXT NOT NULL, count_date TEXT NOT NULL, device_id TEXT, holder_name TEXT, payload TEXT, started_at TEXT, last_seen_at TEXT, updated_at TEXT, PRIMARY KEY (icpno, wh_code, count_date))");
        // 群組功能白名單：每個 LINE 群組可分別開關「辨識訂單／盤點／空藍」。無資料列＝三項全開（預設全勾）。
        sqlite.exec("CREATE TABLE IF NOT EXISTS group_features (group_id TEXT PRIMARY KEY, feat_order INTEGER NOT NULL DEFAULT 1, feat_stocktake INTEGER NOT NULL DEFAULT 1, feat_basket INTEGER NOT NULL DEFAULT 1, updated_at TEXT)");
        // 一次性遷移：把舊「盤點群組」白名單帶進 group_features，冪等（僅在尚無對應列時填入）。
        // 維持既有行為：非客戶群的內部群＝不辨識訂單（feat_order=0）；已綁客戶的群組先前靠安全防呆仍收單，
        // 故 feat_order=1 保留收單（避免任何客戶群突然斷單），由使用者事後自行到客戶頁取消勾選。盤點/空藍皆維持開啟。
        sqlite.exec("INSERT INTO group_features (group_id, feat_order, feat_stocktake, feat_basket, updated_at) SELECT sg.group_id, CASE WHEN EXISTS (SELECT 1 FROM customers c WHERE c.line_group_id IS NOT NULL AND c.line_group_id <> '' AND LOWER(REPLACE(c.line_group_id,' ','')) = LOWER(REPLACE(sg.group_id,' ',''))) THEN 1 ELSE 0 END, 1, 1, datetime('now') FROM stocktake_group sg WHERE NOT EXISTS (SELECT 1 FROM group_features gf WHERE gf.group_id = sg.group_id)");
    }
    catch (_) { /* tables may already exist */ }
    // [migration 2026-07-13] 效期品也按公司：主鍵 erp_code → (icpno, erp_code)；舊資料補 icpno='00'（松富）。
    try {
        const hasIcpno = sqlite.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('stocktake_expiry_item') WHERE name='icpno'").get().n > 0;
        const pkCols = sqlite.prepare("SELECT name FROM pragma_table_info('stocktake_expiry_item') WHERE pk > 0 ORDER BY pk").all().map((r) => String(r.name));
        if (!hasIcpno || pkCols.length < 2) {
            sqlite.exec("CREATE TABLE stocktake_expiry_item_v2 (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, expiry_unit TEXT, created_at TEXT, PRIMARY KEY (icpno, erp_code))");
            sqlite.exec("INSERT OR IGNORE INTO stocktake_expiry_item_v2 (icpno, erp_code, expiry_unit, created_at) SELECT '00', erp_code, expiry_unit, created_at FROM stocktake_expiry_item");
            sqlite.exec("DROP TABLE stocktake_expiry_item");
            sqlite.exec("ALTER TABLE stocktake_expiry_item_v2 RENAME TO stocktake_expiry_item");
            console.log("[migration] stocktake_expiry_item 主鍵改為 (icpno, erp_code)");
        }
    }
    catch (e) { console.warn("[migration] stocktake_expiry_item 多公司主鍵遷移失敗:", e?.message || e); }
    try {
        // [fix 2026-07-10] 盤點「一倉一日一筆」補真正的 UNIQUE 約束（原 idx_stk_session_date 只是普通索引，
        // 併發送出可打破唯一性）。先冪等去重：同倉同日保留最後送出（submitted_at/created_at 最大者，再以 id 決勝），
        // 落選場次的明細一併清除，再建唯一索引。
        // [fix 2026-07-14] 唯一鍵與去重都必須含公司（icpno）：凌越倉號可跨公司重複（如松富/松揚同倉號），
        // 舊版 (wh_code, count_date) 會讓第二家公司送不出、且啟動去重會誤刪另一家公司的整場盤點。
        // 注意：共用 alters 陣列在本區塊之後才執行，全新 DB 此時尚無 icpno 欄，需自備冪等 ADD COLUMN。
        try { sqlite.exec("ALTER TABLE stocktake_session ADD COLUMN icpno TEXT"); } catch (_) { /* 欄位已存在 */ }
        sqlite.exec("UPDATE stocktake_session SET icpno = '00' WHERE icpno IS NULL OR TRIM(icpno) = ''");
        sqlite.exec("DELETE FROM stocktake_count WHERE session_id IN (SELECT id FROM stocktake_session s WHERE EXISTS (SELECT 1 FROM stocktake_session s2 WHERE COALESCE(NULLIF(TRIM(s2.icpno),''),'00') = COALESCE(NULLIF(TRIM(s.icpno),''),'00') AND s2.wh_code = s.wh_code AND s2.count_date = s.count_date AND s2.id <> s.id AND (COALESCE(s2.submitted_at, s2.created_at, '') > COALESCE(s.submitted_at, s.created_at, '') OR (COALESCE(s2.submitted_at, s2.created_at, '') = COALESCE(s.submitted_at, s.created_at, '') AND s2.id > s.id))))");
        sqlite.exec("DELETE FROM stocktake_session WHERE EXISTS (SELECT 1 FROM stocktake_session s2 WHERE COALESCE(NULLIF(TRIM(s2.icpno),''),'00') = COALESCE(NULLIF(TRIM(stocktake_session.icpno),''),'00') AND s2.wh_code = stocktake_session.wh_code AND s2.count_date = stocktake_session.count_date AND s2.id <> stocktake_session.id AND (COALESCE(s2.submitted_at, s2.created_at, '') > COALESCE(stocktake_session.submitted_at, stocktake_session.created_at, '') OR (COALESCE(s2.submitted_at, s2.created_at, '') = COALESCE(stocktake_session.submitted_at, stocktake_session.created_at, '') AND s2.id > stocktake_session.id)))");
        sqlite.exec("DROP INDEX IF EXISTS idx_stk_session_wh_date_uniq");
        sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_stk_session_icp_wh_date_uniq ON stocktake_session(COALESCE(NULLIF(TRIM(icpno),''),'00'), wh_code, count_date)");
    }
    catch (_) { /* 去重/唯一索引失敗不阻斷啟動 */ }
    try {
        // [fix 2026-07-10] 訂單品項「人工修改軌跡」：LINE 改單指令、後台/LIFF 編輯記錄於此；
        // 結單整單重辨識（rebuild）後依時間序重放，避免 rebuild 覆寫人工修正。
        // action: set（改數量/單位）| delete（刪品項）| add（補品項）；match_key = 正規化品名（非位置序，位置會因 rebuild 漂移）。
        sqlite.exec("CREATE TABLE IF NOT EXISTS order_item_edits (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, action TEXT NOT NULL, match_key TEXT, raw_name TEXT, quantity REAL, unit TEXT, remark TEXT, edited_by TEXT, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_order_item_edits_order ON order_item_edits(order_id)");
    }
    catch (_) { /* table may already exist */ }
    try {
        // 每日帳款收款：凌越銷貨單當日快照（由內網代理推上雲，見 scripts/ly_sales_push.py）。
        // kind：'num'=純數字(直打凌越)、'A'=A開頭(訂單拋轉寺岡EDI回轉)。金額欄皆取自凌越 SP_*。
        sqlite.exec("CREATE TABLE IF NOT EXISTS cash_sales_doc (icpno TEXT NOT NULL DEFAULT '00', sp_no TEXT NOT NULL, doc_date TEXT NOT NULL, ct_no TEXT, ct_name TEXT, fkfs TEXT, total REAL NOT NULL DEFAULT 0, unpaid REAL NOT NULL DEFAULT 0, paid REAL NOT NULL DEFAULT 0, nopay_fg TEXT, sales TEXT, kind TEXT, ingested_at TEXT, ingested_by TEXT, PRIMARY KEY (icpno, sp_no))");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cash_sales_date ON cash_sales_doc(icpno, doc_date)");
        // 收款客戶主檔：以凌越客戶編號(CT_NO=SP_CTNO)為鍵。name/fkfs/sales/stop 由推送覆蓋；
        // is_cash（是否當日收現金）、route_line（路線/司機）、note 為後台人工維護，推送不覆蓋。
        sqlite.exec("CREATE TABLE IF NOT EXISTS cash_customer (icpno TEXT NOT NULL DEFAULT '00', ct_no TEXT NOT NULL, name TEXT, fkfs TEXT, sales TEXT, is_cash INTEGER, route_line TEXT, stop INTEGER NOT NULL DEFAULT 0, note TEXT, updated_at TEXT, PRIMARY KEY (icpno, ct_no))");
        // 流水號斷號原因：series='num'(純數字)|'A'(寺岡EDI)，seq＝缺的流水號。斷號一定要填原因。
        sqlite.exec("CREATE TABLE IF NOT EXISTS cash_seq_gap_reason (icpno TEXT NOT NULL DEFAULT '00', doc_date TEXT NOT NULL, series TEXT NOT NULL, seq INTEGER NOT NULL, reason TEXT, updated_by TEXT, updated_at TEXT, PRIMARY KEY (icpno, doc_date, series, seq))");
    }
    catch (_) { /* table may already exist */ }
    try {
        // 收款（Phase2）：一筆收款可對應一或多張銷貨單（一張一筆＝一筆對一張；一次付多筆＝一筆對多張）。
        // cash_payment＝一次收款（現金＋票合計）；cash_payment_alloc＝分配到哪些銷貨單；cash_check＝票據明細。
        sqlite.exec("CREATE TABLE IF NOT EXISTS cash_payment (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', ct_no TEXT, ct_name TEXT, pay_date TEXT NOT NULL, collected_by TEXT, route_line TEXT, cash_amount REAL NOT NULL DEFAULT 0, check_amount REAL NOT NULL DEFAULT 0, total_amount REAL NOT NULL DEFAULT 0, due_total REAL NOT NULL DEFAULT 0, diff REAL NOT NULL DEFAULT 0, note TEXT, recorded_by TEXT, recorded_at TEXT, updated_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cash_payment_date ON cash_payment(icpno, pay_date)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS cash_payment_alloc (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, icpno TEXT NOT NULL DEFAULT '00', sp_no TEXT NOT NULL, doc_date TEXT, due_amount REAL NOT NULL DEFAULT 0, alloc_amount REAL NOT NULL DEFAULT 0)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cash_alloc_sp ON cash_payment_alloc(icpno, sp_no)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cash_alloc_pay ON cash_payment_alloc(payment_id)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS cash_check (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, icpno TEXT NOT NULL DEFAULT '00', check_no TEXT, bank TEXT, due_date TEXT, amount REAL NOT NULL DEFAULT 0, note TEXT, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cash_check_pay ON cash_check(payment_id)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cash_check_due ON cash_check(icpno, due_date)");
        // 額外收入（非銷貨單的款，列現金日報表最後）
        sqlite.exec("CREATE TABLE IF NOT EXISTS cash_extra_income (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', income_date TEXT NOT NULL, item TEXT, amount REAL NOT NULL DEFAULT 0, collected_by TEXT, note TEXT, recorded_by TEXT, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cash_extra_date ON cash_extra_income(icpno, income_date)");
    }
    catch (_) { /* table may already exist */ }
    try {
        // 錢的原子性：一張銷貨單只能被收款一次。唯一約束擋併發重複收款（第二筆 INSERT 直接失敗→交易回滾）。
        sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_alloc_sp_uniq ON cash_payment_alloc(icpno, sp_no)");
    }
    catch (_) { /* 若既有重複資料先不建唯一索引（避免擋啟動）；重複需人工檢查 */ }
    try {
        sqlite.exec("ALTER TABLE cash_customer ADD COLUMN last_txn TEXT"); // 凌越最後交易日 CT_LAST_DT，用來分辨舊客戶
    }
    catch (_) { /* column exists */ }
    try {
        sqlite.exec("ALTER TABLE cash_payment ADD COLUMN transfer_amount REAL NOT NULL DEFAULT 0"); // 匯款金額（現金+票+匯款=total_amount）
    }
    catch (_) { /* column exists */ }
    try {
        sqlite.exec("ALTER TABLE cash_extra_income ADD COLUMN method TEXT"); // 額外收入入帳方式 cash/check/transfer
    }
    catch (_) { /* column exists */ }
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
        // [feat 2026-07-08] 補欄位：作物代號(料號)、種類代碼、平均價、交易量
        for (const col of ["crop_code TEXT", "category_code TEXT", "avg_price REAL", "volume REAL"]) {
            try { sqlite.exec(`ALTER TABLE wholesale_market_snapshots ADD COLUMN ${col}`); } catch (_) { /* 欄位已存在 */ }
        }
        try { sqlite.exec("CREATE INDEX IF NOT EXISTS idx_wholesale_snap_crop ON wholesale_market_snapshots(crop_name)"); } catch (_) {}
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
    // === 教育訓練（TTQS / PDDRO）多公司 ===
    try {
        sqlite.exec("CREATE TABLE IF NOT EXISTS training_employee (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', name TEXT NOT NULL, emp_no TEXT, dept TEXT, title TEXT, status TEXT NOT NULL DEFAULT 'active', note TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_training_employee_icpno ON training_employee(icpno, status)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS training_system (icpno TEXT PRIMARY KEY, mission TEXT, vision TEXT, core_values TEXT, policy TEXT, org_note TEXT, goal_short TEXT, goal_mid TEXT, goal_long TEXT, updated_by TEXT, updated_at TEXT)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS training_pddro_check (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', phase TEXT NOT NULL, item TEXT, result TEXT, evidence TEXT, status TEXT, checked_by TEXT, check_date TEXT, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_training_pddro_icpno ON training_pddro_check(icpno)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS training_plan (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', year TEXT NOT NULL, title TEXT, goal TEXT, note TEXT, status TEXT NOT NULL DEFAULT 'active', created_by TEXT, created_at TEXT, updated_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_training_plan_icpno ON training_plan(icpno, year)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS training_plan_item (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, month TEXT, theme TEXT, category TEXT, instructor TEXT, instructor_type TEXT, location TEXT, planned_hours REAL, status TEXT NOT NULL DEFAULT 'planned', course_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0, note TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_training_plan_item_plan ON training_plan_item(plan_id)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS training_course (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', plan_item_id TEXT, title TEXT NOT NULL, category TEXT, course_date TEXT, start_time TEXT, end_time TEXT, hours REAL, instructor TEXT, instructor_type TEXT, location TEXT, target_audience TEXT, objective TEXT, summary TEXT, cost REAL, handler TEXT, confirmed_by TEXT, status TEXT NOT NULL DEFAULT 'planned', created_by TEXT, created_at TEXT, updated_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_training_course_icpno ON training_course(icpno, course_date)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS training_attendance (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, employee_id TEXT, name TEXT, dept TEXT, signed INTEGER NOT NULL DEFAULT 1, hours REAL, note TEXT, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_training_attendance_course ON training_attendance(course_id)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS training_survey (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, employee_id TEXT, respondent TEXT, content_score INTEGER, instructor_score INTEGER, useful_score INTEGER, overall_score INTEGER, comment TEXT, created_at TEXT)");
        sqlite.exec("CREATE INDEX IF NOT EXISTS idx_training_survey_course ON training_survey(course_id)");
        sqlite.exec("CREATE TABLE IF NOT EXISTS training_outcome (course_id TEXT PRIMARY KEY, reaction TEXT, learning TEXT, behavior TEXT, result TEXT, eval_method TEXT, eval_score TEXT, effectiveness_note TEXT, evidence_url TEXT, evaluated_by TEXT, evaluated_at TEXT, updated_at TEXT)");
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
let pgTlsWarned = false; // 「未提供 CA」警告只印一次
/** 讀取 PG TLS 的 CA 憑證：優先 DATABASE_SSL_CA（PEM 內容），其次 DATABASE_SSL_CA_FILE（檔案路徑）；都沒設回 null */
function readPgSslCa() {
    const inline = String(process.env.DATABASE_SSL_CA || "").trim();
    if (inline)
        return inline;
    const file = String(process.env.DATABASE_SSL_CA_FILE || "").trim();
    if (file) {
        try {
            return (0, fs_1.readFileSync)(file, "utf-8");
        }
        catch (e) {
            // CA 檔讀不到視同未設定（退回不驗證模式），只記 log，絕不能讓現有部署因此連不上
            console.error("[db] DATABASE_SSL_CA_FILE 讀取失敗，退回不驗證憑證模式:", e?.message || e);
        }
    }
    return null;
}
function pgPoolOptions() {
    const raw = (DATABASE_URL || "").trim();
    // 連線字串內的 sslmode=require 可能讓 node-pg 仍驗證憑證鏈（自簽名鏈報錯）；改由 opts.ssl 統一控制
    let conn = raw.replace(/[?&]sslmode=[^&]*/gi, "");
    conn = conn.replace(/\?$/, "");
    const opts = {
        connectionString: conn,
        connectionTimeoutMillis: 20000,
        max: Number(process.env.PG_POOL_MAX || 8),
    };
    // [fix 2026-07-10] 有設 DATABASE_SSL_CA(_FILE) 即視為要求 TLS——否則運維設了 CA 以為已啟用驗證，
    // 連線字串卻沒 sslmode=require 時會被靜默忽略、走無 TLS 連線
    const ca = readPgSslCa();
    const needTls = /supabase\.(co|com)/i.test(raw) ||
        process.env.PGSSLMODE === "require" ||
        /[?&]sslmode=require/i.test(raw) ||
        Boolean(ca);
    if (needTls) {
        if (ca) {
            // 有提供 CA → 啟用完整憑證驗證
            opts.ssl = { ca, rejectUnauthorized: true };
        }
        else {
            // 向下相容：未提供 CA 維持現行為（不驗證憑證），但警告一次
            if (!pgTlsWarned) {
                pgTlsWarned = true;
                console.warn("[db] PG TLS 未提供 CA，連線未驗證伺服器憑證（rejectUnauthorized:false）；建議設定 DATABASE_SSL_CA（PEM 內容）或 DATABASE_SSL_CA_FILE（路徑）啟用驗證");
            }
            opts.ssl = { rejectUnauthorized: false };
        }
    }
    return opts;
}
async function initPg() {
    const pg = require("pg");
    // [fix 2026-07-14] 型別解析統一，消滅「本機 SQLite 正常、雲端 PG 靜默壞掉」的一整類 bug：
    // - DATE(1082)：node-pg 預設回 JS Date 物件，程式全把它當 'YYYY-MM-DD' 字串用——
    //   basket_logs.log_date 會渲染成 "Mon Jul 14 2026 …"、POST 回刪除端點 cast 失敗。改保持原字串。
    // - INT8(20)：COUNT(*)/SUM 回字串，新程式寫 row.n === 0 會在 PG 失效。改回 Number
    //   （計數/合計遠小於 2^53，安全）。
    try {
        pg.types.setTypeParser(1082, (v) => v);
        pg.types.setTypeParser(20, (v) => (v == null ? v : Number(v)));
    } catch (_) { /* 型別解析設定失敗不擋啟動（維持 node-pg 預設行為） */ }
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
                // [fix 2026-07-14] 品項冪等鍵（與 initSqlite alters 對應）
                await client.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS src_line_message_id TEXT");
            }
            catch (_) { /* column may already exist */ }
            try {
                // [prov 2026-07-14] 照片來源公司（與 initSqlite alters 對應，語意見該處註解）
                await client.query("ALTER TABLE erp_stock_item_photo ADD COLUMN IF NOT EXISTS icpno TEXT");
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
            // [fix 2026-07-14] 拆單唯一性下沉 DB（與 initSqlite 對應，理由見該處註解）。
            try {
                const dupSplitRes = await client.query("SELECT customer_id, order_date, order_sub_split_key, COUNT(*) AS n FROM orders WHERE order_sub_split_key IS NOT NULL AND order_sub_split_key <> '' AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') GROUP BY customer_id, order_date, order_sub_split_key HAVING COUNT(*) > 1");
                const dupSplit = dupSplitRes.rows || [];
                if (dupSplit.length) {
                    console.warn("[migration] orders 拆單鍵發現 %d 組重複，唯一索引暫不建立。請至後台用「搬移品項」併單：", dupSplit.length);
                    for (const d of dupSplit.slice(0, 10)) console.warn("  customer=%s date=%s key=%s ×%s", d.customer_id, d.order_date, d.order_sub_split_key, d.n);
                } else {
                    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_split_key_day ON orders(customer_id, order_date, order_sub_split_key) WHERE order_sub_split_key IS NOT NULL AND order_sub_split_key <> '' AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint')");
                }
            }
            catch (e) { console.warn("[migration] orders 拆單鍵 UNIQUE 檢查/建立失敗:", e?.message || e); }
            // [perf 2026-07-14] 熱路徑補索引（與 initSqlite 對應）
            try {
                await client.query("CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders(customer_id, order_date)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_order_attachments_order ON order_attachments(order_id)");
            }
            catch (_) { /* index may already exist */ }
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
                // [fix 2026-07-10] 租約式去重欄位（與 initSqlite alters 對應）；舊列 status NULL 視同 'done'
                await client.query("ALTER TABLE processed_line_messages ADD COLUMN IF NOT EXISTS status TEXT");
                await client.query("ALTER TABLE processed_line_messages ADD COLUMN IF NOT EXISTS claimed_at TEXT");
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
                // 凌越貨品主檔目前庫存（SK_NOWQTY）快照。內網 agent 每次推送整批 → 按公司(icpno)覆蓋（DELETE WHERE icpno + INSERT）。
                await client.query("CREATE TABLE IF NOT EXISTS erp_stock_items (erp_code TEXT PRIMARY KEY, name TEXT, spec TEXT, unit TEXT, qty DOUBLE PRECISION NOT NULL DEFAULT 0, wh_code TEXT, icpno TEXT, updated_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh ON erp_stock_items(wh_code)");
            }
            catch (_) { /* table may already exist */ }
            // [migration 2026-07-10] 多公司（松富00＋松揚02…）：主鍵改 (icpno, erp_code)；舊資料補 icpno='00'。
            // [fix 2026-07-17] 比照 erp_stock_wh_qty：包交易＋守門條件改「PK 不含 icpno 就重跑」。
            // 原本非交易且守門只認「PK 恰為單欄 erp_code」——DROP pkey 成功後 ADD PRIMARY KEY 失敗
            //（連線中斷/鎖逾時）會留下「無主鍵」狀態，下次啟動守門不成立→永不重試，
            // 所有 ON CONFLICT (icpno, erp_code) upsert（庫存推送）從此整批失敗。
            try {
                const pkRes = await client.query("SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = 'erp_stock_items'::regclass AND i.indisprimary");
                const pkCols = (pkRes.rows || []).map((r) => String(r.attname));
                if (!pkCols.includes("icpno")) {
                    await client.query("BEGIN");
                    await client.query("UPDATE erp_stock_items SET icpno = '00' WHERE icpno IS NULL OR TRIM(icpno) = ''");
                    // 過往半途失敗期間表可能無主鍵、混入重複列 → 先去重（同鍵留一筆）再建 PK
                    await client.query("DELETE FROM erp_stock_items a USING erp_stock_items b WHERE a.ctid < b.ctid AND a.icpno = b.icpno AND a.erp_code = b.erp_code");
                    await client.query("ALTER TABLE erp_stock_items DROP CONSTRAINT IF EXISTS erp_stock_items_pkey");
                    await client.query("ALTER TABLE erp_stock_items ALTER COLUMN icpno SET NOT NULL");
                    await client.query("ALTER TABLE erp_stock_items ALTER COLUMN icpno SET DEFAULT '00'");
                    await client.query("ALTER TABLE erp_stock_items ADD PRIMARY KEY (icpno, erp_code)");
                    await client.query("COMMIT");
                    console.log("[migration] erp_stock_items 主鍵改為 (icpno, erp_code)");
                }
            }
            catch (e) { try { await client.query("ROLLBACK"); } catch (_) { } console.warn("[migration] erp_stock_items 多公司主鍵遷移失敗:", e?.message || e); }
            try {
                // 凌越分倉庫存（資料種類 000009「目前庫存-廠內倉」）快照：每「品項×倉別」一筆。
                // 由 inventory-push 的頂層 warehouse_qty 全表覆蓋（DELETE+INSERT；接收端下一階段實作）；
                // payload 沒帶 warehouse_qty＝該批推送無分倉資料，此表不動。用途：盤點按倉別進行時的分倉帳面基準
                //（取代單一公司總量 SK_NOWQTY 造成的多倉共用品項盤差失真）。
                await client.query("CREATE TABLE IF NOT EXISTS erp_stock_wh_qty (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, wh_code TEXT NOT NULL, qty DOUBLE PRECISION NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (icpno, erp_code, wh_code))");
                await client.query("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh_qty_wh ON erp_stock_wh_qty(wh_code)");
                // [migration 2026-07-14] 分倉快照也按公司（理由見 initSqlite 對應處）；整段包交易，
                // 半途失敗 ROLLBACK 後守門條件仍成立、下次啟動可重試（修正過往 PG 遷移非交易的問題）。
                try {
                    const whPkRes = await client.query("SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = 'erp_stock_wh_qty'::regclass AND i.indisprimary");
                    const whPkCols = (whPkRes.rows || []).map((r) => String(r.attname));
                    if (!whPkCols.includes("icpno")) {
                        await client.query("BEGIN");
                        await client.query("ALTER TABLE erp_stock_wh_qty ADD COLUMN IF NOT EXISTS icpno TEXT");
                        await client.query("UPDATE erp_stock_wh_qty SET icpno = '00' WHERE icpno IS NULL OR TRIM(icpno) = ''");
                        await client.query("ALTER TABLE erp_stock_wh_qty ALTER COLUMN icpno SET NOT NULL");
                        await client.query("ALTER TABLE erp_stock_wh_qty ALTER COLUMN icpno SET DEFAULT '00'");
                        await client.query("ALTER TABLE erp_stock_wh_qty DROP CONSTRAINT IF EXISTS erp_stock_wh_qty_pkey");
                        await client.query("ALTER TABLE erp_stock_wh_qty ADD PRIMARY KEY (icpno, erp_code, wh_code)");
                        await client.query("COMMIT");
                        console.log("[migration] erp_stock_wh_qty 主鍵改為 (icpno, erp_code, wh_code)");
                    }
                }
                catch (e) { try { await client.query("ROLLBACK"); } catch (_) { } console.warn("[migration] erp_stock_wh_qty 多公司主鍵遷移失敗:", e?.message || e); }
                // [fix 2026-07-10] 品項照片（與 initSqlite 對應）：獨立表，跨庫存全表覆蓋保留
                // [fix 2026-07-17] icpno 直接進 CREATE：先前只靠前面較早執行的 ALTER 補欄，
                // 全新 PG 庫首次啟動時 ALTER 先跑（表還不存在、失敗被吞）→ 首啟缺欄、照片上傳 500，重啟才自癒。
                await client.query("CREATE TABLE IF NOT EXISTS erp_stock_item_photo (erp_code TEXT PRIMARY KEY, photo_url TEXT, updated_by TEXT, updated_at TEXT, icpno TEXT)");
                // 庫存人工調整值（彌補凌越系統誤差，免重整）：每公司每料號一個總調整值 delta（獨立表，庫存推送不會洗掉）。
                await client.query("CREATE TABLE IF NOT EXISTS stock_adjustment (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, delta DOUBLE PRECISION NOT NULL DEFAULT 0, name TEXT, spec TEXT, unit TEXT, base_qty DOUBLE PRECISION, counted_qty DOUBLE PRECISION, note TEXT, created_by TEXT, created_by_name TEXT, created_at TEXT, updated_at TEXT, PRIMARY KEY (icpno, erp_code))");
                // 每日庫存快照（供盤點「必盤」判定：跟昨天/上次有無變動）：庫存推送時一天存一份（最後一次為準）。
                await client.query("CREATE TABLE IF NOT EXISTS erp_stock_daily (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, snap_date TEXT NOT NULL, qty DOUBLE PRECISION NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (icpno, erp_code, snap_date))");
                await client.query("CREATE INDEX IF NOT EXISTS idx_erp_stock_daily_date ON erp_stock_daily(icpno, snap_date)");
                // [統計圖表 2026-07-16] K 線 OHLC 欄（與 initSqlite alters 對應）＋分倉每日快照表
                await client.query("ALTER TABLE erp_stock_daily ADD COLUMN IF NOT EXISTS qty_open DOUBLE PRECISION");
                await client.query("ALTER TABLE erp_stock_daily ADD COLUMN IF NOT EXISTS qty_high DOUBLE PRECISION");
                await client.query("ALTER TABLE erp_stock_daily ADD COLUMN IF NOT EXISTS qty_low DOUBLE PRECISION");
                await client.query("CREATE TABLE IF NOT EXISTS erp_stock_wh_daily (icpno TEXT NOT NULL DEFAULT '00', wh_code TEXT NOT NULL, erp_code TEXT NOT NULL, snap_date TEXT NOT NULL, qty DOUBLE PRECISION NOT NULL DEFAULT 0, qty_open DOUBLE PRECISION, qty_high DOUBLE PRECISION, qty_low DOUBLE PRECISION, updated_at TEXT, PRIMARY KEY (icpno, wh_code, erp_code, snap_date))");
                await client.query("CREATE INDEX IF NOT EXISTS idx_erp_stock_wh_daily_date ON erp_stock_wh_daily(icpno, wh_code, snap_date)");
                // [未來銷貨加回 2026-07-17] 未來日期銷貨淨量（與 initSqlite 對應）：獨立表，隨庫存推送覆蓋。
                await client.query("CREATE TABLE IF NOT EXISTS erp_future_sales (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, qty DOUBLE PRECISION NOT NULL DEFAULT 0, updated_at TEXT, PRIMARY KEY (icpno, erp_code))");
            }
            catch (_) { /* table may already exist */ }
            try {
                // 凌越倉別設定：代號→中文名、是否納入盤點。
                await client.query("CREATE TABLE IF NOT EXISTS erp_warehouse (code TEXT PRIMARY KEY, name TEXT, include_stocktake INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT)");
            }
            catch (_) { /* table may already exist */ }
            // [migration 2026-07-10] 倉別也按公司：主鍵改 (icpno, code)；舊資料補 icpno='00'。
            // [fix 2026-07-17] 同 erp_stock_items：包交易＋守門改「PK 不含 icpno 就重跑」（可自半途失敗復原）。
            try {
                await client.query("ALTER TABLE erp_warehouse ADD COLUMN IF NOT EXISTS icpno TEXT");
                const whPkRes = await client.query("SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = 'erp_warehouse'::regclass AND i.indisprimary");
                const whPk = (whPkRes.rows || []).map((r) => String(r.attname));
                if (!whPk.includes("icpno")) {
                    await client.query("BEGIN");
                    await client.query("UPDATE erp_warehouse SET icpno = '00' WHERE icpno IS NULL OR TRIM(icpno) = ''");
                    await client.query("DELETE FROM erp_warehouse a USING erp_warehouse b WHERE a.ctid < b.ctid AND a.icpno = b.icpno AND a.code = b.code");
                    await client.query("ALTER TABLE erp_warehouse DROP CONSTRAINT IF EXISTS erp_warehouse_pkey");
                    await client.query("ALTER TABLE erp_warehouse ALTER COLUMN icpno SET NOT NULL");
                    await client.query("ALTER TABLE erp_warehouse ALTER COLUMN icpno SET DEFAULT '00'");
                    await client.query("ALTER TABLE erp_warehouse ADD PRIMARY KEY (icpno, code)");
                    await client.query("COMMIT");
                    console.log("[migration] erp_warehouse 主鍵改為 (icpno, code)");
                }
            }
            catch (e) { try { await client.query("ROLLBACK"); } catch (_) { } console.warn("[migration] erp_warehouse 多公司主鍵遷移失敗:", e?.message || e); }
            try {
                // 商品條碼對照（掃碼盤點/進貨用）：一個品項可多條碼；qty_per_scan=掃一下代表幾個單位（箱碼>1）。
                await client.query("CREATE TABLE IF NOT EXISTS product_barcode (icpno TEXT NOT NULL DEFAULT '00', barcode TEXT NOT NULL, erp_code TEXT NOT NULL, qty_per_scan DOUBLE PRECISION NOT NULL DEFAULT 1, note TEXT, created_by TEXT, created_by_name TEXT, created_at TEXT, updated_at TEXT, PRIMARY KEY (icpno, barcode))");
                await client.query("CREATE INDEX IF NOT EXISTS idx_product_barcode_item ON product_barcode(icpno, erp_code)");
            }
            catch (_) { /* table may already exist */ }
            try {
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_group (group_id TEXT PRIMARY KEY, group_name TEXT, created_at TEXT)");
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_session (id TEXT PRIMARY KEY, wh_code TEXT, wh_name TEXT, count_date TEXT, status TEXT, group_id TEXT, created_by TEXT, created_by_name TEXT, item_count INTEGER NOT NULL DEFAULT 0, counted_count INTEGER NOT NULL DEFAULT 0, created_at TEXT, submitted_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_stk_session_date ON stocktake_session(count_date, wh_code)");
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_count (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, erp_code TEXT, name TEXT, spec TEXT, unit TEXT, sys_qty DOUBLE PRECISION, counted_qty DOUBLE PRECISION, expiry_json TEXT, updated_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_stk_count_session ON stocktake_count(session_id)");
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_expiry_item (icpno TEXT NOT NULL DEFAULT '00', erp_code TEXT NOT NULL, expiry_unit TEXT, created_at TEXT, PRIMARY KEY (icpno, erp_code))");
                await client.query("ALTER TABLE stocktake_count ADD COLUMN IF NOT EXISTS mid_qty DOUBLE PRECISION");
                // [2026-07-13] 每日盤點「複盤直接改實盤」：最後修改時間/人 + 完整軌跡表
                await client.query("ALTER TABLE stocktake_count ADD COLUMN IF NOT EXISTS edited_at TEXT");
                await client.query("ALTER TABLE stocktake_count ADD COLUMN IF NOT EXISTS edited_by TEXT");
                await client.query("ALTER TABLE stocktake_count ADD COLUMN IF NOT EXISTS edited_by_name TEXT");
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_count_audit (id TEXT PRIMARY KEY, session_id TEXT, icpno TEXT, wh_code TEXT, count_date TEXT, erp_code TEXT, name TEXT, old_counted DOUBLE PRECISION, new_counted DOUBLE PRECISION, actor TEXT, actor_name TEXT, note TEXT, created_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_stk_count_audit_session ON stocktake_count_audit(session_id)");
            }
            catch (_) { /* tables may already exist */ }
            try {
                // [2026-07-17] 盤點「進行中」鎖＋草稿雲端備援（與 initSqlite 對應；語意見該處註解）
                await client.query("CREATE TABLE IF NOT EXISTS stocktake_draft (icpno TEXT NOT NULL DEFAULT '00', wh_code TEXT NOT NULL, count_date TEXT NOT NULL, device_id TEXT, holder_name TEXT, payload TEXT, started_at TEXT, last_seen_at TEXT, updated_at TEXT, PRIMARY KEY (icpno, wh_code, count_date))");
                // 多公司盤點（松富00＋松揚02…）：場次記公司代碼，NULL 視為 '00'
                await client.query("ALTER TABLE stocktake_session ADD COLUMN IF NOT EXISTS icpno TEXT");
                // [migration 2026-07-13] 效期品也按公司：erp_code 單一主鍵 → (icpno, erp_code)；舊資料補 icpno='00'。
                try {
                    await client.query("ALTER TABLE stocktake_expiry_item ADD COLUMN IF NOT EXISTS icpno TEXT");
                    const eiPk = await client.query("SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = 'stocktake_expiry_item'::regclass AND i.indisprimary");
                    if (!eiPk.rows.some((r) => r.attname === "icpno")) {
                        await client.query("UPDATE stocktake_expiry_item SET icpno = '00' WHERE icpno IS NULL OR TRIM(icpno) = ''");
                        await client.query("ALTER TABLE stocktake_expiry_item DROP CONSTRAINT IF EXISTS stocktake_expiry_item_pkey");
                        await client.query("ALTER TABLE stocktake_expiry_item ALTER COLUMN icpno SET NOT NULL");
                        await client.query("ALTER TABLE stocktake_expiry_item ALTER COLUMN icpno SET DEFAULT '00'");
                        await client.query("ALTER TABLE stocktake_expiry_item ADD PRIMARY KEY (icpno, erp_code)");
                        console.log("[migration] stocktake_expiry_item 主鍵改為 (icpno, erp_code)");
                    }
                }
                catch (e) { console.warn("[migration] stocktake_expiry_item 多公司主鍵遷移失敗:", e?.message || e); }
                // 群組功能白名單：每個 LINE 群組可分別開關「辨識訂單／盤點／空藍」。無資料列＝三項全開（預設全勾）。
                await client.query("CREATE TABLE IF NOT EXISTS group_features (group_id TEXT PRIMARY KEY, feat_order INTEGER NOT NULL DEFAULT 1, feat_stocktake INTEGER NOT NULL DEFAULT 1, feat_basket INTEGER NOT NULL DEFAULT 1, updated_at TEXT)");
                // 一次性遷移：把舊「盤點群組」白名單帶進 group_features，冪等（僅在尚無對應列時填入）。
                // 維持既有行為：非客戶群的內部群＝不辨識訂單（feat_order=0）；已綁客戶的群組先前靠安全防呆仍收單，
                // 故 feat_order=1 保留收單（避免任何客戶群突然斷單），由使用者事後自行到客戶頁取消勾選。盤點/空藍皆維持開啟。
                await client.query("INSERT INTO group_features (group_id, feat_order, feat_stocktake, feat_basket, updated_at) SELECT sg.group_id, CASE WHEN EXISTS (SELECT 1 FROM customers c WHERE c.line_group_id IS NOT NULL AND c.line_group_id <> '' AND LOWER(REPLACE(c.line_group_id,' ','')) = LOWER(REPLACE(sg.group_id,' ',''))) THEN 1 ELSE 0 END, 1, 1, to_char(now(), 'YYYY-MM-DD\"T\"HH24:MI:SS') FROM stocktake_group sg WHERE NOT EXISTS (SELECT 1 FROM group_features gf WHERE gf.group_id = sg.group_id)");
            }
            catch (_) { /* tables may already exist */ }
            try {
                // [fix 2026-07-10] 盤點「一倉一日一筆」補真正的 UNIQUE 約束（與 initSqlite 對應）：
                // 先冪等去重（同倉同日保留最後送出者、清落選明細），再建唯一索引。
                // [fix 2026-07-14] 唯一鍵與去重都必須含公司（icpno）：凌越倉號可跨公司重複，
                // 舊版 (wh_code, count_date) 會讓第二家公司送不出、且啟動去重會誤刪另一家公司的整場盤點。
                await client.query("UPDATE stocktake_session SET icpno = '00' WHERE icpno IS NULL OR TRIM(icpno) = ''");
                await client.query("DELETE FROM stocktake_count WHERE session_id IN (SELECT id FROM stocktake_session s WHERE EXISTS (SELECT 1 FROM stocktake_session s2 WHERE COALESCE(NULLIF(TRIM(s2.icpno),''),'00') = COALESCE(NULLIF(TRIM(s.icpno),''),'00') AND s2.wh_code = s.wh_code AND s2.count_date = s.count_date AND s2.id <> s.id AND (COALESCE(s2.submitted_at, s2.created_at, '') > COALESCE(s.submitted_at, s.created_at, '') OR (COALESCE(s2.submitted_at, s2.created_at, '') = COALESCE(s.submitted_at, s.created_at, '') AND s2.id > s.id))))");
                await client.query("DELETE FROM stocktake_session WHERE EXISTS (SELECT 1 FROM stocktake_session s2 WHERE COALESCE(NULLIF(TRIM(s2.icpno),''),'00') = COALESCE(NULLIF(TRIM(stocktake_session.icpno),''),'00') AND s2.wh_code = stocktake_session.wh_code AND s2.count_date = stocktake_session.count_date AND s2.id <> stocktake_session.id AND (COALESCE(s2.submitted_at, s2.created_at, '') > COALESCE(stocktake_session.submitted_at, stocktake_session.created_at, '') OR (COALESCE(s2.submitted_at, s2.created_at, '') = COALESCE(stocktake_session.submitted_at, stocktake_session.created_at, '') AND s2.id > stocktake_session.id)))");
                await client.query("DROP INDEX IF EXISTS idx_stk_session_wh_date_uniq");
                await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_stk_session_icp_wh_date_uniq ON stocktake_session ((COALESCE(NULLIF(TRIM(icpno),''),'00')), wh_code, count_date)");
            }
            catch (_) { /* 去重/唯一索引失敗不阻斷啟動 */ }
            try {
                // [fix 2026-07-10] 訂單品項「人工修改軌跡」（與 initSqlite 對應）：rebuild 後重放，防覆寫人工修正。
                await client.query("CREATE TABLE IF NOT EXISTS order_item_edits (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, action TEXT NOT NULL, match_key TEXT, raw_name TEXT, quantity DOUBLE PRECISION, unit TEXT, remark TEXT, edited_by TEXT, created_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_order_item_edits_order ON order_item_edits(order_id)");
            }
            catch (_) { /* table may already exist */ }
            try {
                // 每日帳款收款（與 initSqlite 對應）：凌越銷貨單當日快照 + 收款客戶主檔。
                await client.query("CREATE TABLE IF NOT EXISTS cash_sales_doc (icpno TEXT NOT NULL DEFAULT '00', sp_no TEXT NOT NULL, doc_date TEXT NOT NULL, ct_no TEXT, ct_name TEXT, fkfs TEXT, total DOUBLE PRECISION NOT NULL DEFAULT 0, unpaid DOUBLE PRECISION NOT NULL DEFAULT 0, paid DOUBLE PRECISION NOT NULL DEFAULT 0, nopay_fg TEXT, sales TEXT, kind TEXT, ingested_at TEXT, ingested_by TEXT, PRIMARY KEY (icpno, sp_no))");
                await client.query("CREATE INDEX IF NOT EXISTS idx_cash_sales_date ON cash_sales_doc(icpno, doc_date)");
                await client.query("CREATE TABLE IF NOT EXISTS cash_customer (icpno TEXT NOT NULL DEFAULT '00', ct_no TEXT NOT NULL, name TEXT, fkfs TEXT, sales TEXT, is_cash INTEGER, route_line TEXT, stop INTEGER NOT NULL DEFAULT 0, note TEXT, updated_at TEXT, PRIMARY KEY (icpno, ct_no))");
                await client.query("CREATE TABLE IF NOT EXISTS cash_seq_gap_reason (icpno TEXT NOT NULL DEFAULT '00', doc_date TEXT NOT NULL, series TEXT NOT NULL, seq INTEGER NOT NULL, reason TEXT, updated_by TEXT, updated_at TEXT, PRIMARY KEY (icpno, doc_date, series, seq))");
                // 收款（Phase2）
                await client.query("CREATE TABLE IF NOT EXISTS cash_payment (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', ct_no TEXT, ct_name TEXT, pay_date TEXT NOT NULL, collected_by TEXT, route_line TEXT, cash_amount DOUBLE PRECISION NOT NULL DEFAULT 0, check_amount DOUBLE PRECISION NOT NULL DEFAULT 0, total_amount DOUBLE PRECISION NOT NULL DEFAULT 0, due_total DOUBLE PRECISION NOT NULL DEFAULT 0, diff DOUBLE PRECISION NOT NULL DEFAULT 0, note TEXT, recorded_by TEXT, recorded_at TEXT, updated_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_cash_payment_date ON cash_payment(icpno, pay_date)");
                await client.query("CREATE TABLE IF NOT EXISTS cash_payment_alloc (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, icpno TEXT NOT NULL DEFAULT '00', sp_no TEXT NOT NULL, doc_date TEXT, due_amount DOUBLE PRECISION NOT NULL DEFAULT 0, alloc_amount DOUBLE PRECISION NOT NULL DEFAULT 0)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_cash_alloc_sp ON cash_payment_alloc(icpno, sp_no)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_cash_alloc_pay ON cash_payment_alloc(payment_id)");
                await client.query("CREATE TABLE IF NOT EXISTS cash_check (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, icpno TEXT NOT NULL DEFAULT '00', check_no TEXT, bank TEXT, due_date TEXT, amount DOUBLE PRECISION NOT NULL DEFAULT 0, note TEXT, created_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_cash_check_pay ON cash_check(payment_id)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_cash_check_due ON cash_check(icpno, due_date)");
                await client.query("CREATE TABLE IF NOT EXISTS cash_extra_income (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', income_date TEXT NOT NULL, item TEXT, amount DOUBLE PRECISION NOT NULL DEFAULT 0, collected_by TEXT, note TEXT, recorded_by TEXT, created_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_cash_extra_date ON cash_extra_income(icpno, income_date)");
                await client.query("ALTER TABLE cash_customer ADD COLUMN IF NOT EXISTS last_txn TEXT");
                await client.query("ALTER TABLE cash_payment ADD COLUMN IF NOT EXISTS transfer_amount DOUBLE PRECISION NOT NULL DEFAULT 0");
                await client.query("ALTER TABLE cash_extra_income ADD COLUMN IF NOT EXISTS method TEXT");
            }
            catch (_) { /* table may already exist */ }
            try {
                // 錢的原子性：一張銷貨單只能被收款一次（擋併發重複收款）
                await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_alloc_sp_uniq ON cash_payment_alloc(icpno, sp_no)");
            }
            catch (_) { /* 既有重複資料先不建，需人工檢查 */ }
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
                // [feat 2026-07-08] 補欄位：作物代號(料號)、種類代碼、平均價、交易量
                for (const col of ["crop_code TEXT", "category_code TEXT", "avg_price DOUBLE PRECISION", "volume DOUBLE PRECISION"]) {
                    try { await client.query(`ALTER TABLE wholesale_market_snapshots ADD COLUMN IF NOT EXISTS ${col}`); } catch (_) { /* 欄位已存在 */ }
                }
                await client.query("CREATE INDEX IF NOT EXISTS idx_wholesale_snap_crop ON wholesale_market_snapshots(crop_name)");
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
            // === 教育訓練（TTQS / PDDRO）多公司 ===
            try {
                await client.query("CREATE TABLE IF NOT EXISTS training_employee (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', name TEXT NOT NULL, emp_no TEXT, dept TEXT, title TEXT, status TEXT NOT NULL DEFAULT 'active', note TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_training_employee_icpno ON training_employee(icpno, status)");
                await client.query("CREATE TABLE IF NOT EXISTS training_system (icpno TEXT PRIMARY KEY, mission TEXT, vision TEXT, core_values TEXT, policy TEXT, org_note TEXT, goal_short TEXT, goal_mid TEXT, goal_long TEXT, updated_by TEXT, updated_at TEXT)");
                await client.query("CREATE TABLE IF NOT EXISTS training_pddro_check (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', phase TEXT NOT NULL, item TEXT, result TEXT, evidence TEXT, status TEXT, checked_by TEXT, check_date TEXT, created_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_training_pddro_icpno ON training_pddro_check(icpno)");
                await client.query("CREATE TABLE IF NOT EXISTS training_plan (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', year TEXT NOT NULL, title TEXT, goal TEXT, note TEXT, status TEXT NOT NULL DEFAULT 'active', created_by TEXT, created_at TEXT, updated_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_training_plan_icpno ON training_plan(icpno, year)");
                await client.query("CREATE TABLE IF NOT EXISTS training_plan_item (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES training_plan(id) ON DELETE CASCADE, month TEXT, theme TEXT, category TEXT, instructor TEXT, instructor_type TEXT, location TEXT, planned_hours DOUBLE PRECISION, status TEXT NOT NULL DEFAULT 'planned', course_id TEXT, sort_order INTEGER NOT NULL DEFAULT 0, note TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_training_plan_item_plan ON training_plan_item(plan_id)");
                await client.query("CREATE TABLE IF NOT EXISTS training_course (id TEXT PRIMARY KEY, icpno TEXT NOT NULL DEFAULT '00', plan_item_id TEXT, title TEXT NOT NULL, category TEXT, course_date TEXT, start_time TEXT, end_time TEXT, hours DOUBLE PRECISION, instructor TEXT, instructor_type TEXT, location TEXT, target_audience TEXT, objective TEXT, summary TEXT, cost DOUBLE PRECISION, handler TEXT, confirmed_by TEXT, status TEXT NOT NULL DEFAULT 'planned', created_by TEXT, created_at TEXT, updated_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_training_course_icpno ON training_course(icpno, course_date)");
                await client.query("CREATE TABLE IF NOT EXISTS training_attendance (id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES training_course(id) ON DELETE CASCADE, employee_id TEXT, name TEXT, dept TEXT, signed INTEGER NOT NULL DEFAULT 1, hours DOUBLE PRECISION, note TEXT, created_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_training_attendance_course ON training_attendance(course_id)");
                await client.query("CREATE TABLE IF NOT EXISTS training_survey (id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES training_course(id) ON DELETE CASCADE, employee_id TEXT, respondent TEXT, content_score INTEGER, instructor_score INTEGER, useful_score INTEGER, overall_score INTEGER, comment TEXT, created_at TEXT)");
                await client.query("CREATE INDEX IF NOT EXISTS idx_training_survey_course ON training_survey(course_id)");
                await client.query("CREATE TABLE IF NOT EXISTS training_outcome (course_id TEXT PRIMARY KEY REFERENCES training_course(id) ON DELETE CASCADE, reaction TEXT, learning TEXT, behavior TEXT, result TEXT, eval_method TEXT, eval_score TEXT, effectiveness_note TEXT, evidence_url TEXT, evaluated_by TEXT, evaluated_at TEXT, updated_at TEXT)");
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
