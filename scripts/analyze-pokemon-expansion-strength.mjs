import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const args = process.argv.slice(2);
assert.equal(args.length, 1, 'Pass the measurement report.json path');
const input = resolve(args[0]);
const raw = await readFile(input);
const report = JSON.parse(raw.toString('utf8'));
assert.equal(report.sourceStable, true);
assert.deepEqual(report.capReached, []);
const rounds = report.rounds.filter((round) => round.cohort === 'strength');
assert.ok(rounds.length >= 6, 'At least two complete seed blocks required');
const blocks = new Map();
for (const round of rounds) {
  assert.equal(round.completed, true);
  assert.equal(round.players, 3);
  assert.equal(new Set(Object.values(round.difficulties)).size, 3);
  const key = round.seedIndex;
  if (!blocks.has(key)) blocks.set(key, []);
  blocks.get(key).push(round);
  const minimum = Math.min(...round.scores.map((score) => score.total));
  assert.deepEqual(
    [...round.finalWinners].sort(),
    round.scores
      .filter((score) => score.total === minimum)
      .map((score) => score.seat)
      .sort(),
  );
  for (const score of round.scores)
    assert.equal(score.total, score.base - score.deduction);
}
for (const block of blocks.values()) {
  assert.equal(block.length, 3);
  assert.deepEqual(block.map((round) => round.rotation).sort(), [0, 1, 2]);
  for (const seat of Object.keys(block[0].difficulties))
    assert.deepEqual(block.map((round) => round.difficulties[seat]).sort(), [
      'default',
      'doubao',
      'juewu',
    ]);
}
const mean = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const rank = (round, seat) => {
  const score = round.scores.find((score) => score.seat === seat).total;
  return (
    1 +
    round.scores.filter((other) => other.total < score).length +
    round.scores.filter((other) => other.seat !== seat && other.total === score)
      .length /
      2
  );
};
let state = 0x6a09e667;
const random = () => {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
};
const interval = (values) => {
  const samples = [];
  for (let i = 0; i < 10000; i++) {
    let sum = 0;
    for (let j = 0; j < values.length; j++)
      sum += values[Math.floor(random() * values.length)];
    samples.push(sum / values.length);
  }
  samples.sort((a, b) => a - b);
  return {
    mean: mean(values),
    percentile95: [samples[249], samples[9749]],
    resamples: 10000,
  };
};
const comparisons = [
  ['default', 'doubao'],
  ['doubao', 'juewu'],
  ['default', 'juewu'],
].map(([lower, higher]) => {
  const differences = [...blocks.values()].map((block) => {
    const scores = [],
      ranks = [],
      winShares = [];
    for (const round of block) {
      const low = round.scores.find(
        (score) => round.difficulties[score.seat] === lower,
      );
      const high = round.scores.find(
        (score) => round.difficulties[score.seat] === higher,
      );
      scores.push(high.total - low.total);
      ranks.push(rank(round, high.seat) - rank(round, low.seat));
      winShares.push(
        (round.finalWinners.includes(high.seat)
          ? 1 / round.finalWinners.length
          : 0) -
          (round.finalWinners.includes(low.seat)
            ? 1 / round.finalWinners.length
            : 0),
      );
    }
    return {
      score: mean(scores),
      rank: mean(ranks),
      winShare: mean(winShares),
    };
  });
  const score = interval(differences.map((value) => value.score));
  const ranks = interval(differences.map((value) => value.rank));
  const wins = interval(differences.map((value) => value.winShare));
  return {
    lower,
    higher,
    scoreHigherMinusLower: score,
    rankHigherMinusLower: ranks,
    fractionalWinShareHigherMinusLower: wins,
    higherAdvantageSupportedInThisCohort:
      score.percentile95[1] < 0 &&
      ranks.percentile95[1] < 0 &&
      wins.percentile95[0] > 0,
    lowerAdvantageSupportedInThisCohort:
      score.percentile95[0] > 0 &&
      ranks.percentile95[0] > 0 &&
      wins.percentile95[1] < 0,
  };
});
const result = {
  generatedAt: new Date().toISOString(),
  sourceReport: input,
  sourceReportSha256: createHash('sha256').update(raw).digest('hex'),
  rounds: rounds.length,
  independentSeedBlocks: blocks.size,
  scope:
    'Deterministic percentile bootstrap of complete seed blocks, preserving correlation among the three seat rotations. Descriptive evidence under these three-player mixed opponents, not all-player counts, whole-match skill or human experience certification. Intervals are marginal and not multiple-comparison adjusted.',
  audit:
    'Source stable, all rounds completed, score/reward arithmetic and winners exact, every seed has all three rotations with equal difficulty exposure at every seat.',
  comparisons,
  adjacentOrderingSupportedInThisCohort: comparisons
    .slice(0, 2)
    .every((comparison) => comparison.higherAdvantageSupportedInThisCohort),
};
const output = join(dirname(input), 'strength-analysis.json');
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    output,
    independentSeedBlocks: blocks.size,
    rounds: rounds.length,
    adjacentOrderingSupported: result.adjacentOrderingSupportedInThisCohort,
    comparisons,
  }),
);
