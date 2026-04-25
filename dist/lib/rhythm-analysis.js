"use strict";
/**
 * 客戶×品項週期分析（純訂單資料 + SQL，零 AI）。
 * 每日寫入 rhythm_daily_signals：預期應叫未叫、流失風險等。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.taipeiTodayIso = taipeiTodayIso;
exports.addCalendarDaysIso = addCalendarDaysIso;
exports.runRhythmDailyJob = runRhythmDailyJob;
exports.fetchRhythmRollupRows = fetchRhythmRollupRows;
exports.forecastTomorrowCompanyOrders = forecastTomorrowCompanyOrders;
const id_js_1 = require("./id.js");
const WINDOW_DAYS = 90;
const MIN_DISTINCT_ORDER_DAYS = 4;
const MIN_TODAY_DOW_SHARE = 0.1;
const MAX_AVG_CYCLE_FOR_EXPECTED = 45;
const MIN_AVG_CYCLE_FOR_EXPECTED = 1.2;
const CHURN_AVG_CYCLE_MAX = 16;
const CHURN_GAP_MULTIPLIER = 3;
function taipeiTodayIso() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}
function addCalendarDaysIso(iso, deltaDays) {
    const [y, m, d] = iso.split("-").map(Number);
    const t = Date.UTC(y, m - 1, d + deltaDays);
    const x = new Date(t);
    const yy = x.getUTCFullYear();
    const mm = String(x.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(x.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}
function weekdayIndexFromIso(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const t = Date.UTC(y, m - 1, d);
    return new Date(t).getUTCDay();
}
const WD_SHORT = ["日", "一", "二", "三", "四", "五", "六"];
function daysBetweenIso(a, b) {
    const [ya, ma, da] = a.split("-").map(Number);
    const [yb, mb, db] = b.split("-").map(Number);
    const ta = Date.UTC(ya, ma - 1, da);
    const tb = Date.UTC(yb, mb - 1, db);
    return Math.round((tb - ta) / 86400000);
}
function mean(arr) {
    if (!arr.length)
        return null;
    return arr.reduce((s, x) => s + x, 0) / arr.length;
}
function stddevSample(arr) {
    if (arr.length < 2)
        return null;
    const m = mean(arr);
    const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(v);
}
/** 每日合計：同一客戶×品項×訂單日僅一行 */
/** 全公司：明日星期幾之歷史同日平均訂單筆數（僅統計，非預測模型） */
async function forecastTomorrowCompanyOrders(db) {
    const today = taipeiTodayIso();
    const tomorrow = addCalendarDaysIso(today, 1);
    const twd = weekdayIndexFromIso(tomorrow);
    const start = addCalendarDaysIso(today, -84);
    const rows = await db
        .prepare(`SELECT order_date, COUNT(*) AS n
     FROM orders
     WHERE order_date >= ? AND order_date <= ?
     GROUP BY order_date`)
        .all(start, today);
    const counts = [];
    for (const r of rows || []) {
        const od = String(r.order_date || "").slice(0, 10);
        if (weekdayIndexFromIso(od) === twd)
            counts.push(Number(r.n) || 0);
    }
    if (!counts.length)
        return { tomorrow, sampleDays: 0, avgOrders: null, sumQtyNote: null };
    const avgOrders = mean(counts);
    return {
        tomorrow,
        weekdayLabel: `週${WD_SHORT[twd]}`,
        sampleDays: counts.length,
        avgOrders: avgOrders != null ? Math.round(avgOrders * 10) / 10 : null,
    };
}
async function fetchRhythmRollupRows(db, windowStartIso, windowEndIso) {
    const sql = `
    SELECT o.customer_id AS customer_id,
           oi.product_id AS product_id,
           o.order_date AS order_date,
           SUM(COALESCE(oi.quantity, 0)) AS day_qty
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
     INNER JOIN customers c ON c.id = o.customer_id
     INNER JOIN products p ON p.id = oi.product_id
     WHERE o.order_date >= ? AND o.order_date <= ?
       AND oi.product_id IS NOT NULL AND TRIM(oi.product_id) != ''
       AND (c.active IS NULL OR c.active = 1)
       AND (p.active IS NULL OR p.active = 1)
     GROUP BY o.customer_id, oi.product_id, o.order_date
     ORDER BY o.customer_id, oi.product_id, o.order_date
  `;
    return (await db.prepare(sql).all(windowStartIso, windowEndIso)) || [];
}
async function hasProductOnDate(db, customerId, productId, dateIso) {
    const row = await db
        .prepare(`SELECT 1 AS ok
     FROM orders o
     INNER JOIN order_items oi ON oi.order_id = o.id
    WHERE o.customer_id = ? AND o.order_date = ? AND oi.product_id = ?
    LIMIT 1`)
        .get(customerId, dateIso, productId);
    return Boolean(row?.ok);
}
function buildPairStats(rowsForPair) {
    const byDate = new Map();
    for (const r of rowsForPair) {
        const od = String(r.order_date || "").slice(0, 10);
        const dq = Number(r.day_qty) || 0;
        byDate.set(od, (byDate.get(od) || 0) + dq);
    }
    const distinctDates = [...byDate.keys()].sort();
    const nDays = distinctDates.length;
    if (nDays < MIN_DISTINCT_ORDER_DAYS)
        return null;
    const gaps = [];
    for (let i = 1; i < distinctDates.length; i++) {
        gaps.push(daysBetweenIso(distinctDates[i - 1], distinctDates[i]));
    }
    const avgCycle = gaps.length ? mean(gaps) : null;
    const stdCycle = gaps.length >= 2 ? stddevSample(gaps) : null;
    const lastDate = distinctDates[distinctDates.length - 1];
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const dt of distinctDates) {
        dowCounts[weekdayIndexFromIso(dt)]++;
    }
    const dowTotal = dowCounts.reduce((a, b) => a + b, 0) || 1;
    const dowPct = dowCounts.map((c) => c / dowTotal);
    const dailyTotals = distinctDates.map((dt) => byDate.get(dt) || 0);
    const avgQtyPerOrderDay = mean(dailyTotals);
    const stdQtyPerOrderDay = dailyTotals.length >= 2 ? stddevSample(dailyTotals) : null;
    const sortedDow = dowCounts
        .map((c, i) => ({ i, c }))
        .sort((a, b) => b.c - a.c);
    const top2 = new Set(sortedDow.slice(0, 2).map((x) => x.i));
    return {
        distinctDates,
        nDistinctDays: nDays,
        gaps,
        avgCycleDays: avgCycle,
        stdCycleDays: stdCycle,
        lastOrderDate: lastDate,
        dowCounts,
        dowPct,
        top2WeekdayIndexes: top2,
        avgQtyPerOrderDay,
        stdQtyPerOrderDay,
    };
}
function dowDistributionText(dowPct) {
    return dowPct.map((p, i) => `週${WD_SHORT[i]} ${(100 * p).toFixed(0)}%`).join(" · ");
}
/**
 * @returns {{ inserted: number, signalDate: string, today: string }}
 */
