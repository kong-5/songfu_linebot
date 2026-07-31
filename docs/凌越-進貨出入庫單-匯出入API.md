# 凌越 ERP — 進貨／進貨退回／入庫／出庫單 匯出入 API（WCF）

> 來源：凌越 2026-07 提供之壓縮包（`搭配WCF模式-資料匯出入處理說明.pdf` ＋ 檔案清單 8 份欄位定義 doc）。
> 本文為其完整整理，是接「進貨單 0000AO／進貨退回單 0000AP／入庫單 0000B6／出庫單 0000B7」的**權威欄位文件**。
> ⚠ **這份新版 API 已支援進貨與出入庫單**——舊結論「凌越 API 沒有進貨單、庫存進出只能靠銷貨+銷退」
> （`docs/凌越串接-通用方法說明.md` §3、`docs/凌越-進銷交易查詢.md`）自此**作廢**，以本文為準。
> 通用串接步驟（兩段式架構、金鑰、bridge 四模式）仍照 `docs/凌越串接-通用方法說明.md`。
> 最後更新：2026-07-31

---

## 0. 一句話

凌越 WCF 匯出入元件共五個函式：**LyGetPassKey 取金鑰 → LyDataIn 寫入／LyDataOut 讀出（LyDataPage 翻頁）／LyDataDel 刪除**。
資料一律是 XML（欄位名全大寫），單據類都是「抬頭 `LYDATATITLE` ＋ 明細 `LYDATADETAIL`」兩層。
本文四種單別的抬頭欄位前綴都是 `SP_`、明細都是 `SD_`（與銷貨單 0000A1 同一套命名）。

**API 主機基本需求**（凌越端）：Windows Server 2012+、IIS8+、實體固定 IP。

---

## 1. WCF 五函式總覽

### 1.1 LyGetPassKey — 取得金鑰

| 傳入參數 | 說明 |
|---|---|
| `pusid` | 帳號（需有「匯出入元件」執行權限） |
| `pverifykey` | 密碼 |

回傳：成功＝金鑰字串；`<0` 失敗（`-1` SQL 連接失敗、`-2` 帳號不存在、`-3` 密碼不符、`-4` 帳號存在沒有權限）。

⚠ **金鑰 30 秒失效**（LyDataIn 回 `-3`）——每次呼叫前現取，不要快取。

### 1.2 LyDataIn — 轉入（寫入）資料

| 傳入參數 | 說明 |
|---|---|
| `ireno` | 回傳存檔成功主鍵編號（**單據以 `@#1#@` ＋編號區隔；基本資料以 `chr(1)`＋編號區隔**） |
| `ikye` | 金鑰字串 |
| `icpno` | 公司代號（00 松富／01 龍港／02 松揚／03 松成） |
| `idakd` | 資料種類（見 §2） |
| `irset` | 寫入內容 XML。**文字或備用欄建議用 CDATA** 包，例：`<ct_rem><![CDATA[hello~~]]></ct_rem>` |
| `imode` | 參數設定，**留 30 BYTES**，依資料種類逐位置定義（見 §4） |
| `ichkmuno` / `ichkmode` | 預留，傳空白 |

回傳：`0` 成功；`-1` SQL 連接失敗、`-2` 寫入失敗、`-3` 金鑰失效（超過 30 秒）、`-4` 金鑰不合法、
`-5` 無權限、`-7` lydatatemp 檔不存在、`-8` 系統在做重整、`-9` 元件與 AP 版本不符。

### 1.3 LyDataOut — 轉出（讀取）資料

| 傳入參數 | 說明 |
|---|---|
| `ixmlda` | 轉出的 XML 字串（`irec>0` 分頁時固定回傳**第一頁**） |
| `itmpnm` | 傳回分頁暫存檔名（給 LyDataPage 用） |
| `itotrec` | 傳回總筆數 |
| `ikye` / `icpno` / `idakd` | 金鑰／公司代號／資料種類（見 §2） |
| `ifld` | 轉出「抬頭／基本資料」欄位清單（**傳空白＝全部欄位**） |
| `idetfields` | 轉出「明細」欄位清單（傳空白＝全部欄位） |
| `irwhere` | 過濾式欄位，佔位符寫法：`no='@v1@' and name='@v2@'` |
| `iwhval` | 過濾式值，2 個以上用 `@#1#@` 連接，例：`A01 @#1#@ A02` |
| `irec` | 每頁筆數：`0`＝不分頁、`>0`＝每頁筆數 |
| `imode` | 同 LyDataIn，留 30 BYTES（見 §4） |
| `iorder` / `idtorder` | 抬頭／明細排序，**需完整語法**，例：`order by ct_no`、`order by sd_skno` |
| `iswhere`/`isifld`/`Isecgroup`/`iseckindfg`/`iseckind`/`Isecorder`/`Isecrec` | 預留，傳空白 |

回傳：`0` 成功；`-1` SQL 連接失敗、`-2` 讀取失敗、`-3` 金鑰失效、`-4` 金鑰不合法、`-5` 無權限、`-7` lydatatemp 檔不存在。

### 1.4 LyDataPage — 分頁讀取／清暫存

| 傳入參數 | 說明 |
|---|---|
| `ixmlda` | 轉出的 XML 字串（回傳） |
| `ikye` / `Icpno` / `idakd` | 同上 |
| `Itykd` | 模式：`0`＝讀取、`1`＝**刪除暫存檔**（讀完記得清） |
| `itmpnm` | 分頁暫存檔名（LyDataOut 回傳的） |
| `ipageno` | 第幾頁（`itykd=1` 時固定傳 0） |

回傳：`0` 成功；`-1` SQL 連接失敗、`-2` 暫存檔不存在、`-3` 金鑰失效、`-4` 金鑰不合法。

### 1.5 LyDataDel — 刪除資料

| 傳入參數 | 說明 |
|---|---|
| `ikye` / `icpno` / `idakd` | 同上（idakd 僅支援單據類：A0/A1/A2/AO/AP/B6/B7） |
| `ino` | 主鍵（單號）。**多筆用 `@#1#@` 隔開；主鍵雙欄位以上，欄位間用 `@#2#@` 隔開** |
| `imode` | 同上（見 §4） |
| `ichkmuno` | 預留，傳空白 |

回傳：**`null`＝成功**（注意不是 0）；`-1` SQL 連接失敗、`-2` 寫入失敗、`-3` 金鑰失效、`-4` 金鑰不合法、`-5` 此檔不可刪除。

