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
(0, index_js_1.initDb)(dbPath);
const db = (0, index_js_1.getDb)(dbPath);
// 範例客戶
const cust1 = (0, id_js_1.newId)("cust");
const cust2 = (0, id_js_1.newId)("cust");
db.prepare("INSERT OR IGNORE INTO customers (id, name, contact) VALUES (?, ?, ?)").run(cust1, "範例客戶A", "");
db.prepare("INSERT OR IGNORE INTO customers (id, name, contact) VALUES (?, ?, ?)").run(cust2, "範例客戶B", "");
// 範例品項與俗名
const p1 = (0, id_js_1.newId)("prod");
const p2 = (0, id_js_1.newId)("prod");
db.prepare(`INSERT OR IGNORE INTO products (id, name, erp_code, unit) VALUES (?, ?, ?, ?)`).run(p1, "高麗菜", "ERP001", "斤");
db.prepare(`INSERT OR IGNORE INTO products (id, name, erp_code, unit) VALUES (?, ?, ?, ?)`).run(p2, "福山萵苣", "ERP002", "斤");
db.prepare("INSERT OR IGNORE INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run((0, id_js_1.newId)("pa"), p2, "大陸妹");
db.prepare("INSERT OR IGNORE INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run((0, id_js_1.newId)("pa"), p1, "甘藍");
console.log("Seed done. Sample customers & products (with aliases) added.");
console.log("Bind LINE group to a customer by setting customers.line_group_id (e.g. via future admin API).");
