#!/usr/bin/env node
/*
 * 盤差改善報告產生器（standalone，不寫進網站）
 * ------------------------------------------------------------------
 * 目的：把「這段期間每天的盤點盤差」算出來，看盤差有沒有隨排查而縮小，
 *       產出一份可直接用瀏覽器打開閱讀的圖表報告（HTML）＋主控台摘要。
 *
 * 盤差口徑與網站「庫存統計圖表」一致：
 *   盤差%  = (實盤 − 系統) / max(|系統|, 1) × 100
 *   實盤    = stocktake_count.counted_qty（已含中價貨；mid_qty 另存不重複加）
 *   系統    = stocktake_count.sys_qty（盤點送出當下凍結的凌越量）
 *   同一天同一料號跨倉／跨場次先加總再算（比照 /stats/heatmap）。
 * headline 用「當下凍結盤差」（counted − sys_qty）＝同事盤那一刻的實際盤差，
 * 這正是排查要縮小的東西；人工調整（stock_adjustment）是事後補償，另列參考欄。
 *
 * 資料來源（擇一，依序判斷）：
 *   1) node scripts/variance-report.js <某份 pg_dump.sql>     ← 吃 Cloud SQL 匯出檔
 *   2) node scripts/variance-report.js <某個 .db/.sqlite>     ← 吃本機 SQLite
 *   3) DATABASE_URL=postgres://... node scripts/variance-report.js   ← 連正式站 Postgres
 *
 * 選項：
 *   --days N        期間天數（預設 14）；或用 --since/--until 指定
 *   --since YYYY-MM-DD  --until YYYY-MM-DD
 *   --icpno all|00|01|02|03   公司（預設 all＝全公司合併看）
 *   --out <path>    輸出 HTML（預設 ./盤差改善報告.html）
 *
 * 例：
 *   node scripts/variance-report.js dump.sql --days 10 --icpno 02
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ── 參數 ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const o = { days: 14, icpno: 'all', out: null, since: null, until: null, srcs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--days') o.days = parseInt(argv[++i], 10) || 14;
    else if (a === '--icpno') o.icpno = String(argv[++i] || 'all').trim();
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--since') o.since = argv[++i];
    else if (a === '--until') o.until = argv[++i];
    else if (a === '--help' || a === '-h') o.help = true;
    else if (!a.startsWith('--')) o.srcs.push(a);
  }
  o.src = o.srcs[0] || null;
  return o;
}

// ── 讀資料：回傳 { sessions, counts, adjustments } ─────────────────
// sessions: [{id, icpno, wh_code, wh_name, count_date}]
// counts:   [{session_id, erp_code, name, spec, unit, sys_qty, counted_qty}]
// adj:      { 'icpno|erp_code': delta }

function normIcpno(v) {
  const s = String(v == null ? '' : v).trim();
  return s === '' ? '00' : s;
}

// ---- pg_dump 解析（支援 INSERT 與 COPY 兩種格式）----
function parseSqlDump(text) {
  const want = {
    stocktake_session: null,
    stocktake_count: null,
    stock_adjustment: null,
  };
  for (const k of Object.keys(want)) want[k] = [];

  // COPY public.table (col1, col2, ...) FROM stdin;  ... \.
  const copyRe = /COPY\s+(?:public\.)?"?(\w+)"?\s*\(([^)]*)\)\s+FROM\s+stdin;\r?\n([\s\S]*?)\r?\n\\\./g;
  let m;
  while ((m = copyRe.exec(text)) !== null) {
    const table = m[1];
    if (!(table in want)) continue;
    const cols = m[2].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const bodyLines = m[3].split(/\r?\n/);
    for (const line of bodyLines) {
      if (line === '') continue;
      const vals = line.split('\t').map(unescapeCopy);
      const row = {};
      cols.forEach((c, i) => { row[c] = vals[i]; });
      want[table].push(row);
    }
  }

  // INSERT INTO public.table (cols) VALUES (...);
  const insRe = /INSERT\s+INTO\s+(?:public\.)?"?(\w+)"?\s*\(([^)]*)\)\s+VALUES\s*/gi;
  while ((m = insRe.exec(text)) !== null) {
    const table = m[1];
    if (!(table in want)) continue;
    const cols = m[2].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    // 從 VALUES 之後解析一個或多個 (...) tuple 直到分號
    let idx = insRe.lastIndex;
    const parsed = parseValuesTuples(text, idx);
    for (const tup of parsed.tuples) {
      const row = {};
      cols.forEach((c, i) => { row[c] = tup[i]; });
      want[table].push(row);
    }
    insRe.lastIndex = parsed.end;
  }

  return normalizeTables(want);
}

