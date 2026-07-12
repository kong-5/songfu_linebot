#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_query_daily_sales.py — 查「一天」的銷貨單金額（只抓主表，不撈明細）
====================================================================

給「每日帳款收款」功能做資料測試用。**只查單一日期**、**只取主表**
（SP_NO 單號、SP_DATE 日期、SP_CTNAME 客戶、SP_TOTAL 金額），
**完全不撈明細（SD_）**，所以一天的資料量很小（通常幾十～一兩百列），
不會造成網路風暴。

必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。雲端連不到。

兩種單號分開加總
----------------
依你說的：
  * 純數字單號  = 直接打入凌越的銷貨單
  * A 開頭單號  = 訂單拋轉寺岡(Teraoka)後經 admin.178go.com.tw EDI 回轉的銷貨單
本腳本會把當天銷貨單依 SP_NO 是否以字母 A 開頭分成兩組，各自算張數與金額，
再給總計。（若 A 類其實不在 0000A1 而是別的單別，這裡就只會看到純數字組，
 那代表要另外指定單別——把結果貼回來就知道。）

用法
----
  python ly_query_daily_sales.py --date 2026-07-11
  python ly_query_daily_sales.py --date 2026-07-11 --icpno 00      # 松富(預設)
  python ly_query_daily_sales.py --date 2026-07-11 --icpno 03      # 桂田/松成
  python ly_query_daily_sales.py --date 2026-07-11 --json          # 輸出 JSON(供程式串接)
  python ly_query_daily_sales.py --date 2026-07-11 --list          # 逐張列出單號+金額

