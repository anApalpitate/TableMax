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
export const scoreBeatMs = 180;

type Settlement = Extract<Scene, { kind: 'settlement' }>;
export type SettlementTable = {
  scene: Settlement;
  game: RaView;
  step: number;
  key: string;
};

export function isSampleCategory(category?: ScoreCategory) {
  return (
    category === 'pharaoh' ||
    category === 'river' ||
    category === 'civilization' ||
    category === 'monument'
  );
}

export function publicCategoryPoints(
  table: SettlementTable,
  seat: string,
  category: ScoreCategory,
) {
  const score = table.game.publicScores?.find(
    (entry) => entry.seat === seat,
  )?.latest;
  return score?.epoch === table.scene.epoch ? score.parts[category] : undefined;
}

export function seatSettlement(table: SettlementTable, seat: string) {
  const ids =
    table.scene.holdings.find((holding) => holding.seat === seat)?.ids ?? [];
  const held = ids.map(tile);
  const category = scoreCategories[table.step]?.[0];
  const sample = isSampleCategory(category);
  const activated = held.some(({ kind }) => kind === 'flood');
  const lost = new Set(
    table.scene.epoch < 3
      ? ids.filter((id) => {
          const kind = tile(id).kind;
          return (
            (kind === 'god' && table.step > 1) ||
            (kind === 'gold' && table.step > 2) ||
            (kind === 'flood' && table.step > 3) ||
            (kind === 'civilization' && table.step > 4)
          );
        })
      : [],
  );
  const current = (piece: Tile) =>
    sample &&
    (category === 'river'
      ? piece.kind === 'flood' || (piece.kind === 'nile' && activated)
      : piece.kind === category);
  const participating = held.filter(current);
  const order = [...new Set(participating.map(({ face }) => face))];
  const motion = (piece: Tile, count: number) => {
    if (lost.has(piece.id)) return { hidden: true };
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
      discard:
        table.scene.epoch < 3 &&
        (piece.kind === 'flood' || piece.kind === 'civilization'),
    };
  };
  const points =
    category && sample
      ? publicCategoryPoints(table, seat, category)
      : undefined;
  return { held, category, points, motion };
}
