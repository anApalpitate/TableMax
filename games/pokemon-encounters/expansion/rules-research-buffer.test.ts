import { describe, expect, it } from 'vitest';
import { pokemonExpansion as rules, createInitialState } from './index';
import type { State, Action } from './state';
import { researchDefinition, tasks } from './research';
import { scoreBoard } from './scoring';
import { victoryAward } from './research-rewards';
import { card, instancesForSeats } from './cards';

const contextFor = (count: number) => {
  let seed = 17;
  return {
    seats: Array.from({ length: count }, (_, i) => `s${i}`),
    random: {
      next: () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      },
    },
  };
};

describe('research and buffer rules profile', () => {
  it.each([2, 6])(
    'keeps all four unique gods at exactly one physical card for %i seats',
    (seats) => {
      const deck = instancesForSeats(seats);
      for (const id of ['arceus', 'groudon', 'kyogre', 'rayquaza'])
        expect(
          deck.filter(
            (instance) => card(instance).categoryId === `special-${id}`,
          ),
        ).toHaveLength(1);
      expect(deck).toHaveLength(seats < 4 ? 112 : 144);
    },
  );

  it('creates only the explicitly versioned profile with one empty buffer per seat', () => {
    const context = contextFor(2);
    const state = rules.initialize(context);
    expect(state).toMatchObject({
      rulesProfile: 'research-buffer-v2',
      buffersBySeat: { s0: null, s1: null },
    });
    expect(rules.validateState(structuredClone(state), context.seats)).toEqual(
      state,
    );
  });
});

