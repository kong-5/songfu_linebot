#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""smoke test：scripts/ly_edi_qty_check.py 的純函式邏輯（不連凌越）。

執行：python3 test/ly_edi_qty_check_smoke.py
用假 lystk 模組隔離（內網才有 zeep/凌越連線），只驗證：
  * A 開頭單號判斷、數字/時間正規化
  * 建立/異動時間偵測與「覆寫嫌疑」判斷（皇宮菜案例的訊號）
  * build_doc_report 的銷貨量 vs 訂購量差額計算（6.3 − 6.0 = +0.3）
"""

import sys
import types
import importlib.util
from pathlib import Path

# 假 lystk：擋掉真模組（真的要 zeep＋凌越 LAN）
fake = types.ModuleType("lystk")
fake._client = object()
fake.API_URL = "http://fake"
fake.COMPANIES = {"00": "松富物流股份有限公司"}
fake.resolve_icpno = lambda x: x
fake.resolve_date = lambda x: x
fake.query = lambda *a, **k: []
fake.fresh_key = lambda: ""
fake.get_client = lambda: None
sys.modules["lystk"] = fake

spec = importlib.util.spec_from_file_location(
    "ly_edi_qty_check",
    Path(__file__).resolve().parent.parent / "scripts" / "ly_edi_qty_check.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

fails = []


def check(name, cond):
    if cond:
        print(f"  ✅ {name}")
    else:
        print(f"  ❌ {name}")
        fails.append(name)


print("▶ ly_edi_qty_check smoke")

# 單號分類
check("A 開頭單＝寺岡 EDI", mod.is_a_series("A202607070085"))
check("純數字單不是", not mod.is_a_series("202607053100001"))
check("空值安全", not mod.is_a_series(None))

# 數字/時間正規化
check("to_num 逗號字串", mod.to_num("1,200.5") == 1200.5)
check("to_num 空值=0", mod.to_num("") == 0.0 and mod.to_num("-") == 0.0)
check("norm_dt 斜線+T", mod.norm_dt("2026/07/07T10:20:30") == "2026-07-07 10:20:30")

# 覆寫嫌疑：異動晚於建立
_, _, s1 = mod.find_audit_times(
    {"SP_CREATEDATE": "2026-07-07 08:00:00", "SP_MODIFYDATE": "2026/07/07 14:30:00"})
check("異動晚於建立 → 嫌疑", s1)
_, _, s2 = mod.find_audit_times(
    {"SP_CREATEDATE": "2026-07-07 08:00:00", "SP_MODIFYDATE": "2026-07-07 08:00:00"})
check("同時間 → 無嫌疑", not s2)
_, _, s3 = mod.find_audit_times({"SP_NO": "A1"})
check("無時間欄 → 無嫌疑（不誤報）", not s3)

# 皇宮菜案例：銷貨 6.3、訂購 6.0 → delta +0.3
rep = mod.build_doc_report(
    {"SP_NO": "A202607070085", "SP_CTNO": "AC30014", "SP_CTNAME": "(泓泉) 名泓餐廳",
     "SP_DATE": "2026-07-07 00:00:00",
     "SP_CREATEDATE": "2026-07-07 06:00:00", "SP_MODIFYDATE": "2026-07-07 09:00:00"},
    [{"SD_SKNO": "10200010", "SD_NAME": "皇宮菜", "SD_UNIT": "KG",
      "SD_QTY": "6.3", "SD_WHNO2": "FN001"},
     {"SD_SKNO": "LB1", "SD_NAME": "小白菜", "SD_UNIT": "KG", "SD_QTY": "6.0"}],
    {"10200010": 6.0, "LB1": 6.0})
check("單頭欄位帶出", rep["sp_no"] == "A202607070085" and rep["date"] == "2026-07-07")
check("覆寫嫌疑判定", rep["suspect"])
line = rep["lines"][0]
check("量有改：6.3−6.0=+0.3", line["ordered_qty"] == 6.0 and abs(line["delta"] - 0.3) < 1e-9)
check("量沒改：delta=0", rep["lines"][1]["delta"] == 0)
check("倉別取 SD_WHNO2 優先", line["whno"] == "FN001")

# 訂貨單查不到料號 → delta=None（不臆造）
rep2 = mod.build_doc_report({"SP_NO": "A1"},
                            [{"SD_SKNO": "X1", "SD_NAME": "n", "SD_UNIT": "KG", "SD_QTY": "2"}],
                            {})
check("訂單無此料號 → delta=None", rep2["lines"][0]["delta"] is None)

# 不比對訂貨單 → 不帶 ordered/delta 欄
rep3 = mod.build_doc_report({"SP_NO": "A1"},
                            [{"SD_SKNO": "X1", "SD_QTY": "2"}], None)
check("--no-orders 模式無比對欄", "delta" not in rep3["lines"][0])

if fails:
    print(f"\n❌ {len(fails)} 項失敗：{fails}")
    sys.exit(1)
print("\n✅ smoke 全數通過")
