import { rules, type Action } from '../../../games/pokemon-encounters/rules';
import {
  validateState,
  type State,
} from '../../../games/pokemon-encounters/rules/state';
import type { JsonValue } from '../../../packages/game-sdk/src';
import type {
  PokemonFixedState,
  PokemonPreparedState,
} from './prepare-pokemon-fixed';

export type PokemonOriginalScene =
  | 'initial'
  | 'waiting'
  | 'draw'
  | 'place'
  | 'discard-place'
  | 'snorlax'
  | 'charizard'
  | 'peek'
  | 'mew-other'
  | 'mew-self'
  | 'rocket'
  | 'zapdos-self'
  | 'zapdos-receive'
  | 'round-result'
  | 'match-result';

export type PokemonOriginalFixtureState = { state: State; self: string };

const allSeatIds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

export function applyPokemonOriginalState(
  state: State,
  action: Action,
  seat = state.turnSeat,
) {
  const seatIds = state.seatOrder;
  const context = { seats: seatIds, random: { next: () => 0.4 } };
  const next = rules.apply(state, action, seat, context).state as State;
  return validateState(next, seatIds);
}

/** Verification-only complete deck permutation; every later transition uses production rules. */
export function makePokemonOriginalState(
  scene: PokemonOriginalScene,
  count = 6,
  options: {
    nextDraw?: string;
    drawCategory?: string;
    visibleTarget?: string;
  } = {},
): PokemonOriginalFixtureState {
  const seatIds = allSeatIds.slice(0, count);
  const context = { seats: seatIds, random: { next: () => 0.4 } };
  let state = rules.initialize({
    ...context,
    random: { next: () => 0 },
  }) as State;
  const defaultCategory =
    scene === 'snorlax'
      ? 'special-snorlax'
      : scene === 'charizard' || scene === 'peek'
        ? 'special-charizard'
        : scene.startsWith('mew')
          ? 'special-mew'
          : scene === 'rocket'
            ? 'special-team-rocket'
            : scene.startsWith('zapdos')
              ? 'special-zapdos'
              : 'ordinary-6';
  const category = options.drawCategory ?? defaultCategory;
  const wanted = `${category}#01`;
  const top = state.deck.length - 1;
  const displaced = state.deck[top]!;
  const deckIndex = state.deck.indexOf(wanted);
  if (deckIndex >= 0) state.deck[deckIndex] = displaced;
  else {
    const slot = Object.values(state.boards)
      .flat()
      .find((entry) => entry.instanceId === wanted);
    if (!slot) throw new Error(`Missing fixture card ${wanted}`);
    slot.instanceId = displaced;
  }
  state.deck[top] = wanted;
  if (options.visibleTarget) {
    const target = state.boards[seatIds[0]!]![0]!;
    const replacement = target.instanceId;
    const index = state.deck.indexOf(options.visibleTarget);
    if (index >= 0) state.deck[index] = replacement;
    else {
      const other = Object.values(state.boards)
        .flat()
        .find((slot) => slot.instanceId === options.visibleTarget);
      if (!other)
        throw new Error(`Missing visible target ${options.visibleTarget}`);
      other.instanceId = replacement;
    }
    target.instanceId = options.visibleTarget;
  }
  if (options.nextDraw) {
    const nextTop = top - 1;
    const replacement = state.deck[nextTop]!;
    const index = state.deck.indexOf(options.nextDraw);
    if (index >= 0) state.deck[index] = replacement;
    else {
      const slot = Object.values(state.boards)
        .flat()
        .find((entry) => entry.instanceId === options.nextDraw);
      if (!slot)
        throw new Error(`Missing next fixture card ${options.nextDraw}`);
      slot.instanceId = replacement;
    }
    state.deck[nextTop] = options.nextDraw;
  }
  validateState(state, seatIds);
  if (scene === 'initial') return { state, self: 'S1' };
  for (const seat of seatIds) {
    state = applyPokemonOriginalState(
      state,
      { type: 'initial-flip', slot: 0 },
      seat,
    );
    if (scene === 'waiting') return { state, self: 'S1' };
  }
  if (scene === 'draw') return { state, self: 'S1' };
  if (scene === 'round-result' || scene === 'match-result') {
    if (scene === 'match-result')
      state.winsBySeat = Object.fromEntries(seatIds.map((seat) => [seat, 2]));
    for (let step = 0; step < 1000 && !state.roundResult; step++) {
      const actor =
        state.phase === 'zapdos-receive'
          ? state.recipientQueue[state.recipientIndex]!
          : state.turnSeat;
      const choices = rules.legalActions(state, actor) as Action[];
      const reveal = choices.find(
        (action) =>
          action.type === 'replace' &&
          !state.boards[actor]![action.slot]!.faceUp,
      );
      state = applyPokemonOriginalState(state, reveal ?? choices[0]!, actor);
    }
    if (!state.roundResult) throw new Error('Result fixture did not finish');
    return { state, self: 'S1' };
  }
  state = applyPokemonOriginalState(state, { type: 'draw', source: 'deck' });
  if (scene === 'discard-place') {
    state = applyPokemonOriginalState(state, { type: 'discard-held' });
    state = applyPokemonOriginalState(state, {
      type: 'draw',
      source: 'discard',
    });
    return { state, self: 'S2' };
  }
  if (['snorlax', 'charizard', 'peek', 'zapdos-receive'].includes(scene))
    state = applyPokemonOriginalState(state, { type: 'replace', slot: 1 });
  if (scene === 'peek')
    state = applyPokemonOriginalState(state, { type: 'peek', slot: 2 });
  if (scene === 'mew-self')
    state = applyPokemonOriginalState(state, {
      type: 'mew-target',
      seat: 'S2',
      slot: 1,
    });
  return { state, self: scene === 'zapdos-receive' ? 'S2' : 'S1' };
}

