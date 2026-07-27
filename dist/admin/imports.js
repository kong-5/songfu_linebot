"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerImportsRoutes = registerImportsRoutes;

// 匯入域（品項 CSV/Excel、客戶 CSV、寺岡條碼對照）路由：
// 自 index.js 拆出（拆檔批次 8），純搬移、行為不變。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerImportsRoutes(router, ctx) {
    const { db, notionPage, logDataChange, upload, parseRequestToSheet } = ctx;
    router.get("/import", async (req, res) => {
        const msg = req.query.ok ? `<p style='color:green'>已匯入 ${escapeHtml(String(req.query.ok))} 筆品項。</p>` : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 匯入品項</div>
        <h1 class="notion-page-title">匯入品項</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("已匯入") >= 0 ? "ok" : "err"}">${msg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <h2>支援欄位</h2>
          <p>第一列為標題。</p>
          <ul>
            <li>品名：<code>CommName</code>、<code>標準品名</code>、<code>name</code></li>
            <li>寺岡號碼（條碼）：<code>PluCode</code>、<code>寺岡條碼</code>、<code>teraoka_barcode</code></li>
            <li>凌越料號：<code>HQPluCode</code>、<code>ERP料號</code>、<code>erp_code</code></li>
            <li>單位：<code>QtySymbol</code>、<code>單位</code>、<code>unit</code></li>
          </ul>
          <p>同一品名已存在時會略過不覆蓋。</p>
          <p class="notion-hint">若出現「Service Unavailable」或逾時，可能是筆數過多：請改為分批匯入（每批約 200～500 筆），或在 Cloud Run 將「請求逾時」設為 300 秒。</p>
          <form method="post" action="/admin/import" enctype="multipart/form-data">
            <label>匯入時若單位為空，使用：<select name="default_unit">
              <option value="公斤">公斤</option>
              <option value="斤">斤</option>
              <option value="把">把</option>
              <option value="包">包</option>
              <option value="箱">箱</option>
              <option value="顆">顆</option>
              <option value="粒">粒</option>
              <option value="盒">盒</option>
              <option value="袋">袋</option>
            </select></label>
            <label>上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
            <label>或貼上 CSV：<textarea name="csv" placeholder="貼上 CSV 內容..." style="width:100%;height:160px;"></textarea></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">匯入</button></p>
          </form>
        </div>
        <p><a href="/admin/products">← 回品項列表</a></p>
      `;
        res.type("text/html").send(notionPage("匯入品項", body, "", res));
    });
    router.post("/import", upload, async (req, res) => {
        try {
            const sheet = parseRequestToSheet(req);
            if (!sheet || sheet.rows.length === 0) {
                res.redirect("/admin/import?err=" + encodeURIComponent("請貼上 CSV 或上傳 Excel 檔案"));
                return;
            }
            const defaultUnit = (req.body?.default_unit?.trim()) || "公斤";
            const { header, rows } = sheet;
            const h = (i) => (header[i] ?? "").trim().toLowerCase().replace(/\s+/g, "_");
            const nameIdx = header.findIndex((_, i) => {
                const v = h(i);
                return ["標準品名", "品名", "名稱", "name", "commname", "comm_name"].includes(v);
            });
            const erpIdx = header.findIndex((_, i) => ["erp料號", "erp_code", "hqplucode"].includes(h(i)));
            const teraokaIdx = header.findIndex((_, i) => ["寺岡條碼", "teraoka_barcode", "plucode"].includes(h(i)));
            const unitIdx = header.findIndex((_, i) => ["單位", "unit", "qtysymbol"].includes(h(i)));
            if (nameIdx === -1) {
                const headerPreview = header.length > 12 ? header.slice(0, 12).join("、") + "…" : header.join("、") || "（無）";
                res.redirect("/admin/import?err=" + encodeURIComponent("找不到品名欄位（請有 CommName、標準品名、品名或 name）。偵測到的標題：" + headerPreview));
                return;
            }
            let imported = 0;
            const existingNames = new Set((await db.prepare("SELECT name FROM products").all()).map((r) => r.name));
            for (let i = 0; i < rows.length; i++) {
                const cols = rows[i];
                const name = (cols[nameIdx] ?? "").trim();
                if (!name)
                    continue;
                if (existingNames.has(name))
                    continue;
                const erpCode = erpIdx >= 0 ? (cols[erpIdx] ?? "").trim() || null : null;
                const teraoka = teraokaIdx >= 0 ? (cols[teraokaIdx] ?? "").trim() || null : null;
                const unitCell = unitIdx >= 0 ? (cols[unitIdx] ?? "").trim() : "";
                const unit = unitCell || defaultUnit;
                const id = (0, id_js_1.newId)("prod");
                await db.prepare("INSERT INTO products (id, name, erp_code, teraoka_barcode, unit) VALUES (?, ?, ?, ?, ?)").run(id, name, erpCode, teraoka, unit);
                existingNames.add(name);
                imported++;
            }
            res.redirect("/admin/import?ok=" + imported);
        }
        catch (e) {
            console.error("[admin] 匯入品項錯誤:", e);
            const msg = (e && e.message) ? String(e.message) : String(e);
            res.redirect("/admin/import?err=" + encodeURIComponent("匯入失敗：" + (msg.length > 200 ? msg.slice(0, 200) + "…" : msg)));
        }
    });
    router.get("/import-customers", async (req, res) => {
        const msg = req.query.ok ? `<p style='color:green'>匯入結果：${escapeHtml(String(req.query.ok))}。</p>` : req.query.err ? `<p style='color:red'>${escapeHtml(String(req.query.err))}</p>` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 匯入客戶</div>
        <h1 class="notion-page-title">匯入客戶</h1>
        ${msg ? `<div class="notion-msg ${msg.indexOf("匯入結果") >= 0 ? "ok" : "err"}">${msg.replace(/<p[^>]*>|<\/p>/g, "").trim()}</div>` : ""}
        <div class="notion-card">
          <h2>支援欄位（第一列為標題）</h2>
          <ul>
            <li><strong>CustName</strong> / 客戶名稱（必填）</li>
            <li><strong>LineGroupId</strong> / LINE 群組 ID（綁定叫貨群組）</li>
            <li><strong>CustCode</strong> → 寺岡編號、<strong>HQCustCode</strong> → 凌越編號</li>
            <li>聯絡：<code>CustTel</code>、<code>Fax</code>、<code>Contact</code>、<code>Email</code> 會合併</li>
          </ul>
          <p><strong>大量群組</strong>：在各群組傳「取得群組ID」，機器人會回傳該群組 ID；收集成 Excel 後用「客戶名稱 + LINE群組ID」匯入即可批次綁定。</p>
          <pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);font-size:13px;overflow:auto;">客戶名稱, LINE群組ID, 聯絡
XX餐廳, C1234..., 02-12345678
YY小吃, C5678...,</pre>
          <form method="post" action="/admin/import-customers" enctype="multipart/form-data">
            <label>上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
            <label>或貼上 CSV：<textarea name="csv" placeholder="貼上 CSV 內容..." style="width:100%;height:160px;"></textarea></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">匯入</button></p>
          </form>
        </div>
        <p style="margin-top:16px;"><a href="/admin/customers" class="btn">← 回客戶列表</a></p>
        `;
        res.type("text/html").send(notionPage("匯入客戶", body, "", res));
    });
    router.post("/import-customers", upload, async (req, res) => {
        const sheet = parseRequestToSheet(req);
        if (!sheet || sheet.rows.length === 0) {
            res.redirect("/admin/import-customers?err=" + encodeURIComponent("請貼上 CSV 或上傳 Excel 檔案"));
            return;
        }
        const { header, rows } = sheet;
        const h = (i) => (header[i] ?? "").trim().toLowerCase().replace(/\s+/g, "_");
        const nameIdx = header.findIndex((_, i) => ["客戶名稱", "name", "custname"].includes(h(i)));
        const lineGroupIdIdx = header.findIndex((_, i) => ["linegroupid", "line_group_id", "line群組id"].includes(h(i)));
        const custCodeIdx = header.findIndex((_, i) => h(i) === "custcode");
        const hqCustCodeIdx = header.findIndex((_, i) => h(i) === "hqcustcode");
        const custTelIdx = header.findIndex((_, i) => ["custtel", "聯絡", "contact"].includes(h(i)));
        const faxIdx = header.findIndex((_, i) => h(i) === "fax");
        const contactIdx = header.findIndex((_, i) => h(i) === "contact");
        const emailIdx = header.findIndex((_, i) => h(i) === "email");
        if (nameIdx === -1) {
            res.redirect("/admin/import-customers?err=" + encodeURIComponent("找不到客戶名稱欄位（請有 客戶名稱 / name / CustName）"));
            return;
        }
        let imported = 0;
        let updated = 0;
        const skippedGroups = [];
        // [fix 2026-07-27 體檢] (1) 整份匯入包交易：舊版逐列裸奔，中途失敗前半已寫入、畫面只回一句失敗。
        // (2) LINE 群組唯一性：/customers/new 有「同一群組不可綁兩個客戶」守衛（叫貨會歸錯客戶），
        //     這條 CSV 路徑過去零檢查、可直接蓋 → 同群組已綁其他客戶時跳過該綁定並在結果列出。
        const doImportCust = async (h) => {
            for (let i = 0; i < rows.length; i++) {
                const cols = rows[i];
                const name = (cols[nameIdx] ?? "").trim();
                if (!name)
                    continue;
                const teraokaCode = custCodeIdx >= 0 ? (cols[custCodeIdx] ?? "").trim() || null : null;
                const hqCustCode = hqCustCodeIdx >= 0 ? (cols[hqCustCodeIdx] ?? "").trim() || null : null;
                let lineGroupId = lineGroupIdIdx >= 0 ? (cols[lineGroupIdIdx] ?? "").trim() || null : null;
                const contactParts = [custTelIdx, faxIdx, contactIdx, emailIdx]
                    .filter((idx) => idx >= 0)
                    .map((idx) => (cols[idx] ?? "").trim())
                    .filter(Boolean);
                const contact = contactParts.length > 0 ? contactParts.join(" / ") : null;
                const existing = await h.prepare("SELECT id FROM customers WHERE name = ?").get(name);
                if (lineGroupId) {
                    const bound = await h.prepare("SELECT id, name FROM customers WHERE line_group_id = ?").get(lineGroupId);
                    if (bound && (!existing || String(bound.id) !== String(existing.id))) {
                        skippedGroups.push(`${name}（群組已綁「${bound.name}」）`);
                        lineGroupId = null;
                    }
                }
                if (existing) {
                    await h.prepare("UPDATE customers SET teraoka_code = COALESCE(?, teraoka_code), hq_cust_code = COALESCE(?, hq_cust_code), contact = COALESCE(?, contact), line_group_id = COALESCE(?, line_group_id), updated_at = datetime('now') WHERE id = ?").run(teraokaCode ?? null, hqCustCode ?? null, contact ?? null, lineGroupId || null, existing.id);
                    if (lineGroupId)
                        updated++;
                }
                else {
                    await h.prepare("INSERT INTO customers (id, name, teraoka_code, hq_cust_code, line_group_id, contact) VALUES (?, ?, ?, ?, ?, ?)").run((0, id_js_1.newId)("cust"), name, teraokaCode, hqCustCode, lineGroupId, contact);
                    imported++;
                }
            }
        };
        try {
            if (typeof db.transaction === "function") await db.transaction(doImportCust);
            else await doImportCust(db);
        }
        catch (e) {
            // [fix 2026-07-27 體檢] 迴圈內的群組守衛是先查後寫；與其他人同時操作時仍可能撞
            // ux_customers_line_group。整批已回滾，回可行動訊息而非原始 500。
            const m = String(e?.message || e);
            if (/ux_customers_line_group/i.test(m) || (/UNIQUE constraint failed/i.test(m) && /customers\.line_group_id/i.test(m)) || (/duplicate key value/i.test(m) && /line_group/i.test(m))) {
                res.redirect("/admin/import-customers?err=" + encodeURIComponent("匯入中止：CSV 內的某個 LINE 群組剛被綁到其他客戶（可能同時有人在操作）。整批已回滾，請重新整理客戶列表確認後再匯入一次"));
                return;
            }
            throw e;
        }
        // [fix 2026-07-27 體檢] 批次寫入客戶主檔補稽核軌跡（守則 #3）
        try {
            await logDataChange(req, {
                entityType: "customer",
                entityId: "import-" + new Date().toISOString(),
                action: "import_customers",
                summary: `CSV 匯入客戶：新增 ${imported} 筆、更新群組綁定 ${updated} 筆${skippedGroups.length ? `、跳過已綁定群組 ${skippedGroups.length} 筆` : ""}`,
                meta: { imported, updated, skipped_groups: skippedGroups },
            });
        } catch (_) { /* 稽核失敗不擋匯入結果 */ }
        const resultMsg = imported > 0 ? `新增 ${imported} 筆` : "";
        const resultMsg2 = updated > 0 ? (resultMsg ? "；" : "") + `更新 ${updated} 筆 LINE 群組綁定` : "";
        const resultMsg3 = skippedGroups.length ? ((resultMsg + resultMsg2) ? "；" : "") + `跳過 ${skippedGroups.length} 筆群組綁定（已綁其他客戶）：${skippedGroups.slice(0, 5).join("、")}${skippedGroups.length > 5 ? "…" : ""}` : "";
        res.redirect("/admin/import-customers?ok=" + encodeURIComponent(resultMsg + resultMsg2 + resultMsg3 || "0"));
    });
    router.get("/import-teraoka", async (req, res) => {
        const ok = req.query.ok;
        const matched = req.query.matched;
        const unmatched = req.query.unmatched;
        let msg = "";
        if (ok === "1" && matched !== undefined)
            msg = `<p class="notion-msg ok">對照完成。已更新寺岡條碼：${matched} 筆。</p>`;
        if (unmatched !== undefined && unmatched !== "0")
            msg += `<p class="notion-msg err">未對應到品項（請先建品項或俗名）：${unmatched} 筆。</p>`;
        if (req.query.err)
            msg += `<p class="notion-msg err">${escapeHtml(String(req.query.err))}</p>`;
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 寺岡資料對照</div>
        <h1 class="notion-page-title">寺岡資料對照</h1>
        ${msg}
        <div class="notion-card">
          <p>貼上<strong>寺岡匯出的 CSV</strong>，系統會依<strong>品名</strong>對照到現有品項，並寫入<strong>寺岡條碼</strong>。</p>
          <p>第一列為標題，需有「品名」或「名稱」欄（對應我們的標準品名或俗名）、以及「條碼」或「編號」欄（寺岡條碼）。</p>
          <pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);font-size:13px;overflow:auto;">品名, 條碼
高麗菜, T001
福山萵苣, T002
大陸妹, T002</pre>
          <p>若寺岡的品名與系統不完全一致，請先在「品項與俗名」或「待確認品名」建立俗名對照，再匯入。</p>
          <form method="post" action="/admin/import-teraoka" enctype="multipart/form-data">
            <label>上傳 Excel：<input type="file" name="file" accept=".xlsx,.xls"></label>
            <label>或貼上 CSV：<textarea name="csv" placeholder="貼上寺岡匯出的 CSV..." style="width:100%;height:180px;"></textarea></label>
            <p style="margin-top:16px;"><button type="submit" class="btn btn-primary">對照並更新</button></p>
          </form>
        </div>
        <p style="margin-top:16px;"><a href="/admin/products" class="btn">← 回品項列表</a></p>
        `;
        res.type("text/html").send(notionPage("寺岡資料對照", body, "", res));
    });
    router.post("/import-teraoka", upload, async (req, res) => {
        const sheet = parseRequestToSheet(req);
        if (!sheet || sheet.rows.length === 0) {
            res.redirect("/admin/import-teraoka?err=" + encodeURIComponent("請貼上 CSV 或上傳 Excel 檔案"));
            return;
        }
        const { header, rows } = sheet;
        const nameIdx = header.findIndex((h) => h === "品名" || h === "名稱" || h === "name" || h === "標準品名");
        const barcodeIdx = header.findIndex((h) => h === "條碼" || h === "編號" || h === "barcode" || h === "code" || h === "寺岡條碼" || h === "teraoka_barcode");
        if (nameIdx === -1) {
            res.redirect("/admin/import-teraoka?err=" + encodeURIComponent("找不到品名欄位（品名、名稱、name、標準品名）"));
            return;
        }
        if (barcodeIdx === -1) {
            res.redirect("/admin/import-teraoka?err=" + encodeURIComponent("找不到條碼欄位（條碼、編號、barcode、code）"));
            return;
        }
        const productByName = new Map();
        for (const row of await db.prepare("SELECT id, name FROM products").all()) {
            productByName.set(row.name, row.id);
        }
        for (const row of await db.prepare("SELECT product_id, alias FROM product_aliases").all()) {
            if (!productByName.has(row.alias))
                productByName.set(row.alias, row.product_id);
        }
        let matched = 0;
        let unmatchedCount = 0;
        for (let i = 0; i < rows.length; i++) {
            const cols = rows[i];
            const name = (cols[nameIdx] ?? "").trim();
            const barcode = (cols[barcodeIdx] ?? "").trim();
            if (!name || !barcode)
                continue;
            const productId = productByName.get(name);
            if (productId) {
                await db.prepare("UPDATE products SET teraoka_barcode = ?, updated_at = datetime('now') WHERE id = ?").run(barcode, productId);
                matched++;
            }
            else {
                unmatchedCount++;
            }
        }
        res.redirect("/admin/import-teraoka?ok=1&matched=" + matched + "&unmatched=" + unmatchedCount);
    });
}
