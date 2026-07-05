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

  GET /sp?date=YYYY-MM-DD&icpno=00&office=<營業所>
      批次條件查詢：某天 + 某公司 + 某營業所 的所有銷貨單（含明細）。
      靠 lystk.query（idakd=0000A1）拉主表，明細以 verify_sp_no 補齊。
      → 200 {"count": N, "orders":[ {..主表.., "details":[...]}, ... ]}
      ※ 帶 office 過濾需先設環境變數 LY_OFFICE_FIELD（銷貨單營業所欄位名）；
        未設而帶 office → 400。用 `--dump-fields <單號>` 找出該欄位名。
        不帶 office 可直接查整日（某公司當天全部銷貨單）。

認證
----
  除 /health 外，一律需要 HTTP 標頭  X-Query-Key: <金鑰>
  金鑰 = 環境變數 LY_QUERY_KEY（必填；與松成端設定的一字不差）。

設定（環境變數，或 CLI 覆蓋）
-----------------------------
  LY_QUERY_KEY   松成帶的 X-Query-Key 金鑰（必填）
  LY_QUERY_HOST  監聽位址，預設 0.0.0.0（讓 LAN 上的松成連得到）
  LY_QUERY_PORT  監聽埠，預設 8787
  LY_ICPNO       預設公司代碼，預設 "00"（松富）；查詢可用 ?icpno= 覆蓋

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
#  查詢邏輯
# ----------------------------------------------------------------------

def _normalize(rec: dict) -> dict:
    """把 ly_datain 回來的單張紀錄整理成回傳格式：明細統一放在 details。"""
    out = {k: v for k, v in rec.items() if k != "_details"}
    out["details"] = rec.get("_details", []) or []
    return out


def query_one(icpno: str, sp_no: str) -> dict | None:
    """單張回查——直接用現成的 ly_datain.verify_sp_no。"""
    ly = _load_ly_datain()
    rec = ly.verify_sp_no(icpno, sp_no)
    return _normalize(rec) if rec else None


SP_IDAKD = "0000A1"  # 凌越資料種類：銷貨單

# 「營業所」是銷貨單主表的哪個欄位——待用真實單據 dump 確認後填此環境變數（如 SP_DEPNO）。
# 設了才會對營業所做伺服器端過濾（lystk.query 的 where/whval）；沒設而帶了 office → 回錯提示。
OFFICE_FIELD = os.environ.get("LY_OFFICE_FIELD", "").strip()


def _detail_list(rec: dict) -> list:
    """從一筆紀錄取明細，容忍 lystk.query 與 ly_datain 兩種可能的鍵名。"""
    return rec.get("_details") or rec.get("details") or []


def query_invoices(icpno: str, date_str: str, office: str) -> list[dict]:
    """
    批次查詢：某天 + 某公司(icpno) + 某營業所(office) 的所有銷貨單（含明細）。

    用 lystk.query 拉主表清單；營業所以 where/whval 在伺服器端過濾。
    lystk.query 若不含明細，逐張用 ly_datain.verify_sp_no 補上（松成要主表+明細）。

    待辦（不影響單張查詢與「不帶 office」的整日查詢）：
      · 設定 LY_OFFICE_FIELD＝銷貨單營業所欄位名，才能對 office 過濾。
        用真實單據 dump 找出來：
          python ly_query_server.py --dump-fields <單號>
      · 若 lystk.query 已直接回明細，會自動沿用、不再逐張補查（見 _detail_list）。
    """
    if office and not OFFICE_FIELD:
        raise ValueError(
            "帶了 office 但尚未設定 LY_OFFICE_FIELD（銷貨單營業所欄位名）。"
            " 先用 `--dump-fields <單號>` 找出欄位名並設環境變數，或先不帶 office 查整日。"
        )

    ly = _load_lystk()
    kwargs = {"icpno": icpno, "idakd": SP_IDAKD, "date": date_str}
    if office:
        kwargs["where"] = OFFICE_FIELD
        kwargs["whval"] = office
    rows = ly.query(**kwargs) or []

    out = []
    for r in rows:
        # lystk.query 若已含明細就直接用；否則用單號回查補明細。
        if _detail_list(r):
            out.append(_normalize(r))
            continue
        sp_no = (r.get("SP_NO") or "").strip()
        full = query_one(icpno, sp_no) if sp_no else None
        if full is None:
            merged = dict(r)
            merged["details"] = []
            out.append(merged)
        else:
            out.append(full)
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
    p.add_argument("--icpno", default=os.environ.get("LY_ICPNO", "00"), help="預設公司代碼（預設 00 松富）")
    p.add_argument("--check", metavar="SP_NO", help="不開服務，直接命令列單張查詢並印出（自測凌越連線用）")
    p.add_argument("--dump-fields", metavar="SP_NO", help="不開服務，dump 該單主表所有欄位名（找『營業所』欄位用）")
    return p


def main() -> int:
    args = build_parser().parse_args()
    if args.dump_fields:
        order = query_one(args.icpno, args.dump_fields.strip())
        if not order:
            print("查不到")
            return 1
        print("主表欄位（找出哪個是營業所，設成 LY_OFFICE_FIELD）：")
        for k, v in order.items():
            if k == "details":
                continue
            print(f"  {k:<14} {v!r}")
        print(f"  （明細 details 共 {len(order.get('details', []))} 行）")
        return 0
    if args.check:
        order = query_one(args.icpno, args.check.strip())
        print(json.dumps(order, ensure_ascii=False, indent=2) if order else "查不到")
        return 0 if order else 1
    return serve(args.host, args.port, args.key.strip(), args.icpno.strip())


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(main())
