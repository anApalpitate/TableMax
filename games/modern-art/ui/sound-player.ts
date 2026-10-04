export interface ModernArtAudioPort {
  src: string;
  volume: number;
  onended: ((event: Event) => unknown) | null;
  onerror: ((event: Event | string) => unknown) | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

/** One decoder, with a small waiting queue so a quick auction never lags behind. */
export class ModernArtSoundPlayer {
  private readonly volume = 0.45;
  private queue: string[] = [];
  private playing = false;
  private unlocking = false;
  private disposed = false;
  private generation = 0;
  constructor(
    private readonly audio: ModernArtAudioPort,
    private readonly blocked: () => void,
  ) {
    audio.volume = this.volume;
    const complete = () => {
      if (this.unlocking || !this.playing || this.disposed) return;
      this.playing = false;
      this.next();
    };
    audio.onended = complete;
    audio.onerror = complete;
  }
  enqueue(source: string) {
    if (this.disposed) return;
    this.queue = [...this.queue, source].slice(-3);
    this.next();
  }
  private next() {
    if (this.playing || this.unlocking || this.disposed || !this.queue.length)
      return;
    this.playing = true;
    this.audio.src = this.queue.shift()!;
    const generation = ++this.generation;
    void this.audio.play().catch(() => {
      if (generation !== this.generation || this.disposed) return;
      this.stop();
      this.blocked();
    });
  }
  stop() {
    this.generation++;
    this.queue = [];
    this.playing = false;
    this.unlocking = false;
    this.audio.pause();
    this.audio.volume = this.volume;
  }
  async unlock(source: string) {
    if (this.disposed) return false;
    this.stop();
    const generation = this.generation;
    this.unlocking = true;
    this.audio.src = source;
    this.audio.volume = 0;
    try {
      await this.audio.play();
      return generation === this.generation && !this.disposed;
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    } finally {
      if (generation === this.generation && !this.disposed) {
        this.audio.pause();
        this.audio.volume = this.volume;
        this.unlocking = false;
        this.next();
      }
    }
  }
  dispose() {
    this.stop();
    this.disposed = true;
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.src = '';
    this.audio.load();
  }
}
