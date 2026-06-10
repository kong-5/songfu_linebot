"use strict";
/**
 * 公告 PNG 渲染：把模板資料組成 SVG，再用 sharp 轉成 1080x1080 PNG。
 * 適合節日 / 重要公告，下載後可貼海報、IG、群組。HTML 預覽走另一路徑（announcement-templates.js）。
 *
 * 設計取捨：避免 headless browser（puppeteer 太重），改用 SVG。代價是版面控制較簡，
 * 但對「文字 + 週曆 + 標題」這種結構足夠，且封面尺寸固定 1080x1080 不會破版。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderAnnouncementPng = renderAnnouncementPng;

const sharp = require("sharp");

const W = 1080, H = 1080;

function escapeXml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** SVG <text> 不會自動斷行；簡單按字元數切，每段一個 <tspan> 換行。 */
function wrapText(text, charsPerLine) {
    const out = [];
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return out;
    let i = 0;
    while (i < t.length) {
        out.push(t.slice(i, i + charsPerLine));
        i += charsPerLine;
    }
    return out;
}

function renderHolidayRedSvg(data) {
    const off = String(data.off_dates || "").split(",").map(s => s.trim()).filter(Boolean);
    const on = String(data.work_dates || "").split(",").map(s => s.trim()).filter(Boolean);
    const lines = String(data.lines || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const labels = ["一", "二", "三", "四", "五", "六", "日"];

    // 週曆 cells
    let cells = "";
    if (data.week_start) {
        const start = new Date(data.week_start + "T12:00:00");
        if (!Number.isNaN(start.getTime())) {
            const cellW = 130, cellH = 90, startX = 60, startY = 320;
            for (let i = 0; i < 7; i++) {
                const d = new Date(start.getTime() + i * 86400000);
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                const isOff = off.includes(iso);
                const isOn = on.includes(iso);
                const x = startX + i * cellW;
                const fillBg = isOff ? "#ffffff" : (isOn ? "#fff8e1" : "#ffffff");
                const stroke = isOff ? "#c0392b" : (isOn ? "#b45309" : "#444444");
                const dayLabel = (i === 0 ? `${d.getMonth() + 1}/` : "") + d.getDate();
                cells += `
<rect x="${x}" y="${startY}" width="${cellW - 6}" height="${cellH}" rx="6" fill="${fillBg}" stroke="${stroke}" stroke-width="2"/>
<text x="${x + (cellW - 6) / 2}" y="${startY + 30}" text-anchor="middle" font-size="22" font-weight="700" fill="#222">${escapeXml(labels[i])}</text>
<text x="${x + (cellW - 6) / 2}" y="${startY + 62}" text-anchor="middle" font-size="28" font-weight="700" fill="${isOff ? "#c0392b" : (isOn ? "#b45309" : "#222")}">${escapeXml(String(dayLabel))}</text>
${isOff ? `<text x="${x + (cellW - 6) / 2}" y="${startY + 84}" text-anchor="middle" font-size="14" fill="#c0392b">公休</text>` : ""}
${isOn ? `<text x="${x + (cellW - 6) / 2}" y="${startY + 84}" text-anchor="middle" font-size="14" fill="#b45309">上班</text>` : ""}
`;
            }
        }
    }

    // 內文
    let bodyTexts = "";
    let bodyY = 510;
    const bodyMaxChars = 22;
    lines.forEach((l, idx) => {
        const wrapped = wrapText(`${idx + 1}、${l}`, bodyMaxChars);
        wrapped.forEach((w, i) => {
            bodyTexts += `<text x="80" y="${bodyY}" font-size="30" fill="#fff8e1" font-weight="${i === 0 ? 600 : 400}">${escapeXml(w)}</text>`;
            bodyY += 44;
        });
        bodyY += 16;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#a82323"/>
    <stop offset="100%" stop-color="#7a1717"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
<text x="${W / 2}" y="160" text-anchor="middle" font-size="72" font-weight="800" fill="#fff" font-family="'Noto Serif TC','PingFang TC','Microsoft JhengHei',serif">${escapeXml(data.title || "公告")}</text>
<text x="${W / 2}" y="220" text-anchor="middle" font-size="22" fill="#ffe5d4">— 松富物流 敬上 —</text>
${cells}
${bodyTexts}
${data.footer ? `<text x="${W / 2}" y="${H - 110}" text-anchor="middle" font-size="36" font-weight="700" fill="#fff" font-family="'Noto Serif TC',serif">${escapeXml(data.footer)}</text>` : ""}
<text x="${W / 2}" y="${H - 50}" text-anchor="middle" font-size="20" fill="#ffd6c4">松富物流 SongFu Logistics</text>
</svg>`;
}

function renderPromoYellowSvg(data) {
    const items = (Array.isArray(data.items) ? data.items : [])
        .map(it => ({ name: String(it?.name || "").trim(), price: String(it?.price || "").trim(), unit: String(it?.unit || "").trim() || "斤", market: String(it?.market || "").trim() }))
        .filter(it => it.name);

    let itemRows = "";
    let y = 460;
    items.forEach((it) => {
        itemRows += `
<rect x="60" y="${y}" width="${W - 120}" height="92" rx="10" fill="#ffffff" stroke="#f5b800" stroke-width="2"/>
<text x="84" y="${y + 38}" font-size="32" font-weight="700" fill="#3d2c00">${escapeXml(it.name)}</text>
<text x="84" y="${y + 76}" font-size="20" fill="#9a7b3a">${it.market ? `行情 ${escapeXml(it.market)}` : ""}</text>
<text x="${W - 84}" y="${y + 50}" text-anchor="end" font-size="40" font-weight="800" fill="#a8540a">${escapeXml(it.price || "—")}</text>
<text x="${W - 84}" y="${y + 80}" text-anchor="end" font-size="20" fill="#9a7b3a">/${escapeXml(it.unit)}</text>
`;
        y += 110;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fffaeb"/>
<rect x="0" y="0" width="${W}" height="320" fill="#f5b800"/>
<text x="${W / 2}" y="140" text-anchor="middle" font-size="72" font-weight="800" fill="#3d2c00">⚡ ${escapeXml(data.title || "限時優惠")}</text>
${data.subtitle ? `<text x="${W / 2}" y="195" text-anchor="middle" font-size="28" fill="#5c4400">${escapeXml(data.subtitle)}</text>` : ""}
${data.promo_date ? `<text x="${W / 2}" y="260" text-anchor="middle" font-size="36" font-weight="700" fill="#3d2c00">📅 ${escapeXml(data.promo_date)}</text>` : ""}
${itemRows}
${data.note ? `<text x="${W / 2}" y="${H - 60}" text-anchor="middle" font-size="22" fill="#5c4400">📌 ${escapeXml(data.note)}</text>` : ""}
</svg>`;
}

function renderNoticeDarkSvg(data) {
    const lines = String(data.content || "").split(/\r?\n/).map(s => s.trim());
    let body = "";
    let y = 380;
    for (const l of lines) {
        if (!l) { y += 30; continue; }
        const wrapped = wrapText(l, 24);
        for (const w of wrapped) {
            body += `<text x="80" y="${y}" font-size="32" fill="#37352f">${escapeXml(w)}</text>`;
            y += 50;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#fafafa"/>
<rect x="0" y="0" width="${W}" height="280" fill="#2c3e50"/>
<text x="60" y="120" font-size="28" fill="#90b8d8">📢 通知</text>
<text x="60" y="200" font-size="60" font-weight="800" fill="#ffffff">${escapeXml(data.title || "通知")}</text>
${body}
<text x="${W / 2}" y="${H - 60}" text-anchor="middle" font-size="22" fill="#787774">— 松富物流 敬上 —</text>
</svg>`;
}

function renderNewArrivalGreenSvg(data) {
    const highlights = String(data.highlights || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    let hl = "";
    let y = 520;
    for (const h of highlights) {
        const wrapped = wrapText(`◆ ${h}`, 22);
        for (const w of wrapped) {
            hl += `<text x="80" y="${y}" font-size="34" fill="#37352f">${escapeXml(w)}</text>`;
            y += 56;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#f4faf6"/>
<rect x="0" y="0" width="${W}" height="380" fill="#1e7a5e"/>
<text x="60" y="100" font-size="26" fill="#cdebd9">🌿 NEW · 新品上架</text>
<text x="60" y="190" font-size="64" font-weight="800" fill="#ffffff">${escapeXml(data.title || "新品上架")}</text>
${data.tagline ? `<text x="60" y="260" font-size="32" fill="#cdebd9">${escapeXml(data.tagline)}</text>` : ""}
${data.price_label ? `<text x="60" y="340" font-size="44" font-weight="700" fill="#ffd966">${escapeXml(data.price_label)}</text>` : ""}
${hl}
${data.cta ? `<text x="${W / 2}" y="${H - 100}" text-anchor="middle" font-size="32" font-weight="700" fill="#1e7a5e">${escapeXml(data.cta)}</text>` : ""}
<text x="${W / 2}" y="${H - 50}" text-anchor="middle" font-size="22" fill="#7a9a8a">— 松富物流 —</text>
</svg>`;
}

const RENDERERS = {
    holiday_red: renderHolidayRedSvg,
    promo_yellow: renderPromoYellowSvg,
    notice_dark: renderNoticeDarkSvg,
    new_arrival_green: renderNewArrivalGreenSvg,
};

/** 回傳 PNG Buffer。templateId 不在 RENDERERS 中時回 null。 */
async function renderAnnouncementPng(templateId, data) {
    const renderer = RENDERERS[templateId];
    if (!renderer) return null;
    const svg = renderer(data || {});
    const buf = await sharp(Buffer.from(svg, "utf-8")).png({ compressionLevel: 9 }).toBuffer();
    return buf;
}
