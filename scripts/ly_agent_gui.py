#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_agent_gui.py — 凌越整合代理（視窗版）
=========================================

把原本要分開跑的兩支內網代理「包成一支有視窗的程式」，掛在能連凌越 LAN 的
那台 Windows（D:\\Work\\lystk_tool 旁）上常駐執行：

  1. 庫存代理（原 ly_stock_agent.py）
     - 掛長連線 long-poll：使用者點後台『庫存更新』→ 立刻撈凌越庫存推上雲端。
     - 每天在指定時間（預設 06:00、12:00）自動推一次。
  2. 訂單回寫（原 ly_writeback_bridge.py）
     - 每隔一段時間自動檢查雲端「待回寫訂單」→ 寫進凌越訂貨單 → 回填單號。
     - 也可用視窗上的按鈕手動「試跑 / 測一張 / 立即回寫」。

視窗會即時顯示：
  ● 雲端連線狀態、● 凌越模組狀態、● 庫存代理、● 訂單回寫
  ＋ 一塊「即時訊息記錄」（原本黑視窗的所有輸出都會顯示在這）
  ＋ 手動按鈕與「⚙ 設定」（網址／金鑰／公司別／定時／回寫間隔，存成設定檔）

設定優先序：視窗設定檔（ly_agent_config.json）> 環境變數 > 預設值。
所以第一次打開後在「⚙ 設定」填好按儲存即可，不必再改任何 .bat。

