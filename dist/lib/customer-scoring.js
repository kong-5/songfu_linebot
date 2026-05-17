"use strict";
/**
 * 客戶評分演算法
 * 評分範圍：0-100
 * 五大維度（總分權重）：
 *   1. 活躍度（30 分）：過去 90 天訂單數
 *   2. 採購量（15 分）：過去 90 天品項總筆數
 *   3. 長期忠誠（10 分）：累計訂單數
 *   4. 客訴扣分（-30 分）：未解客訴 × 8、累計客訴 × 1.5
 *   5. 流失風險（-15 分）：超過平均間隔 1.5～3 倍漸進扣分
 *
 * 等級：
 *   ≥80 主力客戶 (★★★★★)
 *   ≥60 穩定客戶 (★★★★)
 *   ≥40 一般客戶 (★★★)
 *   ≥20 需關注 (★★)
 *   <20 流失中 (★)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCustomerScore = computeCustomerScore;
exports.scoreToTier = scoreToTier;
exports.fetchCustomerScoringInputs = fetchCustomerScoringInputs;
exports.fetchAllCustomerReminderStats = fetchAllCustomerReminderStats;

/**
 * 計算分數（純函式，純資料 → 分數，方便測試）
 * @param {Object} inputs
 *   orders90:           過去 90 天訂單數
 *   ordersAll:          累計訂單數
 *   items90:            過去 90 天品項筆數（總和）
 *   complaintsAll:      累計客訴數
 *   complaintsOpen:     未解客訴數
 *   daysSinceLastOrder: 距上次叫貨天數（null = 從未叫貨）
 *   avgIntervalDays:    過去 90 天平均間隔（null = 樣本不足）
 * @returns {{score:number, breakdown:Object}}
 */
function computeCustomerScore(inputs) {
    const o90 = Math.max(0, Number(inputs?.orders90) || 0);
    const oAll = Math.max(0, Number(inputs?.ordersAll) || 0);
    const i90 = Math.max(0, Number(inputs?.items90) || 0);
    const cAll = Math.max(0, Number(inputs?.complaintsAll) || 0);
    const cOpen = Math.max(0, Number(inputs?.complaintsOpen) || 0);
    const days = inputs?.daysSinceLastOrder;
    const avg = inputs?.avgIntervalDays;
    // 活躍度（最高 30 分）：每筆訂單 1 分，30 分上限
    const sActive = Math.min(30, o90 * 1.0);
    // 採購量（最高 15 分）：品項筆數 × 0.1，封頂 15
    const sVolume = Math.min(15, i90 * 0.1);
    // 長期忠誠（最高 10 分）：累計 × 0.05 上限 10
    const sLoyalty = Math.min(10, oAll * 0.05);
    // 客訴扣分（最高扣 30 分）：未解 × 8、累計 × 1.5
    const sComplaintPenalty = -Math.min(30, cOpen * 8 + cAll * 1.5);
    // 流失風險（最高扣 15 分）：超過 avg × 1.5 開始遞增扣分
    let sChurnPenalty = 0;
    if (days != null && avg != null && avg > 0) {
        const ratio = days / avg;
        if (ratio > 1.5) {
            // ratio 1.5 → 0 分 ; 3.0+ → -15 分（線性插值）
            sChurnPenalty = -Math.min(15, Math.max(0, (ratio - 1.5) * 10));
        }
    }
    // 基底 45（讓沒資料的新客戶也有合理初始分）
    const sBase = 45;
    const raw = sBase + sActive + sVolume + sLoyalty + sComplaintPenalty + sChurnPenalty;
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    return {
        score,
        breakdown: {
            base: sBase,
            activity: Math.round(sActive * 10) / 10,
            volume: Math.round(sVolume * 10) / 10,
            loyalty: Math.round(sLoyalty * 10) / 10,
            complaint_penalty: Math.round(sComplaintPenalty * 10) / 10,
            churn_penalty: Math.round(sChurnPenalty * 10) / 10,
        },
        inputs: { orders90: o90, ordersAll: oAll, items90: i90, complaintsAll: cAll, complaintsOpen: cOpen, daysSinceLastOrder: days, avgIntervalDays: avg },
    };
}

