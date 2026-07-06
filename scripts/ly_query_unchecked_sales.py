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


# 只跟凌越要摘要需要的欄位（不要 ifld="" 全欄位，那會很大很慢）
TITLE_FIELDS = "SP_NO,SP_DATE,SP_CTNAME,SP_TOTAL,SP_CHECK,SP_REM"
DETAIL_FIELDS = "SD_NO,SD_SKNO,SD_NAME,SD_QTY,SD_UNIT"


def _lydataout(icpno, irwhere, iwhval, want_details=False, progress=False):
    """低階呼叫 LyDataOut，回 (rc, xml, rows)。progress=True 時逐步印進度。"""
    def step(msg):
        if progress:
            print(f"      … {msg}", flush=True)

    step("連線凌越 (get_client)")
    icpno = lystk.resolve_icpno(icpno)
    client = lystk.get_client()
    step("取金鑰 (fresh_key)")
    key = lystk.fresh_key()
    step(f"送出查詢 LyDataOut  where=\"{irwhere}\"  val=\"{iwhval}\"")
    resp = client.service.LyDataOut(
        ikye=key, icpno=icpno, idakd=IDAKD_SALES,
        ifld=TITLE_FIELDS,
        idetfields=(DETAIL_FIELDS if want_details else ""),
        irwhere=irwhere, iwhval=iwhval,
        irec=0, imode=" " * 30,
        iorder="order by SP_NO", idtorder="",
        iswhere="", isifld="",
        Isecgroup="", iseckindfg="", iseckind="",
        Isecorder="", Isecrec=0,
    )
    rc = str(resp["LyDataOutResult"]).strip()
    xml = str(resp["ixmlda"]) if resp["ixmlda"] else ""
    step(f"收到回應 rc={rc!r} xml長度={len(xml)}，解析中")
    rows = []
    if rc == "0" and xml:
        root = ET.fromstring(xml)
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
    return rc, xml, rows


def query_month(icpno: str, month: str, prefix: str, want_details: bool) -> list:
    """
    撈某月（YYYY-MM）銷貨單主檔。
    先走「快」路徑：SP_NO like '<prefix><YYYYMM>%'（SP_NO 有索引，秒回）。
    撈不到再退回「慢」路徑：SP_DATE like 'YYYY-MM%'（整表掃描，較久）。
    """
    ym = month.replace("-", "")
    # 快路徑（索引）
    _, _, rows = _lydataout(icpno, "SP_NO like '@v1@'", f"{prefix}{ym}%", want_details, progress=True)
    if rows:
        return rows
    # 保底：改用 '_'（任一字元前綴）＋ 索引仍可能全掃，但涵蓋非 prefix 的單
    print("    （SP_NO 前綴查無，改用日期整表查，稍等…）", flush=True)
    _, _, rows = _lydataout(icpno, "SP_DATE like '@v1@'", f"{month}%", want_details, progress=True)
    return rows


def query_day(icpno: str, day: str, prefix: str, want_details: bool) -> list:
    """撈某日（YYYY-MM-DD）銷貨單主檔，快路徑同上。"""
    ymd = day.replace("-", "")
    _, _, rows = _lydataout(icpno, "SP_NO like '@v1@'", f"{prefix}{ymd}%", want_details, progress=True)
    if rows:
        return rows
    print("    （SP_NO 前綴查無，改用日期整表查，稍等…）", flush=True)
    _, _, rows = _lydataout(icpno, "SP_DATE like '@v1@'", f"{day}%", want_details, progress=True)
    return rows


def debug_probe(icpno: str, month: str) -> int:
    """用多種條件各打一次，印出凌越回傳碼 + 筆數 + 樣本，定位 0 筆原因。"""
    ym = month.replace("-", "")            # 202607
    # 只留 3 條：A前綴(快) → 任一前綴當月(一次掃描、涵蓋所有前綴) → SP_DATE(以防單號格式不同)
    probes = [
        (f"SP_NO like 'A{ym}%'（A前綴，索引快查）", "SP_NO like '@v1@'", f"A{ym}%"),
        (f"SP_NO like '_{ym}%'（任一字元前綴，當月全部）", "SP_NO like '@v1@'", f"_{ym}%"),
        (f"SP_DATE like '{month}%'（改用日期，較慢）", "SP_DATE like '@v1@'", f"{month}%"),
    ]
    print(f"▶ DEBUG  ICPNO={icpno}（resolve 後={lystk.resolve_icpno(icpno)}）  idakd={IDAKD_SALES}\n")
    sys.stdout.flush()
    for label, where, val in probes:
        print(f"  ▸ {label} … 查詢中", flush=True)
        try:
            rc, xml, rows = _lydataout(icpno, where, val)
        except Exception as e:
            print(f"      例外：{e}\n", flush=True)
            continue
        print(f"      rc={rc!r}  xml長度={len(xml)}  撈到 {len(rows)} 筆", flush=True)
        for r in rows[:8]:
            print(f"        {r.get(F_NO,''):<16} {r.get(F_DATE,''):<22} "
                  f"CHECK={r.get(F_CHECK,''):<3} {r.get(F_CTNAME,'')}", flush=True)
        if len(rows) > 8:
            print(f"        …其餘 {len(rows)-8} 筆", flush=True)
        print(flush=True)
    print("（rc=0 才是成功；-4=不合法, -5=無此欄位/公司；某條件撈到筆數就照它的 SP_DATE 格式/前綴調整）",
          flush=True)
    return 0


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

    if args.debug:
        month = (args.month or datetime.date.today().strftime("%Y-%m")).strip()
        return debug_probe(icpno, month)

    prefix = (args.prefix or "A").strip().upper()
    if args.date:
        span = args.date.strip()
        print(f"▶ 查詢銷貨單  ICPNO={icpno}  {span}（先查 SP_NO like '{prefix}{span.replace('-','')}%'）",
              flush=True)
        rows = query_day(icpno, span, prefix, args.show_details)
    else:
        month = (args.month or datetime.date.today().strftime("%Y-%m")).strip()
        span = month
        print(f"▶ 查詢銷貨單  ICPNO={icpno}  {span}（先查 SP_NO like '{prefix}{month.replace('-','')}%'）",
              flush=True)
        rows = query_month(icpno, month, prefix, args.show_details)

    if not rows:
        print(f"\n⚠ {span} 查無銷貨單。可能：公司別 ICPNO={icpno} 不對、該區間本來就沒單、"
              f"或單號前綴不是 '{prefix}'（用 --debug 看真實格式）。")
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
    p.add_argument("--prefix", help="單號前綴，走 SP_NO 索引快查（預設 A）")
    p.add_argument("--all", action="store_true", help="列出全部（含已審核），並統計未審核數")
    p.add_argument("--show-details", action="store_true", help="連同明細一起印")
    p.add_argument("--debug", action="store_true", help="用多種條件試打，印回傳碼/筆數/樣本以定位")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
