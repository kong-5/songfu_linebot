#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_query_server.py — 凌越 ERP 銷貨單「查詢」對外服務（給 songyang178go 松成模組用）
=====================================================================

跑在已能連到凌越 LAN、且有 ly_datain.py / lystk.py 的那台 Windows
（D:\\Work\\lystk_tool 旁）。開一支輕量 HTTP 服務，讓松成模組「直連」查詢凌越
銷貨單，不必經雲端。用標準庫 http.server，免裝任何套件。

架構（B：松成直連 Windows）
--------------------------
  松成模組 ──HTTP──▶ 本服務(Windows) ──import ly_datain/lystk──▶ 凌越 ERP
           ◀──JSON──                ◀── SP_/SD_ 資料 ──

端點
----
  GET /health
      不需金鑰。存活檢查，回 {"ok": true}。

  GET /sp/<sp_no>?icpno=00
      單張回查。靠 ly_datain.verify_sp_no（現成，已可用）。
      → 200 {"order": {..主表.. , "details":[..明細..]}}   查到
      → 404 {"error":"not_found"}                          查不到

  GET /sp?date=YYYY-MM-DD&office=<部門編號或店名>
      批次條件查詢：某天 + 某部門/門市 的所有銷貨單（含明細）。
      office 可傳部門編號（311）或店名（廣東門市），伺服器正規化成編號再查。
      公司(icpno)自動取「部門所屬公司」（松成門市＝03），呼叫端不必知道公司代碼。
      靠 lystk.query（idakd=0000A1，where=SP_DPNO）拉主表，明細以 verify_sp_no 補齊，附 office_name。
      → 200 {"count": N, "orders":[ {..主表.., "office_name":..., "details":[...]}, ... ]}
      ※ 不帶 office 則查該公司當天全部（可用 ?icpno= 指定公司）。

  GET /departments
      列出部門編號對照（來自 ly_departments.json），松成選店/對名用。
      → 200 {"office_field":"SP_DPNO","default_icpno":"03",
              "departments":{"311":{"name":"廣東門市","icpno":"03"},...}}

部門對照（單一來源，多程式共用）
--------------------------------
  scripts/ly_departments.json —— 內含：
    office_field   部門編號欄位名（＝SP_DPNO）
    default_icpno  未指定公司時的預設（松成＝03）
    departments    {部門編號: {name, icpno}}，每個部門自帶所屬公司
  加店或別的程式要用，改／讀這一個檔即可。編號字串以保留前導零（如 032）。

認證
----
  除 /health 外，一律需要 HTTP 標頭  X-Query-Key: <金鑰>
  金鑰 = 環境變數 LY_QUERY_KEY（必填；與松成端設定的一字不差）。

設定（環境變數，或 CLI 覆蓋）
-----------------------------
  LY_QUERY_KEY     松成帶的 X-Query-Key 金鑰（必填）
  LY_QUERY_HOST    監聽位址，預設 0.0.0.0（讓 LAN 上的松成連得到）
  LY_QUERY_PORT    監聽埠，預設 8787
  LY_ICPNO         預設公司代碼；留空則用 ly_departments.json 的 default_icpno（松成 03）
  LY_OFFICE_FIELD  部門欄位名（預設讀 ly_departments.json 的 office_field＝SP_DPNO）
  LY_DETAIL_FIELDS 明細要回的 SD_ 欄位（逗號分隔；預設含品項/數量/單價/小計等）

用法
----
  # Windows 上（PowerShell）
  cd D:\\Work\\lystk_tool
  $env:LY_QUERY_KEY="跟松成約好的金鑰"
  python <repo>\\scripts\\ly_query_server.py

  # 快速自測單張（不開服務，直接命令列查一張，驗證連得到凌越）
  python ly_query_server.py --check <銷貨單號>

松成端呼叫範例
--------------
  GET http://<Windows-IP>:8787/sp/AB123456     標頭 X-Query-Key: <金鑰>
  GET http://<Windows-IP>:8787/sp?date=2026-07-05&icpno=00&office=<營業所>
