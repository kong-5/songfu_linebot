#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_writeback_bridge.py — 雲端後台 ↔ 凌越 ERP 回寫橋接（統一版）
=================================================================

跑在已能連到凌越 LAN 的那台機器（D:\\Work\\lystk_tool 旁），把雲端後台的
訂單寫進凌越【訂貨單／客戶訂單 0000A0】，再把凌越配發的單號回填後台。

★ 這是「唯一」的欄位對映權威（map_order）。視窗版 ly_agent_gui.py 必須用
  這裡的 map_order，規則改這裡一處就好。完整規則見 docs/資料處理規則.md。
  （舊常駐版 ly_agent_v3.py 已於 2026-07-14 刪除，被 GUI 取代。）

⛔ CLI 整批寫入護欄（2026-07-14）：不帶 --apply 一律拒絕執行整批回寫。
  日常回寫只走 ly_agent_gui 的 /wait 模式（只寫使用者按過「上傳凌越」的單）；
  本 CLI 僅供 --dry-run 預覽、--test 單張驗證與救援場景。

拋轉必備欄位（2026-07-08 與可拋轉的手打單比對後定案）
------------------------------------------------------
  * OD_WARE       ← 依料號帶貨品主檔預設倉 SK_RKWHNO（拋轉要扣庫存，空倉別拋不過）
  * OD_UNIT       ← 優先用貨品主檔正規單位 SK_UNIT（抄雲端「公斤」會讓凌越把
                    OD_IS_PACK 設成論件，寺岡秤重點不了）；退回時「公斤→KG」
  * OR_CHECK      ← 預設 1=已審核（拋轉需已審核；要未審核用 --unaudited / 設定關閉）
  * OR_MAKER / OR_CREATEDATE / OR_CREATENAME / OR_MODIFYDATE / OR_MODIFYNAME
                  ← 比照手打單帶操作員代碼與時間（拋轉依建立日期抓單）
  * OR_FKFS / OR_SALES ← 客戶主檔 CT_FKFS / CT_SALES（畫面選客戶會自動帶，API 要自己補）

設定（環境變數，或用 CLI 參數覆蓋）
-----------------------------------
  LY_CLOUD_BASE     雲端後台網址（必填）
  LY_WRITEBACK_KEY  與後台 LINGYUE_WRITEBACK_KEY 相同的金鑰（必填）
  LY_ICPNO          公司代碼，預設 "00"（松富；01 龍港、03 桂田）
  LY_DEFAULT_WHNO   後備倉別：品項在貨品主檔查不到預設倉時用它補
  LY_DEFAULT_PRICE  預設單價（留空＝不送，讓凌越依客戶售價表帶價）
  LY_CREATE_NAME    建立人/製單人操作員代碼，預設 "052"
  LY_MAKER          覆寫製單人（通常不用設）
  LY_AUDITED        1=已審核（預設）/ 0=未審核

用法
----
  python ly_writeback_bridge.py --date 2026-07-08 --dry-run     # 只組單印出
  python ly_writeback_bridge.py --test-ctno AC30046             # 為指定客戶寫一張測試單驗欄位
  python ly_writeback_bridge.py --date 2026-07-08 --test        # 寫第一張→回查→自動刪
  python ly_writeback_bridge.py --date 2026-07-08               # 正式整批回寫＋回填
