import { expect, it } from 'vitest';
import { pokemonExpansion as rules } from '../index';
import { card, instancesForSeats } from '../cards';
import { scoreBoard } from '../scoring';
import { refineForecast } from './strategy';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import type { Action } from '../state';

function fixture(kind: 'win' | 'loss' | 'shared' | 'shadowed', ownWins = 2) {
  const seats = kind === 'shadowed' ? ['s0', 's1', 's2', 's3'] : ['s0', 's1'];
  const context = { seats, random: new RandomSource(1080801) };
  let state = rules.initialize(context);
  for (const seat of seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      context,
    ).state;
  const pool = instancesForSeats(seats.length);
  const take = (category: string) => {
    const index = pool.findIndex((id) => card(id).categoryId === category);
    expect(index).toBeGreaterThanOrEqual(0);
    return pool.splice(index, 1)[0]!;
  };
  const own =
    kind === 'loss'
      ? [
          'ordinary-0',
          'ordinary-0',
          'ordinary-0',
          'ordinary-magikarp',
          'special-team-rocket',
          'ordinary-magikarp',
          'ordinary-magikarp',
          'ordinary-magikarp',
          'ordinary--2',
        ]
      : [
          'special-charizard',
          'special-charizard',
          'ordinary-5',
          'special-charizard',
          'special-charizard',
          'special-lucario',
          'ordinary-dragonite',
          'special-lucario',
          'special-lucario',
        ];
  const other =
    kind === 'loss'
      ? [
          'ordinary--2',
          'ordinary-mimikyu',
          'special-arceus',
          'ordinary-4',
          'ordinary-4',
          'ordinary-4',
          'ordinary-6',
          'ordinary-6',
          'ordinary-6',
        ]
      : kind === 'shared'
        ? [
            'ordinary-metagross',
            'ordinary-metagross',
            'ordinary-5',
            'ordinary-metagross',
            'ordinary-0',
            'ordinary-metagross',
            'ordinary-dragonite',
            'ordinary-metagross',
            'special-zapdos',
          ]
        : [
            'special-team-rocket',
            'ordinary-garchomp',
            'ordinary-metagross',
            'ordinary-dragonite',
            'special-team-rocket',
            'ordinary-garchomp',
            'ordinary-metagross',
            'ordinary-dragonite',
            'ordinary-metagross',
          ];
  for (const [seat, categories] of [
    ['s0', own],
    ['s1', other],
  ] as const)
    state.boards[seat] = categories.map((category) => ({
      instanceId: take(category),
      faceUp: true,
    }));
  if (kind === 'shadowed') {
    state.boards.s2 = [
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
    state.boards.s3 = [
      'special-groudon',
      'ordinary-garchomp',
      'special-zapdos',
      'ordinary-9',
      'special-groudon',
      'ordinary-garchomp',
      'special-zapdos',
      'ordinary-9',
      'special-zapdos',
    ].map((category) => ({ instanceId: take(category), faceUp: true }));
  }
  const incoming = take(kind === 'loss' ? 'ordinary-togepi' : 'ordinary-0');
  state.deck = [...pool, incoming];
  state.discard = [];
  state.held = null;
  state.drawSource = null;
  state.phase = 'draw';
  state.turnSeat = 's0';
  state.initialDone = [...seats];
  state.researchCandidates = ['R22', 'R01', 'R02'];
  state.activeResearch = ['R22'];
  state.usedOpeningResearch = ['R22'];
  state.votesBySeat = Object.fromEntries(seats.map((seat) => [seat, 'R22']));
  state.voteCounts = { R22: seats.length, R01: 0, R02: 0 };
  state.winsBySeat = Object.fromEntries(
    seats.map((seat) => [
      seat,
      seat === 's0'
        ? kind === 'loss'
          ? 0
          : ownWins
        : seat === 's2' ||
            (seat === 's1' && (kind === 'loss' || kind === 'shared'))
          ? 2
          : 0,
    ]),
  );
  // A complete authorized hypothesis; identities can be remembered from public
  // appearances before a cover. It is not a claim that an unseen deck is known.
  for (const seat of seats) state.boards[seat]![4]!.faceUp = false;
  rules.validateState(state, seats);
  const hypothesis = {
    board: state.boards.s0!.map((c) => c.instanceId),
    up: state.boards.s0!.map((c) => c.faceUp),
    pool: [...state.deck],
    discards: [],
    matchContext: {
      seat: 's0',
      winsBySeat: { ...state.winsBySeat },
      opponentScores: Object.fromEntries(
        seats.slice(1).map((seat) => [
          seat,
          scoreBoard(
            state.boards[seat]!.map((c) => c.instanceId),
            ['R22'],
            state.boards[seat]!.map((c) => c.faceUp),
          ).total,
        ]),
      ),
    },
  };
  const action: Action = { type: 'reposition', a: 0, b: 1 };
  // Validate the actual future: opponent repositions without consuming a card,
  // then the actor takes this ordinary card and chooses a replacement.
  let future = rules.apply(state, action, 's0', context).state;
  for (const seat of seats.slice(1))
    future = rules.apply(
      future,
      { type: 'reposition', a: 3, b: 5 },
      seat,
      context,
    ).state;
  future = rules.apply(
    future,
    { type: 'draw', source: 'deck' },
    's0',
    context,
  ).state;
  expect(future.held).toBe(incoming);
  expect(future.phase).toBe('place');
  const replace = (slot: number) =>
    rules.validateState(
      rules.apply(future, { type: 'replace', slot }, 's0', context).state,
      seats,
    );
  const refine = () =>
    refineForecast(
      [{ action, value: 30 }],
      [hypothesis],
      ['R22'],
      1,
      () => true,
    );
  return { state, hypothesis, action, replace, refine };
}

it('values a legal future third win even though its field score is higher', () => {
  const setup = fixture('win');
  const winning = setup.replace(4),
    lowerScore = setup.replace(6);
  expect(winning.phase).toBe('match-result');
  expect(winning.matchWinners).toEqual(['s0']);
  expect(winning.roundResult!.scores.s0!.total).toBe(74);
  expect(winning.roundResult!.scores.s1!.total).toBe(94);
  expect(lowerScore.phase).toBe('draw');
  expect(
    scoreBoard(
      lowerScore.boards.s0!.map((c) => c.instanceId),
      ['R22'],
    ).total,
  ).toBe(5);
  expect(setup.refine()[0]!.value).toBeLessThan(10);
});

it('does not reward a future point reduction that ends an opponent third win', () => {
  const setup = fixture('loss');
  const losing = setup.replace(4),
    continuing = setup.replace(0);
  expect(losing.phase).toBe('match-result');
  expect(losing.matchWinners).toEqual(['s1']);
  expect(losing.roundResult!.scores.s0!.total).toBe(-3);
  expect(losing.roundResult!.scores.s1!.total).toBe(-4);
  expect(continuing.phase).toBe('draw');
  expect(setup.refine()[0]!.value).toBeGreaterThan(29.5);
});

it('counts a legal shared future third win as the actor winning', () => {
  const setup = fixture('shared');
  expect(setup.replace(4).matchWinners).toEqual(['s0', 's1']);
  expect(setup.refine()[0]!.value).toBeLessThan(10);
});

it('uses the whole sampled table rather than only the first opponent', () => {
  const setup = fixture('shadowed');
  const closed = setup.replace(4);
  expect(closed.matchWinners).toEqual(['s2']);
  expect(closed.roundResult!.scores.s0!.total).toBe(74);
  expect(closed.roundResult!.scores.s1!.total).toBe(94);
  expect(closed.roundResult!.scores.s2!.total).toBe(0);
  expect(setup.refine()[0]!.value).toBeCloseTo(28.92);
});

it('keeps a non-match-closing ordinary horizon and input data unchanged', () => {
  const setup = fixture('win', 1);
  expect(setup.replace(4).phase).toBe('round-result');
  const before = structuredClone(setup.hypothesis);
  const withoutContext = {
    board: setup.hypothesis.board,
    up: setup.hypothesis.up,
    pool: setup.hypothesis.pool,
    discards: [],
  };
  const legacy = refineForecast(
    [{ action: setup.action, value: 30 }],
    [withoutContext],
    ['R22'],
    1,
    () => true,
  );
  expect(setup.refine()).toEqual(legacy);
  expect(setup.hypothesis).toEqual(before);
  expect(
    refineForecast(
      [{ action: setup.action, value: 30 }],
      [setup.hypothesis],
      ['R22'],
      2,
      () => false,
    ),
  ).toEqual([{ action: setup.action, value: 30 }]);
});
