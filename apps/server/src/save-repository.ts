import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Save, SaveExtras, SaveRepository } from '@tablemax/platform-core';

export class SqliteSaveRepository implements SaveRepository {
  private database: DatabaseSync;
  constructor(dataDir: string) {
    const path = join(dataDir, 'room.sqlite');
    const existing = existsSync(path);
    this.database = new DatabaseSync(path, { readOnly: existing });
    try {
      const version = this.database
        .prepare('PRAGMA user_version')
        .get()?.user_version;
      if (existing ? version !== 1 : version !== 0)
        throw new Error('incompatible-save-database');
      if (
        this.database.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok'
      )
        throw new Error('damaged-save-database');
      if (existing) {
        // Validate without touching the original file. Opening the write handle
        // performs no schema or journal mutations before game compatibility checks.
        this.database.prepare('SELECT data FROM saves WHERE id=1').get();
        this.database
          .prepare('SELECT instance,revision FROM journal LIMIT 1')
          .get();
        this.database.close();
        this.database = new DatabaseSync(path);
      } else {
        this.database.exec(
          'PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;',
        );
        this.database.exec(
          'CREATE TABLE IF NOT EXISTS saves (id INTEGER PRIMARY KEY CHECK (id=1), data TEXT NOT NULL) STRICT; CREATE TABLE IF NOT EXISTS journal (instance TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(instance, revision)) STRICT; PRAGMA user_version=1;',
        );
      }
    } catch (error) {
      this.database.close();
      throw error;
    }
  }
  load(): unknown | null {
    const row = this.database
      .prepare('SELECT data FROM saves WHERE id=1')
      .get();
    if (!row) return null;
    try {
      return JSON.parse(String(row.data));
    } catch {
      throw new Error('damaged-save-json');
    }
  }
  getAvatar(id: string): Uint8Array | null {
    if (
      !this.database
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='avatar_images'",
        )
        .get()
    )
      return null;
    const row = this.database
      .prepare('SELECT png FROM avatar_images WHERE id=?')
      .get(id);
    return row ? (row.png as Uint8Array) : null;
  }
  save(value: Save, extras?: SaveExtras) {
    const json = JSON.stringify(value);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      if (extras?.avatars?.length) {
        this.database.exec(
          'CREATE TABLE IF NOT EXISTS avatar_images (id TEXT PRIMARY KEY, png BLOB NOT NULL) STRICT;',
        );
        const insertAvatar = this.database.prepare(
          'INSERT INTO avatar_images(id,png) VALUES(?,?) ON CONFLICT(id) DO NOTHING',
        );
        for (const avatar of extras.avatars)
          insertAvatar.run(avatar.id, avatar.png);
      }
      const insertJournal = this.database.prepare(
        'INSERT INTO journal(instance,revision,data) VALUES(?,?,?)',
      );
      for (const previous of extras?.journal ?? [])
        insertJournal.run(
          previous.instanceId,
          previous.revision,
          JSON.stringify(previous),
        );
      insertJournal.run(value.instanceId, value.revision, json);
      this.database
        .prepare(
          'INSERT INTO saves(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
        )
        .run(json);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
  close() {
    this.database.close();
  }
}
