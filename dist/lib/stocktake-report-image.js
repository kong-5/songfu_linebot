"use strict";
/**
 * 盤點結果報表圖（JPG）：盤點送出後產一張圖，人工存下來貼到 LINE 群組。
 *
 * 為什麼是圖不是推播：推播到群組是「按群組人數」計則數（8 人群組推一次＝8 則），
 * 每天每倉推一次很快就吃掉方案額度。改成「產圖 → 人自己傳」＝零則數。
 *
 * 為什麼是 SVG→sharp 不是 headless browser：比照 announcement-image.js / quote-report.js，
 * puppeteer 對這種固定版面太重。代價是要自己算座標與斷字（見 estWidth/clip）。
 *
 * 口徑：一律用「盤點當下」凍結值（sys/fut/should/counted/diff），與每日盤點頁左半邊、
 * 統計圖表同一套 —— 圖是「當下定案」的憑證，不能隔天回頭看數字就變了。
 * 紅標沿用 isHotDiff 的結果（呼叫端算好放進 item.hot）。
 *
 * 品項多時自動分頁（LINE 圖片上限 4096px），回傳多張 JPEG。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderStocktakeReportJpegs = renderStocktakeReportJpegs;
exports.buildStocktakeReportSvgs = buildStocktakeReportSvgs;

const sharp = require("sharp");

const W = 1080;
const PAD = 40;
const ROW_H = 52;
const ROWS_PER_PAGE = 30;      // 30 列 ≈ 2100px 高，遠低於 LINE 4096px 上限
const FONT = "'Noto Sans CJK TC','Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";

// 顏色沿用後台既有 hex（每日盤點頁同一組），圖與畫面看起來是同一個系統
const C = {
    bg: "#ffffff",
    panel: "#f7f8fa",
    line: "#e3e6ec",
    line2: "#d4d8e0",
    t1: "#15181f",
    t2: "#4a5060",
    t3: "#6c7280",
    accent: "#2563d9",
    good: "#1f7a46",
    bad: "#b3261e",
    info: "#0369a1",
    adj: "#8250df",
    hotBg: "#fdeceb",
};

function escapeXml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** 估算字串寬度（px）：CJK/全形算 1 個字寬，英數半形算 0.55。SVG 沒有 measureText，只能估。 */
function estWidth(s, fontSize) {
    let u = 0;
    for (const ch of String(s || "")) {
        u += /[　-鿿＀-￯]/.test(ch) ? 1 : 0.55;
    }
    return u * fontSize;
}

/** 超過 maxPx 就截斷加「…」，避免品名壓到數字欄。 */
function clip(s, fontSize, maxPx) {
    const t = String(s || "");
    if (estWidth(t, fontSize) <= maxPx) return t;
    let out = "";
    for (const ch of t) {
        if (estWidth(out + ch, fontSize) > maxPx - fontSize * 0.8) break;
        out += ch;
    }
    return out + "…";
}

/** 數量顯示：整數不帶小數點，小數最多兩位；null → 「—」 */
function n2(v) {
    if (v == null || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return String(Math.round(n * 100) / 100);
}
function signed(v) {
    if (v == null || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    const s = Math.round(n * 100) / 100;
    return (s > 0 ? "+" : "") + String(s);
}

const WD = ["日", "一", "二", "三", "四", "五", "六"];
function dateLabel(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ""));
    if (!m) return String(d || "");
    const dt = new Date(`${d}T12:00:00+08:00`);
    const w = Number.isNaN(dt.getTime()) ? "" : `（${WD[dt.getDay()]}）`;
    return `${m[1]}/${m[2]}/${m[3]}${w}`;
}

/**
 * @param {object} p
 *   companyName 公司名（松富物流／松揚…）、whCode 倉號、whName 倉名、date YYYY-MM-DD、
 *   countedBy 盤點人、submittedAt 送出時間字串、futOn 是否顯示未來銷貨欄、hotRuleText 紅標規則說明、
 *   items[] { name, spec, unit, code, sys, fut, should, counted, mid, diff, hot, expiry[] }
 * @returns {string[]} 每頁一個 SVG 字串
 */
