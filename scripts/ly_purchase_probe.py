#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_purchase_probe.py — 「進貨單資料種類代碼」低風險探測器（內網 agent 用）
==========================================================================

目的
----
凌越桌面端一定有「進貨單」，資料就在凌越裡；我們讀不到只是因為**不知道它在
LyDataOut 的資料種類代碼(idakd)**（已知清單 000000/000004/000009/00000D/
0000A0/0000A1/0000A2 剛好沒有進貨單）。拿到代碼後，正式查詢由 ly_item_txn.py
的 LY_PURCHASE_IDAKD 掛勾接手。本程式只做一件事：**安全地試一個候選代碼，看它
是不是進貨單**。

⚠ 為什麼要有這支（而不是直接拿 ly_item_txn 亂試代碼）
----------------------------------------------------
之前發生過「查一個東西 → 整個內網傳輸卡住兩三小時」。那種風暴的成因幾乎都是
**一個沒過濾（或過濾沒生效）的查詢把整張表倒出來**，SOAP 一次序列化上萬筆就塞爆。
本程式把風暴的三個來源全堵住：

  1) 一定要帶過濾條件（--doc 單號 或 --code 料號），否則拒跑——絕不整表撈。
  2) 短逾時（預設 25 秒）：候選代碼若過濾沒生效想倒整表，25 秒自動斷線收手。
  3) 一次一個代碼、一發就停：不迴圈、不重試、不批次。看完輸出再自己決定下一步。
  4) 唯讀：只呼叫 LyDataOut，永不寫凌越。

**必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。**

怎麼用（一次一個代碼，慢慢來）
------------------------------
最安全：先在凌越畫面抄一張「進貨單」的單號，用 --doc 只查那一張：
    python ly_purchase_probe.py --kind 0000A3 --doc <那張進貨單號>

次之：挑一個「進貨筆數很少」的料號，用 --code：
    python ly_purchase_probe.py --kind 0000A3 --code <少量料號>

候選代碼建議「一個一個試」（銷貨/訂貨在 A 系列 A0/A1/A2，進貨常在鄰近號段）：
    0000A3 → 0000A4 → 0000A5 → 0000B1 → 0000B0
每試一個，看輸出：
  * 印出「N 筆 title / M 筆 detail」且欄位看起來像進貨（有料號/數量/日期）＝找到了。
  * 回「LyDataOut 失敗：…」＝這個代碼不是有效單別（安全，換下一個）。
  * 若某個代碼**跑很久沒回**＝先別再試那個；八成是過濾對它沒生效，等它逾時斷掉，
    把該代碼記下來回報，不要連續猛試。

拿到正確代碼後，正式上線只要在「凌越整合代理」設環境變數：
    LY_PURCHASE_IDAKD=<代碼>         # 例如 0000A3
    LY_PURCHASE_PREFIX=SP_/SD_       # 若欄位前綴不同（如 PP_/PD_）才改
