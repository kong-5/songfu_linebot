"use strict";
/**
 * 北農行情看板的「我們自己」那一半（2026-10-17）：
 *   - 北農品名 ↔ 我們的凌越料號對照（market_crop_map，含每單位幾公斤，用來把元/公斤折成元/箱）
 *   - 全公司共用的關注品項（market_watch）
 *   - 批次對照頁 /logistics/market/mapping：列常用料號＋自動建議北農品名，勾一勾一次存
 * 寫入一律同交易寫稽核（dist/lib/audit.js），重複送出不會多一筆（主鍵 upsert／刪不存在的列＝無事）。
 * 對照只認松富（icpno 00）料號——行情看板是採購用，採購主體是松富。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMarketRoutes = registerMarketRoutes;
exports.loadMarketMappings = loadMarketMappings;
exports.loadMarketWatch = loadMarketWatch;

const express_1 = { default: require("express") };
const audit_js_1 = require("../lib/audit.js");
const wholesale_trend_js_1 = require("../lib/wholesale-trend.js");
const wholesale_snapshot_js_1 = require("../lib/wholesale-snapshot.js");
const { escapeHtml, escapeAttr, safeErrDetail } = require("./_shared.js");

const ICPNO = "00";
const nowIso = () => new Date().toISOString();

/** 品名 → [{code,name,spec,unit,qty,kg}]；qty＝凌越快照＋庫存調整（同目前庫存頁口徑） */
async function loadMarketMappings(db) {
    const rows = await db.prepare(`SELECT m.crop_name, m.erp_code, m.kg_per_unit, s.name, s.spec, s.unit, s.qty, a.delta
      FROM market_crop_map m
      LEFT JOIN erp_stock_items s ON s.icpno = m.icpno AND s.erp_code = m.erp_code
      LEFT JOIN stock_adjustment a ON a.icpno = m.icpno AND a.erp_code = m.erp_code
      WHERE m.icpno = ? ORDER BY m.crop_name, m.erp_code`).all(ICPNO);
    const out = {};
    for (const r of rows || []) {
        const qty = r.qty != null ? Number(r.qty) + (Number(r.delta) || 0) : null;
        (out[r.crop_name] = out[r.crop_name] || []).push({
            code: r.erp_code, name: r.name || "（凌越已無此料號）", spec: r.spec || "", unit: r.unit || "",
            qty: qty != null ? Math.round(qty * 100) / 100 : null, kg: r.kg_per_unit != null ? Number(r.kg_per_unit) : null,
        });
    }
    return out;
}

async function loadMarketWatch(db) {
    const rows = await db.prepare("SELECT crop_name FROM market_watch ORDER BY crop_name").all();
    return (rows || []).map((r) => r.crop_name);
}

/** 驗證每單位公斤數；空白＝不填（回 null）。不合法回 { error } */
function parseKgInput(v) {
    const s = String(v ?? "").trim();
    if (!s) return { kg: null };
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0 || n > 2000) return { error: `每單位公斤數「${s}」不對：要填大於 0 的數字，例如一箱 18 公斤就填 18；不知道可以留白。` };
    return { kg: Math.round(n * 1000) / 1000 };
}

/** 一筆對照的 upsert＋稽核（交易內呼叫） */
async function upsertMapping(h, { crop, code, kg, actor }) {
    const old = await h.prepare("SELECT crop_name, kg_per_unit FROM market_crop_map WHERE icpno = ? AND erp_code = ?").get(ICPNO, code);
    if (old && old.crop_name === crop && (old.kg_per_unit == null ? null : Number(old.kg_per_unit)) === kg) return false;
    await h.prepare(`INSERT INTO market_crop_map (icpno, erp_code, crop_name, kg_per_unit, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (icpno, erp_code) DO UPDATE SET crop_name = EXCLUDED.crop_name, kg_per_unit = EXCLUDED.kg_per_unit, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`)
        .run(ICPNO, code, crop, kg, actor, nowIso());
    await (0, audit_js_1.writeAudit)(h, {
        entityType: "market_crop_map", entityId: `${ICPNO}:${code}`, action: old ? "update" : "create", actor,
        summary: old ? `北農對照 ${code}：${old.crop_name}→${crop}` : `北農對照 ${code} → ${crop}`,
        meta: { old: old ? { crop: old.crop_name, kg: old.kg_per_unit } : null, new: { crop, kg } },
    });
    return true;
}

