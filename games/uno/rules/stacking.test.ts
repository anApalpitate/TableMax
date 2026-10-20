import { describe, expect, it } from 'vitest';
import type { Action } from '../types';
import { CARD_IDS } from '../data/catalog';
import {
  rules,
  legalActions,
  isLegalAction,
  project,
  validateState,
  initialize,
} from './index';
import { context, fixture } from './test-fixtures';
import type { State } from './state';

function stacked(hands: Record<string, string[]>, top = 'red-5-a'): State {
  return {
    ...fixture(hands, top),
    setup: { drawPenaltyStacking: true, catchUnoDelayMs: 500 },
    drawPenalty: null,
  };
}
function apply(state: State, action: Action, seat = state.turnSeat!): State {
  const result = rules.apply(state, action, seat, context(41, state.seats))
    .state as State;
  expect(validateState(result, state.seats)).toEqual(result);
  return result;
}
function restore(state: State): State {
  const bytes = JSON.stringify(state);
  const restored = validateState(JSON.parse(bytes), state.seats);
  expect(JSON.stringify(restored)).toBe(bytes);
  return restored;
}
const base = () =>
  stacked({
    a: ['red-draw-two-a', 'yellow-2-a'],
    b: ['blue-draw-two-a', 'wild-draw-four-1', 'blue-1-a'],
    c: ['green-draw-two-a', 'green-1-a'],
  });

