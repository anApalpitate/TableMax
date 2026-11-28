import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { decisionLearningInterval } from './decision-learning';
import { decisionLearningPilots } from './decision-learning-pilots';
import { fitModel, linearPrediction, type WeightedExample } from './fit';

type Label = {
  examples: WeightedExample[];
  eligibleDecisions: number;
  trace: string;
};
type Pair = {
  baselineWon: number;
  candidateWon: number;
  interventions: number;
  baselineTrace: string;
  candidateTrace: string;
};
type Fit = { coefficients: number[]; device: string; torch: string };
const { values } = parseArgs({
  options: {
    evidence: { type: 'string' },
    checkpoints: { type: 'string' },
    confirmation: { type: 'string', multiple: true },
  },
});
if (!values.evidence || !values.checkpoints)
  throw new Error(
    'Pass --evidence and --checkpoints for a completed decision-learning run',
  );
const trace = /^[a-f0-9]{64}$/;
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const parse = (bytes: Buffer) => JSON.parse(bytes.toString('utf8'));
const planBytes = readFileSync(join(values.evidence, 'frozen-plan.json'));
const plan = parse(planBytes);
const planSha256 = sha(planBytes);
const average = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
const findings = [];
const confirmationFindings = [];
const candidatesById = new Map<string, string>();
const seenSeeds = new Set<number>();
function addSeed(seed: number) {
  assert.ok(Number.isSafeInteger(seed) && seed >= 1 && seed <= 0xffffffff);
  assert.ok(!seenSeeds.has(seed), 'Opening reused across frozen partitions');
  seenSeeds.add(seed);
}

function auditPair(pair: Pair) {
  assert.ok(
    [0, 1].includes(pair.baselineWon) && [0, 1].includes(pair.candidateWon),
  );
  assert.match(pair.baselineTrace, trace);
  assert.match(pair.candidateTrace, trace);
  assert.ok(
    Number.isSafeInteger(pair.interventions) && pair.interventions >= 0,
  );
  assert.equal(
    pair.interventions === 0,
    pair.baselineTrace === pair.candidateTrace,
  );
  if (!pair.interventions) assert.equal(pair.baselineWon, pair.candidateWon);
}

