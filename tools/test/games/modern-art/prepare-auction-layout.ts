import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RoomCoordinator } from '../../../../packages/platform-core/src/room';
import { RandomSource } from '../../../../packages/platform-core/src/random';
import type {
  Save,
  SaveRepository,
} from '../../../../packages/platform-core/src/model';
import type { Command } from '../../../../packages/protocol/src';
import { bot, rules } from '../../../../games/modern-art';
import type {
  Action,
  ModernArtView,
} from '../../../../games/modern-art/ui/view';

class MemoryRepository implements SaveRepository {
  private value: Save | null = null;
  load() {
    return this.value;
  }
  save(value: Save) {
    this.value = structuredClone(value);
  }
  close() {}
}

export async function prepareAuctionLayout(work: string) {
  const snapshots: Record<string, unknown> = {};
  const proof: unknown[] = [];
  for (const count of [3, 4])
    for (const kind of ['single', 'pair', 'fixed-single']) {
      let prepared = false;
      for (let seed = 1; seed <= 20 && !prepared; seed++) {
        const repository = new MemoryRepository();
        const fixtureRules = {
          ...rules,
          initialize(context: Parameters<typeof rules.initialize>[0]) {
            return rules.initialize({
              ...context,
              random: new RandomSource(seed),
            });
          },
        };
        const room = new RoomCoordinator(fixtureRules, bot, repository);
        const players: { token: string }[] = [];
        let steps = 0;
        const command = async (token: string, value: Command) => {
          const view = room.view(token);
          const reply = await room.command(token, {
            actionId: crypto.randomUUID(),
            instanceId: view.instanceId,
            branch: view.branch,
            revision: view.revision,
            command: value,
          });
          if (!reply.ok) throw new Error(reply.reason);
          steps++;
        };
        const gameAction = async (
          player: { token: string },
          action: Action,
        ) => {
          const view = room.view(player.token);
          await command(player.token, {
            type: 'game',
            decisionId: view.decisionId!,
            action,
          });
        };
        try {
          for (let index = 0; index < count; index++) {
            const names = [
              '桌游伙伴名字八字',
              'SixteenLetterABC',
              '现代艺术拍卖伙伴',
              'abcdefghijklmnop',
            ];
            const player = await room.join(
              names[index]!,
              undefined,
              `avatar-${20 + index}`,
            );
            players.push(player);
            await command(player.token, { type: 'ready', ready: true });
          }
          await command(room.hostToken, { type: 'start' });
          const first = players.find(
            (player) => room.view(player.token).decisionId,
          )!;
          const firstView = room.view(first.token);
          const game = firstView.gameView as ModernArtView;
          const offered = (firstView.actions as Action[]).find((action) => {
            if (action.type !== 'offer') return false;
            const card = game.self!.hand.find(
              (entry) => entry.id === action.cardId,
            )!;
            return kind === 'pair'
              ? card.auctionKind === 'double'
              : kind === 'fixed-single'
                ? card.auctionKind === 'fixed'
                : card.auctionKind !== 'double';
          });
          if (!offered) continue;
          await gameAction(first, offered);
          if (kind === 'pair') {
            for (let turn = 0; turn < count; turn++) {
              const actor = players.find(
                (player) => room.view(player.token).decisionId,
              );
              if (!actor) break;
              const actions = room.view(actor.token).actions as Action[];
              const add = actions.find(
                (action) => action.type === 'add-double',
              );
              if (add) {
                await gameAction(actor, add);
                break;
              }
              const decline = actions.find(
                (action) => action.type === 'decline-double',
              );
              if (!decline) break;
              await gameAction(actor, decline);
            }
          }
          const priceActor = players.find((player) =>
            (room.view(player.token).actions as Action[]).some(
              (action) => action.type === 'set-price' && action.amount === 30,
            ),
          );
          if (priceActor)
            await gameAction(priceActor, { type: 'set-price', amount: 30 });
          const host = room.view(room.hostToken);
          const publicView = room.view();
          const state = repository.load()!;
          rules.validateState(
            state.snapshot!.state,
            state.seats.map((seat) => seat.id),
          );
          const finalGame = host.gameView as ModernArtView;
          if (
            finalGame.phase !== 'auction' ||
            finalGame.auction?.cards.length !== (kind === 'pair' ? 2 : 1)
          )
            continue;
          if (finalGame.self || (publicView.gameView as ModernArtView).self)
            throw new Error('Private self leaked into host/public');
          const id = `${count}-${kind}`;
          snapshots[id] = { host, public: publicView };
          proof.push({
            id,
            count,
            seed,
            steps,
            names: host.seats.map((seat) => seat.name),
            cardIds: finalGame.auction.cards.map((card) => card.id),
            auctionKind: finalGame.auction.kind,
            fixedPrice: finalGame.auction.fixedPrice,
            stateValidated: true,
            emptyCollections: Object.values(finalGame.players).every(
              (player) => !player.collection.length,
            ),
            publicHasSelf: false,
            hostHasSelf: false,
          });
          if (kind === 'pair') {
            await command(room.hostToken, { type: 'pause' });
            const pausedHost = room.view(room.hostToken);
            const pausedPublic = room.view();
            const pausedSave = repository.load()!;
            rules.validateState(
              pausedSave.snapshot!.state,
              pausedSave.seats.map((seat) => seat.id),
            );
            snapshots[`${id}-paused`] = {
              host: pausedHost,
              public: pausedPublic,
            };
            proof.push({
              id: `${id}-paused`,
              count,
              seed,
              steps,
              names: pausedHost.seats.map((seat) => seat.name),
              phase: (pausedHost.gameView as ModernArtView).phase,
              paused: pausedHost.paused,
              stateValidated: true,
              publicHasSelf: false,
              hostHasSelf: false,
            });
          }
          prepared = true;
        } finally {
          repository.close();
        }
      }
      if (!prepared) throw new Error(`Cannot legally prepare ${count}-${kind}`);
    }
  await mkdir(work, { recursive: true });
  await writeFile(join(work, 'snapshots.json'), JSON.stringify(snapshots));
  await writeFile(
    join(work, 'preparation-proof.json'),
    JSON.stringify(
      {
        method:
          'Separate real RoomCoordinator rooms with seeded official initialization and only legal join/ready/start/offer/add-double/decline-double/set-price/pause commands; complete final state validation. No dealt-card mutation, seat splicing, or projected-state fabrication.',
        proof,
      },
      null,
      2,
    ),
  );
  return snapshots;
}

