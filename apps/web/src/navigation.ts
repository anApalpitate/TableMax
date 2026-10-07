import { useSyncExternalStore } from 'react';

export type ScreenRole = 'host' | 'public' | 'player';

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
  const role: ScreenRole =
    path === '/' || path.startsWith('/player')
      ? 'player'
      : path.startsWith('/public')
        ? 'public'
        : 'host';
  return { role, inGame: path.endsWith('/game') };
}