for (const id of Object.keys(
  plan.pilots,
) as (keyof typeof decisionLearningPilots)[]) {
  const bytes = readFileSync(join(values.evidence, id + '.json'));
  const report = parse(bytes);
  const stored = parse(
    readFileSync(join(values.checkpoints, id + '.json')),
  ) as {
    version: number;
    identity: string;
    state: { train: Label[]; tune: Label[]; fit?: Fit; review: Pair[] };
  };
  const checkpoint = stored.state;
  assert.equal(stored.version, 1);
  assert.equal(report.type, 'decision-learning-trial');
  assert.equal(report.planSha256, planSha256);
  assert.match(report.source, trace);
  assert.equal(
    stored.identity,
    sha(
      Buffer.from(
        JSON.stringify({
          planSha256,
          source: report.source,
          modelBinding: report.binding,
          node: report.node,
        }),
      ),
    ),
  );
  assert.equal(report.binding.pilot, id);
  assert.equal(report.binding.encoder, decisionLearningPilots[id].encoder);
  assert.equal(report.binding.rules.id, decisionLearningPilots[id].game);
  assert.equal(
    report.binding.variant,
    decisionLearningPilots[id].variant ?? null,
  );
  assert.equal(report.binding.players, decisionLearningPilots[id].players);
  for (const stage of ['train', 'tune', 'review'] as const)
    plan.pilots[id][stage].forEach(addSeed);
  for (const stage of ['train', 'tune'] as const) {
    assert.equal(checkpoint[stage].length, plan.pilots[id][stage].length);
    assert.deepEqual(
      report.evidence[stage],
      checkpoint[stage].map(({ eligibleDecisions, trace }) => ({
        eligibleDecisions,
        trace,
      })),
    );
    for (const unit of checkpoint[stage]) {
      assert.match(unit.trace, trace);
      assert.ok(
        Number.isSafeInteger(unit.eligibleDecisions) &&
          unit.eligibleDecisions >= unit.examples.length,
      );
      assert.ok(unit.examples.length <= plan.roots);
      for (const example of unit.examples) {
        assert.ok(example.features.every(Number.isFinite));
        assert.ok([-1, 0, 1].includes(example.target));
        assert.equal(example.weight, 1 / unit.examples.length);
      }
    }
  }
  const train = checkpoint.train.flatMap(({ examples }) => examples);
  const tune = checkpoint.tune.flatMap(({ examples }) => examples);
  assert.deepEqual(report.labels, { train: train.length, tune: tune.length });
  if (!train.length || !tune.length) {
    assert.equal(report.outcome, 'insufficient-labels');
    assert.equal(checkpoint.review.length, 0);
    findings.push({ id, outcome: report.outcome, reportSha256: sha(bytes) });
    continue;
  }
  const fit = checkpoint.fit;
  assert.ok(fit);
  assert.deepEqual(report.fit, fit);
  const restored = fitModel(train, 'linear', 0.03);
  assert.equal(restored.length, fit.coefficients.length);
  assert.ok(
    restored.every(
      (value, i) => Math.abs(value - fit.coefficients[i]!) <= 1e-6,
    ),
  );
  assert.equal(checkpoint.review.length, plan.pilots[id].review.length);
  assert.deepEqual(report.review.pairs, checkpoint.review);
  checkpoint.review.forEach(auditPair);
  const candidates = [0.02, 0.06, 0.12].map((threshold) => ({
    threshold,
    gain: average(
      checkpoint.tune.map(({ examples }) =>
        examples.reduce(
          (sum, row) =>
            sum +
            (linearPrediction(row.features, fit.coefficients) > threshold
              ? row.target * row.weight
              : 0),
          0,
        ),
      ),
    ),
  }));
  assert.deepEqual(report.tuning.candidates, candidates);
  assert.deepEqual(
    report.tuning.chosen,
    [...candidates].sort(
      (a, b) => b.gain - a.gain || b.threshold - a.threshold,
    )[0],
  );
  const differences = checkpoint.review.map(
    (pair) => pair.candidateWon - pair.baselineWon,
  );
  const difference = average(differences);
  const interval95 = decisionLearningInterval(differences, plan.bootstrapSeed);
  const interventions = checkpoint.review.reduce(
    (sum, pair) => sum + pair.interventions,
    0,
  );
  assert.equal(report.review.difference, difference);
  assert.deepEqual(report.review.interval95, interval95);
  assert.equal(report.review.interventions, interventions);
  assert.equal(report.review.openings, checkpoint.review.length);
  assert.equal(
    report.review.baselineWins,
    checkpoint.review.reduce((sum, { baselineWon }) => sum + baselineWon, 0),
  );
  assert.equal(
    report.review.candidateWins,
    checkpoint.review.reduce((sum, { candidateWon }) => sum + candidateWon, 0),
  );
  assert.equal(
    report.outcome,
    difference >= 0.03 && interval95.lower > 0
      ? 'needs-confirmation'
      : 'retain-heuristic',
  );
  findings.push({
    id,
    reportSha256: sha(bytes),
    difference,
    interval95,
    interventions,
    outcome: report.outcome,
  });
  if (difference >= 0.03) candidatesById.set(id, sha(bytes));
}

for (const path of values.confirmation ?? []) {
  const bytes = readFileSync(path);
  const frozenSha = sha(bytes);
  const frozen = parse(bytes) as {
    version: number;
    requiredGain: number;
    bootstrapSeed: number;
    pilots: Record<string, { candidateSha256: string; openings: number[] }>;
  };
  assert.equal(frozen.version, 1);
  assert.equal(frozen.requiredGain, 0.03);
  for (const [id, target] of Object.entries(frozen.pilots)) {
    assert.equal(target.candidateSha256, candidatesById.get(id));
    target.openings.forEach(addSeed);
    const reportBytes = readFileSync(
      join(dirname(path), id + '-confirmation.json'),
    );
    const report = parse(reportBytes);
    const pairs = report.pairs as Pair[];
    assert.equal(report.type, 'decision-learning-confirmation');
    assert.equal(report.id, id);
    assert.equal(report.planSha256, frozenSha);
    assert.equal(report.candidateSha256, target.candidateSha256);
    assert.equal(report.openings, target.openings.length);
    assert.equal(pairs.length, target.openings.length);
    pairs.forEach(auditPair);
    const differences = pairs.map(
      ({ baselineWon, candidateWon }) => candidateWon - baselineWon,
    );
    const difference = average(differences);
    const interval95 = decisionLearningInterval(
      differences,
      frozen.bootstrapSeed,
    );
    assert.equal(report.difference, difference);
    assert.deepEqual(report.interval95, interval95);
    assert.equal(
      report.interventions,
      pairs.reduce((sum, { interventions }) => sum + interventions, 0),
    );
    const outcome =
      difference >= frozen.requiredGain && interval95.lower > 0
        ? 'meets-win-gate'
        : 'retain-heuristic';
    assert.equal(report.outcome, outcome);
    confirmationFindings.push({
      id,
      reportSha256: sha(reportBytes),
      difference,
      interval95,
      outcome,
    });
  }
}
console.log(
  JSON.stringify(
    { result: 'verified', planSha256, findings, confirmationFindings },
    null,
    2,
  ),
);
