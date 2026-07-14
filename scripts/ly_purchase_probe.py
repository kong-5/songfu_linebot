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
**預設＝列表探法（最安全也最準）**：不帶任何過濾，只叫凌越「這個單別給我前 N 筆」
（irec 硬上限，預設 3 筆），直接看回來的**真實欄位名**判斷是不是進貨：
    python ly_purchase_probe.py --kind 0000A3
    python ly_purchase_probe.py --kind 0000A4
    ...

候選代碼「一個一個試」（銷貨/訂貨在 A 系列 A0/A1/A2，進貨常在鄰近號段）：
    0000A3 → 0000A4 → 0000A5 → 0000A6 → 0000B0 → 0000B1
每試一個，看輸出：
  * 回「N 筆」且欄位像進貨（料號/數量/日期/供應商/進貨倉，前綴可能是 SP_/PP_/RV_…）＝**找到了**，
    把印出來的欄位名一起貼回給我，我判斷前綴。
  * 回「0 筆（沒過濾也 0）」＝這代碼沒資料/不是真單別（安全，換下一個）。
  * 回「LyDataOut 失敗：…」＝這代碼不是有效單別（安全，換下一個）。
  * 為什麼這樣安全：irec 上限只有 3 筆＋逾時 25s，就算誤打大表也只回 3 筆、網路不會爆。

為什麼不要再用「單號/料號過濾」去試未知代碼：
  凌越只要 WHERE 的欄位名對不上就**靜默回 0 筆、不報錯**（實測連 000000 貨品主檔用
  SP_NO 過濾也回 0）。所以「過濾＋0 筆」什麼都證明不了。要先用列表探法看到真欄位名、
  確定代碼與前綴後，才用 --doc/--code 去核對明細：
    python ly_purchase_probe.py --kind <確定代碼> --code <少量料號> --prefix SP_/SD_

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


def _lydataout(icpno, idakd, det_fields, where, whval, order, timeout, cap):
    """呼叫 LyDataOut，回 (titles, details)。

    cap = irec 筆數上限（>0，硬性只回這麼多筆；防止整表倒出造成內網風暴）。
    where 可空（列表探法）——此時純靠 cap 收斂結果。
    """
    if not cap or int(cap) < 1:
        raise ValueError("cap 必須 ≥ 1（不設上限會有整表倒出的風暴風險）")
    _ensure_client(timeout)
    client = lystk.get_client()
    resp = client.service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=lystk.resolve_icpno(icpno), idakd=idakd,
        ifld="", idetfields=det_fields,
        irwhere=where, iwhval=whval,
        irec=int(cap), imode=" " * 30, iorder=order, idtorder="",
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


def _fieldset(rows):
    """回傳這批 rows 出現過的所有欄位名（union，排序）。"""
    s = set()
    for r in rows:
        s.update(r.keys())
    return sorted(s)


def _guess_prefix(rows):
    """從欄位名猜主前綴（第一個底線前的字，取最多數）。回 '' 若猜不出。"""
    from collections import Counter
    c = Counter()
    for r in rows:
        for k in r.keys():
            if "_" in k:
                c[k.split("_", 1)[0] + "_"] += 1
    return c.most_common(1)[0][0] if c else ""


def _classify(prefix, rows):
    """依前綴/欄位給一句人話判定，幫忙一眼分辨是不是進貨。"""
    keys = set()
    for r in rows:
        keys.update(r.keys())
    has_skno = any(k.endswith("SKNO") for k in keys)  # 明細裡有料號（動庫存的單才有）
    p = (prefix or "").upper()
    if p in ("I_",):
        return "收/付款類（無料號、不動庫存）"
    if p in ("SP_", "SD_"):
        return "銷貨/銷退類"
    if p in ("OR_", "OD_"):
        return "訂單類（客戶需求端；有料號但不是進貨）"
    if p in ("CT_",):
        return "客戶/廠商主檔類"
    if p in ("SK_",):
        return "貨品主檔類"
    # 未知前綴 + 有料號 → 最可疑，可能就是進貨（供應商→入庫）
    if has_skno:
        return "★ 未知前綴且明細有料號 → 很可能是進貨單，重點看這個！"
    return "未知類（明細無料號）"


