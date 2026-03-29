"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProductName = resolveProductName;
const gemini_chat_js_1 = require("./gemini-chat.js");
const customer_handwriting_hints_js_1 = require("./customer-handwriting-hints.js");
/**
 * 依俗名或客戶別名解析出標準品項。
 * 先查該客戶專用別名，再查全公司俗名；會嘗試多種正規化（去標點、去空白）提高辨識率。
 */
function nameCandidates(rawName) {
    const n = rawName.trim();
    if (!n)
        return [];
    const out = [n, n.toLowerCase()];
    const noTrail = n.replace(/\s*[,，.。、\s]+$/g, "").trim();
    if (noTrail && !out.includes(noTrail))
        out.push(noTrail, noTrail.toLowerCase());
    const strict = n.replace(/[\s,，.。、]/g, "");
    if (strict && !out.includes(strict))
        out.push(strict, strict.toLowerCase());
    return out;
}
function ymdDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - Math.max(0, days | 0));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}
async function loadRecentFreqByProduct(db, customerId, productIds, days = 60) {
    const ids = Array.from(new Set((productIds || []).map((x) => String(x || "").trim()).filter(Boolean)));
    if (!customerId || !ids.length)
        return new Map();
    const ph = ids.map(() => "?").join(",");
    const fromDate = ymdDaysAgo(days);
    const rows = await db
        .prepare(`SELECT oi.product_id, COUNT(*) AS c
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.customer_id = ? AND o.order_date >= ? AND oi.product_id IN (${ph})
       GROUP BY oi.product_id`)
        .all(customerId, fromDate, ...ids);
    const m = new Map();
    for (const r of (rows || [])) {
        m.set(String(r.product_id), Number(r.c) || 0);
    }
    return m;
}
async function tryResolve(db, customerId, candidates) {
    if (candidates.length === 0)
        return null;
    const placeholders = candidates.map(() => "?").join(",");
    if (customerId) {
        const row = await db
            .prepare(`SELECT p.id, p.name, p.erp_code, p.teraoka_barcode, p.unit
         FROM customer_product_aliases cpa
         JOIN products p ON p.id = cpa.product_id AND (p.active IS NULL OR p.active = 1)
         WHERE cpa.customer_id = ? AND cpa.alias IN (${placeholders})`)
            .get(customerId, ...candidates);
        if (row)
            return { productId: row.id, productName: row.name, erpCode: row.erp_code, teraokaBarcode: row.teraoka_barcode, unit: row.unit };
        const hintKeys = Array.from(new Set(candidates
            .map((c) => customer_handwriting_hints_js_1.normalizeHandwritingRawKey(c))
            .filter((k) => k && k.length >= 2)));
        if (hintKeys.length) {
            const ph = hintKeys.map(() => "?").join(",");
            const hintRow = await db
                .prepare(`SELECT p.id, p.name, p.erp_code, p.teraoka_barcode, p.unit
         FROM customer_handwriting_hints h
         JOIN products p ON p.id = h.product_id AND (p.active IS NULL OR p.active = 1)
         WHERE h.customer_id = ? AND h.raw_key IN (${ph})
         ORDER BY h.hit_count DESC, h.updated_at DESC
         LIMIT 1`)
                .get(customerId, ...hintKeys);
            if (hintRow)
                return { productId: hintRow.id, productName: hintRow.name, erpCode: hintRow.erp_code, teraokaBarcode: hintRow.teraoka_barcode, unit: hintRow.unit };
        }
    }
    const aliasRow = await db
        .prepare(`SELECT p.id, p.name, p.erp_code, p.teraoka_barcode, p.unit
       FROM product_aliases pa
       JOIN products p ON p.id = pa.product_id AND (p.active IS NULL OR p.active = 1)
       WHERE pa.alias IN (${placeholders})`)
        .get(...candidates);
    if (aliasRow)
        return { productId: aliasRow.id, productName: aliasRow.name, erpCode: aliasRow.erp_code, teraokaBarcode: aliasRow.teraoka_barcode, unit: aliasRow.unit };
    const productRow = await db
        .prepare(`SELECT id, name, erp_code, teraoka_barcode, unit FROM products WHERE (active IS NULL OR active = 1) AND name IN (${placeholders})`)
        .get(...candidates);
    if (productRow)
        return { productId: productRow.id, productName: productRow.name, erpCode: productRow.erp_code, teraokaBarcode: productRow.teraoka_barcode, unit: productRow.unit };
    // 文字常見變體（例如：蒜碎 / 鵝白菜）可能無法 exact match，補一層保守模糊匹配
    const fuzzyTokens = Array.from(new Set(candidates
        .map((c) => String(c || "").replace(/[\s,，.。、]/g, "").trim())
        .filter((x) => x.length >= 2))).slice(0, 5);
    if (fuzzyTokens.length) {
        const like = fuzzyTokens.map(() => "replace(replace(replace(replace(replace(lower(pa.alias),' ',''),',',''),'，',''),'.',''),'。','') LIKE ?").join(" OR ");
        const likeVals = fuzzyTokens.map((t) => `%${t.toLowerCase()}%`);
        const aliasFuzzyRows = await db
            .prepare(`SELECT p.id, p.name, p.erp_code, p.teraoka_barcode, p.unit
         FROM product_aliases pa
         JOIN products p ON p.id = pa.product_id AND (p.active IS NULL OR p.active = 1)
         WHERE ${like}
         ORDER BY length(pa.alias) ASC
         LIMIT 20`)
            .all(...likeVals);
        const likeProd = fuzzyTokens.map(() => "replace(replace(replace(replace(replace(lower(name),' ',''),',',''),'，',''),'.',''),'。','') LIKE ?").join(" OR ");
        const prodFuzzyRows = await db
            .prepare(`SELECT id, name, erp_code, teraoka_barcode, unit
         FROM products
         WHERE (active IS NULL OR active = 1) AND (${likeProd})
         ORDER BY length(name) ASC
         LIMIT 20`)
            .all(...likeVals);
        const blockedSuffix = ["絲", "丁", "片", "末", "泥"];
        const aliasList = (aliasFuzzyRows || []).map((r) => ({ ...r, src: "alias" }));
        const prodList = (prodFuzzyRows || [])
            .filter((r) => {
            const nm = String(r.name || "").trim();
            const token = fuzzyTokens[0] || "";
            if (!token || !nm)
                return true;
            if (nm === token)
                return true;
            if (nm.startsWith(token) && blockedSuffix.some((s) => nm.endsWith(s) && !token.endsWith(s)))
                return false;
            return true;
        })
            .map((r) => ({ ...r, src: "product" }));
        const mergedMap = new Map();
        for (const row of [...aliasList, ...prodList]) {
            const key = String(row.id || "");
            if (!key)
                continue;
            if (!mergedMap.has(key))
                mergedMap.set(key, row);
        }
        const merged = Array.from(mergedMap.values());
        if (merged.length) {
            const freqMap = await loadRecentFreqByProduct(db, customerId || null, merged.map((x) => x.id), 60);
            merged.sort((a, b) => {
                const fa = freqMap.get(String(a.id)) || 0;
                const fb = freqMap.get(String(b.id)) || 0;
                if (fa !== fb)
                    return fb - fa; // 同客戶近期高頻優先
                if (a.src !== b.src)
                    return a.src === "alias" ? -1 : 1; // 別名命中優先
                const la = String(a.name || "").length;
                const lb = String(b.name || "").length;
                if (la !== lb)
                    return la - lb; // 名稱較短通常較精準
                return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant");
            });
            const pick = merged[0];
            if (pick) {
                return { productId: pick.id, productName: pick.name, erpCode: pick.erp_code, teraokaBarcode: pick.teraoka_barcode, unit: pick.unit };
            }
        }
    }
    return null;
}
async function resolveProductName(db, rawName, customerId) {
    const candidates = nameCandidates(rawName);
    const result = await tryResolve(db, customerId, candidates);
    if (result) {
        return {
            productId: result.productId,
            productName: result.productName,
            erpCode: result.erpCode,
            teraokaBarcode: result.teraokaBarcode,
            unit: result.unit,
        };
    }
    // 若規則匹配失敗，才用 AI 做 fallback（避免把噪音強行硬對）
    const productId = await aiFallbackResolveProductId(db, rawName, customerId);
    if (productId) {
        const row = await db.prepare("SELECT id, name, erp_code, teraoka_barcode, unit FROM products WHERE id = ?").get(productId);
        if (row) {
            return {
                productId: row.id,
                productName: row.name,
                erpCode: row.erp_code,
                teraokaBarcode: row.teraoka_barcode,
                unit: row.unit,
            };
        }
    }
    return null;
}

