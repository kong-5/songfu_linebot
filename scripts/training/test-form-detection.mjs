#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { detectOrderFormTemplate, buildKnownItemsHintForVision } from '../../dist/lib/order-form-templates.js';

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

const stats = {};
const details = [];
for (const c of v2) {
  for (const s of c.samples) {
    if (s.err) continue;
    let text = s.head || '';
    // 用 full OCR 而非 head (head 只有 6 行可能不夠 markers)
    if (s.path) {
      try {
        const buf = await fs.readFile(s.path);
        text = await ocr(buf);
        await new Promise(r=>setTimeout(r, 80));
      } catch(e) { continue; }
    }
    const tpl = detectOrderFormTemplate(text);
    const id = tpl?.id || 'NONE';
    stats[id] = (stats[id] || 0) + 1;
    if (tpl) details.push({ cust: c.cust, tpl: tpl.id });
  }
}

console.log('=== Template 命中統計 ===');
Object.entries(stats).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k.padEnd(40)} ${v}`));

console.log('\n=== 各客戶命中 template 細項（每 cust 第一筆）===');
const seen = new Set();
details.forEach(x => {
  if (seen.has(x.cust)) return;
  seen.add(x.cust);
  console.log(`  ${x.cust.slice(0,18).padEnd(18)} → ${x.tpl}`);
});

// 印一個 hint 範例
const sample = await import('../../dist/lib/order-form-templates.js');
console.log('\n=== 松富 HACCP hint 樣本（傳給 Gemini vision 的）===');
const haccp = { id:'songfu_haccp_order_form_v1', name:'松富 HACCP 勾選訂購單', knownItems:['白蘿蔔','紅蘿蔔','馬鈴薯'] };
console.log(buildKnownItemsHintForVision(haccp));
