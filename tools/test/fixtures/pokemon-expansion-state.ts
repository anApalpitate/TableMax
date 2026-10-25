import { pokemonExpansion as rules } from '../../../games/pokemon-encounters/expansion';
import {
  validateState,
  type Action,
} from '../../../games/pokemon-encounters/expansion/state';
import { RandomSource } from '../../../packages/platform-core/src/random';
import {
  eventKinds,
  type EventKind,
} from '../../../games/pokemon-encounters/expansion/events';
import type { JsonValue } from '../../../packages/game-sdk/src';
import type {
  PokemonFixedState,
  PokemonPreparedState,
} from './prepare-pokemon-fixed';

export type PokemonExpansionStateSettings = {
  scenario?: 'draw' | 'vote' | 'place' | 'result' | 'row';
  seats?: number;
  creature?: string;
  ordinary?: string;
  terminal?: boolean;
  commonWinner?: boolean;
  emptyDiscard?: boolean;
  initial?: boolean;
  targetStage?: boolean;
  event?: EventKind;
  buffer?: 'occupied' | 'take';
  nextDraw?: string;
};

/** Complete validated deck permutation; subsequent transitions use production rules. */
export function createPokemonExpansionState(
  settings: PokemonExpansionStateSettings,
) {
  const seats = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].slice(
    0,
    settings.seats ?? 6,
  );
  const random = new RandomSource(1060651);
  let eventRandom: number | undefined;
  const ctx = { seats, random: { next: () => eventRandom ?? random.next() } };
  let state = rules.initialize(ctx);
  if (settings.commonWinner) state.researchCandidates = ['R01', 'R02', 'R03'];
  const apply = (action: Action) => {
    const actor =
      state.phase === 'zapdos-receive'
        ? state.recipientQueue[state.recipientIndex]!
        : state.turnSeat;
    state = rules.apply(state, action, actor, ctx).state;
    validateState(state, seats);
  };
  if (settings.scenario !== 'vote') {
    for (const seat of seats)
      state = rules.apply(
        state,
        { type: 'vote-research', taskId: state.researchCandidates[0]! },
        seat,
        ctx,
      ).state;
    if (!settings.initial)
      for (const seat of seats)
        state = rules.apply(
          state,
          { type: 'initial-flip', slot: 0 },
          seat,
          ctx,
        ).state;
  }
  const actor = state.turnSeat;
  const swapInstance = (wanted: string, replacement: string) => {
    for (const board of Object.values(state.boards))
      for (const slot of board)
        if (slot.instanceId === wanted) slot.instanceId = replacement;
    state.deck = state.deck.map((id) => (id === wanted ? replacement : id));
    state.discard = state.discard.map((id) =>
      id === wanted ? replacement : id,
    );
  };
  const placeReference = (
    seat: string,
    slot: number,
    category: string,
    copy = 1,
  ) => {
    const wanted = `${category}#${String(copy).padStart(2, '0')}`,
      previous = state.boards[seat]![slot]!.instanceId;
    if (wanted !== previous) swapInstance(wanted, previous);
    state.boards[seat]![slot] = { instanceId: wanted, faceUp: true };
  };
  if (settings.terminal) {
    const others = seats.filter((seat) => seat !== actor);
    placeReference(others[0]!, 0, 'special-kyogre');
    if (others[1]) placeReference(others[1], 0, 'special-rayquaza');
    for (const slot of state.boards[actor]!) slot.faceUp = true;
    state.boards[actor]![8]!.faceUp = false;
    state.winsBySeat[actor] = 2;
  }
  if (settings.commonWinner) {
    const other = seats.find((seat) => seat !== actor)!;
    for (const [seat, values] of [
      [actor, [3, 4, 5]],
      [other, [0, 1, 6]],
    ] as const) {
      values.forEach((value, row) => {
        for (let col = 0; col < 3; col++)
          placeReference(
            seat,
            row * 3 + col,
            `ordinary-${value}`,
            col + 1 + (value === 5 ? 1 : 0),
          );
      });
      state.winsBySeat[seat] = 2;
    }
    state.boards[actor]![8]!.faceUp = false;
  }
  if (settings.scenario === 'draw') {
    ['special-rayquaza#01', 'special-ditto#01']
      .slice(0, state.discard.length)
      .forEach((wanted, i) => {
        const index = state.discard.length - 1 - i,
          previous = state.discard[index]!;
        if (wanted !== previous) swapInstance(wanted, previous);
        state.discard[index] = wanted;
      });
  }
  if (settings.emptyDiscard) {
    state.deck.push(...state.discard);
    state.discard = [];
  }
  const before = rules.project(state, { role: 'public' });
  if (!['vote', 'draw'].includes(settings.scenario ?? '')) {
    const category = settings.ordinary
      ? `ordinary-${settings.ordinary}`
      : `special-${settings.creature ?? 'mewtwo'}`;
    const wanted = `${category}#01`,
      top = state.deck.at(-1)!;
    if (wanted !== top) swapInstance(wanted, top);
    state.deck[state.deck.length - 1] = wanted;
    if (settings.nextDraw) {
      const nextTop = state.deck.length - 2;
      const replacement = state.deck[nextTop]!;
      swapInstance(settings.nextDraw, replacement);
      state.deck[nextTop] = settings.nextDraw;
    }
    if (settings.event) {
      // Construct and validate the protected-turn boundary; the event itself is
      // resolved by the production draw transaction, not patched into a view.
      placeReference(actor, 0, 'ordinary-4');
      state.normalTurnsBySeat = Object.fromEntries(
        seats.map((seat) => [seat, 2]),
      );
      state.randomEvent = {
        markerInstanceId: wanted,
        kind: null,
        triggered: false,
        protected: false,
      };
      eventRandom =
        (eventKinds.indexOf(settings.event) + 0.5) / eventKinds.length;
    }
    validateState(state, seats);

    apply({ type: 'draw', source: 'deck' });
    const take = (type: Action['type']) => {
      const selected = rules
        .legalActions(state, actor)
        .find((action) => action.type === type);
      if (!selected)
        throw new Error(`Missing legal fixture ${type}/${state.phase}`);
      apply(selected);
    };
    if (!settings.ordinary) {
      const creature = settings.creature ?? 'mewtwo';
      if (creature === 'mew') {
        if (!settings.targetStage) take('mew-target');
      } else if (creature === 'mewtwo') {
        if (!settings.targetStage) {
          take('mewtwo-target');
          take('mewtwo-exchange');
        }
      } else if (creature === 'zapdos') {
        if (!settings.targetStage) take('pass-direction');
      } else if (creature !== 'team-rocket') {
        apply({ type: 'replace', slot: settings.terminal ? 8 : 1 });
        const choices: Record<string, Action['type']> = {
          charizard: 'peek',
          snorlax: 'swap',
          arceus: 'activate-arceus',
          greninja: 'ninja-target',
          lucario: 'extra-draw',
          groudon: 'row-target',
          kyogre: 'row-target',
          rayquaza: 'row-target',
        };
        if (choices[creature] && settings.scenario !== 'row') {
          if (settings.terminal && creature === 'groudon') {
            // Preserve the complete actor row so this legal last ability really settles.
            const row = 2;
            const other = seats.find((seat) => seat !== actor)!;
            for (let i = row * 3; i < row * 3 + 3; i++)
              state.boards[other]![i]!.faceUp = true;
          }
          take(choices[creature]!);
        }
      }
    }

    if (settings.scenario === 'result') apply({ type: 'replace', slot: 8 });
  }
  if (settings.buffer) {
    apply({ type: 'store-buffer' });
    for (let i = 1; i < seats.length; i++) {
      const index = state.deck.findIndex((id) => id.startsWith('ordinary-'));
      const top = state.deck.length - 1;
      [state.deck[index], state.deck[top]] = [
        state.deck[top]!,
        state.deck[index]!,
      ];
      apply({ type: 'draw', source: 'deck' });
      apply({ type: 'replace', slot: 1 });
    }
    if (settings.buffer === 'take') apply({ type: 'draw-buffer' });
  }
  validateState(state, seats);
  return {
    seats,
    actor,
    before,
    get state() {
      return state;
    },
    apply,
  };
}