/**
 * 分數 → 等級徽章定義
 */
function scoreToTier(score) {
    const s = Number(score) || 0;
    if (s >= 80) return { label: "主力客戶", stars: "★★★★★", color: "#15803d", bg: "#d1fae5" };
    if (s >= 60) return { label: "穩定客戶", stars: "★★★★", color: "#1d4ed8", bg: "#dbeafe" };
    if (s >= 40) return { label: "一般客戶", stars: "★★★", color: "#737373", bg: "#f5f5f5" };
    if (s >= 20) return { label: "需關注", stars: "★★", color: "#b45309", bg: "#fef3c7" };
    return { label: "流失中", stars: "★", color: "#b91c1c", bg: "#fee2e2" };
}

/**
 * 從 DB 撈分數計算所需資料（單客戶）
 * 用 'YYYY-MM-DD' 字串比較，PG/SQLite 共用
 * @returns {Promise<Object>} inputs for computeCustomerScore
 */
async function fetchCustomerScoringInputs(db, customerId, todayIso) {
    const cid = String(customerId || "").trim();
    if (!db || !cid) return null;
    const isPg = Boolean(process.env.DATABASE_URL);
    const fromIso90 = (() => {
        const d = new Date(todayIso + "T00:00:00+08:00");
        d.setDate(d.getDate() - 89);
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d);
    })();
    const notVoid = "AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint')";
    // 90 天訂單
    const r90 = await db.prepare("SELECT COUNT(*) AS n FROM orders o WHERE o.customer_id = ? " + notVoid + " AND o.order_date >= ? AND o.order_date <= ?").get(cid, fromIso90, todayIso);
    const orders90 = Number(r90?.n) || 0;
    // 累計訂單
    const rAll = await db.prepare("SELECT COUNT(*) AS n FROM orders o WHERE o.customer_id = ? " + notVoid).get(cid);
    const ordersAll = Number(rAll?.n) || 0;
    // 90 天品項
    const ri90 = await db.prepare(
        "SELECT COUNT(*) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id " +
        "WHERE o.customer_id = ? AND oi.voided_at IS NULL " + notVoid + " AND o.order_date >= ? AND o.order_date <= ?"
    ).get(cid, fromIso90, todayIso);
    const items90 = Number(ri90?.n) || 0;
    // 累計客訴
    const rcAll = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND LOWER(TRIM(COALESCE(status,''))) = 'complaint'").get(cid);
    const complaintsAll = Number(rcAll?.n) || 0;
    // 未解客訴
    const rcOpen = await db.prepare(
        "SELECT COUNT(*) AS n FROM orders o LEFT JOIN complaint_handling ch ON ch.order_id = o.id " +
        "WHERE o.customer_id = ? AND LOWER(TRIM(COALESCE(o.status,''))) = 'complaint' AND COALESCE(ch.handle_status, 'pending') <> 'resolved'"
    ).get(cid);
    const complaintsOpen = Number(rcOpen?.n) || 0;
    // 最後叫貨日（非客訴）+ 距今天數
    const lastRow = await db.prepare(
        "SELECT order_date FROM orders WHERE customer_id = ? AND COALESCE(LOWER(TRIM(status)),'') NOT IN ('deleted','complaint') ORDER BY order_date DESC LIMIT 1"
    ).get(cid);
    let daysSinceLastOrder = null;
    if (lastRow?.order_date) {
        const last = new Date(String(lastRow.order_date) + "T00:00:00+08:00");
        const today = new Date(todayIso + "T00:00:00+08:00");
        daysSinceLastOrder = Math.round((today - last) / 86400000);
    }
    // 過去 90 天平均間隔
    const last90Rows = await db.prepare(
        "SELECT DISTINCT order_date FROM orders o WHERE o.customer_id = ? " + notVoid + " AND o.order_date >= ? AND o.order_date <= ? ORDER BY order_date DESC"
    ).all(cid, fromIso90, todayIso);
    let avgIntervalDays = null;
    if (last90Rows && last90Rows.length >= 2) {
        const dates = last90Rows.map(r => new Date(String(r.order_date) + "T00:00:00+08:00").getTime()).sort((a, b) => b - a);
        const gaps = [];
        for (let i = 1; i < dates.length; i++) gaps.push((dates[i - 1] - dates[i]) / 86400000);
        avgIntervalDays = Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10;
    }
    return { orders90, ordersAll, items90, complaintsAll, complaintsOpen, daysSinceLastOrder, avgIntervalDays, lastOrderDate: lastRow?.order_date || null };
}

