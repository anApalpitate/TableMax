import { expect, it } from 'vitest';
import {
  rules,
  legalActions,
  isLegalAction,
  project,
  validateState,
} from './index';
import { context, fixture } from './test-fixtures';
import type { State } from './state';
import { RoomCoordinator } from '../../../packages/platform-core/src/room';
import {
  BotScheduler,
  reactionDelayMs,
} from '../../../packages/platform-core/src/bot-scheduler';
import type { Save } from '../../../packages/platform-core/src/model';
import type { Command } from '../../../packages/protocol/src';
import { bot } from '../bot';
it('出牌后同时开放喊牌与抓漏，第一保存获胜且下一回合关闭窗口', () => {
  const before = fixture({
    a: ['red-8-a', 'green-2-a'],
    b: ['red-1-a'],
    c: ['blue-1-a'],
  });
  const ctx = context(41, before.seats);
  expect(
    isLegalAction(before, { type: 'play', cardId: 'red-8-a', uno: true }, 'a'),
  ).toBe(false);
  expect(legalActions(before, 'b').some((a) => a.type === 'catch-uno')).toBe(
    false,
  );
  const open = rules.apply(
    before,
    { type: 'play', cardId: 'red-8-a' },
    'a',
    ctx,
  ).state as State;
  expect(legalActions(open, 'a')).toContainEqual({ type: 'declare-uno' });
  for (const seat of ['b', 'c'])
    expect(legalActions(open, seat)).toContainEqual({
      type: 'catch-uno',
      target: 'a',
    });
  const declared = rules.apply(open, { type: 'declare-uno' }, 'a', ctx)
    .state as State;
  expect(isLegalAction(declared, { type: 'catch-uno', target: 'a' }, 'b')).toBe(
    false,
  );
  const caught = rules.apply(open, { type: 'catch-uno', target: 'a' }, 'c', ctx)
    .state as State;
  expect(caught.hands.a).toHaveLength(3);
  expect(isLegalAction(caught, { type: 'declare-uno' }, 'a')).toBe(false);
  const closed = rules.apply(
    open,
    { type: 'play', cardId: 'red-1-a' },
    'b',
    ctx,
  ).state as State;
  expect(closed.unoWindow).toBeNull();
  expect(project(open, { role: 'public' }).self).toBeNull();
  validateState(caught, caught.seats);
});

it('三档普通模式保留真实喊牌等待，延迟不消耗牌库随机源', async () => {
  for (const difficulty of ['default', 'doubao', 'juewu'] as const) {
    let save: Save | null = null;
    const room = new RoomCoordinator(
      {
        ...rules,
        initialize: ({ seats }) =>
          fixture({
            [seats[0]!]: ['red-8-a', 'green-2-a'],
            [seats[1]!]: ['red-1-a', 'yellow-2-a'],
          }),
      },
      bot,
      {
        load: () => structuredClone(save),
        save: (value) => {
          save = structuredClone(value);
        },
      },
    );
    const send = (token: string, command: Command['command']) => {
      const v = room.view(token);
      return room.command(token, {
        actionId: crypto.randomUUID(),
        instanceId: v.instanceId,
        branch: v.branch,
        revision: v.revision,
        command,
      });
    };
    expect(
      (
        await send(room.hostToken, {
          type: 'add-bot',
          name: difficulty,
          difficulty,
        })
      ).ok,
    ).toBe(true);
    const human = await room.join('普通模式真人');
    await send(human.token, { type: 'ready', ready: true });
    await send(room.hostToken, { type: 'set-play-mode', mode: 'play' });
    await send(room.hostToken, { type: 'start' });
    const turn = room.botTask()!;
    expect(
      (
        await room.submitBot(
          turn,
          { type: 'play', cardId: 'red-8-a' },
          turn.data.memory,
          turn.data.random,
        )
      ).ok,
    ).toBe(true);
    const response = room.botTask()!;
    const waitMs = reactionDelayMs(response);
    const [min, max] = {
      default: [800, 3200],
      doubao: [400, 1800],
      juewu: [200, 900],
    }[difficulty];
    expect(waitMs).toBeGreaterThanOrEqual(min!);
    expect(waitMs).toBeLessThanOrEqual(max!);
    expect(reactionDelayMs(response)).toBe(waitMs);
    const random = (save as Save | null)!.snapshot!.random;
    const at = performance.now();
    const scheduler = new BotScheduler(room);
    try {
      await new Promise((done) => setTimeout(done, min! - 30));
      expect(
        (
          room.view(human.token).gameView as unknown as {
            players: Record<string, { uno: boolean }>;
          }
        ).players[turn.decision.seatId]!.uno,
      ).toBe(false);
      while (room.botTask()?.timing) {
        if (performance.now() - at > max! + 1500)
          throw new Error('Normal reaction did not save');
        await new Promise((done) => setTimeout(done, 20));
      }
      expect(performance.now() - at).toBeGreaterThanOrEqual(min! - 20);
      expect(
        (
          room.view(human.token).gameView as unknown as {
            players: Record<string, { uno: boolean }>;
          }
        ).players[turn.decision.seatId]!.uno,
      ).toBe(true);
      expect((save as Save | null)!.snapshot!.random).toBe(random);
    } finally {
      scheduler.stop();
    }
  }
}, 15000);
