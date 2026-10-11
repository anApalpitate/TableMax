import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { leanCatalogPlugin } from './lean-catalog.mjs';
import { removeDevelopmentDetails } from './module-build.mjs';

test('development transform drops detailed module imports before bundling', async () => {
  const root = await mkdtemp(resolve('tmp/lean-catalog-'));
  try {
    const directory = resolve(root, 'games/example');
    await mkdir(directory, { recursive: true });
    await mkdir(resolve(root, 'games/no-manifest'));
    await writeFile(
      resolve(directory, 'game-module.json'),
      JSON.stringify({
        id: 'example',
        order: 1,
        internal: false,
        catalog: {
          id: 'example',
          name: 'Example',
          min: 2,
          max: 6,
          decisionTimer: true,
        },
        library: { tags: ['cards'], searchTerms: ['alias'] },
        cover: 'assets/games/example/cover.webp',
        introduction: { lead: 'DO_NOT_BUNDLE_DETAILED_RULES' },
        entries: { web: 'DO_NOT_BUNDLE_WEB_ENTRY' },
        compatibility: { webHost: 1 },
        budgets: { basis: 'DO_NOT_BUNDLE_BUDGETS' },
      }),
    );
    const watched = [];
    const plugin = leanCatalogPlugin(root);
    const output = await plugin.transform.call(
      { addWatchFile: (file) => watched.push(file) },
      'const definitions=import.meta.glob("game-module.json",{eager:true});',
      resolve(root, 'apps/web/src/catalog.ts'),
    );
    assert.match(output, /Example/);
    assert.match(output, /\?url/);
    assert.match(output, /alias/);
    assert.doesNotMatch(
      output,
      /DO_NOT_BUNDLE|import\.meta\.glob|decisionTimer/,
    );
    assert.equal(watched.length, 2);
    assert.equal(
      await plugin.transform('', resolve(root, 'apps/web/src/other.ts')),
      undefined,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('production strips development detail globs and refuses missing boundaries', () => {
  const code =
    'import x from "x";\nconst development=import.meta.glob("all-source-details");\nconst cached=new Map();\nexport function details(){}';
  const transformed = removeDevelopmentDetails(code);
  assert.doesNotMatch(transformed, /all-source-details|import\.meta\.glob/);
  assert.match(transformed, /const development=\{\};/);
  assert.match(transformed, /const cached=new Map/);
  assert.throws(
    () => removeDevelopmentDetails('const development={};'),
    /boundary/,
  );
});
