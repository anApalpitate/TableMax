import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  poolForBlock,
  sizeLearningBlocks,
  summarizeLearningBlocks,
  learningPoolWeights,
} from './decision-learning-blocks';
import { decisionLearningV2Pilots } from './decision-learning-v2-pilots';
import {
  pickLearningV2Fit,
  type LearningV2Unit,
  type reviewLearningV2,
} from './decision-learning-v2';
import { fitModel } from './fit';
import {
  completeUnoBlock,
  summarizeUnoComparison,
  type UnoPairedSeed,
} from './uno-paired-statistics';

type Pair = Awaited<ReturnType<typeof reviewLearningV2>>;
type Block = {
  pool: ReturnType<typeof poolForBlock>;
  difference: number;
  pairs: Pair[];
};
type RecordOf<T> = { seed: number; index: number; receipt: string; result: T };
type Plan = {
  train: number[];
  tune: number[];
  development: number[];
  formalStart: number;
  bootstrapSeed: number;
};
const { values } = parseArgs({
  options: {
    evidence: { type: 'string' },
    pilots: { type: 'string' },
    'uno-development': { type: 'string' },
  },
});
assert.ok(
  values.evidence && values.pilots,
  'Pass --evidence and a comma-delimited --pilots list',
);
const evidence = values.evidence;
const ids = values.pilots.split(
  ',',
) as (keyof typeof decisionLearningV2Pilots)[];
assert.ok(
  ids.every((id) => Object.hasOwn(decisionLearningV2Pilots, id)) &&
    new Set(ids).size === ids.length,
);
const sha = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex');
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const digest = /^[0-9a-f]{64}$/;

function auditBlocks(
  rows: RecordOf<Block>[],
  seeds: readonly number[],
  seats: number,
  offset = 0,
) {
  assert.equal(rows.length, seeds.length);
  return rows.map(({ receipt, seed, index, result }, i) => {
    assert.match(receipt, digest);
    assert.equal(index, i + offset);
    assert.equal(seed, seeds[i]);
    assert.equal(poolForBlock(index), result.pool);
    assert.equal(result.pairs.length, seats);
    for (const pair of result.pairs) {
      assert.ok(
        [pair.baselineWon, pair.controlWon, pair.candidateWon].every(
          (won) => won === 0 || won === 1,
        ),
      );
      assert.match(pair.baselineTrace, digest);
      assert.match(pair.candidateTrace, digest);
      assert.equal(
        pair.interventions === 0,
        pair.baselineTrace === pair.candidateTrace,
      );
      if (!pair.interventions)
        assert.equal(pair.baselineWon, pair.candidateWon);
      assert.ok(
        pair.firstChangeGain === null ||
          [-1, 0, 1].includes(pair.firstChangeGain),
      );
    }
    assert.equal(
      result.difference,
      result.pairs.reduce(
        (sum, pair) => sum + pair.candidateWon - pair.baselineWon,
        0,
      ) / seats,
    );
    return result;
  });
}

