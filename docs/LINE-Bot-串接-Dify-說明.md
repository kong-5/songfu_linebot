# LINE Bot 串接 Dify 說明

本文回答三件事：**現有 LINE Bot 能否直接串 Dify？**、**串 Dify 是不是更好的選擇？**、**會不會導致訊息量爆表（客戶＋內部都在用）？**

---

## 一、可以直接串接 Dify 嗎？可以

現有架構是：LINE 把訊息推到你們的 **Webhook**（`dist/webhook/line.js`），同一支程式依關鍵字與情境處理「收單、今日訂單、結束收單、品項解析」等。  
要接 Dify，只要在**同一支 Webhook** 裡多加一段邏輯即可，不必換一個 Bot：

1. **在「不屬於收單流程」的訊息**上，依條件判斷要不要轉給 Dify。
2. 用 **Dify Chat API**（或 Workflow API）把使用者文字送過去，取得回覆。
3. 把 Dify 回傳的內容用現有的 `reply()` 回給 LINE。

技術上就是：在 `line.js` 裡對「文字訊息」在**既有的收單／訂單邏輯之後**，若符合「走 AI」的條件，就呼叫 Dify API，再 `reply` 回傳結果。  
Dify 端需在後台建立一個 **Chat 應用**（或 Workflow），取得 **API Key** 與 **API 網址**（例如 `https://api.dify.ai/v1/chat-messages`），即可從 Node 用 `fetch` 呼叫。

---

## 二、串 Dify 是不是更好的選擇？是「互補」而不是取代

- **收單、訂單、品項、今日叫貨、結束收單**：維持現有邏輯，**不要**送進 Dify。  
  這些是結構化流程，你們已經用 `parse_order_message`、DB 寫入處理得很好，用 Dify 反而慢、貴、且容易出錯。

- **Dify 適合做的事**（建議只做這些）：
  - 用自然語言回答：請假怎麼辦、要填哪張表、SOP、常見問題。
  - 從知識庫（RAG）查表單說明、處理方式，再回一段話或連結。
  - 內部同仁在 LINE 問「某校請假怎麼處理」時，由 Dify 回建議方案。

也就是說：**現有 Bot = 收單／訂單；Dify = 問答／請假建議／表單查詢**。兩者並存、依「訊息類型」分流，是較好的選擇。

---

## 三、會不會導致訊息量爆表？不會，只要「不要每則都進 Dify」

你們情境是：**客戶（學校／物流）** 和 **內部** 都用同一個 LINE Bot。若每一則訊息都呼叫 Dify，會造成：

- **API 呼叫量與成本** 暴增（Dify / LLM 按 token 或請求計費）。
- **延遲**：收單時每則品項都等 AI 回覆，體感變慢。
- **混亂**：客戶在收單時打「高麗菜 5 公斤」，不該被當成「問答」送進 Dify。

因此要**嚴格限制**：只有「明確要問問題」或「僅限內部」的訊息才進 Dify。

### 建議做法（三層把關）

| 層級 | 做法 | 說明 |
|------|------|------|
| **1. 觸發條件** | 僅在**關鍵字**或**僅內部**時才呼叫 Dify | 例如：開頭是「問」「請假」「怎麼辦」「表單」才進 Dify；或規定只有「內部群組／1 對 1」才進 Dify。 |
| **2. 對象區分** | 客戶群組 = 只做收單＋少數 FAQ 關鍵字；內部 = 可放寬 | 客戶綁定群組（現有 `line_group_id`）：預設不進 Dify，或只對「問」「請假」等少數詞進 Dify。內部可用 1 對 1 或專用群組，放寬為「未符合收單的純文字就問 Dify」。 |
| **3. 限流** | 同一人／同一群組每分鐘最多 N 次 Dify 請求 | 例如每 userId 或 groupId 每分鐘最多 5 次，超過就回「請稍後再試」，避免有人狂問把額度用完。 |

這樣可以**大幅縮小**進 Dify 的訊息量，只把「真的在問問題」或「內部使用」的請求送給 Dify，客戶日常收單完全不受影響，也不會爆量。

---

## 四、實作要點（接在現有 line.js 裡）

### 4.1 何時觸發 Dify（建議可設成後台參數）

- 從 `app_settings` 讀取（若沒有就用預設）：
  - `line_dify_trigger_keywords`：例如 `問\n請假\n怎麼辦\n表單`，只有訊息**開頭**或**包含**這些詞才進 Dify。
  - `line_dify_internal_only`：`1` = 僅 `source.type === 'user'`（1 對 1）或「內部群組 ID 白名單」才進 Dify；`0` = 客戶群組在有關鍵字時也可進。
  - （可選）`line_dify_internal_group_ids`：內部群組 ID 列表，逗號分隔。
- 若未設定 `DIFY_API_KEY` 或 Dify 網址，則整段 Dify 邏輯不執行。

### 4.2 插入位置（在 line.js 的「文字訊息」處理裡）

