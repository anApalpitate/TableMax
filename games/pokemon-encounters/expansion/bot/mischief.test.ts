import { expect, it, vi } from 'vitest';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import { createInitialState, rules, type Action, type State } from '../index';
import { observeMemory } from './memory';
import { choose } from './strategy';
import {
  imminentRival,
  pressureChoice,
  type PressureEvidence,
} from './mischief';
import { directPressureFixture } from './test-fixtures';

const context = () => ({ seats: ['a', 'b'], random: new RandomSource(1) });

it('covers the two-win rival without changing any other authorization-derived memory', async () => {
  const ctx = context();
  const state = directPressureFixture(ctx);
  const seat = state.turnSeat;
  const view = rules.project(state, { role: 'player', seatId: seat });
  const rival = imminentRival(view, seat)!;
  expect(rival).toBe('b');
  const memory = observeMemory(null, view, seat, 'mischief');
  expect(memory).toEqual(observeMemory(null, view, seat, 'juewu'));
  const choices = rules
    .legalActions(state, seat)
    .filter(
      (action) =>
        action.type === 'decline-ability' ||
        (action.type === 'ninja-target' &&
          action.seat === rival &&
          action.a === 0 &&
          action.b === 1 &&
          !action.swap),
    );
  expect(choices).toHaveLength(2);
  const before = structuredClone({ state, view, memory });
  const ordinary = choose(
    view,
    choices,
    memory,
    'juewu',
    new RandomSource(41),
    new AbortController().signal,
  );
  const pressure = choose(
    view,
    choices,
    memory,
    'mischief',
    new RandomSource(41),
    new AbortController().signal,
  );
  expect(ordinary).toEqual({ type: 'decline-ability' });
  expect(pressure).toEqual({
    type: 'ninja-target',
    seat: rival,
    a: 0,
    b: 1,
    swap: false,
  });
  const next = rules.apply(state, pressure, seat, ctx).state as State;
  expect(next.boards[rival]!.map(({ faceUp }) => faceUp)).toEqual(
    Array(9).fill(false),
  );
  expect(next.winsBySeat).toEqual(state.winsBySeat);
  expect({ state, view, memory }).toEqual(before);

  const hidden = structuredClone(state);
  const tile = hidden.boards[rival]![4]!;
  [tile.instanceId, hidden.deck[0]] = [hidden.deck[0]!, tile.instanceId];
  const alternative = rules.project(rules.validateState(hidden, ctx.seats), {
    role: 'player',
    seatId: seat,
  });
  expect(alternative).toEqual(view);
  expect(
    choose(
      alternative,
      choices,
      memory,
      'mischief',
      new RandomSource(41),
      new AbortController().signal,
    ),
  ).toEqual(pressure);
});

it('keeps existing wins and non-losses across the shared hypotheses', () => {
  const base: Action = { type: 'decline-ability' };
  const risky: Action = {
    type: 'ninja-target',
    seat: 'b',
    a: 0,
    b: 1,
    swap: false,
  };
  const safe: Action = {
    type: 'ninja-target',
    seat: 'b',
    a: 0,
    b: 2,
    swap: false,
  };
  const ordered = [
    { action: base, value: 0 },
    { action: risky, value: 0.5 },
    { action: safe, value: 1 },
  ];
  const evidence = new Map<Action, PressureEvidence>([
    [base, { disruption: 0, outcomes: [-1, 0] }],
    [risky, { disruption: 44, outcomes: [0, -1] }],
    [safe, { disruption: 12, outcomes: [-1, 0] }],
  ]);
  expect(pressureChoice(ordered, evidence, 2)).toEqual(safe);
  evidence.get(safe)!.outcomes = [-1, 1];
  expect(pressureChoice(ordered, evidence, 2)).toEqual(base);
});

it('leaves a sealed study vote unchanged when an earlier private choice differs', () => {
  const ctx = context();
  const original = createInitialState(ctx, 'events-research-v3');
  const stateFor = (index: number) =>
    rules.apply(
      original,
      {
        type: 'vote-research',
        taskId: original.researchCandidates[index]!,
      },
      'a',
      ctx,
    ).state;
  const first = stateFor(0),
    second = stateFor(1);
  const one = rules.project(first, { role: 'player', seatId: 'b' });
  const two = rules.project(second, { role: 'player', seatId: 'b' });
  expect(one).toEqual(two);
  expect(imminentRival(one, 'b')).toBeUndefined();
  const actions = rules.legalActions(first, 'b');
  const mem = observeMemory(null, one, 'b', 'mischief');
  expect(
    choose(
      one,
      actions,
      mem,
      'mischief',
      new RandomSource(7),
      new AbortController().signal,
    ),
  ).toEqual(
    choose(
      two,
      actions,
      mem,
      'juewu',
      new RandomSource(7),
      new AbortController().signal,
    ),
  );
});

it('can change a Greninja choice across the complete authorized action set', () => {
  const ctx = context();
  const state = directPressureFixture(ctx);
  const seat = state.turnSeat;
  const view = rules.project(state, { role: 'player', seatId: seat });
  const memory = observeMemory(null, view, seat, 'juewu');
  const actions = rules.legalActions(state, seat);
  const fixedClock = vi.spyOn(performance, 'now').mockReturnValue(0);
  try {
    const ordinary = choose(
      view,
      actions,
      memory,
      'juewu',
      new RandomSource(3),
      new AbortController().signal,
    );
    const pressure = choose(
      view,
      actions,
      memory,
      'mischief',
      new RandomSource(3),
      new AbortController().signal,
    );
    expect(ordinary).toEqual({
      type: 'ninja-target',
      seat: 'b',
      a: 3,
      b: 7,
      swap: true,
    });
    expect(pressure).toEqual({
      type: 'ninja-target',
      seat: 'b',
      a: 1,
      b: 7,
      swap: true,
    });
    expect(actions).toContainEqual(pressure);
  } finally {
    fixedClock.mockRestore();
  }
});

it('evaluates the legal row and falls back when there is no unique two-win rival', () => {
  const ctx = context();
  const state = directPressureFixture(ctx, 'groudon');
  const seat = state.turnSeat;
  const view = rules.project(state, { role: 'player', seatId: seat });
  const rival = imminentRival(view, seat)!;
  expect(view.phase).toBe('row-choice');
  expect(rival).toBe('b');
  const choices = rules.legalActions(state, seat);
  const picked = choose(
    view,
    choices,
    observeMemory(null, view, seat, 'mischief'),
    'mischief',
    new RandomSource(41),
    new AbortController().signal,
  );
  expect(choices).toContainEqual(picked);
  const next = rules.apply(state, picked, seat, ctx).state as State;
  expect(rules.validateState(next, ctx.seats)).toEqual(next);
  expect(
    imminentRival(
      { ...view, winsBySeat: { ...view.winsBySeat, [rival]: 1 } },
      seat,
    ),
  ).toBeUndefined();
});
