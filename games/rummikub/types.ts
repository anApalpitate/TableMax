export const COLORS = ['black', 'blue', 'orange', 'red'] as const;
export type Color = (typeof COLORS)[number];
export type Tile = {
  id: string;
  color: Color | null;
  value: number | null;
  joker: boolean;
};
/** Every physical tile occurs once; joker colour/value are explicit bindings. */
export type Placement = { tileId: string; color: Color; value: number };
export type Meld = { kind: 'run' | 'group'; tiles: Placement[] };
/** Legal replacement sets cover all natural tiles of the joker's old set. */
export type JokerReleaseProof = { jokerId: string; replacementSets: Meld[] };
export type PlayAction = {
  type: 'submit-turn';
  table: Meld[];
  releases?: JokerReleaseProof[];
};
export type Action =
  PlayAction | { type: 'draw' } | { type: 'pass' } | { type: 'next-game' };
export type GameResult = {
  gameNumber: number;
  reason: 'empty-rack' | 'blocked';
  winners: string[];
  rackValues: Record<string, number>;
  scores: Record<string, number>;
};
export type LatestAction = {
  serial: number;
  actor: string | null;
  verb: 'submit-turn' | 'draw' | 'pass' | 'next-game' | 'game-ended';
  text: string;
  placedTileIds: string[];
};
export type RummikubView = {
  gameId: 'rummikub';
  rulesVersion: string;
  phase: 'playing' | 'game-result' | 'ended';
  seatOrder: string[];
  gameNumber: number;
  gameCount: number;
  roundCount: number;
  turnNumber: number;
  turnSeat: string | null;
  table: Meld[];
  poolCount: number;
  players: Record<
    string,
    { rackCount: number; opened: boolean; score: number; wins: number }
  >;
  self: { seatId: string; rack: Tile[]; opened: boolean } | null;
  results: GameResult[];
  winners: string[];
  latest: LatestAction | null;
};
