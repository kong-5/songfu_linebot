#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_agent_v3.py — 凌越小幫手（長連線監聽，網站一按「轉入凌越」即時寫入）v3
========================================================================
跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁），長連線等待後台派工，
把排隊單即時寫入凌越【訂貨單 0000A0】，並把凌越單號回填後台。

寫入時會自動補齊「拋轉需要」的欄位（比對過可拋轉的手打單後定案）：
  * 明細倉別 OD_WARE ← 依料號帶貨品主檔預設倉 SK_RKWHNO（拋轉要扣庫存，沒倉別會抓不到）
  * 建立日期/建立人 OR_CREATEDATE/OR_CREATENAME（拋轉依建立日期抓單）
  * 異動日期/人 OR_MODIFYDATE/OR_MODIFYNAME、製單人 OR_MAKER（比照手打單，非 LY）
  * 付款方式/業務員 OR_FKFS/OR_SALES ← 客戶主檔 CT_FKFS/CT_SALES
  * 審核 OR_CHECK（LY_AUDITED，預設 1=已審核；拋轉需已審核）

環境變數：LY_CLOUD_BASE / LY_WRITEBACK_KEY（必填）
          LY_ICPNO(00) / LY_DEFAULT_WHNO / LY_DEFAULT_PRICE
          LY_AUDITED(1=已審核) / LY_CREATE_NAME(建立/製單人代碼,預設052) / LY_MAKER(覆寫製單人)
