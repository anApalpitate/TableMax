import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs, promisify } from 'node:util';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';
import { calibrationSeeds } from './uno-calibration-provenance';
import { matchesUnoCorrectionCalibration } from './uno-correction-provenance';
import { correctionSeeds } from './uno-correction-seeds';
import {
  createUnoComparisonEvaluator,
  runUnoComparisonBlock,
  type UnoComparisonInputs,
  type UnoComparisonMatch,
} from './uno-comparison-match';
import {
  completeUnoBlock,
  summarizeUnoComparison,
  unoComparisonDecision,
  unoOpponentPools,
  type UnoPairedMatch,
  type UnoPairedSeed,
} from './uno-paired-statistics';
import {
  followsUnoComparisonSeeds,
  matchesUnoComparisonStage,
  matchesUnoPlanSelection,
  selectUnoComparisonSeeds,
  unoComparisonDigest,
  validateUnoComparisonPlan,
  type UnoComparisonPlan,
} from './uno-comparison-plan';
import { openTrainingCheckpoint } from './training-checkpoint';

const { values } = parseArgs({
  options: {
    plan: { type: 'string' },
    calibration: { type: 'string' },
    correction: { type: 'string' },
    previous: { type: 'string' },
    checkpoint: { type: 'string' },
    development: { type: 'boolean', default: false },
    'development-control': { type: 'string' },
    'steps-per-run': { type: 'string' },
    jobs: { type: 'string', default: '1' },
  },
});
if (!values.plan || !values.calibration || !values.correction) {
  throw new Error(
    'Pass --plan, --calibration and --correction; --previous is the stage-one report for expansion',
  );
}

const maximumJobs = Math.min(8, Math.max(1, availableParallelism() - 2));
const jobs = Number(values.jobs);
if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > maximumJobs)
  throw new Error('Choose between 1 and ' + maximumJobs + ' comparison jobs');

const stepsPerRun =
  values['steps-per-run'] === undefined
    ? Infinity
    : Number(values['steps-per-run']);
if (
  values['steps-per-run'] !== undefined &&
  (!values.checkpoint || !Number.isSafeInteger(stepsPerRun) || stepsPerRun < 1)
) {
  throw new Error('A positive step limit requires --checkpoint');
}
const sha = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
function report(path: string) {
  const bytes = readFileSync(path);
  return { value: JSON.parse(bytes.toString('utf8')), sha256: sha(bytes) };
}
const plan = report(values.plan).value as UnoComparisonPlan;
const allSeeds = validateUnoComparisonPlan(plan);
if (values.development && (plan.looks !== 1 || values.previous))
  throw new Error('Development sizing uses a separate one-stage seed plan');
if (values['development-control'] && !values.development)
  throw new Error(
    'Cached A/B matches are only available in development comparisons',
  );
if (values.development && plan.selection)
  throw new Error('A frozen acceptance plan uses the formal comparison path');
const calibrationReport = report(values.calibration);
const candidateReport = report(values.correction);
const calibration = calibrationReport.value;
const candidate = candidateReport.value;
if (
  !matchesUnoPlanSelection(
    plan,
    calibrationReport.sha256,
    candidateReport.sha256,
  )
)
  throw new Error('Formal comparison must use the selected B and C reports');
if (
  calibration?.type !== 'uno-calibration-development' ||
  calibration?.evaluation !== 'meets-measured-gates' ||
  candidate?.type !== 'uno-residual-candidate' ||
  !isCurrentUnoPilot(calibration.pilot) ||
  !isCurrentUnoPilot(candidate?.pilot) ||
  !(candidate?.model?.weight > 0)
)
  throw new Error(
    'Formal comparison requires a measured B calibration and a non-zero frozen C candidate',
  );
const hypotheses = calibration.options?.hypotheses;
if (hypotheses !== 8 && hypotheses !== 16)
  throw new Error('The search sample budget must come from the B report');
const sourceSeeds = [
  ...calibrationSeeds(calibration),
  ...correctionSeeds(candidate),
];
const excluded = new Set(sourceSeeds);
if (excluded.size !== sourceSeeds.length)
  throw new Error(
    'The B calibration and C development seed partitions overlap',
  );
if (allSeeds.some((seed) => excluded.has(seed)))
  throw new Error(
    'Formal comparison or expansion reuses a model development seed',
  );

const hash = (value: unknown) => sha(JSON.stringify(value));
const calibrationDigest = hash(calibration.calibration);
const candidateDigest = hash(candidate.model);
if (
  calibration.calibrationDigest !== calibrationDigest ||
  !matchesUnoCorrectionCalibration(
    candidate,
    calibration,
    calibrationReport.sha256,
  )
)
  throw new Error(
    'B and C must share the exact frozen calibration report and search sample budget',
  );
