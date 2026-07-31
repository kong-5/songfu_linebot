#!/usr/bin/env node
/**
 * agentic coding 分階段驗證 runner
 *
 * 用法：
 *   npm run verify            # 跑全部七步（人工項只列清單，不會自己打勾）
 *   npm run verify -- impl    # 只跑步驟 4「實作」的閘門
 *   npm run verify -- 4 5     # 用編號指定多步
 *   npm run verify -- --list  # 列出所有階段與各自的驗證項
 *   npm run verify -- test --db      # 強制把「碰到 DB 才跑」的檢查跑起來
 *   npm run verify -- impl --log docs/agentic-runs/2026-07-31-某功能.md
 *
 * 閘門定義一律讀 .claude/agentic-gates.json（改那份即可，別在這裡寫死）。
 * 離開碼：0=自動檢查全過；1=有自動檢查沒過；2=用法/設定錯誤。
 */
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_GATES_PATH = resolve(ROOT, '.claude/agentic-gates.json');

/** 碰到這些路徑就視為「改到資料庫」，步驟 5 的 PG 冒煙要跟著跑 */
const DB_PATH_HINTS = [/^dist\/db\//, /\.sql$/i, /^scripts\/pg-smoke\.js$/];
/** 診斷用：diff 內出現這些字樣也算碰到 DB（改的是別的檔案但動了建表/遷移） */
const DB_DIFF_HINTS = /(CREATE TABLE|ALTER TABLE|initPg|initSqlite|sqlForPg)/;

// ── 設定讀取 ────────────────────────────────────────────────────────────────

export function loadGates(gatesPath = DEFAULT_GATES_PATH) {
  if (!existsSync(gatesPath)) {
    throw new Error(
      `找不到閘門設定 ${gatesPath}。\n` +
        `修正：從 git 還原這份檔案（git checkout -- .claude/agentic-gates.json），` +
        `或參考 docs/agentic-coding-流程.md §2 重建。`
    );
  }
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(gatesPath, 'utf8'));
  } catch (e) {
    throw new Error(
      `閘門設定 ${gatesPath} 不是合法 JSON：${e.message}\n` +
        `修正：多半是漏了逗號或多了結尾逗號，用編輯器的 JSON 檢查修好再跑。`
    );
  }
  if (!Array.isArray(cfg.stages) || cfg.stages.length === 0) {
    throw new Error(`閘門設定缺少 stages 陣列。\n修正：至少要有一個階段，格式見該檔的 _欄位 說明。`);
  }
  for (const s of cfg.stages) {
    if (!s.id || typeof s.no !== 'number' || !s.name) {
      throw new Error(
        `階段設定不完整：${JSON.stringify(s).slice(0, 80)}…\n` +
          `修正：每個階段都要有 id（字串）、no（數字）、name（字串）。`
      );
    }
    s.auto = s.auto || [];
    s.manual = s.manual || [];
    s.gate = s.gate || (s.auto.length ? 'auto' : 'human');
  }
  return cfg;
}

/**
 * 把命令列指定的階段（id 或編號，或 all／空）解析成階段陣列。
 * 認不出來時丟出「有哪些可用」的錯誤，而不是靜靜跑全部。
 */
export function resolveStages(gates, tokens = []) {
  const wanted = tokens.filter((t) => !t.startsWith('-'));
  if (wanted.length === 0 || wanted.includes('all')) return gates.stages.slice();
  const out = [];
  for (const t of wanted) {
    const hit = gates.stages.find((s) => s.id === t || String(s.no) === t);
    if (!hit) {
      const list = gates.stages.map((s) => `${s.no}=${s.id}`).join('、');
      throw new Error(`不認得階段「${t}」。\n修正：用編號或代號指定，可用的有 ${list}，或用 all 跑全部。`);
    }
    if (!out.includes(hit)) out.push(hit);
  }
  return out.sort((a, b) => a.no - b.no);
}

// ── 變更檔案偵測 ────────────────────────────────────────────────────────────