不必改任何程式；ly_item_txn.py 會自動把進貨併進「近期進銷交易」的入庫(+)。
"""

import os
import sys
import argparse
from xml.etree import ElementTree as ET

sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

_LYDATAOUT_ERR = {"-1": "SQL連接失敗", "-2": "讀取失敗", "-3": "金鑰失效",
                  "-4": "金鑰不合法", "-5": "無權限"}


def _ensure_client(timeout):
    """建 SOAP client，operation_timeout 一起設短，讓失控查詢會自己斷。"""
    if getattr(lystk, "_client", None) is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(
        lystk.API_URL,
        settings=Settings(strict=False, xml_huge_tree=True),
        transport=Transport(timeout=timeout, operation_timeout=timeout),
    )


def _lydataout(icpno, idakd, det_fields, where, whval, order, timeout):
    """呼叫 LyDataOut，回 (titles, details)。過濾一律有值（呼叫端保證）。"""
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
        raise RuntimeError(f"LyDataOut 失敗：{_LYDATAOUT_ERR.get(rc, f'code={rc}')}（代碼可能不是有效單別）")
    xml = resp["ixmlda"]
    if not xml:
        return [], []
    root = ET.fromstring(str(xml))
    titles = [{c.tag: (c.text or "").strip() for c in t} for t in root.findall(".//LYDATATITLE")]
    details = [{c.tag: (c.text or "").strip() for c in d} for d in root.findall(".//LYDATADETAIL")]
    return titles, details


def probe(icpno, kind, hdr, det, mode, value, want_detail, timeout, show):
    """一次一發的探測查詢。回 (titles, details)。"""
    # 只請最少量欄位；欄位名猜錯時 LyDataOut 多半直接報錯（安全），不會硬倒表。
    if want_detail:
        det_fields = (f"{det}SEQ,{det}SKNO,{det}NAME,{det}UNIT,{det}QTY,"
                      f"{det}PRICE,{det}STOT,{det}NO,{det}DATE")
    else:
        det_fields = ""  # 只要抬頭：更輕，先確認單別存在與主表欄位
    if mode == "doc":
        where = f"{hdr}NO=@v1@"
    else:  # code
        where = f"{det}SKNO=@v1@"
        det_fields = det_fields or (f"{det}SEQ,{det}SKNO,{det}NAME,{det}QTY,{det}NO,{det}DATE")
    order = f"order by {hdr}NO desc"

    print(f"▶ 探測 idakd={kind}  icpno={icpno}  過濾 {where} = {value}"
          f"  逾時 {timeout}s（超過會自動斷線）", flush=True)
    titles, details = _lydataout(icpno, kind, det_fields, where, value, order, timeout)

    print(f"  ← 回傳：抬頭(title) {len(titles)} 筆、明細(detail) {len(details)} 筆", flush=True)
    # 印出實際欄位名 → 用來確認前綴（SP_/SD_ 還是 PP_/PD_…）與是否像進貨
    if titles:
        print(f"  抬頭欄位：{sorted(titles[0].keys())}")
    if details:
        print(f"  明細欄位：{sorted(details[0].keys())}")
    # 抽樣印前幾筆（受 --show 限制），方便肉眼判斷是不是進貨
    for i, t in enumerate(titles[:show]):
        print(f"  [抬頭 {i+1}] " + "  ".join(f"{k}={v}" for k, v in list(t.items())[:8]))
    for i, d in enumerate(details[:show]):
        print(f"  [明細 {i+1}] " + "  ".join(f"{k}={v}" for k, v in list(d.items())[:8]))
    if not titles and not details:
        print("  （代碼有效但這個過濾值查無資料——換一張確定有進貨的單號/料號再試，"
              "或這代碼不是進貨單。）")
    print("  判讀：欄位有『料號/數量/日期/進貨倉』且不是客戶銷貨 → 這個 idakd 很可能就是進貨單。")
    return titles, details


def build_parser():
    p = argparse.ArgumentParser(
        description="低風險探測凌越『進貨單』資料種類代碼（唯讀、一次一發、短逾時）")
    p.add_argument("--kind", required=True, help="要試的資料種類代碼 idakd（如 0000A3）")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--doc", help="用單號查（最安全，只回那一張）——凌越畫面抄一張進貨單號")
    g.add_argument("--code", help="用料號查（挑進貨筆數少的料號）")
    p.add_argument("--icpno", help="公司代碼（預設 00，或 LY_ICPNO）")
    p.add_argument("--prefix", default="SP_/SD_",
                   help="欄位前綴 主/明細（預設 SP_/SD_；不同單別可試 PP_/PD_）")
    p.add_argument("--detail", action="store_true",
                   help="連明細一起要（預設 --doc 只要抬頭、--code 要明細）")
    p.add_argument("--timeout", type=int, default=25,
                   help="逾時秒數（預設 25，故意設短防風暴；不要調很大）")
    p.add_argument("--show", type=int, default=5, help="最多印幾筆抽樣（預設 5）")
    return p


def run(args):
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    if icpno.lower() in ("all", ""):
        icpno = "00"  # 探測只打單一公司，避免 all 逐家掃
    pref = (args.prefix or "SP_/SD_").split("/")
    hdr = (pref[0].strip() or "SP_")
    det = (pref[1].strip() if len(pref) > 1 else "SD_") or "SD_"
    if args.timeout > 60:
        print(f"  ⚠ 逾時 {args.timeout}s 偏長；防風暴建議 ≤ 30s。", flush=True)
    mode = "doc" if args.doc else "code"
    value = args.doc if args.doc else args.code
    want_detail = bool(args.detail or mode == "code")
    try:
        probe(icpno, args.kind.strip(), hdr, det, mode, str(value).strip(),
              want_detail, args.timeout, max(1, args.show))
    except Exception as e:
        print(f"  ✗ {e}", flush=True)
        print("  → 這個代碼/前綴不通就換下一個試；一次只試一個，別連續猛打。", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
