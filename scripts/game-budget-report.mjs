import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { cpus, totalmem, release } from 'node:os';
import { inventory } from './module-build.mjs';
const directory = resolve(
  'artifacts/maintenance/v1.0.4/incremental-build-20261005/budgets',
);
const service = JSON.parse(
  await readFile(join(directory, 'service-heaps.json'), 'utf8'),
).results;
const traces = await Promise.all(
  (await readdir(join(directory, 'web')))
    .filter((name) => name.endsWith('.json'))
    .map(async (name) => ({
      file: name,
      ...JSON.parse(await readFile(join(directory, 'web', name), 'utf8')),
    })),
);
const files = await inventory(resolve('build/desktop'));
const round = (bytes, factor) =>
  Math.ceil((bytes * factor) / 1048576) * 1048576;
const results = [];
const changes = [];
for (const id of ['pokemon-encounters', 'modern-art', 'power-grid']) {
  const file = resolve('games', id, 'game-module.json');
  const module = JSON.parse(await readFile(file, 'utf8'));
  const runs = [];
  for (const record of traces.filter(
    (record) =>
      record.gameId === id && record.samples.length >= 2 && record.scenario,
  )) {
    const evidence = record.scenario
      .find((value) => value.startsWith('--evidence='))
      ?.slice(11);
    if (!evidence) continue;
    const path =
      id === 'pokemon-encounters'
        ? join('development', evidence)
        : id === 'modern-art'
          ? join('modern-art', 'development', evidence)
          : join('power-grid', 'runtime', 'development', evidence);
    try {
      const validation = JSON.parse(
        await readFile(
          resolve('artifacts/maintenance/v1.0.4', path, 'results.json'),
          'utf8',
        ),
      );
      if (validation.result === 'passed') runs.push({ ...record, evidence });
    } catch {
      /* Incomplete or failed scenario is not a baseline. */
    }
  }
  const measuredService = service.filter(
    (record) => record.gameId === id && record.result === 'passed',
  );
  if (
    new Set(runs.map((record) => record.evidence)).size < 3 ||
    measuredService.length !== 3 ||
    runs.some((record) => record.errors.length)
  )
    throw new Error('Three successful measured runs required: ' + id);
  const payloadBytes = files
    .filter(
      (file) =>
        file.path === `games/${id}.cjs` ||
        file.path === `bots/${id}.cjs` ||
        file.path.startsWith(`web/games/${id}/`),
    )
    .reduce((sum, file) => sum + file.bytes, 0);
  const rolePeak = (role) =>
    Math.max(
      ...runs.flatMap((record) =>
        record.samples.flatMap((sample) =>
          sample.renderers
            .filter((renderer) => role.includes(renderer.role))
            .map((renderer) => renderer.heapBytes),
        ),
      ),
    );
  const measured = {
    payloadBytes,
    serviceHeapBytes: Math.max(
      ...measuredService.map((run) => run.serviceHeapBytes),
    ),
    desktopHeapBytes: rolePeak(['host', 'public']),
    phoneHeapBytes: rolePeak(['player']),
    privateIncrementBytes: Math.max(
      ...runs.map(
        (record) =>
          Math.max(...record.samples.map((sample) => sample.privateBytes)) -
          record.samples[0].privateBytes,
      ),
    ),
  };
  if (
    Object.values(measured).some(
      (value) => !Number.isFinite(value) || value <= 0,
    )
  )
    throw new Error('Incomplete renderer/process measurements: ' + id);
  const suggested = Object.fromEntries(
    Object.entries(measured).map(([key, value]) => [
      key,
      round(value, key === 'payloadBytes' ? 1.1 : 1.25),
    ]),
  );
  if (process.argv.includes('--initialize')) {
    if (!module.budgets.basis.startsWith('Pending one-time'))
      throw new Error('Budgets already initialized: ' + id);
    module.budgets = {
      ...suggested,
      workerOldGenerationMiB: 32,
      basis:
        '2026-10-05 one-time baseline: independent payload ×1.10; maxima of three real scenario runs ×1.25, rounded up to MiB. Evidence: artifacts/maintenance/v1.0.4/incremental-build-20261005/budgets/results.json. Sampled WebView2 heaps and owned process-tree private-byte increase from first box sample; full-match service heap measured separately.',
    };
    changes.push({ file, content: JSON.stringify(module, null, 2) + '\n' });
  }
  const warnings = Object.entries(measured)
    .filter(([key, value]) => value > module.budgets[key])
    .map(([metric, actual]) => ({
      metric,
      actual,
      budget: module.budgets[metric],
      action: 'Rectify the module; budgets are not increased automatically.',
    }));
  results.push({
    id,
    measured,
    budgets: module.budgets,
    warnings,
    traces: runs.map((run) => run.file),
    serviceRuns: measuredService,
  });
}
for (const change of changes) await writeFile(change.file, change.content);
await writeFile(
  join(directory, 'results.json'),
  JSON.stringify(
    {
      device: { os: release(), cpu: cpus()[0].model, memoryBytes: totalmem() },
      sampling:
        'Service heap every 50ms and action; WebView2 CDP used JS heap and Windows owned process-tree private bytes every 2s. Maxima are sampled, not allocation-profiler maxima. Worker 32MiB old-generation limit is separate.',
      shared: {
        payloadBytes: files
          .filter(
            (file) =>
              !file.path.startsWith('games/') &&
              !file.path.startsWith('bots/') &&
              !file.path.startsWith('web/games/'),
          )
          .reduce((sum, file) => sum + file.bytes, 0),
        webRuntimeBytes: files
          .filter((file) => file.path.startsWith('web/runtime/'))
          .reduce((sum, file) => sum + file.bytes, 0),
        service: JSON.parse(
          await readFile(join(directory, 'platform-heap.json'), 'utf8'),
        ),
        boxRendererSamples: traces
          .filter((record) => record.scenario)
          .map((record) => ({
            trace: record.file,
            firstRenderers: record.samples[0]?.renderers,
          })),
        scope:
          'Shared payload counted once. Per-game service/renderer limits are whole authorized scenario heaps including shared baseline, not additive allocations across games; only one selected game runs at a time.',
      },
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    results.map(({ id, measured, budgets, warnings }) => ({
      id,
      measured,
      budgets,
      warnings,
    })),
  ),
);
