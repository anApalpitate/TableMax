import { expect, it } from 'vitest';
import { pokemonExpansion as rules } from '../index';
import { instancesForSeats, card } from '../cards';
import { scoreBoard } from '../scoring';
import { observeMemory } from './memory';
import { choose } from './strategy';
import { RandomSource } from '../../../../packages/platform-core/src/random';

function rocketFixture(turnSeat = 'a') {
  const context = { seats: ['a', 'b', 'c'], random: new RandomSource(8) };
  let state = rules.initialize(context);
  for (const seat of context.seats)
    state = rules.apply(
      state,
      {
        type: 'vote-research',
        taskId: state.researchCandidates[0]!,
      },
      seat,
      context,
    ).state;
  const pool = instancesForSeats(3);
  const take = (category: string) => {
    const index = pool.findIndex((id) => card(id).categoryId === category);
    expect(index).toBeGreaterThanOrEqual(0);
    return pool.splice(index, 1)[0]!;
  };
  for (const seat of context.seats)
    state.boards[seat] = state.boards[seat]!.map((cell) => ({
      instanceId: take(card(cell.instanceId).categoryId),
      faceUp: true,
    }));
  state.held = take('special-team-rocket');
  state.discard = [];
  state.deck = [...pool];
  // Controlled draw order equals the authorized sampler's zero-RNG permutation.
  // No true deck order is passed into choose; this is an independent rule oracle.
  for (let i = state.deck.length - 1; i > 0; i--)
    [state.deck[i], state.deck[0]] = [state.deck[0]!, state.deck[i]!];
  state.initialDone = [...context.seats];
  state.phase = 'rocket-pikachu';
  state.turnSeat = turnSeat;
  state.coin = 'pikachu';
  state.drawSource = 'deck';
  state.researchCandidates = ['R22', 'R01', 'R02'];
  state.activeResearch = ['R22'];
  state.usedOpeningResearch = ['R22'];
  state.votesBySeat = { a: 'R22', b: 'R22', c: 'R22' };
  state.voteCounts = { R22: 3, R01: 0, R02: 0 };
  const known = observeMemory(
    null,
    rules.project(state, { role: 'player', seatId: turnSeat }),
    turnSeat,
    'juewu',
  );
  for (const seat of context.seats) state.boards[seat]![8]!.faceUp = false;
  rules.validateState(state, context.seats);
  const view = rules.project(state, { role: 'player', seatId: turnSeat });
  const memory = observeMemory(known, view, turnSeat, 'juewu');
  return { state, context, view, memory };
}

it('evaluates Rocket Pikachu as a fresh card for every seat, not a 12-point self replacement', () => {
  const { state, context, view, memory } = rocketFixture();
  const before = structuredClone({ state, view, memory });
  const action = choose(
    view,
    rules.legalActions(state, 'a'),
    memory,
    'juewu',
    { next: () => 0 },
    new AbortController().signal,
  );
  // The old model chose slot 3 (46 actual own points); slot 1 yields 38 points.
  expect(action).toEqual({ type: 'replace', slot: 1 });
  const after = rules.apply(state, action, 'a', context).state;
  rules.validateState(after, context.seats);
  expect(after.phase).toBe('draw');
  expect(after.held).toBeNull();
  expect(
    context.seats.map(
      (seat) => card(after.boards[seat]![1]!.instanceId).categoryId,
    ),
  ).toEqual(['ordinary--2', 'special-zorua', 'special-rayquaza']);
  expect(
    scoreBoard(
      after.boards.a!.map((cell) => cell.instanceId),
      ['R22'],
    ).total,
  ).toBe(38);
  expect({ state, view, memory }).toEqual(before);
});

it('starts whole-table replacements at the actor even when the actor is not the first seat', () => {
  const { state, context, view, memory } = rocketFixture('b');
  const action = choose(
    view,
    rules.legalActions(state, 'b'),
    memory,
    'juewu',
    { next: () => 0 },
    new AbortController().signal,
  );
  expect(action).toEqual({ type: 'replace', slot: 6 });
  const after = rules.apply(state, action, 'b', context).state;
  expect(
    context.seats.map(
      (seat) => card(after.boards[seat]![6]!.instanceId).categoryId,
    ),
  ).toEqual(['special-rayquaza', 'ordinary--2', 'special-zorua']);
  expect(after.phase).toBe('draw');
  expect(
    scoreBoard(
      after.boards.b!.map((cell) => cell.instanceId),
      ['R22'],
    ).total,
  ).toBe(48);
  rules.validateState(after, context.seats);
});

it('makes the same choice for different hidden real deck orders with identical authorized information', () => {
  const fixture = rocketFixture();
  const changed = structuredClone(fixture.state);
  changed.deck.reverse();
  rules.validateState(changed, fixture.context.seats);
  const changedView = rules.project(changed, { role: 'player', seatId: 'a' });
  expect(changedView).toEqual(fixture.view);
  const decide = (view: typeof fixture.view) =>
    choose(
      view,
      rules.legalActions(fixture.state, 'a'),
      fixture.memory,
      'juewu',
      { next: () => 0 },
      new AbortController().signal,
    );
  expect(decide(changedView)).toEqual(decide(fixture.view));
});
