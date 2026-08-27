#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_diag_txn.py — 測「銷貨明細用料號過濾」哪種寫法命中（每步即時印、單步限時、不會整個卡死）
==========================================================================================

只做一件事：給 --code，用幾種過濾寫法各查一次、報命中筆數。
- 每一步查詢前先印「測試中…」，查完印結果；即時輸出（flush）。
- 每個查詢限時 --timeout 秒（預設 45），逾時就跳過、印「逾時」，不會卡死。

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


def _p(msg):
    print(msg, flush=True)


def _ensure_client(timeout):
    if getattr(lystk, "_client", None) is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(lystk.API_URL, settings=Settings(strict=False, xml_huge_tree=True),
                           transport=Transport(timeout=timeout, operation_timeout=timeout))


def call(icpno, where, whval, irec, timeout):
    _ensure_client(timeout)
    client = lystk.get_client()
    resp = client.service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=lystk.resolve_icpno(icpno), idakd=SALES_IDAKD,
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
    if not args.code:
        _p("請加 --code <料號>，例如：python ly_diag_txn.py --code LA1 --icpno 00")
        return 1
    code = args.code.strip()
    to = max(10, int(args.timeout or 45))
    _p(f"■ 測料號「{code}」ICPNO={icpno}　各過濾寫法命中幾筆（每步限時 {to} 秒）")
    _p("-" * 66)
    variants = [
        ("SD_SKNO='@v1@'  單引號", "SD_SKNO='@v1@'"),
        ("SD_SKNO=@v1@    無引號", "SD_SKNO=@v1@"),
        ("SP_SKNO='@v1@'  抬頭欄", "SP_SKNO='@v1@'"),
    ]
    for label, where in variants:
        _p(f"  測試 {label} … （查詢中，最多等 {to} 秒）")
        try:
            t, d = call(icpno, where, code, 300, to)
            hit = sum(1 for r in d if str(r.get("SD_SKNO", "")).strip() == code)
            _p(f"    → 抬頭{len(t)} / 明細{len(d)}　★料號吻合 {hit} 筆")
        except Exception as e:
            msg = str(e)
            if "timed out" in msg.lower() or "timeout" in msg.lower():
                _p("    → 逾時（這種寫法太慢，跳過）")
            else:
                _p(f"    → ✗ {msg[:120]}")
    _p("-" * 66)
    _p("👉 把整段貼回給我：哪一列『料號吻合』有數字，就是對的寫法。")
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="測銷貨明細料號過濾寫法（唯讀、即時印、單步限時）")
    p.add_argument("--code", help="料號，例如 LA1 或 \"SG6+10元\"")
    p.add_argument("--icpno", help="公司代碼（預設 00 或 LY_ICPNO）")
    p.add_argument("--timeout", type=int, default=45, help="每個查詢限時秒數（預設 45）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
