"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// 觸發詞偵測
exports.isBasketTrigger = isBasketTrigger;
// 主資料操作
exports.getOrCreateBasketLog = getOrCreateBasketLog;
exports.upsertBasketLogLines = upsertBasketLogLines;
exports.getBasketLinesForDay = getBasketLinesForDay;
exports.getMonthAggregates = getMonthAggregates;
exports.listBasketLogsForCustomerMonth = listBasketLogsForCustomerMonth;
// 訊息格式
exports.formatLiffRecordMessage = formatLiffRecordMessage;
exports.buildLiffEntryUrl = buildLiffEntryUrl;

const id_js_1 = require("./id.js");

/** 號碼籃合法號碼（不含 4） */
const NUMBERED_BASKET_NOS = [1, 2, 3, 5, 6, 7, 8, 9];
exports.NUMBERED_BASKET_NOS = NUMBERED_BASKET_NOS;

/** 三種規格 */
const BASKET_KINDS = ["numbered", "square", "round"];
const BASKET_KIND_LABEL = { numbered: "號碼籃", square: "四角空籃", round: "圓籃" };
exports.BASKET_KINDS = BASKET_KINDS;
exports.BASKET_KIND_LABEL = BASKET_KIND_LABEL;

function nowSqlExpr() {
    return process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
}

/**
 * 偵測訊息是否為「叫出空籃 LIFF」的觸發詞。
 * 接受「空籃」「空藍」（同音字司機常打錯），允許前後空白；但不接受附帶數字（避免跟「空籃 去5 回3」舊指令混淆，已停用）。
 */
function isBasketTrigger(text) {
    if (!text) return false;
    const t = String(text).trim();
    return /^空\s*[籃藍]\s*$/.test(t);
}

/**
 * 取得當日 basket_log；不存在就建立一筆。
 * @returns {Promise<{id:string, isNew:boolean}>}
 */
async function getOrCreateBasketLog(db, payload) {
    const { customerId, logDate, lineGroupId, reporterUserId, reporterDisplayName } = payload;
    if (!customerId || !logDate) throw new Error("customerId 與 logDate 必填");
    const now = nowSqlExpr();
    const existing = await db.prepare(
        "SELECT id FROM basket_logs WHERE customer_id = ? AND log_date = ?"
    ).get(customerId, logDate);
    if (existing) {
        // 更新 reporter 資訊（保留既有非空值）
        await db.prepare(
            "UPDATE basket_logs SET line_group_id = COALESCE(?, line_group_id), " +
            "reporter_user_id = COALESCE(?, reporter_user_id), reporter_display_name = COALESCE(?, reporter_display_name), " +
            "updated_at = " + now + " WHERE id = ?"
        ).run(lineGroupId ?? null, reporterUserId ?? null, reporterDisplayName ?? null, existing.id);
        return { id: existing.id, isNew: false };
    }
    const id = (0, id_js_1.newId)("bsk");
    await db.prepare(
        "INSERT INTO basket_logs (id, customer_id, log_date, line_group_id, reporter_user_id, reporter_display_name, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, " + now + ", " + now + ")"
    ).run(id, customerId, logDate, lineGroupId ?? null, reporterUserId ?? null, reporterDisplayName ?? null);
    return { id, isNew: true };
}

/**
 * 全量覆蓋當日的所有 lines：刪掉舊的，插入新的。寫一筆 history 保留前後快照。
 * @param {object} db
 * @param {object} args
 * @param {string} args.customerId
 * @param {string} args.logDate (YYYY-MM-DD)
 * @param {Array<{kind:string, no:number, takenTo:number, pickedUp:number}>} args.lines
 * @param {string|null} [args.lineGroupId]
 * @param {string|null} [args.reporterUserId]
 * @param {string|null} [args.reporterDisplayName]
 * @param {string|null} [args.actor]
 * @param {string|null} [args.rawMessage]
 */
