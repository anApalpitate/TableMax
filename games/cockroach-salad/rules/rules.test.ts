import { describe, it, expect } from 'vitest';
import type { JsonValue } from '@tablemax/game-sdk';
import { rules } from './index';
import {
  card,
  correctAnswers,
  type State,
  type Answer,
  type SaladView,
} from '../types';
import { bot, profiles } from '../bot';
const seats = ['a', 'b', 'c', 'd'];
const ctx = { seats, random: { next: () => 0.42 } };
const json = (s: State) => s as unknown as JsonValue;
const init = () => rules.initialize(ctx) as unknown as State;
const auto = (s: State) =>
  rules.applyAutomatic!(json(s), rules.automaticAction!(json(s))!.action, ctx)
    .state as unknown as State;
const act = (s: State, seat: string, a: JsonValue) =>
  rules.apply(json(s), a, seat, ctx).state as unknown as State;
const v = (s: State) =>
  rules.project(json(s), { role: 'public' }) as unknown as SaladView;
function arrange(ids: number[], actor = 'a'): State {
  const s = init();
  s.hands = Object.fromEntries(seats.map((k) => [k, []]));
  s.piles = [[], []];
  s.spare = [];
  s.actor = actor;
  s.pile = 0;
  s.current = ids[0]!;
  s.piles[0] = [ids[0]!];
  s.hands[actor] = ids.slice(1);
  const used = new Set(ids);
  const remain = Array.from({ length: 128 }, (_, i) => i).filter(
    (i) => !used.has(i),
  );
  seats
    .filter((k) => k !== actor)
    .forEach((k, i) => (s.hands[k] = remain.filter((_, j) => j % 3 === i)));
  s.taboo = card(s.current).taboo ? [card(s.current).vegetable] : [];
  return s;
}
describe('cockroach salad authoritative rules', () => {
  it('128 unique cards, equal deals, hidden future for every role', () => {
    for (let n = 2; n <= 6; n++) {
      const ss = seats.concat(['e', 'f']).slice(0, n);
      const s = rules.initialize({ ...ctx, seats: ss }) as unknown as State;
      expect(rules.validateState(s, ss)).toEqual(s);
      expect(s.spare.length).toBe(128 % n);
      for (const role of [
        { role: 'public' as const },
        ...ss.map((seatId) => ({ role: 'player' as const, seatId })),
      ]) {
        const p = rules.project(json(s), role) as unknown as Record<
          string,
          unknown
        >;
        expect(p).not.toHaveProperty('hands');
        expect(p).not.toHaveProperty('spare');
        expect(p).not.toHaveProperty('responses');
      }
    }
  });
  it('all vegetable, previous word and taboo combinations', () => {
    const answers = ['tomato', 'lettuce', 'cauliflower', 'pepper'] as const;
    for (const current of answers)
      for (const previousVegetable of [null, ...answers])
        for (const previousAnswer of [null, ...answers, 'cockroach' as const])
          for (const taboo of [
            [],
            ['pepper' as const],
            ['tomato' as const, 'lettuce' as const],
          ]) {
            const got = correctAnswers({
              current: { id: 0, vegetable: current, taboo: false },
              previousVegetable,
              previousAnswer,
              taboo,
            });
            const banned = new Set<Answer>([
              ...taboo,
              ...(previousVegetable ? [previousVegetable] : []),
              ...(previousAnswer ? [previousAnswer] : []),
            ]);
            expect(got).toEqual(
              banned.has(current)
                ? answers.filter((a) => !banned.has(a))
                : [current],
            );
          }
    expect(
      correctAnswers({
        current: card(28),
        previousVegetable: 'tomato',
        previousAnswer: 'cockroach',
        taboo: ['tomato'],
      }),
    ).toEqual(['cockroach']);
  });
  it('official example including one-turn double taboo', () => {
    const ids = [32, 124, 0, 1, 2, 92, 96, 64, 97];
    let s = arrange(ids);
    s.hands = Object.fromEntries(
      seats.map((k, i) => [
        k,
        ids.slice(1).filter((_, j) => (j + 1) % 4 === i),
      ]),
    );
    const used = new Set(ids);
    for (let id = 0; id < 128; id++)
      if (!used.has(id)) s.hands[seats[id % 4]!]!.push(id);
    const sequence: Answer[] = [
      'lettuce',
      'cockroach',
      'tomato',
      'cauliflower',
      'lettuce',
      'cockroach',
      'lettuce',
      'tomato',
    ];
    for (let i = 0; i < sequence.length; i++) {
      expect(s.current).toBe(ids[i]);
      expect(correctAnswers(v(s))).toContain(sequence[i]);
      if (i === 6)
        expect(s.taboo).toEqual(
          expect.arrayContaining(['pepper', 'cauliflower']),
        );
      s = act(s, s.actor, { type: 'answer', answer: sequence[i]! });
      s = auto(s);
      expect(rules.validateState(json(s), seats)).toEqual(s);
    }
    expect(correctAnswers(v(s))).toEqual(['pepper']);
    expect(correctAnswers(v(s))).not.toContain('lettuce');
  });
  it('wrong answer escapes without revealing judgement', () => {
    let s = init();
    const bad = (
      ['tomato', 'lettuce', 'cauliflower', 'pepper', 'cockroach'] as Answer[]
    ).find((a) => !correctAnswers(v(s)).includes(a))!;
    s = act(s, s.actor, { type: 'answer', answer: bad });
    const counts = { ...v(s).counts };
    s = auto(s);
    expect(s.lastResult).toBe('质疑窗口结束，继续出牌。');
    expect(s.accepted).toBe(1);
    expect(Object.values(v(s).counts).reduce((a, b) => a + b, 0)).toBe(
      Object.values(counts).reduce((a, b) => a + b, 0) - 1,
    );
  });
  it('multiple correct challengers collect once at deadline, without early outcome', () => {
    let s = init();
    const actor = s.actor;
    const bad = (
      ['tomato', 'lettuce', 'cauliflower', 'pepper', 'cockroach'] as Answer[]
    ).find((a) => !correctAnswers(v(s)).includes(a))!;
    s = act(s, actor, { type: 'answer', answer: bad });
    s = act(s, 'b', { type: 'challenge' });
    s = act(s, 'c', { type: 'challenge' });
    expect(s.phase).toBe('review');
    expect(s.piles.flat()).toHaveLength(1);
    const before = s.hands[actor]!.length;
    s = auto(s);
    expect(s.lastResult).toContain('质疑成立');
    expect(s.hands[actor]!.length).toBe(before);
    expect(s.piles.flat()).toHaveLength(1);
    expect(s.actor).toBe(actor);
  });
  it('false challengers share deterministically and first restarts', () => {
    let s = arrange([0, 1]);
    s.piles[0]!.unshift(...s.hands.d!.splice(0, 4));
    s = act(s, 'a', { type: 'answer', answer: 'tomato' });
    s = act(s, 'c', { type: 'challenge' });
    s = act(s, 'b', { type: 'challenge' });
    const b = s.hands.b!.length,
      c = s.hands.c!.length;
    s = auto(s);
    expect(s.hands.b!.length).toBe(b + 2);
    expect(s.hands.c!.length).toBe(c + 2);
    expect(s.actor).toBe('b');
    expect(s.lastResult).toContain('不成立');
    expect(rules.validateState(json(s), seats)).toEqual(s);
  });
  it('overtime allows late answer, concurrent challenge remains valid; silence auto-penalty', () => {
    let s = auto(init());
    expect(s.phase).toBe('overtime');
    s = act(s, 'b', { type: 'challenge' });
    s = act(s, s.actor, { type: 'answer', answer: correctAnswers(v(s))[0]! });
    expect(s.late).toBe(true);
    s = auto(s);
    expect(s.lastResult).toContain('质疑成立');
    const t = auto(auto(init()));
    expect(t.lastResult).toContain('无人作答');
    expect(t.phase).toBe('thinking');
  });
  it('last card waits for review; challenge can prevent victory', () => {
    let s = arrange([0]);
    s = act(s, 'a', { type: 'answer', answer: 'tomato' });
    expect(rules.ended(json(s))).toBe(false);
    s = auto(s);
    expect(s.winners).toEqual(['a']);
    expect(rules.validateState(json(s), seats)).toEqual(s);
    let t = arrange([0]);
    t = act(t, 'a', { type: 'answer', answer: 'pepper' });
    t = act(t, 'b', { type: 'challenge' });
    t = auto(t);
    expect(t.winners).toEqual([]);
  });
  it('rejects spoofed deadline, stale timer, outsiders, double submissions and corrupt partitions', () => {
    const s = init();
    expect(() =>
      rules.validateAction({ type: 'deadline', step: s.step, phase: s.phase }),
    ).toThrow();
    expect(() =>
      rules.applyAutomatic!(
        json(s),
        { type: 'deadline', step: 0, phase: 'thinking' },
        ctx,
      ),
    ).toThrow();
    expect(() =>
      act(s, 'nobody', { type: 'answer', answer: 'tomato' }),
    ).toThrow();
    let t = act(s, s.actor, { type: 'answer', answer: 'tomato' });
    t = act(t, 'b', { type: 'pass' });
    expect(() => act(t, 'b', { type: 'challenge' })).toThrow();
    const bad = structuredClone(s);
    bad.hands.a!.push(bad.hands.b![0]!);
    expect(() => rules.validateState(bad, seats)).toThrow();
    expect(() => rules.validateState({ ...s, unknown: 1 }, seats)).toThrow();
  });
  it('applies immutably, and commutative response order is equivalent', () => {
    const s = init();
    const copy = structuredClone(s);
    const t = act(s, s.actor, { type: 'answer', answer: 'tomato' });
    expect(s).toEqual(copy);
    expect(
      act(act(t, 'b', { type: 'challenge' }), 'c', { type: 'pass' }),
    ).toEqual(act(act(t, 'c', { type: 'pass' }), 'b', { type: 'challenge' }));
  });
  it('three strategy profiles differ and consume only public projection', async () => {
    expect(profiles.default.error).toBeGreaterThan(profiles.doubao.error);
    expect(profiles.doubao.miss).toBeGreaterThan(profiles.juewu.miss);
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      const s = init();
      const decision = rules.decisions(json(s))[0]!;
      const result = await bot.decide({
        view: rules.project(json(s), { role: 'player', seatId: s.actor }),
        actions: rules.legalActions(json(s), s.actor),
        decision,
        memory: null,
        difficulty,
        random: { next: () => 0.9 },
        signal: new AbortController().signal,
      });
      expect(rules.legalActions(json(s), s.actor)).toContainEqual(
        result.action,
      );
    }
  });
  it('seeded 2–6 player complete matches preserve JSON partitions at every saved boundary', async () => {
    for (let n = 2; n <= 6; n++) {
      let seed = 200 + n;
      const random = {
        next: () => {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          return (seed >>> 0) / 4294967296;
        },
      };
      const ss = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, n);
      const context = { seats: ss, random };
      let state = rules.initialize(context);
      let actions = 0;
      while (!rules.ended(state) && actions < 30000) {
        for (const decision of rules.decisions(state)) {
          if (
            !rules
              .decisions(state)
              .some((d) => d.id === decision.id && d.seatId === decision.seatId)
          )
            continue;
          const legal = rules.legalActions(state, decision.seatId);
          const choice = await bot.decide({
            view: rules.project(state, {
              role: 'player',
              seatId: decision.seatId,
            }),
            actions: legal,
            decision,
            memory: null,
            difficulty: 'juewu',
            random,
            signal: new AbortController().signal,
          });
          state = rules.apply(
            state,
            choice.action,
            decision.seatId,
            context,
          ).state;
          expect(
            rules.validateState(JSON.parse(JSON.stringify(state)), ss),
          ).toEqual(state);
          actions++;
        }
        if (!rules.ended(state)) {
          state = rules.applyAutomatic!(
            state,
            rules.automaticAction!(state)!.action,
            context,
          ).state;
          expect(
            rules.validateState(JSON.parse(JSON.stringify(state)), ss),
          ).toEqual(state);
          actions++;
        }
      }
      expect(rules.ended(state), 'players=' + n + ' actions=' + actions).toBe(
        true,
      );
    }
  });
  it('strategy error and catch frequencies follow each profile with nonzero reaction ranges', async () => {
    let seed = 4567;
    const random = {
      next: () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return (seed >>> 0) / 4294967296;
      },
    };
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      let errors = 0,
        misses = 0;
      const s = init();
      const answerDecision = rules.decisions(json(s))[0]!;
      const reaction = rules.botTiming!(json(s), s.actor, difficulty)!;
      expect(reaction.minMs).toBeGreaterThan(0);
      expect(reaction.maxMs).toBeGreaterThan(reaction.minMs);
      const answerView = rules.project(json(s), {
        role: 'player',
        seatId: s.actor,
      });
      const valid = correctAnswers(v(s));
      const review = act(s, s.actor, {
        type: 'answer',
        answer: (
          [
            'tomato',
            'lettuce',
            'cauliflower',
            'pepper',
            'cockroach',
          ] as Answer[]
        ).find((a) => !valid.includes(a))!,
      });
      const responseDecision = rules.decisions(json(review))[0]!;
      for (let i = 0; i < 1000; i++) {
        const a = await bot.decide({
          view: answerView,
          actions: rules.legalActions(json(s), s.actor),
          decision: answerDecision,
          memory: null,
          difficulty,
          random,
          signal: new AbortController().signal,
        });
        if (!valid.includes((a.action as { answer: Answer }).answer)) errors++;
        const b = await bot.decide({
          view: rules.project(json(review), {
            role: 'player',
            seatId: responseDecision.seatId,
          }),
          actions: rules.legalActions(json(review), responseDecision.seatId),
          decision: responseDecision,
          memory: null,
          difficulty,
          random,
          signal: new AbortController().signal,
        });
        if ((b.action as { type: string }).type === 'pass') misses++;
      }
      expect(errors / 1000).toBeCloseTo(profiles[difficulty].error, 1);
      expect(misses / 1000).toBeCloseTo(profiles[difficulty].miss, 1);
    }
  });
  it('overtime lists the common response group before the independent actor', () => {
    const s = auto(init());
    const ds = rules.decisions(json(s));
    expect(ds[0]?.concurrencyGroup).toBe('salad-review-' + s.turn);
    expect(ds.at(-1)?.seatId).toBe(s.actor);
    expect(ds.at(-1)?.concurrencyGroup).toBeUndefined();
    const b = ds.find((d) => d.seatId === 'b')!;
    const t = act(s, 'c', { type: 'challenge' });
    expect(rules.decisions(json(t)).find((d) => d.seatId === 'b')).toEqual(b);
  });
});
