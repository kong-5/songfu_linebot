#!/usr/bin/env bash
# 列出各表 COUNT(*)，用於遷移前後比對（需 psql）
# 使用： ./scripts/verify-table-counts.sh "postgresql://..."
set -euo pipefail
CONN="${1:-}"
if [[ -z "$CONN" ]]; then
  echo "用法: $0 'postgresql://使用者:密碼@主機:埠/資料庫'"
  exit 1
fi

psql "$CONN" -v ON_ERROR_STOP=1 -At <<'SQL'
SELECT
  relname || E'\t' || COALESCE(n_live_tup::text, '?')
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
SQL

echo ""
echo "（上為 relname<TAB>估計列數；若需精確可改查 COUNT(*)）"
