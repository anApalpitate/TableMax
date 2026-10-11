/** Bind URLs to the importing release, not the currently selected game. */
export function resourceUrl(id: string, moduleUrl?: string): string {
  if (
    !/^[a-z0-9][a-z0-9-]*\/[a-zA-Z0-9_./-]+$/.test(id) ||
    id.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Invalid game resource ID');
  if (moduleUrl) {
    const url = new URL(moduleUrl, 'http://localhost');
    const match = /^\/game-packages\/([a-f0-9]{64})\/web\//.exec(url.pathname);
    if (match)
      return `/game-packages/${match[1]}/resources/${id.split('/').map(encodeURIComponent).join('/')}`;
    const legacy = /^\/games\/([a-z][a-z0-9-]*)\/web\//.exec(url.pathname);
    if (legacy) {
      if (!id.startsWith(`${legacy[1]}/`))
        throw new Error('Resource belongs to another game');
      return `/games/${legacy[1]}/resources/${id.split('/').map(encodeURIComponent).join('/')}`;
    }
    if (/^\/game-packages\//.test(url.pathname))
      throw new Error('Invalid game release URL');
  }
  return `/assets/games/${id}`;
}
