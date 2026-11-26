import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import {
  loadUnoLeafScorer,
  unoLeafFeatureNames,
} from '../../../games/uno/bot/calibration';
import { searchUnoPlays } from '../../../games/uno/bot/search';
import { RandomSource } from '../../../packages/platform-core/src/random';
import {
  average,
  bootstrap,
  rankingSamples,
  type RankingBudget,
} from './uno-calibration-seed';
import { calibrationSeeds } from './uno-calibration-provenance';
import { referenceAnchor } from './uno-calibration-fit';
import { isCurrentUnoPilot } from './uno-pilot';
import { openTrainingCheckpoint } from './training-checkpoint';
import {
  collectUnoRoots,
  independentSeed,
  pairedUnoDifferences,
  type UnoRoot,
} from './uno-samples';

interface Plan {
  version: 1;
  seeds: number[];
  roots: number;
  maxSteps: number;
  ranking: RankingBudget;
}

interface Task {
  plan: Plan;
  seed: number;
  fitted: number[];
  simple: number[];
}

const methods = ['fitted8', 'fitted16', 'simple8', 'simple16'] as const;
type Method = (typeof methods)[number];
interface RootEvidence {
  root: UnoRoot;
  pairs: number;
  confirmed: number;
  reference: Array<{ left: number; right: number; difference: number }>;
  ordered: Record<Method, number>;
  unfinished: number;
}

function verifyPartition(seeds: number[]) {
  if (
    !seeds.length ||
    new Set(seeds).size !== seeds.length ||
    seeds.some(
      (seed) => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff,
    )
  )
    throw new Error('Use a distinct set of development opening seeds');
}

async function collect(task: Task) {
  const { plan, seed } = task;
  const options = {
    roots: plan.roots,
    maxSteps: plan.maxSteps,
    continuations: plan.ranking.continuations,
    hypotheses: 8 as const,
  };
  const fitted = loadUnoLeafScorer({
    version: 1,
    features: unoLeafFeatureNames,
    coefficients: task.fitted,
  });
  const simple = loadUnoLeafScorer({
    version: 1,
    features: unoLeafFeatureNames,
    coefficients: task.simple,
  });
  const roots = await collectUnoRoots(seed, options);
  const evidence: RootEvidence[] = [];
  for (const [index, root] of roots.entries()) {
    const searchSeed = independentSeed(seed, 0x20000 + index);
    const signal = new AbortController().signal;
    const score = (samples: 8 | 16, scorer: typeof fitted) =>
      searchUnoPlays(
        root.view,
        root.actions,
        root.memory,
        new RandomSource(searchSeed),
        signal,
        scorer,
        { samples, maxRuleSteps: samples * 8 * 16 },
      );
    const searches = {
      fitted8: score(8, fitted),
      fitted16: score(16, fitted),
      simple8: score(8, simple),
      simple16: score(16, simple),
    };
    const primary = searches.fitted8;
    if (primary.candidates.length < 2) continue;
    const actions = (method: Method) =>
      JSON.stringify(searches[method].candidates.map(({ action }) => action));
    if (methods.some((method) => actions(method) !== actions('fitted8')))
      throw new Error(
        'Development comparison changed the frozen candidate set',
      );
    const labels = rankingSamples(
      root,
      options,
      fitted,
      primary,
      independentSeed(seed, 0x30000 + index),
      plan.ranking,
    );
    const ordered = { fitted8: 0, fitted16: 0, simple8: 0, simple16: 0 };
    const reference: RootEvidence['reference'] = [];
    let pairs = 0,
      confirmed = 0;
    for (let a = 0; a < primary.candidates.length; a++) {
      for (let b = a + 1; b < primary.candidates.length; b++) {
        pairs++;
        const groups = pairedUnoDifferences(
          labels.outcomes,
          plan.ranking.continuations,
          a,
          b,
        );
        const effect = average(groups);
        if (effect === null || Math.abs(effect) < 0.05) continue;
        const range = bootstrap(
          groups,
          independentSeed(seed, 0x42000 + index * 64 + a * 8 + b),
        );
        if (!range || (range.lower <= 0 && range.upper >= 0)) continue;
        confirmed++;
        reference.push({ left: a, right: b, difference: effect });
        for (const method of methods) {
          const candidates = searches[method].candidates;
          const difference =
            candidates[a]!.winProbability - candidates[b]!.winProbability;
          if (
            (range.lower > 0 && difference > 0) ||
            (range.upper < 0 && difference < 0)
          )
            ordered[method]++;
        }
      }
    }
    evidence.push({
      root,
      pairs,
      confirmed,
      reference,
      ordered,
      unfinished: labels.unfinished,
    });
  }
  return { seed, evidence };
}

