import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import {
  discover,
  unitsFor,
  buildUnit,
  json,
  lock,
  validateInputs,
} from './module-build.mjs';
import { assemble } from './assemble.mjs';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { scheduleMaintenance } from '../maintenance/lifecycle.mjs';
export async function buildProject(args = process.argv.slice(2)) {
  scheduleMaintenance();
  return lock('build-task-' + process.pid, async () => {
    const started = performance.now();
    const modules = (await discover()).filter(
      (item) => !args.includes('--production') || !item.internal,
    );
    const units = await unitsFor(modules);
    const only = args.find((v) => v.startsWith('--only='))?.slice(7);
    const part = args.find((v) => v.startsWith('--part='))?.slice(7);
    if (part && !only?.startsWith('game:'))
      throw new Error('--part requires --only=game:<id>');
    if (part && !['rules', 'bot', 'web', 'metadata'].includes(part))
      throw new Error('Unknown build part');
    const selected = units.filter(
      (unit) =>
        !only ||
        (only === 'platform'
          ? unit.id.startsWith('platform-')
          : only.startsWith('game:') &&
            unit.module?.id === only.slice(5) &&
            (!part || unit.id.endsWith('-' + part))),
    );
    if (!selected.length) throw new Error('Unknown build unit');
    const results = [];
    for (const unit of selected) {
      const result = await buildUnit(unit, args.includes('--full'));
      results.push(result);
      console.log(
        result.id +
          ': ' +
          (result.cached ? 'cache hit' : result.durationMs + 'ms'),
      );
    }
    if (only) {
      for (const result of results) await validateInputs(result);
      return { units: results };
    }
    for (const result of results) await validateInputs(result);
    if (
      JSON.stringify(
        (await discover()).filter(
          (item) => !args.includes('--production') || !item.internal,
        ),
      ) !== JSON.stringify(modules)
    )
      throw new Error('Module list changed before snapshot');
    const version = (await json('package.json')).version;
    const assemblerSha256 = createHash('sha256')
      .update(await readFile('tools/build/assemble.mjs'))
      .digest('hex');
    const id = createHash('sha256')
      .update(
        JSON.stringify({
          version,
          assemblerSha256,
          units: results.map(({ id, fingerprint }) => ({ id, fingerprint })),
        }),
      )
      .digest('hex');
    const snapshot = {
      schemaVersion: 1,
      id,
      version,
      assemblerSha256,
      modules,
      units: results,
    };
    await mkdir('build/snapshots', { recursive: true });
    const snapshotPath = resolve('build/snapshots', id + '.json');
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
    await writeFile(
      'build/snapshots/latest.json',
      JSON.stringify({ snapshotPath, id }) + '\n',
    );
    await assemble(snapshotPath);
    console.log(
      JSON.stringify({
        snapshotPath,
        durationMs: Math.round(performance.now() - started),
        cacheHits: results.filter((r) => r.cached).length,
        total: results.length,
      }),
    );
    return { snapshotPath, id, units: results };
  }).catch(async (error) => {
    const version = (await json('package.json')).version;
    const directory = resolve(
      `artifacts/maintenance/v${version}/build-failures`,
    );
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, `${Date.now()}-${process.pid}.json`),
      JSON.stringify(
        {
          result: 'failed',
          args,
          failedAtUtc: new Date().toISOString(),
          message: error.message,
          stack: error.stack,
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    throw error;
  });
}
if (isDirectExecution(import.meta.url)) {
  scheduleMaintenance();
  try {
    await buildProject();
  } catch (error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  }
}
