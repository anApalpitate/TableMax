import { describe, expect, it } from 'vitest';
import {
  botsByVariant,
  chooseAction,
  cleanProbability,
  hypotheses,
} from './index';
import { rulesByVariant, legalActions, decisions } from '../rules';
import { project } from '../rules/project';
import {
  apply,
  approve,
  context,
  fixture,
  quest,
  reveal,
} from '../rules/test-fixtures';
import { alignment, questSizes, type State } from '../rules/state';
import type { Action } from '../types';
describe('阿瓦隆独立三档策略', () => {
  it('每档每variant完成固定种子整局，覆盖所有决策并严格合法', async () => {
    for (const variant of ['classic', 'court'] as const)
      for (const difficulty of ['default', 'doubao', 'juewu'] as const)
        for (const seed of [7, 37, 83]) {
          const rules = rulesByVariant[variant],
            bot = botsByVariant[variant],
            ctx = context(seed, ['a', 'b', 'c', 'd', 'e', 'f']);
          let s = rules.initialize(ctx) as State,
            steps = 0;
          while (s.phase !== 'ended' && steps < 240) {
            const decision = decisions(s)[0]!;
            const chosen = await bot.decide({
              view: project(s, { role: 'player', seatId: decision.seatId }),
              actions: legalActions(s, decision.seatId),
              decision,
              memory: null,
              difficulty,
              random: ctx.random,
              signal: new AbortController().signal,
            });
            expect(legalActions(s, decision.seatId)).toContainEqual(
              chosen.action,
            );
            s = rules.apply(s, chosen.action, decision.seatId, ctx)
              .state as State;
            s = rules.validateState(s, ctx.seats) as State;
            steps++;
          }
          expect(s.phase).toBe('ended');
          expect(steps).toBeLessThan(240);
        }
  });
  it('授权已知坏人不进梅林队伍，任务成功仍不证明所有人善良', () => {
    let s = reveal(fixture());
    const merlin = s.seats.find((seat) => s.roles[seat] === 'merlin')!;
    while (s.leader !== merlin) {
      s = apply(
        s,
        { type: 'propose-team', team: s.seats.slice(0, 2) },
        s.leader,
      );
      for (const seat of s.seats)
        s = apply(s, { type: 'vote-team', vote: 'reject' }, seat);
      if (s.phase === 'ended') throw new Error('fixture rotation exceeded');
    }
    const view = project(s, { role: 'player', seatId: merlin });
    const action = chooseAction(
      view,
      legalActions(s, merlin),
      'juewu',
      context().random,
    ) as Extract<Action, { type: 'propose-team' }>;
    expect(
      action.team.every((seat) => alignment(s.roles[seat]!) === 'good'),
    ).toBe(true);
    let other = reveal(fixture());
    const servant = other.seats.find(
      (seat) => other.roles[seat] === 'servant',
    )!;
    other = quest(approve(other, other.seats.slice(0, 2)));
    const beliefs = hypotheses(
      project(other, { role: 'player', seatId: servant }),
      'juewu',
    );
    expect(cleanProbability(other.quests[0]!.team, beliefs)).toBeLessThan(1);
  });
  it('更高档用两次公开失败交集排险，默认仅看最近结果；全员第五次必须避免直接败局', () => {
    let s = reveal(fixture());
    const evil = s.seats.find((seat) => alignment(s.roles[seat]!) === 'evil')!;
    const good = s.seats.filter((seat) => alignment(s.roles[seat]!) === 'good');
    s = quest(approve(s, [evil, good[0]!]), [evil]);
    s = quest(approve(s, [evil, good[1]!, good[2]!]), [evil]);
    const view = project(s, { role: 'player', seatId: good[0]! });
    const basic = hypotheses(view, 'default'),
      stronger = hypotheses(view, 'doubao');
    expect(stronger.length).toBeLessThan(basic.length);
    expect(stronger.every((h) => h.evil.includes(evil))).toBe(true);
    expect(questSizes(s.seats.length)[s.questNumber - 1]).toBe(2);
  });
  it('高档多个已知邪恶只一人破坏，默认双破坏；取消与身份/记忆越权拒绝', async () => {
    let s = reveal(fixture());
    const evil = s.seats.filter((seat) => alignment(s.roles[seat]!) === 'evil');
    s = approve(s, evil);
    const view = project(s, { role: 'player', seatId: evil[1]! });
    expect(
      chooseAction(
        view,
        legalActions(s, evil[1]!),
        'default',
        context().random,
      ),
    ).toEqual({ type: 'quest-card', card: 'fail' });
    expect(
      chooseAction(view, legalActions(s, evil[1]!), 'doubao', context().random),
    ).toEqual({ type: 'quest-card', card: 'success' });
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      chooseAction(
        view,
        legalActions(s, evil[1]!),
        'juewu',
        context().random,
        controller.signal,
      ),
    ).toThrow();
    expect(() => botsByVariant.classic.validateMemory({})).toThrow();
    await expect(
      botsByVariant.classic.decide({
        view,
        actions: legalActions(s, evil[1]!),
        decision: { id: 'wrong', seatId: evil[0]! },
        memory: null,
        difficulty: 'default',
        random: context().random,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
  });
});
