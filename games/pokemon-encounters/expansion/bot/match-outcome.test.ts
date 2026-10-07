import {
  legacyRules as rules,
  legacyInstances as instancesForSeats,
} from '../legacy-test';
import { expect, it } from 'vitest';

import { card } from '../cards';
import { observeMemory } from './memory';
import { choose } from './strategy';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import type { BotDifficulty } from '@tablemax/game-sdk';

function fixture(
  players: 2 | 4,
  opponentWins = false,
  sharedWin = false,
  ownWins = 2,
) {
  const seats = Array.from({ length: players }, (_, i) => `s${i}`);
  const context = { seats, random: new RandomSource(1060401) };
  let state = rules.initialize(context);
  for (const seat of seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      context,
    ).state;
  const pool = instancesForSeats(players);
  const take = (category: string) => {
    const index = pool.findIndex((id) => card(id).categoryId === category);
    expect(index).toBeGreaterThanOrEqual(0);
    return pool.splice(index, 1)[0]!;
  };
  const own = opponentWins
    ? [
        'ordinary-4',
        'ordinary-5',
        'ordinary-6',
        'ordinary-7',
        'ordinary-8',
        'ordinary-9',
        'ordinary-rowlet',
        'ordinary-piplup',
        'ordinary-togepi',
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
  state.boards.s0 = own.map((category) => ({
    instanceId: take(category),
    faceUp: true,
  }));
  for (let i = 1; i < players; i++) {
    const high = i === 3 ? 'special-groudon' : 'special-team-rocket';
    const ten = i === 3 ? 'special-zapdos' : 'ordinary-metagross';
    const nine = i === 3 ? 'ordinary-9' : 'ordinary-dragonite';
    const categories =
      opponentWins && i === 1
        ? [
            'ordinary-magikarp',
            'ordinary-magikarp',
            'ordinary-magikarp',
            'ordinary-1',
            'ordinary-1',
            'ordinary-1',
            'ordinary-3',
            'ordinary-3',
            'ordinary-3',
          ]
        : sharedWin
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
              high,
              'ordinary-garchomp',
              ten,
              nine,
              high,
              'ordinary-garchomp',
              ten,
              nine,
              ten,
            ];
    state.boards[seats[i]!] = categories.map((category) => ({
      instanceId: take(category),
      faceUp: true,
    }));
  }
  state.held = take('ordinary-0');
  state.deck = pool;
  state.discard = [];
  state.phase = 'place';
  state.drawSource = 'discard';
  state.turnSeat = 's0';
  state.initialDone = [...seats];
  state.researchCandidates = ['R22', 'R01', 'R02'];
  state.activeResearch = ['R22'];
  state.usedOpeningResearch = ['R22'];
  state.votesBySeat = Object.fromEntries(seats.map((seat) => [seat, 'R22']));
  state.voteCounts = { R22: players, R01: 0, R02: 0 };
  state.winsBySeat = Object.fromEntries(
    seats.map((seat) => [
      seat,
      opponentWins
        ? seat === 's1'
          ? 2
          : 0
        : seat === 's0'
          ? ownWins
          : sharedWin
            ? 2
            : 0,
    ]),
  );
  // Controlled legal knowledge: all identities were publicly known before a cover.
  // No real hidden field or deck is passed into the strategy.
  const knownView = rules.project(state, { role: 'player', seatId: 's0' });
  for (const seat of seats) state.boards[seat]![4]!.faceUp = false;
  rules.validateState(state, seats);
  const view = rules.project(state, { role: 'player', seatId: 's0' });
  const actions = rules.legalActions(state, 's0');
  const decide = (
    difficulty: BotDifficulty,
    reversed = false,
    late = false,
  ) => {
    const memory = observeMemory(
      observeMemory(null, knownView, 's0', difficulty),
      view,
      's0',
      difficulty,
    );
    if (late) memory.turn = 100;
    return choose(
      view,
      reversed ? [...actions].reverse() : actions,
      memory,
      difficulty,
      { next: () => 0 },
      new AbortController().signal,
    );
  };
  const apply = (action: (typeof actions)[number]) =>
    rules.validateState(
      rules.apply(state, action, 's0', {
        ...context,
        random: new RandomSource(context.random.state),
      }).state,
      seats,
    );
  return { state, view, actions, decide, apply };
}

it.each([2, 4] as const)(
  'takes the proven third win instead of preserving zero lines: %i players',
  (players) => {
    const setup = fixture(players);
    const before = structuredClone({
      state: setup.state,
      view: setup.view,
      actions: setup.actions,
    });
    const winning = setup.apply({ type: 'replace', slot: 4 });
    expect(winning.phase).toBe('match-result');
    expect(winning.matchWinners).toEqual(['s0']);
    expect(winning.roundResult!.scores.s0!.total).toBe(74);
    expect(winning.roundResult!.scores.s1!.total).toBe(94);
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      expect(setup.decide(difficulty)).toEqual({ type: 'replace', slot: 4 });
      expect(setup.decide(difficulty, true)).toEqual({
        type: 'replace',
        slot: 4,
      });
    }
    expect({
      state: setup.state,
      view: setup.view,
      actions: setup.actions,
    }).toEqual(before);
  },
);

it('does not let long-round urgency erase an opponent third-win loss', () => {
  const setup = fixture(2, true);
  const losing = setup.apply({ type: 'replace', slot: 4 });
  expect(losing.phase).toBe('match-result');
  expect(losing.matchWinners).toEqual(['s1']);
  for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
    const chosen = setup.decide(difficulty, false, true);
    expect(chosen).not.toEqual({ type: 'replace', slot: 4 });
    expect(setup.apply(chosen).phase).toBe('draw');
  }
});

it('counts a shared third win as a completed match win', () => {
  const setup = fixture(2, false, true);
  const winning = setup.apply({ type: 'replace', slot: 4 });
  expect(winning.matchWinners).toEqual(['s0', 's1']);
  for (const difficulty of ['default', 'doubao', 'juewu'] as const)
    expect(setup.decide(difficulty)).toEqual({ type: 'replace', slot: 4 });
});

it('keeps ordinary round improvement distinct from a third-win outcome', () => {
  const setup = fixture(2, false, false, 1);
  expect(setup.apply({ type: 'replace', slot: 4 }).phase).toBe('round-result');
  for (const difficulty of ['default', 'doubao', 'juewu'] as const)
    expect(setup.decide(difficulty)).toEqual({ type: 'replace', slot: 6 });
});
