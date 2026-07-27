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
// [fix 2026-07-27 體檢] await：PG 模式（DATABASE_URL）initDb 回 Promise，舊版沒等完成就印「initialized」
// 並以 exit 0 結束，schema 可能只跑一半、失敗變 unhandled rejection（dist/index.js 與 seed.js 都有 await，只有這支漏了）。
Promise.resolve((0, index_js_1.initDb)(dbPath)).then(() => {
    console.log("Database initialized at", dbPath);
}).catch((e) => {
    console.error("Database init failed:", e?.message || e);
    process.exitCode = 1;
});
