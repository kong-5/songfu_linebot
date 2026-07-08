@echo off
REM ============================================================
REM  ly_query_server_run.bat - run the Lingyue sales-order query service (always-on)
REM
REM  Place this in D:\Work\lystk_tool, next to:
REM      ly_query_server.py   ly_departments.json
REM  Edit LY_QUERY_KEY below to the key agreed with songyang178go.
REM
REM  Auto-restarts if the service exits. Logs to logs\ly_query.log.
REM  Task Scheduler: Create Task -> Trigger "At log on" -> Action: start this .bat,
REM  Start in: D:\Work\lystk_tool
REM ============================================================

setlocal

set "LY_QUERY_KEY=CHANGE_ME_KEY"
set "LY_QUERY_PORT=8787"

cd /d "%~dp0"
if not exist "logs" mkdir "logs"
chcp 65001 >nul

:loop
echo ==== %DATE% %TIME% start query service (port %LY_QUERY_PORT%) ==== >> "logs\ly_query.log"
python "%~dp0ly_query_server.py" >> "logs\ly_query.log" 2>&1
echo ==== %DATE% %TIME% service exited (code %ERRORLEVEL%), restart in 5s ==== >> "logs\ly_query.log"
timeout /t 5 /nobreak >nul
goto loop
