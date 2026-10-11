import { expect, it } from 'vitest';
import { rules, bot } from '../../../games/template';
import { GameRegistry, type GameRegistration } from './game-registry';
import { RoomCoordinator } from './room';
import type { Save, SaveRepository } from './model';
import type { Command } from '@tablemax/protocol';

const a = 'a'.repeat(64),
  b = 'b'.repeat(64);
function registration(current: string, missing = false): GameRegistration {
  return {
    catalog: {
      id: rules.manifest.id,
      name: rules.manifest.name,
      ...rules.manifest.players,
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
  registry.refresh([registration(b)]);
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
