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
2. **建立觸發程式**（或編輯現有的）
3. 設定：
   - **名稱**：例如 `songfu-line-bot-deploy`
   - **事件**：推送到分支
   - **來源**：連線你的 GitHub（或 Cloud Source Repo），選 **songfu_linebot** 對應的 repo
   - **分支**：`^main$` 或你用的預設分支
   - **設定 (Configuration)**：**一定要選「Cloud Build 設定檔 (yaml 或 json)」**，不要選 Dockerfile。
   - **位置**：選「儲存庫」，設定檔路徑填 `cloudbuild.yaml`
4. **替換變數 (Substitution variables)**：
   - 只有當上面選了「Cloud Build 設定檔」時，表單**往下捲**才會出現「Substitution variables」／「替換變數」區塊（有時在進階裡）。
   - 在該區塊按 **新增變數**，依序加入（**不要**在這裡設 `_DATABASE_URL`，改在 Cloud Run 主控台設，見下方）：

   | 名稱 | 值（範例，請改成你的） |
   |------|------------------------|
   | `_LINE_TOKEN` | 你的 LINE Channel Access Token |
   | `_LINE_SECRET` | 你的 LINE Channel Secret |
   | `_VISION_KEY` | 你的 Google Cloud Vision API 金鑰 |

5. **在 Cloud Run 主控台設 DATABASE_URL（必做，否則部署後資料會消失）**：  
   到 [Cloud Run](https://console.cloud.google.com/run?project=handy-implement-457807-u0) → **songfu-line-bot** → **編輯並部署新修訂版本** → **連線** 新增你的 Cloud SQL 執行個體 → **變數與密碼** 新增 `DATABASE_URL` = `postgresql://postgres:密碼@/songfu?host=/cloudsql/專案:區域:執行個體ID`。  
   部署時會**保留**主控台已設的變數，客戶／品項才會持久保存。

6. 儲存觸發程式。

---

### 做法 B：找不到「替換變數」時（推薦）

1. **觸發程式**：設定檔路徑改填 **`cloudbuild-no-secrets.yaml`**（不用 `cloudbuild.yaml`）。  
   這樣觸發程式**不會**帶任何金鑰，只做：建置映像 → 推送 → 部署到 Cloud Run，並掛上 Cloud SQL 連線。

2. **在 Cloud Run 設一次環境變數**：  
   到 [Cloud Run](https://console.cloud.google.com/run?project=handy-implement-457807-u0) → 點 **songfu-line-bot** → **編輯並部署新修訂版本** → **變數與密碼**，新增：

   - `PORT` = `8080`
   - `LINE_CHANNEL_ACCESS_TOKEN` = 你的 LINE Token
   - `LINE_CHANNEL_SECRET` = 你的 LINE Secret
   - `GOOGLE_CLOUD_VISION_API_KEY` = 你的 Vision 金鑰
   - `DATABASE_URL` = `postgresql://postgres:hh168888@/songfu?host=/cloudsql/handy-implement-457807-u0:asia-east1:songfu-line-bot`（密碼或執行個體 ID 不同請改掉）

   儲存後部署。之後每次 **git push** 只會更新映像，這些變數會保留，不用再設。

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
