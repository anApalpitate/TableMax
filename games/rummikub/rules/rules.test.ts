import { describe, expect, it } from 'vitest';
import { parseMeld, normalizeMeld } from '../shared/melds';
import { findLegalPlay, inspectTurn, prepareTurn } from '../shared/turn';
import { scoreGame } from './scoring';

const ids = (color: string, ...values: number[]) =>
  values.map((n) => `${color}-${String(n).padStart(2, '0')}-a`);
const meld = (color: string, ...values: number[]) =>
  parseMeld(ids(color, ...values))!;
const simultaneousJokerTurn = () => {
  const before = [
    parseMeld([...ids('blue', 6, 7), 'joker-a'], {
      'joker-a': { color: 'blue', value: 8 },
    })!,
    parseMeld([...ids('red', 6, 7), 'joker-b'], {
      'joker-b': { color: 'red', value: 8 },
    })!,
    meld('orange', 9, 10, 11),
  ];
  const after = [
    parseMeld([...ids('blue', 6, 7), 'joker-b'], {
      'joker-b': { color: 'blue', value: 5 },
    })!,
    parseMeld([...ids('red', 6, 7), 'joker-a'], {
      'joker-a': { color: 'red', value: 5 },
    })!,
    meld('orange', 9, 10, 11, 12),
  ];
  return {
    context: { table: before, rack: ids('orange', 12), opened: true },
    after,
  };
};

