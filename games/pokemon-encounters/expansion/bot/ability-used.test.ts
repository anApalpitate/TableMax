import {
  legacyRules as rules,
  legacyInstances as instancesForSeats,
} from '../legacy-test';
import { expect, it } from 'vitest';
import { card } from '../cards';

import { RandomSource } from '../../../../packages/platform-core/src/random';
import { observeMemory, validateMemory } from './memory';
import { createTactics, type TacticalModel } from './tactics';
import { choose } from './strategy';

function fixture() {
  let state = rules.initialize({
    seats: ['a', 'b'],
    random: new RandomSource(910),
  });
  const context = { seats: ['a', 'b'], random: new RandomSource(910) };
  for (const seat of context.seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      context,
    ).state;
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const pool = instancesForSeats(2);
  const take = (category: string) =>
    pool.find((id) => card(id).categoryId === category)!;
  const model: TacticalModel = {
    boards: {
      a: Array<string>(9).fill(take('ordinary-5')),
      b: Array<string>(9).fill(take('ordinary-8')),
    },
    up: { a: Array<boolean>(9).fill(false), b: Array<boolean>(9).fill(false) },
    pool: [take('ordinary-7')],
    held: null,
    discards: [],
    usedAbilityIds: [],
  };
  return { state, view, take, model };
}

it('exhausts only the sampled instance, keeping another same-category ability available', () => {
  const { view, model } = fixture();
  const copies = instancesForSeats(2).filter(
    (id) => card(id).ability === 'snorlax',
  );
  model.usedAbilityIds = [copies[0]!];
  let calls = 0;
  const tactics = createTactics(
    view,
    'a',
    () => 0,
    () => {
      calls++;
      return 0;
    },
    0,
  );
  tactics.afterPlacement(model, copies[0]!);
  expect(calls).toBe(1);
  calls = 0;
  tactics.afterPlacement(model, copies[1]!);
  expect(calls).toBe(37);
});

it('models an exhausted Mew as an ordinary placement instead of mandatory theft', () => {
  const { view, model, take } = fixture();
  view.phase = 'draw';
  const mew = take('special-mew');
  model.discards = [mew];
  const tactics = createTactics(
    view,
    'a',
    () => 0,
    (trial) => (trial.boards.b!.includes(mew) ? -100 : 0),
    0,
  );
  expect(
    tactics.draw(model, { type: 'draw', source: 'discard', discardIndex: 0 }),
  ).toBe(-99.92);
  expect(
    tactics.draw(
      { ...model, usedAbilityIds: [mew] },
      { type: 'draw', source: 'discard', discardIndex: 0 },
    ),
  ).toBe(0.08);
  expect(card(mew).ability).toBe('mew');
});

it('Lucario never evaluates the tempting discard as its extra-card source', () => {
  const { view, model, take } = fixture();
  model.discards = [take('ordinary--2')];
  const tactics = createTactics(
    view,
    'a',
    () => 0,
    (trial) => (trial.boards.a!.some((id) => card(id).value === -2) ? -100 : 0),
    0,
  );
  expect(tactics.afterPlacement(model, take('special-lucario'))).toBe(0);
});

it('remembers a legal exhausted face through cover and a public move, and accepts old memory', () => {
  const { state } = fixture();
  state.boards.a![0]!.faceUp = true;
  state.boards.a![1]!.faceUp = true;
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  view.boards.a![0]!.card!.abilityUsed = true;
  view.boards.a![1]!.card!.abilityUsed = false;
  const memory = observeMemory(null, view, 'a', 'juewu');
  const covered = structuredClone(view);
  covered.boards.a![0] = {
    ...covered.boards.a![0]!,
    faceUp: false,
    card: null,
  };
  covered.boards.a![1] = {
    ...covered.boards.a![1]!,
    faceUp: false,
    card: null,
  };
  covered.events = [
    {
      id: memory.lastEvent + 1,
      kind: 'action',
      text: '换位',
      action: {
        actor: 'a',
        verb: 'reposition',
        cardCategory: null,
        ability: null,
        targets: [{ seat: 'a', slots: [0, 1] }],
      },
    },
  ];
  const moved = observeMemory(memory, covered, 'a', 'juewu');
  expect(moved.known.a![0]!.abilityUsed).toBe(false);
  expect(moved.known.a![1]!.abilityUsed).toBe(true);
  const legacy = structuredClone(memory);
  for (const board of Object.values(legacy.known))
    for (const knowledge of board) if (knowledge) delete knowledge.abilityUsed;
  expect(validateMemory(legacy)).toEqual(legacy);
  expect(() =>
    validateMemory({
      ...memory,
      known: {
        ...memory.known,
        a: memory.known.a!.map((k) => k && { ...k, abilityUsed: 'forged' }),
      },
    }),
  ).toThrow();
});

it('marks a publicly activated source before a cover/swap without learning an unknown card', () => {
  const { state } = fixture();
  state.boards.a![0]!.faceUp = true;
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const memory = observeMemory(null, view, 'a', 'juewu');
  const after = structuredClone(view);
  after.boards.a![0] = { ...after.boards.a![0]!, faceUp: false, card: null };
  after.events = [
    {
      id: memory.lastEvent + 1,
      kind: 'action',
      text: '忍蛙盖回',
      effect: { entrance: 'greninja', source: { seat: 'a', slot: 0 } },
      action: {
        actor: 'a',
        verb: 'ninja-swap',
        cardCategory: null,
        ability: 'greninja',
        targets: [{ seat: 'a', slots: [0, 1] }],
      },
    },
  ];
  const moved = observeMemory(memory, after, 'a', 'juewu');
  expect(moved.known.a![0]).toBeNull();
  expect(moved.known.a![1]!.abilityUsed).toBe(true);
  expect(moved.known.b!.every((known) => known === null)).toBe(true);
});

it.each(['default', 'doubao', 'juewu'] as const)(
  'keeps hidden exhausted identities outside %s decisions',
  (difficulty) => {
    const { state } = fixture();
    const context = { seats: ['a', 'b'], random: new RandomSource(913) };
    let playing = state;
    for (const seat of context.seats)
      playing = rules.apply(
        playing,
        { type: 'initial-flip', slot: 0 },
        seat,
        context,
      ).state;
    const slot = playing.boards.b![1]!;
    const index = playing.deck.findIndex((id) => card(id).ability !== null);
    expect(index).toBeGreaterThanOrEqual(0);
    [slot.instanceId, playing.deck[index]] = [
      playing.deck[index]!,
      slot.instanceId,
    ];
    const changed = structuredClone(playing);
    changed.usedAbilityIds = [slot.instanceId];
    const first = rules.project(playing, { role: 'player', seatId: 'a' });
    const second = rules.project(changed, { role: 'player', seatId: 'a' });
    expect(second).toEqual(first);
    const legal = rules.legalActions(playing, 'a');
    const decide = (view: typeof first) =>
      choose(
        view,
        legal,
        observeMemory(null, view, 'a', difficulty),
        difficulty,
        new RandomSource(914),
        new AbortController().signal,
      );
    expect(decide(second)).toEqual(decide(first));
  },
);
