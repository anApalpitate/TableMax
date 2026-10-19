import { expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import { RandomSource } from '@tablemax/platform-core/random';
import type { JsonValue } from '@tablemax/game-sdk';
import { rules, bot } from '../../../games/uno';
import type { UnoView } from '../../../games/uno/types';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';
import { createGameRegistry } from './game-registry';

it('discovers UNO metadata and resolves matching independent rules and strategy versions', async () => {
  const registry = createGameRegistry();
  expect(registry.catalog().find((game) => game.id === 'uno')).toMatchObject({
    id: 'uno',
    name: 'UNO',
    min: 2,
    max: 6,
  });
  const loaded = await registry.load('uno');
  expect(loaded.rules.manifest.rulesVersion).toBe('classic-108-g7942-1');
  expect(loaded.bot.rulesVersion).toBe(loaded.rules.manifest.rulesVersion);
  expect(loaded.bot.difficulties).toEqual(['default', 'doubao', 'juewu']);
});

const game = (view: RoomView) => view.gameView as UnoView;
function envelope(view: RoomView, command: Command['command']): Command {
  return {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}
async function fixture(setup?: JsonValue) {
  mkdirSync('tmp', { recursive: true });
  const base = mkdtempSync(resolve('tmp/uno-service-'));
  const webDir = join(base, 'web');
  mkdirSync(webDir);
  writeFileSync(join(webDir, 'index.html'), '<html>local</html>');
  const config = {
    dataDir: join(base, 'data'),
    webDir,
    host: '127.0.0.1',
    port: 0,
  };
  const selectedRules = {
    ...rules,
    initialize: (context: Parameters<typeof rules.initialize>[0]) =>
      rules.initialize({ ...context, random: new RandomSource(61) }),
  };
  let service = await createService(config, { rules: selectedRules, bot });
  let port = await service.listen();
  let sockets: Socket[] = [];
  const connect = async (token?: string) => {
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
  };
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
  const observer = await connect();
  const tokens: string[] = [],
    players: Socket[] = [];
  for (const name of ['UNO甲', 'UNO乙', 'UNO丙']) {
    const response = await service.app.inject({
      method: 'POST',
      url: '/api/session/join',
      payload: { name },
    });
    const token: string = response.json().token;
    tokens.push(token);
    players.push(await connect(token));
    expect(
      (await run(players.at(-1)!, token, { type: 'ready', ready: true })).ok,
    ).toBe(true);
  }
  if (setup !== undefined) {
    expect(
      (await run(host, service.hostToken, { type: 'set-game-setup', setup }))
        .ok,
    ).toBe(true);
    expect(service.room.view().game?.setup).toEqual(setup);
    for (let i = 0; i < tokens.length; i++)
      expect(
        (await run(players[i]!, tokens[i]!, { type: 'ready', ready: true })).ok,
      ).toBe(true);
  }
  expect((await run(host, service.hostToken, { type: 'start' })).ok).toBe(true);
  const actor = () => {
    const index = tokens.findIndex(
      (token) => service.room.view(token).actions.length > 0,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    return { index, token: tokens[index]!, socket: players[index]! };
  };
  const close = async () => {
    sockets.forEach((socket) => socket.disconnect());
    sockets = [];
    await service.close();
  };
  const restart = async () => {
    await close();
    service = await createService(config, { rules: selectedRules, bot });
    port = await service.listen();
    host = await connect(service.hostToken);
    for (let i = 0; i < tokens.length; i++)
      players[i] = await connect(tokens[i]!);
  };
  return {
    get service() {
      return service;
    },
    get host() {
      return host;
    },
    observer,
    tokens,
    players,
    actor,
    send,
    run,
    close,
    restart,
  };
}

it('UNO Socket/SQLite actions stay private, atomic, idempotent and deterministic through rollback and restart', async () => {
  const f = await fixture();
  try {
    for (const token of [undefined, f.service.hostToken]) {
      const view = f.service.room.view(token);
      expect(game(view).self).toBeNull();
      expect(view.actions).toEqual([]);
      expect(game(view)).not.toHaveProperty('hands');
      expect(game(view)).not.toHaveProperty('deck');
    }
    for (const token of f.tokens)
      for (const card of game(f.service.room.view(token)).self!.hand)
        expect(JSON.stringify(f.service.room.view())).not.toContain(card.id);
    const actor = f.actor(),
      before = f.service.room.view(actor.token);
    const action = (before.actions.find(
      (a) => (a as { type: string }).type === 'draw',
    ) ?? before.actions[0]!) as JsonValue;
    const command = envelope(before, {
      type: 'game',
      decisionId: before.decisionId!,
      action,
    });
    expect((await f.send(f.observer, command)).ok).toBe(false);
    const originalSave = SqliteSaveRepository.prototype.save;
    const saveSpy = vi
      .spyOn(SqliteSaveRepository.prototype, 'save')
      .mockImplementationOnce(() => {
        throw new Error('simulated disk-full');
      });
    expect((await f.send(actor.socket, command)).ok).toBe(false);
    expect(f.service.room.view(actor.token).revision).toBe(before.revision);
    expect(game(f.service.room.view(actor.token))).toEqual(game(before));
    saveSpy.mockImplementation(originalSave);
    expect((await f.send(actor.socket, command)).ok).toBe(true);
    const saved = f.service.room.view(actor.token);
    expect((await f.send(actor.socket, command)).ok).toBe(true);
    expect(f.service.room.view(actor.token).revision).toBe(saved.revision);
    saveSpy.mockRestore();
    const checkpoint = f.service.room.view(f.service.hostToken).history.at(-1)!;
    expect(
      (
        await f.run(f.host, f.service.hostToken, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        })
      ).ok,
    ).toBe(true);
    expect(game(f.service.room.view(actor.token))).toEqual(game(before));
    expect((await f.send(actor.socket, command)).ok).toBe(false);
    expect(
      (await f.run(f.host, f.service.hostToken, { type: 'resume' })).ok,
    ).toBe(true);
    expect(
      (
        await f.run(actor.socket, actor.token, {
          type: 'game',
          decisionId: f.service.room.view(actor.token).decisionId!,
          action,
        })
      ).ok,
    ).toBe(true);
    expect(game(f.service.room.view(actor.token))).toEqual(game(saved));
    await f.restart();
    expect(f.service.room.view(actor.token).paused).toBe(true);
    expect(game(f.service.room.view(actor.token))).toEqual(game(saved));
    expect(game(f.service.room.view(f.service.hostToken)).self).toBeNull();
  } finally {
    vi.restoreAllMocks();
    await f.close();
  }
}, 60000);

it('UNO approved device continuation preserves the hand and revokes the old credential across rollback', async () => {
  const f = await fixture();
  try {
    const actor = f.actor(),
      before = f.service.room.view(actor.token);
    expect(
      (
        await f.run(actor.socket, actor.token, {
          type: 'game',
          decisionId: before.decisionId!,
          action: before.actions[0]! as JsonValue,
        })
      ).ok,
    ).toBe(true);
    const checkpoint = f.service.room.view(f.service.hostToken).history.at(-1)!;
    const own = game(f.service.room.view(actor.token));
    const seatId = before.self.seatId!;
    const requestKey =
      crypto.randomUUID().replaceAll('-', '') +
      crypto.randomUUID().replaceAll('-', '');
    const pending = (
      await f.service.app.inject({
        method: 'POST',
        url: '/api/session/transfer/request',
        payload: { seatId, requestKey },
      })
    ).json().transfer;
    expect(pending.status).toBe('pending');
    expect(
      (
        await f.run(actor.socket, actor.token, {
          type: 'approve-transfer',
          requestId: pending.requestId,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await f.run(f.host, f.service.hostToken, {
          type: 'approve-transfer',
          requestId: pending.requestId,
        })
      ).ok,
    ).toBe(true);
    const approved = (
      await f.service.app.inject({
        method: 'POST',
        url: '/api/session/transfer/status',
        payload: { requestKey },
      })
    ).json().transfer;
    expect(approved.status).toBe('approved');
    expect(f.service.room.view(approved.token).self.seatId).toBe(seatId);
    expect(game(f.service.room.view(approved.token))).toEqual(own);
    expect(() => f.service.room.view(actor.token)).toThrow();
    expect(
      (
        await f.run(f.host, f.service.hostToken, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        })
      ).ok,
    ).toBe(true);
    expect(f.service.room.view(approved.token).self.seatId).toBe(seatId);
    expect(game(f.service.room.view(approved.token))).toEqual(game(before));
    expect(() => f.service.room.view(actor.token)).toThrow();
  } finally {
    await f.close();
  }
}, 60000);

it('UNO simultaneous Socket responses have one saved winner; failed save leaves every response available', async () => {
  const f = await fixture();
  try {
    for (
      let step = 0;
      step < 600 && !game(f.service.room.view()).unoWindow;
      step++
    ) {
      const actor = f.actor(),
        v = f.service.room.view(actor.token);
      const action =
        v.actions.find((a) => (a as { type: string }).type === 'play') ??
        v.actions[0]!;
      expect(
        (
          await f.run(actor.socket, actor.token, {
            type: 'game',
            decisionId: v.decisionId!,
            action: action as JsonValue,
          })
        ).ok,
      ).toBe(true);
    }
    const before = f.service.room.view();
    expect(game(before).unoWindow).not.toBeNull();
    const windows = f.tokens.map((token) => f.service.room.view(token));
    const commands = windows.map((v) =>
      envelope(v, {
        type: 'game',
        decisionId: v.decisionId!,
        action: v.actions.find((a) =>
          ['declare-uno', 'catch-uno'].includes((a as { type: string }).type),
        ) as JsonValue,
      }),
    );
    const spy = vi
      .spyOn(SqliteSaveRepository.prototype, 'save')
      .mockImplementationOnce(() => {
        throw new Error('disk-full');
      });
    expect((await f.send(f.players[0]!, commands[0]!)).ok).toBe(false);
    spy.mockRestore();
    expect(game(f.service.room.view())).toEqual(game(before));
    const replies = await Promise.all(
      commands.map((command, i) => f.send(f.players[i]!, command)),
    );
    expect(replies.filter((reply) => reply.ok)).toHaveLength(1);
    expect(f.service.room.view().revision).toBe(before.revision + 1);
    expect(game(f.service.room.view()).unoWindow).toBeNull();
  } finally {
    await f.close();
  }
}, 60000);

it('UNO pregame transfer settings and catch grace are enforced over real Socket/SQLite at the exact boundary', async () => {
  let serverNow = Date.now();
  const date = vi.spyOn(Date, 'now').mockImplementation(() => serverNow);
  const setup = { drawPenaltyStacking: true, catchUnoDelayMs: 5000 };
  const f = await fixture(setup);
  try {
    for (
      let step = 0;
      step < 600 && !game(f.service.room.view()).unoWindow;
      step++
    ) {
      const actor = f.actor(),
        view = f.service.room.view(actor.token);
      const action =
        view.actions.find((a) => (a as { type: string }).type === 'play') ??
        view.actions[0]!;
      expect(
        (
          await f.run(actor.socket, actor.token, {
            type: 'game',
            decisionId: view.decisionId!,
            action: action as JsonValue,
          })
        ).ok,
      ).toBe(true);
    }
    const target = game(f.service.room.view()).unoWindow!.seatId;
    const index = f.tokens.findIndex(
      (token) => f.service.room.view(token).self.seatId !== target,
    );
    const credential = f.tokens[index]!,
      socket = f.players[index]!;
    const view = f.service.room.view(credential);
    expect(view.actionTiming?.[0]).toMatchObject({
      actionType: 'catch-uno',
      remainingMs: 5000,
    });
    expect(game(view).setup).toEqual(setup);
    expect(
      await f.run(f.host, f.service.hostToken, {
        type: 'set-game-setup',
        setup: { ...setup, catchUnoDelayMs: 0 },
      }),
    ).toMatchObject({ ok: false, reason: 'not-in-lobby' });
    const action = view.actions.find(
      (a) => (a as { type: string }).type === 'catch-uno',
    ) as JsonValue;
    serverNow += 4999;
    expect(
      await f.run(socket, credential, {
        type: 'game',
        decisionId: view.decisionId!,
        action,
      }),
    ).toMatchObject({ ok: false, reason: 'action-not-ready' });
    expect(f.service.room.view().revision).toBe(view.revision);
    expect(game(f.service.room.view()).unoWindow?.seatId).toBe(target);
    serverNow += 1;
    expect(
      (
        await f.run(socket, credential, {
          type: 'game',
          decisionId: view.decisionId!,
          action,
        })
      ).ok,
    ).toBe(true);
    expect(game(f.service.room.view()).unoWindow).toBeNull();
    await f.restart();
    expect(f.service.room.view().game?.setup).toEqual(setup);
    expect(game(f.service.room.view()).setup).toEqual(setup);
  } finally {
    await f.close();
    date.mockRestore();
  }
}, 60000);
