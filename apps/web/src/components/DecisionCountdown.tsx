import { useEffect, useState, type CSSProperties } from 'react';
import type { DecisionClock, RoomView } from '@tablemax/protocol';
import './countdown.css';

function ClockDisplay({
  clock,
  duration,
  compact,
}: {
  clock: DecisionClock;
  duration: number;
  compact: boolean;
}) {
  const [receivedAt] = useState(() => performance.now());
  const [now, setNow] = useState(receivedAt);
  useEffect(() => {
    if (!clock.running || clock.remainingMs === 0) return;
    const timer = window.setInterval(() => {
      const sampled = performance.now();
      setNow(sampled);
      if (sampled - receivedAt >= clock.remainingMs)
        window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [clock.running, clock.remainingMs, receivedAt]);
  // The server supplies elapsed time. Monotonic local interpolation cannot be
  // thrown off by a phone changing its wall clock, and never starts a decision.
  const remaining = Math.max(
    0,
    clock.remainingMs - (clock.running ? now - receivedAt : 0),
  );
  const seconds = Math.ceil(remaining / 1000);
  const expired = seconds === 0;
  const label = !clock.running ? '已暂停' : expired ? '时间到' : '思考时间';
  return (
    <div
      className={`decision-countdown${compact ? ' decision-countdown--compact' : ''}${expired ? ' decision-countdown--elapsed' : ''}${!clock.running ? ' decision-countdown--paused' : ''}`}
      role="timer"
      aria-live="off"
      aria-label={`${label}，剩余 ${seconds} 秒`}
      data-clock-id={clock.id}
      data-remaining-seconds={seconds}
      data-clock-running={clock.running}
      style={
        {
          '--countdown-progress': `${Math.min(1, remaining / (duration * 1000)) * 100}%`,
        } as CSSProperties
      }
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="13"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M9 2h6M12 5V2m0 11V8m0 5 3 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {!compact && <span>{label}</span>}
      <strong>
        {seconds}
        <span>秒</span>
      </strong>
    </div>
  );
}

export function DecisionCountdown({
  view,
  connected = true,
  compact = false,
}: {
  view: RoomView | null;
  connected?: boolean;
  compact?: boolean;
}) {
  if (!connected || !view?.decisionClock) return null;
  return (
    <ClockDisplay
      key={`${view.decisionClock.id}:${view.decisionClock.serverTime}`}
      clock={view.decisionClock}
      duration={view.countdownSeconds}
      compact={compact}
    />
  );
}
