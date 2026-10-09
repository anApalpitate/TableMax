import type { Binding } from './draft';
import type { Color, Tile } from '../types';
import { COLOR_NAMES } from './labels';

function ColorMark({ color }: { color: Color }) {
  return (
    <svg viewBox="0 0 16 16" className="rk-color-mark" aria-hidden="true">
      {color === 'black' ? (
        <rect x="4" y="4" width="8" height="8" rx="1" />
      ) : color === 'blue' ? (
        <path d="M8 2 13 8 8 14 3 8Z" />
      ) : color === 'orange' ? (
        <path d="m8 2 6 11H2Z" />
      ) : (
        <circle cx="8" cy="8" r="4" />
      )}
    </svg>
  );
}

export function NumberTile({
  tile,
  binding,
  selected = 0,
  onSelect,
  disabled = false,
  placed = false,
}: {
  tile: Tile;
  binding?: Binding;
  selected?: number;
  onSelect?: () => void;
  disabled?: boolean;
  placed?: boolean;
}) {
  const color = tile.joker ? binding?.color : tile.color;
  const value = tile.joker ? binding?.value : tile.value;
  const label = tile.joker
    ? `百搭${binding ? `，代表${COLOR_NAMES[binding.color]}色 ${binding.value}` : '，未指定颜色数字'}`
    : `${COLOR_NAMES[tile.color!]}色 ${tile.value}`;
  const face = (
    <>
      {selected > 0 && (
        <span className="rk-selected-order" aria-hidden="true">
          {selected}
        </span>
      )}
      {tile.joker ? (
        <>
          <svg className="rk-joker-face" viewBox="0 0 40 34" aria-hidden="true">
            <path
              d="M8 19 3 4l10 4L20 1l7 7 10-4-5 15"
              fill="#c74742"
              stroke="#723632"
              strokeWidth="1.5"
            />
            <circle cx="3" cy="4" r="2.5" fill="#bd8333" />
            <circle cx="20" cy="2" r="2.5" fill="#bd8333" />
            <circle cx="37" cy="4" r="2.5" fill="#bd8333" />
            <path
              d="M8 18h24v3c0 7-5 11-12 11S8 28 8 21Z"
              fill="#fff6db"
              stroke="#6e5741"
              strokeWidth="1.5"
            />
            <path
              d="M13 20h2m10 0h2m-11 5q4 4 8 0"
              fill="none"
              stroke="#513e2e"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="rk-joker-binding">
            {binding ? `${COLOR_NAMES[binding.color]}${binding.value}` : '百搭'}
          </span>
        </>
      ) : (
        <span className="rk-tile-number">{value}</span>
      )}
      {color && <ColorMark color={color} />}
      {placed && (
        <span className="rk-placed-mark" aria-hidden="true">
          ＋
        </span>
      )}
    </>
  );
  const className = `rk-tile rk-tile--${color ?? 'joker'}${selected ? ' rk-tile--selected' : ''}${placed ? ' rk-tile--placed' : ''}`;
  return onSelect ? (
    <button
      type="button"
      className={className}
      data-tile-id={tile.id}
      data-selected={selected > 0}
      aria-label={`${label}${selected ? `，第 ${selected} 张选中牌` : ''}`}
      aria-pressed={selected > 0}
      disabled={disabled}
      onClick={onSelect}
    >
      {face}
    </button>
  ) : (
    <span
      className={className}
      data-tile-id={tile.id}
      role="img"
      aria-label={label}
    >
      {face}
    </span>
  );
}
