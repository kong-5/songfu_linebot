# Cloud Run「無法啟動並監聽 PORT」排查

若出現：**The user-provided container failed to start and listen on the port defined by PORT=8080**，多半是啟動時連線 Cloud SQL 失敗或逾時，流程沒跑到 `listen` 就被中斷。

---

## 1. 確認「連線」有加 Cloud SQL（必做）

只有設 **DATABASE_URL** 不夠，容器要能連到 Cloud SQL，必須在 **同一個服務** 掛上 Cloud SQL 連線：

1. [Cloud Run](https://console.cloud.google.com/run?project=handy-implement-457807-u0) → 點 **songfu-line-bot**
2. **編輯並部署新修訂版本**
3. 上方或左側找 **「連線」**（Connections）
4. ** Cloud SQL 連線** → 按 **「新增連線」** 或勾選
5. 選你的 **PostgreSQL 執行個體**（例如 songfu-db）
6. 儲存／部署

沒做這步的話，程式連不到 Cloud SQL，啟動會卡住或失敗，就不會在 PORT 上 listen。

---

## 2. 看日誌裡的錯誤

1. Cloud Run → **songfu-line-bot** → **「記錄」**（Logs）
2. 選失敗的那次修訂版本，看啟動階段的訊息

若看到：

- **PostgreSQL 連線失敗**、**timeout**、**ECONNREFUSED** → 多半是連線沒掛好或 DATABASE_URL 錯
- **password authentication failed** → 密碼錯誤或 DATABASE_URL 裡密碼編碼錯誤

---

## 3. 檢查 DATABASE_URL 格式（連線名稱只寫一次）

應為（整段一行，**連線名稱只出現一次**）：

```
postgresql://postgres:你的密碼@/songfu?host=/cloudsql/handy-implement-457807-u0:asia-east1:songfu-db
```

常見錯誤：`host=` 後面寫成兩次專案:區域:執行個體，例如  
`host=/cloudsql/handy-implement-457807-u0:asia-east1:handy-implement-457807-u0:asia-east1:songfu-db`  
會導致 ENOENT / 連線失敗，請改成上面只含**一次** `handy-implement-457807-u0:asia-east1:songfu-db`。

- 密碼有 `@`、`#`、`%` 要先 [URL 編碼](https://www.urlencoder.org/)
- 最後一段 `songfu-db` 要和你 Cloud SQL 的**執行個體 ID** 一致

---

## 4. 拉長啟動逾時（可選）

若連線沒問題但啟動較慢，可把「啟動逾時」調大：

1. Cloud Run → songfu-line-bot → **編輯並部署新修訂版本**
2. **容器** 分頁 → **進階容器設定**
3. 找 **「啟動逾時」** 或 **Startup timeout**，改為 **60** 或 **120** 秒
4. 儲存／部署

---

## 總結檢查表

- [ ] **連線** 已加入 Cloud SQL 執行個體（songfu-db）
- [ ] **變數與密碼** 已設 **DATABASE_URL**，格式與密碼正確
- [ ] 記錄裡若有錯誤，已依錯誤訊息修正（連線／密碼／格式）
