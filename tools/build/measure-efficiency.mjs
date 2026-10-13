import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildUnit, validateInputs } from './module-build.mjs';
import { createReadPhase } from './read-phase.mjs';
import { runUnitPool } from './unit-scheduler.mjs';
import { assertWorkspaceRoot } from '../shared/workspace-root.mjs';
assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const run = promisify(execFile);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const argument = (name) =>
  process.argv
    .slice(2)
    .find((arg) => arg.startsWith(name + '='))
    ?.slice(name.length + 1);
const fixture = argument('--fixture');
if (fixture) {
  const jobs = Number(argument('--jobs'));
  const mode = argument('--mode');
  assert.ok(
    [1, 2].includes(jobs) && ['cold', 'warm', 'changed'].includes(mode),
  );
  const units = ['alpha', 'beta'].flatMap((game) =>
    ['rules', 'bot', 'web'].map((part) => ({
      id: `efficiency-${game}-${part}`,
      kind: part === 'web' ? 'web' : 'node',
      entry: join(fixture, game, 'entry.ts'),
      inputs: [join(fixture, game, 'entry.ts')],
      output: game + '.cjs',
      module: { id: game, compatibility: {} },
    })),
  );
  const start = performance.now();
  const inputPhase = createReadPhase('fixture-initial-inputs');
  const results = await runUnitPool(units, {
    jobs,
    run: (unit) =>
      buildUnit(unit, false, {
        inputPhase,
        cacheRoot: join(fixture, 'cache-jobs-' + jobs),
      }),
  });
  const verificationPhase = createReadPhase('fixture-pre-freeze-verification');
  for (const result of results) await validateInputs(result, verificationPhase);
  console.log(
    JSON.stringify({
      mode,
      jobs,
      wallMs: performance.now() - start,
      parentNodePeakRssBytes: process.resourceUsage().maxRSS * 1024,
      units: results.map(
        ({
          id,
          cached,
          files,
          currentDurationMs,
          originalBuildDurationMs,
          timings,
        }) => ({
          id,
          cached,
          files,
          currentDurationMs,
          originalBuildDurationMs,
          timings,
        }),
      ),
      readPhases: [inputPhase.stats, verificationPhase.stats],
    }),
  );
} else {
  await mkdir('tmp', { recursive: true });
  const directory = await mkdtemp(resolve('tmp/efficiency-build-'));
  const evidence = resolve(
    'artifacts/maintenance/development-efficiency/build',
    new Date().toISOString().replace(/[:.]/g, '-'),
  );
  await mkdir(evidence, { recursive: true });
  const inputs = [];
  const common = join(directory, 'common.ts');
  await writeFile(
    common,
    'export const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);',
  );
  inputs.push(common);
  for (const game of ['alpha', 'beta']) {
    await mkdir(join(directory, game));
    const entry = join(directory, game, 'entry.ts'),
      config = join(directory, game, 'config.json');
    await writeFile(
      config,
      JSON.stringify({ value: game === 'alpha' ? 1 : 2 }),
    );
    await writeFile(
      entry,
      `import {sum} from '../common';import config from './config.json';export const score=sum([${Array.from({ length: 6000 }, (_, i) => i % 31).join(',')}])+config.value;`,
    );
    inputs.push(entry, config);
  }
  const cases = [];
  const executeCase = async (mode, jobs) => {
    const { stdout, stderr } = await run(
      process.execPath,
      [
        resolve('tools/build/measure-efficiency.mjs'),
        '--fixture=' + directory,
        '--mode=' + mode,
        '--jobs=' + jobs,
      ],
      {
        cwd: resolve('.'),
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 4,
        env: { ...process.env, TABLEMAX_AUTO_MAINTENANCE: '0' },
      },
    );
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
    await writeFile(
      join(evidence, `${mode}-jobs${jobs}.json`),
      JSON.stringify({ ...result, stderr }, null, 2) + '\n',
    );
    cases.push(result);
  };
  const initialInputs = await Promise.all(
    inputs.map(async (path) => ({
      path: relative(resolve('.'), path),
      sha256: hash(await readFile(path)),
    })),
  );
  for (const jobs of [1, 2]) {
    await executeCase('cold', jobs);
    await executeCase('warm', jobs);
  }
  await writeFile(
    join(directory, 'alpha', 'config.json'),
    JSON.stringify({ value: 3 }),
  );
  for (const jobs of [1, 2]) await executeCase('changed', jobs);
  const byCase = (mode, jobs) =>
    cases.find((item) => item.mode === mode && item.jobs === jobs);
  const outputs = (item) => item.units.map(({ id, files }) => ({ id, files }));
  for (const mode of ['cold', 'warm', 'changed'])
    assert.deepEqual(
      outputs(byCase(mode, 1)),
      outputs(byCase(mode, 2)),
      'jobs output equivalence',
    );
  for (const jobs of [1, 2]) {
    assert.ok(byCase('cold', jobs).units.every((unit) => !unit.cached));
    assert.ok(byCase('warm', jobs).units.every((unit) => unit.cached));
    assert.ok(
      byCase('changed', jobs).units.every(
        (unit) => unit.cached === unit.id.includes('-beta-'),
      ),
    );
    for (const old of byCase('cold', jobs).units.filter((unit) =>
      unit.id.includes('-beta-'),
    ))
      assert.deepEqual(
        old.files,
        byCase('changed', jobs).units.find((unit) => unit.id === old.id).files,
      );
  }
  const summaries = ['cold', 'warm', 'changed'].map((mode) => ({
    mode,
    jobs1Ms: byCase(mode, 1).wallMs,
    jobs2Ms: byCase(mode, 2).wallMs,
    speedupPercent: (1 - byCase(mode, 2).wallMs / byCase(mode, 1).wallMs) * 100,
    parentNodeRssRatio:
      byCase(mode, 2).parentNodePeakRssBytes /
      byCase(mode, 1).parentNodePeakRssBytes,
  }));
  const toolInputs = await Promise.all(
    [
      'module-build.mjs',
      'read-phase.mjs',
      'unit-scheduler.mjs',
      'measure-efficiency.mjs',
    ].map(async (name) => ({
      path: 'tools/build/' + name,
      sha256: hash(await readFile(new URL(name, import.meta.url))),
    })),
  );
  const report = {
    passed: true,
    fixture: directory,
    evidence,
    method:
      'Fixed two-game fixture; real esbuild/Vite units; isolated fresh Node per case; jobs1/2 cold/warm/one-game config change; no desktop or EXE export.',
    limitations: [
      'One sample per case, small synthetic games; not a whole-project benchmark.',
      'Memory records parent Node high-water RSS, excluding esbuild child; insufficient for raising default jobs.',
    ],
    initialInputs,
    finalInputs: await Promise.all(
      inputs.map(async (path) => ({
        path: relative(resolve('.'), path),
        sha256: hash(await readFile(path)),
      })),
    ),
    toolInputs,
    cases: summaries,
    outputEquivalence: true,
    warmCacheHits: 6,
    changedCacheHits: 3,
    recommendedDefaultJobs: 1,
  };
  await writeFile(
    join(evidence, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      passed: report.passed,
      evidence: join(evidence, 'results.json'),
      cases: report.cases,
      outputEquivalence: report.outputEquivalence,
      recommendedDefaultJobs: report.recommendedDefaultJobs,
      limitations: report.limitations,
    }),
  );
}
