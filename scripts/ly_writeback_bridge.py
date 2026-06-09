#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_writeback_bridge.py — 雲端後台 ↔ 凌越 ERP 回寫橋接（內網 agent 用）
=====================================================================

跑在已能連到凌越 LAN 的那台機器（D:\\Work\\lystk_tool 旁），把雲端後台的
「待回寫訂單」寫進凌越銷貨單，再把凌越配發的單號回填到後台顯示。

流程
----
  1. GET  {CLOUD}/admin/lingyue-writeback/pending?date=YYYY-MM-DD   （帶 X-Writeback-Key）
  2. 每張訂單 → 組成 ly_datain.write_invoice 的 row → 寫入凌越
     （單號 SP_NO 由 ly_datain 依「當日既有單據最大流水 +1」自動順編，不會撞號）
  3. POST {CLOUD}/admin/lingyue-writeback/callback  回填凌越單號

欄位對映（雲端 pending → 凌越）
------------------------------
  主表： customer_code→SP_CTNO  customer_name→SP_CTNAME  order_date→SP_DATE  doc_remark→SP_REM
  明細： product_code→SD_SKNO  product_name→SD_NAME  unit→SD_UNIT  quantity→SD_QTY
         item_note→SD_REM   SD_WHNO=（預設留空，之後在凌越補）   SD_PRICE=（預設 0）

設定（環境變數，或用 CLI 參數覆蓋）
-----------------------------------
  LY_CLOUD_BASE     雲端後台網址，如 https://xxxx.run.app（必填）
  LY_WRITEBACK_KEY  與後台環境變數 LINGYUE_WRITEBACK_KEY 相同的金鑰（必填）
  LY_ICPNO          公司代碼，預設 "00"（松富）
  LY_DEFAULT_WHNO   預設倉別 SD_WHNO，預設 ""（留空；若凌越不接受空倉別，改設成如 FN005）
  LY_DEFAULT_PRICE  預設單價 SD_PRICE，預設 "0"

用法
----
  # 1) 先試跑（只抓資料、組單、印出來，不寫凌越、不回填）— 確認對映正確
  python ly_writeback_bridge.py --date 2026-06-06 --dry-run

  # 2) 寫「一張」測試單（SP_REM 標記【API測試請刪除】）→ 驗證 → 自動刪除；不回填後台
  #    用這步確認「倉別留空 + 單價 0」凌越會不會收。加 --keep 可保留不刪、自己進 ERP 看。
  python ly_writeback_bridge.py --date 2026-06-06 --test

  # 3) 確認沒問題後，正式整批回寫並回填後台
  python ly_writeback_bridge.py --date 2026-06-06
