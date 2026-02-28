"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProductName = resolveProductName;
/**
 * 依俗名或客戶別名解析出標準品項。
 * 先查該客戶專用別名，再查全公司俗名。
 */
async function resolveProductName(db, rawName, customerId) {
    const normalized = rawName.trim();
    if (!normalized)
        return null;
    if (customerId) {
        const row = await db
            .prepare(`SELECT p.id, p.name, p.erp_code, p.teraoka_barcode, p.unit
         FROM customer_product_aliases cpa
         JOIN products p ON p.id = cpa.product_id AND (p.active IS NULL OR p.active = 1)
         WHERE cpa.customer_id = ? AND (cpa.alias = ? OR cpa.alias = ?)`)
            .get(customerId, normalized, normalized.toLowerCase());
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
    const aliasRow = await db
        .prepare(`SELECT p.id, p.name, p.erp_code, p.teraoka_barcode, p.unit
       FROM product_aliases pa
       JOIN products p ON p.id = pa.product_id AND (p.active IS NULL OR p.active = 1)
       WHERE pa.alias = ? OR pa.alias = ?`)
        .get(normalized, normalized.toLowerCase());
    if (aliasRow) {
        return {
            productId: aliasRow.id,
            productName: aliasRow.name,
            erpCode: aliasRow.erp_code,
            teraokaBarcode: aliasRow.teraoka_barcode,
            unit: aliasRow.unit,
        };
    }
    const productRow = await db
        .prepare(`SELECT id, name, erp_code, teraoka_barcode, unit FROM products WHERE (active IS NULL OR active = 1) AND (name = ? OR name = ?)`)
        .get(normalized, normalized.toLowerCase());
    if (productRow) {
        return {
            productId: productRow.id,
            productName: productRow.name,
            erpCode: productRow.erp_code,
            teraokaBarcode: productRow.teraoka_barcode,
            unit: productRow.unit,
        };
    }
    return null;
}
