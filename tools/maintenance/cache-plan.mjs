import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';

export const cachePlanHash = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export function consumeCachePlan(
  bytes,
  expectedHash,
  { base, retained, references },
) {
  if (
    !/^[a-f0-9]{64}$/.test(expectedHash ?? '') ||
    cachePlanHash(bytes) !== expectedHash
  )
    throw new Error('Cache preview plan hash mismatch');
  const plan = JSON.parse(bytes);
  if (
    plan.schemaVersion !== 1 ||
    JSON.stringify(plan.retained) !== JSON.stringify([...retained].sort()) ||
    JSON.stringify(plan.references) !== JSON.stringify(references)
  )
    throw new Error('Cache retention inputs changed after preview');
  if (!Array.isArray(plan.candidates))
    throw new Error('Missing cache candidates');
  const seen = new Set();
  for (const candidate of plan.candidates) {
    if (
      !/^[a-z][a-z0-9-]*\/[a-f0-9]{64}$/.test(candidate.key) ||
      resolve(candidate.path) !== resolve(base, candidate.key) ||
      !resolve(candidate.path).startsWith(resolve(base) + sep) ||
      retained.has(candidate.key) ||
      seen.has(candidate.key) ||
      !Array.isArray(candidate.files) ||
      !Number.isFinite(candidate.newest) ||
      !Number.isFinite(candidate.mtime)
    )
      throw new Error('Invalid or protected cache candidate');
    seen.add(candidate.key);
  }
  return plan.candidates;
}
