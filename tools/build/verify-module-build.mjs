import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import {
  readFile,
  writeFile,
  mkdir,
  rm,
  cp,
  readdir,
  access,
  mkdtemp,
  copyFile,
} from 'node:fs/promises';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { buildProject } from './build.mjs';
import {
  buildUnit,
  validateCached,
  inventory,
  lock,
  discover,
} from './module-build.mjs';
import { assemble } from './assemble.mjs';
import { verificationOutput } from '../test/support/verification-output.mjs';
const output = verificationOutput('incremental-build-20261005', 'cache');
await mkdir(output, { recursive: true });
const report = { result: 'running', checks: [], timings: [], failures: [] };
const check = (name) => report.checks.push(name);
const digest = (units) =>
  Object.fromEntries(units.map((unit) => [unit.id, unit.files]));
const snapshot = await buildProject();
const initial = digest(snapshot.units);
const warm = await buildProject();
assert.ok(warm.units.every((unit) => unit.cached));
assert.deepEqual(digest(warm.units), initial);
check('Warm build validates and reuses all units');
assert.ok(
  snapshot.units
    .find((unit) => unit.id === 'game-pokemon-encounters-rules')
    .inputs.files.some(
      (file) => file.path === 'docs/games/pokemon-encounters/cards.json',
    ),
);
check('Cross-directory card data participates in fingerprint');
const entry = resolve('games/template/web/index.tsx'),
  source = await readFile(entry, 'utf8');