---

## 2. 資料種類代碼（idakd）

轉入與轉出的代碼**不完全對稱**（客戶／廠商主檔兩邊代碼不同）：

| 代碼 | 種類 | LyDataIn 轉入 | LyDataOut 轉出 | LyDataDel |
|---|---|:---:|:---:|:---:|
| `000000` | 貨品基本資料 | ✔ | ✔ | |
| `000001` | 客戶基本資料 | ✔ | | |
| `000002` | 廠商基本資料 | ✔ | | |
| `000004` | 倉庫基本資料 | ✔ | ✔ | |
| `000009` | 目前庫存（廠內倉） | | ✔ | |
| `00000D` | 客戶基本資料 | | ✔ | |
| `00000E` | 廠商基本資料 | | ✔ | |
| `00000P` | 聯絡人清單 | ✔ | ✔ | |
| `0000A0` | 訂貨單 | ✔ | ✔ | ✔ |
| `0000A1` | 銷貨單 | ✔ | ✔ | ✔ |
| `0000A2` | 銷貨退回單 | ✔ | ✔ | ✔ |
| **`0000AO`** | **進貨單** | ✔ | ✔ | ✔ |
| **`0000AP`** | **進貨退回單** | ✔ | ✔ | ✔ |
| **`0000B6`** | **入庫單** | ✔ | ✔ | ✔ |
| **`0000B7`** | **出庫單** | ✔ | ✔ | ✔ |

⚠ 代碼是**字母 O 不是數字 0**：`0000AO`（進貨）／`0000A0`（訂貨）長得幾乎一樣，串接時務必用常數，不要手打。

---

## 3. XML 格式（轉入／轉出通用）

- 欄位名稱**皆使用英文大寫**。
- 根節點 `DocumentElement`；抬頭一張單一個 `<LYDATATITLE>`；明細一列一個 `<LYDATADETAIL>`，可多張單多列連續排。
- 明細列靠「單號＋明細序號」歸戶到抬頭（本文四單別即 `SD_NO` ＋ `SD_SEQ`）。
- 文字欄（備註、備用欄）用 CDATA 包，避免特殊字元解譯錯誤。

單據轉入範例骨架（以進貨單 0000AO 為例）：

```xml
<?xml version="1.0" standalone="yes"?>
<DocumentElement>
  <LYDATATITLE>
    <SP_DATE>2026/07/31</SP_DATE>
    <SP_NO>PO20260731001</SP_NO>
    <SP_CTNO>廠商編號</SP_CTNO>
    <SP_QKCUST>請款對象</SP_QKCUST>
    <SP_REM><![CDATA[備註文字]]></SP_REM>
  </LYDATATITLE>
  <LYDATADETAIL>
    <SD_DATE>2026/07/31</SD_DATE>
    <SD_NO>PO20260731001</SD_NO>
    <SD_CTNO>廠商編號</SD_CTNO>
    <SD_SKNO>貨品編號</SD_SKNO>
    <SD_QTY>10</SD_QTY>
    <SD_SEQ>1</SD_SEQ>
  </LYDATADETAIL>
</DocumentElement>
```

---

## 4. imode 參數（30 bytes，逐位置）

`imode` 是 30 個字元的字串，每個位置一個旗標，**依「轉入／轉出／刪除」與資料種類**各自解讀。
四種單別（AO/AP/B6/B7）的定義大致相同，差異在第 9～14 位（下表逐一標明）。未列位置＝內定 0。

| 位 | 轉入 | 轉出 | 刪除 |
|---|---|---|---|
| 1 | **單號處理方式**：`0`＝單號已存在跳過不存檔、`1`＝已存在覆蓋(UPDATE)、`2`＝已存在按系統編碼重新新增／不存在以目前單號存檔、`3`＝不檢查、直接按系統編碼格式重編單號 | 檢查層級權限（`1` 檢查／`0` 不檢查） | 檢查層級權限（同左） |
| 2 | 檢查新增權限（`1`/`0`） | 檢查查詢權限（`1`/`0`） | 檢查刪除權限（`1`/`0`） |
| 3 | 新增時單號**非空且不存在**時：`0`＝按轉入 xml 編號、`1`＝固定按系統內單據編碼格式 | | |
| 4 | 倉庫依部門對應倉庫轉入（`0` 否／`1` 是，內定 0） | | |
| 5–7 | 內定 0 | | |
| 8 | **反推單價帶出含營業稅**：`0`＝依 `SP_TAXKIND` 決定內含/外加/不計算、`1`＝依 xml 值傳入**不再重新計算稅金及單價**（此時 `SP_TAX`/`SD_TAX` 必填） | | |
| 9 | **僅 AO**：轉入時客戶(廠商)編號不存在基本資料是否回填基本資料：`0` 回填／`1` 不回填，**內定 1**。AP/B6/B7 固定填 0 | | |
| 10 | **僅 B6/B7**：轉入二聯式發票多張處理：`0` 使用彙加註記／`1` 不使用，內定 1。AO/AP 固定填 0 | | |
| 11 | 內定 0（AO/AP 固定填 0） | | |
| 12 | **僅 B6/B7**：轉入單據要過帳：`0` 不過帳／`1` 要過帳，**內定 1**。AO/AP 固定填 0 | | |
| 13 | **僅 B6/B7**：轉入銷貨單時一併產生發票（`0` 否／`1` 是，內定 0）。AO/AP 固定填 0 | | |
| 14 | **僅 B6/B7**：轉入為電子發票時，產生已上傳的電子發票（`0` 否／`1` 是，內定 0）。AO/AP 固定填 0 | | |
| 15 | 內定 0（AO/AP 固定填 0） | | |
| 16 | 搭配電子簽核：`0` 是（跟進銷存參數同步）／`1` 否，內定 0 | | |
| 17 | 轉入時匯率抓取方式：`0` 依 xml、`1` 海關、`2` 台灣銀行，內定 0 | | |

實務建議（比照訂單回寫既有做法）：位 1 用 `0`（已存在就跳過＝天然冪等）或空單號＋位 3 讓凌越自動編號；權限檢查位全帶 `0`。

---

## 5. `0000AO` 進貨單

### 5.1 抬頭（LYDATATITLE，前綴 `SP_`）

**必填：`SP_DATE`、`SP_NO`、`SP_CTNO`、`SP_QKCUST`**（`SP_TAX` 在 imode 第 8 位＝1 時必填）。

