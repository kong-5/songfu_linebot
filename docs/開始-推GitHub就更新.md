# 開始：推 GitHub 就自動更新 Cloud Run

專案已在本機建好第一個 commit，接下來照下面做即可。

---

## 步驟 1：在 GitHub 建立新儲存庫

1. 打開 **https://github.com/new**
2. **Repository name**：填 `songfu_linebot`（或你要的名稱）
3. 選 **Public**，**不要**勾選 "Add a README"（我們已有程式碼）
4. 點 **Create repository**

---

## 步驟 2：把本機程式推上去

在終端機執行（把 `你的帳號` 換成你的 GitHub 帳號）：

```bash
cd /Users/pentapeptide_/HACCP_Project/songfu_linebot
git remote add origin https://github.com/你的帳號/songfu_linebot.git
git push -u origin main
```

若 GitHub 要求登入，用瀏覽器或 Personal Access Token 依畫面操作即可。

---

## 步驟 3：GCP 啟用 API 與 Artifact Registry

在終端機執行：

```bash
gcloud config set project handy-implement-457807-u0
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create linebot --repository-format=docker --location=asia-east1
```

若出現「linebot 已存在」可略過。

---

## 步驟 4：建立 Cloud Build 觸發程式

1. 打開：**https://console.cloud.google.com/cloud-build/triggers?project=handy-implement-457807-u0**
2. 點 **「建立觸發程式」**
3. **名稱**：`deploy-on-push`
4. **事件**：**推送到分支**
5. **來源**：**連接儲存庫** → 選 **GitHub** → 授權並選你的 `songfu_linebot` repo
6. **分支**：`^main$`
7. **設定**：**Cloud Build 設定檔** → 儲存庫 → 雲端設定檔路徑：`cloudbuild.yaml`
8. 點 **「儲存」**

---

## 步驟 5：給 Cloud Build 部署權限

在終端機執行：

```bash
gcloud projects add-iam-policy-binding handy-implement-457807-u0 \
  --member="serviceAccount:handy-implement-457807-u0@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"
```

---

## 之後：改完程式就這樣更新

```bash
cd /Users/pentapeptide_/HACCP_Project/songfu_linebot
git add .
git commit -m "說明你改了什麼"
git push origin main
```

約 3～5 分鐘後到 **Cloud Build 紀錄** 看建置是否成功，成功後 Cloud Run 就會是新版本。

建置紀錄：**https://console.cloud.google.com/cloud-build/builds?project=handy-implement-457807-u0**
