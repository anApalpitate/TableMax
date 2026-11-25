import type { RuleContext } from '@tablemax/game-sdk';
import { TILE_IDS } from '../data/catalog';
import { initialize, validateState } from '../rules';
import { parseMeld } from '../shared/melds';

export function pressureTable(context: RuleContext) {
  const state = initialize(context);
  const [own, next] = context.seats as readonly [string, string];
  state.racks = { [own]: ['red-05-a', 'black-13-a'], [next]: ['blue-13-a'] };
  state.opened = { [own]: true, [next]: true };
  state.startSeat = own;
  state.turnSeat = own;
  state.turnNumber = 5;
  state.serial = 4;
  const fullRun = (color: string) =>
    parseMeld(
      Array.from(
        { length: 10 },
        (_, index) => `${color}-${String(index + 1).padStart(2, '0')}-a`,
      ),
    )!;
  state.table = [
    fullRun('black'),
    fullRun('blue'),
    parseMeld(['red-02-a', 'red-03-a', 'red-04-a'])!,
    parseMeld(['red-06-a', 'red-07-a', 'red-08-a'])!,
  ];
  state.latest = {
    serial: state.serial,
    actor: next,
    verb: 'submit-turn',
    text: '夹具中上一席出牌',
    placedTileIds: ['red-06-a', 'red-07-a', 'red-08-a'],
  };
  const used = new Set([
    ...state.table.flatMap((meld) => meld.tiles.map(({ tileId }) => tileId)),
    ...Object.values(state.racks).flat(),
  ]);
  state.pool = TILE_IDS.filter((id) => !used.has(id));
  return validateState(state, context.seats);
}
