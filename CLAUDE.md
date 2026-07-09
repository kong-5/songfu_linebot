# CLAUDE.md — 松富物流 LINE Bot / 後台（給每個新對話先讀）

這份是「架構定案 + 不要再重複踩」的權威清單。**動到相關功能前先讀這份**；細節看 `docs/`。
最後更新：2026-07-08

---

## 專案一句話
松富物流的 LINE 叫貨機器人 ＋ 後台管理（Node/Express，`dist/` 為執行碼），串接凌越 ERP
（訂單回寫、庫存推送、LINE 盤點）。前台 LIFF 頁在 `dist/liff/`，後台在 `dist/admin/`。

## 部署（重要）
- **推 `main` 就自動部署**：`cloudbuild.yaml` 由 `deploy-on-push` 觸發，建 image → 部署
  Cloud Run（`songfu-line-bot`, asia-east1）→ 100% 導流，**保留環境變數**。
- ⚠ **不要**用 `npm run deploy` 而沒帶 `--keep-env`——會清掉環境變數（踩過）。
- 開發分支照 branch 指示；PR squash 合併到 `main` 即上線。

## 凌越 ERP 串接 — 架構定案（air-gap，雲端連不到凌越 LAN）
- 一律**兩段**：內網 Windows（連得到凌越）↔ 雲端後台，機器端點用
  `LINGYUE_WRITEBACK_KEY`（標頭 `X-Writeback-Key`）認證。
- **內網只有「一個統一管理介面」＝ `ly_agent_gui.py`（凌越整合代理視窗程式）**，一個視窗掛
  「庫存推送」＋「訂單回寫」兩條背景執行緒。
  - 該 GUI 用 `local_import` **優先載入「與 GUI 同資料夾」的 `ly_stock_push.py` /
    `ly_writeback_bridge.py`**（權威版），刻意蓋過 `D:\Work\lystk_tool` 的舊版。
  - **底層** `lystk.py` / `ly_order.py` 才在 `D:\Work\lystk_tool`（`LYSTK_DIR` 指到）。
  - 👉 **要更新庫存/回寫邏輯＝換「凌越整合代理」資料夾裡的 `.py`，不是 `D:\Work\lystk_tool`。**
    exe 版把新 `.py` 放 exe 同層即可被 `local_import` 撿走，不必重打包。
  - repo 的 `scripts/ly_stock_push.py`、`ly_writeback_bridge.py` 是這些檔的原始碼來源。
- 訂單回寫**只寫使用者在網站按過「上傳凌越」的單**（長連線 `/wait`），
  **絕不可用 `/pending` 盲掃**（曾誤寫 60 張，見 `docs/凌越回寫-工作交接.md`）。

## 庫存（貨品主檔 資料種類 `000000`）關鍵欄位
| 用途 | 欄位 | 備註 |
|---|---|---|
| 料號/品名/規格/單位 | `SK_NO`/`SK_NAME`/`SK_SPEC`/`SK_UNIT` | 規格如 `18KG/箱`；單位如 `KG`/`把` |
| 目前庫存 | `SK_NOWQTY` | 現有量（即時、可為負，正常） |
| 預設入庫倉別 | `SK_RKWHNO` | 後台倉別**只認凌越倉號**（如 FN005/Y99），不是自建倉 |
| **停用碼** | **`SK_STOP`** | **`1`=停用；推送時一律過濾掉不推**（`ly_stock_push.py`） |
- 庫存快照存 `erp_stock_items`（全表覆蓋）；後台「庫存管理 → 目前庫存」顯示。

## LINE 盤點系統（已上線）
- **LIFF 盤點頁** `dist/liff/stocktake.html`（LIFF `2010106501-VocNwkbA`，端點 `/liff/stocktake`）：
  倉庫選擇→緊湊盤點清單→送出；白底、可隱藏0、**中／越雙語**、**續盤**（重開帶回今日已盤）。
  - **效期品**：由 `stocktake_expiry_item` 標記的品項才出現效期批號輸入。
  - **中價貨**：盤點數旁的小「⋯」點開才填中貨（極少數品項才有，方案B）；**counted_qty 存上＋中合計**，`mid_qty` 單獨保留。
