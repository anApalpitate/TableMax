import { expect, it } from 'vitest';
import { pokemonExpansion as rules } from '../index';
import { card, instancesForSeats } from '../cards';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import { observeMemory } from './memory';
import { choose } from './strategy';

function fixture(usefulDraw = false) {
  const context = { seats: ['a', 'b'], random: new RandomSource(19) };
  let state = rules.initialize(context);
  for (const seat of context.seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      context,
    ).state;
  const pool = instancesForSeats(2);
  const take = (category: string) => {
    const index = pool.findIndex((id) => card(id).categoryId === category);
    expect(index).toBeGreaterThanOrEqual(0);
    return pool.splice(index, 1)[0]!;
  };
  const own = [
    'special-lucario',
    'special-lucario',
    'special-lucario',
    'ordinary-magikarp',
    'ordinary-magikarp',
    'ordinary-magikarp',
    'ordinary--2',
    'ordinary--2',
    usefulDraw ? 'ordinary-dragonite' : 'ordinary-togepi',
  ];
  const other = [
    usefulDraw ? 'ordinary-togepi' : 'ordinary--2',
    'ordinary-togepi',
    'special-ditto',
    'special-ditto',
    'special-zorua',
    'special-zorua',
    'ordinary-dragonite',
    'ordinary-dragonite',
    'ordinary-dragonite',
  ];
  for (const [seat, categories] of [
    ['a', own],
    ['b', other],
  ] as const)
    state.boards[seat] = categories.map((category) => ({
      instanceId: take(category),
      faceUp: true,
    }));
  state.held = null;
  state.discard = [];
  state.deck = pool;
  if (usefulDraw) {
    const index = state.deck.findIndex(
      (id) => card(id).categoryId === 'ordinary--2',
    );
    [state.deck[0], state.deck[index]] = [state.deck[index]!, state.deck[0]!];
    for (let i = state.deck.length - 1; i > 0; i--)
      [state.deck[i], state.deck[0]] = [state.deck[0]!, state.deck[i]!];
  }
  state.initialDone = [...context.seats];
  // This historical synthetic fixture represents a restored pre-usage chain.
  delete state.usedAbilityIds;
  delete state.pendingAbility;
  state.phase = 'lucario-choice';
  state.turnSeat = 'a';
  state.drawSource = 'deck';
  state.activeResearch = ['R22'];
  state.researchCandidates = ['R22', 'R01', 'R02'];
  state.usedOpeningResearch = ['R22'];
  state.votesBySeat = { a: 'R22', b: 'R22' };
  state.voteCounts = { R22: 2, R01: 0, R02: 0 };
  state.winsBySeat = { a: 2, b: 0 };
  rules.validateState(state, context.seats);
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const memory = observeMemory(null, view, 'a', 'juewu');
  return { context, state, view, memory };
}

it.each(['default', 'doubao', 'juewu'] as const)(
  'declines an unhelpful Lucario draw to complete the saved third win: %s',
  (difficulty) => {
    const { context, state, view, memory } = fixture();
    const before = structuredClone({ state, view, memory });
    const action = choose(
      view,
      rules.legalActions(state, 'a'),
      memory,
      difficulty,
      { next: () => 0 },
      new AbortController().signal,
    );
    expect(action).toEqual({ type: 'decline-ability' });
    const end = rules.apply(state, action, 'a', context).state;
    expect(end.phase).toBe('match-result');
    expect(end.matchWinners).toEqual(['a']);
    rules.validateState(end, context.seats);
    expect({ state, view, memory }).toEqual(before);
  },
);

it('takes a useful deck-only extra draw and completes its suppressed chain', () => {
  const { context, state, view, memory } = fixture(true);
  const action = choose(
    view,
    rules.legalActions(state, 'a'),
    memory,
    'default',
    { next: () => 0 },
    new AbortController().signal,
  );
  expect(action).toEqual({ type: 'extra-draw' });
  let end = rules.apply(state, action, 'a', context).state;
  expect(end.phase).toBe('lucario-draw');
  end = rules.apply(end, { type: 'draw', source: 'deck' }, 'a', context).state;
  expect(end.phase).toBe('place');
  expect(end.suppressedAbility).toBe(true);
  end = rules.apply(end, { type: 'replace', slot: 8 }, 'a', context).state;
  expect(end.phase).toBe('match-result');
  expect(end.matchWinners).toEqual(['a']);
  rules.validateState(end, context.seats);
});
