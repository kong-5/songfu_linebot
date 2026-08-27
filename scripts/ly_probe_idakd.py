#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_probe_idakd.py — 探測「這台凌越到底開放哪些資料種類、各自欄位長怎樣」
======================================================================

用途（兩件事一次做）
--------------------
1. **確認凌越連得到 / 帳號有權限**：只要能撈到任何一種資料，代表 LAN 連線與金鑰 OK，
   那「點品項沒資料」就一定是內網代理（凌越整合代理）舊版沒跑進銷查詢那條執行緒。
2. **找出所有會影響庫存的單別代碼**：把每個候選資料種類 idakd 打一次，回報：
   - 這個 idakd 有沒有資料（rc=0 且有筆數）
   - 主表/明細的欄位名稱（看前綴就知道是哪種單，如 PD_=進貨明細、TD_=調撥明細…）
   - 若給了 --code，順便回報這個料號在該單別出現幾筆
   → 把輸出整包貼回給我，我就能把「進貨/進退/調撥/盤點調整…」全部接進進銷交易抽屜。

**必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。**
這支是**唯讀**（只呼叫 LyDataOut），不會改到凌越任何資料，可安心跑。

用法
----
  python ly_probe_idakd.py --code 10100004
  python ly_probe_idakd.py --code 10100004 --icpno 00
  python ly_probe_idakd.py --extra 0000B0,0000B1,0000C0   # 額外多探幾個代碼
