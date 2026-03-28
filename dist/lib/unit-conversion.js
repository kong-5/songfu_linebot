"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadUnitConversionRules = loadUnitConversionRules;
exports.applyUnitConversion = applyUnitConversion;
exports.applyOrderUnitConversion = applyOrderUnitConversion;
exports.withOriginCallRemark = withOriginCallRemark;
exports.normalizeOrderUnitForStorage = normalizeOrderUnitForStorage;
/**
 * 依後台 app_settings.line_unit_conversion_rules 將「把、小把」等換算成公斤等。
 * JSON 範例：
 * { "rules": [
 *   { "productNameContains": "芹菜", "fromUnits": ["小把"], "toUnit": "公斤", "kgPerUnit": 0.05,
 *     "kgSafetyFactor": 0.98, "remarkStyle": "plain" },
 *   { "productId": "prod_xxx", "fromUnits": ["把"], "toUnit": "公斤", "kgPerUnit": 0.2 }
 * ]}
 * kgPerUnit：每一單位「fromUnits」對應幾公斤（例：2 小把若要以 0.1 公斤計，設 0.05）。
 * kgSafetyFactor：選填，0～1，乘在換算結果上讓重量略保守（預設 1）。
 * remarkStyle：選填；換算備註一律只寫客戶單位片段（如「2小把」）。設為 none/off 則不寫；prefix 已不再輸出「原訂」字樣（與 plain 相同）。
 * 進單請用 applyOrderUnitConversion：斤→公斤後，**優先**用品項 product_unit_specs（2-2）的 conversion_kg；若無再套用 line_unit_conversion_rules（含 productNameContains 規則）。
 */
