# Agentic Coding 開發流程（七步 ＋ 每步驗證閘門）

建立：2026-07-31

這份是「怎麼跟 AI 一起改這個專案」的權威流程。CLAUDE.md 管**改什麼要注意**，這份管**照什麼順序做、每一步憑什麼算過**。

---

## 一、為什麼要這套

部署端的閘門本來就很硬（`cloudbuild.yaml`：lint → `npm test` → PG 冒煙 → 金絲雀 `/health` → 才導流）。
但那些都在**推上去之後**才擋。真正貴的錯誤發生在更早的地方——需求沒問清楚就動手、沒找到既有的權威 helper
就重造一套口徑、計畫裡沒人檢查不變式。這套流程把驗證往前搬到每一步。

原則：**每一步都有一個「憑什麼算過」的判準，沒過就不進下一步。**

---

## 二、七步流程

權威定義在 `.claude/agentic-gates.json`（下表只是導覽，以那份為準）。

| # | 步驟 | id | 閘門型態 | 憑什麼算過 |
|---|------|----|----------|-----------|
| 1 | 釐清需求 | `spec` | human | 覆述成「一句話需求＋可驗收條件清單＋明確不做」，使用者回覆確認 |
| 2 | 探勘定位 | `explore` | human | 列出要動的檔案（含行號）＋引用到的 CLAUDE.md 條號＋可重用的權威 helper |
| 3 | 擬定計畫 | `plan` | human | 計畫每步都寫「怎麼驗」＋七項不變式自檢逐條有答案，使用者確認 |
| 4 | 實作 | `impl` | auto | `node --check`（變更的 JS 逐一）＋ `npm run lint` 全綠 |
| 5 | 測試 | `test` | both | 新增對應 smoke test ＋ `npm test` 全綠；碰到 DB 再加 `npm run smoke:pg` |
| 6 | 自我審查 | `review` | human | 對 diff 逐條核守則：交易原子性／冪等性／稽核軌跡／錯誤訊息可修正 |
| 7 | 交付 | `ship` | both | commit＋push＋draft PR；Cloud Build 綠才算完成 |

`auto` ＝自動檢查全綠就往下；`human` / `both` ＝**要使用者回覆確認**才往下。

### 步驟 3 的七項不變式自檢

這七項是本專案踩過坑的地方，計畫階段逐條寫答案（不是打勾）：

1. Cloud Run `--max-instances=1` 沒被動到（記憶體收單 session／告警去重／登入節流都靠單實例）
2. 新增表／欄位有同時改 `initSqlite` 與 `initPg`
3. SQL 可攜或 isPg 雙分支，沒把 SQLite 專屬語法送進 PG
4. admin 域檔的註冊呼叫在 `const` 宣告之後（TDZ）；`cash.js` 註冊位置未移動
5. 新路由不會被 `/orders/:orderId` 這類既有 pattern 吃掉
6. 單一檔案改完不超過 1000 行，超過要提拆分建議
7. 寫入類改動的交易原子性、冪等性、稽核軌跡各自怎麼做

---

## 三、怎麼跑

### 給 AI（Claude Code）

```
/ac 把每日盤點頁的紅標門檻改成可以分倉設定
```

`/ac` 會逐步走完七步，每步回報驗證結果，`human` 閘門會停下來等你確認。
只想單獨補跑某一步的驗證：

```
/ac-verify impl
/ac-verify 5 --db
```

### 給人（終端機）

```bash
npm run verify              # 全部七步（人工項只列清單）
npm run verify -- impl      # 只跑步驟 4
npm run verify -- 4 5       # 用編號指定多步
npm run verify -- --list    # 只看有哪些閘門，不執行
npm run verify -- test --db # 強制跑「碰到 DB 才跑」的 PG 冒煙
npm run verify -- impl --log docs/agentic-runs/2026-07-31-紅標分倉.md
```

離開碼：`0` 自動檢查全過｜`1` 有自動檢查沒過｜`2` 用法或設定錯誤。

