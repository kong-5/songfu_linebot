# 內網那台 Windows — Claude Code 上手與「雲端 ↔ 本地」同步

給**在內網那台 Windows 上開的 Claude Code session** 看的。雲端（claude.ai/code）那邊的
session 有整包 repo、但連不到凌越；這台連得到凌越、但預設什麼都沒有。這份講怎麼把兩邊接起來。
最後更新：2026-08-03

---

## 1. 這台是什麼、不是什麼

| | 這台內網 Windows | 雲端 session |
|---|---|---|
| 連得到凌越 ERP（`192.168.4.11`） | ✅ **只有這台** | ❌ 永遠不行（air-gap） |
| 連得到 GitHub / Cloud Run | ✅ | ✅ |
| 有整包 repo（`dist/`、`docs/`、`CLAUDE.md`） | ❌ 除非自己 clone（見 §3） | ✅ |
| 跑正式作業（庫存推送／訂單回寫） | ✅ 「凌越整合代理」視窗一直開著 | ❌ |

**所以：查凌越、驗證凌越行為 → 這台。改程式、改後台、部署 → 雲端（或這台 clone 之後也行）。**

## 2. 三個資料夾別搞混（很重要）

| 路徑 | 是什麼 | 能不能直接改 |
|---|---|---|
| `D:\Work\lystk_tool\` | **底層模組** `lystk.py`（SOAP 查詢）、`ly_order.py` | 不要改；動它會影響所有腳本 |
| 「凌越整合代理」資料夾（GUI/exe 所在） | **正在跑的權威版** `ly_agent_gui.py`／`ly_stock_push.py`／`ly_writeback_bridge.py`／`ly_item_txn.py` | 這裡才是實際生效的；用 `local_import` 優先載入同資料夾的 `.py`，**刻意蓋過** `D:\Work\lystk_tool` 的舊版 |
| repo 的 `scripts/`（clone 之後才有） | 上面那些 `.py` 的**原始碼來源**、版本控管在這 | 改這裡 → 複製到代理資料夾 → 重開 GUI |

⚠ 更新庫存／回寫邏輯＝換**「凌越整合代理」資料夾**裡的 `.py`，**不是** `D:\Work\lystk_tool`。
exe 版把新 `.py` 放 exe 同層即可被 `local_import` 撿走，不必重打包。

## 3. 把 repo clone 到這台（一次性，之後兩邊就通了）

這台已經會對 Cloud Run 打 HTTPS，所以對外連線是通的，GitHub 一般沒問題。

```powershell
# 1) 裝 Git for Windows（內含 Git Credential Manager，會跳瀏覽器登入 GitHub）
#    https://git-scm.com/download/win  ── 已經有就跳過

# 2) clone（第一次會開瀏覽器要你登入 GitHub 授權）
cd D:\
git clone https://github.com/kong-5/songfu_linebot.git
cd D:\songfu_linebot
```

之後在 `D:\songfu_linebot` 開 Claude Code，它會**自動讀到 `CLAUDE.md`**（架構定案、
不要重複踩的清單）＋整包 `docs/`＋`scripts/`，就跟雲端那邊看到的一樣，不必再貼說明給它。

> 只要跑腳本、不想 clone 整包？也行 — 但每次都要人工貼檔案，且改動不會留在版控裡。
> 會反覆用就 clone，一次麻煩換長期省事。

## 4. 日常流程：雲端寫、內網跑

```
雲端 session：開分支 → 寫程式 → push
        │
        ▼
內網這台：git fetch origin <分支> && git checkout <分支>
        → 跑腳本／驗證凌越行為
        → 有修正就 commit & push 回同一分支
        │
        ▼
雲端 session：git pull 看到你的修正 → 收尾 → PR squash 合併 main → 自動部署 Cloud Run
```

內網這台常用的四行：

```powershell
git fetch origin                       # 拿雲端最新的分支
git checkout claude/xxx-yyy            # 切到雲端開的那個分支
git pull                               # 更新到最新
git add -A; git commit -m "訊息"; git push   # 把這台的修正推回去
```

⚠ **不要直接在這台 push `main`** — `main` 一有 push 就自動部署 Cloud Run。
一律走分支 + PR（雲端那邊會處理）。

## 5. 改內網腳本的正確順序

1. 在 `D:\songfu_linebot\scripts\` 改（或請雲端 session 改好 push、這台 `git pull`）
2. 複製到「凌越整合代理」資料夾（覆蓋同名 `.py`）
3. 重開「凌越整合代理」視窗 → 生效
4. 確認沒問題 → commit & push，讓 repo 與實際跑的版本一致

⚠ 順序反過來（先在代理資料夾改、repo 沒同步）＝下次有人從 repo 佈版就把你的修正蓋掉。

## 6. 禁忌

- **不要** commit 任何憑證：凌越 API 帳密在 Windows 認證管理員（`keyring`），
  `LINGYUE_WRITEBACK_KEY`、`DATABASE_URL` 等在環境變數／Secret Manager，都不進 repo。
- **不要**在這台關掉／重開「凌越整合代理」以外的正式作業視窗，那是線上服務。
- **不要**對凌越做未經確認的寫入。查詢腳本一律唯讀；訂單回寫只寫使用者按過
  「上傳凌越」的單（絕不可用 `/pending` 盲掃，見 `docs/凌越回寫-工作交接.md`）。
- **不要**改 `D:\Work\lystk_tool\lystk.py`（底層共用模組）。

## 7. clone 不了時的備案

公司網路擋 GitHub、或不想在這台放 repo：

- **單一腳本**：請雲端 session 把整支檔案內容貼出來，這台的 session 自己建檔即可
  （凌越查詢腳本都是獨立的，只依賴 `D:\Work\lystk_tool\lystk.py`）。
- **要專案背景**：把 repo 根目錄的 `CLAUDE.md` 整份貼給這台的 session，
  它就有架構定案與各種「不要重複踩」的規則了。
- 長期還是建議 clone；上面兩招每次都要人工搬運，改動也不會進版控。

## 8. 這台常用的驗證指令

```powershell
ping 192.168.4.11                                   # 凌越主機通不通
py D:\Work\lystk_tool\lystk.py version              # 凌越 API 憑證/連線正常？
py D:\songfu_linebot\scripts\ly_check_cjsum.py --selftest      # 腳本自測（不連凌越）
py D:\songfu_linebot\scripts\ly_check_cjsum.py --date today    # 今天的 CJSUM 對帳
py D:\songfu_linebot\scripts\ly_query_stock.py                 # 撈目前庫存
py D:\songfu_linebot\scripts\ly_item_txn.py --code 10100004    # 單品近期進銷交易
```
