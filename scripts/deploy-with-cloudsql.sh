#!/usr/bin/env bash
# 完整部署：建置 → 推送 → 部署到 Cloud Run（含 .env 變數，可選 Cloud SQL）
# 在 songfu_linebot 目錄執行： bash scripts/deploy-with-cloudsql.sh

set -e
echo "--- 完整部署腳本（含 Cloud SQL 選項）---"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ ! -f "package.json" ] || [ ! -d "dist" ]; then
  echo "錯誤：請在 songfu_linebot 目錄下執行。"
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

echo "[1/3] 建置 Docker 映像..."
docker build -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest" .

echo ""
echo "[2/3] 推送映像..."
docker push "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest"

echo ""
echo "[3/3] 部署到 Cloud Run..."

# 基本環境變數（從 .env 或預設）
ENV_VARS="PORT=8080"
[ -n "$LINE_CHANNEL_ACCESS_TOKEN" ] && ENV_VARS="${ENV_VARS},LINE_CHANNEL_ACCESS_TOKEN=${LINE_CHANNEL_ACCESS_TOKEN}"
[ -n "$LINE_CHANNEL_SECRET" ]       && ENV_VARS="${ENV_VARS},LINE_CHANNEL_SECRET=${LINE_CHANNEL_SECRET}"
[ -n "$GOOGLE_CLOUD_VISION_API_KEY" ] && ENV_VARS="${ENV_VARS},GOOGLE_CLOUD_VISION_API_KEY=${GOOGLE_CLOUD_VISION_API_KEY}"
[ -n "$LINE_WEBHOOK_PATH" ]        && ENV_VARS="${ENV_VARS},LINE_WEBHOOK_PATH=${LINE_WEBHOOK_PATH}"

# 若有 Cloud SQL 設定，加上 DATABASE_URL 與連線
if [ -n "$INSTANCE" ] && [ -n "$DB_PASS" ]; then
  DB_NAME="${DB_NAME:-songfu}"
  DB_USER="${DB_USER:-postgres}"
  DB_PASS_ENC=$(printf '%s' "$DB_PASS" | sed 's/%/%25/g; s/@/%40/g; s/#/%23/g; s/:/%3A/g')
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASS_ENC}@/${DB_NAME}?host=/cloudsql/${INSTANCE}"
  ENV_VARS="${ENV_VARS},DATABASE_URL=${DATABASE_URL}"
  echo "已設定 Cloud SQL 連線：$INSTANCE"
  ADD_CLOUDSQL="--add-cloudsql-instances=${INSTANCE}"
else
  echo "未設定 INSTANCE 或 DB_PASS，將使用 SQLite。"
  ADD_CLOUDSQL=""
fi

if [ -n "$ADD_CLOUDSQL" ]; then
  gcloud run deploy "$SERVICE" \
    --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "$ENV_VARS" \
    $ADD_CLOUDSQL
else
  gcloud run deploy "$SERVICE" \
    --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "$ENV_VARS"
fi

echo ""
echo "--- 部署完成 ---"
