import {
  legacyRules as rules,
  legacyScore as scoreBoard,
  legacyInstances as instancesForSeats,
} from '../legacy-test';
import { expect, it } from 'vitest';

import { card } from '../cards';

import { RandomSource } from '../../../../packages/platform-core/src/random';
import { choose } from './strategy';
import { observeMemory } from './memory';
import { previewRocketPikachu } from './rocket';

function fixture() {
  const context = { seats: ['a', 'b'], random: new RandomSource(1) };
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
  for (const seat of context.seats)
    for (const cell of state.boards[seat]!)
      cell.instanceId = take(card(cell.instanceId).categoryId);
  state.discard = state.discard.map((id, index) =>
    take(
      index === state.discard.length - 1
        ? 'special-team-rocket'
        : card(id).categoryId,
    ),
  );
  state.deck = [...pool];
  for (let index = state.deck.length - 1; index > 0; index--)
    [state.deck[index], state.deck[0]] = [state.deck[0]!, state.deck[index]!];
  state.phase = 'draw';
  state.turnSeat = 'a';
  state.initialDone = [...context.seats];
  for (const seat of context.seats)
    for (const cell of state.boards[seat]!) cell.faceUp = true;
  const known = observeMemory(
    null,
    rules.project(state, { role: 'player', seatId: 'a' }),
    'a',
    'default',
  );
  for (const seat of context.seats) state.boards[seat]![8]!.faceUp = false;
  rules.validateState(state, context.seats);
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const memory = observeMemory(known, view, 'a', 'default');
  return { state, context, view, memory };
}
const fields = (state: ReturnType<typeof fixture>['state']) => ({
  boards: Object.fromEntries(
    state.seatOrder.map((seat) => [
      seat,
      state.boards[seat]!.map((cell) => cell.instanceId),
    ]),
  ),
  up: Object.fromEntries(
    state.seatOrder.map((seat) => [
      seat,
      state.boards[seat]!.map((cell) => cell.faceUp),
    ]),
  ),
});

it('evaluates drawing Rocket by the equal-probability optimal two coin outcomes, not a discardable 12-point ordinary card', () => {
  const { state, context, view, memory } = fixture();
  const before = structuredClone({ state, view, memory });
  const actions = rules
    .legalActions(state, 'a')
    .filter(
      (action) =>
        action.type === 'reposition' ||
        (action.type === 'draw' &&
          action.source === 'discard' &&
          action.discardIndex === 0),
    );
  const action = choose(
    view,
    actions,
    memory,
    'default',
    { next: () => 0 },
    new AbortController().signal,
  );
  expect(action).toEqual({ type: 'draw', source: 'discard', discardIndex: 0 });
  const minimum = (coin: number) => {
    const ctx = { ...context, random: { next: () => coin } };
    const draw = rules.apply(
      state,
      { type: 'draw', source: 'discard', discardIndex: 0 },
      'a',
      ctx,
    ).state;
    expect(
      rules.legalActions(draw, 'a').every((a) => a.type === 'replace'),
    ).toBe(true);
    return Math.min(
      ...rules.legalActions(draw, 'a').map((a) => {
        const end = rules.apply(draw, a, 'a', ctx).state;
        return scoreBoard(
          end.boards.a!.map((cell) => cell.instanceId),
          end.activeResearch,
          end.preReveal?.a ?? end.boards.a!.map((cell) => cell.faceUp),
        ).total;
      }),
    );
  };
  expect(minimum(0.1)).toBe(43);
  expect(minimum(0.9)).toBe(29);
  expect({ state, view, memory }).toEqual(before);
});

it.each([0, 8])(
  'matches actual whole-table Pikachu replacements at slot %i with copied orientations and suppressed fresh abilities',
  (slot) => {
    const { state, context } = fixture();
    const ctx = { ...context, random: { next: () => 0.9 } };
    const draw = rules.apply(
      state,
      { type: 'draw', source: 'discard', discardIndex: 0 },
      'a',
      ctx,
    ).state;
    for (const [offset, category] of [
      'special-mew',
      'special-zorua',
    ].entries()) {
      const index = draw.deck.findIndex(
        (id) => card(id).categoryId === category,
      );
      expect(index).toBeGreaterThanOrEqual(0);
      const top = draw.deck.length - 1 - offset;
      [draw.deck[index], draw.deck[top]] = [draw.deck[top]!, draw.deck[index]!];
    }
    rules.validateState(draw, context.seats);
    const table = fields(draw),
      before = structuredClone(table);
    const preview = previewRocketPikachu(table, ['a', 'b'], draw.deck, slot);
    const after = rules.apply(draw, { type: 'replace', slot }, 'a', ctx).state;
    rules.validateState(after, context.seats);
    for (const seat of context.seats)
      expect(after.boards[seat]!.map((cell) => cell.instanceId)).toEqual(
        preview.boards[seat],
      );
    expect(after.preReveal ?? fields(after).up).toEqual(preview.up);
    expect(['draw', 'round-result', 'match-result']).toContain(after.phase);
    expect(card(preview.fresh[0]!).ability).toBe('mew');
    expect(card(preview.fresh[1]!).copy).toBe('vertical');
    expect(table).toEqual(before);
  },
);

it('excludes the Rocket already consumed from the deck before predicting fresh Pikachu replacements', () => {
  const { state, context } = fixture();
  const rocket = state.deck.findIndex(
    (id) => card(id).ability === 'team-rocket',
  );
  expect(rocket).toBeGreaterThanOrEqual(0);
  const top = state.deck.length - 1;
  [state.deck[rocket], state.deck[top]] = [
    state.deck[top]!,
    state.deck[rocket]!,
  ];
  const drawn = state.deck[top]!;
  const table = fields(state);
  const preview = previewRocketPikachu(table, ['a', 'b'], state.deck, 0, 1);
  const ctx = { ...context, random: { next: () => 0.9 } };
  const draw = rules.apply(
    state,
    { type: 'draw', source: 'deck' },
    'a',
    ctx,
  ).state;
  expect(draw.held).toBe(drawn);
  const after = rules.apply(draw, { type: 'replace', slot: 0 }, 'a', ctx).state;
  for (const seat of context.seats)
    expect(after.boards[seat]!.map((cell) => cell.instanceId)).toEqual(
      preview.boards[seat],
    );
  expect(preview.fresh).not.toContain(drawn);
  expect(new Set(preview.fresh).size).toBe(context.seats.length);
});
