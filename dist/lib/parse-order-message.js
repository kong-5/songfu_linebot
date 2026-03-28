"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOrderMessage = parseOrderMessage;
exports.splitItemNameRemarks = splitItemNameRemarks;
exports.mergeRemarks = mergeRemarks;
/**
 * 從叫貨訊息解析出品項與數量。
 * 規則範例：「大陸妹 5 斤」「大陸妹2k」「A菜2k，」「芹菜2小把」「菠菜1件」
 * 支援：品名 + 數字（半形或全形）+ 可選單位（斤、k、包、把、小把、箱、件等），單位後可帶標點
 * 亦支援：品名/數量單位（例：大黃瓜/6k、小貢丸/1包、地瓜粉/1包.）
 * OCR 常把 0 打成字母 O：數量欄內 O／Ｏ 視為 0（例：香魚2O盒 → 20 盒）
 * 口語「品名改30公斤」會先拆成「品名 30公斤」；行尾「×2」「x2」視為整行數量倍數（例：油菜5k ×2 → 10 公斤）
 * 品名尾端逗號會剝除（例：紅蘿蔔，3公斤）
 * 同一行以「，」「、」或「空白 . 空白」分隔多筆叫貨會先拆行再解析；「紅蘿蔔，3公斤」仍併成一段（小數如 0.5 不拆）
 * 同一行空白分隔多筆（例：薑絲3公斤 蒜仁1公斤）會依各「數量+單位」切段品名；數量可為中文（三、三十、十一）；注音ㄧ視同「一」
 * 同一行以「-」「－」或「.」「．」分隔亦可（例：蔥3k-高麗菜10k-、梅乾菜 1k . 姜 0.5k）
 * 「克」僅作輸入辨識，會換算為公斤（例：200克 → 0.2公斤）；不辨識「公克」字樣
 * 「半公斤」→ 0.5 公斤；「2公斤分2包」類分裝說明入備註；品名內「漂亮」、尾端「挑直的」入備註；「kg」視為公斤（與「k」區分）
 * 品名內括號註記（全形／半形（）、方頭【】、〔〕等）內文移入備註，品名僅留主要稱呼，利於對料號
 * 明顯閒聊行（例：麻煩都要漂亮喔、單獨「新北斗。」）略過不產生品項
 */
