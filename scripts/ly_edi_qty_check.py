#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_edi_qty_check.py — 抓幾張「寺岡 EDI 回轉銷貨單」的明細數量，供比對存貨異動帳
==============================================================================

背景（2026-07-20 皇宮菜案例）：A 開頭銷貨單＝訂單拋轉寺岡秤重後經 178go EDI
回轉的單。懷疑 EDI 用同單號二次覆寫實秤重量時，凌越只換單據明細、**沒有重新
過帳**，造成「銷貨單明細數量 ≠ 貨品存貨異動明細表的減少數量」（例：單上 6.3、
異動帳 6.0）。凌越 API 沒有存貨異動檔可查（LyDataOut 只有 000000/000004/000009/
00000D/0000A0/0000A1/0000A2），所以本腳本只抓「單據側」的證據，異動帳那側
由人工在凌越報表對照。

本腳本會列出，逐張：
  * 建立/異動時間（若 SP_ 主表有帶）——**異動晚於建立＝有被二次覆寫的嫌疑**
  * 明細逐行：料號/品名/單位/數量/倉別
  * （預設開）同日同客戶的訂貨單(0000A0)逐料號訂購量——依假說，異動帳扣的
    是「拋轉當下的量（≒訂購量）」，銷貨單上是實秤量；兩者的差＝預期的帳差。

**必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）**，雲端連不到。
查詢量刻意壓小（怕把凌越查掛）：主表 1 次＋預設只挑 5 張單逐張撈明細，
每張 1～3 個小查詢，全部帶逾時。

用法
----
  python ly_edi_qty_check.py                          # 今天、前 5 張 A 開頭單
  python ly_edi_qty_check.py --date 2026-07-07        # 指定日期
  python ly_edi_qty_check.py --limit 3                # 只抓 3 張（更省）
  python ly_edi_qty_check.py --doc A202607070085      # 指定單號（可重複帶多張）
  python ly_edi_qty_check.py --code 10200010          # 只列含某料號的行（可逗號分隔多個）
  python ly_edi_qty_check.py --no-orders              # 不比對訂貨單（最省查詢）
  python ly_edi_qty_check.py --json                   # JSON 輸出（好貼回去核對）

環境變數：LY_ICPNO 公司代碼，預設 "00"（松富）。

