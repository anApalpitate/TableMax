export function BackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m11 6-6 6 6 6M5 12h14" />
    </svg>
  );
}

export function PreferencesIcon({
  kind,
}: {
  kind: 'basic' | 'game' | 'video';
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'basic' && <path d="M4 7h5m4 0h7M4 17h9m4 0h3M9 4v6m8 4v6" />}
      {kind === 'game' && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8.5 8.5h.01m3.5 3.5h.01m3.5 3.5h.01" strokeWidth="2.8" />
        </>
      )}
      {kind === 'video' && (
        <>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M12 17v4m-4 0h8" />
        </>
      )}
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.7 3h4.6l.5 2.5 1.5.9 2.5-.8 2.3 4-1.9 1.7v1.4l1.9 1.7-2.3 4-2.5-.8-1.5.9-.5 2.5H9.7l-.5-2.5-1.5-.9-2.5.8-2.3-4 1.9-1.7v-1.4L2.9 9.6l2.3-4 2.5.8 1.5-.9z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function RulebookIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v15M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" />
    </svg>
  );
}

export function SoundIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 9h4l5-4v14l-5-4H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path
        d={
          enabled ? 'M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14' : 'm17 9 5 6m0-6-5 6'
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
