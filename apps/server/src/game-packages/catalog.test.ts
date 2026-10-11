import { describe, it, expect } from 'vitest';
import { preferredCatalogReleases, releaseCompatible } from './catalog';
import type { GameRelease } from './types';
describe('latest compatible release selection', () => {
  const release = (
    id: string,
    protocol: number,
    requiredCapabilities: string[] = [],
  ) =>
    ({
      releaseId: id,
      gameId: 'test',
      module: {
        compatibility: { sdk: 1, protocol, webHost: 1, requiredCapabilities },
      },
    }) as GameRelease;
  it('falls back in signed order, retains an incompatible recommendation only when none works, and checks variant requirements', () => {
    const latest = release('latest', 8, ['unavailable']),
      prior = release('prior', 7),
      oldest = release('oldest', 7);
    expect(preferredCatalogReleases([latest, prior, oldest])).toEqual([prior]);
    expect(preferredCatalogReleases([prior, oldest])).toEqual([prior]);
    expect(preferredCatalogReleases([latest])).toEqual([latest]);
    expect(releaseCompatible({ ...prior, variantId: 'missing' })).toBe(false);
  });
});
