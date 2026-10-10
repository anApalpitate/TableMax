import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { buildUnit } from './module-build.mjs';

const name = process.argv[2];
assert.equal(process.argv.length, 3);
assert.match(name, /^[a-zA-Z0-9_-]+$/);
const output = resolve(
  'artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006',
  name,
);
await mkdir(output, { recursive: false });
const fixture = await mkdtemp(resolve('tmp/module-runtime-input-'));
const entry = join(fixture, 'entry.ts'),
  runtime = join(fixture, 'value.mjs');
await writeFile(entry, "export {value} from './value.mjs';\n");
await writeFile(runtime, 'export const value = 1;\n');
await writeFile(
  join(fixture, 'value.d.mts'),
  'export declare const value: number;\n',
);
const unit = {
  id: 'verification-runtime-input',
  kind: 'node',
  entry,
  output: 'fixture.cjs',
  inputs: [entry],
};
const report = {
  result: 'running',
  scope:
    'Isolated incremental-build regression: typed .mjs must fingerprint its runtime implementation as well as adjacent declaration; no full build or official package.',
};
try {
  const before = await buildUnit(unit);
  report.inputs = before.inputs.files;
  assert.ok(
    before.inputs.files.some((file) => resolve(file.path) === runtime),
    'Runtime .mjs is absent when TS resolves the adjacent .d.mts',
  );
  await writeFile(runtime, 'export const value = 2;\n');
  const after = await buildUnit(unit);
  assert.notEqual(after.fingerprint, before.fingerprint);
  assert.equal(after.cached, false);
  const require = createRequire(import.meta.url);
  assert.equal(require(join(after.directory, 'files/fixture.cjs')).value, 2);
  const warm = await buildUnit(unit);
  assert.equal(warm.cached, true);
  assert.deepEqual(warm.files, after.files);
  report.result = 'passed';
  report.runtimeChangeInvalidatesCache = true;
  report.unchangedRuntimeReusesCache = true;
  report.originalOutputBytes = (
    await readFile(join(before.directory, 'files/fixture.cjs'))
  ).length;
} catch (error) {
  report.result = 'failed';
  report.error = error.stack;
  throw error;
} finally {
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  process.stdout.write(
    JSON.stringify({ result: report.result, output }) + '\n',
  );
}
