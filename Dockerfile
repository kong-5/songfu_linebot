# 使用 Node 20 LTS
FROM node:20-slim

WORKDIR /app

# 只複製依賴相關檔案，先裝依賴（利用快取）
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# 複製編譯好的程式（dist 與 schema 等）
COPY dist ./dist

# Cloud Run 會設定 PORT
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]
