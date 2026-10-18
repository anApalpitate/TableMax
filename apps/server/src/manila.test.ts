import { expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import type { Command, CommandReply, RoomView } from '@tablemax/protocol';
import type { JsonValue } from '@tablemax/game-sdk';
import { RandomSource } from '@tablemax/platform-core/random';
import { rules, bot } from '../../../games/manila';
import type { Action, ManilaView } from '../../../games/manila/rules/view';
import { createService } from './service';
import { SqliteSaveRepository } from './save-repository';
import { createGameRegistry } from './game-registry';

function envelope(view: RoomView, command: Command['command']): Command {
  return {
    actionId: crypto.randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}

async function fixture() {
  mkdirSync('tmp', { recursive: true });
  const base = mkdtempSync(resolve('tmp/manila-service-'));
  const webDir = join(base, 'web');
  mkdirSync(webDir);
  writeFileSync(
    join(webDir, 'index.html'),
    '<html>isolated Manila test</html>',
  );
  const config = {
    dataDir: join(base, 'data'),
    webDir,
    host: '127.0.0.1',
    port: 0,
  };
  const selectedRules = {
    ...rules,
    initialize: (context: Parameters<typeof rules.initialize>[0]) =>
      rules.initialize({ ...context, random: new RandomSource(205) }),
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
  const tokens: string[] = [];
  const players: Socket[] = [];
  for (const name of ['马尼拉甲', '马尼拉乙', '马尼拉丙']) {
    const response = await service.app.inject({
      method: 'POST',
      url: '/api/session/join',
      payload: { name },
    });
    expect(response.statusCode).toBe(200);
    const token: string = response.json().token;
    tokens.push(token);
    players.push(await connect(token));
    expect(
      (await run(players.at(-1)!, token, { type: 'ready', ready: true })).ok,
    ).toBe(true);
  }
  expect((await run(host, service.hostToken, { type: 'start' })).ok).toBe(true);
  const actor = () => {
    const index = tokens.findIndex(
      (token) => service.room.view(token).actions.length > 0,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    return { token: tokens[index]!, socket: players[index]! };
  };
  const close = async () => {
    for (const socket of sockets) socket.disconnect();
    sockets = [];
    await service.close();
  };
  const restart = async () => {
    await close();
    service = await createService(config, { rules: selectedRules, bot });
    port = await service.listen();
    host = await connect(service.hostToken);
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

it('discovers Manila metadata and the matching independent rules and three bot levels', async () => {
  const registry = createGameRegistry();
  expect(registry.catalog().find((game) => game.id === 'manila')).toMatchObject(
    {
      id: 'manila',
      name: '马尼拉',
      min: 3,
      max: 5,
    },
  );
  const loaded = await registry.load('manila');
  expect(loaded.rules.manifest.rulesVersion).toBe(rules.manifest.rulesVersion);
  expect(loaded.bot.rulesVersion).toBe(rules.manifest.rulesVersion);
  expect(loaded.bot.difficulties).toEqual(['default', 'doubao', 'juewu']);
});

it('Manila real Socket/SQLite saves are private, atomic, idempotent and deterministic through rollback and restart', async () => {
  const f = await fixture();
  try {
    const publicView = f.service.room.view();
    const hostView = f.service.room.view(f.service.hostToken);
    expect(publicView.gameView).toEqual(hostView.gameView);
    expect(publicView.actions).toEqual([]);
    expect(hostView.actions).toEqual([]);
    const actor = f.actor();
    const before = f.service.room.view(actor.token);
    expect(before.gameView).not.toEqual(publicView.gameView);
    const action = before.actions[0]! as JsonValue;
    const command = envelope(before, {
      type: 'game',
      decisionId: before.decisionId!,
      action,
    });
    expect((await f.send(f.observer, command)).ok).toBe(false);
    expect((await f.send(f.host, command)).ok).toBe(false);
    expect(f.service.room.view(actor.token).revision).toBe(before.revision);
    const saveSpy = vi
      .spyOn(SqliteSaveRepository.prototype, 'save')
      .mockImplementationOnce(() => {
        throw new Error('simulated disk-full');
      });
    expect((await f.send(actor.socket, command)).ok).toBe(false);
    expect(f.service.room.view(actor.token).revision).toBe(before.revision);
    expect(f.service.room.view(actor.token).gameView).toEqual(before.gameView);
    saveSpy.mockRestore();
    expect((await f.send(actor.socket, command)).ok).toBe(true);
    const saved = f.service.room.view(actor.token);
    expect((await f.send(actor.socket, command)).ok).toBe(true);
    expect(f.service.room.view(actor.token).revision).toBe(saved.revision);
    const checkpoint = f.service.room.view(f.service.hostToken).history.at(-1)!;
    expect(
      (
        await f.run(f.host, f.service.hostToken, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        })
      ).ok,
    ).toBe(true);
    expect(f.service.room.view(actor.token).gameView).toEqual(before.gameView);
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
    expect(f.service.room.view(actor.token).gameView).toEqual(saved.gameView);
    // Reach a real dice boundary instead of proving replay only for a pass.
    let rolled: { token: string; view: RoomView } | null = null;
    for (let step = 0; step < 80 && !rolled; step++) {
      const current = f.actor();
      const from = f.service.room.view(current.token);
      const next = from.actions.find(
        (candidate) =>
          !['mortgage', 'repay'].includes((candidate as { type: string }).type),
      )! as JsonValue;
      expect(
        (
          await f.run(current.socket, current.token, {
            type: 'game',
            decisionId: from.decisionId!,
            action: next,
          })
        ).ok,
      ).toBe(true);
      const to = f.service.room.view(current.token);
      if (
        (to.gameView as ManilaView).movement >
        (from.gameView as ManilaView).movement
      ) {
        expect((to.gameView as ManilaView).dice.length).toBeGreaterThan(0);
        const point = f.service.room.view(f.service.hostToken).history.at(-1)!;
        expect(
          (
            await f.run(f.host, f.service.hostToken, {
              type: 'rollback',
              checkpointId: point.id,
            })
          ).ok,
        ).toBe(true);
        expect(f.service.room.view(current.token).gameView).toEqual(
          from.gameView,
        );
        expect(
          (await f.run(f.host, f.service.hostToken, { type: 'resume' })).ok,
        ).toBe(true);
        expect(
          (
            await f.run(current.socket, current.token, {
              type: 'game',
              decisionId: f.service.room.view(current.token).decisionId!,
              action: next,
            })
          ).ok,
        ).toBe(true);
        expect(f.service.room.view(current.token).gameView).toEqual(
          to.gameView,
        );
        rolled = { token: current.token, view: to };
      }
    }
    expect(rolled).not.toBeNull();
    await f.restart();
    expect(f.service.room.view(actor.token).paused).toBe(true);
    expect(f.service.room.view(rolled!.token).gameView).toEqual(
      rolled!.view.gameView,
    );
    expect(f.service.room.view().gameView).toEqual(
      f.service.room.view(f.service.hostToken).gameView,
    );
    for (const token of f.tokens)
      expect(f.service.room.view(token).self.seatId).toBeTruthy();
  } finally {
    vi.restoreAllMocks();
    await f.close();
  }
}, 60000);

it('persists complete voyage finance once through failed saves, duplicate envelopes, settlement rollback and restart', async () => {
  const f = await fixture();
  try {
    const first = f.actor();
    const opening = f.service.room.view(first.token);
    const mortgage = opening.actions.find(
      (action) => (action as Action).type === 'mortgage',
    )! as JsonValue;
    const loan = envelope(opening, {
      type: 'game',
      decisionId: opening.decisionId!,
      action: mortgage,
    });
    const saveSpy = vi
      .spyOn(SqliteSaveRepository.prototype, 'save')
      .mockImplementationOnce(() => {
        throw new Error('simulated finance save failure');
      });
    expect((await f.send(first.socket, loan)).ok).toBe(false);
    expect(f.service.room.view(first.token).gameView).toEqual(opening.gameView);
    saveSpy.mockRestore();
    expect((await f.send(first.socket, loan)).ok).toBe(true);
    const afterLoan = f.service.room.view(first.token);
    expect((afterLoan.gameView as ManilaView).self!.cash).toBe(42);
    expect((await f.send(first.socket, loan)).ok).toBe(true);
    expect(f.service.room.view(first.token).revision).toBe(afterLoan.revision);
    const random = new RandomSource(771);
    let settlement: {
      token: string;
      before: RoomView;
      after: RoomView;
      action: JsonValue;
    } | null = null;
    for (let step = 0; step < 200 && !settlement; step++) {
      const current = f.actor();
      const before = f.service.room.view(current.token);
      const { action } = await bot.decide({
        view: before.gameView as JsonValue,
        actions: before.actions as JsonValue[],
        decision: { id: before.decisionId!, seatId: before.self.seatId! },
        memory: null,
        difficulty: 'default',
        random,
        signal: new AbortController().signal,
      });
      const command = envelope(before, {
        type: 'game',
        decisionId: before.decisionId!,
        action,
      });
      expect((await f.send(current.socket, command)).ok).toBe(true);
      const after = f.service.room.view(current.token);
      if ((after.gameView as ManilaView).result) {
        expect((await f.send(current.socket, command)).ok).toBe(true);
        expect(f.service.room.view(current.token).gameView).toEqual(
          after.gameView,
        );
        settlement = { token: current.token, before, after, action };
      }
    }
    expect(settlement).not.toBeNull();
    const expected = (settlement!.after.gameView as ManilaView).result!
      .finance!;
    expect(expected.players[opening.self.seatId!]!.borrowed).toBe(12);
    for (const [seat, entry] of Object.entries(expected.players)) {
      expect(entry.openingCash).toBe(30);
      expect(entry.closingCash).toBe(
        (settlement!.after.gameView as ManilaView).players[seat]!.cash,
      );
      expect(entry.closingCash - entry.openingCash).toBe(
        Object.values(entry.income).reduce((sum, value) => sum + value, 0) -
          Object.values(entry.expenses).reduce((sum, value) => sum + value, 0) +
          entry.borrowed -
          entry.redeemed,
      );
    }
    expect(
      (f.service.room.view().gameView as ManilaView).result!.finance,
    ).toEqual(expected);
    const point = f.service.room.view(f.service.hostToken).history.at(-1)!;
    expect(
      (
        await f.run(f.host, f.service.hostToken, {
          type: 'rollback',
          checkpointId: point.id,
        })
      ).ok,
    ).toBe(true);
    expect(f.service.room.view(settlement!.token).gameView).toEqual(
      settlement!.before.gameView,
    );
    expect(
      (await f.run(f.host, f.service.hostToken, { type: 'resume' })).ok,
    ).toBe(true);
    const replayActor = f.actor();
    expect(
      (
        await f.run(replayActor.socket, replayActor.token, {
          type: 'game',
          decisionId: f.service.room.view(replayActor.token).decisionId!,
          action: settlement!.action,
        })
      ).ok,
    ).toBe(true);
    expect(
      (f.service.room.view().gameView as ManilaView).result!.finance,
    ).toEqual(expected);
    await f.restart();
    expect(
      (f.service.room.view().gameView as ManilaView).result!.finance,
    ).toEqual(expected);
    expect(f.service.room.view(f.service.hostToken).paused).toBe(true);
  } finally {
    vi.restoreAllMocks();
    await f.close();
  }
}, 60000);