async function upsertBasketLogLines(db, args) {
    const { customerId, logDate, lines, lineGroupId, reporterUserId, reporterDisplayName, actor, rawMessage } = args;
    const cleanLines = (Array.isArray(lines) ? lines : [])
        .map((l) => ({
            kind: String(l?.kind || "").trim(),
            no: Number.isFinite(Number(l?.no)) ? Number(l.no) : 0,
            takenTo: Math.max(0, Math.min(9999, Number(l?.takenTo || 0) | 0)),
            pickedUp: Math.max(0, Math.min(9999, Number(l?.pickedUp || 0) | 0)),
        }))
        .filter((l) => BASKET_KINDS.includes(l.kind))
        .filter((l) => l.takenTo > 0 || l.pickedUp > 0); // 0/0 不存
    // 號碼籃必須 no in NUMBERED_BASKET_NOS；其他規格強制 no=0
    for (const l of cleanLines) {
        if (l.kind === "numbered") {
            if (!NUMBERED_BASKET_NOS.includes(l.no)) throw new Error(`號碼籃號碼必須是 1-9 (不含 4)，收到 ${l.no}`);
        } else {
            l.no = 0;
        }
    }
    const now = nowSqlExpr();
    const { id: logId } = await getOrCreateBasketLog(db, { customerId, logDate, lineGroupId, reporterUserId, reporterDisplayName });
    const prevLines = await getBasketLinesForLog(db, logId);
    // 同步更新 basket_logs.taken_to/picked_up 為三規格總計（向後相容舊欄位）
    let sumTo = 0, sumPick = 0;
    for (const l of cleanLines) { sumTo += l.takenTo; sumPick += l.pickedUp; }
    // [fix 2026-07-08] 刪舊分項＋插新分項＋回寫總計包進單一交易；過去無交易，
    // 中途失敗（或並發）會留下「分項與 basket_logs 總計不一致」或撞唯一索引丟半套資料。
    const doWrite = async (h) => {
        await h.prepare("DELETE FROM basket_log_lines WHERE basket_log_id = ?").run(logId);
        for (const l of cleanLines) {
            const lid = (0, id_js_1.newId)("bskl");
            await h.prepare(
                "INSERT INTO basket_log_lines (id, basket_log_id, basket_kind, basket_no, taken_to, picked_up, updated_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, " + now + ")"
            ).run(lid, logId, l.kind, l.no, l.takenTo, l.pickedUp);
        }
        await h.prepare(
            "UPDATE basket_logs SET taken_to = ?, picked_up = ?, raw_message = ?, updated_at = " + now + " WHERE id = ?"
        ).run(sumTo, sumPick, rawMessage ?? null, logId);
    };
    if (typeof db.transaction === "function") {
        await db.transaction(doWrite);
    }
    else {
        await doWrite(db);
    }
    // history 快照
    try {
        const hid = (0, id_js_1.newId)("bskh");
        const prevSum = prevLines.reduce((acc, l) => ({ to: acc.to + (l.taken_to || 0), pk: acc.pk + (l.picked_up || 0) }), { to: 0, pk: 0 });
        await db.prepare(
            "INSERT INTO basket_log_history (id, basket_log_id, customer_id, log_date, prev_taken_to, prev_picked_up, new_taken_to, new_picked_up, prev_lines_json, new_lines_json, actor, reporter_user_id, raw_message, created_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, " + now + ")"
        ).run(hid, logId, customerId, logDate, prevSum.to, prevSum.pk, sumTo, sumPick,
            JSON.stringify(prevLines), JSON.stringify(cleanLines), actor ?? null, reporterUserId ?? null, rawMessage ?? null);
    } catch (e) {
        console.warn("[basket-log] history 寫入失敗（不影響主紀錄）:", e?.message || e);
    }
    return { logId, lines: cleanLines, sumTo, sumPick };
}

async function getBasketLinesForLog(db, logId) {
    return await db.prepare(
        "SELECT id, basket_kind, basket_no, taken_to, picked_up FROM basket_log_lines WHERE basket_log_id = ? ORDER BY basket_kind, basket_no"
    ).all(logId);
}

