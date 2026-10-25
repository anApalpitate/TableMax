import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

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
  verificationTestScopes,
  selectFixedNativeProfile,
} from './scopes.mjs';
import { selectFixedCanvasCases } from '../platform/fixed-canvas-contract.mjs';

const root = process.cwd();
const item = (script, args = []) => ({
  id: 'fixture',
  runtime: 'node',
  script,
  args,
});
const plan = (...tests) => ({ version: 1, tests });

test('fixed canvas selection binds only its actual layer and migrated variants', () => {
  assert.deepEqual(
    unitTestScopes('packages/web-host/src/layout/fixed-layout.test.ts'),
    ['shared'],
  );
  assert.deepEqual(
    unitTestScopes(
      'packages/web-host/src/layout/fixed-visible-viewport.test.ts',
    ),
    ['shared'],
  );
  const script = 'tools/test/platform/verify-public-screen-retirement-ui.mjs';
  const adapter = item(script, [
    '--layout-contract=fixed-v1',
    '--layer=adapter',
    '--only=adapter-host-minimum',
  ]);
  assert.deepEqual(verificationTestScopes(adapter), ['shared']);
  assert.doesNotThrow(() => validateBatchScope(plan(adapter), 'shared'));
  assert.equal(
    selectFixedCanvasCases([
      '--layout-contract=fixed-v1',
      '--layer=adapter',
      '--only=adapter-player-portrait-safe-insets,adapter-player-landscape-focused-height-change,adapter-player-portrait-overlay-focus',
    ]).cases.length,
    3,
  );
  const content = item(script, [
    '--layout-contract=fixed-v1',
    '--layer=content',
    '--only=content-modern-art-player-portrait',
  ]);
  assert.deepEqual(verificationTestScopes(content), [
    'shared',
    'game:modern-art',
  ]);
  assert.throws(() => validateBatchScope(plan(content), 'shared'), /outside/);
  assert.doesNotThrow(() =>
    validateBatchScope(plan(content), 'shared,game:modern-art'),
  );
  const selected = selectFixedCanvasCases(content.args);
  assert.deepEqual(selected.variants, ['modern-art']);
  assert.equal(selected.cases.length, 1);
  assert.equal(selected.cases[0].width, 360);
  assert.equal(selected.cases[0].height, 800);
  assert.equal(selected.expectedCaseIds.length, 3);
});

test('fixed canvas rejects unknown IDs, unmigrated games and legacy arguments', () => {
  const base = ['--layout-contract=fixed-v1', '--layer=content'];
  for (const extra of [
    ['--only=content-uno-host'],
    ['--only=adapter-host-minimum'],
    ['--only=content-modern-art-host,content-modern-art-host'],
    ['--layer=content'],
    ['--phase=after'],
    ['--review-only'],
  ])
    assert.throws(() => selectFixedCanvasCases([...base, ...extra]));
  assert.throws(() =>
    selectFixedCanvasCases(['--layout-contract=fixed-v2', '--layer=content']),
  );
  assert.throws(() => selectFixedCanvasCases(['--layout-contract=fixed-v1']));
});

test('only platform overlay canvas cases add box scope and their generated-entry dependencies', () => {
  const script = 'tools/test/platform/verify-public-screen-retirement-ui.mjs';
  const base = ['--layout-contract=fixed-v1', '--layer=adapter'];
  const platform = item(script, [
    ...base,
    '--only=adapter-host-platform-overlays,adapter-player-portrait-platform-video',
  ]);
  assert.deepEqual(verificationTestScopes(platform), ['box', 'shared']);
  assert.throws(() => validateBatchScope(plan(platform), 'shared'), /outside/);
  assert.doesNotThrow(() => validateBatchScope(plan(platform), 'box,shared'));
  const selected = selectFixedCanvasCases(platform.args);
  assert(
    selected.inputs.files.includes(
      'apps/web/src/components/DisplaySettings.tsx',
    ),
  );
  assert(
    selected.inputs.files.includes(
      'apps/web/src/components/ConfirmationDialog.tsx',
    ),
  );
  const ordinary = selectFixedCanvasCases([
    ...base,
    '--only=adapter-host-minimum',
  ]);
  assert.deepEqual(ordinary.scopes, ['shared']);
  assert.equal(ordinary.platform, false);
  assert(
    !ordinary.inputs.files.some((path) =>
      path.startsWith('apps/web/src/components/'),
    ),
  );
  assert.deepEqual(selectFixedCanvasCases(base).scopes, ['box', 'shared']);
});