需要環境：Windows + Python（含內建 tkinter）＋ D:\\Work\\lystk_tool 內的
lystk.py / ly_order.py（跟原本兩支代理相同的依賴）。打包成 .exe 見 build_agent_exe.bat。
"""

import os
import sys
import json
import queue
import importlib.util
import threading
import datetime
import urllib.request
import urllib.error

import tkinter as tk
from tkinter import ttk

# ── 模組搜尋路徑（順序很重要）─────────────────────────────────────────
# 1) 本程式所在資料夾「最優先」：使用隨附的 ly_stock_push / ly_writeback_bridge，
#    避免被 D:\Work\lystk_tool 內可能存在的「舊版」蓋掉
#    （舊版 run() 參數不同，會造成回寫時 SimpleNamespace ... no attribute 的錯誤）。
# 2) 凌越底層模組 lystk / ly_order 只在 D:\Work\lystk_tool，放在「最後面」補進來。
def _self_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


_APP_DIR = _self_dir()
if _APP_DIR and _APP_DIR not in sys.path:
    sys.path.insert(0, _APP_DIR)

LYSTK_DIR = os.environ.get("LYSTK_DIR", r"D:\Work\lystk_tool")
if LYSTK_DIR and LYSTK_DIR not in sys.path:
    sys.path.append(LYSTK_DIR)

_LOCAL_MOD_CACHE = {}


def local_import(modname: str):
    """強制載入「與本程式同資料夾」的隨附模組（ly_stock_push / ly_writeback_bridge），
    用絕對路徑載入，避免被 D:\\Work\\lystk_tool 內的『舊版同名檔』蓋掉。
    若同資料夾沒有該檔，才退回一般 import（沿用 sys.path）。"""
    if modname in _LOCAL_MOD_CACHE:
        return _LOCAL_MOD_CACHE[modname]
    path = os.path.join(_APP_DIR, modname + ".py")
    if os.path.exists(path):
        spec = importlib.util.spec_from_file_location(modname, path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules[modname] = mod
        spec.loader.exec_module(mod)
    else:
        mod = __import__(modname)
    _LOCAL_MOD_CACHE[modname] = mod
    return mod

# 這些子模組會在載入時 import lystk / ly_order；在沒有凌越環境的機器上會失敗，
# 因此改成「用到時才載入」（lazy import），視窗照樣能開、能改設定。
APP_TITLE = "凌越整合代理"
APP_VER = "1.0"


# ======================================================================
#  設定檔（存在 exe / 腳本旁邊）
# ======================================================================

CONFIG_PATH = os.path.join(_self_dir(), "ly_agent_config.json")

DEFAULT_CONFIG = {
    "cloud_base": os.environ.get("LY_CLOUD_BASE", ""),
    "writeback_key": os.environ.get("LY_WRITEBACK_KEY", ""),
    "icpno": os.environ.get("LY_ICPNO", "all"),  # 庫存推送預設全公司（00,01,02,03）；回寫仍固定第一家=00
    "stock_times": os.environ.get("LY_STOCK_TIMES", "06:00,12:00"),
    "wb_auto": True,            # 是否掛著自動處理『上傳凌越』佇列（只寫使用者按過上傳的單）
    # 倉別規則固定為：每品項帶凌越貨品主檔預設倉(SK_RKWHNO)、查不到用固定倉別補（bridge 內建）
    "wb_mark_checked": True,      # 寫入即標「已審核」OR_CHECK=1（拋轉需要；關閉=未審核）
    "wb_create_name": os.environ.get("LY_CREATE_NAME", "052"),  # 建立人/製單人操作員代碼
    "wb_maker": os.environ.get("LY_MAKER", ""),                 # 覆寫製單人（通常留空）
    "purchase_idakd": os.environ.get("LY_PURCHASE_IDAKD", ""),  # 進銷交易永遠查銷貨(A1出)+銷退(A2入)；此為日後拿到進貨單代碼才填（空=不查進貨）
    "wb_default_whno": os.environ.get("LY_DEFAULT_WHNO", ""),
    "wb_default_price": os.environ.get("LY_DEFAULT_PRICE", ""),
    "autostart": True,          # 開啟程式就自動啟動代理
}


def load_config() -> dict:
    cfg = dict(DEFAULT_CONFIG)
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg.update(json.load(f) or {})
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f"讀取設定檔失敗（用預設值）：{e}", flush=True)
    return cfg


def save_config(cfg: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


# ======================================================================
#  回寫日誌（journal）— 防「寫入凌越成功、回報雲端失敗」→ 重複開單
# ======================================================================
# 情境：write_order 已在凌越開單，但 post_callback 因網路問題失敗；若結果只留在
# 記憶體，agent 重啟（或雲端租約到期）後同一張單會被重撿重寫＝凌越重複開單。
# 修法：每張單「寫入凌越成功」後立刻把結果落地到 exe/腳本同層的 ly_writeback_journal.json；
# callback 成功才移除。啟動時與每輪 /wait 前若 journal 有殘留 → 先重送 callback，
# 成功才繼續撿新單（雲端 callback 已做冪等：同單號重報＝成功、不同單號＝告警不覆蓋）。
# ★ journal「只記 ok:true 的成功結果」：失敗單本來就還留在雲端佇列，租約到期會自然
#   重派重試，不需要 journal 保護；若失敗也落地，flush 重送時雲端每收一次失敗就
#   lingyue_write_attempts+1，callback 回應丟失＝同一次失敗被計兩次 → 提前三振＋誤告警。
#   （write_orders 的即時 post_callback 仍送「完整批次結果」含失敗項，行為不變。）
# 檔案格式：JSON 陣列，每筆 {order_id, doc_no, ok: true, written_at}（utf-8）。
# 壞檔保護：journal 解析失敗「不可」靜默視為空（journal 是「凌越已開單但未回報雲端」
# 的唯一憑據，視為空＝保護失效）→ 改名備份為 ly_writeback_journal.corrupt.<時間>.json
# 保留現場並回 None，讓 flush_journal 當輪暫停撿新單（詳見 journal_load）。
# 鎖：用獨立的 _JOURNAL_LOCK（不能沿用 erp_lock——write_orders 已持有 erp_lock 時
# 還要 append journal，threading.Lock 不可重入會自鎖死）。

JOURNAL_PATH = os.path.join(_self_dir(), "ly_writeback_journal.json")
_JOURNAL_LOCK = threading.Lock()


def _journal_quarantine(reason: str, log=None):
    """壞檔處置：把主 journal 改名備份（保留現場給人工核對），回傳備份路徑（失敗回 None）。
    訊息用 log（GUI 記錄框）優先；沒有 log 時退回 print（pythonw/exe 下可能看不到，
    所以引擎呼叫端都要把 self.log 傳進來）。"""
    say = log or (lambda m: print(m, flush=True))
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = os.path.join(_self_dir(), f"ly_writeback_journal.corrupt.{ts}.json")
    try:
        os.replace(JOURNAL_PATH, backup)
    except Exception as e2:
        say(f"❌ 回寫日誌損毀（{reason}），且備份改名失敗：{_short(e2)}。"
            f"請人工處理 {JOURNAL_PATH}。")
        return None
    say(f"❌ 回寫日誌損毀（{reason}），已備份為 {os.path.basename(backup)} 保留現場；"
        "主日誌自下一輪起視為空、自動恢復撿單。請儘速人工核對凌越是否有未回報單據，"
        "確認後刪除備份檔。")
    return backup


def journal_load(log=None):
    """讀 journal。回傳：
    - list：正常內容（檔案不存在＝正常空，回 []）。
    - None：壞檔（JSON 解析失敗或內容不是陣列）——「不可」靜默視為空，否則
      「凌越已開單但未回報雲端」的保護就失效了。壞檔會先改名備份
      （ly_writeback_journal.corrupt.<時間>.json）保留現場；呼叫端（flush_journal）
      據 None 暫停當輪撿新單。改名後主 journal 不存在＝下一輪回 []，自動恢復。"""
    try:
        with open(JOURNAL_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return []
    except Exception as e:
        _journal_quarantine(f"JSON 解析失敗：{_short(e)}", log)
        return None
    if isinstance(data, list):
        return data
    # 內容不是陣列＝一樣視為壞檔（可能被外部程式覆寫），同樣備份保留現場
    _journal_quarantine("內容不是 JSON 陣列", log)
    return None


def _journal_write(entries: list) -> None:
    """整檔覆寫（先寫 .tmp 再原子替換，避免寫到一半斷電留下壞檔）。"""
    tmp = JOURNAL_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    os.replace(tmp, JOURNAL_PATH)


def journal_append(result: dict, log=None) -> None:
    """把一筆「寫入凌越成功」的結果落地（同 order_id 舊項先移除＝重寫時以最新結果為準）。
    只有 ok:true 的結果才該進來（見檔頭說明；失敗單靠雲端佇列租約重試，不落地）。"""
    with _JOURNAL_LOCK:
        loaded = journal_load(log)
        # 壞檔（None）：journal_load 已把壞檔改名備份，這裡以空清單重建主日誌
        entries = [e for e in (loaded or []) if e.get("order_id") != result.get("order_id")]
        entries.append(result)
        _journal_write(entries)


def journal_remove(order_ids, log=None) -> None:
    """callback 成功後移除該批。"""
    ids = set(order_ids)
    with _JOURNAL_LOCK:
        loaded = journal_load(log)
        # 壞檔（None）：已改名備份，主日誌以空清單重建即可
        entries = [e for e in (loaded or []) if e.get("order_id") not in ids]
        _journal_write(entries)


def cloud_wb_callback(base: str, key: str, results: list) -> dict:
    """直接打 /callback 回填（journal 重送用；不經 ly_writeback_bridge，
    這樣即使凌越模組載入失敗也能把已寫入的結果回報雲端）。"""
    url = base.rstrip("/") + "/admin/lingyue-writeback/callback"
    body = json.dumps({"results": results}).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/json", "X-Writeback-Key": key, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8") or "{}")


# ======================================================================
#  小工具：時間、雲端連線
# ======================================================================

def _short(e, n: int = 160) -> str:
    """把例外訊息壓成單行、限長，避免整頁 HTML 錯誤塞爆記錄框。"""
    s = " ".join(str(e).split())
    return s if len(s) <= n else s[:n] + " …"


def first_icpno(s) -> str:
    """公司代碼設定可逗號多家或 "all"（庫存推送用）；訂單回寫/單品查詢只能單一公司→取第一家，
    "all"／留空一律視為 00（松富）。"""
    for p in str(s or "").split(","):
        p = p.strip()
        if p and p.lower() != "all":
            return p
    return "00"


def now_hms() -> str:
    return datetime.datetime.now().strftime("%H:%M:%S")


def now_full() -> str:
    return datetime.datetime.now().strftime("%m/%d %H:%M:%S")


def parse_times(s: str) -> list:
    """把 "06:00,12:00" 解析成 [(6,0),(12,0)]；無法解析的略過。"""
    out = []
    for part in (s or "").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            hh, mm = part.split(":")
            h, m = int(hh), int(mm)
            if 0 <= h <= 23 and 0 <= m <= 59:
                out.append((h, m))
        except ValueError:
            pass
    return out


def next_time_label(times: list) -> str:
    """回傳今天/明天最近一個定時點，如 "12:00"（明日 06:00）。"""
    if not times:
        return "（無定時，只靠按鈕/即時）"
    now = datetime.datetime.now()
    todays = sorted(times)
    for (h, m) in todays:
        if (now.hour, now.minute) < (h, m):
            return f"{h:02d}:{m:02d}"
    h, m = todays[0]
    return f"{h:02d}:{m:02d}（明日）"


def cloud_poll_wait(base: str, key: str, timeout_sec: int = 25) -> bool:
    """掛長連線等後台『庫存更新』；回 True=有人點了。連線失敗會丟例外（供上層判斷斷線）。"""
    url = base.rstrip("/") + f"/admin/lingyue-writeback/inventory-wait?timeout={timeout_sec}"
    req = urllib.request.Request(
        url, method="GET",
        headers={"X-Writeback-Key": key, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout_sec + 15) as resp:
        res = json.loads(resp.read().decode("utf-8") or "{}")
    return bool(res.get("refresh"))


def cloud_wait_orders(base: str, key: str, timeout_sec: int = 25) -> list:
    """長連線等『上傳凌越』佇列（/wait）。只回使用者在網站按過『上傳凌越』、
    尚未回寫的訂單；沒有就 hold 到 timeout 才回空。連線失敗會丟例外。"""
    url = base.rstrip("/") + f"/admin/lingyue-writeback/wait?timeout={timeout_sec}"
    req = urllib.request.Request(
        url, method="GET",
        headers={"X-Writeback-Key": key, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout_sec + 15) as resp:
        res = json.loads(resp.read().decode("utf-8") or "{}")
    return res.get("orders", []) or []


def cloud_txn_wait(base: str, key: str, timeout_sec: int = 25) -> list:
    """長連線等『庫存頁點品項要查進銷存』的請求；回 [{code,icpno},...]。"""
    url = base.rstrip("/") + f"/admin/lingyue-writeback/txn-wait?timeout={timeout_sec}"
    req = urllib.request.Request(
        url, method="GET",
        headers={"X-Writeback-Key": key, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout_sec + 15) as resp:
        res = json.loads(resp.read().decode("utf-8") or "{}")
    return res.get("codes", []) or []


def cloud_txn_callback(base: str, key: str, results: list) -> dict:
    url = base.rstrip("/") + "/admin/lingyue-writeback/txn-callback"
    body = json.dumps({"results": results}).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/json", "X-Writeback-Key": key, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8") or "{}")


def cloud_test(base: str, key: str, timeout: int = 8) -> tuple:
    """一次性連線測試。回 (ok, 訊息)。用『待回寫訂單 pending』當探針，因為
    即使後台是舊版、沒有庫存端點，pending 仍在 → 可分辨『網址/金鑰對不對』與
    『只是缺庫存端點』。"""
    base = (base or "").strip()
    key = (key or "").strip()
    if not base:
        return False, "尚未填入雲端後台網址。"
    if not key:
        return False, "尚未填入回寫金鑰。"
    today = datetime.date.today().strftime("%Y-%m-%d")
    url = base.rstrip("/") + f"/admin/lingyue-writeback/pending?date={today}"
    req = urllib.request.Request(
        url, method="GET",
        headers={"X-Writeback-Key": key, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            res = json.loads(resp.read().decode("utf-8") or "{}")
        cnt = res.get("count", len(res.get("orders", []) or []))
        return True, f"✅ 連線成功、金鑰正確。今日待回寫訂單 {cnt} 張。"
    except urllib.error.HTTPError as e:
        hint = {
            401: "金鑰不正確（與後台 LINGYUE_WRITEBACK_KEY 不符）。",
            403: "被拒絕（金鑰或權限問題）。",
            404: "找不到端點：網址填錯，或後台版本過舊。",
            503: "後台尚未設定 LINGYUE_WRITEBACK_KEY 環境變數。",
        }.get(e.code, "")
        return False, f"❌ HTTP {e.code} {e.reason}。{hint}\n{url}"
    except urllib.error.URLError as e:
        return False, (f"❌ 連不到伺服器：{_short(getattr(e, 'reason', e), 80)}。\n"
                       f"確認網址正確、且此機能連到外網。\n{url}")
    except Exception as e:
        return False, f"❌ 測試失敗：{_short(e)}\n{url}"


# ======================================================================
#  把所有 print 導進視窗記錄框（原本兩支代理的輸出都會顯示出來）
# ======================================================================

class QueueWriter:
    """代替 sys.stdout / sys.stderr，把文字丟進 queue 給主執行緒顯示。"""

    def __init__(self, q: "queue.Queue"):
        self.q = q
        self._buf = ""

    def write(self, s: str):
        if not s:
            return
        # 逐行送出，讓記錄框每行都帶時間戳（在主執行緒補）
        self._buf += s
        while "\n" in self._buf:
            line, self._buf = self._buf.split("\n", 1)
            self.q.put(line)

    def flush(self):
        if self._buf:
            self.q.put(self._buf)
            self._buf = ""


# ======================================================================
#  代理引擎：兩個背景執行緒（庫存 long-poll、訂單回寫）
# ======================================================================

class AgentEngine:
    """負責背景兩件事，並把狀態寫進 self.state 供 UI 顯示。"""

    def __init__(self, cfg: dict, state: dict, log):
        self.cfg = cfg
        self.state = state
        self.log = log                    # log(msg) → 記錄框
        self.stop_event = threading.Event()
        self.erp_lock = threading.Lock()  # 序列化所有「碰凌越」的操作
        self._threads = []
        self._realtime_off = False        # 後台若無 inventory-wait 端點，改定時模式

    # ── 記錄去重：同一則訊息只印一次，狀態改變再印 ──────────────
    def _log_once(self, tag: str, msg):
        skey = f"_once_{tag}"
        if msg is None:
            self.state[skey] = None
            return
        if self.state.get(skey) != msg:
            self.log(msg)
            self.state[skey] = msg

    def _scheduled_stock_push(self, pushed: set):
        """到達每日定時點就自動推（每個時間點每天只推一次）。"""
        now = datetime.datetime.now()
        today = now.date().isoformat()
        for (h, m) in parse_times(self.cfg["stock_times"]):
            slot = (today, h, m)
            if slot in pushed:
                continue
            if (now.hour, now.minute) >= (h, m):
                self.do_stock_push(reason=f"定時 {h:02d}:{m:02d}")
                pushed.add(slot)
        if len(pushed) > 8:
            leftover = {k for k in pushed if k[0] == today}
            pushed.clear()
            pushed.update(leftover)

    # ── 生命週期 ───────────────────────────────────────────────
    def start(self):
        self.stop_event.clear()
        self.state["stock_running"] = True
        self.state["wb_running"] = bool(self.cfg.get("wb_auto"))
        self._threads = [
            threading.Thread(target=self._stock_loop, name="stock", daemon=True),
            threading.Thread(target=self._writeback_loop, name="writeback", daemon=True),
            threading.Thread(target=self._txn_loop, name="txn", daemon=True),
        ]
        for t in self._threads:
            t.start()
        self.log("▶ 代理已啟動")

    def stop(self):
        self.stop_event.set()
        self.state["stock_running"] = False
        self.state["wb_running"] = False
        self.log("■ 代理已停止（背景連線會在下個週期收掉）")

    # ── 碰凌越的實際動作（都要拿 erp_lock）─────────────────────
    def do_stock_push(self, reason: str = ""):
        base, key, icpno = self.cfg["cloud_base"], self.cfg["writeback_key"], self.cfg["icpno"]
        if not base or not key:
            self.log("⚠ 尚未設定網址/金鑰，無法推庫存（請按⚙設定）")
            return
        try:
            ly_stock_push = local_import("ly_stock_push")  # 強制用隨附版本
        except Exception as e:
            self.state["erp"] = "missing"
            self.log(f"⚠ 載入凌越庫存模組失敗（此機無凌越環境？）：{_short(e)}")
            return
        with self.erp_lock:
            tag = f"（{reason}）" if reason else ""
            self.log(f"🔄 撈凌越庫存並推送{tag} …")
            try:
                n = ly_stock_push.push_once(base, key, icpno)
                self.state["erp"] = "ok"
                self.state["stock_last_push"] = f"{now_full()}（{n} 品項）"
                self._log_once("stockpush", None)
            except Exception as e:
                self._log_once(
                    "stockpush",
                    f"❌ 推庫存失敗（後台 inventory-push）：{_short(e)}"
                    "；可能後台版本較舊或該端點異常，需更新後台版本。",
                )

    def write_orders(self, orders: list, *, dry_run: bool = False):
        """只寫「傳入的這批訂單」（來自 /wait 佇列＝使用者在網站按過『上傳凌越』的單）。
        絕不主動去撈 /pending 全部訂單。dry_run=只印不寫。
        欄位對映一律用 ly_writeback_bridge.map_order（唯一權威，含拋轉必備欄位）。"""
        base, key = self.cfg["cloud_base"], self.cfg["writeback_key"]
        icpno = first_icpno(self.cfg["icpno"])  # 回寫只寫第一家（多家設定僅庫存推送使用）
        try:
            wb = local_import("ly_writeback_bridge")  # 用隨附版本；提供 map_order/post_callback/ly_order
        except Exception as e:
            self.state["erp"] = "missing"
            self.log(f"⚠ 載入凌越回寫模組失敗（此機無凌越環境？）：{_short(e)}")
            return
        whno = self.cfg.get("wb_default_whno", "")
        price = self.cfg.get("wb_default_price", "")
        or_check = "1" if bool(self.cfg.get("wb_mark_checked", True)) else "0"
        create_name = (self.cfg.get("wb_create_name") or "052").strip()
        maker = (self.cfg.get("wb_maker") or "").strip()
        results = []
        ok = 0
        with self.erp_lock:
            for o in orders:
                name = o.get("customer_name") or o.get("customer_code") or "?"
                row = wb.map_order(o, icpno=icpno, whno=whno, price=price,
                                   create_name=create_name, check=or_check, maker=maker)
                # 提醒：哪些品項連凌越預設倉別都查不到、又沒有固定倉別可補 → 倉別會留空
                miss = [(d.get("OD_NAME") or d.get("OD_SKNO")) for d in row.get("details", [])
                        if not (d.get("OD_WARE") or "").strip()]
                if miss:
                    tail = " …" if len(miss) > 6 else ""
                    self.log(f"  ⚠ {name}：這些品項凌越查不到預設倉別、倉別留空：{'、'.join(miss[:6])}{tail}")
                if dry_run:
                    self.log(f"  [試跑] {name}：{len(row.get('details', []))} 個品項（不寫入）")
                    continue
                try:
                    # 撞號防護的權威層在 ly_writeback_bridge.py（載入時已把 write_order
                    # 包成「每次呼叫前重置當日流水快取」，換 .py 即生效、不必重打包 exe）。
                    # 這裡的重置保留當雙保險（例如 exe 同層放的是舊版 bridge 時仍有防護）。
                    try:
                        wb.ly_order._seq_date = None
                    except Exception:
                        pass
                    nos = wb.ly_order.write_order(icpno=icpno, rows=[row], verbose=False)
                    no = nos[0]
                    result = {"order_id": o.get("order_id"), "doc_no": no, "ok": True,
                              "written_at": datetime.datetime.now().isoformat(timespec="seconds")}
                    ok += 1
                    self.log(f"  ✅ {name} → 凌越單號 {no}")
                except Exception as e:
                    result = {"order_id": o.get("order_id"), "ok": False, "error": _short(e),
                              "written_at": datetime.datetime.now().isoformat(timespec="seconds")}
                    self.log(f"  ❌ {name} 寫入失敗：{_short(e)}")
                results.append(result)
                # 每寫完一張「成功單」就把結果落地 journal（在打 callback 前）：中途斷電/
                # 當機也不會遺失「凌越已開單」的事實，重啟後先重送、不重寫。
                # 失敗單「不」落地：本來就還留在雲端佇列、租約到期自然重派重試；若也落地，
                # flush 重送時雲端每收一次失敗就 attempts+1，callback 回應丟失＝同一次失敗
                # 被計兩次 → 提前三振＋誤告警（即時 post_callback 仍送完整批次結果，見下方）。
                if result.get("ok"):
                    try:
                        journal_append(result, log=self.log)
                    except Exception as je:
                        self.log(f"  ⚠ 回寫日誌落地失敗（{JOURNAL_PATH}）：{_short(je)}")
            self.state["erp"] = "ok"
        if dry_run:
            self.log(f"（試跑完畢：{len(orders)} 張，未寫入任何資料）")
            return
        if results:
            try:
                # 即時回填一律送「完整批次結果」（含失敗項，雲端才會累計 attempts／告警）
                cb = wb.post_callback(base, key, results)
                self.log(f"▶ 回填後台：updated={cb.get('updated_count')} failed={cb.get('failed_count')}")
                # 回填成功 → 清掉這批的 journal（journal 只有成功項；失敗項本來就不在裡面）；
                # 失敗則保留，由啟動時/每輪 /wait 前重送。
                try:
                    journal_remove([r.get("order_id") for r in results], log=self.log)
                except Exception as je:
                    self.log(f"⚠ 清除回寫日誌失敗（不影響資料，重送時雲端會冪等處理）：{_short(je)}")
            except Exception as e:
                self.log(f"⚠ 回填後台失敗（成功單已存回寫日誌、會自動重送；"
                         f"失敗單留在雲端佇列待重試）：{_short(e)}")
            self.state["wb_last"] = now_full()
            self.state["wb_last_result"] = f"寫入 {ok}/{len(orders)}"

    def flush_journal(self) -> bool:
        """重送回寫日誌殘留（上次「寫入凌越成功但回報雲端失敗」的結果；journal 只存成功項）。
        回 True＝journal 已空（或本來就空、或試跑無關）；False＝仍有殘留或日誌損毀
        （本輪不要撿新單，否則雲端租約到期重派同單＝重複開單）。雲端 callback 已冪等，重送安全。"""
        entries = journal_load(self.log)
        if entries is None:
            # 壞檔：journal_load 已把壞檔改名備份（.corrupt.<時間>.json）並記錄詳細指引。
            # 本輪回 False 暫停撿新單；改名後主 journal 不存在＝下一輪 journal_load 回 []、
            # 自動恢復撿單（「暫停」只發生在損毀當輪）。
            self.log("⚠ 回寫日誌損毀，本輪暫停撿新單；備份已保留、系統下一輪起自動恢復撿單，"
                     "請儘速依上面訊息人工核對後刪除 .corrupt 備份檔。")
            return False
        if not entries:
            return True
        base, key = self.cfg["cloud_base"], self.cfg["writeback_key"]
        if not base or not key:
            return False
        payload = [{k: e.get(k) for k in ("order_id", "doc_no", "ok", "error") if e.get(k) is not None}
                   for e in entries]
        try:
            cb = cloud_wb_callback(base, key, payload)
            journal_remove([e.get("order_id") for e in entries], log=self.log)
            self._log_once("journal", None)
            self.log(f"▶ 重送回寫日誌 {len(entries)} 筆成功："
                     f"updated={cb.get('updated_count')} failed={cb.get('failed_count')}")
            return True
        except Exception as e:
            self._log_once("journal", f"⚠ 重送回寫日誌失敗（{len(entries)} 筆待重送，先不撿新單）：{_short(e)}")
            return False

    def check_queue(self, *, dry_run: bool = False):
        """手動：立刻查一次『上傳凌越』佇列（/wait），有排隊的就寫入（或試跑）。"""
        base, key = self.cfg["cloud_base"], self.cfg["writeback_key"]
        if not base or not key:
            self.log("⚠ 尚未設定網址/金鑰（請按⚙設定）")
            return
        # 先清回寫日誌殘留，避免撿到雲端因租約到期重派的「其實已寫入」的單
        if not self.flush_journal():
            self.log("⚠ 回寫日誌尚有殘留且重送失敗，暫停撿新單（避免重複開單）。")
            return
        try:
            orders = cloud_wait_orders(base, key, timeout_sec=3)
            self.state["wb_last_check"] = now_full()
        except Exception as e:
            self.log(f"⚠ 查詢上傳佇列失敗：{_short(e)}")
            return
        if not orders:
            self.log("上傳佇列目前沒有訂單（請先在網站點『上傳凌越』把要上傳的單排進來）。")
            return
        self.log(f"📝 上傳佇列有 {len(orders)} 張，{'試跑' if dry_run else '開始寫入凌越'} …")
        self.write_orders(orders, dry_run=dry_run)

    # ── 背景迴圈：庫存 long-poll ＋ 定時推送 ────────────────────
    def _stock_loop(self):
        base, key = self.cfg["cloud_base"], self.cfg["writeback_key"]
        # 啟動時把「今天已過的定時點」標記為已完成，避免一啟動就補推（啟動已推一次）
        pushed = set()
        now = datetime.datetime.now()
        today = now.date().isoformat()
        for (h, m) in parse_times(self.cfg["stock_times"]):
            if (now.hour, now.minute) >= (h, m):
                pushed.add((today, h, m))

        # 啟動先推一次，讓後台立刻有最新庫存
        if base and key:
            self.do_stock_push(reason="啟動推送")

        while not self.stop_event.is_set():
            base, key = self.cfg["cloud_base"], self.cfg["writeback_key"]
            if not base or not key:
                self.state["cloud"] = "unknown"
                self.stop_event.wait(3)
                continue

            self.state["stock_next"] = next_time_label(parse_times(self.cfg["stock_times"]))

            # 後台若沒有『即時刷新』端點（舊版），不再長輪詢，改定時模式即可
            if self._realtime_off:
                self._scheduled_stock_push(pushed)
                self.stop_event.wait(30)
                continue

            try:
                got = cloud_poll_wait(base, key, 25)
                self.state["cloud"] = "ok"
                self.state["cloud_last"] = now_full()
                self._log_once("cloud", None)
                if got:
                    self.do_stock_push(reason="按鈕觸發")
                self._scheduled_stock_push(pushed)
            except urllib.error.HTTPError as e:
                # 伺服器有回應＝連得到；只是這支端點/金鑰的問題
                if e.code == 404:
                    self.state["cloud"] = "ok"
                    self._realtime_off = True
                    self.log("ℹ 後台沒有『庫存即時刷新』端點（inventory-wait 404）——多半是雲端後台"
                             "版本較舊。已改為『定時推送』模式；要即時刷新請更新後台版本。")
                elif e.code == 401:
                    self.state["cloud"] = "down"
                    self._log_once("cloud", "⚠ 金鑰不正確（與後台 LINGYUE_WRITEBACK_KEY 不符），請按⚙設定修正。")
                    self.stop_event.wait(20)
                elif e.code == 503:
                    self.state["cloud"] = "ok"
                    self._log_once("cloud", "⚠ 後台尚未設定 LINGYUE_WRITEBACK_KEY 環境變數（端點停用）。")
                    self.stop_event.wait(20)
                else:
                    self.state["cloud"] = "ok"
                    self._log_once("cloud", f"⚠ 雲端回應 HTTP {e.code} {e.reason}；5 秒後重試。")
                    self.stop_event.wait(5)
            except urllib.error.URLError as e:
                self.state["cloud"] = "down"
                self._log_once("cloud", f"⚠ 連不到伺服器（{_short(getattr(e, 'reason', e), 80)}）；"
                                        "請確認網址正確、此機能連外網。")
                self.stop_event.wait(5)
            except Exception as e:
                self._log_once("cloud", f"⚠ 庫存迴圈錯誤：{_short(e)}；5 秒後重試。")
                self.stop_event.wait(5)

    # ── 背景迴圈：訂單回寫（長連線等『上傳凌越』佇列 /wait）──────
    #   只有使用者在網站點過『上傳凌越』的單才會進佇列、才會被寫入。
    #   絕不主動撈 /pending 全部訂單（那正是先前誤寫一整天訂單的原因）。
    def _writeback_loop(self):
        self.stop_event.wait(8)  # 啟動後稍等，避開和庫存啟動推送同時打凌越
        # 啟動檢查：上次執行若「寫入凌越成功但回報失敗」，journal 會有殘留 → 優先重送。
        # journal_load 回 None＝壞檔（已改名備份並記錄指引），這裡不另做事——
        # 備份後主 journal 為空，迴圈會正常撿單。
        try:
            residue = journal_load(self.log)
            if residue:
                self.log(f"ℹ 偵測到回寫日誌殘留 {len(residue)} 筆（上次回報雲端失敗），將優先重送再撿新單。")
        except Exception:
            pass
        while not self.stop_event.is_set():
            if not self.cfg.get("wb_auto"):
                self.state["wb_running"] = False
                self.stop_event.wait(5)
                continue
            self.state["wb_running"] = True
            base, key = self.cfg["cloud_base"], self.cfg["writeback_key"]
            if not base or not key:
                self.stop_event.wait(5)
                continue
            # 每輪 /wait 前：journal 有殘留就先重送 callback，成功才繼續撿新單
            # （否則雲端租約到期會把「其實已寫入凌越」的單重派下來＝重複開單）。
            if not self.flush_journal():
                self.stop_event.wait(10)
                continue
            try:
                orders = cloud_wait_orders(base, key, 25)
                self.state["wb_last_check"] = now_full()
                self._log_once("wbwait", None)
                if orders:
                    self.log(f"📝 收到 {len(orders)} 張『上傳凌越』佇列訂單，寫入中 …")
                    self.write_orders(orders)
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    self._log_once("wbwait", "ℹ 後台沒有『上傳佇列』端點（/wait 404）——後台版本較舊；"
                                             "訂單回寫需更新後台版本，目前不會自動寫入。")
                    self.stop_event.wait(30)
                elif e.code in (401, 503):
                    self._log_once("wbwait", f"⚠ 上傳佇列端點 HTTP {e.code}（金鑰或後台設定問題）。")
                    self.stop_event.wait(20)
                else:
                    self._log_once("wbwait", f"⚠ 上傳佇列端點 HTTP {e.code} {e.reason}；重試中。")
                    self.stop_event.wait(10)
            except urllib.error.URLError as e:
                self._log_once("wbwait", f"⚠ 上傳佇列連線問題：{_short(getattr(e, 'reason', e), 80)}")
                self.stop_event.wait(5)
            except Exception as e:
                self._log_once("wbwait", f"⚠ 上傳佇列迴圈錯誤：{_short(e)}")
                self.stop_event.wait(5)

    # ── 背景迴圈：庫存頁點品項 → 查凌越進銷存（長連線 txn-wait）──────
    def _txn_loop(self):
        self.stop_event.wait(10)
        while not self.stop_event.is_set():
            base, key = self.cfg["cloud_base"], self.cfg["writeback_key"]
            icpno = first_icpno(self.cfg["icpno"])  # 單品查詢預設用第一家（雲端請求本身可帶 icpno）
            if not base or not key:
                self.stop_event.wait(5)
                continue
            try:
                reqs = cloud_txn_wait(base, key, 25)
                self._log_once("txnwait", None)
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    self._log_once("txnwait", "ℹ 後台沒有『進銷存查詢』端點（txn-wait 404）——"
                                              "此功能需後台更新到最新版才有。")
                    self.stop_event.wait(30)
                else:
                    self._log_once("txnwait", f"⚠ 進銷存佇列端點 HTTP {e.code}；重試中。")
                    self.stop_event.wait(10)
                continue
            except urllib.error.URLError as e:
                self._log_once("txnwait", f"⚠ 進銷存佇列連線問題：{_short(getattr(e, 'reason', e), 80)}")
                self.stop_event.wait(5)
                continue
            except Exception as e:
                self._log_once("txnwait", f"⚠ 進銷存佇列迴圈錯誤：{_short(e)}")
                self.stop_event.wait(5)
                continue

            if not reqs:
                continue
            try:
                itx = local_import("ly_item_txn")
            except Exception as e:
                self.state["erp"] = "missing"
                self._log_once("txnerp", f"⚠ 載入進銷紀錄模組失敗：{_short(e)}")
                continue
            pkind = (self.cfg.get("purchase_idakd") or "").strip()
            results = []
            with self.erp_lock:
                for c in reqs:
                    code = (c.get("code") or "").strip()
                    cicp = (c.get("icpno") or icpno or "00").strip()
                    if not code:
                        continue
                    try:
                        data = itx.fetch_item_records(cicp, code, limit=60, purchase_idakd=pkind)
                        results.append({"code": code, "icpno": cicp, "data": data})
                        self.log(f"🔎 進銷紀錄 {code} → {data.get('count', 0)} 筆"
                                 + (f"（{data['note']}）" if data.get("note") else ""))
                    except Exception as e:
                        results.append({"code": code, "icpno": cicp, "error": _short(e)})
                        self.log(f"❌ 進銷紀錄查詢 {code} 失敗：{_short(e)}")
                self.state["erp"] = "ok"
            try:
                cloud_txn_callback(base, key, results)
            except Exception as e:
                self.log(f"⚠ 進銷存回填失敗：{_short(e)}")


# ======================================================================
#  視窗（深色現代風；模組化卡片方便日後加功能）
# ======================================================================

# 配色
BG = "#1b1d2a"
PANEL = "#252838"
PANEL2 = "#2d3145"
FG = "#e6e6e6"
MUTED = "#9aa0b4"
GREEN = "#3fb950"
RED = "#f85149"
AMBER = "#d29922"
BLUE = "#58a6ff"
GREY = "#6b7280"

DOT_COLOR = {"ok": GREEN, "down": RED, "missing": AMBER, "unknown": GREY,
             True: GREEN, False: GREY}


class StatusCard(tk.Frame):
    """一張狀態卡：● 標題 + 兩行說明。日後要加新模組，複製一張即可。"""

    def __init__(self, master, title):
        super().__init__(master, bg=PANEL, padx=14, pady=12,
                         highlightbackground=PANEL2, highlightthickness=1)
        top = tk.Frame(self, bg=PANEL)
        top.pack(anchor="w", fill="x")
        self.dot = tk.Label(top, text="●", fg=GREY, bg=PANEL, font=("Segoe UI", 13))
        self.dot.pack(side="left")
        tk.Label(top, text=title, fg=FG, bg=PANEL,
                 font=("Microsoft JhengHei UI", 12, "bold")).pack(side="left", padx=(6, 0))
        self.line1 = tk.Label(self, text="—", fg=MUTED, bg=PANEL,
                              font=("Microsoft JhengHei UI", 10), anchor="w", justify="left")
        self.line1.pack(anchor="w", pady=(8, 0), fill="x")
        self.line2 = tk.Label(self, text="", fg=MUTED, bg=PANEL,
                              font=("Microsoft JhengHei UI", 10), anchor="w", justify="left")
        self.line2.pack(anchor="w", fill="x")

    def set(self, color_key, line1="", line2=""):
        self.dot.config(fg=DOT_COLOR.get(color_key, GREY))
        self.line1.config(text=line1)
        self.line2.config(text=line2)


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.cfg = load_config()
        self.state_data = {
            "cloud": "unknown", "cloud_last": "—",
            "erp": "unknown",
            "stock_running": False, "stock_last_push": "—", "stock_next": "—",
            "wb_running": False, "wb_last": "—", "wb_last_result": "—", "wb_last_check": "—",
        }
        self.log_queue: "queue.Queue" = queue.Queue()
        self.engine = AgentEngine(self.cfg, self.state_data, self.log)

        # 把所有 print 導進記錄框
        sys.stdout = QueueWriter(self.log_queue)
        sys.stderr = QueueWriter(self.log_queue)

        self._build_ui()
        self._pump()  # 開始輪詢 queue + 刷新狀態

        # 判斷凌越模組能不能載入（只影響顯示；動作時仍會再試）
        self._probe_erp()

        if self.cfg.get("autostart") and self.cfg.get("cloud_base") and self.cfg.get("writeback_key"):
            self.start_engine()
        else:
            self.log("尚未啟動。請先按「⚙ 設定」填好網址與金鑰，再按「啟動代理」。")

    # ── 版面 ───────────────────────────────────────────────────
    def _build_ui(self):
        self.title(f"{APP_TITLE}  v{APP_VER}")
        self.geometry("860x620")
        self.minsize(760, 560)
        self.configure(bg=BG)

        # 頂部標題列
        header = tk.Frame(self, bg=BG)
        header.pack(fill="x", padx=18, pady=(16, 8))
        tk.Label(header, text="凌越整合代理", fg=FG, bg=BG,
                 font=("Microsoft JhengHei UI", 18, "bold")).pack(side="left")
        tk.Label(header, text="庫存即時推送 ＋ 訂單自動回寫", fg=MUTED, bg=BG,
                 font=("Microsoft JhengHei UI", 10)).pack(side="left", padx=(12, 0), pady=(8, 0))

        self.btn_toggle = tk.Button(header, text="啟動代理", command=self.toggle_engine,
                                    bg=GREEN, fg="white", relief="flat", padx=16, pady=6,
                                    font=("Microsoft JhengHei UI", 10, "bold"),
                                    activebackground="#2ea043", cursor="hand2")
        self.btn_toggle.pack(side="right")
        tk.Button(header, text="⚙ 設定", command=self.open_settings,
                  bg=PANEL2, fg=FG, relief="flat", padx=14, pady=6,
                  font=("Microsoft JhengHei UI", 10), activebackground=GREY,
                  cursor="hand2").pack(side="right", padx=(0, 10))

        # 狀態卡片區（2×2）
        cards = tk.Frame(self, bg=BG)
        cards.pack(fill="x", padx=18)
        for i in range(2):
            cards.columnconfigure(i, weight=1, uniform="c")
        self.card_cloud = StatusCard(cards, "雲端連線")
        self.card_erp = StatusCard(cards, "凌越模組")
        self.card_stock = StatusCard(cards, "庫存代理")
        self.card_wb = StatusCard(cards, "訂單回寫")
        self.card_cloud.grid(row=0, column=0, sticky="nsew", padx=(0, 6), pady=6)
        self.card_erp.grid(row=0, column=1, sticky="nsew", padx=(6, 0), pady=6)
        self.card_stock.grid(row=1, column=0, sticky="nsew", padx=(0, 6), pady=6)
        self.card_wb.grid(row=1, column=1, sticky="nsew", padx=(6, 0), pady=6)

        # 手動操作列
        ops = tk.Frame(self, bg=BG)
        ops.pack(fill="x", padx=18, pady=(8, 4))
        tk.Label(ops, text="手動操作：", fg=MUTED, bg=BG,
                 font=("Microsoft JhengHei UI", 10)).pack(side="left")

        def opbtn(text, cmd, color=PANEL2):
            b = tk.Button(ops, text=text, command=cmd, bg=color, fg=FG, relief="flat",
                          padx=12, pady=5, font=("Microsoft JhengHei UI", 9),
                          activebackground=GREY, cursor="hand2")
            b.pack(side="left", padx=4)
            return b

        opbtn("測試連線", self.test_connection, GREEN)
        opbtn("立即推庫存", lambda: self._async(self.engine.do_stock_push, reason="手動"), BLUE)
        opbtn("檢查上傳佇列(試跑)", lambda: self._async(self.engine.check_queue, dry_run=True))
        opbtn("立即處理上傳佇列", lambda: self._async(self.engine.check_queue), AMBER)

        # 記錄框
        logwrap = tk.Frame(self, bg=BG)
        logwrap.pack(fill="both", expand=True, padx=18, pady=(6, 14))
        tk.Label(logwrap, text="即時訊息記錄", fg=MUTED, bg=BG,
                 font=("Microsoft JhengHei UI", 10)).pack(anchor="w")
        txtframe = tk.Frame(logwrap, bg=PANEL2, highlightbackground=PANEL2, highlightthickness=1)
        txtframe.pack(fill="both", expand=True, pady=(4, 0))
        self.log_text = tk.Text(txtframe, bg="#14151f", fg="#c8d0e0", relief="flat",
                                font=("Consolas", 10), wrap="word", padx=10, pady=8,
                                insertbackground=FG, state="disabled")
        sb = tk.Scrollbar(txtframe, command=self.log_text.yview)
        self.log_text.config(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        self.log_text.pack(side="left", fill="both", expand=True)

    # ── 記錄 ────────────────────────────────────────────────────
    def log(self, msg: str):
        self.log_queue.put(f"[{now_hms()}] {msg}")

    def _append_log(self, line: str):
        self.log_text.config(state="normal")
        self.log_text.insert("end", line + "\n")
        # 限制行數避免無限成長
        if int(self.log_text.index("end-1c").split(".")[0]) > 800:
            self.log_text.delete("1.0", "200.0")
        self.log_text.see("end")
        self.log_text.config(state="disabled")

    # ── 主執行緒輪詢：把 queue 內容顯示出來 + 刷新狀態卡 ────────
    def _pump(self):
        try:
            while True:
                self._append_log(self.log_queue.get_nowait())
        except queue.Empty:
            pass
        self._refresh_status()
        self.after(300, self._pump)

    def _refresh_status(self):
        s = self.state_data
        self.card_cloud.set(
            s["cloud"],
            {"ok": "已連線", "down": "連線中斷（重試中）", "unknown": "未連線"}.get(s["cloud"], "未連線"),
            f"最後連上：{s['cloud_last']}",
        )
        realtime_off = getattr(self.engine, "_realtime_off", False)
        self.card_erp.set(
            s["erp"],
            {"ok": "凌越模組已載入", "missing": "凌越模組未載入", "unknown": "尚未使用"}.get(s["erp"], ""),
            "" if s["erp"] == "ok" else "（需在 D:\\Work\\lystk_tool 那台電腦執行）" if s["erp"] == "missing" else "",
        )
        if not s["stock_running"]:
            stock_l1 = "已停止"
        elif realtime_off:
            stock_l1 = "運作中（定時模式；後台無即時端點）"
        else:
            stock_l1 = "運作中（長連線即時）"
        self.card_stock.set(
            s["stock_running"],
            stock_l1,
            f"最後推送：{s['stock_last_push']}   下次定時：{s['stock_next']}",
        )
        self.card_wb.set(
            s["wb_running"],
            "等候『上傳凌越』佇列（只寫你按過上傳的單）" if s["wb_running"] else "自動處理：關閉",
            f"最後回寫：{s['wb_last']} {s['wb_last_result']}",
        )

    # ── 啟停 ────────────────────────────────────────────────────
    def toggle_engine(self):
        if self.state_data["stock_running"] or self.state_data["wb_running"]:
            self.stop_engine()
        else:
            self.start_engine()

    def start_engine(self):
        if not self.cfg.get("cloud_base") or not self.cfg.get("writeback_key"):
            self.log("⚠ 請先在「⚙ 設定」填好網址與金鑰。")
            self.open_settings()
            return
        self.engine.start()
        self.btn_toggle.config(text="停止代理", bg=RED, activebackground="#c9302c")

    def stop_engine(self):
        self.engine.stop()
        self.btn_toggle.config(text="啟動代理", bg=GREEN, activebackground="#2ea043")

    # ── 手動動作：丟到背景執行緒，避免卡住視窗 ──────────────────
    def _async(self, fn, **kw):
        threading.Thread(target=fn, kwargs=kw, daemon=True).start()

    def test_connection(self):
        self.log("🔌 測試雲端連線中 …")

        def worker():
            ok, msg = cloud_test(self.cfg.get("cloud_base"), self.cfg.get("writeback_key"))
            self.state_data["cloud"] = "ok" if ok else "down"
            if ok:
                self.state_data["cloud_last"] = now_full()
            for line in msg.splitlines():
                self.log(("　　" + line) if line.startswith(("http", "https")) else line)
        threading.Thread(target=worker, daemon=True).start()

    def _probe_erp(self):
        def worker():
            try:
                local_import("ly_stock_push")
                local_import("ly_writeback_bridge")
                self.state_data["erp"] = "ok"
            except Exception:
                self.state_data["erp"] = "missing"
        threading.Thread(target=worker, daemon=True).start()

    # ── 設定視窗 ────────────────────────────────────────────────
    def open_settings(self):
        SettingsDialog(self, self.cfg, on_save=self._on_settings_saved)

    def _on_settings_saved(self, new_cfg: dict):
        self.cfg.update(new_cfg)
        save_config(self.cfg)
        self.engine.cfg = self.cfg
        self.log("✅ 設定已儲存。")
        # 若已在跑，下一個迴圈會自動採用新設定；未跑則可手動啟動
        self._refresh_status()


class SettingsDialog(tk.Toplevel):
    def __init__(self, master, cfg: dict, on_save):
        super().__init__(master)
        self.on_save = on_save
        self.title("設定")
        self.configure(bg=BG)
        self.geometry("580x680")
        self.transient(master)
        self.grab_set()

        self.vars = {}
        pad = {"padx": 16, "pady": 4}

        def row(label, key, hint="", show=None):
            tk.Label(self, text=label, fg=FG, bg=BG, anchor="w",
                     font=("Microsoft JhengHei UI", 10, "bold")).pack(fill="x", **pad)
            v = tk.StringVar(value=str(cfg.get(key, "")))
            e = tk.Entry(self, textvariable=v, bg=PANEL2, fg=FG, relief="flat",
                         insertbackground=FG, font=("Consolas", 10), show=show)
            e.pack(fill="x", padx=16)
            if hint:
                tk.Label(self, text=hint, fg=MUTED, bg=BG, anchor="w",
                         font=("Microsoft JhengHei UI", 8)).pack(fill="x", padx=16, pady=(0, 2))
            self.vars[key] = v
            return e

        tk.Label(self, text="連線設定", fg=BLUE, bg=BG, anchor="w",
                 font=("Microsoft JhengHei UI", 12, "bold")).pack(fill="x", padx=16, pady=(14, 2))
        row("雲端後台網址 (LY_CLOUD_BASE)", "cloud_base", "例：https://xxxx.run.app")
        key_entry = row("回寫金鑰 (LINGYUE_WRITEBACK_KEY)", "writeback_key",
                        "與後台環境變數相同那把", show="*")
        show_var = tk.BooleanVar(value=False)
        tk.Checkbutton(self, text="顯示金鑰", variable=show_var, bg=BG, fg=MUTED,
                       selectcolor=PANEL, activebackground=BG, activeforeground=FG,
                       command=lambda: key_entry.config(show="" if show_var.get() else "*"),
                       font=("Microsoft JhengHei UI", 8)).pack(anchor="w", padx=16)
        row("公司代碼 (LY_ICPNO)", "icpno", "00松富/01龍港/02松揚/03松成；庫存推送填 all＝全推（各公司分開存），回寫固定用第一家(00)")

        tk.Label(self, text="庫存代理", fg=BLUE, bg=BG, anchor="w",
                 font=("Microsoft JhengHei UI", 12, "bold")).pack(fill="x", padx=16, pady=(12, 2))
        row("每日定時推送 (LY_STOCK_TIMES)", "stock_times",
            "24小時制、逗號分隔，如 06:00,12:00；清空＝只靠按鈕/即時")

        tk.Label(self, text="訂單回寫（只寫你在網站按過『上傳凌越』的單）", fg=BLUE, bg=BG, anchor="w",
                 font=("Microsoft JhengHei UI", 12, "bold")).pack(fill="x", padx=16, pady=(12, 2))
        auto_var = tk.BooleanVar(value=bool(cfg.get("wb_auto", True)))
        tk.Checkbutton(self, text="掛著自動處理『上傳凌越』佇列（只寫你在網站按過上傳的單，不會動其他訂單）",
                       variable=auto_var, wraplength=500, justify="left",
                       bg=BG, fg=FG, selectcolor=PANEL, activebackground=BG, activeforeground=FG,
                       font=("Microsoft JhengHei UI", 10)).pack(anchor="w", padx=16)
        self.vars["wb_auto"] = auto_var

        tk.Label(self, text="倉別/單位規則固定：每品項帶凌越貨品主檔預設倉(SK_RKWHNO)與正規單位(SK_UNIT)；"
                            "付款方式/業務員自動從客戶主檔帶入（拋轉必備）",
                 fg=MUTED, bg=BG, anchor="w", justify="left", wraplength=520,
                 font=("Microsoft JhengHei UI", 8)).pack(fill="x", padx=16, pady=(2, 0))

        chk_var = tk.BooleanVar(value=bool(cfg.get("wb_mark_checked", True)))
        tk.Checkbutton(self, text="寫入即標記「已審核」(OR_CHECK=1)——拋轉需要；取消勾＝未審核（好刪、但拋轉抓不到）",
                       variable=chk_var, wraplength=500, justify="left",
                       bg=BG, fg=FG, selectcolor=PANEL, activebackground=BG, activeforeground=FG,
                       font=("Microsoft JhengHei UI", 10)).pack(anchor="w", padx=16)
        self.vars["wb_mark_checked"] = chk_var

        row("固定倉別 (LY_DEFAULT_WHNO)", "wb_default_whno",
            "後備：品項在凌越貨品主檔查不到預設倉時用這個補")
        row("建立人代碼 (LY_CREATE_NAME)", "wb_create_name",
            "帶入 OR_MAKER/OR_CREATENAME 的操作員代碼，預設 052（拋轉依建立日期/人抓單）")
        row("預設單價 (LY_DEFAULT_PRICE)", "wb_default_price", "留空＝讓凌越依客戶售價表帶價")

        # 連線測試結果
        self.test_result = tk.Label(self, text="", fg=MUTED, bg=BG, anchor="w", justify="left",
                                    wraplength=520, font=("Microsoft JhengHei UI", 9))
        self.test_result.pack(fill="x", side="bottom", padx=16, pady=(0, 2))

        # 底部按鈕
        btns = tk.Frame(self, bg=BG)
        btns.pack(fill="x", side="bottom", pady=12)
        tk.Button(btns, text="儲存", command=self._save, bg=GREEN, fg="white", relief="flat",
                  padx=20, pady=6, font=("Microsoft JhengHei UI", 10, "bold"),
                  activebackground="#2ea043", cursor="hand2").pack(side="right", padx=16)
        tk.Button(btns, text="取消", command=self.destroy, bg=PANEL2, fg=FG, relief="flat",
                  padx=16, pady=6, font=("Microsoft JhengHei UI", 10),
                  activebackground=GREY, cursor="hand2").pack(side="right")
        tk.Button(btns, text="測試連線", command=self._test, bg=BLUE, fg="#0b1220", relief="flat",
                  padx=16, pady=6, font=("Microsoft JhengHei UI", 10, "bold"),
                  activebackground="#4899f0", cursor="hand2").pack(side="left", padx=16)

    def _test(self):
        self.test_result.config(text="測試中 …", fg=MUTED)
        base = self.vars["cloud_base"].get().strip()
        key = self.vars["writeback_key"].get().strip()

        def worker():
            ok, msg = cloud_test(base, key)
            self.test_result.config(text=msg, fg=(GREEN if ok else RED))
        threading.Thread(target=worker, daemon=True).start()

    def _save(self):
        out = {}
        for k, v in self.vars.items():
            if isinstance(v, tk.BooleanVar):
                out[k] = v.get()
            else:
                out[k] = v.get().strip()
        self.on_save(out)
        self.destroy()


def main():
    try:
        # 讓沒有 console 的打包版也不會因 print 報錯
        if sys.stdout is None:
            sys.stdout = open(os.devnull, "w")
    except Exception:
        pass
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
