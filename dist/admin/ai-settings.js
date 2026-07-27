"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAiSettingsRoutes = registerAiSettingsRoutes;

// AI 設定域（Gemini 提示詞版本管理：檢視/設為線上/存新版/複製/A-B 設定；AI 學習範例列表與刪除）路由：
// 自 index.js 拆出（拆檔批次 8），純搬移、行為不變。

const express_1 = { default: require("express") };
const gemini_prompt_resolve_js_1 = require("../lib/gemini-prompt-resolve.js");
const id_js_1 = require("../lib/id.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerAiSettingsRoutes(router, ctx) {
    const { db, notionPage, logDataChange, fmtTaipeiYMDHM } = ctx;
    router.get("/gemini-prompts", async (req, res) => {
        await gemini_prompt_resolve_js_1.ensureSeedPromptVersions(db);
        const SK = gemini_prompt_resolve_js_1.SETTINGS_KEYS;
        async function gv(k) {
            const r = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k);
            return r?.value != null ? String(r.value).trim() : "";
        }
        const liveText = await gv(SK.KEY_TEXT_LIVE);
        const liveVision = await gv(SK.KEY_VISION_LIVE);
        const abTextId = await gv(SK.KEY_TEXT_AB);
        const abTextPct = (await gv(SK.KEY_TEXT_AB_PCT)) || "0";
        const abVisId = await gv(SK.KEY_VISION_AB);
        const abVisPct = (await gv(SK.KEY_VISION_AB_PCT)) || "0";
        let textRows = [];
        let visionRows = [];
        try {
            textRows = (await db.prepare("SELECT id, label, notes, updated_at FROM prompt_versions WHERE slot = 'text' ORDER BY updated_at DESC").all()) || [];
            visionRows = (await db.prepare("SELECT id, label, notes, updated_at FROM prompt_versions WHERE slot = 'vision' ORDER BY updated_at DESC").all()) || [];
        }
        catch (e) {
            console.error("[admin] gemini-prompts list", e);
        }
        const editId = typeof req.query.edit === "string" ? req.query.edit.trim() : "";
        let editRow = null;
        if (editId) {
            editRow = await db.prepare("SELECT id, slot, label, body, notes FROM prompt_versions WHERE id = ?").get(editId);
        }
        const msg = req.query.ok === "1" ? "<p class=\"notion-msg ok\">已儲存。</p>"
            : req.query.ok === "live" ? "<p class=\"notion-msg ok\">已更新線上版本。</p>"
                : req.query.ok === "dup" ? "<p class=\"notion-msg ok\">已複製新版本。</p>"
                    : req.query.ok === "ab" ? "<p class=\"notion-msg ok\">已更新 A/B 設定（快取已清除）。</p>"
                        : "";
        const err = req.query.err === "1" ? "<p class=\"notion-msg err\">操作失敗。</p>" : "";
        const rowHtml = (rows, liveId, slot) => (rows || []).map((r) => {
            const isLive = r.id === liveId;
            return `<tr><td><code style="font-size:11px;">${escapeHtml(r.id)}</code></td><td>${escapeHtml(r.label || "")}</td><td>${escapeHtml(String(r.updated_at || "—"))}</td><td>${isLive ? "<strong>線上</strong>" : "—"}</td><td style="white-space:normal;"><a href="/admin/gemini-prompts?edit=${encodeURIComponent(r.id)}" class="btn">編輯</a> <form method="post" action="/admin/gemini-prompts/set-live" style="display:inline;"><input type="hidden" name="slot" value="${escapeAttr(slot)}"><input type="hidden" name="version_id" value="${escapeAttr(r.id)}"><button type="submit" class="btn">設為線上</button></form> <form method="post" action="/admin/gemini-prompts/duplicate" style="display:inline;" onsubmit="return confirm('複製此版本為新草稿？');"><input type="hidden" name="slot" value="${escapeAttr(slot)}"><input type="hidden" name="from_id" value="${escapeAttr(r.id)}"><button type="submit" class="btn">複製新建</button></form></td></tr>`;
        }).join("");
        const editForm = editRow ? `
        <div class="notion-card" style="margin-top:16px;">
          <h2 style="margin-top:0;">編輯版本</h2>
          <form method="post" action="/admin/gemini-prompts/save-version">
            <input type="hidden" name="id" value="${escapeAttr(editRow.id)}">
            <label>標籤 <input type="text" name="label" value="${escapeAttr(editRow.label || "")}" style="width:100%;max-width:420px;"></label>
            <label style="display:block;margin-top:12px;">備註 <input type="text" name="notes" value="${escapeAttr(editRow.notes || "")}" style="width:100%;max-width:520px;"></label>
            <label style="display:block;margin-top:12px;">System instruction 全文<br><textarea name="body" rows="24" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.45;">${escapeHtml(editRow.body || "")}</textarea></label>
            <p><button type="submit" class="btn btn-primary">儲存</button> <a href="/admin/gemini-prompts" class="btn">取消</a></p>
          </form>
        </div>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / Gemini Prompt 版本</div>
        <h1 class="notion-page-title">Gemini Prompt 版本與 A/B</h1>
        <p class="notion-hint" style="margin-top:0;">文字叫貨與圖像 vision 使用<strong>不同 slot</strong>；均不含子客戶／歷史品項小抄（執行時會自動附加）。儲存或設為線上後會清除快取。配合辨識成效儀表之 <code>gemini_usage_log.prompt_version_id</code> 可比對不同版本。</p>
        ${msg}${err}
        <div class="notion-card">
          <h2 style="margin-top:0;">A/B 分流（可選）</h2>
          <p class="notion-hint">將<strong>對照版本（B）</strong>依百分比隨機套用。設 B 為空或 0% 則永遠使用線上版。</p>
          <form method="post" action="/admin/gemini-prompts/ab-settings">
            <fieldset style="border:1px solid var(--notion-border);border-radius:8px;padding:12px;margin-bottom:12px;">
              <legend><strong>純文字（text）</strong></legend>
              <label>B 版本（對照）
                <select name="text_ab_id" style="display:block;margin-top:6px;max-width:100%;">
                  <option value="">— 未啟用 B —</option>
                  ${textRows.map((r) => `<option value="${escapeAttr(r.id)}" ${r.id === abTextId ? "selected" : ""}>${escapeHtml(r.label)} (${escapeHtml(r.id)})</option>`).join("")}
                </select>
              </label>
              <label style="display:block;margin-top:10px;">B 分流百分比（0–100）<input type="number" name="text_ab_pct" min="0" max="100" value="${escapeAttr(abTextPct)}" style="width:100px;"></label>
            </fieldset>
            <fieldset style="border:1px solid var(--notion-border);border-radius:8px;padding:12px;margin-bottom:12px;">
              <legend><strong>圖像／視覺（vision）</strong></legend>
              <label>B 版本（對照）
                <select name="vision_ab_id" style="display:block;margin-top:6px;max-width:100%;">
                  <option value="">— 未啟用 B —</option>
                  ${visionRows.map((r) => `<option value="${escapeAttr(r.id)}" ${r.id === abVisId ? "selected" : ""}>${escapeHtml(r.label)} (${escapeHtml(r.id)})</option>`).join("")}
                </select>
              </label>
              <label style="display:block;margin-top:10px;">B 分流百分比（0–100）<input type="number" name="vision_ab_pct" min="0" max="100" value="${escapeAttr(abVisPct)}" style="width:100px;"></label>
            </fieldset>
            <button type="submit" class="btn btn-primary">儲存 A/B 設定</button>
          </form>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">文字 Prompt 版本</h2>
          <p class="notion-hint">線上：<code>${escapeHtml(liveText || "—")}</code></p>
          <div class="table-scroll-mobile"><table style="font-size:13px;width:100%;"><thead><tr><th>ID</th><th>標籤</th><th>更新</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rowHtml(textRows, liveText, "text") || "<tr><td colspan=\"5\">尚無資料</td></tr>"}</tbody></table></div>
        </div>
        <div class="notion-card">
          <h2 style="margin-top:0;">圖像 Prompt 版本</h2>
          <p class="notion-hint">線上：<code>${escapeHtml(liveVision || "—")}</code></p>
          <div class="table-scroll-mobile"><table style="font-size:13px;width:100%;"><thead><tr><th>ID</th><th>標籤</th><th>更新</th><th>狀態</th><th>操作</th></tr></thead><tbody>${rowHtml(visionRows, liveVision, "vision") || "<tr><td colspan=\"5\">尚無資料</td></tr>"}</tbody></table></div>
        </div>
        ${editForm}
      `;
        res.type("text/html").send(notionPage("Gemini Prompt 版本", body, "gemini-prompts", res));
    });
    router.post("/gemini-prompts/set-live", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const slot = String(req.body.slot || "").trim();
            const vid = String(req.body.version_id || "").trim();
            if ((slot !== "text" && slot !== "vision") || !vid) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const row = await db.prepare("SELECT id, slot FROM prompt_versions WHERE id = ?").get(vid);
            if (!row || row.slot !== slot) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const SK = gemini_prompt_resolve_js_1.SETTINGS_KEYS;
            const key = slot === "vision" ? SK.KEY_VISION_LIVE : SK.KEY_TEXT_LIVE;
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(key, vid);
            gemini_prompt_resolve_js_1.invalidatePromptCache();
            res.redirect("/admin/gemini-prompts?ok=live");
        }
        catch (_e) {
            res.redirect("/admin/gemini-prompts?err=1");
        }
    });
    router.post("/gemini-prompts/save-version", express_1.default.urlencoded({ extended: true, limit: "4mb" }), async (req, res) => {
        try {
            const id = String(req.body.id || "").trim();
            const label = String(req.body.label || "").trim() || "未命名";
            const notes = String(req.body.notes || "").trim() || null;
            const body = String(req.body.body ?? "");
            if (!id) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            await db.prepare(`UPDATE prompt_versions SET label = ?, notes = ?, body = ?, updated_at = ${nowSql} WHERE id = ?`).run(label, notes, body, id);
            gemini_prompt_resolve_js_1.invalidatePromptCache();
            res.redirect("/admin/gemini-prompts?edit=" + encodeURIComponent(id) + "&ok=1");
        }
        catch (_e) {
            res.redirect("/admin/gemini-prompts?err=1");
        }
    });
    router.post("/gemini-prompts/duplicate", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const slot = String(req.body.slot || "").trim();
            const fromId = String(req.body.from_id || "").trim();
            if ((slot !== "text" && slot !== "vision") || !fromId) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const src = await db.prepare("SELECT body, label FROM prompt_versions WHERE id = ? AND slot = ?").get(fromId, slot);
            if (!src) {
                res.redirect("/admin/gemini-prompts?err=1");
                return;
            }
            const newId = (0, id_js_1.newId)("pvp");
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            const newLabel = (src.label || "") + "（複製）";
            await db.prepare(`INSERT INTO prompt_versions (id, slot, label, body, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ${nowSql}, ${nowSql})`).run(newId, slot, newLabel, src.body, "由複製建立");
            gemini_prompt_resolve_js_1.invalidatePromptCache();
            res.redirect("/admin/gemini-prompts?edit=" + encodeURIComponent(newId) + "&ok=dup");
        }
        catch (_e) {
            res.redirect("/admin/gemini-prompts?err=1");
        }
    });
    router.post("/gemini-prompts/ab-settings", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        try {
            const SK = gemini_prompt_resolve_js_1.SETTINGS_KEYS;
            const ta = String(req.body.text_ab_id || "").trim();
            const tp = String(Math.min(100, Math.max(0, parseInt(String(req.body.text_ab_pct || "0"), 10) || 0)));
            const va = String(req.body.vision_ab_id || "").trim();
            const vp = String(Math.min(100, Math.max(0, parseInt(String(req.body.vision_ab_pct || "0"), 10) || 0)));
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(SK.KEY_TEXT_AB, ta);
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(SK.KEY_TEXT_AB_PCT, tp);
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(SK.KEY_VISION_AB, va);
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(SK.KEY_VISION_AB_PCT, vp);
            gemini_prompt_resolve_js_1.invalidatePromptCache();
            res.redirect("/admin/gemini-prompts?ok=ab");
        }
        catch (_e) {
            res.redirect("/admin/gemini-prompts?err=1");
        }
    });

    /** AI Few-Shot 範例庫：列表（僅 is_active = 1） */
    router.get("/ai-examples", async (req, res) => {
        const okMsg = req.query.ok === "deleted" ? "<p class=\"notion-msg ok\">已停用該筆學習範本。</p>" : "";
        let rows = [];
        try {
            rows = await db
                .prepare(`SELECT e.id, e.customer_id, e.order_id, e.parsed_json, e.created_at, e.image_path, e.quality_score, e.note,
        COALESCE(NULLIF(TRIM(COALESCE(c.name, '')), ''), '（未知客戶）') AS customer_name
     FROM customer_order_image_examples e
     LEFT JOIN customers c ON c.id = e.customer_id
     WHERE COALESCE(e.is_active, 1) = 1
     ORDER BY e.created_at DESC`)
                .all();
            console.log("撈到的範例筆數:", Array.isArray(rows) ? rows.length : 0);
        }
        catch (e) {
            console.error("[Load Examples Error]", e);
            rows = [];
        }
        const previewParsed = (raw) => {
            const s = String(raw || "").trim();
            if (!s)
                return "—";
            const one = s.replace(/\s+/g, " ");
            const max = 320;
            return (one.length > max ? one.slice(0, max) + "…" : one);
        };
        // 按客戶 group 統計
        const byCust = new Map();
        for (const r of rows) {
            const cn = r.customer_name || "—";
            if (!byCust.has(cn)) byCust.set(cn, 0);
            byCust.set(cn, byCust.get(cn) + 1);
        }
        const tableRows = (rows || [])
            .map((r) => {
            const oid = r.order_id || "";
            const oidDisp = oid ? `<a href="/admin/orders/${encodeURIComponent(oid)}" class="mono" style="font-size:11px;">${escapeHtml(oid.slice(0,12))}</a>` : `<span style="color:var(--txt-3);">—</span>`;
            const created = r.created_at != null ? escapeHtml(String(r.created_at).slice(0,16).replace("T"," ")) : "—";
            const noteCell = r.note && String(r.note).trim() ? escapeHtml(String(r.note).trim()) : `<span style="color:var(--txt-3);">—</span>`;
            const qs = r.quality_score != null ? Number(r.quality_score) : null;
            const qsHtml = qs != null
                ? `<span class="sf-pill ${qs>=80?"ok":qs>=50?"warn":"bad"}" style="font-size:10px;">${qs}</span>`
                : `<span style="color:var(--txt-3);">—</span>`;
            return `<tr data-example-id="${escapeAttr(r.id)}">
            <td><code class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml(r.id.slice(0,10))}</code></td>
            <td><span style="font-weight:500;">${escapeHtml(r.customer_name || "—")}</span></td>
            <td>${oidDisp}</td>
            <td class="mono" style="font-size:11px;color:var(--txt-3);white-space:nowrap;">${created}</td>
            <td style="text-align:right;">${qsHtml}</td>
            <td style="max-width:380px;"><pre style="margin:0;font-size:11px;line-height:1.4;color:var(--txt-2);white-space:pre-wrap;word-break:break-all;font-family:var(--font-mono);max-height:60px;overflow:hidden;">${escapeHtml(previewParsed(r.parsed_json))}</pre></td>
            <td style="font-size:11px;color:var(--txt-3);max-width:140px;word-break:break-all;">${escapeHtml(String(r.image_path || "").slice(0, 60))}${String(r.image_path || "").length > 60 ? "…" : ""}</td>
            <td style="font-size:12px;">${noteCell}</td>
            <td><button type="button" class="sf-btn sm danger ai-example-del" data-id="${escapeAttr(r.id)}">${SF_ICONS.x}<span>停用</span></button></td>
          </tr>`;
        })
            .join("");
        const statCard = (label, num, sub, status) => `
          <div style="padding:14px 16px;background:var(--bg-1);border:var(--hairline);border-radius:var(--radius-md);${status?`border-left:3px solid var(--${status});padding-left:14px;`:""}flex:1;min-width:160px;">
            <div style="font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${label}</div>
            <div class="mono" style="font-size:22px;font-weight:600;letter-spacing:-0.02em;">${num}</div>
            ${sub?`<div style="font-size:11px;color:var(--txt-3);margin-top:4px;">${sub}</div>`:""}
          </div>`;
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div>
            <div class="sf-breadcrumb" style="margin-bottom:6px;">主檔管理 / AI 學習庫</div>
            <h1 style="margin:0;font-size:22px;font-weight:600;">AI 學習庫管理</h1>
            <p style="margin-top:4px;color:var(--txt-3);font-size:12px;">客戶訂單圖 Few-Shot 範例（<code class="mono" style="font-size:11px;">customer_order_image_examples</code>）。每筆範例會在該客戶下次傳訂單圖時，作為示範資料丟給 Gemini Vision，幫助辨識手寫筆跡與品名習慣。停用後資料仍保留，只是不再用於辨識。</p>
          </div>
          ${okMsg ? `<div class="sf-pill ok" style="align-self:flex-start;">${okMsg.replace(/<[^>]*>/g,"")}</div>` : ""}
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            ${statCard("啟用中範例", rows.length, "目前供 AI 辨識使用", "accent")}
            ${statCard("涵蓋客戶", byCust.size + " 戶", "有 Few-Shot 範例的客戶", "ok")}
            ${statCard("平均/客戶", (rows.length && byCust.size) ? (rows.length/byCust.size).toFixed(1) : "—", "範例數 / 客戶數", "info")}
          </div>
          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.spark} 全部啟用中的學習範例</div>
              <span class="sf-card-sub">${rows.length} 筆</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th>範本 ID</th>
                    <th>客戶</th>
                    <th>來源訂單</th>
                    <th>建立時間</th>
                    <th style="text-align:right;">品質分</th>
                    <th>JSON 預覽</th>
                    <th>圖片路徑</th>
                    <th>備註</th>
                    <th style="width:90px;"></th>
                  </tr>
                </thead>
                <tbody>${tableRows || `<tr><td colspan='9' style='padding:24px;text-align:center;color:var(--txt-3);'>尚無啟用中的範例。可在訂單明細頁點「儲存為 AI 學習範例」加入。</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </div>
        <script>
        (function(){
          document.querySelectorAll(".ai-example-del").forEach(function(btn){
            btn.addEventListener("click", function(){
              var id = btn.getAttribute("data-id");
              if (!id || !confirm("確定要停用此筆 AI 學習範本？\\n（可維護資料品質，停用後不再用於辨識）")) return;
              btn.disabled = true;
              fetch("/admin/api/ai-examples/" + encodeURIComponent(id) + "/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                credentials: "same-origin",
                body: "{}"
              }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
              .then(function(x){
                if (x.j && x.j.ok) {
                  window.location.href = "/admin/ai-examples?ok=deleted";
                  return;
                }
                alert((x.j && x.j.error) ? x.j.error : "停用失敗");
                btn.disabled = false;
              })
              .catch(function(){ alert("網路錯誤"); btn.disabled = false; });
            });
          });
        })();
        </script>`;
        res.type("text/html").send(notionPage("AI 學習庫管理", body, "ai-examples", res));
    });
    /** 停用 Few-Shot 範例（is_active = 0） */
    router.post("/api/ai-examples/:id/delete", express_1.default.json(), async (req, res) => {
        const exampleId = String(req.params.id || "").trim();
        if (!exampleId) {
            res.status(400).json({ ok: false, error: "缺少範本 id" });
            return;
        }
        try {
            const row = await db.prepare("SELECT id FROM customer_order_image_examples WHERE id = ? AND is_active = 1").get(exampleId);
            if (!row) {
                res.status(404).json({ ok: false, error: "找不到此範本或已停用" });
                return;
            }
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            await db.prepare(`UPDATE customer_order_image_examples SET is_active = 0, updated_at = ${nowSql} WHERE id = ?`).run(exampleId);
            res.json({ ok: true });
        }
        catch (e) {
            console.error("[admin] ai-examples delete", e?.message || e);
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 400) });
        }
    });
}
