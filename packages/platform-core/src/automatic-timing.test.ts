import { afterEach, expect, it, vi } from 'vitest';
import type { GameRules } from '@tablemax/game-sdk';
import type { Command } from '@tablemax/protocol';
import { RoomViewSchema } from '@tablemax/protocol';
import { rules, bot } from '../../../games/template';
import type { State } from '../../../games/template/rules/state';
import { RoomCoordinator, token } from './room';
import { AutomaticScheduler } from './automatic-scheduler';
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
const timed: GameRules = {
  ...rules,
  automaticAction(input) {
    const state = input as State;
    return state.turn < state.seats.length
      ? {
          key: `turn-${state.turn}`,
          delayMs: 1000,
          action: { type: 'deadline', turn: state.turn },
        }
      : null;
  },
  applyAutomatic(input, action, context) {
    const state = input as State;
    if ((action as { turn: number }).turn !== state.turn)
      throw new Error('stale deadline');
    return rules.apply(
      input,
      { type: 'choose', value: 1 },
      state.seats[state.turn]!,
      context,
    );
  },
};
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
function send(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
) {
  return room.command(credential, envelope(room, command, credential));
}
async function fixture(game: GameRules = timed) {
  vi.useFakeTimers();
  vi.setSystemTime(100000);
  const repository = new Repository();
  const room = new RoomCoordinator(game, bot, repository);
  const players: string[] = [];
  for (let i = 0; i < 2; i++) {
    const player = await room.join(`玩家${i + 1}`);
    players.push(player.token);
    expect(
      (await send(room, { type: 'ready', ready: true }, player.token)).ok,
    ).toBe(true);
  }
  expect((await send(room, { type: 'start' })).ok).toBe(true);
  return { room, repository, players };
}
afterEach(() => vi.useRealTimers());

