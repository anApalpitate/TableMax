import { it, expect } from 'vitest';
import type { Command } from '@tablemax/protocol';
import { RoomCoordinator, hash, token } from './room';
import type { Save, SaveRepository } from './model';
import { rules, bot } from '../../../games/template';

class Repository implements SaveRepository {
  value: Save | null = null;
  fail = false;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    if (this.fail) throw new Error('disk full');
    this.value = structuredClone(value);
  }
}
function run(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
) {
  const view = room.view(credential);
  return room.command(credential, {
    actionId: token(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  });
}
it('recovers simultaneous and lost join replies after restart without storing plaintext credentials', async () => {
  const repository = new Repository();
  let room = new RoomCoordinator(rules, bot, repository);
  const key = token();
  const replies = await Promise.all([
    room.join('朋友', key),
    room.join('朋友', key),
  ]);
  expect(replies[0]).toEqual(replies[1]);
  expect(room.view().seats).toHaveLength(1);
  const serialized = JSON.stringify(repository.value);
  expect(serialized).not.toContain(replies[0]!.token);
  expect(serialized).not.toContain(key);
  expect(serialized).toContain(hash(key));
  room = new RoomCoordinator(rules, bot, repository);
  expect(await room.join('朋友', key)).toEqual(replies[0]);
  expect(room.view().revision).toBe(1);
  await expect(room.join('另一名字', key)).rejects.toThrow(
    'session-request-conflict',
  );
  await run(room, { type: 'join-open', open: false });
  expect(await room.join('朋友', key)).toEqual(replies[0]);
  await expect(room.join('新人', token())).rejects.toThrow('joining-closed');
});
it('does not occupy a seat when persisting admission fails and can retry the same request', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  const key = token();
  repository.fail = true;
  await expect(room.join('朋友', key)).rejects.toThrow('disk full');
  expect(room.view().seats).toHaveLength(0);
  repository.fail = false;
  const result = await room.join('朋友', key);
  expect(await room.join('朋友', key)).toEqual(result);
  expect(room.view().seats).toHaveLength(1);
});
it('ignores legacy bindings while preserving current phone identity and admission recovery', async () => {
  const repository = new Repository();
  let room = new RoomCoordinator(rules, bot, repository);
  const joinKey = token();
  const original = await room.join('朋友', joinKey);
  const seatId = room.view(original.token).self.seatId!;
  repository.value!.bindings = {
    [hash(token())]: { seatId, expires: Date.now() + 120000 },
  };
  room = new RoomCoordinator(rules, bot, repository);
  expect(room.view(original.token).self.seatId).toBe(seatId);
  expect(await room.join('朋友', joinKey)).toEqual(original);
  const view = room.view(room.hostToken);
  expect(
    await room.command(room.hostToken, {
      actionId: token(),
      instanceId: view.instanceId,
      revision: view.revision,
      branch: view.branch,
      command: { type: 'rebind', seatId },
    }),
  ).toEqual({ ok: false, reason: 'invalid-message' });
  await run(room, { type: 'join-open', open: false });
  expect(repository.value!.bindings).toBeUndefined();
  await run(room, { type: 'remove-seat', seatId });
  await expect(room.join('朋友', joinKey)).rejects.toThrow(
    'session-request-revoked',
  );
});
it('replays with the same ordered seats and identities, fresh readiness and isolated old commands', async () => {
  const repository = new Repository();
  let room = new RoomCoordinator(rules, bot, repository);
  const a = await room.join('甲', token());
  const b = await room.join('乙', token());
  await run(room, { type: 'add-bot', name: '电脑' });
  await run(room, {
    type: 'order',
    seats: room
      .view()
      .seats.map((s) => s.id)
      .reverse(),
  });
  await run(room, { type: 'ready', ready: true }, a.token);
  await run(room, { type: 'ready', ready: true }, b.token);
  await run(room, { type: 'start' });
  const old = room.view(a.token);
  const obsolete = {
    actionId: token(),
    instanceId: old.instanceId,
    revision: old.revision,
    branch: old.branch,
    command: { type: 'ready' as const, ready: true },
  };
  await run(room, { type: 'end' });
  const before = room.view(a.token);
  const request = {
    ...obsolete,
    revision: before.revision,
    command: { type: 'replay' as const },
  };
  expect(await room.command(a.token, request)).toEqual({
    ok: false,
    reason: 'unauthorized',
  });
  const accepted = await room.command(room.hostToken, request);
  expect(accepted.ok).toBe(true);
  expect(await room.command(room.hostToken, request)).toEqual(accepted);
  const after = room.view(a.token);
  expect(after.instanceId).not.toBe(old.instanceId);
  expect(after.gameView).toBeNull();
  expect(after.seats.map((s) => s.id)).toEqual(before.seats.map((s) => s.id));
  expect(after.seats.every((s) => s.ready === (s.controller === 'bot'))).toBe(
    true,
  );
  expect(after.self).toEqual(before.self);
  expect(room.view(room.hostToken).history).toEqual([]);
  expect(await room.command(a.token, obsolete)).toEqual({
    ok: false,
    reason: 'stale-instance',
  });
  room = new RoomCoordinator(rules, bot, repository);
  expect(room.view(a.token).self).toEqual(before.self);
  expect(await run(room, { type: 'start' })).toEqual({
    ok: false,
    reason: 'not-ready',
  });
  await run(room, { type: 'ready', ready: true }, a.token);
  await run(room, { type: 'ready', ready: true }, b.token);
  expect((await run(room, { type: 'start' })).ok).toBe(true);
  await run(room, { type: 'end' });
  await run(room, { type: 'new-room' });
  expect(room.view().seats).toEqual([]);
  expect(() => room.identity(a.token)).toThrow('invalid-identity');
});
it('keeps the finished match intact when replay storage fails', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  const a = await room.join('甲');
  const b = await room.join('乙');
  await run(room, { type: 'ready', ready: true }, a.token);
  await run(room, { type: 'ready', ready: true }, b.token);
  await run(room, { type: 'start' });
  await run(room, { type: 'end' });
  const before = room.view(a.token);
  repository.fail = true;
  expect(await run(room, { type: 'replay' })).toEqual({
    ok: false,
    reason: 'save-or-action-failed',
  });
  expect(room.view(a.token)).toEqual(before);
});