async function loadUnitConversionRules(db) {
    const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_unit_conversion_rules");
    if (!row?.value)
        return { rules: [] };
    try {
        const parsed = JSON.parse(String(row.value));
        if (parsed && Array.isArray(parsed.rules))
            return { rules: parsed.rules };
        if (Array.isArray(parsed))
            return { rules: parsed };
        return { rules: [] };
    }
    catch (_) {
        return { rules: [] };
    }
}
function normUnit(u) {
    if (u == null || u === "")
        return "";
    const s = String(u).trim();
    const t = s.toLowerCase();
    if (t === "k" || t === "kg")
        return "公斤";
    return s;
}
/** 與 LINE webhook 一致：進庫前將 k／kg／斤等統一成「公斤」，其餘保留原文（把、包等） */
function normalizeOrderUnitForStorage(raw, fallbackUnit) {
    const u = String(raw || "").trim().toUpperCase();
    if (!u)
        return fallbackUnit || "公斤";
    if (u === "K" || u === "KG" || u === "公斤" || u === "千克" || u === "斤") {
        return "公斤";
    }
    return String(raw || "").trim();
}
/** 還原客戶原始下單文字供備註（例：2小把） */
function formatOriginalQtyUnitForRemark(qty, unitStr) {
    const q = Number(qty);
    if (!Number.isFinite(q))
        return "";
    const u = unitStr != null ? String(unitStr).trim() : "";
    const qStr = Number.isInteger(q) ? String(q) : String(q);
    return u ? `${qStr}${u}` : qStr;
}
function buildConversionRemark(rule, origQty, origUnitStr) {
    const line = formatOriginalQtyUnitForRemark(origQty, origUnitStr);
    if (!line)
        return null;
    const style = (rule.remarkStyle || "plain").toString().trim().toLowerCase();
    if (style === "none" || style === "off")
        return null;
    // 一律僅保留客戶可讀片段（如「1袋」），不再輸出「原訂」前綴（後台 JSON 若設 prefix 亦同）
    return line;
}
function applyUnitConversion(rulesWrap, resolved, quantity, unit) {
    const rules = rulesWrap?.rules || [];
    let q = Number(quantity);
    let u = normUnit(unit);
    if (!resolved || !Number.isFinite(q))
        return { quantity: q, unit: u || unit, remark: null };
    // 通用換算：1斤 = 0.6公斤
    if (u === "斤") {
        const converted = Math.round((q * 0.6) * 1000) / 1000;
        return {
            quantity: converted,
            unit: "公斤",
            remark: buildConversionRemark({ remarkStyle: "plain" }, q, "斤"),
        };
    }
    if (!rules.length)
        return { quantity: q, unit: u || unit, remark: null };
    const pname = String(resolved.productName || "");
    const pid = resolved.productId;
    for (const rule of rules) {
        if (rule.productId) {
            if (rule.productId !== pid)
                continue;
            if (rule.productNameContains && !pname.includes(String(rule.productNameContains)))
                continue;
        }
        else if (rule.productNameContains) {
            if (!pname.includes(String(rule.productNameContains)))
                continue;
        }
        else {
            continue;
        }
        const fromUnits = Array.isArray(rule.fromUnits)
            ? rule.fromUnits
            : (rule.fromUnit ? [rule.fromUnit] : []);
        const fu = fromUnits.map((x) => normUnit(x));
        if (fu.length === 0 || !fu.includes(u))
            continue;
        const kgPer = Number(rule.kgPerUnit ?? rule.kg_per_unit);
        if (!Number.isFinite(kgPer) || kgPer <= 0)
            continue;
        const toUnit = rule.toUnit || "公斤";
        const origQty = q;
        const origUnitDisplay = u || unit || "";
        let newQty = q * kgPer;
        const sf = Number(rule.kgSafetyFactor ?? rule.resultFactor);
        if (Number.isFinite(sf) && sf > 0 && sf <= 1)
            newQty *= sf;
        newQty = Math.round(newQty * 1000) / 1000;
        const remark = buildConversionRemark(rule, origQty, origUnitDisplay);
        return { quantity: newQty, unit: toUnit, remark };
    }
    return { quantity: q, unit: u || unit, remark: null };
}
function mergeConversionRemark(a, b) {
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
/** 品項「2-2 單位→公斤」：依 product_unit_specs.conversion_kg 換算 */
async function loadProductSpecKgPerUnit(db, productId, orderUnit) {
    const u = normUnit(orderUnit);
    if (!db || !productId || !u)
        return null;
    try {
        const row = await db
            .prepare("SELECT conversion_kg FROM product_unit_specs WHERE product_id = ? AND unit = ? AND conversion_kg IS NOT NULL AND conversion_kg > 0 LIMIT 1")
            .get(productId, u);
        if (row?.conversion_kg != null) {
            const x = Number(row.conversion_kg);
            return Number.isFinite(x) && x > 0 ? x : null;
        }
    }
    catch (_) {
        /* 表不存在等 */
    }
    return null;
}
/**
 * LINE／後台進單用：斤→公斤；**品項 2-2（product_unit_specs）優先於** line_unit_conversion_rules，
 * 避免內建或通用「品名關鍵字」規則蓋過您在品項上設定的每條／每包公斤數。
 */
async function applyOrderUnitConversion(db, rulesWrap, resolved, quantity, unit) {
    let q = Number(quantity);
    const u = normUnit(unit);
    if (!resolved || !Number.isFinite(q))
        return { quantity: q, unit: u || unit, remark: null };
    if (u === "斤") {
        const converted = Math.round((q * 0.6) * 1000) / 1000;
        return {
            quantity: converted,
            unit: "公斤",
            remark: buildConversionRemark({ remarkStyle: "plain" }, q, "斤"),
        };
    }
    if (resolved.productId && db && normUnit(u) !== "公斤") {
        const specKgFirst = await loadProductSpecKgPerUnit(db, resolved.productId, u);
        if (Number.isFinite(specKgFirst) && specKgFirst > 0) {
            const newQty = Math.round(q * specKgFirst * 1000) / 1000;
            const specRemark = buildConversionRemark({ remarkStyle: "plain" }, q, u || String(unit || "").trim() || "");
            return { quantity: newQty, unit: "公斤", remark: specRemark };
        }
    }
    const r = applyUnitConversion(rulesWrap, resolved, quantity, unit);
    if (normUnit(r.unit) === "公斤")
        return r;
    if (!resolved?.productId || !db)
        return r;
    const specKg = await loadProductSpecKgPerUnit(db, resolved.productId, r.unit);
    if (!Number.isFinite(specKg) || specKg <= 0)
        return r;
    const q0 = Number(r.quantity);
    if (!Number.isFinite(q0))
        return r;
    const newQty = Math.round(q0 * specKg * 1000) / 1000;
    const specRemark = buildConversionRemark({ remarkStyle: "plain" }, q0, r.unit);
    return {
        quantity: newQty,
        unit: "公斤",
        remark: mergeConversionRemark(r.remark, specRemark),
    };
}
function formatQtyForOriginTag(q) {
    const n = Number(q);
    if (!Number.isFinite(n))
        return String(q ?? "");
    return Number.isInteger(n) ? String(n) : String(n).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
function stripLegacyRemarkPrefixes(s) {
    return String(s || "")
        .replace(/原訂\s*/g, "")
        .replace(/原叫貨：\s*/g, "")
        .trim();
}
/** 已換成公斤時，備註補上客戶原始數量單位（純文字，不加前綴）；若換算備註已含同段則不重複 */
function withOriginCallRemark(existing, originQty, originUnit, finalUnit) {
    const fromU = String(originUnit || "").trim();
    if (!fromU || normalizeOrderUnitForStorage(fromU, "公斤") === "公斤")
        return existing ?? null;
    if (normalizeOrderUnitForStorage(String(finalUnit || "").trim(), "公斤") !== "公斤")
        return existing ?? null;
    const tag = `${formatQtyForOriginTag(originQty)}${fromU}`;
    const base = String(existing || "").trim();
    if (!base)
        return tag;
    if (base.includes(tag))
        return base;
    const baseNorm = stripLegacyRemarkPrefixes(base);
    if (baseNorm.includes(tag))
        return base;
    return `${base}；${tag}`;
}
