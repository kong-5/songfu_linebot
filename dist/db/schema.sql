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
  updated_at TEXT
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

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
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
