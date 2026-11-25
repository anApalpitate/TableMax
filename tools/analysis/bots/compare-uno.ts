import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { BotStrategy } from '../../../packages/game-sdk/src/index';
import { bot, rules } from '../../../games/uno';
import { createUnoSearchStrategy } from '../../../games/uno/bot/search-strategy';
import { evaluateBotMatch } from './evaluate';
import {
  completeUnoBlock,
  summarizeUnoComparison,
  unoArms,
  unoComparisonDecision,
  unoOpponentPools,
  type UnoPairedMatch,
  type UnoPairedSeed,
  type UnoPool,
} from './uno-paired-statistics';

interface Stratum {
  first: number[];
  extra: number[];
}
interface Plan {
  version: 1;
  looks: 1 | 2;
  bootstrapSeed: number;
  maxSteps: number;
  seeds: Record<UnoPool, Stratum>;
}

const { values } = parseArgs({
  options: {
    plan: { type: 'string' },
    calibration: { type: 'string' },
    correction: { type: 'string' },
    previous: { type: 'string' },
  },
});
if (!values.plan || !values.calibration || !values.correction) {
  throw new Error(
    'Pass --plan, --calibration and --correction; --previous is the stage-one report for expansion',
  );
}

const pools = Object.keys(unoOpponentPools) as UnoPool[];
const plan = JSON.parse(readFileSync(values.plan, 'utf8')) as Plan;
if (
  plan.version !== 1 ||
  ![1, 2].includes(plan.looks) ||
  !Number.isSafeInteger(plan.maxSteps) ||
  plan.maxSteps < 1 ||
  !Number.isInteger(plan.bootstrapSeed) ||
  plan.bootstrapSeed < 1 ||
  plan.bootstrapSeed > 0xffffffff ||
  !plan.seeds ||
  Object.keys(plan.seeds).length !== pools.length ||
  pools.some(
    (pool) =>
      !Array.isArray(plan.seeds[pool]?.first) ||
      plan.seeds[pool].first.length < 2 ||
      !Array.isArray(plan.seeds[pool].extra) ||
      (plan.looks === 1 && plan.seeds[pool].extra.length > 0) ||
      (plan.looks === 2 && plan.seeds[pool].extra.length < 1),
  )
)
  throw new Error('Invalid frozen paired plan');
const allSeeds = pools.flatMap((pool) => [
  ...plan.seeds[pool].first,
  ...plan.seeds[pool].extra,
]);
if (
  allSeeds.some(
    (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
  ) ||
  new Set(allSeeds).size !== allSeeds.length
)
  throw new Error(
    'Each original seed can occur only once across pools and stages',
  );

const calibration = JSON.parse(readFileSync(values.calibration, 'utf8'));
const candidate = JSON.parse(readFileSync(values.correction, 'utf8'));
if (
  calibration?.type !== 'uno-calibration-development' ||
  calibration?.evaluation !== 'meets-measured-gates' ||
  candidate?.type !== 'uno-residual-candidate' ||
  !(candidate?.model?.weight > 0)
)
  throw new Error(
    'Formal comparison requires a measured B calibration and a non-zero frozen C candidate',
  );
const hypotheses = calibration.options?.hypotheses;
if (hypotheses !== 8 && hypotheses !== 16)
  throw new Error('The search sample budget must come from the B report');
const sourceSeeds = [
  calibration.trainSeeds,
  calibration.holdoutSeeds,
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

const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
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
const planDigest = hash({
  plan,
  calibrationDigest,
  candidateDigest,
  rules: rules.manifest,
  reference: bot.version,
});
interface Previous {
  planDigest: string;
  decision: string;
  stage: number;
  blocks: UnoPairedSeed[];
}
const previous: Previous | null = values.previous
  ? JSON.parse(readFileSync(values.previous, 'utf8'))
  : null;
if (previous) {
  const expected = pools.flatMap((pool) =>
    plan.seeds[pool].first.map((seed) => `${pool}/${seed}`),
  );
  const supplied = Array.isArray(previous.blocks)
    ? previous.blocks.map(({ pool, seed }) => `${pool}/${seed}`)
    : [];
  if (
    plan.looks !== 2 ||
    previous.stage !== 1 ||
    previous.planDigest !== planDigest ||
    previous.decision !== 'expand' ||
    expected.length !== supplied.length ||
    !expected.every((key, index) => key === supplied[index]) ||
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
    ) !== 'expand'
  )
    throw new Error(
      'Expansion requires the unchanged, complete first-stage report',
    );
}
const selected = pools.flatMap((pool) => {
  const seedList = previous ? plan.seeds[pool].extra : plan.seeds[pool].first;
  return seedList.map((seed, index) => ({
    pool,
    seed,
    ordinal: index + (previous ? plan.seeds[pool].first.length : 0),
  }));
});
const permutations = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
] as const;
const blocks: UnoPairedSeed[] = [...(previous?.blocks ?? [])];
let failures = 0;
for (const { pool, seed, ordinal } of selected) {
  if (failures >= 10) break;
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
          { rules, seats, seed },
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
  blocks.push({ pool, seed, matches });
  console.error(
    JSON.stringify({ pool, seed, matches: matches.length, failures }),
  );
}
const stage = previous ? 2 : 1;
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
      stage,
      planDigest,
      plan,
      calibrationDigest,
      candidateDigest,
      failures,
      poolWeights: unoOpponentPools,
      blocks,
      undispatched: selected.filter(
        ({ seed }) => !blocks.some((block) => block.seed === seed),
      ),
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
      decision: unoComparisonDecision(
        main,
        blocks,
        plan.looks === 2 && stage === 1,
      ),
    },
    null,
    2,
  ),
);
