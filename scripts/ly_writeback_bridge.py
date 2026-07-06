#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_writeback_bridge.py — 雲端後台 ↔ 凌越 ERP 回寫橋接（內網 agent 用）
=====================================================================

跑在已能連到凌越 LAN 的那台機器（D:\\Work\\lystk_tool 旁），把雲端後台的
「待回寫訂單」寫進凌越【訂貨單／客戶訂單】，再把凌越配發的單號回填到後台顯示。

單別（2026-07-04 定案）
----------------------
  ※ 寫入凌越「訂貨單（客戶訂單）」= 資料種類 0000A0，用 ly_order.write_order。
    （不是銷貨單 0000A1；客戶 LINE 叫貨屬「訂單」階段，之後在凌越再轉銷貨出貨。）
  ※ 若日後要改寫銷貨單，改回 import ly_datain 並用 SP_/SD_ 欄位即可（見 git 舊版）。

流程
----
  1. GET  {CLOUD}/admin/lingyue-writeback/pending?date=YYYY-MM-DD   （帶 X-Writeback-Key）
  2. 每張訂單 → 組成 ly_order.write_order 的 row → 寫入凌越訂貨單
     （單號 OR_NO 由 ly_order 依「當日既有單據最大流水 +1」自動順編，不會撞號）
  3. POST {CLOUD}/admin/lingyue-writeback/callback  回填凌越單號

欄位對映（雲端 pending → 凌越訂貨單）
------------------------------
  主表： customer_code→OR_CTNO  customer_name→OR_CTNAME  order_date→OR_DATE1/OR_DATE2  doc_remark→OR_REM
  明細： product_code→OD_SKNO  product_name→OD_NAME  unit→OD_UNIT  quantity→OD_QTY
         item_note→OD_REM   OD_WARE=（預設留空，之後在凌越補倉別）
         OD_PRICE=（預設留空＝不送，讓凌越依客戶售價表自動帶價）

設定（環境變數，或用 CLI 參數覆蓋）
-----------------------------------
  LY_CLOUD_BASE     雲端後台網址，如 https://xxxx.run.app（必填）
  LY_WRITEBACK_KEY  與後台環境變數 LINGYUE_WRITEBACK_KEY 相同的金鑰（必填）
  LY_ICPNO          公司代碼，預設 "00"（松富）
  LY_DEFAULT_WHNO   預設倉別 OD_WARE，預設 ""（留空；若凌越不接受空倉別，改設成如 FN005）
  LY_DEFAULT_PRICE  預設單價 OD_PRICE，預設 ""（留空＝不送單價，讓凌越依客戶售價表自動帶；
                    只有確實要強制單價時才設，如 LY_DEFAULT_PRICE=0 會強制變 0）

用法
----
  # 1) 先試跑（只抓資料、組單、印出來，不寫凌越、不回填）— 確認對映正確
  python ly_writeback_bridge.py --date 2026-07-04 --dry-run

  # 2) 寫「一張」測試訂貨單（OR_REM 標記【API測試請刪除】）→ 驗證 → 自動刪除；不回填後台
  #    用這步確認「倉別留空 + 單價留空」凌越會不會收。加 --keep 可保留不刪、自己進 ERP 看。
  python ly_writeback_bridge.py --date 2026-07-04 --test

  # 3) 確認沒問題後，正式整批回寫並回填後台
  python ly_writeback_bridge.py --date 2026-07-04
