import { expect, it, vi } from 'vitest';
import type { Command, RoomView } from '@tablemax/protocol';
import type { JsonValue } from '@tablemax/game-sdk';
import { RoomCoordinator, token } from './room';
import { GameRegistry } from './game-registry';
import type { Save, SaveExtras, SaveRepository } from './model';
import { rules, bot } from '../../../games/pokemon-encounters';
import {
  rules as templateRules,
  bot as templateBot,
} from '../../../games/template';

class Repository implements SaveRepository {
  value: Save | null = null;
  fail = false;
  saved: Save[] = [];
  transactions: { value: Save; extras: SaveExtras | undefined }[] = [];
  load() {
    return structuredClone(this.value);
  }
  save(value: Save, extras?: SaveExtras) {
    if (this.fail) throw new Error('disk full');
    this.transactions.push(structuredClone({ value, extras }));
    this.saved.push(...(extras?.journal ?? []), value);
    this.value = structuredClone(value);
  }
}
function envelope(view: RoomView, command: Command['command']): Command {
  return {
    actionId: token(),
    instanceId: view.instanceId,
    branch: view.branch,
    revision: view.revision,
    command,
  };
}
function send(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
) {
  return room.command(credential, envelope(room.view(credential), command));
}
async function pokemon(count = 2) {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  const players = [];
  for (let n = 0; n < count; n++) players.push(await room.join(`朋友${n}`));
  return { room, repository, players };
}
async function start(room: RoomCoordinator, players: { token: string }[]) {
  const commands = players.map((player) =>
    envelope(room.view(player.token), { type: 'ready', ready: true }),
  );
  expect(
    (
      await Promise.all(
        players.map((player, i) => room.command(player.token, commands[i]!)),
      )
    ).every((reply) => reply.ok),
  ).toBe(true);
  expect((await send(room, { type: 'start' })).ok).toBe(true);
}
function flip(view: RoomView, slot = 0) {
  return envelope(view, {
    type: 'game',
    decisionId: view.decisionId!,
    action: { type: 'initial-flip', slot },
  });
}

it.each([2, 6])(
  'accepts %i simultaneous independent flips from one revision without changing other selections',
  async (count) => {
    const { room, repository, players } = await pokemon(count);
    await start(room, players);
    const before = players.map((player) => room.view(player.token));
    const inputs = before.map((view) => flip(view));
    const first = await room.command(players[0]!.token, inputs[0]!);
    expect(first.ok).toBe(true);
    expect(room.view(players[1]!.token).selectionToken).toBe(
      before[1]!.selectionToken,
    );
    const replies = await Promise.all(
      players
        .slice(1)
        .map((player, i) => room.command(player.token, inputs[i + 1]!)),
    );
    expect(replies.every((reply) => reply.ok)).toBe(true);
    const result = room.view().gameView as {
      phase: string;
      initialDone: string[];
    };
    expect(result.phase).toBe('draw');
    expect(result.initialDone).toHaveLength(count);
    expect(room.view(room.hostToken).history).toHaveLength(count);
    expect(await room.command(players[0]!.token, inputs[0]!)).toEqual(first);
    expect(room.view(room.hostToken).history).toHaveLength(count);
    // All previously persisted versions are unchanged even though histories share snapshots.
    expect(
      (
        repository.saved.at(-(count + 1))!.snapshot!.state as {
          initialDone: string[];
        }
      ).initialDone,
    ).toEqual([]);
    expect(
      (
        repository.saved.at(-count)!.snapshot!.state as {
          initialDone: string[];
        }
      ).initialDone,
    ).toHaveLength(1);
  },
);

it('accepts one distinct action per decision and rejects old intents after pause/resume, rollback and restart', async () => {
  const { room, repository, players } = await pokemon();
  await start(room, players);
  const a = players[0]!.token,
    b = players[1]!.token;
  const view = room.view(a),
    late = flip(room.view(b));
  const result = await Promise.all([
    room.command(a, flip(view, 0)),
    room.command(a, flip(view, 1)),
  ]);
  expect(result.filter((reply) => reply.ok)).toHaveLength(1);
  await send(room, { type: 'pause' });
  await send(room, { type: 'resume' });
  expect(await room.command(b, late)).toEqual({
    ok: false,
    reason: 'stale-revision',
  });
  const current = flip(room.view(b));
  await send(room, {
    type: 'rollback',
    checkpointId: room.view(room.hostToken).history[0]!.id,
  });
  expect(await room.command(b, current)).toEqual({
    ok: false,
    reason: 'stale-branch',
  });
  await send(room, { type: 'resume' });
  const old = flip(room.view(b));
  const restored = new RoomCoordinator(rules, bot, repository);
  expect(await restored.command(b, old)).toEqual({
    ok: false,
    reason: 'stale-branch',
  });
});

