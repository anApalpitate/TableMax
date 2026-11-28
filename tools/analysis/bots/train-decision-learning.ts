import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createGameRegistry } from '../../../apps/server/src/game-registry';
import { decisionLearningPilots } from './decision-learning-pilots';
import { decisionLearningSource } from './decision-learning-source';
import {
  decisionLearningInterval,
  labelLearningMatch,
  learningMatch,
  reviewLearningMatch,
} from './decision-learning';
import { fitModel, linearPrediction, type WeightedExample } from './fit';
import { openTrainingCheckpoint } from './training-checkpoint';
import { fitUnoOnGpu } from './uno-gpu-fit';

type Seeds = { train: number[]; tune: number[]; review: number[] };
type Label = Awaited<ReturnType<typeof labelLearningMatch>>;
type Review = Awaited<ReturnType<typeof reviewLearningMatch>>;
type GpuFit = { coefficients: number[]; device: string; torch: string };
type Checkpoint = {
  train: Label[];
  tune: Label[];
  fit?: GpuFit;
  review: Review[];
};
function hash(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
function average(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const { values } = parseArgs({
  options: {
    pilot: { type: 'string' },
    plan: { type: 'string' },
    checkpoint: { type: 'string' },
  },
});
const id = values.pilot as keyof typeof decisionLearningPilots | undefined;
if (
  !id ||
  !Object.hasOwn(decisionLearningPilots, id) ||
  !values.plan ||
  !values.checkpoint
)
  throw new Error(
    'Pass --pilot, --plan and --checkpoint for a frozen decision-learning run',
  );
const pilot = decisionLearningPilots[id];
const rawPlan = readFileSync(values.plan);
const plan = JSON.parse(rawPlan.toString('utf8')) as {
  version: number;
  pilots: Record<string, Seeds>;
  roots: number;
  maxSteps: number;
  bootstrapSeed: number;
};
const positiveSeed = (seed: unknown) =>
  typeof seed === 'number' &&
  Number.isSafeInteger(seed) &&
  seed >= 1 &&
  seed <= 0xffffffff;
if (
  plan.version !== 1 ||
  !Number.isSafeInteger(plan.roots) ||
  plan.roots < 1 ||
  plan.roots > 4 ||
  !Number.isSafeInteger(plan.maxSteps) ||
  plan.maxSteps < 1 ||
  !positiveSeed(plan.bootstrapSeed) ||
  !plan.pilots?.[id]
)
  throw new Error('Invalid learning plan');
const everySeed = Object.entries(plan.pilots).flatMap(([name, group]) => {
  if (
    !Object.hasOwn(decisionLearningPilots, name) ||
    ![group.train, group.tune, group.review].every(
      (list) => Array.isArray(list) && list.length >= 2,
    )
  )
    throw new Error('Learning plan needs three opening partitions per pilot');
  return [...group.train, ...group.tune, ...group.review];
});
if (
  !everySeed.every(positiveSeed) ||
  new Set(everySeed).size !== everySeed.length
)
  throw new Error('Each seed must be exclusive to one pilot and one partition');
const seeds = plan.pilots[id]!;
const loaded = await createGameRegistry().load(pilot.game, pilot.variant);
const { bot, rules } = loaded;
const solver = fileURLToPath(new URL('./ridge-cuda.py', import.meta.url));
const source = decisionLearningSource(pilot.game);
const planSha256 = hash(rawPlan);
const modelBinding = {
  pilot: id,
  encoder: pilot.encoder,
  variant: pilot.variant ?? null,
  rules: rules.manifest,
  strategy: { id: bot.id, version: bot.version },
  setup: rules.setup?.defaults ?? null,
  players: pilot.players,
};
const checkpoint = openTrainingCheckpoint<Checkpoint>(
  values.checkpoint,
  hash(
    JSON.stringify({ planSha256, source, modelBinding, node: process.version }),
  ),
  { train: [], tune: [], review: [] },
);
const state = checkpoint.state;

for (const stage of ['train', 'tune'] as const) {
  for (const [index, seed] of seeds[stage].entries()) {
    if (index < state[stage].length) continue;
    const { actor, input } = learningMatch(pilot, loaded, seed, index);
    state[stage].push(
      await labelLearningMatch(input, pilot, actor, plan.maxSteps, plan.roots),
    );
    checkpoint.save(state);
    console.error(
      JSON.stringify({
        pilot: id,
        stage,
        done: index + 1,
        total: seeds[stage].length,
      }),
    );
  }
}
const examples: WeightedExample[] = state.train.flatMap((row) => row.examples);
const tune = state.tune.flatMap((row) => row.examples);
const reportBase = {
  type: 'decision-learning-trial',
  planSha256,
  source,
  binding: modelBinding,
  node: process.version,
  labels: { train: examples.length, tune: tune.length },
  evidence: {
    train: state.train.map(({ eligibleDecisions, trace }) => ({
      eligibleDecisions,
      trace,
    })),
    tune: state.tune.map(({ eligibleDecisions, trace }) => ({
      eligibleDecisions,
      trace,
    })),
  },
};
if (!examples.length || !tune.length) {
  if (decisionLearningSource(pilot.game) !== source)
    throw new Error('Input sources changed during the frozen run');
  console.log(
    JSON.stringify({ ...reportBase, outcome: 'insufficient-labels' }, null, 2),
  );
} else {
  const penalty = 0.03;
  state.fit ??= JSON.parse(
    await fitUnoOnGpu(solver, JSON.stringify({ examples, penalty }), () => {}),
  ) as GpuFit;
  const control = fitModel(examples, 'linear', penalty);
  if (
    control.length !== state.fit.coefficients.length ||
    control.some(
      (value, i) =>
        !Number.isFinite(state.fit!.coefficients[i]) ||
        Math.abs(value - state.fit!.coefficients[i]!) > 1e-6,
    )
  )
    throw new Error('CUDA coefficients differ from the independent linear fit');
  const { coefficients } = state.fit;
  const candidates = [0.02, 0.06, 0.12].map((threshold) => ({
    threshold,
    gain: average(
      state.tune.map((unit) =>
        unit.examples.reduce(
          (sum, row) =>
            sum +
            (linearPrediction(row.features, coefficients) > threshold
              ? row.target * row.weight
              : 0),
          0,
        ),
      ),
    ),
  }));
  const chosen = [...candidates].sort(
    (a, b) => b.gain - a.gain || b.threshold - a.threshold,
  )[0]!;
  checkpoint.save(state);
  for (const [index, seed] of seeds.review.entries()) {
    if (index < state.review.length) continue;
    const { actor, input } = learningMatch(pilot, loaded, seed, index);
    state.review.push(
      await reviewLearningMatch(
        input,
        pilot,
        actor,
        { coefficients, threshold: chosen.threshold },
        plan.maxSteps,
      ),
    );
    checkpoint.save(state);
    console.error(
      JSON.stringify({
        pilot: id,
        stage: 'review',
        done: index + 1,
        total: seeds.review.length,
      }),
    );
  }
  const differences = state.review.map(
    ({ baselineWon, candidateWon }) => candidateWon - baselineWon,
  );
  const difference = average(differences);
  const interval95 = decisionLearningInterval(differences, plan.bootstrapSeed);
  if (decisionLearningSource(pilot.game) !== source)
    throw new Error('Input sources changed during the frozen run');
  console.log(
    JSON.stringify(
      {
        ...reportBase,
        outcome:
          difference >= 0.03 && interval95.lower > 0
            ? 'needs-confirmation'
            : 'retain-heuristic',
        fit: state.fit,
        tuning: { candidates, chosen },
        review: {
          openings: differences.length,
          difference,
          interval95,
          baselineWins: state.review.reduce(
            (sum, row) => sum + row.baselineWon,
            0,
          ),
          candidateWins: state.review.reduce(
            (sum, row) => sum + row.candidateWon,
            0,
          ),
          interventions: state.review.reduce(
            (sum, row) => sum + row.interventions,
            0,
          ),
          pairs: state.review,
        },
      },
      null,
      2,
    ),
  );
}
