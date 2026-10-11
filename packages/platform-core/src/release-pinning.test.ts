import { expect, it } from 'vitest';
import { rules, bot } from '../../../games/template';
import { GameRegistry, type GameRegistration } from './game-registry';
import { RoomCoordinator } from './room';
import type { Save, SaveRepository } from './model';
import type { Command } from '@tablemax/protocol';

const a = 'a'.repeat(64),
  b = 'b'.repeat(64);
function registration(
  current: string,
  missing = false,
  max = rules.manifest.players.max,
): GameRegistration {
  return {
    catalog: {
      id: rules.manifest.id,
      name: rules.manifest.name,
      ...rules.manifest.players,
      max,
    },
    async load(_variant, ref) {
      if (missing) throw new Error('missing-game-release');
      return { rules, bot, releaseRef: ref ?? current };
    },
  };
}
class Repository implements SaveRepository {
  value: Save | null = null;
  writes = 0;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    this.value = structuredClone(value);
    this.writes++;
  }
}
async function command(room: RoomCoordinator, value: Command['command']) {
  const view = room.view(room.hostToken);
  return room.command(room.hostToken, {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: value,
  });
}
it('pins current rules and Worker task, restores exact package after update, and selects new package explicitly', async () => {
  const repository = new Repository();
  const registry = new GameRegistry([registration(a)]);
  let room = await RoomCoordinator.open(
    registry,
    repository,
    undefined,
    'test',
    rules.manifest.id,
  );
  expect((await command(room, { type: 'add-bot', name: '一' })).ok).toBe(true);
  expect((await command(room, { type: 'add-bot', name: '二' })).ok).toBe(true);
  expect((await command(room, { type: 'start' })).ok).toBe(true);
  registry.refresh([registration(b, false, rules.manifest.players.max + 1)]);
  expect(registry.catalog()[0]?.max).toBe(rules.manifest.players.max + 1);
  expect(room.view().game?.releaseRef).toBe(a);
  expect(room.botTask()?.releaseRef).toBe(a);
  room = await RoomCoordinator.open(registry, repository);
  expect(room.view().game?.releaseRef).toBe(a);
  expect(room.view().paused).toBe(true);
  expect(
    (
      await command(room, {
        type: 'select-game',
        gameId: rules.manifest.id,
        endCurrent: true,
      })
    ).ok,
  ).toBe(true);
  expect(repository.value?.releaseRef).toBe(b);
  expect(room.view().seats).toHaveLength(2);
});
it('rejects source capability mismatches and a loader substituting the pinned release', async () => {
  const entry = registration(b, false, rules.manifest.players.max + 1);
  const source = new GameRegistry([
    { ...entry, load: async () => ({ rules, bot }) },
  ]);
  await expect(source.load(rules.manifest.id)).rejects.toThrow(
    'incompatible-game',
  );
  const substituted = new GameRegistry([
    { ...entry, load: async () => ({ rules, bot, releaseRef: b }) },
  ]);
  await expect(
    substituted.load(rules.manifest.id, undefined, a),
  ).rejects.toThrow('missing-game-release');
});
it.each([
  { action: 'select-game', playing: false },
  { action: 'select-game', playing: true },
  { action: 'select-variant', playing: false },
] as const)(
  'rejects $action into an over-capacity pinned package (playing=$playing) without changing the save',
  async ({ action, playing }) => {
    const repository = new Repository();
    const catalog = {
      ...registration(a).catalog,
      defaultVariantId: 'classic',
      variants: [{ id: 'classic', name: '经典', description: '测试玩法' }],
    };
    const registry = new GameRegistry([
      {
        catalog,
        load: async (_variant, ref) => ({ rules, bot, releaseRef: ref ?? a }),
      },
    ]);
    const room = await RoomCoordinator.open(
      registry,
      repository,
      undefined,
      'test',
      rules.manifest.id,
    );
    for (const name of ['一', '二', '三'])
      expect((await command(room, { type: 'add-bot', name })).ok).toBe(true);
    if (playing) expect((await command(room, { type: 'start' })).ok).toBe(true);
    const smallerRules = {
      ...rules,
      manifest: {
        ...rules.manifest,
        players: { min: rules.manifest.players.min, max: 2 },
      },
    };
    registry.refresh([
      {
        catalog,
        load: async (_variant, ref) => ({
          rules: ref === a ? rules : smallerRules,
          bot,
          releaseRef: ref ?? b,
        }),
      },
    ]);
    expect(registry.catalog()[0]!.max).toBeGreaterThan(3);
    const before = room.view(room.hostToken);
    const saved = structuredClone(repository.value);
    const writes = repository.writes;
    const reply = await command(
      room,
      action === 'select-game'
        ? {
            type: action,
            gameId: rules.manifest.id,
            ...(playing ? { endCurrent: true as const } : {}),
          }
        : { type: action, variantId: 'classic' },
    );
    expect(reply).toMatchObject({ ok: false, reason: 'too-many-seats' });
    expect(repository.value).toEqual(saved);
    expect(repository.writes).toBe(writes);
    expect({ ...room.view(room.hostToken), decisionClock: null }).toEqual({
      ...before,
      decisionClock: null,
    });
    const restored = await RoomCoordinator.open(registry, repository);
    expect(restored.view().game?.releaseRef).toBe(a);
    expect(restored.view().game?.max).toBe(rules.manifest.players.max);
    expect(restored.view().seats).toHaveLength(3);
    if (playing) expect(restored.view().paused).toBe(true);
  },
);
it('keeps missing-package database bytes and player credentials until exact repair succeeds paused', async () => {
  const repository = new Repository();
  const registry = new GameRegistry([registration(a)]);
  let room = await RoomCoordinator.open(
    registry,
    repository,
    undefined,
    undefined,
    rules.manifest.id,
  );
  const joined = await room.join('原玩家');
  const seatId = room.view(joined.token).self.seatId;
  const original = structuredClone(repository.value);
  const writes = repository.writes;
  registry.refresh([registration(b, true)]);
  room = await RoomCoordinator.open(registry, repository);
  expect(room.missingRelease).toBe(a);
  expect(room.view(joined.token).self.seatId).toBe(seatId);
  expect(room.view(joined.token).gameView).toBeNull();
  expect(repository.value).toEqual(original);
  expect(repository.writes).toBe(writes);
  expect((await command(room, { type: 'new-room' })).ok).toBe(false);
  registry.refresh([registration(b)]);
  expect(await room.restoreMissingRelease()).toBe(true);
  expect(room.view().game?.releaseRef).toBe(a);
  expect(room.view().paused).toBe(true);
  expect(room.view(joined.token).self.seatId).toBe(seatId);
});
