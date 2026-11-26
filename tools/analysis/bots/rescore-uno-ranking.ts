import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import {
  loadUnoLeafScorer,
  unoLeafFeatureNames,
} from '../../../games/uno/bot/calibration';
import { searchUnoPlays } from '../../../games/uno/bot/search';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { calibrationSeeds } from './uno-calibration-provenance';
import { referenceAnchor } from './uno-calibration-fit';
import { average, bootstrap } from './uno-calibration-seed';
import { isCurrentUnoPilot } from './uno-pilot';
import { collectUnoRoots, independentSeed, type UnoRoot } from './uno-samples';

const budgets = [8, 16] as const;
interface RootEvidence {
  root: UnoRoot;
  pairs: number;
  confirmed: number;
  reference: { left: number; right: number; difference: number }[];
  ordered: Record<`fitted${8 | 16}` | `simple${8 | 16}`, number>;
}
interface GroupEvidence {
  seed: number;
  evidence: RootEvidence[];
}
const { values } = parseArgs({
  options: {
    baseline: { type: 'string' },
    fit: { type: 'string' },
    plan: { type: 'string' },
    checkpoint: { type: 'string' },
    development: { type: 'string' },
    preview: { type: 'boolean', default: false },
  },
});
if (
  !values.baseline ||
  !values.fit ||
  !values.plan ||
  !values.checkpoint ||
  values.preview === Boolean(values.development)
)
  throw new Error(
    'Pass baseline, fit, plan and checkpoint plus either the completed development report or --preview',
  );

const sha = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex');
function read(path: string) {
  const bytes = readFileSync(path);
  return { value: JSON.parse(bytes.toString('utf8')), digest: sha(bytes) };
}
const baseline = read(values.baseline);
const fit = read(values.fit);
const planInput = read(values.plan);
const checkpoint = read(values.checkpoint);
const development = values.development ? read(values.development) : null;
const plan = planInput.value;
if (
  !isCurrentUnoPilot(baseline.value?.pilot) ||
  !isCurrentUnoPilot(fit.value?.pilot) ||
  baseline.value.type !== 'uno-calibration-development' ||
  fit.value.type !== 'uno-calibration-fit' ||
  baseline.value.calibrationDigest !==
    sha(JSON.stringify(baseline.value.calibration)) ||
  fit.value.calibrationDigest !== sha(JSON.stringify(fit.value.calibration))
)
  throw new Error('Expected current B reference and frozen fit coefficients');
if (
  plan?.version !== 1 ||
  !Array.isArray(plan.seeds) ||
  !plan.seeds.length ||
  new Set(plan.seeds).size !== plan.seeds.length ||
  plan.seeds.some(
    (seed: number) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
  ) ||
  !Number.isSafeInteger(plan.maxSteps) ||
  plan.maxSteps < 1 ||
  !Number.isSafeInteger(plan.roots) ||
  plan.roots < 1 ||
  !Number.isSafeInteger(plan.ranking?.continuations) ||
  plan.ranking.continuations < 1
)
  throw new Error('Invalid ranking development plan');

