import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { RoomCoordinator } from './room';
import { BotScheduler } from './bot-scheduler';
import { GameRegistry } from './game-registry';
import type { Save, SaveRepository } from './model';
import { rules, bot } from '../../../games/template';

class Repository implements SaveRepository {
  value: Save | null = null;
  fail = false;
  writes = 0;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    if (this.fail) throw new Error('fixture-save-failed');
    this.value = structuredClone(value);
    this.writes++;
  }
}
function intent(room: RoomCoordinator, command: unknown) {
  const view = room.view(room.hostToken);
  return {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    branch: view.branch,
    revision: view.revision,
    command,
  };
}

it('drains admitted joins and rejects new actions, joins and transfer mutations immediately', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  const join = room.join('已接收');
  const stopping = room.beginShutdown();
  expect(room.beginShutdown()).toBe(stopping);
  await expect(room.join('关闭后')).rejects.toThrow('service-closing');
  await expect(room.requestTransfer('missing-seat', 'request')).rejects.toThrow(
    'service-closing',
  );
  expect(
    await room.command(
      room.hostToken,
      intent(room, { type: 'add-bot', name: '迟到' }),
    ),
  ).toEqual({ ok: false, reason: 'service-closing' });
  await join;
  expect(await stopping).toBe('drained');
  expect(repository.value!.seats.map((s) => s.name)).toEqual(['已接收']);
  expect(repository.writes).toBe(1);
});

it('waits for an admitted module load and its following join without adding a checkpoint', async () => {
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const loading = new Promise<void>((done) => {
    entered = done;
  });
  const registry = new GameRegistry([
    {
      catalog: {
        id: rules.manifest.id,
        name: rules.manifest.name,
        ...rules.manifest.players,
      },
      async load() {
        entered();
        await gate;
        return { rules, bot };
      },
    },
  ]);
  const repository = new Repository();
  const room = new RoomCoordinator(
    null,
    null,
    repository,
    undefined,
    undefined,
    registry,
  );
  const selection = room.command(
    room.hostToken,
    intent(room, { type: 'select-game', gameId: rules.manifest.id }),
  );
  await loading;
  const join = room.join('后续已接收');
  let drained = false;
  const stopping = room.beginShutdown().then((status) => {
    drained = true;
    return status;
  });
  try {
    await Promise.resolve();
    expect(drained).toBe(false);
    release();
    expect((await selection).ok).toBe(true);
    await join;
    expect(await stopping).toBe('drained');
    expect(repository.value!.manifest!.id).toBe(rules.manifest.id);
    expect(repository.value!.seats.map((s) => s.name)).toEqual(['后续已接收']);
    expect(repository.value!.history).toEqual([]);
  } finally {
    release();
    await stopping;
  }
});

it('reports an admitted save failure instead of confirming a drained handoff', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  await room.join('原玩家');
  const original = structuredClone(repository.value);
  repository.fail = true;
  const join = room.join('未保存');
  const rejected = expect(join).rejects.toThrow('fixture-save-failed');
  const stopping = room.beginShutdown();
  await rejected;
  expect(await stopping).toBe('save-failed');
  expect(repository.value).toEqual(original);
});

it('clears an earlier storage failure only after an explicit successful write while open', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  repository.fail = true;
  await expect(room.join('未保存')).rejects.toThrow('fixture-save-failed');
  repository.fail = false;
  await room.join('恢复成功');
  expect(await room.beginShutdown()).toBe('drained');
});

it('stops bot dispatch and ignores a late executor result without another write', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  for (const name of ['人机一', '人机二'])
    expect(
      (
        await room.command(
          room.hostToken,
          intent(room, { type: 'add-bot', name }),
        )
      ).ok,
    ).toBe(true);
  expect(
    (await room.command(room.hostToken, intent(room, { type: 'start' }))).ok,
  ).toBe(true);
  let deliver!: () => void;
  let entered!: () => void;
  let aborted = false;
  const running = new Promise<void>((done) => {
    entered = done;
  });
  const scheduler = new BotScheduler(room, 0, 2000, {
    execute(task, signal) {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      entered();
      return new Promise((done) => {
        deliver = () =>
          done({
            action: task.actions[0]!,
            memory: task.data.memory,
            random: task.data.random,
          });
      });
    },
  });
  try {
    await running;
    const before = repository.writes;
    const stopping = room.beginShutdown();
    scheduler.stop();
    expect(aborted).toBe(true);
    deliver();
    expect(await stopping).toBe('drained');
    await new Promise<void>((done) => setImmediate(done));
    expect(repository.writes).toBe(before);
  } finally {
    scheduler.stop();
    deliver?.();
  }
});
