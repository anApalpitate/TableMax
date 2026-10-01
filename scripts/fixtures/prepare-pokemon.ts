import { RoomCoordinator } from '../../packages/platform-core/src/room';
import { SqliteSaveRepository } from '../../apps/server/src/save-repository';
import { rules, bot } from '../../games/pokemon-encounters';
import type { State } from '../../games/pokemon-encounters/rules/state';
import fixtures from '../../docs/games/pokemon-encounters/scenarios.json';

// Verification-only saved scenarios, consumed by the unmodified production rules.
// No scene selector or full-state endpoint is included in the shipped service.
export async function prepare(id: string, dataDir: string, seed?: number) {
  const f = fixtures.scenarios.find((entry) => entry.id === id)!.fixture!;
  const original = Object.keys(f.boards);
  const game = {
    ...rules,
    initialize({ seats }: { seats: readonly string[] }) {
      const map = (seat: string) => seats[original.indexOf(seat)]!;
      const base = rules.initialize({
        seats,
        random: { next: () => 0.5 },
      }) as State;
      return {
        ...base,
        boards: Object.fromEntries(
          original.map((seat) => [
            map(seat),
            structuredClone(f.boards[seat as keyof typeof f.boards]!),
          ]),
        ),
        turnSeat: map(f.turnSeat),
        deck: [...f.deckBottomToTop],
        discard: [...f.discardBottomToTop],
        held: f.held,
        phase:
          f.phase === 'initial' ? 'initial-flip' : (f.phase as State['phase']),
        initialDone: f.phase === 'initial' ? [] : [...seats],
      };
    },
  };
  const repository = new SqliteSaveRepository(dataDir),
    room = new RoomCoordinator(game, bot, repository);
  const players = [];
  const command = (
    token: string,
    command: Parameters<RoomCoordinator['command']>[1],
  ) => {
    const view = room.view(token);
    return room.command(token, {
      actionId: crypto.randomUUID(),
      instanceId: view.instanceId,
      branch: view.branch,
      revision: view.revision,
      command,
    });
  };
  for (let i = 0; i < original.length; i++) {
    const player = await room.join(`场景玩家 ${i + 1}`);
    players.push(player);
    const result = await command(player.token, { type: 'ready', ready: true });
    if (!result.ok) throw new Error(result.reason);
  }
  const result = await command(room.hostToken, { type: 'start' });
  if (!result.ok) throw new Error(result.reason);
  if (seed !== undefined) {
    const saved =
      repository.load() as import('../../packages/platform-core/src/model').Save;
    saved.snapshot!.random = seed;
    saved.revision++;
    repository.save(saved);
  }
  repository.close();
  return players;
}
