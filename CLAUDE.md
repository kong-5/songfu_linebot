# CLAUDE.md — 松富物流 LINE Bot / 後台（給每個新對話先讀）

這份是「架構定案 + 不要再重複踩」的權威清單。**動到相關功能前先讀這份**；細節看 `docs/`。
最後更新：2026-08-30

---

## 專案一句話
松富物流的 LINE 叫貨機器人 ＋ 後台管理（Node/Express，`dist/` 為執行碼），串接凌越 ERP
（訂單回寫、庫存推送、LINE 盤點）。前台 LIFF 頁在 `dist/liff/`，後台在 `dist/admin/`。

## 開發守則（每次改動都要遵守）
1. **目標是內部系統的順手、省事、準確，不是產品化**——別為了通用性/擴充性加抽象層，
   解決眼前的實際問題優先。
2. **任何寫入資料的操作必須具備：交易原子性、冪等性**（重複執行不會產生重複資料）。
3. **所有資料異動要寫入稽核軌跡**（誰、何時、改了什麼、舊值新值）。
4. **錯誤訊息必須告訴使用者「怎麼修正」**，不能只說格式錯誤。
5. **單一檔案超過 1000 行要提出拆分建議**。admin 後台已拆八批（26 個域檔皆為
   `registerXxxRoutes(router, ctx)` move-only 模式，詳見 `docs/體質健檢-2026-07-27.md` §一）；
   index.js 20,461 → 4,712 行（剩登入/權限/版型/設計 token/共用 helper/各域註冊）。
   四組共用 ctx：**訂單三域 `ORDERS_CTX`**、**人員/公告/行事曆/報價 `ADMIN_MISC_CTX`**、
   **儀表板/分析/空籃/環境衛生 `ADMIN_VIEW_CTX`**、**機器端點/AI設定/匯入/匯出/待確認 `ADMIN_OPS_CTX`**。
   ⚠ `cash.js` 的註冊呼叫夾在凌越機器端點區間中間，**位置不可移動**（批次 2 定案）。
   `webhook/line.js` 已拆批次 9（2,796 → 1,998 行）：訂單寫入／Flex 組訊／意圖偵測／子客戶拆單
   四組 helper 抽到 `lib/line-*.js`，line.js 以原名解構回來所以呼叫處與 `_testables` 未改。
   ⚠ 收單狀態機（`collectingByGroup` 記憶體 session）**刻意未抽**，要動屬重構非搬移，請另案評估。
   ⚠ ctx 內若含 `const` 宣告的值，**註冊呼叫必須放在該宣告之後**，否則 createAdminRouter
   一執行就 TDZ 爆掉（批次 6 踩過；批次 7 已把肇事的報價 icon `QI` 提到 module 層根治）。
   `function` 宣告會提升不受影響。
   ⚠ 訂單路由在原檔不連續、批次 5 一次註冊改變了 router 順序——**已證明安全**（581 對翻轉、
   零對 pattern 可撞同一 URL）。日後在 orders.js 加新路由若含字面路徑（如 `/orders/batch-xxx`），
   要確認不會被 `/orders/:orderId` 系列吃掉；驗證工具見該文件 §四。
6. **每次改動要附帶對應的 smoke test**。
7. **改完跑 `npm run lint`＋`npm test`**——lint（eslint 正確性規則，~4 秒）已是 cloudbuild
   部署前硬閘門，dist 手改 JS 沒有編譯期檢查，打錯變數名 lint 才會當場抓到。
8. **SQL 一律可攜或 isPg 雙分支**：sqlForPg 對 SQLite 專屬語法（INSERT OR REPLACE/IGNORE、
   strftime、GROUP_CONCAT、datetime/date 任意形式、IFNULL、julianday、printf）與「字串常值內
   含 ?」一律 fail-fast 丟錯（不再默默送 PG 到雲端才 500）。datetime('now') 會自動轉換可放心用。

## 部署（重要）
- **推 `main` 就自動部署**：`cloudbuild.yaml` 由 `deploy-on-push` 觸發，建 image → 部署
  Cloud Run（`songfu-line-bot`, asia-east1），**保留環境變數**。
