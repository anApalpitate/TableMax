import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import {
  TestHistory,
  testIdentity,
  rawIdentity,
  sortSuite,
  compareRates,
  failureLimit,
  lifecycleIdentity,
} from './history.mjs';
import { importVitest } from './test-history.mjs';
import { runBatch } from './test-batch.mjs';

const workspace = process.cwd();
const evidenceParent = resolve(
  'artifacts/maintenance/v1.0.4/test-history-verification-20261008',
);
mkdirSync(evidenceParent, { recursive: true });
const evidence = mkdtempSync(resolve(evidenceParent, 'checks-'));
const roots = [];
function fixture() {
  const root = mkdtempSync(resolve(evidence, 'fixture-'));
  roots.push(root);
  const history = new TestHistory(root, 'history');
  return { root, history };
}

const testLibUrl = new URL(
  '../../../node_modules/vitest/dist/index.js',
  import.meta.url,
).href;
function integrationConfig(root, limit) {
  const config = resolve(root, 'vitest.config.mjs');
  const vitestUrl = new URL(
    '../../../node_modules/vitest/dist/config.js',
    import.meta.url,
  ).href;
  const reporterUrl = new URL('./vitest-history.mjs', import.meta.url).href;
  const runner = resolve(workspace, 'tools/test/runner/history-runner.mjs');
  writeFileSync(
    config,
    `import{defineConfig}from${JSON.stringify(vitestUrl)};import{HistoryReporter,HistorySequencer}from${JSON.stringify(reporterUrl)};export default defineConfig({test:{root:${JSON.stringify(root)},include:['*.test.mjs'],environment:'node',maxWorkers:1,fileParallelism:false,bail:${limit},retry:0,reporters:['default',new HistoryReporter()],runner:${JSON.stringify(runner)},sequence:{sequencer:HistorySequencer}}});`,
  );
  return config;
}
function runVitest(root, config, label) {
  const temporary = resolve(root, 'runtime-temp');
  mkdirSync(temporary, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      resolve(workspace, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--config',
      config,
    ],
    {
      cwd: workspace,
      env: {
        ...process.env,
        TEMP: temporary,
        TMP: temporary,
        TABLEMAX_TEST_HISTORY_DIR: resolve(root, 'history'),
      },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 45000,
    },
  );
  const prefix = resolve(evidence, `${basename(root)}-${label}`);
  writeFileSync(`${prefix}-stdout.log`, result.stdout ?? '');
  writeFileSync(`${prefix}-stderr.log`, result.stderr ?? '');
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}
function latestReport(history) {
  return history.report(
    history.db.prepare('SELECT id FROM runs ORDER BY rowid DESC LIMIT 1').get()
      .id,
  );
}

test('persistent counters retain failures and deduplicate exact result delivery across writers', () => {
  const { root, history } = fixture();
  const other = new TestHistory(root, 'history');
  const identity = testIdentity('vitest', 'cases.test.ts', ['suite', 'case']);
  const run = history.start(3);
  history.record(run, 'one', identity, 'failed');
  other.record(run, 'one', identity, 'failed');
  const result = other.record(run, 'two', identity, 'passed');
  assert.equal(result.passed, 1);
  assert.equal(result.total, 2);
  assert.throws(
    () => history.record(run, 'skip', identity, 'skipped'),
    /completed/,
  );
  history.close();
  other.close();
  const restored = new TestHistory(root, 'history');
  assert.equal(restored.get(identity.id).total, 2);
  restored.close();
});

