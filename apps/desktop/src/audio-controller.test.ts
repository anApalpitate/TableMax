import { describe, expect, it } from 'vitest';
import { AudioOutputController } from './audio-controller';

function fixture(id: number, role: 'host' | 'public') {
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
  it('hands off to a public game and back without replaying a saved event', () => {
    const audio = new AudioOutputController('http://127.0.0.1:1234');
    const host = fixture(1, 'host'),
      publicScreen = fixture(2, 'public');
    audio.register(host.window, 'host');
    audio.register(publicScreen.window, 'public');
    expect(audio.connect(host.request)).toBe(true);
    expect(audio.claim(host.request, 'game:branch:1')).toBe(true);
    expect(audio.connect(publicScreen.request)).toBe(true);
    expect(host.sent.at(-1)).toBe(false);
    expect(audio.claim(publicScreen.request, 'game:branch:1')).toBe(false);
    expect(audio.claim(host.request, 'game:branch:2')).toBe(false);
    expect(audio.claim(publicScreen.request, 'game:branch:2')).toBe(true);
    publicScreen.close();
    expect(host.sent.at(-1)).toBe(true);
    expect(audio.claim(host.request, 'game:branch:2')).toBe(false);
    expect(audio.claim(host.request, 'game:branch:3')).toBe(true);
  });
  it('keeps only one public window active and releases on return to the box', () => {
    const audio = new AudioOutputController('http://127.0.0.1:1234');
    const first = fixture(1, 'public'),
      second = fixture(2, 'public');
    audio.register(first.window, 'public');
    audio.register(second.window, 'public');
    audio.connect(first.request);
    expect(audio.connect(second.request)).toBe(false);
    first.navigate('http://127.0.0.1:1234/public');
    audio.disconnect(first.request);
    expect(second.sent.at(-1)).toBe(true);
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
    host.navigate('https://example.com/host/game');
    expect(() => audio.connect(host.request)).toThrow();
  });
});
