import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  allowsScope,
  parseScope,
  scopedVitestIncludes,
  selectUnitTests,
  unitTestScopes,
  validateBatchScope,
} from './scopes.mjs';

const root = process.cwd();
const item = (script, args = []) => ({
  id: 'fixture',
  runtime: 'node',
  script,
  args,
});
const plan = (...tests) => ({ version: 1, tests });

test('scope is explicit, validated, and matches every exercised domain', () => {
  assert.throws(() => parseScope(undefined), /explicit test scope/);
  assert.throws(() => parseScope('game:unknown'), /Invalid/);
  assert.throws(() => parseScope('box,box'), /Invalid/);
  assert.throws(() => parseScope('full,box'), /Invalid/);
  assert.equal(
    allowsScope(parseScope('box'), ['box', 'game:modern-art']),
    false,
  );
  assert.equal(
    allowsScope(parseScope('box,game:modern-art'), ['box', 'game:modern-art']),
    true,
  );
  assert.equal(allowsScope(parseScope('box'), undefined), false);
});

test('box selection excludes game and shared checks, while exact avatar filters remain available', () => {
  const selected = selectUnitTests(root, 'box');
  assert.ok(
    selected.selected.includes('apps/server/src/avatar-upload.test.ts'),
  );
  assert.equal(
    selected.unclassified.length,
    0,
    selected.unclassified.join('\n'),
  );
  for (const file of selected.selected)
    assert.deepEqual(unitTestScopes(file), ['box']);
  assert.ok(!selected.selected.includes('apps/server/src/platform.test.ts'));
  assert.throws(
    () =>
      selectUnitTests(root, 'box', ['games/modern-art/rules/rules.test.ts']),
    /outside/,
  );
  assert.deepEqual(
    selectUnitTests(root, 'box', ['apps/server/src/avatar.test.ts']).selected,
    ['apps/server/src/avatar.test.ts'],
  );
});

test('each single game includes its service tests and excludes mixed matrices and other games', () => {
  for (const [id, serverFile] of [
    ['pokemon-encounters', 'pokemon-crash'],
    ['modern-art', 'modern-art'],
    ['power-grid', 'power-grid'],
  ]) {
    const selected = selectUnitTests(root, `game:${id}`).selected;
    assert.ok(selected.includes(`apps/server/src/${serverFile}.test.ts`));
    assert.ok(selected.includes(`games/${id}/rules/rules.test.ts`));
    for (const file of selected)
      assert.deepEqual(unitTestScopes(file), [`game:${id}`]);
    assert.ok(!selected.includes('apps/server/src/save-storage-games.test.ts'));
  }
});

test('shared changes select explicit dependencies and broad Vitest cannot silently run every game', () => {
  assert.throws(
    () => scopedVitestIncludes(root, undefined, ['run']),
    /explicit/,
  );
  const shared = selectUnitTests(root, 'shared').selected;
  assert.ok(shared.includes('apps/server/src/interactions.test.ts'));
  assert.ok(!shared.includes('packages/platform-core/src/countdown.test.ts'));
  const affected = selectUnitTests(
    root,
    'shared,game:pokemon-encounters,game:modern-art',
  ).selected;
  assert.ok(affected.includes('packages/platform-core/src/countdown.test.ts'));
  assert.ok(!affected.includes('apps/server/src/game-registry.test.ts'));
  assert.deepEqual(
    scopedVitestIncludes(root, undefined, [
      'run',
      'apps/server/src/avatar.test.ts',
    ]),
    ['apps/server/src/avatar.test.ts'],
  );
  assert.throws(
    () => selectUnitTests(root, 'box', ['apps/server/src']),
    /exact existing/,
  );
});

