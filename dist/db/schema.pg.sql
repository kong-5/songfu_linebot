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
    lingyue_exported_at TIMESTAMPTZ,
    remark TEXT,
    order_sub_split_key TEXT,
    line_message_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orders_line_message_id ON orders(line_message_id);

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
    include_export INTEGER,
    sub_customer TEXT,
    confidence_score INTEGER
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
  CREATE INDEX IF NOT EXISTS idx_data_change_entity ON data_change_log(entity_type);

  CREATE TABLE IF NOT EXISTS gemini_usage_log (
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
  );
  CREATE INDEX IF NOT EXISTS idx_gemini_usage_created ON gemini_usage_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_gemini_usage_customer ON gemini_usage_log(customer_id);

  CREATE TABLE IF NOT EXISTS prompt_versions (
    id TEXT PRIMARY KEY,
    slot TEXT NOT NULL,
    label TEXT NOT NULL,
    body TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_prompt_versions_slot ON prompt_versions(slot);

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
    wrong_count INTEGER NOT NULL DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
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

  CREATE TABLE IF NOT EXISTS rhythm_daily_signals (
    id TEXT PRIMARY KEY,
    signal_date TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    signal_type TEXT NOT NULL,
    meta_json TEXT,
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rhythm_sig_date ON rhythm_daily_signals(signal_date);
  CREATE INDEX IF NOT EXISTS idx_rhythm_sig_cust ON rhythm_daily_signals(customer_id);
  CREATE UNIQUE INDEX IF NOT EXISTS ux_rhythm_sig_unique ON rhythm_daily_signals(signal_date, customer_id, product_id, signal_type);

  CREATE TABLE IF NOT EXISTS complaint_handling (
    order_id TEXT PRIMARY KEY REFERENCES orders(id),
    handle_status TEXT NOT NULL DEFAULT 'pending',
    handler TEXT,
    note TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_complaint_handling_status ON complaint_handling(handle_status);

  -- 空籃記帳（司機在 LINE 群組打「空籃 去5 收3」自動寫入；每客戶每天 UPSERT 覆蓋）
  CREATE TABLE IF NOT EXISTS basket_logs (
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
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_basket_logs_cust_date ON basket_logs(customer_id, log_date);
  CREATE INDEX IF NOT EXISTS idx_basket_logs_date ON basket_logs(log_date);

  -- 覆蓋歷史（每次重發都記一筆，方便追蹤司機是不是打錯）
  CREATE TABLE IF NOT EXISTS basket_log_history (
    id TEXT PRIMARY KEY,
    basket_log_id TEXT NOT NULL REFERENCES basket_logs(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    log_date DATE NOT NULL,
    prev_taken_to INTEGER,
    prev_picked_up INTEGER,
    new_taken_to INTEGER,
    new_picked_up INTEGER,
    prev_lines_json TEXT,
    new_lines_json TEXT,
    actor TEXT,
    reporter_user_id TEXT,
    raw_message TEXT,
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_basket_log_hist_log ON basket_log_history(basket_log_id);

  -- 空籃分項（每個規格 × 號碼一筆；號碼籃 basket_no 1-9，其他 basket_no = 0）
  CREATE TABLE IF NOT EXISTS basket_log_lines (
    id TEXT PRIMARY KEY,
    basket_log_id TEXT NOT NULL REFERENCES basket_logs(id) ON DELETE CASCADE,
    basket_kind TEXT NOT NULL,
    basket_no INTEGER NOT NULL DEFAULT 0,
    taken_to INTEGER NOT NULL DEFAULT 0,
    picked_up INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_basket_log_lines_uniq ON basket_log_lines(basket_log_id, basket_kind, basket_no);
  CREATE INDEX IF NOT EXISTS idx_basket_log_lines_log ON basket_log_lines(basket_log_id);
  -- 公告管理：模板化群發訊息（取代/擴充原 broadcast 即時填表）
  CREATE TABLE IF NOT EXISTS announcements (
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
  );
  CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
  CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at);

  -- 大宗原物料行情：豬肉、雞肉、雞蛋等
  CREATE TABLE IF NOT EXISTS commodity_prices (
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
  );
  CREATE INDEX IF NOT EXISTS idx_commodity_prices_date ON commodity_prices(record_date);
  CREATE INDEX IF NOT EXISTS idx_commodity_prices_cat ON commodity_prices(category);

  -- 公司行事曆：國定假日／公司公休／加班／自訂事件
  CREATE TABLE IF NOT EXISTS company_calendar (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_company_calendar_date ON company_calendar(date);
  CREATE INDEX IF NOT EXISTS idx_company_calendar_kind ON company_calendar(kind);

  -- LINE 群組對話紀錄（訂單審核顯示對話用；含同事回覆與發話者名稱）
  CREATE TABLE IF NOT EXISTS line_conversation_log (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    customer_id TEXT,
    order_id TEXT,
    sender_kind TEXT NOT NULL,
    sender_line_user_id TEXT,
    sender_name TEXT,
    msg_type TEXT,
    text TEXT,
    created_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_line_convo_order ON line_conversation_log(order_id);
  CREATE INDEX IF NOT EXISTS idx_line_convo_group ON line_conversation_log(group_id, created_at);

  -- LINE 群組發言者（自動偵測；後台可從名單一鍵標記為同事）
  CREATE TABLE IF NOT EXISTS line_group_speakers (
    group_id TEXT NOT NULL,
    line_user_id TEXT NOT NULL,
    display_name TEXT,
    message_count INTEGER NOT NULL DEFAULT 0,
    first_spoke_at TIMESTAMPTZ,
    last_spoke_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    PRIMARY KEY (group_id, line_user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_line_speakers_last ON line_group_speakers(last_spoke_at);

  -- ── 客戶報價（月報）：quote_report 表頭、quote_item 明細 ──
  -- 每月月底前做「下月」報價單；價格會浮動故每月重做，新月帶入上月當底稿。
  -- is_quoted=0 表「不報價」（單價留白但仍列出）。
  CREATE TABLE IF NOT EXISTS quote_report (
    id TEXT PRIMARY KEY,
    ym TEXT NOT NULL UNIQUE,
    roc_label TEXT,
    title TEXT,
    subtitle TEXT,
    company TEXT,
    address TEXT,
    tel TEXT,
    fax TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    note TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS quote_item (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '未分類',
    name TEXT NOT NULL,
    spec TEXT,
    price TEXT,
    is_quoted INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_quote_item_report ON quote_item(report_id);

  -- ── 飯店客戶報價：每家飯店各一份；品項沿用 quote_item（report_id = hotel_quote.id）──
  CREATE TABLE IF NOT EXISTS hotel_quote (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    company TEXT,
    address TEXT,
    tel TEXT,
    fax TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    note TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_hotel_quote_name ON hotel_quote(customer_name);
