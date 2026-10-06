import { expect, it, vi } from 'vitest';
import { pokemonExpansion as rules } from '../index';
import { card, instancesForSeats } from '../cards';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import { observeMemory } from './memory';
import { choose } from './strategy';
import { createTactics, informationValue, type TacticalModel } from './tactics';
import { scoreBoard } from '../scoring';

function knownFixture() {
  const context = { seats: ['a', 'b'], random: new RandomSource(31) };
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
  state.boards.a = [
    'ordinary-4',
    'ordinary-5',
    'ordinary-6',
    'ordinary-7',
    'ordinary-8',
    'ordinary-9',
    'ordinary-rowlet',
    'ordinary-piplup',
    'ordinary-togepi',
  ].map((category) => ({ instanceId: take(category), faceUp: true }));
  state.boards.b = [
    'ordinary-magikarp',
    'ordinary-magikarp',
    'ordinary-magikarp',
    'ordinary-1',
    'ordinary-1',
    'ordinary-1',
    'ordinary-3',
    'ordinary-3',
    'ordinary-3',
  ].map((category) => ({ instanceId: take(category), faceUp: true }));
  state.held = null;
  state.discard = [take('ordinary-0')];
  state.deck = pool;
  state.initialDone = [...context.seats];
  state.turnSeat = 'a';
  state.phase = 'greninja-choice';
  state.drawSource = 'deck';
  state.activeResearch = ['R22'];
  state.researchCandidates = ['R22', 'R01', 'R02'];
  state.usedOpeningResearch = ['R22'];
  state.votesBySeat = { a: 'R22', b: 'R22' };
  state.voteCounts = { R22: 2, R01: 0, R02: 0 };
  state.winsBySeat = { a: 0, b: 2 };
  const known = rules.project(state, { role: 'player', seatId: 'a' });
  for (const slot of [3, 5, 8]) state.boards.a[slot]!.faceUp = false;
  state.boards.b[8]!.faceUp = false;
  rules.validateState(state, context.seats);
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const memory = observeMemory(
    observeMemory(null, known, 'a', 'juewu'),
    view,
    'a',
    'juewu',
  );
  return { state, context, view, memory };
}

it('juewu blocks the next actor’s public third-win closure instead of a score-neutral decline', () => {
  const { state, context, view, memory } = knownFixture();
  const actions = rules
    .legalActions(state, 'a')
    .filter(
      (a) =>
        a.type === 'decline-ability' ||
        (a.type === 'ninja-target' &&
          a.seat === 'b' &&
          a.a === 0 &&
          a.b === 1 &&
          !a.swap),
    );
  expect(actions).toHaveLength(2);
  const before = structuredClone({ state, view, memory, actions });
  const declined = rules.apply(
    state,
    { type: 'decline-ability' },
    'a',
    context,
  ).state;
  const drawn = rules.apply(
    declined,
    { type: 'draw', source: 'discard', discardIndex: 0 },
    'b',
    context,
  ).state;
  const lost = rules.apply(
    drawn,
    { type: 'replace', slot: 8 },
    'b',
    context,
  ).state;
  expect(lost.phase).toBe('match-result');
  expect(lost.matchWinners).toEqual(['b']);
  const action = choose(
    view,
    actions,
    memory,
    'juewu',
    { next: () => 0 },
    new AbortController().signal,
  );
  expect(action).toEqual({
    type: 'ninja-target',
    seat: 'b',
    a: 0,
    b: 1,
    swap: false,
  });
  const blocked = rules.apply(state, action, 'a', context).state;
  const retry = rules.apply(
    blocked,
    { type: 'draw', source: 'discard', discardIndex: 0 },
    'b',
    context,
  ).state;
  const safe = rules.apply(
    retry,
    { type: 'replace', slot: 8 },
    'b',
    context,
  ).state;
  expect(safe.phase).toBe('draw');
  expect({ state, view, memory, actions }).toEqual(before);
});

it('leaves the default and doubao neutral-decline policy intact in the same authorized threat', () => {
  const { state, view, memory } = knownFixture();
  const actions = rules
    .legalActions(state, 'a')
    .filter(
      (a) =>
        a.type === 'decline-ability' ||
        (a.type === 'ninja-target' &&
          a.seat === 'b' &&
          a.a === 0 &&
          a.b === 1 &&
          !a.swap),
    );
  for (const grade of ['default', 'doubao'] as const)
    expect(
      choose(
        view,
        actions,
        memory,
        grade,
        { next: () => 0 },
        new AbortController().signal,
      ),
    ).toEqual({ type: 'decline-ability' });
});

