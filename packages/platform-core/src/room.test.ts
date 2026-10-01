import { describe, it, expect, vi } from 'vitest';
import type { BotStrategy, GameRules, JsonValue } from '@tablemax/game-sdk';
import type { Command } from '@tablemax/protocol';
import { rules, bot } from '../../../games/template';
import { score } from '../../../games/template/rules/scoring';
import type { State } from '../../../games/template/rules/state';
import { RoomCoordinator } from './room';
import { BotScheduler } from './bot-scheduler';
import type { Save, SaveRepository } from './model';

class MemoryRepository implements SaveRepository {
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
function envelope(
  room: RoomCoordinator,
  command: Command['command'],
  credential = room.hostToken,
): Command {
  const { instanceId, revision, branch } = room.view(credential);
  return {
    actionId: crypto.randomUUID(),
    instanceId,
    revision,
    branch,
    command,
  };
}
async function host(room: RoomCoordinator, command: Command['command']) {
  return room.command(room.hostToken, envelope(room, command));
}
async function fixture(strategy = bot, game = rules) {
  const repository = new MemoryRepository();
  const room = new RoomCoordinator(game, strategy, repository);
  const a = await room.join('阿明');
  const b = await room.join('小红');
  for (const player of [a, b])
    expect(
      (
        await room.command(
          player.token,
          envelope(room, { type: 'ready', ready: true }, player.token),
        )
      ).ok,
    ).toBe(true);
  expect((await host(room, { type: 'start' })).ok).toBe(true);
  return { room, repository, a, b };
}
function choose(room: RoomCoordinator, credential: string, value = 1) {
  const view = room.view(credential);
  return envelope(
    room,
    {
      type: 'game',
      decisionId: view.decisionId!,
      action: { type: 'choose', value },
    },
    credential,
  );
}

describe('real room invariants', () => {
  it('checkpoints host lifecycle transitions and replays the next deal after rollback', async () => {
    const { room, a, b } = await fixture();
    await room.command(a.token, choose(room, a.token));
    await room.command(b.token, choose(room, b.token));
    expect(room.view(room.hostToken).lifecycleActions).toEqual([
      { type: 'next-round' },
    ]);
    expect(
      await room.command(
        a.token,
        envelope(
          room,
          { type: 'lifecycle', action: { type: 'next-round' } },
          a.token,
        ),
      ),
    ).toEqual({ ok: false, reason: 'unauthorized' });
    await host(room, { type: 'lifecycle', action: { type: 'next-round' } });
    const after = room.view(a.token).gameView;
    const checkpoint = room.view(room.hostToken).history.at(-1)!;
    await host(room, { type: 'rollback', checkpointId: checkpoint.id });
    expect(
      (room.view(a.token).gameView as { results: unknown }).results,
    ).not.toBeNull();
    await host(room, { type: 'resume' });
    await host(room, { type: 'lifecycle', action: { type: 'next-round' } });
    expect(room.view(a.token).gameView).toEqual(after);
  });
  it('does not confuse observer errors with failed commits and deduplicates new-room transitions', async () => {
    const { room } = await fixture();
    room.subscribe(() => {
      throw new Error('observer failure');
    });
    expect((await host(room, { type: 'end' })).ok).toBe(true);
    const input = envelope(room, { type: 'new-room' });
    const once = await room.command(room.hostToken, input);
    const id = room.view().instanceId;
    expect(await room.command(room.hostToken, input)).toEqual(once);
    expect(room.view().instanceId).toBe(id);
  });
  it('enforces host authority, controller ownership, capacity, readiness and stable seat ordering', async () => {
    const repository = new MemoryRepository();
    const room = new RoomCoordinator(rules, bot, repository);
    const first = await room.join('同名');
    const second = await room.join('同名');
    expect(second.duplicateName).toBe(true);
    expect(
      await room.command(
        first.token,
        envelope(room, { type: 'add-bot', name: '作弊' }, first.token),
      ),
    ).toEqual({ ok: false, reason: 'unauthorized' });
    expect(
      await room.command(undefined, envelope(room, { type: 'start' })),
    ).toEqual({ ok: false, reason: 'unauthorized' });
    expect(await host(room, { type: 'start' })).toEqual({
      ok: false,
      reason: 'not-ready',
    });
    const id = room.view(first.token).self.seatId;
    expect(
      (
        await host(room, {
          type: 'order',
          seats: room
            .view()
            .seats.map((s) => s.id)
            .reverse(),
        })
      ).ok,
    ).toBe(true);
    expect(room.view(first.token).self.seatId).toBe(id);
    for (let i = 0; i < 3; i++)
      await host(room, { type: 'add-bot', name: '电脑' });
    await expect(room.join('超员')).rejects.toThrow('room-full');
    expect(await host(room, { type: 'add-bot', name: '超员' })).toEqual({
      ok: false,
      reason: 'room-full',
    });
    await host(room, { type: 'join-open', open: false });
    await expect(room.join('新人')).rejects.toThrow('joining-closed');
    expect(room.view(first.token).self.seatId).toBe(id);
  });
  it('projects only public state for host, personal secrets and legal choices for their actual owner', async () => {
    const { room, a, b } = await fixture();
    const publicView = room.view();
    const hostView = room.view(room.hostToken);
    const own = room.view(a.token);
    expect(publicView.gameView).toEqual(hostView.gameView);
    expect((hostView.gameView as { ownSecret: null }).ownSecret).toBeNull();
    expect((own.gameView as { ownSecret: number }).ownSecret).toBeGreaterThan(
      0,
    );
    expect(room.view(b.token).actions).toEqual([]);
    for (const view of [publicView, hostView, own, room.view(b.token)]) {
      const wire = JSON.stringify(view);
      for (const secret of [
        'tokenHash',
        'random',
        'receipts',
        'before',
        'bots',
        'secrets',
        a.token,
        room.hostToken,
      ])
        expect(wire).not.toContain(secret);
    }
    const attempt = choose(room, a.token);
    attempt.command = {
      type: 'game',
      decisionId: 'choose-0',
      action: { type: 'choose', value: 1 },
    };
    expect(await room.command(b.token, attempt)).toEqual({
      ok: false,
      reason: 'stale-decision',
    });
    expect(
      await room.command(a.token, {
        ...attempt,
        seatId: room.view(b.token).self.seatId,
      }),
    ).toEqual({ ok: false, reason: 'invalid-message' });
  });
  it('serializes concurrent duplicate commands and detects reused IDs with different content', async () => {
    const { room, a } = await fixture();
    const input = choose(room, a.token);
    const [one, two] = await Promise.all([
      room.command(a.token, input),
      room.command(a.token, input),
    ]);
    expect(one).toEqual(two);
    expect(one.ok).toBe(true);
    expect(room.view(room.hostToken).history).toHaveLength(1);
    expect(
      await room.command(a.token, {
        ...input,
        command: {
          type: 'game',
          decisionId: 'choose-0',
          action: { type: 'choose', value: 2 },
        },
      }),
    ).toEqual({ ok: false, reason: 'action-id-conflict' });
  });
  it('publishes nothing and leaves state unchanged when transaction save fails, then allows exact retry', async () => {
    const { room, repository, a } = await fixture();
    const before = room.view(a.token);
    const input = choose(room, a.token);
    const listener = vi.fn();
    room.subscribe(listener);
    repository.fail = true;
    expect(await room.command(a.token, input)).toEqual({
      ok: false,
      reason: 'save-or-action-failed',
    });
    expect(room.view(a.token)).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
    repository.fail = false;
    expect((await room.command(a.token, input)).ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('invalidates old branches, truncates active history, restores RNG and keeps current binding after rollback', async () => {
    const { room, a, b } = await fixture();
    const input = choose(room, a.token);
    await room.command(a.token, input);
    await room.command(b.token, choose(room, b.token));
    const target = room.view(room.hostToken).history[0]!;
    const reply = await host(room, {
      type: 'rebind',
      seatId: room.view(a.token).self.seatId!,
    });
    expect(reply.ok && reply.bindingCode).toBeTruthy();
    const rebound = await room.redeem(reply.ok ? reply.bindingCode! : '');
    await expect(
      room.redeem(reply.ok ? reply.bindingCode! : ''),
    ).rejects.toThrow('binding-expired');
    await host(room, { type: 'rollback', checkpointId: target.id });
    expect(() => room.view(a.token)).toThrow('invalid-identity');
    expect(room.view(rebound.token).self.seatId).toBe(room.view().seats[0]!.id);
    expect(room.view().paused).toBe(true);
    expect(room.view().branch).toBe(1);
    expect(room.view(room.hostToken).history).toEqual([]);
    expect(await room.command(rebound.token, input)).toEqual({
      ok: false,
      reason: 'stale-branch',
    });
    await host(room, { type: 'resume' });
    expect(
      (await room.command(rebound.token, choose(room, rebound.token))).ok,
    ).toBe(true);
    expect(
      await host(room, { type: 'rollback', checkpointId: target.id }),
    ).toEqual({ ok: false, reason: 'invalid-checkpoint' });
  });
  it('restores accepted state and receipts but starts paused, preserving credentials and rotating host', async () => {
    const { room, repository, a } = await fixture();
    await room.command(a.token, choose(room, a.token));
    const before = room.view(a.token);
    const restored = new RoomCoordinator(rules, bot, repository);
    expect(restored.hostToken).not.toBe(room.hostToken);
    expect(() => restored.view(room.hostToken)).toThrow();
    expect(restored.view(a.token).gameView).toEqual(before.gameView);
    expect(restored.view().paused).toBe(true);
    expect(restored.restored).toBe(true);
    expect(restored.view().revision).toBeGreaterThan(before.revision);
    expect(restored.view().branch).toBeGreaterThan(before.branch);
  });
  it('rejects incompatible state, rules and strategies without changing original save', async () => {
    const { repository } = await fixture();
    const original = structuredClone(repository.value!);
    repository.value!.manifest.rulesVersion = 'other';
    expect(() => new RoomCoordinator(rules, bot, repository)).toThrow(
      'incompatible-save',
    );
    expect(repository.value!.manifest.rulesVersion).toBe('other');
    repository.value = original;
    (repository.value.snapshot!.state as { turn: number }).turn = -1;
    expect(() => new RoomCoordinator(rules, bot, repository)).toThrow(
      'Invalid template state',
    );
    const bots = new MemoryRepository();
    const room = new RoomCoordinator(rules, bot, bots);
    await host(room, { type: 'add-bot', name: '一' });
    await host(room, { type: 'add-bot', name: '二' });
    await host(room, { type: 'start' });
    const saved = structuredClone(bots.value);
    expect(
      () => new RoomCoordinator(rules, { ...bot, version: '2' }, bots),
    ).toThrow('incompatible-strategy');
    expect(bots.value).toEqual(saved);
    expect(
      () => new RoomCoordinator(rules, { ...bot, rulesVersion: 'wrong' }, bots),
    ).toThrow('incompatible-strategy');
  });
  it('replays rule random draws and results across rollback without advancing strategy randomness', async () => {
    const randomized: GameRules = {
      ...rules,
      apply(state, action, seat, context) {
        const result = rules.apply(state, action, seat, context);
        (result.state as { choices: Record<string, number> }).choices[seat] =
          1 + Math.floor(context.random.next() * 3);
        return result;
      },
    };
    const { room, repository, a } = await fixture(bot, randomized);
    const rng = repository.value!.snapshot!.random;
    await room.command(a.token, choose(room, a.token));
    const output = room.view(a.token).gameView;
    await host(room, {
      type: 'rollback',
      checkpointId: room.view(room.hostToken).history[0]!.id,
    });
    expect(repository.value!.snapshot!.random).toBe(rng);
    await host(room, { type: 'resume' });
    await room.command(a.token, choose(room, a.token));
    expect(room.view(a.token).gameView).toEqual(output);
  });
  it('supports multiple pending actors and separate checkpoints through one serial queue', async () => {
    const multi: GameRules = {
      ...rules,
      validateState(input, seats) {
        const state = input as State;
        if (
          JSON.stringify(state.seats) !== JSON.stringify(seats) ||
          Object.keys(state.choices).length !== state.turn
        )
          throw new Error('Invalid simultaneous fixture');
        return structuredClone(state);
      },
      legalActions(input, seatId) {
        const state = input as State;
        return state.seats.includes(seatId) && !(seatId in state.choices)
          ? [1, 2, 3].map((value) => ({ type: 'choose', value }))
          : [];
      },
      apply(input, action, seatId) {
        const state = structuredClone(input) as State;
        state.choices[seatId] = (action as { value: number }).value;
        state.turn++;
        if (state.turn === state.seats.length)
          state.winners = score(
            Object.fromEntries(
              state.seats.map((s) => [
                s,
                state.secrets[s]! + state.choices[s]!,
              ]),
            ),
          );
        return {
          state,
          decision: { label: '初始化选择之前', revealedInformation: true },
        };
      },
      decisions(input) {
        const s = input as { seats: string[]; choices: Record<string, number> };
        return s.seats
          .filter((id) => !(id in s.choices))
          .map((seatId) => ({ id: `initial-${seatId}`, seatId }));
      },
    };
    const { room, a, b } = await fixture(bot, multi);
    expect(room.view(a.token).decisionId).not.toBeNull();
    expect(room.view(b.token).decisionId).not.toBeNull();
    expect((await room.command(b.token, choose(room, b.token))).ok).toBe(true);
    expect((await room.command(a.token, choose(room, a.token))).ok).toBe(true);
    expect(room.view(room.hostToken).history).toHaveLength(2);
  });
});

describe('bot scheduling and independent strategy replacement', () => {
  it('stops and reports a bot storage failure without advancing unsaved state, then resumes after storage recovers', async () => {
    const repository = new MemoryRepository();
    const room = new RoomCoordinator(rules, bot, repository);
    await host(room, { type: 'add-bot', name: '一' });
    await host(room, { type: 'add-bot', name: '二' });
    await host(room, { type: 'start' });
    const snapshot = structuredClone(repository.value!.snapshot);
    repository.fail = true;
    const scheduler = new BotScheduler(room, 1);
    try {
      await vi.waitFor(() =>
        expect(room.view().botError).toContain('未能保存'),
      );
      expect(room.view(room.hostToken).history).toEqual([]);
      expect(repository.value!.snapshot).toEqual(snapshot);
      expect(room.botTask()).toBeNull();
      repository.fail = false;
      expect((await host(room, { type: 'resume' })).ok).toBe(true);
      await vi.waitFor(() => expect(room.view().status).toBe('ended'));
      expect(room.view().botError).toBeNull();
    } finally {
      scheduler.stop();
    }
  });
  async function bots(strategy: BotStrategy) {
    const repository = new MemoryRepository();
    const room = new RoomCoordinator(rules, strategy, repository);
    await host(room, { type: 'add-bot', name: '电脑一' });
    await host(room, { type: 'add-bot', name: '电脑二' });
    await host(room, { type: 'start' });
    return { room, repository };
  }
  it('completes a game, saves strategy state, exposes only owner-authorized inputs, and can replace policy without changing rules', async () => {
    const inputs: unknown[] = [];
    const strategy: BotStrategy = {
      ...bot,
      async decide(input) {
        inputs.push(
          structuredClone({ ...input, random: undefined, signal: undefined }),
        );
        return { action: input.actions[2]!, memory: null };
      },
    };
    const { room, repository } = await bots(strategy);
    const scheduler = new BotScheduler(room, 1);
    try {
      await vi.waitFor(() => expect(room.view().status).toBe('ended'));
      expect(room.view(room.hostToken).history).toHaveLength(2);
      expect(inputs).toHaveLength(2);
      for (const input of inputs) {
        const json = JSON.stringify(input);
        expect(json).not.toContain('secrets');
        expect(json).not.toContain('token');
        expect(json).not.toContain('before');
      }
      expect(
        Object.values(repository.value!.snapshot!.bots).every(
          (b) => b.memory === null,
        ),
      ).toBe(true);
      expect(
        Object.values(
          (room.view().gameView as { choices: Record<string, number> }).choices,
        ),
      ).toEqual([3, 3]);
    } finally {
      scheduler.stop();
    }
  });
  it('cancels late computations on pause and rejects captured results after rollback', async () => {
    let resolve:
      ((value: { action: JsonValue; memory: JsonValue }) => void) | undefined;
    const strategy: BotStrategy = {
      ...bot,
      decide() {
        return new Promise((r) => {
          resolve = r;
        });
      },
    };
    const { room } = await bots(strategy);
    const scheduler = new BotScheduler(room, 1);
    try {
      await vi.waitFor(() => expect(resolve).toBeDefined());
      const task = room.botTask()!;
      await host(room, { type: 'pause' });
      resolve!({ action: task.actions[0]!, memory: null });
      await new Promise((r) => setTimeout(r, 10));
      expect(room.view(room.hostToken).history).toEqual([]);
      expect(
        (await room.submitBot(task, task.actions[0]!, null, task.data.random))
          .ok,
      ).toBe(false);
      await host(room, { type: 'resume' });
      const current = room.botTask()!;
      await room.submitBot(
        current,
        current.actions[0]!,
        null,
        current.data.random,
      );
      await host(room, {
        type: 'rollback',
        checkpointId: room.view(room.hostToken).history[0]!.id,
      });
      expect(
        await room.submitBot(
          current,
          current.actions[0]!,
          null,
          current.data.random,
        ),
      ).toEqual({ ok: false, reason: 'stale-branch' });
    } finally {
      scheduler.stop();
    }
  });
  it('halts safely on illegal intent, exception and timeout without an infinite retry loop', async () => {
    for (const decide of [
      async () => ({ action: { type: 'choose', value: 99 }, memory: null }),
      async () => {
        throw new Error('secret internal failure');
      },
      () => new Promise<never>(() => undefined),
    ]) {
      const spy = vi.fn(decide);
      const { room } = await bots({ ...bot, decide: spy });
      const scheduler = new BotScheduler(room, 1, 10);
      try {
        await vi.waitFor(() => expect(room.view().botError).not.toBeNull());
        expect(room.view().paused).toBe(true);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(room.view())).not.toContain(
          'secret internal failure',
        );
        expect(room.view(room.hostToken).history).toEqual([]);
      } finally {
        scheduler.stop();
      }
    }
  });
  it('never takes over disconnected humans and restores bot memory/random at checkpoint', async () => {
    const { room } = await fixture();
    const scheduler = new BotScheduler(room, 1);
    try {
      expect(room.botTask()).toBeNull();
      expect(room.view().seats.every((s) => !s.online)).toBe(true);
    } finally {
      scheduler.stop();
    }
    const fixtureBots = await bots(bot);
    const task = fixtureBots.room.botTask()!;
    const original = structuredClone(
      fixtureBots.repository.value!.snapshot!.bots,
    );
    await fixtureBots.room.submitBot(task, task.actions[0]!, null, 123);
    await host(fixtureBots.room, {
      type: 'rollback',
      checkpointId: fixtureBots.room.view(fixtureBots.room.hostToken)
        .history[0]!.id,
    });
    expect(fixtureBots.repository.value!.snapshot!.bots).toEqual(original);
  });
  it('restores nonempty strategy memory across restart and restores its before value on rollback', async () => {
    const strategy: BotStrategy = {
      ...bot,
      validateMemory(input) {
        if (input === null) return { count: 0 };
        const value = input as { count: number };
        if (!value || !Number.isInteger(value.count) || value.count < 0)
          throw new Error('Invalid memory');
        return { count: value.count };
      },
      async decide({ actions, memory }) {
        return {
          action: actions[0]!,
          memory: { count: (memory as { count: number }).count + 1 },
        };
      },
    };
    const { room, repository } = await bots(strategy);
    const task = room.botTask()!;
    await room.submitBot(task, task.actions[0]!, { count: 1 }, 123);
    const restored = new RoomCoordinator(rules, strategy, repository);
    expect(
      repository.value!.snapshot!.bots[task.decision.seatId]!.memory,
    ).toEqual({ count: 1 });
    await host(restored, {
      type: 'rollback',
      checkpointId: restored.view(restored.hostToken).history[0]!.id,
    });
    expect(
      repository.value!.snapshot!.bots[task.decision.seatId]!.memory,
    ).toEqual({ count: 0 });
    expect(repository.value!.snapshot!.bots[task.decision.seatId]!.random).toBe(
      task.data.random,
    );
  });
});