在**已經做過**：

- 取得群組 ID、綁定客戶、收單開始／結束、今日訂單、**且不在收單模式**的「其他文字」

之後、在「未在收單模式：若內容像叫貨…回覆一句提示，否則不回覆」這一段（約 359–367 行）**之前**，加一層判斷：

1. 若 `line_dify_internal_only === '1'`：僅當 `sourceType === 'user'` 或 `groupId` 在內部白名單內才繼續。
2. 若有關鍵字表：檢查 `text` 是否包含任一關鍵字（或開頭為關鍵字）。
3. 限流：依 `event.source.userId` 或 `groupId` 檢查最近 1 分鐘內是否已呼叫 Dify 超過 N 次（可用記憶體 Map 或 DB 計數）。
4. 呼叫 Dify Chat API（見下），取得回覆文字後 `reply(lineClient, event.replyToken, replyText, db)`。
5. 若 Dify 逾時或失敗，回傳固定文案例如「請稍後再試」。
6. 處理完就 `continue`，不再往下走到「看起來像叫貨」的提示。

這樣：

- **客戶群組**：照舊收單、今日訂單、結束收單；只有打到「問」「請假」等才進 Dify，且可再搭配限流。
- **內部 1 對 1 或內部群**：可設成「未符合收單的純文字就問 Dify」，或同樣用關鍵字，視你們需求放寬。

### 4.3 Dify Chat API 呼叫範例

Dify 的 Chat 應用會提供：

- **API Key**（Bearer）
- **API 網址**（例如 `https://api.dify.ai/v1/chat-messages`）

請求體需包含 `inputs`、`query`、`user`、`response_mode` 等（依 Dify 文件）。多輪對話可帶 `conversation_id`（依 `userId` 或 `userId_groupId` 在你們後端維護對應關係）。  
以下為精簡範例（實際欄位請對照你們 Dify 後台文件）：

```javascript
// 在 line.js 頂部或 require 的 lib 裡
async function chatWithDify(userId, groupId, text, conversationId) {
  const apiKey = process.env.DIFY_API_KEY;
  const apiUrl = process.env.DIFY_CHAT_URL || "https://api.dify.ai/v1/chat-messages";
  if (!apiKey || !apiUrl) return null;
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: {},
      query: text,
      user: userId || groupId || "line-user",
      response_mode: "blocking",
      conversation_id: conversationId || undefined,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.answer || data.message?.content || null;
}
```

- `conversation_id` 可依 `userId`（或 `groupId`）存在你們 DB 或記憶體，讓同一人／同一群多輪對話連續。
- 回傳若為 `null`（逾時、失敗），就不要再呼叫 Dify，直接回「請稍後再試」。

---

## 五、總結

| 問題 | 答案 |
|------|------|
| 現有 LINE Bot 可以直接串 Dify 嗎？ | **可以**。在同一支 Webhook 裡，對「文字訊息」在收單邏輯之外加一段「符合條件 → 呼叫 Dify → reply」。 |
| 串 Dify 是不是更好的選擇？ | **是互補**：收單／訂單維持現有邏輯；Dify 只處理「問答、請假建議、表單查詢」等，這樣較好。 |
| 客戶＋內部都用，會不會訊息量爆表？ | **不會**，只要：**(1) 僅關鍵字或僅內部才進 Dify；(2) 客戶群組預設不走 Dify 或只走少數關鍵字；(3) 限流（每分鐘 N 次）**。 |

實作上只要：**觸發條件**＋**對象區分**＋**限流**＋**Dify Chat API 呼叫**，就可以在不大改現有流程的前提下，安全地接上 Dify，又不會讓訊息量爆表。

---

## 六、專案內已提供的模組與環境變數

- **`dist/lib/dify.js`**：已新增 `chatWithDify(userId, groupId, text, conversationId)`，未設定 `DIFY_API_KEY` 時會直接回傳 `null`，不發請求。
- **環境變數**（選填）：
  - `DIFY_API_KEY`：Dify 應用發佈後的 API Key。
  - `DIFY_CHAT_URL`：選填，預設為 `https://api.dify.ai/v1/chat-messages`（自架 Dify 請改為自己的網址）。

在 `dist/webhook/line.js` 中：

1. 在檔案頂部加上：`const dify_js_1 = require("../lib/dify.js");`
2. 在「未在收單模式」且尚未回覆「看起來像叫貨」的那段之前，加上：  
   - 讀取 `app_settings` 的 `line_dify_trigger_keywords`、`line_dify_internal_only`（及可選的 `line_dify_internal_group_ids`）；  
   - 若為 1 對 1 或內部群、或訊息包含關鍵字，再檢查限流（例如同一 userId/groupId 每分鐘最多 5 次，用 `Map` 存時間戳）；  
   - 呼叫 `(0, dify_js_1.chatWithDify)(event.source.userId, groupId, text, conversationId)`，有回傳就 `reply` 並 `continue`，否則回「請稍後再試」或略過。
