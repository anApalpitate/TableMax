import { deepStrictEqual } from 'node:assert';
import { describe, expect, it } from 'vitest';
import { bot } from './index';
import { observeMemory, type ArtMemory } from './memory';
import { RoundPlanner } from './planner';
import type { JsonValue } from '../../../packages/game-sdk/src';
import { rules, decisions } from '../rules';
import type { State } from '../rules/state';
import type { ModernArtView } from '../ui/view';
import type { Action } from '../ui/view';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { CARDS, getCard } from '../data/catalog';
import { countCards } from '../rules/scoring';

describe('Modern Art independent local strategies', () => {
  it('plays seeded 3/4/5-player matches at all three levels with per-intent save validation', async () => {
    const timings: Record<string, { decisions: number; longestMs: number }> =
      {};
    for (const count of [3, 4, 5])
      for (const difficulty of ['default', 'doubao', 'juewu'] as const)
        for (const seed of [11, 57, 173]) {
          const seats = Array.from({ length: count }, (_, i) => `S${i + 1}`);
          const random = new RandomSource(seed);
          const botRandom = new RandomSource(seed + 700);
          let s = rules.validateState(
            rules.initialize({ seats, random }),
            seats,
          ) as State;
          let steps = 0;
          const memories: Record<string, JsonValue> = Object.fromEntries(
            seats.map((seat) => [seat, null]),
          );
          while (!rules.ended(s) && steps++ < 1800) {
            const before = JSON.parse(JSON.stringify(s));
            if (s.phase === 'round-result')
              s = rules.applyLifecycle(
                s,
                { type: 'next-round' },
                { seats, random },
              ).state as State;
            else {
              const decision = decisions(s)[0]!;
              expect(decision).toBeTruthy();
              const actions = rules.legalActions(s, decision.seatId);
              const started = performance.now();
              const choice = await bot.decide({
                view: rules.project(s, {
                  role: 'player',
                  seatId: decision.seatId,
                }),
                actions,
                decision,
                memory: memories[decision.seatId]!,
                difficulty,
                random: botRandom,
                signal: new AbortController().signal,
              });
              const elapsed = performance.now() - started;
              const timing = (timings[difficulty] ??= {
                decisions: 0,
                longestMs: 0,
              });
              timing.decisions++;
              timing.longestMs = Math.max(timing.longestMs, elapsed);
              expect(actions).toContainEqual(choice.action);
              expect(bot.validateMemory(choice.memory)).toEqual(choice.memory);
              memories[decision.seatId] = JSON.parse(
                JSON.stringify(choice.memory),
              );
              const previous = s;
              s = rules.apply(s, choice.action, decision.seatId, {
                seats,
                random,
              }).state as State;
              deepStrictEqual(
                previous,
                before,
                `${count} seats / ${difficulty} / seed ${seed} / step ${steps}: input state changed`,
              );
            }
            deepStrictEqual(
              rules.validateState(JSON.parse(JSON.stringify(s)), seats),
              s,
              `${count} seats / ${difficulty} / seed ${seed} / step ${steps}: serialization round-trip changed state`,
            );
            const publicView = rules.project(s, {
              role: 'public',
            }) as ModernArtView;
            expect(publicView.self).toBeNull();
            if (s.phase !== 'ended')
              for (const player of Object.values(publicView.players))
                expect(player.cash).toBeNull();
          }
          expect(steps).toBeLessThan(1800);
          expect(s.phase).toBe('ended');
          expect(s.round).toBe(4);
          expect(s.results).toHaveLength(4);
          expect(s.winners.length).toBeGreaterThan(0);
          expect(
            Object.values(s.cash).every(
              (amount) => Number.isSafeInteger(amount) && amount >= 0,
            ),
          ).toBe(true);
          expect(s.values.manuel).toHaveLength(4);
          expect(rules.lifecycleActions(s)).toEqual([]);
        }
    for (const timing of Object.values(timings))
      expect(timing.longestMs).toBeLessThan(1500);
    console.info(
      'Modern Art seeded decision timings:',
      JSON.stringify(timings),
    );
  }, 20000);
  it('makes the same decision when unobserved opponent cash and hidden hand ordering change', async () => {
    const s = rules.initialize({
      seats: ['S1', 'S2', 'S3'],
      random: new RandomSource(51),
    }) as State;
    const hidden = structuredClone(s);
    hidden.cash.S2 = 7;
    hidden.cash.S3 = 73;
    hidden.hands.S2!.reverse();
    hidden.hands.S3!.reverse();
    expect(rules.project(s, { role: 'player', seatId: 'S1' })).toEqual(
      rules.project(hidden, { role: 'player', seatId: 'S1' }),
    );
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      const choices = [];
      for (const state of [s, hidden])
        choices.push(
          await bot.decide({
            view: rules.project(state, { role: 'player', seatId: 'S1' }),
            actions: rules.legalActions(state, 'S1'),
            decision: decisions(state)[0]!,
            memory: null,
            difficulty,
            random: new RandomSource(5),
            signal: new AbortController().signal,
          }),
        );
      expect(choices[0]).toEqual(choices[1]);
    }
  });
  it('compares every artist using the same ranking after the candidate ending card', async () => {
    const seats = ['S1', 'S2', 'S3'];
    const s = rules.initialize({ seats, random: new RandomSource(3) }) as State;
    const available = [...CARDS];
    const take = (artistId: string) => {
      const index = available.findIndex((card) => card.artistId === artistId);
      return available.splice(index, 1)[0]!.id;
    };
    s.collections = {
      S1: [
        take('manuel'),
        take('manuel'),
        take('manuel'),
        take('manuel'),
        take('sigrid'),
        take('sigrid'),
      ],
      S2: [take('sigrid'), take('sigrid')],
      S3: [],
    };
    s.hands = {
      S1: [take('manuel'), take('sigrid')],
      S2: [take('rafael')],
      S3: [take('ramon')],
    };
    s.deck = available.map((card) => card.id);
    s.played = countCards(Object.values(s.collections).flat());
    rules.validateState(s, seats);
    const choice = await bot.decide({
      view: rules.project(s, { role: 'player', seatId: 'S1' }),
      actions: rules.legalActions(s, 'S1'),
      decision: decisions(s)[0]!,
      memory: null,
      difficulty: 'juewu',
      random: new RandomSource(5),
      signal: new AbortController().signal,
    });
    expect(choice.action).toMatchObject({ type: 'offer' });
    expect(getCard((choice.action as { cardId: string }).cardId).artistId).toBe(
      'manuel',
    );
  });
  it('rejects invalid memory and cancellation without choosing an action', async () => {
    expect(() => bot.validateMemory({})).toThrow();
    expect(bot.validateMemory(null)).toBeNull();
    const s = rules.initialize({
      seats: ['S1', 'S2', 'S3'],
      random: new RandomSource(2),
    }) as State;
    const cancel = new AbortController();
    cancel.abort();
    await expect(
      bot.decide({
        view: rules.project(s, { role: 'player', seatId: 'S1' }),
        actions: rules.legalActions(s, 'S1'),
        decision: decisions(s)[0]!,
        memory: null,
        random: new RandomSource(1),
        signal: cancel.signal,
      }),
    ).rejects.toThrow('取消');
  });
  it('forgets older observed cards at the two weaker levels without rereading forgotten logs', () => {
    const view = rules.project(
      rules.initialize({
        seats: ['S1', 'S2', 'S3'],
        random: new RandomSource(2),
      }),
      { role: 'player', seatId: 'S1' },
    ) as ModernArtView;
    view.history = CARDS.slice(0, 50).map((card, index) => ({
      id: `log-${index + 1}`,
      actor: 'S2',
      verb: 'sale',
      cards: [card],
      amount: 10,
      winner: 'S3',
      sealedBids: null,
      text: '公开成交',
    }));
    const original = structuredClone(view);
    for (const level of [0, 1, 2]) {
      const initial = observeMemory(null, view, level);
      expect(initial.remembered).toHaveLength([8, 28, 50][level]!);
      const next = { ...view, round: 2 };
      const faded = observeMemory(initial, next, level);
      expect(faded.remembered).toHaveLength([2, 14, 50][level]!);
      expect(initial.round).toBe(1);
      expect(observeMemory(faded, next, level)).toEqual(faded);
      expect(bot.validateMemory(JSON.parse(JSON.stringify(faded)))).toEqual(
        faded,
      );
      const current = structuredClone(next);
      current.players.S2!.collection = [CARDS[0]!];
      const seen = observeMemory(faded, current, level);
      expect(seen.remembered).toContain(CARDS[0]!.id);
      expect(
        new RoundPlanner(current, seen, level, new AbortController().signal)
          .unknown.manuel,
      ).toBeLessThan(12);
      expect(() => bot.validateMemory({ ...faded, raises: 4 })).toThrow();
      expect(() =>
        bot.validateMemory({ ...faded, remembered: ['unknown'] }),
      ).toThrow();
      expect(() => bot.validateMemory({ ...faded, hiddenCash: 100 })).toThrow();
    }
    expect(view).toEqual(original);
  });
  it('uses larger open-auction jumps and reaches its ceiling within three own raises', async () => {
    const seats = ['S1', 'S2', 'S3'];
    for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
      const random = new RandomSource(5);
      let state = rules.initialize({ seats, random }) as State;
      const cardId = state.hands.S1!.find(
        (id) => getCard(id).auctionKind === 'open',
      )!;
      expect(cardId).toBeTruthy();
      state = rules.apply(state, { type: 'offer', cardId }, 'S1', {
        seats,
        random,
      }).state as State;
      let memory: JsonValue = null;
      const jumps: number[] = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = state.auction!.currentBid;
        const actions = rules.legalActions(state, 'S2');
        const choice = await bot.decide({
          view: rules.project(state, { role: 'player', seatId: 'S2' }),
          actions,
          decision: decisions(state).find(
            (decision) => decision.seatId === 'S2',
          )!,
          memory,
          difficulty,
          random: new RandomSource(9),
          signal: new AbortController().signal,
        });
        expect(actions).toContainEqual(choice.action);
        memory = JSON.parse(JSON.stringify(choice.memory));
        if ((choice.action as Action).type === 'pass') break;
        const amount = (choice.action as { amount: number }).amount;
        jumps.push(amount - current);
        state = rules.apply(state, choice.action, 'S2', { seats, random })
          .state as State;
        state = rules.apply(state, { type: 'bid', amount: amount + 1 }, 'S3', {
          seats,
          random,
        }).state as State;
      }
      expect(jumps.length).toBeGreaterThan(0);
      expect(jumps.length).toBeLessThanOrEqual(3);
      expect(jumps[0]).toBeGreaterThan(1);
      expect(jumps.filter((jump) => jump === 1).length).toBeLessThanOrEqual(1);
      expect((memory as ArtMemory).raises).toBe(jumps.length);
    }
  });
  it('plans one future round for Doubao and all remaining rounds for Juewu', () => {
    const view = rules.project(
      rules.initialize({
        seats: ['S1', 'S2', 'S3'],
        random: new RandomSource(6),
      }),
      { role: 'player', seatId: 'S1' },
    ) as ModernArtView;
    const signal = new AbortController().signal;
    const basic = new RoundPlanner(
      view,
      observeMemory(null, view, 0),
      0,
      signal,
    );
    const doubao = new RoundPlanner(
      view,
      observeMemory(null, view, 1),
      1,
      signal,
    );
    const juewu = new RoundPlanner(
      view,
      observeMemory(null, view, 2),
      2,
      signal,
    );
    expect([basic.horizon, doubao.horizon, juewu.horizon]).toEqual([0, 1, 3]);
    expect(basic.portfolio(view.self!.hand)).toBe(0);
    expect(doubao.portfolio(view.self!.hand)).toBeGreaterThan(0);
    expect(juewu.portfolio(view.self!.hand)).toBeGreaterThan(
      doubao.portfolio(view.self!.hand),
    );
    expect(juewu.cashReserve()).toBeGreaterThan(doubao.cashReserve());
    const final = { ...view, round: 4 };
    const finalPlan = new RoundPlanner(
      final,
      observeMemory(null, final, 2),
      2,
      signal,
    );
    expect(finalPlan.portfolio(final.self!.hand)).toBe(0);
    expect(finalPlan.cashReserve()).toBe(0);
    const cancel = new AbortController();
    const cancellable = new RoundPlanner(
      view,
      observeMemory(null, view, 2),
      2,
      cancel.signal,
    );
    cancel.abort();
    expect(() => cancellable.portfolio(view.self!.hand)).toThrow('取消');
  });
  it('keeps a painting with more future auction potential while later rounds remain', async () => {
    const state = rules.initialize({
      seats: ['S1', 'S2', 'S3'],
      random: new RandomSource(1),
    }) as State;
    const choices: JsonValue[] = [];
    // Compare the same authorized opening market with and without later rounds.
    for (const round of [1, 4]) {
      const view = rules.project(state, {
        role: 'player',
        seatId: 'S1',
      }) as ModernArtView;
      view.round = round;
      const choice = await bot.decide({
        view,
        actions: rules.legalActions(state, 'S1'),
        decision: decisions(state)[0]!,
        memory: null,
        difficulty: 'juewu',
        random: new RandomSource(1),
        signal: new AbortController().signal,
      });
      expect(rules.legalActions(state, 'S1')).toContainEqual(choice.action);
      choices.push(choice.action);
    }
    expect(choices).toEqual([
      { type: 'offer', cardId: 'ramon-13' },
      { type: 'offer', cardId: 'rafael-14' },
    ]);
  });
});
