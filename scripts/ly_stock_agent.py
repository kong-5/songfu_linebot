#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ly_stock_agent.py — 目前庫存「即時刷新」代理（內網常駐，long-poll）
====================================================================

跑在能連凌越 LAN 的那台 Windows（D:\\Work\\lystk_tool 旁），需**常駐執行**。
一支就同時做到兩件事：

  1. 啟動時先推一次（讓後台一開始就有最新資料）。
  2. 掛長連線 long-poll：GET {BASE}/admin/lingyue-writeback/inventory-wait?timeout=25
     使用者一點『庫存更新』→ 端點立刻回 {refresh:true} → 代理撈凌越並推送（即時刷新）。
  3. 每天在**指定時間**自動推一次（預設 06:00、12:00 兩次）。

設定（環境變數）
----------------
  LY_CLOUD_BASE     雲端後台網址（必填）
  LY_WRITEBACK_KEY  與後台 LINGYUE_WRITEBACK_KEY 相同的金鑰（必填）
  LY_ICPNO          公司代碼，預設 "00"（松富）
  LY_STOCK_TIMES    每天自動推送的時間，24 小時制、逗號分隔，預設 "06:00,12:00"
                    （設空字串則只靠啟動推送＋按鈕觸發，不做定時）

用法
----
  set LY_CLOUD_BASE=https://xxxx.run.app
  set LY_WRITEBACK_KEY=lywb_xxxxxxxx
  set LY_STOCK_TIMES=06:00,12:00
  python ly_stock_agent.py
（建議掛 Windows 工作排程器「登入時啟動 + 失敗自動重啟」，開始位置 D:\\Work\\lystk_tool）
"""

import os
import sys
import json
import time
import datetime
import urllib.request
import urllib.error

sys.path.insert(0, r"D:\Work\lystk_tool")
from ly_stock_push import push_once  # noqa: E402  重用推送邏輯


def parse_times(s: str) -> list:
    """把 "06:00,12:00" 解析成 [(6,0),(12,0)]。無法解析的略過。"""
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
            else:
                print(f"  略過超出範圍的時間：{part}", flush=True)
        except ValueError:
            print(f"  略過無法解析的時間：{part}", flush=True)
    return out


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
    times = parse_times(os.environ.get("LY_STOCK_TIMES", "06:00,12:00"))

    if not base or not key:
        print("❌ 請先設定 LY_CLOUD_BASE 與 LY_WRITEBACK_KEY 環境變數。", file=sys.stderr)
        return 2

    times_label = "、".join(f"{h:02d}:{m:02d}" for h, m in times) or "（無，只靠按鈕）"
    print(f"▶ 庫存代理啟動：base={base} icpno={icpno} 每日定時={times_label}", flush=True)

    # 啟動先推一次（給後台即時最新資料）
    try:
        push_once(base, key, icpno)
    except Exception as e:
        print(f"  啟動推送失敗（稍後會重試）：{e}", flush=True)

    # 啟動時把「今天已過的定時點」標記為已完成（啟動推送已涵蓋），避免一啟動就補推
    pushed = set()
    now = datetime.datetime.now()
    today = now.date().isoformat()
    for (h, m) in times:
        if (now.hour, now.minute) >= (h, m):
            pushed.add((today, h, m))

    while True:
        try:
            got = poll_wait(base, key, timeout_sec=25)
            if got:
                print("  🔄 收到『庫存更新』請求 → 撈凌越並推送…", flush=True)
                push_once(base, key, icpno)

            # 到達每日定時點就自動推（每個時間點每天只推一次）
            now = datetime.datetime.now()
            today = now.date().isoformat()
            for (h, m) in times:
                key_slot = (today, h, m)
                if key_slot in pushed:
                    continue
                if (now.hour, now.minute) >= (h, m):
                    print(f"  ⏰ 到達每日排定時間 {h:02d}:{m:02d}，自動推送…", flush=True)
                    push_once(base, key, icpno)
                    pushed.add(key_slot)

            # 避免 pushed 集合無限成長：只保留今天的紀錄
            if len(pushed) > 8:
                pushed = {k for k in pushed if k[0] == today}
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