- **金絲雀兩段式（2026-07-29）**：deploy 帶 `--no-traffic --tag candidate` 先上線但**不導流** →
  對 candidate 專屬網址打 `/health`（6 次 × 10 秒）→ **過了才 `update-traffic` 100%**。
  健檢不過＝build 紅但**流量仍在舊版、線上不受影響**（舊版是先導流再健檢，壞版本已在服務客戶）。
  build `timeout: 1800s`（金絲雀多兩步，預設 10 分鐘會半途被砍）。
- ⚠ **`--max-instances=1` 已釘進 cloudbuild deploy 指令**：記憶體收單 session／告警去重／登入節流
  都靠單實例，這是**不變式**。別為了「效能」拿掉；每次部署都會把 Console 上被誤改的值校正回 1。
  執行期另有 `dist/lib/instance-guard.js`（心跳表 `app_instance_heartbeat`）偵測多實例並推 LINE 告警。
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
- **未來銷貨加回（2026-07-17；2026-07-30 改為進盤差）**：先打「明天以後」的銷貨單會即時扣 SK_NOWQTY →
  推送順帶查未來日期 A1−A2 逐料號淨量（payload `future_sales`，`LY_FUTURE_DAYS` 預設 60 天）存
  `erp_future_sales`（按公司覆蓋、查失敗不帶＝保留上一份）＋每日快照 `erp_future_daily`（同交易、留 90 天）。
  開關 `app_settings.stock_future_reversal_enabled`（目前庫存頁與每日盤點頁各一顆、共用同一設定）。
  **口徑：應有實體量＝凌越量＋未來銷貨（＋人工調整），盤差＝實盤−應有**——凌越欄位是「帳面可售量」、
  盤點量的是「架上實體量」，不加回會天天假盤盈（回報案例：豆薯 系統 64.4／實盤 92／假盤差 +27.6＝未來單 26.8）。
  權威 helper：`dist/lib/stock-future.js`（`futureReversalEnabled`／`makeFutureResolver`）。開關關＝完全回舊行為。
  - ⚠ **必凍結**：未來單隨日期滾動消失，`erp_future_sales` 只有現況一份。盤點送出時把**本倉分攤後**的未來量
    凍結進 `stocktake_count.future_qty`（伺服器端重算不吃前端值、**一律凍結不看開關**）；「最新/當日系統」側
    今天讀 `erp_future_sales`、**過去日期讀 `erp_future_daily`**（查無＝以 0 計並標示）。
    ⚠ `future_qty` **NULL ≠ 0**：NULL＝功能上線前送出、當時沒記錄 → 盤點當下側改用同一套 resolver 推估
    並標橘色「推估」（否則左半邊「應有＝系統」右半邊卻標「未來+68」自相矛盾）；統計圖表也吃同一套推估（見下）。
  - ⚠ **必分攤**：未來銷貨是公司層級（凌越明細沒帶出庫倉），盤點是分倉的 → 該倉走分倉基準時**只加該料號主倉**
    （分倉量最大者，**0/負庫存也算**——一個料號通常只放一倉，那一倉是負的正是最需要加回的情況），走公司總量基準時才用公司層級。逐倉相加剛好一次，統計跨倉加總不會雙倍。
  - **統計圖表（K線盤差線/熱力圖/改善檢視）同口徑**，且頁面工具列有**本頁專屬開關**（`?fut=0/1` 覆寫全域，
    只影響本頁圖表不改全域設定）。凍結值優先；**整組（料號,日期）都沒凍結值時退回推估**（同盤點頁），
    逐「組」補一次而非逐列（未來量是公司層級，逐列加會雙倍）；熱力圖 tooltip 會拆成 凌越帳→未來→應有。
  - 連帶：**「套用實盤」delta＝實盤−應有**（舊版會把未來量寫成永久 delta → 出貨後雙重補償）、
    盤點端（LIFF/掃碼/網頁版）items 帶 `f` 並顯示「帳 X 未來+Y」、統計圖表/熱力圖/改善檢視/異常排查表同口徑。
  - smoke test：`test/inventory-future-reversal.test.js`。只影響內部顯示與盤差，**不寫回凌越**。
  - 未做（要凌越端配合）：A1 明細 `SD_WHNO2`（出庫倉）帶出來就能真正分倉、免猜主倉；根治是未來日期改開
    訂單/預購單而非銷貨單。
