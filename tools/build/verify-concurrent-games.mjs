import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import {
  discover,
  unitsFor,
  buildUnit,
  validateInputs,
} from './module-build.mjs';
const run = promisify(execFile);
const ids = ['uno', 'rummikub'];
const evidence = resolve(
  'artifacts/game-packages/v1.0.6/concurrent-build-proof.json',
);
const results = await Promise.all(
  ids.map(async (id) => {
    const started = Date.now();
    const { stdout } = await run(
      process.execPath,
      ['tools/build/build.mjs', `--only=game:${id}`],
      { cwd: resolve('.'), windowsHide: true, maxBuffer: 1024 * 1024 },
    );
    return { id, started, ended: Date.now(), stdout };
  }),
);
assert.ok(
  Math.max(...results.map((item) => item.started)) <
    Math.min(...results.map((item) => item.ended)),
  'Build processes did not overlap',
);
const outputs = [];
for (const id of ids) {
  const modules = await discover(id),
    units = (await unitsFor(modules)).filter((unit) => unit.module);
  for (const unit of units) {
    const result = await buildUnit(unit);
    assert.ok(result.cached);
    await validateInputs(result);
    outputs.push({
      id: result.id,
      directory: result.directory,
      fingerprint: result.fingerprint,
    });
  }
}
assert.equal(
  new Set(outputs.map((item) => item.directory.toLowerCase())).size,
  outputs.length,
  'Concurrent outputs collided',
);
await mkdir(resolve('artifacts/game-packages/v1.0.6'), { recursive: true });
await writeFile(
  evidence,
  JSON.stringify(
    {
      passed: true,
      processes: results,
      outputs,
      verifiedAtUtc: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    passed: true,
    gameIds: ids,
    independentUnits: outputs.length,
    evidence,
  }),
);
