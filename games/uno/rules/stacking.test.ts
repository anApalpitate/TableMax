import { describe, expect, it } from 'vitest';
import type { Action } from '../types';
import { CARD_IDS } from '../data/catalog';
import {
  rules,
  legalActions,
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
const base = () =>
  stacked({
    a: ['red-draw-two-a', 'yellow-2-a'],
    b: ['blue-draw-two-a', 'wild-draw-four-1', 'blue-1-a'],
    c: ['green-draw-two-a', 'green-1-a'],
  });

describe('UNO optional draw penalty transfer', () => {
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
