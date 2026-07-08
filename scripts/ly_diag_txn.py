#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_diag_txn.py — 診斷「用料號篩銷貨明細會 0 筆」到底卡哪（快速版，不做整表排序）
==============================================================================

給 --code 時，用**幾種不同的過濾寫法**各查一次、報命中筆數，
找出你這台凌越吃哪一種（含/不含單引號、SD_ 或 SP_ 欄）。
另外先撈一小頁銷貨明細（不排序，很快）看實際料號格式。

**跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。** 唯讀，不會改資料。

用法
----
  python ly_diag_txn.py --code LA1 --icpno 00
  python ly_diag_txn.py --code "SG6+10元" --icpno 00
"""

import os
import sys
import argparse
from xml.etree import ElementTree as ET

sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

SALES_IDAKD = "0000A1"
_ERR = {"-1": "SQL連接失敗", "-2": "讀取失敗", "-3": "金鑰失效", "-4": "金鑰不合法", "-5": "無權限"}


def _ensure_client(timeout=90):
    if getattr(lystk, "_client", None) is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(lystk.API_URL, settings=Settings(strict=False, xml_huge_tree=True),
                           transport=Transport(timeout=timeout, operation_timeout=timeout))


def call(icpno, idakd, where, whval, irec, timeout=90):
    """不帶排序（避免整表 order by 變慢）。irec>0＝只回第一頁 irec 筆。"""
    _ensure_client(timeout)
    client = lystk.get_client()
    resp = client.service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=lystk.resolve_icpno(icpno), idakd=idakd,
        ifld="", idetfields="",
        irwhere=where, iwhval=whval,
        irec=irec, imode=" " * 30, iorder="", idtorder="",
        iswhere="", isifld="",
        Isecgroup="", iseckindfg="", iseckind="", Isecorder="", Isecrec=0,
    )
    rc = str(resp["LyDataOutResult"])
    if rc != "0":
        raise RuntimeError(_ERR.get(rc, f"code={rc}"))
    xml = resp["ixmlda"]
    if not xml:
        return [], []
    root = ET.fromstring(str(xml))
    titles = [{c.tag: (c.text or "").strip() for c in t} for t in root.findall(".//LYDATATITLE")]
    details = [{c.tag: (c.text or "").strip() for c in d} for d in root.findall(".//LYDATADETAIL")]
    return titles, details


def run(args):
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()

    print(f"■ 銷貨明細一小頁（0000A1，ICPNO={icpno}，不排序、很快）看實際料號")
    print("-" * 70)
    try:
        _titles, details = call(icpno, SALES_IDAKD, "", "", 20)
        codes = []
        for d in details:
            sk = str(d.get("SD_SKNO", "")).strip()
            if sk and sk not in codes:
                codes.append(sk)
        for d in details[:12]:
            print(f"  {str(d.get('SD_NO','')):<16}{str(d.get('SD_SKNO','')):<14}"
                  f"{str(d.get('SD_NAME',''))[:16]:<18}{str(d.get('SD_QTY','')):>8}")
        print(f"  料號範例：{', '.join(codes[:20]) or '（無）'}")
    except Exception as e:
        print(f"  ✗ {e}")

    if not args.code:
        print("\n（加 --code <料號> 測過濾寫法，例如 --code LA1）")
        return 0

    code = args.code.strip()
    print(f"\n■ 用料號「{code}」測各種過濾寫法命中幾筆（irec=300 限量，不會卡）")
    print("-" * 70)
    variants = [
        ("SD_SKNO=@v1@（不加引號）", "SD_SKNO=@v1@"),
        ("SD_SKNO='@v1@'（加單引號）", "SD_SKNO='@v1@'"),
        ("SP_SKNO=@v1@（抬頭欄）", "SP_SKNO=@v1@"),
        ("SP_SKNO='@v1@'（抬頭欄+引號）", "SP_SKNO='@v1@'"),
    ]
    for label, where in variants:
        try:
            t, d = call(icpno, SALES_IDAKD, where, code, 300)
            hit = sum(1 for r in d if str(r.get("SD_SKNO", "")).strip() == code)
            print(f"  {label:<26} → 抬頭{len(t):>4} / 明細{len(d):>4}（料號吻合 {hit}）")
        except Exception as e:
            print(f"  {label:<26} → ✗ {e}")
    print("\n👉 把整段貼回給我：哪一列『料號吻合』有數字，就是對的寫法。")
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="診斷銷貨明細料號過濾寫法（唯讀、不排序）")
    p.add_argument("--code", help="要測的料號，例如 LA1 或 \"SG6+10元\"")
    p.add_argument("--icpno", help="公司代碼（預設 00 或 LY_ICPNO）")
    p.add_argument("--timeout", type=int, default=90)
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
