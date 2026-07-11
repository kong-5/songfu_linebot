# lystk_tool（內網底層凌越模組 — 版控備份）

這裡是內網那台 `D:\Work\lystk_tool` 的**版控備份**（原本沒進 repo，導致要修改時得靠人工上傳）。
底層凌越連線模組放這，`凌越整合代理` 資料夾裡的 `ly_stock_push.py` / `ly_writeback_bridge.py`
執行時用 `sys.path` 指到 `D:\Work\lystk_tool` 載入這些檔。

## 檔案
- `lystk.py` — LyERP SOAP 查詢模組（`query(icpno, idakd, ...)`）。**公司白名單 `COMPANIES` 在這裡**。
- `ly_order.py` — 訂單寫入模組（尚未納入版控，之後補上傳）。

## 重要：公司白名單
`lystk.py` 的 `COMPANIES` / `_NAME_TO_ICPNO` 是「前端白名單」。凌越帳密**所有公司共用一組**
（存 Windows 認證管理員，不在檔案裡），`icpno` 只是原封不動送給凌越 `LyDataOut`。
所以**新增公司只要在這兩個 dict 各加一筆**，不需要任何金鑰。

- 2026-07-11：加入 `02 松揚`（原本只有 00 松富 / 01 龍港 / 03 松成，漏了 02 導致
  推松揚庫存時 `lystk` 自己擋下並回 `Unknown company: '02'`）。

## 更新地端 SOP
改完這裡的 `lystk.py` → 複製到內網那台的 `D:\Work\lystk_tool\lystk.py` 蓋掉舊的。
