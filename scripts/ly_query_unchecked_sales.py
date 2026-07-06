#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_query_unchecked_sales.py — 查詢松富銷貨單 / 挑出未審核（內網 agent 用）
==========================================================================

列出凌越 ERP 銷貨單（資料種類 0000A1）中「未審核」（SP_CHECK=0）的單。
**必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）**，雲端連不到。

作法
----
  直接沿用 lystk.py 內建的 lystk.query()（日期區間、欄位都處理好了），
  但先注入一個「有設逾時」的 zeep 用戶端 —— lystk 預設 _build_client() 沒設
  逾時，操作呼叫可能無限卡死；帶上 Transport(timeout=...) 即正常。

用法
----
  python ly_query_unchecked_sales.py                 # 查「本月」未審核銷貨單
  python ly_query_unchecked_sales.py --month 2026-07 # 查整個 7 月
  python ly_query_unchecked_sales.py --date 2026-07-06
  python ly_query_unchecked_sales.py --month 2026-07 --all   # 列全部(含已審核)
  python ly_query_unchecked_sales.py --month 2026-06 --icpno 01   # 龍港六月

環境變數：LY_ICPNO 公司代碼，預設 "00"（松富；01=龍港、03=桂田）。
"""

import os
import sys
import calendar
import argparse
import datetime

# 讓本機找得到 lystk（ly_datain 也是這樣 import 的）
sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402  內建 query() / resolve_icpno() 等

IDAKD_SALES = "0000A1"  # 銷貨單


def ensure_timeout_client(timeout: int):
    """建一個有逾時的 zeep 用戶端注入 lystk，避免預設無逾時卡死。"""
    if lystk._client is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(
        lystk.API_URL,
        settings=Settings(strict=False, xml_huge_tree=True),
        transport=Transport(timeout=timeout, operation_timeout=timeout),
    )


def is_unchecked(rec: dict) -> bool:
    """SP_CHECK 空 / 0 / N 視為未審核；1 / Y 為已審核。"""
    return str(rec.get("SP_CHECK", "")).strip().upper() in ("", "0", "N", "FALSE")


def print_table(rows, title):
    print(f"\n{title}（{len(rows)} 筆）：\n")
    print(f"  {'SP_NO':<16}{'日期':<12}{'客戶':<20}{'金額':>10}  審核  備註")
    print("  " + "-" * 78)
    for r in rows:
        mark = "未審" if is_unchecked(r) else "已審"
        print(f"  {str(r.get('SP_NO','')).strip():<16}"
              f"{str(r.get('SP_DATE','')).strip()[:10]:<12}"
              f"{str(r.get('SP_CTNAME','')).strip():<20}"
              f"{str(r.get('SP_TOTAL','')).strip():>10}"
              f"  {mark}  {str(r.get('SP_REM','')).strip()}")


def query_days(icpno, start: datetime.date, end: datetime.date) -> list:
    """一天一天查（每天資料小、不會卡），加總整段。每天印進度。"""
    all_rows, d = [], start
    while d <= end:
        ds = d.strftime("%Y-%m-%d")
        try:
            rows = lystk.query(icpno=icpno, idakd=IDAKD_SALES, date=ds)
        except Exception as e:
            print(f"    … {ds} 失敗：{e}", flush=True)
            rows = []
        n_un = sum(1 for r in rows if is_unchecked(r))
        print(f"    … {ds}  {len(rows)} 張" + (f"（未審 {n_un}）" if n_un else ""), flush=True)
        all_rows += rows
        d += datetime.timedelta(days=1)
    return all_rows


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    ensure_timeout_client(args.timeout)

    if args.date:
        span = args.date.strip()
        d = datetime.date.fromisoformat(span)
        print(f"▶ 查詢銷貨單  ICPNO={icpno}  {span} …", flush=True)
        rows = query_days(icpno, d, d)
    else:
        month = (args.month or datetime.date.today().strftime("%Y-%m")).strip()
        span = month
        y, m = (int(x) for x in month.split("-"))
        last = calendar.monthrange(y, m)[1]
        print(f"▶ 查詢銷貨單  ICPNO={icpno}  {month}-01 ~ {month}-{last:02d}（逐日查）…", flush=True)
        rows = query_days(icpno, datetime.date(y, m, 1), datetime.date(y, m, last))

    if not rows:
        print(f"\n⚠ {span} 查無銷貨單。可能：公司別 ICPNO={icpno} 不對、或該區間沒單。")
        return 0

    unchecked = [r for r in rows if is_unchecked(r)]

    if args.all:
        print_table(rows, f"{span} 全部銷貨單")
        print(f"\n其中未審核 {len(unchecked)} 筆、已審核 {len(rows) - len(unchecked)} 筆。")
    else:
        print(f"  共 {len(rows)} 張銷貨單，其中未審核 {len(unchecked)} 筆。")
        if not unchecked:
            print(f"\n✅ {span} 沒有未審核的銷貨單。")
        else:
            print_table(unchecked, f"{span} 未審核銷貨單")
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="查詢松富銷貨單並挑出未審核（0000A1, SP_CHECK=0）")
    p.add_argument("--month", help="查整個月 YYYY-MM（預設本月）")
    p.add_argument("--date", help="查單日 YYYY-MM-DD（優先於 --month）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富；01 龍港、03 桂田，或 LY_ICPNO）")
    p.add_argument("--all", action="store_true", help="列出全部（含已審核），並統計未審核數")
    p.add_argument("--timeout", type=int, default=60, help="連線/操作逾時秒數（預設 60）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
