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
import { applicationVersion } from '../shared/application-version.mjs';
import { assemble } from './assemble.mjs';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { scheduleMaintenance } from '../maintenance/lifecycle.mjs';
import { createReadPhase } from './read-phase.mjs';
import { parseBuildJobs, runUnitPool } from './unit-scheduler.mjs';
export async function buildProject(args = process.argv.slice(2)) {
  const jobs = parseBuildJobs(args);
  scheduleMaintenance();
  return lock('build-task-' + process.pid, async () => {
    const started = performance.now();
    const timings = {};
    const inputPhase = createReadPhase('discovery-and-build-inputs');
    const only = args.find((v) => v.startsWith('--only='))?.slice(7);
    const modules = (
      await discover(only?.startsWith('game:') ? only.slice(5) : undefined)
    ).filter((item) => !args.includes('--production') || !item.internal);
    const units = await unitsFor(
      only === 'platform' ? [] : modules,
      inputPhase,
    );
    timings.discoveryMs = performance.now() - started;
    const part = args.find((v) => v.startsWith('--part='))?.slice(7);
    if (part && !only?.startsWith('game:'))
      throw new Error('--part requires --only=game:<id>');
    if (
      part &&
      ![
        'rules',
        'bot',
        'web',
        'metadata',
        'resources-common',
        'resources-variant',
      ].includes(part)
    )
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
    const unitsStarted = performance.now();
    const results = await runUnitPool(selected, {
      jobs,
      run: (unit) => buildUnit(unit, args.includes('--full'), { inputPhase }),
      onResult: (result) => {
        console.log(
          result.id +
            ': ' +
            (result.cached
              ? 'cache hit; verified ' +
                Math.round(result.currentDurationMs) +
                'ms'
              : Math.round(result.currentDurationMs) + 'ms'),
        );
      },
    });
    timings.unitsMs = performance.now() - unitsStarted;
    const verificationPhase = createReadPhase('pre-freeze-input-verification');
    const verificationStarted = performance.now();
    if (only) {
      for (const result of results)
        await validateInputs(result, verificationPhase);
      timings.inputVerificationMs = performance.now() - verificationStarted;
      timings.totalMs = performance.now() - started;
      console.log(
        JSON.stringify({
          jobs,
          only,
          timings,
          readPhases: [inputPhase.stats, verificationPhase.stats],
        }),
      );
      return {
        units: results,
        jobs,
        timings,
        readPhases: [inputPhase.stats, verificationPhase.stats],
      };
    }
    const frozen = await lock('freeze-build-snapshot', async () => {
      for (const result of results)
        await validateInputs(result, verificationPhase);
      timings.inputVerificationMs = performance.now() - verificationStarted;
      if (
        JSON.stringify(
          (await discover()).filter(
            (item) => !args.includes('--production') || !item.internal,
          ),
        ) !== JSON.stringify(modules)
      )
        throw new Error('Module list changed before snapshot');
      const { releaseVersion: version, buildVersion } =
        await applicationVersion();
      const assemblerSha256 = createHash('sha256')
        .update(await readFile('tools/build/assemble.mjs'))
        .digest('hex');
      const id = createHash('sha256')
        .update(
          JSON.stringify({
            version,
            buildVersion,
            assemblerSha256,
            units: results.map(({ id, fingerprint }) => ({ id, fingerprint })),
          }),
        )
        .digest('hex');
      const snapshot = {
        schemaVersion: 1,
        id,
        version,
        buildVersion,
        assemblerSha256,
        modules,
        units: results,
        jobs,
        timings,
        readPhases: [inputPhase.stats, verificationPhase.stats],
      };
      await mkdir('build/snapshots', { recursive: true });
      const snapshotPath = resolve('build/snapshots', id + '.json');
      await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
      await writeFile(
        'build/snapshots/latest.json',
        JSON.stringify({ snapshotPath, id }) + '\n',
      );
      return { snapshot, snapshotPath };
    });
    const { snapshot, snapshotPath } = frozen;
    timings.freezeMs = performance.now() - verificationStarted;
    const assemblyStarted = performance.now();
    await assemble(snapshotPath);
    timings.assemblyMs = performance.now() - assemblyStarted;
    timings.totalMs = performance.now() - started;
    console.log(
      JSON.stringify({
        snapshotPath,
        durationMs: Math.round(performance.now() - started),
        cacheHits: results.filter((r) => r.cached).length,
        total: results.length,
        jobs,
        timings,
        readPhases: [inputPhase.stats, verificationPhase.stats],
      }),
    );
    return { ...snapshot, snapshotPath, timings };
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
