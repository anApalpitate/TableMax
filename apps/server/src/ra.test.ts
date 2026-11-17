import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Command } from '@tablemax/protocol';
import { RoomCoordinator } from '@tablemax/platform-core';
import { bot, rules } from '../../../games/ra';
import { limits, tileIds } from '../../../games/ra/rules/data';
import type { Action, RaView } from '../../../games/ra/rules';
import type { State } from '../../../games/ra/rules/state';
import { SqliteSaveRepository } from './save-repository';

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
      const difficulties = ['default', 'doubao', 'juewu'] as const;
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

  it('draws from an empty lot unless the default bot can make a clear disk upgrade', async () => {
    const ctx = context(3);
    const state = rules.initialize(ctx);
    const decision = rules.decisions(state)[0]!;
    const view = rules.project(state, {
      role: 'player',
      seatId: decision.seatId,
    });
    const own = view.players.find(({ seat }) => seat === decision.seatId)!;
    const decide = async (center: number, disks: number[], auction = false) =>
      bot.decide({
        view: {
          ...view,
          center,
          auction: auction
            ? { caller: own.seat, cause: 'invokeOpen', bids: [] }
            : null,
          players: view.players.map((player) =>
            player === own ? { ...own, disks } : player,
          ),
        },
        decision,
        actions: auction
          ? disks.map((disk) => ({ type: 'bid', disk }))
          : [{ type: 'draw' }, { type: 'invokeRa' }],
        memory: null,
        random: { next: () => 0.99 },
        difficulty: 'default',
        signal: new AbortController().signal,
      });
    expect((await decide(1, [2, 7])).action).toEqual({ type: 'draw' });
    expect((await decide(6, [2, 7])).action).toEqual({ type: 'draw' });
    expect((await decide(7, [2, 8])).action).toEqual({ type: 'invokeRa' });
    expect((await decide(12, [2])).action).toEqual({ type: 'draw' });
    expect((await decide(7, [2, 8], true)).action).toEqual({
      type: 'bid',
      disk: 2,
    });
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
