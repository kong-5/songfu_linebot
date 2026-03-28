# SongFu LINE 叫貨／後台系統 — 全貌說明（供 Gemini 參考）

> **專案路徑**：`songfu_linebot`  
> **執行入口**：`node dist/index.js`（`package.json` 之 `start`）  
> **語言**：後端以編譯後 **JavaScript** 為準（`dist/`），開發可用 `tsx` 對應 `src/`（若存在）。

本文濃縮架構、資料流、訂單解析與環境依賴，方便一次性餵給 Gemini 做問答、改程式或除錯。

---

## 1. 系統定位

- **LINE 官方帳號**：客戶在綁定之 **LINE 群組**內傳 **文字叫貨**或 **圖片（手寫／拍照）叫貨**。
- **後台**：`/admin` 網頁管理客戶、品項、訂單明細、匯出、重新辨識、審核等。
- **核心價值**：將非結構化叫貨（文字／圖）解析為 **品名、數量、單位、備註**，並盡量對應到 **標準品項（`products`）**；必要時標 **待確認（`need_review`）**。

---

## 2. 技術棧

| 項目 | 說明 |
|------|------|
| 執行環境 | Node.js ≥ 20 |
| Web | Express 4 |
| 資料庫 | **SQLite**（本機 `DB_PATH`）或 **PostgreSQL**（`DATABASE_URL`，如 Supabase） |
| LINE | `@line/bot-sdk`，Webhook 路徑預設 `LINE_WEBHOOK_PATH`（預設 `/webhook`） |
| 圖片 OCR | Google Cloud Vision（`GOOGLE_CLOUD_VISION_API_KEY`） |
| 訂單／圖像 AI | Google Gemini API（`GOOGLE_GEMINI_API_KEY` 或 `GEMINI_API_KEY`） |
| 其他 | `multer` 上傳、`xlsx` 匯出、`bwip-js` 條碼 |

---

## 3. 程式入口與路由

| 路徑 | 用途 |
|------|------|
| `GET /health` | 健康檢查；DB 未就緒回 503 |
| `POST {LINE_WEBHOOK_PATH}` | LINE Webhook（預設 `/webhook`） |
| `GET /` | 302 導向 `/admin` |
| `/*` 掛在 `/admin` | 後台（見 `dist/admin/index.js`） |

實際掛載見 `dist/index.js`。

---

## 4. 目錄與模組職責（`dist/`）

| 路徑 | 職責 |
|------|------|
| `dist/index.js` | Express 啟動、掛載 webhook、admin |
| `dist/webhook/line.js` | LINE 事件：收單時段、群組綁客戶、文字／圖片叫貨、附件儲存、與訂單寫入 |
| `dist/admin/index.js` | 後台頁面與 API（訂單、品項、客戶、物流、備份等） |
| `dist/db/index.js` | DB 初始化、SQLite／PG 抽象 |
| `dist/db/schema.sql` | SQLite 結構定義（單一真相來源之一） |
| `dist/lib/parse-order-message.js` | **規則解析**純文字叫貨（斤、k、多筆、括號進備註等） |
| `dist/lib/parse-order-from-image.js` | **圖片**：OCR → 規則 → Gemini 文字 → **Gemini 視覺**（筆數比對） |
| `dist/lib/gemini-order-helpers.js` | **@google/generative-ai** SDK：文字／單圖／Few-Shot 視覺，結構化 JSON（`responseMimeType` + `responseSchema`） |
| `dist/lib/few-shot-example-save.js` | 後台手動將訂單附件存成 Few-Shot 範例（檔案落 `data/few-shot-examples`） |
| `dist/lib/vision-ocr.js` | Cloud Vision 取圖文字 |
| `dist/lib/resolve-product.js` | 俗名／客戶別名／筆跡對照／模糊／Gemini 對應品項 |
| `dist/lib/rebuild-order-from-sources.js` | 依 `raw_message` + 附件圖 **重新解析整單**（與後台「重新辨識」同邏輯） |
| `dist/lib/customer-handwriting-hints.js` | **客戶筆跡對照表**：人工核定後累積，供提示與 resolve |
| `dist/lib/order-parsed-heuristics.js` | 過濾 OCR 雜訊、離譜數量等 |
| `dist/lib/unit-conversion.js` | 斤→公斤等換算與備註 |
| `dist/lib/line-bot-control.js` | 收單時段、模式等 |
| `dist/lib/wholesale-price.js` / `wholesale-snapshot.js` | 農業部／北農行情相關 |

