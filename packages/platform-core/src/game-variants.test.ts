import { describe, expect, it } from 'vitest';
import { rules, bot } from '../../../games/template';
import type { Command } from '@tablemax/protocol';
import { GameRegistry } from './game-registry';
import { RoomCoordinator } from './room';
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
const variants = [
  { id: 'original', name: '原版', description: '旧版兼容' },
  { id: 'expansion', name: '扩展版', description: '新规则' },
];
function registry() {
  return new GameRegistry([
    {
      catalog: {
        id: rules.manifest.id,
        name: rules.manifest.name,
        ...rules.manifest.players,
        defaultVariantId: 'original',
        variants,
      },
      load: async (variantId?: string) =>
        variantId === 'expansion'
          ? {
              rules: {
                ...rules,
                manifest: { ...rules.manifest, rulesVersion: 'expansion-test' },
              },
              bot: { ...bot, rulesVersion: 'expansion-test' },
            }
          : { rules, bot },
    },
  ]);
}
function envelope(
  room: RoomCoordinator,
  command: Command['command'],
  token = room.hostToken,
): Command {
  const { instanceId, revision, branch } = room.view(token);
  return {
    actionId: crypto.randomUUID(),
    instanceId,
    revision,
    branch,
    command,
  };
}
describe('authoritative game variants', () => {
  it('selects an initial game only for a fresh repository and preserves saved selection', async () => {
    const repository = new Repository();
    const room = await RoomCoordinator.open(
      registry(),
      repository,
      undefined,
      undefined,
      rules.manifest.id,
    );
    expect(room.view().game?.id).toBe(rules.manifest.id);
    expect(room.view().game?.variantId).toBe('original');
    await room.command(
      room.hostToken,
      envelope(room, { type: 'set-play-mode', mode: 'test' }),
    );
    const restored = await RoomCoordinator.open(
      registry(),
      repository,
      undefined,
      undefined,
      'not-installed',
    );
    expect(restored.view().game?.id).toBe(rules.manifest.id);
    expect(restored.view().instanceId).toBe(room.view().instanceId);
  });
  it('rejects ambiguous default and duplicate variant metadata', () => {
    const catalog = registry().catalog()[0]!;
    const { defaultVariantId: _default, ...withoutDefault } = catalog;
    void _default;
    for (const invalid of [
      { ...catalog, defaultVariantId: 'unknown' },
      { ...catalog, variants: [variants[0]!, variants[0]!] },
      withoutDefault,
    ])
      expect(
        () =>
          new GameRegistry([
            { catalog: invalid, load: async () => ({ rules, bot }) },
          ]),
      ).toThrow('invalid-game-variants');
  });
  it('defaults legacy saves to original and refuses uninstalled variants', async () => {
    const games = registry();
    expect((await games.load(rules.manifest.id)).variantId).toBe('original');
    await expect(games.load(rules.manifest.id, 'unknown')).rejects.toThrow();
    const repository = new Repository();
    const room = await RoomCoordinator.open(games, repository);
    await room.command(
      room.hostToken,
      envelope(room, { type: 'select-game', gameId: rules.manifest.id }),
    );
    delete repository.value!.variantId;
    const restored = await RoomCoordinator.open(games, repository);
    expect(restored.view().game?.variantId).toBe('original');
    expect(repository.value!.variantId).toBe('original');
  });
  it('preserves identities and owner, clears readiness, and saves switching atomically', async () => {
    const repository = new Repository();
    const room = await RoomCoordinator.open(registry(), repository);
    await room.command(
      room.hostToken,
      envelope(room, { type: 'select-game', gameId: rules.manifest.id }),
    );
    const player = await room.join('玩家');
    const seatId = room.view(player.token).self.seatId!;
    await room.command(
      room.hostToken,
      envelope(room, { type: 'set-owner', seatId }),
    );
    await room.command(
      player.token,
      envelope(room, { type: 'ready', ready: true }, player.token),
    );
    const change: Command['command'] = {
      type: 'select-variant',
      variantId: 'expansion',
    };
    expect(
      (await room.command(player.token, envelope(room, change, player.token)))
        .ok,
    ).toBe(false);
    const before = room.view(player.token);
    repository.fail = true;
    expect(
      (await room.command(room.hostToken, envelope(room, change))).ok,
    ).toBe(false);
    expect(room.view(player.token)).toEqual(before);
    repository.fail = false;
    expect(
      (await room.command(room.hostToken, envelope(room, change))).ok,
    ).toBe(true);
    const after = room.view(player.token);
    expect(after.game?.variantId).toBe('expansion');
    expect(after.self.seatId).toBe(seatId);
    expect(after.ownerSeatId).toBe(seatId);
    expect(after.seats[0]?.ready).toBe(false);
    expect(after.instanceId).not.toBe(before.instanceId);
    const restored = await RoomCoordinator.open(registry(), repository);
    expect(restored.view(player.token).game?.variantId).toBe('expansion');
    expect(restored.view(player.token).self.seatId).toBe(seatId);
  });
  it('rejects version switching during play and invalidates old bot tasks after a switch', async () => {
    const room = await RoomCoordinator.open(registry(), new Repository());
    await room.command(
      room.hostToken,
      envelope(room, { type: 'select-game', gameId: rules.manifest.id }),
    );
    for (let i = 0; i < 2; i++)
      await room.command(
        room.hostToken,
        envelope(room, { type: 'add-bot', name: `bot${i}` }),
      );
    await room.command(room.hostToken, envelope(room, { type: 'start' }));
    const task = room.botTask()!;
    expect(
      (
        await room.command(
          room.hostToken,
          envelope(room, { type: 'select-variant', variantId: 'expansion' }),
        )
      ).ok,
    ).toBe(false);
    await room.command(room.hostToken, envelope(room, { type: 'end' }));
    expect(
      (
        await room.command(
          room.hostToken,
          envelope(room, { type: 'select-variant', variantId: 'expansion' }),
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await room.submitBot(
          task,
          task.actions[0]!,
          task.data.memory,
          task.data.random,
        )
      ).ok,
    ).toBe(false);
  });
});
