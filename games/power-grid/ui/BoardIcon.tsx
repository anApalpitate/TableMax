export type BoardIconName =
  'market' | 'income' | 'wide' | 'narrow' | 'left' | 'right' | 'up' | 'down';
export function BoardIcon({ name }: { name: BoardIconName }) {
  const triangles: Partial<Record<BoardIconName, string>> = {
    left: 'M17 4 5 12l12 8Z',
    right: 'M7 4l12 8-12 8Z',
    up: 'M4 17l8-12 8 12Z',
    down: 'M4 7l8 12 8-12Z',
  };
  return (
    <svg className="pg-board-icon" viewBox="0 0 24 24" aria-hidden="true">
      {triangles[name] ? (
        <path d={triangles[name]} fill="currentColor" />
      ) : name === 'market' ? (
        <>
          <path
            d="M3 21V9l6 4V9l6 4V5h4v16Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M7 17h2m3 0h2m3 0h2" stroke="currentColor" strokeWidth="2" />
        </>
      ) : name === 'income' ? (
        <>
          <circle
            cx="15"
            cy="15"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="m9 2-5 8h5l-3 6 8-9h-5l3-5" fill="currentColor" />
        </>
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
