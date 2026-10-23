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