test('batch scope validates the entire matrix and real game selectors before anything starts', () => {
  assert.doesNotThrow(() =>
    validateBatchScope(plan(item('scripts/verify-box-layout.mjs')), 'box'),
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('scripts/verify-box-layout.mjs'),
          item('scripts/verify-box-debug.mjs'),
        ),
        'box',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('scripts/verify-modern-art.mjs')),
        'game:modern-art',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('scripts/verify-player-display.mjs')),
        'game:modern-art',
      ),
    /outside/,
  );
  for (const script of [
    'scripts/verify-player-display.mjs',
    'scripts/verify-rules-guides.mjs',
    'scripts/verify-interactions.mjs',
  ]) {
    assert.doesNotThrow(() =>
      validateBatchScope(
        plan(
          item(
            script,
            script.endsWith('verify-player-display.mjs')
              ? ['--game=modern-art', '--visual-audit']
              : ['--game=modern-art'],
          ),
        ),
        'game:modern-art',
      ),
    );
    assert.throws(
      () =>
        validateBatchScope(
          plan(item(script, ['--game=modern-art', '--game=power-grid'])),
          'full',
        ),
      /duplicate/,
    );
    assert.throws(
      () =>
        validateBatchScope(
          plan(item(script, ['--game=all', '--game=modern-art'])),
          'full',
        ),
      /duplicate/,
    );
  }
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('scripts/verify-player-display.mjs', ['--game=all'])),
        'full',
      ),
    /does not support/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('scripts/verify-player-display.mjs', [
            '--game=modern-art',
            '--quick',
          ]),
        ),
        'game:modern-art',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('scripts/verify-box-debug.mjs')),
        'box,game:power-grid',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('scripts/verify-box-debug.mjs', ['--game=modern-art'])),
        'box',
      ),
    /no registered game filter/,
  );
  assert.throws(
    () => validateBatchScope(plan(item('unknown.mjs')), 'box'),
    /unregistered/,
  );
  assert.doesNotThrow(() =>
    validateBatchScope(plan(item('unknown.mjs')), 'full'),
  );
});

test('interaction verifier limits box and single-game checks without accepting mixed filters', () => {
  assert.doesNotThrow(() =>
    validateBatchScope(
      plan(item('scripts/verify-interactions.mjs', ['--shot-visuals'])),
      'box,shared',
    ),
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('scripts/verify-interactions.mjs', ['--shot-visuals'])),
        'game:modern-art',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('scripts/verify-interactions.mjs', [
            '--shot-visuals',
            '--box-only',
          ]),
        ),
        'full',
      ),
    /mutually exclusive/,
  );
  assert.doesNotThrow(() =>
    validateBatchScope(
      plan(item('scripts/verify-interactions.mjs', ['--box-only'])),
      'box,shared',
    ),
  );
  assert.throws(
    () =>
      validateBatchScope(plan(item('scripts/verify-interactions.mjs')), 'box'),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('scripts/verify-interactions.mjs', ['--game=power-grid'])),
        'game:modern-art',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('scripts/verify-interactions.mjs', [
            '--box-only',
            '--game=modern-art',
          ]),
        ),
        'full',
      ),
    /mutually exclusive/,
  );
});

test('real scoped entry lists selections without running product tests and rejects missing scope', () => {
  const listed = spawnSync(
    process.execPath,
    ['scripts/test-scoped.mjs', '--scope=box', '--list'],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
  assert.equal(listed.status, 0, listed.stderr);
  const selection = JSON.parse(listed.stdout);
  assert.equal(selection.scope, 'box');
  assert.ok(selection.selected.length > 0);
  assert.ok(
    selection.selected.every((file) =>
      unitTestScopes(file).every((scope) => scope === 'box'),
    ),
  );
  const rejected = spawnSync(process.execPath, ['scripts/test-scoped.mjs'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /explicit test scope/);
});

test('menu-only validation requires shared and precisely the affected game scopes', () => {
  const menus = plan(
    item('scripts/verify-interactions.mjs', [
      '--menus-only',
      '--game=modern-art',
    ]),
  );
  assert.doesNotThrow(() =>
    validateBatchScope(menus, 'shared,game:modern-art'),
  );
  assert.throws(() => validateBatchScope(menus, 'game:modern-art'), /outside/);
  assert.throws(() => validateBatchScope(menus, 'box,shared'), /outside/);
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('scripts/verify-interactions.mjs', [
            '--menus-only',
            '--box-only',
          ]),
        ),
        'full',
      ),
    /mutually exclusive/,
  );
});
