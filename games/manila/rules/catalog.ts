import type { CargoId, SpaceView } from './view';

export const CARGOS: CargoId[] = ['nutmeg', 'silk', 'ginseng', 'jade'];
export const MARKET = [0, 5, 10, 15, 20, 30];
export const CARGO: Record<
  CargoId,
  { name: string; payout: number; costs: number[] }
> = {
  nutmeg: { name: '肉豆蔻', payout: 24, costs: [2, 3, 4] },
  silk: { name: '丝绸', payout: 30, costs: [3, 4, 5] },
  ginseng: { name: '人参', payout: 18, costs: [1, 2, 3] },
  jade: { name: '翡翠', payout: 36, costs: [3, 4, 5, 5] },
};
export const BERTH_COSTS = [4, 3, 2];
export const BERTH_PAYOUTS = [6, 8, 15];
export function emptySpaces(cargos: readonly CargoId[]): SpaceView[] {
  const spaces: SpaceView[] = [];
  for (const cargo of cargos)
    CARGO[cargo].costs.forEach((cost, index) =>
      spaces.push({
        id: `cargo-${cargo}-${index}`,
        kind: 'cargo',
        cargo,
        index,
        cost,
        payout: CARGO[cargo].payout,
        occupant: null,
      }),
    );
  for (const kind of ['port', 'shipyard'] as const)
    BERTH_COSTS.forEach((cost, index) =>
      spaces.push({
        id: `${kind}-${index}`,
        kind,
        cargo: null,
        index,
        cost,
        payout: BERTH_PAYOUTS[index]!,
        occupant: null,
      }),
    );
  for (let index = 0; index < 2; index++)
    spaces.push({
      id: `pirate-${index}`,
      kind: 'pirate',
      cargo: null,
      index,
      cost: 5,
      payout: null,
      occupant: null,
    });
  spaces.push(
    {
      id: 'pilot-small',
      kind: 'pilot',
      cargo: null,
      index: 0,
      cost: 2,
      payout: null,
      occupant: null,
    },
    {
      id: 'pilot-large',
      kind: 'pilot',
      cargo: null,
      index: 1,
      cost: 5,
      payout: null,
      occupant: null,
    },
    {
      id: 'insurance',
      kind: 'insurance',
      cargo: null,
      index: 0,
      cost: 0,
      payout: 10,
      occupant: null,
    },
  );
  return spaces;
}
