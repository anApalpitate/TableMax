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
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BotStrategy, GameRules } from '@tablemax/game-sdk';
import type { Command } from '@tablemax/protocol';
import {
  RoomCoordinator,
  type Save,
  type SaveRepository,
} from '@tablemax/platform-core';
import {
  rules as modernArt,
  bot as modernArtBot,
} from '../../../games/modern-art';
import {
  rules as powerGrid,
  bot as powerGridBot,
} from '../../../games/power-grid';
import { pokemonExpansion } from '../../../games/pokemon-encounters/expansion';
import { bot as pokemonBot } from '../../../games/pokemon-encounters/expansion/bot';
import { SqliteSaveRepository } from './save-repository';
import { readCurrentSave, readJournalSave } from './save-audit';

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
interface GameFixture {
  id: string;
  rules: GameRules;
  bot: BotStrategy;
  variant?: string;
}
const games: GameFixture[] = [
  { id: 'modern-art', rules: modernArt, bot: modernArtBot },
  { id: 'power-grid', rules: powerGrid, bot: powerGridBot },
  {
    id: 'pokemon-encounters/expansion',
    rules: pokemonExpansion,
    bot: pokemonBot,
    variant: 'expansion',
  },
];
function room(game: GameFixture, repository: SaveRepository) {
  return new RoomCoordinator(
    game.rules,
    game.bot,
    repository,
    undefined,
    undefined,
    undefined,
    undefined,
    game.variant,
  );
}
function envelope(
  coordinator: RoomCoordinator,
  token: string,
  command: Command['command'],
): Command {
  const view = coordinator.view(token);
  return {
    actionId: randomUUID(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command,
  };
}
async function command(
  coordinator: RoomCoordinator,
  token: string,
  value: Command['command'],
) {
  const result = await coordinator.command(
    token,
    envelope(coordinator, token, value),
  );
  expect(result.ok).toBe(true);
}
async function legalAction(
  coordinator: RoomCoordinator,
  game: GameFixture,
  value: Save,
  credentials: Map<string, string>,
) {
  const state = value.snapshot!.state;
  const decision = game.rules.decisions(state)[0]!;
  expect(decision).toBeDefined();
  const token = credentials.get(decision.seatId)!;
  expect(token).toBeDefined();
  const action = game.rules.legalActions(state, decision.seatId)[0]!;
  expect(action).toBeDefined();
  await command(coordinator, token, {
    type: 'game',
    decisionId: coordinator.view(token).decisionId!,
    action,
  });
}
function writeLegacy(path: string, source: LegacySource) {
  const database = new DatabaseSync(join(path, 'room.sqlite'));
  database.exec(`
    CREATE TABLE saves(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL) STRICT;
    CREATE TABLE journal(instance TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(instance,revision)) STRICT;
    CREATE TABLE avatar_images(id TEXT PRIMARY KEY,png BLOB NOT NULL) STRICT;
    PRAGMA user_version=1;
  `);
  for (const value of source.journal)
    database
      .prepare('INSERT INTO journal VALUES(?,?,?)')
      .run(value.instanceId, value.revision, JSON.stringify(value));
  database
    .prepare('INSERT INTO saves VALUES(1,?)')
    .run(JSON.stringify(source.value));
  database.close();
}

describe('real game format-1 SQLite compatibility', () => {
  it.each(games)(
    '$id restores v1, continues a legal action, and restarts v2',
    async (game) => {
      const source = new LegacySource();
      const originalRoom = room(game, source);
      const credentials = new Map<string, string>();
      for (let index = 0; index < game.rules.manifest.players.min; index++) {
        const player = await originalRoom.join(`玩家 ${index + 1}`);
        const seatId = originalRoom.view(player.token).self.seatId!;
        credentials.set(seatId, player.token);
        await command(originalRoom, player.token, {
          type: 'ready',
          ready: true,
        });
      }
      await command(originalRoom, originalRoom.hostToken, { type: 'start' });
      await legalAction(originalRoom, game, source.value!, credentials);
      expect(source.value!.history.length).toBeGreaterThan(0);

      const path = mkdtempSync(join(tmpdir(), 'tablemax-storage-game-'));
      writeLegacy(path, source);
      const file = join(path, 'room.sqlite');
      const originalBytes = readFileSync(file);
      const repository = new SqliteSaveRepository(path);
      expect(repository.load()).toEqual(source.value);
      expect(readFileSync(file)).toEqual(originalBytes);
      const restored = room(game, repository);
      expect(restored.restored).toBe(true);
      expect(restored.view().paused).toBe(true);
      for (const [seatId, token] of credentials)
        expect(restored.view(token).self.seatId).toBe(seatId);
      await command(restored, restored.hostToken, { type: 'resume' });
      const migrated = repository.load() as Save;
      await legalAction(restored, game, migrated, credentials);
      const continued = repository.load() as Save;
      expect(continued.history.length).toBe(source.value!.history.length + 1);
      repository.close();

      const audit = new DatabaseSync(file, { readOnly: true });
      expect(audit.prepare('PRAGMA user_version').get()?.user_version).toBe(2);
      for (let index = 0; index < source.journal.length; index++)
        expect(readJournalSave(audit, index + 1)).toEqual(
          source.journal[index],
        );
      expect(readCurrentSave(audit)).toEqual(continued);
      audit.close();
      const backup = readdirSync(path).find((entry) =>
        entry.startsWith('room-v1-backup-'),
      )!;
      expect(readFileSync(join(path, backup, 'room.sqlite'))).toEqual(
        originalBytes,
      );

      const reopened = new SqliteSaveRepository(path);
      expect(reopened.load()).toEqual(continued);
      const restarted = room(game, reopened);
      const loaded = reopened.load() as Save;
      expect(restarted.restored).toBe(true);
      expect(loaded.snapshot).toEqual(continued.snapshot);
      expect(loaded.history).toEqual(continued.history);
      expect(loaded.receipts).toEqual(continued.receipts);
      expect(loaded.sessionReceipts).toEqual(continued.sessionReceipts);
      expect(loaded.seats).toEqual(continued.seats);
      for (const [seatId, token] of credentials)
        expect(restarted.view(token).self.seatId).toBe(seatId);
      reopened.close();

      const evidence = join(
        process.cwd(),
        'artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/storage',
      );
      mkdirSync(evidence, { recursive: true });
      writeFileSync(
        join(evidence, `game-${game.id.replace('/', '-')}.json`),
        JSON.stringify(
          {
            game: game.id,
            scope:
              'Real rules and RoomCoordinator with human credentials, v1 migration, legal action and v2 restart. No Worker or bot strength run.',
            legacyRevisions: source.journal.length,
            originalSha256: createHash('sha256')
              .update(originalBytes)
              .digest('hex'),
            continuedRevision: continued.revision,
            continuedBranch: continued.branch,
            checkpoints: continued.history.length,
            bytes: readFileSync(file).length,
            result: 'passed',
          },
          null,
          2,
        ),
      );
    },
  );
});
