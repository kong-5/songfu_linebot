"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const dotenv_1 = require("dotenv");
const index_js_1 = require("./index.js");
(0, dotenv_1.config)();
const dbPath = process.env.DB_PATH ?? "./data/songfu.db";
const dir = (0, path_1.dirname)(dbPath);
if (!(0, fs_1.existsSync)(dir)) {
    (0, fs_1.mkdirSync)(dir, { recursive: true });
}
(0, index_js_1.initDb)(dbPath);
console.log("Database initialized at", dbPath);
