import { useSyncExternalStore } from 'react';

export type ScreenRole = 'host' | 'player';

export function screenRoute(path: string) {
  const normalized = path === '/' ? path : path.replace(/\/$/, '');
  switch (normalized) {
    case '/':
    case '/player':
      return { role: 'player' as const, inGame: false };
    case '/player/game':
      return { role: 'player' as const, inGame: true };
    case '/host':
      return { role: 'host' as const, inGame: false };
    case '/host/game':
      return { role: 'host' as const, inGame: true };
    default:
      return null;
  }
}

export function navigate(path: string, replace = false) {
  if (location.pathname === path) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}

export function useScreenRoute() {
  const path = useSyncExternalStore(subscribe, () => location.pathname);
  return screenRoute(path);
}
