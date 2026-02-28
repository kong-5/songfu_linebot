# 做法二：Cloud SQL（PostgreSQL）詳細步驟

讓松富叫貨機器人改用 **Cloud SQL（PostgreSQL）**，重新部署後資料仍會保留。

**專案資訊**（你的環境）  
- GCP 專案：`handy-implement-457807-u0`  
- 區域：`asia-east1`（台灣）  
- Cloud Run 服務名：`songfu-line-bot`

---

## 步驟一：建立 Cloud SQL PostgreSQL 執行個體

1. 開啟 Cloud SQL 主控台（請選你的專案）：  
   https://console.cloud.google.com/sql/instances?project=handy-implement-457807-u0

2. 點 **「建立執行個體」**。

3. 選 **「選擇 PostgreSQL」**。

4. 填寫：
   - **Cloud SQL 版本（Edition）**：選 **Enterprise** 即可（99.95% SLA、維護停機約 60 秒內；Enterprise Plus 較貴，一般小專案用不到）。
   - **資料庫版本**：選 **PostgreSQL 18**（或主控台提供的較新穩定版）即可。
   - **執行個體 ID**：例如 `songfu-db`（小寫英文、數字、連字號，且**以英文字母開頭**；之後會用來組連線名稱）。
   - **密碼**：為 `postgres` 使用者設一個**強密碼**，請記下來（之後 `DATABASE_URL` 會用到）。
   - **區域**：**務必改為 asia-east1（台灣）**（與 Cloud Run 同區延遲低；預設常是 us-central1，要手動改）。
   - **可用區**：選 **單一可用區** 即可（成本較低；多可用區是給正式環境高可用用，會加價）。
   - 其餘可先維持預設（例如開發用可選較小規格）。

5. 點 **「建立執行個體」**，等幾分鐘直到狀態為「可用的綠勾」。

6. 記下 **「連線名稱」**（格式：`專案ID:區域:執行個體ID`），例如：  
   `handy-implement-457807-u0:asia-east1:songfu-db`  
   之後設定 `DATABASE_URL` 時會用到。

---

## 步驟二：在該執行個體內建立資料庫

1. 在 Cloud SQL 執行個體列表，點你剛建立的執行個體（例如 `songfu-db`）。

2. 左側選 **「資料庫」**（Databases）。

3. 點 **「建立資料庫」**。

4. **資料庫名稱** 填：`songfu`（或你喜歡的名稱，但要與後面 `DATABASE_URL` 裡的資料庫名一致）。

5. 建立完成後，左側選 **「使用者」** 確認有 `postgres`（預設就有），密碼就是步驟一設的那組。

---

## 步驟三：執行 PostgreSQL Schema（建表）

程式需要這些表：`customers`、`products`、`orders`、`order_items`、`app_settings`、`product_aliases`、`customer_product_aliases`、`product_unit_specs`。  
請在 **剛建立的資料庫**（例如 `songfu`）裡執行一次 schema。

### 方式 A：用 Cloud Shell（推薦，主控台沒有「查詢」時用這個）

1. 在 GCP 右上角點 **「啟動 Cloud Shell」**（終端機圖示 `>_`），或從你的 Cloud SQL 執行個體頁面找 **「連線」** → **「使用 Cloud Shell 連線」**。
2. 在 Cloud Shell 輸入（把 `你的執行個體ID` 改成實際的，例如 `songfu-db`）：
   ```bash
   gcloud sql connect 你的執行個體ID --user=postgres --database=songfu --project=handy-implement-457807-u0
   ```
   提示輸入密碼時輸入 postgres 密碼（不會顯示），按 Enter。
3. 連上後會出現 `songfu=>`。用本機編輯器或檔案總管開啟 **`songfu_linebot/dist/db/schema.pg.sql`**，**全選、複製**。
4. 回到 Cloud Shell，在 `songfu=>` 後**右鍵貼上**（或 Ctrl+V）整份 schema，按 Enter。  
   若最後一行沒有執行，再按一次 Enter。
5. 看到多行 `CREATE TABLE`、沒有 `ERROR` 即成功。輸入 `\q` 按 Enter 離開。

### 方式 B：本機用 psql + Cloud SQL Auth Proxy

1. 本機安裝 [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy) 與 PostgreSQL 用戶端（`psql`）。
2. 在終端機執行 Proxy（把 `連線名稱` 換成你的，例如 `handy-implement-457807-u0:asia-east1:songfu-db`）：
   ```bash
   ./cloud-sql-proxy 連線名稱
   ```
3. 另開一個終端機，在專案目錄執行（密碼、dbname、port 依實際修改）：
   ```bash
   PGPASSWORD=你的密碼 psql -h 127.0.0.1 -p 5432 -U postgres -d songfu -f songfu_linebot/dist/db/schema.pg.sql
   ```
4. 執行成功即完成建表。

---

## 步驟四：取得連線資訊並組成 DATABASE_URL

- **連線名稱**：步驟一記下的，例如  
  `handy-implement-457807-u0:asia-east1:songfu-db`
