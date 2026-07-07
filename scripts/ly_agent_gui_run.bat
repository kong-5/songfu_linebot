@echo off
REM ============================================================
REM  ly_agent_gui_run.bat — 直接用 Python 開「凌越整合代理」視窗
REM
REM  用途：那台已裝 Python 的內網機器，雙擊本檔即可開視窗。
REM        第一次打開後按視窗上的「⚙ 設定」填好網址與金鑰即可，
REM        不必再改任何 .bat（設定會存成 ly_agent_config.json）。
REM
REM  想開機自動跑：工作排程器 → 觸發程序「登入時」→ 動作選本 .bat，
REM               「開始位置」填 D:\Work\lystk_tool（確保找得到 lystk/ly_order）。
REM ============================================================

setlocal
REM 讓程式找得到凌越模組（lystk.py / ly_order.py）所在資料夾
set "LYSTK_DIR=D:\Work\lystk_tool"

cd /d "%~dp0"
REM 用 pythonw 開視窗（不帶黑色 console）；若沒有 pythonw 就退回 python
where pythonw >nul 2>nul && (start "" pythonw ly_agent_gui.py) || (python ly_agent_gui.py)
endlocal