function playing(
  profile: 'legacy' | 'research-buffer-v2' = 'research-buffer-v2',
) {
  const context = contextFor(2);
  let state = createInitialState(context, profile);
  for (const seat of context.seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      context,
    ).state;
  for (const seat of context.seats)
    state = rules.apply(
      state,
      { type: 'initial-flip', slot: 0 },
      seat,
      context,
    ).state;
  return { context, state };
}
function top(state: State, id: string) {
  const replacement = state.deck.at(-1)!;
  const deckIndex = state.deck.indexOf(id),
    discardIndex = state.discard.indexOf(id);
  if (deckIndex >= 0) state.deck[deckIndex] = replacement;
  else if (discardIndex >= 0) state.discard[discardIndex] = replacement;
  else {
    const found = state.seatOrder
      .flatMap((seat) => state.boards[seat]!)
      .find((cell) => cell.instanceId === id);
    if (!found) throw Error('Missing fixture');
    found.instanceId = replacement;
  }
  state.deck[state.deck.length - 1] = id;
}
const apply = (
  state: State,
  action: Action,
  context: ReturnType<typeof contextFor>,
  seat = state.turnSeat,
) => rules.apply(state, action, seat, context).state;
describe('public one-card buffer authority and persistence', () => {
  it('stores only a disposable held card, consumes the turn, and replays the same saved decision', () => {
    const { context, state } = playing();
    top(state, 'ordinary-1#01');
    const held = apply(state, { type: 'draw', source: 'deck' }, context),
      seat = held.turnSeat;
    const before = structuredClone(held);
    expect(rules.legalActions(held, seat)).toContainEqual({
      type: 'store-buffer',
    });
    const stored = apply(held, { type: 'store-buffer' }, context);
    expect(held).toEqual(before);
    expect(stored.buffersBySeat![seat]).toBe('ordinary-1#01');
    expect(stored.boards).toEqual(held.boards);
    expect(stored.discard).toEqual(held.discard);
    expect(stored.turnSeat).not.toBe(seat);
    expect(stored.held).toBeNull();
    expect(
      rules.validateState(JSON.parse(JSON.stringify(stored)), context.seats),
    ).toEqual(stored);
    const recovered = rules.validateState(
      JSON.parse(JSON.stringify(held)),
      context.seats,
    );
    expect(apply(recovered, { type: 'store-buffer' }, context)).toEqual(stored);
    for (const viewer of [
      {
        role: 'player' as const,
        seatId: context.seats.find((id) => id !== seat)!,
      },
      { role: 'public' as const },
      { role: 'player' as const, seatId: seat },
    ]) {
      const view = rules.project(stored, viewer);
      expect(view.buffersBySeat![seat]).toMatchObject({
        categoryId: 'ordinary-1',
        abilityUsed: false,
      });
      expect(JSON.stringify(view)).not.toContain('ordinary-1#01');
      expect(view.boards[seat]!.filter((c) => c.card === null)).toHaveLength(8);
    }
  });
  it('takes only the actor’s own buffer and must place it without discarding or restoring it', () => {
    const { context, state } = playing();
    top(state, 'ordinary-1#01');
    let next = apply(state, { type: 'draw', source: 'deck' }, context);
    const owner = next.turnSeat;
    next = apply(next, { type: 'store-buffer' }, context);
    expect(rules.legalActions(next, next.turnSeat)).not.toContainEqual({
      type: 'draw-buffer',
    });
    expect(() => apply(next, { type: 'draw-buffer' }, context)).toThrow(
      'Illegal',
    );
    next.turnSeat = owner;
    const taken = apply(next, { type: 'draw-buffer' }, context);
    expect(taken.buffersBySeat![owner]).toBeNull();
    expect(taken.drawSource).toBe('buffer');
    expect(taken.held).toBe('ordinary-1#01');
    expect(
      rules.legalActions(taken, owner).every((a) => a.type === 'replace'),
    ).toBe(true);
    expect(() => apply(taken, { type: 'store-buffer' }, context)).toThrow(
      'Illegal',
    );
    expect(() => apply(taken, { type: 'discard-held' }, context)).toThrow(
      'Illegal',
    );
    expect(() =>
      apply(
        taken,
        { type: 'replace', slot: 1 },
        context,
        next.seatOrder.find((s) => s !== owner)!,
      ),
    ).toThrow('Illegal');
    const placed = apply(taken, { type: 'replace', slot: 1 }, context);
    expect(placed.boards[owner]![1]).toEqual({
      instanceId: 'ordinary-1#01',
      faceUp: true,
    });
    expect(rules.validateState(placed, context.seats)).toEqual(placed);
  });
  it('retains active ability use marks and triggers an unused optional ability after buffer placement', () => {
    for (const used of [false, true]) {
      const { context, state } = playing();
      const id = 'special-charizard#01';
      top(state, id);
      if (used) state.usedAbilityIds!.push(id);
      let next = apply(state, { type: 'draw', source: 'deck' }, context);
      const owner = next.turnSeat;
      next = apply(next, { type: 'store-buffer' }, context);
      next.turnSeat = owner;
      expect(
        rules.project(next, { role: 'public' }).buffersBySeat![owner]!
          .abilityUsed,
      ).toBe(used);
      if (used) {
        const corrupted = structuredClone(next);
        delete corrupted.usedAbilityIds;
        delete corrupted.pendingAbility;
        expect(() => rules.validateState(corrupted, context.seats)).toThrow();
      }
      next = apply(next, { type: 'draw-buffer' }, context);
      next = apply(next, { type: 'replace', slot: 1 }, context);
      expect(next.phase).toBe(used ? 'draw' : 'charizard-choice');
      expect(next.usedAbilityIds!.includes(id)).toBe(used);
      expect(rules.validateState(next, context.seats)).toEqual(next);
    }
  });
  it.each(['legacy', 'research-buffer-v2'] as const)(
    '%s: permits a source-less legacy ability chain only in an old-profile round',
    (profile) => {
      const { context, state } = playing(profile);
      top(state, 'special-charizard#01');
      let next = apply(state, { type: 'draw', source: 'deck' }, context);
      next = apply(next, { type: 'replace', slot: 1 }, context);
      expect(next.phase).toBe('charizard-choice');
      expect(rules.validateState(next, context.seats)).toEqual(next);
      next.pendingAbility = {
        kind: 'legacy',
        ability: 'charizard',
        sourceInstanceId: null,
      };
      if (profile === 'research-buffer-v2') {
        expect(() => rules.validateState(next, context.seats)).toThrow();
        return;
      }
      const saved = structuredClone(next);
      next = rules.validateState(next, context.seats);
      expect(next).toEqual(saved);
      next = apply(next, { type: 'peek', slot: 2 }, context);
      next = apply(next, { type: 'close-peek' }, context);
      expect(next.usedAbilityIds).toEqual([]);
      expect(rules.validateState(next, context.seats)).toEqual(next);
      expect(saved.pendingAbility).toEqual({
        kind: 'legacy',
        ability: 'charizard',
        sourceInstanceId: null,
      });
    },
  );
  it('forbids storing discard takes but retains disposable Lucario extra cards', () => {
    const { context, state } = playing();
    let next = apply(
      state,
      { type: 'draw', source: 'discard', discardIndex: 0 },
      context,
    );
    expect(rules.legalActions(next, next.turnSeat)).not.toContainEqual({
      type: 'store-buffer',
    });
    const fresh = playing();
    top(fresh.state, 'special-lucario#01');
    next = apply(fresh.state, { type: 'draw', source: 'deck' }, fresh.context);
    next = apply(next, { type: 'replace', slot: 1 }, fresh.context);
    next = apply(next, { type: 'extra-draw' }, fresh.context);
    top(next, 'ordinary-1#01');
    next = apply(next, { type: 'draw', source: 'deck' }, fresh.context);
    expect(rules.legalActions(next, next.turnSeat)).toContainEqual({
      type: 'discard-held',
    });
    expect(rules.legalActions(next, next.turnSeat)).toContainEqual({
      type: 'store-buffer',
    });
    const owner = next.turnSeat;
    next = apply(next, { type: 'store-buffer' }, fresh.context);
    expect(next.buffersBySeat![owner]).toBe('ordinary-1#01');
    expect(rules.validateState(next, fresh.context.seats)).toEqual(next);
  });
  it('offers only the top discard and rejects shared-source and seat-injection shortcuts', () => {
    const { context, state } = playing();
    state.discard.unshift(state.deck.pop()!);
    const draws = rules
      .legalActions(state, state.turnSeat)
      .filter((a) => a.type === 'draw' && a.source === 'discard');
    expect(draws).toEqual([
      { type: 'draw', source: 'discard', discardIndex: 0 },
    ]);
    expect(
      rules.project(state, { role: 'public' }).discardOptions,
    ).toHaveLength(1);
    expect(() =>
      apply(
        state,
        { type: 'draw', source: 'discard', discardIndex: 1 },
        context,
      ),
    ).toThrow('Illegal');
    expect(() =>
      rules.validateAction({ type: 'draw', source: 'buffer' }),
    ).toThrow();
    expect(() =>
      rules.validateAction({ type: 'draw-buffer', seat: 's1' }),
    ).toThrow();
    expect(() =>
      rules.validateState({ ...state, rulesProfile: undefined }, context.seats),
    ).toThrow();
    const missingUsage = structuredClone(state);
    delete missingUsage.usedAbilityIds;
    delete missingUsage.pendingAbility;
    expect(() => rules.validateState(missingUsage, context.seats)).toThrow();
    expect(() =>
      rules.validateState(
        { ...state, buffersBySeat: { s0: state.deck[0], s1: null } },
        context.seats,
      ),
    ).toThrow();
  });
  it('does not permit storing a mandatory opponent exchange or relay card', () => {
    const { context, state } = playing();
    top(state, 'special-mew#01');
    let next = apply(state, { type: 'draw', source: 'deck' }, context);
    expect(next.phase).toBe('mew-other');
    expect(rules.legalActions(next, next.turnSeat)).not.toContainEqual({
      type: 'store-buffer',
    });
    next = apply(
      next,
      {
        type: 'mew-target',
        seat: next.seatOrder.find((s) => s !== next.turnSeat)!,
        slot: 1,
      },
      context,
    );
    expect(next.phase).toBe('mew-self');
    expect(
      rules
        .legalActions(next, next.turnSeat)
        .every((a) => a.type === 'replace'),
    ).toBe(true);
    expect(() => apply(next, { type: 'store-buffer' }, context)).toThrow(
      'Illegal',
    );
    const fresh = playing();
    top(fresh.state, 'special-zapdos#01');
    next = apply(fresh.state, { type: 'draw', source: 'deck' }, fresh.context);
    next = apply(
      next,
      { type: 'pass-direction', direction: 'clockwise' },
      fresh.context,
    );
    expect(
      rules
        .legalActions(next, next.turnSeat)
        .every((a) => a.type === 'replace'),
    ).toBe(true);
  });
  it('keeps the top discard and protected buffer while recycling only real discarded cards', () => {
    const { context, state } = playing();
    top(state, 'special-charizard#01');
    state.usedAbilityIds!.push('special-charizard#01');
    let next = apply(state, { type: 'draw', source: 'deck' }, context);
    const owner = next.turnSeat;
    next = apply(next, { type: 'store-buffer' }, context);
    next.discard.unshift(...next.deck);
    next.deck = [];
    const retainedTop = next.discard.at(-1);
    next = apply(next, { type: 'draw', source: 'deck' }, context);
    expect(next.discard).toEqual([retainedTop]);
    expect(next.buffersBySeat![owner]).toBe('special-charizard#01');
    expect(next.usedAbilityIds).toContain('special-charizard#01');
    expect(rules.validateState(next, context.seats)).toEqual(next);
  });
});

