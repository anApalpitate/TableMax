import { afterEach, expect, it, vi } from 'vitest';
import type { BotStrategy } from '@tablemax/game-sdk';
import type { Command, PlayMode } from '@tablemax/protocol';
import { rules, bot } from '../../../games/template';
import { RoomCoordinator } from './room';
import { BotScheduler, botDelayMs, type BotExecutor } from './bot-scheduler';
import type { Save, SaveRepository } from './model';

class Repository implements SaveRepository {
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
  command: Command['command'],
  credential = room.hostToken,
): Command {
  const view = room.view(credential);
  return {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}
function host(room: RoomCoordinator, command: Command['command']) {
  return room.command(room.hostToken, envelope(room, command));
}
async function bots(strategy = bot) {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, strategy, repository);
  await host(room, { type: 'add-bot', name: '一号' });
  await host(room, { type: 'add-bot', name: '二号' });
  await host(room, { type: 'start' });
  return { room, repository };
}
afterEach(() => vi.useRealTimers());

it('defaults legacy saves to play without writing or mutating the loaded legacy value', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  await room.join('手机玩家');
  delete repository.value!.playMode;
  const writes = repository.writes;
  const restored = new RoomCoordinator(rules, bot, repository);
  expect(restored.playMode).toBe('play');
  expect(restored.view().playMode).toBe('play');
  expect(repository.writes).toBe(writes);
  expect(repository.value!.playMode).toBeUndefined();
  repository.value!.playMode = 'test';
  expect(
    new RoomCoordinator(rules, bot, repository, undefined, 'play').playMode,
  ).toBe('play');
  expect(repository.value!.playMode).toBe('play');
  const invalid = structuredClone(repository.value!);
  (invalid as unknown as { playMode: string }).playMode = 'invalid';
  repository.value = invalid;
  expect(() => new RoomCoordinator(rules, bot, repository)).toThrow(
    'damaged-save',
  );
});

it('only the host changes mode atomically and preserves it through rollback, replay and new-room', async () => {
  const { room, repository } = await bots();
  const publicMode = await room.command(
    undefined,
    envelope(room, { type: 'set-play-mode', mode: 'test' }),
  );
  expect(publicMode).toEqual({ ok: false, reason: 'unauthorized' });
  const player = room.view(room.hostToken).seats[0]!;
  const forgedPlayer = await room.submitBot(
    room.botTask()!,
    { type: 'choose', value: 1 },
    null,
    1,
  );
  expect(forgedPlayer.ok).toBe(true);
  const snapshot = structuredClone(repository.value!.snapshot);
  const history = structuredClone(repository.value!.history);
  repository.fail = true;
  expect(await host(room, { type: 'set-play-mode', mode: 'test' })).toEqual({
    ok: false,
    reason: 'save-or-action-failed',
  });
  expect(room.playMode).toBe('play');
  expect(repository.value!.snapshot).toEqual(snapshot);
  repository.fail = false;
  expect((await host(room, { type: 'set-play-mode', mode: 'test' })).ok).toBe(
    true,
  );
  expect(room.view().playMode).toBe('test');
  expect(repository.value!.snapshot).toEqual(snapshot);
  expect(repository.value!.history).toEqual(history);
  const active = room.botTask()!;
  expect(active.decision.seatId).not.toBe(player.id);
  expect(
    (await room.submitBot(active, { type: 'choose', value: 1 }, null, 1)).ok,
  ).toBe(true);
  const checkpoint = room.view(room.hostToken).history[0]!;
  await host(room, { type: 'rollback', checkpointId: checkpoint.id });
  expect(room.playMode).toBe('test');
  expect(new RoomCoordinator(rules, bot, repository).playMode).toBe('test');
  await host(room, { type: 'end' });
  await host(room, { type: 'replay' });
  expect(room.playMode).toBe('test');
  await host(room, { type: 'new-room' });
  expect(room.playMode).toBe('test');
  const humanRepository = new Repository();
  const humanRoom = new RoomCoordinator(rules, bot, humanRepository);
  const human = await humanRoom.join('真人');
  expect(
    await humanRoom.command(
      human.token,
      envelope(humanRoom, { type: 'set-play-mode', mode: 'test' }, human.token),
    ),
  ).toEqual({ ok: false, reason: 'unauthorized' });
});

it('changes pending bot delays only after a saved mode change and cancels them when paused', async () => {
  vi.useFakeTimers();
  const { room, repository } = await bots();
  const executor: BotExecutor = {
    execute: vi.fn(async () => ({
      action: { type: 'choose', value: 1 },
      memory: null,
      random: 1,
    })),
  };
  const scheduler = new BotScheduler(room, undefined, 2000, executor);
  try {
    await vi.advanceTimersByTimeAsync(1499);
    expect(executor.execute).not.toHaveBeenCalled();
    repository.fail = true;
    await host(room, { type: 'set-play-mode', mode: 'test' });
    expect(room.playMode).toBe('play');
    repository.fail = false;
    await vi.advanceTimersByTimeAsync(1);
    expect(executor.execute).toHaveBeenCalledTimes(1);
    const steps = room.view(room.hostToken).history.length;
    await host(room, { type: 'set-play-mode', mode: 'test' });
    await vi.advanceTimersByTimeAsync(39);
    expect(room.view(room.hostToken).history).toHaveLength(steps);
    await host(room, { type: 'pause' });
    await vi.advanceTimersByTimeAsync(3000);
    expect(executor.execute).toHaveBeenCalledTimes(1);
    await host(room, { type: 'resume' });
    await vi.advanceTimersByTimeAsync(40);
    expect(executor.execute).toHaveBeenCalledTimes(2);
    expect(room.view(room.hostToken).history).toHaveLength(steps + 1);
  } finally {
    scheduler.stop();
  }
});

