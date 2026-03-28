"use strict";
/**
 * 將訂單附件圖存成 Few-Shot 範例：下載 → 寫入 image_path（不存 BLOB）→ parsed_json
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveFewShotExampleFromOrderAttachment = saveFewShotExampleFromOrderAttachment;
exports.buildFewShotParsedPayloadFromOrder = buildFewShotParsedPayloadFromOrder;
const fs = require("fs/promises");
const fsSync = require("fs");
const pathMod = require("path");
const id_js_1 = require("./id.js");
const line_image_compress_js_1 = require("./line-image-compress.js");
/** 預設 data/…；若無法建立（唯讀層等）改 /tmp，並存絕對路徑供後續讀檔 */
async function resolveWritableFewShotDir() {
    const fromEnv = process.env.FEW_SHOT_IMAGE_DIR != null ? String(process.env.FEW_SHOT_IMAGE_DIR).trim() : "";
    if (fromEnv) {
        const absDir = pathMod.isAbsolute(fromEnv) ? fromEnv : pathMod.join(process.cwd(), fromEnv);
        await fs.mkdir(absDir, { recursive: true });
        return { dir: absDir, storeRelative: !pathMod.isAbsolute(fromEnv), envRaw: fromEnv };
    }
    const primary = pathMod.join(process.cwd(), "data", "few-shot-examples");
    try {
        await fs.mkdir(primary, { recursive: true });
        await fs.access(primary, fsSync.constants.W_OK);
        return { dir: primary, storeRelative: true };
    }
    catch (e) {
        const fallback = "/tmp/songfu-few-shot-examples";
        try {
            await fs.mkdir(fallback, { recursive: true });
            console.warn("[few-shot] 主路徑不可用，改使用 /tmp：", e?.message || e);
            return { dir: fallback, storeRelative: false };
        }
        catch (e2) {
            console.error("[few-shot] 無法建立範例圖目錄", primary, fallback, e2?.message || e2);
            throw new Error(`無法建立範例圖目錄：${e2?.message || e2}`);
        }
    }
}
/** 產出與 Gemini schema 對齊之 { items: [...] }（product_id 可為 null） */
async function buildFewShotParsedPayloadFromOrder(db, orderId) {
    const rows = await db
        .prepare(`SELECT oi.raw_name, oi.product_id, oi.quantity, oi.unit, oi.remark
     FROM order_items oi
     WHERE oi.order_id = ?
     ORDER BY COALESCE(oi.display_order, 999999) ASC, oi.id ASC`)
        .all(orderId);
    const items = (rows || []).map((r) => ({
        raw_name: String(r.raw_name || "").trim(),
        product_id: r.product_id != null && String(r.product_id).trim() !== "" ? String(r.product_id).trim() : null,
        quantity: Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : 0,
        unit: String(r.unit || "").trim() || "公斤",
        remark: r.remark != null && String(r.remark).trim() !== "" ? String(r.remark).trim() : "",
        confidence_score: 100,
    }));
    return { items };
}
async function saveFewShotExampleFromOrderAttachment(db, params) {
    const { orderId, attachmentId, qualityScore = 1, note = "" } = params;
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
    if (!token)
        throw new Error("LINE_CHANNEL_ACCESS_TOKEN 未設定，無法下載附件圖");
    const order = await db.prepare("SELECT id, customer_id FROM orders WHERE id = ?").get(orderId);
    if (!order)
        throw new Error("訂單不存在");
    const att = await db.prepare("SELECT id, order_id, line_message_id FROM order_attachments WHERE id = ? AND order_id = ?").get(attachmentId, orderId);
    if (!att || !att.line_message_id)
        throw new Error("附件不存在或無 line_message_id");
    const resp = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(att.line_message_id)}/content`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok)
        throw new Error(`LINE 圖片 HTTP ${resp.status}`);
    const rawBuf = Buffer.from(await resp.arrayBuffer());
    const buf = await (0, line_image_compress_js_1.compressLineImageBuffer)(rawBuf);
    const { dir: fewShotDir, storeRelative, envRaw } = await resolveWritableFewShotDir();
    const fileId = (0, id_js_1.newId)("fse");
    const fileName = `${fileId}.jpg`;
    const absPath = pathMod.join(fewShotDir, fileName);
    await fs.writeFile(absPath, buf);
    const imagePathForDb = storeRelative
        ? (envRaw ? pathMod.join(envRaw, fileName).replace(/\\/g, "/") : pathMod.join("data", "few-shot-examples", fileName).replace(/\\/g, "/"))
        : absPath.replace(/\\/g, "/");
    const payload = await buildFewShotParsedPayloadFromOrder(db, orderId);
    const parsed_json = JSON.stringify(payload);
    const id = (0, id_js_1.newId)("coe");
    const now = new Date().toISOString();
    const q = Number(qualityScore);
    const quality = Number.isFinite(q) && q > 0 ? q : 1;
    try {
        await db.prepare(`INSERT INTO customer_order_image_examples
    (id, customer_id, order_id, attachment_id, image_path, parsed_json, quality_score, is_active, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).run(id, order.customer_id, orderId, attachmentId, imagePathForDb, parsed_json, quality, note || null, now, now);
    }
    catch (dbErr) {
        console.error("[Save Example Error] INSERT customer_order_image_examples failed:", dbErr?.message || dbErr, dbErr?.stack || "");
        try {
            await fs.unlink(absPath);
        }
        catch (_) { /* 略過清除失敗 */ }
        throw dbErr;
    }
    console.log("[Save Example] inserted id=%s customer_id=%s order_id=%s image_path=%s", id, order.customer_id, orderId, imagePathForDb);
    return { id, image_path: imagePathForDb, item_count: payload.items.length };
}
