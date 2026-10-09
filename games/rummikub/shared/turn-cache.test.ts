import { describe, expect, it, vi } from 'vitest';
import { parseMeld } from './melds';
import * as solver from './solver';
import * as turn from './turn';

function fixture() {
  const before = parseMeld(['blue-01-a', 'blue-02-a', 'joker-a'], {
    'joker-a': { color: 'blue', value: 3 },
  })!;
  // One old natural stays with the rebound joker, so the final table alone
  // cannot witness its release; a separate blue 1–4 proof is required.
  const after = [
    parseMeld(['blue-01-a', 'red-01-a', 'joker-a'], {
      'joker-a': { color: 'black', value: 1 },
    })!,
    parseMeld(['blue-02-a', 'blue-03-a', 'blue-04-a'])!,
  ];
  return {
    context: {
      rack: ['red-01-a', 'blue-03-a', 'blue-04-a'],
      table: [before],
      opened: true,
    },
    after,
  };
}

describe('拉密规划局部百搭证明缓存', () => {
  it('缓存等价且实例与预算键隔离，命中返回独立证明并最多256项', () => {
    const { context, after } = fixture();
    const cache = new turn.TurnProofCache();
    const search = vi.spyOn(solver, 'searchSets');
    try {
      const plain = turn.prepareTurn(context, after);
      const first = turn.prepareTurn(context, after, { proofCache: cache });
      expect(first).toEqual(plain);
      expect(first).not.toBeNull();
      expect(cache.size).toBe(1);
      const calls = search.mock.calls.length;
      const hit = turn.prepareTurn(context, after, { proofCache: cache });
      expect(search.mock.calls).toHaveLength(calls);
      expect(hit).toEqual(plain);
      first!.releases![0]!.replacementSets[0]!.tiles[0]!.value = 13;
      expect(turn.prepareTurn(context, after, { proofCache: cache })).toEqual(
        plain,
      );
      expect(turn.inspectTurn(context, hit!)).toEqual(
        turn.inspectTurn(context, plain!),
      );
      const copyContext = {
        ...context,
        rack: context.rack.map((id) => id.replace('-a', '-b')),
      };
      const copyAfter = after.map((m) => ({
        ...m,
        tiles: m.tiles.map((p) => ({
          ...p,
          tileId: context.rack.includes(p.tileId)
            ? p.tileId.replace('-a', '-b')
            : p.tileId,
        })),
      }));
      expect(
        turn.prepareTurn(copyContext, copyAfter, { proofCache: cache }),
      ).not.toBeNull();
      expect(cache.size).toBe(2);
      for (let maxNodes = 100; maxNodes < 358; maxNodes++)
        expect(
          turn.prepareTurn(context, after, { maxNodes, proofCache: cache }),
        ).not.toBeNull();
      expect(cache.size).toBe(256);
    } finally {
      search.mockRestore();
    }
  });

  it('预算中断不缓存，完整真实无解可缓存且不污染其他实例', () => {
    const { context, after } = fixture();
    const cache = new turn.TurnProofCache();
    expect(
      turn.prepareTurn(context, after, { maxNodes: 0, proofCache: cache }),
    ).toBeNull();
    expect(cache.size).toBe(0);
    expect(
      turn.prepareTurn(context, after, { proofCache: cache }),
    ).not.toBeNull();
    const blockedContext = {
      rack: ['orange-12-a'],
      table: [
        parseMeld(['blue-06-a', 'blue-07-a', 'joker-a'], {
          'joker-a': { color: 'blue', value: 8 },
        })!,
        parseMeld(['orange-09-a', 'orange-10-a', 'orange-11-a'])!,
      ],
      opened: true,
    };
    const blockedAfter = [
      parseMeld(['blue-06-a', 'blue-07-a', 'joker-a'], {
        'joker-a': { color: 'blue', value: 5 },
      })!,
      parseMeld(['orange-09-a', 'orange-10-a', 'orange-11-a', 'orange-12-a'])!,
    ];
    expect(
      turn.prepareTurn(blockedContext, blockedAfter, { proofCache: cache }),
    ).toBeNull();
    expect(cache.size).toBe(2);
    const search = vi.spyOn(solver, 'searchSets');
    try {
      expect(
        turn.prepareTurn(blockedContext, blockedAfter, { proofCache: cache }),
      ).toBeNull();
      expect(search).not.toHaveBeenCalled();
      expect(
        turn.prepareTurn(context, after, { proofCache: cache }),
      ).not.toBeNull();
    } finally {
      search.mockRestore();
    }
  });

  it('取消不缓存也不能读取已命中的证明，缓存不进入动作或存档', () => {
    const { context, after } = fixture();
    const cache = new turn.TurnProofCache();
    const cancelled = new AbortController();
    cancelled.abort();
    expect(
      turn.prepareTurn(context, after, {
        signal: cancelled.signal,
        proofCache: cache,
      }),
    ).toBeNull();
    expect(cache.size).toBe(0);
    const valid = turn.prepareTurn(context, after, { proofCache: cache });
    expect(valid).not.toBeNull();
    expect(cache.size).toBe(1);
    expect(
      turn.prepareTurn(context, after, {
        signal: cancelled.signal,
        proofCache: cache,
      }),
    ).toBeNull();
    expect(cache.size).toBe(1);
    expect(JSON.parse(JSON.stringify(valid))).toEqual(valid);
    expect(valid).not.toHaveProperty('proofCache');
  });
});
