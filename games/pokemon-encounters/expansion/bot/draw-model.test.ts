import {
  legacyRules as rules,
  legacyScore as scoreBoard,
} from '../legacy-test';
import { expect, it } from 'vitest';

import { card } from '../cards';

import { RandomSource } from '../../../../packages/platform-core/src/random';
import { observeMemory } from './memory';
import { choose } from './strategy';

function fixture(source: 'deck' | 'discard') {
  const context = { seats: ['a', 'b'], random: new RandomSource(1445) };
  let state = rules.initialize(context);
  for (const seat of context.seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      context,
    ).state;
  const index = state.deck.findIndex((id) => card(id).ability === 'mewtwo');
  state.held = state.deck.splice(index, 1)[0]!;
  // This historical synthetic fixture represents a restored pre-usage chain.
  delete state.usedAbilityIds;
  delete state.pendingAbility;
  state.phase = 'mewtwo-choice';
  state.turnSeat = 'a';
  state.initialDone = [...context.seats];
  state.targetSeat = 'b';
  state.peekSlots = [0, 1];
  state.drawSource = source;
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
  return { context, state, view, memory };
}

it('does not value declining discard-sourced Mewtwo as permission to discard it', () => {
  const { context, state, view, memory } = fixture('discard');
  const before = structuredClone({ state, view, memory });
  const action = choose(
    view,
    rules.legalActions(state, 'a'),
    memory,
    'default',
    { next: () => 0 },
    new AbortController().signal,
  );
  expect(action).toEqual({ type: 'mewtwo-exchange', slot: 1 });
  const declined = rules.apply(
    state,
    { type: 'decline-ability' },
    'a',
    context,
  ).state;
  expect(
    rules.legalActions(declined, 'a').some((a) => a.type === 'discard-held'),
  ).toBe(false);
  const minimum = (first: typeof state) =>
    Math.min(
      ...rules.legalActions(first, 'a').map((action) => {
        const end = rules.apply(first, action, 'a', context).state;
        return scoreBoard(
          end.boards.a!.map((cell) => cell.instanceId),
          end.activeResearch,
          end.preReveal?.a ?? end.boards.a!.map((cell) => cell.faceUp),
        ).total;
      }),
    );
  expect(minimum(declined)).toBe(12);
  expect(minimum(rules.apply(state, action, 'a', context).state)).toBe(11);
  expect({ state, view, memory }).toEqual(before);
});

it('retains the legal discard option when Mewtwo was drawn from the deck', () => {
  const { context, state, view, memory } = fixture('deck');
  const action = choose(
    view,
    rules.legalActions(state, 'a'),
    memory,
    'default',
    { next: () => 0 },
    new AbortController().signal,
  );
  expect(action).toEqual({ type: 'decline-ability' });
  const declined = rules.apply(state, action, 'a', context).state;
  expect(rules.legalActions(declined, 'a')).toContainEqual({
    type: 'discard-held',
  });
  const end = rules.apply(
    declined,
    { type: 'discard-held' },
    'a',
    context,
  ).state;
  rules.validateState(end, context.seats);
  expect(end.boards.a).toEqual(state.boards.a);
});

it.each(['deck', 'discard'] as const)(
  'projects %s draw provenance publicly without exposing Mewtwo private peeks',
  (source) => {
    const { state } = fixture(source);
    for (const viewer of [
      { role: 'public' as const },
      { role: 'player' as const, seatId: 'b' },
    ]) {
      const view = rules.project(state, viewer);
      expect(view).toHaveProperty('drawSource', source);
      expect(view.peek).toBeNull();
      expect(view.boards.a![8]!.card).toBeNull();
    }
  },
);
