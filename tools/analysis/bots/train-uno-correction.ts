import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadUnoLeafScorer } from '../../../games/uno/bot/calibration';
import {
  unoCorrectedBest,
  unoCorrectionFeatureNames,
  unoSearchBest,
  type UnoCorrectionModel,
} from '../../../games/uno/bot/correction';
import {
  searchUnoPlays,
  type UnoSearchResult,
} from '../../../games/uno/bot/search';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { fitModel, type WeightedExample } from './fit';
import { collectUnoResidualExamples } from './uno-residual-labels';
import {
  collectUnoRoots,
  independentSeed,
  pairedUnoDifferences,
  sampleUnoContinuations,
  type UnoRoot,
  type UnoSampleOptions,
} from './uno-samples';

function seedList(value: string | undefined) {
  const values = value?.split(',').map(Number);
  if (
    !values?.length ||
    new Set(values).size !== values.length ||
    values.some(
      (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
    )
  )
    throw new Error('Pass unique positive 32-bit seeds');
  return values;
}

const { values } = parseArgs({
  options: {
    calibration: { type: 'string' },
    'train-seeds': { type: 'string' },
    'tune-seeds': { type: 'string' },
    roots: { type: 'string', default: '2' },
    continuations: { type: 'string', default: '16' },
    'max-steps': { type: 'string', default: '15000' },
  },
});
if (!values.calibration)
  throw new Error('Pass a frozen UNO B calibration report');
const report = JSON.parse(readFileSync(values.calibration, 'utf8'));
const hypotheses = report?.options?.hypotheses;
if (
  report?.type !== 'uno-calibration-development' ||
  report?.evaluation !== 'meets-measured-gates' ||
  !Array.isArray(report.trainSeeds) ||
  !Array.isArray(report.holdoutSeeds) ||
  (hypotheses !== 8 && hypotheses !== 16)
)
  throw new Error(
    'UNO correction training requires a B report meeting the measured calibration gates',
  );
const calibrationDigest = createHash('sha256')
  .update(JSON.stringify(report.calibration))
  .digest('hex');
if (report.calibrationDigest !== calibrationDigest)
  throw new Error('The B calibration digest does not match the frozen report');
const scoreLeaf = loadUnoLeafScorer(report.calibration);
const trainSeeds = seedList(values['train-seeds']);
const tuneSeeds = seedList(values['tune-seeds']);
const excluded = new Set<number>([
  ...report.trainSeeds,
  ...report.holdoutSeeds,
]);
if (
  trainSeeds.some((seed) => excluded.has(seed)) ||
  tuneSeeds.some((seed) => excluded.has(seed) || trainSeeds.includes(seed))
)
  throw new Error(
    'C training and tuning must use separate seed pools outside B calibration',
  );
const options: UnoSampleOptions = {
  roots: Number(values.roots),
  hypotheses,
  continuations: Number(values.continuations),
  maxSteps: Number(values['max-steps']),
};
if (
  [options.roots, options.continuations, options.maxSteps].some(
    (value) => !Number.isSafeInteger(value) || value < 1,
  )
)
  throw new Error('Invalid correction training budget');

interface PositionEvidence {
  root: UnoRoot;
  short: UnoSearchResult;
  outcomes: readonly (readonly (0 | 1 | null)[])[];
  unfinished: number;
}
async function collect(
  seed: number,
  salt: number,
): Promise<PositionEvidence[]> {
  const result: PositionEvidence[] = [];
  const roots = await collectUnoRoots(seed, options);
  for (const [index, root] of roots.entries()) {
    const signal = new AbortController().signal;
    const short = searchUnoPlays(
      root.view,
      root.actions,
      root.memory,
      new RandomSource(independentSeed(seed, salt + index)),
      signal,
      scoreLeaf,
      { samples: hypotheses, maxRuleSteps: hypotheses * 8 * 16 },
    );
    if (!short.candidates.length) continue;
    const long = sampleUnoContinuations(
      root,
      {
        ...options,
        seed: independentSeed(seed, salt + 0x10000 + index),
      },
      scoreLeaf,
    );
    if (
      JSON.stringify(long.short.candidates.map(({ action }) => action)) !==
      JSON.stringify(short.candidates.map(({ action }) => action))
    )
      throw new Error('The frozen short and long UNO candidate sets differ');
    result.push({
      root,
      short,
      outcomes: long.outcomes,
      unfinished: long.unfinished,
    });
  }
  return result;
}

const training: WeightedExample[] = [];
let trainingUnfinished = 0;
for (const seed of trainSeeds) {
  const positions = await collect(seed, 0xc0000);
  for (const { root, short, outcomes, unfinished } of positions) {
    trainingUnfinished += unfinished;
    const rows = collectUnoResidualExamples(
      root,
      short,
      outcomes,
      options.continuations,
    );
    training.push(
      ...rows.map((row) => ({ ...row, weight: row.weight / positions.length })),
    );
  }
  console.error(
    JSON.stringify({ phase: 'residual-labels', seed, rows: training.length }),
  );
}
if (!training.length)
  throw new Error('No complete paired residual labels were available');
const penalty = 0.001;
const solver = fileURLToPath(new URL('./ridge-cuda.py', import.meta.url));
const gpu = spawnSync('python', ['-B', solver], {
  input: JSON.stringify({ examples: training, penalty }),
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
});
if (gpu.error) throw gpu.error;
if (gpu.status !== 0)
  throw new Error(gpu.stderr || 'UNO residual GPU fit failed');
const fit = JSON.parse(gpu.stdout) as {
  coefficients: number[];
  device: string;
  torch: string;
};
const independentFit = fitModel(training, 'linear', penalty);
if (
  fit.coefficients.length !== independentFit.length ||
  fit.coefficients.some(
    (coefficient, index) =>
      !Number.isFinite(coefficient) ||
      Math.abs(coefficient - independentFit[index]!) > 1e-6,
  )
)
  throw new Error('GPU fit differs from the independent numeric check');
const model: UnoCorrectionModel = {
  version: 1,
  calibrationDigest,
  features: unoCorrectionFeatureNames,
  coefficients: fit.coefficients,
  weight: 0,
  cap: 0.01,
};
const tuning: PositionEvidence[][] = [];
for (const seed of tuneSeeds) {
  tuning.push(await collect(seed, 0xe0000));
  console.error(
    JSON.stringify({
      phase: 'residual-tuning',
      seed,
      positions: tuning.at(-1)!.length,
    }),
  );
}
const tuneResults = [0, 0.25, 0.5, 0.75].flatMap((weight) =>
  [0.01, 0.02, 0.03].map((cap) => {
    let changes = 0;
    let matched = 0;
    const seedGains: number[] = [];
    for (const positions of tuning) {
      const gains: number[] = [];
      for (const { root, short, outcomes } of positions) {
        const baseline = unoSearchBest(short.candidates)!;
        const selected = unoCorrectedBest(
          short,
          root.view,
          root.memory,
          { ...model, weight, cap },
          hypotheses,
        )!;
        const differences = pairedUnoDifferences(
          outcomes.map((trials) =>
            trials.some((trial) => trial === null)
              ? trials.map(() => null)
              : trials,
          ),
          options.continuations,
          short.candidates.indexOf(selected),
          short.candidates.indexOf(baseline),
        );
        if (!differences.length) continue;
        matched++;
        if (selected !== baseline) changes++;
        gains.push(
          differences.reduce((sum, value) => sum + value, 0) /
            differences.length,
        );
      }
      if (gains.length)
        seedGains.push(
          gains.reduce((sum, value) => sum + value, 0) / gains.length,
        );
    }
    return {
      weight,
      cap,
      changes,
      matched,
      seeds: seedGains.length,
      gain: seedGains.length
        ? seedGains.reduce((sum, gain) => sum + gain, 0) / seedGains.length
        : 0,
    };
  }),
);
const frozen = tuneResults.reduce((best, current) =>
  current.gain > best.gain + Number.EPSILON && current.matched >= best.matched
    ? current
    : best,
);
console.log(
  JSON.stringify(
    {
      type: 'uno-residual-candidate',
      calibrationDigest,
      trainSeeds,
      tuneSeeds,
      options,
      device: fit.device,
      torch: fit.torch,
      trainingRows: training.length,
      trainingUnfinished,
      tuningUnfinished: tuning
        .flat()
        .reduce((sum, position) => sum + position.unfinished, 0),
      tuneResults,
      model: { ...model, weight: frozen.weight, cap: frozen.cap },
    },
    null,
    2,
  ),
);
