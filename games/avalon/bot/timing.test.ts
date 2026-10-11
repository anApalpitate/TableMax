import { describe, expect, it } from 'vitest';
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
async function prepare(variant: 'classic' | 'court', human = false) {
  const repository = new Repository();
  const room = new RoomCoordinator(
    rulesByVariant[variant],
    botsByVariant[variant],
    repository,
  );
  const person = human ? await room.join('真人') : null;
  for (let i = human ? 1 : 0; i < 5; i++)
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