it('values an observation by the replacement it can improve, conditioning on the already visible incoming card', () => {
  const rows = [
    { observable: 'ordinary-0', revealed: 'ordinary-0', values: [0, 3] },
    { observable: 'ordinary-0', revealed: 'ordinary-9', values: [6, 1] },
  ];
  expect(informationValue(rows)).toBe(1.5);
  expect(
    informationValue(rows.map((row) => ({ ...row, revealed: 'known' }))),
  ).toBe(0);
  expect(
    informationValue(
      rows.map((row, index) => ({ ...row, observable: String(index) })),
    ),
  ).toBe(0);
  expect(rows[0]!.values).toEqual([0, 3]);
});

it('averages Lucario’s unknown extra deck chance before comparing it with a public zero', () => {
  const { state, view } = knownFixture();
  const take = (category: string) =>
    state.deck.find((id) => card(id).categoryId === category)!;
  const board = state.boards.a!.map((cell) => cell.instanceId);
  const outgoing = board[4]!;
  board[4] = take('special-lucario');
  const model: TacticalModel = {
    boards: { a: board, b: state.boards.b!.map((cell) => cell.instanceId) },
    up: {
      a: state.boards.a!.map((cell) => cell.faceUp),
      b: state.boards.b!.map((cell) => cell.faceUp),
    },
    pool: [take('ordinary-garchomp'), take('ordinary--2')],
    discards: [outgoing, state.discard[0]!],
    held: null,
  };
  const score = (board: string[]) =>
    board.reduce((sum, id) => sum + card(id).value!, 0);
  const value = (model: TacticalModel) => score(model.boards.a!);
  const tactics = createTactics(view, 'a', score, value, 0);
  // Current 45. Blind deck expectation averages 33 and 45 => 39;
  // the public zero is 35, rather than the clairvoyant deck minimum 33.
  expect(value(model)).toBe(45);
  expect(tactics.afterPlacement(model, board[4]!)).toBe(35);
  expect(
    tactics.afterPlacement(
      { ...model, pool: [...model.pool].reverse() },
      board[4]!,
    ),
  ).toBe(35);
});

it('juewu chooses a useful private edge instead of always preferring the center', () => {
  const { state, context } = knownFixture();
  const available = [
    ...state.deck,
    ...state.discard,
    ...state.boards.a!.map((cell) => cell.instanceId),
  ];
  const take = (category: string) => {
    const index = available.findIndex((id) => card(id).categoryId === category);
    expect(index).toBeGreaterThanOrEqual(0);
    return available.splice(index, 1)[0]!;
  };
  state.boards.a = [
    'ordinary-0',
    'ordinary-9',
    'ordinary-0',
    'ordinary-4',
    'ordinary-6',
    'ordinary-5',
    'ordinary-7',
    'ordinary-8',
    'special-charizard',
  ].map((category) => ({ instanceId: take(category), faceUp: true }));
  state.deck = available;
  state.discard = [];
  state.phase = 'charizard-choice';
  state.boards.a[1]!.faceUp = false;
  state.boards.a[4]!.faceUp = false;
  rules.validateState(state, context.seats);
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const memory = observeMemory(null, view, 'a', 'juewu');
  const actions = rules.legalActions(state, 'a');
  expect(
    choose(
      view,
      actions,
      memory,
      'doubao',
      new RandomSource(3),
      new AbortController().signal,
    ),
  ).toEqual({ type: 'peek', slot: 4 });
  expect(
    choose(
      view,
      actions,
      memory,
      'juewu',
      new RandomSource(3),
      new AbortController().signal,
    ),
  ).toEqual({ type: 'peek', slot: 1 });
});