const { values } = parseArgs({
  options: {
    plan: { type: 'string' },
    calibration: { type: 'string' },
    checkpoint: { type: 'string' },
    worker: { type: 'string' },
    jobs: { type: 'string', default: '1' },
    'steps-per-run': { type: 'string' },
  },
});
if (values.worker) {
  console.log(JSON.stringify(await collect(JSON.parse(values.worker) as Task)));
} else {
  if (!values.plan || !values.calibration || !values.checkpoint)
    throw new Error(
      'Pass the frozen development plan and B report and a checkpoint path',
    );
  const sha = (bytes: Buffer | string) =>
    createHash('sha256').update(bytes).digest('hex');
  const source = fileURLToPath(import.meta.url);
  const planBytes = readFileSync(values.plan);
  const calibrationBytes = readFileSync(values.calibration);
  const plan = JSON.parse(planBytes.toString('utf8')) as Plan;
  const report = JSON.parse(calibrationBytes.toString('utf8'));
  if (
    plan.version !== 1 ||
    !Array.isArray(plan.seeds) ||
    [
      plan.roots,
      plan.maxSteps,
      plan.ranking?.worldBatches,
      plan.ranking?.continuations,
    ].some((n) => !Number.isSafeInteger(n) || n < 1)
  )
    throw new Error('Invalid development ranking plan');
  verifyPartition(plan.seeds);
  if (
    !isCurrentUnoPilot(report.pilot) ||
    report.type !== 'uno-calibration-development' ||
    report.calibrationDigest !== sha(JSON.stringify(report.calibration))
  )
    throw new Error('Use the intended B calibration report');
  const excluded = new Set(calibrationSeeds(report));
  if (plan.seeds.some((seed) => excluded.has(seed)))
    throw new Error('The ranking development plan reuses B data');
  const jobs = Number(values.jobs);
  const maxJobs = Math.min(8, Math.max(1, availableParallelism() - 2));
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > maxJobs)
    throw new Error('Invalid number of development workers');
  const limit = Number(values['steps-per-run'] ?? plan.seeds.length);
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error('Invalid development seed limit');
  const bSha256 = sha(calibrationBytes);
  const project = new URL('../../../', import.meta.url);
  const runtimeFiles = [
    ...['bot', 'data', 'rules'].flatMap((directory) => {
      const path = 'games/uno/' + directory + '/';
      return readdirSync(new URL(path, project), { withFileTypes: true })
        .filter(
          (file) =>
            file.isFile() &&
            file.name.endsWith('.ts') &&
            !file.name.endsWith('.test.ts') &&
            file.name !== 'test-fixtures.ts',
        )
        .map((file) => path + file.name);
    }),
    ...['index', 'config', 'types'].map((name) => 'games/uno/' + name + '.ts'),
    ...['bot-scheduler', 'game-actions', 'random'].map(
      (name) => 'packages/platform-core/src/' + name + '.ts',
    ),
    ...[
      'diagnose-uno-ranking',
      'uno-calibration-seed',
      'uno-calibration-fit',
      'uno-calibration-provenance',
      'uno-samples',
      'uno-pilot',
      'evaluate',
      'fit',
      'training-checkpoint',
    ].map((name) => 'tools/analysis/bots/' + name + '.ts'),
  ].sort();
  const sourceFingerprint = () =>
    sha(
      JSON.stringify(
        runtimeFiles.map((file) => sha(readFileSync(new URL(file, project)))),
      ),
    );
  const sourceSha256 = sourceFingerprint();
  const identity = sha(
    JSON.stringify([sha(planBytes), bSha256, sourceSha256, process.version]),
  );
  type Entry = Awaited<ReturnType<typeof collect>>;
  const checkpoint = openTrainingCheckpoint<Entry[]>(
    values.checkpoint,
    identity,
    [],
  );
  const done = checkpoint.state;
  if (
    !Array.isArray(done) ||
    done.some(({ seed }, i) => plan.seeds[i] !== seed)
  )
    throw new Error('Development checkpoint has different seeds');
  const exec = promisify(execFile);
  const pending = plan.seeds.slice(done.length, done.length + limit);
  for (let offset = 0; offset < pending.length; offset += jobs) {
    const group = pending.slice(offset, offset + jobs);
    const data = await Promise.allSettled(
      group.map(async (seed) => {
        const task: Task = {
          seed,
          plan,
          fitted: report.calibration.coefficients,
          simple: referenceAnchor(
            report.baselineCoefficients,
            unoLeafFeatureNames.length,
          ),
        };
        return group.length === 1
          ? collect(task)
          : (JSON.parse(
              (
                await exec(
                  process.execPath,
                  [
                    '--import',
                    'tsx',
                    source,
                    '--worker=' + JSON.stringify(task),
                  ],
                  {
                    windowsHide: true,
                    encoding: 'utf8',
                    maxBuffer: 4 * 1024 * 1024,
                  },
                )
              ).stdout,
            ) as Entry);
      }),
    );
    for (const [index, result] of data.entries()) {
      if (result.status === 'rejected') throw result.reason;
      const entry = result.value;
      if (entry.seed !== group[index])
        throw new Error('Development worker returned a different seed');
      if (sourceFingerprint() !== sourceSha256)
        throw new Error('Ranking development sources changed during the batch');
      done.push(entry);
      checkpoint.save(done);
      console.error(
        JSON.stringify({
          seed: entry.seed,
          completed: done.length,
          planned: plan.seeds.length,
        }),
      );
    }
  }
  const roots = done.flatMap(({ evidence }) => evidence);
  const confirmed = roots.reduce((sum, row) => sum + row.confirmed, 0);
  console.log(
    JSON.stringify(
      {
        type: 'uno-b-ranking-development',
        diagnosticsOnly: true,
        complete: done.length === plan.seeds.length,
        bSha256,
        sourceSha256,
        plan,
        processedSeeds: done.length,
        roots: roots.length,
        pairs: roots.reduce((sum, row) => sum + row.pairs, 0),
        confirmed,
        unfinished: roots.reduce((sum, row) => sum + row.unfinished, 0),
        methods: Object.fromEntries(
          methods.map((method) => {
            const ordered = roots.reduce(
              (sum, row) => sum + row.ordered[method],
              0,
            );
            return [
              method,
              { ordered, accuracy: confirmed ? ordered / confirmed : null },
            ];
          }),
        ),
      },
      null,
      2,
    ),
  );
}
