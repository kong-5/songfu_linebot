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
    銷貨單 SP_NO = <前綴><YYYYMMDD><4碼流水>  例：A202606060007
  從當天流水 0001 往上叫 verify_sp_no，連續 --gap-stop 個查不到就當作掃完，
  過程中 SP_CHECK 為空/0 的即「未審核」，收集後列表。

欄位（0000A1）
--------------
  主表 SP_NO / SP_DATE / SP_CTNO / SP_CTNAME / SP_TOTAL / SP_REM / SP_CHECK(0=未審核)
  明細 SD_SKNO / SD_NAME / SD_UNIT / SD_QTY / SD_PRICE / SD_WHNO / SD_REM

用法
----
  # 查「今天」松富未審核銷貨單
  python ly_query_unchecked_sales.py

  # 指定日期 / 區間；要看掃描過程加 -v、要看明細加 --show-details
  python ly_query_unchecked_sales.py --date 2026-07-06 -v
  python ly_query_unchecked_sales.py --date-from 2026-07-01 --date-to 2026-07-06 --show-details

  # 若單號前綴不是 A（用 -v 看每個號都 miss 就是前綴錯），改 --prefix
  python ly_query_unchecked_sales.py --date 2026-07-06 --prefix B -v

環境變數
--------
  LY_ICPNO   公司代碼，預設 "00"（松富）。凌越畫面看別家公司就查不到，要對上。
"""

import os
import sys
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


def scan_day(icpno, date_str, prefix, max_serial, gap_stop, verbose):
    """掃一天，回傳 (該日全部命中的單, 未審核的單)。"""
    ymd = date_str.replace("-", "")
    hits, unchecked, misses = [], [], 0
    for serial in range(1, max_serial + 1):
        sp_no = f"{prefix}{ymd}{serial:04d}"
        try:
            rec = ly_datain.verify_sp_no(icpno, sp_no)
        except Exception as e:
            rec = None
            if verbose:
                print(f"  ! {sp_no} verify 出錯：{e}", file=sys.stderr)
        if rec:
            misses = 0
            hits.append(rec)
            flag = "未審核" if is_unchecked(rec) else "已審核"
            if verbose:
                print(f"  · {sp_no}  {flag}  {str(rec.get(F_CTNAME,'')).strip()}")
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

    print(f"▶ 查詢未審核銷貨單  ICPNO={icpno}  日期 {date_from} ~ {date_to}  前綴 {args.prefix}")

    all_hits, unchecked = [], []
    d = datetime.date.fromisoformat(date_from)
    end = datetime.date.fromisoformat(date_to)
    while d <= end:
        h, u = scan_day(icpno, d.strftime("%Y-%m-%d"),
                        args.prefix, args.max_serial, args.gap_stop, args.verbose)
        all_hits += h
        unchecked += u
        d += datetime.timedelta(days=1)

    if not all_hits:
        print(f"\n⚠ 這段區間一個銷貨單號都沒掃到。可能是：前綴不是「{args.prefix}」、"
              f"公司別 ICPNO={icpno} 不對、或該區間本來就沒單。用 -v 看掃描過程確認。")
        return 0

    if not unchecked:
        print(f"\n✅ 掃到 {len(all_hits)} 張銷貨單，全部都已審核，沒有未審核的。")
        return 0

    print_table(unchecked, args.show_details)
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="查詢松富未審核銷貨單（0000A1, SP_CHECK=0）")
    p.add_argument("--date", help="單一查詢日期 YYYY-MM-DD（預設今天）")
    p.add_argument("--date-from", help="區間起日 YYYY-MM-DD")
    p.add_argument("--date-to", help="區間迄日 YYYY-MM-DD")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--prefix", default="A", help="SP_NO 前綴（預設 A）")
    p.add_argument("--max-serial", type=int, default=300, help="每日最大流水（預設 300）")
    p.add_argument("--gap-stop", type=int, default=10, help="連續幾號查不到就停（預設 10）")
    p.add_argument("--show-details", action="store_true", help="連同明細一起印")
    p.add_argument("-v", "--verbose", action="store_true", help="印出逐號掃描過程")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
