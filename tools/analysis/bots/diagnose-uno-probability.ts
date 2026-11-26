import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { unoLeafFeatureNames } from '../../../games/uno/bot/calibration';
import { fitModel, linearPrediction, probability } from './fit';
import { fitUnoCalibration, referenceAnchor } from './uno-calibration-fit';
import { average, bootstrap } from './uno-calibration-seed';
import { naturalFitCorpus } from './uno-fit-corpus';
import { pendingCalibration, penaltyKinds } from './uno-pending';

type Sample = {
  seed: number;
  natural: boolean;
  kind: string;
  features: readonly number[];
  target: number;
};
type Prediction = { sample: Sample; estimate: number };
const candidates = [
  'anchored-seed',
  'anchored-sqrt',
  'anchored-row',
  'simple-seed',
  'anchored-recalibrated',
] as const;
type Candidate = (typeof candidates)[number];

function read(path: string) {
  const bytes = readFileSync(path);
  return {
    value: JSON.parse(bytes.toString('utf8')),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function groupFolds(samples: readonly Sample[]) {
  const natural = [
    ...new Set(samples.filter((row) => row.natural).map((row) => row.seed)),
  ].sort((a, b) => a - b);
  const partition = new Map(natural.map((seed, index) => [seed, index % 4]));
  return Array.from({ length: 4 }, (_, fold) => {
    const belongs = (sample: Sample) =>
      (partition.get(sample.seed) ?? sample.seed % 4) === fold;
    return {
      fit: samples.filter((sample) => !belongs(sample)),
      check: samples.filter(belongs),
    };
  });
}

function train(samples: readonly Sample[], power: number) {
  const counts = new Map<number, number>();
  for (const { seed } of samples) counts.set(seed, (counts.get(seed) ?? 0) + 1);
  const natural = new Set(
    samples.filter((row) => row.natural).map((row) => row.seed),
  );
  const mean = average(
    [...natural].map((seed) => counts.get(seed)! ** (1 - power)),
  )!;
  return fitUnoCalibration(
    samples.map((s) => ({
      ...s,
      weight: s.natural
        ? 1 / counts.get(s.seed)! ** power / mean
        : 0.2 / counts.get(s.seed)!,
    })),
    'anchored',
  );
}

function logit(sample: Sample, coefficients: readonly number[]) {
  return linearPrediction(sample.features, coefficients);
}

function recalibrate(samples: readonly Sample[]) {
  const validation = groupFolds(samples).flatMap(({ fit, check }) => {
    const coefficients = train(fit, 1).coefficients;
    return check
      .filter((row) => row.natural)
      .map((row) => ({
        features: [1, logit(row, coefficients)],
        target: row.target,
        weight: 1,
      }));
  });
  const adjusted = fitModel(validation, 'logistic', 0.02, [0, 1]);
  if (adjusted[1]! <= 0)
    throw new Error('Expected a monotone probability adjustment');
  return adjusted;
}

function squaredError({ sample, estimate }: Prediction) {
  return (
    sample.target * (1 - estimate) ** 2 + (1 - sample.target) * estimate ** 2
  );
}

function summarize(rows: readonly Prediction[]) {
  const estimates = average(rows.map(({ estimate }) => estimate));
  const outcomes = average(rows.map(({ sample }) => sample.target));
  return {
    rows: rows.length,
    seeds: new Set(rows.map(({ sample }) => sample.seed)).size,
    estimates,
    outcomes,
    gap:
      estimates === null || outcomes === null
        ? null
        : Math.abs(estimates - outcomes),
    brier: average(rows.map(squaredError)),
  };
}

function paired(
  current: readonly Prediction[],
  reference: readonly Prediction[],
) {
  const bySeed = new Map<number, number[]>();
  for (const [index, row] of current.entries()) {
    const previous = reference[index]!;
    if (previous.sample !== row.sample)
      throw new Error('Probability test lost the same-seed pairing');
    const values = bySeed.get(row.sample.seed) ?? [];
    values.push(squaredError(row) - squaredError(previous));
    bySeed.set(row.sample.seed, values);
  }
  const differences = [...bySeed.values()].map((values) => average(values)!);
  return {
    mean: average(differences),
    interval95: bootstrap(differences, 0x7c182),
  };
}

const { values } = parseArgs({
  options: {
    natural: { type: 'string', multiple: true },
    pending: { type: 'string' },
    'check-natural': { type: 'string' },
  },
});
if (!values.natural?.length || !values.pending)
  throw new Error('Pass the existing natural and pending fit collections');
const natural = values.natural.map(read);
const pending = read(values.pending);
const naturalOptions = natural[0]!.value.naturalOptions;
function readNatural(value: ReturnType<typeof read>['value']) {
  if (!Array.isArray(value?.fit) || !value.fit.length)
    throw new Error('Expected a natural fit corpus');
  const seeds = value.fit.map(({ seed }: { seed: number }) => seed);
  return naturalFitCorpus(value, naturalOptions, seeds).fit;
}

function naturalSamples(fit: ReturnType<typeof readNatural>): Sample[] {
  return fit.flatMap(({ seed, rows }) =>
    rows.map((row) => ({
      seed,
      natural: true,
      kind: row.stage,
      features: row.features,
      target: row.wins / row.completed,
    })),
  );
}

const fits = natural.flatMap(({ value }) => readNatural(value));
const naturalSeeds = fits.map(({ seed }) => seed);
const supplemental = pendingCalibration(pending.value);
const pendingFits = supplemental.fit;
const seedGroups = [...naturalSeeds, ...pendingFits.map(({ seed }) => seed)];
if (naturalSeeds.length < 16 || new Set(seedGroups).size !== seedGroups.length)
  throw new Error(
    'Need disjoint natural and supplemental fit groups for nested validation',
  );
const samples: Sample[] = [
  ...naturalSamples(fits),
  ...pendingFits.flatMap(({ seed, rows }) =>
    rows.map((row) => ({
      seed,
      natural: false,
      kind: row.kind,
      features: row.features,
      target: row.wins / row.completed,
    })),
  ),
];

function forecast(
  splits: readonly { fit: readonly Sample[]; check: readonly Sample[] }[],
) {
  const predictions: Record<Candidate, Prediction[]> = {
    'anchored-seed': [],
    'anchored-sqrt': [],
    'anchored-row': [],
    'simple-seed': [],
    'anchored-recalibrated': [],
  };
  for (const { fit, check } of splits) {
    const anchored = train(fit, 1);
    const coefficients = {
      'anchored-seed': anchored.coefficients,
      'anchored-sqrt': train(fit, 0.5).coefficients,
      'anchored-row': train(fit, 0).coefficients,
      'simple-seed': referenceAnchor(
        anchored.reference,
        unoLeafFeatureNames.length,
      ),
      'anchored-recalibrated': anchored.coefficients,
    };
    const [intercept, slope] = recalibrate(fit);
    for (const candidate of candidates) {
      for (const sample of check) {
        const raw = logit(sample, coefficients[candidate]);
        const score =
          candidate === 'anchored-recalibrated'
            ? intercept! + slope! * raw
            : raw;
        predictions[candidate].push({ sample, estimate: probability(score) });
      }
    }
  }

  return predictions;
}
function compare(predictions: Record<Candidate, Prediction[]>) {
  const baseline = predictions['anchored-seed'].filter(
    ({ sample }) => sample.natural,
  );
  return Object.fromEntries(
    candidates.map((candidate) => {
      const natural = predictions[candidate].filter(
        ({ sample }) => sample.natural,
      );
      return [
        candidate,
        {
          natural: summarize(natural),
          naturalBrierChangeBySeed: paired(natural, baseline),
          bins: Array.from({ length: 10 }, (_, index) => ({
            index,
            ...summarize(
              natural.filter(
                ({ estimate }) =>
                  Math.min(9, Math.floor(estimate * 10)) === index,
              ),
            ),
          })),
          pendingFitCases: Object.fromEntries(
            penaltyKinds.map((kind) => [
              kind,
              summarize(
                predictions[candidate].filter(
                  ({ sample }) => !sample.natural && sample.kind === kind,
                ),
              ),
            ]),
          ),
        },
      ];
    }),
  );
}

const review = values['check-natural'] ? read(values['check-natural']) : null;
const reviewFit = review ? readNatural(review.value) : [];
if (review) {
  const occupied = new Set([
    ...seedGroups,
    ...supplemental.review.map(({ seed }) => seed),
  ]);
  const reviewSeeds = reviewFit.map(({ seed }) => seed);
  if (
    reviewSeeds.length < 8 ||
    new Set(reviewSeeds).size !== reviewSeeds.length ||
    reviewSeeds.some((seed) => occupied.has(seed))
  )
    throw new Error(
      'The development check needs at least eight new opening seeds outside both fit collections and pending review',
    );
}
console.log(
  JSON.stringify(
    {
      type: 'uno-probability-development',
      diagnosticsOnly: true,
      source: {
        naturalCorpusSha256: natural.map(({ sha256 }) => sha256),
        pendingSha256: pending.sha256,
      },
      folds: 4,
      naturalFitSeeds: naturalSeeds.length,
      pendingFitSeeds: pendingFits.length,
      methods: compare(forecast(groupFolds(samples))),
      ...(review
        ? {
            independentCheck: {
              corpusSha256: review.sha256,
              seeds: reviewFit.map(({ seed }) => seed),
              methods: compare(
                forecast([{ fit: samples, check: naturalSamples(reviewFit) }]),
              ),
            },
          }
        : {}),
    },
    null,
    2,
  ),
);
