import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { calibrationSeeds } from './uno-calibration-provenance';
import {
  matchesUnoComparisonStage,
  unoComparisonDigest,
  validateUnoComparisonPlan,
  type UnoComparisonPlan,
} from './uno-comparison-plan';
import { matchesUnoCorrectionCalibration } from './uno-correction-provenance';
import { correctionSeeds } from './uno-correction-seeds';
import {
  completeUnoBlock,
  sizeUnoComparison,
  summarizeUnoComparison,
  type UnoPairedSeed,
} from './uno-paired-statistics';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';

const { values } = parseArgs({
  options: {
    calibration: { type: 'string' },
    campaign: { type: 'string' },
    plan: { type: 'string' },
    comparison: { type: 'string', multiple: true },
    looks: { type: 'string', default: '2' },
    'half-width': { type: 'string', default: '0.02' },
  },
});
if (!values.calibration || !values.campaign || !values.plan)
  throw new Error(
    'Pass the B report, completed C campaign and frozen development plan',
  );

function sha(bytes: string | Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}
function load(path: string) {
  const file = lstatSync(path);
  const limit = 4 * 1024 * 1024;
  if (!file.isFile() || file.isSymbolicLink() || file.size > limit)
    throw new Error('Expected a bounded local UNO study report');
  const bytes = readFileSync(path);
  if (bytes.length > limit)
    throw new Error('The UNO study report grew during read');
  return { content: JSON.parse(bytes.toString('utf8')), sha256: sha(bytes) };
}

const calibration = load(values.calibration);
const b = calibration.content;
if (
  b?.type !== 'uno-calibration-development' ||
  b.evaluation !== 'meets-measured-gates' ||
  !isCurrentUnoPilot(b.pilot) ||
  b.calibrationDigest !== sha(JSON.stringify(b.calibration))
)
  throw new Error('Selecting a C candidate requires qualified B calibration');

const campaign = load(values.campaign);
const entries = campaign.content?.completed as
  | {
      id: string;
      candidate: string;
      sha256: string;
      weight: number;
      cap: number;
    }[]
  | undefined;
if (
  campaign.content?.type !== 'uno-residual-campaign' ||
  campaign.content.calibrationReportSha256 !== calibration.sha256 ||
  !Array.isArray(entries) ||
  entries.length < 2 ||
  entries.some(
    (entry) =>
      typeof entry?.id !== 'string' || typeof entry.candidate !== 'string',
  ) ||
  new Set(entries.map(({ id }) => id)).size !== entries.length ||
  new Set(entries.map(({ sha256 }) => sha256)).size !== entries.length
)
  throw new Error('Use the complete independent C campaign for this B report');

const development = load(values.plan);
const plan = development.content as UnoComparisonPlan;
const developmentSeeds = validateUnoComparisonPlan(plan);
if (plan.looks !== 1)
  throw new Error(
    'Candidate selection uses a fixed, single-stage development comparison',
  );

const runs = entries.map((entry) => {
  const { content, sha256 } = load(entry.candidate);
  if (
    sha256 !== entry.sha256 ||
    !isCurrentUnoPilot(content?.pilot) ||
    !matchesUnoCorrectionCalibration(content, b, calibration.sha256) ||
    ![0, 0.25, 0.5, 0.75].includes(content.model?.weight) ||
    ![0.01, 0.02, 0.03].includes(content.model?.cap) ||
    content.model.weight !== entry.weight ||
    content.model.cap !== entry.cap
  )
    throw new Error(
      'A C candidate changed or no longer matches the frozen campaign',
    );
  return { ...entry, content, seeds: correctionSeeds(content) };
});
const ownSeeds: number[] = runs.flatMap(({ content }) => [
  ...content.trainSeeds,
  ...content.tuneSeeds,
]);
const orderedSeeds = [...ownSeeds].sort((a, b) => a - b);
const prior = calibrationSeeds(b);
if (
  new Set([...prior, ...ownSeeds, ...developmentSeeds]).size !==
    prior.length + ownSeeds.length + developmentSeeds.length ||
  runs.some(
    ({ seeds }) =>
      !isDeepStrictEqual(
        [...seeds].sort((a, b) => a - b),
        orderedSeeds,
      ),
  )
)
  throw new Error(
    'B, campaign runs and development comparison must use independent opening sets',
  );

