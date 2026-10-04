import type { CSSProperties } from 'react';
import './decision-progress.css';

export function DecisionProgress({
  id,
  remainingMs,
  durationSeconds,
  running,
}: {
  id: string;
  remainingMs: number;
  durationSeconds: number;
  running: boolean;
}) {
  return (
    <div
      className={`ma-decision-progress${!running ? ' ma-decision-progress--paused' : ''}`}
      role="timer"
      aria-live="off"
      aria-label={
        !running
          ? '思考时间已暂停'
          : remainingMs > 0
            ? '思考时间进行中'
            : '思考时间已到，仍可操作'
      }
      data-clock-id={id}
      data-remaining-seconds={Math.ceil(remainingMs / 1000)}
      data-clock-running={running}
      data-elapsed={remainingMs === 0}
      style={
        {
          '--ma-time-progress': `${Math.max(0, Math.min(1, remainingMs / (durationSeconds * 1000))) * 100}%`,
        } as CSSProperties
      }
    >
      <span />
    </div>
  );
}