- **資料庫名**：步驟二建立的，例如 `songfu`
- **使用者**：`postgres`
- **密碼**：步驟一設的密碼

Cloud Run 透過 **Unix socket** 連 Cloud SQL 時，`DATABASE_URL` 格式為：

```text
postgresql://postgres:你的密碼@/songfu?host=/cloudsql/handy-implement-457807-u0:asia-east1:songfu-db
```

請替換三處：  
1. `你的密碼` → 實際 postgres 密碼（若密碼含特殊字元需 [URL 編碼](https://en.wikipedia.org/wiki/Percent-encoding)）  
2. `songfu` → 若你資料庫名不同就改這裡  
3. `handy-implement-457807-u0:asia-east1:songfu-db` → 你的**連線名稱**（專案:區域:執行個體ID）

範例（密碼假設為 `MyPass123`）：

```text
postgresql://postgres:MyPass123@/songfu?host=/cloudsql/handy-implement-457807-u0:asia-east1:songfu-db
```

---

## 步驟五：在 Cloud Run 啟用 Cloud SQL 連線並設定 DATABASE_URL

1. 開啟 Cloud Run：  
   https://console.cloud.google.com/run?project=handy-implement-457807-u0

2. 點服務 **「songfu-line-bot」** → **「編輯並部署新修訂版本」**。

3. 在 **「連線」** 分頁（或「設定」裡的連線相關區塊）：
   - 找到 **「Cloud SQL 連線」**（或「新增連線」）。
   - 按 **「新增連線」**（或選取），選你剛建立的 **PostgreSQL 執行個體**（例如 `songfu-db`）。
   - 儲存／繼續。

4. 在 **「變數與密碼」**（Variables & Secrets）：
   - **新增變數**  
     - 名稱：`DATABASE_URL`  
     - 值：貼上步驟四組好的那一整行（例如  
       `postgresql://postgres:MyPass123@/songfu?host=/cloudsql/handy-implement-457807-u0:asia-east1:songfu-db`  
     ）
   - 若本來有設 `DB_PATH`，可以**刪除**或保留（有 `DATABASE_URL` 時程式會優先用 PostgreSQL，不會用 `DB_PATH`）。
   - 其餘變數（如 LINE token、LINE secret 等）維持不變。

5. 捲到最下方點 **「部署」**，等新修訂版本就緒。

---

## 步驟六：確認是否用到 PostgreSQL

1. 部署完成後，到 Cloud Run 該修訂版本的 **「記錄」**（Logs）看一下啟動日誌。
2. 若沒有錯誤且服務有回 200，代表已正常啟動。
3. 到後台（例如 `/admin`）登入，**新增一筆測試客戶或品項**，再重新部署一次修訂版本。
4. 再開後台，若剛加的資料還在，代表已改用 Cloud SQL，資料會持久保存。

---

## 常見問題

**Q：密碼有 `@`、`#`、`%` 等符號怎麼辦？**  
A：需做 URL 編碼，例如 `@` → `%40`，`#` → `%23`，`%` → `%25`。可搜尋 "URL encode" 工具代為轉換。

**Q：DATABASE_URL 要放在哪裡？**  
A：  
- **做法 A**：在 Cloud Run 服務的「變數與密碼」裡設（建議，不進程式碼）。  
- **做法 B**：若你用 Cloud Build 觸發程式且用替換變數，可在觸發程式裡設 `_DATABASE_URL`，並在 `cloudbuild.yaml` 裡把它傳成部署時的 `DATABASE_URL`。  
  （你專案文件 `推Git就部署-設定.md` 裡有提到 `_DATABASE_URL`，若採用「做法 B」且用 `cloudbuild-no-secrets.yaml`，則以 **Cloud Run 變數與密碼** 裡的 `DATABASE_URL` 為準即可。）

**Q：執行個體 ID 和連線名稱哪裡看？**  
A：在 [Cloud SQL 執行個體](https://console.cloud.google.com/sql/instances?project=handy-implement-457807-u0) 點進該執行個體，在「概觀」或「連線」區會顯示「連線名稱」，格式即 `專案ID:區域:執行個體ID`。

**Q：本機開發也要連 Cloud SQL 嗎？**  
A：不必。本機不設 `DATABASE_URL` 就會用 SQLite（`./data/songfu.db`）。只有 Cloud Run 上設 `DATABASE_URL` 才會用 PostgreSQL。

---

## 總結檢查表

- [ ] 已建立 Cloud SQL PostgreSQL 執行個體（區域 asia-east1）
- [ ] 已建立資料庫（例如 `songfu`）
- [ ] 已在該資料庫執行 `dist/db/schema.pg.sql`
- [ ] 已記下連線名稱與 postgres 密碼，並組好 `DATABASE_URL`
- [ ] 在 Cloud Run「連線」已新增該 Cloud SQL 執行個體
- [ ] 在 Cloud Run「變數與密碼」已新增 `DATABASE_URL`
- [ ] 已部署並在後台確認資料會保留