「這次改動有沒有碰到 DB」是自動判斷的：變更檔案落在 `dist/db/`、`.sql`、`scripts/pg-smoke.js`，
或 diff 內出現 `CREATE TABLE` / `ALTER TABLE` / `initPg` / `initSqlite` / `sqlForPg` 就算碰到。
判斷錯了用 `--db` / `--no-db` 覆寫。

---

## 四、要改閘門就改 `.claude/agentic-gates.json`

只有那一份是定義，`verify.mjs` 和 `/ac` 都讀它，不會有兩套。

```jsonc
{
  "id": "impl", "no": 4, "name": "實作", "gate": "auto",
  "auto": [
    { "name": "語法檢查", "builtin": "node-check" },      // 內建：對變更的 JS 逐一 node --check
    { "name": "Lint", "run": "npm run lint" },            // 一般：跑 shell 指令，離開碼 0 算過
    { "name": "PG 冒煙", "run": "npm run smoke:pg", "when": "db" }  // 只有碰到 DB 才跑
  ],
  "manual": ["改的是 dist/ 不是 src/"],                    // 人工／AI 自檢，要有明確答案
  "fixHint": "沒過時怎麼修——守則 4：錯誤訊息必須告訴使用者怎麼修正"
}
```

加一步就在 `stages` 加一筆（`id`／`no`／`name` 必填）。改完跑 `npm run verify -- --list` 確認讀得到。

---

## 五、hooks（自動提醒，警告但不擋）

`.claude/settings.json` 裝了兩個，都是**只警告、一律 exit 0**，誤判不會卡住你：

| 時機 | 腳本 | 做什麼 |
|------|------|--------|
| 每次 Edit/Write 之後 | `scripts/hooks/ac-post-edit.mjs` | 對剛改的 `.js` 跑 `node --check`，語法錯當場提示 |
| 每個回合結束前 | `scripts/hooks/ac-stop-check.mjs` | 有動到 JS 才跑，補跑步驟 4 閘門並提醒還沒做的 5／6／7 |

要暫時關掉：把 `.claude/settings.json` 的 `hooks` 改成 `{}`，或用 `/hooks` 逐項停用。
不想擋人的設計是刻意的——硬擋 `git commit` 會在「明知故犯要先存個 WIP」的時候礙事。

---

## 六、留檔

每次跑流程建一份 `docs/agentic-runs/<YYYY-MM-DD>-<任務短名>.md`（範本 `docs/agentic-runs/_範本.md`），
七步的驗證結果與人工確認答案都寫在裡面，跟著該次 PR 一起提交。

`npm run verify -- <階段> --log <檔案>` 會把自動檢查結果以 markdown 附加到檔尾，人工項的答案自己補寫。

留這份的用途跟系統裡的稽核軌跡一樣：三個月後回頭看「這個決定當初怎麼驗的」有據可查。

---

## 七、這套不做什麼

- **不取代 CLAUDE.md**：改什麼要注意、有哪些權威 helper，還是看 CLAUDE.md 與 `docs/`。
- **不取代 Cloud Build 閘門**：本地驗證是提前攔截，最終判定仍以部署流程為準。
- **不強制小任務照走**：改個錯字、調個文案不必七步跑完；但只要動到寫入邏輯、DB、凌越串接、
  部署設定，就照全套走。

---

## 相關檔案

| 檔案 | 用途 |
|------|------|
| `.claude/agentic-gates.json` | 閘門定義（唯一權威） |
| `scripts/verify.mjs` | 驗證 runner |
| `.claude/commands/ac.md` | `/ac` 驅動整套流程 |
| `.claude/commands/ac-verify.md` | `/ac-verify` 單跑某步驗證 |
| `.claude/settings.json` | hooks 掛載 |
| `scripts/hooks/*.mjs` | 兩個警告型 hook |
| `test/agentic-verify.test.js` | 本套工具自己的 smoke test |
| `docs/agentic-runs/` | 每次跑流程的驗證紀錄 |