it('keeps each seat readiness ordered while allowing other seats to prepare concurrently', async () => {
  const { room, players } = await pokemon();
  const [a, b] = players.map((player) => player.token) as [string, string];
  const oldA = envelope(room.view(a), { type: 'ready', ready: true });
  const oldB = envelope(room.view(b), { type: 'ready', ready: true });
  expect((await room.command(a, oldA)).ok).toBe(true);
  expect((await send(room, { type: 'ready', ready: false }, a)).ok).toBe(true);
  expect((await room.command(b, oldB)).ok).toBe(true);
  expect(await room.command(a, { ...oldA, actionId: token() })).toEqual({
    ok: false,
    reason: 'stale-revision',
  });
  expect(room.view(a).seats[0]!.ready).toBe(false);
  const obsolete = envelope(room.view(a), { type: 'ready', ready: true });
  await send(room, { type: 'set-owner', seatId: room.view(a).self.seatId });
  expect(await room.command(a, obsolete)).toEqual({
    ok: false,
    reason: 'stale-revision',
  });
});

it('does not consume an independent choice or publish feedback when saving fails', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
  try {
    const { room, repository, players } = await pokemon();
    await start(room, players);
    const first = players[0]!.token,
      second = players[1]!.token;
    const input = flip(room.view(first)),
      other = flip(room.view(second));
    const before = room.view(first);
    const listener = vi.fn();
    room.subscribe(listener);
    repository.fail = true;
    expect(await room.command(first, input)).toEqual({
      ok: false,
      reason: 'save-or-action-failed',
    });
    expect(room.view(first)).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
    repository.fail = false;
    expect((await room.command(second, other)).ok).toBe(true);
    expect((await room.command(first, input)).ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
  } finally {
    clock.mockRestore();
  }
});

it('delegates only common match controls, persists ownership and never exposes another player secrets', async () => {
  const repository = new Repository();
  let room = new RoomCoordinator(templateRules, templateBot, repository);
  const a = await room.join('房主'),
    b = await room.join('朋友');
  const seat = room.view(a.token).self.seatId!;
  await send(room, { type: 'set-owner', seatId: seat });
  expect(room.view(a.token).capabilities).toEqual({
    manage: false,
    manageSeats: true,
    control: true,
  });
  expect(room.view(b.token).capabilities).toEqual({
    manage: false,
    manageSeats: false,
    control: false,
  });
  expect(room.view().capabilities).toEqual({
    manage: false,
    manageSeats: false,
    control: false,
  });
  await send(room, { type: 'ready', ready: true }, a.token);
  await send(room, { type: 'ready', ready: true }, b.token);
  expect((await send(room, { type: 'start' }, a.token)).ok).toBe(true);
  expect((await send(room, { type: 'pause' }, a.token)).ok).toBe(true);
  expect((await send(room, { type: 'resume' }, a.token)).ok).toBe(true);
  for (const command of [
    { type: 'end' },
    { type: 'new-room' },
    { type: 'set-play-mode', mode: 'test' },
    { type: 'set-owner', seatId: null },
    { type: 'select-game', gameId: 'template' },
    { type: 'add-bot', name: '越权' },
    { type: 'rollback', checkpointId: 'bad' },
    { type: 'order', seats: [] },
    { type: 'join-open', open: true },
  ] as Command['command'][])
    expect(await send(room, command, a.token)).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
  expect(
    await send(room, { type: 'remove-seat', seatId: seat }, a.token),
  ).toEqual({
    ok: false,
    reason: 'end-first',
  });
  for (const player of [a, b]) {
    const view = room.view(player.token);
    expect(
      (
        await send(
          room,
          {
            type: 'game',
            decisionId: view.decisionId!,
            action: view.actions[0] as JsonValue,
          },
          player.token,
        )
      ).ok,
    ).toBe(true);
  }
  expect(room.view(a.token).history).toEqual([]);
  expect(room.view(a.token).lifecycleActions).toEqual([{ type: 'next-round' }]);
  expect(room.view(b.token).lifecycleActions).toEqual([]);
  expect(
    (
      await send(
        room,
        { type: 'lifecycle', action: { type: 'next-round' } },
        a.token,
      )
    ).ok,
  ).toBe(true);
  const pendingPause = envelope(room.view(a.token), { type: 'pause' });
  await send(room, {
    type: 'set-owner',
    seatId: room.view(b.token).self.seatId,
  });
  expect((await room.command(a.token, pendingPause)).ok).toBe(false);
  expect(await send(room, { type: 'pause' }, a.token)).toEqual({
    ok: false,
    reason: 'unauthorized',
  });
  expect((await send(room, { type: 'pause' }, b.token)).ok).toBe(true);
  room = new RoomCoordinator(templateRules, templateBot, repository);
  expect(room.view(b.token).capabilities.control).toBe(true);
  expect((room.view().gameView as { ownSecret: null }).ownSecret).toBeNull();
  await send(room, { type: 'end' });
  expect((await send(room, { type: 'replay' }, b.token)).ok).toBe(true);
  expect(room.view(b.token).capabilities.control).toBe(true);
  expect(room.view().seats.every((entry) => !entry.ready)).toBe(true);
  await send(room, {
    type: 'remove-seat',
    seatId: room.view(b.token).self.seatId!,
  });
  expect(room.view().ownerSeatId).toBeNull();
});