describe('new research risk, rewards and victory bounds', () => {
  const negative = [
    'ordinary-1#01',
    'ordinary-1#02',
    'ordinary-1#03',
    'ordinary-1#04',
    'ordinary-piplup#01',
    'ordinary-piplup#02',
    'ordinary-piplup#03',
    'ordinary-piplup#04',
    'ordinary-piplup#05',
  ];
  for (const task of tasks)
    it(`${task.id}: fixed inventory-valid success and failure, score and policy`, () => {
      const sample = researchDefinition(task.id).diagram.sample;
      for (const board of [sample.instances, negative])
        expect(board.every((id) => instancesForSeats(2).includes(id))).toBe(
          true,
        );
      const success = scoreBoard(sample.instances, [task.id], sample.preReveal),
        failure = scoreBoard(negative, [task.id]);
      expect(success.research[0]!.achieved).toBe(true);
      expect(failure.research[0]!.achieved).toBe(false);
      expect(success.victory).toEqual(task.successVictory);
      expect(failure.victory).toEqual(task.failureVictory);
      expect(failure.total - failure.base).toBe(task.failurePenalty);
      expect(Number.isFinite(success.total)).toBe(true);
      expect(success.total).toBeGreaterThanOrEqual(-180);
      expect(success.total).toBeLessThanOrEqual(108);
    });
  it('combines effects from the original base without scaling a prior task’s reward', () => {
    const sample = researchDefinition('H02').diagram.sample;
    const single = scoreBoard(sample.instances, ['H02'], sample.preReveal),
      second = scoreBoard(sample.instances, ['R05'], sample.preReveal),
      combined = scoreBoard(sample.instances, ['H02', 'R05'], sample.preReveal);
    expect(combined.base).toBe(single.base);
    expect(combined.deduction).toBe(single.deduction + second.deduction);
    expect(combined.values).toEqual(single.values);
  });
  it('caps new awards without ever removing existing wins, and grants extras only to winning seats', () => {
    expect(victoryAward(0, { bonus: 1, eligible: true, cap: 3 })).toBe(2);
    expect(victoryAward(2, { bonus: 1, eligible: true, cap: 3 })).toBe(1);
    expect(victoryAward(2, { bonus: 0, eligible: true, cap: 2 })).toBe(0);
    expect(victoryAward(3, { bonus: 0, eligible: true, cap: 2 })).toBe(0);
    expect(victoryAward(0, { bonus: 1, eligible: false, cap: 3 })).toBe(0);
  });
  it('allows obsolete physical god instances only in explicit legacy scoring', () => {
    const board = [...negative];
    board[0] = 'special-groudon#02';
    expect(() => scoreBoard(board)).toThrow('Invalid');
    expect(() =>
      scoreBoard(board, [], Array(9).fill(true), 'legacy'),
    ).not.toThrow();
  });
});