function unescapeCopy(v) {
  if (v === '\\N') return null;
  return v.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
}

// 從 pos 起解析 VALUES 後的 tuple 群，回傳 {tuples:[[...]], end}
function parseValuesTuples(text, pos) {
  const tuples = [];
  let i = pos;
  const n = text.length;
  while (i < n) {
    // 略過空白與逗號
    while (i < n && /[\s,]/.test(text[i])) i++;
    if (text[i] === ';') { i++; break; }
    if (text[i] !== '(') break;
    i++; // skip (
    const vals = [];
    let cur = '';
    let inStr = false;
    let started = false;
    while (i < n) {
      const ch = text[i];
      if (inStr) {
        if (ch === "'") {
          if (text[i + 1] === "'") { cur += "'"; i += 2; continue; }
          inStr = false; i++; continue;
        }
        cur += ch; i++; continue;
      }
      if (ch === "'") { inStr = true; started = true; cur = ''; i++; continue; }
      if (ch === ',') { vals.push(finishVal(cur, started)); cur = ''; started = false; i++; continue; }
      if (ch === ')') { vals.push(finishVal(cur, started)); i++; break; }
      cur += ch; started = true; i++;
    }
    tuples.push(vals);
  }
  return { tuples, end: i };
}

function finishVal(raw, wasQuoted) {
  if (wasQuoted) return raw; // 字串（引號內容原樣，已處理 '' 轉義）
  const t = raw.trim();
  if (t === '' ) return null;
  if (/^NULL$/i.test(t)) return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return t; // 數字保留字串，之後 Number()
  return t;
}

function normalizeTables(want) {
  const sessions = want.stocktake_session.map((r) => ({
    id: String(r.id),
    icpno: normIcpno(r.icpno),
    wh_code: r.wh_code == null ? '' : String(r.wh_code),
    wh_name: r.wh_name == null ? '' : String(r.wh_name),
    count_date: r.count_date == null ? '' : String(r.count_date).slice(0, 10),
  }));
  const counts = want.stocktake_count.map((r) => ({
    session_id: String(r.session_id),
    erp_code: r.erp_code == null ? '' : String(r.erp_code).trim(),
    name: r.name == null ? '' : String(r.name),
    spec: r.spec == null ? '' : String(r.spec),
    unit: r.unit == null ? '' : String(r.unit),
    sys_qty: r.sys_qty == null ? null : Number(r.sys_qty),
    counted_qty: r.counted_qty == null ? null : Number(r.counted_qty),
  }));
  const adj = {};
  for (const r of want.stock_adjustment) {
    const key = normIcpno(r.icpno) + '|' + String(r.erp_code || '').trim();
    adj[key] = Number(r.delta || 0);
  }
  return { sessions, counts, adjustments: adj };
}

// ---- SQLite / Postgres 讀取 ----
async function loadFromDb(getRows) {
  const sessions = (await getRows(
    "SELECT id, COALESCE(NULLIF(TRIM(icpno),''),'00') AS icpno, wh_code, wh_name, count_date FROM stocktake_session"
  )).map((r) => ({
    id: String(r.id), icpno: normIcpno(r.icpno),
    wh_code: r.wh_code == null ? '' : String(r.wh_code),
    wh_name: r.wh_name == null ? '' : String(r.wh_name),
    count_date: r.count_date == null ? '' : String(r.count_date).slice(0, 10),
  }));
  const counts = (await getRows(
    "SELECT session_id, erp_code, name, spec, unit, sys_qty, counted_qty FROM stocktake_count"
  )).map((r) => ({
    session_id: String(r.session_id),
    erp_code: r.erp_code == null ? '' : String(r.erp_code).trim(),
    name: r.name == null ? '' : String(r.name),
    spec: r.spec == null ? '' : String(r.spec),
    unit: r.unit == null ? '' : String(r.unit),
    sys_qty: r.sys_qty == null ? null : Number(r.sys_qty),
    counted_qty: r.counted_qty == null ? null : Number(r.counted_qty),
  }));
  let adjRows = [];
  try { adjRows = await getRows("SELECT icpno, erp_code, delta FROM stock_adjustment"); }
  catch (_) { adjRows = []; }
  const adj = {};
  for (const r of adjRows) adj[normIcpno(r.icpno) + '|' + String(r.erp_code || '').trim()] = Number(r.delta || 0);
  return { sessions, counts, adjustments: adj };
}

