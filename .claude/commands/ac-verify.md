---
description: 跑指定步驟的驗證閘門並逐條回答人工確認清單
argument-hint: [階段 id 或編號，省略=全部] [--db] [--log <檔案>]
allowed-tools: Bash(npm run verify:*), Bash(node scripts/verify.mjs:*), Read, Grep, Glob
---

跑 `npm run verify -- $ARGUMENTS`，然後：

1. 貼出自動檢查結果（失敗的要貼關鍵錯誤輸出，不要只說「失敗」）。
2. 對輸出裡每一條 `☐` 人工確認項，**逐條給出具體答案**——引用實際的檔案行號、helper 名稱、測試名稱來佐證，
   不接受「有做」「應該沒問題」這種回答。做不到的直接標未通過。
3. 結論寫「通過／未通過」；未通過要寫出回到哪一步、補什麼。

階段代號：`spec`(1) `explore`(2) `plan`(3) `impl`(4) `test`(5) `review`(6) `ship`(7)，
或用 `all` 跑全部、`--list` 只看清單。