function endingFixture(
  own: readonly string[],
  other: readonly string[],
  opening: string,
  hoenn?: string,
  profile: 'legacy' | 'research-buffer-v2' = 'research-buffer-v2',
) {
  const { context, state } = playing(profile);
  const pool = instancesForSeats(2, profile);
  const take = (categoryOrId: string) => {
    const index = pool.findIndex((id) =>
      categoryOrId.startsWith('value:')
        ? card(id).value === Number(categoryOrId.slice(6))
        : categoryOrId.includes('#')
          ? id === categoryOrId
          : card(id).categoryId === categoryOrId,
    );
    if (index < 0)
      throw Error(`Impossible settlement fixture: ${categoryOrId}`);
    return pool.splice(index, 1)[0]!;
  };
  state.turnSeat = 's0';
  state.boards = {
    s0: own.map((id, i) => ({ instanceId: take(id), faceUp: i !== 8 })),
    s1: other.map((id, i) => ({ instanceId: take(id), faceUp: i < 3 })),
  };
  state.held = state.boards.s0![8]!.instanceId;
  state.boards.s0![8]!.instanceId = pool.pop()!;
  state.discard = [pool.pop()!];
  state.deck = pool;
  state.phase = 'place';
  state.drawSource = profile === 'legacy' ? 'discard' : 'buffer';
  state.pendingAbility = null;
  state.usedAbilityIds = [];
  state.researchCandidates = [
    opening,
    ...['R01', 'R02', 'R03', 'R04'].filter((id) => id !== opening).slice(0, 2),
  ];
  state.votesBySeat = { s0: opening, s1: opening };
  state.voteCounts = Object.fromEntries(
    state.researchCandidates.map((id) => [id, id === opening ? 2 : 0]),
  );
  state.activeResearch = [opening, ...(hoenn ? [hoenn] : [])];
  state.usedOpeningResearch = [opening];
  state.usedHoennResearch = hoenn ? [hoenn] : [];
  state.hoennTriggered = !!hoenn;
  state.hoennPending = null;
  state.preReveal = null;
  state.roundResult = null;
  state.matchWinners = [];
  state.events = [];
  state.eventCounter = 0;
  rules.validateState(state, context.seats);
  return { context, state };
}
describe('actual authoritative round settlement and legacy transition', () => {
  it('grants two co-winners bounded extra wins and allows joint match winners', () => {
    const own = researchDefinition('R03').diagram.sample.instances;
    const other = own.map((id) => `value:${card(id).value}`);
    const { context, state } = endingFixture(own, other, 'R03');
    state.winsBySeat = { s0: 1, s1: 1 };
    const result = apply(state, { type: 'replace', slot: 8 }, context);
    expect(result.roundResult!.winners).toEqual(['s0', 's1']);
    expect(result.roundResult!.awardsBySeat).toEqual({ s0: 2, s1: 2 });
    expect(result.winsBySeat).toEqual({ s0: 3, s1: 3 });
    expect(result.matchWinners).toEqual(['s0', 's1']);
    expect(rules.validateState(result, context.seats)).toEqual(result);
    expect(() =>
      rules.validateState(
        {
          ...result,
          roundResult: {
            ...result.roundResult,
            awardsBySeat: { s0: 3, s1: 2 },
          },
        },
        context.seats,
      ),
    ).toThrow();
  });
  it('preserves minimum-score winners with zero awards and a valid next-round starter', () => {
    const own = [
      'ordinary--2',
      'ordinary--2',
      'ordinary--2',
      'ordinary-mimikyu',
      'ordinary-mimikyu',
      'ordinary-mimikyu',
      'ordinary-mimikyu',
      'ordinary-0',
      'ordinary-1',
    ];
    const other = [
      'ordinary-8',
      'ordinary-9',
      'ordinary-metagross',
      'ordinary-garchomp',
      'ordinary-dragonite',
      'ordinary-gardevoir',
      'special-lucario',
      'ordinary-garchomp',
      'ordinary-9',
    ];
    const { context, state } = endingFixture(own, other, 'R01', 'H05');
    const result = apply(state, { type: 'replace', slot: 8 }, context);
    expect(result.roundResult!.winners).toEqual(['s0']);
    expect(result.roundResult!.awardsBySeat).toEqual({ s0: 0, s1: 0 });
    expect(result.winsBySeat).toEqual({ s0: 0, s1: 0 });
    expect(result.phase).toBe('round-result');
    expect(rules.validateState(result, context.seats)).toEqual(result);
    const next = rules.applyLifecycle!(result, { type: 'next-round' }, context)
      .state as State;
    expect(next.turnSeat).toBe('s0');
    expect(next.rulesProfile).toBe('research-buffer-v2');
    expect(rules.validateState(next, context.seats)).toEqual(next);
  });
  it('does not award bonus victory to an achieved but losing player', () => {
    const own = researchDefinition('R03').diagram.sample.instances;
    const other = [-2, -1, -2, 0, -2, -1, -1, -2, -2].map(
      (value) => `value:${value}`,
    );
    const { context, state } = endingFixture(own, other, 'R03');
    const result = apply(state, { type: 'replace', slot: 8 }, context);
    expect(result.roundResult!.scores.s0!.research[0]!.achieved).toBe(true);
    expect(result.roundResult!.winners).toEqual(['s1']);
    expect(result.roundResult!.awardsBySeat).toEqual({ s0: 0, s1: 1 });
    expect(rules.validateState(result, context.seats)).toEqual(result);
  });
  it('keeps a missing-profile old round unchanged and switches only on the next round', () => {
    const own = researchDefinition('R01', 'legacy').diagram.sample.instances;
    const other = [
      'ordinary-8',
      'ordinary-9',
      'ordinary-metagross',
      'ordinary-garchomp',
      'ordinary-dragonite',
      'ordinary-gardevoir',
      'special-lucario',
      'ordinary-garchomp',
      'ordinary-9',
    ];
    const { context, state } = endingFixture(
      own,
      other,
      'R01',
      undefined,
      'legacy',
    );
    expect(state.rulesProfile).toBeUndefined();
    expect(
      instancesForSeats(2, 'legacy').filter(
        (id) => card(id).ability === 'groudon',
      ),
    ).toHaveLength(2);
    expect(
      rules.project(state, { role: 'public' }).activeResearch[0]!.rewardText,
    ).toBeUndefined();
    const serialized = JSON.stringify(state);
    const loaded = rules.validateState(JSON.parse(serialized), context.seats);
    expect(JSON.stringify(loaded)).toBe(serialized);
    const result = apply(loaded, { type: 'replace', slot: 8 }, context);
    expect(result.roundResult!.scores.s0!.research[0]!.deduction).toBe(3);
    expect(result.roundResult!.awardsBySeat).toBeUndefined();
    expect(result.rulesProfile).toBeUndefined();
    const next = rules.applyLifecycle!(result, { type: 'next-round' }, context)
      .state as State;
    expect(next.rulesProfile).toBe('research-buffer-v2');
    expect(next.winsBySeat).toEqual(result.winsBySeat);
    expect(next.usedOpeningResearch).toEqual([]);
    expect(next.usedHoennResearch).toEqual([]);
    expect(next.buffersBySeat).toEqual({ s0: null, s1: null });
    expect(next.events.at(-1)!.text).toContain('启用新版');
    expect(rules.validateState(next, context.seats)).toEqual(next);
  });
});
