import type { GameRules, RuleContext } from '@tablemax/game-sdk';
import {
  auctionSlots,
  limits,
  rulesVersion,
  startingDisks,
  tile,
  tileIds,
} from './data';
import { legal, play, type Action } from './round';
import { highestSeat, total } from './scoring';
import { playerCount, validateState, type State } from './state';

function shuffle<T>(input: readonly T[], random: RuleContext['random']): T[] {
  const result = [...input];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random.next() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function validateAction(input: unknown): Action {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('非法动作');
  const a = input as Record<string, unknown>;
  const keys = Object.keys(a).length;
  switch (a.type) {
    case 'draw':
    case 'invokeRa':
    case 'pass':
    case 'finishGod':
      if (keys === 1) return { type: a.type };
      break;
    case 'bid':
      if (keys === 2 && typeof a.disk === 'number' && Number.isInteger(a.disk))
        return { type: a.type, disk: a.disk };
      break;
    case 'spendGod':
      if (
        keys === 4 &&
        typeof a.godId === 'string' &&
        typeof a.slot === 'number' &&
        Number.isInteger(a.slot) &&
        typeof a.tileId === 'string'
      )
        return { type: a.type, godId: a.godId, slot: a.slot, tileId: a.tileId };
      break;
    case 'discard':
      if (
        keys === 3 &&
        typeof a.disasterId === 'string' &&
        Array.isArray(a.tileIds) &&
        a.tileIds.length === 2 &&
        a.tileIds.every((id) => typeof id === 'string')
      )
        return {
          type: a.type,
          disasterId: a.disasterId,
          tileIds: [...a.tileIds].sort(),
        };
      break;
  }
  throw new Error('非法动作');
}

function project(
  s: State,
  viewer: { role: 'public' } | { role: 'player'; seatId: string },
) {
  const ended = s.phase === 'ended';
  return {
    epoch: s.epoch,
    raDrawn: s.raDrawn,
    limit: limits[playerCount(s.seats.length)],
    phase: s.phase,
    actor: s.actor,
    center: s.center,
    lot: s.lot.map((id) => (id === null ? null : tile(id))),
    auction: s.auction,
    lastAuction: s.lastAuction,
    pending: s.disaster
      ? { owner: s.disaster.owner, tile: tile(s.disaster.queue[0]!) }
      : null,
    winner: s.winner,
    players: s.seats.map((seat) => {
      const p = s.players[seat]!;
      const own = ended || (viewer.role === 'player' && viewer.seatId === seat);
      return {
        seat,
        disks: [...p.up],
        spent: p.down.length,
        held: p.held.map(tile),
        private: own
          ? { score: total(p), scores: p.scores, spentDisks: p.down }
          : null,
      };
    }),
  };
}
export type RaView = ReturnType<typeof project>;
export type { Action };

export const rules: GameRules<State, Action, RaView> = {
  manifest: {
    id: 'ra',
    name: '太阳神',
    gameVersion: '1.0.0',
    rulesVersion,
    sdkVersion: 1,
    stateVersion: 1,
    players: { min: 2, max: 5 },
    assetNamespace: 'ra',
  },
  initialize({ seats, random }) {
    const groups = shuffle<readonly number[]>(
      startingDisks[playerCount(seats.length)],
      random,
    );
    const s: State = {
      seats: [...seats],
      players: Object.fromEntries(
        seats.map((id, index) => [
          id,
          {
            up: [...groups[index]!].sort((a, b) => a - b),
            down: [],
            held: [],
            scores: [],
          },
        ]),
      ),
      epoch: 1,
      raDrawn: 0,
      phase: 'turn',
      actor: null,
      serial: 0,
      center: 1,
      bag: shuffle(tileIds, random),
      lot: Array.from({ length: auctionSlots }, () => null),
      removed: [],
      auction: null,
      lastAuction: null,
      disaster: null,
      winner: null,
    };
    s.actor = highestSeat(s);
    return validateState(s, seats);
  },
  validateState,
  decisions: (s) =>
    s.actor === null ? [] : [{ id: `ra-${s.serial}`, seatId: s.actor }],
  ended: (s) => s.phase === 'ended',
  validateAction,
  legalActions: legal,
  apply(input, intent, seat) {
    const action = validateAction(intent);
    if (
      !legal(input, seat).some(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(action),
      )
    )
      throw new Error('这一步不可执行');
    const state = structuredClone(input);
    const events = play(state, action, seat);
    const labels = {
      draw: '抽取板块前',
      invokeRa: '呼唤拉前',
      bid: '出价前',
      pass: '跳过出价前',
      spendGod: '使用神明前',
      finishGod: '结束神明行动前',
      discard: '选择灾难弃牌前',
    };
    return {
      state: validateState(state, input.seats),
      events,
      decision: {
        label: labels[action.type],
        roundNumber: input.epoch,
        revealedInformation: action.type === 'draw' || state.phase === 'ended',
      },
    };
  },
  project,
  lifecycleActions: () => [],
  applyLifecycle() {
    throw new Error('太阳神没有额外的局内管理动作');
  },
};
