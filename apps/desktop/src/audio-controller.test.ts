import { describe, expect, it } from 'vitest';
import { AudioOutputController } from './audio-controller';

function fixture(id: number, role: 'host' | 'public' = 'host') {
  let url = `http://127.0.0.1:1234/${role}/game`;
  let closed = false;
  const listeners = new Map<string, () => void>();
  const sent: boolean[] = [];
  const frame = {
    get url() {
      return url;
    },
  };
  const webContents = {
    id,
    mainFrame: frame,
    isDestroyed: () => closed,
    getURL: () => url,
    send: (_channel: string, active: boolean) => {
      sent.push(active);
    },
  };
  const window = {
    webContents,
    isDestroyed: () => closed,
    on: (event: string, listener: () => void) => listeners.set(event, listener),
  };
  return {
    window,
    request: { sender: webContents, senderFrame: frame },
    sent,
    close() {
      closed = true;
      listeners.get('closed')?.();
    },
    navigate(value: string) {
      url = value;
    },
  };
}
describe('single desktop audio output', () => {
  it('keeps the host as sole audio owner and never replays a saved event after reconnect', () => {
    const audio = new AudioOutputController('http://127.0.0.1:1234');
    const host = fixture(1);
    audio.register(host.window, 'host');
    expect(audio.connect(host.request)).toBe(true);
    expect(audio.claim(host.request, 'game:branch:1')).toBe(true);
    audio.reset(host.window);
    expect(audio.claim(host.request, 'game:branch:2')).toBe(false);
    expect(audio.connect(host.request)).toBe(true);
    expect(host.sent.at(-1)).toBe(true);
    expect(audio.claim(host.request, 'game:branch:1')).toBe(false);
    expect(audio.claim(host.request, 'game:branch:2')).toBe(true);
    expect(audio.claim(host.request, 'game:branch:2')).toBe(false);
    host.close();
    expect(() => audio.claim(host.request, 'game:branch:3')).toThrow();
  });
  it('rejects public registration and releases host audio on return to the box', () => {
    const audio = new AudioOutputController('http://127.0.0.1:1234');
    const first = fixture(1),
      retired = fixture(2, 'public');
    expect(() => audio.register(retired.window, 'public' as 'host')).toThrow();
    expect(() => audio.connect(retired.request)).toThrow();
    audio.register(first.window, 'host');
    audio.connect(first.request);
    first.navigate('http://127.0.0.1:1234/host');
    audio.disconnect(first.request);
    expect(first.sent.at(-1)).toBe(false);
    expect(() => audio.connect(first.request)).toThrow();
  });
  it('rejects unknown windows, player pages, foreign origins and subframes', () => {
    const audio = new AudioOutputController('http://127.0.0.1:1234');
    const host = fixture(1, 'host');
    expect(() => audio.connect(host.request)).toThrow();
    audio.register(host.window, 'host');
    expect(() =>
      audio.connect({
        ...host.request,
        senderFrame: { url: host.request.senderFrame.url },
      }),
    ).toThrow();
    host.navigate('http://127.0.0.1:1234/player/game');
    expect(() => audio.connect(host.request)).toThrow();
    host.navigate('http://127.0.0.1:1234/public/game');
    expect(() => audio.connect(host.request)).toThrow();
    host.navigate('https://example.com/host/game');
    expect(() => audio.connect(host.request)).toThrow();
  });
});
