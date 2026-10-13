import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { preparePreset } from './presets.mjs';
import { EvidenceIndex, fileRecord } from './evidence.mjs';
import { TestHistory } from './history.mjs';
import { runPlan } from './run-plan.mjs';
import { checkCategories } from './scopes.mjs';
import { summaryBudgetBytes } from './log-output.mjs';

function fixture(t) {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/efficiency-verification-'));
  for (const directory of ['apps', 'packages', 'games'])
    mkdirSync(join(root, directory));
  const write = (path, source) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  };
  write('games/modern-art/rules/rules.test.ts', 'export {};');
  write('games/modern-art/ui/sorting.test.ts', 'export {};');
  write('games/uno/rules/rules.test.ts', 'export {};');
  const script = 'tools/test/runner/evidence.test.mjs';
  write(script, "console.log('fixture passed');");
  const result = { root, write, script };
  t.after(() => {
    result.history?.close();
    rmSync(root, { recursive: true, force: true });
  });
  const changes = (path) => ({ version: 1, files: [fileRecord(root, path)] });
  return Object.assign(result, { changes });
}

test('resources categories include avatar/media checks and keep economic resource previews in UI', () => {
  assert.ok(
    checkCategories('apps/server/src/avatar-upload.test.ts').includes(
      'resources',
    ),
  );
  assert.ok(
    checkCategories('apps/desktop/src/audio-controller.test.ts').includes(
      'resources',
    ),
  );
  assert.deepEqual(
    checkCategories(
      'games/power-grid/ui/player/resource-purchase-preview.test.ts',
    ),
    ['ui'],
  );
});

test('preset uses authoritative scope and categories, conservatively executes incomplete game inputs, and rejects stale ownership', (t) => {
  const f = fixture(t),
    path = 'games/modern-art/ui/sorting.test.ts';
  const result = preparePreset(
    f.root,
    'ui',
    f.changes(path),
    'game:modern-art',
  );
  assert.deepEqual(
    result.tests.map((item) => item.script),
    [path],
  );
  assert.equal(result.tests[0].decision, 'execute');
  assert.equal(result.tests[0].binding.reusable, false);
  assert.ok(
    result.excluded.some(
      (item) => item.script.includes('/uno/') && item.reason.includes('scope'),
    ),
  );
  assert.ok(
    result.excluded.some(
      (item) =>
        item.script.includes('/modern-art/rules/') &&
        item.reason.includes('categories'),
    ),
  );
  const owned = f.changes(path);
  f.write(path, 'export const changed = true;');
  assert.throws(
    () => preparePreset(f.root, 'ui', owned, 'game:modern-art'),
    /stale/,
  );
  assert.throws(
    () => preparePreset(f.root, 'ui,ui', f.changes(path), 'game:modern-art'),
    /categories/,
  );
});

test('audited tooling preset reuses passing evidence without increasing attempts, excludes unrelated changes', async (t) => {
  const f = fixture(t),
    history = new TestHistory(f.root, 'history'),
    index = new EvidenceIndex(f.root, 'evidence');
  f.history = history;
  const prepare = () =>
    preparePreset(f.root, 'tooling', f.changes(f.script), 'tooling', { index });
  const first = await runPlan(prepare(), history, { index });
  assert.equal(first.executed, 1);
  const second = await runPlan(prepare(), history, { index });
  assert.equal(second.executed, 0);
  assert.equal(second.reused, 1);
  assert.equal(history.all()[0].total, 1);
  f.write('unrelated.json', '{}');
  assert.equal(
    preparePreset(f.root, 'tooling', f.changes('unrelated.json'), 'tooling')
      .tests.length,
    0,
  );
});

test('real preset CLI lists decisions and exclusions without spawning checks', (t) => {
  const f = fixture(t),
    manifest = join(f.root, 'owned.json');
  writeFileSync(
    manifest,
    JSON.stringify({
      version: 1,
      files: [fileRecord(process.cwd(), 'tools/test/runner/presets.test.mjs')],
    }),
  );
  const listed = spawnSync(
    process.execPath,
    [
      'tools/test/runner/test-scoped.mjs',
      '--scope=tooling',
      '--preset=tooling',
      '--changes=' + manifest,
      '--list',
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        TABLEMAX_TEST_HISTORY_DIR: join(f.root, 'selection'),
        TABLEMAX_AUTO_MAINTENANCE: '0',
      },
    },
  );
  assert.equal(listed.status, 0, listed.stderr);
  assert.ok(Buffer.byteLength(listed.stdout) <= summaryBudgetBytes);
  const summary = JSON.parse(listed.stdout);
  assert.equal(summary.truncated, true);
  assert.match(summary.message, /已截断/);
  const result = JSON.parse(readFileSync(summary.evidencePath, 'utf8'));
  assert.equal(summary.counts.excluded, result.excluded.length);
  assert.equal(
    summary.counts.execute + summary.counts.reuse,
    result.tests.length,
  );
  assert.equal(result.version, 2);
  assert.deepEqual(result.preset, ['tooling']);
  assert.ok(result.tests.some((item) => item.id.endsWith('/presets.test.mjs')));
  assert.ok(result.excluded.some((item) => item.reason.includes('scope')));
  assert.ok(
    result.tests.every((item) => ['execute', 'reuse'].includes(item.decision)),
  );
});
