import { describe, expect, it } from 'vitest';
import { rules, type Action } from './index';
import { validateState, type State } from './state';
import { kindOf, kinds } from './cards';
import { bot } from '../bot';
import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';

function random(seed = 123) {
  return {
    next() {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    },
  };
}
function game(n = 3, seed = 123) {
  const context = {
    seats: Array.from({ length: n }, (_, i) => `s${i}`),
    random: random(seed),
  };
  return { context, state: rules.initialize(context) as State };
}
function apply(s: State, a: Action, actor: string) {
  return rules.apply(s, a, actor, { seats: s.seats, random: random() })
    .state as State;
}
function offer(s: State, target = 's1', truthful = true) {
  const card = s.hands[s.turn]![0]!;
  return apply(
    s,
    {
      type: 'offer',
      card,
      target,
      claim: truthful ? kindOf(card) : kinds.find((k) => k !== kindOf(card))!,
    },
    s.turn,
  );
}
function moveToPile(s: State, seat: string, cards: number[]) {
  for (const card of cards) {
    for (const hand of Object.values(s.hands)) {
      const i = hand.indexOf(card);
      if (i >= 0) hand.splice(i, 1);
    }
    const i = s.removed.indexOf(card);
    if (i >= 0) s.removed.splice(i, 1);
    s.piles[seat]!.push(card);
  }
}

