import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { RandomSource } from '../../../packages/platform-core/src/random';

const { values } = parseArgs({
  options: {
    calibration: { type: 'string' },
    checkpoint: { type: 'string' },
    'bootstrap-seed': { type: 'string', default: '47281' },
  },
});
if (!values.calibration || !values.checkpoint)
  throw new Error(
    'Pass the completed B report and its checkpoint for coverage planning',
  );
const bootstrapSeed = Number(values['bootstrap-seed']);
if (
  !Number.isInteger(bootstrapSeed) ||
  bootstrapSeed < 1 ||
  bootstrapSeed > 0xffffffff
)
  throw new Error('Invalid coverage bootstrap seed');

const bytes = readFileSync(values.calibration);
const report = JSON.parse(bytes.toString('utf8'));
const checkpoint = JSON.parse(readFileSync(values.checkpoint, 'utf8'));
if (
  report?.type !== 'uno-calibration-development' ||
  !Array.isArray(report.holdoutSeeds) ||
  report.holdoutSeeds.length < 20 ||
  new Set(report.holdoutSeeds).size !== report.holdoutSeeds.length ||
  checkpoint?.identity !== report.batchDigest ||
  !checkpoint.state?.holdout ||
  Object.keys(checkpoint.state.holdout).length !== report.holdoutSeeds.length ||
  !Number.isSafeInteger(report.options?.roots) ||
  report.options.roots < 1
)
  throw new Error('Coverage planning requires the whole frozen B seed cohort');
const counts = report.holdoutSeeds.map((seed: number) => {
  const row = checkpoint.state.holdout[seed];
  if (
    row?.seed !== seed ||
    !Number.isInteger(row.confirmedPairs) ||
    row.confirmedPairs < 0 ||
    !Number.isInteger(row.rankingPairs) ||
    row.confirmedPairs > row.rankingPairs
  )
    throw new Error('Invalid ranking counts in a recorded B seed block');
  return row.confirmedPairs as number;
}) as number[];
const total = counts.reduce((sum, count) => sum + count, 0);
if (total !== report.ranking?.confirmedPairs)
  throw new Error('Recorded seed counts disagree with the completed B report');

const target = 30;
const maximumSeeds = 512;
const iterations = 10000;
const random = new RandomSource(bootstrapSeed);
const firstSufficient = Array.from({ length: iterations }, () => {
  let total = 0;
  for (let seeds = 1; seeds <= maximumSeeds; seeds++) {
    total += counts[Math.floor(random.next() * counts.length)]!;
    if (total >= target) return seeds;
  }
  return Infinity;
}).sort((left, right) => left - right);

const scenarios = [0.8, 0.9, 0.95].map((chance) => {
  const seeds = firstSufficient[Math.ceil(chance * iterations) - 1]!;
  return {
    coverageChance: chance,
    seeds: Number.isFinite(seeds) ? seeds : null,
  };
});

console.log(
  JSON.stringify(
    {
      type: 'uno-ranking-coverage-planning',
      diagnosticsOnly: true,
      sourceReportSha256: createHash('sha256').update(bytes).digest('hex'),
      sourceBatchDigest: report.batchDigest,
      observed: {
        openingSeeds: counts.length,
        rootsPerOpening: report.options.roots,
        confirmedPairs: total,
        openingsWithConfirmedPairs: counts.filter((count) => count > 0).length,
      },
      target,
      bootstrapSeed,
      iterations,
      maximumSeeds,
      scenarios,
      estimatedChanceAtObservedCount:
        firstSufficient.filter((seeds) => seeds <= counts.length).length /
        iterations,
    },
    null,
    2,
  ),
);
