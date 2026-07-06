#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_stock_agent.py — 目前庫存「即時刷新」代理（內網常駐，long-poll）
====================================================================

跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁），需**常駐執行**。
讓後台「庫存管理 → 目前庫存」的『庫存更新』按鈕能真的重新從凌越拉最新庫存：

  1. 啟動時先推一次（讓後台一開始就有資料）。
  2. 之後掛長連線 long-poll：GET {BASE}/admin/lingyue-writeback/inventory-wait?timeout=25
     使用者一點『庫存更新』→ 端點立刻回 {refresh:true} → 代理撈凌越並推送。
  3. 每隔 REFRESH_EVERY_MIN 分鐘也自動推一次（保底，預設 30 分；設 0 關閉）。

與每日排程（ly_stock_daily.bat）互補：排程保證每天固定刷新，本代理提供「即時刷新」。

設定（環境變數）
----------------
  LY_CLOUD_BASE     雲端後台網址（必填）
  LY_WRITEBACK_KEY  與後台 LINGYUE_WRITEBACK_KEY 相同的金鑰（必填）
  LY_ICPNO          公司代碼，預設 "00"（松富）
  LY_STOCK_EVERY    保底自動推送間隔（分鐘），預設 30；設 0 只靠 long-poll 觸發

用法
----
  set LY_CLOUD_BASE=https://xxxx.run.app
  set LY_WRITEBACK_KEY=lywb_xxxxxxxx
  python ly_stock_agent.py
（建議掛 Windows 工作排程器「登入時啟動 + 失敗自動重啟」，開始位置 D:\\Work\\lystk_tool）
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error

sys.path.insert(0, r"D:\Work\lystk_tool")
from ly_stock_push import push_once  # noqa: E402  重用推送邏輯


def poll_wait(base: str, key: str, timeout_sec: int = 25) -> bool:
    """掛長連線等後台的刷新請求。回 True=有人點了『庫存更新』；False=逾時無事。"""
    url = base.rstrip("/") + f"/admin/lingyue-writeback/inventory-wait?timeout={timeout_sec}"
    req = urllib.request.Request(url, method="GET", headers={"X-Writeback-Key": key, "Accept": "application/json"})
    # HTTP 讀取逾時要比伺服器 hold 久一點，避免自己先斷線
    with urllib.request.urlopen(req, timeout=timeout_sec + 15) as resp:
        res = json.loads(resp.read().decode("utf-8") or "{}")
    return bool(res.get("refresh"))


def main() -> int:
    base = (os.environ.get("LY_CLOUD_BASE") or "").strip()
    key = (os.environ.get("LY_WRITEBACK_KEY") or "").strip()
    icpno = (os.environ.get("LY_ICPNO") or "00").strip()
    try:
        every_min = int(os.environ.get("LY_STOCK_EVERY", "30"))
    except ValueError:
        every_min = 30

    if not base or not key:
        print("❌ 請先設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY 環境變數。", file=sys.stderr)
        return 2

    print(f"▶ 庫存代理啟動：base={base} icpno={icpno} 保底間隔={every_min}分（0=關）", flush=True)

    # 啟動先推一次
    try:
        push_once(base, key, icpno)
    except Exception as e:
        print(f"  啟動推送失敗（稍後會重試）：{e}", flush=True)

    last_auto = time.monotonic()
    while True:
        try:
            got = poll_wait(base, key, timeout_sec=25)
            if got:
                print("  🔄 收到『庫存更新』請求 → 撈凌越並推送…", flush=True)
                push_once(base, key, icpno)
                last_auto = time.monotonic()
            elif every_min > 0 and (time.monotonic() - last_auto) >= every_min * 60:
                print("  ⏱ 保底自動推送…", flush=True)
                push_once(base, key, icpno)
                last_auto = time.monotonic()
        except urllib.error.URLError as e:
            print(f"  連線問題，5 秒後重試：{getattr(e, 'reason', e)}", flush=True)
            time.sleep(5)
        except Exception as e:
            print(f"  代理迴圈錯誤，5 秒後重試：{e}", flush=True)
            time.sleep(5)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    sys.exit(main())
