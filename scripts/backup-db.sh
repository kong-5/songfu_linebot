#!/usr/bin/env bash
# 將 SQLite 資料庫複製到 data/backups/（僅本機／未設定 DATABASE_URL 時有效）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STAMP="$(date +%Y%m%d-%H%M%S)"
if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "已設定 DATABASE_URL（PostgreSQL）。請使用雲端自動備份或 pg_dump，或至後台「資料備份」下載 JSON。"
  exit 1
fi
DB="${DB_PATH:-./data/songfu.db}"
if [[ ! -f "$DB" ]]; then
  echo "找不到 SQLite 檔案: $DB"
  exit 1
fi
OUT_DIR="${BACKUP_DIR:-./data/backups}"
mkdir -p "$OUT_DIR"
cp "$DB" "$OUT_DIR/songfu-${STAMP}.db"
echo "已複製至 $OUT_DIR/songfu-${STAMP}.db"
