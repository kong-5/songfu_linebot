#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_query_stock.py — 查品項目前庫存（貨品主檔 000000）/ 匯出 Excel（內網 agent 用）
=================================================================================

輸入品項（料號）→ 回該品項在凌越的「目前庫存數量」，可批次、可匯出 Excel。
**必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）**，雲端連不到。

為什麼查貨品主檔（000000）而不是庫存（000009）
----------------------------------------------
  凌越技術人員說「沒有現成庫存報表；庫存是到該品項去關聯、裡面有該品項的目前庫存」。
  也就是「目前在庫量」是掛在【貨品主檔 000000】的某個欄位（結存/現有量），
  而不是每品項都有一筆獨立庫存單。實測 000009（庫存）只有「有批號」的品項才出得來，
  非批號品項不會出現 → 所以用 000009 加總無法涵蓋全部品項，要改用貨品主檔的結存欄位。

  ⚠ 貨品主檔的「料號欄位名」與「庫存欄位名」目前**尚未確認**。
    先用 `--dump` 撈前幾筆、本工具會自動把「數字型 + 名稱像庫存」的欄位標成候選，
    確認欄名後再用 `--code-field / --stock-field` 指定（或改本檔的預設值）。

作法
----
  沿用 lystk.py 內建的 lystk.query()，但**先注入一個有逾時的 zeep 用戶端** ——
  lystk 預設 _build_client() 沒設逾時，操作呼叫可能無限卡死；帶 Transport(timeout=) 即正常。

用法
----
  # 1) 欄位發現：撈貨品主檔前 5 筆，全欄位＋自動標出庫存候選欄（先跑這個！）
  python ly_query_stock.py --dump
  python ly_query_stock.py --dump --limit 10

  # 2) 查單一品項（技術人員說的「到該品項去關聯」）：印該品項全欄位＋候選欄
  #    --code-field 是料號欄名（預設猜 SK_NO，用 --dump 確認後改）
  python ly_query_stock.py --item A001
  python ly_query_stock.py --item A001 --code-field SK_NO

  # 3) 批次查「輸入品項 → 目前庫存」，並匯出 Excel（欄名已內建預設，免打 --*-field）
  python ly_query_stock.py --items "10100004,10100005,10100006" --xlsx D:\\stock.xlsx
  python ly_query_stock.py --items-file D:\\codes.txt --xlsx D:\\stock.xlsx

  # 4) 全品項匯出（不指定品項）→ 撈整張貨品主檔的 料號/品名/規格/單位/目前庫存
  python ly_query_stock.py --all --xlsx D:\\stock_all.xlsx

欄位（2026-07 於松富 ICPNO=00 用 --dump 實測確認）：
  料號 SK_NO、品名 SK_NAME、規格 SK_SPEC、單位 SK_UNIT、目前庫存 SK_NOWQTY（現有量，即時變動）。
  換公司別若欄名不同，用 --code-field / --stock-field / --name-field 覆寫，或先跑 --dump 確認。

