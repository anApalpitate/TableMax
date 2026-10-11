import { describe, expect, it } from 'vitest';
import {
  rulesByVariant,
  legalActions,
  decisions,
  validateState,
} from './index';
import { context, fixture, reveal } from './test-fixtures';
import type { State } from './state';
describe('逆时针讨论、管理员跳过及旧存档', () => {
  for (const variant of ['classic', 'court'] as const)
    for (const count of [5, 6, 7, 8, 9, 10])
      it(`${variant} ${count}人逐人发言后才密投`, () => {
        const rules = rulesByVariant[variant];
        let s = reveal(fixture(variant, count));
        const ctx = context(37, s.seats);
        s = rules.apply(s, legalActions(s, s.leader)[0]!, s.leader, ctx)
          .state as State;
        expect(s.phase).toBe('discussion');
        const order = s.discussion!.order;
        expect(order.at(-1)).toBe(s.leader);
        expect(order[0]).toBe(
          s.seats[(s.seats.indexOf(s.leader) + count - 1) % count],
        );
        for (let i = 0; i < count; i++) {
          expect(decisions(s).map((d) => d.seatId)).toEqual([order[i]]);
          expect(() =>
            rules.apply(
              s,
              { type: 'vote-team', vote: 'approve' },
              order[i]!,
              ctx,
            ),
          ).toThrow();
          const restored = validateState(
            JSON.parse(JSON.stringify(s)),
            s.seats,
          );
          expect(restored).toEqual(s);
          if (i === 1) {
            const action = { type: 'skip-discussion', target: order[i]! };
            expect(rules.lifecyclePermission!(s, action)).toBe('host');
            expect(() => rules.apply(s, action, order[i]!, ctx)).toThrow();
            s = rules.applyLifecycle(s, action, ctx).state as State;
            expect(s.latest!.actor).toBeNull();
            expect(s.latest!.targets).toEqual([order[i]]);
          } else
            s = rules.apply(s, { type: 'finish-discussion' }, order[i]!, ctx)
              .state as State;
          validateState(s, s.seats);
          expect(() =>
            rules.apply(s, { type: 'finish-discussion' }, order[i]!, ctx),
          ).toThrow();
        }
        expect(s.phase).toBe('vote');
        expect(decisions(s)).toHaveLength(count);
        for (const seat of s.seats)
          s = rules.apply(s, { type: 'vote-team', vote: 'reject' }, seat, ctx)
            .state as State;
        s = rules.apply(s, legalActions(s, s.leader)[0]!, s.leader, ctx)
          .state as State;
        expect(s.discussion!.completed).toEqual([]);
        validateState(s, s.seats);
      });
  it('旧字段补齐且不倒退投票，伪造进度拒绝恢复', () => {
    const s = reveal(fixture());
    const legacy = structuredClone(s) as Partial<State>;
    delete legacy.discussion;
    delete legacy.discussionActions;
    expect(validateState(legacy, s.seats)).toEqual(s);
    const rules = rulesByVariant.classic;
    const d = rules.apply(s, legalActions(s, s.leader)[0]!, s.leader, context())
      .state as State;
    const bad = structuredClone(d);
    bad.discussion!.completed = [bad.leader];
    expect(() => validateState(bad, bad.seats)).toThrow();
    const oldVote = {
      ...legacy,
      phase: 'vote',
      team: d.team,
      actionSerial: s.actionSerial + 1,
      latest: d.latest,
    };
    const restored = validateState(oldVote, s.seats);
    expect(restored.phase).toBe('vote');
    expect(restored.discussion).toBeNull();
  });
});
