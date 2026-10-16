import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { introductionResourceInputs } from './module-build.mjs';
import {
  projectGameCatalog,
  projectGameDetails,
} from '../../packages/game-sdk/src/metadata.mjs';

const manifest = async () =>
  JSON.parse(
    await readFile('games/pokemon-encounters/game-module.json', 'utf8'),
  );

test('variant diagrams survive detail projection and join frozen resource inputs', async () => {
  const module = await manifest();
  const paths = await introductionResourceInputs(module);
  assert.equal(paths.length, 3);
  assert(
    paths.every((path) =>
      path.startsWith('assets/games/pokemon-encounters/expansion/'),
    ),
  );
  const frozen = JSON.parse(JSON.stringify(projectGameDetails(module)));
  assert.deepEqual(
    frozen.variants[0].introduction.steps
      .map((step) => step.illustration)
      .sort(),
    paths,
  );
  assert.equal('introduction' in projectGameCatalog(module), false);
  frozen.variants[0].introduction.steps[0].illustration = 'changed';
  assert.notEqual(
    module.variants[1].introduction.steps[0].illustration,
    'changed',
  );
});

test('legacy manifests without illustration fields retain their existing inputs', async () => {
  assert.deepEqual(await introductionResourceInputs({ id: 'legacy' }), []);
  const module = await manifest();
  for (const variant of module.variants)
    for (const step of variant.introduction?.steps ?? [])
      delete step.illustration;
  assert.deepEqual(await introductionResourceInputs(module), []);
});

test('resource collector rejects remote, cross-game, escape and non-SVG paths', async () => {
  for (const illustration of [
    'https://example.com/introduction.svg',
    'assets/games/uno/introduction-1-v1.svg',
    'assets/games/pokemon-encounters/../uno/introduction-1-v1.svg',
    'assets/games/pokemon-encounters/expansion/../../introduction-1-v1.svg',
    'assets/games/pokemon-encounters/cover-catalog-v2.webp',
    7,
  ])
    await assert.rejects(
      introductionResourceInputs({
        id: 'pokemon-encounters',
        introduction: { steps: [{ illustration }] },
      }),
      /Invalid introduction illustration/,
    );
});

test('resource collector rejects a missing local SVG instead of freezing an absent image', async () => {
  await assert.rejects(
    introductionResourceInputs({
      id: 'pokemon-encounters',
      introduction: {
        steps: [
          {
            illustration: 'assets/games/pokemon-encounters/does-not-exist.svg',
          },
        ],
      },
    }),
    /ENOENT/,
  );
});
