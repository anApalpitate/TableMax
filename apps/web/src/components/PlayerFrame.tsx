import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { fixedVisualViewportClip } from '@tablemax/web-host/platform';
import {
  isDesktopPlayer,
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

export function PlayerFrame({ initialUrl }: { initialUrl: string }) {
  // Parent history changes and window resizing must never replace the document.
  const [source] = useState(initialUrl);
  const [desktop] = useState(() => isDesktopPlayer(navigator));
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
  const [fixedCanvas, setFixedCanvas] = useState(false);
  const boundary = useRef<HTMLElement>(null);
  const [fixedClip, setFixedClip] = useState<ReturnType<
    typeof fixedVisualViewportClip
  > | null>(null);
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
  const mode = fixedCanvas
    ? 'mobile'
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
  useLayoutEffect(() => {
    const container = boundary.current;
    if (!fixedCanvas || !container) {
      setFixedClip(null);
      return;
    }
    // Only the top-level visual viewport knows which part of this iframe is
    // actually visible. Resizing its box preserves the same child document.
    const visualViewport = window.visualViewport;
    let animation = 0;
    const measure = () => {
      animation = 0;
      const next = fixedVisualViewportClip(
        container.getBoundingClientRect(),
        visualViewport,
      );
      setFixedClip((previous) =>
        previous &&
        Object.keys(next).every(
          (key) =>
            previous[key as keyof typeof next] ===
            next[key as keyof typeof next],
        )
          ? previous
          : next,
      );
    };
    const schedule = () => {
      if (!animation) animation = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    visualViewport?.addEventListener('resize', schedule);
    visualViewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animation);
      visualViewport?.removeEventListener('resize', schedule);
      visualViewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [fixedCanvas]);
  const applyDisplay = useCallback(() => {
    const child = frame.current?.contentWindow;
    if (!child) return;
    try {
      if (
        !playerFramePath(new URL(child.location.href), window.location.origin)
      )
        return;
      if (fixedCanvas) {
        // The inner fixed canvas owns presentation. Its document still fills
        // the real viewport so modal/popover and browser zoom remain usable.
        delete child.document.documentElement.dataset.playerDisplay;
        delete child.document.documentElement.dataset.playerLayout;
      } else {
        child.document.documentElement.dataset.playerDisplay = mode;
        if (contract)
          child.document.documentElement.dataset.playerLayout = mode;
        else delete child.document.documentElement.dataset.playerLayout;
      }
    } catch {
      /* An unrelated document does not receive player presentation. */
    }
  }, [mode, contract, fixedCanvas]);
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
    if (!child) {
      setFixedCanvas(false);
      return;
    }
    try {
      if (child.location.origin !== window.location.origin) {
        setFixedCanvas(false);
        return;
      }
    } catch {
      setFixedCanvas(false);
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
    const detect = () => {
      setContract(
        Boolean(
          child.document.querySelector(
            '[data-player-layout-contract="three-v1"]',
          ),
        ),
      );
      setFixedCanvas(
        Boolean(
          child.document.querySelector(
            '[data-player-layout-contract="fixed-v1"]',
          ),
        ),
      );
    };
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
  useEffect(() => () => disconnect.current?.(), []);
  const fixedStyle: CSSProperties | undefined =
    fixedCanvas && fixedClip
      ? {
          position: 'absolute',
          left: fixedClip.x,
          top: fixedClip.y,
          width: fixedClip.width,
          height: fixedClip.height,
        }
      : undefined;
  return (
    <main
      ref={boundary}
      className="player-frame"
      data-player-display={mode}
      data-workspace-layout={contract ? mode : undefined}
      data-fixed-canvas-frame={fixedCanvas || undefined}
    >
      <div className="player-frame__scene" aria-hidden="true">
        <span className="player-frame__cards player-frame__cards--left" />
        <span className="player-frame__cards player-frame__cards--right" />
        <span className="player-frame__chip player-frame__chip--left" />
        <span className="player-frame__chip player-frame__chip--right" />
      </div>
      {!fixedCanvas && (contract ? canSwitchWorkspace : desktop && large) && (
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
        style={fixedStyle}
        title="玩家操作"
        src={source}
        allow="fullscreen 'none'"
        onLoad={loaded}
      />
    </main>
  );
}