async function runRhythmDailyJob(db) {
    if (!db)
        return { inserted: 0, signalDate: "", today: "" };
    const today = taipeiTodayIso();
    const windowEnd = today;
    const windowStart = addCalendarDaysIso(today, -WINDOW_DAYS);
    const isPg = Boolean(process.env.DATABASE_URL);
    const tsSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
    await db.prepare("DELETE FROM rhythm_daily_signals WHERE signal_date = ?").run(today);
    const rollup = await fetchRhythmRollupRows(db, windowStart, windowEnd);
    const byPair = new Map();
    for (const r of rollup) {
        const k = `${r.customer_id}\t${r.product_id}`;
        if (!byPair.has(k))
            byPair.set(k, []);
        byPair.get(k).push(r);
    }
    let inserted = 0;
    const todayWd = weekdayIndexFromIso(today);
    for (const [, rows] of byPair) {
        const st = buildPairStats(rows);
        if (!st || st.avgCycleDays == null)
            continue;
        if (st.avgCycleDays < MIN_AVG_CYCLE_FOR_EXPECTED || st.avgCycleDays > MAX_AVG_CYCLE_FOR_EXPECTED)
            continue;
        const daysSinceLast = daysBetweenIso(st.lastOrderDate, today);
        const todayShare = st.dowPct[todayWd] ?? 0;
        const isUsualDay = todayShare >= MIN_TODAY_DOW_SHARE || st.top2WeekdayIndexes.has(todayWd);
        const overdueThreshold = Math.max(1, Math.ceil(st.avgCycleDays - 0.001));
        const isOverdue = daysSinceLast >= overdueThreshold;
        const hasToday = await hasProductOnDate(db, rows[0].customer_id, rows[0].product_id, today);
        const metaBase = {
            window_days: WINDOW_DAYS,
            last_order_date: st.lastOrderDate,
            days_since_last: daysSinceLast,
            avg_cycle_days: Math.round(st.avgCycleDays * 100) / 100,
            std_cycle_days: st.stdCycleDays != null ? Math.round(st.stdCycleDays * 100) / 100 : null,
            weekday_distribution: dowDistributionText(st.dowPct),
            dow_pct_today: Math.round(todayShare * 1000) / 1000,
            avg_qty_per_order_day: st.avgQtyPerOrderDay != null ? Math.round(st.avgQtyPerOrderDay * 1000) / 1000 : null,
            std_qty_per_order_day: st.stdQtyPerOrderDay != null ? Math.round(st.stdQtyPerOrderDay * 1000) / 1000 : null,
            distinct_order_days: st.nDistinctDays,
        };
        const cid = rows[0].customer_id;
        const pid = rows[0].product_id;
        if (isUsualDay && isOverdue && !hasToday) {
            const id = (0, id_js_1.newId)("rhy");
            await db
                .prepare(`INSERT INTO rhythm_daily_signals (id, signal_date, customer_id, product_id, signal_type, meta_json, created_at)
         VALUES (?, ?, ?, ?, 'expected_missing', ?, ${tsSql})`)
                .run(id, today, cid, pid, JSON.stringify({ ...metaBase, reason: "常叫星期且已超過平均週期，今日尚未叫此品項" }));
            inserted++;
        }
        if (st.nDistinctDays >= 5 &&
            st.avgCycleDays <= CHURN_AVG_CYCLE_MAX &&
            daysSinceLast >= CHURN_GAP_MULTIPLIER * st.avgCycleDays &&
            daysSinceLast >= 14) {
            const id2 = (0, id_js_1.newId)("rhy");
            await db
                .prepare(`INSERT INTO rhythm_daily_signals (id, signal_date, customer_id, product_id, signal_type, meta_json, created_at)
         VALUES (?, ?, ?, ?, 'churn_risk', ?, ${tsSql})`)
                .run(id2, today, cid, pid, JSON.stringify({
                ...metaBase,
                reason: "過往叫貨頻繁，本次間隔已顯著拉長（流失風險）",
            }));
            inserted++;
        }
    }
    try {
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("rhythm_last_job_at", today + "T" + new Date().toISOString().slice(11, 19));
        await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("rhythm_last_job_count", String(inserted));
    }
    catch (_) { /* ignore */ }
    return { inserted, signalDate: today, today };
}
