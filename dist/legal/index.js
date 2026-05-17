"use strict";
/**
 * 隱私權政策 + 服務條款（公開可存取，供 LINE Console publish channel 使用）。
 *
 * 路由：
 *   GET /privacy   隱私權政策
 *   GET /terms     服務條款
 *
 * 可由環境變數覆寫顯示內容：
 *   LEGAL_COMPANY_NAME      公司名稱（預設「松富物流」）
 *   LEGAL_CONTACT_EMAIL     聯絡 email（預設「s946185@gmail.com」）
 *   LEGAL_CONTACT_PHONE     聯絡電話（選填）
 *   LEGAL_ADDRESS           公司地址（選填）
 *   LEGAL_LAST_UPDATED      最後更新日期（預設今日台北日期）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLegalRouter = createLegalRouter;

const express_1 = require("express");

function info() {
    return {
        company: (process.env.LEGAL_COMPANY_NAME || "松富物流").trim(),
        email: (process.env.LEGAL_CONTACT_EMAIL || "s946185@gmail.com").trim(),
        phone: (process.env.LEGAL_CONTACT_PHONE || "").trim(),
        address: (process.env.LEGAL_ADDRESS || "").trim(),
        updated: (process.env.LEGAL_LAST_UPDATED || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date())).trim(),
    };
}

function shell(title, contentHtml) {
    const i = info();
    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · ${i.company}</title>
<style>
  body { font-family: ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif; max-width:760px; margin:0 auto; padding:32px 22px 64px; line-height:1.75; color:#262626; background:#fff; }
  h1 { font-size:24px; border-bottom:2px solid #1d4ed8; padding-bottom:10px; margin-bottom:6px; }
  h2 { font-size:17px; margin-top:30px; color:#1d4ed8; }
  .meta { color:#787774; font-size:13px; margin-bottom:24px; }
  ul { padding-left:20px; }
  li { margin:6px 0; }
  code { background:#f3f3f3; padding:1px 6px; border-radius:3px; font-size:13px; }
  .contact { background:#f7f6f3; border-left:3px solid #1d4ed8; padding:14px 18px; margin:24px 0; border-radius:4px; }
  .nav { margin-top:40px; padding-top:20px; border-top:1px solid #e3e2e0; font-size:13px; color:#787774; }
  .nav a { color:#1d4ed8; text-decoration:none; margin-right:14px; }
  .nav a:hover { text-decoration:underline; }
</style>
</head>
<body>
${contentHtml}
<div class="nav">
  <a href="/privacy">隱私權政策</a>
  <a href="/terms">服務條款</a>
  <span>© ${new Date().getFullYear()} ${i.company}</span>
</div>
</body>
</html>`;
}

function privacyHtml() {
    const i = info();
    const contactBlock = `
<div class="contact">
  <strong>聯絡我們</strong><br>
  公司名稱：${i.company}<br>
  Email：<a href="mailto:${i.email}">${i.email}</a>
  ${i.phone ? `<br>電話：${i.phone}` : ""}
  ${i.address ? `<br>地址：${i.address}` : ""}
</div>`;
    return shell("隱私權政策", `
<h1>隱私權政策</h1>
<div class="meta">最後更新日期：${i.updated}</div>

<p>${i.company}（以下簡稱「本公司」）非常重視您的個人資料保護。本政策說明我們透過 LINE 官方帳號、LINE Login、LIFF（LINE Front-end Framework）所提供之服務（以下合稱「本服務」）會蒐集、處理及利用何種個人資料，以及您享有之權利。</p>

<h2>1. 服務性質</h2>
<p>本服務主要供 ${i.company} 與其客戶、員工進行訂單、物流、HACCP 食品安全管理相關之溝通與作業，並非對外公開招攬之服務。</p>

<h2>2. 蒐集之資料</h2>
<ul>
  <li><strong>LINE 使用者識別資料</strong>：透過 LINE Login 與 LIFF 取得的 LINE 使用者 ID（userId）、顯示名稱（displayName）、大頭照（pictureUrl）。</li>
  <li><strong>訊息內容</strong>：您透過 LINE 與本服務官方帳號互動所傳送之文字、圖片、檔案等訊息內容。</li>
  <li><strong>訂單與業務資料</strong>：客戶名稱、訂單明細、品項、數量、送貨日、簽核紀錄。</li>
  <li><strong>系統日誌</strong>：訪問時間、IP 位址、操作軌跡（稽核用）。</li>
</ul>

<h2>3. 蒐集目的</h2>
<ul>
  <li>身份識別：辨識傳訊者為員工或客戶，提供正確之服務介面。</li>
  <li>訂單處理：解析、儲存、確認您透過 LINE 傳送的叫貨資料。</li>
  <li>HACCP 法規遵循：留存符合食品安全管制系統準則所需之作業紀錄。</li>
  <li>系統稽核：記錄資料變動軌跡以利異常排查。</li>
</ul>

<h2>4. 資料儲存與安全</h2>
<ul>
  <li>所有資料儲存於 Google Cloud Platform / Supabase 位於亞洲區之資料中心。</li>
  <li>傳輸過程使用 TLS 加密。</li>
  <li>後台存取需經帳號密碼驗證，並依職稱分權限。</li>
</ul>

<h2>5. 資料保留期限</h2>
<ul>
  <li>訂單與業務資料：依食品業者相關法規保留至少 5 年。</li>
  <li>LINE 訊息原始檔（圖片、語音）：最長保留 1 年，逾期自動清除。</li>
  <li>LINE 識別資料：於您解除綁定後保留 30 日以利稽核，其後刪除。</li>
</ul>

<h2>6. 第三方分享</h2>
<ul>
  <li>本公司<strong>不會</strong>將您的個人資料販售、出租或交換給第三方。</li>
  <li>處理過程中使用之服務提供者：Google Cloud（運算）、Supabase（資料庫）、LY Corporation（LINE 平台）、Google Gemini（人工智慧辨識）。</li>
</ul>

<h2>7. 您的權利</h2>
<p>依個人資料保護法，您可向本公司申請：查詢、閱覽、製給複本、補充更正、停止蒐集處理利用、刪除您的個人資料。請以下列方式聯絡我們處理。</p>

<h2>8. Cookie 與類似技術</h2>
<p>本服務之後台管理介面使用 Cookie 維持登入狀態；LIFF 頁面不使用 Cookie 追蹤，僅於使用者主動操作時呼叫 LINE 平台 API。</p>

<h2>9. 政策更新</h2>
<p>本政策可能因法規或業務需要而修訂，修訂後將於本頁公告。建議您定期檢視。</p>

${contactBlock}
`);
}

function termsHtml() {
    const i = info();
    const contactBlock = `
<div class="contact">
  <strong>聯絡我們</strong><br>
  公司名稱：${i.company}<br>
  Email：<a href="mailto:${i.email}">${i.email}</a>
  ${i.phone ? `<br>電話：${i.phone}` : ""}
</div>`;
    return shell("服務條款", `
<h1>服務條款</h1>
<div class="meta">最後更新日期：${i.updated}</div>

<p>歡迎使用 ${i.company}（以下簡稱「本公司」）提供之 LINE 官方帳號及 LIFF 應用程式服務（以下合稱「本服務」）。使用本服務前，請詳閱本條款。當您開始使用本服務時，即視為已閱讀、瞭解並同意接受本條款全部內容。</p>

<h2>1. 服務內容</h2>
<p>本服務提供 ${i.company} 與其客戶、員工間訂單管理、物流溝通、HACCP 食品安全作業紀錄等功能。本服務僅供與本公司有業務往來之人員使用。</p>

<h2>2. 使用者責任</h2>
<ul>
  <li>使用本服務時，應遵守中華民國法律與善良風俗。</li>
  <li>不得利用本服務進行任何違法、騷擾、詐欺或侵害他人權益之行為。</li>
  <li>不得嘗試對本服務進行未經授權之存取、攻擊或破壞。</li>
  <li>透過本服務傳送之訊息內容，應為真實、準確；錯誤資料造成之損失由使用者自負。</li>
</ul>

<h2>3. 帳號與綁定</h2>
<ul>
  <li>員工身份需透過後台產生之綁定連結進行 LINE 帳號對應，綁定後該 LINE 帳號代表該員工身份。</li>
  <li>請妥善保管您的 LINE 帳號，因帳號遭他人使用所衍生之責任由您自負。</li>
  <li>如員工離職或角色變更，本公司有權解除其 LINE 綁定。</li>
</ul>

<h2>4. 智慧財產權</h2>
<p>本服務之軟體、介面、文件等智慧財產權，除另有標示外，均屬本公司或合法授權者所有。未經書面同意，不得重製、修改、散布。</p>

<h2>5. 服務變更與中斷</h2>
<ul>
  <li>本公司保留隨時修改、暫停或終止本服務全部或部分功能之權利，無須事先通知。</li>
  <li>因不可抗力（停電、網路中斷、第三方服務故障等）導致服務中斷時，本公司不負損害賠償責任。</li>
</ul>

<h2>6. 免責聲明</h2>
<ul>
  <li>本服務透過人工智慧（Gemini）辨識訊息與圖片，辨識結果可能存在誤差，最終訂單需經員工人工確認。</li>
  <li>本公司對辨識誤差所致之直接或間接損失，於法律允許之最大範圍內不負賠償責任。</li>
</ul>

<h2>7. 隱私權</h2>
<p>您的個人資料處理依本公司<a href="/privacy">隱私權政策</a>辦理。</p>

<h2>8. 條款修訂</h2>
<p>本公司得隨時修訂本條款，修訂後將於本頁公告。若您於修訂後繼續使用本服務，視為同意修訂後之條款。</p>

<h2>9. 準據法與管轄</h2>
<p>本條款之解釋與適用，以中華民國法律為準據法。因本條款所生之爭議，雙方同意以臺灣臺北地方法院為第一審管轄法院。</p>

${contactBlock}
`);
}

function createLegalRouter() {
    const router = express_1.Router();
    router.get("/privacy", (_req, res) => {
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.type("text/html").send(privacyHtml());
    });
    router.get("/terms", (_req, res) => {
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.type("text/html").send(termsHtml());
    });
    return router;
}
