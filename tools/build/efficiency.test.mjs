import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
import { createReadPhase } from './read-phase.mjs';
import { parseBuildJobs, runUnitPool } from './unit-scheduler.mjs';

test('jobs validation rejects malformed and duplicate values before work', () => {
  assert.equal(parseBuildJobs([]), 1);
  for (const jobs of [1, 2, 4])
    assert.equal(parseBuildJobs([`--jobs=${jobs}`]), jobs);
  for (const args of [
    ['--jobs'],
    ['--jobs=3'],
    ['--jobs=02'],
    ['--jobs=2x'],
    ['--jobs=2', '--jobs=1'],
  ])
    assert.throws(() => parseBuildJobs(args), /--jobs/);
  const rejected = spawnSync(
    process.execPath,
    ['tools/build/build.mjs', '--jobs=3'],
    {
      cwd: resolve('.'),
      env: { ...process.env, TABLEMAX_AUTO_MAINTENANCE: '0' },
      windowsHide: true,
      encoding: 'utf8',
    },
  );
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /--jobs must be exactly/);
});

test('desktop units serialize, pool is bounded and results retain freeze order', async () => {
  const units = [
    { id: 'web', kind: 'web' },
    { id: 'node', kind: 'runtime' },
    { id: 'native', kind: 'native' },
    ...['a', 'b', 'c', 'd'].map((id) => ({ id, kind: 'node' })),
  ];
  const events = [];
  let active = 0,
    maximum = 0;
  const results = await runUnitPool(units, {
    jobs: 2,
    run: async (unit) => {
      events.push('start:' + unit.id);
      maximum = Math.max(maximum, ++active);
      if (['runtime', 'native'].includes(unit.kind)) assert.equal(active, 1);
      await setTimeout(unit.id === 'a' ? 12 : 3);
      active -= 1;
      events.push('end:' + unit.id);
      return unit.id;
    },
  });
  assert.equal(maximum, 2);
  assert.deepEqual(events.slice(0, 4), [
    'start:node',
    'end:node',
    'start:native',
    'end:native',
  ]);
  assert.deepEqual(
    results,
    units.map((unit) => unit.id),
  );
});

test('failure drains in-flight work and never starts remaining units', async () => {
  const finished = [],
    started = [];
  await assert.rejects(
    runUnitPool(
      ['bad', 'slow', 'unstarted'].map((id) => ({ id, kind: 'node' })),
      {
        jobs: 2,
        run: async ({ id }) => {
          started.push(id);
          await setTimeout(id === 'bad' ? 2 : 20);
          if (id === 'bad') throw new Error('fixture failure');
          finished.push(id);
        },
      },
    ),
    /fixture failure/,
  );
  assert.deepEqual(started, ['bad', 'slow']);
  assert.deepEqual(finished, ['slow']);
});

test('read/hash/parse memoization ends at the next verification phase', async () => {
  const directory = await mkdtemp(resolve('tmp/efficiency-build-'));
  const file = join(directory, 'input.ts');
  await writeFile(file, 'before');
  const first = createReadPhase('before');
  const initial = await first.sha(file);
  assert.equal(first.stats.timingKind, 'cumulative-activity-ms');
  const inputTimings = [first.stats.readMs, first.stats.hashMs];
  for (const elapsed of inputTimings)
    assert.ok(Number.isFinite(elapsed) && elapsed > 0);
  await Promise.all([first.read(file), first.sha(file), first.sha(file)]);
  assert.deepEqual([first.stats.readMs, first.stats.hashMs], inputTimings);
  let parsed = 0;
  const parse = () => ++parsed;
  const initialParse = first.parse(file, 'before', parse);
  const parseMs = first.stats.parseMs;
  assert.ok(Number.isFinite(parseMs) && parseMs > 0);
  assert.equal(first.parse(file, 'before', parse), initialParse);
  assert.equal(first.stats.parseMs, parseMs);
  await writeFile(file, 'after');
  assert.equal(await first.sha(file), initial);
  assert.deepEqual([first.stats.readMs, first.stats.hashMs], inputTimings);
  const after = createReadPhase('after');
  assert.notEqual(await after.sha(file), initial);
  assert.ok(after.stats.readMs > 0 && after.stats.hashMs > 0);
  assert.equal(after.stats.parseMs, 0);
  await writeFile(file, '{"stage":"json"}');
  const jsonPhase = createReadPhase('json');
  assert.deepEqual(await jsonPhase.json(file), { stage: 'json' });
  assert.ok(jsonPhase.stats.parseMs > 0);
  assert.deepEqual(
    [first.stats.reads, first.stats.hashes, first.stats.parses],
    [1, 1, 1],
  );
});
