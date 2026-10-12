import { afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { io, type Socket } from 'socket.io-client';
import { RandomSource, type Save } from '@tablemax/platform-core';
import {
  CommandReplySchema,
  RoomProjectionSchema,
  type Command,
  type RoomView,
} from '@tablemax/protocol';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';
import {
  pokemonExpansion as rules,
  createInitialState,
  type Action,
  type State,
  type View,
} from '../../../games/pokemon-encounters/expansion';
import {
  card,
  instancesForSeats,
} from '../../../games/pokemon-encounters/expansion/cards';
import {
  eventKinds,
  effectiveCard,
} from '../../../games/pokemon-encounters/expansion/events';
import type { RulesProfile } from '../../../games/pokemon-encounters/expansion/config/types';

const run = `run-${Date.now()}-${randomUUID().slice(0, 8)}`;
const evidence = resolve(
  'artifacts/maintenance/v1.0.6/pokemon-events-v3-verification/network',
  run,
);
const webDir = resolve('tmp/pokemon-events-v3-verification', run, 'web');
mkdirSync(evidence, { recursive: true });
mkdirSync(webDir, { recursive: true });
writeFileSync(
  join(webDir, 'index.html'),
  '<html>Local event integration fixture</html>',
);
const results: { scenario: string; detail: unknown }[] = [];
afterAll(() => {
  writeFileSync(
    join(evidence, 'results.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        scope:
          'Real loopback HTTP, Socket.IO, SQLite transactions and service restart; fixture-controlled decisions, no physical phone or GUI acceptance.',
        results,
      },
      null,
      2,
    ) + '\n',
  );
});

