#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_item_txn.py — 查單一品項的「近期進銷紀錄」（內網 agent 用）
================================================================

給庫存頁「點品項看進銷帳」用：輸入料號 → 回該料號近期的**銷貨明細**
（日期／客戶／數量／單價／金額／單號），近期在最前面。

**必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。**

作法
----
  凌越 LyDataOut 可帶 idetfields 一次回「主表(LYDATATITLE)＋明細(LYDATADETAIL)」。
  以明細料號欄 SD_SKNO 當條件，一次撈出該料號出現過的銷貨明細行，再用 SD_NO
  對應主表拿到日期/客戶。（沿用 #7 ly_query_server 驗證過的明細解析方式。）

  ⚠ 進貨單的資料種類代碼各家凌越可能不同，預設只查銷貨(0000A1)。要一起看進貨，
     用 --purchase-kind 指定進貨單種類（例如 0000A2），或設環境變數 LY_PURCHASE_IDAKD。

用法（也可單獨在內網那台測）
----------------------------
  python ly_item_txn.py --code 10100004
  python ly_item_txn.py --code 10100004 --limit 30 --icpno 00
  python ly_item_txn.py --code 10100004 --purchase-kind 0000A2   # 一併查進貨
"""

import os
import sys
import argparse
from xml.etree import ElementTree as ET

sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

SALES_IDAKD = "0000A1"   # 銷貨單
DETAIL_FIELDS = "SD_SEQ,SD_SKNO,SD_NAME,SD_UNIT,SD_QTY,SD_PRICE,SD_STOT,SD_NO"
# 進貨單明細前綴多為 PD_/RD_，各家不一；預設不查，交由 --purchase-kind 開啟。
PURCHASE_IDAKD = os.environ.get("LY_PURCHASE_IDAKD", "").strip()

_LYDATAOUT_ERR = {"-1": "SQL連接失敗", "-2": "讀取失敗", "-3": "金鑰失效",
                  "-4": "金鑰不合法", "-5": "無權限"}


def _ensure_client(timeout: int = 90):
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
    s = str(v or "").strip().replace(",", "")
    if s == "":
        return None
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except ValueError:
        return s


def _lydataout(icpno: str, idakd: str, det_fields: str, where: str, whval: str,
               order: str, timeout: int = 90):
    """呼叫 LyDataOut，回 (titles, details) 兩個 dict list。"""
    _ensure_client(timeout)
    client = lystk.get_client()
    resp = client.service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=lystk.resolve_icpno(icpno), idakd=idakd,
        ifld="", idetfields=det_fields,
        irwhere=where, iwhval=whval,
        irec=0, imode=" " * 30, iorder=order, idtorder="",
        iswhere="", isifld="",
        Isecgroup="", iseckindfg="", iseckind="", Isecorder="", Isecrec=0,
    )
    rc = str(resp["LyDataOutResult"])
    if rc != "0":
        raise RuntimeError(f"LyDataOut 失敗：{_LYDATAOUT_ERR.get(rc, f'code={rc}')}")
    xml = resp["ixmlda"]
    if not xml:
        return [], []
    root = ET.fromstring(str(xml))
    titles = [{c.tag: (c.text or "").strip() for c in t} for t in root.findall(".//LYDATATITLE")]
    details = [{c.tag: (c.text or "").strip() for c in d} for d in root.findall(".//LYDATADETAIL")]
    return titles, details


def _collect(icpno, idakd, code, kind_label, hdr_prefix, det_prefix, timeout):
    """撈某單別中該料號的明細，組成紀錄 list。hdr_prefix/det_prefix 如 SP_/SD_。"""
    det_fields = DETAIL_FIELDS if det_prefix == "SD_" else \
        f"{det_prefix}SEQ,{det_prefix}SKNO,{det_prefix}NAME,{det_prefix}UNIT,{det_prefix}QTY,{det_prefix}PRICE,{det_prefix}STOT,{det_prefix}NO"
    titles, details = _lydataout(
        icpno, idakd, det_fields,
        where=f"{det_prefix}SKNO=@v1@", whval=code,
        order=f"order by {hdr_prefix}NO desc", timeout=timeout,
    )
    # 主單號 → {date, customer}
    hmap = {}
    for t in titles:
        no = str(t.get(f"{hdr_prefix}NO", "")).strip()
        hmap[no] = {
            "date": str(t.get(f"{hdr_prefix}DATE", "")).strip()[:10],
            "customer": str(t.get(f"{hdr_prefix}CTNAME", "") or t.get(f"{hdr_prefix}CTNO", "")).strip(),
        }
    recs = []
    for d in details:
        if str(d.get(f"{det_prefix}SKNO", "")).strip() != str(code).strip():
            continue  # 本地再篩，保險（避免 where 未生效時撈到別的料號）
        no = str(d.get(f"{det_prefix}NO", "")).strip()
        h = hmap.get(no, {})
        recs.append({
            "date": h.get("date", ""),
            "kind": kind_label,
            "customer": h.get("customer", ""),
            "qty": _num(d.get(f"{det_prefix}QTY")),
            "price": _num(d.get(f"{det_prefix}PRICE")),
            "amount": _num(d.get(f"{det_prefix}STOT")),
            "doc_no": no,
        })
    return recs


def fetch_item_records(icpno: str, code: str, limit: int = 60,
                       purchase_idakd: str = "", timeout: int = 90) -> dict:
    """回 {records:[...], count, note}。records 依日期新→舊。"""
    code = str(code or "").strip()
    if not code:
        return {"records": [], "count": 0, "note": "缺料號"}
    recs = []
    note = ""
    try:
        recs += _collect(icpno, SALES_IDAKD, code, "銷貨", "SP_", "SD_", timeout)
    except Exception as e:
        note = f"銷貨查詢失敗：{e}"
    pk = (purchase_idakd or PURCHASE_IDAKD or "").strip()
    if pk:
        try:
            recs += _collect(icpno, pk, code, "進貨", "PP_", "PD_", timeout)
        except Exception as e:
            note = (note + "；" if note else "") + f"進貨查詢失敗：{e}"
    recs.sort(key=lambda r: r.get("date", ""), reverse=True)
    if limit and len(recs) > limit:
        recs = recs[:limit]
    return {"records": recs, "count": len(recs), "note": note}


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    res = fetch_item_records(icpno, args.code, limit=args.limit,
                             purchase_idakd=args.purchase_kind, timeout=args.timeout)
    print(f"▶ 料號 {args.code}（ICPNO={icpno}）近期進銷紀錄：{res['count']} 筆"
          + (f"  ⚠ {res['note']}" if res.get("note") else ""))
    print(f"  {'日期':<12}{'類型':<6}{'客戶':<20}{'數量':>8}{'單價':>10}{'金額':>12}  單號")
    print("  " + "-" * 82)
    for r in res["records"]:
        print(f"  {r['date']:<12}{r['kind']:<6}{str(r['customer'])[:18]:<20}"
              f"{str(r['qty']):>8}{str(r['price']):>10}{str(r['amount']):>12}  {r['doc_no']}")
    if not res["records"]:
        print("  （查無紀錄。若確定該料號有銷貨，可能是 SD_SKNO 查法需調整——把這行輸出貼回給我。）")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="查單一品項近期進銷紀錄（銷貨0000A1；進貨可選）")
    p.add_argument("--code", required=True, help="料號 SK_NO")
    p.add_argument("--icpno", help="公司代碼（預設 00，或 LY_ICPNO）")
    p.add_argument("--limit", type=int, default=60, help="最多回幾筆（預設 60）")
    p.add_argument("--purchase-kind", help="進貨單資料種類（如 0000A2）；不給＝只查銷貨")
    p.add_argument("--timeout", type=int, default=90, help="逾時秒數（預設 90）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