it('matches the authoritative Snorlax replacement and complete optional swap before settlement', () => {
  const { state, context } = knownFixture();
  const available = [
    ...state.deck,
    ...state.boards.a!.map((cell) => cell.instanceId),
  ];
  state.boards.a = [
    'ordinary-metagross',
    'ordinary-4',
    'ordinary-metagross',
    'ordinary-5',
    'ordinary-6',
    'ordinary-7',
    'ordinary-8',
    'ordinary-9',
    'ordinary-togepi',
  ].map((category) => {
    const index = available.findIndex((id) => card(id).categoryId === category);
    expect(index).toBeGreaterThanOrEqual(0);
    return { instanceId: available.splice(index, 1)[0]!, faceUp: true };
  });
  state.boards.a[8]!.faceUp = false;
  state.deck = available;
  const index = state.deck.findIndex((id) => card(id).ability === 'snorlax');
  state.held = state.deck.splice(index, 1)[0]!;
  state.phase = 'place';
  state.drawSource = 'discard';
  rules.validateState(state, context.seats);
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const model: TacticalModel = {
    boards: Object.fromEntries(
      context.seats.map((seat) => [
        seat,
        state.boards[seat]!.map((cell) => cell.instanceId),
      ]),
    ),
    up: Object.fromEntries(
      context.seats.map((seat) => [
        seat,
        state.boards[seat]!.map((cell) => cell.faceUp),
      ]),
    ),
    pool: state.deck,
    discards: [...state.discard].reverse().slice(0, 2),
    held: state.held,
  };
  const score = (board: string[], up: boolean[]) =>
    scoreBoard(
      board,
      view.activeResearch.map((task) => task.id),
      up,
    ).total;
  const value = (model: TacticalModel) => score(model.boards.a!, model.up.a!);
  const tactics = createTactics(view, 'a', score, value, 0);
  const placed = rules.apply(
    state,
    { type: 'replace', slot: 8 },
    'a',
    context,
  ).state;
  expect(placed.phase).toBe('snorlax-choice');
  const outcomes = rules
    .legalActions(placed, 'a')
    .map((action) => rules.apply(placed, action, 'a', context).state);
  const actual = Math.min(
    ...outcomes.map((end) =>
      score(
        end.boards.a!.map((cell) => cell.instanceId),
        end.preReveal?.a ?? end.boards.a!.map((cell) => cell.faceUp),
      ),
    ),
  );
  const preview = {
    ...model,
    boards: {
      ...model.boards,
      a: placed.boards.a!.map((cell) => cell.instanceId),
    },
    up: { ...model.up, a: placed.boards.a!.map((cell) => cell.faceUp) },
    held: null,
  };
  expect(tactics.afterPlacement(preview, state.held!)).toBe(actual);
  expect(actual).toBeLessThan(value(preview));
});

it('juewu takes Snorlax for its complete swap chain when the old ordinary-card policy takes zero', () => {
  const { state, context } = knownFixture();
  const available = [
    ...state.deck,
    ...state.boards.a!.map((cell) => cell.instanceId),
  ];
  const take = (category: string) => {
    const index = available.findIndex((id) => card(id).categoryId === category);
    expect(index).toBeGreaterThanOrEqual(0);
    return available.splice(index, 1)[0]!;
  };
  state.boards.a = [
    'ordinary-metagross',
    'ordinary-4',
    'ordinary-5',
    'ordinary-6',
    'ordinary-7',
    'ordinary-metagross',
    'ordinary-8',
    'ordinary-9',
    'ordinary-togepi',
  ].map((category) => ({ instanceId: take(category), faceUp: true }));
  state.discard.push(take('special-snorlax'));
  state.deck = available;
  state.phase = 'draw';
  state.winsBySeat = { a: 0, b: 0 };
  const known = rules.project(state, { role: 'player', seatId: 'a' });
  state.boards.a[8]!.faceUp = false;
  rules.validateState(state, context.seats);
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  const memory = observeMemory(
    observeMemory(null, known, 'a', 'juewu'),
    view,
    'a',
    'juewu',
  );
  const actions = rules
    .legalActions(state, 'a')
    .filter((action) => action.type === 'draw' && action.source === 'discard');
  expect(actions).toHaveLength(2);
  expect(
    choose(
      view,
      actions,
      memory,
      'doubao',
      { next: () => 0 },
      new AbortController().signal,
    ),
  ).toEqual({ type: 'draw', source: 'discard', discardIndex: 1 });
  expect(
    choose(
      view,
      actions,
      memory,
      'juewu',
      { next: () => 0 },
      new AbortController().signal,
    ),
  ).toEqual({ type: 'draw', source: 'discard', discardIndex: 0 });
  const score = (end: typeof state) =>
    scoreBoard(
      end.boards.a!.map((cell) => cell.instanceId),
      end.activeResearch,
      end.preReveal?.a ?? end.boards.a!.map((cell) => cell.faceUp),
    ).total;
  const drawValue = (discardIndex: 0 | 1) => {
    const drawn = rules.apply(
      state,
      { type: 'draw', source: 'discard', discardIndex },
      'a',
      context,
    ).state;
    return Math.min(
      ...rules.legalActions(drawn, 'a').flatMap((action) => {
        const placed = rules.apply(drawn, action, 'a', context).state;
        return placed.phase === 'snorlax-choice'
          ? rules
              .legalActions(placed, 'a')
              .map((next) =>
                score(rules.apply(placed, next, 'a', context).state),
              )
          : [score(placed)];
      }),
    );
  };
  expect(drawValue(0)).toBeLessThan(drawValue(1));
});

