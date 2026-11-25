import type { BotDifficulty } from '@tablemax/game-sdk';
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Command } from '@tablemax/protocol';
import { RoomCoordinator, type Save } from '@tablemax/platform-core';
import { bot, rules } from '../../../games/ra';
import { limits, tileIds } from '../../../games/ra/rules/data';
import type { Action, RaView } from '../../../games/ra/rules';
import type { State } from '../../../games/ra/rules/state';
import { build } from 'esbuild';
import { SqliteSaveRepository } from './save-repository';
import { WorkerBotExecutor } from './bot-executor';

function context(count: number) {
  let seed = 19;
  return {
    seats: Array.from({ length: count }, (_, i) => String.fromCharCode(97 + i)),
    random: {
      next: () =>
        (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32,
    },
  };
}

function arrange(
  s: State,
  lot: (string | null)[],
  held: Record<string, string[]>,
  draws: string[] = [],
) {
  for (const seat of s.seats) s.players[seat]!.held = held[seat] ?? [];
  s.lot = Array.from({ length: 8 }, (_, i) => lot[i] ?? null);
  const assigned = [...Object.values(held).flat(), ...lot, ...draws];
  s.bag = [
    ...tileIds.filter((id) => !assigned.includes(id)),
    ...[...draws].reverse(),
  ];
  return rules.validateState(s, s.seats);
}

const apply = (s: State, action: Action) =>
  rules.apply(s, action, s.actor!, {
    seats: s.seats,
    random: { next: () => 0 },
  }).state;

async function pickRa(state: State, difficulty: BotDifficulty) {
  const decision = rules.decisions(state)[0]!;
  const actions = rules.legalActions(state, decision.seatId);
  const result = await bot.decide({
    view: rules.project(state, { role: 'player', seatId: decision.seatId }),
    actions,
    decision,
    memory: null,
    difficulty,
    random: { next: () => 0.5 },
    signal: new AbortController().signal,
  });
  expect(actions).toContainEqual(result.action);
  return result.action;
}

function leaderAuction() {
  let s = arrange(rules.initialize(context(3)), ['flood-1'], {
    b: ['nile-1', 'nile-2', 'nile-3', 'nile-4', 'nile-5'],
  });
  s.actor = 'a';
  s.center = 3;
  s.players.a!.up = [2, 8, 11, 12];
  s.players.b!.up = [4, 5, 7, 9];
  s.players.c!.up = [1, 6, 10, 13];
  s = apply(s, { type: 'invokeRa' });
  s = apply(s, { type: 'bid', disk: 7 });
  return apply(s, { type: 'pass' });
}

describe('Ra retail third printing', () => {
  it('projects settlement effects without exposing hidden scores', () => {
    const closed = arrange(rules.initialize(context(2)), [], {}, ['ra-1']);
    closed.raDrawn = limits[2] - 1;
    const result = apply(closed, { type: 'draw' });
    const hidden = rules.project(result, { role: 'public' });
    expect(hidden.scenes.map(({ kind }) => kind)).toEqual(['ra', 'settlement']);
    expect(hidden.publicScores).toBeUndefined();
    expect(
      hidden.players.every(({ private: details }) => details === null),
    ).toBe(true);
    expect(JSON.stringify(hidden.scenes)).not.toMatch(
      /parts|delta|total|spentDisks/,
    );
    const open = rules.project(
      { ...result, publicScoring: true },
      { role: 'public' },
    );
    expect(open.publicScores?.map(({ latest }) => latest?.epoch)).toEqual([
      1, 1,
    ]);
    expect(open.players.every(({ private: details }) => details === null)).toBe(
      true,
    );
  });
  it.each([2, 3, 4, 5] as const)(
    'completes a three-epoch match with %i seats',
    async (n) => {
      const ctx = context(n);
      let s = rules.initialize(ctx);
      expect(s.bag).toHaveLength(180);
      expect(rules.project(s, { role: 'public' }).limit).toBe(limits[n]);
      const difficulties = bot.difficulties!;
      for (let i = 0; i < 550 && !rules.ended(s); i++) {
        const decision = rules.decisions(s)[0]!;
        const actions = rules.legalActions(s, decision.seatId);
        const choice = await bot.decide({
          view: rules.project(s, { role: 'player', seatId: decision.seatId }),
          actions,
          decision,
          memory: null,
          random: ctx.random,
          difficulty: difficulties[s.seats.indexOf(decision.seatId) % 3]!,
          signal: new AbortController().signal,
        });
        s = apply(s, rules.validateAction(choice.action));
      }
      expect(rules.ended(s)).toBe(true);
      expect(s.winner).toBeTruthy();
      expect(
        rules
          .project(s, { role: 'public' })
          .players.every((p) => p.private?.scores.length === 3),
      ).toBe(true);
    },
  );

  it('keeps draw-Ra lots, discards full invoked lots and enforces the caller bid on an empty lot', () => {
    const base = rules.initialize(context(3));
    const original = arrange(structuredClone(base), ['gold-1'], {}, ['ra-1']);
    let s = apply(original, { type: 'draw' });
    const caller = original.actor!;
    expect(s.actor).not.toBe(caller);
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'pass' });
    expect(s.lot[0]).toBe('gold-1');
    expect(s.lastAuction?.tiles).toEqual(['gold-1']);
    expect(s.center).toBe(1);
    const next = original.seats[(original.seats.indexOf(caller) + 1) % 3];
    expect(s.actor).toBe(next);
    s = arrange(
      structuredClone(base),
      Array.from({ length: 8 }, (_, i) => `pharaoh-${i + 1}`),
      {},
    );
    expect(rules.legalActions(s, s.actor!)).not.toContainEqual({
      type: 'draw',
    });
    s = apply(s, { type: 'invokeRa' });
    for (let i = 0; i < 3; i++) s = apply(s, { type: 'pass' });
    expect(s.lot.every((id) => id === null)).toBe(true);
    expect(s.removed).toHaveLength(8);
    expect(s.lastAuction?.tiles).toEqual(s.removed);
    s = apply(s, { type: 'invokeRa' });
    s = apply(s, { type: 'pass' });
    s = apply(s, { type: 'pass' });
    const winner = s.actor!;
    expect(() => apply(s, { type: 'pass' })).toThrow();
    const disk = s.players[winner]!.up[0]!;
    s = apply(s, { type: 'bid', disk });
    expect(s.center).toBe(disk);
    expect(s.players[winner]!.down).toEqual([1]);
  });

  it('keeps public recap tiles in slot order and restores older records without them', () => {
    const base = rules.initialize(context(3));
    let state = arrange(base, [null, 'gold-1', null, 'pharaoh-1'], {});
    state = apply(state, { type: 'invokeRa' });
    state = apply(state, { type: 'pass' });
    state = apply(state, { type: 'pass' });
    const disk = state.players[state.actor!]!.up[0]!;
    state = apply(state, { type: 'bid', disk });
    expect(state.lastAuction?.tiles).toEqual(['gold-1', 'pharaoh-1']);
    expect(rules.project(state, { role: 'public' }).lastAuction).toEqual(
      state.lastAuction,
    );
    expect(rules.validateState(state, state.seats)).toBe(state);
    const previous = structuredClone(state);
    delete previous.lastAuction!.tiles;
    expect(rules.validateState(previous, previous.seats)).toBe(previous);
    expect(rules.project(previous, { role: 'public' }).lastAuction).toEqual(
      previous.lastAuction,
    );
  });

  it('draws from an empty lot across difficulties unless the upgrade is uncontested', async () => {
    const ctx = context(3);
    const state = rules.initialize(ctx);
    const decision = rules.decisions(state)[0]!;
    const view = rules.project(state, {
      role: 'player',
      seatId: decision.seatId,
    });
    const own = view.players.find(({ seat }) => seat === decision.seatId)!;
    const decide = async (
      center: number,
      disks: number[],
      auction = false,
      solo = false,
      difficulty: BotDifficulty = 'default',
    ) =>
      bot.decide({
        view: {
          ...view,
          center,
          auction: auction
            ? { caller: own.seat, cause: 'invokeOpen', bids: [] }
            : null,
          players: view.players.map((player) =>
            player === own
              ? { ...own, disks }
              : solo
                ? { ...player, disks: [] }
                : player,
          ),
        },
        decision,
        actions: auction
          ? disks.map((disk) => ({ type: 'bid', disk }))
          : [{ type: 'draw' }, { type: 'invokeRa' }],
        memory: null,
        random: { next: () => 0.99 },
        difficulty,
        signal: new AbortController().signal,
      });
    expect((await decide(1, [2, 7])).action).toEqual({ type: 'draw' });
    expect((await decide(6, [2, 7])).action).toEqual({ type: 'draw' });
    for (const difficulty of bot.difficulties!) {
      expect(
        (await decide(16, [2, 8], false, false, difficulty)).action,
      ).toEqual({ type: 'draw' });
      expect((await decide(7, [2, 8], false, true, difficulty)).action).toEqual(
        { type: 'invokeRa' },
      );
    }
    expect((await decide(12, [2])).action).toEqual({ type: 'draw' });
    expect((await decide(7, [2, 8], true)).action).toEqual({
      type: 'bid',
      disk: 2,
    });
  });

  it('keeps disaster batch progress private and accepts older pending saves', () => {
    let state = rules.initialize(context(2));
    const caller = state.actor!;
    const winner = state.seats.find((seat) => seat !== caller)!;
    state = arrange(state, ['earthquake-1', 'war-1', 'sphinx-1', 'art-1'], {
      [winner]: ['pyramid-1', 'temple-1', 'writing-1', 'religion-1'],
    });
    state = apply(state, { type: 'invokeRa' });
    state = apply(state, { type: 'bid', disk: state.players[winner]!.up[0]! });
    if (state.phase === 'auction') state = apply(state, { type: 'pass' });
    const view = () => rules.project(state, { role: 'player', seatId: winner });
    expect(view().disasterDecision).toMatchObject({
      step: 1,
      total: 2,
      next: { face: 'war' },
      received: ['earthquake-1', 'war-1', 'sphinx-1', 'art-1'],
    });
    expect(rules.project(state, { role: 'public' })).not.toHaveProperty(
      'disasterDecision',
    );
    expect(
      rules.project(state, { role: 'player', seatId: caller }),
    ).not.toHaveProperty('disasterDecision');
    const legacy = structuredClone(state);
    delete legacy.disaster!.total;
    expect(rules.validateState(legacy, legacy.seats)).toBe(legacy);
    expect(
      rules.project(legacy, { role: 'player', seatId: winner })
        .disasterDecision,
    ).not.toHaveProperty('total');
    state = apply(state, rules.legalActions(state, winner)[0]!);
    expect(view().disasterDecision).toMatchObject({ step: 2, total: 2 });
    expect(view().disasterDecision).not.toHaveProperty('next');
  });

  it('resolves won famine targets before scoring, and scores all categories with third-epoch bonuses', () => {
    const base = rules.initialize(context(2));
    const caller = base.actor!;
    const winner = base.seats.find((seat) => seat !== caller)!;
    let s = arrange(base, ['flood-1', 'drought-1', 'nile-1', 'pharaoh-1'], {
      [winner]: [
        'nile-2',
        'art-1',
        'religion-1',
        'writing-1',
        'pyramid-1',
        'pyramid-2',
        'pyramid-3',
        'gold-1',
        'god-1',
      ],
    });
    s = apply(s, { type: 'invokeRa' });
    s = apply(s, { type: 'bid', disk: s.players[winner]!.up[0]! });
    if (s.phase === 'auction') s = apply(s, { type: 'pass' });
    expect(s.removed).toEqual(
      expect.arrayContaining(['drought-1', 'flood-1', 'nile-1']),
    );
    expect(s.players[winner]!.held).toContain('nile-2');
    for (let epoch = 1; epoch <= 3; epoch++) {
      for (let draw = 1; draw <= 6; draw++) {
        const id = `ra-${(epoch - 1) * 6 + draw}`;
        s.bag = [...s.bag.filter((t) => t !== id), id];
        s = apply(s, { type: 'draw' });
        while (s.phase === 'auction') s = apply(s, { type: 'pass' });
      }
    }
    expect(s.players[winner]!.scores[0]!.parts).toMatchObject({
      pharaoh: 5,
      god: 2,
      gold: 3,
      river: 0,
      civilization: 5,
      monument: 0,
      disks: 0,
    });
    expect(s.players[winner]!.scores[2]!.parts.monument).toBe(6);
    expect(s.players[caller]!.scores[2]!.total).toBe(0);
    expect(s.winner).toBe(winner);
  });

  it('persists and rolls back an auction, disaster and draw through SQLite', async () => {
    const task = resolve(
      'tmp',
      process.env.TABLEMAX_TASK_ID ?? 'ra-play-20261116',
    );
    mkdirSync(task, { recursive: true });
    const path = mkdtempSync(join(task, 'ra-db-'));
    const rigged = {
      ...rules,
      initialize(ctx: Parameters<typeof rules.initialize>[0]) {
        const s = rules.initialize(ctx);
        const winner = s.seats.find((id) => id !== s.actor)!;
        return arrange(
          s,
          ['art-1', 'religion-1', 'writing-1', 'war-1'],
          { [winner]: ['god-1'] },
          ['ra-1'],
        );
      },
    };
    let repository = new SqliteSaveRepository(path);
    let room = new RoomCoordinator(rigged, bot, repository);
    const restart = () => {
      repository.close();
      repository = new SqliteSaveRepository(path);
      room = new RoomCoordinator(rigged, bot, repository);
    };
    const send = (token: string, command: Command['command']) => {
      const { instanceId, revision, branch } = room.view(token);
      return room.command(token, {
        instanceId,
        revision,
        branch,
        actionId: crypto.randomUUID(),
        command,
      });
    };
    const game = () => room.view().gameView as RaView;
    const play = (token: string, action: Action) =>
      send(token, {
        type: 'game',
        decisionId: room.view(token).decisionId!,
        action,
      });
    const undo = async (label: string) => {
      const checkpointId = room
        .view(room.hostToken)
        .history.find((entry) => entry.label === label)!.id;
      await expect(
        send(room.hostToken, { type: 'rollback', checkpointId }),
      ).resolves.toMatchObject({ ok: true });
      await expect(
        send(room.hostToken, { type: 'resume' }),
      ).resolves.toMatchObject({ ok: true });
    };
    try {
      const people = [await room.join('阿明'), await room.join('小红')];
      for (const { token } of people)
        await send(token, { type: 'ready', ready: true });
      expect((await send(room.hostToken, { type: 'start' })).ok).toBe(true);
      const actor = () =>
        people.find((p) => room.view(p.token).decisionId)!.token;
      const drawToken = actor();
      const initialProjection = game();
      expect(initialProjection.players.every((p) => p.private === null)).toBe(
        true,
      );
      expect((await play(drawToken, { type: 'draw' })).ok).toBe(true);
      const auction = game();
      expect(auction.auction?.cause).toBe('drawRa');
      restart();
      expect(game()).toEqual(auction);
      await undo('抽取板块前');
      expect(game()).toEqual(initialProjection);
      expect((await play(drawToken, { type: 'draw' })).ok).toBe(true);
      expect(game()).toEqual(auction);
      const bidder = actor();
      const bid = room
        .view(bidder)
        .actions.find((a) => (a as Action).type === 'bid') as Action;
      expect((await play(bidder, bid)).ok).toBe(true);
      if (game().phase === 'auction')
        expect((await play(actor(), { type: 'pass' })).ok).toBe(true);
      expect(game().phase).toBe('disaster');
      const pending = game();
      restart();
      expect(game()).toEqual(pending);
      await expect(
        send(room.hostToken, { type: 'resume' }),
      ).resolves.toMatchObject({ ok: true });
      const choice = room.view(bidder).actions[0] as Action;
      expect((await play(bidder, choice)).ok).toBe(true);
      expect(game().pending).toBeNull();
      await undo('选择灾难弃牌前');
      expect(game()).toEqual(pending);
      expect((await play(bidder, choice)).ok).toBe(true);
    } finally {
      repository.close();
      rmSync(path, { recursive: true, force: true });
    }
  });
});

