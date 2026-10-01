import { it, expect } from 'vitest';
import type { Command, RoomFeedback } from '../../../packages/protocol/src';
import type { JsonValue } from '@tablemax/game-sdk';
import { RoomCoordinator } from '../../../packages/platform-core/src/room';
import type {
  Save,
  SaveRepository,
} from '../../../packages/platform-core/src/model';
import { RandomSource } from '../../../packages/platform-core/src/random';
import fixtures from '../../../docs/games/pokemon-encounters/scenarios.json';
import { rules, type Action } from './index';
import { actor, type State } from './state';
import { bot } from '../bot';

class Repository implements SaveRepository {
  value: Save | null = null;
  fail = false;
  load() {
    return structuredClone(this.value);
  }
  save(next: Save) {
    if (this.fail) throw new Error('Storage unavailable');
    this.value = structuredClone(next);
  }
}
function envelope(
  room: RoomCoordinator,
  token: string,
  command: Command['command'],
): Command {
  const view = room.view(token);
  return {
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    actionId: crypto.randomUUID(),
    command,
  };
}
const host = (room: RoomCoordinator, command: Command['command']) =>
  room.command(room.hostToken, envelope(room, room.hostToken, command));
function savedFixture(
  id: string,
  seats: readonly string[],
  coin?: number,
): State {
  const f = fixtures.scenarios.find((entry) => entry.id === id)!.fixture!;
  const oldSeats = Object.keys(f.boards);
  const map = (seat: string) => seats[oldSeats.indexOf(seat)]!;
  const base = rules.initialize({
    seats,
    random: new RandomSource(1),
  }) as State;
  let s: State = {
    ...base,
    boards: Object.fromEntries(
      oldSeats.map((seat) => [
        map(seat),
        structuredClone(f.boards[seat as keyof typeof f.boards]!),
      ]),
    ),
    turnSeat: map(f.turnSeat),
    deck: [...f.deckBottomToTop],
    discard: [...f.discardBottomToTop],
    held: f.held,
    phase: f.phase === 'initial' ? 'initial-flip' : (f.phase as State['phase']),
    initialDone: f.phase === 'initial' ? [] : [...seats],
  };
  if (coin !== undefined)
    s = rules.apply(s, { type: 'draw', source: 'deck' }, s.turnSeat, {
      seats,
      random: { next: () => coin },
    }).state as State;
  return s;
}

it('V12/V15 saves and restores D01–D13 before boundaries including every ability choice and lifecycle', async () => {
  const paths: {
    id: string;
    count: number;
    coin?: number;
    actions: Action[];
  }[] = [
    {
      id: 'V00',
      count: 2,
      actions: [
        { type: 'initial-flip', slot: 0 },
        { type: 'initial-flip', slot: 1 },
        { type: 'draw', source: 'deck' },
        { type: 'replace', slot: 1 },
      ],
    },
    {
      id: 'V03',
      count: 2,
      actions: [
        { type: 'draw', source: 'deck' },
        { type: 'mew-target', seat: 'other', slot: 5 },
        { type: 'replace', slot: 1 },
        { type: 'next-round' },
      ],
    },
    { id: 'V04', count: 2, coin: 0.1, actions: [{ type: 'replace', slot: 5 }] },
    { id: 'V05', count: 3, coin: 0.9, actions: [{ type: 'replace', slot: 5 }] },
    {
      id: 'V06',
      count: 3,
      actions: [
        { type: 'draw', source: 'deck' },
        { type: 'replace', slot: 5 },
        { type: 'replace', slot: 1 },
        { type: 'replace', slot: 2 },
      ],
    },
    {
      id: 'V07',
      count: 2,
      actions: [
        { type: 'draw', source: 'deck' },
        { type: 'replace', slot: 1 },
        { type: 'swap', a: 1, b: 2 },
      ],
    },
    {
      id: 'V08',
      count: 2,
      actions: [
        { type: 'draw', source: 'deck' },
        { type: 'replace', slot: 1 },
        { type: 'peek', slot: 2 },
        { type: 'close-peek' },
      ],
    },
  ];
  const labels = new Set<string>();
  for (const path of paths) {
    const repo = new Repository();
    const game = {
      ...rules,
      initialize: ({ seats }: { seats: readonly string[] }) =>
        savedFixture(path.id, seats, path.coin),
    };
    let room = new RoomCoordinator(game, bot, repo);
    const players = [];
    for (let i = 0; i < path.count; i++) players.push(await room.join(`P${i}`));
    for (const p of players)
      expect(
        (
          await room.command(
            p.token,
            envelope(room, p.token, { type: 'ready', ready: true }),
          )
        ).ok,
      ).toBe(true);
    expect((await host(room, { type: 'start' })).ok).toBe(true);
    for (let index = 0; index < path.actions.length; index++) {
      const action = structuredClone(path.actions[index]!);
      if (action.type === 'mew-target') action.seat = room.view().seats[1]!.id;
      const state = repo.value!.snapshot!.state as State;
      const seat =
        state.phase === 'initial-flip' ? state.seatOrder[index]! : actor(state);
      const token =
        action.type === 'next-round'
          ? room.hostToken
          : players.find((p) => room.view(p.token).self.seatId === seat)!.token;
      const command: Command['command'] =
        action.type === 'next-round'
          ? { type: 'lifecycle', action }
          : { type: 'game', decisionId: room.view(token).decisionId!, action };
      const intent = envelope(room, token, command);
      const before = structuredClone(repo.value!.snapshot!);
      expect((await room.command(token, intent)).ok).toBe(true);
      const after = structuredClone(repo.value!.snapshot!);
      const checkpoint = room.view(room.hostToken).history.at(-1)!;
      labels.add(
        checkpoint.label
          .replace(/^S\d /, '')
          .replace(/第 \d 小局/, '第 n 小局'),
      );
      expect(
        (await host(room, { type: 'rollback', checkpointId: checkpoint.id }))
          .ok,
      ).toBe(true);
      expect(repo.value!.snapshot).toEqual(before);
      expect(room.view().paused).toBe(true);
      expect(await room.command(token, intent)).toEqual({
        ok: false,
        reason: 'stale-branch',
      });
      room = new RoomCoordinator(game, bot, repo);
      expect(repo.value!.snapshot).toEqual(before);
      expect(room.view().paused).toBe(true);
      expect(room.botTask()).toBeNull();
      expect((await host(room, { type: 'resume' })).ok).toBe(true);
      const retryToken = action.type === 'next-round' ? room.hostToken : token;
      const retry =
        command.type === 'game'
          ? { ...command, decisionId: room.view(retryToken).decisionId! }
          : command;
      expect(
        (await room.command(retryToken, envelope(room, retryToken, retry))).ok,
      ).toBe(true);
      expect(repo.value!.snapshot).toEqual(after);
    }
  }
  expect(labels.size).toBe(13);
});

