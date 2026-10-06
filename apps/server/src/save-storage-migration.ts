import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Save, SaveExtras } from '@tablemax/platform-core';
import { readCurrentSave, readJournalSave } from './save-audit';
import { createSaveStorage, SaveStorageWriter } from './save-storage';

type FileRecord = { name: string; bytes: number; sha256: string };
interface MigrationRecord {
  version: 1;
  temporary: string;
  backup: string;
  originals: FileRecord[];
  targetSha256: string;
}
const files = ['room.sqlite', 'room.sqlite-wal', 'room.sqlite-shm'];
function* streamRows(database: DatabaseSync, query: string) {
  const statement = database.prepare(query);
  yield* statement.iterate();
  // Node 22.14 iterators do not retain their StatementSync. Returning the
  // statement keeps a strong reference across every yield until the scan ends.
  return statement;
}
function fingerprint(path: string, progress?: () => void): FileRecord {
  if (lstatSync(path).isSymbolicLink())
    throw new Error('linked-save-migration-path');
  const hash = createHash('sha256');
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const count = readSync(fd, buffer, 0, buffer.length, null);
      if (!count) break;
      hash.update(buffer.subarray(0, count));
      progress?.();
    }
    return {
      name: basename(path),
      bytes: statSync(path).size,
      sha256: hash.digest('hex'),
    };
  } finally {
    closeSync(fd);
  }
}
function same(path: string, record: FileRecord, progress?: () => void) {
  return (
    existsSync(path) &&
    statSync(path).size === record.bytes &&
    fingerprint(path, progress).sha256 === record.sha256
  );
}
function marker(path: string) {
  return path + '.migration.json';
}
function recordAt(path: string): MigrationRecord {
  const record = JSON.parse(
    readFileSync(marker(path), 'utf8'),
  ) as MigrationRecord;
  if (
    record.version !== 1 ||
    !/^room-v1-backup-[0-9a-f-]{36}$/.test(record.backup) ||
    !/^room-v2-staging-[0-9a-f-]{36}\.sqlite$/.test(record.temporary) ||
    !/^[0-9a-f]{64}$/.test(record.targetSha256) ||
    !Array.isArray(record.originals) ||
    record.originals[0]?.name !== 'room.sqlite' ||
    record.originals.some(
      (entry) =>
        !files.includes(entry.name) || !/^[0-9a-f]{64}$/.test(entry.sha256),
    ) ||
    new Set(record.originals.map((entry) => entry.name)).size !==
      record.originals.length
  )
    throw new Error('invalid-save-migration-record');
  for (const candidate of [
    join(dirname(path), record.backup),
    join(dirname(path), record.temporary),
  ])
    if (existsSync(candidate) && lstatSync(candidate).isSymbolicLink())
      throw new Error('linked-save-migration-path');
  return record;
}
function restore(path: string, record: MigrationRecord) {
  const root = dirname(path),
    backup = join(root, record.backup);
  // Check every source before moving any file. Unknown files are never overwritten.
  for (const file of record.originals) {
    const original = join(root, file.name),
      retained = join(backup, file.name);
    if (!same(original, file) && !same(retained, file))
      throw new Error('damaged-save-migration-backup');
    if (existsSync(original) && !same(original, file))
      throw new Error('changed-save-migration-source');
  }
  for (const file of record.originals) {
    const original = join(root, file.name);
    if (!existsSync(original)) renameSync(join(backup, file.name), original);
  }
  renameSync(marker(path), join(backup, 'migration-rolled-back.json'));
}
/** Recover only our fully validated replacement transaction; unknown databases remain untouched. */
export function recoverSaveMigration(path: string) {
  if (!existsSync(marker(path))) return;
  if (existsSync(path + '.migration.lock')) {
    const owner = JSON.parse(
      readFileSync(path + '.migration.lock', 'utf8'),
    ) as { pid: number };
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0)
      throw new Error('save-migration-busy');
    let dead = false;
    try {
      process.kill(owner.pid, 0);
    } catch (error) {
      dead = (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
    if (!dead) throw new Error('save-migration-busy');
  }
  const record = recordAt(path),
    backup = join(dirname(path), record.backup);
  if (existsSync(path) && fingerprint(path).sha256 === record.targetSha256) {
    const database = new DatabaseSync(path, { readOnly: true });
    try {
      if (
        database.prepare('PRAGMA user_version').get()?.user_version !== 2 ||
        database.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok'
      )
        throw new Error('damaged-save-migration-target');
      readCurrentSave(database);
    } finally {
      database.close();
    }
    for (const original of record.originals)
      if (!same(join(backup, original.name), original))
        throw new Error('damaged-save-migration-backup');
    renameSync(marker(path), join(backup, 'migration-completed.json'));
    return;
  }
  restore(path, record);
}

export function migrateSaveStorage(
  path: string,
  source: DatabaseSync,
  value: Save,
  extras?: SaveExtras,
  fault?: (stage: 'validated' | 'backed-up' | 'installed') => void,
  progress?: () => void,
) {
  progress?.();
  const root = dirname(path),
    token = randomUUID();
  const temporary = `room-v2-staging-${token}.sqlite`,
    backup = `room-v1-backup-${token}`;
  const lockPath = path + '.migration.lock';
  let lock: number;
  try {
    if (existsSync(lockPath)) {
      const owner = JSON.parse(readFileSync(lockPath, 'utf8')) as {
        pid: number;
      };
      if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0)
        throw new Error('save-migration-busy');
      let dead = false;
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        dead = (error as NodeJS.ErrnoException).code === 'ESRCH';
      }
      if (!dead) throw new Error('save-migration-busy');
      unlinkSync(lockPath);
    }
    lock = openSync(lockPath, 'wx');
    writeFileSync(lock, JSON.stringify({ pid: process.pid }));
  } catch {
    throw new Error('save-migration-busy');
  }
  let target: DatabaseSync | undefined;
  let sourceClosed = false;
  let record: MigrationRecord | undefined;
  try {
    // A stale second repository must not migrate a database already replaced by another writer.
    const originals = files
      .filter((name) => existsSync(join(root, name)))
      .map((name) => fingerprint(join(root, name), progress));
    source.exec('BEGIN');
    target = new DatabaseSync(join(root, temporary));
    target.exec('PRAGMA synchronous=FULL;');
    createSaveStorage(target);
    const writer = new SaveStorageWriter(target);
    for (const row of streamRows(
      source,
      'SELECT rowid,instance,revision,data FROM journal ORDER BY rowid',
    )) {
      const saved = JSON.parse(String(row.data)) as Save;
      if (saved.instanceId !== row.instance || saved.revision !== row.revision)
        throw new Error('damaged-save-journal');
      writer.write(saved);
      progress?.();
    }
    const current = readCurrentSave(source) as Save | null;
    if (current) writer.write(current, undefined, false);
    // Complete stream comparison keeps one historical Save in memory, never the whole journal.
    for (const row of streamRows(
      source,
      'SELECT rowid,data FROM journal ORDER BY rowid',
    )) {
      progress?.();
      if (
        !isDeepStrictEqual(
          JSON.parse(String(row.data)),
          readJournalSave(target, Number(row.rowid)),
        )
      )
        throw new Error('save-migration-journal-mismatch');
    }
    if (!isDeepStrictEqual(current, readCurrentSave(target)))
      throw new Error('save-migration-current-mismatch');
    if (
      source
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='avatar_images'",
        )
        .get()
    ) {
      for (const row of streamRows(source, 'SELECT id,png FROM avatar_images'))
        target
          .prepare('INSERT INTO avatar_images VALUES(?,?)')
          .run(row.id!, row.png!);
      const oldCount = source
        .prepare('SELECT count(*) AS n FROM avatar_images')
        .get()?.n;
      if (
        target.prepare('SELECT count(*) AS n FROM avatar_images').get()?.n !==
        oldCount
      )
        throw new Error('save-migration-avatar-mismatch');
      for (const row of streamRows(
        source,
        'SELECT id,png FROM avatar_images',
      )) {
        const copied = target
          .prepare('SELECT png FROM avatar_images WHERE id=?')
          .get(row.id!);
        if (
          !copied ||
          !Buffer.from(copied.png as Uint8Array).equals(
            Buffer.from(row.png as Uint8Array),
          )
        )
          throw new Error('save-migration-avatar-mismatch');
      }
    }
    writer.write(value, extras);
    if (
      !isDeepStrictEqual(readCurrentSave(target), value) ||
      target.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok'
    )
      throw new Error('save-migration-target-mismatch');
    fault?.('validated');
    source.exec('COMMIT');
    source.close();
    sourceClosed = true;
    target.close();
    target = undefined;
    // SHM is a volatile read-index: our read transaction may update its reader marks.
    // Preserve its final bytes, but only database/WAL byte changes signal a concurrent writer.
    const durableOriginals = originals.filter(
      (entry) => entry.name !== 'room.sqlite-shm',
    );
    const currentFiles = files.filter(
      (name) => name !== 'room.sqlite-shm' && existsSync(join(root, name)),
    );
    if (
      currentFiles.length !== durableOriginals.length ||
      durableOriginals.some(
        (entry) => !same(join(root, entry.name), entry, progress),
      )
    )
      throw new Error('save-migration-source-changed');
    mkdirSync(join(root, backup));
    record = {
      version: 1,
      temporary,
      backup,
      originals: [
        ...durableOriginals,
        ...(existsSync(join(root, 'room.sqlite-shm'))
          ? [fingerprint(join(root, 'room.sqlite-shm'), progress)]
          : []),
      ],
      targetSha256: fingerprint(join(root, temporary), progress).sha256,
    };
    const receipt = openSync(marker(path), 'wx');
    try {
      writeFileSync(receipt, JSON.stringify(record, null, 2));
      fsyncSync(receipt);
    } finally {
      closeSync(receipt);
    }
    for (const entry of record.originals)
      renameSync(join(root, entry.name), join(root, backup, entry.name));
    fault?.('backed-up');
    renameSync(join(root, temporary), path);
    fault?.('installed');
    target = new DatabaseSync(path);
    target.exec('PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
    if (!isDeepStrictEqual(readCurrentSave(target), value))
      throw new Error('save-migration-installed-mismatch');
    renameSync(marker(path), join(root, backup, 'migration-completed.json'));
    return target;
  } catch (error) {
    target?.close();
    if (!sourceClosed) {
      try {
        source.exec('ROLLBACK');
      } catch {
        /* No open read transaction. */
      }
    }
    if (record && existsSync(marker(path))) {
      if (existsSync(path) && fingerprint(path).sha256 === record.targetSha256)
        renameSync(path, join(root, record.temporary));
      restore(path, record);
    }
    // Retain the failed candidate and a bounded diagnostic; never delete old libraries.
    writeFileSync(
      join(root, temporary + '.failed.json'),
      JSON.stringify({
        message: error instanceof Error ? error.message : String(error),
        originalReplaced: false,
      }),
    );
    throw error;
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}
