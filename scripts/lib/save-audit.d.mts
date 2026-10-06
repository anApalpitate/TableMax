import type { DatabaseSync } from 'node:sqlite';
export function storageHash(text: string): string;
export function decodeSave(database: DatabaseSync, data: unknown): unknown;
export function readCurrentSave(database: DatabaseSync): unknown | null;
export function readJournalSave(
  database: DatabaseSync,
  rowid: number,
): unknown | null;
