#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_agent.py — 凌越「按需匯入」小幫手（長連線等待版）
====================================================
掛在凌越內網那台 Windows 上（D:\\Work\\lystk_tool 旁）。跟雲端後台掛一條
「長連線等待線」，平常不輪詢、不做事；一旦使用者在網站點『轉入凌越』
（把訂單標記排隊），雲端立刻回應，這裡就把該訂單寫進凌越【訂貨單 0000A0】
並回填凌越單號。近即時、不浪費。

環境變數：
  LY_CLOUD_BASE     雲端後台網址（必填），如 https://xxxx.run.app
  LY_WRITEBACK_KEY  X-Writeback-Key 金鑰（必填，同 Cloud Run 的 LINGYUE_WRITEBACK_KEY）
  LY_ICPNO          公司代碼，預設 "00"（松富）
  LY_DEFAULT_WHNO   預設倉別 OD_WARE，預設 ""（留空，之後在凌越補）
  LY_DEFAULT_PRICE  預設單價 OD_PRICE，預設 ""（留空，凌越依客戶售價表自動帶價）

用法：
  python ly_agent.py     # 開始長連線等待，視窗開著就一直守著；Ctrl+C 停止
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error

sys.path.insert(0, r"D:\Work\lystk_tool")
import ly_order  # noqa: E402  提供 write_order

WAIT_TIMEOUT = 25  # 每條等待線 hold 幾秒（雲端上限 50），到時空回就立刻重新掛線


def _http(method, url, key, body=None, timeout=60):
    data = None
    headers = {"X-Writeback-Key": key, "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw) if raw.strip() else {}


def map_order(order, whno, price):
    """雲端排隊訂單 → ly_order.write_order 的 row（訂貨單 OR_/OD_ 欄位）。
    [fix 2026-07-08] 回傳 (row, missing_names)；缺料號品項一律列入 missing，由呼叫端決定整單拒寫。"""
    details = []
    missing_names = []
    for it in order.get("items", []) or []:
        skno = (it.get("product_code") or "").strip()
        name = (it.get("product_name") or "").strip()
        if not skno:
            missing_names.append(name or "(無名)")
            continue
        qty = it.get("quantity")
        det = {"OD_SKNO": skno, "OD_NAME": name, "OD_UNIT": (it.get("unit") or "KG").strip(),
               "OD_WARE": whno, "OD_QTY": qty if qty is not None else 0}
        if price not in (None, ""):
            det["OD_PRICE"] = price
        note = (it.get("item_note") or "").strip()
        if note:
            det["OD_REM"] = note
        details.append(det)
    od = (order.get("order_date") or "").strip().replace("/", "-")
    return {"OR_CTNO": (order.get("customer_code") or "").strip(),
            "OR_CTNAME": (order.get("customer_name") or "").strip(),
            "OR_DATE1": od, "OR_DATE2": od,
            "OR_REM": (order.get("doc_remark") or "").strip(),
            "OR_CHECK": "0", "details": details}, missing_names


def post_callback(base, key, results, retries=3):
    for i in range(retries):
        try:
            return _http("POST", f"{base}/admin/lingyue-writeback/callback", key, results and {"results": results} or {"results": []})
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(2)


def main():
    base = (os.environ.get("LY_CLOUD_BASE") or "").strip().rstrip("/")
    key = (os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    icpno = (os.environ.get("LY_ICPNO") or "00").strip()
    whno = os.environ.get("LY_DEFAULT_WHNO", "")
    price = os.environ.get("LY_DEFAULT_PRICE", "")
    if not base or not key:
        print("❌ 請先設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY", file=sys.stderr)
        return 2

    print(f"▶ 凌越小幫手啟動，長連線等待中…（雲端 {base}）")
    print("  在網站點「轉入凌越」後，這裡會自動寫入。Ctrl+C 停止。")
    wait_url = f"{base}/admin/lingyue-writeback/wait?timeout={WAIT_TIMEOUT}"
    written = {}  # order_id -> doc_no（本次執行已寫入凌越的，避免重覆寫）

    while True:
        try:
            data = _http("GET", wait_url, key, timeout=WAIT_TIMEOUT + 15)
        except urllib.error.HTTPError as e:
            print(f"  ⚠ 等待端點 HTTP {e.code}，5 秒後重試", file=sys.stderr)
            time.sleep(5)
            continue
        except Exception as e:
            print(f"  ⚠ 連線問題（{e}），5 秒後重試", file=sys.stderr)
            time.sleep(5)
            continue

        orders = data.get("orders", []) or []
        if not orders:
            continue  # timeout 空回，立刻重新掛等待線

        print(f"\n▶ 收到 {len(orders)} 張排隊單，開始寫入凌越…")
        results = []
        for o in orders:
            oid = o.get("order_id")
            cname = o.get("customer_name")
            # 去重鍵＝訂單 + 排隊時間：同一次排隊只寫一次；使用者「重新轉入」會有新的 queued_at → 允許重寫
            dedup_key = f"{oid}|{o.get('queued_at', '')}"
            if dedup_key in written:  # 這次排隊已寫過 → 只重送回填，不重覆寫入凌越
                results.append({"order_id": oid, "doc_no": written[dedup_key], "ok": True})
                continue
            row, missing_names = map_order(o, whno, price)
            # [fix 2026-07-08] 缺料號整單拒寫（permanent），由後台移出佇列並顯示原因，不再靜默部分寫入。
            if missing_names:
                results.append({"order_id": oid, "ok": False, "permanent": True,
                                "error": "有 %d 項缺凌越料號未寫入，請補料號後重轉：%s" % (
                                    len(missing_names), "、".join(missing_names[:5]) + (" 等" if len(missing_names) > 5 else ""))})
                print(f"  ❌ {cname} 有 {len(missing_names)} 項缺料號，整單未寫入")
                continue
            if not row["details"]:
                results.append({"order_id": oid, "ok": False, "permanent": True, "error": "無有效料號明細"})
                print(f"  ⚠ {cname} 無有效料號，略過")
                continue
            try:
                # 每次寫入前清掉 ly_order 的快取當日最大號，逼它重新向凌越查詢 → 單號不跳號、不撞號
                # （避免小幫手長時間開著、期間有人在凌越刪單/加單時，本地計數器變舊）
                try:
                    ly_order._seq_date = None
                except Exception:
                    pass
                nos = ly_order.write_order(icpno=icpno, rows=[row])
                written[dedup_key] = nos[0]
                results.append({"order_id": oid, "doc_no": nos[0], "ok": True})
                print(f"  ✅ {cname} → 訂貨單號 {nos[0]}")
            except Exception as e:
                results.append({"order_id": oid, "ok": False, "error": str(e)[:300]})
                print(f"  ❌ {cname} 寫入失敗：{str(e)[:200]}")

        try:
            cb = post_callback(base, key, results)
            print(f"  ↩ 已回填後台：updated={cb.get('updated_count')} failed={cb.get('failed_count')}")
        except Exception as e:
            print(f"  ⚠ 回填失敗（{e}）。已寫入凌越的單不會重寫（本次執行內）", file=sys.stderr)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(main() or 0)
