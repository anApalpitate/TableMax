import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { RandomSource } from '../packages/platform-core/src/random.ts';
import { WorkerBotExecutor } from '../apps/server/src/bot-executor.ts';
import { packService } from './service-brotli.mjs';

// Reuse a frozen build's exact outputs; never rebuild or change delivery files.
const require = createRequire(import.meta.url);
await mkdir(resolve('tmp'), { recursive: true });
const folder = await mkdtemp(resolve('tmp/service-brotli-test-'));
const sourceRoot = resolve('build/desktop');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const results = [];
async function fixture(name) {
  const root = join(folder, name);
  await mkdir(join(root, 'bots'), { recursive: true });
  await mkdir(join(root, 'games'), { recursive: true });
  for (const path of [
    'bot-worker.cjs',
    'modules.json',
    'games/pokemon-encounters.cjs',
    'bots/pokemon-encounters.cjs',
  ])
    await copyFile(join(sourceRoot, path), join(root, path));
  const entry = join(root, 'bots/pokemon-encounters.cjs');
  let source = await readFile(entry);
  try {
    source = brotliDecompressSync(
      await readFile(join(sourceRoot, 'bots/pokemon-encounters.cjs.br')),
    );
    await writeFile(entry, source);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const result = await packService(entry);
  assert.equal(result.sourceBytes, source.length);
  assert.equal(result.sourceSha256, sha256(source));
  assert.ok(
    result.savingBytes > 35481,
    'One bot unit must close the measured engineering-budget gap',
  );
  assert.ok(brotliDecompressSync(await readFile(entry + '.br')).equals(source));
  const loaded = require(entry);
  const original = require(join(sourceRoot, 'bots/pokemon-encounters.cjs'));
  assert.deepEqual(Object.keys(loaded).sort(), Object.keys(original).sort());
  assert.deepEqual(
    Object.keys(loaded.botsByVariant).sort(),
    Object.keys(original.botsByVariant).sort(),
  );
  const { rulesByVariant } = require(
    join(root, 'games/pokemon-encounters.cjs'),
  );
  return { root, entry, loaded, rulesByVariant, result };
}
function taskFor(fixture, variant, difficulty) {
  const rules = fixture.rulesByVariant[variant];
  const bot = fixture.loaded.botsByVariant[variant];
  const context = { seats: ['a', 'b'], random: new RandomSource(54321) };
  const state = rules.initialize(context);
  const decision = rules.decisions(state)[0];
  assert.ok(decision);
  const task = {
    gameId: 'pokemon-encounters',
    variantId: variant,
    rulesVersion: rules.manifest.rulesVersion,
    instanceId: 'brotli-worker',
    revision: 1,
    branch: 1,
    decision,
    view: rules.project(state, { role: 'player', seatId: decision.seatId }),
    actions: rules.legalActions(state, decision.seatId),
    data: {
      id: bot.id,
      version: bot.version,
      memory: null,
      random: 12345,
      difficulty,
    },
  };
  return { task, rules, state, context };
}
async function decide(fixture, task) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    return await new WorkerBotExecutor(
      join(fixture.root, 'bot-worker.cjs'),
    ).execute(task, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
test('exact compiled bot bytes and all exports load and decide in real production 32MiB Workers without restored files', async (t) => {
  const fixtureData = await fixture('valid');
  const before = await readdir(join(fixtureData.root, 'bots'));
  for (const variant of ['original', 'expansion']) {
    for (const difficulty of ['default', 'doubao', 'juewu']) {
      const { task, rules, state, context } = taskFor(
        fixtureData,
        variant,
        difficulty,
      );
      const started = performance.now();
      const reply = await decide(fixtureData, task);
      assert.ok(
        task.actions.some(
          (action) => JSON.stringify(action) === JSON.stringify(reply.action),
        ),
      );
      assert.doesNotThrow(() =>
        rules.apply(state, reply.action, task.decision.seatId, context),
      );
      assert.ok(Number.isInteger(reply.random) && reply.random > 0);
      results.push({
        variant,
        difficulty,
        elapsedMs: Math.round(performance.now() - started),
        legalAction: reply.action.type,
      });
    }
  }
  assert.deepEqual(await readdir(join(fixtureData.root, 'bots')), before);
  const evidence = {
    source:
      'Current build/desktop outputs copied to isolation; no compilation or GUI',
    runtime: process.versions.node,
    compressed: fixtureData.result,
    resourceLimitMiB: 32,
    deadlineMs: 2000,
    decisions: results,
  };
  await writeFile(
    join(folder, 'pokemon-bot-results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  t.diagnostic(
    JSON.stringify({
      evidence: join(folder, 'pokemon-bot-results.json'),
      sourceBytes: fixtureData.result.sourceBytes,
      payloadBytes: fixtureData.result.payloadBytes,
      loaderBytes: fixtureData.result.loaderBytes,
      savingBytes: fixtureData.result.savingBytes,
      decisions: results.length,
    }),
  );
});
test('missing compressed bot payload fails closed in the production Worker', async () => {
  const fixtureData = await fixture('missing');
  const { task } = taskFor(fixtureData, 'expansion', 'default');
  const payload = join(fixtureData.root, 'bots/pokemon-encounters.cjs.br');
  // Preserve the exact payload under a different name within the test fixture.
  await rename(payload, payload + '.preserved');
  await assert.rejects(decide(fixtureData, task), /strategy-failed/);
});
test('corrupt compressed bot payload fails closed in the production Worker', async () => {
  const fixtureData = await fixture('corrupt');
  const { task } = taskFor(fixtureData, 'expansion', 'default');
  await writeFile(fixtureData.entry + '.br', Buffer.from('corrupt'));
  await assert.rejects(decide(fixtureData, task), /strategy-failed/);
});