const input: UnoComparisonInputs = {
  calibration: calibration.calibration,
  calibrationDigest,
  hypotheses,
  correction: candidate.model,
  candidateDigest,
  maxSteps: plan.maxSteps,
};
const playLocally = createUnoComparisonEvaluator(input);
const root = new URL('../../../', import.meta.url);
function sourceDigest() {
  const gameDirectories = ['bot', 'data', 'rules'];
  const files = [
    ...gameDirectories.flatMap((directory) => {
      const path = 'games/uno/' + directory + '/';
      return readdirSync(new URL(path, root), { withFileTypes: true })
        .filter(
          (item) =>
            item.isFile() &&
            item.name.endsWith('.ts') &&
            !item.name.endsWith('.test.ts') &&
            item.name !== 'test-fixtures.ts',
        )
        .map((item) => path + item.name);
    }),
    ...['index', 'config', 'types'].map((name) => 'games/uno/' + name + '.ts'),
    ...['bot-scheduler', 'game-actions', 'random'].map(
      (name) => 'packages/platform-core/src/' + name + '.ts',
    ),
    ...[
      'compare-uno',
      'evaluate',
      'uno-pilot',
      'uno-comparison-plan',
      'uno-comparison-match',
      'uno-comparison-worker',
      'uno-paired-statistics',
      'uno-calibration-provenance',
      'uno-correction-provenance',
      'uno-correction-seeds',
      'training-checkpoint',
    ].map((name) => 'tools/analysis/bots/' + name + '.ts'),
  ].sort();
  return hash(
    files.map((file) => [file, sha(readFileSync(new URL(file, root)))]),
  );
}
const sourceSha256 = sourceDigest();
const planDigest = unoComparisonDigest(
  plan,
  calibrationReport.sha256,
  candidateReport.sha256,
  sourceSha256,
  process.version,
);
interface Previous {
  type: string;
  planDigest: string;
  decision: string;
  stage: number;
  failures: number;
  undispatched: unknown[];
  blocks: UnoPairedSeed[];
}
const previousReport = values.previous ? report(values.previous) : null;
const previous: Previous | null = previousReport?.value ?? null;
if (
  previousReport &&
  (!previous ||
    previous.type !== 'uno-abc-acceptance' ||
    previous.stage !== 1 ||
    previous.planDigest !== planDigest ||
    previous.decision !== 'expand' ||
    previous.failures !== 0 ||
    !Array.isArray(previous.undispatched) ||
    previous.undispatched.length !== 0 ||
    plan.looks !== 2 ||
    !matchesUnoComparisonStage(plan, 1, previous.blocks) ||
    !previous.blocks.every(completeUnoBlock) ||
    unoComparisonDecision(
      summarizeUnoComparison(
        previous.blocks,
        'C',
        'B',
        plan.bootstrapSeed,
        plan.looks,
      ),
      previous.blocks,
      true,
    ) !== 'expand')
) {
  throw new Error(
    'Expansion requires the unchanged, complete first-stage report',
  );
}
const stage = previous ? 2 : 1;
const selected = selectUnoComparisonSeeds(plan, stage);
const controlReport = values['development-control']
  ? report(values['development-control'])
  : null;
const controls = controlReport?.value;
if (
  controlReport &&
  (controls?.type !== 'uno-abc-development' ||
    !isCurrentUnoPilot(controls.pilot) ||
    controls.sourceSha256 !== sourceSha256 ||
    !isDeepStrictEqual(controls.plan, plan) ||
    controls.node !== process.version ||
    controls.calibrationReportSha256 !== calibrationReport.sha256 ||
    typeof controls.candidateReportSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(controls.candidateReportSha256) ||
    controls.controlReportSha256 !== undefined ||
    controls.planDigest !==
      unoComparisonDigest(
        plan,
        calibrationReport.sha256,
        controls.candidateReportSha256,
        sourceSha256,
        process.version,
      ) ||
    controls.failures !== 0 ||
    !Array.isArray(controls.undispatched) ||
    controls.undispatched.length !== 0 ||
    !matchesUnoComparisonStage(plan, 1, controls.blocks) ||
    !(controls.blocks as UnoPairedSeed[]).every(
      (block) =>
        completeUnoBlock(block) &&
        block.matches.every(
          (match) =>
            Number.isSafeInteger(match.steps) &&
            match.steps! > 0 &&
            match.steps! <= plan.maxSteps &&
            typeof match.traceDigest === 'string' &&
            /^[a-f0-9]{64}$/.test(match.traceDigest),
        ),
    ))
)
  throw new Error(
    'Reusing A/B needs an original, complete development report with the same frozen inputs',
  );
