import type { ArtistId, AuctionKind } from './view';
import type { PaintingSort } from './sorting';

export function ArtistMark({ artistId }: { artistId: ArtistId }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {artistId === 'manuel' && (
        <>
          <circle cx="12" cy="12" r="5" fill="currentColor" />
          <path
            d="M12 1v4m0 14v4M1 12h4m14 0h4M4 4l3 3m10 10 3 3M4 20l3-3M17 7l3-3"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
      {artistId === 'sigrid' && (
        <path
          d="m12 2 10 10-10 10L2 12Zm-5 10 5-5 5 5-5 5Z"
          fill="currentColor"
          fillRule="evenodd"
        />
      )}
      {artistId === 'daniel' && (
        <>
          <path d="M2 2h8v8H2Zm12 12h8v8h-8Z" fill="currentColor" />
          <circle cx="18" cy="6" r="4" fill="currentColor" />
          <circle cx="6" cy="18" r="4" fill="currentColor" />
        </>
      )}
      {artistId === 'ramon' && (
        <>
          <path d="M5 20C-1 5 9 1 21 3c1 13-4 20-16 17Z" fill="currentColor" />
          <path
            d="m5 20 12-12M9 15l-1-5m6 1 4 1"
            stroke="#fff9ed"
            strokeWidth="2"
          />
        </>
      )}
      {artistId === 'rafael' && (
        <path
          d="m12 1 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

export function AuctionMark({ kind }: { kind: AuctionKind }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === 'open' && <path d="m3 18 7-7 4 4 7-12M14 3h7v7" />}
        {kind === 'once' && (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="m10 9 2-2v10m-3 0h6" />
          </>
        )}
        {kind === 'sealed' && (
          <>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="m3 6 9 7 9-7" />
          </>
        )}
        {kind === 'fixed' && (
          <>
            <path d="M3 3h10l9 9-10 10-9-9Z" />
            <circle cx="8" cy="8" r="1" />
          </>
        )}
        {kind === 'double' && (
          <>
            <rect x="2" y="7" width="13" height="14" rx="1" />
            <path d="M8 3h14v14h-4" />
          </>
        )}
      </g>
    </svg>
  );
}

export function PaintingSortControl({
  value,
  change,
  label = '画作排序',
}: {
  value: PaintingSort;
  change(value: PaintingSort): void;
  label?: string;
}) {
  return (
    <select
      className="ma-sort"
      aria-label={label}
      value={value}
      onChange={(event) => change(event.target.value as PaintingSort)}
    >
      <option value="artist">按画家</option>
      <option value="auction">按拍卖方式</option>
      <option value="original">原顺序</option>
    </select>
  );
}
