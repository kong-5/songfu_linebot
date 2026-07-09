#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
chk.py — 一次確認：銷貨明細用「真實料號」過濾撈不撈得到（結果同時寫進 chk_out.txt）
================================================================================

放到 D:\\Work\\lystk_tool，執行：
    python chk.py LA1
    python chk.py LA1 00
    python chk.py "SG6+10元" 00

會在同資料夾產生 chk_out.txt，把「哪種寫法命中幾筆＋前幾筆資料」寫進去。
把 chk_out.txt 的內容貼回給我即可（唯讀，不會改凌越）。
"""

import os
import sys
from xml.etree import ElementTree as ET

sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chk_out.txt")
_lines = []


def p(msg=""):
    print(msg, flush=True)
    _lines.append(str(msg))


def flush_file():
    try:
        with open(OUT, "w", encoding="utf-8") as f:
            f.write("\n".join(_lines))
    except Exception as e:
        print("寫檔失敗：" + str(e), flush=True)


def ensure_client(timeout=45):
    if getattr(lystk, "_client", None) is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(lystk.API_URL, settings=Settings(strict=False, xml_huge_tree=True),
                           transport=Transport(timeout=timeout, operation_timeout=timeout))


def query(icpno, where, whval, irec=50, timeout=45):
    ensure_client(timeout)
    client = lystk.get_client()
    resp = client.service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=lystk.resolve_icpno(icpno), idakd="0000A1",
        ifld="", idetfields="", irwhere=where, iwhval=whval,
        irec=irec, imode=" " * 30, iorder="", idtorder="",
        iswhere="", isifld="", Isecgroup="", iseckindfg="", iseckind="",
        Isecorder="", Isecrec=0,
    )
    rc = str(resp["LyDataOutResult"])
    if rc != "0":
        raise RuntimeError("LyDataOut rc=" + rc)
    xml = resp["ixmlda"]
    if not xml:
        return []
    root = ET.fromstring(str(xml))
    return [{c.tag: (c.text or "").strip() for c in d} for d in root.findall(".//LYDATADETAIL")]


def main():
    code = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    icpno = sys.argv[2].strip() if len(sys.argv) > 2 else (os.environ.get("LY_ICPNO") or "00")
    if not code:
        p("用法：python chk.py 料號 [公司別]　例如：python chk.py LA1 00")
        flush_file()
        return 1
    p("=== chk.py 料號=%s ICPNO=%s ===" % (code, icpno))
    for label, where in (("A) 加單引號 SD_SKNO='@v1@'", "SD_SKNO='@v1@'"),
                         ("B) 不加引號 SD_SKNO=@v1@", "SD_SKNO=@v1@")):
        p("")
        p(label + "  查詢中…（最多 45 秒）")
        try:
            rows = query(icpno, where, code)
            hit = [r for r in rows if str(r.get("SD_SKNO", "")).strip() == code]
            p("   回明細 %d 筆，其中料號吻合 %d 筆" % (len(rows), len(hit)))
            for r in hit[:5]:
                p("     %s  %s  %s  數量=%s  單價=%s  小計=%s" % (
                    str(r.get("SD_NO", ""))[:16], str(r.get("SD_DATE", ""))[:10],
                    str(r.get("SD_NAME", ""))[:14], r.get("SD_QTY", ""),
                    r.get("SD_PRICE", ""), r.get("SD_STOT", "")))
        except Exception as e:
            p("   ✗ 失敗/逾時：" + str(e)[:150])
        flush_file()
    p("")
    p("（結果已寫到 chk_out.txt，把內容貼回給我）")
    flush_file()
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    except Exception:
        pass
    sys.exit(main())