| # | 欄位 | 型態/長度 | 中文名稱 | 必填 | 選項／註解 |
|---|---|---|---|:---:|---|
| 1 | `SP_DATE` | datetime | 貨單日期 | Y | |
| 2 | `SP_NO` | nvarchar 22 | 單據編號 | Y | |
| 3 | `SP_ORDNO` | nvarchar 22 | 採購單號 | | |
| 4 | `SP_CTNO` | nvarchar 10 | 廠商編號 | Y | |
| 5 | `SP_CTNAME` | nvarchar 60 | 廠商名稱 | | |
| 6 | `SP_CTADD2` | nvarchar 250 | 送貨地址 | | |
| 7 | `SP_SALES` | nvarchar 40 | 業務員 | | |
| 8 | `SP_DPNO` | nvarchar 8 | 部門編號 | | |
| 9 | `SP_MAKER` | nvarchar 40 | 制單人員 | | |
| 10 | `SP_RATE_NM` | nvarchar 10 | 幣別代號 | | |
| 11 | `SP_RATE` | float | 匯率 | | 基本幣固定為 1 |
| 12 | `SP_TOT` | float | 合計金額(原) | | |
| 13 | `SP_TAX` | float | 營業稅(原) | △ | imode 第 8 位傳 1 時必填 |
| 14 | `SP_DIS` | float | 折讓金額(原) | | |
| 15 | `SP_PAY` | float | 已收付金額(原) | | |
| 16 | `SP_CASH` | float | 現收金額(原) | | |
| 17 | `SP_ACSPNO` | nvarchar 22 | 傳票編號 | | 只供轉出查詢條件，轉入不需傳 |
| 18 | `SP_TAXKIND` | float | 稅額計算方法 | | `1` 內含／`2` 外加／`3` 無稅 |
| 19 | `SP_INVOICE` | nvarchar 255 | 發票號碼 | | |
| 20 | `SP_CHECKER` | nvarchar 40 | 確認人 | | 只供轉出查詢條件 |
| 21 | `SP_CHECK` | bit | 是否確認 | | `0` 未確認／`1` 已確認；只供轉出查詢條件 |
| 22 | `SP_CHKDATE` | datetime | 確認日期 | | 只供轉出查詢條件 |
| 23 | `SP_REM` | ntext | 備註 | | 建議 CDATA |
| 24 | `SP_CASENO` | nvarchar 20 | case 代號 | | |
| 25 | `SP_MSTNO` | nvarchar 10 | 業務組別編號 | | |
| 26 | `SP_NOPAY` | nvarchar 1 | 立帳方式 | | `1` 立帳／`2` 不立帳／`3` 開立發票立帳 |
| 27–28 | `SP_BY1`～`SP_BY2` | nvarchar 100 | 備用一D～二D | | |
| 29 | `SP_QKDATE` | datetime | 請款日期 | | |
| 30 | `SP_ZSCUST` | nvarchar 10 | 指送對象 | | |
| 31 | `SP_FKFS` | nvarchar 100 | 收/付款方式 | | |
| 32 | `SP_PH` | nvarchar 30 | 批號編號 | | |
| 33 | `SP_PHNAME` | nvarchar 60 | 批號名稱 | | |
| 34 | `SP_CONTACT` | nvarchar 40 | 聯絡人 | | |
| 35 | `SP_QKCUST` | nvarchar 30 | 請款對象 | **Y** | |
| 36 | `SP_ADDTOT` | float | 加項金額 | | |
| 37 | `SP_SUTOT` | float | 減項金額 | | |
| 38 | `SP_ISTOTAL` | float | 發票金額 | | |
| 39 | `SP_CASE` | nvarchar 8 | 專案代號D | | |
| 40 | `SP_EXDATE` | datetime | 預計收付款日 | | |
| 41 | `SP_TAXRATE` | float | 稅率% | | |
| 42 | `SP_CHECK2` | bit | 是否審核 | | `0` 未審核／`1` 已審核；只供轉出查詢條件 |
| 43 | `SP_CHECKER2` | nvarchar 10 | 審核人 | | 只供轉出查詢條件 |
| 44 | `SP_CHKDATE2` | datetime | 審核日期 | | 只供轉出查詢條件 |
| 45 | `IN_EINVKD` | nvarchar 2 | 電子發票類別 | | `01` 三聯式／`02` 二聯式／`03` 二聯式收銀機／`04` 特種稅額／`05` 電子計算機／`06` 三聯式收銀機 |
| 46 | `IN_EINMOD` | nvarchar 1 | 發票開立模式 | | `0` 紙本／`1` B2B／`2` B2C |
| 47 | `IN_DONATE` | nvarchar 1 | 是否捐贈 | | `0` 非捐贈／`1` 捐贈 |
| 48 | `IN_CARRERTYPE` | nvarchar 6 | 載具類別碼 | | `3J0002` 手機條碼／`CQ0001` 自然人憑證 |
| 49 | `IN_CARRIERID` | nvarchar 64 | 載具號碼 | | |
| 50 | `IN_NPOBAN` | nvarchar 10 | 愛心碼 | | |
| 51 | `IN_RANNO` | nvarchar 4 | 發票防偽隨機碼 | | |
| 52 | `IN_B2B_FG` | nvarchar 1 | 檔案類型 | | |
| 53–60 | `SP_BY3`～`SP_BY10` | nvarchar 100 | 備用三D～十D | | |
| 61 | `SP_CREATEDATE` | datetime | 建檔日期 | | 2025.03.01 新增；系統自動填，**不用匯入** |
| 62 | `SP_CREATENAME` | nvarchar 40 | 建檔人員 | | 同上 |
| 63 | `SP_MODIFYDATE` | datetime | 修改日期 | | 同上 |
| 64 | `SP_MODIFYNAME` | nvarchar 40 | 修改人員 | | 同上 |

### 5.2 明細（LYDATADETAIL，前綴 `SD_`）

**必填：`SD_DATE`、`SD_NO`、`SD_CTNO`、`SD_SKNO`、`SD_SEQ`**（`SD_TAX` 隨 imode 第 8 位；`SD_ORDNO` 有值時 `SD_SEQFLD` 必填）。

