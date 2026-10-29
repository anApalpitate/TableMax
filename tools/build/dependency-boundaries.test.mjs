import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import { dependencyViolation } from './dependency-boundaries.mjs';

test('production boundaries reject aliases, relative traversal, private sessions and other-game assets', () => {
  const violations = [
    ['packages/web-host/src/bad.ts', '../../../games/uno/index'],
    ['packages/platform-core/src/bad.ts', '@tablemax/game-uno'],
    ['games/uno/web/bad.ts', '../../../apps/web/src/session'],
    ['games/uno/web/bad.ts', '@tablemax/platform-core'],
    ['games/uno/web/bad.ts', '@tablemax/web-host/platform'],
    ['games/uno/web/bad.ts', '@tablemax/web-host/src/types'],
    ['games/uno/web/bad.ts', '@tablemax/game-manila'],
    ['games/uno/web/bad.ts', '../../../assets/games/manila/harbor.webp'],
    ['games/uno/web/bad.ts', '../../../packages/web-host/src/types'],
  ];
  for (const [file, spec] of violations)
    assert.ok(dependencyViolation(resolve(file), spec), `${file}: ${spec}`);
});
test('public contracts, same-game variants and explicit test fixtures remain legal', () => {
  for (const [file, spec] of [
    ['games/uno/web/ok.ts', '@tablemax/game-sdk'],
    ['games/uno/web/ok.ts', '@tablemax/web-host'],
    ['games/pokemon-encounters/expansion/web/ok.ts', '../../ui/BoardGrid'],
    ['games/uno/web/ok.ts', '../../../assets/games/uno/cards.webp'],
    ['packages/platform-core/src/room.test.ts', '@tablemax/game-uno'],
  ])
    assert.equal(
      dependencyViolation(resolve(file), spec, process.cwd(), {
        testContext: true,
      }),
      null,
    );
  assert.ok(
    dependencyViolation(
      resolve(
        'games/pokemon-encounters/expansion/config/compatibility-fixture.ts',
      ),
      'node:crypto',
    ),
  );
});
test('the actual lint entry rejects dynamic imports and re-exports as well as static imports', async () => {
  const lint = new ESLint();
  for (const code of [
    "import x from '@tablemax/game-uno'; void x;",
    "export * from '@tablemax/game-uno';",
    "void import('@tablemax/game-uno');",
    "const x = require('@tablemax/game-uno'); void x;",
    "type X = import('@tablemax/game-uno').View; export type { X };",
  ]) {
    const [result] = await lint.lintText(code, {
      filePath: 'packages/platform-core/src/boundary-probe.ts',
    });
    assert.equal(
      result.messages.filter((x) => x.ruleId === 'architecture/boundaries')
        .length,
      1,
      JSON.stringify(result.messages),
    );
  }
});
