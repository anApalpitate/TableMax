import { expect, it } from 'vitest';
import { pokemonExpansion as rules } from '../index';
import { instancesForSeats, card } from '../cards';
import { observeMemory } from './memory';
import { choose } from './strategy';
import { RandomSource } from '../../../../packages/platform-core/src/random';

function closureFixture(opponentWins: number, ownWins = 0) {
  const context = { seats: ['a', 'b'], random: new RandomSource(724111) };
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
    const index = pool.findIndex(
      (instance) => card(instance).categoryId === category,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    return pool.splice(index, 1)[0]!;
  };
  state.boards.a = [
    'ordinary-piplup',
    'ordinary-7',
    'ordinary-piplup',
    'ordinary-0',
    'ordinary-1',
    'ordinary-3',
    'ordinary-4',
    'ordinary-5',
    'ordinary-6',
  ].map((category) => ({ instanceId: take(category), faceUp: true }));
  state.boards.b = [
    'ordinary-magikarp',
    'ordinary-1',
    'ordinary-piplup',
    'ordinary-3',
    'ordinary-4',
    'ordinary-5',
    'ordinary-6',
    'ordinary-0',
    'ordinary-0',
  ].map((category) => ({ instanceId: take(category), faceUp: true }));
  state.held = take('ordinary--2');
  state.deck = pool;
  state.discard = [];
  state.initialDone = [...context.seats];
  state.researchCandidates = ['R22', 'R01', 'R02'];
  state.votesBySeat = { a: 'R22', b: 'R22' };
  state.voteCounts = { R22: 2, R01: 0, R02: 0 };
  state.activeResearch = ['R22'];
  state.usedOpeningResearch = ['R22'];
  state.phase = 'place';
  state.turnSeat = 'a';
  state.drawSource = 'deck';
  state.roundNumber = 3;
  state.winsBySeat = { a: ownWins, b: opponentWins };
  // Authorized prior public knowledge, as can occur at a saved ability substep before cover.
  const known = observeMemory(
    null,
    rules.project(state, { role: 'player', seatId: 'a' }),
    'a',
    'juewu',
  );
  state.boards.a[1]!.faceUp = false;
  state.boards.b[8]!.faceUp = false;
  rules.validateState(state, context.seats);
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const memory = observeMemory(known, view, 'a', 'juewu');
  const actions = rules.legalActions(state, 'a');
  const decide = () =>
    choose(
      view,
      actions,
      memory,
      'juewu',
      new RandomSource(81010),
      new AbortController().signal,
    );
  return { state, context, decide };
}

it('does not close a tied round when only the opponent obtains a third win and a legal continuation remains', () => {
  const ordinary = closureFixture(0);
  expect(ordinary.decide()).toEqual({ type: 'replace', slot: 1 });
  const terminal = closureFixture(2);
  const action = terminal.decide();
  expect(action).not.toEqual({ type: 'replace', slot: 1 });
  expect(
    rules.apply(terminal.state, action, 'a', terminal.context).state.phase,
  ).toBe('draw');
});

it('accepts the same shared round win when it also gives this player a third victory', () => {
  const fixture = closureFixture(2, 2);
  const action = fixture.decide();
  expect(action).toEqual({ type: 'replace', slot: 1 });
  const after = rules.apply(fixture.state, action, 'a', fixture.context).state;
  expect(after.phase).toBe('match-result');
  expect(after.matchWinners).toEqual(['a', 'b']);
});

it('covers the opponent full field before the ability chain closes an otherwise lost match', () => {
  const { state, context } = closureFixture(2);
  state.discard.push(state.held!);
  state.held = null;
  const index = state.deck.findIndex(
    (instance) => card(instance).categoryId === 'special-greninja',
  );
  const ninja = state.deck.splice(index, 1)[0]!;
  state.deck.push(state.boards.a![0]!.instanceId);
  state.boards.a![0] = { instanceId: ninja, faceUp: true };
  state.boards.b![8]!.faceUp = true;
  state.phase = 'greninja-choice';
  rules.validateState(state, context.seats);
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const memory = observeMemory(null, view, 'a', 'juewu');
  const action = choose(
    view,
    rules.legalActions(state, 'a'),
    memory,
    'juewu',
    new RandomSource(81010),
    new AbortController().signal,
  );
  expect(action.type).toBe('ninja-target');
  expect('seat' in action && action.seat).toBe('b');
  const after = rules.apply(state, action, 'a', context).state;
  expect(after.phase).toBe('draw');
  expect(after.boards.a!.filter((slot) => slot.faceUp)).toHaveLength(8);
  expect(after.boards.b!.filter((slot) => slot.faceUp)).toHaveLength(7);
});