// 「公斤」須在「克」之前，避免「200公斤」被誤判為「200克」
const UNIT_PATTERN = /(公斤|克|斤|kg|k|小把|大把|包|把|束|桶|箱|顆|粒|盒|袋|帶|台|件|支|根|條|条|入|罐|瓶|組|份|塊|片|尾|顆)\s*[,，.。、]*\s*$/i;
// 單位出現在數字後、且後面可能還跟括號備註（例如：1.5K（攪碎2次））；「kg」須在「k」之前，避免 1kg 被拆成 1k+g
const UNIT_BEGIN_PATTERN = /^\s*(公斤|克|斤|kg|k|小把|大把|包|把|束|桶|箱|顆|粒|盒|袋|帶|台|件|支|根|條|条|入|罐|瓶|組|份|塊|片|尾|顆)\s*[,，.。、]*/i;
const NUMBER_PATTERN = /[\d.\uFF10-\uFF19]+/; // 半形 0-9. 與全形 ０-９
const NUMBER_PATTERN_G = /[\d.\uFF10-\uFF19]+/g; // matchAll / exec 用
const UNIT_TOKEN = "公斤|克|斤|kg|k|小把|大把|包|把|束|桶|箱|顆|粒|盒|袋|帶|台|件|支|根|條|条|入|罐|瓶|組|份|塊|片|尾|顆";
const QTY_ARABIC = "[\\d.\\uFF10-\\uFF19OoＯ]+";
const QTY_CN = "[一二三四五六七八九十百千]+";
// 以「數量 + 單位」成對抓取（同一行多組時每組品名獨立；數量可為中文或阿拉伯）
const QTY_UNIT_PAIR_G = new RegExp(`(${QTY_ARABIC}|${QTY_CN})\\s*(${UNIT_TOKEN})`, "gi");
/** 「k」視為公斤 */
function normalizeUnit(u) {
    if (!u || typeof u !== "string")
        return u;
    const t = u.trim().toLowerCase();
    if (t === "kg" || t === "k")
        return "公斤";
    if (u.trim() === "帶")
        return "袋";
    return u.trim();
}
/** 「克」換算為公斤（例：200克 → 數量 0.2、單位 公斤）；不支援「公克」字樣 */
function normalizeQtyAndUnit(quantity, unitRaw) {
    const u = String(unitRaw || "").trim();
    if (u === "克")
        return { quantity: quantity / 1000, unit: "公斤" };
    const unitNorm = normalizeUnit(u);
    return { quantity, unit: unitNorm || u };
}
/** 全形數字轉半形，供 parseFloat 正確解析 */
function normalizeNumStr(s) {
    return s.replace(/[\uFF10-\uFF19]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));
}
/** OCR：字母 O／全形 Ｏ 在數量裡當成 0（僅用於數量片段，不套在品名上） */
function normalizeOcrOInQtyToken(s) {
    return String(s || "").replace(/[OＯ]/g, "0");
}
/** 中文數量（1～99 常見）；注音 ㄧ (U+3127) 視同「一」 */
function parseChineseNumberToken(s) {
    let t = String(s || "").trim().replace(/\u3127/g, "一");
    if (!t)
        return NaN;
    const x = parseFloat(normalizeNumStr(normalizeOcrOInQtyToken(t)));
    if (!Number.isNaN(x) && x > 0)
        return x;
    const d = { "零": 0, "〇": 0, "○": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "兩": 2, "两": 2 };
    if (/^[一二三四五六七八九]$/.test(t))
        return d[t];
    if (t === "十")
        return 10;
    if (/^十[一二三四五六七八九]$/.test(t))
        return 10 + d[t[1]];
    if (/^[一二三四五六七八九]十$/.test(t))
        return d[t[0]] * 10;
    if (/^[一二三四五六七八九]十[一二三四五六七八九]$/.test(t))
        return d[t[0]] * 10 + d[t[2]];
    return NaN;
}
function parseQtyFromStr(numStr) {
    const n = parseFloat(normalizeNumStr(normalizeOcrOInQtyToken(numStr)));
    if (!Number.isNaN(n) && n > 0)
        return n;
    const c = parseChineseNumberToken(numStr);
    return Number.isNaN(c) ? NaN : c;
}
/** 行尾「×2」「x3」等：整筆數量倍數（例：油菜5k ×2 → 10 公斤） */
function trailingQtyMultiplier(line) {
    const m = String(line || "").match(/\s*[×xX]\s*(\d+(?:\.\d+)?)\s*$/);
    if (!m)
        return 1;
    const v = parseFloat(m[1]);
    return Number.isNaN(v) || v <= 0 ? 1 : v;
}
/** 擷取單位後尾註（例：1k攪2次 → 備註「攪2次」；1kg挑直的 → 挑直的） */
function extractTrailingRemark(s) {
    return String(s || "")
        .replace(/\s*[×xX]\s*\d+(?:\.\d+)?\s*$/g, "")
        .replace(/^[,，.。、\-－\s]+/g, "")
        .trim();
}
/** 「半公斤」→ 0.5 公斤（口語） */
function normalizeHalfKilogram(line) {
    return String(line || "").replace(/半\s*公斤/g, "0.5公斤");
}
/**
 * 「蒜仁2公斤分2包」：分裝說明不應被第二組「2包」拆成兩筆；先抽出備註再解析。
 * 回傳 { line, packRemark }，packRemark 可能為 null。
 */
