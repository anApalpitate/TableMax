import { expect, it } from 'vitest';
import {
  AvatarIdSchema,
  AVATAR_PRESETS,
  type AvatarId,
  type Command,
} from '@tablemax/protocol';
import { rules, bot } from '../../../games/template';
import { GameRegistry } from './game-registry';
import type { Save, SaveRepository } from './model';
import { RoomCoordinator, token } from './room';

class Repository implements SaveRepository {
  value: Save | null = null;
  fail = false;
  writes = 0;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    if (this.fail) throw new Error('disk full');
    this.writes++;
    this.value = structuredClone(value);
  }
}
function fixture() {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  return { repository, room };
}
function envelope(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
): Command {
  const view = room.view(credential);
  return {
    actionId: token(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}
function run(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
) {
  return room.command(credential, envelope(room, command, credential));
}
const avatars = (room: RoomCoordinator) =>
  Object.fromEntries(room.view().seats.map((seat) => [seat.id, seat.avatarId]));

it('has 26 stable validated preset IDs and serializes competing admissions before saving ownership', async () => {
  expect(AVATAR_PRESETS).toHaveLength(26);
  expect(new Set(AVATAR_PRESETS.map((entry) => entry.id)).size).toBe(26);
  expect(AvatarIdSchema.safeParse('avatar-27').success).toBe(false);
  const { room, repository } = fixture();
  const results = await Promise.allSettled([
    room.join('先到', token(), 'avatar-26'),
    room.join('后到', token(), 'avatar-26'),
  ]);
  expect(results[0].status).toBe('fulfilled');
  expect(results[1].status).toBe('rejected');
  if (results[1].status === 'rejected')
    expect(results[1].reason.message).toBe('avatar-unavailable');
  expect(room.view().seats.map((seat) => [seat.name, seat.avatarId])).toEqual([
    ['先到', 'avatar-26'],
  ]);
  expect(repository.value!.seats[0]!.avatarId).toBe('avatar-26');
});

it('allows only one simultaneous avatar change and keeps same-avatar commands idempotent', async () => {
  const { room } = fixture();
  const a = await room.join('甲');
  const b = await room.join('乙');
  const inputs = [a, b].map((player) =>
    envelope(room, { type: 'set-avatar', avatarId: 'avatar-12' }, player.token),
  );
  const replies = await Promise.all([
    room.command(a.token, inputs[0]),
    room.command(b.token, inputs[1]),
  ]);
  expect(replies[0].ok).toBe(true);
  expect(replies[1]).toEqual({ ok: false, reason: 'avatar-unavailable' });
  expect(await room.command(a.token, inputs[0])).toEqual(replies[0]);
  expect(
    (await run(room, { type: 'set-avatar', avatarId: 'avatar-12' }, a.token))
      .ok,
  ).toBe(true);
  const late = envelope(
    room,
    { type: 'set-avatar', avatarId: 'avatar-13' },
    a.token,
  );
  await run(room, { type: 'ready', ready: true }, b.token);
  expect(await room.command(a.token, late)).toEqual({
    ok: false,
    reason: 'stale-revision',
  });
  expect(
    room
      .view(a.token)
      .seats.find((seat) => seat.id === room.view(a.token).self.seatId)!
      .avatarId,
  ).toBe('avatar-12');
});

it('recovers lost join responses with the chosen avatar across restart, preserving old optional requests', async () => {
  const { repository, room } = fixture();
  const key = token();
  const first = await room.join('甲', key, 'avatar-25');
  const oldKey = token();
  const legacy = await room.join('乙', oldKey);
  const restored = new RoomCoordinator(rules, bot, repository);
  expect(await restored.join('甲', key, 'avatar-25')).toEqual(first);
  expect(await restored.join('乙', oldKey)).toEqual(legacy);
  await expect(restored.join('甲', key, 'avatar-24')).rejects.toThrow(
    'session-request-conflict',
  );
  await expect(restored.join('甲', key)).rejects.toThrow(
    'session-request-conflict',
  );
  expect(restored.view(first.token).seats[0]!.avatarId).toBe('avatar-25');
  expect(restored.view().seats).toHaveLength(2);
});

it('does not reserve or release avatars when saving an admission or a change fails', async () => {
  const { room, repository } = fixture();
  const player = await room.join('甲', undefined, 'avatar-1');
  const before = room.view();
  repository.fail = true;
  expect(
    await run(room, { type: 'set-avatar', avatarId: 'avatar-2' }, player.token),
  ).toEqual({ ok: false, reason: 'save-or-action-failed' });
  await expect(room.join('乙', token(), 'avatar-2')).rejects.toThrow(
    'disk full',
  );
  expect(room.view()).toEqual(before);
  repository.fail = false;
  const other = await room.join('乙', undefined, 'avatar-2');
  await expect(room.join('丙', undefined, 'avatar-1')).rejects.toThrow(
    'avatar-unavailable',
  );
  expect(room.view(other.token).seats.map((seat) => seat.avatarId)).toEqual([
    'avatar-1',
    'avatar-2',
  ]);
});

it('reserves offline and bot avatars, releasing only removed seats or a new room', async () => {
  const { room } = fixture();
  const player = await room.join('甲', undefined, 'avatar-1');
  expect(room.view().seats[0]!.online).toBe(false);
  await expect(room.join('乙', undefined, 'avatar-1')).rejects.toThrow(
    'avatar-unavailable',
  );
  await run(room, { type: 'add-bot', name: '电脑' });
  expect(room.view().seats[1]!.avatarId).toBe('avatar-2');
  await expect(room.join('乙', undefined, 'avatar-2')).rejects.toThrow(
    'avatar-unavailable',
  );
  await run(room, {
    type: 'remove-seat',
    seatId: room.view(player.token).self.seatId!,
  });
  await expect(room.join('乙', undefined, 'avatar-1')).resolves.toHaveProperty(
    'token',
  );
  await run(room, { type: 'new-room' });
  expect(room.view().seats).toEqual([]);
  await expect(
    room.join('新人', undefined, 'avatar-2'),
  ).resolves.toHaveProperty('token');
});

it('rejects illegal IDs and administrative, public or in-game changes without changing the view', async () => {
  const { room } = fixture();
  const a = await room.join('甲');
  const b = await room.join('乙');
  const before = room.view();
  for (const credential of [undefined, room.hostToken])
    expect(
      await room.command(
        credential,
        envelope(room, { type: 'set-avatar', avatarId: 'avatar-26' }),
      ),
    ).toEqual({ ok: false, reason: 'unauthorized' });
  expect(
    await room.command(a.token, {
      ...envelope(room, { type: 'set-avatar', avatarId: 'avatar-26' }, a.token),
      command: { type: 'set-avatar', avatarId: 'avatar-27' },
    }),
  ).toEqual({ ok: false, reason: 'invalid-message' });
  await expect(
    room.join('非法', undefined, 'avatar-27' as AvatarId),
  ).rejects.toThrow('invalid-avatar');
  expect(room.view()).toEqual(before);
  for (const player of [a, b])
    await run(room, { type: 'ready', ready: true }, player.token);
  await run(room, { type: 'start' });
  expect(
    await run(room, { type: 'set-avatar', avatarId: 'avatar-26' }, a.token),
  ).toEqual({ ok: false, reason: 'avatars-locked' });
  await run(room, { type: 'end' });
  expect(
    (await run(room, { type: 'set-avatar', avatarId: 'avatar-26' }, a.token))
      .ok,
  ).toBe(true);
});

it('keeps seat avatars through order, compatible game switch, replay and rollback independently of checkpoints', async () => {
  const repository = new Repository();
  const alternate = {
    ...rules,
    manifest: { ...rules.manifest, id: 'alternate', name: '另一个验证游戏' },
  };
  const alternateBot = { ...bot, gameId: 'alternate' };
  const registry = new GameRegistry(
    [rules, alternate].map((game) => ({
      catalog: {
        id: game.manifest.id,
        name: game.manifest.name,
        ...game.manifest.players,
      },
      load: async () => ({
        rules: game,
        bot: game === rules ? bot : alternateBot,
      }),
    })),
  );
  const room = await RoomCoordinator.open(registry, repository);
  await run(room, { type: 'select-game', gameId: 'template' });
  const a = await room.join('甲', undefined, 'avatar-7');
  const b = await room.join('乙', undefined, 'avatar-8');
  const original = avatars(room);
  await run(room, {
    type: 'order',
    seats: room
      .view()
      .seats.map((seat) => seat.id)
      .reverse(),
  });
  expect(avatars(room)).toEqual(original);
  await run(room, { type: 'select-game', gameId: 'alternate' });
  expect(avatars(room)).toEqual(original);
  for (const player of [a, b])
    await run(room, { type: 'ready', ready: true }, player.token);
  await run(room, { type: 'start' });
  const acting = room.view(b.token);
  expect(
    (
      await run(
        room,
        {
          type: 'game',
          decisionId: acting.decisionId!,
          action: acting.actions[0] as { type: string; value: number },
        },
        b.token,
      )
    ).ok,
  ).toBe(true);
  const checkpoint = room.view(room.hostToken).history[0]!;
  await run(room, { type: 'end' });
  await run(room, { type: 'set-avatar', avatarId: 'avatar-26' }, a.token);
  const current = avatars(room);
  expect(JSON.stringify(repository.value!.history)).not.toContain('avatarId');
  await run(room, { type: 'rollback', checkpointId: checkpoint.id });
  expect(avatars(room)).toEqual(current);
  expect(room.view().paused).toBe(true);
  await run(room, { type: 'end' });
  await run(room, { type: 'replay' });
  expect(avatars(room)).toEqual(current);
  expect(room.view(a.token).self.role).toBe('player');
});

it('migrates missing legacy avatars deterministically, preserving explicit ownership and saving once', async () => {
  const { room, repository } = fixture();
  await room.join('甲');
  await room.join('乙');
  repository.value!.seats[0]!.id = 'a';
  repository.value!.seats[1]!.id = 'g';
  for (const seat of repository.value!.seats) delete seat.avatarId;
  const original = structuredClone(repository.value);
  const revision = original!.revision;
  const writes = repository.writes;
  const migrated = new RoomCoordinator(rules, bot, repository);
  expect(migrated.view().seats.map((seat) => seat.avatarId)).toEqual([
    'avatar-2',
    'avatar-1',
  ]);
  expect(migrated.view().revision).toBe(revision + 1);
  expect(repository.writes).toBe(writes + 1);
  expect(original!.seats.every((seat) => seat.avatarId === undefined)).toBe(
    true,
  );
  const first = avatars(migrated);
  const again = new RoomCoordinator(rules, bot, repository);
  expect(avatars(again)).toEqual(first);
  expect(repository.writes).toBe(writes + 1);
  repository.value!.seats[1]!.avatarId = 'avatar-2';
  delete repository.value!.seats[0]!.avatarId;
  const reserved = new RoomCoordinator(rules, bot, repository);
  expect(reserved.view().seats.map((seat) => seat.avatarId)).toEqual([
    'avatar-1',
    'avatar-2',
  ]);
});

it('protects explicit duplicate, invalid and null saved avatars without modifying storage', async () => {
  const { room, repository } = fixture();
  await room.join('甲');
  await room.join('乙');
  for (const invalid of ['avatar-1', 'avatar-27', null]) {
    const corrupt = structuredClone(repository.value)!;
    (corrupt.seats[1] as unknown as { avatarId: unknown }).avatarId = invalid;
    repository.value = corrupt;
    const before = structuredClone(repository.value);
    expect(() => new RoomCoordinator(rules, bot, repository)).toThrow(
      'damaged-save',
    );
    expect(repository.value).toEqual(before);
  }
});
