@echo off
REM ============================================================
REM  ly_stock_agent_run.bat — 啟動「即時刷新」常駐代理
REM
REM  作用：讓後台「庫存管理→目前庫存」的『庫存更新』按鈕能即時刷新，
REM        並每 30 分鐘自動把凌越庫存推上雲端（比每日更即時）。
REM
REM  怎麼用：
REM    1. 把下面「網址」「金鑰」改成你的（跟 ly_stock_daily.bat 一樣那組）。
REM    2. 雙擊本檔即可啟動；會開一個黑視窗一直跑（代理運作中），最小化就好，別關掉。
REM    3. 想關掉：直接關那個黑視窗。
REM    （進階：可用「工作排程器」設「登入時啟動」，讓開機自動跑，見下方說明。）
REM ============================================================

setlocal

REM ── 請依實際環境修改（跟 ly_stock_daily.bat 相同那組）──────
set "LY_CLOUD_BASE=https://songfu-line-bot-238580214385.asia-east1.run.app"
set "LY_WRITEBACK_KEY=<與後台 LINGYUE_WRITEBACK_KEY 相同>"
set "LY_ICPNO=00"
REM 每幾分鐘自動推一次（保底），設 0 則只靠按鈕觸發
set "LY_STOCK_EVERY=30"
REM ──────────────────────────────────────────────────────────

cd /d "%~dp0"
echo 庫存即時刷新代理啟動中…（此視窗請保持開啟；關閉視窗＝停止代理）
python ly_stock_agent.py

endlocal
