import { getCard } from '../../../games/uno/data/catalog';
import {
  unoCorrectedBest,
  unoSearchBest,
  type UnoCorrectionModel,
} from '../../../games/uno/bot/correction';
import { createUnoSearchStrategy } from '../../../games/uno/bot/search-strategy';
import type { UnoSearchResult } from '../../../games/uno/bot/search';
import type { UnoSearchSamples } from '../../../games/uno/bot/search-budget';
import type { BotStrategy } from '../../../packages/game-sdk/src/index';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { average, bootstrap } from './uno-calibration-seed';
import {
  collectUnoRoots,
  independentSeed,
  sampleUnoContinuations,
  pairedUnoDifferences,
  type UnoRoot,
  type UnoSampleOptions,
} from './uno-samples';
import type { UnoView } from '../../../games/uno/types';

type Capture = { search: UnoSearchResult; corrected: number };
export type AttributionRoot = Capture & {
  root: UnoRoot;
  baseline: number;
  challengers: number;
};
type Fit = {
  calibration: unknown;
  calibrationDigest: string;
  candidateDigest: string;
  model: UnoCorrectionModel;
};
export type Placebo = {
  roots: number;
  learnedChanges: number;
  simulatedShuffles: number;
  simulatedChanges: number;
  retention: number;
  expectedRate: number;
  learnedRate: number | null;
};
const shuffleTrials = 8;
const rateTolerance = 0.05;

export async function captureAttributionRoots(
  seed: number,
  options: UnoSampleOptions,
  fit: Fit,
) {
  // The actual C strategy emits the search it used, including draws from its saved RNG.
  // The collector keeps these traces inside one synthetic match and only returns sampled roots.
  const captures = new Map<string, Capture>();
  let latest: Capture | undefined;
  const policy = createUnoSearchStrategy(
    fit.calibration,
    fit.calibrationDigest,
    options.hypotheses,
    {
      model: fit.model,
      digest: fit.candidateDigest,
    },
    (search, _base, selected) => {
      const corrected = search.candidates.findIndex(
        ({ action }) => action === selected,
      );
      if (corrected >= 0) latest = { search, corrected };
    },
  );
  const observable: BotStrategy = {
    ...policy,
    async decide(input) {
      latest = undefined;
      const selected = await policy.decide(input);
      if (latest) captures.set(input.decision.id, latest);
      return selected;
    },
  };
  const roots = await collectUnoRoots(seed, options, observable);
  const captured = roots.flatMap((root): AttributionRoot[] => {
    const choices = captures.get(root.id);
    if (!choices) return [];
    const baseline = unoSearchBest(choices.search.candidates)!;
    const challengers =
      choices.search.samples < Math.max(8, 0.75 * options.hypotheses)
        ? 0
        : choices.search.candidates.filter(
            (choice) =>
              choice !== baseline &&
              baseline.winProbability - choice.winProbability <=
                0.03 + Number.EPSILON,
          ).length;
    return [
      {
        ...choices,
        root,
        baseline: choices.search.candidates.indexOf(baseline),
        challengers,
      },
    ];
  });
  return { roots: roots.length, captured };
}

export function shuffledResiduals(
  values: readonly number[],
  random: RandomSource,
) {
  const positions = values.map((_, index) => index);
  for (let index = positions.length - 1; index > 0; index--) {
    const other = Math.floor(random.next() * (index + 1));
    [positions[index], positions[other]] = [
      positions[other]!,
      positions[index]!,
    ];
  }
  if (
    positions.length > 1 &&
    positions.every((source, index) => source === index)
  )
    [positions[0], positions[1]] = [positions[1]!, positions[0]!];
  return positions.map((index) => values[index]!);
}

function placeboChoice(
  root: AttributionRoot,
  model: UnoCorrectionModel,
  samples: UnoSearchSamples,
  random: RandomSource,
) {
  const selected = unoCorrectedBest(
    root.search,
    root.root.view,
    root.root.memory,
    model,
    samples,
    (values) => shuffledResiduals(values, random),
  );
  return selected ? root.search.candidates.indexOf(selected) : root.baseline;
}

