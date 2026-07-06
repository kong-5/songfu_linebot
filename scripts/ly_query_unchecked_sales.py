#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_query_unchecked_sales.py — 查詢松富銷貨單 / 挑出未審核（內網 agent 用）
==========================================================================

用凌越 WCF 的 LyDataOut「一次撈一整段」銷貨單（資料種類 0000A1），依 SP_DATE
篩月份 / 日期，列出未審核（SP_CHECK=0）的單 —— **不靠單號前綴、不逐號掃描**。

作法沿用 ly_datain.py 內 _query_max_seq 的既有寫法：
  client.service.LyDataOut(irwhere="SP_DATE like '@v1@'", iwhval="2026-07%", ...)
回傳 XML 內每個 <LYDATATITLE> 就是一張銷貨單主檔。

**必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）**，雲端連不到。

用法
----
  python ly_query_unchecked_sales.py                 # 查「本月」未審核銷貨單
  python ly_query_unchecked_sales.py --month 2026-07 # 查整個 7 月
  python ly_query_unchecked_sales.py --date 2026-07-06
  python ly_query_unchecked_sales.py --month 2026-07 --all          # 列全部(含已審核)
  python ly_query_unchecked_sales.py --month 2026-07 --show-details # 連明細

環境變數：LY_ICPNO 公司代碼，預設 "00"（松富）。
"""

import os
import sys
import argparse
import datetime
from xml.etree import ElementTree as ET

# 讓本機找得到 lystk（ly_datain 也是這樣 import 的）
sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402  提供 get_client() / fresh_key() / resolve_icpno()

IDAKD_SALES = "0000A1"  # 銷貨單資料種類

F_NO, F_DATE, F_CTNAME, F_TOTAL, F_REM, F_CHECK = \
    "SP_NO", "SP_DATE", "SP_CTNAME", "SP_TOTAL", "SP_REM", "SP_CHECK"


def is_unchecked(rec: dict) -> bool:
    """SP_CHECK 空 / 0 / N 視為未審核；1 / Y 為已審核。"""
    return str(rec.get(F_CHECK, "")).strip().upper() in ("", "0", "N", "FALSE")


def query_sales(icpno: str, date_like: str, want_details: bool) -> list:
    """
    用 LyDataOut 撈 SP_DATE like <date_like> 的所有銷貨單主檔。
    date_like 例：'2026-07%'（整月）、'2026-07-06%'（單日）。
    回傳 list[dict]（每筆是一張單的 SP_* 欄位；want_details 時附 _details）。
    """
    icpno = lystk.resolve_icpno(icpno)
    client = lystk.get_client()
    key = lystk.fresh_key()
    resp = client.service.LyDataOut(
        ikye=key, icpno=icpno, idakd=IDAKD_SALES,
        ifld="", idetfields=("*" if want_details else ""),
        irwhere="SP_DATE like '@v1@'", iwhval=date_like,
        irec=0, imode=" " * 30,
        iorder="order by SP_NO", idtorder="",
        iswhere="", isifld="",
        Isecgroup="", iseckindfg="", iseckind="",
        Isecorder="", Isecrec=0,
    )
    if str(resp["LyDataOutResult"]) != "0" or not resp["ixmlda"]:
        return []
    root = ET.fromstring(str(resp["ixmlda"]))
    rows = []
    for t in root.findall(".//LYDATATITLE"):
        rec = {child.tag: (child.text or "").strip() for child in t}
        if want_details:
            rec["_details"] = [
                {c.tag: (c.text or "").strip() for c in d}
                for d in root.findall(".//LYDATADETAIL")
                if (d.find("SD_NO") is not None
                    and (d.find("SD_NO").text or "").strip() == rec.get(F_NO, ""))
            ]
        rows.append(rec)
    return rows


def print_table(rows, show_details, title):
    print(f"\n{title}（{len(rows)} 筆）：\n")
    print(f"  {'SP_NO':<16}{'日期':<12}{'客戶':<20}{'金額':>10}  審核  備註")
    print("  " + "-" * 78)
    for r in rows:
        chk = str(r.get(F_CHECK, "")).strip()
        mark = "未審" if is_unchecked(r) else "已審"
        print(f"  {str(r.get(F_NO,'')).strip():<16}"
              f"{str(r.get(F_DATE,'')).strip()[:10]:<12}"
              f"{str(r.get(F_CTNAME,'')).strip():<20}"
              f"{str(r.get(F_TOTAL,'')).strip():>10}"
              f"  {mark}  {str(r.get(F_REM,'')).strip()}")
        if show_details:
            for d in r.get("_details", []) or []:
                print(f"      · {str(d.get('SD_SKNO','')).strip():<10}"
                      f"{str(d.get('SD_NAME','')).strip():<16}"
                      f"{str(d.get('SD_QTY','')).strip():>8} "
                      f"{str(d.get('SD_UNIT','')).strip()}")


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()

    if args.date:
        date_like = args.date.strip() + "%"
        span = args.date.strip()
    else:
        month = (args.month or datetime.date.today().strftime("%Y-%m")).strip()
        date_like = month + "%"
        span = month

    print(f"▶ 查詢銷貨單  ICPNO={icpno}  SP_DATE like '{date_like}'")
    rows = query_sales(icpno, date_like, args.show_details)

    if not rows:
        print(f"\n⚠ {span} 查無銷貨單。可能：公司別 ICPNO={icpno} 不對、該區間沒單、"
              f"或 SP_DATE 格式與 '{date_like}' 對不上。")
        return 0

    unchecked = [r for r in rows if is_unchecked(r)]

    if args.all:
        print_table(rows, args.show_details, f"{span} 全部銷貨單")
        print(f"\n其中未審核 {len(unchecked)} 筆、已審核 {len(rows) - len(unchecked)} 筆。")
    else:
        print(f"  共 {len(rows)} 張銷貨單，其中未審核 {len(unchecked)} 筆。")
        if not unchecked:
            print(f"\n✅ {span} 沒有未審核的銷貨單。")
        else:
            print_table(unchecked, args.show_details, f"{span} 未審核銷貨單")
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="查詢松富銷貨單並挑出未審核（0000A1, SP_CHECK=0）")
    p.add_argument("--month", help="查整個月 YYYY-MM（預設本月）")
    p.add_argument("--date", help="查單日 YYYY-MM-DD（優先於 --month）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--all", action="store_true", help="列出全部（含已審核），並統計未審核數")
    p.add_argument("--show-details", action="store_true", help="連同明細一起印")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
