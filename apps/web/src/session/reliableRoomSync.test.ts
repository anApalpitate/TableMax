import { describe, expect, it, vi } from 'vitest';
import {
  ReliableRoomSync,
  type RoomSyncReply,
  type RoomVersion,
  type SyncPhase,
} from './reliableRoomSync';

type View = RoomVersion & { visible: string };
const view = (instanceId = 'game-a', revision = 1, branch = 0): View => ({
  instanceId,
  revision,
  branch,
  visible: `${instanceId}:${revision}`,
});
function setup(now = () => Date.now()) {
  const replies: Array<
    (error: Error | null, reply: RoomSyncReply<View> | null) => void
  > = [];
  const applied: Array<{ view: View; restoring: boolean }> = [];
  const phases: SyncPhase[] = [];
  const reconnect = vi.fn();
  const rejected = vi.fn();
  let connected = true;
  const sync = new ReliableRoomSync<View>({
    connected: () => connected,
    request: (receive) => replies.push(receive),
    apply: (next, _source, restoring) =>
      applied.push({ view: next, restoring }),
    phase: (phase) => phases.push(phase),
    reconnect,
    rejected,
    now,
  });
  return {
    sync,
    replies,
    applied,
    phases,
    reconnect,
    rejected,
    offline: () => {
      connected = false;
    },
  };
}

describe('authorized room synchronization', () => {
  it('does not become ready until a complete view is confirmed and coalesces wake events', () => {
    const state = setup();
    state.sync.transportConnected();
    state.sync.observe(view());
    state.sync.request(true);
    state.sync.request(true);
    expect(state.replies).toHaveLength(1);
    expect(state.sync.ready).toBe(false);
    state.replies[0]!(null, { ok: true, view: view() });
    expect(state.sync.ready).toBe(true);
    expect(state.applied.every((item) => item.restoring)).toBe(true);
  });

  it('reconnects a falsely live transport after an unconfirmed sync and ignores its late response', () => {
    const state = setup();
    state.sync.transportConnected();
    const oldReceive = state.replies[0]!;
    oldReceive(new Error('timeout'), null);
    expect(state.reconnect).toHaveBeenCalledOnce();
    expect(state.sync.ready).toBe(false);
    state.sync.transportConnected();
    oldReceive(null, { ok: true, view: view('game-a', 9) });
    expect(state.applied).toEqual([]);
    state.replies[1]!(null, { ok: true, view: view('game-a', 10) });
    expect(state.sync.ready).toBe(true);
    expect(state.applied.at(-1)?.view.revision).toBe(10);
  });

  it('recovers immediately when a wake event precedes an expired background timeout task', () => {
    let now = 0;
    const state = setup(() => now);
    state.sync.transportConnected();
    now = 6000;
    state.sync.request(true);
    expect(state.reconnect).toHaveBeenCalledOnce();
    state.replies[0]!(null, { ok: true, view: view() });
    expect(state.sync.ready).toBe(false);
    expect(state.applied).toEqual([]);
  });

  it('keeps a saved update newer than the sync snapshot without replaying presentation', () => {
    const state = setup();
    state.sync.transportConnected();
    state.sync.observe(view('game-a', 4));
    state.replies[0]!(null, { ok: true, view: view('game-a', 3) });
    expect(state.sync.ready).toBe(true);
    expect(state.applied.map((item) => item.view.revision)).toEqual([4]);
    state.sync.observe(view('game-a', 5));
    expect(state.applied.at(-1)?.restoring).toBe(false);
  });

  it('keeps connection and management changes streamed at the same game revision', () => {
    const state = setup();
    state.sync.transportConnected();
    state.sync.observe({ ...view(), visible: 'seat offline' });
    state.replies[0]!(null, {
      ok: true,
      view: { ...view(), visible: 'seat online' },
    });
    expect(state.sync.ready).toBe(true);
    expect(state.applied.at(-1)?.view.visible).toBe('seat offline');
    state.sync.observe({ ...view(), visible: 'replacement waiting' });
    expect(state.applied.at(-1)?.view.visible).toBe('replacement waiting');
  });

  it('cannot restore an old branch or game instance from a delayed confirmation', () => {
    const state = setup();
    state.sync.transportConnected();
    state.sync.observe(view('game-a', 8, 1));
    state.replies[0]!(null, { ok: true, view: view('game-a', 7, 0) });
    expect(state.sync.ready).toBe(false);
    expect(state.replies).toHaveLength(2);
    state.sync.observe(view('game-b', 0, 0));
    state.replies[1]!(null, { ok: true, view: view('game-a', 9, 1) });
    expect(state.sync.ready).toBe(false);
    expect(state.replies).toHaveLength(3);
    expect(state.applied.map((item) => item.view.instanceId)).toEqual([
      'game-a',
      'game-b',
    ]);
    state.replies[2]!(null, { ok: true, view: view('game-b', 0, 0) });
    state.sync.observe(view('game-a', 20, 2));
    expect(state.applied.at(-1)?.view.instanceId).toBe('game-b');
    expect(state.sync.ready).toBe(true);
  });

  it('does not lock healthy periodic checks, but a wake check waits for confirmation', () => {
    const state = setup();
    state.sync.transportConnected();
    state.replies[0]!(null, { ok: true, view: view() });
    state.sync.request();
    expect(state.sync.ready).toBe(true);
    state.sync.request(true);
    expect(state.sync.ready).toBe(false);
    expect(state.replies).toHaveLength(2);
    state.replies[1]!(null, { ok: true, view: view() });
    expect(state.sync.ready).toBe(true);
  });

  it('ignores a first delayed snapshot when the stream has already introduced another instance', () => {
    const state = setup();
    state.sync.transportConnected();
    state.sync.observe(view('game-b', 0));
    state.replies[0]!(null, { ok: true, view: view('game-a', 40) });
    expect(state.sync.ready).toBe(false);
    expect(state.applied.map((item) => item.view.instanceId)).toEqual([
      'game-b',
    ]);
    state.replies[1]!(null, { ok: true, view: view('game-b', 1) });
    expect(state.sync.ready).toBe(true);
  });

  it('rejects revoked credentials and makes disposal invalidate pending replies', () => {
    const state = setup();
    state.sync.transportConnected();
    state.replies[0]!(null, { ok: false, reason: 'invalid-identity' });
    expect(state.rejected).toHaveBeenCalledWith('invalid-identity');
    expect(state.sync.ready).toBe(false);
    state.sync.transportConnected();
    state.sync.dispose();
    state.replies[1]!(null, { ok: true, view: view() });
    expect(state.applied).toEqual([]);
  });
});
