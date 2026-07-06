@echo off
REM ============================================================
REM  ly_stock_daily.bat — 每天固定把凌越目前庫存推上後台
REM  給 Windows「工作排程器」呼叫（內網那台 D:\Work 機器）。
REM
REM  設定方式：
REM    1. 改下面三個變數（後台網址、金鑰、公司別）。
REM    2. 工作排程器 → 建立基本工作 → 每日(可設多個時間) → 啟動程式 → 選這個 .bat。
REM    3. 「開始位置」建議填 D:\Work\lystk_tool，確保找得到 lystk.py。
REM
REM  這是「保底每日刷新」。若還要『按按鈕即時刷新』，另外常駐跑 ly_stock_agent.py。
REM  記錄：每次執行會把輸出附加到 logs\ly_stock_YYYYMMDD.log。
REM ============================================================

setlocal

REM ── 請依實際環境修改 ──────────────────────────────────────
set "LY_CLOUD_BASE=https://<後台網址>"
set "LY_WRITEBACK_KEY=<與後台 LINGYUE_WRITEBACK_KEY 相同>"
set "LY_ICPNO=00"

set "PYTHON=python"
set "SCRIPT=%~dp0ly_stock_push.py"
set "LOGDIR=%~dp0logs"
REM ──────────────────────────────────────────────────────────

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

for /f %%i in ('wmic os get LocalDateTime ^| find "."') do set "DT=%%i"
set "TODAY=%DT:~0,8%"
set "LOGFILE=%LOGDIR%\ly_stock_%TODAY%.log"

echo. >> "%LOGFILE%"
echo ======== %DATE% %TIME% 開始推送庫存 ======== >> "%LOGFILE%"

"%PYTHON%" "%SCRIPT%" >> "%LOGFILE%" 2>&1

echo ======== 結束（exit=%ERRORLEVEL%）======== >> "%LOGFILE%"

endlocal
