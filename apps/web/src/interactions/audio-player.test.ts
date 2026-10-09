import { afterEach, expect, it, vi } from 'vitest';
import {
  InteractionAudioPlayer,
  interactionLimiterCurve,
} from './audio-player';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const sources: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }[] = [];
  const gain = () => ({
    value: 1,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const gains: ReturnType<typeof gain>[] = [];
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async (): Promise<void> => undefined),
    close: vi.fn(async () => undefined),
    decodeAudioData: vi.fn(async () => ({ duration: 2 })),
    createGain: vi.fn(() => {
      const parameter = gain();
      gains.push(parameter);
      return { gain: parameter, connect: vi.fn(), disconnect: vi.fn() };
    }),
    createWaveShaper: vi.fn(() => ({
      curve: null,
      oversample: 'none',
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => {
      const s = {
        buffer: null,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
      };
      sources.push(s);
      return s;
    }),
  };
  const fetchAudio = vi.fn(async (url: string) => {
    void url;
    return new ArrayBuffer(8);
  });
  const claim = vi.fn(async (id: string) => {
    void id;
    return true;
  });
  const player = new InteractionAudioPlayer({
    createContext: () => context as unknown as AudioContext,
    fetchAudio,
    claim,
    canPlay: () => true,
    now: () => Date.now(),
    maxActiveShots: 3,
    startDeadlineMs: 300,
    speechDucking: 0.3,
  });
  const play = (id: string, channel: 'shot' | 'speech' = 'shot', url = id) =>
    player.play({
      url,
      eventId: id,
      channel,
      receivedAt: Date.now(),
      durationMs: 2000,
    });
  return { player, context, sources, gains, fetchAudio, claim, play };
}
afterEach(() => vi.useRealTimers());
it('prepares decoded audio before a gesture and running gestures do not call resume again', async () => {
  const f = fixture();
  f.player.prepare(['voice']);
  await vi.runAllTimersAsync();
  await f.player.unlock(['voice']);
  await f.player.unlock(['voice']);
  await f.play('first', 'speech', 'voice');
  await f.play('next', 'speech', 'voice');
  expect(f.fetchAudio).toHaveBeenCalledTimes(1);
  expect(f.context.decodeAudioData).toHaveBeenCalledTimes(1);
  expect(f.context.resume).not.toHaveBeenCalled();
});
it('shares a trusted pending unlock and starts the full phrase from zero after a short preparation', async () => {
  const f = fixture();
  const resume = deferred<void>();
  f.context.state = 'suspended';
  f.context.resume.mockImplementation(() => resume.promise);
  const unlock = f.player.unlock(['voice']);
  const result = f.play('voice', 'speech');
  await vi.advanceTimersByTimeAsync(120);
  f.context.state = 'running';
  resume.resolve(undefined);
  await unlock;
  expect((await result).status).toBe('started');
  expect(f.sources[0]!.start).toHaveBeenCalledWith(0, 0);
  expect(f.context.resume).toHaveBeenCalledTimes(1);
});
it('a later activating gesture retries a resume blocked before user activation', async () => {
  const f = fixture();
  const blocked = deferred<void>();
  f.context.state = 'suspended';
  f.context.resume
    .mockImplementationOnce(() => blocked.promise)
    .mockImplementationOnce(async () => {
      f.context.state = 'running';
      blocked.resolve(undefined);
    });
  const early = f.player.unlock(['voice']);
  const waitingEvent = f.play('waiting-event', 'speech', 'voice');
  const activating = f.player.unlock(['voice']);
  expect(f.context.resume).toHaveBeenCalledTimes(2);
  await Promise.all([early, activating]);
  expect((await waitingEvent).status).toBe('started');
  expect((await f.play('new-event', 'speech', 'voice')).status).toBe('started');
  expect(f.sources[0]!.start).toHaveBeenCalledWith(0, 0);
});
it('three effects overlap and the fourth stops only the oldest effect while speech stays independent', async () => {
  const f = fixture();
  await f.player.unlock([]);
  await f.play('one');
  await f.play('two');
  await f.play('three');
  await f.play('speech', 'speech');
  await f.play('four');
  expect(f.sources).toHaveLength(5);
  expect(f.sources[0]!.stop).toHaveBeenCalledTimes(1);
  for (const source of f.sources.slice(1))
    expect(source.stop).not.toHaveBeenCalled();
});
it('new speech retires only old speech, ducks effects30%, and an old ended callback cannot restore gain', async () => {
  const f = fixture();
  await f.player.unlock([]);
  await f.play('effect');
  await f.play('old', 'speech');
  const oldEnded = f.sources[1]!.onended!;
  await f.play('new', 'speech');
  expect(f.sources[0]!.stop).not.toHaveBeenCalled();
  expect(f.sources[1]!.stop).toHaveBeenCalledTimes(1);
  const fx = f.gains[0]!;
  expect(fx.linearRampToValueAtTime).toHaveBeenLastCalledWith(
    0.3,
    expect.any(Number),
  );
  const count = fx.linearRampToValueAtTime.mock.calls.length;
  oldEnded();
  expect(fx.linearRampToValueAtTime).toHaveBeenCalledTimes(count);
  f.sources[2]!.onended!();
  expect(fx.linearRampToValueAtTime).toHaveBeenLastCalledWith(
    1,
    expect.any(Number),
  );
});
it('a slow older speech decode cannot play after newer speech and fourth-shot eviction cancels pending audio', async () => {
  const f = fixture();
  const slow = deferred<ArrayBuffer>();
  f.fetchAudio.mockImplementation((url) =>
    url === 'slow' ? slow.promise : Promise.resolve(new ArrayBuffer(8)),
  );
  await f.player.unlock([]);
  const old = f.play('old', 'speech', 'slow');
  await f.play('new', 'speech');
  const oldestShot = f.play('pending', 'shot', 'slow');
  await f.play('two');
  await f.play('three');
  await f.play('four');
  slow.resolve(new ArrayBuffer(8));
  expect((await old).status).toBe('cancelled');
  expect((await oldestShot).status).toBe('cancelled');
  expect(f.claim).not.toHaveBeenCalledWith('old');
  expect(f.claim).not.toHaveBeenCalledWith('pending');
  expect(f.sources).toHaveLength(4);
});
it('a slow native claim expires after300ms and its late result never starts historical audio', async () => {
  const f = fixture();
  const pending = deferred<boolean>();
  f.claim.mockImplementation(() => pending.promise);
  await f.player.unlock([]);
  const play = f.play('expired', 'speech');
  await vi.advanceTimersByTimeAsync(301);
  expect((await play).status).toBe('deadline');
  pending.resolve(true);
  await vi.runAllTimersAsync();
  expect(f.sources).toHaveLength(0);
});
it('unavailable gesture/background ownership never queues sounds and reset cancels pending work', async () => {
  const f = fixture();
  f.context.state = 'suspended';
  f.player.prepare([]);
  expect((await f.play('no-gesture', 'speech')).status).toBe('unavailable');
  f.context.state = 'running';
  await f.player.unlock([]);
  const bytes = deferred<ArrayBuffer>();
  f.fetchAudio.mockImplementation(() => bytes.promise);
  const work = f.play('pending');
  f.player.stop();
  bytes.resolve(new ArrayBuffer(8));
  expect((await work).status).toBe('cancelled');
  f.player.setOwner(false);
  expect((await f.play('not-owner')).status).toBe('unavailable');
  expect(f.sources).toHaveLength(0);
});
it('an independently ended effect does not stop its peers or the current speech', async () => {
  const f = fixture();
  await f.player.unlock([]);
  await f.play('one');
  await f.play('two');
  await f.play('speech', 'speech');
  f.sources[0]!.onended!();
  f.player.stopEvent('two');
  expect(f.sources[1]!.stop).toHaveBeenCalledTimes(1);
  expect(f.sources[2]!.stop).not.toHaveBeenCalled();
});
it('the shared limiter curve is finite, symmetric and bounded below full scale', () => {
  const curve = interactionLimiterCurve();
  expect([...curve].every(Number.isFinite)).toBe(true);
  expect(Math.max(...curve)).toBeLessThan(1);
  expect(Math.min(...curve)).toBeGreaterThan(-1);
  expect(curve[0]).toBeCloseTo(-curve[curve.length - 1]!);
});
