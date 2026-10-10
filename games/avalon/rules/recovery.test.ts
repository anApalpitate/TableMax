import { describe, expect, it } from 'vitest';
import { decisions, rulesByVariant, validateState } from './index';
import { alignment, type State } from './state';
import {
  apply,
  approve,
  context,
  fixture,
  quest,
  reveal,
} from './test-fixtures';
describe('阿瓦隆持久化状态与回退边界', () => {
  it('reveal/vote/quest的部分提交JSON往返恢复保留选择和其余稳定决策', () => {
    let s = fixture('court', 6);
    s = apply(s, { type: 'acknowledge' }, 'a');
    const stages = [s];
    s = reveal(s);
    s = apply(s, { type: 'propose-team', team: ['a', 'b'] }, s.leader);
    s = apply(s, { type: 'vote-team', vote: 'approve' }, 'a');
    stages.push(s);
    for (const seat of s.seats.filter((seat) => seat !== 'a'))
      s = apply(s, { type: 'vote-team', vote: 'approve' }, seat);
    s = apply(s, { type: 'quest-card', card: 'success' }, 'a');
    stages.push(s);
    for (const before of stages) {
      const original = structuredClone(before);
      const restored = validateState(
        JSON.parse(JSON.stringify(before)),
        before.seats,
        'court',
      );
      expect(restored).toEqual(before);
      expect(decisions(restored)).toEqual(decisions(before));
      restored.roles.a = 'servant';
      expect(before).toEqual(original);
    }
  });
  it('同一before与同意图重演相同；不修改checkpoint输入；失败意图无副作用', () => {
    const before = reveal(fixture());
    const copy = structuredClone(before),
      rules = rulesByVariant.classic;
    const action = {
      type: 'propose-team',
      team: before.seats.slice(0, 2),
    } as const;
    const first = rules.apply(
      before,
      action,
      before.leader,
      context(37, before.seats),
    );
    const second = rules.apply(
      before,
      action,
      before.leader,
      context(37, before.seats),
    );
    expect(first).toEqual(second);
    expect(before).toEqual(copy);
    expect(() =>
      rules.apply(
        before,
        { type: 'quest-card', card: 'fail' },
        before.leader,
        context(),
      ),
    ).toThrow();
    expect(before).toEqual(copy);
  });
  it('历史票/任务、失败数、队长、当前阶段与虚假赢家篡改全部拒绝', () => {
    let s = reveal(fixture());
    const evil = s.seats.find((seat) => alignment(s.roles[seat]!) === 'evil')!;
    s = quest(
      approve(
        s,
        [evil, ...s.seats.filter((seat) => seat !== evil)].slice(0, 2),
      ),
      [evil],
    );
    const mutations: ((input: State) => void)[] = [
      (input) => {
        input.history[0]!.approved = false;
      },
      (input) => {
        input.history[0]!.votes.a = 'reject';
        input.history[0]!.votes.b = 'reject';
        input.history[0]!.votes.c = 'reject';
      },
      (input) => {
        input.quests[0]!.failCount = 2;
      },
      (input) => {
        input.quests[0]!.succeeded = true;
      },
      (input) => {
        input.leader = input.seats.find((seat) => seat !== input.leader)!;
      },
      (input) => {
        input.questNumber = 5;
      },
      (input) => {
        input.phase = 'assassinate';
      },
      (input) => {
        input.winner = 'good';
        input.winReason = 'merlin-survived';
      },
    ];
    for (const mutate of mutations) {
      const copy = structuredClone(s);
      mutate(copy);
      expect(() => validateState(copy, s.seats)).toThrow();
    }
  });
});
