import { afterEach, expect, it, vi } from 'vitest';
import { InteractionQueue } from './interactions';
import {
  interactionDuration,
  type InteractionEvent,
  type InteractionPayload,
} from '@tablemax/protocol';
const instanceId = '00000000-0000-4000-8000-000000000001';
function fixture() {
  vi.useFakeTimers();
  const context = { instanceId, branch: 0 };
  const revoked = new Set<string>();
  const events: InteractionEvent[] = [];
  const queue = new InteractionQueue(
    {
      interactionContext: () => ({ ...context }),
      identity: (credential) => {
        if (revoked.has(credential ?? '')) throw new Error('invalid-identity');
        return credential === 'host'
          ? { role: 'host' }
          : credential
            ? { role: 'player', seatId: credential }
            : { role: 'public' };
      },
    },
    (event) => events.push(event),
  );
  const request = (
    id: number,
    interaction: InteractionPayload = {
      type: 'shot',
      effectId: 'egg',
      point: { x: 0.2, y: 0.8 },
    },
  ) => ({
    ...context,
    requestId: id.toString(16).padStart(32, '0'),
    interaction,
  });
  return { queue, events, request, context, revoked };
}
afterEach(() => vi.useRealTimers());
it('accepts one playing and three waiting across players, rejects the fifth, and preserves mixed FIFO with the 200ms gap', () => {
  const { queue, events, request } = fixture();
  const speech = { type: 'speech', phraseId: 'nice' } as const;
  expect(queue.send('a', request(1)).ok).toBe(true);
  expect(queue.send('b', request(2, speech)).ok).toBe(true);
  expect(queue.send('a', request(3)).ok).toBe(true);
  expect(queue.send('b', request(4)).ok).toBe(true);
  expect(queue.send('c', request(5))).toEqual({
    ok: false,
    reason: 'queue-full',
  });
  expect(events).toHaveLength(1);
  vi.advanceTimersByTime(events[0]!.durationMs + 199);
  expect(events).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(events[1]!.interaction).toEqual(speech);
  vi.advanceTimersByTime(interactionDuration(speech) + 200);
  expect(events[2]!.requestId).toBe(request(3).requestId);
  queue.dispose();
});
it('deduplicates acknowledgements and rejects changed payloads for the same request number', () => {
  const { queue, events, request } = fixture();
  const original = queue.send('a', request(1));
  expect(queue.send('a', request(1))).toEqual(original);
  expect(
    queue.send('a', request(1, { type: 'speech', phraseId: 'carry' })),
  ).toEqual({ ok: false, reason: 'invalid-message' });
  expect(events).toHaveLength(1);
  queue.dispose();
});
it('uses the complete longer speech duration and clears a new room instance', () => {
  const { queue, events, request, context } = fixture();
  queue.send('a', request(1, { type: 'speech', phraseId: 'shameless' }));
  queue.send('b', request(2));
  expect(events[0]!.durationMs).toBe(4352);
  vi.advanceTimersByTime(4551);
  expect(events).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(events).toHaveLength(2);
  queue.send('a', request(3));
  context.instanceId = '11111111-1111-4111-8111-111111111111';
  expect(queue.synchronize()).toBe(true);
  vi.advanceTimersByTime(60000);
  expect(events).toHaveLength(2);
  queue.dispose();
});
it('rechecks queued credentials and skips revoked authors without an extra cooldown', () => {
  const { queue, events, request, revoked } = fixture();
  queue.send('a', request(1));
  queue.send('b', request(2));
  queue.send('c', request(3));
  revoked.add('b');
  vi.advanceTimersByTime(events[0]!.durationMs + 200);
  expect(events.map((e) => e.actorSeatId)).toEqual(['a', 'c']);
  expect(queue.send('b', request(4))).toEqual({
    ok: false,
    reason: 'invalid-identity',
  });
  queue.dispose();
});
it('clears timers and waiting effects on branch changes, rejects stale context and disallows host/public senders', () => {
  const { queue, events, request, context } = fixture();
  expect(queue.send(undefined, request(1)).ok).toBe(false);
  expect(queue.send('host', request(1)).ok).toBe(false);
  const old = request(3);
  queue.send('a', request(1));
  queue.send('a', request(2));
  context.branch++;
  expect(queue.synchronize()).toBe(true);
  expect(queue.send('a', old)).toEqual({ ok: false, reason: 'stale-branch' });
  vi.advanceTimersByTime(60_000);
  expect(events).toHaveLength(1);
  queue.dispose();
});
it('rejects untrusted fields, arbitrary assets, invalid coordinates and nonfinite numbers', () => {
  const { queue, request, events } = fixture();
  for (const point of [
    { x: -1, y: 0 },
    { x: 0, y: 2 },
    { x: NaN, y: 0 },
    { x: 0, y: Infinity },
  ])
    expect(
      queue.send('a', {
        ...request(1),
        interaction: { type: 'shot', effectId: 'egg', point },
      }).ok,
    ).toBe(false);
  expect(queue.send('a', { ...request(1), actorSeatId: 'b' }).ok).toBe(false);
  expect(
    queue.send('a', {
      ...request(1),
      interaction: { type: 'speech', phraseId: 'https://example.com/audio' },
    }).ok,
  ).toBe(false);
  expect(events).toHaveLength(0);
  queue.dispose();
});
