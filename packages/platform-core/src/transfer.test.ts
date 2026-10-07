import { afterEach, expect, it, vi } from 'vitest';
import type { Command } from '@tablemax/protocol';
import { RoomCoordinator, token } from './room';
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
function command(
  room: RoomCoordinator,
  value: Command['command'],
  credential = room.hostToken,
) {
  const view = room.view(credential);
  return room.command(credential, {
    actionId: token(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: value,
  });
}
async function setup() {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  const a = await room.join('甲', token());
  const b = await room.join('乙', token());
  const seatId = room.view(a.token).self.seatId!;
  await command(room, { type: 'set-owner', seatId });
  return { repository, room, a, b, seatId };
}
afterEach(() => vi.restoreAllMocks());

it('supports ended games and expires the recovery receipt without expiring the new device', async () => {
  const { room, a, b, seatId, repository } = await setup();
  await command(room, { type: 'ready', ready: true }, a.token);
  await command(room, { type: 'ready', ready: true }, b.token);
  await command(room, { type: 'start' });
  await command(room, { type: 'end' });
  const before = room.view(a.token);
  const key = token();
  const pending = await room.requestTransfer(seatId, key);
  expect(
    (
      await command(room, {
        type: 'approve-transfer',
        requestId: pending.requestId,
      })
    ).ok,
  ).toBe(true);
  const approved = room.transferStatus(key);
  if (approved.status !== 'approved') throw new Error('not approved');
  const restored = new RoomCoordinator(rules, bot, repository);
  expect(restored.transferStatus(key)).toEqual(approved);
  const after = restored.view(approved.token);
  expect(after.status).toBe('ended');
  expect(after.ownerSeatId).toBe(before.ownerSeatId);
  expect(after.gameView).toEqual(before.gameView);
  vi.spyOn(Date, 'now').mockReturnValue(approved.expiresAt + 1);
  expect(restored.transferStatus(key).status).toBe('expired');
  const identity = restored.identity(approved.token);
  if (identity.role !== 'player') throw new Error('not a player');
  expect(identity.seatId).toBe(seatId);
  expect(() => restored.identity(a.token)).toThrow('invalid-identity');
});

it('rotates only the approved device, preserves a playing owner and isolates pending secrets', async () => {
  const { repository, room, a, b, seatId } = await setup();
  await command(room, { type: 'ready', ready: true }, a.token);
  await command(room, { type: 'ready', ready: true }, b.token);
  await command(room, { type: 'start' });
  const original = room.view(a.token);
  const key = token();
  const request = await room.requestTransfer(seatId, key);
  expect(await room.requestTransfer(seatId, key)).toEqual(request);
  expect(room.view().transferRequests).toBeUndefined();
  expect(room.view(a.token).transferRequests).toBeUndefined();
  expect(room.view(room.hostToken).transferRequests).toHaveLength(1);
  expect(room.transferStatus(key).status).toBe('pending');
  expect(room.transferStatus(key)).not.toHaveProperty('token');
  const serialized = JSON.stringify(repository.value);
  expect(serialized).not.toContain(key);
  expect(serialized).not.toContain(a.token);
  expect(
    (
      await command(
        room,
        { type: 'approve-transfer', requestId: request.requestId },
        a.token,
      )
    ).ok,
  ).toBe(false);
  expect(
    (
      await command(room, {
        type: 'approve-transfer',
        requestId: request.requestId,
      })
    ).ok,
  ).toBe(true);
  const result = room.transferStatus(key);
  expect(result.status).toBe('approved');
  if (result.status !== 'approved') throw new Error('not approved');
  expect(() => room.view(a.token)).toThrow('invalid-identity');
  expect(room.view(b.token).self.seatId).toBe(original.seats[1]!.id);
  const after = room.view(result.token);
  expect(after.self).toEqual(original.self);
  expect(after.ownerSeatId).toBe(seatId);
  expect(after.capabilities).toEqual(original.capabilities);
  expect(after.seats).toEqual(original.seats);
  expect(after.gameView).toEqual(original.gameView);
  expect(after.paused).toBe(false);
  expect(repository.value!.history).toHaveLength(0);
  const restarted = new RoomCoordinator(rules, bot, repository);
  expect(restarted.transferStatus(key)).toEqual(result);
  expect(() => restarted.identity(a.token)).toThrow('invalid-identity');
  expect(restarted.view(result.token).self.seatId).toBe(seatId);
});

it('does not revoke a credential on failed approval and recovers a lost approval reply once', async () => {
  const { repository, room, a, seatId } = await setup();
  const key = token();
  const request = await room.requestTransfer(seatId, key);
  const view = room.view(room.hostToken);
  const envelope = {
    actionId: token(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: {
      type: 'approve-transfer' as const,
      requestId: request.requestId,
    },
  };
  repository.fail = true;
  expect(await room.command(room.hostToken, envelope)).toEqual({
    ok: false,
    reason: 'save-or-action-failed',
  });
  expect(room.identity(a.token).role).toBe('player');
  expect(room.transferStatus(key).status).toBe('pending');
  repository.fail = false;
  const accepted = await room.command(room.hostToken, envelope);
  expect(accepted.ok).toBe(true);
  expect(await room.command(room.hostToken, envelope)).toEqual(accepted);
  const result = room.transferStatus(key);
  expect(JSON.stringify(repository.value)).not.toContain(
    result.status === 'approved' ? result.token : 'missing',
  );
});

it('handles cancellation, rejection, expiration, races, deleted seats and legacy saves', async () => {
  const { repository, room, a, seatId } = await setup();
  const canceled = token();
  await room.requestTransfer(seatId, canceled);
  expect((await room.cancelTransfer(canceled)).status).toBe('cancelled');
  const rejected = token();
  const rejectRequest = await room.requestTransfer(seatId, rejected);
  await command(room, {
    type: 'reject-transfer',
    requestId: rejectRequest.requestId,
  });
  expect(room.transferStatus(rejected).status).toBe('rejected');
  const expired = token();
  const expiryRequest = await room.requestTransfer(seatId, expired);
  const realNow = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(realNow + 5 * 60_000 + 1);
  expect(room.transferStatus(expired).status).toBe('expired');
  expect(
    (
      await command(room, {
        type: 'approve-transfer',
        requestId: expiryRequest.requestId,
      })
    ).ok,
  ).toBe(false);
  vi.restoreAllMocks();
  const first = token(),
    second = token();
  const firstRequest = await room.requestTransfer(seatId, first);
  const secondRequest = await room.requestTransfer(seatId, second);
  await command(room, {
    type: 'approve-transfer',
    requestId: firstRequest.requestId,
  });
  expect(room.transferStatus(second).status).toBe('revoked');
  expect(
    (
      await command(room, {
        type: 'approve-transfer',
        requestId: secondRequest.requestId,
      })
    ).ok,
  ).toBe(false);
  expect(() => room.identity(a.token)).toThrow('invalid-identity');
  await command(room, { type: 'remove-seat', seatId });
  expect(room.transferStatus(first).status).toBe('revoked');
  delete repository.value!.transferRequests;
  const legacy = new RoomCoordinator(rules, bot, repository);
  expect(legacy.view(legacy.hostToken).transferRequests).toEqual([]);
});

it('does not restore revoked devices through rollback or subsequent replacement', async () => {
  const { room, a, b, seatId } = await setup();
  await command(room, { type: 'ready', ready: true }, a.token);
  await command(room, { type: 'ready', ready: true }, b.token);
  await command(room, { type: 'start' });
  const acting = [a.token, b.token].find(
    (credential) => room.view(credential).actions.length,
  )!;
  const view = room.view(acting);
  await command(
    room,
    {
      type: 'game',
      decisionId: view.decisionId!,
      action: view.actions[0] as never,
    },
    acting,
  );
  const checkpointId = room.view(room.hostToken).history[0]!.id;
  const key = token();
  const request = await room.requestTransfer(seatId, key);
  await command(room, {
    type: 'approve-transfer',
    requestId: request.requestId,
  });
  const result = room.transferStatus(key);
  if (result.status !== 'approved') throw new Error('not approved');
  await command(room, { type: 'rollback', checkpointId });
  expect(() => room.identity(a.token)).toThrow('invalid-identity');
  expect(room.identity(result.token).role).toBe('player');
  const nextKey = token();
  const next = await room.requestTransfer(seatId, nextKey);
  await command(room, { type: 'approve-transfer', requestId: next.requestId });
  expect(room.transferStatus(key).status).toBe('revoked');
});