"""

import os
import sys
import json
import argparse
import datetime
import urllib.request
import urllib.error

# 讓本機找得到 ly_datain（與探索工具同目錄）
sys.path.insert(0, r"D:\Work\lystk_tool")
import ly_datain  # noqa: E402  提供 write_invoice / verify_sp_no / delete_invoice

TEST_REM_PREFIX = "【API測試請刪除】"


# ----------------------------------------------------------------------
#  HTTP（用標準庫 urllib，免裝 requests）
# ----------------------------------------------------------------------

def _http(method: str, url: str, key: str, body: dict | None = None, timeout: int = 60) -> dict:
    data = None
    headers = {"X-Writeback-Key": key, "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} {method} {url}\n  {detail}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"連線失敗 {method} {url}：{e.reason}") from None
    return json.loads(raw) if raw.strip() else {}


def fetch_pending(base: str, key: str, date_str: str) -> list:
    url = f"{base.rstrip('/')}/admin/lingyue-writeback/pending?date={date_str}"
    res = _http("GET", url, key)
    return res.get("orders", []) or []


def post_callback(base: str, key: str, results: list) -> dict:
    url = f"{base.rstrip('/')}/admin/lingyue-writeback/callback"
    return _http("POST", url, key, {"results": results})


# ----------------------------------------------------------------------
#  雲端訂單 → 凌越 write_invoice row
# ----------------------------------------------------------------------

def map_order(order: dict, *, whno: str, price: str, rem_prefix: str = "") -> dict:
    """把一張雲端 pending 訂單轉成 ly_datain.write_invoice 需要的 row dict。"""
    details = []
    for it in order.get("items", []) or []:
        qty = it.get("quantity")
        det = {
            "SD_SKNO": (it.get("product_code") or "").strip(),
            "SD_NAME": (it.get("product_name") or "").strip(),
            "SD_UNIT": (it.get("unit") or "KG").strip(),
            "SD_WHNO": whno,                       # 預設留空（之後在凌越補倉別）
            "SD_QTY": qty if qty is not None else 0,
            "SD_PRICE": price,                     # 預設 0（SD_STOT 由 ly_datain 自動算）
        }
        note = (it.get("item_note") or "").strip()
        if note:
            det["SD_REM"] = note
        details.append(det)

    rem = (order.get("doc_remark") or "").strip()
    if rem_prefix:
        rem = (rem_prefix + rem).strip()

    return {
        "SP_CTNO": (order.get("customer_code") or "").strip(),
        "SP_CTNAME": (order.get("customer_name") or "").strip(),
        "SP_DATE": (order.get("order_date") or "").strip(),  # 雲端已給 YYYY-MM-DD
        "SP_REM": rem,
        "SP_CHECK": "0",                                      # 不審核，方便需要時刪除
        "details": details,
    }


# ----------------------------------------------------------------------
#  主流程
# ----------------------------------------------------------------------

def run(args) -> int:
    base = (args.base or os.environ.get("LY_CLOUD_BASE") or "").strip()
    key = (args.key or os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    whno = args.warehouse if args.warehouse is not None else os.environ.get("LY_DEFAULT_WHNO", "")
    price = args.price if args.price is not None else os.environ.get("LY_DEFAULT_PRICE", "0")
    date_str = args.date or datetime.date.today().strftime("%Y-%m-%d")

    if not base or not key:
        print("❌ 請設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY（或用 --base / --key）", file=sys.stderr)
        return 2

    print(f"▶ 抓取雲端待回寫訂單 date={date_str} ...")
    orders = fetch_pending(base, key, date_str)
    print(f"  共 {len(orders)} 張訂單")
    if not orders:
        print("  沒有待回寫的訂單，結束。")
        return 0

    # ── dry-run：只組單印出，不寫凌越、不回填 ───────────────────────
    if args.dry_run:
        for o in orders:
            row = map_order(o, whno=whno, price=price)
            print(f"\n── order_id={o.get('order_id')}  客戶={row['SP_CTNO']} {row['SP_CTNAME']} ──")
            print(json.dumps(row, ensure_ascii=False, indent=2))
        print("\n(dry-run：未寫入凌越、未回填)")
        return 0

    # ── test：只寫第一張（標記測試）→ 驗證 →（預設）刪除；不回填 ──────
    if args.test:
        o = orders[0]
        row = map_order(o, whno=whno, price=price, rem_prefix=TEST_REM_PREFIX)
        print(f"\n▶ 測試寫入第一張：order_id={o.get('order_id')}  客戶={row['SP_CTNO']} {row['SP_CTNAME']}")
        try:
            new_nos = ly_datain.write_invoice(icpno=icpno, rows=[row], verbose=True)
        except RuntimeError as e:
            print(f"❌ 測試寫入失敗：{e}")
            print("   （若是倉別/單價被拒，請調整 LY_DEFAULT_WHNO / LY_DEFAULT_PRICE 後再試）")
            return 1
        sp_no = new_nos[0]
        print(f"✅ 測試寫入成功，凌越單號 = {sp_no}")
        rec = ly_datain.verify_sp_no(icpno, sp_no)
        if rec:
            print("  回查 ERP：")
            for f in ["SP_NO", "SP_DATE", "SP_CTNAME", "SP_TOTAL", "SP_REM", "SP_CHECK"]:
                print(f"    {f:<12} {rec.get(f, '(無)')}")
        else:
            print("  ⚠️ 回查不到，可能有延遲")
        if args.keep:
            print(f"  --keep：保留測試單 {sp_no}，請自行到凌越確認後刪除。")
        else:
            rc = ly_datain.delete_invoice(icpno, sp_no)
            print(f"  已刪除測試單 {sp_no}（LyDataDel rc={rc}，0=成功）")
        print("\n(test：未回填後台。確認無誤後，拿掉 --test 正式整批回寫。)")
        return 0

    # ── 正式：逐張寫入，單張失敗不影響其他張；最後一次回填 ─────────────
    results = []
    ok_count = 0
    for o in orders:
        oid = o.get("order_id")
        row = map_order(o, whno=whno, price=price)
        try:
            new_nos = ly_datain.write_invoice(icpno=icpno, rows=[row], verbose=args.verbose)
            sp_no = new_nos[0]
            results.append({"order_id": oid, "doc_no": sp_no, "ok": True})
            ok_count += 1
            print(f"  ✅ {oid} → 凌越單號 {sp_no}")
        except RuntimeError as e:
            results.append({"order_id": oid, "ok": False, "error": str(e)})
            print(f"  ❌ {oid} 寫入失敗：{e}")

    print(f"\n▶ 回填後台（成功 {ok_count} / 共 {len(orders)}）...")
    cb = post_callback(base, key, results)
    print(f"  後台回應：updated={cb.get('updated_count')} failed={cb.get('failed_count')}")
    return 0 if ok_count == len(orders) else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="雲端後台 ↔ 凌越 ERP 訂單回寫橋接")
    p.add_argument("--date", help="要回寫的日期 YYYY-MM-DD（預設今天）")
    p.add_argument("--base", help="雲端後台網址（預設讀 LY_CLOUD_BASE）")
    p.add_argument("--key", help="回寫金鑰（預設讀 LY_WRITEBACK_KEY）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--warehouse", help="預設倉別 SD_WHNO（預設留空，或 LY_DEFAULT_WHNO）")
    p.add_argument("--price", help="預設單價 SD_PRICE（預設 0，或 LY_DEFAULT_PRICE）")
    p.add_argument("--dry-run", action="store_true", help="只抓+組單印出，不寫凌越、不回填")
    p.add_argument("--test", action="store_true", help="只寫第一張(標記測試)→驗證→刪除；不回填")
    p.add_argument("--keep", action="store_true", help="搭配 --test：保留測試單不刪除")
    p.add_argument("--verbose", action="store_true", help="正式寫入時印出每張 XML/進度")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
