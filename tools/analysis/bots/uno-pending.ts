import { getCard } from '../../../games/uno/data/catalog';
import { bot, type Memory } from '../../../games/uno/bot/index';
import {
  unoLeafFeatures,
  unoLeafFeatureNames,
} from '../../../games/uno/bot/calibration';
import {
  continueUnoHypothesis,
  type UnoHypothesisLeaf,
} from '../../../games/uno/bot/search';
import { rules, project, type State } from '../../../games/uno/rules';
import type { Action } from '../../../games/uno/types';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { evaluateBotMatch } from './evaluate';
import { independentSeed, type UnoLeafLabel } from './uno-samples';
import { isCurrentUnoPilot, unoPilotEvidence } from './uno-pilot';

export const penaltyKinds = [
  'draw-two',
  'draw-four',
  'last-draw-four',
] as const;
type PenaltyKind = (typeof penaltyKinds)[number];

export interface PendingSeedEvidence {
  seed: number;
  rows: (UnoLeafLabel & { kind: PenaltyKind; leadingScore: number })[];
  found: Record<PenaltyKind, number>;
  unfinished: number;
}
type LabelBudget = { continuations: number; maxSteps: number };

export interface PendingCalibration {
  type: 'uno-pending-calibration';
  version: 1;
  pilot: typeof unoPilotEvidence;
  options: LabelBudget;
  fit: PendingSeedEvidence[];
  review: PendingSeedEvidence[];
}

const seedValid = (seed: number) =>
  Number.isInteger(seed) && seed >= 1 && seed <= 0xffffffff;

export function pendingCalibration(value: unknown): PendingCalibration {
  const x = value as PendingCalibration;
  if (
    x?.type !== 'uno-pending-calibration' ||
    x.version !== 1 ||
    !isCurrentUnoPilot(x.pilot) ||
    !Number.isSafeInteger(x.options?.continuations) ||
    x.options.continuations < 16 ||
    !Number.isSafeInteger(x.options.maxSteps) ||
    x.options.maxSteps < 1 ||
    !Array.isArray(x.fit) ||
    !x.fit.length ||
    !Array.isArray(x.review) ||
    !x.review.length
  )
    throw new Error('Invalid independent UNO pending calibration');
  const seeds = new Set<number>();
  for (const group of [...x.fit, ...x.review]) {
    if (
      !seedValid(group?.seed) ||
      seeds.has(group.seed) ||
      !Array.isArray(group.rows) ||
      group.rows.length > penaltyKinds.length ||
      new Set(group.rows.map((row) => row.kind)).size !== group.rows.length ||
      group.rows.some(
        (row) =>
          !penaltyKinds.includes(row.kind) ||
          row.stage !==
            (row.kind === 'draw-two' ? 'draw-penalty' : 'draw-four') ||
          !Number.isInteger(group.found?.[row.kind]) ||
          group.found[row.kind] < 1 ||
          !Number.isInteger(row.leadingScore) ||
          row.leadingScore < 0 ||
          row.leadingScore >= 500 ||
          !Array.isArray(row.features) ||
          row.features.length !== unoLeafFeatureNames.length ||
          !row.features.every(Number.isFinite) ||
          !Number.isInteger(row.completed) ||
          row.completed < 1 ||
          row.completed > x.options.continuations ||
          !Number.isInteger(row.wins) ||
          row.wins < 0 ||
          row.wins > row.completed,
      )
    )
      throw new Error('Invalid or overlapping UNO pending calibration seed');
    seeds.add(group.seed);
  }
  return x;
}

function penaltyKind(state: State): PenaltyKind | undefined {
  if (state.stage === 'draw-penalty') return 'draw-two';
  if (state.stage === 'draw-four' && state.drawFour)
    return state.hands[state.drawFour.offender]!.length
      ? 'draw-four'
      : 'last-draw-four';
  return undefined;
}

/** Reservoir-sample actual pending responses in a wholly synthetic match. */
export async function collectPendingSeed(
  seed: number,
  options: LabelBudget,
): Promise<PendingSeedEvidence> {
  if (!seedValid(seed)) throw new Error('Invalid UNO pending collection seed');
  const seats = Array.from(
    { length: unoPilotEvidence.seatCount },
    (_, index) => ({
      id: 'seat-' + (index + 1),
      strategy: bot,
      difficulty: ((index + seed) % unoPilotEvidence.seatCount === 0
        ? 'juewu'
        : 'doubao') as 'juewu' | 'doubao',
    }),
  );
  const focus = seats.find(({ difficulty }) => difficulty === 'juewu')!.id;
  const selector = new RandomSource(independentSeed(seed, 0x512c3));
  type Position = Pick<UnoHypothesisLeaf, 'state' | 'memories' | 'seat'>;
  const positions = new Map<PenaltyKind, Position>();
  const found = { 'draw-two': 0, 'draw-four': 0, 'last-draw-four': 0 };
  const match = await evaluateBotMatch(
    { rules, seats, seed, setup: unoPilotEvidence.setup },
    {
      maxSteps: options.maxSteps,
      onStep(step, snapshot) {
        const action = step.action as Action;
        if (action.type !== 'play') return;
        const cardKind = getCard(action.cardId).kind;
        if (cardKind !== 'draw-two' && cardKind !== 'wild-draw-four') return;
        const saved = snapshot();
        const state = saved.state as State;
        const kind = penaltyKind(state);
        if (!kind || Math.floor(selector.next() * ++found[kind]) !== 0) return;
        positions.set(kind, {
          state,
          memories: Object.fromEntries(
            Object.entries(saved.bots).map(([seat, data]) => [
              seat,
              data.memory as Memory | null,
            ]),
          ),
          seat: focus,
        });
      },
    },
  );
  if (match.outcome !== 'ended')
    throw new Error('Pending sampling match did not finish: ' + seed);
  let unfinished = 0;
  const rows: PendingSeedEvidence['rows'] = [];
  const signal = new AbortController().signal;
  for (const [index, kind] of penaltyKinds.entries()) {
    const position = positions.get(kind);
    if (!position) continue;
    const view = project(position.state, { role: 'player', seatId: focus });
    let wins = 0,
      completed = 0;
    for (let i = 0; i < options.continuations; i++) {
      const result = continueUnoHypothesis(
        position,
        independentSeed(seed, 0x80000 + index * options.continuations + i),
        options.maxSteps,
        signal,
      );
      if (result === null) unfinished++;
      else {
        completed++;
        wins += result;
      }
    }
    if (completed)
      rows.push({
        kind,
        stage: view.stage,
        leadingScore: Math.max(
          ...Object.values(view.players).map(({ score }) => score),
        ),
        features: unoLeafFeatures(view),
        wins,
        completed,
      });
  }
  return { seed, rows, found, unfinished };
}
