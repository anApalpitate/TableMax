import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { BoardEffects as Effects } from './presentation';

type Rect = { x: number; y: number; width: number; height: number };

/** Paint trajectories above the saved board without moving cards or exposing faces. */
export function BoardEffects({
  effects,
  delay,
}: {
  effects: Effects;
  delay: number;
}) {
  const [rects, setRects] = useState<Record<string, Rect>>({});
  useEffect(() => {
    const measure = () => {
      const next: Record<string, Rect> = {};
      document
        .querySelectorAll<HTMLElement>('.ex-players [data-slot]')
        .forEach((slot) => {
          const rect = slot.getBoundingClientRect();
          if (rect.width && rect.height)
            next[slot.dataset.slot!] = {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
        });
      setRects(next);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, []);
  const center = (id: string) => {
    const rect = rects[id];
    return rect
      ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      : null;
  };
  return createPortal(
    <svg
      className="ex-board-effects"
      aria-hidden="true"
      style={{ '--ex-delay': `${delay}ms` } as CSSProperties}
    >
      {effects.moves.map(({ from, to }) => {
        const a = center(from),
          b = center(to);
        if (!a || !b) return null;
        const bend = Math.min(90, Math.hypot(b.x - a.x, b.y - a.y) / 3);
        const d = `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 + bend} ${(a.y + b.y) / 2 - bend} ${b.x} ${b.y}`;
        return (
          <g
            key={`${from}-${to}`}
            className="ex-board-transfer"
            data-from={from}
            data-to={to}
          >
            <path className="ex-board-trail" d={d} pathLength="100" />
            <path
              className="ex-board-trail ex-board-trail-return"
              d={d}
              pathLength="100"
            />
            <circle cx={a.x} cy={a.y} r="14" />
            <circle cx={b.x} cy={b.y} r="14" />
          </g>
        );
      })}
      {(['cover', 'reveal', 'pulse'] as const).flatMap((kind) =>
        effects[kind].flatMap((id) => {
          const rect = rects[id];
          return rect
            ? [
                <rect
                  key={`${kind}-${id}`}
                  className={`ex-board-${kind}`}
                  data-target={id}
                  x={rect.x + 2}
                  y={rect.y + 2}
                  width={Math.max(0, rect.width - 4)}
                  height={Math.max(0, rect.height - 4)}
                  rx="12"
                />,
              ]
            : [];
        }),
      )}
    </svg>,
    document.body,
  );
}
