import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { summarize, boundedPush } from './summary.mjs';

assertWorkspaceRoot();
process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
const requestedWork = process.argv
  .find((v) => v.startsWith('--work='))
  ?.slice(7);
await mkdir('tmp', { recursive: true });
const work = requestedWork
  ? resolve(requestedWork)
  : await mkdtemp(resolve('tmp/efficiency-runtime-'));
assert.ok(
  dirname(work) === resolve('tmp') &&
    /^efficiency-runtime-[A-Za-z0-9]{6}$/.test(basename(work)),
  'Use an isolated efficiency-runtime temporary directory',
);
const api = join(work, 'worker-api.cjs'),
  workerPath = join(work, 'bot-worker.cjs'),
  botEntry = join(work, 'uno-bot.cjs');
await build({
  stdin: {
    contents: `export {WorkerBotExecutor} from './apps/server/src/bot-executor';export {rules} from './games/uno/rules';export {bot} from './games/uno/bot';export {RandomSource} from './packages/platform-core/src/random';`,
    resolveDir: resolve('.'),
  },
  outfile: api,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'silent',
});
for (const [entry, outfile] of [
  ['apps/server/src/bot-worker.ts', workerPath],
  ['games/uno/bot/index.ts', botEntry],
])
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    logLevel: 'silent',
  });
const { WorkerBotExecutor, rules, bot, RandomSource } = createRequire(
  import.meta.url,
)(api);
const seats = Array.from({ length: 6 }, (_, i) => `s${i}`);
const state = rules.initialize({ seats, random: new RandomSource(12345) });
const decision = rules.decisions(state)[0];
const task = {
  gameId: 'uno',
  rulesVersion: bot.rulesVersion,
  view: rules.project(state, { role: 'player', seatId: decision.seatId }),
  actions: rules.legalActions(state, decision.seatId),
  decision,
  data: {
    id: bot.id,
    version: bot.version,
    memory: null,
    random: 12345,
    difficulty: 'juewu',
  },
};
const workerSamples = [],
  policyMs = [];
let peakHeap = 0,
  peakRss = 0;
const sample = () => {
  const memory = process.memoryUsage();
  peakHeap = Math.max(peakHeap, memory.heapUsed);
  peakRss = Math.max(peakRss, memory.rss);
};
const diagnostic = (entry) => {
  workerSamples.push(entry);
  if (workerSamples.length > 256) workerSamples.shift();
  sample();
};
const executor = new WorkerBotExecutor(workerPath, () => botEntry, diagnostic);
const legal = (action) =>
  task.actions.some((item) => JSON.stringify(item) === JSON.stringify(action));
const timer = setInterval(sample, 10);
try {
  for (let i = 0; i < 12; i++) {
    const result = await executor.execute(task, new AbortController().signal);
    assert.ok(legal(result.action));
    const start = performance.now();
    const direct = await bot.decide({
      view: task.view,
      actions: task.actions,
      decision,
      memory: null,
      difficulty: 'juewu',
      random: new RandomSource(12345),
      signal: new AbortController().signal,
    });
    boundedPush(policyMs, performance.now() - start);
    assert.ok(legal(direct.action));
  }
  const loop = join(work, 'loop.cjs'),
    failed = join(work, 'failed.cjs');
  await writeFile(loop, 'while(true){}');
  await writeFile(
    failed,
    "require('node:worker_threads').parentPort.postMessage({error:'private-error'});",
  );
  for (let i = 0; i < 3; i++) {
    const controller = new AbortController(),
      cancel = setTimeout(() => controller.abort(), 100);
    try {
      await assert.rejects(
        new WorkerBotExecutor(loop, undefined, diagnostic).execute(
          task,
          controller.signal,
        ),
        /cancelled/,
      );
    } finally {
      clearTimeout(cancel);
    }
  }
  await assert.rejects(
    new WorkerBotExecutor(failed, undefined, diagnostic).execute(
      task,
      new AbortController().signal,
    ),
    /strategy-failed/,
  );
  const end = performance.now() + 5000;
  while (
    workerSamples.filter((entry) => entry.phase === 'exit').length < 16 &&
    performance.now() < end
  )
    await new Promise((done) => setTimeout(done, 10));
  assert.equal(
    workerSamples.filter((entry) => entry.phase === 'exit').length,
    16,
  );
  for (const [outcome, count] of [
    ['success', 12],
    ['cancelled', 3],
    ['failed', 1],
  ])
    assert.equal(
      workerSamples.filter(
        (entry) => entry.phase === 'exit' && entry.outcome === outcome,
      ).length,
      count,
    );
  const result = {
    at: new Date().toISOString(),
    scenario:
      'Seeded 6-seat UNO highest policy authorized projection, compiled source, Node with no TS loader. Online-to-result includes module loading plus policy; directPolicy is an additional in-process decide timing.',
    node: process.versions.node,
    execArgv: process.execArgv.filter((arg) => arg === '--expose-gc'),
    sampleLimit: 256,
    expectedSuccess: 12,
    expectedCancellation: 3,
    expectedFailure: 1,
    unexpectedFailures: 0,
    inputs: Object.fromEntries(
      await Promise.all(
        [
          'apps/server/src/bot-executor.ts',
          'apps/server/src/bot-worker.ts',
          'games/uno/bot/index.ts',
        ].map(async (path) => [
          path,
          createHash('sha256')
            .update(await readFile(path))
            .digest('hex'),
        ]),
      ),
    ),
    directPolicyMs: summarize(policyMs),
    sampledPeakHeapBytes: peakHeap,
    sampledPeakRssBytes: peakRss,
    metrics: Object.fromEntries(
      ['startup', 'onlineToResult', 'cancel', 'exit'].map((phase) => [
        phase,
        summarize(
          workerSamples
            .filter((entry) => entry.phase === phase)
            .map((entry) => entry.durationMs),
        ),
      ]),
    ),
    cancelToExitMs: summarize(
      workerSamples
        .filter(
          (entry) => entry.phase === 'exit' && entry.outcome === 'cancelled',
        )
        .map((entry) => entry.durationMs),
    ),
    samples: workerSamples,
  };
  const output = resolve(
    'artifacts/maintenance/development-efficiency/runtime',
  );
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, 'workers.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(
    JSON.stringify(
      process.argv.includes('--json')
        ? result
        : {
            result: 'measured',
            report: join(output, 'workers.json'),
            success: 12,
            cancelled: 3,
            expectedFailure: 1,
            unexpectedFailures: 0,
          },
    ),
  );
} finally {
  clearInterval(timer);
}
