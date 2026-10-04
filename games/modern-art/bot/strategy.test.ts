import { deepStrictEqual } from 'node:assert';
import { describe, expect, it } from 'vitest';
import { bot } from './index';
import { rules, decisions } from '../rules';
import type { State } from '../rules/state';
import type { ModernArtView } from '../ui/view';
import { RandomSource } from '../../../packages/platform-core/src/random';
import { CARDS, getCard } from '../data/catalog';
import { countCards } from '../rules/scoring';

describe('Modern Art independent local strategies', () => {
  it('plays seeded 3/4/5-player matches at all three levels with per-intent save validation', async () => {
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
              const choice = await bot.decide({
                view: rules.project(s, {
                  role: 'player',
                  seatId: decision.seatId,
                }),
                actions,
                decision,
                memory: null,
                difficulty,
                random: botRandom,
                signal: new AbortController().signal,
              });
              expect(actions).toContainEqual(choice.action);
              expect(choice.memory).toBeNull();
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
});
