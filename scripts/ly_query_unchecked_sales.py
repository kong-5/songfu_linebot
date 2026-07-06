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


def export_xlsx(rows, path):
    try:
        p = lystk.dump_xlsx(rows, path)
        print(f"\n📄 已匯出 Excel：{p}", flush=True)
    except Exception as e:
        print(f"\n⚠ 匯出 Excel 失敗：{e}（需要 pip install openpyxl）", flush=True)


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    ensure_timeout_client(args.timeout)

    # 直接找「所有未審核」銷貨單（不分月份）＝ 盤點系統看到的那種。
    # 未審核單不管哪天開的都會一直存在，用月份反而框不到 → 這才是對的查法。
    if args.pending:
        companies = [icpno] if args.icpno else ["00", "01", "03"]
        found_any = False
        for cp in companies:
            name = lystk.COMPANIES.get(cp, cp)
            print(f"▶ 找未審核銷貨單（不分日期）  ICPNO={cp} {name} …", flush=True)
            try:
                rows = lystk.query(icpno=cp, idakd=IDAKD_SALES,
                                   where="SP_CHECK='@v1@'", whval="0",
                                   order="order by SP_NO desc")
            except Exception as e:
                print(f"    查詢失敗：{e}", flush=True)
                continue
            if rows:
                found_any = True
                print_table(rows, f"{name} 未審核銷貨單")
                if args.xlsx:
                    export_xlsx(rows, args.xlsx)
        if not found_any:
            print("\n⚠ 三家公司都查不到 SP_CHECK=0 的銷貨單。"
                  "\n  盤點系統那張若確定存在，可能：(1) 它不是『銷貨單 0000A1』而是別的單別"
                  "（如訂貨單/銷退），(2) 未審核在該系統用的是別的欄位。"
                  "\n  把盤點系統那張的單號截給我，我對一下單號前綴就知道是哪種單/哪家公司。")
        return 0

    # 診斷：不管日期，抓最新 N 張。用來確認「公司別對不對／有沒有資料／日期長怎樣」
    if args.latest:
        print(f"▶ 抓最新 {args.latest} 張 0000A1  ICPNO={icpno}（不篩日期）…", flush=True)
        rows = lystk.query(icpno=icpno, idakd=IDAKD_SALES,
                           order="order by SP_NO desc", limit=args.latest)
        if not rows:
            print(f"\n⚠ ICPNO={icpno} 的 0000A1（銷貨單）完全沒有資料 → 多半是公司別不對。"
                  f"\n  試試 --icpno 01（龍港）或 --icpno 03（桂田）再抓一次 --latest {args.latest}。")
            return 0
        print_table(rows, f"最新 {len(rows)} 張銷貨單（看 SP_DATE 實際落在哪些月份）")
        if args.xlsx:
            export_xlsx(rows, args.xlsx)
        return 0

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
        print(f"\n⚠ {span} 查無銷貨單。可能：公司別 ICPNO={icpno} 不對、或該區間沒單。"
              f"\n  建議先跑 --latest 20 確認 ICPNO={icpno} 到底有沒有銷貨單資料。")
        return 0

    unchecked = [r for r in rows if is_unchecked(r)]

    if args.xlsx:
        export_xlsx(rows, args.xlsx)

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
    p.add_argument("--pending", action="store_true", help="不分月份找所有未審核銷貨單（同盤點系統；未指定公司則掃 00/01/03）")
    p.add_argument("--latest", type=int, metavar="N", help="不篩日期抓最新 N 張（診斷公司別/資料是否存在）")
    p.add_argument("--xlsx", help="把查到的結果匯出成 Excel（給路徑，如 D:\\out.xlsx）")
    p.add_argument("--timeout", type=int, default=60, help="連線/操作逾時秒數（預設 60）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
