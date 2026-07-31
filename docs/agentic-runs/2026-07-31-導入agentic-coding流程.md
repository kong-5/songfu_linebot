# 導入 agentic coding 七步流程 ＋ 每步驗證閘門

- 日期：2026-07-31
- 分支：`claude/agentic-coding-validation-v39604`
- 一句話需求：把「每一步都有驗證閘門」的 agentic coding 流程落地成這個 repo 可執行的設定與工具。
- 明確不做：不改任何既有業務邏輯、不動 `cloudbuild.yaml` 的部署閘門、不硬擋任何操作。

> 這份同時是流程的第一次實跑紀錄（dogfooding）。

---

## 步驟 1 釐清需求　[human]

驗收條件：

1. 七步流程有一份**唯一權威**的機器可讀定義，改一處就到處生效（不會出現文件與腳本兩套）。
2. 能自動跑的閘門真的跑得起來，且**失敗時會判紅**（不是永遠綠的裝飾品）。
3. 不能自動判定的步驟（需求確認、計畫確認）會停下來要人確認。
4. 使用者沒指定驗證標準時，工具/流程要**主動提出建議標準問過**，不默默替他決定。
5. hooks 只警告不擋，誤判不會卡住開發。
6. 每次跑完的驗證結果可留檔。

使用者確認：✅ 已確認——選擇「照這套預設全採用」「指令＋腳本＋文件」「裝 hooks 但只警告不擋」「留檔」。

## 步驟 2 探勘定位　[human]

現況盤查：

| 既有 | 位置 | 判讀 |
|------|------|------|
| CI 硬閘門 | `cloudbuild.yaml` | lint → `npm test` → PG 冒煙 → 金絲雀 `/health` → 導流，已經很硬 |
| lint 規則 | `.eslintrc.json` | 只開正確性規則（no-undef 等），約 4 秒 |
| 測試 | `test/*.test.js` 34 支 | `node --test`，零外部依賴 |
| Claude Code 設定 | `.claude/` | 只有 worktrees，**沒有任何 commands / hooks / settings** |
| 開發守則 | `CLAUDE.md` | 8 條守則＋各領域不變式，但沒有「照什麼順序做」 |

結論：缺的不是部署端閘門，是**動手前**的流程與判準。所以這次全部新增檔案，不改既有邏輯。

適用的 CLAUDE.md 條號：守則 4（錯誤訊息要說怎麼修）、守則 6（附帶 smoke test）、守則 7（跑 lint＋test）。

## 步驟 3 擬定計畫　[human]

| # | 改什麼 | 怎麼驗 |
|---|--------|--------|
| 1 | `.claude/agentic-gates.json` 定義七步閘門 | smoke test 檢查七步齊全、關鍵檢查沒被拿掉 |
| 2 | `scripts/verify.mjs` 讀設定並執行 | 實跑 `impl`／`test` 兩階段，green/red 都要試出來 |
| 3 | `.claude/commands/ac.md`、`ac-verify.md` | 人工檢視內容 |
| 4 | `.claude/settings.json` ＋ 兩個 hook 腳本 | 用假 payload 實跑：壞檔要警告、好檔要靜默、壞輸入不能爆 |
| 5 | `docs/agentic-coding-流程.md` ＋ `docs/agentic-runs/` | 人工檢視 |
| 6 | `test/agentic-verify.test.js` | `npm test` 全綠 |

不變式自檢：

- max-instances=1：**未觸及**（沒動 `cloudbuild.yaml`）。
- initSqlite / initPg 雙寫：**不適用**（零 DB 改動）。
- SQL 可攜：**不適用**（沒有 SQL）。
- TDZ 註冊順序 / cash.js 位置：**不適用**（沒動 admin 域檔）。
- 路由 pattern 衝突：**不適用**（沒加路由）。
- 檔案行數：新檔最大 `scripts/verify.mjs` 約 260 行，未逼近 1000。
- 交易原子性／冪等性／稽核軌跡：**不適用**（本次不寫任何業務資料）。`verify.mjs --log` 是附加寫入本地 md，
  重跑會多一段紀錄——這是刻意的（紀錄本來就要留每一次），不是資料重複。