// ---- 後台每日盤點 CSV（stocktake-YYYY-MM-DD.csv）解析 ----
// 表頭：日期,倉別,倉名,料號,品名,規格,單位,系統量(盤點當下),實盤量(含中),其中中貨,盤差(對當下),...
function parseCsvText(text) {
  const rows = csvRows(text);
  if (!rows.length) return { sessions: [], counts: [] };
  const header = rows[0].map((h) => h.trim());
  const col = (name) => header.indexOf(name);
  const iDate = col('日期'), iWh = col('倉別'), iWhN = col('倉名'), iCode = col('料號'),
    iName = col('品名'), iSpec = col('規格'), iUnit = col('單位'),
    iSys = col('系統量(盤點當下)'), iCounted = col('實盤量(含中)');
  if (iDate < 0 || iSys < 0 || iCounted < 0 || iCode < 0) return { sessions: [], counts: [] };
  const sessions = new Map(); // date|wh -> session
  const counts = [];
  for (let r = 1; r < rows.length; r++) {
    const f = rows[r];
    if (!f || f.length <= iCounted) continue;
    const date = String(f[iDate] || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const wh = String(f[iWh] || '').trim();
    const sid = date + '|' + wh;
    if (!sessions.has(sid)) sessions.set(sid, { id: sid, icpno: '00', wh_code: wh, wh_name: String(f[iWhN] || '').trim(), count_date: date });
    const countedRaw = String(f[iCounted] == null ? '' : f[iCounted]).trim();
    counts.push({
      session_id: sid,
      erp_code: String(f[iCode] || '').trim(),
      name: iName >= 0 ? String(f[iName] || '') : '',
      spec: iSpec >= 0 ? String(f[iSpec] || '') : '',
      unit: iUnit >= 0 ? String(f[iUnit] || '') : '',
      sys_qty: numOrNull(f[iSys]),
      counted_qty: countedRaw === '' ? null : numOrNull(f[iCounted]),
    });
  }
  return { sessions: [...sessions.values()], counts };
}
function numOrNull(v) { const s = String(v == null ? '' : v).trim(); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; }
// 解析 CSV（支援雙引號包欄、"" 轉義、\r\n）→ 二維陣列
function csvRows(text) {
  text = text.replace(/^﻿/, '');
  const out = []; let row = []; let cur = ''; let inq = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inq) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inq = false; }
      else cur += c;
    } else {
      if (c === '"') inq = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); out.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); out.push(row); }
  return out;
}

async function loadData(opt) {
  const srcs = opt.srcs || [];
  if (!srcs.length && process.env.DATABASE_URL) {
    const { Pool } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const getRows = async (sql) => (await pool.query(sql)).rows;
    const data = await loadFromDb(getRows);
    await pool.end();
    return { data, srcLabel: 'Postgres (DATABASE_URL)' };
  }
  if (!srcs.length) throw new Error('未提供資料來源：請給後台每日盤點匯出的 CSV（可多份）、一份 pg_dump .sql、一個 .db/.sqlite 檔，或設 DATABASE_URL 環境變數。');
  for (const s of srcs) { const a = path.resolve(s); if (!fs.existsSync(a)) throw new Error('找不到檔案：' + a); }

  // 多份或副檔名為 .csv → 當成後台盤點 CSV 合併
  const allCsv = srcs.every((s) => /\.csv$/i.test(s));
  if (allCsv || srcs.length > 1) {
    const sessions = []; const counts = [];
    for (const s of srcs) {
      const parsed = parseCsvText(fs.readFileSync(path.resolve(s), 'utf8'));
      sessions.push(...parsed.sessions); counts.push(...parsed.counts);
    }
    return { data: { sessions, counts, adjustments: {} }, srcLabel: `後台盤點 CSV × ${srcs.length} 份` };
  }

  const abs = path.resolve(srcs[0]);
  if (/\.sql$/i.test(abs) || isSqlText(abs)) {
    const text = fs.readFileSync(abs, 'utf8');
    return { data: parseSqlDump(text), srcLabel: 'pg_dump 匯出檔 ' + path.basename(abs) };
  }
  // SQLite
  const Database = require(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));
  const db = new Database(abs, { readonly: true });
  const getRows = async (sql) => db.prepare(sql).all();
  const data = await loadFromDb(getRows);
  db.close();
  return { data, srcLabel: 'SQLite ' + path.basename(abs) };
}

