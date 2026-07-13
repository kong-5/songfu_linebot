#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_sales_push.py — 把「一天的銷貨單」推上雲端（每日帳款收款用）
================================================================

流程（air-gap，雲端連不到凌越 LAN，故由內網這台推上去）：
  1) 查凌越當天銷貨單（0000A1 主表，只取金額層，不撈明細）。
  2) 抓一次客戶主檔（00000D）建「客戶編號→結帳方式(CT_FKFS)」對照。
  3) POST 到雲端後台 /admin/lingyue-writeback/cash-ingest（標頭 X-Writeback-Key）。
雲端會「該公司該日全表覆蓋」，所以印報表前再跑一次就會反映凌越當下狀態。

必須跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。

環境變數（與庫存推送/訂單回寫共用同一把金鑰）：
  LY_CLOUD_BASE     雲端後台網址，如 https://xxxx.run.app（必填）
  LY_WRITEBACK_KEY  與後台 LINGYUE_WRITEBACK_KEY 相同的金鑰（必填）
  LY_ICPNO          公司代碼，預設 00（松富）

用法：
  python ly_sales_push.py --date 2026-07-11
  python ly_sales_push.py --date 2026-07-11 --icpno 00
  python ly_sales_push.py --date 2026-07-11 --dry     # 只組資料、不上傳（印摘要）
