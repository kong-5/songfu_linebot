# 資料外洩處置 — git 歷史清除程序（2026-09-01）

> ## 🔴 狀態：**待執行**（預定 2026-09-02 於本機）
>
> ⚠️ **這份要人工執行。** 清除歷史＝改寫所有 commit 的 hash，既有 clone 會失效。
> 本 repo 目前是**單人使用**，所以不需要協調停工；直接照「做法 B」跑即可（已實測）。
>
> **執行前只要記得兩件事**：
> 1. 先在自己機器上留一份備份（步驟 1）
> 2. `filter-branch` 會把改寫前的 refs 留在 `refs/original/`，**裡面還有完整舊資料**——
>    一定要刪掉再 `gc` 才算乾淨（步驟 3 做法 B 有指令）
>
> 做完請把本段狀態改成「✅ 已完成 <日期>」。

---

## 一、發生什麼事

體檢（2026-09-01）發現 repo 內有兩份**真實營運資料**被 commit 進 git：

| 檔案 | 內容 | 進來的 commit |
|---|---|---|
| `cloudsql_export_data_20260323_132005.sql`（592 KB） | **632 筆客戶**（客戶名、`teraoka_code`、`hq_cust_code`、`line_group_id`）＋ 5 筆 orders／140 筆 order_items／9 筆 order_attachments／1999 筆 products／app_settings | `bca216d`（#111） |
| `data/songfu.db`＋`-shm`／`-wal`（561 KB） | 本機 SQLite 實體資料庫 | `bca216d`（#111） |

`.gitignore` 雖然早就有 `data/`，但**對「已被追蹤」的檔案無效**，所以一直跟著版本庫走。

**沒有外洩的**：`admin_users`（密碼雜湊）、LINE channel secret、任何 API 金鑰——
掃過 dump 內容確認不含這些。

**為什麼這件事重要**：2026-08-30 才因為「不留高完整度營業資料在外面」關掉整條取銷貨單線，
但 repo 本身就帶著整份客戶資料庫。只要 repo 被 fork／外流／給了承包商，等於客戶名單外流。
且 `line_group_id` 是空籃 LIFF 授權（`bkAuthorize`）的判斷依據之一。

---

## 二、已經做掉的部分（本次 PR）

- `git rm --cached` 把四個檔案從索引移除 → **從此以後的 commit 不再包含它們**
- `.gitignore` 補上 `*.db`／`*_export_data_*.sql`／`cloudsql_export*.sql`／`.DS_Store`／`.claude/worktrees/`
- 順手移除兩個誤 commit：`.DS_Store`×2、`.claude/worktrees/nostalgic-wescoff-2974af`
  （後者是**壞掉的 submodule gitlink**，指向不存在的 commit `fbfcdbe`，會讓 clone 報錯）

⚠️ **但舊 commit 裡的資料還在。** 任何人 `git log`／`git show bca216d` 都拿得到。
要真正清掉必須改寫歷史，也就是下面這段。

---

## 三、清除歷史（人工執行）

### 步驟 0：先評估要不要做

| 情境 | 建議 |
|---|---|
| repo 是 private、只有內部 3~5 人、沒給過外部承包商 | 風險可控，可以排時間做，不必當天緊急 |
| repo 曾經 public、或曾 fork 給外部、或 CI 金鑰廣泛分享 | **要做，而且要一併通知客戶端評估**（客戶名單屬個資） |
| 完全不想改寫歷史 | 至少確認 repo 權限收緊到最小必要人員，並把這份文件留著 |

### 步驟 1：備份

```bash
# 完整鏡像備份，出事可回復
git clone --mirror git@github.com:kong-5/songfu_linebot.git songfu_backup_$(date +%Y%m%d).git
```

### 步驟 2：確認自己沒有未推送的工作

本 repo 單人使用，不需要通知別人。只要確認**自己手上每一份 clone** 的東西都推上去了
（清除後舊 clone 不能再用，要重新 clone），以及沒有還開著、還想留著的 PR
（清除會改寫 PR 的 head，先合併或關掉比較乾淨）。

### 步驟 2.5：先知道會動到多少東西（2026-09-01 實測）

- 這個 repo 有 **64 個遠端分支**。資料從 `bca216d` 進來後存在於整條歷史，
  所以 `--mirror` 推送會**改寫全部 64 個分支的 commit SHA**，不只 main。
- main 只有 50 個 commit、`.git` 約 3.9 MB，改寫本身**約 1 秒**，不用擔心跑很久。
- **main 若有分支保護（禁止 force push）要先暫時關掉**，推完再開回來。
- 當時開著的 PR（例如體檢那支 #168）head 也會被改寫，PR 會指到新的 commit。

