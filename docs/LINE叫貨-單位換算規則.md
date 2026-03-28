# LINE 叫貨：單位自動換算（例：小把 → 公斤）

當客戶傳「芹菜 2 小把」且品項已對照到標準品名時，可依規則將數量換成**公斤**（或其他目標單位）再寫入訂單明細。

## 設定方式

**方式一（建議）**：後台 **LINE 機器人 → 叫貨單位換算**（`/admin/line-bot/unit-conversion`）編輯 JSON 後儲存。

**方式二**：在資料庫 `app_settings` 新增或更新一筆：

- **key**：`line_unit_conversion_rules`
- **value**：JSON 字串，格式如下：

```json
{
  "rules": [
    {
      "productNameContains": "芹菜",
      "fromUnits": ["小把"],
      "toUnit": "公斤",
      "kgPerUnit": 0.05,
      "kgSafetyFactor": 1,
      "remarkStyle": "prefix"
    },
    {
      "productId": "prod_你的品項ID",
      "fromUnits": ["把"],
      "toUnit": "公斤",
      "kgPerUnit": 0.2
    }
  ]
}
```

### 欄位說明

| 欄位 | 說明 |
|------|------|
| `productNameContains` | 選填。標準品名**包含**此字串才套用（例：芹菜、高麗菜）。 |
| `productId` | 選填。指定品項 ID 時優先依 ID 比對；可與 `productNameContains` 並用。 |
| `fromUnits` | 必填。客戶下的單位列表，須與解析結果一致（如 `小把`、`把`）。 |
| `toUnit` | 換算後單位，預設 `公斤`。 |
| `kgPerUnit` | **每一單位** fromUnit 等於幾公斤。例：`0.05` 表示 1 小把 = 0.05 公斤 → **2 小把 = 0.1 公斤**。 |
| `kgSafetyFactor` | 選填，介於 0～1。乘在換算結果上，讓公斤數**略保守**（例：`0.98`）。預設 `1`。也可只靠**把 `kgPerUnit` 設低一點**達到略低。 |
| `remarkStyle` | 選填。換算成功時寫入訂單明細**備註**：`prefix`＝`原訂2小把`（預設）；`plain`＝僅 `2小把`；`none`＝不寫備註。 |

未設定規則、或品項未對照、或單位不符時，系統維持原始數量與單位。

## LINE 上修正數量或刪除品項（今日訂單）

在已綁定客戶的群組內，可對**今日訂單**使用：

| 指令 | 說明 |
|------|------|
| `線上改單` | 列出今日品項與編號，並顯示修改格式 |
| `改第1項 3 公斤` | 將第 1 筆改為 3 公斤（數字請依實際項次與數量替換） |
| `更正 1 3 公斤` | 同上（另一種寫法） |
| `刪第1項` 或 `刪除 1` | 刪除第 1 筆明細 |

若**品名辨識錯誤**（整筆不是客戶要的品項），請聯絡業務或請管理員在後台「訂單明細」改對應品項；僅改數量／單位／刪除可優先用上述指令。

## SQLite 範例

```sql
INSERT OR REPLACE INTO app_settings (key, value) VALUES (
  'line_unit_conversion_rules',
  '{"rules":[{"productNameContains":"芹菜","fromUnits":["小把"],"toUnit":"公斤","kgPerUnit":0.05,"remarkStyle":"prefix"}]}'
);
```

PostgreSQL 請使用 `INSERT ... ON CONFLICT` 或後台可執行的等效語法。
