#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_item_txn.py — 查單一品項的「近期進銷交易明細」（內網 agent 用）
==================================================================

給庫存頁「點品項看進銷帳」用：輸入料號 → 回該料號近期的**庫存異動明細**，
含日期／類型／客戶／數量／單價／金額／單號，新→舊，並標「進(入庫)／出(出庫)」方向。

方便對盤差：把每筆標成入庫(+)或出庫(−)，呼叫端可自行加總 Σ入 / Σ出 / 淨變動。

**必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。**

凌越 API 實際提供的異動單別（見 docs/凌越-進銷交易查詢.md 的權威整理）
-------------------------------------------------------------------
  凌越 WCF `LyDataOut` 能轉出的資料種類只有這幾種與庫存有關：
    0000A1 = 銷貨單     → 出庫（-），主表 SP_ / 明細 SD_
    0000A2 = 銷貨退回單 → 入庫（+），主表 SP_ / 明細 SD_（欄位與銷貨單相同）
  **這個凌越 API 沒有「進貨單」資料種類**（清單只有 000000/000004/000009/00000D/
  0000A0/0000A1/0000A2）。若日後向凌越取得「進貨單」的資料種類代碼，設環境變數
  `LY_PURCHASE_IDAKD`（例如 0000B1）即會一併查、標成入庫(+)；欄位前綴預設沿用
  主表 SP_ / 明細 SD_，可用 `LY_PURCHASE_PREFIX=`「主前綴/明細前綴」覆蓋（如 PP_/PD_）。

作法
----
  凌越 LyDataOut 可帶 idetfields 一次回「主表(LYDATATITLE)＋明細(LYDATADETAIL)」。
  以明細料號欄 SD_SKNO 當條件，一次撈出該料號出現過的明細行，再用 SD_NO/SP_NO
  對應主表拿到日期／客戶。（沿用 #7 ly_query_server 驗證過的明細解析方式。）

用法（也可單獨在內網那台測）
----------------------------
  python ly_item_txn.py --code 10100004
  python ly_item_txn.py --code 10100004 --limit 30 --icpno 00
  python ly_item_txn.py --code 10100004 --purchase-kind 0000B1   # 日後有進貨單代碼時