"""

import os
import sys
import argparse
from xml.etree import ElementTree as ET

sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

# 已知（凌越官方 API 文件列出的）+ 常見庫存異動單別的候選代碼。
# label 只是提示；沒資料/不支援的會標「—」。
KNOWN = {
    "000000": "貨品基本資料",
    "000001": "客戶基本資料",
    "000004": "倉庫基本資料",
    "000009": "目前庫存(廠內倉)",
    "00000D": "客戶基本資料(OUT)",
    "0000A0": "訂貨單",
    "0000A1": "銷貨單(出)",
    "0000A2": "銷貨退回單(入)",
}
# 猜測可能存在、和庫存進出有關的（各家凌越不一，用探的）：
GUESS = [
    "0000A3", "0000A4", "0000A5", "0000A6", "0000A7", "0000A8", "0000A9",
    "0000B0", "0000B1", "0000B2", "0000B3", "0000B4", "0000B5",
    "0000C0", "0000C1", "0000C2",
    "000002", "000003", "00000A", "00000B", "00000C", "00000E", "00000F",
]

_LYDATAOUT_ERR = {"-1": "SQL連接失敗", "-2": "讀取失敗", "-3": "金鑰失效",
                  "-4": "金鑰不合法", "-5": "無權限", "-7": "暫存檔不存在"}


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


def _call(icpno, idakd, where, whval, irec, timeout):
    _ensure_client(timeout)
    client = lystk.get_client()
    resp = client.service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=lystk.resolve_icpno(icpno), idakd=idakd,
        ifld="", idetfields="",           # 空=回全部欄位
        irwhere=where, iwhval=whval,
        irec=irec, imode=" " * 30, iorder="", idtorder="",
        iswhere="", isifld="",
        Isecgroup="", iseckindfg="", iseckind="", Isecorder="", Isecrec=0,
    )
    rc = str(resp["LyDataOutResult"])
    if rc != "0":
        return rc, [], []
    xml = resp["ixmlda"]
    if not xml:
        return "0", [], []
    root = ET.fromstring(str(xml))
    titles = [{c.tag: (c.text or "").strip() for c in t} for t in root.findall(".//LYDATATITLE")]
    details = [{c.tag: (c.text or "").strip() for c in d} for d in root.findall(".//LYDATADETAIL")]
    return "0", titles, details


def _tags(rows):
    tags = []
    for r in rows:
        for k in r.keys():
            if k not in tags:
                tags.append(k)
    return tags


def _find_skno_field(detail_tags, title_tags):
    """找像料號的欄位（結尾 SKNO，其次含 SKNO）。"""
    for pool in (detail_tags, title_tags):
        for t in pool:
            if t.upper().endswith("SKNO"):
                return t
        for t in pool:
            if "SKNO" in t.upper():
                return t
    return ""


def probe_one(icpno, idakd, code, timeout):
    out = {"idakd": idakd, "label": KNOWN.get(idakd, ""), "rc": "", "n_title": 0,
           "n_detail": 0, "title_tags": [], "detail_tags": [], "skno_field": "",
           "code_hits": None, "err": ""}
    try:
        rc, titles, details = _call(icpno, idakd, "", "", 1, timeout)  # 先撈 1 筆看結構
        out["rc"] = rc
        if rc != "0":
            out["err"] = _LYDATAOUT_ERR.get(rc, f"code={rc}")
            return out
        out["n_title"], out["n_detail"] = len(titles), len(details)
        out["title_tags"] = _tags(titles)
        out["detail_tags"] = _tags(details)
        skf = _find_skno_field(out["detail_tags"], out["title_tags"])
        out["skno_field"] = skf
        # 若能認出料號欄位，就用它篩該料號看有幾筆
        if code and skf:
            try:
                _, t2, d2 = _call(icpno, idakd, f"{skf}=@v1@", code, 0, timeout)
                pool = d2 if d2 else t2
                hits = sum(1 for r in pool if str(r.get(skf, "")).strip() == str(code).strip())
                out["code_hits"] = hits
            except Exception as e:
                out["code_hits"] = f"篩選失敗:{e}"
    except Exception as e:
        out["err"] = str(e)
    return out


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    codes = list(KNOWN.keys()) + list(GUESS)
    if args.extra:
        for c in args.extra.split(","):
            c = c.strip()
            if c and c not in codes:
                codes.append(c)
    print(f"▶ 探測凌越資料種類（ICPNO={icpno}{'，料號 ' + args.code if args.code else ''}）"
          f"　共 {len(codes)} 個代碼\n" + "=" * 70)
    found = []
    for idakd in codes:
        r = probe_one(icpno, args.code, idakd, args.timeout) if False else \
            probe_one(icpno, idakd, args.code, args.timeout)
        status = "OK" if r["rc"] == "0" else f"✗({r['err'] or r['rc']})"
        hit = ""
        if r["code_hits"] is not None:
            hit = f"　料號命中 {r['code_hits']} 筆"
        line = f"[{idakd}] {r['label'] or '(未知)':<14} {status}"
        if r["rc"] == "0":
            line += f"　主{r['n_title']}/明細{r['n_detail']}　料號欄={r['skno_field'] or '—'}{hit}"
            found.append(r)
        print(line)
    print("=" * 70)
    print("有資料的單別，欄位結構如下（看前綴判斷單別種類）：\n")
    for r in found:
        print(f"── [{r['idakd']}] {r['label'] or '(未知)'} "
              f"主{r['n_title']}/明細{r['n_detail']}　料號欄={r['skno_field'] or '—'}"
              + (f"　料號命中 {r['code_hits']} 筆" if r["code_hits"] is not None else ""))
        if r["title_tags"]:
            print("   主表欄位：" + ", ".join(r["title_tags"][:40]))
        if r["detail_tags"]:
            print("   明細欄位：" + ", ".join(r["detail_tags"][:40]))
        print()
    print("👉 把上面整段輸出貼回給我，我就能判斷你的凌越有哪些庫存異動單別、各自欄位，"
          "然後把進貨/進退/調撥/盤點調整…全部接進進銷交易抽屜。")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="探測凌越開放的資料種類與欄位（唯讀）")
    p.add_argument("--code", help="料號 SK_NO（給了會順便報該料號在各單別出現幾筆）")
    p.add_argument("--icpno", help="公司代碼（預設 00，或 LY_ICPNO）")
    p.add_argument("--extra", help="額外要探的代碼，逗號分隔，如 0000B0,0000B1")
    p.add_argument("--timeout", type=int, default=90, help="逾時秒數（預設 90）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
