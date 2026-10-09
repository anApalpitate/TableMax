import { describe, expect, it } from 'vitest';
import { CARD_IDS, CARDS, getCard } from '../data/catalog';
import type { Action } from '../types';
import { context, fixture } from './test-fixtures';
import {
  rules,
  initialize,
  isLegalAction,
  legalActions,
  project,
  validateAction,
  validateState,
} from './index';
import { handValue } from './scoring';
import type { State } from './state';
function apply(s: State, action: Action, seat = s.turnSeat!): State {
  return rules.apply(s, action, seat, context(41, s.seats)).state as State;
}
describe('UNO 经典108牌与出牌边界', () => {
  it('牌组精确108且独立物理编号，标准点数1240', () => {
    expect(CARDS).toHaveLength(108);
    expect(new Set(CARD_IDS).size).toBe(108);
    for (const color of ['red', 'green', 'blue', 'yellow']) {
      expect(CARDS.filter((c) => c.color === color)).toHaveLength(25);
      expect(
        CARDS.filter((c) => c.color === color && c.value === 0),
      ).toHaveLength(1);
      expect(
        CARDS.filter((c) => c.color === color && c.value === 7),
      ).toHaveLength(2);
    }
    expect(handValue(CARD_IDS)).toBe(1240);
  });
  it('同色/同数字/同符号可出，不同颜色数字不同不行；不叠加罚牌', () => {
    const s = fixture({
      a: ['red-7-a', 'blue-5-a', 'blue-reverse-a', 'green-8-a', 'wild-1'],
      b: ['blue-1-a'],
      c: ['green-1-a'],
    });
    expect(isLegalAction(s, { type: 'play', cardId: 'red-7-a' }, 'a')).toBe(
      true,
    );
    expect(isLegalAction(s, { type: 'play', cardId: 'blue-5-a' }, 'a')).toBe(
      true,
    );
    expect(isLegalAction(s, { type: 'play', cardId: 'green-8-a' }, 'a')).toBe(
      false,
    );
    s.discard = ['red-reverse-a'];
    s.deck = CARD_IDS.filter(
      (id) =>
        !Object.values(s.hands).flat().includes(id) && !s.discard.includes(id),
    );
    expect(
      isLegalAction(s, { type: 'play', cardId: 'blue-reverse-a' }, 'a'),
    ).toBe(true);
    const penalized = apply(
      fixture({
        a: ['red-draw-two-a', 'yellow-2-a'],
        b: ['blue-draw-two-a'],
        c: ['green-1-a'],
      }),
      { type: 'play', cardId: 'red-draw-two-a', uno: true },
    );
    expect(penalized.hands.b).toHaveLength(3);
    expect(penalized.turnSeat).toBe('c');
    expect(legalActions(penalized, 'b')).toEqual([]);
  });
  it('可以自愿摸牌，之后只能打刚摸牌且可保留；旧手牌不能出', () => {
    const s = fixture({
      a: ['red-7-a', 'blue-5-a'],
      b: ['blue-1-a'],
      c: ['green-1-a'],
    });
    s.deck = s.deck.filter((id) => id !== 'red-8-a');
    s.deck.push('red-8-a');
    const before = structuredClone(s),
      drawn = apply(s, { type: 'draw' });
    expect(s).toEqual(before);
    expect(drawn.stage).toBe('drawn');
    expect(drawn.drawnCardId).toBe('red-8-a');
    expect(isLegalAction(drawn, { type: 'play', cardId: 'red-7-a' }, 'a')).toBe(
      false,
    );
    expect(isLegalAction(drawn, { type: 'play', cardId: 'red-8-a' }, 'a')).toBe(
      true,
    );
    const pass = apply(drawn, { type: 'pass' });
    expect(pass.turnSeat).toBe('b');
    expect(pass.hands.a).toContain('red-8-a');
  });
  it('摸到不匹配牌自动交棒，不能无限摸至能出', () => {
    const s = fixture({ a: ['yellow-7-a'], b: ['blue-1-a'], c: ['green-1-a'] });
    s.deck = s.deck.filter((id) => id !== 'green-8-a');
    s.deck.push('green-8-a');
    const drawn = apply(s, { type: 'draw' });
    expect(drawn.turnSeat).toBe('b');
    expect(drawn.stage).toBe('turn');
    expect(drawn.drawnCardId).toBeNull();
    expect(isLegalAction(drawn, { type: 'draw' }, 'a')).toBe(false);
  });
  it.each(['skip', 'reverse', 'draw-two'] as const)(
    '两人%s立即返回本人，反转本身改变方向',
    (kind) => {
      const s = fixture({
        a: [`red-${kind}-a`, 'yellow-2-a'],
        b: ['blue-1-a'],
      });
      const result = apply(s, { type: 'play', cardId: `red-${kind}-a` });
      expect(result.turnSeat).toBe('a');
      expect(result.direction).toBe(kind === 'reverse' ? -1 : 1);
      expect(result.hands.b!.length).toBe(kind === 'draw-two' ? 3 : 1);
      validateState(result, result.seats);
    },
  );
  it('三人反转走回右侧，跳过走第二位', () => {
    for (const kind of ['skip', 'reverse']) {
      const s = fixture({
        a: [`red-${kind}-a`, 'yellow-2-a'],
        b: ['blue-1-a'],
        c: ['green-1-a'],
      });
      const result = apply(s, { type: 'play', cardId: `red-${kind}-a` });
      expect(result.turnSeat).toBe('c');
    }
  });
  it('动作拒绝越权身份、未知物理牌、多余字段与非法颜色', () => {
    const s = fixture({
      a: ['red-7-a', 'wild-1'],
      b: ['blue-1-a'],
      c: ['green-1-a'],
    });
    expect(isLegalAction(s, { type: 'play', cardId: 'red-7-a' }, 'b')).toBe(
      false,
    );
    for (const action of [
      { type: 'draw', seat: 'a' },
      { type: 'play', cardId: 'wild-1' },
      { type: 'play', cardId: 'red-7-a', color: 'red' },
      { type: 'play', cardId: 'wild-1', color: 'purple' },
      { type: 'play', cardId: 'fake' },
    ])
      expect(() => validateAction(action)).toThrow();
    expect(
      isLegalAction(s, { type: 'play', cardId: 'red-7-a', uno: false }, 'a'),
    ).toBe(true);
  });
});
describe('UNO +4声明、秘密质疑与末张计分', () => {
  const source = (guilty: boolean) =>
    fixture({
      a: ['wild-draw-four-1', guilty ? 'red-7-a' : 'blue-7-a'],
      b: ['blue-1-a'],
      c: ['green-1-a'],
    });
  it('原文允许+4诈唬，声明合法动作不泄露同色证据，只有受罚者可质疑', () => {
    const s = source(true),
      claim = apply(s, {
        type: 'play',
        cardId: 'wild-draw-four-1',
        color: 'blue',
        uno: true,
      });
    expect(claim.drawFour?.guilty).toBe(true);
    expect(legalActions(claim, 'b')).toEqual([
      { type: 'accept-draw-four' },
      { type: 'challenge-draw-four' },
    ]);
    expect(isLegalAction(claim, { type: 'challenge-draw-four' }, 'c')).toBe(
      false,
    );
    const publicView = project(claim, { role: 'public' });
    expect(publicView.drawFour).toEqual({
      offender: 'a',
      target: 'b',
      previousColor: 'red',
      chosenColor: 'blue',
    });
    const text = JSON.stringify(publicView);
    expect(text.includes('red-7-a')).toBe(false);
    expect(text.includes('guilty')).toBe(false);
    expect(text.includes('evidenceIds')).toBe(false);
    validateState(claim, claim.seats);
  });
  it('质疑成功出牌者摸4，质疑者正常行动；手牌证据仅质疑者可见', () => {
    const claim = apply(source(true), {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'blue',
      uno: true,
    });
    const result = apply(claim, { type: 'challenge-draw-four' });
    expect(result.hands.a).toHaveLength(5);
    expect(result.hands.b).toHaveLength(1);
    expect(result.turnSeat).toBe('b');
    expect(
      project(result, {
        role: 'player',
        seatId: 'b',
      }).self?.challengeEvidence?.cards.map((c) => c.id),
    ).toEqual(['red-7-a']);
    expect(
      project(result, { role: 'player', seatId: 'a' }).self?.challengeEvidence,
    ).toBeNull();
    expect(
      project(result, { role: 'player', seatId: 'c' }).self?.challengeEvidence,
    ).toBeNull();
    expect(project(result, { role: 'public' }).self).toBeNull();
    validateState(result, result.seats);
  });
  it('同数字/符号不阻止合规+4，质疑失败摸6并跳过；接受只摸4', () => {
    for (const action of ['challenge-draw-four', 'accept-draw-four'] as const) {
      const claim = apply(source(false), {
        type: 'play',
        cardId: 'wild-draw-four-1',
        color: 'green',
        uno: true,
      });
      const result = apply(claim, { type: action });
      expect(result.hands.b).toHaveLength(
        action === 'challenge-draw-four' ? 7 : 5,
      );
      expect(result.turnSeat).toBe('c');
      validateState(result, result.seats);
    }
  });
  it('末张+2的罚牌先进入分数；末张+4待质疑完才结算且可因罚牌达500', () => {
    const plus2 = fixture({
      a: ['red-draw-two-a'],
      b: ['wild-1'],
      c: ['green-1-a'],
    });
    const ended2 = apply(plus2, { type: 'play', cardId: 'red-draw-two-a' });
    expect(ended2.phase).toBe('round-result');
    expect(ended2.hands.b).toHaveLength(3);
    expect(ended2.results[0]?.points).toBe(handValue(ended2.hands.b!) + 1);
    validateState(ended2, ended2.seats);
    const plus4 = fixture({
      a: ['wild-draw-four-1'],
      b: ['wild-1'],
      c: ['green-1-a'],
    });
    const claim = apply(plus4, {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'blue',
    });
    expect(claim.phase).toBe('playing');
    expect(claim.hands.a).toEqual([]);
    const ended4 = apply(claim, { type: 'challenge-draw-four' });
    expect(ended4.phase).toBe('round-result');
    expect(ended4.hands.b).toHaveLength(7);
    expect(ended4.results[0]?.points).toBe(handValue(ended4.hands.b!) + 1);
    validateState(ended4, ended4.seats);
  });
  it('两人+4接受或失败质疑后返回出牌者', () => {
    const s = fixture({
      a: ['wild-draw-four-1', 'green-1-a'],
      b: ['blue-1-a'],
    });
    const claim = apply(s, {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'yellow',
      uno: true,
    });
    const result = apply(claim, { type: 'accept-draw-four' });
    expect(result.turnSeat).toBe('a');
    validateState(result, result.seats);
  });
  it('恢复拒绝删除同色证据洗白，保留pending抓漏追加两张后的完整原始证据', () => {
    const claim = apply(source(true), {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'blue',
    });
    const erased = structuredClone(claim);
    erased.drawFour!.evidenceIds = [];
    erased.drawFour!.guilty = false;
    expect(() => validateState(erased, erased.seats)).toThrow();
    const caught = apply(claim, { type: 'catch-uno', target: 'a' }, 'c');
    expect(caught.hands.a).toHaveLength(3);
    expect(caught.drawFour!.evidenceIds).toEqual(['red-7-a']);
    validateState(caught, caught.seats);
    const dishonest = structuredClone(caught);
    dishonest.drawFour!.evidenceIds = dishonest.hands.a!.filter(
      (id) => getCard(id).color !== 'red',
    );
    dishonest.drawFour!.guilty = false;
    expect(() => validateState(dishonest, dishonest.seats)).toThrow();
    const resolved = apply(caught, { type: 'challenge-draw-four' });
    expect(resolved.hands.a).toHaveLength(7);
    validateState(resolved, resolved.seats);
  });
});
describe('UNO宣告窗口、洗牌、开局与读档', () => {
  const source = () =>
    fixture({
      a: ['red-7-a', 'blue-7-a'],
      b: ['blue-1-a', 'green-5-a'],
      c: ['green-1-a'],
    });
  it('倒数第二张可同时喊UNO；漏喊可补喊或被任一他人抓漏罚2，先保存者生效', () => {
    const announced = apply(source(), {
      type: 'play',
      cardId: 'red-7-a',
      uno: true,
    });
    expect(announced.unoDeclared.a).toBe(true);
    expect(announced.unoWindow).toBeNull();
    const uncalled = apply(source(), { type: 'play', cardId: 'red-7-a' });
    expect(uncalled.unoWindow).toEqual({ seatId: 'a' });
    expect(rules.decisions(uncalled).map((d) => d.seatId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    const repaired = apply(uncalled, { type: 'declare-uno' }, 'a');
    expect(
      isLegalAction(repaired, { type: 'catch-uno', target: 'a' }, 'c'),
    ).toBe(false);
    const caught = apply(uncalled, { type: 'catch-uno', target: 'a' }, 'c');
    expect(caught.hands.a).toHaveLength(3);
    expect(caught.turnSeat).toBe('b');
    expect(isLegalAction(caught, { type: 'declare-uno' }, 'a')).toBe(false);
    validateState(caught, caught.seats);
  });
  it('下一玩家摸牌或出牌开始后抓漏窗口关闭；不依赖时钟', () => {
    const uncalled = apply(source(), { type: 'play', cardId: 'red-7-a' });
    const draw = apply(uncalled, { type: 'draw' });
    expect(draw.unoWindow).toBeNull();
    expect(isLegalAction(draw, { type: 'catch-uno', target: 'a' }, 'c')).toBe(
      false,
    );
    const playable = structuredClone(uncalled);
    playable.hands.b!.push('red-3-a');
    playable.deck = playable.deck.filter((id) => id !== 'red-3-a');
    const played = apply(playable, { type: 'play', cardId: 'red-3-a' });
    expect(played.unoWindow).toBeNull();
  });
  it('牌库耗尽保留最新弃牌并可恢复洗牌，不向其他玩家投影新牌身份', () => {
    const s = source();
    s.discard.push(...s.deck);
    s.deck = [];
    s.activeColor = getCard(s.discard.at(-1)!).color ?? 'red';
    validateState(s, s.seats);
    const top = s.discard.at(-1)!,
      drawn = apply(s, { type: 'draw' });
    expect(drawn.discard).toEqual([top]);
    expect(drawn.hands.a).toHaveLength(3);
    validateState(drawn, drawn.seats);
    expect(
      project(drawn, { role: 'player', seatId: 'b' }).self?.hand,
    ).toHaveLength(2);
    expect(project(drawn, { role: 'public' }).self).toBeNull();
  });
  it('多种固定seed初始化覆盖每种开局行动牌与六人边界，+4始终返回洗牌', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 150; seed++) {
      const s = initialize(context(seed, ['a', 'b', 'c', 'd', 'e', 'f']));
      validateState(s, s.seats);
      const top = getCard(s.discard[0]!);
      kinds.add(top.kind);
      expect(top.kind === 'wild-draw-four').toBe(false);
      if (top.kind === 'reverse') {
        expect(s.turnSeat).toBe(s.dealer);
        expect(s.direction).toBe(-1);
      }
      if (top.kind === 'wild') {
        expect(s.stage).toBe('choose-color');
        const chosen = apply(s, { type: 'choose-color', color: 'red' });
        expect(chosen.turnSeat).toBe(s.turnSeat);
        expect(chosen.activeColor).toBe('red');
        validateState(chosen, chosen.seats);
      }
      if (top.kind === 'draw-two')
        expect(
          Object.values(s.hands)
            .map((h) => h.length)
            .sort(),
        ).toEqual([7, 7, 7, 7, 7, 9]);
    }
    expect([...kinds].sort()).toEqual([
      'draw-two',
      'number',
      'reverse',
      'skip',
      'wild',
    ]);
  });
  it('round-result等待生命周期洗牌，累积结果、轮换发牌者、清理授权私密证据', () => {
    const s = fixture({ a: ['red-7-a'], b: ['blue-1-a'], c: ['green-1-a'] }),
      result = apply(s, { type: 'play', cardId: 'red-7-a' });
    expect(rules.decisions(result)).toEqual([]);
    expect(rules.lifecycleActions(result)).toEqual([{ type: 'next-round' }]);
    const next = rules.applyLifecycle(
      result,
      { type: 'next-round' },
      context(23, result.seats),
    ).state as State;
    expect(next.roundNumber).toBe(2);
    expect(next.scores.a).toBe(2);
    expect(next.results).toHaveLength(1);
    expect(next.dealer).toBe('a');
    expect(next.evidence).toBeNull();
    validateState(next, next.seats);
    const mutated = structuredClone(next);
    mutated.scores.a = 999;
    expect(() => validateState(mutated, mutated.seats)).toThrow();
  });
  it('读档拒绝缺牌/重复牌/额外秘密字段/伪造结果/错座位，并复制容器', () => {
    const s = source(),
      restored = validateState(s, s.seats);
    restored.hands.a!.pop();
    expect(s.hands.a).toHaveLength(2);
    const missing = structuredClone(s);
    missing.deck.pop();
    expect(() => validateState(missing, missing.seats)).toThrow();
    const duplicate = structuredClone(s);
    duplicate.deck[0] = duplicate.hands.a![0]!;
    expect(() => validateState(duplicate, duplicate.seats)).toThrow();
    expect(() =>
      validateState({ ...s, secretOverride: true }, s.seats),
    ).toThrow();
    expect(() => validateState(s, ['b', 'a', 'c'])).toThrow();
    const forged = structuredClone(s);
    forged.phase = 'ended';
    forged.winners = ['a'];
    expect(() => validateState(forged, forged.seats)).toThrow();
  });
});
