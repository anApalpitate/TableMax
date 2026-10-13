import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectUnitTests, validateBatchScope } from './scopes.mjs';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
function option(name) {
  const matches = args.filter((arg) => arg.startsWith(`--${name}=`));
  if (matches.length > 1) throw new Error(`Duplicate --${name} option`);
  return matches[0]?.slice(name.length + 3);
}
const scope = option('scope') ?? process.env.TABLEMAX_TEST_SCOPE;
const planPath = option('plan');
const preset = option('preset');
const listOnly = args.includes('--list');
const changesPath = option('changes');
const force = args.includes('--force');
const filters = args.filter((arg) => !arg.startsWith('--'));
if (
  args.some(
    (arg) =>
      arg.startsWith('--') &&
      !arg.startsWith('--scope=') &&
      !arg.startsWith('--plan=') &&
      !arg.startsWith('--changes=') &&
      !arg.startsWith('--preset=') &&
      !['--list', '--force'].includes(arg),
  )
)
  throw new Error(
    'Usage: node tools/test/runner/test-scoped.mjs --scope=<scope> [exact.test.ts ... | --plan=<plan.json> | --preset=<rules,ui,resources,tooling> --changes=<owned.json>] [--list] [--force (version 2 only)]',
  );

if (planPath || preset) {
  if (preset && (planPath || !changesPath))
    throw new Error('Presets require --changes and cannot include --plan');
  if (filters.length)
    throw new Error('Batch plans cannot include Vitest file filters');
  const raw = preset
    ? { version: 2 }
    : JSON.parse(readFileSync(planPath, 'utf8'));
  if (raw.version === 2) {
    const { preparePlan } = await import('./plan.mjs');
    const { runPlan } = await import('./run-plan.mjs');
    const changes = changesPath
      ? JSON.parse(readFileSync(changesPath, 'utf8'))
      : undefined;
    const plan = preset
      ? (await import('./presets.mjs')).preparePreset(
          process.cwd(),
          preset,
          changes,
          scope,
          { force },
        )
      : preparePlan(process.cwd(), raw, changes, scope, { force });
    if (listOnly) {
      const selection = {
        version: 2,
        scope: plan.scope,
        preset: plan.preset,
        excluded: plan.excluded ?? [],
        timings: plan.timings,
        tests: plan.tests.map((item) => ({
          id: item.id,
          selectedBy: item.selectedBy,
          decision: item.decision,
          reason: item.reason,
          fingerprint: item.binding.key,
          combination: item.combination,
          evidencePath: item.evidencePath,
          gaps: item.binding.value.gaps,
        })),
      };
      if (preset) {
        const { selectionListOutput } = await import('./log-output.mjs');
        console.log((await selectionListOutput(process.cwd(), selection)).text);
      } else console.log(JSON.stringify(selection, null, 2));
    } else {
      const { TestHistory } = await import('./history.mjs');
      const { finishVerificationRound } = await import('./round.mjs');
      const history = new TestHistory(process.cwd());
      try {
        const report = await runPlan(plan, history, {
          finish: (context) => finishVerificationRound(history.root, context),
        });
        console.log(report.output + '/results.json');
        if (report.run.state !== 'passed') process.exitCode = 1;
      } finally {
        history.close();
      }
    }
  } else {
    if (changesPath || force)
      throw new Error('--changes and --force require a version 2 plan');
    const plan = validateBatchScope(raw, scope);
    if (listOnly) console.log(JSON.stringify(plan, null, 2));
    else {
      // Validate the entire selection before constructing history or spawning.
      const { runBatch } = await import('./test-batch.mjs');
      const { TestHistory } = await import('./history.mjs');
      const history = new TestHistory(process.cwd());
      try {
        const report = await runBatch(plan, history);
        writeFileSync(
          resolve(history.directory, 'runs', report.run.id, 'scope.json'),
          JSON.stringify(
            { scope, tests: plan.tests.map((test) => test.id) },
            null,
            2,
          ) + '\n',
        );
        if (report.run.state !== 'passed') process.exitCode = 1;
      } finally {
        history.close();
      }
    }
  }
} else {
  if (changesPath || force)
    throw new Error('--changes and --force require a version 2 plan');
  const selection = selectUnitTests(process.cwd(), scope, filters);
  if (listOnly) console.log(JSON.stringify(selection, null, 2));
  else if (!selection.selected.length)
    throw new Error(
      'No applicable Vitest tests; choose the required Node/document checks instead',
    );
  else {
    const { TestHistory } = await import('./history.mjs');
    const { runUnitTests } = await import('./run-unit.mjs');
    const history = new TestHistory(process.cwd());
    try {
      const report = await runUnitTests(selection.selected, scope, history);
      if (report.run.state !== 'passed') process.exitCode = 1;
    } finally {
      history.close();
    }
  }
}
