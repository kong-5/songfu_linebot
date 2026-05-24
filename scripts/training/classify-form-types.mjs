#!/usr/bin/env node
/**
 * 對每個客戶的 1 張代表圖跑 OCR，依表頭/欄位特徵分類 form type。
 *
 * 已知 signatures（會持續擴充）：
 *   - 龍港勾選表：含「龍港」+「叫貨日期」
 *   - 松富 HACCP 表：含「松富」+「HACCP」/「089-359188」
 *   - 湯蒸火鍋表：含「客戶：湯蒸火鍋」
 *   - 娜路彎 ERP：含「彙總採購單」+「HTR」
 *   - 自由手寫：找不到上述 + 文字稀疏（< 100 chars）
 *
 * 用法：node scripts/training/classify-form-types.mjs [--limit=N]
 */
import 'dotenv/config';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { connectPg } from '../lib/pg-connect.mjs';

const LIMIT = Number(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1] || 0) || null;
const REFERER = 'https://songfu-line-bot-238580214385.asia-east1.run.app/';

let VISION_KEY;
try {
  VISION_KEY = execSync('gcloud secrets versions access latest --secret=songfu-line-vision-api-key --project=handy-implement-457807-u0', {encoding:'utf8'}).trim();
} catch(_){ VISION_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY; }

async function ocr(buffer) {
  const r = await fetch('https://vision.googleapis.com/v1/images:annotate?key='+encodeURIComponent(VISION_KEY), {
    method:'POST', headers:{'content-type':'application/json','referer':REFERER},
    body: JSON.stringify({requests:[{image:{content:buffer.toString('base64')}, features:[{type:'DOCUMENT_TEXT_DETECTION'}]}]})
  });
  if (!r.ok) throw new Error(r.status);
  const d = await r.json();
  return d.responses[0].fullTextAnnotation?.text || '';
}

function classifyForm(text) {
  const t = text || '';
  const features = [];

  // 確定型 signatures
  if (/客戶[：:]\s*湯蒸火鍋|湯蒸火鍋/.test(t) && /送達日期|其他品項/.test(t))
    features.push('FORM_湯蒸火鍋');
  if (/龍港/.test(t) && /(叫貨日期|品項.*數量.*品項)/.test(t))
    features.push('FORM_龍港勾選表');
  if (/(松富.*關係企業|HACCP)/.test(t) && /(089[-]?(359188|225178|229178))/.test(t))
    features.push('FORM_松富HACCP');
  if (/(彙總採購單|HTR\d+)/.test(t))
    features.push('FORM_娜路彎ERP');
  if (/採購單號.*料號.*品名/.test(t))
    features.push('FORM_客戶ERP採購單');

  // 通用偵測
  const hasGridHeaders = /品項.*數量.*品項.*數量/.test(t.replace(/\s/g,''));
  if (hasGridHeaders) features.push('LIKELY_勾選表');

  const len = t.replace(/\s/g,'').length;
  if (features.length === 0) {
    if (len < 80) features.push('SPARSE_可能空白或非單');
    else if (len > 300) features.push('LONG_TEXT_可能列表手寫');
    else features.push('MID_TEXT_自由手寫候選');
  }
  return { features, textLen: len, snippet: t.replace(/\s+/g,' ').slice(0, 80) };
}

async function main() {
  const pool = await connectPg();
  // 每客戶 1 張：取最新一張 active 的；若無 active 就拿任一張 (suspect 也 OK 因為我們只看圖)
  const r = await pool.query(`
    WITH ranked AS (
      SELECT coe.image_path, coe.is_active, c.name as cust_name, c.id as cust_id,
        ROW_NUMBER() OVER (PARTITION BY coe.customer_id ORDER BY coe.is_active DESC, coe.created_at DESC) as rn
      FROM customer_order_image_examples coe JOIN customers c ON c.id = coe.customer_id
      WHERE coe.note LIKE 'bulk-import%' OR coe.is_active = 1
    )
    SELECT image_path, cust_name, cust_id, is_active FROM ranked WHERE rn = 1
    ORDER BY cust_name
    ${LIMIT?'LIMIT '+LIMIT:''}
  `);
  console.log(`掃 ${r.rowCount} 個客戶各 1 張...`);

  const results = [];
  const summary = {};
  for (let i=0;i<r.rows.length;i++) {
    const x = r.rows[i];
    try {
      const buf = await fs.readFile(x.image_path);
      const text = await ocr(buf);
      const c = classifyForm(text);
      results.push({customer: x.cust_name, image: x.image_path, ...c});
      const tag = c.features.join('+');
      summary[tag] = (summary[tag] || 0) + 1;
      console.log(`[${i+1}] ${x.cust_name?.slice(0,18).padEnd(18)} → ${tag}  (textLen=${c.textLen})`);
    } catch (e) {
      console.log(`[${i+1}] ${x.cust_name} ERR ${e.message}`);
    }
    await new Promise(r=>setTimeout(r, 100));
  }
  await pool.end();
  await fs.writeFile('data/form-classification.json', JSON.stringify({summary, results}, null, 2));
  console.log('\n=== 分類統計 ===');
  Object.entries(summary).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k.padEnd(35)} ${v}`));
  console.log(`\n詳細 → data/form-classification.json`);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
