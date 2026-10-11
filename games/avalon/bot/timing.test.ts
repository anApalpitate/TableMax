import { describe, expect, it, vi } from 'vitest';
import { RoomCoordinator } from '../../../packages/platform-core/src/room';
import { BotScheduler } from '../../../packages/platform-core/src/bot-scheduler';
import type {
  Save,
  SaveRepository,
} from '../../../packages/platform-core/src/model';
import { rulesByVariant } from '../rules';
import { botsByVariant } from './index';
import type { AvalonView } from '../types';

class Repository implements SaveRepository {
  value: Save | null = null;
  fail = false;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    if (this.fail) throw new Error('injected save failure');
    this.value = structuredClone(value);
  }
}
async function command(
  room: RoomCoordinator,
  command: unknown,
  token = room.hostToken,
) {
  const { instanceId, branch, revision } = room.view(token);
  return room.command(token, {
    instanceId,
    branch,
    revision,
    actionId: crypto.randomUUID(),
    command,
  });
}
async function prepare(
  variant: 'classic' | 'court' | 'configured',
  human = false,
  count = 5,
) {
  const repository = new Repository();
  const room = new RoomCoordinator(
    rulesByVariant[variant],
    botsByVariant[variant],
    repository,
  );
  const person = human ? await room.join('真人') : null;
  for (let i = human ? 1 : 0; i < count; i++)
    expect(
      (
        await command(room, {
          type: 'add-bot',
          name: `人机${i}`,
          difficulty: ['default', 'doubao', 'juewu'][i % 3] as
            'default' | 'doubao' | 'juewu',
        })
      ).ok,
    ).toBe(true);
  if (person)
    expect(
      (await command(room, { type: 'ready', ready: true }, person.token)).ok,
    ).toBe(true);
  expect((await command(room, { type: 'start' })).ok).toBe(true);
  expect(room.playMode).toBe('play');
  if (person) {
    const own = room.view(person.token);
    expect(
      (
        await command(
          room,
          {
            type: 'game',
            decisionId: own.decisionId!,
            action: { type: 'acknowledge' },
          },
          person.token,
        )
      ).ok,
    ).toBe(true);
  }
  while ((room.view().gameView as AvalonView).phase === 'reveal') {
    const task = room.botTask()!;
    expect(task.immediate).toBeUndefined();
    expect(
      (await room.submitBot(task, task.actions[0]!, null, task.data.random)).ok,
    ).toBe(true);
  }
  const task = room.botTask();
  if (task) {
    expect(task.immediate).toBeUndefined();
    expect(
      (await room.submitBot(task, task.actions[0]!, null, task.data.random)).ok,
    ).toBe(true);
  } else {
    const own = room.view(person!.token);
    expect(
      (
        await command(
          room,
          {
            type: 'game',
            decisionId: own.decisionId!,
            action: own.actions[0]!,
          },
          person!.token,
        )
      ).ok,
    ).toBe(true);
  }
  expect((room.view().gameView as AvalonView).phase).toBe('discussion');
  return { room, repository, person };
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean, limit = 500) {
  const deadline = Date.now() + limit;
  while (!check() && Date.now() < deadline) await wait(5);
  expect(check()).toBe(true);
}

describe('Avalon immediate discussion confirmation in ordinary play mode', () => {
  for (const variant of ['classic', 'court'] as const)
    it(`${variant}: all three tiers finish discussion immediately, but votes retain normal delay`, async () => {
      const { room } = await prepare(variant);
      expect(botsByVariant[variant].immediateActions).toEqual([
        'finish-discussion',
      ]);
      expect(room.botTask()!.immediate).toBe(true);
      const scheduler = new BotScheduler(room);
      try {
        await until(
          () => (room.view().gameView as AvalonView).phase === 'vote',
        );
        expect(room.botTask()!.immediate).toBeUndefined();
        const before = room.view().revision;
        await wait(100);
        expect(room.view().revision).toBe(before);
        expect(room.view().botError).toBeNull();
      } finally {
        scheduler.stop();
      }
    });
  it('waits for the current human speaker and never finishes on their behalf', async () => {
    const { room, person } = await prepare('classic', true);
    const scheduler = new BotScheduler(room);
    try {
      await until(() => !!room.view(person!.token).decisionId);
      expect(room.view(person!.token).actions).toEqual([
        { type: 'finish-discussion' },
      ]);
      expect(room.botTask()).toBeNull();
      const before = room.view().revision;
      await wait(100);
      expect(room.view().revision).toBe(before);
      const own = room.view(person!.token);
      expect(
        (
          await command(
            room,
            {
              type: 'game',
              decisionId: own.decisionId!,
              action: { type: 'finish-discussion' },
            },
            person!.token,
          )
        ).ok,
      ).toBe(true);
      await until(() => (room.view().gameView as AvalonView).phase === 'vote');
    } finally {
      scheduler.stop();
    }
  });
  it('does not execute while paused and resumes immediate confirmations through the save queue', async () => {
    const { room } = await prepare('court');
    expect((await command(room, { type: 'pause' })).ok).toBe(true);
    const before = room.view().revision;
    const scheduler = new BotScheduler(room);
    try {
      await wait(100);
      expect(room.view().revision).toBe(before);
      expect((room.view().gameView as AvalonView).phase).toBe('discussion');
      expect((await command(room, { type: 'resume' })).ok).toBe(true);
      await until(() => (room.view().gameView as AvalonView).phase === 'vote');
    } finally {
      scheduler.stop();
    }
  });
  it('failed saves leave discussion progress unchanged and surface the existing bot error', async () => {
    const { room, repository } = await prepare('classic');
    const before = structuredClone(repository.value);
    const view = structuredClone(room.view().gameView);
    repository.fail = true;
    const scheduler = new BotScheduler(room);
    try {
      await until(() => !!room.view().botError);
      expect(repository.value).toEqual(before);
      expect(room.view().gameView).toEqual(view);
      expect(room.botTask()).toBeNull();
    } finally {
      scheduler.stop();
    }
  });
});

