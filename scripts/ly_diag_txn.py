#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_diag_txn.py — 診斷「銷貨明細查得到、但用料號篩會 0 筆」到底卡哪
==================================================================

做兩件事：
1. **不帶條件**撈最近的銷貨明細（0000A1），印出前 ~25 筆的
   單號/日期/料號/品名/數量 → 這樣可以看到**你實際的料號長怎樣**（確認 SG6 這類代碼對不對）。
2. 給 --code 時，用**幾種不同的過濾寫法**各查一次、報命中筆數，
   找出你這台凌越吃哪一種（含/不含單引號、SD_ 或 SP_ 欄）。

**跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。** 唯讀，不會改資料。

用法
----
  python ly_diag_txn.py                    # 只看最近銷貨明細、看料號格式
  python ly_diag_txn.py --code SG6         # 再測各種過濾寫法
  python ly_diag_txn.py --code SG6 --icpno 00
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


def call(icpno, idakd, where, whval, irec, iorder, idtorder="", timeout=90):
    _ensure_client(timeout)
    client = lystk.get_client()
    resp = client.service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=lystk.resolve_icpno(icpno), idakd=idakd,
        ifld="", idetfields="",
        irwhere=where, iwhval=whval,
        irec=irec, imode=" " * 30, iorder=iorder, idtorder=idtorder,
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

    print(f"■ 最近銷貨明細（0000A1，ICPNO={icpno}，不帶料號條件，看實際料號格式）")
    print("-" * 78)
    try:
        titles, details = call(icpno, SALES_IDAKD, "", "", 40, "order by SP_DATE desc")
        print(f"  抬頭 {len(titles)} 筆、明細 {len(details)} 筆（第一頁）")
        # 主單號 → 日期
        dmap = {}
        for t in titles:
            dmap[str(t.get("SP_NO", "")).strip()] = str(t.get("SP_DATE", "")).strip()[:10]
        shown = 0
        seen_codes = []
        print(f"  {'單號':<16}{'日期':<12}{'料號':<14}{'品名':<18}{'數量':>8}")
        for d in details:
            no = str(d.get("SD_NO", "")).strip()
            sk = str(d.get("SD_SKNO", "")).strip()
            if sk and sk not in seen_codes:
                seen_codes.append(sk)
            if shown < 25:
                date = dmap.get(no, "") or str(d.get("SD_DATE", "")).strip()[:10]
                print(f"  {no:<16}{date:<12}{sk:<14}{str(d.get('SD_NAME',''))[:16]:<18}"
                      f"{str(d.get('SD_QTY','')):>8}")
                shown += 1
        print(f"\n  這頁出現的料號（前 30 個）：{', '.join(seen_codes[:30]) or '（無）'}")
    except Exception as e:
        print(f"  ✗ 撈銷貨明細失敗：{e}")

    if not args.code:
        print("\n（想測過濾寫法，加 --code <料號>，最好從上面『實際料號』挑一個貼上）")
        return 0

    code = args.code.strip()
    print(f"\n■ 用料號「{code}」測各種過濾寫法命中幾筆（明細）")
    print("-" * 78)
    variants = [
        ("SD_SKNO=@v1@（不加引號）", "SD_SKNO=@v1@"),
        ("SD_SKNO='@v1@'（加單引號）", "SD_SKNO='@v1@'"),
        ("SP_SKNO=@v1@（抬頭欄）", "SP_SKNO=@v1@"),
        ("SP_SKNO='@v1@'（抬頭欄+引號）", "SP_SKNO='@v1@'"),
    ]
    for label, where in variants:
        try:
            t, d = call(icpno, SALES_IDAKD, where, code, 0, "order by SP_NO desc")
            hit = sum(1 for r in d if str(r.get("SD_SKNO", "")).strip() == code)
            print(f"  {label:<28} → 抬頭{len(t)} / 明細{len(d)}（其中料號吻合 {hit}）")
        except Exception as e:
            print(f"  {label:<28} → ✗ {e}")
    print("\n👉 把整段貼回給我：我看『實際料號格式』和『哪種寫法命中』就能把查詢修對。")
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="診斷銷貨明細料號過濾寫法（唯讀）")
    p.add_argument("--code", help="要測的料號（最好從上半段實際料號挑）")
    p.add_argument("--icpno", help="公司代碼（預設 00 或 LY_ICPNO）")
    p.add_argument("--timeout", type=int, default=90)
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
