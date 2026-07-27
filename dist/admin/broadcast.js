"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBroadcastRoutes = registerBroadcastRoutes;

// 群發域（群發訊息列表／草稿／圖片上傳／預覽／發送）路由：自 index.js 拆出（拆檔批次 4），純搬移、行為不變。
// 注：公告管理 /announcements 與 flex 組訊 helper（buildPromoFlexMessage 等）留在 index.js，經 ctx 傳入。

const multer_1 = { default: require("multer") };
const crypto_1 = { default: require("crypto") };
const id_js_1 = require("../lib/id.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerBroadcastRoutes(router, ctx) {
    const { db, notionPage, logDataChange, requireManager, upload, buildPromoFlexMessage, buildNoticeFlexMessage, buildCalendarFlexMessage } = ctx;
    // ── Broadcast ──────────────────────────────────────────────────────────────
    // === 群發訊息列表（新版預設首頁） ===
    router.get("/broadcast", requireManager, async (req, res) => {
        const successCount = req.query.sent ? parseInt(req.query.sent, 10) : null;
        const errMsg = req.query.err ? decodeURIComponent(String(req.query.err)) : null;
        const okMsg = req.query.ok ? decodeURIComponent(String(req.query.ok)) : null;
        let drafts = [];
        let sent = [];
        try {
            drafts = await db.prepare("SELECT id, type, title, created_at, updated_at FROM broadcast_messages WHERE status = 'draft' ORDER BY updated_at DESC LIMIT 50").all();
            sent = await db.prepare("SELECT id, type, title, sent_at, sent_count FROM broadcast_messages WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 50").all();
        } catch (_) { /* table may not exist yet on first run */ }
        const typeIcon = (t) => SF_ICONS[{ promo: "bolt", notice: "megaphone", calendar: "calendar", image: "image" }[t]] || "";
        const typeLabel = (t) => ({ promo: "限時優惠", notice: "公告", calendar: "行事曆", image: "圖片" })[t] || t || "—";
        const draftRows = drafts.map(d => `<tr>
          <td><span class="sf-pill">${typeIcon(d.type)}${escapeHtml(typeLabel(d.type))}</span></td>
          <td><a href="/admin/broadcast/edit/${encodeURIComponent(d.id)}" style="font-weight:500;color:var(--txt-1);">${escapeHtml(d.title || "（未命名）")}</a></td>
          <td class="mono" style="font-size:11px;color:var(--txt-3);white-space:nowrap;">${escapeHtml(String(d.updated_at || d.created_at || "").slice(0,16).replace("T"," "))}</td>
          <td style="text-align:right;white-space:nowrap;">
            <a class="sf-btn sm" href="/admin/broadcast/edit/${encodeURIComponent(d.id)}">${SF_ICONS.edit}<span>編輯</span></a>
            <form method="post" action="/admin/broadcast/clone/${encodeURIComponent(d.id)}" style="display:inline;margin:0;"><button type="submit" class="sf-btn sm" title="複製一份" onclick="return confirm('複製為新訊息？');">複製</button></form>
            <form method="post" action="/admin/broadcast/delete/${encodeURIComponent(d.id)}" style="display:inline;margin:0;"><button type="submit" class="sf-btn sm danger" onclick="return confirm('確定刪除此草稿？');">${SF_ICONS.x}</button></form>
          </td>
        </tr>`).join("");
        const sentRows = sent.map(s => `<tr>
          <td><span class="sf-pill">${typeIcon(s.type)}${escapeHtml(typeLabel(s.type))}</span></td>
          <td>${escapeHtml(s.title || "（未命名）")}</td>
          <td class="mono" style="font-size:11px;color:var(--txt-3);white-space:nowrap;">${escapeHtml(String(s.sent_at || "").slice(0,16).replace("T"," "))}</td>
          <td class="mono" style="text-align:right;">${escapeHtml(String(s.sent_count != null ? s.sent_count : "—"))}</td>
          <td style="text-align:right;white-space:nowrap;">
            <form method="post" action="/admin/broadcast/clone/${encodeURIComponent(s.id)}" style="display:inline;margin:0;"><button type="submit" class="sf-btn sm" title="複製內容做新訊息">複製為新訊息</button></form>
          </td>
        </tr>`).join("");
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="sf-breadcrumb" style="margin-bottom:6px;">報表與通訊 / 群發訊息</div>
              <h1 style="margin:0;font-size:22px;font-weight:600;">群發訊息</h1>
              <p style="margin-top:4px;color:var(--txt-3);font-size:12px;">先選擇要發送的內容類型（限時優惠／公告／行事曆／圖片），編輯後送出，或先存成草稿之後再用。</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a class="sf-btn primary" href="/admin/broadcast/new">${SF_ICONS.plus}<span>新增訊息</span></a>
            </div>
          </div>
          ${successCount != null ? `<div class="sf-pill ok" style="align-self:flex-start;">✅ 已成功傳送至 ${successCount} 個群組</div>` : ""}
          ${okMsg ? `<div class="sf-pill ok" style="align-self:flex-start;">${escapeHtml(okMsg)}</div>` : ""}
          ${errMsg ? `<div class="sf-pill bad" style="align-self:flex-start;">❌ ${escapeHtml(errMsg)}</div>` : ""}
          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.edit} 草稿（${drafts.length}）</div>
              <span class="sf-card-sub">儲存後可隨時再開來修改、複製、刪除</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th style="width:120px;">類型</th><th>標題</th><th style="width:160px;">最後更新</th><th style="width:240px;"></th></tr></thead>
                <tbody>${draftRows || `<tr><td colspan='4' style='padding:24px;text-align:center;color:var(--txt-3);'>尚無草稿。點右上「新增訊息」開始。</td></tr>`}</tbody>
              </table>
            </div>
          </div>
          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.history} 已發送紀錄（${sent.length}）</div>
              <span class="sf-card-sub">每張訊息已送達群組數；可一鍵複製為新訊息</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th style="width:120px;">類型</th><th>標題</th><th style="width:160px;">送出時間</th><th style="width:80px;text-align:right;">送達</th><th style="width:180px;"></th></tr></thead>
                <tbody>${sentRows || `<tr><td colspan='5' style='padding:24px;text-align:center;color:var(--txt-3);'>尚無已發送紀錄</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </div>`;
        res.send(notionPage("群發訊息", body, "broadcast", res));
    });
    // === 群發訊息編輯器 ===
    async function renderBroadcastEditor(req, res, prefill) {
        const customers = await db.prepare("SELECT id, name FROM customers WHERE line_group_id IS NOT NULL AND line_group_id != '' ORDER BY name ASC").all();
        const successCount = req.query.sent ? parseInt(req.query.sent, 10) : null;
        const errMsg = req.query.err ? decodeURIComponent(String(req.query.err)) : null;
        const customerOptions = customers.map(c => `<option value="${escapeAttr(String(c.id))}">${escapeHtml(c.name)}</option>`).join("");
        let prefillData = null;
        let prefillId = null;
        if (prefill && prefill.payload_json) {
            try { prefillData = JSON.parse(prefill.payload_json); prefillId = prefill.id; } catch (_) {}
        }
        const customersForJS = customers.map(c => ({ id: c.id, name: c.name }));
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="sf-breadcrumb" style="margin-bottom:6px;"><a href="/admin/broadcast" style="color:var(--txt-3);">群發訊息</a> / ${prefillId ? "編輯訊息" : "新增訊息"}</div>
              <h1 style="margin:0;font-size:22px;font-weight:600;">${prefillId ? "編輯訊息" : "新增訊息"}</h1>
            </div>
            <div style="display:flex;gap:8px;">
              <a class="sf-btn ghost" href="/admin/broadcast">← 回列表</a>
            </div>
          </div>
          ${successCount != null ? `<div class="sf-pill ok" style="align-self:flex-start;">✅ 已成功傳送至 ${successCount} 個群組</div>` : ""}
          ${errMsg ? `<div class="sf-pill bad" style="align-self:flex-start;">❌ ${escapeHtml(errMsg)}</div>` : ""}
          <div style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:flex-start;">
            <div class="sf-card">
              <div class="sf-card-head">
                <div class="sf-card-title">${SF_ICONS.edit} 編輯訊息內容</div>
              </div>
              <div style="padding:16px 18px;">
                <div class="sf-tabs" style="margin-bottom:16px;">
                  <button type="button" class="sf-tab active" onclick="switchTab('promo',this)">${sfInlineIcon('bolt')}限時優惠</button>
                  <button type="button" class="sf-tab" onclick="switchTab('notice',this)">${sfInlineIcon('megaphone')}公告</button>
                  <button type="button" class="sf-tab" onclick="switchTab('calendar',this)">${sfInlineIcon('calendar')}行事曆公告</button>
                  <button type="button" class="sf-tab" onclick="switchTab('image',this)">${sfInlineIcon('image')}圖片</button>
                </div>
                <input type="hidden" id="tmpl-type" value="promo">

                <!-- 共用：標題列顏色 -->
                <div style="margin-bottom:14px;padding:12px 14px;background:var(--bg-2);border-radius:var(--radius);border:var(--hairline);">
                  <label class="sf-label">標題列顏色</label>
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <div id="color-swatches" style="display:flex;gap:6px;flex-wrap:wrap;">
                      <!-- preset swatches injected by JS -->
                    </div>
                    <input type="color" id="header_color" value="#1a7c6e" onchange="onColorChange()" oninput="onColorChange()" style="width:48px;height:32px;padding:0;border:1px solid var(--line-2);border-radius:var(--radius);cursor:pointer;background:transparent;">
                    <input type="text" id="header_color_text" value="#1a7c6e" onchange="onColorTextChange()" maxlength="7" style="width:90px;height:32px;padding:0 8px;border:1px solid var(--line-2);border-radius:var(--radius);font-family:var(--font-mono);font-size:12px;">
                  </div>
                </div>
                <div id="tab-promo">
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">優惠時間</label>
                    <input class="sf-input" id="promo_date" type="text" placeholder="例：5/3（六）早上 6 點前" oninput="updatePreview()">
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">副標題（選填）</label>
                    <input class="sf-input" id="promo_subtitle" type="text" placeholder="例：當日限量，先搶先贏" oninput="updatePreview()">
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">品項</label>
                    <div style="display:flex;gap:8px;margin-bottom:4px;padding:0 4px;">
                      <span style="flex:1;font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">品名</span>
                      <span style="flex:0 0 90px;font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">優惠單價</span>
                      <span style="flex:0 0 60px;font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">單位</span>
                      <span style="flex:0 0 90px;font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">行情上價</span>
                      <span style="flex:0 0 30px;"></span>
                    </div>
                    <div id="item-rows">
                      <div class="item-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                        <input type="text" placeholder="品名" class="sf-input item-name" style="flex:1;" oninput="updatePreview()">
                        <input type="text" placeholder="180" class="sf-input item-price" style="flex:0 0 90px;" oninput="updatePreview()">
                        <input type="text" placeholder="斤" class="sf-input item-unit" style="flex:0 0 60px;" oninput="updatePreview()">
                        <input type="text" placeholder="220" class="sf-input item-market" style="flex:0 0 90px;" oninput="updatePreview()">
                        <button type="button" class="sf-btn sm ghost" onclick="removeRow(this)" title="刪除" style="flex:0 0 30px;padding:0;">✕</button>
                      </div>
                    </div>
                    <button type="button" class="sf-btn sm" onclick="addItemRow()" style="margin-top:4px;">${SF_ICONS.plus}<span>新增品項</span></button>
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">備註（選填）</label>
                    <input class="sf-input" id="promo_note" type="text" placeholder="例：需提前告知數量" oninput="updatePreview()">
                  </div>
                </div>
                <div id="tab-notice" style="display:none;">
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">公告標題</label>
                    <input class="sf-input" id="notice_title" type="text" placeholder="例：勞動節休假公告" oninput="updatePreview()">
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">副標題（選填）</label>
                    <input class="sf-input" id="notice_subtitle" type="text" placeholder="例：2026 年 5 月" oninput="updatePreview()">
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">公告內容</label>
                    <textarea class="sf-textarea" id="notice_content" rows="6" placeholder="例：本司於 5/1（四）勞動節休假一天，5/2（五）正常上班。造成不便敬請見諒，謝謝！" oninput="updatePreview()"></textarea>
                  </div>
                </div>

                <div id="tab-calendar" style="display:none;">
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">公告標題</label>
                    <input class="sf-input" id="cal_title" type="text" placeholder="例：勞動節休假公告" oninput="updatePreview()">
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">副標題（選填）</label>
                    <input class="sf-input" id="cal_subtitle" type="text" placeholder="例：請預估使用量提前叫貨喔" oninput="updatePreview()">
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">月份（決定顯示哪個月份的行事曆）</label>
                    <input class="sf-input" id="cal_year_month" type="month" value="${new Date().toISOString().slice(0,7)}" onchange="updatePreview()" style="max-width:200px;">
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">標記日期</label>
                    <p style="margin:0 0 6px;font-size:11px;color:var(--txt-3);">在月曆上標出公休／正常上班／重要日期。點「新增日期」加一列。</p>
                    <div style="display:flex;gap:8px;margin-bottom:4px;padding:0 4px;">
                      <span style="flex:0 0 140px;font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">日期</span>
                      <span style="flex:0 0 120px;font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">標籤</span>
                      <span style="flex:1;font-size:10px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;">類型</span>
                      <span style="flex:0 0 30px;"></span>
                    </div>
                    <div id="cal-marks">
                      <div class="cal-mark-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                        <input type="date" class="sf-input cal-mark-date" style="flex:0 0 140px;" oninput="updatePreview()">
                        <input type="text" placeholder="公休" class="sf-input cal-mark-label" style="flex:0 0 120px;" oninput="updatePreview()">
                        <select class="sf-select cal-mark-type" style="flex:1;" onchange="updatePreview()">
                          <option value="off">紅色（公休）</option>
                          <option value="work">黃色（正常上班）</option>
                          <option value="highlight">橘色（強調）</option>
                        </select>
                        <button type="button" class="sf-btn sm ghost" onclick="removeMarkRow(this)" title="刪除" style="flex:0 0 30px;padding:0;">✕</button>
                      </div>
                    </div>
                    <button type="button" class="sf-btn sm" onclick="addMarkRow()" style="margin-top:4px;">${SF_ICONS.plus}<span>新增日期</span></button>
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="sf-label">說明文字（選填）</label>
                    <textarea class="sf-textarea" id="cal_note" rows="4" placeholder="例：&#10;一、2026/5/1（五）、5/3（日）為本公司休假日，請預估使用量提前叫貨喔～&#10;二、2026/5/2（六）公司正常上班。&#10;&#10;祝 佳節愉快" oninput="updatePreview()"></textarea>
                  </div>
                </div>

                <div id="tab-image" style="display:none;">
                  <p style="margin:0 0 14px;font-size:12px;color:var(--txt-3);line-height:1.6;">
                    上傳圖片（JPG / PNG，最大 5 MB）。圖片會直接以 LINE 圖片訊息的形式發送，客戶看到的就是你上傳的這張圖。<br>
                    <strong style="color:var(--txt-2);">適用情境</strong>：節慶公告、優惠 DM、活動海報等已經設計好的圖片。
                  </p>
                  <input type="hidden" id="image_id" value="">
                  <input type="hidden" id="image_url" value="">
                  <div id="image-upload-row">
                    <label class="sf-label">選擇圖片</label>
                    <input class="sf-input" type="file" id="image_file" accept="image/jpeg,image/png" onchange="onImageSelected()" style="padding:6px;height:auto;">
                    <p style="margin:8px 0 0;font-size:11px;color:var(--txt-3);">建議尺寸：1040×1040 或更高、長寬比 < 3:1。上傳後右側預覽會即時顯示。</p>
                  </div>
                  <div id="image-loaded-row" style="display:none;">
                    <label class="sf-label">已上傳</label>
                    <div style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--bg-2);border:var(--hairline);border-radius:var(--radius);">
                      <span style="font-size:12px;color:var(--txt-2);flex:1;">✓ 圖片已上傳並可發送</span>
                      <button type="button" class="sf-btn sm ghost" onclick="resetImage()">重新上傳</button>
                    </div>
                  </div>
                </div>

                <div style="margin-bottom:14px;padding-top:14px;border-top:var(--hairline);">
                  <label class="sf-label">傳送對象（送出時可再勾選個別客戶）</label>
                  <select class="sf-select" id="recipients-select">
                    <option value="all">📢 全部客戶（已設定 LINE 群組，共 ${customers.length} 個）</option>
                    ${customerOptions}
                  </select>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-top:6px;">
                  <button type="button" class="sf-btn primary" onclick="openSendModal()">${SF_ICONS.check}<span>傳送至 LINE…</span></button>
                  <button type="button" class="sf-btn" onclick="saveDraft()">${SF_ICONS.dl}<span>儲存為草稿</span></button>
                </div>
              </div>
            </div>
            <div style="position:sticky;top:12px;">
              <div style="font-size:11px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">LINE 即時預覽</div>
              <div style="background:#7494c0;padding:18px 14px;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,.08);">
                <div style="font-size:11px;color:#fff;opacity:.85;text-align:center;margin-bottom:10px;">松富物流 · LINE 客戶群組</div>
                <div id="line-preview" style="background:#fff;border-radius:12px;overflow:hidden;font-family:-apple-system,'Noto Sans TC',sans-serif;"></div>
              </div>
              <div style="margin-top:10px;font-size:11px;color:var(--txt-3);line-height:1.5;">這是 Flex Message 在客戶 LINE 上的實際樣子（會即時跟著你打字更新）。</div>
            </div>
          </div>
        </div>

        <!-- 發送 Modal -->
        <div id="sendModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;padding:24px;">
          <div class="sf-card" style="max-width:560px;width:100%;max-height:90vh;display:flex;flex-direction:column;background:var(--bg-1);">
            <!-- Step 1: 選擇對象 -->
            <div id="send-step-1" style="display:flex;flex-direction:column;min-height:0;">
              <div class="sf-card-head">
                <div class="sf-card-title">${SF_ICONS.mail}選擇傳送對象</div>
                <button type="button" class="sf-btn sm ghost" onclick="closeSendModal()">✕</button>
              </div>
              <div style="padding:14px 18px;border-bottom:var(--hairline);display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <div style="position:relative;flex:1;min-width:200px;">
                  <input type="text" id="recipient-search" class="sf-input" placeholder="搜尋客戶名稱…" oninput="renderRecipientList()" style="padding-left:28px;">
                  <span style="position:absolute;left:8px;top:10px;color:var(--txt-3);">${SF_ICONS.search}</span>
                </div>
                <button type="button" class="sf-btn sm" onclick="selectAllGlobal()">全選</button>
                <button type="button" class="sf-btn sm" onclick="selectNoneGlobal()">取消全選</button>
                <span style="font-size:12px;color:var(--txt-2);margin-left:auto;">已選 <strong id="recipient-count" style="color:var(--accent);">0 / 0</strong></span>
              </div>
              <div id="recipient-list" style="flex:1;overflow:auto;max-height:50vh;"></div>
              <div style="padding:14px 18px;border-top:var(--hairline);display:flex;gap:8px;justify-content:flex-end;">
                <button type="button" class="sf-btn ghost" onclick="closeSendModal()">取消</button>
                <button type="button" class="sf-btn primary" id="send-next-btn" onclick="goToConfirm()">下一步：確認內容 →</button>
              </div>
            </div>
            <!-- Step 2: 確認 -->
            <div id="send-step-2" style="display:none;flex-direction:column;">
              <div class="sf-card-head">
                <div class="sf-card-title">${SF_ICONS.warn}最後確認</div>
                <button type="button" class="sf-btn sm ghost" onclick="closeSendModal()">✕</button>
              </div>
              <div style="padding:18px 22px;display:flex;flex-direction:column;gap:14px;">
                <div style="padding:14px;background:var(--warn-soft);border:1px solid var(--warn);border-radius:var(--radius);">
                  <div style="font-size:13px;color:var(--warn);font-weight:600;margin-bottom:6px;">${sfInlineIcon("warn")} 訊息送出後無法收回</div>
                  <div style="font-size:12px;color:var(--txt-2);line-height:1.6;">LINE 沒有提供訊息收回 API。若送錯需要發更正訊息（會額外計入訊息額度）。</div>
                </div>
                <div style="display:grid;grid-template-columns:80px 1fr;gap:10px;font-size:13px;">
                  <div style="color:var(--txt-3);">類型</div>
                  <div id="confirm-type" style="font-weight:600;"></div>
                  <div style="color:var(--txt-3);">將發送至</div>
                  <div><strong id="confirm-count" style="color:var(--accent);font-size:16px;">0</strong> 個客戶群組</div>
                  <div style="color:var(--txt-3);">客戶名單</div>
                  <div id="confirm-names" style="color:var(--txt-2);font-size:12px;line-height:1.6;"></div>
                </div>
                <div style="font-size:11px;color:var(--txt-3);line-height:1.5;background:var(--bg-2);padding:10px;border-radius:var(--radius);">
                  💰 <strong>計費提醒</strong>：1 個群組 = 1 則 LINE push 訊息（不論該群人數）。免費方案每月 200 則，輕用量方案每月 5,000 則。
                </div>
              </div>
              <div style="padding:14px 18px;border-top:var(--hairline);display:flex;gap:8px;justify-content:flex-end;">
                <button type="button" class="sf-btn ghost" onclick="showStep(1)">← 返回選擇</button>
                <button type="button" class="sf-btn primary" id="send-confirm-btn" onclick="confirmSend()" style="background:var(--bad);border-color:var(--bad);">${SF_ICONS.check}<span>確定送出</span></button>
              </div>
            </div>
          </div>
        </div>

        <script>
        function escapeHtmlJs(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
        // 預設顏色色票（依模板自動切換預設）
        const COLOR_PRESETS = {
          promo: [
            {name:'松富綠', value:'#1a7c6e'},
            {name:'松富藍', value:'#1d5fad'},
            {name:'喜慶紅', value:'#b91c1c'},
            {name:'晨光橘', value:'#e07c2a'},
            {name:'深紫', value:'#6b21a8'},
            {name:'墨黑', value:'#1f2937'},
          ],
          notice: [
            {name:'喜慶紅', value:'#b91c1c'},
            {name:'松富藍', value:'#1d5fad'},
            {name:'松富綠', value:'#1a7c6e'},
            {name:'墨黑', value:'#1f2937'},
            {name:'晨光橘', value:'#e07c2a'},
            {name:'深紫', value:'#6b21a8'},
          ],
          calendar: [
            {name:'喜慶紅', value:'#b91c1c'},
            {name:'松富藍', value:'#1d5fad'},
            {name:'深紫', value:'#6b21a8'},
            {name:'晨光橘', value:'#e07c2a'},
            {name:'松富綠', value:'#1a7c6e'},
            {name:'墨黑', value:'#1f2937'},
          ],
        };
        const DEFAULT_HEADER_COLOR = { promo:'#1a7c6e', notice:'#b91c1c', calendar:'#b91c1c' };
        function renderColorSwatches(){
          const type = document.getElementById('tmpl-type').value;
          const presets = COLOR_PRESETS[type] || COLOR_PRESETS.promo;
          const current = (document.getElementById('header_color').value || '').toLowerCase();
          const wrap = document.getElementById('color-swatches');
          if (!wrap) return;
          wrap.innerHTML = presets.map(p => {
            const active = p.value.toLowerCase() === current;
            return '<button type="button" onclick="pickColor(\\''+p.value+'\\')" title="'+p.name+'" style="width:30px;height:30px;border-radius:6px;border:'+(active?'2px solid var(--txt-1)':'1px solid var(--line-2)')+';background:'+p.value+';cursor:pointer;padding:0;"></button>';
          }).join('');
        }
        function pickColor(hex){
          document.getElementById('header_color').value = hex;
          document.getElementById('header_color_text').value = hex;
          renderColorSwatches();
          updatePreview();
        }
        function onColorChange(){
          const v = document.getElementById('header_color').value;
          document.getElementById('header_color_text').value = v;
          renderColorSwatches();
          updatePreview();
        }
        function onColorTextChange(){
          const v = (document.getElementById('header_color_text').value || '').trim();
          if (/^#[0-9a-fA-F]{6}$/.test(v)) {
            document.getElementById('header_color').value = v;
            renderColorSwatches();
            updatePreview();
          }
        }
        function renderPromo(d){
          const items = (d.items||[]).filter(x=>x.name);
          const subtitle = d.promo_subtitle || '';
          const dateText = d.promo_date || '';
          const note = d.promo_note || '';
          const headerColor = d.header_color || '#1a7c6e';
          const itemsHtml = items.length ? items.map((it, idx)=>\`
            <div style="display:flex;padding:8px 0;align-items:center;\${idx<items.length-1?'border-bottom:1px solid #eee;':''}">
              <div style="flex:3;font-size:14px;color:#222;word-break:break-word;">\${escapeHtmlJs(it.name)}</div>
              <div style="flex:2;text-align:right;font-size:14px;color:#e05000;font-weight:bold;font-variant-numeric:tabular-nums;">\${it.price?'$'+escapeHtmlJs(it.price)+'/'+escapeHtmlJs(it.unit||'斤'):'—'}</div>
              <div style="flex:2;text-align:right;font-size:14px;color:#888;font-variant-numeric:tabular-nums;">\${it.market?'$'+escapeHtmlJs(it.market):'—'}</div>
            </div>\`).join('') : '<div style="padding:18px 0;text-align:center;color:#bbb;font-size:13px;">尚未新增品項</div>';
          const hasFooter = dateText || note;
          return \`<div style="background:\${headerColor};padding:16px;color:#fff;">
              <div style="font-size:18px;font-weight:bold;">⚡ 限時優惠</div>
              \${subtitle?\`<div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:6px;">\${escapeHtmlJs(subtitle)}</div>\`:''}
            </div>
            <div style="background:#f9f9f9;padding:14px 16px;">
              <div style="display:flex;padding-bottom:5px;border-bottom:1px solid #ccc;">
                <div style="flex:3;font-size:10px;color:#aaa;">品名</div>
                <div style="flex:2;text-align:right;font-size:10px;color:#aaa;">優惠單價</div>
                <div style="flex:2;text-align:right;font-size:10px;color:#aaa;">行情上價</div>
              </div>\${itemsHtml}
            </div>
            \${hasFooter?\`<div style="background:#fff;padding:12px 16px;border-top:1px solid #eee;">
              \${dateText?\`<div style="font-size:11px;color:#666;">🕐 訂購時間：\${escapeHtmlJs(dateText)}</div>\`:''}
              \${note?\`<div style="font-size:11px;color:#888;margin-top:6px;">📝 \${escapeHtmlJs(note)}</div>\`:''}
            </div>\`:''}\`;
        }
        function renderNotice(d){
          const title = d.notice_title || '公告';
          const subtitle = d.notice_subtitle || '';
          const content = d.notice_content || '（無內容）';
          const headerColor = d.header_color || '#b91c1c';
          return \`<div style="background:\${headerColor};padding:22px 18px;color:#fff;text-align:center;">
              <div style="font-size:22px;font-weight:bold;letter-spacing:0.05em;">📢 \${escapeHtmlJs(title)}</div>
              \${subtitle?\`<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:8px;">\${escapeHtmlJs(subtitle)}</div>\`:''}
            </div>
            <div style="padding:20px;">
              <div style="font-size:14px;color:#333;line-height:1.9;white-space:pre-wrap;">\${escapeHtmlJs(content)}</div>
            </div>
            <div style="background:#f5f5f5;padding:10px;text-align:center;">
              <div style="font-size:10px;color:#999;">松富生鮮物流</div>
            </div>\`;
        }
        function renderCalendar(d){
          const title = d.cal_title || '休假公告';
          const subtitle = d.cal_subtitle || '';
          const ym = d.cal_year_month || '';
          const note = d.cal_note || '';
          const headerColor = d.header_color || '#b91c1c';
          let year = new Date().getFullYear();
          let month = new Date().getMonth() + 1;
          if (/^\\d{4}-\\d{2}$/.test(ym)) {
            const [y, m] = ym.split('-').map(Number);
            year = y; month = m;
          }
          const marks = {};
          (d.cal_marks||[]).forEach(m => {
            if (m && m.date) marks[m.date] = { label: m.label || '', type: m.type || 'off' };
          });
          const firstDay = new Date(year, month-1, 1);
          const daysInMonth = new Date(year, month, 0).getDate();
          const startWeekday = (firstDay.getDay() + 6) % 7; // 週一 = 0
          const cells = [];
          for (let i = 0; i < startWeekday; i++) cells.push(null);
          for (let d2 = 1; d2 <= daysInMonth; d2++) cells.push(d2);
          while (cells.length % 7 !== 0) cells.push(null);
          const rows = [];
          for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
          const wkHead = ['一','二','三','四','五','六','日'].map((w,i)=>\`<div style="flex:1;text-align:center;font-size:11px;font-weight:bold;color:\${i>=5?'#b91c1c':'#666'};padding:4px 0;">\${w}</div>\`).join('');
          const rowsHtml = rows.map(row => {
            const cellsHtml = row.map(cell => {
              if (cell == null) return '<div style="flex:1;height:42px;"></div>';
              const ymd = year + '-' + String(month).padStart(2,'0') + '-' + String(cell).padStart(2,'0');
              const mark = marks[ymd];
              let bg = '#fff', numColor = '#222', labelColor = '#666', label = '';
              if (mark) {
                label = mark.label || (mark.type==='work'?'正常':'公休');
                if (mark.type==='work') { bg='#fff8e1'; labelColor='#8b6914'; numColor='#5a4500'; }
                else if (mark.type==='highlight') { bg='#fef3c7'; labelColor='#92400e'; numColor='#5a4500'; }
                else { bg='#fee2e2'; labelColor='#b91c1c'; numColor='#7f1d1d'; }
              }
              return \`<div style="flex:1;background:\${bg};border-radius:4px;padding:4px 2px;margin:1px;min-height:42px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:14px;font-weight:bold;color:\${numColor};">\${cell}</div>
                \${label?\`<div style="font-size:9px;color:\${labelColor};margin-top:1px;">\${escapeHtmlJs(label)}</div>\`:''}
              </div>\`;
            }).join('');
            return '<div style="display:flex;">'+cellsHtml+'</div>';
          }).join('');
          return \`<div style="background:\${headerColor};padding:22px 18px;color:#fff;text-align:center;">
              <div style="font-size:22px;font-weight:bold;letter-spacing:0.05em;">\${escapeHtmlJs(title)}</div>
              \${subtitle?\`<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:8px;">\${escapeHtmlJs(subtitle)}</div>\`:''}
            </div>
            <div style="padding:14px;">
              <div style="font-size:13px;color:#888;text-align:center;font-weight:bold;margin-bottom:8px;">\${year} 年 \${month} 月</div>
              <div>
                <div style="display:flex;border-bottom:1px solid #e5e5e5;padding-bottom:2px;">\${wkHead}</div>
                \${rowsHtml}
              </div>
              \${note?\`<div style="border-top:1px solid #e5e5e5;margin-top:12px;padding-top:10px;font-size:13px;color:#444;line-height:1.8;white-space:pre-wrap;">\${escapeHtmlJs(note)}</div>\`:''}
            </div>
            <div style="background:#f5f5f5;padding:8px;text-align:center;">
              <div style="font-size:10px;color:#999;">松富生鮮物流 · 祝佳節愉快</div>
            </div>\`;
        }
        function renderImage(d){
          if (!d.image_url) return '<div style="padding:40px;text-align:center;color:#bbb;font-size:13px;">尚未上傳圖片</div>';
          return '<img src="' + d.image_url + '" alt="圖片預覽" style="display:block;width:100%;height:auto;">';
        }
        function updatePreview(){
          const data = collectFormData();
          let html;
          if (data.type==='notice') html = renderNotice(data);
          else if (data.type==='calendar') html = renderCalendar(data);
          else if (data.type==='image') html = renderImage(data);
          else html = renderPromo(data);
          document.getElementById('line-preview').innerHTML = html;
          const pw = document.getElementById('preview-wrap');
          if (pw && pw.style.display !== 'none') refreshJsonPreview();
        }
        function switchTab(tab,btn){
          ['tab-promo','tab-notice','tab-calendar','tab-image'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = id === ('tab-'+tab) ? '' : 'none';
          });
          document.getElementById('tmpl-type').value=tab;
          document.querySelectorAll('.sf-tab').forEach(b=>b.classList.remove('active'));
          btn.classList.add('active');
          // 切換到不同模板時，套用該模板的預設標題色（如果使用者已自訂則保留）
          const defaultC = DEFAULT_HEADER_COLOR[tab];
          const curC = (document.getElementById('header_color').value || '').toLowerCase();
          const prevDefaults = Object.values(DEFAULT_HEADER_COLOR).map(c=>c.toLowerCase());
          if (prevDefaults.includes(curC)) {
            document.getElementById('header_color').value = defaultC;
            document.getElementById('header_color_text').value = defaultC;
          }
          renderColorSwatches();
          updatePreview();
        }
        function addItemRow(){
          const wrap=document.getElementById('item-rows');
          const div=document.createElement('div');
          div.className='item-row';
          div.style.cssText='display:flex;gap:8px;align-items:center;margin-bottom:8px;';
          div.innerHTML='<input type="text" placeholder="品名" class="sf-input item-name" style="flex:1;" oninput="updatePreview()"><input type="text" placeholder="180" class="sf-input item-price" style="flex:0 0 90px;" oninput="updatePreview()"><input type="text" placeholder="斤" class="sf-input item-unit" style="flex:0 0 60px;" oninput="updatePreview()"><input type="text" placeholder="220" class="sf-input item-market" style="flex:0 0 90px;" oninput="updatePreview()"><button type="button" class="sf-btn sm ghost" onclick="removeRow(this)" title="刪除" style="flex:0 0 30px;padding:0;">✕</button>';
          wrap.appendChild(div);
        }
        function removeRow(btn){
          if(document.querySelectorAll('#item-rows .item-row').length<=1)return;
          btn.parentElement.remove();
          updatePreview();
        }
        function addMarkRow(){
          const wrap = document.getElementById('cal-marks');
          const div = document.createElement('div');
          div.className = 'cal-mark-row';
          div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
          div.innerHTML = '<input type="date" class="sf-input cal-mark-date" style="flex:0 0 140px;" oninput="updatePreview()"><input type="text" placeholder="公休" class="sf-input cal-mark-label" style="flex:0 0 120px;" oninput="updatePreview()"><select class="sf-select cal-mark-type" style="flex:1;" onchange="updatePreview()"><option value="off">紅色（公休）</option><option value="work">黃色（正常上班）</option><option value="highlight">橘色（強調）</option></select><button type="button" class="sf-btn sm ghost" onclick="removeMarkRow(this)" title="刪除" style="flex:0 0 30px;padding:0;">✕</button>';
          wrap.appendChild(div);
        }
        function removeMarkRow(btn){
          if (document.querySelectorAll('#cal-marks .cal-mark-row').length <= 1) {
            // 至少留一筆空白
            const row = btn.parentElement;
            row.querySelector('.cal-mark-date').value = '';
            row.querySelector('.cal-mark-label').value = '';
            row.querySelector('.cal-mark-type').value = 'off';
          } else {
            btn.parentElement.remove();
          }
          updatePreview();
        }
        function collectFormData(recipientsOverride){
          const type=document.getElementById('tmpl-type').value;
          const header_color = document.getElementById('header_color')?.value || '';
          let recipients;
          if (recipientsOverride !== undefined) recipients = recipientsOverride;
          else recipients = document.getElementById('recipients-select')?.value || 'all';
          const id = window.__BC_PREFILL_ID || null;
          if(type==='promo'){
            const items=[];
            document.querySelectorAll('#item-rows .item-row').forEach(row=>{
              const name=row.querySelector('.item-name')?.value?.trim();
              const price=row.querySelector('.item-price')?.value?.trim();
              const unit=row.querySelector('.item-unit')?.value?.trim();
              const market=row.querySelector('.item-market')?.value?.trim();
              if(name)items.push({name,price:price||'',unit:unit||'斤',market:market||''});
            });
            return{type,id,header_color,promo_date:document.getElementById('promo_date')?.value?.trim()||'',promo_subtitle:document.getElementById('promo_subtitle')?.value?.trim()||'',promo_note:document.getElementById('promo_note')?.value?.trim()||'',items,recipients};
          }
          if (type==='calendar'){
            const marks = [];
            document.querySelectorAll('#cal-marks .cal-mark-row').forEach(row=>{
              const date = row.querySelector('.cal-mark-date')?.value?.trim();
              if (!date) return;
              const label = row.querySelector('.cal-mark-label')?.value?.trim() || '';
              const t = row.querySelector('.cal-mark-type')?.value || 'off';
              marks.push({date, label, type: t});
            });
            return{type,id,header_color,cal_title:document.getElementById('cal_title')?.value?.trim()||'',cal_subtitle:document.getElementById('cal_subtitle')?.value?.trim()||'',cal_year_month:document.getElementById('cal_year_month')?.value?.trim()||'',cal_note:document.getElementById('cal_note')?.value?.trim()||'',cal_marks:marks,recipients};
          }
          if (type==='image'){
            return{type,id,image_id:document.getElementById('image_id')?.value||'',image_url:document.getElementById('image_url')?.value||'',recipients};
          }
          return{type,id,header_color,notice_title:document.getElementById('notice_title')?.value?.trim()||'',notice_subtitle:document.getElementById('notice_subtitle')?.value?.trim()||'',notice_content:document.getElementById('notice_content')?.value?.trim()||'',recipients};
        }
        function refreshJsonPreview(){ /* no-op：JSON 預覽功能已移除 */ }
        // === 圖片上傳 ===
        async function onImageSelected(){
          const f = document.getElementById('image_file').files[0];
          if (!f) return;
          if (f.size > 5*1024*1024) { alert('檔案超過 5 MB'); return; }
          const fd = new FormData();
          fd.append('image', f);
          const r = await fetch('/admin/broadcast/upload-image', { method:'POST', body: fd, credentials:'same-origin' });
          const j = await r.json();
          if (!j.ok) { alert('上傳失敗：' + (j.error || '')); return; }
          document.getElementById('image_id').value = j.id;
          document.getElementById('image_url').value = j.url;
          document.getElementById('image-upload-row').style.display = 'none';
          document.getElementById('image-loaded-row').style.display = '';
          updatePreview();
        }
        function resetImage(){
          document.getElementById('image_id').value = '';
          document.getElementById('image_url').value = '';
          document.getElementById('image_file').value = '';
          document.getElementById('image-upload-row').style.display = '';
          document.getElementById('image-loaded-row').style.display = 'none';
          updatePreview();
        }
        // === 草稿儲存 ===
        async function saveDraft(){
          const data = collectFormData();
          if (window.__BC_PREFILL_ID) data.id = window.__BC_PREFILL_ID;
          const r = await fetch('/admin/broadcast/save-draft', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
          const j = await r.json();
          if (j.ok) {
            window.__BC_PREFILL_ID = j.id;
            const url = new URL(location.href);
            if (!url.pathname.endsWith('/edit/' + j.id)) {
              history.replaceState(null, '', '/admin/broadcast/edit/' + j.id);
            }
            alert('✓ 已儲存為草稿');
          } else {
            alert('儲存失敗：' + (j.error || ''));
          }
        }
        // === 發送 Modal ===
        const ALL_CUSTOMERS = ${JSON.stringify(customersForJS)};
        function openSendModal(){
          const data = collectFormData();
          if(data.type==='promo' && (!data.items||!data.items.length)){ alert('請至少填入一個品項');return; }
          if(data.type==='notice' && !data.notice_title){ alert('請填入公告標題');return; }
          if(data.type==='calendar' && !data.cal_title){ alert('請填入公告標題');return; }
          if(data.type==='image' && !data.image_url){ alert('請先上傳圖片');return; }
          const m = document.getElementById('sendModal');
          m.style.display = 'flex';
          renderRecipientList();
          showStep(1);
        }
        function closeSendModal(){ document.getElementById('sendModal').style.display = 'none'; }
        function showStep(n){
          document.getElementById('send-step-1').style.display = n===1 ? '' : 'none';
          document.getElementById('send-step-2').style.display = n===2 ? '' : 'none';
        }
        function renderRecipientList(){
          const wrap = document.getElementById('recipient-list');
          const q = (document.getElementById('recipient-search')?.value || '').trim().toLowerCase();
          const filtered = ALL_CUSTOMERS.filter(c => !q || c.name.toLowerCase().includes(q) || String(c.id).toLowerCase().includes(q));
          wrap.innerHTML = filtered.map(c => {
            const checked = window.__BC_SEL && window.__BC_SEL.has(c.id) ? 'checked' : '';
            return '<label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--line);cursor:pointer;"><input type="checkbox" class="bc-cust-cb" data-id="' + c.id + '" '+checked+' onchange="onRecipientCheck()"><span style="flex:1;font-size:13px;">' + c.name.replace(/</g,'&lt;') + '</span><span class="mono" style="font-size:10px;color:var(--txt-3);">' + c.id.slice(0,12) + '</span></label>';
          }).join('') || '<div style="padding:20px;text-align:center;color:var(--txt-3);font-size:13px;">找不到客戶</div>';
          updateRecipientCount();
        }
        function onRecipientCheck(){
          if (!window.__BC_SEL) window.__BC_SEL = new Set();
          document.querySelectorAll('.bc-cust-cb').forEach(cb => {
            if (cb.checked) window.__BC_SEL.add(cb.dataset.id);
            else window.__BC_SEL.delete(cb.dataset.id);
          });
          updateRecipientCount();
        }
        function toggleSelectAll(){
          if (!window.__BC_SEL) window.__BC_SEL = new Set();
          const cbs = document.querySelectorAll('.bc-cust-cb');
          const allChecked = Array.from(cbs).every(c => c.checked);
          cbs.forEach(cb => { cb.checked = !allChecked; if (!allChecked) window.__BC_SEL.add(cb.dataset.id); else window.__BC_SEL.delete(cb.dataset.id); });
          updateRecipientCount();
        }
        function selectAllGlobal(){
          window.__BC_SEL = new Set(ALL_CUSTOMERS.map(c => c.id));
          renderRecipientList();
        }
        function selectNoneGlobal(){
          window.__BC_SEL = new Set();
          renderRecipientList();
        }
        function updateRecipientCount(){
          const n = window.__BC_SEL ? window.__BC_SEL.size : 0;
          const el = document.getElementById('recipient-count');
          if (el) el.textContent = n + ' / ' + ALL_CUSTOMERS.length;
          const nb = document.getElementById('send-next-btn');
          if (nb) { nb.disabled = n === 0; nb.style.opacity = n === 0 ? 0.5 : 1; }
        }
        function goToConfirm(){
          const n = window.__BC_SEL ? window.__BC_SEL.size : 0;
          if (n === 0) { alert('請至少選擇一個客戶'); return; }
          document.getElementById('confirm-count').textContent = n;
          // 顯示要發送的訊息類型
          const type = document.getElementById('tmpl-type').value;
          const typeLabel = { promo:'⚡ 限時優惠', notice:'📢 公告', calendar:'📅 行事曆公告', image:'🖼️ 圖片' }[type] || type;
          document.getElementById('confirm-type').textContent = typeLabel;
          // 列出要送的客戶名
          const names = [];
          window.__BC_SEL.forEach(id => {
            const c = ALL_CUSTOMERS.find(x => x.id === id);
            if (c) names.push(c.name);
          });
          document.getElementById('confirm-names').textContent = names.length > 8 ? (names.slice(0,8).join('、') + ' 等 ' + names.length + ' 個') : names.join('、');
          showStep(2);
        }
        async function confirmSend(){
          if (!window.__BC_SEL || !window.__BC_SEL.size) { alert('未選擇任何客戶');return; }
          const recipientIds = Array.from(window.__BC_SEL);
          const data = collectFormData(recipientIds);
          const btn = document.getElementById('send-confirm-btn');
          btn.disabled = true; btn.textContent = '傳送中…';
          // [fix 2026-07-08] fetch/json 網路錯誤過去沒接住 → 按鈕永遠卡在「傳送中…」。
          try {
            const r = await fetch('/admin/broadcast/send', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
            const j = await r.json();
            if (j.ok) { location.href = '/admin/broadcast?sent=' + (j.sent||0); return; }
            btn.disabled = false; btn.textContent = '確定送出'; alert('傳送失敗：' + (j.error || ''));
          } catch(e){
            btn.disabled = false; btn.textContent = '確定送出'; alert('傳送失敗：網路異常，請重試（' + (e && e.message || e) + '）');
          }
        }
        renderColorSwatches();
        updatePreview();
        // 預載草稿（若是編輯/複製）
        (function(){
          const prefillData = ${JSON.stringify(prefillData)};
          const prefillId = ${JSON.stringify(prefillId)};
          window.__BC_PREFILL_ID = prefillId;
          if (!prefillData) return;
          try {
            const type = prefillData.type || 'promo';
            const tabBtn = document.querySelector('.sf-tab[onclick*="\\''+type+'\\'"]');
            if (tabBtn) switchTab(type, tabBtn);
            if (prefillData.header_color) {
              document.getElementById('header_color').value = prefillData.header_color;
              document.getElementById('header_color_text').value = prefillData.header_color;
            }
            if (type === 'promo') {
              if (prefillData.promo_date) document.getElementById('promo_date').value = prefillData.promo_date;
              if (prefillData.promo_subtitle) document.getElementById('promo_subtitle').value = prefillData.promo_subtitle;
              if (prefillData.promo_note) document.getElementById('promo_note').value = prefillData.promo_note;
              const items = prefillData.items || [];
              if (items.length) {
                const wrap = document.getElementById('item-rows'); wrap.innerHTML = '';
                items.forEach(it => {
                  addItemRow();
                  const row = wrap.lastElementChild;
                  row.querySelector('.item-name').value = it.name || '';
                  row.querySelector('.item-price').value = it.price || '';
                  row.querySelector('.item-unit').value = it.unit || '';
                  row.querySelector('.item-market').value = it.market || '';
                });
              }
            } else if (type === 'notice') {
              if (prefillData.notice_title) document.getElementById('notice_title').value = prefillData.notice_title;
              if (prefillData.notice_subtitle) document.getElementById('notice_subtitle').value = prefillData.notice_subtitle;
              if (prefillData.notice_content) document.getElementById('notice_content').value = prefillData.notice_content;
            } else if (type === 'calendar') {
              if (prefillData.cal_title) document.getElementById('cal_title').value = prefillData.cal_title;
              if (prefillData.cal_subtitle) document.getElementById('cal_subtitle').value = prefillData.cal_subtitle;
              if (prefillData.cal_year_month) document.getElementById('cal_year_month').value = prefillData.cal_year_month;
              if (prefillData.cal_note) document.getElementById('cal_note').value = prefillData.cal_note;
              const marks = prefillData.cal_marks || [];
              if (marks.length) {
                const wrap = document.getElementById('cal-marks'); wrap.innerHTML = '';
                marks.forEach(m => {
                  addMarkRow();
                  const row = wrap.lastElementChild;
                  row.querySelector('.cal-mark-date').value = m.date || '';
                  row.querySelector('.cal-mark-label').value = m.label || '';
                  row.querySelector('.cal-mark-type').value = m.type || 'off';
                });
              }
            } else if (type === 'image') {
              if (prefillData.image_id) {
                document.getElementById('image_id').value = prefillData.image_id;
                document.getElementById('image_url').value = prefillData.image_url || '';
                const ip = document.getElementById('image-preview');
                if (ip && prefillData.image_url) ip.src = prefillData.image_url;
                document.getElementById('image-upload-row').style.display = 'none';
                document.getElementById('image-loaded-row').style.display = '';
              }
            }
            renderColorSwatches();
            updatePreview();
          } catch (e) { console.warn('預載草稿失敗:', e); }
        })();
        </script>`;
        res.send(notionPage("群發訊息", body, "broadcast", res));
    }
    router.get("/broadcast/new", requireManager, async (req, res) => {
        return renderBroadcastEditor(req, res, null);
    });
    router.get("/broadcast/edit/:id", requireManager, async (req, res) => {
        try {
            const row = await db.prepare("SELECT id, type, title, payload_json, recipients_json, status FROM broadcast_messages WHERE id = ?").get(req.params.id);
            if (!row) { res.redirect("/admin/broadcast?err=" + encodeURIComponent("找不到該訊息")); return; }
            return renderBroadcastEditor(req, res, row);
        } catch (e) {
            res.redirect("/admin/broadcast?err=" + encodeURIComponent("讀取失敗：" + (e?.message || e)));
        }
    });
    router.post("/broadcast/save-draft", requireManager, async (req, res) => {
        const data = req.body || {};
        const id = (data.id && typeof data.id === "string") ? data.id : (0, id_js_1.newId)("bc");
        const t = String(data.type || "promo");
        const title = (data.type === "notice" ? data.notice_title : data.type === "calendar" ? data.cal_title : data.type === "image" ? "圖片訊息" : (data.promo_subtitle || data.promo_date) || "未命名") || "未命名";
        const payload = JSON.stringify(data);
        const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
        try {
            const existing = await db.prepare("SELECT id FROM broadcast_messages WHERE id = ?").get(id);
            if (existing) {
                await db.prepare("UPDATE broadcast_messages SET type = ?, title = ?, payload_json = ?, updated_at = " + nowSql + " WHERE id = ?").run(t, title, payload, id);
            } else {
                await db.prepare("INSERT INTO broadcast_messages (id, type, title, payload_json, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, " + nowSql + ", " + nowSql + ")").run(id, t, title, payload, req.adminUsername || "");
            }
            res.json({ ok: true, id });
        } catch (e) {
            console.error("[broadcast] save-draft:", e?.message || e);
            res.status(500).json({ ok: false, error: e?.message || "儲存失敗" });
        }
    });
    router.post("/broadcast/clone/:id", requireManager, async (req, res) => {
        try {
            const src = await db.prepare("SELECT type, title, payload_json FROM broadcast_messages WHERE id = ?").get(req.params.id);
            if (!src) { res.redirect("/admin/broadcast?err=" + encodeURIComponent("來源不存在")); return; }
            const newId = (0, id_js_1.newId)("bc");
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            await db.prepare("INSERT INTO broadcast_messages (id, type, title, payload_json, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, " + nowSql + ", " + nowSql + ")").run(newId, src.type, (src.title || "") + "（複本）", src.payload_json, req.adminUsername || "");
            res.redirect("/admin/broadcast/edit/" + encodeURIComponent(newId));
        } catch (e) {
            res.redirect("/admin/broadcast?err=" + encodeURIComponent("複製失敗：" + (e?.message || e)));
        }
    });
    router.post("/broadcast/delete/:id", requireManager, async (req, res) => {
        try {
            await db.prepare("DELETE FROM broadcast_messages WHERE id = ? AND status = 'draft'").run(req.params.id);
            res.redirect("/admin/broadcast?ok=" + encodeURIComponent("已刪除草稿"));
        } catch (e) {
            res.redirect("/admin/broadcast?err=" + encodeURIComponent("刪除失敗：" + (e?.message || e)));
        }
    });
    // 圖片上傳：multipart，存 base64 入 DB，回傳公開 URL
    router.post("/broadcast/upload-image", requireManager, (req, res) => {
        const m = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }).single("image");
        m(req, res, async (err) => {
            if (err) { res.status(400).json({ ok: false, error: "上傳失敗：" + (err?.message || err) }); return; }
            if (!req.file) { res.status(400).json({ ok: false, error: "請選擇圖片檔" }); return; }
            try {
                const mime = req.file.mimetype || "image/jpeg";
                if (!/^image\/(jpeg|png|jpg)/.test(mime)) { res.status(400).json({ ok: false, error: "僅支援 JPG / PNG" }); return; }
                const buf = req.file.buffer;
                const b64 = buf.toString("base64");
                const id = (0, id_js_1.newId)("bcimg");
                const token = (0, crypto_1.randomBytes)(8).toString("hex");
                const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
                await db.prepare("INSERT INTO broadcast_images (id, token, filename, mime_type, size_bytes, data_b64, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, " + nowSql + ")").run(id, token, req.file.originalname || "image", mime, buf.length, b64, req.adminUsername || "");
                const host = req.get("host") || "";
                const proto = req.get("x-forwarded-proto") || "https";
                const url = `${proto}://${host}/broadcast-img/${encodeURIComponent(id)}/${encodeURIComponent(token)}`;
                res.json({ ok: true, id, url });
            } catch (e) {
                console.error("[broadcast] upload-image:", e?.message || e);
                res.status(500).json({ ok: false, error: e?.message || "儲存圖片失敗" });
            }
        });
    });
    function buildBroadcastFlex(data) {
        if (data.type === "notice") return buildNoticeFlexMessage(data);
        if (data.type === "calendar") return buildCalendarFlexMessage(data);
        return buildPromoFlexMessage(data);
    }
    function broadcastAltText(data) {
        if (data.type === "notice") return data.notice_title || "松富物流公告";
        if (data.type === "calendar") return data.cal_title || "松富物流行事曆公告";
        return "松富物流限時優惠";
    }
    router.post("/broadcast/preview", requireManager, async (req, res) => {
        const data = req.body || {};
        try {
            if (data.type === "image") {
                res.json({ type: "image", originalContentUrl: data.image_url || "", previewImageUrl: data.image_url || "" });
                return;
            }
            const msg = buildBroadcastFlex(data);
            res.json(msg);
        }
        catch (e) {
            res.status(400).json({ error: e?.message || "建立預覽失敗" });
        }
    });
    router.post("/broadcast/send", requireManager, async (req, res) => {
        const data = req.body || {};
        const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!token) {
            res.json({ ok: false, error: "未設定 LINE_CHANNEL_ACCESS_TOKEN" });
            return;
        }
        // 構造 LINE 訊息：依模板類型
        let lineMsg;
        try {
            if (data.type === "image") {
                if (!data.image_url) { res.json({ ok: false, error: "請先上傳圖片" }); return; }
                lineMsg = { type: "image", originalContentUrl: data.image_url, previewImageUrl: data.image_url };
            } else {
                const flex = buildBroadcastFlex(data);
                lineMsg = { type: "flex", altText: broadcastAltText(data), contents: flex };
            }
        }
        catch (e) {
            res.json({ ok: false, error: e?.message || "訊息建立失敗" });
            return;
        }
        // 收件人：array of customer IDs, 或 "all"
        let targets = [];
        const recipients = data.recipients;
        if (Array.isArray(recipients) && recipients.length) {
            const placeholders = recipients.map(() => "?").join(",");
            targets = await db.prepare(`SELECT line_group_id, name FROM customers WHERE id IN (${placeholders}) AND line_group_id IS NOT NULL AND line_group_id != ''`).all(...recipients);
        }
        else if (typeof recipients === "string" && recipients && recipients !== "all") {
            const cust = await db.prepare("SELECT line_group_id, name FROM customers WHERE id = ? AND line_group_id IS NOT NULL AND line_group_id != ''").get(recipients);
            if (cust) targets = [cust];
        }
        else {
            // 預設「全部」
            targets = await db.prepare("SELECT line_group_id, name FROM customers WHERE line_group_id IS NOT NULL AND line_group_id != '' AND (active IS NULL OR active = 1) ORDER BY name ASC").all();
        }
        if (!targets.length) { res.json({ ok: false, error: "找不到可發送的對象（請確認客戶已綁定 LINE 群組）" }); return; }
        let sent = 0;
        const errors = [];
        for (const t of targets) {
            try {
                const resp = await fetch("https://api.line.me/v2/bot/message/push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ to: t.line_group_id, messages: [lineMsg] }),
                });
                if (resp.ok) {
                    sent++;
                }
                else {
                    const errTxt = await resp.text().catch(() => "");
                    errors.push(`${t.name}: ${resp.status} ${errTxt.slice(0, 100)}`);
                }
            }
            catch (e) {
                errors.push(`${t.name}: ${e?.message || e}`);
            }
        }
        if (errors.length) console.warn("[broadcast] 部分傳送失敗:", errors.join(" | "));
        // 若帶 id，標記為已發送；否則新建一筆 sent 紀錄
        try {
            const nowSql = process.env.DATABASE_URL ? "CURRENT_TIMESTAMP" : "datetime('now')";
            const recordTitle = data.type === "notice" ? (data.notice_title || "公告") : data.type === "calendar" ? (data.cal_title || "行事曆") : data.type === "image" ? "圖片訊息" : "限時優惠";
            const payload = JSON.stringify(data);
            const bcId = (data.id && typeof data.id === "string") ? data.id : (0, id_js_1.newId)("bc");
            const existing = await db.prepare("SELECT id FROM broadcast_messages WHERE id = ?").get(bcId);
            if (existing) {
                await db.prepare("UPDATE broadcast_messages SET type = ?, title = ?, payload_json = ?, recipients_json = ?, status = 'sent', sent_at = " + nowSql + ", sent_count = ?, updated_at = " + nowSql + " WHERE id = ?").run(data.type || "promo", recordTitle, payload, JSON.stringify(recipients), sent, bcId);
            } else {
                await db.prepare("INSERT INTO broadcast_messages (id, type, title, payload_json, recipients_json, status, sent_at, sent_count, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'sent', " + nowSql + ", ?, ?, " + nowSql + ", " + nowSql + ")").run(bcId, data.type || "promo", recordTitle, payload, JSON.stringify(recipients), sent, req.adminUsername || "");
            }
        } catch (e) { console.warn("[broadcast] save sent record:", e?.message || e); }
        try {
            await logDataChange(req, {
                entityType: "broadcast",
                entityId: new Date().toISOString(),
                action: data.type === "notice" ? "send_notice" : data.type === "calendar" ? "send_calendar" : data.type === "image" ? "send_image" : "send_promo",
                summary: `群發訊息 ${data.type === "notice" ? "公告" : data.type === "calendar" ? "行事曆公告" : data.type === "image" ? "圖片" : "限時優惠"}：成功 ${sent} 個群組${errors.length ? `，失敗 ${errors.length}` : ""}`,
                meta: { type: data.type, sent, errors, payload: data, recipients_count: targets.length },
            });
        } catch (_) { /* ignore audit failure */ }
        res.json({ ok: true, sent, errors });
    });
}
