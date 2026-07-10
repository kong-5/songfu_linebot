#!/usr/bin/env node
"use strict";
/**
 * 從 dist/admin/assets/logo.svg 產生「加到手機主畫面」用的 PNG 圖示：
 *   app-icon-180.png（iOS apple-touch-icon）、app-icon-192.png、app-icon-512.png（Android/manifest）。
 * 白底＋約 12% 留白（iOS 對透明底 PNG 會自動補黑底，故一律鋪白底）。
 * 產出直接放 dist/admin/assets/（公開靜態路徑），改 logo 後重跑本腳本再 commit 即可。
 * 用法：node scripts/generate-app-icons.js
 */
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const ASSETS_DIR = path.join(__dirname, "..", "dist", "admin", "assets");
const LOGO_SVG = path.join(ASSETS_DIR, "logo.svg");
const SIZES = [180, 192, 512];

async function main() {
    const svg = fs.readFileSync(LOGO_SVG);
    for (const size of SIZES) {
        const inner = Math.round(size * 0.76); // 四周留白約 12%
        const logo = await sharp(svg, { density: 300 })
            .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toBuffer();
        const out = path.join(ASSETS_DIR, `app-icon-${size}.png`);
        await sharp({
            create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
        })
            .composite([{ input: logo, gravity: "center" }])
            .png()
            .toFile(out);
        console.log("已產生", out);
    }
}

main().catch((e) => {
    console.error("產生圖示失敗:", e?.message || e);
    process.exit(1);
});
