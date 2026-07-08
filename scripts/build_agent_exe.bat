@echo off
REM ============================================================
REM  build_agent_exe.bat — 把「凌越整合代理」打包成單一 .exe
REM
REM  在那台內網 Windows（能連凌越、已裝 Python）上執行一次即可，
REM  產生 dist\凌越整合代理.exe，之後雙擊該檔就能開視窗，
REM  該台電腦即使沒裝 Python 也能跑（Python 已包進 exe）。
REM
REM  注意：凌越模組 lystk.py / ly_order.py 仍需在 D:\Work\lystk_tool；
REM        exe 執行時會用環境變數 LYSTK_DIR（預設 D:\Work\lystk_tool）去找。
REM        產生的設定檔 ly_agent_config.json 會存在 exe 同資料夾。
REM ============================================================

setlocal
cd /d "%~dp0"

echo [1/2] 安裝/更新 PyInstaller ...
python -m pip install --upgrade pyinstaller || goto :err

echo [2/2] 開始打包（單一檔、無 console 視窗）...
python -m PyInstaller --noconfirm --onefile --windowed ^
  --name "凌越整合代理" ^
  ly_agent_gui.py || goto :err

echo.
echo ============================================================
echo  完成！請到 dist\ 資料夾拿「凌越整合代理.exe」。
echo  第一次打開後按「⚙ 設定」填好網址與金鑰即可。
echo ============================================================
pause
goto :eof

:err
echo.
echo ❌ 打包失敗，請把上面的錯誤訊息截圖回報。
pause
