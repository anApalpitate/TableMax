import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isDesktopPlayer,
  playerFramePath,
  readPlayerDisplay,
  savePlayerDisplay,
  type PlayerDisplay,
  workspaceLayout,
  workspaceDisplayKey,
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
  const [space, setSpace] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight - 52,
  }));
  const [workspacePreference, setWorkspacePreference] =
    useState<WorkspacePreference>(() => {
      try {
        const value = localStorage.getItem(workspaceDisplayKey);
        return value === 'portrait' || value === 'wide' ? value : 'auto';
      } catch {
        return 'auto';
      }
    });
  const mode = contract
    ? workspaceLayout(space.width, space.height, workspacePreference)
    : desktop && large
      ? preferred
      : 'mobile';
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
      setSpace({ width: window.innerWidth, height: window.innerHeight - 52 });
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
          setSpace({
            width: window.innerWidth,
            height: window.innerHeight - 52,
          });
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
  return (
    <main
      className="player-frame"
      data-player-display={mode}
      data-workspace-layout={contract ? mode : undefined}
    >
      {contract && (
        <label className="player-frame__workspace-select">
          布局
          <select
            aria-label="玩家布局"
            value={workspacePreference}
            onChange={(event) => {
              const value = event.target.value as WorkspacePreference;
              setWorkspacePreference(value);
              try {
                localStorage.setItem(workspaceDisplayKey, value);
              } catch {
                /* Memory choice remains available. */
              }
            }}
          >
            <option value="auto">自动</option>
            <option value="portrait">竖屏</option>
            <option value="wide">横屏</option>
          </select>
          {workspacePreference === 'wide' && mode !== 'wide' && (
            <span role="status">空间不足，暂用竖屏</span>
          )}
        </label>
      )}
      <div className="player-frame__scene" aria-hidden="true">
        <span className="player-frame__cards player-frame__cards--left" />
        <span className="player-frame__cards player-frame__cards--right" />
        <span className="player-frame__chip player-frame__chip--left" />
        <span className="player-frame__chip player-frame__chip--right" />
      </div>
      {!contract && desktop && large && (
        <button
          type="button"
          className="player-frame__display"
          aria-label={preferred === 'wide' ? '返回竖屏显示' : '切换横屏显示'}
          title={preferred === 'wide' ? '返回竖屏显示' : '切换横屏显示'}
          aria-pressed={preferred === 'wide'}
          onClick={() => {
            const next = preferred === 'wide' ? 'portrait' : 'wide';
            setPreferred(next);
            try {
              savePlayerDisplay(window.localStorage, next);
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
            {preferred === 'wide' ? (
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
              d={preferred === 'wide' ? 'M12 21h4' : 'M22 12v4'}
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
      />
    </main>
  );
}