export function preparePokemonOriginalFixedState(
  scene: PokemonFixedState,
  count: number,
): PokemonPreparedState {
  const source: Partial<Record<PokemonFixedState, PokemonOriginalScene>> = {
    draw: 'draw',
    dense: 'draw',
    held: 'place',
    'placement-selected': 'place',
    'replace-committed': 'place',
    'ability-choice': 'charizard',
    'ability-resolved': 'peek',
    'private-peek': 'peek',
    'mew-target-selected': 'mew-other',
    'swap-selected': 'snorlax',
    'swap-committed': 'snorlax',
    'saved-sequence': 'charizard',
    'guidance-settings': 'place',
    'guidance-last-dark': 'place',
  };
  const originalScene = source[scene];
  if (!originalScene)
    throw new Error(`Unsupported original fixed state: ${scene}`);
  const prepared = makePokemonOriginalState(
    originalScene,
    count,
    scene === 'saved-sequence'
      ? { nextDraw: 'special-mew#01' }
      : scene.startsWith('guidance-')
        ? {
            drawCategory: 'special-charizard',
            visibleTarget: 'special-snorlax#01',
          }
        : {},
  );
  let state = prepared.state;
  if (scene === 'guidance-last-dark') {
    // A complete validated initialized-state boundary, not a claimed naturally
    // played sequence. No event/feedback is manufactured for these flags.
    state.boards[prepared.self]!.forEach((slot, index) => {
      slot.faceUp = index !== 1;
    });
  }
  if (scene === 'replace-committed') {
    const held = state.held;
    if (!held || state.phase !== 'place')
      throw new Error('Expected an ordinary held card');
    state = applyPokemonOriginalState(
      state,
      { type: 'replace', slot: 1 },
      prepared.self,
    );
    if (
      state.held !== null ||
      state.boards[prepared.self]![1]!.instanceId !== held
    )
      throw new Error(
        'Replacement was not actually committed by production rules',
      );
  } else if (scene === 'swap-committed') {
    const before = state.boards[prepared.self]!.map((slot) => slot.instanceId);
    state = applyPokemonOriginalState(
      state,
      { type: 'swap', a: 0, b: 2 },
      prepared.self,
    );
    if (
      state.boards[prepared.self]![0]!.instanceId !== before[2] ||
      state.boards[prepared.self]![2]!.instanceId !== before[0]
    )
      throw new Error('Two-slot exchange was not actually committed');
  } else if (scene === 'ability-resolved') {
    state = applyPokemonOriginalState(
      state,
      { type: 'close-peek' },
      prepared.self,
    );
    if (state.phase === 'charizard-view')
      throw new Error('Private peek did not close');
  }
  validateState(state, state.seatOrder);
  return {
    state: state as unknown as JsonValue,
    self: prepared.self,
    localSelection: scene.endsWith('-selected'),
    preparation: `Existing complete-deck original fixture ${originalScene}; production initialize/initial-flip/draw/replace/ability apply and validate. ${scene === 'guidance-last-dark' ? 'Complete initialized-state last-dark board arrangement validated before RoomCoordinator start; no naturally played reveal history or saved feedback is claimed. ' : ''}${scene.endsWith('-selected') ? 'Selection is intentionally absent from authoritative state and must be made by the real UI.' : scene.endsWith('-committed') ? 'The named final transaction was applied and its card locations checked.' : 'No projected-view patch.'}`,
  };
}
