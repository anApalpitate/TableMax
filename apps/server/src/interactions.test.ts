import { afterEach, expect, it, vi } from 'vitest';
import { InteractionDispatcher } from './interactions';
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
  const dispatcher = new InteractionDispatcher(
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
  return { dispatcher, events, request, context, revoked };
}
afterEach(() => vi.useRealTimers());

it('immediately publishes every new mixed interaction across players without waiting or cooldown timers', () => {
  const { dispatcher, events, request } = fixture();
  const speech = { type: 'speech', phraseId: 'nice' } as const;
  for (let id = 1; id <= 8; id++) {
    const input = request(id, id % 2 ? undefined : speech);
    const actor = id % 2 ? 'a' : 'b';
    const reply = dispatcher.send(actor, input);
    expect(reply).toEqual({ ok: true, eventId: events.at(-1)!.eventId });
    expect(events).toHaveLength(id);
    expect(events.at(-1)).toMatchObject({ ...input, actorSeatId: actor });
  }
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(60_000);
  expect(events).toHaveLength(8);
  dispatcher.dispose();
});

it('returns an old acknowledgement without publishing it again after a newer event and rejects changed payloads', () => {
  const { dispatcher, events, request } = fixture();
  const original = dispatcher.send('a', request(1));
  const newer = dispatcher.send(
    'b',
    request(2, { type: 'speech', phraseId: 'carry' }),
  );
  expect(dispatcher.send('a', request(1))).toEqual(original);
  expect(
    dispatcher.send('b', request(2, { type: 'speech', phraseId: 'carry' })),
  ).toEqual(newer);
  expect(
    dispatcher.send('a', request(1, { type: 'speech', phraseId: 'carry' })),
  ).toEqual({
    ok: false,
    reason: 'invalid-message',
  });
  expect(events).toHaveLength(2);
  expect(events.at(-1)!.eventId).toBe(newer.ok ? newer.eventId : undefined);
  dispatcher.dispose();
});

it('keeps recent retries idempotent during sustained sends without imposing a queue capacity', () => {
  const { dispatcher, events, request } = fixture();
  const recent = new Map<number, ReturnType<typeof dispatcher.send>>();
  for (let id = 1; id <= 300; id++)
    recent.set(id, dispatcher.send('a', request(id)));
  expect(events).toHaveLength(300);
  for (let id = 45; id <= 300; id++)
    expect(dispatcher.send('a', request(id))).toEqual(recent.get(id));
  expect(events).toHaveLength(300);
  expect(vi.getTimerCount()).toBe(0);
  dispatcher.dispose();
});

it('retains the complete speech duration as client playback metadata without holding the next event', () => {
  const { dispatcher, events, request } = fixture();
  const speech = { type: 'speech', phraseId: 'shameless' } as const;
  dispatcher.send('a', request(1, speech));
  dispatcher.send('b', request(2));
  expect(events).toHaveLength(2);
  expect(events[0]!.durationMs).toBe(interactionDuration(speech));
  expect(events[1]!.requestId).toBe(request(2).requestId);
  expect(vi.getTimerCount()).toBe(0);
  dispatcher.dispose();
});

it('rechecks credentials before old acknowledgements and derives each author from the current identity', () => {
  const { dispatcher, events, request, revoked } = fixture();
  dispatcher.send('a', request(1));
  revoked.add('a');
  expect(dispatcher.send('a', request(1))).toEqual({
    ok: false,
    reason: 'invalid-identity',
  });
  expect(dispatcher.send('a', request(2))).toEqual({
    ok: false,
    reason: 'invalid-identity',
  });
  expect(dispatcher.send('replacement', request(1)).ok).toBe(true);
  expect(events.map((event) => event.actorSeatId)).toEqual([
    'a',
    'replacement',
  ]);
  dispatcher.dispose();
});

it('clears receipts on branch changes and rejects stale requests before accepting the new branch', () => {
  const { dispatcher, events, request, context } = fixture();
  const old = request(1);
  const reply = dispatcher.send('a', old);
  expect(dispatcher.synchronize()).toBe(false);
  context.branch++;
  expect(dispatcher.synchronize()).toBe(true);
  expect(dispatcher.send('a', old)).toEqual({
    ok: false,
    reason: 'stale-branch',
  });
  const current = dispatcher.send('a', request(1));
  expect(current.ok).toBe(true);
  expect(current).not.toEqual(reply);
  vi.advanceTimersByTime(60_000);
  expect(events).toHaveLength(2);
  dispatcher.dispose();
});

it('automatically clears receipts when a room or game instance changes', () => {
  const { dispatcher, events, request, context } = fixture();
  const old = request(1);
  const original = dispatcher.send('a', old);
  context.instanceId = '11111111-1111-4111-8111-111111111111';
  expect(dispatcher.send('a', old)).toEqual({
    ok: false,
    reason: 'stale-instance',
  });
  const next = dispatcher.send('a', request(1));
  expect(next.ok).toBe(true);
  expect(next).not.toEqual(original);
  expect(events).toHaveLength(2);
  expect(events[1]!.instanceId).toBe(context.instanceId);
  dispatcher.dispose();
});

it('disallows host and public senders and stops publishing after disposal', () => {
  const { dispatcher, events, request } = fixture();
  expect(dispatcher.send(undefined, request(1))).toEqual({
    ok: false,
    reason: 'unauthorized',
  });
  expect(dispatcher.send('host', request(1))).toEqual({
    ok: false,
    reason: 'unauthorized',
  });
  dispatcher.send('a', request(1));
  dispatcher.dispose();
  expect(dispatcher.send('a', request(1))).toEqual({
    ok: false,
    reason: 'invalid-message',
  });
  expect(dispatcher.send('b', request(2))).toEqual({
    ok: false,
    reason: 'invalid-message',
  });
  vi.advanceTimersByTime(60_000);
  expect(events).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('rejects untrusted fields, arbitrary assets, invalid coordinates and nonfinite numbers', () => {
  const { dispatcher, request, events } = fixture();
  for (const point of [
    { x: -1, y: 0 },
    { x: 0, y: 2 },
    { x: NaN, y: 0 },
    { x: 0, y: Infinity },
  ])
    expect(
      dispatcher.send('a', {
        ...request(1),
        interaction: { type: 'shot', effectId: 'egg', point },
      }).ok,
    ).toBe(false);
  expect(dispatcher.send('a', { ...request(1), actorSeatId: 'b' }).ok).toBe(
    false,
  );
  expect(
    dispatcher.send('a', {
      ...request(1),
      interaction: { type: 'speech', phraseId: 'https://example.com/audio' },
    }).ok,
  ).toBe(false);
  expect(events).toHaveLength(0);
  dispatcher.dispose();
});
