import { createHash, randomUUID } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

const byteLimit = 32 * 1024 * 1024;

function hash(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function checkpointBytes(file: string) {
  const item = lstatSync(file, { throwIfNoEntry: false });
  if (!item) return undefined;
  if (!item.isFile() || item.isSymbolicLink() || item.size > byteLimit)
    throw new Error('Invalid or oversized training checkpoint');
  const bytes = readFileSync(file);
  if (bytes.length > byteLimit)
    throw new Error('Training checkpoint grew during read');
  return bytes;
}

/** One local writer, with an input-bound checkpoint surviving completed work. */
export function openTrainingCheckpoint<State>(
  path: string,
  identity: string,
  initial: State,
) {
  const file = resolve(path);
  const parent = lstatSync(dirname(file));
  if (!parent.isDirectory() || parent.isSymbolicLink())
    throw new Error('Training checkpoint directory must be local');
  const bytes = checkpointBytes(file);
  let expected = bytes && hash(bytes);
  const record = bytes
    ? (JSON.parse(bytes.toString('utf8')) as {
        version: number;
        identity: string;
        state: State;
      })
    : null;
  if (
    record &&
    (record.version !== 1 || record.identity !== identity || !record.state)
  )
    throw new Error('Training checkpoint belongs to different frozen inputs');
  return {
    state: record?.state ?? initial,
    save(state: State) {
      const next = Buffer.from(JSON.stringify({ version: 1, identity, state }));
      if (next.length > byteLimit)
        throw new Error('Training checkpoint quota reached');
      const lock = file + '.lock';
      mkdirSync(lock);
      try {
        const current = checkpointBytes(file);
        if ((current && hash(current)) !== expected)
          throw new Error('Training checkpoint changed since it was opened');
        const temporary = file + '.' + randomUUID() + '.tmp';
        writeFileSync(temporary, next, {
          flag: 'wx',
          flush: true,
          mode: 0o600,
        });
        try {
          renameSync(temporary, file);
        } catch (error) {
          unlinkSync(temporary);
          throw error;
        }
        expected = hash(next);
      } finally {
        rmdirSync(lock);
      }
    },
  };
}
