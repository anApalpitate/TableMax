import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  buildUnit,
  validateCached,
  validateInputs,
  discover,
} from './module-build.mjs';
await mkdir('tmp', { recursive: true });
const folder = await mkdtemp(resolve('tmp/cache-failures-'));
const entry = join(folder, 'entry.ts');
const source = 'export const value=7;\n';
await writeFile(entry, source);
const unit = {
  id: 'verification-race-node',
  kind: 'node',
  entry,
  output: 'test.cjs',
  inputs: [entry],
};
const original = await buildUnit(unit);
const checks = [];
await assert.rejects(
  () => buildUnit({ ...unit, id: '../../outside' }),
  /Invalid build unit id/,
);
checks.push('Invalid unit paths are rejected before filesystem mutations');
await writeFile(entry, 'export const value=;');
await assert.rejects(
  () => validateInputs(original),
  /Inputs changed before snapshot/,
);
checks.push('An earlier unit changed before freezing is rejected');
await assert.rejects(() => buildUnit(unit));
await validateCached(original.directory);
checks.push('Compilation failure preserves the previous valid product');
const template = (await discover()).find((item) => item.id === 'template');
await assert.rejects(
  () =>
    buildUnit(
      {
        id: 'verification-stale-metadata',
        kind: 'metadata',
        module: { ...template, order: 999 },
        inputs: ['games/template/game-module.json'],
      },
      true,
    ),
  /descriptor changed/,
);
checks.push(
  'Stale module descriptors cannot be cached under newer source inputs',
);
await writeFile(
  entry,
  source +
    'export const large=[' +
    Array.from({ length: 100000 }, (_, index) => index).join(',') +
    '];\n',
);
let changed = false,
  error;
const timer = setInterval(async () => {
  if (changed) return;
  const work = await readdir(resolve('.cache/build-modules/v1/work'));
  if (work.some((name) => name.startsWith(unit.id + '-'))) {
    changed = true;
    await writeFile(entry, source + '// changed while compiling\n');
  }
}, 2);
try {
  await buildUnit(unit, true);
} catch (value) {
  error = value;
} finally {
  clearInterval(timer);
}
assert.ok(changed);
assert.match(String(error), /Inputs changed during build/);
await validateCached(original.directory);
checks.push('Source changing during compilation is not published');
await writeFile(entry, source);
const contract = resolve('packages/web-host/src/types.ts'),
  before = await readFile(contract, 'utf8');
try {
  await writeFile(
    contract,
    before + '\n// shared contract fingerprint verification\n',
  );
  const changedContract = await buildUnit(unit);
  assert.notEqual(changedContract.fingerprint, original.fingerprint);
  checks.push('Shared type contract invalidates dependent cache');
} finally {
  await writeFile(contract, before);
}
assert.equal((await buildUnit(unit)).cached, true);
const output = resolve(
  'artifacts/maintenance/v1.0.4/incremental-build-20261005/cache',
);
await mkdir(output, { recursive: true });
await writeFile(
  join(output, 'failure-boundaries.json'),
  JSON.stringify({ result: 'passed', checks }, null, 2) + '\n',
);
console.log(JSON.stringify({ result: 'passed', checks }));
