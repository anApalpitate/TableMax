import type { RaView } from '../rules';
import { tile, type Tile } from '../rules/data';
import type { Breakdown, Scene } from '../rules/state';

export const scoreCategories = [
  ['pharaoh', '法老'],
  ['god', '神明'],
  ['gold', '黄金'],
  ['river', '河流'],
  ['civilization', '文明'],
  ['monument', '纪念物'],
  ['disks', '太阳圆盘'],
] as const;

export type ScoreCategory = keyof Breakdown;
export type ScoreStep = ScoreCategory | 'total';
export const scoreBeatMs = 180;
export const totalStep = scoreCategories.length;

type Settlement = Extract<Scene, { kind: 'settlement' }>;
export type SettlementTable = {
  scene: Settlement;
  game: RaView;
  step: number;
  key: string;
};

export const scoringStep = (step: number): ScoreStep | undefined =>
  step === totalStep ? 'total' : scoreCategories[step]?.[0];

const discardSteps: Partial<Record<Tile['kind'], number>> = {
  god: 1,
  gold: 2,
  flood: 3,
  civilization: 4,
};

export function publicCategoryPoints(
  table: SettlementTable,
  seat: string,
  category: ScoreStep,
) {
  const score = table.game.publicScores?.find(
    (entry) => entry.seat === seat,
  )?.latest;
  if (score?.epoch !== table.scene.epoch) return undefined;
  return category === 'total' ? score.total : score.parts[category];
}

export function seatSettlement(table: SettlementTable, seat: string) {
  const ids =
    table.scene.holdings.find((holding) => holding.seat === seat)?.ids ?? [];
  const held = ids.map(tile);
  const category = scoringStep(table.step);
  const activated = held.some(({ kind }) => kind === 'flood');
  const current = (piece: Tile) =>
    category === 'river'
      ? piece.kind === 'flood' || (piece.kind === 'nile' && activated)
      : piece.kind === category;
  const participating = held.filter(current);
  const order = [...new Set(participating.map(({ face }) => face))];
  const motion = (piece: Tile, count: number) => {
    const discardAt =
      table.scene.epoch < 3 ? discardSteps[piece.kind] : undefined;
    if (discardAt !== undefined && table.step > discardAt)
      return { hidden: true };
    if (!current(piece)) return undefined;
    const start =
      piece.kind === 'nile'
        ? 68
        : piece.kind === 'flood' || category === 'pharaoh'
          ? 0
          : order.indexOf(piece.face) * 18;
    return {
      hit: piece.kind,
      start,
      set: category === 'monument' && count >= 3,
      discard: discardAt === table.step,
    };
  };
  const points = category && publicCategoryPoints(table, seat, category);
  const player = table.game.players.find((entry) => entry.seat === seat);
  const spent =
    category === 'disks' && table.game.phase === 'ended'
      ? player?.private?.spentDisks
      : undefined;
  const score =
    category === 'total' && points !== undefined
      ? table.game.publicScores?.find((entry) => entry.seat === seat)?.latest
      : undefined;
  const floor = score
    ? score.delta -
      Object.values(score.parts).reduce((sum, part) => sum + part, 0)
    : 0;
  return { held, category, points, motion, player, spent, floor };
}
