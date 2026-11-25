import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { promisify, parseArgs } from 'node:util';

const { values } = parseArgs({ options: { evidence: { type: 'string' } } });
assert.match(values.evidence ?? '', /^[a-z0-9-]+$/);
const root = resolve(
  'tmp',
  process.env.TABLEMAX_TASK_ID ?? 'bot-rise-calibration-shards-20261126',
);
const output = resolve(
  'artifacts/maintenance/bot-rise-calibration-shards-20261126',
  values.evidence,
);
mkdirSync(root, { recursive: true });
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(root, 'seed-shards-'));
const path = join(scratch, 'checkpoint.json');
const args = [
  '--import',
  'tsx',
  'tools/analysis/bots/calibrate-uno.ts',
  '--train-seeds=1041,1042',
  '--holdout-seeds=3041,3042',
  '--roots=1',
  '--hypotheses=8',
  '--continuations=1',
  '--ranking-world-batches=2',
  '--ranking-continuations=1',
];
const exec = promisify(execFile);
const run = (extra = [], base = args) =>
  exec(process.execPath, [...base, ...extra], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 2 * 1024 * 1024,
  });
const [serial, staged] = await Promise.all([
  run(),
  run(['--jobs=2', '--steps-per-run=3', '--checkpoint=' + path]),
]);
const progress = JSON.parse(staged.stdout);
assert.equal(progress.type, 'uno-calibration-progress');
assert.equal(progress.fittedSeeds, 2);
assert.equal(progress.holdoutSeeds, 1);
const checkpoint = JSON.parse(readFileSync(path, 'utf8'));
assert.match(checkpoint.state.fittedDigest, /^[a-f0-9]{64}$/);
assert.deepEqual(Object.keys(checkpoint.state.fit), ['1041', '1042']);
assert.deepEqual(Object.keys(checkpoint.state.holdout), ['3041']);

await assert.rejects(
  run(
    ['--checkpoint=' + path],
    args.map((flag) =>
      flag.startsWith('--holdout-seeds=') ? '--holdout-seeds=3041,3043' : flag,
    ),
  ),
  /checkpoint belongs to different frozen inputs/,
);

const resumed = await run(['--jobs=2', '--checkpoint=' + path]);
assert.equal(
  resumed.stdout,
  serial.stdout,
  'Resumed and serial calibration reports must match exactly',
);
const launched = resumed.stderr
  .split(/\r?\n/)
  .filter((line) => line.startsWith('{'))
  .map((line) => JSON.parse(line));
assert.deepEqual(
  launched.map(({ seed }) => seed),
  [3042],
);
const final = JSON.parse(resumed.stdout);
assert.equal(final.batchDigest, progress.batchDigest);
assert.equal(final.evaluation, 'insufficient');
assert.deepEqual(final.rankingBudget, { worldBatches: 2, continuations: 1 });
assert.ok(final.fitRows > 0 && final.overall.rows > 0);
writeFileSync(
  join(output, 'report.json'),
  JSON.stringify(
    {
      result: 'passed',
      fixtureOnly: true,
      fittedSeeds: progress.fittedSeeds,
      finishedHoldoutBeforeResume: progress.holdoutSeeds,
      dispatchedAfterResume: launched.map(({ seed }) => seed),
      byteIdenticalToSerial: true,
      changedSeedListRejected: true,
      summarySha256: createHash('sha256').update(resumed.stdout).digest('hex'),
      fitRows: final.fitRows,
      holdoutRows: final.overall.rows,
      sourceSha256: final.sourceSha256,
      batchDigest: final.batchDigest,
    },
    null,
    2,
  ) + '\n',
);