"""

import os
import sys
import json
import argparse
import datetime
import urllib.request
import urllib.error

# 讓本機找得到凌越模組（與探索工具同目錄）
sys.path.insert(0, r"D:\Work\lystk_tool")
import ly_order  # noqa: E402  提供 write_order / verify_or_no / delete_order
import lystk     # noqa: E402  查客戶主檔(000001)/貨品主檔(000000)

TEST_REM_PREFIX = "【API測試請刪除】"


# ----------------------------------------------------------------------
#  撞號防護（權威層）：write_order 每次呼叫前重置當日流水快取
# ----------------------------------------------------------------------
#  ly_order 會把「當日流水號」快取在模組變數 _seq_date，同一天的第二張起
#  直接用 快取號+1，不再回查凌越。若使用者這中間在凌越手打了新單
#  （例：網站寫到 …0051 → 手打 0052/0053 → 下一張網站單用快取的 0052），
#  LyDataAdd 同號會直接覆蓋手打單（2026-07-09 事故）。
#
#  修正曾放在 ly_agent_gui.py（每次寫入前重置），但 GUI 打包成 exe 後
#  「換 .py 不重打包」的部署方式帶不到那層。放在本檔（local_import 熱替換層）
#  包住 write_order，舊 exe 只要換掉同資料夾的 ly_writeback_bridge.py 就生效，
#  且 GUI／CLI 批次／任何 import 本檔的呼叫端全部涵蓋。

def _install_seq_reset_guard():
    fn = getattr(ly_order, "write_order", None)
    if fn is None or getattr(fn, "_sf_seq_reset_guard", False):
        return

    def write_order_with_seq_reset(*args, **kwargs):
        try:
            ly_order._seq_date = None  # 清快取 → write_order 重查凌越當日實際最大流水 +1
        except Exception:
            pass
        return fn(*args, **kwargs)

    write_order_with_seq_reset._sf_seq_reset_guard = True
    ly_order.write_order = write_order_with_seq_reset


_install_seq_reset_guard()

# ----------------------------------------------------------------------
#  單位正規化：雲端多半給中文「公斤」，凌越要「KG」。
#  ※ 實際寫入時優先用貨品主檔 SK_UNIT（見 product_info），這張表是退路。
# ----------------------------------------------------------------------

UNIT_MAP = {
    "公斤": "KG", "kg": "KG", "Kg": "KG", "kG": "KG", "KG": "KG",
}


def norm_unit(u: str) -> str:
    u = (u or "").strip()
    if not u:
        return "KG"
    return UNIT_MAP.get(u, UNIT_MAP.get(u.upper(), u))


# ----------------------------------------------------------------------
#  凌越主檔查詢（帶快取；lystk 預設用戶端沒逾時，先注入有逾時的）
# ----------------------------------------------------------------------

def _timeout_client():
    if lystk._client is None:
        from zeep import Client, Settings
        from zeep.transports import Transport
        lystk._client = Client(
            lystk.API_URL,
            settings=Settings(strict=False, xml_huge_tree=True),
            transport=Transport(timeout=60, operation_timeout=60),
        )
    return lystk._client


def first_icpno(s) -> str:
    """[fix 2026-07-14] 防呆下沉到權威層：公司代碼設定可為逗號多家或 "all"（那是庫存推送的
    語意）；訂單回寫/主檔查詢只能單一公司 → 取第一家非 all 代碼，"all"／留空一律視為 00。
    沒有這層時 LY_ICPNO=all 會被原封不動傳進凌越——product_info/customer_record 吞例外只印
    警告，單「照寫」但倉別/付款/業務員全空＝拋轉不過的壞單，比直接失敗更難察覺。"""
    for p in str(s or "").split(","):
        p = p.strip()
        if p and p.lower() != "all":
            return p
    return "00"


def _norm_dt(v) -> str:
    """時間字串正規化供比對：去空白、'/'→'-'、'T'→空格。"""
    return str(v or "").strip().replace("/", "-").replace("T", " ")


def find_written_order(icpno: str, row: dict):
    """[fix 2026-07-14] 寫入逾時/斷線後回查：這張單是否其實已寫進凌越。

    write_order 丟例外時凌越端**可能已開單成功**（SOAP timeout／連線中斷）；若一律當失敗
    回報，單留在雲端佇列、租約到期重派 → 再寫一張＝重複開單，且雲端衝突偵測抓不到
    （第一張根本沒回報單號）。

    比對鍵＝我們自己在 map_order 填的 OR_CREATEDATE（秒級時間戳）＋ OR_CTNO ＋ OR_DATE1：
    以客戶代碼撈訂貨單（0000A0），**恰好一張**三鍵全中才回其 OR_NO；0 張或多張一律回 None
    維持「失敗」語意讓雲端重試。查詢本身失敗也回 None——本函式只能把「結果不明」變安全，
    絕不可誤報成功（誤報會讓雲端記到錯的單號）。
    """
    ctno = (row.get("OR_CTNO") or "").strip()
    want_cd = _norm_dt(row.get("OR_CREATEDATE"))[:19]
    want_d1 = _norm_dt(row.get("OR_DATE1"))[:10]
    if not ctno or not want_cd:
        return None
    try:
        client = _timeout_client()
        resp = client.service.LyDataOut(
            ikye=lystk.fresh_key(), icpno=lystk.resolve_icpno(icpno), idakd="0000A0",
            ifld="", idetfields="OD_SKNO",
            irwhere="OR_CTNO=@v1@", iwhval=ctno,
            irec=0, imode=" " * 30, iorder="order by OR_NO desc", idtorder="",
            iswhere="", isifld="",
            Isecgroup="", iseckindfg="", iseckind="", Isecorder="", Isecrec=0,
        )
        if str(resp["LyDataOutResult"]) != "0" or not resp["ixmlda"]:
            return None
        import xml.etree.ElementTree as ET
        root = ET.fromstring(str(resp["ixmlda"]))
        hits = []
        for t in root.findall(".//LYDATATITLE"):
            rec = {c.tag: (c.text or "").strip() for c in t}
            if _norm_dt(rec.get("OR_CREATEDATE"))[:19] != want_cd:
                continue
            if want_d1 and _norm_dt(rec.get("OR_DATE1"))[:10] != want_d1:
                continue
            no = (rec.get("OR_NO") or "").strip()
            if no and no not in hits:
                hits.append(no)
        return hits[0] if len(hits) == 1 else None
    except Exception:
        return None


_prod_cache: dict = {}


def product_info(icpno: str, skno: str) -> dict:
    """依料號帶貨品主檔的預設倉 SK_RKWHNO 與正規單位 SK_UNIT；查不到回 {}。"""
    if not skno:
        return {}
    ck = (icpno, skno)
    if ck in _prod_cache:
        return _prod_cache[ck]
    info = {}
    try:
        _timeout_client()
        rows = lystk.query(icpno=icpno, idakd="000000", where="SK_NO='@v1@'", whval=skno)
        if rows:
            r = rows[0]
            info = {
                "whno": (r.get("SK_RKWHNO") or "").strip(),
                "unit": (r.get("SK_UNIT") or "").strip(),
            }
    except Exception as e:
        print(f"    ⚠ 查品項 {skno} 主檔失敗（略過）：{e}", file=sys.stderr)
    _prod_cache[ck] = info
    return info


_cust_cache: dict = {}


def customer_record(icpno: str, ctno: str) -> dict:
    """讀客戶主檔(000001)整筆（快取；查不到/失敗回 {}）。"""
    if not ctno:
        return {}
    ck = (icpno, ctno)
    if ck in _cust_cache:
        return _cust_cache[ck]
    rec: dict = {}
    try:
        _timeout_client()
        rows = lystk.query(icpno=icpno, idakd="000001", where="CT_NO='@v1@'", whval=ctno)
        if rows:
            rec = rows[0]
    except Exception as e:
        print(f"    ⚠ 查客戶 {ctno} 主檔失敗（略過）：{e}", file=sys.stderr)
    _cust_cache[ck] = rec
    return rec


def customer_defaults(icpno: str, ctno: str) -> dict:
    """客戶主檔 → 訂貨單預設值：CT_FKFS→OR_FKFS（付款方式）、CT_SALES→OR_SALES（業務員）。"""
    rec = customer_record(icpno, ctno)
    out: dict = {}
    fkfs = (rec.get("CT_FKFS") or "").strip()
    sales = (rec.get("CT_SALES") or "").strip()
    if fkfs:
        out["OR_FKFS"] = fkfs
    if sales:
        out["OR_SALES"] = sales
    return out


# ----------------------------------------------------------------------
#  HTTP（標準庫 urllib，免裝 requests）
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
    """當日全部未回寫（僅供 CLI 手動批次／診斷用；常駐代理一律用 /wait 佇列）。"""
    url = f"{base.rstrip('/')}/admin/lingyue-writeback/pending?date={date_str}"
    res = _http("GET", url, key)
    return res.get("orders", []) or []


def post_callback(base: str, key: str, results: list) -> dict:
    url = f"{base.rstrip('/')}/admin/lingyue-writeback/callback"
    return _http("POST", url, key, {"results": results})


# ----------------------------------------------------------------------
#  雲端訂單 → 凌越 write_order row（唯一權威對映）
# ----------------------------------------------------------------------

def map_order(order: dict, *, icpno: str = "", whno: str = "", price: str = "",
              create_name: str = "052", check: str = "1", maker: str = "",
              rem_prefix: str = "", wh_map: dict | None = None,
              or_check: str | None = None, **_legacy) -> dict:
    """把一張雲端訂單轉成 ly_order.write_order 需要的 row dict。

    規則（詳見 docs/資料處理規則.md）：
      倉別  OD_WARE：料號→貨品主檔 SK_RKWHNO；查不到 → wh_map（舊版對照）→ whno(LY_DEFAULT_WHNO)。
      單位  OD_UNIT：貨品主檔 SK_UNIT 優先；退回雲端單位時「公斤→KG」正規化。
      審核  OR_CHECK：預設 "1" 已審核（拋轉需要）；"0"=未審核。
      人/時 OR_MAKER/OR_CREATE*/OR_MODIFY*：操作員代碼（maker 或 create_name）＋現在時間。
      客戶  OR_FKFS/OR_SALES：由客戶主檔帶入。
      缺料號品項：跳過並警示（凌越不收無料號明細行）。

    ★ 本檔會被 local_import 熱替換到「各版本」打包的代理 exe 旁，簽名必須向下相容：
      PR#30 之前的舊 exe 呼叫 map_order(o, whno=…, price=…, wh_map=…, or_check=…)，
      不帶 icpno。故 icpno 缺省時讀 LY_ICPNO（預設 00）、or_check 是 check 的舊名、
      wh_map（料號→預設倉別對照）當倉別備援，其餘未知參數忽略並警示。
    """
    # ── 舊版 exe 相容 ───────────────────────────────────────────
    # first_icpno：LY_ICPNO 可能是 "all"/"00,02"（庫存推送語意），回寫只能單一公司
    icpno = first_icpno(icpno or os.environ.get("LY_ICPNO") or "00")
    if or_check is not None:
        check = or_check
    wh_map = wh_map or {}
    if _legacy:
        print(f"    ⚠ map_order 忽略未知參數（呼叫端 exe 版本不同）：{', '.join(_legacy)}",
              file=sys.stderr)

    details = []
    for it in order.get("items", []) or []:
        skno = (it.get("product_code") or "").strip()
        name = (it.get("product_name") or "").strip()
        if not skno:
            print(f"    ⚠ 跳過無凌越料號品項：{name or '(無名)'}（客戶 {order.get('customer_name')}）",
                  file=sys.stderr)
            continue
        qty = it.get("quantity")
        pinfo = product_info(icpno, skno)
        det = {
            "OD_SKNO": skno,
            "OD_NAME": name,
            "OD_UNIT": (pinfo.get("unit") or norm_unit(it.get("unit"))).strip(),
            "OD_WARE": pinfo.get("whno") or wh_map.get(skno) or whno,
            "OD_QTY": qty if qty is not None else 0,
        }
        # 單價：留空＝不送 OD_PRICE → 凌越依客戶售價表自動帶價。
        if price not in (None, ""):
            det["OD_PRICE"] = price
        note = (it.get("item_note") or "").strip()
        if note:
            det["OD_REM"] = note
        details.append(det)

    rem = (order.get("doc_remark") or "").strip()
    if rem_prefix:
        rem = (rem_prefix + rem).strip()

    order_date = (order.get("order_date") or "").strip().replace("/", "-")  # YYYY-MM-DD
    ctno = (order.get("customer_code") or "").strip()
    now_dt = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    op = (maker or create_name).strip()
    row = {
        "OR_CTNO": ctno,
        "OR_CTNAME": (order.get("customer_name") or "").strip(),
        "OR_DATE1": order_date,
        "OR_DATE2": order_date,
        "OR_REM": rem,
        "OR_CHECK": "1" if str(check).strip() == "1" else "0",
        "OR_MAKER": op,                  # 製單人（操作員代碼，非 LY）
        "OR_CREATEDATE": now_dt,         # 建立日期（拋轉依此抓單）
        "OR_CREATENAME": op,             # 建立人
        "OR_MODIFYDATE": now_dt,         # 異動日期（比照手打單）
        "OR_MODIFYNAME": op,             # 異動人
        "details": details,
    }
    row.update(customer_defaults(icpno, ctno))  # OR_FKFS / OR_SALES
    return row


# ----------------------------------------------------------------------
#  測試工具：為指定客戶寫一張測試單，驗證欄位帶入
# ----------------------------------------------------------------------

def run_test_ctno(args, *, icpno, whno, price, create_name, check, maker, date_str) -> int:
    ctno = args.test_ctno.strip()
    cust = customer_record(icpno, ctno)
    if not cust:
        print(f"❌ 查無客戶 {ctno}（ICPNO={icpno}）", file=sys.stderr)
        return 1
    ctname = (cust.get("CT_NAME") or "").strip()
    print(f"▶ 客戶 {ctno} {ctname}｜客戶主檔 CT_FKFS={cust.get('CT_FKFS','')!r} "
          f"CT_SALES={cust.get('CT_SALES','')!r}")

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
    # 拋轉會把 # 寫進備註；要驗證拋轉用 --no-test-mark 讓備註留空（拋完自己記單號刪除）。
    rem_prefix = "" if args.no_test_mark else TEST_REM_PREFIX
    row = map_order(order, icpno=icpno, whno=whno, price=price,
                    create_name=create_name, check=check, maker=maker,
                    rem_prefix=rem_prefix)
    print(f"  即將寫入：OR_CHECK={row.get('OR_CHECK','')!r} OR_MAKER={row.get('OR_MAKER','')!r} "
          f"OR_FKFS={row.get('OR_FKFS','')!r} OR_SALES={row.get('OR_SALES','')!r} "
          f"OR_CREATEDATE={row.get('OR_CREATEDATE','')} 料號={skno} "
          f"倉別={row['details'][0].get('OD_WARE','')!r} 單位={row['details'][0].get('OD_UNIT','')!r}")
    try:
        new_nos = ly_order.write_order(icpno=icpno, rows=[row], verbose=True)
    except RuntimeError as e:
        print(f"❌ 寫入失敗：{e}", file=sys.stderr)
        return 1
    or_no = new_nos[0]
    print(f"\n✅ 已寫入測試訂貨單 {or_no}")
    print(f"   查實際欄位：python ly_query_unchecked_sales.py --doc {or_no} --details")
    print(f"   刪除測試單：python -c \"import sys;sys.path.insert(0,r'D:\\Work\\lystk_tool');"
          f"import ly_order;print(ly_order.delete_order('{icpno}','{or_no}'))\"")
    return 0


# ----------------------------------------------------------------------
#  主流程（CLI）
# ----------------------------------------------------------------------

def run(args) -> int:
    base = (args.base or os.environ.get("LY_CLOUD_BASE") or "").strip()
    key = (args.key or os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    icpno = first_icpno(args.icpno or os.environ.get("LY_ICPNO") or "00")
    whno = args.warehouse if args.warehouse is not None else os.environ.get("LY_DEFAULT_WHNO", "")
    price = args.price if args.price is not None else os.environ.get("LY_DEFAULT_PRICE", "")
    create_name = (args.create_name or os.environ.get("LY_CREATE_NAME") or "052").strip()
    # 審核：預設已審核（拋轉需要）。--unaudited 或 LY_AUDITED=0 才寫未審核。
    env_audited = os.environ.get("LY_AUDITED", "1").strip().lower() not in ("0", "false", "no")
    check_val = "0" if args.unaudited or not env_audited else "1"
    maker_val = (args.maker or os.environ.get("LY_MAKER") or "").strip()
    date_str = args.date or datetime.date.today().strftime("%Y-%m-%d")

    # 指定客戶寫測試單：不需雲端 pending，直接寫凌越驗證欄位帶入
    if args.test_ctno:
        return run_test_ctno(args, icpno=icpno, whno=whno, price=price,
                             create_name=create_name, check=check_val, maker=maker_val,
                             date_str=date_str)

    if not base or not key:
        print("❌ 請設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY（或用 --base / --key）", file=sys.stderr)
        return 2

    print(f"▶ 抓取雲端待回寫訂單 date={date_str} ...")
    orders = fetch_pending(base, key, date_str)
    print(f"  共 {len(orders)} 張訂單")
    if not orders:
        print("  沒有待回寫的訂單，結束。")
        return 0

    common = dict(icpno=icpno, whno=whno, price=price,
                  create_name=create_name, check=check_val, maker=maker_val)

    # ── dry-run：只組單印出，不寫凌越、不回填 ───────────────────────
    if args.dry_run:
        for o in orders:
            row = map_order(o, **common)
            print(f"\n── order_id={o.get('order_id')}  客戶={row['OR_CTNO']} {row['OR_CTNAME']} ──")
            print(json.dumps(row, ensure_ascii=False, indent=2))
        print("\n(dry-run：未寫入凌越、未回填)")
        return 0

    # ── test：只寫第一張（標記測試）→ 驗證 →（預設）刪除；不回填 ──────
    if args.test:
        o = orders[0]
        row = map_order(o, rem_prefix=TEST_REM_PREFIX, **common)
        print(f"\n▶ 測試寫入第一張：order_id={o.get('order_id')}  客戶={row['OR_CTNO']} {row['OR_CTNAME']}")
        try:
            new_nos = ly_order.write_order(icpno=icpno, rows=[row], verbose=True)
        except RuntimeError as e:
            print(f"❌ 測試寫入失敗：{e}")
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
    # [guard 2026-07-14] 整批寫入必須明確帶 --apply：無旗標直接執行本腳本（或舊排程 bat）
    # 會把清單整批寫進凌越——正是誤寫 60 張事故的路徑。日常回寫一律走
    # 凌越整合代理（ly_agent_gui.py）的 /wait 長連線模式。
    if not getattr(args, "apply", False):
        print("⛔ 未帶 --apply，不執行整批寫入。", file=sys.stderr)
        print("   ・預覽組單內容：--dry-run", file=sys.stderr)
        print("   ・日常回寫：請用凌越整合代理視窗（ly_agent_gui.py，/wait 模式只寫使用者按過『上傳凌越』的單）", file=sys.stderr)
        print("   ・確定要把上面清單整批寫入凌越：加上 --apply 重跑", file=sys.stderr)
        return 2

    results = []
    ok_count = 0
    for o in orders:
        oid = o.get("order_id")
        row = map_order(o, **common)
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
    p = argparse.ArgumentParser(description="雲端後台 ↔ 凌越 ERP 訂貨單回寫橋接（統一版）")
    p.add_argument("--date", help="要回寫的日期 YYYY-MM-DD（預設今天）")
    p.add_argument("--base", help="雲端後台網址（預設讀 LY_CLOUD_BASE）")
    p.add_argument("--key", help="回寫金鑰（預設讀 LY_WRITEBACK_KEY）")
    p.add_argument("--icpno", help="公司代碼（預設 00 松富，或 LY_ICPNO）")
    p.add_argument("--warehouse", help="後備倉別 OD_WARE（品項查不到預設倉時用，或 LY_DEFAULT_WHNO）")
    p.add_argument("--price", help="預設單價 OD_PRICE（預設留空，或 LY_DEFAULT_PRICE）")
    p.add_argument("--create-name", help="建立人代碼 OR_CREATENAME（預設 052，或 LY_CREATE_NAME）")
    p.add_argument("--maker", help="覆寫製單人 OR_MAKER（預設同建立人）")
    p.add_argument("--unaudited", action="store_true", help="寫成未審核 OR_CHECK=0（預設已審核=1，拋轉需要）")
    p.add_argument("--test-ctno", help="測試：為指定客戶代碼寫一張測試訂貨單，驗證欄位帶入")
    p.add_argument("--test-skno", help="搭配 --test-ctno：測試明細用的料號（省略則自動取一個）")
    p.add_argument("--no-test-mark", action="store_true", help="測試單備註留空（讓拋轉能寫 # 以驗證）")
    p.add_argument("--dry-run", action="store_true", help="只抓+組單印出，不寫凌越、不回填")
    p.add_argument("--apply", action="store_true", help="確認執行整批寫入（無此旗標一律拒絕；日常回寫請用 ly_agent_gui 的 /wait 模式）")
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