it('cancels an in-flight Worker calculation on mode changes and rejects its late result without consuming RNG', async () => {
  vi.useFakeTimers();
  const { room, repository } = await bots();
  let activeSignal: AbortSignal | undefined;
  let finish:
    | ((result: {
        action: { type: string; value: number };
        memory: null;
        random: number;
      }) => void)
    | undefined;
  const executor: BotExecutor = {
    execute(_task, signal) {
      activeSignal = signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  };
  const scheduler = new BotScheduler(room, undefined, 2000, executor);
  try {
    await vi.advanceTimersByTimeAsync(1500);
    const original = structuredClone(repository.value!.snapshot);
    expect(activeSignal?.aborted).toBe(false);
    const task = room.botTask()!;
    await host(room, { type: 'set-play-mode', mode: 'test' });
    expect(activeSignal?.aborted).toBe(true);
    finish!({ action: { type: 'choose', value: 1 }, memory: null, random: 27 });
    await vi.advanceTimersByTimeAsync(0);
    expect(repository.value!.snapshot).toEqual(original);
    expect(
      await room.submitBot(task, { type: 'choose', value: 1 }, null, 27),
    ).toEqual({ ok: false, reason: 'stale-revision' });
    await host(room, { type: 'pause' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(repository.value!.snapshot).toEqual(original);
  } finally {
    scheduler.stop();
  }
});

it('uses the precise play/test policy for all difficulty levels', () => {
  const strategy: BotStrategy = {
    ...bot,
    difficulties: ['default', 'doubao', 'juewu'],
  };
  expect(strategy.difficulties).toHaveLength(3);
  const mode: PlayMode = 'test';
  expect(botDelayMs('play', 'default')).toBe(1500);
  expect(botDelayMs('play', 'doubao')).toBe(1800);
  expect(botDelayMs('play', 'juewu')).toBe(2200);
  for (const difficulty of strategy.difficulties!)
    expect(botDelayMs(mode, difficulty)).toBe(40);
});

it('does not reset pending delays or abort a live Worker when phones connect, disconnect or update presence', async () => {
  vi.useFakeTimers();
  const { room } = await bots();
  const observed: AbortSignal[] = [];
  const executor: BotExecutor = {
    execute: vi.fn((_task, signal) => {
      observed.push(signal);
      return new Promise<Awaited<ReturnType<BotExecutor['execute']>>>(
        (_resolve, reject) =>
          signal.addEventListener(
            'abort',
            () => reject(new Error('cancelled')),
            {
              once: true,
            },
          ),
      );
    }),
  };
  const scheduler = new BotScheduler(room, undefined, 2000, executor);
  try {
    for (let index = 0; index < 5; index++) {
      await vi.advanceTimersByTimeAsync(250);
      // The service broadcasts online-seat changes with room.notify(), without
      // changing a revision or any game data, for connect/disconnect events.
      room.notify();
    }
    await vi.advanceTimersByTimeAsync(249);
    expect(executor.execute).not.toHaveBeenCalled();
    room.notify();
    await vi.advanceTimersByTimeAsync(1);
    expect(executor.execute).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 20; index++) room.notify();
    await vi.advanceTimersByTimeAsync(0);
    expect(observed[0]!.aborted).toBe(false);
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(room.view().botError).toBeNull();
    expect(room.view().paused).toBe(false);
    await host(room, { type: 'set-play-mode', mode: 'test' });
    expect(observed[0]!.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(room.view().botError).toBeNull();
    expect(room.view().paused).toBe(false);
    await vi.advanceTimersByTimeAsync(40);
    expect(executor.execute).toHaveBeenCalledTimes(2);
    await host(room, { type: 'pause' });
    expect(observed[1]!.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(room.view().paused).toBe(true);
    expect(room.view().botError).toBeNull();
  } finally {
    scheduler.stop();
  }
});

it('still persists a pause for the real two-second timeout even when the Worker rejects on abort', async () => {
  vi.useFakeTimers();
  const { room, repository } = await bots();
  await host(room, { type: 'set-play-mode', mode: 'test' });
  const executor: BotExecutor = {
    execute(_task, signal) {
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('cancelled')), {
          once: true,
        }),
      );
    },
  };
  const scheduler = new BotScheduler(room, undefined, 2000, executor);
  try {
    await vi.advanceTimersByTimeAsync(2039);
    expect(room.view().paused).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(room.view().paused).toBe(true);
    expect(room.view().botError).toBe('人机行动失败，请检查策略后恢复');
    expect(repository.value!.paused).toBe(true);
    expect(repository.value!.botError).toBe(room.view().botError);
  } finally {
    scheduler.stop();
  }
});
