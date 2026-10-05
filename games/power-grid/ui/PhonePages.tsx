import { useEffect, useRef, useState, type ReactNode } from 'react';

const pages = ['行动', '市场', '地图', '公司'] as const;
export function PhonePages({
  stage,
  turn,
  blocked,
  children,
}: {
  stage: string;
  turn: boolean;
  blocked: boolean;
  children(dock: HTMLElement | null): readonly ReactNode[];
}) {
  const [page, setPage] = useState(0);
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const scrollers = useRef<(HTMLDivElement | null)[]>([]);
  const gesture = useRef<{
    x: number;
    y: number;
    dx: number;
    horizontal: boolean;
  } | null>(null);
  const previousStage = useRef(stage);
  useEffect(() => {
    if (previousStage.current === stage) return;
    previousStage.current = stage;
    // A stage changes the reading context, not the map viewport.
    setPage(0);
    for (const element of scrollers.current) element?.scrollTo({ top: 0 });
  }, [stage]);
  useEffect(() => {
    if (blocked) gesture.current = null;
  }, [blocked]);
  useEffect(() => {
    const cancel = () => {
      gesture.current = null;
    };
    window.addEventListener('resize', cancel);
    window.addEventListener('orientationchange', cancel);
    return () => {
      window.removeEventListener('resize', cancel);
      window.removeEventListener('orientationchange', cancel);
    };
  }, []);
  const contents = children(dock);
  return (
    <div
      className={`pg-phone-pages${editing ? ' pg-phone-pages--editing' : ''}`}
      onFocusCapture={(event) => {
        if (event.target.matches('input,select,textarea,[contenteditable]')) {
          setEditing(true);
          gesture.current = null;
        }
      }}
      onBlurCapture={(event) => {
        // Keep the dock still between pointer-down focus transfer and click.
        if (
          event.relatedTarget instanceof Element &&
          event.relatedTarget.closest('button')
        )
          return;
        if (
          !(event.relatedTarget instanceof Element) ||
          !event.relatedTarget.matches(
            'input,select,textarea,[contenteditable]',
          )
        )
          setEditing(false);
      }}
      onClickCapture={(event) => {
        if (
          (event.target as Element).closest('button') &&
          !document.activeElement?.matches(
            'input,select,textarea,[contenteditable]',
          )
        )
          setEditing(false);
      }}
      onTouchStart={(event) => {
        const target = event.target as Element;
        if (
          blocked ||
          Boolean(window.getSelection()?.toString()) ||
          event.touches.length !== 1 ||
          target.closest(
            'button,input,select,textarea,a,[contenteditable],.pg-map-panel,[data-swipe-lock]',
          ) ||
          document.activeElement?.matches(
            'input,select,textarea,[contenteditable]',
          )
        ) {
          gesture.current = null;
          return;
        }
        const touch = event.touches[0]!;
        gesture.current = {
          x: touch.clientX,
          y: touch.clientY,
          dx: 0,
          horizontal: false,
        };
      }}
      onTouchMove={(event) => {
        const start = gesture.current;
        if (!start || event.touches.length !== 1) {
          gesture.current = null;
          return;
        }
        const touch = event.touches[0]!,
          dx = touch.clientX - start.x,
          dy = touch.clientY - start.y;
        if (
          !start.horizontal &&
          Math.abs(dy) > 12 &&
          Math.abs(dy) > Math.abs(dx)
        ) {
          gesture.current = null;
          return;
        }
        if (Math.abs(dx) > 12 && Math.abs(dx) >= Math.abs(dy) * 1.5)
          start.horizontal = true;
        start.dx = dx;
      }}
      onTouchCancel={() => {
        gesture.current = null;
      }}
      onTouchEnd={() => {
        const start = gesture.current;
        gesture.current = null;
        if (
          start?.horizontal &&
          Math.abs(start.dx) >=
            Math.min(80, Math.max(48, window.innerWidth * 0.2))
        )
          setPage((value) =>
            Math.max(0, Math.min(3, value + (start.dx < 0 ? 1 : -1))),
          );
      }}
    >
      {contents.map((content, index) => (
        <section
          key={index}
          className="pg-phone-page"
          hidden={page !== index}
          inert={page !== index}
          aria-label={pages[index]}
          data-phone-page={index}
        >
          <div
            className="pg-page-scroll"
            ref={(element) => {
              scrollers.current[index] = element;
            }}
          >
            {content}
          </div>
          {index === 0 && <div className="pg-action-dock" ref={setDock} />}
        </section>
      ))}
      <nav className="pg-page-nav" aria-label="手机页面">
        {pages.map((label, index) => (
          <button
            type="button"
            key={label}
            aria-label={label}
            aria-current={page === index ? 'page' : undefined}
            onClick={() => setPage(index)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                return;
              event.preventDefault();
              const next = Math.max(
                0,
                Math.min(3, index + (event.key === 'ArrowLeft' ? -1 : 1)),
              );
              (
                event.currentTarget.parentElement?.children[next] as HTMLElement
              )?.focus();
            }}
          >
            {label}
            {index === 0 && turn && page !== 0 && (
              <span className="pg-turn-dot" aria-label="轮到你">
                ●
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
