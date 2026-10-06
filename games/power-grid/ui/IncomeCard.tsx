import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { INCOME } from '../data/economy';
import type { PowerGridView } from '../types';
import { incomePreview } from './income-preview';
import './income-card.css';

export function IncomeCard({
  view,
  seatId,
  selectedCities,
  mobile = false,
}: {
  view: PowerGridView;
  seatId?: string | undefined;
  selectedCities?: number | undefined;
  mobile?: boolean;
}) {
  const [mode, setMode] = useState<'closed' | 'preview' | 'pinned'>('closed');
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreFocus = useRef(false);
  const cardId = useId();
  const headingId = useId();

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current != null) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);
  const close = useCallback(() => {
    clearHideTimer();
    ignoreFocus.current = true;
    if (dialog.current?.open) dialog.current.close();
    setMode('closed');
    trigger.current?.focus({ preventScroll: true });
    queueMicrotask(() => {
      ignoreFocus.current = false;
    });
  }, [clearHideTimer, setMode]);
  const showPreview = useCallback(() => {
    clearHideTimer();
    if (!mobile)
      setMode((current) => (current === 'pinned' ? current : 'preview'));
  }, [clearHideTimer, mobile, setMode]);
  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (mode !== 'preview') return;
    hideTimer.current = setTimeout(() => {
      const active = document.activeElement;
      if (
        !trigger.current?.contains(active) &&
        !panel.current?.contains(active)
      )
        setMode('closed');
    }, 180);
  }, [clearHideTimer, mode, setMode]);

  useEffect(() => clearHideTimer, [clearHideTimer]);
  useEffect(() => {
    if (mode === 'closed') return;
    const outside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [close, mode]);
  useEffect(() => {
    if (mode !== 'pinned') return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    if (mobile) {
      document.body.style.overflow = 'hidden';
      element?.showModal();
    } else
      panel.current
        ?.querySelector<HTMLButtonElement>('button')
        ?.focus({ preventScroll: true });
    return () => {
      if (element?.open) element.close();
      if (mobile) document.body.style.overflow = previousOverflow;
    };
  }, [mobile, mode]);
  useLayoutEffect(() => {
    if (mobile || mode === 'closed') return;
    const position = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const surface = panel.current;
      if (!anchor || !surface) return;
      const bounds = surface.getBoundingClientRect();
      const left = Math.max(
        12,
        Math.min(anchor.left, window.innerWidth - bounds.width - 12),
      );
      const below = anchor.bottom + 8;
      const belowSpace = window.innerHeight - below - 12;
      const aboveSpace = anchor.top - 20;
      const placeBelow = belowSpace >= aboveSpace;
      surface.style.maxHeight = `${Math.max(80, placeBelow ? belowSpace : aboveSpace)}px`;
      const height = surface.getBoundingClientRect().height;
      const top = placeBelow ? below : Math.max(12, anchor.top - height - 8);
      surface.style.left = `${left}px`;
      surface.style.top = `${top}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [mobile, mode]);

  const card = (
    <section
      ref={panel}
      id={cardId}
      className={`pg-screen pg-income-card${mobile ? ' pg-income-card--mobile' : ' pg-income-card--desktop'}`}
      role={mobile ? undefined : 'dialog'}
      aria-labelledby={headingId}
      data-income-card=""
      data-income-mode={mode}
      onMouseEnter={clearHideTimer}
      onMouseLeave={scheduleHide}
      onFocus={clearHideTimer}
      onBlur={scheduleHide}
    >
      <header className="pg-income-card-heading">
        <h2 id={headingId}>发电收益</h2>
        <button type="button" aria-label="关闭发电收益" onClick={close}>
          ×
        </button>
      </header>
      <IncomeGuide
        view={view}
        seatId={seatId}
        selectedCities={selectedCities}
      />
    </section>
  );
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="pg-income-trigger"
        aria-haspopup="dialog"
        aria-expanded={mode !== 'closed'}
        aria-controls={mode !== 'closed' ? cardId : undefined}
        data-income-trigger=""
        onMouseEnter={showPreview}
        onMouseLeave={scheduleHide}
        onFocus={() => {
          if (!ignoreFocus.current) showPreview();
        }}
        onBlur={scheduleHide}
        onClick={() => {
          clearHideTimer();
          if (mode === 'pinned') close();
          else setMode('pinned');
        }}
      >
        <span aria-hidden="true">⚡</span> 收益
      </button>
      {mode !== 'closed' &&
        createPortal(
          mobile ? (
            <dialog
              ref={dialog}
              className="pg-income-dialog"
              aria-labelledby={headingId}
              onCancel={(event) => {
                event.preventDefault();
                event.stopPropagation();
                close();
              }}
            >
              {card}
            </dialog>
          ) : (
            card
          ),
          document.body,
        )}
    </>
  );
}

export function IncomeGuide({
  view,
  seatId,
  selectedCities,
}: {
  view: PowerGridView;
  seatId?: string | undefined;
  selectedCities?: number | undefined;
}) {
  const preview = incomePreview(view, seatId, selectedCities);
  return (
    <div className="pg-income-guide">
      <dl className="pg-income-table" aria-label="供电城市数对应收入，单位电币">
        {INCOME.map((amount, cities) => {
          const capability =
            preview != null && Math.min(20, preview.cities) === cities;
          return (
            <div
              key={cities}
              data-income-cities={cities}
              data-income-value={amount}
              className={`${capability ? 'pg-income-tier--capability' : ''}`}
            >
              <dt aria-label={`${cities === 20 ? '20以上' : cities}座地皮供电`}>
                {cities === 20 ? '20+' : cities}
                <svg
                  className="pg-income-land"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M2 11 12 2l10 9-2 2-2-2v11H6V11l-2 2Z" />
                </svg>
              </dt>
              <dd aria-label={`${amount}电币`}>
                {amount}
                <span aria-hidden="true">◉</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
