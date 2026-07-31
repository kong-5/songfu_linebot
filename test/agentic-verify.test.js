'use strict';
/**
 * smoke test：agentic coding 驗證 runner（scripts/verify.mjs）與閘門設定（.claude/agentic-gates.json）
 *
 * 守的是三件事：
 *  1. 閘門設定讀得進來、七步齊全（有人手滑改壞 JSON 會當場紅，而不是流程靜靜失效）
 *  2. 階段解析認得 id／編號／all，認不出來要丟「有哪些可用」的錯（守則 4）
 *  3. 「碰到 DB 才跑」的條件檢查判得對——判錯＝PG 冒煙被靜靜略過，是最危險的失效
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
let V;

test.before(async () => {
  V = await import(`file://${path.join(REPO, 'scripts', 'verify.mjs')}`);
});

test('閘門設定：七步齊全且欄位完整', () => {
  const gates = V.loadGates();
  const ids = gates.stages.map((s) => s.id);
  assert.deepStrictEqual(ids, ['spec', 'explore', 'plan', 'impl', 'test', 'review', 'ship']);
  assert.deepStrictEqual(
    gates.stages.map((s) => s.no),
    [1, 2, 3, 4, 5, 6, 7]
  );
  for (const s of gates.stages) {
    assert.ok(s.name, `${s.id} 缺 name`);
    assert.ok(['auto', 'human', 'both'].includes(s.gate), `${s.id} 的 gate 值不合法：${s.gate}`);
    assert.ok(s.auto.length + s.manual.length > 0, `${s.id} 沒有任何驗證項，等於沒閘門`);
    assert.ok(s.fixHint, `${s.id} 缺 fixHint——守則 4：沒過時要告訴使用者怎麼修`);
  }
});

test('閘門設定：關鍵自動檢查沒被拿掉', () => {
  const gates = V.loadGates();
  const impl = gates.stages.find((s) => s.id === 'impl');
  assert.ok(impl.auto.some((c) => c.builtin === 'node-check'), 'impl 少了 node --check');
  assert.ok(impl.auto.some((c) => /npm run lint/.test(c.run || '')), 'impl 少了 npm run lint');

  const t = gates.stages.find((s) => s.id === 'test');
  assert.ok(t.auto.some((c) => /npm test/.test(c.run || '')), 'test 少了 npm test');
  const pg = t.auto.find((c) => /smoke:pg/.test(c.run || ''));
  assert.ok(pg, 'test 少了 PG 冒煙');
  assert.strictEqual(pg.when, 'db', 'PG 冒煙應標 when=db（只有碰到 DB 才跑）');
});

test('閘門設定：找不到檔案要給修正指引', () => {
  assert.throws(
    () => V.loadGates(path.join(REPO, '.claude', '不存在的檔.json')),
    (e) => /找不到閘門設定/.test(e.message) && /修正：/.test(e.message)
  );
});

test('階段解析：id、編號、all、空值', () => {
  const gates = V.loadGates();
  assert.deepStrictEqual(V.resolveStages(gates, ['impl']).map((s) => s.id), ['impl']);
  assert.deepStrictEqual(V.resolveStages(gates, ['4']).map((s) => s.id), ['impl']);
  assert.strictEqual(V.resolveStages(gates, []).length, 7);
  assert.strictEqual(V.resolveStages(gates, ['all']).length, 7);
  // 順序一律照步驟編號，使用者亂序指定也一樣
  assert.deepStrictEqual(V.resolveStages(gates, ['5', '4']).map((s) => s.no), [4, 5]);
  // 重複指定不會跑兩次
  assert.strictEqual(V.resolveStages(gates, ['impl', '4']).length, 1);
  // 旗標不該被當成階段
  assert.strictEqual(V.resolveStages(gates, ['--db', '--log']).length, 7);
});

test('階段解析：認不出來要列出可用選項', () => {
  const gates = V.loadGates();
  assert.throws(
    () => V.resolveStages(gates, ['deploy']),
    (e) => /不認得階段/.test(e.message) && /4=impl/.test(e.message)
  );
});

test('touchesDb：路徑與 diff 內容都算數', () => {
  assert.strictEqual(V.touchesDb(['dist/db/index.js']), true);
  assert.strictEqual(V.touchesDb(['docs/遷移-Supabase.sql']), true);
  assert.strictEqual(V.touchesDb(['scripts/pg-smoke.js']), true);
  assert.strictEqual(V.touchesDb(['dist/admin/inventory.js']), false);
  // 改的是別的檔案，但 diff 動到建表／遷移 → 仍要跑 PG 冒煙
  assert.strictEqual(V.touchesDb(['dist/admin/inventory.js'], '+ ALTER TABLE foo ADD COLUMN bar'), true);
  assert.strictEqual(V.touchesDb(['dist/admin/inventory.js'], '+ const x = sqlForPg(q)'), true);
  assert.strictEqual(V.touchesDb([], ''), false);
});

test('shouldRunCheck：when=db 的三種情境', () => {
  const check = { when: 'db' };
  assert.strictEqual(V.shouldRunCheck(check, { dbTouched: true }), true);
  assert.strictEqual(V.shouldRunCheck(check, { dbTouched: false }), false);
  assert.strictEqual(V.shouldRunCheck(check, { dbTouched: false, forceDb: true }), true, '--db 應能強制跑');
  assert.strictEqual(V.shouldRunCheck(check, { dbTouched: true, skipDb: true }), false, '--no-db 應能略過');
  // 沒有 when 的檢查一律跑
  assert.strictEqual(V.shouldRunCheck({}, { dbTouched: false }), true);
});

test('collectChangedFiles：解析 porcelain 輸出（含 rename 與未追蹤）', () => {
  const fakeGit = (args) => {
    if (args[0] === 'status') {
      return {
        ok: true,
        out: [' M dist/admin/inventory.js', '?? test/new.test.js', 'R  old/a.js -> dist/lib/b.js'].join('\n'),
      };
    }
    return { ok: true, out: 'docs/x.md' };
  };
  const files = V.collectChangedFiles(fakeGit);
  assert.deepStrictEqual(files, ['dist/admin/inventory.js', 'dist/lib/b.js', 'docs/x.md', 'test/new.test.js']);
});

test('collectChangedFiles：git 失敗時回空陣列而不是爆掉', () => {
  const files = V.collectChangedFiles(() => ({ ok: false, out: '' }));
  assert.deepStrictEqual(files, []);
});

test('formatReport：失敗時要帶出 fixHint 與失敗階段名', () => {
  const stage = { no: 4, name: '實作', gate: 'auto', manual: ['改的是 dist/'], fixHint: '照 eslint 輸出修' };
  const text = V.formatReport(
    [{ stage, checks: [{ name: 'Lint', pass: false, output: 'no-undef foo', cmd: 'npm run lint' }], pass: false }],
    { color: false }
  );
  assert.match(text, /步驟 4／7 實作/);
  assert.match(text, /❌ Lint/);
  assert.match(text, /no-undef foo/);
  assert.match(text, /照 eslint 輸出修/);
  assert.match(text, /自動閘門未通過.*實作/);
  assert.match(text, /☐ 改的是 dist\//, '人工確認項要一起列出');
});

test('formatRunLog：產出可直接貼進 docs/agentic-runs 的 markdown', () => {
  const stage = { no: 5, name: '測試', gate: 'both', manual: ['有新增 smoke test'], fixHint: '' };
  const md = V.formatRunLog(
    [
      {
        stage,
        checks: [
          { name: 'npm test', pass: true, cmd: 'npm test' },
          { name: 'PG 冒煙', pass: true, skipped: true, output: '本次改動未碰到資料庫，略過', cmd: 'npm run smoke:pg' },
        ],
        pass: true,
      },
    ],
    { now: '2026-07-31 09:00' }
  );
  assert.match(md, /### 步驟 5 測試\s+通過/);
  assert.match(md, /✅ npm test/);
  assert.match(md, /⏭ PG 冒煙.*略過/);
  assert.match(md, /☐ 有新增 smoke test/);
});
