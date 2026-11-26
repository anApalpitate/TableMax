import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  assertLearningBudget,
  learningJobByteLimit,
} from '../../../packages/platform-core/src/learning-storage';
import {
  readTrainingLease,
  writeTrainingControl,
} from '../../../packages/platform-core/src/training-lease';

import { isCurrentUnoPilot } from './uno-pilot';
import { matchesUnoCorrectionCalibration } from './uno-correction-provenance';
import { parseUnoHumanReview, readUnoHumanReview } from './uno-human-review';

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    job: { type: 'string' },
    calibration: { type: 'string' },
    'train-seeds': { type: 'string' },
    'tune-seeds': { type: 'string' },
    roots: { type: 'string', default: '2' },
    continuations: { type: 'string', default: '16' },
    'max-steps': { type: 'string', default: '15000' },
    'include-recorded': { type: 'boolean' },
    'learning-review': { type: 'string' },
  },
});
if (
  !values['data-dir'] ||
  !values.job ||
  !/^[a-z0-9][a-z0-9-]{0,39}$/.test(values.job) ||
  !values.calibration ||
  !values['train-seeds'] ||
  !values['tune-seeds']
)
  throw new Error(
    'Pass --data-dir, --job, --calibration, --train-seeds and --tune-seeds',
  );
if (process.platform !== 'win32')
  throw new Error(
    'The TableMax local training watcher uses a Windows named mutex pipe',
  );

function readBounded(path: string, limit: number) {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > limit)
    throw new Error('Invalid local training input: ' + path);
  const bytes = readFileSync(path);
  if (bytes.length > limit)
    throw new Error('Local input grew during read: ' + path);
  return bytes;
}
function ensureDirectory(path: string) {
  const entry = lstatSync(path, { throwIfNoEntry: false });
  if (!entry) mkdirSync(path);
  else if (!entry.isDirectory() || entry.isSymbolicLink())
    throw new Error('Invalid local training directory');
}
function writeSealed(path: string, bytes: Buffer | string) {
  if (lstatSync(path, { throwIfNoEntry: false }))
    throw new Error('The sealed training file already exists');
  const temporary = path + '.' + randomUUID() + '.tmp';
  assertLearningBudget(
    dirname(dirname(path)),
    Buffer.byteLength(bytes),
    learningJobByteLimit,
  );
  writeFileSync(temporary, bytes, { flag: 'wx', flush: true, mode: 0o600 });
  try {
    renameSync(temporary, path);
  } catch (error) {
    unlinkSync(temporary);
    throw error;
  }
}
const sha256 = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const profile = realpathSync(values['data-dir']);
const learning = join(profile, 'learning');
const leaseFile = join(learning, 'training-lease.json');
const workerFile = join(learning, 'training-worker.json');
const calibration = readBounded(values.calibration, 1024 * 1024);
const accepted = JSON.parse(calibration.toString('utf8'));
if (
  accepted?.type !== 'uno-calibration-development' ||
  accepted.evaluation !== 'meets-measured-gates' ||
  accepted.calibrationDigest !== sha256(JSON.stringify(accepted.calibration))
)
  throw new Error(
    'The watcher requires a B calibration report meeting the measured gates',
  );
if (!isCurrentUnoPilot(accepted.pilot))
  throw new Error('The B report does not match the current UNO pilot');

