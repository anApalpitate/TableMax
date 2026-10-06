export type BoardIconName =
  | 'market'
  | 'income'
  | 'wide'
  | 'narrow'
  | 'search'
  | 'sound'
  | 'muted'
  | 'left'
  | 'right'
  | 'up'
  | 'down';
export function BoardIcon({ name }: { name: BoardIconName }) {
  const triangles: Partial<Record<BoardIconName, string>> = {
    left: 'M16 4 4 12l12 8Z',
    right: 'M8 4l12 8-12 8Z',
    up: 'M4 16l8-12 8 12Z',
    down: 'M4 8l8 12 8-12Z',
  };
  return (
    <svg className="pg-board-icon" viewBox="0 0 24 24" aria-hidden="true">
      {triangles[name] ? (
        <path d={triangles[name]} fill="currentColor" />
      ) : name === 'market' ? (
        <>
          <path
            d="M4 20V8l6 4V8l6 4V4h4v16Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M7 16h2m3 0h2m3 0h2" stroke="currentColor" strokeWidth="2" />
        </>
      ) : name === 'income' ? (
        <g transform="translate(-1.5 -.5)">
          <circle
            cx="15"
            cy="15"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="m9 2-5 8h5l-3 6 8-9h-5l3-5" fill="currentColor" />
        </g>
      ) : name === 'sound' || name === 'muted' ? (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9h4l5-4v14l-5-4H3Z" fill="currentColor" stroke="none" />
          {name === 'sound' ? (
            <>
              <path d="M16 8a6 6 0 0 1 0 8" />
              <path d="M19 5a10 10 0 0 1 0 14" />
            </>
          ) : (
            <path d="m16 9 6 6m0-6-6 6" />
          )}
        </g>
      ) : name === 'search' ? (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="9.5" cy="9.5" r="6" />
          <path d="m14 14 6.5 6.5" />
        </g>
      ) : (
        <>
          <rect
            x="2"
            y="4"
            width="20"
            height="16"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d={name === 'wide' ? 'M5 8h10v8H5Z' : 'M5 8h4v8H5Z'}
            fill="currentColor"
          />
          <path
            d={name === 'wide' ? 'm17 9 3 3-3 3' : 'm18 9-3 3 3 3'}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </>
      )}
    </svg>
  );
}
