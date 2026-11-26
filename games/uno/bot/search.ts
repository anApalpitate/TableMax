import type { RuleContext } from '@tablemax/game-sdk';
import { CARD_IDS, getCard } from '../data/catalog';
import { rules, legalActions } from '../rules';
import { shuffle } from '../rules/engine';
import {
  project,
  projectUnoMemoryObservation,
  projectUnoRolloutDecision,
} from '../rules/project';
import { validateState, type State } from '../rules/state';
import type { Action, UnoView } from '../types';
import {
  chooseAction,
  observe,
  observeOwnedRolloutMemory,
  type Memory,
} from './index';
import {
  isUnoSearchSamples,
  unoSearchRuleStepLimit,
  type UnoSearchSamples,
} from './search-budget';

type Play = Extract<Action, { type: 'play' }>;

interface SearchOptions {
  samples: UnoSearchSamples;
  maxRuleSteps: number;
  onHypothesis?: (leaves: readonly UnoHypothesisLeaf[]) => void;
}

/** Synthetic continuation visible only to the offline analysis caller. */
export interface UnoHypothesisLeaf {
  action: Play;
  state: State;
  memories: Readonly<Record<string, Memory | null>>;
  seat: string;
}

interface SearchCandidate {
  action: Play;
  winProbability: number;
}

export interface UnoSearchResult {
  candidates: SearchCandidate[];
  samples: number;
  ruleSteps: number;
}

function rolloutRandom(seed: number): RuleContext['random'] {
  return {
    next() {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 0x100000000;
    },
  };
}

function playCandidates(
  view: UnoView,
  actions: readonly Action[],
  memory: Memory,
  signal: AbortSignal,
): Play[] {
  const hand = view.self!.hand;
  const hasActiveColor = hand.some((card) => card.color === view.activeColor);
  const distinct = new Map<string, Play>();
  for (const action of actions) {
    if (action.type !== 'play') continue;
    const card = getCard(action.cardId);
    if (card.kind === 'wild-draw-four' && hasActiveColor) continue;
    const key = JSON.stringify([
      card.kind,
      card.color,
      card.value,
      action.color,
      action.uno,
    ]);
    if (!distinct.has(key)) distinct.set(key, action);
  }
  const remaining = [...distinct.values()];
  const ordered: Play[] = [];
  const represented = new Set<string>();
  // Reserve one candidate per relevant card kind before filling the remaining slots.
  while (remaining.length && ordered.length < 8) {
    const newKinds = remaining.filter(
      (action) => !represented.has(getCard(action.cardId).kind),
    );
    const choice = chooseAction(
      view,
      newKinds.length ? newKinds : remaining,
      memory,
      'juewu',
      signal,
    ) as Play;
    ordered.push(choice);
    represented.add(getCard(choice.cardId).kind);
    remaining.splice(remaining.indexOf(choice), 1);
  }
  return ordered;
}

/** Build an isolated hypothesis solely from the active seat's authorized decision input. */
function samplePosition(
  view: UnoView,
  memory: Memory,
  random: RuleContext['random'],
): State | null {
  const self = view.self!;
  const hands = Object.fromEntries(
    view.seatOrder.map((seat) => [
      seat,
      seat === self.seatId
        ? self.hand.map((card) => card.id)
        : [...(memory.knownCards[seat] ?? [])],
    ]),
  );
  if (
    view.discardCount < 1 ||
    view.seatOrder.some(
      (seat) => hands[seat]!.length > view.players[seat]!.handCount,
    )
  )
    return null;
  const retainedCards = [view.topCard.id, ...Object.values(hands).flat()];
  const fixed = new Set(retainedCards);
  if (fixed.size !== retainedCards.length) return null;
  const rest = shuffle(
    CARD_IDS.filter((id) => !fixed.has(id)),
    {
      seats: view.seatOrder,
      random,
    },
  );
  let offset = 0;
  for (const seat of view.seatOrder) {
    const hand = hands[seat]!;
    const missing = view.players[seat]!.handCount - hand.length;
    hand.push(...rest.slice(offset, offset + missing));
    offset += missing;
  }
  if (offset + view.drawCount + view.discardCount - 1 !== rest.length)
    return null;
  const deck = rest.slice(offset, offset + view.drawCount);
  const discard = [...rest.slice(offset + view.drawCount), view.topCard.id];
  const privateEvidence = self.challengeEvidence;
  return validateState(
    {
      ...(view.setup === undefined ? {} : { setup: view.setup }),
      ...(view.setup?.drawPenaltyStacking ? { drawPenalty: null } : {}),
      rulesVersion: view.rulesVersion,
      stateVersion: 1,
      seats: view.seatOrder,
      phase: view.phase,
      stage: view.stage,
      roundNumber: view.roundNumber,
      turnNumber: view.turnNumber,
      actionSerial: view.latest?.serial ?? 0,
      dealer: view.dealer,
      turnSeat: self.seatId,
      direction: view.direction,
      activeColor: view.activeColor,
      deck,
      discard,
      hands,
      scores: Object.fromEntries(
        view.seatOrder.map((seat) => [seat, view.players[seat]!.score]),
      ),
      wins: Object.fromEntries(
        view.seatOrder.map((seat) => [seat, view.players[seat]!.wins]),
      ),
      unoDeclared: Object.fromEntries(
        view.seatOrder.map((seat) => [seat, view.players[seat]!.uno]),
      ),
      drawnCardId: null,
      drawFour: null,
      unoWindow: null,
      evidence: privateEvidence
        ? {
            challenger: self.seatId,
            offender: privateEvidence.offender,
            previousColor: privateEvidence.previousColor,
            guilty: privateEvidence.guilty,
            cardIds: privateEvidence.cards.map((card) => card.id),
          }
        : null,
      results: view.results,
      winners: view.winners,
      latest: view.latest,
    },
    view.seatOrder,
  );
}

