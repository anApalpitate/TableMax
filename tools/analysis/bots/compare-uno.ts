import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { BotStrategy } from '../../../packages/game-sdk/src/index';
import { bot, rules } from '../../../games/uno';
import { createUnoSearchStrategy } from '../../../games/uno/bot/search-strategy';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';
import { calibrationSeeds } from './uno-calibration-provenance';
import { evaluateBotMatch } from './evaluate';
import {
  completeUnoBlock,
  summarizeUnoComparison,
  unoArms,
  unoComparisonDecision,
  unoOpponentPools,
  type UnoPairedMatch,
  type UnoPairedSeed,
} from './uno-paired-statistics';
import {
  followsUnoComparisonSeeds,
  matchesUnoComparisonStage,
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
    'steps-per-run': { type: 'string' },
  },
});
if (!values.plan || !values.calibration || !values.correction) {
  throw new Error(
    'Pass --plan, --calibration and --correction; --previous is the stage-one report for expansion',
  );
}

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
const calibrationReport = report(values.calibration);
const candidateReport = report(values.correction);
const calibration = calibrationReport.value;
const candidate = candidateReport.value;
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
  calibrationSeeds(calibration),
  candidate.trainSeeds,
  candidate.tuneSeeds,
  candidate.localCorpus?.seeds ?? [],
];
if (sourceSeeds.some((group) => !Array.isArray(group)))
  throw new Error('The B/C reports must identify their source seeds');
const excluded = new Set(sourceSeeds.flat());
if (allSeeds.some((seed) => excluded.has(seed)))
  throw new Error(
    'Formal comparison or expansion reuses a model development seed',
  );

const hash = (value: unknown) => sha(JSON.stringify(value));
const calibrationDigest = hash(calibration.calibration);
const candidateDigest = hash(candidate.model);
if (
  calibration.calibrationDigest !== calibrationDigest ||
  candidate.calibrationDigest !== calibrationDigest
)
  throw new Error('B and C must share the same frozen calibration digest');
const strategies: Record<(typeof unoArms)[number], BotStrategy> = {
  A: bot,
  B: createUnoSearchStrategy(
    calibration.calibration,
    calibrationDigest,
    hypotheses,
  ),
  C: createUnoSearchStrategy(
    calibration.calibration,
    calibrationDigest,
    hypotheses,
    {
      model: candidate.model,
      digest: candidateDigest,
    },
  ),
};
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
      'uno-paired-statistics',
      'uno-calibration-provenance',
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
const checkpoint = values.checkpoint
  ? openTrainingCheckpoint<UnoPairedSeed[]>(
      values.checkpoint,
      hash({
        planDigest,
        stage,
        development: values.development,
        previousReportSha256: previousReport?.sha256,
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
const permutations = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
] as const;
let failures = current.reduce(
  (total, block) =>
    total + block.matches.filter((match) => match.outcome !== 'ended').length,
  0,
);
let remainingSteps = stepsPerRun;
for (const { pool, seed, ordinal } of selected.slice(current.length)) {
  if (failures >= 10 || remainingSteps === 0) break;
  const matches: UnoPairedMatch[] = [];
  const opponent = unoOpponentPools[pool].opponents;
  const permutation = permutations[ordinal % permutations.length]!;
  for (let seat = 0; seat < 4 && failures < 10; seat++) {
    for (const arm of unoArms) {
      if (failures >= 10) break;
      const seats = Array.from({ length: 4 }, (_, index) => {
        const id = `seat-${index + 1}`;
        const offset = (index + 4 - seat) % 4;
        return offset === 0
          ? { id, strategy: strategies[arm], difficulty: 'juewu' as const }
          : {
              id,
              strategy: bot,
              difficulty: opponent[permutation[offset - 1]!]!,
            };
      });
      try {
        const result = await evaluateBotMatch(
          { rules, seats, seed, setup: unoPilotEvidence.setup },
          { maxSteps: plan.maxSteps },
        );
        const winners = (result.publicResult as { winners?: unknown })?.winners;
        if (result.outcome === 'ended' && !Array.isArray(winners))
          throw new Error('Ended UNO match did not report winners');
        if (result.outcome !== 'ended') failures++;
        matches.push({
          arm,
          seat,
          outcome: result.outcome,
          won:
            result.outcome === 'ended'
              ? (winners as string[]).includes(seats[seat]!.id)
              : null,
          steps: result.checkpoint.steps,
          traceDigest: result.checkpoint.traceDigest,
        });
      } catch (error) {
        failures++;
        matches.push({
          arm,
          seat,
          outcome: 'failed',
          won: null,
          error:
            error instanceof Error
              ? error.message
              : 'Unknown UNO comparison error',
        });
      }
    }
  }
  current.push({ pool, seed, matches });
  if (checkpoint) {
    assertSource();
    checkpoint.save(current);
  }
  remainingSteps--;
  console.error(
    JSON.stringify({
      pool,
      seed,
      matches: matches.length,
      failures,
      completed: current.length,
      planned: selected.length,
    }),
  );
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
        failures,
        blocks: current,
        undispatched: selected.slice(current.length),
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
