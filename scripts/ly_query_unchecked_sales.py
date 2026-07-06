#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_query_unchecked_sales.py — 查詢凌越「未審核銷貨單」（內網 agent 用）
======================================================================

列出凌越 ERP 銷貨單（資料種類 0000A1）中「未審核」（SP_CHECK=0）的單據。
和 ly_writeback_bridge.py 一樣，**必須跑在能連到凌越 LAN 的那台 Windows**
（D:\\Work\\lystk_tool 旁），雲端 / 外網連不到凌越內網。

為什麼有兩條查詢路徑
--------------------
  凌越讀取要靠 Dispatch 維護的 ly_datain.py（本檔看不到原始碼）。已確定存在的
  讀取函式只有 verify_sp_no(icpno, sp_no)（查單張）。要「一次列出全部未審核」
  得靠凌越 WCF 的 LyDataOut / LyDataPage 這類查詢，但 ly_datain 是否有包裝、
  叫什麼名字未知，所以本腳本：

    路徑 A（首選）：自動探測 ly_datain 裡的查詢函式（query/list/read/data_out…），
                    直接依日期區間讀 0000A1，再篩 SP_CHECK=0。
    路徑 B（保底）：探測不到查詢函式時，用 verify_sp_no 依「前綴+日期+流水」
                    逐號掃描（銷貨單 SP_NO 例：A202606060007），收集未審核者。

  先跑 --introspect 看看 ly_datain 到底有哪些函式；若印出的清單裡有更合適的
  查詢函式名，用 --query-fn <名稱> 指定即可（免改碼）。

銷貨單欄位（0000A1，見 docs/凌越串接-通用方法說明.md）
------------------------------------------------------
  主表   SP_CTNO / SP_CTNAME / SP_DATE / SP_REM / SP_CHECK(0=未審核,1=已審核) / SP_NO / SP_TOTAL
  明細   SD_SKNO / SD_NAME / SD_UNIT / SD_QTY / SD_PRICE / SD_WHNO / SD_REM

用法
----
  # 先看 ly_datain 有哪些函式可用（決定走哪條路）
  python ly_query_unchecked_sales.py --introspect

  # 查「今天」未審核銷貨單
  python ly_query_unchecked_sales.py

  # 查指定日期 / 區間
  python ly_query_unchecked_sales.py --date 2026-07-06
  python ly_query_unchecked_sales.py --date-from 2026-07-01 --date-to 2026-07-06

  # 指定用哪支查詢函式（跑過 --introspect 看到真名後）
  python ly_query_unchecked_sales.py --date 2026-07-06 --query-fn read_invoices

  # 強制走保底逐號掃描（不用查詢函式），並印明細
  python ly_query_unchecked_sales.py --date 2026-07-06 --scan --show-details

環境變數
--------
  LY_ICPNO   公司代碼，預設 "00"（松富）；凌越畫面看別家公司就查不到，要對上。