function isSqlText(abs) {
  try {
    const fd = fs.openSync(abs, 'r');
    const buf = Buffer.alloc(64); fs.readSync(fd, buf, 0, 64, 0); fs.closeSync(fd);
    return buf.toString('utf8').includes('PostgreSQL') || buf.toString('utf8').startsWith('--');
  } catch (_) { return false; }
}

// ── 指標計算 ──────────────────────────────────────────────────────
function varPct(sys, counted) {
  return Math.round(((counted - sys) / Math.max(Math.abs(sys), 1)) * 1000) / 10;
}
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function computeDaily(data, opt) {
  const { sessions, counts, adjustments } = data;
  const sessById = new Map(sessions.map((s) => [s.id, s]));

  // 期間
  const allDates = [...new Set(sessions.map((s) => s.count_date).filter(Boolean))].sort();
  let since = opt.since, until = opt.until;
  if (!since || !until) {
    const maxD = allDates[allDates.length - 1] || null;
    if (maxD) {
      until = until || maxD;
      const d = new Date(maxD + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - (opt.days - 1));
      since = since || d.toISOString().slice(0, 10);
    }
  }

  // 依 (date) → Map(icpno|code → {sys, counted, name, spec, unit, icpno, code})
  const dayItems = new Map();
  for (const c of counts) {
    if (c.counted_qty == null) continue;
    const s = sessById.get(c.session_id);
    if (!s || !s.count_date) continue;
    if (opt.icpno !== 'all' && s.icpno !== normIcpno(opt.icpno)) continue;
    if (since && s.count_date < since) continue;
    if (until && s.count_date > until) continue;
    if (!c.erp_code) continue;
    let dm = dayItems.get(s.count_date);
    if (!dm) { dm = new Map(); dayItems.set(s.count_date, dm); }
    const key = s.icpno + '|' + c.erp_code;
    let it = dm.get(key);
    if (!it) { it = { icpno: s.icpno, code: c.erp_code, name: c.name, spec: c.spec, unit: c.unit, sys: 0, counted: 0 }; dm.set(key, it); }
    it.sys += Number(c.sys_qty || 0);
    it.counted += Number(c.counted_qty || 0);
  }

  const dates = [...dayItems.keys()].sort();
  const daily = dates.map((d) => {
    const items = [...dayItems.get(d).values()];
    let itemsDiff = 0, itemsSevere = 0, sumAbsDiff = 0, sumBase = 0;
    const absPcts = [];
    for (const it of items) {
      const rawDiff = Math.round((it.counted - it.sys) * 100) / 100;
      const p = varPct(it.sys, it.counted);
      if (rawDiff !== 0) itemsDiff++;
      if (Math.abs(p) > 5) itemsSevere++;
      absPcts.push(Math.abs(p));
      sumAbsDiff += Math.abs(it.counted - it.sys);
      sumBase += Math.max(Math.abs(it.sys), 1);
    }
    const n = items.length;
    return {
      date: d,
      items: n,
      itemsDiff,
      itemsSevere,
      accuracy: n ? Math.round((1 - itemsDiff / n) * 1000) / 10 : 0,
      meanAbsPct: n ? Math.round((absPcts.reduce((a, b) => a + b, 0) / n) * 10) / 10 : 0,
      medianAbsPct: Math.round(median(absPcts) * 10) / 10,
      weightedAbsPct: sumBase ? Math.round((sumAbsDiff / sumBase) * 1000) / 10 : 0,
    };
  });

  return { since, until, daily, icpno: opt.icpno };
}

// 改善率：頭尾各取「有盤點的 K 天」平均，避免單日抖動
function improvement(daily, key, window) {
  const withData = daily.filter((d) => d.items > 0);
  if (withData.length < 2) return null;
  const k = Math.min(window || 3, Math.floor(withData.length / 2)) || 1;
  const head = withData.slice(0, k);
  const tail = withData.slice(-k);
  const avg = (arr) => arr.reduce((a, b) => a + b[key], 0) / arr.length;
  const start = avg(head), end = avg(tail);
  return { start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10, k,
    headDates: [head[0].date, head[head.length - 1].date], tailDates: [tail[0].date, tail[tail.length - 1].date] };
}

