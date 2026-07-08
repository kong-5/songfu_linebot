#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_stock_push.py — 撈凌越目前庫存（貨品主檔 SK_NOWQTY）整批推上雲端後台（內網 agent 用）
==========================================================================================

跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。
一次撈整張貨品主檔（資料種類 000000），取每品項的目前庫存 SK_NOWQTY，
連同料號/品名/規格/單位/凌越倉別，POST 到雲端後台的機器端點：

    POST {LY_CLOUD_BASE}/admin/lingyue-writeback/inventory-push
    標頭 X-Writeback-Key: {LY_WRITEBACK_KEY}
    body: { icpno, snapshot_at, items:[{code,name,spec,unit,qty,wh_code}, ...] }

雲端收到後全表覆蓋 erp_stock_items，後台「庫存管理 → 目前庫存」即顯示最新。

設定（環境變數，或用 CLI 覆蓋）
------------------------------
  LY_CLOUD_BASE     雲端後台網址，如 https://xxxx.run.app（必填）
  LY_WRITEBACK_KEY  與後台 LINGYUE_WRITEBACK_KEY 相同的金鑰（必填，與訂單回寫共用同一把）
  LY_ICPNO          公司代碼，預設 "00"（松富；01=龍港、03=桂田）

用法
----
  python ly_stock_push.py                 # 撈松富(00)目前庫存並推送
  python ly_stock_push.py --icpno 01      # 龍港
  python ly_stock_push.py --dry-run       # 只撈+組好，不推送（印筆數與前幾筆）
