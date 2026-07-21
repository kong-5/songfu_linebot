"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StkApiError = StkApiError;
exports.stkTaipeiDate = stkTaipeiDate;
exports.listStocktakeWarehouses = listStocktakeWarehouses;
exports.getStocktakeItems = getStocktakeItems;
exports.submitStocktake = submitStocktake;
/**
 * [refactor 2026-07-14] 盤點 API 共用實作（單一權威）。
 * 過去 warehouses / items / submit 三套幾乎逐字複製在三處：
 *   LIFF（dist/liff/index.js /api/stocktake/*）、後台掃碼（/admin/scan/*）、
 *   後台網頁盤點（/admin/inventory/entry/*），
 * 已出現「修 A 忘 B」的分岔（掃碼版 items 不回效期 → 重送洗掉效期批號，2026-07-14 才補修）。
 * 收斂後三處 router 只剩：認證＋參數解析＋身分欄位，資料邏輯全在這裡一份。
 *
 * 行為契約（與收斂前逐項對齊，不改變任何回應形狀）：
 * - warehouses：{ date, warehouses:[{code,name,sort,items,countedToday}] }
 * - items：{ date, warehouse:{code,name}, items, saved, resumed, submittedAt[, sysQtySource] }
 *   minimal 模式（掃碼頁）：items 不帶 exp/eunit 真值、hp、mc，回應不帶 sysQtySource。
 * - submit：{ ok:true, counted, total }；錯誤丟 StkApiError（httpStatus/code），由 router 轉 JSON。
 *   三保險不變：日期僅限今/昨、樂觀鎖 baseSubmittedAt、唯一索引撞鍵 409 fallback、整批單一交易。
 */
const { newId } = require("./id.js");
const stock_mustcount_js_1 = require("./stock-mustcount.js");

function StkApiError(httpStatus, message, code) {
    const e = new Error(message);
    e.name = "StkApiError";
    e.httpStatus = httpStatus;
    if (code) e.code = code;
    return e;
}

/** 台北時區日期（YYYY-MM-DD）；可傳指定時間點（now-24h＝台北的「昨日」，台北無夏令時間） */
function stkTaipeiDate(at) {
    const d = at instanceof Date ? at : new Date();
    try {
        const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
        const g = (t) => (p.find((x) => x.type === t) || {}).value;
        return g("year") + "-" + g("month") + "-" + g("day");
    } catch (_) { return d.toISOString().slice(0, 10); }
}

const ICP = "COALESCE(NULLIF(TRIM(icpno),''),'00')";

