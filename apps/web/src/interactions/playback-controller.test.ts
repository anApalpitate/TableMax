import { afterEach, expect, it, vi } from 'vitest';
import type { InteractionEvent } from '@tablemax/protocol';
import type { InteractionPlaybackResult } from './audio-player';
import {
  InteractionPlaybackController,
  type LiveInteractionShot,
} from './playback-controller';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function event(seq: number): InteractionEvent {
  return {
    eventId: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    requestId: String(seq).padStart(32, '0'),
    actorSeatId: 'seat-a',
    serverSessionId: '00000000-0000-4000-8000-000000000100',
    instanceId: 'room-a',
    branch: 0,
    interactionSeq: seq,
    durationMs: 1000,
    interaction: { type: 'shot', effectId: 'egg', point: { x: 0.5, y: 0.5 } },
  };
}
function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  let shots: LiveInteractionShot[] = [],
    visible = true;
  const audio = {
    play: vi.fn(
      async (
        _event: InteractionEvent,
        _receivedAt: number,
      ): Promise<InteractionPlaybackResult> => {
        void _event;
        void _receivedAt;
        return {
          status: 'started',
          startedAt: Date.now(),
        };
      },
    ),
    stop: vi.fn(),
    stopEvent: vi.fn(),
  };
  const controller = new InteractionPlaybackController({
    audio,
    now: () => Date.now(),
    visible: () => visible,
    publish: (next) => {
      shots = next;
    },
  });
  return {
    controller,
    audio,
    shots: () => shots,
    hide: () => {
      visible = false;
    },
  };
}
afterEach(() => vi.useRealTimers());

it('synchronous reset followed by a new event in the same tick preserves the new shot despite old preparation finishing', async () => {
  const f = fixture(),
    old = deferred<InteractionPlaybackResult>();
  f.audio.play.mockImplementation((item) =>
    item.interactionSeq === 1
      ? old.promise
      : Promise.resolve({ status: 'started', startedAt: 0 }),
  );
  const first = event(1),
    restored = { ...event(2), eventId: first.eventId };
  f.controller.receive(first, 0);
  f.controller.clear();
  f.controller.receive(restored, 0);
  await vi.advanceTimersByTimeAsync(0);
  expect(f.shots().map((shot) => shot.event.interactionSeq)).toEqual([2]);
  old.resolve({ status: 'started', startedAt: 0 });
  await vi.advanceTimersByTimeAsync(0);
  expect(f.shots().map((shot) => shot.event.interactionSeq)).toEqual([2]);
  expect(f.audio.stop).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.shots()).toEqual([]);
  expect(f.audio.stopEvent).toHaveBeenCalledExactlyOnceWith(restored.eventId);
});

it('a missed audio deadline retains a complete silent shot from the local preparation result', async () => {
  const f = fixture(),
    audio = deferred<InteractionPlaybackResult>();
  f.audio.play.mockImplementation(() => audio.promise);
  f.controller.receive(event(1), 0);
  await vi.advanceTimersByTimeAsync(300);
  audio.resolve({ status: 'deadline' });
  await vi.advanceTimersByTimeAsync(0);
  expect(f.shots()[0]).toMatchObject({ startedAt: 300, endsAt: 1300 });
  await vi.advanceTimersByTimeAsync(999);
  expect(f.shots()).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(f.shots()).toEqual([]);
  expect(f.audio.play).toHaveBeenCalledTimes(1);
});

it('blocking synchronously retires pending shots and guards subsequent feed delivery and hidden speech', async () => {
  const f = fixture(),
    pending = deferred<InteractionPlaybackResult>();
  f.audio.play.mockImplementation(() => pending.promise);
  f.controller.receive(event(1), 0);
  f.controller.setBlocked(true);
  f.controller.receive(event(2), 0);
  pending.resolve({ status: 'started', startedAt: 0 });
  await vi.advanceTimersByTimeAsync(0);
  expect(f.shots()).toEqual([]);
  expect(f.audio.play).toHaveBeenCalledTimes(1);
  f.controller.setBlocked(false);
  f.hide();
  f.controller.receive(
    { ...event(3), interaction: { type: 'speech', phraseId: 'hurry' } },
    0,
  );
  expect(f.audio.play).toHaveBeenCalledTimes(1);
});