| # | 欄位 | 型態/長度 | 中文名稱 | 必填 | 選項／註解 |
|---|---|---|---|:---:|---|
| 1 | `SD_DATE` | datetime | 貨單日期 | Y | |
| 2 | `SD_NO` | nvarchar 22 | 貨單編號 | Y | ＝抬頭 `SP_NO` |
| 3 | `SD_CTNO` | nvarchar 10 | 客戶\|廠商編號 | Y | |
| 4 | `SD_SKNO` | nvarchar 30 | 貨品編號 | Y | |
| 5 | `SD_NAME` | nvarchar 60 | 品名 | | |
| 6 | `SD_CJNAME` | nvarchar 60 | 材積 | | |
| 7 | `SD_SPEC` | ntext | 規格 | | |
| 8 | `SD_UNIT` | nvarchar 8 | 單位 | | |
| 9 | `SD_WHNO` | nvarchar 10 | 倉庫(入) | | 凌越倉號（如 FN005/Y99） |
| 10 | `SD_QTY` | float | 驗收數量 | | |
| 11 | `SD_PRICE` | float | 單價 | | 留空＝讓凌越自動帶價；送 0＝強制 0（見通用方法說明坑 2） |
| 12 | `SD_PDIS` | float | 折扣金額 | | |
| 13 | `SD_DIS` | float | 折數 | | |
| 14 | `SD_STOT` | float | 小計 | | |
| 15 | `SD_TAX` | float | 稅額 | △ | imode 第 8 位傳 1 時必填 |
| 16 | `SD_UNIT_FG` | bit | 單位旗標 | | `F` 基本單位／`T` 輔助單位（原文如此；AP/B7 寫 0/1，見 §9） |
| 17 | `SD_RQTY` | float | 輔助數量 | | |
| 18 | `SD_REM` | ntext | 貨品附註 | | 建議 CDATA |
| 19 | `SD_CSNO` | nvarchar 20 | 促銷方案代號 | | |
| 20 | `SD_CSREC` | int | 促銷方案明細代碼 | | |
| 21 | `SD_SENDFG` | bit | 是否為贈品 | | `1` 贈品／`0` 非贈品 |
| 22 | `SD_PH` | nvarchar 30 | 批號編號 | | |
| 23 | `SD_PHNAME` | nvarchar 60 | 批號名稱 | | |
| 24–25 | `SD_BY1`～`SD_BY2` | nvarchar 60 | 備用1～2 | | |
| 26–27 | `SD_BYSZ1`～`SD_BYSZ2` | float | 備用數字欄位1～2 | | |
| 28 | `SD_WEIGHT` | float | 重量 | | |
| 29 | `SD_CJSUM` | float | 材積值 | | |
| 30 | `SD_YSNUM` | float | 收貨數量 | | |
| 31 | `SD_CHECKQTY` | nvarchar 1 | 驗貨方式 | | `0` 免驗／`1` 抽驗／`2` 全檢 |
| 32 | `SD_CHECKOK` | nvarchar 1 | 驗收狀態 | | `0` 免驗／`1` 待驗／`2` 合格允收／`3` 不合格拒收 |
| 33 | `SD_CHECKER` | nvarchar 40 | 驗貨人員 | | 原文另註「寄售進貨單單號」（雙用途） |
| 34 | `SD_CHECKFQTY` | float | 抽驗數量 | | 原文另註「寄售進貨單明細序號」（雙用途） |
| 35 | `SD_CHECKDATE` | datetime | 驗貨日期 | | |
| 36 | `SD_CHECKNOQTY` | float | 不良數量 | | |
| 37 | `SD_CHECKREADE` | ntext | 檢驗說明 | | |
| 38 | `SD_WHNO_FG` | int | 寄庫否 | | `0` 非寄庫／`1` 寄庫 |
| 39 | `SD_CASE` | nvarchar 8 | 專案代號 | | |
| 40 | `SD_TAXKD` | nvarchar 10 | 計稅別 | | `1` 應稅／`2` 免稅 |
| 41 | `SD_TAXRATE` | float | 稅率% | | |
| 42 | `SD_EQUKIND` | nvarchar 4 | 配件類別 | | `0` 主件／`1` 標準配件／`2` 選購配件／`3` 贈品配件 |
| 43 | `SD_EQUID` | int | 主件序號 | | |
| 44 | `SD_COVER` | bit | 說明 | | `0` 非說明／`1` 說明 |
| 45 | `SD_PRICEFG` | nvarchar 1 | 計價種類 | | `0` 數量／`1` 重量 |
| 46 | `SD_BACKFG` | nvarchar 1 | 驗退狀態 | | `0` 未退回／`1` 已退回 |
| 47 | `SD_ORDNO` | nvarchar 22 | 採購編號 | | |
| 48 | `SD_SEQFLD` | int | 採購單明細序號 | △ | `SD_ORDNO` 有值時必填 |
| 49 | `SD_SEQ` | int | 明細序號 | Y | |
| 50–57 | `SD_BY3`～`SD_BY10` | nvarchar 100 | 備用三T～十T | | |
| 58 | `SD_BDATE` | datetime | 批號有效開始日 | | |
| 59 | `SD_EDATE` | datetime | 批號有效結束日 | | |

---

## 6. `0000AP` 進貨退回單

### 6.1 抬頭（前綴 `SP_`）

結構與進貨單 0000AO 抬頭**幾乎相同**，差異只有：

- 多一欄 **`SP_SNO` nvarchar 22「進貨單號」**（第 4 欄，指回原進貨單）。
- **沒有** AO 的電子發票欄位群（`IN_EINVKD`～`IN_B2B_FG`）與 `SP_BY3`～`SP_BY10`。
- **必填同 AO：`SP_DATE`、`SP_NO`、`SP_CTNO`、`SP_QKCUST`**；`SP_TAX` 隨 imode 第 8 位。
- 其餘欄位（`SP_ORDNO`/`SP_CTNAME`/`SP_CTADD2`/`SP_SALES`/`SP_DPNO`/`SP_MAKER`/`SP_RATE_NM`/`SP_RATE`/
  `SP_TOT`/`SP_TAX`/`SP_DIS`/`SP_PAY`/`SP_CASH`/`SP_ACSPNO`/`SP_TAXKIND`/`SP_INVOICE`/
  `SP_CHECKER`/`SP_CHECK`/`SP_CHKDATE`/`SP_REM`/`SP_CASENO`/`SP_MSTNO`/`SP_NOPAY`/`SP_BY1`/`SP_BY2`/
  `SP_QKDATE`/`SP_ZSCUST`/`SP_FKFS`/`SP_PH`/`SP_PHNAME`/`SP_CONTACT`/`SP_QKCUST`/`SP_ADDTOT`/`SP_SUTOT`/
  `SP_ISTOTAL`/`SP_CASE`/`SP_EXDATE`/`SP_TAXRATE`/`SP_CHECK2`/`SP_CHECKER2`/`SP_CHKDATE2`/
  `SP_CREATEDATE`/`SP_CREATENAME`/`SP_MODIFYDATE`/`SP_MODIFYNAME`）定義同 §5.1（型態、選項、
  「只供轉出查詢條件」「系統自動填」等註解皆相同）。

