-- SQLite schema for songfu_linebot
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teraoka_code TEXT,
  hq_cust_code TEXT,
  line_group_name TEXT,
  line_group_id TEXT,
  contact TEXT,
  order_notes TEXT,
  default_unit TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT,
  route_line INTEGER,
  known_sub_customers TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  erp_code TEXT,
  teraoka_barcode TEXT,
  unit TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT,
  customer_id TEXT NOT NULL,
  order_date TEXT NOT NULL,
  line_group_id TEXT,
  raw_message TEXT,
  status TEXT,
  updated_at TEXT,
  sheet_exported_at TEXT,
  lingyue_exported_at TEXT,
  remark TEXT,
  order_sub_split_key TEXT,
  line_message_id TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_line_message_id ON orders(line_message_id);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  raw_name TEXT,
  quantity REAL,
  unit TEXT,
  remark TEXT,
  display_order INTEGER,
  need_review INTEGER NOT NULL DEFAULT 0,
  include_export INTEGER,
  sub_customer TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS order_attachments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  line_message_id TEXT NOT NULL,
  created_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 北農行情每日快照（篩選後之青菜／葉菜等，僅存上中下架）
CREATE TABLE IF NOT EXISTS wholesale_market_snapshots (
  id TEXT PRIMARY KEY,
  record_date TEXT NOT NULL,
  market_name TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  category TEXT,
  high_price REAL,
  mid_price REAL,
  low_price REAL,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wholesale_snap_date ON wholesale_market_snapshots(record_date);

-- 後台資料變更紀錄（品項、俗名等，供建置期追溯）
CREATE TABLE IF NOT EXISTS data_change_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  product_id TEXT,
  action TEXT NOT NULL,
  summary TEXT,
  meta_json TEXT,
  actor_username TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_data_change_product ON data_change_log(product_id);
CREATE INDEX IF NOT EXISTS idx_data_change_created ON data_change_log(created_at);
CREATE INDEX IF NOT EXISTS idx_data_change_entity ON data_change_log(entity_type);

-- Gemini API 呼叫紀錄（延遲、token 估算，供辨識成效儀表）
CREATE TABLE IF NOT EXISTS gemini_usage_log (
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
);
CREATE INDEX IF NOT EXISTS idx_gemini_usage_created ON gemini_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_gemini_usage_customer ON gemini_usage_log(customer_id);

-- Gemini system prompt 版本（後台可編輯；線上／A/B 指標存 app_settings）
CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  slot TEXT NOT NULL,
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_slot ON prompt_versions(slot);

-- LINE 機器人：狀態／設定變更紀錄（啟動、排程、模式切換）
CREATE TABLE IF NOT EXISTS line_bot_state_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS product_aliases (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS customer_product_aliases (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 客戶筆跡／辨識對照：人工核定後累積，供 Gemini 與 resolve 優先對應
CREATE TABLE IF NOT EXISTS customer_handwriting_hints (
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
);
CREATE INDEX IF NOT EXISTS idx_cust_handwriting_hints_customer ON customer_handwriting_hints(customer_id);

-- Few-Shot：客戶範例圖（僅存路徑或 URL，不存 BLOB）+ 核定明細 JSON（動態學習）
-- source_order_id：可選來源訂單；order_id／attachment_id／note 供後台從訂單轉存既有流程
CREATE TABLE IF NOT EXISTS customer_order_image_examples (
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
);
CREATE INDEX IF NOT EXISTS idx_customer_examples ON customer_order_image_examples(customer_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cust_order_img_ex_customer ON customer_order_image_examples(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_order_img_ex_order ON customer_order_image_examples(order_id);

CREATE TABLE IF NOT EXISTS product_unit_specs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  unit TEXT NOT NULL,
  note_label TEXT,
  conversion_kg REAL,
  updated_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 包裝階層：1 外層單位 = inner_count 個內層單位（例：1 箱 = 12 包）
CREATE TABLE IF NOT EXISTS product_packaging_ratios (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  outer_unit TEXT NOT NULL,
  inner_unit TEXT NOT NULL,
  inner_count REAL NOT NULL,
  note TEXT,
  created_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_product_pack_ratio ON product_packaging_ratios(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_pack_pair ON product_packaging_ratios(product_id, outer_unit, inner_unit);

-- 盤點作業：庫房、品項歸倉、每日盤點
CREATE TABLE IF NOT EXISTS inventory_warehouses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS inventory_warehouse_products (
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  safety_stock REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (warehouse_id, product_id),
  FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS erp_sales (
  id TEXT PRIMARY KEY,
  record_date TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty_sold REAL NOT NULL DEFAULT 0,
  imported_at TEXT
);
CREATE TABLE IF NOT EXISTS daily_inventory (
  id TEXT PRIMARY KEY,
  record_date TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  filler_name TEXT NOT NULL DEFAULT '',
  recorded_at TEXT,
  items TEXT NOT NULL DEFAULT '{}',
  confirmed_at TEXT,
  confirmer_name TEXT,
  FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id)
);

-- 物流工具：紙本訂單整理（訂單整理）
CREATE TABLE IF NOT EXISTS logistics_orders (
  id TEXT PRIMARY KEY,
  order_date TEXT NOT NULL,
  customer_id TEXT,
  raw_message TEXT,
  memo TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS logistics_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  raw_name TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT,
  remark TEXT,
  amount TEXT,
  need_review INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES logistics_orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 環境衛生管理：冷凍庫冷藏庫檢查表
CREATE TABLE IF NOT EXISTS freezer_fridge_warehouses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  compliant_temp TEXT NOT NULL DEFAULT '',
  power_compliant TEXT NOT NULL DEFAULT 'on',
  light_compliant TEXT NOT NULL DEFAULT 'off',
  heat_compliant TEXT NOT NULL DEFAULT 'off'
);
CREATE TABLE IF NOT EXISTS freezer_fridge_daily (
  date TEXT PRIMARY KEY,
  entries_json TEXT NOT NULL DEFAULT '[]',
  filler_name TEXT NOT NULL DEFAULT '',
  filler_signature TEXT,
  confirmed_at TEXT,
  confirmer_signature TEXT,
  anomaly INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  resolve_note TEXT
);

-- 週期分析：客戶×品項訂單節律（純 SQL 排程產生，零 AI）
CREATE TABLE IF NOT EXISTS rhythm_daily_signals (
  id TEXT PRIMARY KEY,
  signal_date TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rhythm_sig_date ON rhythm_daily_signals(signal_date);
CREATE INDEX IF NOT EXISTS idx_rhythm_sig_cust ON rhythm_daily_signals(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rhythm_sig_unique ON rhythm_daily_signals(signal_date, customer_id, product_id, signal_type);