test('controlled visual viewport uses the real player frame without importing a game', () => {
  const selected = selectFixedCanvasCases([
    '--layout-contract=fixed-v1',
    '--layer=adapter',
    '--only=adapter-player-portrait-visual-viewport',
  ]);
  assert.deepEqual(selected.scopes, ['shared']);
  assert.deepEqual(selected.variants, []);
  assert.equal(selected.playerFrame, true);
  assert.equal(selected.controlledVisual, true);
  assert.equal(selected.inputs.complete, false);
  assert(
    selected.inputs.files.includes('apps/web/src/components/PlayerFrame.tsx'),
  );
  assert(!selected.inputs.files.some((path) => path.startsWith('games/')));
});

test('fixed native profile is shared while its default UNO host suite retains its scope', () => {
  const script = 'tools/test/desktop/verify-host-only-native.mjs';
  const fixed = item(script, ['--layout-profile=fixed-v1']);
  assert.deepEqual(verificationTestScopes(fixed), ['shared']);
  assert.doesNotThrow(() => validateBatchScope(plan(fixed), 'shared'));
  assert.throws(
    () => validateBatchScope(plan(item(script)), 'shared'),
    /outside/,
  );
  assert.doesNotThrow(() =>
    validateBatchScope(plan(item(script)), 'box,shared,game:uno'),
  );
  assert.deepEqual(
    selectFixedNativeProfile([
      '--layout-profile=fixed-v1',
      '--checks=native-fixed-document-generation',
    ]).checks,
    ['native-fixed-document-generation'],
  );
  for (const args of [
    ['--layout-profile=unknown'],
    ['--layout-profile=fixed-v1', '--layout-profile=fixed-v1'],
    ['--layout-profile=fixed-v1', '--executable=TableMax.exe'],
    ['--layout-profile=fixed-v1', '--foreground'],
    ['--layout-profile=fixed-v1', '--checks=unknown'],
    [
      '--layout-profile=fixed-v1',
      '--checks=native-fixed-ui-size-and-canvas,native-fixed-ui-size-and-canvas',
    ],
    ['--layout-profile=fixed-v1', '--task=tmp/a', '--task=tmp/b'],
  ])
    assert.throws(() => verificationTestScopes(item(script, args)));
});

test('Pokemon layout mode is isolated without registering the legacy full polish matrix', () => {
  const script =
    'tools/test/games/pokemon-encounters/verify-pokemon-polish.mjs';
  const selected = plan(item(script, ['--layout-debug']));
  assert.doesNotThrow(() =>
    validateBatchScope(selected, 'game:pokemon-encounters'),
  );
  assert.throws(() => validateBatchScope(selected, 'game:uno'), /outside/);
  assert.throws(
    () => validateBatchScope(plan(item(script)), 'game:pokemon-encounters'),
    /outside/,
  );
});

test('Manila checks are isolated from every other game and shared product scope', () => {
  for (const file of [
    'games/manila/rules/rules.test.ts',
    'apps/server/src/manila.test.ts',
  ])
    assert.deepEqual(unitTestScopes(file), ['game:manila']);
  const selected = plan(item('tools/test/games/manila/verify-manila.mjs'));
  assert.doesNotThrow(() => validateBatchScope(selected, 'game:manila'));
  assert.throws(() => validateBatchScope(selected, 'game:uno'), /outside/);
});

test('installed Avalon verification requires exactly its shared dependencies', () => {
  const selected = plan(
    item('tools/test/platform/verify-installed-games.mjs', ['--only=avalon']),
  );
  assert.doesNotThrow(() =>
    validateBatchScope(selected, 'box,shared,tooling,game:avalon'),
  );
  assert.throws(
    () => validateBatchScope(selected, 'box,shared,tooling'),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('tools/test/platform/verify-installed-games.mjs', [
            '--only=unknown',
          ]),
        ),
        'full',
      ),
    /Invalid/,
  );
  assert.deepEqual(unitTestScopes('games/avalon/bot/timing.test.ts'), [
    'game:avalon',
    'shared',
  ]);
});

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

test('rummikub has its own scope without opening another game matrix', () => {
  assert.deepEqual(parseScope('game:rummikub'), ['game:rummikub']);
  assert.deepEqual(unitTestScopes('games/rummikub/rules/rules.test.ts'), [
    'game:rummikub',
  ]);
  assert.equal(allowsScope(parseScope('game:rummikub'), ['shared']), false);
  assert.throws(
    () =>
      selectUnitTests(root, 'game:rummikub', [
        'games/modern-art/rules/rules.test.ts',
      ]),
    /outside/,
  );
  const entry = plan(
    item('tools/test/games/rummikub/verify-rummikub-ui.mjs', ['--entry-only']),
  );
  assert.throws(() => validateBatchScope(entry, 'game:rummikub'), /outside/);
  assert.doesNotThrow(() => validateBatchScope(entry, 'box,game:rummikub'));
  assert.doesNotThrow(() =>
    validateBatchScope(
      plan(item('tools/test/games/rummikub/verify-rummikub-ui.mjs')),
      'game:rummikub',
    ),
  );
});

