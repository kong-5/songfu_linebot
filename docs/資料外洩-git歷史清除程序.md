# 資料外洩處置 — git 歷史清除程序（2026-09-01）

> ⚠️ **這份要人工執行，Claude 不會自動做。** 清除歷史＝改寫所有 commit 的 hash，
> 會讓每一份既有 clone 失效，必須全員配合。請挑一個沒人在推 code 的時段做。

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

### 步驟 2：確認沒有人有未推送的工作

通知所有成員：**把手上的 branch 推上去或先存 patch**，清除後舊 clone 不能再用。
也要確認沒有開著的 PR（清除後 PR 的 base 會對不上，需重開）。

### 步驟 3：用 git-filter-repo 清除

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
