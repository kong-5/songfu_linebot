"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDailySummaryPushEnabled = isDailySummaryPushEnabled;
exports.getDailySummaryPushHour = getDailySummaryPushHour;
exports.buildDailySummaryFlex = buildDailySummaryFlex;
exports.runDailySummaryPush = runDailySummaryPush;

const KEY_ENABLED = "daily_summary_push_enabled";
const KEY_HOUR = "daily_summary_push_hour";
const DEFAULT_HOUR = 22;

function parseBool(v) {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
}

async function isDailySummaryPushEnabled(db) {
    if (!db) return false;
    try {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(KEY_ENABLED);
        return parseBool(row?.value);
    } catch (_) { return false; }
}

async function getDailySummaryPushHour(db) {
    if (!db) return DEFAULT_HOUR;
    try {
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(KEY_HOUR);
        const n = row?.value ? parseInt(String(row.value), 10) : NaN;
        if (Number.isFinite(n) && n >= 0 && n <= 23) return n;
    } catch (_) { /* ignore */ }
    return DEFAULT_HOUR;
}

function taipeiDateYYYYMMDD(now) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Taipei",
        year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now || new Date());
}

/** 建立每日訂單摘要 Flex Message（給單一客戶） */
function buildDailySummaryFlex({ customerName, dateText, items, orderNos }) {
    const itemRows = (items || []).slice(0, 30).map(it => ({
        type: "box",
        layout: "horizontal",
        paddingTop: "6px",
        paddingBottom: "6px",
        contents: [
            { type: "text", text: it.name || "（待確認）", size: "sm", color: "#222222", flex: 5, wrap: true },
            { type: "text", text: `${it.quantity ?? "-"} ${it.unit || ""}`.trim(), size: "sm", color: "#444444", flex: 2, align: "end" },
        ],
    }));
    const separators = [];
    for (let i = 0; i < itemRows.length; i++) {
        separators.push(itemRows[i]);
        if (i < itemRows.length - 1) separators.push({ type: "separator", color: "#eeeeee" });
    }
    const orderNoText = (orderNos && orderNos.length)
        ? (orderNos.length > 1 ? `訂單編號：${orderNos.join("、")}` : `訂單編號：${orderNos[0]}`)
        : "";
    return {
        type: "bubble",
        size: "kilo",
        header: {
            type: "box", layout: "vertical", backgroundColor: "#1a7c6e", paddingAll: "16px",
            contents: [
                { type: "text", text: "📋 本日訂單確認", color: "#ffffff", size: "lg", weight: "bold" },
                { type: "text", text: dateText || "", color: "#b2dfdb", size: "sm", margin: "sm" },
                ...(customerName ? [{ type: "text", text: customerName, color: "#ffffff", size: "xs", margin: "xs" }] : []),
            ],
        },
        body: {
            type: "box", layout: "vertical", backgroundColor: "#f9f9f9", paddingAll: "16px", spacing: "none",
            contents: itemRows.length ? [
                {
                    type: "box", layout: "horizontal", paddingBottom: "6px",
                    contents: [
                        { type: "text", text: "品名", size: "xs", color: "#aaaaaa", flex: 5 },
                        { type: "text", text: "數量", size: "xs", color: "#aaaaaa", flex: 2, align: "end" },
                    ],
                },
                { type: "separator", color: "#cccccc" },
                ...separators,
            ] : [
                { type: "text", text: "本日無訂單紀錄", size: "sm", color: "#999999", align: "center" },
            ],
        },
        footer: {
            type: "box", layout: "vertical", backgroundColor: "#ffffff", paddingAll: "12px",
            contents: [
                ...(orderNoText ? [{ type: "text", text: orderNoText, size: "xs", color: "#666666", wrap: true }] : []),
                { type: "text", text: "若內容有誤，請於明天中午前回覆，逾時視為確認。", size: "xxs", color: "#888888", margin: "sm", wrap: true },
                { type: "text", text: "松富生鮮物流", size: "xxs", color: "#bbbbbb", align: "center", margin: "md" },
            ],
        },
    };
}

/**
 * 為每位有 line_group_id 的客戶，推送當日訂單摘要（status != 'deleted'）。
 * 透過 LINE Messaging API push。回傳 { ok, sent, skipped, errors }。
 */
async function runDailySummaryPush(db, options = {}) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return { ok: false, error: "no LINE_CHANNEL_ACCESS_TOKEN", sent: 0, skipped: 0, errors: [] };
    const date = options.date || taipeiDateYYYYMMDD();
    const dryRun = options.dryRun === true;
    const customers = await db.prepare(
        "SELECT id, name, line_group_id FROM customers WHERE line_group_id IS NOT NULL AND line_group_id != '' ORDER BY name"
    ).all();
    let sent = 0;
    let skipped = 0;
    const errors = [];
    for (const c of customers) {
        try {
            const orders = await db.prepare(
                "SELECT id, order_no FROM orders WHERE customer_id = ? AND order_date = ? AND COALESCE(LOWER(TRIM(status)),'') <> 'deleted' ORDER BY id"
            ).all(c.id, date);
            if (!orders.length) { skipped++; continue; }
            const orderIds = orders.map(o => o.id);
            const placeholders = orderIds.map(() => "?").join(",");
            const items = await db.prepare(
                `SELECT oi.raw_name, oi.quantity, oi.unit, p.name AS product_name
                 FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id IN (${placeholders}) AND oi.voided_at IS NULL ORDER BY oi.order_id, oi.id`
            ).all(...orderIds);
            const flex = buildDailySummaryFlex({
                customerName: c.name,
                dateText: date,
                items: items.map(it => ({
                    name: it.product_name || it.raw_name || "(待確認)",
                    quantity: it.quantity,
                    unit: it.unit || "",
                })),
                orderNos: orders.map(o => o.order_no).filter(Boolean),
            });
            const altText = `【松富物流 本日訂單確認 ${date}】共 ${items.length} 個品項`;
            if (dryRun) {
                sent++;
                continue;
            }
            const resp = await fetch("https://api.line.me/v2/bot/message/push", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ to: c.line_group_id, messages: [{ type: "flex", altText, contents: flex }] }),
            });
            if (resp.ok) {
                sent++;
            } else {
                const t = await resp.text().catch(() => "");
                errors.push(`${c.name}: ${resp.status} ${t.slice(0, 120)}`);
            }
        } catch (e) {
            errors.push(`${c.name}: ${e?.message || e}`);
        }
    }
    return { ok: true, sent, skipped, errors, date };
}