describe('UNO optional draw penalty transfer', () => {
  it('allows only +4 after a pending +4, with every color choice, while disabled and legacy games stay classic', () => {
    const hands = {
      a: ['wild-draw-four-1', 'yellow-2-a'],
      b: ['wild-draw-four-2', 'blue-draw-two-a', 'blue-1-a'],
      c: ['green-1-a'],
    };
    const state = apply(stacked(hands), {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'green',
    });
    expect(legalActions(state, 'b').filter((a) => a.type === 'play')).toEqual(
      ['red', 'yellow', 'green', 'blue'].map((color) => ({
        type: 'play',
        cardId: 'wild-draw-four-2',
        color,
      })),
    );
    for (const action of [
      { type: 'play', cardId: 'blue-draw-two-a' },
      { type: 'play', cardId: 'blue-1-a' },
      { type: 'draw' },
    ])
      expect(isLegalAction(state, action, 'b')).toBe(false);
    for (const setup of [
      undefined,
      { drawPenaltyStacking: false, catchUnoDelayMs: 500 },
    ]) {
      const classic = apply(
        {
          ...fixture(hands),
          ...(setup ? { setup } : {}),
        },
        { type: 'play', cardId: 'wild-draw-four-1', color: 'green' },
      );
      expect(
        legalActions(classic, 'b').filter((a) => a.type === 'play'),
      ).toEqual([]);
      expect(classic).not.toHaveProperty('drawPenalty');
      expect(restore(classic)).toEqual(classic);
    }
  });
  it.each([1, -1] as const)(
    'restores each step of all four +4 cards in direction %s and accepts the full 16-card penalty',
    (direction) => {
      let state = stacked({
        a: ['wild-draw-four-1', 'yellow-1-a'],
        b: ['wild-draw-four-2', 'blue-1-a'],
        c: ['wild-draw-four-3', 'green-1-a'],
        d: ['wild-draw-four-4', 'red-1-a'],
      });
      state.direction = direction;
      const order =
        direction === 1 ? ['a', 'b', 'c', 'd'] : ['a', 'd', 'c', 'b'];
      const colors = ['blue', 'green', 'red', 'yellow'] as const;
      let previousColor = state.activeColor;
      for (const [index, seat] of order.entries()) {
        const cardId = state.hands[seat]![0]!;
        state = restore(
          apply(state, { type: 'play', cardId, color: colors[index]! }),
        );
        expect(state.drawPenalty).toEqual({
          count: (index + 1) * 4,
          kind: 'wild-draw-four',
        });
        expect(state.drawFour).toMatchObject({
          offender: seat,
          target: order[(index + 1) % order.length],
          previousColor,
          chosenColor: colors[index],
          evidenceIds: state.hands[seat],
        });
        previousColor = colors[index]!;
      }
      expect(state.turnSeat).toBe('a');
      const before = state.hands.a!.length;
      state = apply(state, { type: 'accept-draw-four' });
      expect(state.hands.a).toHaveLength(before + 16);
      expect(state.latest!.drawCount).toBe(16);
      expect(state.turnSeat).toBe(order[1]);
      expect(state.drawFour).toBeNull();
      expect(state.drawPenalty).toBeNull();
    },
  );
  it.each([false, true])(
    'challenges only the newest +4 after +2/+4/+4 when the newest sender guilt is %s',
    (guilty) => {
      let state = stacked({
        a: ['red-draw-two-a', 'yellow-2-a'],
        b: ['wild-draw-four-1', 'red-1-a'],
        c: ['wild-draw-four-2', guilty ? 'blue-1-a' : 'green-1-a'],
        d: ['yellow-1-a'],
      });
      state = apply(state, { type: 'play', cardId: 'red-draw-two-a' });
      state = apply(state, {
        type: 'play',
        cardId: 'wild-draw-four-1',
        color: 'blue',
      });
      expect(state.drawFour!.guilty).toBe(true);
      state = restore(
        apply(state, {
          type: 'play',
          cardId: 'wild-draw-four-2',
          color: 'yellow',
        }),
      );
      expect(state.drawPenalty!.count).toBe(10);
      expect(state.drawFour).toEqual({
        offender: 'c',
        target: 'd',
        previousColor: 'blue',
        chosenColor: 'yellow',
        evidenceIds: guilty ? ['blue-1-a'] : ['green-1-a'],
        guilty,
      });
      const challenged = apply(state, { type: 'challenge-draw-four' });
      expect(challenged.hands.b).toEqual(['red-1-a']);
      expect(challenged.hands.c).toHaveLength(guilty ? 11 : 1);
      expect(challenged.hands.d).toHaveLength(guilty ? 1 : 13);
      expect(challenged.latest!.drawCount).toBe(guilty ? 10 : 12);
      expect(challenged.turnSeat).toBe(guilty ? 'd' : 'a');
      expect(challenged.activeColor).toBe('yellow');
      expect(challenged.drawPenalty).toBeNull();
      expect(
        project(challenged, {
          role: 'player',
          seatId: 'd',
        }).self!.challengeEvidence?.cards.map((card) => card.id),
      ).toEqual(guilty ? ['blue-1-a'] : ['green-1-a']);
      expect(
        project(challenged, { role: 'player', seatId: 'b' }).self!
          .challengeEvidence,
      ).toBeNull();
      expect(JSON.stringify(project(state, { role: 'public' }))).not.toContain(
        'evidenceIds',
      );
      expect(restore(challenged)).toEqual(challenged);
    },
  );
  it('allows two players to pass all four +4 cards around the table and replaces a returning sender’s old evidence', () => {
    let state = stacked({
      a: ['wild-draw-four-1', 'wild-draw-four-3', 'yellow-1-a'],
      b: ['wild-draw-four-2', 'wild-draw-four-4', 'blue-1-a'],
    });
    state.direction = -1;
    for (const [index, color] of (
      ['green', 'red', 'yellow', 'green'] as const
    ).entries()) {
      const seat = index % 2 === 0 ? 'a' : 'b';
      expect(state.turnSeat).toBe(seat);
      state = restore(
        apply(state, {
          type: 'play',
          cardId: `wild-draw-four-${index + 1}`,
          color,
        }),
      );
      expect(state.drawFour!.offender).toBe(seat);
      expect(state.drawFour!.evidenceIds).toEqual(state.hands[seat]);
    }
    expect(state.drawFour!.previousColor).toBe('yellow');
    expect(state.drawFour!.guilty).toBe(false);
    state = apply(state, { type: 'challenge-draw-four' });
    expect(state.hands.a).toHaveLength(19);
    expect(state.hands.b).toEqual(['blue-1-a']);
    expect(state.latest!.drawCount).toBe(18);
    expect(state.turnSeat).toBe('b');
  });
  it('restores +2 followed by all four +4 cards and settles the accumulated 18 cards', () => {
    let state = stacked({
      a: ['red-draw-two-a', 'wild-draw-four-3', 'yellow-1-a'],
      b: ['wild-draw-four-1', 'wild-draw-four-4', 'blue-1-a'],
      c: ['wild-draw-four-2', 'green-1-a'],
    });
    state = restore(apply(state, { type: 'play', cardId: 'red-draw-two-a' }));
    for (const [index, color] of (
      ['blue', 'yellow', 'green', 'red'] as const
    ).entries()) {
      state = restore(
        apply(state, {
          type: 'play',
          cardId: `wild-draw-four-${index + 1}`,
          color,
        }),
      );
      expect(state.drawPenalty!.count).toBe(2 + (index + 1) * 4);
    }
    expect(state.turnSeat).toBe('c');
    state = apply(state, { type: 'accept-draw-four' });
    expect(state.hands.c).toHaveLength(19);
    expect(state.latest!.drawCount).toBe(18);
    expect(state.turnSeat).toBe('a');
    expect(state.drawPenalty).toBeNull();
    expect(restore(state)).toEqual(state);
  });
  it.each(['accept-draw-four', 'challenge-draw-four'] as const)(
    'settles a final chained +4 through %s even when the next player holds another +4',
    (response) => {
      let state = stacked({
        a: ['wild-draw-four-1', 'yellow-2-a'],
        b: ['wild-draw-four-2'],
        c: ['wild-draw-four-3', 'blue-1-a'],
      });
      state = apply(state, {
        type: 'play',
        cardId: 'wild-draw-four-1',
        color: 'green',
      });
      state = restore(
        apply(state, {
          type: 'play',
          cardId: 'wild-draw-four-2',
          color: 'blue',
        }),
      );
      expect(state.phase).toBe('playing');
      expect(state.drawPenalty!.count).toBe(8);
      expect(legalActions(state, 'c')).toEqual([
        { type: 'accept-draw-four' },
        { type: 'challenge-draw-four' },
      ]);
      const count = response === 'challenge-draw-four' ? 10 : 8;
      state = apply(state, { type: response });
      expect(state.results.at(-1)!.winner).toBe('b');
      expect(state.phase).not.toBe('playing');
      expect(state.hands.c).toHaveLength(2 + count);
      expect(state.latest!.drawCount).toBe(count);
      expect(restore(state)).toEqual(state);
    },
  );
  it('transfers +2 to any-colored +2, keeps normal cards forbidden and accepts the accumulated amount', () => {
    let state = apply(base(), { type: 'play', cardId: 'red-draw-two-a' });
    expect(state.stage).toBe('draw-penalty');
    expect(state.hands.b).toHaveLength(3);
    expect(legalActions(state, 'b')).toContainEqual({
      type: 'play',
      cardId: 'blue-draw-two-a',
    });
    expect(legalActions(state, 'b')).not.toContainEqual({ type: 'draw' });
    expect(legalActions(state, 'b')).not.toContainEqual({
      type: 'play',
      cardId: 'blue-1-a',
    });
    state = apply(state, { type: 'play', cardId: 'blue-draw-two-a' });
    expect(state.drawPenalty).toEqual({ count: 4, kind: 'draw-two' });
    expect(state.activeColor).toBe('blue');
    state = apply(state, { type: 'accept-draw-penalty' });
    expect(state.hands.c).toHaveLength(6);
    expect(state.turnSeat).toBe('a');
    expect(state.drawPenalty).toBeNull();
  });
  it.each(['accept-draw-four', 'challenge-draw-four'] as const)(
    'handles a legal +4 after +2 via %s against cumulative debt',
    (response) => {
      let state = apply(base(), { type: 'play', cardId: 'red-draw-two-a' });
      state = apply(state, {
        type: 'play',
        cardId: 'wild-draw-four-1',
        color: 'green',
      });
      expect(state.drawPenalty).toEqual({ count: 6, kind: 'wild-draw-four' });
      expect(legalActions(state, 'c').filter((a) => a.type === 'play')).toEqual(
        [],
      );
      const before = state.hands.c!.length;
      const next = apply(state, { type: response });
      expect(next.hands.c).toHaveLength(
        before + (response === 'challenge-draw-four' ? 8 : 6),
      );
      expect(next.turnSeat).toBe('a');
      expect(next.drawPenalty).toBeNull();
    },
  );
  it('makes a guilty last +4 sender pay the whole accumulated debt, preserving only authorized evidence', () => {
    const start = stacked({
      a: ['red-draw-two-a', 'yellow-2-a'],
      b: ['wild-draw-four-1', 'red-1-a'],
      c: ['blue-1-a'],
    });
    let state = apply(start, { type: 'play', cardId: 'red-draw-two-a' });
    state = apply(state, {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'blue',
    });
    const bytes = JSON.stringify(state);
    state = validateState(JSON.parse(bytes), state.seats);
    expect(JSON.stringify(state)).toBe(bytes);
    const challenged = apply(state, { type: 'challenge-draw-four' });
    expect(challenged.hands.b).toHaveLength(7);
    expect(challenged.hands.c).toHaveLength(1);
    expect(challenged.turnSeat).toBe('c');
    expect(
      project(challenged, {
        role: 'player',
        seatId: 'c',
      }).self!.challengeEvidence?.cards.map((card) => card.id),
    ).toEqual(['red-1-a']);
    expect(
      project(challenged, { role: 'player', seatId: 'a' }).self!
        .challengeEvidence,
    ).toBeNull();
    expect(project(challenged, { role: 'public' }).self).toBeNull();
    expect(JSON.stringify(project(state, { role: 'public' }))).not.toContain(
      'evidenceIds',
    );
  });
  it('settles a final +2 immediately and offers only challenge/acceptance after a final +4', () => {
    const start = stacked({
      a: ['red-draw-two-a', 'yellow-2-a'],
      b: ['blue-draw-two-a'],
      c: ['wild-draw-four-1'],
    });
    let state = apply(start, { type: 'play', cardId: 'red-draw-two-a' });
    state = apply(state, { type: 'play', cardId: 'blue-draw-two-a' });
    expect(state.phase).toBe('round-result');
    expect(state.results.at(-1)!.winner).toBe('b');
    expect(state.hands.c).toHaveLength(5);
    expect(state.latest!.drawCount).toBe(4);
    const other = stacked({
      a: ['red-draw-two-a', 'yellow-2-a'],
      b: ['wild-draw-four-1'],
      c: ['green-draw-two-a', 'blue-1-a'],
    });
    state = apply(other, { type: 'play', cardId: 'red-draw-two-a' });
    state = apply(state, {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'blue',
    });
    expect(state.phase).toBe('playing');
    expect(legalActions(state, 'c').filter((a) => a.type === 'play')).toEqual(
      [],
    );
    state = apply(state, { type: 'accept-draw-four' });
    expect(state.results.at(-1)!.winner).toBe('b');
    expect(state.latest!.drawCount).toBe(6);
  });
  it('uses the same direction for two-seat transfers and keeps all 108 instances when a penalty exhausts the deck', () => {
    let state = stacked({
      a: ['red-draw-two-a', 'green-1-a'],
      b: ['blue-draw-two-a', 'blue-1-a'],
    });
    state.direction = -1;
    state = apply(state, { type: 'play', cardId: 'red-draw-two-a' });
    state = apply(state, { type: 'play', cardId: 'blue-draw-two-a' });
    expect(state.turnSeat).toBe('a');
    state = apply(state, { type: 'accept-draw-penalty' });
    expect(state.turnSeat).toBe('b');
    const empty = base();
    empty.hands.c!.push(...empty.deck);
    empty.deck = [];
    state = apply(empty, { type: 'play', cardId: 'red-draw-two-a' });
    state = apply(state, { type: 'play', cardId: 'blue-draw-two-a' });
    state = apply(state, { type: 'accept-draw-penalty' });
    const all = [
      ...state.deck,
      ...state.discard,
      ...Object.values(state.hands).flat(),
    ];
    expect(new Set(all)).toEqual(new Set(CARD_IDS));
    expect(state.latest!.drawCount).toBe(2);
  });
  it('can respond to an opening +2 only in the enabled setup, and keeps the setup for the next round', () => {
    let found: State | null = null;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      const ctx = context(seed);
      const state = initialize({
        ...ctx,
        setup: { drawPenaltyStacking: true, catchUnoDelayMs: 1000 },
      });
      if (state.stage === 'draw-penalty') found = state;
    }
    expect(found).not.toBeNull();
    expect(validateState(found, found!.seats).drawPenalty).toEqual({
      count: 2,
      kind: 'draw-two',
    });
    const ended = apply(stacked({ a: ['red-draw-two-a'], b: ['blue-1-a'] }), {
      type: 'play',
      cardId: 'red-draw-two-a',
    });
    const next = rules.applyLifecycle(
      ended,
      { type: 'next-round' },
      context(27, ended.seats),
    ).state as State;
    expect(next.setup).toEqual(ended.setup);
    expect(validateState(next, next.seats)).toEqual(next);
  });
  it('does not rewrite a pending +4 evidence snapshot when its sender is caught missing UNO', () => {
    let state = apply(
      stacked({
        a: ['red-draw-two-a', 'yellow-2-a'],
        b: ['wild-draw-four-1', 'red-1-a'],
        c: ['blue-1-a'],
      }),
      { type: 'play', cardId: 'red-draw-two-a' },
    );
    state = apply(state, {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'blue',
    });
    const evidence = [...state.drawFour!.evidenceIds];
    state = apply(state, { type: 'catch-uno', target: 'b' }, 'a');
    expect(state.drawFour!.evidenceIds).toEqual(evidence);
    expect(state.drawFour!.guilty).toBe(true);
    const before = state.hands.b!.length;
    state = apply(state, { type: 'challenge-draw-four' });
    expect(state.hands.b).toHaveLength(before + 6);
    expect(state.turnSeat).toBe('c');
  });
  it('rejects a missing debt, impossible count or forged +4 evidence without relaxing classic schemas', () => {
    const state = apply(base(), { type: 'play', cardId: 'red-draw-two-a' });
    for (const drawPenalty of [
      null,
      { count: 3, kind: 'draw-two' },
      { count: 100, kind: 'draw-two' },
      { count: 2, kind: 'wild-draw-four' },
    ])
      expect(() =>
        validateState({ ...state, drawPenalty }, state.seats),
      ).toThrow();
    const four = apply(state, {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'green',
    });
    const forged = structuredClone(four);
    forged.drawFour!.evidenceIds = [];
    expect(() => validateState(forged, forged.seats)).toThrow();
  });
});
