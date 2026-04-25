"use strict";
/**
 * 客戶畫像 cheat sheet：由歷史訂單／別名／改正紀錄聚合，供 Gemini 提示與後台業務參考。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCustomerProfile = computeCustomerProfile;
exports.buildCustomerCheatSheetText = buildCustomerCheatSheetText;
const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
function safeDateMs(raw) {
    if (raw == null || raw === "")
        return null;
    const s = String(raw).trim();
    if (!s)
        return null;
    let d = new Date(s);
    if (!Number.isNaN(d.getTime()))
        return d.getTime();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        d = new Date(s + "T12:00:00");
        return Number.isNaN(d.getTime()) ? null : d.getTime();
    }
    return null;
}
function topBuckets(counts, maxBins) {
    const entries = Object.entries(counts).filter(([, n]) => n > 0);
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, maxBins);
}
async function computeCustomerProfile(db, customerId) {
    const cid = String(customerId || "").trim();
    if (!db || !cid)
        return null;
    const nameExpr = `COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''))`;
    let topUnits = [];
    try {
        const ur = await db
            .prepare(`SELECT TRIM(oi.unit) AS u, COUNT(*) AS c
      FROM order_items oi INNER JOIN orders ord ON ord.id = oi.order_id
      WHERE ord.customer_id = ? AND oi.unit IS NOT NULL AND TRIM(oi.unit) <> ''
      GROUP BY TRIM(oi.unit) ORDER BY c DESC LIMIT 20`)
            .all(cid);
        topUnits = (ur || []).slice(0, 5).map((x) => ({ unit: String(x.u || "").trim(), count: Number(x.c) || 0 }));
    }
    catch (_) { /* ignore */ }
    let topItems = [];
    try {
        const ir = await db
            .prepare(`SELECT ${nameExpr} AS nm, COUNT(*) AS c
      FROM order_items oi
      INNER JOIN orders ord ON ord.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE ord.customer_id = ?
      GROUP BY ${nameExpr}
      HAVING nm IS NOT NULL AND LENGTH(TRIM(nm)) > 0
      ORDER BY c DESC LIMIT 40`)
            .all(cid);
        topItems = (ir || []).slice(0, 30).map((x) => ({ name: String(x.nm || "").trim(), count: Number(x.c) || 0 }));
    }
    catch (_) { /* ignore */ }
    let aliases = [];
    try {
        const ar = await db
            .prepare(`SELECT cpa.alias, p.name AS product_name
      FROM customer_product_aliases cpa
      JOIN products p ON p.id = cpa.product_id
      WHERE cpa.customer_id = ?
      ORDER BY cpa.alias
      LIMIT 80`)
            .all(cid);
        aliases = (ar || []).map((x) => ({ alias: String(x.alias || "").trim(), productName: String(x.product_name || "").trim() }));
    }
    catch (_) { /* ignore */ }
    let multiSubCustomer = false;
    let distinctSubN = 0;
    try {
        const sr = await db
            .prepare(`SELECT COUNT(DISTINCT TRIM(COALESCE(oi.sub_customer, ''))) AS n
      FROM order_items oi INNER JOIN orders ord ON ord.id = oi.order_id
      WHERE ord.customer_id = ? AND TRIM(COALESCE(oi.sub_customer, '')) <> ''`)
            .get(cid);
        distinctSubN = Number(sr?.n) || 0;
        multiSubCustomer = distinctSubN >= 2;
    }
    catch (_) { /* ignore */ }
    let imageOrderRatio = null;
    let orderSampleN = 0;
    try {
        const tr = await db
            .prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM order_attachments oa WHERE oa.order_id = o.id) THEN 1 ELSE 0 END) AS with_img
      FROM orders o WHERE o.customer_id = ?`)
            .get(cid);
        const total = Number(tr?.total) || 0;
        const wimg = Number(tr?.with_img) || 0;
        orderSampleN = total;
        if (total > 0)
            imageOrderRatio = wimg / total;
    }
    catch (_) { /* ignore */ }
    const weekdayCounts = {};
    const hourCounts = {};
    let timeSamples = 0;
    try {
        const orows = await db
            .prepare(`SELECT updated_at, order_date FROM orders WHERE customer_id = ? ORDER BY COALESCE(updated_at, order_date) DESC LIMIT 400`)
            .all(cid);
        for (const o of orows || []) {
            const ms = safeDateMs(o.updated_at) ?? safeDateMs(o.order_date);
            if (ms == null)
                continue;
            const d = new Date(ms);
            const wd = d.getDay();
            const dayLabel = "星期" + WEEK_LABELS[wd];
            weekdayCounts[dayLabel] = (weekdayCounts[dayLabel] || 0) + 1;
            const hr = d.getHours();
            const bucket = `${hr}:00–${hr + 1}:00`;
            hourCounts[bucket] = (hourCounts[bucket] || 0) + 1;
            timeSamples++;
        }
    }
    catch (_) { /* ignore */ }
    const topWeekdays = topBuckets(weekdayCounts, 4);
    const topHours = topBuckets(hourCounts, 4);
    let errorHotspots = [];
    try {
        const hr = await db
            .prepare(`SELECT COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), '')) AS nm, COUNT(*) AS c
      FROM data_change_log d
      INNER JOIN order_items oi ON oi.id = d.entity_id
      INNER JOIN orders ord ON ord.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE d.entity_type = 'order_item_product' AND d.action = 'set_product' AND ord.customer_id = ?
      GROUP BY COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(oi.raw_name), ''))
      HAVING nm IS NOT NULL AND LENGTH(TRIM(nm)) > 0
      ORDER BY c DESC LIMIT 15`)
            .all(cid);
        errorHotspots = (hr || []).map((x) => ({ name: String(x.nm || "").trim(), fixCount: Number(x.c) || 0 }));
    }
    catch (_) { /* ignore */ }
    const cust = await db.prepare("SELECT known_sub_customers FROM customers WHERE id = ?").get(cid);
    const knownSubList = String(cust?.known_sub_customers || "")
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
    return {
        customerId: cid,
        topUnits,
        topItems,
        aliases,
        multiSubCustomer,
        distinctSubCount: distinctSubN,
        knownSubCustomersListed: knownSubList.length,
        imageOrderRatio,
        ordersSampledForImageRatio: orderSampleN,
        topWeekdays,
        topHours,
        timeSampleCount: timeSamples,
        errorHotspots,
    };
}
function formatRatio(x) {
    if (x == null || Number.isNaN(Number(x)))
        return "—";
    return `${(100 * Number(x)).toFixed(0)}%`;
}
async function buildCustomerCheatSheetText(db, customerId, opts) {
    const maxChars = opts?.maxChars ?? 3500;
    const p = await computeCustomerProfile(db, customerId);
    if (!p)
        return "";
    const lines = [];
    lines.push("【客戶畫像（系統依歷史訂單自動整理，僅供辨識參考）】");
    if (p.topUnits.length)
        lines.push(`常用單位 Top：${p.topUnits.map((x) => `${x.unit}（${x.count} 次）`).join("、")}`);
    if (p.topItems.length)
        lines.push(`常叫品項 Top：${p.topItems.map((x) => x.name).join("、")}`);
    if (p.aliases.length) {
        const al = p.aliases.slice(0, 40).map((x) => `「${x.alias}」→${x.productName}`);
        lines.push(`客戶別名／俗名：${al.join("；")}`);
    }
    lines.push(`多子客戶／分店（明細列上曾出現不同 sub_customer）：${p.multiSubCustomer ? "是" : "否"}${p.distinctSubCount > 0 ? `（曾見 ${p.distinctSubCount} 種標籤）` : ""}`);
    if (p.imageOrderRatio != null && p.ordersSampledForImageRatio > 0)
        lines.push(`有附圖之訂單比例（歷史筆數 ${p.ordersSampledForImageRatio}）：${formatRatio(p.imageOrderRatio)}（高者可能常用手寫／雙欄表單拍照）`);
    if (p.topWeekdays.length)
        lines.push(`常下單星期：${p.topWeekdays.map(([k, v]) => `${k} ${v} 筆`).join("、")}`);
    if (p.topHours.length)
        lines.push(`常見時段：${p.topHours.map(([k, v]) => `${k}（${v} 筆）`).join("、")}`);
    if (p.errorHotspots.length)
        lines.push(`辨識易混品項（後台曾修正品項對應）：${p.errorHotspots.map((x) => x.name).join("、")}`);
    let out = lines.join("\n");
    if (out.length > maxChars)
        out = out.slice(0, maxChars) + "\n…（已截斷）";
    return out;
}
