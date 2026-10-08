export interface InteractionAudioOptions {
  createContext(): AudioContext;
  fetchAudio(url: string): Promise<ArrayBuffer>;
  canPlay(): boolean;
  claim(eventId: string): Promise<boolean>;
  now(): number;
}

/** One local sound, with asynchronous loading guarded against newer events. */
export class InteractionAudioPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private generation = 0;
  private resumed: Promise<void> = Promise.resolve();
  private enabled = true;
  private owner = true;
  private readonly encoded = new Map<string, Promise<ArrayBuffer>>();
  private readonly decoded = new Map<string, Promise<AudioBuffer>>();
  constructor(private readonly options: InteractionAudioOptions) {}
  setEnabled(value: boolean) {
    this.enabled = value;
    if (!value) this.stop();
  }
  setOwner(value: boolean) {
    this.owner = value;
    if (!value) this.stop();
  }
  private canPlay() {
    return this.enabled && this.owner && this.options.canPlay();
  }
  private bytes(url: string) {
    let pending = this.encoded.get(url);
    if (!pending) {
      pending = this.options.fetchAudio(url).catch((error) => {
        this.encoded.delete(url);
        throw error;
      });
      this.encoded.set(url, pending);
    }
    return pending;
  }
  prepare(urls: string[]) {
    for (const url of urls) void this.bytes(url).catch(() => undefined);
  }
  private buffer(url: string, context: AudioContext) {
    let pending = this.decoded.get(url);
    if (!pending) {
      pending = this.bytes(url)
        .then((bytes) => context.decodeAudioData(bytes.slice(0)))
        .catch((error) => {
          this.decoded.delete(url);
          throw error;
        });
      this.decoded.set(url, pending);
    }
    return pending;
  }
  unlock(urls: string[]) {
    // Create/resume synchronously inside the trusted gesture, before awaiting.
    this.context ??= this.options.createContext();
    this.resumed = this.context.resume();
    for (const url of urls)
      void this.buffer(url, this.context).catch(() => undefined);
    return this.resumed;
  }
  stop() {
    this.generation++;
    try {
      this.source?.stop();
    } catch {
      /* A sound which already ended needs no further cleanup. */
    }
    this.source = null;
  }
  async play(
    url: string,
    eventId: string,
    startedAt: number,
    durationMs: number,
  ) {
    this.stop();
    const generation = this.generation;
    const context = this.context;
    if (!context || !this.canPlay()) return;
    try {
      const [, buffer] = await Promise.all([
        this.resumed,
        this.buffer(url, context),
      ]);
      const current = () =>
        generation === this.generation &&
        this.canPlay() &&
        context.state === 'running';
      if (!current()) return;
      if (!(await this.options.claim(eventId)) || !current()) return;
      const elapsed = Math.max(0, this.options.now() - startedAt) / 1000;
      const remaining = Math.min(buffer.duration, durationMs / 1000) - elapsed;
      if (remaining <= 0) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      this.source = source;
      source.start(0, elapsed, remaining);
      source.onended = () => {
        if (this.source === source) this.source = null;
      };
    } catch {
      /* A failed or unavailable sound never delays the next interaction. */
    }
  }
  close() {
    this.stop();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.resumed = Promise.resolve();
  }
}
