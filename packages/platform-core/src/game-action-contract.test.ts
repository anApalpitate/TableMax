import { describe, expect, it } from 'vitest';
import type { GameRules, JsonValue } from '@tablemax/game-sdk';
import type { Command } from '@tablemax/protocol';
import { rules, bot } from '../../../games/template';
import type { Save, SaveRepository } from './model';
import { RoomCoordinator } from './room';

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
  credential: string,
  command: Command['command'],
): Command {
  const { instanceId, revision, branch } = room.view(credential);
  return {
    actionId: crypto.randomUUID(),
    instanceId,
    revision,
    branch,
    command,
  };
}
type ParametricRules = GameRules & {
  isLegalAction(state: JsonValue, action: JsonValue, seatId: string): boolean;
};
function parameterized(): ParametricRules {
  return {
    ...rules,
    legalActions: () => [{ type: 'choose', value: 1 }],
    isLegalAction: (_state, action) =>
      (action as { value: number }).value === 3,
  };
}
async function fixture(game: GameRules = parameterized(), bots = false) {
  const repository = new Repository();
  const room = new RoomCoordinator(game, bot, repository);
  const players: { token: string }[] = [];
  for (const name of ['甲', '乙']) {
    if (bots) {
      expect(
        (
          await room.command(
            room.hostToken,
            envelope(room, room.hostToken, { type: 'add-bot', name }),
          )
        ).ok,
      ).toBe(true);
    } else {
      const player = await room.join(name);
      players.push(player);
      expect(
        (
          await room.command(
            player.token,
            envelope(room, player.token, { type: 'ready', ready: true }),
          )
        ).ok,
      ).toBe(true);
    }
  }
  expect(
    (
      await room.command(
        room.hostToken,
        envelope(room, room.hostToken, { type: 'start' }),
      )
    ).ok,
  ).toBe(true);
  return { repository, room, players };
}
function choose(room: RoomCoordinator, credential: string, value: number) {
  return envelope(room, credential, {
    type: 'game',
    decisionId: room.view(credential).decisionId!,
    action: { type: 'choose', value },
  });
}

describe('parameterized game action contract', () => {
  it('accepts a complete parameterized action outside the bounded suggestions', async () => {
    const { room, repository, players } = await fixture();
    const actor = players[0]!;
    expect(room.view(actor.token).actions).toEqual([
      { type: 'choose', value: 1 },
    ]);
    expect(
      (await room.command(actor.token, choose(room, actor.token, 3))).ok,
    ).toBe(true);
    expect(
      (repository.value!.snapshot!.state as { choices: Record<string, number> })
        .choices[room.view(actor.token).self.seatId!],
    ).toBe(3);
    expect(repository.value!.history).toHaveLength(1);
  });
  it('uses authoritative validation even when an action is in the suggestions', async () => {
    const { room, repository, players } = await fixture();
    const before = structuredClone(repository.value);
    expect(
      await room.command(players[0]!.token, choose(room, players[0]!.token, 1)),
    ).toEqual({ ok: false, reason: 'illegal-action' });
    expect(repository.value).toEqual(before);
  });
  it('isolates state and action from a validator and rejects exceptions safely', async () => {
    const game = parameterized();
    game.isLegalAction = (state, action) => {
      (state as { turn: number }).turn = 99;
      (action as { value: number }).value = 2;
      throw new Error('private diagnostic');
    };
    const { room, repository, players } = await fixture(game);
    const before = structuredClone(repository.value);
    const request = choose(room, players[0]!.token, 3);
    expect(await room.command(players[0]!.token, request)).toEqual({
      ok: false,
      reason: 'illegal-action',
    });
    expect(repository.value).toEqual(before);
    expect(
      (request.command as unknown as { action: { value: number } }).action
        .value,
    ).toBe(3);
    expect(room.view(players[0]!.token).decisionId).toBe('choose-0');
  });
  it('retains exact-list validation for games without the extension', async () => {
    const { room, repository, players } = await fixture({
      ...rules,
      legalActions: () => [{ type: 'choose', value: 1 }],
    });
    const before = structuredClone(repository.value);
    expect(
      await room.command(players[0]!.token, choose(room, players[0]!.token, 3)),
    ).toEqual({ ok: false, reason: 'illegal-action' });
    expect(repository.value).toEqual(before);
    expect(
      (
        await room.command(
          players[0]!.token,
          choose(room, players[0]!.token, 1),
        )
      ).ok,
    ).toBe(true);
  });
  it('validates bot-generated plans through the same contract', async () => {
    const { room } = await fixture(parameterized(), true);
    const task = room.botTask()!;
    expect(task.actions).toEqual([{ type: 'choose', value: 1 }]);
    expect(
      (await room.submitBot(task, { type: 'choose', value: 3 }, null, 123)).ok,
    ).toBe(true);
  });
  it('does not expand lifecycle authority or save rejected plans', async () => {
    const { room, repository } = await fixture();
    const before = structuredClone(repository.value);
    expect(
      (
        await room.command(
          room.hostToken,
          envelope(room, room.hostToken, {
            type: 'lifecycle',
            action: { type: 'next-round' },
          }),
        )
      ).ok,
    ).toBe(false);
    expect(repository.value).toEqual(before);
  });
  it('preserves atomic save failure, retry and duplicate receipt semantics', async () => {
    const { room, repository, players } = await fixture();
    const request = choose(room, players[0]!.token, 3);
    const before = structuredClone(repository.value);
    repository.fail = true;
    expect((await room.command(players[0]!.token, request)).ok).toBe(false);
    expect(repository.value).toEqual(before);
    repository.fail = false;
    expect((await room.command(players[0]!.token, request)).ok).toBe(true);
    const writes = repository.writes;
    expect((await room.command(players[0]!.token, request)).ok).toBe(true);
    expect(repository.writes).toBe(writes);
    expect(repository.value!.history).toHaveLength(1);
  });
});
