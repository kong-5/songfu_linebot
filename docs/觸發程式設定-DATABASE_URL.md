# 部署後資料消失：請在觸發程式設定 _DATABASE_URL

若每次 push 部署後，客戶／品項又消失，代表 **Cloud Run 沒有用到 Cloud SQL**（用了容器內的 SQLite）。

---

## 若在觸發程式編輯頁「沒有看到替換變數」

GCP 主控台介面會改版，**替換變數**可能在不同位置：

- **捲到最下面**：建立／編輯觸發程式時，整頁往下捲，有時在表單最下方才有「替換變數」或「Substitution variables」。
- **進階 / Advanced**：點「進階」或「Show more」展開，替換變數常放在裡面。
- **設定類型**：觸發程式若選「Dockerfile」就不會有替換變數，要選 **「Cloud Build 設定檔 (yaml 或 json)」** 且設定檔路徑為 `cloudbuild.yaml`，底下才會出現替換變數區塊。

若**還是找不到**，請用下面 **做法 B（只在 Cloud Run 設 DATABASE_URL）** 或 **做法 C（用 gcloud 指令設）**。

---

## 做法 A：在主控台觸發程式設 _DATABASE_URL（有看到替換變數時）

### 1. 取得 PostgreSQL 連線字串

格式：

```
postgresql://postgres:你的密碼@/songfu?host=/cloudsql/專案ID:區域:執行個體ID
```

範例（請改成你的密碼與執行個體 ID）：

```
postgresql://postgres:MyPass123@/songfu?host=/cloudsql/handy-implement-457807-u0:asia-east1:songfu-db
```

- **專案ID**：`handy-implement-457807-u0`
- **區域**：`asia-east1`
- **執行個體ID**：你在 Cloud SQL 建立的執行個體名稱（例如 `songfu-db`）
- **密碼**：建立 Cloud SQL 時設的 postgres 密碼（若有 `@`、`#`、`%` 需 [URL 編碼](https://www.urlencoder.org/)）

### 2. 在 Cloud Build 觸發程式加入替換變數

1. 開啟 [Cloud Build 觸發程式](https://console.cloud.google.com/cloud-build/triggers?project=handy-implement-457807-u0)
2. 點你用來部署 **songfu-line-bot** 的觸發程式 → **編輯**
3. 捲到 **「替換變數」**（Substitution variables）
4. 按 **「新增變數」**：
   - **名稱**：`_DATABASE_URL`
   - **值**：貼上步驟 1 的整行連線字串（不要前後空格）
5. **儲存**

### 3. 之後每次 push

- 建置會把 `_DATABASE_URL` 傳給 Cloud Run，部署後就會用 **PostgreSQL**，資料會保留。
- 若**沒設** `_DATABASE_URL`，建置會在第一個步驟就失敗，並顯示錯誤，提醒你去設定。

---

## 做法 B：不靠觸發程式，只在 Cloud Run 設 DATABASE_URL（找不到替換變數時）

1. **觸發程式改用不帶金鑰的設定檔**  
   - 觸發程式 → 編輯 → **設定檔路徑** 改為 **`cloudbuild-no-secrets.yaml`**（不要用 `cloudbuild.yaml`）。  
   - 儲存。這樣之後 push 只會「建置映像 + 部署」，**不會**覆寫任何環境變數。

2. **在 Cloud Run 手動設一次 DATABASE_URL**  
   - 開 [Cloud Run](https://console.cloud.google.com/run?project=handy-implement-457807-u0) → **songfu-line-bot** → **編輯並部署新修訂版本**。  
   - **連線**：新增你的 **Cloud SQL 執行個體**。  
   - **變數與密碼**：新增變數  
     - 名稱：`DATABASE_URL`  
     - 值：`postgresql://postgres:你的密碼@/songfu?host=/cloudsql/專案ID:asia-east1:執行個體ID`  
   - 其他變數（LINE_TOKEN、LINE_SECRET 等）若還沒有也一併設好。  
   - 點 **部署**。

3. **之後部署**  
   - 之後每次 `git push` 會用 `cloudbuild-no-secrets.yaml` 部署，**不會**改動你剛設的變數，DATABASE_URL 會保留，資料就不會消失。

注意：若你**曾經**用過 `cloudbuild.yaml` 且沒設 `_DATABASE_URL`，目前修訂版的 DATABASE_URL 可能是空的；照上面做一次「編輯並部署新修訂版本」把 DATABASE_URL 設好，再改觸發程式用 `cloudbuild-no-secrets.yaml` 即可。

---

## 做法 C：用 gcloud 指令在觸發程式加 _DATABASE_URL

若主控台找不到替換變數，可用指令列設定（把觸發程式名稱與連線字串換成你的）：

```bash
# 先看觸發程式名稱
gcloud builds triggers list --project=handy-implement-457807-u0

# 更新替換變數（TRIGGER_NAME 改成你的觸發程式名稱，連線字串改成你的）
gcloud builds triggers update TRIGGER_NAME \
  --project=handy-implement-457807-u0 \
  --region=global \
  --update-substitutions=_DATABASE_URL='postgresql://postgres:你的密碼@/songfu?host=/cloudsql/handy-implement-457807-u0:asia-east1:你的執行個體ID'
```

若觸發程式是 **regional**（例如 region 為 asia-east1），改用：

```bash
gcloud builds triggers update TRIGGER_NAME \
  --project=handy-implement-457807-u0 \
  --region=asia-east1 \
  --update-substitutions=_DATABASE_URL='postgresql://postgres:你的密碼@/songfu?host=/cloudsql/handy-implement-457807-u0:asia-east1:你的執行個體ID'
```

設定好後，觸發程式仍用 `cloudbuild.yaml`，之後 push 就會帶上 DATABASE_URL。
