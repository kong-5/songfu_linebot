"use strict";
/**
 * 台灣國定假日內建表（2026 ~ 2028）。
 * 來源：行政院人事行政總處 2026 年度行事曆。每年初更新隔年資料即可。
 *
 * 資料庫只存「使用者匯入過的年份」(company_calendar.kind='national_holiday')；
 * 此處內建供匯入按鈕使用，避免每次都打外部 API。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATIONAL_HOLIDAYS = NATIONAL_HOLIDAYS;
exports.getHolidaysForYear = getHolidaysForYear;
exports.buildMonthGrid = buildMonthGrid;

const HOLIDAYS_2026 = [
    { date: "2026-01-01", label: "元旦" },
    { date: "2026-02-16", label: "農曆除夕" },
    { date: "2026-02-17", label: "春節" },
    { date: "2026-02-18", label: "春節" },
    { date: "2026-02-19", label: "春節" },
    { date: "2026-02-20", label: "春節" },
    { date: "2026-02-27", label: "228 連假補假" },
    { date: "2026-02-28", label: "和平紀念日" },
    { date: "2026-04-03", label: "兒童節" },
    { date: "2026-04-06", label: "清明節補假" },
    { date: "2026-05-01", label: "勞動節" },
    { date: "2026-06-19", label: "端午節" },
    { date: "2026-09-25", label: "中秋節" },
    { date: "2026-10-09", label: "國慶日補假" },
    { date: "2026-10-10", label: "國慶日" },
];

const HOLIDAYS_2027 = [
    { date: "2027-01-01", label: "元旦" },
    { date: "2027-02-05", label: "農曆除夕" },
    { date: "2027-02-06", label: "春節" },
    { date: "2027-02-07", label: "春節" },
    { date: "2027-02-08", label: "春節" },
    { date: "2027-02-09", label: "春節補假" },
    { date: "2027-02-26", label: "228 連假" },
    { date: "2027-02-27", label: "228 連假" },
    { date: "2027-02-28", label: "和平紀念日" },
    { date: "2027-04-02", label: "兒童節" },
    { date: "2027-04-05", label: "清明節" },
    { date: "2027-05-01", label: "勞動節" },
    { date: "2027-06-09", label: "端午節" },
    { date: "2027-09-15", label: "中秋節" },
    { date: "2027-10-08", label: "國慶日連假" },
    { date: "2027-10-11", label: "國慶日補假" },
];

function NATIONAL_HOLIDAYS() {
    return [...HOLIDAYS_2026, ...HOLIDAYS_2027];
}

function getHolidaysForYear(year) {
    const y = Number(year);
    if (y === 2026) return [...HOLIDAYS_2026];
    if (y === 2027) return [...HOLIDAYS_2027];
    return [];
}

/**
 * 月曆 grid：回傳該月每個日期的 cell 資料（含跨週前後填補空白）。
 * eventsByDate = { 'YYYY-MM-DD': [{kind, label, ...}, ...] }
 */
function buildMonthGrid(year, month, eventsByDate) {
    const y = Number(year), m = Number(month);
    const first = new Date(y, m - 1, 1);
    const startDow = first.getDay(); // 0=Sun
    // 改成週一起始：Mon=0, Tue=1, ..., Sun=6
    const offsetMon = (startDow + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const rows = [];
    let cur = [];
    for (let i = 0; i < offsetMon; i++) cur.push({ filler: true });
    for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        cur.push({
            day: d,
            iso,
            dow: ((offsetMon + d - 1) % 7),
            events: eventsByDate?.[iso] || [],
        });
        if (cur.length === 7) {
            rows.push(cur);
            cur = [];
        }
    }
    while (cur.length > 0 && cur.length < 7) cur.push({ filler: true });
    if (cur.length === 7) rows.push(cur);
    return rows;
}