// ── 主控台摘要 ────────────────────────────────────────────────────
function printSummary(res, srcLabel) {
  const { since, until, daily, icpno } = res;
  const company = icpno === 'all' ? '全公司' : icpno;
  console.log('\n══════ 盤差改善報告 ══════');
  console.log(`資料來源：${srcLabel}`);
  console.log(`公司：${company}   期間：${since} ~ ${until}   有盤點天數：${daily.filter((d) => d.items > 0).length}`);
  if (!daily.length) { console.log('（此期間查無盤點資料）'); return; }
  const impAcc = improvement(daily, 'accuracy');
  const impMean = improvement(daily, 'meanAbsPct');
  const impW = improvement(daily, 'weightedAbsPct');
  const impSev = improvement(daily, 'itemsSevere');
  const pct = (a, b) => (a === 0 ? '—' : (Math.round(((a - b) / Math.abs(a)) * 1000) / 10) + '%');
  console.log('\n改善（期初平均 → 期末平均，各取頭尾數天）：');
  if (impAcc) console.log(`  盤點準確率        ${impAcc.start}% → ${impAcc.end}%   (提升 ${Math.round((impAcc.end - impAcc.start) * 10) / 10} 個百分點)`);
  if (impMean) console.log(`  平均絕對盤差%     ${impMean.start}% → ${impMean.end}%   (縮小 ${pct(impMean.start, impMean.end)})`);
  if (impW) console.log(`  加權絕對盤差%     ${impW.start}% → ${impW.end}%   (縮小 ${pct(impW.start, impW.end)})`);
  if (impSev) console.log(`  嚴重盤差品項(>5%) ${impSev.start} → ${impSev.end}   (減少 ${pct(impSev.start, impSev.end)})`);
  console.log('\n每日明細：');
  console.log('  日期        已盤  盤差品項  準確率   平均|盤差|%  加權|盤差|%  嚴重(>5%)');
  for (const d of daily) {
    console.log(`  ${d.date}  ${String(d.items).padStart(4)}  ${String(d.itemsDiff).padStart(6)}  ${String(d.accuracy + '%').padStart(6)}  ${String(d.meanAbsPct + '%').padStart(9)}  ${String(d.weightedAbsPct + '%').padStart(9)}  ${String(d.itemsSevere).padStart(6)}`);
  }
  console.log('');
}

// ── HTML 報告 ─────────────────────────────────────────────────────
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function svgLineChart(daily, series, opt) {
  // series: [{key, label, color}]；x = 日期（只取有盤點的天）
  const rows = daily.filter((d) => d.items > 0);
  const W = 720, H = 260, padL = 46, padR = 16, padT = 18, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = rows.length;
  const xs = (i) => n <= 1 ? padL + iw / 2 : padL + (i / (n - 1)) * iw;
  let maxV = 0, minV = 0;
  for (const d of rows) for (const s of series) { const v = d[s.key]; if (v > maxV) maxV = v; if (v < minV) minV = v; }
  if (opt.yMax != null) maxV = opt.yMax;
  const span = (maxV - minV) || 1;
  const ys = (v) => padT + ih - ((v - minV) / span) * ih;
  // 網格 + y 軸刻度（4 格）
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const v = minV + (span * g) / 4;
    const y = ys(v);
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="grid"/>`;
    grid += `<text x="${padL - 8}" y="${(y + 4).toFixed(1)}" class="ytick">${Math.round(v * 10) / 10}${opt.unit || ''}</text>`;
  }
  // x 軸標籤（避免太擠：>8 天時每隔一個標）
  let xlabels = '';
  const step = n > 8 ? Math.ceil(n / 7) : 1;
  rows.forEach((d, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    xlabels += `<text x="${xs(i).toFixed(1)}" y="${H - padB + 18}" class="xtick">${esc(d.date.slice(5))}</text>`;
  });
  // 折線 + 點
  let paths = '';
  for (const s of series) {
    const pts = rows.map((d, i) => `${xs(i).toFixed(1)},${ys(d[s.key]).toFixed(1)}`);
    paths += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    rows.forEach((d, i) => {
      paths += `<circle cx="${xs(i).toFixed(1)}" cy="${ys(d[s.key]).toFixed(1)}" r="3.4" fill="var(--surface-1)" stroke="${s.color}" stroke-width="2"><title>${esc(d.date)}｜${esc(s.label)} ${d[s.key]}${opt.unit || ''}</title></circle>`;
    });
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.aria || '')}">${grid}${paths}${xlabels}</svg>`;
}