try {
  await writeFile(entry, source + '\n// independent build verification\n');
  const changed = await buildProject();
  assert.deepEqual(
    changed.units.filter((unit) => !unit.cached).map((unit) => unit.id),
    ['game-template-web'],
  );
  for (const unit of changed.units)
    if (unit.id !== 'game-template-web')
      assert.deepEqual(unit.files, initial[unit.id]);
  check('One real game web edit rebuilds only that game part');
} finally {
  await writeFile(entry, source);
}
const fixture = resolve('tmp/module-cache-fixture');
await mkdir(join(fixture, 'icons'), { recursive: true });
const fixtureEntry = join(fixture, 'entry.ts');
await writeFile(
  fixtureEntry,
  "export const icons=import.meta.glob(['./icons/*.svg','!./icons/excluded.svg'],{eager:true,query:'?url',import:'default'});\n",
);
const unit = {
  id: 'verification-glob-web',
  kind: 'web',
  entry: fixtureEntry,
  inputs: [fixtureEntry],
};
const empty = await buildUnit(unit);
await writeFile(
  join(fixture, 'icons/a.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg"/>',
);
const added = await buildUnit(unit);
assert.notEqual(added.fingerprint, empty.fingerprint);
assert.ok(added.files.some((file) => file.path.endsWith('.svg')));
await writeFile(
  join(fixture, 'icons/b.svg'),
  await readFile(join(fixture, 'icons/a.svg')),
);
await rm(join(fixture, 'icons/a.svg'));
const renamed = await buildUnit(unit);
assert.notEqual(renamed.fingerprint, added.fingerprint);
assert.ok(renamed.files.every((file) => !file.path.includes('a-')));
await rm(join(fixture, 'icons/b.svg'));
const deleted = await buildUnit(unit);
assert.equal(deleted.fingerprint, empty.fingerprint);
assert.ok(deleted.files.every((file) => !file.path.endsWith('.svg')));
check('Glob addition rename and deletion invalidate without stale assets');
const target = join(
  deleted.directory,
  'files',
  deleted.files.find((file) => file.path.endsWith('.js')).path,
);
await writeFile(target, 'corrupt');
await assert.rejects(() => validateCached(deleted.directory));
const repaired = await buildUnit(unit);
assert.equal(repaired.cached, false);
check('Corrupt cache is rebuilt and verified');
await assert.rejects(() => lock(unit.id, () => buildUnit(unit, true)), /busy/);
check('Concurrent writers are rejected by unit lock');
const newGame = resolve('games/fixture-incremental'),
  newAssets = resolve('assets/games/fixture-incremental');
for (const path of [newGame, newAssets])
  await assert.rejects(() => access(path), { code: 'ENOENT' });
try {
  await cp(resolve('games/template'), newGame, {
    recursive: true,
    filter: (path) => !path.includes('node_modules'),
  });
  await cp(resolve('assets/games/template'), newAssets, { recursive: true });
  async function replace(folder) {
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, item.name);
      if (item.isDirectory()) await replace(path);
      else if (/\.(tsx?|json)$/.test(path))
        await writeFile(
          path,
          (await readFile(path, 'utf8')).replaceAll(
            'template',
            'fixture-incremental',
          ),
        );
    }
  }
  await replace(newGame);
  const fixtureManifest = JSON.parse(
    await readFile(join(newGame, 'game-module.json'), 'utf8'),
  );
  fixtureManifest.internal = false;
  await writeFile(
    join(newGame, 'game-module.json'),
    JSON.stringify(fixtureManifest, null, 2) + '\n',
  );
  const extended = await buildProject();
  assert.equal((await discover()).length, 5);
  for (const built of extended.units)
    if (initial[built.id]) assert.deepEqual(built.files, initial[built.id]);
  check(
    'An additional manifest game builds without changing platform or previous game outputs',
  );
  const probe = await mkdtemp(resolve('tmp/new-game-probe-'));
  await copyFile(
    resolve('build/desktop/modules.json'),
    join(probe, 'modules.json'),
  );
  for (const part of ['games', 'bots'])
    await cp(resolve('build/desktop', part), join(probe, part), {
      recursive: true,
    });
  await build({
    entryPoints: [resolve('apps/server/src/game-registry.ts')],
    outfile: join(probe, 'registry.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  const registry = createRequire(import.meta.url)(
    join(probe, 'registry.cjs'),
  ).createGameRegistry();
  assert.equal(
    (await registry.load('fixture-incremental')).rules.manifest.id,
    'fixture-incremental',
  );
  assert.ok(
    JSON.parse(
      await readFile(resolve('build/desktop/web/catalog.json'), 'utf8'),
    ).some((item) => item.id === 'fixture-incremental'),
  );
  check(
    'Compiled generic registry loads the added game and assembled box catalog discovers it',
  );
  const invalid = JSON.parse(
    await readFile(join(newGame, 'game-module.json'), 'utf8'),
  );
  invalid.compatibility.webHost = 99;
  await writeFile(join(newGame, 'game-module.json'), JSON.stringify(invalid));
  await assert.rejects(() => buildProject(), /incompatible/);
  check('Incompatible manifest rejected');
} finally {
  for (const path of [newGame, newAssets]) {
    assert.ok(
      path.startsWith(resolve('.') + '\\') ||
        path.startsWith(resolve('.') + '/'),
    );
    await rm(path, { recursive: true, force: true });
  }
}
const restored = await buildProject();
const increment = await inventory(resolve('build/desktop'));
const full = await buildProject(['--full']);
assert.deepEqual(digest(full.units), digest(restored.units));
assert.deepEqual(await inventory(resolve('build/desktop')), increment);
check('Forced full and incremental actual assembled files are identical');
const bad = JSON.parse(await readFile(full.snapshotPath, 'utf8'));
bad.modules[0].compatibility.sdk = 99;
const badPath = join(output, 'incompatible-snapshot.json');
await writeFile(badPath, JSON.stringify(bad));
await assert.rejects(() => assemble(badPath), /Incompatible/);
assert.deepEqual(await inventory(resolve('build/desktop')), increment);
check('Failed assembly preserves the prior complete directory');
report.timings = snapshot.units.map((unit) => ({
  id: unit.id,
  cached: unit.cached,
  compileMs: unit.durationMs,
}));
report.result = 'passed';
await writeFile(
  join(output, 'results.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
