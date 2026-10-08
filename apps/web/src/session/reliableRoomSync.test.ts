import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ReliableRoomSync,
  type RoomProjection,
  type RoomSyncReply,
  type RoomVersion,
  type SyncPhase,
  type SyncRequestKind,
  type RoomStamp,
} from './reliableRoomSync';
type View = RoomVersion & { visible: string };
const projection = (
  seq = 1,
  visible = 'table',
  revision = seq,
  branch = 0,
  instanceId = 'game-a',
  serverSessionId = 'server-a',
): RoomProjection<View> => ({
  stamp: { serverSessionId, instanceId, branch, viewSeq: seq },
  syncHint: 'active',
  interactionWatermark: seq,
  view: { instanceId, revision, branch, visible },
});
const disposals: (() => void)[] = [];
function setup() {
  const requests: {
    kind: SyncRequestKind;
    stamp: RoomStamp | null;
    timeout: number;
    receive: (error: Error | null, reply: RoomSyncReply<View> | null) => void;
  }[] = [];
  const applied: { view: View; restoring: boolean }[] = [];
  const phases: SyncPhase[] = [];
  const reconnect = vi.fn();
  const rejected = vi.fn();
  const confirmed = vi.fn();
  const commandReply = vi.fn();
  let hasCommand = false;
  let connected = true;
  const sync = new ReliableRoomSync<View>({
    connected: () => connected,
    request: (kind, stamp, timeout, receive) =>
      requests.push({ kind, stamp, timeout, receive }),
    apply: (view, _source, restoring) => applied.push({ view, restoring }),
    phase: (phase) => phases.push(phase),
    reconnect,
    rejected,
    confirmed,
    commandReply,
    hasCommand: () => hasCommand,
    now: () => Date.now(),
    random: () => 0.5,
  });
  disposals.push(() => sync.dispose());
  const reply = (index: number, next = projection()) =>
    requests[index]!.receive(null, { ok: true, ...next });
  const unchanged = (index: number) =>
    requests[index]!.receive(null, {
      ok: true,
      unchanged: true,
      stamp: sync.stamp!,
      syncHint: 'active',
      interactionWatermark: 999,
    });
  return {
    sync,
    requests,
    applied,
    phases,
    reconnect,
    rejected,
    confirmed,
    commandReply,
    reply,
    unchanged,
    pending: () => {
      hasCommand = true;
    },
    offline: () => {
      connected = false;
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
  vi.useRealTimers();
});

describe('authorized room synchronization', () => {
  it('keeps recovery locked when its snapshot trails an already received same-context view', () => {
    const s = setup();
    s.sync.transportConnected();
    s.reply(0);
    s.sync.request(true);
    s.sync.observe(projection(3, 'newer stream'));
    s.reply(1, projection(2, 'late recovery'));
    expect(s.sync.ready).toBe(false);
    expect(s.applied.at(-1)?.view.visible).toBe('newer stream');
    expect(s.requests[2]!.kind).toBe('full');
    s.reply(2, projection(3, 'confirmed stream'));
    expect(s.sync.ready).toBe(true);
    expect(s.confirmed.mock.calls.at(-1)?.[0].interactionWatermark).toBe(3);
  });
  it('merges a complete command-status projection with a pending full audit', () => {
    const s = setup();
    s.sync.transportConnected();
    s.reply(0);
    s.sync.request();
    s.pending();
    s.sync.queryCommand();
    const index = s.requests.length - 1;
    expect(s.requests[index]!.kind).toBe('command');
    s.requests[index]!.receive(null, {
      ok: true,
      ...projection(2),
      outcome: { status: 'processing' },
    });
    expect(s.requests).toHaveLength(index + 1);
    expect(s.sync.ready).toBe(true);
  });
  it('does not become ready until a complete view is confirmed and coalesces wake events', () => {
    const s = setup();
    s.sync.transportConnected();
    s.sync.observe(projection());
    s.sync.request(true);
    s.sync.request(true);
    expect(s.requests).toHaveLength(1);
    expect(s.sync.ready).toBe(false);
    s.reply(0);
    expect(s.sync.ready).toBe(true);
    expect(s.requests).toHaveLength(1);
    expect(s.applied.every((item) => item.restoring)).toBe(true);
  });
  it('reconnects a falsely live transport after an unconfirmed sync and ignores its late response', () => {
    const s = setup();
    s.sync.transportConnected();
    const old = s.requests[0]!.receive;
    old(new Error('timeout'), null);
    expect(s.reconnect).toHaveBeenCalledWith(500);
    s.sync.transportConnected();
    old(null, { ok: true, ...projection(9) });
    expect(s.applied).toEqual([]);
    s.reply(1, projection(10));
    expect(s.sync.ready).toBe(true);
  });
  it('recovers immediately when a wake event precedes an expired background timeout task', () => {
    const s = setup();
    s.sync.transportConnected();
    vi.setSystemTime(6000);
    s.sync.request(true);
    expect(s.requests).toHaveLength(2);
    s.reply(0, projection(9));
    expect(s.applied).toEqual([]);
    s.reply(1, projection(10));
    expect(s.sync.ready).toBe(true);
  });
  it('keeps a saved update newer than the sync snapshot without replaying presentation', () => {
    const s = setup();
    s.sync.transportConnected();
    s.sync.observe(projection(4));
    s.reply(0, projection(3));
    expect(s.sync.ready).toBe(true);
    expect(s.applied.map((item) => item.view.revision)).toEqual([4]);
    s.sync.observe(projection(5));
    expect(s.applied.at(-1)?.restoring).toBe(false);
  });
  it('keeps connection and management changes streamed at the same game revision', () => {
    const s = setup();
    s.sync.transportConnected();
    s.sync.observe(projection(2, 'seat offline', 1));
    s.reply(0, projection(1, 'seat online', 1));
    expect(s.sync.ready).toBe(true);
    expect(s.applied.at(-1)?.view.visible).toBe('seat offline');
    s.sync.observe(projection(3, 'replacement waiting', 1));
    expect(s.applied.at(-1)?.view.visible).toBe('replacement waiting');
  });
  it('cannot restore an old branch or game instance from a delayed confirmation', () => {
    const s = setup();
    s.sync.transportConnected();
    s.sync.observe(projection(8, 'rollback', 8, 1));
    s.reply(0, projection(7));
    expect(s.sync.ready).toBe(false);
    expect(s.requests).toHaveLength(2);
    s.sync.observe(projection(9, 'new game', 0, 0, 'game-b'));
    s.reply(1, projection(8, 'old game', 9, 1));
    expect(s.requests).toHaveLength(3);
    s.reply(2, projection(10, 'new game', 1, 0, 'game-b'));
    s.sync.observe(projection(7, 'late old', 20, 2));
    expect(s.applied.at(-1)?.view.instanceId).toBe('game-b');
    expect(s.sync.ready).toBe(true);
  });
  it('does not lock healthy periodic checks, but a wake check waits for confirmation', () => {
    const s = setup();
    s.sync.transportConnected();
    s.reply(0);
    s.sync.request();
    expect(s.sync.ready).toBe(true);
    s.sync.request(true);
    expect(s.sync.ready).toBe(false);
    expect(s.requests).toHaveLength(2);
    s.reply(1);
    expect(s.sync.ready).toBe(true);
  });
  it('rejects revoked credentials and makes disposal invalidate pending replies', () => {
    const s = setup();
    s.sync.transportConnected();
    s.requests[0]!.receive(null, { ok: false, reason: 'invalid-identity' });
    expect(s.rejected).toHaveBeenCalledWith('invalid-identity');
    s.sync.transportConnected();
    s.sync.dispose();
    s.reply(1);
    expect(s.applied).toEqual([]);
  });
  it('uses cheap foreground probes and adapts RTT without marking a healthy table as restoring', () => {
    const s = setup();
    s.sync.transportConnected();
    vi.advanceTimersByTime(100);
    s.reply(0);
    for (let i = 1; i <= 4; i++) {
      vi.advanceTimersByTime(500);
      expect(s.requests.at(-1)?.kind).toBe('probe');
      vi.advanceTimersByTime(100);
      s.unchanged(i);
    }
    expect(s.sync.probeTimeout).toBe(1000);
    expect(s.applied).toHaveLength(1);
    expect(
      s.confirmed.mock.calls.slice(1).every((call) => call[1] === false),
    ).toBe(true);
  });
  it('keeps the first probe failure playable, expires the lease, then backs off on a second failure', () => {
    const s = setup();
    s.sync.transportConnected();
    s.reply(0);
    vi.advanceTimersByTime(2000);
    expect(s.requests.map((r) => r.kind)).toEqual(['full', 'probe', 'full']);
    expect(s.sync.ready).toBe(true);
    expect(s.phases.at(-1)).toBe('degraded');
    vi.advanceTimersByTime(1500);
    expect(s.sync.ready).toBe(false);
    expect(s.phases.at(-1)).toBe('syncing');
    expect(s.reconnect).not.toHaveBeenCalled();
    s.requests[2]!.receive(new Error('timeout'), null);
    expect(s.reconnect).toHaveBeenCalledWith(500);
    s.sync.transportConnected();
    s.requests[3]!.receive(new Error('timeout'), null);
    expect(s.reconnect).toHaveBeenLastCalledWith(1000);
  });
  it('prioritizes an unconfirmed command over a routine probe and fences the retired reply', () => {
    const s = setup();
    s.sync.transportConnected();
    s.reply(0);
    vi.advanceTimersByTime(800);
    expect(s.requests[1]!.kind).toBe('probe');
    s.pending();
    s.sync.queryCommand();
    expect(s.requests[2]!.kind).toBe('command');
    s.requests[1]!.receive(null, {
      ok: true,
      ...projection(20, 'retired callback'),
    });
    expect(s.applied.at(-1)?.view.revision).toBe(1);
    s.requests[2]!.receive(null, {
      ok: true,
      ...projection(2),
      outcome: { status: 'processing' },
    });
    expect(s.commandReply).toHaveBeenCalledOnce();
    expect(s.sync.ready).toBe(true);
  });
  it('pauses in the background and confirms a new service session before accepting its stream', () => {
    const s = setup();
    s.sync.transportConnected();
    s.reply(0);
    s.sync.setForeground(false);
    vi.advanceTimersByTime(60000);
    expect(s.requests).toHaveLength(1);
    s.sync.setForeground(true);
    expect(s.requests).toHaveLength(2);
    expect(s.sync.ready).toBe(false);
    s.sync.observe(
      projection(1, 'new service stream', 1, 0, 'game-a', 'server-b'),
    );
    expect(s.applied.at(-1)?.view.visible).toBe('table');
    s.reply(
      1,
      projection(1, 'new service confirmed', 1, 0, 'game-a', 'server-b'),
    );
    expect(s.sync.ready).toBe(true);
    expect(s.applied.at(-1)?.view.visible).toBe('new service confirmed');
  });
  it('performs staggerable full audits at fifteen seconds without cutting live presentation', () => {
    const s = setup();
    s.sync.transportConnected();
    s.reply(0);
    for (let i = 1; i < 30; i++) {
      vi.advanceTimersByTime(500);
      s.unchanged(i);
    }
    vi.advanceTimersByTime(500);
    expect(s.requests.at(-1)?.kind).toBe('full');
    s.reply(30, projection(1, 'fresh clock anchor'));
    expect(s.sync.ready).toBe(true);
    expect(s.applied).toHaveLength(2);
    expect(s.applied.at(-1)?.view.visible).toBe('fresh clock anchor');
    expect(s.applied.at(-1)?.restoring).toBe(false);
    expect(s.confirmed.mock.calls.at(-1)?.[1]).toBe(false);
  });
});