- **依公司自主更新（2026-07-17）**：`stock/refresh` 可帶 `icpno`（旗標 `erp_stock_refresh_icpno`）→
  `inventory-wait` 回 `{refresh, icpno}` → 代理 `do_stock_push(icpno_override)` 只重推該公司。
  目前庫存頁按鈕＝當頁公司；每日盤點頁按鈕旁有公司下拉（預設全公司）。免改代理 LY_ICPNO 即可換公司更新。

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
- **掃碼頁已中越雙語（2026-07-21）**：與盤點頁**共用 `stk_lang`** localStorage 鍵（切一次兩頁同步），
  新增文案要同時補 scan.html I18N 的 zh/vi 兩組。草稿鍵：掃碼 `scan_draft_<icpno>_<倉>_<日期>`、
  盤點 `stk_draft_<icpno>_<倉>_<日期>`（**都含公司代碼**，跨公司同倉號才不互染）。

## LINE 盤點系統（已上線）
- **LIFF 盤點頁** `dist/liff/stocktake.html`（LIFF `2010106501-VocNwkbA`，端點 `/liff/stocktake`）：
  倉庫選擇→緊湊盤點清單→送出；白底、可隱藏0、**中／越雙語**、**續盤**（重開帶回今日已盤）。
  - **效期品**：由 `stocktake_expiry_item` 標記的品項才出現效期批號輸入。**此表已分公司**（主鍵 `(icpno, erp_code)`）；後台「庫存管理 → 效期品設定」(`/admin/inventory/expiry-items`) 可單筆或**整倉批次**帶入（例：松揚雜貨庫房）。
  - **網站版盤點入口** `/admin/inventory/entry`：後台帳號 cookie 登入、免 LINE token（解外部瀏覽器登入逾時），與 LIFF 頁共用 `stocktake.html`（`window.__STK_WEB__` 注入 WEB 模式），寫進同一套盤點表。
  - **「最新系統／對最新盤差」欄的基準（2026-07-26 定案）**：權威 helper＝`dist/admin/inventory.js` 的 `makeStockBasisResolver(date)`（每日盤點頁／CSV／異常排查表／「套用實盤」共用）。**今天＝即時快照**（`erp_stock_wh_qty`→`erp_stock_items`）；**過去日期＝該日收盤快照**（`erp_stock_wh_daily`→`erp_stock_daily`）＝**凍結**，表頭改標「當日系統（凍結）」＋「已凍結 <日期> 收盤」badge。舊版不分日期都讀即時快照，昨天以前的盤差每天跟著今天的庫存跑（歷史盤差永遠不定案，2026-07-26 回報修正）。該日沒推送→退回「該日以前最近一次」快照並標「（該日無推送）」；連歷史快照都沒有（>90 天保留期／功能上線前）→退回即時量並標「無當日快照・顯示即時量」。過去日期的未來銷貨改讀 `erp_future_daily` 當日快照（2026-07-30，見「未來銷貨加回」段）。smoke test：`test/inventory-latest-frozen.test.js`。
  - **庫存調整（誤差補償，免凌越重整）**：`stock_adjustment`（主鍵 `(icpno, erp_code)`、`delta`）。**顯示庫存＝凌越快照＋delta**（`/admin/inventory/stock`），每日盤點「最新系統／對最新盤差」也加 delta（校正後歸零）。每日盤點盤差表調整欄＝單一標籤（「調整」/「調 +N」）點開浮動面板（套用實盤/手動存值/刪除；2026-07-17 改版，實盤同時改成點數字原地複盤、列高一行），「套用實盤」＝`delta=實盤−當下顯示的應有量`（**基準與右側欄同一套 `makeStockBasisResolver`＋`makeFutureResolver`：分倉優先、過去日期用當日收盤、含未來銷貨加回**——舊版一律用即時總量，品項跨倉/他倉負庫存或看歷史日期時會算錯；2026-07-30 再補未來量，否則未來單會被寫成永久 delta 造成雙重補償）；總管理在「庫存管理 → 庫存調整」(`/admin/inventory/adjustments`) 可改/刪。庫存統計圖表（熱力圖/盤差折線/卡牆盤點點）的盤差％一律**含調整**（`statsAdjMap`）。**只影響內部顯示與盤差，不寫回凌越**；凌越重整後要記得刪調整避免雙重補償。
  - **中價貨**：盤點數旁的小「⋯」點開才填中貨（極少數品項才有，方案B）；**counted_qty 存上＋中合計**，`mid_qty` 單獨保留。
  - **每日快照**：由**庫存推送 `inventory-push` 同交易寫入 `erp_stock_daily`**（一天一份、留 90 天；含 K 線 OHLC 欄 `qty_open/qty_high/qty_low`——開＝當日首推時的昨收、高低＝當日各次推送極值、`qty`＝收）。帶 `warehouse_qty` 的推送同時寫**分倉每日快照 `erp_stock_wh_daily`**（同套 OHLC 規則）。供 K 線與歷史盤差凍結基準用。
  - ~~必盤~~（**已移除 2026-08-13**）：舊功能把「自昨天以來凌越有變動」的品項標紅置頂，現場回饋不需要且會誤導（打單/出貨造成的帳面變動不代表架上動過，紅標反而讓人以為要優先查、又打亂盤點順序）→ `dist/lib/stock-mustcount.js` 已刪、盤點清單不再標記排序；`app_settings.stocktake_mustcount_min_delta` 已無作用。**別再把它加回來**，除非現場主動要求。
