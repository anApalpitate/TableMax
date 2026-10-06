import { createHash } from 'node:crypto';

export const storageHash = (text) =>
  createHash('sha256').update(text).digest('hex');
const damaged = () => new Error('damaged-save-storage');
function parse(text) {
  try {
    return JSON.parse(String(text));
  } catch {
    throw new Error('damaged-save-json');
  }
}
const assign = (target, key, value) =>
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });

/** Reconstruct one historical format-1 Save without changing the database. */
export function decodeSave(database, data) {
  const stored = parse(data);
  if (stored?._storage !== 2) return stored;
  const value = stored.value;
  if (
    !value ||
    typeof value.instanceId !== 'string' ||
    !Number.isSafeInteger(stored.historyLength) ||
    stored.historyLength < 0
  )
    throw damaged();
  const history = [];
  const visited = new Set();
  let head = stored.historyHead;
  while (head !== null) {
    if (typeof head !== 'string' || visited.has(head)) throw damaged();
    visited.add(head);
    const row = database
      .prepare('SELECT instance,previous,data FROM checkpoint_nodes WHERE id=?')
      .get(head);
    if (
      !row ||
      row.instance !== value.instanceId ||
      storageHash(
        JSON.stringify({
          instance: row.instance,
          previous: row.previous,
          data: row.data,
        }),
      ) !== head
    )
      throw damaged();
    history.push(parse(row.data));
    head = row.previous;
  }
  if (history.length !== stored.historyLength) throw damaged();
  history.reverse();
  function receipts(start) {
    const deltas = [];
    const seen = new Set();
    let id = start;
    while (id !== null) {
      if (typeof id !== 'string' || seen.has(id)) throw damaged();
      seen.add(id);
      const row = database
        .prepare('SELECT previous,data FROM receipt_nodes WHERE id=?')
        .get(id);
      if (
        !row ||
        storageHash(
          JSON.stringify({ previous: row.previous, data: row.data }),
        ) !== id
      )
        throw damaged();
      const delta = parse(row.data);
      if (
        !delta ||
        typeof delta.set !== 'object' ||
        !Array.isArray(delta.deleted)
      )
        throw damaged();
      deltas.push(delta);
      id = row.previous;
    }
    const result = {};
    for (const delta of deltas.reverse()) {
      for (const key of delta.deleted) delete result[key];
      for (const [key, receipt] of Object.entries(delta.set))
        assign(result, key, receipt);
    }
    return result;
  }
  const save = {
    ...value,
    history,
    receipts: receipts(stored.receiptsHead),
  };
  if (stored.hasSessionReceipts)
    save.sessionReceipts = receipts(stored.sessionReceiptsHead);
  return save;
}
export function readCurrentSave(database) {
  const row = database.prepare('SELECT data FROM saves WHERE id=1').get();
  return row ? decodeSave(database, row.data) : null;
}
export function readJournalSave(database, rowid) {
  const row = database
    .prepare('SELECT data FROM journal WHERE rowid=?')
    .get(rowid);
  return row ? decodeSave(database, row.data) : null;
}