"""

import os
import sys
import json
import argparse
import datetime
import urllib.request
import urllib.error

# 讓本機找得到 ly_order（與探索工具同目錄）
sys.path.insert(0, r"D:\Work\lystk_tool")
import ly_order  # noqa: E402  提供 write_order / verify_or_no / delete_order
import lystk     # noqa: E402  用來從客戶主檔(000001)帶付款方式

TEST_REM_PREFIX = "【API測試請刪除】"


# ----------------------------------------------------------------------
#  從客戶主檔帶付款方式（凌越畫面選客戶會自動帶，API 寫入需自己補）
# ----------------------------------------------------------------------

_fkfs_cache: dict = {}


def _timeout_client():
    """lystk 預設用戶端沒設逾時、可能卡死；注入一個有逾時的。"""
    if lystk._client is None:
        from zeep import Client, Settings
        from zeep.transports import Transport
        lystk._client = Client(
            lystk.API_URL,
            settings=Settings(strict=False, xml_huge_tree=True),
            transport=Transport(timeout=60, operation_timeout=60),
        )
    return lystk._client


def customer_record(icpno: str, ctno: str) -> dict:
    """讀客戶主檔(000001)整筆，回 dict（快取；查不到/失敗回 {}）。"""
    if not ctno:
        return {}
    ck = (icpno, ctno)
    if ck in _fkfs_cache:
        return _fkfs_cache[ck]
    rec: dict = {}
    try:
        _timeout_client()
        rows = lystk.query(icpno=icpno, idakd="000001",
                           where="CT_NO='@v1@'", whval=ctno)
        if rows:
            rec = rows[0]
    except Exception as e:
        print(f"    ⚠ 查客戶 {ctno} 主檔失敗（略過）：{e}", file=sys.stderr)
    _fkfs_cache[ck] = rec
    return rec


def customer_defaults(icpno: str, ctno: str) -> dict:
    """
    從客戶主檔帶可直接併入訂貨單 row 的預設值（凌越畫面選客戶會自動帶，API 需自己補）：
      CT_FKFS  → OR_FKFS （付款方式）
      CT_SALES → OR_SALES（業務員）
    空值就不帶。
    """
    rec = customer_record(icpno, ctno)
    out: dict = {}
    fkfs = (rec.get("CT_FKFS") or "").strip()
    sales = (rec.get("CT_SALES") or "").strip()
    if fkfs:
        out["OR_FKFS"] = fkfs
    if sales:
        out["OR_SALES"] = sales
    return out


def run_test_ctno(args, *, icpno, whno, price, create_name, date_str) -> int:
    """為指定客戶寫一張測試訂貨單（標【API測試請刪除】），驗證付款方式/業務員有無帶入。"""
    ctno = args.test_ctno.strip()
    cust = customer_record(icpno, ctno)
    if not cust:
        print(f"❌ 查無客戶 {ctno}（ICPNO={icpno}）", file=sys.stderr)
        return 1
    ctname = (cust.get("CT_NAME") or "").strip()
    print(f"▶ 客戶 {ctno} {ctname}｜客戶主檔 CT_FKFS={cust.get('CT_FKFS','')!r} "
          f"CT_SALES={cust.get('CT_SALES','')!r}")

    # 測試明細需要一個有效料號；沒指定就自動抓一個貨品主檔的料號
    skno = (args.test_skno or "").strip()
    skname = ""
    if not skno:
        _timeout_client()
        prods = lystk.query(icpno=icpno, idakd="000000", limit=1)
        if prods:
            skno = (prods[0].get("SK_NO") or "").strip()
            skname = (prods[0].get("SK_NAME") or "").strip()
    if not skno:
        print("❌ 找不到可用料號，請用 --test-skno 指定一個有效料號", file=sys.stderr)
        return 1

    order = {
        "customer_code": ctno, "customer_name": ctname,
        "order_date": date_str, "doc_remark": "",
        "items": [{"product_code": skno, "product_name": skname, "unit": "KG", "quantity": 1}],
    }
    row = map_order(order, icpno=icpno, whno=whno, price=price,
                    create_name=create_name, rem_prefix=TEST_REM_PREFIX)
    print(f"  即將寫入：OR_FKFS={row.get('OR_FKFS','')!r} OR_SALES={row.get('OR_SALES','')!r} "
          f"OR_CREATEDATE={row.get('OR_CREATEDATE','')} OR_CREATENAME={row.get('OR_CREATENAME','')} "
          f"料號={skno}")
    try:
        new_nos = ly_order.write_order(icpno=icpno, rows=[row], verbose=True)
    except RuntimeError as e:
        print(f"❌ 寫入失敗：{e}", file=sys.stderr)
        return 1
    or_no = new_nos[0]
    print(f"\n✅ 已寫入測試訂貨單 {or_no}（備註【API測試請刪除】）")
    print(f"   查實際欄位：python ly_query_unchecked_sales.py --doc {or_no}")
    print(f"   → 確認 OR_FKFS 有沒有帶到 {cust.get('CT_FKFS','')!r}；有帶到就代表匯入付款方式成功。")
    print(f"   刪除測試單：python -c \"import sys;sys.path.insert(0,r'D:\\Work\\lystk_tool');"
          f"import ly_order;print(ly_order.delete_order('{icpno}','{or_no}'))\"")
    return 0


# ----------------------------------------------------------------------
#  HTTP（用標準庫 urllib，免裝 requests）
# ----------------------------------------------------------------------

def _http(method: str, url: str, key: str, body: dict | None = None, timeout: int = 60) -> dict:
    data = None
    headers = {"X-Writeback-Key": key, "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} {method} {url}\n  {detail}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"連線失敗 {method} {url}：{e.reason}") from None
    return json.loads(raw) if raw.strip() else {}


def fetch_pending(base: str, key: str, date_str: str) -> list:
    url = f"{base.rstrip('/')}/admin/lingyue-writeback/pending?date={date_str}"
    res = _http("GET", url, key)
    return res.get("orders", []) or []


def post_callback(base: str, key: str, results: list) -> dict:
    url = f"{base.rstrip('/')}/admin/lingyue-writeback/callback"
    return _http("POST", url, key, {"results": results})


# ----------------------------------------------------------------------
#  雲端訂單 → 凌越 write_order row（訂貨單 OR_/OD_ 欄位）
# ----------------------------------------------------------------------

def map_order(order: dict, *, icpno: str, whno: str, price: str,
              create_name: str, rem_prefix: str = "") -> dict:
    """把一張雲端 pending 訂單轉成 ly_order.write_order 需要的 row dict。"""
    details = []
    for it in order.get("items", []) or []:
        skno = (it.get("product_code") or "").strip()
        name = (it.get("product_name") or "").strip()
        if not skno:
            # 凌越不收沒有料號的明細行 → 跳過並警示，避免整張單寫入失敗（品項需人工補料號）
            print(f"    ⚠ 跳過無凌越料號品項：{name or '(無名)'}（客戶 {order.get('customer_name')}）", file=sys.stderr)
            continue
        qty = it.get("quantity")
        det = {
            "OD_SKNO": skno,
            "OD_NAME": name,
            "OD_UNIT": (it.get("unit") or "KG").strip(),
            "OD_WARE": whno,                       # 預設留空（之後在凌越補倉別）
            "OD_QTY": qty if qty is not None else 0,
        }
        # 單價：叫貨單無價。留空（不送 OD_PRICE）→ 讓凌越依「客戶售價表」自動帶價。
        # 只有當明確指定 LY_DEFAULT_PRICE / --price（非空）時才強制覆寫單價。
        if price not in (None, ""):
            det["OD_PRICE"] = price
        note = (it.get("item_note") or "").strip()
        if note:
            det["OD_REM"] = note
        details.append(det)

    rem = (order.get("doc_remark") or "").strip()
    if rem_prefix:
        rem = (rem_prefix + rem).strip()

    order_date = (order.get("order_date") or "").strip().replace("/", "-")  # 正規化成 YYYY-MM-DD（雲端可能給斜線）
    ctno = (order.get("customer_code") or "").strip()
    # 建立日期/建立人：API 寫入不會自動蓋，需自己帶；否則下游拋轉（依建立日期抓單）抓不到。
    create_dt = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    row = {
        "OR_CTNO": ctno,
        "OR_CTNAME": (order.get("customer_name") or "").strip(),
        "OR_DATE1": order_date,
        "OR_DATE2": order_date,
        "OR_REM": rem,
        "OR_CHECK": "0",                                      # 不審核，方便需要時刪除
        "OR_CREATEDATE": create_dt,                          # 建立日期（拋轉依此抓單）
        "OR_CREATENAME": create_name,                        # 建立人代碼
        "details": details,
    }
    # 付款方式(OR_FKFS)/業務員(OR_SALES)：凌越畫面選客戶會自動帶，API 需自己從客戶主檔補。
    row.update(customer_defaults(icpno, ctno))
    return row


# ----------------------------------------------------------------------
#  主流程
# ----------------------------------------------------------------------

def run(args) -> int:
    base = (args.base or os.environ.get("LY_CLOUD_BASE") or "").strip()
    key = (args.key or os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    whno = args.warehouse if args.warehouse is not None else os.environ.get("LY_DEFAULT_WHNO", "")
    price = args.price if args.price is not None else os.environ.get("LY_DEFAULT_PRICE", "")
    create_name = (args.create_name or os.environ.get("LY_CREATE_NAME") or "052").strip()
    date_str = args.date or datetime.date.today().strftime("%Y-%m-%d")

    # 指定客戶寫測試單：不需雲端 pending，直接寫凌越驗證欄位帶入
    if args.test_ctno:
        return run_test_ctno(args, icpno=icpno, whno=whno, price=price,
                             create_name=create_name, date_str=date_str)

    if not base or not key:
        print("❌ 請設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY（或用 --base / --key）", file=sys.stderr)
        return 2

    print(f"▶ 抓取雲端待回寫訂單 date={date_str} ...")
    orders = fetch_pending(base, key, date_str)
    print(f"  共 {len(orders)} 張訂單")
    if not orders:
        print("  沒有待回寫的訂單，結束。")
        return 0

    # ── dry-run：只組單印出，不寫凌越、不回填 ───────────────────────
    if args.dry_run:
        for o in orders:
            row = map_order(o, icpno=icpno, whno=whno, price=price, create_name=create_name)
            print(f"\n── order_id={o.get('order_id')}  客戶={row['OR_CTNO']} {row['OR_CTNAME']} ──")
            print(json.dumps(row, ensure_ascii=False, indent=2))
        print("\n(dry-run：未寫入凌越、未回填)")
        return 0

    # ── test：只寫第一張（標記測試）→ 驗證 →（預設）刪除；不回填 ──────
    if args.test:
        o = orders[0]
        row = map_order(o, icpno=icpno, whno=whno, price=price,
                        create_name=create_name, rem_prefix=TEST_REM_PREFIX)
        print(f"\n▶ 測試寫入第一張：order_id={o.get('order_id')}  客戶={row['OR_CTNO']} {row['OR_CTNAME']}")
        try:
            new_nos = ly_order.write_order(icpno=icpno, rows=[row], verbose=True)
        except RuntimeError as e:
            print(f"❌ 測試寫入失敗：{e}")
            print("   （若是倉別/單價被拒，請調整 LY_DEFAULT_WHNO / LY_DEFAULT_PRICE 後再試）")
            return 1
        or_no = new_nos[0]
        print(f"✅ 測試寫入成功，凌越訂貨單號 = {or_no}")
        rec = ly_order.verify_or_no(icpno, or_no)
        if rec:
            print("  回查 ERP：")
            for f in ["OR_NO", "OR_DATE1", "OR_CTNAME", "OR_TOT", "OR_SUM", "OR_REM", "OR_CHECK"]:
                print(f"    {f:<12} {rec.get(f, '(無)')}")
            print(f"    明細行數     {len(rec.get('_details', []))}")
        else:
            print("  ⚠️ 回查不到，可能有延遲")
        if args.keep:
            print(f"  --keep：保留測試單 {or_no}，請自行到凌越確認後刪除。")
        else:
            rc = ly_order.delete_order(icpno, or_no)
            print(f"  已刪除測試單 {or_no}（LyDataDel rc={rc}，0=成功）")
        print("\n(test：未回填後台。確認無誤後，拿掉 --test 正式整批回寫。)")
        return 0

    # ── 正式：逐張寫入，單張失敗不影響其他張；最後一次回填 ─────────────
    results = []
    ok_count = 0
    for o in orders:
        oid = o.get("order_id")
        row = map_order(o, whno=whno, price=price)
        try:
            new_nos = ly_order.write_order(icpno=icpno, rows=[row], verbose=args.verbose)
            or_no = new_nos[0]
            results.append({"order_id": oid, "doc_no": or_no, "ok": True})
            ok_count += 1
            print(f"  ✅ {oid} → 凌越訂貨單號 {or_no}")
        except RuntimeError as e:
            results.append({"order_id": oid, "ok": False, "error": str(e)})
            print(f"  ❌ {oid} 寫入失敗：{e}")

    print(f"\n▶ 回填後台（成功 {ok_count} / 共 {len(orders)}）...")
    cb = post_callback(base, key, results)
    print(f"  後台回應：updated={cb.get('updated_count')} failed={cb.get('failed_count')}")
    return 0 if ok_count == len(orders) else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="雲端後台 ↔ 凌越 ERP 訂貨單回寫橋接")
    p.add_argument("--date", help="要回寫的日期 YYYY-MM-DD（預設今天）")
    p.add_argument("--base", help="雲端後台網址（預設讀 LY_CLOUD_BASE）")
    p.add_argument("--key", help="回寫金鑰（預設讀 LY_WRITEBACK_KEY）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--warehouse", help="預設倉別 OD_WARE（預設留空，或 LY_DEFAULT_WHNO）")
    p.add_argument("--price", help="預設單價 OD_PRICE（預設留空，或 LY_DEFAULT_PRICE）")
    p.add_argument("--create-name", help="建立人代碼 OR_CREATENAME（預設 052，或 LY_CREATE_NAME）")
    p.add_argument("--test-ctno", help="測試：為指定客戶代碼寫一張測試訂貨單，驗證付款方式/業務員有無帶入")
    p.add_argument("--test-skno", help="搭配 --test-ctno：測試明細用的料號（省略則自動取一個）")
    p.add_argument("--dry-run", action="store_true", help="只抓+組單印出，不寫凌越、不回填")
    p.add_argument("--test", action="store_true", help="只寫第一張(標記測試)→驗證→刪除；不回填")
    p.add_argument("--keep", action="store_true", help="搭配 --test：保留測試單不刪除")
    p.add_argument("--verbose", action="store_true", help="正式寫入時印出每張 XML/進度")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
