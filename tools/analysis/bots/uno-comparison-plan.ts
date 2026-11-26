import { createHash } from 'node:crypto';
import {
  completeUnoBlock,
  summarizeUnoComparison,
  unoComparisonDecision,
  unoOpponentPools,
  type UnoPairedSeed,
  type UnoPool,
} from './uno-paired-statistics';
import { unoPilotEvidence } from './uno-pilot';

export function unoComparisonDigest(
  plan: UnoComparisonPlan,
  calibrationReportSha256: string,
  candidateReportSha256: string,
  sourceSha256: string,
  node: string,
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        plan,
        calibrationReportSha256,
        candidateReportSha256,
        sourceSha256,
        node,
        pilot: unoPilotEvidence,
      }),
    )
    .digest('hex');
}

export const unoPools = Object.keys(unoOpponentPools) as UnoPool[];

export interface UnoComparisonPlan {
  version: 1;
  looks: 1 | 2;
  bootstrapSeed: number;
  maxSteps: number;
  developmentSeeds?: number[];
  selection?: {
    reportSha256: string;
    calibrationReportSha256: string;
    candidateReportSha256: string;
  };
  seeds: Record<UnoPool, { first: number[]; extra: number[] }>;
}

const sha256 = /^[a-f0-9]{64}$/;

export function matchesUnoPlanSelection(
  plan: UnoComparisonPlan,
  calibrationReportSha256: string,
  candidateReportSha256: string,
) {
  return (
    plan.selection === undefined ||
    (plan.selection.calibrationReportSha256 === calibrationReportSha256 &&
      plan.selection.candidateReportSha256 === candidateReportSha256)
  );
}

export function validateUnoComparisonPlan(plan: UnoComparisonPlan) {
  if (
    plan?.version !== 1 ||
    ![1, 2].includes(plan.looks) ||
    !Number.isSafeInteger(plan.maxSteps) ||
    plan.maxSteps < 1 ||
    !Number.isInteger(plan.bootstrapSeed) ||
    plan.bootstrapSeed < 1 ||
    plan.bootstrapSeed > 0xffffffff ||
    (plan.developmentSeeds !== undefined &&
      !Array.isArray(plan.developmentSeeds)) ||
    (plan.selection !== undefined &&
      [
        plan.selection?.reportSha256,
        plan.selection?.calibrationReportSha256,
        plan.selection?.candidateReportSha256,
      ].some((digest) => typeof digest !== 'string' || !sha256.test(digest))) ||
    !plan.seeds ||
    Object.keys(plan.seeds).length !== unoPools.length ||
    unoPools.some(
      (pool) =>
        !Array.isArray(plan.seeds[pool]?.first) ||
        plan.seeds[pool].first.length < 2 ||
        !Array.isArray(plan.seeds[pool].extra) ||
        (plan.looks === 1 && plan.seeds[pool].extra.length > 0) ||
        (plan.looks === 2 && plan.seeds[pool].extra.length < 1),
    )
  )
    throw new Error('Invalid frozen paired plan');
  const seeds = unoPools.flatMap((pool) => [
    ...plan.seeds[pool].first,
    ...plan.seeds[pool].extra,
  ]);
  const separate = [...seeds, ...(plan.developmentSeeds ?? [])];
  if (
    separate.some(
      (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
    ) ||
    new Set(separate).size !== separate.length
  )
    throw new Error(
      'Each original seed can occur only once across development, pools and stages',
    );
  return separate;
}

export function selectUnoComparisonSeeds(
  plan: UnoComparisonPlan,
  stage: 1 | 2,
) {
  return unoPools.flatMap((pool) => {
    const { first, extra } = plan.seeds[pool];
    const seeds = stage === 1 ? first : extra;
    return seeds.map((seed, index) => ({
      pool,
      seed,
      ordinal: index + (stage === 1 ? 0 : first.length),
    }));
  });
}

export function followsUnoComparisonSeeds(
  blocks: readonly UnoPairedSeed[],
  seeds: readonly Pick<UnoPairedSeed, 'pool' | 'seed'>[],
  allowPrefix = false,
) {
  return (
    Array.isArray(blocks) &&
    blocks.length <= seeds.length &&
    (allowPrefix || blocks.length === seeds.length) &&
    blocks.every(
      (block, index) =>
        block?.pool === seeds[index]?.pool &&
        block.seed === seeds[index]?.seed &&
        Array.isArray(block.matches),
    )
  );
}

export function matchesUnoComparisonStage(
  plan: UnoComparisonPlan,
  stage: unknown,
  blocks: readonly UnoPairedSeed[],
) {
  try {
    validateUnoComparisonPlan(plan);
  } catch {
    return false;
  }
  const first = selectUnoComparisonSeeds(plan, 1);
  if (stage === 1) return followsUnoComparisonSeeds(blocks, first);
  return (
    stage === 2 &&
    plan.looks === 2 &&
    followsUnoComparisonSeeds(blocks, [
      ...first,
      ...selectUnoComparisonSeeds(plan, 2),
    ])
  );
}

interface UnoComparisonReport {
  type: string;
  decision: string;
  failures: number;
  undispatched: unknown[];
  plan: UnoComparisonPlan;
  stage: number;
  blocks: UnoPairedSeed[];
  sourceSha256: string;
  node: string;
  planDigest: string;
}

export function unoComparisonPasses(
  report: UnoComparisonReport,
  calibrationReportSha256: string,
  candidateReportSha256: string,
) {
  if (
    report?.type !== 'uno-abc-acceptance' ||
    report.decision !== 'meets-win-rate-gate' ||
    report.failures !== 0 ||
    !Array.isArray(report.undispatched) ||
    report.undispatched.length !== 0 ||
    typeof report.node !== 'string' ||
    !/^v\d+\.\d+\.\d+$/.test(report.node) ||
    typeof report.sourceSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(report.sourceSha256) ||
    !matchesUnoComparisonStage(report.plan, report.stage, report.blocks) ||
    !matchesUnoPlanSelection(
      report.plan,
      calibrationReportSha256,
      candidateReportSha256,
    ) ||
    !report.blocks.every(completeUnoBlock) ||
    report.planDigest !==
      unoComparisonDigest(
        report.plan,
        calibrationReportSha256,
        candidateReportSha256,
        report.sourceSha256,
        report.node,
      )
  )
    return false;

  const { plan, blocks } = report;
  const decide = (selected: UnoPairedSeed[], canExpand: boolean) =>
    unoComparisonDecision(
      summarizeUnoComparison(
        selected,
        'C',
        'B',
        plan.bootstrapSeed,
        plan.looks,
      ),
      selected,
      canExpand,
    );
  if (report.stage === 2) {
    const first = blocks.slice(0, selectUnoComparisonSeeds(plan, 1).length);
    if (decide(first, true) !== 'expand') return false;
  }
  return decide(blocks, false) === 'meets-win-rate-gate';
}
