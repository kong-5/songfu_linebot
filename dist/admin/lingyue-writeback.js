"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLingyueWritebackRoutes = registerLingyueWritebackRoutes;

// 凌越整合代理的機器端點（非後台頁面；以 X-Writeback-Key 認證，供內網 ly_agent_gui.py 長連線輪詢）：
//   訂單回寫 /pending·/wait·/callback、庫存推送 /inventory-push·/inventory-wait·/inventory-report、
//   收款匯入 /cash-ingest·/cash-refresh-wait·/cash-refresh-report、進銷交易 /txn-wait·/txn-callback
// 自 index.js 拆出（拆檔批次 8），純搬移、行為不變。
// 註：buildLingyuePreview / formatOrderDateForLingyue 由訂單域共用，留 index.js 經 ctx 傳入。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const ops_notify_js_1 = require("../lib/ops-notify.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerLingyueWritebackRoutes(router, ctx) {
    const { db, notionPage, logDataChange, buildLingyuePreview, formatOrderDateForLingyue, stkAdminTaipeiDate, getTaipeiCalendarDateYYYYMMDD } = ctx;
    router.get("/lingyue-writeback/pending", async (req, res) => {
        try {
            const dateParam = (typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date.trim()))
                ? req.query.date.trim()
                : getTaipeiCalendarDateYYYYMMDD();
            const scopeAll = String(req.query.scope || "") === "all";
            const orderRows = await db.prepare(`
        SELECT o.id, o.order_no, o.order_date, o.remark, c.name AS customer_name, c.hq_cust_code, c.teraoka_code
        FROM orders o JOIN customers c ON c.id = o.customer_id
        WHERE o.order_date = ?
          AND COALESCE(LOWER(TRIM(o.status)), '') NOT IN ('deleted', 'complaint')
          AND o.lingyue_written_at IS NULL
          ${scopeAll ? "" : "AND o.lingyue_queued_at IS NOT NULL"}
        ORDER BY o.order_date ASC, o.order_no ASC, o.id ASC
      `).all(dateParam);
            const orders = [];
            for (const order of orderRows || []) {
                const customerCode = (order.hq_cust_code && String(order.hq_cust_code).trim())
                    || (order.teraoka_code && String(order.teraoka_code).trim()) || "";
                const itemRows = await db.prepare(`
        SELECT oi.quantity, oi.unit, oi.remark, oi.raw_name, p.erp_code, p.name AS product_name
        FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ? AND (oi.include_export IS NULL OR oi.include_export = 1)
          AND oi.voided_at IS NULL
        ORDER BY COALESCE(oi.display_order, 999999), oi.id
      `).all(order.id);
                const items = (itemRows || []).map((it) => {
                    const qtyNum = it.quantity != null ? Number(it.quantity) : NaN;
                    return {
                        product_code: (it.erp_code && String(it.erp_code).trim()) || "",
                        product_name: (it.product_name && String(it.product_name).trim())
                            || (it.raw_name && String(it.raw_name).trim()) || "",
                        unit: (it.unit && String(it.unit).trim()) || "公斤",
                        quantity: Number.isFinite(qtyNum) ? qtyNum : null,
                        item_note: (it.remark && String(it.remark).trim()) || "",
                    };
                });
                if (!items.length)
                    continue;
                orders.push({
                    order_id: order.id,
                    order_no: order.order_no || null,
                    order_date: formatOrderDateForLingyue(order.order_date),
                    customer_code: customerCode,
                    customer_name: order.customer_name || "",
                    doc_remark: (order.remark && String(order.remark).trim()) || "",
                    items,
                });
            }
            res.json({ date: dateParam, scope: scopeAll ? "all" : "queued", count: orders.length, orders });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/pending", e?.message || e);
            res.status(500).json({ error: "pending 取得失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * GET /admin/lingyue-writeback/wait?timeout=25
     *   長連線等待（long-poll）：內網 agent 掛一條線等待「使用者已在網站點『轉入凌越』」的排隊訂單。
     *   有排隊單（lingyue_queued_at 非空且尚未回寫）立刻回傳；否則 hold 到 timeout 秒（預設 25、上限 50）才回空。
     *   agent 拿到後寫入凌越，再用 callback 回填單號（回填後 lingyue_written_at 非空，即退出佇列）。
     */
    router.get("/lingyue-writeback/wait", async (req, res) => {
        let timeoutSec = parseInt(String(req.query.timeout || "25"), 10);
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0)
            timeoutSec = 25;
        if (timeoutSec > 50)
            timeoutSec = 50;
        const deadline = Date.now() + timeoutSec * 1000;
        // [fix 2026-07-08] 認領租約：過去 /wait 對「已排隊未回寫」的單無條件回傳，
        // 多個 agent 或 agent 重啟同時 /wait 會拿到同一批單 → 各自寫入凌越 → 重複開單。
        // 改成每張單先用條件式 UPDATE 蓋 claimed_at 認領；只有 changes=1（本次真的搶到）才回傳。
        // 租約期間其他 /wait 不會再撿到同一張；agent 若掛掉沒回填，租約到期後自動重新可撿（自帶重試）。
        // [fix 2026-07-10] 租約 90 秒 → 10 分鐘：一批單最壞寫入時間（凌越 SOAP 逐張寫＋逐張查倉別）
        // 遠超 90 秒，租約先過期＝別條 /wait 重撿同單＝重複開單。10 分鐘涵蓋最壞批次＋回報時間。
        // 同時單批上限 20 → 5（下方 SQL LIMIT）：縮短「已寫入凌越、尚未回填」的風險窗口。
        const LEASE_MS = 600000;
        try {
            // [ops 2026-07-10] 心跳：記錄內網代理最後一次連上 /wait 的時間（後台庫存頁顯示「內網代理最後連線」）。
            try {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("ly_agent_last_wait_at", new Date().toISOString());
            }
            catch (_) { /* 心跳寫入失敗不影響主流程 */ }
            while (true) {
                const claimBefore = new Date(Date.now() - LEASE_MS).toISOString();
                const rows = await db.prepare(`
          SELECT o.id, o.order_no, o.order_date, o.remark, o.lingyue_queued_at, c.name AS customer_name, c.hq_cust_code, c.teraoka_code
          FROM orders o JOIN customers c ON c.id = o.customer_id
          WHERE o.lingyue_queued_at IS NOT NULL
            AND o.lingyue_written_at IS NULL
            AND COALESCE(LOWER(TRIM(o.status)), '') NOT IN ('deleted', 'complaint')
            AND (o.lingyue_claimed_at IS NULL OR o.lingyue_claimed_at < ?)
          ORDER BY o.lingyue_queued_at ASC, o.id ASC
          LIMIT 5
        `).all(claimBefore);
                if (rows && rows.length) {
                    const orders = [];
                    for (const order of rows) {
                        // 條件式認領：單一 UPDATE 語句在 pg/sqlite 皆為原子，兩個並發只會有一個 changes=1。
                        const nowIso = new Date().toISOString();
                        const claim = await db.prepare(
                            "UPDATE orders SET lingyue_claimed_at = ? WHERE id = ? AND lingyue_written_at IS NULL AND (lingyue_claimed_at IS NULL OR lingyue_claimed_at < ?)"
                        ).run(nowIso, order.id, claimBefore);
                        if (!claim || Number(claim.changes || 0) !== 1)
                            continue; // 已被別的 agent 認領
                        const preview = await buildLingyuePreview(order);
                        if (preview.items.length) {
                            preview.queued_at = order.lingyue_queued_at ? String(order.lingyue_queued_at) : "";
                            orders.push(preview);
                        }
                        else {
                            // 無可轉品項（全作廢等）：釋放認領，避免佔住租約
                            await db.prepare("UPDATE orders SET lingyue_claimed_at = NULL WHERE id = ?").run(order.id);
                        }
                    }
                    if (orders.length) {
                        res.json({ count: orders.length, orders });
                        return;
                    }
                }
                if (Date.now() >= deadline) {
                    res.json({ count: 0, orders: [] });
                    return;
                }
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/wait", e?.message || e);
            res.status(500).json({ error: "wait 失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * POST /admin/lingyue-writeback/callback
     *   body: { "results": [ { "order_id": "...", "doc_no": "凌越單據號", "ok": true, "error": "" }, ... ] }
     *   把凌越寫入後回傳的單據號回填到 orders.lingyue_doc_no，並記錄 lingyue_written_at。
     *   ok=false 或缺 doc_no 的項目視為失敗，不標記為已回寫（會在下次 pending 再次出現）。
     */
    router.post("/lingyue-writeback/callback", express_1.default.json({ limit: "2mb" }), async (req, res) => {
        try {
            const results = Array.isArray(req.body?.results) ? req.body.results : null;
            if (!results) {
                res.status(400).json({ error: "缺少 results 陣列" });
                return;
            }
            const now = new Date().toISOString();
            const updated = [];
            const failed = [];
            for (const r of results) {
                const orderId = String(r?.order_id || "").trim();
                const docNo = r?.doc_no != null ? String(r.doc_no).trim() : "";
                const ok = r?.ok !== false;
                if (!orderId) {
                    failed.push({ order_id: r?.order_id ?? null, reason: "缺少 order_id" });
                    continue;
                }
                if (!ok || !docNo) {
                    // [fix 2026-07-08] 失敗出口：記錄錯誤。permanent（如缺料號）或累計 >=3 次即移出佇列（清 queued/claimed），
                    // 否則保留佇列讓租約到期後自動重試（不清 claimed_at＝維持租約節流，不狂重試）。
                    const errMsg = (r?.error ? String(r.error) : "寫入未成功或缺少 doc_no").slice(0, 500);
                    const permanent = r?.permanent === true;
                    try {
                        const cur = await db.prepare("SELECT COALESCE(lingyue_write_attempts, 0) AS n, order_no FROM orders WHERE id = ?").get(orderId);
                        const n = (cur?.n || 0) + 1;
                        if (permanent || n >= 3) {
                            await db.prepare("UPDATE orders SET lingyue_write_attempts = ?, lingyue_last_error = ?, lingyue_queued_at = NULL, lingyue_claimed_at = NULL WHERE id = ?").run(n, errMsg, orderId);
                            // [ops 2026-07-10] 三振出局（或永久失敗）＝移出佇列後不會再自動重試，推播告警提醒人工處理。
                            ops_notify_js_1.notifyOps(db, `凌越回寫失敗已移出佇列（${permanent ? "永久錯誤" : `已重試 ${n} 次`}）：訂單 ${cur?.order_no || orderId}，錯誤：${errMsg.slice(0, 200)}`).catch(() => { });
                        }
                        else {
                            await db.prepare("UPDATE orders SET lingyue_write_attempts = ?, lingyue_last_error = ? WHERE id = ?").run(n, errMsg, orderId);
                        }
                    }
                    catch (_) { /* 記錄失敗不影響其他項回填 */ }
                    failed.push({ order_id: orderId, reason: errMsg, permanent, exited_queue: permanent });
                    continue;
                }
                try {
                    // [fix 2026-07-10] 冪等防護：agent 可能因 callback 失敗而重送（journal 重播）。
                    //  - 已有相同 doc_no → 視為冪等成功，不再覆寫（保留原 written_at）。
                    //  - 已有「不同」doc_no → 衝突（可能重複開單）：不覆蓋，記 lingyue_last_error ＋推播告警，人工到凌越核對。
                    const cur = await db.prepare("SELECT lingyue_doc_no, order_no FROM orders WHERE id = ?").get(orderId);
                    if (!cur) {
                        failed.push({ order_id: orderId, reason: "查無此訂單" });
                        continue;
                    }
                    const existing = cur.lingyue_doc_no != null ? String(cur.lingyue_doc_no).trim() : "";
                    if (existing && existing === docNo) {
                        updated.push({ order_id: orderId, doc_no: docNo, idempotent: true });
                        continue;
                    }
                    if (existing && existing !== docNo) {
                        const conflictMsg = `凌越單號衝突：後台已記 ${existing}，agent 又回報 ${docNo}（未覆蓋）。可能重複開單，請到凌越核對並刪除多餘的單。`;
                        console.error("[admin] lingyue-writeback/callback 單號衝突", orderId, "existing=", existing, "incoming=", docNo);
                        await db.prepare("UPDATE orders SET lingyue_last_error = ? WHERE id = ?").run(conflictMsg.slice(0, 500), orderId);
                        ops_notify_js_1.notifyOps(db, `訂單 ${cur.order_no || orderId} ${conflictMsg}`).catch(() => { });
                        failed.push({ order_id: orderId, reason: conflictMsg, conflict: true });
                        continue;
                    }
                    // 成功：回填單號＋時間，並清掉失敗計數/錯誤與認領。
                    const ret = await db.prepare("UPDATE orders SET lingyue_doc_no = ?, lingyue_written_at = ?, lingyue_last_error = NULL, lingyue_write_attempts = 0, lingyue_claimed_at = NULL WHERE id = ?").run(docNo, now, orderId);
                    if (ret && (ret.changes === 0)) {
                        failed.push({ order_id: orderId, reason: "查無此訂單" });
                        continue;
                    }
                    updated.push({ order_id: orderId, doc_no: docNo });
                }
                catch (e) {
                    failed.push({ order_id: orderId, reason: String(e?.message || e) });
                }
            }
            res.json({ updated_count: updated.length, failed_count: failed.length, updated, failed });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/callback", e?.message || e);
            res.status(500).json({ error: "callback 失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * 目前庫存快照 — 機器對機器端點（內網 agent 用，X-Writeback-Key 認證）。
     *
     * POST /admin/lingyue-writeback/inventory-push
     *   body: { icpno, snapshot_at, items: [{ code, name, spec, unit, qty, wh_code }, ...] }
     *   內網 agent 用 ly_query_stock.py --all 撈整張貨品主檔的 SK_NOWQTY，整批推上來 → 全表覆蓋。
     */
    router.post("/lingyue-writeback/inventory-push", express_1.default.json({ limit: "16mb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const items = Array.isArray(body.items) ? body.items : null;
            if (!items) {
                res.status(400).json({ error: "缺少 items 陣列" });
                return;
            }
            const icpno = String(body.icpno || "00").trim() || "00";
            // 守門：只收兩位數公司代碼。內網 GUI 的 first_icpno() 理應擋掉 "all"/"00,02"，
            // 但伺服器端也要有防線——一旦以 icpno='all' 落庫，按公司查詢全看不到、
            // 不帶過濾的讀取又會與 '00' 真資料互相污染。
            if (!/^\d{2}$/.test(icpno)) {
                res.status(400).json({ error: `icpno 格式錯誤：收到 "${icpno}"，此端點只接受單一兩位數公司代碼（如 00/02）。請檢查內網代理 LY_ICPNO 設定——多公司請由代理逐家推送，不要把 "all" 或逗號清單傳進來。` });
                return;
            }
            const snapshotAt = (typeof body.snapshot_at === "string" && body.snapshot_at.trim())
                ? body.snapshot_at.trim() : new Date().toISOString();
            const rows = [];
            for (const it of items) {
                const code = String(it?.code ?? it?.erp_code ?? "").trim();
                if (!code)
                    continue;
                const qtyNum = Number(it?.qty);
                rows.push([
                    code,
                    String(it?.name ?? "").trim(),
                    String(it?.spec ?? "").trim(),
                    String(it?.unit ?? "").trim(),
                    Number.isFinite(qtyNum) ? qtyNum : 0,
                    String(it?.wh_code ?? "").trim(),
                    icpno,
                    snapshotAt,
                ]);
            }
            // [分倉庫存 2026-07-10] 頂層 warehouse_qty（來自 ly_stock_push.py 查 000009）：
            // 「欄位存在且為陣列」＝本批有分倉資料 → 同一交易內全表覆蓋 erp_stock_wh_qty；
            // 欄位不存在（內網查 000009 失敗/無資料時保證完全不帶）→ 完全不動該表，保留上一份分倉快照。
            // 用 Map 以 (erp_code, wh_code) 去重（後者蓋前者），避免 payload 重複列撞 PK。
            const hasWhQty = Array.isArray(body.warehouse_qty);
            let whRows = null;
            if (hasWhQty) {
                const whMap = new Map();
                for (const w of body.warehouse_qty) {
                    const c = String(w?.erp_code ?? "").trim();
                    const wc = String(w?.wh_code ?? "").trim();
                    if (!c || !wc)
                        continue;
                    const q = Number(w?.qty);
                    whMap.set(c + " " + wc, [c, wc, Number.isFinite(q) ? q : 0, snapshotAt]);
                }
                whRows = Array.from(whMap.values());
            }
            // [未來銷貨加回 2026-07-17] 頂層 future_sales（來自 ly_stock_push.py 查未來日期 A1−A2 淨量）：
            // 「欄位存在且為陣列」＝本批查詢成功 → 同交易內按公司覆蓋 erp_future_sales（含空陣列＝清空該公司加回）；
            // 欄位不存在（查詢失敗/舊代理未帶）→ 完全不動該表，保留上一份加回。用 Map 以 erp_code 去重。
            const hasFut = Array.isArray(body.future_sales);
            let futRows = null;
            if (hasFut) {
                const futMap = new Map();
                for (const f of body.future_sales) {
                    const c = String(f?.erp_code ?? f?.code ?? "").trim();
                    if (!c)
                        continue;
                    const q = Number(f?.qty);
                    futMap.set(c, [c, Number.isFinite(q) ? q : 0, snapshotAt]);
                }
                futRows = Array.from(futMap.values());
            }
            // [fix 2026-07-08] 全表覆蓋（DELETE + 分批 INSERT + meta 更新）包進單一交易：
            // 過去無交易，推送中途失敗（網路斷、pool 瞬斷）會留下「半空的庫存表」且快照時間未更新，
            // 使用者看到的是殘缺庫存卻無從察覺；交易失敗整批回滾＝保留上一份完整快照。
            // 多公司：只覆蓋該次推送的公司（icpno），其他公司的快照不動。
            const doReplace = async (h) => {
                await h.prepare("DELETE FROM erp_stock_items WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").run(icpno);
                const CHUNK = 100;
                for (let i = 0; i < rows.length; i += CHUNK) {
                    const chunk = rows.slice(i, i + CHUNK);
                    const ph = chunk.map(() => "(?,?,?,?,?,?,?,?)").join(",");
                    const flat = [];
                    for (const r of chunk)
                        flat.push(...r);
                    await h.prepare("INSERT INTO erp_stock_items (erp_code, name, spec, unit, qty, wh_code, icpno, updated_at) VALUES " + ph).run(...flat);
                }
                // 每日庫存快照（統計圖表 K 線／歷史盤差凍結基準用）：同交易內，一天一份、最後一次推送為準（先刪今天這家再整批插）。
                // [統計圖表 2026-07-16] K 線 OHLC：開＝當日第一次推送時的「昨日收」（無昨日快照＝當次量）；
                // 高/低＝當日所有推送觀測到的極值（含開）；qty＝收（最後推送量）。同日重推保留既有 open、只擴 high/low。
                const dailySnapDate = stkAdminTaipeiDate();
                const todayOhlc = new Map(); // erp_code -> {open,hi,lo}
                try {
                    for (const t of (await h.prepare("SELECT erp_code, qty_open, qty_high, qty_low FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").all(icpno, dailySnapDate)) || [])
                        todayOhlc.set(String(t.erp_code), { open: Number(t.qty_open), hi: Number(t.qty_high), lo: Number(t.qty_low) });
                } catch (_) { /* 舊庫尚無 OHLC 欄時視同全新一天 */ }
                const ydayClose = new Map(); // erp_code -> 昨收
                try {
                    const pv = await h.prepare("SELECT MAX(snap_date) AS d FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date < ?").get(icpno, dailySnapDate);
                    if (pv && pv.d) {
                        for (const r0 of (await h.prepare("SELECT erp_code, qty FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").all(icpno, String(pv.d))) || [])
                            ydayClose.set(String(r0.erp_code), Number(r0.qty));
                    }
                } catch (_) { /* 無昨日快照＝open 退回當次量 */ }
                const mergeOhlc = (exist, yday, qty) => {
                    const open = (exist && Number.isFinite(exist.open)) ? exist.open : (Number.isFinite(yday) ? yday : qty);
                    const hi = Math.max(Number.isFinite(exist?.hi) ? exist.hi : -Infinity, qty, open);
                    const lo = Math.min(Number.isFinite(exist?.lo) ? exist.lo : Infinity, qty, open);
                    return [open, hi, lo];
                };
                await h.prepare("DELETE FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").run(icpno, dailySnapDate);
                for (let i = 0; i < rows.length; i += CHUNK) {
                    const chunk = rows.slice(i, i + CHUNK);
                    const ph = chunk.map(() => "(?,?,?,?,?,?,?,?)").join(",");
                    const flat = [];
                    for (const r of chunk) { // r = [code,name,spec,unit,qty,wh_code,icpno,at]；qty=r[4]
                        const [o, hi, lo] = mergeOhlc(todayOhlc.get(r[0]), ydayClose.get(r[0]), r[4]);
                        flat.push(icpno, r[0], dailySnapDate, r[4], o, hi, lo, snapshotAt);
                    }
                    await h.prepare("INSERT INTO erp_stock_daily (icpno, erp_code, snap_date, qty, qty_open, qty_high, qty_low, updated_at) VALUES " + ph).run(...flat);
                }
                try { // 只留近 90 天（統計圖表月 K 需要較長歷史），避免無限成長
                    const pruneBefore = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - 90 * 86400000));
                    await h.prepare("DELETE FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date < ?").run(icpno, pruneBefore);
                    await h.prepare("DELETE FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date < ?").run(icpno, pruneBefore);
                    await h.prepare("DELETE FROM erp_future_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date < ?").run(icpno, pruneBefore);
                } catch (_) { /* prune 失敗不影響推送 */ }
                // 分倉快照：同交易內覆蓋（失敗整批回滾，與主表一致）；沒帶 warehouse_qty 就跳過不動。
                // [fix 2026-07-14] 多公司安全改為「按公司覆蓋」：凌越倉號可跨公司重複（erp_warehouse
                // 已是 (icpno, code) 主鍵），舊版只以倉別清會把別家公司同倉號的列一起刪掉。
                if (whRows) {
                    await h.prepare("DELETE FROM erp_stock_wh_qty WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").run(icpno);
                    const WCHUNK = 50;
                    for (let i = 0; i < whRows.length; i += WCHUNK) {
                        const chunk = whRows.slice(i, i + WCHUNK);
                        const ph = chunk.map(() => "(?,?,?,?,?)").join(",");
                        const flat = [];
                        for (const r of chunk)
                            flat.push(icpno, ...r);
                        await h.prepare("INSERT INTO erp_stock_wh_qty (icpno, erp_code, wh_code, qty, updated_at) VALUES " + ph).run(...flat);
                    }
                    await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_wh_snapshot_at", snapshotAt);
                    // [統計圖表 2026-07-16] 分倉每日快照＋OHLC（K 線分倉檢視）：與公司層級同一套規則。
                    const whKey = (c, wc) => c + "" + wc;
                    const whTodayOhlc = new Map();
                    try {
                        for (const t of (await h.prepare("SELECT erp_code, wh_code, qty_open, qty_high, qty_low FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").all(icpno, dailySnapDate)) || [])
                            whTodayOhlc.set(whKey(String(t.erp_code), String(t.wh_code)), { open: Number(t.qty_open), hi: Number(t.qty_high), lo: Number(t.qty_low) });
                    } catch (_) { }
                    const whYdayClose = new Map();
                    try {
                        const pvw = await h.prepare("SELECT MAX(snap_date) AS d FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date < ?").get(icpno, dailySnapDate);
                        if (pvw && pvw.d) {
                            for (const r0 of (await h.prepare("SELECT erp_code, wh_code, qty FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").all(icpno, String(pvw.d))) || [])
                                whYdayClose.set(whKey(String(r0.erp_code), String(r0.wh_code)), Number(r0.qty));
                        }
                    } catch (_) { }
                    await h.prepare("DELETE FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").run(icpno, dailySnapDate);
                    for (let i = 0; i < whRows.length; i += WCHUNK) {
                        const chunk = whRows.slice(i, i + WCHUNK);
                        const ph = chunk.map(() => "(?,?,?,?,?,?,?,?,?)").join(",");
                        const flat = [];
                        for (const r of chunk) { // r = [erp_code, wh_code, qty, at]
                            const k = whKey(r[0], r[1]);
                            const [o, hi, lo] = mergeOhlc(whTodayOhlc.get(k), whYdayClose.get(k), r[2]);
                            flat.push(icpno, r[1], r[0], dailySnapDate, r[2], o, hi, lo, snapshotAt);
                        }
                        await h.prepare("INSERT INTO erp_stock_wh_daily (icpno, wh_code, erp_code, snap_date, qty, qty_open, qty_high, qty_low, updated_at) VALUES " + ph).run(...flat);
                    }
                }
                // [未來銷貨加回] future_sales 帶陣列（即使空）＝本批查詢成功 → 按公司覆蓋（空＝清空該公司加回，
                // 表示已無未來銷貨、加回歸零）；沒帶＝查詢失敗/舊代理，上面 futRows 為 null 完全不動、保留上一份。
                if (futRows) {
                    await h.prepare("DELETE FROM erp_future_sales WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").run(icpno);
                    const FCHUNK = 100;
                    for (let i = 0; i < futRows.length; i += FCHUNK) {
                        const chunk = futRows.slice(i, i + FCHUNK);
                        const ph = chunk.map(() => "(?,?,?,?)").join(",");
                        const flat = [];
                        for (const r of chunk)
                            flat.push(icpno, ...r); // r = [erp_code, qty, at]
                        await h.prepare("INSERT INTO erp_future_sales (icpno, erp_code, qty, updated_at) VALUES " + ph).run(...flat);
                    }
                    await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_future_sales_snapshot_at", snapshotAt);
                    // [未來銷貨加回 2026-07-30] 每日快照：未來單會隨日期滾動消失，只留「現在」一份的話
                    // 歷史盤點列的「應有實體量」每天都會變。同交易內一天一份（最後一次推送為準）。
                    await h.prepare("DELETE FROM erp_future_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date = ?").run(icpno, dailySnapDate);
                    for (let i = 0; i < futRows.length; i += FCHUNK) {
                        const chunk = futRows.slice(i, i + FCHUNK);
                        const ph = chunk.map(() => "(?,?,?,?,?)").join(",");
                        const flat = [];
                        for (const r of chunk)
                            flat.push(icpno, r[0], dailySnapDate, r[1], r[2]); // r = [erp_code, qty, at]
                        await h.prepare("INSERT INTO erp_future_daily (icpno, erp_code, snap_date, qty, updated_at) VALUES " + ph).run(...flat);
                    }
                }
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_snapshot_at", snapshotAt);
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_item_count", String(rows.length));
                // 每家公司各自的快照時間/筆數（顯示用；legacy 兩鍵維持＝最後一次推送）
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_snapshot_at_" + icpno, snapshotAt);
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_item_count_" + icpno, String(rows.length));
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_status", "done");
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_requested_at", "");
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_error", "");
            };
            if (typeof db.transaction === "function")
                await db.transaction(doReplace);
            else
                await doReplace(db);
            console.log("[admin] inventory-push 完成：items", rows.length, "筆；warehouse_qty", whRows ? whRows.length + " 筆（分倉快照已覆蓋）" : "未帶（分倉快照保留上一份）", "；future_sales", futRows ? futRows.length + " 筆（未來銷貨加回已覆蓋）" : "未帶（加回保留上一份）");
            res.json({ ok: true, count: rows.length, warehouse_qty_count: whRows ? whRows.length : null, future_sales_count: futRows ? futRows.length : null, snapshot_at: snapshotAt });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/inventory-push", e?.message || e);
            // [ops 2026-07-10] 庫存推送失敗＝後台庫存可能過期，推播告警（交易已回滾、保留上一份快照）。
            ops_notify_js_1.notifyOps(db, `凌越庫存推送（inventory-push）失敗：${String(e?.message || e).slice(0, 200)}`).catch(() => { });
            res.status(500).json({ error: "inventory-push 失敗", detail: String(e?.message || e) });
        }
    });
    // ============================================================
    //  每日帳款收款（Phase 1：取單上雲 + 銷貨單總計表）
    //  資料源：凌越銷貨單(0000A1) 主表 + 客戶主檔(00000D) 結帳方式(CT_FKFS)，
    //  由內網代理 scripts/ly_sales_push.py 推上雲（air-gap，雲端連不到凌越）。
    // ============================================================
    // 內網推當日銷貨單上雲（機器對機器，X-Writeback-Key，走上方 /lingyue-writeback/ 中介層）
    router.post("/lingyue-writeback/cash-ingest", express_1.default.json({ limit: "16mb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const docs = Array.isArray(body.docs) ? body.docs : null;
            if (!docs) {
                res.status(400).json({ error: "缺少 docs 陣列" });
                return;
            }
            const icpno = erp_companies_js_1.normIcpno(body.icpno, "00");
            const date = (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date.trim())) ? body.date.trim() : "";
            if (!date) {
                res.status(400).json({ error: "缺少或格式錯誤 date (需 YYYY-MM-DD)" });
                return;
            }
            const ingestedAt = new Date().toISOString();
            const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "").trim()); return Number.isFinite(n) ? n : 0; };
            const docRows = [];
            for (const d of docs) {
                const spNo = String(d?.sp_no ?? "").trim();
                if (!spNo)
                    continue;
                const kind = spNo.toUpperCase().startsWith("A") ? "A" : "num";
                docRows.push([
                    icpno, spNo, date,
                    String(d?.ct_no ?? "").trim(),
                    String(d?.ct_name ?? "").trim(),
                    String(d?.fkfs ?? "").trim(),
                    num(d?.total), num(d?.unpaid), num(d?.paid),
                    String(d?.nopay_fg ?? "").trim(),
                    String(d?.sales ?? "").trim(),
                    kind, ingestedAt, String(body.pushed_by ?? "agent").trim(),
                ]);
            }
            // 收款客戶主檔 seed：name/fkfs/sales/stop 由推送覆蓋；is_cash/route_line/note 為人工維護，不覆蓋。
            const custList = Array.isArray(body.customers) ? body.customers : [];
            const custRows = [];
            for (const c of custList) {
                const ctNo = String(c?.ct_no ?? "").trim();
                if (!ctNo)
                    continue;
                const fkfs = String(c?.fkfs ?? "").trim();
                const isCashSeed = /現金|現收|cash/i.test(fkfs) ? 1 : 0; // 由結帳方式含「現金」推定；人工可覆蓋
                const route = String(c?.route ?? "").trim(); // 由凌越送貨地址 [N] 解析而來（內網腳本送）
                const lastTxn = String(c?.last_txn ?? "").trim().slice(0, 10); // CT_LAST_DT 最後交易日
                custRows.push([
                    icpno, ctNo, String(c?.name ?? "").trim(), fkfs,
                    String(c?.sales ?? "").trim(), isCashSeed, (c?.stop ? 1 : 0), route, lastTxn, ingestedAt,
                ]);
            }
            const doIngest = async (h) => {
                // 該公司該日全表覆蓋：重新取單即反映凌越當下狀態（含新增/刪除），對應「印報表再跑一次」。
                await h.prepare("DELETE FROM cash_sales_doc WHERE icpno = ? AND doc_date = ?").run(icpno, date);
                const CHUNK = 100;
                for (let i = 0; i < docRows.length; i += CHUNK) {
                    const chunk = docRows.slice(i, i + CHUNK);
                    const ph = chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
                    const flat = [];
                    for (const r of chunk)
                        flat.push(...r);
                    await h.prepare("INSERT INTO cash_sales_doc (icpno, sp_no, doc_date, ct_no, ct_name, fkfs, total, unpaid, paid, nopay_fg, sales, kind, ingested_at, ingested_by) VALUES " + ph).run(...flat);
                }
                for (const r of custRows) {
                    // route_line：凌越送貨地址 [N] 有解析到就更新（地址為權威來源）、沒解析到就保留原本（可能是人工/客戶管理帶入）
                    await h.prepare("INSERT INTO cash_customer (icpno, ct_no, name, fkfs, sales, is_cash, stop, route_line, last_txn, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) " +
                        "ON CONFLICT (icpno, ct_no) DO UPDATE SET name = excluded.name, fkfs = excluded.fkfs, sales = excluded.sales, stop = excluded.stop, " +
                        "is_cash = COALESCE(cash_customer.is_cash, excluded.is_cash), last_txn = excluded.last_txn, " +
                        "route_line = CASE WHEN COALESCE(excluded.route_line,'') <> '' THEN excluded.route_line ELSE cash_customer.route_line END, " +
                        "updated_at = excluded.updated_at").run(...r);
                }
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_sales_ingested_at_" + icpno + "_" + date, ingestedAt);
                // 重新取單完成標記：讓網站前端輪詢 refresh-status 判斷「資料已更新」→ 自動重整。冪等，定時推送也會寫（無害）。
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_status", "done");
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_done_at", ingestedAt);
                await h.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_error", "");
            };
            if (typeof db.transaction === "function")
                await db.transaction(doIngest);
            else
                await doIngest(db);
            console.log("[admin] cash-ingest 完成：", icpno, date, "docs", docRows.length, "customers", custRows.length);
            res.json({ ok: true, date, icpno, docs: docRows.length, customers: custRows.length, ingested_at: ingestedAt });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/cash-ingest", e?.message || e);
            res.status(500).json({ error: "cash-ingest 失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * GET /admin/lingyue-writeback/inventory-wait?timeout=25
     *   長連線等待（long-poll）：內網 agent 掛一條線等「使用者在網站點了『庫存更新』」。
     *   有待處理請求（app_settings.erp_stock_refresh_requested_at 非空）立刻回 {refresh:true}，
     *   否則 hold 到 timeout 秒（預設 25、上限 50）回 {refresh:false}。agent 收到後撈凌越並 inventory-push。
     */
    router.get("/lingyue-writeback/inventory-wait", async (req, res) => {
        let timeoutSec = parseInt(String(req.query.timeout || "25"), 10);
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0)
            timeoutSec = 25;
        if (timeoutSec > 50)
            timeoutSec = 50;
        const deadline = Date.now() + timeoutSec * 1000;
        try {
            // [ops 2026-07-10] 心跳：記錄內網代理最後一次連上 inventory-wait 的時間。
            try {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("ly_agent_last_inventory_wait_at", new Date().toISOString());
            }
            catch (_) { /* 心跳寫入失敗不影響主流程 */ }
            while (true) {
                const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_stock_refresh_requested_at");
                const reqAt = row && row.value ? String(row.value).trim() : "";
                if (reqAt) {
                    // [依公司自主更新] 一起讀出這次請求指定的公司（空＝全公司，代理沿用自身 LY_ICPNO 設定）。
                    let reqIcpno = "";
                    try { const ir = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_stock_refresh_icpno"); reqIcpno = ir && ir.value ? String(ir.value).trim() : ""; }
                    catch (_) { }
                    // 一領到就清掉旗標：避免推送失敗時旗標一直在、代理每次輪詢又重撈重推（無限重試風暴、狂打凌越）。
                    // 單次請求＝單次嘗試；失敗就等使用者再按或下次定時推。成功推送時 inventory-push 也會再清一次（冪等）。
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_requested_at", "");
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_icpno", "");
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_status", "running");
                    res.json({ refresh: true, requested_at: reqAt, icpno: reqIcpno });
                    return;
                }
                if (Date.now() >= deadline) {
                    res.json({ refresh: false });
                    return;
                }
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/inventory-wait", e?.message || e);
            res.status(500).json({ error: "inventory-wait 失敗", detail: String(e?.message || e) });
        }
    });
    // 代理回報庫存刷新失敗原因（如凌越連線逾時），讓網站顯示真正原因而非「代理未執行」
    router.post("/lingyue-writeback/inventory-report", express_1.default.json({ limit: "64kb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const now = new Date().toISOString();
            if (body.ok) {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_error", "");
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_status", "done");
            } else {
                const err = String(body.error || "未知錯誤").slice(0, 500);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_error", err);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_error_at", now);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_status", "error");
                // [ops 2026-07-10] 代理回報庫存刷新失敗（如凌越連線逾時）→ 推播告警。
                ops_notify_js_1.notifyOps(db, `凌越庫存刷新失敗（代理回報）：${err.slice(0, 200)}`).catch(() => { });
            }
            res.json({ ok: true });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    /**
     * GET /admin/lingyue-writeback/cash-refresh-wait?timeout=25
     *   長連線：內網代理掛一條線等「使用者在銷貨統計/收款頁按了『重新取單』」。
     *   有待處理（app_settings.cash_refresh_requested 非空）立刻回 {refresh:true, icpno, date}，
     *   否則 hold 到 timeout 秒回 {refresh:false}。代理收到後重撈凌越該日 → cash-ingest。
     */
    router.get("/lingyue-writeback/cash-refresh-wait", async (req, res) => {
        let timeoutSec = parseInt(String(req.query.timeout || "25"), 10);
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0)
            timeoutSec = 25;
        if (timeoutSec > 50)
            timeoutSec = 50;
        const deadline = Date.now() + timeoutSec * 1000;
        try {
            try {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("ly_agent_last_cash_wait_at", new Date().toISOString());
            }
            catch (_) { /* 心跳寫入失敗不影響主流程 */ }
            while (true) {
                const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("cash_refresh_requested");
                const raw = row && row.value ? String(row.value).trim() : "";
                if (raw) {
                    let icpno = "00", date = "";
                    try { const p = JSON.parse(raw); icpno = erp_companies_js_1.normIcpno(p.icpno, "00"); date = String(p.date || "").trim(); }
                    catch (_) { }
                    // 一領到就清旗標：避免推送失敗時旗標一直在、代理每輪又重撈重推。單次請求＝單次嘗試。
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_requested", "");
                    await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_status", "running");
                    res.json({ refresh: true, icpno, date });
                    return;
                }
                if (Date.now() >= deadline) {
                    res.json({ refresh: false });
                    return;
                }
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/cash-refresh-wait", e?.message || e);
            res.status(500).json({ error: "cash-refresh-wait 失敗", detail: String(e?.message || e) });
        }
    });
    // 代理回報重新取單結果（cash-ingest 成功會另外寫時間戳；這裡主要記錄失敗原因供網站顯示）
    router.post("/lingyue-writeback/cash-refresh-report", express_1.default.json({ limit: "16kb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const now = new Date().toISOString();
            if (body.ok) {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_error", "");
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_status", "done");
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_done_at", now);
            }
            else {
                const err = String(body.error || "未知錯誤").slice(0, 500);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_error", err);
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("cash_refresh_status", "error");
                ops_notify_js_1.notifyOps(db, `凌越重新取單失敗（代理回報）：${err.slice(0, 200)}`).catch(() => { });
            }
            res.json({ ok: true });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    /**
     * GET /admin/lingyue-writeback/txn-wait?timeout=25
     *   長連線：agent 等「使用者在庫存頁點品項要查進銷存」的請求。
     *   有請求（app_settings.erp_txn_req_<料號>）立刻回 {codes:[{code,icpno}]}；否則 hold 到 timeout。
     */
    router.get("/lingyue-writeback/txn-wait", async (req, res) => {
        let timeoutSec = parseInt(String(req.query.timeout || "25"), 10);
        if (!Number.isFinite(timeoutSec) || timeoutSec <= 0)
            timeoutSec = 25;
        if (timeoutSec > 50)
            timeoutSec = 50;
        const deadline = Date.now() + timeoutSec * 1000;
        try {
            // [ops 2026-07-10] 心跳：記錄內網代理最後一次連上 txn-wait 的時間。
            try {
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("ly_agent_last_txn_wait_at", new Date().toISOString());
            }
            catch (_) { /* 心跳寫入失敗不影響主流程 */ }
            while (true) {
                const rows = await db.prepare("SELECT key, value FROM app_settings WHERE key LIKE ?").all("erp_txn_req_%");
                if (rows && rows.length) {
                    const codes = rows.map((r) => {
                        let icpno = "00";
                        try { icpno = JSON.parse(r.value).icpno || "00"; } catch (_) { }
                        // [fix 2026-07-14] 新鍵格式 erp_txn_req_<icpno>_<code>；部署交界期可能殘留
                        // 舊格式（不含公司前綴）的在途請求，兩種都解析（icpno 以 value JSON 為權威）。
                        let rest = String(r.key).slice("erp_txn_req_".length);
                        const m = rest.match(/^(\d{2})_(.+)$/);
                        if (m) { icpno = m[1]; rest = m[2]; }
                        return { code: rest, icpno };
                    });
                    res.json({ codes });
                    return;
                }
                if (Date.now() >= deadline) {
                    res.json({ codes: [] });
                    return;
                }
                await new Promise((r) => setTimeout(r, 1500));
            }
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/txn-wait", e?.message || e);
            res.status(500).json({ error: "txn-wait 失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * POST /admin/lingyue-writeback/txn-callback
     *   body: { results:[ {code, icpno, data:{summary,fields}, error} ] }
     *   agent 撈完凌越進銷存後回填；寫 erp_txn_res_<code>、刪 erp_txn_req_<code>。
     */
    router.post("/lingyue-writeback/txn-callback", express_1.default.json({ limit: "8mb" }), async (req, res) => {
        try {
            const results = Array.isArray(req.body?.results) ? req.body.results : [];
            const now = new Date().toISOString();
            let n = 0;
            for (const r of results) {
                const code = String(r?.code || "").trim();
                if (!code)
                    continue;
                const rIcp = (0, erp_companies_js_1.normIcpno)(r.icpno);
                const payload = JSON.stringify({ icpno: rIcp, data: r.data || null, error: r.error || null, fetched_at: now });
                // [fix 2026-07-14] 結果鍵含公司；請求鍵新舊格式都清（部署交界期的在途請求）
                await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_txn_res_" + rIcp + "_" + code, payload);
                await db.prepare("DELETE FROM app_settings WHERE key = ?").run("erp_txn_req_" + rIcp + "_" + code);
                await db.prepare("DELETE FROM app_settings WHERE key = ?").run("erp_txn_req_" + code);
                n++;
            }
            res.json({ ok: true, updated: n });
        }
        catch (e) {
            console.error("[admin] lingyue-writeback/txn-callback", e?.message || e);
            res.status(500).json({ error: "txn-callback 失敗", detail: String(e?.message || e) });
        }
    });
    /**
     * 轉入凌越 — 單張。組出凌越料號對映（沿用 /pending 的欄位邏輯），供列表「轉入凌越」按鈕用。
     * @param {*} order  已含 hq_cust_code / teraoka_code / customer_name / order_date / remark 的訂單列
     */
}