const seedList = (value: string) => {
  const seeds = value.split(',').map(Number);
  if (
    !seeds.length ||
    new Set(seeds).size !== seeds.length ||
    seeds.some(
      (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
    )
  )
    throw new Error('Invalid UNO training seed partition');
  return seeds;
};
const review = values['learning-review']
  ? readBounded(values['learning-review'], 1024 * 1024)
  : null;
if (review && !values['include-recorded'])
  throw new Error('UNO human review requires --include-recorded');
const plan = {
  version: 1,
  training: seedList(values['train-seeds']),
  tuning: seedList(values['tune-seeds']),
  roots: Number(values.roots),
  continuations: Number(values.continuations),
  maxSteps: Number(values['max-steps']),
  includeRecorded: values['include-recorded'] === true,
  calibration: sha256(calibration),
  ...(review ? { review: sha256(review) } : {}),
};
if (
  [plan.roots, plan.continuations, plan.maxSteps].some(
    (value) => !Number.isSafeInteger(value) || value < 1,
  ) ||
  plan.training.some((seed) => plan.tuning.includes(seed))
)
  throw new Error('Invalid UNO training plan');

const lock = createServer((socket) => socket.destroy());
await new Promise<void>((resolve, reject) => {
  lock.once('error', reject);
  lock.listen(
    {
      path:
        '\\\\.\\pipe\\TableMax.UnoLearning.' +
        sha256(profile.toLowerCase()).slice(0, 32),
      exclusive: true,
    },
    resolve,
  );
});

let stopped = false;
const stop = () => {
  stopped = true;
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
function status(
  session: string,
  stage: 'running' | 'paused' | 'candidate' | 'quota' | 'failed',
) {
  try {
    writeTrainingControl(workerFile, {
      version: 1,
      session,
      stage,
      writtenAt: Date.now(),
    });
    return true;
  } catch {
    // A missing display update does not grant permission to train.
    return false;
  }
}

let runningSession: string | null = null;
function pause() {
  if (runningSession !== null && status(runningSession, 'paused'))
    runningSession = null;
}

try {
  let initialized = false;
  const jobs = join(learning, 'jobs');
  const job = join(jobs, values.job);
  const calibrationPath = join(job, 'calibration.json');
  const corpusPath = join(job, 'uno-decisions-v1.jsonl');
  const reviewPath = join(job, 'uno-human-review.json');
  const planPath = join(job, 'plan.json');
  const output = join(job, 'candidate.json');
  const script = fileURLToPath(
    new URL('./train-uno-correction.ts', import.meta.url),
  );
  while (!stopped) {
    const lease = readTrainingLease(leaseFile);
    if (!lease?.allowed) {
      pause();
      await delay(500);
      continue;
    }
    if (!initialized) {
      ensureDirectory(learning);
      ensureDirectory(jobs);
      ensureDirectory(job);
      let corpusDigest: string | null = null;
      const present = lstatSync(planPath, { throwIfNoEntry: false });
      if (!present) {
        if (plan.includeRecorded) {
          const saved = lstatSync(corpusPath, { throwIfNoEntry: false });
          const input = readBounded(
            saved ? corpusPath : join(learning, 'uno-decisions-v1.jsonl'),
            16 * 1024 * 1024,
          );
          corpusDigest = sha256(input);
          const reviewSaved = lstatSync(reviewPath, { throwIfNoEntry: false });
          if (review && plan.review) {
            const inspected = reviewSaved
              ? readUnoHumanReview(reviewPath, corpusDigest)
              : parseUnoHumanReview(review, corpusDigest);
            if (inspected.digest !== plan.review)
              throw new Error(
                'The partially prepared job has different UNO human review bytes',
              );
          }
          if (!saved) writeSealed(corpusPath, input);
          if (review && !reviewSaved) writeSealed(reviewPath, review);
        }
        const saved = lstatSync(calibrationPath, { throwIfNoEntry: false });
        if (!saved) writeSealed(calibrationPath, calibration);
        else if (
          sha256(readBounded(calibrationPath, 1024 * 1024)) !== plan.calibration
        )
          throw new Error(
            'The partially prepared job has different calibration bytes',
          );
        writeSealed(planPath, JSON.stringify({ plan, corpusDigest }));
      } else {
        const frozen = JSON.parse(
          readBounded(planPath, 65536).toString('utf8'),
        );
        if (
          sha256(JSON.stringify(frozen.plan)) !==
            sha256(JSON.stringify(plan)) ||
          sha256(readBounded(calibrationPath, 1024 * 1024)) !== plan.calibration
        )
          throw new Error(
            'The requested plan differs from the frozen job. Use the original plan or a new job id.',
          );
        if (
          plan.includeRecorded &&
          sha256(readBounded(corpusPath, 16 * 1024 * 1024)) !==
            frozen.corpusDigest
        )
          throw new Error('The sealed training corpus changed');
        if (
          plan.review &&
          readUnoHumanReview(reviewPath, frozen.corpusDigest).digest !==
            plan.review
        )
          throw new Error('The sealed UNO human review changed');
      }
      if (lstatSync(output, { throwIfNoEntry: false })) {
        const candidate = JSON.parse(
          readBounded(output, 1024 * 1024).toString('utf8'),
        );
        if (
          !matchesUnoCorrectionCalibration(
            candidate,
            accepted,
            plan.calibration,
          ) ||
          !isCurrentUnoPilot(candidate.pilot)
        )
          throw new Error(
            'The existing candidate does not match this frozen job',
          );
        status(lease.session, 'candidate');
        console.log(JSON.stringify({ candidate: output }));
        break;
      }
      initialized = true;
    }
    const current = readTrainingLease(leaseFile);
    if (!current?.allowed || current.session !== lease.session) continue;
    runningSession = lease.session;
    status(lease.session, 'running');
    const args = [
      '--import',
      'tsx',
      script,
      '--calibration',
      calibrationPath,
      '--train-seeds',
      plan.training.join(','),
      '--tune-seeds',
      plan.tuning.join(','),
      '--roots',
      String(plan.roots),
      '--continuations',
      String(plan.continuations),
      '--max-steps',
      String(plan.maxSteps),
      '--steps-per-run',
      '1',
      '--checkpoint',
      join(job, 'checkpoint.json'),
      '--jobs-root',
      jobs,
      '--idle-lease',
      leaseFile,
      '--idle-session',
      lease.session,
      ...(plan.includeRecorded ? ['--learning-log', corpusPath] : []),
      ...(plan.review ? ['--learning-review', reviewPath] : []),
    ];
    const child = spawn(process.execPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let workerOutput = '';
    let diagnostic = '';
    child.stdout.on('data', (chunk: Buffer) => {
      workerOutput += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      diagnostic = (diagnostic + chunk.toString('utf8')).slice(-8192);
    });
    const monitor = setInterval(() => {
      const current = readTrainingLease(leaseFile);
      if (current?.allowed && current.session === lease.session)
        status(lease.session, 'running');
    }, 750);
    let code: number | null;
    try {
      code = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
    } finally {
      clearInterval(monitor);
    }
    if (code !== 0) {
      if (diagnostic.includes('UNO_IDLE_TRAINING_PAUSED')) {
        pause();
        continue;
      }
      if (!diagnostic.includes('UNO_LEARNING_QUOTA'))
        status(lease.session, 'failed');
      throw new Error(diagnostic || 'Local UNO training process failed');
    }
    const result = JSON.parse(workerOutput);
    if (result?.type === 'uno-residual-progress') {
      if (stopped) pause();
      continue;
    }
    if (
      !matchesUnoCorrectionCalibration(result, accepted, plan.calibration) ||
      !isCurrentUnoPilot(result.pilot)
    )
      throw new Error('Worker returned invalid candidate output');
    const finalLease = readTrainingLease(leaseFile);
    if (
      stopped ||
      !finalLease?.allowed ||
      finalLease.session !== lease.session
    ) {
      pause();
      continue;
    }
    writeSealed(output, workerOutput);
    status(lease.session, 'candidate');
    console.log(JSON.stringify({ candidate: output }));
    break;
  }
} catch (error) {
  const lease = readTrainingLease(leaseFile);
  if (
    lease &&
    error instanceof Error &&
    error.message.includes('UNO_LEARNING_QUOTA')
  )
    status(lease.session, 'quota');
  throw error;
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
  lock.close();
}
