import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Save } from '@tablemax/platform-core';
import { SqliteSaveRepository } from './save-repository';
import { readCurrentSave, readJournalSave } from './save-audit';
import {
  migrateSaveStorage,
  recoverSaveMigration,
} from './save-storage-migration';

const directory = () => mkdtempSync(join(tmpdir(), 'tablemax-storage-'));
function save(revision = 0): Save {
  return {
    formatVersion: 1,
    manifest: null,
    instanceId: '00000000-0000-0000-0000-000000000001',
    revision,
    branch: 0,
    status: 'lobby',
    paused: false,
    joinOpen: true,
    seats: [],
    snapshot: null,
    history: [],
    receipts: {},
    botError: null,
    endReason: null,
  };
}
function legacy(path: string, values: Save[]) {
  const database = new DatabaseSync(join(path, 'room.sqlite'));
  database.exec(
    'CREATE TABLE saves(id INTEGER PRIMARY KEY,data TEXT NOT NULL) STRICT; CREATE TABLE journal(instance TEXT,revision INTEGER,data TEXT,PRIMARY KEY(instance,revision)) STRICT; PRAGMA user_version=1;',
  );
  for (const value of values)
    database
      .prepare('INSERT INTO journal VALUES(?,?,?)')
      .run(value.instanceId, value.revision, JSON.stringify(value));
  database
    .prepare('INSERT INTO saves VALUES(1,?)')
    .run(JSON.stringify(values.at(-1)));
  database.close();
}

