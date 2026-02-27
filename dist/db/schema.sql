-- 客戶（可對應 LINE 群組）
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teraoka_code TEXT,
  hq_cust_code TEXT,
  line_group_name TEXT,
  line_group_id TEXT UNIQUE,
  contact TEXT,
  order_notes TEXT,
  default_unit TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 品項主檔
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  erp_code TEXT,
  teraoka_barcode TEXT,
  unit TEXT NOT NULL DEFAULT '公斤',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 俗名／別名對照
CREATE TABLE IF NOT EXISTS product_aliases (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(alias)
);

-- 客戶專用別名
CREATE TABLE IF NOT EXISTS customer_product_aliases (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_id, alias)
);

-- 訂單主檔
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  order_date TEXT NOT NULL,
  line_group_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  raw_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_id, order_date)
);

-- 訂單明細
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  raw_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT,
  need_review INTEGER NOT NULL DEFAULT 0,
  include_export INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 單品規格表
CREATE TABLE IF NOT EXISTS product_unit_specs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  note_label TEXT,
  conversion_kg REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, unit)
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders(customer_id, order_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_product_aliases_alias ON product_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_customer_aliases ON customer_product_aliases(customer_id, alias);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_product_unit_specs_product ON product_unit_specs(product_id);