function extractSplitPackRemark(line) {
    const raw = String(line || "").trim();
    const m = raw.match(/^(.+?)(\d+(?:\.\d+)?)\s*(公斤|斤|k)\s*分\s*(\d+)\s*(包|把|盒|袋|入|罐|瓶|箱|件)\s*$/i);
    if (!m)
        return { line: raw, packRemark: null };
    const shortLine = `${m[1]}${m[2]}${m[3]}`;
    const packRemark = `分${m[4]}${m[5]}`;
    return { line: shortLine.trim(), packRemark };
}
/** 品名內規格／品質用語（小朵、漂亮…）、尾端「挑直的」等挪到備註 */
const INLINE_REMARK_TOKENS = [
    "盡量漂亮",
    "要漂亮",
    "特小朵",
    "中小顆",
    "中大朵",
    "中小朵",
    "大朵",
    "小朵",
    "中朵",
    "大顆",
    "小顆",
    "中顆",
    "漂亮",
    "注意",
];
/**
 * 品名中（）、()、【】、〔〕等註記內文移入備註；與 splitInlineQualityRemark 合併使用。
 */
function splitBracketRemarksFromName(rawName) {
    let name = String(rawName || "").trim();
    const parts = [];
    const extract = (re) => {
        name = name.replace(re, (m) => {
            const inner = m.slice(1, -1).trim();
            if (inner)
                parts.push(inner);
            return " ";
        });
    };
    extract(/（[^）]*）/g);
    extract(/\([^)]*\)/g);
    extract(/【[^】]*】/g);
    extract(/〔[^〕]*〕/g);
    extract(/《[^》]*》/g);
    name = name.replace(/\s+/g, " ").replace(/[,，]+$/g, "").trim();
    const remark = parts.length ? parts.join("；") : null;
    return { rawName: name || String(rawName || "").trim(), remark };
}
/** 括號註記 + 品質用語（漂亮、挑直的…）一併處理 */
function splitItemNameRemarks(rawName) {
    const br = splitBracketRemarksFromName(rawName);
    const ql = splitInlineQualityRemark(br.rawName);
    return {
        rawName: ql.rawName,
        remark: mergeRemarks(br.remark, ql.remark),
    };
}
function splitInlineQualityRemark(rawName) {
    const original = String(rawName || "").trim();
    let name = original;
    const parts = [];
    const pickStraight = name.match(/^(.*?)(挑直的)\s*$/);
    if (pickStraight) {
        name = pickStraight[1].trim();
        parts.push("挑直的");
    }
    let guard = 0;
    while (guard++ < 20) {
        let hit = false;
        for (const tok of INLINE_REMARK_TOKENS) {
            if (name.includes(tok)) {
                name = name.split(tok).join("").replace(/\s+/g, " ").replace(/[,，]+$/g, "").trim();
                if (!parts.includes(tok))
                    parts.push(tok);
                hit = true;
            }
        }
        if (!hit)
            break;
    }
    const remark = parts.length ? parts.join("；") : null;
    return { rawName: (name || original).trim() || original, remark };
}
function mergeRemarks(a, b) {
    const x = (a && String(a).trim()) || "";
    const y = (b && String(b).trim()) || "";
    if (!x)
        return y || null;
    if (!y)
        return x;
    if (x.includes(y) || y.includes(x))
        return x.length >= y.length ? x : y;
    return `${x}；${y}`;
}
/** 明顯非叫貨行（備註語句），略過避免干擾 */
function isLikelyNonOrderLine(line) {
    const t = String(line || "").trim();
    if (!t)
        return true;
    if (/^新北斗[。．.\s]*$/i.test(t))
        return true;
    if (/麻煩|請多|謝謝|不好意思|都要漂亮|盡量漂亮|麻煩都要/.test(t) && !/[\d０-９]/.test(t) && !/[一二三四五六七八九十半两兩]/.test(t))
        return true;
    return false;
}
/** 解析右側「6k」「1包」「20盒」等（已去掉尾端標點） */
function parseQtyUnitRhs(rhs) {
    const t = String(rhs || "").trim().replace(/[,，.。、\s]+$/g, "").trim();
    if (!t)
        return null;
    const gluedKg = t.match(new RegExp(`^(${QTY_ARABIC}|${QTY_CN})kg$`, "i"));
    if (gluedKg) {
        const q = parseQtyFromStr(gluedKg[1]);
        if (!Number.isNaN(q) && q > 0)
            return { quantity: q, unitRaw: "kg" };
    }
    const gluedK = t.match(new RegExp(`^(${QTY_ARABIC}|${QTY_CN})k$`, "i"));
    if (gluedK) {
        const q = parseQtyFromStr(gluedK[1]);
        if (!Number.isNaN(q) && q > 0)
            return { quantity: q, unitRaw: "k" };
    }
    const spaced = t.match(new RegExp(`^(${QTY_ARABIC}|${QTY_CN})\\s*(${UNIT_TOKEN})$`, "i"));
    if (spaced) {
        const q = parseQtyFromStr(spaced[1]);
        if (!Number.isNaN(q) && q > 0)
            return { quantity: q, unitRaw: spaced[2] };
    }
    return null;
}
/** 片段是否僅為「數字+單位」（逗號後若為此，併回上一段 → 紅蘿蔔，3公斤） */
function isQtyUnitOnlySegment(s) {
    const t = String(s || "").trim().replace(/[,，.。、\s]+$/g, "").trim();
    if (!t)
        return false;
    return new RegExp(`^(${QTY_ARABIC}|${QTY_CN})\\s*(${UNIT_TOKEN})$`, "i").test(t);
}
/** 將「茄子1公斤，辣椒0.5公斤」拆成多行；不拆「紅蘿蔔，3公斤」 */
function expandCommaSeparatedOrderLines(line) {
    const raw = String(line || "").trim();
    if (!raw.includes(",") && !raw.includes("，"))
        return [raw];
    const parts = raw.split(/[,，]/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length <= 1)
        return [raw];
    const merged = [];
    for (const p of parts) {
        if (merged.length && isQtyUnitOnlySegment(p)) {
            merged[merged.length - 1] = merged[merged.length - 1] + "，" + p;
        }
        else {
            merged.push(p);
        }
    }
    return merged;
}
/**
 * 客戶常混用「、」「 . 」分段；先正規成逗號再交 expandCommaSeparatedOrderLines。
 * 小數（0.5）不拆：只替換「非數字後的 空白+點+空白」。
 */