it('labels administrator termination correctly and blocks next rounds for both new and legacy termination saves', async () => {
  const repository = new Repository();
  const game = { ...templateRules, ended: () => false };
  let room = new RoomCoordinator(game, templateBot, repository);
  const players = [await room.join('甲'), await room.join('乙')];
  await start(room, players);
  for (const player of players) {
    const current = room.view(player.token);
    await send(
      room,
      {
        type: 'game',
        decisionId: current.decisionId!,
        action: current.actions[0] as JsonValue,
      },
      player.token,
    );
  }
  expect(room.view(room.hostToken).lifecycleActions).toEqual([
    { type: 'next-round' },
  ]);
  await send(room, { type: 'end' });
  expect(room.view().endReason).toBe('管理员结束');
  expect(room.view(room.hostToken).lifecycleActions).toEqual([]);
  expect(
    await send(room, { type: 'lifecycle', action: { type: 'next-round' } }),
  ).toEqual({ ok: false, reason: 'not-actionable' });
  repository.value!.endReason = '房主结束';
  room = new RoomCoordinator(game, templateBot, repository);
  expect(room.view(room.hostToken).lifecycleActions).toEqual([]);
  expect(
    await send(room, { type: 'lifecycle', action: { type: 'next-round' } }),
  ).toEqual({ ok: false, reason: 'not-actionable' });
});

function registry() {
  const pokemon = vi.fn(async () => ({ rules, bot }));
  const template = vi.fn(async () => ({
    rules: templateRules,
    bot: templateBot,
  }));
  const entries = new GameRegistry([
    {
      catalog: {
        id: rules.manifest.id,
        name: rules.manifest.name,
        ...rules.manifest.players,
      },
      load: pokemon,
    },
    {
      catalog: {
        id: templateRules.manifest.id,
        name: templateRules.manifest.name,
        ...templateRules.manifest.players,
      },
      load: template,
    },
  ]);
  return { entries, pokemon, template };
}
it('restores an unselected saved lobby without loading game code or parsing its save twice', async () => {
  const repository = new Repository(),
    loaders = registry();
  let room = await RoomCoordinator.open(loaders.entries, repository);
  await send(room, { type: 'set-play-mode', mode: 'test' });
  const read = vi.spyOn(repository, 'load');
  room = await RoomCoordinator.open(loaders.entries, repository);
  expect(read).toHaveBeenCalledTimes(1);
  expect(room.view().game).toBeNull();
  expect(room.view().playMode).toBe('test');
  expect(loaders.pokemon).not.toHaveBeenCalled();
  expect(loaders.template).not.toHaveBeenCalled();
});

