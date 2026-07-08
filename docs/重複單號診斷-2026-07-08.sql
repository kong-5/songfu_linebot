-- ============================================================
-- 重複訂單號 診斷（2026-07-08）— Supabase SQL Editor 執行
-- ------------------------------------------------------------
-- 背景：舊「先讀後寫」取號在並發時撞號，orders.order_no 有 7 組重複（3-5月）。
--       這批重複讓 G13 唯一索引 ux_orders_order_no 無法建立。
--       新的「原子取號」(upsert+RETURNING) 已從源頭防止未來重複，故此為歷史清理、不急。
-- ⚠️ 改單號會影響對帳（凌越/紙本可能引用該號）→ 先看清楚，決定「哪張保留原號」再改。
-- ============================================================

-- ========== 診斷 1：列出所有重複群組與各自明細（唯讀）==========
WITH dups AS (
  SELECT order_no FROM orders
  WHERE order_no IS NOT NULL AND order_no <> ''
  GROUP BY order_no HAVING COUNT(*) > 1
)
SELECT o.order_no AS 單號, o.id AS 訂單id, o.order_date AS 出貨日, o.status AS 狀態,
       c.name AS 客戶, o.updated_at AS 更新時間,
       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.voided_at IS NULL) AS 有效品項數,
       o.lingyue_doc_no AS 凌越單號
FROM orders o
JOIN dups d ON d.order_no = o.order_no
LEFT JOIN customers c ON c.id = o.customer_id
ORDER BY o.order_no, o.updated_at;

-- 逐組看：通常「保留原號」給較早/已轉凌越/已對帳那張；另一張改新號。
-- 決定好後再跟 Claude 說每組要怎麼分，我再寫精準的改號 SQL（會避開該日已用過的號）。

-- ========== 診斷 2（可選）：確認改完後索引可否建立 ==========
-- 清乾淨後（重複數為 0）下次服務啟動會自動建 ux_orders_order_no；也可手動：
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_order_no ON orders(order_no) WHERE order_no IS NOT NULL;
-- （若仍有重複會報錯，代表還沒清完）