"""

import os
import sys
import argparse
from xml.etree import ElementTree as ET

sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

SALES_IDAKD = "0000A1"    # 銷貨單 → 出庫
RETURN_IDAKD = "0000A2"   # 銷貨退回單 → 入庫（欄位前綴與銷貨單相同 SP_/SD_）
# 明細欄位（銷貨單 0000A1 與 銷退單 0000A2 通用）：日期在明細也有 SD_DATE
DETAIL_FIELDS = "SD_SEQ,SD_DATE,SD_SKNO,SD_NAME,SD_UNIT,SD_QTY,SD_PRICE,SD_STOT,SD_NO,SD_CTNO"

# 進貨單：這個凌越 API 沒有；日後取得代碼後設 LY_PURCHASE_IDAKD 才會查。
PURCHASE_IDAKD = os.environ.get("LY_PURCHASE_IDAKD", "").strip()
# 進貨單欄位前綴（主表/明細），預設沿用 SP_/SD_；不同單別可用「PP_/PD_」覆蓋。
PURCHASE_PREFIX = os.environ.get("LY_PURCHASE_PREFIX", "SP_/SD_").strip()

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


def _collect(icpno, idakd, code, kind_label, direction, hdr_prefix, det_prefix, timeout):
    """撈某單別中該料號的明細，組成紀錄 list。

    kind_label 如「銷貨」「銷退」「進貨」；direction 為 'in'（入庫+）或 'out'（出庫-）。
    hdr_prefix/det_prefix 如 SP_/SD_。
    """
    if det_prefix == "SD_":
        det_fields = DETAIL_FIELDS
    else:
        det_fields = (f"{det_prefix}SEQ,{det_prefix}DATE,{det_prefix}SKNO,{det_prefix}NAME,"
                      f"{det_prefix}UNIT,{det_prefix}QTY,{det_prefix}PRICE,{det_prefix}STOT,"
                      f"{det_prefix}NO,{det_prefix}CTNO")
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
        # 日期優先用主表；主表沒有時退明細 SD_DATE
        date = h.get("date", "") or str(d.get(f"{det_prefix}DATE", "")).strip()[:10]
        customer = h.get("customer", "") or str(d.get(f"{det_prefix}CTNO", "")).strip()
        recs.append({
            "date": date,
            "kind": kind_label,
            "dir": direction,            # 'in'=入庫(+) / 'out'=出庫(-)
            "customer": customer,
            "qty": _num(d.get(f"{det_prefix}QTY")),
            "price": _num(d.get(f"{det_prefix}PRICE")),
            "amount": _num(d.get(f"{det_prefix}STOT")),
            "doc_no": no,
        })
    return recs


def _signed(qty, direction):
    """把數量轉成帶號（入庫+ / 出庫-）；非數字回 None。"""
    if not isinstance(qty, (int, float)):
        return None
    return qty if direction == "in" else -qty


def fetch_item_records(icpno: str, code: str, limit: int = 60,
                       purchase_idakd: str = "", timeout: int = 90) -> dict:
    """回 {records:[...], count, sum_in, sum_out, net, note}。records 依日期新→舊。

    records 每筆含 dir（'in'/'out'）與 sqty（帶號數量），方便對盤差。
    """
    code = str(code or "").strip()
    if not code:
        return {"records": [], "count": 0, "sum_in": 0, "sum_out": 0, "net": 0, "note": "缺料號"}
    recs = []
    notes = []
    # 銷貨（出庫）
    try:
        recs += _collect(icpno, SALES_IDAKD, code, "銷貨", "out", "SP_", "SD_", timeout)
    except Exception as e:
        notes.append(f"銷貨查詢失敗：{e}")
    # 銷貨退回（入庫）— 欄位前綴與銷貨單相同
    try:
        recs += _collect(icpno, RETURN_IDAKD, code, "銷退", "in", "SP_", "SD_", timeout)
    except Exception as e:
        notes.append(f"銷退查詢失敗：{e}")
    # 進貨（入庫）— 只有設了 LY_PURCHASE_IDAKD（或 --purchase-kind）才查
    pk = (purchase_idakd or PURCHASE_IDAKD or "").strip()
    if pk:
        pref = (PURCHASE_PREFIX or "SP_/SD_").split("/")
        hp = (pref[0].strip() or "SP_")
        dp = (pref[1].strip() if len(pref) > 1 else "SD_") or "SD_"
        try:
            recs += _collect(icpno, pk, code, "進貨", "in", hp, dp, timeout)
        except Exception as e:
            notes.append(f"進貨查詢失敗：{e}")

    # 帶號數量 + 排序（新→舊）
    for r in recs:
        r["sqty"] = _signed(r.get("qty"), r.get("dir"))
    recs.sort(key=lambda r: r.get("date", ""), reverse=True)
    if limit and len(recs) > limit:
        recs = recs[:limit]

    sum_in = sum(r["qty"] for r in recs if r.get("dir") == "in" and isinstance(r.get("qty"), (int, float)))
    sum_out = sum(r["qty"] for r in recs if r.get("dir") == "out" and isinstance(r.get("qty"), (int, float)))
    net = sum_in - sum_out
    return {
        "records": recs,
        "count": len(recs),
        "sum_in": round(sum_in, 4),
        "sum_out": round(sum_out, 4),
        "net": round(net, 4),
        "note": "；".join(notes),
    }


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    res = fetch_item_records(icpno, args.code, limit=args.limit,
                             purchase_idakd=args.purchase_kind, timeout=args.timeout)
    print(f"▶ 料號 {args.code}（ICPNO={icpno}）近期進銷交易：{res['count']} 筆"
          f"　Σ入 {res['sum_in']} / Σ出 {res['sum_out']} / 淨 {res['net']}"
          + (f"  ⚠ {res['note']}" if res.get("note") else ""))
    print(f"  {'日期':<12}{'類型':<6}{'進出':<6}{'客戶':<20}{'數量':>10}{'單價':>10}{'金額':>12}  單號")
    print("  " + "-" * 92)
    for r in res["records"]:
        arrow = "入庫+" if r.get("dir") == "in" else "出庫-"
        print(f"  {r['date']:<12}{r['kind']:<6}{arrow:<6}{str(r['customer'])[:18]:<20}"
              f"{str(r['sqty']):>10}{str(r['price']):>10}{str(r['amount']):>12}  {r['doc_no']}")
    if not res["records"]:
        print("  （查無紀錄。若確定該料號有銷貨，可能是 SD_SKNO 查法需調整——把這行輸出貼回給我。）")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="查單一品項近期進銷交易（銷貨0000A1出、銷退0000A2入；進貨可選）")
    p.add_argument("--code", required=True, help="料號 SK_NO")
    p.add_argument("--icpno", help="公司代碼（預設 00，或 LY_ICPNO）")
    p.add_argument("--limit", type=int, default=60, help="最多回幾筆（預設 60）")
    p.add_argument("--purchase-kind", help="進貨單資料種類（如 0000B1）；凌越有此單別時才給")
    p.add_argument("--timeout", type=int, default=90, help="逾時秒數（預設 90）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