it('serializes a delayed game load with later commands and publishes nothing until the new game is saved', async () => {
  const repository = new Repository(),
    loaders = registry();
  const room = await RoomCoordinator.open(loaders.entries, repository);
  await send(room, { type: 'select-game', gameId: 'pokemon-encounters' });
  let finishLoad: (() => void) | undefined;
  loaders.template.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishLoad = () => resolve({ rules: templateRules, bot: templateBot });
      }),
  );
  const previous = room.view(room.hostToken);
  const listener = vi.fn();
  room.subscribe(listener);
  const loading = room.command(
    room.hostToken,
    envelope(previous, { type: 'select-game', gameId: 'template' }),
  );
  await vi.waitFor(() => expect(finishLoad).toBeDefined());
  const late = room.command(
    room.hostToken,
    envelope(previous, { type: 'add-bot', name: '旧游戏人机' }),
  );
  expect(room.view(room.hostToken)).toEqual(previous);
  expect(listener).not.toHaveBeenCalled();
  finishLoad!();
  expect((await loading).ok).toBe(true);
  expect(await late).toEqual({ ok: false, reason: 'stale-instance' });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(room.view().game!.id).toBe('template');
  expect(room.view().seats).toEqual([]);
});

it('does not grant unsaved ownership and never selects a bot or legacy hostSeat as the phone owner', async () => {
  const { room, repository, players } = await pokemon();
  await send(room, { type: 'add-bot', name: '人机' });
  const botSeat = room.view().seats.find((seat) => seat.controller === 'bot')!;
  expect(await send(room, { type: 'set-owner', seatId: botSeat.id })).toEqual({
    ok: false,
    reason: 'invalid-seat',
  });
  const human = room.view(players[0]!.token).self.seatId!;
  repository.fail = true;
  expect(await send(room, { type: 'set-owner', seatId: human })).toEqual({
    ok: false,
    reason: 'save-or-action-failed',
  });
  expect(room.view(players[0]!.token).capabilities.control).toBe(false);
  repository.fail = false;
  delete repository.value!.ownerSeatId;
  repository.value!.hostSeat = human;
  const legacy = new RoomCoordinator(rules, bot, repository);
  expect(legacy.view(players[0]!.token).capabilities.control).toBe(false);
  expect(legacy.view().ownerSeatId).toBeNull();
});
it('loads only the chosen game, retains ordered identities on switching and restores by saved manifest', async () => {
  const repository = new Repository(),
    loaders = registry();
  let room = await RoomCoordinator.open(loaders.entries, repository);
  expect(room.view().game).toBeNull();
  expect(room.view().catalog).toHaveLength(2);
  expect(loaders.pokemon).not.toHaveBeenCalled();
  expect(loaders.template).not.toHaveBeenCalled();
  await expect(room.join('太早')).rejects.toThrow('game-not-selected');
  const select = envelope(room.view(room.hostToken), {
    type: 'select-game',
    gameId: 'pokemon-encounters',
  });
  const selected = await room.command(room.hostToken, select);
  expect(selected.ok).toBe(true);
  expect(await room.command(room.hostToken, select)).toEqual(selected);
  expect(loaders.pokemon).toHaveBeenCalledTimes(1);
  expect(loaders.template).not.toHaveBeenCalled();
  const a = await room.join('朋友'),
    b = await room.join('朋友二');
  await send(room, {
    type: 'set-owner',
    seatId: room.view(a.token).self.seatId,
  });
  await start(room, [a, b]);
  expect(await send(room, { type: 'select-game', gameId: 'template' })).toEqual(
    { ok: false, reason: 'end-first' },
  );
  const old = room.view(a.token);
  await send(room, { type: 'end' });
  expect(
    (await send(room, { type: 'select-game', gameId: 'template' })).ok,
  ).toBe(true);
  const after = room.view(a.token);
  expect(after.game!.id).toBe('template');
  expect(after.gameView).toBeNull();
  expect(after.instanceId).not.toBe(old.instanceId);
  expect(after.self).toEqual(old.self);
  expect(after.ownerSeatId).toBe(old.ownerSeatId);
  expect(after.seats.map((seat) => seat.id)).toEqual(
    old.seats.map((seat) => seat.id),
  );
  expect(after.seats.every((seat) => !seat.ready)).toBe(true);
  expect(
    await room.command(a.token, envelope(old, { type: 'ready', ready: true })),
  ).toEqual({ ok: false, reason: 'stale-instance' });
  room = await RoomCoordinator.open(loaders.entries, repository);
  expect(room.view(a.token).game!.id).toBe('template');
  expect(loaders.pokemon).toHaveBeenCalledTimes(1);
  expect(loaders.template).toHaveBeenCalledTimes(2);
});

