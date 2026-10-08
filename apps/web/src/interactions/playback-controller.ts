import { INTERACTION_CATALOG, type InteractionEvent } from '@tablemax/protocol';
import type { InteractionPlaybackResult } from './audio-player';
import { InteractionShotSlots } from './shot-slots';

export interface LiveInteractionShot {
  event: InteractionEvent;
  startedAt: number;
  endsAt: number;
}
interface PendingShot {
  live: LiveInteractionShot | null;
}
export interface InteractionPlaybackAudio {
  play(
    event: InteractionEvent,
    receivedAt: number,
  ): Promise<InteractionPlaybackResult>;
  stop(): void;
  stopEvent(eventId: string): void;
}
interface Options {
  audio: InteractionPlaybackAudio;
  now(): number;
  visible(): boolean;
  publish(shots: LiveInteractionShot[]): void;
}

/** Synchronous feed/reset ownership is independent of React render timing. */
export class InteractionPlaybackController {
  private blocked = false;
  private readonly slots = new InteractionShotSlots<PendingShot>(
    INTERACTION_CATALOG.maxActiveShots,
  );
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private readonly options: Options) {}
  publish() {
    this.options.publish(
      this.slots
        .values()
        .flatMap((ticket) => (ticket.value.live ? [ticket.value.live] : [])),
    );
  }
  setBlocked(value: boolean, publish = true) {
    this.blocked = value;
    this.clear(publish);
  }
  clear(publish = true) {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.slots.clear();
    this.options.audio.stop();
    if (publish) this.publish();
  }
  receive(event: InteractionEvent, receivedAt: number) {
    if (this.blocked || !this.options.visible()) return;
    if (event.interaction.type === 'speech') {
      void this.options.audio.play(event, receivedAt).catch(() => undefined);
      return;
    }
    const { ticket, evicted, added } = this.slots.reserve(event.eventId, {
      live: null,
    });
    if (!added) return;
    if (evicted) {
      const timer = this.timers.get(evicted);
      if (timer !== undefined) clearTimeout(timer);
      this.timers.delete(evicted);
      this.options.audio.stopEvent(evicted);
    }
    this.publish();
    void this.options.audio
      .play(event, receivedAt)
      .catch((): InteractionPlaybackResult => ({ status: 'error' }))
      .then((result) => {
        if (!this.slots.current(ticket)) return;
        // Retain a full silent animation when preparation misses its audio deadline.
        const startedAt = result.startedAt ?? this.options.now();
        ticket.value.live = {
          event,
          startedAt,
          endsAt: startedAt + event.durationMs,
        };
        this.publish();
        this.timers.set(
          event.eventId,
          setTimeout(
            () => {
              if (!this.slots.remove(ticket)) return;
              this.timers.delete(event.eventId);
              this.options.audio.stopEvent(event.eventId);
              this.publish();
            },
            Math.max(0, startedAt + event.durationMs - this.options.now()),
          ),
        );
      });
  }
}
