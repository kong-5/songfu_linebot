#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_check_cjsum.py — 銷貨單「單據數量 SD_QTY vs 扣庫存數量 CJSUM」對帳（抓四捨五入）
==================================================================================

**問題背景**（2026-07 起追查）：凌越銷貨單明細裡有兩個數量——

  * `SD_QTY`  單據數量（秤重的實際重量，如 4.3）→ **正確**
  * `CJSUM`   實際扣庫存的數量（如 4）           → **被四捨五入**

兩者是兩支不同的寫入邏輯，所以會出現「銷貨單金額對、庫存卻扣錯」。殘量方向不固定
（4.3→4 少扣 0.3、1.8→2 多扣 0.2），**不會互相抵銷**，會永久留在庫存上變成盤差。
2026-08 廠商（壹立方）表示已修，本腳本就是用來**驗收今天的單到底修好了沒**。

    ⚠ 這支腳本只「讀」凌越、不寫任何東西。必須跑在能連凌越 LAN 的那台 Windows
      （`D:\\Work\\lystk_tool` 旁，或「凌越整合代理」資料夾）。雲端連不到凌越。

用法
----
  python ly_check_cjsum.py                          # 查今天（松富 00），只列有差的行
  python ly_check_cjsum.py --date 2026-08-03        # 查指定日期
  python ly_check_cjsum.py --date today --all       # 連沒差的行也一起列（看全貌）
  python ly_check_cjsum.py --icpno 02               # 松揚；01 龍港、03 松成
  python ly_check_cjsum.py --doc A202608030001      # 只查一張單
  python ly_check_cjsum.py --date today --fields    # 印第一張單的明細「全部欄位名」
  python ly_check_cjsum.py --date today --json out.json   # 存成 JSON 給廠商
  python ly_check_cjsum.py --selftest               # 不連凌越，驗算比對邏輯

驗收怎麼看
----------
  ✅ 全部相符          → 今天的單沒有四捨五入，修好了。
  ❌ 仍有四捨五入的行  → 把輸出整段貼給廠商（有單號＋料號＋兩個數字，賴不掉）。
  ⚠ 明細裡根本沒有 CJSUM 欄位 → 廠商可能改了欄位名，用 `--fields` 看實際欄位，
     再用 `--cj-field <欄位名>` 指定重跑。

