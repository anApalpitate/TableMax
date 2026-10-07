import { legacyRules as rules } from '../legacy-test';
import { expect, it } from 'vitest';

import { RandomSource } from '../../../../packages/platform-core/src/random';
import { observeMemory, validateMemory } from './memory';
import { bot } from './index';
import type { JsonValue } from '@tablemax/game-sdk';
import type { Action } from '../state';
const context = () => ({ seats: ['a', 'b'], random: new RandomSource(54321) });
function dealt() {
  const ctx = context();
  let state = rules.initialize(ctx);
  for (const seat of ctx.seats)
    state = rules.apply(
      state,
      { type: 'vote-research', taskId: state.researchCandidates[0]! },
      seat,
      ctx,
    ).state;
  return { ctx, state };
}
it('retains legally public cards through cover, moves them through public swap, and rejects corrupt memory', () => {
  const { state } = dealt();
  state.boards.a![0]!.faceUp = true;
  state.boards.a![1]!.faceUp = true;
  const memory = observeMemory(
    null,
    rules.project(state, { role: 'player', seatId: 'a' }),
    'a',
    'default',
  );
  const before = memory.known.a!.map((k) => k?.category ?? null);
  state.boards.a![0]!.faceUp = false;
  state.boards.a![1]!.faceUp = false;
  [state.boards.a![0], state.boards.a![1]] = [
    state.boards.a![1]!,
    state.boards.a![0]!,
  ];
  state.events.push({
    id: state.eventCounter + 1,
    kind: 'action',
    text: '公开交换',
    action: {
      actor: 'b',
      verb: 'ninja-swap',
      cardCategory: null,
      ability: 'greninja',
      targets: [{ seat: 'a', slots: [0, 1] }],
    },
  });
  const moved = observeMemory(
    memory,
    rules.project(state, { role: 'player', seatId: 'a' }),
    'a',
    'default',
  );
  expect(moved.known.a![0]?.category).toBe(before[1]);
  expect(moved.known.a![1]?.category).toBe(before[0]);
  expect(() =>
    validateMemory({ ...moved, known: { a: [{ category: 'forged' }] } }),
  ).toThrow();
});
it('bounds private information by difficulty without accessing hidden truth', () => {
  const { state } = dealt();
  const view = rules.project(state, { role: 'player', seatId: 'a' });
  view.peek = {
    seat: 'b',
    cards: [0, 1, 2].map((slot) => ({
      slot,
      card: {
        categoryId: 'ordinary-1',
        assetId: 'ordinary-1',
        name: '伊布',
        value: 1,
        ability: null,
        abilityUsed: false,
        abilityText: null,
        copy: null,
      },
    })),
  };
  expect(
    Object.values(observeMemory(null, view, 'a', 'default').known)
      .flat()
      .filter((k) => k?.source === 'private'),
  ).toHaveLength(2);
  expect(
    Object.values(observeMemory(null, view, 'a', 'doubao').known)
      .flat()
      .filter((k) => k?.source === 'private'),
  ).toHaveLength(3);
});
it.each(['default', 'doubao', 'juewu'] as const)(
  'completes bounded real rules games at %s',
  async (difficulty) => {
    const ctx = context();
    let state = rules.initialize(ctx);
    const memories: Record<string, JsonValue> = { a: null, b: null };
    for (let step = 0; step < 2500 && !rules.ended(state); step++) {
      if (state.phase === 'round-result') {
        state = rules.applyLifecycle(state, { type: 'next-round' }, ctx).state;
        continue;
      }
      const decision = rules.decisions(state)[0]!;
      const view = rules.project(state, {
        role: 'player',
        seatId: decision.seatId,
      });
      const result = await bot.decide({
        view,
        actions: rules.legalActions(state, decision.seatId),
        decision,
        memory: memories[decision.seatId]!,
        difficulty,
        random: ctx.random,
        signal: new AbortController().signal,
      });
      expect(rules.legalActions(state, decision.seatId)).toContainEqual(
        result.action,
      );
      memories[decision.seatId] = result.memory;
      state = rules.apply(
        state,
        result.action as Action,
        decision.seatId,
        ctx,
      ).state;
      for (const seat of ctx.seats)
        memories[seat] = observeMemory(
          memories[seat]!,
          rules.project(state, { role: 'player', seatId: seat }),
          seat,
          difficulty,
        );
    }
    expect(rules.ended(state)).toBe(true);
  },
  30000,
);