it('V13/V18 publishes public feedback only after commit and never on duplicate, rejection, sync or rollback', async () => {
  const repo = new Repository(),
    room = new RoomCoordinator(rules, bot, repo);
  const feedback: RoomFeedback[] = [];
  room.subscribe((event) => {
    if (event) feedback.push(event);
  });
  const a = await room.join('朋友 A'),
    b = await room.join('朋友');
  await room.command(
    a.token,
    envelope(room, a.token, { type: 'ready', ready: true }),
  );
  await room.command(
    b.token,
    envelope(room, b.token, { type: 'ready', ready: true }),
  );
  await host(room, { type: 'start' });
  expect(room.view(room.hostToken).self).toEqual({
    role: 'host',
    seatId: null,
  });
  expect(room.view(room.hostToken).actions).toEqual([]);
  const intent = envelope(room, a.token, {
    type: 'game',
    decisionId: room.view(a.token).decisionId!,
    action: { type: 'initial-flip', slot: 0 },
  });
  repo.fail = true;
  expect((await room.command(a.token, intent)).ok).toBe(false);
  expect(feedback).toHaveLength(0);
  repo.fail = false;
  const ack = await room.command(a.token, intent);
  expect(ack.ok).toBe(true);
  expect(feedback).toHaveLength(1);
  expect(await room.command(a.token, intent)).toEqual(ack);
  expect(feedback).toHaveLength(1);
  room.view();
  room.view(a.token);
  expect(feedback).toHaveLength(1);
  await host(room, {
    type: 'rollback',
    checkpointId: room.view(room.hostToken).history.at(-1)!.id,
  });
  expect(feedback).toHaveLength(1);
  expect(JSON.stringify(feedback)).not.toContain('#');
  expect(room.view(a.token).self.role).toBe('player');
  expect(
    (await room.command(a.token, envelope(room, a.token, { type: 'resume' })))
      .ok,
  ).toBe(false);
});

it('V14/V19/V22 mixed human/bot full match uses only projected actions and never advances a waiting human', async () => {
  const repo = new Repository(),
    room = new RoomCoordinator(rules, bot, repo);
  const human = await room.join('真人');
  await room.command(
    human.token,
    envelope(room, human.token, { type: 'ready', ready: true }),
  );
  await host(room, { type: 'add-bot', name: '电脑' });
  await host(room, { type: 'start' });
  let steps = 0;
  while (room.view().status !== 'ended' && steps++ < 1000) {
    const task = room.botTask();
    if (task) {
      const serialized = JSON.stringify(task.view);
      expect(serialized).not.toContain('#');
      expect(serialized).not.toContain('deck":');
      const result = await bot.decide({
        ...task,
        memory: task.data.memory,
        signal: new AbortController().signal,
        random: new RandomSource(task.data.random),
      });
      expect(
        (
          await room.submitBot(
            task,
            result.action,
            result.memory,
            task.data.random,
          )
        ).ok,
      ).toBe(true);
    } else if (room.view(room.hostToken).lifecycleActions.length) {
      await host(room, { type: 'lifecycle', action: { type: 'next-round' } });
    } else {
      const view = room.view(human.token);
      expect(view.actions.length).toBeGreaterThan(0);
      const before = repo.value!.revision;
      expect(room.botTask()).toBeNull();
      expect(repo.value!.revision).toBe(before);
      // Test driver submits explicit human intents; the product never takes over the human.
      const result = await bot.decide({
        view: view.gameView as JsonValue,
        actions: view.actions as JsonValue[],
        decision: { id: view.decisionId!, seatId: view.self.seatId! },
        memory: null,
        signal: new AbortController().signal,
        random: new RandomSource(1),
      });
      expect(
        (
          await room.command(
            human.token,
            envelope(room, human.token, {
              type: 'game',
              decisionId: view.decisionId!,
              action: result.action,
            }),
          )
        ).ok,
      ).toBe(true);
    }
  }
  expect(steps).toBeLessThan(1000);
  expect(
    (repo.value!.snapshot!.state as State).matchWinners.length,
  ).toBeGreaterThan(0);
});
