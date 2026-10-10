import type { CSSProperties } from 'react';

export type RelicKind = 'grail' | 'sword' | 'raven' | 'seal';

/** Original local bitmap relics, with exact functional text kept in the UI. */
export function Relic({
  kind,
  className = '',
}: {
  kind: RelicKind;
  className?: string;
}) {
  const position: Record<RelicKind, string> = {
    grail: '0% 0%',
    sword: '100% 0%',
    raven: '0% 100%',
    seal: '100% 100%',
  };
  return (
    <span
      className={`av-relic av-relic--${kind} ${className}`}
      style={{ '--relic-position': position[kind] } as CSSProperties}
      aria-hidden="true"
    />
  );
}

export function Crown() {
  return (
    <svg viewBox="0 0 32 26" fill="none" aria-hidden="true">
      <path
        d="M5 20 2 6l8 7 6-11 6 11 8-7-3 14H5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path d="M6 24h20" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function BallotMark({ approve }: { approve: boolean }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
      {approve ? (
        <path
          d="m13 24 8 8 15-17"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="m16 16 16 16m0-16L16 32"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