test('ordering starts with observed failures, then untested cases, then healthy cases, preserving suite hooks', () => {
  const { root, history } = fixture();
  const file = {
    type: 'suite',
    filepath: resolve(root, 'cases.test.ts'),
    tasks: [],
  };
  file.file = file;
  const group = {
    type: 'suite',
    name: 'group',
    suite: file,
    file,
    tasks: [],
    hooks: { beforeAll: 'sentinel' },
  };
  const leaf = (name) => ({
    type: 'test',
    name,
    suite: group,
    file,
    concurrent: true,
  });
  group.tasks = [leaf('healthy'), leaf('new'), leaf('broken')];
  file.tasks = [group];
  const run = history.start(3);
  history.record(run, 'pass', rawIdentity(root, group.tasks[0]), 'passed');
  history.record(run, 'fail', rawIdentity(root, group.tasks[2]), 'failed');
  sortSuite(file, history);
  assert.deepEqual(
    group.tasks.map((task) => task.name),
    ['broken', 'new', 'healthy'],
  );
  assert.equal(group.hooks.beforeAll, 'sentinel');
  assert.ok(group.tasks.every((task) => task.concurrent === false));
  assert.ok(compareRates({ passed: 1, total: 3 }, { passed: 2, total: 3 }) < 0);
  for (const value of [0, -1, 'x', 1.5, 1001])
    assert.throws(() => failureLimit(value));
  assert.equal(failureLimit('3'), 3);
  const fresh = { type: 'suite', name: 'fresh', suite: file, file, tasks: [] };
  history.record(run, 'failed-hook', lifecycleIdentity(root, group), 'failed');
  file.tasks = [fresh, group];
  sortSuite(file, history);
  assert.deepEqual(
    file.tasks.map((task) => task.name),
    ['group', 'fresh'],
  );
  const scoped = (name) => {
    const suite = { type: 'suite', name, suite: file, file, tasks: [] };
    suite.tasks.push({ type: 'test', name: 'body', suite, file });
    return suite;
  };
  const healthyGroup = scoped('healthy-group'),
    riskyGroup = scoped('risky-group');
  history.record(
    run,
    'healthy-case-only',
    rawIdentity(root, healthyGroup.tasks[0]),
    'passed',
  );
  history.record(
    run,
    'risky-case-pass',
    rawIdentity(root, riskyGroup.tasks[0]),
    'passed',
  );
  history.record(
    run,
    'risky-case-fail',
    rawIdentity(root, riskyGroup.tasks[0]),
    'failed',
  );
  file.tasks = [healthyGroup, riskyGroup];
  sortSuite(file, history);
  assert.deepEqual(
    file.tasks.map((task) => task.name),
    ['risky-group', 'healthy-group'],
  );
  assert.throws(() => new TestHistory(root, '../escape'), /inside/);
  history.close();
});

test('unknown history versions are rejected without modifying the original database', () => {
  const { root, history } = fixture();
  const file = resolve(root, 'history/history.sqlite');
  history.db.exec('PRAGMA user_version=99;');
  history.close();
  const original = readFileSync(file);
  assert.throws(() => new TestHistory(root, 'history'), /Unknown/);
  assert.deepEqual(readFileSync(file), original);
  const db = new DatabaseSync(file);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 99);
  db.close();
});

test('historical import requires case evidence, includes failures, excludes skips, and is repeat-safe', () => {
  const { root, history } = fixture();
  const report = {
    startTime: 123,
    testResults: [
      {
        name: resolve(root, 'cases.test.ts'),
        assertionResults: [
          {
            ancestorTitles: ['suite'],
            title: 'a',
            status: 'passed',
            duration: 2,
          },
          {
            ancestorTitles: ['suite'],
            title: 'b',
            status: 'failed',
            failureMessages: ['known failure'],
          },
          { ancestorTitles: [], title: 'skip', status: 'pending' },
        ],
      },
    ],
  };
  assert.deepEqual(importVitest(history, report), {
    imported: 2,
    duplicates: 0,
  });
  assert.deepEqual(importVitest(history, JSON.parse(JSON.stringify(report))), {
    imported: 0,
    duplicates: 2,
  });
  assert.equal(history.all().length, 2);
  assert.equal(
    history.get(testIdentity('vitest', 'cases.test.ts', ['suite', 'b']).id)
      .passed,
    0,
  );
  assert.throws(() => importVitest(history, { passed: 42 }), /complete/);
  const malformed = JSON.parse(JSON.stringify(report));
  malformed.testResults[0].assertionResults[1].duration = -1;
  assert.throws(() => importVitest(history, malformed), /duration/);
  assert.equal(
    history.get(testIdentity('vitest', 'cases.test.ts', ['suite', 'a']).id)
      .total,
    1,
  );
  history.close();
});

