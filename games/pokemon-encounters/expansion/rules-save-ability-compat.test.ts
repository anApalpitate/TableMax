import { describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { JsonValue } from '@tablemax/game-sdk';
import type { Command } from '../../../packages/protocol/src/index';
import {
  RoomCoordinator,
  type Save,
  type SaveRepository,
} from '../../../packages/platform-core/src/index';
import { SqliteSaveRepository } from '../../../apps/server/src/save-repository';
import { pokemonExpansion as rules } from './index';
import { bot } from './bot';
import type { State } from './state';

class MemoryRepository implements SaveRepository {
  value: Save | null = null;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    this.value = structuredClone(value);
  }
}
function room(repository: SaveRepository) {
  return new RoomCoordinator(
    rules,
    bot,
    repository,
    undefined,
    undefined,
    undefined,
    undefined,
    'expansion',
  );
}
async function command(
  coordinator: RoomCoordinator,
  token: string,
  value: Command['command'],
) {
  const view = coordinator.view(token);
  const result = await coordinator.command(token, {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: value,
  });
  expect(result.ok).toBe(true);
}
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const oldState = (state: JsonValue) => {
  const s = state as State;
  delete s.usedAbilityIds;
  delete s.pendingAbility;
  for (const event of s.events) delete event.effect;
};

