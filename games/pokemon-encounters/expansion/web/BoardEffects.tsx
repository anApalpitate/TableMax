import { useEffect, useId, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { BoardEffects as Effects } from './presentation';

type Rect = { x: number; y: number; width: number; height: number };

/** Paint trajectories above the saved board without moving cards or exposing faces. */
export function BoardEffects({
  effects,
  delay,
  anchors = {},
  winners = [],
}: {
  effects: Effects;
  delay: number;
  anchors?: Readonly<Record<string, Rect>>;
  winners?: readonly string[];
}) {
  const prefix = useId().replaceAll(':', '');
  const [rects, setRects] = useState<Record<string, Rect>>({});
  useEffect(() => {
    const measure = () => {
      const next: Record<string, Rect> = Object.fromEntries(
        Object.entries(anchors).map(([id, r]) => [
          id,
          { ...r, x: r.x - scrollX, y: r.y - scrollY },
        ]),
      );
      document
        .querySelectorAll<HTMLElement>(
          '.expansion-screen [data-slot], .expansion-screen [data-pile]',
        )
        .forEach((slot) => {
          const rect = slot.getBoundingClientRect();
          if (rect.width > 2 && rect.height > 2)
            next[slot.dataset.slot ?? `@${slot.dataset.pile}`] = {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
        });
      setRects(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    const screen = document.querySelector('.expansion-screen');
    if (screen) observer.observe(screen);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      observer.disconnect();
    };
  }, [anchors]);
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
      style={
        {
          '--ex-delay': `${delay}ms`,
          '--ex-duration': `${winners.length ? 1400 : 540}ms`,
        } as CSSProperties
      }
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
            <path className="ex-board-trail" d={d} pathLength="1" />
            <circle cx={a.x} cy={a.y} r="14" />
            <circle cx={b.x} cy={b.y} r="14" />
          </g>
        );
      })}
      {winners.map((seat) => {
        const slots = Object.entries(rects)
          .filter(([id]) => id.startsWith(seat + ':'))
          .map(([, r]) => r);
        if (!slots.length) return null;
        const x = Math.min(...slots.map((r) => r.x)),
          y = Math.min(...slots.map((r) => r.y));
        const width = Math.max(...slots.map((r) => r.x + r.width)) - x,
          height = Math.max(...slots.map((r) => r.y + r.height)) - y;
        const clip = `${prefix}-winner-${seat}`;
        return (
          <g key={seat} data-winner={seat}>
            <defs>
              <clipPath id={clip}>
                <rect x={x} y={y} width={width} height={height} rx="14" />
              </clipPath>
            </defs>
            <rect
              className="ex-winner-halo"
              x={x}
              y={y}
              width={width}
              height={height}
              rx="14"
            />
            <g clipPath={`url(#${clip})`}>
              <rect
                className="ex-winner-sweep"
                x={x - width / 3}
                y={y}
                width={width / 3}
                height={height}
                style={{ '--sweep-width': width * 1.4 + 'px' } as CSSProperties}
              />
            </g>
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
