import type { BotDifficulty } from '@tablemax/game-sdk';
import type { Action, RaView } from '../rules';
import { tile } from '../rules/data';
import { discardChoices } from '../rules/round';
import { holdingsBreakdown } from '../rules/scoring';

const tileWeights = {
  god: 2,
  gold: 3,
  pharaoh: 2,
  nile: 1,
  flood: 2,
  civilization: 2,
  monument: 2,
  disaster: -3,
  ra: 0,
};

type Player = RaView['players'][number];
const remaining = (held: readonly string[], spent: readonly string[]) =>
  held.filter((id) => !spent.includes(id));

export function evaluateRa(
  view: RaView,
  own: Player,
  difficulty: Exclude<BotDifficulty, 'default'>,
  signal: AbortSignal,
) {
  const detailed = difficulty !== 'doubao';
  const lot = view.lot.flatMap((entry) => (entry ? [entry.id] : []));
  const publicHoldings = new Map(
    view.players.map((player) => [
      player.seat,
      player.held.map(({ id }) => id),
    ]),
  );
  const ownHoldings = publicHoldings.get(own.seat)!;
  const hasFlood = own.held.some(({ kind }) => kind === 'flood');
  const ranks = view.limit - view.raDrawn;
  const rivalDisks = view.players.filter(
    (player) => player.seat !== own.seat && player.disks.length,
  );
  const visibleValue = (player: Player, held: readonly string[]) => {
    const all = view.players.map((entry) =>
      entry.seat === player.seat ? held : publicHoldings.get(entry.seat)!,
    );
    const current = holdingsBreakdown(held, all, view.epoch);
    const deferred =
      view.epoch === 3 ? 0 : holdingsBreakdown(held, all, 3).monument;
    const carry = held.reduce((score, id) => {
      const kind = tile(id).kind;
      return score + (kind === 'pharaoh' ? 0.65 : kind === 'nile' ? 0.55 : 0);
    }, 0);
    return (
      Object.values(current).reduce((sum, part) => sum + part, 0) +
      (3 - view.epoch) * carry +
      deferred * 0.65
    );
  };
  const receive = (
    player: Player,
    holdings: readonly string[],
    gained: readonly string[],
  ) => {
    let kept = [
      ...holdings,
      ...gained.filter((id) => tile(id).kind !== 'disaster'),
    ];
    for (const id of gained) {
      if (signal.aborted) throw new Error('太阳神策略已取消。');
      if (tile(id).kind !== 'disaster') continue;
      let best: string[] = [];
      let value = -Infinity;
      for (const choice of discardChoices(kept, id)) {
        const next = remaining(kept, choice.tileIds);
        const score = visibleValue(player, next);
        if (score > value) {
          best = next;
          value = score;
        }
      }
      kept = best;
    }
    return visibleValue(player, kept);
  };
  const ownValue = detailed ? visibleValue(own, ownHoldings) : 0;
  const quickValue = (ids: readonly string[]) =>
    ids.reduce((sum, id) => {
      const item = tile(id);
      const duplicate = own.held.some(({ face }) => face === item.face);
      return (
        sum +
        tileWeights[item.kind] +
        (item.kind === 'flood' && !hasFlood ? 0.5 : 0) -
        (item.kind === 'civilization' && duplicate ? 1.5 : 0)
      );
    }, 0);
  const lotValue = detailed
    ? receive(own, ownHoldings, lot) - ownValue
    : quickValue(lot);

  const publicScores = new Map(
    view.publicScores?.map(({ seat, total }) => [seat, total]),
  );
  const standings =
    difficulty === 'mischief'
      ? view.players
          .map((player) => ({
            player,
            score:
              (publicScores.get(player.seat) ?? 0) +
              visibleValue(player, publicHoldings.get(player.seat)!),
          }))
          .sort((a, b) => b.score - a.score)
      : [];
  const first = standings[0];
  const target =
    first &&
    first.player.seat !== own.seat &&
    first.score - standings[1]!.score >= 2
      ? first.player
      : undefined;
  function targetGain(ids: readonly string[]) {
    if (!target) return 0;
    const holdings = publicHoldings.get(target.seat)!;
    return Math.max(
      0,
      receive(target, holdings, ids) - visibleValue(target, holdings),
    );
  }

  const highestBid = view.auction?.bids
    .filter(({ disk }) => disk !== null)
    .at(-1);
  const finishedBidders = new Set(view.auction?.bids.map(({ seat }) => seat));
  const later = rivalDisks.filter(({ seat }) => !finishedBidders.has(seat));
  const targetValue =
    target && (highestBid?.seat === target.seat || later.includes(target))
      ? targetGain(lot)
      : 0;
  const costOf = (disk: number) =>
    (disk - view.center) * (view.epoch === 3 ? 0.56 : 0.34) +
    (ranks > 1 && own.disks.length === 1 ? 1.7 : 0.7);
  const gods = new Map<string, number>();
  return (action: Action) => {
    if (signal.aborted) throw new Error('太阳神策略已取消。');
    switch (action.type) {
      case 'bid': {
        const utility = lotValue - costOf(action.disk);
        if (!detailed) return utility;
        const threats = later.filter((opponent) =>
          opponent.disks.some((disk) => disk > action.disk),
        ).length;
        const preventsTarget =
          target &&
          (highestBid?.seat === target.seat ||
            (later.includes(target) &&
              target.disks.some((disk) => disk > (highestBid?.disk ?? 0)))) &&
          (!later.includes(target) ||
            target.disks.every((disk) => disk < action.disk));
        const denial =
          preventsTarget && utility >= -2 ? Math.min(targetValue * 0.55, 4) : 0;
        return (utility + denial) / (1 + 0.65 * threats);
      }
      case 'pass':
      case 'finishGod':
        return 0;
      case 'draw':
        return detailed && ranks === 1
          ? 1.4 - 0.5 * Math.max(lotValue, 0)
          : 2.6;
      case 'invokeRa': {
        const premium = own.disks.length ? costOf(Math.min(...own.disks)) : 0;
        const likelyTarget =
          target?.disks.length &&
          Math.max(...target.disks) > Math.max(...own.disks);
        return (
          (lotValue - premium) * (detailed ? 0.65 : 0.48) -
          (rivalDisks.length ? 1.1 : 0) -
          (likelyTarget ? Math.min(2, targetValue * 0.3) : 0)
        );
      }
      case 'spendGod': {
        if (!detailed) return quickValue([action.tileId]) - 1.5;
        let value = gods.get(action.tileId);
        if (value === undefined) {
          const held = remaining(ownHoldings, [action.godId]);
          value = receive(own, held, [action.tileId]) - ownValue;
          if (value >= -0.5 && target?.disks.length)
            value += Math.min(targetGain([action.tileId]) * 0.45, 3);
          gods.set(action.tileId, value);
        }
        return value;
      }
      case 'discard':
        return detailed
          ? visibleValue(own, remaining(ownHoldings, action.tileIds))
          : action.tileIds.reduce(
              (sum, id) =>
                sum +
                (own.held.filter(({ face }) => face === tile(id).face).length >
                1
                  ? 1
                  : 0),
              0,
            );
    }
  };
}
