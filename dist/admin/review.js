"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerReviewRoutes = registerReviewRoutes;

// 待確認品項域（/review 列出 need_review=1 明細、/alias 建立俗名對照、移除誤判明細）路由：
// 自 index.js 拆出（拆檔批次 8），純搬移、行為不變。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerReviewRoutes(router, ctx) {
    const { db, notionPage, logDataChange } = ctx;
    // 待確認品名：列出 need_review=1 的明細，可選擇對應品項並加入俗名
    router.get("/review", async (req, res) => {
        const msg = req.query.ok === "1" ? "<p style='color:green'>已加入對照。</p>"
            : req.query.err === "dup" ? "<p style='color:red'>此俗名已存在，請勿重複新增。</p>"
            : req.query.err === "missing" ? "<p style='color:red'>尚未選擇對應品項：請先在搜尋框輸入品名或料號，並「點選」下拉清單中的品項，再按「加入對照」。</p>"
            : "";
        const rows = await db.prepare(`
      SELECT oi.id AS item_id, oi.raw_name, oi.quantity, oi.unit, oi.order_id, o.customer_id, c.name AS customer_name
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN customers c ON c.id = o.customer_id
      WHERE oi.need_review = 1 AND oi.voided_at IS NULL
      ORDER BY oi.id
    `).all();
        const rowsHtml = rows.length === 0
            ? "<tr><td colspan='6'>目前沒有待確認品名</td></tr>"
            : rows
                .map((r) => `
        <tr>
          <td>${escapeHtml(r.raw_name)}</td>
          <td>${r.quantity}</td>
          <td>${escapeHtml(r.unit ?? "")}</td>
          <td>${escapeHtml(r.customer_name)}</td>
          <td>
            <form action="/admin/alias" method="post" class="review-alias-form" style="display:inline;" onsubmit="if(!this.querySelector('.review-product-id').value){alert('請先從下拉清單點選一個品項，再按「加入對照」');return false;}return true;">
              <input type="hidden" name="alias" value="${escapeAttr(r.raw_name)}">
              <input type="hidden" name="customer_id" value="${escapeAttr(r.customer_id)}">
              <div class="review-product-picker" style="position:relative;display:inline-block;vertical-align:middle;">
                <input type="text" class="review-product-search" placeholder="輸入品名或料號搜尋" style="width:240px;" autocomplete="off">
                <input type="hidden" name="product_id" required class="review-product-id">
                <span class="review-product-label notion-hint" style="margin-left:6px;display:inline;"></span>
                <div class="review-product-dropdown" style="display:none;position:absolute;left:0;top:100%;margin-top:2px;max-height:200px;overflow:auto;border:1px solid var(--notion-border);background:var(--notion-bg);border-radius:var(--notion-radius);box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:20;min-width:260px;"></div>
              </div>
              <label style="margin-left:8px;"><input type="radio" name="scope" value="global" checked> 全公司俗名</label>
              <label><input type="radio" name="scope" value="customer"> 此客戶專用</label>
              <button type="submit" style="margin-left:8px;">加入對照</button>
            </form>
            <form action="/admin/review/delete-item" method="post" style="display:inline;margin-left:8px;" onsubmit="return confirm('確定刪除此筆誤判資料？');">
              <input type="hidden" name="item_id" value="${escapeAttr(r.item_id)}">
              <button type="submit" class="btn">刪除</button>
            </form>
          </td>
        </tr>
      `)
                .join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 待確認品名</div>
        <h1 class="notion-page-title">待確認品名</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("已加入") >= 0 ? "ok" : "err"}">${msg.replace(/<p style='[^']*'>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <p class="notion-hint" style="margin:0 0 12px;">以下為叫貨時無法對應到標準品項的名稱，請在「對應品項」欄輸入品名或料號搜尋、點選品項後加入俗名或客戶專用別名。</p>
          <table>
            <thead><tr><th>客戶輸入的名稱</th><th>數量</th><th>單位</th><th>客戶</th><th>對應品項並加入對照</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <script>
          (function(){
            var searchTimeout;
            document.querySelectorAll('.review-product-search').forEach(function(inp){
              var wrap = inp.closest('.review-product-picker');
              var hidden = wrap && wrap.querySelector('.review-product-id');
              var label = wrap && wrap.querySelector('.review-product-label');
              var dropdown = wrap && wrap.querySelector('.review-product-dropdown');
              if (!wrap || !hidden || !dropdown) return;
              function showList(arr){
                dropdown.innerHTML = (arr && arr.length) ? arr.map(function(p){
                  var text = (p.name || '') + (p.erp_code ? ' (' + p.erp_code + ')' : '') + (p.teraoka_barcode ? ' ' + p.teraoka_barcode : '');
                  var nmEsc = (p.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                  var ecEsc = (p.erp_code || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                  return '<div class="review-product-opt" data-id="' + (p.id || '') + '" data-name="' + nmEsc + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--notion-border);font-size:13px;">' + nmEsc + (ecEsc ? ' \uFF08' + ecEsc + '\uFF09' : '') + '</div>';
                }).join('') : '<div class="notion-hint" style="padding:8px 12px;margin:0;">無符合品項</div>';
                dropdown.style.display = 'block';
              }
              function hideList(){ dropdown.style.display = 'none'; }
              function selectProduct(id, name){
                hidden.value = id || '';
                label.textContent = name || '';
                inp.value = name || '';
                hideList();
              }
              inp.addEventListener('input', function(){
                var q = (this.value || '').trim();
                clearTimeout(searchTimeout);
                if (!q){ hideList(); label.textContent = ''; hidden.value = ''; return; }
                searchTimeout = setTimeout(function(){
                  fetch('/admin/api/products-search?q=' + encodeURIComponent(q) + '&active=1').then(function(r){ return r.json(); }).then(function(arr){ showList(arr); }).catch(function(){ hideList(); });
                }, 200);
              });
              dropdown.addEventListener('click', function(e){
                var opt = e.target.closest('.review-product-opt');
                if (opt && opt.dataset.id) selectProduct(opt.dataset.id, opt.dataset.name);
              });
              document.addEventListener('click', function(e){ if (!wrap.contains(e.target)) hideList(); });
            });
          })();
        </script>
      `;
        res.type("text/html").send(notionPage("待確認品名", body, "", res));
    });
    router.post("/alias", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const { alias, product_id, customer_id, scope, redirect } = req.body;
        if (!alias?.trim() || !product_id) {
            res.redirect(redirect && redirect.startsWith("/admin") ? redirect + "?err=missing" : "/admin/review?err=missing");
            return;
        }
        const aliasTrim = alias.trim();
        const isGlobal = scope !== "customer";
        try {
            if (isGlobal) {
                // [fix 2026-07-27 體檢] 冪等：product_aliases 無唯一鍵，重按/重整表單會長出同 alias 多列，
                // resolve 時同名多列取值不定（同一句俗名有時對到 A 有時對到 B）。已有同 (product_id, alias) 就跳過。
                const dup = await db.prepare("SELECT id FROM product_aliases WHERE product_id = ? AND alias = ?").get(product_id, aliasTrim);
                if (!dup) {
                    const id = (0, id_js_1.newId)("pa");
                    await db.prepare("INSERT INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)").run(id, product_id, aliasTrim);
                    await logDataChange(req, {
                        entityType: "product_alias",
                        entityId: id,
                        productId: product_id,
                        action: "create",
                        summary: `新增俗名「${aliasTrim}」（POST /alias）`,
                        meta: { alias: aliasTrim, via: "alias_form" },
                    });
                }
            }
            else if (customer_id) {
                // [fix 2026-07-27 體檢] 同上冪等防重；並補稽核軌跡（舊版只有全域分支有 logDataChange，
                // 客戶專用別名 resolve 優先級最高、建立卻完全無軌跡）。
                const dupC = await db.prepare("SELECT id FROM customer_product_aliases WHERE customer_id = ? AND product_id = ? AND alias = ?").get(customer_id, product_id, aliasTrim);
                if (!dupC) {
                    const id = (0, id_js_1.newId)("cpa");
                    await db.prepare("INSERT INTO customer_product_aliases (id, customer_id, product_id, alias) VALUES (?, ?, ?, ?)").run(id, customer_id, product_id, aliasTrim);
                    await logDataChange(req, {
                        entityType: "customer_product_alias",
                        entityId: id,
                        productId: product_id,
                        action: "create",
                        summary: `新增客戶專用俗名「${aliasTrim}」（POST /alias）`,
                        meta: { alias: aliasTrim, customer_id, via: "alias_form" },
                    });
                }
            }
            // 將同名稱的待確認明細改為已對應（若為客戶專用則只更新該客戶的訂單明細）
            // [fix 2026-07-28 §二B3] 舊版無條件改「所有」符合 raw_name 且 need_review=1 的品項，
            // 含已作廢/客訴單、以及已回寫凌越的單（改了 product_id 但凌越那張單不會變＝後台與 ERP 脫節）。
            // 收斂範圍：排除 deleted/complaint 與「已回寫凌越」（lingyue_written_at 非空）的單。
            // 保留 approved 但尚未回寫的單可套用——那是審核者刻意留白的待對應品項，教俗名後自動補上是預期行為。
            // 另回報實際影響筆數，讓使用者知道這條俗名動到幾筆歷史品項。
            let bulkAffected = 0;
            const notFinalizedSql = "COALESCE(LOWER(TRIM(status)), '') NOT IN ('deleted', 'complaint') AND lingyue_written_at IS NULL";
            if (isGlobal) {
                const where = `raw_name = ? AND need_review = 1 AND order_id IN (SELECT id FROM orders WHERE ${notFinalizedSql})`;
                const cnt = await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE " + where).get(aliasTrim);
                bulkAffected = cnt ? Number(cnt.n) || 0 : 0;
                await db.prepare("UPDATE order_items SET need_review = 0, product_id = ? WHERE " + where).run(product_id, aliasTrim);
            }
            else if (customer_id) {
                const whereC = `raw_name = ? AND need_review = 1 AND order_id IN (SELECT id FROM orders WHERE customer_id = ? AND ${notFinalizedSql})`;
                const cntC = await db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE " + whereC).get(aliasTrim, customer_id);
                bulkAffected = cntC ? Number(cntC.n) || 0 : 0;
                await db.prepare("UPDATE order_items SET need_review = 0, product_id = ? WHERE " + whereC).run(product_id, aliasTrim, customer_id);
            }
            if (bulkAffected > 0) {
                try {
                    await logDataChange(req, {
                        entityType: "order_items",
                        entityId: aliasTrim,
                        productId: product_id,
                        action: "alias_bulk_apply",
                        summary: `俗名「${aliasTrim}」套用到 ${bulkAffected} 筆待對應品項（僅未作廢/未客訴/未回寫凌越）`,
                        meta: { alias: aliasTrim, product_id, scope: isGlobal ? "global" : "customer", customer_id: customer_id || null, affected: bulkAffected },
                    });
                } catch (_) { /* 稽核失敗不影響主流程 */ }
            }
        }
        catch (e) {
            console.error("[admin] alias insert error", e);
            res.redirect(redirect && redirect.startsWith("/admin") ? redirect + "?err=dup" : "/admin/review?err=dup");
            return;
        }
        const doneUrl = redirect && redirect.startsWith("/admin") ? redirect + "?ok=1" : "/admin/review?ok=1";
        res.redirect(doneUrl);
    });
    router.post("/review/delete-item", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const itemId = String(req.body.item_id || "").trim();
        if (!itemId) {
            res.redirect("/admin/review");
            return;
        }
        // 改成作廢（軟刪除）：待對應的品項按「移除」時，視為 AI 辨識錯誤而留檔
        const isPg = Boolean(process.env.DATABASE_URL);
        const nowSql = isPg ? "CURRENT_TIMESTAMP" : "datetime('now')";
        const actor = req.adminUsername || "system";
        const snap = await db.prepare("SELECT id, order_id, raw_name, quantity, unit, product_id, voided_at FROM order_items WHERE id = ? AND need_review = 1").get(itemId);
        if (snap && !snap.voided_at) {
            await db.prepare(
                "UPDATE order_items SET voided_at = " + nowSql + ", voided_by = ?, void_reason = ?, void_note = ? WHERE id = ? AND need_review = 1"
            ).run(actor, "ai_wrong", "（從待對應清單作廢）", itemId);
            try {
                await logDataChange(req, {
                    entityType: "order_item",
                    entityId: itemId,
                    productId: snap.product_id ?? null,
                    action: "void",
                    summary: `從待對應清單作廢品項：${snap.raw_name || "(無品名)"} ${snap.quantity ?? ""}${snap.unit ?? ""}`,
                    meta: { order_id: snap.order_id, snapshot: snap, void_reason: "ai_wrong", source: "/review/delete-item" },
                });
            } catch (_) {}
        }
        res.redirect("/admin/review?ok=1");
    });
    // 拆檔批次 5：訂單三域共用 ctx（只傳跨域共用者；訂單專屬 helper 已隨路由搬走）
}
