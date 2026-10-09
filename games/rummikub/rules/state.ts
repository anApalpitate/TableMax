import { getTile, RULES_VERSION, TILE_IDS } from '../data/catalog';
import { normalizeTable, tableKey } from '../shared/melds';
import { findLegalPlay } from '../shared/turn';
import type { GameResult, LatestAction, Meld } from '../types';
import { matchWinners, scoreGame } from './scoring';

export type State = {
  gameId: 'rummikub';
  rulesVersion: string;
  stateVersion: 1;
  seats: string[];
  phase: 'playing' | 'game-result' | 'ended';
  roundCount: number;
  gameCount: number;
  gameNumber: number;
  startSeat: string;
  turnSeat: string | null;
  turnNumber: number;
  pool: string[];
  racks: Record<string, string[]>;
  opened: Record<string, boolean>;
  table: Meld[];
  passed: string[];
  wins: Record<string, number>;
  scores: Record<string, number>;
  results: GameResult[];
  winners: string[];
  serial: number;
  latest: LatestAction | null;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]) =>
  object(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const integer = (v: unknown, min: number, max: number) =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function demand(ok: unknown): asserts ok {
  if (!ok) throw new Error('拉密存档状态无效。');
}
const seatRecord = (v: unknown, seats: readonly string[]) =>
  exact(v, [...seats]);

export function validateState(input: unknown, seats: readonly string[]): State {
  demand(
    exact(input, [
      'gameId',
      'rulesVersion',
      'stateVersion',
      'seats',
      'phase',
      'roundCount',
      'gameCount',
      'gameNumber',
      'startSeat',
      'turnSeat',
      'turnNumber',
      'pool',
      'racks',
      'opened',
      'table',
      'passed',
      'wins',
      'scores',
      'results',
      'winners',
      'serial',
      'latest',
    ]),
  );
  const s = input as State;
  demand(
    s.gameId === 'rummikub' &&
      s.rulesVersion === RULES_VERSION &&
      s.stateVersion === 1,
  );
  demand(
    seats.length >= 2 &&
      seats.length <= 4 &&
      new Set(seats).size === seats.length &&
      seats.every((seat) => typeof seat === 'string' && seat.length > 0) &&
      same(s.seats, seats),
  );
  demand(
    ['playing', 'game-result', 'ended'].includes(s.phase) &&
      integer(s.roundCount, 1, 10) &&
      s.gameCount === seats.length * s.roundCount &&
      integer(s.gameNumber, 1, s.gameCount) &&
      integer(s.turnNumber, 1, Number.MAX_SAFE_INTEGER) &&
      integer(s.serial, 0, Number.MAX_SAFE_INTEGER) &&
      seats.includes(s.startSeat),
  );
  demand(
    seatRecord(s.racks, seats) &&
      seatRecord(s.opened, seats) &&
      seatRecord(s.wins, seats) &&
      seatRecord(s.scores, seats),
  );
  for (const seat of seats) {
    demand(
      Array.isArray(s.racks[seat]) &&
        s.racks[seat]!.length <= 106 &&
        s.racks[seat]!.every(
          (id) => typeof id === 'string' && TILE_IDS.includes(id),
        ) &&
        typeof s.opened[seat] === 'boolean' &&
        integer(s.wins[seat], 0, s.gameCount) &&
        Number.isFinite(s.scores[seat]),
    );
    demand(s.opened[seat] || s.racks[seat]!.length >= 14);
  }
  demand(
    Array.isArray(s.pool) &&
      s.pool.length <= 106 &&
      s.pool.every((id) => typeof id === 'string' && TILE_IDS.includes(id)),
  );
  const normalized = normalizeTable(s.table);
  const tableIds = normalized.flatMap((m) => m.tiles.map((p) => p.tileId));
  const allIds = [
    ...s.pool,
    ...tableIds,
    ...seats.flatMap((seat) => s.racks[seat]!),
  ];
  demand(
    allIds.length === 106 &&
      new Set(allIds).size === 106 &&
      allIds.every((id) => TILE_IDS.includes(id)),
  );
  demand(
    tableIds.length
      ? seats.some((seat) => s.opened[seat])
      : seats.every((seat) => !s.opened[seat]),
  );
  demand(
    Array.isArray(s.passed) &&
      new Set(s.passed).size === s.passed.length &&
      s.passed.every((seat) => seats.includes(seat)) &&
      s.passed.length <= seats.length &&
      (s.passed.length === 0 || s.pool.length === 0),
  );
  demand(
    Array.isArray(s.results) &&
      s.results.length === s.gameNumber - (s.phase === 'playing' ? 1 : 0),
  );
  const totalScores = Object.fromEntries(seats.map((seat) => [seat, 0]));
  const totalWins = Object.fromEntries(seats.map((seat) => [seat, 0]));
  for (let i = 0; i < s.results.length; i++) {
    const r = s.results[i]!;
    demand(
      exact(r, ['gameNumber', 'reason', 'winners', 'rackValues', 'scores']) &&
        r.gameNumber === i + 1 &&
        ['empty-rack', 'blocked'].includes(r.reason) &&
        seatRecord(r.rackValues, seats) &&
        seatRecord(r.scores, seats),
    );
    demand(
      seats.every((seat) => integer(r.rackValues[seat], 0, 788)) &&
        Object.values(r.rackValues).reduce((sum, n) => sum + n, 0) <= 788,
    );
    const minimum = Math.min(...Object.values(r.rackValues));
    const expectedWinners = seats.filter((seat) =>
      r.reason === 'empty-rack'
        ? r.rackValues[seat] === 0
        : r.rackValues[seat] === minimum,
    );
    demand(
      expectedWinners.length > 0 &&
        (r.reason !== 'empty-rack' || expectedWinners.length === 1) &&
        same(r.winners, expectedWinners),
    );
    const loss = Object.fromEntries(
      seats.map((seat) => [
        seat,
        expectedWinners.includes(seat)
          ? 0
          : r.reason === 'blocked'
            ? minimum - r.rackValues[seat]!
            : -r.rackValues[seat]!,
      ]),
    );
    const reward = -Object.values(loss).reduce((sum, n) => sum + n, 0);
    for (const seat of seats) {
      const expected = expectedWinners.includes(seat)
        ? reward / expectedWinners.length
        : loss[seat]!;
      demand(r.scores[seat] === expected);
      totalScores[seat]! += expected;
      if (expectedWinners.includes(seat)) totalWins[seat]!++;
    }
  }
  demand(
    seats.every(
      (seat) =>
        s.scores[seat] === totalScores[seat] &&
        s.wins[seat] === totalWins[seat],
    ),
  );
  const emptySeats = seats.filter((seat) => !s.racks[seat]!.length);
  if (s.phase === 'playing') {
    demand(
      s.turnSeat ===
        seats[(seats.indexOf(s.startSeat) + s.turnNumber - 1) % seats.length] &&
        emptySeats.length === 0 &&
        s.passed.length < seats.length &&
        s.winners.length === 0,
    );
    for (let i = 0; i < s.passed.length; i++)
      demand(
        s.passed[i] ===
          seats[
            (seats.indexOf(s.turnSeat!) - s.passed.length + i + seats.length) %
              seats.length
          ],
      );
  } else {
    demand(s.turnSeat === null);
    const last = s.results.at(-1)!;
    demand(same(last, scoreGame(seats, s.racks, last.reason, s.gameNumber)));
    demand(
      last.reason === 'empty-rack'
        ? emptySeats.length === 1
        : emptySeats.length === 0 &&
            s.pool.length === 0 &&
            s.passed.length === seats.length,
    );
    demand(
      s.phase === 'ended'
        ? s.gameNumber === s.gameCount &&
            same(s.winners, matchWinners(seats, s.wins, s.scores))
        : s.gameNumber < s.gameCount && s.winners.length === 0,
    );
  }
  // A saved forced-pass claim is independently verified; voluntary refusal is
  // never proof that a player has no legal whole-table manipulation.
  for (const seat of s.passed) {
    const search = findLegalPlay({
      rack: s.racks[seat]!,
      table: normalized,
      opened: s.opened[seat]!,
    });
    demand(search.complete && search.action === null);
  }
  if (s.latest !== null) {
    demand(
      exact(s.latest, ['serial', 'actor', 'verb', 'text', 'placedTileIds']) &&
        s.latest.serial === s.serial &&
        (s.latest.actor === null || seats.includes(s.latest.actor)) &&
        typeof s.latest.text === 'string' &&
        s.latest.text.length <= 300 &&
        ['submit-turn', 'draw', 'pass', 'next-game', 'game-ended'].includes(
          s.latest.verb,
        ) &&
        Array.isArray(s.latest.placedTileIds) &&
        new Set(s.latest.placedTileIds).size ===
          s.latest.placedTileIds.length &&
        s.latest.placedTileIds.every((id) => tableIds.includes(id)),
    );
    demand(
      s.latest.verb === 'submit-turn'
        ? s.latest.placedTileIds.length > 0
        : s.latest.placedTileIds.length === 0,
    );
    demand(
      s.latest.verb === 'next-game'
        ? s.latest.actor === null
        : s.latest.actor !== null,
    );
  }
  demand(s.serial === 0 ? s.latest === null : s.latest !== null);
  if (s.serial === 0)
    demand(
      s.phase === 'playing' &&
        s.gameNumber === 1 &&
        s.turnNumber === 1 &&
        tableIds.length === 0 &&
        s.passed.length === 0 &&
        seats.every((seat) => s.racks[seat]!.length === 14),
    );
  // Parsing produces a canonical copy without changing the caller's object.
  const copy = structuredClone(s);
  copy.table = normalized;
  demand(tableKey(copy.table) === tableKey(s.table));
  copy.pool.forEach(getTile);
  return copy;
}