describe('Ra strategy styles', () => {
  it('makes the god exchange depend on the authorized river set for Juewu', async () => {
    const s = rules.initialize(context(3));
    const start = arrange(s, ['gold-1', 'flood-1', 'pharaoh-1'], {
      [s.actor!]: ['god-1', 'god-2', 'nile-1', 'nile-2', 'nile-3', 'nile-4'],
    });
    const state = apply(start, {
      type: 'spendGod',
      slot: 2,
      tileId: 'pharaoh-1',
      godId: 'god-1',
    });
    expect(state.phase).toBe('godChain');
    expect(await pickRa(state, 'doubao')).toMatchObject({
      type: 'spendGod',
      tileId: 'gold-1',
    });
    expect(await pickRa(state, 'juewu')).toMatchObject({
      type: 'spendGod',
      tileId: 'flood-1',
    });
  });

  it('considers the end-of-epoch risk before drawing a tile', async () => {
    const s = arrange(rules.initialize(context(3)), ['gold-1', 'gold-2'], {});
    expect(await pickRa(s, 'juewu')).toEqual({ type: 'draw' });
    s.raDrawn = limits[3] - 1;
    expect(await pickRa(s, 'doubao')).toEqual({ type: 'draw' });
    expect(await pickRa(s, 'juewu')).toEqual({ type: 'invokeRa' });
  });

  it('preserves a monument set through an earthquake decision', async () => {
    let s = rules.initialize(context(2));
    const caller = s.actor!;
    const rival = s.seats.find((seat) => seat !== caller)!;
    s = arrange(s, ['earthquake-1'], {
      [caller]: [
        'sphinx-1',
        'sphinx-2',
        'sphinx-3',
        'pyramid-1',
        'pyramid-2',
        'obelisk-1',
        'obelisk-2',
      ],
    });
    s = apply(s, { type: 'invokeRa' });
    if (s.actor === rival) s = apply(s, { type: 'pass' });
    if (s.phase === 'auction')
      s = apply(s, { type: 'bid', disk: s.players[caller]!.up[0]! });
    expect(s.phase).toBe('disaster');
    const chosen = await pickRa(s, 'juewu');
    expect(chosen).toMatchObject({
      type: 'discard',
      tileIds: ['obelisk-1', 'pyramid-1'],
    });
  });

  it('takes the smallest disk that denies the visible leader a valuable flood', async () => {
    const s = leaderAuction();
    expect(s.actor).toBe('a');
    expect(await pickRa(s, 'juewu')).toEqual({ type: 'pass' });
    expect(await pickRa(s, 'mischief')).toEqual({ type: 'bid', disk: 8 });
    const tied = structuredClone(s);
    // Only the score-setting projection can disclose the earlier totals.
    tied.epoch = 2;
    for (const player of Object.values(tied.players)) {
      const bonus = player === tied.players.a ? 15 : 0;
      player.scores.push({
        epoch: 1,
        parts: {
          pharaoh: 0,
          god: 0,
          gold: bonus,
          river: 0,
          civilization: 0,
          monument: 0,
          disks: 0,
        },
        total: 10 + bonus,
        delta: bonus,
      });
    }
    expect(await pickRa(tied, 'mischief')).toEqual({ type: 'bid', disk: 8 });
    tied.publicScoring = true;
    expect(await pickRa(tied, 'mischief')).toEqual({ type: 'pass' });
  });

  it('runs Mischief in the real Worker and resumes its SQLite state', async () => {
    const taskRoot = resolve(
      'tmp',
      process.env.TABLEMAX_TASK_ID ?? 'ra-bot-rise-20261126',
    );
    mkdirSync(taskRoot, { recursive: true });
    const output = mkdtempSync(join(taskRoot, 'ra-worker-'));
    const workerPath = join(output, 'bot-worker.cjs');
    const strategyPath = join(output, 'ra.cjs');
    await Promise.all([
      build({
        entryPoints: ['apps/server/src/bot-worker.ts'],
        outfile: workerPath,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node22',
      }),
      build({
        entryPoints: ['games/ra/bot/index.ts'],
        outfile: strategyPath,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node22',
      }),
    ]);
    const seeded = {
      ...rules,
      initialize(ctx: Parameters<typeof rules.initialize>[0]) {
        const s = rules.initialize(ctx);
        s.raDrawn = limits[3] - 1;
        return arrange(s, ['gold-1', 'gold-2'], {}, ['ra-1']);
      },
    };
    let repository = new SqliteSaveRepository(output);
    let room = new RoomCoordinator(seeded, bot, repository);
    const host = async (command: Command['command']) => {
      const { instanceId, revision, branch } = room.view(room.hostToken);
      const result = await room.command(room.hostToken, {
        actionId: crypto.randomUUID(),
        instanceId,
        revision,
        branch,
        command,
      });
      expect(result.ok).toBe(true);
    };
    try {
      for (const name of ['甲', '乙', '丙'])
        await host({
          type: 'add-bot',
          name: '电脑' + name,
          difficulty: 'mischief',
        });
      await host({ type: 'start' });
      const task = room.botTask()!;
      const worker = new WorkerBotExecutor(workerPath, () => strategyPath);
      expect(room.view().game?.botDifficulties).toContain('mischief');
      expect(
        (task.view as RaView).players.filter(
          ({ private: details }) => details !== null,
        ),
      ).toHaveLength(1);
      const start = performance.now();
      const result = await worker.execute(task, AbortSignal.timeout(2000));
      expect(performance.now() - start).toBeLessThan(2000);
      expect(result.action).toEqual({ type: 'invokeRa' });
      expect(
        (
          await room.submitBot(
            task,
            result.action,
            result.memory,
            result.random,
          )
        ).ok,
      ).toBe(true);
      await host({
        type: 'rollback',
        checkpointId: room.view(room.hostToken).history[0]!.id,
      });
      repository.close();
      repository = new SqliteSaveRepository(output);
      room = new RoomCoordinator(seeded, bot, repository, room.hostToken);
      expect(room.view()).toMatchObject({ restored: true, paused: true });
      expect(Object.values((repository.load() as Save).snapshot!.bots)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ difficulty: 'mischief', version: '1.1.0' }),
        ]),
      );
      await host({ type: 'resume' });
      const repeated = await worker.execute(
        room.botTask()!,
        AbortSignal.timeout(2000),
      );
      expect(repeated).toEqual(result);

      const dense = rules.initialize(context(3));
      const denseActor = dense.actor!;
      arrange(
        dense,
        [
          'war-1',
          'war-2',
          'war-3',
          'war-4',
          'earthquake-1',
          'earthquake-2',
          'funeral-1',
          'drought-1',
        ],
        {
          [denseActor]: tileIds.filter((id) =>
            /^(god|art|religion|writing|agriculture|astronomy|sphinx|pyramid|obelisk|statue|mortuary|shrine|temple|step-pyramid|nile|flood|pharaoh)-[1-3]$/.test(
              id,
            ),
          ),
        },
      );
      const denseTask = {
        ...task,
        decision: rules.decisions(dense)[0]!,
        actions: rules.legalActions(dense, denseActor),
        view: rules.project(dense, { role: 'player', seatId: denseActor }),
      };
      expect(denseTask.actions.length).toBeGreaterThan(20);
      const denseStart = performance.now();
      const denseResult = await worker.execute(
        denseTask,
        AbortSignal.timeout(2000),
      );
      expect(performance.now() - denseStart).toBeLessThan(2000);
      expect(denseTask.actions).toContainEqual(denseResult.action);
    } finally {
      repository.close();
    }
  }, 15000);
});
