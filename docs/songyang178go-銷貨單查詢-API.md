# songyang178go ↔ 凌越銷貨單查詢 API（接口規格）

給 **songyang178go** 開發者：如何從凌越 ERP 取回松成門市的銷貨單（主表＋明細）。

## 架構

```
songyang178go (另一套系統)  ──HTTP + X-Query-Key──▶  ly_query_server (公司 Windows)  ──▶  凌越 ERP
                            ◀────────  JSON  ────────                             ◀──  SP_/SD_
```

- 只有公司 Windows 那台連得到凌越、有讀取模組，所以查詢服務跑在那台。
- songyang178go 只需能連到那台的 IP:埠（預設 `8787`），用金鑰呼叫、拿 JSON。
- 服務位址範例：`http://<Windows-IP>:8787`（實際 IP／埠由維運端提供）。

## 認證

除 `/health` 外，所有請求都要帶 HTTP 標頭：

```
X-Query-Key: <與維運端約定的金鑰>
```

金鑰不符 → `401 {"error":"unauthorized"}`。

## 端點

### 1. 批次查詢（某天某門市全部銷貨單）

```
GET /sp?date=YYYY-MM-DD&office=<部門編號或店名>
```

| 參數 | 必填 | 說明 |
|---|---|---|
| `date` | 是 | 單據日期，格式 `YYYY-MM-DD`（如 `2026-07-05`） |
| `office` | 否 | 部門編號（如 `311`）或店名（如 `廣東門市`）。不帶＝該公司當天全部 |
| `icpno` | 否 | 公司代碼；一般不用帶（帶 `office` 時自動用該門市所屬公司） |

回應：

```json
{
  "count": 14,
  "orders": [
    {
      "SP_NO": "202607053100001",
      "SP_DATE": "2026-07-05 00:00:00",
      "SP_DPNO": "311",
      "office_name": "廣東門市",
      "SP_CTNO": "2025188027",
      "SP_CTNAME": "關芸蓁",
      "SP_TOTAL": "250",
      "SP_INVOICE": "DR82225532",
      "SP_REM": "時刻=17:53\n收銀機號=311\n收款(現金)=250",
      "...": "其餘 SP_ 主表欄位",
      "details": [
        {
          "SD_SEQ": "1",
          "SD_SKNO": "40100025",
          "SD_NAME": "虱目魚片",
          "SD_SPEC": "300g-350g/片",
          "SD_UNIT": "片",
          "SD_QTY": "1",
          "SD_PRICE": "220",
          "SD_STOT": "220",
          "SD_REM": "",
          "SD_NO": "202607053100001"
        }
      ]
    }
  ]
}
```

### 2. 單張查詢（用銷貨單號）

```
GET /sp/<銷貨單號>
```

回應：`{ "order": { ...同上單一物件... } }`；查不到 → `404 {"error":"not_found"}`。

### 3. 部門清單（門市代碼對照）

```
GET /departments
```

```json
{
  "office_field": "SP_DPNO",
  "default_icpno": "03",
  "departments": {
    "311": { "name": "廣東門市", "icpno": "03" },
    "032": { "name": "創始店",   "icpno": "03" }
  }
}
```

songyang178go 可先呼叫這支，給使用者選門市，再帶 `office` 去查。

### 4. 存活檢查

```
GET /health        →  200 {"ok": true}     （免金鑰）
```

## 欄位說明（重點）

主表（`SP_`，每張一筆）：

| 欄位 | 意義 |
|---|---|
| `SP_NO` | 銷貨單號（`YYYYMMDD` + 流水） |
| `SP_DATE` | 單據日期 |
| `SP_DPNO` | 部門/門市編號（`311`＝廣東門市…） |
| `office_name` | 由服務補上的門市名稱 |
| `SP_CTNO` / `SP_CTNAME` | 客戶編號／名稱（散客可能空或 `000`） |
| `SP_TOTAL` | 含稅總額 |
| `SP_INVOICE` | 發票號碼 |
| `SP_REM` | 備註（含時刻／收銀機號／收款方式） |

明細（`details`，`SD_` 陣列，每項一行商品）：

| 欄位 | 意義 |
|---|---|
| `SD_SEQ` | 行序（已由服務依此排序） |
| `SD_SKNO` / `SD_NAME` | 貨品編號／品名 |
| `SD_SPEC` / `SD_UNIT` | 規格／單位 |
| `SD_QTY` / `SD_PRICE` / `SD_STOT` | 數量／單價／小計 |
| `SD_NO` | 對應主單號（＝該筆的 `SP_NO`） |

> 明細要回哪些 `SD_` 欄位可調（維運端設 `LY_DETAIL_FIELDS`）；若 songyang178go 需要更多欄位，跟維運端說即可，不必改呼叫方式。

## 錯誤與注意事項

- 所有值都是**字串**（凌越原樣），金額/數量請 songyang178go 端自行轉數字。
- 錯誤格式：`{"error": "...", "detail": "..."}`；常見 `401`（金鑰）、`400`（缺 `date`／未知門市）、`404`（單張查無）、`500`（凌越端錯誤）。
- 未知門市 → `400`，訊息會列出可用門市；新門市請維運端加進 `ly_departments.json`。
- 日期用**單據日期**（`SP_DATE`）。當天新單多為已審核（`SP_CHECK=1`）。
- 建議 songyang178go 端加逾時（凌越偶有延遲）與重試。