- **庫存統計圖表** `/admin/inventory/stats`（盤點頁與側欄都有入口）：三欄式（日K/週K/月K＋期間｜倉庫｜品項模糊搜尋）看單品 K 線＋盤差％折線；另一檢視＝**盤差熱力圖**（品項×日期、紅虧藍盈、預設只列有盤差品項 Top 20 依嚴重度排序）＋排行＋點格下鑽。資料 API：`/stats/items`、`/stats/kline`、`/stats/heatmap`。盤差＝盤點凍結當下（`counted−sys`，`sys` 是送出當下寫進 `stocktake_count` 的凍結值，**不受「最新系統」欄影響**；分母 `max(|sys|,1)`），「當日最後」由一倉一日一筆天然成立、換日即定案，**免結算排程**；分倉 K 線在 `erp_stock_wh_daily` 無資料時自動退回公司層級並標示。
  - **紅標規則（可調門檻，2026-07-30）**：整列紅底／「只看紅標」篩選／異常排查表**共用同一條規則**——
    `|盤差%| ≥ stocktake_hot_pct`（預設 5）**且** `|盤差量| ≥ stocktake_hot_qty`（預設 0＝不限），兩者都成立才算。
    權威 helper＝`dist/admin/inventory.js` 的 `loadHotRule()`／`isHotDiff(rule, diff, base)`。
    每日盤點頁工具列「紅標規則」標籤點開即可改（POST `/inventory/hot-rule`，全域設定＋稽核軌跡）。
    ⚠ **兩段式是刻意的**：只看 % → 小量品項（帳 0.5 差 0.5＝100%）整片紅；只看量 → 大品項差 1 也紅。
    回報案例：81 項全紅沒辦法 focus。**異常排查表只推紅標品項**（未達門檻的會標「另有 N 項未達門檻」不默默吃掉），
    盤差改善檢視的「嚴重品項數」也吃同一個 pct。
  - **盤差改善檢視（2026-07-21）**：同頁第三個檢視（`#ivsView` data-v=`improve`），回答「盤差有沒有隨排查變好」。品項再多也只彙總成**計分卡（本週vs上週：準確率／平均・加權絕對盤差%／嚴重品項數）＋每日趨勢折線（準確率、盤差幅度）＋進步榜/待改善榜**，不逐項畫。資料 API：`/stats/improvement?icpno=&days=`（口徑同熱力圖：含庫存調整、同日同料號跨倉先加總；計分卡以有資料的最後一天為錨 pool 近7天/前7天；排行＝品項前半段 vs 後半段平均 |盤差%|）。smoke test：`test/inventory-improvement.test.js`。
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
- **盤點結果圖（JPG，2026-08-03）**：盤完產一張圖，**盤點的人自己傳到群組——刻意不推播**。
  推群組是**按群組人數**計則數（8 人群組推一次＝8 則），每天每倉推一次很快吃掉方案額度；產圖＝零則數。
  送出成功畫面有「產生結果圖」→ 圖＋「傳到 LINE 群組」（Web Share API，`navigator.canShare({files})`
  才顯示，LINE 內建瀏覽器不一定支援）／「儲存到手機」（`<a download>`＋長按存圖提示）。
  **忘了傳可回頭重下載**：盤點頁與掃碼頁的倉庫清單「今日已盤 · 結果圖」徽章可點、後台每日盤點卡片有「結果圖」。
  - 權威 helper：`dist/lib/stocktake-report.js`（資料）＋`dist/lib/stocktake-report-image.js`（SVG→sharp→JPG）。
    紅標判定抽到 `dist/lib/stocktake-hot-rule.js`（與每日盤點頁共用同一份門檻）。
  - 端點：`/liff/api/stocktake/report.jpg`（LIFF token）、`/admin/inventory/report.jpg`
    ＋`/admin/inventory/entry/report.jpg`＋`/admin/scan/report.jpg`（後台 cookie）。
    ⚠ **不做免登入公開網址**——圖上有整倉庫存量；公開 token 網址只有推播才需要（LINE 伺服器要抓圖）。
  - 口徑＝**盤點送出當下的凍結值**（`sys_qty`/`future_qty`/`counted_qty`），不是「最新系統」欄——
    圖是當下的憑證，隔天重下載數字不該變。**即時重算不存檔**，複盤改過實盤數重新產生就是最新的。
  - **版面是條列不是表格**：盤差逐項展開（紅標最前、標「要查」）、未盤只列品名、相符壓成
    「品名 數量」段落、帳 0 收一行字；**長期無貨整段不列**（`idle`＝帳 0＋現場 0＋近 60 天
    `erp_stock_daily` 都沒量，天數 `app_settings.stocktake_report_idle_days`，0＝關閉），頁尾記
    「另有 N 項長期無貨未列」不默默吃掉。查無快照一律不判 idle。內容長自動分頁（單頁 ≤4096px）。
  - smoke test：`test/stocktake-report.test.js`、`test/stocktake-report-image.test.js`。
