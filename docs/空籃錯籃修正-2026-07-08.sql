-- ============================================================
-- 空籃錯籃資料修正（2026-07-08）— 在 Supabase SQL Editor 執行
-- ------------------------------------------------------------
-- 背景：2026-07-07 12:51 起（00303/00304）到 2026-07-08 07:06（00305 上線前），
--       以及 07-08 約 09:44–09:59（00311/00312 那兩版）期間，LINE 進單用「舊 56+路線」公式補空籃，
--       路線 4-9 的號碼籃對錯（路線 1-3 不受影響）。00313（07-08 約 09:59）起已修正。
-- 原理：靠「客戶路線 ↔ 現有號碼籃料號 對不上」精準辨識，只動錯的、不碰正確的單。
-- 對映（號碼籃跳過 4 號）：
--   路線1→C0100057 2→C0100058 3→C0100059 4→(無) 5→C0100060 6→C0100061 7→C0100062 8→C0100063 9→C0100064
--   （四角籃 C0100065 每張都補，正確，不動）
-- 舊公式錯誤：路線4多補C0100060；5-8的號碼籃各多一號(如路線5補成C0100061應為C0100060)；路線9漏補C0100064。
-- 範圍：order_date >= '2026-07-08' 且非作廢/客訴的有效單（過去日期＝已配送，不動）。
-- ============================================================

-- ========== 步驟 0：前置檢查（基準籃品項是否存在）==========
SELECT erp_code, id, name FROM products
WHERE erp_code IN ('C0100060','C0100061','C0100062','C0100063','C0100064','C0100065')
ORDER BY erp_code;
-- 應看到 C0100060..C0100065 各一筆。若少了某個料號，先別跑修正，通知我。


-- ========== 步驟 1：診斷（唯讀，先看有多少、是哪些單）==========
-- 1a. 路線 4-8：現有號碼籃「多一號」的錯單（wrong_code 現有、應改成 correct_code）
WITH route_map(route_line, wrong_code, correct_code) AS (
  VALUES (4,'C0100060', NULL),
         (5,'C0100061','C0100060'),
         (6,'C0100062','C0100061'),
         (7,'C0100063','C0100062'),
         (8,'C0100064','C0100063')
)
SELECT c.route_line AS 路線, p.erp_code AS 現有錯籃,
       COALESCE(rm.correct_code,'(該刪除)') AS 應為,
       o.order_no AS 單號, o.order_date AS 出貨日, c.name AS 客戶, oi.id AS item_id
FROM order_items oi
JOIN orders o    ON o.id = oi.order_id
JOIN customers c ON c.id = o.customer_id
JOIN products p  ON p.id = oi.product_id
JOIN route_map rm ON rm.route_line = c.route_line AND rm.wrong_code = p.erp_code
WHERE o.order_date >= '2026-07-08'
  AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint')
  AND oi.voided_at IS NULL
ORDER BY c.route_line, o.order_no;

-- 1b. 路線 9：有四角籃 C0100065 卻漏了號碼籃 C0100064 的單（要補）
SELECT o.order_no AS 單號, o.order_date AS 出貨日, c.name AS 客戶
FROM orders o JOIN customers c ON c.id = o.customer_id
WHERE c.route_line = 9
  AND o.order_date >= '2026-07-08'
  AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint')
  AND EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id=oi.product_id
              WHERE oi.order_id=o.id AND p.erp_code='C0100065' AND oi.voided_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id=oi.product_id
                  WHERE oi.order_id=o.id AND p.erp_code='C0100064' AND oi.voided_at IS NULL)
ORDER BY o.order_no;

-- 看完 1a / 1b 的筆數與內容合理，再跑步驟 2。


-- ========== 步驟 2：修正（交易包起來，跑完先看筆數再決定 COMMIT/ROLLBACK）==========
BEGIN;

-- 2a. 路線 5-8：把「多一號」的號碼籃改指向正確料號的品項（品名同步更新）
WITH route_map(route_line, wrong_code, correct_code) AS (
  VALUES (5,'C0100061','C0100060'),
         (6,'C0100062','C0100061'),
         (7,'C0100063','C0100062'),
         (8,'C0100064','C0100063')
),
targets AS (
  SELECT oi.id AS item_id, rm.correct_code
  FROM order_items oi
  JOIN orders o    ON o.id = oi.order_id
  JOIN customers c ON c.id = o.customer_id
  JOIN products p  ON p.id = oi.product_id
  JOIN route_map rm ON rm.route_line = c.route_line AND rm.wrong_code = p.erp_code
  WHERE o.order_date >= '2026-07-08'
    AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint')
    AND oi.voided_at IS NULL
    -- 保險：目標正確料號的品項這張單還沒有，才改（避免改成重複）
    AND NOT EXISTS (
      SELECT 1 FROM order_items oi2 JOIN products p2 ON p2.id=oi2.product_id
      WHERE oi2.order_id = oi.order_id AND p2.erp_code = rm.correct_code AND oi2.voided_at IS NULL
    )
)
UPDATE order_items oi
SET product_id = cp.id,
    raw_name   = cp.name
FROM targets t
JOIN products cp ON cp.erp_code = t.correct_code
WHERE oi.id = t.item_id;

-- 2b. 路線 4：刪掉多出來的 C0100060 號碼籃（路線 4 不該有號碼籃）
DELETE FROM order_items oi
USING orders o, customers c, products p
WHERE oi.order_id = o.id AND c.id = o.customer_id AND p.id = oi.product_id
  AND c.route_line = 4 AND p.erp_code = 'C0100060'
  AND o.order_date >= '2026-07-08'
  AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint')
  AND oi.voided_at IS NULL;

-- 2c. 路線 9：補上漏掉的 C0100064 號碼籃（只補「已有四角籃、但沒號碼籃」的有效單）
INSERT INTO order_items (id, order_id, product_id, raw_name, quantity, unit, need_review, include_export, sub_customer)
SELECT 'item_' || replace(gen_random_uuid()::text,'-',''), o.id, p.id, p.name, 0, COALESCE(p.unit,'個'), 0, 1, NULL
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN products  p ON p.erp_code = 'C0100064'
WHERE c.route_line = 9
  AND o.order_date >= '2026-07-08'
  AND COALESCE(LOWER(TRIM(o.status)),'') NOT IN ('deleted','complaint')
  AND EXISTS (SELECT 1 FROM order_items oi JOIN products pp ON pp.id=oi.product_id
              WHERE oi.order_id=o.id AND pp.erp_code='C0100065' AND oi.voided_at IS NULL)
  AND NOT EXISTS (SELECT 1 FROM order_items oi JOIN products pp ON pp.id=oi.product_id
                  WHERE oi.order_id=o.id AND pp.erp_code='C0100064' AND oi.voided_at IS NULL);

-- 看上面三個語句各影響幾列（SQL Editor 會顯示 Rows affected）。
-- 合理就：
COMMIT;
-- 不合理就改成：ROLLBACK;   （什麼都不會變）

-- ========== 步驟 3：修正後複驗（唯讀，應該 0 筆）==========
-- 重跑步驟 1a、1b，都應回 0 筆＝已修乾淨。
