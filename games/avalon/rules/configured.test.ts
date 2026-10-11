import { expect, it } from 'vitest';
import { configuredRoles, PLAYER_SETUPS } from '../config';
import { rules, legalActions } from './index';
import { project, roleKnowledge } from './project';
import {
  apply,
  approve,
  context,
  discuss,
  fixture,
  quest,
  reveal,
} from './test-fixtures';
import { chooseAction, cleanProbability, hypotheses } from '../bot';
import { alignment, questSizes, type State } from './state';

it('5–10 人的唯一配置精确校验角色，并拒绝替换角色的存档', () => {
  for (const count of [5, 6, 7, 8, 9, 10]) {
    const s = fixture('configured', count);
    expect(Object.values(s.roles).sort()).toEqual(
      configuredRoles(count).sort(),
    );
    expect(PLAYER_SETUPS[count]!.servants).toBe(
      count - PLAYER_SETUPS[count]!.evil.length - 2,
    );
    expect(() =>
      rules.validateState(
        { ...s, roles: { ...s.roles, [s.seats[0]!]: 'minion' } },
        s.seats,
      ),
    ).toThrow();
  }
});
it('梅林看不见莫德雷德，奥伯伦与其他邪恶互盲，派西维尔只见两名候选', () => {
  const s = fixture('configured', 10);
  const seat = (role: string) => s.seats.find((id) => s.roles[id] === role)!;
  const merlin = roleKnowledge(s.roles, s.seats, seat('merlin'));
  expect(merlin.evilSeats).toContain(seat('oberon'));
  expect(merlin.evilSeats).not.toContain(seat('mordred'));
  expect(roleKnowledge(s.roles, s.seats, seat('oberon')).evilSeats).toEqual([]);
  expect(
    roleKnowledge(s.roles, s.seats, seat('assassin')).evilSeats,
  ).not.toContain(seat('oberon'));
  expect(
    roleKnowledge(s.roles, s.seats, seat('percival')).merlinCandidates.sort(),
  ).toEqual([seat('merlin'), seat('morgana')].sort());
  const view = project(s, { role: 'player', seatId: seat('merlin') });
  const beliefs = hypotheses(view, 'juewu');
  expect(beliefs.length).toBeGreaterThan(1);
  expect(project(s, { role: 'public' }).self).toBeNull();
});
it('奥伯伦在刺杀候选内；刺中奥伯伦按梅林幸存结算并可恢复', () => {
  let s = reveal(fixture('configured', 10));
  for (let number = 0; number < 3; number++) {
    s = approve(s, s.seats.slice(0, s.questNumber === 1 ? 3 : 4));
    s = quest(s);
  }
  expect(s.phase).toBe('assassinate');
  const assassin = s.seats.find((id) => s.roles[id] === 'assassin')!;
  const oberon = s.seats.find((id) => s.roles[id] === 'oberon')!;
  expect(legalActions(s, assassin)).toContainEqual({
    type: 'assassinate',
    target: oberon,
  });
  s = apply(s, { type: 'assassinate', target: oberon }, assassin);
  expect(s.winReason).toBe('merlin-survived');
  expect(s.winner).toBe('good');
  expect(rules.validateState(JSON.parse(JSON.stringify(s)), s.seats)).toEqual(
    s,
  );
});

it('奥伯伦第四任务独立按双失败概率组队及赞成，一失败成功、两失败终局可恢复', () => {
  let initial = fixture('configured', 10);
  for (let seed = 1; seed < 1000; seed++) {
    const candidate = rules.initialize(context(seed, initial.seats)) as State;
    const leader =
      candidate.seats[(candidate.seats.indexOf(candidate.leader) + 3) % 10]!;
    if (candidate.roles[leader] === 'oberon') {
      initial = candidate;
      break;
    }
  }
  let s = reveal(initial);
  const good = s.seats.filter((id) => alignment(s.roles[id]!) === 'good');
  const evil = s.seats.filter((id) => alignment(s.roles[id]!) === 'evil');
  const oberon = s.seats.find((id) => s.roles[id] === 'oberon')!;
  const assassin = s.seats.find((id) => s.roles[id] === 'assassin')!;
  for (const round of [1, 2, 3]) {
    const team = [
      ...evil.filter((id) => id !== oberon).slice(0, 2),
      ...good,
    ].slice(0, questSizes(10)[round - 1]!);
    s = quest(approve(s, team), round === 2 ? [] : [team[0]!]);
  }
  expect(s.questNumber).toBe(4);
  expect(s.leader).toBe(oberon);
  const own = project(s, { role: 'player', seatId: oberon });
  const proposals = legalActions(s, oberon).filter(
    (action) => action.type === 'propose-team',
  );
  for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
    const beliefs = hypotheses(own, difficulty);
    const chosen = chooseAction(
      own,
      proposals,
      difficulty,
      context().random,
    ) as { type: 'propose-team'; team: string[] };
    const maximum = Math.max(
      ...proposals.map(
        (action) => 1 - cleanProbability(action.team, beliefs, 2),
      ),
    );
    expect(1 - cleanProbability(chosen.team, beliefs, 2)).toBeCloseTo(maximum);
  }
  const team = [oberon, assassin, ...good.slice(0, 3)];
  s = discuss(apply(s, { type: 'propose-team', team }, s.leader));
  for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
    const view = project(s, { role: 'player', seatId: oberon });
    const probability =
      1 - cleanProbability(team, hypotheses(view, difficulty), 2);
    expect(probability).toBeGreaterThanOrEqual(0.5);
    expect(
      chooseAction(view, legalActions(s, oberon), difficulty, context().random),
    ).toEqual({ type: 'vote-team', vote: 'approve' });
  }
  for (const seat of s.seats)
    s = apply(s, { type: 'vote-team', vote: 'approve' }, seat);
  const single = quest(structuredClone(s), [oberon]);
  expect(single.quests.at(-1)!.succeeded).toBe(true);
  const double = quest(structuredClone(s), [oberon, assassin]);
  expect(double.winner).toBe('evil');
  expect(
    rules.validateState(JSON.parse(JSON.stringify(double)), double.seats),
  ).toEqual(double);
});
