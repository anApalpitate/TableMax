import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import type { Command } from '@tablemax/protocol';
import { rules, bot } from '../../../games/template';
import { RoomCoordinator } from './room';
import type { Save, SaveRepository } from './model';

class MemoryRepository implements SaveRepository {
  value: Save | null = null;
  fail = false;
  writes = 0;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    if (this.fail) throw new Error('disk full');
    this.value = structuredClone(value);
    this.writes++;
  }
}
function envelope(
  room: RoomCoordinator,
  credential: string,
  command: Command['command'],
): Command {
  const view = room.view(credential);
  return {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    branch: view.branch,
    revision: view.revision,
    command,
  };
}
async function fixture() {
  const repository = new MemoryRepository();
  const room = new RoomCoordinator(rules, bot, repository);
  const a = await room.join('甲');
  const b = await room.join('乙');
  const host = (command: Command['command']) =>
    room.command(room.hostToken, envelope(room, room.hostToken, command));
  return { repository, room, a, b, host };
}
afterEach(() => vi.restoreAllMocks());

it('queries queued commands without executing them and coalesces concurrent exact retries', async () => {
  const { repository, room, a } = await fixture();
  const input = envelope(room, a.token, { type: 'ready', ready: true });
  const before = repository.writes;
  expect(room.commandStatus(a.token, input)).toEqual({ status: 'unknown' });
  const first = room.command(a.token, input);
  expect(room.commandStatus(a.token, input)).toEqual({ status: 'processing' });
  expect(repository.writes).toBe(before);
  const duplicate = room.command(a.token, input);
  expect(duplicate).toBe(first);
  const conflict = {
    ...input,
    command: { type: 'ready', ready: false },
  } as const;
  expect(room.commandStatus(a.token, conflict)).toEqual({
    status: 'unqueryable',
    reason: 'action-id-conflict',
  });
  expect(await room.command(a.token, conflict)).toEqual({
    ok: false,
    reason: 'action-id-conflict',
  });
  const reply = await first;
  expect(reply.ok).toBe(true);
  expect(room.commandStatus(a.token, input)).toEqual({
    status: 'completed',
    reply,
  });
  expect(await duplicate).toEqual(reply);
  expect(repository.writes).toBe(before + 1);
});

it('uses durable successful receipts after restart and exposes no other principal results', async () => {
  const { repository, room, a, b } = await fixture();
  const input = envelope(room, a.token, { type: 'ready', ready: true });
  const reply = await room.command(a.token, input);
  const before = JSON.stringify(repository.value);
  const restored = new RoomCoordinator(rules, bot, repository);
  expect(restored.commandStatus(a.token, input)).toEqual({
    status: 'completed',
    reply,
  });
  expect(restored.commandStatus(b.token, input)).toEqual({ status: 'unknown' });
  expect(restored.commandStatus(undefined, input)).toEqual({
    status: 'unqueryable',
    reason: 'unauthorized',
  });
  expect(restored.commandStatus('revoked', input)).toEqual({
    status: 'unqueryable',
    reason: 'invalid-identity',
  });
  expect(JSON.stringify(repository.value)).toBe(before);
});

it('remembers failed attempts only at runtime and permits an unchanged retry after save failure', async () => {
  const { repository, room, a } = await fixture();
  const input = envelope(room, a.token, { type: 'ready', ready: true });
  const before = JSON.stringify(repository.value);
  repository.fail = true;
  const failed = await room.command(a.token, input);
  expect(failed).toEqual({ ok: false, reason: 'save-or-action-failed' });
  expect(room.commandStatus(a.token, input)).toEqual({
    status: 'completed',
    reply: failed,
  });
  expect(JSON.stringify(repository.value)).toBe(before);
  repository.fail = false;
  const restarted = new RoomCoordinator(rules, bot, repository);
  expect(restarted.commandStatus(a.token, input)).toEqual({
    status: 'unknown',
  });
  const retried = room.command(a.token, input);
  expect(room.commandStatus(a.token, input)).toEqual({ status: 'processing' });
  const saved = await retried;
  expect(saved.ok).toBe(true);
  expect(room.commandStatus(a.token, input)).toEqual({
    status: 'completed',
    reply: saved,
  });
});

it('bounds rejected results to 256 entries and expires them after 60 seconds without saving', async () => {
  const { repository, room, a } = await fixture();
  const before = repository.writes;
  const inputs: Command[] = [];
  for (let index = 0; index < 257; index++) {
    const input = envelope(room, a.token, { type: 'pause' });
    inputs.push(input);
    expect(await room.command(a.token, input)).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
  }
  expect(room.commandStatus(a.token, inputs[0]!)).toEqual({
    status: 'unknown',
  });
  expect(room.commandStatus(a.token, inputs[1]!)).toMatchObject({
    status: 'completed',
    reply: { ok: false, reason: 'unauthorized' },
  });
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_001);
  expect(room.commandStatus(a.token, inputs.at(-1)!)).toEqual({
    status: 'unknown',
  });
  expect(repository.writes).toBe(before);
});

it('rejects old branches before querying receipts and never reapplies rolled-back actions', async () => {
  const { repository, room, a, b, host } = await fixture();
  for (const player of [a, b])
    await room.command(
      player.token,
      envelope(room, player.token, { type: 'ready', ready: true }),
    );
  await host({ type: 'start' });
  const view = room.view(a.token);
  const input = envelope(room, a.token, {
    type: 'game',
    decisionId: view.decisionId!,
    action: view.actions[0] as never,
  });
  expect((await room.command(a.token, input)).ok).toBe(true);
  await host({
    type: 'rollback',
    checkpointId: room.view(room.hostToken).history[0]!.id,
  });
  const before = JSON.stringify(repository.value);
  expect(room.commandStatus(a.token, input)).toEqual({
    status: 'unqueryable',
    reason: 'stale-branch',
  });
  expect(JSON.stringify(repository.value)).toBe(before);
});

it('recovers the exact saved receipt of an instance-changing command using current authority', async () => {
  const { repository, room, a } = await fixture();
  const input = envelope(room, room.hostToken, {
    type: 'new-room',
  });
  const reply = await room.command(room.hostToken, input);
  expect(reply.ok).toBe(true);
  expect(room.view(room.hostToken).instanceId).not.toBe(input.instanceId);
  const before = JSON.stringify(repository.value);
  expect(room.commandStatus(room.hostToken, input)).toEqual({
    status: 'completed',
    reply,
  });
  expect(room.commandStatus(a.token, input)).toEqual({
    status: 'unqueryable',
    reason: 'invalid-identity',
  });
  expect(
    room.commandStatus(room.hostToken, { ...input, actionId: randomUUID() }),
  ).toEqual({ status: 'unqueryable', reason: 'stale-instance' });
  expect(JSON.stringify(repository.value)).toBe(before);
});
