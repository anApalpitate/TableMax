import { audioChannels } from './audio-types';
interface AudioFrame {
  readonly url: string;
}
interface AudioContents {
  readonly id: number;
  readonly mainFrame: AudioFrame;
  isDestroyed(): boolean;
  getURL(): string;
  send(channel: string, active: boolean): void;
}
interface AudioWindow {
  readonly webContents: AudioContents;
  isDestroyed(): boolean;
  on(event: string, listener: () => void): unknown;
}
export interface AudioRequest {
  sender: AudioContents;
  senderFrame: AudioFrame | null;
}
export class AudioOutputController {
  private entries = new Map<
    number,
    { window: AudioWindow; role: 'host' | 'public'; ready: boolean }
  >();
  private played = new Set<string>();
  constructor(private origin: string) {}
  register(window: AudioWindow, role: 'host' | 'public') {
    const id = window.webContents.id;
    this.entries.set(id, { window, role, ready: false });
    window.on('closed', () => {
      this.entries.delete(id);
      this.broadcast();
    });
  }
  reset(window: AudioWindow) {
    const entry = this.entries.get(window.webContents.id);
    if (entry?.window !== window) return;
    entry.ready = false;
    this.broadcast();
  }
  private owner() {
    const entries = [...this.entries.values()].filter(
      ({ window, ready }) =>
        ready && !window.isDestroyed() && !window.webContents.isDestroyed(),
    );
    return (entries.find((entry) => entry.role === 'public') ?? entries[0])
      ?.window.webContents.id;
  }
  private entry(request: AudioRequest, requireGame: boolean) {
    const entry = this.entries.get(request.sender.id);
    if (
      !entry ||
      entry.window.webContents !== request.sender ||
      request.senderFrame !== request.sender.mainFrame ||
      request.sender.isDestroyed()
    )
      throw new Error('Audio output is unavailable.');
    const url = new URL(request.sender.getURL());
    if (
      url.origin !== this.origin ||
      ![
        '/' + entry.role + '/game',
        ...(!requireGame ? ['/' + entry.role] : []),
      ].includes(url.pathname) ||
      request.senderFrame.url !== request.sender.getURL()
    )
      throw new Error('Audio request origin is invalid.');
    return entry;
  }
  connect(request: AudioRequest) {
    this.entry(request, true).ready = true;
    this.broadcast();
    return this.owner() === request.sender.id;
  }
  disconnect(request: AudioRequest) {
    this.entry(request, false).ready = false;
    this.broadcast();
  }
  claim(request: AudioRequest, key: unknown) {
    this.entry(request, true);
    if (typeof key !== 'string' || key.length < 1 || key.length > 240)
      throw new Error('Invalid audio event.');
    if (this.owner() !== request.sender.id || this.played.has(key))
      return false;
    this.played.add(key);
    if (this.played.size > 256)
      this.played.delete(this.played.values().next().value!);
    return true;
  }
  private broadcast() {
    const owner = this.owner();
    for (const { window } of this.entries.values())
      if (!window.isDestroyed() && !window.webContents.isDestroyed())
        window.webContents.send(
          audioChannels.changed,
          window.webContents.id === owner,
        );
  }
}
