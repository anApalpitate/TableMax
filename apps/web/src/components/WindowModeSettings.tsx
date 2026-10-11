import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type {
  WindowMode,
  WindowSnapshot,
} from '../../../desktop/src/display-types';
import { isDesktopPlayer } from './player-frame';

function fullscreenDocument() {
  try {
    return window.top?.document ?? document;
  } catch {
    return document;
  }
}
function subscribe(listener: () => void) {
  const target = fullscreenDocument();
  target.addEventListener('fullscreenchange', listener);
  return () => target.removeEventListener('fullscreenchange', listener);
}

export function WindowModeSettings() {
  const bridge = window.tablemaxWindow;
  const browserActive = useSyncExternalStore(subscribe, () =>
    Boolean(fullscreenDocument().fullscreenElement),
  );
  const [snapshot, setSnapshot] = useState<WindowSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const requested = useRef<WindowMode | null>(null);
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const unsubscribe = bridge.subscribe((value) => {
      if (active) setSnapshot(value);
    });
    void bridge.read().then(
      (value) => {
        if (active) setSnapshot(value);
      },
      () => {
        if (active) setError('无法读取显示模式，请重试');
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);
  if (
    !bridge &&
    (!isDesktopPlayer(navigator) || !fullscreenDocument().fullscreenEnabled)
  )
    return null;
  const mode = bridge
    ? (snapshot?.mode ?? (snapshot?.fullscreen ? 'fullscreen' : 'windowed'))
    : browserActive
      ? 'fullscreen'
      : 'windowed';
  const update = async (next: WindowMode) => {
    if (busy.current) return;
    busy.current = true;
    requested.current = next;
    setPending(true);
    setError('');
    try {
      if (bridge) setSnapshot(await bridge.setMode(next));
      else {
        const target = fullscreenDocument();
        if (next === 'fullscreen' && !target.fullscreenElement)
          await target.documentElement.requestFullscreen();
        else if (next === 'windowed' && target.fullscreenElement)
          await target.exitFullscreen();
      }
    } catch {
      setError('显示模式切换失败，请重试');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <div className="display-settings-choice window-mode-setting">
      <label htmlFor="window-mode">显示模式</label>
      <select
        id="window-mode"
        value={mode}
        disabled={pending || Boolean(bridge && !snapshot && !error)}
        aria-busy={pending}
        onChange={(event) => void update(event.target.value as WindowMode)}
      >
        <option value="fullscreen">全屏</option>
        {bridge && <option value="borderless">无边框窗口</option>}
        <option value="windowed">窗口</option>
      </select>
      {error && (
        <p className="display-settings-error" role="alert">
          {error}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (requested.current) void update(requested.current);
              else if (bridge) {
                setError('');
                void bridge
                  .read()
                  .then(setSnapshot, () =>
                    setError('无法读取显示模式，请重试'),
                  );
              }
            }}
          >
            重试
          </button>
        </p>
      )}
    </div>
  );
}
