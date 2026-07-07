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
import threading
import datetime
import urllib.request
import urllib.error

import tkinter as tk
from tkinter import ttk

# ── 讓本機找得到凌越模組（與原代理相同的位置）────────────────────────
LYSTK_DIR = os.environ.get("LYSTK_DIR", r"D:\Work\lystk_tool")
if LYSTK_DIR and LYSTK_DIR not in sys.path:
    sys.path.insert(0, LYSTK_DIR)

# 這些子模組會在載入時 import lystk / ly_order；在沒有凌越環境的機器上會失敗，
# 因此改成「用到時才載入」（lazy import），視窗照樣能開、能改設定。
APP_TITLE = "凌越整合代理"
APP_VER = "1.0"


# ======================================================================
#  設定檔（存在 exe / 腳本旁邊）
# ======================================================================

def app_dir() -> str:
    """打包成 exe 後用執行檔所在資料夾；否則用本檔所在資料夾。"""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


CONFIG_PATH = os.path.join(app_dir(), "ly_agent_config.json")

DEFAULT_CONFIG = {
    "cloud_base": os.environ.get("LY_CLOUD_BASE", ""),
    "writeback_key": os.environ.get("LY_WRITEBACK_KEY", ""),
    "icpno": os.environ.get("LY_ICPNO", "00"),
    "stock_times": os.environ.get("LY_STOCK_TIMES", "06:00,12:00"),
    "wb_auto": True,            # 訂單回寫是否掛著自動跑
    "wb_interval_min": 10,      # 自動回寫的檢查間隔（分鐘）
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
#  小工具：時間、雲端連線
# ======================================================================

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

    # ── 生命週期 ───────────────────────────────────────────────
    def start(self):
        self.stop_event.clear()
        self.state["stock_running"] = True
        self.state["wb_running"] = bool(self.cfg.get("wb_auto"))
        self._threads = [
            threading.Thread(target=self._stock_loop, name="stock", daemon=True),
            threading.Thread(target=self._writeback_loop, name="writeback", daemon=True),
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
            import ly_stock_push  # lazy：需要凌越環境
        except Exception as e:
            self.state["erp"] = "missing"
            self.log(f"⚠ 載入凌越庫存模組失敗（此機無凌越環境？）：{e}")
            return
        with self.erp_lock:
            tag = f"（{reason}）" if reason else ""
            self.log(f"🔄 撈凌越庫存並推送{tag} …")
            try:
                n = ly_stock_push.push_once(base, key, icpno)
                self.state["erp"] = "ok"
                self.state["stock_last_push"] = f"{now_full()}（{n} 品項）"
            except Exception as e:
                self.log(f"❌ 推庫存失敗：{e}")

    def do_writeback(self, *, date=None, dry_run=False, test=False, keep=False):
        base, key, icpno = self.cfg["cloud_base"], self.cfg["writeback_key"], self.cfg["icpno"]
        if not base or not key:
            self.log("⚠ 尚未設定網址/金鑰，無法回寫（請按⚙設定）")
            return
        try:
            import ly_writeback_bridge  # lazy：需要凌越環境
        except Exception as e:
            self.state["erp"] = "missing"
            self.log(f"⚠ 載入凌越回寫模組失敗（此機無凌越環境？）：{e}")
            return

        import types
        ns = types.SimpleNamespace(
            date=date, base=base, key=key, icpno=icpno,
            warehouse=self.cfg.get("wb_default_whno", ""),
            price=self.cfg.get("wb_default_price", ""),
            dry_run=dry_run, test=test, keep=keep, verbose=False,
        )
        with self.erp_lock:
            try:
                rc = ly_writeback_bridge.run(ns)
                self.state["erp"] = "ok"
                if not dry_run and not test:
                    self.state["wb_last"] = now_full()
                    self.state["wb_last_result"] = "完成" if rc == 0 else f"部分失敗(rc={rc})"
            except Exception as e:
                self.log(f"❌ 回寫失敗：{e}")

    def auto_writeback_tick(self):
        """自動回寫：先看有沒有待回寫的訂單，有才寫（沒有就安靜略過）。"""
        base, key = self.cfg["cloud_base"], self.cfg["writeback_key"]
        if not base or not key:
            return
        try:
            import ly_writeback_bridge
        except Exception as e:
            self.state["erp"] = "missing"
            self.log(f"⚠ 載入凌越回寫模組失敗：{e}")
            return
        try:
            orders = ly_writeback_bridge.fetch_pending(base, key, datetime.date.today().strftime("%Y-%m-%d"))
        except Exception as e:
            self.log(f"⚠ 查待回寫訂單失敗：{e}")
            return
        self.state["wb_last_check"] = now_full()
        if not orders:
            return
        self.log(f"📝 發現 {len(orders)} 張待回寫訂單，開始寫入凌越 …")
        self.do_writeback()

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
            try:
                got = cloud_poll_wait(base, key, 25)
                self.state["cloud"] = "ok"
                self.state["cloud_last"] = now_full()
                if got:
                    self.do_stock_push(reason="按鈕觸發")

                # 定時推送
                now = datetime.datetime.now()
                today = now.date().isoformat()
                times = parse_times(self.cfg["stock_times"])
                for (h, m) in times:
                    slot = (today, h, m)
                    if slot in pushed:
                        continue
                    if (now.hour, now.minute) >= (h, m):
                        self.do_stock_push(reason=f"定時 {h:02d}:{m:02d}")
                        pushed.add(slot)
                if len(pushed) > 8:
                    pushed = {k for k in pushed if k[0] == today}
                self.state["stock_next"] = next_time_label(times)
            except urllib.error.URLError as e:
                self.state["cloud"] = "down"
                self.log(f"⚠ 雲端連線問題，5 秒後重試：{getattr(e, 'reason', e)}")
                self.stop_event.wait(5)
            except Exception as e:
                self.log(f"⚠ 庫存迴圈錯誤，5 秒後重試：{e}")
                self.stop_event.wait(5)

    # ── 背景迴圈：訂單回寫（間隔檢查）──────────────────────────
    def _writeback_loop(self):
        # 啟動後稍等，避免和庫存啟動推送同時打凌越
        self.stop_event.wait(15)
        while not self.stop_event.is_set():
            if self.cfg.get("wb_auto"):
                self.state["wb_running"] = True
                try:
                    self.auto_writeback_tick()
                except Exception as e:
                    self.log(f"⚠ 自動回寫錯誤：{e}")
            else:
                self.state["wb_running"] = False
            # 依設定的間隔等待（可被停止事件提早喚醒）
            interval = max(1, int(self.cfg.get("wb_interval_min", 10) or 10))
            self.stop_event.wait(interval * 60)


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

        opbtn("立即推庫存", lambda: self._async(self.engine.do_stock_push, reason="手動"), BLUE)
        opbtn("回寫試跑(dry-run)", lambda: self._async(self.engine.do_writeback, dry_run=True))
        opbtn("回寫測一張", lambda: self._async(self.engine.do_writeback, test=True))
        opbtn("立即回寫", lambda: self._async(self.engine.do_writeback), AMBER)

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
        self.card_erp.set(
            s["erp"],
            {"ok": "凌越模組已載入", "missing": "凌越模組未載入", "unknown": "尚未使用"}.get(s["erp"], ""),
            "" if s["erp"] == "ok" else "（需在 D:\\Work\\lystk_tool 那台電腦執行）" if s["erp"] == "missing" else "",
        )
        self.card_stock.set(
            s["stock_running"],
            "運作中（長連線）" if s["stock_running"] else "已停止",
            f"最後推送：{s['stock_last_push']}   下次定時：{s['stock_next']}",
        )
        self.card_wb.set(
            s["wb_running"],
            f"自動回寫（每 {self.cfg.get('wb_interval_min', 10)} 分檢查）" if s["wb_running"] else "自動回寫：關閉",
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

    def _probe_erp(self):
        def worker():
            try:
                import ly_stock_push  # noqa: F401
                import ly_writeback_bridge  # noqa: F401
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
        self.geometry("560x520")
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
        row("公司代碼 (LY_ICPNO)", "icpno", "松富=00、龍港=01、桂田=03")

        tk.Label(self, text="庫存代理", fg=BLUE, bg=BG, anchor="w",
                 font=("Microsoft JhengHei UI", 12, "bold")).pack(fill="x", padx=16, pady=(12, 2))
        row("每日定時推送 (LY_STOCK_TIMES)", "stock_times",
            "24小時制、逗號分隔，如 06:00,12:00；清空＝只靠按鈕/即時")

        tk.Label(self, text="訂單回寫", fg=BLUE, bg=BG, anchor="w",
                 font=("Microsoft JhengHei UI", 12, "bold")).pack(fill="x", padx=16, pady=(12, 2))
        auto_var = tk.BooleanVar(value=bool(cfg.get("wb_auto", True)))
        tk.Checkbutton(self, text="掛著自動回寫（發現待回寫訂單就寫進凌越）", variable=auto_var,
                       bg=BG, fg=FG, selectcolor=PANEL, activebackground=BG, activeforeground=FG,
                       font=("Microsoft JhengHei UI", 10)).pack(anchor="w", padx=16)
        self.vars["wb_auto"] = auto_var
        row("自動檢查間隔（分鐘）", "wb_interval_min", "預設 10 分鐘檢查一次")
        row("預設倉別 (LY_DEFAULT_WHNO)", "wb_default_whno", "留空＝之後在凌越補；凌越不收空倉別才填")
        row("預設單價 (LY_DEFAULT_PRICE)", "wb_default_price", "留空＝讓凌越依客戶售價表帶價")

        # 底部按鈕
        btns = tk.Frame(self, bg=BG)
        btns.pack(fill="x", side="bottom", pady=12)
        tk.Button(btns, text="儲存", command=self._save, bg=GREEN, fg="white", relief="flat",
                  padx=20, pady=6, font=("Microsoft JhengHei UI", 10, "bold"),
                  activebackground="#2ea043", cursor="hand2").pack(side="right", padx=16)
        tk.Button(btns, text="取消", command=self.destroy, bg=PANEL2, fg=FG, relief="flat",
                  padx=16, pady=6, font=("Microsoft JhengHei UI", 10),
                  activebackground=GREY, cursor="hand2").pack(side="right")

    def _save(self):
        out = {}
        for k, v in self.vars.items():
            if isinstance(v, tk.BooleanVar):
                out[k] = v.get()
            else:
                out[k] = v.get().strip()
        # 型別校正
        try:
            out["wb_interval_min"] = max(1, int(out.get("wb_interval_min", 10) or 10))
        except ValueError:
            out["wb_interval_min"] = 10
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