function buildStocktakeReportSvgs(p) {
    const items = Array.isArray(p.items) ? p.items : [];
    const futOn = !!p.futOn;
    // 未盤（counted == null）也要列出來——群組看到的是「這倉今天盤了什麼」，漏盤要看得見
    const total = items.length;
    const done = items.filter((it) => it.counted != null).length;
    const diffN = items.filter((it) => it.diff != null && it.diff !== 0).length;
    const hotN = items.filter((it) => it.hot).length;

    // 欄位右邊界（品名區 = PAD .. nameRight）
    const xDiff = W - PAD;
    const xCounted = xDiff - 130;
    const xShould = xCounted - 130;
    const xFut = futOn ? xShould - 110 : null;
    const xSys = (futOn ? xFut : xShould) - 110;
    const nameRight = xSys - 130;
    const nameMax = nameRight - PAD;

    const pages = [];
    const pageCount = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));

    for (let pi = 0; pi < pageCount; pi++) {
        const slice = items.slice(pi * ROWS_PER_PAGE, (pi + 1) * ROWS_PER_PAGE);
        const headH = pi === 0 ? 300 : 150;   // 第 2 頁起省略 KPI 卡，只留標題列
        const tableTop = headH + 10;
        const H = tableTop + 56 + slice.length * ROW_H + 96;

        let head = "";
        if (pi === 0) {
            head += `
<text x="${PAD}" y="66" font-size="20" fill="${C.accent}" font-weight="600">松富物流 · 每日盤點</text>
<text x="${PAD}" y="132" font-size="54" font-weight="800" fill="${C.t1}">盤點結果表</text>
<text x="${PAD}" y="178" font-size="26" fill="${C.t2}">${escapeXml(dateLabel(p.date))} ｜ ${escapeXml(p.companyName || "")} ｜ ${escapeXml((p.whCode || "") + " " + (p.whName || ""))}</text>
<text x="${W - PAD}" y="66" text-anchor="end" font-size="18" fill="${C.t3}">盤點人 ${escapeXml(p.countedBy || "—")}</text>
<text x="${W - PAD}" y="94" text-anchor="end" font-size="18" fill="${C.t3}">送出 ${escapeXml(p.submittedAt || "")}</text>`;
            // KPI 四格
            const kpis = [
                { label: "品項", value: String(total), color: C.t1 },
                { label: "已盤", value: `${done}/${total}`, color: done === total ? C.good : "#b26a00" },
                { label: "有盤差", value: String(diffN), color: diffN ? C.bad : C.good },
                { label: "紅標", value: String(hotN), color: hotN ? C.bad : C.good },
            ];
            const cw = (W - PAD * 2 - 24) / 4;
            kpis.forEach((k, i) => {
                const x = PAD + i * (cw + 8);
                head += `
<rect x="${x}" y="200" width="${cw}" height="82" rx="8" fill="${C.panel}" stroke="${C.line}"/>
<text x="${x + 16}" y="228" font-size="17" fill="${C.t3}">${escapeXml(k.label)}</text>
<text x="${x + cw - 16}" y="264" text-anchor="end" font-size="34" font-weight="800" fill="${k.color}">${escapeXml(k.value)}</text>`;
            });
        } else {
            head += `
<text x="${PAD}" y="70" font-size="34" font-weight="800" fill="${C.t1}">盤點結果表（續）</text>
<text x="${PAD}" y="112" font-size="21" fill="${C.t2}">${escapeXml(dateLabel(p.date))} ｜ ${escapeXml((p.whCode || "") + " " + (p.whName || ""))}</text>`;
        }

        // 表頭
        let rows = `
<line x1="${PAD}" y1="${tableTop}" x2="${W - PAD}" y2="${tableTop}" stroke="${C.line2}" stroke-width="2"/>
<text x="${PAD}" y="${tableTop + 36}" font-size="19" font-weight="700" fill="${C.t2}">品項</text>
<text x="${xSys}" y="${tableTop + 36}" text-anchor="end" font-size="19" font-weight="700" fill="${C.t2}">系統</text>
${futOn ? `<text x="${xFut}" y="${tableTop + 36}" text-anchor="end" font-size="19" font-weight="700" fill="${C.info}">未來</text>` : ""}
<text x="${xShould}" y="${tableTop + 36}" text-anchor="end" font-size="19" font-weight="700" fill="${C.t2}">應有</text>
<text x="${xCounted}" y="${tableTop + 36}" text-anchor="end" font-size="19" font-weight="700" fill="${C.t1}">實盤</text>
<text x="${xDiff}" y="${tableTop + 36}" text-anchor="end" font-size="19" font-weight="700" fill="${C.t1}">盤差</text>
<line x1="${PAD}" y1="${tableTop + 54}" x2="${W - PAD}" y2="${tableTop + 54}" stroke="${C.line}"/>`;

        slice.forEach((it, i) => {
            const y = tableTop + 54 + i * ROW_H;
            const midY = y + 33;
            if (it.hot) {
                rows += `<rect x="${PAD - 10}" y="${y + 1}" width="${W - PAD * 2 + 20}" height="${ROW_H - 2}" fill="${C.hotBg}"/>`;
            }
            // 品名（第一行）＋ 規格/單位/料號、含中、效期（第二行小字）
            const name = clip(it.name || it.code || "", 22, nameMax);
            const sub = [];
            if (it.spec) sub.push(String(it.spec));
            if (it.code) sub.push(String(it.code));
            if (it.mid) sub.push(`含中 ${n2(it.mid)}`);
            if (Array.isArray(it.expiry) && it.expiry.length) sub.push(`效期 ${it.expiry.length} 筆`);
            rows += `<text x="${PAD}" y="${y + 26}" font-size="22" font-weight="${it.hot ? 700 : 500}" fill="${C.t1}">${escapeXml(name)}</text>`;
            if (sub.length) {
                rows += `<text x="${PAD}" y="${y + 45}" font-size="15" fill="${C.t3}">${escapeXml(clip(sub.join(" · "), 15, nameMax))}</text>`;
            }
            const dColor = it.diff == null ? C.t3 : (it.diff === 0 ? C.t3 : (it.diff > 0 ? C.good : C.bad));
            rows += `
<text x="${xSys}" y="${midY}" text-anchor="end" font-size="22" fill="${C.t2}">${escapeXml(n2(it.sys))}</text>
${futOn ? `<text x="${xFut}" y="${midY}" text-anchor="end" font-size="22" fill="${it.fut ? C.info : C.t3}">${escapeXml(it.fut ? signed(it.fut) : "—")}</text>` : ""}
<text x="${xShould}" y="${midY}" text-anchor="end" font-size="22" fill="${C.t2}">${escapeXml(n2(it.should))}</text>
<text x="${xCounted}" y="${midY}" text-anchor="end" font-size="24" font-weight="700" fill="${it.counted == null ? C.t3 : C.t1}">${escapeXml(it.counted == null ? "未盤" : n2(it.counted))}</text>
<text x="${xDiff}" y="${midY}" text-anchor="end" font-size="24" font-weight="${it.diff ? 700 : 400}" fill="${dColor}">${escapeXml(it.diff == null ? "—" : (it.diff === 0 ? "0" : signed(it.diff)))}</text>
<line x1="${PAD}" y1="${y + ROW_H}" x2="${W - PAD}" y2="${y + ROW_H}" stroke="${C.line}"/>`;
        });

        const footY = H - 44;
        const foot = `
<line x1="${PAD}" y1="${H - 76}" x2="${W - PAD}" y2="${H - 76}" stroke="${C.line}"/>
<text x="${PAD}" y="${footY}" font-size="16" fill="${C.t3}">應有＝系統${futOn ? "＋未來銷貨" : ""}　盤差＝實盤−應有　${escapeXml(p.hotRuleText ? "紅標：" + p.hotRuleText : "")}</text>
<text x="${W - PAD}" y="${footY}" text-anchor="end" font-size="16" fill="${C.t3}">${pageCount > 1 ? `第 ${pi + 1}/${pageCount} 頁 · ` : ""}松富物流 LINE 盤點系統</text>`;

        pages.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect x="0" y="0" width="8" height="${H}" fill="${C.accent}"/>
${head}
${rows}
${foot}
</svg>`);
    }
    return pages;
}

/** 回傳 JPEG Buffer 陣列（品項多時分頁）。 */
async function renderStocktakeReportJpegs(p) {
    const svgs = buildStocktakeReportSvgs(p);
    const out = [];
    for (const svg of svgs) {
        out.push(await sharp(Buffer.from(svg, "utf-8")).jpeg({ quality: 88, chromaSubsampling: "4:4:4" }).toBuffer());
    }
    return out;
}
