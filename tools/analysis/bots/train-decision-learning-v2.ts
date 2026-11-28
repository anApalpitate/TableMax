import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createGameRegistry } from '../../../apps/server/src/game-registry';
import {
  poolForBlock,
  pooledLearningMatch,
  sizeLearningBlocks,
  summarizeLearningBlocks,
  learningPoolWeights,
} from './decision-learning-blocks';
import { decisionLearningSource } from './decision-learning-source';
import { decisionLearningV2Pilots } from './decision-learning-v2-pilots';
import {
  labelLearningV2,
  pickLearningV2Fit,
  reviewLearningV2,
  type LearningV2Fit,
  type LearningV2Unit,
} from './decision-learning-v2';
import { fitModel } from './fit';
import { fitUnoOnGpu } from './uno-gpu-fit';

type Plan = {
  version: 1;
  train: number[];
  tune: number[];
  development: number[];
  formalStart: number;
  bootstrapSeed: number;
  maxSteps: number;
};
type Stage = 'train' | 'tune' | 'development' | 'first' | 'extension';
type Pair = Awaited<ReturnType<typeof reviewLearningV2>>;
const { values } = parseArgs({
  options: {
    pilot: { type: 'string' },
    plan: { type: 'string' },
    directory: { type: 'string' },
    jobs: { type: 'string', default: '1' },
    stage: { type: 'string', default: 'development' },
    worker: { type: 'boolean' },
    shard: { type: 'string' },
    fit: { type: 'string' },
    count: { type: 'string' },
    start: { type: 'string', default: '0' },
  },
});
const id = values.pilot as keyof typeof decisionLearningV2Pilots;
assert.ok(
  id &&
    Object.hasOwn(decisionLearningV2Pilots, id) &&
    values.plan &&
    values.directory,
);
const planPath = values.plan;
const directory = values.directory;
const hash = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const plan = read(planPath) as Plan;
const planSha256 = hash(readFileSync(planPath));
const seedValid = (seed: number) =>
  Number.isSafeInteger(seed) && seed >= 1 && seed <= 0xffffffff;
assert.equal(plan.version, 1);
assert.ok(
  plan.train.length === 32 &&
    plan.tune.length === 16 &&
    plan.development.length === 48,
);
const seeds = [...plan.train, ...plan.tune, ...plan.development];
assert.equal(new Set(seeds).size, seeds.length);
assert.ok(seeds.every((seed) => seedValid(seed) && seed < plan.formalStart));
assert.ok(seedValid(plan.formalStart) && seedValid(plan.bootstrapSeed));
assert.ok(Number.isSafeInteger(plan.maxSteps) && plan.maxSteps > 0);
const jobs = Number(values.jobs);
assert.ok(Number.isSafeInteger(jobs) && jobs >= 1 && jobs <= 8);
const pilot = decisionLearningV2Pilots[id];
const loaded = await createGameRegistry().load(pilot.game, pilot.variant);
const extras = [
  'decision-learning-blocks.ts',
  'decision-learning-v2.ts',
  'decision-learning-v2-pilots.ts',
  'train-decision-learning-v2.ts',
];
const source = () =>
  hash(
    JSON.stringify([
      decisionLearningSource(pilot.game),
      ...extras.map((name) =>
        hash(readFileSync(new URL('./' + name, import.meta.url))),
      ),
    ]),
  );
const sourceSha256 = source();
const identity = {
  id,
  planSha256,
  sourceSha256,
  node: process.version,
  encoder: pilot.encoder,
  strategy: loaded.bot.version,
  rules: loaded.rules.manifest,
};

function file(stage: Stage, index: number) {
  return join(directory, `${stage}-${index}.json`);
}
function signature(stage: Stage, index: number, fitHash: string | null) {
  return hash(JSON.stringify([identity, stage, index, fitHash]));
}

