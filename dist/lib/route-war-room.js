"use strict";
/**
 * 路線戰情室：聚合「今日所有路線客戶的叫貨狀態」+ 4 種異常訊號。
 *
 * 異常訊號類型：
 *   - need_review     ：今天有訂單，但 order_items.need_review > 0（辨識仍需人工核對）
 *   - expected_missing：rhythm_daily_signals 標記今天應該叫但還沒叫
 *   - overdue         ：上次叫貨距今 > avg_cycle_days × 2（含「沒叫過貨」即視為需關注）
 *   - amount_anomaly  ：今天總數量偏離過去 30 日均量 > 50%（高或低）
 *
 * 設計取捨：所有判斷盡量靠 SQL aggregation，再在 JS 做最後比對。
 * 避免 N+1 查詢；單張儀表板呼叫只 6~7 個 SQL。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRouteWarRoomData = getRouteWarRoomData;

const AMOUNT_ANOMALY_PCT = 0.5;     // 偏離 30 日均量 > 50%
const OVERDUE_MULTIPLIER = 2;       // 上次叫貨距今 > avg_cycle × 此倍數

function dateAddDaysIso(iso, delta) {
    const d = new Date(iso + "T12:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    d.setDate(d.getDate() + delta);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetweenIso(a, b) {
    const da = new Date(a + "T12:00:00");
    const db = new Date(b + "T12:00:00");
    if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
    return Math.round((db - da) / 86400000);
}

/**
 * @param {object} db - 共用 db wrapper
 * @param {string} dateIso - 'YYYY-MM-DD'，要看哪一天的戰情
 * @returns {Promise<{ today: string, routes: Array, unrouted: Array, totals: object }>}
 */