"""

import os
import sys
import json
import argparse
import datetime
import urllib.request
import urllib.error

sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

IDAKD_SALES = "0000A1"   # 銷貨單
IDAKD_CUST = "00000D"    # 客戶基本資料(讀取)


def ensure_timeout_client(timeout: int):
    if lystk._client is not None:
        return
    from zeep import Client, Settings
    from zeep.transports import Transport
    lystk._client = Client(
        lystk.API_URL,
        settings=Settings(strict=False, xml_huge_tree=True),
        transport=Transport(timeout=timeout, operation_timeout=timeout),
    )


def num(v) -> float:
    s = str(v or "").strip().replace(",", "")
    if s in ("", "-"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def build_customer_map(icpno: str, verbose: bool) -> dict:
    """抓整份客戶主檔一次，建 CT_NO → {name, fkfs, sales, stop}。失敗回空 dict。"""
    try:
        rows = lystk.query(icpno=icpno, idakd=IDAKD_CUST) or []
    except Exception as e:
        if verbose:
            print(f"⚠ 客戶主檔查詢失敗（結帳方式將留空）：{e}", flush=True)
        return {}
    cmap = {}
    for r in rows:
        ct = str(r.get("CT_NO", "")).strip()
        if not ct:
            continue
        cmap[ct] = {
            "name": str(r.get("CT_NAME", "")).strip(),
            "fkfs": str(r.get("CT_FKFS", "")).strip(),
            "sales": str(r.get("CT_SALES", "")).strip(),
            "stop": 1 if str(r.get("CT_STOP", "")).strip() in ("1", "Y", "y") else 0,
        }
    if verbose:
        print(f"  客戶主檔對照：{len(cmap)} 筆", flush=True)
    return cmap


def build_payload(icpno: str, date: str, verbose: bool) -> dict:
    rows = lystk.query(icpno=icpno, idakd=IDAKD_SALES, date=date) or []
    if verbose:
        print(f"  銷貨單：{len(rows)} 張", flush=True)
    cmap = build_customer_map(icpno, verbose)

    docs, seen_cust = [], {}
    for r in rows:
        sp_no = str(r.get("SP_NO", "")).strip()
        if not sp_no:
            continue
        ct_no = str(r.get("SP_CTNO", "")).strip()
        cinfo = cmap.get(ct_no, {})
        ct_name = str(r.get("SP_CTNAME", "")).strip() or cinfo.get("name", "")
        fkfs = cinfo.get("fkfs", "") or str(r.get("SP_FKFS", "")).strip()
        sales = str(r.get("SP_SALES", "")).strip() or cinfo.get("sales", "")
        docs.append({
            "sp_no": sp_no,
            "doc_date": str(r.get("SP_DATE", "")).strip()[:10] or date,
            "ct_no": ct_no,
            "ct_name": ct_name,
            "fkfs": fkfs,
            "total": num(r.get("SP_TOTAL")),
            "unpaid": num(r.get("SP_NTNPAY")),   # 未付台幣（＝應收未收）
            "paid": num(r.get("SP_PAY")),        # 已付
            "nopay_fg": str(r.get("SP_NOPAY", "")).strip(),
            "sales": sales,
        })
        if ct_no and ct_no not in seen_cust:
            seen_cust[ct_no] = {
                "ct_no": ct_no, "name": ct_name, "fkfs": fkfs,
                "sales": sales, "stop": cinfo.get("stop", 0),
            }
    return {
        "date": date, "icpno": icpno,
        "docs": docs, "customers": list(seen_cust.values()),
        "pushed_by": "ly_sales_push",
    }


def post_cloud(base: str, key: str, body: dict, timeout: int) -> dict:
    url = base.rstrip("/") + "/admin/lingyue-writeback/cash-ingest"
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload, method="POST",
        headers={"Content-Type": "application/json", "X-Writeback-Key": key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {e.code} POST {url}\n  {detail}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"連線失敗 POST {url}：{e.reason}") from None


def _expand_icpnos(icpno: str) -> list:
    """公司代碼可為 'all'（全公司 00,01,02,03）或逗號多家或單一。回代碼清單。"""
    s = (icpno or "00").strip()
    if s.lower() == "all":
        return ["00", "01", "02", "03"]
    out = [p.strip() for p in s.split(",") if p.strip() and p.strip().lower() != "all"]
    return out or ["00"]


def push_once(base: str, key: str, icpno: str, date=None, timeout: int = 90, verbose: bool = True) -> int:
    """給「凌越整合代理」GUI 呼叫：撈某天銷貨單並推上雲端。回傳推送的銷貨單張數（多公司加總）。
    icpno 可為 'all'／逗號多家／單一；date 預設今天。"""
    ensure_timeout_client(timeout)
    d = datetime.date.fromisoformat(date).isoformat() if date else datetime.date.today().isoformat()
    total = 0
    for one in _expand_icpnos(icpno):
        company = lystk.COMPANIES.get(one, one)
        if verbose:
            print(f"🧾 取單 {d}  ICPNO={one}（{company}）…", flush=True)
        body = build_payload(one, d, verbose=verbose)
        res = post_cloud(base, key, body, timeout)
        n = int(res.get("docs", len(body["docs"]))) if isinstance(res, dict) else len(body["docs"])
        if verbose:
            print(f"✅ 已推 {n} 張（{one} {d}）", flush=True)
        total += n
    return total


def run(args) -> int:
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "00").strip()
    date = datetime.date.fromisoformat(args.date.strip()).isoformat()
    company = lystk.COMPANIES.get(icpno, icpno)
    ensure_timeout_client(args.timeout)

    print(f"▶ 取單 {date}  ICPNO={icpno}（{company}）…", flush=True)
    body = build_payload(icpno, date, verbose=True)

    n_num = sum(1 for d in body["docs"] if not d["sp_no"].upper().startswith("A"))
    n_a = len(body["docs"]) - n_num
    tot = sum(d["total"] for d in body["docs"])
    print(f"  組好：純數字 {n_num} 張、A 開頭 {n_a} 張，金額合計 {tot:,.0f}；客戶 {len(body['customers'])} 家", flush=True)

    if args.dry:
        print("（--dry 未上傳）範例前 3 筆：", flush=True)
        print(json.dumps(body["docs"][:3], ensure_ascii=False, indent=2))
        return 0

    base = (args.base or os.environ.get("LY_CLOUD_BASE") or "").strip()
    key = (args.key or os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    if not base or not key:
        print("❌ 請設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY（或用 --base / --key）", file=sys.stderr)
        return 2

    res = post_cloud(base, key, body, args.timeout)
    if res.get("ok"):
        print(f"✅ 已推上雲端：docs {res.get('docs')} 張、customers {res.get('customers')} 家（{res.get('date')}）", flush=True)
        return 0
    print(f"⚠ 雲端回應非 ok：{res}", flush=True)
    return 1


def build_parser():
    p = argparse.ArgumentParser(description="把一天的銷貨單推上雲端（每日帳款收款）")
    p.add_argument("--date", required=True, help="日期 YYYY-MM-DD（只推這一天）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--base", help="雲端後台網址（預設讀 LY_CLOUD_BASE）")
    p.add_argument("--key", help="回寫金鑰（預設讀 LY_WRITEBACK_KEY）")
    p.add_argument("--dry", action="store_true", help="只組資料印摘要、不上傳")
    p.add_argument("--timeout", type=int, default=90, help="逾時秒數（預設 90）")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
