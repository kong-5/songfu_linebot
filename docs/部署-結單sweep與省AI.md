# 部署：耐久化結單 sweep 與「只在結單解析一次」省 AI

本文說明 Phase C（C2/C3/C4）上線後要做的設定。**程式預設行為不變**；下列設定是「啟用新能力」。

## 一、耐久化結單 sweep（建議務必設定）

新增 `order_collecting_sessions` 表會在下次部署自動建立（schema 皆 `IF NOT EXISTS`）。
結單改由 DB sweep 觸發，可靠不受 Cloud Run 休眠影響。

### 1. 設定 sweep 密鑰（選用但建議）
Cloud Run 環境變數擇一即可（沿用既有也行）：

```
FINALIZE_JOB_SECRET=<自訂一組密鑰>
# 未設時會依序沿用 LINE_WORKER_SECRET / RHYTHM_JOB_SECRET；皆未設則不驗證
```

### 2. 建 Cloud Scheduler 每分鐘打 sweep 端點
與既有 `/api/jobs/wholesale-prefetch`、`/api/jobs/rhythm-daily` 同模式：

```bash
gcloud scheduler jobs create http finalize-due \
  --schedule="* * * * *" \
  --uri="https://<你的服務>.run.app/api/jobs/finalize-due" \
  --http-method=POST \
  --headers="X-Finalize-Job-Secret=<上面的密鑰>" \
  --location=asia-east1
```

> 收單窗預設 30 秒（`LINE_COLLECT_TIMEOUT_SEC`）。每分鐘掃一次代表最慢約 1~1.5 分鐘結單，對叫貨完全可接受。
> 即使沒設 Scheduler，程式內每 60 秒的後備 interval 在「暖實例」時也會掃；但 Cloud Run 休眠時不保證觸發，故仍建議設 Scheduler。

### 3. 驗證
- 在測試群組叫貨後等候，應如常收到「已收單」摘要。
- Cloud Run Logs 應出現 `[finalize-sweep] interval 結單 N 張群組` 或 sweep 端點回應 `{ ok:true, due, finalized }`。

## 二、只在結單解析一次（省 AI；確認上面 sweep 可靠後再開）

確認結單 sweep 在正式環境穩定後，再開這個旗標：

```
LINE_PARSE_ONLY_AT_FINALIZE=1
```

開啟後：
- 逐則訊息（文字／圖片）**只存原文與附件、不打 Gemini**；
- 結單時對整張單**整單解析一次**，並就地處理子客戶拆單；
- 對自由語言＋多則/圖文混合叫貨：**成本約砍半、且 whole-context 更準**。

> ⚠️ 先決條件：因為逐則不再解析，若結單沒被觸發，該單會沒有品項。**務必先完成第一節的 sweep 設定並驗證可靠**，再開此旗標。

### 既有省錢旗標（與本案相容）
- `LINE_SKIP_VISION_WHEN_TEXT_STRONG=1`：文字結果夠強時略過第二次視覺模型（零風險，適合自由語言）。
- 請**勿**用 `LINE_SKIP_FINALIZE_FULL_REBUILD=1` 省錢：那會關掉結單整單解析、改信逐則（看不到整體上下文，對自由語言變不準）；且與 `LINE_PARSE_ONLY_AT_FINALIZE` 互斥（後者已強制結單解析）。

## 三、首次部署後請確認（PG 正式環境）
本批改動的 PG 路徑（交易、`ON CONFLICT` 原子取號、session upsert、sweep）在開發機以 SQLite 驗證；PG 採標準寫法。請於首次部署後用 Logs 確認：
- 當天訂單編號連續、無重號/跳號；
- sweep 端點回 200 且 `finalized` 合理；
- 無 `[LINE] session DB 鏡射失敗` 等持續錯誤。