# 掃描用候選代碼（只掃這些；每個只取標題 2 筆，極輕）。已知的 A0/A1/A2 不掃。
SCAN_KINDS = [
    "0000A3", "0000A4", "0000A5", "0000A6", "0000A7", "0000A8", "0000A9",
    "0000AA", "0000AB", "0000AC", "0000AD", "0000AE", "0000AF",
    "0000B0", "0000B1", "0000B2", "0000B3",
    "000002", "000003", "000005", "000006", "000007", "000008",
    "00000A", "00000B", "00000C", "00000E", "00000F",
]


def scan(icpno, timeout):
    """安全掃描：候選代碼各只取標題 2 筆，一行印出判定。找可疑的再用 --kind 深看。"""
    print(f"▶ 掃描 {len(SCAN_KINDS)} 個候選代碼（各只取標題 2 筆，無過濾）icpno={icpno}"
          f" 逾時 {timeout}s/個", flush=True)
    print("  代碼      筆數  前綴     對象範例                判定", flush=True)
    print("  " + "-" * 78, flush=True)
    hits = []
    for k in SCAN_KINDS:
        try:
            titles, _ = _lydataout(icpno, k, "", "", "", "", timeout, cap=2)
        except Exception as e:
            print(f"  {k}    err   —        —                       {e}", flush=True)
            continue
        if not titles:
            print(f"  {k}     0    —        —                       （無資料/非單別）", flush=True)
            continue
        pref = _guess_prefix(titles)
        party = ""
        for r in titles:
            for kk in r:
                if kk.endswith("CTNAME") and r[kk]:
                    party = r[kk]
                    break
            if party:
                break
        verdict = _classify(pref, titles)
        if "很可能是進貨" in verdict:
            hits.append(k)
        print(f"  {k}  {len(titles):>4}    {pref or '?':<7} {party[:20]:<22} {verdict}", flush=True)
    print("  " + "-" * 78, flush=True)
    if hits:
        print(f"  ★ 最可疑（可能進貨）：{', '.join(hits)}  → 用："
              f"python ly_purchase_probe.py --kind {hits[0]}  深看欄位與明細", flush=True)
    else:
        print("  沒掃到『未知前綴＋有料號』的可疑單別。進貨很可能沒開放 LyDataOut 匯出，"
              "建議直接問 Dispatch 或改走自己掃碼收貨。", flush=True)


