import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const run = process.argv
  .find((arg) => arg.startsWith('--evidence='))
  ?.slice(11);
assert.match(run ?? '', /^[a-z0-9-]+$/);
const output = resolve('artifacts/maintenance/bot-rise-idle-20261126', run);
const root = resolve(
  'tmp',
  process.env.TABLEMAX_TASK_ID ?? 'bot-rise-idle-20261126',
);
mkdirSync(output, { recursive: true });
mkdirSync(root, { recursive: true });
const profile = mkdtempSync(join(root, 'watcher-'));
const learning = join(profile, 'learning');
mkdirSync(learning);
const leasePath = join(learning, 'training-lease.json');
const workerPath = join(learning, 'training-worker.json');
const checkpoint = join(learning, 'jobs', 'fixture', 'checkpoint.json');
const candidate = join(learning, 'jobs', 'fixture', 'candidate.json');
const session = randomUUID();
let allowed = false;
let heartbeatWriteConflicts = 0;

function writeLease() {
  const temporary = leasePath + '.next';
  writeFileSync(
    temporary,
    JSON.stringify({
      version: 1,
      session,
      allowed,
      expiresAt: Date.now() + 2400,
    }),
  );
  try {
    renameSync(temporary, leasePath);
  } catch (error) {
    unlinkSync(temporary);
    if (
      error.code !== 'EPERM' &&
      error.code !== 'EBUSY' &&
      error.code !== 'EACCES'
    )
      throw error;
    heartbeatWriteConflicts++;
    // Windows can briefly hold the old record open. The next heartbeat retries,
    // and a previously published allowance can only live for one lease TTL.
  }
}

function read(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function waitFor(check, time, label) {
  const until = Date.now() + time;
  while (Date.now() < until) {
    if (check()) return;
    if (child.exitCode !== null)
      throw new Error('Watcher exited before ' + label + '\n' + diagnostic);
    await delay(70);
  }
  throw new Error('Timed out waiting for ' + label + '\n' + diagnostic);
}

// These coefficients qualify only the subprocess fixture. Never use this
// artificial report to promote a real game model.
const features = [
  'bias',
  'own-score',
  'leading-rival-score',
  'round-settled',
  'own-hand-count',
  'own-hand-value',
  'own-match-count',
  'smallest-rival-hand',
  'acts-next',
  'pending-draw-count',
  'pending-draw-target',
  'pending-challenge',
];
const calibration = {
  version: 1,
  features,
  coefficients: features.map(() => 0),
};
const supplied = join(profile, 'fixture-calibration.json');
writeFileSync(
  supplied,
  JSON.stringify({
    type: 'uno-calibration-development',
    evaluation: 'meets-measured-gates',
    calibration,
    calibrationDigest: createHash('sha256')
      .update(JSON.stringify(calibration))
      .digest('hex'),
    trainSeeds: [41],
    holdoutSeeds: [42],
    options: { hypotheses: 8 },
  }),
);
writeLease();
const heartbeat = setInterval(writeLease, 300);
const child = spawn(
  process.execPath,
  [
    '--import',
    'tsx',
    'tools/analysis/bots/watch-uno-training.ts',
    '--data-dir',
    profile,
    '--job',
    'fixture',
    '--calibration',
    supplied,
    '--train-seeds',
    '1041,1042',
    '--tune-seeds',
    '3041,3042',
    '--roots',
    '1',
    '--continuations',
    '1',
  ],
  { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
let diagnostic = '';
child.stdout.on('data', (chunk) => {
  diagnostic = (diagnostic + chunk.toString()).slice(-8192);
});
child.stderr.on('data', (chunk) => {
  diagnostic = (diagnostic + chunk.toString()).slice(-8192);
});
const closed = new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('close', resolve);
});
const report = { fixture: true, checks: [], result: 'failed' };
try {
  await delay(1200);
  assert.equal(existsSync(checkpoint), false);
  report.checks.push('No training checkpoint while the lease is denied');
  allowed = true;
  writeLease();
  await waitFor(
    () => read(workerPath)?.stage === 'running',
    15000,
    'first idle slice',
  );
  const pause = Date.now();
  allowed = false;
  writeLease();
  await waitFor(
    () => read(workerPath)?.stage === 'paused',
    2500,
    'cooperative pause',
  );
  report.pauseMs = Date.now() - pause;
  assert.equal(existsSync(candidate), false);
  report.checks.push(
    'Revocation pauses the active slice without publishing a candidate',
  );
  allowed = true;
  writeLease();
  await waitFor(
    () => read(checkpoint)?.state?.trainingSeeds?.length >= 1,
    90000,
    'a resumed checkpoint',
  );
  allowed = false;
  writeLease();
  await waitFor(
    () => read(workerPath)?.stage === 'paused',
    2500,
    'second cooperative pause',
  );
  assert.equal(existsSync(candidate), false);
  report.completedSeeds = read(checkpoint).state.trainingSeeds.length;
  report.checks.push(
    'Permission renewal resumes the same job and writes a complete checkpoint unit',
  );
  report.heartbeatWriteConflicts = heartbeatWriteConflicts;
  report.result = 'passed';
} catch (error) {
  report.error = error.stack;
  throw error;
} finally {
  allowed = false;
  writeLease();
  clearInterval(heartbeat);
  child.kill();
  await closed;
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, output }));
}