跑完把整段輸出（連同你要對的「貨品存貨異動明細表」截圖）貼回對話即可核對。
"""

import os
import sys
import json
import argparse
import datetime

# 用機器上「權威版」lystk；本機/開發環境退回 repo 內附的 scripts/lystk_tool
sys.path.insert(0, r"D:\Work\lystk_tool")
sys.path.insert(1, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lystk_tool"))
import lystk  # noqa: E402

IDAKD_SALES = "0000A1"   # 銷貨單（A 開頭＝寺岡 EDI 回轉、純數字＝直打）
IDAKD_ORDER = "0000A0"   # 訂貨單（拋轉來源）
MAX_ORDER_DOCS_PER_CUST = 3  # 每客戶最多回查幾張訂貨單（防查詢量失控）


def ensure_timeout_client(timeout: int):
    """注入有逾時的 zeep 用戶端，避免 lystk 預設無逾時卡死（比照既有查詢腳本）。"""
    if lystk._client is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(
        lystk.API_URL,
        settings=Settings(strict=False, xml_huge_tree=True),
        transport=Transport(timeout=timeout, operation_timeout=timeout),
    )


def is_a_series(sp_no: str) -> bool:
    """單號去空白後以字母 A 開頭 → 寺岡 EDI 回轉那類。"""
    return str(sp_no or "").strip().upper().startswith("A")


def to_num(v) -> float:
    """凌越回的都是字串（可能空/含逗號），安全轉數字。"""
    s = str(v or "").strip().replace(",", "")
    if s in ("", "-"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def norm_dt(v) -> str:
    """把 2026/07/07T10:20:30 之類正規成 'YYYY-MM-DD HH:MM:SS'（取前 19 字）。"""
    return str(v or "").strip().replace("/", "-").replace("T", " ")[:19]


def find_audit_times(rec: dict):
    """從主表撈建立/異動時間欄（欄名依凌越版本可能不同，用關鍵字找）。

    回 (create_str, modify_str, suspect)：suspect＝兩欄都有且異動晚於建立
    ＝這張單開單後被改過（EDI 二次覆寫的嫌疑訊號）。
    """
    create = modify = ""
    for k, v in rec.items():
        ku = k.upper()
        if "DATE" not in ku:
            continue
        if "CREATE" in ku and not create:
            create = norm_dt(v)
        elif "MODIFY" in ku and not modify:
            modify = norm_dt(v)
    suspect = bool(create and modify and modify > create)
    return create, modify, suspect


def build_doc_report(main: dict, details: list, ordered_by_skno: dict | None) -> dict:
    """組一張單的比對結果（純函式，好測）。

    ordered_by_skno：{料號: 訂購量合計}；None＝沒比對訂貨單。
    每行 delta＝銷貨量−訂購量（依假說＝預期的異動帳差；正＝帳少扣、庫存虛高）。
    """
    create, modify, suspect = find_audit_times(main)
    lines = []
    for d in details:
        skno = str(d.get("SD_SKNO", "")).strip()
        qty = to_num(d.get("SD_QTY"))
        line = {
            "skno": skno,
            "name": str(d.get("SD_NAME", "")).strip(),
            "unit": str(d.get("SD_UNIT", "")).strip(),
            "qty": qty,
            "whno": str(d.get("SD_WHNO2") or d.get("SD_WHNO") or "").strip(),
        }
        if ordered_by_skno is not None:
            if skno in ordered_by_skno:
                line["ordered_qty"] = ordered_by_skno[skno]
                line["delta"] = round(qty - ordered_by_skno[skno], 4)
            else:
                line["ordered_qty"] = None
                line["delta"] = None
        lines.append(line)
    return {
        "sp_no": str(main.get("SP_NO", "")).strip(),
        "ctno": str(main.get("SP_CTNO", "")).strip(),
        "ctname": str(main.get("SP_CTNAME", "")).strip(),
        "date": str(main.get("SP_DATE", "")).strip()[:10],
        "create": create,
        "modify": modify,
        "suspect": suspect,
        "lines": lines,
    }


def fetch_doc_details(icpno, kind, prefix, no):
    """低階 LyDataOut 撈某單的明細行（比照 ly_query_unchecked_sales.py）。"""
    from xml.etree import ElementTree as ET
    icpno_r = lystk.resolve_icpno(icpno)
    client = lystk.get_client()
    resp = client.service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=icpno_r, idakd=kind,
        ifld="", idetfields="*",
        irwhere=f"{prefix}_NO='@v1@'", iwhval=no,
        irec=0, imode=" " * 30, iorder=f"order by {prefix}_NO",
        idtorder="", iswhere="", isifld="",
        Isecgroup="", iseckindfg="", iseckind="", Isecorder="", Isecrec=0,
    )
    if str(resp["LyDataOutResult"]) != "0" or not resp["ixmlda"]:
        return []
    root = ET.fromstring(str(resp["ixmlda"]))
    return [{c.tag: (c.text or "").strip() for c in d} for d in root.findall(".//LYDATADETAIL")]


def fetch_ordered_qty(icpno, ctno, ds, cache) -> dict | None:
    """撈同日同客戶訂貨單(0000A0)逐料號訂購量合計；查不到回 None（≠空 dict）。

    有快取（同客戶多張銷貨單只查一次）；每客戶最多回查 MAX_ORDER_DOCS_PER_CUST
    張訂貨單，超過就截斷並提示，避免查詢量失控。
    """
    key = (ctno, ds)
    if key in cache:
        return cache[key]
    result = None
    try:
        mains = lystk.query(icpno=icpno, idakd=IDAKD_ORDER, date=ds,
                            where="OR_CTNO='@v1@'", whval=ctno) or []
        if mains:
            if len(mains) > MAX_ORDER_DOCS_PER_CUST:
                print(f"    ⚠ 客戶 {ctno} 當日訂貨單 {len(mains)} 張，只取前 "
                      f"{MAX_ORDER_DOCS_PER_CUST} 張比對", flush=True)
                mains = mains[:MAX_ORDER_DOCS_PER_CUST]
            agg = {}
            for m in mains:
                or_no = str(m.get("OR_NO", "")).strip()
                for d in fetch_doc_details(icpno, IDAKD_ORDER, "OR", or_no):
                    skno = str(d.get("OD_SKNO", "")).strip()
                    if skno:
                        agg[skno] = agg.get(skno, 0.0) + to_num(d.get("OD_QTY"))
            result = agg
    except Exception as e:
        print(f"    ⚠ 回查客戶 {ctno} 訂貨單失敗（略過比對）：{e}", flush=True)
    cache[key] = result
    return result


def print_doc(rep: dict, with_orders: bool):
    tag = "⚠ 建立後有異動（覆寫嫌疑）" if rep["suspect"] else ""
    print(f"\n━━ {rep['sp_no']}  {rep['date']}  {rep['ctno']} {rep['ctname']}  {tag}")
    if rep["create"] or rep["modify"]:
        print(f"   建立 {rep['create'] or '(無)'}    異動 {rep['modify'] or '(無)'}")
    if with_orders:
        print(f"   {'料號':<12}{'品名':<16}{'單位':<5}{'銷貨量':>8}{'訂購量':>8}{'差':>7}  倉別")
    else:
        print(f"   {'料號':<12}{'品名':<16}{'單位':<5}{'銷貨量':>8}  倉別")
    print("   " + "-" * 62)
    for ln in rep["lines"]:
        base = f"   {ln['skno']:<12}{ln['name']:<16}{ln['unit']:<5}{ln['qty']:>8g}"
        if with_orders:
            oq = ln.get("ordered_qty")
            dv = ln.get("delta")
            oq_s = f"{oq:>8g}" if oq is not None else f"{'—':>8}"
            dv_s = (f"{dv:>+7g}" if dv else f"{'0':>7}") if dv is not None else f"{'—':>7}"
            mark = "  ← 量有改" if (dv is not None and abs(dv) > 1e-9) else ""
            print(f"{base}{oq_s}{dv_s}  {ln['whno']}{mark}")
        else:
            print(f"{base}  {ln['whno']}")


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    company = lystk.COMPANIES.get(icpno, icpno)
    ensure_timeout_client(args.timeout)
    code_filter = {c.strip() for c in (args.code or "").split(",") if c.strip()}
    with_orders = not args.no_orders

    # 1) 決定要看哪幾張單（主表：指定單號逐張查；否則抓當天 A 開頭前 N 張）
    ds = None
    if args.doc:
        mains = []
        for no in args.doc:
            no = no.strip()
            print(f"▶ 查單 {no}  ICPNO={icpno}（{company}）…", flush=True)
            rows = lystk.query(icpno=icpno, idakd=IDAKD_SALES,
                               where="SP_NO='@v1@'", whval=no) or []
            if not rows:
                print(f"  ⚠ 查無 {no}（公司別對嗎？）")
                continue
            mains.append(rows[0])
    else:
        ds = (lystk.resolve_date(args.date or "today")).isoformat()
        print(f"▶ 查 {ds} 銷貨單主表  ICPNO={icpno}（{company}）…", flush=True)
        rows = lystk.query(icpno=icpno, idakd=IDAKD_SALES, date=ds) or []
        a_rows = sorted((r for r in rows if is_a_series(r.get("SP_NO"))),
                        key=lambda r: str(r.get("SP_NO", "")))
        if not a_rows:
            print(f"\n⚠ {ds} 沒有 A 開頭（寺岡 EDI）銷貨單。共 {len(rows)} 張都是純數字單。")
            return 0
        # 有建立/異動時間就把「覆寫嫌疑」排前面，limit 內優先看最可疑的
        a_rows.sort(key=lambda r: (not find_audit_times(r)[2], str(r.get("SP_NO", ""))))
        mains = a_rows[: args.limit]
        print(f"  A 開頭共 {len(a_rows)} 張，本次只抓 {len(mains)} 張"
              f"（--limit {args.limit}；指定單號用 --doc）", flush=True)

    if not mains:
        return 0

    # 2) 逐張撈明細（小查詢），組報告
    order_cache: dict = {}
    reports = []
    for m in mains:
        no = str(m.get("SP_NO", "")).strip()
        print(f"  … 撈明細 {no}", flush=True)
        try:
            dets = fetch_doc_details(icpno, IDAKD_SALES, "SP", no)
        except Exception as e:
            print(f"    ⚠ 撈明細失敗，略過：{e}", flush=True)
            continue
        ordered = None
        if with_orders:
            doc_ds = str(m.get("SP_DATE", "")).strip()[:10].replace("/", "-") or ds
            ordered = fetch_ordered_qty(icpno, str(m.get("SP_CTNO", "")).strip(),
                                        doc_ds, order_cache)
        rep = build_doc_report(m, dets, ordered)
        if code_filter:
            rep["lines"] = [ln for ln in rep["lines"] if ln["skno"] in code_filter]
            if not rep["lines"]:
                continue
        reports.append(rep)

    # 3) 輸出
    if args.json:
        print(json.dumps({"ok": True, "icpno": icpno, "company": company,
                          "date": ds, "docs": reports}, ensure_ascii=False, indent=2))
        return 0

    for rep in reports:
        print_doc(rep, with_orders)

    n_suspect = sum(1 for r in reports if r["suspect"])
    n_delta = sum(1 for r in reports for ln in r["lines"]
                  if ln.get("delta") is not None and abs(ln["delta"]) > 1e-9)
    print(f"\n── 小結：共列 {len(reports)} 張"
          + (f"，其中 {n_suspect} 張建立後有異動" if n_suspect else "")
          + (f"，{n_delta} 行銷貨量≠訂購量（實秤有改）" if n_delta else "") + " ──")
    print("下一步：把上面整段輸出＋凌越「貨品存貨異動明細表」對應單據的截圖貼回對話核對。")
    print("（依假說：異動帳的減少數量會等於『訂購量』而不是單上的銷貨量。）")
    return 0


def build_parser():
    p = argparse.ArgumentParser(
        description="抓幾張寺岡 EDI 回轉銷貨單(A開頭)的明細數量，供比對存貨異動帳")
    p.add_argument("--date", help="查詢日期 YYYY-MM-DD（預設今天；--doc 時可省略）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--limit", type=int, default=5,
                   help="最多抓幾張 A 開頭單（預設 5，刻意壓小避免把凌越查掛）")
    p.add_argument("--doc", action="append", metavar="SP_NO",
                   help="指定銷貨單號（可重複帶多張；帶了就不掃當日清單）")
    p.add_argument("--code", help="只列含這些料號的行，逗號分隔（如 10200010）")
    p.add_argument("--no-orders", action="store_true",
                   help="不回查訂貨單比對訂購量（查詢量最省）")
    p.add_argument("--json", action="store_true", help="輸出 JSON（供貼回核對/程式串接）")
    p.add_argument("--timeout", type=int, default=60, help="連線/操作逾時秒數（預設 60）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
