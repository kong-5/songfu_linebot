# Secret Manager 與 LINE Channel 金鑰旋轉

## 為什麼要做

- `.env` 不宜進版控；Cloud Run 若以 `--env-vars-file` 明文注入，任何能看服務設定的人都看得到金鑰。
- **Secret Manager** 把值存於獨立秘密，Cloud Run 以 **`--set-secrets`** 掛成環境變數（或掛檔），並可用 IAM 細部授權。
- 若 **Channel access token / secret 曾外洩**，必須在 **LINE Developers Console 重新發行**，並更新 Google 端的秘密後再部署。

---

## 一、啟用 API 並建立秘密（本機已安裝 gcloud）

```bash
gcloud services enable secretmanager.googleapis.com --project=YOUR_PROJECT_ID
```

預設秘密名稱（與部署腳本一致，可自行改名並用 `.env` 覆寫，見下文）：

| 環境變數名 | 建議 Secret 資源名 |
|------------|---------------------|
| `LINE_CHANNEL_ACCESS_TOKEN` | `songfu-line-channel-access-token` |
| `LINE_CHANNEL_SECRET` | `songfu-line-channel-secret` |
| `GOOGLE_GEMINI_API_KEY` | `songfu-line-gemini-api-key` |
| `GOOGLE_CLOUD_VISION_API_KEY` | `songfu-line-vision-api-key` |
| `DATABASE_URL` | `songfu-line-database-url` |

建立範例（請替換為真值，勿把指令記錄進 shell history 若會外洩）：

```bash
printf '%s' '在此貼上 LINE_CHANNEL_ACCESS_TOKEN' | gcloud secrets create songfu-line-channel-access-token --project=YOUR_PROJECT_ID --data-file=- --replication-policy=automatic

printf '%s' '在此貼上 LINE_CHANNEL_SECRET' | gcloud secrets create songfu-line-channel-secret --project=YOUR_PROJECT_ID --data-file=- --replication-policy=automatic

printf '%s' '在此貼上 GOOGLE_GEMINI_API_KEY' | gcloud secrets create songfu-line-gemini-api-key --project=YOUR_PROJECT_ID --data-file=- --replication-policy=automatic
```

若秘密已存在，改新增版本：

```bash
printf '%s' '新值' | gcloud secrets versions add songfu-line-channel-access-token --project=YOUR_PROJECT_ID --data-file=-
```

---

## 二、讓 Cloud Run 服務帳號能讀秘密

預設使用運算預設服務帳號：`PROJECT_NUMBER-compute@developer.gserviceaccount.com`。

```bash
PROJECT_ID=YOUR_PROJECT_ID
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SEC in songfu-line-channel-access-token songfu-line-channel-secret songfu-line-gemini-api-key songfu-line-vision-api-key songfu-line-database-url; do
  gcloud secrets add-iam-policy-binding "$SEC" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || true
done
```

（若某個秘密尚未建立，`add-iam-policy-binding` 會失敗，可先略過該名稱。）

---

## 三、部署腳本改用 Secret Manager

在 **`songfu_linebot/.env`**（勿 commit）設定：

```bash
PROJECT_ID=你的專案
USE_SECRET_MANAGER=1
# 選填：預設會注入下列鍵對應的預設秘密名；若只想先搬 LINE，可縮小列表：
SECRET_MANAGER_KEYS=LINE_CHANNEL_ACCESS_TOKEN,LINE_CHANNEL_SECRET,GOOGLE_GEMINI_API_KEY
```

接著 **勿再在 `.env` 填寫**已改走 Secret 的同一個變數明文（部署時會自動從 env JSON 移除，改由 `--set-secrets` 注入）。

單一鍵的自訂秘密名稱（選用）：

```bash
SM_SECRET_LINE_CHANNEL_ACCESS_TOKEN=my-custom-token-name:latest
```

然後：

```bash
cd songfu_linebot && npm run deploy
```

腳本會：

1. 仍會把 **非 Secret** 的變數（例如 `GEMINI_MODEL`、`REGION`）寫入 `--env-vars-file`。  
2. 對列在 `SECRET_MANAGER_KEYS` 的變數加上 **`--set-secrets=VAR=secret-name:latest`**。

若使用 **`npm run deploy -- --keep-env`**：只更新映像，**不會**改環境變數與 secret 綁定；初次改接 Secret 請不要用 `--keep-env`。

---

## 四、立刻旋轉 LINE Channel token（曾外洩時必做）

1. 開啟 [LINE Developers Console](https://developers.line.biz/) → 你的 Provider → Messenger API channel。  
2. **Channel secret**：若疑慮外洩，使用官方流程 **重新發行 Channel secret**（舊 secret 立即失效）。  
3. **Channel access token**：在 Messaging API 區塊 **Issue / Reissue channel access token**，複製新 token（長效 token 取代舊的）。  
4. 更新 Google Secret：

```bash
printf '%s' '新的_LONG_LIVED_ACCESS_TOKEN' | gcloud secrets versions add songfu-line-channel-access-token --project=YOUR_PROJECT_ID --data-file=-

printf '%s' '新的_CHANNEL_SECRET' | gcloud secrets versions add songfu-line-channel-secret --project=YOUR_PROJECT_ID --data-file=-
```

5. **重新部署 Cloud Run**（新版本會讀取 secret 的最新版本；若綁定為 `:latest` 通常新容器會載入新版本，為保險仍建議部署一次）：

```bash
cd songfu_linebot && npm run deploy
```

6. 確認 LINE Console 的 Webhook URL 仍指向你的 Cloud Run，且 POST 回 **200**。

---

## 五、`.env.example` 已改為占位字

請勿再把真實 token 貼進範例檔；若曾 commit 過含真值的檔案，請視為已外洩並完成 **第四節旋轉**。
