import type { RoomView } from '@tablemax/protocol';

export function LobbyReadiness({
  seats,
  minimum,
}: {
  seats: RoomView['seats'];
  minimum: number;
}) {
  const ready = seats.filter((seat) => seat.ready).length;
  const enough = seats.length >= minimum;
  const allReady = enough && ready === seats.length;
  return (
    <div
      className="lobby-readiness"
      role="status"
      aria-label={`已入座 ${seats.length} 人，至少需要 ${minimum} 人；${ready} 人已准备`}
      data-minimum-players={minimum}
    >
      <span
        className={`lobby-readiness__item${enough ? ' is-complete' : ''}`}
        title={`至少 ${minimum} 人开局`}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <circle
            cx="9"
            cy="7"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-2-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span>入座</span>
        <strong>
          {seats.length}
          <span> / {minimum}</span>
        </strong>
      </span>
      <span
        className={`lobby-readiness__item${allReady ? ' is-complete' : ''}`}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m7 12 3 3 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>准备</span>
        <strong>
          {ready}
          <span> / {seats.length}</span>
        </strong>
      </span>
    </div>
  );
}
