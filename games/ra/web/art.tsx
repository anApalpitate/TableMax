import { resourceUrl } from '@tablemax/web-host';
import { tileNames, type Tile } from '../rules/data';

const raArt = (file: string) => resourceUrl(`ra/${file}`, import.meta.url);

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
  | 'player-board'
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