/**
 * 批次計算「所有啟用客戶」的提醒狀態（單一 aggregate query，速度比逐筆呼叫 fetchCustomerScoringInputs 快 100 倍以上）
 * @param {*} db
 * @param {string} todayIso 'YYYY-MM-DD'
 * @returns {Promise<Array<{id, name, lineGroupId, handoverNotes, lastOrderDate, daysSinceLastOrder, avgIntervalDays, orders90, ordersAll}>>}
 */
async function fetchAllCustomerReminderStats(db, todayIso) {
    const fromIso90 = (() => {
        const d = new Date(todayIso + "T00:00:00+08:00");
        d.setDate(d.getDate() - 89);
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d);
    })();
    // 單一 query 算出每位客戶的最後訂單、累計訂單、90 天訂單、90 天 distinct dates、90 天日期範圍
    // 用 CASE WHEN 而非 PG 專屬 FILTER，相容 SQLite + PG
    const sql = `
        SELECT
          c.id, c.name, c.line_group_id, c.crm_handover_notes,
          MAX(CASE WHEN COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') THEN o.order_date END) AS last_order_date,
          COUNT(CASE WHEN COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') THEN 1 END) AS orders_all,
          COUNT(CASE WHEN o.order_date >= ? AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') THEN 1 END) AS orders_90,
          COUNT(DISTINCT CASE WHEN o.order_date >= ? AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') THEN o.order_date END) AS distinct_dates_90,
          MIN(CASE WHEN o.order_date >= ? AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') THEN o.order_date END) AS min_date_90,
          MAX(CASE WHEN o.order_date >= ? AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint') THEN o.order_date END) AS max_date_90
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        WHERE (c.active = 1 OR c.active IS NULL)
        GROUP BY c.id, c.name, c.line_group_id, c.crm_handover_notes
    `;
    const rows = await db.prepare(sql).all(fromIso90, fromIso90, fromIso90, fromIso90);
    return (rows || []).map((r) => {
        const lastOrderDate = r.last_order_date;
        let daysSinceLastOrder = null;
        if (lastOrderDate) {
            const last = new Date(String(lastOrderDate) + "T00:00:00+08:00");
            const today = new Date(todayIso + "T00:00:00+08:00");
            daysSinceLastOrder = Math.round((today - last) / 86400000);
        }
        let avgIntervalDays = null;
        const distinctDates = Number(r.distinct_dates_90) || 0;
        if (distinctDates >= 2 && r.min_date_90 && r.max_date_90) {
            const mn = new Date(String(r.min_date_90) + "T00:00:00+08:00");
            const mx = new Date(String(r.max_date_90) + "T00:00:00+08:00");
            const span = (mx - mn) / 86400000;
            avgIntervalDays = Math.round((span / (distinctDates - 1)) * 10) / 10;
        }
        return {
            id: r.id,
            name: r.name,
            lineGroupId: r.line_group_id,
            handoverNotes: r.crm_handover_notes,
            lastOrderDate,
            daysSinceLastOrder,
            avgIntervalDays,
            orders90: Number(r.orders_90) || 0,
            ordersAll: Number(r.orders_all) || 0,
        };
    });
}