const checkpoint = values.checkpoint
  ? openTrainingCheckpoint<UnoPairedSeed[]>(
      values.checkpoint,
      hash({
        planDigest,
        stage,
        development: values.development,
        previousReportSha256: previousReport?.sha256,
        controlReportSha256: controlReport?.sha256,
      }),
      [],
    )
  : null;
const current = checkpoint?.state ?? [];
if (!followsUnoComparisonSeeds(current, selected, true))
  throw new Error(
    'Comparison checkpoint does not follow the frozen seed order',
  );
function assertSource() {
  if (sourceDigest() !== sourceSha256)
    throw new Error('Comparison source changed during the frozen run');
}
const stopped = new AbortController();
const stop = () => stopped.abort(new Error('UNO comparison interrupted'));
const worker = fileURLToPath(
  new URL('./uno-comparison-worker.ts', import.meta.url),
);
const exec = promisify(execFile);
async function playInChild(match: UnoComparisonMatch): Promise<UnoPairedMatch> {
  let output: string;
  try {
    output = (
      await exec(
        process.execPath,
        ['--import', 'tsx', worker, JSON.stringify({ input, match })],
        {
          windowsHide: true,
          encoding: 'utf8',
          maxBuffer: 32768,
          signal: stopped.signal,
        },
      )
    ).stdout;
  } catch (error) {
    throw new Error('UNO comparison process failed', { cause: error });
  }
  return JSON.parse(output) as UnoPairedMatch;
}
let failures = current.reduce(
  (total, block) =>
    total + block.matches.filter((match) => match.outcome !== 'ended').length,
  0,
);
let remainingSteps = stepsPerRun;
if (jobs > 1) {
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
try {
  for (const assignment of selected.slice(current.length)) {
    if (failures >= 10 || remainingSteps === 0) break;
    const block = await runUnoComparisonBlock(
      assignment,
      jobs,
      10 - failures,
      jobs === 1 ? playLocally : playInChild,
      stopped.signal,
      controls?.blocks[current.length],
    );
    failures += block.failures;
    const { pool, seed } = assignment;
    current.push({ pool, seed, matches: block.matches });
    if (checkpoint) {
      assertSource();
      checkpoint.save(current);
    }
    remainingSteps--;
    console.error(
      JSON.stringify({
        pool,
        seed,
        matches: block.matches.length,
        failures,
        completed: current.length,
        planned: selected.length,
      }),
    );
  }
} finally {
  if (jobs > 1) {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
assertSource();
if (remainingSteps === 0 && failures < 10 && current.length < selected.length) {
  console.log(
    JSON.stringify({
      type: 'uno-abc-progress',
      stage,
      planDigest,
      failures,
      recordedBlocks: current.length,
      plannedBlocks: selected.length,
      development: values.development,
    }),
  );
} else if (values.development) {
  console.log(
    JSON.stringify(
      {
        type: 'uno-abc-development',
        pilot: unoPilotEvidence,
        plan,
        planDigest,
        sourceSha256,
        node: process.version,
        calibrationReportSha256: calibrationReport.sha256,
        candidateReportSha256: candidateReport.sha256,
        controlReportSha256: controlReport?.sha256,
        failures,
        blocks: current,
        undispatched: selected.slice(current.length),
        main:
          failures === 0 && current.length === selected.length
            ? summarizeUnoComparison(current, 'C', 'B', plan.bootstrapSeed, 1)
            : null,
      },
      null,
      2,
    ),
  );
} else {
  const blocks = [...(previous?.blocks ?? []), ...current];
  const undispatched = selected.slice(current.length);
  const main = summarizeUnoComparison(
    blocks,
    'C',
    'B',
    plan.bootstrapSeed,
    plan.looks,
  );
  console.log(
    JSON.stringify(
      {
        type: 'uno-abc-acceptance',
        pilot: unoPilotEvidence,
        stage,
        planDigest,
        sourceSha256,
        node: process.version,
        plan,
        calibrationDigest,
        candidateDigest,
        failures,
        poolWeights: unoOpponentPools,
        blocks,
        undispatched,
        main,
        baselineComparison: summarizeUnoComparison(
          blocks,
          'B',
          'A',
          plan.bootstrapSeed,
          plan.looks,
        ),
        candidateComparison: summarizeUnoComparison(
          blocks,
          'C',
          'A',
          plan.bootstrapSeed,
          plan.looks,
        ),
        decision:
          undispatched.length > 0
            ? 'incomplete-blocks'
            : unoComparisonDecision(
                main,
                blocks,
                plan.looks === 2 && stage === 1,
              ),
      },
      null,
      2,
    ),
  );
}
