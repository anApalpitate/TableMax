import { describe, expect, it } from 'vitest';
import { screenRoute } from './navigation';

describe('current product routes', () => {
  it('recognizes only host and player pages', () => {
    for (const path of ['/', '/player', '/player/'])
      expect(screenRoute(path)).toEqual({ role: 'player', inGame: false });
    for (const role of ['host', 'player'])
      for (const suffix of ['', '/'])
        expect(screenRoute(`/${role}/game${suffix}`)).toEqual({
          role,
          inGame: true,
        });
    expect(screenRoute('/host')).toEqual({ role: 'host', inGame: false });
  });
  it('never treats retired, lookalike or unknown URLs as management', () => {
    for (const path of [
      '/public',
      '/public/game',
      '/public/',
      '/public/game/',
      '/host/unknown',
      '/hostname',
      '/player-preview',
      '/player//',
      '/host//',
      '/not-found',
      '/HOST',
      '//host',
    ])
      expect(screenRoute(path), path).toBeNull();
  });
});