const reports = [];
for (const id of ids) {
  const pilot = decisionLearningV2Pilots[id];
  const planFile = join(evidence, id + '-plan.json');
  const plan = read(planFile) as Plan;
  const path = join(evidence, id + '-development.json');
  const dev = read(path);
  assert.equal(dev.identity.id, id);
  assert.equal(dev.identity.encoder, pilot.encoder);
  assert.equal(dev.identity.planSha256, sha(readFileSync(planFile)));
  const seen = [...plan.train, ...plan.tune, ...plan.development];
  assert.equal(new Set(seen).size, seen.length);
  assert.ok(
    seen.every(
      (seed) =>
        Number.isSafeInteger(seed) && seed > 0 && seed < plan.formalStart,
    ),
  );
  function checkUnits(rows: RecordOf<LearningV2Unit>[], openings: number[]) {
    assert.equal(rows.length, openings.length);
    return rows.map(({ receipt, seed, index, result }, i) => {
      assert.match(receipt, digest);
      assert.equal(seed, openings[i]);
      assert.equal(index, i);
      assert.match(result.trace, digest);
      assert.ok(
        result.roots.length <= 4 && result.eligible >= result.roots.length,
      );
      for (const root of result.roots) {
        assert.ok(root.rows.length >= 1 && root.rows.length <= 3);
        assert.ok((id === 'manila' ? [8, 16] : [1]).includes(root.scenarios));
        for (const row of root.rows) {
          assert.equal(row.weight, 1 / result.roots.length / root.rows.length);
          assert.ok(
            row.features.every(Number.isFinite) &&
              Number.isFinite(row.target) &&
              Math.abs(row.target) <= 1,
          );
        }
      }
      return result;
    });
  }
  const train = checkUnits(dev.train, plan.train).flatMap(({ roots }) =>
    roots.flatMap(({ rows }) => rows),
  );
  const tune = checkUnits(dev.tune, plan.tune);
  if (!train.length || !tune.some(({ roots }) => roots.length)) {
    assert.equal(dev.outcome, 'insufficient-candidates');
    assert.equal(dev.passes, false);
    reports.push({ id, passes: false, outcome: dev.outcome });
    continue;
  }
  assert.equal(dev.trainLabels, train.length);
  assert.equal(
    dev.tuneLabels,
    tune.reduce(
      (sum, { roots }) =>
        sum + roots.reduce((n, { rows }) => n + rows.length, 0),
      0,
    ),
  );
  const cpu = fitModel(train, 'linear', 0.03);
  assert.equal(cpu.length, dev.fit.coefficients.length);
  assert.ok(
    cpu.every(
      (value, index) => Math.abs(value - dev.fit.coefficients[index]) <= 1e-6,
    ),
  );
  assert.deepEqual(pickLearningV2Fit(tune, dev.fit.coefficients), dev.fit);
  const blocks = auditBlocks(dev.dev, plan.development, pilot.players);
  const summary = summarizeLearningBlocks(blocks, plan.bootstrapSeed);
  assert.deepEqual(dev.summary, summary);
  const pairs = blocks.flatMap(({ pairs }) => pairs);
  const first = pairs.flatMap(({ firstChangeGain }) =>
    firstChangeGain === null ? [] : [firstChangeGain],
  );
  const firstChangeGain = first.length
    ? first.reduce((sum, value) => sum + value, 0) / first.length
    : null;
  const controlDelta = summarizeLearningBlocks(
    blocks.map(({ pool, pairs }) => ({
      pool,
      difference:
        pairs.reduce(
          (sum, pair) => sum + pair.candidateWon - pair.controlWon,
          0,
        ) / pairs.length,
    })),
    plan.bootstrapSeed,
  ).difference;
  assert.equal(dev.firstChangeSamples, first.length);
  assert.equal(dev.firstChangeGain, firstChangeGain);
  assert.equal(dev.controlDelta, controlDelta);
  assert.equal(
    dev.interventions,
    pairs.reduce((sum, pair) => sum + pair.interventions, 0),
  );
  assert.equal(
    dev.passes,
    summary.difference >= 0.03 &&
      firstChangeGain !== null &&
      firstChangeGain > 0 &&
      controlDelta > 0,
  );
  const formalPath = join(evidence, id + '-formal.json');
  let formal;
  if (existsSync(formalPath)) {
    assert.ok(dev.passes);
    const report = read(formalPath);
    assert.deepEqual(report.identity, dev.identity);
    assert.equal(report.frozen.fitSha256, dev.fitSha256);
    const count = sizeLearningBlocks(
      summary.pools.reduce(
        (sum, row) => sum + learningPoolWeights[row.pool] * row.variance,
        0,
      ),
      2,
    );
    const total = count + 4 * Math.ceil(count / 8);
    assert.equal(report.frozen.count, count);
    assert.equal(report.frozen.total, total);
    const first = auditBlocks(
      report.first,
      Array.from({ length: count }, (_, index) => plan.formalStart + index),
      pilot.players,
    );
    const initial = summarizeLearningBlocks(first, plan.bootstrapSeed, 2);
    assert.deepEqual(initial, report.initial);
    const shouldExpand =
      !initial.passes && initial.decisionInterval.upper >= 0.03;
    const extra = auditBlocks(
      report.extra,
      Array.from(
        { length: shouldExpand ? total - count : 0 },
        (_, index) => plan.formalStart + count + index,
      ),
      pilot.players,
      count,
    );
    formal = summarizeLearningBlocks(
      [...first, ...extra],
      plan.bootstrapSeed,
      2,
    );
    assert.deepEqual(formal, report.result);
  }
  reports.push({
    id,
    development: summary,
    passes: dev.passes,
    firstChangeGain,
    controlDelta,
    interventions: dev.interventions,
    developmentSha256: sha(readFileSync(path)),
    ...(formal ? { formal } : {}),
  });
}

let uno;
if (values['uno-development']) {
  const report = read(values['uno-development']);
  assert.equal(report.type, 'uno-abc-development');
  assert.equal(report.failures, 0);
  assert.equal(report.undispatched.length, 0);
  const blocks = report.blocks as UnoPairedSeed[];
  assert.equal(blocks.length, 48);
  assert.equal(new Set(blocks.map(({ seed }) => seed)).size, blocks.length);
  assert.ok(blocks.every(completeUnoBlock));
  uno = summarizeUnoComparison(blocks, 'C', 'B', report.plan.bootstrapSeed, 1);
  assert.deepEqual(uno, report.main);
}
console.log(
  JSON.stringify(
    { result: 'verified', reports, ...(uno ? { uno } : {}) },
    null,
    2,
  ),
);
