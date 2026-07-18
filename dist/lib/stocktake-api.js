"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StkApiError = StkApiError;
exports.stkTaipeiDate = stkTaipeiDate;
exports.listStocktakeWarehouses = listStocktakeWarehouses;
exports.getStocktakeItems = getStocktakeItems;
exports.submitStocktake = submitStocktake;
exports.syncStocktakeDraft = syncStocktakeDraft;
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

// [2026-07-17] 盤點「進行中」鎖的存活時間：心跳（前端約 40 秒一次）超過此時間未續租＝棄鎖，
// 他人可直接接手。夠長容忍網路不穩/切 App，夠短不會把倉庫卡死。
const STK_LOCK_TTL_MS = 3 * 60 * 1000;

/**
 * [2026-07-17] 盤點鎖＋草稿雲端備援（stocktake_draft，一倉一日一筆）。單一端點三用途：
 * - 進倉認領（payload 不帶）：搶到鎖回 { ok, draft: 伺服器既有草稿 }；被別台裝置持有且未逾時
 *   → { locked: true, by, lastSeenAt }（force=true 可強制接手）。
 * - 心跳＋草稿上傳（payload 帶物件）：續租並覆蓋伺服器草稿；鎖被接手 → { locked: true, by }。
 * - release=true：離開時釋放（只刪自己裝置持有的列；草稿一併移除——localStorage 仍有一份）。
 * 認領為原子操作：INSERT ON CONFLICT DO NOTHING 搶新列；已有列時用條件式 UPDATE
 * （自己的裝置／空鎖／逾時／force 才搶得到），與凌越回寫 /wait 的租約同一套路。
 */
async function syncStocktakeDraft(db, { icpno, whCode, date: dateRaw, deviceId, name, payload, force, release }) {
    whCode = String(whCode || "").trim();
    const dev = String(deviceId || "").trim();
    if (!whCode || !dev) throw StkApiError(400, "缺少 warehouse 或 deviceId");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateRaw || "")) ? String(dateRaw) : stkTaipeiDate();
    const now = new Date().toISOString();
    const holderName = String(name || "").trim().slice(0, 60);
    if (release) {
        // 釋放鎖但保留（可順帶更新）payload：離開的人的未送出草稿留在雲端，
        // 下一位（或本人換裝置）認領時帶回續盤。整列 DELETE 只發生在 submit 成功（盤點定案）時。
        const relPayload = (payload === undefined || payload === null) ? null : JSON.stringify(payload).slice(0, 500000);
        await db.prepare(`UPDATE stocktake_draft SET device_id = '', payload = COALESCE(?, payload), last_seen_at = NULL, updated_at = ? WHERE wh_code = ? AND count_date = ? AND ${ICP} = ? AND device_id = ?`).run(relPayload, now, whCode, date, icpno, dev);
        return { ok: true, released: true };
    }
    // 順手清掉「昨日之前」的舊草稿（盤點日期僅限今/昨，更舊的必為殘留）
    try { await db.prepare("DELETE FROM stocktake_draft WHERE count_date < ?").run(stkTaipeiDate(new Date(Date.now() - 86400000))); } catch (_) { }
    const staleBefore = new Date(Date.now() - STK_LOCK_TTL_MS).toISOString();
    const payloadStr = (payload === undefined || payload === null) ? null : JSON.stringify(payload).slice(0, 500000);
    let claimed = false;
    try {
        const r = await db.prepare("INSERT INTO stocktake_draft (icpno, wh_code, count_date, device_id, holder_name, payload, started_at, last_seen_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (icpno, wh_code, count_date) DO NOTHING")
            .run(icpno, whCode, date, dev, holderName, payloadStr, now, now, now);
        claimed = ((r && r.changes) || 0) > 0;
    } catch (_) { /* 罕見撞列（非正規化舊列）→ 走下方 UPDATE 認領 */ }
    if (!claimed) {
        // payload 用 COALESCE：心跳帶草稿就覆蓋，進倉認領（不帶）保留既有草稿供帶回
        const r2 = await db.prepare(`UPDATE stocktake_draft SET device_id = ?, holder_name = ?, payload = COALESCE(?, payload), last_seen_at = ?, updated_at = ? WHERE wh_code = ? AND count_date = ? AND ${ICP} = ? AND (device_id = ? OR device_id IS NULL OR device_id = '' OR COALESCE(last_seen_at, '') < ? OR ? = 1)`)
            .run(dev, holderName, payloadStr, now, now, whCode, date, icpno, dev, staleBefore, force ? 1 : 0);
        claimed = ((r2 && r2.changes) || 0) > 0;
    }
    if (!claimed) {
        const cur = await db.prepare(`SELECT holder_name, last_seen_at FROM stocktake_draft WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?`).get(whCode, date, icpno);
        return { locked: true, by: cur ? String(cur.holder_name || "") : "", lastSeenAt: cur ? (cur.last_seen_at || null) : null };
    }
    if (payloadStr != null) return { ok: true };
    // 進倉認領：帶回伺服器既有草稿（同一人換裝置/清快取後可接回未送出的內容）
    let draft = null;
    try {
        const row = await db.prepare(`SELECT payload FROM stocktake_draft WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?`).get(whCode, date, icpno);
        if (row && row.payload) { const p = JSON.parse(String(row.payload)); if (p && typeof p === "object") draft = p; }
    } catch (_) { draft = null; }
    return { ok: true, draft };
}

