"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const fs_1 = require("fs");
const path_1 = require("path");
const index_js_1 = require("./index.js");
const id_js_1 = require("../lib/id.js");
(0, dotenv_1.config)();
const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
const dir = (0, path_1.dirname)(dbPath);
if (!(0, fs_1.existsSync)(dir))
    (0, fs_1.mkdirSync)(dir, { recursive: true });
// ON CONFLICT DO NOTHING（非 INSERT OR IGNORE）＋ await：SQLite 與 Postgres 都能跑
(async () => {
    await (0, index_js_1.initDb)(dbPath);
    const db = (0, index_js_1.getDb)(dbPath);
    // 範例客戶
    const cust1 = (0, id_js_1.newId)("cust");
    const cust2 = (0, id_js_1.newId)("cust");
    await db.prepare("INSERT INTO customers (id, name, contact) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING").run(cust1, "範例客戶A", "");
    await db.prepare("INSERT INTO customers (id, name, contact) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING").run(cust2, "範例客戶B", "");
    // 範例品項與俗名
    const p1 = (0, id_js_1.newId)("prod");
    const p2 = (0, id_js_1.newId)("prod");
    await db.prepare(`INSERT INTO products (id, name, erp_code, unit) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`).run(p1, "高麗菜", "ERP001", "斤");
    await db.prepare(`INSERT INTO products (id, name, erp_code, unit) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`).run(p2, "福山萵苣", "ERP002", "斤");
    await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING").run((0, id_js_1.newId)("pa"), p2, "大陸妹");
    await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING").run((0, id_js_1.newId)("pa"), p1, "甘藍");
    console.log("Seed done. Sample customers & products (with aliases) added.");
    console.log("Bind LINE group to a customer by setting customers.line_group_id (e.g. via future admin API).");
    await (0, index_js_1.closeDb)();
})().catch((e) => { console.error("Seed failed:", e); process.exit(1); });
