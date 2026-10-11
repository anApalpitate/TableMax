import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  projectGameCatalog,
  projectGameDetails,
  projectGameRuntime,
  projectGameWeb,
} from './metadata.mjs';

const pokemon = () =>
  readFile('games/pokemon-encounters/game-module.json', 'utf8').then(
    JSON.parse,
  );
const forbidden = [
  'schemaVersion',
  'compatibility',
  'entries',
  'styles',
  'budgets',
  'details',
  'introduction',
  'botIntroduction',
  'guidance',
  'versions',
];

test('uninstalled catalog keeps only browsing fields and canonical variant summaries', async () => {
  const manifest = await pokemon();
  manifest.library.extra = 'must not leak';
  manifest.unknownDetail = 'must not leak';
  const catalog = projectGameCatalog(manifest, '/small-cover.webp');
  for (const field of forbidden) assert.equal(field in catalog, false, field);
  assert.equal('unknownDetail' in catalog, false);
  assert.equal('extra' in catalog.library, false);
  assert.equal(catalog.cover, '/small-cover.webp');
  assert.equal(catalog.catalog.name, manifest.catalog.name);
  assert.deepEqual(
    catalog.variants,
    manifest.variants.map(({ id, name, description }) => ({
      id,
      name,
      description,
    })),
  );
  assert.ok(
    JSON.stringify(catalog).length < JSON.stringify(manifest).length / 3,
  );
  catalog.library.tags.push('new tag');
  catalog.variants[0].name = 'changed';
  assert.equal(manifest.library.tags.includes('new tag'), false);
  assert.equal(manifest.variants[0].name, '原版');
});

test('details and runtime descriptors partition source metadata without changing compatibility', async () => {
  const manifest = await pokemon();
  const details = projectGameDetails(manifest);
  const runtime = projectGameRuntime(manifest, {
    details: 'web/details.json',
    entries: {
      rules: 'rules/game.cjs',
      bot: 'bots/game.cjs',
      web: 'web/entry.js',
    },
    styles: ['web/game.css'],
    cover: null,
  });
  for (const field of [
    'introduction',
    'botIntroduction',
    'guidance',
    'versions',
  ])
    assert.equal(field in runtime, false, field);
  assert.equal(
    runtime.variants.some((variant) => 'introduction' in variant),
    false,
  );
  assert.equal(runtime.cover, null);
  assert.deepEqual(runtime.compatibility, manifest.compatibility);
  assert.deepEqual(
    runtime.variants.map((variant) => variant.compatibility),
    manifest.variants.map((variant) => variant.compatibility),
  );
  assert.deepEqual(details.introduction, manifest.introduction);
  assert.deepEqual(details.botIntroduction, manifest.botIntroduction);
  assert.deepEqual(details.variants, [
    { id: 'expansion', introduction: manifest.variants[1].introduction },
  ]);
  assert.equal(details.guidance, true);
  assert.deepEqual(projectGameWeb(runtime), {
    id: manifest.id,
    compatibility: { webHost: 1 },
    entries: { web: 'web/entry.js' },
    styles: ['web/game.css'],
  });
  runtime.compatibility.gameVersion = 'changed';
  details.introduction.steps[0].text = 'changed';
  assert.equal(manifest.compatibility.gameVersion, '1.0.0');
  assert.notEqual(manifest.introduction.steps[0].text, 'changed');
});

test('old embedded details are still projectable without rewriting their descriptor', async () => {
  const manifest = await pokemon();
  manifest.versions = [
    { name: 'legacy', selected: true, description: 'legacy' },
  ];
  const before = JSON.stringify(manifest);
  assert.equal(projectGameDetails(manifest).guidance, true);
  assert.equal(projectGameCatalog(manifest).variants[0].id, 'original');
  assert.equal(JSON.stringify(manifest), before);
  assert.deepEqual(projectGameDetails({ id: 'minimal' }), {
    schemaVersion: 1,
    id: 'minimal',
  });
});
