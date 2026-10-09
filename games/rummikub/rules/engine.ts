import type { RuleContext } from '../../../packages/game-sdk/src';
import { getTile, RULES_VERSION, TILE_IDS } from '../data/catalog';
import { normalizeTable } from '../shared/melds';
import { findLegalPlay, inspectTurn } from '../shared/turn';
import type { Action } from '../types';
import { matchWinners, scoreGame } from './scoring';
import type { State } from './state';

function shuffle(ids: readonly string[], context: RuleContext): string[] {
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const random = context.random.next();
    if (!Number.isFinite(random) || random < 0 || random >= 1)
      throw new Error('随机源无效。');
    const other = Math.floor(random * (i + 1));
    [shuffled[i], shuffled[other]] = [shuffled[other]!, shuffled[i]!];
  }
  return shuffled;
}
function selectStarter(context: RuleContext): string {
  let tied = [...context.seats];
  // Jokers are redrawn; sampling only numbered tiles is the equivalent
  // rejection-free distribution. Tied highest players redraw together.
  for (let attempt = 0; attempt < 4096; attempt++) {
    const tiles = shuffle(
      TILE_IDS.filter((id) => !getTile(id).joker),
      context,
    );
    const draws = tied.map((seat, index) => ({
      seat,
      value: getTile(tiles[index]!).value!,
    }));
    const maximum = Math.max(...draws.map((draw) => draw.value));
    tied = draws
      .filter((draw) => draw.value === maximum)
      .map((draw) => draw.seat);
    if (tied.length === 1) return tied[0]!;
  }
  throw new Error('先手抽牌无法决出，请检查随机源。');
}
function deal(context: RuleContext) {
  const startSeat = selectStarter(context);
  const pool = shuffle(TILE_IDS, context);
  const racks: Record<string, string[]> = {};
  for (const seat of context.seats) racks[seat] = pool.splice(0, 14);
  return {
    pool,
    racks,
    startSeat,
    turnSeat: startSeat,
    turnNumber: 1,
    table: [] as State['table'],
    passed: [] as string[],
    opened: Object.fromEntries(context.seats.map((seat) => [seat, false])),
  };
}
export function initialize(context: RuleContext, roundCount = 1): State {
  if (
    context.seats.length < 2 ||
    context.seats.length > 4 ||
    new Set(context.seats).size !== context.seats.length ||
    !Number.isSafeInteger(roundCount) ||
    roundCount < 1 ||
    roundCount > 10
  )
    throw new Error('经典拉密支持二至四人。');
  return {
    gameId: 'rummikub',
    rulesVersion: RULES_VERSION,
    stateVersion: 1,
    seats: [...context.seats],
    phase: 'playing',
    roundCount,
    gameCount: context.seats.length * roundCount,
    gameNumber: 1,
    ...deal(context),
    wins: Object.fromEntries(context.seats.map((seat) => [seat, 0])),
    scores: Object.fromEntries(context.seats.map((seat) => [seat, 0])),
    results: [],
    winners: [],
    serial: 0,
    latest: null,
  };
}
function nextTurn(s: State) {
  s.turnNumber++;
  s.turnSeat =
    s.seats[
      (s.seats.indexOf(s.startSeat) + s.turnNumber - 1) % s.seats.length
    ]!;
}
function finishGame(s: State, reason: 'empty-rack' | 'blocked') {
  const result = scoreGame(s.seats, s.racks, reason, s.gameNumber);
  s.results.push(result);
  for (const seat of s.seats) {
    s.scores[seat]! += result.scores[seat]!;
    if (result.winners.includes(seat)) s.wins[seat]!++;
  }
  s.turnSeat = null;
  s.phase = s.gameNumber === s.gameCount ? 'ended' : 'game-result';
  if (s.phase === 'ended') s.winners = matchWinners(s.seats, s.wins, s.scores);
}
export function applyAction(
  before: State,
  action: Action,
  seat: string,
  context: RuleContext,
): State {
  if (JSON.stringify(before.seats) !== JSON.stringify(context.seats))
    throw new Error('座位上下文不一致。');
  if (before.phase !== 'playing' || before.turnSeat !== seat)
    throw new Error('尚未轮到该玩家。');
  const s = structuredClone(before);
  s.serial++;
  if (action.type === 'submit-turn') {
    const inspection = inspectTurn(
      {
        rack: before.racks[seat]!,
        table: before.table,
        opened: before.opened[seat]!,
      },
      action,
    );
    s.table = normalizeTable(action.table);
    s.racks[seat] = s.racks[seat]!.filter(
      (id) => !inspection.placedTileIds.includes(id),
    );
    s.opened[seat] = true;
    s.passed = [];
    s.latest = {
      serial: s.serial,
      actor: seat,
      verb: 'submit-turn',
      text: `座位 ${s.seats.indexOf(seat) + 1} 打出 ${inspection.placedTileIds.length} 张牌并完成重组。`,
      placedTileIds: inspection.placedTileIds,
    };
    if (s.racks[seat]!.length === 0) finishGame(s, 'empty-rack');
    else nextTurn(s);
  } else if (action.type === 'draw') {
    if (!s.pool.length) throw new Error('牌池已空，不能摸牌。');
    s.racks[seat]!.push(s.pool.shift()!);
    s.passed = [];
    s.latest = {
      serial: s.serial,
      actor: seat,
      verb: 'draw',
      text: `座位 ${s.seats.indexOf(seat) + 1} 摸一张牌，回合结束。`,
      placedTileIds: [],
    };
    nextTurn(s);
  } else if (action.type === 'pass') {
    if (s.pool.length) throw new Error('牌池有牌时须摸牌，不能跳过。');
    const legal = findLegalPlay({
      rack: s.racks[seat]!,
      table: s.table,
      opened: s.opened[seat]!,
    });
    if (!legal.complete || legal.action)
      throw new Error('仍有合法出牌，不能以跳过证明堵局。');
    s.passed.push(seat);
    s.latest = {
      serial: s.serial,
      actor: seat,
      verb: 'pass',
      text: `座位 ${s.seats.indexOf(seat) + 1} 没有合法出牌，结束回合。`,
      placedTileIds: [],
    };
    if (s.passed.length === s.seats.length) finishGame(s, 'blocked');
    else nextTurn(s);
  } else throw new Error('当前不接受该玩家动作。');
  return s;
}
export function nextGame(before: State, context: RuleContext): State {
  if (
    before.phase !== 'game-result' ||
    JSON.stringify(before.seats) !== JSON.stringify(context.seats)
  )
    throw new Error('当前不能开始下一局。');
  const s = structuredClone(before);
  Object.assign(s, deal(context));
  s.phase = 'playing';
  s.gameNumber++;
  s.serial++;
  s.latest = {
    serial: s.serial,
    actor: null,
    verb: 'next-game',
    text: `第 ${s.gameNumber} 局开始，每人重新领取十四张牌。`,
    placedTileIds: [],
  };
  return s;
}
