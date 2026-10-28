import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isDesktopPlayer,
  isPhonePlayer,
  phoneIsLandscape,
  playerFramePath,
  readPlayerDisplay,
  readWorkspaceDisplay,
  savePlayerDisplay,
  saveWorkspaceDisplay,
  type PlayerDisplay,
  workspaceLayout,
  workspaceSpace,
  type WorkspacePreference,
} from './player-frame';
import './player-frame.css';
import { PhoneOrientationGuard } from './PhoneOrientationGuard';

export function PlayerFrame({ initialUrl }: { initialUrl: string }) {
  // Parent history changes and window resizing must never replace the document.
  const [source] = useState(initialUrl);
  const [desktop] = useState(() => isDesktopPlayer(navigator));
  const [phone] = useState(() => isPhonePlayer(navigator));
  const guardedFocus = useRef<HTMLElement | null>(null);
  const [landscape, setLandscape] = useState(() =>
    phoneIsLandscape(screen.orientation?.type, screen.width, screen.height),
  );
  const blocked = phone && landscape;
  const [large, setLarge] = useState(
    () => window.matchMedia('(min-width: 800px)').matches,
  );
  const [preferred, setPreferred] = useState<PlayerDisplay>(() => {
    try {
      return readPlayerDisplay(window.localStorage);
    } catch {
      return 'portrait';
    }
  });
  const [contract, setContract] = useState(false);
  const [space, setSpace] = useState(() =>
    workspaceSpace(window.innerWidth, window.innerHeight),
  );
  const [workspacePreference, setWorkspacePreference] =
    useState<WorkspacePreference>(() => {
      try {
        return readWorkspaceDisplay(window.localStorage);
      } catch {
        return 'portrait';
      }
    });
  const mode = phone
    ? contract
      ? 'portrait'
      : 'mobile'
    : contract
      ? workspaceLayout(space.width, space.height, workspacePreference)
      : desktop && large
        ? preferred
        : 'mobile';
  const canSwitchWorkspace =
    workspaceLayout(space.width, space.height, 'wide') === 'wide';
  const displayPreference = contract ? workspacePreference : preferred;
  const frame = useRef<HTMLIFrameElement>(null);
  const disconnect = useRef<(() => void) | null>(null);
  const applyDisplay = useCallback(() => {
    const child = frame.current?.contentWindow;
    if (!child) return;
    try {
      if (
        !playerFramePath(new URL(child.location.href), window.location.origin)
      )
        return;
      child.document.documentElement.dataset.playerDisplay = mode;
      if (contract) child.document.documentElement.dataset.playerLayout = mode;
      else delete child.document.documentElement.dataset.playerLayout;
    } catch {
      /* An unrelated document does not receive player presentation. */
    }
  }, [mode, contract]);
  useEffect(() => {
    let previousWidth = window.innerWidth;
    const changed = () => {
      const active = frame.current?.contentDocument?.activeElement;
      const widthChanged = previousWidth !== window.innerWidth;
      previousWidth = window.innerWidth;
      if (
        !widthChanged &&
        active?.matches('input,textarea,[contenteditable="true"]')
      )
        return;
      setSpace(workspaceSpace(window.innerWidth, window.innerHeight));
    };
    window.addEventListener('resize', changed);
    return () => window.removeEventListener('resize', changed);
  }, []);
  useEffect(applyDisplay, [applyDisplay]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 800px)');
    const changed = () => setLarge(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  const loaded = useCallback(() => {
    applyDisplay();
    disconnect.current?.();
    const child = frame.current?.contentWindow;
    if (!child) return;
    try {
      if (child.location.origin !== window.location.origin) return;
    } catch {
      return;
    }
    const synchronize = () => {
      try {
        const path = playerFramePath(
          new URL(child.location.href),
          window.location.origin,
        );
        if (
          path &&
          path !== location.pathname + location.search + location.hash
        )
          history.replaceState(null, '', path);
      } catch {
        // An unrelated destination cannot change the parent browser address.
      }
    };
    child.addEventListener('popstate', synchronize);
    const detect = () =>
      setContract(
        Boolean(
          child.document.querySelector(
            '[data-player-layout-contract="three-v1"]',
          ),
        ),
      );
    const observer = new MutationObserver(detect);
    observer.observe(child.document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-player-layout-contract'],
    });
    let focusFrame = 0;
    const focusChanged = () => {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        if (
          !child.document.activeElement?.matches(
            'input,textarea,[contenteditable="true"]',
          )
        )
          setSpace(workspaceSpace(window.innerWidth, window.innerHeight));
      });
    };
    child.addEventListener('focusout', focusChanged);
    detect();
    disconnect.current = () => {
      child.removeEventListener('popstate', synchronize);
      child.removeEventListener('focusout', focusChanged);
      cancelAnimationFrame(focusFrame);
      observer.disconnect();
    };
    synchronize();
  }, [applyDisplay]);
  useEffect(() => {
    const changed = () => {
      const next = phoneIsLandscape(
        screen.orientation?.type,
        screen.width,
        screen.height,
      );
      if (phone && next && !guardedFocus.current) {
        guardedFocus.current = frame.current?.contentDocument
          ?.activeElement as HTMLElement | null;
      }
      setLandscape(next);
    };
    screen.orientation?.addEventListener('change', changed);
    window.addEventListener('orientationchange', changed);
    window.addEventListener('resize', changed);
    return () => {
      screen.orientation?.removeEventListener('change', changed);
      window.removeEventListener('orientationchange', changed);
      window.removeEventListener('resize', changed);
    };
  }, [phone]);
  useEffect(() => {
    if (blocked) return;
    const previous = guardedFocus.current;
    guardedFocus.current = null;
    if (
      previous?.isConnected &&
      !previous.matches(':disabled') &&
      !previous.closest('[inert]') &&
      previous.getClientRects().length
    ) {
      previous.focus({ preventScroll: true });
    }
  }, [blocked]);
  useEffect(() => () => disconnect.current?.(), []);
  return (
    <main
      className="player-frame"
      data-player-display={mode}
      data-workspace-layout={contract ? mode : undefined}
    >
      <div className="player-frame__scene" aria-hidden="true">
        <span className="player-frame__cards player-frame__cards--left" />
        <span className="player-frame__cards player-frame__cards--right" />
        <span className="player-frame__chip player-frame__chip--left" />
        <span className="player-frame__chip player-frame__chip--right" />
      </div>
      {!phone && (contract ? canSwitchWorkspace : desktop && large) && (
        <button
          type="button"
          className="player-frame__display"
          aria-label={
            displayPreference === 'wide' ? '返回竖屏显示' : '切换横屏显示'
          }
          title={displayPreference === 'wide' ? '返回竖屏显示' : '切换横屏显示'}
          aria-pressed={displayPreference === 'wide'}
          onClick={() => {
            const next = displayPreference === 'wide' ? 'portrait' : 'wide';
            if (contract) setWorkspacePreference(next);
            else setPreferred(next);
            try {
              if (contract) saveWorkspaceDisplay(window.localStorage, next);
              else savePlayerDisplay(window.localStorage, next);
            } catch {
              /* Memory preference remains usable. */
            }
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
          >
            {displayPreference === 'wide' ? (
              <rect
                x="7"
                y="3"
                width="14"
                height="22"
                rx="3"
                stroke="currentColor"
                strokeWidth="2"
              />
            ) : (
              <rect
                x="3"
                y="6"
                width="22"
                height="16"
                rx="3"
                stroke="currentColor"
                strokeWidth="2"
              />
            )}
            <path
              d={displayPreference === 'wide' ? 'M12 21h4' : 'M22 12v4'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
      <iframe
        ref={frame}
        data-player-frame
        className="player-frame__viewport"
        title="玩家操作"
        src={source}
        allow="fullscreen 'none'"
        onLoad={loaded}
        inert={blocked}
      />
      {blocked && <PhoneOrientationGuard />}
    </main>
  );
}
