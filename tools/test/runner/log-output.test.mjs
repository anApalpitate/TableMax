import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import {
  createOutputBudget,
  failureLogExcerpt,
  failureBudgetBytes,
  summaryBudgetBytes,
  selectionListOutput,
} from './log-output.mjs';
import { TestHistory } from './history.mjs';
import { runUnitTests } from './run-unit.mjs';

function fixture(t) {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/efficiency-verification-'));
  const result = { root };
  t.after(() => {
    result.history?.close();
    rmSync(root, { recursive: true, force: true });
  });
  return result;
}
const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

test('preset list keeps small JSON compatible and saves every large selection and exclusion within console budget', async (t) => {
  const f = fixture(t),
    small = {
      version: 2,
      scope: ['tooling'],
      preset: ['tooling'],
      tests: [{ id: 'small', decision: 'execute', reason: 'changed input' }],
      excluded: [],
    };
  const first = await selectionListOutput(f.root, small, 'selection');
  assert.equal(first.truncated, false);
  assert.deepEqual(JSON.parse(first.text), small);
  assert.deepEqual(JSON.parse(readFileSync(first.evidencePath, 'utf8')), small);
  const large = {
    ...small,
    tests: Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      decision: i % 2 ? 'reuse' : 'execute',
      reason: '内容证据与完整理由'.repeat(8),
    })),
    excluded: Array.from({ length: 200 }, (_, i) => ({
      id: String(i),
      reason: 'excluded by authoritative scope',
    })),
  };
  const second = await selectionListOutput(f.root, large, 'selection'),
    summary = JSON.parse(second.text);
  assert.equal(second.truncated, true);
  assert.ok(Buffer.byteLength(second.text + '\n') <= summaryBudgetBytes);
  assert.deepEqual(summary.counts, { execute: 50, reuse: 50, excluded: 200 });
  assert.match(summary.message, /已截断/);
  assert.deepEqual(
    JSON.parse(readFileSync(second.evidencePath, 'utf8')),
    large,
  );
  await assert.rejects(
    () => selectionListOutput(f.root, small, '../escape'),
    /escapes/,
  );
});

test('round console budgets preserve full UTF-8 logs and visibly mark truncated details', (t) => {
  const f = fixture(t),
    logs = ['stdout.log', 'stderr.log'].map((name) => join(f.root, name));
  for (const path of logs) writeFileSync(path, '完整证据'.repeat(20000));
  const hashes = logs.map(hash),
    captured = [];
  const excerpt = failureLogExcerpt(logs);
  assert.equal(excerpt.truncated, true);
  assert.ok(Buffer.byteLength(excerpt.text) <= failureBudgetBytes);
  assert.ok(!excerpt.text.includes('\uFFFD'));
  assert.match(excerpt.text, /输出已截断/);
  const output = createOutputBudget((text, failed) =>
    captured.push({ text, failed }),
  );
  for (let i = 0; i < 1000; i++) output.line('completed-check-' + i);
  output.failure(logs);
  output.failure(logs);
  for (const [failed, limit] of [
    [false, summaryBudgetBytes],
    [true, failureBudgetBytes],
  ])
    assert.ok(
      captured
        .filter((item) => item.failed === failed)
        .reduce((sum, item) => sum + Buffer.byteLength(item.text + '\n'), 0) <=
        limit,
    );
  assert.deepEqual(logs.map(hash), hashes);
});

test('direct Vitest pipes large stdout/stderr to full evidence and retains failure exit', async (t) => {
  const f = fixture(t),
    script = join(f.root, 'node_modules/vitest/vitest.mjs');
  mkdirSync(dirname(script), { recursive: true });
  writeFileSync(
    script,
    "console.log('x'.repeat(32768));console.error('y'.repeat(32768));process.exitCode=1;",
  );
  f.history = new TestHistory(f.root, 'history');
  const result = await runUnitTests(['exact.test.ts'], 'tooling', f.history, {
    finish: false,
  });
  assert.equal(result.run.state, 'failed');
  assert.equal(result.code, 1);
  assert.equal(readFileSync(result.logs[0]).length, 32769);
  assert.equal(readFileSync(result.logs[1]).length, 32769);
});
