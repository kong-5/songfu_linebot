@echo off
REM ============================================================
REM  ly_query_server_run.bat — 常駐啟動凌越銷貨單查詢服務
REM  給 songyang178go 連的 HTTP 服務。跑在內網那台 D:\Work\lystk_tool。
REM
REM  設定方式：
REM    1. 改下面「金鑰／埠」兩個變數（金鑰要與 songyang178go 端約定，一字不差）。
REM    2. 工作排程器 → 建立工作 → 觸發：使用者登入時 → 動作：啟動這個 .bat →
REM       「開始位置」填 D:\Work\lystk_tool。詳見同資料夾說明或問維運。
REM
REM  特性：服務若當掉會自動在 5 秒後重啟；輸出寫到 logs\ly_query_YYYYMMDD.log。
REM  ly_query_server.py 與 ly_departments.json 需與本 .bat 同在 D:\Work\lystk_tool。
REM ============================================================

setlocal

REM ── 請依實際環境修改 ──────────────────────────────────────
set "LY_QUERY_KEY=<與 songyang178go 約定的金鑰>"
set "LY_QUERY_PORT=8787"
REM 公司/部門欄位/明細欄位都由 ly_departments.json 決定，通常不用在這裡設。
REM ──────────────────────────────────────────────────────────

set "PYTHON=python"
set "TOOLDIR=%~dp0"
set "SCRIPT=%~dp0ly_query_server.py"
set "LOGDIR=%~dp0logs"

REM 讓服務在自己資料夾執行，確保找得到 ly_departments.json / ly_datain / lystk
cd /d "%~dp0"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

REM 主控台用 UTF-8，避免中文亂碼
chcp 65001 >nul

:loop
for /f %%i in ('wmic os get LocalDateTime ^| find "."') do set "DT=%%i"
set "TODAY=%DT:~0,8%"
set "LOGFILE=%LOGDIR%\ly_query_%TODAY%.log"

echo. >> "%LOGFILE%"
echo ======== %DATE% %TIME% 啟動查詢服務（埠 %LY_QUERY_PORT%） ======== >> "%LOGFILE%"

"%PYTHON%" "%SCRIPT%" >> "%LOGFILE%" 2>&1

echo ======== %DATE% %TIME% 服務結束（exit=%ERRORLEVEL%），5 秒後重啟 ======== >> "%LOGFILE%"
timeout /t 5 /nobreak >nul
goto loop

endlocal
