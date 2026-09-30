import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openFoundationDatabase } from './database';
import { DatabaseSync } from 'node:sqlite';

describe('SQLite runtime adapter', () => {
  it('commits a startup record and reads it after reopening', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tablemax-persistence-'));
    const first = openFoundationDatabase(dir);
    expect(first.starts).toBe(1);
    first.close();
    const second = openFoundationDatabase(dir);
    expect(second.starts).toBe(2);
    second.close();
  });
  it('rolls back the whole transaction when a write fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tablemax-rollback-'));
    const storage = openFoundationDatabase(dir);
    expect(() =>
      storage.transaction(() => {
        storage.database
          .prepare("UPDATE foundation SET value=99 WHERE key='starts'")
          .run();
        throw new Error('simulated failure');
      }),
    ).toThrow('simulated failure');
    expect(
      storage.database
        .prepare("SELECT value FROM foundation WHERE key='starts'")
        .get()?.value,
    ).toBe(1);
    storage.close();
  });
  it('preserves a damaged database instead of replacing it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tablemax-damage-'));
    const file = join(dir, 'foundation.sqlite');
    const original = Buffer.from('damaged database fixture');
    writeFileSync(file, original);
    expect(() => openFoundationDatabase(dir)).toThrow();
    expect(readFileSync(file)).toEqual(original);
  });
  it('refuses an incompatible format before modifying its database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tablemax-incompatible-'));
    const file = join(dir, 'foundation.sqlite');
    const fixture = new DatabaseSync(file);
    fixture.exec(
      'CREATE TABLE original (id INTEGER PRIMARY KEY); PRAGMA user_version = 99;',
    );
    fixture.close();
    const original = readFileSync(file);
    expect(() => openFoundationDatabase(dir)).toThrow(
      'Unsupported foundation database version',
    );
    expect(readFileSync(file)).toEqual(original);
  });
});
