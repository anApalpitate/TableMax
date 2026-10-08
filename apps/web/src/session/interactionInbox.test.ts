import { describe, expect, it } from 'vitest';
import type { InteractionEvent } from '@tablemax/protocol';
import { InteractionInbox } from './interactionInbox';
import type { RoomProjection, RoomVersion } from './reliableRoomSync';
const projection = (
  seq = 1,
  branch = 0,
  watermark = 0,
  serverSessionId = 'service-a',
): RoomProjection<RoomVersion> => ({
  stamp: { serverSessionId, instanceId: 'room-a', branch, viewSeq: seq },
  syncHint: 'active',
  interactionWatermark: watermark,
  view: { instanceId: 'room-a', branch, revision: seq },
});
const event = (
  seq = 1,
  branch = 0,
  serverSessionId = 'service-a',
): InteractionEvent => ({
  eventId: `${serverSessionId}:${branch}:${seq}`,
  requestId: String(seq),
  actorSeatId: 'seat-a',
  serverSessionId,
  instanceId: 'room-a',
  branch,
  interactionSeq: seq,
  durationMs: 1000,
  interaction: { type: 'shot', effectId: 'egg', point: { x: 0.5, y: 0.5 } },
});
describe('ephemeral interaction recovery', () => {
  it('consumes each event once without coalescing successive arrivals', () => {
    const inbox = new InteractionInbox();
    inbox.setContext(projection().stamp);
    expect([1, 2, 3].map((seq) => inbox.receive(event(seq), true))).toEqual([
      true,
      true,
      true,
    ]);
    expect(inbox.receive(event(2), true)).toBe(false);
  });
  it('does not retire live interactions on healthy audits', () => {
    const inbox = new InteractionInbox();
    inbox.setContext(projection().stamp);
    expect(inbox.receive(event(1), true)).toBe(true);
    inbox.setContext(projection(2, 0, 8).stamp);
    expect(inbox.receive(event(2), true)).toBe(true);
  });
  it('retires the recovery watermark and events consumed while hidden or unconfirmed', () => {
    const inbox = new InteractionInbox();
    inbox.restore(projection(1, 0, 10));
    expect(inbox.receive(event(9), true)).toBe(false);
    expect(inbox.receive(event(11), true)).toBe(true);
    expect(inbox.receive(event(12), false)).toBe(false);
    inbox.restore(projection(2, 0, 11));
    expect(inbox.receive({ ...event(12), eventId: 'late packet' }, true)).toBe(
      false,
    );
    expect(inbox.receive(event(13), true)).toBe(true);
  });
  it('ignores old branches and service sessions without poisoning a new context', () => {
    const inbox = new InteractionInbox();
    inbox.restore(projection(2, 1, 0, 'service-b'));
    expect(inbox.receive(event(100, 0, 'service-a'), true)).toBe(false);
    expect(inbox.receive(event(1, 1, 'service-b'), true)).toBe(true);
    expect(inbox.receive(event(2, 0, 'service-b'), true)).toBe(false);
  });
  it('rejects old sequences after the bounded receipt cache has rotated', () => {
    const inbox = new InteractionInbox();
    inbox.setContext(projection().stamp);
    for (let seq = 1; seq <= 300; seq++)
      expect(inbox.receive(event(seq), true)).toBe(true);
    expect(inbox.receive(event(1), true)).toBe(false);
    expect(inbox.receive(event(301), true)).toBe(true);
  });
});
