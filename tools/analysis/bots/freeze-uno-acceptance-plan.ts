import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { calibrationSeeds } from './uno-calibration-provenance';
import { matchesUnoCorrectionCalibration } from './uno-correction-provenance';
import { correctionSeeds } from './uno-correction-seeds';
import {
  unoPools,
  validateUnoComparisonPlan,
  type UnoComparisonPlan,
} from './uno-comparison-plan';
import { unoOpponentPools, type UnoPool } from './uno-paired-statistics';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';

const { values } = parseArgs({
  options: {
    selection: { type: 'string' },
    calibration: { type: 'string' },
    correction: { type: 'string' },
    'output-dir': { type: 'string' },
    seed: { type: 'string' },
    'exclude-seeds': { type: 'string' },
    'max-steps': { type: 'string', default: '15000' },
    'attribution-tune': { type: 'string', default: '24' },
    'attribution-review': { type: 'string', default: '48' },
  },
});
if (
  !values.selection ||
  !values.calibration ||
  !values.correction ||
  !values['output-dir'] ||
  !values.seed
)
  throw new Error(
    'Pass the C development selection, frozen reports, an output directory and an allocation seed',
  );

const sha = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
function read(path: string) {
  const bytes = readFileSync(path);
  return { value: JSON.parse(bytes.toString('utf8')), sha256: sha(bytes) };
}
const selection = read(values.selection);
const b = read(values.calibration);
const c = read(values.correction);
const chosen = selection.value;
if (
  b.value?.type !== 'uno-calibration-development' ||
  !isCurrentUnoPilot(b.value.pilot) ||
  b.value.evaluation !== 'meets-measured-gates' ||
  b.value.calibrationDigest !== sha(JSON.stringify(b.value.calibration)) ||
  !matchesUnoCorrectionCalibration(c.value, b.value, b.sha256) ||
  !isCurrentUnoPilot(c.value.pilot) ||
  !(c.value.model?.weight > 0) ||
  chosen?.type !== 'uno-candidate-development-selection' ||
  chosen.diagnosticsOnly !== true ||
  !isCurrentUnoPilot(chosen.pilot) ||
  chosen.selected?.compared !== true ||
  chosen.calibrationReportSha256 !== b.sha256 ||
  chosen.selected?.candidateSha256 !== c.sha256
)
  throw new Error(
    'Freeze the formal plan with the qualified B and selected C reports',
  );

const size = chosen.sizing;
const first = size?.firstBlocks;
const extra = size?.extraBlocks;
const looks = extra === 0 ? 1 : 2;
if (
  !Number.isSafeInteger(first) ||
  first < 8 ||
  first % (looks === 2 ? 8 : 4) !== 0 ||
  !Number.isSafeInteger(extra) ||
  (looks === 2 && extra !== first / 2) ||
  size.maximumBlocks !== first + extra ||
  size.firstMatches !== first * 12 ||
  !Number.isFinite(size.halfWidth) ||
  size.halfWidth <= 0 ||
  size.halfWidth >= 1 ||
  !Array.isArray(size.pools) ||
  size.pools.length !== unoPools.length ||
  unoPools.some((pool) => {
    const quota = size.pools.find(
      (item: { pool?: unknown }) => item?.pool === pool,
    );
    const weight = unoOpponentPools[pool].weight;
    return quota?.first !== first * weight || quota?.extra !== extra * weight;
  })
)
  throw new Error(
    'The selected development report needs a complete sample-size estimate',
  );

const uint32 = (seed: number) =>
  Number.isInteger(seed) && seed >= 1 && seed <= 0xffffffff;
const allocationSeed = Number(values.seed);
const maxSteps = Number(values['max-steps']);
const tune = Number(values['attribution-tune']);
const review = Number(values['attribution-review']);
if (
  !uint32(allocationSeed) ||
  !Number.isSafeInteger(maxSteps) ||
  maxSteps < 1 ||
  !Number.isSafeInteger(tune) ||
  tune < 1 ||
  !Number.isSafeInteger(review) ||
  review < 1
)
  throw new Error('Invalid allocation seed or rollout budget');
