import type { GameRelease } from './types';

/** The signed Pages catalog lists current releases before historical references. */
export function preferredCatalogReleases<
  T extends Pick<GameRelease, 'gameId' | 'variantId'>,
>(releases: readonly T[]): T[] {
  const seen = new Set<string>();
  return releases.filter((release) => {
    const key = `${release.gameId}:${release.variantId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