describe('拉密高风险规则', () => {
  it('清空牌架不能出现两名先到赢家', () => {
    expect(() =>
      scoreGame(['a', 'b'], { a: [], b: [] }, 'empty-rack', 1),
    ).toThrow();
  });
  it('堵局三人共同赢家按最小单位计分且严格守恒', () => {
    const result = scoreGame(
      ['a', 'b', 'c', 'd'],
      {
        a: ids('black', 1),
        b: ids('blue', 1),
        c: ids('red', 1),
        d: ids('orange', 2),
      },
      'blocked',
      1,
    );
    expect(result.winners).toEqual(['a', 'b', 'c']);
    expect(
      Object.values(result.scores).reduce((sum, value) => sum + value, 0),
    ).toBe(0);
    expect(result.scores.a).toBe(1 / 3);
  });
  it('首出不能借桌面或在同回合操作旧桌面', () => {
    const original = meld('blue', 1, 2, 3);
    const rack = ids('blue', 4, 10, 11, 12);
    expect(() =>
      inspectTurn(
        { table: [original], rack, opened: false },
        {
          type: 'submit-turn',
          table: [meld('blue', 1, 2, 3, 4), meld('blue', 10, 11, 12)],
        },
      ),
    ).toThrow(/首出当回合/);
    const good = prepareTurn({ table: [original], rack, opened: false }, [
      original,
      meld('blue', 10, 11, 12),
    ]);
    expect(good).not.toBeNull();
    expect(
      inspectTurn({ table: [original], rack, opened: false }, good!).points,
    ).toBe(33);
  });
  it('同色重复和十三接一非法，物理双份牌不能合并', () => {
    expect(parseMeld([...ids('black', 1, 2), 'black-01-b'])).toBeNull();
    expect(parseMeld(ids('red', 12, 13, 1))).toBeNull();
    expect(() =>
      normalizeMeld({
        kind: 'group',
        tiles: [
          { tileId: 'black-01-a', color: 'black', value: 1 },
          { tileId: 'black-01-b', color: 'blue', value: 1 },
          { tileId: 'red-01-a', color: 'red', value: 1 },
        ],
      }),
    ).toThrow();
  });
  it('百搭可由桌面替代，释放后本回合新组重用', () => {
    const old = parseMeld([...ids('blue', 1, 2), 'joker-a'], {
      'joker-a': { color: 'blue', value: 3 },
    })!;
    const group = parseMeld(['blue-03-a', 'red-03-a', 'black-03-a'])!;
    const rack = ids('orange', 10, 11);
    const next = [
      meld('blue', 1, 2, 3),
      parseMeld([...rack, 'joker-a'], {
        'joker-a': { color: 'orange', value: 12 },
      })!,
    ];
    const context = { rack, table: [old, group], opened: true };
    // The old group would lose blue 3, leaving two tiles: add a matching rack
    // tile to make that rearrangement legitimate too.
    const expanded = { ...context, rack: [...rack, 'orange-03-a'] };
    next.push(parseMeld(['red-03-a', 'black-03-a', 'orange-03-a'])!);
    const action = prepareTurn(expanded, next);
    expect(action).not.toBeNull();
    expect(action!.releases?.[0]!.jokerId).toBe('joker-a');
    expect(inspectTurn(expanded, action!).placedTileIds).toHaveLength(3);
    expect(() =>
      inspectTurn(expanded, { type: 'submit-turn', table: next }),
    ).toThrow(/证明/);
  });
  it('双百搭同时合法替代与重用，不额外要求释放先后', () => {
    const { context, after } = simultaneousJokerTurn();
    const action = prepareTurn(context, after);
    expect(action).not.toBeNull();
    expect(inspectTurn(context, action!)).toEqual({
      placedTileIds: ['orange-12-a'],
      points: 0,
    });
    expect(action!.releases?.map((proof) => proof.jokerId).sort()).toEqual([
      'joker-a',
      'joker-b',
    ]);
    for (const [jokerId, otherJokerId] of [
      ['joker-a', 'joker-b'],
      ['joker-b', 'joker-a'],
    ]) {
      const proof = action!.releases!.find(
        (entry) => entry.jokerId === jokerId,
      )!;
      expect(
        proof.replacementSets.flatMap((set) =>
          set.tiles.map((tile) => tile.tileId),
        ),
      ).toContain(otherJokerId);
    }
  });
  it.each(['joker-a', 'joker-b'])(
    '双百搭重组缺少%s的合法替代仍拒绝',
    (missingJoker) => {
      const { context, after } = simultaneousJokerTurn();
      const action = prepareTurn(context, after)!;
      expect(() =>
        inspectTurn(context, {
          ...action,
          releases: action.releases!.filter(
            (proof) => proof.jokerId !== missingJoker,
          ),
        }),
      ).toThrow(/合法释放证明/);
    },
  );
  it('双百搭合法重组不能代替至少出一张本人牌', () => {
    const { context, after } = simultaneousJokerTurn();
    const action = prepareTurn(context, after)!;
    const noRackPlay = [after[0]!, after[1]!, meld('orange', 9, 10, 11)];
    expect(prepareTurn(context, noRackPlay)).toBeNull();
    expect(() =>
      inspectTurn(context, { ...action, table: noRackPlay }),
    ).toThrow(/至少打出一张本人牌/);
  });
  it('百搭替代不能借用仍在本人牌架、没有出到桌面的牌', () => {
    const { context, after } = simultaneousJokerTurn();
    const withHeldReplacement = {
      ...context,
      rack: [...context.rack, ...ids('blue', 5)],
    };
    const action = prepareTurn(withHeldReplacement, after)!;
    expect(inspectTurn(withHeldReplacement, action).placedTileIds).toEqual([
      'orange-12-a',
    ]);
    expect(() =>
      inspectTurn(withHeldReplacement, {
        ...action,
        releases: action.releases!.map((proof) =>
          proof.jokerId === 'joker-a'
            ? { ...proof, replacementSets: [meld('blue', 5, 6, 7)] }
            : proof,
        ),
      }),
    ).toThrow(/不能使用未出手牌/);
  });
  it('空池无牌判定穷尽首组，预算截止不是无牌证明', () => {
    const context = {
      rack: [...ids('black', 1), ...ids('blue', 1), ...ids('red', 1)],
      table: [],
      opened: false,
    };
    expect(findLegalPlay(context)).toMatchObject({
      action: null,
      complete: true,
    });
    expect(findLegalPlay(context, { maxNodes: 0 })).toMatchObject({
      action: null,
      complete: false,
    });
    const playable = findLegalPlay({
      ...context,
      rack: ids('black', 10, 11, 12),
    });
    expect(playable.action).not.toBeNull();
  });
  it('原文四类百搭释放都能证明，不额外要求两张本人牌同组', () => {
    const cases = [
      {
        before: [
          parseMeld(['blue-03-a', 'orange-03-a', 'joker-a'], {
            'joker-a': { color: 'black', value: 3 },
          })!,
        ],
        rack: ['red-03-a', ...ids('black', 10, 11)],
        after: [
          parseMeld(['blue-03-a', 'orange-03-a', 'red-03-a'])!,
          parseMeld([...ids('black', 10, 11), 'joker-a'], {
            'joker-a': { color: 'black', value: 12 },
          })!,
        ],
      },
      {
        before: [
          parseMeld([...ids('blue', 2, 3, 5, 6, 7), 'joker-a'], {
            'joker-a': { color: 'blue', value: 4 },
          })!,
        ],
        rack: [...ids('blue', 4), ...ids('orange', 10, 11)],
        after: [
          meld('blue', 2, 3, 4),
          meld('blue', 5, 6, 7),
          parseMeld([...ids('orange', 10, 11), 'joker-a'], {
            'joker-a': { color: 'orange', value: 12 },
          })!,
        ],
      },
      {
        before: [
          parseMeld([...ids('blue', 6, 7), 'joker-a'], {
            'joker-a': { color: 'blue', value: 8 },
          })!,
        ],
        rack: [...ids('blue', 5), ...ids('red', 10, 11)],
        after: [
          meld('blue', 5, 6, 7),
          parseMeld([...ids('red', 10, 11), 'joker-a'], {
            'joker-a': { color: 'red', value: 12 },
          })!,
        ],
      },
      {
        before: [
          parseMeld([...ids('black', 1, 2), 'joker-a'], {
            'joker-a': { color: 'black', value: 3 },
          })!,
          parseMeld(['blue-01-a', 'orange-01-a', 'red-01-a'])!,
          parseMeld(['blue-02-a', 'orange-02-a', 'red-02-a'])!,
        ],
        rack: ids('black', 10, 11),
        after: [
          parseMeld(['black-01-a', 'blue-01-a', 'orange-01-a', 'red-01-a'])!,
          parseMeld(['black-02-a', 'blue-02-a', 'orange-02-a', 'red-02-a'])!,
          parseMeld([...ids('black', 10, 11), 'joker-a'], {
            'joker-a': { color: 'black', value: 12 },
          })!,
        ],
      },
    ];
    for (const sample of cases) {
      const context = { rack: sample.rack, table: sample.before, opened: true };
      const action = prepareTurn(context, sample.after);
      expect(action).not.toBeNull();
      expect(action!.releases).toHaveLength(1);
      expect(inspectTurn(context, action!).placedTileIds).toHaveLength(
        sample.rack.length,
      );
    }
    // The single rack tile goes to an independent existing group while the
    // returned joker's new set is entirely made of previously public tiles.
    const before = [
      parseMeld([...ids('black', 1, 2), 'joker-a'], {
        'joker-a': { color: 'black', value: 3 },
      })!,
      parseMeld(['blue-01-a', 'orange-01-a', 'red-01-a'])!,
      parseMeld(['blue-02-a', 'orange-02-a', 'red-02-a'])!,
      meld('red', 8, 9, 10, 11, 12, 13),
      parseMeld(['black-07-a', 'blue-07-a', 'orange-07-a'])!,
    ];
    const after = [
      parseMeld(['black-01-a', 'blue-01-a', 'orange-01-a', 'red-01-a'])!,
      parseMeld(['black-02-a', 'blue-02-a', 'orange-02-a', 'red-02-a'])!,
      parseMeld([...ids('red', 8, 9), 'joker-a'], {
        'joker-a': { color: 'red', value: 10 },
      })!,
      meld('red', 10, 11, 12, 13),
      parseMeld(['black-07-a', 'blue-07-a', 'orange-07-a', 'red-07-a'])!,
    ];
    const context = { rack: ['red-07-a'], table: before, opened: true };
    const action = prepareTurn(context, after);
    expect(action).not.toBeNull();
    expect(inspectTurn(context, action!).placedTileIds).toEqual(['red-07-a']);
  });
});