"""

import os
import sys
import json
import argparse
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote
from xml.etree import ElementTree as ET

# 讓本機找得到 ly_datain / lystk（與探索工具同目錄）。改成你的實際路徑。
LY_TOOL_DIR = os.environ.get("LY_TOOL_DIR", r"D:\Work\lystk_tool")
if LY_TOOL_DIR and LY_TOOL_DIR not in sys.path:
    sys.path.insert(0, LY_TOOL_DIR)

# 延遲載入：讓這支檔案在沒有凌越環境的機器上也 import 得起來（方便審閱/測路由），
# 真正用到凌越時才載入 ly_datain / lystk，載不到就回明確錯誤。
_ly_datain = None
_lystk = None


def _load_ly_datain():
    global _ly_datain
    if _ly_datain is None:
        import ly_datain  # noqa: E402  提供 verify_sp_no / write_invoice / delete_invoice
        _ly_datain = ly_datain
    return _ly_datain


def _load_lystk():
    global _lystk
    if _lystk is None:
        import lystk  # noqa: E402  提供底層 get_client / LyDataOut / LyDataPage 等
        _lystk = lystk
    return _lystk


# ----------------------------------------------------------------------
#  查詢邏輯——直接呼叫凌越 LyDataOut（帶明細）
# ----------------------------------------------------------------------
#  ly_datain.verify_sp_no / lystk.query 都只回主表（idetfields 傳空、且只解析
#  LYDATATITLE）。要拿明細，需自行呼叫 LyDataOut 並把 idetfields 填上要的 SD_ 欄位，
#  再解析 LYDATADETAIL 節點。明細以 SD_NO(=主單號) 對應主表、SD_SEQ 為行序。

# 明細要回哪些 SD_ 欄位（品項/數量/單價/小計等）。可用環境變數覆蓋；
# 一律確保含 SD_NO(對應主單)、SD_SEQ(排序) 這兩個必要欄位。
DETAIL_FIELDS = os.environ.get(
    "LY_DETAIL_FIELDS",
    "SD_SEQ,SD_SKNO,SD_NAME,SD_SPEC,SD_UNIT,SD_QTY,SD_PRICE,SD_STOT,SD_REM,SD_NO",
)

_LYDATAOUT_ERR = {"-1": "SQL連接失敗", "-2": "讀取失敗", "-3": "金鑰失效",
                  "-4": "金鑰不合法", "-5": "無權限"}


def _detail_fields() -> str:
    fields = [x.strip() for x in DETAIL_FIELDS.split(",") if x.strip()]
    for req in ("SD_NO", "SD_SEQ"):
        if req not in fields:
            fields.append(req)
    return ",".join(fields)


def _lydataout(icpno: str, where: str, whval: str, *, want_details: bool):
    """直接呼叫凌越 LyDataOut。回 (titles, details)，各為 dict list。"""
    ly = _load_lystk()
    client = ly.get_client()
    resp = client.service.LyDataOut(
        ikye=ly.fresh_key(), icpno=ly.resolve_icpno(icpno), idakd=SP_IDAKD,
        ifld="", idetfields=(_detail_fields() if want_details else ""),
        irwhere=where, iwhval=whval,
        irec=0, imode=" " * 30,
        iorder="order by SP_NO", idtorder="",
        iswhere="", isifld="",
        Isecgroup="", iseckindfg="", iseckind="",
        Isecorder="", Isecrec=0,
    )
    rc = str(resp["LyDataOutResult"])
    if rc != "0":
        raise RuntimeError(f"LyDataOut 失敗：{_LYDATAOUT_ERR.get(rc, f'code={rc}')}")
    xml = resp["ixmlda"]
    if not xml:
        return [], []
    root = ET.fromstring(str(xml))
    titles = [{c.tag: (c.text or "").strip() for c in t} for t in root.findall(".//LYDATATITLE")]
    details = [{c.tag: (c.text or "").strip() for c in d} for d in root.findall(".//LYDATADETAIL")]
    return titles, details


def _attach_details(header: dict, details: list) -> dict:
    """把屬於這張主單(SD_NO==SP_NO)的明細行，依 SD_SEQ 排序後掛進 header['details']。"""
    sp_no = str(header.get("SP_NO", "")).strip()
    mine = [d for d in details if str(d.get("SD_NO", "")).strip() == sp_no]
    mine.sort(key=lambda d: int(d.get("SD_SEQ") or 0))
    out = dict(header)
    out["details"] = mine
    return out


def _fetch_one(icpno: str, sp_no: str) -> dict | None:
    """單張：主表 + 明細（一次 LyDataOut）。"""
    titles, details = _lydataout(icpno, "SP_NO=@v1@", sp_no, want_details=True)
    if not titles:
        return None
    return _attach_details(titles[0], details)


SP_IDAKD = "0000A1"  # 凌越資料種類：銷貨單

# ----------------------------------------------------------------------
#  部門（門市／營業所）對照——單一來源 scripts/ly_departments.json，多程式共用
# ----------------------------------------------------------------------
#  該檔放三件事：
#    office_field   銷貨單主表「部門編號」的欄位名（凌越欄位＝SP_DPNO）
#    default_icpno  未指定公司時的預設公司代碼（松成＝03）
#    departments    {部門編號: {name, icpno}}，每個部門自帶所屬公司；
#                   編號一律字串以保留前導零（如 032）。
#  呼叫端只需傳「部門編號」，服務依此表自動用對的公司(icpno)查。
#  日後加店或別的程式要用，改／讀這一個檔即可，不必動程式。
#  （向下相容舊格式 {部門編號: 名稱}：icpno 視為空、退回用預設公司。）

_DEPT_FILE = os.environ.get(
    "LY_DEPARTMENTS_FILE",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "ly_departments.json"),
)
_dept_cache = None


def _load_departments() -> dict:
    """讀部門對照檔並快取。回 {'office_field', 'default_icpno', 'departments':{code:{name,icpno}}}。"""
    global _dept_cache
    if _dept_cache is None:
        try:
            with open(_DEPT_FILE, encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            data = {}
        depts = {}
        for code, val in (data.get("departments") or {}).items():
            code = str(code).strip()
            if isinstance(val, dict):
                depts[code] = {"name": val.get("name", ""), "icpno": str(val.get("icpno", "")).strip()}
            else:  # 舊格式 {code: name}
                depts[code] = {"name": val, "icpno": ""}
        _dept_cache = {
            "office_field": (os.environ.get("LY_OFFICE_FIELD") or data.get("office_field") or "").strip(),
            "default_icpno": str(data.get("default_icpno") or "").strip(),
            "departments": depts,
        }
    return _dept_cache


def office_field() -> str:
    """銷貨單「部門編號」欄位名（環境變數優先，其次 JSON 的 office_field）。"""
    return _load_departments()["office_field"]


def json_default_icpno() -> str:
    """對照檔設定的預設公司代碼（可能為空）。"""
    return _load_departments()["default_icpno"]


def resolve_office(inp: str) -> str:
    """把使用者傳的部門（編號或店名）正規化成『部門編號』。查無 → ValueError。"""
    inp = (inp or "").strip()
    depts = _load_departments()["departments"]
    if inp in depts:                              # 直接就是編號
        return inp
    for code, meta in depts.items():              # 傳的是店名
        if inp == meta["name"]:
            return code
    known = "、".join(f"{c}={m['name']}" for c, m in depts.items()) or "（對照表為空）"
    raise ValueError(f"未知部門「{inp}」。可用：{known}。若為新店請先加進 {os.path.basename(_DEPT_FILE)}。")


def office_name(code: str) -> str:
    """由部門編號取店名，取不到就原樣回傳。"""
    meta = _load_departments()["departments"].get(str(code).strip())
    return meta["name"] if meta else code


def office_icpno(code: str) -> str:
    """由部門編號取所屬公司代碼，取不到回空字串。"""
    meta = _load_departments()["departments"].get(str(code).strip())
    return meta["icpno"] if meta else ""


def _with_office_name(order: dict) -> dict:
    """主表若有部門欄位，補上人看得懂的店名。"""
    fld = office_field()
    if fld and order.get(fld) is not None:
        order["office_name"] = office_name(order.get(fld))
    return order


def query_one(icpno: str, sp_no: str) -> dict | None:
    """單張回查：主表 + 明細 + 店名。"""
    order = _fetch_one(icpno, sp_no)
    return _with_office_name(order) if order else None


def query_invoices(icpno: str, date_str: str, office: str) -> list[dict]:
    """
    批次查詢：某天 + 某部門/門市(office) 的所有銷貨單（含明細）。

    office 可傳部門編號（311）或店名（廣東門市），會正規化成編號。
    公司(icpno)以「部門自帶的 icpno」優先（松成門市＝03）；沒帶部門時才用傳入的 icpno。

    做法：先用 lystk.query（idakd=0000A1，日期）拉當天主表清單，本地依 SP_DPNO 過濾出
    該部門的單（lystk.query 的 where/whval 實測語意非「欄位=值」，故用本地過濾）；
    再對每張單以 LyDataOut 撈「主表+明細」（verify_sp_no/query 都不回明細，見 _lydataout）。
    """
    code = resolve_office(office) if office else ""
    fld = office_field()
    if code and not fld:
        raise ValueError(
            "帶了部門但尚未設定部門欄位名（ly_departments.json 的 office_field 或環境變數 LY_OFFICE_FIELD）。"
        )

    # 部門自帶公司優先；否則用傳入/預設 icpno。撈明細也用同一個 icpno。
    eff_icpno = (office_icpno(code) if code else "") or icpno

    ly = _load_lystk()
    headers = ly.query(icpno=eff_icpno, idakd=SP_IDAKD, date=date_str) or []
    if code:
        headers = [h for h in headers if str(h.get(fld, "")).strip() == code]

    out = []
    for h in headers:
        sp_no = (h.get("SP_NO") or "").strip()
        full = _fetch_one(eff_icpno, sp_no) if sp_no else None
        order = full if full is not None else {**h, "details": []}
        out.append(_with_office_name(order))
    return out


# ----------------------------------------------------------------------
#  HTTP 服務
# ----------------------------------------------------------------------

class _Handler(BaseHTTPRequestHandler):
    server_version = "LyQuery/1.0"

    # 服務層設定由 make_handler 注入
    query_key = ""
    default_icpno = "00"

    def _send(self, code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _auth_ok(self) -> bool:
        got = (self.headers.get("X-Query-Key") or "").strip()
        return bool(self.query_key) and hmac.compare_digest(got, self.query_key)

    def log_message(self, fmt, *args):
        # 精簡日誌到 stderr（含來源 IP，方便追誰在打）
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)

        # 存活檢查——不需金鑰
        if path == "/health":
            self._send(200, {"ok": True})
            return

        # 其餘一律驗金鑰
        if not self._auth_ok():
            self._send(401, {"error": "unauthorized", "hint": "缺少或不符 X-Query-Key 標頭"})
            return

        icpno = (qs.get("icpno", [self.default_icpno])[0] or self.default_icpno).strip()

        # GET /departments — 列出部門編號對照（松成要選店/對名用）
        if path == "/departments":
            depts = _load_departments()
            self._send(200, {
                "office_field": depts["office_field"],
                "default_icpno": depts["default_icpno"],
                "departments": depts["departments"],
            })
            return

        # GET /sp/<sp_no> — 單張回查（現成可用）
        if path.startswith("/sp/"):
            sp_no = unquote(path[len("/sp/"):]).strip()
            if not sp_no:
                self._send(400, {"error": "missing_sp_no"})
                return
            try:
                order = query_one(icpno, sp_no)
            except Exception as e:
                self._send(500, {"error": "ly_error", "detail": str(e)})
                return
            if order is None:
                self._send(404, {"error": "not_found", "sp_no": sp_no})
                return
            self._send(200, {"order": order})
            return

        # GET /sp?date=&icpno=&office= — 批次條件查詢
        if path == "/sp":
            date_str = (qs.get("date", [""])[0] or "").strip()
            office = (qs.get("office", [""])[0] or "").strip()
            if not date_str:
                self._send(400, {"error": "missing_date", "hint": "需帶 ?date=YYYY-MM-DD"})
                return
            try:
                orders = query_invoices(icpno, date_str, office)
            except ValueError as e:
                # 例：帶了 office 但未設 LY_OFFICE_FIELD → 屬用法/設定問題
                self._send(400, {"error": "bad_request", "detail": str(e)})
                return
            except Exception as e:
                self._send(500, {"error": "ly_error", "detail": str(e)})
                return
            self._send(200, {"count": len(orders), "orders": orders})
            return

        self._send(404, {"error": "unknown_route", "path": path})


def make_handler(query_key: str, default_icpno: str):
    return type("_BoundHandler", (_Handler,), {
        "query_key": query_key,
        "default_icpno": default_icpno,
    })


def serve(host: str, port: int, query_key: str, default_icpno: str) -> int:
    if not query_key:
        print("❌ 請設定 LY_QUERY_KEY（或用 --key）——沒有金鑰不啟動，避免裸奔。", file=sys.stderr)
        return 2
    handler = make_handler(query_key, default_icpno)
    httpd = ThreadingHTTPServer((host, port), handler)
    print(f"▶ ly_query_server 監聽 http://{host}:{port}  (icpno 預設={default_icpno})")
    print(f"  端點：GET /health | GET /sp/<單號> | GET /sp?date=&icpno=&office=")
    print(f"  凌越工具目錄：{LY_TOOL_DIR}")
    print("  Ctrl-C 結束。")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n收到中斷，關閉服務。")
    finally:
        httpd.server_close()
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="凌越銷貨單查詢對外服務（松成模組用）")
    p.add_argument("--host", default=os.environ.get("LY_QUERY_HOST", "0.0.0.0"), help="監聽位址（預設 0.0.0.0）")
    p.add_argument("--port", type=int, default=int(os.environ.get("LY_QUERY_PORT", "8787")), help="監聽埠（預設 8787）")
    p.add_argument("--key", default=os.environ.get("LY_QUERY_KEY", ""), help="X-Query-Key 金鑰（預設讀 LY_QUERY_KEY）")
    p.add_argument("--icpno", default=os.environ.get("LY_ICPNO", ""),
                   help="預設公司代碼；留空則用 ly_departments.json 的 default_icpno（松成 03），再退 00")
    p.add_argument("--check", metavar="SP_NO", help="不開服務，直接命令列單張查詢並印出（自測凌越連線用）")
    p.add_argument("--dump-fields", metavar="SP_NO", help="不開服務，dump 該單主表所有欄位名（找『部門編號』欄位用）")
    p.add_argument("--list", metavar="DATE", help="不開服務，命令列批次查某天銷貨單並印出（搭配 --office 過濾部門）")
    p.add_argument("--office", metavar="部門", help="搭配 --list：部門編號或店名（如 311 或 廣東門市）")
    return p


def main() -> int:
    args = build_parser().parse_args()
    # 有效預設公司：--icpno/環境變數 > 對照檔 default_icpno > 00
    icpno = args.icpno.strip() or json_default_icpno() or "00"
    if args.dump_fields:
        order = query_one(icpno, args.dump_fields.strip())
        if not order:
            print("查不到")
            return 1
        print("主表欄位（找出哪個欄位的值是部門編號 311/032，把欄位名填進 ly_departments.json 的 office_field）：")
        for k, v in order.items():
            if k == "details":
                continue
            print(f"  {k:<14} {v!r}")
        print(f"  （明細 details 共 {len(order.get('details', []))} 行）")
        return 0
    if args.list:
        try:
            orders = query_invoices(icpno, args.list.strip(), (args.office or "").strip())
        except ValueError as e:
            print(f"❌ {e}", file=sys.stderr)
            return 2
        print(json.dumps({"count": len(orders), "orders": orders}, ensure_ascii=False, indent=2))
        return 0
    if args.check:
        order = query_one(icpno, args.check.strip())
        print(json.dumps(order, ensure_ascii=False, indent=2) if order else "查不到")
        return 0 if order else 1
    return serve(args.host, args.port, args.key.strip(), icpno)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(main())