使用者確認：✅ 已確認（四題選擇即為計畫確認）

## 步驟 4 實作　[auto]

- ✅ 語法檢查　`node --check`（4 檔）
- ✅ Lint　`npm run lint`

人工確認：

- 改的是 `dist/` 不是 `src/`：**不適用**，本次全是新增的流程工具（`scripts/`、`.claude/`、`docs/`、`test/`），
  沒有動到執行碼。
- 錯誤訊息有寫怎麼修正：✅ `loadGates` 找不到檔案／JSON 壞掉／階段不完整、`resolveStages` 認不得階段，
  四種錯誤都帶「修正：」指引；每個階段另有 `fixHint`，未通過時會印出來。

## 步驟 5 測試　[both]

- ✅ `npm test`（35 支，含新增的 `test/agentic-verify.test.js` 11 項）
- ⏭ `npm run smoke:pg`：本次未碰資料庫，依 `when: db` 規則自動略過

人工確認：

- 有新增對應 smoke test：✅ `test/agentic-verify.test.js`。
- 會因舊行為而失敗：✅ 這些是新工具的行為測試，工具不存在時整組 import 就失敗；
  另外實測過「紅」的路徑——沒裝 node_modules 時 `verify -- impl test` 確實判 `❌ 自動閘門未通過`，
  不是永遠綠的裝飾品。
- 冪等性有被測到：**不適用**（不寫業務資料）。

其他實測（不在自動閘門內，人工跑過）：

| 情境 | 結果 |
|------|------|
| `verify -- --list` | 七步與各自檢查項全列出 |
| `verify -- impl test` 於無 node_modules | ❌ 正確判紅並印出 fixHint |
| `verify -- impl` 於有 node_modules | ✅ 全綠 |
| PostToolUse hook：壞檔 | 輸出 systemMessage 警告，exit 0 |
| PostToolUse hook：好檔／非 JS／壞輸入 | 靜默、exit 0、不拋例外 |
| Stop hook：有 JS 變更 | 補跑步驟 4 並提醒 5/6/7，exit 0 |

## 步驟 6 自我審查　[human]

- 交易原子性／冪等性／稽核軌跡：不適用（無資料寫入）。留檔本身即為本流程的稽核軌跡。
- 錯誤訊息可修正：✅ 見步驟 4。
- 沒有多餘抽象層（守則 1）：✅ 閘門就是一份 JSON ＋ 一支 260 行腳本，沒有 plugin 機制、沒有 DSL。
  `builtin` 只有 `node-check` 一種，其餘一律是 shell 指令。
- UI 元件規範：不適用（無頁面改動）。
- diff 無無關夾帶：✅ 除 `package.json` 加一行 `verify` script 外，全為新增檔案。

## 步驟 7 交付　[both]

- commit：見下方 PR
- PR：draft
- Cloud Build：本次僅新增流程工具與文件，`npm run lint` / `npm test` 兩道既有閘門本地已全綠

---

<!-- 以下為 verify.mjs --log 自動附加區 -->

## 驗證紀錄 2026-07-31 01:34

### 步驟 4 實作　通過
- ✅ 語法檢查（`node --check（4 檔）`）
- ✅ Lint（eslint 正確性規則）（`npm run lint`）
- ☐ dist/ 是實際執行碼，確認改的是 dist/ 而不是 src/
- ☐ 錯誤訊息有寫「怎麼修正」，不是只說格式錯誤

### 步驟 5 測試　通過
- ✅ 單元／不變式測試（`npm test`）
- ⏭ Postgres 冒煙（本次改動碰到 DB 才跑）（`npm run smoke:pg`）：本次改動未碰到資料庫，略過
- ☐ 本次改動有新增對應的 smoke test（守則 6），不是只靠既有測試全綠
- ☐ 新測試確實會因為「改動前的舊行為」而失敗（不是恆真測試）
- ☐ 冪等性有被測到：同一筆輸入重跑兩次不產生重複資料

