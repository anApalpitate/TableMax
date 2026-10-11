const pendingStyles = new Map<string, Promise<void>>();

/** All variants sharing a stylesheet await the same success or failure. */
export function loadGameStyle(url: URL): Promise<void> {
  const key = url.href;
  const pending = pendingStyles.get(key);
  if (pending) return pending;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = key;
  link.dataset.gameStyle = url.pathname;
  link.media = 'not all';
  const request = new Promise<void>((resolve, reject) => {
    link.onload = () => resolve();
    link.onerror = () => {
      link.remove();
      reject(new Error('style-load-failed'));
    };
    document.head.append(link);
  }).catch((error: unknown) => {
    pendingStyles.delete(key);
    throw error;
  });
  pendingStyles.set(key, request);
  return request;
}

/** Only the active instance's immutable stylesheet set participates in rendering. */
export function activateGameStyles(prefix: string) {
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[data-game-style]',
  ))
    link.media = link.dataset.gameStyle?.startsWith(prefix) ? 'all' : 'not all';
}