async function getRouteWarRoomData(db, dateIso) {
    const today = String(dateIso || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
        throw new Error("dateIso 格式應為 YYYY-MM-DD");
    }

    // 30 天回溯區間，用來算客戶平均量
    const windowStart = dateAddDaysIso(today, -30);
    // 公司公休日：被視為「應該不會叫」的日子，這些日子不計入 expected/overdue
    const holidaysToday = await db.prepare(
        "SELECT 1 AS hit FROM company_calendar WHERE date = ? AND kind IN ('national_holiday', 'company_off') LIMIT 1"
    ).get(today);
    const todayIsHoliday = Boolean(holidaysToday?.hit);

    // 1) 全部「啟用」客戶（含 route_line + sub_customers 為 NULL）
    const customers = await db.prepare(
        "SELECT id, name, route_line, line_group_id FROM customers WHERE active IS NULL OR active = 1"
    ).all();

    if (!customers?.length) {
        return { today, todayIsHoliday, routes: [], unrouted: [], totals: { ordered: 0, missing: 0, abnormal: 0 } };
    }

    // 2) 今天每個客戶的訂單彙總（item_count、total_qty、need_review、order_count）
    const todayOrderRows = await db.prepare(`
        SELECT
            o.id AS order_id,
            o.order_no,
            o.customer_id,
            COUNT(oi.id) AS item_count,
            SUM(CASE WHEN oi.need_review = 1 THEN 1 ELSE 0 END) AS need_review_count,
            COALESCE(SUM(oi.quantity), 0) AS total_qty
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.order_date = ?
          AND COALESCE(LOWER(TRIM(o.status)), '') <> 'deleted'
        GROUP BY o.id, o.order_no, o.customer_id
    `).all(today);

    const todayByCustomer = new Map();
    for (const r of todayOrderRows) {
        if (!todayByCustomer.has(r.customer_id)) todayByCustomer.set(r.customer_id, []);
        todayByCustomer.get(r.customer_id).push({
            orderId: r.order_id,
            orderNo: r.order_no,
            itemCount: Number(r.item_count) || 0,
            needReviewCount: Number(r.need_review_count) || 0,
            totalQty: Number(r.total_qty) || 0,
        });
    }

    // 3) 30 天內各客戶「叫貨日」的數量（用來算平均、上次叫貨）
    const last30Rows = await db.prepare(`
        SELECT
            o.customer_id,
            o.order_date,
            SUM(COALESCE(oi.quantity, 0)) AS day_qty
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.order_date >= ? AND o.order_date <= ?
          AND COALESCE(LOWER(TRIM(o.status)), '') <> 'deleted'
        GROUP BY o.customer_id, o.order_date
        ORDER BY o.customer_id, o.order_date
    `).all(windowStart, today);

    // 整理：customer_id → { dailyQty: Map<date, qty>, dates: [...排序過...], avgCycle, avgQty }
    const statsByCustomer = new Map();
    for (const r of last30Rows) {
        const cid = r.customer_id;
        if (!statsByCustomer.has(cid)) statsByCustomer.set(cid, { dailyQty: new Map(), dates: [] });
        const s = statsByCustomer.get(cid);
        s.dailyQty.set(r.order_date, (s.dailyQty.get(r.order_date) || 0) + Number(r.day_qty || 0));
    }
    for (const s of statsByCustomer.values()) {
        s.dates = [...s.dailyQty.keys()].sort();
        const lastDate = s.dates[s.dates.length - 1] || null;
        s.lastOrderDate = lastDate;
        s.daysSinceLast = lastDate ? daysBetweenIso(lastDate, today) : null;
        // 平均週期（叫貨日之間的間隔）
        const gaps = [];
        for (let i = 1; i < s.dates.length; i++) {
            const g = daysBetweenIso(s.dates[i - 1], s.dates[i]);
            if (Number.isFinite(g) && g > 0) gaps.push(g);
        }
        s.avgCycleDays = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
        // 平均量（排除今天）
        const qtyValuesExcludingToday = [...s.dailyQty.entries()]
            .filter(([d]) => d !== today)
            .map(([, q]) => q);
        s.avgQty = qtyValuesExcludingToday.length
            ? qtyValuesExcludingToday.reduce((a, b) => a + b, 0) / qtyValuesExcludingToday.length
            : null;
    }

    // 4) 今天的 rhythm 訊號（expected_missing）
    const rhythmRows = await db.prepare(
        "SELECT customer_id, signal_type, COUNT(*) AS cnt FROM rhythm_daily_signals WHERE signal_date = ? GROUP BY customer_id, signal_type"
    ).all(today);
    const rhythmByCustomer = new Map();
    for (const r of rhythmRows) {
        if (!rhythmByCustomer.has(r.customer_id)) rhythmByCustomer.set(r.customer_id, {});
        rhythmByCustomer.get(r.customer_id)[r.signal_type] = Number(r.cnt) || 0;
    }

    // 5) 為每個客戶組合資料 + 計算 anomalies
    const enrichedCustomers = customers.map((c) => {
        const todayOrders = todayByCustomer.get(c.id) || [];
        const stats = statsByCustomer.get(c.id) || null;
        const rhythmSig = rhythmByCustomer.get(c.id) || {};

        const hasOrderedToday = todayOrders.length > 0;
        const totalNeedReview = todayOrders.reduce((s, o) => s + o.needReviewCount, 0);
        const totalItems = todayOrders.reduce((s, o) => s + o.itemCount, 0);
        const totalQtyToday = todayOrders.reduce((s, o) => s + o.totalQty, 0);

        const anomalies = [];
        // need_review
        if (hasOrderedToday && totalNeedReview > 0) {
            anomalies.push({ type: "need_review", label: `${totalNeedReview} 項待確認`, severity: "warn" });
        }
        // expected_missing（公休日不算）
        if (!todayIsHoliday && !hasOrderedToday && rhythmSig.expected_missing) {
            anomalies.push({ type: "expected_missing", label: `預期應叫 ${rhythmSig.expected_missing} 項`, severity: "warn" });
        }
        // overdue（公休日不算；無 avgCycle 或 avg < 1.5 不判斷，避免每日叫貨客戶誤報）
        if (!todayIsHoliday && !hasOrderedToday && stats?.avgCycleDays != null && stats.avgCycleDays >= 1.5 && stats.daysSinceLast != null) {
            const threshold = stats.avgCycleDays * OVERDUE_MULTIPLIER;
            if (stats.daysSinceLast > threshold) {
                anomalies.push({
                    type: "overdue",
                    label: `已 ${stats.daysSinceLast} 天未叫（平均 ${stats.avgCycleDays.toFixed(1)} 天）`,
                    severity: "danger",
                });
            }
        }
        // amount_anomaly（只在「今天有叫貨」+ 有夠多歷史時才比較）
        if (hasOrderedToday && stats?.avgQty != null && stats.avgQty > 0 && totalQtyToday > 0) {
            const ratio = totalQtyToday / stats.avgQty;
            if (ratio < (1 - AMOUNT_ANOMALY_PCT)) {
                anomalies.push({
                    type: "amount_anomaly",
                    label: `量偏低（${totalQtyToday.toFixed(0)} vs 均 ${stats.avgQty.toFixed(0)}）`,
                    severity: "warn",
                });
            } else if (ratio > (1 + AMOUNT_ANOMALY_PCT)) {
                anomalies.push({
                    type: "amount_anomaly",
                    label: `量偏高（${totalQtyToday.toFixed(0)} vs 均 ${stats.avgQty.toFixed(0)}）`,
                    severity: "info",
                });
            }
        }

        return {
            id: c.id,
            name: c.name,
            routeLine: c.route_line == null ? null : Number(c.route_line),
            hasLineGroup: Boolean(c.line_group_id),
            hasOrderedToday,
            todayOrders,
            totalItems,
            totalQtyToday,
            totalNeedReview,
            lastOrderDate: stats?.lastOrderDate || null,
            daysSinceLast: stats?.daysSinceLast == null ? null : Number(stats.daysSinceLast),
            avgCycleDays: stats?.avgCycleDays == null ? null : Number(stats.avgCycleDays),
            avgQty: stats?.avgQty == null ? null : Number(stats.avgQty),
            anomalies,
        };
    });

    // 6) 依 route_line 分組
    const grouped = new Map();
    const unrouted = [];
    for (const c of enrichedCustomers) {
        if (c.routeLine == null) {
            unrouted.push(c);
        } else {
            if (!grouped.has(c.routeLine)) grouped.set(c.routeLine, []);
            grouped.get(c.routeLine).push(c);
        }
    }

    // 排序：每組內已叫貨的放後面，未叫貨/有異常的放前面
    const sortInRoute = (a, b) => {
        const aDanger = a.anomalies.some((x) => x.severity === "danger") ? 0 : 1;
        const bDanger = b.anomalies.some((x) => x.severity === "danger") ? 0 : 1;
        if (aDanger !== bDanger) return aDanger - bDanger;
        const aHasAnom = a.anomalies.length ? 0 : 1;
        const bHasAnom = b.anomalies.length ? 0 : 1;
        if (aHasAnom !== bHasAnom) return aHasAnom - bHasAnom;
        const aOrdered = a.hasOrderedToday ? 1 : 0;
        const bOrdered = b.hasOrderedToday ? 1 : 0;
        if (aOrdered !== bOrdered) return aOrdered - bOrdered;
        return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
    };

    const routes = [...grouped.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([routeLine, list]) => {
            list.sort(sortInRoute);
            const orderedCnt = list.filter((c) => c.hasOrderedToday).length;
            const abnormalCnt = list.filter((c) => c.anomalies.length).length;
            return {
                routeLine,
                routeLabel: `路線 ${routeLine}`,
                customers: list,
                stats: { total: list.length, ordered: orderedCnt, missing: list.length - orderedCnt, abnormal: abnormalCnt },
            };
        });
    unrouted.sort(sortInRoute);

    const totals = {
        ordered: enrichedCustomers.filter((c) => c.hasOrderedToday).length,
        missing: enrichedCustomers.filter((c) => !c.hasOrderedToday).length,
        abnormal: enrichedCustomers.filter((c) => c.anomalies.length).length,
        total: enrichedCustomers.length,
    };

    return { today, todayIsHoliday, routes, unrouted, totals };
}