type Reply = ReturnType<typeof CommandReplySchema.parse>;
function envelope(view: RoomView, command: Command['command']): Command {
  return {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}
function readSave(dataDir: string): Save {
  const repository = new SqliteSaveRepository(dataDir);
  try {
    return repository.load() as Save;
  } finally {
    repository.close();
  }
}
function writeSave(dataDir: string, save: Save) {
  const repository = new SqliteSaveRepository(dataDir);
  try {
    repository.save(save);
  } finally {
    repository.close();
  }
}
function conserved(state: State) {
  const instances = [
    ...state.deck,
    ...state.discard,
    ...(state.held ? [state.held] : []),
    ...Object.values(state.boards)
      .flat()
      .map((slot) => slot.instanceId),
    ...Object.values(state.buffersBySeat ?? {}).filter(
      (id): id is string => id !== null,
    ),
  ];
  expect(instances.sort()).toEqual(
    instancesForSeats(
      state.seatOrder.length,
      state.rulesProfile ?? 'legacy',
    ).sort(),
  );
  expect(rules.validateState(structuredClone(state), state.seatOrder)).toEqual(
    state,
  );
}
function top(state: State, id: string) {
  const replacement = state.deck.at(-1)!;
  const index = state.deck.indexOf(id);
  const discard = state.discard.indexOf(id);
  if (index >= 0) state.deck[index] = replacement;
  else if (discard >= 0) state.discard[discard] = replacement;
  else {
    const slot = Object.values(state.boards)
      .flat()
      .find((slot) => slot.instanceId === id);
    if (!slot) throw new Error('Missing fixture instance');
    slot.instanceId = replacement;
  }
  state.deck[state.deck.length - 1] = id;
}
function put(
  state: State,
  id: string,
  seat: string,
  slot: number,
  faceUp: boolean,
) {
  top(state, id);
  state.deck[state.deck.length - 1] = state.boards[seat]![slot]!.instanceId;
  state.boards[seat]![slot] = { instanceId: id, faceUp };
}
function eventSeed(kind: (typeof eventKinds)[number]) {
  for (let seed = 1; seed < 1000000; seed++)
    if (
      eventKinds[
        Math.floor(new RandomSource(seed).next() * eventKinds.length)
      ] === kind
    )
      return seed;
  throw new Error('Missing event seed');
}
async function network(dataDir: string) {
  const service = await createService({
    host: '127.0.0.1',
    port: 0,
    dataDir,
    webDir,
    playMode: 'test',
  });
  const port = await service.listen();
  const origin = `http://127.0.0.1:${port}`;
  const clients: { socket: Socket; token?: string; view: RoomView }[] = [];
  const connect = async (token?: string) => {
    const socket = io(origin, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
    });
    const client = {
      socket,
      ...(token ? { token } : {}),
      view: service.room.view(token),
    };
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      socket.on('room:view', (value) => {
        client.view = RoomProjectionSchema.parse(value).view;
        resolve();
      });
      socket.once('connect_error', reject);
    });
    return client;
  };
  const submit = async (
    client: (typeof clients)[number],
    command: Command['command'],
    intent = envelope(client.view, command),
  ): Promise<Reply> => {
    const reply = await new Promise<Reply>((resolve, reject) => {
      client.socket
        .timeout(3000)
        .emit('room:command', intent, (error: Error | null, reply: unknown) => {
          if (error) reject(error);
          else resolve(CommandReplySchema.parse(reply));
        });
    });
    if (reply.ok)
      await vi.waitFor(() => {
        for (const other of clients)
          expect(other.view.revision).toBeGreaterThanOrEqual(reply.revision);
      });
    return reply;
  };
  const ok = async (
    client: (typeof clients)[number],
    command: Command['command'],
  ) => {
    expect(await submit(client, command)).toMatchObject({ ok: true });
  };
  const host = await connect(service.hostToken);
  const publicClient = await connect();
  return {
    service,
    origin,
    connect,
    submit,
    ok,
    host,
    publicClient,
    async close() {
      for (const client of clients) client.socket.close();
      await service.close();
    },
  };
}
type Network = Awaited<ReturnType<typeof network>>;
type Client = Awaited<ReturnType<Network['connect']>>;
async function seedTable(
  dataDir: string,
  profile: RulesProfile = 'events-research-v3',
) {
  let live = await network(dataDir);
  const tokens: Record<string, string> = {};
  try {
    expect(
      await fetch(`${live.origin}/api/foundation/health`).then((response) =>
        response.json(),
      ),
    ).toMatchObject({ protocolVersion: 8 });
    await live.ok(live.host, {
      type: 'select-game',
      gameId: 'pokemon-encounters',
    });
    await live.ok(live.host, {
      type: 'select-variant',
      variantId: 'expansion',
    });
    for (let i = 0; i < 2; i++) {
      const joined = (await fetch(`${live.origin}/api/session/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `浏览器${i}` }),
      }).then((response) => response.json())) as { token: string };
      const player = await live.connect(joined.token);
      tokens[player.view.self.seatId!] = joined.token;
      await live.ok(player, { type: 'ready', ready: true });
    }
    await live.ok(live.host, { type: 'start' });
  } finally {
    await live.close();
  }
  if (profile !== 'events-research-v3') {
    const fixture = readSave(dataDir);
    const random = new RandomSource(610212);
    fixture.snapshot!.state = createInitialState(
      { seats: Object.keys(tokens), random },
      profile,
    );
    fixture.snapshot!.random = random.state;
    fixture.history = [];
    fixture.revision++;
    writeSave(dataDir, fixture);
  }
  live = await network(dataDir);
  try {
    const players = Object.fromEntries(
      await Promise.all(
        Object.entries(tokens).map(
          async ([seat, token]) => [seat, await live.connect(token)] as const,
        ),
      ),
    );
    await live.ok(live.host, { type: 'resume' });
    while (
      ['research-vote', 'initial-flip'].includes(
        (readSave(dataDir).snapshot!.state as State).phase,
      )
    ) {
      const state = readSave(dataDir).snapshot!.state as State;
      const decision = rules.decisions(state)[0]!;
      const player = players[decision.seatId]!;
      await live.ok(player, {
        type: 'game',
        decisionId: player.view.decisionId!,
        action: player.view.actions[0]! as Action,
      });
    }
  } finally {
    await live.close();
  }
  return tokens;
}
async function reconnect(dataDir: string, tokens: Record<string, string>) {
  const live = await network(dataDir);
  const players = Object.fromEntries(
    await Promise.all(
      Object.entries(tokens).map(
        async ([seat, token]) => [seat, await live.connect(token)] as const,
      ),
    ),
  );
  expect(live.publicClient.view.paused).toBe(true);
  for (const player of Object.values(players))
    expect(player.view.actions).toEqual([]);
  return { live, players };
}
function game(client: Client): View {
  return client.view.gameView as View;
}
function privateBoundary(
  live: Network,
  players: Record<string, Client>,
  state: State,
) {
  for (const client of [
    live.host,
    live.publicClient,
    ...Object.values(players),
  ]) {
    const value = game(client);
    const json = JSON.stringify(value);
    expect(json).not.toContain('markerInstanceId');
    expect(json).not.toContain('cardOverrides');
    expect(json).not.toContain('normalTurnsBySeat');
    for (const seat of state.seatOrder)
      for (let slot = 0; slot < 9; slot++)
        if (
          !state.boards[seat]![slot]!.faceUp &&
          !(
            client.view.self.role === 'player' &&
            client.view.self.seatId === state.turnSeat &&
            state.peekSlots.includes(slot) &&
            state.targetSeat === seat
          )
        )
          expect(value.boards[seat]![slot]!.card).toBeNull();
  }
  expect(live.publicClient.view.actions).toEqual([]);
}

describe('v3 events through real network and SQLite', () => {
  it.each(eventKinds)(
    '%s is atomic, idempotent, private, and stable across rollback and service restart',
    async (kind) => {
      const dataDir = join(evidence, kind);
      const tokens = await seedTable(dataDir);
      const fixture = readSave(dataDir);
      const state = fixture.snapshot!.state as State;
      put(state, 'ordinary-4#01', state.seatOrder[0]!, 0, true);
      put(state, 'ordinary-3#01', state.seatOrder[0]!, 1, false);
      top(state, 'ordinary-1#01');
      state.randomEvent!.markerInstanceId = 'ordinary-1#01';
      state.randomEvent!.protected = false;
      state.normalTurnsBySeat = Object.fromEntries(
        state.seatOrder.map((seat) => [seat, 2]),
      );
      fixture.snapshot!.random = eventSeed(kind);
      fixture.revision++;
      conserved(state);
      writeSave(dataDir, fixture);
      let { live, players } = await reconnect(dataDir, tokens);
      try {
        await live.ok(live.host, { type: 'resume' });
        const before = readSave(dataDir);
        let actor = players[state.turnSeat]!;
        const command = {
          type: 'game',
          decisionId: actor.view.decisionId!,
          action: { type: 'draw', source: 'deck' },
        } as const;
        let intent = envelope(actor.view, command);
        const random = new RandomSource(before.snapshot!.random);
        const expected = rules.apply(state, command.action, state.turnSeat, {
          seats: state.seatOrder,
          random,
        }).state;
        privateBoundary(live, players, state);
        if (kind === 'rain') {
          const audit = new DatabaseSync(join(dataDir, 'room.sqlite'));
          const count = audit
            .prepare('SELECT COUNT(*) AS total FROM journal')
            .get()!.total;
          const views = [
            live.host,
            live.publicClient,
            ...Object.values(players),
          ].map((client) => structuredClone(client.view));
          audit.exec(
            "CREATE TRIGGER fail_event_save BEFORE UPDATE ON saves BEGIN SELECT RAISE(ABORT, 'Injected event save failure'); END;",
          );
          try {
            expect(await live.submit(actor, command, intent)).toMatchObject({
              ok: false,
              reason: 'save-or-action-failed',
            });
            expect(readSave(dataDir)).toEqual(before);
            expect(
              audit.prepare('SELECT COUNT(*) AS total FROM journal').get()!
                .total,
            ).toBe(count);
            expect(
              [live.host, live.publicClient, ...Object.values(players)].map(
                (client) => client.view,
              ),
            ).toEqual(views);
          } finally {
            audit.exec('DROP TRIGGER fail_event_save;');
            audit.close();
          }
          await live.close();
          ({ live, players } = await reconnect(dataDir, tokens));
          expect(readSave(dataDir).snapshot!.state).toEqual(state);
          expect(readSave(dataDir).snapshot!.random).toBe(
            before.snapshot!.random,
          );
          await live.ok(live.host, { type: 'resume' });
          actor = players[state.turnSeat]!;
          intent = envelope(actor.view, command);
        }
        expect(await live.submit(actor, command, intent)).toMatchObject({
          ok: true,
        });
        const after = readSave(dataDir);
        expect(after.snapshot!.state).toEqual(expected);
        expect(after.snapshot!.random).toBe(random.state);
        expect(expected.randomEvent).toMatchObject({ kind, triggered: true });
        conserved(expected);
        privateBoundary(live, players, expected);
        expect(game(live.publicClient).currentEvent).toEqual({
          kind,
          placeholder: kind === 'mega',
        });
        expect(
          expected.events.filter((event) => event.kind === 'special-event'),
        ).toHaveLength(1);
        expect(await live.submit(actor, command, intent)).toMatchObject({
          ok: true,
        });
        expect(readSave(dataDir)).toEqual(after);
        expect(
          await live.submit(actor, command, {
            ...intent,
            actionId: randomUUID(),
          }),
        ).toMatchObject({ ok: false, reason: 'stale-revision' });
        expect(readSave(dataDir)).toEqual(after);
        await live.ok(live.host, { type: 'pause' });
        expect(
          await live.submit(actor, {
            type: 'game',
            decisionId: rules.decisions(expected)[0]!.id,
            action: { type: 'discard-held' },
          }),
        ).toMatchObject({ ok: false, reason: 'not-actionable' });
        const checkpoint = live.host.view.history.at(-1)!;
        await live.ok(live.host, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        });
        expect(readSave(dataDir).snapshot!.state).toEqual(state);
        expect(readSave(dataDir).snapshot!.random).toBe(
          before.snapshot!.random,
        );
        await live.ok(live.host, { type: 'resume' });
        await live.ok(actor, {
          type: 'game',
          decisionId: actor.view.decisionId!,
          action: command.action,
        });
        expect(readSave(dataDir).snapshot!.state).toEqual(expected);
        expect(readSave(dataDir).snapshot!.random).toBe(random.state);
        await live.close();
        ({ live, players } = await reconnect(dataDir, tokens));
        expect(readSave(dataDir).snapshot!.state).toEqual(expected);
        expect(readSave(dataDir).snapshot!.random).toBe(random.state);
        privateBoundary(live, players, expected);
        expect(game(live.publicClient).currentEvent).toEqual({
          kind,
          placeholder: kind === 'mega',
        });
        await live.ok(live.host, { type: 'resume' });
        const restoredActor = players[expected.turnSeat]!;
        await live.ok(restoredActor, {
          type: 'game',
          decisionId: restoredActor.view.decisionId!,
          action: { type: 'discard-held' },
        });
        const continued = readSave(dataDir).snapshot!.state as State;
        conserved(continued);
        expect(
          continued.events.filter((event) => event.kind === 'special-event'),
        ).toHaveLength(1);
        if (kind === 'trick-room')
          expect(continued.cardOverrides).toEqual(expected.cardOverrides);
        results.push({
          scenario: `network ${kind}`,
          detail: {
            profile: state.rulesProfile,
            randomStable: true,
            duplicateAndStale: true,
            rollbackAndRestart: true,
            saveFailure: kind === 'rain',
          },
        });
      } finally {
        await live.close();
      }
    },
    60000,
  );

  it('authorizes one Mewtwo private card and only that exchange after a real service restart', async () => {
    const dataDir = join(evidence, 'mewtwo');
    const tokens = await seedTable(dataDir);
    const fixture = readSave(dataDir);
    const state = fixture.snapshot!.state as State;
    top(state, 'special-mewtwo#01');
    if (state.randomEvent!.markerInstanceId === 'special-mewtwo#01')
      state.randomEvent!.markerInstanceId = state.deck.find(
        (id) => id !== 'special-mewtwo#01',
      )!;
    fixture.revision++;
    conserved(state);
    writeSave(dataDir, fixture);
    let { live, players } = await reconnect(dataDir, tokens);
    try {
      await live.ok(live.host, { type: 'resume' });
      const actorSeat = state.turnSeat;
      const other = state.seatOrder.find((seat) => seat !== actorSeat)!;
      let actor = players[actorSeat]!;
      await live.ok(actor, {
        type: 'game',
        decisionId: actor.view.decisionId!,
        action: { type: 'draw', source: 'deck' },
      });
      expect(game(actor).phase).toBe('mewtwo-target');
      expect(
        actor.view.actions.every(
          (action) =>
            (action as Action).type !== 'mewtwo-target' ||
            'slot' in (action as object),
        ),
      ).toBe(true);
      const before = readSave(dataDir);
      expect(
        await live.submit(actor, {
          type: 'game',
          decisionId: actor.view.decisionId!,
          action: { type: 'mewtwo-target', seat: other, a: 1, b: 2 },
        }),
      ).toMatchObject({ ok: false });
      expect(readSave(dataDir)).toEqual(before);
      expect(
        await live.submit(live.publicClient, {
          type: 'game',
          decisionId: actor.view.decisionId!,
          action: { type: 'mewtwo-target', seat: other, slot: 1 },
        }),
      ).toMatchObject({ ok: false, reason: 'unauthorized' });
      await live.ok(actor, {
        type: 'game',
        decisionId: actor.view.decisionId!,
        action: { type: 'mewtwo-target', seat: other, slot: 1 },
      });
      const peeked = readSave(dataDir).snapshot!.state as State;
      expect(game(actor).peek!.cards).toHaveLength(1);
      expect(game(actor).peek!.cards[0]!.slot).toBe(1);
      expect(game(players[other]!).peek).toBeNull();
      expect(game(live.host).peek).toBeNull();
      expect(game(live.publicClient).peek).toBeNull();
      privateBoundary(live, players, peeked);
      await live.close();
      ({ live, players } = await reconnect(dataDir, tokens));
      actor = players[actorSeat]!;
      expect(readSave(dataDir).snapshot!.state).toEqual(peeked);
      expect(game(actor).peek!.cards).toHaveLength(1);
      privateBoundary(live, players, peeked);
      await live.ok(live.host, { type: 'resume' });
      expect(
        await live.submit(actor, {
          type: 'game',
          decisionId: actor.view.decisionId!,
          action: { type: 'mewtwo-exchange', slot: 2 },
        }),
      ).toMatchObject({ ok: false });
      await live.ok(actor, {
        type: 'game',
        decisionId: actor.view.decisionId!,
        action: { type: 'mewtwo-exchange', slot: 1 },
      });
      const exchanged = readSave(dataDir).snapshot!.state as State;
      expect(exchanged.boards[other]![1]!.instanceId).toBe('special-mewtwo#01');
      conserved(exchanged);
      results.push({
        scenario: 'network Mewtwo one-card authority',
        detail: {
          privateSlots: 1,
          invalidSecondPeek: 'rejected',
          invalidSecondExchange: 'rejected',
          restart: true,
        },
      });
    } finally {
      await live.close();
    }
  }, 60000);

  it('restores a separately prepared v2 SQLite fixture with its old deck, values and two-card Mewtwo semantics', async () => {
    const dataDir = join(evidence, 'v2-independent');
    const tokens = await seedTable(dataDir, 'research-buffer-v2');
    const fixture = readSave(dataDir);
    const state = fixture.snapshot!.state as State;
    expect(state.rulesProfile).toBe('research-buffer-v2');
    expect(state.randomEvent).toBeUndefined();
    expect(card('ordinary-metagross#01', 'research-buffer-v2').value).toBe(10);
    top(state, 'special-mewtwo#01');
    fixture.revision++;
    conserved(state);
    writeSave(dataDir, fixture);
    const { live, players } = await reconnect(dataDir, tokens);
    try {
      expect(readSave(dataDir).snapshot!.state).toEqual(state);
      await live.ok(live.host, { type: 'resume' });
      const actor = players[state.turnSeat]!;
      await live.ok(actor, {
        type: 'game',
        decisionId: actor.view.decisionId!,
        action: { type: 'draw', source: 'deck' },
      });
      const other = state.seatOrder.find((seat) => seat !== state.turnSeat)!;
      await live.ok(actor, {
        type: 'game',
        decisionId: actor.view.decisionId!,
        action: { type: 'mewtwo-target', seat: other, a: 1, b: 2 },
      });
      expect(game(actor).peek!.cards).toHaveLength(2);
      expect(game(live.publicClient).peek).toBeNull();
      expect(game(live.publicClient).currentEvent).toBeUndefined();
      const continued = readSave(dataDir).snapshot!.state as State;
      conserved(continued);
      expect(
        effectiveCard('ordinary-metagross#01', 'research-buffer-v2').value,
      ).toBe(10);
      results.push({
        scenario: 'independent v2 save',
        detail: {
          physicalCards: instancesForSeats(2, 'research-buffer-v2').length,
          metagross: 10,
          privateSlots: 2,
          noV3EventFields: true,
        },
      });
    } finally {
      await live.close();
    }
  }, 60000);
});
