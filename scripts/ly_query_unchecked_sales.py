#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_query_unchecked_sales.py — 查詢松富「未審核銷貨單」（內網 agent 用）
======================================================================

列出凌越 ERP 銷貨單（資料種類 0000A1）中「未審核」（SP_CHECK=0）的單據。
**必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）**，雲端連不到。

讀取方式
--------
  ly_datain.py 對外只有 verify_sp_no(icpno, sp_no) 能讀單張（沒有現成的查詢/
  列表函式），所以本腳本用「單號規則」逐號掃描：
    銷貨單 SP_NO = <前綴><YYYYMMDD><4碼流水>  例：A202607060007
  預設會把 A~Z 每個前綴都掃（該前綴當天沒單就很快跳過），從流水 0001 往上叫
  verify_sp_no，SP_CHECK 為空/0 者即「未審核」，收集後列表。

用法
----
  python ly_query_unchecked_sales.py                       # 查今天，掃 A~Z 全部前綴
  python ly_query_unchecked_sales.py --date 2026-07-06     # 查指定日期
  python ly_query_unchecked_sales.py --date-from 2026-07-01 --date-to 2026-07-06 --show-details
  python ly_query_unchecked_sales.py --prefix A,B          # 只掃指定前綴（加快）

環境變數：LY_ICPNO 公司代碼，預設 "00"（松富）。
"""

import os
import sys
import string
import argparse
import datetime

# 讓本機找得到 ly_datain（與探索工具同目錄，同 ly_writeback_bridge.py）
sys.path.insert(0, r"D:\Work\lystk_tool")
import ly_datain  # noqa: E402  對外：build_xml / write_invoice / verify_sp_no / delete_invoice

F_NO, F_DATE, F_CTNAME, F_TOTAL, F_REM, F_CHECK = \
    "SP_NO", "SP_DATE", "SP_CTNAME", "SP_TOTAL", "SP_REM", "SP_CHECK"


def is_unchecked(rec: dict) -> bool:
    """SP_CHECK 空 / 0 / N 視為未審核；1 / Y 為已審核。"""
    return str(rec.get(F_CHECK, "")).strip().upper() in ("", "0", "N", "FALSE")


def scan_prefix_day(icpno, ymd, prefix, max_serial, gap_stop):
    """掃某前綴某日，回傳 (命中總數, 未審核清單)。"""
    hits, unchecked, misses = 0, [], 0
    for serial in range(1, max_serial + 1):
        sp_no = f"{prefix}{ymd}{serial:04d}"
        try:
            rec = ly_datain.verify_sp_no(icpno, sp_no)
        except Exception:
            rec = None
        if rec:
            misses = 0
            hits += 1
            if is_unchecked(rec):
                unchecked.append(rec)
        else:
            misses += 1
            if misses >= gap_stop:
                break
    return hits, unchecked


def print_table(rows, show_details):
    print(f"\n未審核銷貨單共 {len(rows)} 筆：\n")
    print(f"  {'SP_NO':<16}{'日期':<12}{'客戶':<20}{'金額':>10}  審核  備註")
    print("  " + "-" * 78)
    for r in rows:
        print(f"  {str(r.get(F_NO,'')).strip():<16}"
              f"{str(r.get(F_DATE,'')).strip()[:10]:<12}"
              f"{str(r.get(F_CTNAME,'')).strip():<20}"
              f"{str(r.get(F_TOTAL,'')).strip():>10}"
              f"  {str(r.get(F_CHECK,'')).strip():^4}"
              f"  {str(r.get(F_REM,'')).strip()}")
        if show_details:
            for d in r.get("_details", []) or []:
                print(f"      · {str(d.get('SD_SKNO','')).strip():<10}"
                      f"{str(d.get('SD_NAME','')).strip():<16}"
                      f"{str(d.get('SD_QTY','')).strip():>8} "
                      f"{str(d.get('SD_UNIT','')).strip()}")


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    today = datetime.date.today().strftime("%Y-%m-%d")
    date_from = (args.date_from or args.date or today).strip()
    date_to = (args.date_to or args.date or date_from).strip()

    if args.prefix:
        prefixes = [p.strip().upper() for p in args.prefix.split(",") if p.strip()]
    else:
        prefixes = list(string.ascii_uppercase)  # A~Z 全掃

    print(f"▶ 查詢未審核銷貨單  ICPNO={icpno}  日期 {date_from} ~ {date_to}  "
          f"前綴 {','.join(prefixes) if len(prefixes) <= 6 else 'A~Z'}")

    total_hits, unchecked = 0, []
    d = datetime.date.fromisoformat(date_from)
    end = datetime.date.fromisoformat(date_to)
    while d <= end:
        ymd = d.strftime("%Y%m%d")
        for pfx in prefixes:
            h, u = scan_prefix_day(icpno, ymd, pfx, args.max_serial, args.gap_stop)
            total_hits += h
            unchecked += u
        d += datetime.timedelta(days=1)

    if total_hits == 0:
        print(f"\n⚠ 這段區間一張銷貨單都沒掃到。可能是公司別 ICPNO={icpno} 不對、"
              f"或該區間本來就沒單。")
        return 0
    if not unchecked:
        print(f"\n✅ 掃到 {total_hits} 張銷貨單，全部已審核，沒有未審核的。")
        return 0

    print_table(unchecked, args.show_details)
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="查詢松富未審核銷貨單（0000A1, SP_CHECK=0）")
    p.add_argument("--date", help="單一查詢日期 YYYY-MM-DD（預設今天）")
    p.add_argument("--date-from", help="區間起日 YYYY-MM-DD")
    p.add_argument("--date-to", help="區間迄日 YYYY-MM-DD")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--prefix", help="只掃指定前綴，逗號分隔如 A,B（預設 A~Z 全掃）")
    p.add_argument("--max-serial", type=int, default=300, help="每日每前綴最大流水（預設 300）")
    p.add_argument("--gap-stop", type=int, default=10, help="連續幾號查不到就換下一前綴（預設 10）")
    p.add_argument("--show-details", action="store_true", help="連同明細一起印")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
