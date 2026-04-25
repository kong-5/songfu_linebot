#!/usr/bin/env bash
# 相容舊文件：改為呼叫 Node 部署腳本（讀取完整 .env → gcloud --env-vars-file）
# 在 songfu_linebot 目錄執行： bash scripts/deploy-with-cloudsql.sh
# 或建議： npm run deploy

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
exec node scripts/deploy-cloud-run.mjs "$@"
