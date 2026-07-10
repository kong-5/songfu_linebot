"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anchorQuantitiesToRows = anchorQuantitiesToRows;
exports.validateParsedAgainstRowAnchors = validateParsedAgainstRowAnchors;
/**
 * 預印訂購表「OCR 字框幾何對行」校驗（純函式、無 I/O）。
 *
 * 背景：客戶預印表＝品項印刷、數量手寫（龍港表為 3 組「品項|數量」欄並排）。
 * 視覺模型偶爾把手寫數量掛錯列——手寫字大、筆畫往上溢出格線，被判給上一列空白品項
 * （實例：「3盒」寫在洋菇列卻被判給上一列的秀珍菇）。另有客戶刻意跨兩列寫一個
 * 大數字表示「兩列各此數量」。這裡用 Google Vision OCR 的字框座標做確定性校驗：
 *
 *  1. 以模板 knownItems 的「印刷品名」字框當列錨點（row anchor）：
 *     先整詞精確比對，再嘗試同一水平帶內相鄰 words 串接比對（品名被 OCR 拆成多個 word）。
 *  2. 品名框依 x 起點聚類成「欄」（間距門檻＝圖寬 15%）；每欄的數量區＝
 *     該欄品名框右緣 → 下一欄品名框左緣（最後一欄 → 圖右緣）。
 *  3. 每欄的列帶（row band）：以品名框 y 中心為列心，相鄰列心中點為帶界（涵蓋整列高度）。
 *  4. 找手寫數量 token（數字＋可帶單位；「純單位」word 緊鄰數字 word 會併回同一 token），
 *     計算其 y 範圍對同欄各列帶的覆蓋比例，三態指派：
 *       - clear     ：最大覆蓋列佔比 ≥ 0.7 → 指派該列
 *       - spanning  ：前兩名覆蓋接近（比值 < 1.5）且兩列除此 token 外無其他數量 token
 *       - ambiguous ：其他（候選＝前兩名）
 *  5. validateParsedAgainstRowAnchors 拿視覺模型的 parsed 對照幾何，保守修正（絕不減項）：
 *       - 掛錯列（該列無墨跡、相鄰列有 clear token 且數值吻合、相鄰列不在 parsed）→ 改名
 *       - spanning / ambiguous 波及 → 不改名，只壓信心＋remark 加註
 *       - 品名對不到列帶（其他品項手寫欄等）→ 完全不動
 *       - 錨點 < 5 或無 words → 整體 no-op（照片歪斜／OCR 失敗時寧可不校驗）
 */
const MIN_ANCHORS = 5; // 命中品名錨點少於此數 → 不校驗（版面資訊不足）
const CLEAR_COVER_RATIO = 0.7; // 單列覆蓋佔比 ≥ 此值 → clear
const SPAN_TOP2_RATIO = 1.5; // 前兩名覆蓋比值 < 此值 → 視為「接近」
const COLUMN_GAP_RATIO = 0.15; // 品名框 x 起點聚類門檻＝圖寬 15%
const NAME_CONCAT_MAX_PARTS = 8; // 串接品名最多吃幾個 word（防失控）
// 數量 token 可帶的單位字尾（正規化＝半形＋小寫後比對）
const UNIT_RE_SRC = "kg|公斤|斤|包|盒|把|箱|袋|顆|支|粒|條|瓶|克|g|k";
const QTY_TOKEN_RE = new RegExp("^([0-9]+(?:\\.[0-9]+)?|[一二三四五六七八九十]+)(" + UNIT_RE_SRC + ")?$");
const PURE_UNIT_RE = new RegExp("^(" + UNIT_RE_SRC + ")$");
/** 全形轉半形（含全形空白）。 */
function toHalfWidth(s) {
    return String(s || "")
        .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/　/g, " ");
}
/** 品名／token 正規化：去空白、全形轉半形、小寫。 */
function normalizeName(s) {
    return toHalfWidth(s).replace(/\s+/g, "").toLowerCase();
}
/** 中文數字（一～十，含 十二、二十、二十五 這類基本組合）→ 數值；非法回 null。 */
function parseQuantityValue(numStr) {
    const s = String(numStr || "");
    if (!s)
        return null;
    if (/^[0-9]/.test(s)) {
        const v = Number(s);
        return Number.isFinite(v) ? v : null;
    }
    if (!/^[一二三四五六七八九十]+$/.test(s))
        return null;
    const CN = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
    const i = s.indexOf("十");
    if (i < 0)
        return s.length === 1 ? (CN[s] ?? null) : null;
    if (i > 1)
        return null;
    const tens = i === 0 ? 1 : CN[s[i - 1]];
    const onesCh = s.slice(i + 1);
    if (onesCh.length > 1)
        return null;
    const ones = onesCh === "" ? 0 : CN[onesCh];
    if (tens == null || ones == null)
        return null;
    return tens * 10 + ones;
}
/** 一維區間重疊長度。 */
function overlapLen(a1, a2, b1, b2) {
    return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}