---

## 5. 核心資料模型（摘要）

- **`customers`**：客戶；`line_group_id` 與 LINE 群組綁定；`default_unit` 預設單位。
- **`products`**：標準品項；`erp_code`、`teraoka_barcode`、`unit`。
- **`orders`**：訂單；`customer_id`、`order_date`、`raw_message`（含文字與 `[圖片]` 占位）、`status`（如 `approved`）、匯出時間欄位。
- **`order_items`**：明細；`raw_name`（解析出的叫貨原文）、`product_id`、`quantity`、`unit`、`remark`、`need_review`、`display_order`、`include_export`。
- **`order_attachments`**：訂單附圖之 LINE `line_message_id`（用於向 LINE 取回圖片二進位）。
- **`product_aliases`**：全公司俗名 → 品項。
- **`customer_product_aliases`**：客戶專用別名 → 品項（後台選品時會寫入）。
- **`customer_handwriting_hints`**：**客戶 × 正規化 raw_key → product_id**，`hit_count` 累計；供 Gemini 提示與 `resolve` 優先對應。
- **`customer_order_image_examples`**：**Few-Shot 視覺範例**；僅存 **`image_path`（檔案路徑或 URL）**，不存 BLOB；`parsed_json` 為核定明細（`{ "items": [...] }`）；由後台 **手動** 從訂單轉存。
- **`app_settings`**：鍵值設定（如 LINE 靜音、報價規則 JSON 等）。
- 其餘：`wholesale_market_snapshots`、`data_change_log`、`line_bot_state_log`、盤點／物流／冷凍庫等表（見 `schema.sql`）。

---

## 6. 叫貨解析流程（文字 + 圖片）

### 6.1 純文字

1. `parse-order-message.js`：`parseOrderMessage(text, fallbackUnit)`  
   - 支援多行、逗號／空白分段、斤／k／kg、括號註記進 **備註**、品名內品質詞彙移備註等。
2. 若規則無結果且設有 Gemini key，可改走 **Gemini 文字**（`gemini-order-helpers.js`）。
3. 每筆再經 **`resolve-product.js`** 對應 `products`；對不到則 `need_review = 1`。

### 6.2 圖片（`parse-order-from-image.js`）

1. 若有 **Vision API**：OCR 出文字。
2. 可選版型前處理（`order-form-templates.js`）。
3. 對 OCR 文字做 **規則解析**。
4. 若 OCR 行數多但規則筆數極少等，改／補 **Gemini 文字**。
5. 若有 **Gemini key**：**一律再跑 Gemini 視覺**，若圖上筆數多於前面結果則採用視覺結果（避免手寫漏列）。
6. **客戶筆跡對照**：若該客戶已有 `customer_handwriting_hints`，會組成 **extraPromptSuffix** 餵給 Gemini（文字與視覺）。

### 6.3 整單重建（`rebuild-order-from-sources.js`）

- 文字（略過僅 `[圖片]` 行）+ 附件逐張向 LINE 取圖解析，合併為一個 parsed 陣列後寫入明細（與後台「重新辨識」一致）。

---

## 7. 品項對應（`resolve-product.js`）

優先順序概念（實作以程式為準）：