export function preparePokemonExpansionFixedState(
  scene: PokemonFixedState,
  count: number,
): PokemonPreparedState {
  const source: Partial<
    Record<PokemonFixedState, PokemonExpansionStateSettings>
  > = {
    draw: { scenario: 'draw' },
    dense: { scenario: 'draw' },
    'research-vote': { scenario: 'vote' },
    held: { scenario: 'place', ordinary: '6' },
    'placement-selected': { scenario: 'place', ordinary: '6' },
    'replace-committed': { scenario: 'place', ordinary: '6' },
    'ability-choice': { scenario: 'row', creature: 'charizard' },
    'ability-resolved': { scenario: 'place', creature: 'charizard' },
    'private-peek': { scenario: 'place', creature: 'charizard' },
    'target-private-peek': {
      scenario: 'place',
      creature: 'mewtwo',
      targetStage: true,
    },
    'swap-selected': { scenario: 'row', creature: 'snorlax' },
    'swap-committed': { scenario: 'row', creature: 'snorlax' },
    'reposition-selected': { scenario: 'draw' },
    'reposition-committed': { scenario: 'draw' },
    'saved-sequence': {
      scenario: 'row',
      creature: 'charizard',
      nextDraw: 'special-mew#01',
    },
  };
  const settings = source[scene];
  if (!settings) throw new Error(`Unsupported expansion fixed state: ${scene}`);
  const prepared = createPokemonExpansionState({ ...settings, seats: count });
  const self = prepared.actor;
  if (scene === 'target-private-peek') {
    const action = rules
      .legalActions(prepared.state, self)
      .find(
        (item) =>
          item.type === 'mewtwo-target' &&
          'slot' in item &&
          !prepared.state.boards[item.seat]![item.slot]!.faceUp,
      );
    if (!action) throw new Error('No legal target-private-peek transaction');
    prepared.apply(action);
    if (prepared.state.phase !== 'mewtwo-choice')
      throw new Error('Target private peek did not open');
  } else if (scene === 'replace-committed') {
    const held = prepared.state.held;
    if (!held || prepared.state.phase !== 'place')
      throw new Error('Expected an ordinary held card');
    prepared.apply({ type: 'replace', slot: 1 });
    if (
      prepared.state.held !== null ||
      prepared.state.boards[self]![1]!.instanceId !== held
    )
      throw new Error(
        'Replacement was not actually committed by production rules',
      );
  } else if (scene === 'reposition-committed' || scene === 'swap-committed') {
    const before = prepared.state.boards[self]!.map((slot) => slot.instanceId);
    prepared.apply({
      type: scene === 'reposition-committed' ? 'reposition' : 'swap',
      a: 0,
      b: 2,
    });
    if (
      prepared.state.boards[self]![0]!.instanceId !== before[2] ||
      prepared.state.boards[self]![2]!.instanceId !== before[0]
    )
      throw new Error('Two-slot exchange was not actually committed');
  } else if (scene === 'ability-resolved') {
    prepared.apply({ type: 'close-peek' });
    if (prepared.state.phase === 'charizard-view')
      throw new Error('Private peek did not close');
  }
  validateState(prepared.state, prepared.seats);
  return {
    state: prepared.state as unknown as JsonValue,
    self,
    localSelection: scene.endsWith('-selected'),
    preparation: `Existing complete-deck events-research-v3 fixture with legal votes/initial flips, production draw/replace/ability apply and validate. ${scene.endsWith('-selected') ? 'Selection is intentionally absent from authoritative state and must be made by the real UI.' : scene.endsWith('-committed') ? 'The named final transaction was applied and its card locations checked.' : 'No projected-view patch.'}`,
  };
}
