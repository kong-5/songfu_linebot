#!/usr/bin/env bash
# 完整部署：建置 → 推送 → 部署到 Cloud Run（含 .env 變數）
# - 優先：.env 內 DATABASE_URL（Supabase Pooler :6543 或外部 Postgres）
# - 否則：INSTANCE + DB_PASS（Unix socket 連 Cloud SQL）
# 在 songfu_linebot 目錄執行： bash scripts/deploy-with-cloudsql.sh

set -e
echo "--- Cloud Run 部署（Supabase / Cloud SQL）---"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
if [ ! -f "package.json" ] || [ ! -d "dist" ] || [ ! -f "Dockerfile" ]; then
  echo "錯誤：找不到 songfu_linebot 專案檔（package.json / dist / Dockerfile）。"
  echo "請從本腳本所在專案執行：bash scripts/deploy-with-cloudsql.sh"
  echo "目前 ROOT=$ROOT"
  exit 1
fi

# 載入 .env（若存在）
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
  echo "已載入 .env"
fi

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-asia-east1}"
REPO="${REPO:-linebot}"
IMAGE="${IMAGE:-linebot}"
SERVICE="${SERVICE:-songfu-line-bot}"

if [ -z "$PROJECT_ID" ]; then
  echo "錯誤：請先設定 GCP 專案： gcloud config set project 你的專案ID"
  exit 1
fi

echo "專案: $PROJECT_ID  地區: $REGION  服務: $SERVICE"
echo ""

# Apple Silicon 預設為 arm64；Cloud Run 需 amd64，務必指定平台
# 使用絕對路徑作為 context，避免在錯誤工作目錄執行時出現 path not found
echo "[1/3] 建置 Docker 映像（linux/amd64，Cloud Run 用）..."
echo "    context: $ROOT"
docker build --platform linux/amd64 \
  -f "${ROOT}/Dockerfile" \
  -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest" \
  "${ROOT}"

echo ""
echo "[2/3] 推送映像..."
docker push "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest"

echo ""
echo "[3/3] 部署到 Cloud Run..."

# 基本環境變數（從 .env；勿設 PORT，Cloud Run 會自動注入並禁止手動設定）
ENV_VARS=""
[ -n "$LINE_CHANNEL_ACCESS_TOKEN" ] && ENV_VARS="${ENV_VARS}LINE_CHANNEL_ACCESS_TOKEN=${LINE_CHANNEL_ACCESS_TOKEN}"
[ -n "$LINE_CHANNEL_SECRET" ]       && ENV_VARS="${ENV_VARS:+$ENV_VARS,}LINE_CHANNEL_SECRET=${LINE_CHANNEL_SECRET}"
[ -n "$GOOGLE_CLOUD_VISION_API_KEY" ] && ENV_VARS="${ENV_VARS:+$ENV_VARS,}GOOGLE_CLOUD_VISION_API_KEY=${GOOGLE_CLOUD_VISION_API_KEY}"
[ -n "$LINE_WEBHOOK_PATH" ]        && ENV_VARS="${ENV_VARS:+$ENV_VARS,}LINE_WEBHOOK_PATH=${LINE_WEBHOOK_PATH}"

# 資料庫：優先使用 .env 的 DATABASE_URL（Supabase Pooler / 外部 Postgres）
# 否則使用 Cloud SQL（INSTANCE + DB_PASS）
if [ -n "${DATABASE_URL:-}" ]; then
  ENV_VARS="${ENV_VARS:+$ENV_VARS,}DATABASE_URL=${DATABASE_URL}"
  ADD_CLOUDSQL=""
  echo "已設定 DATABASE_URL（Supabase 或外部 Postgres，未掛 Cloud SQL socket）"
elif [ -n "$INSTANCE" ] && [ -n "$DB_PASS" ]; then
  DB_NAME="${DB_NAME:-songfu}"
  DB_USER="${DB_USER:-postgres}"
  DB_PASS_ENC=$(printf '%s' "$DB_PASS" | sed 's/%/%25/g; s/@/%40/g; s/#/%23/g; s/:/%3A/g')
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASS_ENC}@/${DB_NAME}?host=/cloudsql/${INSTANCE}"
  ENV_VARS="${ENV_VARS:+$ENV_VARS,}DATABASE_URL=${DATABASE_URL}"
  echo "已設定 Cloud SQL 連線：$INSTANCE"
  ADD_CLOUDSQL="--add-cloudsql-instances=${INSTANCE}"
else
  echo "未設定 DATABASE_URL 或 INSTANCE/DB_PASS，將使用 SQLite（Cloud Run 上不建議）。"
  ADD_CLOUDSQL=""
fi

# 使用 --update-env-vars 合併變數，避免覆寫 Cloud Run 上已有但未寫入本機 .env 的 LINE_* 等
DEPLOY_EXTRA=()
[ -n "$ENV_VARS" ] && DEPLOY_EXTRA+=(--update-env-vars "$ENV_VARS")

if [ -n "$ADD_CLOUDSQL" ]; then
  gcloud run deploy "$SERVICE" \
    --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    "${DEPLOY_EXTRA[@]}" \
    $ADD_CLOUDSQL
else
  gcloud run deploy "$SERVICE" \
    --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    "${DEPLOY_EXTRA[@]}"
fi

echo ""
echo "--- 部署完成 ---"
