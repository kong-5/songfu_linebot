"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLogisticsRoutes = registerLogisticsRoutes;

// 物流域（訂單整理／行情價格／毛豬行情／大宗物料／辨識 API／採購分析）路由：自 index.js 拆出（拆檔批次 4），純搬移、行為不變。

const express_1 = { default: require("express") };
const XLSX = require("xlsx");
const id_js_1 = require("../lib/id.js");
const parse_order_message_js_1 = require("../lib/parse-order-message.js");
const resolve_product_js_1 = require("../lib/resolve-product.js");
const vision_ocr_js_1 = require("../lib/vision-ocr.js");
const wholesale_price_js_1 = require("../lib/wholesale-price.js");
const wholesale_snapshot_js_1 = require("../lib/wholesale-snapshot.js");
const livestock_price_js_1 = require("../lib/livestock-price.js");
const unit_conversion_js_1 = require("../lib/unit-conversion.js");
const gemini_order_helpers_js_1 = require("../lib/gemini-order-helpers.js");
const order_parsed_heuristics_js_1 = require("../lib/order-parsed-heuristics.js");
const order_form_templates_js_1 = require("../lib/order-form-templates.js");
const customer_handwriting_hints_js_1 = require("../lib/customer-handwriting-hints.js");
const order_history_items_js_1 = require("../lib/order-history-items.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerLogisticsRoutes(router, ctx) {
    const { db, notionPage, getTaipeiCalendarDateYYYYMMDD, uploadImageSafe } = ctx;
    // ---------- 物流工具：訂單整理 ----------
    router.get("/logistics/orders", async (req, res) => {
        const from = (req.query.from || req.query.date_from || "").toString().trim();
        const to = (req.query.to || req.query.date_to || "").toString().trim();
        const qs = new URLSearchParams();
        if (/^\d{4}-\d{2}-\d{2}$/.test(from))
            qs.set("date_from", from);
        if (/^\d{4}-\d{2}-\d{2}$/.test(to))
            qs.set("date_to", to);
        if (req.query.ok === "1")
            qs.set("ok", "log_saved");
        const qstr = qs.toString();
        res.redirect("/admin/orders" + (qstr ? "?" + qstr : ""));
    });
    router.get("/logistics/orders/new", async (_req, res) => {
        const today = getTaipeiCalendarDateYYYYMMDD();
        const body = `
        <style>
        .new-order-mobile .toolbar { display:flex; flex-wrap:wrap; align-items:flex-end; gap:12px; margin:0 0 12px; }
        .new-order-mobile .toolbar > label { margin:0; }
        .new-order-mobile .table-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .new-order-mobile #previewTable { min-width: 760px; }
        .new-order-mobile .preview-actions { margin-top:12px; display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .new-order-mobile .preview-actions .btn { margin:0; }
        @media (max-width: 720px) {
          .new-order-mobile .toolbar { flex-direction:column; align-items:stretch; gap:10px; }
          .new-order-mobile #orderCustomerPicker { min-width:0 !important; max-width:100% !important; width:100%; }
          .new-order-mobile #orderCustomerSearch { font-size:16px !important; min-height:42px; }
          .new-order-mobile input[type="date"],
          .new-order-mobile input[type="text"],
          .new-order-mobile textarea,
          .new-order-mobile input[type="file"] { width:100%; font-size:16px; }
          .new-order-mobile #rawMessage { min-height:180px; }
          .new-order-mobile #recognizeBtn,
          .new-order-mobile #fillWholesaleBtn,
          .new-order-mobile #reRecognizeBtn,
          .new-order-mobile #saveOrderBtn { width:100%; min-height:44px; }
          .new-order-mobile .preview-actions { flex-direction:column; align-items:stretch; }
        }
        </style>
        <div class="new-order-mobile">
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/orders">訂單審核</a> / 新增訂單</div>
        <h1 class="notion-page-title">新增紙本訂單</h1>
        <p>貼上訂單文字（可複製 LINE 對話），系統會用<strong>與收單機器人相同的規則</strong>解析品項；規則解析不到時才會嘗試 Google AI。若需依客戶別名對照品項，請先<strong>搜尋並點選客戶</strong>。上傳照片時會先以 Cloud Vision OCR 辨識文字。</p>
        <div class="notion-card">
          <form id="newOrderForm" method="post" action="/admin/logistics/orders">
            <p class="toolbar">
              <label style="margin:0;">訂單日期 <input type="date" name="order_date" value="${escapeAttr(today)}" required></label>
              <label style="margin:0;display:flex;flex-direction:column;gap:4px;">
                <span>客戶（選填，用於品名對照）</span>
                <div id="orderCustomerPicker" style="position:relative;min-width:260px;max-width:min(360px,92vw);">
                  <input type="text" id="orderCustomerSearch" placeholder="輸入客戶名稱搜尋…" autocomplete="off" style="width:100%;padding:8px 10px;border:1px solid var(--notion-border-strong);border-radius:var(--notion-radius);font-size:14px;box-sizing:border-box;">
                  <input type="hidden" name="customer_id" id="orderCustomerId" value="">
                  <label style="margin-top:8px;font-size:13px;display:block;">子客戶（選填，圖片辨識歷史品項小抄用）<input type="text" id="subClientIdInput" placeholder="與訂單子客戶欄一致時填" autocomplete="off" style="width:100%;padding:6px 8px;margin-top:4px;box-sizing:border-box;border:1px solid var(--notion-border-strong);border-radius:var(--notion-radius);font-size:14px;"></label>
                  <span id="orderCustomerLabel" class="notion-hint" style="display:block;margin-top:4px;font-size:12px;"></span>
                  <div id="orderCustomerDropdown" style="display:none;position:absolute;left:0;top:100%;margin-top:2px;max-height:220px;overflow:auto;border:1px solid var(--notion-border);background:var(--notion-bg);border-radius:var(--notion-radius);box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:20;width:100%;box-sizing:border-box;"></div>
                </div>
              </label>
            </p>
            <p style="margin-top:12px;"><label>原始文字（貼上紙本內容或辨識結果）</label><br>
            <textarea name="raw_message" id="rawMessage" rows="8" style="width:100%;box-sizing:border-box;" placeholder="例如：高麗菜 5 斤&#10;大陸妹 2 把&#10;芹菜 3 包"></textarea></p>
            <p>或上傳圖片：<input type="file" name="image" id="imageFile" accept="image/*"></p>
            <button type="button" id="recognizeBtn" class="btn btn-primary">解析並預覽品項</button>
            <div id="recognizeErr" style="color:#c00;margin-top:8px;display:none;"></div>
          </form>
        </div>
        <div class="notion-card" id="previewBlock" style="display:none;">
          <h2>預覽品項（可調整後再儲存）</h2>
          <p>確認下方列表無誤後，按「儲存訂單」寫入；若有待確認品名可至「待確認品名」補對照。<br>金額可手動填寫，或依「訂單日期」帶入<strong>台北果菜市場（台北一、台北二）</strong>青菜／葉菜批發行情（優先<strong>中價</strong>，無則上／下價，元/公斤）作為參考。</p>
          <p style="margin-bottom:8px;"><button type="button" id="fillWholesaleBtn" class="btn">帶入台北批發價</button> <span id="wholesaleMsg" class="notion-hint" style="display:inline;margin:0;"></span></p>
          <div class="table-scroll"><table id="previewTable"><thead><tr><th>品名</th><th>數量</th><th>單位</th><th>備註</th><th>金額（元/公斤）</th><th>對應品項</th></tr></thead><tbody></tbody></table></div>
          <input type="hidden" name="items_json" id="itemsJson" form="newOrderForm">
          <p class="preview-actions"><button type="button" id="reRecognizeBtn" class="btn">重新辨識</button> <button type="button" id="saveOrderBtn" class="btn btn-primary">儲存訂單</button> <a href="/admin/orders" class="btn">取消</a></p>
        </div>
        </div>
        <script>
        (function(){
          var form = document.getElementById('newOrderForm');
          var rawMessage = document.getElementById('rawMessage');
          var imageFile = document.getElementById('imageFile');
          var recognizeBtn = document.getElementById('recognizeBtn');
          var recognizeErr = document.getElementById('recognizeErr');
          var previewBlock = document.getElementById('previewBlock');
          var previewTable = document.getElementById('previewTable').querySelector('tbody');
          var itemsJson = document.getElementById('itemsJson');
          var saveOrderBtn = document.getElementById('saveOrderBtn');
          var reRecognizeBtn = document.getElementById('reRecognizeBtn');
          var currentItems = [];
          var custSearch = document.getElementById('orderCustomerSearch');
          var custHidden = document.getElementById('orderCustomerId');
          var custDropdown = document.getElementById('orderCustomerDropdown');
          var custLabel = document.getElementById('orderCustomerLabel');
          var custPicker = document.getElementById('orderCustomerPicker');
          var custTimer;
          function hideCustDd(){ if (custDropdown) custDropdown.style.display = 'none'; }
          function escAttr(s){ return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
          function escHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
          function showCustList(arr){
            if (!custDropdown) return;
            custDropdown.innerHTML = (arr && arr.length) ? arr.map(function(c){
              var id = c.id || '';
              var name = c.name || '';
              return '<div class="order-customer-opt" data-id="' + escAttr(id) + '" data-name="' + escAttr(name) + '" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--notion-border);font-size:14px;">' + escHtml(name) + '</div>';
            }).join('') : '<div class="notion-hint" style="padding:8px 12px;margin:0;">無符合客戶</div>';
            custDropdown.style.display = 'block';
          }
          function selectCustomer(id, name){
            if (custHidden) custHidden.value = id || '';
            if (custSearch) custSearch.value = name || '';
            if (custLabel) custLabel.textContent = id ? ('已選：' + (name || '')) : '';
            hideCustDd();
          }
          if (custSearch && custHidden && custDropdown && custPicker) {
            custSearch.addEventListener('input', function(){
              var q = (this.value || '').trim();
              clearTimeout(custTimer);
              if (!q) { custHidden.value = ''; if (custLabel) custLabel.textContent = ''; hideCustDd(); return; }
              custTimer = setTimeout(function(){
                fetch('/admin/api/customers-search?q=' + encodeURIComponent(q), { credentials: 'same-origin' }).then(function(r){ return r.json(); }).then(showCustList).catch(hideCustDd);
              }, 200);
            });
            custDropdown.addEventListener('click', function(e){
              var opt = e.target.closest('.order-customer-opt');
              if (opt && opt.getAttribute('data-id')) selectCustomer(opt.getAttribute('data-id'), opt.getAttribute('data-name') || '');
            });
            document.addEventListener('click', function(e){ if (custPicker && !custPicker.contains(e.target)) hideCustDd(); });
          }
          function showErr(msg){ recognizeErr.textContent = msg || ''; recognizeErr.style.display = msg ? 'block' : 'none'; }
          function renderPreview(){
            previewTable.innerHTML = currentItems.map(function(it, i){
              return '<tr><td><input type="text" value="' + (it.rawName || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="rawName" style="width:100%;max-width:180px;"></td><td><input type="number" value="' + (it.quantity ?? '') + '" data-i="' + i + '" data-f="quantity" step="any" min="0" style="width:80px;"></td><td><input type="text" value="' + (it.unit || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="unit" style="width:60px;"></td><td><input type="text" value="' + (it.remark || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="remark" placeholder="例：攪2次" style="width:120px;"></td><td><input type="text" value="' + (it.amount || '').replace(/"/g, '&quot;') + '" data-i="' + i + '" data-f="amount" placeholder="可空白" style="width:80px;"></td><td>' + (it.productName || '待確認') + '</td></tr>';
            }).join('');
            previewTable.querySelectorAll('input').forEach(function(inp){
              inp.addEventListener('change', function(){ var i = parseInt(this.getAttribute('data-i'),10); var f = this.getAttribute('data-f'); if(currentItems[i]) currentItems[i][f] = this.value; if(f==='quantity') currentItems[i].quantity = parseFloat(this.value)||0; });
            });
            itemsJson.value = JSON.stringify(currentItems);
          }
          recognizeBtn.addEventListener('click', function(){
            showErr('');
            var text = rawMessage.value.trim();
            var file = imageFile.files[0];
            if (!text && !file) { showErr('請貼上文字或選擇一張圖片'); return; }
            recognizeBtn.disabled = true;
            recognizeBtn.textContent = '解析中…';
            var formData = new FormData();
            formData.append('raw_message', text);
            var custEl = document.getElementById('orderCustomerId');
            if (custEl && custEl.value) formData.append('customer_id', custEl.value);
            var subClientEl = document.getElementById('subClientIdInput');
            if (subClientEl && subClientEl.value.trim()) formData.append('sub_client_id', subClientEl.value.trim());
            if (file) formData.append('image', file);
            fetch('/admin/api/logistics/recognize', { method: 'POST', body: formData, credentials: 'same-origin' })
              .then(function(r){
                return r.text().then(function(t){
                  try { return { ok: r.ok, data: JSON.parse(t), rawText: t }; }
                  catch (e) { return { ok: false, data: { error: '伺服器回傳非 JSON（可能未登入或逾時）。請重新整理後再試。' }, rawText: t }; }
                });
              })
              .then(function(result){
                recognizeBtn.disabled = false;
                recognizeBtn.textContent = '解析並預覽品項';
                if (!result.ok || result.data.error) { showErr(result.data.error || '解析失敗'); return; }
                if (result.data.raw_message) rawMessage.value = result.data.raw_message;
                currentItems = result.data.items || [];
                renderPreview();
                previewBlock.style.display = 'block';
              })
              .catch(function(){ recognizeBtn.disabled = false; recognizeBtn.textContent = '解析並預覽品項'; showErr('請求失敗（請檢查網路或稍後再試）'); });
          });
          saveOrderBtn.addEventListener('click', function(){
            // [fix 2026-07-08] 防連點重複送出：按下即 disable，避免建立兩筆重複紙本訂單
            if (saveOrderBtn.dataset.submitting) return;
            saveOrderBtn.dataset.submitting = '1';
            saveOrderBtn.disabled = true;
            itemsJson.value = JSON.stringify(currentItems);
            form.submit();
          });
          if (reRecognizeBtn) reRecognizeBtn.addEventListener('click', function(){
            if (recognizeBtn && !recognizeBtn.disabled)
              recognizeBtn.click();
          });
          var fillWholesaleBtn = document.getElementById('fillWholesaleBtn');
          var wholesaleMsg = document.getElementById('wholesaleMsg');
          if (fillWholesaleBtn) fillWholesaleBtn.addEventListener('click', function(){
            var orderDate = document.querySelector('#newOrderForm input[name="order_date"]');
            var date = orderDate ? orderDate.value : new Date().toISOString().slice(0, 10);
            if (!date) { wholesaleMsg.textContent = '請先選擇訂單日期'; return; }
            wholesaleMsg.textContent = '取得批發行情中…';
            fillWholesaleBtn.disabled = true;
            fetch('/admin/api/logistics/wholesale-prices?date=' + encodeURIComponent(date))
              .then(function(r){ return r.json(); })
              .then(function(data){
                fillWholesaleBtn.disabled = false;
                if (data.error) { wholesaleMsg.textContent = data.error; return; }
                var prices = data.prices || [];
                if (prices.length === 0) { wholesaleMsg.textContent = data.message || '該日尚無台北批發行情'; return; }
                var normalized = function(s){ return (s || '').toString().trim().replace(/\s+/g, ''); };
                var matched = 0;
                currentItems.forEach(function(it){
                  var name = normalized(it.rawName || it.productName || '');
                  if (!name) return;
                  var found = null;
                  for (var i = 0; i < prices.length; i++) {
                    var crop = normalized(prices[i].cropName || '');
                    if (crop === name || crop.indexOf(name) !== -1 || name.indexOf(crop) !== -1) { found = prices[i]; break; }
                  }
                  if (!found && name.length >= 2) {
                    for (var j = 0; j < prices.length; j++) {
                      if (normalized(prices[j].cropName || '').slice(0, 2) === name.slice(0, 2)) { found = prices[j]; break; }
                    }
                  }
                  if (found) {
                    var rp = found.midPrice != null ? found.midPrice : (found.highPrice != null ? found.highPrice : (found.lowPrice != null ? found.lowPrice : (found.avgPrice != null ? found.avgPrice : null)));
                    if (rp != null) { it.amount = String(rp); matched++; }
                  }
                });
                renderPreview();
                var hintExtra = (data.hint || '').trim();
                wholesaleMsg.textContent = '已帶入 ' + matched + ' 筆台北批發參考價（優先中價，元/公斤），共 ' + prices.length + ' 筆行情。' + (hintExtra ? (' ' + hintExtra) : '');
              })
              .catch(function(){
                fillWholesaleBtn.disabled = false;
                wholesaleMsg.textContent = '取得批發行情失敗，請稍後再試。';
              });
          });
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("新增紙本訂單", body, "logistics", res));
    });
    router.get("/logistics/market", async (req, res) => {
        const reqDate = (req.query.date || "").toString().trim() || new Date().toISOString().slice(0, 10);
        let dateStr = reqDate;      // 實際顯示的資料日期（可能因休市/尚未更新而退回最近營業日）
        let prices = [];
        let msg = "";
        let snapSource = "";
        let statusCode = "";
        let apiErrors = [];
        let fellBack = false;       // 是否退回到最近營業日
        // 蔬菜／水果 分類（比照官網；預設看蔬菜）。農業部種類代碼 N05=水果、N04=蔬菜。
        const catParam = (req.query.cat || "veg").toString();
        const cat = ["veg", "fruit", "all"].includes(catParam) ? catParam : "veg";
        if (/^\d{4}-\d{2}-\d{2}$/.test(reqDate)) {
            try {
                // [fix 2026-07-08] 預設先讀本地快照（秒開）；按「更新」(?refresh=1) 才即時打農業部 API。
                const forceApi = req.query.refresh === "1";
                let snap = null;
                if (!forceApi) {
                    const cached = await (0, wholesale_snapshot_js_1.loadWholesaleMarketSnapshot)(db, reqDate);
                    if (cached && cached.length) {
                        snap = { prices: cached, source: "snapshot", status: "snapshot", apiErrors: [], rawCount: cached.length };
                    }
                }
                if (!snap) {
                    snap = await (0, wholesale_snapshot_js_1.loadOrFetchWholesaleMarketPrices)(db, reqDate);
                }
                // [fix 2026-07-08] 農業部 API 通常晚 1~2 天更新；該日無資料時退回「最近一個有資料的營業日」，
                // 讓顯示價格與臺北農產官網一致（官網也是顯示前一營業日）。
                if ((!snap.prices || !snap.prices.length)) {
                    const latest = await (0, wholesale_snapshot_js_1.getLatestWholesaleSnapshotDate)(db);
                    if (latest && latest !== reqDate) {
                        const alt = await (0, wholesale_snapshot_js_1.loadWholesaleMarketSnapshot)(db, latest);
                        if (alt && alt.length) {
                            snap = { prices: alt, source: "snapshot", status: "snapshot", apiErrors: [], rawCount: alt.length };
                            dateStr = latest;
                            fellBack = true;
                        }
                    }
                }
                prices = snap.prices || [];
                snapSource = snap.source || "";
                statusCode = snap.status || "";
                apiErrors = Array.isArray(snap.apiErrors) ? snap.apiErrors : [];
                if (!prices.length) {
                    if (statusCode === "network_error") msg = `❌ 連不上農業部 API（無本地快照可用）。${apiErrors.length ? "詳細：" + apiErrors.join(" / ") : ""}`;
                    else if (statusCode === "empty") msg = "📭 該日 API 0 筆 — 多為休市或資料尚未更新；可按「更新」抓最新，或點下方歷史查詢看過往。";
                    else msg = "❌ 讀取行情失敗（不明原因）。";
                }
            }
            catch (e) {
                msg = "❌ 讀取行情例外：" + (e?.message || String(e)).slice(0, 200);
            }
        }
        else {
            msg = "日期格式錯誤，請使用 YYYY-MM-DD。";
        }
        const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get("line_price_prefix_rules");
        const rulesText = row?.value || JSON.stringify({ "*": 2, LM: 10 }, null, 2);
        // 價格一律顯示 1 位小數；交易量顯示整數（千分位）
        const fmtP = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
        const fmtV = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }));
        // 較前日／較前月：抓「前一個有資料日」與「約前 28 天最接近日」的中價做對照（依 料號|市場 比對）
        let prevDay = null, prevMonth = null, dayMap = null, monMap = null;
        if (prices.length && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            try {
                const dts = await db.prepare("SELECT DISTINCT record_date FROM wholesale_market_snapshots WHERE record_date < ? ORDER BY record_date DESC").all(dateStr);
                const dlist = (dts || []).map((r) => r.record_date);
                prevDay = dlist[0] || null;
                const target = new Date(dateStr + "T00:00:00Z").getTime() - 28 * 86400000;
                for (const d of dlist) { if (new Date(d + "T00:00:00Z").getTime() <= target) { prevMonth = d; break; } }
                const buildMap = async (d) => { if (!d) return null; const list = await (0, wholesale_snapshot_js_1.loadWholesaleMarketSnapshot)(db, d); const m = {}; for (const p of list) { m[(p.cropCode || p.cropName) + "|" + (p.marketName || "")] = p.midPrice; } return m; };
                dayMap = await buildMap(prevDay);
                monMap = await buildMap(prevMonth);
            } catch (_) { /* 對照資料缺就略過 */ }
        }
        const chgCell = (cur, prev) => {
            if (cur == null || prev == null || !prev) return `<td style="text-align:right;color:var(--txt-3);font-size:12px;">—</td>`;
            const pct = (cur - prev) / prev * 100;
            const up = pct > 0.05, dn = pct < -0.05;
            const col = up ? "#dc2626" : (dn ? "#16a34a" : "#787774");
            return `<td style="text-align:right;font-variant-numeric:tabular-nums;color:${col};font-size:12px;white-space:nowrap;">${up ? "▲" : (dn ? "▼" : "")}${pct > 0 ? "+" : ""}${pct.toFixed(1)}%</td>`;
        };
        // 依蔬菜／水果篩選要顯示的列（種類代碼 N05=水果）
        const isFruit = (p) => (p.categoryCode || "") === "N05";
        const catFilter = cat === "fruit" ? isFruit : (cat === "all" ? () => true : (p) => !isFruit(p));
        const shown = prices.filter(catFilter);
        const rows = shown.slice(0, 2000).map((p) => {
            const key = `${(p.cropCode || "")} ${(p.cropName || "")} ${(p.marketName || "")}`.toLowerCase();
            const mkKey = (p.cropCode || p.cropName) + "|" + (p.marketName || "");
            const dCell = dayMap ? chgCell(p.midPrice, dayMap[mkKey]) : "";
            const mCell = monMap ? chgCell(p.midPrice, monMap[mkKey]) : "";
            return `<tr data-k="${escapeAttr(key)}"><td style="font-variant-numeric:tabular-nums;color:var(--txt-3);">${escapeHtml(p.cropCode || "—")}</td><td>${escapeHtml(p.cropName || "")}</td><td style="color:var(--txt-3);font-size:12px;">${escapeHtml(p.marketName || "")}</td><td style="text-align:right;font-variant-numeric:tabular-nums;">${fmtP(p.highPrice)}</td><td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${fmtP(p.midPrice)}</td><td style="text-align:right;font-variant-numeric:tabular-nums;">${fmtP(p.lowPrice)}</td><td style="text-align:right;font-variant-numeric:tabular-nums;">${fmtP(p.avgPrice)}</td>${dCell}${mCell}<td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--txt-3);">${fmtV(p.volume)}</td></tr>`;
        }).join("");
        const colCount = 8 + (dayMap ? 1 : 0) + (monMap ? 1 : 0);
        const sourceTag = snapSource === "api" ? `<span class="sf-pill" style="background:#e7f5e9;color:#047857;">即時 API</span>`
            : snapSource === "snapshot" ? `<span class="sf-pill" style="background:#fef3c7;color:#92400e;">本地快照</span>`
            : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 行情報表</div>
        <div class="sf-seg" style="margin:2px 0 14px;display:inline-flex;">
          <button type="button" class="active" onclick="location.href='/admin/logistics/market'">北農行情</button>
          <button type="button" onclick="location.href='/admin/logistics/livestock'">畜產雞蛋行情</button>
        </div>
        <h1 class="notion-page-title">北農行情 — 台北一、台北二 批發</h1>
        <p class="notion-hint">資料來源為<a href="${wholesale_price_js_1.TAPMC_PRICE_URL}" target="_blank" rel="noopener">臺北農產運銷「單日交易行情」</a>同一批發市場（農業部開放資料）。價格單位<strong>元／公斤</strong>、交易量<strong>公斤</strong>。每日自動抓存本地快照可回查。</p>
        <div style="display:flex;align-items:center;gap:10px;margin:4px 0 10px;flex-wrap:wrap;">
          <span style="font-size:15px;font-weight:600;">資料日期 ${escapeHtml(dateStr)}</span>${sourceTag}
          ${fellBack ? `<span class="sf-pill" style="background:#eef2ff;color:#3730a3;">已自動顯示最近營業日（${escapeHtml(reqDate)} 尚無資料）</span>` : ""}
          ${prices.length ? `<span style="font-size:12px;color:var(--txt-3);">${cat === "fruit" ? "水果" : cat === "all" ? "全部" : "蔬菜"} ${shown.length} 筆</span>` : ""}
        </div>
        ${req.query.ok === "1" ? '<p class="notion-msg ok">已儲存加價規則。</p>' : ""}
        ${req.query.err === "rules" ? '<p class="notion-msg err">規則格式錯誤，請輸入 JSON 物件。</p>' : ""}
        <form method="get" action="/admin/logistics/market" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
          <label>日期 <input type="date" name="date" value="${escapeAttr(reqDate)}"></label>
          <input type="hidden" name="cat" value="${escapeAttr(cat)}">
          <button type="submit" class="btn">查詢</button>
          <a href="/admin/logistics/market?date=${escapeAttr(reqDate)}&cat=${cat}&refresh=1" class="btn btn-primary" title="即時向農業部 API 抓取（可能需數秒）">更新最新</a>
          <a href="/admin/logistics/market/history" class="btn" title="查品項的每日走勢與折線圖">歷史查詢</a>
          ${shown.length ? `<a href="/admin/logistics/market/export.csv?date=${escapeAttr(dateStr)}&cat=${cat}" class="btn">下載 CSV</a><a href="/admin/logistics/market/export.xlsx?date=${escapeAttr(dateStr)}&cat=${cat}" class="btn">下載 Excel</a>` : ""}
        </form>
        ${msg ? `<p class="notion-msg warn" style="margin:8px 0;padding:8px 12px;border-radius:6px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;">${escapeHtml(msg)}</p>` : ""}
        ${prices.length ? `<div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:10px;">${[["veg", "蔬菜"], ["fruit", "水果"], ["all", "全部"]].map(([v, label], i) => `<a href="/admin/logistics/market?date=${escapeAttr(dateStr)}&cat=${v}" style="padding:7px 18px;font-size:14px;text-decoration:none;${i < 2 ? "border-right:1px solid var(--border);" : ""}${cat === v ? "background:#2563eb;color:#fff;font-weight:600;" : "color:var(--txt-2);background:#fff;"}">${label}</a>`).join("")}</div>` : ""}
        ${prices.length ? `<input id="mktSearch" type="search" placeholder="搜尋品名或品號…" oninput="(function(q){q=q.toLowerCase();document.querySelectorAll('#mktTable tbody tr').forEach(function(tr){tr.style.display=(!q||(tr.getAttribute('data-k')||'').indexOf(q)>=0)?'':'none';});})(this.value)" style="width:100%;max-width:360px;padding:8px 12px;margin-bottom:10px;border:1px solid var(--border);border-radius:8px;box-sizing:border-box;">` : ""}
        <div class="notion-card" style="padding:0;overflow-x:auto;">
          <table id="mktTable" style="min-width:640px;"><thead><tr><th>品號</th><th>品名</th><th>市場</th><th style="text-align:right;">上價</th><th style="text-align:right;">中價</th><th style="text-align:right;">下價</th><th style="text-align:right;">平均</th>${dayMap ? `<th style="text-align:right;" title="與 ${escapeAttr(prevDay || "")} 中價相比">較前日</th>` : ""}${monMap ? `<th style="text-align:right;" title="與 ${escapeAttr(prevMonth || "")} 中價相比">較前月</th>` : ""}<th style="text-align:right;">交易量(kg)</th></tr></thead><tbody>${rows || `<tr><td colspan='${colCount}' style='color:#999;text-align:center;padding:24px;'>無資料</td></tr>`}</tbody></table>
        </div>
        <div class="notion-card" style="margin-top:16px;">
          <h2 style="margin-top:0;">LINE 報價加價規則</h2>
          <p class="notion-hint">格式為 JSON，key 為 ERP 料號前綴、value 為加價。<code>*</code> 代表預設。例：<code>{"*":2,"LM":10}</code>。</p>
          <form method="post" action="/admin/logistics/market/rules">
            <textarea name="rules_json" rows="8" style="width:100%;box-sizing:border-box;">${escapeHtml(rulesText)}</textarea>
            <p style="margin-top:8px;"><button type="submit" class="btn btn-primary">儲存規則</button></p>
          </form>
        </div>
      `;
        res.type("text/html").send(notionPage("北農行情", body, "logistics-reports", res));
    });

    // 匯出讀本地快照（秒回）；該日無快照才即時抓一次。cat: veg/fruit/all（種類代碼 N05=水果）
    async function getWholesaleForExport(dateStr, cat = "all") {
        let list = await (0, wholesale_snapshot_js_1.loadWholesaleMarketSnapshot)(db, dateStr);
        if (!list || !list.length) {
            const snap = await (0, wholesale_snapshot_js_1.loadOrFetchWholesaleMarketPrices)(db, dateStr);
            list = snap.prices || [];
        }
        if (cat === "fruit") return list.filter((p) => (p.categoryCode || "") === "N05");
        if (cat === "veg") return list.filter((p) => (p.categoryCode || "") !== "N05");
        return list;
    }
    const exportCat = (req) => { const c = (req.query.cat || "all").toString(); return ["veg", "fruit", "all"].includes(c) ? c : "all"; };
    router.get("/logistics/market/export.csv", async (req, res) => {
        const dateStr = (req.query.date || "").toString().trim() || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { res.status(400).send("date 格式錯誤：需為 YYYY-MM-DD（例 2026-07-21）。請回上一頁修改日期後再匯出。"); return; }
        const list = await getWholesaleForExport(dateStr, exportCat(req));
        const lines = ["日期,品號,品名,市場,上價,中價,下價,平均價,交易量(kg)"];
        for (const p of list) {
            const cells = [dateStr, p.cropCode || "", p.cropName || "", p.marketName || "", p.highPrice ?? "", p.midPrice ?? "", p.lowPrice ?? "", p.avgPrice ?? "", p.volume ?? ""].map((v) => {
                const s = String(v ?? "");
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            });
            lines.push(cells.join(","));
        }
        res.set("Content-Type", "text/csv; charset=utf-8");
        res.set("Content-Disposition", `attachment; filename="wholesale_${dateStr}.csv"`);
        res.send("﻿" + lines.join("\n"));
    });

    router.get("/logistics/market/export.xlsx", async (req, res) => {
        const dateStr = (req.query.date || "").toString().trim() || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { res.status(400).send("date 格式錯誤：需為 YYYY-MM-DD（例 2026-07-21）。請回上一頁修改日期後再匯出。"); return; }
        const list = await getWholesaleForExport(dateStr, exportCat(req));
        const data = [["日期", "品號", "品名", "市場", "上價", "中價", "下價", "平均價", "交易量(kg)"]];
        for (const p of list) {
            data.push([dateStr, p.cropCode || "", p.cropName || "", p.marketName || "", p.highPrice ?? null, p.midPrice ?? null, p.lowPrice ?? null, p.avgPrice ?? null, p.volume ?? null]);
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "北農行情");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition", `attachment; filename="wholesale_${dateStr}.xlsx"`);
        res.send(buf);
    });

    // ── 北農行情 歷史查詢 JSON（供互動折線圖）──────────────────
    router.get("/logistics/market/history.json", async (req, res) => {
        try {
            const cropsParam = (req.query.crops || "").toString();
            let crops = cropsParam.split(",").map((s) => s.trim()).filter(Boolean);
            if (req.query.crop) crops.push(String(req.query.crop).trim());
            crops = [...new Set(crops)].slice(0, 8);
            const start = (req.query.start || "").toString();
            const end = (req.query.end || "").toString();
            const series = {};
            for (const c of crops) {
                let s = await (0, wholesale_snapshot_js_1.loadWholesaleCropHistory)(db, c, 0);
                if (/^\d{4}-\d{2}-\d{2}$/.test(start)) s = s.filter((x) => x.date >= start);
                if (/^\d{4}-\d{2}-\d{2}$/.test(end)) s = s.filter((x) => x.date <= end);
                series[c] = s.map((x) => ({ date: x.date, mid: x.mid, high: x.high, low: x.low, avg: x.avg, volume: x.volume }));
            }
            res.json({ ok: true, crops, series });
        }
        catch (e) {
            res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
        }
    });

    // ── 北農行情 歷史查詢頁（模糊搜尋＋多選＋區間＋多線折線圖＋游標詳情）──────
    router.get("/logistics/market/history", async (req, res) => {
        const cropList = await (0, wholesale_snapshot_js_1.listWholesaleCrops)(db);
        const latestDate = (await (0, wholesale_snapshot_js_1.getLatestWholesaleSnapshotDate)(db)) || new Date().toISOString().slice(0, 10);
        // 預選品項（支援 ?crops=a,b 或舊的 ?crop=a）
        let selected = (req.query.crops || "").toString().split(",").map((s) => s.trim()).filter(Boolean);
        if (req.query.crop) selected.push(String(req.query.crop).trim());
        selected = [...new Set(selected)].slice(0, 8);
        const selSet = new Set(selected);
        const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test((s || "").toString()) ? s.toString() : null);
        const endDefault = isoDate(req.query.end) || latestDate;
        const startDefault = isoDate(req.query.start) || new Date(new Date(latestDate + "T00:00:00Z").getTime() - 90 * 86400000).toISOString().slice(0, 10);
        const checklist = cropList.map((c) => `<label class="crop-item" data-t="${escapeAttr(((c.cropCode || "") + " " + c.cropName).toLowerCase())}" style="display:flex;align-items:center;gap:7px;padding:4px 6px;font-size:13px;cursor:pointer;border-radius:5px;">`
            + `<input type="checkbox" class="crop-cb" value="${escapeAttr(c.cropName)}"${selSet.has(c.cropName) ? " checked" : ""}>`
            + `<span style="color:var(--txt-3);font-variant-numeric:tabular-nums;min-width:32px;">${escapeHtml(c.cropCode || "")}</span>`
            + `<span>${escapeHtml(c.cropName)}</span>`
            + `<span style="color:var(--txt-3);font-size:11px;margin-left:auto;">${c.dayCount}天</span></label>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / <a href="/admin/logistics/market">北農行情</a> / 歷史查詢</div>
        <h1 class="notion-page-title">北農行情 — 歷史走勢查詢</h1>
        <p class="notion-hint">左側勾選品項（可搜尋、可多選對照），選日期區間後看每日中價折線走勢（台北一／二以交易量加權合併）。游標移到圖上即顯示當日各品項價格。</p>
        ${req.query.msg ? `<p class="notion-msg ok" style="padding:10px 12px;background:#e7f5e9;border:1px solid #b7e0c0;border-radius:6px;color:#047857;">${escapeHtml((req.query.msg || "").toString().slice(0, 200))}</p>` : ""}
        ${cropList.length === 0 ? `<p class="notion-msg warn" style="padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;color:#92400e;">目前還沒有歷史資料，請先按下方「回補歷史」抓過去資料。</p>` : ""}
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
          <div class="notion-card" style="flex:0 0 260px;max-width:100%;">
            <input id="cropFilter" type="search" placeholder="搜尋品名或品號…" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;box-sizing:border-box;margin-bottom:8px;">
            <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px;">${checklist || '<div style="padding:16px;color:var(--txt-3);font-size:13px;">無品項</div>'}</div>
            <p style="font-size:11px;color:var(--txt-3);margin:8px 0 0;">最多同時比較 8 項</p>
          </div>
          <div style="flex:1;min-width:320px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
              <label>起 <input id="startD" type="date" value="${escapeAttr(startDefault)}" style="padding:6px 8px;border:1px solid var(--border);border-radius:8px;"></label>
              <label>迄 <input id="endD" type="date" value="${escapeAttr(endDefault)}" style="padding:6px 8px;border:1px solid var(--border);border-radius:8px;"></label>
              <button id="drawBtn" type="button" class="btn btn-primary">更新圖表</button>
              <form method="post" action="/admin/logistics/market/history/backfill" style="display:inline-flex;gap:6px;align-items:center;margin-left:auto;">
                <select name="days" style="padding:6px 8px;border:1px solid var(--border);border-radius:8px;"><option value="90">90 天</option><option value="180">180 天</option><option value="365" selected>365 天（一年）</option></select>
                <button type="submit" class="btn" title="向農業部抓過去區間資料存入本地" onclick="this.textContent='回補中…';">回補歷史</button>
              </form>
            </div>
            <div class="notion-card" style="position:relative;margin-bottom:12px;">
              <div id="histLegend" style="margin-bottom:6px;"></div>
              <div id="histChart"></div>
              <div id="histTip" style="position:absolute;display:none;pointer-events:none;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.12);padding:8px 10px;font-size:12px;z-index:10;min-width:120px;"></div>
            </div>
            <div id="histTable" class="notion-card" style="padding:0;overflow-x:auto;"></div>
          </div>
        </div>
        <script>
        (function(){
          var PALETTE=["#2563eb","#dc2626","#16a34a","#d97706","#7c3aed","#0891b2","#db2777","#65a30d"];
          var chartBox=document.getElementById("histChart"),legendBox=document.getElementById("histLegend"),tableBox=document.getElementById("histTable"),tip=document.getElementById("histTip");
          var fbox=document.getElementById("cropFilter");
          if(fbox)fbox.addEventListener("input",function(){var q=this.value.toLowerCase(),items=document.querySelectorAll(".crop-item");for(var i=0;i<items.length;i++){var t=items[i].getAttribute("data-t")||"";items[i].style.display=(!q||t.indexOf(q)>=0)?"flex":"none";}});
          function selected(){var cbs=document.querySelectorAll(".crop-cb"),out=[];for(var i=0;i<cbs.length;i++){if(cbs[i].checked)out.push(cbs[i].value);}return out;}
          function msg(t){chartBox.innerHTML='<div style="height:260px;display:flex;align-items:center;justify-content:center;color:#9b9a97;text-align:center;padding:0 16px;">'+t+'</div>';legendBox.innerHTML="";tableBox.innerHTML="";}
          function draw(data){
            var crops=data.crops||[],series=data.series||{};
            if(!crops.length){msg("請在左側勾選品項（可多選對照）");return;}
            var dset={};crops.forEach(function(c){(series[c]||[]).forEach(function(p){dset[p.date]=1;});});
            var dates=Object.keys(dset).sort();
            if(dates.length<2){msg("此區間資料不足 2 天，畫不出折線（可換更長區間或先按右上『回補歷史』）");return;}
            var maps={},allv=[];
            crops.forEach(function(c){var m={};(series[c]||[]).forEach(function(p){if(p.mid!=null){m[p.date]=p.mid;allv.push(p.mid);}});maps[c]=m;});
            if(!allv.length){msg("無中價資料");return;}
            var mn=Math.min.apply(null,allv),mx=Math.max.apply(null,allv);if(mn===mx){mn-=1;mx+=1;}
            var W=900,H=280,padL=46,padR=14,padT=14,padB=28;
            function X(i){return padL+(W-padL-padR)*(i/(dates.length-1));}
            function Y(v){return padT+(H-padT-padB)*(1-(v-mn)/(mx-mn));}
            var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block;">';
            for(var k=0;k<=3;k++){var vv=mn+(mx-mn)*(k/3),yy=Y(vv);svg+='<line x1="'+padL+'" y1="'+yy.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+yy.toFixed(1)+'" stroke="#eee"/><text x="'+(padL-6)+'" y="'+(yy+3).toFixed(1)+'" font-size="10" fill="#9b9a97" text-anchor="end">'+vv.toFixed(0)+'</text>';}
            var step=Math.max(1,Math.ceil(dates.length/7));
            for(var i=0;i<dates.length;i+=step){svg+='<text x="'+X(i).toFixed(1)+'" y="'+(H-8)+'" font-size="10" fill="#9b9a97" text-anchor="middle">'+dates[i].slice(5).replace("-","/")+'</text>';}
            crops.forEach(function(c,ci){var col=PALETTE[ci%PALETTE.length],m=maps[c],d="",started=false;for(var i=0;i<dates.length;i++){var v=m[dates[i]];if(v==null)continue;d+=(started?"L":"M")+X(i).toFixed(1)+","+Y(v).toFixed(1)+" ";started=true;}svg+='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round"/>';});
            svg+='<line id="hg" x1="0" y1="'+padT+'" x2="0" y2="'+(H-padB)+'" stroke="#bbb" stroke-dasharray="3,3" style="display:none"/>';
            svg+='<rect id="cap" x="'+padL+'" y="'+padT+'" width="'+(W-padL-padR)+'" height="'+(H-padT-padB)+'" fill="transparent"/></svg>';
            chartBox.innerHTML=svg;
            legendBox.innerHTML=crops.map(function(c,ci){return '<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:13px;"><span style="width:11px;height:11px;border-radius:2px;background:'+PALETTE[ci%PALETTE.length]+';display:inline-block;"></span>'+c+'</span>';}).join("");
            var th='<tr><th>日期</th>'+crops.map(function(c){return '<th style="text-align:right;">'+c+'</th>';}).join("")+'</tr>';
            var tb="";for(var j=dates.length-1;j>=0;j--){var dd=dates[j];tb+='<tr><td style="font-variant-numeric:tabular-nums;">'+dd+'</td>'+crops.map(function(c){var v=maps[c][dd];return '<td style="text-align:right;font-variant-numeric:tabular-nums;">'+(v==null?"—":Number(v).toFixed(1))+'</td>';}).join("")+'</tr>';}
            tableBox.innerHTML='<table style="min-width:'+(120+crops.length*90)+'px;"><thead>'+th+'</thead><tbody>'+tb+'</tbody></table>';
            var svgEl=chartBox.querySelector("svg"),cap=document.getElementById("cap"),hg=document.getElementById("hg");
            cap.addEventListener("mousemove",function(ev){var r=svgEl.getBoundingClientRect(),sx=(ev.clientX-r.left)/r.width*W,i=Math.round((sx-padL)/((W-padL-padR)/(dates.length-1)));if(i<0)i=0;if(i>dates.length-1)i=dates.length-1;var xx=X(i);hg.setAttribute("x1",xx);hg.setAttribute("x2",xx);hg.style.display="";var html='<div style="font-weight:600;margin-bottom:3px;">'+dates[i]+'</div>';crops.forEach(function(c,ci){var v=maps[c][dates[i]];html+='<div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:'+PALETTE[ci%PALETTE.length]+';">'+c+'</span><span style="font-variant-numeric:tabular-nums;">'+(v==null?"—":Number(v).toFixed(1))+'</span></div>';});tip.innerHTML=html;tip.style.display="block";var bx=chartBox.getBoundingClientRect(),px=ev.clientX-bx.left+14;if(px>bx.width-150)px=ev.clientX-bx.left-140;tip.style.left=px+"px";tip.style.top=(ev.clientY-bx.top+14)+"px";});
            cap.addEventListener("mouseleave",function(){hg.style.display="none";tip.style.display="none";});
          }
          function load(){var crops=selected().slice(0,8),s=document.getElementById("startD").value,e=document.getElementById("endD").value;if(!crops.length){draw({crops:[],series:{}});return;}msg("載入中…");var url="/admin/logistics/market/history.json?crops="+encodeURIComponent(crops.join(","))+"&start="+encodeURIComponent(s)+"&end="+encodeURIComponent(e);fetch(url).then(function(r){return r.json();}).then(function(j){if(!j.ok){msg("載入失敗："+(j.error||""));return;}draw(j);}).catch(function(err){msg("載入失敗："+err);});}
          document.getElementById("drawBtn").addEventListener("click",load);
          var cbs=document.querySelectorAll(".crop-cb");for(var i=0;i<cbs.length;i++){cbs[i].addEventListener("change",load);}
          if(selected().length)load();else draw({crops:[],series:{}});
        })();
        </script>
      `;
        res.type("text/html").send(notionPage("北農行情歷史", body, "logistics-reports", res));
    });

    // 回補歷史（向農業部抓區間資料存本地）
    // [fix 2026-07-14] GET→POST：這是會寫 DB 的動作，GET 連結會被 SameSite=Lax 的頂層導航
    // 帶 cookie 觸發（外部連結即可打），且瀏覽器預抓可能誤觸。表單已同步改 method="post"。
    router.post("/logistics/market/history/backfill", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const daysRaw = parseInt((req.body?.days || req.query.days || "90").toString(), 10);
        const days = daysRaw > 0 && daysRaw <= 400 ? daysRaw : 90;
        const crops = (req.body?.crops || req.query.crops || req.query.crop || "").toString();
        try {
            const r = await (0, wholesale_snapshot_js_1.backfillWholesaleHistory)(db, days);
            const q = crops ? `?crops=${encodeURIComponent(crops)}&msg=` : "?msg=";
            res.redirect(`/admin/logistics/market/history${q}${encodeURIComponent(`已回補 ${r.days} 個交易日、${r.total} 筆`)}`);
        }
        catch (e) {
            res.redirect(`/admin/logistics/market/history?msg=${encodeURIComponent("回補失敗：" + (e?.message || String(e)).slice(0, 120))}`);
        }
    });

    // ============================================================
    // 畜產／家禽行情（毛豬、白肉雞、雞蛋）— 農業部開放資料，自動抓＋每日快照
    // ============================================================
    const LIVESTOCK_CAT_LABEL = { pig: "🐖 毛豬", chicken: "🐓 白肉雞", egg: "🥚 雞蛋" };
    /** 取要顯示的資料：優先今日快照；沒有就即時抓一次（並寫快照）。 */
    async function getLivestockForDisplay(dateStr) {
        const today = dateStr || new Date().toISOString().slice(0, 10);
        const snap = await (0, livestock_price_js_1.loadLivestockSnapshot)(db, today);
        if (snap.length) return { prices: snap, dataDate: today, source: "snapshot" };
        // 今日還沒有快照 → 找最近一天快照
        const latest = await db.prepare("SELECT record_date FROM livestock_price_snapshots ORDER BY record_date DESC LIMIT 1").get();
        if (latest?.record_date) {
            const s2 = await (0, livestock_price_js_1.loadLivestockSnapshot)(db, latest.record_date);
            if (s2.length) return { prices: s2, dataDate: latest.record_date, source: "snapshot" };
        }
        // 完全沒快照 → 即時抓一次
        const r = await (0, livestock_price_js_1.loadOrFetchLivestockPrices)(db, today);
        return { prices: r.prices, dataDate: r.dataDate, source: r.source, errors: r.errors };
    }
    router.get("/logistics/livestock", async (req, res) => {
        const okMsg = req.query.ok === "updated" ? "已更新為最新行情。" : "";
        const errMsg = req.query.err ? String(req.query.err) : "";
        const view = await getLivestockForDisplay();
        const prices = view.prices || [];
        const byCat = { pig: [], chicken: [], egg: [] };
        for (const p of prices) { if (byCat[p.category]) byCat[p.category].push(p); }
        const fmtP = (v) => (v == null ? "—" : (Math.round(Number(v) * 100) / 100).toString());
        const hist = await livestock_price_js_1.loadLivestockHistory(db, 30);
        const thr = Math.max(0.5, Number(process.env.LIVESTOCK_MOVE_THRESHOLD_PCT || 5));
        // 線條圖示（與 SF_ICONS 同風格：thin-line、currentColor）
        // 標準開源圖示（Tabler egg／pig、Lucide drumstick；24-grid 線條、currentColor）
        const catIcon = {
            egg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14.083c0 4.154 -2.966 6.74 -7 6.917c-4.2 0 -7 -2.763 -7 -6.917c0 -5.538 3.5 -11.09 7 -11.083c3.5 .007 7 5.545 7 11.083"/></svg>`,
            chicken: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23"/><path d="m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59"/></svg>`,
            pig: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 11v.01"/><path d="M16 3l0 3.803a6.019 6.019 0 0 1 2.658 3.197h1.341a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-1.342a6.008 6.008 0 0 1 -1.658 2.473v2.027a1.5 1.5 0 0 1 -3 0v-.583a6.04 6.04 0 0 1 -1 .083h-4a6.04 6.04 0 0 1 -1 -.083v.583a1.5 1.5 0 0 1 -3 0v-2l0 -.027a6 6 0 0 1 4 -10.473h2.5l4.5 -3"/></svg>`,
        };
        const catName = { egg: "雞蛋產地價", chicken: "白肉雞", pig: "毛豬全國均價" };
        const WDlabel = ["日", "一", "二", "三", "四", "五", "六"];
        const mmdd = (ds) => { const m = String(ds).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${Number(m[2])}/${Number(m[3])}` : String(ds); };
        const mmddw = (ds) => { const m = String(ds).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return String(ds); const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return `${Number(m[2])}/${Number(m[3])} 週${WDlabel[dt.getUTCDay()]}`; };
        // 折線圖（SVG 自繪）：日變動 >= 門檻標紅/綠點、每點可 hover 看詳情、底部標日期
        const sparkChart = (points, unit, uid) => {
            const pts = (points || []).filter((p) => p.v != null);
            if (pts.length < 2)
                return `<div style="height:96px;display:flex;align-items:center;justify-content:center;color:var(--txt-3);font-size:12px;">資料累積中（2 天以上才有折線）</div>`;
            const W = 320, H = 96, padL = 6, padR = 6, padT = 10, padB = 20;
            const vals = pts.map((p) => p.v);
            let mn = Math.min(...vals), mx = Math.max(...vals);
            if (mn === mx) { mn -= 1; mx += 1; }
            const X = (i) => padL + (W - padL - padR) * (i / (pts.length - 1));
            const Y = (v) => padT + (H - padT - padB) * (1 - (v - mn) / (mx - mn));
            const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
            const area = `M${X(0).toFixed(1)},${(H - padB).toFixed(1)} ` + pts.map((p, i) => `L${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ") + ` L${X(pts.length - 1).toFixed(1)},${(H - padB).toFixed(1)} Z`;
            const last = pts[pts.length - 1], first = pts[0];
            const col = (last.v - first.v) >= 0 ? "#dc2626" : "#16a34a";
            const gid = "lspg_" + (uid || "x");
            let dots = "", hovers = "";
            for (let i = 0; i < pts.length; i++) {
                const pctI = (i > 0 && pts[i - 1].v) ? ((pts[i].v - pts[i - 1].v) / pts[i - 1].v) * 100 : null;
                const title = `${mmddw(pts[i].d)}　${pts[i].v} ${unit}` + (pctI != null ? `（${pctI >= 0 ? "+" : ""}${pctI.toFixed(1)}%）` : "");
                if (pctI != null && Math.abs(pctI) >= thr) {
                    dots += `<circle cx="${X(i).toFixed(1)}" cy="${Y(pts[i].v).toFixed(1)}" r="3" fill="${pctI > 0 ? "#dc2626" : "#16a34a"}"/>`;
                }
                // 透明大點供游標 hover（JS tooltip 顯示日期+價格）
                hovers += `<circle class="lsp-pt" cx="${X(i).toFixed(1)}" cy="${Y(pts[i].v).toFixed(1)}" r="7" fill="transparent" data-t="${escapeAttr(title)}" data-c="${col}" style="pointer-events:all;cursor:crosshair;"></circle>`;
            }
            const midi = Math.floor((pts.length - 1) / 2);
            const axis = `<text x="${X(0).toFixed(1)}" y="${H - 4}" font-size="8" fill="#9b9a97" text-anchor="start">${mmdd(first.d)}</text>`
                + (pts.length > 4 ? `<text x="${X(midi).toFixed(1)}" y="${H - 4}" font-size="8" fill="#9b9a97" text-anchor="middle">${mmdd(pts[midi].d)}</text>` : "")
                + `<text x="${X(pts.length - 1).toFixed(1)}" y="${H - 4}" font-size="8" fill="#9b9a97" text-anchor="end">${mmdd(last.d)}</text>`;
            return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="96" preserveAspectRatio="none" style="display:block;overflow:visible;">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0.32"></stop><stop offset="0.9" stop-color="${col}" stop-opacity="0.02"></stop></linearGradient></defs>
        <path d="${area}" fill="url(#${gid})"></path>
        <path d="${line}" fill="none" stroke="${col}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"></path>
        ${dots}
        <circle cx="${X(pts.length - 1).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="2.8" fill="${col}"/>
        ${axis}
        ${hovers}
      </svg>`;
        };
        const changeBadge = (ch) => {
            if (ch.pct == null) return `<span style="font-size:12px;color:var(--txt-3);">今日</span>`;
            const up = ch.pct > 0, big = Math.abs(ch.pct) >= thr;
            const col = up ? "#dc2626" : (ch.pct < 0 ? "#16a34a" : "#787774");
            return `<span style="font-size:13px;font-weight:700;color:${col};">${up ? "▲" : (ch.pct < 0 ? "▼" : "●")} ${ch.pct > 0 ? "+" : ""}${ch.pct.toFixed(1)}%</span>${big ? `<span class="sf-pill" style="background:${up ? "#fef2f2" : "#e7f5e9"};color:${col};font-size:10px;margin-left:6px;">明顯${up ? "漲" : "跌"}</span>` : ""}`;
        };
        const metricCards = livestock_price_js_1.KEY_ITEMS.map((it) => {
            const ser = hist[it.key] || [];
            const ch = livestock_price_js_1.seriesChange(ser);
            return `<div class="sf-card" style="flex:1;min-width:240px;padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;color:var(--txt-1);"><span style="color:var(--txt-2);display:inline-flex;">${catIcon[it.key] || ""}</span>${catName[it.key] || it.title}</div>
          <div style="font-size:11px;color:var(--txt-3);">${it.unit}</div>
        </div>
        <div style="display:flex;align-items:baseline;gap:10px;margin:6px 0 1px;">
          <div style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;">${fmtP(ch.curr)}</div>
          <div>${changeBadge(ch)}</div>
        </div>
        <div style="font-size:11px;color:var(--txt-3);margin-bottom:6px;">${ch.prev != null ? `前一日 ${fmtP(ch.prev)}` : "尚無前一日"} · 近 30 天（游標指到看當日）</div>
        ${sparkChart(ser, it.unit, it.key)}
      </div>`;
        }).join("");
        // 日曆用：每日 → {egg,chicken,pig}
        const byDate = {};
        for (const key of ["egg", "chicken", "pig"]) {
            for (const p of (hist[key] || [])) { (byDate[p.d] = byDate[p.d] || {})[key] = p.v; }
        }
        const calDataJson = JSON.stringify(byDate).replace(/</g, "\\u003c");
        const bigMoves = livestock_price_js_1.KEY_ITEMS
            .map((it) => ({ it, ch: livestock_price_js_1.seriesChange(hist[it.key] || []) }))
            .filter((x) => x.ch.pct != null && Math.abs(x.ch.pct) >= thr);
        const moveBanner = bigMoves.length
            ? `<div style="background:#fffbe6;border:1px solid #ffe58f;color:#8a6d1a;padding:10px 14px;border-radius:8px;margin:8px 0;font-size:13px;">⚠ 有明顯漲跌（≥${thr}%）：${bigMoves.map((x) => `${x.it.title} ${x.ch.pct > 0 ? "🔺+" : "🔻"}${x.ch.pct.toFixed(1)}%`).join("；")}${process.env.LINE_MARKET_NOTIFY_TO ? "（會自動推播 LINE）" : "（尚未設 LINE 通知對象；設定 LINE_MARKET_NOTIFY_TO 即自動推播）"}</div>`
            : "";
        // 明細（統一 sf-card 樣式）
        const pigRows = byCat.pig
            .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
            .map((p) => {
            let d = "";
            try { d = p.extraJson ? (JSON.parse(p.extraJson).資料日 || "") : ""; } catch (_) { }
            return `<tr><td>${escapeHtml(p.marketName || "—")}</td><td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${fmtP(p.price)}</td><td style="color:var(--txt-3);font-size:12px;white-space:nowrap;">${escapeHtml(d)}</td></tr>`;
        }).join("");
        const simpleRows = (arr) => arr.map((p) => `<tr><td>${escapeHtml(p.itemLabel)}</td><td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${fmtP(p.price)}</td></tr>`).join("");
        const detailCard = (title, headLeft, bodyHtml, span) => `
      <div class="sf-card" style="flex:1;min-width:260px;padding:0;overflow:hidden;">
        <div style="padding:11px 14px;border-bottom:var(--hairline);font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;">${title}</div>
        <table class="sf-table" style="width:100%;font-size:14px;">
          <thead><tr><th style="text-align:left;">${headLeft}</th><th style="text-align:right;">價格</th>${span ? "<th style='text-align:right;'>資料日</th>" : ""}</tr></thead>
          <tbody>${bodyHtml || `<tr><td colspan="${span ? 3 : 2}" style="color:var(--txt-3);padding:14px;text-align:center;">— 無資料 —</td></tr>`}</tbody>
        </table>
      </div>`;
        const body = `
      <div class="sf-root" style="padding:20px 28px;display:flex;flex-direction:column;gap:14px;">
      <div class="sf-breadcrumb">行情報表</div>
      <div class="sf-seg" style="margin:0;display:inline-flex;align-self:flex-start;">
        <button type="button" onclick="location.href='/admin/logistics/market'">北農行情</button>
        <button type="button" class="active" onclick="location.href='/admin/logistics/livestock'">畜產雞蛋行情</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <h1 style="font-size:22px;font-weight:600;margin:0;">畜產雞蛋行情</h1>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:13px;color:var(--txt-3);">資料日：<strong>${escapeHtml(view.dataDate || "—")}</strong>${view.source === "snapshot" ? "（快照）" : ""}</span>
          <form method="post" action="/admin/logistics/livestock/refresh" style="display:inline;" onsubmit="var b=this.querySelector('button');if(b){b.disabled=true;b.textContent='更新中…';}"><button type="submit" class="sf-btn primary sm">更新</button></form>
          ${prices.length ? `<a href="/admin/logistics/livestock/export.csv" class="sf-btn sm">下載 CSV</a>` : ""}
        </div>
      </div>
      ${okMsg ? `<div class="sf-pill ok" style="align-self:flex-start;">${escapeHtml(okMsg)}</div>` : ""}
      ${errMsg ? `<div class="sf-pill bad" style="align-self:flex-start;">${escapeHtml(errMsg)}</div>` : ""}
      ${moveBanner}
      <div style="display:flex;gap:14px;flex-wrap:wrap;">${metricCards}</div>
      <p class="sf-hint" style="margin:0;color:var(--txt-3);font-size:12px;">折線為近 30 天走勢，紅點＝當日漲 ≥${thr}%、綠點＝跌 ≥${thr}%。資料來源：<a href="${livestock_price_js_1.SOURCE_URL}" target="_blank" rel="noopener">農業部開放資料</a>。每日自動抓存快照可回查；也可按「更新」即時抓。</p>
      <div style="display:flex;align-items:center;gap:7px;font-size:15px;font-weight:600;margin-top:6px;">
        <span style="color:var(--txt-2);display:inline-flex;"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/></svg></span>
        每日回查<span style="font-size:12px;font-weight:400;color:var(--txt-3);">— 點有藍點的日期，右側看當天三品項報價</span>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;">
        <div class="sf-card" id="lvCal" style="flex:0 0 300px;max-width:100%;padding:0;overflow:hidden;"></div>
        <div class="sf-card" id="lvDayPanel" style="flex:1;min-width:240px;padding:0;overflow:hidden;"></div>
      </div>
      <script>(function(){
        var DATA = ${calDataJson};
        var cal = document.getElementById('lvCal'), panel = document.getElementById('lvDayPanel');
        if(!cal||!panel) return;
        var dates = Object.keys(DATA).sort();
        var latest = dates.length ? dates[dates.length-1] : null;
        var WD = ['日','一','二','三','四','五','六'];
        var view = latest ? new Date(+latest.slice(0,4), +latest.slice(5,7)-1, 1) : new Date();
        function pad(n){ return (n<10?'0':'')+n; }
        function iso(y,m,d){ return y+'-'+pad(m+1)+'-'+pad(d); }
        function fmt(v,u){ return (v==null)?'—':((Math.round(v*100)/100)+' '+u); }
        function panelHtml(ds){
          var d = DATA[ds];
          var dt = new Date(+ds.slice(0,4), +ds.slice(5,7)-1, +ds.slice(8,10));
          var head = '<div style="padding:12px 16px;border-bottom:1px solid var(--notion-border,#eee);font-size:15px;font-weight:600;">'+ds+'（週'+WD[dt.getDay()]+'）行情概況</div>';
          if(!d) return head+'<div style="padding:16px;color:var(--txt-3);">當日無資料</div>';
          function row(n,v,u){ return '<div style="display:flex;justify-content:space-between;padding:11px 16px;border-bottom:1px solid var(--notion-border,#f0f0f0);"><span style="color:var(--txt-2);">'+n+'</span><span style="font-weight:700;font-variant-numeric:tabular-nums;">'+fmt(v,u)+'</span></div>'; }
          return head + row('雞蛋產地價', d.egg, '元/台斤') + row('白肉雞(2.0Kg)', d.chicken, '元/台斤') + row('毛豬全國均價', d.pig, '元/公斤');
        }
        function render(){
          var y = view.getFullYear(), m = view.getMonth();
          var first = new Date(y,m,1).getDay(), days = new Date(y,m+1,0).getDate();
          var h = '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--notion-border,#eee);">'
            + '<button type="button" id="lvPrev" class="sf-btn sm">‹</button>'
            + '<div style="font-weight:600;font-size:14px;">'+y+' 年 '+(m+1)+' 月</div>'
            + '<button type="button" id="lvNext" class="sf-btn sm">›</button></div>';
          h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:8px 10px 12px;">';
          for(var w=0;w<7;w++) h += '<div style="text-align:center;font-size:11px;color:var(--txt-3);padding:2px 0 4px;">'+WD[w]+'</div>';
          for(var b=0;b<first;b++) h += '<div></div>';
          for(var dd=1;dd<=days;dd++){
            var ds = iso(y,m,dd), has = !!DATA[ds];
            h += '<div class="lv-day'+(has?' has':'')+'" data-d="'+ds+'" style="text-align:center;padding:6px 0;border-radius:7px;font-size:13px;'+(has?'cursor:pointer;background:var(--bg-1,#f6f6f4);font-weight:600;':'color:var(--txt-3);')+'">'+dd+(has?'<div style="width:4px;height:4px;border-radius:50%;background:#2383e2;margin:3px auto 0;"></div>':'')+'</div>';
          }
          h += '</div>';
          cal.innerHTML = h;
          var pv=document.getElementById('lvPrev'), nx=document.getElementById('lvNext');
          if(pv) pv.onclick=function(){ view.setMonth(view.getMonth()-1); render(); };
          if(nx) nx.onclick=function(){ view.setMonth(view.getMonth()+1); render(); };
          Array.prototype.forEach.call(cal.querySelectorAll('.lv-day.has'), function(el){
            el.onclick=function(){
              Array.prototype.forEach.call(cal.querySelectorAll('.lv-day'), function(x){ x.style.outline=''; });
              el.style.outline='2px solid #2383e2';
              panel.innerHTML = panelHtml(el.getAttribute('data-d'));
            };
          });
        }
        render();
        panel.innerHTML = latest ? panelHtml(latest) : '<div style="padding:16px;color:var(--txt-3);">尚無資料，按上方「更新」抓取。</div>';
      })();</script>
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        ${detailCard(catIcon.egg + " 雞蛋（元/台斤）", "品項", simpleRows(byCat.egg), false)}
        ${detailCard(catIcon.chicken + " 白肉雞（元/台斤）", "品項", simpleRows(byCat.chicken), false)}
        ${detailCard(catIcon.pig + " 毛豬 各肉品市場（元/公斤）", "市場", pigRows, true)}
      </div>
      <div id="lspTip" style="position:fixed;z-index:60;pointer-events:none;background:#1f2430;color:#fff;font-size:11.5px;line-height:1.3;padding:4px 8px;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.28);opacity:0;transition:opacity .1s;white-space:nowrap;left:0;top:0;"></div>
      <script>(function(){
        var tip=document.getElementById('lspTip'); if(!tip) return;
        function show(t){ tip.textContent=t.getAttribute('data-t')||''; tip.style.opacity='1'; t.setAttribute('r','4'); t.style.fill=t.getAttribute('data-c')||'#2383e2'; }
        function hide(t){ tip.style.opacity='0'; t.setAttribute('r','7'); t.style.fill='transparent'; }
        document.addEventListener('pointerover',function(e){ var t=e.target.closest?e.target.closest('.lsp-pt'):null; if(t) show(t); });
        document.addEventListener('pointerout',function(e){ var t=e.target.closest?e.target.closest('.lsp-pt'):null; if(t) hide(t); });
        document.addEventListener('pointermove',function(e){ if(tip.style.opacity==='1'){ var x=e.clientX+12, y=e.clientY-30; if(x+tip.offsetWidth>window.innerWidth-8) x=e.clientX-tip.offsetWidth-12; tip.style.left=x+'px'; tip.style.top=y+'px'; } });
      })();</script>
      </div>`;
        res.type("text/html").send(notionPage("畜產雞蛋行情", body, "logistics-reports", res));
    });
    router.post("/logistics/livestock/refresh", express_1.default.urlencoded({ extended: true }), async (_req, res) => {
        try {
            const r = await (0, livestock_price_js_1.loadOrFetchLivestockPrices)(db, new Date().toISOString().slice(0, 10));
            // 順便回填近 30 天歷史，讓折線圖立刻有資料（農業部 API 本就回多天）
            try { await (0, livestock_price_js_1.backfillLivestockHistory)(db, 30); }
            catch (e) { console.warn("[admin] livestock backfill", e?.message || e); }
            if (!r.prices.length) {
                const detail = (r.errors && r.errors.length) ? r.errors.join("；") : "農業部 API 目前無資料（可能休市或尚未更新）";
                res.redirect("/admin/logistics/livestock?err=" + encodeURIComponent("更新失敗：" + detail));
                return;
            }
            res.redirect("/admin/logistics/livestock?ok=updated");
        }
        catch (e) {
            console.error("[admin] livestock refresh", e?.message || e);
            res.redirect("/admin/logistics/livestock?err=" + encodeURIComponent("更新失敗：" + String(e?.message || e).slice(0, 200)));
        }
    });
    router.get("/logistics/livestock/export.csv", async (_req, res) => {
        const view = await getLivestockForDisplay();
        const lines = ["類別,品項/市場,價格,單位,資料日"];
        const q = (x) => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"';
        for (const p of (view.prices || [])) {
            let d = view.dataDate;
            try { if (p.extraJson) d = JSON.parse(p.extraJson).資料日 || view.dataDate; } catch (_) { }
            lines.push([q(LIVESTOCK_CAT_LABEL[p.category] || p.category), q(p.marketName || p.itemLabel), q(p.price), q(p.unit), q(d)].join(","));
        }
        res.set("Content-Type", "text/csv; charset=utf-8");
        res.set("Content-Disposition", `attachment; filename="livestock_${view.dataDate || "prices"}.csv"`);
        res.send("﻿" + lines.join("\r\n"));
    });

    // ============================================================
    // 原物料行情：豬肉、雞肉、雞蛋等（手動輸入；無公開 API）
    // ============================================================
    const COMMODITY_CATEGORIES = [
        { value: "egg", label: "🥚 雞蛋", source: "中央畜產會 NAIF / 自查" },
        { value: "pork", label: "🐖 豬肉", source: "台灣區肉品市場 / 自查" },
        { value: "chicken", label: "🐓 雞肉", source: "屠宰場 / 自查" },
        { value: "beef", label: "🐄 牛肉", source: "自查" },
        { value: "fish", label: "🐟 海鮮水產", source: "自查" },
        { value: "other", label: "其他", source: "自查" },
    ];

    router.get("/logistics/commodities", async (req, res) => {
        const filterCat = String(req.query.category || "").trim();
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        const today = getTaipeiCalendarDateYYYYMMDD();
        const fromQ = String(req.query.from || "").trim();
        const toQ = String(req.query.to || "").trim();
        const dateFrom = dateRe.test(fromQ) ? fromQ : (() => { const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })();
        const dateTo = dateRe.test(toQ) ? toQ : today;
        let sql = "SELECT id, category, source, record_date, unit, spec, price, high_price, mid_price, low_price, note, updated_at FROM commodity_prices WHERE record_date >= ? AND record_date <= ?";
        const params = [dateFrom, dateTo];
        if (filterCat) { sql += " AND category = ?"; params.push(filterCat); }
        sql += " ORDER BY record_date DESC, category, spec LIMIT 500";
        const rows = await db.prepare(sql).all(...params);
        const catMap = Object.fromEntries(COMMODITY_CATEGORIES.map((c) => [c.value, c]));
        const tableRows = rows.length
            ? rows.map((r) => {
                const cat = catMap[r.category] || { label: r.category };
                const priceCell = r.price != null ? Number(r.price).toFixed(2) :
                    (r.mid_price != null ? Number(r.mid_price).toFixed(2) : (r.high_price != null ? `${r.high_price} / ${r.low_price ?? "—"}` : "—"));
                return `<tr>
<td style="font-size:12px;color:#787774;">${escapeHtml(r.record_date)}</td>
<td>${escapeHtml(cat.label)}</td>
<td>${escapeHtml(r.spec || "—")}</td>
<td style="text-align:right;font-weight:600;">${priceCell}</td>
<td style="text-align:right;font-size:12px;color:#787774;">${r.high_price ?? "—"} / ${r.mid_price ?? "—"} / ${r.low_price ?? "—"}</td>
<td>${escapeHtml(r.unit || "—")}</td>
<td style="font-size:12px;color:#787774;">${escapeHtml(r.source || "—")}</td>
<td style="font-size:12px;color:#787774;">${escapeHtml(r.note || "")}</td>
<td><form method="post" action="/admin/logistics/commodities/${encodeURIComponent(r.id)}/delete" style="display:inline;" onsubmit="return confirm('刪除此筆？');"><button type="submit" class="btn" style="padding:2px 8px;font-size:11px;">刪除</button></form></td>
</tr>`;
            }).join("")
            : `<tr><td colspan="9" style="text-align:center;color:#999;padding:24px;">區間內尚無資料。在下方表單新增第一筆。</td></tr>`;
        const okMsg = req.query.ok === "added" ? "已新增" : (req.query.ok === "deleted" ? "已刪除" : "");
        const catFilterLinks = [
            { v: "", l: "全部" },
            ...COMMODITY_CATEGORIES.map((c) => ({ v: c.value, l: c.label })),
        ].map((x) => `<a href="/admin/logistics/commodities?category=${encodeURIComponent(x.v)}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}" style="margin-right:6px;padding:4px 10px;border-radius:6px;${filterCat === x.v ? "background:#3b82c4;color:#fff;" : "color:#666;background:#f4f4f0;"}">${escapeHtml(x.l)}</a>`).join("");
        const body = `<style>
.cm-table { width:100%; border-collapse:collapse; }
.cm-table th { padding:8px 10px; font-size:12px; color:#666; font-weight:500; text-align:left; border-bottom:1px solid var(--notion-border); background:#f7f6f3; }
.cm-table td { padding:8px 10px; border-bottom:1px solid var(--notion-border); font-size:13px; }
.cm-form { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; }
.cm-form label { font-size:12px; color:#666; }
.cm-form input, .cm-form select, .cm-form textarea { width:100%; padding:6px 8px; border:1px solid var(--notion-border-strong); border-radius:5px; font-size:13px; box-sizing:border-box; background:#fafafa; font-family:inherit; }
</style>
<div class="notion-page-content">
<div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 原物料行情</div>
<h1 class="notion-page-title" style="margin-bottom:6px;">大宗原物料行情</h1>
<p class="notion-hint" style="margin:0 0 14px;">豬肉 / 雞肉 / 雞蛋 等。目前無穩定公開 API，先以手動每日輸入為主，留歷史紀錄供比價判斷。</p>
${okMsg ? `<p class="notion-msg" style="background:#ecfdf5;color:#047857;padding:8px 12px;border-radius:6px;border:1px solid #a7f3d0;font-size:13px;">✓ ${escapeHtml(okMsg)}</p>` : ""}

<div class="notion-card" style="padding:18px;margin-bottom:14px;">
  <h3 style="margin:0 0 12px;font-size:14px;">新增一筆行情</h3>
  <form method="post" action="/admin/logistics/commodities" class="cm-form">
    <div><label>日期 *</label><input type="date" name="record_date" value="${escapeAttr(today)}" required></div>
    <div><label>類別 *</label><select name="category" required>${COMMODITY_CATEGORIES.map((c) => `<option value="${escapeAttr(c.value)}">${escapeHtml(c.label)}</option>`).join("")}</select></div>
    <div><label>品項規格</label><input type="text" name="spec" placeholder="例：紅羽土雞 / 帶骨梅花"></div>
    <div><label>單位</label><input type="text" name="unit" placeholder="元/公斤" value="元/公斤"></div>
    <div><label>主價（單一）</label><input type="number" step="0.01" name="price" placeholder="如：85"></div>
    <div><label>上價</label><input type="number" step="0.01" name="high_price" placeholder=""></div>
    <div><label>中價</label><input type="number" step="0.01" name="mid_price" placeholder=""></div>
    <div><label>下價</label><input type="number" step="0.01" name="low_price" placeholder=""></div>
    <div><label>來源</label><input type="text" name="source" placeholder="NAIF / 業者報價 / 媒體"></div>
    <div style="grid-column:span 2;"><label>備註</label><input type="text" name="note" placeholder="例：颱風後價格上揚"></div>
    <div style="grid-column:1/-1;"><button type="submit" class="btn btn-primary">＋ 新增</button></div>
  </form>
</div>

<div style="display:flex;gap:14px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
  <form method="get" action="/admin/logistics/commodities" style="display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <input type="hidden" name="category" value="${escapeAttr(filterCat)}">
    <label style="font-size:12px;color:#666;">區間：</label>
    <input type="date" name="from" value="${escapeAttr(dateFrom)}">
    <span>~</span>
    <input type="date" name="to" value="${escapeAttr(dateTo)}">
    <button type="submit" class="btn">查詢</button>
    <a href="/admin/logistics/commodities/export.csv?category=${encodeURIComponent(filterCat)}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}" class="btn">下載 CSV</a>
  </form>
</div>
<div style="margin-bottom:10px;">${catFilterLinks}</div>

<div class="notion-card" style="padding:0;">
  <table class="cm-table">
    <thead><tr><th>日期</th><th>類別</th><th>規格</th><th style="text-align:right;">主價</th><th style="text-align:right;">上/中/下</th><th>單位</th><th>來源</th><th>備註</th><th></th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>
</div>`;
        res.type("text/html").send(notionPage("原物料行情", body, "logistics-commodities", res));
    });

    router.post("/logistics/commodities", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const recordDate = String(req.body.record_date || "").trim();
        const category = String(req.body.category || "").trim();
        const spec = String(req.body.spec || "").trim() || null;
        const unit = String(req.body.unit || "").trim() || null;
        const source = String(req.body.source || "").trim() || null;
        const note = String(req.body.note || "").trim() || null;
        const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
        const price = num(req.body.price);
        const hi = num(req.body.high_price);
        const mid = num(req.body.mid_price);
        const lo = num(req.body.low_price);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || !category) {
            res.redirect("/admin/logistics/commodities?err=bad_input");
            return;
        }
        const id = (0, id_js_1.newId)("cmd");
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        await db.prepare(`INSERT INTO commodity_prices (id, category, source, record_date, unit, spec, price, high_price, mid_price, low_price, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${nowSql}, ${nowSql})`)
            .run(id, category, source, recordDate, unit, spec, price, hi, mid, lo, note);
        res.redirect("/admin/logistics/commodities?ok=added");
    });

    router.post("/logistics/commodities/:id/delete", async (req, res) => {
        await db.prepare("DELETE FROM commodity_prices WHERE id = ?").run(req.params.id);
        res.redirect("/admin/logistics/commodities?ok=deleted");
    });

    router.get("/logistics/commodities/export.csv", async (req, res) => {
        const cat = String(req.query.category || "").trim();
        const from = String(req.query.from || "").trim();
        const to = String(req.query.to || "").trim();
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        let sql = "SELECT record_date, category, spec, unit, price, high_price, mid_price, low_price, source, note FROM commodity_prices WHERE 1=1";
        const params = [];
        if (dateRe.test(from)) { sql += " AND record_date >= ?"; params.push(from); }
        if (dateRe.test(to)) { sql += " AND record_date <= ?"; params.push(to); }
        if (cat) { sql += " AND category = ?"; params.push(cat); }
        sql += " ORDER BY record_date DESC, category, spec";
        const rows = await db.prepare(sql).all(...params);
        const catLabel = Object.fromEntries(COMMODITY_CATEGORIES.map((c) => [c.value, c.label.replace(/^[\u{1F300}-\u{1FAFF}☀-➿]\s*/u, "")]));
        const lines = ["日期,類別,規格,單位,主價,上價,中價,下價,來源,備註"];
        for (const r of rows) {
            const cells = [r.record_date, catLabel[r.category] || r.category, r.spec || "", r.unit || "", r.price ?? "", r.high_price ?? "", r.mid_price ?? "", r.low_price ?? "", r.source || "", r.note || ""].map((v) => {
                const s = String(v ?? "");
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            });
            lines.push(cells.join(","));
        }
        const fname = `commodities_${from || "all"}_${to || "all"}.csv`;
        res.set("Content-Type", "text/csv; charset=utf-8");
        res.set("Content-Disposition", `attachment; filename="${fname}"`);
        res.send("﻿" + lines.join("\n"));
    });
    router.post("/logistics/market/rules", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const txt = String(req.body?.rules_json || "").trim();
        try {
            const j = JSON.parse(txt || "{}");
            if (!j || typeof j !== "object")
                throw new Error("規則必須是 JSON 物件");
            const normalized = {};
            for (const [k, v] of Object.entries(j)) {
                const n = Number(v);
                if (!Number.isFinite(n))
                    continue;
                normalized[String(k).toUpperCase()] = n;
            }
            if (normalized["*"] == null)
                normalized["*"] = 2;
            await db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run("line_price_prefix_rules", JSON.stringify(normalized));
            res.redirect("/admin/logistics/market?ok=1");
        }
        catch (_e) {
            res.redirect("/admin/logistics/market?err=rules");
        }
    });
    router.post("/api/logistics/recognize", uploadImageSafe, async (req, res) => {
        try {
            let rawText = (req.body && req.body.raw_message) ? String(req.body.raw_message).trim() : "";
            const customerId = (req.body && (req.body.customer_id || req.body.client_id)) ? String(req.body.customer_id || req.body.client_id).trim() || null : null;
            const subClientId = (req.body && (req.body.sub_client_id || req.body.subClientId)) ? String(req.body.sub_client_id || req.body.subClientId).trim() || null : null;
            const file = req.file;
            let fallbackUnit = "公斤";
            let geminiHintOpts = undefined;
            let geminiImageOpts = undefined;
            if (customerId) {
                try {
                    const custRow = await db.prepare("SELECT default_unit, known_sub_customers FROM customers WHERE id = ?").get(customerId);
                    fallbackUnit = custRow?.default_unit?.trim() || "公斤";
                    const knownSub = custRow?.known_sub_customers != null ? String(custRow.known_sub_customers).trim() : "";
                    let hw = "";
                    try {
                        hw = (await customer_handwriting_hints_js_1.buildPromptSuffixForCustomerHandwritingHints(db, customerId)) || "";
                    }
                    catch (_) { }
                    let historyItems = [];
                    try {
                        historyItems = await order_history_items_js_1.loadDistinctOrderItemNamesForCustomer(db, customerId, subClientId);
                    }
                    catch (he) {
                        console.warn("[admin] logistics historyItems:", he?.message || he);
                    }
                    geminiHintOpts = {
                        ...(hw ? { extraPromptSuffix: hw } : {}),
                        ...(knownSub ? { knownSubCustomers: knownSub } : {}),
                        db,
                        customerId,
                    };
                    geminiImageOpts = {
                        ...(hw ? { extraPromptSuffix: hw } : {}),
                        ...(knownSub ? { knownSubCustomers: knownSub } : {}),
                        db,
                        customerId,
                        historyItems,
                        ...(subClientId ? { subClientId } : {}),
                    };
                }
                catch (_) { }
            }
            if (file && file.buffer) {
                const visionKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
                if (visionKey && visionKey.trim()) {
                    const ocrText = await (0, vision_ocr_js_1.getTextFromImageBuffer)(file.buffer);
                    if (ocrText)
                        rawText = (rawText ? rawText + "\n" : "") + ocrText;
                }
            }
            const detectedTpl = (0, order_form_templates_js_1.detectOrderFormTemplate)(rawText);
            const normalizedRawText = detectedTpl
                ? (0, order_form_templates_js_1.preprocessOcrTextByTemplate)(rawText, detectedTpl)
                : rawText;
                if (!rawText || !rawText.trim()) {
                if (file?.buffer?.length && (0, gemini_order_helpers_js_1.getGeminiApiKey)()) {
                    const visRaw = await (0, gemini_order_helpers_js_1.parseOrderWithGeminiImage)(file.buffer, geminiImageOpts);
                    const vis = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)((visRaw || []).map((p) => ({ rawName: p.rawName, quantity: p.quantity, unit: p.unit || null, remark: p.remark ?? null, amount: p.amount ?? null, subCustomer: p.subCustomer ?? null })));
                    if (vis && vis.length) {
                        const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
                        const items = [];
                        for (const p of vis) {
                            try {
                                const resolved = await (0, resolve_product_js_1.resolveProductName)(db, p.rawName, customerId);
                                const inputUnit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(p.unit, fallbackUnit);
                                let qty = Number.isFinite(Number(p.quantity)) ? Number(p.quantity) : 0;
                                let unit = inputUnit;
                                let remark = p.remark != null && String(p.remark).trim() !== "" ? String(p.remark).trim() : null;
                                {
                                    const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
                                    qty = Number(c.quantity);
                                    unit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(c.unit || fallbackUnit, fallbackUnit);
                                    if (c.remark)
                                        remark = remark ? (remark + "；" + c.remark) : c.remark;
                                }
                                remark = (0, unit_conversion_js_1.withOriginCallRemark)(remark, p.quantity, inputUnit, unit);
                                items.push({
                                    rawName: p.rawName,
                                    quantity: qty,
                                    unit: unit || null,
                                    remark,
                                    amount: p.amount ?? null,
                                    subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                                    productId: resolved?.productId ?? null,
                                    productName: resolved?.productId ? (resolved.productName || null) : null,
                                    needReview: resolved ? 0 : 1,
                                });
                            }
                            catch (itemErr) {
                                console.error("[admin] logistics recognize item (vision)", itemErr?.message || itemErr);
                                items.push({
                                    rawName: p.rawName,
                                    quantity: p.quantity,
                                    unit: p.unit || null,
                                    remark: p.remark || null,
                                    amount: p.amount ?? null,
                                    subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                                    productId: null,
                                    productName: null,
                                    needReview: 1,
                                });
                            }
                        }
                        res.json({ raw_message: "[圖片]", items });
                        return;
                    }
                }
                res.status(400).json({ error: "無法取得內容（請貼上文字，或上傳圖片並設定 GOOGLE_CLOUD_VISION_API_KEY／GOOGLE_GEMINI_API_KEY）。" });
                return;
            }
            const ruleBased = await (0, parse_order_message_js_1.parseOrderMessage)(normalizedRawText, fallbackUnit, geminiHintOpts);
            let parsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(ruleBased.map((p) => ({ rawName: p.rawName, quantity: p.quantity, unit: p.unit || null, remark: p.remark || null, amount: null, subCustomer: p.subCustomer ?? null })));
            if (!parsed.length && file?.buffer?.length && (0, gemini_order_helpers_js_1.getGeminiApiKey)()) {
                const vis = await (0, gemini_order_helpers_js_1.parseOrderWithGeminiImage)(file.buffer, geminiImageOpts);
                if (vis && vis.length) {
                    parsed = (0, order_parsed_heuristics_js_1.filterLikelyOcrJunkParsedItems)(vis.map((p) => ({ rawName: p.rawName, quantity: p.quantity, unit: p.unit || null, remark: p.remark ?? null, amount: p.amount ?? null, subCustomer: p.subCustomer ?? null })));
                }
            }
            const convRules = await (0, unit_conversion_js_1.loadUnitConversionRules)(db);
            const items = [];
            for (const p of parsed) {
                try {
                    const resolved = await (0, resolve_product_js_1.resolveProductName)(db, p.rawName, customerId);
                    const inputUnit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(p.unit, fallbackUnit);
                    let qty = Number.isFinite(Number(p.quantity)) ? Number(p.quantity) : 0;
                    let unit = inputUnit;
                    let remark = p.remark != null && String(p.remark).trim() !== "" ? String(p.remark).trim() : null;
                    {
                        const c = await (0, unit_conversion_js_1.applyOrderUnitConversion)(db, convRules, resolved, qty, unit);
                        qty = Number(c.quantity);
                        unit = (0, unit_conversion_js_1.normalizeOrderUnitForStorage)(c.unit || fallbackUnit, fallbackUnit);
                        if (c.remark) {
                            remark = remark ? (remark + "；" + c.remark) : c.remark;
                        }
                    }
                    remark = (0, unit_conversion_js_1.withOriginCallRemark)(remark, p.quantity, inputUnit, unit);
                    items.push({
                        rawName: p.rawName,
                        quantity: qty,
                        unit: unit || null,
                        remark,
                        amount: p.amount ?? null,
                        subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                        productId: resolved?.productId ?? null,
                        productName: resolved?.productId ? (resolved.productName || null) : null,
                        needReview: resolved ? 0 : 1,
                    });
                }
                catch (itemErr) {
                    console.error("[admin] logistics recognize item", itemErr?.message || itemErr);
                    items.push({
                        rawName: p.rawName,
                        quantity: p.quantity,
                        unit: p.unit || null,
                        remark: p.remark || null,
                        amount: p.amount ?? null,
                        subCustomer: p.subCustomer != null && String(p.subCustomer).trim() !== "" ? String(p.subCustomer).trim() : null,
                        productId: null,
                        productName: null,
                        needReview: 1,
                    });
                }
            }
            res.json({ raw_message: normalizedRawText || rawText, items });
        }
        catch (e) {
            console.error("[admin] /api/logistics/recognize", e?.message || e, e?.stack);
            if (!res.headersSent)
                res.status(500).json({ error: "解析失敗：" + String(e?.message || e).slice(0, 400) });
        }
    });
    router.get("/api/logistics/wholesale-prices", async (req, res) => {
        const dateStr = (req.query.date || "").toString().trim() || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            res.status(400).json({ error: "請提供有效日期參數 date（YYYY-MM-DD）。" });
            return;
        }
        try {
            const snap = await (0, wholesale_snapshot_js_1.loadOrFetchWholesaleMarketPrices)(db, dateStr);
            const prices = snap.prices || [];
            if (!prices.length) {
                const emptyMsg = snap.source === "empty"
                    ? "該日尚無台北果菜市場批發行情，且本地無快照；可能為休市或資料尚未更新。"
                    : "該日無青菜／葉菜篩選結果。";
                res.json({ prices: [], message: emptyMsg, hint: snap.hint || "", source: snap.source });
                return;
            }
            res.json({
                prices,
                hint: snap.hint || "",
                source: snap.source,
            });
        }
        catch (e) {
            console.error("[admin] 批發行情取得失敗:", e?.message || e);
            res.status(500).json({ error: "無法取得批發行情，請稍後再試。" });
        }
    });
    router.post("/logistics/orders", express_1.default.urlencoded({ extended: true }), async (req, res) => {
        const orderDate = (req.body.order_date || "").trim();
        const rawMessage = (req.body.raw_message || "").trim();
        const customerIdPost = (req.body.customer_id || "").trim() || null;
        let items = [];
        try {
            const j = req.body.items_json;
            if (j)
                items = JSON.parse(j);
        }
        catch (_) { }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
            res.redirect("/admin/logistics/orders/new?err=date");
            return;
        }
        const orderId = (0, id_js_1.newId)("log");
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        // [fix 2026-07-08] 物流訂單主檔＋明細多筆 INSERT 包進單一交易，中途失敗整批回滾，
        // 不留下「有主檔沒明細」的殘缺物流單。
        const doSave = async (h) => {
            await h.prepare("INSERT INTO logistics_orders (id, order_date, customer_id, raw_message, created_at) VALUES (?, ?, ?, ?, " + nowSql + ")").run(orderId, orderDate, customerIdPost, rawMessage);
            for (const it of items) {
                const itemId = (0, id_js_1.newId)("logitem");
                const qty = parseFloat(it.quantity);
                const needReview = it.needReview === 1 || it.needReview === true ? 1 : 0;
                const amountVal = it.amount != null && String(it.amount).trim() !== "" ? String(it.amount).trim() : null;
                const remarkVal = it.remark != null && String(it.remark).trim() !== "" ? String(it.remark).trim() : null;
                await h.prepare("INSERT INTO logistics_order_items (id, order_id, product_id, raw_name, quantity, unit, remark, amount, need_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(itemId, orderId, it.productId || null, it.rawName || "", Number.isFinite(qty) ? qty : 0, it.unit || null, remarkVal, amountVal, needReview);
            }
        };
        if (typeof db.transaction === "function") {
            await db.transaction(doSave);
        }
        else {
            await doSave(db);
        }
        res.redirect("/admin/orders?date_from=" + encodeURIComponent(orderDate) + "&date_to=" + encodeURIComponent(orderDate) + "&ok=log_saved");
    });
    router.get("/logistics/orders/:id", async (req, res) => {
        const order = await db.prepare(`
      SELECT o.id, o.order_date, o.raw_message, o.memo, o.customer_id, c.name AS customer_name
      FROM logistics_orders o LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `).get(req.params.id);
        if (!order) {
            res.status(404).send("訂單不存在");
            return;
        }
        const items = await db.prepare(`
      SELECT oi.id, oi.raw_name, oi.quantity, oi.unit, oi.remark, oi.amount, oi.need_review, p.name AS product_name
      FROM logistics_order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?
    `).all(order.id);
        const rows = items.map((i) => `<tr><td>${escapeHtml(i.raw_name ?? "")}</td><td>${i.quantity}</td><td>${escapeHtml((i.unit || "") + (i.need_review === 1 ? " [待確認]" : ""))}</td><td>${escapeHtml(i.remark ?? "—")}</td><td>${escapeHtml(i.amount ?? "—")}</td><td>${escapeHtml(i.product_name || "—")}</td></tr>`).join("");
        const custLine = order.customer_name ? `　客戶：${escapeHtml(order.customer_name)}` : "";
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / <a href="/admin/logistics/orders">訂單整理</a> / 明細</div>
        <h1 class="notion-page-title">紙本訂單明細</h1>
        <p>日期：${escapeHtml(order.order_date)}${custLine}　<a href="/admin/logistics/orders">← 回列表</a></p>
        <div class="notion-card raw-message-scroll"><h3 style="margin-top:0;">原始訂單</h3><pre style="background:var(--notion-sidebar);padding:12px;border-radius:var(--notion-radius);margin:0;font-size:13px;max-height:240px;overflow:auto;">${escapeHtml(order.raw_message || "")}</pre></div>
        <div class="notion-card">
          <table><thead><tr><th>品名</th><th>數量</th><th>單位</th><th>備註</th><th>金額（元/公斤）</th><th>對應品項</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
      `;
        res.type("text/html").send(notionPage("訂單明細", body, "logistics", res));
    });
    router.get("/logistics/procurement", async (req, res) => {
        const dateFrom = req.query.from?.trim() || new Date().toISOString().slice(0, 10);
        const dateTo = req.query.to?.trim() || dateFrom;
        const rows = await db.prepare(`
      SELECT oi.raw_name, oi.unit, oi.product_id, p.name AS product_name, SUM(oi.quantity) AS total_qty
      FROM logistics_order_items oi
      LEFT JOIN logistics_orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.order_date >= ? AND o.order_date <= ?
      GROUP BY oi.product_id, oi.raw_name, oi.unit, p.name
      ORDER BY p.name, oi.raw_name, oi.unit
    `).all(dateFrom, dateTo);
        const tableRows = rows.length === 0
            ? "<tr><td colspan='4'>此區間無資料</td></tr>"
            : rows.map((r) => `<tr><td>${escapeHtml(r.product_name || r.raw_name || "待確認")}</td><td>${Number(r.total_qty)}</td><td>${escapeHtml(r.unit || "—")}</td><td>${escapeHtml(r.raw_name && !r.product_name ? "待對照" : "—")}</td></tr>`).join("");
        const body = `
        <div class="notion-breadcrumb"><a href="/admin">儀表板</a> / 庫存管理 / 採購分析</div>
        <h1 class="notion-page-title">採購分析</h1>
        <p>依日期區間彙總「訂單整理」內紙本訂單，某日某品項需採購數量（供採購人員使用）。</p>
        <div class="notion-card">
          <form method="get" action="/admin/logistics/procurement" style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:12px;">
            <label>日期區間 <input type="date" name="from" value="${escapeAttr(dateFrom)}"> ～ <input type="date" name="to" value="${escapeAttr(dateTo)}"></label>
            <button type="submit" class="btn">查詢</button>
          </form>
          <table>
            <thead><tr><th>品項</th><th>合計數量</th><th>單位</th><th>備註</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      `;
        res.type("text/html").send(notionPage("採購分析", body, "logistics-procurement", res));
    });
}
