import { expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import type { JsonValue } from '@tablemax/game-sdk';
import { rules, bot } from '../../../games/avalon';
import type { AvalonView, Action } from '../../../games/avalon/types';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';
import { createGameRegistry } from './game-registry';

const game = (view: RoomView) => view.gameView as AvalonView;
const envelope = (view: RoomView, command: Command['command']): Command => ({
  actionId: crypto.randomUUID(),
  instanceId: view.instanceId,
  revision: view.revision,
  branch: view.branch,
  command,
});
async function fixture(count = 5) {
  mkdirSync('tmp', { recursive: true });
  const base = mkdtempSync(resolve('tmp/avalon-service-'));
  const webDir = join(base, 'web');
  mkdirSync(webDir);
  writeFileSync(join(webDir, 'index.html'), '<html>local</html>');
  const config = {
    dataDir: join(base, 'data'),
    webDir,
    host: '127.0.0.1',
    port: 0,
  };
  let service = await createService(config, { rules, bot });
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
  const send = (socket: Socket, value: Command) =>
    new Promise<CommandReply>((done, reject) =>
      socket
        .timeout(5000)
        .emit(
          'room:command',
          value,
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
  for (let i = 0; i < count; i++) {
    const response = await service.app.inject({
      method: 'POST',
      url: '/api/session/join',
      payload: { name: `阿瓦隆${i + 1}` },
    });
    const token: string = response.json().token;
    tokens.push(token);
    players.push(await connect(token));
    expect(
      (await run(players[i]!, token, { type: 'ready', ready: true })).ok,
    ).toBe(true);
  }
  expect((await run(host, service.hostToken, { type: 'start' })).ok).toBe(true);
  const own = (index: number) => service.room.view(tokens[index]!);
  const act = (index: number, action: Action) =>
    run(players[index]!, tokens[index]!, {
      type: 'game',
      decisionId: own(index).decisionId!,
      action: action as JsonValue,
    });
  const allAck = async () => {
    const commands = tokens.map((_, index) =>
      envelope(own(index), {
        type: 'game',
        decisionId: own(index).decisionId!,
        action: { type: 'acknowledge' },
      }),
    );
    const replies = await Promise.all(
      commands.map((command, index) => send(players[index]!, command)),
    );
    expect(replies.every((reply) => reply.ok)).toBe(true);
    expect(game(own(0)).phase).toBe('team');
  };
  const close = async () => {
    sockets.forEach((s) => s.disconnect());
    sockets = [];
    await service.close();
  };
  const restart = async () => {
    await close();
    service = await createService(config, { rules, bot });
    port = await service.listen();
    host = await connect(service.hostToken);
    for (let i = 0; i < count; i++) players[i] = await connect(tokens[i]!);
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
    send,
    run,
    own,
    act,
    allAck,
    close,
    restart,
  };
}

it('discovers both original Avalon role combinations without platform game branches', async () => {
  const registry = createGameRegistry();
  expect(registry.catalog().find((g) => g.id === 'avalon')).toMatchObject({
    min: 5,
    max: 6,
  });
  for (const variant of ['classic', 'court']) {
    const loaded = await registry.load('avalon', variant);
    expect(loaded.bot.rulesVersion).toBe(loaded.rules.manifest.rulesVersion);
    expect(loaded.bot.difficulties).toEqual(['default', 'doubao', 'juewu']);
  }
});

for (const count of [5, 6])
  it(`Avalon ${count}-seat concurrent sealed votes and quest cards expose only completed public results`, async () => {
    const f = await fixture(count);
    try {
      for (const token of [undefined, f.service.hostToken]) {
        const v = f.service.room.view(token);
        expect(v.actions).toEqual([]);
        expect(game(v).self).toBeNull();
        expect(game(v).revealedRoles).toBeNull();
        expect(game(v)).not.toHaveProperty('roles');
      }
      await f.allAck();
      const leader = f.tokens.findIndex((_, i) => f.own(i).actions.length > 0);
      const proposal = f.own(leader).actions[0] as Action;
      expect((await f.act(leader, proposal)).ok).toBe(true);
      const before = f.tokens.map((_, i) => f.own(i));
      const commands = before.map((v) =>
        envelope(v, {
          type: 'game',
          decisionId: v.decisionId!,
          action: { type: 'vote-team', vote: 'approve' },
        }),
      );
      expect((await f.send(f.observer, commands[0]!)).ok).toBe(false);
      expect((await f.send(f.players[0]!, commands[0]!)).ok).toBe(true);
      expect(game(f.service.room.view()).history).toEqual([]);
      expect(game(f.own(1)).self!.vote).toBeNull();
      expect(game(f.service.room.view())).not.toHaveProperty('votes');
      const revision = f.own(0).revision;
      expect((await f.send(f.players[0]!, commands[0]!)).ok).toBe(true);
      expect(f.own(0).revision).toBe(revision);
      const replies = await Promise.all(
        commands.slice(1).map((c, i) => f.send(f.players[i + 1]!, c)),
      );
      expect(replies.every((r) => r.ok)).toBe(true);
      const g = game(f.service.room.view());
      expect(g.phase).toBe('quest');
      expect(Object.values(g.history.at(-1)!.votes)).toEqual(
        Array(count).fill('approve'),
      );
      const members = f.tokens
        .map((_, i) => i)
        .filter((i) => f.own(i).actions.length > 0);
      const missionCommands = members.map((i) =>
        envelope(f.own(i), {
          type: 'game',
          decisionId: f.own(i).decisionId!,
          action: {
            type: 'quest-card',
            card:
              game(f.own(i)).self!.alignment === 'evil' ? 'fail' : 'success',
          },
        }),
      );
      expect(
        (await f.send(f.players[members[0]!]!, missionCommands[0]!)).ok,
      ).toBe(true);
      const intermediate = game(f.service.room.view());
      expect(intermediate.quests).toHaveLength(0);
      expect(intermediate.failCount).toBe(0);
      expect(intermediate.latest?.text).not.toMatch(/成功牌|失败牌/);
      expect(
        JSON.stringify(f.service.room.view(f.service.hostToken).history),
      ).not.toMatch(/成功牌|失败牌/);
      const rest = await Promise.all(
        missionCommands
          .slice(1)
          .map((c, i) => f.send(f.players[members[i + 1]!]!, c)),
      );
      expect(rest.every((r) => r.ok)).toBe(true);
      const completed = game(f.service.room.view());
      expect(completed.quests).toHaveLength(1);
      expect(completed.quests[0]!.failCount).toBe(
        members.filter((i) => game(f.own(i)).self!.alignment === 'evil').length,
      );
      expect(completed).not.toHaveProperty('questCards');
    } finally {
      await f.close();
    }
  }, 60000);

it('Avalon disk failure, rollback and restart retain sealed vote and identity permissions', async () => {
  const f = await fixture();
  try {
    await f.allAck();
    const leader = f.tokens.findIndex((_, i) => f.own(i).actions.length > 0);
    expect((await f.act(leader, f.own(leader).actions[0] as Action)).ok).toBe(
      true,
    );
    const before = f.own(0),
      action: Action = { type: 'vote-team', vote: 'reject' };
    const command = envelope(before, {
      type: 'game',
      decisionId: before.decisionId!,
      action,
    });
    const spy = vi
      .spyOn(SqliteSaveRepository.prototype, 'save')
      .mockImplementationOnce(() => {
        throw new Error('simulated disk-full');
      });
    expect((await f.send(f.players[0]!, command)).ok).toBe(false);
    expect(game(f.own(0))).toEqual(game(before));
    expect(f.own(0).revision).toBe(before.revision);
    spy.mockRestore();
    expect((await f.send(f.players[0]!, command)).ok).toBe(true);
    const saved = f.own(0);
    const checkpoint = f.service.room.view(f.service.hostToken).history.at(-1)!;
    expect(
      (
        await f.run(f.host, f.service.hostToken, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        })
      ).ok,
    ).toBe(true);
    expect(game(f.own(0))).toEqual(game(before));
    expect((await f.send(f.players[0]!, command)).ok).toBe(false);
    expect(
      (await f.run(f.host, f.service.hostToken, { type: 'resume' })).ok,
    ).toBe(true);
    expect((await f.act(0, action)).ok).toBe(true);
    expect(game(f.own(0))).toEqual(game(saved));
    await f.restart();
    expect(f.own(0).paused).toBe(true);
    expect(game(f.own(0))).toEqual(game(saved));
    expect(game(f.service.room.view(f.service.hostToken)).self).toBeNull();
    expect(game(f.own(1)).self!.vote).toBeNull();
  } finally {
    vi.restoreAllMocks();
    await f.close();
  }
}, 60000);

it('Avalon administrator-approved device transfer preserves the secret role and revokes old credentials across rollback', async () => {
  const f = await fixture();
  try {
    const before = f.own(0);
    expect((await f.act(0, { type: 'acknowledge' })).ok).toBe(true);
    const checkpoint = f.service.room.view(f.service.hostToken).history.at(-1)!;
    const own = game(f.own(0)),
      seatId = before.self.seatId!;
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
    expect(
      (
        await f.run(f.players[0]!, f.tokens[0]!, {
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
    expect(game(f.service.room.view(approved.token))).toEqual(own);
    expect(() => f.service.room.view(f.tokens[0]!)).toThrow();
    expect(
      (
        await f.run(f.host, f.service.hostToken, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        })
      ).ok,
    ).toBe(true);
    expect(game(f.service.room.view(approved.token))).toEqual(game(before));
    expect(() => f.service.room.view(f.tokens[0]!)).toThrow();
  } finally {
    await f.close();
  }
}, 60000);
