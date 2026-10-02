export interface AudioPort {
  src: string;
  volume: number;
  onended: ((event: Event) => unknown) | null;
  onerror: ((event: Event | string) => unknown) | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

/** One decoder and a bounded queue per authorized screen, never one player per action. */
export class SavedSoundPlayer {
  private queue: string[] = [];
  private playing = false;
  private generation = 0;
  constructor(
    private readonly audio: AudioPort,
    private readonly blocked: () => void,
  ) {
    audio.volume = 0.45;
    audio.onended = () => {
      this.playing = false;
      this.next();
    };
    audio.onerror = () => {
      this.playing = false;
      this.next();
    };
  }
  enqueue(sources: readonly string[]) {
    this.queue = [...this.queue, ...sources].slice(-6);
    this.next();
  }
  private next() {
    if (this.playing || !this.queue.length) return;
    this.playing = true;
    this.audio.src = this.queue.shift()!;
    const generation = this.generation;
    void this.audio.play().catch(() => {
      if (generation !== this.generation) return;
      this.stop();
      this.blocked();
    });
  }
  stop() {
    this.generation++;
    this.queue = [];
    this.playing = false;
    this.audio.pause();
  }
  async unlock(source: string) {
    this.stop();
    const generation = this.generation;
    this.audio.src = source;
    this.audio.volume = 0;
    try {
      await this.audio.play();
      if (generation === this.generation) this.audio.pause();
    } finally {
      this.audio.volume = 0.45;
    }
  }
  dispose() {
    this.stop();
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.src = '';
    this.audio.load();
  }
}
