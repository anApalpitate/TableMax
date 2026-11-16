import type { BotStrategy } from '@tablemax/game-sdk';
import type { Action, RaView } from '../rules';
import { rulesVersion, tile } from '../rules/data';

const weights = {
  god: 3,
  gold: 3,
  pharaoh: 2,
  nile: 1,
  flood: 2,
  civilization: 2,
  monument: 2,
  disaster: -3,
  ra: 0,
};
export const bot: BotStrategy = {
  id: 'ra-strategy',
  version: '1.0.0',
  gameId: 'ra',
  rulesVersion,
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory(input) {
    if (input !== null) throw new Error('非法策略记忆');
    return null;
  },
  async decide({ view, actions, decision, random, difficulty = 'default' }) {
    const v = view as RaView;
    const own = v.players.find((p) => p.seat === decision.seatId)!;
    const weight = (act: Action) => {
      const lotValue = v.lot.reduce(
        (sum, t) => sum + (t ? weights[t.kind] : 0),
        0,
      );
      const competitive = v.players.filter(
        (p) => p.seat !== own.seat && p.disks.length,
      ).length;
      switch (act.type) {
        case 'bid':
          return (
            lotValue + (v.center - act.disk) * (v.epoch === 3 ? 0.6 : 0.3) - 2
          );
        case 'pass':
          return 0;
        case 'draw':
          return v.raDrawn >= v.limit - 1 && competitive === 0 ? 0 : 2.5;
        case 'invokeRa':
          return (lotValue - 4) * 0.55 + (competitive ? 0 : 1);
        case 'spendGod':
          return weights[tile(act.tileId).kind] - 1.5;
        case 'finishGod':
          return 0;
        case 'discard':
          return act.tileIds.reduce(
            (sum, id) =>
              sum +
              (own.held.filter((t) => t.face === tile(id).face).length > 1
                ? 1
                : 0),
            0,
          );
      }
    };
    if (actions.length === 0) throw new Error('没有合法动作');
    if (difficulty === 'default')
      return {
        action: actions[Math.floor(random.next() * actions.length)]!,
        memory: null,
      };
    const ranked = actions.map((action) => ({
      action,
      value:
        weight(action as Action) +
        random.next() * (difficulty === 'doubao' ? 1.8 : 0.25),
    }));
    return {
      action: ranked.reduce((best, next) =>
        next.value > best.value ? next : best,
      ).action,
      memory: null,
    };
  },
};
