import { afterEach, expect, it, vi } from 'vitest';
import {
  COUNTDOWN_STEPS,
  CountdownSecondsSchema,
  RoomViewSchema,
  type Command,
} from '@tablemax/protocol';
import type { BotStrategy, GameRules } from '@tablemax/game-sdk';
import { rules, bot } from '../../../games/template';
import {
  rules as pokemonRules,
  bot as pokemonBot,
} from '../../../games/pokemon-encounters';
import { rules as artRules, bot as artBot } from '../../../games/modern-art';
import { getCard } from '../../../games/modern-art/data/catalog';
import type { State as ArtState } from '../../../games/modern-art/rules/state';
import type { ModernArtView } from '../../../games/modern-art/ui/view';
import { RoomCoordinator, token } from './room';
import { GameRegistry } from './game-registry';
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
afterEach(() => vi.restoreAllMocks());
function clock() {
  let now = 1_900_000_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  return {
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}
function input(
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
  return room.command(credential, input(room, command, credential));
}
async function fixture(
  gameRules: GameRules = rules,
  strategy: BotStrategy = bot,
  count = 2,
) {
  const repository = new Repository();
  const room = new RoomCoordinator(gameRules, strategy, repository);
  const players = [];
  for (let i = 0; i < count; i++) {
    const player = await room.join(`玩家${i + 1}`);
    players.push(player.token);
    await send(room, { type: 'ready', ready: true }, player.token);
  }
  await send(room, { type: 'start' });
  return { room, repository, players };
}
function offerRules(kind: 'open' | 'sealed'): GameRules {
  return {
    ...artRules,
    initialize(context) {
      const state = artRules.initialize(context) as ArtState;
      const first = state.hands[state.turnSeat!]!;
      if (!first.some((id) => getCard(id).auctionKind === kind)) {
        const other = [...Object.values(state.hands), state.deck].find((pile) =>
          pile.some((id) => getCard(id).auctionKind === kind),
        )!;
        const index = other.findIndex((id) => getCard(id).auctionKind === kind);
        [first[0], other[index]] = [other[index]!, first[0]!];
      }
      return state;
    },
  };
}
async function offer(
  room: RoomCoordinator,
  players: string[],
  kind: 'open' | 'sealed',
) {
  const actor = players.find((credential) => room.view(credential).decisionId)!;
  const view = room.view(actor);
  const hand = (view.gameView as ModernArtView).self!.hand;
  const card = hand.find((card) => card.auctionKind === kind)!;
  expect(
    (
      await send(
        room,
        {
          type: 'game',
          decisionId: view.decisionId!,
          action: { type: 'offer', cardId: card.id },
        },
        actor,
      )
    ).ok,
  ).toBe(true);
}

it('validates all 15 non-linear settings and restricts updates to the computer administrator', async () => {
  clock();
  expect(COUNTDOWN_STEPS).toEqual([
    5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 90, 105, 120,
  ]);
  for (const bad of [0, 4, 6, 21, 121, 20.5, NaN, Infinity, '20', null])
    expect(CountdownSecondsSchema.safeParse(bad).success).toBe(false);
  const { room, players, repository } = await fixture();
  expect(room.view().countdownSeconds).toBe(20);
  await send(room, {
    type: 'set-owner',
    seatId: room.view(players[0]).self.seatId,
  });
  for (const credential of [undefined, ...players]) {
    expect(
      await room.command(
        credential,
        input(room, { type: 'set-countdown', seconds: 5 }),
      ),
    ).toEqual({ ok: false, reason: 'unauthorized' });
  }
  const oldClock = room.view().decisionClock!.id;
  for (const seconds of COUNTDOWN_STEPS) {
    expect((await send(room, { type: 'set-countdown', seconds })).ok).toBe(
      true,
    );
    expect(room.view().countdownSeconds).toBe(seconds);
    expect(room.view().decisionClock!.remainingMs).toBe(seconds * 1000);
    expect(repository.value!.countdownSeconds).toBe(seconds);
  }
  expect(room.view().decisionClock!.id).not.toBe(oldClock);
  for (const seconds of [4, 6, 121, 20.5])
    expect(
      await room.command(
        room.hostToken,
        input(room, { type: 'set-countdown', seconds }),
      ),
    ).toEqual({ ok: false, reason: 'invalid-message' });
});

it('shares the saved server baseline, counts down without saves, and still accepts an action after zero', async () => {
  const time = clock();
  const { room, repository, players } = await fixture();
  const start = room.view(players[0]);
  expect(RoomViewSchema.safeParse(start).success).toBe(true);
  expect(room.view().decisionClock).toEqual(start.decisionClock);
  expect(room.view(room.hostToken).decisionClock).toEqual(start.decisionClock);
  expect(room.view(players[1]).decisionClock).toBeNull();
  expect(Object.keys(start.decisionClock!).sort()).toEqual([
    'id',
    'remainingMs',
    'running',
    'serverTime',
  ]);
  const writes = repository.writes;
  time.advance(7_000);
  expect(room.view(players[0]).decisionClock!.remainingMs).toBe(13_000);
  time.advance(20_000);
  expect(room.view(players[0]).decisionClock!.remainingMs).toBe(0);
  expect(room.view(players[0]).actions).toHaveLength(3);
  expect(repository.writes).toBe(writes);
  expect(
    (
      await send(
        room,
        {
          type: 'game',
          decisionId: start.decisionId!,
          action: { type: 'choose', value: 1 },
        },
        players[0],
      )
    ).ok,
  ).toBe(true);
  expect(room.view(players[1]).decisionClock!.remainingMs).toBe(20_000);
  expect(room.view(players[1]).decisionClock!.id).not.toBe(
    start.decisionClock!.id,
  );
});

it('freezes on pause, resumes the same clock, and leaves timers/settings unchanged when a transaction fails', async () => {
  const time = clock();
  const { room, repository, players } = await fixture();
  const first = room.view(players[0]).decisionClock!;
  time.advance(6_000);
  expect((await send(room, { type: 'pause' })).ok).toBe(true);
  expect(room.view().decisionClock).toMatchObject({
    id: first.id,
    remainingMs: 14_000,
    running: false,
  });
  time.advance(60_000);
  expect(room.view().decisionClock!.remainingMs).toBe(14_000);
  expect((await send(room, { type: 'resume' })).ok).toBe(true);
  time.advance(4_000);
  expect(room.view().decisionClock).toMatchObject({
    id: first.id,
    remainingMs: 10_000,
    running: true,
  });
  const saved = structuredClone(repository.value);
  const failing = input(room, { type: 'set-countdown', seconds: 120 });
  repository.fail = true;
  expect(await room.command(room.hostToken, failing)).toEqual({
    ok: false,
    reason: 'save-or-action-failed',
  });
  expect(repository.value).toEqual(saved);
  expect(room.view().countdownSeconds).toBe(20);
  expect(room.view().decisionClock).toMatchObject({
    id: first.id,
    remainingMs: 10_000,
  });
  repository.fail = false;
  expect((await room.command(room.hostToken, failing)).ok).toBe(true);
  expect(room.view().decisionClock!.remainingMs).toBe(120_000);
});

it('restores paused at the last committed sample, excluding the closed interval, and rebuilds clocks on rollback', async () => {
  const time = clock();
  const { room, repository, players } = await fixture();
  time.advance(4_000);
  await send(room, {
    type: 'set-owner',
    seatId: room.view(players[1]).self.seatId,
  });
  const persisted = repository.value!.decisionClocks![0]!;
  expect(persisted.remainingMs).toBe(16_000);
  time.advance(2 * 24 * 60 * 60 * 1000);
  const restored = new RoomCoordinator(rules, bot, repository);
  expect(restored.view().paused).toBe(true);
  expect(restored.view().decisionClock).toMatchObject({
    id: persisted.id,
    remainingMs: 16_000,
    running: false,
  });
  await send(restored, { type: 'resume' });
  time.advance(1_000);
  const a = restored.view(players[0]);
  await send(
    restored,
    {
      type: 'game',
      decisionId: a.decisionId!,
      action: { type: 'choose', value: 1 },
    },
    players[0],
  );
  const currentClock = restored.view().decisionClock!.id;
  const history = restored.view(restored.hostToken).history;
  await send(restored, { type: 'rollback', checkpointId: history[0]!.id });
  expect(restored.view().decisionClock).toMatchObject({
    remainingMs: 20_000,
    running: false,
  });
  expect(restored.view().decisionClock!.id).not.toBe(currentClock);
  expect(restored.view().countdownSeconds).toBe(20);
});

it('migrates missing old metadata once and rejects damaged explicit numbers or clocks', async () => {
  clock();
  const { repository } = await fixture();
  delete repository.value!.countdownSeconds;
  delete repository.value!.decisionClocks;
  const oldRevision = repository.value!.revision;
  const migrated = new RoomCoordinator(rules, bot, repository);
  expect(migrated.view().countdownSeconds).toBe(20);
  expect(migrated.view().decisionClock).toMatchObject({
    remainingMs: 20_000,
    running: false,
  });
  expect(repository.value!.revision).toBe(oldRevision + 1);
  const valid = structuredClone(repository.value!);
  for (const seconds of [4, 6, 121, 20.5, null, '20']) {
    repository.value = { ...valid, countdownSeconds: seconds } as Save;
    expect(() => new RoomCoordinator(rules, bot, repository)).toThrow(
      'damaged-save',
    );
  }
  for (const corrupt of [
    [],
    [{ ...valid.decisionClocks![0], remainingMs: 120_001 }],
    [{ ...valid.decisionClocks![0], key: 'leak secret action' }],
    [{ ...valid.decisionClocks![0], id: '-'.repeat(36) }],
  ]) {
    repository.value = { ...valid, decisionClocks: corrupt } as Save;
    expect(() => new RoomCoordinator(rules, bot, repository)).toThrow(
      'damaged-save',
    );
  }
});

it('keeps configuration across game switch, replay and new-room while creating fresh decision clocks', async () => {
  clock();
  const { room, repository } = await fixture();
  await send(room, { type: 'set-countdown', seconds: 75 });
  await send(room, { type: 'end' });
  await send(room, { type: 'replay' });
  expect(room.view().countdownSeconds).toBe(75);
  expect(room.view().decisionClock).toBeNull();
  await send(room, { type: 'new-room' });
  expect(room.view().countdownSeconds).toBe(75);
  expect(room.view().seats).toEqual([]);
  const registry = new GameRegistry([
    {
      catalog: {
        id: rules.manifest.id,
        name: rules.manifest.name,
        ...rules.manifest.players,
      },
      load: async () => ({ rules, bot }),
    },
    {
      catalog: {
        id: artRules.manifest.id,
        name: artRules.manifest.name,
        ...artRules.manifest.players,
      },
      load: async () => ({ rules: artRules, bot: artBot }),
    },
  ]);
  const switching = new RoomCoordinator(
    rules,
    bot,
    repository,
    undefined,
    undefined,
    registry,
  );
  await send(switching, { type: 'select-game', gameId: 'modern-art' });
  expect(switching.view().countdownSeconds).toBe(75);
  expect(switching.view().decisionClock).toBeNull();
  await send(switching, { type: 'select-game', gameId: 'template' });
  expect(switching.view().countdownSeconds).toBe(75);
});

it('hides Pokemon reminders without changing independent initial-flip decisions or legacy clock storage', async () => {
  const time = clock();
  const { room, repository, players } = await fixture(
    pokemonRules,
    pokemonBot,
    6,
  );
  const baseline = repository.value!.decisionClocks![0]!;
  expect(
    players.every((credential) => room.view(credential).decisionClock === null),
  ).toBe(true);
  expect(repository.value!.decisionClocks).toHaveLength(1);
  time.advance(8_000);
  const requests = players.slice(0, 2).map((credential) =>
    input(
      room,
      {
        type: 'game',
        decisionId: room.view(credential).decisionId!,
        action: { type: 'initial-flip', slot: 0 },
      },
      credential,
    ),
  );
  const results = await Promise.all(
    requests.map((request, index) => room.command(players[index], request)),
  );
  expect(results.every((result) => result.ok)).toBe(true);
  expect(room.view(players[0]).decisionClock).toBeNull();
  expect(repository.value!.decisionClocks![0]).toMatchObject({
    id: baseline.id,
    remainingMs: 12_000,
  });
  expect(room.view(players[5]).decisionClock).toBeNull();
  expect(room.view().decisionClock).toBeNull();
  expect(room.view(players[5]).decisionId).not.toBeNull();
});

it('does not reset remaining sealed-bid players or reveal bids through the clock, and starts a fresh timer for a public new price', async () => {
  const time = clock();
  const sealed = await fixture(offerRules('sealed'), artBot, 3);
  await offer(sealed.room, sealed.players, 'sealed');
  const baseline = sealed.room.view().decisionClock!;
  const requests = sealed.players.slice(0, 2).map((credential, i) =>
    input(
      sealed.room,
      {
        type: 'game',
        decisionId: sealed.room.view(credential).decisionId!,
        action: { type: 'sealed-bid', amount: 31 + i },
      },
      credential,
    ),
  );
  time.advance(9_000);
  expect(
    (
      await Promise.all(
        requests.map((request, i) =>
          sealed.room.command(sealed.players[i], request),
        ),
      )
    ).every((reply) => reply.ok),
  ).toBe(true);
  const publicClock = sealed.room.view().decisionClock;
  expect(publicClock).toMatchObject({ id: baseline.id, remainingMs: 11_000 });
  expect(sealed.room.view(sealed.players[2]).decisionClock).toEqual(
    publicClock,
  );
  expect(sealed.room.view(sealed.players[0]).decisionClock).toBeNull();
  expect(
    (sealed.room.view().gameView as ModernArtView).auction!.currentBid,
  ).toBe(0);
  expect(Object.keys(publicClock!).sort()).toEqual([
    'id',
    'remainingMs',
    'running',
    'serverTime',
  ]);
  const opened = await fixture(offerRules('open'), artBot, 3);
  await offer(opened.room, opened.players, 'open');
  const oldClock = opened.room.view().decisionClock!.id;
  time.advance(5_000);
  const bidder = opened.players[1]!;
  const current = opened.room.view(bidder);
  await send(
    opened.room,
    {
      type: 'game',
      decisionId: current.decisionId!,
      action: { type: 'bid', amount: 1 },
    },
    bidder,
  );
  expect(opened.room.view().decisionClock!.id).not.toBe(oldClock);
  expect(opened.room.view().decisionClock!.remainingMs).toBe(20_000);
});
