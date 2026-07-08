"use strict";
// 畜產／家禽（毛豬、白肉雞、雞蛋）行情 — 農業部開放資料，與北農蔬果同一平台。
// 毛豬：AnimalTransData（各肉品市場，成交頭數-平均價格 元/公斤）
// 白肉雞/雞蛋：PoultryTransData（每日一列寬表，元/台斤）
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLivestockPrices = fetchLivestockPrices;
exports.saveLivestockSnapshot = saveLivestockSnapshot;
exports.loadLivestockSnapshot = loadLivestockSnapshot;
exports.loadOrFetchLivestockPrices = loadOrFetchLivestockPrices;
const id_js_1 = require("./id.js");

const PIG_API = "https://data.moa.gov.tw/Service/OpenData/FromM/AnimalTransData.aspx";
const POULTRY_API = "https://data.moa.gov.tw/Service/OpenData/FromM/PoultryTransData.aspx";
/** 資料來源官網（頁面標註用） */
exports.SOURCE_URL = "https://data.moa.gov.tw/";

function num(x) { return (x != null && x !== "" && Number.isFinite(Number(x))) ? Number(x) : null; }

/** 毛豬交易日期 "1150708"（民國 YYYMMDD）→ "2026-07-08" */
function pigDateToIso(s) {
    const t = String(s || "").trim();
    const m = t.match(/^(\d{3})(\d{2})(\d{2})$/);
    if (!m) return null;
    return `${parseInt(m[1], 10) + 1911}-${m[2]}-${m[3]}`;
}
/** 家禽日期 "2026/07/07" 或 "2026-07-07" → "2026-07-07" */
function poultryDateToIso(s) {
    const t = String(s || "").trim().replace(/\//g, "-");
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

async function fetchJson(url, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const resp = await fetch(url, { signal: ctrl.signal });
        if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
        const data = await resp.json();
        if (!Array.isArray(data)) return { ok: false, error: "回應非陣列" };
        return { ok: true, data };
    }
    catch (e) {
        return { ok: false, error: String(e?.message || e) };
    }
    finally {
        clearTimeout(timer);
    }
}

/** 從 rows 取「不晚於 targetIso 的最新一天」的 iso 日期；沒有就回最新一天 */
function pickLatestDate(isoList, targetIso) {
    const uniq = [...new Set(isoList.filter(Boolean))].sort(); // 升冪
    if (!uniq.length) return null;
    if (targetIso) {
        const le = uniq.filter((d) => d <= targetIso);
        if (le.length) return le[le.length - 1];
    }
    return uniq[uniq.length - 1];
}

/**
 * 抓毛豬＋白肉雞＋雞蛋當日（或最近一日）行情。
 * @param {string} dateStr 目標日 YYYY-MM-DD（預設今日）；當日無資料則取「不晚於該日的最近一天」。
 * @returns { prices:[{recordDate,category,itemLabel,price,unit,marketName,extraJson}], dataDate, status, errors }
 */
async function fetchLivestockPrices(dateStr) {
    const target = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || "")) ? dateStr : new Date().toISOString().slice(0, 10);
    const errors = [];
    const prices = [];
    let networkOk = false;
    let dataDate = null;

    // ── 毛豬（各市場取「不晚於目標日的最新一天」，讓覆蓋率最完整；市場間日期可能差一天）──
    {
        const r = await fetchJson(`${PIG_API}?$top=300`);
        if (!r.ok) { errors.push(`毛豬: ${r.error}`); }
        else {
            networkOk = true;
            const withIso = r.data.map((row) => ({ row, iso: pigDateToIso(row["交易日期"]) }))
                .filter((x) => x.iso && x.iso <= target);
            // 每個市場取其最新一天的那筆
            const latestByMarket = new Map();
            for (const { row, iso } of withIso) {
                const mk = (row["市場名稱"] ?? "").toString().trim();
                if (!mk) continue;
                const prev = latestByMarket.get(mk);
                if (!prev || iso > prev.iso) latestByMarket.set(mk, { row, iso });
            }
            for (const [mk, { row, iso }] of latestByMarket) {
                const price = num(row["成交頭數-平均價格"]);
                if (price == null) continue;
                if (!dataDate || iso > dataDate) dataDate = iso;
                prices.push({
                    recordDate: iso,
                    category: "pig",
                    itemLabel: "毛豬",
                    price,
                    unit: "元/公斤",
                    marketName: mk,
                    extraJson: JSON.stringify({
                        頭數: num(row["成交頭數-總數"]),
                        平均重量: num(row["成交頭數-平均重量"]),
                        資料日: iso,
                    }),
                });
            }
        }
    }

    // ── 白肉雞 / 雞蛋（寬表 → 多列）──
    {
        const r = await fetchJson(`${POULTRY_API}?$top=30`);
        if (!r.ok) { errors.push(`家禽: ${r.error}`); }
        else {
            networkOk = true;
            const withIso = r.data.map((row) => ({ row, iso: poultryDateToIso(row["日期"] ?? row["交易日期"]) })).filter((x) => x.iso);
            const day = pickLatestDate(withIso.map((x) => x.iso), target);
            const dayRow = withIso.find((x) => x.iso === day)?.row;
            if (dayRow && day) {
                if (!dataDate || day > dataDate) dataDate = day;
                // 家禽的價欄名可能含括號版本差異，逐一嘗試取值
                const put = (category, label, keys) => {
                    for (const k of keys) {
                        const v = num(dayRow[k]);
                        if (v != null) { prices.push({ recordDate: day, category, itemLabel: label, price: v, unit: "元/台斤", marketName: "", extraJson: null }); return; }
                    }
                };
                put("chicken", "白肉雞(2.0Kg以上)", ["白肉雞(2.0Kg以上)", "白肉雞(2.0kg以上)", "白肉雞2.0Kg以上"]);
                put("chicken", "白肉雞(1.75-1.95Kg)", ["白肉雞(1.75-1.95Kg)", "白肉雞(1.75-1.95kg)"]);
                put("chicken", "白肉雞(門市價高屏)", ["白肉雞(門市價高屏)", "白肉雞(門市價-高屏)"]);
                put("egg", "雞蛋(產地價)", ["雞蛋(產地)", "雞蛋(產地價)"]);
                put("egg", "雞蛋(大運輸價)", ["雞蛋(大運輸價)", "雞蛋(大運輸)", "雞蛋(運輸價)"]);
            }
        }
    }

    let status = "ok";
    if (!networkOk) status = "network_error";
    else if (prices.length === 0) status = "empty";
    return { prices, dataDate: dataDate || target, status, errors };
}

