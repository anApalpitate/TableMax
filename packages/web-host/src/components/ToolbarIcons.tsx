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
