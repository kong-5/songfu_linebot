"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInventoryRoutes = registerInventoryRoutes;

// 庫存／盤點域（每日盤點、庫存調整、count-edit、stocktake.csv、anomalies、stats、legacy、倉別、assign、daily、import-erp、目前庫存、item-photo、倉別設定、條碼對照、效期品、掃碼盤點 scan、網站盤點入口 entry、variance-report、manager…）路由：自 index.js 拆出（拆檔批次 3），純搬移、行為不變。

const express_1 = { default: require("express") };
const multer_1 = { default: require("multer") };
const id_js_1 = require("../lib/id.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const stocktake_api_js_1 = require("../lib/stocktake-api.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr } = require("./_shared.js");

function registerInventoryRoutes(router, ctx) {
    const { db, notionPage, logDataChange, loadAdminUsers, stkAdminTaipeiDate, saveGroupFeatures, stickyIcpno, fmtTaipeiYMDHM, STK_STYLE, STK_CLIENT_JS, barcodeAddModalHtml } = ctx;
    function stkAdminTwTime(iso) {
        if (!iso) return "";
        try { return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false, hour: "2-digit", minute: "2-digit" }); }
        catch (_) { return String(iso); }
    }
    async function loadStocktakeDay(date, latestMap, adjMap) {
        // latestMap 以「icpno|料號」為鍵（多公司料號可能撞號，不能只用料號）
        const lm = latestMap || {};
        const am = adjMap || {}; // 人工調整值（icpno|料號→delta）：最新系統＝凌越 + delta，讓盤差扣掉系統誤差
        const sessions = await db.prepare("SELECT * FROM stocktake_session WHERE count_date = ? ORDER BY wh_code").all(date);
        const out = [];
        // [分倉庫存 2026-07-10] 「最新系統／對最新盤差」的基準：該倉在 erp_stock_wh_qty 有任何分倉列
        // → 用該倉分倉量（品項無列＝0）；整倉無分倉資料 → fallback 總量（erp_stock_items，latestMap）。
        // 一倉一次查（快取），不逐品項查。latestSource 供卡片顯示「分倉／總量」基準標記。
        // 注意：sys_qty（盤差「對當下」）是盤點送出當下寫進 stocktake_count 的凍結快照，這裡原樣讀出、
        // 不回溯改動——只有「最新系統」欄與新建立的 session 用新基準。
        const whLatestCache = {};
        // [fix 2026-07-14] 快取鍵含 icpno：erp_stock_wh_qty 已按公司分列，倉號可跨公司重複。
        const getWhLatest = async (icp, whCode) => {
            const ck = icp + "|" + whCode;
            if (Object.prototype.hasOwnProperty.call(whLatestCache, ck)) return whLatestCache[ck];
            let m = null;
            try {
                const rows = await db.prepare("SELECT erp_code, qty FROM erp_stock_wh_qty WHERE wh_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(whCode, icp);
                if ((rows || []).length) { m = {}; for (const r of rows) m[String(r.erp_code || "")] = Number(r.qty || 0); }
            } catch (_) { m = null; /* 查詢失敗 → 沿用總量基準 */ }
            whLatestCache[ck] = m;
            return m;
        };
        for (const s of sessions || []) {
            const sIcp = (0, erp_companies_js_1.normIcpno)(s.icpno);
            const whm = await getWhLatest(sIcp, String(s.wh_code || ""));
            const rows = await db.prepare("SELECT erp_code, name, spec, unit, sys_qty, counted_qty, mid_qty, expiry_json, edited_at, edited_by_name FROM stocktake_count WHERE session_id = ? ORDER BY erp_code").all(s.id);
            const items = (rows || []).map((r) => {
                const sys = Number(r.sys_qty || 0);
                const counted = (r.counted_qty == null || r.counted_qty === "") ? null : Number(r.counted_qty);
                const mid = (r.mid_qty == null || r.mid_qty === "") ? null : Number(r.mid_qty);
                const diff = counted == null ? null : Math.round((counted - sys) * 100) / 100;
                const code = String(r.erp_code || "");
                const adj = Number(am[sIcp + "|" + code] || 0); // 人工調整值
                // 分倉庫存優先（該倉有 000009 資料）；否則 fallback 到公司總量快照（鍵含 icpno）
                let latestRaw;
                if (whm) {
                    latestRaw = Number(whm[code] || 0); // 分倉基準：該品項無分倉列＝0
                } else {
                    const lmKey = sIcp + "|" + code;
                    const hasLatest = Object.prototype.hasOwnProperty.call(lm, lmKey);
                    latestRaw = hasLatest ? Number(lm[lmKey]) : null;
                }
                // 最新系統＝凌越 + 人工調整；對最新盤差＝實盤−最新系統（建立調整後歸零）
                const latest = latestRaw == null ? null : Math.round((latestRaw + adj) * 100) / 100;
                const diffLatest = (counted == null || latest == null) ? null : Math.round((counted - latest) * 100) / 100;
                let expiry = [];
                try { expiry = JSON.parse(r.expiry_json || "[]") || []; } catch (_) { expiry = []; }
                return { code, name: String(r.name || ""), spec: String(r.spec || ""), unit: String(r.unit || ""), sys, counted, mid, diff, latest, latestRaw, adj, diffLatest, expiry, editedAt: r.edited_at || null, editedBy: r.edited_by_name || null };
            });
            const diffCount = items.filter((it) => it.diff != null && it.diff !== 0).length;
            out.push({ session: s, items, diffCount, latestSource: whm ? "warehouse" : "total" });
        }
        return out;
    }
    router.get("/inventory", async (req, res) => {
        const qd = String(req.query.date || "").trim();
        const date = /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : stkAdminTaipeiDate();
        // 最新庫存快照（供「對最新盤差」對照）
        const latestMap = {};
        let stockMeta = {};
        try {
            (await db.prepare("SELECT erp_code, qty, icpno FROM erp_stock_items").all() || []).forEach((r) => { latestMap[(0, erp_companies_js_1.normIcpno)(r.icpno) + "|" + String(r.erp_code)] = Number(r.qty || 0); });
            stockMeta = await readStockMeta();
        } catch (_) { /* 無庫存快照時照樣顯示 */ }
        // 人工調整值（彌補系統誤差）：最新系統/對最新盤差都會加上它
        const adjMap = {};
        try { (await db.prepare("SELECT erp_code, delta, icpno FROM stock_adjustment").all() || []).forEach((r) => { adjMap[(0, erp_companies_js_1.normIcpno)(r.icpno) + "|" + String(r.erp_code)] = Number(r.delta || 0); }); } catch (_) { }
        // [未來銷貨加回] 開關開時「最新系統」欄旁標藍色「未來+N」——純提示（解釋盤差來源），
        // 刻意不進最新系統/盤差計算：盤差是實盤 vs 凌越帳的對帳，混入未來量會失真。
        const futMap = {};
        try { (await db.prepare("SELECT erp_code, qty, icpno FROM erp_future_sales").all() || []).forEach((r) => { futMap[(0, erp_companies_js_1.normIcpno)(r.icpno) + "|" + String(r.erp_code)] = Number(r.qty || 0); }); } catch (_) { }
        let futOn = false;
        try { const fr = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("stock_future_reversal_enabled"); futOn = !!(fr && String(fr.value) === "1"); } catch (_) { }
        const day = await loadStocktakeDay(date, latestMap, adjMap);
        let includedWh = [];
        try { includedWh = (await db.prepare("SELECT code, name, icpno FROM erp_warehouse WHERE include_stocktake = 1 ORDER BY icpno, sort_order, code").all()) || []; } catch (_) { includedWh = []; }
        let recentDates = [];
        try { recentDates = (await db.prepare("SELECT count_date AS d, COUNT(*) AS n FROM stocktake_session GROUP BY count_date ORDER BY count_date DESC LIMIT 14").all()) || []; } catch (_) { recentDates = []; }
        // 多公司：倉庫鍵一律「icpno:倉號」（松富00 與松揚02 的倉號可能相同）
        const whKeyOf = (icp, code) => (0, erp_companies_js_1.normIcpno)(icp) + ":" + String(code);
        const coTag = (icp) => ((0, erp_companies_js_1.normIcpno)(icp) === "00" ? "" : (0, erp_companies_js_1.erpCompanyName)(icp));
        const byWh = {}; day.forEach((x) => { byWh[whKeyOf(x.session.icpno, x.session.wh_code)] = x; });
        const countedWh = new Set(day.map((x) => whKeyOf(x.session.icpno, x.session.wh_code)));
        const pendingWh = includedWh.filter((w) => !countedWh.has(whKeyOf(w.icpno, w.code)));
        const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
        const fmtN = (n) => (n == null ? "—" : String(n));
        // 分母一律 max(|sys|,1)（與統計端 statsVarPct 同口徑）：負庫存不會正負號反轉、
        // sys=0 有盤差時不再顯示「—」把異常藏起來。
        const diffPct = (it) => {
            if (it.diff == null) return "—";
            return ((it.diff / Math.max(Math.abs(Number(it.sys) || 0), 1)) * 100).toFixed(1) + "%";
        };
        const latestPct = (it) => {
            if (it.diffLatest == null || it.latest == null) return "—";
            return ((it.diffLatest / Math.max(Math.abs(Number(it.latest) || 0), 1)) * 100).toFixed(1) + "%";
        };
        const diffCls = (it) => (it.diff == null ? "" : it.diff === 0 ? "stk-z" : it.diff > 0 ? "stk-p" : "stk-n");
        const expiryTxt = (arr) => (arr || []).filter((b) => b && (b.date || b.qty)).map((b) => `${b.date || "?"} × ${b.qty || "?"}`).join("、");
        // 左欄倉庫清單 = 納入盤點的倉 ∪ 當日有盤的倉（鍵含公司）
        const whList = [];
        const seen = new Set();
        for (const w of includedWh) { const k = whKeyOf(w.icpno, w.code); whList.push({ key: k, code: String(w.code), name: String(w.name || ""), co: coTag(w.icpno) }); seen.add(k); }
        for (const x of day) { const k = whKeyOf(x.session.icpno, x.session.wh_code); if (!seen.has(k)) { whList.push({ key: k, code: String(x.session.wh_code), name: String(x.session.wh_name || ""), co: coTag(x.session.icpno) }); seen.add(k); } }
        // 預設選第一個「有盤」的倉
        const firstCounted = day[0] ? whKeyOf(day[0].session.icpno, day[0].session.wh_code) : (whList[0] ? whList[0].key : "");
        // 相容舊網址：?wh=倉號（無公司前綴）視為松富
        let selWh = String(req.query.wh || "").trim() || firstCounted;
        if (selWh && selWh.indexOf(":") < 0) selWh = "00:" + selWh;
        const sel = byWh[selWh] || null;
        const totalDiff = day.reduce((s, x) => s + x.diffCount, 0);
        // 左側日期欄（近期盤點日；目前選的日期若不在清單內──手動挑的日子──插到最上面）
        const dateColHtml = (() => {
            const list = recentDates.map((r) => ({ d: String(r.d), n: Number(r.n || 0) }));
            if (!list.some((r) => r.d === date))
                list.unshift({ d: date, n: day.length });
            return list.map((r) => `<a class="stk-drow ${r.d === date ? "on" : ""}" href="/admin/inventory?date=${encodeURIComponent(r.d)}" title="${escapeAttr(r.d)}"><span class="stk-dn">${escapeHtml(r.d.slice(5).replace("-", "/"))}</span><span class="stk-dc">${r.n}倉</span></a>`).join("");
        })();
        // 跨倉品項搜尋資料：當日所有倉的已盤品項（前端模糊過濾；量＝當日已盤筆數，安全）
        const searchJson = JSON.stringify(day.map((x) => ({
            key: whKeyOf(x.session.icpno, x.session.wh_code),
            whName: String(x.session.wh_name || x.session.wh_code || ""),
            co: (0, erp_companies_js_1.erpCompanyName)(x.session.icpno),
            items: (x.items || []).map((it) => ({ c: String(it.code || ""), n: String(it.name || ""), s: String(it.spec || ""), sys: it.sys, ct: it.counted, d: it.diff })),
        }))).replace(/</g, "\\u003c");
        // 左欄
        const whItemsHtml = whList.map((w) => {
            const x = byWh[w.key];
            const on = w.key === selWh;
            const coChip = w.co ? `<span class="wh-co">${escapeHtml(w.co)}</span>` : "";
            if (x) {
                const done = Number(x.session.counted_count || 0), all = Number(x.session.item_count || 0);
                return `<a class="wh-it ${on ? "on" : ""}" href="/admin/inventory?date=${encodeURIComponent(date)}&wh=${encodeURIComponent(w.key)}">
                  <div class="wh-n">${escapeHtml(w.name || w.code)}${coChip}<span class="wh-c">${escapeHtml(w.code)}</span></div>
                  <div class="wh-m"><span>已盤 ${done}/${all}</span>${x.diffCount ? `<span class="wh-diff">盤差 ${x.diffCount}</span>` : `<span class="wh-ok">✓</span>`}</div>
                </a>`;
            }
            return `<div class="wh-it idle">
                  <div class="wh-n">${escapeHtml(w.name || w.code)}${coChip}<span class="wh-c">${escapeHtml(w.code)}</span></div>
                  <div class="wh-m"><span class="wh-pend">未盤</span></div>
                </div>`;
        }).join("");
        // 右欄（選定倉）
        let rightHtml;
        if (!sel) {
            rightHtml = `<div class="stk-empty">${day.length ? "請從左邊選一個倉庫查看。" : "此日期沒有盤點紀錄。<br>盤點方式：在白名單群組輸入「#盤點」，點倉庫按鈕進入 LIFF 盤點並送出。"}</div>`;
        } else {
            const s = sel.session;
            const done = Number(s.counted_count || 0), all = Number(s.item_count || 0);
            const dLatestCls = (d) => (d == null ? "" : d === 0 ? "stk-z" : d > 0 ? "stk-p" : "stk-n");
            // [UI 2026-07-17] 調整欄收斂成單一標籤：點標籤開浮動面板（套用實盤／手動存值／刪除），
            // 表單改由前端動態組出送 POST /inventory/adjustments（欄位與舊 inline form 相同）。
            const icpForm = (0, erp_companies_js_1.normIcpno)(s.icpno);
            const backQ = `date=${encodeURIComponent(date)}&wh=${encodeURIComponent(selWh)}`;
            const adjCell = (it) => {
                if (it.counted == null && !it.adj)
                    return "—";
                const attrs = ` data-code="${escapeAttr(it.code)}" data-name="${escapeAttr(it.name)}" data-spec="${escapeAttr(it.spec)}" data-unit="${escapeAttr(it.unit)}" data-counted="${it.counted == null ? "" : escapeAttr(String(it.counted))}" data-adj="${escapeAttr(String(it.adj || 0))}" data-base="${it.latestRaw == null ? "" : escapeAttr(String(it.latestRaw))}"`;
                if (it.adj)
                    return `<button type="button" class="stk-adjchip2 on"${attrs} title="已有調整（誤差補償），點開面板可套用實盤/改值/刪除">調 ${it.adj > 0 ? "+" : ""}${it.adj}</button>`;
                return `<button type="button" class="stk-adjchip2"${attrs} title="點開調整面板：把最新系統校正成實盤，或手動填調整值">調整</button>`;
            };
            // 未來銷貨加回（藍標）：開關開才顯示；純提示解釋盤差來源，刻意不進最新系統/盤差計算（盤差是與凌越帳的對帳）。
            const futOf = (it) => Number(futMap[icpForm + "|" + String(it.code)] || 0);
            const latestCell = (it) => {
                if (it.latest == null)
                    return "—";
                const fut = futOf(it);
                const futB = (futOn && fut) ? `<span class="stk-futb" title="有未來日期銷貨 ${fut > 0 ? "+" : ""}${fut}（先開單、貨還在架上）——實盤若多出這個量屬正常；此量未計入最新系統/盤差">未來${fut > 0 ? "+" : ""}${fut}</span>` : "";
                if (it.adj)
                    return `<span title="凌越 ${fmtN(it.latestRaw)} ＋ 調整 ${it.adj > 0 ? "+" : ""}${it.adj} ＝ ${fmtN(it.latest)}"><b>${fmtN(it.latest)}</b><span class="stk-ladj2">(調${it.adj > 0 ? "+" : ""}${it.adj})</span></span>${futB}`;
                return `${fmtN(it.latest)}${futB}`;
            };
            // 複盤：點實盤數字原地改（Enter 送出、Esc 取消；仍走 confirm＋修改軌跡）。✎/含中改 inline 小標，列高固定一行。
            const countCell = (it) => {
                const edited = it.editedAt ? `<span class="stk-editmark" title="複盤修正 ${escapeAttr(stkAdminTwTime(it.editedAt))}${it.editedBy ? " · " + escapeAttr(it.editedBy) : ""}">✎</span>` : "";
                const mid = it.mid ? `<span class="stk-mid2" title="其中中貨 ${it.mid}">中${it.mid}</span>` : "";
                return `<span class="stk-ct" role="button" tabindex="0" data-code="${escapeAttr(it.code)}" data-counted="${it.counted == null ? "" : escapeAttr(String(it.counted))}" title="點一下複盤修正實盤數">${fmtN(it.counted)}</span>${edited}${mid}`;
            };
            const rowsHtml = sel.items.map((it) => {
                // 紅底＝盤差(對當下)超過 ±5% 才標（sys=0 時 % 無意義，不標）；不再以正負號決定整列底色
                const hot = it.diff != null && it.sys !== 0 && Math.abs((it.diff / it.sys) * 100) > 5;
                return `
              <tr data-diff="${it.diff != null && it.diff !== 0 ? "1" : "0"}" class="${diffCls(it)}${hot ? " stk-hot" : ""}">
                <td class="stk-code">${escapeHtml(it.code)}</td>
                <td class="stk-name" title="${escapeAttr(it.name + (it.spec ? " " + it.spec : ""))}">${escapeHtml(it.name)}${it.spec ? `<span class="stk-spec">${escapeHtml(it.spec)}</span>` : ""}</td>
                <td class="stk-num stk-sep">${fmtN(it.sys)}</td>
                <td class="stk-num">${countCell(it)}</td>
                <td class="stk-num stk-diff">${it.diff == null ? "—" : `${(it.diff > 0 ? "+" : "") + it.diff}<span class="stk-pctp">(${diffPct(it)})</span>`}</td>
                <td class="stk-num stk-latest stk-sep">${latestCell(it)}</td>
                <td class="stk-num ${dLatestCls(it.diffLatest)}">${it.diffLatest == null ? "—" : `<b>${(it.diffLatest > 0 ? "+" : "") + it.diffLatest}</b><span class="stk-pctp">(${latestPct(it)})</span>`}</td>
                <td class="stk-adj stk-sep">${adjCell(it)}</td>
                <td class="stk-exp" title="${escapeAttr(expiryTxt(it.expiry))}">${escapeHtml(expiryTxt(it.expiry))}</td>
              </tr>`;
            }).join("");
            rightHtml = `
          <div class="stk-card" id="stkCard" data-icp="${escapeAttr(icpForm)}" data-wh="${escapeAttr(String(s.wh_code || ""))}" data-sid="${escapeAttr(String(s.id))}" data-back="${escapeAttr(backQ)}">
            <div class="stk-card-h">
              <div class="stk-card-t"><b>${escapeHtml(s.wh_name || s.wh_code)}</b>${coTag(s.icpno) ? `<span class="wh-co">${escapeHtml(coTag(s.icpno))}</span>` : ""}<span class="stk-code2">${escapeHtml(s.wh_code)}</span></div>
              <div class="stk-card-m">
                <span>盤點人 ${escapeHtml(s.created_by_name || "—")}</span>
                <span>送出 ${escapeHtml(stkAdminTwTime(s.submitted_at))}</span>
                <span class="stk-badge ${done >= all && all > 0 ? "ok" : ""}">已盤 ${done}/${all}（${pct(done, all)}%）</span>
                <span class="stk-badge ${sel.diffCount ? "warn" : "ok"}">盤差 ${sel.diffCount} 項</span>
                <span class="stk-badge" title="「最新系統」欄的資料基準：分倉＝該倉在凌越的分倉庫存量；總量＝全公司總庫存量（該倉無分倉資料時的後備）">最新基準：${sel.latestSource === "warehouse" ? "分倉" : "總量"}</span>
                <label class="sf-switch-label" style="font-size:11.5px;"><input type="checkbox" id="stkOnlyDiff"><span class="sf-switch"></span>只看盤差</label>
                <button type="button" class="stk-ibtn" id="stkInfo2" aria-expanded="false" aria-label="盤差計算說明" title="盤差計算說明">${SF_ICONS.info}</button>
              </div>
            </div>
            <div class="stk-note" id="stkInfo2Box" hidden>紅底＝盤差(對當下)超過 <b>±5%</b> 的品項。「系統(盤點當下)」是同事盤點<b>那一刻</b>的凌越庫存(已凍結)；若當時庫存快照較舊，盤差會偏大。<b>最新系統</b>取自${sel.latestSource === "warehouse" ? `<b>此倉的分倉庫存</b>快照(資料時間 ${escapeHtml(stkAdminTwTime(stockMeta.wh_snapshot_at) || "—")})` : `目前庫存快照的<b>全公司總量</b>(資料時間 ${escapeHtml(stkAdminTwTime(stockMeta.snapshot_at) || "—")}；此倉尚無分倉資料)`}，<b>對最新盤差＝實盤−最新系統</b>可較貼近現況。按「更新最新庫存」可先拉一次最新再看。</div>
            <div class="stk-tblwrap">
            <table class="stk-tbl">
              <thead>
                <tr>
                  <th rowspan="2">料號</th>
                  <th rowspan="2">品名</th>
                  <th colspan="3" class="stk-grp">盤點當下 <span class="stk-th2">凍結・送出 ${escapeHtml(stkAdminTwTime(s.submitted_at) || "—")}</span></th>
                  <th colspan="2" class="stk-grp">最新庫存 <span class="stk-th2">快照 ${escapeHtml(stkAdminTwTime(sel.latestSource === "warehouse" ? stockMeta.wh_snapshot_at : stockMeta.snapshot_at) || "—")}・已含調整</span></th>
                  <th rowspan="2" class="stk-sep">調整<br><span class="stk-th2">誤差補償</span></th>
                  <th rowspan="2">效期</th>
                </tr>
                <tr>
                  <th class="stk-num stk-sep">系統</th>
                  <th class="stk-num">實盤 <span class="stk-th2">點數字可改</span></th>
                  <th class="stk-num">盤差 <span class="stk-th2">(%)</span></th>
                  <th class="stk-num stk-sep">系統 <span class="stk-th2">快照/調整/加總</span></th>
                  <th class="stk-num">盤差 <span class="stk-th2">(%)</span></th>
                </tr>
              </thead>
              <tbody>${rowsHtml || `<tr><td colspan="9" style="text-align:center;color:#787774;padding:14px;">此單沒有已盤品項</td></tr>`}</tbody>
            </table>
            </div>
          </div>`;
        }
        const body = `
      <style>
        .stk-pill{font-size:12.5px;padding:5px 11px;border-radius:99px;background:var(--notion-card,#fff);border:1px solid var(--notion-border,#e3e2e0);color:#5b616e;}
        .stk-pill b{color:inherit;}
        .stk-pill.warn{background:#fcf3e2;border-color:#e8d5ac;color:#8a5a10;}
        .stk-pill.ok{background:#e7f6ee;border-color:#bfe5cf;color:#1f7a46;}
        .stk-entry{background:var(--notion-card,#fff);border:1px solid var(--notion-border,#e3e2e0);border-radius:12px;padding:13px 16px;margin:0 0 18px;}
        .stk-entry-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;}
        .stk-bigbtn{display:inline-flex;align-items:center;justify-content:center;min-width:185px;height:40px;padding:0 20px;border-radius:9px;background:#2383e2;color:#fff;font-size:14px;font-weight:700;text-decoration:none;}
        .stk-bigbtn.alt{background:var(--notion-card,#fff);color:inherit;border:1px solid var(--notion-border,#e3e2e0);}
        .stk-bigbtn:hover{opacity:.92;text-decoration:none;}
        .stk-ibtn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:99px;border:1px solid var(--notion-border,#e3e2e0);background:var(--notion-card,#fff);color:#9b9a97;cursor:pointer;padding:0;flex:none;}
        .stk-ibtn:hover,.stk-ibtn[aria-expanded="true"]{color:#2383e2;border-color:#2383e2;}
        .stk-ibtn svg{width:14px;height:14px;}
        .stk-infobox{background:rgba(35,131,226,.08);border:1px solid rgba(35,131,226,.25);border-radius:9px;padding:8px 13px;font-size:12.5px;color:#5b616e;margin-top:10px;max-width:88ch;}
        .stk-sect{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;border-top:2px solid var(--notion-border,#e3e2e0);padding-top:14px;margin:0 0 12px;}
        .stk-sect-t{font-size:16px;font-weight:700;margin:0 4px 0 0;}
        .stk-search{font-size:12.5px;color:inherit;background:var(--notion-card,#fff);border:1px solid var(--notion-border,#e3e2e0);border-radius:8px;padding:6px 11px;width:200px;}
        .stk-date{padding:6px 9px;border:1px solid var(--notion-border,#e3e2e0);border-radius:8px;background:var(--notion-card,#fff);color:inherit;}
        .stk-drow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 13px;border-bottom:1px solid var(--notion-border-soft,#f0efed);text-decoration:none;color:#5b616e;font-size:12.5px;}
        .stk-drow:last-child{border-bottom:0;}
        .stk-drow:hover{background:rgba(55,53,47,.03);}
        .stk-drow.on{background:rgba(35,131,226,.12);color:inherit;font-weight:700;box-shadow:inset 3px 0 0 #2383e2;}
        .stk-dn{font-variant-numeric:tabular-nums;}
        .stk-dc{font-size:11px;color:#9b9a97;background:var(--notion-bg,#f7f6f3);border:1px solid var(--notion-border,#e3e2e0);border-radius:99px;padding:0 7px;font-variant-numeric:tabular-nums;}
        .stk-drow.on .stk-dc{background:#2383e2;border-color:#2383e2;color:#fff;}
        .stk-grid{display:grid;grid-template-columns:132px 246px minmax(0,1fr);gap:14px;align-items:start;}
        @media(max-width:1020px){.stk-grid{grid-template-columns:1fr;}}
        .wh-panel{background:var(--notion-card,#fff);border:1px solid var(--notion-border,#e3e2e0);border-radius:12px;overflow:hidden;}
        .wh-panel-h{padding:9px 13px;font-size:11px;font-weight:700;color:#787774;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid var(--notion-border,#e3e2e0);}
        .wh-it{display:block;padding:9px 13px;border-bottom:1px solid var(--notion-border-soft,#f0efed);text-decoration:none;color:inherit;cursor:pointer;}
        .wh-it:last-child{border-bottom:0;}
        .wh-it.on{background:rgba(35,131,226,.14);box-shadow:inset 3px 0 0 #2383e2;}
        .wh-it.idle{opacity:.62;cursor:default;}
        .wh-it:hover:not(.idle):not(.on){background:rgba(55,53,47,.03);}
        .wh-n{font-size:13.5px;font-weight:600;line-height:1.2;}
        .wh-c{margin-left:7px;font-size:11px;color:#9b9a97;font-variant-numeric:tabular-nums;font-weight:400;}
        .wh-co{margin-left:6px;font-size:10px;font-weight:700;color:#2383e2;background:#e8f1fd;padding:1px 6px;border-radius:5px;vertical-align:1px;}
        .wh-m{display:flex;gap:8px;align-items:center;margin-top:3px;font-size:11.5px;color:#787774;font-variant-numeric:tabular-nums;}
        .wh-diff{color:#b3261e;font-weight:600;}
        .wh-ok{color:#1f7a46;font-weight:700;}
        .wh-pend{color:#8a5a10;background:#fcf3e2;padding:1px 7px;border-radius:5px;font-weight:600;}
        .stk-card{background:var(--notion-card,#fff);border:1px solid var(--notion-border,#e3e2e0);border-radius:12px;overflow:hidden;}
        .stk-card-h{padding:10px 14px;border-bottom:1px solid var(--notion-border,#e3e2e0);display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;justify-content:space-between;}
        .stk-card-t b{font-size:15px;}
        .stk-code2{margin-left:8px;font-size:12px;color:#9b9a97;font-variant-numeric:tabular-nums;}
        .stk-card-m{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:#787774;align-items:center;}
        .stk-note{padding:7px 14px;font-size:11.5px;color:#8a5a10;background:#fcf8ee;border-bottom:1px solid var(--notion-border-soft,#f0efed);}
        .stk-note b{color:#6b4a0e;}
        .stk-badge{font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:6px;background:#eef0f3;color:#5b616e;}
        .stk-badge.ok{background:#e7f6ee;color:#1f7a46;}
        .stk-badge.warn{background:#fdecec;color:#b3261e;}
        /* 凍結表頭：外層 stk-tblwrap 是垂直捲動容器（sticky 只在最近的捲動容器內生效——
           舊版只有 overflow-x:auto、不會垂直捲，表頭從來凍不住）。border-collapse 用 separate，
           collapse 模式下 sticky 表頭的框線會留在原位不跟著貼齊。 */
        .stk-tblwrap{overflow:auto;max-height:max(420px,calc(100vh - 230px));}
        /* overflow:visible 蓋掉全域 table{overflow:hidden}（圓角裁切用）——hidden 會讓 table 自己
           變成 sticky 的定位容器，表頭凍不住；圓角由外層 .stk-card 裁切即可。 */
        .stk-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px;overflow:visible;border:0;border-radius:0;}
        .stk-tbl th{position:sticky;top:0;z-index:2;text-align:left;padding:5px 10px;background:var(--notion-bg,#f7f6f3);border-bottom:1px solid var(--notion-border,#e3e2e0);font-size:11px;color:#787774;font-weight:600;}
        .stk-th2{font-size:9.5px;font-weight:500;color:#9b9a97;}
        .stk-tbl td{padding:3px 10px;border-bottom:1px solid var(--notion-border-soft,#f0efed);vertical-align:middle;white-space:nowrap;}
        .stk-name{max-width:230px;overflow:hidden;text-overflow:ellipsis;}
        .stk-tbl tr:last-child td{border-bottom:0;}
        .stk-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
        th.stk-num{text-align:right;}
        .stk-code{font-variant-numeric:tabular-nums;color:#787774;white-space:nowrap;}
        .stk-spec{margin-left:6px;font-size:11px;color:#9b9a97;}
        .stk-exp{font-size:11.5px;color:#8a5a10;max-width:200px;overflow:hidden;text-overflow:ellipsis;}
        .stk-latest{color:#5b616e;}
        .stk-ladj2{margin-left:4px;font-size:10.5px;color:#8250df;font-weight:600;}
        .stk-futb{margin-left:4px;font-size:10px;font-weight:700;color:#0369a1;background:#e0f2fe;border-radius:4px;padding:0 4px;white-space:nowrap;}
        .stk-mid2{margin-left:4px;font-size:10px;font-weight:700;color:#2383e2;background:#e8f1fd;border-radius:4px;padding:0 4px;}
        .stk-editmark{margin-left:3px;font-size:10.5px;color:#8250df;cursor:default;}
        tr.stk-n .stk-diff{color:#b3261e;font-weight:700;}
        tr.stk-p .stk-diff{color:#1f7a46;font-weight:700;}
        tr.stk-z .stk-diff{color:#9b9a97;}
        td.stk-n{color:#b3261e;}
        td.stk-p{color:#1f7a46;}
        td.stk-z{color:#9b9a97;}
        tr.stk-hot{background:rgba(179,38,30,.10);}
        .stk-grp{text-align:center !important;border-left:1px solid var(--notion-border,#e3e2e0);border-bottom:1px solid var(--notion-border-soft,#f0efed);}
        th.stk-sep,td.stk-sep{border-left:1px solid var(--notion-border,#e3e2e0);}
        .stk-tbl thead tr:first-child th{top:0;}
        .stk-tbl thead tr+tr th{top:24px;} /* 後備值；載入後由 JS 量實際第一列高度校正 */
        .stk-togbtn{font-size:12.5px;padding:6px 12px;border-radius:8px;border:1px solid var(--notion-border,#e3e2e0);background:var(--notion-card,#fff);color:#5b616e;cursor:pointer;}
        .stk-togbtn.sm{padding:4px 10px;font-size:11.5px;}
        .stk-togbtn.on{background:#2383e2;border-color:#2383e2;color:#fff;}
        .stk-empty{background:var(--notion-card,#fff);border:1px dashed var(--notion-border,#e3e2e0);border-radius:12px;padding:34px 16px;text-align:center;color:#787774;}
        .stk-adjchip2{display:inline-block;font-size:11px;font-weight:600;color:#9b9a97;background:transparent;border:1px dashed var(--notion-border,#d5d3cf);border-radius:99px;padding:1px 9px;white-space:nowrap;cursor:pointer;}
        .stk-adjchip2:hover{color:#6a3fc0;border-color:#c9b6f0;background:#f7f3fe;}
        .stk-adjchip2.on{color:#8250df;background:#f3eefd;border:1px solid #ddccf8;font-weight:700;}
        .stk-editqty{width:64px;text-align:right;font-variant-numeric:tabular-nums;font-size:12.5px;padding:1px 5px;border:1px solid #2383e2;border-radius:6px;background:var(--notion-card,#fff);color:inherit;}
        .stk-pctp{margin-left:4px;font-size:10.5px;color:#9b9a97;font-weight:400;}
        .stk-ct{cursor:pointer;border-bottom:1px dashed transparent;}
        .stk-ct:hover{color:#2383e2;border-bottom-color:#2383e2;}
        .stk-pop{position:absolute;z-index:1000;background:var(--notion-card,#fff);border:1px solid var(--notion-border,#e3e2e0);border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.14);padding:12px 14px;width:260px;font-size:12.5px;}
        .stk-pop-t{font-weight:700;margin-bottom:2px;}
        .stk-pop-s{color:#787774;font-size:11.5px;margin-bottom:8px;}
        .stk-pop-row{display:flex;align-items:center;gap:6px;margin-bottom:10px;}
        .stk-pop-row input{flex:1;min-width:0;text-align:right;font-variant-numeric:tabular-nums;padding:4px 8px;border:1px solid var(--notion-border,#e3e2e0);border-radius:7px;background:var(--notion-card,#fff);color:inherit;font-size:13px;}
        .stk-pop-b{display:flex;gap:6px;flex-wrap:wrap;}
        .stk-pop-b button{font-size:12px;padding:5px 10px;border-radius:7px;border:1px solid var(--notion-border,#e3e2e0);background:var(--notion-card,#fff);color:#5b616e;cursor:pointer;}
        .stk-pop-b button.pri{background:#8250df;border-color:#8250df;color:#fff;font-weight:600;}
        .stk-pop-b button.del{color:#b3261e;}
        .stk-pop-b button:hover{opacity:.9;}
      </style>
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 盤點</div>
      <h1 class="notion-page-title" style="margin-bottom:10px;">盤點</h1>
      <div class="stk-entry">
        <div class="stk-entry-row">
          <a class="stk-bigbtn" href="/admin/inventory/entry">▶ 開始盤點（網站）</a>
          <a class="stk-bigbtn alt" href="/admin/scan">▶ 掃碼盤點</a>
          <button type="button" class="stk-ibtn" id="stkInfo1" aria-expanded="false" aria-label="盤點方式說明" title="盤點方式說明">${SF_ICONS.info}</button>
          <span style="flex:1"></span>
          <a class="stk-togbtn" href="/admin/inventory/stats" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">${sfInlineIcon("chartLine")} 庫存統計圖表</a>
        </div>
        <div class="stk-infobox" id="stkInfo1Box" hidden>選<b>網站</b>直接輸入數量，或<b>掃碼</b>把手機當 PDA。下面是各倉盤點結果與盤差。</div>
      </div>
      ${(req.query.cok || req.query.adjok) ? `<div style="background:#e7f5e9;color:#2e7d32;padding:8px 12px;border-radius:8px;margin:0 0 12px;font-size:13px;">已更新。</div>` : ""}
      ${(req.query.cerr || req.query.adjerr) ? `<div style="background:#fdecec;color:#b3261e;padding:8px 12px;border-radius:8px;margin:0 0 12px;font-size:13px;">操作失敗：${escapeHtml(String(req.query.cerr || req.query.adjerr))}</div>` : ""}
      <div class="stk-sect">
        <h2 class="stk-sect-t">各倉盤點結果</h2>
        <span class="stk-pill">本日已盤 <b>${day.length}</b> / 納入盤點 <b>${includedWh.length}</b> 倉（${pct(day.length, includedWh.length)}%）</span>
        <span class="stk-pill ${totalDiff ? "warn" : "ok"}">盤差品項 <b>${totalDiff}</b> 項</span>
        ${pendingWh.length ? `<span class="stk-pill warn">未盤：${pendingWh.map((w) => escapeHtml(w.name || w.code)).join("、")}</span>` : (includedWh.length ? `<span class="stk-pill ok">全部倉庫已盤 ✓</span>` : "")}
        <span style="flex:1"></span>
        <input type="search" id="stkQ" class="stk-search" placeholder="搜尋品項（跨倉模糊）…" autocomplete="off">
        <form method="get" action="/admin/inventory" style="display:inline-flex;margin:0;">
          <input type="date" name="date" value="${escapeAttr(date)}" onchange="this.form.submit()" class="stk-date">
          ${selWh ? `<input type="hidden" name="wh" value="${escapeAttr(selWh)}">` : ""}
        </form>
        <select id="stkRefreshIcp" class="sf-input" style="width:auto;padding:4px 8px;font-size:12.5px;" title="要更新哪家公司的庫存（免動整合代理設定）"><option value="">全公司</option>${Object.entries(erp_companies_js_1.ERP_COMPANY_NAMES).map(([c, n]) => `<option value="${c}">${escapeHtml(n)}</option>`).join("")}</select>
        <button type="button" class="stk-togbtn" id="stkRefreshInv">↻ 更新最新庫存</button>
        <a class="stk-togbtn" style="text-decoration:none;" href="/admin/inventory/anomalies?date=${encodeURIComponent(date)}" title="當日盤差品項＋可能原因，可推送 LINE 群組請大家複查">異常排查表</a>
        <a class="stk-togbtn" style="text-decoration:none;" href="/admin/inventory/stocktake.csv?date=${encodeURIComponent(date)}">匯出 CSV</a>
        <label class="sf-switch-label" style="font-size:12.5px;" title="開＝『最新系統』欄標出有未來日期銷貨的品項（藍標「未來+N」，解釋盤差來源）；與目前庫存頁共用同一開關。純提示，不改變盤差計算。"><input type="checkbox" id="stkFutRev"${futOn ? " checked" : ""}><span class="sf-switch"></span>未來銷貨加回</label>
        <span id="stkRefreshMsg" style="font-size:12px;color:#8a5a10;"></span>
      </div>
      <div class="stk-card" id="stkSearchCard" style="display:none;margin-bottom:14px;"></div>
      <div class="stk-grid" id="stkGrid">
        <div class="wh-panel">
          <div class="wh-panel-h">近期盤點日</div>
          ${dateColHtml || `<div class="wh-it idle"><div class="wh-n">尚無盤點</div></div>`}
        </div>
        <div class="wh-panel">
          <div class="wh-panel-h">倉庫（${date}）</div>
          ${whItemsHtml || `<div class="wh-it idle"><div class="wh-n">尚無倉庫</div></div>`}
        </div>
        <div>${rightHtml}</div>
      </div>
      <script>
      (function(){
        // ⓘ 說明開合（入口說明＋盤差計算說明）
        function infoWire(btnId,boxId){ var b=document.getElementById(btnId),x=document.getElementById(boxId); if(!b||!x)return; b.addEventListener('click',function(){ var open=x.hidden; x.hidden=!open; b.setAttribute('aria-expanded',String(open)); }); }
        infoWire('stkInfo1','stkInfo1Box'); infoWire('stkInfo2','stkInfo2Box');
        // 凍結表頭：第二列表頭的 sticky top ＝ 第一列實際高度（CSS 的 24px 只是後備值，字級/縮放不同會對不齊）
        function stkStickyFix(){
          Array.prototype.forEach.call(document.querySelectorAll('.stk-tblwrap table thead'),function(th){
            if(th.rows.length<2) return;
            var h=th.rows[0].getBoundingClientRect().height;
            if(h>0) Array.prototype.forEach.call(th.rows[1].cells,function(c){ c.style.top=h+'px'; });
          });
        }
        stkStickyFix(); window.addEventListener('resize',stkStickyFix);
        // 跨倉品項搜尋：當日所有倉的已盤品項，模糊比對品名/料號/規格；輸入時蓋掉下方三欄、清空還原
        var SDATA=${searchJson};
        var sq=document.getElementById('stkQ'), sc=document.getElementById('stkSearchCard'), grid=document.getElementById('stkGrid');
        function escH(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
        if(sq&&sc&&grid){ sq.addEventListener('input',function(){
          var q=sq.value.trim().toLowerCase();
          if(!q){ sc.style.display='none'; grid.style.display=''; return; }
          var rows=[];
          SDATA.forEach(function(w){ w.items.forEach(function(it){ if(((it.c||'')+' '+(it.n||'')+' '+(it.s||'')).toLowerCase().indexOf(q)>=0) rows.push({w:w,it:it}); }); });
          var dateVal=(document.querySelector('.stk-date')||{}).value||'';
          var h='<div class="stk-card-h"><div class="stk-card-t"><b>搜尋「'+escH(sq.value.trim())+'」</b><span class="stk-code2">當日已盤品項中符合 '+rows.length+' 筆</span></div></div>';
          h+='<div class="stk-tblwrap"><table class="stk-tbl"><thead><tr><th>料號</th><th>品名</th><th>公司</th><th>倉庫</th><th class="stk-num">系統(當下)</th><th class="stk-num">實盤</th><th class="stk-num">盤差</th><th></th></tr></thead><tbody>';
          if(rows.length){ rows.slice(0,80).forEach(function(r){ var d=r.it.d;
            h+='<tr'+(d?' class="'+(d<0?'stk-n':'stk-p')+'"':'')+'><td class="stk-code">'+escH(r.it.c)+'</td><td>'+escH(r.it.n)+(r.it.s?'<span class="stk-spec">'+escH(r.it.s)+'</span>':'')+'</td><td>'+escH(r.w.co)+'</td><td>'+escH(r.w.whName)+'</td><td class="stk-num">'+(r.it.sys==null?'—':r.it.sys)+'</td><td class="stk-num">'+(r.it.ct==null?'—':r.it.ct)+'</td><td class="stk-num stk-diff">'+(d==null?'—':(d>0?'+':'')+d)+'</td><td><a href="/admin/inventory?date='+encodeURIComponent(dateVal)+'&wh='+encodeURIComponent(r.w.key)+'" style="font-size:12px;">到該倉 →</a></td></tr>'; }); }
          else h+='<tr><td colspan="8" style="text-align:center;color:#787774;padding:14px;">當日已盤品項中找不到「'+escH(sq.value.trim())+'」（未盤到的品項不在此清單）</td></tr>';
          h+='</tbody></table></div>'+(rows.length>80?'<div style="padding:6px 14px;font-size:12px;color:#9b9a97;">僅顯示前 80 筆，請縮小關鍵字。</div>':'');
          sc.innerHTML=h; sc.style.display=''; grid.style.display='none';
        }); }
        var btn=document.getElementById('stkOnlyDiff');
        if(btn){ btn.addEventListener('change',function(){
          var on=btn.checked;
          var rows=document.querySelectorAll('tr[data-diff]');
          Array.prototype.forEach.call(rows,function(tr){ tr.style.display=(on&&tr.getAttribute('data-diff')==='0')?'none':''; });
        }); }
        // 更新最新庫存：觸發內網代理拉一次凌越，成功後重載頁面（對最新盤差就會更新）
        var rb=document.getElementById('stkRefreshInv'), msg=document.getElementById('stkRefreshMsg');
        var icpSel=document.getElementById('stkRefreshIcp');
        if(rb){ rb.addEventListener('click',function(){
          rb.disabled=true;
          var icp=(icpSel&&icpSel.value)||'';
          msg.textContent='已送出更新請求'+(icp?('（'+icpSel.options[icpSel.selectedIndex].text+'）'):'（全公司）')+'，等待內網代理刷新…';
          var baseline='', clickAt=new Date().toISOString();
          fetch('/admin/inventory/stock/status').then(function(r){return r.json();}).then(function(m){ baseline=m.snapshot_at||''; return fetch('/admin/inventory/stock/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({icpno:icp})}); }).then(function(){
            var tries=0; var iv=setInterval(function(){
              tries++;
              fetch('/admin/inventory/stock/status').then(function(r){return r.json();}).then(function(m){
                if(m.snapshot_at&&m.snapshot_at!==baseline){ clearInterval(iv); msg.style.color='#1f7a46'; msg.textContent='已更新，重新載入…'; setTimeout(function(){ location.reload(); },500); return; }
                if(m.refresh_error&&m.refresh_error_at&&m.refresh_error_at>=clickAt){ clearInterval(iv); rb.disabled=false; msg.style.color='#b3261e'; msg.textContent='更新失敗：'+m.refresh_error; return; }
                if(tries>=24){ clearInterval(iv); rb.disabled=false; msg.style.color='#b3261e'; msg.textContent='等待逾時：可能凌越連線異常或代理未執行。'; }
              }).catch(function(){});
            },3000);
          }).catch(function(){ rb.disabled=false; msg.style.color='#b3261e'; msg.textContent='送出失敗，請稍後再試。'; });
        }); }
        // 未來銷貨加回開關（與目前庫存頁共用全域設定 stock_future_reversal_enabled）
        var fr=document.getElementById('stkFutRev');
        if(fr){ fr.addEventListener('change',function(){ var on=fr.checked; fr.disabled=true;
          fetch('/admin/inventory/stock/future-toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({on:on})})
            .then(function(r){return r.json();}).then(function(){ location.reload(); })
            .catch(function(){ fr.disabled=false; fr.checked=!on; });
        }); }
        // 卡片常數（調整面板/複盤共用）＋動態表單送出（欄位與舊 inline form 相同）
        var card=document.getElementById('stkCard');
        var CTX=card?{icp:card.getAttribute('data-icp')||'00',wh:card.getAttribute('data-wh')||'',sid:card.getAttribute('data-sid')||'',back:card.getAttribute('data-back')||''}:null;
        function postForm(action,fields){
          var f=document.createElement('form'); f.method='post'; f.action=action; f.style.display='none';
          Object.keys(fields).forEach(function(k){ var i=document.createElement('input'); i.type='hidden'; i.name=k; i.value=fields[k]==null?'':String(fields[k]); f.appendChild(i); });
          document.body.appendChild(f); f.submit();
        }
        // 調整面板：點「調整／調 +N」標籤開啟（全頁共用一個浮動面板）
        var pop=null;
        function closePop(){ if(pop){ pop.remove(); pop=null; document.removeEventListener('mousedown',outPop,true); } }
        function outPop(e){ if(pop&&!pop.contains(e.target)) closePop(); }
        function openPop(btn){
          if(!CTX) return; closePop();
          var d=btn.dataset; var counted=d.counted===''?null:Number(d.counted); var adj=Number(d.adj||0); var base=d.base===''?null:Number(d.base);
          var applyV=(counted!=null&&base!=null)?Math.round((counted-base)*100)/100:null;
          pop=document.createElement('div'); pop.className='stk-pop';
          pop.innerHTML='<div class="stk-pop-t">'+escH(d.code)+' '+escH(d.name)+'</div>'
            +'<div class="stk-pop-s">凌越 '+(base==null?'—':base)+'｜實盤 '+(counted==null?'—':counted)+(adj?('｜現調 '+(adj>0?'+':'')+adj):'')+'</div>'
            +'<div class="stk-pop-row"><span>調整值</span><input type="number" step="any" id="stkPopD" value="'+(adj||(applyV==null?'':applyV))+'"></div>'
            +'<div class="stk-pop-b">'
            +(counted!=null?'<button type="button" class="pri" id="stkPopApply" title="讓最新系統＝此次實盤">套用實盤'+(applyV!=null?('（'+(applyV>0?'+':'')+applyV+'）'):'')+'</button>':'')
            +'<button type="button" id="stkPopSave" title="以上面填的調整值儲存">儲存</button>'
            +(adj?'<button type="button" class="del" id="stkPopDel">刪除</button>':'')
            +'<button type="button" id="stkPopX">關閉</button></div>';
          document.body.appendChild(pop);
          var r=btn.getBoundingClientRect();
          var left=Math.min(window.scrollX+r.left, window.scrollX+document.documentElement.clientWidth-278);
          pop.style.top=(window.scrollY+r.bottom+6)+'px'; pop.style.left=Math.max(8,left)+'px';
          var common={icpno:CTX.icp,erp_code:d.code,wh_code:CTX.wh,back:CTX.back,name:d.name,spec:d.spec,unit:d.unit};
          var ap=pop.querySelector('#stkPopApply');
          if(ap) ap.addEventListener('click',function(){ postForm('/admin/inventory/adjustments',Object.assign({action:'set_from_count',counted:counted},common)); });
          pop.querySelector('#stkPopSave').addEventListener('click',function(){
            var v=Number(pop.querySelector('#stkPopD').value);
            if(!isFinite(v)){ alert('調整值要是數字'); return; }
            postForm('/admin/inventory/adjustments',Object.assign({action:'update',delta:v},common));
          });
          var dl=pop.querySelector('#stkPopDel');
          if(dl) dl.addEventListener('click',function(){ if(confirm('刪除 '+d.code+' 的庫存調整？')) postForm('/admin/inventory/adjustments',Object.assign({action:'delete'},common)); });
          pop.querySelector('#stkPopX').addEventListener('click',closePop);
          setTimeout(function(){ document.addEventListener('mousedown',outPop,true); },0);
        }
        Array.prototype.forEach.call(document.querySelectorAll('.stk-adjchip2'),function(b){ b.addEventListener('click',function(e){ e.stopPropagation(); openPop(b); }); });
        // 複盤：點實盤數字原地改（Enter 送出、Esc/失焦取消；confirm＋修改軌跡不變）
        Array.prototype.forEach.call(document.querySelectorAll('.stk-ct'),function(sp){
          function startEdit(){
            if(!CTX||sp.getAttribute('data-editing')) return;
            sp.setAttribute('data-editing','1');
            var old=sp.getAttribute('data-counted');
            var inp=document.createElement('input'); inp.type='number'; inp.step='any'; inp.value=old; inp.className='stk-editqty';
            sp.textContent=''; sp.appendChild(inp); inp.focus(); inp.select();
            function cancel(){ if(!sp.getAttribute('data-editing')) return; sp.removeAttribute('data-editing'); sp.textContent=(old===''?'—':old); }
            inp.addEventListener('keydown',function(ev){
              if(ev.key==='Enter'){ ev.preventDefault();
                var v=inp.value.trim();
                if(v===''||!isFinite(Number(v))){ alert('請輸入數字'); return; }
                if(confirm('複盤修正 '+sp.getAttribute('data-code')+'：實盤改為 '+v+'？（會留下修改軌跡）')){
                  sp.removeAttribute('data-editing');
                  postForm('/admin/inventory/count-edit',{session_id:CTX.sid,erp_code:sp.getAttribute('data-code'),counted:v,back:CTX.back});
                } else { cancel(); }
              }
              if(ev.key==='Escape'){ cancel(); }
            });
            // blur 不再靜默丟輸入：值有改動時比照 Enter 流程確認送出（打完數字順手點旁邊／手機收鍵盤都算 blur）
            inp.addEventListener('blur',function(){ setTimeout(function(){
              if(!sp.getAttribute('data-editing')) return;
              var v=inp.value.trim();
              if(v===''||v===old||!isFinite(Number(v))){ cancel(); return; }
              if(confirm('複盤修正 '+sp.getAttribute('data-code')+'：實盤改為 '+v+'？（會留下修改軌跡；取消＝放棄修改）')){
                sp.removeAttribute('data-editing');
                postForm('/admin/inventory/count-edit',{session_id:CTX.sid,erp_code:sp.getAttribute('data-code'),counted:v,back:CTX.back});
              } else { cancel(); }
            },150); });
          }
          sp.addEventListener('click',startEdit);
          sp.addEventListener('keydown',function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); startEdit(); } });
        });
      })();
      </script>`;
        res.type("text/html").send(notionPage("每日盤點", body, "inventory", res));
    });
    // ── 庫存調整（彌補凌越系統誤差，免重整）：每公司每料號一個總調整值 delta。
    //    顯示庫存＝凌越快照 + delta；盤差「最新系統」也加 delta（校正後對最新盤差歸零）。只影響內部顯示，不寫回凌越。──
    router.post("/inventory/adjustments", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const icpno = (0, erp_companies_js_1.normIcpno)(req.body && req.body.icpno);
        const back = String(req.body?.back || "").replace(/[^\w=&%:.\-]/g, "");
        const dest = back === "mgmt" ? ("/admin/inventory/adjustments?icpno=" + encodeURIComponent(icpno)) : ("/admin/inventory" + (back ? ("?" + back) : ""));
        const done = (extra) => res.redirect(dest + (extra ? ((dest.indexOf("?") >= 0 ? "&" : "?") + extra) : ""));
        try {
            const action = String(req.body?.action || "").trim();
            const erpCode = String(req.body?.erp_code || "").trim();
            if (!erpCode) { done("adjerr=" + encodeURIComponent("缺少料號")); return; }
            const now = new Date().toISOString();
            const who = String(res.locals.adminUser || req.adminUsername || "");
            const createdBy = "admin:" + String(req.adminUsername || "");
            // [fix 2026-07-18 稽核] 庫存調整直接影響顯示庫存與盤差，異動須留軌跡（誰/何時/舊值新值）。
            const adjSnap = (r) => (r ? { delta: r.delta, base_qty: r.base_qty, counted_qty: r.counted_qty, note: r.note } : null);
            const auditAdj = async (act, before, after, extra) => {
                try {
                    await logDataChange(req, {
                        entityType: "stock_adjustment",
                        entityId: icpno + ":" + erpCode,
                        action: act,
                        summary: `庫存調整 ${act} ${erpCode}（公司 ${icpno}）` + (extra ? "：" + extra : ""),
                        meta: { icpno, erpCode, before: before ?? null, after: after ?? null },
                    });
                }
                catch (e) { console.warn("[admin] 庫存調整稽核寫入失敗（不阻斷）:", e?.message || e); }
            };
            if (action === "delete") {
                const before = await db.prepare("SELECT * FROM stock_adjustment WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code = ?").get(icpno, erpCode);
                await db.prepare("DELETE FROM stock_adjustment WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code = ?").run(icpno, erpCode);
                if (before) await auditAdj("delete", adjSnap(before), null, `刪除（原 delta ${before.delta}）`);
                done("adjok=1"); return;
            }
            const cur = await db.prepare("SELECT * FROM stock_adjustment WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code = ?").get(icpno, erpCode);
            const stock = await db.prepare("SELECT name, spec, unit, qty FROM erp_stock_items WHERE erp_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").get(erpCode, icpno);
            let delta, baseQty, countedQty, name, spec, unit, note;
            if (action === "set_from_count") {
                const counted = Number(req.body?.counted);
                if (!Number.isFinite(counted)) { done("adjerr=" + encodeURIComponent("實盤數無效")); return; }
                // [fix 2026-07-17] delta 基準改與盤差表「最新系統」同一套：該倉有分倉列→用分倉量
                // （品項無列＝0），整倉無分倉資料才退回公司總量。舊版一律用公司總量，品項跨倉
                // （尤其他倉有負庫存）時會算錯：分倉 13.7、總量 -1.2、實盤 16.8 → 誤存 +18（正確 +3.1）。
                baseQty = stock ? Number(stock.qty || 0) : 0; // 後備：公司總量
                const whCodeAdj = String(req.body?.wh_code || "").trim();
                if (whCodeAdj) {
                    try {
                        const whAny = await db.prepare("SELECT 1 AS x FROM erp_stock_wh_qty WHERE wh_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ? LIMIT 1").get(whCodeAdj, icpno);
                        if (whAny) {
                            const hit = await db.prepare("SELECT qty FROM erp_stock_wh_qty WHERE wh_code = ? AND erp_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").get(whCodeAdj, erpCode, icpno);
                            baseQty = hit ? Number(hit.qty || 0) : 0;
                        }
                    } catch (_) { /* 分倉查詢失敗→沿用總量基準（與顯示端 fallback 規則一致） */ }
                }
                delta = Math.round((counted - baseQty) * 100) / 100; // 讓「最新系統」＝實盤
                countedQty = counted;
                name = String(req.body?.name || (stock && stock.name) || (cur && cur.name) || "");
                spec = String(req.body?.spec || (stock && stock.spec) || (cur && cur.spec) || "");
                unit = String(req.body?.unit || (stock && stock.unit) || (cur && cur.unit) || "");
                note = cur ? cur.note : null;
                if (delta === 0) { // 實盤與系統一致→不需調整；原本有的話移除
                    await db.prepare("DELETE FROM stock_adjustment WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code = ?").run(icpno, erpCode);
                    if (cur) await auditAdj("delete", adjSnap(cur), null, "套用實盤後與系統一致，移除調整");
                    done("adjok=1"); return;
                }
            }
            else if (action === "update") {
                const d = Number(req.body?.delta);
                if (!Number.isFinite(d)) { done("adjerr=" + encodeURIComponent("調整值無效（要是數字）")); return; }
                delta = Math.round(d * 100) / 100;
                baseQty = cur ? cur.base_qty : (stock ? Number(stock.qty || 0) : null);
                countedQty = cur ? cur.counted_qty : null;
                name = String((cur && cur.name) || (stock && stock.name) || "");
                spec = String((cur && cur.spec) || (stock && stock.spec) || "");
                unit = String((cur && cur.unit) || (stock && stock.unit) || "");
                note = req.body?.note != null ? String(req.body.note).slice(0, 200) : (cur ? cur.note : null);
                if (delta === 0) { await db.prepare("DELETE FROM stock_adjustment WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code = ?").run(icpno, erpCode); if (cur) await auditAdj("delete", adjSnap(cur), null, "調整值歸零，移除調整"); done("adjok=1"); return; }
            }
            else { done("adjerr=" + encodeURIComponent("未知動作")); return; }
            const createdAt = (cur && cur.created_at) ? cur.created_at : now;
            const createdByKeep = (cur && cur.created_by) ? cur.created_by : createdBy;
            const createdByNameKeep = (cur && cur.created_by_name) ? cur.created_by_name : who;
            const isPg = Boolean(process.env.DATABASE_URL);
            if (isPg) {
                await db.prepare("INSERT INTO stock_adjustment (icpno, erp_code, delta, name, spec, unit, base_qty, counted_qty, note, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (icpno, erp_code) DO UPDATE SET delta = EXCLUDED.delta, name = EXCLUDED.name, spec = EXCLUDED.spec, unit = EXCLUDED.unit, base_qty = EXCLUDED.base_qty, counted_qty = EXCLUDED.counted_qty, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at").run(icpno, erpCode, delta, name, spec, unit, baseQty, countedQty, note, createdByKeep, createdByNameKeep, createdAt, now);
            } else {
                await db.prepare("INSERT OR REPLACE INTO stock_adjustment (icpno, erp_code, delta, name, spec, unit, base_qty, counted_qty, note, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(icpno, erpCode, delta, name, spec, unit, baseQty, countedQty, note, createdByKeep, createdByNameKeep, createdAt, now);
            }
            await auditAdj(cur ? "update" : "create", adjSnap(cur), { delta, base_qty: baseQty, counted_qty: countedQty, note }, `delta ${cur ? (cur.delta + " → ") : ""}${delta}`);
            done("adjok=1");
        }
        catch (e) {
            console.error("[admin] adjustments save", e?.message || e);
            done("adjerr=" + encodeURIComponent(String(e?.message || e).slice(0, 120)));
        }
    });
    router.get("/inventory/adjustments", async (req, res) => {
        const icpno = stickyIcpno(req, res, "02");
        const companies = await listStockCompanies();
        if (companies.indexOf(icpno) < 0) companies.push(icpno);
        companies.sort();
        let rows = [];
        try {
            rows = (await db.prepare(
                "SELECT a.erp_code, a.delta, a.base_qty, a.counted_qty, a.note, a.created_by_name, a.updated_at, i.name, i.spec, i.unit, i.qty AS cur_qty " +
                "FROM stock_adjustment a LEFT JOIN erp_stock_items i ON i.erp_code = a.erp_code AND COALESCE(NULLIF(TRIM(i.icpno),''),'00') = COALESCE(NULLIF(TRIM(a.icpno),''),'00') " +
                "WHERE COALESCE(NULLIF(TRIM(a.icpno),''),'00') = ? ORDER BY a.erp_code").all(icpno)) || [];
        } catch (e) { console.error("[admin] adjustments list", e?.message || e); rows = []; }
        const coSeg = companies.length > 1 ? `<div class="sf-seg" style="margin:0 0 14px;display:inline-flex;">${companies.map((c) => `<button type="button" class="${c === icpno ? "active" : ""}" onclick="location.href='/admin/inventory/adjustments?icpno=${c}'">${escapeHtml((0, erp_companies_js_1.erpCompanyName)(c))}</button>`).join("")}</div>` : "";
        const banner = req.query.adjok ? `<div style="background:#e7f5e9;color:#2e7d32;padding:10px 12px;border-radius:8px;margin-bottom:12px;">已儲存。</div>` : (req.query.adjerr ? `<div style="background:#fdecec;color:#b3261e;padding:10px 12px;border-radius:8px;margin-bottom:12px;">操作失敗：${escapeHtml(String(req.query.adjerr))}</div>` : "");
        const n2 = (v) => (v == null ? "—" : String(Math.round(Number(v) * 100) / 100));
        const rowsHtml = rows.map((r) => {
            const hasStock = r.name != null;
            const rawq = Number(r.cur_qty || 0);
            const shown = hasStock ? Math.round((rawq + Number(r.delta || 0)) * 100) / 100 : null;
            return `
      <tr>
        <td style="font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600;">${escapeHtml(String(r.erp_code))}</td>
        <td>${escapeHtml(String(r.name || "（庫存快照查無此料號）"))}${r.spec ? `<span style="margin-left:6px;font-size:11px;color:var(--notion-text-muted,#9b9a97);">${escapeHtml(String(r.spec))}</span>` : ""}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;">${hasStock ? n2(rawq) : "—"}</td>
        <td style="text-align:center;">
          <form method="post" action="/admin/inventory/adjustments" style="display:inline-flex;align-items:center;gap:6px;">
            <input type="hidden" name="action" value="update"><input type="hidden" name="icpno" value="${escapeAttr(icpno)}"><input type="hidden" name="erp_code" value="${escapeAttr(String(r.erp_code))}"><input type="hidden" name="back" value="mgmt">
            <input type="number" name="delta" value="${escapeAttr(n2(r.delta))}" step="any" class="sf-input" style="width:92px;text-align:right;">
            <button type="submit" class="btn" style="font-size:12px;padding:4px 10px;">存</button>
          </form>
        </td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:#8250df;">${shown == null ? "—" : n2(shown)}</td>
        <td style="font-size:12px;color:var(--notion-text-muted,#9b9a97);white-space:nowrap;">${escapeHtml(String(r.created_by_name || "—"))}</td>
        <td style="text-align:center;">
          <form method="post" action="/admin/inventory/adjustments" onsubmit="return confirm('刪除 ${escapeAttr(String(r.erp_code))} 的庫存調整？');" style="display:inline;">
            <input type="hidden" name="action" value="delete"><input type="hidden" name="icpno" value="${escapeAttr(icpno)}"><input type="hidden" name="erp_code" value="${escapeAttr(String(r.erp_code))}"><input type="hidden" name="back" value="mgmt">
            <button type="submit" class="btn" style="font-size:12px;padding:4px 10px;color:#b3261e;">刪除</button>
          </form>
        </td>
      </tr>`;
        }).join("");
        const emptyRow = `<tr><td colspan="7" style="text-align:center;color:var(--notion-text-muted,#9b9a97);padding:22px;">此公司尚無庫存調整。到「每日盤點」的盤差表，對有誤差的品項點「調整」標籤，在浮動面板按「套用實盤」即可。</td></tr>`;
        const body = `
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 庫存調整</div>
      <h1 class="notion-page-title">庫存調整</h1>
      <p class="notion-hint" style="margin:-2px 0 14px;">彌補凌越系統誤差用（免重整）。<b>顯示庫存＝凌越快照 ＋ 調整值</b>；每日盤點的「最新系統／對最新盤差」也會加上調整值（校正後盤差歸零）。<b>只影響我們內部顯示與盤差，不會寫回凌越</b>。建立方式：到<a href="/admin/inventory">每日盤點</a>盤差表點「調整」標籤，在浮動面板按「套用實盤」；日後凌越重整/校正好了，記得回這裡<b>刪除</b>對應調整，避免雙重補償。</p>
      ${coSeg}
      ${banner}
      <div class="notion-card" style="padding:0;overflow:auto;">
        <table>
          <thead><tr><th>料號</th><th>品名</th><th style="text-align:right;">凌越量</th><th style="text-align:center;">調整值</th><th style="text-align:right;">顯示量</th><th>建立者</th><th style="text-align:center;">操作</th></tr></thead>
          <tbody>${rowsHtml || emptyRow}</tbody>
        </table>
      </div>`;
        res.type("text/html").send(notionPage("庫存調整", body, "inv-adjust", res));
    });
    // 複盤：每日盤點頁直接改實盤數 → 更新 stocktake_count.counted_qty ＋ 寫修改軌跡 stocktake_count_audit。
    router.post("/inventory/count-edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const back = String(req.body?.back || "").replace(/[^\w=&%:.\-]/g, "");
        const dest = "/admin/inventory" + (back ? ("?" + back) : "");
        const done = (extra) => res.redirect(dest + (extra ? ((dest.indexOf("?") >= 0 ? "&" : "?") + extra) : ""));
        try {
            const sessionId = String(req.body?.session_id || "").trim();
            const erpCode = String(req.body?.erp_code || "").trim();
            if (!sessionId || !erpCode) { done("cerr=" + encodeURIComponent("缺少場次或料號")); return; }
            const nv = Number(req.body?.counted);
            if (!Number.isFinite(nv) || nv < 0) { done("cerr=" + encodeURIComponent("實盤數無效（要 0 或正數）")); return; }
            const newCounted = Math.round(nv * 100) / 100;
            const row = await db.prepare("SELECT c.counted_qty, c.mid_qty, c.name, s.icpno, s.wh_code, s.count_date FROM stocktake_count c JOIN stocktake_session s ON s.id = c.session_id WHERE c.session_id = ? AND c.erp_code = ?").get(sessionId, erpCode);
            if (!row) { done("cerr=" + encodeURIComponent("查無此盤點列")); return; }
            const oldCounted = (row.counted_qty == null || row.counted_qty === "") ? null : Number(row.counted_qty);
            if (oldCounted != null && Math.abs(oldCounted - newCounted) < 1e-9) { done("cok=1"); return; } // 沒變就不寫軌跡
            const now = new Date().toISOString();
            const who = String(res.locals.adminUser || req.adminUsername || "");
            const actor = "admin:" + String(req.adminUsername || "");
            const { newId } = require("../lib/id.js");
            // counted_qty 語意＝上＋中合計：新合計小於既有中貨時把 mid 壓到新合計（比照掃碼頁），
            // 否則續盤頁還原 good=合計−mid 會變負數，被送出驗證擋下、整倉卡住無法重送。
            const oldMid = Number(row.mid_qty || 0);
            const newMid = oldMid > newCounted ? newCounted : oldMid;
            await db.prepare("UPDATE stocktake_count SET counted_qty = ?, mid_qty = ?, edited_at = ?, edited_by = ?, edited_by_name = ? WHERE session_id = ? AND erp_code = ?").run(newCounted, newMid > 0 ? newMid : (row.mid_qty == null ? null : newMid), now, actor, who, sessionId, erpCode);
            await db.prepare("INSERT INTO stocktake_count_audit (id, session_id, icpno, wh_code, count_date, erp_code, name, old_counted, new_counted, actor, actor_name, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run(newId("stca"), sessionId, (0, erp_companies_js_1.normIcpno)(row.icpno), String(row.wh_code || ""), String(row.count_date || ""), erpCode, String(row.name || ""), oldCounted, newCounted, actor, who, "複盤修正", now);
            done("cok=1");
        }
        catch (e) {
            console.error("[admin] count-edit", e?.message || e);
            done("cerr=" + encodeURIComponent(String(e?.message || e).slice(0, 120)));
        }
    });
    router.get("/inventory/stocktake.csv", async (req, res) => {
        const qd = String(req.query.date || "").trim();
        const date = /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : stkAdminTaipeiDate();
        const latestMapCsv = {};
        try { (await db.prepare("SELECT erp_code, qty, icpno FROM erp_stock_items").all() || []).forEach((r) => { latestMapCsv[(0, erp_companies_js_1.normIcpno)(r.icpno) + "|" + String(r.erp_code)] = Number(r.qty || 0); }); } catch (_) {}
        const adjMapCsv = {};
        try { (await db.prepare("SELECT erp_code, delta, icpno FROM stock_adjustment").all() || []).forEach((r) => { adjMapCsv[(0, erp_companies_js_1.normIcpno)(r.icpno) + "|" + String(r.erp_code)] = Number(r.delta || 0); }); } catch (_) {}
        const day = await loadStocktakeDay(date, latestMapCsv, adjMapCsv);
        const q = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
        const lines = ["日期,倉別,倉名,料號,品名,規格,單位,系統量(盤點當下),實盤量(含中),其中中貨,盤差(對當下),盤差%,最新系統量(凌越),調整值,最新系統量(加總),最新系統基準,對最新盤差,效期明細,盤點人,送出時間"];
        for (const { session: s, items, latestSource } of day) {
            const baseTxt = latestSource === "warehouse" ? "分倉" : "總量";
            for (const it of items) {
                const dp = it.diff == null ? "" : ((it.diff / Math.max(Math.abs(Number(it.sys) || 0), 1)) * 100).toFixed(1) + "%";
                const exp = (it.expiry || []).filter((b) => b && (b.date || b.qty)).map((b) => `${b.date || "?"}x${b.qty || "?"}`).join(" / ");
                lines.push([date, s.wh_code, s.wh_name, it.code, it.name, it.spec, it.unit, it.sys, it.counted == null ? "" : it.counted, it.mid == null ? "" : it.mid, it.diff == null ? "" : it.diff, dp, it.latestRaw == null ? "" : it.latestRaw, it.adj || "", it.latest == null ? "" : it.latest, baseTxt, it.diffLatest == null ? "" : it.diffLatest, exp, s.created_by_name || "", stkAdminTwTime(s.submitted_at)].map(q).join(","));
            }
        }
        res.setHeader("Content-Disposition", `attachment; filename="stocktake-${date}.csv"`);
        res.type("text/csv").send("﻿" + lines.join("\r\n"));
    });
    // ============================================================
    // 盤點異常排查表（2026-07-17）：當日「對最新盤差≠0」品項＋依訊號自動列可能原因，
    // 可勾選後推送 LINE 群組請大家複查。原因訊號：盤差方向（實盤偏多/偏少）、
    // 跨倉持有（分倉表他倉有量）、他倉負庫存、已掛庫存調整。純提示不寫任何帳。
    // ============================================================
    function anomalyCauses(it, others) {
        const c = [];
        if (it.diffLatest > 0) {
            c.push("進貨已到、進貨單未入帳", "銷貨單先開但貨未出", "銷退回倉、銷退單未入", "盤點多計（單位/箱散/重複掃）");
        } else {
            c.push("貨已出、銷貨單未入帳", "進貨單已入但貨未到/短交", "報廢耗損未入單", "盤點漏盤（其他存放位置）");
        }
        if (others.length) {
            c.push("跨倉持有（" + others.map((o) => o.wh + "：" + o.qty).join("、") + "）→ 查調撥單/是否記錯倉");
            if (others.some((o) => o.qty < 0)) c.push("他倉帳面為負 → 出貨/進貨單很可能開錯倉");
        }
        if (it.adj) c.push("已掛庫存調整 " + (it.adj > 0 ? "+" : "") + it.adj + " → 確認是否與新誤差重複補償");
        return c;
    }
    // 群組訊息文字（頁面預覽/複製與 LINE 推送共用同一份；依使用者要求「不含排查原因」，原因只留網頁表格）
    const anomN2 = (v) => (v == null ? "—" : String(Math.round(Number(v) * 100) / 100));
    const anomSysTxt = (a) => (a.it.adj ? `帳${anomN2(a.it.latestRaw)} 調${a.it.adj > 0 ? "+" : ""}${a.it.adj}＝${anomN2(a.it.latest)}` : `帳${anomN2(a.it.latest)}`);
    const anomItemTxt = (a) => `${a.it.name}${a.it.spec ? "（" + a.it.spec + "）" : ""} ${a.it.code}\n　${anomSysTxt(a)}｜實盤${anomN2(a.it.counted)}｜差${a.it.diffLatest > 0 ? "+" : ""}${anomN2(a.it.diffLatest)}（${a.pct > 0 ? "+" : ""}${a.pct}%）`;
    const anomWhTag = (a) => `【${a.icp === "00" ? "" : a.co + "｜"}${a.whName || a.wh} ${a.wh}】`;
    // 當日異常清單（GET 頁與 POST 送出共用同一權威，避免送出內容與畫面分岔）
    async function loadStocktakeAnomalies(date) {
        const latestMap = {};
        try { (await db.prepare("SELECT erp_code, qty, icpno FROM erp_stock_items").all() || []).forEach((r) => { latestMap[(0, erp_companies_js_1.normIcpno)(r.icpno) + "|" + String(r.erp_code)] = Number(r.qty || 0); }); } catch (_) { }
        const adjMap = {};
        try { (await db.prepare("SELECT erp_code, delta, icpno FROM stock_adjustment").all() || []).forEach((r) => { adjMap[(0, erp_companies_js_1.normIcpno)(r.icpno) + "|" + String(r.erp_code)] = Number(r.delta || 0); }); } catch (_) { }
        const day = await loadStocktakeDay(date, latestMap, adjMap);
        const xwhCache = {};
        const getXwh = async (icp) => {
            if (xwhCache[icp]) return xwhCache[icp];
            const m = {};
            try {
                for (const r of (await db.prepare("SELECT erp_code, wh_code, qty FROM erp_stock_wh_qty WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icp)) || [])
                    (m[String(r.erp_code)] = m[String(r.erp_code)] || []).push({ wh: String(r.wh_code), qty: Number(r.qty || 0) });
            } catch (_) { /* 無分倉資料＝略過跨倉訊號 */ }
            xwhCache[icp] = m;
            return m;
        };
        const list = [];
        for (const x of day) {
            const icp = (0, erp_companies_js_1.normIcpno)(x.session.icpno);
            const xm = await getXwh(icp);
            for (const it of x.items) {
                if (it.diffLatest == null || it.diffLatest === 0) continue;
                const others = (xm[it.code] || []).filter((w) => w.wh !== String(x.session.wh_code || "") && w.qty !== 0);
                const pct = Math.round((it.diffLatest / Math.max(Math.abs(it.latest || 0), 1)) * 1000) / 10;
                list.push({ key: icp + ":" + String(x.session.wh_code || "") + ":" + it.code, icp, co: (0, erp_companies_js_1.erpCompanyName)(icp), wh: String(x.session.wh_code || ""), whName: String(x.session.wh_name || ""), it, pct, causes: anomalyCauses(it, others) });
            }
        }
        list.sort((a, b) => Math.abs(b.pct || 0) - Math.abs(a.pct || 0));
        return list;
    }
    router.get("/inventory/anomalies", async (req, res) => {
        const qd = String(req.query.date || "").trim();
        const date = /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : stkAdminTaipeiDate();
        const list = await loadStocktakeAnomalies(date);
        let groups = [];
        try { groups = (await db.prepare("SELECT group_id, group_name FROM stocktake_group ORDER BY group_name").all()) || []; } catch (_) { groups = []; }
        let defGroup = "";
        try { const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("stocktake_anomaly_group_id"); defGroup = r && r.value ? String(r.value) : ""; } catch (_) { }
        const n2 = (v) => (v == null ? "—" : String(Math.round(Number(v) * 100) / 100));
        const rowsHtml = list.map((a) => `
      <tr>
        <td style="text-align:center;"><input type="checkbox" name="keys" value="${escapeAttr(a.key)}" checked form="anomSend"></td>
        <td style="white-space:nowrap;">${escapeHtml(a.whName || a.wh)}${a.icp !== "00" ? `<span class="wh-co2">${escapeHtml(a.co)}</span>` : ""}</td>
        <td style="font-variant-numeric:tabular-nums;white-space:nowrap;">${escapeHtml(a.it.code)}</td>
        <td>${escapeHtml(a.it.name)}${a.it.spec ? `<span style="margin-left:6px;font-size:11px;color:var(--notion-text-muted,#9b9a97);">${escapeHtml(a.it.spec)}</span>` : ""}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;">${a.it.adj ? `${n2(a.it.latestRaw)} <span style="color:#8250df;">調${a.it.adj > 0 ? "+" : ""}${a.it.adj}</span> ＝<b>${n2(a.it.latest)}</b>` : `<b>${n2(a.it.latest)}</b>`}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;">${n2(a.it.counted)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:${a.it.diffLatest > 0 ? "#1f7a46" : "#b3261e"};white-space:nowrap;">${a.it.diffLatest > 0 ? "+" : ""}${n2(a.it.diffLatest)} <span style="font-weight:400;font-size:11px;">(${a.pct > 0 ? "+" : ""}${a.pct}%)</span></td>
        <td style="font-size:12px;color:var(--notion-text,#37352f);">${a.causes.map((cz) => `<span class="anom-cause">${escapeHtml(cz)}</span>`).join("")}</td>
      </tr>`).join("");
        const groupOpts = groups.map((g) => `<option value="${escapeAttr(String(g.group_id))}" ${String(g.group_id) === defGroup ? "selected" : ""}>${escapeHtml(String(g.group_name || g.group_id))}</option>`).join("");
        const banner = req.query.ok ? `<div style="background:#e7f5e9;color:#2e7d32;padding:10px 12px;border-radius:8px;margin-bottom:12px;">已推送 ${escapeHtml(String(req.query.ok))} 項到群組。</div>` : (req.query.err ? `<div style="background:#fdecec;color:#b3261e;padding:10px 12px;border-radius:8px;margin-bottom:12px;">推送失敗：${escapeHtml(String(req.query.err))}</div>` : "");
        const body = `
      <style>
        .anom-cause{display:inline-block;font-size:11px;color:#5b616e;background:var(--notion-bg,#f7f6f3);border:1px solid var(--notion-border,#e3e2e0);border-radius:99px;padding:1px 8px;margin:1px 3px 1px 0;white-space:nowrap;}
        .wh-co2{margin-left:5px;font-size:10px;font-weight:700;color:#2383e2;background:#e8f1fd;padding:1px 6px;border-radius:5px;}
      </style>
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory">盤點</a> / 異常排查表</div>
      <h1 class="notion-page-title">異常排查表</h1>
      <p class="notion-hint" style="margin:-2px 0 14px;">列出當日<b>對最新盤差 ≠ 0</b>（實盤 vs 最新系統＋調整）的品項，依盤差方向與跨倉/調整訊號自動列<b>可能原因</b>。勾選後可推送到 LINE 群組請大家複查——只是提示排查方向，<b>不會動任何帳</b>。</p>
      ${banner}
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px;">
        <form method="get" action="/admin/inventory/anomalies" style="display:inline-flex;margin:0;">
          <input type="date" name="date" value="${escapeAttr(date)}" onchange="this.form.submit()" class="sf-input" style="width:auto;">
        </form>
        <span style="flex:1"></span>
        <form method="post" action="/admin/inventory/anomalies/send" id="anomSend" style="display:inline-flex;gap:8px;align-items:center;margin:0;" onsubmit="return confirm('確定推送勾選的異常品項到所選群組？');">
          <input type="hidden" name="date" value="${escapeAttr(date)}">
          <select name="group_id" class="sf-input" style="width:auto;min-width:180px;" ${groups.length ? "" : "disabled"}>
            ${groupOpts || `<option value="">（尚無已知群組）</option>`}
          </select>
          <button type="submit" class="btn-primary" ${(!groups.length || !list.length) ? "disabled" : ""}>推送到群組複查</button>
        </form>
      </div>
      <div class="notion-card" style="padding:0;overflow:auto;">
        <table>
          <thead><tr><th style="text-align:center;">選</th><th>倉庫</th><th>料號</th><th>品名</th><th style="text-align:right;">最新系統<br><span style="font-weight:400;font-size:10px;">快照/調整/加總</span></th><th style="text-align:right;">實盤</th><th style="text-align:right;">對最新盤差(%)</th><th>可能原因（排查方向）</th></tr></thead>
          <tbody>${rowsHtml || `<tr><td colspan="8" style="text-align:center;color:var(--notion-text-muted,#9b9a97);padding:22px;">此日期沒有「對最新盤差 ≠ 0」的品項 ${sfInlineIcon("spark")}</td></tr>`}</tbody>
        </table>
      </div>
      ${list.length ? `
      <div class="notion-card" style="padding:14px 16px;margin-top:14px;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:8px;">
          <b style="font-size:13.5px;">訊息文字（勾選會即時更新，可直接複製貼到 LINE）</b>
          <button type="button" class="btn-primary" id="anomCopy" style="font-size:12.5px;padding:5px 14px;">複製文字</button>
          <span id="anomCopyMsg" style="font-size:12px;color:#1f7a46;"></span>
        </div>
        <textarea id="anomPreview" readonly class="sf-textarea" style="width:100%;min-height:240px;font-size:12.5px;line-height:1.65;font-variant-numeric:tabular-nums;"></textarea>
      </div>
      <script>
      (function(){
        var AITEMS=${JSON.stringify(list.map((a) => ({ key: a.key, wh: anomWhTag(a), txt: anomItemTxt(a) }))).replace(/</g, "\\u003c")};
        var ADATE=${JSON.stringify(date)};
        var ta=document.getElementById('anomPreview');
        function rebuild(){
          var sel={}; document.querySelectorAll('input[name="keys"]:checked').forEach(function(cb){ sel[cb.value]=1; });
          var items=AITEMS.filter(function(x){ return sel[x.key]; });
          if(!items.length){ ta.value='（未勾選任何品項）'; return; }
          var out='📋 盤點異常排查表 '+ADATE+'（共 '+items.length+' 項）\\n請大家幫忙複查，確認實際狀況後回報：';
          var groups=[],byWh={};
          items.forEach(function(x){ if(!byWh[x.wh]){ byWh[x.wh]={wh:x.wh,items:[]}; groups.push(byWh[x.wh]); } byWh[x.wh].items.push(x); });
          var idx=0;
          groups.forEach(function(g){ out+='\\n\\n'+g.wh; g.items.forEach(function(x){ idx++; out+='\\n'+idx+'. '+x.txt; }); });
          ta.value=out;
        }
        document.querySelectorAll('input[name="keys"]').forEach(function(cb){ cb.addEventListener('change',rebuild); });
        rebuild();
        document.getElementById('anomCopy').addEventListener('click',function(){
          var ok=function(){ var m=document.getElementById('anomCopyMsg'); m.textContent='已複製 ✓'; setTimeout(function(){ m.textContent=''; },2500); };
          if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(ta.value).then(ok).catch(function(){ ta.select(); document.execCommand('copy'); ok(); }); }
          else { ta.select(); document.execCommand('copy'); ok(); }
        });
      })();
      </script>` : ""}`;
        res.type("text/html").send(notionPage("異常排查表", body, "inventory", res));
    });
    router.post("/inventory/anomalies/send", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const qd = String(req.body?.date || "").trim();
        const date = /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : stkAdminTaipeiDate();
        const back = "/admin/inventory/anomalies?date=" + encodeURIComponent(date);
        try {
            const groupId = String(req.body?.group_id || "").trim();
            if (!groupId) { res.redirect(back + "&err=" + encodeURIComponent("未選擇群組")); return; }
            let keys = req.body?.keys;
            keys = Array.isArray(keys) ? keys : (keys ? [keys] : []);
            const keySet = new Set(keys.map(String));
            const list = (await loadStocktakeAnomalies(date)).filter((a) => keySet.has(a.key));
            if (!list.length) { res.redirect(back + "&err=" + encodeURIComponent("沒有勾選任何品項")); return; }
            const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
            if (!token) { res.redirect(back + "&err=" + encodeURIComponent("LINE_CHANNEL_ACCESS_TOKEN 未設定")); return; }
            // 訊息組裝：按倉分組（倉序＝該倉最嚴重品項的順序）、不含排查原因（太長，原因看網頁表格）、
            // 每則 ≤4200 字自動分則（換則重印倉庫標頭）。與頁面「訊息文字」預覽同一套 helper。
            const groupsM = new Map();
            for (const a of list) {
                const k = a.icp + ":" + a.wh;
                if (!groupsM.has(k)) groupsM.set(k, { tag: anomWhTag(a), items: [] });
                groupsM.get(k).items.push(a);
            }
            const texts = [];
            let cur = `📋 盤點異常排查表 ${date}（共 ${list.length} 項）\n請大家幫忙複查，確認實際狀況後回報：`;
            let idx = 0;
            for (const g of groupsM.values()) {
                let whPrinted = false;
                for (const a of g.items) {
                    idx++;
                    let block = (whPrinted ? "" : "\n\n" + g.tag) + `\n${idx}. ` + anomItemTxt(a);
                    if ((cur + block).length > 4200) {
                        texts.push(cur);
                        cur = `📋 盤點異常排查表 ${date}（續）`;
                        block = "\n\n" + g.tag + `\n${idx}. ` + anomItemTxt(a);
                    }
                    cur += block;
                    whPrinted = true;
                }
            }
            texts.push(cur);
            for (let i = 0; i < texts.length; i += 5) {
                const batch = texts.slice(i, i + 5).map((t) => ({ type: "text", text: t.slice(0, 4900) }));
                const resp = await fetch("https://api.line.me/v2/bot/message/push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ to: groupId, messages: batch }),
                });
                if (!resp.ok) {
                    const t = await resp.text().catch(() => "");
                    throw new Error("LINE push " + resp.status + " " + t.slice(0, 150));
                }
            }
            // 記住這次選的群組，下次預設帶入
            try { await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("stocktake_anomaly_group_id", groupId); } catch (_) { }
            console.log("[admin] 異常排查表已推送：", date, list.length, "項 →", groupId.slice(0, 12) + "…");
            res.redirect(back + "&ok=" + list.length);
        }
        catch (e) {
            console.error("[admin] anomalies send", e?.message || e);
            res.redirect(back + "&err=" + encodeURIComponent(String(e?.message || e).slice(0, 120)));
        }
    });
    // ============================================================
    // 庫存統計圖表（2026-07-16）：三欄式（日K/週K/月K｜倉庫｜品項搜尋）＋盤差熱力圖
    // K 線：erp_stock_daily（公司層級）/ erp_stock_wh_daily（分倉，有資料才用、否則退回公司層級）。
    // 盤差＝盤點凍結當下（counted_qty − sys_qty）；「當日最後」由一倉一日一筆的 stocktake_session 天然成立，
    // 台北時間換日即定案，不需另跑結算排程。分母取 max(|sys|,1) 避免 sys=0/負數時百分比爆掉。
    // ============================================================
    const statsTaipeiDateAgo = (days) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - days * 86400000));
    const statsVarPct = (sys, counted) => Math.round(((counted - sys) / Math.max(Math.abs(sys), 1)) * 1000) / 10;
    // [fix 2026-07-17] 統計盤差一律「含庫存調整」：盤差＝實盤 −（凍結系統＋目前 delta）。
    // 調整是長期掛著的系統誤差補償（凌越端無法修），不扣掉的話已補償品項會永遠霸佔熱力圖/排行。
    const statsAdjMap = async (icpno) => {
        const m = {};
        try { (await db.prepare("SELECT erp_code, delta FROM stock_adjustment WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icpno) || []).forEach((r) => { m[String(r.erp_code)] = Number(r.delta || 0); }); } catch (_) { }
        return m;
    };
    router.get("/inventory/stats/items", async (req, res) => {
        try {
            const icpno = stickyIcpno(req, res);
            const q = String(req.query.q || "").trim().toLowerCase();
            let rows = (await db.prepare("SELECT erp_code, name, spec, unit, qty FROM erp_stock_items WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icpno)) || [];
            if (q)
                rows = rows.filter((r) => (String(r.erp_code) + " " + String(r.name || "") + " " + String(r.spec || "")).toLowerCase().indexOf(q) >= 0);
            rows.sort((a, b) => String(a.erp_code).localeCompare(String(b.erp_code)));
            if (!String(req.query.all || "").trim())
                rows = rows.slice(0, 12);
            res.json({ items: rows.map((r) => ({ code: String(r.erp_code), name: String(r.name || ""), spec: String(r.spec || ""), unit: String(r.unit || ""), qty: Number(r.qty || 0) })) });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    router.get("/inventory/stats/kline", async (req, res) => {
        try {
            const icpno = stickyIcpno(req, res);
            const code = String(req.query.code || "").trim();
            const wh = String(req.query.wh || "").trim();
            if (!code) { res.status(400).json({ error: "缺少料號" }); return; }
            let scope = "company", raw = [];
            if (wh) {
                try { raw = (await db.prepare("SELECT snap_date AS d, qty, qty_open, qty_high, qty_low FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND wh_code = ? AND erp_code = ? ORDER BY snap_date").all(icpno, wh, code)) || []; } catch (_) { raw = []; }
                if (raw.length) scope = "warehouse";
            }
            if (!raw.length) {
                try { raw = (await db.prepare("SELECT snap_date AS d, qty, qty_open, qty_high, qty_low FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code = ? ORDER BY snap_date").all(icpno, code)) || []; } catch (_) { raw = []; }
            }
            // 舊列（加欄前）open/high/low 為 NULL：open 退回收、高低夾在開收之間（畫成無影線的實體）。
            const bars = raw.map((b) => {
                const close = Number(b.qty || 0);
                const open = (b.qty_open == null || !Number.isFinite(Number(b.qty_open))) ? close : Number(b.qty_open);
                const high = (b.qty_high == null || !Number.isFinite(Number(b.qty_high))) ? Math.max(open, close) : Number(b.qty_high);
                const low = (b.qty_low == null || !Number.isFinite(Number(b.qty_low))) ? Math.min(open, close) : Number(b.qty_low);
                return { d: String(b.d), open, high, low, close };
            });
            const since = statsTaipeiDateAgo(90);
            let vrows = [];
            try {
                // counted_qty IS NOT NULL：效期-only 列（有批號沒盤數）不算「實盤 0」假盤差（口徑同 improvement）
                const sql = "SELECT s.count_date AS d, c.sys_qty, c.counted_qty FROM stocktake_count c JOIN stocktake_session s ON s.id = c.session_id WHERE COALESCE(NULLIF(TRIM(s.icpno),''),'00') = ? AND c.erp_code = ? AND s.count_date >= ? AND c.counted_qty IS NOT NULL" + (wh ? " AND s.wh_code = ?" : "");
                vrows = (wh ? await db.prepare(sql).all(icpno, code, since, wh) : await db.prepare(sql).all(icpno, code, since)) || [];
            } catch (_) { vrows = []; }
            const byDate = new Map(); // 全公司檢視＝同日各倉加總後算盤差
            for (const v of vrows) {
                const k = String(v.d);
                const acc = byDate.get(k) || { sys: 0, counted: 0 };
                acc.sys += Number(v.sys_qty || 0);
                acc.counted += Number(v.counted_qty || 0);
                byDate.set(k, acc);
            }
            const adjKl = Number((await statsAdjMap(icpno))[code] || 0); // 盤差含庫存調整（與熱力圖一致）
            const variance = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))
                .map(([d, a]) => ({ d, sys: a.sys, counted: a.counted, var_pct: statsVarPct(a.sys + adjKl, a.counted) }));
            res.json({ scope, bars, variance });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    // 整倉序列（品項總覽小圖用）：一次回該倉（或全公司）所有品項近 N 天的期末量＋盤點點
    router.get("/inventory/stats/series", async (req, res) => {
        try {
            const icpno = stickyIcpno(req, res);
            const wh = String(req.query.wh || "").trim();
            const days = Math.min(60, Math.max(7, parseInt(String(req.query.days || "30"), 10) || 30));
            const since = statsTaipeiDateAgo(days - 1);
            let scope = "company", rows = [];
            if (wh) {
                try { rows = (await db.prepare("SELECT erp_code, snap_date AS d, qty FROM erp_stock_wh_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND wh_code = ? AND snap_date >= ? ORDER BY snap_date").all(icpno, wh, since)) || []; } catch (_) { rows = []; }
                if (rows.length) scope = "warehouse";
            }
            if (!rows.length) {
                try { rows = (await db.prepare("SELECT erp_code, snap_date AS d, qty FROM erp_stock_daily WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND snap_date >= ? ORDER BY snap_date").all(icpno, since)) || []; } catch (_) { rows = []; }
            }
            // 選了倉但沒有分倉每日快照（退回全公司量）時，品項仍要照倉別過濾（erp_stock_items.wh_code），
            // 不然點左側倉庫清單看起來「品項都沒變」；分倉現量另查 erp_stock_wh_qty（卡片現量＋隱藏庫存0用）。
            let whCodes = null, whQty = null;
            if (wh) {
                try {
                    const wc = (await db.prepare("SELECT erp_code FROM erp_stock_items WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND wh_code = ?").all(icpno, wh)) || [];
                    whCodes = new Set(wc.map((r) => String(r.erp_code)));
                } catch (_) { whCodes = null; }
                try {
                    const wq = (await db.prepare("SELECT erp_code, qty FROM erp_stock_wh_qty WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND wh_code = ?").all(icpno, wh)) || [];
                    if (wq.length) whQty = new Map(wq.map((r) => [String(r.erp_code), Number(r.qty || 0)]));
                } catch (_) { whQty = null; }
            }
            const dates = Array.from(new Set(rows.map((r) => String(r.d)))).sort();
            const idx = new Map(dates.map((d, i) => [d, i]));
            const meta = new Map();
            try {
                for (const m of (await db.prepare("SELECT erp_code, name, spec, unit, qty FROM erp_stock_items WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icpno)) || [])
                    meta.set(String(m.erp_code), m);
            } catch (_) { }
            const items = new Map();
            for (const r of rows) {
                const code = String(r.erp_code);
                let it = items.get(code);
                if (!it) {
                    const m = meta.get(code);
                    it = { code, name: String(m?.name || "") || code, spec: String(m?.spec || ""), unit: String(m?.unit || ""), qty: m ? Number(m.qty || 0) : null, closes: new Array(dates.length).fill(null), counts: {} };
                    items.set(code, it);
                }
                it.closes[idx.get(String(r.d))] = Number(r.qty || 0);
            }
            let vrows = [];
            try {
                // counted_qty IS NOT NULL：同 kline，效期-only 列不算假盤差
                const sql = "SELECT s.count_date AS d, c.erp_code, c.sys_qty, c.counted_qty FROM stocktake_count c JOIN stocktake_session s ON s.id = c.session_id WHERE COALESCE(NULLIF(TRIM(s.icpno),''),'00') = ? AND s.count_date >= ? AND c.counted_qty IS NOT NULL" + (wh ? " AND s.wh_code = ?" : "");
                vrows = (wh ? await db.prepare(sql).all(icpno, since, wh) : await db.prepare(sql).all(icpno, since)) || [];
            } catch (_) { vrows = []; }
            const vagg = new Map();
            for (const v of vrows) {
                const k = String(v.erp_code) + "|" + String(v.d);
                const a = vagg.get(k) || { sys: 0, counted: 0 };
                a.sys += Number(v.sys_qty || 0);
                a.counted += Number(v.counted_qty || 0);
                vagg.set(k, a);
            }
            const adjSer = await statsAdjMap(icpno); // 盤差含庫存調整（與熱力圖一致）
            for (const [k, a] of vagg.entries()) {
                const p = k.indexOf("|");
                const code0 = k.slice(0, p);
                const it = items.get(code0);
                if (it) it.counts[k.slice(p + 1)] = { v: statsVarPct(a.sys + Number(adjSer[code0] || 0), a.counted), c: a.counted };
            }
            let list = Array.from(items.values());
            const whFiltered = !!(wh && scope === "company" && whCodes && whCodes.size);
            if (whFiltered)
                list = list.filter((it) => whCodes.has(it.code) || Object.keys(it.counts).length); // 該倉有盤過的也留
            if (whQty)
                for (const it of list) it.qty = whQty.has(it.code) ? whQty.get(it.code) : 0;
            const out = list.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")).slice(0, 400);
            res.json({ scope, whFiltered, dates, items: out });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    router.get("/inventory/stats/heatmap", async (req, res) => {
        try {
            const icpno = stickyIcpno(req, res);
            const wh = String(req.query.wh || "").trim();
            const days = Math.min(31, Math.max(7, parseInt(String(req.query.days || "14"), 10) || 14));
            const since = statsTaipeiDateAgo(days - 1);
            let rows = [];
            try {
                // counted_qty IS NOT NULL：同 kline/series，效期-only 列不算假盤差
                const sql = "SELECT s.count_date AS d, c.erp_code, c.name, c.spec, c.sys_qty, c.counted_qty FROM stocktake_count c JOIN stocktake_session s ON s.id = c.session_id WHERE COALESCE(NULLIF(TRIM(s.icpno),''),'00') = ? AND s.count_date >= ? AND c.counted_qty IS NOT NULL" + (wh ? " AND s.wh_code = ?" : "");
                rows = (wh ? await db.prepare(sql).all(icpno, since, wh) : await db.prepare(sql).all(icpno, since)) || [];
            } catch (_) { rows = []; }
            const items = new Map(); // code -> {code,name,spec,days:{date:{sys,counted}}}
            for (const r of rows) {
                const code = String(r.erp_code || "").trim();
                if (!code) continue;
                let it = items.get(code);
                if (!it) { it = { code, name: String(r.name || ""), spec: String(r.spec || ""), days: {} }; items.set(code, it); }
                const k = String(r.d);
                const acc = it.days[k] || { sys: 0, counted: 0 };
                acc.sys += Number(r.sys_qty || 0);
                acc.counted += Number(r.counted_qty || 0);
                it.days[k] = acc;
            }
            const dates = [];
            for (let i = days - 1; i >= 0; i--) dates.push(statsTaipeiDateAgo(i));
            const adjMap = await statsAdjMap(icpno); // 盤差含庫存調整（誤差補償）
            const out = Array.from(items.values()).map((it) => {
                const cells = {};
                let maxAbs = 0;
                const adj = Number(adjMap[it.code] || 0);
                for (const [d, a] of Object.entries(it.days)) {
                    const sysAdj = Math.round((a.sys + adj) * 100) / 100;
                    const p = statsVarPct(sysAdj, a.counted);
                    cells[d] = { v: p, sys: a.sys, counted: a.counted };
                    if (adj) { cells[d].adj = adj; cells[d].sys_adj = sysAdj; }
                    if (Math.abs(p) > maxAbs) maxAbs = Math.abs(p);
                }
                return { code: it.code, name: it.name, spec: it.spec, cells, max_abs: maxAbs };
            }).sort((a, b) => b.max_abs - a.max_abs).slice(0, 400); // 護欄：最多 400 品項（已依嚴重度排序，截掉的都是後段）
            res.json({ dates, items: out });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    // ── 盤差改善（2026-07-21）：整體盤差隨排查有沒有變好。口徑同熱力圖（含庫存調整、同日同料號跨倉先加總）。
    //   回傳：每日整體指標（準確率／平均・加權絕對盤差%／盤差品項數）＋ 本週vs上週計分卡 ＋ 進步榜／待改善榜。
    //   品項再多也只彙總成幾條線＋兩張榜，不逐項畫。
    router.get("/inventory/stats/improvement", async (req, res) => {
        try {
            const icpno = stickyIcpno(req, res);
            const days = Math.min(60, Math.max(14, parseInt(String(req.query.days || "28"), 10) || 28));
            const since = statsTaipeiDateAgo(days - 1);
            let rows = [];
            try {
                const sql = "SELECT s.count_date AS d, c.erp_code, c.name, c.spec, c.sys_qty, c.counted_qty FROM stocktake_count c JOIN stocktake_session s ON s.id = c.session_id WHERE COALESCE(NULLIF(TRIM(s.icpno),''),'00') = ? AND s.count_date >= ? AND c.counted_qty IS NOT NULL";
                rows = (await db.prepare(sql).all(icpno, since)) || [];
            } catch (_) { rows = []; }
            const adjMap = await statsAdjMap(icpno);
            // code → {code,name,spec,days:{date:{sys,counted}}}（同料號跨倉先加總）
            const items = new Map();
            for (const r of rows) {
                const code = String(r.erp_code || "").trim();
                if (!code) continue;
                let it = items.get(code);
                if (!it) { it = { code, name: String(r.name || ""), spec: String(r.spec || ""), days: {} }; items.set(code, it); }
                const k = String(r.d);
                const a = it.days[k] || { sys: 0, counted: 0 };
                a.sys += Number(r.sys_qty || 0);
                a.counted += Number(r.counted_qty || 0);
                it.days[k] = a;
            }
            // 每日整體彙總
            const dayAgg = new Map(); // date → {items,itemsDiff,itemsSevere,sumAbsDiff,sumBase,sumAbsPct}
            for (const it of items.values()) {
                const adj = Number(adjMap[it.code] || 0);
                for (const [d, a] of Object.entries(it.days)) {
                    const sysAdj = a.sys + adj;
                    const diff = a.counted - sysAdj;
                    const p = statsVarPct(sysAdj, a.counted);
                    let g = dayAgg.get(d);
                    if (!g) { g = { items: 0, itemsDiff: 0, itemsSevere: 0, sumAbsDiff: 0, sumBase: 0, sumAbsPct: 0 }; dayAgg.set(d, g); }
                    g.items++;
                    if (Math.round(diff * 100) / 100 !== 0) g.itemsDiff++;
                    if (Math.abs(p) > 5) g.itemsSevere++;
                    g.sumAbsDiff += Math.abs(diff);
                    g.sumBase += Math.max(Math.abs(sysAdj), 1);
                    g.sumAbsPct += Math.abs(p);
                }
            }
            const daily = [...dayAgg.keys()].sort().map((d) => {
                const g = dayAgg.get(d);
                return { date: d, items: g.items, itemsDiff: g.itemsDiff, itemsSevere: g.itemsSevere,
                    accuracy: g.items ? Math.round((1 - g.itemsDiff / g.items) * 1000) / 10 : 0,
                    meanAbsPct: g.items ? Math.round((g.sumAbsPct / g.items) * 10) / 10 : 0,
                    weightedAbsPct: g.sumBase ? Math.round((g.sumAbsDiff / g.sumBase) * 1000) / 10 : 0 };
            });
            // 計分卡：以「有資料的最後一天」為錨，本週(近7天) vs 上週(前7天)
            const shift = (ds, n) => { const dt = new Date(ds + "T00:00:00Z"); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); };
            const latest = daily.length ? daily[daily.length - 1].date : statsTaipeiDateAgo(0);
            const pool = (lo, hi) => {
                let it = 0, df = 0, sev = 0, sad = 0, sb = 0, sp = 0, nd = 0;
                for (const [d, g] of dayAgg) {
                    if (d >= lo && d <= hi) { it += g.items; df += g.itemsDiff; sev += g.itemsSevere; sad += g.sumAbsDiff; sb += g.sumBase; sp += g.sumAbsPct; nd++; }
                }
                return { days: nd, items: it,
                    accuracy: it ? Math.round((1 - df / it) * 1000) / 10 : null,
                    meanAbsPct: it ? Math.round((sp / it) * 10) / 10 : null,
                    weightedAbsPct: sb ? Math.round((sad / sb) * 1000) / 10 : null,
                    itemsSevere: sev };
            };
            const scorecard = { thisWeek: pool(shift(latest, -6), latest), prevWeek: pool(shift(latest, -13), shift(latest, -7)) };
            // 排行：每品項「前半段 vs 後半段」平均 |盤差%|
            const mid = statsTaipeiDateAgo(Math.floor(days / 2));
            const ranks = [];
            for (const it of items.values()) {
                const adj = Number(adjMap[it.code] || 0);
                const f = [], s = [];
                for (const [d, a] of Object.entries(it.days)) {
                    const p = Math.abs(statsVarPct(a.sys + adj, a.counted));
                    (d < mid ? f : s).push(p);
                }
                const avg = (arr) => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null;
                ranks.push({ code: it.code, name: it.name, spec: it.spec, favg: avg(f), savg: avg(s) });
            }
            const improved = ranks.filter((r) => r.favg != null && r.savg != null && r.favg > 3 && (r.favg - r.savg) > 1)
                .sort((a, b) => (b.favg - b.savg) - (a.favg - a.savg)).slice(0, 10)
                .map((r) => ({ code: r.code, name: r.name, spec: r.spec, from: Math.round(r.favg * 10) / 10, to: Math.round(r.savg * 10) / 10 }));
            const watch = ranks.filter((r) => r.savg != null && r.savg > 5)
                .sort((a, b) => b.savg - a.savg).slice(0, 10)
                .map((r) => ({ code: r.code, name: r.name, spec: r.spec, recent: Math.round(r.savg * 10) / 10, before: r.favg == null ? null : Math.round(r.favg * 10) / 10 }));
            res.json({ dates: daily.map((d) => d.date), daily, scorecard, improved, watch, days });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    router.get("/inventory/stats", async (req, res) => {
        const icpno = stickyIcpno(req, res);
        let whs = [];
        try { whs = (await db.prepare("SELECT code, name FROM erp_warehouse WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? ORDER BY sort_order, code").all(icpno)) || []; } catch (_) { whs = []; }
        const coSeg = Object.entries(erp_companies_js_1.ERP_COMPANY_NAMES).map(([c, n]) => `<a class="sf-seg-btn ${c === icpno ? "on" : ""}" href="/admin/inventory/stats?icpno=${c}">${escapeHtml(n)}</a>`).join("");
        const whJson = JSON.stringify(whs.map((w) => ({ code: String(w.code), name: String(w.name || "") })));
        const body = `
      <style>
        .ivs-root{--ivs-up:#e34948;--ivs-up-soft:rgba(227,73,72,.12);--ivs-down:#008300;--ivs-line:#2a78d6;
          --ivs-grid:#eceae5;--ivs-base:#c9c7c1;--ivs-mut:#9b9a97;--ivs-ink2:#787774;
          --ivs-card:var(--notion-card,#fff);--ivs-border:var(--notion-border,#e3e2e0);
          --ivs-neg:#2a78d6;--ivs-pos:#e34948;--ivs-mid:#f0efec;}
        [data-theme="dark"] .ivs-root{--ivs-up:#e66767;--ivs-up-soft:rgba(230,103,103,.16);--ivs-down:#2fae2f;--ivs-line:#3987e5;
          --ivs-grid:#2c2c2a;--ivs-base:#44433f;--ivs-mut:#898781;--ivs-ink2:#c3c2b7;
          --ivs-neg:#3987e5;--ivs-pos:#e66767;--ivs-mid:#383835;}
        .ivs-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 14px;}
        .ivs-flabel{font-size:12px;color:var(--ivs-mut);}
        .ivs-grid3{display:grid;grid-template-columns:150px 235px minmax(0,1fr);gap:14px;align-items:start;}
        @media (max-width:1020px){ .ivs-grid3{grid-template-columns:1fr;} }
        .ivs-col{background:var(--ivs-card);border:1px solid var(--ivs-border);border-radius:12px;overflow:hidden;}
        .ivs-col-h{font-size:12px;font-weight:700;color:var(--ivs-mut);padding:9px 13px;border-bottom:1px solid var(--ivs-grid);}
        .ivs-row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;border:0;border-bottom:1px solid var(--ivs-grid);background:transparent;color:var(--ivs-ink2);font:inherit;font-size:12.5px;padding:9px 13px;cursor:pointer;text-align:left;}
        .ivs-row:hover{background:rgba(35,131,226,.05);}
        .ivs-row.on{background:rgba(35,131,226,.10);color:inherit;font-weight:700;box-shadow:inset 3px 0 0 #2383e2;}
        .ivs-row .tag{font-size:10.5px;color:var(--ivs-mut);border:1px solid var(--ivs-border);border-radius:99px;padding:0 7px;white-space:nowrap;}
        .ivs-card{background:var(--ivs-card);border:1px solid var(--ivs-border);border-radius:12px;padding:14px 16px;margin-bottom:14px;}
        .ivs-card-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin-bottom:6px;}
        .ivs-card-t{font-size:14.5px;font-weight:700;}
        .ivs-note{font-size:12px;color:var(--ivs-mut);}
        .ivs-legend{display:flex;flex-wrap:wrap;gap:13px;font-size:12px;color:var(--ivs-ink2);align-items:center;margin-left:auto;}
        .ivs-lg{display:inline-flex;align-items:center;gap:5px;}
        .ivs-lg .k{width:8px;height:12px;border-radius:2px;flex:none;}
        .ivs-chart{position:relative;width:100%;}
        .ivs-chart svg{display:block;width:100%;height:auto;cursor:crosshair;}
        .ivs-search{position:relative;margin-bottom:12px;}
        .ivs-search input{width:100%;font:inherit;font-size:13px;color:inherit;background:var(--ivs-card);border:1px solid var(--ivs-border);border-radius:9px;padding:8px 12px 8px 34px;box-sizing:border-box;}
        .ivs-search .mag{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:15px;height:15px;stroke:var(--ivs-mut);stroke-width:1.4;fill:none;pointer-events:none;}
        .ivs-list{max-height:680px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;padding:2px;}
        .ivs-gcard{border:1px solid var(--ivs-border);border-radius:10px;background:var(--ivs-card);padding:9px 11px 8px;cursor:pointer;text-align:left;font:inherit;color:inherit;min-width:0;}
        .ivs-gcard:hover{border-color:#2383e2;box-shadow:0 2px 10px rgba(35,131,226,.15);}
        .ivs-gcard .gc-top{display:flex;justify-content:space-between;gap:8px;align-items:baseline;}
        .ivs-gcard .gc-nm{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ivs-gcard .gc-q{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;}
        .ivs-gcard .gc-sub{font-size:11px;color:var(--ivs-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;}
        .ivs-gcard .gc-spark svg{display:block;width:100%;height:auto;}
        .ivs-gcard .gc-ft{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:4px;font-size:11.5px;}
        .gc-delta{font-weight:700;font-variant-numeric:tabular-nums;}
        .gc-delta.up{color:var(--ivs-up);} .gc-delta.down{color:var(--ivs-down);} .gc-delta.flat{color:var(--ivs-mut);}
        .ivs-backbtn{border:1px solid var(--ivs-border);background:var(--ivs-card);color:var(--ivs-ink2);font:inherit;font-size:12.5px;font-weight:600;padding:4px 12px;border-radius:8px;cursor:pointer;}
        .ivs-backbtn:hover{border-color:#2383e2;color:#2383e2;}
        #ivsTip{position:fixed;z-index:99;pointer-events:none;display:none;background:var(--ivs-card,#fff);color:inherit;border:1px solid var(--ivs-border,#e3e2e0);border-radius:9px;box-shadow:0 6px 24px rgba(15,15,15,.2);padding:8px 11px;font-size:12px;line-height:1.5;min-width:150px;}
        #ivsTip .td{font-weight:700;margin-bottom:2px;}
        #ivsTip .tr{display:flex;justify-content:space-between;gap:14px;}
        #ivsTip .tr b{font-variant-numeric:tabular-nums;}
        .ivs-empty{border:1px dashed var(--ivs-border);border-radius:10px;padding:26px 14px;text-align:center;color:var(--ivs-mut);font-size:12.5px;}
        .ivs-heat-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:4px 0 10px;font-size:12.5px;color:var(--ivs-ink2);}
        .ivs-heat-tools input[type="search"]{font:inherit;font-size:12.5px;color:inherit;background:var(--ivs-card);border:1px solid var(--ivs-border);border-radius:8px;padding:5px 10px;width:150px;}
        .ivs-heat-scroll{overflow-x:auto;}
        .ivs-hmg{display:grid;gap:2px;width:max-content;}
        .hmg-h{font-weight:600;color:var(--ivs-mut);text-align:center;white-space:nowrap;font-size:10px;line-height:1.3;align-self:end;overflow:hidden;}
        .hmg-r{font-size:11px;font-weight:600;color:var(--ivs-ink2);text-align:right;padding-right:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;align-self:center;min-width:0;}
        .hmg-cell{width:24px;height:24px;border-radius:5px;cursor:pointer;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;color:transparent;box-sizing:border-box;border:0;padding:0;font-family:inherit;}
        .hmg-cell:hover{outline:2px solid #2383e2;outline-offset:1px;}
        .hmg-cell.sel{outline:2px solid currentColor;outline-offset:1px;}
        .hmg-cell.na{background:linear-gradient(to top right,transparent calc(50% - 0.6px),var(--ivs-base) calc(50% - 0.6px),var(--ivs-base) calc(50% + 0.6px),transparent calc(50% + 0.6px)) !important;border:1px solid var(--ivs-grid);cursor:default;}
        .hmg-cell.showv{color:inherit;}
        .ivs-hm-legend{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--ivs-mut);margin-top:10px;}
        .ivs-hm-grad{width:150px;height:9px;border-radius:5px;background:linear-gradient(90deg,var(--ivs-neg),var(--ivs-mid) 50%,var(--ivs-pos));}
        .ivs-grid-heat{display:grid;grid-template-columns:235px minmax(0,1fr) 270px;gap:14px;align-items:start;}
        @media (max-width:1020px){ .ivs-grid-heat{grid-template-columns:1fr;} }
        .ivs-rank{display:flex;align-items:center;gap:9px;padding:8px 2px;border-bottom:1px solid var(--ivs-grid);cursor:pointer;border-radius:6px;}
        .ivs-rank:hover{background:rgba(35,131,226,.05);}
        .ivs-rank .n{font-size:12px;color:var(--ivs-mut);width:16px;text-align:right;flex:none;}
        .ivs-rank .nm{flex:1;min-width:0;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ivs-rank .sp{font-size:11px;color:var(--ivs-mut);flex:none;}
        .ivs-pill{display:inline-flex;font-size:11.5px;font-weight:700;padding:1px 8px;border-radius:99px;white-space:nowrap;}
        .ivs-pill.bad{background:rgba(227,73,72,.12);color:#b3261e;}
        .ivs-pill.ok{background:rgba(0,131,0,.10);color:#2e7d32;}
        [data-theme="dark"] .ivs-pill.bad{color:#ef8a84;}
        [data-theme="dark"] .ivs-pill.ok{color:#7bcf87;}
        .ivs-drill{margin-top:14px;}
        .ivs-drill-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .ivs-score{display:grid;grid-template-columns:repeat(auto-fit,minmax(184px,1fr));gap:12px;margin-bottom:16px;}
        .ivs-tile{background:var(--ivs-card);border:1px solid var(--ivs-border);border-radius:12px;padding:14px 16px;}
        .ivs-tile .t-l{font-size:12px;color:var(--ivs-mut);margin-bottom:7px;}
        .ivs-tile .t-v{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;}
        .ivs-tile .t-v .arw{color:var(--ivs-mut);font-size:14px;}
        .ivs-tile .t-d{font-size:12px;font-weight:700;margin-top:5px;}
        .ivs-tile .t-d.good{color:var(--ivs-down);} .ivs-tile .t-d.bad{color:var(--ivs-up);} .ivs-tile .t-d.flat{color:var(--ivs-mut);}
        .ivs-irow{display:flex;align-items:center;gap:9px;padding:8px 2px;border-bottom:1px solid var(--ivs-grid);}
        .ivs-irow .nm{flex:1;min-width:0;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ivs-irow .sp{font-size:11px;color:var(--ivs-mut);flex:none;}
        .ivs-irow .mv{font-size:12px;font-variant-numeric:tabular-nums;flex:none;color:var(--ivs-ink2);}
        @media (max-width:1020px){ .ivs-drill-grid{grid-template-columns:1fr;} }
      </style>
      <div class="ivs-root">
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / <a href="/admin/inventory">盤點</a> / 庫存統計圖表</div>
      <h1 class="notion-page-title" style="margin-bottom:6px;">庫存統計圖表</h1>
      <p class="notion-hint" style="margin:0 0 14px;">每個貨品每日的庫存變動（K 線）與每日盤差％追蹤。K 線的開＝昨收、收＝當日最後推送、高低＝當日各次推送極值；盤差＝當日最後一筆盤點（換日即定案）。</p>
      <div class="ivs-bar">
        <span class="ivs-flabel">公司</span>
        <div class="sf-seg ivs-seg">${coSeg}</div>
        <span class="ivs-flabel">檢視</span>
        <div class="sf-seg ivs-seg" id="ivsView">
          <button type="button" class="sf-seg-btn on" data-v="charts">${sfInlineIcon("chartLine")} 品項圖表</button>
          <button type="button" class="sf-seg-btn" data-v="heat">${sfInlineIcon("chartBar")} 盤差熱力圖</button>
          <button type="button" class="sf-seg-btn" data-v="improve">${sfInlineIcon("trendingUp")} 盤差改善</button>
        </div>
        <span style="flex:1"></span>
        <span class="ivs-note" id="ivsScopeNote"></span>
      </div>

      <div id="ivsCharts">
        <div class="ivs-grid3">
          <div class="ivs-col" id="ivsGranCol"></div>
          <div class="ivs-col" id="ivsWhCol"></div>
          <div style="min-width:0;">
            <div style="display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;margin-bottom:12px;">
              <div class="ivs-search" style="flex:1;min-width:220px;margin-bottom:0;">
                <svg class="mag" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
                <input type="search" id="ivsQ" placeholder="搜尋品項（品名／料號／規格，模糊比對）…" autocomplete="off">
              </div>
              <label class="sf-switch-label"><input type="checkbox" id="ivsHideZero"><span class="sf-switch"></span>隱藏庫存＝0</label>
            </div>
            <div class="ivs-card" id="ivsListCard">
              <div class="ivs-card-h">
                <div class="ivs-card-t">品項總覽（整倉小圖）</div>
                <span class="ivs-note" id="ivsListCount"></span>
                <span class="ivs-note" style="margin-left:auto;">點卡片看該品項的大圖與盤差</span>
              </div>
              <div class="ivs-list" id="ivsList"></div>
            </div>
            <div id="ivsChartsArea" hidden>
            <div class="ivs-card">
              <div class="ivs-card-h">
                <button type="button" class="ivs-backbtn" id="ivsBack">‹ 品項清單</button>
                <div class="ivs-card-t" id="ivsKTitle"></div>
                <span class="ivs-note" id="ivsKNote"></span>
                <div class="ivs-legend">
                  <span class="ivs-lg"><span class="k" style="border:2px solid var(--ivs-up);background:var(--ivs-up-soft);"></span>增加（空心紅）</span>
                  <span class="ivs-lg"><span class="k" style="background:var(--ivs-down);"></span>減少（實心綠）</span>
                  <span class="ivs-lg"><span style="width:9px;height:9px;border-radius:99px;background:var(--ivs-line);flex:none;"></span>盤點量</span>
                </div>
              </div>
              <div class="ivs-chart" id="ivsK"></div>
            </div>
            <div class="ivs-card">
              <div class="ivs-card-h">
                <div class="ivs-card-t">盤差％</div>
                <span class="ivs-note" id="ivsVNote">當日最後盤差；紅柱＝盤盈（實盤多）、藍柱＝盤虧（實盤少）；灰帶＝±2% 目標</span>
              </div>
              <div class="ivs-chart" id="ivsV"></div>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div id="ivsHeat" hidden>
        <div class="ivs-grid-heat">
          <div class="ivs-col" id="ivsHWhCol"></div>
          <div class="ivs-card" style="margin-bottom:0;">
            <div class="ivs-card-h">
              <div class="ivs-card-t">盤差熱力圖（品項 × 日期）</div>
              <span class="ivs-note">紅＝盤盈（實盤多）、藍＝盤虧（實盤少）；斜線＝當日未盤；盤差已扣庫存調整（誤差補償）</span>
            </div>
            <div class="ivs-heat-tools">
              <input type="search" id="ivsHQ" placeholder="搜尋品項…" autocomplete="off">
              <label class="sf-switch-label"><input type="checkbox" id="ivsHOnly"><span class="sf-switch"></span>只看有盤差</label>
              <label class="sf-switch-label"><input type="checkbox" id="ivsHShowV"><span class="sf-switch"></span>格內顯示數值</label>
              <span class="ivs-note" id="ivsHCount"></span>
              <span style="flex:1"></span>
              <span class="ivs-flabel">級距</span>
              <div class="sf-seg ivs-seg" id="ivsHScale">
                <button type="button" class="sf-seg-btn" data-s="8">±8%</button>
                <button type="button" class="sf-seg-btn" data-s="25">±25%</button>
                <button type="button" class="sf-seg-btn" data-s="50">±50%</button>
                <button type="button" class="sf-seg-btn on" data-s="100">±100%</button>
              </div>
              <span class="ivs-flabel">期間</span>
              <div class="sf-seg ivs-seg" id="ivsHDays">
                <button type="button" class="sf-seg-btn" data-d="7">7天</button>
                <button type="button" class="sf-seg-btn on" data-d="14">14天</button>
                <button type="button" class="sf-seg-btn" data-d="31">31天</button>
              </div>
              <button type="button" class="sf-seg-btn" id="ivsHMore" style="border:1px solid var(--ivs-border);border-radius:8px;display:none;"></button>
            </div>
            <div class="ivs-heat-scroll" id="ivsHM"></div>
            <div class="ivs-hm-legend"><span id="ivsHLgMin">−100%</span><span class="ivs-hm-grad"></span><span id="ivsHLgMax">＋100%</span><span style="margin-left:8px;">格子越深＝盤差越大，點格子看下方詳情</span></div>
          </div>
          <div class="ivs-card" style="margin-bottom:0;">
            <div class="ivs-card-h"><div class="ivs-card-t">期間盤差排行</div></div>
            <div class="ivs-note" style="margin-bottom:4px;">依「最大單日 |盤差％|」排序（前 10）</div>
            <div id="ivsRank"></div>
          </div>
        </div>
        <div class="ivs-drill" id="ivsDrill" hidden>
          <div class="ivs-card">
            <div class="ivs-card-h">
              <div class="ivs-card-t" id="ivsDrillT"></div>
              <span class="ivs-note" id="ivsDrillN"></span>
            </div>
            <div class="ivs-drill-grid">
              <div class="ivs-chart" id="ivsDK"></div>
              <div class="ivs-chart" id="ivsDV"></div>
            </div>
          </div>
        </div>
      </div>

      <div id="ivsImprove" hidden>
        <div class="ivs-heat-tools" style="margin-bottom:14px;">
          <span class="ivs-flabel">期間</span>
          <div class="sf-seg ivs-seg" id="ivsIDays">
            <button type="button" class="sf-seg-btn" data-d="14">14天</button>
            <button type="button" class="sf-seg-btn on" data-d="28">28天</button>
            <button type="button" class="sf-seg-btn" data-d="60">60天</button>
          </div>
          <span style="flex:1"></span>
          <span class="ivs-note" id="ivsIScope"></span>
        </div>
        <div class="ivs-score" id="ivsICards"></div>
        <div class="ivs-card">
          <div class="ivs-card-h">
            <div class="ivs-card-t">每日盤點準確率</div>
            <span class="ivs-note">盤差=0 的品項占當日已盤的比例，往上＝越準</span>
          </div>
          <div class="ivs-chart" id="ivsIAcc"></div>
        </div>
        <div class="ivs-card">
          <div class="ivs-card-h">
            <div class="ivs-card-t">每日盤差幅度</div>
            <div class="ivs-legend">
              <span class="ivs-lg"><span class="k" style="background:var(--ivs-line);"></span>平均絕對盤差%</span>
              <span class="ivs-lg"><span class="k" style="background:var(--ivs-up);"></span>加權絕對盤差%（依量）</span>
            </div>
          </div>
          <div class="ivs-chart" id="ivsIMag"></div>
        </div>
        <div class="ivs-drill-grid">
          <div class="ivs-card" style="margin-bottom:0;">
            <div class="ivs-card-h"><div class="ivs-card-t">進步榜</div><span class="ivs-note">前半段 → 後半段 平均 |盤差%| 降最多</span></div>
            <div id="ivsIUp"></div>
          </div>
          <div class="ivs-card" style="margin-bottom:0;">
            <div class="ivs-card-h"><div class="ivs-card-t">待改善榜</div><span class="ivs-note">近期仍偏高盤差，建議續盯</span></div>
            <div id="ivsIWatch"></div>
          </div>
        </div>
      </div>

      <div id="ivsTip" role="status"></div>
      </div>
      <script>
      (function(){
        "use strict";
        var ICPNO=${JSON.stringify(icpno)};
        var WHS=${whJson};
        var S={view:"charts", wh:"", gran:"d", period:30, item:null, hideZero:false, hDays:14, hOnly:false, hShowV:false, hShowAll:true, hQ:"", hSel:null, hScale:100, iDays:28, imp:null};
        var klineCache={}; // code|wh -> {scope,bars,variance}
        var heatCache={};  // wh|days -> {dates,items}
        var root=document.querySelector(".ivs-root");
        function css(n){ return getComputedStyle(root).getPropertyValue(n).trim(); }
        var tip=document.getElementById("ivsTip");
        function showTip(html,x,y){ tip.innerHTML=html; tip.style.display="block"; var r=tip.getBoundingClientRect(); var L=x+14,T=y+14; if(L+r.width>innerWidth-8)L=x-r.width-14; if(T+r.height>innerHeight-8)T=y-r.height-14; tip.style.left=L+"px"; tip.style.top=T+"px"; }
        function hideTip(){ tip.style.display="none"; }
        var NS="http://www.w3.org/2000/svg";
        function el(t,a,p){ var e=document.createElementNS(NS,t); for(var k in a)e.setAttribute(k,a[k]); if(p)p.appendChild(e); return e; }
        function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];}); }
        function niceTicks(min,max,n){ var span=max-min||1,step0=span/n,mag=Math.pow(10,Math.floor(Math.log(step0)/Math.LN10)); var cands=[1,2,2.5,5,10],step=10*mag; for(var i=0;i<cands.length;i++){ if(span/(cands[i]*mag)<=n){ step=cands[i]*mag; break; } } var t=[]; for(var v=Math.ceil(min/step)*step; v<=max+1e-9; v+=step)t.push(Math.round(v*1e6)/1e6); return t; }
        var WEEK="日一二三四五六";
        function mdOf(d){ return (+d.slice(5,7))+"/"+(+d.slice(8,10)); }
        // 補日曆日：沒推送快照的日子沿用前一日期末（syn 標記，畫成灰色持平棒），K 棒才不會跳日斷開
        function fillDaily(bars){
          if(bars.length<2) return bars;
          var map={}; bars.forEach(function(b){ map[b.d]=b; });
          var out=[],prev=null;
          var cur=new Date(bars[0].d+"T00:00:00"),end=new Date(bars[bars.length-1].d+"T00:00:00");
          var guard=0;
          while(cur<=end&&guard++<400){
            var d=cur.getFullYear()+"-"+String(cur.getMonth()+1).padStart(2,"0")+"-"+String(cur.getDate()).padStart(2,"0");
            var b=map[d];
            if(b){ out.push(b); prev=b; }
            else if(prev) out.push({d:d,open:prev.close,high:prev.close,low:prev.close,close:prev.close,syn:true});
            cur.setDate(cur.getDate()+1);
          }
          return out;
        }
        // 期初＝前一天的期末（串鏈）：舊快照只有收盤量也能連起來、每天都看得到當日變動
        function chainBars(bars){
          for(var i=0;i<bars.length;i++){
            var b=bars[i];
            if(i>0) b.open=bars[i-1].close;
            b.high=Math.max(b.high,b.open,b.close);
            b.low=Math.min(b.low,b.open,b.close);
          }
          return bars;
        }
        function wdOf(d){ try{ return WEEK[new Date(d+"T00:00:00").getDay()]; }catch(_){ return ""; } }
        function fmtN(v){ v=Number(v); if(v===0)v=0; return v.toLocaleString("zh-TW",{maximumFractionDigits:2}); }

        /* ── K 線（bars: [{d,open,high,low,close,varPct?,counted?,sys?}]） ── */
        function renderK(host,bars,unit,opts){
          opts=opts||{};
          host.innerHTML="";
          if(!bars.length){ host.innerHTML='<div class="ivs-empty">尚無每日庫存快照。庫存推送（LY_STOCK_TIMES／手動）啟用後就會開始累積，隔天起可看 K 線。</div>'; return; }
          var W=opts.w||960,H=opts.h||300,padL=56,padR=14,padT=14,padB=30;
          var svg=el("svg",{viewBox:"0 0 "+W+" "+H,"aria-label":"每日庫存K線圖"},host);
          var lo=Infinity,hi=-Infinity;
          bars.forEach(function(b){ lo=Math.min(lo,b.low); hi=Math.max(hi,b.high); if(b.counted!=null){ lo=Math.min(lo,b.counted); hi=Math.max(hi,b.counted); } });
          var pad=(hi-lo)*0.12||5; lo=lo-pad; hi=hi+pad;
          function X(i){ return padL+(i+0.5)*(W-padL-padR)/bars.length; }
          function Y(v){ return padT+(hi-v)*(H-padT-padB)/(hi-lo); }
          var slot=(W-padL-padR)/bars.length, bw=Math.max(3,Math.min(16,slot*0.75));
          niceTicks(lo,hi,5).forEach(function(v){
            el("line",{x1:padL,x2:W-padR,y1:Y(v),y2:Y(v),stroke:css("--ivs-grid"),"stroke-width":1},svg);
            el("text",{x:padL-8,y:Y(v)+4,"text-anchor":"end","font-size":11,fill:css("--ivs-mut"),style:"font-variant-numeric:tabular-nums"},svg).textContent=fmtN(v);
          });
          el("line",{x1:padL,x2:W-padR,y1:H-padB,y2:H-padB,stroke:css("--ivs-base"),"stroke-width":1},svg);
          var lblEvery=Math.ceil(bars.length/10);
          bars.forEach(function(b,i){ if(i%lblEvery===0) el("text",{x:X(i),y:H-padB+18,"text-anchor":"middle","font-size":11,fill:css("--ivs-mut")},svg).textContent=mdOf(b.d); });
          var upC=css("--ivs-up"),dnC=css("--ivs-down"),lineC=css("--ivs-line"),surfC=css("--ivs-card")||"#fff";
          // 期末連線（墊在 K 棒底下）：像看盤軟體一樣把每天串起來
          el("path",{d:bars.map(function(b,i){ return (i?"L":"M")+X(i).toFixed(1)+","+Y(b.close).toFixed(1); }).join(" "),
            fill:"none",stroke:css("--ivs-mut"),"stroke-width":1.2,opacity:.5,"stroke-linejoin":"round"},svg);
          bars.forEach(function(b,i){
            if(b.varPct!=null) el("line",{x1:X(i),x2:X(i),y1:padT,y2:H-padB,stroke:css("--ivs-base"),"stroke-width":1,"stroke-dasharray":"2 4"},svg);
            if(b.syn){ // 無推送日：灰色持平小橫棒（沿用前一日期末）
              el("line",{x1:X(i)-bw/2,x2:X(i)+bw/2,y1:Y(b.close),y2:Y(b.close),stroke:css("--ivs-base"),"stroke-width":1.6},svg);
              return;
            }
            var up=b.close>=b.open, col=up?upC:dnC;
            el("line",{x1:X(i),x2:X(i),y1:Y(b.high),y2:Y(b.low),stroke:col,"stroke-width":1.6},svg);
            var y1=Y(Math.max(b.open,b.close)),y2=Y(Math.min(b.open,b.close));
            el("rect",{x:X(i)-bw/2,y:y1,width:bw,height:Math.max(2,y2-y1),rx:2,fill:up?css("--ivs-up-soft"):col,stroke:col,"stroke-width":up?1.6:0},svg);
          });
          // 盤點量：藍點畫在實盤數的位置（虛線只標「這天有盤」，藍點才是盤了多少）
          bars.forEach(function(b,i){
            if(b.counted!=null) el("circle",{cx:X(i),cy:Y(b.counted),r:4,fill:lineC,stroke:surfC,"stroke-width":2},svg);
          });
          var cross=el("g",{style:"display:none"},svg);
          var cx=el("line",{y1:padT,y2:H-padB,stroke:css("--ivs-mut"),"stroke-width":1,"stroke-dasharray":"3 3"},cross);
          var hit=el("rect",{x:padL,y:padT,width:W-padL-padR,height:H-padT-padB,fill:"transparent"},svg);
          hit.addEventListener("mousemove",function(ev){
            var box=svg.getBoundingClientRect(),mx=(ev.clientX-box.left)*W/box.width;
            var i=Math.max(0,Math.min(bars.length-1,Math.floor((mx-padL)/slot)));
            var b=bars[i],net=b.close-b.open,sign=net>0?"＋":net<0?"−":"±";
            var gname=opts.granName||"當日";
            cross.style.display=""; cx.setAttribute("x1",X(i)); cx.setAttribute("x2",X(i));
            showTip('<div class="td">'+esc(b.d)+'（'+wdOf(b.d)+'）</div>'+
              (b.syn?'<div class="tr" style="color:var(--ivs-mut);"><span>當日無庫存推送，沿用前一日</span></div>':'')+
              '<div class="tr"><span>'+(gname==="當日"?"期初（昨日期末）":"期初")+'</span><b>'+fmtN(b.open)+'</b></div>'+
              '<div class="tr"><span>最高 / 最低</span><b>'+fmtN(b.high)+' / '+fmtN(b.low)+'</b></div>'+
              '<div class="tr"><span>期末</span><b>'+fmtN(b.close)+'</b></div>'+
              '<div class="tr"><span>'+gname+'變動</span><b style="color:'+(net>=0?upC:dnC)+'">'+sign+fmtN(Math.abs(net))+' '+esc(unit||"")+'</b></div>'+
              (b.counted!=null?'<div class="tr"><span>盤點（實盤）</span><b>'+fmtN(b.counted)+'（盤差 '+(b.varPct>0?"+":"")+b.varPct+'%）</b></div>':
               b.varPct!=null?'<div class="tr"><span>期間最大盤差</span><b>'+(b.varPct>0?"+":"")+b.varPct+'%</b></div>':
               '<div class="tr"><span>盤點</span><b>—（'+gname+'未盤）</b></div>'),ev.clientX,ev.clientY);
          });
          hit.addEventListener("mouseleave",function(){ cross.style.display="none"; hideTip(); });
        }

        /* ── 盤差％長條（pts: [{d,varPct,counted,sys}]）：0 軸置中、紅柱＝盤盈、藍柱＝盤虧（同熱力圖配色），方向大小一眼看出 ── */
        function renderV(host,pts,opts){
          opts=opts||{};
          host.innerHTML="";
          if(!pts.length){ host.innerHTML='<div class="ivs-empty">此期間沒有盤點記錄。</div>'; return; }
          var W=opts.w||960,H=opts.h||230,padL=56,padR=14,padT=20,padB=30;
          var svg=el("svg",{viewBox:"0 0 "+W+" "+H,"aria-label":"盤差百分比長條圖"},host);
          var m=3;
          pts.forEach(function(p){ if(p.varPct!=null) m=Math.max(m,Math.abs(p.varPct)); });
          var hi=Math.ceil(m*1.15+0.5),lo=-hi; // 上下對稱、0 在正中
          function X(i){ return padL+(i+0.5)*(W-padL-padR)/pts.length; }
          function Y(v){ return padT+(hi-v)*(H-padT-padB)/(hi-lo); }
          el("rect",{x:padL,y:Y(2),width:W-padL-padR,height:Y(-2)-Y(2),fill:css("--ivs-grid"),opacity:.55},svg);
          niceTicks(lo,hi,5).forEach(function(v){
            el("line",{x1:padL,x2:W-padR,y1:Y(v),y2:Y(v),stroke:css("--ivs-grid"),"stroke-width":1},svg);
            el("text",{x:padL-8,y:Y(v)+4,"text-anchor":"end","font-size":11,fill:css("--ivs-mut"),style:"font-variant-numeric:tabular-nums"},svg).textContent=v+"%";
          });
          el("line",{x1:padL,x2:W-padR,y1:Y(0),y2:Y(0),stroke:css("--ivs-base"),"stroke-width":1.2},svg);
          var lblEvery=Math.ceil(pts.length/10);
          pts.forEach(function(p,i){ if(i%lblEvery===0) el("text",{x:X(i),y:H-padB+18,"text-anchor":"middle","font-size":11,fill:css("--ivs-mut")},svg).textContent=mdOf(p.d); });
          var posC=css("--ivs-pos"),negC=css("--ivs-neg"),mutC=css("--ivs-mut");
          var slot=(W-padL-padR)/pts.length,bw=Math.max(6,Math.min(26,slot*0.55)),showLab=slot>=30;
          pts.forEach(function(p,i){
            var v=p.varPct==null?0:p.varPct,col=v>=0?posC:negC;
            var y0=Y(0),y1=Y(v),top=Math.min(y0,y1),hgt=Math.abs(y1-y0);
            if(hgt<2){ top=y0-1; hgt=2; } // 盤差 0% 也畫一小節：有盤、剛好沒差
            el("rect",{x:X(i)-bw/2,y:top,width:bw,height:hgt,rx:2,fill:col,opacity:v===0?.45:.9},svg);
            if(showLab) el("text",{x:X(i),y:v>=0?y1-5:y1+13,"text-anchor":"middle","font-size":10.5,"font-weight":700,fill:v===0?mutC:col,style:"font-variant-numeric:tabular-nums"},svg).textContent=(v>0?"+":"")+v+"%";
          });
          var hit=el("rect",{x:padL,y:padT,width:W-padL-padR,height:H-padT-padB,fill:"transparent"},svg);
          hit.addEventListener("mousemove",function(ev){
            var box=svg.getBoundingClientRect(),mx=(ev.clientX-box.left)*W/box.width;
            var i=Math.max(0,Math.min(pts.length-1,Math.floor((mx-padL)/slot)));
            var p=pts[i];
            showTip('<div class="td">'+esc(p.d)+'（'+wdOf(p.d)+'）</div>'+
              '<div class="tr"><span>系統（盤點當下）</span><b>'+fmtN(p.sys)+'</b></div>'+
              '<div class="tr"><span>實盤</span><b>'+fmtN(p.counted)+'</b></div>'+
              '<div class="tr"><span>盤差</span><b>'+(p.varPct>0?"+":"")+p.varPct+'%</b></div>',ev.clientX,ev.clientY);
          });
          hit.addEventListener("mouseleave",hideTip);
        }

        /* ── 週/月彙總 ── */
        function weekKey(d){ var t=new Date(d+"T00:00:00"); t.setDate(t.getDate()-((t.getDay()+6)%7)); return t.getFullYear()+"-"+t.getMonth()+"-"+t.getDate(); }
        function aggBars(bars,gran,count){
          var out=[],key=null,cur=null;
          bars.forEach(function(b){
            var k=gran==="w"?weekKey(b.d):b.d.slice(0,7);
            if(k!==key){ key=k; cur={d:b.d,open:b.open,close:b.close,high:b.high,low:b.low,varPct:null,counted:null,_ma:0}; out.push(cur); }
            cur.d=b.d; cur.close=b.close; cur.high=Math.max(cur.high,b.high); cur.low=Math.min(cur.low,b.low);
            if(b.varPct!=null&&Math.abs(b.varPct)>=cur._ma){ cur._ma=Math.abs(b.varPct); cur.varPct=b.varPct; }
          });
          return out.slice(-count);
        }
        function aggPts(pts,gran,count){
          var out=[],key=null,cur=null;
          pts.forEach(function(p){
            var k=gran==="w"?weekKey(p.d):p.d.slice(0,7);
            if(k!==key){ key=k; cur={d:p.d,varPct:p.varPct,counted:p.counted,sys:p.sys,_ma:Math.abs(p.varPct)}; out.push(cur); return; }
            cur.d=p.d;
            if(Math.abs(p.varPct)>=cur._ma){ cur._ma=Math.abs(p.varPct); cur.varPct=p.varPct; cur.counted=p.counted; cur.sys=p.sys; }
          });
          return out.slice(-count);
        }

        /* ── 三欄：粒度/期間、倉庫 ── */
        var GRANS=[["d","日 K","一根＝一天"],["w","週 K","一根＝一週"],["m","月 K","一根＝一個月"]];
        var PERIODS={d:[[14,"近 14 天"],[30,"近 30 天"],[90,"近 90 天"]],w:[[4,"近 4 週"],[13,"近 13 週"]],m:[[2,"近 2 個月"],[3,"近 3 個月"]]};
        function drawGranCol(){
          var host=document.getElementById("ivsGranCol"),h='<div class="ivs-col-h">檢視粒度</div>';
          GRANS.forEach(function(g){ h+='<button type="button" class="ivs-row'+(g[0]===S.gran?" on":"")+'" data-g="'+g[0]+'"><span>'+g[1]+'</span><span class="tag">'+g[2]+'</span></button>'; });
          h+='<div class="ivs-col-h" style="border-top:1px solid var(--ivs-grid);">期間</div>';
          PERIODS[S.gran].forEach(function(p){ h+='<button type="button" class="ivs-row'+(p[0]===S.period?" on":"")+'" data-p="'+p[0]+'"><span>'+p[1]+'</span></button>'; });
          host.innerHTML=h;
          host.querySelectorAll("[data-g]").forEach(function(b){ b.addEventListener("click",function(){ S.gran=b.dataset.g; S.period=PERIODS[S.gran][PERIODS[S.gran].length-1][0]; drawGranCol(); drawCharts(); }); });
          host.querySelectorAll("[data-p]").forEach(function(b){ b.addEventListener("click",function(){ S.period=+b.dataset.p; drawGranCol(); drawCharts(); }); });
        }
        function drawWhCol(){
          var h='<div class="ivs-col-h">倉庫</div>';
          h+='<button type="button" class="ivs-row'+(S.wh===""?" on":"")+'" data-w=""><span>全公司（各倉合計）</span></button>';
          WHS.forEach(function(w){ h+='<button type="button" class="ivs-row'+(S.wh===w.code?" on":"")+'" data-w="'+esc(w.code)+'"><span>'+esc(w.name||w.code)+'</span><span class="tag">'+esc(w.code)+'</span></button>'; });
          ["ivsWhCol","ivsHWhCol"].forEach(function(id){
            var host=document.getElementById(id);
            if(!host) return;
            host.innerHTML=h;
            host.querySelectorAll("[data-w]").forEach(function(b){ b.addEventListener("click",function(){
              S.wh=b.dataset.w; S.hSel=null; drawWhCol(); loadKline(); loadHeat();
              if(!document.getElementById("ivsListCard").hidden) loadGrid();
            }); });
          });
        }

        /* ── 資料載入 ── */
        function fetchJson(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }); }
        function loadKline(){
          if(!S.item){ drawCharts(); return; }
          var key=S.item.code+"|"+S.wh;
          if(klineCache[key]){ drawCharts(); return; }
          document.getElementById("ivsK").innerHTML='<div class="ivs-empty">載入中…</div>';
          fetchJson("/admin/inventory/stats/kline?icpno="+encodeURIComponent(ICPNO)+"&code="+encodeURIComponent(S.item.code)+"&wh="+encodeURIComponent(S.wh))
            .then(function(j){ klineCache[key]=j; drawCharts(); })
            .catch(function(e){ document.getElementById("ivsK").innerHTML='<div class="ivs-empty">載入失敗：'+esc(e.message)+'</div>'; });
        }
        function drawCharts(){
          if(S.view!=="charts"||!S.item) return;
          var kHost=document.getElementById("ivsK"),vHost=document.getElementById("ivsV");
          var j=klineCache[S.item.code+"|"+S.wh];
          if(!j) return;
          var granName=S.gran==="d"?"日":S.gran==="w"?"週":"月";
          document.getElementById("ivsKTitle").textContent=S.item.name+(S.item.spec?"（"+S.item.spec+"）":"")+" — 每"+granName+"庫存變動";
          var scopeTxt=S.wh&&j.scope==="company"?"⚠ 此倉尚無分倉每日快照，顯示全公司量（分倉資料自今日起累積）":(S.wh?"分倉量":"全公司量");
          document.getElementById("ivsKNote").textContent=scopeTxt+(S.item.unit?" · 單位："+S.item.unit:"");
          var vmap={}; (j.variance||[]).forEach(function(v){ vmap[v.d]={p:v.var_pct,c:v.counted,s:v.sys}; });
          var bars=fillDaily((j.bars||[]).map(function(b){ return {d:b.d,open:b.open,high:b.high,low:b.low,close:b.close}; }));
          bars.forEach(function(b){ var v=vmap[b.d]; b.varPct=v?v.p:null; b.counted=v?v.c:null; });
          bars=chainBars(bars);
          var pts=(j.variance||[]).map(function(v){ return {d:v.d,varPct:v.var_pct,counted:v.counted,sys:v.sys}; });
          if(S.gran==="d"){ bars=bars.slice(-S.period); var cut=bars.length?bars[0].d:""; pts=pts.filter(function(p){ return !cut||p.d>=cut; }); }
          else { bars=aggBars(bars,S.gran,S.period); pts=aggPts(pts,S.gran,S.period); }
          document.getElementById("ivsVNote").textContent=S.gran==="d"?"當日最後盤差；紅柱＝盤盈（實盤多）、藍柱＝盤虧（實盤少）；灰帶＝±2% 目標":"每"+granName+"取期間內最大 |盤差|；紅柱＝盤盈、藍柱＝盤虧；灰帶＝±2% 目標";
          renderK(kHost,bars,S.item.unit,{granName:"當"+granName});
          renderV(vHost,pts,{});
        }

        /* ── 品項總覽（整倉小圖卡牆）：每項一張 30 天走勢迷你圖，點卡片看大圖 ── */
        var seriesCache={}, listQ="", LIST_CAP=300;
        function loadGrid(){
          var key=S.wh;
          if(seriesCache[key]){ drawList(); return; }
          document.getElementById("ivsList").innerHTML='<div class="ivs-empty" style="grid-column:1/-1;">載入中…</div>';
          fetchJson("/admin/inventory/stats/series?icpno="+encodeURIComponent(ICPNO)+"&wh="+encodeURIComponent(S.wh)+"&days=30")
            .then(function(j){ seriesCache[key]=j; drawList(); })
            .catch(function(e){ document.getElementById("ivsList").innerHTML='<div class="ivs-empty" style="grid-column:1/-1;">載入失敗：'+esc(e.message)+'</div>'; });
        }
        function miniSpark(host,dates,closes,counts){
          // 迷你 K 棒：期初＝前一天期末（串鏈），紅空心＝增、綠實心＝減；藍點＝盤點實盤量、紅點＝|盤差|>2%
          var W=240,H=58,p=5;
          var svg=el("svg",{viewBox:"0 0 "+W+" "+H});
          var bars=[],prev=null;
          closes.forEach(function(c,i){
            if(c==null){ bars.push(prev==null?null:{o:prev,c:prev,syn:true}); return; }
            var o=prev==null?c:prev;
            bars.push({o:o,c:c}); prev=c;
          });
          var vals=[];
          bars.forEach(function(b){ if(b){ vals.push(b.o); vals.push(b.c); } });
          Object.keys(counts).forEach(function(d){ vals.push(counts[d].c); });
          if(!vals.length){ host.appendChild(svg); return; }
          var lo=Math.min.apply(null,vals),hi=Math.max.apply(null,vals);
          if(hi===lo)hi=lo+1;
          var slot=(W-2*p)/Math.max(dates.length,1);
          var bw=Math.max(2.5,Math.min(6,slot*0.6));
          var X=function(i){ return p+(i+0.5)*slot; };
          var Y=function(v){ return p+(hi-v)*(H-2*p)/(hi-lo); };
          var upC=css("--ivs-up"),dnC=css("--ivs-down"),surf=css("--ivs-card")||"#fff";
          // 期末連線墊底，K 棒視覺連續
          var lp="",pen=false;
          bars.forEach(function(b,i){ if(!b){ pen=false; return; } lp+=(pen?"L":"M")+X(i).toFixed(1)+","+Y(b.c).toFixed(1); pen=true; });
          if(lp) el("path",{d:lp,fill:"none",stroke:css("--ivs-mut"),"stroke-width":1,opacity:.5,"stroke-linejoin":"round"},svg);
          bars.forEach(function(b,i){
            if(!b) return;
            if(b.syn){ el("line",{x1:X(i)-bw/2,x2:X(i)+bw/2,y1:Y(b.c),y2:Y(b.c),stroke:css("--ivs-base"),"stroke-width":1.2},svg); return; }
            var up=b.c>=b.o,col=up?upC:dnC;
            var y1=Y(Math.max(b.o,b.c)),y2=Y(Math.min(b.o,b.c));
            el("rect",{x:X(i)-bw/2,y:y1,width:bw,height:Math.max(1.5,y2-y1),rx:1,
              fill:up?css("--ivs-up-soft"):col,stroke:col,"stroke-width":up?1:0},svg);
          });
          dates.forEach(function(d,i){
            var c=counts[d];
            if(c) el("circle",{cx:X(i),cy:Y(c.c),r:3,fill:Math.abs(c.v)>2?css("--ivs-up"):css("--ivs-line"),stroke:surf,"stroke-width":1.5},svg);
          });
          host.appendChild(svg);
        }
        function drawList(){
          var host=document.getElementById("ivsList");
          var j=seriesCache[S.wh];
          if(!j){ loadGrid(); return; }
          var q=listQ.toLowerCase();
          var list=q?j.items.filter(function(it){ return (it.code+" "+it.name+" "+(it.spec||"")).toLowerCase().indexOf(q)>=0; }):j.items.slice();
          if(S.hideZero) list=list.filter(function(it){ return it.qty==null||Number(it.qty)!==0; });
          var scopeTxt=S.wh&&j.scope==="company"?(j.whFiltered?"（品項已依倉別篩選；⚠ 此倉尚無分倉每日快照，走勢為全公司量）":"（⚠ 此倉尚無分倉每日快照，顯示全公司量）"):"";
          document.getElementById("ivsListCount").textContent="共 "+j.items.length+" 項"+((q||S.hideZero)?("，顯示 "+list.length+" 項"):"")+" · 近 30 天走勢，藍點＝盤點、紅點＝|盤差|>2%"+scopeTxt;
          if(!list.length){ host.innerHTML='<div class="ivs-empty" style="grid-column:1/-1;">'+(j.items.length?(q?("找不到「"+esc(listQ)+"」，換個關鍵字試試。"):"沒有庫存非 0 的品項（右上開關可切回全部）。"):"此範圍尚無每日快照資料（庫存推送啟用後開始累積）。")+'</div>'; return; }
          var shown=list.slice(0,LIST_CAP);
          host.innerHTML=shown.map(function(it,i){
            var first=null,last=null;
            it.closes.forEach(function(c){ if(c!=null){ if(first==null)first=c; last=c; } });
            var ch=(first==null||last==null)?null:(last-first);
            var dCls=ch==null||ch===0?"flat":(ch>0?"up":"down");
            var dTxt=ch==null?"—":(ch>0?"＋":ch<0?"−":"±")+fmtN(Math.abs(ch));
            var lastV=null,ds=Object.keys(it.counts).sort();
            if(ds.length) lastV=it.counts[ds[ds.length-1]].v;
            return '<button type="button" class="ivs-gcard" data-i="'+i+'">'+
              '<div class="gc-top"><span class="gc-nm">'+esc(it.name)+'</span><span class="gc-q">'+(it.qty==null?"—":fmtN(it.qty))+' '+esc(it.unit||"")+'</span></div>'+
              '<div class="gc-sub">'+esc(it.code)+(it.spec?" · "+esc(it.spec):"")+'</div>'+
              '<div class="gc-spark"></div>'+
              '<div class="gc-ft"><span class="gc-delta '+dCls+'">30天 '+dTxt+'</span>'+
              (lastV==null?'<span style="color:var(--ivs-mut);">未盤</span>':'<span class="ivs-pill '+(Math.abs(lastV)>2?"bad":"ok")+'">最新盤差 '+(lastV>0?"+":"")+lastV+'%</span>')+
              '</div></button>';
          }).join("")+(list.length>LIST_CAP?'<div class="ivs-empty" style="grid-column:1/-1;">僅顯示前 '+LIST_CAP+' 張，請用搜尋縮小範圍。</div>':'');
          host.querySelectorAll(".ivs-gcard").forEach(function(card){
            var it=shown[+card.dataset.i];
            miniSpark(card.querySelector(".gc-spark"),j.dates,it.closes,it.counts);
            card.addEventListener("click",function(){ selectItem(it); });
          });
        }
        function showList(){
          document.getElementById("ivsListCard").hidden=false;
          document.getElementById("ivsChartsArea").hidden=true;
          drawList();
        }
        function selectItem(it){
          if(!it) return;
          S.item=it;
          document.getElementById("ivsListCard").hidden=true;
          document.getElementById("ivsChartsArea").hidden=false;
          loadKline();
        }
        document.getElementById("ivsBack").addEventListener("click",showList);
        document.getElementById("ivsQ").addEventListener("input",function(){
          listQ=this.value.trim();
          showList(); // 打字＝回到清單即時過濾
        });
        document.getElementById("ivsHideZero").addEventListener("change",function(){
          S.hideZero=this.checked;
          if(!document.getElementById("ivsListCard").hidden) drawList();
        });

        /* ── 熱力圖 ── */
        function loadHeat(){
          if(S.view!=="heat") return;
          var key=S.wh+"|"+S.hDays;
          if(heatCache[key]){ drawHeat(); return; }
          document.getElementById("ivsHM").innerHTML='<div class="ivs-empty">載入中…</div>';
          fetchJson("/admin/inventory/stats/heatmap?icpno="+encodeURIComponent(ICPNO)+"&wh="+encodeURIComponent(S.wh)+"&days="+S.hDays)
            .then(function(j){ heatCache[key]=j; drawHeat(); })
            .catch(function(e){ document.getElementById("ivsHM").innerHTML='<div class="ivs-empty">載入失敗：'+esc(e.message)+'</div>'; });
        }
        function divColor(v){
          if(v==null) return "";
          var t=Math.max(-1,Math.min(1,v/S.hScale)),mid=css("--ivs-mid"),pole=t<0?css("--ivs-neg"):css("--ivs-pos");
          var k=Math.round(Math.pow(Math.abs(t),0.7)*100);
          return "color-mix(in oklab, "+pole+" "+k+"%, "+mid+")";
        }
        var HTOP=20;
        function heatVisible(j){
          var list=j.items.slice();
          if(S.hQ){ var s=S.hQ.toLowerCase(); list=list.filter(function(it){ return (it.name+it.code+(it.spec||"")).toLowerCase().indexOf(s)>=0; }); }
          var diffCount=list.filter(function(it){ return it.max_abs>0; }).length;
          if(S.hOnly) list=list.filter(function(it){ return it.max_abs>0; });
          var total=list.length;
          if(!S.hShowAll) list=list.slice(0,HTOP);
          return {list:list,total:total,diffCount:diffCount,all:j.items.length};
        }
        function drawHeat(){
          if(S.view!=="heat") return;
          var j=heatCache[S.wh+"|"+S.hDays];
          if(!j) return;
          var vis=heatVisible(j);
          document.getElementById("ivsHLgMin").textContent="−"+S.hScale+"%";
          document.getElementById("ivsHLgMax").textContent="＋"+S.hScale+"%";
          document.getElementById("ivsHCount").textContent="期間有盤點 "+vis.all+" 品項、有盤差 "+vis.diffCount+" 項；列出 "+vis.list.length+" 列（依最大 |盤差%| 排序）";
          var more=document.getElementById("ivsHMore");
          more.style.display=vis.total>HTOP?"":"none";
          more.textContent=S.hShowAll?("收合為 Top "+HTOP):("顯示全部 "+vis.total+" 項");
          var host=document.getElementById("ivsHM");
          if(!vis.list.length){ host.innerHTML='<div class="ivs-empty">'+(vis.all?"沒有符合的品項。":"此期間沒有盤點記錄。")+'</div>'; drawRank(j); return; }
          var h='<div class="ivs-hmg" style="grid-template-columns:150px repeat('+j.dates.length+',24px);">';
          h+='<div></div>';
          j.dates.forEach(function(d){ h+='<div class="hmg-h">'+mdOf(d)+'<br><span style="font-weight:400">'+wdOf(d)+'</span></div>'; });
          vis.list.forEach(function(it){
            h+='<div class="hmg-r" title="'+esc(it.name)+'">'+esc(it.name||it.code)+'</div>';
            j.dates.forEach(function(d){
              var c=it.cells[d],v=c?c.v:null;
              var sel=S.hSel&&S.hSel.code===it.code&&S.hSel.d===d?" sel":"";
              var fg=(S.hShowV&&v!=null&&Math.abs(v)>S.hScale/2)?"#fff":"inherit";
              h+='<button type="button" class="hmg-cell '+(S.hShowV?"showv":"")+sel+(v==null?" na":"")+'" data-code="'+esc(it.code)+'" data-d="'+d+'" style="background:'+divColor(v)+';color:'+(S.hShowV&&v!=null?fg:"")+'">'+(v==null?"":(v>0?"+":"")+v)+'</button>';
            });
          });
          host.innerHTML=h+'</div>';
          host.querySelectorAll(".hmg-cell").forEach(function(td){
            td.addEventListener("mousemove",function(ev){
              var it=j.items.filter(function(x){return x.code===td.dataset.code;})[0];
              var c=it&&it.cells[td.dataset.d];
              showTip('<div class="td">'+esc(it?it.name:"")+' · '+esc(td.dataset.d)+'</div>'+
                (c?'<div class="tr"><span>系統（盤點當下）</span><b>'+fmtN(c.sys)+'</b></div>'+(c.adj?'<div class="tr"><span>庫存調整</span><b>'+(c.adj>0?"+":"")+c.adj+'</b></div><div class="tr"><span>系統＋調整</span><b>'+fmtN(c.sys_adj)+'</b></div>':'')+'<div class="tr"><span>實盤</span><b>'+fmtN(c.counted)+'</b></div><div class="tr"><span>盤差'+(c.adj?"（含調整）":"")+'</span><b>'+(c.v>0?"+":"")+c.v+'%</b></div>':'<div class="tr"><span>當日未盤點</span></div>')+
                '<div style="color:var(--ivs-mut);margin-top:2px;">點擊查看下方詳情</div>',ev.clientX,ev.clientY);
            });
            td.addEventListener("mouseleave",hideTip);
            td.addEventListener("click",function(){ S.hSel={code:td.dataset.code,d:td.dataset.d}; drawHeat(); drawDrill(j); });
          });
          drawRank(j);
        }
        function drawRank(j){
          var ranked=j.items.slice().sort(function(a,b){ return b.max_abs-a.max_abs; }).slice(0,10);
          var host=document.getElementById("ivsRank");
          host.innerHTML=ranked.length?ranked.map(function(it,i){
            var bad=it.max_abs>2;
            return '<div class="ivs-rank" data-code="'+esc(it.code)+'"><span class="n">'+(i+1)+'</span><span class="nm">'+esc(it.name||it.code)+'</span><span class="sp">'+esc(it.spec||"")+'</span><span class="ivs-pill '+(bad?"bad":"ok")+'">'+it.max_abs.toFixed(1)+'%</span></div>';
          }).join(""):'<div class="ivs-empty">此期間沒有盤點記錄。</div>';
          host.querySelectorAll(".ivs-rank").forEach(function(row){
            row.addEventListener("click",function(){
              var it=j.items.filter(function(x){return x.code===row.dataset.code;})[0];
              if(!it) return;
              var worst=null,wv=-1;
              j.dates.forEach(function(d){ var c=it.cells[d]; if(c&&Math.abs(c.v)>wv){ wv=Math.abs(c.v); worst=d; } });
              S.hSel={code:it.code,d:worst||j.dates[j.dates.length-1]}; drawHeat(); drawDrill(j);
            });
          });
        }
        function drawDrill(j){
          var box=document.getElementById("ivsDrill");
          if(!S.hSel){ box.hidden=true; return; }
          var it=j.items.filter(function(x){return x.code===S.hSel.code;})[0];
          if(!it){ box.hidden=true; return; }
          box.hidden=false;
          var c=it.cells[S.hSel.d];
          document.getElementById("ivsDrillT").textContent=(it.name||it.code)+(it.spec?"（"+it.spec+"）":"")+" — 明細下鑽";
          document.getElementById("ivsDrillN").textContent="選取日 "+S.hSel.d+(c?("：盤差 "+(c.v>0?"+":"")+c.v+"%（系統"+(c.adj?"＋調整 "+fmtN(c.sys_adj):" "+fmtN(c.sys))+"／實盤 "+fmtN(c.counted)+"）"):"：當日未盤點");
          var key=it.code+"|"+S.wh;
          var render=function(kj){
            var vmap={}; (kj.variance||[]).forEach(function(v){ vmap[v.d]={p:v.var_pct,c:v.counted,s:v.sys}; });
            var bars=fillDaily((kj.bars||[]).map(function(b){ return {d:b.d,open:b.open,high:b.high,low:b.low,close:b.close}; }));
            bars.forEach(function(b){ var v=vmap[b.d]; b.varPct=v?v.p:null; b.counted=v?v.c:null; });
            bars=chainBars(bars).slice(-30);
            var cut=bars.length?bars[0].d:"";
            var pts=(kj.variance||[]).map(function(v){ return {d:v.d,varPct:v.var_pct,counted:v.counted,sys:v.sys}; }).filter(function(p){ return !cut||p.d>=cut; });
            renderK(document.getElementById("ivsDK"),bars,"",{w:620,h:250});
            renderV(document.getElementById("ivsDV"),pts,{w:620,h:250});
          };
          if(klineCache[key]) render(klineCache[key]);
          else fetchJson("/admin/inventory/stats/kline?icpno="+encodeURIComponent(ICPNO)+"&code="+encodeURIComponent(it.code)+"&wh="+encodeURIComponent(S.wh)).then(function(kj){ klineCache[key]=kj; render(kj); }).catch(function(){});
          box.scrollIntoView({behavior:"smooth",block:"nearest"});
        }
        document.getElementById("ivsHQ").addEventListener("input",function(){ S.hQ=this.value.trim(); drawHeat(); });
        document.getElementById("ivsHOnly").addEventListener("change",function(){ S.hOnly=this.checked; drawHeat(); });
        document.getElementById("ivsHShowV").addEventListener("change",function(){ S.hShowV=this.checked; drawHeat(); });
        document.getElementById("ivsHScale").addEventListener("click",function(ev){
          var b=ev.target.closest("button"); if(!b) return;
          this.querySelectorAll("button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on");
          S.hScale=+b.dataset.s; drawHeat();
        });
        document.getElementById("ivsHMore").addEventListener("click",function(){ S.hShowAll=!S.hShowAll; drawHeat(); });
        document.getElementById("ivsHDays").addEventListener("click",function(ev){
          var b=ev.target.closest("button"); if(!b) return;
          this.querySelectorAll("button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on");
          S.hDays=+b.dataset.d; S.hSel=null; loadHeat();
        });

        /* ── 盤差改善 ── */
        var impCache={};
        function loadImprove(){
          if(S.view!=="improve") return;
          if(impCache[S.iDays]){ S.imp=impCache[S.iDays]; drawImprove(); return; }
          document.getElementById("ivsICards").innerHTML='<div class="ivs-empty">載入中…</div>';
          document.getElementById("ivsIAcc").innerHTML=""; document.getElementById("ivsIMag").innerHTML="";
          document.getElementById("ivsIUp").innerHTML=""; document.getElementById("ivsIWatch").innerHTML="";
          fetchJson("/admin/inventory/stats/improvement?icpno="+encodeURIComponent(ICPNO)+"&days="+S.iDays)
            .then(function(j){ impCache[S.iDays]=j; S.imp=j; drawImprove(); })
            .catch(function(e){ document.getElementById("ivsICards").innerHTML='<div class="ivs-empty">載入失敗：'+esc(e.message)+'</div>'; });
        }
        function pctChg(a,b){ if(a==null||b==null||a===0) return null; return Math.round(((a-b)/Math.abs(a))*1000)/10; }
        function scoreTile(label,cur,prev,unit,higherBetter){
          if(cur==null){ return '<div class="ivs-tile"><div class="t-l">'+esc(label)+'</div><div class="t-v">—</div><div class="t-d flat">本週尚無盤點</div></div>'; }
          // 時間序：上週 → 本週（prev → cur），箭頭方向與時間一致才不誤讀
          var head=(prev==null)?(cur+unit):(prev+unit+' <span class="arw">→</span> '+cur+unit);
          var better,sub;
          if(prev==null){ better=null; sub="（無上週可比）"; }
          else if(higherBetter){ better=cur>=prev; var d=Math.round((cur-prev)*10)/10; sub=(better?"↑ 提升 ":"↓ 下降 ")+Math.abs(d)+" 個百分點"; }
          else { var pc=pctChg(prev,cur); better=cur<=prev; sub=(pc==null?"":(better?"↓ 縮小 ":"↑ 增加 ")+Math.abs(pc)+"%"); }
          var cls=(better==null)?"flat":(better?"good":"bad");
          return '<div class="ivs-tile"><div class="t-l">'+esc(label)+'</div>'+
            '<div class="t-v">'+head+'</div>'+
            '<div class="t-d '+cls+'">'+(better==null?"":(better?"改善　":"注意　"))+esc(sub)+'</div></div>';
        }
        /* 折線圖（series:[{key,color,label}]，rows:[{date,...}]） */
        function renderTrend(host,rows,series,opts){
          opts=opts||{}; host.innerHTML="";
          if(!rows.length){ host.innerHTML='<div class="ivs-empty">此期間沒有盤點記錄。</div>'; return; }
          var W=opts.w||960,H=opts.h||260,padL=48,padR=16,padT=16,padB=34;
          var svg=el("svg",{viewBox:"0 0 "+W+" "+H,"aria-label":esc(opts.aria||"")},host);
          var n=rows.length;
          var lo=opts.min!=null?opts.min:Infinity, hi=opts.max!=null?opts.max:-Infinity;
          if(opts.min==null||opts.max==null) rows.forEach(function(r){ series.forEach(function(s){ var v=r[s.key]; if(v==null)return; if(v<lo)lo=v; if(v>hi)hi=v; }); });
          if(!isFinite(lo))lo=0; if(!isFinite(hi))hi=1; if(hi<=lo)hi=lo+1;
          function X(i){ return n<=1?padL+(W-padL-padR)/2:padL+i*(W-padL-padR)/(n-1); }
          function Y(v){ return padT+(hi-v)*(H-padT-padB)/(hi-lo); }
          niceTicks(lo,hi,4).forEach(function(v){
            el("line",{x1:padL,x2:W-padR,y1:Y(v),y2:Y(v),stroke:css("--ivs-grid"),"stroke-width":1},svg);
            el("text",{x:padL-8,y:Y(v)+4,"text-anchor":"end","font-size":11,fill:css("--ivs-mut"),style:"font-variant-numeric:tabular-nums"},svg).textContent=v+(opts.unit||"");
          });
          var lblEvery=Math.ceil(n/8);
          rows.forEach(function(r,i){ if(i%lblEvery===0||i===n-1) el("text",{x:X(i),y:H-padB+18,"text-anchor":"middle","font-size":11,fill:css("--ivs-mut")},svg).textContent=mdOf(r.date); });
          series.forEach(function(s){
            var pts=rows.map(function(r,i){ return r[s.key]==null?null:X(i).toFixed(1)+","+Y(r[s.key]).toFixed(1); }).filter(Boolean);
            el("polyline",{points:pts.join(" "),fill:"none",stroke:css(s.color),"stroke-width":2,"stroke-linejoin":"round","stroke-linecap":"round"},svg);
            rows.forEach(function(r,i){ if(r[s.key]==null)return; el("circle",{cx:X(i),cy:Y(r[s.key]),r:3.2,fill:css("--ivs-card"),stroke:css(s.color),"stroke-width":2},svg); });
          });
          var slot=(W-padL-padR)/Math.max(1,n-1);
          var cross=el("g",{style:"display:none"},svg);
          var cx=el("line",{y1:padT,y2:H-padB,stroke:css("--ivs-mut"),"stroke-width":1,"stroke-dasharray":"3 3"},cross);
          var hit=el("rect",{x:0,y:0,width:W,height:H,fill:"transparent"},svg);
          hit.addEventListener("mousemove",function(ev){
            var box=svg.getBoundingClientRect(),mx=(ev.clientX-box.left)*W/box.width;
            var i=Math.max(0,Math.min(n-1,Math.round((mx-padL)/slot)));
            var r=rows[i]; cross.style.display=""; cx.setAttribute("x1",X(i)); cx.setAttribute("x2",X(i));
            var rowsHtml=series.map(function(s){ return '<div class="tr"><span>'+esc(s.label)+'</span><b>'+(r[s.key]==null?"—":r[s.key]+(opts.unit||""))+'</b></div>'; }).join("");
            showTip('<div class="td">'+esc(r.date)+'（'+wdOf(r.date)+'）</div>'+rowsHtml+'<div class="tr"><span>已盤品項</span><b>'+r.items+'</b></div>',ev.clientX,ev.clientY);
          });
          hit.addEventListener("mouseleave",function(){ cross.style.display="none"; hideTip(); });
        }
        function rankList(host,arr,mode){
          if(!arr.length){ host.innerHTML='<div class="ivs-empty">'+(mode==="up"?"此期間還看不出明顯進步的品項（需前後兩段都有盤點）。":"近期沒有仍偏高盤差的品項，讚！")+'</div>'; return; }
          host.innerHTML=arr.map(function(r){
            var nm=esc(r.name||r.code), sp=r.spec?'<span class="sp">'+esc(r.spec)+'</span>':"";
            var mv=(mode==="up")
              ? '<span class="mv" style="color:var(--ivs-down)">'+r.from+'% → '+r.to+'%</span>'
              : '<span class="mv" style="color:var(--ivs-up)">'+(r.before!=null?r.before+'% → ':'')+r.recent+'%</span>';
            return '<div class="ivs-irow"><span class="nm" title="'+esc(r.name)+'">'+nm+'</span>'+sp+mv+'</div>';
          }).join("");
        }
        function drawImprove(){
          if(S.view!=="improve"||!S.imp) return;
          var j=S.imp, sc=j.scorecard||{}, tw=sc.thisWeek||{}, pw=sc.prevWeek||{};
          document.getElementById("ivsIScope").textContent="近 "+j.days+" 天 · 有盤點 "+(j.daily?j.daily.length:0)+" 天 · 計分卡＝本週 vs 上週";
          document.getElementById("ivsICards").innerHTML=
            scoreTile("盤點準確率（盤差=0 占比）",tw.accuracy,pw.accuracy,"%",true)+
            scoreTile("平均絕對盤差%",tw.meanAbsPct,pw.meanAbsPct,"%",false)+
            scoreTile("加權絕對盤差%（依量）",tw.weightedAbsPct,pw.weightedAbsPct,"%",false)+
            scoreTile("嚴重盤差品項（>5%）",tw.itemsSevere==null?null:tw.itemsSevere,pw.itemsSevere==null?null:pw.itemsSevere,"",false);
          renderTrend(document.getElementById("ivsIAcc"),j.daily,[{key:"accuracy",color:"--ivs-down",label:"盤點準確率"}],{unit:"%",min:0,max:100,aria:"每日盤點準確率"});
          renderTrend(document.getElementById("ivsIMag"),j.daily,[
            {key:"meanAbsPct",color:"--ivs-line",label:"平均絕對盤差%"},
            {key:"weightedAbsPct",color:"--ivs-up",label:"加權絕對盤差%"}],{unit:"%",min:0,aria:"每日盤差幅度"});
          rankList(document.getElementById("ivsIUp"),j.improved||[],"up");
          rankList(document.getElementById("ivsIWatch"),j.watch||[],"watch");
        }
        document.getElementById("ivsIDays").addEventListener("click",function(ev){
          var b=ev.target.closest("button"); if(!b) return;
          this.querySelectorAll("button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on");
          S.iDays=+b.dataset.d; loadImprove();
        });

        /* ── 檢視切換 ── */
        document.getElementById("ivsView").addEventListener("click",function(ev){
          var b=ev.target.closest("button"); if(!b) return;
          this.querySelectorAll("button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on");
          S.view=b.dataset.v;
          document.getElementById("ivsCharts").hidden=S.view!=="charts";
          document.getElementById("ivsHeat").hidden=S.view!=="heat";
          document.getElementById("ivsImprove").hidden=S.view!=="improve";
          if(S.view==="heat") loadHeat(); else if(S.view==="improve") loadImprove(); else drawCharts();
        });

        /* ── 初始：先攤開整倉品項小圖，不預選 ── */
        drawGranCol(); drawWhCol(); loadGrid();
        new MutationObserver(function(){
          klineCache={};
          if(S.view==="charts"){ if(S.item&&document.getElementById("ivsListCard").hidden) loadKline(); else drawList(); }
          else if(S.view==="improve") drawImprove();
          else drawHeat();
        }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
      })();
      </script>`;
        res.type("text/html").send(notionPage("庫存統計圖表", body, "inv-stats", res));
    });
    router.get("/inventory/legacy", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const managerRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("inventory_manager");
        const managerName = managerRow?.value ?? "";
        const whFilter = (req.query.warehouse_id || "").trim();
        const qFilter = (req.query.q || "").trim().toLowerCase();
        const assignRows = await db.prepare(`
          SELECT iw.name AS warehouse_name, iwp.warehouse_id, iwp.product_id, p.name AS product_name, p.unit,
                 COALESCE(iwp.safety_stock, 0) AS safety_stock
          FROM inventory_warehouse_products iwp
          JOIN inventory_warehouses iw ON iw.id = iwp.warehouse_id
          JOIN products p ON p.id = iwp.product_id
          ORDER BY iw.sort_order, iw.name, iwp.sort_order, p.name
        `).all();
        const latestByWh = {};
        for (const w of warehouses) {
            const rec = await db.prepare("SELECT record_date, items FROM daily_inventory WHERE warehouse_id = ? ORDER BY record_date DESC LIMIT 1").get(w.id);
            if (rec) {
                const items = typeof rec.items === "string" ? JSON.parse(rec.items || "{}") : rec.items || {};
                latestByWh[w.id] = items;
            }
            else {
                latestByWh[w.id] = {};
            }
        }
        let rows = assignRows.map((r) => {
            const items = latestByWh[r.warehouse_id] || {};
            const current = items[r.product_id];
            const currentNum = current != null ? (typeof current === "number" ? current : parseFloat(current)) : null;
            return {
                warehouse_id: r.warehouse_id,
                warehouse_name: r.warehouse_name,
                product_id: r.product_id,
                product_name: r.product_name,
                unit: r.unit,
                safety_stock: Number(r.safety_stock) || 0,
                current_stock: currentNum,
            };
        });
        if (whFilter)
            rows = rows.filter((r) => r.warehouse_id === whFilter);
        if (qFilter)
            rows = rows.filter((r) => (r.product_name || "").toLowerCase().indexOf(qFilter) >= 0);
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whFilter ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 盤點作業</div>
        <h1 class="notion-page-title">盤點作業</h1>
        <div class="notion-card">
          <h2>各品項目前存量與安全庫存</h2>
          <form method="get" action="/admin/inventory/legacy" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <label>倉庫 <select name="warehouse_id" onchange="this.form.submit()"><option value="">全部</option>${optWh}</select></label>
            <label>搜尋品項 <input type="text" name="q" value="${escapeAttr(req.query.q || "")}" placeholder="品名"></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          <table>
            <thead><tr><th>倉庫</th><th>品項</th><th>單位</th><th>目前存量</th><th>安全庫存</th><th>狀態</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => {
          const low = r.safety_stock > 0 && (r.current_stock == null || Number(r.current_stock) < r.safety_stock);
          return `<tr><td>${escapeHtml(r.warehouse_name)}</td><td>${escapeHtml(r.product_name)}</td><td>${escapeHtml(r.unit || "")}</td><td>${r.current_stock != null ? r.current_stock : "—"}</td><td>${r.safety_stock}</td><td>${low ? "<span style=\"color:#c00;\">低於安全庫存</span>" : "正常"}</td></tr>`;
        }).join("") : "<tr><td colspan=\"6\">尚無品項歸倉資料，請先至「品項歸倉」設定。</td></tr>"}
            </tbody>
          </table>
        </div>
        <div class="notion-card">
          <h2>快速連結</h2>
          <ul style="margin:0;padding-left:20px;">
            <li><a href="/admin/inventory/warehouses">庫房管理</a> － 新增／編輯／刪除庫房（共 ${warehouses.length} 個）</li>
            <li><a href="/admin/inventory/assign">品項歸倉</a> － 將貨品管理中的品項填入指定庫房，並設定排序與安全庫存</li>
            <li><a href="/admin/inventory/daily">每日盤點</a> － 依日期與庫房填寫盤點數量</li>
            <li><a href="/admin/inventory/import-erp">匯入 ERP 資料</a> － 匯入銷貨數量以便計算盤差</li>
            <li><a href="/admin/inventory/variance-report">盤差報表</a> － 依倉庫與日期區間產出盤差、匯出與易盤差品項統計</li>
            <li><a href="/admin/inventory/manager">管理人設定</a> － ${managerName ? "目前管理人：" + escapeHtml(managerName) : "尚未設定管理人"}</li>
          </ul>
        </div>
      `;
        res.type("text/html").send(notionPage("盤點作業", body, "inventory", res));
    });
    router.get("/inventory/warehouses", async (req, res) => {
        const rows = await db.prepare("SELECT id, name, sort_order FROM inventory_warehouses ORDER BY sort_order, name").all();
        const managerRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("inventory_manager");
        const currentManager = (managerRow && managerRow.value) || "";
        const adminUsers = (await loadAdminUsers()).filter((u) => u.status === "active");
        const managerOpts = [`<option value="">— 未指定 —</option>`, ...adminUsers.map((u) => {
                const n = (u.name || u.username || "").trim();
                return `<option value="${escapeAttr(n)}" ${n === currentManager ? "selected" : ""}>${escapeHtml(n)}（${escapeHtml(u.title || "")}）</option>`;
            })].join("");
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已新增庫房。</p>" : req.query.ok === "edit" ? "<p class=\"notion-msg ok\">已儲存。</p>" : req.query.ok === "del" ? "<p class=\"notion-msg ok\">已刪除。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory/legacy">盤點作業</a> / 庫房管理</div>
        <h1 class="notion-page-title">庫房管理</h1>
        ${msg}
        <p style="margin-bottom:16px;"><a href="/admin/inventory/warehouses/new" class="btn btn-primary">＋ 新增庫房</a></p>
        <div class="notion-card" style="margin-bottom:16px;">
          <h2 style="margin-top:0;">盤點作業管理人</h2>
          <form method="post" action="/admin/inventory/manager" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label style="margin:0;">管理人姓名 <select name="manager_name">${managerOpts}</select></label>
            <button type="submit" class="btn btn-primary">儲存管理人</button>
          </form>
        </div>
        <div class="notion-card">
          <table>
            <thead><tr><th>順序</th><th>庫房名稱</th><th>操作</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => `<tr><td>${r.sort_order}</td><td>${escapeHtml(r.name)}</td><td><a href="/admin/inventory/warehouses/${encodeURIComponent(r.id)}/edit">編輯</a> | <a href="/admin/inventory/warehouses/${encodeURIComponent(r.id)}/delete">刪除</a></td></tr>`).join("") : "<tr><td colspan=\"3\">尚無庫房，請先新增。</td></tr>"}
            </tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("庫房管理", body, "inv-wh", res));
    });
    router.get("/inventory/warehouses/new", async (_req, res) => {
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory/legacy">盤點作業</a> / <a href="/admin/inventory/warehouses">庫房管理</a> / 新增庫房</div>
        <h1 class="notion-page-title">新增庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/inventory/warehouses/new">
            <label>庫房名稱 <input type="text" name="name" required placeholder="例：1號庫蔬菜"></label>
            <label>順序（數字，愈小愈前面） <input type="number" name="sort_order" value="0"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">新增</button> <a href="/admin/inventory/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("新增庫房", body, "inv-wh", res));
    });
    router.post("/inventory/warehouses/new", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = (req.body.name || "").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        if (!name) {
            res.redirect("/admin/inventory/warehouses/new?err=name");
            return;
        }
        const id = (0, id_js_1.newId)("invwh");
        const now = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare(`INSERT INTO inventory_warehouses (id, name, sort_order, created_at) VALUES (?, ?, ?, ${now})`).run(id, name, sortOrder);
        res.redirect("/admin/inventory/warehouses?ok=1");
    });
    router.get("/inventory/warehouses/:id/edit", async (req, res) => {
        const row = await db.prepare("SELECT id, name, sort_order FROM inventory_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/inventory/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory/legacy">盤點作業</a> / <a href="/admin/inventory/warehouses">庫房管理</a> / 編輯庫房</div>
        <h1 class="notion-page-title">編輯庫房</h1>
        <div class="notion-card">
          <form method="post" action="/admin/inventory/warehouses/${encodeURIComponent(row.id)}/edit">
            <label>庫房名稱 <input type="text" name="name" value="${escapeAttr(row.name)}" required></label>
            <label>順序 <input type="number" name="sort_order" value="${row.sort_order}"></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/inventory/warehouses" class="btn">取消</a></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("編輯庫房", body, "inv-wh", res));
    });
    router.post("/inventory/warehouses/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const name = (req.body.name || "").trim();
        const sortOrder = parseInt(req.body.sort_order, 10) || 0;
        const row = await db.prepare("SELECT id FROM inventory_warehouses WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/inventory/warehouses?err=notfound");
            return;
        }
        if (!name) {
            res.redirect("/admin/inventory/warehouses/" + encodeURIComponent(id) + "/edit?err=name");
            return;
        }
        await db.prepare("UPDATE inventory_warehouses SET name = ?, sort_order = ? WHERE id = ?").run(name, sortOrder, id);
        res.redirect("/admin/inventory/warehouses?ok=edit");
    });
    router.get("/inventory/warehouses/:id/delete", async (req, res) => {
        const row = await db.prepare("SELECT id, name FROM inventory_warehouses WHERE id = ?").get(req.params.id);
        if (!row) {
            res.redirect("/admin/inventory/warehouses?err=notfound");
            return;
        }
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory/legacy">盤點作業</a> / <a href="/admin/inventory/warehouses">庫房管理</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除庫房</h1>
        <div class="notion-card">
          <p>確定要刪除「${escapeHtml(row.name)}」？此庫房內已歸倉的品項與每日盤點紀錄將一併移除關聯。</p>
          <p style="margin-top:16px;">
            <form method="post" action="/admin/inventory/warehouses/${encodeURIComponent(row.id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form>
            <a href="/admin/inventory/warehouses" class="btn">取消</a>
          </p>
        </div>
      `;
        res.type("text/html").send(notionPage("確認刪除庫房", body, "inv-wh", res));
    });
    router.post("/inventory/warehouses/:id/delete", async (req, res) => {
        const id = req.params.id;
        // [fix 2026-07-08] 三段 DELETE 包進單一交易，中途失敗整批回滾，不留下「歸倉/盤點刪了但庫房還在」的半刪狀態。
        const doDelete = async (h) => {
            await h.prepare("DELETE FROM inventory_warehouse_products WHERE warehouse_id = ?").run(id);
            await h.prepare("DELETE FROM daily_inventory WHERE warehouse_id = ?").run(id);
            await h.prepare("DELETE FROM inventory_warehouses WHERE id = ?").run(id);
        };
        if (typeof db.transaction === "function") {
            await db.transaction(doDelete);
        }
        else {
            await doDelete(db);
        }
        res.redirect("/admin/inventory/warehouses?ok=del");
    });
    router.get("/inventory/assign", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const whId = req.query.warehouse_id?.trim() || (warehouses[0] && warehouses[0].id) || "";
        const searchQ = (req.query.q || "").trim().replace(/%/g, "");
        let inWarehouse = [];
        let allProducts = [];
        if (whId) {
            inWarehouse = await db.prepare("SELECT pwp.product_id, pwp.sort_order, COALESCE(pwp.safety_stock, 0) as safety_stock, p.name, p.unit FROM inventory_warehouse_products pwp JOIN products p ON p.id = pwp.product_id WHERE pwp.warehouse_id = ? ORDER BY pwp.sort_order, p.name").all(whId);
            if (searchQ) {
                const like = "%" + searchQ + "%";
                allProducts = await db.prepare("SELECT id, name, unit, erp_code FROM products WHERE (active = 1 OR active IS NULL) AND (name LIKE ? OR (erp_code IS NOT NULL AND erp_code LIKE ?)) ORDER BY name").all(like, like);
            }
            else {
                allProducts = await db.prepare("SELECT id, name, unit, erp_code FROM products WHERE active = 1 OR active IS NULL ORDER BY name").all();
            }
        }
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const availableProducts = whId ? allProducts.filter((p) => !inWarehouse.some((x) => x.product_id === p.id)) : [];
        const whName = whId ? (warehouses.find((w) => w.id === whId)?.name || "") : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory/legacy">盤點作業</a> / 品項歸倉</div>
        <h1 class="notion-page-title">品項歸倉</h1>
        ${req.query.ok === "1" ? "<p class=\"notion-msg ok\">已加入品項。</p>" : req.query.ok === "settings" ? "<p class=\"notion-msg ok\">已儲存排序與安全庫存。</p>" : req.query.ok === "remove" ? "<p class=\"notion-msg ok\">已移出。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : ""}
        <div class="notion-card assign-section">
          <div class="assign-section-title">區域一 · 選擇庫房</div>
          <h2 class="notion-card-title">庫房</h2>
          <p class="notion-hint">請先選定要設定的庫房；變更庫房後，第二區與第三區會跟著切換。</p>
          <form method="get" action="/admin/inventory/assign" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <label style="margin:0;">庫房 <select name="warehouse_id" onchange="this.form.submit()">${optWh || "<option value=\"\">— 請先至庫房管理新增庫房 —</option>"}</select></label>
          </form>
        </div>
        ${whId ? `
        <div class="notion-card assign-section">
          <div class="assign-section-title">區域二 · 搜尋並加入品項</div>
          <h2 class="notion-card-title">加入品項</h2>
          <p class="notion-hint">目標庫房：<strong>${escapeHtml(whName)}</strong>。將「貨品管理」中的品項加入此庫房後，才會出現在「每日盤點」。可先向伺服器<strong>模糊搜尋</strong>（品名／ERP），再在下方清單用<strong>第二個框</strong>即時篩選。</p>
          <form method="get" action="/admin/inventory/assign" style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:12px;">
            <input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}">
            <label style="margin:0;">伺服器搜尋（模糊） <input type="text" name="q" value="${escapeAttr(searchQ)}" placeholder="例如：高麗菜、LM…" style="min-width:220px;"></label>
            <button type="submit" class="btn">搜尋</button>
            ${searchQ ? `<a href="/admin/inventory/assign?warehouse_id=${encodeURIComponent(whId)}" class="btn" style="text-decoration:none;">清除搜尋</a>` : ""}
          </form>
          <p class="notion-hint">以下為尚未加入「${escapeHtml(whName)}」的品項；可在框內即時篩選（不經伺服器）。</p>
          <input type="text" id="addProductSearch" placeholder="輸入品名或 ERP 代碼篩選…" style="margin-bottom:12px;width:100%;max-width:420px;">
          <div id="addProductList" style="max-height:280px;overflow:auto;border:1px solid var(--notion-border);border-radius:6px;padding:8px;background:var(--notion-canvas);">
            ${availableProducts.length ? availableProducts.map((p) => `<div class="add-product-row" data-name="${escapeAttr((p.name || "") + " " + (p.erp_code || ""))}"><form method="post" action="/admin/inventory/assign/add" style="display:inline;"><input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}"><input type="hidden" name="product_id" value="${escapeAttr(p.id)}"><button type="submit" class="btn btn-primary" style="margin:2px;">加入</button></form> ${escapeHtml(p.name)}${p.erp_code ? " <span class=\"notion-hint\" style=\"display:inline;margin:0;\">(" + escapeHtml(p.erp_code) + ")</span>" : ""} ${p.unit ? "<span class=\"notion-hint\" style=\"display:inline;margin:0;\">" + escapeHtml(p.unit) + "</span>" : ""}</div>`).join("") : "<p class=\"notion-hint\" style=\"margin:0;\">— 已全加入或貨品管理尚無品項 —</p>"}
          </div>
          <script>
            (function(){
              var search=document.getElementById('addProductSearch'), list=document.getElementById('addProductList');
              if(!search || !list) return;
              search.oninput=search.onkeyup=function(){
                var q=(this.value||'').toLowerCase();
                [].forEach.call(list.querySelectorAll('.add-product-row'), function(row){
                  var text=(row.getAttribute('data-name')||'').toLowerCase();
                  row.style.display=!q || text.indexOf(q)>=0 ? '' : 'none';
                });
              };
            })();
          </script>
        </div>
        <div class="notion-card assign-section">
          <div class="assign-section-title">區域三 · 已歸入此庫房的品項</div>
          <h2 class="notion-card-title">已歸入品項（${inWarehouse.length} 項）</h2>
          <p class="notion-hint">可編輯排序與安全庫存，或將品項移出本庫房。</p>
          <form method="post" action="/admin/inventory/assign/update-settings">
            <input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}">
            <table>
              <thead><tr><th>排序</th><th>品項</th><th>單位</th><th>安全庫存量</th><th>操作</th></tr></thead>
              <tbody>
                ${inWarehouse.length ? inWarehouse.map((p) => `<tr><td><input type="number" name="sort_${escapeAttr(p.product_id)}" value="${p.sort_order}" style="width:60px;"></td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.unit || "")}</td><td><input type="number" step="any" name="safety_${escapeAttr(p.product_id)}" value="${p.safety_stock}" style="width:80px;" placeholder="0"></td><td><a href="#" onclick="document.getElementById('remove_${escapeAttr(p.product_id)}').submit();return false;">移出</a></td></tr>`).join("") : "<tr><td colspan=\"5\"><span class=\"notion-hint\" style=\"display:inline;margin:0;\">尚無品項，請從區域二「加入品項」新增。</span></td></tr>"}
              </tbody>
            </table>
            ${inWarehouse.length ? "<p style=\"margin-top:12px;\"><button type=\"submit\" class=\"btn btn-primary\">儲存排序與安全庫存</button></p>" : ""}
          </form>
          ${inWarehouse.map((p) => `<form id="remove_${escapeAttr(p.product_id)}" method="post" action="/admin/inventory/assign/remove" style="display:none;"><input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}"><input type="hidden" name="product_id" value="${escapeAttr(p.product_id)}"></form>`).join("")}
        </div>
        ` : `
        <div class="notion-card">
          <p class="notion-hint">請先至「庫房管理」新增庫房後，即可於<strong>區域一</strong>選擇庫房，並在<strong>區域二</strong>加入品項、<strong>區域三</strong>管理已歸入品項。</p>
        </div>
        `}
      `;
        res.type("text/html").send(notionPage("品項歸倉", body, "inv-assign", res));
    });
    router.post("/inventory/assign/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const whId = (req.body.warehouse_id || "").trim();
        const productId = (req.body.product_id || "").trim();
        if (!whId || !productId) {
            res.redirect("/admin/inventory/assign?err=missing");
            return;
        }
        const maxSort = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort FROM inventory_warehouse_products WHERE warehouse_id = ?").get(whId);
        const nextSort = (maxSort && maxSort.next_sort != null) ? maxSort.next_sort : 0;
        try {
            await db.prepare("INSERT INTO inventory_warehouse_products (warehouse_id, product_id, sort_order, safety_stock) VALUES (?, ?, ?, 0)").run(whId, productId, nextSort);
        }
        catch (_) { /* already in warehouse */ }
        res.redirect("/admin/inventory/assign?warehouse_id=" + encodeURIComponent(whId) + "&ok=1");
    });
    router.post("/inventory/assign/update-settings", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const whId = (req.body.warehouse_id || "").trim();
        if (!whId) {
            res.redirect("/admin/inventory/assign?err=missing");
            return;
        }
        const inWarehouse = await db.prepare("SELECT product_id FROM inventory_warehouse_products WHERE warehouse_id = ?").all(whId);
        for (const row of inWarehouse) {
            const pid = row.product_id;
            const sortVal = req.body["sort_" + pid];
            const safetyVal = req.body["safety_" + pid];
            const sortOrder = sortVal !== undefined && sortVal !== "" ? parseInt(String(sortVal), 10) : null;
            const safetyStock = safetyVal !== undefined && safetyVal !== "" ? parseFloat(String(safetyVal)) : null;
            if (sortOrder !== null && !Number.isNaN(sortOrder))
                await db.prepare("UPDATE inventory_warehouse_products SET sort_order = ? WHERE warehouse_id = ? AND product_id = ?").run(sortOrder, whId, pid);
            if (safetyStock !== null && !Number.isNaN(safetyStock))
                await db.prepare("UPDATE inventory_warehouse_products SET safety_stock = ? WHERE warehouse_id = ? AND product_id = ?").run(safetyStock, whId, pid);
        }
        res.redirect("/admin/inventory/assign?warehouse_id=" + encodeURIComponent(whId) + "&ok=settings");
    });
    router.post("/inventory/assign/remove", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const whId = (req.body.warehouse_id || "").trim();
        const productId = (req.body.product_id || "").trim();
        if (whId && productId)
            await db.prepare("DELETE FROM inventory_warehouse_products WHERE warehouse_id = ? AND product_id = ?").run(whId, productId);
        res.redirect("/admin/inventory/assign?warehouse_id=" + encodeURIComponent(whId || "") + "&ok=remove");
    });
    router.get("/inventory/daily", async (req, res) => {
        const date = req.query.date?.trim() || new Date().toISOString().slice(0, 10);
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const whId = req.query.warehouse_id?.trim() || (warehouses[0] && warehouses[0].id) || "";
        let products = [];
        let existing = null;
        if (whId) {
            products = await db.prepare("SELECT pwp.product_id, pwp.sort_order, p.name, p.unit FROM inventory_warehouse_products pwp JOIN products p ON p.id = pwp.product_id WHERE pwp.warehouse_id = ? ORDER BY pwp.sort_order, p.name").all(whId);
            const rec = await db.prepare("SELECT id, filler_name, items, confirmed_at FROM daily_inventory WHERE record_date = ? AND warehouse_id = ?").get(date, whId);
            existing = rec;
        }
        const itemsJson = existing && existing.items ? (typeof existing.items === "string" ? JSON.parse(existing.items || "{}") : existing.items) : {};
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存盤點。</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory/legacy">盤點作業</a> / 每日盤點</div>
        <h1 class="notion-page-title">每日盤點</h1>
        ${msg}
        <form method="get" action="/admin/inventory/daily" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <label>日期 <input type="date" name="date" value="${escapeAttr(date)}"></label>
          <label>庫房 <select name="warehouse_id" onchange="this.form.submit()">${optWh || "<option value=\"\">— 請先新增庫房並品項歸倉 —</option>"}</select></label>
          <button type="submit" class="btn">查詢</button>
        </form>
        ${whId && products.length ? `
        <div class="notion-card">
          <form method="post" action="/admin/inventory/daily/save">
            <input type="hidden" name="record_date" value="${escapeAttr(date)}">
            <input type="hidden" name="warehouse_id" value="${escapeAttr(whId)}">
            <label>填表人 <input type="text" name="filler_name" value="${escapeAttr(existing?.filler_name || "")}" placeholder="填表人姓名"></label>
            <table>
              <thead><tr><th>品項</th><th>單位</th><th>數量</th></tr></thead>
              <tbody>
                ${products.map((p) => {
            const qty = itemsJson[p.product_id] != null ? itemsJson[p.product_id] : "";
            return `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.unit || "")}</td><td><input type="text" inputmode="decimal" name="qty_${escapeAttr(p.product_id)}" value="${escapeAttr(String(qty))}" placeholder="0"></td></tr>`;
        }).join("")}
              </tbody>
            </table>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存盤點</button></p>
          </form>
          ${existing?.confirmed_at ? "<p class=\"notion-msg ok\">此筆已確認。</p>" : ""}
        </div>
        ` : whId ? "<p class=\"notion-msg err\">此庫房尚無品項，請先至「品項歸倉」將品項加入此庫房。</p>" : ""}
      `;
        res.type("text/html").send(notionPage("每日盤點", body, "inv-daily", res));
    });
    router.post("/inventory/daily/save", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const recordDate = (req.body.record_date || "").trim();
        const warehouseId = (req.body.warehouse_id || "").trim();
        const fillerName = (req.body.filler_name || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || !warehouseId) {
            res.redirect("/admin/inventory/daily?err=date");
            return;
        }
        const items = {};
        for (const [k, v] of Object.entries(req.body)) {
            if (k.startsWith("qty_") && v !== "" && v !== undefined) {
                const productId = k.slice(4);
                const num = parseFloat(String(v).trim());
                if (!Number.isNaN(num))
                    items[productId] = num;
                else
                    items[productId] = String(v).trim();
            }
        }
        const id = recordDate + "_" + warehouseId;
        const now = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        const itemsStr = JSON.stringify(items);
        const existing = await db.prepare("SELECT id FROM daily_inventory WHERE record_date = ? AND warehouse_id = ?").get(recordDate, warehouseId);
        if (existing) {
            await db.prepare("UPDATE daily_inventory SET filler_name = ?, recorded_at = " + now + ", items = ? WHERE id = ?").run(fillerName || "—", itemsStr, existing.id);
        }
        else {
            await db.prepare("INSERT INTO daily_inventory (id, record_date, warehouse_id, filler_name, recorded_at, items) VALUES (?, ?, ?, ?, " + now + ", ?)").run(id, recordDate, warehouseId, fillerName || "—", itemsStr);
        }
        res.redirect("/admin/inventory/daily?date=" + encodeURIComponent(recordDate) + "&warehouse_id=" + encodeURIComponent(warehouseId) + "&ok=1");
    });
    router.get("/inventory/import-erp", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}">${escapeHtml(w.name)}</option>`).join("");
        const count = req.query.count ? Number(req.query.count) : 0;
        const msg = req.query.ok ? "<p class=\"notion-msg ok\">已匯入 ERP 資料" + (count ? "，共 " + count + " 筆。" : "。") + "</p>" : req.query.err ? "<p class=\"notion-msg err\">" + escapeHtml(String(req.query.err)) + "</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory/legacy">盤點作業</a> / 匯入 ERP 資料</div>
        <h1 class="notion-page-title">匯入 ERP 銷貨資料</h1>
        ${msg}
        <p>上傳 CSV 或貼上內容，格式：<strong>日期,品項,銷貨數量,倉庫</strong>。日期為 YYYY-MM-DD；品項為品項 ID 或品名；倉庫為倉庫 ID 或名稱（可省略則需於下方選擇預設倉庫）。</p>
        <div class="notion-card">
          <form method="post" action="/admin/inventory/import-erp" enctype="multipart/form-data">
            <label>預設倉庫（當 CSV 未含倉庫欄時使用） <select name="default_warehouse_id">${optWh || "<option value=\"\">— 請先新增庫房 —</option>"}</select></label>
            <label>CSV 檔案 <input type="file" name="csv_file" accept=".csv,.txt"></label>
            <p>或貼上 CSV 內容：</p>
            <textarea name="csv_text" rows="10" style="width:100%;" placeholder="日期,品項,銷貨數量,倉庫"></textarea>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">匯入</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("匯入 ERP 資料", body, "inv-erp", res));
    });
    const multer = require("multer");
    const uploadMemory = multer({ storage: multer.memoryStorage() });
    router.post("/inventory/import-erp", uploadMemory.single("csv_file"), async (req, res) => {
        const body = req.body || {};
        const defaultWhId = body.default_warehouse_id ? String(body.default_warehouse_id).trim() : "";
        let raw = "";
        if (body.csv_text)
            raw = String(body.csv_text).trim();
        else if (req.file && req.file.buffer)
            raw = req.file.buffer.toString("utf-8");
        if (!raw) {
            res.redirect("/admin/inventory/import-erp?err=no_data");
            return;
        }
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses").all();
        const whById = Object.fromEntries(warehouses.map((w) => [w.id, w]));
        const whByName = Object.fromEntries(warehouses.map((w) => [w.name, w]));
        const products = await db.prepare("SELECT id, name FROM products").all();
        const productById = Object.fromEntries(products.map((p) => [p.id, p]));
        const productByName = Object.fromEntries(products.map((p) => [p.name, p]));
        const now = process.env.DATABASE_URL ? new Date().toISOString() : new Date().toISOString();
        const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        // [fix 2026-07-08] 先解析成待寫入列，再「先刪同(日期,倉別)範圍舊資料、後插入」包進交易＝可重複匯入(冪等)。
        // 過去每列都 INSERT 新 id，重匯同一份 CSV 會把銷貨量加倍、盤差報表全錯。
        const parsedRows = [];
        const scopeKeys = new Set();
        for (let i = 0; i < lines.length; i++) {
            const cells = lines[i].split(",").map((c) => c.trim());
            if (cells.length < 3)
                continue;
            const dateStr = cells[0];
            const productKey = cells[1];
            const qty = parseFloat(cells[2]);
            const whKey = cells[3];
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || Number.isNaN(qty))
                continue;
            const product = productById[productKey] || productByName[productKey];
            const wh = (whKey && (whById[whKey] || whByName[whKey])) || (defaultWhId && whById[defaultWhId]);
            if (!product || !wh)
                continue;
            parsedRows.push({ dateStr, wid: wh.id, pid: product.id, qty });
            scopeKeys.add(wh.id + " " + dateStr);
        }
        let imported = 0;
        const doImport = async (h) => {
            // 先清掉本次匯入涵蓋的每個(倉別,日期)既有資料，再插入 → 重匯是「取代」而非「累加」
            for (const key of scopeKeys) {
                const [wid, dateStr] = key.split(" ");
                await h.prepare("DELETE FROM erp_sales WHERE warehouse_id = ? AND record_date = ?").run(wid, dateStr);
            }
            for (const r of parsedRows) {
                const id = (0, id_js_1.newId)("erp");
                await h.prepare("INSERT INTO erp_sales (id, record_date, warehouse_id, product_id, qty_sold, imported_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, r.dateStr, r.wid, r.pid, r.qty, now);
                imported++;
            }
        };
        if (typeof db.transaction === "function") {
            await db.transaction(doImport);
        }
        else {
            await doImport(db);
        }
        res.redirect("/admin/inventory/import-erp?ok=1&count=" + imported);
    });
    // ── 目前庫存（凌越 SK_NOWQTY 快照）─────────────────────────────────
    async function readStockMeta() {
        const get = async (k) => {
            const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k);
            return r && r.value != null ? String(r.value) : "";
        };
        return {
            snapshot_at: await get("erp_stock_snapshot_at"),
            // 分倉庫存（erp_stock_wh_qty）最後覆蓋時間；推送沒帶 warehouse_qty 時不會更新
            wh_snapshot_at: await get("erp_stock_wh_snapshot_at"),
            item_count: await get("erp_stock_item_count"),
            refresh_status: await get("erp_stock_refresh_status"),
            refresh_requested_at: await get("erp_stock_refresh_requested_at"),
            refresh_error: await get("erp_stock_refresh_error"),
            refresh_error_at: await get("erp_stock_refresh_error_at"),
            // 內網代理三條背景線各自的心跳（/wait＝訂單回寫、inventory-wait＝庫存推送、txn-wait＝進銷存查詢）
            agent_last_wait_at: await get("ly_agent_last_wait_at"),
            agent_last_inventory_wait_at: await get("ly_agent_last_inventory_wait_at"),
            agent_last_txn_wait_at: await get("ly_agent_last_txn_wait_at"),
        };
    }
    // 目前庫存頁有推送資料的公司清單（松富00 一定在最前）
    async function listStockCompanies() {
        let rows = [];
        try { rows = (await db.prepare("SELECT DISTINCT COALESCE(NULLIF(TRIM(icpno),''),'00') AS c FROM erp_stock_items").all()) || []; } catch (_) { rows = []; }
        const set = new Set((rows || []).map((r) => (0, erp_companies_js_1.normIcpno)(r.c)));
        set.add("00");
        return Array.from(set).sort();
    }
    router.get("/inventory/stock", async (req, res) => {
        const icpno = stickyIcpno(req, res);
        const companies = await listStockCompanies();
        // 各公司品項數（左欄公司選擇器顯示；沒推過的公司顯示「未推」）
        const companyCounts = {};
        try { (await db.prepare("SELECT COALESCE(NULLIF(TRIM(icpno),''),'00') AS ic, COUNT(*) AS n FROM erp_stock_items GROUP BY ic").all() || []).forEach((r) => { companyCounts[(0, erp_companies_js_1.normIcpno)(r.ic)] = Number(r.n || 0); }); } catch (_) { }
        // 左欄固定列出全部四家（00 松富、01 龍港、02 松揚、03 松成），方便隨時切換
        const allCompanies = Object.keys(erp_companies_js_1.ERP_COMPANY_NAMES).sort();
        const stockRows = await db.prepare("SELECT erp_code, name, spec, unit, qty, wh_code FROM erp_stock_items WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? ORDER BY erp_code").all(icpno);
        // 人工調整值：顯示庫存＝凌越快照 + delta（彌補系統誤差）。keyed by 料號（本頁已限定單一公司）。
        const adjMap = {};
        try { (await db.prepare("SELECT erp_code, delta FROM stock_adjustment WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icpno) || []).forEach((r) => { adjMap[String(r.erp_code)] = Number(r.delta || 0); }); } catch (_) { }
        // [未來銷貨加回] 提前打進凌越的未來日期銷貨會扣掉快照量 → futMap 記每料號未來淨量（正＝要加回）。
        // 開關 stock_future_reversal_enabled=1 時顯示量含加回；關閉時遮蔽（回原凌越量方便對照查詢）。
        const futMap = {};
        try { (await db.prepare("SELECT erp_code, qty FROM erp_future_sales WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icpno) || []).forEach((r) => { futMap[String(r.erp_code)] = Number(r.qty || 0); }); } catch (_) { }
        let futOn = false;
        try { const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("stock_future_reversal_enabled"); futOn = !!(r && String(r.value) === "1"); } catch (_) { }
        const assignRows = await db.prepare(`
      SELECT p.erp_code AS code, w.name AS wh_name, w.sort_order AS wh_sort, COALESCE(iwp.safety_stock, 0) AS safety
      FROM inventory_warehouse_products iwp
      JOIN products p ON p.id = iwp.product_id
      JOIN inventory_warehouses w ON w.id = iwp.warehouse_id
      WHERE p.erp_code IS NOT NULL AND TRIM(p.erp_code) <> ''
    `).all();
        const assign = {};
        for (const a of assignRows || []) {
            const code = String(a.code || "").trim();
            if (!code)
                continue;
            (assign[code] = assign[code] || []).push({ wh: String(a.wh_name || ""), sort: Number(a.wh_sort || 0), safety: Number(a.safety || 0) });
        }
        const items = (stockRows || []).map((r) => {
            const c = String(r.erp_code || "");
            const raw = Number(r.qty || 0);
            const adj = Number(adjMap[c] || 0);
            const fut = Number(futMap[c] || 0);
            // 顯示量＝凌越 + 人工調整（+ 未來銷貨加回，僅開關打開時）
            const shown = (raw + adj) + (futOn ? fut : 0);
            return {
                c,
                n: String(r.name || ""),
                s: String(r.spec || ""),
                u: String(r.unit || ""),
                q: (adj || (futOn && fut)) ? Math.round(shown * 100) / 100 : raw, // 顯示量
                qraw: (adj || fut) ? raw : undefined, // 原凌越量（有調整/未來加回時給 badge/tooltip）
                adj: adj || undefined,
                fut: fut || undefined, // 未來銷貨淨量（恆帶，供 badge；是否計入 q 由 futOn 決定）
                w: String(r.wh_code || ""),
            };
        });
        // 倉別代號→中文名（倉庫設定頁維護），給前端把標籤/欄位顯示成「代號 中文名」
        const whRows = await db.prepare("SELECT code, name FROM erp_warehouse WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icpno);
        const whname = {};
        for (const w of whRows || []) {
            const nm = String(w.name || "").trim();
            if (nm)
                whname[String(w.code)] = nm;
        }
        // 品項照片（第四波）：只帶「有照片的料號清單」給前端（data URI 不進此 JSON，縮圖走取圖端點）
        let photoCodes = [];
        try { photoCodes = (await db.prepare("SELECT erp_code FROM erp_stock_item_photo").all() || []).map((r) => String(r.erp_code || "")).filter(Boolean); } catch (_) { photoCodes = []; }
        // 保留多公司 icpno（多公司架構）＋ photos（照片清單），兩者都給前端
        const dataJson = JSON.stringify({ items, assign, whname, icpno, futOn, photos: photoCodes }).replace(/</g, "\\u003c");
        const meta = await readStockMeta();
        // 快照時間按公司顯示（推送時每家各記一份；查無＝該公司還沒推過）
        let snapAt = meta.snapshot_at;
        try {
            const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_stock_snapshot_at_" + icpno);
            if (r && r.value) snapAt = String(r.value);
            else if (icpno !== "00") snapAt = "";
        } catch (_) { }
        const snapLabel = snapAt ? fmtTaipeiYMDHM(snapAt, "尚無資料") : "尚無資料";
        // [ops 2026-07-10] 內網代理心跳顯示：代理有三條背景線（訂單回寫 /wait、庫存推送 inventory-wait、
        // 進銷存查詢 txn-wait），各自 upsert 自己的心跳鍵。GUI 可單獨關掉回寫自動處理（wb_auto），
        // 屆時 /wait 不再進來、但庫存線仍正常——所以「最後連線」取三鍵的最大值，避免庫存明明正常卻紅字；
        // 三線各自時間放進 title（滑過可看哪條線多久沒動）。超過 10 分鐘三線都沒連＝代理可能掛了，紅字提醒
        // （偵測交由此處顯示，不做定時器）。
        const agentBeats = [
            ["訂單回寫", meta.agent_last_wait_at],
            ["庫存推送", meta.agent_last_inventory_wait_at],
            ["進銷存查詢", meta.agent_last_txn_wait_at],
        ];
        let agentLabel = "尚無紀錄";
        let agentStale = false;
        let agentLastTs = NaN;
        for (const [, iso] of agentBeats) {
            if (!iso)
                continue;
            const t = Date.parse(iso);
            if (Number.isFinite(t) && (!Number.isFinite(agentLastTs) || t > agentLastTs))
                agentLastTs = t;
        }
        if (Number.isFinite(agentLastTs)) {
            const mins = Math.max(0, Math.floor((Date.now() - agentLastTs) / 60000));
            agentStale = mins > 10;
            agentLabel = mins < 1 ? "剛剛" : `${mins} 分鐘前`;
        }
        const agentTitle = agentBeats
            .map(([nm, iso]) => `${nm}：${iso ? fmtTaipeiYMDHM(iso, "尚無紀錄") : "尚無紀錄"}`)
            .join("\n");
        const body = `
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 目前庫存</div>
      <style>${STK_STYLE}</style>
      <div class="stk-wrap">
        <div class="stk-toolbar no-print">
          <div class="stk-toolbar-left">
            <input type="search" id="stkSearch" class="stk-search" placeholder="搜尋料號 / 品名 / 規格…" autocomplete="off" spellcheck="false">
            <div class="sf-seg" id="stkView">
              <button type="button" data-v="list" class="active">列表</button>
              <button type="button" data-v="group">依倉庫</button>
            </div>
            <label class="sf-switch-label"><input type="checkbox" id="stkHideZero"><span class="sf-switch"></span>隱藏 0</label>
            <label class="sf-switch-label"><input type="checkbox" id="stkLowOnly"><span class="sf-switch"></span>只看低量/負量</label>
            <label class="sf-switch-label" title="提前打進凌越的『未來日期銷貨』會先扣掉庫存；打開＝把這批未出貨的量加回顯示，關閉＝遮蔽回原凌越量方便對照查詢。"><input type="checkbox" id="stkFutRev"${futOn ? " checked" : ""}><span class="sf-switch"></span>未來銷貨加回</label>
          </div>
          <div class="stk-toolbar-right">
            <span class="stk-meta" id="stkMeta">資料時間：<b>${escapeHtml(snapLabel)}</b> · <span id="stkCount">${items.length}</span> 品項 · 內網代理最後連線：<b title="${escapeHtml(agentTitle)}"${agentStale ? ' style="color:#b91c1c;"' : ""}>${escapeHtml(agentLabel)}</b></span>
            <button type="button" id="stkExport" class="btn">匯出</button>
            <button type="button" id="stkRefresh" class="btn btn-primary">庫存更新</button>
          </div>
        </div>
        <div id="stkStatus" class="stk-status" style="display:none;"></div>
        <div class="stk-main">
          <aside class="stk-rail stk-corail no-print"><div class="stk-rail-h">公司</div><div class="stk-rail-body">${allCompanies.map((c) => { const n = companyCounts[c] || 0; return `<a class="stk-rail-item${c === icpno ? " active" : ""}" href="/admin/inventory/stock?icpno=${c}"><span class="stk-rail-name">${escapeHtml((0, erp_companies_js_1.erpCompanyName)(c))}</span><span class="stk-rail-n">${n > 0 ? n : "未推"}</span></a>`; }).join("")}</div></aside>
          <aside class="stk-rail no-print"><div class="stk-rail-h">倉庫</div><div class="stk-rail-body" id="stkRail"></div></aside>
          <div id="stkTableWrap" class="stk-tablewrap"></div>
        </div>
      </div>
      <script id="stkData" type="application/json">${dataJson}</script>
      <script>${STK_CLIENT_JS}</script>`;
        res.type("text/html").send(notionPage("目前庫存", body, "inv-stock", res));
    });
    // ── 品項照片（第四波，借鏡 Sortly）：後台上傳圖片 → sharp 縮到最長邊 400px、JPEG q72 →
    //    存成 data URI 進 erp_stock_item_photo（此 repo 無 GCS，data URI 雲端持久、雙庫相容）。
    //    照片表獨立，不受庫存推送全表覆蓋影響。────────────────────────────────
    const uploadItemPhoto = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }).single("image");
    // 取圖：把 data URI 解成 buffer 回 image/*（縮圖與放大共用；同源、cookie 認證）
    router.get("/inventory/item-photo/:erpCode", async (req, res) => {
        try {
            const code = String(req.params.erpCode || "").trim();
            if (!code) { res.status(400).end(); return; }
            const row = await db.prepare("SELECT photo_url FROM erp_stock_item_photo WHERE erp_code = ?").get(code);
            if (!row || !row.photo_url) { res.status(404).end(); return; }
            const m = /^data:([^;]+);base64,(.*)$/i.exec(String(row.photo_url));
            if (!m) { res.status(404).end(); return; }
            const buf = Buffer.from(m[2], "base64");
            // [fix 2026-07-10] 寫死 image/jpeg，不信任存的 MIME（上傳端一律 sharp→jpeg）；
            // 杜絕未來若有旁路存入 data:image/svg+xml 時、直接導航此端點被當 SVG 同源渲染執行 script。
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Cache-Control", "private, max-age=60");
            res.end(buf);
        } catch (e) { console.error("[admin item-photo get]", e?.message || e); res.status(500).end(); }
    });
    // 刪除
    router.post("/inventory/item-photo/:erpCode/delete", async (req, res) => {
        try {
            const code = String(req.params.erpCode || "").trim();
            if (!code) { res.status(400).json({ ok: false, error: "缺少料號" }); return; }
            await db.prepare("DELETE FROM erp_stock_item_photo WHERE erp_code = ?").run(code);
            res.json({ ok: true });
        } catch (e) { console.error("[admin item-photo delete]", e?.message || e); res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) }); }
    });
    // 上傳（multipart，欄位名 image）→ sharp 縮圖 → data URI → UPSERT
    router.post("/inventory/item-photo/:erpCode", (req, res) => {
        uploadItemPhoto(req, res, async (err) => {
            try {
                if (err) { res.status(400).json({ ok: false, error: (err.code === "LIMIT_FILE_SIZE" ? "圖片過大（上限 8MB）" : "上傳失敗") }); return; }
                const code = String(req.params.erpCode || "").trim();
                if (!code) { res.status(400).json({ ok: false, error: "缺少料號" }); return; }
                if (!req.file || !req.file.buffer) { res.status(400).json({ ok: false, error: "請選擇圖片" }); return; }
                if (!/^image\//i.test(String(req.file.mimetype || ""))) { res.status(400).json({ ok: false, error: "僅接受圖片檔" }); return; }
                if (req.file.buffer.length > 8 * 1024 * 1024) { res.status(400).json({ ok: false, error: "圖片過大（上限 8MB）" }); return; }
                const sharp = require("sharp");
                let out;
                try {
                    // [fix 2026-07-10] limitInputPixels 壓到 40M px：擋「尺寸未達 sharp 預設上限(16383²)但仍超大」
                    // 的圖被完整解碼、瞬間吃 ~1GB 點陣記憶體打爆 Cloud Run（decompression bomb 的溫和變體）。
                    out = await sharp(req.file.buffer, { limitInputPixels: 40000000 }).rotate().resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
                } catch (e2) { res.status(400).json({ ok: false, error: "圖片處理失敗（檔案可能損毀或格式不支援）" }); return; }
                const dataUri = "data:image/jpeg;base64," + out.toString("base64");
                const nowIso = new Date().toISOString();
                const by = req.adminUsername || "";
                // [prov 2026-07-14] 記錄上傳來源公司：PK 仍為 erp_code（一料號一照、全公司共用，刻意決策），
                // 此欄為未來若需按公司分照片時的資料基礎（免猜既有照片歸屬）。
                const photoIcp = (0, erp_companies_js_1.normIcpno)(req.query.icpno);
                const isPg = Boolean(process.env.DATABASE_URL);
                if (isPg) {
                    await db.prepare("INSERT INTO erp_stock_item_photo (erp_code, photo_url, updated_by, updated_at, icpno) VALUES (?, ?, ?, ?, ?) ON CONFLICT (erp_code) DO UPDATE SET photo_url = EXCLUDED.photo_url, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at, icpno = EXCLUDED.icpno").run(code, dataUri, by, nowIso, photoIcp);
                } else {
                    await db.prepare("INSERT OR REPLACE INTO erp_stock_item_photo (erp_code, photo_url, updated_by, updated_at, icpno) VALUES (?, ?, ?, ?, ?)").run(code, dataUri, by, nowIso, photoIcp);
                }
                res.json({ ok: true, bytes: out.length });
            } catch (e) { console.error("[admin item-photo upload]", e); res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) }); }
        });
    });
    // 使用者點「庫存更新」→ 設定待處理旗標（內網 agent long-poll 撿走）
    // [依公司自主更新 2026-07-17] 可帶 icpno＝只重推該公司（不必動整合代理 LY_ICPNO 設定）；
    // 省略/空＝沿用代理設定（一般為 all＝全公司），維持舊行為。旗標另存 erp_stock_refresh_icpno 供代理讀。
    router.post("/inventory/stock/refresh", express_1.default.json(), async (req, res) => {
        try {
            const now = new Date().toISOString();
            const icpno = (req.body && req.body.icpno != null && String(req.body.icpno).trim() !== "")
                ? (0, erp_companies_js_1.normIcpno)(req.body.icpno) : "";
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_requested_at", now);
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_icpno", icpno);
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_stock_refresh_status", "requested");
            res.json({ ok: true, requested_at: now, icpno });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    // [未來銷貨加回] 開關：全域設定（app_settings.stock_future_reversal_enabled='1'/'0'）。
    // 打開＝顯示庫存把未來日期銷貨淨量加回；關閉＝遮蔽回原凌越量方便對照查詢。只影響顯示，不寫回凌越。
    router.post("/inventory/stock/future-toggle", express_1.default.json(), async (req, res) => {
        try {
            const on = req.body?.on === true || req.body?.on === "1" || req.body?.on === 1;
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("stock_future_reversal_enabled", on ? "1" : "0");
            res.json({ ok: true, on });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    // 前端輪詢：查最新快照時間 / 刷新狀態
    router.get("/inventory/stock/status", async (_req, res) => {
        try {
            res.json(await readStockMeta());
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    // ── 點品項查凌越進銷存（單品項，經內網 agent 長連線回填；跨實例用 app_settings 協調）──
    const ERP_TXN_FRESH_MS = 5 * 60 * 1000; // 快取 5 分鐘，避免重複打凌越
    // [fix 2026-07-14] 快取鍵加公司（erp_txn_req/res_<icpno>_<code>）：跨公司料號撞號時
    // 舊鍵只含料號，A 公司查完 5 分鐘內 B 公司點同料號會直接拿到 A 的交易明細。
    router.post("/inventory/stock/txn-request", express_1.default.json(), async (req, res) => {
        try {
            const code = String(req.body?.code || "").trim();
            const icpno = (0, erp_companies_js_1.normIcpno)(req.body?.icpno);
            if (!code) { res.status(400).json({ error: "缺少料號" }); return; }
            const cached = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_txn_res_" + icpno + "_" + code);
            if (cached && cached.value) {
                try {
                    const c = JSON.parse(cached.value);
                    if (!c.error && c.fetched_at && (Date.now() - new Date(c.fetched_at).getTime()) < ERP_TXN_FRESH_MS) {
                        res.json({ status: "ready", cached: true });
                        return;
                    }
                } catch (_) { }
            }
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("erp_txn_req_" + icpno + "_" + code, JSON.stringify({ icpno, at: new Date().toISOString() }));
            res.json({ status: "queued" });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    router.get("/inventory/stock/txn", async (req, res) => {
        try {
            const code = String(req.query.code || "").trim();
            const icpno = stickyIcpno(req, res);
            if (!code) { res.status(400).json({ error: "缺少料號" }); return; }
            const resRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_txn_res_" + icpno + "_" + code);
            if (resRow && resRow.value) {
                let parsed = {};
                try { parsed = JSON.parse(resRow.value); } catch (_) { }
                res.json(Object.assign({ status: parsed.error ? "error" : "ready" }, parsed));
                return;
            }
            const reqRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("erp_txn_req_" + icpno + "_" + code);
            res.json({ status: reqRow && reqRow.value ? "pending" : "none" });
        }
        catch (e) {
            res.status(500).json({ error: String(e?.message || e) });
        }
    });
    // ── 倉庫設定：凌越倉別代號 → 中文名、是否納入盤點（按公司分開） ─────────
    async function loadWarehouseRows(icpno) {
        const snap = await db.prepare("SELECT wh_code AS code, COUNT(*) AS cnt FROM erp_stock_items WHERE wh_code IS NOT NULL AND TRIM(wh_code) <> '' AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ? GROUP BY wh_code").all(icpno);
        const saved = await db.prepare("SELECT code, name, include_stocktake, sort_order FROM erp_warehouse WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icpno);
        const savedMap = {}, cntMap = {}, codes = {};
        for (const s of saved || []) { savedMap[String(s.code)] = s; codes[String(s.code)] = true; }
        for (const r of snap || []) { cntMap[String(r.code)] = Number(r.cnt || 0); codes[String(r.code)] = true; }
        const list = Object.keys(codes).map((code) => {
            const s = savedMap[code] || {};
            return {
                code,
                name: s.name != null ? String(s.name) : "",
                include: s.include_stocktake == null ? 1 : Number(s.include_stocktake),
                sort: s.sort_order != null ? Number(s.sort_order) : 0,
                cnt: cntMap[code] || 0,
            };
        });
        list.sort((a, b) => (a.sort - b.sort) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
        return list;
    }
    // 「盤點設定」三合一：倉庫設定／條碼對照／效期品設定共用分頁列（同一組設定內切換）
    const settingsTabs = (active) => {
        const t = (href, key, label) => `<a href="${href}" style="text-decoration:none;padding:7px 14px;border-radius:8px;font-size:13.5px;font-weight:600;${active === key ? "background:#2383e2;color:#fff;" : "background:var(--notion-card,#fff);color:#5b616e;border:1px solid var(--notion-border,#e3e2e0);"}">${label}</a>`;
        return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 16px;">${t("/admin/inventory/warehouse-settings", "wh", "倉庫設定")}${t("/admin/inventory/barcodes", "barcode", "條碼對照")}${t("/admin/inventory/expiry-items", "expiry", "效期品設定")}</div>`;
    };
    router.get("/inventory/warehouse-settings", async (req, res) => {
        const icpno = stickyIcpno(req, res);
        const companies = await listStockCompanies();
        const list = await loadWarehouseRows(icpno);
        const ok = req.query.ok ? `<div style="background:#e7f5e9;color:#2e7d32;padding:10px 12px;border-radius:8px;margin-bottom:12px;">已儲存。</div>` : "";
        const coSeg = companies.length > 1 ? `<div class="sf-seg" style="margin:0 0 14px;display:inline-flex;">${companies.map((c) => `<button type="button" class="${c === icpno ? "active" : ""}" onclick="location.href='/admin/inventory/warehouse-settings?icpno=${c}'">${escapeHtml((0, erp_companies_js_1.erpCompanyName)(c))}</button>`).join("")}</div>` : "";
        const rowsHtml = list.map((w) => `
      <tr>
        <td style="font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap;">${escapeHtml(w.code)}</td>
        <td><input type="text" name="name[${escapeAttr(w.code)}]" value="${escapeAttr(w.name)}" placeholder="輸入中文名，如 松富冷藏備貨庫" class="sf-input" style="width:100%;max-width:280px;"></td>
        <td style="text-align:right;color:var(--notion-text-muted);font-variant-numeric:tabular-nums;">${w.cnt}</td>
        <td style="text-align:center;"><input type="checkbox" name="inc[${escapeAttr(w.code)}]" value="1" ${w.include ? "checked" : ""}></td>
      </tr>`).join("");
        const body = `
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 盤點設定</div>
      <h1 class="notion-page-title">盤點設定</h1>
      ${settingsTabs("wh")}
      <p class="notion-hint" style="margin:-2px 0 14px;">倉別代號自動來自凌越（貨品主檔的入庫倉別）。填中文名、勾選要「納入盤點」的倉即可；換倉、新增倉都會自動出現，不用手動維護。</p>
      ${coSeg}
      ${ok}
      <form method="post" action="/admin/inventory/warehouse-settings">
        <input type="hidden" name="icpno" value="${escapeAttr(icpno)}">
        <div class="notion-card" style="padding:0;overflow:hidden;">
          <table>
            <thead><tr>
              <th>凌越倉別</th><th>中文名稱</th><th style="text-align:right;">品項數</th><th style="text-align:center;">納入盤點</th>
            </tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="4" style="text-align:center;color:var(--notion-text-muted);padding:22px;">目前庫存快照還沒有資料，請先讓內網代理推一次庫存。</td></tr>'}</tbody>
          </table>
        </div>
        <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button></p>
      </form>`;
        res.type("text/html").send(notionPage("盤點設定", body, "inv-settings", res));
    });
    router.post("/inventory/warehouse-settings", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const icpno = (0, erp_companies_js_1.normIcpno)(req.body && req.body.icpno);
            const nameMap = (req.body && typeof req.body.name === "object" && req.body.name) ? req.body.name : {};
            const incMap = (req.body && typeof req.body.inc === "object" && req.body.inc) ? req.body.inc : {};
            const codes = {};
            for (const k of Object.keys(nameMap)) codes[k] = true;
            for (const k of Object.keys(incMap)) codes[k] = true;
            const now = new Date().toISOString();
            // [fix 2026-07-08] DELETE＋迴圈 INSERT 包進交易：中途失敗整批回滾，
            // 不再把整張倉別中文名/納入盤點設定清空只留半套。多公司：只覆蓋該公司的倉別。
            const doSave = async (h) => {
                await h.prepare("DELETE FROM erp_warehouse WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").run(icpno);
                let sort = 0;
                for (const code of Object.keys(codes)) {
                    const c = String(code).trim();
                    if (!c)
                        continue;
                    const name = String(nameMap[code] != null ? nameMap[code] : "").trim();
                    const include = incMap[code] ? 1 : 0;
                    await h.prepare("INSERT INTO erp_warehouse (icpno, code, name, include_stocktake, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(icpno, c, name, include, sort++, now);
                }
            };
            if (typeof db.transaction === "function")
                await db.transaction(doSave);
            else
                await doSave(db);
            res.redirect("/admin/inventory/warehouse-settings?ok=1&icpno=" + encodeURIComponent(icpno));
        }
        catch (e) {
            console.error("[admin] warehouse-settings save", e?.message || e);
            res.status(500).send("儲存失敗：" + String(e?.message || e));
        }
    });
    // ── 條碼對照：商品條碼 ↔ 品項（LIFF 掃碼盤點/進貨用；掃碼頁綁的也在這裡管理） ──
    router.get("/inventory/barcodes", async (req, res) => {
        const icpno = stickyIcpno(req, res, "02");
        const companies = await listStockCompanies();
        if (companies.indexOf(icpno) < 0) companies.push(icpno);
        companies.sort();
        let rows = [];
        try {
            rows = (await db.prepare(
                "SELECT b.barcode, b.erp_code, b.qty_per_scan, b.created_by_name, b.updated_at, i.name, i.spec, i.unit " +
                "FROM product_barcode b LEFT JOIN erp_stock_items i ON i.erp_code = b.erp_code AND COALESCE(NULLIF(TRIM(i.icpno),''),'00') = COALESCE(NULLIF(TRIM(b.icpno),''),'00') " +
                "WHERE COALESCE(NULLIF(TRIM(b.icpno),''),'00') = ? ORDER BY b.erp_code, b.barcode").all(icpno)) || [];
        } catch (e) { console.error("[admin] barcodes list", e?.message || e); rows = []; }
        const coSeg = companies.length > 1 ? `<div class="sf-seg" style="margin:0 0 14px;display:inline-flex;">${companies.map((c) => `<button type="button" class="${c === icpno ? "active" : ""}" onclick="location.href='/admin/inventory/barcodes?icpno=${c}'">${escapeHtml((0, erp_companies_js_1.erpCompanyName)(c))}</button>`).join("")}</div>` : "";
        const ok = req.query.ok ? `<div style="background:#e7f5e9;color:#2e7d32;padding:10px 12px;border-radius:8px;margin-bottom:12px;">已儲存。</div>` : (req.query.err ? `<div style="background:#fdecec;color:#b3261e;padding:10px 12px;border-radius:8px;margin-bottom:12px;">儲存失敗：${escapeHtml(String(req.query.err))}</div>` : "");
        const rowsHtml = rows.map((r) => `
      <tr>
        <td style="font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600;">${escapeHtml(String(r.barcode))}</td>
        <td style="font-variant-numeric:tabular-nums;white-space:nowrap;">${escapeHtml(String(r.erp_code))}</td>
        <td>${escapeHtml(String(r.name || "（庫存快照查無此料號）"))}${r.spec ? `<span style="margin-left:6px;font-size:11px;color:var(--notion-text-muted,#9b9a97);">${escapeHtml(String(r.spec))}</span>` : ""}</td>
        <td style="text-align:center;">
          <form method="post" action="/admin/inventory/barcodes" style="display:inline-flex;align-items:center;gap:6px;">
            <input type="hidden" name="action" value="update"><input type="hidden" name="icpno" value="${escapeAttr(icpno)}"><input type="hidden" name="barcode" value="${escapeAttr(String(r.barcode))}">
            <input type="number" name="qty_per_scan" value="${escapeAttr(String(Number(r.qty_per_scan || 1)))}" min="0.01" step="any" class="sf-input" style="width:76px;text-align:right;">
            <span style="font-size:11.5px;color:var(--notion-text-muted,#9b9a97);">${escapeHtml(String(r.unit || ""))}/掃</span>
            <button type="submit" class="btn" style="font-size:12px;padding:4px 10px;">存</button>
          </form>
        </td>
        <td style="font-size:12px;color:var(--notion-text-muted,#9b9a97);white-space:nowrap;">${escapeHtml(String(r.created_by_name || "—"))}</td>
        <td style="text-align:center;">
          <form method="post" action="/admin/inventory/barcodes" onsubmit="return confirm('刪除條碼 ${escapeAttr(String(r.barcode))} 的綁定？');" style="display:inline;">
            <input type="hidden" name="action" value="delete"><input type="hidden" name="icpno" value="${escapeAttr(icpno)}"><input type="hidden" name="barcode" value="${escapeAttr(String(r.barcode))}">
            <button type="submit" class="btn" style="font-size:12px;padding:4px 10px;color:#b3261e;">刪除</button>
          </form>
        </td>
      </tr>`).join("");
        const coNm = (0, erp_companies_js_1.erpCompanyName)(icpno);
        const body = `
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 盤點設定</div>
      <h1 class="notion-page-title">盤點設定</h1>
      ${settingsTabs("barcode")}
      <p class="notion-hint" style="margin:-2px 0 14px;">商品條碼 ↔ 凌越料號。點「新增品項」直接掃條碼，再模糊搜尋貨品主檔配對，掃完即建檔（凌越沒維護條碼→就在這裡對應）；現場用「掃碼盤點」也能邊掃邊綁。一個品項可以綁多個條碼（單支＋整箱）。</p>
      ${coSeg}
      ${ok}
      <div class="notion-card" style="padding:14px 16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <button type="button" id="bcmOpen" class="btn-primary" style="display:inline-flex;align-items:center;gap:6px;">${SF_ICONS.plus}新增品項（掃碼建檔）</button>
          <span class="notion-hint" style="margin:0;">彈出掃碼視窗：掃條碼 → 模糊搜尋貨品主檔配對 → 建檔綁定（${escapeHtml(coNm)}）。</span>
        </div>
        <details style="margin-top:12px;">
          <summary style="cursor:pointer;font-size:13px;color:var(--notion-text-muted,#9b9a97);">或手動輸入條碼＋料號綁定</summary>
          <form method="post" action="/admin/inventory/barcodes" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px;">
            <input type="hidden" name="action" value="add"><input type="hidden" name="icpno" value="${escapeAttr(icpno)}">
            <input type="text" name="barcode" placeholder="條碼（掃描槍對準這裡掃也可以）" required class="sf-input" style="width:220px;">
            <input type="text" name="erp_code" placeholder="凌越料號" required class="sf-input" style="width:140px;">
            <input type="number" name="qty_per_scan" value="1" min="0.01" step="any" title="掃 1 下＝幾個單位（整箱條碼填入數）" class="sf-input" style="width:90px;text-align:right;">
            <button type="submit" class="btn-primary">新增綁定</button>
          </form>
        </details>
      </div>
      <div class="notion-card" style="padding:0;overflow:auto;">
        <table>
          <thead><tr><th>條碼</th><th>料號</th><th>品名</th><th style="text-align:center;">每掃單位數</th><th>綁定者</th><th style="text-align:center;">操作</th></tr></thead>
          <tbody>${rowsHtml || `<tr><td colspan="6" style="text-align:center;color:var(--notion-text-muted,#9b9a97);padding:22px;">還沒有任何條碼綁定。點上方「新增品項」掃碼建檔，或到 LIFF「掃碼盤點」頁邊掃邊綁。</td></tr>`}</tbody>
        </table>
      </div>
      ${barcodeAddModalHtml(icpno, coNm)}`;
        res.type("text/html").send(notionPage("盤點設定", body, "inv-settings", res));
    });
    router.post("/inventory/barcodes", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const icpno = (0, erp_companies_js_1.normIcpno)(req.body && req.body.icpno, "02");
        const back = (extra) => res.redirect("/admin/inventory/barcodes?icpno=" + encodeURIComponent(icpno) + (extra || ""));
        try {
            const action = String(req.body?.action || "").trim();
            const barcode = String(req.body?.barcode || "").trim();
            if (!barcode) { back("&err=" + encodeURIComponent("缺少條碼")); return; }
            // [fix 2026-07-18 稽核] 條碼對照異動留軌跡（誰/何時/舊值新值）。
            const bcSnap = (r) => (r ? { erp_code: r.erp_code, qty_per_scan: r.qty_per_scan } : null);
            const auditBc = async (act, before, after, extra) => {
                try {
                    await logDataChange(req, {
                        entityType: "product_barcode",
                        entityId: icpno + ":" + barcode,
                        action: act,
                        summary: `條碼對照 ${act} ${barcode}（公司 ${icpno}）` + (extra ? "：" + extra : ""),
                        meta: { icpno, barcode, before: before ?? null, after: after ?? null },
                    });
                }
                catch (e) { console.warn("[admin] 條碼稽核寫入失敗（不阻斷）:", e?.message || e); }
            };
            const who = String(res.locals.adminUser || req.adminUsername || "");
            const createdBy = "admin:" + String(req.adminUsername || "");
            if (action === "delete") {
                const before = await db.prepare("SELECT erp_code, qty_per_scan FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND barcode = ?").get(icpno, barcode);
                await db.prepare("DELETE FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND barcode = ?").run(icpno, barcode);
                if (before) await auditBc("delete", bcSnap(before), null, `解除綁定（原料號 ${before.erp_code}）`);
                back("&ok=1"); return;
            }
            let qps = Number(req.body?.qty_per_scan);
            if (!Number.isFinite(qps) || qps <= 0) qps = 1;
            const now = new Date().toISOString();
            if (action === "update") {
                const before = await db.prepare("SELECT erp_code, qty_per_scan FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND barcode = ?").get(icpno, barcode);
                await db.prepare("UPDATE product_barcode SET qty_per_scan = ?, updated_at = ? WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND barcode = ?").run(qps, now, icpno, barcode);
                if (before && Number(before.qty_per_scan) !== qps) await auditBc("update", bcSnap(before), { erp_code: before.erp_code, qty_per_scan: qps }, `箱碼倍數 ${before.qty_per_scan} → ${qps}`);
                back("&ok=1"); return;
            }
            // add：驗證料號存在（該公司庫存快照），可攜 upsert（先刪後插）
            const erpCode = String(req.body?.erp_code || "").trim();
            if (!erpCode) { back("&err=" + encodeURIComponent("缺少料號")); return; }
            const item = await db.prepare("SELECT erp_code FROM erp_stock_items WHERE erp_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").get(erpCode, icpno);
            if (!item) { back("&err=" + encodeURIComponent("查無料號 " + erpCode + "（該公司庫存快照裡沒有）")); return; }
            const before = await db.prepare("SELECT erp_code, qty_per_scan FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND barcode = ?").get(icpno, barcode);
            // [fix 2026-07-18 M1] 先刪後插包同一交易：過去兩句獨立 auto-commit，之間失敗＝綁定被刪卻沒補回。
            // created_by 改記真實操作者（過去寫死 "admin"/"後台"，稽核抓不到人）。
            await db.transaction(async (h) => {
                await h.prepare("DELETE FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND barcode = ?").run(icpno, barcode);
                await h.prepare("INSERT INTO product_barcode (icpno, barcode, erp_code, qty_per_scan, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                    .run(icpno, barcode, erpCode, qps, createdBy, who || "後台", now, now);
            });
            await auditBc(before ? "update" : "create", bcSnap(before), { erp_code: erpCode, qty_per_scan: qps }, `綁定料號 ${before && before.erp_code !== erpCode ? (before.erp_code + " → ") : ""}${erpCode}`);
            back("&ok=1");
        }
        catch (e) {
            console.error("[admin] barcodes save", e?.message || e);
            back("&err=" + encodeURIComponent(String(e?.message || e).slice(0, 120)));
        }
    });
    // ── 效期品設定：標記哪些料號在盤點時要填效期／批號（分公司獨立，可整倉一次帶入，例如松揚雜貨庫房）──
    router.get("/inventory/expiry-items", async (req, res) => {
        const icpno = stickyIcpno(req, res, "02");
        const companies = await listStockCompanies();
        if (companies.indexOf(icpno) < 0) companies.push(icpno);
        companies.sort();
        let rows = [], whs = [];
        const whCnt = {}, whExp = {};
        try {
            rows = (await db.prepare(
                "SELECT e.erp_code, e.expiry_unit, i.name, i.spec, i.unit, i.wh_code " +
                "FROM stocktake_expiry_item e LEFT JOIN erp_stock_items i ON i.erp_code = e.erp_code AND COALESCE(NULLIF(TRIM(i.icpno),''),'00') = COALESCE(NULLIF(TRIM(e.icpno),''),'00') " +
                "WHERE COALESCE(NULLIF(TRIM(e.icpno),''),'00') = ? ORDER BY i.wh_code, e.erp_code").all(icpno)) || [];
        } catch (e) { console.error("[admin] expiry-items list", e?.message || e); rows = []; }
        try { whs = (await db.prepare("SELECT code, name FROM erp_warehouse WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? ORDER BY sort_order, code").all(icpno)) || []; } catch (_) { whs = []; }
        try { (await db.prepare("SELECT wh_code AS code, COUNT(*) AS cnt FROM erp_stock_items WHERE wh_code IS NOT NULL AND TRIM(wh_code) <> '' AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ? GROUP BY wh_code").all(icpno) || []).forEach((r) => { whCnt[String(r.code)] = Number(r.cnt || 0); }); } catch (_) { }
        try { (await db.prepare("SELECT i.wh_code AS code, COUNT(*) AS cnt FROM stocktake_expiry_item e JOIN erp_stock_items i ON i.erp_code = e.erp_code AND COALESCE(NULLIF(TRIM(i.icpno),''),'00') = COALESCE(NULLIF(TRIM(e.icpno),''),'00') WHERE COALESCE(NULLIF(TRIM(e.icpno),''),'00') = ? GROUP BY i.wh_code").all(icpno) || []).forEach((r) => { whExp[String(r.code)] = Number(r.cnt || 0); }); } catch (_) { }
        const coSeg = companies.length > 1 ? `<div class="sf-seg" style="margin:0 0 14px;display:inline-flex;">${companies.map((c) => `<button type="button" class="${c === icpno ? "active" : ""}" onclick="location.href='/admin/inventory/expiry-items?icpno=${c}'">${escapeHtml((0, erp_companies_js_1.erpCompanyName)(c))}</button>`).join("")}</div>` : "";
        const banner = req.query.ok ? `<div style="background:#e7f5e9;color:#2e7d32;padding:10px 12px;border-radius:8px;margin-bottom:12px;">已儲存${req.query.n ? `：新增 ${escapeHtml(String(req.query.n))} 項效期品` : ""}。</div>` : (req.query.err ? `<div style="background:#fdecec;color:#b3261e;padding:10px 12px;border-radius:8px;margin-bottom:12px;">操作失敗：${escapeHtml(String(req.query.err))}</div>` : "");
        const whOpts = whs.map((w) => { const c = String(w.code); return `<option value="${escapeAttr(c)}">${escapeHtml(c)} ${escapeHtml(String(w.name || ""))}（已標 ${whExp[c] || 0}/${whCnt[c] || 0}）</option>`; }).join("");
        const rowsHtml = rows.map((r) => `
      <tr>
        <td style="font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600;">${escapeHtml(String(r.erp_code))}</td>
        <td>${escapeHtml(String(r.name || "（庫存快照查無此料號）"))}${r.spec ? `<span style="margin-left:6px;font-size:11px;color:var(--notion-text-muted,#9b9a97);">${escapeHtml(String(r.spec))}</span>` : ""}</td>
        <td style="white-space:nowrap;">${escapeHtml(String(r.wh_code || "—"))}</td>
        <td style="text-align:center;">${escapeHtml(String(r.expiry_unit || r.unit || ""))}</td>
        <td style="text-align:center;">
          <form method="post" action="/admin/inventory/expiry-items" onsubmit="return confirm('取消 ${escapeAttr(String(r.erp_code))} 的效期標記？');" style="display:inline;">
            <input type="hidden" name="action" value="delete"><input type="hidden" name="icpno" value="${escapeAttr(icpno)}"><input type="hidden" name="erp_code" value="${escapeAttr(String(r.erp_code))}">
            <button type="submit" class="btn" style="font-size:12px;padding:4px 10px;color:#b3261e;">移除</button>
          </form>
        </td>
      </tr>`).join("");
        const emptyRow = `<tr><td colspan="5" style="text-align:center;color:var(--notion-text-muted,#9b9a97);padding:22px;">此公司尚未標記任何效期品。用上方「整倉帶入」把雜貨庫房一次設好，或單筆新增料號。</td></tr>`;
        const body = `
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 盤點設定</div>
      <h1 class="notion-page-title">盤點設定</h1>
      ${settingsTabs("expiry")}
      <p class="notion-hint" style="margin:-2px 0 14px;">標記為「效期品」的料號，盤點時才會跳出<b>效期／批號</b>輸入（雜貨、有到期日的品項才需要）。可<b>整倉一次帶入</b>（例如松揚雜貨庫房），也可單筆增減。設定<b>分公司獨立</b>。</p>
      ${coSeg}
      ${banner}
      <div class="notion-card" style="padding:14px 16px;margin-bottom:16px;">
        <div style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px;">${SF_ICONS.box}整倉帶入 / 清除</div>
        <form method="post" action="/admin/inventory/expiry-items" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <input type="hidden" name="icpno" value="${escapeAttr(icpno)}">
          <select name="warehouse" required class="sf-input" style="min-width:280px;">
            <option value="">選擇倉庫…</option>
            ${whOpts}
          </select>
          <button type="submit" name="action" value="bulk_add" class="btn-primary">整倉設為效期品</button>
          <button type="submit" name="action" value="bulk_remove" class="btn" onclick="return confirm('把此倉所有品項的效期標記清除？');" style="color:#b3261e;">整倉清除</button>
        </form>
        <p class="notion-hint" style="margin:8px 0 0;">「整倉設為效期品」會把此倉所有料號都標記；日後這些品項在盤點頁都會出現效期輸入。已標記的不會重複。</p>
      </div>
      <div class="notion-card" style="padding:14px 16px;margin-bottom:16px;">
        <details>
          <summary style="cursor:pointer;font-size:13px;color:var(--notion-text-muted,#9b9a97);">單筆新增（輸入料號）</summary>
          <form method="post" action="/admin/inventory/expiry-items" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px;">
            <input type="hidden" name="action" value="add"><input type="hidden" name="icpno" value="${escapeAttr(icpno)}">
            <input type="text" name="erp_code" placeholder="凌越料號" required class="sf-input" style="width:160px;">
            <input type="text" name="expiry_unit" placeholder="效期單位（可留白，預設同單位）" class="sf-input" style="width:240px;">
            <button type="submit" class="btn-primary">新增</button>
          </form>
        </details>
      </div>
      <div class="notion-card" style="padding:0;overflow:auto;">
        <table>
          <thead><tr><th>料號</th><th>品名</th><th>倉別</th><th style="text-align:center;">效期單位</th><th style="text-align:center;">操作</th></tr></thead>
          <tbody>${rowsHtml || emptyRow}</tbody>
        </table>
      </div>`;
        res.type("text/html").send(notionPage("盤點設定", body, "inv-settings", res));
    });
    router.post("/inventory/expiry-items", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const icpno = (0, erp_companies_js_1.normIcpno)(req.body && req.body.icpno, "02");
        const back = (extra) => res.redirect("/admin/inventory/expiry-items?icpno=" + encodeURIComponent(icpno) + (extra || ""));
        try {
            const action = String(req.body?.action || "").trim();
            const now = new Date().toISOString();
            if (action === "delete") {
                const erpCode = String(req.body?.erp_code || "").trim();
                if (!erpCode) { back("&err=" + encodeURIComponent("缺少料號")); return; }
                await db.prepare("DELETE FROM stocktake_expiry_item WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code = ?").run(icpno, erpCode);
                back("&ok=1"); return;
            }
            if (action === "add") {
                const erpCode = String(req.body?.erp_code || "").trim();
                if (!erpCode) { back("&err=" + encodeURIComponent("缺少料號")); return; }
                const item = await db.prepare("SELECT erp_code, unit FROM erp_stock_items WHERE erp_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").get(erpCode, icpno);
                if (!item) { back("&err=" + encodeURIComponent("查無料號 " + erpCode + "（該公司庫存快照裡沒有）")); return; }
                const eunit = String(req.body?.expiry_unit || "").trim() || String(item.unit || "");
                await db.prepare("DELETE FROM stocktake_expiry_item WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code = ?").run(icpno, erpCode);
                await db.prepare("INSERT INTO stocktake_expiry_item (icpno, erp_code, expiry_unit, created_at) VALUES (?, ?, ?, ?)").run(icpno, erpCode, eunit, now);
                back("&ok=1"); return;
            }
            if (action === "bulk_add" || action === "bulk_remove") {
                const wh = String(req.body?.warehouse || "").trim();
                if (!wh) { back("&err=" + encodeURIComponent("請先選倉庫")); return; }
                if (action === "bulk_remove") {
                    await db.prepare("DELETE FROM stocktake_expiry_item WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code IN (SELECT erp_code FROM erp_stock_items WHERE wh_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ?)").run(icpno, wh, icpno);
                    back("&ok=1"); return;
                }
                // bulk_add：找出此倉尚未標記的料號，一次插入（多列 VALUES，每批 ≤200）→ 已標記的不重複
                const toAdd = (await db.prepare("SELECT erp_code, unit FROM erp_stock_items WHERE wh_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND erp_code NOT IN (SELECT erp_code FROM stocktake_expiry_item WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?) ORDER BY erp_code").all(wh, icpno, icpno)) || [];
                let added = 0;
                const BATCH = 200;
                for (let i = 0; i < toAdd.length; i += BATCH) {
                    const chunk = toAdd.slice(i, i + BATCH);
                    const ph = chunk.map(() => "(?, ?, ?, ?)").join(", ");
                    const params = [];
                    for (const r of chunk) params.push(icpno, String(r.erp_code || ""), String(r.unit || ""), now);
                    await db.prepare("INSERT INTO stocktake_expiry_item (icpno, erp_code, expiry_unit, created_at) VALUES " + ph).run(...params);
                    added += chunk.length;
                }
                back("&ok=1&n=" + added); return;
            }
            back("&err=" + encodeURIComponent("未知動作"));
        }
        catch (e) {
            console.error("[admin] expiry-items save", e?.message || e);
            back("&err=" + encodeURIComponent(String(e?.message || e).slice(0, 120)));
        }
    });
    // ── 掃碼盤點「網頁版」（後台帳號登入，iPhone Safari 直接可用；與 LINE LIFF 版共用 scan.html 與同一套盤點表）──
    // 此 router 已全域要求後台登入 → 身分＝登入者。資料 API 與 /liff/api/* 同邏輯，只是改用後台 session 認證。
    const scanIc = (v) => (0, erp_companies_js_1.normIcpno)(v);
    function scanYesterdayTaipei() {
        try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - 86400000)); }
        catch (_) { return stkAdminTaipeiDate(); }
    }
    router.get("/scan", (req, res) => {
        let tpl;
        try { tpl = require("fs").readFileSync(require("path").join(__dirname, "..", "liff", "scan.html"), "utf8"); }
        catch (_) { res.status(500).type("text/plain").send("scan.html 樣板缺失"); return; }
        const who = String(res.locals.adminUser || req.adminUsername || "");
        const cfg = `<script>window.__SCAN_WEB__=true;window.__SCAN_API__="/admin/scan";window.__SCAN_NAME__=${JSON.stringify(who)};</script>`;
        // 網頁版不載 LINE LIFF SDK，直接用後台 cookie session；頁內 liff.* 全部有 WEB 判斷或 try/catch 保護
        const html = tpl.replace('<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>', cfg);
        res.setHeader("Cache-Control", "no-store");
        res.type("text/html").send(html);
    });
    // 掃碼速查／建檔工具（儀表板快速鍵）：掃條碼→已建檔顯示品名+目前庫存；未建檔→快速建檔。沿用 /admin/scan/* API。
    router.get("/scan-tool", (_req, res) => {
        let html;
        try { html = require("fs").readFileSync(require("path").join(__dirname, "scan-tool.html"), "utf8"); }
        catch (_) { res.status(500).type("text/plain").send("scan-tool.html 樣板缺失"); return; }
        res.setHeader("Cache-Control", "no-store");
        res.type("text/html").send(html);
    });
    // [refactor 2026-07-14] warehouses/items/submit 資料邏輯收斂到 dist/lib/stocktake-api.js
    // 單一權威（與 LIFF、網頁盤點入口共用）；這裡只剩參數解析＋後台身分。
    router.get("/scan/warehouses", async (req, res) => {
        try {
            const icpno = scanIc(req.query.icpno);
            res.json(await stocktake_api_js_1.listStocktakeWarehouses(db, { icpno }));
        } catch (e) { console.error("[admin scan warehouses]", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.get("/scan/items", async (req, res) => {
        try {
            const code = String(req.query.warehouse || "").trim();
            if (!code) { res.status(400).json({ error: "缺少 warehouse" }); return; }
            const icpno = scanIc(req.query.icpno);
            // minimal：掃碼頁不用效期標記/照片/必盤欄位（saved 的效期仍完整帶回，submit 原樣回傳）
            res.json(await stocktake_api_js_1.getStocktakeItems(db, { icpno, whCode: code, minimal: true }));
        } catch (e) { console.error("[admin scan items]", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.get("/scan/barcodes", async (req, res) => {
        try {
            const icpno = scanIc(req.query.icpno);
            const rows = await db.prepare("SELECT barcode, erp_code, qty_per_scan FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").all(icpno);
            const map = {}; for (const r of rows || []) map[String(r.barcode)] = { c: String(r.erp_code || ""), q: Number(r.qty_per_scan || 1) || 1 };
            res.json({ icpno, count: (rows || []).length, map });
        } catch (e) { console.error("[admin scan barcodes]", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.get("/scan/search", async (req, res) => {
        try {
            const icpno = scanIc(req.query.icpno);
            const q = String(req.query.q || "").trim();
            if (!q) { res.json({ items: [] }); return; }
            const like = "%" + q.replace(/[%_]/g, "") + "%";
            const rows = await db.prepare("SELECT erp_code, name, spec, unit, qty, wh_code FROM erp_stock_items WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND (erp_code LIKE ? OR name LIKE ? OR spec LIKE ?) ORDER BY erp_code LIMIT 30").all(icpno, like, like, like);
            res.json({ items: (rows || []).map((r) => ({ c: String(r.erp_code || ""), n: String(r.name || ""), s: String(r.spec || ""), u: String(r.unit || ""), sys: Number(r.qty || 0), w: String(r.wh_code || "") })) });
        } catch (e) { console.error("[admin scan search]", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.post("/scan/bind", express_1.default.json({ limit: "16kb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const icpno = scanIc(body.icpno);
            const barcode = String(body.barcode || "").trim();
            const erpCode = String(body.erp_code || "").trim();
            let qps = Number(body.qty_per_scan); if (!Number.isFinite(qps) || qps <= 0) qps = 1;
            if (!barcode || !erpCode) { res.status(400).json({ error: "缺少 barcode 或 erp_code" }); return; }
            if (barcode.length > 64) { res.status(400).json({ error: "條碼過長" }); return; }
            const item = await db.prepare("SELECT erp_code, name, spec, unit, qty FROM erp_stock_items WHERE erp_code = ? AND COALESCE(NULLIF(TRIM(icpno),''),'00') = ?").get(erpCode, icpno);
            if (!item) { res.status(404).json({ error: "查無此品項（料號 " + erpCode + "）" }); return; }
            const now = new Date().toISOString();
            const who = String(res.locals.adminUser || req.adminUsername || "後台");
            const before = await db.prepare("SELECT erp_code, qty_per_scan FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND barcode = ?").get(icpno, barcode);
            // [fix 2026-07-18 M1] 先刪後插包同一交易，之間失敗不會留下「綁定被刪卻沒補回」的空窗。
            await db.transaction(async (h) => {
                await h.prepare("DELETE FROM product_barcode WHERE COALESCE(NULLIF(TRIM(icpno),''),'00') = ? AND barcode = ?").run(icpno, barcode);
                await h.prepare("INSERT INTO product_barcode (icpno, barcode, erp_code, qty_per_scan, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(icpno, barcode, erpCode, qps, "admin:" + String(req.adminUsername || ""), who, now, now);
            });
            // [fix 2026-07-18 稽核] 掃碼邊掃邊綁也留軌跡（誰/何時/舊值新值）。
            try {
                await logDataChange(req, {
                    entityType: "product_barcode",
                    entityId: icpno + ":" + barcode,
                    action: before ? "update" : "create",
                    summary: `條碼對照（掃碼綁定）${before ? "update" : "create"} ${barcode}（公司 ${icpno}）：綁定料號 ${before && before.erp_code !== erpCode ? (before.erp_code + " → ") : ""}${erpCode}`,
                    meta: { icpno, barcode, before: before ? { erp_code: before.erp_code, qty_per_scan: before.qty_per_scan } : null, after: { erp_code: erpCode, qty_per_scan: qps } },
                });
            }
            catch (e) { console.warn("[admin] 掃碼綁定稽核寫入失敗（不阻斷）:", e?.message || e); }
            res.json({ ok: true, item: { c: String(item.erp_code), n: String(item.name || ""), s: String(item.spec || ""), u: String(item.unit || ""), sys: Number(item.qty || 0), q: qps } });
        } catch (e) { console.error("[admin scan bind]", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.post("/scan/submit", express_1.default.json({ limit: "2mb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const code = String(body.warehouse || "").trim();
            const counts = Array.isArray(body.counts) ? body.counts : null;
            if (!code || !counts) { res.status(400).json({ error: "缺少 warehouse 或 counts" }); return; }
            const icpno = scanIc(body.icpno);
            const out = await stocktake_api_js_1.submitStocktake(db, {
                icpno, whCode: code, date: body.date, counts,
                createdBy: "admin:" + String(req.adminUsername || ""),
                createdByName: String(body.name || res.locals.adminUser || req.adminUsername || "").trim(),
                baseSubmittedAt: body.baseSubmittedAt,
            });
            res.json(out);
        } catch (e) {
            if (e && e.name === "StkApiError") { res.status(e.httpStatus).json({ error: e.message, ...(e.code ? { code: e.code } : {}) }); return; }
            console.error("[admin scan submit]", e?.message || e);
            res.status(500).json({ error: String(e?.message || e).slice(0, 200) });
        }
    });
    // ── 每日盤點「網站版」輸入頁（後台帳號登入，不碰 LINE/LIFF token → 無登入逾時）──
    // 與 LINE LIFF 盤點頁共用 dist/liff/stocktake.html（WEB 模式），寫進同一套 stocktake_session/stocktake_count，
    // 後台每日盤點直接看得到。資料 API 與 /liff/api/stocktake/* 同邏輯，改用後台 session 認證＋身分。
    router.get("/inventory/entry", (req, res) => {
        let tpl;
        try { tpl = require("fs").readFileSync(require("path").join(__dirname, "..", "liff", "stocktake.html"), "utf8"); }
        catch (_) { res.status(500).type("text/plain").send("stocktake.html 樣板缺失"); return; }
        const who = String(res.locals.adminUser || req.adminUsername || "");
        const cfg = `<script>window.__STK_WEB__=true;window.__STK_API__="/admin/inventory/entry";window.__STK_NAME__=${JSON.stringify(who)};</script>`;
        // 網頁版不載 LINE LIFF SDK，直接用後台 cookie session；頁內 liff.* 全部有 WEB 判斷保護
        const html = tpl.replace('<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>', cfg);
        res.setHeader("Cache-Control", "no-store");
        res.type("text/html").send(html);
    });
    router.get("/inventory/entry/warehouses", async (req, res) => {
        try {
            const icpno = scanIc(req.query.icpno);
            res.json(await stocktake_api_js_1.listStocktakeWarehouses(db, { icpno }));
        } catch (e) { console.error("[admin entry warehouses]", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.get("/inventory/entry/items", async (req, res) => {
        try {
            const code = String(req.query.warehouse || "").trim();
            if (!code) { res.status(400).json({ error: "缺少 warehouse" }); return; }
            const icpno = scanIc(req.query.icpno);
            res.json(await stocktake_api_js_1.getStocktakeItems(db, { icpno, whCode: code, minimal: false }));
        } catch (e) { console.error("[admin entry items]", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.get("/inventory/entry/photo/:erpCode", async (req, res) => {
        try {
            const code = String(req.params.erpCode || "").trim();
            if (!code) { res.status(400).json({ error: "缺少料號" }); return; }
            const row = await db.prepare("SELECT photo_url FROM erp_stock_item_photo WHERE erp_code = ?").get(code);
            if (!row || !row.photo_url) { res.status(404).json({ error: "無照片" }); return; }
            res.json({ url: String(row.photo_url) });
        } catch (e) { console.error("[admin entry photo]", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 200) }); }
    });
    router.post("/inventory/entry/submit", express_1.default.json({ limit: "2mb" }), async (req, res) => {
        try {
            const body = req.body || {};
            const code = String(body.warehouse || "").trim();
            const counts = Array.isArray(body.counts) ? body.counts : null;
            if (!code || !counts) { res.status(400).json({ error: "缺少 warehouse 或 counts" }); return; }
            const icpno = scanIc(body.icpno);
            const out = await stocktake_api_js_1.submitStocktake(db, {
                icpno, whCode: code, date: body.date, counts,
                createdBy: "admin:" + String(req.adminUsername || ""),
                createdByName: String(body.name || res.locals.adminUser || req.adminUsername || "").trim(),
                baseSubmittedAt: body.baseSubmittedAt,
            });
            res.json(out);
        } catch (e) {
            if (e && e.name === "StkApiError") { res.status(e.httpStatus).json({ error: e.message, ...(e.code ? { code: e.code } : {}) }); return; }
            console.error("[admin entry submit]", e?.message || e);
            res.status(500).json({ error: String(e?.message || e).slice(0, 200) });
        }
    });
    // 舊網址相容：頁面轉跳新位置；舊表單 POST 仍可儲存
    router.get("/inventory/stocktake-groups", (_req, res) => res.redirect(301, "/admin/customers/groups"));
    router.post("/inventory/stocktake-groups", express_1.default.urlencoded({ extended: true }), saveGroupFeatures);
    router.get("/inventory/variance-report", async (req, res) => {
        const warehouses = await db.prepare("SELECT id, name FROM inventory_warehouses ORDER BY sort_order, name").all();
        const dateFrom = (req.query.date_from || "").trim();
        const dateTo = (req.query.date_to || "").trim();
        const whId = (req.query.warehouse_id || "").trim();
        const exportCsv = req.query.export === "csv";
        let rows = [];
        let freqList = [];
        if (dateFrom && dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
            const from = new Date(dateFrom);
            const to = new Date(dateTo);
            if (from <= to) {
                const warehouseIds = whId ? [whId] : warehouses.map((w) => w.id);
                const productNames = {};
                const whNames = {};
                warehouses.forEach((w) => { whNames[w.id] = w.name; });
                const prods = await db.prepare("SELECT id, name FROM products").all();
                prods.forEach((p) => { productNames[p.id] = p.name; });
                const varianceCount = {};
                for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().slice(0, 10);
                    for (const wid of warehouseIds) {
                        const prevRec = await db.prepare("SELECT items FROM daily_inventory WHERE warehouse_id = ? AND record_date < ? ORDER BY record_date DESC LIMIT 1").get(wid, dateStr);
                        const currRec = await db.prepare("SELECT items FROM daily_inventory WHERE warehouse_id = ? AND record_date = ?").get(wid, dateStr);
                        const erpRows = await db.prepare("SELECT product_id, SUM(qty_sold) as total FROM erp_sales WHERE warehouse_id = ? AND record_date = ? GROUP BY product_id").all(wid, dateStr);
                        const erpByProduct = Object.fromEntries((erpRows || []).map((r) => [r.product_id, Number(r.total) || 0]));
                        const prevItems = prevRec && prevRec.items ? (typeof prevRec.items === "string" ? JSON.parse(prevRec.items || "{}") : prevRec.items) : {};
                        const currItems = currRec && currRec.items ? (typeof currRec.items === "string" ? JSON.parse(currRec.items || "{}") : currRec.items) : {};
                        const allProductIds = new Set([...Object.keys(prevItems), ...Object.keys(currItems), ...Object.keys(erpByProduct)]);
                        for (const pid of allProductIds) {
                            const prevQty = Number(prevItems[pid]) || 0;
                            const currQty = currItems[pid] != null ? Number(currItems[pid]) : null;
                            const erpQty = erpByProduct[pid] || 0;
                            const book = prevQty - erpQty;
                            if (currQty === null)
                                continue;
                            const variance = currQty - book;
                            if (Math.abs(variance) > 1e-6) {
                                rows.push({ date: dateStr, warehouse_id: wid, warehouse_name: whNames[wid] || wid, product_id: pid, product_name: productNames[pid] || pid, book, curr: currQty, variance });
                                varianceCount[pid] = (varianceCount[pid] || 0) + 1;
                            }
                        }
                    }
                }
                freqList = Object.entries(varianceCount).sort((a, b) => b[1] - a[1]).map(([pid, count]) => ({ product_id: pid, product_name: productNames[pid] || pid, count }));
            }
        }
        if (exportCsv && rows.length) {
            const BOM = "\uFEFF";
            const csv = BOM + "日期,倉庫,品項,帳面數量,盤點數量,盤差\n" + rows.map((r) => [r.date, r.warehouse_name, r.product_name, r.book, r.curr, r.variance].join(",")).join("\n");
            res.type("text/csv").set("Content-Disposition", "attachment; filename=variance-report.csv").send(csv);
            return;
        }
        const optWh = warehouses.map((w) => `<option value="${escapeAttr(w.id)}" ${w.id === whId ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory/legacy">盤點作業</a> / 盤差報表</div>
        <h1 class="notion-page-title">盤差報表</h1>
        <p>依日期區間與倉庫計算盤差（盤點數量 − 帳面數量，帳面 = 前日盤點 − 當日 ERP 銷貨）。可匯出 CSV，並檢視易盤差品項統計。</p>
        <div class="notion-card">
          <form method="get" action="/admin/inventory/variance-report" style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
            <label>日期起 <input type="date" name="date_from" value="${escapeAttr(dateFrom)}"></label>
            <label>日期訖 <input type="date" name="date_to" value="${escapeAttr(dateTo)}"></label>
            <label>倉庫 <select name="warehouse_id"><option value="">全部</option>${optWh}</select></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          ${rows.length ? `<p><a href="/admin/inventory/variance-report?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&warehouse_id=${encodeURIComponent(whId)}&export=csv" class="btn btn-primary">匯出 CSV（${rows.length} 筆）</a></p>` : ""}
          <h3>易盤差品項（區間內出現盤差次數）</h3>
          ${freqList.length ? `<table><thead><tr><th>品項</th><th>盤差次數</th></tr></thead><tbody>${freqList.map((f) => `<tr><td>${escapeHtml(f.product_name)}</td><td>${f.count}</td></tr>`).join("")}</tbody></table>` : "<p>請選擇日期區間並查詢。</p>"}
          <h3>盤差明細</h3>
          ${rows.length ? `<table><thead><tr><th>日期</th><th>倉庫</th><th>品項</th><th>帳面</th><th>盤點</th><th>盤差</th></tr></thead><tbody>${rows.slice(0, 500).map((r) => `<tr><td>${r.date}</td><td>${escapeHtml(r.warehouse_name)}</td><td>${escapeHtml(r.product_name)}</td><td>${r.book}</td><td>${r.curr}</td><td style="color:${r.variance !== 0 ? "#c00" : ""}">${r.variance}</td></tr>`).join("")}</tbody></table>${rows.length > 500 ? "<p>僅顯示前 500 筆，請用匯出 CSV 取得完整資料。</p>" : ""}` : "<p>請選擇日期區間並查詢。</p>"}
        </div>
      `;
        res.type("text/html").send(notionPage("盤差報表", body, "inv-report", res));
    });
    router.get("/inventory/manager", async (req, res) => {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("inventory_manager");
        const current = (row && row.value) || "";
        const adminUsers = (await loadAdminUsers()).filter((u) => u.status === "active");
        const managerOpts = [`<option value="">— 未指定 —</option>`, ...adminUsers.map((u) => {
                const n = (u.name || u.username || "").trim();
                return `<option value="${escapeAttr(n)}" ${n === current ? "selected" : ""}>${escapeHtml(n)}（${escapeHtml(u.title || "")}）</option>`;
            })].join("");
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存管理人。</p>" : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/inventory/legacy">盤點作業</a> / 管理人設定</div>
        <h1 class="notion-page-title">盤點作業管理人</h1>
        ${msg}
        <div class="notion-card">
          <form method="post" action="/admin/inventory/manager">
            <label>管理人姓名 <select name="manager_name">${managerOpts}</select></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("管理人設定", body, "inv-manager", res));
    });
    router.post("/inventory/manager", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = (req.body.manager_name || "").trim();
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("inventory_manager", name);
        res.redirect("/admin/inventory/manager?ok=1");
    });
}
