import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import {
  RoomProjectionSchema,
  RoomProbeReplySchema,
  type Command,
} from '@tablemax/protocol';
import {
  RoomCoordinator,
  type Save,
  type SaveRepository,
} from '@tablemax/platform-core';
import { rules, bot } from '@tablemax/game-template';
import { RoomProjectionState } from './room-projections';

const states: RoomProjectionState[] = [];
afterEach(() => {
  for (const state of states.splice(0)) state.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function fixture() {
  let save: Save | null = null;
  const repository: SaveRepository = {
    load: () => structuredClone(save),
    save: vi.fn((next) => {
      save = structuredClone(next);
    }),
  };
  const calls = {
    decisions: vi.fn(rules.decisions),
    project: vi.fn(rules.project),
    legalActions: vi.fn(rules.legalActions),
  };
  const room = new RoomCoordinator({ ...rules, ...calls }, bot, repository);
  const a = await room.join('甲');
  const b = await room.join('乙');
  let watermark = 0;
  const changed = vi.fn(() => state.advance());
  const state = new RoomProjectionState(room, () => watermark, changed);
  states.push(state);
  room.subscribe(changed);
  const command = (credential: string, command: Command['command']) => {
    const { instanceId, branch, revision } = room.view(credential);
    return room.command(credential, {
      instanceId,
      branch,
      revision,
      actionId: randomUUID(),
      command,
    });
  };
  return {
    room,
    state,
    a,
    b,
    calls,
    changed,
    repository,
    command,
    setWatermark: (next: number) => {
      watermark = next;
    },
  };
}

it('authenticates unchanged probes without calling projection, decisions, legal actions or online enumeration', async () => {
  const { room, state, a, b, calls, command, setWatermark } = await fixture();
  for (const player of [a, b])
    await command(player.token, { type: 'ready', ready: true });
  await command(room.hostToken, { type: 'start' });
  const snapshot = state.project(a.token);
  expect(snapshot.syncHint).toBe('active');
  expect(state.project().syncHint).toBe('active');
  const online = vi.fn(() => new Set<string>());
  const identity = vi.spyOn(room, 'identity');
  const expensiveCalls = Object.values(calls).map(
    (call) => call.mock.calls.length,
  );
  setWatermark(12);
  for (let index = 0; index < 10; index++)
    expect(
      RoomProbeReplySchema.parse(
        state.probe(a.token, { stamp: snapshot.stamp }, online),
      ),
    ).toEqual({
      ok: true,
      unchanged: true,
      stamp: snapshot.stamp,
      syncHint: 'active',
      interactionWatermark: 12,
    });
  expect(identity).toHaveBeenCalledTimes(10);
  expect(online).not.toHaveBeenCalled();
  expect(Object.values(calls).map((call) => call.mock.calls.length)).toEqual(
    expensiveCalls,
  );
  expect(() =>
    state.probe('revoked', { stamp: snapshot.stamp }, online),
  ).toThrow('invalid-identity');
});

it('returns a current authorized projection in one mismatched probe and orders online changes outside game revision', async () => {
  const { room, state, a, command } = await fixture();
  const snapshot = state.project(a.token);
  expect(snapshot.syncHint).toBe('idle');
  const seat = room.view(a.token).self.seatId!;
  state.advance();
  const reply = state.probe(
    a.token,
    { stamp: snapshot.stamp },
    () => new Set([seat]),
  );
  expect(reply).toMatchObject({ ok: true, unchanged: false });
  if (!reply.ok || reply.unchanged)
    throw new Error('Expected repaired projection');
  RoomProjectionSchema.parse({
    stamp: reply.stamp,
    syncHint: reply.syncHint,
    interactionWatermark: reply.interactionWatermark,
    view: reply.view,
  });
  expect(reply.stamp.viewSeq).toBeGreaterThan(snapshot.stamp.viewSeq);
  expect(reply.view.revision).toBe(snapshot.view.revision);
  expect(reply.view.seats.find((value) => value.id === seat)?.online).toBe(
    true,
  );
  await command(a.token, { type: 'ready', ready: true });
  const current = state.project(a.token);
  expect(current.stamp.viewSeq).toBeGreaterThan(reply.stamp.viewSeq);
  expect(current.view.revision).toBeGreaterThan(snapshot.view.revision);
  expect(
    RoomProjectionSchema.safeParse({
      ...current,
      stamp: { ...current.stamp, branch: current.stamp.branch + 1 },
    }).success,
  ).toBe(false);
});

it('invalidates naturally expired transfer projections once without saving or advancing game revision', async () => {
  vi.useFakeTimers();
  const { room, state, a, changed, repository } = await fixture();
  const seatId = room.view(a.token).self.seatId!;
  const transfer = await room.requestTransfer(seatId, 'a'.repeat(64));
  const before = state.project(room.hostToken);
  expect(before.view.transferRequests).toHaveLength(1);
  const saves = vi.mocked(repository.save).mock.calls.length;
  const notifications = changed.mock.calls.length;
  // Simulate wake occurring before the suspended expiry callback runs.
  vi.setSystemTime(transfer.expiresAt + 1);
  const reply = state.probe(
    room.hostToken,
    { stamp: before.stamp },
    () => new Set(),
  );
  expect(reply).toMatchObject({ ok: true, unchanged: false });
  if (!reply.ok || reply.unchanged)
    throw new Error('Expired request did not invalidate view');
  expect(reply.view.transferRequests).toEqual([]);
  expect(reply.view.revision).toBe(before.view.revision);
  expect(reply.stamp.viewSeq).toBe(before.stamp.viewSeq + 1);
  expect(changed).toHaveBeenCalledTimes(notifications + 1);
  expect(
    state.probe(room.hostToken, { stamp: reply.stamp }, () => new Set()),
  ).toMatchObject({ ok: true, unchanged: true });
  expect(changed).toHaveBeenCalledTimes(notifications + 1);
  expect(vi.mocked(repository.save).mock.calls.length).toBe(saves);
  expect(vi.getTimerCount()).toBe(0);
});

it('uses a new service session after restart and does not let old sequence equality skip a full view', async () => {
  const { room, state, a } = await fixture();
  const before = state.project(a.token);
  const restarted = new RoomProjectionState(
    room,
    () => 0,
    () => restarted.advance(),
  );
  states.push(restarted);
  const result = restarted.probe(
    a.token,
    { stamp: before.stamp },
    () => new Set(),
  );
  expect(result).toMatchObject({ ok: true, unchanged: false });
  if (!result.ok) throw new Error('Unexpected failure');
  expect(result.stamp.serverSessionId).not.toBe(before.stamp.serverSessionId);
  expect(result.stamp.instanceId).toBe(before.stamp.instanceId);
});
