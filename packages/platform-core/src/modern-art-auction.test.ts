import { expect, it, vi } from 'vitest';
import type { Command, RoomView } from '@tablemax/protocol';
import { rules, bot } from '../../../games/modern-art';
import type { ModernArtView } from '../../../games/modern-art/ui/view';
import type { Save, SaveRepository } from './model';
import { RoomCoordinator } from './room';
import { decisionClockKey } from './countdown';

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
const envelope = (view: RoomView, command: Command['command']): Command => ({
  actionId: crypto.randomUUID(),
  instanceId: view.instanceId,
  branch: view.branch,
  revision: view.revision,
  command,
});
const bid = (view: RoomView, amount: number) =>
  envelope(view, {
    type: 'game',
    decisionId: view.decisionId!,
    action: { type: 'bid', amount },
  });
const pass = (view: RoomView) =>
  envelope(view, {
    type: 'game',
    decisionId: view.decisionId!,
    action: { type: 'pass' },
  });
async function openAuction(count = 3) {
  const repository = new Repository();
  const room = new RoomCoordinator(
    {
      ...rules,
      initialize: (context) =>
        rules.initialize({ ...context, random: { next: () => 0.999999 } }),
    },
    bot,
    repository,
  );
  const players = [];
  for (let index = 0; index < count; index++) {
    const player = await room.join(`玩家 ${index + 1}`);
    players.push(player);
    expect(
      (
        await room.command(
          player.token,
          envelope(room.view(player.token), { type: 'ready', ready: true }),
        )
      ).ok,
    ).toBe(true);
  }
  expect(
    (
      await room.command(
        room.hostToken,
        envelope(room.view(room.hostToken), { type: 'start' }),
      )
    ).ok,
  ).toBe(true);
  const view = room.view(players[0]!.token);
  const game = view.gameView as ModernArtView;
  const card = game.self!.hand.find((card) => card.auctionKind === 'open')!;
  expect(card).toBeDefined();
  expect(
    (
      await room.command(
        players[0]!.token,
        envelope(view, {
          type: 'game',
          decisionId: view.decisionId!,
          action: { type: 'offer', cardId: card.id },
        }),
      )
    ).ok,
  ).toBe(true);
  return { room, repository, players, card };
}

it.each([3, 5])(
  'accepts all %i same-price confirmations once and settles atomically',
  async (count) => {
    const { room, players, card } = await openAuction(count);
    const commands = players.map((player) => pass(room.view(player.token)));
    const before = room.view();
    const replies = await Promise.all(
      players.map((player, index) =>
        room.command(player.token, commands[index]!),
      ),
    );
    expect(replies.every((reply) => reply.ok)).toBe(true);
    expect(room.view().revision).toBe(before.revision + count);
    const game = room.view().gameView as ModernArtView;
    expect(game.auction).toBeNull();
    expect(
      game.players[
        players.map((p) => room.view(p.token).self.seatId)[0]!
      ]!.collection.map((c) => c.id),
    ).toEqual([card.id]);
    expect(game.history.filter((entry) => entry.verb === 'sale')).toHaveLength(
      1,
    );
    expect(await room.command(players[0]!.token, commands[0]!)).toEqual(
      replies[0],
    );
    expect(room.view().revision).toBe(before.revision + count);
  },
);

it('rejects a competing bid and old-price confirmation, then accepts a fresh higher bid', async () => {
  const { room, players } = await openAuction();
  const before = players.map((player) => room.view(player.token));
  const replies = await Promise.all([
    room.command(players[0]!.token, bid(before[0]!, 15)),
    room.command(players[1]!.token, bid(before[1]!, 20)),
  ]);
  expect(replies[0]!.ok).toBe(true);
  expect(replies[1]).toEqual({ ok: false, reason: 'stale-revision' });
  expect(await room.command(players[2]!.token, pass(before[2]!))).toEqual({
    ok: false,
    reason: 'stale-revision',
  });
  const current = room.view(players[2]!.token);
  expect(
    await room.command(players[2]!.token, {
      ...pass(before[2]!),
      revision: current.revision,
    }),
  ).toEqual({ ok: false, reason: 'stale-decision' });
  expect(
    (
      await room.command(
        players[1]!.token,
        bid(room.view(players[1]!.token), 20),
      )
    ).ok,
  ).toBe(true);
  expect((room.view().gameView as ModernArtView).auction!.currentBid).toBe(20);
  expect((room.view().gameView as ModernArtView).auction!.passes).toEqual([]);
});

it('does not replace the price window, consume confirmations, or publish feedback when saving fails', async () => {
  const { room, repository, players } = await openAuction();
  const before = players.map((player) => room.view(player.token));
  const saved = structuredClone(repository.value);
  const listener = vi.fn();
  room.subscribe(listener);
  repository.fail = true;
  const failedBid = bid(before[0]!, 15);
  expect(await room.command(players[0]!.token, failedBid)).toEqual({
    ok: false,
    reason: 'save-or-action-failed',
  });
  expect(room.view().revision).toBe(before[0]!.revision);
  expect(room.view(players[0]!.token).gameView).toEqual(before[0]!.gameView);
  expect(repository.value).toEqual(saved);
  expect(listener).not.toHaveBeenCalled();
  repository.fail = false;
  expect((await room.command(players[1]!.token, pass(before[1]!))).ok).toBe(
    true,
  );
  expect((await room.command(players[0]!.token, failedBid)).ok).toBe(true);
  expect(listener).toHaveBeenCalledTimes(2);
  expect((room.view().gameView as ModernArtView).auction!.passes).toEqual([]);
  expect(await room.command(players[2]!.token, pass(before[2]!))).toEqual({
    ok: false,
    reason: 'stale-revision',
  });
});

it('restores old open-auction per-seat clocks without resetting their remaining time or accepting damaged keys', async () => {
  const { room, repository, players } = await openAuction();
  const state = repository.value!.snapshot!.state;
  const pending = rules.decisions(state);
  const clock = repository.value!.decisionClocks![0]!;
  const valid = structuredClone(repository.value!);
  valid.gameWindow = null;
  valid.decisionClocks = pending.map((decision, index) => ({
    ...clock,
    id: crypto.randomUUID(),
    key: decisionClockKey({ id: decision.id, seatId: decision.seatId }),
    remainingMs: 17_000 - index * 1000,
  }));
  repository.value = structuredClone(valid);
  const restored = new RoomCoordinator(rules, bot, repository);
  expect(restored.view().paused).toBe(true);
  expect(restored.view(players[0]!.token).gameView).toEqual(
    room.view(players[0]!.token).gameView,
  );
  expect(restored.view().decisionClock!.remainingMs).toBe(15_000);
  expect(repository.value!.decisionClocks).toHaveLength(1);
  expect(repository.value!.gameWindow).toBeNull();
  for (const corrupt of [
    valid.decisionClocks.slice(1),
    [
      ...valid.decisionClocks,
      { ...valid.decisionClocks[0]!, key: '0'.repeat(64) },
    ],
    valid.decisionClocks.map((entry, index) =>
      index === 0 ? { ...entry, key: '0'.repeat(64) } : entry,
    ),
  ]) {
    repository.value = { ...structuredClone(valid), decisionClocks: corrupt };
    expect(() => new RoomCoordinator(rules, bot, repository)).toThrow(
      'damaged-save',
    );
  }
});
