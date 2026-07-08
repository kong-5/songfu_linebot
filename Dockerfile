# 使用 Node 20 LTS
FROM node:20-slim

WORKDIR /app

# 中日韓字型：報價單 JPG／公告圖以 sharp 渲染含中文的 SVG，
# node:20-slim 預設無 CJK 字型會變成豆腐框，需安裝 Noto CJK。
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 只複製依賴相關檔案，先裝依賴（利用快取）
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# 複製編譯好的程式（dist 與 schema 等）
COPY dist ./dist

# Cloud Run 會設定 PORT
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]