it('finishes the first shared tactical batch and returns its best legal action after the soft deadline', () => {
  const { state, view, memory } = knownFixture();
  const actions = rules
    .legalActions(state, 'a')
    .filter(
      (a) =>
        a.type === 'decline-ability' ||
        (a.type === 'ninja-target' &&
          a.seat === 'b' &&
          a.a === 0 &&
          a.b === 1 &&
          !a.swap),
    );
  const clock = vi
    .spyOn(performance, 'now')
    .mockReturnValueOnce(0)
    .mockReturnValue(1000);
  try {
    const random = { next: vi.fn(() => 0) };
    const action = choose(
      view,
      [...actions].reverse(),
      memory,
      'juewu',
      random,
      new AbortController().signal,
    );
    expect(action).toEqual({
      type: 'ninja-target',
      seat: 'b',
      a: 0,
      b: 1,
      swap: false,
    });
    expect(actions).toContainEqual(action);
    expect(random.next.mock.calls.length).toBeLessThan(112);
  } finally {
    clock.mockRestore();
  }
});

it('keeps the new tactical choices independent of hidden real identities and deck order', () => {
  const { state, context, view, memory } = knownFixture();
  const changed = structuredClone(state);
  changed.deck.reverse();
  // Unknown real identities may differ; authorized views and retained knowledge
  // are the only strategy input and are intentionally the same here.
  const changedView = rules.project(changed, { role: 'player', seatId: 'a' });
  expect(changedView).toEqual(view);
  const actions = rules.legalActions(state, 'a');
  const before = structuredClone({ view, memory, actions });
  const chooseAction = (authorized: typeof view) =>
    choose(
      authorized,
      actions,
      memory,
      'juewu',
      new RandomSource(32),
      new AbortController().signal,
    );
  expect(chooseAction(view)).toEqual(chooseAction(changedView));
  expect({ view, memory, actions }).toEqual(before);
  rules.validateState(changed, context.seats);
});

it.each(['snorlax', 'greninja', 'mewtwo', 'lucario'] as const)(
  'keeps a six-player public %s tactical decision inside the existing hard budget',
  (ability) => {
    const context = {
      seats: ['a', 'b', 'c', 'd', 'e', 'f'],
      random: new RandomSource(77),
    };
    let state = rules.initialize(context);
    for (const seat of context.seats)
      state = rules.apply(
        state,
        { type: 'vote-research', taskId: state.researchCandidates[0]! },
        seat,
        context,
      ).state;
    const index = state.deck.findIndex((id) => card(id).ability === ability);
    expect(index).toBeGreaterThanOrEqual(0);
    const top = state.discard.length - 1;
    [state.deck[index], state.discard[top]] = [
      state.discard[top]!,
      state.deck[index]!,
    ];
    for (const seat of context.seats)
      for (const [slot, cell] of state.boards[seat]!.entries())
        cell.faceUp = slot !== 8;
    state.phase = 'draw';
    state.initialDone = [...context.seats];
    state.turnSeat = 'a';
    state.winsBySeat.b = 2;
    rules.validateState(state, context.seats);
    const view = rules.project(state, { role: 'player', seatId: 'a' });
    const memory = observeMemory(null, view, 'a', 'juewu');
    const actions = rules.legalActions(state, 'a');
    const start = performance.now();
    const action = choose(
      view,
      actions,
      memory,
      'juewu',
      new RandomSource(32),
      new AbortController().signal,
    );
    expect(performance.now() - start).toBeLessThan(1800);
    expect(actions).toContainEqual(action);
  },
);
