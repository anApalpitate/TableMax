import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createGameRegistry } from '../../../apps/server/src/game-registry';
import { decisionLearningPilots } from './decision-learning-pilots';
import { decisionLearningSource } from './decision-learning-source';
import {
  decisionLearningInterval,
  learningMatch,
  reviewLearningMatch,
} from './decision-learning';
import { openTrainingCheckpoint } from './training-checkpoint';

type Plan = {
  version: 1;
  requiredGain: number;
  maxSteps: number;
  bootstrapSeed: number;
  pilots: Record<string, { candidateSha256: string; openings: number[] }>;
};
type Pair = Awaited<ReturnType<typeof reviewLearningMatch>>;

const { values } = parseArgs({
  options: {
    pilot: { type: 'string' },
    plan: { type: 'string' },
    'training-plan': { type: 'string' },
    candidate: { type: 'string' },
    checkpoint: { type: 'string' },
  },
});
const id = values.pilot as keyof typeof decisionLearningPilots | undefined;
if (
  !id ||
  !Object.hasOwn(decisionLearningPilots, id) ||
  !values.plan ||
  !values['training-plan'] ||
  !values.candidate ||
  !values.checkpoint
)
  throw new Error(
    'Pass --pilot, --plan, --training-plan, --candidate and --checkpoint',
  );

const digest = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
const rawPlan = readFileSync(values.plan);
const plan = JSON.parse(rawPlan.toString('utf8')) as Plan;
const target = plan.pilots?.[id];
const validSeed = (n: number) =>
  Number.isSafeInteger(n) && n >= 1 && n <= 0xffffffff;
assert.equal(plan.version, 1);
assert.equal(plan.requiredGain, 0.03);
assert.ok(validSeed(plan.bootstrapSeed));
assert.ok(Number.isSafeInteger(plan.maxSteps) && plan.maxSteps > 0);
assert.ok(target && target.openings.length >= 2);

const rawTraining = readFileSync(values['training-plan']);
const training = JSON.parse(rawTraining.toString('utf8')) as {
  pilots: Record<string, { train: number[]; tune: number[]; review: number[] }>;
};
const oldSeeds = new Set(
  Object.values(training.pilots).flatMap(({ train, tune, review }) => [
    ...train,
    ...tune,
    ...review,
  ]),
);
const freshSeeds = Object.values(plan.pilots).flatMap(
  ({ openings }) => openings,
);
assert.equal(new Set(freshSeeds).size, freshSeeds.length);
assert.ok(freshSeeds.every((seed) => validSeed(seed) && !oldSeeds.has(seed)));

const rawCandidate = readFileSync(values.candidate);
assert.equal(digest(rawCandidate), target.candidateSha256);
const candidate = JSON.parse(rawCandidate.toString('utf8'));
const pilot = decisionLearningPilots[id];
const loaded = await createGameRegistry().load(pilot.game, pilot.variant);
const { bot, rules } = loaded;
assert.equal(candidate.type, 'decision-learning-trial');
assert.equal(candidate.planSha256, digest(rawTraining));
assert.ok(candidate.review.difference >= plan.requiredGain);
assert.deepEqual(candidate.binding, {
  pilot: id,
  encoder: pilot.encoder,
  variant: pilot.variant ?? null,
  rules: rules.manifest,
  strategy: { id: bot.id, version: bot.version },
  setup: rules.setup?.defaults ?? null,
  players: pilot.players,
});

const planSha256 = digest(rawPlan);
const identity = digest(
  JSON.stringify([planSha256, target.candidateSha256, process.version]),
);
const checkpoint = openTrainingCheckpoint<Pair[]>(
  values.checkpoint,
  identity,
  [],
);
const { state } = checkpoint;
assert.ok(state.length <= target.openings.length);
const simulate = state.length < target.openings.length;
if (simulate) {
  assert.equal(candidate.node, process.version);
  assert.equal(candidate.source, decisionLearningSource(pilot.game));
}
const fit = {
  coefficients: candidate.fit.coefficients,
  threshold: candidate.tuning.chosen.threshold,
};
for (const [index, seed] of target.openings.entries()) {
  if (index < state.length) continue;
  const { actor, input } = learningMatch(pilot, loaded, seed, index);
  state.push(
    await reviewLearningMatch(input, pilot, actor, fit, plan.maxSteps),
  );
  checkpoint.save(state);
  console.error(
    JSON.stringify({
      pilot: id,
      confirmed: state.length,
      total: target.openings.length,
    }),
  );
}
if (simulate)
  assert.equal(candidate.source, decisionLearningSource(pilot.game));

const differences = state.map(
  ({ baselineWon, candidateWon }) => candidateWon - baselineWon,
);
const difference =
  differences.reduce((sum, value) => sum + value, 0) / differences.length;
const interval95 = decisionLearningInterval(differences, plan.bootstrapSeed);
console.log(
  JSON.stringify(
    {
      type: 'decision-learning-confirmation',
      id,
      planSha256,
      candidateSha256: target.candidateSha256,
      openings: target.openings.length,
      difference,
      interval95,
      outcome:
        difference >= plan.requiredGain && interval95.lower > 0
          ? 'meets-win-gate'
          : 'retain-heuristic',
      interventions: state.reduce(
        (sum, { interventions }) => sum + interventions,
        0,
      ),
      pairs: state,
    },
    null,
    2,
  ),
);