function median(arr) {
    const a = arr.slice().sort((x, y) => x - y);
    if (!a.length)
        return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function rowKeyOf(row) {
    return row.columnIndex + ":" + row.rowIndex;
}
/** 由一組 word 框建立品名錨點（聯集外框）。 */
function mkAnchor(name, norm, wordList) {
    const x1 = Math.min(...wordList.map((w) => w.x));
    const y1 = Math.min(...wordList.map((w) => w.y));
    const x2 = Math.max(...wordList.map((w) => w.x + w.w));
    const y2 = Math.max(...wordList.map((w) => w.y + w.h));
    return { name, norm, x: x1, y: y1, w: x2 - x1, h: y2 - y1, xCenter: (x1 + x2) / 2, yCenter: (y1 + y2) / 2 };
}
/** 單位正規化到同義群（kg/K/公斤 同群、g/克 同群），供「數值吻合」時順帶比對單位。 */
function canonicalUnit(u) {
    const n = normalizeName(u);
    if (!n)
        return "";
    if (n === "kg" || n === "k" || n === "公斤")
        return "公斤";
    if (n === "g" || n === "克")
        return "克";
    return n;
}
/** 兩單位是否相容（任一方沒單位 → 不擋）。 */
function unitsCompatible(a, b) {
    const ca = canonicalUnit(a), cb = canonicalUnit(b);
    if (!ca || !cb)
        return true;
    return ca === cb;
}
/**
 * 核心純函式：由 OCR 字框＋模板 knownItems 建列帶、找數量 token、三態指派。
 * @param {{words:Array<{text:string,x:number,y:number,w:number,h:number}>, knownItems:string[]}} args
 * @returns {{ok:boolean, reason?:string, imgWidth?:number, anchors:Array, columns:Array, tokens:Array}}
 *   columns[i].rows[j] = { columnIndex, rowIndex, name, norm, bandTop, bandBottom, anchor }
 *   tokens[k] = { text, value, unit, x,y,w,h, columnIndex, state:'clear'|'spanning'|'ambiguous'|'none',
 *                 row（clear 時的指派列）, candidates:[{row,ratio}...], coverages }
 */
function anchorQuantitiesToRows({ words, knownItems } = {}) {
    const ws = (Array.isArray(words) ? words : []).filter((w) => w && typeof w.text === "string" && w.text !== ""
        && Number.isFinite(w.x) && Number.isFinite(w.y)
        && Number.isFinite(w.w) && Number.isFinite(w.h) && w.w > 0 && w.h > 0);
    const items = (Array.isArray(knownItems) ? knownItems : []).filter(Boolean);
    if (!ws.length)
        return { ok: false, reason: "no_words", anchors: [], columns: [], tokens: [] };
    if (!items.length)
        return { ok: false, reason: "no_known_items", anchors: [], columns: [], tokens: [] };
    const normToName = new Map();
    let maxNormLen = 0;
    for (const it of items) {
        const n = normalizeName(it);
        if (!n)
            continue;
        if (!normToName.has(n))
            normToName.set(n, String(it));
        if (n.length > maxNormLen)
            maxNormLen = n.length;
    }
    const imgWidth = Math.max(...ws.map((w) => w.x + w.w));
    // === 1) 品名錨點 ===
    const used = new Set(); // 已被認成品名的 word index（之後不當數量 token）
    const anchors = [];
    // pass 1：整詞精確比對
    for (let i = 0; i < ws.length; i++) {
        const n = normalizeName(ws[i].text);
        if (n && normToName.has(n)) {
            anchors.push(mkAnchor(normToName.get(n), n, [ws[i]]));
            used.add(i);
        }
    }
    // pass 2：品名被 OCR 拆成多個相鄰 word（例：「帶殼玉米筍」→「帶殼」＋「玉米筍」）。
    // 同一水平帶（y 中心差 < 字高一半）內、往右依 x 串接後比對。
    const startOrder = ws.map((_, i) => i)
        .filter((i) => !used.has(i))
        .sort((a, b) => (ws[a].y - ws[b].y) || (ws[a].x - ws[b].x));
    for (const i of startOrder) {
        if (used.has(i))
            continue;
        const base = ws[i];
        const baseYc = base.y + base.h / 2;
        let acc = normalizeName(base.text);
        if (!acc || acc.length >= maxNormLen)
            continue; // 單詞命中已在 pass1 處理；過長不可能是品名開頭
        const bandIdx = ws.map((_, j) => j)
            .filter((j) => j !== i && !used.has(j) && ws[j].x >= base.x
            && Math.abs((ws[j].y + ws[j].h / 2) - baseYc) < base.h / 2)
            .sort((a, b) => ws[a].x - ws[b].x);
        const parts = [i];
        let prevRight = base.x + base.w;
        let matched = null;
        for (const j of bandIdx) {
            const wj = ws[j];
            const gap = wj.x - prevRight;
            if (gap > 1.5 * Math.max(base.h, wj.h))
                break; // 相鄰性：間隔太大＝已跨到別欄
            if (gap < -Math.max(base.h, wj.h))
                continue; // 大幅回頭重疊的框，略過
            acc += normalizeName(wj.text);
            parts.push(j);
            prevRight = Math.max(prevRight, wj.x + wj.w);
            if (parts.length > NAME_CONCAT_MAX_PARTS || acc.length > maxNormLen)
                break;
            if (normToName.has(acc)) {
                matched = acc;
                break;
            }
        }
        if (matched && parts.length > 1) {
            anchors.push(mkAnchor(normToName.get(matched), matched, parts.map((j) => ws[j])));
            for (const j of parts)
                used.add(j);
        }
    }
    if (anchors.length < MIN_ANCHORS)
        return { ok: false, reason: "few_anchors(" + anchors.length + ")", anchors, columns: [], tokens: [] };
    // === 2) 品名框 x 起點聚類成「欄」 ===
    const sortedByX = anchors.slice().sort((a, b) => a.x - b.x);
    const gapThreshold = imgWidth * COLUMN_GAP_RATIO;
    const clusters = [];
    for (const a of sortedByX) {
        const cur = clusters[clusters.length - 1];
        if (cur && (a.x - cur.baseX) <= gapThreshold)
            cur.anchors.push(a);
        else
            clusters.push({ baseX: a.x, anchors: [a] });
    }
    // === 3) 每欄建列帶（相鄰列心中點為帶界，首尾列各外擴半個列距） ===
    const columns = clusters.map((c, idx) => {
        const rowAnchors = c.anchors.slice().sort((a, b) => a.yCenter - b.yCenter);
        const diffs = [];
        for (let k = 1; k < rowAnchors.length; k++)
            diffs.push(rowAnchors[k].yCenter - rowAnchors[k - 1].yCenter);
        const pitch = diffs.length ? median(diffs) : rowAnchors[0].h * 2; // 單列 fallback：2 倍字高
        const rows = rowAnchors.map((a, k) => ({
            columnIndex: idx,
            rowIndex: k,
            name: a.name,
            norm: a.norm,
            bandTop: k === 0 ? a.yCenter - pitch / 2 : (rowAnchors[k - 1].yCenter + a.yCenter) / 2,
            bandBottom: k === rowAnchors.length - 1 ? a.yCenter + pitch / 2 : (a.yCenter + rowAnchors[k + 1].yCenter) / 2,
            anchor: a,
        }));
        const nameLeft = Math.min(...c.anchors.map((a) => a.x));
        const nameRight = Math.max(...c.anchors.map((a) => a.x + a.w));
        return { index: idx, nameLeft, nameRight, rows, zoneLeft: nameRight, zoneRight: imgWidth };
    });
    for (let k = 0; k < columns.length - 1; k++)
        columns[k].zoneRight = columns[k + 1].nameLeft; // 數量區＝品名右緣 → 下一欄品名左緣
    // === 4) 手寫數量 token ===
    const tokens = [];
    const pureUnits = [];
    for (let i = 0; i < ws.length; i++) {
        if (used.has(i))
            continue; // 已被認成品名的 word 不算數量
        const t = normalizeName(ws[i].text);
        if (!t)
            continue;
        if (PURE_UNIT_RE.test(t)) {
            pureUnits.push(ws[i]);
            continue;
        }
        const m = t.match(QTY_TOKEN_RE);
        if (!m)
            continue;
        tokens.push({
            text: ws[i].text,
            value: parseQuantityValue(m[1]),
            unit: m[2] || null,
            x: ws[i].x, y: ws[i].y, w: ws[i].w, h: ws[i].h,
        });
    }
    // 「純單位」word 緊鄰數字 word（OCR 把「3 盒」拆兩框）→ 併回同一 token
    for (const u of pureUnits) {
        let best = null, bestGap = Infinity;
        for (const tk of tokens) {
            if (tk.unit)
                continue;
            if (overlapLen(tk.y, tk.y + tk.h, u.y, u.y + u.h) <= 0)
                continue;
            const gap = u.x - (tk.x + tk.w);
            if (gap < -Math.max(tk.h, u.h) * 0.5 || gap > Math.max(tk.h, u.h) * 2)
                continue;
            if (Math.abs(gap) < bestGap) {
                best = tk;
                bestGap = Math.abs(gap);
            }
        }
        if (best) {
            best.unit = normalizeName(u.text);
            const x2 = Math.max(best.x + best.w, u.x + u.w);
            const y2 = Math.max(best.y + best.h, u.y + u.h);
            best.text = best.text + u.text;
            best.x = Math.min(best.x, u.x);
            best.y = Math.min(best.y, u.y);
            best.w = x2 - best.x;
            best.h = y2 - best.y;
        }
    }
    // token 的 x 中心必須落在某欄的數量區內，否則不算（日期、電話等雜訊多在表頭/邊緣）
    for (const tk of tokens) {
        const xc = tk.x + tk.w / 2;
        tk.columnIndex = null;
        for (const col of columns) {
            if (xc >= col.zoneLeft && xc < col.zoneRight) {
                tk.columnIndex = col.index;
                break;
            }
        }
    }
    const inZone = tokens.filter((tk) => tk.columnIndex != null);
    // === 5) 覆蓋比例＋三態指派 ===
    for (const tk of inZone) {
        const col = columns[tk.columnIndex];
        const covs = [];
        for (const row of col.rows) {
            const ov = overlapLen(tk.y, tk.y + tk.h, row.bandTop, row.bandBottom);
            if (ov > 0)
                covs.push({ row, ratio: ov / tk.h });
        }
        covs.sort((a, b) => (b.ratio - a.ratio) || (a.row.rowIndex - b.row.rowIndex));
        tk.coverages = covs;
        tk.primaryRow = covs.length ? covs[0].row : null; // 供 spanning 的「無其他 token」判斷
    }
    for (const tk of inZone) {
        const covs = tk.coverages;
        if (!covs.length) {
            tk.state = "none"; // 落在數量區但不對上任何列帶（表頭日期等）→ 不參與判斷
            tk.row = null;
            tk.candidates = [];
            continue;
        }
        if (covs[0].ratio >= CLEAR_COVER_RATIO) {
            tk.state = "clear";
            tk.row = covs[0].row;
            tk.candidates = [covs[0]];
            continue;
        }
        const top2 = covs.slice(0, 2);
        if (top2.length === 2 && covs[0].ratio / covs[1].ratio < SPAN_TOP2_RATIO) {
            // 「刻意跨兩列」還需：兩列除此 token 外都沒有其他數量 token
            const rows2 = new Set(top2.map((c) => rowKeyOf(c.row)));
            const hasOther = inZone.some((o) => o !== tk && o.primaryRow && o.state !== "none" && rows2.has(rowKeyOf(o.primaryRow)));
            if (!hasOther) {
                tk.state = "spanning";
                tk.row = null;
                tk.candidates = top2;
                continue;
            }
        }
        tk.state = "ambiguous";
        tk.row = null;
        tk.candidates = top2;
    }
    return { ok: true, imgWidth, anchors, columns, tokens: inZone };
}
/**
 * 整合函式：拿視覺模型的 parsed 與幾何結果比對，回傳「修正後的 parsed 副本」＋修正記錄。
 * 保守原則（絕不減項）：
 *  - 掛錯列 → 改名為相鄰列品項（該列無墨跡、相鄰列有 clear token 且數值吻合、相鄰列不在 parsed 中）
 *  - spanning / ambiguous 波及 → 不改名，confidenceScore 壓 40、remark 前置加註 ⚠
 *  - 品名對不到列帶 → 完全不動
 *  - 錨點 < 5 或 words 為空 → 整體 no-op 回原 parsed
 * @returns {{ok:boolean, reason?:string, parsed:Array, corrections:Array<{type:'rename'|'flag', index:number, detail:string}>}}
 */
function validateParsedAgainstRowAnchors({ parsed, words, knownItems } = {}) {
    const base = Array.isArray(parsed) ? parsed : [];
    const geo = anchorQuantitiesToRows({ words, knownItems });
    if (!geo.ok)
        return { ok: false, reason: geo.reason, parsed: base, corrections: [] };
    // 索引：品名 norm → 列、每列被哪些 token 牽涉（clear 指派列＋spanning/ambiguous 候選列）
    const rowsByNorm = new Map();
    for (const col of geo.columns) {
        for (const row of col.rows) {
            if (!rowsByNorm.has(row.norm))
                rowsByNorm.set(row.norm, []);
            rowsByNorm.get(row.norm).push(row);
        }
    }
    const involvement = new Map(); // rowKey → tokens[]
    const addInv = (row, tk) => {
        const k = rowKeyOf(row);
        if (!involvement.has(k))
            involvement.set(k, []);
        involvement.get(k).push(tk);
    };
    for (const tk of geo.tokens) {
        if (tk.state === "clear")
            addInv(tk.row, tk);
        else if (tk.state === "spanning" || tk.state === "ambiguous")
            for (const c of tk.candidates)
                addInv(c.row, tk);
    }
    const parsedNorms = new Set(base.map((p) => normalizeName(p?.rawName)).filter(Boolean));
    const out = base.map((p) => ({ ...p }));
    const corrections = [];
    const claimedRows = new Set(); // 已被改名佔用的列（避免兩筆改到同一列）
    for (let idx = 0; idx < out.length; idx++) {
        const item = out[idx];
        const n = normalizeName(item?.rawName);
        if (!n)
            continue;
        const rows = rowsByNorm.get(n);
        if (!rows || !rows.length)
            continue; // 品名對不到列帶（非 knownItems、其他品項手寫欄）→ 完全不動
        // (a) 任一同名列被 spanning/ambiguous token 波及 → 只標記、不改名
        let flagged = false;
        for (const row of rows) {
            const tks = involvement.get(rowKeyOf(row)) || [];
            const spanTk = tks.find((t) => t.state === "spanning" || t.state === "ambiguous");
            if (!spanTk)
                continue;
            const names = spanTk.candidates.map((c) => c.row.name);
            const warn = "⚠ 字跡跨列（" + names.join("/") + "），請確認";
            const prevRemark = item.remark != null && String(item.remark).trim() !== "" ? String(item.remark).trim() : "";
            if (!prevRemark.includes("字跡跨列"))
                item.remark = prevRemark ? warn + "；" + prevRemark : warn;
            const cur = (item.confidenceScore != null && Number.isFinite(Number(item.confidenceScore))) ? Number(item.confidenceScore) : 100;
            item.confidenceScore = Math.min(cur, 40);
            corrections.push({
                type: "flag", index: idx, name: String(item.rawName), state: spanTk.state, candidates: names,
                detail: "「" + item.rawName + "」數量字跡跨列（" + names.join("/") + "，覆蓋 "
                    + spanTk.candidates.map((c) => Math.round(c.ratio * 100) + "%").join("/") + "）→ 信心壓 " + item.confidenceScore + "、remark 加註",
            });
            flagged = true;
            break;
        }
        if (flagged)
            continue;
        // (b) 掛錯列改名：該列完全無數量 token、相鄰列有 clear token 且數值吻合、且相鄰列品項不在 parsed 中
        for (const row of rows) {
            const tks = involvement.get(rowKeyOf(row)) || [];
            if (tks.length > 0)
                break; // 該列本身有 clear token → 幾何一致，不動
            const col = geo.columns[row.columnIndex];
            const neighbors = [col.rows[row.rowIndex - 1], col.rows[row.rowIndex + 1]].filter(Boolean);
            const q = Number(item?.quantity);
            const candidates = [];
            for (const nb of neighbors) {
                const key = rowKeyOf(nb);
                if (claimedRows.has(key))
                    continue;
                if (parsedNorms.has(nb.norm))
                    continue; // 相鄰列品項已在 parsed → 不是掛錯列
                const nbClear = (involvement.get(key) || []).filter((t) => t.state === "clear");
                const hit = nbClear.find((t) => t.value != null && Number.isFinite(q) && t.value === q && unitsCompatible(t.unit, item?.unit));
                if (hit)
                    candidates.push({ row: nb, token: hit });
            }
            if (candidates.length === 1) { // 上下都吻合時無法確定 → 保守不改
                const nb = candidates[0].row;
                const tk = candidates[0].token;
                const from = String(item.rawName);
                item.rawName = nb.name;
                claimedRows.add(rowKeyOf(nb));
                parsedNorms.add(nb.norm);
                corrections.push({
                    type: "rename", index: idx, from, to: nb.name,
                    detail: "「" + from + "」列無墨跡；手寫「" + tk.text + "」字框主體落在相鄰列「" + nb.name + "」（覆蓋 "
                        + Math.round(((tk.coverages && tk.coverages[0] && tk.coverages[0].ratio) || 0) * 100) + "%）→ 品名改為「" + nb.name + "」",
                });
            }
            break; // 同名多列（罕見）只看第一列，避免誤修
        }
    }
    return { ok: true, parsed: out, corrections, geometry: geo };
}