async function listStocktakeWarehouses(db, { icpno }) {
    const date = stkTaipeiDate();
    const whRows = await db.prepare(`SELECT code, name, include_stocktake, sort_order FROM erp_warehouse WHERE ${ICP} = ?`).all(icpno);
    const cntRows = await db.prepare(`SELECT wh_code AS code, COUNT(*) AS cnt FROM erp_stock_items WHERE wh_code IS NOT NULL AND TRIM(wh_code) <> '' AND ${ICP} = ? GROUP BY wh_code`).all(icpno);
    const cnt = {}; (cntRows || []).forEach((r) => { cnt[String(r.code)] = Number(r.cnt || 0); });
    const doneRows = await db.prepare(`SELECT DISTINCT wh_code FROM stocktake_session WHERE count_date = ? AND status = 'submitted' AND ${ICP} = ?`).all(date, icpno);
    const done = {}; (doneRows || []).forEach((r) => { done[String(r.wh_code)] = true; });
    let list;
    if ((whRows || []).length) {
        list = whRows.filter((w) => Number(w.include_stocktake) === 1).map((w) => ({ code: String(w.code), name: String(w.name || ""), sort: Number(w.sort_order || 0), items: cnt[String(w.code)] || 0, countedToday: !!done[String(w.code)] }));
    } else {
        list = Object.keys(cnt).map((code) => ({ code, name: "", sort: 0, items: cnt[code], countedToday: !!done[code] }));
    }
    list.sort((a, b) => (a.sort - b.sort) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    return { date, warehouses: list };
}

/**
 * minimal=true（掃碼頁）：不查效期品/照片/必盤，items 帶 exp:false/eunit:""，回應無 sysQtySource。
 * minimal=false（盤點頁/網頁版）：完整欄位。saved 兩種模式都完整帶回 counted/mid/expiry——
 * submit 是整場覆蓋，缺一樣就會把別的入口寫的資料洗掉。
 */
async function getStocktakeItems(db, { icpno, whCode, minimal }) {
    const wh = await db.prepare(`SELECT code, name FROM erp_warehouse WHERE code = ? AND ${ICP} = ?`).get(whCode, icpno);
    const rows = await db.prepare(`SELECT erp_code, name, spec, unit, qty FROM erp_stock_items WHERE wh_code = ? AND ${ICP} = ? ORDER BY erp_code`).all(whCode, icpno);
    // 分倉庫存優先：該倉有任何 000009 分倉列 → sys 用分倉量（無列＝0）；整倉無 → 公司總量
    let whQtyMap = null;
    try {
        const wq = await db.prepare(`SELECT erp_code, qty FROM erp_stock_wh_qty WHERE wh_code = ? AND ${ICP} = ?`).all(whCode, icpno);
        if ((wq || []).length) { whQtyMap = {}; for (const r of wq) whQtyMap[String(r.erp_code || "")] = Number(r.qty || 0); }
    } catch (_) { whQtyMap = null; /* 查詢失敗 → 沿用總量基準，不擋盤點 */ }
    const sysQtySource = whQtyMap ? "warehouse" : "total";
    let exp = {};
    if (!minimal) {
        const expRows = await db.prepare(`SELECT erp_code, expiry_unit FROM stocktake_expiry_item WHERE ${ICP} = ?`).all(icpno);
        (expRows || []).forEach((r) => { exp[String(r.erp_code)] = String(r.expiry_unit || ""); });
    }
    const photoSet = new Set();
    if (!minimal) {
        try { (await db.prepare("SELECT erp_code FROM erp_stock_item_photo").all() || []).forEach((r) => photoSet.add(String(r.erp_code || ""))); } catch (_) { /* 照片表缺失不擋盤點 */ }
    }
    const items = (rows || []).map((r) => {
        const c = String(r.erp_code || "");
        const isExp = !minimal && Object.prototype.hasOwnProperty.call(exp, c);
        const sysv = whQtyMap ? Number(whQtyMap[c] || 0) : Number(r.qty || 0);
        const it = { c, n: String(r.name || ""), s: String(r.spec || ""), u: String(r.unit || ""), sys: sysv, exp: isExp, eunit: isExp ? (exp[c] || String(r.unit || "")) : "" };
        if (!minimal && photoSet.has(c)) it.hp = 1;
        return it;
    });
    const date = stkTaipeiDate();
    // 續盤：同(公司,倉,日)已送出過 → 帶回已存實盤/中貨/效期（submit 整場覆蓋，缺一樣就洗掉別入口的資料）
    const saved = {}; let resumed = false; let submittedAt = null;
    const sess = await db.prepare(`SELECT id, submitted_at FROM stocktake_session WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?`).get(whCode, date, icpno);
    if (sess) {
        const cRows = await db.prepare("SELECT erp_code, counted_qty, mid_qty, expiry_json FROM stocktake_count WHERE session_id = ?").all(sess.id);
        for (const r of cRows || []) {
            let expiry = [];
            try { const p = JSON.parse(String(r.expiry_json || "[]")); if (Array.isArray(p)) expiry = p; } catch (_) { expiry = []; }
            const totalv = (r.counted_qty == null || r.counted_qty === "") ? null : Number(r.counted_qty);
            const midv = (r.mid_qty == null || r.mid_qty === "") ? null : Number(r.mid_qty);
            // counted_qty 存「上+中合計」；還原「上貨」＝合計−中貨
            const goodv = totalv == null ? null : Math.round((totalv - (midv || 0)) * 100) / 100;
            saved[String(r.erp_code || "")] = { counted: goodv, mid: midv, expiry };
        }
        resumed = (cRows || []).length > 0;
        submittedAt = sess.submitted_at != null && sess.submitted_at !== "" ? String(sess.submitted_at) : null;
    }
    if (!minimal) {
        // 必盤：自昨天（或上次盤點）以來凌越有變動的品項；失敗吞錯不擋盤點
        try { const mc = await (0, stock_mustcount_js_1.computeMustCount)(db, { icpno, whCode, today: date }); items.forEach((it) => { if (mc.set.has(it.c)) it.mc = 1; }); } catch (_) { }
    }
    const out = { date, warehouse: { code: whCode, name: wh ? String(wh.name || "") : "" }, items, saved, resumed, submittedAt };
    if (!minimal) out.sysQtySource = sysQtySource;
    return out;
}

function isUniqueConflict(e) {
    const cs = String((e && e.code) || "");
    if (cs === "23505" || cs.indexOf("SQLITE_CONSTRAINT") === 0) return true;
    return /UNIQUE constraint failed/i.test(String((e && e.message) || ""));
}

async function submitStocktake(db, { icpno, whCode, date: dateRaw, counts, createdBy, createdByName, baseSubmittedAt: baseRaw }) {
    if (!whCode || !Array.isArray(counts)) throw StkApiError(400, "缺少 warehouse 或 counts");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateRaw || "")) ? String(dateRaw) : stkTaipeiDate();
    // 日期限制：只允許台北時區「今日或昨日」，不得覆寫任意歷史日
    const today = stkTaipeiDate();
    const yesterday = stkTaipeiDate(new Date(Date.now() - 86400000));
    if (date !== today && date !== yesterday) {
        throw StkApiError(400, "盤點日期僅限今日或昨日（" + yesterday + " ～ " + today + "）");
    }
    const wh = await db.prepare(`SELECT name FROM erp_warehouse WHERE code = ? AND ${ICP} = ?`).get(whCode, icpno);
    const totalRow = await db.prepare(`SELECT COUNT(*) AS n FROM erp_stock_items WHERE wh_code = ? AND ${ICP} = ?`).get(whCode, icpno);
    const total = totalRow ? Number(totalRow.n || 0) : counts.length;
    const now = new Date().toISOString();
    // 樂觀鎖：比對「開頁時的 submitted_at」與目前 DB 值，不一致＝開頁後已有他人送出 → 409
    const curSess = await db.prepare(`SELECT submitted_at FROM stocktake_session WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?`).get(whCode, date, icpno);
    const baseSubmittedAt = (baseRaw == null || baseRaw === "") ? null : String(baseRaw);
    const curSubmittedAt = (curSess && curSess.submitted_at != null && curSess.submitted_at !== "") ? String(curSess.submitted_at) : null;
    if (curSubmittedAt !== baseSubmittedAt) {
        throw StkApiError(409, "開頁後已有他人送出此倉盤點，請重載後續盤再送出", "conflict_stale");
    }
    // [fix 2026-07-19] 數量伺服器端驗證：前端（stocktake.html/scan.html）雖已擋，但伺服器不得信任前端
    // ——入口不只一個（LIFF 盤點頁／網頁版／掃碼 /scan/submit），任一前端有 bug 或直接打 API，壞值會靜默進帳。
    // 舊版只 Number()：非數字 →NaN→「NaN||0」靜默變 0（實盤被記成 0＝憑空盤差/誤判短少），負數也照收。
    // null/空白＝未盤，允許；一旦有值必須是有限數且 >= 0。任一非法整筆拒絕（不半套寫入、不讓 NaN 變 0）。
    const qtyErrors = [];
    for (const c of counts) {
        const nm = String((c && (c.name || c.code)) || "").trim() || "(未命名品項)";
        for (const [field, label] of [["counted", "實盤"], ["mid", "中貨"]]) {
            const raw = c ? c[field] : null;
            if (raw == null || raw === "") continue;
            const n = Number(raw);
            if (!Number.isFinite(n)) { qtyErrors.push("「" + nm + "」" + label + "數量「" + raw + "」不是有效數字"); }
            else if (n < 0) { qtyErrors.push("「" + nm + "」" + label + "數量不可為負數（" + raw + "）"); }
        }
        // sys（凍結系統量）也不得信任前端：NaN 會寫進 sys_qty（所有盤差/統計/必盤退回的基準）。
        // 負數合法（凌越負庫存正常），只擋非數字。
        const sysRaw = c ? c.sys : null;
        if (sysRaw != null && sysRaw !== "" && !Number.isFinite(Number(sysRaw))) {
            qtyErrors.push("「" + nm + "」系統量「" + sysRaw + "」不是有效數字（請重新載入頁面取得正確系統量）");
        }
    }
    if (qtyErrors.length) {
        const shown = qtyErrors.slice(0, 3).join("；");
        const more = qtyErrors.length > 3 ? "（另有 " + (qtyErrors.length - 3) + " 項）" : "";
        throw StkApiError(400, "盤點數量格式錯誤：" + shown + more + "。請改成 0 或正數後再送出。", "bad_qty");
    }
    // 交易外先把所有列算好；交易內只做純寫入（sqlite transaction 限制：fn 內不得 await 外部 I/O）
    const sid = newId("stk");
    const countRows = counts.map((c) => {
        // counted=上貨(good)、mid=中貨；counted_qty 存兩者合計，mid_qty 單獨保留
        const good = (c.counted == null || c.counted === "") ? null : Number(c.counted);
        const mid = (c.mid == null || c.mid === "") ? null : Number(c.mid);
        const cv = (good == null && mid == null) ? null : ((good || 0) + (mid || 0));
        return [newId("stc"), sid, String(c.code || ""), String(c.name || ""), String(c.spec || ""), String(c.unit || ""), Number(c.sys || 0), cv, mid, JSON.stringify(c.expiry || []), now];
    });
    try {
        const doWrite = async (tx) => {
            // 多實例併發防護（PG only）：同(公司,倉,日)的送出完全串行化——advisory xact lock
            // 讓下面的交易內樂觀鎖重查在 READ COMMITTED 下也不再有殘餘視窗（交易結束自動釋放）。
            // SQLite 單連線天然序列化，毋須加鎖。
            if (process.env.DATABASE_URL)
                await tx.prepare("SELECT pg_advisory_xact_lock(hashtext(?))").get("stk|" + icpno + "|" + whCode + "|" + date);
            // 樂觀鎖在交易內重查一次（交易外的預檢只是快速失敗）：
            // 否則 A 在「B 通過預檢之後、B 的 DELETE 之前」commit，B 會把 A 剛寫入的
            // session 整場刪掉重插——唯一索引救不了（列已被 B 刪除），A 的盤點靜默遺失。
            const curInTx = await tx.prepare(`SELECT submitted_at FROM stocktake_session WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?`).get(whCode, date, icpno);
            const curAtInTx = (curInTx && curInTx.submitted_at != null && curInTx.submitted_at !== "") ? String(curInTx.submitted_at) : null;
            if (curAtInTx !== baseSubmittedAt) {
                throw StkApiError(409, "開頁後已有他人送出此倉盤點，請重載後續盤再送出", "conflict_stale");
            }
            await tx.prepare(`DELETE FROM stocktake_count WHERE session_id IN (SELECT id FROM stocktake_session WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?)`).run(whCode, date, icpno);
            await tx.prepare(`DELETE FROM stocktake_session WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?`).run(whCode, date, icpno);
            await tx.prepare("INSERT INTO stocktake_session (id, wh_code, wh_name, count_date, status, group_id, created_by, created_by_name, item_count, counted_count, created_at, submitted_at, icpno) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(sid, whCode, wh ? String(wh.name || "") : "", date, "submitted", null, createdBy || "", String(createdByName || "").trim(), total, counts.length, now, now, icpno);
            const BATCH = 50; // 11 欄 × 50 = 550 個佔位符，pg 轉 $n 沒問題
            for (let i = 0; i < countRows.length; i += BATCH) {
                const chunk = countRows.slice(i, i + BATCH);
                const ph = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
                const params = [];
                for (const row of chunk) params.push(...row);
                await tx.prepare("INSERT INTO stocktake_count (id, session_id, erp_code, name, spec, unit, sys_qty, counted_qty, mid_qty, expiry_json, updated_at) VALUES " + ph).run(...params);
            }
        };
        if (typeof db.transaction === "function") await db.transaction(doWrite);
        else await doWrite(db);
    } catch (e) {
        // 唯一索引（(icpno,倉,日)）衝突＝兩人幾乎同時送出（都通過樂觀鎖檢查），後到者擋下
        if (isUniqueConflict(e)) throw StkApiError(409, "此倉今日盤點已被其他人送出，請重新載入", "conflict_taken");
        throw e;
    }
    return { ok: true, counted: counts.length, total };
}
