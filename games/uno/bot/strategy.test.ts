import { describe, expect, it } from 'vitest';
import type { BotDifficulty } from '@tablemax/game-sdk';
import { bot, chooseAction, observe, type Memory } from './index';
import { context, fixture } from '../rules/test-fixtures';
import { rules, project, legalActions, isLegalAction } from '../rules';
import type { State } from '../rules/state';
import type { Action } from '../types';
const difficulties: BotDifficulty[] = ['default', 'doubao', 'juewu'];
const memory = (s: State): Memory => ({
  version: 1,
  roundNumber: s.roundNumber,
  serial: s.actionSerial,
  knownCards: {},
  colorHints: {},
});
function decide(
  s: State,
  seat: string,
  difficulty: BotDifficulty,
  m = memory(s),
): Action {
  return chooseAction(
    project(s, { role: 'player', seatId: seat }),
    legalActions(s, seat),
    m,
    difficulty,
  );
}
function apply(s: State, action: Action, seat = s.turnSeat!): State {
  return rules.apply(s, action, seat, context(97, s.seats)).state as State;
}
describe('UNO三档本地策略逐节点与授权记忆', () => {
  it.each(difficulties)(
    '%s覆盖开局颜色/正常出牌/摸牌/摸后出牌或保留/UNO补喊抓漏/+4响应',
    (difficulty) => {
      const wild = fixture(
        { a: ['green-4-a', 'green-8-a'], b: ['red-1-a'], c: ['blue-1-a'] },
        'wild-1',
      );
      wild.stage = 'choose-color';
      expect(decide(wild, 'a', difficulty)).toEqual({
        type: 'choose-color',
        color: 'green',
      });
      const play = fixture({
        a: ['red-8-a', 'green-2-a'],
        b: ['red-1-a'],
        c: ['blue-1-a'],
      });
      expect(decide(play, 'a', difficulty)).toEqual({
        type: 'play',
        cardId: 'red-8-a',
        uno: true,
      });
      const noMatch = fixture({
        a: ['green-3-a', 'blue-2-a'],
        b: ['red-1-a'],
        c: ['blue-1-a'],
      });
      expect(decide(noMatch, 'a', difficulty)).toEqual({ type: 'draw' });
      noMatch.deck = noMatch.deck.filter((id) => id !== 'red-8-a');
      noMatch.deck.push('red-8-a');
      const drawn = apply(noMatch, { type: 'draw' });
      expect(decide(drawn, 'a', difficulty)).toEqual({
        type: 'play',
        cardId: 'red-8-a',
      });
      const uncalled = apply(play, { type: 'play', cardId: 'red-8-a' });
      expect(decide(uncalled, 'a', difficulty)).toEqual({
        type: 'declare-uno',
      });
      expect(decide(uncalled, 'c', difficulty)).toEqual({
        type: 'catch-uno',
        target: 'a',
      });
      const claim = apply(
        fixture({
          a: ['wild-draw-four-1', 'green-2-a'],
          b: ['red-1-a'],
          c: ['blue-1-a'],
        }),
        { type: 'play', cardId: 'wild-draw-four-1', color: 'blue', uno: true },
      );
      expect(decide(claim, 'b', difficulty)).toEqual({
        type: 'accept-draw-four',
      });
      const keep = fixture({
        a: ['red-8-a', 'wild-draw-four-1'],
        b: ['red-1-a'],
        c: ['blue-1-a'],
      });
      keep.stage = 'drawn';
      keep.drawnCardId = 'wild-draw-four-1';
      expect(decide(keep, 'a', difficulty)).toEqual({ type: 'pass' });
    },
  );
  it('默认轻量自然出牌，豆包识别下一位一张牌并优先罚摸', () => {
    const s = fixture({
      a: ['red-9-a', 'red-draw-two-a', 'green-2-a'],
      b: ['blue-1-a'],
      c: ['blue-2-a'],
    });
    expect(decide(s, 'a', 'default')).toEqual({
      type: 'play',
      cardId: 'red-9-a',
    });
    expect(decide(s, 'a', 'doubao')).toEqual({
      type: 'play',
      cardId: 'red-draw-two-a',
    });
  });
  it('绝悟在豆包多数颜色上进一步利用获准记住的对手末张避免直接放行', () => {
    const s = fixture(
      {
        a: ['wild-1', 'green-9-a', 'red-1-a'],
        b: ['green-4-a'],
        c: ['blue-1-a'],
      },
      'yellow-5-a',
    );
    const m = { ...memory(s), knownCards: { b: ['green-4-a'] } };
    expect(decide(s, 'a', 'doubao', m)).toEqual({
      type: 'play',
      cardId: 'wild-1',
      color: 'green',
    });
    expect(decide(s, 'a', 'juewu', m)).toEqual({
      type: 'play',
      cardId: 'wild-1',
      color: 'red',
    });
  });
  it('三档都不非法诈唬，不把隐藏guilty读取或猜测作为确定证据', () => {
    const s = fixture({
      a: ['red-1-a', 'wild-draw-four-1'],
      b: ['blue-1-a'],
      c: ['blue-2-a'],
    });
    for (const difficulty of difficulties)
      expect((decide(s, 'a', difficulty) as { cardId: string }).cardId).toBe(
        'red-1-a',
      );
    const claim = apply(s, {
      type: 'play',
      cardId: 'wild-draw-four-1',
      color: 'blue',
    });
    for (const difficulty of difficulties)
      expect(decide(claim, 'b', difficulty)).toEqual({
        type: 'catch-uno',
        target: 'a',
      });
    const cleared = apply(claim, { type: 'declare-uno' }, 'a');
    for (const difficulty of difficulties)
      expect(decide(cleared, 'b', difficulty)).toEqual({
        type: 'accept-draw-four',
      });
    const m = { ...memory(cleared), knownCards: { a: ['red-1-a'] } };
    expect(decide(cleared, 'b', 'default', m)).toEqual({
      type: 'accept-draw-four',
    });
    expect(decide(cleared, 'b', 'doubao', m)).toEqual({
      type: 'challenge-draw-four',
    });
    expect(decide(cleared, 'b', 'juewu', m)).toEqual({
      type: 'challenge-draw-four',
    });
  });
  it('质疑仅本人可观察手牌；默认不记忆，豆包最多3张，绝悟完整记忆；公开出牌移除旧知识', () => {
    const s = fixture({
      a: ['wild-draw-four-1', 'red-1-a', 'green-2-a', 'green-3-a', 'blue-8-a'],
      b: ['blue-1-a'],
      c: ['blue-2-a'],
    });
    const challenged = apply(
      apply(s, { type: 'play', cardId: 'wild-draw-four-1', color: 'green' }),
      { type: 'challenge-draw-four' },
    );
    expect(
      observe(
        project(challenged, { role: 'player', seatId: 'b' }),
        null,
        'default',
      ).knownCards,
    ).toEqual({});
    expect(
      observe(
        project(challenged, { role: 'player', seatId: 'b' }),
        null,
        'doubao',
      ).knownCards.a,
    ).toHaveLength(3);
    const m = observe(
      project(challenged, { role: 'player', seatId: 'b' }),
      null,
      'juewu',
    );
    expect(m.knownCards.a).toHaveLength(4);
    expect(
      observe(
        project(challenged, { role: 'player', seatId: 'c' }),
        null,
        'juewu',
      ).knownCards,
    ).toEqual({});
    const publicPlayed = structuredClone(challenged);
    publicPlayed.latest = {
      ...publicPlayed.latest!,
      serial: publicPlayed.actionSerial + 1,
      actor: 'a',
      verb: 'play',
      card: { id: 'red-1-a', color: 'red', kind: 'number', value: 1 },
      color: 'red',
    };
    publicPlayed.actionSerial++;
    expect(
      observe(
        project(publicPlayed, { role: 'player', seatId: 'b' }),
        m,
        'juewu',
      ).knownCards.a!.includes('red-1-a'),
    ).toBe(false);
    const nextRound = structuredClone(publicPlayed);
    nextRound.roundNumber++;
    expect(
      observe(project(nextRound, { role: 'player', seatId: 'b' }), m, 'juewu')
        .knownCards,
    ).toEqual({ a: [] });
    const clone = bot.validateMemory(m) as Memory;
    clone.knownCards.a!.pop();
    expect(m.knownCards.a).toHaveLength(4);
  });
  it('SDK策略拒绝错身份/版本/未知卡/超量记忆和取消信号；动作必须再次权威合法', async () => {
    const s = fixture({
        a: ['red-1-a', 'green-2-a'],
        b: ['blue-1-a'],
        c: ['blue-2-a'],
      }),
      view = project(s, { role: 'player', seatId: 'a' });
    for (const bad of [
      { ...memory(s), version: 2 },
      { ...memory(s), knownCards: { a: ['fake'] } },
      { ...memory(s), colorHints: { a: { color: 'purple', strength: 1 } } },
    ])
      expect(() => bot.validateMemory(bad)).toThrow();
    await expect(
      bot.decide({
        view,
        actions: legalActions(s, 'a'),
        decision: { id: 'wrong', seatId: 'b' },
        memory: null,
        random: context().random,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow();
    const abort = new AbortController();
    abort.abort();
    expect(() =>
      chooseAction(
        view,
        legalActions(s, 'a'),
        memory(s),
        'juewu',
        abort.signal,
      ),
    ).toThrow();
    for (const difficulty of difficulties) {
      const action = decide(s, 'a', difficulty);
      expect(isLegalAction(s, action, 'a')).toBe(true);
    }
  });
});