- **異常排查表** `/admin/inventory/anomalies`（每日盤點頁入口）：當日「對最新盤差≠0」品項＋依訊號自動列**可能原因**（盤差方向→進貨未入/銷貨未開等、跨倉持有、他倉負庫存、已掛調整），勾選後推送 LINE 群組請大家複查（群組清單＝`stocktake_group`，記住上次選擇 `app_settings.stocktake_anomaly_group_id`）；純提示不寫帳。
- 資料表：`stocktake_session`（一倉一日一筆）、`stocktake_count`（逐品項，含 `mid_qty`）、
  `erp_warehouse`（倉號→中文名＋納入盤點）、`group_features`（群組三功能開關）、`stocktake_group`（舊白名單／探索來源）、`stocktake_expiry_item`。

## ⛔ 訂單辨識已全域停用（2026-08-27）
現場已改以**盤點**為主，訂單辨識沒人在用，卻每則群組訊息都要送 Gemini／OCR＝**AI 費用大宗**。
- **總開關＝既有的 `app_settings.line_bot_mode`**（後台 系統設定 → LINE 機器人 → 運作模式）。
  值 `always_off` ＝停用；`always_on` ＝恢復；`scheduled` ＝依時段。權威判斷＝
  `dist/lib/line-bot-control.js` 的 `isBotAcceptingOrders()`，閘門在 `webhook/line.js`（`accepting`）。
  **不要再加第二個「訂單辨識」開關**——兩個重疊開關日後一定會出現「關了還在跑／開了沒反應」。
- **停用範圍只有訂單**：閘門位置在 `#盤點`／空籃／`取得群組ID`／員工綁定等指令**之後**，
  所以機器人仍待在群組、仍照常回應這些指令，只是不再把一般文字/照片送 AI 解析成訂單。
  副作用一項：未綁定群組不再自動登錄「待綁定清單」（加入群組事件仍會登錄）。
- **一次性遷移**（`dist/db/index.js`，SQLite/PG 各一份）把 `line_bot_mode` 設成 `always_off`，
  靠 marker 鍵 `order_recognition_off_migrated_20260827` **只做一次**——使用者日後在後台改回
  「一律開啟」後，之後每次部署都不會再被蓋回關閉。**別移除 marker 判斷。**
- 恢復方式：後台改「一律開啟」→ 儲存，**立即生效、免部署**。
- smoke test：`test/line-order-recognition-off.test.js`（含「AI 解析一定在閘門之後、盤點/空籃一定在之前」的順序不變式）。

