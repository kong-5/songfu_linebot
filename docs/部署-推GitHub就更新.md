# 用 GitHub + Cloud Build：推程式就自動部署

這樣做之後，**不用在自己電腦裝 Docker 或跑腳本**，只要把程式推到 GitHub，Google 就會自動建置並部署到 Cloud Run。

---

## 一次設定（約 10 分鐘）

### 1. 程式碼放到 GitHub

- 若還沒有 GitHub  repo：到 https://github.com/new 建立新 repo（例如 `songfu_linebot`）。
- 在本機專案目錄執行（已建過 repo 可跳過）：

```bash
cd /Users/pentapeptide_/HACCP_Project/songfu_linebot
git init
git remote add origin https://github.com/你的帳號/songfu_linebot.git
git add .
git commit -m "Initial"
git branch -M main
git push -u origin main
```

- **重要**：專案裡的 **`dist/`** 要一併推上去（不要用 .gitignore 忽略 dist），因為 Cloud Build 會用這個資料夾建置映像。

### 2. 在 GCP 啟用 Cloud Build 並建立 Artifact Registry

在終端機執行（需已安裝 gcloud 並登入）：

```bash
gcloud config set project handy-implement-457807-u0
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create linebot --repository-format=docker --location=asia-east1
```

若 `linebot` 已存在會提示錯誤，可略過。

### 3. 把 GitHub 連到 Google Cloud Build

1. 打開：**https://console.cloud.google.com/cloud-build/triggers?project=handy-implement-457807-u0**
2. 點 **「建立觸發程式」**。
3. **名稱**：例如 `deploy-on-push`。
4. **事件**：選 **「推送到分支」**。
5. **來源**：選 **「連接儲存庫」** → 選 **GitHub** → 授權並選你的 `songfu_linebot` repo。
6. **分支**：填 `^main$`（只對 main 分支 push 觸發）。
7. **設定**：選 **「Cloud Build 設定檔」**，**類型** 選「雲端設定檔」，**位置** 選「儲存庫」，**雲端設定檔路徑** 填：`cloudbuild.yaml`。
8. 點 **「儲存」**。

### 4. 給 Cloud Build 部署 Cloud Run 的權限

在終端機執行（把專案 ID 換成你的）：

```bash
# 讓 Cloud Build 可以部署 Cloud Run
gcloud projects add-iam-policy-binding handy-implement-457807-u0 \
  --member="serviceAccount:handy-implement-457807-u0@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"
```

若觸發後部署失敗、出現「Permission denied」或「does not have permission」，到 [Cloud Build 與 Cloud Run 權限說明](https://cloud.google.com/build/docs/deploying-builds/deploy-cloud-run#required_permissions) 照官方步驟補上「服務帳戶使用者」等權限。

（若 Cloud Run 服務還沒建過，請先用本機 Docker + 腳本或主控台部署一次，把環境變數設好；之後觸發程式只會「換映像」，不會改環境變數。）

---

## 之後日常更新

1. 改程式（例如改 `dist/admin/index.js`）。
2. 推送到 GitHub：

```bash
cd /Users/pentapeptide_/HACCP_Project/songfu_linebot
git add .
git commit -m "後台更新 xxx"
git push origin main
```

3. 到 **Cloud Build 紀錄** 看有沒有在跑：  
   https://console.cloud.google.com/cloud-build/builds?project=handy-implement-457807-u0  
   約 3～5 分鐘後建置成功，Cloud Run 就會自動換成新版本。

---

## 優點

- 不用在自己電腦裝 Docker。
- 不用每次執行 `bash scripts/update-deploy.sh`。
- 改完程式只要 **git add → commit → push**，就會自動部署。

若你願意，我可以再幫你把「連接 GitHub 儲存庫」那幾步寫成更細的截圖說明（依你目前畫面為主）。
