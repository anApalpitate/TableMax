import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { TestHistory, testIdentity } from './history.mjs';
import { runBatch } from './test-batch.mjs';
import { runUnitTests } from './run-unit.mjs';

function fixture(t) {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/efficiency-verification-'));
  const history = new TestHistory(root, 'history');
  t.after(() => {
    history.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, history };
}

test('legacy batch disables child maintenance and calls one parent finish after the cumulative threshold', async (t) => {
  const f = fixture(t);
  writeFileSync(
    join(f.root, 'child.mjs'),
    "if(process.env.TABLEMAX_AUTO_MAINTENANCE!=='0') throw Error('child maintenance'); process.exitCode=1;",
  );
  let finishes = 0;
  const report = await runBatch(
    {
      version: 1,
      tests: Array.from({ length: 5 }, (_, i) => ({
        id: 'item-' + i,
        runtime: 'node',
        script: 'child.mjs',
        args: [],
      })),
    },
    f.history,
    {
      limit: 3,
      finish: async () => {
        finishes++;
        return { result: 'fixture' };
      },
    },
  );
  assert.equal(report.run.state, 'stopped');
  assert.equal(report.cases.length, 3);
  assert.equal(report.unexecuted.length, 2);
  assert.equal(finishes, 1);
  assert.equal(
    JSON.parse(
      readFileSync(
        join(f.history.directory, 'runs', report.run.id, 'results.json'),
      ),
    ).maintenance.result,
    'fixture',
  );
});

test('direct Vitest wrapper shares the parent ledger and finishes once on success or startup error', async (t) => {
  const f = fixture(t);
  let finishes = 0;
  const finish = async () => {
    finishes++;
    return { result: 'fixture' };
  };
  const report = await runUnitTests(['exact.test.ts'], 'shared', f.history, {
    finish,
    executeChild: async (_root, files, env) => {
      assert.deepEqual(files, ['exact.test.ts']);
      assert.equal(env.TABLEMAX_AUTO_MAINTENANCE, '0');
      assert.equal(env.TABLEMAX_TEST_SOUND, 'off');
      f.history.record(
        env.TABLEMAX_TEST_HISTORY_RUN_ID,
        'fixture-case',
        testIdentity('vitest', files[0], ['case']),
        'passed',
      );
      return { code: 0 };
    },
  });
  assert.equal(report.run.state, 'passed');
  assert.equal(report.cases.length, 1);
  assert.equal(finishes, 1);
  await assert.rejects(
    runUnitTests([], 'shared', f.history, {
      finish,
      executeChild: async () => {
        throw Error('startup failed');
      },
    }),
    /startup failed/,
  );
  assert.equal(finishes, 2);
});
