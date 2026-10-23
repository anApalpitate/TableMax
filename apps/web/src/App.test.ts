import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RoomView } from '@tablemax/protocol';

const fixture = vi.hoisted(() => ({
  route: { role: 'host', inGame: true } as {
    role: 'host' | 'player';
    inGame: boolean;
  } | null,
  view: null as RoomView | null,
  message: '',
  connected: true,
  load: vi.fn(),
}));
vi.mock('./navigation', () => ({
  useScreenRoute: () => fixture.route,
  navigate: vi.fn(),
}));
vi.mock('./session/useRoomSession', () => ({
  useRoomSession: () => ({
    view: fixture.view,
    message: fixture.message,
    connected: fixture.connected,
  }),
}));
vi.mock('./game-clients/registry', () => ({
  useGameClient: (...args: unknown[]) => {
    fixture.load(...args);
    return { client: {}, error: '', retry: vi.fn() };
  },
}));
vi.mock('./screens/BoxScreen', () => ({
  BoxScreen: () => createElement('div', null, 'admission-or-box'),
}));
vi.mock('./screens/GameScreen', () => ({
  GameScreen: () => createElement('div', null, 'private-game-tree'),
}));
vi.mock('./interactions/InteractionLayer', () => ({
  InteractionLayer: () => createElement('div', null, 'interaction-tree'),
}));
vi.mock('./components/PlayerFrame', () => ({
  PlayerFrame: () => createElement('div', null, 'stable-player-frame'),
}));
import { App } from './App';

function view(role: 'host' | 'player' | 'public') {
  return {
    self: { role },
    game: { id: 'uno', variantId: 'classic', releaseRef: 'frozen' },
    instanceId: 'round',
    revision: 4,
    branch: 0,
  } as RoomView;
}
afterEach(() => {
  vi.unstubAllGlobals();
  fixture.load.mockClear();
  fixture.view = null;
  fixture.route = { role: 'host', inGame: true };
  fixture.message = '';
  fixture.connected = true;
});
describe('management mount authorization', () => {
  it.each([null, 'public', 'player'] as const)(
    'does not load or mount a game for identity %s',
    (role) => {
      fixture.view = role ? view(role) : null;
      const html = renderToStaticMarkup(createElement(App));
      expect(fixture.load.mock.calls[0]?.[0]).toBeUndefined();
      expect(html).not.toContain('private-game-tree');
      expect(html).not.toContain('admission-or-box');
      expect(html).not.toContain('interaction-tree');
      expect(html).toContain('进入玩家端');
    },
  );
  it('retains an authorized board while transport is disconnected; revocation removes it', () => {
    fixture.view = view('host');
    fixture.connected = false;
    expect(renderToStaticMarkup(createElement(App))).toContain(
      'private-game-tree',
    );
    expect(fixture.load.mock.calls.at(-1)?.[0]).toBe('uno');
    fixture.view = null;
    fixture.message = '身份已失效';
    expect(renderToStaticMarkup(createElement(App))).not.toContain(
      'private-game-tree',
    );
    expect(fixture.load.mock.calls.at(-1)?.[0]).toBeUndefined();
  });
  it('keeps an unseated player at admission and loads only after server grants a seat', () => {
    const top = {};
    vi.stubGlobal('window', { self: {}, top });
    fixture.route = { role: 'player', inGame: true };
    fixture.view = view('public');
    expect(renderToStaticMarkup(createElement(App))).toContain(
      'admission-or-box',
    );
    expect(fixture.load.mock.calls.at(-1)?.[0]).toBeUndefined();
    fixture.view = view('player');
    expect(renderToStaticMarkup(createElement(App))).toContain(
      'private-game-tree',
    );
  });
  it('does not create any room session tree for unknown paths', () => {
    fixture.route = null;
    expect(renderToStaticMarkup(createElement(App))).toContain('页面不可用');
    expect(fixture.load).not.toHaveBeenCalled();
  });
});
