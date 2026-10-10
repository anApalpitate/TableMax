import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { NotificationCenter } from './notification-center';
import { NotificationContext } from './context';
import './notifications.css';

export function Notifications({ children }: { children: ReactNode }) {
  const [center] = useState(() => new NotificationCenter());
  return (
    <NotificationContext value={center}>
      {children}
      <NotificationViewport center={center} />
    </NotificationContext>
  );
}

function NotificationViewport({ center }: { center: NotificationCenter }) {
  const items = useSyncExternalStore(center.subscribe, center.snapshot);
  const [target, setTarget] = useState<Element>(document.body);
  const targetRef = useRef<Element>(document.body);
  useEffect(() => {
    // A modal dialog is in the browser's top layer. Keep notifications inside
    // the active dialog so they remain visible and their close buttons work.
    const updateTarget = () => {
      const next =
        Array.from(document.querySelectorAll('dialog[open]')).at(-1) ??
        document.body;
      if (next === targetRef.current) return;
      // Portal reparenting removes the old focused/hovered element without
      // necessarily firing blur or pointerleave. Release those old holds.
      for (const item of center.snapshot()) {
        center.hold(item.id, 'focus', false);
        center.hold(item.id, 'pointer', false);
      }
      targetRef.current = next;
      setTarget(next);
    };
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    updateTarget();
    const visibility = () =>
      center.setHidden(document.visibilityState === 'hidden');
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      center.clear();
    };
  }, [center]);
  return createPortal(
    <div className="tablemax-notifications" aria-label="操作提示">
      {items.map((item) => (
        <div
          className="tablemax-notice"
          data-tone={item.tone}
          data-leaving={item.leaving}
          key={item.id}
          role={item.tone === 'error' ? 'alert' : 'status'}
          aria-atomic="true"
          onPointerEnter={() => center.hold(item.id, 'pointer', true)}
          onPointerLeave={() => center.hold(item.id, 'pointer', false)}
          onFocus={() => center.hold(item.id, 'focus', true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              center.hold(item.id, 'focus', false);
          }}
        >
          <span className="tablemax-notice__icon" aria-hidden="true">
            {item.tone === 'success' ? '✓' : item.tone === 'error' ? '!' : 'i'}
          </span>
          <p>{item.message}</p>
          <button
            className="tablemax-notice__dismiss"
            type="button"
            aria-label="关闭提示"
            onClick={() => center.dismiss(item.id)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>,
    target,
  );
}
