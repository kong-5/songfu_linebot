"use strict";
/**
 * 將後台「LINE 叫貨單位換算」規則同步寫入 product_unit_specs，供進單時優先套用（見 unit-conversion.applyOrderUnitConversion）。
 * product_packaging_ratios（箱／包階層）無法從單一 kg/單位規則可靠推導，仍請在品項頁手動維護。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncProductUnitSpecsFromLineRules = syncProductUnitSpecsFromLineRules;
const id_js_1 = require("./id.js");
async function upsertProductUnitSpecKg(db, productId, unitLabel, conversionKg, noteLabel) {
    const pid = String(productId || "").trim();
    const unit = String(unitLabel || "").trim();
    const kg = Number(conversionKg);
    if (!pid || !unit || !Number.isFinite(kg) || kg <= 0)
        return;
    const isPg = Boolean(process.env.DATABASE_URL);
    const tsSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
    const note = noteLabel && String(noteLabel).trim() ? String(noteLabel).trim() : "自動學習（LINE 換算規則）";
    const row = await db.prepare("SELECT id FROM product_unit_specs WHERE product_id = ? AND unit = ? LIMIT 1").get(pid, unit);
    if (row?.id) {
        await db
            .prepare(`UPDATE product_unit_specs SET conversion_kg = ?, note_label = ?, updated_at = ${tsSql} WHERE id = ?`)
            .run(kg, note, row.id);
    }
    else {
        const nid = (0, id_js_1.newId)("pus");
        await db
            .prepare(`INSERT INTO product_unit_specs (id, product_id, unit, note_label, conversion_kg, updated_at) VALUES (?, ?, ?, ?, ?, ${tsSql})`)
            .run(nid, pid, unit, note, kg);
    }
}
/** 依目前 rules JSON，對每個符合的品項 upsert「來源單位 → conversion_kg」 */
async function syncProductUnitSpecsFromLineRules(db, rulesObj) {
    if (!db || !rulesObj || !Array.isArray(rulesObj.rules))
        return { updated: 0 };
    let updated = 0;
    for (const r of rulesObj.rules) {
        const kg = Number(r.kgPerUnit ?? r.kg_per_unit);
        if (!Number.isFinite(kg) || kg <= 0)
            continue;
        const fromUnits = Array.isArray(r.fromUnits) ? r.fromUnits : r.fromUnit ? [r.fromUnit] : [];
        const units = fromUnits.map((x) => String(x || "").trim()).filter(Boolean);
        if (units.length === 0)
            continue;
        let productIds = [];
        if (r.productId) {
            const id = String(r.productId).trim();
            const prow = await db.prepare("SELECT id FROM products WHERE id = ? AND (active IS NULL OR active = 1)").get(id);
            if (prow?.id)
                productIds = [prow.id];
        }
        else if (r.productNameContains) {
            const kw = String(r.productNameContains).trim();
            if (kw) {
                const safe = kw.replace(/%/g, "").replace(/_/g, "").trim();
                if (!safe)
                    continue;
                const rows = await db.prepare("SELECT id FROM products WHERE (active IS NULL OR active = 1) AND name LIKE ?").all("%" + safe + "%");
                productIds = (rows || []).map((x) => String(x.id));
            }
        }
        if (productIds.length === 0)
            continue;
        const tag = r.productNameContains ? `關鍵字「${String(r.productNameContains)}」` : `品項 id`;
        for (const pid of productIds) {
            for (const u of units) {
                await upsertProductUnitSpecKg(db, pid, u, kg, `自動學習（LINE 換算｜${tag}）`);
                updated++;
            }
        }
    }
    return { updated };
}
