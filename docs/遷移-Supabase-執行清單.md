# Supabase 遷移 — 依序執行清單

程式已內建：**Pooler（`*.pooler.supabase.com`）會自動啟用 SSL**（與 Direct `*.supabase.co` 相同）。

---

## ① 本機 `.env`（不要提交 Git）

在 `songfu_linebot/.env` 設定（**Transaction Pooler、埠 6543**）：

```bash
DATABASE_URL=postgresql://postgres.xxxx:你的密碼@aws-0-xxx.pooler.supabase.com:6543/postgres?sslmode=require
```

其餘 `LINE_*`、`GOOGLE_CLOUD_VISION_API_KEY` 等維持不變。

**若曾用 Cloud SQL**：請刪除或註解 `INSTANCE`、`DB_PASS`，避免部署腳本誤判。

---

## ②（選）僅建表、不先部署

二擇一即可，不要重複做：

| 方式 | 說明 |
|------|------|
| **A** | 略過，直接做 ③：服務啟動時會執行 `dist/db/schema.pg.sql` |
| **B** | 本機：`export TARGET='…Pooling URI…'` → `bash scripts/apply-schema-to-supabase.sh` |
| **C** | Supabase **SQL Editor** 貼上 `dist/db/schema.pg.sql` → Run |

---

## ③ 搬運舊資料（若仍在用 Cloud SQL）

僅在有舊資料時需要。

```bash
export SOURCE='postgresql://使用者:密碼@CloudSQL主機:5432/資料庫'
export TARGET='postgresql://…@….pooler.supabase.com:6543/postgres?sslmode=require'
bash scripts/migrate-cloudsql-to-supabase.sh
```

---

## ④ 部署 Cloud Run

專案根目錄為 `songfu_linebot`，需已安裝 Docker、`gcloud` 並登入。

```bash
cd songfu_linebot
bash scripts/deploy-with-cloudsql.sh
```

腳本會讀取 `.env`：有 **`DATABASE_URL`** 時會寫入 Cloud Run **且不**掛 `--add-cloudsql-instances`。

**注意**：若密碼含 `,` 等字元導致 `gcloud --set-env-vars` 失敗，請改在 GCP Console 手動貼上 `DATABASE_URL`，或使用 Secret Manager。

---

## ⑤ 驗證

1. 開後台 `/admin`，確認可登入、資料合理  
2. LINE 傳一則測試  
3. Supabase **Table Editor** 確認寫入  

---

## ⑥ 省錢（確認穩定後）

1. **備份** Cloud SQL（若仍需保留檔案）  
2. GCP **SQL** → 刪除執行個體  

---

## 詳細說明

見同目錄 **`遷移-Supabase.md`**。