describe('normalized SQLite save storage', () => {
  it('creates internal v2 while preserving external format-1 load', () => {
    const path = directory();
    const repository = new SqliteSaveRepository(path);
    const value = save();
    repository.save(value);
    expect(repository.load()).toEqual(value);
    repository.close();
    const database = new DatabaseSync(join(path, 'room.sqlite'));
    expect(database.prepare('PRAGMA user_version').get()?.user_version).toBe(2);
    database.close();
  });
  it('opens v1 read-only and migrates only upon a successful fresh save, preserving the original backup', () => {
    const path = directory();
    const first = save();
    legacy(path, [first]);
    const original = readFileSync(join(path, 'room.sqlite'));
    const repository = new SqliteSaveRepository(path);
    expect(repository.load()).toEqual(first);
    expect(readFileSync(join(path, 'room.sqlite'))).toEqual(original);
    repository.save(save(1));
    expect(repository.load()).toEqual(save(1));
    repository.close();
    const backup = readdirSync(path).find((name) =>
      name.startsWith('room-v1-backup-'),
    );
    expect(backup).toBeDefined();
    expect(readFileSync(join(path, backup!, 'room.sqlite'))).toEqual(original);
  });
  it('rejects a failed migration without changing the original v1 database', () => {
    const path = directory();
    legacy(path, [save()]);
    const original = readFileSync(join(path, 'room.sqlite'));
    const repository = new SqliteSaveRepository(path);
    expect(() => repository.save(save())).toThrow();
    expect(readFileSync(join(path, 'room.sqlite'))).toEqual(original);
    expect(repository.load()).toEqual(save());
    repository.close();
  });
  it('stores growing checkpoints and cumulative receipts once rather than in every revision', () => {
    const path = directory();
    const repository = new SqliteSaveRepository(path);
    const value = save();
    for (let revision = 0; revision < 20; revision++) {
      value.revision = revision;
      value.history.push({
        id: `checkpoint-${revision}`,
        label: 'saved',
        revealedInformation: false,
        before: {
          state: { fixed: 'payload'.repeat(40) },
          random: revision + 1,
          bots: {},
        },
      });
      value.receipts[`receipt-${revision}`] = {
        fingerprint: `${revision}`,
        reply: { ok: true, revision, branch: 0 },
      };
      repository.save(value);
    }
    expect(repository.load()).toEqual(value);
    repository.close();
    const database = new DatabaseSync(join(path, 'room.sqlite'));
    expect(
      database.prepare('SELECT count(*) AS n FROM checkpoint_nodes').get()?.n,
    ).toBe(20);
    expect(
      database.prepare('SELECT count(*) AS n FROM receipt_nodes').get()?.n,
    ).toBe(20);
    const rows = database.prepare('SELECT data FROM journal').all();
    expect(
      rows.every((row) => !String(row.data).includes('payloadpayload')),
    ).toBe(true);
    database.close();
  });
  it('retains full historical revisions and abandoned branches, including receipt updates and deletes', () => {
    const path = directory(),
      repository = new SqliteSaveRepository(path);
    const first = save();
    first.history = [
      {
        id: 'a',
        label: 'first',
        revealedInformation: true,
        before: { state: { secret: 17 }, random: 1, bots: {} },
      },
    ];
    first.receipts = {
      old: { fingerprint: 'old', reply: { ok: true, revision: 0, branch: 0 } },
    };
    repository.save(first);
    const second = structuredClone(first);
    second.revision = 1;
    second.history.push({
      id: 'b',
      label: 'second',
      revealedInformation: false,
      before: { state: { secret: 18 }, random: 2, bots: {} },
    });
    second.receipts.added = {
      fingerprint: 'new',
      reply: { ok: true, revision: 1, branch: 0 },
    };
    repository.save(second);
    const rolled = structuredClone(first);
    rolled.revision = 2;
    rolled.branch = 1;
    rolled.history = [];
    rolled.receipts = { added: second.receipts.added! };
    rolled.sessionReceipts = {};
    repository.save(rolled);
    const database = new DatabaseSync(join(path, 'room.sqlite'), {
      readOnly: true,
    });
    expect(readJournalSave(database, 1)).toEqual(first);
    expect(readJournalSave(database, 2)).toEqual(second);
    expect(readJournalSave(database, 3)).toEqual(rolled);
    expect(readCurrentSave(database)).toEqual(rolled);
    expect(
      database.prepare('SELECT count(*) AS n FROM checkpoint_nodes').get()?.n,
    ).toBe(2);
    database.close();
    repository.close();
  });
  it('rolls back journal, nodes, avatars and writer caches when saves UPDATE fails', () => {
    const path = directory(),
      repository = new SqliteSaveRepository(path);
    repository.save(save());
    const database = new DatabaseSync(join(path, 'room.sqlite'));
    database.exec(
      "CREATE TRIGGER reject_save BEFORE UPDATE ON saves BEGIN SELECT RAISE(ABORT,'failed update'); END;",
    );
    const value = save(1);
    value.receipts.a = {
      fingerprint: 'a',
      reply: { ok: true, revision: 1, branch: 0 },
    };
    value.history = [
      {
        id: 'a',
        label: 'first',
        revealedInformation: true,
        before: { state: {}, random: 1, bots: {} },
      },
    ];
    expect(() =>
      repository.save(value, {
        avatars: [{ id: 'avatar', png: Uint8Array.of(1, 2, 3) }],
      }),
    ).toThrow('failed update');
    for (const table of ['checkpoint_nodes', 'receipt_nodes', 'avatar_images'])
      expect(
        database.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n,
      ).toBe(0);
    expect(repository.load()).toEqual(save());
    database.exec('DROP TRIGGER reject_save');
    repository.save(value);
    expect(repository.load()).toEqual(value);
    database.close();
    repository.close();
  });
  it('streams every v1 revision and avatar into v2 without erasing branch or current differences', () => {
    const path = directory();
    const first = save();
    const second = save(1);
    second.branch = 1;
    first.receipts.a = {
      fingerprint: 'a',
      reply: { ok: true, revision: 0, branch: 0 },
    };
    second.receipts.b = {
      fingerprint: 'b',
      reply: { ok: true, revision: 1, branch: 1 },
    };
    legacy(path, [first, second]);
    const source = new DatabaseSync(join(path, 'room.sqlite'));
    source.exec(
      'CREATE TABLE avatar_images(id TEXT PRIMARY KEY,png BLOB) STRICT;',
    );
    source
      .prepare('INSERT INTO avatar_images VALUES(?,?)')
      .run('avatar', Uint8Array.of(8, 9));
    source.close();
    const repository = new SqliteSaveRepository(path);
    repository.save(save(2));
    expect(repository.getAvatar('avatar')).toEqual(Uint8Array.of(8, 9));
    repository.close();
    const database = new DatabaseSync(join(path, 'room.sqlite'), {
      readOnly: true,
    });
    expect(readJournalSave(database, 1)).toEqual(first);
    expect(readJournalSave(database, 2)).toEqual(second);
    database.close();
  });
  for (const stage of ['validated', 'backed-up', 'installed'] as const)
    it(`preserves original bytes after a migration failure at ${stage}`, () => {
      const path = directory();
      legacy(path, [save()]);
      const original = readFileSync(join(path, 'room.sqlite'));
      const source = new DatabaseSync(join(path, 'room.sqlite'), {
        readOnly: true,
      });
      expect(() =>
        migrateSaveStorage(
          join(path, 'room.sqlite'),
          source,
          save(1),
          undefined,
          (current) => {
            if (current === stage)
              throw new Error('injected migration failure');
          },
        ),
      ).toThrow('injected migration failure');
      try {
        source.close();
      } catch {
        /* migration closed the source before replacement */
      }
      expect(readFileSync(join(path, 'room.sqlite'))).toEqual(original);
      const repository = new SqliteSaveRepository(path);
      expect(repository.load()).toEqual(save());
      repository.close();
    });
  it('recovers interruption between original-file backup and target installation', () => {
    const path = directory();
    legacy(path, [save()]);
    const file = join(path, 'room.sqlite');
    const original = readFileSync(file);
    const source = new DatabaseSync(file, { readOnly: true });
    let prepared = '';
    expect(() =>
      migrateSaveStorage(file, source, save(1), undefined, (stage) => {
        if (stage === 'backed-up') {
          prepared = readFileSync(file + '.migration.json', 'utf8');
          throw new Error('capture interrupted stage');
        }
      }),
    ).toThrow('capture interrupted stage');
    const record = JSON.parse(prepared);
    renameSync(file, join(path, record.backup, 'room.sqlite'));
    writeFileSync(file + '.migration.json', prepared);
    recoverSaveMigration(file);
    expect(readFileSync(file)).toEqual(original);
    expect(existsSync(file + '.migration.json')).toBe(false);
  });
  it('preserves pending WAL bytes in the v1 backup and reads its committed latest value', () => {
    const originalPath = directory();
    legacy(originalPath, [save()]);
    const writer = new DatabaseSync(join(originalPath, 'room.sqlite'));
    writer.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
    writer.prepare('UPDATE saves SET data=?').run(JSON.stringify(save(8)));
    const path = directory();
    for (const suffix of ['', '-wal', '-shm'])
      copyFileSync(
        join(originalPath, 'room.sqlite' + suffix),
        join(path, 'room.sqlite' + suffix),
      );
    writer.close();
    const original = readFileSync(join(path, 'room.sqlite')),
      wal = readFileSync(join(path, 'room.sqlite-wal'));
    const repository = new SqliteSaveRepository(path);
    expect(repository.load()).toEqual(save(8));
    repository.save(save(9));
    repository.close();
    const backup = readdirSync(path).find((name) =>
      name.startsWith('room-v1-backup-'),
    )!;
    expect(readFileSync(join(path, backup, 'room.sqlite'))).toEqual(original);
    expect(readFileSync(join(path, backup, 'room.sqlite-wal'))).toEqual(wal);
  });
  it('does not modify incompatible versions or damaged legacy JSON on constructor/load', () => {
    for (const mode of ['version', 'json']) {
      const path = directory();
      legacy(path, [save()]);
      const file = join(path, 'room.sqlite');
      const database = new DatabaseSync(file);
      if (mode === 'version') database.exec('PRAGMA user_version=99');
      else database.prepare('UPDATE saves SET data=?').run('{broken');
      database.close();
      const original = readFileSync(file);
      if (mode === 'version')
        expect(() => new SqliteSaveRepository(path)).toThrow(
          'incompatible-save-database',
        );
      else {
        const repository = new SqliteSaveRepository(path);
        expect(() => repository.load()).toThrow('damaged-save-json');
        repository.close();
      }
      expect(readFileSync(file)).toEqual(original);
    }
  });
  it('versions changed checkpoint content with the same public id without overwriting an old revision', () => {
    const path = directory(),
      repository = new SqliteSaveRepository(path),
      value = save();
    value.history = [
      {
        id: 'same-id',
        label: 'saved',
        revealedInformation: false,
        before: { state: { version: 1 }, random: 1, bots: {} },
      },
    ];
    repository.save(value);
    const before = structuredClone(value);
    value.revision = 1;
    value.history[0]!.before.state = { version: 2 };
    repository.save(value);
    const database = new DatabaseSync(join(path, 'room.sqlite'), {
      readOnly: true,
    });
    expect(readJournalSave(database, 1)).toEqual(before);
    expect(readJournalSave(database, 2)).toEqual(value);
    database.close();
    repository.close();
  });
  it('rejects a concurrent recovery while the original replacement transaction owns the migration lock', () => {
    const path = directory();
    legacy(path, [save()]);
    const file = join(path, 'room.sqlite'),
      source = new DatabaseSync(file, { readOnly: true });
    const database = migrateSaveStorage(
      file,
      source,
      save(1),
      undefined,
      (stage) => {
        if (stage === 'backed-up')
          expect(() => new SqliteSaveRepository(path)).toThrow(
            'save-migration-busy',
          );
      },
    );
    expect(readCurrentSave(database)).toEqual(save(1));
    expect(database.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1);
    expect(database.prepare('PRAGMA synchronous').get()?.synchronous).toBe(2);
    database.close();
  });
  it('finishes an interrupted already-installed, verified replacement without losing its original backup', () => {
    const path = directory();
    legacy(path, [save()]);
    const file = join(path, 'room.sqlite'),
      source = new DatabaseSync(file, { readOnly: true });
    let prepared = '';
    expect(() =>
      migrateSaveStorage(file, source, save(1), undefined, (stage) => {
        if (stage === 'installed') {
          prepared = readFileSync(file + '.migration.json', 'utf8');
          throw new Error('capture installed state');
        }
      }),
    ).toThrow('capture installed state');
    const record = JSON.parse(prepared);
    renameSync(file, join(path, record.backup, 'room.sqlite'));
    renameSync(join(path, record.temporary), file);
    writeFileSync(file + '.migration.json', prepared);
    recoverSaveMigration(file);
    const database = new DatabaseSync(file, { readOnly: true });
    expect(readCurrentSave(database)).toEqual(save(1));
    expect(existsSync(join(path, record.backup, 'room.sqlite'))).toBe(true);
    database.close();
  });
  it('has near-linear disk growth for 500, 1000 and 2000 fixed-state saves', () => {
    const evidence = join(
      process.cwd(),
      'artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/storage',
    );
    mkdirSync(evidence, { recursive: true });
    const results = [];
    for (const count of [500, 1000, 2000]) {
      const path = directory(),
        repository = new SqliteSaveRepository(path),
        value = save(),
        start = performance.now();
      for (let revision = 0; revision < count; revision++) {
        value.revision = revision;
        value.history.push({
          id: `c-${revision}`,
          label: 'fixed',
          revealedInformation: false,
          before: {
            state: { payload: 'x'.repeat(512) },
            random: revision + 1,
            bots: {},
          },
        });
        value.receipts[`r-${revision}`] = {
          fingerprint: `fingerprint-${revision}`,
          reply: { ok: true, revision, branch: 0 },
        };
        repository.save(value);
      }
      expect(repository.load()).toEqual(value);
      repository.close();
      const bytes = statSync(join(path, 'room.sqlite')).size;
      results.push({
        count,
        bytes,
        elapsedMs: Math.round(performance.now() - start),
      });
    }
    expect(results[1]!.bytes / results[0]!.bytes).toBeLessThan(2.2);
    expect(results[2]!.bytes / results[1]!.bytes).toBeLessThan(2.2);
    writeFileSync(
      join(evidence, 'fixed-load.json'),
      JSON.stringify(
        {
          scope:
            'Fixed 512-byte checkpoint snapshot and one cumulative receipt per save; disk growth only, not arbitrary game-state bounds.',
          results,
        },
        null,
        2,
      ),
    );
  }, 120000);
});
