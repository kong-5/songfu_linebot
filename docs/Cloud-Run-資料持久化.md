# Cloud Run 資料持久化說明

## 為什麼重新部署後資料會不見？

目前程式使用 **SQLite**，資料庫檔案路徑為 `./data/songfu.db`（或環境變數 `DB_PATH`）。

- **Cloud Run 的容器是「無狀態」的**：每次部署新修訂版本時，會啟動**新的容器**，容器內的磁碟是**全新的**。
- 程式在執行時寫入的 `songfu.db` 只存在**那一個容器的磁碟**裡；部署更新後舊容器被替換，磁碟一併消失，所以**資料不會保留**。
- 本機的 `data/songfu.db` **不會**被打進 Docker 映像（Dockerfile 沒有 COPY data/），因此 Cloud Run 上每次都是從空資料庫開始。

所以不是「重新部署把資料刪掉」，而是「每次部署都是用新的空容器，從來沒有把資料寫到可持久保存的地方」。

---

## 做法一：Cloud Run + Filestore（保留現有 SQLite）

讓 SQLite 檔案寫在 **Filestore（NFS）** 上，同一檔案在多次部署間會保留。

### 1. 建立 Filestore 執行個體

1. [Filestore 執行個體](https://console.cloud.google.com/filestore/instances?project=handy-implement-457807-u0) → **建立執行個體**
2. 執行個體 ID：例如 `songfu-data`
3. 區域：選 **asia-east1**（與 Cloud Run 相同）
4. 層級：**基本**
5. 容量：至少 **1 GB**
6. 建立完成後記下 **NFS 掛載點**（例如 `10.x.x.x:/volume_name`）

### 2. 建立 VPC 連接器（若尚未有）

Cloud Run 要掛 Filestore 需透過 VPC：

1. [VPC 網路](https://console.cloud.google.com/networking/connectors?project=handy-implement-457807-u0) → **伺服器端 VPC 存取** → **建立連接器**
2. 名稱：例如 `songfu-connector`
3. 區域：**asia-east1**
4. 子網路：選一個（或新建），例如 `default`

### 3. Cloud Run 掛載 Filestore 並設定 DB_PATH

1. [Cloud Run](https://console.cloud.google.com/run?project=handy-implement-457807-u0) → 點 **songfu-line-bot** → **編輯並部署新修訂版本**
2. **連線** 分頁：
   - **VPC 連接器**：選剛建立的連接器（例如 `songfu-connector`）
3. **卷**（Volumes）分頁：
   - **新增卷**：
     - 名稱：`data`
     - 類型：**Cloud Storage 儲存貯體** 或 **NFS 卷**（依主控台選項）
     - 若為 **Filestore**：選 NFS，掛載路徑填 Filestore 的 NFS 路徑（例如 `10.x.x.x:/volume_name`），掛載到容器路徑：`/mnt/data`
4. **容器** 分頁 → **進階容器設定**：
   - **卷掛載**：把卷 `data` 掛到路徑 `/mnt/data`
5. **變數與密碼**：
   - 新增或修改：`DB_PATH` = `/mnt/data/songfu.db`
6. 部署

之後每次部署，程式都會讀寫同一個 `/mnt/data/songfu.db`，資料會保留。

---

## 做法二：改用 Cloud SQL（PostgreSQL）✅ 已支援

程式已支援 **PostgreSQL**：當設定環境變數 `DATABASE_URL` 時會自動使用 Cloud SQL，否則沿用 SQLite。

**👉 完整圖文步驟請看： [做法二-Cloud-SQL-詳細步驟.md](./做法二-Cloud-SQL-詳細步驟.md)**

### 1. 建立 Cloud SQL（PostgreSQL）執行個體與資料庫

1. [Cloud SQL](https://console.cloud.google.com/sql?project=handy-implement-457807-u0) → **建立執行個體** → 選 **PostgreSQL**
2. 區域選 **asia-east1**，設定根密碼、建立執行個體
3. 建立完成後，在該執行個體內 **建立資料庫**（例如 `songfu`）
4. 在專案 `songfu_linebot` 中，首次使用前請在該資料庫執行 **schema**：  
   將 `dist/db/schema.pg.sql` 的內容在 Cloud SQL 主控台「查詢」或本機用 `psql` 連線後執行

### 2. Cloud Run 設定 DATABASE_URL 與連線

1. [Cloud Run](https://console.cloud.google.com/run?project=handy-implement-457807-u0) → **songfu-line-bot** → **編輯並部署新修訂版本**
2. **連線**：若有需要，可啟用 **Cloud SQL 連線** 並選擇剛建立的 PostgreSQL 執行個體
3. **變數與密碼**：新增  
   `DATABASE_URL` = `postgresql://使用者:密碼@/songfu?host=/cloudsql/專案:區域:執行個體名稱`  
   （實際格式依主控台「連線」頁的說明填寫，例如使用 Unix socket 或 Private IP）
4. 部署

之後程式會以 PostgreSQL 為後端，資料會保存在 Cloud SQL，重新部署不會遺失。

---

## 目前若資料已不見

- **本機**若還有 `songfu_linebot/data/songfu.db`，那是本機的資料，**不會**自動同步到 Cloud Run。
- 若 Cloud Run 從未掛過持久化儲存，則**雲端上的資料無法復原**，只能：
  - 重新在後台匯入客戶、品項等，或
  - 之後先完成「做法一」再操作，讓之後的資料持久保存。

---

## 總結

| 狀況           | 說明 |
|----------------|------|
| 為什麼資料不見 | 每次部署都是新容器，SQLite 檔案只存在舊容器磁碟，不會保留。 |
| 如何讓資料保留 | 用 **Filestore 掛載** 並設定 `DB_PATH=/mnt/data/songfu.db`，或未來改為 Cloud SQL。 |
| 本機 data/     | 僅供本機使用，不會被打進映像，也不會自動上傳到 Cloud Run。 |
