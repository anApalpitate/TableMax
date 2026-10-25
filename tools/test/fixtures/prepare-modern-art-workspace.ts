import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepare } from './prepare-modern-art-polish';
import { SqliteSaveRepository } from '../../../apps/server/src/save-repository';
import { RoomCoordinator } from '../../../packages/platform-core/src/room';
import { rules, bot } from '../../../games/modern-art';
import type { RoomView } from '../../../packages/protocol/src';
import type { Action, ModernArtView } from '../../../games/modern-art/ui/view';
import {
  playerNameError,
  playerNameLength,
} from '../../../packages/protocol/src/names';
type FixtureViews = Record<'host' | 'public' | 'player', RoomView>;
const gameView = (view: RoomView) => view.gameView as ModernArtView;

export async function prepareLayout(work: string, fixedNames = false) {
  const fixture = await prepare(work, 5, true, [
    'open',
    'once',
    'sealed',
    'fixed',
    'double',
  ]);
  const snapshots: Record<string, FixtureViews> = {};
  const proof: unknown[] = [];
  for (const entry of fixture.cases) {
    const repository = new SqliteSaveRepository(entry.dataDir);
    try {
      const room = new RoomCoordinator(rules, bot, repository);
      if (fixedNames) {
        const names = [
          '画廊玩家甲乙丙丁',
          'WWWWWWWWWWWWWWWW',
          '朋友WWWWWWWWWWWW',
          '画廊玩家戊己庚辛',
          'GalleryEFGHIJKLM',
        ];
        const seats = room.view(room.hostToken).seats;
        for (const [index, seat] of seats.entries()) {
          const name = names[index]!;
          if (playerNameError(name))
            throw new Error('Invalid fixture nickname');
          const current = room.view(room.hostToken);
          const renamed = await room.command(room.hostToken, {
            actionId: crypto.randomUUID(),
            instanceId: current.instanceId,
            revision: current.revision,
            branch: current.branch,
            command: { type: 'set-seat-name', seatId: seat.id, name },
          });
          if (!renamed.ok)
            throw new Error('Authoritative nickname change failed');
        }
      }
      const before = room.view(room.hostToken);
      if (before.paused && entry.id !== 'paused') {
        const reply = await room.command(room.hostToken, {
          actionId: crypto.randomUUID(),
          instanceId: before.instanceId,
          revision: before.revision,
          branch: before.branch,
          command: { type: 'resume' },
        });
        if (!reply.ok)
          throw new Error(
            'Cannot resume legal fixture: ' + JSON.stringify(reply),
          );
      }
      const player =
        fixture.players.find((p) =>
          room
            .view(p.token)
            .actions.some((a) => (a as Action).type === 'add-double'),
        ) ??
        fixture.players.find((p) => room.view(p.token).decisionId) ??
        fixture.players[0]!;
      const host = room.view(room.hostToken);
      const publicView = room.view();
      const playerView = room.view(player.token);
      const saved = repository.load()!;
      rules.validateState(
        saved.snapshot!.state,
        saved.seats.map((s) => s.id),
      );
      snapshots[entry.id] = { host, public: publicView, player: playerView };
      proof.push({
        id: entry.id,
        count: 5,
        phase: entry.phase,
        legalPreparationSteps: entry.steps,
        administrativeNicknameCommands: fixedNames ? host.seats.length : 0,
        revision: host.revision,
        actor: player.id,
        paused: host.paused,
        publicHasPrivateSelf: Boolean(gameView(publicView)?.self),
        hostHasPrivateSelf: Boolean(gameView(host)?.self),
        playerActionCount: playerView.actions.length,
        nicknameInputs: host.seats.map(({ name }) => ({
          name,
          length: playerNameLength(name),
          error: playerNameError(name),
        })),
      });
      if (fixedNames && entry.id === 'auction-once') {
        const active = room.view(player.token);
        const action = (active.actions as Action[]).find(
          (candidate) => candidate.type === 'bid',
        );
        if (!action) throw new Error('Once auction has no legal opening bid');
        const reply = await room.command(player.token, {
          actionId: crypto.randomUUID(),
          instanceId: active.instanceId,
          revision: active.revision,
          branch: active.branch,
          command: { type: 'game', decisionId: active.decisionId!, action },
        });
        if (!reply.ok) throw new Error('Legal once-auction bid failed');
        const leadingHost = room.view(room.hostToken);
        const leadingGame = gameView(leadingHost);
        if (
          leadingGame.phase !== 'auction' ||
          leadingGame.auction?.kind !== 'once' ||
          !leadingGame.auction.highBidder ||
          leadingGame.auction.currentBid <= 0
        )
          throw new Error(
            'Expected an unfinished once auction with a high bidder',
          );
        const next = fixture.players.find((candidate) =>
          room
            .view(candidate.token)
            .actions.some((item) => (item as Action).type === 'bid'),
        );
        if (!next || next.id === player.id)
          throw new Error('Expected a distinct next once-auction decision');
        const leadingSaved = repository.load()!;
        rules.validateState(
          leadingSaved.snapshot!.state,
          leadingSaved.seats.map((seat) => seat.id),
        );
        snapshots['auction-once-leading'] = {
          host: leadingHost,
          public: room.view(),
          player: room.view(next.token),
        };
        proof.push({
          id: 'auction-once-leading',
          count: 5,
          phase: leadingGame.phase,
          legalPreparationSteps: entry.steps + 1,
          administrativeNicknameCommands: leadingHost.seats.length,
          submittedLegalAction: action,
          bidder: player.id,
          actor: next.id,
          revisionBefore: active.revision,
          revision: leadingHost.revision,
          currentBid: leadingGame.auction.currentBid,
          highBidder: leadingGame.auction.highBidder,
          actingSeats: leadingGame.auction.actingSeats,
          publicHasPrivateSelf: Boolean(gameView(room.view()).self),
          hostHasPrivateSelf: Boolean(leadingGame.self),
          playerActionCount: room.view(next.token).actions.length,
        });
      }
      if (entry.id === 'auction-double') {
        const actor = fixture.players.find((p) =>
          room
            .view(p.token)
            .actions.some((a) => (a as Action).type === 'add-double'),
        )!;
        const active = room.view(actor.token);
        const action = active.actions.find(
          (a) => (a as Action).type === 'add-double',
        )!;
        const reply = await room.command(actor.token, {
          actionId: crypto.randomUUID(),
          instanceId: active.instanceId,
          revision: active.revision,
          branch: active.branch,
          command: { type: 'game', decisionId: active.decisionId!, action },
        });
        if (!reply.ok) throw new Error('Legal pair preparation failed');
        const hostPair = room.view(room.hostToken);
        if (gameView(hostPair).auction?.cards.length !== 2)
          throw new Error('Expected a legal two-painting auction');
        snapshots['auction-pair'] = {
          host: hostPair,
          public: room.view(),
          player: room.view(actor.token),
        };
        proof.push({
          id: 'auction-pair',
          count: 5,
          phase: gameView(hostPair).phase,
          legalPreparationSteps: entry.steps + 1,
          revision: hostPair.revision,
          publicHasPrivateSelf: Boolean(gameView(room.view()).self),
          hostHasPrivateSelf: Boolean(gameView(hostPair).self),
          playerActionCount: room.view(actor.token).actions.length,
        });
      }
    } finally {
      repository.close();
    }
  }
  await mkdir(work, { recursive: true });
  await writeFile(join(work, 'snapshots.json'), JSON.stringify(snapshots));
  await writeFile(
    join(work, 'preparation-proof.json'),
    JSON.stringify(
      {
        method: fixedNames
          ? 'Existing prepare-modern-art-polish; authoritative RoomCoordinator legal game commands and set-seat-name commands for valid Chinese, ASCII and mixed boundary names; production state validation; no state fabrication.'
          : 'Existing prepare-modern-art-polish; authoritative RoomCoordinator legal commands and production state validation; no state fabrication.',
        steps: fixture.steps,
        cases: proof,
      },
      null,
      2,
    ),
  );
  return { snapshots, proof };
}

