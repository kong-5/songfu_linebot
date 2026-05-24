#!/usr/bin/env node
/**
 * V2: 每客戶多掃 3 張、容錯找不到圖、印 OCR 表頭原文供 cluster
 */
import 'dotenv/config';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { connectPg } from '../lib/pg-connect.mjs';

const SAMPLES_PER_CUST = 3;
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

/** Take first N "lines" of OCR text — usually the header */
function topLines(text, n=5) {
  return text.split(/\n+/).map(s=>s.trim()).filter(Boolean).slice(0, n).join(' | ');
}

async function main() {
  const pool = await connectPg();
  const r = await pool.query(`
    WITH have AS (
      SELECT coe.id, coe.image_path, coe.customer_id, c.name, coe.created_at,
        ROW_NUMBER() OVER (PARTITION BY coe.customer_id ORDER BY coe.created_at DESC) as rn
      FROM customer_order_image_examples coe JOIN customers c ON c.id = coe.customer_id
    )
    SELECT * FROM have WHERE rn <= $1 ORDER BY name, rn
  `, [SAMPLES_PER_CUST]);
  console.log(`got ${r.rowCount} samples (~${SAMPLES_PER_CUST}/customer)`);

  const byCust = {};
  for (const row of r.rows) {
    (byCust[row.name] ||= []).push(row.image_path);
  }

  const results = [];
  let custIdx = 0;
  for (const [cust, paths] of Object.entries(byCust)) {
    custIdx++;
    const samples = [];
    for (const p of paths) {
      try {
        const buf = await fs.readFile(p);
        const text = await ocr(buf);
        samples.push({ path: p, head: topLines(text, 6), len: text.replace(/\s/g,'').length });
        await new Promise(r=>setTimeout(r, 80));
      } catch (e) {
        samples.push({ path: p, err: e.message.slice(0, 60) });
      }
    }
    results.push({ cust, samples });
    const ok = samples.filter(s=>!s.err);
    if (ok.length === 0) {
      console.log(`[${custIdx}] ${cust.slice(0,18).padEnd(18)} | ALL ERR`);
    } else {
      const head = ok[0].head.slice(0, 70);
      console.log(`[${custIdx}] ${cust.slice(0,18).padEnd(18)} | ${head}`);
    }
  }
  await pool.end();
  await fs.writeFile('data/form-classification-v2.json', JSON.stringify(results, null, 2));
  console.log(`\n詳細 → data/form-classification-v2.json`);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