## ⛔ 取銷貨單／每日帳款收款已停用（2026-08-30）
現場沒人在用，但這條線每天把凌越當日銷貨單（客戶、金額、未收）**整份推上雲端保存**＝白留一份
高完整度營業資料在外面 → 整條線關掉。
- **總開關＝`app_settings.cash_sales_enabled`**（後台 系統設定 → 每日帳款收款，**經理限定**）。
  **未設定＝停用**（fail-closed）——所以**不需要一次性遷移**、也不會被下次部署蓋回去；
  按過「啟用」寫進 `1` 就一直是開的。權威 helper＝`dist/lib/cash-feature.js` 的 `cashFeatureEnabled()`。
  **不要再加第二個開關**（兩個重疊開關一定會出現「關了還在跑／開了沒反應」）。
- **閘門三處**：① 後台所有 `/cash*` 路由共用的 `requireCash`（cash.js，先權限後開關）；
  ② 機器端點 `cash-ingest`（關著＝整包丟掉、一列不寫）、`cash-refresh-wait`（不 hold 長連線、
  不收「重新取單」）、`cash-refresh-report`（不記狀態、不發告警）——都**回 200 `{disabled:true}`**，
  代理拿到會安靜停下，不重試也不告警；③ 側欄「收款作業」群組隱藏（`res.locals.cashEnabled`）。
  ⚠ **`/cash/feature`（開關頁本身）刻意不走 `requireCash`**，否則關掉就沒有入口開回來。
- **內網代理**：`ly_agent_gui.py` 的 `sales_auto` 預設改 `False`；雲端回 `disabled` 時設旗標
  「不撈凌越、每 5 分鐘回探一次」，後台開回來會自動恢復（`ly_sales_push.CashFeatureDisabled`）。
  ⚠ 已安裝的機器 config 檔已存 `sales_auto: true`，**實際靠雲端閘門擋**；要徹底停就到 GUI ⚙ 取消勾選。
- **既有資料保留**（使用者決定）：`cash_sales_doc`／`cash_customer`／`cash_payment*`／`cash_check`／
  `cash_extra_income` 一列都沒刪，重新啟用完全接得回去。要清資料是另一件事，別順手做。
- 恢復方式：後台「系統設定 → 每日帳款收款」按啟用 → 立即生效、免部署。
- smoke test：`test/cash-sales-off.test.js`（含「開關頁不得掛 requireCash」「機器端點閘門在寫入之前」
  等不變式）。

## LINE 收單可靠性（2026-07-21 定案）
- **失敗可重試閉環**：`processLineWebhookEvents` 回傳 `{failed,total}`；Cloud Tasks worker
  （`/api/worker/process-line-event`）失敗回 **500** 讓佇列重試，`X-CloudTasks-TaskRetryCount`
  超過 `LINE_TASK_MAX_RETRY`（env，預設 4）即放棄回 200 ＋ ops 告警（`ops_alert_group_id`）。
- **入口去重 dupByOrder 不再無條件擋**：已有訂單帶該 message id 但 `processed_line_messages`
  無 done 標記＝前次半途失敗 → 放行並標 `lineMessageIsRetry` 走全冪等重跑路徑
  （append raw skipIfPresent、品項 src_line_message_id 預檢、附件查重）。**改動去重邏輯前先讀這段。**
- **PG advisory xact lock**（`DATABASE_URL` 才啟用，交易結束自動釋放）：rebuild 以
  `rebuild|orderId`、盤點 submit 以 `stk|icpno|倉|日` 串行化——多實例/併發不再品項雙倍或互洗盤點。
  記憶體 collect session 仍是單實例設計，Cloud Run **max-instances=1 維持**。
- **rebuild 去重的加叫保護**：原文有「一模一樣的重複行」且**純文字無附件**時跳過
  `dedupeParsedOrderRows`（同名同量分次加叫是合法的）；有附件一律去重（文字＋拍照雙重解析
  不可變雙倍）。`parseOrderMessage` 的 `keepDuplicateRows` 選項即為此用。
- 作廢/客訴單：`rebuildOrderItemsFromOrderSources` 入口早退＋交易內覆檢，一律不重建品項。

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
