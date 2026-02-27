#!/usr/bin/env bash
# 更新部署：建置映像 → 推送 → 部署 Cloud Run
# 在 songfu_linebot 目錄執行： bash scripts/update-deploy.sh

set -e
echo "--- 更新部署腳本開始 ---"

# 切到專案根目錄（腳本所在目錄的上一層）
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "專案目錄: $ROOT"
if [ ! -f "package.json" ] || [ ! -d "dist" ]; then
  echo "錯誤：請在 songfu_linebot 目錄下執行此腳本。"
  echo "例： cd /path/to/songfu_linebot  然後  bash scripts/update-deploy.sh"
  exit 1
fi

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-asia-east1}"
REPO="${REPO:-linebot}"
IMAGE="${IMAGE:-linebot}"
SERVICE="${SERVICE:-songfu-linebot}"

if [ -z "$PROJECT_ID" ]; then
  echo "錯誤：請先設定 GCP 專案。"
  echo "執行： gcloud config set project 你的專案ID"
  echo "並確認已登入： gcloud auth login"
  exit 1
fi

echo "專案: $PROJECT_ID  地區: $REGION  映像: $IMAGE  服務: $SERVICE"
echo ""
echo "[1/3] 建置 Docker 映像（可能需要一兩分鐘）..."
docker build -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest" .

echo ""
echo "[2/3] 推送映像到 Artifact Registry..."
docker push "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest"

echo ""
echo "[3/3] 部署到 Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest" \
  --region "$REGION"

echo ""
echo "--- 完成 ---"