test('uno checks are isolated from other games and mixed verification matrices', () => {
  assert.deepEqual(parseScope('game:uno'), ['game:uno']);
  for (const file of [
    'games/uno/rules/rules.test.ts',
    'apps/server/src/uno.test.ts',
    'apps/server/src/uno-worker.test.ts',
  ])
    assert.deepEqual(unitTestScopes(file), ['game:uno']);
  assert.doesNotThrow(() =>
    validateBatchScope(
      plan(item('tools/test/games/uno/verify-uno.mjs', ['--mode=ui'])),
      'game:uno',
    ),
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('tools/test/games/rummikub/verify-rummikub-ui.mjs')),
        'game:uno',
      ),
    /outside/,
  );
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

test('Avalon rules, service and portable checks remain within their own game scope', () => {
  assert.deepEqual(parseScope('game:avalon'), ['game:avalon']);
  for (const file of [
    'games/avalon/rules/rules.test.ts',
    'apps/server/src/avalon.test.ts',
    'apps/server/src/avalon-worker.test.ts',
  ])
    assert.deepEqual(unitTestScopes(file), ['game:avalon']);
  assert.doesNotThrow(() =>
    validateBatchScope(
      plan(item('tools/test/games/avalon/verify-avalon.mjs')),
      'game:avalon',
    ),
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('tools/test/games/uno/verify-uno.mjs')),
        'game:avalon',
      ),
    /outside/,
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
    validateBatchScope(
      plan(item('tools/test/box/verify-box-layout.mjs')),
      'box',
    ),
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('tools/test/box/verify-box-layout.mjs'),
          item('tools/test/box/verify-box-debug.mjs'),
        ),
        'box',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('tools/test/platform/verify-modern-art.mjs')),
        'game:modern-art',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('tools/test/desktop/verify-player-display.mjs')),
        'game:modern-art',
      ),
    /outside/,
  );
  for (const script of [
    'tools/test/desktop/verify-player-display.mjs',
    'tools/test/platform/verify-rules-guides.mjs',
    'tools/test/platform/verify-interactions.mjs',
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
        plan(
          item('tools/test/desktop/verify-player-display.mjs', ['--game=all']),
        ),
        'full',
      ),
    /does not support/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('tools/test/desktop/verify-player-display.mjs', [
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
        plan(item('tools/test/box/verify-box-debug.mjs')),
        'box,game:power-grid',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('tools/test/box/verify-box-debug.mjs', ['--game=modern-art']),
        ),
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
      plan(
        item('tools/test/platform/verify-interactions.mjs', ['--shot-visuals']),
      ),
      'box,shared',
    ),
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('tools/test/platform/verify-interactions.mjs', [
            '--shot-visuals',
          ]),
        ),
        'game:modern-art',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('tools/test/platform/verify-interactions.mjs', [
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
      plan(item('tools/test/platform/verify-interactions.mjs', ['--box-only'])),
      'box,shared',
    ),
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(item('tools/test/platform/verify-interactions.mjs')),
        'box',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('tools/test/platform/verify-interactions.mjs', [
            '--game=power-grid',
          ]),
        ),
        'game:modern-art',
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validateBatchScope(
        plan(
          item('tools/test/platform/verify-interactions.mjs', [
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
  const isolatedEnv = { ...process.env };
  delete isolatedEnv.TABLEMAX_TEST_SCOPE;
  const listed = spawnSync(
    process.execPath,
    ['tools/test/runner/test-scoped.mjs', '--scope=box', '--list'],
    { cwd: root, encoding: 'utf8', windowsHide: true, env: isolatedEnv },
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
  const rejected = spawnSync(
    process.execPath,
    ['tools/test/runner/test-scoped.mjs'],
    {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      env: isolatedEnv,
    },
  );
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /explicit test scope/);
});

test('menu-only validation requires shared and precisely the affected game scopes', () => {
  const menus = plan(
    item('tools/test/platform/verify-interactions.mjs', [
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
          item('tools/test/platform/verify-interactions.mjs', [
            '--menus-only',
            '--box-only',
          ]),
        ),
        'full',
      ),
    /mutually exclusive/,
  );
});