it('saves and projects a server-owned deadline without exposing its internal action', async () => {
  const { room, repository } = await fixture();
  const view = room.view(room.hostToken);
  expect(RoomViewSchema.safeParse(view).success).toBe(true);
  expect(view.automaticTiming).toMatchObject({
    remainingMs: 1000,
    running: true,
  });
  expect(JSON.stringify(view)).not.toContain('deadline');
  expect(repository.value?.automaticClock?.remainingMs).toBe(1000);
});
it('scheduler saves expiry once and ends after all deadlines', async () => {
  const { room } = await fixture();
  const scheduler = new AutomaticScheduler(room);
  await vi.advanceTimersByTimeAsync(1000);
  expect(
    Object.keys(
      (room.view().gameView as { choices: Record<string, number> }).choices,
    ).length,
  ).toBe(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(room.view().status).toBe('ended');
  expect(room.automaticTask()).toBeNull();
  scheduler.stop();
});
it('pause preserves remaining time and resume restarts that remainder', async () => {
  const { room } = await fixture();
  const scheduler = new AutomaticScheduler(room);
  await vi.advanceTimersByTimeAsync(350);
  expect((await send(room, { type: 'pause' })).ok).toBe(true);
  expect(room.view().automaticTiming).toMatchObject({
    remainingMs: 650,
    running: false,
  });
  await vi.advanceTimersByTimeAsync(8000);
  expect(
    Object.keys(
      (room.view().gameView as { choices: Record<string, number> }).choices,
    ).length,
  ).toBe(0);
  expect((await send(room, { type: 'resume' })).ok).toBe(true);
  await vi.advanceTimersByTimeAsync(649);
  expect(
    Object.keys(
      (room.view().gameView as { choices: Record<string, number> }).choices,
    ).length,
  ).toBe(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(
    Object.keys(
      (room.view().gameView as { choices: Record<string, number> }).choices,
    ).length,
  ).toBe(1);
  scheduler.stop();
});
it('restart uses committed remainder, pauses, and rejects former callbacks', async () => {
  const { room, repository } = await fixture();
  const former = room.automaticTask()!;
  await vi.advanceTimersByTimeAsync(400);
  await send(room, { type: 'pause' });
  await send(room, { type: 'resume' });
  const restored = new RoomCoordinator(timed, bot, repository);
  expect(restored.view().automaticTiming).toMatchObject({
    remainingMs: 600,
    running: false,
  });
  await vi.advanceTimersByTimeAsync(5000);
  expect(await restored.runAutomatic(former)).toBe(false);
  await send(restored, { type: 'resume' });
  await vi.advanceTimersByTimeAsync(600);
  expect(await restored.runAutomatic(restored.automaticTask()!)).toBe(true);
});
it('late player intent cannot beat an expired deadline', async () => {
  const { room, players } = await fixture();
  const view = room.view(players[0]);
  const intent = envelope(
    room,
    {
      type: 'game',
      decisionId: view.decisionId!,
      action: { type: 'choose', value: 3 },
    },
    players[0],
  );
  await vi.advanceTimersByTimeAsync(1000);
  expect(await room.command(players[0], intent)).toMatchObject({ ok: false });
  expect(
    Object.keys(
      (room.view().gameView as { choices: Record<string, number> }).choices,
    ).length,
  ).toBe(1);
});
it('stale callbacks and duplicate expiries cannot advance another phase', async () => {
  const { room } = await fixture();
  const task = room.automaticTask()!;
  expect(await room.runAutomatic(task)).toBe(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await room.runAutomatic(task)).toBe(true);
  expect(await room.runAutomatic(task)).toBe(false);
  expect(
    Object.keys(
      (room.view().gameView as { choices: Record<string, number> }).choices,
    ).length,
  ).toBe(1);
});
it('failed expiry save publishes no result and requires explicit recovery', async () => {
  const { room, repository } = await fixture();
  const task = room.automaticTask()!;
  let results = 0;
  room.subscribe((feedback) => {
    if (feedback) results++;
  });
  repository.fail = true;
  await vi.advanceTimersByTimeAsync(1000);
  expect(await room.runAutomatic(task)).toBe(false);
  expect(
    Object.keys(
      (room.view().gameView as { choices: Record<string, number> }).choices,
    ).length,
  ).toBe(0);
  expect(room.automaticTask()).toBeNull();
  expect(results).toBe(0);
  repository.fail = false;
  expect((await send(room, { type: 'resume' })).ok).toBe(true);
  expect(await room.runAutomatic(room.automaticTask()!)).toBe(true);
});
it('rejects damaged clock state instead of silently resetting penalties', async () => {
  const { repository } = await fixture();
  repository.value!.automaticClock!.remainingMs = 1001;
  expect(() => new RoomCoordinator(timed, bot, repository)).toThrow(
    'damaged-save',
  );
});
it('an automatic transition must leave its expired phase', async () => {
  const game: GameRules = {
    ...timed,
    applyAutomatic: (state) => ({
      state,
      decision: { label: 'unchanged', revealedInformation: false },
    }),
  };
  const { room } = await fixture(game);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await room.runAutomatic(room.automaticTask()!)).toBe(false);
  expect(room.view().paused).toBe(true);
});

it('rollback opens the original phase with its full clock and revokes old expiry', async () => {
  const { room } = await fixture();
  const task = room.automaticTask()!;
  await vi.advanceTimersByTimeAsync(1000);
  expect(await room.runAutomatic(task)).toBe(true);
  const checkpointId = room.view(room.hostToken).history[0]!.id;
  expect((await send(room, { type: 'rollback', checkpointId })).ok).toBe(true);
  expect(room.view().automaticTiming).toMatchObject({
    remainingMs: 1000,
    running: false,
  });
  expect(await room.runAutomatic(task)).toBe(false);
  expect((await send(room, { type: 'resume' })).ok).toBe(true);
  expect(await room.runAutomatic(task)).toBe(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await room.runAutomatic(room.automaticTask()!)).toBe(true);
});

it('same-phase saved choices cannot restart the deadline', async () => {
  const game: GameRules = {
    ...timed,
    apply: (state) => ({
      state,
      decision: { label: '已选择', revealedInformation: false },
    }),
  };
  const { room, players } = await fixture(game);
  await vi.advanceTimersByTimeAsync(300);
  const view = room.view(players[0]);
  expect(
    (
      await send(
        room,
        {
          type: 'game',
          decisionId: view.decisionId!,
          action: { type: 'choose', value: 1 },
        },
        players[0],
      )
    ).ok,
  ).toBe(true);
  expect(room.view().automaticTiming?.remainingMs).toBe(700);
  await vi.advanceTimersByTimeAsync(700);
  expect(await room.runAutomatic(room.automaticTask()!)).toBe(true);
});

it('shutdown closes admission and cancels scheduler without new writes', async () => {
  const { room, repository } = await fixture();
  const scheduler = new AutomaticScheduler(room);
  const saved = structuredClone(repository.value);
  expect(await room.beginShutdown()).toBe('drained');
  scheduler.stop();
  await vi.advanceTimersByTimeAsync(5000);
  expect(room.automaticTask()).toBeNull();
  expect(repository.value).toEqual(saved);
});
