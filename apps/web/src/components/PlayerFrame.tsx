import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isDesktopPlayer,
  playerFramePath,
  readPlayerDisplay,
  savePlayerDisplay,
  type PlayerDisplay,
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
  const mode = desktop && large ? preferred : 'mobile';
  const frame = useRef<HTMLIFrameElement>(null);
  const disconnect = useRef<(() => void) | null>(null);
  const applyDisplay = useCallback(() => {
    const child = frame.current?.contentWindow;
    if (!child) return;
    try {
      if (playerFramePath(new URL(child.location.href), window.location.origin))
        child.document.documentElement.dataset.playerDisplay = mode;
    } catch {
      /* An unrelated document does not receive player presentation. */
    }
  }, [mode]);
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
    disconnect.current = () =>
      child.removeEventListener('popstate', synchronize);
    synchronize();
  }, [applyDisplay]);
  useEffect(() => () => disconnect.current?.(), []);
  return (
    <main className="player-frame" data-player-display={mode}>
      <div className="player-frame__scene" aria-hidden="true">
        <span className="player-frame__cards player-frame__cards--left" />
        <span className="player-frame__cards player-frame__cards--right" />
        <span className="player-frame__chip player-frame__chip--left" />
        <span className="player-frame__chip player-frame__chip--right" />
      </div>
      {desktop && large && (
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
