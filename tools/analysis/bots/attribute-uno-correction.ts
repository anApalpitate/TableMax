import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { loadUnoLeafScorer } from '../../../games/uno/bot/calibration';
import { loadUnoCorrection } from '../../../games/uno/bot/correction';
import {
  captureAttributionRoots,
  measureAttribution,
  poolPlaceboTuning,
  summarizeAttribution,
  tunePlacebo,
  type AttributionObservation,
  type Placebo,
} from './uno-attribution';
import { calibrationSeeds } from './uno-calibration-provenance';
import { matchesUnoCorrectionCalibration } from './uno-correction-provenance';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';
import { validateUnoComparisonPlan } from './uno-comparison-plan';
import { openTrainingCheckpoint } from './training-checkpoint';

const { values } = parseArgs({
  options: {
    stage: { type: 'string' },
    calibration: { type: 'string' },
    correction: { type: 'string' },
    plan: { type: 'string' },
    'abc-plan': { type: 'string' },
    'tuning-report': { type: 'string' },
    checkpoint: { type: 'string' },
  },
});
const stage = values.stage;
if (stage !== 'tune' && stage !== 'review')
  throw new Error('Choose --stage=tune or --stage=review');
if ((stage === 'review') !== Boolean(values['tuning-report']))
  throw new Error('Review requires the frozen tuning report');
const hash = (value: Buffer | string) =>
  createHash('sha256').update(value).digest('hex');
const digest = (value: unknown) => hash(JSON.stringify(value));
const read = (path: string | undefined) => {
  if (!path)
    throw new Error(
      'Supply calibration, correction, attribution plan and A/B/C plan paths',
    );
  const bytes = readFileSync(path);
  return { value: JSON.parse(bytes.toString('utf8')), sha256: hash(bytes) };
};
const b = read(values.calibration);
const c = read(values.correction);
const input = read(values.plan);
const abc = read(values['abc-plan']);
const plan = input.value;
const seeds = (value: unknown): number[] => {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some(
      (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
    )
  )
    throw new Error(
      'Attribution inputs must declare non-empty positive 32-bit seed lists',
    );
  if (new Set(value).size !== value.length)
    throw new Error('Attribution inputs contain duplicate seeds');
  return value;
};
if (
  plan?.version !== 1 ||
  !Number.isSafeInteger(plan.roots) ||
  plan.roots < 1 ||
  !Number.isSafeInteger(plan.maxSteps) ||
  plan.maxSteps < 1 ||
  !Number.isSafeInteger(plan.continuations) ||
  plan.continuations < 16 ||
  !Number.isInteger(plan.bootstrapSeed) ||
  plan.bootstrapSeed < 1 ||
  plan.bootstrapSeed > 0xffffffff
)
  throw new Error('Invalid frozen calibration attribution plans');

const tune = seeds(plan.tuneSeeds),
  review = seeds(plan.reviewSeeds);
const comparisonSeeds = validateUnoComparisonPlan(abc.value);
const modelInputs = [
  ...calibrationSeeds(b.value),
  ...seeds(c.value.trainSeeds),
  ...seeds(c.value.tuneSeeds),
  ...(c.value.localCorpus?.seeds?.length
    ? seeds(c.value.localCorpus.seeds)
    : []),
  ...comparisonSeeds,
];
const reserved = new Set(modelInputs);
if (reserved.size !== modelInputs.length)
  throw new Error('The B, C or A/B/C partitions overlap');
if (
  tune.some((seed) => reserved.has(seed) || review.includes(seed)) ||
  review.some((seed) => reserved.has(seed))
)
  throw new Error(
    'Placebo tuning and review must be disjoint from all B, C and A/B/C seed pools',
  );

const calibrationDigest = digest(b.value.calibration);
const candidateDigest = digest(c.value.model);
if (
  [b.value, c.value].some((report) => !isCurrentUnoPilot(report?.pilot)) ||
  b.value.type !== 'uno-calibration-development' ||
  b.value.evaluation !== 'meets-measured-gates' ||
  b.value.calibrationDigest !== calibrationDigest ||
  !matchesUnoCorrectionCalibration(c.value, b.value, b.sha256)
)
  throw new Error(
    'Attribution requires a qualified B matching the frozen C report and search sample budget',
  );
