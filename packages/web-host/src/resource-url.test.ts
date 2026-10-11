import { describe, expect, it } from 'vitest';
import { resourceUrl } from './resource-url';
describe('release-bound logical resources', () => {
  it('keeps old entry resources pinned after another release loads', () => {
    const old = '1'.repeat(64),
      current = '2'.repeat(64);
    expect(
      resourceUrl(
        'uno/audio/place-v1.flac',
        `https://host/game-packages/${old}/web/entry.js`,
      ),
    ).toBe(`/game-packages/${old}/resources/uno/audio/place-v1.flac`);
    expect(
      resourceUrl(
        'uno/audio/place-v1.flac',
        `https://host/game-packages/${current}/web/entry.js`,
      ),
    ).toContain(current);
  });
  it('rejects resource traversal and malformed immutable entry references', () => {
    for (const id of [
      'uno/../secret',
      'uno//x',
      'uno/a?x',
      '../uno/x',
      'uno/./x',
    ])
      expect(() => resourceUrl(id)).toThrow();
    expect(() =>
      resourceUrl(
        'uno/a.png',
        'https://host/game-packages/latest/web/entry.js',
      ),
    ).toThrow();
  });
});