function playStep(
  state: State,
  memories: Record<string, Memory | null>,
  seat: string,
  context: RuleContext,
  signal: AbortSignal,
  ownsMemory: boolean,
) {
  const acting = state.unoWindow?.seatId ?? state.turnSeat;
  if (!acting) throw new Error('UNO search reached an unresolved rule phase');
  const view = projectUnoRolloutDecision(state, acting);
  for (const id of state.seats) {
    memories[id] = (ownsMemory ? observeOwnedRolloutMemory : observe)(
      id === acting ? view : projectUnoMemoryObservation(state, id),
      memories[id] ?? null,
      id === seat ? 'juewu' : 'doubao',
    );
  }
  const next = chooseAction(
    view,
    legalActions(state, acting),
    memories[acting]!,
    acting === seat ? 'juewu' : 'doubao',
    signal,
    context.random,
  );
  return {
    acting,
    state: rules.apply(state, next, acting, context).state as State,
  };
}

function assertContinuationBudget(seed: number, maxSteps: number) {
  if (
    !Number.isSafeInteger(maxSteps) ||
    maxSteps < 1 ||
    !Number.isInteger(seed) ||
    seed < 1 ||
    seed > 0xffffffff
  )
    throw new Error('Invalid UNO continuation budget or seed');
}

/** Finish a synthetic branch using the same fixed policies as the short search. */
export function continueUnoHypothesis(
  leaf: Pick<UnoHypothesisLeaf, 'state' | 'memories' | 'seat'>,
  seed: number,
  maxSteps: number,
  signal: AbortSignal,
  checkpoint?: () => void,
): 0 | 1 | null {
  assertContinuationBudget(seed, maxSteps);
  const context = { seats: leaf.state.seats, random: rolloutRandom(seed) };
  const memories = { ...leaf.memories };
  let state = leaf.state;
  // The first observation copies memory shared with the input leaf.
  let ownsMemory = false;
  for (let steps = 0; state.phase !== 'ended' && steps < maxSteps; steps++) {
    signal.throwIfAborted();
    if (steps % 16 === 0) checkpoint?.();
    if (state.phase === 'round-result') {
      state = rules.applyLifecycle(state, { type: 'next-round' }, context)
        .state as State;
    } else {
      state = playStep(
        state,
        memories,
        leaf.seat,
        context,
        signal,
        ownsMemory,
      ).state;
      ownsMemory = true;
    }
  }
  return state.phase === 'ended'
    ? state.winners.includes(leaf.seat)
      ? 1
      : 0
    : null;
}

/** Simulate just one round with the same fixed rollout policies. */
export function continueUnoHypothesisRound(
  leaf: Pick<UnoHypothesisLeaf, 'state' | 'memories' | 'seat'>,
  seed: number,
  maxSteps: number,
  signal: AbortSignal,
) {
  assertContinuationBudget(seed, maxSteps);
  signal.throwIfAborted();
  const context = { seats: leaf.state.seats, random: rolloutRandom(seed) };
  const memories = { ...leaf.memories };
  let state = leaf.state;
  let steps = 0;
  if (state.phase === 'round-result') {
    state = rules.applyLifecycle(state, { type: 'next-round' }, context)
      .state as State;
    steps++;
  }
  let ownsMemory = false;
  while (state.phase === 'playing' && steps < maxSteps) {
    signal.throwIfAborted();
    state = playStep(
      state,
      memories,
      leaf.seat,
      context,
      signal,
      ownsMemory,
    ).state;
    ownsMemory = true;
    steps++;
  }
  return { state, steps };
}

