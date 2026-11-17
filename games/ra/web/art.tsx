import { tileNames, type Tile } from '../rules/data';

const artwork = import.meta.glob<string>(
  [
    '../../../assets/games/ra/tiles/*.webp',
    '../../../assets/games/ra/table/*.webp',
    '../../../assets/games/ra/sun-*.svg',
  ],
  { eager: true, query: '?url', import: 'default' },
);
const raArt = (file: string) => artwork[`../../../assets/games/ra/${file}`];

export function TileFace({
  tile,
  decorative = false,
}: {
  tile: Tile;
  decorative?: boolean;
}) {
  return (
    <img
      className={`ra-tile ra-${tile.kind}`}
      src={raArt(`tiles/${tile.face}.webp`)}
      alt={decorative ? '' : tileNames[tile.face]}
      draggable={false}
    />
  );
}

type TablePiece =
  | 'auction-board'
  | 'sun-boat'
  | 'ra-statue'
  | 'epoch-first'
  | 'epoch-second'
  | 'tile-bag'
  | 'rulebook-illustration';

export function TableArt({
  piece,
  className,
}: {
  piece: TablePiece;
  className: string;
}) {
  return (
    <img
      className={className}
      src={raArt(`table/${piece}.webp`)}
      alt=""
      draggable={false}
    />
  );
}

export function SunDisk({ value }: { value?: number }) {
  return (
    <span className="ra-sun" data-value={value}>
      <img
        src={raArt(
          value === undefined
            ? 'sun-back.svg'
            : `sun-${String(value).padStart(2, '0')}.svg`,
        )}
        alt={value === undefined ? '已用太阳盘' : String(value)}
        draggable={false}
      />
    </span>
  );
}
