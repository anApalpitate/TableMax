import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import { fitUnoOnGpu } from '../../../tools/analysis/bots/uno-gpu-fit';

const child = vi.hoisted(() => ({
  fixture: undefined as unknown as {
    once: EventEmitter['once'];
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: EventEmitter & { end: () => void };
    kill: ReturnType<typeof vi.fn>;
  },
}));
vi.mock('node:child_process', () => ({ spawn: () => child.fixture }));

it('interrupts only the owned GPU process when the idle permission is revoked', async () => {
  vi.useFakeTimers();
  try {
    const events = new EventEmitter();
    child.fixture = {
      once: events.once.bind(events),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: Object.assign(new EventEmitter(), { end: () => {} }),
      kill: vi.fn(() => {
        events.emit('close', null);
      }),
    };
    let enabled = true;
    const result = fitUnoOnGpu('fixture.py', '{}', () => {
      if (!enabled) throw new Error('UNO_IDLE_TRAINING_PAUSED');
    });
    const paused = expect(result).rejects.toThrow('UNO_IDLE_TRAINING_PAUSED');
    enabled = false;
    await vi.advanceTimersByTimeAsync(150);
    await paused;
    expect(child.fixture.kill).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
