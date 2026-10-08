import { expect, it, vi } from 'vitest';
import { InteractionAudioPlayer } from './audio-player';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  let now = 0;
  let allowed = true;
  const starts = vi.fn();
  const stops = vi.fn();
  const claim = vi.fn<(id: string) => Promise<boolean>>(async () => true);
  const fetchAudio = vi.fn<(url: string) => Promise<ArrayBuffer>>(
    async () => new ArrayBuffer(8),
  );
  const context = {
    state: 'running',
    resume: vi.fn(async (): Promise<void> => undefined),
    close: vi.fn(async () => undefined),
    destination: {},
    decodeAudioData: vi.fn(async () => ({ duration: 2 })),
    createBufferSource: vi.fn(() => ({
      connect: vi.fn(),
      start: starts,
      stop: stops,
      buffer: null,
      onended: null,
    })),
  };
  const player = new InteractionAudioPlayer({
    createContext: () => context as unknown as AudioContext,
    fetchAudio,
    claim,
    canPlay: () => allowed,
    now: () => now,
  });
  return {
    player,
    context,
    starts,
    stops,
    claim,
    fetchAudio,
    time: (value: number) => {
      now = value;
    },
    allow: (value: boolean) => {
      allowed = value;
    },
  };
}

it('waits for a phone gesture unlock and uses elapsed time rather than discarding the first speech', async () => {
  const f = fixture();
  const resume = deferred<void>();
  f.context.state = 'suspended';
  f.context.resume.mockImplementation(() => resume.promise);
  const unlocking = f.player.unlock(['speech']);
  const playing = f.player.play('speech', 'first', 0, 2000);
  expect(f.starts).not.toHaveBeenCalled();
  f.time(120);
  f.context.state = 'running';
  resume.resolve(undefined);
  await unlocking;
  await playing;
  expect(f.starts).toHaveBeenCalledWith(0, 0.12, 1.88);
  expect(f.fetchAudio).toHaveBeenCalledTimes(1);
});

it('a slow old decode cannot start or claim after a newer interaction replaces it', async () => {
  const f = fixture();
  const old = deferred<ArrayBuffer>();
  f.fetchAudio.mockImplementation((url) =>
    url === 'old' ? old.promise : Promise.resolve(new ArrayBuffer(8)),
  );
  await f.player.unlock([]);
  const oldPlayback = f.player.play('old', 'old-event', 0, 2000);
  await f.player.play('new', 'new-event', 0, 2000);
  old.resolve(new ArrayBuffer(8));
  await oldPlayback;
  expect(f.starts).toHaveBeenCalledTimes(1);
  expect(f.claim).toHaveBeenCalledTimes(1);
  expect(f.claim).toHaveBeenCalledWith('new-event');
});

it('replacement stops a live source, reuses decoded audio and never starts an expired event', async () => {
  const f = fixture();
  f.player.prepare(['same']);
  await f.player.unlock(['same']);
  await f.player.play('same', 'one', 0, 2000);
  f.time(200);
  await f.player.play('same', 'two', 200, 2000);
  expect(f.stops).toHaveBeenCalledTimes(1);
  expect(f.starts).toHaveBeenCalledTimes(2);
  expect(f.fetchAudio).toHaveBeenCalledTimes(1);
  expect(f.context.decodeAudioData).toHaveBeenCalledTimes(1);
  f.time(2400);
  await f.player.play('same', 'expired', 0, 2000);
  expect(f.starts).toHaveBeenCalledTimes(2);
});

it('blocking during loading cancels the pending sound and recovery only plays a new event', async () => {
  const f = fixture();
  const bytes = deferred<ArrayBuffer>();
  f.fetchAudio.mockImplementation(() => bytes.promise);
  await f.player.unlock([]);
  const pending = f.player.play('speech', 'blocked', 0, 2000);
  f.player.setEnabled(false);
  bytes.resolve(new ArrayBuffer(8));
  await pending;
  expect(f.starts).not.toHaveBeenCalled();
  f.player.setEnabled(true);
  expect(f.starts).not.toHaveBeenCalled();
  await f.player.play('speech', 'future', 0, 2000);
  expect(f.starts).toHaveBeenCalledTimes(1);
});

it('an interrupted native ownership claim cannot restore an older sound', async () => {
  const f = fixture();
  const oldClaim = deferred<boolean>();
  f.claim.mockImplementation((id) =>
    id === 'old' ? oldClaim.promise : Promise.resolve(true),
  );
  await f.player.unlock(['speech']);
  const old = f.player.play('speech', 'old', 0, 2000);
  await vi.waitFor(() => expect(f.claim).toHaveBeenCalledWith('old'));
  await f.player.play('speech', 'new', 0, 2000);
  oldClaim.resolve(true);
  await old;
  expect(f.starts).toHaveBeenCalledTimes(1);
});

it('losing native audio ownership stops playback and rejects later sounds until ownership returns', async () => {
  const f = fixture();
  await f.player.unlock(['speech']);
  await f.player.play('speech', 'one', 0, 2000);
  f.player.setOwner(false);
  expect(f.stops).toHaveBeenCalledTimes(1);
  await f.player.play('speech', 'two', 0, 2000);
  expect(f.starts).toHaveBeenCalledTimes(1);
  f.player.setOwner(true);
  await f.player.play('speech', 'three', 0, 2000);
  expect(f.starts).toHaveBeenCalledTimes(2);
});