it('keeps the current game and persisted state intact on load/storage failures and rejects unsupported seat counts', async () => {
  const repository = new Repository(),
    loaders = registry();
  const room = await RoomCoordinator.open(loaders.entries, repository);
  repository.fail = true;
  expect(
    await send(room, { type: 'select-game', gameId: 'pokemon-encounters' }),
  ).toEqual({ ok: false, reason: 'save-or-action-failed' });
  expect(room.view().game).toBeNull();
  expect(repository.value).toBeNull();
  repository.fail = false;
  await send(room, { type: 'select-game', gameId: 'pokemon-encounters' });
  const before = room.view();
  loaders.template.mockRejectedValueOnce(new Error('missing local module'));
  expect(await send(room, { type: 'select-game', gameId: 'template' })).toEqual(
    { ok: false, reason: 'game-load-failed' },
  );
  expect(room.view()).toEqual(before);
  for (let n = 0; n < 6; n++) await room.join(`朋友${n}`);
  expect(await send(room, { type: 'select-game', gameId: 'template' })).toEqual(
    { ok: false, reason: 'too-many-seats' },
  );
  expect(room.view().game!.id).toBe('pokemon-encounters');
  expect(room.view().seats).toHaveLength(6);
});

it('limits owner seat management, renames bots after ending, and removes into a recoverable new lobby atomically', async () => {
  const repository = new Repository();
  let room = new RoomCoordinator(templateRules, templateBot, repository);
  const owner = await room.join('房主');
  const friend = await room.join('朋友');
  const ownerSeat = room.view(owner.token).self.seatId!;
  const friendSeat = room.view(friend.token).self.seatId!;
  await send(room, { type: 'add-bot', name: '电脑' });
  const botSeat = room.view().seats.find((seat) => seat.controller === 'bot')!;
  await send(room, { type: 'set-owner', seatId: ownerSeat });

  expect(room.view(owner.token).capabilities.manageSeats).toBe(true);
  for (const command of [
    { type: 'remove-seat', seatId: botSeat.id },
    { type: 'set-bot-name', seatId: botSeat.id, name: '越权' },
  ] as Command['command'][])
    expect(await send(room, command, friend.token)).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
  expect(
    await send(room, { type: 'remove-seat', seatId: ownerSeat }, owner.token),
  ).toEqual({ ok: false, reason: 'cannot-remove-self' });
  expect(
    await send(
      room,
      { type: 'set-bot-name', seatId: friendSeat, name: '改真人' },
      owner.token,
    ),
  ).toEqual({ ok: false, reason: 'invalid-seat' });
  for (const name of ['', ' '.repeat(3), '长'.repeat(25)])
    expect(
      await send(
        room,
        { type: 'set-bot-name', seatId: botSeat.id, name },
        owner.token,
      ),
    ).toEqual({ ok: false, reason: 'invalid-message' });
  expect(
    (
      await send(
        room,
        { type: 'set-bot-name', seatId: botSeat.id, name: '  豆豆  ' },
        owner.token,
      )
    ).ok,
  ).toBe(true);
  expect(room.view().seats.find((seat) => seat.id === botSeat.id)?.name).toBe(
    '豆豆',
  );

  await start(room, [owner, friend]);
  expect(
    await send(room, { type: 'remove-seat', seatId: friendSeat }, owner.token),
  ).toEqual({ ok: false, reason: 'end-first' });
  expect(
    await send(
      room,
      { type: 'set-bot-name', seatId: botSeat.id, name: '进行中' },
      owner.token,
    ),
  ).toEqual({ ok: false, reason: 'end-first' });
  expect(await send(room, { type: 'end' }, owner.token)).toEqual({
    ok: false,
    reason: 'unauthorized',
  });
  await send(room, { type: 'end' });
  const ended = room.view(owner.token);
  expect(
    (
      await send(
        room,
        { type: 'set-bot-name', seatId: botSeat.id, name: '朋友' },
        owner.token,
      )
    ).ok,
  ).toBe(true);
  expect(room.view(owner.token).instanceId).toBe(ended.instanceId);
  expect(room.view(owner.token).gameView).toEqual(ended.gameView);
  const beforeRemoval = room.view(owner.token);
  const removal = envelope(beforeRemoval, {
    type: 'remove-seat',
    seatId: friendSeat,
  });
  repository.fail = true;
  expect(await room.command(owner.token, removal)).toEqual({
    ok: false,
    reason: 'save-or-action-failed',
  });
  expect(room.view(owner.token)).toEqual(beforeRemoval);
  repository.fail = false;
  const removed = await room.command(owner.token, removal);
  expect(removed.ok).toBe(true);
  expect(await room.command(owner.token, removal)).toEqual(removed);
  const after = room.view(owner.token);
  expect(after.instanceId).not.toBe(ended.instanceId);
  expect(after.status).toBe('lobby');
  expect(after.gameView).toBeNull();
  expect(after.ownerSeatId).toBe(ownerSeat);
  expect(after.seats.map((seat) => [seat.id, seat.name, seat.ready])).toEqual([
    [ownerSeat, '房主', false],
    [botSeat.id, '朋友', true],
  ]);
  expect(after.seats.map((seat) => seat.avatarId)).toEqual(
    beforeRemoval.seats
      .filter((seat) => seat.id !== friendSeat)
      .map((seat) => seat.avatarId),
  );
  expect(() => room.view(friend.token)).toThrow('invalid-identity');
  expect(repository.value!.history).toEqual([]);
  expect(
    repository.saved
      .slice()
      .reverse()
      .find((save) => save.instanceId === ended.instanceId)!.status,
  ).toBe('ended');
  expect(
    await room.command(owner.token, envelope(ended, { type: 'replay' })),
  ).toEqual({ ok: false, reason: 'stale-instance' });
  room = new RoomCoordinator(templateRules, templateBot, repository);
  expect(room.view(owner.token).status).toBe('lobby');
  expect(room.view(owner.token).capabilities.manageSeats).toBe(true);
  await send(room, { type: 'remove-seat', seatId: ownerSeat });
  expect(room.view().ownerSeatId).toBeNull();
  expect(() => room.view(owner.token)).toThrow('invalid-identity');
});

