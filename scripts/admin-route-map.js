"use strict";
/**
 * 拆檔驗證工具（拆檔批次 5 起）：印出 admin router 的「URL → 命中哪條路由」對照表。
 *
 * 為什麼需要它：拆檔到後期，被搬走的路由在原檔往往是**不連續的**（中間夾別域的路由），
 * 一次註冊會改變 router 註冊順序 → 不能再用「路由順序完全一致」當驗證。
 * 這支工具對每條路由用多種參數值造樣本 URL，走整個 stack 找「第一個命中者」，
 * 只要拆前拆後這張表逐字相同，就等於「任何 URL 打到的 handler 沒變」。
 *
 * 用法：
 *   node scripts/admin-route-map.js > /tmp/before.txt   # 拆檔前
 *   （做拆檔）
 *   node scripts/admin-route-map.js > /tmp/after.txt    # 拆檔後
 *   diff /tmp/before.txt /tmp/after.txt                 # 必須為空
 *
 * 註：輸出不含路由索引（索引本來就會因搬移而變），只比「命中的 path pattern」。
 */
const path = require("node:path");
const os = require("node:os");

process.env.DB_PATH = process.env.DB_PATH || path.join(os.tmpdir(), "songfu-route-map.db");
const { createAdminRouter } = require(path.join(__dirname, "..", "dist", "admin", "index.js"));

const routes = createAdminRouter().stack.filter((l) => l.route).map((l) => ({
    path: l.route.path,
    methods: Object.keys(l.route.methods).filter((m) => l.route.methods[m]),
    layer: l,
}));

// 具名參數換成多種具體值：除了一般 id，也放會與其他 pattern 的字面路徑相撞的值
const SAMPLES = ["X1", "batch-delete", "new", "add", "export.csv", "123"];
const urls = new Set();
for (const r of routes) for (const s of SAMPLES) urls.add(r.path.replace(/:[A-Za-z0-9_]+/g, s));

const METHODS = ["get", "post", "put", "delete"];
const out = [];
for (const url of [...urls].sort()) {
    for (const m of METHODS) {
        const hit = routes.find((r) => {
            if (!r.methods.includes(m)) return false;
            try { return !!r.layer.match(url); } catch (_) { return false; }
        });
        if (hit) out.push(`${m.toUpperCase()} ${url} -> ${hit.path}`);
    }
}
console.log(out.join("\n"));
console.error(`[route-map] ${routes.length} 條路由、${out.length} 條 URL 探針`);
process.exit(0);
