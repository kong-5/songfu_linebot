#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_write_one.py — 單張訂單寫入凌越（給系統「轉入凌越」按鈕呼叫）
================================================================

跟 ly_writeback_bridge.py 用同一支 ly_datain（真正的 WCF 寫入），差別是：
本腳本「一次只寫一張」，訂單資料**從 stdin 讀 JSON**（不從雲端抓），
寫完把結果印成 JSON 到 stdout，給 Node 後台解析。

只在「能連凌越 LAN、且有 D:\\Work\\lystk_tool\\ly_datain.py」的機器上跑得起來。

系統設定（Windows 那台的環境變數）：
  LINGYUE_WRITE_CMD = python D:\\...\\songfu_linebot\\scripts\\ly_write_one.py
  LY_ICPNO          = 00（松富）/ 01 龍港 / 02 松揚 / 03 松成
  LY_DEFAULT_WHNO   = 倉別（預設留空）
  LY_DEFAULT_PRICE  = 單價（預設留空＝讓凌越依客戶售價表自動帶）

stdin JSON 格式（由後台 /lingyue-transfer 組出）：
  { "icpno":"00", "warehouse":"", "price":"",
    "order": { "customer_code":..., "customer_name":..., "order_date":"YYYY-MM-DD",
               "doc_remark":..., "items":[ {product_code,product_name,unit,quantity,item_note}, ... ] } }

stdout：{"ok": true, "doc_no": "凌越單據號"}  或  {"ok": false, "error": "..."}
"""

import sys
import json

# 真正的 WCF 寫入元件（只在內網那台）
sys.path.insert(0, r"D:\Work\lystk_tool")


# [fix 2026-07-08] 原本用 SD_/SP_ 欄位 + ly_datain.write_invoice 寫「銷貨單」，
# 但轉入凌越應為「訂貨單 0000A0」（與長連線版 ly_agent.py 一致）。改用 OR_/OD_ 欄位 + ly_order.write_order。
def build_row(order, whno, price):
    details = []
    for it in order.get("items", []) or []:
        qty = it.get("quantity")
        det = {
            "OD_SKNO": (it.get("product_code") or "").strip(),
            "OD_NAME": (it.get("product_name") or "").strip(),
            "OD_UNIT": (it.get("unit") or "KG").strip(),
            "OD_WARE": whno,
            "OD_QTY": qty if qty is not None else 0,
        }
        if price not in (None, ""):
            det["OD_PRICE"] = price
        note = (it.get("item_note") or "").strip()
        if note:
            det["OD_REM"] = note
        details.append(det)
    od = (order.get("order_date") or "").strip().replace("/", "-")
    return {
        "OR_CTNO": (order.get("customer_code") or "").strip(),
        "OR_CTNAME": (order.get("customer_name") or "").strip(),
        "OR_DATE1": od,
        "OR_DATE2": od,
        "OR_REM": (order.get("doc_remark") or "").strip(),
        "OR_CHECK": "0",
        "details": details,
    }


def main():
    try:
        data = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"ok": False, "error": "stdin JSON 解析失敗：%s" % e}, ensure_ascii=False))
        return
    order = data.get("order") or {}
    icpno = (data.get("icpno") or "00").strip()
    whno = data.get("warehouse") or ""
    price = data.get("price") or ""
    if not order.get("items"):
        print(json.dumps({"ok": False, "error": "此訂單無可轉入品項"}, ensure_ascii=False))
        return
    # [fix 2026-07-08] 缺凌越料號的品項不可靜默略過。任一品項缺料號即整單拒寫，
    # 回報 permanent 讓後台把此單移出佇列並顯示原因，請使用者補料號後重轉（與網站端把關一致）。
    missing = [
        (it.get("product_name") or it.get("product_code") or "(無名)").strip()
        for it in order.get("items", [])
        if not (it.get("product_code") or "").strip()
    ]
    if missing:
        print(json.dumps({
            "ok": False, "permanent": True,
            "error": "有 %d 項缺凌越料號未寫入，請補料號後重轉：%s" % (len(missing), "、".join(missing[:5]) + (" 等" if len(missing) > 5 else "")),
        }, ensure_ascii=False))
        return
    row = build_row(order, whno, price)
    try:
        import ly_order  # 只有內網那台匯得進來（訂貨單 0000A0）
        nos = ly_order.write_order(icpno=icpno, rows=[row])
        doc_no = nos[0] if nos else ""
        if doc_no:
            print(json.dumps({"ok": True, "doc_no": doc_no}, ensure_ascii=False))
        else:
            print(json.dumps({"ok": False, "error": "凌越未回傳單據號"}, ensure_ascii=False))
    except ImportError as e:
        print(json.dumps({"ok": False, "error": "找不到 ly_order（此機非內網 agent）：%s" % e}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    main()
