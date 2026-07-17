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
- 庫存快照存 `erp_stock_items`（**按公司 icpno 覆蓋**）；後台「庫存管理 → 目前庫存」顯示（公司分段切換）。

## 松揚掃碼盤點（多公司，2026-07-10 新）
- **松揚＝同一套凌越的公司代碼 `02`**（00 松富、01 龍港、03 松成）。`erp_stock_items`/`erp_warehouse`
  主鍵已改 **(icpno, 料號/倉號)**、`stocktake_session` 加 `icpno`（NULL＝'00'）；DB init 有冪等遷移。
  公司名權威 helper：`dist/lib/erp-companies.js`（`normIcpno`/`erpCompanyName`）。
- 內網代理 `LY_ICPNO` 填 **`all`**＝庫存推送**全公司 00,01,02,03 逐家推**（也可逗號指定）；
  **訂單回寫/單品查詢只用第一家非 all 代碼（all＝00）**（`ly_agent_gui.py` 的 `first_icpno()`，
  防把 "all"/"00,02" 傳進凌越）。
- **LIFF 掃碼頁 `/liff/scan`**（env `LIFF_ID_SCAN`，頁內可切公司、預設 icpno=02）：手機當 PDA——
  連續掃碼＋**大數字鍵盤**（掃完直接打數字覆蓋，不彈系統鍵盤），寫入**同一套盤點表**
  （後台每日盤點直接看到，倉庫卡片帶公司標）。凌越沒維護條碼→條碼對照存 `product_barcode`
  （`(icpno,barcode)`→料號＋`qty_per_scan` 箱碼倍數），**邊掃邊綁**建檔；後台總管理在「庫存管理 → 條碼對照」。
  掃描引擎鏈：BarcodeDetector → **zxing 純 JS（本地 vendor，iPhone LINE 瀏覽器用這條）** →
  liff.scanCodeV2 → 手動輸入。細節與上線步驟（要開新 LIFF app、開 scanQR）見 `docs/松揚-掃碼盤點.md`。

## LINE 盤點系統（已上線）
- **LIFF 盤點頁** `dist/liff/stocktake.html`（LIFF `2010106501-VocNwkbA`，端點 `/liff/stocktake`）：
  倉庫選擇→緊湊盤點清單→送出；白底、可隱藏0、**中／越雙語**、**續盤**（重開帶回今日已盤）。
  - **效期品**：由 `stocktake_expiry_item` 標記的品項才出現效期批號輸入。**此表已分公司**（主鍵 `(icpno, erp_code)`）；後台「庫存管理 → 效期品設定」(`/admin/inventory/expiry-items`) 可單筆或**整倉批次**帶入（例：松揚雜貨庫房）。
  - **網站版盤點入口** `/admin/inventory/entry`：後台帳號 cookie 登入、免 LINE token（解外部瀏覽器登入逾時），與 LIFF 頁共用 `stocktake.html`（`window.__STK_WEB__` 注入 WEB 模式），寫進同一套盤點表。
  - **庫存調整（誤差補償，免凌越重整）**：`stock_adjustment`（主鍵 `(icpno, erp_code)`、`delta`）。**顯示庫存＝凌越快照＋delta**（`/admin/inventory/stock`），每日盤點「最新系統／對最新盤差」也加 delta（校正後歸零）。每日盤點盤差表一鍵「建立調整」＝`delta=實盤−凌越量`（**基準與「最新系統」同一套：該倉有分倉列用分倉量，否則公司總量**——舊版一律用總量，品項跨倉/他倉負庫存時會算錯）；總管理在「庫存管理 → 庫存調整」(`/admin/inventory/adjustments`) 可改/刪。庫存統計圖表（熱力圖/盤差折線/卡牆盤點點）的盤差％一律**含調整**（`statsAdjMap`）。**只影響內部顯示與盤差，不寫回凌越**；凌越重整後要記得刪調整避免雙重補償。
  - **中價貨**：盤點數旁的小「⋯」點開才填中貨（極少數品項才有，方案B）；**counted_qty 存上＋中合計**，`mid_qty` 單獨保留。
  - **必盤**：盤點清單把「自昨天（或上次盤點）以來凌越有變動」的品項**排到最上面＋標紅「必盤」**（全公司）。權威 helper：`dist/lib/stock-mustcount.js` 的 `computeMustCount`（混合基準：優先比 `erp_stock_daily` 昨天快照、無則退回上次 `stocktake_count.sys_qty`；|變動|≥門檻才算，門檻預設 1、可用 `app_settings.stocktake_mustcount_min_delta` 覆寫）。每日快照由**庫存推送 `inventory-push` 同交易寫入 `erp_stock_daily`**（一天一份、留 90 天；含 K 線 OHLC 欄 `qty_open/qty_high/qty_low`——開＝當日首推時的昨收、高低＝當日各次推送極值、`qty`＝收）。帶 `warehouse_qty` 的推送同時寫**分倉每日快照 `erp_stock_wh_daily`**（同套 OHLC 規則）。