### 6.2 明細（前綴 `SD_`）

結構與進貨單明細 §5.2 幾乎相同，差異：

- **必填多三欄**：`SD_UNIT`（單位）、`SD_UNIT_FG`（單位旗標，此檔寫 `0` 基本／`1` 輔助）、
  `SD_RQTY`（輔助數量；**若是基本單位，固定給 1**）。
- 多一欄 `SD_REM1` ntext「附注」（在 `SD_REM` 之後）。
- **沒有** `SD_BDATE`/`SD_EDATE`（批號有效起訖日）。
- `SD_BY3`～`SD_BY10` 存在但原文未給中文名稱。
- 其餘欄位（含驗貨群、配件群、`SD_ORDNO`+`SD_SEQFLD` 連動必填、`SD_SEQ` 必填）同 §5.2。

---

## 7. `0000B6` 入庫單

### 7.1 抬頭（前綴 `SP_`）

**必填：`SP_DATE`、`SP_NO`、`SP_CTNO`**（`SP_TAX` 隨 imode 第 8 位）。

與 AO 抬頭的主要差異（其餘同名欄位定義同 §5.1）：

| 欄位 | 型態/長度 | 中文名稱 | 註解 |
|---|---|---|---|
| `SP_ORDNO` | nvarchar 22 | 採購\|訂單單號 | AO 只寫「採購單號」 |
| `SP_CTNO` | nvarchar **30** | 客戶\|廠商編號 | Y；長度 30（AO 是 10），可為客戶或廠商 |
| `SP_CTNAME` | nvarchar 60 | 客戶\|廠商名稱 | |
| `SP_TOTAL` | float | 總計金額 | ＝合計＋營業稅（AO 無此欄） |
| `SP_NTNPAY` | float | 應收帳款(原) | ＝合計＋營業稅−折讓＋加項−減項−已收金額（AO 無） |
| `SP_INVTYPE` | nvarchar 1 | 開立方式 | `0` 未開／`1` 隨單開立／`2` 批次開立（AO 無） |
| `SP_WEIGHT` | float | 重量 | AO 無 |
| `SP_WEIGHTTOT` | float | 重量合計 | AO 無 |
| `SP_RETDATE` | datetime | 預計還貨日 | AO 無 |
| `SP_SPEC` | nvarchar 1000 | 產品規格 | AO 無 |
| `SP_QKCUST` | nvarchar 30 | 請款對象 | **非必填**（AO/AP 必填） |
| `IN_EINVKD`～`IN_B2B_FG` | | 電子發票欄位群 | 同 §5.1 #45–52，註記「**隨單開立發票使用**」 |
| `IN_BNO` | nvarchar 30 | 統一編號 | 隨單開立發票使用（AO 無） |
| `IN_CTNAME` | nvarchar 60 | 發票客戶名稱 | 隨單開立發票使用（AO 無） |

（B6 抬頭無 `SP_CREATEDATE` 等 2025.03 新增四欄。）

### 7.2 明細（前綴 `SD_`）

**必填：`SD_DATE`、`SD_NO`、`SD_CTNO`(30)、`SD_SKNO`、`SD_UNIT`、`SD_WHNO`、`SD_UNIT_FG`、`SD_RQTY`、`SD_SEQ`、`SD_ADJUST_FG`。**

與 AO 明細的主要差異（其餘同名欄位定義同 §5.2）：

| 欄位 | 型態/長度 | 中文名稱 | 註解 |
|---|---|---|---|
| `SD_CTNO` | nvarchar **30** | 客戶\|廠商編號 | Y |
| `SD_QTY` | float | 數量 | |
| `SD_SPECD` | nvarchar 20 | 原單價金額 | 含稅單價（AO 無此欄） |
| `SD_UNIT_FG` | bit | 單位旗標 | **Y**；`F` 基本／`T` 輔助（原文如此） |
| `SD_RQTY` | float | 輔助數量 | **Y** |
| `SD_WHNO` | nvarchar 10 | 倉庫(入) | **Y** |
| `SD_YSNUM` | float | 收貨數量 | 不使用驗貨時，此欄位值＝`SD_QTY` |
| `SD_ATNO` | nvarchar 40 | 科目代號 | AO 無 |
| `SD_ORDNO` | nvarchar 22 | 採購編號 | 如有搭配採購單管理已交量，**必填** |
| `SD_SEQFLD` | int | 採購明細序號 | 同上必填 |
| `SD_SEQ` | int | 明細序號 | Y；**流水號且不可重覆** |
| `SD_ADJUST_FG` | nvarchar 1 | 加工入庫 | **Y**；`0` 非加工入庫／`1` 加工入庫 |
| `SD_LAVE_P` | float | 基本單位成本 | 當 `SD_ADJUST_FG=1` 時，**需填入單位成本** |

B6 明細**沒有**：`SD_CJNAME` 以外的促銷欄（`SD_CSNO`/`SD_CSREC`/`SD_SENDFG`）、配件欄（`SD_EQUKIND`/`SD_EQUID`/`SD_COVER`）、
`SD_WHNO_FG`（寄庫否）、`SD_BDATE`/`SD_EDATE`。

---

## 8. `0000B7` 出庫單

### 8.1 抬頭

**與 B6 入庫單抬頭完全相同**（欄位、必填、註解逐欄一致），見 §7.1。
必填：`SP_DATE`、`SP_NO`、`SP_CTNO`。

### 8.2 明細

與 B6 明細幾乎相同（含 `SD_SPECD`、`SD_ATNO`、`SD_SEQ` 流水號不可重覆），差異：

- **沒有** `SD_ADJUST_FG`／`SD_LAVE_P`（加工入庫是 B6 專屬）。
- `SD_UNIT_FG` 此檔寫 `0` 基本／`1` 輔助（Y）；`SD_RQTY`（Y）註解更完整：
  **基本單位固定＝1；輔助單位＝換算數**。
