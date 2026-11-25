import { randomUUID } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export interface TrainingLease {
  version: 1;
  session: string;
  allowed: boolean;
  expiresAt: number;
}

export interface TrainingWorkerStatus {
  version: 1;
  session: string;
  stage: 'running' | 'paused' | 'candidate' | 'quota' | 'failed';
  writtenAt: number;
}

export function readTrainingControl(file: string): unknown {
  const directory = lstatSync(dirname(file), { throwIfNoEntry: false });
  if (!directory?.isDirectory() || directory.isSymbolicLink()) return undefined;
  const stats = lstatSync(file, { throwIfNoEntry: false });
  if (!stats?.isFile() || stats.isSymbolicLink() || stats.size > 4096)
    return undefined;
  const bytes = readFileSync(file);
  if (bytes.length > 4096) return undefined;
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return undefined;
  }
}

export function writeTrainingControl(
  file: string,
  value: TrainingLease | TrainingWorkerStatus,
) {
  const directory = dirname(file);
  const current = lstatSync(file, { throwIfNoEntry: false });
  const folder = lstatSync(directory, { throwIfNoEntry: false });
  if (
    !folder?.isDirectory() ||
    folder.isSymbolicLink() ||
    (current && (!current.isFile() || current.isSymbolicLink()))
  )
    throw new Error('Unsafe learning control path');
  const temporary = join(
    directory,
    '.training-control-' + randomUUID() + '.json',
  );
  writeFileSync(temporary, JSON.stringify(value), {
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
}

export function readTrainingLease(
  file: string,
  now = Date.now(),
): TrainingLease | undefined {
  try {
    const candidate = readTrainingControl(file) as
      Partial<TrainingLease> | undefined;
    if (
      candidate?.version !== 1 ||
      typeof candidate.session !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(candidate.session) ||
      typeof candidate.allowed !== 'boolean' ||
      !Number.isSafeInteger(candidate.expiresAt) ||
      candidate.expiresAt! <= now ||
      candidate.expiresAt! > now + 5000
    )
      return undefined;
    return candidate as TrainingLease;
  } catch {
    return undefined;
  }
}
