"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUsersRoutes = registerUsersRoutes;

// 人員管理域（帳號列表/新增·核准/停用啟用/職稱/重設密碼/刪除/LINE 綁定連結·代碼·解綁/
// 由發話者綁定/發話者顯示設定）路由：自 index.js 拆出（拆檔批次 6），純搬移、行為不變。

const express_1 = { default: require("express") };
const id_js_1 = require("../lib/id.js");
const liff_bind_token_js_1 = require("../lib/liff-bind-token.js");
const employee_line_binding_js_1 = require("../lib/employee-line-binding.js");
const line_conversation_js_1 = require("../lib/line-conversation.js");
const { SF_ICONS, sfInlineIcon, escapeHtml, escapeAttr, escJsStr } = require("./_shared.js");

function registerUsersRoutes(router, ctx) {
    const { db, notionPage, logDataChange, requireManager, loadAdminUsers, saveAdminUsers, normalizeAdminUserRecord, hashAdminPassword, isAdminOwnerUsername, ADMIN_TITLES, ADMIN_OWNER_EMAIL, fmtTaipeiYMDHM } = ctx;
    router.get("/users", requireManager, async (req, res) => {
        const users = await loadAdminUsers();
        const msg = req.query.ok === "add" ? "<p class=\"notion-msg ok\">已新增帳號（待審核）。</p>"
            : req.query.ok === "del" ? "<p class=\"notion-msg ok\">已刪除帳號。</p>"
                : req.query.ok === "approve" ? "<p class=\"notion-msg ok\">已核准帳號。</p>"
                    : req.query.ok === "status" ? "<p class=\"notion-msg ok\">已更新狀態。</p>"
                        : req.query.err === "dup" ? "<p class=\"notion-msg err\">帳號已存在。</p>"
                            : req.query.err === "last" ? "<p class=\"notion-msg err\">至少需保留一個帳號。</p>"
                                : req.query.err === "weak" ? "<p class=\"notion-msg err\">帳號至少 2 字元、密碼至少 4 字元。</p>"
                                    : req.query.err === "forbidden" ? "<p class=\"notion-msg err\">無權限執行此操作。</p>"
                                        : req.query.err === "owner" ? "<p class=\"notion-msg err\">不可變更負責人帳號。</p>" : "";
        const titleOpts = ADMIN_TITLES.map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join("");
        const pending = users.filter((u) => u.status === "pending");
        const activeList = users.filter((u) => u.status === "active");
        const disabledList = users.filter((u) => u.status === "disabled");
        const pendingRows = pending.map((u) => {
            const approveBtn = isAdminOwnerUsername(req.adminUsername)
                ? `<form method="post" action="/admin/users/approve" style="display:inline;margin-right:8px;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="btn btn-primary">核准</button></form>`
                : "<span class=\"notion-hint\">僅負責人可核准</span>";
            return `<tr><td>${escapeHtml(u.name || u.username)}</td><td><code>${escapeHtml(u.username)}</code></td><td>${escapeHtml(u.title)}</td><td>${approveBtn}</td></tr>`;
        }).join("");
        const userDataAttrs = (u) => `data-username="${escapeAttr(u.username)}" data-name="${escapeAttr(u.name || "")}" data-title="${escapeAttr(u.title || "")}" data-owner="${isAdminOwnerUsername(u.username) ? "1" : "0"}"`;
        const activeRows = activeList.map((u) => {
            const ownerMark = isAdminOwnerUsername(u.username) ? ` <span class="sf-pill accent" style="font-size:10px;">負責人</span>` : "";
            const ops = [];
            ops.push(`<button type="button" class="sf-btn sm" onclick='openUserEdit(${JSON.stringify({u:u.username,n:u.name||"",t:u.title||"",owner:isAdminOwnerUsername(u.username),c:!!u.canCash})})'>${SF_ICONS.edit}<span>編輯</span></button>`);
            if (!isAdminOwnerUsername(u.username)) {
                ops.push(`<form method="post" action="/admin/users/set-status" style="display:inline;margin:0;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><input type="hidden" name="status" value="disabled"><button type="submit" class="sf-btn sm" onclick="return confirm('確定停用此帳號？');">停用</button></form>`);
            }
            if (!isAdminOwnerUsername(u.username) && users.length > 1) {
                ops.push(`<form method="post" action="/admin/users/delete" style="display:inline;margin:0;" onsubmit="return confirm('確定刪除？此動作無法復原。');"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm danger">${SF_ICONS.x}</button></form>`);
            }
            return `<tr ${userDataAttrs(u)}>
              <td><strong>${escapeHtml(u.name || u.username)}</strong>${ownerMark}</td>
              <td><code class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml(u.username)}</code></td>
              <td><span class="sf-pill">${escapeHtml(u.title)}</span></td>
              <td><span class="sf-pill ok">啟用</span></td>
              <td style="white-space:nowrap;">${ops.join(" ")}</td>
            </tr>`;
        }).join("");
        const disabledRows = disabledList.map((u) => {
            const enForm = `<form method="post" action="/admin/users/set-status" style="display:inline;margin:0;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><input type="hidden" name="status" value="active"><button type="submit" class="sf-btn sm">重新啟用</button></form>`;
            const delForm = `<form method="post" action="/admin/users/delete" style="display:inline;margin:0;" onsubmit="return confirm('確定刪除此帳號？');"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm danger">${SF_ICONS.x}</button></form>`;
            return `<tr>
              <td><strong>${escapeHtml(u.name || u.username)}</strong></td>
              <td><code class="mono" style="font-size:11px;color:var(--txt-2);">${escapeHtml(u.username)}</code></td>
              <td><span class="sf-pill">${escapeHtml(u.title)}</span></td>
              <td><span class="sf-pill">停用</span></td>
              <td style="white-space:nowrap;">${enForm} ${!isAdminOwnerUsername(u.username) ? delForm : ""}</td>
            </tr>`;
        }).join("");
        // 全站可用職稱
        const titleOptsAll = ADMIN_TITLES.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join("");
        const bindOkCode = typeof req.query.bind_code === "string" ? req.query.bind_code.trim() : "";
        const bindOkUser = typeof req.query.bind_user === "string" ? req.query.bind_user.trim() : "";
        const bindOkLink = typeof req.query.bind_link === "string" ? req.query.bind_link.trim() : "";
        const bindMsg = bindOkLink && bindOkUser
            ? `<div class="sf-card" style="border-left:3px solid var(--accent);margin-bottom:16px;padding:14px 18px;">
                <div style="font-size:13px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">LIFF 員工綁定連結</div>
                <div style="font-size:14px;margin-bottom:10px;">已為 <strong>${escapeHtml(bindOkUser)}</strong> 產生綁定連結（30 分鐘內有效）：</div>
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                  <input id="liff-bind-url" type="text" readonly value="${escapeAttr(bindOkLink)}" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-family:ui-monospace,monospace;font-size:12px;">
                  <button type="button" class="sf-btn sm" onclick="navigator.clipboard.writeText(document.getElementById('liff-bind-url').value).then(()=>{this.textContent='已複製';setTimeout(()=>this.textContent='複製',1500);})">複製</button>
                </div>
                <div style="font-size:12px;color:var(--txt-2);line-height:1.6;">請將此連結 LINE 給該員工。員工在 LINE 中點開連結 → 確認身份 → 按「綁定」即完成。一次性使用。</div>
              </div>`
            : (bindOkCode && bindOkUser
            ? `<div class="sf-card" style="border-left:3px solid var(--accent);margin-bottom:16px;padding:14px 18px;">
                <div style="font-size:13px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">員工 LINE 綁定碼</div>
                <div style="font-size:14px;margin-bottom:10px;">已為 <strong>${escapeHtml(bindOkUser)}</strong> 產生綁定碼（10 分鐘內有效）：</div>
                <div class="mono" style="font-size:32px;font-weight:700;letter-spacing:6px;color:var(--accent);margin-bottom:10px;">${escapeHtml(bindOkCode)}</div>
                <div style="font-size:12px;color:var(--txt-2);line-height:1.6;">請該員工在 LINE 私訊本 Bot 傳送：<br><code style="background:var(--bg-3);padding:2px 8px;border-radius:3px;">綁定 ${escapeHtml(bindOkCode)}</code><br>送出後其 LINE userId 會自動綁到此帳號，之後該員工在客戶群內傳訊息將跳過 AI 解析（僅記錄稽核軌跡）。</div>
              </div>`
            : "");
        const liffEmployeeBindReady = Boolean((process.env.LIFF_ID_EMPLOYEE_BIND || "").trim() && (process.env.LINE_LOGIN_CHANNEL_ID || "").trim());
        // 員工 LINE 綁定列（僅啟用中帳號）
        const bindingRows = activeList.map(u => {
            const lu = u.lineUserId;
            const bound = !!lu;
            const luShort = lu ? `<code class="mono" style="font-size:11px;color:var(--txt-2);" title="${escapeAttr(lu)}">${escapeHtml(lu.slice(0,6))}…${escapeHtml(lu.slice(-4))}</code>` : "—";
            const boundAt = u.lineBoundAt ? `<span style="font-size:11px;color:var(--txt-3);">${escapeHtml(String(u.lineBoundAt).slice(0,16).replace("T"," "))}</span>` : "";
            const liffBtn = liffEmployeeBindReady
                ? `<form method="post" action="/admin/users/line-bind-link" style="display:inline;margin-right:4px;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm primary" title="產生一次性 LIFF 綁定連結（30 分鐘有效）">LIFF 連結</button></form>`
                : `<button type="button" class="sf-btn sm" disabled title="尚未設定 LIFF_ID_EMPLOYEE_BIND / LINE_LOGIN_CHANNEL_ID">LIFF 連結</button>`;
            const btn = bound
                ? `<form method="post" action="/admin/users/line-unbind" style="display:inline;" onsubmit="return confirm('確定解除 ${escapeAttr(u.username)} 的 LINE 綁定？');"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm danger">解綁</button></form>`
                : `${liffBtn}<form method="post" action="/admin/users/line-bind-code" style="display:inline;"><input type="hidden" name="username" value="${escapeAttr(u.username)}"><button type="submit" class="sf-btn sm" title="舊式：產生 6 位數綁定碼，員工私訊 Bot 輸入完成綁定">6 位碼</button></form>`;
            return `<tr>
              <td>${escapeHtml(u.name || u.username)} <span class="sf-pill">${escapeHtml(u.title)}</span></td>
              <td><code>${escapeHtml(u.username)}</code></td>
              <td>${bound ? `<span class="sf-pill ok">已綁定</span>` : `<span class="sf-pill">未綁定</span>`}</td>
              <td>${luShort}</td>
              <td>${boundAt}</td>
              <td>${btn}</td>
            </tr>`;
        }).join("");
        // 群組發言成員（自動偵測）：曾在客戶群發言的 LINE 帳號。
        // 主名單只留「未判定」的人；標成同事或按「非公司人員」排除後移到收合的「已處理」區，名單不會被客戶塞滿。
        const speakers = await line_conversation_js_1.listGroupSpeakers(db, 200);
        const boundByLineUserId = new Map();
        for (const u of activeList) {
            if (u.lineUserId) boundByLineUserId.set(String(u.lineUserId).trim(), u);
        }
        const speakerUserOpts = activeList.map(u => `<option value="${escapeAttr(u.username)}">${escapeHtml(u.name || u.username)}${u.title ? `（${escapeHtml(u.title)}）` : ""}</option>`).join("");
        const renderSpeakerRow = (s) => {
            const lu = String(s.line_user_id || "");
            const bound = boundByLineUserId.get(lu);
            const nameCell = s.display_name ? `<strong>${escapeHtml(s.display_name)}</strong>` : `<span style="color:var(--txt-3);">（取不到名稱）</span>`;
            const luShort = `<code class="mono" style="font-size:11px;color:var(--txt-3);" title="${escapeAttr(lu)}">${escapeHtml(lu.slice(0, 6))}…${escapeHtml(lu.slice(-4))}</code>`;
            const grp = s.customer_name ? escapeHtml(s.customer_name) : `<code class="mono" style="font-size:11px;color:var(--txt-3);" title="${escapeAttr(String(s.group_id || ""))}">${escapeHtml(String(s.group_id || "").slice(0, 8))}…</code>`;
            const last = s.last_spoke_at ? escapeHtml(fmtTaipeiYMDHM(s.last_spoke_at)) : "—";
            let statusCell, actionCell;
            if (bound) {
                statusCell = `<span class="sf-pill ok">同事：${escapeHtml(bound.name || bound.username)}</span>`;
                actionCell = `<form method="post" action="/admin/users/line-unbind" style="display:inline;margin:0;" onsubmit="return confirm('解除 ${escapeAttr(bound.username)} 的 LINE 綁定？其訊息將回到一般客戶訊息處理。');"><input type="hidden" name="username" value="${escapeAttr(bound.username)}"><button type="submit" class="sf-btn sm">解除標記</button></form>`;
            }
            else if (s.dismissed_at) {
                statusCell = `<span class="sf-pill">非公司人員</span>`;
                actionCell = `<form method="post" action="/admin/users/speaker-visibility" style="display:inline;margin:0;"><input type="hidden" name="line_user_id" value="${escapeAttr(lu)}"><input type="hidden" name="visibility" value="restore"><button type="submit" class="sf-btn sm">恢復到名單</button></form>`;
            }
            else {
                statusCell = `<span class="sf-pill warn">未判定</span>`;
                actionCell = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                    <form method="post" action="/admin/users/bind-line-from-speaker" style="display:flex;gap:6px;align-items:center;margin:0;" onsubmit="return confirm('確定將此發言者標記為所選同事？\\n之後其在客戶群的訊息不做 AI 解析，並在訂單對話以「同事」樣式顯示。');">
                      <input type="hidden" name="line_user_id" value="${escapeAttr(lu)}">
                      <input type="hidden" name="display_name" value="${escapeAttr(s.display_name || "")}">
                      <select name="username" class="sf-select" style="min-width:9rem;font-size:12px;height:30px;padding:2px 6px;">${speakerUserOpts}</select>
                      <button type="submit" class="sf-btn sm primary">標記為同事</button>
                    </form>
                    <form method="post" action="/admin/users/speaker-visibility" style="display:inline;margin:0;">
                      <input type="hidden" name="line_user_id" value="${escapeAttr(lu)}">
                      <input type="hidden" name="visibility" value="dismiss">
                      <button type="submit" class="sf-btn sm" title="標記為客戶／非公司人員，移到下方「已處理」收合區（可隨時恢復）">非公司人員</button>
                    </form>
                  </div>`;
            }
            return `<tr><td>${nameCell}<div>${luShort}</div></td><td>${grp}</td><td style="text-align:right;">${s.message_count ?? 0}</td><td style="white-space:nowrap;">${last}</td><td>${statusCell}</td><td>${actionCell}</td></tr>`;
        };
        const pendingSpeakers = (speakers || []).filter(s => !boundByLineUserId.get(String(s.line_user_id || "")) && !s.dismissed_at);
        const handledSpeakers = (speakers || []).filter(s => boundByLineUserId.get(String(s.line_user_id || "")) || s.dismissed_at);
        const pendingSpeakerRows = pendingSpeakers.map(renderSpeakerRow).join("");
        const handledSpeakerRows = handledSpeakers.map(renderSpeakerRow).join("");
        const body = `
        <div class="sf-root" style="padding:24px 32px;display:flex;flex-direction:column;gap:16px;background:var(--bg-0);min-height:100%;width:100%;box-sizing:border-box;">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="sf-breadcrumb" style="margin-bottom:6px;">系統設定 / 人員管理</div>
              <h1 style="margin:0;font-size:22px;font-weight:600;">人員管理</h1>
              <p style="margin-top:4px;color:var(--txt-3);font-size:12px;">僅<strong>經理</strong>可進入本頁。負責人：<code class="mono" style="font-size:11px;">${escapeHtml(ADMIN_OWNER_EMAIL)}</code>。新帳號須由負責人核准後才可登入。</p>
            </div>
            <button type="button" class="sf-btn primary" onclick="document.getElementById('addUserModal').style.display='flex'">${SF_ICONS.plus}<span>新增帳號</span></button>
          </div>
          ${msg.replace(/<p class="notion-msg ok">/g, '<div class="sf-pill ok" style="align-self:flex-start;">').replace(/<p class="notion-msg err">/g, '<div class="sf-pill bad" style="align-self:flex-start;">').replace(/<\/p>/g, "</div>")}
          ${bindMsg}

          ${pending.length ? `<div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.warn} 待審核（${pending.length}）</div>
              <span class="sf-card-sub">新帳號須由負責人核准</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th>姓名</th><th>帳號</th><th>職稱</th><th style="width:120px;">操作</th></tr></thead>
                <tbody>${pendingRows}</tbody>
              </table>
            </div>
          </div>` : ""}

          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.users} 啟用中（${activeList.length}）</div>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th>姓名</th><th>帳號</th><th style="width:90px;">職稱</th><th style="width:80px;">狀態</th><th style="width:220px;">操作</th></tr></thead>
                <tbody>${activeRows || `<tr><td colspan='5' style='padding:24px;text-align:center;color:var(--txt-3);'>尚無啟用帳號</td></tr>`}</tbody>
              </table>
            </div>
          </div>

          ${disabledList.length ? `<details class="sf-card">
            <summary style="padding:12px 16px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:var(--txt-3);">▸</span>
              <span style="font-size:13px;font-weight:600;">停用（${disabledList.length}）</span>
            </summary>
            <div class="sf-table-wrap" style="border:0;border-radius:0;border-top:var(--hairline);">
              <table class="sf-table">
                <thead><tr><th>姓名</th><th>帳號</th><th style="width:90px;">職稱</th><th style="width:80px;">狀態</th><th style="width:220px;">操作</th></tr></thead>
                <tbody>${disabledRows}</tbody>
              </table>
            </div>
          </details>` : ""}

          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.users} 群組發言成員（自動偵測・待判定 ${pendingSpeakers.length}）</div>
              <span class="sf-card-sub">曾在客戶群發言的 LINE 帳號——是同事就標記、不是就按「非公司人員」移出名單</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th>LINE 名稱</th><th>群組（客戶）</th><th style="width:70px;">訊息數</th><th style="width:150px;">最後發言</th><th style="width:120px;">身份</th><th style="width:340px;">操作</th></tr></thead>
                <tbody>${pendingSpeakerRows || `<tr><td colspan='6' style='padding:24px;text-align:center;color:var(--txt-3);'>沒有待判定的發言者${handledSpeakers.length ? "（已處理的收在下方）" : "——客戶群內有人發言就會自動出現在這裡"}</td></tr>`}</tbody>
              </table>
            </div>
            ${handledSpeakers.length ? `
            <details style="border-top:var(--hairline);">
              <summary style="padding:10px 16px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;color:var(--txt-3);">▸</span>
                <span style="font-size:13px;font-weight:600;color:var(--txt-2);">已處理（${handledSpeakers.length}）</span>
                <span style="font-size:11px;color:var(--txt-3);">同事與已排除的非公司人員收在這裡，可解除或恢復</span>
              </summary>
              <div class="sf-table-wrap" style="border:0;border-radius:0;border-top:var(--hairline);">
                <table class="sf-table">
                  <thead><tr><th>LINE 名稱</th><th>群組（客戶）</th><th style="width:70px;">訊息數</th><th style="width:150px;">最後發言</th><th style="width:120px;">身份</th><th style="width:340px;">操作</th></tr></thead>
                  <tbody>${handledSpeakerRows}</tbody>
                </table>
              </div>
            </details>` : ""}
          </div>

          <div class="sf-card">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.link} 員工 LINE 綁定（內稽用）</div>
              <span class="sf-card-sub">綁定後，員工在客戶群組內傳訊息不會觸發 AI 解析</span>
            </div>
            <div class="sf-table-wrap" style="border:0;border-radius:0;">
              <table class="sf-table">
                <thead><tr><th>姓名</th><th>帳號</th><th style="width:90px;">綁定狀態</th><th>LINE userId</th><th style="width:160px;">綁定時間</th><th style="width:140px;">操作</th></tr></thead>
                <tbody>${bindingRows || `<tr><td colspan='6' style='padding:24px;text-align:center;color:var(--txt-3);'>尚無啟用帳號</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 編輯使用者 Modal -->
        <div id="userEditModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;padding:24px;">
          <div class="sf-card" style="max-width:480px;width:100%;background:var(--bg-1);">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.edit} 編輯員工資料</div>
              <button type="button" class="sf-btn sm ghost" onclick="document.getElementById('userEditModal').style.display='none'">✕</button>
            </div>
            <form method="post" action="/admin/users/set-title" style="padding:16px 18px;display:flex;flex-direction:column;gap:14px;">
              <input type="hidden" name="username" id="ue-username">
              <div>
                <label class="sf-label">帳號（不可修改）</label>
                <input class="sf-input" id="ue-username-display" disabled style="background:var(--bg-3);color:var(--txt-3);">
              </div>
              <div>
                <label class="sf-label">姓名</label>
                <input class="sf-input" name="name" id="ue-name" required>
              </div>
              <div id="ue-title-row">
                <label class="sf-label">職稱</label>
                <select class="sf-select" name="title" id="ue-title">${titleOptsAll}</select>
                <p style="margin-top:6px;font-size:11px;color:var(--txt-3);">負責人帳號無法變更職稱。<strong>移工</strong>無法刪除任何資料（系統限制）。</p>
              </div>
              <div>
                <label class="sf-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" name="can_cash" id="ue-cancash" value="1"> 收款作業權限（可進入松富銷貨統計／現金收款／收款客戶主檔）
                </label>
                <p style="margin-top:6px;font-size:11px;color:var(--txt-3);">經理天生具備此權限，無需勾選。</p>
              </div>
              <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:6px;border-top:var(--hairline);">
                <button type="button" class="sf-btn ghost" onclick="document.getElementById('userEditModal').style.display='none'">取消</button>
                <button type="submit" class="sf-btn primary">${SF_ICONS.check}<span>儲存</span></button>
              </div>
            </form>
            <div style="padding:14px 18px;border-top:var(--hairline);background:var(--bg-2);">
              <div style="font-size:12px;color:var(--txt-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">重設密碼</div>
              <form method="post" action="/admin/users/reset-password" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;" onsubmit="return confirm('確定要重設此帳號密碼？');">
                <input type="hidden" name="username" id="ue-pwd-username">
                <input class="sf-input" name="new_password" type="password" placeholder="新密碼（至少 4 字元）" minlength="4" required style="flex:1;min-width:160px;">
                <button type="submit" class="sf-btn danger">${SF_ICONS.refresh}<span>重設</span></button>
              </form>
            </div>
          </div>
        </div>

        <!-- 新增帳號 Modal -->
        <div id="addUserModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;align-items:center;justify-content:center;padding:24px;">
          <div class="sf-card" style="max-width:480px;width:100%;background:var(--bg-1);">
            <div class="sf-card-head">
              <div class="sf-card-title">${SF_ICONS.plus} 新增帳號（待審核）</div>
              <button type="button" class="sf-btn sm ghost" onclick="document.getElementById('addUserModal').style.display='none'">✕</button>
            </div>
            <form method="post" action="/admin/users/add" style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
              <div><label class="sf-label">姓名</label><input class="sf-input" type="text" name="name" required minlength="1" autocomplete="off"></div>
              <div><label class="sf-label">帳號（建議用信箱）</label><input class="sf-input" type="text" name="username" required minlength="2" autocomplete="off"></div>
              <div><label class="sf-label">密碼（至少 4 字元）</label><input class="sf-input" type="password" name="password" required minlength="4" autocomplete="new-password"></div>
              <div><label class="sf-label">職稱</label><select class="sf-select" name="title">${titleOpts}</select></div>
              <p style="margin:0;font-size:11px;color:var(--txt-3);">送出後須由負責人（<code class="mono">${escapeHtml(ADMIN_OWNER_EMAIL)}</code>）核准才可登入。</p>
              <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:6px;border-top:var(--hairline);">
                <button type="button" class="sf-btn ghost" onclick="document.getElementById('addUserModal').style.display='none'">取消</button>
                <button type="submit" class="sf-btn primary">${SF_ICONS.check}<span>建立</span></button>
              </div>
            </form>
          </div>
        </div>

        <script>
        function openUserEdit(info){
          document.getElementById('ue-username').value = info.u;
          document.getElementById('ue-username-display').value = info.u;
          document.getElementById('ue-name').value = info.n || '';
          document.getElementById('ue-pwd-username').value = info.u;
          const titleRow = document.getElementById('ue-title-row');
          const titleSel = document.getElementById('ue-title');
          if (info.owner) {
            titleRow.style.opacity = '0.5';
            titleSel.disabled = true;
            titleSel.value = info.t || '經理';
          } else {
            titleRow.style.opacity = '1';
            titleSel.disabled = false;
            titleSel.value = info.t || '行政';
          }
          var cc = document.getElementById('ue-cancash');
          if (cc) { cc.checked = !!info.c; cc.disabled = !!info.owner; }
          document.getElementById('userEditModal').style.display = 'flex';
        }
        </script>`;
        res.type("text/html").send(notionPage("人員管理", body, "users", res));
    });
    router.post("/users/add", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const name = (req.body.name || "").trim();
        const username = (req.body.username || "").trim();
        const password = (req.body.password || "").toString();
        let title = String(req.body.title || "行政").trim();
        if (!ADMIN_TITLES.includes(title))
            title = "行政";
        if (!name || username.length < 2 || password.length < 4) {
            res.redirect("/admin/users?err=weak");
            return;
        }
        const users = await loadAdminUsers();
        if (users.some((x) => x.username === username)) {
            res.redirect("/admin/users?err=dup");
            return;
        }
        const now = new Date().toISOString();
        users.push({ username, name, passwordHash: hashAdminPassword(password), title, status: "pending", createdAt: now });
        await saveAdminUsers(users);
        // [fix 2026-07-18 稽核] 帳號異動留軌跡；一律不記 passwordHash／密碼明文。
        try { await logDataChange(req, { entityType: "admin_user", entityId: username, action: "create", summary: `新增帳號 ${username}（${name}，職稱 ${title}，待核准）`, meta: { username, name, title, status: "pending" } }); } catch (_) {}
        res.redirect("/admin/users?ok=add");
    });
    router.post("/users/approve", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        if (!isAdminOwnerUsername(req.adminUsername)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const target = (req.body.username || "").trim();
        const name = (req.body.name || "").trim();
        const users = await loadAdminUsers();
        const ix = users.findIndex((x) => x.username === target);
        if (ix < 0 || users[ix].status !== "pending") {
            res.redirect("/admin/users");
            return;
        }
        users[ix].status = "active";
        users[ix].approvedBy = req.adminUsername;
        users[ix].approvedAt = new Date().toISOString();
        await saveAdminUsers(users);
        try { await logDataChange(req, { entityType: "admin_user", entityId: target, action: "approve", summary: `核准帳號 ${target}`, meta: { before: { status: "pending" }, after: { status: "active", approvedBy: req.adminUsername } } }); } catch (_) {}
        res.redirect("/admin/users?ok=approve");
    });
    router.post("/users/set-status", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const target = (req.body.username || "").trim();
        const status = String(req.body.status || "").trim();
        if (status !== "active" && status !== "disabled") {
            res.redirect("/admin/users");
            return;
        }
        if (isAdminOwnerUsername(target)) {
            res.redirect("/admin/users?err=owner");
            return;
        }
        const users = await loadAdminUsers();
        const ix = users.findIndex((x) => x.username === target);
        if (ix < 0) {
            res.redirect("/admin/users");
            return;
        }
        const beforeStatus = users[ix].status;
        users[ix].status = status;
        await saveAdminUsers(users);
        if (beforeStatus !== status) { try { await logDataChange(req, { entityType: "admin_user", entityId: target, action: "set_status", summary: `帳號 ${target} 狀態：${beforeStatus || "—"} → ${status}`, meta: { before: { status: beforeStatus }, after: { status } } }); } catch (_) {} }
        res.redirect("/admin/users?ok=status");
    });
    router.post("/users/set-title", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const target = (req.body.username || "").trim();
        const name = String(req.body.name || "").trim();
        let title = String(req.body.title || "").trim();
        if (isAdminOwnerUsername(target)) {
            // 負責人帳號允許更新姓名，但不變更職稱
            const users = await loadAdminUsers();
            const ix = users.findIndex((x) => x.username === target);
            if (ix >= 0 && name) {
                const beforeName = users[ix].name;
                users[ix].name = name;
                await saveAdminUsers(users);
                if (beforeName !== name) { try { await logDataChange(req, { entityType: "admin_user", entityId: target, action: "set_title", summary: `更新負責人姓名：${beforeName || "—"} → ${name}`, meta: { before: { name: beforeName }, after: { name } } }); } catch (_) {} }
            }
            res.redirect("/admin/users?ok=status");
            return;
        }
        if (!ADMIN_TITLES.includes(title))
            title = "行政";
        const users = await loadAdminUsers();
        const ix = users.findIndex((x) => x.username === target);
        if (ix < 0) {
            res.redirect("/admin/users");
            return;
        }
        const beforeTitle = { title: users[ix].title, name: users[ix].name, canCash: !!users[ix].canCash };
        users[ix].title = title;
        if (name) users[ix].name = name;
        users[ix].canCash = (req.body.can_cash === "1" || req.body.can_cash === "on");
        await saveAdminUsers(users);
        const afterTitle = { title, name: name || beforeTitle.name, canCash: users[ix].canCash };
        if (beforeTitle.title !== afterTitle.title || beforeTitle.name !== afterTitle.name || beforeTitle.canCash !== afterTitle.canCash) {
            try { await logDataChange(req, { entityType: "admin_user", entityId: target, action: "set_title", summary: `帳號 ${target} 職稱/權限異動：${beforeTitle.title || "—"} → ${title}`, meta: { before: beforeTitle, after: afterTitle } }); } catch (_) {}
        }
        res.redirect("/admin/users?ok=status");
    });
    router.post("/users/reset-password", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const target = (req.body.username || "").trim();
        const newPwd = String(req.body.new_password || "");
        if (!target || newPwd.length < 4) {
            res.redirect("/admin/users?err=weak");
            return;
        }
        // [fix 2026-07-08] 只有負責人本人能重設負責人密碼，否則任一經理可重設負責人密碼奪權
        if (isAdminOwnerUsername(target) && !isAdminOwnerUsername(req.adminUsername)) {
            res.redirect("/admin/users?err=" + encodeURIComponent("僅負責人本人可重設負責人密碼"));
            return;
        }
        const users = await loadAdminUsers();
        const ix = users.findIndex((x) => x.username === target);
        if (ix < 0) {
            res.redirect("/admin/users?err=" + encodeURIComponent("找不到帳號"));
            return;
        }
        users[ix].passwordHash = hashAdminPassword(newPwd);
        await saveAdminUsers(users);
        try {
            await logDataChange(req, {
                entityType: "admin_user",
                entityId: target,
                action: "reset_password",
                summary: `重設帳號 ${target} 的密碼`,
            });
        } catch (_) {}
        res.redirect("/admin/users?ok=" + encodeURIComponent("已重設密碼"));
    });
    router.post("/users/delete", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const delName = (req.body.username || "").trim();
        if (isAdminOwnerUsername(delName)) {
            res.redirect("/admin/users?err=owner");
            return;
        }
        const users = await loadAdminUsers();
        if (users.length <= 1) {
            res.redirect("/admin/users?err=last");
            return;
        }
        const removed = users.find((x) => x.username === delName);
        const next = users.filter((x) => x.username !== delName);
        if (next.length === users.length) {
            res.redirect("/admin/users");
            return;
        }
        await saveAdminUsers(next);
        try { await logDataChange(req, { entityType: "admin_user", entityId: delName, action: "delete", summary: `刪除帳號 ${delName}`, meta: { before: removed ? { username: removed.username, name: removed.name, title: removed.title, status: removed.status } : null, after: null } }); } catch (_) {}
        res.redirect("/admin/users?ok=del");
    });
    router.post("/users/line-bind-link", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const username = String(req.body?.username || "").trim();
        if (!username) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const users = await loadAdminUsers();
        if (!users.find(u => u.username === username)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const liffId = (process.env.LIFF_ID_EMPLOYEE_BIND || "").trim();
        if (!liffId) {
            res.redirect("/admin/users?err=" + encodeURIComponent("尚未設定 LIFF_ID_EMPLOYEE_BIND"));
            return;
        }
        try {
            const out = await (0, liff_bind_token_js_1.issueLiffBindToken)(db, username);
            // LIFF 永久短網址：https://liff.line.me/<liffId>?t=<token>
            const link = `https://liff.line.me/${encodeURIComponent(liffId)}?t=${encodeURIComponent(out.token)}`;
            await logDataChange(req, {
                entityType: "employee_line_binding",
                entityId: username,
                action: "generate_liff_link",
                summary: `為員工 ${username} 產生 LIFF 綁定連結（30 分鐘有效）`,
            });
            res.redirect(`/admin/users?bind_link=${encodeURIComponent(link)}&bind_user=${encodeURIComponent(username)}`);
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "綁定連結產生失敗"));
        }
    });
    router.post("/users/line-bind-code", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const username = String(req.body?.username || "").trim();
        if (!username) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const users = await loadAdminUsers();
        if (!users.find(u => u.username === username)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        try {
            const out = await (0, employee_line_binding_js_1.generateBindCode)(db, username);
            await logDataChange(req, {
                entityType: "employee_line_binding",
                entityId: username,
                action: "generate_code",
                summary: `為員工 ${username} 產生 LINE 綁定碼（10 分鐘有效）`,
            });
            res.redirect(`/admin/users?bind_code=${encodeURIComponent(out.code)}&bind_user=${encodeURIComponent(username)}`);
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "綁定碼產生失敗"));
        }
    });
    router.post("/users/line-unbind", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const username = String(req.body?.username || "").trim();
        if (!username) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        try {
            const changed = await (0, employee_line_binding_js_1.unbindLineUserIdFromEmployee)(db, username);
            if (changed) {
                await logDataChange(req, {
                    entityType: "employee_line_binding",
                    entityId: username,
                    action: "unbind",
                    summary: `解除員工 ${username} 的 LINE 綁定`,
                });
            }
            res.redirect("/admin/users?ok=status");
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "解綁失敗"));
        }
    });
    // 從「群組發言成員」名單直接把某 LINE 發言者標記為同事（免綁定碼／LIFF，沿用同一套綁定儲存）
    router.post("/users/bind-line-from-speaker", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const username = String(req.body?.username || "").trim();
        const lineUserId = String(req.body?.line_user_id || "").trim();
        const displayName = String(req.body?.display_name || "").trim() || null;
        if (!username || !lineUserId) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        const users = await loadAdminUsers();
        if (!users.find(u => u.username === username)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        try {
            await (0, employee_line_binding_js_1.bindLineUserIdToEmployee)(db, username, lineUserId, displayName);
            await logDataChange(req, {
                entityType: "employee_line_binding",
                entityId: username,
                action: "bind_from_speaker",
                summary: `從群組發言名單將 ${displayName || lineUserId.slice(0, 8) + "…"} 標記為同事（帳號 ${username}）`,
            });
            res.redirect("/admin/users?ok=status");
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "標記失敗"));
        }
    });
    // 發言者「非公司人員」排除／恢復：判定過的人移出主名單，避免名單被客戶塞滿
    router.post("/users/speaker-visibility", express_1.default.urlencoded({ extended: true }), requireManager, async (req, res) => {
        const lineUserId = String(req.body?.line_user_id || "").trim();
        const visibility = String(req.body?.visibility || "").trim();
        if (!lineUserId || !["dismiss", "restore"].includes(visibility)) {
            res.redirect("/admin/users?err=forbidden");
            return;
        }
        try {
            await line_conversation_js_1.setSpeakerDismissed(db, lineUserId, visibility === "dismiss");
            await logDataChange(req, {
                entityType: "line_group_speaker",
                entityId: lineUserId.slice(0, 12),
                action: visibility === "dismiss" ? "speaker_dismiss" : "speaker_restore",
                summary: visibility === "dismiss" ? "發言者標記為非公司人員（移出名單）" : "發言者恢復到待判定名單",
            });
            res.redirect("/admin/users?ok=status");
        } catch (e) {
            res.redirect("/admin/users?err=" + encodeURIComponent(e?.message || "操作失敗"));
        }
    });
}
