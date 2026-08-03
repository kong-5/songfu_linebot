"use strict";
/**
 * 盤點結果報表圖（JPG）：盤點送出後產一張圖，人工存下來貼到 LINE 群組。
 *
 * 為什麼是圖不是推播：推播到群組是「按群組人數」計則數（8 人群組推一次＝8 則），
 * 每天每倉推一次很快就吃掉方案額度。改成「產圖 → 人自己傳」＝零則數。
 *
 * 為什麼是 SVG→sharp 不是 headless browser：比照 announcement-image.js / quote-report.js，
 * puppeteer 對這種固定版面太重。代價是要自己算座標與斷行（見 estWidth/clip/wrapInline）。
 *
 * **版面是條列不是表格**（2026-08-03 定案）：整倉逐列排表格，品項上百時圖會長到 3、4 張，
 * 在 LINE 上根本沒人捲得完。改成「要看的展開、不用看的收成一行字」：
 *   ⚠ 有盤差 → 逐項明細（紅標排最前，這是唯一真的要人看的東西）
 *   ⛔ 未盤　 → 只列品名（漏盤要看得見）
 *   ✓ 相符　 → 「品名 數量」串成段落自動折行（數字還在，但不佔一列）
 *   帳上 0　 → 收成一行字
 *   長期無貨 → 完全不列，只在頁尾記一筆數量（idle 由 stocktake-report.js 判定）
 *
 * 口徑：一律用「盤點當下」凍結值（sys/fut/should/counted/diff），與每日盤點頁左半邊、
 * 統計圖表同一套 —— 圖是「當下定案」的憑證，不能隔天回頭看數字就變了。
 * 紅標沿用 isHotDiff 的結果（呼叫端算好放進 item.hot）。
 *
 * 內容超長時自動分頁（LINE 圖片上限 4096px），回傳多張 JPEG。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderStocktakeReportJpegs = renderStocktakeReportJpegs;
exports.buildStocktakeReportSvgs = buildStocktakeReportSvgs;

const sharp = require("sharp");

const W = 1080;
const PAD = 40;
const MAX_PAGE_H = 3600;   // LINE 圖片上限 4096px，留餘裕
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
    for (const ch of String(s || "")) u += /[　-鿿＀-￯]/.test(ch) ? 1 : 0.55;
    return u * fontSize;
}

/** 超過 maxPx 就截斷加「…」 */
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

/** 把一串短詞用分隔符接成多行（每行不超過 maxPx）。相符/未盤/帳 0 這幾段都靠它壓成幾行字。 */
function wrapInline(parts, fontSize, maxPx, sep) {
    const s = sep == null ? "、" : sep;
    const lines = [];
    let cur = "";
    for (const raw of parts) {
        const w = String(raw || "").trim();
        if (!w) continue;
        const next = cur ? cur + s + w : w;
        if (cur && estWidth(next, fontSize) > maxPx) { lines.push(cur + s); cur = w; }
        else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
}

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
/** 盤差% 的分母同每日盤點頁：max(|基準|,1)，基準＝未來加回開時的應有量 */
function diffPct(it, futOn) {
    const base = Math.max(Math.abs(Number((futOn ? it.should : it.sys) || 0)), 1);
    return Math.round((Number(it.diff || 0) / base) * 1000) / 10;
}

const WD = ["日", "一", "二", "三", "四", "五", "六"];
function dateLabel(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ""));
    if (!m) return String(d || "");
    const dt = new Date(`${d}T12:00:00+08:00`);
    const w = Number.isNaN(dt.getTime()) ? "" : `（${WD[dt.getDay()]}）`;
    return `${m[1]}/${m[2]}/${m[3]}${w}`;
}

const CONTENT_W = W - PAD * 2;

/**
 * @param {object} p
 *   companyName／whCode／whName／date／countedBy／submittedAt／futOn／hotRuleText／
 *   items[] { name, spec, unit, code, sys, fut, should, counted, mid, diff, hot, idle, expiry[] }
 * @returns {string[]} 每頁一個 SVG 字串
 */
