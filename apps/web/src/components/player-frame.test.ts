import { describe, expect, it } from 'vitest';
import { playerFramePath } from './player-frame';

describe('player frame navigation', () => {
  const origin = 'https://table.example';

  it('preserves root entry and legacy player box/game paths, query and hash for refresh', () => {
    expect(playerFramePath(new URL('/', origin), origin)).toBe('/');
    expect(playerFramePath(new URL('/?invite=test#join', origin), origin)).toBe(
      '/?invite=test#join',
    );
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
      '/host/game',
      '/public',
      '/public/game',
      '/api/health',
      '/player-other',
      '/player/admin',
      '/game',
    ])
      expect(playerFramePath(new URL(path, origin), origin)).toBeNull();
  });

  it('does not mirror cross-origin or opaque URLs', () => {
    expect(
      playerFramePath(new URL('https://other.example/'), origin),
    ).toBeNull();
    expect(
      playerFramePath(new URL('https://other.example/player/game'), origin),
    ).toBeNull();
    expect(
      playerFramePath(new URL('data:text/html,player'), origin),
    ).toBeNull();
  });

  it.each(['http://127.0.0.1:8080', 'https://table.example:8443'])(
    'preserves the root frame path for %s without changing its scheme or port',
    (entry) => {
      expect(playerFramePath(new URL(entry), entry)).toBe('/');
      expect(playerFramePath(new URL('/player/game', entry), entry)).toBe(
        '/player/game',
      );
      expect(
        playerFramePath(new URL('https://table.example/'), entry),
      ).toBeNull();
    },
  );
});
