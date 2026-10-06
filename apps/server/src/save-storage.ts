import { DatabaseSync } from 'node:sqlite';
import type { Save, SaveExtras } from '@tablemax/platform-core';
import {
  readCurrentSave,
  storageHash,
} from '../../../scripts/lib/save-audit.mjs';

export function createSaveStorage(database: DatabaseSync) {
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE saves(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL) STRICT;
    CREATE TABLE journal(instance TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(instance,revision)) STRICT;
    CREATE TABLE checkpoint_nodes(id TEXT PRIMARY KEY,instance TEXT NOT NULL,checkpoint_id TEXT NOT NULL,previous TEXT REFERENCES checkpoint_nodes(id),data TEXT NOT NULL) STRICT;
    CREATE INDEX checkpoint_identity ON checkpoint_nodes(instance,checkpoint_id);
    CREATE TABLE receipt_nodes(id TEXT PRIMARY KEY,previous TEXT REFERENCES receipt_nodes(id),data TEXT NOT NULL) STRICT;
    CREATE TABLE avatar_images(id TEXT PRIMARY KEY,png BLOB NOT NULL) STRICT;
    PRAGMA user_version=2;
  `);
}

interface ReceiptCache {
  head: string | null;
  values: Map<string, string>;
}
const emptyReceipts = (): ReceiptCache => ({ head: null, values: new Map() });
export class SaveStorageWriter {
  private receipts = emptyReceipts();
  private sessions = emptyReceipts();
  private checkpoints = new WeakMap<
    Save['history'][number],
    { instance: string; previous: string | null; data: string; id: string }
  >();
  private knownCheckpoints = new Set<string>();
  constructor(private database: DatabaseSync) {
    const row = database.prepare('SELECT data FROM saves WHERE id=1').get();
    if (!row) return;
    const value = readCurrentSave(database) as Save;
    const stored = JSON.parse(String(row.data));
    if (stored._storage === 2) {
      this.receipts = {
        head: stored.receiptsHead,
        values: this.entries(value.receipts),
      };
      this.sessions = {
        head: stored.sessionReceiptsHead,
        values: this.entries(value.sessionReceipts ?? {}),
      };
    }
  }
  private entries(values: Record<string, unknown>) {
    return new Map(
      Object.entries(values).map(([key, value]) => [
        key,
        JSON.stringify(value),
      ]),
    );
  }
  private receiptHead(
    values: Record<string, unknown>,
    previous: ReceiptCache,
  ): ReceiptCache {
    const current = this.entries(values);
    const changes: Record<string, unknown> = {};
    const deleted = [...previous.values.keys()].filter(
      (key) => !current.has(key),
    );
    for (const [key, json] of current)
      if (previous.values.get(key) !== json)
        Object.defineProperty(changes, key, {
          value: JSON.parse(json),
          enumerable: true,
        });
    if (!deleted.length && !Object.keys(changes).length)
      return { head: previous.head, values: current };
    // Empty dictionaries start a fresh chain instead of accumulating reset tombstones.
    if (!current.size) return emptyReceipts();
    const data = JSON.stringify({ set: changes, deleted });
    const head = storageHash(JSON.stringify({ previous: previous.head, data }));
    this.database
      .prepare(
        'INSERT INTO receipt_nodes(id,previous,data) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',
      )
      .run(head, previous.head, data);
    return { head, values: current };
  }
  write(value: Save, extras?: SaveExtras, journal = true) {
    let receiptCache = this.receipts;
    let sessionCache = this.sessions;
    const addedCheckpoints = new Set<string>();
    this.database.exec('BEGIN IMMEDIATE');
    try {
      for (const avatar of extras?.avatars ?? [])
        this.database
          .prepare(
            'INSERT INTO avatar_images(id,png) VALUES(?,?) ON CONFLICT(id) DO NOTHING',
          )
          .run(avatar.id, avatar.png);
      for (const saved of [...(extras?.journal ?? []), value]) {
        if (
          saved.formatVersion !== 1 ||
          !Array.isArray(saved.history) ||
          !saved.receipts
        )
          throw new Error('damaged-save');
        let previous: string | null = null;
        for (const checkpoint of saved.history) {
          const data = JSON.stringify(checkpoint);
          const cached = this.checkpoints.get(checkpoint);
          const id: string =
            cached &&
            cached.instance === saved.instanceId &&
            cached.previous === previous &&
            cached.data === data
              ? cached.id
              : storageHash(
                  JSON.stringify({
                    instance: saved.instanceId,
                    previous,
                    data,
                  }),
                );
          if (!this.knownCheckpoints.has(id) && !addedCheckpoints.has(id)) {
            this.database
              .prepare(
                'INSERT INTO checkpoint_nodes(id,instance,checkpoint_id,previous,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
              )
              .run(id, saved.instanceId, checkpoint.id, previous, data);
            addedCheckpoints.add(id);
          }
          this.checkpoints.set(checkpoint, {
            instance: saved.instanceId,
            previous,
            data,
            id,
          });
          previous = id;
        }
        receiptCache = this.receiptHead(saved.receipts, receiptCache);
        sessionCache = this.receiptHead(
          saved.sessionReceipts ?? {},
          sessionCache,
        );
        const { history, receipts, sessionReceipts, ...metadata } = saved;
        const json = JSON.stringify({
          _storage: 2,
          value: metadata,
          historyHead: previous,
          historyLength: history.length,
          receiptsHead: receiptCache.head,
          hasSessionReceipts: sessionReceipts !== undefined,
          sessionReceiptsHead: sessionCache.head,
        });
        if (journal)
          this.database
            .prepare(
              'INSERT INTO journal(instance,revision,data) VALUES(?,?,?)',
            )
            .run(saved.instanceId, saved.revision, json);
        if (saved === value)
          this.database
            .prepare(
              'INSERT INTO saves(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
            )
            .run(json);
        void receipts;
      }
      this.database.exec('COMMIT');
      this.receipts = receiptCache;
      this.sessions = sessionCache;
      for (const id of addedCheckpoints) this.knownCheckpoints.add(id);
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}
