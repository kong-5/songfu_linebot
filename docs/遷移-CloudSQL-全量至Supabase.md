# Cloud SQL → Supabase 全量資料遷移（零遺失流程）

適用：產品、客戶、訂單、盤點、物流、冷凍庫等 **所有** `schema.pg.sql` 內表格。

---

## 一、LINE「收單」沒回應 — 先排除這些（與資料庫無關也常發生）

| 檢查 | 說明 |
|------|------|
| **群組** | 收單僅在 **LINE 群組／多人聊天室** 有效，**一對一聊天不會進入收單**。 |
| **客戶綁定** | 該群組必須在後台「客戶管理」綁定 **LINE 群組 ID**（群內可傳「取得群組ID」複製貼上）。 |
| **Webhook** | [LINE Developers](https://developers.line.biz/) → Channel → **Messaging API** → Webhook URL = `https://你的CloudRun網址/webhook`，**Use webhook = Enabled**。 |
| **機器人是否收單** | 後台 **LINE 機器人** 頁：勿選「一律關閉」；測試請選「一律開啟」或確認在排程時段內。 |
| **環境變數** | Cloud Run 须有 `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`（部署腳本會從本機 `.env` 合併）。 |

遷移後若 **Supabase 沒有客戶／app_settings**，也會影響行為；全量匯入後應與舊庫一致。

---

## 二、遷移原則（避免資料遺失）

1. **先備份**：匯出檔保留在**本機安全處**（`pg_dump` 產生的 `.sql`）。  
2. **目標庫表已存在**：Supabase 須已跑過 `schema.pg.sql`（首次部署成功時會建表，或 SQL Editor 執行一次）。  
3. **僅匯「資料」**：用 `--data-only`，避免覆寫結構；外鍵順序由 `pg_dump` 處理。  
4. **匯入前可清空目標**（僅在**確定要覆寫**空測試庫時）：若 Supabase 已有測試髒資料，請先與技術人員確認是否 `TRUNCATE ... CASCADE`（**會刪光**）。正式建議：**新專案空庫 → 匯入** 或 **先備份 Supabase 再操作**。  
5. **匯入後驗證**：用 `scripts/verify-table-counts.sh` 比對**來源與目標**各表筆數。

---

## 三、取得連線字串

### SOURCE（Cloud SQL）

本機須能連到 Postgres（公開 IP + 授權網路，或 **Cloud SQL Auth Proxy**）。

範例：

```bash
export SOURCE='postgresql://postgres:CloudSQL密碼@PUBLIC_IP:5432/songfu'
```

### TARGET（Supabase Transaction Pooler）

**必須**與目前後台可用之 `DATABASE_URL` 相同格式（程式已驗證可用）：

```text
postgresql://postgres:密碼@db.<專案ref>.supabase.co:6543/postgres?sslmode=require
```

勿使用 Session pooler 的 `postgres.xxx@aws-0-...:5432` 混進 Transaction 埠。

---

## 四、執行遷移

```bash
cd songfu_linebot

# 1) 可選：先記錄來源筆數
export SOURCE='postgresql://...'
./scripts/verify-table-counts.sh "$SOURCE"

# 2) 匯出 + 匯入
export SOURCE='postgresql://...'
export TARGET='postgresql://postgres:...@db.xxx.supabase.co:6543/postgres?sslmode=require'
./scripts/migrate-cloudsql-to-supabase.sh

# 3) 驗證目標筆數
export DATABASE_URL="$TARGET"
./scripts/verify-table-counts.sh "$TARGET"
```

比對 **各表 `n_live_tup` 或 COUNT(*)** 與來源是否一致（允許 `line_bot_state_log` 等極小差異若你有在匯入後測試）。

---

## 五、切換與驗證

1. Cloud Run **已**使用 Supabase `DATABASE_URL`（你目前 `dbReady: true` 即已連線）。  
2. 匯入後：開 **後台**、**LINE 收單**、**盤點** 抽樣檢查。  
3. 確認無誤後再關 Cloud SQL（見下節）。

---

## 六、停用／刪除 Google Cloud SQL（省錢）

**建議順序**

1. **最終備份**（可選）：Cloud SQL → 匯出至 GCS，或再跑一次 `pg_dump` 存檔。  
2. **刪除執行個體**（停止計費）：GCP Console → **SQL** → 執行個體 → **刪除**。  
   - 若介面有「**停止**」僅限部分方案；多數情況 **刪除** 才不再計費。  
3. 確認 **沒有其他服務**（舊 Cloud Run、本機腳本）仍指向該 Cloud SQL。

---

## 七、疑難排解

| 現象 | 處理 |
|------|------|
| `psql` 匯入 FK 錯誤 | 確認目標表已建、匯入檔為同一版本 schema；必要時分段匯入並查錯誤那筆。 |
| 筆數不一致 | 查來源是否有部分 schema 不在 `schema.pg.sql`；或匯入中斷，重跑前清空目標表（謹慎）。 |
| LINE 仍異常 | 依「第一節」檢查；與 DB 遷移分開排查。 |