def probe(icpno, kind, hdr, det, mode, value, timeout, cap, show):
    """一次一發的探測查詢。回 (titles, details)。"""
    if mode == "list":
        # 列表探法：不帶過濾、只要抬頭、irec 硬上限 cap 筆 → 看真實欄位名 + 確認單別存在。
        det_fields, where, whval = "", "", ""
        order = ""  # 不指定排序，避免引用到未知的 {hdr}NO 欄位造成偏差
        head = f"▶ 探測 idakd={kind}  icpno={icpno}  列表前 {cap} 筆（無過濾）"
    elif mode == "doc":
        det_fields = ""  # 先只抬頭確認前綴
        where, whval = f"{hdr}NO=@v1@", value
        order = f"order by {hdr}NO desc"
        head = f"▶ 探測 idakd={kind}  icpno={icpno}  過濾 {where}={value}  上限 {cap} 筆"
    else:  # code
        det_fields = f"{det}SEQ,{det}SKNO,{det}NAME,{det}UNIT,{det}QTY,{det}PRICE,{det}STOT,{det}NO,{det}DATE"
        where, whval = f"{det}SKNO=@v1@", value
        order = f"order by {hdr}NO desc"
        head = f"▶ 探測 idakd={kind}  icpno={icpno}  過濾 {where}={value}  上限 {cap} 筆"

    print(head + f"  逾時 {timeout}s（超過會自動斷線）", flush=True)
    titles, details = _lydataout(icpno, kind, det_fields, where, whval, order, timeout, cap)

    print(f"  ← 回傳：抬頭(title) {len(titles)} 筆、明細(detail) {len(details)} 筆", flush=True)
    if titles:
        print(f"  抬頭欄位：{_fieldset(titles)}")
    if details:
        print(f"  明細欄位：{_fieldset(details)}")
    for i, t in enumerate(titles[:show]):
        print(f"  [抬頭 {i+1}] " + "  ".join(f"{k}={v}" for k, v in list(t.items())[:10]))
    for i, d in enumerate(details[:show]):
        print(f"  [明細 {i+1}] " + "  ".join(f"{k}={v}" for k, v in list(d.items())[:10]))

    if not titles and not details:
        if mode == "list":
            print("  → 沒過濾也 0 筆：這個代碼沒資料 / 不是有效單別。換下一個候選代碼。")
        else:
            print("  → 0 筆：多半是 WHERE 欄位名對不上（凌越會靜默回 0）。先用 --list（無過濾）"
                  "看真欄位名，或這代碼/前綴不對。")
    else:
        print("  → 判讀：欄位有『料號/數量/日期/供應商/進貨倉』且不是客戶銷貨 → 很可能就是進貨單。"
              "把上面欄位名貼回來我幫你確認前綴。")
    return titles, details


def build_parser():
    p = argparse.ArgumentParser(
        description="低風險探測凌越『進貨單』資料種類代碼（唯讀、一次一發、短逾時、irec 上限）")
    p.add_argument("--kind", help="要試的資料種類代碼 idakd（如 0000A3）；用 --scan 時可省略")
    p.add_argument("--scan", action="store_true",
                   help="安全掃描一批候選代碼（各只取標題 2 筆），一次找出可疑的進貨單別")
    # 預設＝列表探法（無過濾、只取前 cap 筆）；--doc/--code 為確認前綴後才用的核對模式。
    g = p.add_mutually_exclusive_group(required=False)
    g.add_argument("--doc", help="核對用：用單號查（前綴要對，否則靜默回 0）")
    g.add_argument("--code", help="核對用：用料號查（前綴要對）")
    p.add_argument("--icpno", help="公司代碼（預設 00，或 LY_ICPNO）")
    p.add_argument("--prefix", default="SP_/SD_",
                   help="--doc/--code 用的欄位前綴 主/明細（預設 SP_/SD_；可試 PP_/PD_）")
    p.add_argument("--cap", type=int, default=3,
                   help="irec 筆數上限（預設 3，防風暴的硬上限；列表探法就靠它收斂）")
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
    cap = max(1, int(args.cap))
    if args.timeout > 60:
        print(f"  ⚠ 逾時 {args.timeout}s 偏長；防風暴建議 ≤ 30s。", flush=True)
    if cap > 20:
        print(f"  ⚠ cap {cap} 偏大；探測用 ≤ 5 筆就夠，設小一點更安全。", flush=True)
    if args.scan:
        try:
            scan(icpno, args.timeout)
        except Exception as e:
            print(f"  ✗ 掃描中止：{e}", flush=True)
            return 1
        return 0
    if not args.kind:
        print("  ✗ 請給 --kind <代碼>，或用 --scan 掃描一批候選代碼。", flush=True)
        return 2
    if args.doc:
        mode, value = "doc", args.doc
    elif args.code:
        mode, value = "code", args.code
    else:
        mode, value = "list", ""  # 預設：無過濾、只取前 cap 筆
    try:
        probe(icpno, args.kind.strip(), hdr, det, mode, str(value).strip(),
              args.timeout, cap, max(1, args.show))
    except Exception as e:
        print(f"  ✗ {e}", flush=True)
        print("  → 這個代碼不通就換下一個試；一次只試一個，別連續猛打。", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
