import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { discover, unitsFor, buildUnit, inputsFor } from './module-build.mjs';

test('every discovered runtime code unit obeys the production dependency policy', async () => {
  const units = await unitsFor(await discover(), undefined, {
    production: true,
  });
  const code = units.filter((u) => u.kind === 'node' || u.kind === 'web');
  assert.ok(code.length >= 28);
  for (const unit of code) await inputsFor(unit);
});

test('production server, game web and referenced resources build with enforced dependency and provenance inputs', async () => {
  const task = resolve(
    process.env.TABLEMAX_TEST_TMP ?? 'tmp/runtime-boundaries',
  );
  const units = await unitsFor(
    await discover('pokemon-encounters'),
    undefined,
    { production: true },
  );
  const selected = units.filter(
    (u) =>
      ['platform-server', 'game-pokemon-encounters-web'].includes(u.id) ||
      u.id.startsWith('game-pokemon-encounters-resources-'),
  );
  const result = [];
  for (const unit of selected) {
    // Production integration uses the normal content-addressed build cache. The
    // private efficiency fixture cache is intentionally unavailable to this test.
    const built = await buildUnit(unit);
    assert.ok(
      built.inputs.files.some(
        (f) => f.path === 'tools/build/dependency-boundaries.mjs',
      ),
    );
    if (unit.kind === 'resources') {
      assert.ok(
        built.files.every((f) => !f.path.endsWith('manifest.json')),
        'Provenance is build input, never runtime payload',
      );
      if (unit.resourceManifests?.length)
        assert.ok(
          built.inputs.files.some((f) =>
            f.path.endsWith('cinematic/manifest.json'),
          ),
        );
    }
    result.push({
      id: unit.id,
      fingerprint: built.fingerprint,
      files: built.files.length,
      bytes: built.files.reduce((n, f) => n + f.bytes, 0),
      resourceManifests: unit.resourceManifests ?? [],
    });
  }
  assert.equal(result.length, 4);
  await mkdir(task, { recursive: true });
  await writeFile(
    resolve(task, 'build-integration.json'),
    JSON.stringify(
      { result: 'passed', units: result, installer: false },
      null,
      2,
    ),
  );
});
