"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProductsRoutes = registerProductsRoutes;

// 貨品域（貨品主檔／凌越比對對齊／別名／規格／箱入數）路由：自 index.js 拆出（拆檔批次 4），純搬移、行為不變。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const erp_companies_js_1 = require("../lib/erp-companies.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerProductsRoutes(router, ctx) {
    const { db, notionPage, logDataChange, requireManager, safeAdminReturnPath, appendQueryToAdminPath, productEditEmbedQuery, computeDerivedKgByUnit, notionEmbedPage, autoConvertOrderItemsToKg, normalizeLineUnitRules, loadLineUnitRulesObject, saveLineUnitRulesObject, ORDER_LINE_UNITS } = ctx;
    // ── 貨品主檔 ↔ 凌越 比對＋對齊（比對唯讀；三個對齊動作＝經理限定、冪等可重跑、交易分批、寫稽核、絕不刪資料）──
    const RECON_KG_FAMILY = new Set(["公斤", "kg", "㎏"]);
    function reconNorm(s) { return String(s == null ? "" : s).replace(/\s/g, "").toLowerCase(); }
    function reconIsKg(u) { return RECON_KG_FAMILY.has(reconNorm(u)); }
    async function computeProductReconcile() {
        const prods = (await db.prepare("SELECT id, name, erp_code, unit FROM products WHERE active = 1").all()) || [];
        // 回填判斷要對「全部 products(含停用)」查重，避免回填撞到停用品項的料號
        const allCodeRows = (await db.prepare("SELECT erp_code FROM products WHERE erp_code IS NOT NULL AND TRIM(erp_code) <> ''").all()) || [];
        const allCodes = new Set(allCodeRows.map((r) => String(r.erp_code).trim()));
        const erpRows = (await db.prepare("SELECT erp_code, name, unit, icpno FROM erp_stock_items").all()) || [];
        const erpByCode = {};
        for (const r of erpRows) {
            const c = String(r.erp_code || "").trim();
            if (!c) continue;
            (erpByCode[c] = erpByCode[c] || []).push({ name: String(r.name || ""), unit: String(r.unit || ""), icpno: (0, erp_companies_js_1.normIcpno)(r.icpno) });
        }
        for (const c of Object.keys(erpByCode)) erpByCode[c].sort((a, b) => (a.icpno < b.icpno ? -1 : 1));
        const nameDiff = [], unitDiff = [], unitDiffKgExcluded = [], orphan = [], noCode = [];
        for (const p of prods) {
            const code = String(p.erp_code || "").trim();
            if (!code) { noCode.push(p); continue; }
            const erp = erpByCode[code];
            if (!erp || !erp.length) { orphan.push(p); continue; }
            const e = erp.find((x) => String(x.name || "").trim()) || erp[0];
            if (reconNorm(p.name) && reconNorm(e.name) && reconNorm(p.name) !== reconNorm(e.name)) nameDiff.push({ p, e, cos: erp.map((x) => x.icpno) });
            const eu = String((erp.find((x) => String(x.unit || "").trim()) || erp[0]).unit || "");
            if (reconNorm(p.unit) && reconNorm(eu) && reconNorm(p.unit) !== reconNorm(eu)) {
                // 公斤↔KG 同義對＝排除不動（公斤自動換算功能認 products.unit==='公斤'，動了會壞）
                if (reconIsKg(p.unit) && reconIsKg(eu)) unitDiffKgExcluded.push({ p, eu });
                else unitDiff.push({ p, eu, kgLoss: reconIsKg(p.unit) && !reconIsKg(eu) });
            }
        }
        const erpMissing = {};
        for (const code of Object.keys(erpByCode)) {
            if (allCodes.has(code)) continue;
            for (const e of erpByCode[code]) { (erpMissing[e.icpno] = erpMissing[e.icpno] || []).push({ code, name: e.name, unit: e.unit }); }
        }
        return { prods, erpByCode, nameDiff, unitDiff, unitDiffKgExcluded, orphan, noCode, erpMissing };
    }
    // 動作 C：凌越有、主檔沒有 → 回填（只 INSERT、絕不動既有列；重跑第二次＝0 新增）
    router.post("/products/reconcile/backfill", express_1.default.json({ limit: "64kb" }), requireManager, async (req, res) => {
        try {
            const r = await computeProductReconcile();
            const byCode = new Map();
            for (const ic of Object.keys(r.erpMissing).sort()) {
                for (const e of r.erpMissing[ic]) {
                    const cur = byCode.get(e.code);
                    if (!cur) byCode.set(e.code, { code: e.code, name: String(e.name || "").trim(), unit: String(e.unit || "").trim() });
                    else { if (!cur.name && e.name) cur.name = String(e.name).trim(); if (!cur.unit && e.unit) cur.unit = String(e.unit).trim(); }
                }
            }
            const list = Array.from(byCode.values());
            const now = new Date().toISOString();
            let inserted = 0, skipped = 0;
            for (let i = 0; i < list.length; i += 100) {
                const chunk = list.slice(i, i + 100);
                await db.transaction(async (tx) => {
                    const ph = chunk.map(() => "?").join(",");
                    const exist = await tx.prepare(`SELECT erp_code FROM products WHERE erp_code IN (${ph})`).all(...chunk.map((x) => x.code));
                    const has = new Set((exist || []).map((x) => String(x.erp_code).trim()));
                    for (const it of chunk) {
                        if (has.has(it.code)) { skipped++; continue; }
                        await tx.prepare("INSERT INTO products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES (?, ?, ?, NULL, ?, 1, ?)")
                            .run((0, id_js_1.newId)("prod"), it.name || it.code, it.code, it.unit || null, now);
                        inserted++;
                    }
                });
            }
            await logDataChange(req, { entityType: "product", entityId: "reconcile", action: "backfill_from_lingyue", summary: `凌越回填主檔：新增 ${inserted} 品項（跳過已存在 ${skipped}）`, meta: { inserted, skipped, sample: list.slice(0, 50).map((x) => x.code) } });
            res.json({ ok: true, inserted, skipped });
        } catch (e) { console.error("[admin] reconcile backfill", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 300) }); }
    });
    // 動作 A：名稱改成凌越名（舊名自動保留為全域別名 product_aliases → LINE 打舊名照樣認得；冪等）
    router.post("/products/reconcile/align-names", express_1.default.json({ limit: "64kb" }), requireManager, async (req, res) => {
        try {
            const r = await computeProductReconcile();
            const now = new Date().toISOString();
            let renamed = 0, aliasAdded = 0, aliasSkipped = 0;
            const items = r.nameDiff.filter(({ p, e }) => String(e.name || "").trim() && reconNorm(e.name) !== reconNorm(p.name));
            for (let i = 0; i < items.length; i += 100) {
                const chunk = items.slice(i, i + 100);
                await db.transaction(async (tx) => {
                    for (const { p, e } of chunk) {
                        const newName = String(e.name).trim();
                        const oldName = String(p.name || "").trim();
                        await tx.prepare("UPDATE products SET name = ?, updated_at = ? WHERE id = ?").run(newName, now, p.id);
                        renamed++;
                        // 舊名→全域別名：僅在該別名尚不存在時新增（已存在＝別碰，避免搶走既有對照）
                        if (oldName) {
                            const exists = await tx.prepare("SELECT id FROM product_aliases WHERE alias = ?").get(oldName);
                            if (!exists) { await tx.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run((0, id_js_1.newId)("pa"), p.id, oldName); aliasAdded++; }
                            else aliasSkipped++;
                        }
                    }
                });
                for (const { p, e } of chunk) {
                    await logDataChange(req, { entityType: "product", entityId: p.id, productId: p.id, action: "align_name_lingyue", summary: `品名對齊凌越：「${String(p.name || "")}」→「${String(e.name).trim()}」（舊名保留為別名）`, meta: { erp_code: p.erp_code, old: p.name, next: String(e.name).trim() } });
                }
            }
            res.json({ ok: true, renamed, aliasAdded, aliasSkipped });
        } catch (e) { console.error("[admin] reconcile align-names", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 300) }); }
    });
    // 動作 B：單位改成凌越（公斤↔KG 同義對排除不動；product_unit_specs 以「叫貨單位」為鍵、與主檔單位無關，經查不需遷移；冪等）
    router.post("/products/reconcile/align-units", express_1.default.json({ limit: "64kb" }), requireManager, async (req, res) => {
        try {
            const r = await computeProductReconcile();
            const now = new Date().toISOString();
            let changed = 0, kgLossCount = 0;
            const items = r.unitDiff.filter(({ eu }) => String(eu || "").trim());
            for (let i = 0; i < items.length; i += 100) {
                const chunk = items.slice(i, i + 100);
                await db.transaction(async (tx) => {
                    for (const { p, eu } of chunk) {
                        await tx.prepare("UPDATE products SET unit = ?, updated_at = ? WHERE id = ?").run(String(eu).trim(), now, p.id);
                        changed++;
                    }
                });
                for (const { p, eu, kgLoss } of chunk) {
                    if (kgLoss) kgLossCount++;
                    await logDataChange(req, { entityType: "product", entityId: p.id, productId: p.id, action: "align_unit_lingyue", summary: `單位對齊凌越：「${String(p.unit || "")}」→「${String(eu).trim()}」${kgLoss ? "（原公斤計價，此品項的自動換算公斤停用）" : ""}`, meta: { erp_code: p.erp_code, old: p.unit, next: String(eu).trim() } });
                }
            }
            res.json({ ok: true, changed, kgLossCount });
        } catch (e) { console.error("[admin] reconcile align-units", e?.message || e); res.status(500).json({ error: String(e?.message || e).slice(0, 300) }); }
    });
    router.get("/products/reconcile", async (req, res) => {
        try {
            const r = await computeProductReconcile();
            const { prods, erpByCode, nameDiff, unitDiff, unitDiffKgExcluded, orphan, noCode, erpMissing } = r;
            const erpCodeTotal = Object.keys(erpByCode).length;
            const missingTotal = (() => { const s = new Set(); for (const ic of Object.keys(erpMissing)) for (const e of erpMissing[ic]) s.add(e.code); return s.size; })();
            const coName = (ic) => (0, erp_companies_js_1.erpCompanyName)(ic);
            const card = (title, hint, count, tone) => `<div class="sf-card" style="flex:1;min-width:150px;"><div style="font-size:12px;color:var(--txt-3);">${escapeHtml(title)}</div><div style="font-size:26px;font-weight:700;color:${tone};font-variant-numeric:tabular-nums;">${count}</div><div style="font-size:11px;color:var(--txt-3);margin-top:2px;">${escapeHtml(hint)}</div></div>`;
            const tbl = (headers, rows) => `<div class="notion-card" style="padding:0;overflow-x:auto;margin-top:8px;"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--txt-3);padding:18px;">無</td></tr>`}</tbody></table></div>`;
            const CAP = 300;
            const orphanRows = orphan.slice(0, CAP).map((p) => `<tr><td>${escapeHtml(p.name)}</td><td style="font-variant-numeric:tabular-nums;">${escapeHtml(String(p.erp_code || ""))}</td><td>${escapeHtml(p.unit || "")}</td></tr>`).join("");
            const nameRows = nameDiff.slice(0, CAP).map((x) => `<tr><td style="font-variant-numeric:tabular-nums;">${escapeHtml(String(x.p.erp_code))}</td><td>${escapeHtml(x.p.name)}</td><td style="color:#2383e2;">${escapeHtml(x.e.name)}</td><td style="font-size:11px;color:var(--txt-3);">${x.cos.map(coName).join("／")}</td></tr>`).join("");
            const unitRows = unitDiff.slice(0, CAP).map((x) => `<tr><td style="font-variant-numeric:tabular-nums;">${escapeHtml(String(x.p.erp_code))}</td><td>${escapeHtml(x.p.name)}</td><td>${escapeHtml(x.p.unit || "—")}</td><td style="color:#2383e2;">${escapeHtml(x.eu || "—")}</td><td>${x.kgLoss ? '<span style="font-size:11px;font-weight:700;color:#b3261e;">原公斤計價，改後自動換算停用</span>' : ""}</td></tr>`).join("");
            const noCodeRows = noCode.slice(0, CAP).map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.unit || "")}</td></tr>`).join("");
            const missingSections = Object.keys(erpMissing).sort().map((ic) => {
                const list = erpMissing[ic];
                const rows = list.slice(0, CAP).map((e) => `<tr><td style="font-variant-numeric:tabular-nums;">${escapeHtml(e.code)}</td><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.unit || "")}</td></tr>`).join("");
                return `<h3 style="margin:16px 0 4px;font-size:14px;">${escapeHtml(coName(ic))}(${ic})：凌越有、主檔沒有 <b>${list.length}</b> 項${list.length > CAP ? `（僅顯示前 ${CAP}）` : ""}</h3>${tbl(["料號", "凌越品名", "單位"], rows)}`;
            }).join("");
            const noErp = erpCodeTotal === 0;
            const kgLossN = unitDiff.filter((x) => x.kgLoss).length;
            const actBtn = (id, label, tone) => `<button type="button" id="${id}" class="btn ${tone === "primary" ? "btn-primary" : ""}" style="margin:6px 0 0;">${escapeHtml(label)}</button> <span id="${id}Msg" style="font-size:12px;color:var(--txt-3);margin-left:8px;"></span>`;
            const body = `
      <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">貨品管理</a> / 凌越比對</div>
      <h1 class="notion-page-title">貨品主檔 ↔ 凌越 比對與對齊</h1>
      <p class="notion-hint" style="margin:-2px 0 14px;">用<b>料號(erp_code)</b>比對「貨品管理」與「凌越推送的庫存」。報告即預覽；下方各段的「執行」按鈕（僅經理）會依畫面上列出的清單套用變更——<b>絕不刪資料、絕不覆蓋你填過的別名/寺岡碼/換算設定</b>，全部寫入稽核軌跡，可重複執行（第二次＝0 變動）。凌越端資料時間依最後一次庫存推送。</p>
      ${noErp ? `<div class="sf-pill bad" style="align-self:flex-start;">凌越庫存快照目前是空的——請先讓內網代理推一次庫存(00,01,02,03)，再回來比對。</div>` : ""}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
        ${card("主檔品項", "貨品管理 active", prods.length, "var(--txt)")}
        ${card("凌越料號", "推送庫存(去重)", erpCodeTotal, "var(--txt)")}
        ${card("孤兒料號", "主檔有、凌越查無", orphan.length, orphan.length ? "#b3261e" : "#1f9d57")}
        ${card("沒填料號", "無法對應凌越", noCode.length, noCode.length ? "#b9791b" : "#1f9d57")}
        ${card("名稱不一致", "將改為凌越名", nameDiff.length, nameDiff.length ? "#b9791b" : "#1f9d57")}
        ${card("單位不一致", "公斤↔KG 已排除", unitDiff.length, unitDiff.length ? "#b9791b" : "#1f9d57")}
        ${card("待回填", "凌越有、主檔沒有", missingTotal, missingTotal ? "#b9791b" : "#1f9d57")}
      </div>
      <p class="notion-hint" style="margin:0 0 6px;">建議執行順序：<b>⑤回填 → ②改名 → ③改單位</b>。</p>

      <h2 style="margin:18px 0 2px;font-size:16px;">① 孤兒：主檔有料號、凌越查無 <span style="font-size:12px;color:var(--txt-3);">(${orphan.length})</span></h2>
      <p class="notion-hint" style="margin:2px 0;">料號可能<b>填錯</b>、該品項在凌越<b>已停用</b>、或<b>該公司還沒推</b>庫存。這類要逐項人工核對，不提供一鍵處理。</p>
      ${tbl(["主檔品名", "料號", "單位"], orphanRows)}${orphan.length > CAP ? `<p class="notion-hint">…共 ${orphan.length} 筆，僅顯示前 ${CAP}。</p>` : ""}

      <h2 style="margin:18px 0 2px;font-size:16px;">② 名稱不一致 → 改成凌越名 <span style="font-size:12px;color:var(--txt-3);">(${nameDiff.length})</span></h2>
      <p class="notion-hint" style="margin:2px 0;">名稱權威＝凌越。執行時<b>舊主檔名會自動保留為全域別名</b>——LINE 打舊名照樣認得、你設過的俗名對照（以品項 ID 連結）完全不受影響。</p>
      ${nameDiff.length ? actBtn("btnAlignNames", `執行：${nameDiff.length} 項改成凌越名（舊名轉別名）`, "primary") : ""}
      ${tbl(["料號", "主檔品名（將成為別名）", "凌越品名（新名稱）", "公司"], nameRows)}

      <h2 style="margin:18px 0 2px;font-size:16px;">③ 單位不一致 → 改成凌越單位 <span style="font-size:12px;color:var(--txt-3);">(${unitDiff.length}${unitDiffKgExcluded.length ? `，另有 ${unitDiffKgExcluded.length} 筆「公斤↔KG」已排除不動` : ""})</span></h2>
      <p class="notion-hint" style="margin:2px 0;">數量單位以凌越為準；<b>公斤↔KG 同義差異不在此列、不會被改</b>（公斤自動換算功能不受影響）。換算規格表以「叫貨單位」為鍵，改主檔單位不影響既有換算設定。${kgLossN ? `<b style="color:#b3261e;">注意：${kgLossN} 筆原為「公斤」計價、凌越是其他單位——改後這些品項的自動換算公斤會停用（清單有標示）。</b>` : ""}</p>
      ${unitDiff.length ? actBtn("btnAlignUnits", `執行：${unitDiff.length} 項改成凌越單位`, "primary") : ""}
      ${tbl(["料號", "品名", "主檔單位", "凌越單位", "備註"], unitRows)}

      <h2 style="margin:18px 0 2px;font-size:16px;">④ 主檔沒填料號 <span style="font-size:12px;color:var(--txt-3);">(${noCode.length})</span></h2>
      <p class="notion-hint" style="margin:2px 0;">這些品項<b>沒有 erp_code</b>，無法對應凌越，需人工判斷補料號（可能與⑤回填後的新品項重複，補完料號建議把重複的一方停用）。</p>
      ${tbl(["主檔品名", "單位"], noCodeRows)}${noCode.length > CAP ? `<p class="notion-hint">…共 ${noCode.length} 筆，僅顯示前 ${CAP}。</p>` : ""}

      <h2 style="margin:18px 0 2px;font-size:16px;">⑤ 凌越有、主檔沒有 → 回填主檔 <span style="font-size:12px;color:var(--txt-3);">(${missingTotal})</span></h2>
      <p class="notion-hint" style="margin:2px 0;">一鍵把缺漏品項建進主檔（名稱/單位取凌越；同料號多公司只建一筆）。<b>只新增、絕不覆蓋既有品項</b>（含停用中的也不會被動到）。</p>
      ${missingTotal ? actBtn("btnBackfill", `執行：回填 ${missingTotal} 個品項進主檔`, "primary") : ""}
      ${missingSections || tbl(["料號", "凌越品名", "單位"], "")}
      <script>
      (function(){
        function run(btnId, url, confirmMsg){
          var b=document.getElementById(btnId); if(!b) return;
          var m=document.getElementById(btnId+'Msg');
          b.addEventListener('click', function(){
            if(!confirm(confirmMsg)) return;
            b.disabled=true; if(m) m.textContent='執行中…';
            fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
              .then(function(r){return r.json();})
              .then(function(d){
                if(d.error){ b.disabled=false; if(m){m.style.color='#b3261e'; m.textContent='失敗：'+d.error;} return; }
                if(m){m.style.color='#1f7a46'; m.textContent='完成：'+JSON.stringify(d);}
                setTimeout(function(){ location.reload(); }, 900);
              })
              .catch(function(){ b.disabled=false; if(m){m.style.color='#b3261e'; m.textContent='執行失敗，請重試';} });
          });
        }
        run('btnBackfill','/admin/products/reconcile/backfill','回填缺漏品項進主檔？\\n\\n只會新增、不會動任何既有品項。可重複執行。');
        run('btnAlignNames','/admin/products/reconcile/align-names','把清單中的品名改成凌越名？\\n\\n舊名會自動保留為別名（LINE 打舊名仍認得），俗名/寺岡碼等設定不受影響。');
        run('btnAlignUnits','/admin/products/reconcile/align-units','把清單中的單位改成凌越單位？\\n\\n公斤↔KG 已排除不會被改；清單中紅字標示的品項改後將停用自動換算公斤。');
      })();
      </script>
      `;
            res.type("text/html").send(notionPage("凌越比對", body, "products", res));
        }
        catch (e) {
            console.error("[admin] products/reconcile", e?.message || e);
            res.status(500).type("text/plain").send("比對失敗：" + String(e?.message || e));
        }
    });
    router.get("/products", async (req, res) => {
        const q = req.query.q?.trim() ?? "";
        let products = await db.prepare(`
      SELECT id, name, erp_code, teraoka_barcode, unit, active
      FROM products
      ORDER BY name
    `).all();
        if (q) {
            products = products.filter((p) => p.name.includes(q) ||
                (p.erp_code && p.erp_code.includes(q)) ||
                (p.teraoka_barcode && p.teraoka_barcode.includes(q)));
        }
        const aliasesByProduct = new Map();
        const aliasRows = await db.prepare("SELECT product_id, alias FROM product_aliases").all();
        for (const a of aliasRows) {
            if (!aliasesByProduct.has(a.product_id))
                aliasesByProduct.set(a.product_id, []);
            aliasesByProduct.get(a.product_id).push(a.alias);
        }
        const specsByProduct = new Map();
        try {
            const specRows = await db.prepare("SELECT product_id, unit, note_label, conversion_kg FROM product_unit_specs").all();
            for (const s of specRows) {
                if (!specsByProduct.has(s.product_id))
                    specsByProduct.set(s.product_id, []);
                const t = s.conversion_kg != null ? `${s.unit}（${s.conversion_kg}kg）` : (s.note_label || s.unit);
                specsByProduct.get(s.product_id).push(t);
            }
        }
        catch (_) { /* product_unit_specs 可能尚未建立 */ }
        try {
            const packRows = await db.prepare("SELECT product_id, outer_unit, inner_unit, inner_count FROM product_packaging_ratios").all();
            for (const p of packRows) {
                if (!specsByProduct.has(p.product_id))
                    specsByProduct.set(p.product_id, []);
                const t = `1${p.outer_unit}=${p.inner_count}${p.inner_unit}`;
                specsByProduct.get(p.product_id).push(t);
            }
        }
        catch (_) { /* product_packaging_ratios 可能尚未建立 */ }
        const okMsg = req.query.ok === "del" ? "已刪除品項" : req.query.ok === "edit" ? "已儲存" : "";
        const errMsg = req.query.err ? String(req.query.err) : "";
        const makeRow = (p) => {
            const specSummary = (specsByProduct.get(p.id) ?? []).map((x) => escapeHtml(x)).join("、") || `<span style="color:var(--txt-3);">—</span>`;
            const isActive = p.active === 1 || p.active === "1" || p.active === undefined || p.active === null;
            const statusHtml = isActive ? `<span class="sf-pill ok">啟用</span>` : `<span class="sf-pill">停用</span>`;
            const toggleLabel = isActive ? "停用" : "啟用";
            const aliases = (aliasesByProduct.get(p.id) ?? []);
            const aliasHtml = aliases.length ? `<span style="font-size:12px;color:var(--txt-2);">${aliases.map(a => escapeHtml(a)).join("、")}</span>` : `<span style="color:var(--txt-3);">—</span>`;
            return `<tr class="product-row" data-product-id="${escapeAttr(p.id)}">
            <td>
              <div style="font-weight:500;">${escapeHtml(p.name)}</div>
              ${p.unit ? `<div style="font-size:11px;color:var(--txt-3);">單位：${escapeHtml(p.unit)}</div>` : ""}
            </td>
            <td><span class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml(p.erp_code ?? "—")}</span></td>
            <td><span class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml(p.teraoka_barcode ?? "—")}</span></td>
            <td>${aliasHtml} <a href="/admin/products/${encodeURIComponent(p.id)}/aliases" style="font-size:11px;">管理</a></td>
            <td>${specSummary} <a href="/admin/products/${encodeURIComponent(p.id)}/edit#unit-sop" style="font-size:11px;">設定</a></td>
            <td class="product-status-cell" style="text-align:right;">${statusHtml}</td>
            <td style="white-space:nowrap;">
              <a class="sf-btn sm" href="/admin/products/${encodeURIComponent(p.id)}/edit">${SF_ICONS.edit}</a>
              <button type="button" class="sf-btn sm product-toggle-btn" data-id="${escapeAttr(p.id)}" data-active="${isActive ? "1" : "0"}">${escapeHtml(toggleLabel)}</button>
              <a class="sf-btn sm danger" href="/admin/products/${encodeURIComponent(p.id)}/delete">${SF_ICONS.x}</a>
            </td>
          </tr>`;
        };
        const isProductActive = (p) => p.active === 1 || p.active === "1" || p.active === undefined || p.active === null;
        const activeList = products.filter(isProductActive);
        const inactiveList = products.filter((p) => !isProductActive(p));
        const tbodyActive = activeList.map(makeRow).join("") || `<tr class="products-placeholder"><td colspan='7' style="padding:24px;text-align:center;color:var(--txt-3);">無啟用品項</td></tr>`;
        const tbodyInactive = inactiveList.map(makeRow).join("") || `<tr class="products-placeholder"><td colspan='7' style="padding:24px;text-align:center;color:var(--txt-3);">無停用品項</td></tr>`;
        const statCard = (label, num, status) => `
          <div style="padding:10px 16px;background:var(--bg-1);border:var(--hairline);border-radius:var(--radius-md);flex:1;display:flex;align-items:center;gap:10px;min-width:140px;">
            <span class="sf-dot ${status}"></span>
            <div>
              <div style="font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">${label}</div>
              <div class="mono" style="font-size:18px;font-weight:600;">${num}</div>
            </div>
          </div>`;
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="sf-breadcrumb" style="margin-bottom:6px;">主檔管理 / 貨品</div>
              <h1 style="margin:0;font-size:22px;font-weight:600;">貨品管理</h1>
              <p style="margin-top:4px;color:var(--txt-3);font-size:12px;">標準品項、俗名、單位規格管理。叫貨時客戶若使用俗名（例如「青菜頭→高麗菜」），可在這裡建立對應。</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a class="sf-btn" href="/admin/products/reconcile" title="比對貨品主檔與凌越推送的庫存(只看差異、不動資料)">${SF_ICONS.filter}<span>凌越比對</span></a>
              <a class="sf-btn" href="/admin/import">${SF_ICONS.dl}<span>匯入品項</span></a>
              <a class="sf-btn" href="/admin/import-teraoka">${SF_ICONS.link}<span>寺岡資料對照</span></a>
              <button type="button" class="sf-btn primary" id="openQuickAddProduct">${SF_ICONS.plus}<span>新增貨品</span></button>
            </div>
          </div>
          ${okMsg ? `<div class="sf-pill ok" style="align-self:flex-start;">${escapeHtml(okMsg)}</div>` : ""}
          ${errMsg ? `<div class="sf-pill bad" style="align-self:flex-start;">${escapeHtml(errMsg)}</div>` : ""}
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            ${statCard("品項總數", products.length, "ok")}
            ${statCard("啟用中", activeList.length, "info")}
            ${statCard("停用", inactiveList.length, "accent")}
          </div>
          <form method="get" action="/admin/products" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <div style="position:relative;flex:0 0 320px;">
              <input class="sf-input" type="search" name="q" value="${escapeAttr(q)}" placeholder="搜尋品名／凌越料號／寺岡條碼" style="padding-left:28px;">
              <span style="position:absolute;left:8px;top:10px;color:var(--txt-3);">${SF_ICONS.search}</span>
            </div>
            <button class="sf-btn" type="submit">${SF_ICONS.search}<span>搜尋</span></button>
            ${q ? `<a class="sf-btn ghost" href="/admin/products">清除</a>` : ""}
          </form>
          <div class="sf-tabs">
            <button type="button" class="sf-tab active" data-tab="products-active">啟用 <span class="tab-count">${activeList.length}</span></button>
            <button type="button" class="sf-tab" data-tab="products-inactive">停用 <span class="tab-count">${inactiveList.length}</span></button>
          </div>
          <div>
            <div id="products-active-panel" class="tab-panel sf-table-wrap">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th>標準品名</th>
                    <th style="width:120px;">凌越料號</th>
                    <th style="width:120px;">寺岡條碼</th>
                    <th>俗名</th>
                    <th>規格</th>
                    <th style="text-align:right;width:80px;">狀態</th>
                    <th style="width:160px;">操作</th>
                  </tr>
                </thead>
                <tbody id="products-active-tbody">${tbodyActive}</tbody>
              </table>
            </div>
            <div id="products-inactive-panel" class="tab-panel sf-table-wrap" style="display:none;">
              <table class="sf-table">
                <thead>
                  <tr>
                    <th>標準品名</th>
                    <th style="width:120px;">凌越料號</th>
                    <th style="width:120px;">寺岡條碼</th>
                    <th>俗名</th>
                    <th>規格</th>
                    <th style="text-align:right;width:80px;">狀態</th>
                    <th style="width:160px;">操作</th>
                  </tr>
                </thead>
                <tbody id="products-inactive-tbody">${tbodyInactive}</tbody>
              </table>
            </div>
          </div>
        </div>
        <script>
        (function(){
          var quickBtn = document.getElementById("openQuickAddProduct");
          if (quickBtn) quickBtn.addEventListener("click", function(){
            var modal = document.getElementById("quickAddProductModal");
            if (modal) modal.style.display = "flex";
          });
          var quickClose = document.getElementById("closeQuickAddProduct");
          if (quickClose) quickClose.addEventListener("click", function(){
            var modal = document.getElementById("quickAddProductModal");
            if (modal) modal.style.display = "none";
          });
          document.addEventListener("click", function(e){
            var modal = document.getElementById("quickAddProductModal");
            if (modal && e.target === modal) modal.style.display = "none";
          });
          var activeTbody = document.getElementById("products-active-tbody");
          var inactiveTbody = document.getElementById("products-inactive-tbody");
          function removePlaceholder(tbody){
            var first = tbody && tbody.firstElementChild;
            if (first && first.classList && first.classList.contains("products-placeholder")) tbody.removeChild(first);
          }
          function moveRow(row, toActive){
            var statusCell = row.querySelector(".product-status-cell");
            var btn = row.querySelector(".product-toggle-btn");
            if (statusCell) statusCell.innerHTML = toActive ? '<span class="sf-pill ok">啟用</span>' : '<span class="sf-pill">停用</span>';
            if (btn){ btn.dataset.active = toActive ? "1" : "0"; btn.textContent = toActive ? "停用" : "啟用"; }
            var fromTbody = row.parentNode;
            var toTbody = toActive ? activeTbody : inactiveTbody;
            removePlaceholder(toTbody);
            fromTbody.removeChild(row);
            toTbody.appendChild(row);
            if (fromTbody.children.length === 0)
              fromTbody.innerHTML = '<tr class="products-placeholder"><td colspan="7" style="padding:24px;text-align:center;color:var(--txt-3);">' + (fromTbody.id === "products-active-tbody" ? "無啟用品項" : "無停用品項") + '</td></tr>';
          }
          document.querySelectorAll(".sf-tab[data-tab]").forEach(function(btn){
            btn.addEventListener("click", function(e){
              e.preventDefault();
              var tab = this.dataset.tab;
              document.querySelectorAll(".sf-tab[data-tab]").forEach(function(b){ b.classList.remove("active"); });
              this.classList.add("active");
              document.querySelectorAll(".tab-panel").forEach(function(p){ p.style.display = "none"; });
              var panel = document.getElementById(tab + "-panel");
              if (panel) panel.style.display = "block";
            });
          });
          document.querySelectorAll(".product-toggle-btn").forEach(function(btn){
            btn.addEventListener("click", function(){
              var el = this, id = el.dataset.id;
              if (!id) return;
              el.disabled = true;
              fetch("/admin/api/products/" + encodeURIComponent(id) + "/toggle", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "", credentials: "same-origin" })
                .then(function(r){ return r.json(); })
                .then(function(data){
                  if (data && data.ok === true) {
                    var row = el.closest("tr");
                    if (row) moveRow(row, data.active === 1);
                  }
                  el.disabled = false;
                })
                .catch(function(){ el.disabled = false; });
            });
          });
        })();
        </script>
        <div id="quickAddProductModal" class="notion-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);align-items:center;justify-content:center;z-index:1000;">
          <div class="sf-card" style="max-width:440px;width:90%;background:var(--bg-1);">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.plus} 新增貨品</div>
              <button type="button" class="sf-btn sm ghost" id="closeQuickAddProduct">${SF_ICONS.x}</button>
            </div>
            <form method="post" action="/admin/products/quick-add" style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
              <div><label class="sf-label">標準品名</label><input class="sf-input" type="text" name="name" required></div>
              <div><label class="sf-label">凌越料號</label><input class="sf-input" type="text" name="erp_code"></div>
              <div><label class="sf-label">寺岡條碼</label><input class="sf-input" type="text" name="teraoka_barcode"></div>
              <div><label class="sf-label">單位</label><input class="sf-input" type="text" name="unit" value="公斤" required></div>
              <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:6px;border-top:var(--hairline);">
                <button type="button" class="sf-btn ghost" id="closeQuickAddProductBtn2">取消</button>
                <button type="submit" class="sf-btn primary">${SF_ICONS.plus}<span>新增</span></button>
              </div>
            </form>
          </div>
        </div>
        <script>
        (function(){
          var b2 = document.getElementById("closeQuickAddProductBtn2");
          if (b2) b2.addEventListener("click", function(){ var m = document.getElementById("quickAddProductModal"); if(m) m.style.display="none"; });
          var modal = document.getElementById("quickAddProductModal");
          if (modal) { modal.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);align-items:center;justify-content:center;z-index:1000;"; }
          var openBtn = document.getElementById("openQuickAddProduct");
          if (openBtn && modal) { openBtn.addEventListener("click", function(){ modal.style.display = "flex"; }); }
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("品項與俗名", body, "products", res));
    });
    router.post("/products/quick-add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const name = String(req.body.name || "").trim();
        const unit = String(req.body.unit || "").trim() || "公斤";
        const erpCode = String(req.body.erp_code || "").trim() || null;
        const teraokaBarcode = String(req.body.teraoka_barcode || "").trim() || null;
        if (!name) {
            res.redirect("/admin/products?err=" + encodeURIComponent("請輸入標準品名"));
            return;
        }
        const dup = await db.prepare("SELECT id FROM products WHERE name = ?").get(name);
        if (dup) {
            res.redirect("/admin/products?err=" + encodeURIComponent("品名已存在"));
            return;
        }
        const id = (0, id_js_1.newId)("prod");
        await db.prepare("INSERT INTO products (id, name, erp_code, teraoka_barcode, unit, active, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)").run(id, name, erpCode, teraokaBarcode, unit, new Date().toISOString());
        res.redirect("/admin/products?ok=edit");
    });
    router.get("/products/:id/aliases", async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const aliases = await db.prepare("SELECT id, alias FROM product_aliases WHERE product_id = ? ORDER BY alias").all(productId);
        let specs = [];
        try {
            specs = await db.prepare("SELECT id, unit, note_label, conversion_kg FROM product_unit_specs WHERE product_id = ? ORDER BY unit").all(productId);
        }
        catch (_) { /* 表可能尚未存在 */ }
        const specMsg = req.query.spec_ok === "1" ? "<p style='color:green'>規格已新增。</p>" : req.query.spec_del ? "<p style='color:green'>規格已刪除。</p>" : "";
        const msg = req.query.ok === "1" ? "<p style='color:green'>已儲存。</p>" : req.query.ok === "del" ? "<p style='color:green'>已刪除。</p>" : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const rows = aliases
            .map((a) => `<tr>
            <td>${escapeHtml(a.alias)}</td>
            <td><a href="/admin/aliases/${encodeURIComponent(a.id)}/edit">編輯</a> | <form method="post" action="/admin/aliases/${encodeURIComponent(a.id)}/delete" style="display:inline;" onsubmit="return confirm('確定刪除「${escapeAttr(escJsStr(a.alias))}」？')"><button type="submit">刪除</button></form></td>
          </tr>`)
            .join("");
        const specRows = specs
            .map((s) => `<tr>
            <td>${escapeHtml(s.unit)}</td>
            <td>${escapeHtml(s.note_label ?? "")}</td>
            <td>${s.conversion_kg != null ? s.conversion_kg : "—"}</td>
            <td><form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs/${encodeURIComponent(s.id)}/delete" style="display:inline;" onsubmit="return confirm('確定刪除規格「${escapeAttr(escJsStr(s.unit))}」？')"><button type="submit" class="btn">刪除</button></form></td>
          </tr>`)
            .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / 俗名管理</div>
        <h1 class="notion-page-title">俗名管理：${escapeHtml(product.name)}</h1>
        <p class="notion-hint">單位換算與包裝規格已整合至 <a href="/admin/products/${encodeURIComponent(productId)}/edit#unit-sop">品項編輯 → 2. 單位與換算</a>，建議以此為主。</p>
        ${msg}${specMsg}
        <div class="notion-card">
          <h2>俗名</h2>
          <table>
            <thead><tr><th>俗名（別名）</th><th>操作</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='2'>尚無俗名</td></tr>"}</tbody>
          </table>
          <h2 style="margin-top:16px;">新增俗名</h2>
          <form method="post" action="/admin/alias">
            <input type="hidden" name="scope" value="global">
            <input type="hidden" name="product_id" value="${escapeAttr(product.id)}">
            <input type="hidden" name="redirect" value="/admin/products/${encodeURIComponent(product.id)}/aliases">
            <label>別名（客戶可能這樣叫）<input type="text" name="alias" required placeholder="例：高麗菜心" style="width:100%;"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">新增</button></p>
          </form>
        </div>
        <div class="notion-card" id="specs">
          <h2>品項規格</h2>
          <p class="notion-hint" style="margin:0 0 12px;">單位、備註標籤、換算公斤（選填）</p>
          <table>
            <thead><tr><th>單位</th><th>備註標籤</th><th>換算公斤</th><th>操作</th></tr></thead>
            <tbody>${specRows || "<tr><td colspan='4'>尚無規格</td></tr>"}</tbody>
          </table>
          <h2 style="margin-top:16px;">新增規格</h2>
          <form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs">
            <label>單位 <input type="text" name="unit" required placeholder="例：斤、包" style="width:120px;"></label>
            <label>備註標籤 <input type="text" name="note_label" placeholder="選填" style="width:160px;"></label>
            <label>換算公斤 <input type="number" name="conversion_kg" step="0.001" placeholder="選填" style="width:100px;"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">新增規格</button></p>
          </form>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("俗名管理", body, "", res));
    });
    router.post("/products/:id/specs", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const unit = (req.body?.unit ?? "").trim();
        const embed = req.body?.embed === "1";
        const returnUrl = safeAdminReturnPath(typeof req.body?.return === "string" ? req.body.return : "") || "";
        const redirectToEdit = req.body?.redirect_to_edit === "1";
        const ctxRaw = (req.body?.context_raw ?? "").trim();
        const ctxUnit = (req.body?.context_unit ?? "").trim();
        const qCtx = (ctxRaw ? "&context_raw=" + encodeURIComponent(ctxRaw) : "") + (ctxUnit ? "&context_unit=" + encodeURIComponent(ctxUnit) : "");
        const buildEditRedirect = (queryErr) => {
            const base = "/admin/products/" + encodeURIComponent(productId) + "/edit";
            if (queryErr)
                return base + "?err=" + encodeURIComponent(queryErr) + (embed ? "&embed=1" : "") + (returnUrl && embed ? "&return=" + encodeURIComponent(returnUrl) : "") + qCtx;
            let u = base + "?ok=spec_add" + (embed ? "&embed=1" : "") + (returnUrl && embed ? "&return=" + encodeURIComponent(returnUrl) : "") + qCtx;
            return u;
        };
        if (!unit) {
            if (redirectToEdit) {
                res.redirect(302, buildEditRedirect("請填寫單位"));
                return;
            }
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?err=" + encodeURIComponent("請填寫單位"));
            return;
        }
        const noteLabel = (req.body?.note_label ?? "").trim() || null;
        const conversionKg = req.body?.conversion_kg !== undefined && req.body.conversion_kg !== "" ? parseFloat(req.body.conversion_kg) : null;
        const syncLine = conversionKg != null && Number.isFinite(conversionKg) && conversionKg > 0;
        let specId = (0, id_js_1.newId)("pus");
        try {
            // [fix 2026-07-08] 同品項同單位已存在就改成更新，不再新增重複列。
            // 過去無查重也無唯一鍵，重複列會讓換算取值不定。
            const existingSpec = await db.prepare("SELECT id FROM product_unit_specs WHERE product_id = ? AND unit = ? ORDER BY id LIMIT 1").get(productId, unit);
            if (existingSpec?.id) {
                specId = existingSpec.id;
                const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                await db.prepare("UPDATE product_unit_specs SET note_label = ?, conversion_kg = ?, updated_at = " + nowSql + " WHERE id = ?").run(noteLabel, conversionKg, specId);
            }
            else {
                await db.prepare("INSERT INTO product_unit_specs (id, product_id, unit, note_label, conversion_kg) VALUES (?, ?, ?, ?, ?)").run(specId, productId, unit, noteLabel, conversionKg);
            }
        }
        catch (e) {
            if (redirectToEdit) {
                res.redirect(302, buildEditRedirect("新增失敗：" + (e.message || "")));
                return;
            }
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?err=" + encodeURIComponent("新增失敗：" + (e.message || "")));
            return;
        }
        await logDataChange(req, {
            entityType: "product_unit_spec",
            entityId: specId,
            productId,
            action: "create",
            summary: `新增規格：${unit}${conversionKg != null ? ` → ${conversionKg}kg` : ""}${syncLine ? "（已同步 LINE 換算）" : ""}`,
            meta: { unit, note_label: noteLabel, conversion_kg: conversionKg, line_rules_synced: syncLine },
        });
        if (syncLine) {
            try {
                const obj = await loadLineUnitRulesObject();
                const fu = unit.trim();
                obj.rules = obj.rules.filter((r) => !(r.productId === productId && Array.isArray(r.fromUnits) && r.fromUnits.map((x) => String(x).trim()).includes(fu)));
                obj.rules.push({
                    productId,
                    fromUnits: [fu],
                    toUnit: "公斤",
                    kgPerUnit: conversionKg,
                    kgSafetyFactor: 1,
                    remarkStyle: "prefix",
                });
                await saveLineUnitRulesObject(normalizeLineUnitRules(JSON.stringify(obj)));
            }
            catch (e) {
                console.error("[admin] sync line unit rule from spec", e);
            }
        }
        // 公斤計價品項：把這個品項下所有「該單位」的訂單品項自動換算成公斤
        let autoConverted = 0;
        if (syncLine) {
            try {
                const conv = await autoConvertOrderItemsToKg(req, productId, unit);
                autoConverted = conv.converted || 0;
            } catch (e) {
                console.warn("[spec auto-convert] failed:", e?.message || e);
            }
        }
        if (redirectToEdit) {
            let u = buildEditRedirect("");
            if (syncLine)
                u = appendQueryToAdminPath(u, "sync_line", "1");
            if (autoConverted > 0)
                u = appendQueryToAdminPath(u, "auto_converted", String(autoConverted));
            res.redirect(302, u);
            return;
        }
        res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?spec_ok=1#specs");
    });
    router.post("/products/:id/specs/:specId/delete", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const specId = req.params.specId;
        const row = await db.prepare("SELECT id, unit FROM product_unit_specs WHERE id = ? AND product_id = ?").get(specId, productId);
        if (!row) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?err=" + encodeURIComponent("找不到此規格"));
            return;
        }
        await db.prepare("DELETE FROM product_unit_specs WHERE id = ?").run(specId);
        await logDataChange(req, {
            entityType: "product_unit_spec",
            entityId: specId,
            productId,
            action: "delete",
            summary: `刪除規格「${String(row.unit ?? "")}」`,
            meta: {},
        });
        const redirectToEdit = req.body?.redirect_to_edit === "1";
        const embed = req.body?.embed === "1";
        const returnUrl = safeAdminReturnPath(typeof req.body?.return === "string" ? req.body.return : "") || "";
        if (redirectToEdit) {
            let u = "/admin/products/" + encodeURIComponent(productId) + "/edit?ok=spec_del";
            if (embed)
                u += "&embed=1";
            if (returnUrl && embed)
                u += "&return=" + encodeURIComponent(returnUrl);
            res.redirect(302, u);
            return;
        }
        res.redirect("/admin/products/" + encodeURIComponent(productId) + "/aliases?spec_del=1#specs");
    });
    router.post("/products/:id/pack-ratios/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const outer = (req.body?.outer_unit ?? "").trim();
        const inner = (req.body?.inner_unit ?? "").trim();
        const cnt = parseFloat(String(req.body?.inner_count ?? "").trim());
        const note = (req.body?.note ?? "").trim() || null;
        const embed = req.body?.embed === "1";
        const returnUrl = safeAdminReturnPath(typeof req.body?.return === "string" ? req.body.return : "") || "";
        const ctxRaw = (req.body?.context_raw ?? "").trim();
        const ctxUnit = (req.body?.context_unit ?? "").trim();
        const qCtx = (ctxRaw ? "&context_raw=" + encodeURIComponent(ctxRaw) : "") + (ctxUnit ? "&context_unit=" + encodeURIComponent(ctxUnit) : "");
        const buildPackRedirect = (errMsg) => {
            const base = "/admin/products/" + encodeURIComponent(productId) + "/edit";
            if (errMsg)
                return base + "?err=" + encodeURIComponent(errMsg) + (embed ? "&embed=1" : "") + (returnUrl && embed ? "&return=" + encodeURIComponent(returnUrl) : "") + qCtx;
            return base + "?ok=pack_add" + (embed ? "&embed=1" : "") + (returnUrl && embed ? "&return=" + encodeURIComponent(returnUrl) : "") + qCtx;
        };
        if (!outer || !inner || !Number.isFinite(cnt) || cnt <= 0) {
            res.redirect(302, buildPackRedirect("請填寫外層／內層單位，且數量須大於 0"));
            return;
        }
        const rid = (0, id_js_1.newId)("ppr");
        try {
            await db.prepare("INSERT INTO product_packaging_ratios (id, product_id, outer_unit, inner_unit, inner_count, note, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").run(rid, productId, outer, inner, cnt, note);
        }
        catch (e) {
            const msg = String(e?.message || "").includes("UNIQUE") || String(e?.code || "") === "23505"
                ? "此包裝組合已存在（同品項、同外層／內層）"
                : "新增失敗：" + (e.message || "");
            res.redirect(302, buildPackRedirect(msg));
            return;
        }
        await logDataChange(req, {
            entityType: "product_pack_ratio",
            entityId: rid,
            productId,
            action: "create",
            summary: `包裝：1 ${outer} = ${cnt} ${inner}`,
            meta: { outer_unit: outer, inner_unit: inner, inner_count: cnt },
        });
        res.redirect(302, buildPackRedirect(""));
    });
    router.post("/products/:id/pack-ratios/:rid/delete", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const rid = req.params.rid;
        const row = await db.prepare("SELECT id, outer_unit, inner_unit FROM product_packaging_ratios WHERE id = ? AND product_id = ?").get(rid, productId);
        if (!row) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?err=" + encodeURIComponent("找不到此包裝規格"));
            return;
        }
        await db.prepare("DELETE FROM product_packaging_ratios WHERE id = ?").run(rid);
        await logDataChange(req, {
            entityType: "product_pack_ratio",
            entityId: rid,
            productId,
            action: "delete",
            summary: `刪除包裝：${String(row.outer_unit)}→${String(row.inner_unit)}`,
            meta: {},
        });
        const embed = req.body?.embed === "1";
        const returnUrl = safeAdminReturnPath(typeof req.body?.return === "string" ? req.body.return : "") || "";
        let u = "/admin/products/" + encodeURIComponent(productId) + "/edit?ok=pack_del";
        if (embed)
            u += "&embed=1";
        if (returnUrl && embed)
            u += "&return=" + encodeURIComponent(returnUrl);
        res.redirect(302, u);
    });
    router.get("/aliases/:id/edit", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT pa.id, pa.alias, pa.product_id, p.name AS product_name FROM product_aliases pa JOIN products p ON p.id = pa.product_id WHERE pa.id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const errMsg = req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / <a href="/admin/products/${encodeURIComponent(row.product_id)}/aliases">俗名管理</a> / 編輯俗名</div>
        <h1 class="notion-page-title">編輯俗名</h1>
        <div class="notion-card">
          <p>品項：${escapeHtml(row.product_name)}</p>
          ${errMsg}
          <form method="post" action="/admin/aliases/${encodeURIComponent(id)}/edit">
            <label>別名 <input type="text" name="alias" value="${escapeAttr(row.alias)}" required style="width:100%;"></label>
            <p style="margin-top:12px;"><button type="submit" class="btn btn-primary">儲存</button></p>
          </form>
        </div>
        <p><a href="/admin/products/${encodeURIComponent(row.product_id)}/aliases">← 回俗名管理</a></p>
      `;
        res.type("text/html").send(notionPage("編輯俗名", body, "", res));
    });
    router.post("/aliases/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const aliasTrim = req.body?.alias?.trim();
        if (!aliasTrim) {
            res.redirect("/admin/aliases/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("別名不可為空"));
            return;
        }
        const row = await db.prepare("SELECT id, product_id, alias FROM product_aliases WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const existing = await db.prepare("SELECT id FROM product_aliases WHERE alias = ? AND id != ?").get(aliasTrim, id);
        if (existing) {
            res.redirect("/admin/aliases/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("此別名已被其他品項使用"));
            return;
        }
        const oldAlias = String(row.alias ?? "");
        await db.prepare("UPDATE product_aliases SET alias = ? WHERE id = ?").run(aliasTrim, id);
        if (oldAlias !== aliasTrim) {
            await logDataChange(req, {
                entityType: "product_alias",
                entityId: id,
                productId: row.product_id,
                action: "update",
                summary: `俗名「${oldAlias}」→「${aliasTrim}」`,
                meta: { from: oldAlias, to: aliasTrim },
            });
        }
        res.redirect("/admin/products/" + encodeURIComponent(row.product_id) + "/aliases?ok=1");
    });
    router.post("/aliases/:id/delete", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT product_id, alias FROM product_aliases WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此俗名"));
            return;
        }
        const aliasStr = String(row.alias ?? "");
        await db.prepare("DELETE FROM product_aliases WHERE id = ?").run(id);
        await logDataChange(req, {
            entityType: "product_alias",
            entityId: id,
            productId: row.product_id,
            action: "delete",
            summary: `刪除俗名「${aliasStr}」`,
            meta: { alias: aliasStr },
        });
        res.redirect("/admin/products/" + encodeURIComponent(row.product_id) + "/aliases?ok=del");
    });
    router.post("/products/:id/aliases/add", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const productId = req.params.id;
        const product = await db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const aliasTrim = (req.body?.alias ?? "").trim();
        const embed = req.body?.embed === "1";
        const returnRaw = typeof req.body?.return === "string" ? req.body.return : "";
        const returnUrl = safeAdminReturnPath(returnRaw) || "";
        const qEmbed = embed ? "&embed=1" + (returnUrl ? "&return=" + encodeURIComponent(returnUrl) : "") : "";
        const ctxRaw = (req.body?.context_raw ?? "").trim();
        const ctxUnit = (req.body?.context_unit ?? "").trim();
        const qCtx = (ctxRaw ? "&context_raw=" + encodeURIComponent(ctxRaw) : "") + (ctxUnit ? "&context_unit=" + encodeURIComponent(ctxUnit) : "");
        if (!aliasTrim) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?err=" + encodeURIComponent("請填寫俗名") + qEmbed + qCtx);
            return;
        }
        const dup = await db.prepare("SELECT id FROM product_aliases WHERE alias = ?").get(aliasTrim);
        if (dup) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?err=" + encodeURIComponent("此俗名已被使用") + qEmbed + qCtx);
            return;
        }
        const paId = (0, id_js_1.newId)("pa");
        try {
            await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run(paId, productId, aliasTrim);
        }
        catch (e) {
            res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?err=" + encodeURIComponent("新增失敗：" + (e.message || "")) + qEmbed + qCtx);
            return;
        }
        await logDataChange(req, {
            entityType: "product_alias",
            entityId: paId,
            productId,
            action: "create",
            summary: `新增俗名「${aliasTrim}」`,
            meta: { alias: aliasTrim },
        });
        // 自動套用：找出 raw_name 與此俗名完全相同、尚未對應或待確認的有效訂單品項，自動連結到此品項
        // 避免覆寫：已有 product_id 且 need_review = 0 的不動（可能是人工指定過的）
        let autoLinked = 0;
        try {
            const isPg = Boolean(process.env.DATABASE_URL);
            const matchedItems = await db.prepare(
                "SELECT oi.id, oi.order_id, oi.raw_name, oi.product_id, oi.need_review FROM order_items oi " +
                "WHERE TRIM(oi.raw_name) = ? AND oi.voided_at IS NULL AND (oi.product_id IS NULL OR oi.need_review = 1)"
            ).all(aliasTrim);
            for (const it of matchedItems || []) {
                await db.prepare("UPDATE order_items SET product_id = ?, need_review = 0 WHERE id = ?").run(productId, it.id);
                autoLinked++;
                try {
                    await logDataChange(req, {
                        entityType: "order_item",
                        entityId: it.id,
                        productId,
                        action: "auto_link_by_alias",
                        summary: `俗名「${aliasTrim}」自動套用：對應到品項`,
                        meta: { order_id: it.order_id, raw_name: it.raw_name, before: { product_id: it.product_id, need_review: it.need_review }, alias_id: paId },
                    });
                } catch (_) { /* ignore log error */ }
            }
        } catch (e) {
            console.warn("[alias auto-link] failed:", e?.message || e);
        }
        // 連動後，若該品項為公斤計價（products.unit='公斤'），把剛連結的品項以及其他同品項
        // 非公斤單位的訂單品項，依 unit_specs 換算成公斤
        let autoConverted = 0;
        if (autoLinked > 0) {
            try {
                const conv = await autoConvertOrderItemsToKg(req, productId);
                autoConverted = conv.converted || 0;
            } catch (e) {
                console.warn("[alias auto-convert] failed:", e?.message || e);
            }
        }
        const linkQuery = (autoLinked > 0 ? "&auto_linked=" + autoLinked : "")
            + (autoConverted > 0 ? "&auto_converted=" + autoConverted : "");
        res.redirect("/admin/products/" + encodeURIComponent(productId) + "/edit?ok=alias_add" + qEmbed + qCtx + linkQuery);
    });
    router.get("/products/:id/edit", async (req, res) => {
        const productId = req.params.id;
        const row = await db.prepare("SELECT id, name, erp_code, teraoka_barcode, unit, active FROM products WHERE id = ?").get(productId);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const embed = req.query.embed === "1" || req.query.embed === "true";
        const returnUrl = safeAdminReturnPath(typeof req.query.return === "string" ? req.query.return : "") || "";
        const contextRaw = typeof req.query.context_raw === "string" ? req.query.context_raw : "";
        const contextUnit = typeof req.query.context_unit === "string" ? req.query.context_unit : "";
        const hasOrderContext = contextRaw.trim().length > 0;
        const defaultSpecUnit = (contextUnit && contextUnit.trim()) ? contextUnit.trim() : "包";
        const aliases = await db.prepare("SELECT id, alias FROM product_aliases WHERE product_id = ? ORDER BY alias").all(productId);
        let unitSpecs = [];
        let packRatios = [];
        try {
            unitSpecs = await db.prepare("SELECT id, unit, note_label, conversion_kg FROM product_unit_specs WHERE product_id = ? ORDER BY unit").all(productId);
        }
        catch (_) {
            unitSpecs = [];
        }
        try {
            packRatios = await db.prepare("SELECT id, outer_unit, inner_unit, inner_count, note FROM product_packaging_ratios WHERE product_id = ? ORDER BY outer_unit, inner_unit").all(productId);
        }
        catch (_) {
            packRatios = [];
        }
        const fmtKgDisplay = (n) => {
            const x = Number(n);
            if (!Number.isFinite(x))
                return "—";
            return String(x.toFixed(4)).replace(/\.?0+$/, "");
        };
        const { kgMap: derivedKgMap, directSet: derivedDirect } = computeDerivedKgByUnit(unitSpecs, packRatios);
        let recentLogs = [];
        try {
            recentLogs = await db.prepare("SELECT action, summary, actor_username, created_at FROM data_change_log WHERE product_id = ? ORDER BY created_at DESC LIMIT 25").all(productId);
        }
        catch (_) {
            recentLogs = [];
        }
        const curMasterUnit = String(row.unit ?? "").trim();
        const masterUnitBase = ORDER_LINE_UNITS;
        // 若目前存的單位不在標準清單內（例如舊資料的「個」以外的怪值），仍原樣列出並選中，避免下拉靜默顯示錯的第一個選項
        const masterUnitChoices = curMasterUnit && !masterUnitBase.includes(curMasterUnit) ? [curMasterUnit, ...masterUnitBase] : masterUnitBase;
        const unitOptsHtml = (curMasterUnit ? "" : `<option value="" selected>—（未設定）</option>`) + masterUnitChoices.map((u) => `<option value="${escapeAttr(u)}" ${curMasterUnit === u ? "selected" : ""}>${escapeHtml(u)}</option>`).join("");
        const linkTarget = "";
        const formTarget = "";
        const specTableRows = unitSpecs.map((s) => {
            const kgDisp = s.conversion_kg != null ? `${fmtKgDisplay(s.conversion_kg)} kg` : "—";
            const hid = `<input type="hidden" name="redirect_to_edit" value="1"><input type="hidden" name="embed" value="${embed ? "1" : ""}"><input type="hidden" name="return" value="${escapeAttr(returnUrl)}">`;
            return `<tr><td>${escapeHtml(s.unit)}</td><td>${escapeHtml(s.note_label ?? "")}</td><td>${escapeHtml(kgDisp)}</td><td><form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs/${encodeURIComponent(s.id)}/delete"${formTarget} style="display:inline;margin:0;" onsubmit="return confirm('確定刪除規格「${escapeAttr(escJsStr(s.unit))}」？')">${hid}<button type="submit" class="btn">刪除</button></form></td></tr>`;
        }).join("");
        const packTableRows = packRatios.map((r) => {
            const hid = `<input type="hidden" name="embed" value="${embed ? "1" : ""}"><input type="hidden" name="return" value="${escapeAttr(returnUrl)}">`;
            return `<tr><td>${escapeHtml(r.outer_unit)}</td><td style="text-align:right;">${escapeHtml(String(r.inner_count))}</td><td>${escapeHtml(r.inner_unit)}</td><td>${escapeHtml(r.note ?? "")}</td><td><form method="post" action="/admin/products/${encodeURIComponent(productId)}/pack-ratios/${encodeURIComponent(r.id)}/delete"${formTarget} style="display:inline;margin:0;" onsubmit="return confirm('確定刪除「${escapeAttr(escJsStr("1 " + r.outer_unit + "＝" + r.inner_count + " " + r.inner_unit))}」？')">${hid}<button type="submit" class="btn">刪除</button></form></td></tr>`;
        }).join("");
        const derivedLines = [...derivedKgMap.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-Hant"));
        const derivedHtml = derivedLines.length === 0
            ? `<p class="notion-hint" style="margin:0;">尚無公斤換算。請先在「2-2」填<strong>最內層叫貨單位</strong>（如：一包、一罐）的公斤；再視需要於「2-3」設定 1 箱＝幾包。</p>`
            : `<ul class="pu-derived" style="margin:0;padding-left:0;list-style:none;">${derivedLines.map(([u, k]) => {
                const tag = derivedDirect.has(u) ? "直接" : "推算";
                return `<li style="margin:4px 0;"><span class="pu-sop-badge">${escapeHtml(tag)}</span> 1 <strong>${escapeHtml(u)}</strong> ≈ <strong>${escapeHtml(fmtKgDisplay(k))}</strong> 公斤</li>`;
            }).join("")}</ul>`;
        const aliasRows = aliases.map((a) => `<tr><td>${escapeHtml(a.alias)}</td><td><a href="/admin/aliases/${encodeURIComponent(a.id)}/edit"${linkTarget}>編輯</a> | <form method="post" action="/admin/aliases/${encodeURIComponent(a.id)}/delete" style="display:inline;"${embed ? ' target="_parent"' : ""} onsubmit="return confirm('確定刪除「${escapeAttr(escJsStr(a.alias))}」？')"><button type="submit">刪除</button></form></td></tr>`).join("");
        const logRows = recentLogs.map((l) => `<tr><td style="white-space:nowrap;font-size:12px;">${escapeHtml(String(l.created_at ?? ""))}</td><td>${escapeHtml(String(l.actor_username ?? "—"))}</td><td>${escapeHtml(String(l.action ?? ""))}</td><td>${escapeHtml(String(l.summary ?? "—"))}</td></tr>`).join("");
        const errMsg = req.query.err ? `<div class="notion-msg err">${escapeHtml(String(req.query.err))}</div>` : "";
        const autoLinkedCount = Math.max(0, parseInt(String(req.query.auto_linked || "0"), 10) || 0);
        const autoConvertedCount = Math.max(0, parseInt(String(req.query.auto_converted || "0"), 10) || 0);
        const aliasFlashSuffix = autoLinkedCount > 0
            ? `，並自動套用到 <strong>${autoLinkedCount}</strong> 筆既有訂單品項` + (autoConvertedCount > 0 ? `（其中 <strong>${autoConvertedCount}</strong> 筆已換算為公斤）` : "")
            : "（沒有舊訂單需要連動）";
        const specFlashSuffix = autoConvertedCount > 0
            ? `（同步將 <strong>${autoConvertedCount}</strong> 筆既有訂單的「${escapeHtml(String(req.query.context_raw || "—"))}」單位自動換算成公斤）`
            : "";
        const okFlash = req.query.ok === "alias_add"
            ? `<div class="notion-msg ok">已新增俗名${aliasFlashSuffix}。</div>`
            : req.query.ok === "spec_add"
                ? `<div class="notion-msg ok">已新增叫貨單位換算。${req.query.sync_line === "1" ? "已更新 <strong>LINE 叫貨單位換算</strong>規則（與進線換算一致）。" : ""}${autoConvertedCount > 0 ? `<br>同時自動把 <strong>${autoConvertedCount}</strong> 筆既有訂單品項（公斤計價）換算成公斤。` : ""}</div>`
                : req.query.ok === "spec_del"
                    ? `<div class="notion-msg ok">已刪除一筆叫貨單位換算。</div>`
                    : req.query.ok === "pack_add"
                        ? `<div class="notion-msg ok">已新增包裝規格。</div>`
                        : req.query.ok === "pack_del"
                            ? `<div class="notion-msg ok">已刪除包裝規格。</div>`
                            : "";
        const embedHint = embed
            ? `<p class="notion-hint">嵌入模式：儲存基本資料或完成下方步驟後，可關閉視窗或按「返回」回到訂單。</p>`
            : "";
        const hiddenReturn = returnUrl ? `<input type="hidden" name="redirect" value="${escapeAttr(returnUrl)}">` : "";
        const hiddenEmbed = embed ? `<input type="hidden" name="embed" value="1">` : "";
        const orderCtxBlock = hasOrderContext
            ? `<div class="pu-order-ctx">
          <strong>本筆訂單帶入</strong>　原始品名：<strong>${escapeHtml(contextRaw)}</strong>　原始單位：<strong>${escapeHtml((contextUnit || "").trim() || "—")}</strong>
          <p class="notion-hint" style="margin:8px 0 0;">可先完成 2-1 俗名，再在 2-2 用相同單位填公斤；冷凍／箱裝請再設 2-3。</p>
        </div>`
            : "";
        const chipUnits = ["包", "把", "小把", "罐", "箱", "盒", "入", "斤"];
        const unitChipsHtml = chipUnits.map((cu) => `<button type="button" class="pu-chip" data-target="puSpecUnitInput" data-unit="${escapeAttr(cu)}">${escapeHtml(cu)}</button>`).join("");
        const packUnitOptionsHtml = ORDER_LINE_UNITS.map((u) => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join("");
        const packOuterSelectHtml = `<select name="outer_unit" required class="pu-pack-unit" aria-label="外層單位" style="width:5.5rem;">
            <option value="" disabled selected>外層</option>${packUnitOptionsHtml}</select>`;
        const packInnerSelectHtml = `<select name="inner_unit" required class="pu-pack-unit" aria-label="內層單位" style="width:5.5rem;">
            <option value="" disabled selected>內層</option>${packUnitOptionsHtml}</select>`;
        const body = `
        <style>
          .pe-page { max-width: 880px; margin: 0 auto; padding: ${embed ? "12px 16px 32px" : "20px 24px 48px"}; }
          .pe-title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin: 0 0 16px; flex-wrap:wrap; }
          .pe-title-row h1 { margin: 0; font-size: 22px; font-weight: 600; }
          .pe-context-spot { background: linear-gradient(0deg, rgba(35,131,226,0.04), rgba(35,131,226,0.08)); border: 1px solid rgba(35,131,226,0.25); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
          .pe-context-spot .pe-ctx-head { font-size: 12px; color: var(--notion-text-muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
          .pe-context-spot .pe-ctx-main { font-size: 14px; line-height: 1.5; }
          .pe-context-spot .pe-ctx-main strong { font-size: 15px; }
          .pe-context-spot .pe-ctx-tip { font-size: 12px; color: var(--notion-text-muted); margin: 6px 0 0; }
          .pe-card { background:#fff; border: 1px solid var(--notion-border); border-radius: 8px; padding: 18px 20px; margin-bottom: 14px; }
          .pe-card-head { display:flex; align-items:center; gap:9px; margin: 0 0 3px; }
          .pe-card-head h2 { margin: 0; font-size: 16px; font-weight: 600; }
          .pe-ic { width:26px; height:26px; border-radius:7px; background:rgba(35,131,226,0.1); color:var(--notion-accent); display:inline-flex; align-items:center; justify-content:center; font-size:15px; flex:0 0 auto; }
          .pe-card .sec-hint { font-size: 12px; color: var(--notion-text-muted); margin: 0 0 16px; line-height: 1.55; padding-left: 35px; }
          @media (max-width: 580px) { .pe-card .sec-hint { padding-left: 0; } }
          .pe-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; }
          @media (max-width: 580px) { .pe-grid-2 { grid-template-columns: 1fr; } }
          .pe-field { display:block; margin: 0; }
          .pe-field .pe-flabel { display:block; font-size: 12px; color: var(--notion-text-muted); margin: 0 0 5px; font-weight: 600; }
          .pe-field input, .pe-field select { width: 100%; height: 36px; padding: 0 10px; font-size: 14px; box-sizing: border-box; }
          .pe-field .pe-fhint { font-size: 11px; color: var(--notion-text-muted); margin: 5px 0 0; line-height: 1.45; }
          .pe-toggle-row { grid-column: 1 / -1; display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 11px 13px; background: var(--notion-sidebar); border: 1px solid var(--notion-border); border-radius: 8px; cursor: pointer; }
          .pe-toggle-row .pe-tl { font-size: 13px; }
          .pe-toggle-row .pe-tl b { font-weight: 600; }
          .pe-toggle-row .pe-tl span { display:block; font-size: 11px; color: var(--notion-text-muted); margin-top: 2px; }
          .pe-toggle-row input { position:absolute; opacity:0; width:0; height:0; }
          /* 開關用全站標準 .sf-switch（見主樣式表） */
          .pe-actions { margin-top: 16px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
          .pe-table { width: 100%; font-size: 13px; border-collapse: collapse; }
          .pe-table thead th { font-weight:600; padding: 7px 8px; background: var(--notion-sidebar); text-align: left; font-size: 12px; color: var(--notion-text-muted); border-bottom: 1px solid var(--notion-border); }
          .pe-table tbody td { padding: 8px; border-bottom: 1px solid var(--notion-border); }
          .pe-table tbody tr:last-child td { border-bottom: none; }
          .pe-add-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; padding: 12px 0 0; }
          .pe-add-row label { margin: 0; display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--notion-text-muted); }
          .pe-add-row input, .pe-add-row select { padding: 6px 8px; font-size: 13px; }
          .pe-mini-hint { font-size: 11px; color: var(--notion-text-muted); margin: 8px 0 0; }
          details.pe-sop { background:#fff; border: 1px solid var(--notion-border); border-radius: 8px; padding: 13px 18px; margin-bottom: 12px; }
          details.pe-sop > summary { cursor: pointer; font-weight: 600; font-size: 14px; list-style: none; display: flex; align-items: center; gap: 9px; padding: 2px 0; }
          details.pe-sop > summary::-webkit-details-marker { display: none; }
          details.pe-sop > summary::before { content: "▸"; font-size: 12px; color: var(--notion-text-muted); flex:0 0 auto; }
          details.pe-sop[open] > summary::before { content: "▾"; }
          details.pe-sop > summary .pe-ic { width:24px; height:24px; font-size:14px; }
          details.pe-sop .pe-step-body { padding-top: 15px; }
        </style>
        <div class="pe-page">
        ${embed ? "" : `<div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / 編輯品項</div>`}
        <div class="pe-title-row">
          <h1>編輯品項：${escapeHtml(row.name)}</h1>
          ${embed ? `<a href="${escapeAttr(returnUrl || "/admin/products")}" class="btn">← 返回訂單</a>` : `<a href="/admin/products" class="btn">← 回品項列表</a>`}
        </div>
        ${errMsg}
        ${okFlash}
        ${hasOrderContext ? `
        <div class="pe-context-spot">
          <div class="pe-ctx-head">本次從訂單帶入</div>
          <div class="pe-ctx-main">客戶寫：<strong>${escapeHtml(contextRaw)}</strong>${contextUnit && contextUnit.trim() ? `　原始單位：<strong>${escapeHtml(contextUnit.trim())}</strong>` : ""}</div>
          <p class="pe-ctx-tip">最快做法：在「俗名」加上「<strong>${escapeHtml(contextRaw)}</strong>」→ 之後 AI 看到這寫法就直接對應本品項；如果單位也常被認錯，再到「單位 → 公斤」補一條。</p>
        </div>` : ""}

        <div class="pe-card">
          <div class="pe-card-head"><span class="pe-ic">▦</span><h2>基本資料</h2></div>
          <p class="sec-hint">主檔品名與識別碼。「主檔預設單位」是這個品項的計價基準；客戶若用包／把等單位下單，於下方「叫貨單位 → 公斤」設定換算。</p>
          <form method="post" action="/admin/products/${encodeURIComponent(row.id)}/edit"${formTarget}>
            ${hiddenReturn}
            ${hiddenEmbed}
            <div class="pe-grid-2">
              <label class="pe-field" style="grid-column: 1 / -1;"><span class="pe-flabel">標準品名</span><input type="text" name="name" value="${escapeAttr(row.name)}" required></label>
              <label class="pe-field"><span class="pe-flabel">凌越料號</span><input type="text" name="erp_code" value="${escapeAttr(row.erp_code ?? "")}"></label>
              <label class="pe-field"><span class="pe-flabel">寺岡條碼</span><input type="text" name="teraoka_barcode" value="${escapeAttr(row.teraoka_barcode ?? "")}"></label>
              <label class="pe-field"><span class="pe-flabel">主檔預設單位</span><select name="unit">${unitOptsHtml}</select><span class="pe-fhint">青菜多為「公斤」計價。此設定影響進單時的單位提示與凌越匯出。</span></label>
              <label class="pe-toggle-row">
                <span class="pe-tl"><b>啟用此品項</b><span>停用後不會出現在叫貨與匯出清單</span></span>
                <input type="checkbox" name="active" value="1" ${row.active === 1 ? "checked" : ""}>
                <span class="sf-switch" aria-hidden="true"></span>
              </label>
            </div>
            <div class="pe-actions"><button type="submit" class="btn btn-primary">儲存基本資料</button></div>
          </form>
        </div>

        <details class="pe-sop" open id="step-21">
          <summary><span class="pe-ic">✎</span>俗名（客戶寫法 → 本品項）${aliases.length ? ` <span class="sf-pill" style="margin-left:auto;font-size:11px;">${aliases.length} 筆</span>` : ""}</summary>
          <div class="pe-step-body">
            <p class="sec-hint">全公司有效；客戶寫的別名（例「大陸妹」「美生菜」）對應到本品項。</p>
            <table class="pe-table"><thead><tr><th>俗名</th><th style="width:120px;">操作</th></tr></thead><tbody>${aliasRows || "<tr><td colspan='2' style='color:var(--notion-text-muted);'>尚無俗名</td></tr>"}</tbody></table>
            <form method="post" action="/admin/products/${encodeURIComponent(productId)}/aliases/add" class="pe-add-row"${formTarget}>
              <input type="hidden" name="return" value="${escapeAttr(returnUrl)}">
              ${embed ? `<input type="hidden" name="embed" value="1">` : ""}
              <input type="hidden" name="context_raw" value="${escapeAttr(contextRaw)}">
              <input type="hidden" name="context_unit" value="${escapeAttr(contextUnit)}">
              <label style="flex:1;min-width:200px;">新增俗名 <input type="text" name="alias" placeholder="${hasOrderContext ? escapeAttr(contextRaw) + "（一鍵新增）" : "例：大陸妹"}" ${hasOrderContext ? `value="${escapeAttr(contextRaw)}"` : ""} required></label>
              <button type="submit" class="btn btn-primary">新增</button>
            </form>
          </div>
        </details>

        <details class="pe-sop" open id="step-22">
          <summary><span class="pe-ic">⚖</span>叫貨單位 → 公斤${unitSpecs.length ? ` <span class="sf-pill" style="margin-left:auto;font-size:11px;">${unitSpecs.length} 筆</span>` : ""}</summary>
          <div class="pe-step-body">
            <p class="sec-hint">客戶下單用的單位（一包、一小把、一罐…）對應<strong>幾公斤</strong>。填了會自動更新 <strong>LINE 叫貨單位換算</strong>。</p>
            <div class="pu-chip-row"><span class="notion-hint" style="margin:0;font-size:12px;">快選：</span>${unitChipsHtml}</div>
            <table class="pe-table"><thead><tr><th>叫貨單位</th><th>備註</th><th>每 1 單位＝</th><th style="width:80px;"></th></tr></thead><tbody>${specTableRows || "<tr><td colspan='4' style='color:var(--notion-text-muted);'>尚無單位換算</td></tr>"}</tbody></table>
            <form method="post" action="/admin/products/${encodeURIComponent(productId)}/specs" class="pe-add-row"${formTarget}>
              <input type="hidden" name="return" value="${escapeAttr(returnUrl)}">
              ${embed ? `<input type="hidden" name="embed" value="1">` : ""}
              <input type="hidden" name="redirect_to_edit" value="1">
              <input type="hidden" name="context_raw" value="${escapeAttr(contextRaw)}">
              <input type="hidden" name="context_unit" value="${escapeAttr(contextUnit)}">
              <label>叫貨單位 <input type="text" name="unit" id="puSpecUnitInput" required value="${escapeAttr(defaultSpecUnit)}" placeholder="包、把…" style="width:5rem;"></label>
              <label>備註 <input type="text" name="note_label" placeholder="選填" style="width:6rem;"></label>
              <label>每 1 單位＝ <span style="display:inline-flex;align-items:center;gap:4px;"><input type="number" name="conversion_kg" step="0.001" min="0.001" value="1" style="width:5rem;"><span style="font-size:12px;color:var(--notion-text-muted);">公斤</span></span></label>
              <button type="submit" class="btn btn-primary">新增</button>
            </form>
          </div>
        </details>

        <details class="pe-sop" id="step-23">
          <summary><span class="pe-ic">▤</span>包裝規格（1 箱＝N 包等）${packRatios.length ? ` <span class="sf-pill" style="margin-left:auto;font-size:11px;">${packRatios.length} 筆</span>` : ""}</summary>
          <div class="pe-step-body">
            <p class="sec-hint">少用。如要描述「1 箱＝12 包」、「1 箱＝24 罐」這類關係。內層重量請在上方「叫貨單位 → 公斤」先填好，本區會推算外層公斤。</p>
            <table class="pe-table"><thead><tr><th>1 外層</th><th>＝幾個內層</th><th>內層單位</th><th>備註</th><th style="width:80px;"></th></tr></thead><tbody>${packTableRows || "<tr><td colspan='5' style='color:var(--notion-text-muted);'>尚無包裝關係</td></tr>"}</tbody></table>
            <form method="post" action="/admin/products/${encodeURIComponent(productId)}/pack-ratios/add" class="pe-add-row"${formTarget}>
              <input type="hidden" name="return" value="${escapeAttr(returnUrl)}">
              ${embed ? `<input type="hidden" name="embed" value="1">` : ""}
              <input type="hidden" name="context_raw" value="${escapeAttr(contextRaw)}">
              <input type="hidden" name="context_unit" value="${escapeAttr(contextUnit)}">
              <label>1 外層 ${packOuterSelectHtml}</label>
              <label>＝幾個 <input type="number" name="inner_count" step="0.001" min="0.001" value="1" required style="width:4.5rem;"></label>
              <label>內層 ${packInnerSelectHtml}</label>
              <label>備註 <input type="text" name="note" placeholder="選填" style="width:6rem;"></label>
              <button type="submit" class="btn btn-primary">新增</button>
            </form>
          </div>
        </details>

        <details class="pe-sop" id="step-24">
          <summary>推算結果（唯讀，看各單位約幾公斤）</summary>
          <div class="pe-step-body">
            <p class="sec-hint"><span class="pu-sop-badge">直接</span>＝直接填的；<span class="pu-sop-badge">推算</span>＝由上面兩區計算。</p>
            ${derivedHtml}
          </div>
        </details>

        <details class="pe-sop" id="step-history">
          <summary>變更紀錄（${recentLogs.length}）</summary>
          <div class="pe-step-body" style="overflow-x:auto;">
            <table class="pe-table"><thead><tr><th>時間</th><th>操作者</th><th>動作</th><th>摘要</th></tr></thead><tbody>${logRows || "<tr><td colspan='4' style='color:var(--notion-text-muted);'>尚無紀錄</td></tr>"}</tbody></table>
          </div>
        </details>
        </div>
        <script>
        (function(){
          document.querySelectorAll(".pu-chip[data-target][data-unit]").forEach(function(btn){
            btn.addEventListener("click", function(){
              var id = this.getAttribute("data-target");
              var u = this.getAttribute("data-unit") || "";
              var el = id && document.getElementById(id);
              if (el) { el.value = u; el.focus(); }
            });
          });
        })();
        </script>
      `;
        const html = embed ? notionEmbedPage("編輯品項", body, res) : notionPage("編輯品項", body, "", res);
        res.type("text/html").send(html);
    });
    router.post("/products/:id/edit", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const id = req.params.id;
        const old = await db.prepare("SELECT id, name, erp_code, teraoka_barcode, unit, active FROM products WHERE id = ?").get(id);
        if (!old) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const name = (req.body?.name ?? "").trim();
        if (!name) {
            res.redirect("/admin/products/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("品名不可為空") + productEditEmbedQuery(req.body));
            return;
        }
        const existing = await db.prepare("SELECT id FROM products WHERE name = ? AND id != ?").get(name, id);
        if (existing) {
            res.redirect("/admin/products/" + encodeURIComponent(id) + "/edit?err=" + encodeURIComponent("品名已存在") + productEditEmbedQuery(req.body));
            return;
        }
        const erpCode = (req.body?.erp_code ?? "").trim() || null;
        const teraokaBarcode = (req.body?.teraoka_barcode ?? "").trim() || null;
        const unit = (req.body?.unit ?? "公斤").trim() || "公斤";
        const active = req.body?.active === "1" ? 1 : 0;
        const meta = {};
        if (String(old.name) !== name)
            meta.name = { from: old.name, to: name };
        if (String(old.erp_code ?? "") !== String(erpCode ?? ""))
            meta.erp_code = { from: old.erp_code, to: erpCode };
        if (String(old.teraoka_barcode ?? "") !== String(teraokaBarcode ?? ""))
            meta.teraoka_barcode = { from: old.teraoka_barcode, to: teraokaBarcode };
        if (String(old.unit ?? "") !== String(unit))
            meta.unit = { from: old.unit, to: unit };
        const oldActive = old.active === 1 || old.active === "1" ? 1 : 0;
        if (oldActive !== active)
            meta.active = { from: oldActive, to: active };
        await db.prepare("UPDATE products SET name = ?, erp_code = ?, teraoka_barcode = ?, unit = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(name, erpCode, teraokaBarcode, unit, active, id);
        if (Object.keys(meta).length > 0) {
            await logDataChange(req, {
                entityType: "product",
                entityId: id,
                productId: id,
                action: "update",
                summary: `更新品項「${name}」`,
                meta,
            });
        }
        const red = safeAdminReturnPath(typeof req.body?.redirect === "string" ? req.body.redirect : "");
        if (red) {
            res.redirect(302, appendQueryToAdminPath(red, "ok", "prod_edit"));
            return;
        }
        res.redirect("/admin/products?ok=edit");
    });
    router.post("/api/products/:id/toggle", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id, active FROM products WHERE id = ?").get(id);
        if (!row) {
            res.status(404).json({ ok: false, err: "找不到此品項" });
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE products SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.json({ ok: true, active: next });
    });
    router.post("/products/:id/toggle", async (req, res) => {
        const id = req.params.id;
        const row = await db.prepare("SELECT id, active FROM products WHERE id = ?").get(id);
        if (!row) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const isActive = row.active === 1 || row.active === "1" || row.active === undefined || row.active === null;
        const next = isActive ? 0 : 1;
        await db.prepare("UPDATE products SET active = ?, updated_at = datetime('now') WHERE id = ?").run(next, id);
        res.redirect("/admin/products?ok=toggle");
    });
    router.get("/products/:id/delete", async (req, res) => {
        const id = req.params.id;
        const product = await db.prepare("SELECT id, name FROM products WHERE id = ?").get(id);
        if (!product) {
            res.redirect("/admin/products?err=" + encodeURIComponent("找不到此品項"));
            return;
        }
        const refCount = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?").get(id);
        const hasOrders = (refCount?.c ?? 0) > 0;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/products">品項與俗名</a> / 確認刪除</div>
        <h1 class="notion-page-title">確認刪除品項</h1>
        <div class="notion-card">
          <p>確定要刪除「${escapeHtml(product.name)}」？</p>
          ${hasOrders ? '<p class="notion-msg err">此品項已被訂單使用，無法刪除。請改為「停用」。</p>' : ""}
          <p style="margin-top:16px;">
            ${!hasOrders ? `<form method="post" action="/admin/products/${encodeURIComponent(id)}/delete" style="display:inline;"><button type="submit" class="btn">確定刪除</button></form> ` : ""}
            <a href="/admin/products" class="btn">取消</a>
          </p>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("確認刪除品項", body, "", res));
    });
    router.post("/products/:id/delete", async (req, res) => {
        const id = req.params.id;
        const refCount = await db.prepare("SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?").get(id);
        if ((refCount?.c ?? 0) > 0) {
            res.redirect("/admin/products?err=" + encodeURIComponent("此品項已被訂單使用，無法刪除。請改為停用。"));
            return;
        }
        // [fix 2026-07-08] 過去只擋訂單，品項若有俗名/單位換算/包裝規格/筆跡提示等中繼資料，
        // DELETE 會撞 FK 錯誤。改為在交易內先清掉這些「沒有此品項就沒意義」的中繼資料再刪品項；
        // 若仍被其他營運資料（庫存/盤差等）引用而失敗，整批回滾並回友善訊息（不再是原始 PG 錯誤）。
        try {
            // [fix 2026-07-27 體檢] 硬刪 6 張表補稽核軌跡（守則 #3）：先快照主檔再刪。
            const beforeSnap = await db.prepare("SELECT * FROM products WHERE id = ?").get(id);
            const doDel = async (h) => {
                await h.prepare("DELETE FROM product_unit_specs WHERE product_id = ?").run(id);
                await h.prepare("DELETE FROM product_packaging_ratios WHERE product_id = ?").run(id);
                await h.prepare("DELETE FROM customer_product_aliases WHERE product_id = ?").run(id);
                await h.prepare("DELETE FROM customer_handwriting_hints WHERE product_id = ?").run(id);
                await h.prepare("DELETE FROM rhythm_daily_signals WHERE product_id = ?").run(id);
                await h.prepare("DELETE FROM products WHERE id = ?").run(id);
            };
            if (typeof db.transaction === "function") await db.transaction(doDel);
            else await doDel(db);
            if (beforeSnap) {
                try {
                    await logDataChange(req, {
                        entityType: "product",
                        entityId: id,
                        action: "delete",
                        summary: `刪除品項「${beforeSnap.name || id}」（含規格/箱入數/客戶俗名/筆跡/節奏衍生資料）`,
                        meta: { before: beforeSnap },
                    });
                } catch (_) { /* 稽核失敗不擋刪除結果 */ }
            }
            res.redirect("/admin/products?ok=del");
        }
        catch (e) {
            console.error("[admin] product delete", e?.message || e);
            res.redirect("/admin/products?err=" + encodeURIComponent("此品項仍被其他資料引用（如庫存、盤點、物流單），無法刪除。建議改為停用。"));
        }
    });
}