- `SD_WHNO` 原文中文名仍寫「倉庫(入)」，但出庫單語意上是**出庫倉**（原文疑似沿用模板，照實填出庫倉即可，首次串接時以 `--test` 實測確認）。
- 必填：`SD_DATE`、`SD_NO`、`SD_CTNO`、`SD_SKNO`、`SD_UNIT`、`SD_WHNO`、`SD_UNIT_FG`、`SD_RQTY`、`SD_SEQ`。

---

## 9. 開發注意事項（讀完欄位表再看這段）

1. **字母 O／數字 0 陷阱**：`0000AO`（進貨）vs `0000A0`（訂貨）。程式裡用具名常數。
2. ~~**`SD_UNIT_FG` 兩種寫法**：AO/B6 文件寫 `F`/`T`，AP/B7 寫 `0`/`1`~~
   ✅ **2026-07-31 實測已解決：真實單據一律存 `'0'`（基本單位）／`'1'`（輔助單位），沒有 F/T。**
   文件寫 F/T 的那兩處是錯的，一律用 `0`/`1`（見 §13）。
3. **冪等**：imode 位 1＝`0`（已存在跳過）配合我方自編單號即可安全重跑；或位 1＝`3` 讓凌越全權編號
   （但重跑會重複開單，**不可用於可能重試的流程**）。本專案寫入一律要冪等（開發守則 2），建議前者。
4. **單價自動帶**：`SD_PRICE` 留空（不送該欄）＝凌越依價表自動帶；送 `0`＝強制蓋 0。與訂單回寫同一坑。
5. **金鑰 30 秒**：LyGetPassKey → 立刻 LyDataIn/Out，不要中間夾長時間處理。
6. **B6/B7 imode 位 12（過帳）內定 1**：轉入即過帳、直接動庫存。若只想先建單不動庫存，明確傳 `0`。
7. **審核狀態**：新寫入的單多半 `SP_CHECK=0`（未審核），凌越查詢畫面預設常只顯示已審核——找不到單先勾「含未審核」（通用方法說明坑 1）。
8. **明細序號 `SD_SEQ`**：四單別都必填；B6/B7 明文要求**流水號且不可重覆**，從 1 起連續編。
9. **轉出查詢**：`irwhere`＋`iwhval` 用 `@v1@`/`@v2@` 佔位符；標了「此欄位用於轉出時的條件查詢」的欄位
   （`SP_ACSPNO`/`SP_CHECK`/`SP_CHECKER`/`SP_CHKDATE`/`SP_CHECK2`…）轉入時**不要傳**。
10. **分頁記得清暫存**：`irec>0` 時 LyDataOut 只回第一頁，其餘用 LyDataPage(`itykd=0`) 逐頁拉，
    拉完 LyDataPage(`itykd=1`, `ipageno=0`) 刪暫存檔。
11. **刪除回傳值特例**：LyDataDel 成功回 **null**（不是 0），判斷式要另外寫。
12. **公司代號 icpno**：與現行庫存推送同一套（00 松富／01 龍港／02 松揚／03 松成），
    寫哪家的單就傳哪家，凌越畫面也要切到該公司才看得到。

## 10. 與本專案的串接方式

- 架構不變：**雲端出資料／收結果 ↔ 內網 `ly_agent_gui.py`（凌越整合代理）實際呼叫 WCF**，
  兩段式＋`X-Writeback-Key`，步驟照 `docs/凌越串接-通用方法說明.md` §2 檢查表走。
- 底層封裝在 `D:\Work\lystk_tool` 的 `lystk.py`／`ly_order.py`（或代理資料夾的權威 `.py`）；
  接新單別＝加對應的 datakind 常數與組 XML 函式，**更新的是「凌越整合代理」資料夾的 `.py`**（CLAUDE.md 凌越段）。
- 可能的落地應用（尚未實作，僅標記可行性）：
  - **進貨單 0000AO 轉出**：補上進銷交易查詢缺的進貨視角（`docs/凌越-進銷交易查詢.md` 記載的 API 無進貨單——
    本 API 已補上），未來銷貨加回／必盤判定可加「進貨在途」訊號。
  - **入庫/出庫單 0000B6/B7 轉入**：盤點差異若要回寫凌越（目前刻意不寫回），走 B6/B7 是正規做法；
    寫回前務必重讀 CLAUDE.md「庫存調整只影響內部顯示」的定案再另案評估。
- 原始文件備份：凌越提供的 PDF 與 8 份 doc 未入 repo（二進位），本文即完整轉錄；
  原檔留存於使用者處，如需覆核以原檔為準。

## 11. 串接測試工具 `scripts/ly_newdoc_test.py`

雲端連不到凌越 LAN——把這支複製到內網「凌越整合代理」資料夾（或 `D:\Work\lystk_tool`）執行，
依賴同資料夾／`LYSTK_DIR` 的 `lystk.py`（憑證沿用 `lystk.py setup` 存的那組）。

**測試順序（前兩步唯讀零風險）：**

```bat
REM 1. 確認凌越元件版本認得五個函式（印 WSDL 簽名）
py ly_newdoc_test.py probe

REM 2. 唯讀查詢：四個新單別各查近 7 天（驗證資料種類存在＋帳號有權限）
py ly_newdoc_test.py read 松富
py ly_newdoc_test.py read 松富 --kind 進貨 --days 30

REM 3. 寫一張測試單（備註【API測試請刪除】）→ 回查 → 自動刪
REM    B6/B7 預設「不過帳」（imode 位12=0，不動庫存）；--keep 保留供人工核對
py ly_newdoc_test.py write-test 入庫 --company 松富 --ctno <編號> --skno <料號> --whno FN005 --unit KG --keep
REM 核對完手動刪，或：
py ly_newdoc_test.py delete 入庫 --company 松富 --no APITEST2026....
```

- `write-test --dry-run` 只印組好的 XML 不寫入，先看欄位對不對。
- `SD_UNIT_FG` 文件寫法不一致（§9 第 2 點）——被拒時照提示用 `--unitfg` 換另一種寫法重試，
  **實測結果記回本文件**。
- `delete` 有安全鎖：只刪 `APITEST` 開頭的單，`--force` 才能刪其他單號。
- 測試通過後要正式串接，照 `docs/凌越串接-通用方法說明.md` §2 的兩段式步驟另案實作。

