"use strict";
/**
 * 稽核軌跡（data_change_log）單一權威實作 — 2026-09-01 體檢定案
 * ==================================================================
 * 守則 #3：所有資料異動要寫入稽核軌跡（誰、何時、改了什麼、舊值新值）。
 *
 * 為什麼要收斂成一份：體檢時全庫有三套各自為政的實作——
 *   1. dist/admin/index.js  logDataChange()      （權威版，但吞錯且寫在交易外）
 *   2. dist/liff/index.js   logFromLiff()        （複製品，actor 前綴 liff:）
 *   3. dist/webhook/line.js 六處內嵌 INSERT       （id 用 Math.random() 而非 newId）
 * 三套要各補一次「進交易」「補欄位」，實務上就是永遠補不齊。
 *
 * ── 兩個函式，差別只在「出錯時怎麼辦」，選錯會出事所以名字取得很白 ──
 *
 *   writeAudit(h, opts)      出錯會 throw。**在交易裡一律用這個。**
 *                            軌跡寫不進去 → 整筆 ROLLBACK → 不會出現
 *                            「錢動了/單改了、但軌跡沒留」的狀態。
 *
 *   writeAuditSafe(db, opts) 出錯只 console.error。給「主寫入已經 commit 完、
 *                            軌跡補在後面」的既有呼叫處用（相容舊行為，不改語意）。
 *                            新程式碼請優先把主寫入和軌跡包進同一個交易 + writeAudit。
 *
 * 第一個參數 h 可以是 db wrapper，也可以是 db.transaction(fn) 給的交易 handle——
 * 兩者都只需要 .prepare().run()，所以同一份程式碼在交易內外都能用。
 *
 * opts:
 *   entityType  必填  "order" / "customer" / "product" / "stocktake_session" ...
 *   entityId    必填  該筆資料的 id
 *   action      必填  "create" / "update" / "delete" / "submit" / 自訂動詞
 *   actor       必填  操作者。後台＝username；LIFF＝"liff:<username>"；
 *                     系統＝"system:<來源>"（例 "system:line_unsend"）
 *   summary     選填  一句話人看得懂的描述（後台稽核頁直接顯示這欄）
 *   meta        選填  物件，會 JSON.stringify 進 meta_json。**舊值/新值放這裡。**
 *   productId   選填  牽涉到品項時填，方便用料號查
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAudit = writeAudit;
exports.writeAuditSafe = writeAuditSafe;
exports.auditNowSql = auditNowSql;

const id_js_1 = require("./id.js");

/**
 * 目前時間的 SQL 片語。SQLite 與 PG 寫法不同，而全庫有 22 個域檔各自複製
 * `process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')"`——
 * 這是方言抽象漏出來的徵兆。稽核這條路徑先統一用這個。
 * （註：sqlForPg 其實會把 datetime('now') 自動轉成 CURRENT_TIMESTAMP，
 *   這裡明寫是為了讓 SQL 在兩邊 log 出來都一眼看得懂。）
 */
function auditNowSql() {
    return process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
}

function buildRow(opts) {
    const entityType = String(opts?.entityType || "").trim();
    const action = String(opts?.action || "").trim();
    if (!entityType) throw new Error("writeAudit: 缺少 entityType");
    if (!action) throw new Error("writeAudit: 缺少 action");
    return {
        id: (0, id_js_1.newId)("dcl"),
        entityType,
        entityId: opts.entityId == null ? null : String(opts.entityId),
        productId: opts.productId == null ? null : String(opts.productId),
        action,
        summary: opts.summary == null ? null : String(opts.summary),
        metaJson: opts.meta == null ? null : JSON.stringify(opts.meta),
        actor: String(opts.actor || ""),
    };
}

async function insertRow(h, r) {
    await h.prepare(
        "INSERT INTO data_change_log (id, entity_type, entity_id, product_id, action, summary, meta_json, actor_username, created_at)" +
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, " + auditNowSql() + ")"
    ).run(r.id, r.entityType, r.entityId, r.productId, r.action, r.summary, r.metaJson, r.actor);
    return r.id;
}

/**
 * 寫稽核，失敗會 throw。交易內一律用這個。
 * @param {{prepare:Function}} h  db wrapper 或交易 handle
 * @returns {Promise<string>} 寫入的 log id
 */
async function writeAudit(h, opts) {
    return insertRow(h, buildRow(opts));
}

/**
 * 寫稽核，失敗只記 log 不 throw（相容既有「主寫入已 commit、軌跡補在後面」的呼叫處）。
 * @returns {Promise<string|null>} 成功回 log id，失敗回 null
 */
async function writeAuditSafe(h, opts) {
    try {
        return await insertRow(h, buildRow(opts));
    } catch (e) {
        // 這裡吞掉是刻意的：主資料已經寫進去了，這時再 throw 只會讓使用者看到
        // 一個「其實已經成功」的錯誤。但軌跡掉了是真的問題 → 用 error 級別留 log。
        console.error("[audit] data_change_log 寫入失敗（主資料已寫入，軌跡遺失）:", e?.message || e, {
            entityType: opts?.entityType, entityId: opts?.entityId, action: opts?.action,
        });
        return null;
    }
}
