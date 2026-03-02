"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProductName = resolveProductName;
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
    return null;
}
