import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
function subscribe(listener: () => void) {
  document.addEventListener('fullscreenchange', listener);
  return () => document.removeEventListener('fullscreenchange', listener);
}
export function FullscreenControl() {
  const browserActive = useSyncExternalStore(subscribe, () =>
    Boolean(document.fullscreenElement),
  );
  const bridge = window.tablemaxWindow;
  const [nativeActive, setNativeActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    if (!bridge) return;
    let mounted = true;
    const unsubscribe = bridge.subscribe((snapshot) => {
      if (mounted) setNativeActive(snapshot.fullscreen);
    });
    void bridge.read().then(
      (snapshot) => {
        if (mounted) setNativeActive(snapshot.fullscreen);
      },
      () => {
        if (mounted) setFailed(true);
      },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [bridge]);
  const active = bridge ? nativeActive : browserActive;
  if (!bridge && !document.fullscreenEnabled) return null;
  return (
    <button
      type="button"
      className="secondary"
      title={
        failed ? '全屏切换失败，点击重试' : active ? '恢复窗口' : '铺满屏幕'
      }
      aria-pressed={active}
      aria-busy={pending}
      disabled={pending}
      onClick={() => {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        setFailed(false);
        void (async () => {
          if (bridge) {
            // Read the authoritative state again: F11 or the native menu may
            // have changed it since the last React render.
            const current = await bridge.read();
            const snapshot = await bridge.setFullscreen(!current.fullscreen);
            setNativeActive(snapshot.fullscreen);
          } else if (document.fullscreenElement) {
            await document.exitFullscreen();
          } else {
            await document.documentElement.requestFullscreen();
          }
        })()
          .catch(() => setFailed(true))
          .finally(() => {
            busy.current = false;
            setPending(false);
          });
      }}
    >
      {pending ? '切换中…' : failed ? '重试全屏' : active ? '退出全屏' : '全屏'}
    </button>
  );
}