## 12. 實測結果（2026-07-31，松富 icpno=00，元件版本 `API Ver:100.2507`）

### 12.1 現況總表

| 項目 | 結果 |
|---|---|
| `probe` 五函式簽名 | ✅ `LyGetPassKey`/`LyDataIn`/`LyDataOut`/`LyDataPage`/`LyDataDel` 全部存在 |
| `LyDataOut` 讀四單別 | ✅ 全通（AO 105 張／AP 0 張／B6 4 張／B7 62 張，近 7 天） |
| `LyDataIn` 寫 **0000AO 進貨單** | ✅ **成功**，`ireno='@#1#@APITEST20260731102514'` |
| `LyDataIn` 寫 **0000B6 入庫單** | ❌ **失敗**（連兩次穩定重現，見 §12.3） |
| `LyDataPage` 分頁＋清暫存 | ✅ 拿到 `itmpnm`、`itykd=1` 清除 rc=0 |
| `LyDataIn` 寫 0000AP／0000B7 | ⏳ 未測 |

### 12.2 已驗證的行為（可直接拿來寫串接程式）

- **`ireno` 格式與文件相符**：單據回傳 `@#1#@` ＋ 單號。
- **單價留空＝凌越自動帶價**：AO 測試單沒送 `SD_PRICE`，凌越自動填 `63`（進貨價表）。
  §9 第 4 點的規則**已實測成立**，不要送 `SD_PRICE=0`。
- **抬頭名稱自動回填**：只送 `SP_CTNO=B0024`，回查時 `SP_CTNAME` 已帶出「現金交易」。
- **AO 明細可不送 `SD_UNIT_FG`／`SD_UNIT`** 也能寫入成功（與文件「非必填」相符）。
- **AO 的 imode**：`000000001000000000000000000000`（位 9＝1）可正常寫入。
- 我方自編單號（`APITEST<時間戳>`）配 imode 位 1＝0 可用，**單號由我方控制＝冪等基礎**。

### 12.3 ⚠ 已知問題：B6 入庫單匯入失敗（伺服器端）

```
LyDataIn->GetRsByXml->mduRsoPerate.OpenRs -> [Microsoft][ODBC SQL Server Driver]
[SQL Server]找不到預存程序 'lystemp.dbo.T0000B6650480TEMP65040731101526803161858'。 #-2147217900
```

**判定：凌越伺服器端問題，非我方欄位或參數錯誤。** 證據三項：

1. **錯誤發生在 `GetRsByXml`**——元件把我方 XML 轉成資料集的階段，
   **早於**檢核欄位內容，所以與 `SD_UNIT_FG`／單位／倉別寫法都無關（改欄位重試無效）。
2. **同一支程式、同一套呼叫方式寫 AO 成功**（§12.1）→ 不是連線、認證、權限或 XML 組法的問題。
3. **`lystemp` 本身健康**：對 **同一個 B6 單別** 做分頁讀取，成功建立暫存物件
   `lystemp.dbo.T0000B6TEMP60560731102526947512228` 並成功清除（rc=0）
   → 不是 lystemp 資料庫缺失或權限不足。

**線索：兩條路徑的暫存物件命名規則不同。**

| 路徑 | 暫存名稱 | 結果 |
|---|---|---|
| LyDataOut 分頁（B6） | `T0000B6` ＋ `TEMP` ＋ 數字 | ✅ 建得起來 |
| LyDataIn 匯入（B6） | `T0000B6` ＋ **6 碼數字** ＋ `TEMP` ＋ 數字 | ❌ 建立失敗／名稱對不上 |

兩次失敗的中間 6 碼各不相同（`650480`、`113549`），且前 4 碼與 `TEMP` 後的前 4 碼一致
→ 是每次動態產生、非固定名稱衝突。**推測 B6/B7 的匯入暫存物件在該站台未佈建或建立步驟有缺**。

**待凌越回覆的問題**（附上本節錯誤全文、元件版本 `API Ver:100.2507`、公司別 `00`）：

1. `0000B6`／`0000B7` 的 **LyDataIn 匯入**在本站台是否需要額外佈建
   （`lystemp` 內的匯入用預存程序／暫存表模板）？
2. 為何 `0000AO` 匯入正常、`0000B6` 卡在 `GetRsByXml` 建暫存物件？
3. 匯入路徑的暫存物件命名多出中間 6 碼（與轉出路徑不同），是否為預期行為？

**在凌越修復前**：進貨單 `0000AO` 已可正式串接；入庫／出庫 `0000B6`／`0000B7` 的**寫入**先擱置
（**讀取不受影響，四單別都正常**）。

---

## 13. 實際填寫慣例（2026-07-31 統計真實單據，**寫入時以本節為準，不是 §5–8 的規格**）

> 來源：`ly_newdoc_test.py inspect` 對松富 2026-07 全月真單統計——
> 進貨 532 張/1490 明細、出庫 245 張/2194 明細、入庫 22 張/84 明細。
> **規格說「必填」不等於實務會填；規格沒說必填的欄位反而可能每張都有。**
> （訂貨單就是踩在這個落差上，故本節優先於欄位表。）

### 13.1 ⚠ 三個文件完全沒提、但每張真單都有的欄位

| 欄位 | 進貨 AO | 入庫 B6 | 出庫 B7 | 說明 |
|---|:---:|:---:|:---:|---|
| **`SP_SLIP_FG` / `SD_SLIP_FG`** | 無 | **`8`** | **`9`** | **單別旗標**。抬頭明細都要帶、值一致 |
| `SD_WHNO2` | 100% | 100% | 100% | **第二倉別**，多數＝`SD_WHNO`，但**會不同**（見 13.5） |
| `SD_ID` | 100% | 100% | 100% | 系統流水主鍵，**寫入不要送**（凌越自動配） |

**`SLIP_FG` 是本次最重要的發現**：入庫單與出庫單**共用同一張資料表、共用同一組單號序**
（兩者都有 `202607010001` 這種單號），靠 `SLIP_FG` 8/9 區分。
寫入 B6/B7 若不帶 `SLIP_FG`，極可能寫成錯的單別或落在無主狀態——
**這正是訂貨單那類「少打一個變數就出事」的欄位**。

### 13.2 各單別「100% 都有值」的欄位（寫入建議一併帶）

**三單別共同**（值幾乎固定，可直接寫死）：