describe('real SQLite ability compatibility and branch rollback', () => {
  it.each(['legacy', 'current'] as const)(
    '%s in-flight optional ability restores, saves, restarts and rolls back without rewriting checkpoints',
    async (mode) => {
      const memory = new MemoryRepository(),
        original = room(memory),
        credentials = new Map<string, string>();
      for (let i = 0; i < 2; i++) {
        const player = await original.join(`玩家${i + 1}`);
        credentials.set(original.view(player.token).self.seatId!, player.token);
        await command(original, player.token, { type: 'ready', ready: true });
      }
      await command(original, original.hostToken, { type: 'start' });
      const saved = memory.load()!;
      const seats = saved.seats.map((seat) => seat.id),
        context = { seats, random: { next: () => 0.1 } };
      let s = saved.snapshot!.state as State;
      for (const seat of seats)
        s = rules.apply(
          s,
          { type: 'vote-research', taskId: s.researchCandidates[0]! },
          seat,
          context,
        ).state as State;
      for (const seat of seats)
        s = rules.apply(s, { type: 'initial-flip', slot: 0 }, seat, context)
          .state as State;
      const source = 'special-snorlax#01',
        top = s.deck.at(-1)!,
        index = s.deck.indexOf(source);
      if (index >= 0)
        [s.deck[index], s.deck[s.deck.length - 1]] = [top, source];
      else {
        const slot = Object.values(s.boards)
          .flat()
          .find((c) => c.instanceId === source);
        if (slot) slot.instanceId = top;
        else s.discard[s.discard.indexOf(source)] = top;
        s.deck[s.deck.length - 1] = source;
      }
      s = rules.apply(s, { type: 'draw', source: 'deck' }, s.turnSeat, context)
        .state as State;
      const beforePlace = structuredClone(saved.snapshot!);
      beforePlace.state = structuredClone(s) as JsonValue;
      s = rules.apply(s, { type: 'replace', slot: 1 }, s.turnSeat, context)
        .state as State;
      saved.snapshot!.state = s as JsonValue;
      saved.history.push({
        id: randomUUID(),
        label: 'place之前',
        revealedInformation: true,
        before: beforePlace,
        seatId: s.turnSeat,
        roundNumber: s.roundNumber,
      });
      saved.gameWindow = null;
      delete saved.decisionClocks;
      if (mode === 'legacy') {
        oldState(saved.snapshot!.state);
        for (const checkpoint of saved.history)
          oldState(checkpoint.before.state);
      }
      const checkpointBodies = saved.history.map((checkpoint) =>
        JSON.stringify(checkpoint),
      );
      expect(checkpointBodies.length).toBeGreaterThan(0);
      const evidence = join(
        process.cwd(),
        'artifacts/maintenance/v1.0.3/pokemon-final-revision/rules',
      );
      mkdirSync(evidence, { recursive: true });
      const directory = mkdtempSync(join(evidence, `storage-${mode}-`)),
        file = join(directory, 'room.sqlite');
      const v1 = new DatabaseSync(file);
      v1.exec(
        'CREATE TABLE saves(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL) STRICT; CREATE TABLE journal(instance TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(instance,revision)) STRICT; CREATE TABLE avatar_images(id TEXT PRIMARY KEY,png BLOB NOT NULL) STRICT; PRAGMA user_version=1;',
      );
      v1.prepare('INSERT INTO saves VALUES(1,?)').run(JSON.stringify(saved));
      v1.prepare('INSERT INTO journal VALUES(?,?,?)').run(
        saved.instanceId,
        saved.revision,
        JSON.stringify(saved),
      );
      v1.close();
      const oldBytes = readFileSync(file),
        repository = new SqliteSaveRepository(directory);
      let restored = room(repository);
      expect(restored.restored).toBe(true);
      let loaded = repository.load() as Save;
      expect(
        loaded.history.map((checkpoint) => JSON.stringify(checkpoint)),
      ).toEqual(checkpointBodies);
      expect(JSON.stringify(loaded.snapshot!.state)).toBe(
        JSON.stringify(saved.snapshot!.state),
      );
      for (const [seat, token] of credentials)
        expect(restored.view(token).self.seatId).toBe(seat);
      await command(restored, restored.hostToken, { type: 'resume' });
      const actor = (loaded.snapshot!.state as State).turnSeat,
        playerToken = credentials.get(actor)!;
      await command(restored, playerToken, {
        type: 'game',
        decisionId: restored.view(playerToken).decisionId!,
        action: { type: 'swap', a: 1, b: 2 },
      });
      loaded = repository.load() as Save;
      expect((loaded.snapshot!.state as State).usedAbilityIds).toEqual(
        mode === 'legacy' ? [] : [source],
      );
      expect(
        loaded.history
          .slice(0, checkpointBodies.length)
          .map((checkpoint) => JSON.stringify(checkpoint)),
      ).toEqual(checkpointBodies);
      const preUse = loaded.history.at(-1)!;
      repository.close();
      const restartedRepository = new SqliteSaveRepository(directory);
      restored = room(restartedRepository);
      const restarted = restartedRepository.load() as Save;
      expect(restarted.snapshot).toEqual(loaded.snapshot);
      await command(restored, restored.hostToken, {
        type: 'rollback',
        checkpointId: preUse.id,
      });
      const rollback = restartedRepository.load() as Save;
      expect(rollback.branch).toBeGreaterThan(restarted.branch);
      const rollbackState = rollback.snapshot!.state as State;
      expect(rollbackState.usedAbilityIds ?? []).toEqual([]);
      expect(rollbackState.phase).toBe('snorlax-choice');
      if (mode === 'legacy')
        expect(Object.hasOwn(rollbackState, 'pendingAbility')).toBe(false);
      else expect(rollbackState.pendingAbility?.sourceInstanceId).toBe(source);
      await command(restored, restored.hostToken, { type: 'resume' });
      await command(restored, playerToken, {
        type: 'game',
        decisionId: restored.view(playerToken).decisionId!,
        action: { type: 'swap', a: 1, b: 2 },
      });
      const branched = restartedRepository.load() as Save;
      expect((branched.snapshot!.state as State).usedAbilityIds).toEqual(
        mode === 'legacy' ? [] : [source],
      );
      restartedRepository.close();
      const audit = new DatabaseSync(file, { readOnly: true });
      expect(audit.prepare('PRAGMA user_version').get()?.user_version).toBe(2);
      const nodes = audit
        .prepare('SELECT checkpoint_id,data FROM checkpoint_nodes')
        .all();
      for (const checkpoint of saved.history)
        expect(
          nodes
            .filter((node) => node.checkpoint_id === checkpoint.id)
            .map((node) => node.data),
        ).toEqual([JSON.stringify(checkpoint)]);
      audit.close();
      const backup = readdirSync(directory).find((entry) =>
        entry.startsWith('room-v1-backup-'),
      )!;
      expect(readFileSync(join(directory, backup, 'room.sqlite'))).toEqual(
        oldBytes,
      );
      writeFileSync(
        join(evidence, `storage-${mode}.json`),
        JSON.stringify(
          {
            result: 'passed',
            scope:
              'Real SQLite v1/v2, RoomCoordinator, human credentials, saved activation, restart and branch rollback; no network listener.',
            directory,
            originalSha256: hash(oldBytes),
            protectedCheckpointSha256: checkpointBodies.map(hash),
            checkpointNodes: nodes.length,
            finalRevision: branched.revision,
            finalBranch: branched.branch,
            policy:
              mode === 'legacy'
                ? 'Existing chain continues without inferred past instance use.'
                : 'Current instance use persists and rewinds with its decision checkpoint.',
          },
          null,
          2,
        ),
      );
    },
  );
});
