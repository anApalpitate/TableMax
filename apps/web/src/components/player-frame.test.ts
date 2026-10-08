import { describe, expect, it } from 'vitest';
import {
  isDesktopPlayer,
  playerDisplayKey,
  playerFramePath,
  readPlayerDisplay,
  savePlayerDisplay,
} from './player-frame';

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

describe('player display preferences', () => {
  const desktop = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    platform: 'Win32',
    maxTouchPoints: 0,
  };
  it('recognizes desktop platforms without Client Hints, including touch Windows', () => {
    for (const platform of ['Win32', 'MacIntel', 'Linux x86_64', 'CrOS'])
      expect(
        isDesktopPlayer({ userAgent: platform, platform, maxTouchPoints: 0 }),
      ).toBe(true);
    expect(isDesktopPlayer({ ...desktop, maxTouchPoints: 10 })).toBe(true);
    expect(
      isDesktopPlayer({
        ...desktop,
        platform: '',
        userAgentData: { mobile: false, platform: 'Windows' },
      }),
    ).toBe(true);
  });
  it('excludes mobile, desktop-UA iPad and unknown devices', () => {
    for (const userAgent of [
      'Android Linux',
      'iPhone',
      'iPad',
      'iPod',
      'Mobile',
    ])
      expect(isDesktopPlayer({ ...desktop, userAgent })).toBe(false);
    expect(
      isDesktopPlayer({
        userAgent: 'Mozilla/5.0 (Macintosh)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe(false);
    expect(
      isDesktopPlayer({
        ...desktop,
        userAgentData: { mobile: true, platform: 'Windows' },
      }),
    ).toBe(false);
    expect(
      isDesktopPlayer({ userAgent: '', platform: '', maxTouchPoints: 0 }),
    ).toBe(false);
  });
  it('defaults safely and tolerates blocked storage', () => {
    for (const value of [null, '', 'broken', 'portrait'])
      expect(readPlayerDisplay({ getItem: () => value })).toBe('portrait');
    expect(readPlayerDisplay(null)).toBe('portrait');
    expect(
      readPlayerDisplay({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe('portrait');
    expect(() =>
      savePlayerDisplay(
        {
          setItem: () => {
            throw new Error('blocked');
          },
        },
        'wide',
      ),
    ).not.toThrow();
  });
  it('persists the preference separately from player credentials', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    savePlayerDisplay(storage, 'wide');
    expect(readPlayerDisplay(storage)).toBe('wide');
    expect([...values.keys()]).toEqual([playerDisplayKey]);
    savePlayerDisplay(storage, 'portrait');
    expect(readPlayerDisplay(storage)).toBe('portrait');
  });
});