function cleanForAI(s) {
    return String(s || "")
        .replace(/[\(（][^）)]*[\)）]/g, " ")
        .replace(/[\\s,，.。、]+/g, " ")
        .trim();
}
async function aiFallbackResolveProductId(db, rawName, customerId) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim())
        return null;
    const cleaned = cleanForAI(rawName);
    if (!cleaned || cleaned.length < 2)
        return null;
    // 先做小幅候選過濾，避免 prompt 太大
    const tokens = cleaned
        .split(/\s+/)
        .map((x) => x.trim())
        .filter((x) => x && x.length >= 2)
        .slice(0, 6);
    let all = [];
    try {
        all = await db
            .prepare("SELECT id, name, erp_code, teraoka_barcode, unit FROM products WHERE (active IS NULL OR active = 1) ORDER BY name LIMIT 600")
            .all();
    }
    catch (_) {
        return null;
    }
    const normName = (n) => String(n || "").toLowerCase().replace(/[\\s,，.。、]/g, "");
    const filtered = all
        .filter((p) => {
        const nn = normName(p.name);
        return tokens.some((t) => nn.includes(String(t).toLowerCase().replace(/[\\s,，.。、]/g, "")));
    })
        .slice(0, 60);
    const pool = filtered.length ? filtered : all.slice(0, 40);
    if (!pool.length)
        return null;
    const payload = pool.map((p) => ({
        id: p.id,
        name: p.name,
        erpCode: p.erp_code ?? null,
        teraokaBarcode: p.teraoka_barcode ?? null,
        unit: p.unit ?? null,
    }));
    const userMessage = [
        `rawName=${rawName}`,
        `customerId=${customerId || ""}`,
        `候選品項（請從中選出最相符者）：`,
        JSON.stringify(payload, null, 0),
        ``,
        `規則：`,
        `1) 只允許回傳「候選品項」中的某個 id；若真的都不像，回傳 productId=null。`,
        `2) 回傳理由可簡短，但必須是 JSON 可解析。`,
    ].join("\n");
    const systemPrompt = "你是品項對應器。使用者提供一段叫貨文字 rawName，需要在候選品項中找出最可能的標準品項。請只回傳嚴格 JSON（勿用 markdown 程式碼區塊包起來）。JSON 格式：{\"productId\":\"<id或null>\",\"reason\":\"<一句話>\"}";
    const reply = await (0, gemini_chat_js_1.chatWithGemini)(userMessage, systemPrompt);
    if (!reply)
        return null;
    // 抓出 JSON
    const m = reply.match(/\{[\s\S]*\}/);
    if (!m)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(m[0]);
    }
    catch (_) {
        return null;
    }
    const pid = parsed?.productId;
    if (!pid || typeof pid !== "string")
        return null;
    return pid.trim();
}