export function tunePlacebo(
  positions: readonly AttributionRoot[],
  model: UnoCorrectionModel,
  samples: UnoSearchSamples,
): Placebo {
  const viable = positions.filter(({ challengers }) => challengers >= 2);
  let learnedChanges = 0,
    simulatedChanges = 0;
  for (const [index, root] of viable.entries()) {
    if (root.corrected !== root.baseline) learnedChanges++;
    for (let trial = 0; trial < shuffleTrials; trial++) {
      const rng = new RandomSource(
        independentSeed(
          root.root.seed,
          0x310000 + index * shuffleTrials + trial,
        ),
      );
      if (placeboChoice(root, model, samples, rng) !== root.baseline)
        simulatedChanges++;
    }
  }
  return poolPlaceboTuning([
    {
      roots: viable.length,
      learnedChanges,
      simulatedShuffles: viable.length * shuffleTrials,
      simulatedChanges,
    },
  ]);
}

export function poolPlaceboTuning(
  parts: readonly Pick<
    Placebo,
    'roots' | 'learnedChanges' | 'simulatedShuffles' | 'simulatedChanges'
  >[],
): Placebo {
  if (
    parts.some(
      (part) =>
        !part ||
        ![
          part.roots,
          part.learnedChanges,
          part.simulatedShuffles,
          part.simulatedChanges,
        ].every((count) => Number.isSafeInteger(count) && count >= 0) ||
        part.learnedChanges > part.roots ||
        part.simulatedShuffles !== part.roots * shuffleTrials ||
        part.simulatedChanges > part.simulatedShuffles,
    )
  )
    throw new Error('Invalid placebo tuning counts');
  const total = (
    key: 'roots' | 'learnedChanges' | 'simulatedShuffles' | 'simulatedChanges',
  ) => parts.reduce((sum, part) => sum + part[key], 0);
  const roots = total('roots');
  const learnedChanges = total('learnedChanges');
  const simulatedShuffles = total('simulatedShuffles');
  const simulatedChanges = total('simulatedChanges');
  const learnedRate = roots ? learnedChanges / roots : null;
  const maximum = simulatedShuffles ? simulatedChanges / simulatedShuffles : 0;
  const retention = maximum ? Math.min(1, (learnedRate ?? 0) / maximum) : 0;
  return {
    roots,
    learnedChanges,
    simulatedShuffles,
    simulatedChanges,
    retention,
    expectedRate: maximum * retention,
    learnedRate,
  };
}

function actionClass(root: AttributionRoot) {
  for (const index of [root.baseline, root.corrected]) {
    const kind = getCard(root.search.candidates[index]!.action.cardId).kind;
    if (kind === 'wild' || kind === 'wild-draw-four') return 'wild-color';
  }
  return 'play';
}

export interface AttributionObservation {
  seed: number;
  node: 'wild-color' | 'play';
  eligible: number;
  changed: boolean;
  placeboChanged?: boolean;
  gain?: number;
  placeboGain?: number;
  learningMinusPlacebo?: number;
  worlds: number;
  unfinished: number;
}

export function measureAttribution(
  positions: readonly AttributionRoot[],
  model: UnoCorrectionModel,
  options: UnoSampleOptions,
  score: (view: UnoView) => number,
  retention: number,
): AttributionObservation[] {
  return positions.map((root, index) => {
    const changed = root.corrected !== root.baseline;
    const row: AttributionObservation = {
      seed: root.root.seed,
      node: actionClass(root),
      eligible: root.challengers,
      changed,
      worlds: 0,
      unfinished: 0,
    };
    const rng = new RandomSource(
      independentSeed(root.root.seed, 0x690000 + index),
    );
    const placebo =
      root.challengers >= 2 && rng.next() < retention
        ? placeboChoice(root, model, options.hypotheses, rng)
        : root.baseline;
    if (root.challengers >= 2) row.placeboChanged = placebo !== root.baseline;
    const tested = [...new Set([root.baseline, root.corrected, placebo])];
    if (tested.length === 1) {
      row.gain = 0;
      if (root.challengers >= 2) {
        row.placeboGain = 0;
        row.learningMinusPlacebo = 0;
      }
      return row;
    }
    const labelled = sampleUnoContinuations(
      root.root,
      {
        ...options,
        seed: independentSeed(root.root.seed, 0x900000 + index),
        onlyCandidates: tested,
      },
      score,
    );
    const actions = (search: UnoSearchResult) =>
      JSON.stringify(search.candidates.map(({ action }) => action));
    if (actions(labelled.short) !== actions(root.search))
      throw new Error(
        'Independent UNO attribution changed the observed candidate set',
      );
    row.unfinished = labelled.unfinished;
    // Use precisely the same completed worlds and continuations for all contrasts.
    const complete = labelled.outcomes.map((values) =>
      tested.every((candidate) => values[candidate] != null)
        ? values
        : values.map(() => null),
    );
    const differences = (left: number, right: number) =>
      pairedUnoDifferences(complete, options.continuations, left, right);
    const effects = differences(root.corrected, root.baseline);
    row.worlds = effects.length;
    if (row.worlds < Math.max(8, options.hypotheses * 0.75)) return row;
    const gain = average(effects);
    if (gain === null) return row;
    row.gain = gain;
    if (root.challengers >= 2) {
      row.placeboGain = average(differences(placebo, root.baseline))!;
      row.learningMinusPlacebo = average(differences(root.corrected, placebo))!;
    }
    return row;
  });
}

