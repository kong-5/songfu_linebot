#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_writeback_undo.py — 刪除「誤寫進凌越的訂貨單」救援工具（內網 agent 用）
============================================================================

用途：把一批**寫錯/不該寫**進凌越的訂貨單，依單號整批刪除。
     （例如自動回寫誤把一整天的訂單都寫進去了，用這支把它們刪回來。）

**務必跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。**

安全設計
--------
  - 預設 **dry-run**：只「回查」每個單號、印出來給你核對，**不會刪**。
  - 確認無誤後再加 `--confirm` 才會真的刪除。
  - 逐筆刪除，單筆失敗不影響其他筆；最後印出成功/失敗統計。

指定要刪的單號（三選一）
------------------------
  --range 起 迄     連號區間，含頭尾。例：--range 202607080064 202607080123
  --docs "a,b,c"    明確列出單號，逗號分隔。
  --file 路徑        一行一個單號的文字檔。

設定
----
  LY_ICPNO 或 --icpno   公司代碼，預設 "00"（松富）。

用法
----
  # 1) 先核對（不刪）：回查這 60 個單號，印出日期/客戶/摘要
  python ly_writeback_undo.py --range 202607080064 202607080123

  # 2) 核對沒錯後，真的刪除
  python ly_writeback_undo.py --range 202607080064 202607080123 --confirm
"""

import os
import sys
import argparse

sys.path.insert(0, r"D:\Work\lystk_tool")
import ly_order  # noqa: E402  提供 verify_or_no / delete_order


def build_doc_list(args) -> list:
    if args.range:
        lo, hi = args.range
        # 用整數展開連號；保留原本字串長度（前導不變，凌越訂貨單號為純數字）
        width = max(len(lo), len(hi))
        a, b = int(lo), int(hi)
        if a > b:
            a, b = b, a
        return [str(n).zfill(width) for n in range(a, b + 1)]
    if args.docs:
        return [s.strip() for s in args.docs.split(",") if s.strip()]
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip()]
    return []


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    docs = build_doc_list(args)
    if not docs:
        print("❌ 請用 --range / --docs / --file 指定要刪的單號。", file=sys.stderr)
        return 2

    mode = "正式刪除" if args.confirm else "核對(dry-run，不刪)"
    print(f"▶ 凌越訂貨單刪除工具　ICPNO={icpno}　共 {len(docs)} 個單號　模式：{mode}")
    print("─" * 60)

    ok = fail = missing = 0
    for no in docs:
        rec = None
        try:
            rec = ly_order.verify_or_no(icpno, no)
        except Exception as e:
            print(f"  {no}  ⚠ 回查失敗：{e}")
        if not rec:
            print(f"  {no}  ⚪ 查無此單（可能已刪或不存在）— 略過")
            missing += 1
            continue

        info = f"日期={rec.get('OR_DATE1', '?')}  客戶={rec.get('OR_CTNAME', '?')}  摘要={rec.get('OR_REM', '')}"
        if not args.confirm:
            print(f"  {no}  ✅ 存在　{info}")
            ok += 1
            continue

        try:
            rc = ly_order.delete_order(icpno, no)
            if str(rc) == "0":
                print(f"  {no}  🗑 已刪除　{info}")
                ok += 1
            else:
                print(f"  {no}  ❌ 刪除回傳 rc={rc}（非 0）　{info}")
                fail += 1
        except Exception as e:
            print(f"  {no}  ❌ 刪除失敗：{e}")
            fail += 1

    print("─" * 60)
    if args.confirm:
        print(f"完成：已刪 {ok}，失敗 {fail}，查無 {missing}，共 {len(docs)}。")
    else:
        print(f"核對：存在 {ok}，查無 {missing}，共 {len(docs)}。")
        print("👉 確認無誤後，加上 --confirm 再跑一次即可真的刪除。")
    return 0 if fail == 0 else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="刪除誤寫進凌越的訂貨單（依單號）")
    p.add_argument("--range", nargs=2, metavar=("起", "迄"), help="連號區間，含頭尾")
    p.add_argument("--docs", help="明確列出單號，逗號分隔")
    p.add_argument("--file", help="一行一個單號的文字檔")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--confirm", action="store_true", help="真的刪除（不加＝只核對不刪）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
