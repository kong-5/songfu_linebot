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
  route_line INTEGER
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
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  raw_name TEXT,
  quantity REAL,
  unit TEXT,
  remark TEXT,
  need_review INTEGER NOT NULL DEFAULT 0,
  include_export INTEGER,
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

CREATE TABLE IF NOT EXISTS product_unit_specs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  unit TEXT NOT NULL,
  note_label TEXT,
  conversion_kg REAL,
  updated_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

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
