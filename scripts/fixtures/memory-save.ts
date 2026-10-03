import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { RoomCoordinator } from '../../packages/platform-core/src/room';
import type {
  Save,
  SaveRepository,
} from '../../packages/platform-core/src/model';
import { validateSave } from '../../packages/platform-core/src/save-validation';
import { rules, bot } from '../../games/pokemon-encounters';

class MemoryRepository implements SaveRepository {
  value: Save | null = null;
  load() {
    return this.value;
  }
  save(value: Save) {
    this.value = value;
  }
}

async function main() {
  const repository = new MemoryRepository();
  const room = new RoomCoordinator(rules, bot, repository);
  const players: string[] = [];
  const command = async (credential: string, action: unknown) => {
    const view = room.view(credential);
    const result = await room.command(credential, {
      actionId: randomUUID(),
      instanceId: view.instanceId,
      revision: view.revision,
      branch: view.branch,
      command: action,
    });
    if (!result.ok) throw new Error(result.reason);
  };
  for (let index = 0; index < 6; index++) {
    const player = await room.join(`Memory player ${index + 1}`);
    players.push(player.token);
    await command(player.token, { type: 'ready', ready: true });
  }
  await command(room.hostToken, { type: 'start' });
  for (const player of players) {
    const view = room.view(player);
    await command(player, {
      type: 'game',
      decisionId: view.decisionId,
      action: view.actions[0],
    });
  }
  const value = structuredClone(repository.value!);
  const original = value.history;
  if (original.length !== 6)
    throw new Error('Six initial checkpoints required');
  const checkpointCount = 1200;
  value.history = Array.from({ length: checkpointCount }, (_, index) => ({
    ...structuredClone(original[index % original.length]!),
    id: randomUUID(),
    label: `Scaled memory fixture ${index + 1}`,
  }));
  value.receipts = Object.fromEntries(
    Array.from({ length: checkpointCount }, (_, index) => [
      index.toString(16).padStart(64, '0'),
      {
        fingerprint: (index + 1).toString(16).padStart(64, '0'),
        reply: { ok: true as const, revision: index + 1, branch: 0 },
      },
    ]),
  );
  value.revision = checkpointCount + 20;
  validateSave(value, rules, bot);
  await writeFile(process.argv[2]!, JSON.stringify(value));
  console.log(
    JSON.stringify({
      seats: 6,
      checkpoints: checkpointCount,
      receipts: checkpointCount,
      scope:
        'Synthetic long-history scale fixture: 1,200 independent copies of six valid live six-seat initial-turn checkpoints, validated by the production save validator. This does not represent a played 1,200-action match.',
    }),
  );
}

void main();