環境變數：LY_ICPNO 公司代碼，預設 "00"（松富；01=龍港、03=桂田）。
"""

import os
import re
import sys
import argparse

# 讓本機找得到 lystk（ly_datain / ly_query_unchecked_sales 也是這樣 import 的）
sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402  內建 query() / dump_xlsx() 等

KIND_GOODS = "000000"  # 貨品主檔

# 貨品主檔欄位名（已於 2026-07 用 --dump 在松富 ICPNO=00 實測確認）。
DEFAULT_CODE_FIELD = "SK_NO"      # 料號欄（貨品編號）
DEFAULT_NAME_FIELD = "SK_NAME"    # 品名欄
DEFAULT_STOCK_FIELD = "SK_NOWQTY"  # 目前庫存（現有量）★ 即時變動，確認為「目前在庫量」
DEFAULT_SPEC_FIELD = "SK_SPEC"    # 規格（如 20KG/件）
DEFAULT_UNIT_FIELD = "SK_UNIT"    # 單位（如 KG）

# 判斷「這欄名像不像庫存/數量」用的關鍵字（中英都放）。
STOCK_HINTS = ("庫", "存", "結存", "現量", "現有", "在庫", "數量", "餘",
               "STOCK", "QTY", "QOH", "ONHAND", "KEEP", "BAL", "AMT", "INV", "NUM")


def ensure_timeout_client(timeout: int):
    """建一個有逾時的 zeep 用戶端注入 lystk，避免預設無逾時卡死。"""
    if getattr(lystk, "_client", None) is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(
        lystk.API_URL,
        settings=Settings(strict=False, xml_huge_tree=True),
        transport=Transport(timeout=timeout, operation_timeout=timeout),
    )


# ----------------------------------------------------------------------
#  欄位發現輔助
# ----------------------------------------------------------------------

def _looks_numeric(v) -> bool:
    """值看起來是不是數字（含小數/千分位/負號/空白）。空字串不算。"""
    s = str(v).strip().replace(",", "")
    if s == "":
        return False
    return bool(re.fullmatch(r"-?\d+(\.\d+)?", s))


def _to_number(v):
    """把庫存欄的值轉成數字（失敗回原字串）。"""
    s = str(v).strip().replace(",", "")
    if _looks_numeric(s):
        f = float(s)
        return int(f) if f.is_integer() else f
    return str(v).strip()


def stock_candidates(rec: dict) -> list:
    """從一筆記錄挑出「像庫存」的欄位：欄名含關鍵字，或是數字型欄位。回傳 (欄名, 值, 是否命中關鍵字)。"""
    hits = []
    for k, v in rec.items():
        name_hit = any(h in k.upper() or h in k for h in STOCK_HINTS)
        num = _looks_numeric(v)
        if name_hit or num:
            hits.append((k, v, name_hit))
    # 名稱命中的排前面，其次才是純數字欄
    hits.sort(key=lambda t: (not t[2],))
    return hits


def print_record(rec: dict, title: str):
    """印一筆記錄的全欄位，並在最後列出庫存候選欄。"""
    print(f"\n── {title} ── 共 {len(rec)} 欄")
    for k, v in rec.items():
        print(f"    {k:<18} {v}")
    cands = stock_candidates(rec)
    if cands:
        print("\n  【庫存候選欄位】（★＝欄名像庫存；其餘為數字型欄，供參考）")
        for k, v, name_hit in cands:
            star = "★" if name_hit else " "
            print(f"    {star} {k:<18} = {v!r}")
        print("  → 認出目前庫存欄後，之後用  --stock-field <欄名>  指定（並可回填本檔 DEFAULT_STOCK_FIELD）")


# ----------------------------------------------------------------------
#  查詢
# ----------------------------------------------------------------------

def query_one(icpno: str, code_field: str, code: str) -> dict | None:
    """依料號查貨品主檔單一品項，回第一筆（查無回 None）。"""
    rows = lystk.query(icpno=icpno, idakd=KIND_GOODS,
                       where=f"{code_field}='@v1@'", whval=code)
    return rows[0] if rows else None


def export_xlsx(rows, path):
    try:
        p = lystk.dump_xlsx(rows, path)
        print(f"\n📄 已匯出 Excel：{p}", flush=True)
    except Exception as e:
        print(f"\n⚠ 匯出 Excel 失敗：{e}（需要 pip install openpyxl）", flush=True)


def read_codes(args) -> list:
    """從 --items（逗號/空白分隔）或 --items-file（每行一個）讀料號清單。"""
    codes = []
    if args.items:
        codes += [c.strip() for c in re.split(r"[,\s]+", args.items) if c.strip()]
    if args.items_file:
        with open(args.items_file, encoding="utf-8") as f:
            codes += [ln.strip() for ln in f if ln.strip() and not ln.startswith("#")]
    # 去重但保序
    seen, out = set(), []
    for c in codes:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def print_stock_table(rows: list):
    print(f"\n品項目前庫存（{len(rows)} 筆）：\n")
    print(f"  {'料號':<12}{'品名':<20}{'規格':<12}{'單位':<6}{'目前庫存':>10}")
    print("  " + "-" * 62)
    for r in rows:
        print(f"  {str(r['料號']):<12}{str(r['品名'])[:18]:<20}"
              f"{str(r['規格'])[:10]:<12}{str(r['單位']):<6}{str(r['目前庫存']):>10}")


# ----------------------------------------------------------------------
#  主流程
# ----------------------------------------------------------------------

def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    code_field = (args.code_field or DEFAULT_CODE_FIELD).strip()
    name_field = (args.name_field or DEFAULT_NAME_FIELD).strip()
    stock_field = (args.stock_field or DEFAULT_STOCK_FIELD).strip()
    spec_field = DEFAULT_SPEC_FIELD
    unit_field = DEFAULT_UNIT_FIELD
    ensure_timeout_client(args.timeout)

    # ── 模式 1：欄位發現 — 撈貨品主檔前 N 筆，全欄位＋標候選庫存欄 ───────────
    if args.dump:
        n = args.limit or 5
        print(f"▶ 撈貨品主檔 {KIND_GOODS} 前 {n} 筆原始欄位  ICPNO={icpno} …", flush=True)
        rows = lystk.query(icpno=icpno, idakd=KIND_GOODS, limit=n)
        if not rows:
            print(f"\n⚠ ICPNO={icpno} 的 {KIND_GOODS}（貨品主檔）沒有資料（公司別可能不對）。")
            return 0
        for i, r in enumerate(rows, 1):
            print_record(r, f"第 {i} 筆")
        if args.xlsx:
            export_xlsx(rows, args.xlsx)
        return 0

    # ── 模式 1b：撈任意資料種類前 N 筆全欄位（如 000004 倉庫主檔、000009 庫存）─────
    if args.dump_kind:
        kind = args.dump_kind.strip()
        n = args.limit or 20
        print(f"▶ 撈資料種類 {kind} 前 {n} 筆原始欄位  ICPNO={icpno} …", flush=True)
        rows = lystk.query(icpno=icpno, idakd=kind, limit=n)
        if not rows:
            print(f"\n⚠ ICPNO={icpno} 的 {kind} 沒有資料（公司別可能不對，或此種類需帶條件）。")
            return 0
        for i, r in enumerate(rows, 1):
            print(f"\n── 第 {i} 筆 ── 共 {len(r)} 欄")
            for k, v in r.items():
                print(f"    {k:<18} {v}")
        if args.xlsx:
            export_xlsx(rows, args.xlsx)
        return 0

    # ── 模式 2：查單一品項（「到該品項去關聯」）— 全欄位＋標候選欄 ──────────
    if args.item:
        print(f"▶ 查品項 {args.item}  貨品主檔 {KIND_GOODS}  ICPNO={icpno}"
              f"  （料號欄={code_field}）…", flush=True)
        rec = query_one(icpno, code_field, args.item)
        if rec is None:
            print(f"\n⚠ 查無品項 {args.item}（ICPNO={icpno}、料號欄={code_field}）。"
                  f"\n  可能：(1) 料號欄名不是 {code_field} → 先跑  --dump  看真正欄名；"
                  f"\n        (2) 公司別 ICPNO 不對；(3) 料號本身不存在。")
            return 0
        print_record(rec, f"品項 {args.item}")
        if stock_field and stock_field in rec:
            print(f"\n  ✅ 目前庫存（{stock_field}）＝ {_to_number(rec[stock_field])}")
        if args.xlsx:
            export_xlsx([rec], args.xlsx)
        return 0

    # ── 模式 3 / 4：批次或全品項 → 料號/品名/目前庫存 表格＋Excel ────────────
    if args.items or args.items_file or args.all:
        if not stock_field:
            print("❌ 尚未指定庫存欄位。請先用  --dump  找出目前庫存欄名，"
                  "再加  --stock-field <欄名>  重跑（或回填本檔 DEFAULT_STOCK_FIELD）。",
                  file=sys.stderr)
            return 2

        if args.all:
            print(f"▶ 撈整張貨品主檔  ICPNO={icpno}  料號={code_field} 品名={name_field} 庫存={stock_field} …",
                  flush=True)
            raw_all = lystk.query(icpno=icpno, idakd=KIND_GOODS)
            # 停用品（SK_STOP=1）排除，與雲端推送一致；--keep-stop 可保留
            if getattr(args, "keep_stop", False):
                raw = list(raw_all)
            else:
                raw = [r for r in raw_all if str(r.get("SK_STOP", "")).strip().upper() not in ("1", "Y", "YES", "TRUE")]
                dropped = len(raw_all) - len(raw)
                if dropped:
                    print(f"  （已排除停用品 {dropped} 項 SK_STOP=1）", flush=True)
            print(f"  貨品主檔共 {len(raw)} 筆", flush=True)
        else:
            codes = read_codes(args)
            if not codes:
                print("❌ 沒有讀到任何料號（--items 或 --items-file）。", file=sys.stderr)
                return 2
            print(f"▶ 批次查 {len(codes)} 個品項  ICPNO={icpno}  料號={code_field} 庫存={stock_field} …",
                  flush=True)
            raw = []
            for c in codes:
                rec = query_one(icpno, code_field, c)
                if rec is None:
                    print(f"    … {c}  查無此料號", flush=True)
                    raw.append({code_field: c, name_field: "(查無此料號)", stock_field: ""})
                else:
                    print(f"    … {c}  庫存 {rec.get(stock_field, '(無此欄)')}", flush=True)
                    raw.append(rec)

        # 整理成三欄輸出
        out = []
        for rec in raw:
            out.append({
                "料號": str(rec.get(code_field, "")).strip(),
                "品名": str(rec.get(name_field, "")).strip(),
                "規格": str(rec.get(spec_field, "")).strip(),
                "單位": str(rec.get(unit_field, "")).strip(),
                "目前庫存": _to_number(rec.get(stock_field, "")),
            })
        print_stock_table(out)
        if args.xlsx:
            export_xlsx(out, args.xlsx)
        return 0

    print("請指定模式：--dump（找欄位）、--item CODE（查單一品項）、"
          "或 --items/--items-file/--all（批次＋匯出）。用 -h 看說明。", file=sys.stderr)
    return 2


def build_parser():
    p = argparse.ArgumentParser(description="查品項目前庫存（貨品主檔 000000）並可匯出 Excel")
    p.add_argument("--dump", action="store_true", help="撈貨品主檔前幾筆全欄位，自動標出庫存候選欄（先跑這個找欄名）")
    p.add_argument("--item", help="查單一品項（料號），印全欄位＋候選欄")
    p.add_argument("--items", help="批次查：逗號/空白分隔的料號清單")
    p.add_argument("--items-file", dest="items_file", help="批次查：檔案，每行一個料號（# 開頭略過）")
    p.add_argument("--all", action="store_true", help="全品項：撈整張貨品主檔的 料號/品名/目前庫存（預設排除停用品 SK_STOP=1）")
    p.add_argument("--keep-stop", dest="keep_stop", action="store_true", help="搭配 --all：保留停用品（預設排除）")
    p.add_argument("--dump-kind", dest="dump_kind", help="撈任意資料種類前 N 筆全欄位（如 000004 倉庫主檔、000009 庫存）")
    p.add_argument("--code-field", dest="code_field", help=f"料號欄名（預設 {DEFAULT_CODE_FIELD}，用 --dump 確認後改）")
    p.add_argument("--name-field", dest="name_field", help=f"品名欄名（預設 {DEFAULT_NAME_FIELD}）")
    p.add_argument("--stock-field", dest="stock_field", help="目前庫存欄名（批次/全品項必填；用 --dump 找出）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富；01 龍港、03 桂田，或 LY_ICPNO）")
    p.add_argument("--limit", type=int, help="搭配 --dump：撈幾筆（預設 5）")
    p.add_argument("--xlsx", help="把結果匯出成 Excel（給路徑，如 D:\\stock.xlsx）")
    p.add_argument("--timeout", type=int, default=60, help="連線/操作逾時秒數（預設 60）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