| 欄位 | 實測值 | 說明 |
|---|---|---|
| `SP_RATE` / `SD_RATE` | `1` | 基本幣固定 1 |
| `SP_RATE_NM` | `NT` | 幣別代號 |
| `SP_TAXRATE` / `SD_TAXRATE` | `0.05` | 稅率 5%（即使免稅單也填） |
| `SP_QKDATE` | ＝`SP_DATE` | 請款日期一律同單據日期 |
| `SP_NOPAY` | `1` | 立帳 |
| `SP_UDEC` / `SP_RQTY` | `1` | |
| `SP_MAKER` | `003`/`025`/`053` | **制單人員代碼**（只有 3–5 個人在開單） |
| `SP_CHECK` / `SP_CHECK2` | `1` / `1` | **真單都是已確認＋已審核**；API 寫入的是 0 → 凌越畫面要勾「含未審核」才看得到 |
| `SP_TAL_REC` | 明細筆數 | 實測：18 筆明細的單 `SP_TAL_REC=18` |
| `SP_TALSUM` | 數量合計 | |
| `SD_UNIT` / `SD_WHNO` / `SD_WHNO2` | | 明細三要素，三單別都 100% |
| `SD_QTY` ＝ `SD_YSNUM` | | 收貨數量恆等於數量（不走驗貨流程） |
| `SD_UNIT_FG` | **`0`** | **不是 F/T**；`0`＝基本單位、`1`＝輔助單位 |
| `SD_TAXKD` | `1` 或 `2` | 應稅/免稅逐品項不同 |
| `SD_DIS` | `1` | 折數（1＝不打折） |

**入庫 B6 / 出庫 B7 專屬**：`SP_TAXKIND` 恆為 **`3`（無稅）**、`SP_SLIP_FG`＝8/9、
`SP_QKCUST`＝`SP_CTNO`（文件只在 AO/AP 標必填，但 B6/B7 實測也 100% 有值）。

**進貨 AO 專屬**：`SP_TAXKIND` 為 `1`/`2`/`3` 混用（真的依單計稅）；**無** `SLIP_FG`。

### 13.3 金額欄：AO 與 B6/B7 是兩套，不要混用

| | 進貨 AO | 入庫 B6 / 出庫 B7 |
|---|---|---|
| `SD_PRICE` 單價 | **100% 有值**（10、10.3、100…） | **恆為 `0`** |
| `SD_STOT` 小計 | 100% 有值 | 恆為 `0` |
| `SP_TOT`/`SP_TOTAL` | 99% 有值 | **恆為 `0`** |
| 成本欄 `SD_LAVE_P`/`SD_NAVE_P`/`SD_PAVE_P` | 部分 | **主要金額欄**（46–75%） |
| 成本金額 `SD_PTAVE_P`/`SD_TBSAVE` | | 100%／95% |

**結論**：進貨單走「單價×數量」；**入庫/出庫單不帶售價，走成本欄**，
`SD_PRICE` 留 0 是正確的（不是漏填）。寫入 B6/B7 時**不要**送 `SD_PRICE`，
成本由凌越依移動平均自行計算。

### 13.4 部分填寫的欄位（依情境，不要無腦填）

| 欄位 | 填寫率 | 何時填 |
|---|---|---|
| `SP_ORDNO` / `SD_ORDNO` + `SD_SEQFLD` | AO 69%/66% | 有對應採購單時才填（三欄要一起） |
| `SD_SPEC` 規格 | 80–94% | 有規格的品項（如 `18KG/箱`） |
| `SD_REM` 貨品附註 | AO 9%、B7 22% | 人工註記（如「(中)」「7/14阿勝買」） |
| `SP_REM` 備註 | 3% | 少用 |
| `SP_MODIFYDATE`/`MODIFYNAME` | 13–24% | **系統自動填**，寫入不要送 |
| `SP_CONTACT`/`SP_CTADD2` | 2–3% | 極少用 |

### 13.5 🔎 附帶發現：`SD_WHNO2` 可能解決「未來銷貨分倉」的猜測

出庫單實測看到 `SD_WHNO` 與 `SD_WHNO2` **會不一樣**
（同一張單 #1 是 `FN003`/`FN003`、#2 是 `FN003`/`A`）。

CLAUDE.md 目前記載「未來銷貨加回」的已知限制是：
> 未做（要凌越端配合）：A1 明細 `SD_WHNO2`（出庫倉）帶出來就能真正分倉、免猜主倉

而本次證實**這套 API 的明細確實帶得出 `SD_WHNO2`**（B6/B7/AO 都 100% 有值）。
**待驗**：對 `0000A1` 銷貨單做同樣的 inspect，若 `SD_WHNO2` 也帶得出來，
就能拿掉現行「未來銷貨按主倉（分倉量最大者）分攤」的推估邏輯，改用真實出庫倉。
驗證指令：`python ly_newdoc_test.py inspect 0000A1 --company 松富 --days 7`
（需先把 `0000A1` 加進工具的 `NEW_KINDS`，或直接用 `lystk.query` 讀）。
⚠ 這會動到 `dist/lib/stock-future.js` 的核心口徑，**屬另案評估**，不要順手改。

### 13.6 建議的寫入欄位集（照實務慣例，非規格最小集）

```
# 進貨單 0000AO
抬頭：SP_DATE, SP_NO, SP_CTNO, SP_QKCUST, SP_QKDATE(=SP_DATE), SP_RATE(1),
      SP_RATE_NM(NT), SP_TAXKIND(1/2/3), SP_NOPAY(1), SP_MAKER
明細：SD_DATE, SD_NO, SD_CTNO, SD_SKNO, SD_SEQ, SD_QTY, SD_YSNUM(=SD_QTY),
      SD_UNIT, SD_WHNO, SD_WHNO2(=SD_WHNO), SD_UNIT_FG(0), SD_RQTY(1),
      SD_TAXKD, SD_DIS(1)   ※ SD_PRICE 留空→凌越自動帶價

# 入庫單 0000B6 / 出庫單 0000B7（待凌越修復匯入後才能用）
抬頭：上列 + SP_SLIP_FG(8 或 9) + SP_TAXKIND(3) + SP_QKCUST(=SP_CTNO)
明細：上列 + SD_SLIP_FG(8 或 9)，B6 另加 SD_ADJUST_FG(0)
      ※ SD_PRICE 不送（B6/B7 恆 0，成本走 LAVE_P 系列）
```

`scripts/ly_newdoc_test.py` 的 `write-test` **已按本節預設值組單**，可直接參考其程式碼。