function groupedEstimate(
  rows: readonly AttributionObservation[],
  metric: 'gain' | 'placeboGain' | 'learningMinusPlacebo',
  seed: number,
) {
  const bySeed = new Map<number, number[]>();
  for (const row of rows) {
    const value = row[metric];
    if (value === undefined) continue;
    const group = bySeed.get(row.seed) ?? [];
    group.push(value);
    bySeed.set(row.seed, group);
  }
  const groups = [...bySeed.values()].map((group) => average(group)!);
  return {
    seeds: groups.length,
    effects: [...bySeed.values()].reduce((n, group) => n + group.length, 0),
    mean: average(groups),
    interval95: bootstrap(groups, seed),
  };
}

export function summarizeAttribution(
  rows: readonly AttributionObservation[],
  placebo: Placebo,
  seed: number,
) {
  const changed = rows.filter((row) => row.changed);
  const shuffleable = rows.filter(({ eligible }) => eligible >= 2);
  const changedGain = groupedEstimate(
    changed,
    'gain',
    independentSeed(seed, 1),
  );
  const cAgainstPlacebo = groupedEstimate(
    shuffleable,
    'learningMinusPlacebo',
    independentSeed(seed, 2),
  );
  const cAgainstB = groupedEstimate(
    shuffleable,
    'gain',
    independentSeed(seed, 3),
  );
  const placeboAgainstB = groupedEstimate(
    shuffleable,
    'placeboGain',
    independentSeed(seed, 4),
  );
  const rate = (flag: 'changed' | 'placeboChanged') =>
    shuffleable.length
      ? shuffleable.filter((row) => row[flag]).length / shuffleable.length
      : null;
  const learnedRate = rate('changed'),
    placeboRate = rate('placeboChanged');
  const complete =
    changedGain.effects === changed.length &&
    cAgainstPlacebo.effects === shuffleable.length;
  const tuningMatched =
    placebo.learnedRate !== null &&
    Math.abs(placebo.expectedRate - placebo.learnedRate) <= rateTolerance;
  const rateMatched =
    learnedRate !== null &&
    placeboRate !== null &&
    Math.abs(learnedRate - placeboRate) <= rateTolerance;
  const adequate =
    complete &&
    tuningMatched &&
    rateMatched &&
    changedGain.seeds >= 8 &&
    cAgainstPlacebo.seeds >= 8;
  return {
    sampled: rows.length,
    eligible: rows.filter(({ eligible }) => eligible > 0).length,
    changed: changed.length,
    shuffleable: shuffleable.length,
    oneAlternative: rows.filter(({ eligible }) => eligible === 1).length,
    learnedRate,
    placeboRate,
    complete,
    tuningMatched,
    rateMatched,
    changedGain,
    cAgainstB,
    placeboAgainstB,
    cAgainstPlacebo,
    better: changed.filter(({ gain }) => gain !== undefined && gain > 0).length,
    worse: changed.filter(({ gain }) => gain !== undefined && gain < 0).length,
    byNode: Object.fromEntries(
      (['play', 'wild-color'] as const).map((node, index) => {
        const group = rows.filter((row) => row.node === node);
        const changed = group.filter((row) => row.changed);
        return [
          node,
          {
            sampled: group.length,
            eligible: group.filter(({ eligible }) => eligible > 0).length,
            changed: changed.length,
            oneAlternative: group.filter(({ eligible }) => eligible === 1)
              .length,
            gain: groupedEstimate(
              changed,
              'gain',
              independentSeed(seed, 0x101 + index),
            ),
          },
        ];
      }),
    ),
    result:
      adequate &&
      (changedGain.interval95?.lower ?? -1) > 0 &&
      (cAgainstPlacebo.interval95?.lower ?? -1) > 0
        ? 'supports-learned-correction'
        : adequate
          ? 'inconclusive-effects'
          : 'insufficient-diagnostic-evidence',
  };
}
