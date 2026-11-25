import { discuss } from '../rules/test-fixtures';
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
import { pressureNomination } from './test-fixtures';
import { influentialOpponent } from './mischief';
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
          while (s.phase !== 'ended' && steps < 650) {
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
          expect(steps).toBeLessThan(650);
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
      s = discuss(s);
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

describe('Avalon configured Mischief', () => {
  const seven = () => context(37, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);

  it.each(['good', 'evil'] as const)(
    'avoids a publicly influential likely opponent without reducing the %s task goal',
    (side) => {
      const s = pressureNomination(seven(), side);
      expect(s.leader).toBe('a');
      expect(s.questNumber).toBe(4);
      const v = project(s, { role: 'player', seatId: 'a' });
      const choices = legalActions(s, 'a');
      const beliefs = hypotheses(v, 'juewu');
      expect(influentialOpponent(v, beliefs)).toBe('b');
      const a = chooseAction(v, choices, 'juewu', { next: () => 0 });
      const b = chooseAction(v, choices, 'mischief', { next: () => 0 });
      expect(a).toMatchObject({
        type: 'propose-team',
        team: expect.arrayContaining(['b']),
      });
      expect(b.type).toBe('propose-team');
      if (a.type !== 'propose-team' || b.type !== 'propose-team')
        throw new Error('No legal proposal');
      expect(b.team).not.toContain('b');
      expect(cleanProbability(b.team, beliefs, 2)).toBeCloseTo(
        cleanProbability(a.team, beliefs, 2),
      );
      expect(choices).toContainEqual(b);
      const next = apply(s, b, 'a');
      expect(next.phase).toBe('discussion');
    },
  );

  it.each([5, 6, 7, 8, 9, 10])(
    'completes a configured %i-seat match with all decisions authorized',
    async (count) => {
      const ctx = context(
        71 + count,
        Array.from({ length: count }, (_, index) => 'S' + index),
      );
      const rules = rulesByVariant.configured;
      const style = botsByVariant.configured;
      let state = rules.initialize(ctx) as State;
      let steps = 0;
      while (state.phase !== 'ended' && steps++ < 650) {
        const decision = decisions(state)[0]!;
        const actions = legalActions(state, decision.seatId);
        const view = project(state, {
          role: 'player',
          seatId: decision.seatId,
        });
        const choice = await style.decide({
          view,
          actions,
          decision,
          memory: null,
          difficulty: 'mischief',
          random: ctx.random,
          signal: new AbortController().signal,
        });
        expect(actions).toContainEqual(choice.action);
        expect(choice.memory).toBeNull();
        state = rules.apply(state, choice.action, decision.seatId, ctx)
          .state as State;
        rules.validateState(state, state.seats);
      }
      expect(state.phase).toBe('ended');
      expect(steps).toBeLessThan(650);
    },
  );

  it('keeps sealed voting and the final rejection guard under the faction policy', () => {
    let state = pressureNomination(seven());
    state = discuss(
      apply(
        state,
        { type: 'propose-team', team: ['a', 'b', 'c', 'e'] },
        state.leader,
      ),
    );
    for (const seat of state.seats)
      state = apply(state, { type: 'vote-team', vote: 'reject' }, seat);
    expect(state.rejectedTeams).toBe(4);
    state = discuss(
      apply(
        state,
        { type: 'propose-team', team: ['b', 'c', 'd', 'e'] },
        state.leader,
      ),
    );
    const seat = { role: 'player', seatId: 'a' } as const;
    const approveState = apply(
      state,
      { type: 'vote-team', vote: 'approve' },
      'f',
    );
    const rejectState = apply(
      state,
      { type: 'vote-team', vote: 'reject' },
      'f',
    );
    const a = project(approveState, seat);
    const b = project(rejectState, seat);
    expect(a).toEqual(b);
    expect(a.submittedSeats).toEqual(['f']);
    const choice = chooseAction(
      a,
      legalActions(approveState, 'a'),
      'mischief',
      { next: () => 0 },
    );
    expect(choice).toEqual({ type: 'vote-team', vote: 'approve' });
    expect(
      chooseAction(b, legalActions(rejectState, 'a'), 'mischief', {
        next: () => 0,
      }),
    ).toEqual(choice);
  });

  it('only exposes Mischief on the current configured rules and leaves old strategies intact', () => {
    expect(botsByVariant.configured).toMatchObject({
      version: '1.1.0',
      difficulties: ['default', 'doubao', 'juewu', 'mischief'],
    });
    for (const old of [botsByVariant.classic, botsByVariant.court])
      expect(old).toMatchObject({
        version: '1.0.0',
        difficulties: ['default', 'doubao', 'juewu'],
      });
  });
});
