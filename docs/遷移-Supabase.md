# Cloud SQL → Supabase 遷移（松富叫貨後台）

程式已支援 **Supabase** 連線（`DATABASE_URL` + SSL）。請依序執行，**約 30～60 分鐘**（視資料量）。

**快速依序步驟**（精簡版）：見 **`遷移-Supabase-執行清單.md`**。  
**Cloud SQL 全量表資料搬移（含驗證、關 SQL）**：見 **`遷移-CloudSQL-全量至Supabase.md`**。

---

## 一、在 Supabase 建立專案

1. 開啟 [https://supabase.com](https://supabase.com) → 登入 → **New project**
2. 選區域（建議 **Tokyo / Northeast Asia** 延遲較低）
3. 設定資料庫密碼並建立（建立需數分鐘）

---

## 二、取得連線字串（給 Cloud Run 用）

1. Supabase 專案 → **Project Settings**（齒輪）→ **Database**
2. 捲到 **Connection string** → 選 **URI**
3. **務必使用「Connection Pooling」區塊**（**Transaction** 模式，port **6543**），適合 Cloud Run / 短連線  
   - 標籤常為 **「Pooler」** 或 **「Transaction」**，不要誤用 **Session** 若說明寫不支援 serverless。
4. 將字串中的 `[YOUR-PASSWORD]` 換成資料庫密碼  
5. 確認網址含 **`?sslmode=require`**（或程式會自動加 SSL）

範例格式（勿直接複製，以你後台為準）：

```
postgresql://postgres.xxxx:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

---

## 三、建立資料表結構

**擇一即可**（不要重複做兩次）：

### 方法 A：第一次部署時由程式建立

Cloud Run 的 `DATABASE_URL` 設好 Supabase 後重新部署；啟動時會執行 `dist/db/schema.pg.sql`（`CREATE TABLE IF NOT EXISTS`），空資料庫會自動建表。

### 方法 B：在 Supabase SQL Editor 手動執行

1. **SQL Editor** → New query  
2. 貼上專案內 **`dist/db/schema.pg.sql`** 全文 → **Run**

---

## 四、從 Cloud SQL 匯出資料

在**本機**（需已安裝 `postgresql` 客戶端：`pg_dump`、`psql`）或 **Cloud Shell**。

### 4.1 取得 Cloud SQL 連線資訊

- GCP Console → **SQL** → 你的執行個體 → **連線名稱**、**公開 IP**（若有啟用）、帳號密碼  
- 或使用 **Cloud SQL Auth Proxy**（較安全）：

```bash
# 範例：本機開 proxy，另開終端機執行 pg_dump
cloud_sql_proxy -instances=專案:區域:執行個體名稱=tcp:5432
```

連線字串範例（依你實際調整）：

```
postgresql://使用者:密碼@127.0.0.1:5432/資料庫名
```

### 4.2 只匯資料（表已用 schema 建好時建議）

```bash
export SOURCE="postgresql://USER:PASS@HOST:5432/DBNAME"
pg_dump "$SOURCE" \
  --data-only \
  --no-owner \
  --no-privileges \
  --column-inserts \
  -f cloudsql_data.sql
```

### 4.3 或：結構+資料一次匯出（新庫空白時）

```bash
pg_dump "$SOURCE" \
  --no-owner \
  --no-privileges \
  -f cloudsql_full.sql
```

若 Supabase 已用方法 A/B 建好表，用 **`--data-only`** 較不易撞 `CREATE` 衝突。

---

## 五、匯入到 Supabase

```bash
export TARGET="postgresql://postgres.xxxx:你的密碼@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
psql "$TARGET" -f cloudsql_data.sql
# 或 full：psql "$TARGET" -f cloudsql_full.sql
```

若檔案很大，可在 Supabase **SQL Editor** 分段貼上執行（需注意逾時）。

**錯誤排除**：權限／schema 相關可嘗試匯入前在 Supabase 執行：

```sql
SET session_replication_role = replica;
-- 匯入後再：
SET session_replication_role = DEFAULT;
```

（僅在必要時，且需了解風險。）

---

## 六、Cloud Run 改接 Supabase

1. GCP Console → **Cloud Run** → 你的服務 → **編輯並部署新版本**
2. **變數與密碼** → 編輯 **`DATABASE_URL`**  
   - **值**：改為 **第二節** 的 **Pooling URI**（含密碼）
3. **移除** 僅給 Cloud SQL 用的設定（若曾設定）：
   - 舊版「連線到 Cloud SQL」執行個體連結（刪除 SQL 後可移除，避免誤會）
4. **部署**

---

## 七、驗證

1. 開啟後台 `/admin`，確認訂單／客戶資料正常  
2. LINE 群組傳一則測試訊息  
3. Supabase **Table Editor** 看 `orders` / `customers` 是否有新資料  

---

## 八、確認無誤後：關閉 Cloud SQL（省錢）

見 `docs` 內「關掉 Cloud SQL」說明：**先備份** → GCP SQL → **刪除** 執行個體。

---

## 九、費用與注意

- Supabase **Free** 有額度限制；正式環境建議 **Pro**（約 $25/月，以官網為準）。
- **務必**用 **Pooler :6543**，避免 Cloud Run 連線數爆滿。
- 密碼僅放在 **Cloud Run 環境變數**，勿提交到 Git。