### 步驟 3：清除歷史

兩種做法擇一。**優先用 git-filter-repo**（官方建議、較安全）；
裝不了的話用內建 `filter-branch`（下面那組指令 2026-09-01 已在真實歷史上演練過，
61 個 commit 全部改寫成功、檔案確實消失）。

#### 做法 A：git-filter-repo（建議）

`git filter-branch` 已被官方棄用且極慢，用 `git-filter-repo`：

```bash
pip install git-filter-repo    # 或 brew install git-filter-repo

# 在一份「全新的」mirror clone 上operate（filter-repo 要求乾淨 clone）
git clone --mirror git@github.com:kong-5/songfu_linebot.git songfu_clean.git
cd songfu_clean.git

git filter-repo --invert-paths \
  --path cloudsql_export_data_20260323_132005.sql \
  --path data/songfu.db \
  --path data/songfu.db-shm \
  --path data/songfu.db-wal \
  --path .DS_Store \
  --path dist/.DS_Store \
  --path .claude/worktrees/nostalgic-wescoff-2974af
```

確認結果（應該都是 0）：

```bash
git log --all --oneline -- cloudsql_export_data_20260323_132005.sql | wc -l
git log --all --oneline -- data/songfu.db | wc -l
```

#### 做法 B：內建 git filter-branch（裝不了 filter-repo 時）

`filter-branch` 官方已不建議使用，但這個 repo 很小、路徑也單純，實際跑起來沒問題。
**2026-09-01 已在真實歷史上演練驗證過**（61 個 commit、約 1 秒、檔案確實從各分支消失）。

```bash
git clone --mirror git@github.com:kong-5/songfu_linebot.git songfu_clean.git
cd songfu_clean.git

export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch -q \
     cloudsql_export_data_20260323_132005.sql \
     data/songfu.db data/songfu.db-shm data/songfu.db-wal \
     .DS_Store dist/.DS_Store \
     .claude/worktrees/nostalgic-wescoff-2974af' \
  --prune-empty --tag-name-filter cat -- --all
```

⚠ **filter-branch 會把改寫前的 refs 備份在 `refs/original/`，那裡面還有完整的舊資料。**
演練時就是因為這個，驗證指令一開始還會查到 2 筆命中。**一定要刪掉再 gc**：

```bash
git for-each-ref --format='%(refname)' refs/original | xargs -n1 git update-ref -d
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

再驗證（這時才會是 0）：

```bash
git log --all --oneline -- cloudsql_export_data_20260323_132005.sql data/songfu.db | wc -l
# 也可以直接找客戶名確認：應該沒有任何輸出
git grep -l "蘭嶼高中" $(git rev-list --all) 2>/dev/null
```

### 步驟 4：推回去

```bash
# filter-repo 會移除 origin，要重加
git remote add origin git@github.com:kong-5/songfu_linebot.git
git push --force --mirror origin
```

⚠️ GitHub 若有 branch protection（main 禁止 force push），要先暫時關掉，推完再開回來。

### 步驟 5：全員重新 clone

```bash
# 每個人都要做，不要試著用舊 clone rebase
rm -rf songfu_linebot && git clone git@github.com:kong-5/songfu_linebot.git
```

### 步驟 6：GitHub 端的殘留

force push 之後，GitHub 上舊 commit 仍可能透過**直接 URL**存取一段時間
（`https://github.com/kong-5/songfu_linebot/commit/bca216d`）。
要徹底清除須**開 support ticket 請 GitHub 執行 GC**，或（最乾淨）
**刪除 repo 重建並重新 push**。若 repo 一直是 private 且沒 fork 過，這步通常可略過。

---

## 四、以後怎麼避免

1. `.gitignore` 已補規則（見本次 PR），但**規則對已追蹤檔案無效**——
   加新檔案前先 `git status` 看一眼，別無腦 `git add -A`。
2. 要傳資料傾印給人：放 **GCS 私有 bucket** 給簽名網址，不要放 repo。
3. `CLAUDE.md` 已納入規範：「真實營運資料（DB dump、SQLite 檔、含客戶名／群組 ID 的任何檔）
   一律不得 commit」。
4. 想更保險可以裝 pre-commit hook 擋大檔與 dump 副檔名：

```bash
# .git/hooks/pre-commit（每個人自己裝，不隨 repo 走）
#!/bin/sh
if git diff --cached --name-only | grep -qE '\.(db|sqlite3?)$|_export_data_.*\.sql$|dump.*\.sql$'; then
  echo "❌ 疑似資料庫/傾印檔，拒絕 commit。確定要進版本庫請用 git commit --no-verify"
  exit 1
fi
```
