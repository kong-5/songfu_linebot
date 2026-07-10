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
  LY_ICPNO          公司代碼，預設 "00"（松富；01=龍港、02=松揚、03=桂田）。
                    可逗號分隔多家（如 "00,02"）＝逐家撈、逐家推，雲端按公司覆蓋。

用法
----
  python ly_stock_push.py                 # 撈松富(00)目前庫存並推送
  python ly_stock_push.py --icpno 01      # 龍港
  python ly_stock_push.py --icpno 00,02   # 松富＋松揚（多公司）
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


def _report_refresh(base: str, key: str, ok: bool, error: str = "") -> None:
    """把庫存刷新結果/失敗原因回報雲端，讓網站顯示真正原因（best-effort，失敗不影響主流程）。"""
    try:
        payload = json.dumps({"ok": ok, "error": error[:500]}).encode("utf-8")
        url = base.rstrip("/") + "/admin/lingyue-writeback/inventory-report"
        req = urllib.request.Request(
            url, data=payload, method="POST",
            headers={"Content-Type": "application/json", "X-Writeback-Key": key},
        )
        urllib.request.urlopen(req, timeout=15).read()
    except Exception:
        pass


def _friendly_ly_error(e: Exception) -> str:
    """把凌越常見錯誤轉成看得懂的話。"""
    s = str(e)
    if "LyGetPassKey" in s or "192.168." in s or "Read timed out" in s or "timed out" in s:
        return "連不到凌越主機（可能凌越那台沒開機、太忙、或內網不通）；" + s[:200]
    return s[:300]


def check_lingyue(icpno: str = "00", timeout: int = 12) -> dict:
    """快速檢測凌越是否連得上。
    先測 TCP(主機/埠通不通)，再測凌越 API(登入＋查 1 筆)。
    回傳 {tcp_ok, api_ok, host, port, tcp_ms, api_ms, detail}。
    用短逾時且用完還原 lystk._client，避免影響代理正在用的連線。"""
    import socket
    import time as _time
    import urllib.parse
    res = {"tcp_ok": False, "api_ok": False, "host": "", "port": 80, "tcp_ms": 0, "api_ms": 0, "detail": ""}
    try:
        u = urllib.parse.urlparse(getattr(lystk, "API_URL", "") or "")
        host = u.hostname or "192.168.4.11"
        port = u.port or (443 if u.scheme == "https" else 80)
    except Exception:
        host, port = "192.168.4.11", 80
    res["host"], res["port"] = host, port
    # 1) TCP 連線測試
    t0 = _time.time()
    try:
        socket.create_connection((host, port), timeout=timeout).close()
        res["tcp_ok"] = True
        res["tcp_ms"] = int((_time.time() - t0) * 1000)
    except Exception as e:
        res["tcp_ms"] = int((_time.time() - t0) * 1000)
        res["detail"] = f"連不到主機 {host}:{port}（{e}）"
        return res
    # 2) 凌越 API 測試（登入＋查 1 筆），用臨時短逾時 client，測完還原
    t1 = _time.time()
    old_client = getattr(lystk, "_client", None)
    try:
        lystk._client = None
        ensure_timeout_client(timeout)
        lystk.query(icpno=icpno, idakd=KIND_GOODS, limit=1)
        res["api_ok"] = True
    except Exception as e:
        res["detail"] = _friendly_ly_error(e)
    finally:
        lystk._client = old_client
        res["api_ms"] = int((_time.time() - t1) * 1000)
    return res


def _icpno_list(icpno) -> list:
    """'00,02' → ['00','02']；空/None → ['00']。多公司（松富00＋松揚02…）各自撈、各自推。"""
    parts = [p.strip() for p in str(icpno or "").split(",")]
    out = [p for p in parts if p]
    return out or ["00"]


def push_once(base: str, key: str, icpno: str, timeout: int = 90, verbose: bool = True) -> int:
    """撈凌越目前庫存並 POST 到雲端。icpno 可逗號分隔多公司（如 "00,02"），逐家推送。
    回傳推送總筆數。失敗時回報原因給雲端。"""
    total = 0
    codes = _icpno_list(icpno)
    for one in codes:
        if verbose and len(codes) > 1:
            print(f"▶ 公司 {one} …", flush=True)
        total += _push_one_company(base, key, one, timeout=timeout, verbose=verbose)
    return total


def _push_one_company(base: str, key: str, icpno: str, timeout: int = 90, verbose: bool = True) -> int:
    """撈單一公司的目前庫存並 POST 到雲端（雲端按 icpno 覆蓋）。回傳推送筆數。"""
    try:
        items = fetch_stock_items(icpno, timeout)
    except Exception as e:
        _report_refresh(base, key, False, _friendly_ly_error(e))
        raise RuntimeError(_friendly_ly_error(e)) from None
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
        _report_refresh(base, key, False, f"推送到雲端失敗 HTTP {e.code}")
        raise RuntimeError(f"HTTP {e.code} POST {url}\n  {detail}") from None
    except urllib.error.URLError as e:
        _report_refresh(base, key, False, f"推送到雲端失敗：{e.reason}")
        raise RuntimeError(f"連線失敗 POST {url}：{e.reason}") from None
    if verbose:
        print(f"✅ 已推送 {res.get('count', len(items))} 品項（snapshot_at={res.get('snapshot_at', snapshot_at)}）", flush=True)
    return int(res.get("count", len(items)))


def run(args) -> int:
    base = (args.base or os.environ.get("LY_CLOUD_BASE") or "").strip()
    key = (args.key or os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()

    if args.dry_run:
        for one in _icpno_list(icpno):
            print(f"▶ 撈庫存 ICPNO={one}（dry-run，不推送）…", flush=True)
            items = fetch_stock_items(one, args.timeout)
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
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）；可逗號多家如 00,02")
    p.add_argument("--timeout", type=int, default=90, help="連線/操作逾時秒數（預設 90）")
    p.add_argument("--dry-run", action="store_true", help="只撈+組好印出，不推送")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
