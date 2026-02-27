#!/usr/bin/env bash
# 授予 Cloud Build 服務帳號部署 Cloud Run 的權限（解決 step 2 失敗）
# 在 songfu_linebot 目錄執行： bash scripts/fix-cloudbuild-permissions.sh

set -e
PROJECT_ID="${PROJECT_ID:-handy-implement-457807-u0}"

echo "專案: $PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
DEFAULT_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Cloud Build 服務帳號: $CB_SA"
echo ""

echo "[1/2] 授予 Cloud Run 管理員..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin" \
  --condition=None \
  --quiet

echo ""
echo "[2/2] 授予「使用服務帳號」權限（讓 Cloud Build 能以預設帳號部署）..."
gcloud iam service-accounts add-iam-policy-binding "$DEFAULT_SA" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID" \
  --condition=None \
  --quiet

echo ""
echo "--- 完成。請再 push 一次觸發建置。 ---"
