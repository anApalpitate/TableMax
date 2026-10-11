import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { cachePlanHash, consumeCachePlan } from './cache-plan.mjs';

test('frozen cache preview rejects altered plans, retention drift, duplicate and escaping candidates', () => {
  const base = resolve('.cache/build-modules/v1'),
    retained = new Set(['platform-box/' + 'b'.repeat(64)]),
    references = [{ path: 'current.json', sha256: 'c'.repeat(64) }];
  const key = 'platform-box/' + 'a'.repeat(64);
  const candidate = {
    key,
    path: resolve(base, key),
    files: [],
    newest: 1,
    mtime: 1,
  };
  const plan = {
    schemaVersion: 1,
    retained: [...retained].sort(),
    references,
    candidates: [candidate],
  };
  const check = (value, context = { base, retained, references }) => {
    const bytes = Buffer.from(JSON.stringify(value));
    return consumeCachePlan(bytes, cachePlanHash(bytes), context);
  };
  assert.equal(check(plan).length, 1);
  assert.throws(
    () =>
      consumeCachePlan(Buffer.from('{}'), 'a'.repeat(64), {
        base,
        retained,
        references,
      }),
    /hash mismatch/,
  );
  assert.throws(
    () => check(plan, { base, retained, references: [] }),
    /retention inputs/,
  );
  assert.throws(
    () => check(plan, { base, retained: new Set(), references }),
    /retention inputs/,
  );
  assert.throws(
    () => check({ ...plan, candidates: [candidate, candidate] }),
    /candidate/,
  );
  assert.throws(
    () =>
      check({
        ...plan,
        candidates: [{ ...candidate, path: resolve('tmp/outside') }],
      }),
    /candidate/,
  );
  assert.throws(
    () =>
      check({
        ...plan,
        candidates: [
          {
            ...candidate,
            key: [...retained][0],
            path: resolve(base, [...retained][0]),
          },
        ],
      }),
    /candidate/,
  );
});