export async function augmentSubmitted(work: string) {
  const snapshots = JSON.parse(
    await readFile(join(work, 'snapshots.json'), 'utf8'),
  ) as Record<string, FixtureViews>;
  if (snapshots['sealed-submitted']) return snapshots;
  const repository = new SqliteSaveRepository(join(work, '5-auction-sealed'));
  try {
    const saved = repository.load()!;
    const before = saved.snapshot!.state;
    const actor = snapshots['auction-sealed']!.player.self.seatId!;
    const action = rules.legalActions(before, actor).find((a) => {
      const candidate = a as Action;
      return candidate.type === 'sealed-bid' && candidate.amount === 0;
    })!;
    if (!action) throw new Error('No legal zero sealed bid');
    const context = {
      seats: saved.seats.map((s) => s.id),
      random: { next: () => 0.5 },
    };
    const after = rules.apply(before, action, actor, context).state;
    rules.validateState(after, context.seats);
    const views = {} as FixtureViews;
    for (const role of ['player', 'host', 'public'] as const) {
      const view = structuredClone(snapshots['auction-sealed']![role]);
      view.gameView = rules.project(
        after,
        role === 'player'
          ? { role: 'player', seatId: actor }
          : { role: 'public' },
      );
      view.revision++;
      view.actions = role === 'player' ? rules.legalActions(after, actor) : [];
      view.decisionId =
        role === 'player'
          ? (rules.decisions(after).find((d) => d.seatId === actor)?.id ?? null)
          : null;
      views[role] = view;
    }
    snapshots['sealed-submitted'] = views;
    await writeFile(join(work, 'snapshots.json'), JSON.stringify(snapshots));
    const proof = JSON.parse(
      await readFile(join(work, 'preparation-proof.json'), 'utf8'),
    );
    proof.cases.push({
      id: 'sealed-submitted',
      count: 5,
      phase: 'auction',
      preparation:
        'Production rules legalActions -> apply sealed-bid 0 -> validateState -> role project from actual legally prepared auction; no transport/persistence claim.',
      actor,
      publicHasPrivateSelf: Boolean(gameView(views.public).self),
      hostHasPrivateSelf: Boolean(gameView(views.host).self),
      playerActionCount: views.player.actions.length,
    });
    await writeFile(
      join(work, 'preparation-proof.json'),
      JSON.stringify(proof, null, 2),
    );
    return snapshots;
  } finally {
    repository.close();
  }
}