"""

import os
import sys
import json
import argparse
import datetime
import urllib.request
import urllib.error

# 讓本機找得到 lystk（與 ly_query_stock.py 同目錄）
sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

KIND_GOODS = "000000"  # 貨品主檔
CODE_FIELD = "SK_NO"
NAME_FIELD = "SK_NAME"
SPEC_FIELD = "SK_SPEC"
UNIT_FIELD = "SK_UNIT"
STOCK_FIELD = "SK_NOWQTY"   # 目前庫存（現有量）
WH_FIELD = "SK_RKWHNO"      # 預設入庫倉別（如 FN001/FN002/FN013）
STOP_FIELD = "SK_STOP"      # 停用碼：1=停用、0=正常。停用品不推上雲端。


def ensure_timeout_client(timeout: int):
    """建一個有逾時的 zeep 用戶端注入 lystk，避免預設無逾時卡死。"""
    if getattr(lystk, "_client", None) is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(
        lystk.API_URL,
        settings=Settings(strict=False, xml_huge_tree=True),
        transport=Transport(timeout=timeout, operation_timeout=timeout),
    )


def _num(v):
    s = str(v).strip().replace(",", "")
    if s == "":
        return 0
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except ValueError:
        return 0


def _is_stopped(r) -> bool:
    """SK_STOP=1（或 Y）視為停用。"""
    v = str(r.get(STOP_FIELD, "")).strip().upper()
    return v in ("1", "Y", "YES", "TRUE")


def fetch_stock_items(icpno: str, timeout: int) -> list:
    """撈整張貨品主檔，回傳 [{code,name,spec,unit,qty,wh_code}, ...]。停用品（SK_STOP=1）跳過。"""
    ensure_timeout_client(timeout)
    rows = lystk.query(icpno=icpno, idakd=KIND_GOODS)
    items = []
    skipped_stop = 0
    for r in rows or []:
        code = str(r.get(CODE_FIELD, "")).strip()
        if not code:
            continue
        if _is_stopped(r):   # 停用品不推上雲端；每次刷新依凌越最新狀態自動排除
            skipped_stop += 1
            continue
        items.append({
            "code": code,
            "name": str(r.get(NAME_FIELD, "")).strip(),
            "spec": str(r.get(SPEC_FIELD, "")).strip(),
            "unit": str(r.get(UNIT_FIELD, "")).strip(),
            "qty": _num(r.get(STOCK_FIELD, 0)),
            "wh_code": str(r.get(WH_FIELD, "")).strip(),
        })
    if skipped_stop:
        print(f"  （已跳過停用品 {skipped_stop} 項 SK_STOP=1）", flush=True)
    return items


# ── 單品項「進銷存」查詢（庫存頁點品項用）────────────────────────────
# 重點欄位：存在才顯示；欄名是常見猜測，凌越沒有的自動略過（全部欄位一律附上）。
SUMMARY_FIELDS = [
    ("目前庫存", "SK_NOWQTY"), ("單位", "SK_UNIT"), ("規格", "SK_SPEC"),
    ("預設倉別", "SK_RKWHNO"),
    ("安全存量", "SK_SAFEQTY"), ("最高存量", "SK_MAXQTY"), ("最低存量", "SK_MINQTY"),
    ("本月進貨量", "SK_INQTY"), ("本月銷貨量", "SK_OUTQTY"),
    ("最後進貨日", "SK_LASTINDATE"), ("最後銷貨日", "SK_LASTOUTDATE"),
    ("最後進價", "SK_LASTINPRICE"), ("售價", "SK_PRICE"), ("平均成本", "SK_AVGCOST"),
]


def fetch_product_record(icpno: str, code: str, timeout: int = 60) -> dict:
    """撈單一品項的貨品主檔(000000)整筆原始欄位；查不到回 {}。"""
    ensure_timeout_client(timeout)
    rows = lystk.query(icpno=icpno, idakd=KIND_GOODS, where="SK_NO='@v1@'", whval=code)
    return rows[0] if rows else {}


def build_txn_payload(rec: dict) -> dict:
    """把貨品主檔原始欄位整成 {summary:{重點}, fields:{全部}} 給網站顯示。"""
    if not rec:
        return {"summary": {}, "fields": {}}
    summary = {}
    for label, fkey in SUMMARY_FIELDS:
        if fkey in rec:
            v = str(rec.get(fkey, "")).strip()
            if v != "":
                summary[label] = v
    fields = {k: ("" if v is None else str(v).strip()) for k, v in rec.items()}
    return {"summary": summary, "fields": fields}


def push_once(base: str, key: str, icpno: str, timeout: int = 90, verbose: bool = True) -> int:
    """撈凌越目前庫存並 POST 到雲端。回傳推送筆數。"""
    items = fetch_stock_items(icpno, timeout)
    snapshot_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload = json.dumps({"icpno": icpno, "snapshot_at": snapshot_at, "items": items}).encode("utf-8")
    url = base.rstrip("/") + "/admin/lingyue-writeback/inventory-push"
    req = urllib.request.Request(
        url, data=payload, method="POST",
        headers={"Content-Type": "application/json", "X-Writeback-Key": key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            res = json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} POST {url}\n  {detail}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"連線失敗 POST {url}：{e.reason}") from None
    if verbose:
        print(f"✅ 已推送 {res.get('count', len(items))} 品項（snapshot_at={res.get('snapshot_at', snapshot_at)}）", flush=True)
    return int(res.get("count", len(items)))


def run(args) -> int:
    base = (args.base or os.environ.get("LY_CLOUD_BASE") or "").strip()
    key = (args.key or os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()

    if args.dry_run:
        print(f"▶ 撈庫存 ICPNO={icpno}（dry-run，不推送）…", flush=True)
        items = fetch_stock_items(icpno, args.timeout)
        print(f"  共 {len(items)} 品項，前 5 筆：")
        for it in items[:5]:
            print(f"    {it['code']:<12}{it['name'][:16]:<18}{it['unit']:<5}庫存 {it['qty']}  倉別 {it['wh_code']}")
        return 0

    if not base or not key:
        print("❌ 請設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY（或用 --base / --key）", file=sys.stderr)
        return 2

    print(f"▶ 撈庫存 ICPNO={icpno} 並推送到 {base} …", flush=True)
    push_once(base, key, icpno, timeout=args.timeout)
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="撈凌越目前庫存(SK_NOWQTY)整批推送到雲端後台")
    p.add_argument("--base", help="雲端後台網址（預設讀 LY_CLOUD_BASE）")
    p.add_argument("--key", help="回寫金鑰（預設讀 LY_WRITEBACK_KEY）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--timeout", type=int, default=90, help="連線/操作逾時秒數（預設 90）")
    p.add_argument("--dry-run", action="store_true", help="只撈+組好印出，不推送")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