function git(args, { cwd = ROOT } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

/** 未提交的變更 ∪ 本分支相對 origin/main 的變更（交付前才看得到全貌） */
export function collectChangedFiles(runGit = git) {
  const files = new Set();
  const status = runGit(['status', '--porcelain=v1', '-uall']);
  if (status.ok) {
    for (const line of status.out.split('\n')) {
      if (!line.trim()) continue;
      const path = line.slice(3);
      // rename 形如 "R  old -> new"，只取新檔名
      files.add(path.includes(' -> ') ? path.split(' -> ')[1] : path);
    }
  }
  for (const base of ['origin/main', 'main']) {
    const diff = runGit(['diff', '--name-only', `${base}...HEAD`]);
    if (diff.ok) {
      for (const p of diff.out.split('\n')) if (p.trim()) files.add(p.trim());
      break;
    }
  }
  return [...files].filter(Boolean).sort();
}

export function touchesDb(files, diffText = '') {
  if (files.some((f) => DB_PATH_HINTS.some((re) => re.test(f)))) return true;
  return DB_DIFF_HINTS.test(diffText);
}

export function shouldRunCheck(check, ctx) {
  if (!check.when) return true;
  if (check.when === 'db') return ctx.forceDb || (ctx.dbTouched && !ctx.skipDb);
  return true;
}

// ── 執行 ────────────────────────────────────────────────────────────────────

function runShell(cmd) {
  const r = spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  return { pass: r.status === 0, output: out, cmd };
}

/** 內建：對本次變更的 .js 逐一 node --check（dist/ 手改 JS 沒有編譯期檢查，這是替代品） */
function runNodeCheck(ctx) {
  const targets = ctx.changed.filter((f) => /\.(js|mjs|cjs)$/.test(f) && existsSync(resolve(ROOT, f)));
  if (targets.length === 0) {
    return { pass: true, output: '本次沒有變更的 JS 檔，略過', cmd: 'node --check', skipped: true };
  }
  const bad = [];
  for (const f of targets) {
    const r = spawnSync(process.execPath, ['--check', f], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) bad.push(`${f}\n${(r.stderr || '').trim()}`);
  }
  return {
    pass: bad.length === 0,
    output: bad.length ? bad.join('\n\n') : `${targets.length} 個檔案語法正確`,
    cmd: `node --check（${targets.length} 檔）`,
  };
}

export function runStage(stage, ctx) {
  const checks = [];
  for (const c of stage.auto) {
    if (!shouldRunCheck(c, ctx)) {
      checks.push({ name: c.name, pass: true, skipped: true, output: '本次改動未碰到資料庫，略過', cmd: c.run || '' });
      continue;
    }
    const r = c.builtin === 'node-check' ? runNodeCheck(ctx) : runShell(c.run);
    checks.push({ name: c.name, ...r });
  }
  return { stage, checks, pass: checks.every((c) => c.pass) };
}

// ── 輸出 ────────────────────────────────────────────────────────────────────

const MARK = { pass: '✅', fail: '❌', skip: '⏭', todo: '☐' };

export function formatReport(results, { color = true } = {}) {
  const bold = (s) => (color ? `[1m${s}[0m` : s);
  const dim = (s) => (color ? `[2m${s}[0m` : s);
  const lines = [];
  for (const { stage, checks, pass } of results) {
    lines.push('');
    lines.push(bold(`━━ 步驟 ${stage.no}／7 ${stage.name}　[${stage.gate}] ━━`));
    for (const c of checks) {
      const mark = c.skipped ? MARK.skip : c.pass ? MARK.pass : MARK.fail;
      lines.push(`  ${mark} ${c.name}${c.cmd ? dim(`　${c.cmd}`) : ''}`);
      if (!c.pass && c.output) {
        lines.push(...c.output.split('\n').slice(0, 40).map((l) => `      ${l}`));
      } else if (c.skipped && c.output) {
        lines.push(dim(`      ${c.output}`));
      }
    }
    if (stage.manual.length) {
      lines.push(dim(`  人工確認（逐條要有明確答案，不能只回「有做」）：`));
      for (const m of stage.manual) lines.push(`  ${MARK.todo} ${m}`);
    }
    if (!pass && stage.fixHint) {
      lines.push('');
      lines.push(`  ${bold('怎麼修：')}${stage.fixHint}`);
    }
  }
  const failed = results.filter((r) => !r.pass);
  lines.push('');
  lines.push(
    failed.length
      ? bold(`${MARK.fail} 自動閘門未通過：${failed.map((r) => `${r.stage.no} ${r.stage.name}`).join('、')}`)
      : bold(`${MARK.pass} 自動閘門全過（人工確認項仍需逐條回答）`)
  );
  return lines.join('\n');
}

export function formatRunLog(results, { title = '', now = '' } = {}) {
  const lines = [`## 驗證紀錄 ${now}${title ? `　${title}` : ''}`, ''];
  for (const { stage, checks, pass } of results) {
    lines.push(`### 步驟 ${stage.no} ${stage.name}　${pass ? '通過' : '未通過'}`);
    for (const c of checks) {
      const mark = c.skipped ? MARK.skip : c.pass ? MARK.pass : MARK.fail;
      lines.push(`- ${mark} ${c.name}${c.cmd ? `（\`${c.cmd}\`）` : ''}${c.skipped ? `：${c.output}` : ''}`);
    }
    for (const m of stage.manual) lines.push(`- ${MARK.todo} ${m}`);
    lines.push('');
  }
  return lines.join('\n');
}

function formatList(gates) {
  const lines = [];
  for (const s of gates.stages) {
    lines.push(`步驟 ${s.no} ${s.name}（id=${s.id}，gate=${s.gate}）`);
    for (const c of s.auto) lines.push(`  自動 ${c.builtin ? `[${c.builtin}]` : c.run}${c.when ? `（when=${c.when}）` : ''}`);
    for (const m of s.manual) lines.push(`  人工 ${m}`);
  }
  return lines.join('\n');
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function main(argv) {
  const flags = argv.filter((a) => a.startsWith('-'));
  const tokens = argv.filter((a) => !a.startsWith('-'));
  const logIdx = argv.indexOf('--log');
  const logPath = logIdx >= 0 ? argv[logIdx + 1] : null;
  if (logPath) tokens.splice(tokens.indexOf(logPath), 1);

  let stages;
  try {
    const gates = loadGates();
    if (flags.includes('--list')) {
      process.stdout.write(`${formatList(gates)}\n`);
      return 0;
    }
    stages = resolveStages(gates, tokens);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    return 2;
  }

  const changed = collectChangedFiles();
  const diffText = git(['--no-pager', 'diff', '--unified=0', 'HEAD']).out;
  const ctx = {
    changed,
    dbTouched: touchesDb(changed, diffText),
    forceDb: flags.includes('--db'),
    skipDb: flags.includes('--no-db'),
  };

  const results = stages.map((s) => runStage(s, ctx));
  // 導到檔案／管線時不帶 ANSI 色碼，貼進 PR 或 run log 才不會一堆 [1m
  process.stdout.write(`${formatReport(results, { color: Boolean(process.stdout.isTTY) })}\n`);

  if (logPath) {
    const abs = resolve(ROOT, logPath);
    mkdirSync(dirname(abs), { recursive: true });
    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    appendFileSync(abs, `\n${formatRunLog(results, { now: stamp })}\n`, 'utf8');
    process.stdout.write(`\n驗證紀錄已附加到 ${logPath}\n`);
  }
  return results.every((r) => r.pass) ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
