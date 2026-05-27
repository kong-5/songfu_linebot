"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBasketCommand = parseBasketCommand;
exports.upsertBasketLog = upsertBasketLog;
exports.getBasketLogForCustomerDate = getBasketLogForCustomerDate;
exports.listBasketLogsForCustomerMonth = listBasketLogsForCustomerMonth;
exports.formatRecordReply = formatRecordReply;
exports.formatTodayReply = formatTodayReply;
exports.formatMonthReply = formatMonthReply;
exports.formatHelpReply = formatHelpReply;

const id_js_1 = require("./id.js");

const CN_NUM_MAP = { "一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };

function nowSqlExpr() {
    return process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
}

function fullwidthToHalf(s) {
    return String(s || "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

function normalizeBasketText(t) {
    let s = fullwidthToHalf(t || "");
    s = s.replace(/[一二兩三四五六七八九]/g, (ch) => String(CN_NUM_MAP[ch] ?? ch));
    s = s.replace(/十/g, "10");
    return s;
}

/**
 * 解析司機在 LINE 群組打的空籃指令。
 * 支援格式：
 *   空籃 去5 收3 / 空藍去5收3 / 空籃 收3 去5 / 空籃 去5 / 空籃 收3
 *   空籃 今日 / 空籃 今天 / 空籃 本月 / 空籃 這個月
 *   空籃              → help
 *   空籃 xxx 不認識   → help
 * @returns {null | { kind: "record"|"query_today"|"query_month"|"help", takenTo?:number, pickedUp?:number }}
 */
function parseBasketCommand(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return null;
    // 觸發前綴：空籃 / 空藍（同音字，司機常打錯）
    const m = text.match(/^空\s*[籃藍蘭]\s*(.*)$/);
    if (!m) return null;
    const restRaw = m[1].trim();
    if (!restRaw) return { kind: "help" };
    const rest = normalizeBasketText(restRaw);
    // 查詢
    if (/^(今日|今天|本日)$/.test(rest)) return { kind: "query_today" };
    if (/^(本月|這個月|當月)$/.test(rest)) return { kind: "query_month" };
    // 抽取「去N」「收N」（順序可換）
    const goM = rest.match(/去\s*(\d{1,4})/);
    const pickM = rest.match(/收\s*(\d{1,4})/);
    if (!goM && !pickM) return { kind: "help" };
    const takenTo = goM ? parseInt(goM[1], 10) : null;
    const pickedUp = pickM ? parseInt(pickM[1], 10) : null;
    const within = (n) => n == null || (Number.isFinite(n) && n >= 0 && n <= 9999);
    if (!within(takenTo) || !within(pickedUp)) return { kind: "help" };
    return { kind: "record", takenTo, pickedUp };
}

/**
 * Upsert 當天空籃紀錄（覆蓋當天數字，並寫一筆 history）。
 * 若先前有紀錄，本次只填的欄位會「覆蓋」對應數字（另一邊保留原值）。
 * 例：先前 去5 收3，本次只報「去6」→ 變成 去6 收3。
 * 若想清空某邊，傳 0。
 */
async function upsertBasketLog(db, payload) {
    const { customerId, logDate, takenTo, pickedUp, lineGroupId, reporterUserId, reporterDisplayName, rawMessage, actor } = payload;
    if (!customerId || !logDate) throw new Error("customerId 與 logDate 必填");
    const now = nowSqlExpr();
    const existing = await db.prepare(
        "SELECT id, taken_to, picked_up FROM basket_logs WHERE customer_id = ? AND log_date = ?"
    ).get(customerId, logDate);
    const prevTaken = existing ? (existing.taken_to ?? null) : null;
    const prevPicked = existing ? (existing.picked_up ?? null) : null;
    const newTaken = takenTo != null ? takenTo : prevTaken;
    const newPicked = pickedUp != null ? pickedUp : prevPicked;
    let logId;
    if (existing) {
        logId = existing.id;
        await db.prepare(
            "UPDATE basket_logs SET taken_to = ?, picked_up = ?, line_group_id = COALESCE(?, line_group_id), " +
            "reporter_user_id = COALESCE(?, reporter_user_id), reporter_display_name = COALESCE(?, reporter_display_name), " +
            "raw_message = ?, updated_at = " + now + " WHERE id = ?"
        ).run(newTaken, newPicked, lineGroupId ?? null, reporterUserId ?? null, reporterDisplayName ?? null, rawMessage ?? null, logId);
    } else {
        logId = (0, id_js_1.newId)("bsk");
        await db.prepare(
            "INSERT INTO basket_logs (id, customer_id, log_date, taken_to, picked_up, line_group_id, reporter_user_id, reporter_display_name, raw_message, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, " + now + ", " + now + ")"
        ).run(logId, customerId, logDate, newTaken, newPicked, lineGroupId ?? null, reporterUserId ?? null, reporterDisplayName ?? null, rawMessage ?? null);
    }
    // 寫 history（每次都記，方便追蹤司機是不是打錯）
    try {
        const hid = (0, id_js_1.newId)("bskh");
        await db.prepare(
            "INSERT INTO basket_log_history (id, basket_log_id, customer_id, log_date, prev_taken_to, prev_picked_up, new_taken_to, new_picked_up, actor, reporter_user_id, raw_message, created_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, " + now + ")"
        ).run(hid, logId, customerId, logDate, prevTaken, prevPicked, newTaken, newPicked, actor ?? null, reporterUserId ?? null, rawMessage ?? null);
    } catch (e) {
        console.warn("[basket-log] history 寫入失敗（不影響主紀錄）:", e?.message || e);
    }
    return {
        isNew: !existing,
        prev: existing ? { takenTo: prevTaken, pickedUp: prevPicked } : null,
        current: { takenTo: newTaken, pickedUp: newPicked },
        logId,
    };
}

async function getBasketLogForCustomerDate(db, customerId, logDate) {
    return await db.prepare(
        "SELECT id, customer_id, log_date, taken_to, picked_up, updated_at FROM basket_logs WHERE customer_id = ? AND log_date = ?"
    ).get(customerId, logDate);
}

/**
 * 列出某客戶某年月的所有紀錄。
 * @param {string} ym  格式 YYYY-MM
 */
async function listBasketLogsForCustomerMonth(db, customerId, ym) {
    const start = ym + "-01";
    // 算下個月 1 號
    const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    return await db.prepare(
        "SELECT log_date, taken_to, picked_up, updated_at FROM basket_logs " +
        "WHERE customer_id = ? AND log_date >= ? AND log_date < ? ORDER BY log_date ASC"
    ).all(customerId, start, end);
}

function fmtNum(n) {
    return n == null ? "—" : String(n);
}

function formatRecordReply({ customerName, date, isNew, prev, current }) {
    const head = `✅ ${date}　${customerName || ""}`.trim();
    const cur = `空籃 去 ${fmtNum(current.takenTo)}　收 ${fmtNum(current.pickedUp)}`;
    if (isNew) return `${head}\n${cur}`;
    const prevLine = `（原本 去 ${fmtNum(prev.takenTo)}　收 ${fmtNum(prev.pickedUp)}）`;
    return `${head}\n已更新：${cur}\n${prevLine}`;
}

function formatTodayReply({ customerName, date, row }) {
    if (!row) return `${date}　${customerName || ""}\n今日尚無空籃紀錄。`;
    return `${date}　${customerName || ""}\n空籃 去 ${fmtNum(row.taken_to)}　收 ${fmtNum(row.picked_up)}`;
}

function formatMonthReply({ customerName, ym, rows }) {
    if (!rows.length) return `${ym}　${customerName || ""}\n本月尚無空籃紀錄。`;
    let sumTo = 0, sumPick = 0;
    const lines = rows.map((r) => {
        const t = r.taken_to ?? 0, p = r.picked_up ?? 0;
        sumTo += t; sumPick += p;
        const md = String(r.log_date).slice(5); // MM-DD
        return `${md}　去 ${fmtNum(r.taken_to)}　收 ${fmtNum(r.picked_up)}`;
    });
    const net = sumTo - sumPick;
    const tail = `\n合計：去 ${sumTo}　收 ${sumPick}　淨值 ${net >= 0 ? "+" : ""}${net}`;
    return `${ym}　${customerName || ""}\n` + lines.join("\n") + tail;
}

function formatHelpReply() {
    return [
        "空籃指令格式：",
        "  空籃 去5 收3   （帶 5 個過去、收 3 個回來）",
        "  空籃 去5        （只報帶過去）",
        "  空籃 收3        （只報收回來）",
        "  空籃 今日       （查今天紀錄）",
        "  空籃 本月       （查本月明細）",
        "※ 同一天再報會覆蓋當天數字。請報「今日累計總數」，不要分趟報。",
    ].join("\n");
}
