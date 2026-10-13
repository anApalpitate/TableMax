import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundedPush, summarize, SAMPLE_LIMIT } from './summary.mjs';

test('bounded samples reject invalid values and retain only the latest 256', () => {
  const values = [];
  for (let index = 0; index < 300; index++) boundedPush(values, index);
  for (const invalid of [-1, NaN, Infinity]) boundedPush(values, invalid);
  assert.equal(values.length, SAMPLE_LIMIT);
  assert.equal(values[0], 44);
  assert.deepEqual(summarize(values), {
    samples: 256,
    p50: 171,
    p95: 287,
    max: 299,
  });
});
test('empty and one-sample measurements do not fabricate percentiles', () => {
  assert.deepEqual(summarize([]), {
    samples: 0,
    p50: null,
    p95: null,
    max: null,
  });
  assert.deepEqual(summarize([5]), { samples: 1, p50: 5, p95: 5, max: 5 });
});