/** 北農品名必須在快照出現過（防手打錯字對到不存在的品名，看板永遠對不上） */
async function cropExists(h, crop) {
    return !!(await h.prepare("SELECT 1 AS x FROM wholesale_market_snapshots WHERE crop_name = ? LIMIT 1").get(crop));
}
const cropMissingMsg = (crop) => `北農沒有「${crop}」這個品名：請從下拉清單或搜尋結果選，品名要和北農完全一樣（含「-品種」）。`;

const inTx = async (db, fn) => (typeof db.transaction === "function" ? db.transaction(fn) : fn(db));

function registerMarketRoutes(router, ctx) {
    const { db, notionPage } = ctx;
    const jsonBody = express_1.default.json({ limit: "64kb" });
    const fail = (res, status, error) => res.status(status).json({ ok: false, error });

    // 料號搜尋（對照用）：q＝關鍵字；沒給 q 但給 crop＝用北農品名反查建議
    router.get("/logistics/market/erp-search", async (req, res) => {
        try {
            const q = String(req.query.q || "").trim().slice(0, 40);
            const crop = String(req.query.crop || "").trim();
            let rows;
            if (q) {
                const like = "%" + q.replace(/[%_]/g, "") + "%";
                rows = await db.prepare("SELECT erp_code, name, spec, unit, qty FROM erp_stock_items WHERE icpno = ? AND (name LIKE ? OR erp_code LIKE ?) ORDER BY name LIMIT 30").all(ICPNO, like, like);
            } else if (crop) {
                const base = crop.split("-")[0];
                rows = await db.prepare("SELECT erp_code, name, spec, unit, qty FROM erp_stock_items WHERE icpno = ? AND name LIKE ? ORDER BY name LIMIT 30").all(ICPNO, "%" + base.replace(/[%_]/g, "").slice(0, 2) + "%");
                rows = (rows || []).filter((r) => (0, wholesale_trend_js_1.suggestCrops)(r.name, [{ name: crop }]).length);
            } else rows = [];
            const mapped = await db.prepare("SELECT erp_code, crop_name FROM market_crop_map WHERE icpno = ?").all(ICPNO);
            const mm = new Map((mapped || []).map((r) => [r.erp_code, r.crop_name]));
            res.json({ ok: true, items: (rows || []).map((r) => ({
                code: r.erp_code, name: r.name || "", spec: r.spec || "", unit: r.unit || "", qty: r.qty != null ? Number(r.qty) : null,
                kg: (0, wholesale_trend_js_1.parseKgPerUnit)(r.spec, r.unit), mappedTo: mm.get(r.erp_code) || null,
            })) });
        }
        catch (e) {
            console.error("[market] erp-search", e?.message || e);
            fail(res, 500, "搜尋失敗：" + safeErrDetail(e) + "。請重新整理再試。");
        }
    });

    router.post("/logistics/market/map", jsonBody, async (req, res) => {
        const crop = String(req.body?.crop || "").trim();
        const code = String(req.body?.code || "").trim();
        if (!crop || !code) return fail(res, 400, "缺北農品名或料號：請從搜尋結果點選要對照的貨品。");
        const k = parseKgInput(req.body?.kg);
        if (k.error) return fail(res, 400, k.error);
        try {
            const item = await db.prepare("SELECT erp_code FROM erp_stock_items WHERE icpno = ? AND erp_code = ?").get(ICPNO, code);
            if (!item) return fail(res, 400, `找不到松富料號 ${code}：請用搜尋框找貨品後點選，不要手打料號。`);
            if (!(await cropExists(db, crop))) return fail(res, 400, cropMissingMsg(crop));
            await inTx(db, (h) => upsertMapping(h, { crop, code, kg: k.kg, actor: req.adminUsername || "admin" }));
            res.json({ ok: true, mappings: (await loadMarketMappings(db))[crop] || [] });
        }
        catch (e) {
            console.error("[market] map", e?.message || e);
            fail(res, 500, "儲存對照失敗：" + safeErrDetail(e) + "。請重新整理再試一次。");
        }
    });

    router.post("/logistics/market/map/delete", jsonBody, async (req, res) => {
        const code = String(req.body?.code || "").trim();
        if (!code) return fail(res, 400, "缺料號：請重新整理頁面後再按刪除。");
        try {
            let crop = null;
            await inTx(db, async (h) => {
                const old = await h.prepare("SELECT crop_name, kg_per_unit FROM market_crop_map WHERE icpno = ? AND erp_code = ?").get(ICPNO, code);
                if (!old) return; // 已刪過＝冪等
                crop = old.crop_name;
                await h.prepare("DELETE FROM market_crop_map WHERE icpno = ? AND erp_code = ?").run(ICPNO, code);
                await (0, audit_js_1.writeAudit)(h, {
                    entityType: "market_crop_map", entityId: `${ICPNO}:${code}`, action: "delete", actor: req.adminUsername || "admin",
                    summary: `取消北農對照 ${code}（原 ${old.crop_name}）`, meta: { old: { crop: old.crop_name, kg: old.kg_per_unit }, new: null },
                });
            });
            res.json({ ok: true, mappings: crop ? ((await loadMarketMappings(db))[crop] || []) : [] });
        }
        catch (e) {
            console.error("[market] map delete", e?.message || e);
            fail(res, 500, "刪除對照失敗：" + safeErrDetail(e) + "。請重新整理再試一次。");
        }
    });

    router.post("/logistics/market/watch", jsonBody, async (req, res) => {
        const crop = String(req.body?.crop || "").trim().slice(0, 100);
        const on = req.body?.on === true || req.body?.on === "1";
        if (!crop) return fail(res, 400, "缺品名：請重新整理頁面後再點 ☆。");
        try {
            const actor = req.adminUsername || "admin";
            await inTx(db, async (h) => {
                const has = await h.prepare("SELECT crop_name FROM market_watch WHERE crop_name = ?").get(crop);
                if (on === !!has) return; // 已是目標狀態＝冪等
                if (on) await h.prepare("INSERT INTO market_watch (crop_name, created_by, created_at) VALUES (?, ?, ?)").run(crop, actor, nowIso());
                else await h.prepare("DELETE FROM market_watch WHERE crop_name = ?").run(crop);
                await (0, audit_js_1.writeAudit)(h, {
                    entityType: "market_watch", entityId: crop, action: on ? "create" : "delete", actor,
                    summary: (on ? "加入" : "移除") + `行情關注：${crop}`, meta: { old: !!has, new: on },
                });
            });
            res.json({ ok: true, on });
        }
        catch (e) {
            console.error("[market] watch", e?.message || e);
            fail(res, 500, "關注設定失敗：" + safeErrDetail(e) + "。請重新整理再試一次。");
        }
    });

    // ── 批次對照頁：常用料號（近一年 LINE 訂單出現次數）＋自動建議 ──
    router.get("/logistics/market/mapping", async (req, res) => {
        const showAll = req.query.all === "1";
        const latest = await (0, wholesale_snapshot_js_1.getLatestWholesaleSnapshotDate)(db);
        const cropRows = latest ? await db.prepare("SELECT crop_name, SUM(volume) AS vol FROM wholesale_market_snapshots WHERE record_date >= ? GROUP BY crop_name").all(isoDaysBefore(latest, 30)) : [];
        const crops = (cropRows || []).map((r) => ({ name: r.crop_name, volume: Number(r.vol) || 0 }));
        const cropSet = new Set(crops.map((c) => c.name));
        const items = await db.prepare("SELECT erp_code, name, spec, unit, qty FROM erp_stock_items WHERE icpno = ?").all(ICPNO);
        let usage = new Map();
        try {
            const u = await db.prepare(`SELECT p.erp_code, COUNT(*) AS n FROM order_items oi
              JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
              WHERE o.order_date >= ? AND p.erp_code IS NOT NULL GROUP BY p.erp_code`).all(isoDaysBefore(latest || new Date().toISOString().slice(0, 10), 365));
            usage = new Map((u || []).map((r) => [String(r.erp_code), Number(r.n) || 0]));
        } catch (e) { console.warn("[market] mapping usage", e?.message || e); }
        const maps = await loadMarketMappings(db);
        const mappedCode = new Map();
        for (const [crop, list] of Object.entries(maps)) for (const m of list) mappedCode.set(m.code, { crop, kg: m.kg });
        const rows = [];
        for (const it of items || []) {
            const sugg = (0, wholesale_trend_js_1.suggestCrops)(it.name, crops);
            const cur = mappedCode.get(it.erp_code);
            if (!cur && !sugg.length && !showAll) continue;
            rows.push({ ...it, sugg, cur, use: usage.get(it.erp_code) || 0, kg: (0, wholesale_trend_js_1.parseKgPerUnit)(it.spec, it.unit) });
        }
        rows.sort((a, b) => (!!a.cur - !!b.cur) || (b.use - a.use) || String(a.name).localeCompare(String(b.name)));
        const shown = rows.slice(0, 400);
        const cropOptions = crops.slice().sort((a, b) => b.volume - a.volume).map((c) => `<option value="${escapeAttr(c.name)}">`).join("");
        const tr = shown.map((r, i) => {
            const val = r.cur ? r.cur.crop : (r.sugg[0] || "");
            const kg = r.cur ? (r.cur.kg ?? "") : (r.kg ?? "");
            const stale = r.cur && !cropSet.has(r.cur.crop);
            return `<tr${r.cur ? ' class="mm-done"' : ""}>
              <td><input type="checkbox" name="pick" value="${i}"${!r.cur && r.sugg.length && r.use > 0 ? " checked" : ""}></td>
              <td><b>${escapeHtml(r.name || "")}</b><div class="mm-sub">${escapeHtml(r.erp_code)}・${escapeHtml(r.spec || "")} ${escapeHtml(r.unit || "")}</div><input type="hidden" name="code_${i}" value="${escapeAttr(r.erp_code)}"></td>
              <td class="mm-num">${r.use || "—"}</td>
              <td><input class="sf-input" name="crop_${i}" list="mmCrops" value="${escapeAttr(val)}" placeholder="輸入北農品名">${r.sugg.length > 1 ? `<div class="mm-sub">其他建議：${r.sugg.slice(1).map(escapeHtml).join("、")}</div>` : ""}${stale ? '<div class="mm-sub" style="color:var(--warn)">近 30 天北農沒有這個品名</div>' : ""}</td>
              <td><input class="sf-input" name="kg_${i}" value="${escapeAttr(String(kg))}" inputmode="decimal" style="width:80px" placeholder="公斤"></td>
              <td>${r.cur ? '<span class="mk-tag low">已對照</span>' : ""}</td></tr>`;
        }).join("");
        const msg = String(req.query.msg || "").slice(0, 300);
        const body = `
        <style>.mm-sub{font-size:11.5px;color:var(--txt-3);margin-top:2px}.mm-num{text-align:right;font-variant-numeric:tabular-nums}.mm-done td{opacity:.75}
        .mk-tag{display:inline-flex;font-size:11px;font-weight:600;padding:1px 7px;border-radius:99px}.mk-tag.low{background:var(--ok-soft);color:var(--ok)}
        .mm-bar{position:sticky;bottom:0;background:var(--notion-card,#fff);border-top:1px solid var(--line);padding:10px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap}</style>
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/logistics/market">北農行情</a> / 對照我們的貨品</div>
        <h1 class="notion-page-title">北農品名 ↔ 我們的貨品</h1>
        <p class="notion-hint">對照好之後，行情看板會顯示我們的庫存，並把北農「元/公斤」換算成「元/箱、元/把…」。
          這裡列出名稱對得上北農的松富料號，<b>近一年 LINE 訂單常出現的排在前面、已預先勾好</b>；建議的北農品名不對就直接改（可打字搜尋），
          「每單位公斤」從規格自動帶入（例如規格寫 18KG/箱 就帶 18），帶不出來的請補上，不知道可以留白（就只是不換算）。</p>
        ${msg ? `<p class="notion-msg ${msg.startsWith("✅") ? "ok" : "err"}">${escapeHtml(msg)}</p>` : ""}
        <p><a class="btn" href="/admin/logistics/market/mapping${showAll ? "" : "?all=1"}">${showAll ? "只看有建議的料號" : "顯示全部料號（含沒有建議的）"}</a>
          <span class="mm-sub">共 ${rows.length} 筆${rows.length > shown.length ? `，先顯示前 ${shown.length} 筆` : ""}</span></p>
        <form method="post" action="/admin/logistics/market/mapping">
          <datalist id="mmCrops">${cropOptions}</datalist>
          <div class="notion-card" style="padding:0;overflow-x:auto;">
            <table><thead><tr><th></th><th>我們的貨品</th><th style="text-align:right">近一年下單次數</th><th>北農品名</th><th>每單位公斤</th><th></th></tr></thead>
            <tbody>${tr || '<tr><td colspan="6" style="text-align:center;color:var(--txt-3);padding:24px">沒有可對照的料號（凌越庫存還沒推上來，或北農還沒有資料）</td></tr>'}</tbody></table>
          </div>
          <div class="mm-bar"><button type="submit" class="btn btn-primary">儲存勾選的對照</button><span class="mm-sub">只會存有打勾的列；北農品名留白的列會被略過。</span></div>
        </form>`;
        res.type("text/html").send(notionPage("北農對照", body, "logistics-reports", res));
    });

    router.post("/logistics/market/mapping", express_1.default.urlencoded({ extended: true, limit: "2mb" }), async (req, res) => {
        const picks = [].concat(req.body?.pick || []).map(String);
        const back = (m) => res.redirect("/admin/logistics/market/mapping?msg=" + encodeURIComponent(m));
        if (!picks.length) return back("沒有勾選任何一列：請勾選要儲存的列再按儲存。");
        const todo = [];
        for (const i of picks) {
            const code = String(req.body["code_" + i] || "").trim();
            const crop = String(req.body["crop_" + i] || "").trim();
            if (!code || !crop) continue;
            const k = parseKgInput(req.body["kg_" + i]);
            if (k.error) return back(`料號 ${code}：${k.error}`);
            todo.push({ code, crop, kg: k.kg });
        }
        if (!todo.length) return back("勾選的列都沒有填北農品名：請在「北農品名」欄填上再儲存。");
        try {
            let changed = 0;
            await inTx(db, async (h) => {
                for (const t of todo) {
                    const item = await h.prepare("SELECT erp_code FROM erp_stock_items WHERE icpno = ? AND erp_code = ?").get(ICPNO, t.code);
                    if (!item) throw new Error(`找不到松富料號 ${t.code}，請重新整理頁面再存`);
                    if (!(await cropExists(h, t.crop))) throw new Error(`料號 ${t.code}：` + cropMissingMsg(t.crop));
                    if (await upsertMapping(h, { ...t, actor: req.adminUsername || "admin" })) changed++;
                }
            });
            back(`✅ 已儲存 ${changed} 筆對照${todo.length > changed ? `（另 ${todo.length - changed} 筆沒有變動）` : ""}。`);
        }
        catch (e) {
            console.error("[market] mapping bulk", e?.message || e);
            back("儲存失敗，全部沒有存入：" + safeErrDetail(e));
        }
    });
}

function isoDaysBefore(iso, n) {
    return new Date(new Date(iso + "T00:00:00Z").getTime() - n * 86400000).toISOString().slice(0, 10);
}
