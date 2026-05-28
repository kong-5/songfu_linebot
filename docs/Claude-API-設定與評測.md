# 接 Claude vision 做訂單辨識 A/B 對照

目的：在後台 `/admin/order-eval` 用既有的 Golden Set（人工核可過的訂單圖），跑 Gemini vs Claude 對比，看哪個準確度高、值不值得換。

> 本機器人**目前線上仍用 Gemini**。Claude 接好之後**只在 order-eval 評測頁能跑**，不會影響任何客戶訂單。確認 Claude 比較準再決定要不要切到線上。

---

## 一、拿到 Anthropic API Key

1. 到 [https://console.anthropic.com/](https://console.anthropic.com/) 註冊或登入（可用 Google 登入）
2. 進去後左下角點 **Settings**（齒輪圖示）→ 左欄選 **API Keys**
3. 右上角按 **Create Key**
   - **Name**：填 `songfu-linebot-eval`（或你能認的名字）
   - **Workspace**：選 Default 即可
   - 按 **Create Key**
4. 跳出來那串 `sk-ant-api03-XXXXXX...` **就只會出現一次**，立刻複製貼到記事本（或密碼管理器）
5. 預先儲值：左欄 **Plans & Billing** → 加 $20 美金（一次完整評測 80 張約 $0.5–1，夠你跑很多輪）

---

## 二、把 Key 設到 Cloud Run（簡單版）

> 機器人現在跑在 Cloud Run 服務 `songfu-line-bot`，地區 `asia-east1`，專案 `handy-implement-457807-u0`。

### 步驟（用瀏覽器，最直觀）

1. 開 [Cloud Run Console](https://console.cloud.google.com/run?project=handy-implement-457807-u0)
2. 點服務名稱：**songfu-line-bot**
3. 上方按 **編輯與部署新修訂版本**（Edit & Deploy New Revision）
4. 中間區塊找到 **變數和密鑰**（Variables & Secrets）標籤
5. 在 **變數**（Variables）區塊按 **新增變數**
   - 名稱：`ANTHROPIC_API_KEY`
   - 值：剛才複製的 `sk-ant-api03-...`
6. **重要**：右下角按 **部署**（Deploy）會跑約 2 分鐘
7. 等狀態變綠色「處理 100% 流量」就好

### 確認生效

開 [https://songfu-line-bot-238580214385.asia-east1.run.app/health](https://songfu-line-bot-238580214385.asia-east1.run.app/health)
應回 `{"ok":true,"service":"songfu_linebot","dbReady":true}`

---

## 三、（可選）安全版：用 Secret Manager 存

如果你不希望 API key 出現在 Cloud Run 環境變數明文中（管理員開頁面就能看到），可以走 Secret Manager。需要 Terminal 操作：

```bash
# 1. 建立 secret
echo -n "sk-ant-api03-你的key" | gcloud secrets create songfu-anthropic-api-key \
  --data-file=- --project=handy-implement-457807-u0

# 2. 給 Cloud Run service account 讀取權限
PROJECT_NUMBER=$(gcloud projects describe handy-implement-457807-u0 --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding songfu-anthropic-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=handy-implement-457807-u0

# 3. 在 Cloud Run Console 把 secret 綁成環境變數
# Console → songfu-line-bot → 編輯 → 變數和密鑰 → 「密鑰」區塊
#   按「新增密鑰」
#   名稱：ANTHROPIC_API_KEY
#   密鑰：songfu-anthropic-api-key
#   版本：latest
# 部署
```

> 之後輪換 key 只要 `gcloud secrets versions add songfu-anthropic-api-key --data-file=-` 並重新部署，不必再改 Console。

---

## 四、跑 A/B 評測

1. 開 [https://songfu-line-bot-238580214385.asia-east1.run.app/admin/order-eval](https://songfu-line-bot-238580214385.asia-east1.run.app/admin/order-eval)
2. 確認下半段有「目前 Golden 後選：最多 N 張有效」，N 越大評測越可靠（理想 ≥ 30 張）
3. 在表單跑 **3 次**（每次只改「模型」這一欄，其他都一樣）：

| 第幾次 | 模型 | Few-Shot 策略 | 範例數 | 最多評測張數 |
|---|---|---|---|---|
| 1 | `gemini-2.5-flash` | standard | 2 | 80 |
| 2 | `gemini-2.5-pro` | standard | 2 | 80 |
| 3 | `claude-sonnet-4-5` | standard | 2 | 80 |

每次跑完會出 4 個指標：

- **精確度**：預測列有多少對應到標準答案（越高越好）
- **召回率**：標準答案有多少被預測到（越高越好）
- **數量誤差**：命中列的平均數量誤差（越低越好）
- **單位一致率**：命中列的單位字串吻合比例（越高越好）

> ⚠️ 每天全量評測有 5 次配額（防止誤迴圈），所以一天最多跑 5 個模型。

---

## 五、依結果決定要不要切到線上

| 結果型態 | 建議 |
|---|---|
| Claude 比 Gemini Pro 精確度高 ≥ 5%，且月成本可接受 | 把線上切 Claude（叫我幫你動） |
| Gemini Pro 跟 Claude 差距 < 3% | 用 Gemini Pro 就好，便宜 6 倍 |
| Gemini Flash 已經跟其他兩個差距 < 2% | 維持 Flash，最便宜 |
| Claude 大贏 Gemini Pro（≥ 10%）| 用「雙模型保險」：Gemini 跑得快，confidence < 70 才呼叫 Claude 當第二意見 |

---

## 六、月成本估算（每天 100 張訂單）

| 模型 | 單張成本 | 月成本（3000 張）|
|---|---|---|
| gemini-2.5-flash | ~$0.001 | **~$3** |
| gemini-2.5-pro | ~$0.005 | **~$15** |
| claude-sonnet-4-5 | ~$0.015 | **~$45** |
| claude-opus-4-5 | ~$0.05 | **~$150** |
| claude-haiku-4-5 | ~$0.003 | **~$9** |

評測本身（80 張 × 1 次）成本：Sonnet 約 $1.2、Opus 約 $4、Haiku 約 $0.24。

---

## 七、出錯排查

| 症狀 | 可能原因 | 怎麼修 |
|---|---|---|
| 評測結果全 0、API errors 滿格 | ANTHROPIC_API_KEY 沒設或拼錯 | Cloud Run 變數重設 |
| 部分張 fail，多數 OK | Anthropic 帳號餘額不足 | 到 [console.anthropic.com](https://console.anthropic.com) Billing 加值 |
| 訊息「[claude-vision] 無法解析 JSON」 | Claude 回 JSON 格式偶爾失誤 | 觀察次數；過多請貼 log 給我調 prompt |
| 評測非常慢 | Claude 對大張圖約 10–20 秒一張，80 張要 15 分鐘 | 正常，去喝杯咖啡 |

---

## 八、回退

不想用 Claude 了：把 Cloud Run 的 `ANTHROPIC_API_KEY` 變數刪掉、重部署即可。後台 `/admin/order-eval` 還能看到 Claude 選項，但選了會自動回空（程式碼判斷 key 沒設就不打 API）。
