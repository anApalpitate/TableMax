import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function openFoundationDatabase(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const database = new DatabaseSync(join(dataDir, 'foundation.sqlite'));
  try {
    const version = database.prepare('PRAGMA user_version').get()?.user_version;
    if (version !== 0 && version !== 1)
      throw new Error('Unsupported foundation database version');
    database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    database.exec(
      'CREATE TABLE IF NOT EXISTS foundation (key TEXT PRIMARY KEY, value INTEGER NOT NULL) STRICT; PRAGMA user_version = 1;',
    );
  } catch (error) {
    database.close();
    throw error;
  }

  function transaction<T>(action: () => T): T {
    database.exec('BEGIN IMMEDIATE');
    try {
      const value = action();
      database.exec('COMMIT');
      return value;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  const starts = transaction(() => {
    database
      .prepare(
        "INSERT INTO foundation(key,value) VALUES ('starts',1) ON CONFLICT(key) DO UPDATE SET value=value+1",
      )
      .run();
    return Number(
      database.prepare("SELECT value FROM foundation WHERE key='starts'").get()
        ?.value,
    );
  });

  return {
    starts,
    version: String(
      database.prepare('SELECT sqlite_version() AS version').get()?.version,
    ),
    database,
    transaction,
    close: () => database.close(),
  };
}
