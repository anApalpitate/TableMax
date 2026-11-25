import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const learningJobByteLimit = 96 * 1024 * 1024;
export const learningModelByteLimit = 32 * 1024 * 1024;

export function assertLearningBudget(
  directory: string,
  newBytes: number,
  limit: number,
): void {
  if (
    !Number.isSafeInteger(newBytes) ||
    newBytes < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    newBytes > limit
  )
    throw new Error('UNO_LEARNING_QUOTA');
  const pending = [directory];
  let total = newBytes;
  while (pending.length) {
    const current = pending.pop()!;
    const stats = lstatSync(current);
    if (stats.isSymbolicLink())
      throw new Error('Linked learning storage is protected');
    if (stats.isDirectory()) {
      for (const child of readdirSync(current))
        pending.push(join(current, child));
    } else if (stats.isFile()) {
      total += stats.size;
      if (total > limit) throw new Error('UNO_LEARNING_QUOTA');
    } else {
      throw new Error('Invalid learning storage entry');
    }
  }
}