async function voteRoom(human = false, count = 10) {
  const result = await prepare('configured', human, count);
  while ((result.room.view().gameView as AvalonView).phase === 'discussion') {
    const task = result.room.botTask();
    if (task)
      await result.room.submitBot(
        task,
        task.actions[0]!,
        null,
        task.data.random,
      );
    else {
      const own = result.room.view(result.person!.token);
      await command(
        result.room,
        { type: 'game', decisionId: own.decisionId!, action: own.actions[0]! },
        result.person!.token,
      );
    }
  }
  return result;
}
async function microtasks() {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}
function deferredExecutor() {
  const pending: {
    task: NonNullable<ReturnType<RoomCoordinator['botTask']>>;
    signal: AbortSignal;
    resolve: (result: {
      action: import('@tablemax/game-sdk').JsonValue;
      memory: null;
      random: number;
    }) => void;
    reject: (error: Error) => void;
  }[] = [];
  return {
    pending,
    executor: {
      execute(
        task: NonNullable<ReturnType<RoomCoordinator['botTask']>>,
        signal: AbortSignal,
      ) {
        return new Promise<{
          action: import('@tablemax/game-sdk').JsonValue;
          memory: null;
          random: number;
        }>((resolve, reject) =>
          pending.push({ task, signal, resolve, reject }),
        );
      },
    },
  };
}
describe('configured concurrent secret ballots', () => {
  it('rejects a result whose source strategy random state differs before changing a ballot', async () => {
    const { room } = await voteRoom();
    const task = room.botTasks()[0]!;
    const revision = room.view().revision;
    const changed = structuredClone(task);
    changed.data.random = changed.data.random === 1 ? 2 : 1;
    expect(
      (await room.submitBot(changed, changed.actions[0]!, null, 1)).ok,
    ).toBe(false);
    expect(room.view().revision).toBe(revision);
    expect((room.view().gameView as AvalonView).submittedSeats).toEqual([]);
    expect(
      (await room.submitBot(task, task.actions[0]!, null, task.data.random)).ok,
    ).toBe(true);
  });
  it('failed concurrent saves preserve ballot and random state, then pause safely', async () => {
    const { room, repository } = await voteRoom();
    await command(room, { type: 'set-play-mode', mode: 'test' });
    const before = structuredClone(repository.value);
    const deferred = deferredExecutor();
    const scheduler = new BotScheduler(
      room,
      undefined,
      2000,
      deferred.executor,
    );
    try {
      await microtasks();
      repository.fail = true;
      const first = deferred.pending[0]!;
      first.resolve({
        action: first.task.actions[0]!,
        memory: null,
        random: first.task.data.random + 1,
      });
      await microtasks();
      expect(repository.value).toEqual(before);
      expect(room.view().botError).not.toBeNull();
      expect(room.botTasks()).toEqual([]);
      expect(
        deferred.pending.slice(1).every((item) => item.signal.aborted),
      ).toBe(true);
    } finally {
      for (const item of deferred.pending)
        item.resolve({
          action: item.task.actions[0]!,
          memory: null,
          random: item.task.data.random,
        });
      scheduler.stop();
    }
  });
  it('mode switches and rollback cancel old tasks and ignore late branch results', async () => {
    const { room } = await voteRoom();
    await command(room, { type: 'set-play-mode', mode: 'test' });
    const deferred = deferredExecutor();
    const scheduler = new BotScheduler(
      room,
      undefined,
      2000,
      deferred.executor,
    );
    try {
      await microtasks();
      await command(room, { type: 'set-play-mode', mode: 'play' });
      expect(deferred.pending.every((item) => item.signal.aborted)).toBe(true);
      await command(room, { type: 'set-play-mode', mode: 'test' });
      await microtasks();
      expect(deferred.pending).toHaveLength(20);
      const previous = [...deferred.pending];
      await command(room, { type: 'pause' });
      await command(room, {
        type: 'rollback',
        checkpointId: room.view(room.hostToken).history.at(-1)!.id,
      });
      const revision = room.view().revision;
      for (const item of previous)
        item.resolve({
          action: item.task.actions[0]!,
          memory: null,
          random: item.task.data.random,
        });
      await microtasks();
      expect(room.view().revision).toBe(revision);
      expect(room.view().botError).toBeNull();
      expect(previous.every((item) => item.signal.aborted)).toBe(true);
    } finally {
      scheduler.stop();
    }
  });

  it('test dispatches all 10 computations through microtasks without advancing time, and accepts old group revisions serially', async () => {
    const { room } = await voteRoom();
    await command(room, { type: 'set-play-mode', mode: 'test' });
    vi.useFakeTimers();
    const deferred = deferredExecutor();
    const scheduler = new BotScheduler(
      room,
      undefined,
      2000,
      deferred.executor,
    );
    try {
      await microtasks();
      expect(deferred.pending).toHaveLength(10);
      const first = deferred.pending[0]!;
      first.resolve({
        action: first.task.actions[0]!,
        memory: null,
        random: first.task.data.random + 1,
      });
      await microtasks();
      expect((room.view().gameView as AvalonView).submittedSeats).toHaveLength(
        1,
      );
      expect(
        deferred.pending.slice(1).every((item) => !item.signal.aborted),
      ).toBe(true);
      const savedRevision = room.view().revision;
      expect(
        (await room.submitBot(first.task, first.task.actions[0]!, null, 9)).ok,
      ).toBe(true);
      expect(room.view().revision).toBe(savedRevision);
      for (const item of deferred.pending.slice(1))
        item.resolve({
          action: item.task.actions[0]!,
          memory: null,
          random: item.task.data.random + 1,
        });
      await microtasks();
      expect((room.view().gameView as AvalonView).phase).toBe('quest');
      expect(deferred.pending.length).toBeGreaterThan(10);
      expect(
        deferred.pending
          .slice(10)
          .every(
            (item) =>
              item.task.immediate &&
              item.task.actions.every(
                (action) => (action as { type: string }).type === 'quest-card',
              ),
          ),
      ).toBe(true);
      expect(room.view().botError).toBeNull();
    } finally {
      scheduler.stop();
      vi.useRealTimers();
    }
  });
  it('play starts the three tier delays together; a human save does not restart bots', async () => {
    const { room, person } = await voteRoom(true);
    vi.useFakeTimers();
    const deferred = deferredExecutor();
    const scheduler = new BotScheduler(
      room,
      undefined,
      2000,
      deferred.executor,
    );
    try {
      await vi.advanceTimersByTimeAsync(1499);
      expect(deferred.pending).toHaveLength(0);
      const own = room.view(person!.token);
      expect(
        (
          await command(
            room,
            {
              type: 'game',
              decisionId: own.decisionId!,
              action: own.actions[0]!,
            },
            person!.token,
          )
        ).ok,
      ).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      expect(deferred.pending.map((item) => item.task.data.difficulty)).toEqual(
        ['default', 'default', 'default'],
      );
      await vi.advanceTimersByTimeAsync(300);
      expect(deferred.pending).toHaveLength(6);
      await vi.advanceTimersByTimeAsync(400);
      expect(deferred.pending).toHaveLength(9);
      const first = deferred.pending[0]!;
      first.resolve({
        action: first.task.actions[0]!,
        memory: null,
        random: first.task.data.random,
      });
      await microtasks();
      expect(
        deferred.pending.slice(1).every((item) => !item.signal.aborted),
      ).toBe(true);
      await vi.advanceTimersByTimeAsync(2000);
      expect(room.view().paused).toBe(true);
      expect(room.view().botError).not.toBeNull();
    } finally {
      scheduler.stop();
      vi.useRealTimers();
    }
  });
  it('pause cancels every computation, and late results never save; resume dispatches a fresh group', async () => {
    const { room } = await voteRoom();
    await command(room, { type: 'set-play-mode', mode: 'test' });
    const deferred = deferredExecutor();
    const scheduler = new BotScheduler(
      room,
      undefined,
      2000,
      deferred.executor,
    );
    try {
      await microtasks();
      await command(room, { type: 'pause' });
      const revision = room.view().revision;
      expect(deferred.pending.every((item) => item.signal.aborted)).toBe(true);
      for (const item of [...deferred.pending])
        item.resolve({
          action: item.task.actions[0]!,
          memory: null,
          random: item.task.data.random,
        });
      await microtasks();
      expect(room.view().revision).toBe(revision);
      expect(room.view().botError).toBeNull();
      await command(room, { type: 'resume' });
      await microtasks();
      expect(deferred.pending).toHaveLength(20);
    } finally {
      scheduler.stop();
    }
  });
});
