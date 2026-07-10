#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_stock_push.py — 撈凌越目前庫存（貨品主檔 SK_NOWQTY）整批推上雲端後台（內網 agent 用）
==========================================================================================

跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁）。
一次撈整張貨品主檔（資料種類 000000），取每品項的目前庫存 SK_NOWQTY，
連同料號/品名/規格/單位/凌越倉別，POST 到雲端後台的機器端點：

    POST {LY_CLOUD_BASE}/admin/lingyue-writeback/inventory-push
    標頭 X-Writeback-Key: {LY_WRITEBACK_KEY}
    body: { icpno, snapshot_at, items:[{code,name,spec,unit,qty,wh_code}, ...],
            warehouse_qty:[{erp_code,wh_code,qty}, ...] }   ← 選配（見下）

雲端收到後全表覆蓋 erp_stock_items，後台「庫存管理 → 目前庫存」即顯示最新。

分倉庫存（資料種類 000009「目前庫存-廠內倉」）
--------------------------------------------
推送時順帶查 000009 逐倉別在庫量，成功時 payload 頂層多帶 `warehouse_qty`
（同樣只含未停用品項）；查詢失敗或解析不出來時**完全不帶該欄位**——
雲端據此判斷「這批推送無分倉資料」，既有 erp_stock_items 行為零影響。
⚠ 000009 尚未實跑驗證過欄位格式，解析全防禦式；先用 --dry-run 印原始樣本核對。

設定（環境變數，或用 CLI 覆蓋）
------------------------------
  LY_CLOUD_BASE     雲端後台網址，如 https://xxxx.run.app（必填）
  LY_WRITEBACK_KEY  與後台 LINGYUE_WRITEBACK_KEY 相同的金鑰（必填，與訂單回寫共用同一把）
  LY_ICPNO          公司代碼（00 松富、01 龍港、02 松揚、03 松成）。
                    可逗號分隔多家（如 "00,02"）；填 "all" 或留空＝全公司 00,01,02,03。
                    逐家撈、逐家推，雲端按公司(icpno)覆蓋、各自分開。

用法
----
  python ly_stock_push.py                 # 全公司（00,01,02,03）逐家推送
  python ly_stock_push.py --icpno 01      # 只推龍港
  python ly_stock_push.py --icpno 00,02   # 松富＋松揚
  python ly_stock_push.py --dry-run       # 只撈+組好，不推送（印筆數與前幾筆）
