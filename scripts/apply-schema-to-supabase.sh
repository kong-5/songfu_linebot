#!/usr/bin/env bash
# 僅把 dist/db/schema.pg.sql 套到 Supabase（本機需有 psql）
# 若已由 Cloud Run 啟動自動建表，可略過此步驟。
# 使用： export TARGET='postgresql://...@xxx.pooler.supabase.com:6543/postgres?sslmode=require'
#       ./scripts/apply-schema-to-supabase.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="${ROOT}/dist/db/schema.pg.sql"

if [[ -z "${TARGET:-}" ]]; then
  echo "請設定 TARGET=你的 Supabase Pooling URI（含密碼）"
  exit 1
fi
if [[ ! -f "$SQL_FILE" ]]; then
  echo "找不到 $SQL_FILE"
  exit 1
fi

echo "==> 套用 schema 到 Supabase..."
psql "$TARGET" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "==> 完成。"