it('ends and switches in one transaction, preserving the old game on failures and retrying the instance-changing receipt', async () => {
  const repository = new Repository();
  const loaders = registry();
  const room = await RoomCoordinator.open(loaders.entries, repository);
  await send(room, { type: 'select-game', gameId: 'pokemon-encounters' });
  const owner = await room.join('房主');
  const friend = await room.join('朋友');
  await send(room, {
    type: 'set-owner',
    seatId: room.view(owner.token).self.seatId,
  });
  await start(room, [owner, friend]);
  const before = room.view(room.hostToken);
  const lateAction = flip(room.view(friend.token));
  const input = envelope(before, {
    type: 'select-game',
    gameId: 'template',
    endCurrent: true,
  });
  const listener = vi.fn();
  room.subscribe(listener);
  expect(await room.command(owner.token, input)).toEqual({
    ok: false,
    reason: 'unauthorized',
  });
  loaders.template.mockRejectedValueOnce(new Error('module unavailable'));
  expect(await room.command(room.hostToken, input)).toEqual({
    ok: false,
    reason: 'game-load-failed',
  });
  expect(room.view(room.hostToken)).toEqual(before);
  repository.fail = true;
  const transactionCount = repository.transactions.length;
  expect(await room.command(room.hostToken, input)).toEqual({
    ok: false,
    reason: 'save-or-action-failed',
  });
  expect(room.view(room.hostToken)).toEqual(before);
  expect(repository.transactions).toHaveLength(transactionCount);
  expect(listener).not.toHaveBeenCalled();
  repository.fail = false;
  const reply = await room.command(room.hostToken, input);
  expect(reply.ok).toBe(true);
  expect(await room.command(room.hostToken, input)).toEqual(reply);
  expect(listener).toHaveBeenCalledTimes(1);
  const transaction = repository.transactions.at(-1)!;
  expect(transaction.extras?.journal).toHaveLength(1);
  expect(transaction.extras!.journal![0]).toMatchObject({
    instanceId: before.instanceId,
    revision: before.revision + 1,
    status: 'ended',
    endReason: '管理员结束',
    decisionClocks: [],
  });
  expect(transaction.value.status).toBe('lobby');
  expect(transaction.value.manifest!.id).toBe('template');
  const after = room.view(owner.token);
  expect(after.self.seatId).toBe(before.ownerSeatId);
  expect(after.ownerSeatId).toBe(before.ownerSeatId);
  expect(after.seats.map((seat) => [seat.id, seat.avatarId])).toEqual(
    before.seats.map((seat) => [seat.id, seat.avatarId]),
  );
  expect(after.seats.every((seat) => !seat.ready)).toBe(true);
  expect(after.instanceId).not.toBe(before.instanceId);
  expect(await room.command(friend.token, lateAction)).toEqual({
    ok: false,
    reason: 'stale-instance',
  });
  const restored = await RoomCoordinator.open(loaders.entries, repository);
  expect(restored.view(owner.token).instanceId).toBe(after.instanceId);
  expect(restored.view(owner.token).game!.id).toBe('template');
});