- **庫存統計圖表** `/admin/inventory/stats`（盤點頁與側欄都有入口）：三欄式（日K/週K/月K＋期間｜倉庫｜品項模糊搜尋）看單品 K 線＋盤差％折線；另一檢視＝**盤差熱力圖**（品項×日期、紅虧藍盈、預設只列有盤差品項 Top 20 依嚴重度排序）＋排行＋點格下鑽。資料 API：`/stats/items`、`/stats/kline`、`/stats/heatmap`。盤差＝盤點凍結當下（`counted−sys`，分母 `max(|sys|,1)`），「當日最後」由一倉一日一筆天然成立、換日即定案，**免結算排程**；分倉 K 線在 `erp_stock_wh_daily` 無資料時自動退回公司層級並標示。
- **群組功能白名單 `group_features`（新，取代舊「盤點群組」開關）**：每個 LINE 群組可分別開關三項功能——
  **辨識訂單／盤點／空籃**。無資料列時**辨識訂單／空籃預設開、盤點預設關**（盤點為 opt-in 白名單制，只有明確設為開的群組才回應 `#盤點`）。權威 helper：`dist/lib/group-features.js`
  的 `getGroupFeatures(db, groupId)`（查不到或出錯：訂單/空籃回開絕不意外斷單、盤點回關）＋ `setGroupFeatures`。
  比對一律正規化（去空白＋小寫）。`line.js` 三個閘門都讀它：
  - **辨識訂單 off** ＝內部群：機器人仍收訊息、仍回應 `#盤點`／空籃／取得群組ID 等指令，只是**不把一般文字送 AI 當訂單**（也不回「無法收單」）。此開關對**已綁客戶的群組同樣生效**（舊的「綁客戶就強制收單」安全防呆已移除）。
  - **盤點 off** ＝群內打 `#盤點` 靜默略過。**多公司**：`#盤點`＝松富(00)；`#盤點 松揚`／`#盤點 龍港`／`#盤點 松成`（或代碼 `#盤點 02`）指定公司，倉庫按鈕與盤點 LIFF 頁都帶 `icpno`（盤點頁上方也有公司切換）。公司名解析 helper：`dist/lib/erp-companies.js` 的 `companyArgToIcpno`。
  - **空籃 off** ＝「空籃／空藍」不攔截（視為一般文字）。
  - 設定入口：**客戶管理 → 編輯客戶**（該客戶綁定群組的三開關）＋**客戶管理 → 群組功能**（`/admin/customers/groups`，所有群組總表，含非客戶內部群；原「庫存管理 → 群組功能」已整併過來，舊網址轉跳），兩處同步寫 `group_features`。
  - 遷移：舊 `stocktake_group` 於 DB init 一次性帶入 `group_features`（非客戶群→訂單 off；已綁客戶群→訂單 on 保留收單），冪等。`stocktake_group` 保留為群組探索來源，行為已不再依賴它。
- **後台每日盤點** `/admin/inventory`：選日期一次列出當日各倉盤點卡片（盤點人、比例、
  **盤差/盤差%**、含中貨、效期），可「只看盤差」、CSV 匯出。舊自建庫房盤點在 `/admin/inventory/legacy`。
- **異常排查表** `/admin/inventory/anomalies`（每日盤點頁入口）：當日「對最新盤差≠0」品項＋依訊號自動列**可能原因**（盤差方向→進貨未入/銷貨未開等、跨倉持有、他倉負庫存、已掛調整），勾選後推送 LINE 群組請大家複查（群組清單＝`stocktake_group`，記住上次選擇 `app_settings.stocktake_anomaly_group_id`）；純提示不寫帳。
- 資料表：`stocktake_session`（一倉一日一筆）、`stocktake_count`（逐品項，含 `mid_qty`）、
  `erp_warehouse`（倉號→中文名＋納入盤點）、`group_features`（群組三功能開關）、`stocktake_group`（舊白名單／探索來源）、`stocktake_expiry_item`。

## 子客戶拆單（LINE 收單，2026-07-10 定案）
- **拆單資格只認客戶主檔 `known_sub_customers`**：未設定的客戶（如娜路灣、南豐）一律不拆——
  Gemini schema 強制輸出 `sub_customer` 會臆造子客戶名，解析入口（`parse-order-message.js` /
  `parse-order-from-image.js`）在未傳 `knownSubCustomers` 時把 `subCustomer` 一律清空。
- **任一非空子客戶即分流**：整則訊息都是同一家子客戶（共用群組單獨幫某分店叫貨，如養鍋）也會
  分到該子客戶的訂單，不再掉進主客戶單（舊條件要 ≥2 個不同鍵才拆）。
- **同日同 split key 重用訂單**（`line.js` `findOrCreateSplitTargetOrder`，比照後台 `resolveSplitTargetOrder`）：
  同子客戶多則訊息累加到同一張子單，不再每則各開新單。
- **拆單發生時當日 NULL 主訂單標成 `''` 桶**（`markSameDayMainOrdersAsSplitBase`）：rebuild 過濾語意
  NULL＝全部品項、`''`＝只留 subCustomer 空的品項；不標會在結單整單重辨識時把子客戶品項重建進主訂單→重複出貨。

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
- **「選時間→選對象→看內容」的作業頁一律用三欄版型 `sf3-*`**（欄1 時間｜欄2 對象｜欄3 內容；
  訂單審核/盤點/庫存統計圖表已套）。共用 class 與行為慣例見 `docs/設計風格指南.md` §3.4；
  儀表板、表單/設定、主檔編輯**不要**硬套。
- 細節與可用圖示鍵清單見 `docs/設計風格指南.md` §3.1（圖示）、§3.2（版面寬度）、§3.3（滑桿元件）。

## 相關文件索引（細節在這裡）
- `docs/凌越-目前庫存-庫存管理.md`：庫存推送、停用過濾、內網代理。
- `docs/凌越-進銷交易查詢.md`：庫存頁點品項→近期進銷交易（銷貨A1出＋銷退A2入、方向/淨變動）；
  凌越 API 資料種類代碼＋欄位權威整理（**此 API 無進貨單**）。
- `docs/凌越回寫-工作交接.md`、`docs/凌越訂單回寫-串接說明.md`：訂單回寫規則（含 /wait vs /pending 教訓）。
- `docs/凌越串接-通用方法說明.md`：凌越 SOAP 查詢通用方法。
- 內網代理權威說明在「凌越整合代理」資料夾的 `規則與必備設定.md`（§9 庫存、含停用過濾）。
