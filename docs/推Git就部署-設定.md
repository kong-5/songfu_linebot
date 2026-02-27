# 推送到 Git 就自動部署（不用在本機裝 Docker）

推送到 Git **不會自動**建置或部署，需要先在 GCP 設定 **Cloud Build 觸發程式**。設定好之後，每次 `git push` 就會由 Google 在雲端建置映像並部署到 Cloud Run，**本機不需要安裝 Docker**。

---

## 1. 前置

- 程式碼已在 **GitHub** 或 **Cloud Source Repositories**
- 已安裝並登入 **gcloud**，專案為 `handy-implement-457807-u0`

---

## 2. 啟用 API

```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com --project=handy-implement-457807-u0
```

---

## 3. 建立 Cloud Build 觸發程式

1. 開啟 [Cloud Build 觸發程式](https://console.cloud.google.com/cloud-build/triggers?project=handy-implement-457807-u0)
2. **建立觸發程式**
3. 設定：
   - **名稱**：例如 `songfu-line-bot-deploy`
   - **事件**：推送到分支
   - **來源**：連線你的 GitHub（或 Cloud Source Repo），選 **songfu_linebot** 對應的 repo
   - **分支**：`^main$` 或你用的預設分支
   - **設定**：選 **Cloud Build 設定檔**，設定檔路徑填 `cloudbuild.yaml`（在 repo 根目錄就是 `cloudbuild.yaml`）
4. **進階** → **替換變數**：新增下列變數（值填你的實際內容，不要提交到 Git）：

   | 變數名稱       | 值 |
   |----------------|----|
   | `_LINE_TOKEN`  | LINE Channel Access Token |
   | `_LINE_SECRET` | LINE Channel Secret |
   | `_VISION_KEY` | Google Cloud Vision API 金鑰 |
   | `_DATABASE_URL` | `postgresql://postgres:你的密碼@/songfu?host=/cloudsql/handy-implement-457807-u0:asia-east1:你的執行個體ID` |

   若 Cloud SQL 執行個體 ID 不是 `songfu-line-bot`，請把上面連線名稱裡的執行個體 ID 改成實際的。

5. 儲存觸發程式。

---

## 4. 之後怎麼部署

本機只要：

```bash
cd /Users/pentapeptide_/HACCP_Project/songfu_linebot
git add .
git commit -m "更新程式"
git push
```

幾分鐘內 Cloud Build 會自動建置並部署到 **songfu-line-bot**，不需在本機執行 Docker 或部署腳本。

---

## 5. 查看建置結果

到 [Cloud Build 歷史記錄](https://console.cloud.google.com/cloud-build/builds?project=handy-implement-457807-u0) 可看每次 push 觸發的建置與日誌。