if (values.worker) {
  const stage = values.stage as Stage;
  assert.ok(
    ['train', 'tune', 'development', 'first', 'extension'].includes(stage),
  );
  const part = Number(values.shard);
  assert.ok(Number.isSafeInteger(part) && part >= 0 && part < jobs);
  const fit = values.fit ? (read(values.fit) as LearningV2Fit) : null;
  const fitHash = values.fit ? hash(readFileSync(values.fit)) : null;
  const openings =
    stage === 'first' || stage === 'extension'
      ? Array.from(
          { length: Number(values.count) },
          (_, index) => plan.formalStart + index,
        )
      : plan[stage];
  const start = Number(values.start);
  assert.ok(
    Number.isSafeInteger(start) && start >= 0 && start < openings.length,
  );
  for (let index = start; index < openings.length; index++) {
    if (index % jobs !== part) continue;
    const path = file(stage, index);
    const receipt = signature(stage, index, fitHash);
    if (existsSync(path)) {
      assert.equal(read(path).receipt, receipt);
      continue;
    }
    const seed = openings[index]!;
    assert.ok(seedValid(seed));
    const pool = poolForBlock(index);
    let result:
      LearningV2Unit | { pool: typeof pool; difference: number; pairs: Pair[] };
    if (!fit) {
      assert.ok(stage === 'train' || stage === 'tune');
      const { input, actor } = pooledLearningMatch(
        loaded,
        pilot.players,
        seed,
        index % pilot.players,
        pool,
        Math.floor(index / 4),
      );
      result = await labelLearningV2(input, pilot, actor, plan.maxSteps);
    } else {
      const pairs: Pair[] = [];
      for (let focus = 0; focus < pilot.players; focus++) {
        const { input, actor } = pooledLearningMatch(
          loaded,
          pilot.players,
          seed,
          focus,
          pool,
          Math.floor(index / 4),
        );
        pairs.push(
          await reviewLearningV2(
            input,
            pilot,
            actor,
            fit,
            plan.maxSteps,
            stage === 'development',
          ),
        );
      }
      result = {
        pool,
        difference:
          pairs.reduce(
            (sum, row) => sum + row.candidateWon - row.baselineWon,
            0,
          ) / pairs.length,
        pairs,
      };
    }
    const temporary = path + '.new';
    writeFileSync(temporary, JSON.stringify({ receipt, index, seed, result }), {
      flag: 'w',
      flush: true,
    });
    // Complete blocks are published atomically. Numbered inputs are exclusive to their assigned worker.
    const { renameSync } = await import('node:fs');
    renameSync(temporary, path);
    console.error(
      JSON.stringify({
        pilot: id,
        stage,
        index: index + 1,
        total: openings.length,
      }),
    );
  }
  assert.equal(source(), sourceSha256);
} else {
  async function run(stage: Stage, count: number, fit?: string, start = 0) {
    const fitHash = fit ? hash(readFileSync(fit)) : null;
    const script = fileURLToPath(import.meta.url);
    const childArgs = [
      '--import',
      'tsx',
      script,
      '--worker',
      '--pilot=' + id,
      '--plan=' + planPath,
      '--directory=' + directory,
      '--stage=' + stage,
      '--count=' + count,
      '--start=' + start,
      '--jobs=' + jobs,
    ];
    if (fit) childArgs.push('--fit=' + fit);
    const children = Array.from({ length: jobs }, (_, part) =>
      spawn(process.execPath, [...childArgs, '--shard=' + part], {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'inherit'],
      }),
    );
    let failed = false;
    await Promise.all(
      children.map(
        (child) =>
          new Promise<void>((done) => {
            const cancel = () => {
              if (!failed) {
                failed = true;
                for (const other of children)
                  if (other !== child && other.exitCode === null) other.kill();
              }
            };
            child.once('error', cancel);
            child.once('close', (status) => {
              if (status !== 0) cancel();
              done();
            });
          }),
      ),
    );
    if (failed)
      throw new Error(
        `A ${stage} opening worker failed; completed receipts were retained`,
      );
    assert.equal(source(), sourceSha256);
    return Array.from({ length: count - start }, (_, offset) => {
      const index = start + offset;
      const row = read(file(stage, index));
      assert.equal(row.receipt, signature(stage, index, fitHash));
      assert.equal(row.index, index);
      return row;
    });
  }
  const fitPath = join(directory, 'fit.json');
  const developmentPath = join(directory, 'development.json');
  if (values.stage === 'development') {
    const train = await run('train', plan.train.length);
    const tune = await run('tune', plan.tune.length);
    const trainRows = train.flatMap(({ result }: { result: LearningV2Unit }) =>
      result.roots.flatMap(({ rows }) =>
        rows.map(({ features, target, weight }) => ({
          features,
          target,
          weight,
        })),
      ),
    );
    const tuneUnits = tune.map(({ result }) => result as LearningV2Unit);
    if (!trainRows.length || !tuneUnits.some(({ roots }) => roots.length)) {
      writeFileSync(
        developmentPath,
        JSON.stringify(
          {
            identity,
            train,
            tune,
            passes: false,
            outcome: 'insufficient-candidates',
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx' },
      );
      console.log(
        JSON.stringify({
          pilot: id,
          passes: false,
          outcome: 'insufficient-candidates',
        }),
      );
    } else {
      const penalty = 0.03;
      const cpu = fitModel(trainRows, 'linear', penalty);
      const gpu = JSON.parse(
        await fitUnoOnGpu(
          fileURLToPath(new URL('./ridge-cuda.py', import.meta.url)),
          JSON.stringify({ examples: trainRows, penalty }),
          () => {},
        ),
      );
      assert.equal(cpu.length, gpu.coefficients.length);
      assert.ok(
        cpu.every(
          (value, index) => Math.abs(value - gpu.coefficients[index]) <= 1e-6,
        ),
      );
      const fit = pickLearningV2Fit(tuneUnits, gpu.coefficients);
      if (existsSync(fitPath)) assert.deepEqual(read(fitPath), fit);
      else
        writeFileSync(fitPath, JSON.stringify(fit, null, 2) + '\n', {
          flag: 'wx',
        });
      const dev = await run('development', plan.development.length, fitPath);
      const blocks = dev.map(
        ({ result }) =>
          result as {
            pool: ReturnType<typeof poolForBlock>;
            difference: number;
            pairs: Pair[];
          },
      );
      const summary = summarizeLearningBlocks(blocks, plan.bootstrapSeed);
      const pairs = blocks.flatMap((block) => block.pairs);
      const first = pairs.flatMap(({ firstChangeGain }) =>
        firstChangeGain === null ? [] : [firstChangeGain],
      );
      const firstChangeGain = first.length
        ? first.reduce((sum, value) => sum + value, 0) / first.length
        : null;
      const controlDelta = summarizeLearningBlocks(
        blocks.map(({ pool, pairs }) => ({
          pool,
          difference:
            pairs.reduce(
              (sum, row) => sum + row.candidateWon - row.controlWon,
              0,
            ) / pairs.length,
        })),
        plan.bootstrapSeed,
      ).difference;
      const passes =
        summary.difference >= 0.03 &&
        firstChangeGain !== null &&
        firstChangeGain > 0 &&
        controlDelta > 0;
      const report = {
        identity,
        fit,
        fitSha256: hash(readFileSync(fitPath)),
        device: gpu.device,
        trainLabels: trainRows.length,
        tuneLabels: tuneUnits.reduce(
          (sum, u) => sum + u.roots.reduce((n, r) => n + r.rows.length, 0),
          0,
        ),
        summary,
        firstChangeGain,
        firstChangeSamples: first.length,
        controlDelta,
        interventions: pairs.reduce((sum, pair) => sum + pair.interventions, 0),
        passes,
      };
      writeFileSync(
        developmentPath,
        JSON.stringify({ ...report, train, tune, dev }, null, 2) + '\n',
        { flag: 'wx' },
      );
      console.log(JSON.stringify(report));
    }
  } else if (values.stage === 'formal') {
    const dev = read(developmentPath);
    assert.ok(dev.passes && dev.fitSha256 === hash(readFileSync(fitPath)));
    assert.deepEqual(dev.identity, identity);
    const variance = dev.summary.pools.reduce(
      (sum, row) =>
        sum +
        learningPoolWeights[row.pool as keyof typeof learningPoolWeights] *
          row.variance,
      0,
    );
    const count = sizeLearningBlocks(variance, 2);
    const total = count + 4 * Math.ceil(count / 8);
    const frozen = {
      count,
      total,
      fitSha256: dev.fitSha256,
      planSha256,
      firstStart: plan.formalStart,
      firstEnd: plan.formalStart + count - 1,
      reserveStart: plan.formalStart + count,
      reserveEnd: plan.formalStart + total - 1,
    };
    const formalPlan = join(directory, 'formal-plan.json');
    if (existsSync(formalPlan)) assert.deepEqual(read(formalPlan), frozen);
    else
      writeFileSync(formalPlan, JSON.stringify(frozen, null, 2) + '\n', {
        flag: 'wx',
      });
    const first = await run('first', count, fitPath);
    const initial = summarizeLearningBlocks(
      first.map(({ result }) => result),
      plan.bootstrapSeed,
      2,
    );
    const extra =
      !initial.passes && initial.decisionInterval.upper >= 0.03
        ? await run('extension', total, fitPath, count)
        : [];
    const result = summarizeLearningBlocks(
      [...first, ...extra].map(({ result }) => result),
      plan.bootstrapSeed,
      2,
    );
    writeFileSync(
      join(directory, 'formal.json'),
      JSON.stringify(
        { identity, frozen, initial, result, first, extra },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    console.log(JSON.stringify({ pilot: id, initial, result }));
  } else throw new Error('Choose development or formal');
}