function evaluateBranch(
  root: State,
  action: Play,
  memory: Memory,
  seed: number,
  scoreUnfinished: (view: UnoView) => number,
  signal: AbortSignal,
) {
  const seat = root.turnSeat!;
  const random = rolloutRandom(seed);
  const context = { seats: root.seats, random };
  const memories: Record<string, Memory | null> = Object.fromEntries(
    root.seats.map((id) => [id, id === seat ? memory : null]),
  );
  let state = rules.apply(root, action, seat, context).state as State;
  let steps = 1;
  let turns = 0;
  let ownTurns = 0;
  while (state.phase === 'playing' && steps < 16) {
    signal.throwIfAborted();
    const before = state;
    const isNormal = state.stage === 'turn' || state.stage === 'drawn';
    // Each branch copies the root memory before the first simulated observation.
    const next = playStep(state, memories, seat, context, signal, steps > 1);
    const acting = next.acting;
    state = next.state;
    steps++;
    if (
      isNormal &&
      (state.turnNumber !== before.turnNumber || state.phase !== 'playing')
    ) {
      turns++;
      if (acting === seat) ownTurns++;
    }
    if (
      (turns >= 8 || ownTurns >= 2) &&
      state.drawFour === null &&
      !state.drawPenalty
    )
      break;
  }
  const score =
    state.phase === 'ended'
      ? Number(state.winners.includes(seat))
      : scoreUnfinished(project(state, { role: 'player', seatId: seat }));
  if (!Number.isFinite(score) || score < 0 || score > 1)
    throw new Error('UNO leaf evaluation must be a probability');
  return { score, steps, state, memories, seat };
}

/** Short shared-hypothesis search. Unfinished leaves require the caller's frozen evaluator. */
export function searchUnoPlays(
  view: UnoView,
  actions: readonly Action[],
  memory: Memory,
  random: RuleContext['random'],
  signal: AbortSignal,
  scoreUnfinished: (view: UnoView) => number,
  { samples, maxRuleSteps, onHypothesis }: SearchOptions = {
    samples: 16,
    maxRuleSteps: unoSearchRuleStepLimit,
  },
): UnoSearchResult {
  if (
    !isUnoSearchSamples(samples) ||
    !Number.isSafeInteger(maxRuleSteps) ||
    maxRuleSteps < 1 ||
    maxRuleSteps > unoSearchRuleStepLimit
  )
    throw new Error('Invalid UNO search budget');
  if (
    view.phase !== 'playing' ||
    view.stage !== 'turn' ||
    memory.roundNumber !== view.roundNumber ||
    !view.self ||
    view.turnSeat !== view.self.seatId ||
    view.unoWindow ||
    view.drawFour ||
    view.drawPenalty ||
    view.self.hand.length < 2
  )
    return { candidates: [], samples: 0, ruleSteps: 0 };
  signal.throwIfAborted();
  const roots = playCandidates(view, actions, memory, signal);
  if (roots.length < 2) return { candidates: [], samples: 0, ruleSteps: 0 };
  const totals = roots.map(() => 0);
  let completed = 0;
  let ruleSteps = 0;
  for (let sample = 0; sample < samples; sample++) {
    if (ruleSteps + roots.length * 16 > maxRuleSteps) break;
    signal.throwIfAborted();
    const hypothesis = samplePosition(view, memory, random);
    if (!hypothesis) break;
    const seed = Math.floor(random.next() * 0x100000000) || 1;
    const leaves: UnoHypothesisLeaf[] | undefined = onHypothesis
      ? []
      : undefined;
    for (const [index, action] of roots.entries()) {
      const branch = evaluateBranch(
        hypothesis,
        action,
        memory,
        seed,
        scoreUnfinished,
        signal,
      );
      totals[index]! += branch.score;
      ruleSteps += branch.steps;
      leaves?.push({
        action,
        state: branch.state,
        memories: branch.memories,
        seat: branch.seat,
      });
    }
    if (leaves) onHypothesis?.(leaves);
    completed++;
  }
  return {
    candidates: completed
      ? roots.map((action, index) => ({
          action,
          winProbability: totals[index]! / completed,
        }))
      : [],
    samples: completed,
    ruleSteps,
  };
}