const fitSeeds = fit.value.trainSeeds;
const supplementalSeeds = fit.value.pending?.fitSeeds ?? [];
if (
  !Array.isArray(fitSeeds) ||
  !fitSeeds.length ||
  !Array.isArray(supplementalSeeds) ||
  [...fitSeeds, ...supplementalSeeds].some(
    (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
  )
)
  throw new Error('The frozen fit must identify its source openings');
const excluded = new Set([
  ...calibrationSeeds(baseline.value),
  ...fitSeeds,
  ...supplementalSeeds,
]);
if (plan.seeds.some((seed: number) => excluded.has(seed)))
  throw new Error(
    'Ranking development openings must be independent of the fitted and reviewed openings',
  );

const records = checkpoint.value?.state as GroupEvidence[];
if (
  checkpoint.value?.version !== 1 ||
  !Array.isArray(records) ||
  !records.length ||
  records.length > plan.seeds.length ||
  records.some(
    (record, index) =>
      record?.seed !== plan.seeds[index] || !Array.isArray(record.evidence),
  )
)
  throw new Error(
    'The ranking records must follow the frozen development plan',
  );

if (development) {
  const report = development.value;
  if (
    report?.type !== 'uno-b-ranking-development' ||
    report.diagnosticsOnly !== true ||
    report.complete !== true ||
    !isDeepStrictEqual(report.plan, plan) ||
    report.bSha256 !== baseline.digest ||
    records.length !== plan.seeds.length ||
    checkpoint.value.identity !==
      sha(
        JSON.stringify([
          planInput.digest,
          baseline.digest,
          report.sourceSha256,
          process.version,
        ]),
      )
  )
    throw new Error(
      'The ranking checkpoint does not match the completed development report',
    );
}

const originalScorer = loadUnoLeafScorer(baseline.value.calibration);
const mergedScorer = loadUnoLeafScorer(fit.value.calibration);
const simpleScorer = loadUnoLeafScorer({
  version: 1,
  features: unoLeafFeatureNames,
  coefficients: referenceAnchor(
    baseline.value.baselineCoefficients,
    unoLeafFeatureNames.length,
  ),
});
function score(
  root: UnoRoot,
  seed: number,
  samples: 8 | 16,
  scorer: typeof originalScorer,
) {
  return searchUnoPlays(
    root.view,
    root.actions,
    root.memory,
    new RandomSource(seed),
    new AbortController().signal,
    scorer,
    { samples, maxRuleSteps: samples * 8 * 16 },
  ).candidates;
}
const options = {
  roots: plan.roots,
  maxSteps: plan.maxSteps,
  continuations: plan.ranking.continuations,
  hypotheses: 8 as const,
};
const results = await Promise.all(
  records.map(async ({ seed, evidence }) => {
    let pairs = 0,
      confirmed = 0;
    const ranking = budgets.map((samples) => ({
      samples,
      original: 0,
      merged: 0,
      simple: 0,
      improved: 0,
      worsened: 0,
    }));
    const seen = new Set<string>();
    const comparable = evidence.filter((row) => {
      if (
        row?.root?.seed !== seed ||
        typeof row.root.id !== 'string' ||
        seen.has(row.root.id) ||
        !Number.isSafeInteger(row.pairs) ||
        row.pairs < 1 ||
        row.pairs > 28 ||
        !Array.isArray(row.reference) ||
        row.reference.length !== row.confirmed ||
        !Number.isSafeInteger(row.confirmed) ||
        row.confirmed > row.pairs ||
        budgets.some((samples) =>
          [
            row.ordered?.[`fitted${samples}`],
            row.ordered?.[`simple${samples}`],
          ].some(
            (count) =>
              !Number.isSafeInteger(count) ||
              count! < 0 ||
              count! > row.confirmed,
          ),
        )
      )
        throw new Error('Invalid stored development root or pair counts');
      seen.add(row.root.id);
      pairs += row.pairs;
      confirmed += row.confirmed;
      return row.confirmed > 0;
    });
    // Restore the root ordinals for openings with confirmed pairs.
    const roots = comparable.length ? await collectUnoRoots(seed, options) : [];
    for (const row of comparable) {
      const ordinal = roots.findIndex(({ id }) => id === row.root.id);
      if (ordinal < 0 || !isDeepStrictEqual(roots[ordinal], row.root))
        throw new Error(
          'An authorized root did not reproduce its original development position',
        );
      const searchSeed = independentSeed(seed, 0x20000 + ordinal);
      for (const method of ranking) {
        const samples = method.samples;
        const original = score(row.root, searchSeed, samples, originalScorer);
        const merged = score(row.root, searchSeed, samples, mergedScorer);
        const simple = score(row.root, searchSeed, samples, simpleScorer);
        if (
          (original.length * (original.length - 1)) / 2 !== row.pairs ||
          !isDeepStrictEqual(
            original.map(({ action }) => action),
            merged.map(({ action }) => action),
          ) ||
          !isDeepStrictEqual(
            original.map(({ action }) => action),
            simple.map(({ action }) => action),
          )
        )
          throw new Error('A replay changed the fixed root candidate set');
        let originalCount = 0,
          simpleCount = 0;
        const comparisons = new Set<string>();
        for (const { left, right, difference } of row.reference) {
          const key = left + '/' + right;
          if (
            !Number.isSafeInteger(left) ||
            !Number.isSafeInteger(right) ||
            left < 0 ||
            right <= left ||
            right >= original.length ||
            !Number.isFinite(difference) ||
            Math.abs(difference) < 0.05 ||
            comparisons.has(key)
          )
            throw new Error('Invalid stored paired direction');
          comparisons.add(key);
          const leads = (scores: typeof original) =>
            Math.sign(
              scores[left]!.winProbability - scores[right]!.winProbability,
            ) === Math.sign(difference);
          const correctOld = leads(original);
          const correctNew = leads(merged);
          if (correctOld) originalCount++;
          if (leads(simple)) simpleCount++;
          if (correctNew) method.merged++;
          if (correctNew && !correctOld) method.improved++;
          if (!correctNew && correctOld) method.worsened++;
        }
        if (
          originalCount !== row.ordered[`fitted${samples}`] ||
          simpleCount !== row.ordered[`simple${samples}`]
        )
          throw new Error(
            'The original ranking did not reproduce its recorded direction counts',
          );
        method.original += originalCount;
        method.simple += simpleCount;
      }
    }
    return { seed, roots: evidence.length, pairs, confirmed, ranking };
  }),
);

const confirmed = results.reduce((total, row) => total + row.confirmed, 0);
const pairs = results.reduce((total, row) => total + row.pairs, 0);
const roots = results.reduce((total, row) => total + row.roots, 0);
if (
  development &&
  [confirmed, pairs, roots].some(
    (value, index) =>
      value !==
      [
        development.value.confirmed,
        development.value.pairs,
        development.value.roots,
      ][index],
  )
)
  throw new Error(
    'Recorded totals disagree with the completed development report',
  );
const methods = budgets.map((samples, index) => {
  const fields = [
    'original',
    'merged',
    'simple',
    'improved',
    'worsened',
  ] as const;
  const ordered = Object.fromEntries(
    fields.map((field) => [
      field,
      results.reduce((total, row) => total + row.ranking[index]![field], 0),
    ]),
  );
  const paired = results
    .filter(({ confirmed }) => confirmed > 0)
    .map(
      (row) =>
        (row.ranking[index]!.merged - row.ranking[index]!.original) /
        row.confirmed,
    );
  return {
    samples,
    ordered,
    accuracies: Object.fromEntries(
      fields
        .slice(0, 3)
        .map((field) => [
          field,
          confirmed ? ordered[field]! / confirmed : null,
        ]),
    ),
    seedsWithConfirmedPairs: paired.length,
    seedPairedAccuracyDifference: average(paired),
    seedPairedInterval95: bootstrap(paired, independentSeed(samples, 0x20e70)),
  };
});
if (
  development &&
  methods.some(
    ({ samples, ordered }) =>
      ordered.original !==
        development.value.methods?.[`fitted${samples}`]?.ordered ||
      ordered.simple !==
        development.value.methods?.[`simple${samples}`]?.ordered,
  )
)
  throw new Error(
    'Replayed baseline counts disagree with the completed development report',
  );

console.log(
  JSON.stringify(
    {
      type: 'uno-b-ranking-rescore',
      diagnosticsOnly: true,
      preview: values.preview,
      baseReportSha256: baseline.digest,
      fitReportSha256: fit.digest,
      planSha256: planInput.digest,
      checkpointSha256: checkpoint.digest,
      developmentReportSha256: development?.digest ?? null,
      seeds: records.length,
      plannedSeeds: plan.seeds.length,
      roots,
      pairs,
      confirmed,
      methods,
    },
    null,
    2,
  ),
);
