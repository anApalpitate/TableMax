import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { preparePlan } from './plan.mjs';
import { runPlan } from './run-plan.mjs';
import { EvidenceIndex, fileRecord } from './evidence.mjs';
import { TestHistory, testIdentity } from './history.mjs';

function fixture(t) {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/verification-plan-'));
  mkdirSync(join(root, 'tools/test/runner'), { recursive: true });
  writeFileSync(join(root, 'subject.json'), '{"value":1}');
  writeFileSync(join(root, 'unrelated.json'), '{}');
  const script = 'tools/test/runner/evidence.test.mjs';
  writeFileSync(
    join(root, script),
    "import{writeFileSync}from'node:fs';import{resolve}from'node:path';writeFileSync(resolve(process.env.TABLEMAX_TEST_OUTPUT_DIR,'actual.txt'),'saved');console.log('completed');",
  );
  const item = {
    id: 'fixture',
    runtime: 'node',
    script,
    args: [],
    inputs: { files: ['subject.json'], complete: true },
  };
  const history = new TestHistory(root, 'history'),
    index = new EvidenceIndex(root, 'evidence');
  t.after(() => {
    history.close();
    rmSync(root, { recursive: true, force: true });
  });
  const changes = (path = 'subject.json') => ({
    version: 1,
    files: [fileRecord(root, path)],
  });
  const prepare = (tests = [item], manifest = changes(), options = {}) =>
    preparePlan(root, { version: 2, tests }, manifest, 'tooling', {
      index,
      ...options,
    });
  return { root, item, index, history, changes, prepare };
}
test('duplicate selection executes once; unchanged evidence reuses without adding attempts; forced output is isolated', async (t) => {
  const f = fixture(t),
    selected = f.prepare([f.item, { ...f.item, id: 'second-entrypoint' }]);
  assert.equal(selected.tests.length, 1);
  assert.deepEqual(selected.tests[0].selectedBy, [
    'fixture',
    'second-entrypoint',
  ]);
  let finishes = 0;
  const first = await runPlan(selected, f.history, {
    index: f.index,
    finish: async () => {
      finishes++;
      return { result: 'fixture-only' };
    },
  });
  assert.equal(first.run.state, 'passed');
  assert.equal(first.executed, 1);
  assert.equal(finishes, 1);
  const identity = testIdentity('verification', f.item.script, ['fixture']);
  const second = await runPlan(f.prepare(), f.history, { index: f.index });
  assert.equal(second.reused, 1);
  assert.equal(second.executed, 0);
  assert.equal(f.history.get(identity.id).total, 1);
  const forced = await runPlan(
    f.prepare(undefined, undefined, { force: true }),
    f.history,
    { index: f.index },
  );
  assert.equal(forced.executed, 1);
  assert.notEqual(first.output, forced.output);
  assert.ok(
    existsSync(join(first.output, '0/actual.txt')) &&
      existsSync(join(forced.output, '0/actual.txt')),
  );
  assert.equal(
    readFileSync(join(first.output, '0/actual.txt'), 'utf8'),
    'saved',
  );
  rmSync(join(forced.output, '0/actual.txt'));
  assert.equal(
    f.prepare().tests[0].decision,
    'execute',
    'Removing a child evidence artifact invalidates reuse',
  );
  console.log(
    JSON.stringify({
      representative: 'necessary reuse regression',
      beforeExecutionMs: first.timings.executionMs,
      afterExecutionMs: second.timings.executionMs,
      fingerprintMs: second.timings.fingerprintMs,
      executionsBefore: 1,
      executionsAfter: 0,
    }),
  );
});
test('owned changes exclude unrelated work and reject stale manifests or source drift', async (t) => {
  const f = fixture(t);
  assert.equal(
    f.prepare(undefined, f.changes('unrelated.json')).tests[0].decision,
    'not-applicable',
  );
  const stale = f.changes();
  writeFileSync(join(f.root, 'subject.json'), '{"value":2}');
  assert.throws(() => f.prepare(undefined, stale), /stale/);
  const prepared = f.prepare();
  writeFileSync(join(f.root, 'subject.json'), '{"value":3}');
  const result = await runPlan(prepared, f.history, { index: f.index });
  assert.equal(result.run.state, 'interrupted');
  assert.equal(result.executed, 0);
});
test('global failure threshold stops dispatch and never retries or counts unstarted work', async (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, f.item.script), 'process.exitCode=1;');
  const tests = Array.from({ length: 5 }, (_, i) => ({
    ...f.item,
    id: 'failure-' + i,
    args: [String(i)],
  }));
  const result = await runPlan(f.prepare(tests), f.history, {
    index: f.index,
    limit: 3,
  });
  assert.equal(result.run.state, 'stopped');
  assert.equal(result.failures, 3);
  assert.equal(result.executed, 3);
  assert.deepEqual(result.unexecuted, ['failure-3', 'failure-4']);
  assert.equal(f.history.report(result.runId).cases.length, 3);
});
test('mutated inputs, incomplete declarations and missing required output cannot create reusable proof', async (t) => {
  const f = fixture(t);
  writeFileSync(
    join(f.root, f.item.script),
    "import{writeFileSync}from'node:fs';writeFileSync('subject.json','changed');",
  );
  const selected = f.prepare(),
    result = await runPlan(selected, f.history, { index: f.index });
  assert.equal(result.run.state, 'failed');
  assert.equal(f.index.find(selected.tests[0].binding).proof, undefined);
  writeFileSync(join(f.root, f.item.script), "console.log('complete');");
  const missing = await runPlan(
    f.prepare([{ ...f.item, evidence: ['missing.json'] }]),
    f.history,
    { index: f.index },
  );
  assert.equal(missing.run.state, 'failed');
  const incomplete = f.prepare([
    { ...f.item, inputs: { ...f.item.inputs, complete: false } },
  ]);
  const passed = await runPlan(incomplete, f.history, { index: f.index });
  assert.equal(passed.run.state, 'passed');
  assert.equal(f.index.find(incomplete.tests[0].binding).proof, undefined);
});
