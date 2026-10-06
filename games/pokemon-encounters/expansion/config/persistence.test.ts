import { describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  RoomCoordinator,
  type Save,
  type SaveRepository,
} from '../../../../packages/platform-core/src';
import type { Command } from '../../../../packages/protocol/src';
import { SqliteSaveRepository } from '../../../../apps/server/src/save-repository';
import { pokemonExpansion as rules } from '../index';
import { bot } from '../bot';
import type { State } from '../state';

class LegacySource implements SaveRepository {
  value: Save | null = null;
  journal: Save[] = [];
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    this.value = structuredClone(value);
    this.journal.push(this.value);
  }
}
const coordinator = (repository: SaveRepository, hostToken?: string) =>
  new RoomCoordinator(
    rules,
    bot,
    repository,
    hostToken,
    undefined,
    undefined,
    undefined,
    'expansion',
  );
async function command(
  room: RoomCoordinator,
  value: Command['command'],
  token = room.hostToken,
) {
  const view = room.view(token);
  const response = await room.command(token, {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: value,
  });
  expect(response).toMatchObject({ ok: true });
}
async function vote(
  room: RoomCoordinator,
  save: Save,
  credentials: Map<string, string>,
) {
  const state = save.snapshot!.state as State;
  const decision = rules.decisions(state)[0]!;
  await command(
    room,
    {
      type: 'game',
      decisionId: decision.id,
      action: { type: 'vote-research', taskId: state.researchCandidates[0]! },
    },
    credentials.get(decision.seatId)!,
  );
}
function writeLegacy(directory: string, source: LegacySource) {
  const database = new DatabaseSync(join(directory, 'room.sqlite'));
  database.exec(
    'CREATE TABLE saves(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL) STRICT; CREATE TABLE journal(instance TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(instance,revision)) STRICT; CREATE TABLE avatar_images(id TEXT PRIMARY KEY,png BLOB NOT NULL) STRICT; PRAGMA user_version=1;',
  );
  for (const value of source.journal)
    database
      .prepare('INSERT INTO journal VALUES(?,?,?)')
      .run(value.instanceId, value.revision, JSON.stringify(value));
  database
    .prepare('INSERT INTO saves VALUES(1,?)')
    .run(JSON.stringify(source.value));
  database.close();
}

describe('configuration extraction keeps real SQLite saves and branch authority compatible', () => {
  for (const seats of [2, 3, 4, 5, 6])
    it(`${seats} players: v1 migration, locked vote rollback and v2 restart`, async () => {
      const source = new LegacySource();
      const original = coordinator(source);
      const credentials = new Map<string, string>();
      for (let i = 0; i < seats; i++) {
        const player = await original.join(`配置验证${i + 1}`);
        credentials.set(original.view(player.token).self.seatId!, player.token);
        await command(original, { type: 'ready', ready: true }, player.token);
      }
      await command(original, { type: 'start' });
      for (let i = 0; i < seats - 1; i++)
        await vote(original, source.value!, credentials);
      const beforeFinalVote = source.load()!;
      await vote(original, source.value!, credentials);
      const afterFinalVote = source.load()!;
      expect((afterFinalVote.snapshot!.state as State).phase).toBe(
        'initial-flip',
      );
      const checkpoint = afterFinalVote.history.at(-1)!;
      const directory = resolve(
        'artifacts/maintenance/v1.0.3/pokemon-ui-redesign/config',
        `sqlite-${seats}-${Date.now()}-${randomUUID().slice(0, 8)}`,
      );
      mkdirSync(directory, { recursive: true });
      writeLegacy(directory, source);
      const file = join(directory, 'room.sqlite');
      const originalBytes = readFileSync(file);
      const repository = new SqliteSaveRepository(directory);
      let continued: Save;
      try {
        expect(repository.load()).toEqual(afterFinalVote);
        expect(readFileSync(file)).toEqual(originalBytes);
        const restored = coordinator(repository, original.hostToken);
        expect(restored.restored).toBe(true);
        expect(restored.view().paused).toBe(true);
        for (const [id, token] of credentials)
          expect(restored.view(token).self.seatId).toBe(id);
        const owner = [...credentials.keys()].at(-1)!;
        await command(restored, { type: 'set-owner', seatId: owner });
        const beforeRollback = repository.load() as Save;
        await command(restored, {
          type: 'rollback',
          checkpointId: checkpoint.id,
        });
        const rolledBack = repository.load() as Save;
        expect(rolledBack.snapshot).toEqual(beforeFinalVote.snapshot);
        expect(rolledBack.ownerSeatId).toBe(owner);
        expect(rolledBack.branch).toBe(beforeRollback.branch + 1);
        await command(restored, { type: 'resume' });
        await vote(restored, repository.load() as Save, credentials);
        continued = repository.load() as Save;
        expect(continued.snapshot).toEqual(afterFinalVote.snapshot);
      } finally {
        repository.close();
      }
      const backup = readdirSync(directory).find((name) =>
        name.startsWith('room-v1-backup-'),
      )!;
      expect(readFileSync(join(directory, backup, 'room.sqlite'))).toEqual(
        originalBytes,
      );
      const reopened = new SqliteSaveRepository(directory);
      try {
        expect(reopened.load()).toEqual(continued!);
        const restarted = coordinator(reopened, original.hostToken);
        expect(restarted.restored).toBe(true);
        expect((reopened.load() as Save).snapshot).toEqual(continued!.snapshot);
        expect((reopened.load() as Save).history).toEqual(continued!.history);
        for (const [id, token] of credentials)
          expect(restarted.view(token).self.seatId).toBe(id);
      } finally {
        reopened.close();
      }
      const database = new DatabaseSync(file, { readOnly: true });
      try {
        expect(
          database.prepare('PRAGMA user_version').get()?.user_version,
        ).toBe(2);
      } finally {
        database.close();
      }
      writeFileSync(
        join(directory, 'results.json'),
        JSON.stringify(
          {
            seats,
            result: 'passed',
            scope:
              'Actual RoomCoordinator and SQLite v1 migration/v2 restart; saved final vote replay and branch rollback; player identity and current phone-owner authority retained. Synthetic human seats, no GUI/Worker or real user save.',
            legacyRevisions: source.journal.length,
            continuedRevision: continued!.revision,
            branch: continued!.branch,
            originalSha256: createHash('sha256')
              .update(originalBytes)
              .digest('hex'),
            bytes: readFileSync(file).length,
          },
          null,
          2,
        ) + '\n',
      );
    });
});
