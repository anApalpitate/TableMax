import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { fingerprint, createFingerprintStage } from './evidence.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

assertWorkspaceRoot();
if (process.argv.length !== 2)
  throw new Error('This fixed tooling benchmark takes no arguments');
mkdirSync('tmp', { recursive: true });
const root = mkdtempSync(resolve('tmp/efficiency-verification-'));
const output = resolve(
  'artifacts/maintenance/development-efficiency/verification',
);
mkdirSync(output, { recursive: true });
const baselineRevision = '2c06c47f8e7e90da0277bed6518156351119f968';
process.once('uncaughtException', (error) => {
  writeFileSync(
    join(output, 'benchmark-failed-' + root.slice(-6) + '.json'),
    JSON.stringify(
      {
        result: 'failed',
        fixture: root,
        error: error.message,
        stack: error.stack,
      },
      null,
      2,
    ) + '\n',
  );
  process.exitCode = 1;
});
for (const name of ['evidence.mjs', 'plan.mjs', 'run-plan.mjs']) {
  let source = execFileSync(
    'git',
    ['show', baselineRevision + ':tools/test/runner/' + name],
    {
      encoding: 'utf8',
    },
  );
  if (name === 'evidence.mjs') {
    source = source.replace(
      '  readFileSync,',
      '  readFileSync as originalReadFileSync,',
    );
    source +=
      '\nexport const observed = { reads: 0, bytesRead: 0 };\nfunction readFileSync(...args) { const result=originalReadFileSync(...args); observed.reads++; observed.bytesRead+=Buffer.byteLength(result); return result; }\n';
  }
  writeFileSync(join(root, name), source);
}
for (let i = 0; i < 24; i++)
  writeFileSync(
    join(root, 'module-' + i + '.mjs'),
    'export const value = ' + i + ';\n//' + 'fixed-input '.repeat(2048),
  );
writeFileSync(
  join(root, 'check.mjs'),
  Array.from({ length: 24 }, (_, i) => "import './module-" + i + ".mjs';").join(
    '\n',
  ),
);
const item = {
  runtime: 'node',
  script: 'check.mjs',
  args: [],
  inputs: { complete: true },
  environmentProviders: process.platform === 'win32' ? ['powershell'] : [],
};
const legacy = await import(pathToFileURL(join(root, 'evidence.mjs')));
const cache = new Map(),
  startedLegacy = performance.now();
let oldBinding;
for (let i = 0; i < 4; i++)
  oldBinding = legacy.fingerprint(root, item, { cache });
const before = {
  durationMs: performance.now() - startedLegacy,
  ...legacy.observed,
  environmentQueries: item.environmentProviders.length * 4,
};
const stage = createFingerprintStage(),
  startedCurrent = performance.now();
let newBinding;
for (let i = 0; i < 4; i++) newBinding = fingerprint(root, item, { stage });
const after = {
  durationMs: performance.now() - startedCurrent,
  ...stage.metrics,
};
assert.deepEqual(newBinding.value.files, oldBinding.value.files);
assert.deepEqual(newBinding.value.environment, oldBinding.value.environment);
assert.ok(after.reads < before.reads);
writeFileSync(
  join(root, 'tsconfig.json'),
  JSON.stringify({
    extends: '../../tsconfig.json',
    compilerOptions: { noUnusedLocals: false },
    files: ['fixture.ts'],
    include: [],
  }),
);
const invalid = 'export const value: number = "1";';
writeFileSync(join(root, 'fixture.ts'), invalid);
function compile(incremental) {
  const started = performance.now();
  const args = [
    'tools/test/runner/typecheck.mjs',
    '--project',
    join(root, 'tsconfig.json'),
    '--noEmit',
    '--pretty',
    'false',
  ];
  if (incremental)
    args.push('--incremental-cache=' + join(root, 'typecheck-cache'));
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, TABLEMAX_AUTO_MAINTENANCE: '0' },
  });
  if (result.error) throw result.error;
  return {
    durationMs: performance.now() - started,
    status: result.status,
    diagnostics: result.stdout,
    stderr: result.stderr,
  };
}
const ordinary = compile(false),
  cold = compile(true),
  warm = compile(true);
assert.notEqual(ordinary.status, 0);
assert.notEqual(cold.status, 0);
assert.notEqual(warm.status, 0);
assert.equal(cold.diagnostics, ordinary.diagnostics);
assert.equal(warm.diagnostics, ordinary.diagnostics);
writeFileSync(join(root, 'fixture.ts'), invalid.replace('"1"', '  1'));
const changed = compile(true);
assert.equal(changed.status, 0);
const report = {
  result: 'passed',
  createdAt: new Date().toISOString(),
  fixture: root,
  boundary:
    'Fixed Node/TypeScript tooling fixture; one local sample, no product or game performance claim',
  node: process.versions.node,
  baseline: baselineRevision,
  methods: { before: oldBinding.value.method, after: newBinding.value.method },
  fingerprint: { before, after, equivalentInputAndEnvironmentFacts: true },
  typecheck: {
    ordinary,
    cold,
    warm,
    changed,
    diagnosticsEqual: true,
    sameLengthChangeDetected: true,
  },
};
const reportPath = join(output, 'benchmark-' + root.slice(-6) + '.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    reportPath,
    fingerprintBeforeMs: before.durationMs,
    fingerprintAfterMs: after.durationMs,
    readsBefore: before.reads,
    readsAfter: after.reads,
    ordinaryTypecheckMs: ordinary.durationMs,
    coldTypecheckMs: cold.durationMs,
    warmTypecheckMs: warm.durationMs,
    diagnosticsEqual: true,
  }),
);
