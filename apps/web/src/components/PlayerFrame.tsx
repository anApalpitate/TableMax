import { useCallback, useEffect, useRef, useState } from 'react';
import { playerFramePath } from './player-frame';
import './player-frame.css';

export function PlayerFrame({ initialUrl }: { initialUrl: string }) {
  // Parent history changes and window resizing must never replace the document.
  const [source] = useState(initialUrl);
  const frame = useRef<HTMLIFrameElement>(null);
  const disconnect = useRef<(() => void) | null>(null);
  const loaded = useCallback(() => {
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
  }, []);
  useEffect(() => () => disconnect.current?.(), []);
  return (
    <main className="player-frame">
      <div className="player-frame__scene" aria-hidden="true">
        <span className="player-frame__cards player-frame__cards--left" />
        <span className="player-frame__cards player-frame__cards--right" />
        <span className="player-frame__chip player-frame__chip--left" />
        <span className="player-frame__chip player-frame__chip--right" />
      </div>
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