function svgBars(daily, opt) {
  const rows = daily.filter((d) => d.items > 0);
  const W = 720, H = 240, padL = 46, padR = 16, padT = 18, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = rows.length;
  const maxV = Math.max(1, ...rows.map((d) => d.items));
  const ys = (v) => padT + ih - (v / maxV) * ih;
  const slot = iw / Math.max(1, n);
  const bw = Math.min(34, slot * 0.62);
  let grid = '';
  for (let g = 0; g <= 4; g++) {
    const v = (maxV * g) / 4; const y = ys(v);
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="grid"/>`;
    grid += `<text x="${padL - 8}" y="${(y + 4).toFixed(1)}" class="ytick">${Math.round(v)}</text>`;
  }
  let bars = '', xlabels = '';
  const step = n > 8 ? Math.ceil(n / 7) : 1;
  rows.forEach((d, i) => {
    const cx = padL + slot * (i + 0.5);
    const yTot = ys(d.items), yDiff = ys(d.itemsDiff);
    bars += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${yTot.toFixed(1)}" width="${bw.toFixed(1)}" height="${(padT + ih - yTot).toFixed(1)}" rx="3" fill="var(--bar-base)"><title>${esc(d.date)}｜已盤 ${d.items} 項</title></rect>`;
    bars += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${yDiff.toFixed(1)}" width="${bw.toFixed(1)}" height="${(padT + ih - yDiff).toFixed(1)}" rx="3" fill="var(--series-diff)"><title>${esc(d.date)}｜盤差 ${d.itemsDiff} 項</title></rect>`;
    if (i % step === 0 || i === n - 1) xlabels += `<text x="${cx.toFixed(1)}" y="${H - padB + 18}" class="xtick">${esc(d.date.slice(5))}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.aria || '')}">${grid}${bars}${xlabels}</svg>`;
}

function kpiTile(label, imp, opt) {
  if (!imp) return '';
  const better = opt.higherBetter ? imp.end >= imp.start : imp.end <= imp.start;
  const deltaRaw = opt.higherBetter ? imp.end - imp.start : imp.start - imp.end;
  const pctChg = imp.start === 0 ? null : Math.round(((imp.start - imp.end) / Math.abs(imp.start)) * 1000) / 10;
  const arrow = better ? '▼' : '▲';
  const cls = better ? 'good' : 'bad';
  let sub;
  if (opt.higherBetter) sub = `${better ? '提升' : '下降'} ${Math.abs(Math.round(deltaRaw * 10) / 10)} 個百分點`;
  else sub = pctChg == null ? '—' : `${pctChg >= 0 ? '縮小' : '增加'} ${Math.abs(pctChg)}%`;
  return `<div class="tile">
    <div class="tile-l">${esc(label)}</div>
    <div class="tile-v">${imp.start}${opt.unit || ''} <span class="tile-arrow ${cls}">→</span> ${imp.end}${opt.unit || ''}</div>
    <div class="tile-d ${cls}">${better ? '↓ 改善' : '↑ 惡化'}　${esc(sub)}</div>
  </div>`;
}

function buildHtml(res, srcLabel, meta) {
  const { since, until, daily, icpno } = res;
  const company = icpno === 'all' ? '全公司' : ('公司代碼 ' + icpno);
  const impAcc = improvement(daily, 'accuracy');
  const impMean = improvement(daily, 'meanAbsPct');
  const impW = improvement(daily, 'weightedAbsPct');
  const impSev = improvement(daily, 'itemsSevere');
  const daysWithData = daily.filter((d) => d.items > 0).length;

  const overallBetter = impMean && impMean.end <= impMean.start;
  const verdict = !impMean ? '資料不足以判斷趨勢'
    : overallBetter ? '盤差有改善 —— 平均盤差幅度縮小、盤點準確率上升'
    : '這段期間盤差未見縮小，建議延長觀察期或檢視盤點流程';

  const rows = daily.map((d) => `<tr${d.items === 0 ? ' class="empty"' : ''}>
      <td class="mono">${esc(d.date)}</td>
      <td class="num">${d.items || '—'}</td>
      <td class="num">${d.items ? d.itemsDiff : '—'}</td>
      <td class="num strong">${d.items ? d.accuracy + '%' : '—'}</td>
      <td class="num">${d.items ? d.meanAbsPct + '%' : '—'}</td>
      <td class="num">${d.items ? d.weightedAbsPct + '%' : '—'}</td>
      <td class="num">${d.items ? d.itemsSevere : '—'}</td>
    </tr>`).join('');

  const chartAcc = svgLineChart(daily, [{ key: 'accuracy', label: '盤點準確率', color: 'var(--good)' }], { unit: '%', yMax: 100, aria: '每日盤點準確率折線圖' });
  const chartPct = svgLineChart(daily, [
    { key: 'meanAbsPct', label: '平均絕對盤差%', color: 'var(--series-1)' },
    { key: 'weightedAbsPct', label: '加權絕對盤差%', color: 'var(--series-2)' },
  ], { unit: '%', aria: '每日盤差幅度折線圖' });
  const chartBars = svgBars(daily, { aria: '每日已盤與盤差品項數' });

  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>松富盤差改善報告 ${esc(since)}~${esc(until)}</title>
<style>
  :root{color-scheme:light;
    --plane:#f9f9f7;--surface-1:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--mut:#898781;
    --grid:#e1e0d9;--base:#c3c2b7;--border:rgba(11,11,11,.10);
    --series-1:#2a78d6;--series-2:#eb6834;--series-diff:#e34948;--bar-base:#c9d3df;
    --good:#0ca30c;--bad:#d03b3b;--good-ink:#006300;}
  @media (prefers-color-scheme:dark){:root{color-scheme:dark;
    --plane:#0d0d0d;--surface-1:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--mut:#898781;
    --grid:#2c2c2a;--base:#383835;--border:rgba(255,255,255,.10);
    --series-1:#3987e5;--series-2:#d95926;--series-diff:#e66767;--bar-base:#33424f;
    --good:#0ca30c;--bad:#e66767;--good-ink:#0ca30c;}}
  *{box-sizing:border-box;}
  body{margin:0;background:var(--plane);color:var(--ink);
    font-family:system-ui,-apple-system,"Segoe UI","PingFang TC","Microsoft JhengHei",sans-serif;
    line-height:1.55;padding:28px 18px 60px;}
  .wrap{max-width:820px;margin:0 auto;}
  h1{font-size:22px;margin:0 0 4px;}
  .sub{color:var(--ink2);font-size:13px;margin:0 0 2px;}
  .meta{color:var(--mut);font-size:12px;margin:0 0 20px;}
  .verdict{background:var(--surface-1);border:1px solid var(--border);border-left:4px solid var(--good);
    border-radius:10px;padding:13px 16px;margin:0 0 22px;font-size:15px;font-weight:600;}
  .verdict.bad{border-left-color:var(--bad);}
  .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:0 0 26px;}
  .tile{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:14px 16px;}
  .tile-l{font-size:12px;color:var(--mut);margin-bottom:6px;}
  .tile-v{font-size:19px;font-weight:700;font-variant-numeric:tabular-nums;}
  .tile-arrow{color:var(--mut);}
  .tile-d{font-size:12px;font-weight:700;margin-top:5px;}
  .tile-d.good{color:var(--good-ink);} .tile-d.bad{color:var(--bad);}
  .card{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin:0 0 20px;}
  .card h2{font-size:14px;margin:0 0 2px;}
  .card p.hint{font-size:12px;color:var(--mut);margin:0 0 10px;}
  .legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--ink2);margin:4px 0 0;}
  .lg{display:inline-flex;align-items:center;gap:6px;}
  .lg .k{width:14px;height:3px;border-radius:2px;} .lg .kb{width:12px;height:12px;border-radius:3px;}
  svg{display:block;width:100%;height:auto;}
  .grid{stroke:var(--grid);stroke-width:1;} .ytick{fill:var(--mut);font-size:10px;text-anchor:end;}
  .xtick{fill:var(--mut);font-size:10px;text-anchor:middle;}
  table{width:100%;border-collapse:collapse;font-size:12.5px;}
  th,td{padding:7px 8px;border-bottom:1px solid var(--grid);text-align:left;}
  th{color:var(--mut);font-weight:600;font-size:11.5px;white-space:nowrap;}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;} td.mono{font-variant-numeric:tabular-nums;}
  td.strong{font-weight:700;} tr.empty td{color:var(--mut);}
  .foot{color:var(--mut);font-size:11.5px;margin-top:24px;line-height:1.7;}
</style></head><body><div class="wrap">
  <h1>松富盤差改善報告</h1>
  <p class="sub">${esc(company)}　${esc(since)} ~ ${esc(until)}　共 ${daysWithData} 個盤點日</p>
  <p class="meta">盤差% =（實盤 − 系統）÷ max(|系統|,1)　·　口徑同網站「庫存統計圖表」　·　資料來源：${esc(srcLabel)}　·　產出：${esc(meta.generatedAt)}</p>

  <div class="verdict${overallBetter ? '' : ' bad'}">${esc(verdict)}</div>

  <div class="tiles">
    ${kpiTile('盤點準確率（盤差=0 品項占比）', impAcc, { unit: '%', higherBetter: true })}
    ${kpiTile('平均絕對盤差%', impMean, { unit: '%', higherBetter: false })}
    ${kpiTile('加權絕對盤差%（依量加權）', impW, { unit: '%', higherBetter: false })}
    ${kpiTile('嚴重盤差品項數（>5%）', impSev, { unit: '', higherBetter: false })}
  </div>

  <div class="card">
    <h2>每日盤點準確率</h2>
    <p class="hint">盤差=0 的品項占當日已盤品項的比例，越高越準。</p>
    ${chartAcc}
    <div class="legend"><span class="lg"><span class="k" style="background:var(--good)"></span>盤點準確率</span></div>
  </div>

  <div class="card">
    <h2>每日盤差幅度</h2>
    <p class="hint">平均＝每品項盤差%取平均；加權＝依庫存量加權（大量品項的盤差影響較大）。兩條都是越低越好。</p>
    ${chartPct}
    <div class="legend">
      <span class="lg"><span class="k" style="background:var(--series-1)"></span>平均絕對盤差%</span>
      <span class="lg"><span class="k" style="background:var(--series-2)"></span>加權絕對盤差%</span>
    </div>
  </div>

  <div class="card">
    <h2>每日盤點量與盤差品項數</h2>
    <p class="hint">灰＝當日已盤品項數；紅＝其中有盤差的品項數。紅占灰的比例越低越好。</p>
    ${chartBars}
    <div class="legend">
      <span class="lg"><span class="kb" style="background:var(--bar-base)"></span>已盤品項</span>
      <span class="lg"><span class="kb" style="background:var(--series-diff)"></span>盤差品項</span>
    </div>
  </div>

  <div class="card">
    <h2>每日明細</h2>
    <table>
      <thead><tr>
        <th>日期</th><th class="num">已盤</th><th class="num">盤差品項</th>
        <th class="num">準確率</th><th class="num">平均|盤差|%</th><th class="num">加權|盤差|%</th><th class="num">嚴重(>5%)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <p class="foot">
    · 改善率取「期初頭幾天平均」對「期末尾幾天平均」，避免單日抖動。<br>
    · 「系統」是盤點送出當下凍結的凌越量；headline 盤差為當下實際盤差，不含事後人工調整（stock_adjustment）。<br>
    · 同一天同料號跨倉／跨場次先加總再計算，與網站熱力圖一致。
  </p>
</div></body></html>`;
}

// ── main ──────────────────────────────────────────────────────────
async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) {
    console.log('用法：node scripts/variance-report.js <每日盤點.csv... | dump.sql | *.db | (DATABASE_URL)> [--days N] [--icpno all|00|01|02|03] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--out path]');
    return;
  }
  const { data, srcLabel } = await loadData(opt);
  if (!data.sessions.length) {
    console.error('讀不到 stocktake_session 資料。若吃 dump 檔，請確認匯出有含盤點表（stocktake_session / stocktake_count）。');
    process.exit(2);
  }
  const res = computeDaily(data, opt);
  printSummary(res, srcLabel);
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const html = buildHtml(res, srcLabel, { generatedAt });
  const out = opt.out || path.join(process.cwd(), '盤差改善報告.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log('已輸出報告：' + out + '\n（用瀏覽器打開即可閱讀）');
}

main().catch((e) => { console.error('錯誤：' + (e && e.message || e)); process.exit(1); });
