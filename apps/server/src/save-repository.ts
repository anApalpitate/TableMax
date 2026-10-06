import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Save, SaveExtras, SaveRepository } from '@tablemax/platform-core';
import { readCurrentSave } from './save-audit';
import { createSaveStorage, SaveStorageWriter } from './save-storage';
import {
  migrateSaveStorage,
  recoverSaveMigration,
} from './save-storage-migration';

export class SqliteSaveRepository implements SaveRepository {
  private database: DatabaseSync;
  private path: string;
  private version: number;
  private writable = false;
  private writer: SaveStorageWriter | undefined;
  constructor(dataDir: string) {
    const path = join(dataDir, 'room.sqlite');
    this.path = path;
    recoverSaveMigration(path);
    const existing = existsSync(path);
    this.database = new DatabaseSync(path, { readOnly: existing });
    try {
      const version = this.database
        .prepare('PRAGMA user_version')
        .get()?.user_version;
      if (existing ? version !== 1 && version !== 2 : version !== 0)
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
        this.version = Number(version);
      } else {
        this.database.exec(
          'PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;',
        );
        createSaveStorage(this.database);
        this.version = 2;
        this.writable = true;
        this.writer = new SaveStorageWriter(this.database);
      }
    } catch (error) {
      this.database.close();
      throw error;
    }
  }
  load(): unknown | null {
    return readCurrentSave(this.database);
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
    if (this.version === 1) {
      try {
        this.database = migrateSaveStorage(
          this.path,
          this.database,
          value,
          extras,
        );
      } catch (error) {
        try {
          this.database.close();
        } catch {
          /* Migration already closed it. */
        }
        this.database = new DatabaseSync(this.path, { readOnly: true });
        throw error;
      }
      this.version = 2;
      this.writable = true;
      this.writer = new SaveStorageWriter(this.database);
      return;
    }
    if (!this.writable) {
      this.database.close();
      this.database = new DatabaseSync(this.path);
      this.database.exec(
        'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;',
      );
      this.writable = true;
      this.writer = new SaveStorageWriter(this.database);
    }
    this.writer!.write(value, extras);
  }
  close() {
    this.database.close();
  }
}
