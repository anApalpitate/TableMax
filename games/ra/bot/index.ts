import {
  applyCandidateRating,
  readCandidateRating,
  type BotStrategy,
} from '@tablemax/game-sdk';
import type { Action, RaView } from '../rules';
import { rulesVersion } from '../rules/data';
import { auctionDiskEncoder, encodeAuctionDisk } from './learning';
import { evaluateRa } from './valuation';

const baseline: BotStrategy = {
  id: 'ra-strategy',
  version: '1.1.0',
  gameId: 'ra',
  rulesVersion,
  difficulties: ['default', 'doubao', 'juewu', 'mischief'],
  validateMemory(input) {
    if (input !== null) throw new Error('非法策略记忆');
    return null;
  },
  async decide({
    view,
    actions,
    decision,
    memory,
    random,
    signal,
    difficulty = 'default',
  }) {
    baseline.validateMemory(memory);
    if (signal.aborted) throw new Error('太阳神策略已取消。');
    const v = view as RaView;
    const choices = actions as readonly Action[];
    const own = v.players.find((p) => p.seat === decision.seatId && p.private);
    if (!own || v.actor !== own.seat || !choices.length)
      throw new Error('没有本人合法动作');

    if (v.lot.every((slot) => slot === null)) {
      const draw = choices.find((action) => action.type === 'draw');
      const invoke = choices.find((action) => action.type === 'invokeRa');
      if (draw && invoke)
        return {
          action:
            own.disks.length > 1 &&
            v.center - Math.min(...own.disks) >= 5 &&
            v.players.every(
              (player) => player.seat === own.seat || player.disks.length === 0,
            )
              ? invoke
              : draw,
          memory: null,
        };
      if (v.auction?.caller === own.seat && v.auction.cause === 'invokeOpen') {
        const cheapest = choices.find(
          (action) =>
            action.type === 'bid' && action.disk === Math.min(...own.disks),
        );
        if (cheapest && !choices.some((action) => action.type === 'pass'))
          return { action: cheapest, memory: null };
      }
    }
    if (difficulty === 'default')
      return {
        action: choices[Math.floor(random.next() * choices.length)]!,
        memory: null,
      };

    const weight = evaluateRa(v, own, difficulty, signal);
    const ranked = choices.map((action) => ({
      action,
      value:
        weight(action) + random.next() * (difficulty === 'doubao' ? 0.8 : 0.05),
    }));
    return {
      action: ranked.reduce((best, next) =>
        next.value > best.value ? next : best,
      ).action,
      memory: null,
    };
  },
};

const { id: encoder, width } = auctionDiskEncoder;
export const bot: BotStrategy = {
  ...baseline,
  model: {
    difficulties: ['juewu'],
    supportsMatch: (seatCount, setup) =>
      seatCount === 4 &&
      (setup === undefined ||
        (setup !== null &&
          typeof setup === 'object' &&
          !Array.isArray(setup) &&
          setup.publicScoring === false)),
    validate: (model) => readCandidateRating(model, encoder, width),
  },
  async decide(input) {
    const result = await baseline.decide(input);
    if (input.model === undefined) return result;
    const view = input.view as RaView;
    if (
      input.difficulty !== 'juewu' ||
      view.players.length !== 4 ||
      view.publicScoring
    )
      throw new Error('太阳神学习评分只适用于四人非公开计分的绝悟。');
    input.signal.throwIfAborted();
    const model = readCandidateRating(input.model, encoder, width);
    return {
      ...result,
      action: applyCandidateRating(
        model,
        (view, action, seat) =>
          encodeAuctionDisk(view as RaView, action as Action, seat),
        input.view,
        input.actions,
        input.decision.seatId,
        result.action,
      ),
    };
  },
};
