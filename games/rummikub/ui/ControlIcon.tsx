export function ControlIcon({
  name,
}: {
  name: 'undo' | 'reset' | 'cancel' | 'more' | 'arrange';
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'undo' && <path d="m8 4-5 5 5 5M3 9h11a7 7 0 0 1 7 7v3" />}
      {name === 'reset' && <path d="M4 9a8 8 0 1 1 1 9M4 3v6h6" />}
      {name === 'cancel' && <path d="m6 6 12 12M18 6 6 18" />}
      {name === 'more' && (
        <>
          <circle cx="5" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="19" cy="12" r="1" fill="currentColor" />
        </>
      )}
      {name === 'arrange' && (
        <>
          <path d="M8 5h12M8 12h9M8 19h6M3 4v16m-2-3 2 3 2-3" />
          <path d="m18 17 3 3m0-3-3 3" />
        </>
      )}
    </svg>
  );
}