環境變數：LY_ICPNO 公司代碼，預設 "00"（松富；01 龍港、03 桂田/松成）。
"""

import os
import sys
import json
import argparse
import datetime

# 用機器上「權威版」lystk（與現有查詢腳本一致）
sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

IDAKD_SALES = "0000A1"  # 銷貨單


def ensure_timeout_client(timeout: int):
    """注入有逾時的 zeep 用戶端，避免 lystk 預設無逾時卡死。"""
    if lystk._client is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(
        lystk.API_URL,
        settings=Settings(strict=False, xml_huge_tree=True),
        transport=Transport(timeout=timeout, operation_timeout=timeout),
    )


def to_amount(v) -> float:
    """SP_TOTAL 是字串，可能空/含逗號；安全轉數字。"""
    s = str(v or "").strip().replace(",", "")
    if s in ("", "-"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def is_a_series(sp_no: str) -> bool:
    """單號去空白後以字母 A 開頭 → 寺岡 EDI 回轉那類。"""
    return str(sp_no or "").strip().upper().startswith("A")


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    day = datetime.date.fromisoformat(args.date.strip())  # 驗證格式
    ds = day.isoformat()
    company = lystk.COMPANIES.get(icpno, icpno)

    ensure_timeout_client(args.timeout)

    # --customer CT_NO：倒出客戶主檔(00000D)某客戶的全部欄位，找「結帳方式(CT_FKFS)」。
    if args.customer:
        ct = args.customer.strip()
        print(f"▶ 查客戶主檔 00000D  ICPNO={icpno}  CT_NO={ct} …", flush=True)
        try:
            rows = lystk.query(icpno=icpno, idakd="00000D",
                               where="CT_NO='@v1@'", whval=ct) or []
        except Exception as e:
            print(f"⚠ where 查詢失敗（{e}），改抓前 200 筆本地過濾…", flush=True)
            rows = [r for r in (lystk.query(icpno=icpno, idakd="00000D", limit=200) or [])
                    if str(r.get("CT_NO", "")).strip() == ct]
        if not rows:
            print(f"⚠ 客戶主檔找不到 CT_NO={ct}。")
            return 0
        r = rows[0]
        print(f"── 客戶 {ct} 全部欄位（共 {len(r)} 欄）──")
        for k, v in r.items():
            print(f"    {k:<16} {str(v).strip()!r}")
        hints = {k: v for k, v in r.items()
                 if any(t in k.upper() for t in ("FKFS", "PAY", "CASH", "REM", "NAME", "ROUTE", "SALE", "TERM", "結"))}
        if hints:
            print("\n  【可能相關欄位（結帳方式/付款/備註）】")
            for k, v in hints.items():
                print(f"    {k:<16} {str(v).strip()!r}")
        return 0

    # --fields：把當天某一張（或第一張）銷貨單的「所有欄位」倒出來，
    # 用來找「結帳方式／付款方式」是哪一欄（SP_FKFS 之類）。
    if args.fields is not None:
        rows = lystk.query(icpno=icpno, idakd=IDAKD_SALES, date=ds) or []
        if not rows:
            print(f"⚠ {ds} 查無銷貨單，無法倒欄位。")
            return 0
        target = None
        want = str(args.fields).strip()
        if want and want != "__first__":
            target = next((r for r in rows if str(r.get("SP_NO", "")).strip() == want), None)
            if target is None:
                print(f"⚠ 當天找不到單號 {want}，改倒第一張。")
        if target is None:
            target = rows[0]
        print(f"── 銷貨單 {str(target.get('SP_NO','')).strip()} 全部欄位（共 {len(target)} 欄）──")
        for k, v in target.items():
            print(f"    {k:<16} {str(v).strip()!r}")
        # 順手把「看起來像結帳/付款方式」的欄位挑出來提示
        hints = {k: v for k, v in target.items()
                 if any(t in k.upper() for t in ("FKFS", "PAY", "CASH", "MONEY", "REM", "CHECK", "SALES", "DPNO", "CTNO"))}
        if hints:
            print("\n  【可能相關欄位】")
            for k, v in hints.items():
                print(f"    {k:<16} {str(v).strip()!r}")
        return 0

    if not args.json:
        print(f"▶ 查 {ds} 銷貨單金額  ICPNO={icpno}（{company}）… 只抓主表、不撈明細", flush=True)

    try:
        rows = lystk.query(icpno=icpno, idakd=IDAKD_SALES, date=ds) or []
    except Exception as e:
        msg = f"查詢失敗：{e}"
        if args.json:
            print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
        else:
            print(f"\n⚠ {msg}\n  檢查：這台是否連得到凌越({lystk.API_URL})、公司別 ICPNO 是否正確。")
        return 1

    # 分兩組加總
    a_rows = [r for r in rows if is_a_series(r.get("SP_NO"))]
    num_rows = [r for r in rows if not is_a_series(r.get("SP_NO"))]
    a_sum = sum(to_amount(r.get("SP_TOTAL")) for r in a_rows)
    num_sum = sum(to_amount(r.get("SP_TOTAL")) for r in num_rows)
    grand = a_sum + num_sum

    if args.json:
        out = {
            "ok": True,
            "date": ds,
            "icpno": icpno,
            "company": company,
            "count": len(rows),
            "numeric": {"count": len(num_rows), "amount": round(num_sum, 2)},
            "a_series": {"count": len(a_rows), "amount": round(a_sum, 2)},
            "total_amount": round(grand, 2),
        }
        if args.list:
            out["orders"] = [
                {
                    "sp_no": str(r.get("SP_NO", "")).strip(),
                    "date": str(r.get("SP_DATE", "")).strip()[:10],
                    "customer": str(r.get("SP_CTNAME", "")).strip(),
                    "amount": to_amount(r.get("SP_TOTAL")),
                    "kind": "A" if is_a_series(r.get("SP_NO")) else "num",
                }
                for r in rows
            ]
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    if not rows:
        print(f"\n⚠ {ds} 查無銷貨單。可能：公司別 ICPNO={icpno} 不對、或該日沒單。")
        return 0

    if args.list:
        print(f"\n  {'SP_NO':<16}{'日期':<12}{'客戶':<20}{'金額':>12}  類型")
        print("  " + "-" * 66)
        for r in sorted(rows, key=lambda x: str(x.get("SP_NO", ""))):
            kind = "A(寺岡)" if is_a_series(r.get("SP_NO")) else "純數字"
            print(f"  {str(r.get('SP_NO','')).strip():<16}"
                  f"{str(r.get('SP_DATE','')).strip()[:10]:<12}"
                  f"{str(r.get('SP_CTNAME','')).strip():<20}"
                  f"{to_amount(r.get('SP_TOTAL')):>12,.0f}  {kind}")

    print(f"\n── {ds}　{company}　當日銷貨單金額 ──")
    print(f"  純數字（直打凌越）：{len(num_rows):>4} 張    金額 {num_sum:>14,.0f}")
    print(f"  A 開頭（寺岡EDI）：{len(a_rows):>4} 張    金額 {a_sum:>14,.0f}")
    print(f"  " + "-" * 44)
    print(f"  合計：            {len(rows):>4} 張    金額 {grand:>14,.0f}")
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="查一天銷貨單金額（主表，不撈明細）")
    p.add_argument("--date", required=True, help="查詢日期 YYYY-MM-DD（必填，只查這一天）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富；01 龍港、03 桂田/松成，或 LY_ICPNO）")
    p.add_argument("--list", action="store_true", help="逐張列出單號+金額（否則只印分組合計）")
    p.add_argument("--fields", nargs="?", const="__first__", metavar="SP_NO",
                   help="倒出某張銷貨單全部欄位（找結帳方式那欄用）；不給單號＝當天第一張")
    p.add_argument("--customer", metavar="CT_NO",
                   help="倒出客戶主檔(00000D)某客戶全部欄位，找結帳方式(CT_FKFS)；CT_NO＝銷貨單的 SP_CTNO")
    p.add_argument("--json", action="store_true", help="輸出 JSON（供程式串接；配 --list 附逐張）")
    p.add_argument("--timeout", type=int, default=60, help="連線/操作逾時秒數（預設 60）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
