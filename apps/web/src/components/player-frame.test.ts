import { describe, expect, it } from 'vitest';
import { playerFramePath } from './player-frame';

describe('player frame navigation', () => {
  const origin = 'https://table.example';

  it('preserves the same-origin player box/game path, query and hash for refresh', () => {
    expect(playerFramePath(new URL('/player', origin), origin)).toBe('/player');
    expect(
      playerFramePath(
        new URL('/player/game?invite=test#choice', origin),
        origin,
      ),
    ).toBe('/player/game?invite=test#choice');
  });

  it('does not mirror host, public, API or unrelated player routes', () => {
    for (const path of [
      '/host',
      '/public/game',
      '/api/health',
      '/player-other',
      '/player/admin',
    ])
      expect(playerFramePath(new URL(path, origin), origin)).toBeNull();
  });

  it('does not mirror cross-origin or opaque URLs', () => {
    expect(
      playerFramePath(new URL('https://other.example/player/game'), origin),
    ).toBeNull();
    expect(
      playerFramePath(new URL('data:text/html,player'), origin),
    ).toBeNull();
  });
});
