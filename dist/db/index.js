"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.initDb = initDb;
exports.closeDb = closeDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = require("fs");
const path_1 = require("path");
const schemaPath = (0, path_1.join)(__dirname, "schema.sql");
let db = null;
function getDb(dbPath) {
    if (!db) {
        db = new better_sqlite3_1.default(dbPath);
        db.pragma("journal_mode = WAL");
    }
    return db;
}
function initDb(dbPath) {
    const database = getDb(dbPath);
    const schema = (0, fs_1.readFileSync)(schemaPath, "utf-8");
    database.exec(schema);
    try {
        database.exec("ALTER TABLE customers ADD COLUMN teraoka_code TEXT");
    }
    catch {
        /* column may already exist */
    }
    try {
        database.exec("ALTER TABLE customers ADD COLUMN hq_cust_code TEXT");
    }
    catch {
        /* column may already exist */
    }
    try {
        database.exec("ALTER TABLE customers ADD COLUMN line_group_name TEXT");
    }
    catch {
        /* column may already exist */
    }
    try {
        database.exec("ALTER TABLE customers ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
    }
    catch {
        /* column may already exist */
    }
    try {
        database.exec("ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
    }
    catch {
        /* column may already exist */
    }
    try {
        database.exec("ALTER TABLE customers ADD COLUMN order_notes TEXT");
    }
    catch {
        /* column may already exist */
    }
    try {
        database.exec("ALTER TABLE customers ADD COLUMN default_unit TEXT");
    }
    catch {
        /* column may already exist */
    }
    try {
        database.exec("ALTER TABLE order_items ADD COLUMN remark TEXT");
    }
    catch {
        /* column may already exist */
    }
}
function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}
