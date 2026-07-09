"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// 每個 LINE 群組的功能白名單：辨識訂單 / 盤點 / 空籃。
// 設計：group_features 無資料列時，辨識訂單／空籃預設「開」、盤點預設「關」（盤點為 opt-in 白名單制，
// 只有明確設為開的群組才回應 #盤點）；有列則各欄 1/0 決定。
// 比對一律正規化（去空白＋小寫），避免白名單存的 ID 與實際 groupId 有空白/大小寫差異而失效。

exports.getGroupFeatures = getGroupFeatures;
exports.setGroupFeatures = setGroupFeatures;
exports.DEFAULT_FEATURES = { order: true, stocktake: false, basket: true };

function normGid(s) {
    return String(s || "").replace(/\s/g, "").toLowerCase();
}

function rowToFeatures(row) {
    // 無資料列：辨識訂單／空籃預設開、盤點預設關。
    if (!row) return { order: true, stocktake: false, basket: true };
    // 有列：訂單／空籃欄位為 NULL 時視為開；盤點欄位為 NULL 時視為關。
    const onTrue = (v) => (v == null ? true : !!Number(v));
    const onFalse = (v) => (v == null ? false : !!Number(v));
    return {
        order: onTrue(row.feat_order),
        stocktake: onFalse(row.feat_stocktake),
        basket: onTrue(row.feat_basket),
    };
}

/**
 * 取得群組的功能設定。查不到列（或查詢失敗）一律回傳三項全開，確保不會意外中斷收單。
 * @returns {Promise<{order:boolean, stocktake:boolean, basket:boolean}>}
 */
async function getGroupFeatures(db, groupId) {
    if (!groupId) return { order: true, stocktake: false, basket: true };
    try {
        const needle = normGid(groupId);
        const rows = await db.prepare("SELECT group_id, feat_order, feat_stocktake, feat_basket FROM group_features").all();
        const row = (rows || []).find((r) => normGid(r.group_id) === needle) || null;
        return rowToFeatures(row);
    } catch (e) {
        // 讀取失敗：訂單／空籃維持開（絕不意外斷單），盤點維持關（opt-in）。
        console.warn("[group-features] 讀取失敗，改用預設（訂單/空籃開、盤點關）:", e?.message || e);
        return { order: true, stocktake: false, basket: true };
    }
}

/**
 * 寫入/更新群組功能設定（upsert）。feats 為 {order, stocktake, basket} 布林。
 */
async function setGroupFeatures(db, groupId, feats) {
    const gid = String(groupId || "").replace(/\s/g, "").trim();
    if (!gid) return;
    const now = new Date().toISOString();
    const b = (v) => (v ? 1 : 0);
    const o = b(feats.order), s = b(feats.stocktake), k = b(feats.basket);
    if (process.env.DATABASE_URL) {
        await db.prepare(
            "INSERT INTO group_features (group_id, feat_order, feat_stocktake, feat_basket, updated_at) VALUES (?, ?, ?, ?, ?) " +
            "ON CONFLICT (group_id) DO UPDATE SET feat_order = EXCLUDED.feat_order, feat_stocktake = EXCLUDED.feat_stocktake, feat_basket = EXCLUDED.feat_basket, updated_at = EXCLUDED.updated_at"
        ).run(gid, o, s, k, now);
    } else {
        await db.prepare(
            "INSERT INTO group_features (group_id, feat_order, feat_stocktake, feat_basket, updated_at) VALUES (?, ?, ?, ?, ?) " +
            "ON CONFLICT(group_id) DO UPDATE SET feat_order = excluded.feat_order, feat_stocktake = excluded.feat_stocktake, feat_basket = excluded.feat_basket, updated_at = excluded.updated_at"
        ).run(gid, o, s, k, now);
    }
}