/** 拿某客戶某天的所有分項；找不到主 log 回 [] */
async function getBasketLinesForDay(db, customerId, logDate) {
    const row = await db.prepare("SELECT id FROM basket_logs WHERE customer_id = ? AND log_date = ?").get(customerId, logDate);
    if (!row) return [];
    return await getBasketLinesForLog(db, row.id);
}

/**
 * 月合計：返回 { totalTakenTo, totalPickedUp, byKindNo: [{kind, no, takenTo, pickedUp}] }
 * @param {string} ym YYYY-MM
 */
async function getMonthAggregates(db, customerId, ym) {
    const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
    const start = ym + "-01";
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    const rows = await db.prepare(
        "SELECT l.basket_kind, l.basket_no, SUM(l.taken_to) AS sum_to, SUM(l.picked_up) AS sum_pk " +
        "FROM basket_log_lines l JOIN basket_logs b ON b.id = l.basket_log_id " +
        "WHERE b.customer_id = ? AND b.log_date >= ? AND b.log_date < ? " +
        "GROUP BY l.basket_kind, l.basket_no ORDER BY l.basket_kind, l.basket_no"
    ).all(customerId, start, end);
    let totalTo = 0, totalPk = 0;
    const byKindNo = (rows || []).map((r) => {
        const t = Number(r.sum_to || 0), p = Number(r.sum_pk || 0);
        totalTo += t; totalPk += p;
        return { kind: r.basket_kind, no: Number(r.basket_no) || 0, takenTo: t, pickedUp: p };
    });
    return { totalTakenTo: totalTo, totalPickedUp: totalPk, byKindNo };
}

/** 後台用：列某客戶某月所有 basket_logs（按日） */
async function listBasketLogsForCustomerMonth(db, customerId, ym) {
    const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
    const start = ym + "-01";
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    return await db.prepare(
        "SELECT id, log_date, taken_to, picked_up, reporter_display_name, updated_at " +
        "FROM basket_logs WHERE customer_id = ? AND log_date >= ? AND log_date < ? ORDER BY log_date ASC"
    ).all(customerId, start, end);
}

/**
 * 給 LIFF sendMessages 用的「司機提交後在群組顯示」文字。
 * 包含：今日各規格明細 + 本月合計。
 */
function formatLiffRecordMessage({ customerName, date, todayLines, monthAgg }) {
    const lines = ["✅ 空籃已記帳"];
    if (customerName) lines.push(`${date}　${customerName}`);
    else lines.push(date);
    lines.push("───── 今日 ─────");
    if (!todayLines || todayLines.length === 0) {
        lines.push("（無）");
    } else {
        // 號碼籃先列、依號碼排序；其他規格在後
        const numbered = todayLines.filter((l) => l.kind === "numbered").sort((a, b) => a.no - b.no);
        const square = todayLines.find((l) => l.kind === "square");
        const round = todayLines.find((l) => l.kind === "round");
        if (numbered.length) {
            lines.push("號碼籃：");
            for (const n of numbered) lines.push(`  ${n.no}號　去 ${n.takenTo}　回 ${n.pickedUp}`);
        }
        if (square) lines.push(`四角空籃　去 ${square.takenTo}　回 ${square.pickedUp}`);
        if (round) lines.push(`圓籃　　　去 ${round.takenTo}　回 ${round.pickedUp}`);
    }
    lines.push("════════════");
    const net = (monthAgg?.totalTakenTo || 0) - (monthAgg?.totalPickedUp || 0);
    const sign = net >= 0 ? "+" : "";
    lines.push(`本月合計：去 ${monthAgg?.totalTakenTo || 0}　回 ${monthAgg?.totalPickedUp || 0}　淨：${sign}${net}`);
    return lines.join("\n");
}

/** 建立 LIFF 進入連結（帶 customer / date 等 query string） */
function buildLiffEntryUrl(liffId, { customerId, date } = {}) {
    if (!liffId) return null;
    const params = new URLSearchParams();
    if (customerId) params.set("customer", customerId);
    if (date) params.set("date", date);
    const qs = params.toString();
    return `https://liff.line.me/${liffId}${qs ? "?" + qs : ""}`;
}
