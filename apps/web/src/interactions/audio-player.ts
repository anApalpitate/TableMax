import {
  recordInteractionDiagnostic,
  type InteractionAudioChannel,
} from './diagnostics';
export interface InteractionAudioOptions {
  createContext(): AudioContext;
  fetchAudio(url: string): Promise<ArrayBuffer>;
  canPlay(): boolean;
  claim(eventId: string): Promise<boolean>;
  now(): number;
  maxActiveShots: number;
  startDeadlineMs: number;
  speechDucking: number;
}
export interface InteractionPlaybackRequest {
  url: string;
  eventId: string;
  channel: InteractionAudioChannel;
  receivedAt: number;
  durationMs: number;
}
export interface InteractionPlaybackResult {
  status: 'started' | 'unavailable' | 'deadline' | 'cancelled' | 'error';
  startedAt?: number;
}
interface Job {
  request: InteractionPlaybackRequest;
  cancelled: boolean;
  settled: boolean;
  source: AudioBufferSourceNode | null;
  timer: ReturnType<typeof setTimeout> | null;
  resolve(result: InteractionPlaybackResult): void;
}
/** Linear for ordinary levels; bounded soft ceiling for coincident mixed peaks. */
export function interactionLimiterCurve() {
  return Float32Array.from({ length: 4097 }, (_, index) => {
    const x = index / 2048 - 1,
      absolute = Math.abs(x);
    return absolute <= 0.8
      ? x
      : Math.sign(x) * (0.8 + 0.16 * (1 - Math.exp(-(absolute - 0.8) * 12)));
  });
}
/** Three independent effects and one latest speech; never queue historical work. */
export class InteractionAudioPlayer {
  private context: AudioContext | null = null;
  private effects: GainNode | null = null;
  private voice: GainNode | null = null;
  private resuming: Promise<void> | null = null;
  private enabled = true;
  private owner = true;
  private readonly shots = new Map<string, Job>();
  private speech: Job | null = null;
  private readonly encoded = new Map<string, Promise<ArrayBuffer>>();
  private readonly decoded = new Map<string, Promise<AudioBuffer>>();
  private readonly ready = new Map<string, AudioBuffer>();
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
  private ensureContext() {
    if (this.context) return this.context;
    const context = this.options.createContext();
    const effects = context.createGain(),
      voice = context.createGain(),
      master = context.createGain();
    effects.gain.value = 1;
    voice.gain.value = 1;
    master.gain.value = 0.8;
    const limiter = context.createWaveShaper();
    limiter.curve = interactionLimiterCurve();
    limiter.oversample = 'none';
    effects.connect(master);
    voice.connect(master);
    master.connect(limiter);
    limiter.connect(context.destination);
    this.context = context;
    this.effects = effects;
    this.voice = voice;
    return context;
  }
  private bytes(url: string) {
    let pending = this.encoded.get(url);
    if (!pending) {
      const began = this.options.now();
      pending = this.options
        .fetchAudio(url)
        .then((bytes) => {
          recordInteractionDiagnostic({
            phase: 'fetch',
            durationMs: this.options.now() - began,
            cache: 'miss',
            outcome: 'ready',
          });
          return bytes;
        })
        .catch((error) => {
          this.encoded.delete(url);
          recordInteractionDiagnostic({
            phase: 'fetch',
            durationMs: this.options.now() - began,
            outcome: 'error',
          });
          throw error;
        });
      this.encoded.set(url, pending);
    }
    return pending;
  }
  private buffer(url: string, context: AudioContext) {
    let pending = this.decoded.get(url);
    if (!pending) {
      pending = this.bytes(url)
        .then(async (bytes) => {
          const began = this.options.now();
          try {
            const buffer = await context.decodeAudioData(bytes.slice(0));
            recordInteractionDiagnostic({
              phase: 'decode',
              durationMs: this.options.now() - began,
              outcome: 'ready',
            });
            return buffer;
          } catch (error) {
            recordInteractionDiagnostic({
              phase: 'decode',
              durationMs: this.options.now() - began,
              outcome: 'error',
            });
            throw error;
          }
        })
        .then((buffer) => {
          this.ready.set(url, buffer);
          return buffer;
        })
        .catch((error) => {
          this.decoded.delete(url);
          throw error;
        });
      this.decoded.set(url, pending);
    }
    return pending;
  }
  prepare(urls: string[]) {
    // Decoding a suspended context produces no sound and is independent of unlock.
    const context = this.ensureContext();
    for (const url of urls)
      void this.buffer(url, context).catch(() => undefined);
  }
  unlock(urls: string[]) {
    const context = this.ensureContext();
    this.prepare(urls);
    if (context.state === 'running') return Promise.resolve();
    const began = this.options.now();
    // A touch pointerdown can leave resume pending before user activation.
    // Each later gesture must call resume synchronously again until running;
    // reusing that blocked promise would prevent pointerup from unlocking audio.
    const pending = context
      .resume()
      .then(
        () => {
          recordInteractionDiagnostic({
            phase: 'resume',
            durationMs: this.options.now() - began,
            outcome: 'ready',
          });
        },
        (error) => {
          recordInteractionDiagnostic({
            phase: 'resume',
            durationMs: this.options.now() - began,
            outcome: 'error',
          });
          throw error;
        },
      )
      .finally(() => {
        if (this.resuming === pending) this.resuming = null;
      });
    this.resuming = pending;
    return pending;
  }
  private current(job: Job) {
    return (
      !job.cancelled &&
      (job.request.channel === 'speech'
        ? this.speech === job
        : this.shots.get(job.request.eventId) === job)
    );
  }
  private duck(active: boolean) {
    if (!this.effects || !this.context) return;
    const parameter = this.effects.gain,
      now = this.context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(parameter.value, now);
    parameter.linearRampToValueAtTime(
      active ? this.options.speechDucking : 1,
      now + (active ? 0.04 : 0.16),
    );
  }
  private settle(job: Job, result: InteractionPlaybackResult) {
    if (job.timer !== null) clearTimeout(job.timer);
    job.timer = null;
    if (job.settled) return;
    job.settled = true;
    job.resolve(result);
  }
  private retire(
    job: Job,
    outcome: 'cancelled' | 'deadline' | 'error' | 'unavailable' | 'ended',
    stopSource = true,
  ) {
    if (!this.current(job)) return;
    job.cancelled = true;
    if (job.request.channel === 'speech') {
      this.speech = null;
      this.duck(false);
    } else this.shots.delete(job.request.eventId);
    if (job.source) {
      job.source.onended = null;
      if (stopSource)
        try {
          job.source.stop();
        } catch {
          /* Already ended. */
        }
      job.source.disconnect();
      job.source = null;
    }
    this.settle(job, { status: outcome === 'ended' ? 'cancelled' : outcome });
    recordInteractionDiagnostic({
      phase: outcome === 'ended' || outcome === 'cancelled' ? 'stop' : 'drop',
      eventId: job.request.eventId,
      channel: job.request.channel,
      outcome,
    });
  }
  stopEvent(eventId: string) {
    const job =
      this.shots.get(eventId) ??
      (this.speech?.request.eventId === eventId ? this.speech : null);
    if (job) this.retire(job, 'cancelled');
  }
  stop() {
    for (const job of [...this.shots.values()]) this.retire(job, 'cancelled');
    if (this.speech) this.retire(this.speech, 'cancelled');
  }
  play(
    request: InteractionPlaybackRequest,
  ): Promise<InteractionPlaybackResult> {
    if (request.channel === 'speech' && this.speech)
      this.retire(this.speech, 'cancelled');
    else this.stopEvent(request.eventId);
    const result = new Promise<InteractionPlaybackResult>((resolve) => {
      const job: Job = {
        request,
        resolve,
        cancelled: false,
        settled: false,
        source: null,
        timer: null,
      };
      if (request.channel === 'speech') this.speech = job;
      else {
        this.shots.set(request.eventId, job);
        if (this.shots.size > this.options.maxActiveShots)
          this.retire(this.shots.values().next().value!, 'cancelled');
      }
      const context = this.context;
      if (
        !context ||
        !this.canPlay() ||
        (context.state !== 'running' && !this.resuming)
      ) {
        this.retire(job, 'unavailable');
        return;
      }
      const remaining =
        request.receivedAt + this.options.startDeadlineMs - this.options.now();
      if (remaining <= 0) {
        this.retire(job, 'deadline');
        return;
      }
      job.timer = setTimeout(() => this.retire(job, 'deadline'), remaining);
      void this.start(job, context);
    });
    return result;
  }
  private async start(job: Job, context: AudioContext) {
    const request = job.request;
    try {
      const began = this.options.now(),
        cache = this.ready.has(request.url) ? 'hit' : 'miss';
      const loading = this.buffer(request.url, context).then((buffer) => {
        recordInteractionDiagnostic({
          phase: 'prepare',
          eventId: request.eventId,
          channel: request.channel,
          durationMs: this.options.now() - began,
          cache,
          outcome: 'ready',
        });
        return buffer;
      });
      const [, buffer] = await Promise.all([
        this.resuming ?? Promise.resolve(),
        loading,
      ]);
      if (!this.current(job)) return;
      if (!this.canPlay() || context.state !== 'running') {
        this.retire(job, 'unavailable');
        return;
      }
      const claimAt = this.options.now();
      const claimed = await this.options.claim(request.eventId);
      recordInteractionDiagnostic({
        phase: 'claim',
        eventId: request.eventId,
        channel: request.channel,
        durationMs: this.options.now() - claimAt,
        outcome: claimed ? 'ready' : 'unavailable',
      });
      if (!this.current(job)) return;
      if (!claimed || !this.canPlay() || context.state !== 'running') {
        this.retire(job, 'unavailable');
        return;
      }
      if (
        this.options.now() >=
        request.receivedAt + this.options.startDeadlineMs
      ) {
        this.retire(job, 'deadline');
        return;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(
        request.channel === 'speech' ? this.voice! : this.effects!,
      );
      job.source = source;
      source.onended = () => this.retire(job, 'ended', false);
      if (request.channel === 'speech') this.duck(true);
      const startedAt = this.options.now();
      source.start(context.currentTime, 0);
      this.settle(job, { status: 'started', startedAt });
      recordInteractionDiagnostic({
        phase: 'start',
        eventId: request.eventId,
        channel: request.channel,
        receivedAt: request.receivedAt,
        durationMs: startedAt - request.receivedAt,
        outcome: 'ready',
      });
    } catch {
      this.retire(job, 'error');
    }
  }
  close() {
    this.stop();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.effects = null;
    this.voice = null;
    this.resuming = null;
  }
}
