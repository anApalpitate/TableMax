import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  buildUnit,
  validateCached,
  validateInputs,
  inputsFor,
} from './module-build.mjs';
import { createReadPhase } from './read-phase.mjs';

test('runtime declaration closure, fresh boundary and cache recovery use real isolated compilation', async () => {
  await mkdir('tmp', { recursive: true });
  const directory = await mkdtemp(resolve('tmp/efficiency-build-'));
  const cacheRoot = join(directory, 'cache');
  const entry = join(directory, 'entry.ts'),
    runtime = join(directory, 'value.mjs');
  await writeFile(entry, "export {value} from './value.mjs';");
  await writeFile(runtime, 'export const value=1;');
  await writeFile(
    join(directory, 'value.d.mts'),
    'export declare const value:number;',
  );
  const unit = {
    id: 'efficiency-runtime-boundary',
    kind: 'node',
    entry,
    output: 'fixture.cjs',
    inputs: [entry],
  };
  const first = await buildUnit(unit, false, { cacheRoot });
  assert.ok(first.inputs.files.some((file) => resolve(file.path) === runtime));
  assert.ok(
    first.inputs.files.some(
      (file) => resolve(file.path) === join(directory, 'value.d.mts'),
    ),
  );
  const phase = createReadPhase('old-inputs');
  await validateInputs(first, phase);
  await writeFile(runtime, 'export const value=2;');
  await assert.rejects(validateInputs(first), /Inputs changed/);
  const changed = await buildUnit(unit, false, { cacheRoot });
  assert.notEqual(changed.fingerprint, first.fingerprint);
  const warm = await buildUnit(unit, false, { cacheRoot });
  assert.equal(warm.cached, true);
  assert.equal(warm.originalBuildDurationMs, changed.durationMs);
  assert.ok(warm.timings.cacheVerificationMs > 0);
  await writeFile(join(changed.directory, 'files/fixture.cjs'), 'corrupt');
  await assert.rejects(
    validateCached(changed.directory),
    /Corrupt build cache/,
  );
  const repaired = await buildUnit(unit, false, { cacheRoot });
  assert.equal(repaired.cached, false);
  assert.deepEqual(repaired.files, changed.files);
  await writeFile(runtime, 'export const value=;');
  await assert.rejects(buildUnit(unit, false, { cacheRoot }));
  await validateCached(repaired.directory);
  assert.equal(
    (
      await readFile(join(repaired.directory, 'files/fixture.cjs'), 'utf8')
    ).includes('corrupt'),
    false,
  );
});

test('fresh verification detects glob membership and separately bound media bytes', async () => {
  const directory = await mkdtemp(resolve('tmp/efficiency-build-'));
  await mkdir(join(directory, 'media'));
  const entry = join(directory, 'entry.ts'),
    image = join(directory, 'media/one.webp');
  await writeFile(
    entry,
    "export const images=import.meta.glob('./media/*.webp');",
  );
  await writeFile(image, Buffer.from([1, 2, 3]));
  const web = {
    id: 'efficiency-glob-web',
    kind: 'web',
    module: { id: 'probe', compatibility: {} },
    inputs: [entry],
  };
  const resources = {
    ...web,
    id: 'efficiency-glob-resources',
    kind: 'resources',
    inputs: [image],
  };
  const record = { id: web.id, inputs: await inputsFor(web) };
  const mediaRecord = { id: resources.id, inputs: await inputsFor(resources) };
  await writeFile(image, Buffer.from([4, 5, 6]));
  await validateInputs(record);
  await assert.rejects(validateInputs(mediaRecord), /Inputs changed/);
  await writeFile(join(directory, 'media/two.webp'), Buffer.from([7]));
  await assert.rejects(validateInputs(record), /Glob changed/);
});