export async function prepareGalleryLayout(work: string) {
  const snapshots: Record<
    string,
    { host: ReturnType<RoomCoordinator['view']> }
  > = {};
  const proof: unknown[] = [];
  for (const count of [3, 4, 5]) {
    const maximum = count === 3 ? 7 : 5;
    const wanted = Array.from({ length: maximum - 1 }, (_, index) => index + 2);
    for (let seed = 1; seed <= 20; seed++) {
      const repository = new MemoryRepository();
      const room = new RoomCoordinator(
        {
          ...rules,
          initialize(context) {
            return rules.initialize({
              ...context,
              random: new RandomSource(seed),
            });
          },
        },
        bot,
        repository,
      );
      const trial = new Map<number, ReturnType<RoomCoordinator['view']>>();
      const send = async (token: string, command: Command) => {
        const { instanceId, branch, revision } = room.view(token);
        const reply = await room.command(token, {
          actionId: crypto.randomUUID(),
          instanceId,
          branch,
          revision,
          command,
        });
        if (!reply.ok) throw new Error(reply.reason);
      };
      try {
        const players = [];
        for (let index = 0; index < count; index++) {
          const player = await room.join(
            index === 0 ? '现代艺术玩家甲乙' : `展馆 ${index + 1}`,
          );
          players.push(player);
          await send(player.token, { type: 'ready', ready: true });
        }
        await send(room.hostToken, { type: 'start' });
        for (let step = 0; step < 260; step++) {
          const host = room.view(room.hostToken);
          const game = host.gameView as ModernArtView;
          if (game.phase === 'round-result' || game.phase === 'ended') break;
          const target = game.seatOrder[0]!;
          const owned = game.players[target]!.collection.length;
          if (
            game.phase === 'offer' &&
            wanted.includes(owned) &&
            !trial.has(owned)
          ) {
            const state = repository.load()!;
            rules.validateState(
              state.snapshot!.state,
              state.seats.map(({ id }) => id),
            );
            trial.set(owned, host);
            if (trial.size === wanted.length) break;
          }
          const player = players.find(
            ({ token }) => room.view(token).decisionId,
          );
          if (!player)
            throw new Error('Expected a legal gallery fixture action');
          const turn = room.view(player.token);
          const own = turn.gameView as ModernArtView;
          const actions = turn.actions as Action[];
          const empty = game.seatOrder.every(
            (seat) => game.players[seat]!.collection.length === 0,
          );
          const priorityBuyer = empty ? game.seatOrder[1] : target;
          const isTarget = own.self?.seatId === priorityBuyer;
          const action =
            game.phase === 'offer'
              ? actions
                  .filter((a) => a.type === 'offer')
                  .sort((a, b) => {
                    const priority = (id: string) => {
                      const card = own.self!.hand.find(
                        (entry) => entry.id === id,
                      )!;
                      return (
                        game.artists.find(({ id }) => id === card.artistId)!
                          .playedCount +
                        (card.auctionKind === 'double' ? 10 : 0)
                      );
                    };
                    return priority(a.cardId) - priority(b.cardId);
                  })[0]
              : (actions.find(
                  (a) =>
                    a.type === 'decline-double' ||
                    (a.type === 'set-price' && a.amount === 1) ||
                    (a.type === 'sealed-bid' &&
                      a.amount === Number(isTarget)) ||
                    (isTarget &&
                      (a.type === 'buy' ||
                        (a.type === 'bid' &&
                          game.auction?.highBidder !== priorityBuyer &&
                          a.amount === 1))),
                ) ??
                actions.find((a) => a.type === 'pass') ??
                actions[0]);
          if (!action) throw new Error('Missing gallery fixture action');
          await send(player.token, {
            type: 'game',
            decisionId: turn.decisionId!,
            action,
          });
        }
        if (trial.size !== wanted.length) continue;
        for (const [owned, host] of trial) {
          const id = `${count}-gallery-${owned}`;
          snapshots[id] = { host };
          proof.push({
            id,
            seed,
            revision: host.revision,
            stateValidated: true,
          });
        }
        break;
      } finally {
        repository.close();
      }
    }
    if (!wanted.every((owned) => snapshots[`${count}-gallery-${owned}`]))
      throw new Error(
        `Cannot legally prepare gallery counts for ${count} seats`,
      );
  }
  await mkdir(work, { recursive: true });
  await writeFile(join(work, 'snapshots.json'), JSON.stringify(snapshots));
  await writeFile(
    join(work, 'preparation-proof.json'),
    JSON.stringify(
      {
        method:
          'Saved RoomCoordinator states reached through legal commands in the same seeded game per player count.',
        proof,
      },
      null,
      2,
    ),
  );
  return snapshots;
}