const samples = b.value.options.hypotheses as 8 | 16;
const model = loadUnoCorrection(c.value.model, calibrationDigest);
if (model.weight === 0)
  throw new Error('Attribution requires a non-zero frozen C model');
const options = {
  roots: plan.roots,
  maxSteps: plan.maxSteps,
  continuations: plan.continuations,
  hypotheses: samples,
};
const fit = {
  calibration: b.value.calibration,
  calibrationDigest,
  candidateDigest,
  model,
};
const binding = {
  attributionPlan: input.sha256,
  abcPlan: abc.sha256,
  calibrationReport: b.sha256,
  correctionReport: c.sha256,
  calibrationDigest,
  candidateDigest,
};
const tuningInput = stage === 'review' ? read(values['tuning-report']) : null;
type TuningProof = {
  type: string;
  pilot: unknown;
  binding: unknown;
  units: { seed: number; placebo: Placebo }[];
  placebo: Placebo;
};
const tuning = tuningInput?.value as TuningProof | undefined;
if (
  stage === 'review' &&
  (tuning?.type !== 'uno-residual-placebo-tuning' ||
    !isCurrentUnoPilot(tuning.pilot) ||
    !isDeepStrictEqual(tuning.binding, binding) ||
    !Array.isArray(tuning.units) ||
    !isDeepStrictEqual(
      tuning.units.map(({ seed }: { seed: number }) => seed),
      tune,
    ) ||
    !isDeepStrictEqual(
      tuning.placebo,
      poolPlaceboTuning(
        tuning.units.map(({ placebo }: { placebo: Placebo }) => placebo),
      ),
    ))
)
  throw new Error('The tuning report does not match these frozen inputs');

type Unit = {
  seed: number;
  roots: number;
  placebo?: Placebo;
  observations?: AttributionObservation[];
};
const assigned = stage === 'tune' ? tune : review;
const checkpoint = values.checkpoint
  ? openTrainingCheckpoint<Unit[]>(
      values.checkpoint,
      digest({ stage, binding, tuning: tuningInput?.sha256 }),
      [],
    )
  : null;
const units = checkpoint?.state ?? [];
if (
  !Array.isArray(units) ||
  units.some(
    (unit, index) =>
      unit?.seed !== assigned[index] ||
      (stage === 'tune' ? !unit.placebo : !Array.isArray(unit.observations)),
  )
)
  throw new Error('Attribution checkpoint contains different seed order');
const score = loadUnoLeafScorer(b.value.calibration);
for (const seed of assigned.slice(units.length)) {
  const counted = await captureAttributionRoots(seed, options, fit);
  const roots = counted.roots;
  const unit: Unit =
    stage === 'tune'
      ? { seed, roots, placebo: tunePlacebo(counted.captured, model, samples) }
      : {
          seed,
          roots,
          observations: measureAttribution(
            counted.captured,
            model,
            options,
            score,
            tuning!.placebo.retention,
          ),
        };
  units.push(unit);
  checkpoint?.save(units);
  console.error(
    JSON.stringify({
      stage,
      seed,
      roots,
      completed: units.length,
      expected: assigned.length,
    }),
  );
}
if (stage === 'tune') {
  console.log(
    JSON.stringify(
      {
        type: 'uno-residual-placebo-tuning',
        pilot: unoPilotEvidence,
        binding,
        units,
        placebo: poolPlaceboTuning(units.map(({ placebo }) => placebo!)),
      },
      null,
      2,
    ),
  );
} else {
  const evidence = units.flatMap(({ observations }) => observations!);
  console.log(
    JSON.stringify(
      {
        type: 'uno-residual-attribution',
        pilot: unoPilotEvidence,
        binding,
        diagnosticsOnly: true,
        rootsSampled: units.reduce((total, unit) => total + unit.roots, 0),
        tuningReportSha256: tuningInput!.sha256,
        tuning: tuning!.placebo,
        diagnostics: summarizeAttribution(
          evidence,
          tuning!.placebo,
          plan.bootstrapSeed,
        ),
        units,
      },
      null,
      2,
    ),
  );
}
