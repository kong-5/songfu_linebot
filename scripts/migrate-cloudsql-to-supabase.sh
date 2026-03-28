#!/usr/bin/env bash
# 從 Cloud SQL 匯出 → 匯入 Supabase（需本機已安裝 pg_dump / psql）
# TARGET 請用與 Cloud Run 相同之 Transaction pooler：
#   postgresql://postgres:密碼@db.<ref>.supabase.co:6543/postgres?sslmode=require
# （勿混用 Session pooler 的 postgres.<ref>@aws-0-區域.pooler...）
# 完整步驟見：docs/遷移-CloudSQL-全量至Supabase.md
# 使用方式：
#   export SOURCE='postgresql://user:pass@CLOUDSQL_HOST:5432/dbname'
#   export TARGET='postgresql://postgres:pass@db.xxx.supabase.co:6543/postgres?sslmode=require'
#   ./scripts/migrate-cloudsql-to-supabase.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="${ROOT}/cloudsql_export_data_$(date +%Y%m%d_%H%M%S).sql"

if [[ -z "${SOURCE:-}" || -z "${TARGET:-}" ]]; then
  echo "請設定環境變數 SOURCE（Cloud SQL）與 TARGET（Supabase Pooling URI）"
  echo "範例："
  echo "  export SOURCE='postgresql://...'"
  echo "  export TARGET='postgresql://postgres.xxx:...@xxx.pooler.supabase.com:6543/postgres?sslmode=require'"
  exit 1
fi

echo "==> 匯出資料（僅 data）到 $OUT"
pg_dump "$SOURCE" \
  --data-only \
  --no-owner \
  --no-privileges \
  --column-inserts \
  -f "$OUT"

echo "==> 匯入 Supabase（若失敗請檢查權限或改用手動分段執行）"
psql "$TARGET" -v ON_ERROR_STOP=1 -f "$OUT"

echo "==> 完成。備份檔：$OUT"
echo "    請驗證後台與 LINE 後，再到 GCP 刪除 Cloud SQL 執行個體。"