1. 客戶別名 `customer_product_aliases`（精確匹配候選）。
2. **`customer_handwriting_hints`**（依正規化 key，命中次數高者優先）。
3. 全公司 `product_aliases`、品名完全相等。
4. 保守模糊。
5. 仍無則可 **Gemini 小模型**從候選品項中選 id（`gemini-chat.js`）。

---

## 8. 筆跡／辨識學習資料庫（`customer_handwriting_hints`）

- **寫入時機**：後台 **儲存明細**、**單筆選定品項**後，將該筆 `raw_name` + 核定 `product_id` 寫入／累加 `hit_count`。
- **使用時機**：同客戶之後訂單解析時，Gemini 提示與 resolve 優先使用。

---

## 9. LINE 端行為（略述）

- 群組需能對應到 **一個客戶**（`line_group_id`）。
- 收單時段內處理圖片：下載圖片 → 解析 → 寫入訂單／附件；可能有多則合併與逾時結單邏輯（見 `line.js`）。
- 細節可參考 `docs/LINE機器人-啟動與排程.md` 等。

---

## 10. 後台（`/admin`）摘要

- 訂單列表、訂單明細、匯出（凌越、訂貨單、預覽）、審核、**重新辨識**、明細編輯、品項選擇、客戶／品項維護。
- 部分 API 回傳 JSON（如 `X-Requested-With: XMLHttpRequest`）。

---

## 11. 環境變數（務必區分機密）

| 變數 | 用途 |
|------|------|
| `PORT` | 服務埠（預設 4000） |
| `DATABASE_URL` | 若設定則用 PostgreSQL；否則 SQLite + `DB_PATH` |
| `DB_PATH` | SQLite 檔路徑（預設 `./data/songfu.db`） |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE Bot |
| `LINE_WEBHOOK_PATH` | Webhook 路徑（預設 `/webhook`） |
| `GOOGLE_CLOUD_VISION_API_KEY` | 圖片 OCR |
| `GOOGLE_GEMINI_API_KEY` 或 `GEMINI_API_KEY` | Gemini |
| `GEMINI_MODEL` / `GEMINI_MODEL_FALLBACKS` | 模型與後援 |
| `USE_GEMINI_VISION_ONLY` | 設為 `true` 時走「純 Gemini 視覺」路徑（與 `parse-order-from-image` 灰度開關；未接線時可忽略） |
| `FEW_SHOT_IMAGE_DIR` | Few-Shot 範例圖檔目錄（預設 `data/few-shot-examples`） |

### 後台 API：儲存 Few-Shot 範例

- **`POST /admin/orders/:orderId/few-shot-example`**
- **Body**（JSON 或表單）：`attachment_id`（必填，`order_attachments.id`）、`quality_score`（選填，預設 1）、`note`（選填）
- 成功時下載 LINE 附件寫入 `FEW_SHOT_IMAGE_DIR`，並插入 `customer_order_image_examples`。

完整範本見專案內 **`.env.example`**、**`.env.ai.template`**。

---

## 12. 既有文件索引（`docs/`）

本目錄另有專題文件，與本全貌說明互補：

- `LINE機器人-啟動與排程.md`
- `照片辨識設定.md`
- `LINE叫貨-單位換算規則.md`
- `台北批發行情-金額帶入.md`
- `推Git就部署-設定.md`、`Cloud-Run-啟動失敗-排查.md`、`資料長期保留-必讀.md`
- 遷移：`遷移-Supabase.md`、`遷移-CloudSQL-全量至Supabase.md` 等

---

## 13. 給 Gemini 的使用建議

- 修改行為時以 **`dist/` 實際程式**為準；若存檔與 `src/` 不同步，需確認是否重新編譯。
- 訂單相關邏輯常跨 **解析 → 對應品項 → 單位換算 → 寫庫**，改動請一併檢查。
- 生產環境資料庫多為 **PostgreSQL**；本機可能為 **SQLite**，SQL 方言略差（如 `datetime('now')`）。

---

*文件產生自專案結構與程式；若與程式不一致，以程式碼為準。*
