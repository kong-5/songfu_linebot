# 第二步：部署到 Cloud Run 並設定環境變數

---

## 日常更新：改完程式後怎麼部署？（不能只推 Git）

程式碼在 **`dist/`** 裡（後台在 `dist/admin/index.js`、LINE 在 `dist/webhook/line.js` 等）。  
**只做 `git push` 不會更新 Cloud Run**，因為 Cloud Run 跑的是「已建置好的 Docker 映像」，不是直接從 Git 拉程式。

### 每次改完程式後的更新步驟（三件事）

在 **songfu_linebot** 目錄下執行：

```bash
# 1. 設定變數（改成你的專案 ID）
export PROJECT_ID=$(gcloud config get-value project)
export REGION=asia-east1
export REPO=linebot
export IMAGE=linebot

# 2. 建置映像並推送到 Artifact Registry
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest

# 3. 讓 Cloud Run 使用新映像（部署新修訂版本）
gcloud run deploy songfu-linebot \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest \
  --region ${REGION}
```

若環境變數（LINE token、DB_PATH 等）已在主控台或之前部署時設好，**步驟 3 不用再加 `--set-env-vars`**，會沿用現有設定。

**一鍵執行：** 專案裡有 `scripts/update-deploy.sh`，在 **songfu_linebot** 目錄執行：

```bash
bash scripts/update-deploy.sh
```

會依序完成「建置 → 推送 → 部署」。可設定環境變數覆蓋預設（如 `REGION=asia-northeast1`、`SERVICE=你的服務名`）。

### 想「推送就自動部署」可以嗎？

可以。在 GCP 設定 **Cloud Build 觸發條件**：當某個分支（例如 `main`）有 push 時，自動執行「建置 Docker → 推送到 Artifact Registry → 部署到 Cloud Run」。設定方式可參考 [Cloud Build 觸發程式](https://cloud.google.com/build/docs/automating-builds/create-manage-triggers)。設定好之後，日常就只要 `git push`，等幾分鐘服務就會更新。

---

## 前置條件

- 已安裝 [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install)
- 已登入並選好專案：`gcloud auth login`、`gcloud config set project 你的專案ID`
- 本專案已具備可用的 `dist/`（含 `dist/lib/vision-ocr.js` 與更新後的 `dist/webhook/line.js`）

---

## 方式一：用指令一次完成（建議）

在終端機進入 **songfu_linebot** 目錄後執行。

### 1. 啟用需要的 API

```bash
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 2. 建立 Artifact Registry 倉庫（若尚未建立）

```bash
# 地區可改成離你較近的，例如 asia-east1
gcloud artifacts repositories create linebot --repository-format=docker --location=asia-east1
```

若出現「已存在」可略過。

### 3. 設定 Docker 使用 gcloud 認證

```bash
gcloud auth configure-docker asia-east1-docker.pkg.dev
```

### 4. 建置映像並推送到 Artifact Registry

```bash
# 將 YOUR_PROJECT_ID 改成你的 GCP 專案 ID
export PROJECT_ID=$(gcloud config get-value project)
export REGION=asia-east1
export REPO=linebot
export IMAGE=linebot

docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest
```

### 5. 部署到 Cloud Run 並設定環境變數

**重要：** 下面指令裡的 `GOOGLE_CLOUD_VISION_API_KEY`、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET` 請改成你的實際值（或先用佔位符，部署後到主控台改）。

```bash
gcloud run deploy songfu-linebot \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "PORT=8080" \
  --set-env-vars "GOOGLE_CLOUD_VISION_API_KEY=你的_Vision_API_金鑰" \
  --set-env-vars "LINE_CHANNEL_ACCESS_TOKEN=你的_LINE_Channel_Access_Token" \
  --set-env-vars "LINE_CHANNEL_SECRET=你的_LINE_Channel_Secret"
```

若還有其他變數（例如 `LINE_WEBHOOK_PATH`、`DB_PATH`），可多加幾行：

```bash
  --set-env-vars "LINE_WEBHOOK_PATH=/webhook" \
  --set-env-vars "DB_PATH=/app/data/songfu.db"
```

**注意：** Cloud Run 預設為無狀態，重啟後 `/app/data` 會清空。若訂單要持久化，需改用 Cloud SQL 或掛載 Cloud Storage，再設定對應的 `DB_PATH`。

部署完成後，終端會顯示服務網址，例如：  
`https://songfu-linebot-xxxxx-asia-east1.run.app`。  
把 LINE Webhook URL 設成：`https://上述網址/webhook`（或你設的 `LINE_WEBHOOK_PATH`）。

---

## 方式二：用主控台設定環境變數（已部署過服務）

若服務已經部署，只要「更新程式 + 加環境變數」：

### 1. 重新建置並推送映像（同方式一的步驟 4）

```bash
cd /Users/pentapeptide_/HACCP_Project/songfu_linebot
export PROJECT_ID=$(gcloud config get-value project)
export REGION=asia-east1
export REPO=linebot
export IMAGE=linebot

docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest
```

### 2. 在 GCP 主控台設定環境變數

1. 開啟 [Cloud Run 主控台](https://console.cloud.google.com/run)
2. 點選你的服務（例如 **songfu-linebot**）
3. 點上方 **「編輯並部署新修訂版本」**
4. 在 **「變數與密碼」**（或「環境變數」）區塊：
   - 新增變數：名稱 `GOOGLE_CLOUD_VISION_API_KEY`，值 = 你的 Vision API 金鑰
   - 若有需要，一併確認 `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET` 已設定
5. 點 **「部署」**

部署完成後，新修訂版本就會帶入 `GOOGLE_CLOUD_VISION_API_KEY`，收單中傳照片就會走 Vision 辨識。

---

## 用指令只更新環境變數（不換映像）

若映像沒改，只想加或改環境變數：

```bash
gcloud run services update songfu-linebot \
  --region asia-east1 \
  --set-env-vars "GOOGLE_CLOUD_VISION_API_KEY=你的金鑰"
```

多個變數可寫成一行，用逗號分隔：

```bash
--set-env-vars "KEY1=value1,KEY2=value2"
```

---

## 總結：第二步在做的兩件事

1. **部署最新程式**：讓 Cloud Run 跑到含 `vision-ocr.js` 與照片辨識邏輯的 `dist/`。
2. **設定 `GOOGLE_CLOUD_VISION_API_KEY`**：在部署時用 `--set-env-vars` 或在主控台「變數與密碼」新增，照片辨識才會啟用。

若你目前還沒有 Cloud Run 服務，依 **方式一** 從頭執行即可；若已有服務，用 **方式二** 或「用指令只更新環境變數」即可完成第二步。