function buildStocktakeReportSvgs(p) {
    const all = Array.isArray(p.items) ? p.items : [];
    const futOn = !!p.futOn;

    // 長期無貨（帳 0、現場也 0、近期庫存都沒動過）整段不列——這種品項每倉都幾十個，
    // 列出來只會把圖拉長，真正要看的盤差反而被埋掉。頁尾記一筆數量，不默默吃掉。
    const items = all.filter((it) => !it.idle);
    const idleN = all.length - items.length;

    const total = all.length;
    const done = all.filter((it) => it.counted != null).length;
    const diffs = items.filter((it) => it.counted != null && it.diff != null && it.diff !== 0)
        .sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || Math.abs(diffPct(b, futOn)) - Math.abs(diffPct(a, futOn)));
    const uncounted = items.filter((it) => it.counted == null);
    const same = items.filter((it) => it.counted != null && it.diff === 0);
    const zeros = same.filter((it) => Number(it.should || 0) === 0 && Number(it.counted || 0) === 0);
    const matched = same.filter((it) => !(Number(it.should || 0) === 0 && Number(it.counted || 0) === 0));
    const hotN = diffs.filter((it) => it.hot).length;

    // ── 內容拆成一個個 block（{h, draw(y)}），再依高度分頁 ──
    const blocks = [];
    const sectionHead = (title, color, note) => ({
        h: 62,
        draw: (y) => `
<rect x="${PAD}" y="${y + 14}" width="${CONTENT_W}" height="2" fill="${C.line2}"/>
<text x="${PAD}" y="${y + 48}" font-size="24" font-weight="800" fill="${color}">${escapeXml(title)}</text>
${note ? `<text x="${W - PAD}" y="${y + 48}" text-anchor="end" font-size="17" fill="${C.t3}">${escapeXml(note)}</text>` : ""}`,
    });

    // 1) 有盤差：逐項明細（紅標在最前面、整塊淡紅底）
    if (diffs.length) {
        blocks.push(sectionHead("盤差", C.bad, `${diffs.length} 項${hotN ? `・紅標 ${hotN}` : ""}`));
        diffs.forEach((it) => {
            const pct = diffPct(it, futOn);
            const nameTxt = clip((it.name || it.code) + (it.spec ? `　${it.spec}` : ""), 25, CONTENT_W - 220);
            const sysTxt = (futOn && it.fut)
                ? `應有 ${n2(it.should)}（帳 ${n2(it.sys)} ${signed(it.fut)} 未來）`
                : `系統 ${n2(it.sys)}`;
            const midTxt = it.mid ? `（含中 ${n2(it.mid)}）` : "";
            const expTxt = (it.expiry && it.expiry.length) ? `・效期 ${it.expiry.length} 筆` : "";
            const dColor = it.diff > 0 ? C.good : C.bad;
            blocks.push({
                h: 86,
                draw: (y) => `
${it.hot ? `<rect x="${PAD - 10}" y="${y}" width="${CONTENT_W + 20}" height="80" rx="6" fill="${C.hotBg}"/>` : ""}
<text x="${PAD}" y="${y + 32}" font-size="25" font-weight="700" fill="${C.t1}">${escapeXml(nameTxt)}</text>
${it.hot ? `<text x="${W - PAD}" y="${y + 32}" text-anchor="end" font-size="16" font-weight="700" fill="${C.bad}">要查</text>` : ""}
<text x="${PAD}" y="${y + 66}" font-size="21" fill="${C.t2}">${escapeXml(`${sysTxt} → 實盤 ${n2(it.counted)}${midTxt}${expTxt}`)}</text>
<text x="${W - PAD}" y="${y + 68}" text-anchor="end" font-size="27" font-weight="800" fill="${dColor}">${escapeXml(`${signed(it.diff)}（${pct > 0 ? "+" : ""}${pct}%）`)}</text>`,
            });
        });
    }

    // 2) 未盤：漏盤一定要看得見，但只需要品名
    if (uncounted.length) {
        blocks.push(sectionHead("未盤", "#b26a00", `${uncounted.length} 項`));
        wrapInline(uncounted.map((it) => it.name || it.code), 22, CONTENT_W).forEach((ln) => {
            blocks.push({ h: 36, draw: (y) => `<text x="${PAD}" y="${y + 26}" font-size="22" fill="${C.t2}">${escapeXml(ln)}</text>` });
        });
    }

    // 3) 相符：數字還在（「品名 數量」），但串成段落不佔一列一項
    if (matched.length) {
        blocks.push(sectionHead("相符", C.good, `${matched.length} 項`));
        wrapInline(matched.map((it) => `${it.name || it.code} ${n2(it.counted)}`), 21, CONTENT_W).forEach((ln) => {
            blocks.push({ h: 34, draw: (y) => `<text x="${PAD}" y="${y + 25}" font-size="21" fill="${C.t2}">${escapeXml(ln)}</text>` });
        });
    }

    // 4) 帳上 0 且現場也 0：收成一行字（不是長期無貨，今天確實有人去看過）
    if (zeros.length) {
        const names = zeros.map((it) => it.name || it.code);
        const head = `帳上 0・現場也 0（${zeros.length} 項）：`;
        wrapInline(names, 19, CONTENT_W - estWidth(head, 19)).forEach((ln, i) => {
            blocks.push({ h: 30, draw: (y) => `<text x="${PAD}" y="${y + 22}" font-size="19" fill="${C.t3}">${escapeXml((i === 0 ? head : "　") + ln)}</text>` });
        });
    }

    // ── 依高度分頁 ──
    const HEAD1 = 300, HEADN = 150, FOOT = 84;
    const pages = [];
    let cur = [], curH = 0;
    const budget = () => MAX_PAGE_H - (pages.length === 0 ? HEAD1 : HEADN) - FOOT;
    for (const b of blocks) {
        if (curH + b.h > budget() && cur.length) { pages.push(cur); cur = []; curH = 0; }
        cur.push(b); curH += b.h;
    }
    pages.push(cur);   // 最後一頁（沒有任何 block 時也要出一張，圖上只有抬頭與統計）

    return pages.map((blks, pi) => {
        const headH = pi === 0 ? HEAD1 : HEADN;
        let y = headH;
        let body = "";
        for (const b of blks) { body += b.draw(y); y += b.h; }
        const H = Math.max(y + FOOT, headH + FOOT + 60);

        let head = "";
        if (pi === 0) {
            head = `
<text x="${PAD}" y="66" font-size="20" fill="${C.accent}" font-weight="600">松富物流 · 每日盤點</text>
<text x="${PAD}" y="132" font-size="54" font-weight="800" fill="${C.t1}">盤點結果</text>
<text x="${PAD}" y="178" font-size="26" fill="${C.t2}">${escapeXml(dateLabel(p.date))} ｜ ${escapeXml(p.companyName || "")} ｜ ${escapeXml((p.whCode || "") + " " + (p.whName || ""))}</text>
<text x="${W - PAD}" y="66" text-anchor="end" font-size="18" fill="${C.t3}">盤點人 ${escapeXml(p.countedBy || "—")}</text>
<text x="${W - PAD}" y="94" text-anchor="end" font-size="18" fill="${C.t3}">送出 ${escapeXml(p.submittedAt || "")}</text>`;
            const kpis = [
                { label: "品項", value: String(total), color: C.t1 },
                { label: "已盤", value: `${done}/${total}`, color: done === total ? C.good : "#b26a00" },
                { label: "有盤差", value: String(diffs.length), color: diffs.length ? C.bad : C.good },
                { label: "紅標", value: String(hotN), color: hotN ? C.bad : C.good },
            ];
            const cw = (CONTENT_W - 24) / 4;
            kpis.forEach((k, i) => {
                const x = PAD + i * (cw + 8);
                head += `
<rect x="${x}" y="200" width="${cw}" height="82" rx="8" fill="${C.panel}" stroke="${C.line}"/>
<text x="${x + 16}" y="228" font-size="17" fill="${C.t3}">${escapeXml(k.label)}</text>
<text x="${x + cw - 16}" y="264" text-anchor="end" font-size="34" font-weight="800" fill="${k.color}">${escapeXml(k.value)}</text>`;
            });
        }
        else {
            head = `
<text x="${PAD}" y="70" font-size="34" font-weight="800" fill="${C.t1}">盤點結果（續）</text>
<text x="${PAD}" y="112" font-size="21" fill="${C.t2}">${escapeXml(dateLabel(p.date))} ｜ ${escapeXml((p.whCode || "") + " " + (p.whName || ""))}</text>`;
        }

        const notes = [];
        notes.push(`盤差＝實盤−${futOn ? "應有（系統＋未來銷貨）" : "系統"}`);
        if (p.hotRuleText) notes.push(`紅標 ${p.hotRuleText}`);
        if (idleN) notes.push(`另有 ${idleN} 項長期無貨未列`);
        const foot = `
<line x1="${PAD}" y1="${H - 64}" x2="${W - PAD}" y2="${H - 64}" stroke="${C.line}"/>
<text x="${PAD}" y="${H - 32}" font-size="16" fill="${C.t3}">${escapeXml(notes.join("　"))}</text>
<text x="${W - PAD}" y="${H - 32}" text-anchor="end" font-size="16" fill="${C.t3}">${pages.length > 1 ? `第 ${pi + 1}/${pages.length} 頁 · ` : ""}松富物流 LINE 盤點系統</text>`;

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect x="0" y="0" width="8" height="${H}" fill="${C.accent}"/>
${head}
${body}
${foot}
</svg>`;
    });
}

/** 回傳 JPEG Buffer 陣列（內容長時分頁）。 */
async function renderStocktakeReportJpegs(p) {
    const svgs = buildStocktakeReportSvgs(p);
    const out = [];
    for (const svg of svgs) {
        out.push(await sharp(Buffer.from(svg, "utf-8")).jpeg({ quality: 88, chromaSubsampling: "4:4:4" }).toBuffer());
    }
    return out;
}
