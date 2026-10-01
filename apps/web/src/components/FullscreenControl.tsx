import { useState, useSyncExternalStore } from 'react';
function subscribe(listener: () => void) {
  document.addEventListener('fullscreenchange', listener);
  return () => document.removeEventListener('fullscreenchange', listener);
}
export function FullscreenControl() {
  const active = useSyncExternalStore(subscribe, () =>
    Boolean(document.fullscreenElement),
  );
  const [failed, setFailed] = useState(false);
  if (!document.fullscreenEnabled) return null;
  return (
    <button
      className="secondary"
      title={failed ? '可以使用浏览器或桌面的全屏功能' : '铺满屏幕'}
      aria-pressed={active}
      onClick={() => {
        const result = active
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen();
        void result.catch(() => setFailed(true));
      }}
    >
      {active ? '退出全屏' : failed ? '全屏不可用' : '全屏'}
    </button>
  );
}