const expected = runs.filter(({ weight }) => weight > 0);
const inputs = (values.comparison ?? []).map(load);
if (
  inputs.length !== expected.length ||
  new Set(inputs.map(({ content }) => content?.candidateReportSha256)).size !==
    inputs.length ||
  expected.some(
    ({ sha256 }) =>
      !inputs.some(({ content }) => content?.candidateReportSha256 === sha256),
  )
)
  throw new Error(
    'Provide one complete development comparison for every non-zero C candidate',
  );

function controls(blocks: readonly UnoPairedSeed[]) {
  return blocks.map(({ matches }) => matches.filter(({ arm }) => arm !== 'C'));
}
const comparisons = inputs.map(({ content, sha256 }) => {
  if (
    content?.type !== 'uno-abc-development' ||
    !isCurrentUnoPilot(content.pilot) ||
    !isDeepStrictEqual(content.plan, plan) ||
    content.calibrationReportSha256 !== calibration.sha256 ||
    typeof content.sourceSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(content.sourceSha256) ||
    typeof content.node !== 'string' ||
    content.planDigest !==
      unoComparisonDigest(
        plan,
        calibration.sha256,
        content.candidateReportSha256,
        content.sourceSha256,
        content.node,
      ) ||
    content.failures !== 0 ||
    !Array.isArray(content.undispatched) ||
    content.undispatched.length !== 0 ||
    !matchesUnoComparisonStage(plan, 1, content.blocks) ||
    !(content.blocks as UnoPairedSeed[]).every(
      (block) =>
        completeUnoBlock(block) &&
        block.matches.every(
          (match) =>
            Number.isSafeInteger(match.steps) &&
            match.steps! > 0 &&
            match.steps! <= plan.maxSteps &&
            typeof match.traceDigest === 'string' &&
            /^[a-f0-9]{64}$/.test(match.traceDigest),
        ),
    )
  )
    throw new Error(
      'A development comparison does not match the frozen plan or has incomplete games',
    );
  return { content, sha256, control: controls(content.blocks) };
});
const reference = comparisons[0];
if (
  reference &&
  comparisons.some(
    ({ content, control }) =>
      content.sourceSha256 !== reference.content.sourceSha256 ||
      content.node !== reference.content.node ||
      !isDeepStrictEqual(control, reference.control),
  )
)
  throw new Error(
    'Candidate development comparisons must share identical A/B controls',
  );

const reviewed = runs.map(({ id, sha256, weight, cap }) => {
  const comparison = comparisons.find(
    ({ content }) => content.candidateReportSha256 === sha256,
  );
  return {
    id,
    candidateSha256: sha256,
    weight,
    cap,
    compared: comparison !== undefined,
    comparisonSha256: comparison?.sha256 ?? null,
    result: comparison
      ? summarizeUnoComparison(
          comparison.content.blocks,
          'C',
          'B',
          plan.bootstrapSeed,
          1,
        )
      : null,
  };
});
const ranked = reviewed
  .filter(({ result }) => result !== null && result.difference !== null)
  .sort(
    (a, b) =>
      b.result!.difference! - a.result!.difference! ||
      a.weight - b.weight ||
      a.cap - b.cap ||
      a.id.localeCompare(b.id),
  );
const selected = ranked[0] ?? null;
const looks = Number(values.looks);
const halfWidth = Number(values['half-width']);
if (
  (looks !== 1 && looks !== 2) ||
  !Number.isFinite(halfWidth) ||
  halfWidth <= 0 ||
  halfWidth >= 1
)
  throw new Error('Invalid formal sample sizing options');
let sizing;
if (selected) {
  const match = comparisons.find(
    ({ sha256 }) => sha256 === selected.comparisonSha256,
  )!;
  try {
    sizing = sizeUnoComparison(match.content.blocks, looks, halfWidth);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes('no within-pool variation')
    )
      throw error;
    sizing = { status: 'needs-development-variation', halfWidth, looks };
  }
}
console.log(
  JSON.stringify(
    {
      type: 'uno-candidate-development-selection',
      diagnosticsOnly: true,
      pilot: unoPilotEvidence,
      calibrationReportSha256: calibration.sha256,
      campaignSha256: campaign.sha256,
      developmentPlanSha256: development.sha256,
      developmentSeeds,
      selectionRule:
        'largest observed development C minus B, then smaller weight and cap, then run ID',
      reviewed,
      selected,
      ...(sizing ? { sizing } : {}),
    },
    null,
    2,
  ),
);
