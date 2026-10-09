import { describe, expect, it } from 'vitest';
import type { BotDifficulty, JsonValue } from '@tablemax/game-sdk';
import { bot } from './index';
import { context } from '../rules/test-fixtures';
import {
  rules,
  initialize,
  legalActions,
  project,
  validateState,
  isLegalAction,
} from '../rules';
import type { State } from '../rules/state';
async function match(
  seed: number,
  difficulty: BotDifficulty,
  count: number,
): Promise<{ state: State; steps: number; rounds: number }> {
  const seats = Array.from({ length: count }, (_, i) => `seat-${i + 1}`),
    ctx = context(seed, seats),
    random = context(seed + 100000, seats).random;
  let s = initialize(ctx),
    steps = 0;
  const memories: Record<string, JsonValue> = Object.fromEntries(
    seats.map((seat) => [seat, null]),
  );
  while (!rules.ended(s) && steps < 15000) {
    if (s.phase === 'round-result')
      s = rules.applyLifecycle(s, { type: 'next-round' }, ctx).state as State;
    else {
      const decision = rules.decisions(s)[0]!;
      if (!decision) throw new Error('UNO bot stuck without decision');
      const view = project(s, { role: 'player', seatId: decision.seatId });
      const result = await bot.decide({
        view,
        actions: legalActions(s, decision.seatId),
        decision,
        memory: memories[decision.seatId]!,
        difficulty,
        random,
        signal: new AbortController().signal,
      });
      expect(isLegalAction(s, result.action, decision.seatId)).toBe(true);
      const before = structuredClone(s);
      const input = s;
      s = rules.apply(s, result.action, decision.seatId, ctx).state as State;
      expect(input).toEqual(before);
      memories[decision.seatId] = result.memory;
    }
    s = validateState(s, seats);
    for (const seat of seats)
      memories[seat] = bot.observe!({
        view: project(s, { role: 'player', seatId: seat }),
        memory: memories[seat]!,
        seatId: seat,
        difficulty,
      });
    steps++;
  }
  if (steps >= 15000)
    throw new Error(
      `UNO match exceeded 15000 decisions ${seed}/${difficulty}/${count}`,
    );
  return { state: s, steps, rounds: s.roundNumber };
}
describe('UNO完整500分整场三档固定种子', () => {
  for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
    for (const count of [2, 4, 6])
      it(`${difficulty}/${count}人，三组seed每次动作与读档验证直到500分`, async () => {
        for (const seed of [17, 319, 20261010]) {
          const result = await match(seed, difficulty, count);
          expect(result.state.phase).toBe('ended');
          expect(result.state.winners).toHaveLength(1);
          expect(
            result.state.scores[result.state.winners[0]!],
          ).toBeGreaterThanOrEqual(500);
          expect(result.steps).toBeGreaterThan(10);
          expect(rules.decisions(result.state)).toEqual([]);
          expect(rules.lifecycleActions(result.state)).toEqual([]);
        }
      }, 30000);
  }
  it('相同seed和输入产生同一完整结局，未消耗或泄漏另一座位规则随机源', async () => {
    const a = await match(781, 'juewu', 4),
      b = await match(781, 'juewu', 4);
    expect(a).toEqual(b);
  }, 30000);
});