function expandDelimiterOrderLines(line) {
    const raw = String(line || "").trim();
    if (!raw)
        return [];
    let s = raw.replace(/、/g, "，");
    s = s.replace(/(?<!\d)\s+\.\s+(?!\d)/g, "，");
    s = s.replace(/(?<!\d)\s*\.\s*(?=[\u4e00-\u9fff])/g, "，");
    return expandCommaSeparatedOrderLines(s);
}
function parseOrderMessage(text, fallbackUnit) {
    const lines = text
        .split(/\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .flatMap((line) => expandDelimiterOrderLines(line));
    const items = [];
    const sanitizeRawName = (name) => {
        let rawName = String(name || "")
            .replace(/\s+/g, " ")
            .trim();
        // 清掉尾端殘留的 k/kg/公斤（不要求前面一定有空白）
        rawName = rawName.replace(/(k|kg|公斤|千克|克)\s*$/i, "").trim();
        // 「紅蘿蔔，3公斤」類：品名尾逗號
        rawName = rawName.replace(/[,，]+$/g, "").trim();
        // 同一行以「-」「－」或「.」「．」「。」分隔多筆時，品名片段頭尾可能殘留分隔符（例：. 姜、蔥3k-高麗菜10k）
        rawName = rawName.replace(/^[-－・\s.．。、]+/u, "").replace(/[-－・\s.．。、]+$/u, "").trim();
        return rawName;
    };
    for (const rawLine of lines) {
        if (isLikelyNonOrderLine(rawLine))
            continue;
        // 叫貨口語：「大頭菜改30公斤」→ 大頭菜 30公斤（改 與數字間可無空白）；注音 ㄧ 常作「一」
        let line = rawLine.replace(/改\s*(?=\d)/g, " ").replace(/\u3127/g, "一");
        const splitPack = extractSplitPackRemark(line);
        line = normalizeHalfKilogram(splitPack.line);
        const packRemark = splitPack.packRemark;
        const lineMult = trailingQtyMultiplier(line);
        // 0) 品名/數量單位（常見於貼上清單）
        const slashIdx = line.indexOf("/");
        if (slashIdx > 0) {
            const left = line.slice(0, slashIdx).trim();
            const right = line.slice(slashIdx + 1).trim();
            const parsedRhs = parseQtyUnitRhs(right);
            if (left && parsedRhs) {
                const rawName = sanitizeRawName(left);
                if (rawName) {
                    const { quantity: qRhs, unit: unitNorm } = normalizeQtyAndUnit(parsedRhs.quantity, parsedRhs.unitRaw);
                    if (unitNorm && qRhs > 0) {
                        const qSplit = splitItemNameRemarks(rawName);
                        items.push({
                            rawName: qSplit.rawName,
                            quantity: qRhs * lineMult,
                            unit: unitNorm,
                            remark: mergeRemarks(packRemark, qSplit.remark),
                        });
                        continue;
                    }
                }
            }
        }
        // 1) 先嘗試抓同一行所有「數量+單位」組合
        const pairMatches = Array.from(line.matchAll(QTY_UNIT_PAIR_G));
        if (pairMatches.length > 0) {
            if (pairMatches.length === 1) {
                const firstIdx = pairMatches[0].index ?? 0;
                const baseRaw = sanitizeRawName(line.slice(0, firstIdx).trim());
                if (!baseRaw)
                    continue;
                const pm = pairMatches[0];
                const quantity = parseQtyFromStr(pm[1]);
                if (Number.isNaN(quantity) || quantity <= 0)
                    continue;
                const { quantity: qPair, unit: unitNorm } = normalizeQtyAndUnit(quantity, pm[2]);
                if (!unitNorm)
                    continue;
                const unitToken = pm[0] || "";
                const trailing = line.slice(firstIdx + unitToken.length);
                const remark = extractTrailingRemark(trailing);
                const qSplit = splitItemNameRemarks(baseRaw);
                items.push({
                    rawName: qSplit.rawName,
                    quantity: qPair * lineMult,
                    unit: unitNorm,
                    remark: mergeRemarks(mergeRemarks(packRemark, qSplit.remark), remark || null),
                });
            }
            else {
                let lastEnd = 0;
                const rowItems = [];
                for (const pm of pairMatches) {
                    const idx = pm.index ?? 0;
                    const rawName = sanitizeRawName(line.slice(lastEnd, idx).trim());
                    lastEnd = idx + (pm[0]?.length ?? 0);
                    if (!rawName)
                        continue;
                    const quantity = parseQtyFromStr(pm[1]);
                    if (Number.isNaN(quantity) || quantity <= 0)
                        continue;
                    const { quantity: qPair, unit: unitNorm } = normalizeQtyAndUnit(quantity, pm[2]);
                    if (!unitNorm)
                        continue;
                    rowItems.push({
                        rawName,
                        quantity: qPair * lineMult,
                        unit: unitNorm,
                    });
                }
                const mergedRows = [];
                for (let i = 0; i < rowItems.length; i++) {
                    const cur = rowItems[i];
                    const next = rowItems[i + 1];
                    if (next &&
                        (cur.rawName === "分" || cur.rawName === "要分") &&
                        /^(包|把|盒|袋|入|罐|瓶|箱|件)$/.test(String(next.unit || ""))) {
                        const prev = mergedRows[mergedRows.length - 1];
                        if (prev) {
                            const packText = `分${next.quantity}${next.unit}`;
                            prev.remark = mergeRemarks(prev.remark, packText);
                            i++;
                            continue;
                        }
                    }
                    mergedRows.push({ ...cur, remark: null });
                }
                for (const it of mergedRows) {
                    const qSplit = splitItemNameRemarks(it.rawName);
                    items.push({
                        rawName: qSplit.rawName,
                        quantity: it.quantity,
                        unit: it.unit,
                        remark: mergeRemarks(mergeRemarks(packRemark, qSplit.remark), it.remark),
                    });
                }
            }
            continue;
        }
        // 1.5) 僅有「品名 + 數量」，無單位時，使用呼叫端提供的預設單位（常見：豆芽6）
        if (fallbackUnit) {
            const simple = line.match(/^(.+?)\s*([0-9０-９]+(?:\.[0-9０-９]+)?)\s*$/);
            if (simple) {
                const rawNameSimple = sanitizeRawName(simple[1]);
                const qSimple = parseQtyFromStr(simple[2]);
                if (rawNameSimple && !Number.isNaN(qSimple) && qSimple > 0) {
                    const qSplit = splitItemNameRemarks(rawNameSimple);
                    items.push({
                        rawName: qSplit.rawName,
                        quantity: qSimple * lineMult,
                        unit: fallbackUnit,
                        remark: mergeRemarks(packRemark, qSplit.remark),
                    });
                    continue;
                }
            }
        }
        // 同一行可能出現括號內數字（例如：K（攪2次）），因此不要只取第一個 number
        const matches = Array.from(line.matchAll(NUMBER_PATTERN_G));
        let best = null;
        let bestScore = Infinity;
        for (const match of matches) {
            const numStr = match[0];
            const numIdx = match.index ?? -1;
            if (numIdx < 0)
                continue;
            const quantity = parseQtyFromStr(numStr);
            if (Number.isNaN(quantity) || quantity <= 0)
                continue;
            let before = line.slice(0, numIdx).trim();
            let after = line.slice(numIdx + numStr.length).trim();
            let unitRaw = null;
            let afterForName = after;
            let unitBeginMatched = false;
            let startPosInAfterForUnitEnd = null;
            const unitBeginMatch = after.match(UNIT_BEGIN_PATTERN);
            if (unitBeginMatch) {
                unitRaw = unitBeginMatch[1] ?? null;
                unitBeginMatched = true;
                afterForName = after.slice(unitBeginMatch[0].length).trim();
            }
            else {
                const unitEndMatch = after.match(UNIT_PATTERN);
                if (unitEndMatch) {
                    unitRaw = unitEndMatch[1] ?? null;
                    // 若「單位在字串很後面」通常是括號內數字造成誤判，避免選錯
                    startPosInAfterForUnitEnd = after.length - (unitEndMatch[0]?.length ?? 0);
                    if (startPosInAfterForUnitEnd > 10)
                        continue;
                    afterForName = after.slice(0, -((unitEndMatch[0]?.length) ?? 0)).trim();
                }
            }
            let rawName = (before + " " + afterForName).replace(/\s*[,，.。、]\s*$/, "").trim() || before.trim();
            rawName = sanitizeRawName(rawName);
            if (!rawName)
                continue;
            const { quantity: qBest, unit: unitNorm } = normalizeQtyAndUnit(quantity, unitRaw);
            if (!unitNorm)
                continue;
            // scoring：優先 unitBeginMatch，其次讓單位盡量靠近數字
            const score = (unitBeginMatched ? 0 : 20) + (startPosInAfterForUnitEnd ?? 0);
            if (score < bestScore) {
                bestScore = score;
                best = { rawName, quantity: qBest, unit: unitNorm };
            }
        }
        if (best) {
            const qSplit = splitItemNameRemarks(best.rawName);
            items.push({
                rawName: qSplit.rawName,
                quantity: best.quantity * lineMult,
                unit: best.unit,
                remark: mergeRemarks(packRemark, qSplit.remark),
            });
        }
    }
    return items;
}
