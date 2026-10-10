import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const [mode, modulePath, fixturePath] = process.argv.slice(2);
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const copy =
  mode === 'baseline'
    ? structuredClone
    : (await import(pathToFileURL(modulePath).href)).copySave;
assert.equal(typeof global.gc, 'function', 'Run the probe with --expose-gc');
let check = copy(fixture);
assert.deepEqual(check, fixture);
if (mode !== 'baseline') assert.equal(check.history[0], fixture.history[0]);
// eslint-disable-next-line no-useless-assignment -- Release the checked clone before the measured GC baseline.
check = null;
global.gc();
const start = process.memoryUsage();
let peakHeap = start.heapUsed;
let peakRss = start.rss;
let peakAddedHeap = 0;
let checksum = 0;
const timings = [];
for (let index = 0; index < 60; index++) {
  global.gc();
  const before = process.memoryUsage().heapUsed;
  const started = performance.now();
  let result = copy(fixture);
  timings.push(performance.now() - started);
  const sample = process.memoryUsage();
  peakHeap = Math.max(peakHeap, sample.heapUsed);
  peakRss = Math.max(peakRss, sample.rss);
  peakAddedHeap = Math.max(peakAddedHeap, sample.heapUsed - before);
  checksum += result.history.length + result.seats.length;
  // eslint-disable-next-line no-useless-assignment -- Do not retain the previous clone across forced GC iterations.
  result = null;
}
global.gc();
const ordered = [...timings].sort((a, b) => a - b);
console.log(
  JSON.stringify({
    mode,
    iterations: timings.length,
    checksum,
    initialHeapBytes: start.heapUsed,
    peakSampledHeapBytes: peakHeap,
    peakAddedHeapBytes: peakAddedHeap,
    peakSampledRssBytes: peakRss,
    finalHeapBytes: process.memoryUsage().heapUsed,
    medianCopyMs: ordered[Math.floor(ordered.length / 2)],
    p95CopyMs: ordered[Math.floor(ordered.length * 0.95)],
    totalCopyMs: timings.reduce((sum, value) => sum + value, 0),
  }),
);
