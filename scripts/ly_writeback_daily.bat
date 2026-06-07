@echo off
REM ============================================================
REM  ly_writeback_daily.bat — 每天自動把雲端訂單回寫凌越
REM  給 Windows「工作排程器」呼叫（內網那台 D:\Work 機器）。
REM
REM  設定方式：
REM    1. 改下面四個變數（網址、金鑰、Python 路徑、腳本路徑）。
REM    2. 工作排程器 → 建立基本工作 → 每日 → 啟動程式 → 選這個 .bat。
REM    3. 「開始位置」建議填 D:\Work\lystk_tool，確保找得到 ly_datain.py。
REM
REM  記錄：每次執行會把輸出附加到 logs\ly_writeback_YYYYMMDD.log。
REM  注意：正式上線前請先手動跑一次 --test 確認倉別留空/單價0 凌越收得進去。
REM ============================================================

setlocal

REM ── 請依實際環境修改 ──────────────────────────────────────
set "LY_CLOUD_BASE=https://<後台網址>"
set "LY_WRITEBACK_KEY=<與後台 LINGYUE_WRITEBACK_KEY 相同>"
set "LY_ICPNO=00"
REM 倉別留空＝之後在凌越補；若凌越不收空倉別，改成實際倉別如 FN005
set "LY_DEFAULT_WHNO="
set "LY_DEFAULT_PRICE=0"

set "PYTHON=python"
set "SCRIPT=%~dp0ly_writeback_bridge.py"
set "LOGDIR=%~dp0logs"
REM ──────────────────────────────────────────────────────────

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

REM 取今天日期 YYYYMMDD（依系統地區可能需調整；此處用 WMIC 較不受地區影響）
for /f %%i in ('wmic os get LocalDateTime ^| find "."') do set "DT=%%i"
set "TODAY=%DT:~0,8%"
set "LOGFILE=%LOGDIR%\ly_writeback_%TODAY%.log"

echo. >> "%LOGFILE%"
echo ======== %DATE% %TIME% 開始回寫 ======== >> "%LOGFILE%"

"%PYTHON%" "%SCRIPT%" >> "%LOGFILE%" 2>&1

echo ======== 結束（exit=%ERRORLEVEL%）======== >> "%LOGFILE%"

endlocal
