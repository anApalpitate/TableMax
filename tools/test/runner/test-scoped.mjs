import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { spawn } from 'node:child_process';
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
const listOnly = args.includes('--list');
const filters = args.filter((arg) => !arg.startsWith('--'));
if (
  args.some(
    (arg) =>
      arg.startsWith('--') &&
      !arg.startsWith('--scope=') &&
      !arg.startsWith('--plan=') &&
      arg !== '--list',
  )
)
  throw new Error(
    'Usage: node tools/test/runner/test-scoped.mjs --scope=<scope> [exact.test.ts ... | --plan=<plan.json>] [--list]',
  );

if (planPath) {
  if (filters.length)
    throw new Error('Batch plans cannot include Vitest file filters');
  const plan = validateBatchScope(
    JSON.parse(readFileSync(planPath, 'utf8')),
    scope,
  );
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
} else {
  const selection = selectUnitTests(process.cwd(), scope, filters);
  if (listOnly) console.log(JSON.stringify(selection, null, 2));
  else if (!selection.selected.length)
    throw new Error(
      'No applicable Vitest tests; choose the required Node/document checks instead',
    );
  else {
    const child = spawn(
      process.execPath,
      [resolve('node_modules/vitest/vitest.mjs'), 'run', ...selection.selected],
      {
        cwd: process.cwd(),
        windowsHide: true,
        shell: false,
        stdio: 'inherit',
        env: {
          ...process.env,
          TABLEMAX_TEST_SCOPE: scope,
          TABLEMAX_TEST_SOUND: 'off',
        },
      },
    );
    child.once('error', (error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
    child.once('exit', (code) => {
      process.exitCode = code ?? 1;
    });
  }
}
