import { expect, it, vi } from 'vitest';
import type { BotStrategy } from '@tablemax/game-sdk';
import type { Command } from '@tablemax/protocol';
import { rules, bot } from '../../../games/template';
import { RoomCoordinator } from './room';
import { BotScheduler } from './bot-scheduler';
import type { Save, SaveRepository } from './model';

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
const strategy: BotStrategy = {
  ...bot,
  difficulties: ['default', 'doubao', 'juewu'],
};
function command(
  room: RoomCoordinator,
  value: Command['command'],
  token = room.hostToken,
) {
  const { instanceId, branch, revision } = room.view(token);
  return room.command(token, {
    instanceId,
    branch,
    revision,
    actionId: crypto.randomUUID(),
    command: value,
  });
}
async function add(
  room: RoomCoordinator,
  difficulty: 'default' | 'doubao' | 'juewu',
) {
  expect(
    (await command(room, { type: 'add-bot', name: difficulty, difficulty })).ok,
  ).toBe(true);
  return room.view().seats.at(-1)!.id;
}

it('restricts level changes to host-owned bot seats in the lobby and commits them atomically', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, strategy, repository);
  const phone = await room.join('手机朋友');
  const seatId = await add(room, 'doubao');
  const change = {
    type: 'set-bot-difficulty',
    seatId,
    difficulty: 'juewu',
  } as const;
  expect(await command(room, change, phone.token)).toEqual({
    ok: false,
    reason: 'unauthorized',
  });
  expect(
    await command(room, {
      ...change,
      seatId: room.view(phone.token).self.seatId!,
    }),
  ).toEqual({ ok: false, reason: 'invalid-seat' });
  repository.fail = true;
  expect(await command(room, change)).toEqual({
    ok: false,
    reason: 'save-or-action-failed',
  });
  expect(room.view().seats.find((s) => s.id === seatId)!.botDifficulty).toBe(
    'doubao',
  );
  repository.fail = false;
  expect((await command(room, change)).ok).toBe(true);
  expect(room.view().seats[0]!.botDifficulty).toBeNull();
  expect(room.view(room.hostToken).self).toEqual({
    role: 'host',
    seatId: null,
  });
  expect(room.view(room.hostToken).actions).toEqual([]);
  await command(room, { type: 'ready', ready: true }, phone.token);
  await command(room, { type: 'start' });
  expect(await command(room, change)).toEqual({
    ok: false,
    reason: 'not-in-lobby',
  });
  expect(repository.value!.snapshot!.bots[seatId]!.difficulty).toBe('juewu');
});

it('rejects unavailable levels and malformed wire values without creating seats', async () => {
  const room = new RoomCoordinator(rules, bot, new Repository());
  expect(
    await command(room, { type: 'add-bot', name: '高级', difficulty: 'juewu' }),
  ).toEqual({ ok: false, reason: 'unsupported-bot-difficulty' });
  expect(room.view().seats).toHaveLength(0);
  await command(room, { type: 'add-bot', name: '旧默认' });
  expect(room.view().seats[0]!.botDifficulty).toBe('default');
  const invalid = {
    type: 'set-bot-difficulty',
    seatId: room.view().seats[0]!.id,
    difficulty: 'cheat',
  };
  expect(await command(room, invalid as Command['command'])).toEqual({
    ok: false,
    reason: 'invalid-message',
  });
  expect(room.view().seats[0]!.botDifficulty).toBe('default');
});

it('passes each saved level to scheduling and preserves it through rollback, restart and replay', async () => {
  const repository = new Repository();
  const seen: string[] = [];
  const observed: BotStrategy = {
    ...strategy,
    async decide(input) {
      seen.push(input.difficulty ?? 'missing');
      return bot.decide(input);
    },
  };
  const room = new RoomCoordinator(rules, observed, repository);
  for (const level of ['default', 'doubao', 'juewu'] as const)
    await add(room, level);
  await command(room, { type: 'start' });
  const scheduler = new BotScheduler(room, 1);
  try {
    await vi.waitFor(() =>
      expect(room.view(room.hostToken).lifecycleActions).toHaveLength(1),
    );
  } finally {
    scheduler.stop();
  }
  expect(seen).toEqual(['default', 'doubao', 'juewu']);
  const checkpoint = room.view(room.hostToken).history.at(-1)!;
  expect(
    (await command(room, { type: 'rollback', checkpointId: checkpoint.id })).ok,
  ).toBe(true);
  expect(room.botTask()).toBeNull();
  const restored = new RoomCoordinator(rules, observed, repository);
  expect(restored.view().paused).toBe(true);
  expect(restored.view().seats.map((s) => s.botDifficulty)).toEqual(seen);
  await command(restored, { type: 'resume' });
  expect(restored.botTask()!.data.difficulty).toBe('juewu');
  await command(restored, { type: 'end' });
  await command(restored, { type: 'replay' });
  expect(restored.view().seats.map((s) => s.botDifficulty)).toEqual(seen);
  await command(restored, { type: 'start' });
  expect(
    Object.values(repository.value!.snapshot!.bots).map((b) => b.difficulty),
  ).toEqual(seen);
});

it('normalizes legacy seats and checkpoints to default without changing the old strategy', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  await add(room, 'default');
  await add(room, 'default');
  await command(room, { type: 'start' });
  const task = room.botTask()!;
  const action = await bot.decide({
    view: task.view,
    actions: task.actions,
    decision: task.decision,
    memory: null,
    random: { next: () => 0 },
    signal: new AbortController().signal,
  });
  await room.submitBot(task, action.action, action.memory, task.data.random);
  for (const seat of repository.value!.seats) delete seat.botDifficulty;
  for (const snap of [
    repository.value!.snapshot!,
    ...repository.value!.history.map((h) => h.before),
  ])
    for (const data of Object.values(snap.bots)) delete data.difficulty;
  const restored = new RoomCoordinator(rules, bot, repository);
  expect(
    restored.view().seats.every((s) => s.botDifficulty === 'default'),
  ).toBe(true);
  expect(
    Object.values(repository.value!.snapshot!.bots).every(
      (b) => b.difficulty === 'default',
    ),
  ).toBe(true);
});

it('refuses incompatible or inconsistent saved levels without replacing the save', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, strategy, repository);
  const seatId = await add(room, 'doubao');
  await add(room, 'default');
  await command(room, { type: 'start' });
  const before = structuredClone(repository.value);
  expect(() => new RoomCoordinator(rules, bot, repository)).toThrow(
    'incompatible-strategy',
  );
  expect(repository.value).toEqual(before);
  repository.value!.snapshot!.bots[seatId]!.difficulty = 'juewu';
  expect(() => new RoomCoordinator(rules, strategy, repository)).toThrow(
    'incompatible-strategy',
  );
  expect(repository.value!.snapshot!.bots[seatId]!.difficulty).toBe('juewu');
});
