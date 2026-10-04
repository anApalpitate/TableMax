import type { SoundCueRecipe, SoundLane } from './presentation-state';
import { SOUND_PLAYBACK_VOLUME } from './sound-timing';

export interface AudioPort {
  src: string;
  volume: number;
  onended: ((event: Event) => unknown) | null;
  onerror: ((event: Event | string) => unknown) | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

export interface PlaybackCue extends Omit<SoundCueRecipe, 'cue'> {
  source: string;
}
interface Slot {
  audio: AudioPort;
  version: number;
  active: { priority: number } | null;
}

/** Two reusable media slots, one saved-event owner, and no historical FIFO. */
export class SavedSoundPlayer {
  private slots: Record<SoundLane, Slot>;
  private scheduled = new Map<SoundLane, ReturnType<typeof setTimeout>>();
  private seen = new Set<string>();
  private generation = 0;
  private disposed = false;
  constructor(
    audio: Record<SoundLane, AudioPort>,
    private readonly blocked: () => void,
    private readonly now: () => number = Date.now,
  ) {
    this.slots = {
      effect: { audio: audio.effect, version: 0, active: null },
      cry: { audio: audio.cry, version: 0, active: null },
    };
    for (const { audio: port } of Object.values(this.slots))
      port.volume = SOUND_PLAYBACK_VOLUME;
  }
  enqueueEvent(
    eventKey: string,
    cues: readonly PlaybackCue[],
    occurredAt = this.now(),
  ) {
    if (this.disposed || this.seen.has(eventKey)) return;
    this.seen.add(eventKey);
    if (this.seen.size > 256)
      this.seen.delete(this.seen.values().next().value!);
    this.cancelScheduled();
    const generation = ++this.generation;
    for (const cue of cues) {
      const dueAt = occurredAt + cue.delayMs;
      const start = () => {
        this.scheduled.delete(cue.lane);
        if (
          this.disposed ||
          generation !== this.generation ||
          this.now() - dueAt > cue.maxLateMs
        )
          return;
        this.play(cue);
      };
      const delay = dueAt - this.now();
      if (delay <= 0) start();
      else {
        const previous = this.scheduled.get(cue.lane);
        if (previous !== undefined) clearTimeout(previous);
        this.scheduled.set(cue.lane, setTimeout(start, delay));
      }
    }
  }
  private play(cue: PlaybackCue) {
    const slot = this.slots[cue.lane];
    // Mechanical feedback must not interrupt a saved entrance or victory.
    if (
      cue.lane === 'effect' &&
      slot.active &&
      slot.active.priority > cue.priority
    )
      return;
    const version = ++slot.version;
    slot.audio.pause();
    slot.active = { priority: cue.priority };
    slot.audio.src = cue.source;
    const finish = () => {
      if (slot.version === version) slot.active = null;
    };
    slot.audio.onended = finish;
    slot.audio.onerror = finish;
    void slot.audio.play().catch(() => {
      if (this.disposed || slot.version !== version) return;
      this.stop();
      this.blocked();
    });
  }
  private cancelScheduled() {
    for (const timer of this.scheduled.values()) clearTimeout(timer);
    this.scheduled.clear();
  }
  stop() {
    this.generation++;
    this.cancelScheduled();
    for (const slot of Object.values(this.slots)) {
      slot.version++;
      slot.active = null;
      slot.audio.pause();
    }
  }
  async unlock(source: string) {
    this.stop();
    const generation = this.generation;
    try {
      await Promise.all(
        Object.values(this.slots).map(async ({ audio }) => {
          audio.src = source;
          audio.volume = 0;
          await audio.play();
          if (generation === this.generation) audio.pause();
        }),
      );
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    } finally {
      for (const { audio } of Object.values(this.slots))
        audio.volume = SOUND_PLAYBACK_VOLUME;
    }
  }
  dispose() {
    this.disposed = true;
    this.stop();
    for (const { audio } of Object.values(this.slots)) {
      audio.onended = null;
      audio.onerror = null;
      audio.src = '';
      audio.load();
    }
  }
}