"""

import os
import sys
import argparse
import datetime

# 讓本機找得到 ly_datain（與探索工具同目錄，同 ly_writeback_bridge.py）
sys.path.insert(0, r"D:\Work\lystk_tool")
import ly_datain  # noqa: E402  提供 write_invoice / verify_sp_no / delete_invoice（讀取查詢函式名待探測）

# 銷貨單資料種類
DATA_TYPE_SALES = "0000A1"

# 路徑 A：可能的「查詢/列表」函式名（依常見命名猜，命中第一個存在者即用）
QUERY_FN_CANDIDATES = [
    "query_invoices", "list_invoices", "read_invoices", "read_invoice",
    "query_sp", "list_sp", "read_sp", "get_invoices", "search_invoices",
    "data_out", "dataout", "page", "data_page", "datapage", "query", "list",
]

# 主表欄位（不同單別前綴不同；銷貨單是 SP_）
F_NO, F_DATE, F_CTNO, F_CTNAME = "SP_NO", "SP_DATE", "SP_CTNO", "SP_CTNAME"
F_TOTAL, F_REM, F_CHECK = "SP_TOTAL", "SP_REM", "SP_CHECK"


def is_unchecked(rec: dict) -> bool:
    """SP_CHECK 空 / 0 視為未審核；1 / Y 視為已審核。"""
    v = str(rec.get(F_CHECK, "")).strip().upper()
    return v in ("", "0", "N", "FALSE")


def introspect() -> int:
    names = [n for n in dir(ly_datain) if not n.startswith("_")]
    callables = [n for n in names if callable(getattr(ly_datain, n, None))]
    print("ly_datain 可用（public callable）函式：")
    for n in sorted(callables):
        print(f"  - {n}")
    hit = pick_query_fn(None)
    print("\n本腳本自動選中的查詢函式：", hit or "（無 → 會走保底 --scan 逐號掃描）")
    print("verify_sp_no 是否存在：", "有" if hasattr(ly_datain, "verify_sp_no") else "沒有（保底路徑會失效！）")
    return 0


def pick_query_fn(explicit: str | None):
    """回傳可呼叫的查詢函式（或 None）。explicit 指定時只認它。"""
    if explicit:
        fn = getattr(ly_datain, explicit, None)
        return fn if callable(fn) else None
    for name in QUERY_FN_CANDIDATES:
        fn = getattr(ly_datain, name, None)
        if callable(fn):
            return fn
    return None


def try_query(fn, icpno: str, date_from: str, date_to: str) -> list | None:
    """
    路徑 A：呼叫探測到的查詢函式。因為不知道確切簽名，依序試幾種常見呼叫法，
    成功回 list[dict]，全失敗回 None（讓上層退回保底掃描）。
    """
    attempts = [
        lambda: fn(icpno=icpno, data_type=DATA_TYPE_SALES, date_from=date_from, date_to=date_to),
        lambda: fn(icpno, DATA_TYPE_SALES, date_from, date_to),
        lambda: fn(icpno=icpno, kind=DATA_TYPE_SALES, d1=date_from, d2=date_to),
        lambda: fn(icpno, DATA_TYPE_SALES, date_from),
        lambda: fn(icpno=icpno, data_type=DATA_TYPE_SALES),
        lambda: fn(icpno, DATA_TYPE_SALES),
    ]
    last_err = None
    for call in attempts:
        try:
            res = call()
        except TypeError as e:      # 簽名不合 → 換下一種試法
            last_err = e
            continue
        except Exception as e:      # 真的執行錯誤 → 停，交給上層決定
            print(f"  ⚠ 查詢函式執行出錯：{e}", file=sys.stderr)
            return None
        rows = _normalize_rows(res)
        if rows is not None:
            return rows
    if last_err:
        print(f"  ⚠ 查詢函式簽名都不符（最後：{last_err}）→ 改走保底掃描", file=sys.stderr)
    return None


def _normalize_rows(res) -> list | None:
    if res is None:
        return None
    if isinstance(res, dict):
        for key in ("rows", "data", "items", "records", "list"):
            if isinstance(res.get(key), list):
                return res[key]
        return [res]  # 單筆 dict
    if isinstance(res, list):
        return res
    return None


def scan_by_sp_no(icpno: str, date_str: str, prefix: str, max_serial: int, gap_stop: int) -> list:
    """
    路徑 B（保底）：用 verify_sp_no 逐號掃一天。
    SP_NO 假設為 <prefix><YYYYMMDD><4碼流水>，例 A202606060007。
    連續 gap_stop 個號碼查不到就停（視為當日單據已掃完）。
    """
    if not hasattr(ly_datain, "verify_sp_no"):
        print("❌ ly_datain 沒有 verify_sp_no，保底掃描無法進行。請先 --introspect 找正確讀取函式。",
              file=sys.stderr)
        return []
    ymd = date_str.replace("-", "")
    found, misses = [], 0
    for serial in range(1, max_serial + 1):
        sp_no = f"{prefix}{ymd}{serial:04d}"
        try:
            rec = ly_datain.verify_sp_no(icpno, sp_no)
        except Exception as e:
            print(f"  ⚠ verify_sp_no({sp_no}) 出錯：{e}", file=sys.stderr)
            rec = None
        if rec:
            misses = 0
            found.append(rec)
        else:
            misses += 1
            if misses >= gap_stop:
                break
    return found


def print_table(rows: list, show_details: bool) -> None:
    if not rows:
        print("\n✅ 查無「未審核」銷貨單。")
        return
    print(f"\n未審核銷貨單共 {len(rows)} 筆：\n")
    print(f"  {'SP_NO':<16}{'SP_DATE':<12}{'客戶':<20}{'金額':>10}  審核  備註")
    print("  " + "-" * 78)
    for r in rows:
        no = str(r.get(F_NO, "")).strip()
        date = str(r.get(F_DATE, "")).strip()[:10]
        name = str(r.get(F_CTNAME, "")).strip()
        total = str(r.get(F_TOTAL, "")).strip()
        chk = str(r.get(F_CHECK, "")).strip()
        rem = str(r.get(F_REM, "")).strip()
        print(f"  {no:<16}{date:<12}{name:<20}{total:>10}  {chk:^4}  {rem}")
        if show_details:
            for d in r.get("_details", []) or []:
                print(f"      · {str(d.get('SD_SKNO','')).strip():<10} "
                      f"{str(d.get('SD_NAME','')).strip():<16} "
                      f"{str(d.get('SD_QTY','')).strip():>8} "
                      f"{str(d.get('SD_UNIT','')).strip()}")


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()

    if args.introspect:
        return introspect()

    today = datetime.date.today().strftime("%Y-%m-%d")
    date_from = (args.date_from or args.date or today).strip()
    date_to = (args.date_to or args.date or date_from).strip()

    print(f"▶ 查詢未審核銷貨單  ICPNO={icpno}  日期 {date_from} ~ {date_to}")

    rows = None
    if not args.scan:
        fn = pick_query_fn(args.query_fn)
        if fn is not None:
            print(f"  路徑 A：使用查詢函式 ly_datain.{fn.__name__}()")
            rows = try_query(fn, icpno, date_from, date_to)
        elif args.query_fn:
            print(f"  ⚠ 找不到指定的查詢函式 --query-fn {args.query_fn}", file=sys.stderr)

    if rows is None:
        # 路徑 B：逐號掃描（區間逐日）
        print("  路徑 B（保底）：用 verify_sp_no 逐號掃描")
        rows = []
        d = datetime.date.fromisoformat(date_from)
        end = datetime.date.fromisoformat(date_to)
        while d <= end:
            rows += scan_by_sp_no(icpno, d.strftime("%Y-%m-%d"),
                                  args.prefix, args.max_serial, args.gap_stop)
            d += datetime.timedelta(days=1)

    unchecked = [r for r in rows if is_unchecked(r)]
    print_table(unchecked, args.show_details)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="查詢凌越未審核銷貨單（0000A1，SP_CHECK=0）")
    p.add_argument("--date", help="單一查詢日期 YYYY-MM-DD（預設今天）")
    p.add_argument("--date-from", help="區間起日 YYYY-MM-DD")
    p.add_argument("--date-to", help="區間迄日 YYYY-MM-DD")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--query-fn", help="指定 ly_datain 的查詢函式名（跑 --introspect 看真名）")
    p.add_argument("--scan", action="store_true", help="強制走保底逐號掃描，不用查詢函式")
    p.add_argument("--prefix", default="A", help="保底掃描：SP_NO 前綴（預設 A）")
    p.add_argument("--max-serial", type=int, default=300, help="保底掃描：每日最大流水（預設 300）")
    p.add_argument("--gap-stop", type=int, default=10, help="保底掃描：連續幾號查不到就停（預設 10）")
    p.add_argument("--show-details", action="store_true", help="連同明細一起印")
    p.add_argument("--introspect", action="store_true", help="只印 ly_datain 可用函式，不查詢")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
