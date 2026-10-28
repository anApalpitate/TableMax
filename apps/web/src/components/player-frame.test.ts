import { describe, expect, it } from 'vitest';
import {
  isDesktopPlayer,
  isPhonePlayer,
  phoneIsLandscape,
  playerDisplayKey,
  playerFramePath,
  readPlayerDisplay,
  readWorkspaceDisplay,
  savePlayerDisplay,
  saveWorkspaceDisplay,
  workspaceDisplayKey,
  workspaceLayout,
  workspaceSpace,
} from './player-frame';

describe('phone-only orientation policy', () => {
  it('confirms phones without classifying tablets or touch desktops as phones', () => {
    expect(isPhonePlayer({ userAgent: 'iPhone Mobile Safari' })).toBe(true);
    expect(isPhonePlayer({ userAgent: 'Android 14 Mobile Chrome' })).toBe(true);
    expect(isPhonePlayer({ userAgent: 'Android 14 Chrome' })).toBe(false);
    expect(isPhonePlayer({ userAgent: 'iPad Mobile Safari' })).toBe(false);
    expect(isPhonePlayer({ userAgent: 'Windows NT 10.0' })).toBe(false);
    expect(isPhonePlayer({ userAgent: 'Macintosh Safari' })).toBe(false);
    expect(isPhonePlayer({ userAgent: 'unknown' })).toBe(false);
  });
  it('uses physical orientation independently of keyboard-reduced visible height', () => {
    expect(phoneIsLandscape('portrait-primary', 390, 280)).toBe(false);
    expect(phoneIsLandscape('landscape-primary', 844, 390)).toBe(true);
    expect(phoneIsLandscape('landscape-secondary', 844, 390)).toBe(true);
    expect(phoneIsLandscape(undefined, 390, 844)).toBe(false);
    expect(phoneIsLandscape(undefined, 844, 390)).toBe(true);
  });
});

describe('opt-in game workspace layout', () => {
  it('keeps portrait until the player chooses wide, even on a landscape display', () => {
    expect(workspaceLayout(1280, 720, 'portrait')).toBe('portrait');
    expect(workspaceLayout(844, 390, 'portrait')).toBe('portrait');
    expect(workspaceLayout(390, 844, 'portrait')).toBe('portrait');
  });
  it('reserves the side button rail before deciding whether wide can fit', () => {
    expect(workspaceSpace(844, 390)).toEqual({ width: 772, height: 374 });
    expect(workspaceSpace(1280, 720)).toEqual({ width: 1208, height: 704 });
    expect(workspaceSpace(0, 0)).toEqual({ width: 0, height: 0 });
    const minimum = workspaceSpace(712, 336);
    expect(workspaceLayout(minimum.width, minimum.height, 'wide')).toBe('wide');
    const narrow = workspaceSpace(711, 336);
    expect(workspaceLayout(narrow.width, narrow.height, 'wide')).toBe(
      'portrait',
    );
    const short = workspaceSpace(712, 335);
    expect(workspaceLayout(short.width, short.height, 'wide')).toBe('portrait');
  });
  it('honours a portrait override and safely falls back without changing the preference', () => {
    expect(workspaceLayout(1280, 668, 'portrait')).toBe('portrait');
    expect(workspaceLayout(640, 319, 'wide')).toBe('portrait');
    expect(workspaceLayout(959, 700, 'wide')).toBe('wide');
    expect(workspaceLayout(1280, 668, 'wide')).toBe('wide');
  });
  it('starts the new button preference in portrait without migrating old auto or wide choices', () => {
    const values = new Map<string, string>([
      ['tablemax-workspace-display-mode-v1', 'wide'],
      [playerDisplayKey, 'wide'],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(readWorkspaceDisplay(storage)).toBe('portrait');
    values.set(workspaceDisplayKey, 'auto');
    expect(readWorkspaceDisplay(storage)).toBe('portrait');
    saveWorkspaceDisplay(storage, 'wide');
    expect(readWorkspaceDisplay(storage)).toBe('wide');
    expect(readPlayerDisplay(storage)).toBe('wide');
    saveWorkspaceDisplay(storage, 'portrait');
    expect(readWorkspaceDisplay(storage)).toBe('portrait');
    expect(values.get('tablemax-workspace-display-mode-v1')).toBe('wide');
    expect(values.get(playerDisplayKey)).toBe('wide');
  });
  it('keeps the default and current button choice usable with unavailable storage', () => {
    expect(readWorkspaceDisplay(null)).toBe('portrait');
    expect(
      readWorkspaceDisplay({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe('portrait');
    expect(() =>
      saveWorkspaceDisplay(
        {
          setItem: () => {
            throw new Error('blocked');
          },
        },
        'wide',
      ),
    ).not.toThrow();
  });
});

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
