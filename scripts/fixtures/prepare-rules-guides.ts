import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { RoomCoordinator } from '../../packages/platform-core/src/room';
import { SqliteSaveRepository } from '../../apps/server/src/save-repository';
import type { Command } from '../../packages/protocol/src';
import type { Save } from '../../packages/platform-core/src/model';
import { rules, bot } from '../../games/power-grid';
export {
  prepare,
  preparePokemonCompatibility as preparePokemonSixDraw,
} from './prepare-modern-art-polish';

export async function prepareGrid(work: string) {
  const dataDir = join(work, 'rules-grid');
  await mkdir(dataDir, { recursive: true });
  const repository = new SqliteSaveRepository(dataDir);
  const room = new RoomCoordinator(rules, bot, repository);
  const players = [];
  const act = async (credential: string, command: Command) => {
    const view = room.view(credential);
    const reply = await room.command(credential, {
      actionId: randomUUID(),
      instanceId: view.instanceId,
      branch: view.branch,
      revision: view.revision,
      command,
    });
    if (!reply.ok) throw new Error(reply.reason);
  };
  try {
    for (let i = 0; i < 6; i++) {
      const joined = await room.join(`示例公司 ${i + 1}`);
      const player = { ...joined, id: room.view(joined.token).self.seatId! };
      players.push(player);
      await act(player.token, { type: 'ready', ready: true });
    }
    await act(room.hostToken, { type: 'start' });
    await act(room.hostToken, { type: 'resume' });
    for (let step = 0; step < 10; step++) {
      const saved = repository.load() as Save;
      const state = saved.snapshot!.state;
      const decision = rules.decisions(state)[0];
      const publicView = rules.project(state, { role: 'public' });
      if (publicView.phase !== 'regions') break;
      if (!decision) throw new Error('Region selection requires a decision');
      const player = players.find((entry) => entry.id === decision.seatId)!;
      const own = room.view(player.token);
      const result = await bot.decide({
        view: own.gameView!,
        actions: own.actions,
        decision,
        memory: null,
        difficulty: 'juewu',
        random: { next: () => 0.43 },
        signal: new AbortController().signal,
      });
      await act(player.token, {
        type: 'game',
        decisionId: own.decisionId!,
        action: result.action,
      });
    }
    const saved = repository.load() as Save;
    rules.validateState(
      saved.snapshot!.state,
      players.map((p) => p.id),
    );
    if (
      rules.project(saved.snapshot!.state, { role: 'public' }).phase ===
      'regions'
    )
      throw new Error('Legal bounded region preparation did not advance');
    return { dataDir, players };
  } finally {
    repository.close();
  }
}