async function listStocktakeWarehouses(db, { icpno }) {
    const date = stkTaipeiDate();
    const whRows = await db.prepare(`SELECT code, name, include_stocktake, sort_order FROM erp_warehouse WHERE ${ICP} = ?`).all(icpno);
    const cntRows = await db.prepare(`SELECT wh_code AS code, COUNT(*) AS cnt FROM erp_stock_items WHERE wh_code IS NOT NULL AND TRIM(wh_code) <> '' AND ${ICP} = ? GROUP BY wh_code`).all(icpno);
    const cnt = {}; (cntRows || []).forEach((r) => { cnt[String(r.code)] = Number(r.cnt || 0); });
    const doneRows = await db.prepare(`SELECT DISTINCT wh_code FROM stocktake_session WHERE count_date = ? AND status = 'submitted' AND ${ICP} = ?`).all(date, icpno);
    const done = {}; (doneRows || []).forEach((r) => { done[String(r.wh_code)] = true; });
    // [2026-07-17] 各倉「進行中」鎖（未逾時）：倉庫清單顯示「盤點中·誰」，他人進倉會被擋
    const locks = {};
    try {
        const staleBefore = new Date(Date.now() - STK_LOCK_TTL_MS).toISOString();
        (await db.prepare(`SELECT wh_code, holder_name FROM stocktake_draft WHERE count_date = ? AND ${ICP} = ? AND device_id IS NOT NULL AND device_id <> '' AND COALESCE(last_seen_at, '') >= ?`).all(date, icpno, staleBefore) || [])
            .forEach((r) => { locks[String(r.wh_code)] = String(r.holder_name || ""); });
    } catch (_) { /* 鎖表缺失不擋清單 */ }
    let list;
    if ((whRows || []).length) {
        list = whRows.filter((w) => Number(w.include_stocktake) === 1).map((w) => ({ code: String(w.code), name: String(w.name || ""), sort: Number(w.sort_order || 0), items: cnt[String(w.code)] || 0, countedToday: !!done[String(w.code)], ...(locks[String(w.code)] !== undefined ? { counting: locks[String(w.code)] } : {}) }));
    } else {
        list = Object.keys(cnt).map((code) => ({ code, name: "", sort: 0, items: cnt[code], countedToday: !!done[code], ...(locks[code] !== undefined ? { counting: locks[code] } : {}) }));
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

async function submitStocktake(db, { icpno, whCode, date: dateRaw, counts, createdBy, createdByName, baseSubmittedAt: baseRaw, deviceId }) {
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
    // [2026-07-17] 盤點鎖：他台裝置正持有此倉未逾時的鎖（如被強制接手）→ 擋下送出，
    // 避免被接手者按下送出把接手者盤到一半的內容覆蓋。舊客戶端不帶 deviceId 則略過（相容）。
    const dev = String(deviceId || "").trim();
    if (dev) {
        try {
            const lockRow = await db.prepare(`SELECT device_id, holder_name, last_seen_at FROM stocktake_draft WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?`).get(whCode, date, icpno);
            if (lockRow && lockRow.device_id && String(lockRow.device_id) !== dev && String(lockRow.last_seen_at || "") >= new Date(Date.now() - STK_LOCK_TTL_MS).toISOString()) {
                throw StkApiError(409, `「${String(lockRow.holder_name || "另一位使用者")}」正在盤點此倉（可能已接手），請重載確認後再送出`, "locked");
            }
        } catch (e) { if (e && e.name === "StkApiError") throw e; /* 鎖表缺失不擋送出 */ }
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
            // 樂觀鎖必須在交易內再比對一次：交易外那次檢查通過後、交易開始前的窗口內，
            // 他人可能已 commit——若只靠交易外檢查，這裡的 DELETE 會把對方剛送出的整場盤點
            // 刪掉重寫且不報 409（唯一索引兜不住已被刪的列）。
            const txSess = await tx.prepare(`SELECT submitted_at FROM stocktake_session WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?`).get(whCode, date, icpno);
            const txSubmittedAt = (txSess && txSess.submitted_at != null && txSess.submitted_at !== "") ? String(txSess.submitted_at) : null;
            if (txSubmittedAt !== baseSubmittedAt) {
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
            // [2026-07-17] 送出成功＝此倉此日盤點定案：同交易清掉「進行中」鎖與雲端草稿
            //（他人之後進倉會由 saved 帶回剛送出的值續盤，不再需要草稿；
            //  交易內不 try/catch——PG 25P02 毒化規則，失敗就讓整批 ROLLBACK）
            await tx.prepare(`DELETE FROM stocktake_draft WHERE wh_code = ? AND count_date = ? AND ${ICP} = ?`).run(whCode, date, icpno);
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
