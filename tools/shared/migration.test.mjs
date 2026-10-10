import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  migrationPaths,
  historyPath,
  executionPath,
} from './migration-paths.mjs';
import { workspaceRoot } from './workspace-root.mjs';
import { TestHistory, testIdentity } from '../test/runner/history.mjs';
import { importVitest } from '../test/runner/test-history.mjs';
import ts from 'typescript';

test('migration targets and executable relative imports exist; runtime imports stay outside tooling', () => {
  assert.equal(existsSync(resolve('scripts')), false);
  for (const [old, target] of Object.entries(migrationPaths)) {
    assert.ok(old.startsWith('scripts/'));
    assert.ok(existsSync(resolve(target)), target);
    assert.equal(executionPath(old.replaceAll('/', '\\')), target);
  }
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(?:mjs|ts|tsx|mts)$/.test(entry.name)) {
        const source = readFileSync(path, 'utf8');
        const tree = ts.createSourceFile(
          path,
          source,
          ts.ScriptTarget.Latest,
          true,
        );
        for (const statement of tree.statements) {
          if (
            !ts.isImportDeclaration(statement) &&
            !ts.isExportDeclaration(statement)
          )
            continue;
          const request = statement.moduleSpecifier?.text;
          if (!request?.startsWith('.')) continue;
          const target = resolve(dirname(path), request);
          assert.ok(
            existsSync(target) ||
              existsSync(target.replace(/\.js$/, '.ts')) ||
              existsSync(target + '.ts') ||
              existsSync(target + '.tsx'),
            `${path}: ${request}`,
          );
        }
      }
    }
  }
  visit(resolve('tools'));
  for (const file of ['save-storage.ts', 'save-audit.ts', 'save-codec.mjs']) {
    const source = readFileSync(resolve('apps/server/src', file), 'utf8');
    assert.doesNotMatch(source, /(?:scripts|tools)\//);
  }
});

test('a moved test preserves counts, weakest-file queries and JSON import idempotency', () => {
  const root = mkdtempSync(join(tmpdir(), 'tablemax-history-migration-'));
  const history = new TestHistory(root);
  try {
    const old = 'scripts/testing/scopes.test.mjs';
    const current = migrationPaths[old];
    const name = ['migration continuity'];
    const oldIdentity = testIdentity('vitest', old, name);
    assert.equal(testIdentity('vitest', current, name).id, oldIdentity.id);
    const report = {
      startTime: 123456,
      testResults: [
        {
          name: resolve(root, old),
          assertionResults: [
            {
              title: name[0],
              ancestorTitles: [],
              status: 'passed',
              duration: 1,
            },
          ],
        },
      ],
    };
    importVitest(history, report);
    const run = history.start(3);
    history.record(
      run,
      `${run}:new`,
      testIdentity('vitest', current, name),
      'failed',
      1,
    );
    history.finish(run, 'failed', 1);
    importVitest(history, report);
    const stat = history.get(oldIdentity.id);
    assert.equal(stat.total, 2);
    assert.equal(stat.passed, 1);
    assert.equal(history.fileRate(current).total, 2);
    assert.equal(history.all()[0].file, current);
    assert.equal(historyPath(current.replaceAll('/', '\\')), old);
    assert.notEqual(
      testIdentity('vitest', current, ['new test']).id,
      oldIdentity.id,
    );
  } finally {
    history.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('incorrect cwd fails before output; root helper supports spaces and Chinese paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'TableMax 空格迁移-'));
  try {
    for (const file of [
      'tools/build/build.mjs',
      'tools/assets/platform/generate-game-sounds.mjs',
      'tools/test/runner/test-scoped.mjs',
    ]) {
      const result = spawnSync(
        process.execPath,
        [resolve(workspaceRoot, file)],
        {
          cwd: root,
          encoding: 'utf8',
          windowsHide: true,
          env: { ...process.env, TABLEMAX_AUTO_MAINTENANCE: '0' },
        },
      );
      assert.notEqual(result.status, 0, file);
      assert.match(result.stderr, /repository root/);
      assert.deepEqual(readdirSync(root), []);
    }
    mkdirSync(join(root, 'tools/shared'), { recursive: true });
    copyFileSync(
      resolve(workspaceRoot, 'tools/shared/workspace-root.mjs'),
      join(root, 'tools/shared/workspace-root.mjs'),
    );
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'tablemax', type: 'module' }),
    );
    const entry = join(root, 'tools/entry.mjs');
    writeFileSync(
      entry,
      "import { assertWorkspaceRoot, isDirectExecution } from './shared/workspace-root.mjs'; if(isDirectExecution(import.meta.url)) console.log(assertWorkspaceRoot());",
    );
    const result = spawnSync(process.execPath, [entry], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(resolve(result.stdout.trim()), resolve(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
