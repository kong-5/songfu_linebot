  -- PostgreSQL schema for songfu_linebot（Cloud SQL / Supabase 等）
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
    updated_at TIMESTAMPTZ,
    route_line INTEGER
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    erp_code TEXT,
    teraoka_barcode TEXT,
    unit TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    order_date TEXT NOT NULL,
    line_group_id TEXT,
    raw_message TEXT,
    status TEXT,
    updated_at TIMESTAMPTZ,
    sheet_exported_at TIMESTAMPTZ,
    lingyue_exported_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    product_id TEXT REFERENCES products(id),
    raw_name TEXT,
    quantity DOUBLE PRECISION,
    unit TEXT,
    remark TEXT,
    display_order INTEGER,
    need_review INTEGER NOT NULL DEFAULT 0,
    include_export INTEGER
  );

  CREATE TABLE IF NOT EXISTS order_attachments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    line_message_id TEXT NOT NULL,
    created_at TIMESTAMPTZ,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS wholesale_market_snapshots (
    id TEXT PRIMARY KEY,
    record_date TEXT NOT NULL,
    market_name TEXT NOT NULL,
    crop_name TEXT NOT NULL,
    category TEXT,
    high_price DOUBLE PRECISION,
    mid_price DOUBLE PRECISION,
    low_price DOUBLE PRECISION,
    created_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_wholesale_snap_date ON wholesale_market_snapshots(record_date);

  CREATE TABLE IF NOT EXISTS data_change_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    product_id TEXT,
    action TEXT NOT NULL,
    summary TEXT,
    meta_json TEXT,
    actor_username TEXT,
    created_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_data_change_product ON data_change_log(product_id);
  CREATE INDEX IF NOT EXISTS idx_data_change_created ON data_change_log(created_at);

  CREATE TABLE IF NOT EXISTS line_bot_state_log (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS product_aliases (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    alias TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customer_product_aliases (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    alias TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customer_handwriting_hints (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    raw_key TEXT NOT NULL,
    raw_name_last TEXT,
    product_id TEXT NOT NULL REFERENCES products(id),
    hit_count INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(customer_id, raw_key)
  );
  CREATE INDEX IF NOT EXISTS idx_cust_handwriting_hints_customer ON customer_handwriting_hints(customer_id);

  CREATE TABLE IF NOT EXISTS customer_order_image_examples (
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
  );
  CREATE INDEX IF NOT EXISTS idx_customer_examples ON customer_order_image_examples(customer_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_cust_order_img_ex_customer ON customer_order_image_examples(customer_id);
  CREATE INDEX IF NOT EXISTS idx_cust_order_img_ex_order ON customer_order_image_examples(order_id);

  CREATE TABLE IF NOT EXISTS product_unit_specs (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    unit TEXT NOT NULL,
    note_label TEXT,
    conversion_kg DOUBLE PRECISION,
    updated_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS product_packaging_ratios (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    outer_unit TEXT NOT NULL,
    inner_unit TEXT NOT NULL,
    inner_count DOUBLE PRECISION NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_product_pack_ratio ON product_packaging_ratios(product_id);
  CREATE UNIQUE INDEX IF NOT EXISTS ux_product_pack_pair ON product_packaging_ratios(product_id, outer_unit, inner_unit);

  -- 盤點作業：庫房、品項歸倉、每日盤點
  CREATE TABLE IF NOT EXISTS inventory_warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS inventory_warehouse_products (
    warehouse_id TEXT NOT NULL REFERENCES inventory_warehouses(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    safety_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
    PRIMARY KEY (warehouse_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS erp_sales (
    id TEXT PRIMARY KEY,
    record_date TEXT NOT NULL,
    warehouse_id TEXT NOT NULL REFERENCES inventory_warehouses(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    qty_sold DOUBLE PRECISION NOT NULL DEFAULT 0,
    imported_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS daily_inventory (
    id TEXT PRIMARY KEY,
    record_date TEXT NOT NULL,
    warehouse_id TEXT NOT NULL REFERENCES inventory_warehouses(id),
    filler_name TEXT NOT NULL DEFAULT '',
    recorded_at TIMESTAMPTZ,
    items JSONB NOT NULL DEFAULT '{}',
    confirmed_at TIMESTAMPTZ,
    confirmer_name TEXT
  );

  -- 物流工具：紙本訂單整理
  CREATE TABLE IF NOT EXISTS logistics_orders (
    id TEXT PRIMARY KEY,
    order_date TEXT NOT NULL,
    customer_id TEXT,
    raw_message TEXT,
    memo TEXT,
    created_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS logistics_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES logistics_orders(id),
    product_id TEXT REFERENCES products(id),
    raw_name TEXT,
    quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit TEXT,
    remark TEXT,
    amount TEXT,
    need_review INTEGER NOT NULL DEFAULT 0
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
    confirmed_at TIMESTAMPTZ,
    confirmer_signature TEXT,
    anomaly INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    resolve_note TEXT
  );