test('verification batch ranks by history, stops exactly at failure limit and never counts remaining work', async () => {
  const { root, history } = fixture();
  writeFileSync(resolve(root, 'pass.mjs'), 'process.exitCode=0;');
  writeFileSync(resolve(root, 'fail.mjs'), 'process.exitCode=1;');
  const previous = history.start(3);
  history.record(
    previous,
    'seed-pass',
    testIdentity('verification', 'pass.mjs', ['healthy']),
    'passed',
  );
  history.record(
    previous,
    'seed-fail',
    testIdentity('verification', 'fail.mjs', ['broken']),
    'failed',
  );
  const report = await runBatch(
    {
      version: 1,
      tests: [
        { id: 'healthy', runtime: 'node', script: 'pass.mjs', args: [] },
        { id: 'new', runtime: 'node', script: 'pass.mjs', args: [] },
        { id: 'broken', runtime: 'node', script: 'fail.mjs', args: [] },
      ],
    },
    history,
    { limit: 1 },
  );
  assert.deepEqual(report.order, ['broken', 'new', 'healthy']);
  assert.equal(report.run.state, 'stopped');
  assert.equal(report.cases.length, 1);
  assert.deepEqual(report.unexecuted, ['new', 'healthy']);
  assert.equal(
    history.get(testIdentity('verification', 'fail.mjs', ['broken']).id).total,
    2,
  );
  assert.equal(
    history.get(testIdentity('verification', 'pass.mjs', ['new']).id),
    undefined,
  );
  history.close();
});

test('real Vitest runner orders cases from persistent history and bails without deadlock or synthetic passes', () => {
  const { root, history } = fixture();
  const config = integrationConfig(root, 2);
  writeFileSync(
    resolve(root, 'cases.test.mjs'),
    `import{test,expect}from${JSON.stringify(testLibUrl)};test('healthy',()=>expect(1).toBe(1));test.skip('skip',()=>{});test('broken-one',()=>expect(1).toBe(2));test('broken-two',()=>expect(1).toBe(2));test('unstarted',()=>expect(1).toBe(1));`,
  );
  const seed = history.start(2);
  history.record(
    seed,
    'seed-one',
    testIdentity('vitest', 'cases.test.mjs', ['broken-one']),
    'failed',
  );
  history.record(
    seed,
    'seed-two',
    testIdentity('vitest', 'cases.test.mjs', ['broken-two']),
    'failed',
  );
  history.record(
    seed,
    'seed-healthy',
    testIdentity('vitest', 'cases.test.mjs', ['healthy']),
    'passed',
  );
  history.close();
  const result = runVitest(root, config, 'threshold');
  assert.equal(result.status, 1, result.stdout + '\n' + result.stderr);
  const after = new TestHistory(root, 'history');
  const saved = latestReport(after);
  const cases = saved.cases.filter((row) => row.kind === 'vitest');
  assert.deepEqual(
    cases.map((row) => row.name),
    ['broken-one', 'broken-two'],
  );
  assert.ok(cases.every((row) => row.total === 2 && row.passed === 0));
  assert.equal(
    after.get(testIdentity('vitest', 'cases.test.mjs', ['healthy']).id).total,
    1,
  );
  assert.equal(
    after.get(testIdentity('vitest', 'cases.test.mjs', ['unstarted']).id),
    undefined,
  );
  assert.equal(saved.run.state, 'stopped');
  after.close();
});

