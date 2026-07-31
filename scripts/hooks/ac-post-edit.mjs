#!/usr/bin/env node
/**
 * PostToolUse hook：每次改完 .js 立刻 node --check（步驟 4 閘門的即時版）。
 *
 * 只警告不擋——語法錯會當場提示，但不會阻止後續動作，誤判時不卡人。
 * dist/ 是直接執行的 JS、沒有編譯期檢查，打錯括號要到執行期才爆，這關就是替代品。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const CHECKABLE = /\.(js|mjs|cjs)$/;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  let payload = {};
  try {
    payload = JSON.parse(readStdin() || '{}');
  } catch {
    return; // hook 輸入壞掉不該影響開發流程，靜靜退出
  }
  const file = payload?.tool_input?.file_path;
  if (!file || !CHECKABLE.test(file) || !existsSync(file)) return;

  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status === 0) return;

  const detail = (r.stderr || '').trim().split('\n').slice(0, 6).join('\n');
  const msg = `⚠ 語法檢查沒過：${file}\n${detail}\n修正：照上面的行號補好括號／逗號，再跑 \`npm run verify -- impl\`。`;
  process.stdout.write(
    `${JSON.stringify({
      systemMessage: msg,
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: msg },
    })}\n`
  );
}

main();
process.exit(0); // 一律 0：這個 hook 只警告，不擋流程