describe('classic 40829 cockroach poker', () => {
  it('deals exactly 64 unique cards, eight per critter, and removes ten secretly for two', () => {
    for (let n = 2; n <= 6; n++) {
      const { state: s, context } = game(n);
      expect(validateState(s, context.seats)).toEqual(s);
      expect(s.removed).toHaveLength(n === 2 ? 10 : 0);
      const counts = Object.values(s.hands).map((h) => h.length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(Object.values(s.hands).flat()).toHaveLength(n === 2 ? 54 : 64);
    }
    const all = Array.from({ length: 64 }, (_, i) => i);
    for (const k of kinds)
      expect(all.filter((c) => kindOf(c) === k)).toHaveLength(8);
  });
  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])(
    'resolves truthful=%s belief=%s and collector starts next round',
    (truthful, belief) => {
      const s = offer(game().state, 's1', truthful),
        card = s.offer!.card;
      const next = apply(s, { type: 'judge', belief }, 's1');
      const collector = truthful === belief ? 's0' : 's1';
      expect(next.piles[collector]).toContain(card);
      expect(next.turn).toBe(collector);
      expect(next.offer).toBeNull();
      validateState(next, s.seats);
    },
  );
  it('offers freely to any other seat and every animal claim', () => {
    const { state: s } = game(6);
    const actions = rules.legalActions(s, 's0') as Action[];
    expect(
      new Set(actions.map((a) => ('target' in a ? a.target : ''))),
    ).toEqual(new Set(s.seats.slice(1)));
    expect(actions).toHaveLength(s.hands.s0!.length * 5 * 8);
    expect(rules.legalActions(s, 's1')).toEqual([]);
    const canonical = rules.validateAction({
      claim: 'rat',
      target: 's1',
      card: s.hands.s0![0],
      type: 'offer',
    });
    expect(JSON.stringify(canonical)).toBe(
      JSON.stringify({
        type: 'offer',
        card: s.hands.s0![0],
        target: 's1',
        claim: 'rat',
      }),
    );
  });
  it('peek commits to passing, changes claims, and last unseen recipient must judge', () => {
    const s = offer(game().state);
    const peeked = apply(s, { type: 'peek' }, 's1');
    expect(() =>
      apply(peeked, { type: 'judge', belief: true }, 's1'),
    ).toThrow();
    expect(rules.legalActions(peeked, 's1')).toHaveLength(8);
    expect(() =>
      apply(peeked, { type: 'pass', target: 's0', claim: 'rat' }, 's1'),
    ).toThrow();
    const passed = apply(
      peeked,
      { type: 'pass', target: 's2', claim: 'rat' },
      's1',
    );
    expect(passed.offer!.claim).toBe('rat');
    expect(passed.offer!.route).toHaveLength(2);
    expect(rules.legalActions(passed, 's2')).toEqual([
      { type: 'judge', belief: true },
      { type: 'judge', belief: false },
    ]);
    const next = apply(
      passed,
      { type: 'judge', belief: kindOf(passed.offer!.card) === 'rat' },
      's2',
    );
    expect(next.turn).toBe('s1');
    validateState(next, next.seats);
  });
  it('keeps current card, other hands, and two-player removed cards secret from public and unauthorized viewers', () => {
    let s = offer(game().state);
    const pub = rules.project(s, { role: 'public' }) as Record<
      string,
      JsonValue
    >;
    expect(pub.ownHand).toEqual([]);
    expect((pub.offer as Record<string, JsonValue>).knownCard).toBeNull();
    expect(pub).not.toHaveProperty('removed');
    expect(pub).not.toHaveProperty('hands');
    expect(
      (
        rules.project(s, { role: 'player', seatId: 's0' }) as Record<
          string,
          JsonValue
        >
      ).ownHand,
    ).toEqual(s.hands.s0);
    expect(
      (
        rules.project(s, { role: 'player', seatId: 's1' }) as Record<
          string,
          JsonValue
        >
      ).offer,
    ).toHaveProperty('knownCard', null);
    s = apply(s, { type: 'peek' }, 's1');
    expect(
      (
        rules.project(s, { role: 'player', seatId: 's1' }) as Record<
          string,
          JsonValue
        >
      ).offer,
    ).toHaveProperty('knownCard', s.offer!.card);
    expect(
      (
        rules.project(s, { role: 'player', seatId: 's2' }) as Record<
          string,
          JsonValue
        >
      ).offer,
    ).toHaveProperty('knownCard', null);
    expect(
      (
        rules.project(s, { role: 'player', seatId: 'intruder' }) as Record<
          string,
          JsonValue
        >
      ).ownHand,
    ).toEqual([]);
  });
  it('two players never peek or pass', () => {
    const s = offer(game(2).state);
    expect(rules.legalActions(s, 's1')).toEqual([
      { type: 'judge', belief: true },
      { type: 'judge', belief: false },
    ]);
    expect(() => apply(s, { type: 'peek' }, 's1')).toThrow();
  });
  it.each([2, 3, 6])(
    'ends at correct same-kind threshold for %s players',
    (n) => {
      const { state: s } = game(n);
      const threshold = n === 2 ? 5 : 4;
      // Construct a conserved decision fixture with the last same-kind card offered.
      const card = s.hands.s0![0]!,
        k = kindOf(card);
      const candidates = Object.values(s.hands)
        .flat()
        .filter((c) => kindOf(c) === k && c !== card)
        .slice(0, threshold - 1);
      expect(candidates).toHaveLength(threshold - 1);
      moveToPile(s, 's1', candidates);
      const offered = apply(
        s,
        { type: 'offer', card, target: 's1', claim: k },
        's0',
      );
      const ended = apply(offered, { type: 'judge', belief: false }, 's1');
      expect(ended.loser).toBe('s1');
      expect(ended.winners).toEqual(s.seats.filter((x) => x !== 's1'));
      expect(rules.decisions(ended)).toEqual([]);
      expect(rules.lifecycleActions(ended)).toEqual([{ type: 'next-round' }]);
      validateState(ended, ended.seats);
    },
  );
  it('empty hand loses only when that seat has to open a round', () => {
    const { state: s } = game();
    const card = s.hands.s0![0]!;
    s.hands.s1!.push(...s.hands.s0!.splice(1));
    const offered = apply(
      s,
      { type: 'offer', card, target: 's1', claim: kindOf(card) },
      's0',
    );
    expect(offered.loser).toBeNull();
    const continued = apply(offered, { type: 'judge', belief: false }, 's1');
    expect(continued.loser).toBeNull();
    expect(continued.turn).toBe('s1');
    const lost = apply(offered, { type: 'judge', belief: true }, 's1');
    expect(lost.loser).toBe('s0');
    validateState(lost, lost.seats);
  });
  it('rejects malformed actions, wrong actors, duplicate cards, forged routes and results', () => {
    const { state: s } = game();
    expect(() => validateState({ ...s, offer: false }, s.seats)).toThrow();
    expect(() => validateState({ ...s, last: false }, s.seats)).toThrow();
    expect(() =>
      rules.validateAction({ type: 'peek', hidden: true }),
    ).toThrow();
    expect(() =>
      rules.validateAction({ type: 'judge', belief: 'yes' }),
    ).toThrow();
    expect(() =>
      apply(
        s,
        { type: 'offer', card: s.hands.s1![0]!, target: 's2', claim: 'rat' },
        's1',
      ),
    ).toThrow();
    const corrupt = structuredClone(s);
    corrupt.hands.s0![0] = corrupt.hands.s1![0]!;
    expect(() => validateState(corrupt, s.seats)).toThrow();
    const route = offer(s);
    route.offer!.seen.push('s2');
    expect(() => validateState(route, s.seats)).toThrow();
    const result = structuredClone(s);
    result.winners = ['s0'];
    expect(() => validateState(result, s.seats)).toThrow();
  });
  it('preserves input objects and exact save/restore decisions across peek/pass/reveal', () => {
    let s = game(4).state;
    for (const a of [
      { type: 'offer', card: s.hands.s0![0]!, target: 's1', claim: 'rat' },
      { type: 'peek' },
      { type: 'pass', target: 's2', claim: 'bat' },
      { type: 'judge', belief: true },
    ] as Action[]) {
      const before = JSON.stringify(s);
      const actor = rules.decisions(s)[0]!.seatId;
      const restored = validateState(JSON.parse(before), s.seats);
      expect(rules.project(restored, { role: 'public' })).toEqual(
        rules.project(s, { role: 'public' }),
      );
      const next = apply(s, a, actor);
      expect(JSON.stringify(s)).toBe(before);
      expect(next).toEqual(apply(restored, a, actor));
      validateState(next, next.seats);
      s = next;
    }
  });
  it('three strategy levels differ under the same authorized input', async () => {
    const s = offer(game().state),
      decision = rules.decisions(s)[0]!;
    const input = {
      view: rules.project(s, { role: 'player', seatId: decision.seatId }),
      actions: rules.legalActions(s, decision.seatId),
      decision,
      memory: null,
      random: { next: () => 0.5 },
      signal: new AbortController().signal,
    };
    const defaultAction = (
      await bot.decide({ ...input, difficulty: 'default' })
    ).action;
    const doubaoAction = (await bot.decide({ ...input, difficulty: 'doubao' }))
      .action;
    const juewuAction = (await bot.decide({ ...input, difficulty: 'juewu' }))
      .action;
    expect(defaultAction).not.toEqual(doubaoAction);
    expect(doubaoAction).not.toEqual(juewuAction);
    expect(() => bot.validateMemory({ card: 1 })).toThrow();
  });
  it('natural complete simulations conserve cards and accept every bot action for all seats and difficulties', async () => {
    for (const difficulty of ['default', 'doubao', 'juewu'] as BotDifficulty[])
      for (let n = 2; n <= 6; n++)
        for (let seed = 1; seed <= 4; seed++) {
          let s = game(n, seed).state;
          const rng = random(seed + 999);
          for (let turn = 0; !rules.ended(s) && turn < 600; turn++) {
            validateState(s, s.seats);
            const decision = rules.decisions(s)[0]!;
            const result = await bot.decide({
              view: rules.project(s, {
                role: 'player',
                seatId: decision.seatId,
              }),
              actions: rules.legalActions(s, decision.seatId),
              decision,
              memory: null,
              difficulty,
              random: rng,
              signal: new AbortController().signal,
            });
            const snapshot = JSON.stringify(s);
            s = apply(s, result.action as Action, decision.seatId);
            expect(snapshot).not.toBe(JSON.stringify(s));
          }
          expect(rules.ended(s)).toBe(true);
          validateState(s, s.seats);
          expect(s.winners).toHaveLength(n - 1);
        }
  });
});
