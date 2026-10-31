import {
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  useContext,
  createContext,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
  type ContextType,
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

type Props = {
  title: ReactNode;
  close(): void;
  children: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  navigation?: boolean;
  back?: () => void;
  embedded?: boolean;
  boxAppearance?: boolean;
};
const MenuNavigation = createContext<{
  target: HTMLElement | null;
  closeAll(): void;
  enter(page: { close(): void; titleId: string } | null): void;
} | null>(null);
export function OverlayPanel(props: Props) {
  const parent = useContext(MenuNavigation);
  if (props.embedded && parent?.target)
    return <EmbeddedPanel {...props} parent={parent} />;
  return <ModalPanel {...props} />;
}
function EmbeddedPanel({
  parent,
  title,
  close,
  children,
  className,
  boxAppearance,
}: Props & { parent: NonNullable<ContextType<typeof MenuNavigation>> }) {
  const enter = parent.enter;
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  }, [close]);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    enter({ close: () => closeRef.current(), titleId });
    return () => enter(null);
  }, [enter, titleId]);
  return createPortal(
    <section
      className={`menu-subpage-content dialog-surface${boxAppearance ? ' box-overlay-panel' : ''}${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
    >
      <div className="panel-heading">
        <button type="button" onClick={close}>
          返回
        </button>
        <h2 id={titleId} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <button
          type="button"
          className="secondary"
          aria-label="关闭面板"
          onClick={parent.closeAll}
        >
          {boxAppearance ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          ) : (
            '关闭'
          )}
        </button>
      </div>
      {boxAppearance ? (
        <div className="box-overlay-panel__content">{children}</div>
      ) : (
        children
      )}
    </section>,
    parent.target!,
  );
}
function ModalPanel({
  title,
  close,
  children,
  initialFocus,
  className,
  navigation = false,
  back,
  boxAppearance = false,
}: Props) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [childPage, setChildPage] = useState<{
    close(): void;
    titleId: string;
  } | null>(null);
  const enter = useCallback(
    (page: { close(): void; titleId: string } | null) => setChildPage(page),
    [],
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const menuPosition = useRef<{
    scroll: number;
    label: string;
    text: string;
    element: HTMLElement;
  } | null>(null);
  const wasSubpage = useRef(false);
  const isSubpage = Boolean(childPage || back);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const scrollOwner =
      element.querySelector<HTMLElement>(
        ':scope > .box-overlay-panel__content',
      ) ?? element;
    if (isSubpage) {
      scrollOwner.scrollTop = 0;
      const heading = childPage
        ? document.getElementById(childPage.titleId)
        : element.querySelector<HTMLElement>(':scope > .panel-heading h2');
      heading?.focus({ preventScroll: true });
    } else if (wasSubpage.current && navigation && menuPosition.current) {
      const saved = menuPosition.current;
      const restored = canFocus(saved.element)
        ? saved.element
        : Array.from(
            element.querySelectorAll<HTMLElement>('button, a, select'),
          ).find((node) =>
            saved.label
              ? node.getAttribute('aria-label') === saved.label
              : node.textContent?.trim() === saved.text,
          );
      restored?.focus({ preventScroll: true });
      scrollOwner.scrollTop = saved.scroll;
    }
    wasSubpage.current = isSubpage;
  }, [childPage, isSubpage, navigation]);
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
      className={`overlay-panel dialog-surface${boxAppearance ? ' box-overlay-panel' : ''}${className ? ` ${className}` : ''}`}
      aria-labelledby={childPage?.titleId ?? titleId}
      onClickCapture={(event) => {
        if (!navigation || childPage) return;
        const entry = (event.target as HTMLElement).closest<HTMLElement>(
          'button, a, select',
        );
        const element = dialog.current;
        if (!entry || !element) return;
        const owner =
          element.querySelector<HTMLElement>(
            ':scope > .box-overlay-panel__content',
          ) ?? element;
        menuPosition.current = {
          scroll: owner.scrollTop,
          label: entry.getAttribute('aria-label') ?? '',
          text: entry.textContent?.trim() ?? '',
          element: entry,
        };
      }}
      onKeyDown={(event) => {
        if (
          event.key !== 'Escape' ||
          event.defaultPrevented ||
          (event.target as HTMLElement).closest('dialog') !==
            event.currentTarget
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (childPage) childPage.close();
        else if (back) back();
        else close();
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (childPage) childPage.close();
        else if (back) back();
        else close();
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
      <div className="panel-heading" hidden={Boolean(childPage)}>
        {back && (
          <button type="button" onClick={back}>
            返回
          </button>
        )}
        <h2 id={titleId} tabIndex={-1}>
          {title}
        </h2>
        <button
          type="button"
          className="secondary"
          aria-label="关闭面板"
          onClick={close}
        >
          {boxAppearance ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          ) : (
            '关闭'
          )}
        </button>
      </div>
      {navigation ? (
        <MenuNavigation.Provider value={{ target, enter, closeAll: close }}>
          <div
            hidden={Boolean(childPage)}
            className={boxAppearance ? 'box-overlay-panel__content' : undefined}
          >
            {children}
          </div>
        </MenuNavigation.Provider>
      ) : boxAppearance ? (
        <div className="box-overlay-panel__content">{children}</div>
      ) : (
        children
      )}
      {navigation && <div ref={setTarget} className="menu-subpage" />}
    </dialog>,
    document.body,
  );
}
