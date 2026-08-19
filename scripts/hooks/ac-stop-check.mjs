#!/usr/bin/env node
/**
 * Stop hook：回合結束前，若這次有動到 JS，就把步驟 4 的自動閘門補跑一次並提醒後續步驟。
 *
 * 只警告不擋（一律 exit 0）。沒動到 JS 的純問答回合會直接跳過，不浪費時間。
 */
import { spawnSync } from 'node:child_process';

const JS_CHANGE = /\.(js|mjs|cjs)$/;

function changedJs() {
  const r = spawnSync('git', ['status', '--porcelain=v1', '-uall'], { encoding: 'utf8' });
  if (r.status !== 0) return [];
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3))
    .map((p) => (p.includes(' -> ') ? p.split(' -> ')[1] : p))
    .filter((p) => JS_CHANGE.test(p));
}

function main() {
  const files = changedJs();
  if (files.length === 0) return;

  const r = spawnSync(process.execPath, ['scripts/verify.mjs', 'impl'], { encoding: 'utf8' });
  const passed = r.status === 0;
  const msg = passed
    ? `步驟 4 閘門已過（node --check ＋ lint）。未完成的後續步驟：5 測試（新增 smoke test ＋ npm test）、6 自我審查、7 交付。`
    : `⚠ 步驟 4 閘門未過，這次改動還不該交付：\n${(r.stdout || r.stderr || '').trim().slice(-1200)}`;

  process.stdout.write(
    `${JSON.stringify({
      systemMessage: msg,
      hookSpecificOutput: { hookEventName: 'Stop', additionalContext: msg },
    })}\n`
  );
}

main();
process.exit(0); // 一律 0：只警告，不阻止回合結束
