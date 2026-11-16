import { resourceUrl } from '@tablemax/web-host';
import { tileNames, type Tile } from '../rules/data';

const raArt = (file: string) => resourceUrl(`ra/${file}`, import.meta.url);

export function StoneRelief() {
  return <img className="ra-relief" src={raArt('relief.webp')} alt="" />;
}

const collected: Record<string, string> = {
  sphinx: 'pharaoh.webp',
  pyramid: 'pyramid.webp',
  nile: 'nile.webp',
  writing: 'writing.webp',
  agriculture: 'writing.webp',
  god: 'god.webp',
  religion: 'religion.webp',
  obelisk: 'obelisk.webp',
};

const pictogram: Record<string, string> = {
  ra: '☉',
  gold: '◆',
  pharaoh: '𓀭',
  flood: '≋',
  art: '𓏞',
  astronomy: '✦',
  statue: '𓀠',
  mortuary: '𓉐',
  shrine: '𓊹',
  temple: '𓉳',
  'step-pyramid': '𓉴',
  war: '⚔︎',
  earthquake: 'ϟ',
  funeral: '𓊪',
  drought: '☀',
};

export function TileFace({ tile }: { tile: Tile }) {
  const image = collected[tile.face];
  return (
    <span className={`ra-tile ra-${tile.kind}`}>
      {image ? (
        <img
          className="ra-pictogram"
          src={raArt(image)}
          alt=""
          draggable={false}
        />
      ) : (
        <span aria-hidden="true" className="ra-pictogram ra-ink">
          {pictogram[tile.face]}
        </span>
      )}
      <span className="ra-tile-name">{tileNames[tile.face]}</span>
    </span>
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