用法：python ly_agent_v3.py     # 常駐監聽，Ctrl+C 停止
"""

import os
import sys
import json
import time
import datetime
import urllib.request
import urllib.error

sys.path.insert(0, r"D:\Work\lystk_tool")
import ly_order  # noqa: E402  提供 write_order
import lystk      # noqa: E402  查客戶主檔(000001)/貨品主檔(000000) 帶倉別、付款方式

WAIT_TIMEOUT = 25

_ware_cache = {}
_cust_cache = {}


def _http(method, url, key, body=None, timeout=60):
    data = None
    headers = {"X-Writeback-Key": key, "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw) if raw.strip() else {}


# ── 建一個有逾時的 zeep 用戶端注入 lystk，避免預設無逾時卡死（寫入也一併受惠）──
def _timeout_client():
    if lystk._client is None:
        from zeep import Client, Settings
        from zeep.transports import Transport
        lystk._client = Client(
            lystk.API_URL,
            settings=Settings(strict=False, xml_huge_tree=True),
            transport=Transport(timeout=60, operation_timeout=60),
        )


def product_info(icpno, skno):
    """依料號帶貨品主檔的預設倉 SK_RKWHNO 與正規單位 SK_UNIT（凌越內部設定）。
    回 {'whno':..., 'unit':...}；查不到回 {}。"""
    if not skno:
        return {}
    ck = (icpno, skno)
    if ck in _ware_cache:
        return _ware_cache[ck]
    info = {}
    try:
        rows = lystk.query(icpno=icpno, idakd="000000", where="SK_NO='@v1@'", whval=skno)
        if rows:
            r = rows[0]
            info = {
                "whno": (r.get("SK_RKWHNO") or "").strip(),
                "unit": (r.get("SK_UNIT") or "").strip(),
            }
    except Exception as e:
        print(f"    ⚠ 查品項 {skno} 主檔失敗（略過）：{e}", file=sys.stderr)
    _ware_cache[ck] = info
    return info


def customer_defaults(icpno, ctno):
    """從客戶主檔帶付款方式(CT_FKFS→OR_FKFS)、業務員(CT_SALES→OR_SALES)；空就不帶。"""
    if not ctno:
        return {}
    ck = (icpno, ctno)
    if ck in _cust_cache:
        return _cust_cache[ck]
    out = {}
    try:
        rows = lystk.query(icpno=icpno, idakd="000001", where="CT_NO='@v1@'", whval=ctno)
        if rows:
            r = rows[0]
            fkfs = (r.get("CT_FKFS") or "").strip()
            sales = (r.get("CT_SALES") or "").strip()
            if fkfs:
                out["OR_FKFS"] = fkfs
            if sales:
                out["OR_SALES"] = sales
    except Exception as e:
        print(f"    ⚠ 查客戶 {ctno} 主檔失敗（略過）：{e}", file=sys.stderr)
    _cust_cache[ck] = out
    return out


def map_order(order, icpno, whno, price, create_name, check, maker):
    details = []
    for it in order.get("items", []) or []:
        skno = (it.get("product_code") or "").strip()
        name = (it.get("product_name") or "").strip()
        if not skno:
            print(f"    ⚠ 跳過無料號品項：{name or '(無名)'}（{order.get('customer_name')}）")
            continue
        qty = it.get("quantity")
        pinfo = product_info(icpno, skno)
        det = {
            "OD_SKNO": skno,
            "OD_NAME": name,
            # 單位：用貨品主檔正規單位 SK_UNIT（如 KG），沒有才退回雲端叫貨單位。
            # 抄雲端單位（如「公斤」）會讓凌越把 OD_IS_PACK 設成論件，寺岡(秤重)點不了。
            "OD_UNIT": pinfo.get("unit") or (it.get("unit") or "KG").strip(),
            # 倉別：依料號帶貨品主檔預設倉 SK_RKWHNO；沒有才用 LY_DEFAULT_WHNO
            "OD_WARE": pinfo.get("whno") or whno,
            "OD_QTY": qty if qty is not None else 0,
        }
        if price not in (None, ""):
            det["OD_PRICE"] = price
        note = (it.get("item_note") or "").strip()
        if note:
            det["OD_REM"] = note
        details.append(det)

    od = (order.get("order_date") or "").strip().replace("/", "-")
    now_dt = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    op = maker or create_name
    ctno = (order.get("customer_code") or "").strip()
    row = {
        "OR_CTNO": ctno,
        "OR_CTNAME": (order.get("customer_name") or "").strip(),
        "OR_DATE1": od, "OR_DATE2": od,
        "OR_REM": (order.get("doc_remark") or "").strip(),
        "OR_CHECK": check,               # 審核（LY_AUDITED，預設 1=已審核，拋轉需要）
        "OR_MAKER": op,                  # 製單人（操作員代碼，非 LY）
        "OR_CREATEDATE": now_dt,         # 建立日期（拋轉依此抓單）
        "OR_CREATENAME": op,             # 建立人
        "OR_MODIFYDATE": now_dt,         # 異動日期（比照手打單）
        "OR_MODIFYNAME": op,             # 異動人
        "details": details,
    }
    row.update(customer_defaults(icpno, ctno))   # 付款方式/業務員 from 客戶主檔
    return row


def post_callback(base, key, results, retries=3):
    for i in range(retries):
        try:
            return _http("POST", f"{base}/admin/lingyue-writeback/callback", key, {"results": results})
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(2)


def main():
    base = (os.environ.get("LY_CLOUD_BASE") or "").strip().rstrip("/")
    key = (os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    icpno = (os.environ.get("LY_ICPNO") or "00").strip()
    whno = os.environ.get("LY_DEFAULT_WHNO", "")
    price = os.environ.get("LY_DEFAULT_PRICE", "")
    create_name = (os.environ.get("LY_CREATE_NAME") or "052").strip()
    maker = (os.environ.get("LY_MAKER") or "").strip()
    check = "0" if (os.environ.get("LY_AUDITED", "1").strip().lower() in ("0", "false", "no")) else "1"
    if not base or not key:
        print("❌ 請先設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY", file=sys.stderr)
        return 2

    _timeout_client()  # 先備好有逾時的用戶端（查詢/寫入都用它）

    print(f"▶ 凌越小幫手啟動，長連線等待中…（雲端 {base}）")
    print(f"  在網站（任何機器）點「轉入凌越」後，這裡會自動寫入。審核={check}。Ctrl+C 停止。")
    wait_url = f"{base}/admin/lingyue-writeback/wait?timeout={WAIT_TIMEOUT}"
    written = {}  # "order_id|queued_at" -> doc_no

    while True:
        try:
            data = _http("GET", wait_url, key, timeout=WAIT_TIMEOUT + 15)
        except urllib.error.HTTPError as e:
            print(f"  ⚠ 等待端點 HTTP {e.code}，5 秒後重試", file=sys.stderr)
            time.sleep(5)
            continue
        except Exception as e:
            print(f"  ⚠ 連線問題：{e}，5 秒後重試", file=sys.stderr)
            time.sleep(5)
            continue

        orders = data.get("orders", []) or []
        if not orders:
            continue

        print(f"\n▶ 收到 {len(orders)} 張排隊單，開始寫入凌越…")
        results = []
        for o in orders:
            oid = o.get("order_id")
            cname = o.get("customer_name")
            dedup_key = f"{oid}|{o.get('queued_at', '')}"
            if dedup_key in written:  # 同單已寫過→直接回填，不重複寫
                results.append({"order_id": oid, "doc_no": written[dedup_key], "ok": True})
                continue
            row = map_order(o, icpno, whno, price, create_name, check, maker)
            if not row["details"]:
                results.append({"order_id": oid, "ok": False, "error": "無可寫入明細"})
                print(f"  ⚠ {cname} 無可寫入明細，略過")
                continue
            try:
                # 每次寫入前重置 ly_order 的當日流水快取，避免跨日/多次撞號
                try:
                    ly_order._seq_date = None
                except Exception:
                    pass
                nos = ly_order.write_order(icpno=icpno, rows=[row])
                written[dedup_key] = nos[0]
                results.append({"order_id": oid, "doc_no": nos[0], "ok": True})
                print(f"  ✅ {cname} → 訂貨單號 {nos[0]}")
            except Exception as e:
                results.append({"order_id": oid, "ok": False, "error": str(e)[:300]})
                print(f"  ❌ {cname} 寫入失敗：{str(e)[:200]}")

        try:
            cb = post_callback(base, key, results)
            print(f"  ↩ 已回填後台：updated={cb.get('updated_count')} failed={cb.get('failed_count')}")
        except Exception as e:
            print(f"  ⚠ 回填失敗：{e}（已寫入凌越，下輪會再回填）", file=sys.stderr)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(main() or 0)
