import { describe, expect, it } from 'vitest';
import {
  rulesByVariant,
  decisions,
  isLegalAction,
  legalActions,
  validateAction,
  validateState,
} from './index';
import { alignment, questSizes } from './state';
import {
  apply,
  approve,
  context,
  fixture,
  quest,
  reveal,
} from './test-fixtures';
describe('阿瓦隆2012经典规则与公开边界', () => {
  it('5/6人阵营与classic/court角色精确，随机及恢复可重演', () => {
    for (const variant of ['classic', 'court'] as const)
      for (const count of [5, 6]) {
        const s = fixture(variant, count);
        expect(
          s.seats.filter((seat) => alignment(s.roles[seat]!) === 'evil'),
        ).toHaveLength(2);
        expect(
          Object.values(s.roles).filter((role) => role === 'merlin'),
        ).toHaveLength(1);
        expect(
          Object.values(s.roles).filter((role) => role === 'assassin'),
        ).toHaveLength(1);
        expect(s).toEqual(
          rulesByVariant[variant].initialize(context(37, s.seats)),
        );
        expect(validateState(JSON.parse(JSON.stringify(s)), s.seats)).toEqual(
          s,
        );
      }
    expect(() =>
      rulesByVariant.classic.initialize(context(37, ['a', 'b', 'c', 'd'])),
    ).toThrow();
    expect(questSizes(5)).toEqual([2, 3, 2, 3, 3]);
    expect(questSizes(6)).toEqual([2, 3, 4, 3, 4]);
  });
  it('全员确认、投票和队员任务独立决策id稳定，提名可不含队长', () => {
    let s = fixture();
    const original = structuredClone(s);
    const before = decisions(s).find((d) => d.seatId === 'b')!;
    s = apply(s, { type: 'acknowledge' }, 'a');
    expect(decisions(s).find((d) => d.seatId === 'b')).toEqual(before);
    expect(original).toEqual(fixture());
    s = reveal(s);
    const team = s.seats.filter((seat) => seat !== s.leader).slice(0, 2);
    expect(
      isLegalAction(
        s,
        { type: 'propose-team', team: [...team].reverse() },
        s.leader,
      ),
    ).toBe(true);
    expect(
      isLegalAction(
        s,
        { type: 'propose-team', team: [...team, 'unknown'] },
        s.leader,
      ),
    ).toBe(false);
    s = apply(s, { type: 'propose-team', team }, s.leader);
    const pending = decisions(s).find((d) => d.seatId === 'b')!;
    s = apply(s, { type: 'vote-team', vote: 'reject' }, 'a');
    expect(decisions(s).find((d) => d.seatId === 'b')).toEqual(pending);
    expect(legalActions(s, 'a')).toEqual([]);
  });
  it('秘密投票直到全员提交公开，六人平票拒绝并轮转队长', () => {
    let s = reveal(fixture('court', 6));
    const oldLeader = s.leader;
    s = apply(s, { type: 'propose-team', team: s.seats.slice(0, 2) }, s.leader);
    for (let i = 0; i < 6; i++)
      s = apply(
        s,
        { type: 'vote-team', vote: i < 3 ? 'approve' : 'reject' },
        s.seats[i]!,
      );
    expect(s.phase).toBe('team');
    expect(s.rejectedTeams).toBe(1);
    expect(s.leader === oldLeader).toBe(false);
    expect(s.history[0]!.votes).toEqual({
      a: 'approve',
      b: 'approve',
      c: 'approve',
      d: 'reject',
      e: 'reject',
      f: 'reject',
    });
  });
  it('连续五次否决立即邪恶获胜，合法动作清空', () => {
    let s = reveal(fixture());
    for (let n = 0; n < 5; n++) {
      s = apply(
        s,
        { type: 'propose-team', team: s.seats.slice(0, 2) },
        s.leader,
      );
      for (const seat of s.seats)
        s = apply(s, { type: 'vote-team', vote: 'reject' }, seat);
    }
    expect(s.phase).toBe('ended');
    expect(s.winReason).toBe('five-rejections');
    expect(s.winner).toBe('evil');
    expect(decisions(s)).toEqual([]);
  });
  it('好人只能成功，邪恶可成功或失败，任务只公开匿名失败张数并重置否决', () => {
    let s = reveal(fixture());
    const evil = s.seats.find((seat) => alignment(s.roles[seat]!) === 'evil')!;
    const good = s.seats.find((seat) => alignment(s.roles[seat]!) === 'good')!;
    s = apply(s, { type: 'propose-team', team: [evil, good] }, s.leader);
    for (const seat of s.seats)
      s = apply(s, { type: 'vote-team', vote: 'reject' }, seat);
    s = approve(s, [evil, good]);
    expect(isLegalAction(s, { type: 'quest-card', card: 'fail' }, good)).toBe(
      false,
    );
    expect(legalActions(s, evil)).toHaveLength(2);
    const old = structuredClone(s);
    s = quest(s, [evil]);
    expect(s.quests[0]!.failCount).toBe(1);
    expect(s.questCards).toEqual({});
    expect(s.rejectedTeams).toBe(0);
    expect(s.questNumber).toBe(2);
    expect(old.quests).toEqual([]);
  });
  it('三次失败结束；三次成功仍需刺杀，刺中/刺错分别判胜', () => {
    for (const outcome of ['fail', 'hit', 'miss']) {
      let s = reveal(fixture());
      for (let n = 0; n < 3; n++) {
        const evil = s.seats.find(
          (seat) => alignment(s.roles[seat]!) === 'evil',
        )!;
        const team = [evil, ...s.seats.filter((seat) => seat !== evil)].slice(
          0,
          questSizes(5)[n],
        );
        s = quest(approve(s, team), outcome === 'fail' ? [evil] : []);
      }
      if (outcome === 'fail') {
        expect(s.winReason).toBe('three-failures');
        continue;
      }
      expect(s.phase).toBe('assassinate');
      expect(s.winner).toBeNull();
      const assassin = s.seats.find((seat) => s.roles[seat] === 'assassin')!;
      const target = s.seats.find((seat) =>
        outcome === 'hit'
          ? s.roles[seat] === 'merlin'
          : s.roles[seat] === 'servant',
      )!;
      expect(
        isLegalAction(s, { type: 'assassinate', target: assassin }, assassin),
      ).toBe(false);
      s = apply(s, { type: 'assassinate', target }, assassin);
      expect(s.winner).toBe(outcome === 'hit' ? 'evil' : 'good');
    }
  });
  it('动作、seat、角色、票数、历史和胜负篡改拒绝，不能恢复另variant', () => {
    const original = fixture();
    const samples = [
      () => ({
        ...original,
        roles: Object.fromEntries(
          original.seats.map((seat) => [seat, 'merlin']),
        ),
      }),
      () => ({ ...original, phase: 'ended', winner: 'good' }),
      () => ({ ...original, actionSerial: 9 }),
      () => ({ ...original, votes: { a: 'approve' } }),
      () => ({ ...original, seats: [...original.seats].reverse() }),
    ];
    for (const corrupt of samples)
      expect(() => validateState(corrupt(), original.seats)).toThrow();
    expect(() =>
      rulesByVariant.court.validateState(original, original.seats),
    ).toThrow();
    expect(() =>
      validateAction({ type: 'quest-card', card: 'success', role: 'merlin' }),
    ).toThrow();
    expect(() =>
      validateAction({ type: 'propose-team', team: ['a', 'a'] }),
    ).toThrow();
  });
});