環境變數：`LY_ICPNO` 公司代碼（預設 `00` 松富）。
"""

import os
import sys
import json
import argparse
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

IDAKD_SALES = "0000A1"  # 銷貨單
QTY_FIELD = "SD_QTY"    # 單據數量
CJ_FIELD = "CJSUM"      # 實際扣庫存的數量（凌越明細欄，無 SD_ 前綴）
EPS = Decimal("0.0001")  # 小於此視為相等（凌越回字串，避免浮點雜訊）


# ─────────────────────────────────────────────────────────────
#  純計算（--selftest 直接測這幾支，不需要凌越）
# ─────────────────────────────────────────────────────────────

def to_dec(v):
    """凌越所有值都是字串；轉 Decimal，轉不動回 None。"""
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    if s == "":
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def round_half_up(d: Decimal) -> Decimal:
    """四捨五入到整數（.5 一律進位）——凌越那邊的行為。"""
    return d.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def fmt(d) -> str:
    """去掉尾巴的 0，讓 4.30 印成 4.3、4 印成 4。"""
    if d is None:
        return "-"
    s = format(d.normalize(), "f")
    return s


def pick(row: dict, field: str):
    """欄位名大小寫不敏感取值。"""
    if field in row:
        return row[field]
    up = field.upper()
    for k, v in row.items():
        if k.upper() == up:
            return v
    return None


def classify_row(detail: dict, cj_field: str = CJ_FIELD) -> dict:
    """
    比對單一明細行。回傳：
      {code,name,unit,qty,cj,diff,kind}
    kind：
      ok        兩邊一致（正常）
      rounded   CJSUM 正好是 SD_QTY 四捨五入的結果 → 就是這個 BUG
      zero_qty  SD_QTY=0 但 CJSUM≠0（籃子那種：單據 0、庫存照扣）
      missing   這行沒有 CJSUM 欄位
      other     有差但不符上面任一種（要另外看）
    """
    qty = to_dec(pick(detail, QTY_FIELD))
    raw_cj = pick(detail, cj_field)
    cj = to_dec(raw_cj)
    out = {
        "code": (str(pick(detail, "SD_SKNO") or "")).strip(),
        "name": (str(pick(detail, "SD_NAME") or "")).strip(),
        "unit": (str(pick(detail, "SD_UNIT") or "")).strip(),
        "qty": qty,
        "cj": cj,
        "diff": None,
        "kind": "other",
    }
    if raw_cj is None:
        out["kind"] = "missing"
        return out
    if qty is None or cj is None:
        out["kind"] = "other"
        return out
    diff = qty - cj
    out["diff"] = diff
    if abs(diff) < EPS:
        out["kind"] = "ok"
    elif qty == 0:
        out["kind"] = "zero_qty"
    elif round_half_up(qty) == cj:
        out["kind"] = "rounded"
    return out


def summarize(rows: list) -> dict:
    """把 classify_row 的結果彙總成驗收數字。"""
    s = {
        "lines": len(rows),
        "ok": 0, "rounded": 0, "zero_qty": 0, "missing": 0, "other": 0,
        "abs_diff": Decimal("0"),
        "by_item": {},   # 料號 → {name, net(淨差), lines}
    }
    for r in rows:
        s[r["kind"]] = s.get(r["kind"], 0) + 1
        d = r["diff"]
        if d is None or r["kind"] == "ok":
            continue
        s["abs_diff"] += abs(d)
        it = s["by_item"].setdefault(r["code"], {"name": r["name"], "net": Decimal("0"), "lines": 0})
        it["net"] += d
        it["lines"] += 1
    return s


def verdict(s: dict) -> str:
    """一句話結論（給人看的驗收結果）。"""
    if s["lines"] == 0:
        return "⚠ 這個範圍查不到任何銷貨明細，先確認日期與公司別（--icpno）。"
    if s["missing"] == s["lines"]:
        return ("⚠ 明細裡完全沒有 CJSUM 欄位——廠商可能改了欄位名或移除了。"
                "\n   用 --fields 看實際欄位名，再 --cj-field <欄位名> 重跑。")
    bad = s["rounded"] + s["zero_qty"] + s["other"]
    if bad == 0:
        return f"✅ {s['lines']} 行全部相符（CJSUM = SD_QTY）——這個範圍沒有四捨五入。"
    parts = []
    if s["rounded"]:
        parts.append(f"四捨五入 {s['rounded']} 行")
    if s["zero_qty"]:
        parts.append(f"單據 0／庫存有扣 {s['zero_qty']} 行")
    if s["other"]:
        parts.append(f"其他差異 {s['other']} 行")
    return (f"❌ {s['lines']} 行中有 {bad} 行對不上（{'、'.join(parts)}），"
            f"絕對差合計 {fmt(s['abs_diff'])}——**還沒修好**，把本頁輸出貼給廠商。")


# ─────────────────────────────────────────────────────────────
#  凌越查詢（要 LAN）
# ─────────────────────────────────────────────────────────────

def load_lystk():
    """延後 import，讓 --selftest 在沒有凌越模組的機器上也能跑。"""
    sys.path.insert(0, r"D:\Work\lystk_tool")
    import lystk  # noqa: E402
    return lystk


def ensure_timeout_client(lystk, timeout: int):
    """lystk 預設沒設逾時、呼叫可能無限卡死；注入有逾時的 zeep 用戶端。"""
    if lystk._client is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(
        lystk.API_URL,
        settings=Settings(strict=False, xml_huge_tree=True),
        transport=Transport(timeout=timeout, operation_timeout=timeout),
    )


def fetch_details(lystk, icpno: str, doc_no: str) -> list:
    """撈某張銷貨單的全部明細欄位（idetfields='*' 才會帶出 CJSUM）。"""
    from xml.etree import ElementTree as ET
    resp = lystk.get_client().service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=lystk.resolve_icpno(icpno), idakd=IDAKD_SALES,
        ifld="", idetfields="*",
        irwhere="SP_NO='@v1@'", iwhval=doc_no,
        irec=0, imode=" " * 30, iorder="order by SP_NO", idtorder="",
        iswhere="", isifld="",
        Isecgroup="", iseckindfg="", iseckind="", Isecorder="", Isecrec=0,
    )
    if str(resp["LyDataOutResult"]) != "0" or not resp["ixmlda"]:
        return []
    root = ET.fromstring(str(resp["ixmlda"]))
    return [{c.tag: (c.text or "").strip() for c in d} for d in root.findall(".//LYDATADETAIL")]


# ─────────────────────────────────────────────────────────────
#  輸出
# ─────────────────────────────────────────────────────────────

MARK = {"ok": "  ", "rounded": "❌", "zero_qty": "⚠ ", "missing": "？", "other": "⚠ "}


def print_doc(doc: dict, rows: list, show_all: bool):
    """印一張單。預設只印有差的行；--all 印全部。"""
    shown = rows if show_all else [r for r in rows if r["kind"] not in ("ok",)]
    if not shown:
        return
    head = f"── {doc.get('SP_NO','')}  {str(doc.get('SP_CTNO','')).strip()} {str(doc.get('SP_CTNAME','')).strip()}"
    print(f"\n{head}")
    print(f"   {'料號':<12}{'品名':<20}{'SD_QTY':>10}{'CJSUM':>10}{'庫存差':>10}")
    for r in shown:
        print(f" {MARK.get(r['kind'], '  ')}{r['code']:<12}{r['name'][:18]:<20}"
              f"{fmt(r['qty']):>10}{fmt(r['cj']):>10}{fmt(r['diff']):>10}")


def print_summary(s: dict, span: str, icpno: str):
    print("\n" + "=" * 72)
    print(f"  {span}  公司 {icpno}  對帳結果")
    print("=" * 72)
    print(f"  明細行數 {s['lines']}｜相符 {s['ok']}｜四捨五入 {s['rounded']}"
          f"｜單據0庫存有扣 {s['zero_qty']}｜其他差異 {s['other']}｜無欄位 {s['missing']}")
    if s["by_item"]:
        top = sorted(s["by_item"].items(), key=lambda kv: abs(kv[1]["net"]), reverse=True)[:10]
        print(f"\n  逐料號淨差（影響庫存最大的前 {len(top)} 項；正數＝庫存少扣、系統庫存偏高）：")
        for code, it in top:
            print(f"    {code:<12}{it['name'][:18]:<20}{fmt(it['net']):>10}  （{it['lines']} 行）")
    print("\n  " + verdict(s).replace("\n", "\n  "))
    print()


# ─────────────────────────────────────────────────────────────
#  自我測試（不連凌越）
# ─────────────────────────────────────────────────────────────

def selftest() -> int:
    """用 2026-07-21 那批單的實際數字驗算比對邏輯。"""
    cases = [
        # (SD_QTY, CJSUM, 期望 kind, 期望 diff)
        ("4.3", "4", "rounded", "0.3"),
        ("1.8", "2", "rounded", "-0.2"),
        ("3.5", "4", "rounded", "-0.5"),    # .5 進位
        ("0.5", "1", "rounded", "-0.5"),
        ("1.4", "1", "rounded", "0.4"),
        ("54.8", "55", "rounded", "-0.2"),
        ("11.6", "12", "rounded", "-0.4"),
        ("10.2", "10", "rounded", "0.2"),
        ("0", "1", "zero_qty", "-1"),        # 四角方籃：單據 0、庫存照扣 1
        ("4.3", "4.3", "ok", "0"),           # 修好後應該長這樣
        ("4", "4", "ok", "0"),
        ("2.5", "9", "other", "-6.5"),       # 有差但不是四捨五入
    ]
    fails = []
    for qty, cj, want_kind, want_diff in cases:
        got = classify_row({"SD_SKNO": "T1", "SD_NAME": "測試", QTY_FIELD: qty, CJ_FIELD: cj})
        if got["kind"] != want_kind:
            fails.append(f"  {qty} vs {cj}：kind 應為 {want_kind}，實得 {got['kind']}")
        if fmt(got["diff"]) != fmt(to_dec(want_diff)):
            fails.append(f"  {qty} vs {cj}：diff 應為 {want_diff}，實得 {fmt(got['diff'])}")

    # 沒有 CJSUM 欄位
    miss = classify_row({"SD_SKNO": "T2", QTY_FIELD: "1.2"})
    if miss["kind"] != "missing":
        fails.append(f"  缺 CJSUM 欄位應為 missing，實得 {miss['kind']}")

    # 欄位名大小寫不敏感
    lower = classify_row({"SD_SKNO": "T3", "sd_qty": "4.3", "cjsum": "4"})
    if lower["kind"] != "rounded":
        fails.append(f"  小寫欄位名應照樣比得出來，實得 {lower['kind']}")

    # 彙總：全相符 → ✅；有四捨五入 → ❌
    all_ok = summarize([classify_row({"SD_SKNO": "A", QTY_FIELD: "4.3", CJ_FIELD: "4.3"})])
    if not verdict(all_ok).startswith("✅"):
        fails.append("  全部相符時應給 ✅ 結論")
    bad = summarize([classify_row({"SD_SKNO": "A", "SD_NAME": "南瓜", QTY_FIELD: "4.3", CJ_FIELD: "4"}),
                     classify_row({"SD_SKNO": "A", "SD_NAME": "南瓜", QTY_FIELD: "1.8", CJ_FIELD: "2"})])
    if not verdict(bad).startswith("❌"):
        fails.append("  有四捨五入時應給 ❌ 結論")
    if fmt(bad["by_item"]["A"]["net"]) != "0.1":   # +0.3 與 -0.2 逐料號淨差
        fails.append(f"  逐料號淨差應為 0.1，實得 {fmt(bad['by_item']['A']['net'])}")

    if fails:
        print("❌ selftest 失敗：")
        print("\n".join(fails))
        return 1
    print(f"✅ selftest 通過（{len(cases) + 5} 項）")
    return 0


# ─────────────────────────────────────────────────────────────
#  主流程
# ─────────────────────────────────────────────────────────────

def run(args) -> int:
    if args.selftest:
        return selftest()

    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    cj_field = (args.cj_field or CJ_FIELD).strip()
    lystk = load_lystk()
    ensure_timeout_client(lystk, args.timeout)

    # 決定要對帳哪些單
    if args.doc:
        span = f"單號 {args.doc}"
        print(f"▶ 查單 {args.doc}  公司 {icpno} …", flush=True)
        docs = lystk.query(icpno=icpno, idakd=IDAKD_SALES,
                           where="SP_NO='@v1@'", whval=args.doc)
    else:
        d = (args.date or "today").strip()
        day = lystk.resolve_date(d)
        span = day.strftime("%Y-%m-%d")
        print(f"▶ 查 {span} 的銷貨單  公司 {icpno} …", flush=True)
        docs = lystk.query(icpno=icpno, idakd=IDAKD_SALES, date=day)

    if not docs:
        print(f"\n⚠ 查無單據（{span}／公司 {icpno}）。"
              f"\n  日期對不對？公司別對不對（--icpno 00 松富／01 龍港／02 松揚／03 松成）？")
        return 0

    if args.prefix:
        docs = [r for r in docs if str(r.get("SP_NO", "")).strip().upper().startswith(args.prefix.upper())]
        print(f"  （只留單號開頭 {args.prefix} 的：{len(docs)} 張）", flush=True)
    if args.limit:
        docs = docs[: args.limit]

    print(f"  共 {len(docs)} 張，逐張撈明細比對 {QTY_FIELD} vs {cj_field} …", flush=True)

    all_rows, per_doc, dumped = [], [], False
    for i, doc in enumerate(docs, 1):
        no = str(doc.get("SP_NO", "")).strip()
        try:
            dets = fetch_details(lystk, icpno, no)
        except Exception as e:
            print(f"    … {no} 明細查詢失敗：{e}", flush=True)
            continue
        if args.fields and dets and not dumped:
            dumped = True
            print(f"\n  【{no} 明細第 1 行的全部欄位】（找 CJSUM 或它的替身用）")
            for k, v in dets[0].items():
                print(f"    {k:<16} {v}")
            print()
        rows = [classify_row(d, cj_field) for d in dets]
        all_rows += rows
        per_doc.append((doc, rows))
        if i % 20 == 0:
            print(f"    … 已處理 {i}/{len(docs)} 張", flush=True)

    for doc, rows in per_doc:
        print_doc(doc, rows, args.all)

    s = summarize(all_rows)
    print_summary(s, span, icpno)

    if args.json:
        payload = {
            "span": span, "icpno": icpno, "qty_field": QTY_FIELD, "cj_field": cj_field,
            "docs": len(per_doc),
            "summary": {k: (fmt(v) if isinstance(v, Decimal) else v)
                        for k, v in s.items() if k != "by_item"},
            "by_item": {c: {"name": it["name"], "net": fmt(it["net"]), "lines": it["lines"]}
                        for c, it in s["by_item"].items()},
            "rows": [
                {"doc": str(doc.get("SP_NO", "")).strip(),
                 "customer": str(doc.get("SP_CTNAME", "")).strip(),
                 "code": r["code"], "name": r["name"], "unit": r["unit"],
                 "qty": fmt(r["qty"]), "cj": fmt(r["cj"]), "diff": fmt(r["diff"]),
                 "kind": r["kind"]}
                for doc, rows in per_doc for r in rows
                if args.all or r["kind"] != "ok"
            ],
        }
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"📄 已寫出 {args.json}（可直接給廠商）\n")

    return 0


def build_parser():
    p = argparse.ArgumentParser(
        description="銷貨單 SD_QTY vs CJSUM 對帳——驗收凌越端的四捨五入有沒有修好（唯讀）")
    p.add_argument("--date", help="查哪一天 YYYY-MM-DD／today／yesterday（預設 today）")
    p.add_argument("--doc", help="只查一張單（單號），優先於 --date")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富；01 龍港、02 松揚、03 松成，或 LY_ICPNO）")
    p.add_argument("--all", action="store_true", help="連相符的行也一起列（預設只列有差的）")
    p.add_argument("--prefix", help="只對帳單號開頭符合的單，如 A（寺岡/EDI 回轉的單）")
    p.add_argument("--limit", type=int, help="最多對帳幾張單（先看樣本用）")
    p.add_argument("--fields", action="store_true", help="印第一張單明細的全部欄位名（CJSUM 被改名時用）")
    p.add_argument("--cj-field", help=f"指定扣庫存數量的欄位名（預設 {CJ_FIELD}）")
    p.add_argument("--json", help="把結果寫成 JSON 檔（給廠商佐證）")
    p.add_argument("--timeout", type=int, default=60, help="連線/操作逾時秒數（預設 60）")
    p.add_argument("--selftest", action="store_true", help="不連凌越，驗算比對邏輯（冒煙測試）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
