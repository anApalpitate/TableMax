import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import type { LearningEvent } from '../../../packages/platform-core/src/bot-learning';

type Decision = Extract<LearningEvent, { type: 'decision' }>;

export function unoReviewKey(
  row: Pick<Decision, 'instanceId' | 'branch' | 'revision' | 'seat'>,
) {
  return JSON.stringify([row.instanceId, row.branch, row.revision, row.seat]);
}

export function readUnoHumanReview(path: string, inputDigest: string) {
  const limit = 1024 * 1024;
  const file = lstatSync(path);
  if (!file.isFile() || file.isSymbolicLink() || file.size > limit)
    throw new Error('UNO human review must be a bounded local file');
  const bytes = readFileSync(path);
  if (bytes.length > limit)
    throw new Error('UNO human review grew during read');
  return parseUnoHumanReview(bytes, inputDigest);
}

export function parseUnoHumanReview(bytes: Buffer, inputDigest: string) {
  const report = JSON.parse(bytes.toString('utf8'));
  if (
    report?.type !== 'uno-human-source-review' ||
    report.version !== 1 ||
    report.inputDigest !== inputDigest ||
    !Array.isArray(report.decisions)
  )
    throw new Error(
      'UNO human review must identify the exact frozen decision log',
    );
  const reviewed = new Set<string>();
  for (const row of report.decisions) {
    if (
      typeof row?.instanceId !== 'string' ||
      !row.instanceId ||
      !Number.isSafeInteger(row.branch) ||
      row.branch < 0 ||
      !Number.isSafeInteger(row.revision) ||
      row.revision < 1 ||
      !Number.isSafeInteger(row.seat) ||
      row.seat < 0 ||
      row.seat >= 4 ||
      typeof row.evidenceRef !== 'string' ||
      !row.evidenceRef.trim() ||
      row.evidenceRef.length > 256
    )
      throw new Error(
        'Invalid decision identity or evidence reference in UNO human review',
      );
    const key = unoReviewKey(row);
    if (reviewed.has(key))
      throw new Error('Duplicate decision in UNO human review');
    reviewed.add(key);
  }
  return {
    digest: createHash('sha256').update(bytes).digest('hex'),
    reviewed,
  };
}
