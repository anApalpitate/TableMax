import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import './overlay-panel.css';

function canFocus(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element.isConnected &&
    !element.matches(':disabled') &&
    !element.closest('[inert]') &&
    element.getClientRects().length > 0
  );
}

function restoreFocus(previous: Element | null) {
  const parent = Array.from(
    document.querySelectorAll<HTMLDialogElement>('dialog[open]'),
  ).at(-1);
  if (canFocus(previous) && (!parent || parent.contains(previous))) {
    previous.focus({ preventScroll: true });
    return;
  }
  if (!parent) return;
  const fallback = Array.from(
    parent.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).find(canFocus);
  (fallback ?? parent).focus({ preventScroll: true });
}

export function OverlayPanel({
  title,
  close,
  children,
  initialFocus,
}: {
  title: ReactNode;
  close(): void;
  children: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    element.showModal();
    initialFocus?.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      restoreFocus(previous);
    };
  }, [initialFocus]);
  return createPortal(
    <dialog
      ref={dialog}
      className="overlay-panel dialog-surface"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }
      }}
    >
      <div className="panel-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="secondary"
          aria-label="关闭面板"
          onClick={close}
        >
          关闭
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