const development = chosen.developmentSeeds;
const core = [...calibrationSeeds(b.value), ...correctionSeeds(c.value)];
if (
  !Array.isArray(development) ||
  !development.length ||
  new Set([...core, ...development]).size !==
    core.length + development.length ||
  !development.every(uint32)
)
  throw new Error('Invalid or overlapping development opening seeds');
const other =
  values['exclude-seeds'] === undefined
    ? []
    : values['exclude-seeds'].split(',').map(Number);
if (!other.every(uint32))
  throw new Error('Invalid additional opening seed exclusions');
const excluded = new Set([...core, ...development, ...other]);
if (first + extra + tune + review + 2 > 0xffffffff - excluded.size)
  throw new Error(
    'The requested cohorts exceed the available opening seed space',
  );

const random = new RandomSource(allocationSeed);
function allocate(count: number) {
  const result: number[] = [];
  while (result.length < count) {
    const next = Math.floor(random.next() * 0xffffffff) + 1;
    if (excluded.has(next)) continue;
    excluded.add(next);
    result.push(next);
  }
  return result;
}
const pairingSeed = allocate(1)[0]!;
const seeds = Object.fromEntries(
  unoPools.map((pool) => {
    const weight = unoOpponentPools[pool].weight;
    return [
      pool,
      { first: allocate(first * weight), extra: allocate(extra * weight) },
    ];
  }),
) as Record<UnoPool, { first: number[]; extra: number[] }>;
const plan: UnoComparisonPlan = {
  version: 1,
  looks,
  bootstrapSeed: pairingSeed,
  maxSteps,
  developmentSeeds: development,
  selection: {
    reportSha256: selection.sha256,
    calibrationReportSha256: b.sha256,
    candidateReportSha256: c.sha256,
  },
  seeds,
};
validateUnoComparisonPlan(plan);
const encode = (object: unknown) => JSON.stringify(object, null, 2) + '\n';
const planBytes = encode(plan);
const attribution = {
  version: 1,
  acceptancePlanSha256: sha(planBytes),
  bootstrapSeed: allocate(1)[0]!,
  roots: 2,
  maxSteps,
  continuations: 16,
  tuneSeeds: allocate(tune),
  reviewSeeds: allocate(review),
};
const attributionBytes = encode(attribution);
const frozen = {
  type: 'uno-frozen-acceptance-inputs',
  version: 1,
  pilot: unoPilotEvidence,
  allocationSeed,
  selection: plan.selection,
  otherExcludedSeeds: [...new Set(other)].sort((a, b) => a - b),
  acceptancePlanSha256: sha(planBytes),
  attributionPlanSha256: sha(attributionBytes),
  firstBlocks: first,
  extraBlocks: extra,
  halfWidth: size.halfWidth,
  looks,
};
const directory = resolve(values['output-dir']);
const output = lstatSync(directory);
if (!output.isDirectory() || output.isSymbolicLink())
  throw new Error('Use an existing isolated output directory');
const entries = [
  ['acceptance-plan.json', planBytes],
  ['attribution-plan.json', attributionBytes],
  ['frozen-acceptance-inputs.json', encode(frozen)],
] as const;
for (const [name, bytes] of entries) {
  const path = join(directory, name);
  const existing = lstatSync(path, { throwIfNoEntry: false });
  if (
    existing &&
    (!existing.isFile() ||
      existing.isSymbolicLink() ||
      readFileSync(path, 'utf8') !== bytes)
  )
    throw new Error(
      'Preserve the existing frozen acceptance plan and use a new output directory',
    );
}
for (const [name, bytes] of entries) {
  const path = join(directory, name);
  if (!lstatSync(path, { throwIfNoEntry: false }))
    writeFileSync(path, bytes, { flag: 'wx', flush: true, mode: 0o600 });
}
console.log(JSON.stringify(frozen, null, 2));