- **群組功能白名單 `group_features`（新，取代舊「盤點群組」開關）**：每個 LINE 群組可分別開關三項功能——
  **辨識訂單／盤點／空籃**。無資料列時**辨識訂單／空籃預設開、盤點預設關**（盤點為 opt-in 白名單制，只有明確設為開的群組才回應 `#盤點`）。權威 helper：`dist/lib/group-features.js`
  的 `getGroupFeatures(db, groupId)`（查不到或出錯：訂單/空籃回開絕不意外斷單、盤點回關）＋ `setGroupFeatures`。
  比對一律正規化（去空白＋小寫）。`line.js` 三個閘門都讀它：
  - **辨識訂單 off** ＝內部群：機器人仍收訊息、仍回應 `#盤點`／空籃／取得群組ID 等指令，只是**不把一般文字送 AI 當訂單**（也不回「無法收單」）。此開關對**已綁客戶的群組同樣生效**（舊的「綁客戶就強制收單」安全防呆已移除）。
  - **盤點 off** ＝群內打 `#盤點` 靜默略過。
  - **空籃 off** ＝「空籃／空藍」不攔截（視為一般文字）。
  - 設定入口：**客戶管理 → 編輯客戶**（該客戶綁定群組的三開關）＋**庫存管理 → 群組功能**（所有群組總表，含非客戶內部群），兩處同步寫 `group_features`。
  - 遷移：舊 `stocktake_group` 於 DB init 一次性帶入 `group_features`（非客戶群→訂單 off；已綁客戶群→訂單 on 保留收單），冪等。`stocktake_group` 保留為群組探索來源，行為已不再依賴它。
- **後台每日盤點** `/admin/inventory`：選日期一次列出當日各倉盤點卡片（盤點人、比例、
  **盤差/盤差%**、含中貨、效期），可「只看盤差」、CSV 匯出。舊自建庫房盤點在 `/admin/inventory/legacy`。
- 資料表：`stocktake_session`（一倉一日一筆）、`stocktake_count`（逐品項，含 `mid_qty`）、
  `erp_warehouse`（倉號→中文名＋納入盤點）、`group_features`（群組三功能開關）、`stocktake_group`（舊白名單／探索來源）、`stocktake_expiry_item`。

## 資料庫可攜性（務必雙寫）
- `dist/db/index.js` 同時支援 **SQLite（本機）與 Postgres/Cloud SQL（雲端）**。
  新增表/欄位**要同時改 `initSqlite` 與 `initPg`**；加欄位用 sqlite `alters` 陣列 ＋ pg
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`。
- `dist/` 是實際執行的 JS（非由 `src/` build），直接改 `dist/`。改完用 `node --check` 驗證。

## 後台頁面設計規範
用既有元件：`notion-page-title`（大標）、`notion-card`（白圓角卡）、預設 `<table>`（自帶樣式）、
`sf-input`/`sf-textarea`、`.btn-primary`。**不要手刻 inline 表格樣式**。
- **圖示一律線條（line art）**：用 `SF_ICONS`（16px、1.4 stroke、`currentColor`、無填色）；
  flex 容器內嵌 `${SF_ICONS.鍵}`、其他用 `${sfInlineIcon('鍵')}`。**禁用彩色 emoji 當 UI 圖示**。
  例外：LINE Flex 訊息文字、log/toast 狀態符號（▶✅❌⚠…）、品類語意標記（🐖🐓🥚）。
- **版面吃滿視窗**：`.notion-main` 用 `max-width:min(100%,1600px)`，別卡窄欄；資料密集頁用
  `.sf-root`/`body.sf-fullwidth` 滿版。只有手機才收窄。
- **滑桿只有兩種**：on/off 用 `.sf-switch`（真 checkbox）、多選一用 `.sf-seg`（玻璃分段、選中亮白膠囊）；
  **禁止**再自刻 `stk-seg`/`pe-switch`/`qe-seg` 這類一次性樣式。
- 細節與可用圖示鍵清單見 `docs/設計風格指南.md` §3.1（圖示）、§3.2（版面寬度）、§3.3（滑桿元件）。

## 相關文件索引（細節在這裡）
- `docs/凌越-目前庫存-庫存管理.md`：庫存推送、停用過濾、內網代理。
- `docs/凌越-進銷交易查詢.md`：庫存頁點品項→近期進銷交易（銷貨A1出＋銷退A2入、方向/淨變動）；
  凌越 API 資料種類代碼＋欄位權威整理（**此 API 無進貨單**）。
- `docs/凌越回寫-工作交接.md`、`docs/凌越訂單回寫-串接說明.md`：訂單回寫規則（含 /wait vs /pending 教訓）。
- `docs/凌越串接-通用方法說明.md`：凌越 SOAP 查詢通用方法。
- 內網代理權威說明在「凌越整合代理」資料夾的 `規則與必備設定.md`（§9 庫存、含停用過濾）。
