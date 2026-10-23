import { expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import type { GameRules, JsonValue } from '@tablemax/game-sdk';
import type { Save } from '@tablemax/platform-core';
import {
  rules as poker,
  bot as pokerBot,
} from '../../../games/cockroach-poker';
import { createService } from './service';
import { createGameRegistry } from './game-registry';
import { SqliteSaveRepository } from './save-repository';

function envelope(view: RoomView, command: Command['command']): Command {
  return {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}
async function fixture(baseRules: GameRules, count = 3) {
  mkdirSync('tmp', { recursive: true });
  const base = mkdtempSync(resolve('tmp/cockroach-integration-service-'));
  const webDir = join(base, 'web');
  mkdirSync(webDir);
  writeFileSync(join(webDir, 'index.html'), '<html>integration</html>');
  const config = {
    dataDir: join(base, 'data'),
    webDir,
    host: '127.0.0.1',
    port: 0,
  };
  const rules = baseRules;
  const module = { rules, bot: pokerBot };
  let service = await createService(config, module);
  let port = await service.listen();
  let sockets: Socket[] = [];
  async function connect(token?: string) {
    const socket = io(`http://127.0.0.1:${port}`, {
      forceNew: true,
      transports: ['websocket'],
      auth: token ? { token } : {},
    });
    sockets.push(socket);
    await new Promise<void>((done, reject) => {
      socket.once('room:view', () => done());
      socket.once('connect_error', reject);
    });
    return socket;
  }
  const send = (socket: Socket, command: Command) =>
    new Promise<CommandReply>((done, reject) =>
      socket
        .timeout(5000)
        .emit(
          'room:command',
          command,
          (error: Error | null, reply: CommandReply) =>
            error ? reject(error) : done(reply),
        ),
    );
  const run = (socket: Socket, token: string, command: Command['command']) =>
    send(socket, envelope(service.room.view(token), command));
  let host = await connect(service.hostToken);
  const tokens: string[] = [],
    players: Socket[] = [];
  for (let i = 0; i < count; i++) {
    const response = await service.app.inject({
      method: 'POST',
      url: '/api/session/join',
      payload: { name: `玩家${i + 1}` },
    });
    expect(response.statusCode).toBe(200);
    tokens.push(response.json().token);
    players.push(await connect(tokens[i]));
    expect(
      (await run(players[i]!, tokens[i]!, { type: 'ready', ready: true })).ok,
    ).toBe(true);
  }
  expect((await run(host, service.hostToken, { type: 'start' })).ok).toBe(true);
  const game = (i: number) => service.room.view(tokens[i]).gameView;
  const action = (i: number, value: JsonValue) =>
    run(players[i]!, tokens[i]!, {
      type: 'game',
      decisionId: service.room.view(tokens[i]).decisionId!,
      action: value,
    });
  async function close() {
    for (const socket of sockets) socket.disconnect();
    sockets = [];
    await service.close();
  }
  async function restart() {
    await close();
    service = await createService(config, module);
    port = await service.listen();
    host = await connect(service.hostToken);
    for (let i = 0; i < tokens.length; i++)
      players[i] = await connect(tokens[i]);
  }
  function stored() {
    const repository = new SqliteSaveRepository(config.dataDir);
    try {
      return repository.load() as Save;
    } finally {
      repository.close();
    }
  }
  return {
    get service() {
      return service;
    },
    get host() {
      return host;
    },
    tokens,
    players,
    game,
    send,
    run,
    action,
    close,
    restart,
    stored,
  };
}

for (const rules of [poker]) {
  it(`${rules.manifest.id} loads independent registry rules and three bot levels`, async () => {
    const registry = createGameRegistry();
    expect(registry.catalog().map((game) => game.id)).toEqual([
      'pokemon-encounters',
      'modern-art',
      'power-grid',
      'rummikub',
      'uno',
      'avalon',
      'manila',
      'cockroach-poker',
    ]);
    await expect(registry.load('cockroach-salad')).rejects.toThrow();
    expect(
      registry.catalog().find((g) => g.id === rules.manifest.id),
    ).toMatchObject({ min: 2, max: 6 });
    const loaded = await registry.load(rules.manifest.id);
    expect(loaded.rules.manifest.rulesVersion).toBe(
      rules.manifest.rulesVersion,
    );
    expect(loaded.bot.difficulties).toEqual(['default', 'doubao', 'juewu']);
  });
  it(`${rules.manifest.id} real Socket SQLite saves reject failed writes and stale actions, replay ACKs, rollback and restart paused`, async () => {
    const f = await fixture(rules);
    try {
      const i = f.tokens.findIndex(
        (t) => f.service.room.view(t).actions.length > 0,
      );
      const before = f.service.room.view(f.tokens[i]);
      const action = before.actions[0]! as JsonValue;
      const command = envelope(before, {
        type: 'game',
        decisionId: before.decisionId!,
        action,
      });
      expect(f.service.room.view().actions).toEqual([]);
      expect((await f.send(f.host, command)).ok).toBe(false);
      const spy = vi
        .spyOn(SqliteSaveRepository.prototype, 'save')
        .mockImplementationOnce(() => {
          throw new Error('simulated disk-full');
        });
      try {
        expect((await f.send(f.players[i]!, command)).ok).toBe(false);
      } finally {
        spy.mockRestore();
      }
      expect(f.service.room.view(f.tokens[i]).revision).toBe(before.revision);
      expect((await f.send(f.players[i]!, command)).ok).toBe(true);
      const saved = f.service.room.view(f.tokens[i]);
      expect((await f.send(f.players[i]!, command)).ok).toBe(true);
      expect(f.service.room.view(f.tokens[i]).revision).toBe(saved.revision);
      expect(
        (
          await f.send(f.players[i]!, {
            ...command,
            actionId: crypto.randomUUID(),
          })
        ).ok,
      ).toBe(false);
      expect(
        rules.validateState(
          f.stored().snapshot!.state,
          f.stored().seats.map((s) => s.id),
        ),
      ).toEqual(f.stored().snapshot!.state);
      const checkpoint = f.service.room
        .view(f.service.hostToken)
        .history.at(-1)!;
      expect(
        (
          await f.run(f.host, f.service.hostToken, {
            type: 'rollback',
            checkpointId: checkpoint.id,
          })
        ).ok,
      ).toBe(true);
      expect(f.game(i)).toEqual(before.gameView);
      expect((await f.send(f.players[i]!, command)).ok).toBe(false);
      await f.restart();
      expect(f.service.room.view(f.tokens[i]).paused).toBe(true);
      expect(f.game(i)).toEqual(before.gameView);
      expect(
        (await f.run(f.host, f.service.hostToken, { type: 'resume' })).ok,
      ).toBe(true);
      expect((await f.action(i, action)).ok).toBe(true);
      expect(f.game(i)).toEqual(saved.gameView);
    } finally {
      await f.close();
    }
  }, 15000);
}

it('poker keeps hands and peeked cards private across real socket saves and reconnect', async () => {
  const f = await fixture(poker);
  try {
    const i = f.tokens.findIndex(
      (t) => f.service.room.view(t).actions.length > 0,
    );
    const offer = f.service.room.view(f.tokens[i]).actions[0]! as {
      type: string;
      target: string;
      card: number;
    };
    expect(f.service.room.view().gameView).toHaveProperty('ownHand', []);
    expect((await f.action(i, offer)).ok).toBe(true);
    const target = f.tokens.findIndex(
      (t) => f.service.room.view(t).actions.length > 0,
    );
    expect(f.game(target)).toHaveProperty('offer.knownCard', null);
    expect((await f.action(target, { type: 'peek' })).ok).toBe(true);
    expect(f.game(target)).toHaveProperty('offer.knownCard', offer.card);
    expect(f.service.room.view().gameView).toHaveProperty(
      'offer.knownCard',
      null,
    );
    expect(f.service.room.view(f.service.hostToken).gameView).toHaveProperty(
      'offer.knownCard',
      null,
    );
    const outsider = f.tokens.findIndex((_, n) => n !== target && n !== i);
    expect(f.game(outsider)).toHaveProperty('offer.knownCard', null);
    await f.restart();
    expect(f.game(target)).toHaveProperty('offer.knownCard', offer.card);
    expect(f.game(outsider)).toHaveProperty('offer.knownCard', null);
  } finally {
    await f.close();
  }
});