"""

import os
import sys
import json
import argparse
import datetime
import urllib.request
import urllib.error

# 讓本機找得到 lystk（與 ly_query_stock.py 同目錄）
sys.path.insert(0, r"D:\Work\lystk_tool")
import lystk  # noqa: E402

KIND_GOODS = "000000"  # 貨品主檔
CODE_FIELD = "SK_NO"
NAME_FIELD = "SK_NAME"
SPEC_FIELD = "SK_SPEC"
UNIT_FIELD = "SK_UNIT"
STOCK_FIELD = "SK_NOWQTY"   # 目前庫存（現有量）
WH_FIELD = "SK_RKWHNO"      # 預設入庫倉別（如 FN001/FN002/FN013）
STOP_FIELD = "SK_STOP"      # 停用碼：1=停用、0=正常。停用品不推上雲端。


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


def _num(v):
    s = str(v).strip().replace(",", "")
    if s == "":
        return 0
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except ValueError:
        return 0


def _num_or_none(v):
    """同 _num，但型別不符（非空又轉不成數字）回 None，讓呼叫端能辨識並略過該列。"""
    s = str(v).strip().replace(",", "")
    if s == "":
        return 0
    try:
        f = float(s)
        return int(f) if f.is_integer() else f
    except ValueError:
        return None


def _is_stopped(r) -> bool:
    """SK_STOP=1（或 Y）視為停用。"""
    v = str(r.get(STOP_FIELD, "")).strip().upper()
    return v in ("1", "Y", "YES", "TRUE")


def fetch_stock_items(icpno: str, timeout: int) -> list:
    """撈整張貨品主檔，回傳 [{code,name,spec,unit,qty,wh_code}, ...]。停用品（SK_STOP=1）跳過。"""
    ensure_timeout_client(timeout)
    rows = lystk.query(icpno=icpno, idakd=KIND_GOODS)
    items = []
    skipped_stop = 0
    for r in rows or []:
        code = str(r.get(CODE_FIELD, "")).strip()
        if not code:
            continue
        if _is_stopped(r):   # 停用品不推上雲端；每次刷新依凌越最新狀態自動排除
            skipped_stop += 1
            continue
        items.append({
            "code": code,
            "name": str(r.get(NAME_FIELD, "")).strip(),
            "spec": str(r.get(SPEC_FIELD, "")).strip(),
            "unit": str(r.get(UNIT_FIELD, "")).strip(),
            "qty": _num(r.get(STOCK_FIELD, 0)),
            "wh_code": str(r.get(WH_FIELD, "")).strip(),
        })
    if skipped_stop:
        print(f"  （已跳過停用品 {skipped_stop} 項 SK_STOP=1）", flush=True)
    return items


# ── 分倉庫存（資料種類 000009「目前庫存-廠內倉」，逐倉別在庫量）──────────────
# 文件記載欄位（docs/凌越串接-通用方法說明.md §3）：WH_NO/WH_NAME、@WD_AMT(目前庫存)、
# @WD_AMTOK(可用量)。⚠ 未實跑驗證過，且料號欄位文件沒記載 → 欄位一律用候選清單
# 防禦式偵測：必要欄位偵測不到＝log 警告回空清單；整個查詢失敗＝回 None。
# 另注意 docs/資料處理規則.md 曾記載「000009 只有批號品項」——涵蓋範圍以實跑為準，
# 未涵蓋的品項雲端視為無分倉資料即可。
KIND_WH_STOCK = "000009"
WHQ_CODE_FIELDS = ("SK_NO", "WD_SKNO", "WD_NO", "@WD_SKNO")  # 料號（文件未載，依 SK_/WD_ 前綴慣例猜測）
WHQ_WH_FIELDS = ("WH_NO", "WD_WHNO", "@WD_WHNO")             # 倉別代號（文件記 WH_NO）
WHQ_QTY_FIELDS = ("@WD_AMT", "WD_AMT")                       # 目前庫存（刻意不用 @WD_AMTOK 可用量）


def _pick_field(row, candidates):
    """在一列裡找第一個存在的欄位名（大小寫不敏感比對），找不到回 None。"""
    try:
        keys = {str(k).strip().upper(): k for k in row.keys()}
    except Exception:
        return None
    for cand in candidates:
        k = keys.get(cand.upper())
        if k is not None:
            return k
    return None


def fetch_warehouse_qty(icpno: str, timeout: int, debug: bool = False):
    """查資料種類 000009（逐倉別目前庫存），回 [{erp_code, wh_code, qty}, ...]。
    防禦式：欄位缺失/型別不符 → 印警告回 []；整個查詢失敗 → 印警告回 None。
    呼叫端據「None 或空」決定 payload 不帶 warehouse_qty（既有行為零影響）。
    debug=True（dry-run 用）另印原始回應前 3 筆，方便內網第一次實跑核對格式。"""
    try:
        ensure_timeout_client(timeout)
        rows = lystk.query(icpno=icpno, idakd=KIND_WH_STOCK)
    except Exception as e:
        print(f"⚠ 000009 分倉庫存查詢失敗（本批不帶分倉資料）：{_friendly_ly_error(e)}", flush=True)
        return None
    rows = rows or []
    if debug:
        print(f"  [000009] 原始回應 {len(rows)} 列，前 3 筆原樣：", flush=True)
        for r in rows[:3]:
            try:
                print("    " + json.dumps({str(k): str(v) for k, v in dict(r).items()}, ensure_ascii=False), flush=True)
            except Exception:
                print(f"    {r!r}", flush=True)
    if not rows:
        print("⚠ 000009 分倉庫存查詢回 0 列（本批不帶分倉資料）", flush=True)
        return []
    # 用第一列偵測實際欄位名（未實跑驗證過，欄位名可能與文件記載不同）
    first = rows[0]
    code_key = _pick_field(first, WHQ_CODE_FIELDS)
    wh_key = _pick_field(first, WHQ_WH_FIELDS)
    qty_key = _pick_field(first, WHQ_QTY_FIELDS)
    if not code_key or not wh_key or not qty_key:
        try:
            avail = ", ".join(sorted(str(k) for k in first.keys()))
        except Exception:
            avail = repr(first)[:300]
        print(f"⚠ 000009 欄位對不上（料號={code_key} 倉別={wh_key} 數量={qty_key}）"
              f"，實際欄位：{avail}（本批不帶分倉資料）", flush=True)
        return []
    out = []
    bad = 0
    for r in rows:
        try:
            code = str(r.get(code_key, "")).strip()
            wh = str(r.get(wh_key, "")).strip()
            qty = _num_or_none(r.get(qty_key, 0))
        except Exception:
            bad += 1
            continue
        if not code or not wh or qty is None:  # 缺料號/倉別或數量型別不符 → 略過該列
            bad += 1
            continue
        out.append({"erp_code": code, "wh_code": wh, "qty": qty})
    if bad:
        print(f"⚠ 000009 有 {bad} 列缺欄位/型別不符已略過", flush=True)
    return out


# ── 單品項「進銷存」查詢（庫存頁點品項用）────────────────────────────
# 重點欄位：存在才顯示；欄名是常見猜測，凌越沒有的自動略過（全部欄位一律附上）。
SUMMARY_FIELDS = [
    ("目前庫存", "SK_NOWQTY"), ("單位", "SK_UNIT"), ("規格", "SK_SPEC"),
    ("預設倉別", "SK_RKWHNO"),
    ("安全存量", "SK_SAFEQTY"), ("最高存量", "SK_MAXQTY"), ("最低存量", "SK_MINQTY"),
    ("本月進貨量", "SK_INQTY"), ("本月銷貨量", "SK_OUTQTY"),
    ("最後進貨日", "SK_LASTINDATE"), ("最後銷貨日", "SK_LASTOUTDATE"),
    ("最後進價", "SK_LASTINPRICE"), ("售價", "SK_PRICE"), ("平均成本", "SK_AVGCOST"),
]


def fetch_product_record(icpno: str, code: str, timeout: int = 60) -> dict:
    """撈單一品項的貨品主檔(000000)整筆原始欄位；查不到回 {}。"""
    ensure_timeout_client(timeout)
    rows = lystk.query(icpno=icpno, idakd=KIND_GOODS, where="SK_NO='@v1@'", whval=code)
    return rows[0] if rows else {}


def build_txn_payload(rec: dict) -> dict:
    """把貨品主檔原始欄位整成 {summary:{重點}, fields:{全部}} 給網站顯示。"""
    if not rec:
        return {"summary": {}, "fields": {}}
    summary = {}
    for label, fkey in SUMMARY_FIELDS:
        if fkey in rec:
            v = str(rec.get(fkey, "")).strip()
            if v != "":
                summary[label] = v
    fields = {k: ("" if v is None else str(v).strip()) for k, v in rec.items()}
    return {"summary": summary, "fields": fields}


def _report_refresh(base: str, key: str, ok: bool, error: str = "") -> None:
    """把庫存刷新結果/失敗原因回報雲端，讓網站顯示真正原因（best-effort，失敗不影響主流程）。"""
    try:
        payload = json.dumps({"ok": ok, "error": error[:500]}).encode("utf-8")
        url = base.rstrip("/") + "/admin/lingyue-writeback/inventory-report"
        req = urllib.request.Request(
            url, data=payload, method="POST",
            headers={"Content-Type": "application/json", "X-Writeback-Key": key},
        )
        urllib.request.urlopen(req, timeout=15).read()
    except Exception:
        pass


def _friendly_ly_error(e: Exception) -> str:
    """把凌越常見錯誤轉成看得懂的話。"""
    s = str(e)
    if "LyGetPassKey" in s or "192.168." in s or "Read timed out" in s or "timed out" in s:
        return "連不到凌越主機（可能凌越那台沒開機、太忙、或內網不通）；" + s[:200]
    return s[:300]


def check_lingyue(icpno: str = "00", timeout: int = 12) -> dict:
    """快速檢測凌越是否連得上。
    先測 TCP(主機/埠通不通)，再測凌越 API(登入＋查 1 筆)。
    回傳 {tcp_ok, api_ok, host, port, tcp_ms, api_ms, detail}。
    用短逾時且用完還原 lystk._client，避免影響代理正在用的連線。"""
    import socket
    import time as _time
    import urllib.parse
    res = {"tcp_ok": False, "api_ok": False, "host": "", "port": 80, "tcp_ms": 0, "api_ms": 0, "detail": ""}
    try:
        u = urllib.parse.urlparse(getattr(lystk, "API_URL", "") or "")
        host = u.hostname or "192.168.4.11"
        port = u.port or (443 if u.scheme == "https" else 80)
    except Exception:
        host, port = "192.168.4.11", 80
    res["host"], res["port"] = host, port
    # 1) TCP 連線測試
    t0 = _time.time()
    try:
        socket.create_connection((host, port), timeout=timeout).close()
        res["tcp_ok"] = True
        res["tcp_ms"] = int((_time.time() - t0) * 1000)
    except Exception as e:
        res["tcp_ms"] = int((_time.time() - t0) * 1000)
        res["detail"] = f"連不到主機 {host}:{port}（{e}）"
        return res
    # 2) 凌越 API 測試（登入＋查 1 筆），用臨時短逾時 client，測完還原
    t1 = _time.time()
    old_client = getattr(lystk, "_client", None)
    try:
        lystk._client = None
        ensure_timeout_client(timeout)
        lystk.query(icpno=icpno, idakd=KIND_GOODS, limit=1)
        res["api_ok"] = True
    except Exception as e:
        res["detail"] = _friendly_ly_error(e)
    finally:
        lystk._client = old_client
        res["api_ms"] = int((_time.time() - t1) * 1000)
    return res


ALL_ICPNOS = ["00", "01", "02", "03"]  # 松富、龍港、松揚、松成


def _icpno_list(icpno) -> list:
    """'00,02' → ['00','02']；'all'／空／None → 全公司 00,01,02,03。各公司各自撈、各自推（雲端按公司覆蓋）。"""
    s = str(icpno or "").strip()
    if not s or s.lower() == "all":
        return list(ALL_ICPNOS)
    parts = [p.strip() for p in s.split(",")]
    out = []
    for p in parts:
        if p.lower() == "all":
            for a in ALL_ICPNOS:
                if a not in out:
                    out.append(a)
        elif p and p not in out:
            out.append(p)
    return out or list(ALL_ICPNOS)


def push_once(base: str, key: str, icpno: str, timeout: int = 90, verbose: bool = True) -> int:
    """撈凌越目前庫存並 POST 到雲端。icpno 可逗號分隔多公司（如 "00,02"），逐家推送。
    回傳推送總筆數。失敗時回報原因給雲端。"""
    total = 0
    codes = _icpno_list(icpno)
    for one in codes:
        if verbose and len(codes) > 1:
            print(f"▶ 公司 {one} …", flush=True)
        total += _push_one_company(base, key, one, timeout=timeout, verbose=verbose)
    return total


def _push_one_company(base: str, key: str, icpno: str, timeout: int = 90, verbose: bool = True) -> int:
    """撈單一公司的目前庫存並 POST 到雲端（雲端按 icpno 覆蓋）。回傳推送筆數。"""
    try:
        items = fetch_stock_items(icpno, timeout)
    except Exception as e:
        _report_refresh(base, key, False, _friendly_ly_error(e))
        raise RuntimeError(_friendly_ly_error(e)) from None
    snapshot_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    body = {"icpno": icpno, "snapshot_at": snapshot_at, "items": items}
    # 分倉庫存（000009）：查得到就順帶推（頂層 warehouse_qty）；查失敗/解析不出/空
    # → 完全不帶該欄位，雲端據此判斷「這批推送無分倉資料」，既有行為零影響。
    try:
        warehouse_qty = fetch_warehouse_qty(icpno, timeout)
    except Exception as e:  # fetch_warehouse_qty 內已自我防禦，這層是最後保險
        print(f"⚠ 分倉庫存查詢異常（本批不帶分倉資料）：{e}", flush=True)
        warehouse_qty = None
    if warehouse_qty:
        pushed_codes = {it["code"] for it in items}  # items 已過濾停用品 → 分倉同步過濾
        wq = [w for w in warehouse_qty if w["erp_code"] in pushed_codes]
        if wq:
            body["warehouse_qty"] = wq
            if verbose:
                print(f"  （分倉庫存 000009：{len(wq)} 筆，涵蓋 {len({w['erp_code'] for w in wq})} 品項）", flush=True)
    payload = json.dumps(body).encode("utf-8")
    url = base.rstrip("/") + "/admin/lingyue-writeback/inventory-push"
    req = urllib.request.Request(
        url, data=payload, method="POST",
        headers={"Content-Type": "application/json", "X-Writeback-Key": key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            res = json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        _report_refresh(base, key, False, f"推送到雲端失敗 HTTP {e.code}")
        raise RuntimeError(f"HTTP {e.code} POST {url}\n  {detail}") from None
    except urllib.error.URLError as e:
        _report_refresh(base, key, False, f"推送到雲端失敗：{e.reason}")
        raise RuntimeError(f"連線失敗 POST {url}：{e.reason}") from None
    if verbose:
        print(f"✅ 已推送 {res.get('count', len(items))} 品項（snapshot_at={res.get('snapshot_at', snapshot_at)}）", flush=True)
    return int(res.get("count", len(items)))


def run(args) -> int:
    base = (args.base or os.environ.get("LY_CLOUD_BASE") or "").strip()
    key = (args.key or os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    icpno = (args.icpno or os.environ.get("LY_ICPNO") or "all").strip()

    if args.dry_run:
        for one in _icpno_list(icpno):
            print(f"▶ 撈庫存 ICPNO={one}（dry-run，不推送）…", flush=True)
            items = fetch_stock_items(one, args.timeout)
            print(f"  共 {len(items)} 品項，前 5 筆：")
            for it in items[:5]:
                print(f"    {it['code']:<12}{it['name'][:16]:<18}{it['unit']:<5}庫存 {it['qty']}  倉別 {it['wh_code']}")
            # 分倉庫存 000009：dry-run 印原始樣本＋解析結果，供內網第一次實跑核對欄位格式
            print(f"▶ 查 000009 分倉庫存 ICPNO={one}（dry-run 驗證格式）…", flush=True)
            wq = fetch_warehouse_qty(one, args.timeout, debug=True)
            if wq is None:
                print("  000009 查詢失敗 → 正式推送時 payload 不會帶 warehouse_qty")
            else:
                print(f"  解析出 {len(wq)} 筆分倉庫存（品項×倉別），前 5 筆：")
                for w in wq[:5]:
                    print(f"    {w['erp_code']:<12}倉別 {w['wh_code']:<8}數量 {w['qty']}")
        return 0

    if not base or not key:
        print("❌ 請設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY（或用 --base / --key）", file=sys.stderr)
        return 2

    print(f"▶ 撈庫存 ICPNO={icpno} 並推送到 {base} …", flush=True)
    push_once(base, key, icpno, timeout=args.timeout)
    return 0


def build_parser():
    p = argparse.ArgumentParser(description="撈凌越目前庫存(SK_NOWQTY)整批推送到雲端後台")
    p.add_argument("--base", help="雲端後台網址（預設讀 LY_CLOUD_BASE）")
    p.add_argument("--key", help="回寫金鑰（預設讀 LY_WRITEBACK_KEY）")
    p.add_argument("--icpno", help="公司代碼；可逗號多家如 00,02，填 all／留空＝全公司 00,01,02,03")
    p.add_argument("--timeout", type=int, default=90, help="連線/操作逾時秒數（預設 90）")
    p.add_argument("--dry-run", action="store_true", help="只撈+組好印出，不推送")
    return p


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(run(build_parser().parse_args()))
