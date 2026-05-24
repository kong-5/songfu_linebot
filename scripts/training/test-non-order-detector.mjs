#!/usr/bin/env node
/**
 * 對 data/form-classification-v2.json 裡的所有客戶代表圖，跑 detectNonOrderImage，
 * 報告：應該被擋下的 vs 應該繼續解析的。
 *
 * 用 OCR 文字測（不重新 OCR）— 因為 form-classification-v2.json 已存表頭，但不夠完整。
 * 所以這份是直接用 v2 結果的 head 欄做近似測試。要完整測試，看 --full 模式重新 OCR。
 */
import 'dotenv/config';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { detectNonOrderImage } from '../../dist/lib/non-order-image-detector.js';

const FULL = process.argv.includes('--full');
const REFERER = 'https://songfu-line-bot-238580214385.asia-east1.run.app/';

let VISION_KEY;
try { VISION_KEY = execSync('gcloud secrets versions access latest --secret=songfu-line-vision-api-key --project=handy-implement-457807-u0', {encoding:'utf8'}).trim(); }
catch(_){ VISION_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY; }

async function ocr(buffer) {
  const r = await fetch('https://vision.googleapis.com/v1/images:annotate?key='+encodeURIComponent(VISION_KEY), {
    method:'POST', headers:{'content-type':'application/json','referer':REFERER},
    body: JSON.stringify({requests:[{image:{content:buffer.toString('base64')}, features:[{type:'DOCUMENT_TEXT_DETECTION'}]}]})
  });
  if (!r.ok) throw new Error('http '+r.status);
  const d = await r.json();
  return d.responses[0].fullTextAnnotation?.text || '';
}

const v2 = JSON.parse(await fs.readFile('data/form-classification-v2.json', 'utf8'));

let detected = 0, kept = 0, errors = 0;
const detectedList = [], keptSamplesForReview = [];

for (const c of v2) {
  for (const s of c.samples) {
    if (s.err) { errors++; continue; }
    let textForCheck = s.head || '';
    if (FULL && s.path) {
      try {
        const buf = await fs.readFile(s.path);
        textForCheck = await ocr(buf);
        await new Promise(r=>setTimeout(r, 80));
      } catch (e) { errors++; continue; }
    }
    const result = detectNonOrderImage(textForCheck);
    if (result) {
      detected++;
      detectedList.push({ cust: c.cust, reason: result.reason, signals: result.signals.slice(0,3), path: s.path });
    } else {
      kept++;
      keptSamplesForReview.push({ cust: c.cust, headSnippet: (textForCheck||'').slice(0,80) });
    }
  }
}

console.log(`=== 測試結果 (${FULL?'FULL OCR':'用 v2 head'}) ===`);
console.log(`偵測為非訂單早退: ${detected}`);
console.log(`繼續解析:        ${kept}`);
console.log(`錯誤:           ${errors}`);

console.log('\n=== 被擋下的（前 15）===');
detectedList.slice(0,15).forEach(x => console.log(`  ${x.cust.slice(0,15).padEnd(15)} ${x.reason.padEnd(22)} [${x.signals.join(',')}]`));

console.log('\n=== 仍會繼續解析的（前 15 樣本）===');
keptSamplesForReview.slice(0,15).forEach(x => console.log(`  ${x.cust.slice(0,15).padEnd(15)} ${x.headSnippet}`));