test('real multi-file sorting survives restart and a repaired test improves its full historical fraction', () => {
  const { root, history } = fixture();
  const config = integrationConfig(root, 1);
  const previous = history.start(1);
  history.record(
    previous,
    'broken',
    testIdentity('vitest', 'z-risk.test.mjs', ['risk']),
    'failed',
  );
  history.record(
    previous,
    'healthy',
    testIdentity('vitest', 'a-healthy.test.mjs', ['healthy']),
    'passed',
  );
  history.close();
  writeFileSync(
    resolve(root, 'z-risk.test.mjs'),
    `import{test,expect}from${JSON.stringify(testLibUrl)};test('risk',()=>expect(1).toBe(2));`,
  );
  writeFileSync(
    resolve(root, 'a-healthy.test.mjs'),
    `import{test,expect}from${JSON.stringify(testLibUrl)};test('healthy',()=>expect(1).toBe(1));`,
  );
  assert.equal(runVitest(root, config, 'failure').status, 1);
  let after = new TestHistory(root, 'history');
  assert.deepEqual(
    latestReport(after)
      .cases.filter((row) => row.kind === 'vitest')
      .map((row) => row.file),
    ['z-risk.test.mjs'],
  );
  assert.equal(
    after.get(testIdentity('vitest', 'a-healthy.test.mjs', ['healthy']).id)
      .total,
    1,
  );
  after.close();
  writeFileSync(
    resolve(root, 'z-risk.test.mjs'),
    `import{test,expect}from${JSON.stringify(testLibUrl)};test('risk',()=>expect(1).toBe(1));`,
  );
  const repaired = runVitest(root, config, 'repaired');
  assert.equal(repaired.status, 0, repaired.stdout + '\n' + repaired.stderr);
  after = new TestHistory(root, 'history');
  const saved = latestReport(after);
  assert.equal(saved.run.state, 'passed');
  assert.deepEqual(
    saved.cases.filter((row) => row.kind === 'vitest').map((row) => row.file),
    ['z-risk.test.mjs', 'a-healthy.test.mjs'],
  );
  const risk = after.get(
    testIdentity('vitest', 'z-risk.test.mjs', ['risk']).id,
  );
  assert.equal(risk.passed, 1);
  assert.equal(risk.total, 3);
  after.close();
});

test('a real failing suite hook stops later work without fabricating outcomes for unstarted test bodies', () => {
  const { root, history } = fixture();
  const config = integrationConfig(root, 1);
  history.close();
  writeFileSync(
    resolve(root, 'hooks.test.mjs'),
    `import{describe,beforeAll,test,expect}from${JSON.stringify(testLibUrl)};describe('broken-group',()=>{beforeAll(()=>{throw Error('fixture hook failure')});test('unstarted-body',()=>expect(1).toBe(1));});test('later',()=>expect(1).toBe(1));`,
  );
  const result = runVitest(root, config, 'hook');
  assert.equal(result.status, 1, result.stdout + '\n' + result.stderr);
  const after = new TestHistory(root, 'history');
  const saved = latestReport(after);
  assert.equal(saved.run.state, 'stopped');
  assert.equal(saved.run.failures, 1);
  assert.equal(saved.cases.filter((row) => row.kind === 'vitest').length, 0);
  assert.equal(
    saved.cases.filter(
      (row) => row.kind === 'vitest-suite' && row.status === 'failed',
    ).length,
    1,
  );
  after.close();
});

test('a real module collection error counts once and prevents the next file from starting', () => {
  const { root, history } = fixture();
  const config = integrationConfig(root, 1);
  const seed = history.start(1);
  history.record(
    seed,
    'seed-module',
    testIdentity('vitest-module', 'z-import.test.mjs', ['模块收集／生命周期']),
    'failed',
  );
  history.close();
  writeFileSync(
    resolve(root, 'z-import.test.mjs'),
    "throw Error('fixture collection failure');",
  );
  writeFileSync(
    resolve(root, 'a-healthy.test.mjs'),
    `import{test,expect}from${JSON.stringify(testLibUrl)};test('never-started',()=>expect(1).toBe(1));`,
  );
  const result = runVitest(root, config, 'collection');
  assert.equal(result.status, 1, result.stdout + '\n' + result.stderr);
  const after = new TestHistory(root, 'history');
  const saved = latestReport(after);
  assert.equal(saved.run.state, 'stopped');
  assert.equal(saved.run.failures, 1);
  assert.equal(saved.cases.length, 1);
  assert.equal(saved.cases[0].fraction, '0/2');
  assert.equal(
    after.get(
      testIdentity('vitest', 'a-healthy.test.mjs', ['never-started']).id,
    ),
    undefined,
  );
  after.close();
});

process.on('exit', () =>
  writeFileSync(
    resolve(evidence, 'fixtures.json'),
    JSON.stringify(
      {
        scope:
          'Isolated test history/cancellation fixtures, no formal saves or production server',
        roots,
      },
      null,
      2,
    ) + '\n',
  ),
);
