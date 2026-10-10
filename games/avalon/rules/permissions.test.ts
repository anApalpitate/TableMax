import { describe, expect, it } from 'vitest';
import { project, roleKnowledge } from './project';
import { rulesByVariant, decisions } from './index';
import { alignment } from './state';
import { apply, approve, fixture, quest, reveal } from './test-fixtures';
describe('阿瓦隆秘密投影与保存反馈', () => {
  it('public和陌生玩家零秘密；本人角色/知识精确，court派西维尔候选无真假标记', () => {
    for (const variant of ['classic', 'court'] as const) {
      const s = fixture(variant);
      const publicView = project(s, { role: 'public' });
      expect(publicView.self).toBeNull();
      expect(publicView.revealedRoles).toBeNull();
      expect(publicView.assassin).toBeNull();
      expect(
        /"roles"|"evilSeats"|"merlinCandidates"/.test(
          JSON.stringify(publicView),
        ),
      ).toBe(false);
      expect(project(s, { role: 'player', seatId: 'outsider' })).toEqual(
        publicView,
      );
      for (const seat of s.seats) {
        const self = project(s, { role: 'player', seatId: seat }).self!;
        expect(self.role).toBe(s.roles[seat]);
        if (self.role === 'merlin')
          expect(self.knowledge.evilSeats).toEqual(
            s.seats.filter((id) => alignment(s.roles[id]!) === 'evil'),
          );
        else if (self.role === 'percival') {
          expect(self.knowledge.merlinCandidates).toHaveLength(2);
          expect(self.knowledge.evilSeats).toEqual([]);
        } else if (self.alignment === 'evil')
          expect(self.knowledge.evilSeats).toEqual(
            s.seats.filter(
              (id) => id !== seat && alignment(s.roles[id]!) === 'evil',
            ),
          );
        else
          expect(self.knowledge).toEqual({
            evilSeats: [],
            merlinCandidates: [],
          });
      }
    }
  });
  it('原版可选角色知识工具排除Mordred及Oberon，不能把参考角色混入当前牌组', () => {
    const roles = {
      a: 'merlin',
      b: 'mordred',
      c: 'oberon',
      d: 'assassin',
      e: 'servant',
    } as const;
    expect(roleKnowledge(roles, Object.keys(roles), 'a').evilSeats).toEqual([
      'c',
      'd',
    ]);
    expect(roleKnowledge(roles, Object.keys(roles), 'c').evilSeats).toEqual([]);
    expect(roleKnowledge(roles, Object.keys(roles), 'd').evilSeats).toEqual([
      'b',
    ]);
  });
  it('中间投票/任务公开投影、反馈、checkpoint相同而本人可见自己的已保存选择', () => {
    let s = reveal(fixture());
    const evil = s.seats.find((seat) => alignment(s.roles[seat]!) === 'evil')!;
    const good = s.seats.find((seat) => alignment(s.roles[seat]!) === 'good')!;
    s = apply(s, { type: 'propose-team', team: [evil, good] }, s.leader);
    const a = rulesByVariant.classic.apply(
      s,
      { type: 'vote-team', vote: 'approve' },
      evil,
      { seats: s.seats, random: { next: () => 0.5 } },
    );
    const b = rulesByVariant.classic.apply(
      s,
      { type: 'vote-team', vote: 'reject' },
      evil,
      { seats: s.seats, random: { next: () => 0.5 } },
    );
    expect(rulesByVariant.classic.project(a.state, { role: 'public' })).toEqual(
      rulesByVariant.classic.project(b.state, { role: 'public' }),
    );
    expect(a.events).toEqual(b.events);
    expect(a.decision).toEqual(b.decision);
    s = approve(reveal(fixture()), [evil, good]);
    const success = rulesByVariant.classic.apply(
      s,
      { type: 'quest-card', card: 'success' },
      evil,
      { seats: s.seats, random: { next: () => 0.5 } },
    );
    const fail = rulesByVariant.classic.apply(
      s,
      { type: 'quest-card', card: 'fail' },
      evil,
      { seats: s.seats, random: { next: () => 0.5 } },
    );
    expect(
      rulesByVariant.classic.project(success.state, { role: 'public' }),
    ).toEqual(rulesByVariant.classic.project(fail.state, { role: 'public' }));
    expect(success.events).toEqual(fail.events);
    expect(success.decision).toEqual(fail.decision);
    expect(
      project(fail.state as typeof s, { role: 'player', seatId: evil }).self!
        .questCard,
    ).toBe('fail');
    expect(
      project(fail.state as typeof s, { role: 'player', seatId: good }).self!
        .questCard,
    ).toBeNull();
    const stable = decisions(s).find((d) => d.seatId === good);
    expect(
      decisions(fail.state as typeof s).find((d) => d.seatId === good),
    ).toEqual(stable);
  });
  it('失败牌提交者不写入任务记录；终局才揭全部角色并声明共同赢家', () => {
    let s = reveal(fixture());
    const evil = s.seats.find((seat) => alignment(s.roles[seat]!) === 'evil')!;
    for (let n = 0; n < 3; n++)
      s = quest(
        approve(
          s,
          [evil, ...s.seats.filter((seat) => seat !== evil)].slice(
            0,
            [2, 3, 2][n],
          ),
        ),
        [evil],
      );
    const view = project(s, { role: 'public' });
    expect(Object.keys(view.quests[0]!)).toEqual([
      'questNumber',
      'proposalNumber',
      'leader',
      'team',
      'failCount',
      'succeeded',
    ]);
    expect(view.revealedRoles).toEqual(s.roles);
    expect(view.winners).toHaveLength(2);
    view.revealedRoles![evil] = 'servant';
    expect(s.roles[evil] === 'servant').toBe(false);
  });
});
