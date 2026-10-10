import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

assert.equal(
  process.argv.length,
  3,
  'Pass a full match measurement report.json',
);
const input = resolve(process.argv[2]),
  raw = await readFile(input),
  report = JSON.parse(raw.toString('utf8'));
assert.equal(report.completed, true);
assert.equal(report.sourceStable, true);
assert.equal(report.error, null);
const grades = ['default', 'doubao', 'juewu'],
  blocks = new Map();
for (const match of report.matches) {
  assert.equal(match.completed, true);
  assert.equal(Object.keys(match.difficulties).length, match.players);
  assert.ok(
    Object.values(match.difficulties).every((grade) => grades.includes(grade)),
  );
  const wins = Object.fromEntries(
    Object.keys(match.difficulties).map((seat) => [seat, 0]),
  );
  for (let i = 0; i < match.rounds.length; i++) {
    const round = match.rounds[i];
    assert.equal(round.number, i + 1);
    assert.ok(round.actions <= report.roundCap);
    const minimum = Math.min(
      ...Object.values(round.scores).map((score) => score.total),
    );
    const winners = Object.keys(wins).filter(
      (seat) => round.scores[seat].total === minimum,
    );
    assert.deepEqual([...round.winners].sort(), winners.sort());
    for (const score of Object.values(round.scores))
      assert.equal(score.total, score.base - score.deduction);
    for (const seat of winners) wins[seat]++;
    assert.deepEqual(round.wins, wins);
    if (i < match.rounds.length - 1)
      assert.ok(Object.values(wins).every((value) => value < 3));
  }
  assert.deepEqual(match.winsBySeat, wins);
  assert.deepEqual(
    [...match.matchWinners].sort(),
    Object.keys(wins)
      .filter((seat) => wins[seat] === 3)
      .sort(),
  );
  assert.ok(match.matchWinners.length > 0);
  assert.equal(match.lifecycleTransitions, match.rounds.length - 1);
  const key = `${match.players}:${match.seedIndex}`;
  if (!blocks.has(key)) blocks.set(key, []);
  blocks.get(key).push(match);
}
for (const block of blocks.values()) {
  const players = block[0].players,
    expected = players === 2 ? 6 : 3;
  assert.equal(block.length, expected);
  assert.equal(new Set(block.map((match) => match.seed)).size, 1);
  assert.deepEqual(
    block.map((match) => match.rotation).sort(),
    Array.from({ length: expected }, (_, i) => i),
  );
  for (const seat of Object.keys(block[0].difficulties)) {
    const levels = block.map((match) => match.difficulties[seat]);
    for (const grade of grades)
      assert.equal(
        levels.filter((level) => level === grade).length,
        players === 2 ? 2 : 1,
      );
  }
  if (players === 2)
    for (let lower = 0; lower < 3; lower++)
      for (let higher = lower + 1; higher < 3; higher++) {
        const pair = block.filter(
          (match) =>
            Object.values(match.difficulties).includes(grades[lower]) &&
            Object.values(match.difficulties).includes(grades[higher]),
        );
        assert.equal(pair.length, 2);
        assert.notEqual(pair[0].difficulties.s0, pair[1].difficulties.s0);
      }
}
const mean = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
let state = 0x73f182b9;
const random = () => {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 4294967296;
};
const interval = (values) => {
  if (values.length < 2)
    return {
      mean: mean(values),
      percentile95: null,
      independentSeedBlocks: values.length,
    };
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
    independentSeedBlocks: values.length,
    resamples: 10000,
  };
};
const winShare = (matches, grade) => {
  let total = 0,
    exposure = 0;
  for (const match of matches)
    for (const [seat, level] of Object.entries(match.difficulties))
      if (level === grade) {
        exposure++;
        if (match.matchWinners.includes(seat))
          total += 1 / match.matchWinners.length;
      }
  assert.ok(exposure > 0);
  return total / exposure;
};
const strata = report.playerCounts.map((players) => {
  const cohort = [...blocks.values()].filter(
    (block) => block[0].players === players,
  );
  assert.equal(cohort.length, report.seeds);
  const comparisons = [
    ['default', 'doubao'],
    ['doubao', 'juewu'],
    ['default', 'juewu'],
  ].map(([lower, higher]) => {
    const differences = cohort.map((block) => {
      const matches =
        players === 2
          ? block.filter(
              (match) =>
                Object.values(match.difficulties).includes(lower) &&
                Object.values(match.difficulties).includes(higher),
            )
          : block;
      return winShare(matches, higher) - winShare(matches, lower);
    });
    const result = interval(differences);
    return {
      lower,
      higher,
      winShareHigherMinusLower: result,
      higherAdvantageSupported:
        result.percentile95 !== null && result.percentile95[0] > 0,
      lowerAdvantageSupported:
        result.percentile95 !== null && result.percentile95[1] < 0,
    };
  });
  return {
    players,
    seedBlocks: cohort.length,
    matches: cohort.flat().length,
    comparisons,
  };
});
const researchSummary = report.playerCounts.map((players) => {
  const matches = report.matches.filter((match) => match.players === players);
  const rounds = matches.flatMap((match) => match.rounds);
  const tasks = new Map();
  let changedWinnerRounds = 0;
  for (const round of rounds) {
    const entries = Object.entries(round.scores);
    const active = entries[0][1].research.map((item) => item.taskId);
    assert.equal(new Set(active).size, active.length);
    assert.equal(active[0], round.opening);
    assert.ok(active.length >= 1 && active.length <= 2);
    assert.equal(active.length === 2, round.hoenn);
    const minimumBase = Math.min(...entries.map(([, score]) => score.base));
    const baseWinners = entries
      .filter(([, score]) => score.base === minimumBase)
      .map(([seat]) => seat)
      .sort();
    if (
      JSON.stringify(baseWinners) !== JSON.stringify([...round.winners].sort())
    )
      changedWinnerRounds++;
    for (const taskId of active) {
      const item = tasks.get(taskId) ?? {
        taskId,
        activeRounds: 0,
        seatOpportunities: 0,
        achievedSeats: 0,
        totalDeduction: 0,
      };
      item.activeRounds++;
      for (const [, score] of entries) {
        assert.deepEqual(
          score.research.map((task) => task.taskId),
          active,
        );
        assert.equal(
          score.research.reduce((sum, task) => sum + task.deduction, 0),
          score.deduction,
        );
        const award = score.research.find((task) => task.taskId === taskId);
        assert.equal(award.achieved, award.deduction > 0);
        item.seatOpportunities++;
        item.achievedSeats += Number(award.achieved);
        item.totalDeduction += award.deduction;
      }
      tasks.set(taskId, item);
    }
  }
  const arceusActivatedRounds = rounds.filter((round) => round.arceus).length;
  const hoennPublishedRounds = rounds.filter((round) => round.hoenn).length;
  assert.equal(
    arceusActivatedRounds,
    matches.reduce((sum, match) => sum + match.arceusActivations, 0),
  );
  assert.equal(
    hoennPublishedRounds,
    matches.reduce((sum, match) => sum + match.hoennEvents, 0),
  );
  return {
    players,
    rounds: rounds.length,
    openingSelections: Object.fromEntries(
      Array.from(
        { length: 24 },
        (_, i) => `R${String(i + 1).padStart(2, '0')}`,
      ).map((id) => [
        id,
        rounds.filter((round) => round.opening === id).length,
      ]),
    ),
    tasks: [...tasks.values()].sort((a, b) => a.taskId.localeCompare(b.taskId)),
    changedWinnerRounds,
    arceusActivatedRounds,
    hoennPublishedRounds,
    scope:
      'Settlement award frequencies and fixed-final-field base-score counterfactual; no claim about causal policy effects, candidate votes, human timing, or zero-event impossibility.',
  };
});
const result = {
  generatedAt: new Date().toISOString(),
  sourceReport: input,
  sourceReportSha256: createHash('sha256').update(raw).digest('hex'),
  verifiedMatches: report.matches.length,
  verifiedRounds: report.matches.reduce(
    (n, match) => n + match.rounds.length,
    0,
  ),
  strata,
  researchSummary,
  allAdjacentOrderingSupported: strata.every((stratum) =>
    stratum.comparisons
      .slice(0, 2)
      .every((comparison) => comparison.higherAdvantageSupported),
  ),
  audit:
    'All completed three-win matches; rederived winners, round-win increments, terminal and next-round boundaries, score arithmetic; each seed block has complete balanced seat exposure and paired two-player seat reversals.',
  scope:
    '10,000 deterministic percentile bootstrap resamples of whole seed blocks, stratified by player count. For two players, each comparison uses only its paired two matches. Higher counts use per-seat fractional match wins averaged across cyclic grade compositions. Each stratum records its actual independent seed-block count. Marginal descriptive intervals, not adjusted for multiple comparisons; small cohorts are exploratory, not a universal tier guarantee.',
};
const output = join(dirname(input), 'match-strength-analysis.json');
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    output,
    verifiedMatches: result.verifiedMatches,
    verifiedRounds: result.verifiedRounds,
    allAdjacentOrderingSupported: result.allAdjacentOrderingSupported,
    strata,
  }),
);