exports.backfillLivestockHistory = backfillLivestockHistory;
/** 回填近 days 天歷史（農業部 API 本來就回多天），讓折線圖立刻有資料可看。每個日期覆蓋寫入。 */
async function backfillLivestockHistory(db, days = 30) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const byDate = new Map();
    const add = (date, p) => { if (!byDate.has(date)) byDate.set(date, []); byDate.get(date).push(p); };
    // 家禽（白肉雞/雞蛋）：一天一列寬表
    const pr = await fetchJson(`${POULTRY_API}?$top=${days + 15}`);
    if (pr.ok) {
        for (const row of pr.data) {
            const iso = poultryDateToIso(row["日期"] ?? row["交易日期"]);
            if (!iso || iso < cutoff) continue;
            const put = (cat, label, keys) => {
                for (const k of keys) { const v = num(row[k]); if (v != null) { add(iso, { recordDate: iso, category: cat, itemLabel: label, price: v, unit: "元/台斤", marketName: "", extraJson: null }); return; } }
            };
            put("chicken", "白肉雞(2.0Kg以上)", ["白肉雞(2.0Kg以上)", "白肉雞(2.0kg以上)"]);
            put("chicken", "白肉雞(1.75-1.95Kg)", ["白肉雞(1.75-1.95Kg)", "白肉雞(1.75-1.95kg)"]);
            put("chicken", "白肉雞(門市價高屏)", ["白肉雞(門市價高屏)"]);
            put("egg", "雞蛋(產地價)", ["雞蛋(產地)", "雞蛋(產地價)"]);
            put("egg", "雞蛋(大運輸價)", ["雞蛋(大運輸價)", "雞蛋(大運輸)"]);
        }
    }
    // 毛豬：各市場各天
    const gr = await fetchJson(`${PIG_API}?$top=${days * 25}`);
    if (gr.ok) {
        for (const row of gr.data) {
            const iso = pigDateToIso(row["交易日期"]);
            if (!iso || iso < cutoff) continue;
            const price = num(row["成交頭數-平均價格"]);
            if (price == null) continue;
            add(iso, { recordDate: iso, category: "pig", itemLabel: "毛豬", price, unit: "元/公斤", marketName: (row["市場名稱"] ?? "").toString().trim(), extraJson: JSON.stringify({ 頭數: num(row["成交頭數-總數"]), 資料日: iso }) });
        }
    }
    let dates = 0;
    for (const [date, prices] of byDate) { await saveLivestockSnapshot(db, date, prices); dates++; }
    return { dates, days };
}
async function saveLivestockSnapshot(db, recordDate, prices) {
    if (!recordDate || !prices || prices.length === 0) return;
    const now = new Date().toISOString();
    const write = async (h) => {
        await h.prepare("DELETE FROM livestock_price_snapshots WHERE record_date = ?").run(recordDate);
        for (const p of prices) {
            const id = (0, id_js_1.newId)("lps");
            await h.prepare(`INSERT INTO livestock_price_snapshots (id, record_date, category, item_label, price, unit, market_name, extra_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, recordDate, p.category, p.itemLabel, p.price != null ? Number(p.price) : null, p.unit || "", p.marketName || "", p.extraJson || null, now);
        }
    };
    if (typeof db.transaction === "function") await db.transaction(write);
    else await write(db);
}

async function loadLivestockSnapshot(db, recordDate) {
    const rows = await db.prepare(`SELECT category, item_label, price, unit, market_name, extra_json
    FROM livestock_price_snapshots WHERE record_date = ? ORDER BY category, market_name, item_label`).all(recordDate);
    return (rows || []).map((r) => ({
        category: r.category, itemLabel: r.item_label,
        price: r.price != null ? Number(r.price) : null,
        unit: r.unit || "", marketName: r.market_name || "", extraJson: r.extra_json || null,
    }));
}

/** 圖表用的關鍵品項（各類挑一個代表畫折線）。 */
exports.KEY_ITEMS = [
    { key: "egg", category: "egg", itemLabel: "雞蛋(產地價)", title: "🥚 雞蛋產地價", unit: "元/台斤" },
    { key: "chicken", category: "chicken", itemLabel: "白肉雞(2.0Kg以上)", title: "🐓 白肉雞", unit: "元/台斤" },
    { key: "pig", category: "pig", itemLabel: null, title: "🐖 毛豬全國均價", unit: "元/公斤" }, // 各市場均價
];
exports.loadLivestockHistory = loadLivestockHistory;
/** 近 days 天，每個關鍵品項的 [{d,v}] 時序（毛豬取各市場當日均價）。 */
async function loadLivestockHistory(db, days = 30) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const out = {};
    const egg = await db.prepare("SELECT record_date AS d, price AS v FROM livestock_price_snapshots WHERE category = 'egg' AND item_label = ? AND record_date >= ? ORDER BY record_date").all("雞蛋(產地價)", cutoff);
    const chk = await db.prepare("SELECT record_date AS d, price AS v FROM livestock_price_snapshots WHERE category = 'chicken' AND item_label = ? AND record_date >= ? ORDER BY record_date").all("白肉雞(2.0Kg以上)", cutoff);
    const pig = await db.prepare("SELECT record_date AS d, AVG(price) AS v FROM livestock_price_snapshots WHERE category = 'pig' AND record_date >= ? GROUP BY record_date ORDER BY record_date").all(cutoff);
    const norm = (rows) => (rows || []).map((r) => ({ d: String(r.d), v: r.v != null && Number.isFinite(Number(r.v)) ? Math.round(Number(r.v) * 100) / 100 : null })).filter((p) => p.v != null);
    out.egg = norm(egg);
    out.chicken = norm(chk);
    out.pig = norm(pig);
    return out;
}
/** 從時序算「最新 vs 前一日」變動：{curr, prev, pct, date, prevDate}。 */
function seriesChange(series) {
    const clean = (series || []).filter((p) => p.v != null && Number.isFinite(p.v));
    if (!clean.length) return { curr: null, prev: null, pct: null };
    const curr = clean[clean.length - 1];
    if (clean.length < 2) return { curr: curr.v, prev: null, pct: null, date: curr.d };
    const prev = clean[clean.length - 2];
    const pct = prev.v ? ((curr.v - prev.v) / prev.v) * 100 : null;
    return { curr: curr.v, prev: prev.v, pct, date: curr.d, prevDate: prev.d };
}
exports.seriesChange = seriesChange;
/**
 * 偵測明顯漲跌並（若設 LINE_MARKET_NOTIFY_TO）推播 LINE。每個資料日只通知一次（app_settings 記錄）。
 * 門檻：預設 5%，可用 LIVESTOCK_MOVE_THRESHOLD_PCT 覆寫。
 * @returns { moves:[{title,curr,prev,pct}], notified:boolean, dataDate }
 */
async function notifyLivestockMovesIfAny(db, opts) {
    const thr = Math.max(0.5, Number(process.env.LIVESTOCK_MOVE_THRESHOLD_PCT || 5));
    const hist = await loadLivestockHistory(db, 10);
    const moves = [];
    let dataDate = null;
    for (const it of exports.KEY_ITEMS) {
        const ch = seriesChange(hist[it.key]);
        if (ch.date && (!dataDate || ch.date > dataDate)) dataDate = ch.date;
        if (ch.pct != null && Math.abs(ch.pct) >= thr) {
            moves.push({ title: it.title, unit: it.unit, curr: ch.curr, prev: ch.prev, pct: ch.pct, date: ch.date });
        }
    }
    if (!moves.length) return { moves: [], notified: false, dataDate };
    // 每個資料日只通知一次
    const lastRow = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("livestock_notify_last_date");
    if (lastRow && String(lastRow.value) === String(dataDate)) {
        return { moves, notified: false, dataDate, skipped: "already_notified_today" };
    }
    const to = String(process.env.LINE_MARKET_NOTIFY_TO || "").trim();
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
    let notified = false;
    if (to && token) {
        const arrow = (p) => (p > 0 ? "🔺漲" : "🔻跌");
        const lines = moves.map((m) => `${m.title}：${m.prev}→${m.curr} ${m.unit}（${arrow(m.pct)} ${m.pct > 0 ? "+" : ""}${m.pct.toFixed(1)}%）`);
        const text = `📈 畜產雞蛋行情提醒（${dataDate}）\n有明顯漲跌：\n` + lines.join("\n");
        try {
            const resp = await fetch("https://api.line.me/v2/bot/message/push", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
            });
            notified = resp.ok;
            if (!resp.ok) console.warn("[livestock-notify] LINE push %s", resp.status);
        }
        catch (e) { console.warn("[livestock-notify] push 失敗:", e?.message || e); }
    }
    // 不論有無設 to，都記錄「已判定過今天」避免重複判斷；但只有真的推播成功才更新 last_date
    if (notified) {
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("livestock_notify_last_date", String(dataDate));
    }
    return { moves, notified, dataDate };
}
exports.notifyLivestockMovesIfAny = notifyLivestockMovesIfAny;

/** 優先 API，失敗改讀快照；API 成功則寫快照。回傳 { prices, dataDate, source, status, errors } */
async function loadOrFetchLivestockPrices(db, dateStr) {
    const target = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || "")) ? dateStr : new Date().toISOString().slice(0, 10);
    const api = await fetchLivestockPrices(target);
    if (api.prices.length > 0) {
        await saveLivestockSnapshot(db, api.dataDate, api.prices);
        return { prices: api.prices, dataDate: api.dataDate, source: "api", status: api.status, errors: api.errors };
    }
    // API 空／失敗 → 讀最近一天快照
    const latest = await db.prepare("SELECT record_date FROM livestock_price_snapshots ORDER BY record_date DESC LIMIT 1").get();
    if (latest?.record_date) {
        const snap = await loadLivestockSnapshot(db, latest.record_date);
        if (snap.length) return { prices: snap, dataDate: latest.record_date, source: "snapshot", status: "snapshot", errors: api.errors };
    }
    return { prices: [], dataDate: target, source: "empty", status: api.status, errors: api.errors };
}
